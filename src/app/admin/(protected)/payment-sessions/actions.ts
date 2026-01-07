
'use server';

import { isAdminAuthenticated } from '@/app/actions';
import { PaymentLock, User, Product, Order, Notification, LegacyUser } from '@/lib/definitions';
import { connectToDatabase } from '@/lib/mongodb';
import { unstable_noStore as noStore } from 'next/cache';
import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';
import { sendPushNotification } from '@/lib/push-notifications';

const PAGE_SIZE = 10;

async function expireOldLocks() {
    try {
        const db = await connectToDatabase();
        const now = new Date();
        const result = await db.collection<PaymentLock>('payment_locks').updateMany(
            { status: 'active', expiresAt: { $lt: now } },
            { $set: { status: 'expired' } }
        );
        if (result.modifiedCount > 0) {
            console.log(`Expired ${result.modifiedCount} old payment locks during admin check.`);
            revalidatePath('/admin/payment-sessions');
        }
    } catch (error) {
        console.error("Error expiring old payment locks from admin action:", error);
    }
}

export async function getPaymentSessions(page: number, search: string) {
    noStore();
    const isAdmin = await isAdminAuthenticated();
    if (!isAdmin) {
        return { sessions: [], hasMore: false, total: 0 };
    }

    // Run cleanup before fetching
    await expireOldLocks();

    try {
        const db = await connectToDatabase();
        const skip = (page - 1) * PAGE_SIZE;

        let query: any = {};
        if (search) {
            query.$or = [
                { gamingId: { $regex: search, $options: 'i' } },
                { productName: { $regex: search, $options: 'i' } }
            ]
        }
        
        const sessionsFromDb = await db.collection<PaymentLock>('payment_locks')
            .find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(PAGE_SIZE)
            .toArray();

        const total = await db.collection('payment_locks').countDocuments(query);
        const hasMore = skip + sessionsFromDb.length < total;

        const sessions = JSON.parse(JSON.stringify(sessionsFromDb));

        return { sessions, hasMore, total };

    } catch (error) {
        console.error("Error fetching payment sessions:", error);
        return { sessions: [], hasMore: false, total: 0 };
    }
}


export async function forceExpireLock(lockId: string): Promise<{ success: boolean; message: string }> {
  const isAdmin = await isAdminAuthenticated();
  if (!isAdmin) {
    return { success: false, message: 'Unauthorized' };
  }

  try {
    const db = await connectToDatabase();
    const result = await db.collection<PaymentLock>('payment_locks').updateOne(
      { _id: new ObjectId(lockId), status: 'active' },
      { $set: { status: 'expired' } }
    );
    if (result.modifiedCount === 0) {
      return { success: false, message: 'Session not found or already inactive.' };
    }
    revalidatePath('/admin/payment-sessions');
    return { success: true, message: 'Session has been manually expired.' };
  } catch (error) {
    console.error('Error force expiring lock:', error);
    return { success: false, message: 'An internal error occurred.' };
  }
}

export async function approvePaymentManually(lockId: string): Promise<{ success: boolean; message: string }> {
    noStore();
    const isAdmin = await isAdminAuthenticated();
    if (!isAdmin) {
        return { success: false, message: "Unauthorized" };
    }

    const db = await connectToDatabase();
    const lock = await db.collection<PaymentLock>('payment_locks').findOne({ _id: new ObjectId(lockId) });

    if (!lock) {
        return { success: false, message: "Payment session not found." };
    }
    if (lock.status === 'completed') {
        return { success: false, message: "This payment has already been completed." };
    }

    const session = db.client.startSession();

    try {
        let createdOrder: Order | null = null;
        await session.withTransaction(async () => {
            const user = await db.collection<User>('users').findOne({ gamingId: lock.gamingId }, { session });
            const product = await db.collection<Product>('products').findOne({ _id: new ObjectId(lock.productId) });

            if (!user || !product) throw new Error('User or Product not found for the payment lock.');

            const coinsUsed = product.isCoinProduct ? 0 : Math.min(user.coins, product.coinsApplicable || 0);
            const orderStatus: Order['status'] = product.isCoinProduct ? 'Completed' : 'Processing';

            const newOrder: Omit<Order, '_id'> = {
                userId: user._id.toString(),
                gamingId: user.gamingId,
                productId: lock.productId,
                productName: lock.productName,
                productPrice: product.price,
                productImageUrl: product.imageUrl,
                paymentMethod: 'UPI-Auto',
                status: orderStatus,
                coinsUsed,
                finalPrice: lock.amount,
                referralCode: user.referredByCode,
                isCoinProduct: !!product.isCoinProduct,
                createdAt: new Date(),
                coinsAtTimeOfPurchase: user.coins,
            };

            const orderResult = await db.collection<Order>('orders').insertOne(newOrder as Order, { session });
            createdOrder = { ...newOrder, _id: orderResult.insertedId };
            
            if (product.isCoinProduct) {
                await db.collection<User>('users').updateOne({ _id: user._id }, { $inc: { coins: product.quantity } }, { session });
                if (newOrder.referralCode) {
                    const rewardAmount = newOrder.finalPrice * 0.50;
                    await db.collection<LegacyUser>('legacy_users').updateOne({ referralCode: newOrder.referralCode }, { $inc: { walletBalance: rewardAmount } }, { session });
                }
            } else if (coinsUsed > 0) {
                await db.collection<User>('users').updateOne({ _id: user._id }, { $inc: { coins: -coinsUsed } }, { session });
            }

            await db.collection<PaymentLock>('payment_locks').updateOne({ _id: lock._id }, { $set: { status: 'completed' } }, { session });

            const notificationMessage = `Your payment of ₹${lock.amount} for "${lock.productName}" has been successfully received. Order is ${orderStatus}.`;
            const newNotification: Omit<Notification, '_id'> = {
                gamingId: user.gamingId, message: notificationMessage, isRead: false, createdAt: new Date(), imageUrl: product.imageUrl,
            };
            await db.collection<Notification>('notifications').insertOne(newNotification as Notification, { session });
        });
        
        await session.endSession();

        const userForPush = await db.collection<User>('users').findOne({ gamingId: lock.gamingId });
        if (userForPush?.fcmToken && createdOrder) {
            await sendPushNotification({
                token: userForPush.fcmToken,
                title: 'Garena Store: Payment Verified',
                body: `Your payment for "${createdOrder.productName}" has been manually approved by our team.`,
                imageUrl: createdOrder.productImageUrl,
            });
        }
        
        revalidatePath('/admin/payment-sessions');
        return { success: true, message: 'Payment approved and order created successfully.' };

    } catch (error: any) {
        await session.endSession();
        console.error('Manual Payment Approval Error:', error);
        return { success: false, message: error.message || "Failed to approve payment." };
    }
}

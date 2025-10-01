

import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { connectToDatabase } from '@/lib/mongodb';
import { type Product, type User, type Order, type LegacyUser, type Notification } from '@/lib/definitions';
import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';
import { sendPushNotification } from '@/lib/push-notifications';
import { setSmartVisualId } from '@/lib/auto-visual-id';

const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;

export async function POST(req: NextRequest) {
  if (!WEBHOOK_SECRET) {
    console.error('RAZORPAY_WEBHOOK_SECRET is not set.');
    return NextResponse.json({ success: false, message: 'Webhook secret not configured.' }, { status: 500 });
  }

  const body = await req.text();
  const signature = req.headers.get('x-razorpay-signature');

  if (!signature) {
    return NextResponse.json({ success: false, message: 'Signature missing.' }, { status: 400 });
  }

  // 1. Verify the webhook signature
  try {
      const hmac = createHmac('sha256', WEBHOOK_SECRET);
      hmac.update(body);
      const generatedSignature = hmac.digest('hex');

      if (generatedSignature !== signature) {
          console.error('Invalid Razorpay webhook signature.');
          return NextResponse.json({ success: false, message: 'Invalid signature.' }, { status: 400 });
      }
  } catch (error) {
      console.error('Error during webhook signature verification:', error);
      return NextResponse.json({ success: false, message: 'Signature verification failed.' }, { status: 500 });
  }

  const payload = JSON.parse(body);

  // 2. Handle the payment.captured event
  if (payload.event === 'payment.captured') {
    const paymentEntity = payload.payload.payment.entity;

    const { id: razorpayPaymentId, notes } = paymentEntity;
    const { gamingId, productId, transactionId } = notes;

    if (!productId || !gamingId || !transactionId) {
      console.error('Webhook payload missing productId, gamingId, or transactionId in notes');
      return NextResponse.json({ success: false, message: 'Missing required notes.' }, { status: 400 });
    }
    
    const db = await connectToDatabase();
    
    // 3. Check if order already exists to prevent duplicates
    const existingOrder = await db.collection<Order>('orders').findOne({ utr: razorpayPaymentId });
    if (existingOrder) {
        return NextResponse.json({ success: true, message: 'Order already processed.' });
    }

    const product = await db.collection<Product>('products').findOne({ _id: new ObjectId(productId) });
    const user = await db.collection<User>('users').findOne({ gamingId });

    if (!product || !user) {
        console.error(`Product or user not found for productId: ${productId}, gamingId: ${gamingId}`);
        return NextResponse.json({ success: false, message: 'Product or user not found.' }, { status: 404 });
    }

    const coinsUsed = product.isCoinProduct ? 0 : Math.min(user.coins, product.coinsApplicable || 0);
    const finalPrice = product.isCoinProduct ? product.purchasePrice || product.price : product.price - coinsUsed;
    const orderStatus = product.isCoinProduct ? 'Completed' : 'Processing';

    const newOrder: Omit<Order, '_id'> = {
        userId: user._id.toString(),
        gamingId,
        productId: product._id.toString(),
        productName: product.name,
        productPrice: product.price,
        productImageUrl: product.imageUrl,
        paymentMethod: 'UPI',
        status: orderStatus,
        utr: razorpayPaymentId, // Storing payment ID
        transactionId: transactionId, // Store the unique transaction ID
        referralCode: user.referredByCode,
        coinsUsed,
        finalPrice,
        isCoinProduct: product.isCoinProduct,
        createdAt: new Date(),
        coinsAtTimeOfPurchase: user.coins,
    };
    
    try {
        const session = db.client.startSession();
        await session.withTransaction(async () => {
            await db.collection<Order>('orders').insertOne(newOrder as Order, { session });

            if (product.isCoinProduct) {
                await db.collection<User>('users').updateOne(
                    { _id: user._id },
                    { $inc: { coins: product.quantity } },
                    { session }
                );
            } else if (coinsUsed > 0) {
                await db.collection<User>('users').updateOne(
                    { _id: user._id },
                    { $inc: { coins: -coinsUsed } },
                    { session }
                );
            }
            
            if (orderStatus === 'Completed' && user.referredByCode) {
                 const rewardAmount = finalPrice * 0.50;
                 await db.collection<LegacyUser>('legacy_users').updateOne(
                    { referralCode: user.referredByCode },
                    { $inc: { walletBalance: rewardAmount } },
                    { session }
                );
            }

            // Create in-app notification based on product type
            let notificationMessage: string;
            if (product.isCoinProduct) {
                 notificationMessage = `Your purchase of ${product.name} for ₹${finalPrice} was successful! The coins have been added to your account.`;
            } else {
                 notificationMessage = `Your payment of ₹${finalPrice} for "${product.name}" has been successfully received. Currently, it's under processing.`;
            }

            const newNotification: Omit<Notification, '_id'> = {
                gamingId: gamingId,
                message: notificationMessage,
                isRead: false,
                createdAt: new Date(),
                imageUrl: product.imageUrl,
            };
            await db.collection<Notification>('notifications').insertOne(newNotification as Notification, { session });
        });
        await session.endSession();
        
        // This is a background task, so we don't await it.
        // It will run after the main function has returned.
        if (!product.isCoinProduct) {
            setSmartVisualId(user);
        }

        // Send push notification outside the transaction
        if (user.fcmToken) {
            let pushTitle: string;
            let pushBody: string;

            if (product.isCoinProduct) {
                pushTitle = 'Garena Store: Purchase Successful!';
                pushBody = `Your purchase of ${product.name} for ₹${finalPrice} was successful!`;
            } else {
                pushTitle = 'Garena Store: Payment Received';
                pushBody = `Your payment of ₹${finalPrice} for "${product.name}" has been confirmed. Currently, it's under processing.`;
            }
            
            await sendPushNotification({
                token: user.fcmToken,
                title: pushTitle,
                body: pushBody,
                imageUrl: product.imageUrl,
            });
        }
        
        // Revalidate paths to update frontend caches
        revalidatePath('/');
        revalidatePath('/order');
        revalidatePath('/admin');

    } catch (error) {
        console.error('Error processing webhook and creating order:', error);
        return NextResponse.json({ success: false, message: 'Database transaction failed.' }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true, message: 'Webhook received.' });
}


'use server';

import { isAdminAuthenticated } from '@/app/actions';
import { PaymentLock } from '@/lib/definitions';
import { connectToDatabase } from '@/lib/mongodb';
import { unstable_noStore as noStore } from 'next/cache';
import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';

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

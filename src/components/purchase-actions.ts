

'use server';

import { connectToDatabase } from '@/lib/mongodb';
import { PaymentLock } from '@/lib/definitions';
import { ObjectId } from 'mongodb';

const LOCK_TTL_MS = 90 * 1000; // 90 seconds

/**
 * Finds and expires any payment locks that are past their expiration time.
 * This is a cleanup function to prevent stale locks.
 */
export async function expireOldPaymentLocks(): Promise<void> {
    try {
        const db = await connectToDatabase();
        const now = new Date();
        await db.collection<PaymentLock>('payment_locks').updateMany(
            { status: 'active', expiresAt: { $lt: now } },
            { $set: { status: 'expired' } }
        );
    } catch (error) {
        console.error("Error expiring old payment locks:", error);
        // Do not throw, as this is a background cleanup task.
    }
}


/**
 * Finds the next available price for a UPI payment by checking for active and recently expired payment locks.
 * If the base amount is locked, it increments by 0.01 until an unlocked amount is found.
 * @param baseAmount The original price of the item.
 * @returns An object with the final available price and the convenience fee added.
 */
export async function findAvailableUpiPrice(baseAmount: number): Promise<{ finalPrice: number; fee: number }> {
    // First, run the cleanup task to expire any old locks.
    await expireOldPaymentLocks();

    const db = await connectToDatabase();
    let finalPrice = parseFloat(baseAmount.toFixed(2));
    let fee = 0;
    let attempts = 0; // To prevent infinite loops in a highly concurrent scenario
    const MAX_ATTEMPTS = 100; // Stop after trying 100 increments (i.e., +₹1.00)

    const thirtySecondsAgo = new Date(Date.now() - 30 * 1000);

    while (attempts < MAX_ATTEMPTS) {
        // Check for either an active lock OR a lock that expired in the last 30 seconds.
        const existingLock = await db.collection<PaymentLock>('payment_locks').findOne({
            amount: finalPrice,
            $or: [
                { status: 'active' },
                { 
                    status: 'expired',
                    // A lock is considered "recently expired" if its expiration timestamp is within the last 30 seconds.
                    // This creates a cool-down period.
                    expiresAt: { $gte: thirtySecondsAgo } 
                }
            ]
        });

        if (!existingLock) {
            // This price is available
            return { finalPrice, fee };
        }

        // Price is locked, increment and try again
        finalPrice = parseFloat((finalPrice + 0.01).toFixed(2));
        fee = parseFloat((fee + 0.01).toFixed(2));
        attempts++;
    }
    
    // If we reach here, it means we couldn't find a free slot after 100 tries.
    // This is highly unlikely, but as a fallback, we return the original price,
    // which will then show the "payment busy" message to the user.
    return { finalPrice: baseAmount, fee: 0 };
}


/**
 * Creates a payment lock for a user and a specific amount.
 * Returns an error if a lock for the same amount already exists.
 */
export async function createPaymentLock(gamingId: string, productId: string, productName: string, amount: number): Promise<{ success: boolean; lockId?: string; message?: string }> {
  try {
    const db = await connectToDatabase();

    // Check for an existing active lock for the same amount
    const existingLock = await db.collection<PaymentLock>('payment_locks').findOne({ amount, status: 'active' });
    if (existingLock) {
      return { success: false, message: 'Another payment for the same amount is in progress. Please wait.' };
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + LOCK_TTL_MS);

    const newLock: Omit<PaymentLock, '_id'> = {
      gamingId,
      productId,
      productName,
      amount,
      status: 'active',
      createdAt: now,
      expiresAt,
    };

    const result = await db.collection('payment_locks').insertOne(newLock as PaymentLock);
    return { success: true, lockId: result.insertedId.toString() };

  } catch (error) {
    console.error('Error creating payment lock:', error);
    return { success: false, message: 'An internal error occurred.' };
  }
}

/**
 * Releases a payment lock, marking it as 'expired'.
 * This is called when the user closes the modal or the timer runs out.
 */
export async function releasePaymentLock(lockId: string): Promise<{ success: boolean }> {
  try {
    const db = await connectToDatabase();
    await db.collection<PaymentLock>('payment_locks').updateOne(
      { _id: new ObjectId(lockId), status: 'active' }, // Only expire active locks
      { $set: { status: 'expired', expiresAt: new Date() } } // Update expiresAt to now
    );
    return { success: true };
  } catch (error) {
    console.error('Error releasing payment lock:', error);
    return { success: false };
  }
}

/**
 * Checks if the payment associated with a lock has been completed.
 */
export async function checkPaymentStatus(lockId: string): Promise<{ isCompleted: boolean }> {
    if (!lockId) return { isCompleted: false };
    try {
        const db = await connectToDatabase();
        const lock = await db.collection<PaymentLock>('payment_locks').findOne({ _id: new ObjectId(lockId) });
        return { isCompleted: lock?.status === 'completed' };
    } catch (error) {
        console.error('Error checking payment status:', error);
        return { isCompleted: false };
    }
}

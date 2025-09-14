
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { type Order } from '@/lib/definitions';
import { unstable_noStore as noStore } from 'next/cache';

export async function GET(req: NextRequest) {
  noStore();
  const { searchParams } = new URL(req.url);
  const gamingId = searchParams.get('gamingId');

  if (!gamingId) {
    return NextResponse.json({ success: false, message: 'Gaming ID is required.' }, { status: 400 });
  }

  try {
    const db = await connectToDatabase();
    
    // Check for a recent, successful order for this user
    // We look for an order created in the last 60 seconds.
    const sixtySecondsAgo = new Date(Date.now() - 60000);
    
    const recentOrder = await db.collection<Order>('orders').findOne({
      gamingId,
      createdAt: { $gte: sixtySecondsAgo },
      status: { $in: ['Completed', 'Processing'] }
    });

    if (recentOrder) {
      return NextResponse.json({ success: true, orderFound: true });
    } else {
      return NextResponse.json({ success: true, orderFound: false });
    }
  } catch (error) {
    console.error('Error checking order status:', error);
    return NextResponse.json({ success: false, message: 'An internal server error occurred.' }, { status: 500 });
  }
}

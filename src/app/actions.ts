'use server';

import { customerFAQChatbot, type CustomerFAQChatbotInput } from '@/ai/flows/customer-faq-chatbot';
import { connectToDatabase } from '@/lib/mongodb';
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { type User, type Order, type Product, type Withdrawal, type LegacyUser } from '@/lib/definitions';
import { randomBytes } from 'crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { unstable_noStore as noStore } from 'next/cache';
import { sendRedeemCodeNotification } from '@/lib/email';
import { ObjectId } from 'mongodb';


const key = new TextEncoder().encode(process.env.SESSION_SECRET || 'your-fallback-secret-for-session');


export async function askQuestion(
  input: CustomerFAQChatbotInput
): Promise<{ success: boolean; answer?: string; error?: string }> {
  try {
    const result = await customerFAQChatbot(input);
    return { success: true, answer: result.answer };
  } catch (error) {
    console.error('Error in askQuestion action:', error);
    return { success: false, error: 'Sorry, I am unable to answer at the moment. Please try again later.' };
  }
}

type FormState = {
  success: boolean;
  message: string;
};

// --- Authentication Actions ---

const accountSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters long'),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
});


async function createSession(username: string) {
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  const session = await new SignJWT({ username })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expires)
    .sign(key);

  cookies().set('session', session, { expires, httpOnly: true });
}

export async function getSession() {
  const sessionCookie = cookies().get('session')?.value;
  if (!sessionCookie) return null;

  try {
    const { payload } = await jwtVerify(sessionCookie, key, {
      algorithms: ['HS256'],
    });
    return payload as { username: string; iat: number; exp: number };
  } catch (error) {
    return null;
  }
}

export async function logout() {
  cookies().set('session', '', { expires: new Date(0) });
  redirect('/account');
}

export async function createAccount(prevState: FormState, formData: FormData): Promise<FormState> {
  const validatedFields = accountSchema.safeParse(Object.fromEntries(formData.entries()));
  const referralCode = cookies().get('referral_code')?.value;

  if (!validatedFields.success) {
    return { success: false, message: 'Invalid form data.' };
  }

  const { username, password } = validatedFields.data;

  try {
    const db = await connectToDatabase();
    const existingUser = await db.collection<LegacyUser>('legacy_users').findOne({ username });

    if (existingUser) {
      return { success: false, message: 'Username already exists.' };
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser: Omit<LegacyUser, '_id'> = { username, password: hashedPassword, walletBalance: 0, createdAt: new Date() };

    if (referralCode) {
        const referringUser = await db.collection<LegacyUser>('legacy_users').findOne({ referralCode });
        if (referringUser) {
            newUser.referredBy = referringUser.username;
        }
        cookies().delete('referral_code');
    }

    await db.collection<LegacyUser>('legacy_users').insertOne(newUser as LegacyUser);

    await createSession(username);
    revalidatePath('/account');
    return { success: true, message: 'Account created successfully!' };
  } catch (error) {
    console.error(error);
    return { success: false, message: 'An unexpected error occurred.' };
  }
}

export async function login(prevState: FormState, formData: FormData): Promise<FormState> {
  const validatedFields = accountSchema.safeParse(Object.fromEntries(formData.entries()));

  if (!validatedFields.success) {
    return { success: false, message: 'Invalid form data.' };
  }

  const { username, password } = validatedFields.data;

  try {
    const db = await connectToDatabase();
    const user = await db.collection<LegacyUser>('legacy_users').findOne({ username });

    if (!user) {
      return { success: false, message: 'Incorrect username or password.' };
    }

    const passwordsMatch = await bcrypt.compare(password, user.password);

    if (!passwordsMatch) {
      return { success: false, message: 'Incorrect username or password.' };
    }

    await createSession(username);
    revalidatePath('/account');
    return { success: true, message: 'Logged in successfully!' };
  } catch (error) {
    console.error(error);
    return { success: false, message: 'An unexpected error occurred.' };
  }
}

const passwordChangeSchema = z.object({
  oldPassword: z.string().min(1, "Old password is required"),
  newPassword: z.string().min(6, 'New password must be at least 6 characters long'),
});

export async function changePassword(prevState: FormState, formData: FormData): Promise<FormState> {
    const session = await getSession();
    if (!session?.username) {
        return { success: false, message: 'You must be logged in to change your password.' };
    }

    const validatedFields = passwordChangeSchema.safeParse(Object.fromEntries(formData.entries()));

    if (!validatedFields.success) {
        return { success: false, message: 'Invalid form data.' };
    }
    
    const { oldPassword, newPassword } = validatedFields.data;

    try {
        const db = await connectToDatabase();
        const user = await db.collection<LegacyUser>('legacy_users').findOne({ username: session.username });

        if (!user) {
            return { success: false, message: 'User not found.' };
        }

        const passwordsMatch = await bcrypt.compare(oldPassword, user.password);
        if (!passwordsMatch) {
            return { success: false, message: 'Incorrect old password.' };
        }

        const hashedNewPassword = await bcrypt.hash(newPassword, 10);
        await db.collection<LegacyUser>('legacy_users').updateOne({ username: session.username }, { $set: { password: hashedNewPassword } });
        
        return { success: true, message: 'Password changed successfully!' };
    } catch (error) {
        console.error(error);
        return { success: false, message: 'An unexpected error occurred.' };
    }
}

const usernameChangeSchema = z.object({
    newUsername: z.string().min(3, "New username must be at least 3 characters long"),
    password: z.string().min(1, "Password is required"),
});

export async function changeUsername(prevState: FormState, formData: FormData): Promise<FormState> {
    const session = await getSession();
    if (!session?.username) {
        return { success: false, message: 'You must be logged in to change your username.' };
    }

    const validatedFields = usernameChangeSchema.safeParse(Object.fromEntries(formData.entries()));

    if (!validatedFields.success) {
        return { success: false, message: 'Invalid form data.' };
    }

    const { newUsername, password } = validatedFields.data;

    try {
        const db = await connectToDatabase();

        const existingNewUser = await db.collection<LegacyUser>('legacy_users').findOne({ username: newUsername });
        if (existingNewUser) {
            return { success: false, message: 'New username is already taken.' };
        }
        
        const currentUser = await db.collection<LegacyUser>('legacy_users').findOne({ username: session.username });

        if (!currentUser) {
            return { success: false, message: 'Current user not found.' };
        }

        const passwordsMatch = await bcrypt.compare(password, currentUser.password);
        if (!passwordsMatch) {
            return { success: false, message: 'Incorrect password.' };
        }

        await db.collection<LegacyUser>('legacy_users').updateOne({ username: session.username }, { $set: { username: newUsername } });
        
        await createSession(newUsername);
        revalidatePath('/account');
        return { success: true, message: 'Username changed successfully!' };
    } catch (error) {
        console.error(error);
        return { success: false, message: 'An unexpected error occurred.' };
    }
}

// --- Referral Actions ---

export async function generateReferralLink(): Promise<{ success: boolean; link?: string; message: string }> {
    const session = await getSession();
    if (!session?.username) {
        return { success: false, message: 'You must be logged in.' };
    }

    try {
        const db = await connectToDatabase();
        const user = await db.collection<LegacyUser>('legacy_users').findOne({ username: session.username });

        if (!user) {
            return { success: false, message: 'User not found.' };
        }
        
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:9002';

        if (user.referralCode) {
            const link = `${baseUrl}/?ref=${user.referralCode}`;
            return { success: true, link, message: 'Your existing referral link.' };
        }

        const referralCode = randomBytes(4).toString('hex');
        await db.collection<LegacyUser>('legacy_users').updateOne(
            { username: session.username },
            { $set: { referralCode } }
        );

        const link = `${baseUrl}/?ref=${referralCode}`;
        revalidatePath('/account');
        return { success: true, link, message: 'Referral link generated successfully!' };

    } catch (error) {
        console.error(error);
        return { success: false, message: 'An unexpected error occurred.' };
    }
}


// --- User Actions ---
export async function registerGamingId(gamingId: string): Promise<{ success: boolean; message: string; user?: User }> {
  noStore();
  if (!gamingId || gamingId.trim().length < 3) {
    return { success: false, message: 'Invalid Gaming ID provided.' };
  }

  try {
    const db = await connectToDatabase();
    let user = await db.collection<User>('users').findOne({ gamingId });

    if (user) {
      cookies().set('gaming_id', gamingId, { maxAge: 365 * 24 * 60 * 60, httpOnly: true });
      return { success: true, message: 'Welcome back!', user: JSON.parse(JSON.stringify(user)) };
    }

    const referralCode = cookies().get('referral_code')?.value;

    const newUser: Omit<User, '_id'> = {
      gamingId,
      coins: 800,
      createdAt: new Date(),
      referredByCode: referralCode, // Store the referral code
    };

    const result = await db.collection<User>('users').insertOne(newUser as User);
    
    cookies().set('gaming_id', gamingId, { maxAge: 365 * 24 * 60 * 60, httpOnly: true });
    
    const createdUser = { ...newUser, _id: result.insertedId };
    
    if (referralCode) {
        cookies().delete('referral_code');
    }

    revalidatePath('/');
    const plainUser = JSON.parse(JSON.stringify(createdUser));
    return { success: true, message: 'Registration successful! You have been awarded 800 coins.', user: plainUser };
  } catch (error) {
    console.error('Error registering Gaming ID:', error);
    return { success: false, message: 'An error occurred during registration.' };
  }
}

export async function getUserData(): Promise<User | null> {
    const gamingId = cookies().get('gaming_id')?.value;
    if (!gamingId) {
        return null;
    }
    try {
        const db = await connectToDatabase();
        const user = await db.collection<User>('users').findOne({ gamingId });
        if (!user) {
            cookies().delete('gaming_id');
            return null;
        }
        return JSON.parse(JSON.stringify(user));
    } catch (error) {
        console.error('Failed to fetch user data:', error);
        return null;
    }
}

export async function rewardAdCoins(): Promise<{ success: boolean; message: string }> {
    const gamingId = cookies().get('gaming_id')?.value;
    if (!gamingId) {
        return { success: false, message: 'User not logged in.' };
    }
    try {
        const db = await connectToDatabase();
        const result = await db.collection('users').updateOne(
            { gamingId },
            { $inc: { coins: 5 } }
        );

        if (result.modifiedCount === 0) {
            return { success: false, message: 'Could not find user to reward.' };
        }
        revalidatePath('/');
        return { success: true, message: 'You earned 5 coins!' };
    } catch (error) {
        console.error('Error rewarding ad coins:', error);
        return { success: false, message: 'An error occurred.' };
    }
}

export async function transferCoins(
  recipientGamingId: string,
  amount: number
): Promise<{ success: boolean; message: string }> {
  const senderGamingId = cookies().get('gaming_id')?.value;
  if (!senderGamingId) {
    return { success: false, message: 'You must be logged in to transfer coins.' };
  }
  if (!recipientGamingId || amount <= 0) {
    return { success: false, message: 'Invalid recipient ID or amount.' };
  }
  if (senderGamingId === recipientGamingId) {
    return { success: false, message: 'You cannot transfer coins to yourself.' };
  }

  const db = await connectToDatabase();
  const session = db.s.client.startSession();

  try {
    let resultMessage = '';
    await session.withTransaction(async () => {
      const sender = await db.collection<User>('users').findOne({ gamingId: senderGamingId }, { session });
      if (!sender || sender.coins < amount) {
        throw new Error('Insufficient coins or sender not found.');
      }

      const recipient = await db.collection<User>('users').findOne({ gamingId: recipientGamingId }, { session });
      if (!recipient) {
        throw new Error('Recipient not found.');
      }

      await db.collection('users').updateOne({ gamingId: senderGamingId }, { $inc: { coins: -amount } }, { session });
      await db.collection('users').updateOne({ gamingId: recipientGamingId }, { $inc: { coins: amount } }, { session });
      
      resultMessage = `Successfully transferred ${amount} coins to ${recipientGamingId}.`;
    });
    
    revalidatePath('/');
    return { success: true, message: resultMessage };

  } catch (error: any) {
    return { success: false, message: error.message || 'Coin transfer failed.' };
  } finally {
    await session.endSession();
  }
}

// --- Order Actions ---

export async function getOrdersForUser(): Promise<Order[]> {
    noStore();
    const gamingId = cookies().get('gaming_id')?.value;
    if (!gamingId) {
        return [];
    }

    try {
        const db = await connectToDatabase();
        const ordersFromDb = await db.collection<Order>('orders')
            .find({ gamingId })
            .sort({ createdAt: -1 })
            .toArray();

        // Convert ObjectId to string for client-side usage
        return ordersFromDb.map((order: Order) => ({
            ...order,
            _id: order._id.toString(),
            createdAt: order.createdAt.toString(),
        })) as unknown as Order[];
    } catch (error) {
        console.error("Failed to fetch user orders:", error);
        return [];
    }
}

const redeemCodeSchema = z.object({
  gamingId: z.string().min(1, 'Gaming ID is required'),
  productId: z.string(),
  redeemCode: z.string().min(1, 'Redeem code is required'),
});

export async function createRedeemCodeOrder(
  product: Product,
  gamingId: string,
  redeemCode: string,
  user: User
): Promise<{ success: boolean; message: string }> {
    const validatedData = redeemCodeSchema.safeParse({ gamingId, productId: product._id, redeemCode });
    if (!validatedData.success) {
        return { success: false, message: 'Invalid data provided.' };
    }
    
    const db = await connectToDatabase();
    
    const coinsUsed = Math.min(user.coins, product.coinsApplicable);
    const finalPrice = product.price - coinsUsed;

    const newOrder: Omit<Order, '_id'> = {
        userId: user._id.toString(),
        gamingId: validatedData.data.gamingId,
        productId: product._id,
        productName: product.name,
        productPrice: product.price,
        productImageUrl: product.imageUrl,
        paymentMethod: 'Redeem Code',
        status: 'Processing',
        redeemCode: validatedData.data.redeemCode,
        referralCode: user.referredByCode, // Save the referrer's code
        coinsUsed,
        finalPrice,
        createdAt: new Date(),
    };

    try {
        await db.collection<Order>('orders').insertOne(newOrder as Order);

        if (coinsUsed > 0) {
            await db.collection('users').updateOne({ _id: new ObjectId(user._id) }, { $inc: { coins: -coinsUsed } });
        }

        await sendRedeemCodeNotification({
          gamingId: newOrder.gamingId,
          productName: newOrder.productName,
          redeemCode: newOrder.redeemCode!
        });

        revalidatePath('/');
        revalidatePath('/order');
        return { success: true, message: 'Order is processing.' };
    } catch (error) {
        console.error('Error creating redeem code order:', error);
        return { success: false, message: 'Failed to create order.' };
    }
}

const submitUtrSchema = z.object({
    gamingId: z.string().min(1, 'Gaming ID is required'),
    productId: z.string(),
    utr: z.string().min(6, 'UTR must be at least 6 characters'),
});

export async function submitUtr(product: Product, gamingId: string, utr: string, user: User): Promise<{ success: boolean; message: string }> {
    const validatedData = submitUtrSchema.safeParse({ gamingId, productId: product._id, utr });
    if (!validatedData.success) {
        return { success: false, message: 'Invalid UTR data.' };
    }

    const db = await connectToDatabase();
    
    const coinsUsed = Math.min(user.coins, product.coinsApplicable);
    const finalPrice = product.price - coinsUsed;

    const newOrder: Omit<Order, '_id'> = {
        userId: user._id.toString(),
        gamingId: validatedData.data.gamingId,
        productId: product._id,
        productName: product.name,
        productPrice: product.price,
        productImageUrl: product.imageUrl,
        paymentMethod: 'UPI',
        status: 'Processing',
        utr: validatedData.data.utr,
        referralCode: user.referredByCode, // Save the referrer's code
        coinsUsed,
        finalPrice,
        createdAt: new Date(),
    };

    try {
        await db.collection<Order>('orders').insertOne(newOrder as Order);
        
        if (coinsUsed > 0) {
            await db.collection('users').updateOne({ _id: new ObjectId(user._id) }, { $inc: { coins: -coinsUsed } });
        }

        revalidatePath('/');
        revalidatePath('/order');
        return { success: true, message: 'UTR submitted successfully. Your order is now processing.' };
    } catch (error) {
        console.error('Error submitting UTR:', error);
        return { success: false, message: 'Failed to submit UTR.' };
    }
}


// --- Admin Actions ---
type AdminFormState = {
  message: string;
  success: boolean;
};

export async function verifyAdminPassword(prevState: FormState, formData: FormData): Promise<FormState> {
  noStore();
  const password = formData.get('password') as string;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    console.error('ADMIN_PASSWORD environment variable not set.');
    return { message: 'Admin password not configured.', success: false };
  }
  
  const isValid = password === adminPassword;

  if (isValid) {
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    cookies().set('admin_session', 'true', { expires, httpOnly: true, sameSite: 'strict', path: '/' });
    revalidatePath('/admin', 'layout');
    redirect('/admin');
  } else {
    return { message: 'Incorrect password.', success: false };
  }
}

export async function isAdminAuthenticated(): Promise<boolean> {
  noStore();
  const session = cookies().get('admin_session')?.value;
  return session === 'true';
}

export async function logoutAdmin() {
    cookies().set('admin_session', '', { expires: new Date(0) });
    redirect('/admin/login');
}

export async function updateOrderStatus(orderId: string, status: 'Completed' | 'Failed'): Promise<{success: boolean}> {
    const isAdmin = await isAdminAuthenticated();
    if (!isAdmin) {
        return { success: false };
    }

    const db = await connectToDatabase();
    
    const order = await db.collection<Order>('orders').findOne({ _id: new ObjectId(orderId) });
    if (!order) {
        return { success: false };
    }

    await db.collection('orders').updateOne({ _id: new ObjectId(orderId) }, { $set: { status } });
    
    // If order is completed and was referred, reward the referrer
    if (status === 'Completed' && order.referralCode) {
        const rewardAmount = order.finalPrice * 0.50;
        await db.collection<LegacyUser>('legacy_users').updateOne(
            { referralCode: order.referralCode },
            { $inc: { walletBalance: rewardAmount } }
        );
    }


    revalidatePath('/admin');
    revalidatePath('/admin/success');
    revalidatePath('/admin/failed');
    return { success: true };
}

export async function deleteUser(userId: string): Promise<{success: boolean; message: string}> {
    const isAdmin = await isAdminAuthenticated();
    if (!isAdmin) {
        return { success: false, message: 'Unauthorized' };
    }
    const { ObjectId } = await import('mongodb');
    const db = await connectToDatabase();
    await db.collection('legacy_users').deleteOne({ _id: new ObjectId(userId) });
    revalidatePath('/admin/accounts');
    return { success: true, message: 'User deleted.' };
}

const PAGE_SIZE = 5;

export async function getOrdersForAdmin(
  page: number, 
  sort: string, 
  search: string, 
  status: ('Processing' | 'Completed' | 'Failed')[]
) {
  noStore();
  const db = await connectToDatabase();
  const skip = (page - 1) * PAGE_SIZE;

  let query: any = { status: { $in: status } };
  if (search) {
      query.$or = [
          { gamingId: { $regex: search, $options: 'i' } },
          { referralCode: { $regex: search, $options: 'i' } }
      ]
  }

  const ordersFromDb = await db.collection<Order>('orders')
      .find(query)
      .sort({ createdAt: sort === 'asc' ? 1 : -1 })
      .skip(skip)
      .limit(PAGE_SIZE)
      .toArray();

  const totalOrders = await db.collection('orders').countDocuments(query);
  const hasMore = skip + ordersFromDb.length < totalOrders;

  const orders = ordersFromDb.map((order: any) => ({
    ...order,
    _id: order._id.toString(),
    createdAt: order.createdAt.toISOString(),
  }));

  return { orders, hasMore };
}

export async function getLegacyUsersForAdmin(page: number, sort: string, search: string) {
  noStore();
  const db = await connectToDatabase();
  const skip = (page - 1) * PAGE_SIZE;

  let query: any = {};
  if (search) {
    query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { referralCode: { $regex: search, $options: 'i' } }
    ]
  }
  
  const usersFromDb = await db.collection<LegacyUser>('legacy_users')
    .find(query)
    .sort({ createdAt: sort === 'asc' ? 1 : -1 })
    .skip(skip)
    .limit(PAGE_SIZE)
    .toArray();

  const totalUsers = await db.collection('legacy_users').countDocuments(query);
  const hasMore = skip + usersFromDb.length < totalUsers;

  const users = usersFromDb.map((user: any) => ({
    ...user,
    _id: user._id.toString(),
    createdAt: user.createdAt.toISOString(),
  }));


  return { users, hasMore };
}


// --- Wallet & Withdrawal Actions ---

export async function getWalletData(): Promise<{ walletBalance: number; withdrawals: Withdrawal[] }> {
    noStore();
    const session = await getSession();
    if (!session?.username) {
        return { walletBalance: 0, withdrawals: [] };
    }

    const db = await connectToDatabase();
    const user = await db.collection<LegacyUser>('legacy_users').findOne({ username: session.username });
    if (!user) {
        return { walletBalance: 0, withdrawals: [] };
    }
    
    const withdrawalsFromDb = await db.collection<Withdrawal>('withdrawals').find({ userId: user._id.toString() }).sort({ createdAt: -1 }).toArray();

    const withdrawals = withdrawalsFromDb.map((w) => ({
        ...w,
        _id: w._id.toString(),
        createdAt: w.createdAt.toISOString(),
    })) as unknown as Withdrawal[];

    return { walletBalance: user.walletBalance || 0, withdrawals };
}

const upiSchema = z.object({
  amount: z.coerce.number().positive('Amount must be positive.'),
  method: z.literal('UPI'),
  upiId: z.string().min(5, 'Invalid UPI ID'),
});

const bankSchema = z.object({
  amount: z.coerce.number().positive('Amount must be positive.'),
  method: z.literal('Bank'),
  bankName: z.string().min(3, 'Bank name is required'),
  accountNumber: z.string().min(8, 'Invalid account number'),
  ifscCode: z.string().length(11, 'IFSC code must be 11 characters'),
});

export async function requestWithdrawal(formData: FormData): Promise<FormState> {
    const session = await getSession();
    if (!session?.username) {
        return { success: false, message: 'You must be logged in.' };
    }
    const db = await connectToDatabase();
    const user = await db.collection<LegacyUser>('legacy_users').findOne({ username: session.username });
    if (!user) {
        return { success: false, message: 'User not found.' };
    }

    const rawFormData = Object.fromEntries(formData.entries());
    const method = rawFormData.method as 'UPI' | 'Bank';
    
    const schema = method === 'UPI' ? upiSchema : bankSchema;
    const validatedFields = schema.safeParse(rawFormData);

    if (!validatedFields.success) {
        const errors = validatedFields.error.errors.map(e => e.message).join(', ');
        return { success: false, message: `Invalid form data: ${errors}` };
    }

    const { amount } = validatedFields.data;
    
    if (amount > (user.walletBalance || 0)) {
        return { success: false, message: 'Insufficient balance.' };
    }
    
    await db.collection<LegacyUser>('legacy_users').updateOne({ _id: user._id }, { $inc: { walletBalance: -amount } });

    const newWithdrawal: Omit<Withdrawal, '_id'> = {
        userId: user._id.toString(),
        username: user.username,
        referralCode: user.referralCode,
        amount,
        method,
        details: method === 'UPI' ? { upiId: validatedFields.data.upiId } : {
            bankName: validatedFields.data.bankName,
            accountNumber: validatedFields.data.accountNumber,
            ifscCode: validatedFields.data.ifscCode,
        },
        status: 'Pending',
        createdAt: new Date(),
    };

    await db.collection<Withdrawal>('withdrawals').insertOne(newWithdrawal as Withdrawal);
    
    revalidatePath('/account');
    revalidatePath('/admin/withdrawals');
    return { success: true, message: 'Withdrawal request submitted.' };
}

export async function getWithdrawalsForAdmin(page: number, sort: string, status: ('Pending' | 'Completed' | 'Failed')[]) {
    noStore();
    const db = await connectToDatabase();
    const skip = (page - 1) * PAGE_SIZE;

    const query: any = { status: { $in: status } };

    const withdrawalsFromDb = await db.collection<Withdrawal>('withdrawals')
        .find(query)
        .sort({ createdAt: sort === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(PAGE_SIZE)
        .toArray();
    
    const totalWithdrawals = await db.collection('withdrawals').countDocuments(query);
    const hasMore = skip + withdrawalsFromDb.length < totalWithdrawals;

    const withdrawals = withdrawalsFromDb.map((w: any) => ({
        ...w,
        _id: w._id.toString(),
        createdAt: w.createdAt.toISOString(),
    }));

    return { withdrawals, hasMore };
}

export async function updateWithdrawalStatus(withdrawalId: string, status: 'Completed' | 'Failed'): Promise<{ success: boolean; message?: string }> {
    const isAdmin = await isAdminAuthenticated();
    if (!isAdmin) {
        return { success: false };
    }
    const { ObjectId } = await import('mongodb');
    const db = await connectToDatabase();

    const result = await db.collection('withdrawals').updateOne(
        { _id: new ObjectId(withdrawalId) },
        { $set: { status } }
    );
    
    if (result.modifiedCount === 0) {
        return { success: false, message: 'Withdrawal request not found or status already updated.' };
    }

    revalidatePath('/admin/withdrawals');
    revalidatePath('/account');
    return { success: true };
}

// --- Product Management Actions ---
const productsToSeed = [
  { name: "100 Diamonds", price: 80, imageUrl: "/img/100.png", dataAiHint: 'diamond jewel', coinsApplicable: 50 },
  { name: "310 Diamonds", price: 240, imageUrl: "/img/310.png", dataAiHint: 'diamond jewel', coinsApplicable: 150 },
  { name: "520 Diamonds", price: 400, imageUrl: "/img/520.png", dataAiHint: 'diamond jewel', coinsApplicable: 200 },
  { name: "1060 Diamonds", price: 800, imageUrl: "/img/1060.png", dataAiHint: 'diamond jewel', coinsApplicable: 300 },
  { name: "2180 Diamonds", price: 1600, imageUrl: "/img/2180.png", dataAiHint: 'diamond jewel', coinsApplicable: 900 },
  { name: "5600 Diamonds", price: 4000, imageUrl: "/img/5600.png", dataAiHint: 'diamond jewel', coinsApplicable: 2000 },
  { name: "Weekly Membership", price: 159, imageUrl: "/img/weekly.png", dataAiHint: 'membership card', coinsApplicable: 59 },
  { name: "Monthly Membership", price: 800, imageUrl: "/img/monthly.png", dataAiHint: 'membership card', coinsApplicable: 300 },
  { name: "Itachi Uchiha Bundle", price: 5000, imageUrl: "/img/itachi.png", dataAiHint: 'anime character', coinsApplicable: 4000 },
  { name: "MP40 - Predatory Cobra", price: 5000, imageUrl: "/img/mp40.png", dataAiHint: 'cobra snake', coinsApplicable: 2000 },
  { name: "AK47 - Blue Flame Draco", price: 5000, imageUrl: "/img/ak47.png", dataAiHint: 'blue dragon', coinsApplicable: 2000 },
  { name: "LOL Emote", price: 3000, imageUrl: "/img/lol.png", dataAiHint: 'laughing face', coinsApplicable: 1000 },
  { 
    name: "MP40 - UCHIHA'S LEGACY", 
    price: 4000, 
    imageUrl: "/img/mp40u.png", 
    dataAiHint: 'anime weapon', 
    coinsApplicable: 2500,
    endDate: new Date('2024-08-14T00:00:00+05:30'), // Aug 14, 12 AM IST
  },
];

async function seedProducts() {
  const db = await connectToDatabase();
  const productCollection = db.collection<Product>('products');
  const count = await productCollection.countDocuments();

  const productsToInsert = productsToSeed.map(p => ({
    ...p,
    quantity: 1,
    isAvailable: true,
    isVanished: false,
  }));

  if (count === 0) {
    console.log('No products found, seeding database...');
    await productCollection.insertMany(productsToInsert as any[]);
    console.log(`Database seeded with ${productsToInsert.length} products.`);
  } else {
    console.log('Products found, ensuring data is up to date...');
    const bulkOps = productsToSeed.map(p => ({
      updateOne: {
        filter: { name: p.name },
        update: {
          $set: {
            price: p.price,
            imageUrl: p.imageUrl,
            coinsApplicable: p.coinsApplicable,
            endDate: p.endDate,
          },
          $setOnInsert: {
            name: p.name,
            quantity: 1,
            isAvailable: true,
            isVanished: false,
          }
        },
        upsert: true,
      },
    }));

    if (bulkOps.length > 0) {
      await productCollection.bulkWrite(bulkOps as any);
      console.log(`Upserted ${bulkOps.length} products to ensure data is correct.`);
    }
  }
}
  
seedProducts().catch(console.error);
  
export async function getProducts(): Promise<Product[]> {
    noStore();
    const db = await connectToDatabase();
    const productsFromDb = await db.collection<Product>('products')
      .find({ isVanished: false })
      .sort({ price: 1 })
      .toArray();

    return productsFromDb.map((p: any) => ({
        ...p,
        _id: p._id.toString(),
        coinsApplicable: p.coinsApplicable || 0,
    }));
}

const productUpdateSchema = z.object({
    name: z.string().min(3, 'Product name must be at least 3 characters.'),
    price: z.coerce.number().positive('Price must be a positive number.'),
    quantity: z.coerce.number().int().positive('Quantity must be a positive integer.'),
    isAvailable: z.enum(['on', 'off']).optional(),
    coinsApplicable: z.coerce.number().int().min(0, 'Applicable coins cannot be negative.'),
    endDate: z.string().optional(),
});

export async function updateProduct(productId: string, formData: FormData): Promise<{ success: boolean; message: string }> {
    const isAdmin = await isAdminAuthenticated();
    if (!isAdmin) {
        return { success: false, message: 'Unauthorized' };
    }

    const rawFormData = Object.fromEntries(formData.entries());
    const validatedFields = productUpdateSchema.safeParse(rawFormData);
    
    if (!validatedFields.success) {
        return { success: false, message: validatedFields.error.errors.map(e => e.message).join(', ') };
    }

    const { name, price, quantity, coinsApplicable } = validatedFields.data;
    const isAvailable = rawFormData.isAvailable === 'on';
    const endDate = validatedFields.data.endDate ? new Date(validatedFields.data.endDate) : undefined;


    const { ObjectId } = await import('mongodb');
    const db = await connectToDatabase();
    await db.collection<Product>('products').updateOne(
        { _id: new ObjectId(productId) as any },
        { $set: { name, price, quantity, isAvailable, coinsApplicable, endDate: endDate } }
    );
    
    revalidatePath('/');
    revalidatePath('/admin/price-management');
    return { success: true, message: 'Product updated.' };
}

export async function vanishProduct(productId: string): Promise<{ success: boolean; message: string }> {
    const isAdmin = await isAdminAuthenticated();
    if (!isAdmin) {
        return { success: false, message: 'Unauthorized' };
    }

    const { ObjectId } = await import('mongodb');
    const db = await connectToDatabase();
    await db.collection<Product>('products').updateOne(
        { _id: new ObjectId(productId) as any },
        { $set: { isVanished: true } }
    );

    revalidatePath('/');
    revalidatePath('/admin/price-management');
    revalidatePath('/admin/vanished-products');
    return { success: true, message: 'Product vanished.' };
}

export async function getVanishedProducts() {
    noStore();
    const db = await connectToDatabase();
    const productsFromDb = await db.collection<Product>('products')
      .find({ isVanished: true })
      .sort({ price: 1 })
      .toArray();

    return productsFromDb.map((p: any) => ({
        ...p,
        _id: p._id.toString(),
    }));
}

export async function restoreProduct(productId: string): Promise<{ success: boolean; message: string }> {
    const isAdmin = await isAdminAuthenticated();
    if (!isAdmin) {
        return { success: false, message: 'Unauthorized' };
    }

    const { ObjectId } = await import('mongodb');
    const db = await connectToDatabase();
    await db.collection<Product>('products').updateOne(
        { _id: new ObjectId(productId) as any },
        { $set: { isVanished: false } }
    );

    revalidatePath('/');
    revalidatePath('/admin/price-management');
    revalidatePath('/admin/vanished-products');
    return { success: true, message: 'Product restored.' };
}

// --- Admin Coin Management ---
export async function addCoinsToUser(gamingId: string, amount: number): Promise<{success: boolean, message: string}> {
    const isAdmin = await isAdminAuthenticated();
    if (!isAdmin) {
        return { success: false, message: 'Unauthorized.' };
    }
    if (!gamingId || amount <= 0) {
        return { success: false, message: 'Invalid Gaming ID or amount.' };
    }

    try {
        const db = await connectToDatabase();
        const result = await db.collection<User>('users').updateOne(
            { gamingId },
            { $inc: { coins: amount } }
        );

        if (result.modifiedCount === 0) {
            return { success: false, message: 'User not found.' };
        }
        revalidatePath('/admin/coin-management');
        return { success: true, message: `Successfully added ${amount} coins to ${gamingId}.` };
    } catch (error) {
        console.error('Error adding coins to user:', error);
        return { success: false, message: 'An error occurred.' };
    }
}

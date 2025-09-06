



'use server';

import { customerFAQChatbot, type CustomerFAQChatbotInput } from '@/ai/flows/customer-faq-chatbot';
import { connectToDatabase } from '@/lib/mongodb';
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { type User, type Order, type Product, type Withdrawal, type LegacyUser } from '@/lib/definitions';
import { randomBytes, createHmac } from 'crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { unstable_noStore as noStore } from 'next/cache';
import { sendRedeemCodeNotification } from '@/lib/email';
import { ObjectId } from 'mongodb';
import Razorpay from 'razorpay';


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
export async function registerGamingId(gamingId: string): Promise<{ success: boolean; message: string; user?: User, isBanned?: boolean, banMessage?: string }> {
  noStore();
  if (!gamingId || gamingId.trim().length < 3) {
    return { success: false, message: 'Invalid Gaming ID provided.' };
  }

  try {
    const db = await connectToDatabase();

    const bannedUser = await db.collection<User>('users').findOne({ gamingId, isBanned: true });
    if (bannedUser) {
        return { success: false, message: 'This Gaming ID has been banned.', isBanned: true, banMessage: bannedUser.banMessage };
    }


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
      canSetGiftPassword: false, // Default to not being able to set password
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
        if (user.isBanned) {
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
        const result = await db.collection<User>('users').updateOne(
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

const setGiftPasswordSchema = z.object({
  giftPassword: z.string().min(6, 'Gift password must be at least 6 characters.'),
});

export async function setGiftPassword(prevState: FormState, formData: FormData): Promise<FormState> {
    const gamingId = cookies().get('gaming_id')?.value;
    if (!gamingId) {
        return { success: false, message: 'You must be logged in.' };
    }

    const validatedFields = setGiftPasswordSchema.safeParse(Object.fromEntries(formData));
    if (!validatedFields.success) {
        return { success: false, message: 'Invalid data provided.' };
    }

    const { giftPassword } = validatedFields.data;

    try {
        const db = await connectToDatabase();
        const user = await db.collection<User>('users').findOne({ gamingId });

        if (!user) {
            return { success: false, message: 'User not found.' };
        }
        if (!user.canSetGiftPassword) {
            return { success: false, message: 'You are not eligible to set a gift password yet.' };
        }

        const wasPasswordSet = !!user.giftPassword;
        const hashedPassword = await bcrypt.hash(giftPassword, 10);
        
        await db.collection<User>('users').updateOne(
            { gamingId }, 
            { $set: { giftPassword: hashedPassword, canSetGiftPassword: false } }
        );

        revalidatePath('/');
        if (wasPasswordSet) {
            return { success: true, message: 'Gift password reset successfully!' };
        }
        return { success: true, message: 'Gift password set successfully!' };
    } catch (error) {
        console.error('Error setting gift password:', error);
        return { success: false, message: 'An unexpected error occurred.' };
    }
}

const transferCoinsSchema = z.object({
  recipientId: z.string().min(1, "Recipient ID is required."),
  amount: z.coerce.number().positive("Amount must be positive."),
  giftPassword: z.string().min(1, "Gift password is required."),
});

export async function transferCoins(prevState: FormState, formData: FormData): Promise<FormState> {
  const senderGamingId = cookies().get('gaming_id')?.value;
  if (!senderGamingId) {
    return { success: false, message: 'You must be logged in to transfer coins.' };
  }

  const validatedFields = transferCoinsSchema.safeParse(Object.fromEntries(formData));
  if (!validatedFields.success) {
    return { success: false, message: 'Invalid data.' };
  }

  const { recipientId, amount, giftPassword } = validatedFields.data;
  
  if (senderGamingId === recipientId) {
    return { success: false, message: 'You cannot transfer coins to yourself.' };
  }

  const db = await connectToDatabase();
  const session = db.client.startSession();

  try {
    let resultMessage = '';
    await session.withTransaction(async () => {
      const sender = await db.collection<User>('users').findOne({ gamingId: senderGamingId }, { session });
      if (!sender) {
          throw new Error('Sender not found.');
      }
      if (sender.coins < amount) {
        throw new Error('Insufficient coins.');
      }
      if (!sender.giftPassword) {
        throw new Error('You have not set a gift password.');
      }

      const passwordMatch = await bcrypt.compare(giftPassword, sender.giftPassword);
      if (!passwordMatch) {
          throw new Error('Incorrect gift password.');
      }

      const recipient = await db.collection<User>('users').findOne({ gamingId: recipientId }, { session });
      if (!recipient) {
        throw new Error('Recipient not found.');
      }

      await db.collection<User>('users').updateOne({ gamingId: senderGamingId }, { $inc: { coins: -amount } }, { session });
      await db.collection<User>('users').updateOne({ gamingId: recipientId }, { $inc: { coins: amount } }, { session });
      
      resultMessage = `Successfully transferred ${amount} coins to ${recipientId}.`;
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
        return JSON.parse(JSON.stringify(ordersFromDb));
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
    const validatedData = redeemCodeSchema.safeParse({ gamingId, productId: product._id.toString(), redeemCode });
    if (!validatedData.success) {
        return { success: false, message: 'Invalid data provided.' };
    }
    
    const db = await connectToDatabase();
    
    const coinsUsed = product.isCoinProduct ? 0 : Math.min(user.coins, product.coinsApplicable || 0);
    const finalPrice = product.isCoinProduct ? product.purchasePrice || product.price : product.price - coinsUsed;

    const newOrder: Omit<Order, '_id'> = {
        userId: user._id.toString(),
        gamingId: validatedData.data.gamingId,
        productId: product._id.toString(),
        productName: product.name,
        productPrice: product.price,
        productImageUrl: product.imageUrl,
        paymentMethod: 'Redeem Code',
        status: 'Processing',
        redeemCode: validatedData.data.redeemCode,
        referralCode: user.referredByCode, // Save the referrer's code
        coinsUsed,
        finalPrice,
        isCoinProduct: product.isCoinProduct,
        createdAt: new Date(),
        coinsAtTimeOfPurchase: user.coins, // Record coins at time of purchase
    };

    try {
        await db.collection<Order>('orders').insertOne(newOrder as Order);

        if (coinsUsed > 0 && !product.isCoinProduct) {
            await db.collection<User>('users').updateOne({ _id: new ObjectId(user._id) }, { $inc: { coins: -coinsUsed } });
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

// --- Razorpay Actions ---
export async function createRazorpayOrder(amount: number, gamingId: string) {
    noStore();
    const razorpay = new Razorpay({
        key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || '',
        key_secret: process.env.RAZORPAY_KEY_SECRET || '',
    });

    const options = {
        amount: amount * 100, // amount in the smallest currency unit
        currency: "INR",
        receipt: `receipt_order_${new Date().getTime()}`,
        notes: {
            gamingId: gamingId,
        }
    };
    try {
        const order = await razorpay.orders.create(options);
        return { success: true, order };
    } catch (error) {
        console.error('Error creating Razorpay order:', error);
        return { success: false, error: 'Failed to create payment order.' };
    }
}

const verifyPaymentSchema = z.object({
    razorpay_order_id: z.string(),
    razorpay_payment_id: z.string(),
    razorpay_signature: z.string(),
    productId: z.string(),
    gamingId: z.string(),
});

export async function verifyRazorpayPayment(formData: FormData) {
    const validatedData = verifyPaymentSchema.safeParse(Object.fromEntries(formData));

    if (!validatedData.success) {
        return { success: false, message: 'Invalid payment data.' };
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, productId, gamingId } = validatedData.data;
    const body = razorpay_order_id + "|" + razorpay_payment_id;

    const expectedSignature = createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
        .update(body.toString())
        .digest('hex');

    if (expectedSignature !== razorpay_signature) {
        return { success: false, message: 'Invalid payment signature.' };
    }

    // Payment is verified, now create the order in the database
    const db = await connectToDatabase();
    const product = await db.collection<Product>('products').findOne({ _id: new ObjectId(productId) });
    const user = await db.collection<User>('users').findOne({ gamingId });

    if (!product || !user) {
        return { success: false, message: 'Product or user not found.' };
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
        utr: razorpay_payment_id, // Storing payment ID in UTR field for consistency
        referralCode: user.referredByCode,
        coinsUsed,
        finalPrice,
        isCoinProduct: product.isCoinProduct,
        createdAt: new Date(),
        coinsAtTimeOfPurchase: user.coins, // Record coins at time of purchase
    };

    try {
        const session = db.client.startSession();
        await session.withTransaction(async () => {
            await db.collection<Order>('orders').insertOne(newOrder as Order, { session });

            if (product.isCoinProduct) {
                // Instantly reward coins for coin product purchase
                await db.collection<User>('users').updateOne(
                    { _id: user._id },
                    { $inc: { coins: product.quantity } },
                    { session }
                );
            } else if (coinsUsed > 0) {
                // Deduct coins for normal product purchase
                await db.collection<User>('users').updateOne(
                    { _id: user._id },
                    { $inc: { coins: -coinsUsed } },
                    { session }
                );
            }

            // Handle referral reward if the order is completed instantly
            if (orderStatus === 'Completed' && user.referredByCode) {
                 const rewardAmount = finalPrice * 0.50;
                 await db.collection<LegacyUser>('legacy_users').updateOne(
                    { referralCode: user.referredByCode },
                    { $inc: { walletBalance: rewardAmount } },
                    { session }
                );
            }
        });
        await session.endSession();
        
        revalidatePath('/');
        revalidatePath('/order');
        revalidatePath('/admin/success');
        return { success: true, message: 'Payment successful, order created.' };
    } catch (error) {
        console.error('Error creating order after payment verification:', error);
        return { success: false, message: 'Failed to create order after payment.' };
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

    // Start a session for transaction
    const session = db.client.startSession();
    try {
        await session.withTransaction(async () => {
            // Update order status
            await db.collection<Order>('orders').updateOne({ _id: new ObjectId(orderId) }, { $set: { status } }, { session });
            
            // If order is completed, process rewards and eligibility
            if (status === 'Completed') {
                // Reward referrer if applicable
                if (order.referralCode) {
                    const rewardAmount = order.finalPrice * 0.50;
                    await db.collection<LegacyUser>('legacy_users').updateOne(
                        { referralCode: order.referralCode },
                        { $inc: { walletBalance: rewardAmount } },
                        { session }
                    );
                }

                // Check if user is now eligible to set/reset gift password
                // Condition: The user must have spent all their coins in this purchase
                if (order.coinsAtTimeOfPurchase !== undefined && order.coinsUsed === order.coinsAtTimeOfPurchase) {
                   await db.collection<User>('users').updateOne(
                       { gamingId: order.gamingId },
                       { $set: { canSetGiftPassword: true } },
                       { session }
                   );
                }
            } else if (status === 'Failed' && order.paymentMethod !== 'Redeem Code' && !order.isCoinProduct && (order.coinsUsed || 0) > 0) {
                // If a UPI payment order fails, revert the coin deduction.
                // This does not apply to redeem code orders as coins aren't deducted until completion.
                await db.collection<User>('users').updateOne(
                    { gamingId: order.gamingId },
                    { $inc: { coins: order.coinsUsed } },
                    { session }
                );
            }
        });
    } finally {
        await session.endSession();
    }

    revalidatePath('/admin');
    revalidatePath('/admin/success');
    revalidatePath('/admin/failed');
    revalidatePath('/'); // Revalidate home page for user coin/eligibility changes
    return { success: true };
}

export async function deleteUser(userId: string): Promise<{success: boolean; message: string}> {
    const isAdmin = await isAdminAuthenticated();
    if (!isAdmin) {
        return { success: false, message: 'Unauthorized' };
    }
    const { ObjectId } = await import('mongodb');
    const db = await connectToDatabase();
    await db.collection<LegacyUser>('legacy_users').deleteOne({ _id: new ObjectId(userId) });
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

  const orders = JSON.parse(JSON.stringify(ordersFromDb));

  return { orders, hasMore, totalOrders };
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

  const users = JSON.parse(JSON.stringify(usersFromDb));


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

    const withdrawals = JSON.parse(JSON.stringify(withdrawalsFromDb));

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

    const withdrawals = JSON.parse(JSON.stringify(withdrawalsFromDb));

    return { withdrawals, hasMore };
}

export async function updateWithdrawalStatus(withdrawalId: string, status: 'Completed' | 'Failed'): Promise<{ success: boolean; message?: string }> {
    const isAdmin = await isAdminAuthenticated();
    if (!isAdmin) {
        return { success: false };
    }
    const { ObjectId } = await import('mongodb');
    const db = await connectToDatabase();

    const result = await db.collection<Withdrawal>('withdrawals').updateOne(
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
export async function getProducts() {
    noStore();
    const db = await connectToDatabase();
    const productsFromDb = await db.collection<Product>('products')
      .find({ isVanished: { $ne: true } })
      .sort({ displayOrder: 1 })
      .toArray();

    return JSON.parse(JSON.stringify(productsFromDb));
}


const productUpdateSchema = z.object({
  name: z.string().min(3, 'Product name must be at least 3 characters.'),
  price: z.coerce.number().positive('Price must be a positive number.'),
  quantity: z.coerce.number().int().positive('Quantity must be a positive integer.'),
  isAvailable: z.enum(['on', 'off']).optional(),
  onlyUpi: z.enum(['on', 'off']).optional(),
  oneTimeBuy: z.enum(['on', 'off']).optional(),
  endDate: z.string().optional(),
  imageUrl: z.string().url('Must be a valid URL.'),
  displayOrder: z.coerce.number().int().min(1, 'Display order must be a positive number.'),
  category: z.string().optional(),
  isCoinProduct: z.enum(['true', 'false']),
  purchasePrice: z.coerce.number().optional(),
  coinsApplicable: z.coerce.number().optional(),
}).refine(
    (data) => {
        if (data.isCoinProduct === 'true') {
            return data.purchasePrice !== undefined && data.purchasePrice > 0;
        }
        return true;
    },
    {
        message: 'Purchase price must be a positive number for coin products.',
        path: ['purchasePrice'],
    }
).refine(
    (data) => {
        if (data.isCoinProduct === 'false') {
            return data.coinsApplicable !== undefined && data.coinsApplicable >= 0;
        }
        return true;
    },
    {
        message: 'Applicable coins must be a non-negative number for normal products.',
        path: ['coinsApplicable'],
    }
);


export async function updateProduct(productId: string, formData: FormData): Promise<{ success: boolean; message: string }> {
    const isAdmin = await isAdminAuthenticated();
    if (!isAdmin) {
        return { success: false, message: 'Unauthorized' };
    }

    const rawFormData = Object.fromEntries(formData.entries());
    const validatedFields = productUpdateSchema.safeParse(rawFormData);
    
    if (!validatedFields.success) {
        return { success: false, message: validatedFields.error.errors.map(e => `${e.path.join('.')} - ${e.message}`).join(', ') };
    }

    const data = validatedFields.data;
    const isAvailable = rawFormData.isAvailable === 'on';
    const onlyUpi = rawFormData.onlyUpi === 'on';
    const oneTimeBuy = rawFormData.oneTimeBuy === 'on';
    const endDate = data.endDate ? new Date(data.endDate) : undefined;
    const isCoinProduct = data.isCoinProduct === 'true';
    
    const updateData: Partial<Product> = {
        name: data.name,
        price: data.price,
        quantity: data.quantity,
        isAvailable,
        onlyUpi,
        oneTimeBuy,
        endDate,
        imageUrl: data.imageUrl,
        displayOrder: data.displayOrder,
        category: data.category,
        isCoinProduct,
        purchasePrice: isCoinProduct ? data.purchasePrice : undefined,
        coinsApplicable: isCoinProduct ? 0 : data.coinsApplicable,
    };


    const db = await connectToDatabase();

    const existingProductWithOrder = await db.collection<Product>('products').findOne({
        displayOrder: data.displayOrder,
        _id: { $ne: new ObjectId(productId) }
    });

    if (existingProductWithOrder) {
        return { success: false, message: `Display order ${data.displayOrder} is already in use by another product.` };
    }


    await db.collection<Product>('products').updateOne(
        { _id: new ObjectId(productId) },
        { $set: updateData }
    );
    
    revalidatePath('/');
    revalidatePath('/admin/price-management');
    return { success: true, message: 'Product updated.' };
}

export async function addProduct(isCoinProduct: boolean): Promise<{ success: boolean, message: string }> {
    const isAdmin = await isAdminAuthenticated();
    if (!isAdmin) {
        return { success: false, message: 'Unauthorized' };
    }
    
    const db = await connectToDatabase();

    const lastProduct = await db.collection<Product>('products').find().sort({ displayOrder: -1 }).limit(1).toArray();
    const newDisplayOrder = lastProduct.length > 0 ? (lastProduct[0].displayOrder || 0) + 1 : 1;

    let newProduct: Omit<Product, '_id'>;
    
    if (isCoinProduct) {
        newProduct = {
            name: "New Coin Product",
            price: 100,
            purchasePrice: 80,
            quantity: 1000,
            imageUrl: "https://placehold.co/600x400.png",
            dataAiHint: "gold coins",
            isAvailable: false,
            isVanished: false,
            coinsApplicable: 0,
            isCoinProduct: true,
            displayOrder: newDisplayOrder,
            category: "Coins",
            onlyUpi: false,
            oneTimeBuy: false,
        };
    } else {
        newProduct = {
            name: "New Product",
            price: 99,
            quantity: 1,
            imageUrl: "https://placehold.co/600x400.png",
            dataAiHint: "placeholder image",
            isAvailable: false,
            isVanished: false,
            coinsApplicable: 0,
            displayOrder: newDisplayOrder,
            category: "Uncategorized",
            onlyUpi: false,
            oneTimeBuy: false,
        };
    }

    await db.collection<Product>('products').insertOne(newProduct as Product);
    
    revalidatePath('/admin/price-management');
    return { success: true, message: 'New product added.' };
}

export async function vanishProduct(productId: string): Promise<{ success: boolean; message: string }> {
    const isAdmin = await isAdminAuthenticated();
    if (!isAdmin) {
        return { success: false, message: 'Unauthorized' };
    }

    const db = await connectToDatabase();
    await db.collection<Product>('products').updateOne(
        { _id: new ObjectId(productId) },
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

    return JSON.parse(JSON.stringify(productsFromDb));
}

export async function restoreProduct(productId: string): Promise<{ success: boolean; message: string }> {
    const isAdmin = await isAdminAuthenticated();
    if (!isAdmin) {
        return { success: false, message: 'Unauthorized' };
    }

    const db = await connectToDatabase();
    await db.collection<Product>('products').updateOne(
        { _id: new ObjectId(productId) },
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

// --- Admin User Management ---
export async function getUsersForAdmin(page: number, sort: string, search: string) {
    noStore();
    const db = await connectToDatabase();
    const skip = (page - 1) * PAGE_SIZE;

    let query: any = {};
     if (search) {
        query.$or = [
            { gamingId: { $regex: search, $options: 'i' } },
            { referredByCode: { $regex: search, $options: 'i' } }
        ]
    }

    const usersFromDb = await db.collection<User>('users')
        .find(query)
        .sort({ createdAt: sort === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(PAGE_SIZE)
        .toArray();

    const totalUsers = await db.collection('users').countDocuments(query);
    const hasMore = skip + usersFromDb.length < totalUsers;
    
    const users = JSON.parse(JSON.stringify(usersFromDb));

    return { users, hasMore };
}

export async function banUser(userId: string, banMessage: string): Promise<{ success: boolean; message: string }> {
    const isAdmin = await isAdminAuthenticated();
    if (!isAdmin) {
        return { success: false, message: 'Unauthorized' };
    }
    const db = await connectToDatabase();
    
    const result = await db.collection<User>('users').updateOne(
        { _id: new ObjectId(userId) },
        { $set: { isBanned: true, banMessage: banMessage } }
    );
    
    if (result.modifiedCount === 0) {
        return { success: false, message: 'User not found or already banned.' };
    }

    revalidatePath('/admin/users');
    return { success: true, message: 'User has been banned.' };
}

export async function unbanUser(userId: string): Promise<{ success: boolean; message: string }> {
    const isAdmin = await isAdminAuthenticated();
    if (!isAdmin) {
        return { success: false, message: 'Unauthorized' };
    }
    const db = await connectToDatabase();
    
    const result = await db.collection<User>('users').updateOne(
        { _id: new ObjectId(userId) },
        { $set: { isBanned: false }, $unset: { banMessage: "" } }
    );
    
    if (result.modifiedCount === 0) {
        return { success: false, message: 'User not found or not banned.' };
    }

    revalidatePath('/admin/users');
    return { success: true, message: 'User has been unbanned.' };
}

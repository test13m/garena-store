'use server';

import { customerFAQChatbot, type CustomerFAQChatbotInput } from '@/ai/flows/customer-faq-chatbot';
import { connectToDatabase } from '@/lib/mongodb';
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { type User } from '@/lib/definitions';
import { randomBytes } from 'crypto';

const SECRET_KEY = process.env.JWT_SECRET_KEY || new TextEncoder().encode('your-super-secret-jwt-key-that-is-at-least-32-bytes-long');
const key = typeof SECRET_KEY === 'string' ? new TextEncoder().encode(SECRET_KEY) : SECRET_KEY;

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

const accountSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters long'),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
});

type FormState = {
  success: boolean;
  message: string;
};

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
    const existingUser = await db.collection<User>('users').findOne({ username });

    if (existingUser) {
      return { success: false, message: 'Username already exists.' };
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser: Omit<User, '_id'> = { username, password: hashedPassword };

    if (referralCode) {
        const referringUser = await db.collection<User>('users').findOne({ referralCode });
        if (referringUser) {
            newUser.referredBy = referringUser.username;
        }
        // Clear the cookie after use
        cookies().delete('referral_code');
    }

    await db.collection('users').insertOne(newUser);

    await createSession(username);

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
    const user = await db.collection<User>('users').findOne({ username });

    if (!user) {
      return { success: false, message: 'Incorrect username or password.' };
    }

    const passwordsMatch = await bcrypt.compare(password, user.password);

    if (!passwordsMatch) {
      return { success: false, message: 'Incorrect username or password.' };
    }

    await createSession(username);

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
        const user = await db.collection<User>('users').findOne({ username: session.username });

        if (!user) {
            return { success: false, message: 'User not found.' };
        }

        const passwordsMatch = await bcrypt.compare(oldPassword, user.password);
        if (!passwordsMatch) {
            return { success: false, message: 'Incorrect old password.' };
        }

        const hashedNewPassword = await bcrypt.hash(newPassword, 10);
        await db.collection('users').updateOne({ username: session.username }, { $set: { password: hashedNewPassword } });
        
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

        const existingNewUser = await db.collection<User>('users').findOne({ username: newUsername });
        if (existingNewUser) {
            return { success: false, message: 'New username is already taken.' };
        }
        
        const currentUser = await db.collection<User>('users').findOne({ username: session.username });

        if (!currentUser) {
            return { success: false, message: 'Current user not found.' };
        }

        const passwordsMatch = await bcrypt.compare(password, currentUser.password);
        if (!passwordsMatch) {
            return { success: false, message: 'Incorrect password.' };
        }

        await db.collection('users').updateOne({ username: session.username }, { $set: { username: newUsername } });
        
        // Create a new session with the new username
        await createSession(newUsername);

        return { success: true, message: 'Username changed successfully!' };
    } catch (error) {
        console.error(error);
        return { success: false, message: 'An unexpected error occurred.' };
    }
}

export async function generateReferralLink(): Promise<{ success: boolean; link?: string; message: string }> {
    const session = await getSession();
    if (!session?.username) {
        return { success: false, message: 'You must be logged in.' };
    }

    try {
        const db = await connectToDatabase();
        const user = await db.collection<User>('users').findOne({ username: session.username });

        if (!user) {
            return { success: false, message: 'User not found.' };
        }
        
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
        if (!baseUrl) {
            console.error('NEXT_PUBLIC_BASE_URL is not set. Please add it to your .env file.');
            return { success: false, message: 'Could not generate link. Site configuration is missing.' };
        }

        if (user.referralCode) {
            const link = `${baseUrl}/?ref=${user.referralCode}`;
            return { success: true, link, message: 'Your existing referral link.' };
        }

        const referralCode = randomBytes(4).toString('hex'); // 8 characters
        await db.collection('users').updateOne(
            { username: session.username },
            { $set: { referralCode } }
        );

        const link = `${baseUrl}/?ref=${referralCode}`;
        return { success: true, link, message: 'Referral link generated successfully!' };

    } catch (error) {
        console.error(error);
        return { success: false, message: 'An unexpected error occurred.' };
    }
}

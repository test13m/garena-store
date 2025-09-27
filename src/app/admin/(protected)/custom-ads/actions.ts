
'use server';

import { isAdminAuthenticated } from '@/app/actions';
import { CustomAd } from '@/lib/definitions';
import { connectToDatabase } from '@/lib/mongodb';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { unstable_noStore as noStore } from 'next/cache';

const adSchema = z.object({
    videoUrl: z.string().url('Must be a valid URL.'),
    ctaText: z.string().min(1, 'Button text is required.'),
    ctaLink: z.string().url('Must be a valid URL.'),
    ctaShape: z.enum(['pill', 'rounded', 'square']),
    ctaColor: z.enum(['primary', 'destructive', 'outline']),
    totalDuration: z.coerce.number().int().min(5, 'Total duration must be at least 5 seconds.'),
    rewardTime: z.coerce.number().int().min(1, 'Reward time must be at least 1 second.'),
    hideCtaButton: z.enum(['on', 'off']).optional(),
}).refine(data => data.rewardTime <= data.totalDuration, {
    message: 'Reward time cannot be greater than the total duration.',
    path: ['rewardTime'],
});

export async function getActiveAd(): Promise<CustomAd | null> {
    noStore();
    try {
        const db = await connectToDatabase();
        const ad = await db.collection<CustomAd>('custom_ads').findOne({ isActive: true });
        if (!ad) return null;
        return JSON.parse(JSON.stringify(ad));
    } catch (error) {
        console.error('Error fetching active ad:', error);
        return null;
    }
}

export async function getAdSettings(): Promise<CustomAd | null> {
    noStore();
    const isAdmin = await isAdminAuthenticated();
    if (!isAdmin) return null;

    try {
        const db = await connectToDatabase();
        // Find the most recently updated ad setting
        const ad = await db.collection<CustomAd>('custom_ads').findOne({}, { sort: { updatedAt: -1 } });
        if (!ad) return null;
        return JSON.parse(JSON.stringify(ad));
    } catch (error) {
        console.error('Error fetching ad settings:', error);
        return null;
    }
}

export async function saveAdSettings(prevState: { success: boolean, message: string }, formData: FormData): Promise<{ success: boolean, message: string }> {
    const isAdmin = await isAdminAuthenticated();
    if (!isAdmin) {
        return { success: false, message: 'Unauthorized' };
    }

    const rawData = Object.fromEntries(formData.entries());
    const validated = adSchema.safeParse(rawData);

    if (!validated.success) {
        const errors = validated.error.errors.map(e => e.message).join(', ');
        return { success: false, message: `Invalid data: ${errors}` };
    }

    const { videoUrl, ctaText, ctaLink, ctaShape, ctaColor, totalDuration, rewardTime } = validated.data;
    const hideCtaButton = rawData.hideCtaButton === 'on';

    try {
        const db = await connectToDatabase();
        const now = new Date();

        // Deactivate all other ads
        await db.collection<CustomAd>('custom_ads').updateMany(
            { isActive: true },
            { $set: { isActive: false, updatedAt: now } }
        );
        
        // Create the new ad setting as the only active one
        const newAd: Omit<CustomAd, '_id'> = {
            videoUrl,
            ctaText,
            ctaLink,
            ctaShape,
            ctaColor,
            totalDuration,
            rewardTime,
            hideCtaButton,
            isActive: true,
            createdAt: now,
            updatedAt: now,
        };

        await db.collection<CustomAd>('custom_ads').insertOne(newAd as CustomAd);

        revalidatePath('/admin/custom-ads');
        revalidatePath('/watch-ad');

        return { success: true, message: 'Ad settings saved and activated successfully.' };

    } catch (error) {
        console.error('Error saving ad settings:', error);
        return { success: false, message: 'An unexpected error occurred.' };
    }
}

'use server';

import { isAdminAuthenticated } from '@/app/actions';
import { connectToDatabase } from '@/lib/mongodb';
import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';
import { Product } from '@/lib/definitions';


export async function deleteProductPermanently(productId: string): Promise<{ success: boolean; message: string }> {
    const isAdmin = await isAdminAuthenticated();
    if (!isAdmin) {
        return { success: false, message: 'Unauthorized' };
    }

    try {
        const db = await connectToDatabase();
        const result = await db.collection<Product>('products').deleteOne({ _id: new ObjectId(productId) });
        if (result.deletedCount === 0) {
            return { success: false, message: 'Product not found.' };
        }
        revalidatePath('/admin/vanished-products');
        return { success: true, message: 'Product permanently deleted.' };

    } catch (error) {
        console.error('Error deleting product permanently:', error);
        return { success: false, message: 'An unexpected error occurred.' };
    }
}

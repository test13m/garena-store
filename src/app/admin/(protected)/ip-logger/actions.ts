
'use server';

import { isAdminAuthenticated } from '@/app/actions';
import { User } from '@/lib/definitions';
import { connectToDatabase } from '@/lib/mongodb';
import { unstable_noStore as noStore } from 'next/cache';

const PAGE_SIZE = 20;

export async function getIpHistory(page: number, searchId: string, searchIp: string, searchFingerprint: string) {
    noStore();
    const isAdmin = await isAdminAuthenticated();
    if (!isAdmin) {
        return { users: [], hasMore: false, totalUsers: 0 };
    }

    const db = await connectToDatabase();
    const skip = (page - 1) * PAGE_SIZE;

    let query: any = { };
    const andConditions = [];

    if (searchId) {
        andConditions.push({ gamingId: { $regex: searchId, $options: 'i' } });
    }
    if (searchIp) {
        andConditions.push({ 'ipHistory.ip': { $regex: searchIp.replace(/\./g, '\\.'), $options: 'i' } });
    }
    if (searchFingerprint) {
        andConditions.push({ 'fingerprintHistory.fingerprint': { $regex: searchFingerprint, $options: 'i' } });
    }
    
    if (andConditions.length > 0) {
        query.$and = andConditions;
    } else {
        // If no search, only show users with some history
        query.$or = [
            { ipHistory: { $exists: true, $not: { $size: 0 } } },
            { fingerprintHistory: { $exists: true, $not: { $size: 0 } } }
        ];
    }


    const usersFromDb = await db.collection<User>('users')
        .find(query)
        .sort({ 'visits.0': -1 }) // Sort by most recent visit
        .skip(skip)
        .limit(PAGE_SIZE)
        .project({ gamingId: 1, ipHistory: 1, fingerprintHistory: 1 })
        .toArray();
    
    const totalUsers = await db.collection('users').countDocuments(query);
    const hasMore = skip + usersFromDb.length < totalUsers;
    const users = JSON.parse(JSON.stringify(usersFromDb));

    return { users, hasMore, totalUsers };
}

export async function searchUsersByIp(ip: string) {
     noStore();
    const isAdmin = await isAdminAuthenticated();
    if (!isAdmin) {
        return { users: [] };
    }
    const db = await connectToDatabase();
    const usersFromDb = await db.collection<User>('users')
        .find({ 'ipHistory.ip': ip })
        .project({ gamingId: 1 })
        .toArray();

    return { users: JSON.parse(JSON.stringify(usersFromDb)) };
}

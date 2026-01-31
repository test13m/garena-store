
'use client';

import { useState, useTransition, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Loader2, Activity, ShoppingCart } from 'lucide-react';
import { getActiveUsers } from '../actions';
import { type User } from '@/lib/definitions';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { cn } from '@/lib/utils';

type ActiveUser = User & { lastVisit: Date, orderCount: number };

interface ActiveUserListProps {
    initialUsers: ActiveUser[];
    initialHasMore: boolean;
    totalUsers: number;
}

const TimeAgo = ({ dateString }: { dateString: Date }) => {
    const [timeAgo, setTimeAgo] = useState('');
    const [isRecent, setIsRecent] = useState(false);

    useEffect(() => {
        const update = () => {
            const now = new Date();
            const visitDate = new Date(dateString);
            const seconds = Math.floor((now.getTime() - visitDate.getTime()) / 1000);
            
            setIsRecent(seconds < 60);

            if (seconds < 60) {
                setTimeAgo(`${seconds}s ago`);
                return;
            }
            const minutes = Math.floor(seconds / 60);
            if (minutes < 60) {
                setTimeAgo(`${minutes}m ago`);
                return;
            }
            const hours = Math.floor(minutes / 60);
            if (hours < 24) {
                setTimeAgo(`${hours}h ago`);
                return;
            }
            const days = Math.floor(hours / 24);
            setTimeAgo(`${days}d ago`);
        }

        update();
        const interval = setInterval(update, 5000); // update every 5 seconds
        return () => clearInterval(interval);

    }, [dateString]);
    
    return (
        <div className="flex items-center gap-2">
            <span className={cn("text-xs", isRecent ? "text-green-600 font-bold" : "text-muted-foreground")}>{timeAgo}</span>
            {isRecent && <Badge className="bg-green-500 hover:bg-green-500 text-white">Active</Badge>}
        </div>
    );
}

export default function ActiveUserList({ initialUsers, initialHasMore, totalUsers }: ActiveUserListProps) {
    const [users, setUsers] = useState<ActiveUser[]>(initialUsers);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(initialHasMore);
    const [isPending, startTransition] = useTransition();

    useEffect(() => {
        setUsers(initialUsers);
        setHasMore(initialHasMore);
        setPage(1);
    }, [initialUsers, initialHasMore]);

    const handleLoadMore = async () => {
        startTransition(async () => {
            const nextPage = page + 1;
            const { users: newUsers, hasMore: newHasMore } = await getActiveUsers(nextPage);
            setUsers(prev => [...prev, ...newUsers]);
            setHasMore(newHasMore);
            setPage(nextPage);
        });
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div className="flex items-center gap-2">
                           <CardTitle>Active Users</CardTitle>
                            {totalUsers !== undefined && (
                                <Badge variant="secondary">{totalUsers}</Badge>
                            )}
                        </div>
                    </div>
                    <CardDescription>
                        Users are sorted by their most recent visit. An "Active" badge is shown for users seen in the last minute.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {users.length === 0 ? (
                        <p className="text-muted-foreground text-center py-8">No active users found.</p>
                    ) : (
                        <div className="space-y-4">
                            {users.map(user => (
                                <Card key={user._id.toString()}>
                                    <CardHeader className="pb-4">
                                        <div className="flex justify-between items-center">
                                            <p className="font-mono font-semibold">{user.gamingId}</p>
                                            <TimeAgo dateString={user.lastVisit} />
                                        </div>
                                    </CardHeader>
                                    <CardFooter className="flex justify-between items-center text-sm text-muted-foreground">
                                        <div className="flex items-center gap-1">
                                            <ShoppingCart className="w-4 h-4"/>
                                            <span>{user.orderCount} Orders</span>
                                        </div>
                                         <Button size="sm" variant="outline" asChild>
                                            <Link href={`/admin/users?search=${user.gamingId}`}>View Profile</Link>
                                        </Button>
                                    </CardFooter>
                                </Card>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {hasMore && (
                <div className="text-center">
                    <Button onClick={handleLoadMore} disabled={isPending}>
                        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Load More
                    </Button>
                </div>
            )}
        </div>
    );
}

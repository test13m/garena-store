'use client';

import { useState, useTransition } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { User } from '@/lib/definitions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ArrowUpDown, Loader2, Search, Trash2 } from 'lucide-react';
import { deleteUser, getUsersForAdmin } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';

interface AccountListProps {
    initialUsers: User[];
    initialHasMore: boolean;
}

export default function AccountList({ initialUsers, initialHasMore }: AccountListProps) {
    const [users, setUsers] = useState<User[]>(initialUsers);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(initialHasMore);
    const [sort, setSort] = useState(useSearchParams().get('sort') || 'asc');
    const [isPending, startTransition] = useTransition();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { toast } = useToast();

    const handleLoadMore = async () => {
        startTransition(async () => {
            const nextPage = page + 1;
            const search = searchParams.get('search') || '';
            const { users: newUsers, hasMore: newHasMore } = await getUsersForAdmin(nextPage, sort, search);
            setUsers(prev => [...prev, ...newUsers]);
            setHasMore(newHasMore);
            setPage(nextPage);
        });
    };

    const handleSortToggle = () => {
        const newSort = sort === 'asc' ? 'desc' : 'asc';
        setSort(newSort);
        const params = new URLSearchParams(searchParams);
        params.set('sort', newSort);
        router.push(`${pathname}?${params.toString()}`);
    };

    const handleSearch = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const searchQuery = formData.get('search') as string;
        const params = new URLSearchParams(searchParams);
        params.set('search', searchQuery);
        params.delete('page');
        router.push(`${pathname}?${params.toString()}`);
    };

    const handleDelete = async (userId: string) => {
        startTransition(async () => {
            const result = await deleteUser(userId);
            if (result.success) {
                setUsers(prev => prev.filter(user => user._id.toString() !== userId));
                toast({ title: 'Success', description: 'User account deleted.' });
            } else {
                toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete user.' });
            }
        });
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <CardTitle>User Accounts</CardTitle>
                        <div className="flex items-center gap-2">
                             <form onSubmit={handleSearch} className="flex items-center gap-2">
                                <Input name="search" placeholder="Search by referral code..." defaultValue={searchParams.get('search') || ''} className="w-48"/>
                                <Button type="submit" variant="outline" size="icon"><Search className="h-4 w-4" /></Button>
                            </form>
                            <Button variant="outline" onClick={handleSortToggle}>
                                <ArrowUpDown className="mr-2 h-4 w-4" />
                                {sort === 'asc' ? 'Oldest First' : 'Newest First'}
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {users.length === 0 ? (
                        <p className="text-muted-foreground">No user accounts to display.</p>
                    ) : (
                        <div className="space-y-4">
                            {users.map(user => (
                                <Card key={user._id.toString()}>
                                    <CardHeader>
                                        <CardTitle className="text-base">{user.username}</CardTitle>
                                        <CardDescription>
                                            Created: {new Date(user.createdAt).toLocaleString()}
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                                            <p className="truncate"><strong>Password Hash:</strong> {user.password}</p>
                                            <p><strong>Referral Code:</strong> {user.referralCode || 'N/A'}</p>
                                            <p><strong>Referred By:</strong> {user.referredBy || 'N/A'}</p>
                                        </div>
                                    </CardContent>
                                    <CardFooter className="flex justify-end">
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="destructive" size="icon" disabled={isPending}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        This action cannot be undone. This will permanently delete the user account.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDelete(user._id.toString())}>
                                                        Delete
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
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

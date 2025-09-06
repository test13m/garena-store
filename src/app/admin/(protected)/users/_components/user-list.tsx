'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ArrowUpDown, Loader2, Search, Coins, Eye, ShieldBan, ShieldCheck } from 'lucide-react';
import { banUser, getUsersForAdmin, unbanUser } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { type User } from '@/lib/definitions';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

interface UserListProps {
    initialUsers: User[];
    initialHasMore: boolean;
}

const FormattedDate = ({ dateString }: { dateString: string }) => {
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    if (!mounted) return null;
    const date = new Date(dateString);
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
}

export default function UserList({ initialUsers, initialHasMore }: UserListProps) {
    const [users, setUsers] = useState<User[]>(initialUsers);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(initialHasMore);
    const [isPending, startTransition] = useTransition();
    const [banMessage, setBanMessage] = useState('');
    const [isBanModalOpen, setIsBanModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { toast } = useToast();

    const sort = searchParams.get('sort') || 'asc';
    const search = searchParams.get('search') || '';

    useEffect(() => {
        setUsers(initialUsers);
        setHasMore(initialHasMore);
        setPage(1);
    }, [initialUsers, initialHasMore]);

    const handleLoadMore = async () => {
        startTransition(async () => {
            const nextPage = page + 1;
            const { users: newUsers, hasMore: newHasMore } = await getUsersForAdmin(nextPage, sort, search);
            setUsers(prev => [...prev, ...newUsers]);
            setHasMore(newHasMore);
            setPage(nextPage);
        });
    };

    const handleSortToggle = () => {
        const newSort = sort === 'asc' ? 'desc' : 'asc';
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

    const handleBan = async () => {
        if (!selectedUser) return;
        startTransition(async () => {
            const result = await banUser(selectedUser._id.toString(), banMessage);
            if (result.success) {
                setUsers(prevUsers => prevUsers.map(user => 
                    user._id.toString() === selectedUser._id.toString() ? { ...user, isBanned: true, banMessage: banMessage } : user
                ));
                toast({ title: 'Success', description: result.message });
            } else {
                toast({ variant: 'destructive', title: 'Error', description: result.message });
            }
            setIsBanModalOpen(false);
            setBanMessage('');
            setSelectedUser(null);
        });
    };

    const handleUnban = async (userId: string) => {
        startTransition(async () => {
            const result = await unbanUser(userId);
             if (result.success) {
                setUsers(prevUsers => prevUsers.map(user => 
                    user._id.toString() === userId ? { ...user, isBanned: false, banMessage: undefined } : user
                ));
                toast({ title: 'Success', description: result.message });
            } else {
                toast({ variant: 'destructive', title: 'Error', description: result.message });
            }
        });
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <CardTitle>User Management</CardTitle>
                        <div className="flex items-center gap-2">
                             <form onSubmit={handleSearch} className="flex items-center gap-2">
                                <Input name="search" placeholder="Search Gaming/Referral ID..." defaultValue={searchParams.get('search') || ''} className="w-56"/>
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
                        <p className="text-muted-foreground">No users to display.</p>
                    ) : (
                        <div className="space-y-4">
                            {users.map(user => (
                                <Card key={user._id.toString()} className={user.isBanned ? 'bg-destructive/10 border-destructive' : ''}>
                                    <CardHeader>
                                        <div className="flex justify-between items-start">
                                            <CardTitle className="text-base font-mono">{user.gamingId}</CardTitle>
                                             {user.isBanned && <Badge variant="destructive">Banned</Badge>}
                                        </div>
                                        <CardDescription>
                                            Joined: <FormattedDate dateString={user.createdAt as unknown as string} />
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                                            <p className="flex items-center gap-2 font-semibold"><Coins className="w-4 h-4 text-amber-500" /> {user.coins}</p>
                                            <p><strong>Referred By Code:</strong> {user.referredByCode || 'N/A'}</p>
                                             {user.isBanned && user.banMessage && <p className="sm:col-span-2"><strong>Ban Reason:</strong> {user.banMessage}</p>}
                                        </div>
                                    </CardContent>
                                    <CardFooter className="flex justify-end gap-2">
                                        <Button asChild variant="outline" size="icon">
                                            <Link href={`/admin/all-orders?search=${user.gamingId}`} target="_blank">
                                                <Eye className="h-4 w-4" />
                                            </Link>
                                        </Button>
                                        {user.isBanned ? (
                                            <Button variant="secondary" size="icon" onClick={() => handleUnban(user._id.toString())} disabled={isPending}>
                                                <ShieldCheck className="h-4 w-4" />
                                            </Button>
                                        ) : (
                                            <Button variant="destructive" size="icon" onClick={() => { setSelectedUser(user); setIsBanModalOpen(true); }} disabled={isPending}>
                                                <ShieldBan className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </CardFooter>
                                </Card>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            <Dialog open={isBanModalOpen} onOpenChange={setIsBanModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Ban User: {selectedUser?.gamingId}</DialogTitle>
                        <DialogDescription>
                            Please provide a reason for banning this user. This message will be shown to them if they try to log in.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-2">
                        <Label htmlFor="ban-message">Ban Message</Label>
                        <Textarea id="ban-message" value={banMessage} onChange={(e) => setBanMessage(e.target.value)} placeholder="e.g., Violation of terms of service." />
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsBanModalOpen(false)}>Cancel</Button>
                        <Button variant="destructive" onClick={handleBan} disabled={isPending || !banMessage}>
                            {isPending ? <Loader2 className="animate-spin" /> : 'Confirm Ban'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

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

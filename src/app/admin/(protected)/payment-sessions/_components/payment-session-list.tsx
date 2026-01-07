
'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, ZapOff, CheckCircle } from 'lucide-react';
import { getPaymentSessions, forceExpireLock, approvePaymentManually } from '../actions';
import { Input } from '@/components/ui/input';
import type { PaymentLock } from '@/lib/definitions';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';


interface PaymentSessionListProps {
    initialSessions: PaymentLock[];
    initialHasMore: boolean;
    totalSessions: number;
}

const FormattedDate = ({ dateString }: { dateString: string }) => {
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    if (!mounted) return null;
    const date = new Date(dateString);
    return date.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
}

function calculateDuration(start: string, end: string): string {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffMs = endDate.getTime() - startDate.getTime();
    const diffSecs = Math.round(diffMs / 1000);

    if (diffSecs < 60) {
        return `${diffSecs}s`;
    }
    const diffMins = Math.floor(diffSecs / 60);
    const remainingSecs = diffSecs % 60;
    return `${diffMins}m ${remainingSecs}s`;
}

export default function PaymentSessionList({ initialSessions, initialHasMore, totalSessions }: PaymentSessionListProps) {
    const [sessions, setSessions] = useState<PaymentLock[]>(initialSessions);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(initialHasMore);
    const [isPending, startTransition] = useTransition();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { toast } = useToast();

    const search = searchParams.get('search') || '';

    useEffect(() => {
        setSessions(initialSessions);
        setHasMore(initialHasMore);
        setPage(1);
    }, [initialSessions, initialHasMore]);

    const handleLoadMore = async () => {
        startTransition(async () => {
            const nextPage = page + 1;
            const { sessions: newSessions, hasMore: newHasMore } = await getPaymentSessions(nextPage, search);
            setSessions(prev => [...prev, ...newSessions]);
            setHasMore(newHasMore);
            setPage(nextPage);
        });
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

    const handleForceExpire = async (lockId: string) => {
        startTransition(async () => {
            const result = await forceExpireLock(lockId);
            if(result.success) {
                toast({ title: 'Success', description: result.message });
                setSessions(prev => prev.map(s => s._id.toString() === lockId ? {...s, status: 'expired'} : s));
            } else {
                toast({ variant: 'destructive', title: 'Error', description: result.message });
            }
        });
    }

    const handleManualApprove = async (lockId: string) => {
        startTransition(async () => {
            const result = await approvePaymentManually(lockId);
             if(result.success) {
                toast({ title: 'Success', description: result.message });
                setSessions(prev => prev.map(s => s._id.toString() === lockId ? {...s, status: 'completed'} : s));
            } else {
                toast({ variant: 'destructive', title: 'Error', description: result.message });
            }
        });
    }

    const getStatusVariant = (status: PaymentLock['status']) => {
        switch (status) {
            case 'active': return 'default';
            case 'completed': return 'default';
            case 'expired': return 'secondary';
            default: return 'outline';
        }
    }
     const getStatusClass = (status: PaymentLock['status']) => {
        switch (status) {
            case 'active': return 'bg-yellow-500';
            case 'completed': return 'bg-green-500';
            case 'expired': return 'bg-gray-500';
            default: return 'bg-gray-300';
        }
    }


    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <CardTitle>Payment Sessions</CardTitle>
                        <Badge variant="secondary">{totalSessions}</Badge>
                    </div>
                    <form onSubmit={handleSearch} className="flex items-center gap-2">
                        <Input name="search" placeholder="Search by Gaming ID or Product..." defaultValue={search} className="w-64" />
                        <Button type="submit" variant="outline" size="icon"><Search className="h-4 w-4" /></Button>
                    </form>
                </div>
                <CardDescription>
                    A log of every time a user has opened the payment QR code screen. You can manually approve payments here if needed.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {sessions.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">No payment sessions found.</p>
                ) : (
                    <div className="space-y-4">
                        {sessions.map(session => (
                            <div key={session._id.toString()} className="border p-4 rounded-lg space-y-2">
                                <div className="flex justify-between items-start">
                                    <div className="space-y-1">
                                        <p className="font-semibold">{session.productName}</p>
                                        <p className="text-sm font-mono text-muted-foreground">{session.gamingId}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {session.status !== 'completed' && (
                                             <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="outline" size="sm" disabled={isPending}>
                                                        <CheckCircle className="mr-2 h-4 w-4"/>
                                                        Approve Payment
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Manually Approve Payment?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            This will create an order for {session.gamingId} for the amount of ₹{session.amount.toFixed(2)}. Use this if an automatic verification failed. This cannot be undone.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleManualApprove(session._id.toString())}>
                                                            Confirm Approval
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        )}
                                         {session.status === 'active' && (
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                     <Button variant="destructive" size="sm" disabled={isPending}>
                                                        <ZapOff className="mr-2 h-4 w-4"/>
                                                        Force Expire
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            This will manually expire the payment session for {session.gamingId}. This cannot be undone.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleForceExpire(session._id.toString())}>
                                                            Confirm
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                         )}
                                         <Badge variant={getStatusVariant(session.status)} className={getStatusClass(session.status)}>
                                            {session.status}
                                        </Badge>
                                    </div>
                                </div>
                                <div className="text-sm text-muted-foreground flex justify-between items-center border-t pt-2">
                                    <p>Amount: <span className="font-bold font-sans text-foreground">₹{session.amount.toFixed(2)}</span></p>
                                    <p>Duration: <span className="font-semibold text-foreground">{calculateDuration(session.createdAt, session.expiresAt)}</span></p>
                                    <p>Created: <FormattedDate dateString={session.createdAt} /></p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
             {hasMore && (
                <CardFooter className="justify-center">
                    <Button onClick={handleLoadMore} disabled={isPending}>
                        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Load More
                    </Button>
                </CardFooter>
            )}
        </Card>
    );
}

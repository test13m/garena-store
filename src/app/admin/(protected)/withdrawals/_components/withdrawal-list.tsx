
'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, X, ArrowUpDown, Loader2 } from 'lucide-react';
import { updateWithdrawalStatus, getWithdrawalsForAdmin } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { type Withdrawal } from '@/lib/definitions';

interface WithdrawalListProps {
    initialWithdrawals: Withdrawal[];
    status: ('Pending' | 'Completed' | 'Failed')[];
    title: string;
    showActions?: boolean;
    initialHasMore: boolean;
}

const FormattedDate = ({ dateString }: { dateString: string }) => {
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    if (!mounted) {
        return null;
    }

    const date = new Date(dateString);
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
}

export default function WithdrawalList({ initialWithdrawals, status, title, showActions = false, initialHasMore }: WithdrawalListProps) {
    const [withdrawals, setWithdrawals] = useState<Withdrawal[]>(initialWithdrawals);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(initialHasMore);
    const [isPending, startTransition] = useTransition();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { toast } = useToast();
    
    const sort = searchParams.get('sort') || 'asc';
    
    useEffect(() => {
        setWithdrawals(initialWithdrawals);
        setHasMore(initialHasMore);
        setPage(1);
    }, [initialWithdrawals, initialHasMore]);


    const handleLoadMore = async () => {
        startTransition(async () => {
            const nextPage = page + 1;
            const { withdrawals: newWithdrawals, hasMore: newHasMore } = await getWithdrawalsForAdmin(nextPage, sort, status);
            setWithdrawals(prev => [...prev, ...newWithdrawals]);
            setHasMore(newHasMore);
            setPage(nextPage);
        });
    };

    const handleSortToggle = () => {
        const newSort = sort === 'asc' ? 'desc' : 'asc';
        const params = new URLSearchParams(searchParams);
        params.set('sort', newSort);
        router.push(`${pathname}?${params.toString()}`);
    }

    const handleAction = async (withdrawalId: string, newStatus: 'Completed' | 'Failed') => {
        startTransition(async () => {
            const result = await updateWithdrawalStatus(withdrawalId, newStatus);
            if (result.success) {
                setWithdrawals(prev => prev.filter(w => w._id !== withdrawalId));
                toast({ title: 'Success', description: `Withdrawal marked as ${newStatus}.` });
            } else {
                toast({ variant: 'destructive', title: 'Error', description: result.message || 'Failed to update status.' });
            }
        });
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <CardTitle>{title}</CardTitle>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" onClick={handleSortToggle}>
                                <ArrowUpDown className="mr-2 h-4 w-4" />
                                {sort === 'asc' ? 'Oldest First' : 'Newest First'}
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {withdrawals.length === 0 ? (
                        <p className="text-muted-foreground">No withdrawal requests to display.</p>
                    ) : (
                        <div className="space-y-4">
                            {withdrawals.map(w => (
                                <Card key={w._id}>
                                    <CardHeader>
                                        <div className="flex justify-between items-start">
                                            <CardTitle className="text-base">Withdrawal Request</CardTitle>
                                            <Badge variant={
                                                w.status === 'Completed' ? 'default' : 
                                                w.status === 'Pending' ? 'secondary' : 
                                                'destructive'
                                            }>{w.status}</Badge>
                                        </div>
                                        <CardDescription>
                                            Request Date: <FormattedDate dateString={w.createdAt} />
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                                            <p><strong>User:</strong> {w.username}</p>
                                            <p><strong>Amount:</strong> ${w.amount.toFixed(2)}</p>
                                            <p><strong>Method:</strong> {w.method}</p>
                                            <p><strong>Referral Code:</strong> {w.referralCode || 'N/A'}</p>
                                            {w.method === 'UPI' && <p className="sm:col-span-2"><strong>UPI ID:</strong> {w.details.upiId}</p>}
                                            {w.method === 'Bank' && (
                                                <>
                                                    <p><strong>Bank:</strong> {w.details.bankName}</p>
                                                    <p><strong>Account #:</strong> {w.details.accountNumber}</p>
                                                    <p><strong>IFSC:</strong> {w.details.ifscCode}</p>
                                                </>
                                            )}
                                        </div>
                                    </CardContent>
                                    {showActions && (
                                        <CardFooter className="flex justify-end gap-2">
                                            <Button variant="outline" size="icon" onClick={() => handleAction(w._id, 'Failed')} disabled={isPending}>
                                                <X className="h-4 w-4" />
                                            </Button>
                                            <Button size="icon" onClick={() => handleAction(w._id, 'Completed')} disabled={isPending}>
                                                <Check className="h-4 w-4" />
                                            </Button>
                                        </CardFooter>
                                    )}
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

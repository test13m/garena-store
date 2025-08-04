'use client';

import { useState, useTransition } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Order } from '@/lib/definitions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, X, ArrowUpDown, Loader2, Search } from 'lucide-react';
import { updateOrderStatus, getOrdersForAdmin } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';

interface OrderListProps {
    initialOrders: Order[];
    status: ('Pending UTR' | 'Processing' | 'Completed' | 'Failed')[];
    title: string;
    showActions?: boolean;
    initialHasMore: boolean;
}

export function OrderList({ initialOrders, status, title, showActions = false, initialHasMore }: OrderListProps) {
    const [orders, setOrders] = useState<Order[]>(initialOrders);
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
            const { orders: newOrders, hasMore: newHasMore } = await getOrdersForAdmin(nextPage, sort, search, status);
            setOrders(prev => [...prev, ...newOrders]);
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
    }

    const handleSearch = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const searchQuery = formData.get('search') as string;
        const params = new URLSearchParams(searchParams);
        params.set('search', searchQuery);
        params.delete('page');
        router.push(`${pathname}?${params.toString()}`);
    };

    const handleAction = async (orderId: string, newStatus: 'Completed' | 'Failed') => {
        startTransition(async () => {
            const result = await updateOrderStatus(orderId, newStatus);
            if (result.success) {
                setOrders(prev => prev.filter(order => order._id.toString() !== orderId));
                toast({ title: 'Success', description: `Order marked as ${newStatus}.` });
            } else {
                toast({ variant: 'destructive', title: 'Error', description: 'Failed to update order status.' });
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
                    {orders.length === 0 ? (
                        <p className="text-muted-foreground">No orders to display.</p>
                    ) : (
                        <div className="space-y-4">
                            {orders.map(order => (
                                <Card key={order._id.toString()}>
                                    <CardHeader>
                                        <div className="flex justify-between items-start">
                                            <CardTitle className="text-base">{order.productName}</CardTitle>
                                            <Badge variant={
                                                order.status === 'Completed' ? 'default' : 
                                                order.status === 'Processing' || order.status === 'Pending UTR' ? 'secondary' : 
                                                'destructive'
                                            }>{order.status}</Badge>
                                        </div>
                                        <CardDescription>
                                            Order Date: {new Date(order.createdAt).toLocaleString()}
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                                            <p><strong>Gaming ID:</strong> {order.gamingId}</p>
                                            <p><strong>Payment Method:</strong> {order.paymentMethod}</p>
                                            {order.utr && <p><strong>UTR:</strong> {order.utr}</p>}
                                            {order.redeemCode && <p><strong>Redeem Code:</strong> {order.redeemCode}</p>}
                                            {order.referralCode && <p><strong>Referral Code:</strong> {order.referralCode}</p>}
                                        </div>
                                    </CardContent>
                                    {showActions && (
                                        <CardFooter className="flex justify-end gap-2">
                                            <Button variant="outline" size="icon" onClick={() => handleAction(order._id.toString(), 'Failed')} disabled={isPending}>
                                                <X className="h-4 w-4" />
                                            </Button>
                                            <Button size="icon" onClick={() => handleAction(order._id.toString(), 'Completed')} disabled={isPending}>
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


'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, X, ArrowUpDown, Loader2, Search, Coins } from 'lucide-react';
import { updateOrderStatus, getOrdersForAdmin } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';

type ClientOrder = {
    _id: string;
    productName: string;
    status: string;
    createdAt: string;
    gamingId: string;
    paymentMethod: string;
    utr?: string;
    redeemCode?: string;
    referredBy?: string;
    productPrice: number;
    coinsUsed: number;
    finalPrice: number;
};

interface OrderListProps {
    initialOrders: ClientOrder[];
    status: ('Processing' | 'Completed' | 'Failed')[];
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

export function OrderList({ initialOrders, status, title, showActions = false, initialHasMore }: OrderListProps) {
    const [orders, setOrders] = useState<ClientOrder[]>(initialOrders);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(initialHasMore);
    const [isPending, startTransition] = useTransition();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { toast } = useToast();
    
    const sort = searchParams.get('sort') || 'asc';
    const search = searchParams.get('search') || '';

    useEffect(() => {
        setOrders(initialOrders);
        setHasMore(initialHasMore);
        setPage(1);
    }, [initialOrders, initialHasMore]);

    const handleLoadMore = async () => {
        startTransition(async () => {
            const nextPage = page + 1;
            const { orders: newOrders, hasMore: newHasMore } = await getOrdersForAdmin(nextPage, sort, search, status);
            setOrders(prev => [...prev, ...newOrders]);
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
                                <Input name="search" placeholder="Search by Gaming/Referrer ID..." defaultValue={searchParams.get('search') || ''} className="w-56"/>
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
                                <Card key={order._id}>
                                    <CardHeader>
                                        <div className="flex justify-between items-start">
                                            <CardTitle className="text-base">{order.productName}</CardTitle>
                                            <Badge variant={
                                                order.status === 'Completed' ? 'default' : 
                                                order.status === 'Processing' ? 'secondary' : 
                                                'destructive'
                                            }>{order.status}</Badge>
                                        </div>
                                        <CardDescription>
                                            Order Date: <FormattedDate dateString={order.createdAt} />
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                                            <p><strong>Gaming ID:</strong> {order.gamingId}</p>
                                            <p><strong>Payment Method:</strong> {order.paymentMethod}</p>
                                            {order.utr && <p><strong>UTR:</strong> {order.utr}</p>}
                                            {order.redeemCode && <p><strong>Redeem Code:</strong> {order.redeemCode}</p>}
                                            {order.referredBy && <p><strong>Referred By:</strong> {order.referredBy}</p>}
                                            <p><strong>Original Price:</strong> ₹{order.productPrice}</p>
                                            <p className="flex items-center gap-1"><strong><Coins className="w-4 h-4 text-amber-500" /> Used:</strong> {order.coinsUsed}</p>
                                            <p className="font-bold"><strong>Final Price Paid:</strong> ₹{order.finalPrice}</p>
                                        </div>
                                    </CardContent>
                                    {showActions && (
                                        <CardFooter className="flex justify-end gap-2">
                                            <Button variant="outline" size="icon" onClick={() => handleAction(order._id, 'Failed')} disabled={isPending}>
                                                <X className="h-4 w-4" />
                                            </Button>
                                            <Button size="icon" onClick={() => handleAction(order._id, 'Completed')} disabled={isPending}>
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

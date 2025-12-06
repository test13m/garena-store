
'use client';

import { getOrdersForUser, getUserData } from '@/app/actions';
import { Order, User } from '@/lib/definitions';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { AlertCircle, RotateCcw, Coins, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import ProductMedia from '@/components/product-media';


const FormattedDate = ({ dateString }: { dateString: string }) => {
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    if (!mounted) {
        return null; // Don't render on the server
    }

    try {
        const date = new Date(dateString);
         // Using en-IN locale for India and Asia/Kolkata timezone
        return date.toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric',
        });
    } catch (error) {
        return dateString; // Fallback to original string if date is invalid
    }
}


export default function OrderPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchInitialData = async () => {
      setIsLoading(true);
      const userData = await getUserData();
      setUser(userData);
      if (userData) {
        const userOrders = await getOrdersForUser();
        setOrders(userOrders);
      }
      setIsLoading(false);
    };
    fetchInitialData();
  }, []);

  if (isLoading) {
    return (
        <div className="container mx-auto px-4 py-16 text-center flex justify-center items-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl md:text-5xl font-bold font-headline text-primary text-center flex-grow">
          Your Orders
        </h1>
        <Button asChild variant="outline">
          <Link href="/refund-request">
            <RotateCcw className="mr-2 h-4 w-4" />
            Request a Refund
          </Link>
        </Button>
      </div>

      {!user ? (
        <Card className="max-w-2xl mx-auto text-center py-12">
            <CardHeader>
                <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <h2 className="text-2xl font-semibold mb-2">No User Found</h2>
                <p className="text-muted-foreground mb-4">Please register your Gaming ID on the homepage to view your orders.</p>
                <Button asChild><Link href="/">Go to Homepage</Link></Button>
            </CardContent>
        </Card>
      ) : orders.length === 0 ? (
        <Card className="max-w-2xl mx-auto text-center py-12">
           <CardHeader>
            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <h2 className="text-2xl font-semibold mb-2">No Orders Yet</h2>
            <p className="text-muted-foreground">You haven't placed any orders. Start shopping to see your orders here!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {orders.map((order) => {
            const fee = order.finalPrice - order.productPrice + order.coinsUsed;
            const feeIsApplied = fee > 0.001; // Use a small epsilon for float comparison

            return (
              <Card key={order._id.toString()} className="flex flex-col overflow-hidden">
                 <CardHeader className="flex flex-row items-start justify-between gap-4 p-4">
                   <div className="flex-grow">
                      <CardTitle className="text-lg leading-tight">{order.productName}</CardTitle>
                      <CardDescription className="text-sm mt-1">Gaming ID: {user.visualGamingId || order.gamingId}</CardDescription>
                   </div>
                   <Badge 
                      variant={
                          order.status === 'Completed' ? 'default' : 
                          order.status === 'Processing' ? 'secondary' : 
                          'destructive'
                      }
                      className={cn(order.status === 'Completed' && 'bg-green-500/80 text-white')}
                  >
                      {order.status}
                  </Badge>
                </CardHeader>
                <CardContent className="p-4 flex-grow">
                  <div className="relative aspect-video w-full rounded-md overflow-hidden">
                      <ProductMedia src={order.productImageUrl} alt={order.productName} />
                  </div>
                   <div className="mt-4 space-y-1 text-sm">
                      <div className="flex justify-between">
                          <span className="text-muted-foreground">Original Price:</span>
                          <span className="font-medium font-sans">₹{order.productPrice}</span>
                      </div>
                      <div className="flex justify-between text-amber-600">
                          <span className="font-medium flex items-center gap-1"><Coins className="w-4 h-4"/>Coins Used:</span>
                          <span className="font-medium font-sans">- ₹{order.coinsUsed}</span>
                      </div>
                       <div className="flex justify-between font-bold text-base font-sans border-t pt-1 mt-1">
                          <span>Final Price:</span>
                          <span>₹{order.finalPrice}</span>
                      </div>
                       {feeIsApplied && (
                        <div className="text-right text-xs text-muted-foreground font-sans">
                            (incl. ₹{fee.toFixed(2)} Processing & Tax Fee)
                        </div>
                       )}
                   </div>
                </CardContent>
                <CardFooter className="bg-muted/40 p-4 text-sm text-muted-foreground flex justify-between items-center">
                  <span><FormattedDate dateString={order.createdAt as unknown as string} /></span>
                   <Button asChild variant="link" className="p-0 h-auto">
                      <Link href="/refund-request">
                        Request a Refund
                      </Link>
                    </Button>
                </CardFooter>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  );
}







'use client';

import Image from 'next/image';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { useState, useEffect } from 'react';
import PurchaseModal from './purchase-modal';
import type { Product, User, UserProductControl, Order } from '@/lib/definitions';
import { Ban, Coins, Timer, CheckCircle2, Lock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { type ObjectId } from 'mongodb';


interface ProductCardProps {
  product: Product & { _id: string | ObjectId };
  user: User | null;
  orders: Order[];
  control: UserProductControl | undefined;
}

const CountdownTimer = ({ endDate, isComingSoon }: { endDate: Date; isComingSoon?: boolean }) => {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const timer = setInterval(() => {
      const now = new Date();
      const difference = new Date(endDate).getTime() - now.getTime();

      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60),
        });
      } else {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [endDate]);
  
  if (!isMounted) {
    return null;
  }

  const { days, hours, minutes, seconds } = timeLeft;

  const hasEnded = days === 0 && hours === 0 && minutes === 0 && seconds === 0;

  const timerLabel = isComingSoon ? "Coming Soon in:" : "Ending soon:";
  const timerColor = isComingSoon ? "text-teal-600 border-teal-500/20" : "text-destructive border-destructive/20";
  const finishedLabel = isComingSoon ? "Available Now" : "Ended";
  const finishedColor = "text-muted-foreground border-muted-foreground/20";


  return (
    <div className={cn(
        "absolute top-2 right-2 bg-background/80 backdrop-blur-sm font-bold text-xs px-2 py-1 rounded-full shadow-md flex items-center gap-1.5 border",
        hasEnded ? finishedColor : timerColor
      )}>
        <Timer className="w-3.5 h-3.5" />
        {hasEnded ? (
            <span>{finishedLabel}</span>
        ) : (
            <>
                <span>{timerLabel}</span>
                <div className="flex items-center gap-1 font-mono tracking-tighter">
                    {days > 0 && <span>{String(days).padStart(2, '0')}d</span>}
                    <span>{String(hours).padStart(2, '0')}h</span>
                    <span>{String(minutes).padStart(2, '0')}m</span>
                    <span>{String(seconds).padStart(2, '0')}s</span>
                </div>
            </>
        )}
       
    </div>
  );
};


export default function ProductCard({ product, user, orders, control }: ProductCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { toast } = useToast();

  const finalPrice = product.isCoinProduct 
    ? product.purchasePrice || product.price 
    : product.price - (product.coinsApplicable || 0);

  const handleBuyClick = () => {
    if (!user) {
        toast({
            variant: 'destructive',
            title: 'Please Register',
            description: 'You need to enter your Gaming ID to make a purchase.',
        });
        return;
    }
    setIsModalOpen(true);
  }

  const productWithStrId = { ...product, _id: product._id.toString() };
  
  const getBuyButton = () => {
    const isEventActive = product.endDate && new Date(product.endDate) > new Date();

    if (product.isComingSoon && isEventActive) {
        return <Button className="w-full font-bold text-base" disabled variant="secondary"><Timer className="mr-2 h-4 w-4" />Coming Soon</Button>;
    }
    
    if (!product.isComingSoon && isEventActive === false && !product.isAvailable) {
       return <Button className="w-full font-bold text-base" disabled variant="secondary"><Ban className="mr-2 h-4 w-4" />Expired</Button>;
    }
    
    if (!product.isAvailable) {
      return <Button className="w-full font-bold text-base" disabled variant="secondary"><Ban className="mr-2 h-4 w-4" />Item Unavailable</Button>;
    }

    if (control?.type === 'block') {
      return <Button className="w-full font-bold text-base" disabled variant="secondary"><Ban className="mr-2 h-4 w-4" />{control.blockReason}</Button>;
    }

    const nonFailedOrders = orders.filter(o => o.status !== 'Failed' && o.productId === product._id.toString());
    const completedPurchases = orders.filter(o => o.status === 'Completed' && o.productId === product._id.toString()).length;

    // Rule 3: `limitPurchase` is the ultimate authority
    if (control?.type === 'limitPurchase' && control.limitCount && nonFailedOrders.length >= control.limitCount) {
        return <Button className="w-full font-bold text-base" disabled variant="secondary"><Lock className="mr-2 h-4 w-4" />Purchase Limit Reached</Button>;
    }
    
    // Rule 1: Strict check for "one-time purchase" items
    if (product.oneTimeBuy) {
        const allowance = control?.type === 'allowPurchase' ? (control.allowanceCount || 0) : 0;
        const totalAllowed = 1 + allowance;
        if (nonFailedOrders.length >= totalAllowed) {
            return <Button className="w-full font-bold text-base" disabled variant="secondary"><CheckCircle2 className="mr-2 h-4 w-4" />Already Purchased</Button>;
        }
    }

    return (
        <Button 
          className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-bold text-base transition-transform duration-200 hover:scale-105 font-sans relative overflow-hidden animate-glowing-ray"
          onClick={handleBuyClick}
        >
          Buy {product.price && <span className="line-through ml-2 text-accent-foreground/80">₹{product.price}</span>} <span className="ml-1">₹{finalPrice}</span>
        </Button>
    );
  }

  return (
    <>
      <Card className="flex flex-col overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
        <CardHeader className="p-0">
          <div className="relative aspect-video">
            <Image src={product.imageUrl} alt={product.name} fill className="object-cover" data-ai-hint={product.dataAiHint}/>
            {product.endDate && <CountdownTimer endDate={new Date(product.endDate)} isComingSoon={product.isComingSoon} />}
          </div>
        </CardHeader>
        <CardContent className="flex-grow p-4">
          <CardTitle className="text-lg font-headline font-semibold">{product.name}</CardTitle>
          <CardDescription className="text-sm">
            Quantity: {product.quantity}
          </CardDescription>
          {product.coinsApplicable > 0 && !product.isCoinProduct && (
            <div className="text-xs text-amber-600 font-semibold mt-1 flex items-center font-sans gap-1">
              <Coins className="w-3 h-3" />
              Use {product.coinsApplicable} Coins & Get it for ₹{finalPrice}
            </div>
          )}
        </CardContent>
        <CardFooter className="p-4 pt-0">
          {getBuyButton()}
        </CardFooter>
      </Card>
      {isModalOpen && <PurchaseModal product={productWithStrId} user={user} onClose={() => setIsModalOpen(false)} />}
    </>
  );
}

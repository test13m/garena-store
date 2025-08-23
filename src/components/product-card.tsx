
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
import type { Product, User } from '@/lib/definitions';
import { Ban, Coins, Timer } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { type ObjectId } from 'mongodb';


interface ProductCardProps {
  product: Product & { _id: string | ObjectId }; // Allow string for serialized product
  user: User | null;
}

const CountdownTimer = ({ endDate }: { endDate: Date }) => {
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

  return (
    <div className={cn(
        "absolute top-2 right-2 bg-background/80 backdrop-blur-sm text-destructive font-bold text-xs px-2 py-1 rounded-full shadow-md flex items-center gap-1.5 border border-destructive/20",
        hasEnded && "text-muted-foreground border-muted-foreground/20"
      )}>
        <Timer className="w-3.5 h-3.5" />
        {hasEnded ? (
            <span>Ended</span>
        ) : (
            <>
                <span>Ending soon:</span>
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


export default function ProductCard({ product, user }: ProductCardProps) {
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
        // This relies on a global modal system or state, which is complex.
        // A simpler approach is to let the user see the modal and handle it there.
    }
    setIsModalOpen(true);
  }

  // Ensure product has a string ID for the PurchaseModal
  const productWithStrId = { ...product, _id: product._id.toString() };

  return (
    <>
      <Card className="flex flex-col overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
        <CardHeader className="p-0">
          <div className="relative aspect-video">
            <Image src={product.imageUrl} alt={product.name} fill className="object-cover" data-ai-hint={product.dataAiHint}/>
            {product.endDate && <CountdownTimer endDate={new Date(product.endDate)} />}
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
          {product.isAvailable ? (
            <Button 
              className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-bold text-base transition-transform duration-200 hover:scale-105 font-sans relative overflow-hidden animate-glowing-ray"
              onClick={handleBuyClick}
            >
              Buy {product.price && <span className="line-through ml-2 text-accent-foreground/80">₹{product.price}</span>} <span className="ml-1">₹{finalPrice}</span>
            </Button>
          ) : (
            <Button 
              className="w-full font-bold text-base"
              disabled
              variant="secondary"
            >
              <Ban className="mr-2 h-4 w-4" />
              Item Unavailable
            </Button>
          )}
        </CardFooter>
      </Card>
      {isModalOpen && <PurchaseModal product={productWithStrId} user={user} onClose={() => setIsModalOpen(false)} />}
    </>
  );
}

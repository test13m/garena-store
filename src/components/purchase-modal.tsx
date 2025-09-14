

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import type { Product, User } from '@/lib/definitions';
import { Loader2, X, Smartphone, Globe, Coins } from 'lucide-react';
import Image from 'next/image';
import { createRedeemCodeOrder, registerGamingId as registerAction, createRazorpayOrder } from '@/app/actions';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import Link from 'next/link';

// The product passed to this modal has its _id serialized to a string
interface ProductWithStringId extends Omit<Product, '_id'> {
  _id: string;
}

interface PurchaseModalProps {
  product: ProductWithStringId;
  user: User | null;
  onClose: () => void;
}

type ModalStep = 'register' | 'details' | 'processing' | 'qrPayment';

export default function PurchaseModal({ product, user: initialUser, onClose }: PurchaseModalProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [user, setUser] = useState<User | null>(initialUser);
  const [step, setStep] = useState<ModalStep>(initialUser ? 'details' : 'register');
  const [gamingId, setGamingId] = useState(initialUser?.gamingId || '');
  const [redeemCode, setRedeemCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [paymentDetails, setPaymentDetails] = useState<{qrImageUrl: string; paymentLinkUrl: string} | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setTimeout(onClose, 300); // Allow for closing animation
  }, [onClose]);

  useEffect(() => {
    // If the modal is open, and a user gets passed in (e.g. after registration), move to details
    if (isOpen && initialUser && step === 'register') {
      setUser(initialUser);
      setGamingId(initialUser.gamingId);
      setStep('details');
    }
  }, [initialUser, isOpen, step]);

  const handleRegister = async () => {
    if (!gamingId) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please enter your Gaming ID.' });
      return;
    }
    setIsLoading(true);
    const result = await registerAction(gamingId);
    if (result.success && result.user) {
        toast({ title: 'Success', description: result.message });
        window.location.reload();
    } else {
        toast({ variant: 'destructive', title: 'Error', description: result.message });
        setIsLoading(false);
    }
  };

  const coinsToUse = user && !product.isCoinProduct ? Math.min(user.coins, product.coinsApplicable || 0) : 0;
  const finalPrice = product.isCoinProduct 
    ? product.purchasePrice || product.price 
    : product.price - coinsToUse;

  const handleBuyWithUpi = async () => {
    setIsLoading(true);
    
    if (!user) {
        toast({ variant: 'destructive', title: 'Error', description: 'User not found.'});
        setIsLoading(false);
        return;
    }

    const result = await createRazorpayOrder(finalPrice, user.gamingId, product._id);

    if (result.success && result.qrImageUrl && result.paymentLinkUrl) {
        setPaymentDetails({ qrImageUrl: result.qrImageUrl, paymentLinkUrl: result.paymentLinkUrl });
        setStep('qrPayment');
    } else {
        toast({ variant: 'destructive', title: 'Payment Error', description: result.error || 'Could not create payment details.' });
    }
    setIsLoading(false);
  };


  const handleRedeemSubmit = async () => {
    if (!user) {
        toast({ variant: 'destructive', title: 'Error', description: 'User not found.' });
        return;
    }
    if (!redeemCode) {
        toast({ variant: 'destructive', title: 'Error', description: 'Please enter your redeem code.' });
        return;
    }
    setIsLoading(true);
    const result = await createRedeemCodeOrder(product, user.gamingId, redeemCode, user);
    if (result.success) {
        setStep('processing');
    } else {
        toast({ variant: 'destructive', title: 'Error', description: result.message });
    }
    setIsLoading(false);
  }
  
  const renderContent = () => {
    switch (step) {
      case 'register':
        return (
             <>
                <DialogHeader>
                    <DialogTitle className="text-2xl font-headline">Welcome to Garena Store</DialogTitle>
                    <DialogDescription>Please enter your Gaming ID to continue.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                    <div className="space-y-2">
                        <Label htmlFor="gaming-id-register">Gaming ID</Label>
                        <Input id="gaming-id-register" placeholder="Your in-game user ID" value={gamingId} onChange={e => setGamingId(e.target.value.replace(/\D/g, ''))} type="tel" pattern="[0-9]*" />
                    </div>
                    <Button onClick={handleRegister} className="w-full" disabled={isLoading}>
                        {isLoading ? <Loader2 className="animate-spin" /> : 'Register & Continue'}
                    </Button>
                </div>
            </>
        )
      case 'details':
        if (!user) return null; // Should not happen if step is 'details'
        return (
          <>
            <DialogHeader>
                <div className="flex items-center gap-2 mb-4">
                    <Image src="/img/garena.png" alt="Garena Logo" width={28} height={28} />
                    <DialogTitle className="text-2xl font-headline">Confirm Purchase</DialogTitle>
                </div>
            </DialogHeader>
            <div className="space-y-6">
                <div className="flex items-center gap-4 p-4 rounded-lg bg-muted">
                    <div className="relative w-24 h-24 rounded-md overflow-hidden">
                        <Image src={product.imageUrl} alt={product.name} fill className="object-cover"/>
                    </div>
                    <div>
                        <h3 className="font-semibold">{product.name}</h3>
                        {!product.isCoinProduct && <p className="text-sm text-muted-foreground line-through font-sans">Original Price: ₹{product.price}</p>}
                        {coinsToUse > 0 && !product.isCoinProduct && <p className="text-sm text-amber-600 flex items-center font-sans gap-1"><Coins className="w-4 h-4"/> Coins Applied: -₹{coinsToUse}</p>}
                        {product.isCoinProduct && <p className="text-sm text-muted-foreground line-through font-sans">Original Price: ₹{product.price}</p>}
                        <p className="text-2xl font-bold text-primary font-sans">Final Price: ₹{finalPrice}</p>
                    </div>
                </div>
                 <div className="space-y-2">
                  <Label htmlFor="server">Server</Label>
                  <Select defaultValue="india" onValueChange={(value) => {
                    if (value !== 'india') {
                      toast({
                        variant: 'default',
                        title: 'Server Information',
                        description: 'Only the India server is supported at this time.',
                      })
                    }
                  }}>
                    <SelectTrigger id="server" className="w-full">
                      <SelectValue placeholder="Select a server" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="india">
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4" />
                          India
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="gaming-id">Gaming ID</Label>
                    <Input id="gaming-id" value={user.gamingId} readOnly disabled />
                </div>
                <div className="space-y-2">
                   <Button onClick={handleBuyWithUpi} className="w-full font-sans" disabled={isLoading}>
                    {isLoading ? <Loader2 className="animate-spin" /> : `Pay ₹${finalPrice} via UPI`}
                    </Button>
                    {!product.onlyUpi && (
                         <Dialog>
                            <DialogTrigger asChild>
                                <Button className="w-full font-sans" variant="secondary" disabled={isLoading}>
                                    {isLoading ? <Loader2 className="animate-spin" /> : `Use Redeem Code`}
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle className="text-2xl font-headline">Use Redeem Code</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="redeem-code">Enter your Redeem Code</Label>
                                        <Input id="redeem-code" placeholder="XXXX-XXXX-XXXX" value={redeemCode} onChange={e => setRedeemCode(e.target.value)} />
                                    </div>
                                    <Button onClick={handleRedeemSubmit} className="w-full" disabled={isLoading}>
                                        {isLoading ? <Loader2 className="animate-spin" /> : `Submit Code & Buy`}
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                    )}
                </div>
                <p className="text-xs text-muted-foreground text-center mt-2">
                    By continuing, you accept our{' '}
                    <Link href="/terms" className="underline hover:text-primary" onClick={handleClose}>
                        Terms & Conditions
                    </Link>
                    .
                </p>
            </div>
          </>
        );
    case 'processing':
        return (
            <div className="flex flex-col items-center justify-center text-center space-y-4 py-8">
                <Loader2 className="w-12 h-12 text-primary animate-spin" />
                <h2 className="text-2xl font-headline">Order Under Processing</h2>
                <p className="text-muted-foreground">Your order has been received and is now being processed. This usually takes just a few moments.</p>
                <p>You can track the status of your order on the "Order" page.</p>
                <Button asChild onClick={handleClose}><Link href="/order">Go to Orders Page</Link></Button>
            </div>
        );
    case 'qrPayment':
        if (!paymentDetails) return null;
        return (
            <>
                <DialogHeader>
                    <div className="flex items-center justify-center gap-2 mb-2">
                        <Image src="/img/garena.png" alt="Garena Logo" width={28} height={28} />
                        <DialogTitle className="text-2xl font-headline">Garena Store</DialogTitle>
                    </div>
                    <DialogDescription className="text-center">Scan the QR code to complete your payment.</DialogDescription>
                </DialogHeader>
                <div className="flex flex-col items-center justify-center space-y-4 py-4">
                    <p className="text-3xl font-bold text-primary font-sans">Pay: ₹{finalPrice}</p>
                    <div className="p-4 bg-white rounded-lg border w-52 h-52 relative overflow-hidden">
                         <Image src={paymentDetails.qrImageUrl} alt="UPI QR Code" layout="fill" className="object-cover" objectPosition="center"/>
                    </div>
                    <p className="text-sm text-muted-foreground">Waiting for payment confirmation...</p>
                    <div className="w-full border-t pt-4">
                         <Button asChild className="w-full">
                            <a href={paymentDetails.paymentLinkUrl} target="_blank" rel="noopener noreferrer">
                                <Smartphone className="mr-2" /> Pay with UPI app
                            </a>
                        </Button>
                    </div>
                </div>
            </>
        )
      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <button onClick={handleClose} className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>
        {renderContent()}
      </DialogContent>
    </Dialog>
  );
}


'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { registerGamingId } from '@/app/actions';
import { Loader2, ShieldAlert, Mail } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Alert, AlertTitle, AlertDescription } from './ui/alert';

interface GamingIdModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}


export default function GamingIdModal({ isOpen, onOpenChange }: GamingIdModalProps) {
  const [gamingId, setGamingId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [bannedInfo, setBannedInfo] = useState<{ message: string } | null>(null);
  const { toast } = useToast();
  const router = useRouter();


  const handleRegister = async () => {
    if (!gamingId) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please enter your Gaming ID.' });
      return;
    }
    setIsLoading(true);
    setBannedInfo(null);
    const result = await registerGamingId(gamingId);
    if (result.success && result.user) {
      toast({
        title: 'Welcome!',
        description: result.message,
      });
      onOpenChange(false);
      router.refresh(); 
    } else if (result.isBanned) {
      setBannedInfo({ message: result.banMessage || 'Your account has been suspended.' });
    } else {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: result.message,
      });
    }
    setIsLoading(false);
  };
  
  const handleUnbanRequest = () => {
    const recipient = 'sm187966@gmail.com';
    const subject = `Unban Request - Gaming ID: ${gamingId}`;
    const body = `
Dear Garena Support,

I am writing to request that my account be unbanned.

My Gaming ID is: ${gamingId}

Reason for request:


Thank you for your consideration.
    `;
    const mailtoLink = `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoLink;
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    // Only allow digits by replacing any non-digit character with an empty string
    const digitsOnly = value.replace(/\D/g, '');
    setGamingId(digitsOnly);
  };
  
  const handleOpenChangeWithReset = (open: boolean) => {
    if (!open) {
        setBannedInfo(null);
        setGamingId('');
    }
    onOpenChange(open);
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChangeWithReset}>
      <DialogContent className="sm:max-w-md">
        {bannedInfo ? (
            <>
                <DialogHeader>
                    <DialogTitle className="text-2xl font-headline flex items-center gap-2"><ShieldAlert className="text-destructive"/> Account Suspended</DialogTitle>
                </DialogHeader>
                 <Alert variant="destructive">
                    <AlertTitle>Access Denied</AlertTitle>
                    <AlertDescription>
                        {bannedInfo.message}
                    </AlertDescription>
                </Alert>
                <DialogFooter>
                    <Button onClick={handleUnbanRequest} variant="outline" className="w-full">
                        <Mail className="mr-2"/>
                        Request Unban
                    </Button>
                </DialogFooter>
            </>
        ) : (
             <>
                <DialogHeader>
                <DialogTitle className="text-2xl font-headline">Welcome to Garena Store</DialogTitle>
                <DialogDescription>
                    Please enter your Free Fire Gaming ID to get started and receive your welcome bonus!
                </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                <div className="space-y-2">
                    <Label htmlFor="gaming-id-register">Gaming ID</Label>
                    <Input
                    id="gaming-id-register"
                    placeholder="Your in-game user ID"
                    value={gamingId}
                    onChange={handleInputChange}
                    disabled={isLoading}
                    type="tel"
                    pattern="[0-9]*"
                    />
                </div>
                <Button onClick={handleRegister} className="w-full" disabled={isLoading}>
                    {isLoading ? <Loader2 className="animate-spin" /> : 'Continue & Get 800 Coins'}
                </Button>
                </div>
            </>
        )}
      </DialogContent>
    </Dialog>
  );
}


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
import { useIsMobile } from '@/hooks/use-mobile';
import WelcomeAnimation from './welcome-animation';
import { cn } from '@/lib/utils';

interface GamingIdModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}


export default function GamingIdModal({ isOpen, onOpenChange }: GamingIdModalProps) {
  const [gamingId, setGamingId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [bannedInfo, setBannedInfo] = useState<{ message: string } | null>(null);
  const [registrationSuccess, setRegistrationSuccess] = useState<{coins?: number} | null>(null);
  const [isShifted, setIsShifted] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const isMobile = useIsMobile();


  const handleRegister = async () => {
    if (gamingId.length < 8 || gamingId.length > 11) {
      toast({
        variant: 'destructive',
        title: 'Invalid Gaming ID',
        description: 'Your Gaming ID must be between 8 and 11 digits.',
      });
      return;
    }
    setIsLoading(true);
    setBannedInfo(null);
    const result = await registerGamingId(gamingId);
    
    toast({
      title: result.success ? 'Success' : 'Error',
      description: result.message,
      variant: result.success ? 'default' : 'destructive',
    });

    if (result.success && result.user) {
      onOpenChange(false);
      // Check if it's a new registration by looking at the welcome message
      if (result.message.includes('800 coins')) {
        setRegistrationSuccess({ coins: 800 });
      } else {
        // For returning users, show animation without coins
        setRegistrationSuccess({});
      }
    } else if (result.isBanned) {
      setBannedInfo({ message: result.banMessage || 'Your account has been suspended.' });
      setIsLoading(false);
    } else {
      setIsLoading(false);
    }
  };
  
  const handleUnbanRequest = () => {
    const recipient = 'garenaffmaxstore@gmail.com';
    const subject = `Unban Request - Gaming ID: ${gamingId}`;
    const body = `
Dear Garena Support,

I am writing to request that my account be unbanned.

My Gaming ID is: ${gamingId}

Reason for request:


Thank you for your consideration.
    `;
    if (isMobile) {
      const mailtoLink = `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      window.location.href = mailtoLink;
    } else {
      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${recipient}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      window.open(gmailUrl, '_blank');
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    // Only allow digits by replacing any non-digit character with an empty string
    const digitsOnly = value.replace(/\D/g, '');
    setGamingId(digitsOnly);
    if (isMobile) {
      setIsShifted(digitsOnly.length > 0);
    }
  };
  
  const handleOpenChangeWithReset = (open: boolean) => {
    if (!open) {
        setBannedInfo(null);
        setGamingId('');
        setIsShifted(false);
    }
    onOpenChange(open);
  }

  if (registrationSuccess) {
    return <WelcomeAnimation coins={registrationSuccess.coins} />;
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChangeWithReset}>
      <DialogContent
        className={cn(
          'sm:max-w-md transition-all duration-300 ease-in-out',
          isMobile && isShifted && 'top-[41%]'
        )}
      >
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
                    minLength={8}
                    maxLength={11}
                    />
                </div>
                <Button onClick={handleRegister} className="w-full" disabled={isLoading}>
                    {isLoading ? <Loader2 className="animate-spin" /> : 'Continue & get 800 coins'}
                </Button>
                </div>
            </>
        )}
      </DialogContent>
    </Dialog>
  );
}

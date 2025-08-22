'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { registerGamingId } from '@/app/actions';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface GamingIdModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}


export default function GamingIdModal({ isOpen, onOpenChange }: GamingIdModalProps) {
  const [gamingId, setGamingId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const handleRegister = async () => {
    if (!gamingId) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please enter your Gaming ID.' });
      return;
    }
    setIsLoading(true);
    const result = await registerGamingId(gamingId);
    if (result.success) {
      toast({
        title: 'Welcome!',
        description: result.message,
      });
      onOpenChange(false);
      router.refresh(); // Refresh the page to get the new user state
    } else {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: result.message,
      });
    }
    setIsLoading(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
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
              onChange={(e) => setGamingId(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <Button onClick={handleRegister} className="w-full" disabled={isLoading}>
            {isLoading ? <Loader2 className="animate-spin" /> : 'Continue & Get 800 Coins'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

'use client';

import { useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { verifyAdminPassword } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? 'Verifying...' : 'Login'}
    </Button>
  );
}

export default function LoginForm() {
  const { toast } = useToast();
  const router = useRouter();
  const [state, formAction] = useActionState(verifyAdminPassword, { message: '', success: false });

  useEffect(() => {
    if (state?.message && !state.success) {
      toast({
          variant: 'destructive',
          title: 'Login Failed',
          description: state.message
      })
    }
     if (state?.success) {
      router.push('/admin');
    }
  }, [state, toast, router]);


  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" required />
      </div>
      <div>
        <SubmitButton />
      </div>
    </form>
  );
}

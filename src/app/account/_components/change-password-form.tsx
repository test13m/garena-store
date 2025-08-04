'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { changePassword } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? 'Updating...' : 'Update Password'}
    </Button>
  );
}

export default function ChangePasswordForm() {
  const initialState = { message: '', success: false };
  const [state, dispatch] = useActionState(changePassword, initialState);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);


  useEffect(() => {
    if (state.message) {
      toast({
        variant: state.success ? 'default' : 'destructive',
        title: state.success ? 'Success' : 'Error',
        description: state.message,
      });
      if (state.success) {
        formRef.current?.reset();
      }
    }
  }, [state, toast]);

  return (
    <form ref={formRef} action={dispatch} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="oldPassword">Old Password</Label>
        <Input id="oldPassword" name="oldPassword" type="password" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="newPassword">New Password</Label>
        <Input id="newPassword" name="newPassword" type="password" required minLength={6}/>
      </div>
      <div>
        <SubmitButton />
      </div>
    </form>
  );
}

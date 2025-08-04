'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { changeUsername } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? 'Updating...' : 'Update Username'}
    </Button>
  );
}

export default function ChangeUsernameForm() {
  const initialState = { message: '', success: false };
  const [state, dispatch] = useActionState(changeUsername, initialState);
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
        <Label htmlFor="newUsername">New Username</Label>
        <Input id="newUsername" name="newUsername" type="text" required minLength={3} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password-for-username">Password</Label>
        <Input id="password-for-username" name="password" type="password" required placeholder="Enter current password"/>
      </div>
      <div>
        <SubmitButton />
      </div>
    </form>
  );
}

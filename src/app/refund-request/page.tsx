
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { useIsMobile } from '@/hooks/use-mobile';

export default function RefundRequestPage() {
  const [transactionId, setTransactionId] = useState('');
  const [gamingId, setGamingId] = useState('');
  const [message, setMessage] = useState('');
  const isMobile = useIsMobile();

  const handleSendEmail = () => {
    const recipient = 'garenaffmaxstore@gmail.com';
    const subject = `Refund Request - ID: ${gamingId} - UTR/Code: ${transactionId}`;
    const body = `
Gaming ID:
${gamingId}

UTR/Transaction ID or Redeem Code:
${transactionId}

Reason for refund:
${message}
    `;

    if (isMobile) {
      const mailtoLink = `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      window.location.href = mailtoLink;
    } else {
      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${recipient}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      window.open(gmailUrl, '_blank');
    }
  };

  return (
    <div className="container mx-auto px-6 py-16 flex justify-center">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-3xl font-headline">Refund Request</CardTitle>
          <CardDescription>
            Fill out the form below to submit a refund request. This will open your default email client.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
           <div className="space-y-2">
            <Label htmlFor="gaming-id">Your Gaming ID</Label>
            <Input
              id="gaming-id"
              placeholder="Enter your Gaming ID"
              value={gamingId}
              onChange={(e) => setGamingId(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="transaction-id">UTR/Transaction ID or Redeem Code</Label>
            <Input
              id="transaction-id"
              placeholder="Enter your transaction ID or redeem code"
              value={transactionId}
              onChange={(e) => setTransactionId(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="message">Why do you want a refund?</Label>
            <Textarea
              id="message"
              placeholder="Please describe the issue..."
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleSendEmail} size="lg" className="w-full" disabled={!gamingId || !transactionId || !message}>
            Open in Email
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

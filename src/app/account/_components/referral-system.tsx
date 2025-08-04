'use client';

import { useState, useEffect } from 'react';
import { generateReferralLink } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Copy, Loader2 } from 'lucide-react';

export default function ReferralSystem() {
  const [link, setLink] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleGenerateLink = async () => {
    setIsLoading(true);
    const result = await generateReferralLink();
    if (result.success && result.link) {
      setLink(result.link);
      if (result.message !== 'Your existing referral link.') {
        toast({
          title: 'Success',
          description: result.message,
        });
      }
    } else {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: result.message,
      });
    }
    setIsLoading(false);
  };
  
  useEffect(() => {
    // Attempt to fetch the link when the component mounts
    handleGenerateLink();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCopyToClipboard = () => {
    if (link) {
      navigator.clipboard.writeText(link);
      toast({
        title: 'Copied!',
        description: 'Referral link copied to clipboard.',
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Referral System</CardTitle>
        <CardDescription>
          {link ? 'Share this unique link with your friends.' : 'Generate a unique link to share with your friends. Earn rewards when they sign up and make a purchase!'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && !link ? (
          <div className="flex justify-center">
            <Loader2 className="mr-2 h-6 w-6 animate-spin" />
          </div>
        ) : link ? (
          <div className="flex items-center space-x-2">
            <Input value={link} readOnly />
            <Button variant="outline" size="icon" onClick={handleCopyToClipboard}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <Button onClick={handleGenerateLink} disabled={isLoading} className="w-full">
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isLoading ? 'Generating...' : 'Generate Referral Link'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

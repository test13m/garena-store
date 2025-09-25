
'use client';

import { useEffect, useState } from 'react';
import { Button } from './ui/button';
import { RotateCw } from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

export default function BrowserRedirect() {
  const [isInAppBrowser, setIsInAppBrowser] = useState(false);

  useEffect(() => {
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
    const isFacebook = /FBAN|FBAV/.test(userAgent);
    const isInstagram = /Instagram/.test(userAgent);
    const isAndroid = /android/i.test(userAgent);

    if (isFacebook || isInstagram) {
      setIsInAppBrowser(true);
      if (isAndroid) {
        // Attempt to open in external browser on Android
        const currentUrl = window.location.href;
        const intentUrl = `intent:${currentUrl.replace(/^https?:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;end`;
        
        try {
            window.location.href = intentUrl;
        } catch (e) {
            // Fallback if intent fails
        }
      } else {
        // For iOS and others, a direct href change is the most we can do.
        // It might still open in the in-app browser but is worth a try.
        // window.location.href = window.location.href;
      }
    }
  }, []);

  if (!isInAppBrowser) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black text-white p-8">
      <div className="text-center">
        <Image src="/img/garena.png" alt="Garena Logo" width={80} height={80} className="mx-auto mb-6" />
        <h1 className="text-2xl font-bold mb-4">Browser Not Supported</h1>
        <p className="mb-6 text-neutral-300">
          For the best experience, please open this website in your phone's default browser (like Chrome or Safari).
        </p>
        <Button 
          variant="outline" 
          className={cn(
            "relative overflow-hidden",
            "bg-transparent text-white border-white hover:bg-white hover:text-black animate-glowing-ray"
          )}
          onClick={() => window.location.reload()}
        >
          <RotateCw className="mr-2 h-4 w-4" />
          Reload Page
        </Button>
      </div>
    </div>
  );
}

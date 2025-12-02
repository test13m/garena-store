
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Loader2 } from 'lucide-react';

export default function ForceRedirectPage() {
  const [isInAppBrowser, setIsInAppBrowser] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
    const isFacebook = /FBAN|FBAV/.test(userAgent);
    const isInstagram = /Instagram/.test(userAgent);
    const isAndroid = /android/i.test(userAgent);
    const isKnownInAppBrowser = isFacebook || isInstagram;

    setIsInAppBrowser(isKnownInAppBrowser);

    if (isKnownInAppBrowser) {
      // Logic for in-app browsers
      const countdownInterval = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countdownInterval);
            setIsRedirecting(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      if (isAndroid) {
        setTimeout(() => {
          const currentUrl = window.location.href.replace('/ff', ''); // Redirect to homepage
          const intentUrl = `intent:${currentUrl.replace(/^https?:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;end`;
          
          const redirectInterval = setInterval(() => {
            try {
              window.location.href = intentUrl;
            } catch (e) {
              console.error("Intent redirection failed:", e);
            }
          }, 1500);

          return () => clearInterval(redirectInterval);
        }, 5000); // Wait 5 seconds before starting the loop
      }
    } else {
      // If it's not an in-app browser, redirect to home immediately.
      router.replace('/');
    }

  }, [router]);

  if (!isInAppBrowser) {
    // Render a loading state while the initial check and redirect happens.
    return (
      <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black text-white p-8">
        <Loader2 className="w-16 h-16 animate-spin text-primary" />
        <p className="mt-4">Loading...</p>
      </div>
    );
  }
  
  // Render the splash screen for in-app browsers.
  const progress = ((5 - countdown) / 5) * 100;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black text-white p-8">
      <div className="text-center flex flex-col items-center">
        <Image src="/img/garena.png" alt="Garena Logo" width={80} height={80} className="mx-auto mb-4" />
        <p className="text-sm text-neutral-400 mb-6">A message from the Garena Team</p>
        
        <h1 className="text-2xl font-bold mb-4">Switching to your browser...</h1>
        <p className="mb-8 text-neutral-300 max-w-sm">
          For the best experience, we're redirecting you. Please tap <strong className="text-white">"Continue"</strong> or <strong className="text-white">"Open"</strong> on the next screen.
        </p>

        <div className="relative w-24 h-24 flex items-center justify-center">
          {isRedirecting ? (
            <Loader2 className="w-16 h-16 animate-spin text-primary" />
          ) : (
            <>
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  className="text-neutral-700"
                  strokeWidth="8"
                  stroke="currentColor"
                  fill="transparent"
                  r="40"
                  cx="48"
                  cy="48"
                />
                <circle
                  className="text-primary"
                  strokeWidth="8"
                  strokeDasharray={2 * Math.PI * 40}
                  strokeDashoffset={(2 * Math.PI * 40) * (1 - progress / 100)}
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="transparent"
                  r="40"
                  cx="48"
                  cy="48"
                  style={{ transition: 'stroke-dashoffset 1s linear' }}
                />
              </svg>
              <span className="absolute text-3xl font-bold font-mono">
                {countdown}
              </span>
            </>
          )}
        </div>

        {isRedirecting && (
          <p className="mt-6 text-sm text-neutral-400 animate-pulse">
            Waiting for you to continue...
          </p>
        )}
      </div>
    </div>
  );
}

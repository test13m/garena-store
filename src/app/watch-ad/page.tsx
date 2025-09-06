'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { rewardAdCoins } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Loader2, PartyPopper } from 'lucide-react';
import { FC, useRef } from 'react';

/* ---------- Adsterra Unit ---------- */
interface AdUnitProps {
  adKey: string;
  height: number;
  width: number;
  className?: string;
}

const AdUnit: FC<AdUnitProps> = ({ adKey, height, width, className = '' }) => {
  const adContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!adContainerRef.current) return;
    adContainerRef.current.innerHTML = '';

    const adElement = document.createElement('div');
    const optionsScript = document.createElement('script');
    optionsScript.type = 'text/javascript';
    optionsScript.innerHTML = `
      atOptions = {
        'key' : '${adKey}',
        'format' : 'iframe',
        'height' : ${height},
        'width' : ${width},
        'params' : {}
      };
    `;
    const invokeScript = document.createElement('script');
    invokeScript.type = 'text/javascript';
    invokeScript.src = `//www.highperformanceformat.com/${adKey}/invoke.js`;

    adElement.appendChild(optionsScript);
    adElement.appendChild(invokeScript);
    adContainerRef.current.appendChild(adElement);

    return () => {
      if (adContainerRef.current) adContainerRef.current.innerHTML = '';
    };
  }, [adKey, height, width]);

  return (
    <div
      ref={adContainerRef}
      className={className}
      style={{ minWidth: `${width}px`, minHeight: `${height}px` }}
    ></div>
  );
};

/* ---------- Revenue Banner ---------- */
interface BannerAdUnitProps {
  adSrc: string;
  containerId: string;
  className?: string;
}

const BannerAdUnit: FC<BannerAdUnitProps> = ({ adSrc, containerId, className = '' }) => {
  const adContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!adContainerRef.current) return;
    adContainerRef.current.innerHTML = '';

    const containerDiv = document.createElement('div');
    containerDiv.id = containerId;

    const invokeScript = document.createElement('script');
    invokeScript.async = true;
    invokeScript.setAttribute('data-cfasync', 'false');
    invokeScript.src = adSrc;

    adContainerRef.current.appendChild(invokeScript);
    adContainerRef.current.appendChild(containerDiv);

    return () => {
      if (adContainerRef.current) adContainerRef.current.innerHTML = '';
    };
  }, [adSrc, containerId]);

  return <div ref={adContainerRef} className={className}></div>;
};

/* ---------- Main Page ---------- */
export default function WatchAdPage() {
  const [countdown, setCountdown] = useState(30);
  const [isComplete, setIsComplete] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isComplete) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isComplete]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (!isComplete) {
      setIsComplete(true);
      rewardAdCoins().then((result) => {
        if (result.success) {
          toast({
            title: 'Success!',
            description: result.message || "You've earned 5 coins!",
            duration: 5000,
          });
        } else {
          toast({
            variant: 'destructive',
            title: 'Error',
            description: result.message || 'Could not process reward.',
            duration: 5000,
          });
        }
        setTimeout(() => router.push('/'), 3000);
      });
    }
  }, [countdown, isComplete, router, toast]);

  return (
    <div className="flex flex-col items-center justify-start min-h-screen bg-white text-gray-800 p-4 space-y-6">
      
      {/* Adsterra Above Countdown */}
      <AdUnit
        adKey="d03db8034121e832dbc841f6b4b0fb1c"
        height={60}
        width={468}
      />

      {/* Countdown Section */}
      <div className="text-center space-y-6 my-4">
        {isComplete ? (
          <div className="space-y-4">
            <PartyPopper className="w-24 h-24 text-yellow-400 mx-auto animate-bounce" />
            <h1 className="text-4xl font-bold">Ad Finished!</h1>
            <p className="text-lg">You've earned your reward!</p>
            <p className="text-sm text-gray-500">Redirecting you back to the homepage...</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="relative w-28 h-28 mx-auto">
              <Loader2 className="w-28 h-28 text-blue-600 animate-spin" />
              <span className="absolute inset-0 flex items-center justify-center text-4xl font-bold">
                {countdown}
              </span>
            </div>
            <h1 className="text-3xl font-bold tracking-wider">Your Ad Is Playing...</h1>
            <p className="text-gray-600 max-w-sm">
              Please wait for the countdown to finish to receive your reward. Do not close or refresh this page.
            </p>
          </div>
        )}
      </div>

      {/* Revenue Ad Below Countdown */}
      <BannerAdUnit
        adSrc="//pl27351902.revenuecpmgate.com/d990b9916919f0f255fc4e310f7c9793/invoke.js"
        containerId="container-d990b9916919f0f255fc4e310f7c9793"
      />
    </div>
  );
}

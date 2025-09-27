
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { rewardAdCoins, getUserData } from '@/app/actions';
import { getActiveAd } from '../admin/(protected)/custom-ads/actions';
import { useToast } from '@/hooks/use-toast';
import { Loader2, X, Volume2, VolumeX, SkipForward } from 'lucide-react';
import type { CustomAd, User } from '@/lib/definitions';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import GamingIdModal from '@/components/gaming-id-modal';


export default function WatchAdPage() {
  const [ad, setAd] = useState<CustomAd | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  
  const [progress, setProgress] = useState(0);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isRewardGranted, setIsRewardGranted] = useState(false);
  const [showCta, setShowCta] = useState(false);
  
  const [shouldGrantReward, setShouldGrantReward] = useState(false);
  const [shouldRedirect, setShouldRedirect] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const router = useRouter();
  const { toast } = useToast();
  const hasGrantedReward = useRef(false);

  useEffect(() => {
    async function fetchData() {
      const [adData, userData] = await Promise.all([getActiveAd(), getUserData()]);
      
      if (!userData) {
        setIsRegisterModalOpen(true);
        setIsLoading(false);
        return;
      }
      setUser(userData);

      if (adData) {
        setAd(adData);
      }
      setIsLoading(false);
    }
    fetchData();
  }, []);

  useEffect(() => {
      if (videoRef.current && ad) {
          videoRef.current.play().catch(error => {
              console.warn("Autoplay with sound failed. Muting video.", error);
              setIsMuted(true);
              if(videoRef.current) {
                videoRef.current.muted = true;
                videoRef.current.play();
              }
          });
      }
  }, [ad]);

  useEffect(() => {
    if (!ad || isLoading) return;
    
    const rewardTime = ad.rewardTime || ad.totalDuration;

    const timer = setInterval(() => {
      setTimeElapsed(prev => {
        const newTime = prev + 1;
        
        if (newTime >= 3) {
          setShowCta(true);
        }

        if (newTime >= rewardTime && !hasGrantedReward.current) {
          hasGrantedReward.current = true;
          setShouldGrantReward(true);
        }
        
        if (newTime >= ad.totalDuration) {
          clearInterval(timer);
          setShouldRedirect(true);
        }
        
        return newTime;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [ad, isLoading]);
  
  useEffect(() => {
    if (shouldGrantReward) {
      rewardAdCoins().then(result => {
        if (result.success) {
          toast({
            title: 'Success!',
            description: result.message || "You've earned 5 coins!",
          });
        }
      });
      setIsRewardGranted(true);
    }
  }, [shouldGrantReward, toast]);

  useEffect(() => {
    if (shouldRedirect) {
      router.push('/');
    }
  }, [shouldRedirect, router]);

  const handleCtaClick = useCallback(() => {
    if (ad) {
      window.open(ad.ctaLink, '_blank');
    }
  }, [ad]);
  
  const handleSkip = () => {
    router.push('/');
  }

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-full">
          <Loader2 className="w-16 h-16 text-white animate-spin" />
        </div>
      );
    }
    
    if (!ad) {
        return (
             <div className="flex flex-col items-center justify-center h-full text-center text-white">
                <h1 className="text-2xl font-bold">No Active Ad</h1>
                <p className="text-lg mt-2">There is no ad available to watch right now. Please check back later.</p>
                <Button onClick={() => router.push('/')} className="mt-6">Go Back Home</Button>
            </div>
        )
    }

    const buttonShapeClass = {
        pill: 'rounded-full',
        rounded: 'rounded-lg',
        square: 'rounded-none'
    };

    const showSkipButton = isRewardGranted && ad.rewardTime && ad.rewardTime < ad.totalDuration;

    return (
      <div className="relative w-full h-full">
        <div 
          className="w-full h-full cursor-pointer"
          onClick={handleCtaClick}
        >
            <video
            ref={videoRef}
            src={ad.videoUrl}
            autoPlay
            playsInline
            muted={isMuted}
            className="w-full h-full object-contain"
            />
        </div>
        
        <div className="absolute inset-0 flex flex-col justify-between p-4 pointer-events-none">
          <div className="flex justify-between items-center w-full pointer-events-auto">
            <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden">
                <div
                    className="h-full bg-white animate-progress-smooth"
                    style={{ '--duration': `${ad.totalDuration}s` } as React.CSSProperties}
                />
            </div>
             <div className="flex items-center gap-2 ml-4">
                <Button onClick={() => setIsMuted(!isMuted)} variant="ghost" size="icon" className="text-white">
                    {isMuted ? <VolumeX /> : <Volume2 />}
                </Button>
                {showSkipButton && (
                    <Button onClick={handleSkip} variant="secondary" className="bg-white/80 hover:bg-white text-black backdrop-blur-sm rounded-full">
                        <SkipForward className="mr-2"/>
                        Skip Ad
                    </Button>
                )}
            </div>
          </div>
          
          {!ad.hideCtaButton && (
            <div className={cn(
                "absolute bottom-20 left-0 right-0 flex justify-center transition-opacity duration-500 pointer-events-auto",
                showCta ? 'animate-pop-in' : 'opacity-0'
            )}>
                <Button 
                    onClick={handleCtaClick}
                    variant={ad.ctaColor}
                    size="lg"
                    className={cn("text-lg h-12 px-8 font-bold", buttonShapeClass[ad.ctaShape])}
                >
                {ad.ctaText}
                </Button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
     <>
        <GamingIdModal isOpen={isRegisterModalOpen} onOpenChange={setIsRegisterModalOpen} />
         <div className="fixed inset-0 flex flex-col items-center justify-center bg-black w-full h-full">
           {renderContent()}
        </div>
     </>
  );
}

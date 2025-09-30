'use client';

import { useEffect } from 'react';
import { Coins } from 'lucide-react';

interface WelcomeAnimationProps {
  coins?: number;
}

export default function WelcomeAnimation({ coins }: WelcomeAnimationProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      window.location.reload();
    }, 3500); // A little longer than the animation to ensure it completes

    return () => clearTimeout(timer);
  }, []);

  const coinParticles = Array.from({ length: 15 });

  return (
    <div className="fixed inset-0 z-[999] flex flex-col items-center justify-center bg-background/90 backdrop-blur-sm p-8">
        <div className="text-center p-8 pt-12 flex flex-col items-center">
            {/* Main animated icon */}
            <div className="relative inline-block mb-6">
                <svg className="w-28 h-28" viewBox="0 0 100 100">
                    {/* Circle */}
                    <path 
                        d="M 50, 5 A 45,45 0 1 1 49.9,5"
                        fill="none" 
                        stroke="hsl(var(--primary))" 
                        strokeWidth="5" 
                        strokeLinecap="round" 
                        className="animate-[draw-g_1s_ease-out_forwards]"
                        style={{ strokeDasharray: 283, strokeDashoffset: 283 }}
                    />
                    {/* Checkmark */}
                    <path 
                        d="M30 50 L45 65 L70 40" 
                        fill="none" 
                        stroke="hsl(var(--primary))" 
                        strokeWidth="6" 
                        strokeLinecap="round" 
                        strokeLinejoin="round"
                        className="animate-[draw-inner_0.5s_ease-out_0.8s_forwards]"
                        style={{ strokeDasharray: 60, strokeDashoffset: 60 }}
                    />
                </svg>
            </div>

            {/* Text animation */}
            <h1 className="text-4xl font-headline font-bold text-foreground animate-[fade-in-up_0.5s_ease-out_1s_forwards] opacity-0">
              {coins && coins > 0 ? 'Welcome!' : 'Welcome Back!'}
            </h1>
            
            {coins && coins > 0 && (
              <div className="relative mt-4 h-24">
                 <p className="text-2xl font-semibold text-primary animate-[fade-in-up_0.5s_ease-out_1.2s_forwards] opacity-0">
                    Congratulations!
                </p>
                
                {/* Coin particles shower */}
                {coinParticles.map((_, i) => (
                    <div
                        key={i}
                        className="absolute top-0 left-1/2 text-amber-400 animate-[coin-shower_1.5s_ease-out_1.5s_forwards]"
                        style={{
                            '--i': Math.random(),
                            '--x': (Math.random() - 0.5) * 200,
                            '--d': Math.random() * 0.5 + 0.3,
                        } as React.CSSProperties}
                        >
                        <Coins className="w-4 h-4" />
                    </div>
                ))}
                
                <div className="flex items-center justify-center gap-2 mt-2 text-xl text-muted-foreground animate-[fade-in-up_0.5s_ease-out_1.4s_forwards] opacity-0">
                  You've received
                  <div className="relative flex items-center justify-center gap-1 font-bold text-foreground">
                    <div className="relative z-10 flex items-center gap-1">
                        <Coins className="w-6 h-6 text-amber-500 animate-[bounce-short_1s_ease-in-out_infinite]" style={{ animationDelay: '1.8s' }} />
                        {coins} Coins
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Progress bar */}
            <div className="w-full max-w-xs bg-muted rounded-full h-1.5 mt-8 overflow-hidden">
              <div
                className="bg-primary h-1.5 rounded-full animate-progress-smooth"
                style={{'--duration': '3s', animationDelay: '0.5s'} as React.CSSProperties}
              ></div>
            </div>
        </div>

      <style jsx>{`
        @keyframes draw-g { to { stroke-dashoffset: 0; } }
        @keyframes draw-inner { to { stroke-dashoffset: 0; } }
        
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes progress-smooth {
          from { transform: translateX(-100%); }
          to { transform: translateX(0); }
        }
        @keyframes bounce-short {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-15%); }
        }
        @keyframes coin-shower {
            0% {
                transform: translate(0, -20px) scale(0);
                opacity: 1;
            }
            100% {
                transform: translate(calc(var(--x) * 1px), 100px) scale(1);
                opacity: 0;
            }
        }
      `}</style>
    </div>
  );
}

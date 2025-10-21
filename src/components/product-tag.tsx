
'use client';

import { cn } from '@/lib/utils';

interface ProductTagProps {
  tag: string;
  color?: 'green' | 'red';
}

export default function ProductTag({ tag, color = 'green' }: ProductTagProps) {
  if (!tag) {
    return null;
  }
  
  const colorClasses = {
      green: 'bg-green-600 border-green-600',
      red: 'bg-red-600 border-red-600'
  }

  return (
    <div className="absolute -top-5 -right-4 z-10 drop-shadow-lg" style={{ transform: 'rotate(4deg)' }}>
        <div 
          className={cn(
            'relative text-white',
            'text-xs font-bold uppercase tracking-wider',
            'px-2 py-1 rounded-lg',
            'overflow-hidden animate-glowing-ray',
            colorClasses[color]
          )}
        >
          {tag}
        </div>
        <div className={cn(
            "absolute top-full right-2 w-0 h-0",
            "border-l-[10px] border-l-transparent",
            "border-r-[0px] border-r-transparent",
            "border-t-[8px]",
            colorClasses[color]
        )}></div>
    </div>
  );
}

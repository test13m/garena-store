'use client';

import Image from 'next/image';

export default function SecondCardDecoration() {
  return (
    <div className="absolute -top-4 -left-20 z-10 w-48 h-48 pointer-events-none">
      <Image
        src="https://res.cloudinary.com/dlvoikod1/image/upload/v1762671985/VID-20251109-123336-unscreen_jpkqzf.gif"
        alt="Card Decoration"
        width={200}
        height={200}
        className="object-contain"
      />
    </div>
  );
}

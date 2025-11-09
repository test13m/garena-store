'use client';

import Image from 'next/image';

export default function SecondCardDecoration() {
  return (
    <div className="absolute -top-5 -left-[5rem] z-10 w-56 h-56 pointer-events-none">
      <Image
        src="https://res.cloudinary.com/dlvoikod1/image/upload/v1762671985/VID-20251109-123336-unscreen_jpkqzf.gif"
        alt="Card Decoration"
        width={260}
        height={260}
        className="object-contain"
      />
    </div>
  );
}

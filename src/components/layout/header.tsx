'use client';

import Link from 'next/link';
import { Flame, Menu, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from '@/components/ui/sheet';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/about', label: 'About' },
  { href: '/privacy', label: 'Privacy Policy' },
  { href: '/terms', label: 'T&C' },
  { href: '/contact', label: 'Contact' },
];

export default function Header() {
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container px-4 md:px-6 flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Flame className="h-6 w-6 text-primary" />
          <span className="font-bold font-headline text-lg">Garena Gears</span>
        </Link>

        <div className="flex items-center gap-4">
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
             <Button asChild className={'bg-primary/10 hover:bg-primary/20 text-primary'}>
                <Link href="/order">
                    Order
                    <ShoppingCart className="h-4 w-4" />
                </Link>
             </Button>
            {navLinks.map(({ href, label }) => (
              <Link
                key={label}
                href={href}
                className={cn(
                  'transition-colors hover:text-primary',
                  pathname === href &&
                    'text-primary underline underline-offset-4 decoration-primary'
                )}
              >
                {label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center md:hidden">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/order">
                <ShoppingCart className="h-5 w-5" />
                <span className="sr-only">Order</span>
              </Link>
            </Button>
            <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Toggle navigation menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right">
                <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
                <div className="flex flex-col gap-6 pt-10">
                  <Link
                    href="/"
                    className="flex items-center gap-2 mb-4"
                    onClick={() => setIsSheetOpen(false)}
                  >
                    <Flame className="h-6 w-6 text-primary" />
                    <span className="font-bold font-headline text-lg">
                      Garena Gears
                    </span>
                  </Link>
                  {navLinks.map(({ href, label }) => (
                    <Link
                      key={label}
                      href={href}
                      className={cn(
                        'text-lg font-medium transition-colors hover:text-primary',
                        pathname === href &&
                          'text-primary underline underline-offset-4 decoration-primary'
                      )}
                      onClick={() => setIsSheetOpen(false)}
                    >
                      {label}
                    </Link>
                  ))}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}

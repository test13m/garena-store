'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { logoutAdmin } from '@/app/actions';
import { Home, ListChecks, ListX, Users, LogOut, Banknote, Tag, ArchiveRestore, Coins, ShieldBan, Box } from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';

const navItems = [
  { href: '/admin', label: 'Pending Orders', icon: Home },
  { href: '/admin/success', label: 'Successful Orders', icon: ListChecks },
  { href: '/admin/failed', label: 'Failed Orders', icon: ListX },
  { href: '/admin/all-orders', label: 'All Orders', icon: Box },
  { href: '/admin/accounts', label: 'Registered Accounts', icon: Users },
  { href: '/admin/users', label: 'User Management', icon: ShieldBan },
  { href: '/admin/withdrawals', label: 'Withdrawals', icon: Banknote },
  { href: '/admin/price-management', label: 'Price Management', icon: Tag },
  { href: '/admin/vanished-products', label: 'Vanished Products', icon: ArchiveRestore },
  { href: '/admin/coin-management', label: 'Coin Management', icon: Coins },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await logoutAdmin();
    router.push('/admin/login');
  };

  return (
    <aside className="hidden md:flex flex-col w-64 border-r bg-background">
      <div className="flex items-center justify-center h-16 border-b">
        <Link href="/admin" className="flex items-center gap-2 font-semibold">
          <Image src="/img/garena.png" alt="Garena Logo" width={24} height={24} />
          <span>Garena Admin</span>
        </Link>
      </div>
      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => (
          <Button
            key={item.href}
            asChild
            variant={pathname === item.href ? 'secondary' : 'ghost'}
            className="w-full justify-start"
          >
            <Link href={item.href}>
              <item.icon className="mr-2 h-4 w-4" />
              {item.label}
            </Link>
          </Button>
        ))}
      </nav>
      <div className="p-4 mt-auto border-t">
        <Button variant="outline" className="w-full justify-start" onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </Button>
      </div>
    </aside>
  );
}

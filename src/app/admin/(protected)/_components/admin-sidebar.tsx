'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { logoutAdmin } from '@/app/actions';
import { Home, ListChecks, ListX, Users, LogOut, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/admin', label: 'Pending Orders', icon: Home },
  { href: '/admin/success', label: 'Successful Orders', icon: ListChecks },
  { href: '/admin/failed', label: 'Failed Orders', icon: ListX },
  { href: '/admin/accounts', label: 'User Accounts', icon: Users },
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
          <Flame className="h-6 w-6 text-primary" />
          <span>Garena Gears Admin</span>
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

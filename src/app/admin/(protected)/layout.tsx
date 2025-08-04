import { isAdminAuthenticated } from '@/app/actions';
import { redirect } from 'next/navigation';
import AdminSidebar from './_components/admin-sidebar';
import { unstable_noStore as noStore } from 'next/cache';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  noStore();
  const isAdmin = await isAdminAuthenticated();
  if (!isAdmin) {
    redirect('/admin/login');
  }

  return (
    <div className="flex min-h-screen bg-muted/40">
      <AdminSidebar />
      <main className="flex-1 p-4 sm:p-6 md:p-8">{children}</main>
    </div>
  );
}

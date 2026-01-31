
import { getActiveUsers } from './actions';
import ActiveUserList from './_components/active-user-list';
import { unstable_noStore as noStore } from 'next/cache';

export default async function ActiveUsersPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  noStore();
  const page = typeof searchParams.page === 'string' ? Number(searchParams.page) : 1;

  const { users, hasMore, totalUsers } = await getActiveUsers(page);

  return (
    <ActiveUserList
      initialUsers={users}
      initialHasMore={hasMore}
      totalUsers={totalUsers}
    />
  );
}


import AccountList from './_components/account-list';
import { getUsersForAdmin } from '@/app/actions';

export default async function AdminAccountsPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const page = typeof searchParams.page === 'string' ? Number(searchParams.page) : 1;
  const sort = typeof searchParams.sort === 'string' ? searchParams.sort : 'asc';
  const search = typeof searchParams.search === 'string' ? searchParams.search : '';

  const { users, hasMore } = await getUsersForAdmin(page, sort, search);

  return (
    <AccountList
      initialUsers={users}
      initialHasMore={hasMore}
    />
  );
}

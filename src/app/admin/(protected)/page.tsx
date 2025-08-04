
import { OrderList } from './_components/order-list';
import { getOrdersForAdmin } from '@/app/actions';

const status = ['Pending UTR', 'Processing'];

export default async function AdminHomePage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const page = typeof searchParams.page === 'string' ? Number(searchParams.page) : 1;
  const sort = typeof searchParams.sort === 'string' ? searchParams.sort : 'asc';
  const search = typeof searchParams.search === 'string' ? searchParams.search : '';

  const { orders, hasMore } = await getOrdersForAdmin(page, sort, search, status);

  return (
    <OrderList
      initialOrders={orders}
      title="Pending Orders"
      status={status}
      showActions={true}
      initialHasMore={hasMore}
    />
  );
}

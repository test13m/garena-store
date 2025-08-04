
import { OrderList } from '../_components/order-list';
import { getOrdersForAdmin } from '@/app/actions';

const status = ['Failed'];

export default async function AdminFailedPage({
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
      title="Failed Orders"
      status={status}
      initialHasMore={hasMore}
    />
  );
}

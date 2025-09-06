
import { OrderList } from '../_components/order-list';
import { getOrdersForAdmin } from '@/app/actions';

const status = ['Processing', 'Completed', 'Failed'];

export default async function AdminAllOrdersPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const page = typeof searchParams.page === 'string' ? Number(searchParams.page) : 1;
  const sort = typeof searchParams.sort === 'string' ? searchParams.sort : 'asc';
  const search = typeof searchParams.search === 'string' ? searchParams.search : '';

  // For this page, we only load if a search param is present
  const { orders, hasMore, totalOrders } = search 
    ? await getOrdersForAdmin(page, sort, search, status) 
    : { orders: [], hasMore: false, totalOrders: 0 };

  return (
    <OrderList
      initialOrders={orders}
      title={search ? `All Orders for "${search}"` : "All Orders"}
      status={status}
      showActions={true}
      initialHasMore={hasMore}
      totalOrders={totalOrders}
    />
  );
}

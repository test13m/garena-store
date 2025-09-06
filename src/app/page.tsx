import ImageSlider from '@/components/image-slider';
import FaqChatbot from '@/components/faq-chatbot';
import { getProducts, getUserData, getOrdersForUser } from './actions';
import { type Metadata } from 'next';
import { type Product, type User, type Order } from '@/lib/definitions';
import CoinSystem from '@/components/coin-system';
import { ObjectId } from 'mongodb';
import ProductList from '@/components/product-list';


export const metadata: Metadata = {
  metadataBase: new URL('https://freefire-max-garena.vercel.app'),
  title: 'Garena Gears - Free Fire Top-Up & Diamonds',
  description: 'The official, secure, and trusted Garena store for discounted Free Fire diamonds, memberships, and top-ups. Get unbeatable prices on in-game items for Free Fire MAX.',
  keywords: [
    'Free Fire top up', 'Free Fire MAX top up', 'Garena', 'Free Fire diamonds', 'top-up', 'in-game items', 'Garena Gears', 'buy Free Fire diamonds', 'Free Fire recharge', 'Garena top up center', 'Free Fire membership', 'cheap Free Fire diamonds', 'how to top up Free Fire', 'Garena Free Fire', 'diamonds for Free Fire', 'game top up', 'Free Fire redeem code', 'Garena topup', 'FF top up',
  ],
  openGraph: {
    title: 'Garena Gears - Free Fire Top-Up & Diamonds',
    description: 'The official, secure, and trusted Garena store for discounted Free Fire diamonds and top-ups.',
    images: '/img/slider1.png'
  }
};


export default async function Home() {
  const products: (Product & { _id: ObjectId | string })[] = await getProducts();
  const user: User | null = await getUserData();
  const orders: Order[] = user ? await getOrdersForUser() : [];

  const productsWithStringId = products.map(p => ({...p, _id: p._id.toString()}));

  return (
    <div className="flex flex-col">
      <ImageSlider />
      <CoinSystem user={user} />
      <ProductList initialProducts={productsWithStringId} user={user} orders={orders}/>
      <FaqChatbot />
    </div>
  );
}

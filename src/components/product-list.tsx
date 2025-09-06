
'use client';

import { useState, useMemo } from 'react';
import ProductCard from '@/components/product-card';
import type { Product, User, Order } from '@/lib/definitions';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search } from 'lucide-react';
import { type ObjectId } from 'mongodb';


interface ProductListProps {
    initialProducts: (Product & { _id: string | ObjectId })[];
    user: User | null;
    orders: Order[];
}

export default function ProductList({ initialProducts, user, orders }: ProductListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const categories = useMemo(() => {
    const allCategories = initialProducts
      .map(p => p.category)
      .filter((c): c is string => !!c);
    return ['all', ...Array.from(new Set(allCategories))];
  }, [initialProducts]);

  const filteredAndSortedProducts = useMemo(() => {
    let products = [...initialProducts];

    // Filter by category
    if (selectedCategory !== 'all') {
      products = products.filter(p => p.category === selectedCategory);
    }

    // Sort by search term
    if (searchTerm.trim() !== '') {
      const lowercasedSearchTerm = searchTerm.toLowerCase();
      products.sort((a, b) => {
        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();
        
        const aStartsWith = aName.startsWith(lowercasedSearchTerm);
        const bStartsWith = bName.startsWith(lowercasedSearchTerm);
        
        if (aStartsWith && !bStartsWith) return -1;
        if (!aStartsWith && bStartsWith) return 1;

        const aContains = aName.includes(lowercasedSearchTerm);
        const bContains = bName.includes(lowercasedSearchTerm);

        if (aContains && !bContains) return -1;
        if (!aContains && bContains) return 1;

        return 0; // Keep original order if no match or both match same way
      });
    }

    return products;
  }, [initialProducts, searchTerm, selectedCategory]);

  return (
    <section className="w-full py-6 md:py-10 lg:py-12 bg-background">
      <div className="container mx-auto px-4 md:px-6">
        <h2 className="text-3xl md:text-4xl font-headline font-bold text-center mb-4 text-foreground">
          Purchase Item Now
        </h2>
        
        <div className="flex flex-row items-center justify-end gap-2 mb-8 md:mb-12">
            <div className="relative flex-grow max-w-[180px] sm:max-w-xs md:max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                    type="text"
                    placeholder="Search products..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 w-full"
                />
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-[100px] md:w-[140px] flex-shrink-0">
                    <SelectValue placeholder="Select Category" />
                </SelectTrigger>
                <SelectContent>
                    {categories.map(category => (
                        <SelectItem key={category} value={category} className="capitalize">
                            {category === 'all' ? 'All Categories' : category}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 md:gap-8">
          {filteredAndSortedProducts.map((product) => {
             const hasPurchased = !!user && orders.some(order => 
                order.productId === product._id.toString() && 
                (order.status === 'Completed' || order.status === 'Processing')
            );
            return (
                <ProductCard
                key={product._id.toString()}
                product={{...product, _id: product._id.toString()}}
                user={user}
                hasPurchased={hasPurchased}
                />
            )
          })}
        </div>
      </div>
    </section>
  );
}

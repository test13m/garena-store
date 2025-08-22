'use client';

import { useState, useTransition } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2, Trash2, Coins, PlusCircle, ArrowUp, ArrowDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { updateProduct, vanishProduct, addProduct } from '@/app/actions';
import type { Product } from '@/lib/definitions';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

interface PriceManagementListProps {
  initialProducts: Product[];
}

// Helper to format date for datetime-local input
const formatDateForInput = (date?: Date) => {
  if (!date) return '';
  const d = new Date(date);
  // Adjust for timezone offset to display local time correctly in the input
  const timeZoneOffset = d.getTimezoneOffset() * 60000;
  const localDate = new Date(d.getTime() - timeZoneOffset);
  return localDate.toISOString().slice(0, 16);
};


export default function PriceManagementList({ initialProducts }: PriceManagementListProps) {
  const [products, setProducts] = useState(initialProducts);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleUpdate = (productId: string, formData: FormData) => {
    startTransition(async () => {
      const result = await updateProduct(productId, formData);
      if (result.success) {
        toast({ title: 'Success', description: 'Product updated successfully.' });
      } else {
        toast({ variant: 'destructive', title: 'Error', description: result.message });
      }
    });
  };

  const handleVanish = (productId: string) => {
    startTransition(async () => {
      const result = await vanishProduct(productId);
      if (result.success) {
        toast({ title: 'Success', description: 'Product vanished.' });
        setProducts(products.filter(p => p._id !== productId));
      } else {
        toast({ variant: 'destructive', title: 'Error', description: result.message });
      }
    });
  };
  
  const handleAddProduct = () => {
    startTransition(async () => {
        const result = await addProduct();
        if (result.success) {
            toast({ title: 'Success', description: 'New product added. Please refresh to see it.' });
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.message });
        }
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row justify-between items-start">
        <div>
            <CardTitle>Price & Product Management</CardTitle>
            <CardDescription>
              Update product details, availability, and coin discounts. Changes will be reflected on the homepage immediately.
            </CardDescription>
        </div>
         <Button onClick={handleAddProduct} disabled={isPending}>
            <PlusCircle className="mr-2 h-4 w-4"/>
            Add New Product
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {products.map((product) => (
          <form key={product._id} action={(formData) => handleUpdate(product._id, formData)}>
            <Card>
              <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="space-y-2 lg:col-span-2">
                  <Label htmlFor={`name-${product._id}`}>Product Name</Label>
                  <Input
                    id={`name-${product._id}`}
                    name="name"
                    defaultValue={product.name}
                  />
                </div>
                 <div className="space-y-2">
                  <Label htmlFor={`displayOrder-${product._id}`}>Display Order</Label>
                  <Input
                    id={`displayOrder-${product._id}`}
                    name="displayOrder"
                    type="number"
                    defaultValue={product.displayOrder}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`price-${product._id}`}>Price (₹)</Label>
                  <Input
                    id={`price-${product._id}`}
                    name="price"
                    type="number"
                    step="0.01"
                    defaultValue={product.price}
                  />
                </div>
                 <div className="space-y-2">
                  <Label htmlFor={`coins-${product._id}`} className="flex items-center gap-1"><Coins className="w-4 h-4 text-amber-500" /> Applicable Coins</Label>
                  <Input
                    id={`coins-${product._id}`}
                    name="coinsApplicable"
                    type="number"
                    step="1"
                    defaultValue={product.coinsApplicable}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`quantity-${product._id}`}>Quantity</Label>
                  <Input
                    id={`quantity-${product._id}`}
                    name="quantity"
                    type="number"
                    step="1"
                    defaultValue={product.quantity}
                  />
                </div>
                <div className="space-y-2 lg:col-span-2">
                  <Label htmlFor={`imageUrl-${product._id}`}>Image URL</Label>
                  <Input
                    id={`imageUrl-${product._id}`}
                    name="imageUrl"
                    defaultValue={product.imageUrl}
                  />
                </div>
                 <div className="space-y-2">
                  <Label htmlFor={`endDate-${product._id}`}>End Date (Optional)</Label>
                  <Input
                    id={`endDate-${product._id}`}
                    name="endDate"
                    type="datetime-local"
                    defaultValue={formatDateForInput(product.endDate)}
                  />
                </div>

                <div className="flex items-end justify-between">
                    <div className="space-y-2">
                        <Label htmlFor={`isAvailable-${product._id}`}>Available</Label>
                        <div className="flex items-center h-10">
                            <Switch
                            id={`isAvailable-${product._id}`}
                            name="isAvailable"
                            defaultChecked={product.isAvailable}
                            />
                        </div>
                    </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between bg-muted/40 p-4">
                 <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="destructive" type="button" disabled={isPending}>
                            <Trash2 className="mr-2 h-4 w-4" /> Vanish
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will hide the product from the storefront. You can restore it from the "Vanished Products" page.
                        </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleVanish(product._id)}>
                            Yes, Vanish Product
                        </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
                <Button type="submit" disabled={isPending}>
                  {isPending ? <Loader2 className="animate-spin mr-2" /> : null} Save Changes
                </Button>
              </CardFooter>
            </Card>
          </form>
        ))}
      </CardContent>
    </Card>
  );
}

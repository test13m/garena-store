
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
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';


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
  const [isAddProductDialogOpen, setIsAddProductDialogOpen] = useState(false);


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
  
  const handleAddProduct = (isCoinProduct: boolean) => {
    startTransition(async () => {
        const result = await addProduct(isCoinProduct);
        if (result.success) {
            toast({ title: 'Success', description: 'New product added. Please refresh to see it.' });
            setIsAddProductDialogOpen(false);
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
        <Dialog open={isAddProductDialogOpen} onOpenChange={setIsAddProductDialogOpen}>
            <DialogTrigger asChild>
                <Button disabled={isPending}>
                    <PlusCircle className="mr-2 h-4 w-4"/>
                    Add New Product
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add a New Product</DialogTitle>
                    <DialogDescription>
                        Choose the type of product you want to add.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter className="gap-4">
                    <Button onClick={() => handleAddProduct(false)} disabled={isPending}>Normal Product</Button>
                    <Button onClick={() => handleAddProduct(true)} variant="secondary" disabled={isPending}>Coin Product</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="space-y-6">
        {products.map((product) => (
          <form key={product._id} action={(formData) => handleUpdate(product._id.toString(), formData)}>
            <input type="hidden" name="isCoinProduct" value={String(!!product.isCoinProduct)} />
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
                  <Label htmlFor={`price-${product._id}`}>Original Price (₹)</Label>
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
                    disabled={product.isCoinProduct}
                  />
                </div>
                 {product.isCoinProduct && (
                   <div className="space-y-2">
                        <Label htmlFor={`purchasePrice-${product._id}`}>Purchase Price (₹)</Label>
                        <Input
                            id={`purchasePrice-${product._id}`}
                            name="purchasePrice"
                            type="number"
                            step="0.01"
                            defaultValue={product.purchasePrice}
                            required
                        />
                    </div>
                 )}
                <div className="space-y-2">
                  <Label htmlFor={`quantity-${product._id}`}>{product.isCoinProduct ? 'Coins to Give' : 'Quantity'}</Label>
                  <Input
                    id={`quantity-${product._id}`}
                    name="quantity"
                    type="number"
                    step="1"
                    defaultValue={product.quantity}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`category-${product._id}`}>Category</Label>
                  <Input
                    id={`category-${product._id}`}
                    name="category"
                    defaultValue={product.category}
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

                <div className="flex items-end justify-between space-x-4">
                    <div className="space-y-2">
                        <Label htmlFor={`isAvailable-${product._id}`}>Available</Label>
                        <div className="flex items-center h-10">
                            <Switch id={`isAvailable-${product._id}`} name="isAvailable" defaultChecked={product.isAvailable} />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor={`onlyUpi-${product._id}`}>Only UPI</Label>
                        <div className="flex items-center h-10">
                            <Switch id={`onlyUpi-${product._id}`} name="onlyUpi" defaultChecked={product.onlyUpi} />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor={`oneTimeBuy-${product._id}`}>1 Time Buy</Label>
                        <div className="flex items-center h-10">
                            <Switch id={`oneTimeBuy-${product._id}`} name="oneTimeBuy" defaultChecked={product.oneTimeBuy} />
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
                        <AlertDialogAction onClick={() => handleVanish(product._id.toString())}>
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

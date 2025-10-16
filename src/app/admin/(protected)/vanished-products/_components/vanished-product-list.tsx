'use client';

import { useState, useTransition } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, ArchiveRestore, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { restoreProduct } from '@/app/actions';
import type { Product } from '@/lib/definitions';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { deleteProductPermanently } from '../actions';


interface VanishedProductListProps {
  initialProducts: Product[];
}

export default function VanishedProductList({ initialProducts }: VanishedProductListProps) {
  const [products, setProducts] = useState(initialProducts);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleRestore = (productId: string) => {
    startTransition(async () => {
      const result = await restoreProduct(productId);
      if (result.success) {
        toast({ title: 'Success', description: 'Product restored successfully.' });
        setProducts(products.filter(p => p._id !== productId));
      } else {
        toast({ variant: 'destructive', title: 'Error', description: result.message });
      }
    });
  };

  const handleDelete = (productId: string) => {
    startTransition(async () => {
      const result = await deleteProductPermanently(productId);
      if (result.success) {
        toast({ title: 'Success', description: 'Product permanently deleted.' });
        setProducts(products.filter(p => p._id.toString() !== productId));
      } else {
        toast({ variant: 'destructive', title: 'Error', description: result.message });
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vanished Products</CardTitle>
        <CardDescription>
          These products are hidden from the storefront. You can restore them or delete them permanently.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {products.length === 0 ? (
          <p className="text-muted-foreground">No vanished products.</p>
        ) : (
          <div className="space-y-4">
            {products.map((product) => (
              <Card key={product._id.toString()} className="flex items-center justify-between p-4">
                <div>
                  <p className="font-semibold">{product.name}</p>
                  <p className="text-sm text-muted-foreground">Price: ${product.price}</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button 
                    onClick={() => handleRestore(product._id.toString())} 
                    disabled={isPending}
                    variant="outline"
                    >
                    {isPending ? <Loader2 className="animate-spin" /> : <ArchiveRestore className="mr-2" />}
                    Restore
                    </Button>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" disabled={isPending}>
                                <Trash2 className="mr-2 h-4 w-4" /> Delete Permanently
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This action cannot be undone. This will permanently delete the product "{product.name}" from the database.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(product._id.toString())}>
                                    Yes, Delete Product
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

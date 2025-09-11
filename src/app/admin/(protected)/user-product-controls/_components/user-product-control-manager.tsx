'use client';

import { useState, useTransition } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Search, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { findUserAndProductsForControl, setControlRule, deleteControlRule } from '@/app/actions';
import type { User, Product, UserProductControl } from '@/lib/definitions';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

interface UserProductControlManagerProps {
    initialRules: UserProductControl[];
}

export default function UserProductControlManager({ initialRules }: UserProductControlManagerProps) {
    const [rules, setRules] = useState(initialRules);
    const [isSearching, startSearchTransition] = useTransition();
    const [isSubmitting, startSubmitTransition] = useTransition();
    const [isDeleting, startDeleteTransition] = useTransition();
    const { toast } = useToast();

    const [gamingId, setGamingId] = useState('');
    const [foundUser, setFoundUser] = useState<User | null>(null);
    const [products, setProducts] = useState<Product[]>([]);
    const [selectedProduct, setSelectedProduct] = useState('');

    const [ruleType, setRuleType] = useState<'block' | 'allowPurchase' | 'hideProduct'>('block');
    const [reason, setReason] = useState('');
    const [customReason, setCustomReason] = useState('');
    const [allowance, setAllowance] = useState(1);

    const presetReasons = ["Already purchased", "Item unavailable", "It's not for you", "You are blocked from buying this"];
    
    const handleSearch = async () => {
        if (!gamingId) {
            toast({ variant: 'destructive', title: 'Error', description: 'Please enter a Gaming ID.' });
            return;
        }
        startSearchTransition(async () => {
            const result = await findUserAndProductsForControl(gamingId);
            if (result.success && result.user && result.products) {
                setFoundUser(result.user);
                setProducts(result.products);
                toast({ title: 'User Found', description: `Controls can now be set for ${gamingId}.`});
            } else {
                setFoundUser(null);
                setProducts([]);
                toast({ variant: 'destructive', title: 'Error', description: result.message });
            }
        });
    };
    
    const handleSubmitRule = async (formData: FormData) => {
        if (!foundUser || !selectedProduct) {
            toast({ variant: 'destructive', title: 'Error', description: 'A user and product must be selected.' });
            return;
        }

        formData.append('gamingId', foundUser.gamingId);
        formData.append('productId', selectedProduct);
        formData.append('type', ruleType);

        if (ruleType === 'block') {
            const finalReason = reason === 'custom' ? customReason : reason;
            if (!finalReason) {
                toast({ variant: 'destructive', title: 'Error', description: 'A reason must be provided for blocking.' });
                return;
            }
            formData.append('reason', finalReason);
        } else if (ruleType === 'allowPurchase') {
            formData.append('allowance', String(allowance));
        }

        startSubmitTransition(async () => {
            const result = await setControlRule(formData);
            if (result.success) {
                toast({ title: 'Success', description: result.message });
                // Simple reload to refetch active rules list
                window.location.reload(); 
            } else {
                toast({ variant: 'destructive', title: 'Error', description: result.message });
            }
        });
    };
    
    const handleDeleteRule = async (ruleId: string) => {
        startDeleteTransition(async () => {
            const result = await deleteControlRule(ruleId);
             if (result.success) {
                toast({ title: 'Success', description: result.message });
                setRules(prev => prev.filter(r => r._id.toString() !== ruleId));
            } else {
                toast({ variant: 'destructive', title: 'Error', description: result.message });
            }
        });
    }
    
    const getRuleDescription = (rule: UserProductControl) => {
        switch (rule.type) {
            case 'block':
                return `Blocked (${rule.blockReason})`;
            case 'allowPurchase':
                return `Allowance (${rule.allowanceCount} purchases)`;
            case 'hideProduct':
                return 'Product Hidden';
            default:
                return 'Unknown Rule';
        }
    }

    return (
        <div className="space-y-8">
            <Card>
                <CardHeader>
                    <CardTitle>Set New User-Product Rule</CardTitle>
                    <CardDescription>Block a user from purchasing a specific product or override a one-time purchase limit.</CardDescription>
                </CardHeader>
                <form action={handleSubmitRule}>
                    <CardContent className="space-y-4">
                        <div className="flex items-end gap-2">
                            <div className="flex-grow space-y-2">
                                <Label htmlFor="gamingId">User's Gaming ID</Label>
                                <Input id="gamingId" value={gamingId} onChange={(e) => setGamingId(e.target.value)} placeholder="Enter Gaming ID"/>
                            </div>
                            <Button type="button" onClick={handleSearch} disabled={isSearching}>
                                {isSearching ? <Loader2 className="animate-spin"/> : <Search />}
                                Search
                            </Button>
                        </div>
                        
                        {foundUser && (
                           <div className="p-4 border rounded-md bg-muted/50 space-y-4">
                                <p className="font-semibold">Setting rule for: <span className="font-mono">{foundUser.gamingId}</span></p>

                                <div className="space-y-2">
                                    <Label htmlFor="product-select">Select Product</Label>
                                    <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                                        <SelectTrigger id="product-select"><SelectValue placeholder="Choose a product..." /></SelectTrigger>
                                        <SelectContent>
                                            {products.map(p => <SelectItem key={p._id.toString()} value={p._id.toString()}>{p.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                
                                <div className="space-y-2">
                                    <Label>Rule Type</Label>
                                    <Select value={ruleType} onValueChange={(v) => setRuleType(v as any)}>
                                        <SelectTrigger><SelectValue/></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="block">Block Purchase</SelectItem>
                                            <SelectItem value="allowPurchase">Override One-Time-Buy</SelectItem>
                                            <SelectItem value="hideProduct">Hide Product</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                
                                {ruleType === 'block' && (
                                    <div className="space-y-2">
                                        <Label>Block Reason</Label>
                                        <Select value={reason} onValueChange={setReason}>
                                            <SelectTrigger><SelectValue placeholder="Select a preset reason..." /></SelectTrigger>
                                            <SelectContent>
                                                {presetReasons.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                                                <SelectItem value="custom">Custom Reason</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        {reason === 'custom' && (
                                            <Input placeholder="Enter custom reason" value={customReason} onChange={e => setCustomReason(e.target.value)}/>
                                        )}
                                    </div>
                                )}
                                
                                {ruleType === 'allowPurchase' && (
                                    <div className="space-y-2">
                                        <Label>Number of Extra Purchases to Allow</Label>
                                        <Input type="number" min="1" value={allowance} onChange={e => setAllowance(Number(e.target.value))}/>
                                    </div>
                                )}
                           </div>
                        )}
                    </CardContent>
                    <CardFooter>
                       <Button type="submit" disabled={!foundUser || !selectedProduct || isSubmitting}>
                         {isSubmitting && <Loader2 className="animate-spin mr-2" />}
                         Save Rule
                       </Button>
                    </CardFooter>
                </form>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Active Control Rules</CardTitle>
                    <CardDescription>List of all currently active user-product restrictions and allowances.</CardDescription>
                </CardHeader>
                <CardContent>
                    {rules.length === 0 ? (
                        <p className="text-muted-foreground text-center">No active rules.</p>
                    ) : (
                        <div className="space-y-2">
                           {rules.map(rule => (
                                <div key={rule._id.toString()} className="flex items-center justify-between p-3 border rounded-md bg-muted/20">
                                    <div>
                                        <p><strong>User:</strong> <span className="font-mono">{rule.gamingId}</span></p>
                                        <p><strong>Product:</strong> {rule.productName}</p>
                                        <p><strong>Rule:</strong> <span className="capitalize font-semibold">{getRuleDescription(rule)}</span></p>
                                    </div>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="destructive" size="icon" disabled={isDeleting}><Trash2/></Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                <AlertDialogDescription>This action will permanently remove this control rule.</AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => handleDeleteRule(rule._id.toString())}>Delete Rule</AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </div>
                           ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

'use client';

import { useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { saveAdSettings } from '../actions';
import type { CustomAd } from '@/lib/definitions';
import { Loader2, Save } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" className="w-full" disabled={pending}>
            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {pending ? 'Saving...' : 'Save & Activate Ad'}
        </Button>
    )
}

const initialState = { success: false, message: '' };

interface AdManagerProps {
    initialAdSettings: CustomAd | null;
}

export default function AdManager({ initialAdSettings }: AdManagerProps) {
    const [state, formAction] = useActionState(saveAdSettings, initialState);
    const { toast } = useToast();

    useEffect(() => {
        if (state.message) {
            toast({
                variant: state.success ? 'default' : 'destructive',
                title: state.success ? 'Success' : 'Error',
                description: state.message,
            });
        }
    }, [state, toast]);

    return (
        <Card className="max-w-4xl mx-auto">
            <CardHeader>
                <CardTitle>Custom Ad Management</CardTitle>
                <CardDescription>Configure the video ad that users will see. Saving these settings will immediately set it as the new active ad.</CardDescription>
            </CardHeader>
            <form action={formAction}>
                <CardContent className="space-y-8">
                    {/* Video Settings */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-medium">Video & Link</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="videoUrl">Ad Video URL</Label>
                                <Input id="videoUrl" name="videoUrl" placeholder="https://example.com/ad.mp4" defaultValue={initialAdSettings?.videoUrl} required />
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="ctaLink">Button Click Link</Label>
                                <Input id="ctaLink" name="ctaLink" placeholder="https://product-landing-page.com" defaultValue={initialAdSettings?.ctaLink} required />
                            </div>
                        </div>
                    </div>
                    
                    {/* CTA Button Settings */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-medium">Call-to-Action Button</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="ctaText">Button Text</Label>
                                <Input id="ctaText" name="ctaText" placeholder="e.g., Install Now" defaultValue={initialAdSettings?.ctaText} required />
                            </div>
                            <div className="space-y-2">
                                <Label>Button Shape</Label>
                                <RadioGroup name="ctaShape" defaultValue={initialAdSettings?.ctaShape || 'rounded'} className="flex gap-4 pt-2">
                                    <Label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="pill" /> Pill</Label>
                                    <Label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="rounded" /> Rounded</Label>
                                    <Label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="square" /> Square</Label>
                                </RadioGroup>
                            </div>
                             <div className="space-y-2">
                                <Label>Button Color</Label>
                                <RadioGroup name="ctaColor" defaultValue={initialAdSettings?.ctaColor || 'primary'} className="flex gap-4 pt-2">
                                    <Label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="primary" /> Primary</Label>
                                    <Label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="destructive" /> Destructive</Label>
                                    <Label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="outline" /> Outline</Label>
                                </RadioGroup>
                            </div>
                        </div>
                         <div className="flex items-center space-x-2 pt-4">
                            <Checkbox id="hideCtaButton" name="hideCtaButton" defaultChecked={initialAdSettings?.hideCtaButton} />
                            <Label htmlFor="hideCtaButton" className="cursor-pointer">Hide CTA Button (video will be clickable)</Label>
                        </div>
                    </div>

                     {/* Timing Settings */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-medium">Timing (in seconds)</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="totalDuration">Total Ad Duration</Label>
                                <Input id="totalDuration" name="totalDuration" type="number" min="5" placeholder="e.g., 30" defaultValue={initialAdSettings?.totalDuration || 30} required />
                                <p className="text-xs text-muted-foreground">The page will auto-close after this many seconds.</p>
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="rewardTime">Reward Generation Time</Label>
                                <Input id="rewardTime" name="rewardTime" type="number" min="1" placeholder="e.g., 15" defaultValue={initialAdSettings?.rewardTime || 15} required />
                                <p className="text-xs text-muted-foreground">Coins are given and "Skip Ad" button appears at this time.</p>
                            </div>
                        </div>
                    </div>
                </CardContent>
                <CardFooter>
                    <SubmitButton />
                </CardFooter>
            </form>
        </Card>
    );
}

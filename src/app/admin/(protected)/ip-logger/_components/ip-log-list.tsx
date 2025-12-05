

'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Loader2, Search, History, Fingerprint } from 'lucide-react';
import { getIpHistory } from '../actions';
import { Input } from '@/components/ui/input';
import { type User } from '@/lib/definitions';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';

interface IpLogListProps {
  initialUsers: any[];
  initialHasMore: boolean;
  totalUsers: number;
}

const FormattedDate = ({ dateString }: { dateString?: string }) => {
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    if (!mounted || !dateString) return <span className="text-muted-foreground">N/A</span>;
    const date = new Date(dateString);
    return date.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
    });
}

export default function IpLogList({ initialUsers, initialHasMore, totalUsers }: IpLogListProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    
    const [users, setUsers] = useState(initialUsers);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(initialHasMore);
    const [isPending, startTransition] = useTransition();

    const searchIp = searchParams.get('ip') || '';
    const searchId = searchParams.get('id') || '';
    const searchFingerprint = searchParams.get('fingerprint') || '';

    useEffect(() => {
        setUsers(initialUsers);
        setHasMore(initialHasMore);
        setPage(1);
    }, [initialUsers, initialHasMore]);

    const handleLoadMore = async () => {
        startTransition(async () => {
            const nextPage = page + 1;
            const { users: newUsers, hasMore: newHasMore } = await getIpHistory(nextPage, searchId, searchIp, searchFingerprint);
            setUsers(prev => [...prev, ...newUsers]);
            setHasMore(newHasMore);
            setPage(nextPage);
        });
    };

    const handleSearch = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const ipQuery = formData.get('ip') as string;
        const idQuery = formData.get('id') as string;
        const fingerprintQuery = formData.get('fingerprint') as string;
        const params = new URLSearchParams();
        if (ipQuery) params.set('ip', ipQuery);
        if (idQuery) params.set('id', idQuery);
        if (fingerprintQuery) params.set('fingerprint', fingerprintQuery);
        router.push(`${pathname}?${params.toString()}`);
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div className="flex items-center gap-2">
                           <CardTitle>User Security Logs</CardTitle>
                            {totalUsers !== undefined && (
                                <Badge variant="secondary">{totalUsers} Users</Badge>
                            )}
                        </div>
                        <form onSubmit={handleSearch} className="flex flex-wrap items-end gap-2">
                            <div className="flex-grow space-y-1">
                                <Label htmlFor="search-id">Gaming ID</Label>
                                <Input name="id" id="search-id" placeholder="Search by Gaming ID..." defaultValue={searchId} className="w-full sm:w-40"/>
                            </div>
                            <div className="flex-grow space-y-1">
                                <Label htmlFor="search-ip">IP Address</Label>
                                <Input name="ip" id="search-ip" placeholder="Search by IP..." defaultValue={searchIp} className="w-full sm:w-40"/>
                            </div>
                            <div className="flex-grow space-y-1">
                                <Label htmlFor="search-fingerprint">Fingerprint ID</Label>
                                <Input name="fingerprint" id="search-fingerprint" placeholder="Search by Fingerprint..." defaultValue={searchFingerprint} className="w-full sm:w-40"/>
                            </div>
                            <Button type="submit" variant="outline" size="icon"><Search className="h-4 w-4" /></Button>
                        </form>
                    </div>
                </CardHeader>
                <CardContent>
                    {users.length === 0 ? (
                        <p className="text-muted-foreground text-center py-8">No users found for this search.</p>
                    ) : (
                        <div className="space-y-4">
                            {users.map(user => (
                                <Card key={user._id.toString()}>
                                    <CardHeader className="pb-4">
                                        <div className="flex justify-between items-center">
                                            <CardTitle className="text-base font-mono">{user.gamingId}</CardTitle>
                                            <div className="flex items-center gap-2">
                                                <Dialog>
                                                    <DialogTrigger asChild>
                                                        <Button variant="outline" size="sm" className="gap-2">
                                                            <History className="h-4 w-4"/>
                                                            IP History ({user.ipHistory?.length || 0})
                                                        </Button>
                                                    </DialogTrigger>
                                                    <DialogContent>
                                                        <DialogHeader>
                                                            <DialogTitle>IP History for {user.gamingId}</DialogTitle>
                                                            <DialogDescription>
                                                                A log of all IPs used by this user, most recent first.
                                                            </DialogDescription>
                                                        </DialogHeader>
                                                        <ScrollArea className="h-72">
                                                            <div className="space-y-2 pr-4">
                                                                {user.ipHistory && user.ipHistory.length > 0 ? (
                                                                    user.ipHistory.slice().reverse().map((entry: any, index: number) => (
                                                                        <div key={index} className="flex justify-between items-center text-sm p-2 rounded-md bg-muted/50">
                                                                            <p className="font-mono">{entry.ip}</p>
                                                                            <p className="text-xs text-muted-foreground"><FormattedDate dateString={entry.timestamp} /></p>
                                                                        </div>
                                                                    ))
                                                                ) : (
                                                                    <p className="text-muted-foreground text-center py-8">No IP history for this user.</p>
                                                                )}
                                                            </div>
                                                        </ScrollArea>
                                                    </DialogContent>
                                                </Dialog>
                                                <Dialog>
                                                    <DialogTrigger asChild>
                                                         <Button variant="outline" size="sm" className="gap-2">
                                                            <Fingerprint className="h-4 w-4"/>
                                                            Devices ({user.fingerprintHistory?.length || 0})
                                                        </Button>
                                                    </DialogTrigger>
                                                    <DialogContent>
                                                        <DialogHeader>
                                                            <DialogTitle>Device History for {user.gamingId}</DialogTitle>
                                                            <DialogDescription>
                                                                A log of all device fingerprints used by this user, most recent first.
                                                            </DialogDescription>
                                                        </DialogHeader>
                                                        <ScrollArea className="h-72">
                                                            <div className="space-y-2 pr-4">
                                                                {user.fingerprintHistory && user.fingerprintHistory.length > 0 ? (
                                                                    user.fingerprintHistory.slice().reverse().map((entry: any, index: number) => (
                                                                        <div key={index} className="flex justify-between items-center text-sm p-2 rounded-md bg-muted/50">
                                                                            <p className="font-mono text-xs truncate">{entry.fingerprint}</p>
                                                                            <p className="text-xs text-muted-foreground shrink-0 ml-2"><FormattedDate dateString={entry.timestamp} /></p>
                                                                        </div>
                                                                    ))
                                                                ) : (
                                                                    <p className="text-muted-foreground text-center py-8">No device history for this user.</p>
                                                                )}
                                                            </div>
                                                        </ScrollArea>
                                                    </DialogContent>
                                                </Dialog>
                                            </div>
                                        </div>
                                    </CardHeader>
                                </Card>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {hasMore && (
                <div className="text-center">
                    <Button onClick={handleLoadMore} disabled={isPending}>
                        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Load More
                    </Button>
                </div>
            )}
        </div>
    );
}


'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { markNotificationsAsRead, getNotificationsForUser } from '@/app/actions';
import type { Notification } from '@/lib/definitions';
import Image from 'next/image';

interface NotificationBellProps {
  notifications: Notification[];
  onRefresh: () => void;
}

const FormattedDate = ({ dateString }: { dateString: string }) => {
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    if (!mounted) {
        return null;
    }
    const date = new Date(dateString);
    return date.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
    });
}

const ClickableMessage = ({ message }: { message: string }) => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = message.split(urlRegex);

  return (
    <p className="text-sm mb-2 font-sans">
      {parts.map((part, index) => {
        if (part.match(urlRegex)) {
          return (
            <a
              key={index}
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
              onClick={(e) => e.stopPropagation()} // Prevent sheet from closing
            >
              {part}
            </a>
          );
        }
        return part;
      })}
    </p>
  );
};


export default function NotificationBell({ notifications: initialNotifications, onRefresh }: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentNotifications, setCurrentNotifications] = useState(initialNotifications);

  const unreadCount = useMemo(() => {
    return currentNotifications.filter(n => !n.isRead).length;
  }, [currentNotifications]);
  
  useEffect(() => {
    setCurrentNotifications(initialNotifications);
  }, [initialNotifications]);

  const handleOpenChange = async (open: boolean) => {
    setIsOpen(open);
    if (open && unreadCount > 0) {
      // Optimistically update the UI
      setCurrentNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      // Update the server in the background
      await markNotificationsAsRead();
    }
    
    // Refresh data from server when closing to ensure consistency
    if (!open) {
      onRefresh();
    }
  }

  if (initialNotifications.length === 0) {
    return null;
  }

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-0 right-0 inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold leading-none text-red-100 transform translate-x-1/3 -translate-y-1/3 bg-red-600 rounded-full">
              {unreadCount}
            </span>
          )}
          <span className="sr-only">Notifications</span>
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader className="mb-4">
          <SheetTitle>Notifications</SheetTitle>
          <SheetDescription>Here are your recent notifications from Garena.</SheetDescription>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-150px)] pr-4 -mr-6">
          <div className="space-y-4 pb-8">
            {currentNotifications.map((notification) => (
              <div key={notification._id.toString()} className="p-4 rounded-lg border bg-card text-card-foreground shadow-sm">
                <ClickableMessage message={notification.message} />
                {notification.imageUrl && (
                  <div className="relative aspect-video w-full mb-2">
                    <Image src={notification.imageUrl} alt="Notification Image" layout="fill" className="rounded-md object-cover" />
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-2">
                  <FormattedDate dateString={notification.createdAt as unknown as string} />
                </p>
              </div>
            ))}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

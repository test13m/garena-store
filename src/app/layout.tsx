'use client';

import './globals.css';
import { cn } from '@/lib/utils';
import { Toaster } from '@/components/ui/toaster';
import Header from '@/components/layout/header';
import Footer from '@/components/layout/footer';
import { useState, useEffect } from 'react';
import LoadingScreen from '@/components/loading-screen';
import { getNotificationsForUser, getUserData, markNotificationAsRead } from './actions';
import type { Notification, User } from '@/lib/definitions';
import PopupNotification from '@/components/popup-notification';


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [standardNotifications, setStandardNotifications] = useState<Notification[]>([]);
  const [popupNotifications, setPopupNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    const fetchInitialData = async () => {
      const userData = await getUserData();
      setUser(userData);
      if (userData) {
        const allNotifications = await getNotificationsForUser();
        // Separate notifications into standard and popup
        const standard = allNotifications.filter(n => !n.isPopup);
        const popups = allNotifications.filter(n => n.isPopup && !n.isRead);

        setStandardNotifications(standard);
        setPopupNotifications(popups);
      }
    };

    fetchInitialData();

    // Simulate loading time
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1000); // Animation is 1s and runs once, so 1s total

    return () => clearTimeout(timer);
  }, []);

  const handlePopupClose = async (notificationId: string) => {
    // Mark the notification as read on the server
    await markNotificationAsRead(notificationId);
    // Remove the closed notification from the local state to show the next one
    setPopupNotifications(prev => prev.filter(n => n._id.toString() !== notificationId));
  };

  return (
    <html lang="en" className="h-full">
      <head>
        <meta charSet="UTF-8" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&family=Noto+Sans:wght@400;700&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=PT+Sans:wght@400;700&display=swap" rel="stylesheet" />
      </head>
      <body className={cn('font-body antialiased flex flex-col min-h-screen')}>
        {isLoading && <LoadingScreen />}
        <div className={cn(isLoading ? 'hidden' : 'flex flex-col flex-1')}>
          <Header user={user} notifications={standardNotifications} />
          <main className="flex-grow">{children}</main>
          <Footer />
        </div>
        <Toaster />
        {popupNotifications.length > 0 && (
          <PopupNotification
            notification={popupNotifications[0]}
            onClose={() => handlePopupClose(popupNotifications[0]._id.toString())}
          />
        )}
      </body>
    </html>
  );
}

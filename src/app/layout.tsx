
'use client';

import * as React from 'react';
import './globals.css';
import { cn } from '@/lib/utils';
import { Toaster } from '@/components/ui/toaster';
import Header from '@/components/layout/header';
import Footer from '@/components/layout/footer';
import { useState, useEffect, useCallback } from 'react';
import LoadingScreen from '@/components/loading-screen';
import { getEvents, getNotificationsForUser, getUserData, markNotificationAsRead, saveFcmToken } from './actions';
import type { Event, Notification, User } from '@/lib/definitions';
import PopupNotification from '@/components/popup-notification';
import EventModal from '@/components/event-modal';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { app } from '@/lib/firebase/client';
import { RefreshProvider } from '@/context/RefreshContext';
import { usePathname } from 'next/navigation';
import BannedNotice from '@/components/banned-notice';
import { useToast } from '@/hooks/use-toast';


const FCM_TOKEN_KEY = 'fcm_token';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [standardNotifications, setStandardNotifications] = useState<Notification[]>([]);
  const [popupNotifications, setPopupNotifications] = useState<Notification[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [currentEventIndex, setCurrentEventIndex] = useState(0);
  const [showEventModal, setShowEventModal] = useState(false);
  const [notificationKey, setNotificationKey] = useState(0);
  const [bannedInfo, setBannedInfo] = useState<{ message: string, id: string } | null>(null);
  const { toast } = useToast();


  const pathname = usePathname();
  const isAdPage = pathname === '/watch-ad';


  const fetchInitialData = useCallback(async (isInitialLoad = false) => {
    if (isInitialLoad) {
      setIsLoading(true);
    }
    const userData = await getUserData();
    setUser(userData);

    if (userData?.isBanned) {
      setBannedInfo({ id: userData.visualGamingId || userData.gamingId, message: userData.banMessage || 'Your account has been suspended.'});
      setIsLoading(false);
      return;
    }
    
    const allEvents = await getEvents();
    if (typeof window !== 'undefined') {
        const eventsSeen = sessionStorage.getItem('eventsSeen');
        if (!eventsSeen) {
          setEvents(allEvents);
          if(userData && allEvents.length > 0) {
              setShowEventModal(true);
          }
        }
    }

    if (userData) {
      const allNotifications = await getNotificationsForUser();
      const standard = allNotifications.filter(n => !n.isPopup);
      const popups = allNotifications.filter(n => n.isPopup && !n.isRead);

      setStandardNotifications(standard);
      setPopupNotifications(popups);
    }
    if (isInitialLoad) {
      setIsLoading(false);
    }
  }, []);

  const handleNotificationRefresh = useCallback(async () => {
    if (user) {
        const allNotifications = await getNotificationsForUser();
        setStandardNotifications(allNotifications.filter(n => !n.isPopup));
    }
    setNotificationKey(prevKey => prevKey + 1);
  }, [user]);

  const onUserRegistered = useCallback(async () => {
    // Re-fetch all data when a user registers
    await fetchInitialData(true);
  }, [fetchInitialData]);


  const requestNotificationPermission = useCallback(async () => {
    try {
        const isFCMSupported = await isSupported();
        if (isFCMSupported && typeof window !== 'undefined' && 'serviceWorker' in navigator && 'Notification' in window) {
            const messaging = getMessaging(app);
            
            await navigator.serviceWorker.register('/firebase-messaging-sw.js');
            const swRegistration = await navigator.serviceWorker.ready;
            
            const permission = await Notification.requestPermission();
            
            if (permission === 'granted') {
              const currentToken = await getToken(messaging, { 
                  vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
                  serviceWorkerRegistration: swRegistration 
              });
              if (currentToken) {
                await saveFcmToken(currentToken);
                localStorage.setItem(FCM_TOKEN_KEY, currentToken);
                setUser(prevUser => prevUser ? { ...prevUser, fcmToken: currentToken } : null);
              }
            }
        }
    } catch (error) {
      console.error('An error occurred while setting up notifications. This might be an unsupported browser.', error);
    }
  }, []);

  useEffect(() => {
    fetchInitialData(true);

    // Set up foreground message listener
    isSupported().then(isFCMSupported => {
        if (isFCMSupported && typeof window !== 'undefined') {
             try {
                const messaging = getMessaging(app);
                const unsubscribe = onMessage(messaging, (payload) => {
                    fetchInitialData(false);
                    if (payload.data) {
                         toast({
                            title: payload.data.title,
                            description: payload.data.body,
                        });
                    }
                });
                return () => unsubscribe();
            } catch (error) {
                console.error("Firebase Messaging not initialized or failed to listen:", error);
            }
        }
    });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (user && typeof window !== 'undefined' && 'Notification' in window) {
        const localToken = localStorage.getItem(FCM_TOKEN_KEY);
        const permissionRevoked = Notification.permission !== 'granted' && user.fcmToken;
        const tokenMismatch = !user.fcmToken || localToken !== user.fcmToken;

        if (permissionRevoked || tokenMismatch) {
            requestNotificationPermission();
        }
    }
  }, [user, requestNotificationPermission]);


  const handlePopupClose = async (notificationId: string) => {
    await markNotificationAsRead(notificationId);
    setPopupNotifications(prev => prev.filter(n => n._id.toString() !== notificationId));
  };
  
  const handleEventClose = () => {
    const nextIndex = currentEventIndex + 1;
    if (nextIndex < events.length) {
      setCurrentEventIndex(nextIndex);
    } else {
      setShowEventModal(false);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('eventsSeen', 'true');
      }
    }
  };

  const childrenWithProps = React.Children.map(children, child => {
    if (React.isValidElement(child)) {
      return React.cloneElement(child as React.ReactElement<any>, { onUserRegistered });
    }
    return child;
  });

  return (
    <html lang="en" className="h-full">
      <head>
        <meta charSet="UTF-8" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&family=Noto+Sans:wght@400;700&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=PT+Sans:wght@400;700&display=swap" rel="stylesheet" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className={cn('font-body antialiased flex flex-col min-h-screen')}>
        <RefreshProvider>
          {isLoading && <LoadingScreen />}
          <div className={cn('flex flex-col flex-1', isAdPage && 'h-screen')}>
            {!isAdPage && (
              <Header 
                user={user} 
                notifications={standardNotifications} 
                notificationKey={notificationKey}
                onNotificationRefresh={handleNotificationRefresh}
              />
            )}
            <main className={cn('flex-grow', isAdPage && 'h-full')}>{childrenWithProps}</main>
            {!isAdPage && <Footer />}
          </div>
          <Toaster />
          {popupNotifications.length > 0 && (
            <PopupNotification
              notification={popupNotifications[0]}
              onClose={() => handlePopupClose(popupNotifications[0]._id.toString())}
            />
          )}
          {showEventModal && events.length > 0 && (
              <EventModal event={events[currentEventIndex]} onClose={handleEventClose} />
          )}
          <BannedNotice 
            isOpen={!!bannedInfo}
            onOpenChange={(open) => !open && setBannedInfo(null)}
            gamingId={bannedInfo?.id || ''}
            banMessage={bannedInfo?.message || ''}
          />
        </RefreshProvider>
      </body>
    </html>
  );
}

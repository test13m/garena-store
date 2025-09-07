
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
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { app } from '@/lib/firebase/client';

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

  const fetchInitialData = useCallback(async () => {
    const userData = await getUserData();
    setUser(userData);
    
    const allEvents = await getEvents();
    const eventsSeen = sessionStorage.getItem('eventsSeen');

    if (!eventsSeen) {
      setEvents(allEvents);
      if(allEvents.length > 0) {
          setShowEventModal(true);
      }
    }

    if (userData) {
      const allNotifications = await getNotificationsForUser();
      const standard = allNotifications.filter(n => !n.isPopup);
      const popups = allNotifications.filter(n => n.isPopup && !n.isRead);

      setStandardNotifications(standard);
      setPopupNotifications(popups);
    }
  }, []);

  const onUserRegistered = useCallback(async () => {
    // Re-fetch all data when a user registers
    setIsLoading(true);
    await fetchInitialData();
    setIsLoading(false);
  }, [fetchInitialData]);


  const requestNotificationPermission = useCallback(async () => {
    try {
      if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
        const messaging = getMessaging(app);
        
        // Wait for the service worker to be ready
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
            // Optimistically update user state to avoid re-prompting
            setUser(prevUser => prevUser ? { ...prevUser, fcmToken: currentToken } : null);
          }
        }
      }
    } catch (error) {
      console.error('An error occurred while retrieving token. ', error);
    }
  }, []);

  useEffect(() => {
    fetchInitialData();

    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1000); 

    // Set up foreground message listener
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
        const messaging = getMessaging(app);
        const unsubscribe = onMessage(messaging, (payload) => {
            console.log('Foreground message received.', payload);
            // When a foreground message is received, simply re-fetch notifications
            // to update the bell. This prevents a duplicate system notification.
            fetchInitialData();
        });
        return () => unsubscribe(); // Unsubscribe on cleanup
    }

    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (user && !user.fcmToken) {
      requestNotificationPermission();
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
      sessionStorage.setItem('eventsSeen', 'true');
    }
  };

  const childrenWithProps = React.Children.map(children, child => {
    if (React.isValidElement(child)) {
      // This is a bit of a hack to pass props to the page component
      // A better solution would involve a shared context (like React Context API)
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
          {isLoading && <LoadingScreen />}
          <div className={cn(isLoading ? 'hidden' : 'flex flex-col flex-1')}>
            <Header user={user} notifications={standardNotifications} />
            <main className="flex-grow">{childrenWithProps}</main>
            <Footer />
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
      </body>
    </html>
  );
}

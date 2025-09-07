'use client';

import './globals.css';
import { cn } from '@/lib/utils';
import { Toaster } from '@/components/ui/toaster';
import Header from '@/components/layout/header';
import Footer from '@/components/layout/footer';
import { useState, useEffect } from 'react';
import LoadingScreen from '@/components/loading-screen';
import { getEvents, getNotificationsForUser, getUserData, markNotificationAsRead, saveFcmToken } from './actions';
import type { Event, Notification, User } from '@/lib/definitions';
import PopupNotification from '@/components/popup-notification';
import EventModal from '@/components/event-modal';
import FirebaseMessagingProvider from '@/components/firebase-messaging-provider';
import { getMessaging, getToken } from 'firebase/messaging';
import { app } from '@/lib/firebase/client';
import { useToast } from '@/hooks/use-toast';

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
  const { toast } = useToast();

  const requestNotificationPermission = async () => {
    try {
      if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
        const messaging = getMessaging(app);
        
        // Wait for the service worker to be ready
        const swRegistration = await navigator.serviceWorker.ready;
        
        const permission = await Notification.requestPermission();
        
        if (permission === 'granted') {
          const currentToken = await getToken(messaging, { 
              vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
              serviceWorkerRegistration: swRegistration 
          });
          if (currentToken) {
            await saveFcmToken(currentToken);
          } else {
            console.log('No registration token available. Request permission to generate one.');
          }
        } else {
          console.log('Unable to get permission to notify.');
        }
      }
    } catch (error) {
      console.error('An error occurred while retrieving token. ', error);
      toast({
        variant: 'destructive',
        title: 'Notification Error',
        description: 'Could not set up push notifications.',
      });
    }
  };

  useEffect(() => {
    const fetchInitialData = async () => {
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
    };

    fetchInitialData();

    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1000); 

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // This effect runs when the user data is loaded
    if (user && !user.fcmToken) {
      // If user is logged in but doesn't have a token, ask for permission
      requestNotificationPermission();
    }
  }, [user]);


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
        <FirebaseMessagingProvider>
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
          {showEventModal && events.length > 0 && (
              <EventModal event={events[currentEventIndex]} onClose={handleEventClose} />
          )}
        </FirebaseMessagingProvider>
      </body>
    </html>
  );
}

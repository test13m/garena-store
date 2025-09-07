// DO NOT CHANGE: This file must be in the public folder.
// Otherwise, the service worker will not be able to register.

// Give the service worker access to Firebase Messaging.
importScripts('https://www.gstatic.com/firebasejs/9.2.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.2.0/firebase-messaging-compat.js');


// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAowX6z6IDuosoxlfclYkgof5HXC27UEmA",
  authDomain: "garena-gears.firebaseapp.com",
  projectId: "garena-gears",
  storageBucket: "garena-gears.appspot.com",
  messagingSenderId: "93335858315",
  appId: "1:93335858315:web:9ef6be42c3b81a236ab88e"
};


// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();


self.addEventListener('push', function(event) {
  let notificationData = {};
  try {
    notificationData = event.data.json().data;
  } catch (e) {
    notificationData = {
      title: 'Garena Gears',
      body: 'You have a new message.'
    };
  }

  const { title, body, image, link } = notificationData;

  const notificationOptions = {
    body: body,
    icon: '/img/garena.png', // Main small icon
    badge: '/img/garena.png', // Small icon for the notification bar on Android
    image: image, // Optional large image
    data: {
      url: link || '/'
    }
  };

  event.waitUntil(
    self.registration.showNotification(title, notificationOptions)
  );
});


self.addEventListener('notificationclick', function(event) {
  event.notification.close(); // Close the notification

  const urlToOpen = event.notification.data.url || '/';

  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then(function(clientList) {
      // If a window is already open, focus it
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise, open a new window
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
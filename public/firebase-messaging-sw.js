// Scripts for firebase and firebase messaging
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// Initialize the Firebase app in the service worker by passing in the messagingSenderId.
const firebaseConfig = {
  apiKey: "AIzaSyAowX6z6IDuosoxlfclYkgof5HXC27UEmA",
  authDomain: "garena-gears.firebaseapp.com",
  projectId: "garena-gears",
  storageBucket: "garena-gears.firebasestorage.app",
  messagingSenderId: "93335858315",
  appId: "1:93335858315:web:9ef6be42c3b81a236ab88e"
};


firebase.initializeApp(firebaseConfig);


// Retrieve an instance of Firebase Messaging so that it can handle background messages.
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log(
    '[firebase-messaging-sw.js] Received background message ',
    payload
  );
  // Customize notification here
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: payload.notification.image || '/img/garena.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

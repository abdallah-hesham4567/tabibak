importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyAEz3mVDyuZCJZwKlBnDuWd1JARbMAI6S0",
  authDomain: "tabibak-b4a37.firebaseapp.com",
  projectId: "tabibak-b4a37",
  storageBucket: "tabibak-b4a37.firebasestorage.app",
  messagingSenderId: "130423014476",
  appId: "1:130423014476:web:03b7cfb841cc48fd1320e9",
  measurementId: "G-YV2DHXCGDH"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.data?.title || 'تذكير بموعد الدواء';
  const notificationOptions = {
    body: payload.data?.body || 'حان الوقت لتناول جرعتك الدوائية المجدولة.',
    icon: 'https://cdn-icons-png.flaticon.com/512/1930/1930985.png',
    badge: 'https://cdn-icons-png.flaticon.com/512/1930/1930985.png',
    tag: payload.data?.medicationId || 'medication-reminder',
    renotify: true,
    data: payload.data || {}
  };
  return self.registration.showNotification(notificationTitle, notificationOptions);
});

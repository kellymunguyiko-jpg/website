import { initializeApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBh5Jrwp53NS4n4_W4Q1Zssh2kqTz0sWBA",
  authDomain: "webcraft-6e3ba.firebaseapp.com",
  projectId: "webcraft-6e3ba",
  storageBucket: "webcraft-6e3ba.firebasestorage.app",
  messagingSenderId: "49475677388",
  appId: "1:49475677388:web:41c80bb4d4e4f7d2636669",
  measurementId: "G-TN8N3L8TVL"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  ignoreUndefinedProperties: true,
});

setPersistence(auth, browserLocalPersistence).catch(() => {});

export default app;

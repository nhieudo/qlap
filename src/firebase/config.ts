import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, setLogLevel, type Firestore } from 'firebase/firestore';
import fileConfig from '../../firebase-applet-config.json';

// Support both committed JSON config and Vercel Environment Variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || fileConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || fileConfig.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || fileConfig.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || fileConfig.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || fileConfig.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || fileConfig.appId,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || fileConfig.measurementId,
  firestoreDatabaseId:
    import.meta.env.VITE_FIREBASE_DATABASE_ID || fileConfig.firestoreDatabaseId || '(default)',
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);

// Initialize Firestore with specific database ID as required by Firebase Skill
export const db: Firestore = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

export const databaseId = firebaseConfig.firestoreDatabaseId || '(default)';

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

// Suppress transient backend retry notices while maintaining offline persistence
setLogLevel('error');

export { app };

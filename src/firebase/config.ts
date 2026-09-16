import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  doc,
  getDoc,
  type Firestore,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);

// Determine database ID
const targetDbId =
  firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
    ? firebaseConfig.firestoreDatabaseId
    : undefined;

// Initialize Firestore with auto-detect long-polling for high stability in iframes & sandboxed environments
let firestoreInstance: Firestore;
try {
  firestoreInstance = targetDbId
    ? initializeFirestore(app, { experimentalAutoDetectLongPolling: true }, targetDbId)
    : initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
} catch {
  // If already initialized, retrieve the existing instance
  firestoreInstance = targetDbId ? getFirestore(app, targetDbId) : getFirestore(app);
}

export const db = firestoreInstance;

export const databaseId = firebaseConfig.firestoreDatabaseId || '(default)';

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

// Non-blocking connection probe to warm up connection without throwing unhandled server errors
async function testConnection() {
  try {
    await getDoc(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore đang hoạt động ở chế độ ngoại tuyến (offline cache).');
    }
  }
}
testConnection().catch(() => {});

export { app };

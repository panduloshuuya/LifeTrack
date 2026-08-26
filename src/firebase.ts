import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
};

/** Only set when the project uses a named database instead of `(default)`. */
const databaseId: string | undefined =
  import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || undefined;

export const missingFirebaseVars = Object.entries({
  VITE_FIREBASE_API_KEY: firebaseConfig.apiKey,
  VITE_FIREBASE_AUTH_DOMAIN: firebaseConfig.authDomain,
  VITE_FIREBASE_PROJECT_ID: firebaseConfig.projectId,
  VITE_FIREBASE_APP_ID: firebaseConfig.appId,
})
  .filter(([, value]) => !value)
  .map(([key]) => key);

export const isFirebaseConfigured = missingFirebaseVars.length === 0;

// Initialising with a half-empty config produces a confusing failure at every
// later call site instead of one clear message, so it is skipped entirely and
// App renders a setup notice instead.
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;

if (isFirebaseConfigured) {
  const app = initializeApp(firebaseConfig);
  authInstance = getAuth(app);
  dbInstance = databaseId ? getFirestore(app, databaseId) : getFirestore(app);
} else if (import.meta.env.PROD) {
  console.error('Missing Firebase environment variables:', missingFirebaseVars);
}

// Safe to assert: everything that touches these renders only under
// `isFirebaseConfigured`.
export const auth = authInstance as Auth;
export const db = dbInstance as Firestore;
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

/**
 * Logs a Firestore failure with auth context.
 *
 * Deliberately does not rethrow. Callers are `onSnapshot` error handlers and
 * `.catch()` on fire-and-forget writes, where throwing only turns a logged
 * problem into an unhandled rejection.
 */
export function logFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
) {
  const user = authInstance?.currentUser;
  console.error('Firestore error', {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
    auth: user ? { uid: user.uid, email: user.email } : null,
  });
}

/** Maps Firebase auth error codes to something worth showing a user. */
export function friendlyAuthError(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code: unknown }).code)
      : '';

  switch (code) {
    case 'auth/invalid-email':
      return 'That email address does not look right.';
    case 'auth/missing-password':
      return 'Please enter a password.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';
    case 'auth/email-already-in-use':
      return 'An account already exists for that email. Try signing in instead.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Incorrect email or password.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Sign-in window was closed before finishing.';
    case 'auth/popup-blocked':
      return 'Your browser blocked the sign-in popup. Allow popups and retry.';
    case 'auth/operation-not-allowed':
      return 'That sign-in method is not enabled for this Firebase project.';
    case 'auth/network-request-failed':
      return 'Network problem. Check your connection and try again.';
    default:
      return error instanceof Error ? error.message : 'Something went wrong.';
  }
}

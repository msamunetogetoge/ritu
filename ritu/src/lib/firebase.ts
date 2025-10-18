import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import {
  connectFirestoreEmulator,
  getFirestore,
  type Firestore,
} from "firebase/firestore";

type FirebaseConfig = {
  readonly apiKey: string;
  readonly authDomain: string;
  readonly projectId: string;
  readonly appId: string;
  readonly storageBucket?: string;
  readonly messagingSenderId?: string;
};

function requireEnv(key: string): string {
  const value = import.meta.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function createFirebaseConfig(): FirebaseConfig {
  return {
    apiKey: requireEnv("VITE_FIREBASE_API_KEY"),
    authDomain: requireEnv("VITE_FIREBASE_AUTH_DOMAIN"),
    projectId: requireEnv("VITE_FIREBASE_PROJECT_ID"),
    appId: requireEnv("VITE_FIREBASE_APP_ID"),
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  };
}

function initFirebaseApp(): FirebaseApp {
  if (getApps().length > 0) {
    return getApp();
  }
  return initializeApp(createFirebaseConfig());
}

export const app = initFirebaseApp();
export const auth = getAuth(app);
export const db: Firestore = getFirestore(app);

const firestoreEmulatorHost = import.meta.env.VITE_FIRESTORE_EMULATOR_HOST;
const authEmulatorUrl = import.meta.env.VITE_AUTH_EMULATOR_URL;

if (firestoreEmulatorHost) {
  const [host, portText] = firestoreEmulatorHost.split(":");
  const port = Number(portText ?? "8080");
  if (host) {
    connectFirestoreEmulator(db, host, port);
  }
}

if (authEmulatorUrl) {
  connectAuthEmulator(auth, authEmulatorUrl, { disableWarnings: true });
}

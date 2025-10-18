import { type FirebaseApp, getApp, getApps, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import {
  connectFirestoreEmulator,
  type Firestore,
  getFirestore,
} from "firebase/firestore";

/* FirebaseConfigはVite経由で読み込む環境変数セット。 */
type FirebaseConfig = {
  readonly apiKey: string;
  readonly authDomain: string;
  readonly projectId: string;
  readonly appId: string;
  readonly storageBucket?: string;
  readonly messagingSenderId?: string;
};

/* requireEnvは必須環境変数が設定されているかを検証して取得する。 */
function requireEnv(key: string): string {
  const value = import.meta.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

/* createFirebaseConfigはViteのenvからFirebase SDK用の設定を組み立てる。 */
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

/* initFirebaseAppはシングルトンのFirebaseAppを返す。 */
function initFirebaseApp(): FirebaseApp {
  if (getApps().length > 0) {
    return getApp();
  }
  return initializeApp(createFirebaseConfig());
}

/* SDK各種で共有するFirebaseリソース。 */
export const app = initFirebaseApp();
export const auth = getAuth(app);
export const db: Firestore = getFirestore(app);

const firestoreEmulatorHost = import.meta.env.VITE_FIRESTORE_EMULATOR_HOST;
const authEmulatorUrl = import.meta.env.VITE_AUTH_EMULATOR_URL;

/* Firestoreエミュレータに接続する（存在しない場合はスキップ）。 */
if (firestoreEmulatorHost) {
  const [host, portText] = firestoreEmulatorHost.split(":");
  const port = Number(portText ?? "8080");
  if (host) {
    connectFirestoreEmulator(db, host, port);
  }
}

/* Authエミュレータへ接続し、警告を抑制する。 */
if (authEmulatorUrl) {
  connectAuthEmulator(auth, authEmulatorUrl, { disableWarnings: true });
}

import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";

// Estas variables son públicas por diseño (empiezan con NEXT_PUBLIC_).
// Firebase las usa para identificar el proyecto, no son secretas.
// La seguridad real la dan las Firestore Security Rules (ver firestore.rules).
// Los valores "build-placeholder" solo se usan si el proyecto se compila sin
// variables de entorno configuradas (por ejemplo, `npm run build` local antes
// de crear el .env.local). En Vercel, con las variables reales configuradas,
// siempre se usan los valores de NEXT_PUBLIC_FIREBASE_*.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "build-placeholder-key",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "build-placeholder.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "build-placeholder",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "build-placeholder.appspot.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "000000000000",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:000000000000:web:0000000000000000000000",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

// Persistencia offline: como la app se usa visitando casas con señal irregular,
// esto permite que los formularios no se pierdan si se corta la conexión.
// Se activa solo en el navegador (Firestore offline no aplica en servidor).
if (typeof window !== "undefined") {
  enableIndexedDbPersistence(db).catch((err) => {
    // Falla silenciosa esperada si hay varias pestañas abiertas o el navegador no soporta IndexedDB.
    console.warn("Persistencia offline no disponible:", err.code);
  });
}

export default app;

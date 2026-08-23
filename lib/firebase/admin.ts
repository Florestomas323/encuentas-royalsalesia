import "server-only"; // Esto rompe el build si algún componente cliente intenta importar este archivo por error.
import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

// Variables PRIVADAS de servidor — NUNCA deben llevar el prefijo NEXT_PUBLIC_.
// Se configuran únicamente en Vercel (Project Settings → Environment Variables),
// nunca se suben al repositorio.
function getAdminApp(): App {
  if (getApps().length) return getApps()[0];

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  // La private key llega con \n escapados desde las variables de entorno de Vercel.
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Faltan variables de Firebase Admin. Revisa FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL y FIREBASE_ADMIN_PRIVATE_KEY."
    );
  }

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

export function adminAuth() {
  return getAuth(getAdminApp());
}

export function adminDb() {
  return getFirestore(getAdminApp());
}

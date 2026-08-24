import "server-only"; // Esto rompe el build si algún componente cliente intenta importar este archivo por error.
import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

// Variables PRIVADAS de servidor — NUNCA deben llevar el prefijo NEXT_PUBLIC_.
// Se configuran únicamente en Vercel (Project Settings → Environment Variables),
// nunca se suben al repositorio.
// Normaliza la private key. En Vercel suele pegarse de dos formas distintas:
//   1. Con saltos de línea reales (al copiar del .json tal cual).
//   2. Con "\n" escapados en una sola línea.
// Además, a veces queda envuelta en comillas al copiar/pegar. Cualquiera de esas
// variantes rompe cert() con un error poco claro, así que las corregimos aquí.
function normalizePrivateKey(raw?: string): string | undefined {
  if (!raw) return undefined;
  let key = raw.trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }
  return key.replace(/\\n/g, "\n").trim();
}

function getAdminApp(): App {
  if (getApps().length) return getApps()[0];

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL?.trim();
  const privateKey = normalizePrivateKey(process.env.FIREBASE_ADMIN_PRIVATE_KEY);

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

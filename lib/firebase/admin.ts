import "server-only"; // Esto rompe el build si algún componente cliente intenta importar este archivo por error.
import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

// Credenciales de servidor en una sola variable: FIREBASE_SERVICE_ACCOUNT_JSON
// contiene el JSON completo del service account descargado de Firebase Console.
// Pegarlo entero evita los problemas de formato de la private key (saltos de
// línea escapados, comillas, cortes al copiar) que dan las variables sueltas.
//
// NUNCA debe llevar el prefijo NEXT_PUBLIC_ — solo existe en el servidor.
function getAdminApp(): App {
  if (getApps().length) return getApps()[0];

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) {
    throw new Error("Falta FIREBASE_SERVICE_ACCOUNT_JSON en las variables de entorno.");
  }

  let serviceAccount: {
    project_id?: string;
    client_email?: string;
    private_key?: string;
  };

  try {
    serviceAccount = JSON.parse(raw);
  } catch {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_JSON no es un JSON válido. Pega el contenido completo del archivo de credenciales, desde la primera llave { hasta la última }."
    );
  }

  if (!serviceAccount.project_id || !serviceAccount.client_email || !serviceAccount.private_key) {
    throw new Error(
      "El JSON del service account está incompleto. Debe incluir project_id, client_email y private_key."
    );
  }

  return initializeApp({
    credential: cert({
      projectId: serviceAccount.project_id,
      clientEmail: serviceAccount.client_email,
      // Si el JSON viene con \n escapados (según cómo se haya copiado), los normalizamos.
      privateKey: serviceAccount.private_key.replace(/\\n/g, "\n"),
    }),
  });
}

export function adminAuth() {
  return getAuth(getAdminApp());
}

export function adminDb() {
  return getFirestore(getAdminApp());
}

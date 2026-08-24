import "server-only"; // Rompe el build si un componente cliente intenta importarlo.
import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

// Credenciales de servidor en una sola variable: FIREBASE_SERVICE_ACCOUNT_JSON.
// Acepta tres formatos, porque al pegar desde el móvil el JSON se deforma fácil:
//   1. JSON tal cual del archivo descargado de Firebase.
//   2. JSON en base64 (la opción más robusta: una sola línea, sin caracteres raros).
//   3. JSON con saltos de línea reales dentro de private_key (lo que pasa cuando
//      un editor "embellece" el archivo) — JSON.parse falla ahí, así que lo reparamos.
//
// NUNCA debe llevar el prefijo NEXT_PUBLIC_.

export type ServiceAccountParseResult =
  | { ok: true; account: { project_id: string; client_email: string; private_key: string } }
  | { ok: false; reason: string };

export function parseServiceAccount(raw?: string): ServiceAccountParseResult {
  const value = raw?.trim();

  if (!value) {
    return { ok: false, reason: "La variable FIREBASE_SERVICE_ACCOUNT_JSON no existe o está vacía en este entorno. Agrégala en Vercel (marcando Production) y vuelve a desplegar." };
  }

  let texto = value;

  // Quita comillas envolventes si quedaron al copiar.
  if ((texto.startsWith('"') && texto.endsWith('"')) || (texto.startsWith("'") && texto.endsWith("'"))) {
    texto = texto.slice(1, -1).trim();
  }

  // Si no empieza con "{", asumimos base64 e intentamos decodificar.
  if (!texto.startsWith("{")) {
    try {
      const decoded = Buffer.from(texto, "base64").toString("utf8").trim();
      if (decoded.startsWith("{")) {
        texto = decoded;
      } else {
        return { ok: false, reason: `El valor no parece un JSON ni un base64 válido (empieza con "${texto.slice(0, 12)}…"). Pega el contenido completo del archivo de credenciales, desde { hasta }.` };
      }
    } catch {
      return { ok: false, reason: "El valor no es un JSON válido ni un base64 decodificable." };
    }
  }

  let parsed: any;
  try {
    parsed = JSON.parse(texto);
  } catch {
    // Segundo intento: reparar saltos de línea reales dentro de las cadenas,
    // que es la causa más común de "Unexpected token in JSON".
    try {
      const reparado = texto.replace(/"([^"\\]*(?:\\.[^"\\]*)*)"/g, (match) =>
        match.replace(/\r?\n/g, "\\n")
      );
      parsed = JSON.parse(reparado);
    } catch {
      return { ok: false, reason: `El contenido no es un JSON válido (longitud recibida: ${texto.length} caracteres). Si lo pegaste desde el móvil, prueba con la versión en base64.` };
    }
  }

  const faltantes: string[] = [];
  if (!parsed?.project_id) faltantes.push("project_id");
  if (!parsed?.client_email) faltantes.push("client_email");
  if (!parsed?.private_key) faltantes.push("private_key");

  if (faltantes.length) {
    const presentes = Object.keys(parsed || {}).join(", ") || "ninguna";
    return { ok: false, reason: `Al JSON le faltan estos campos: ${faltantes.join(", ")}. Campos encontrados: ${presentes}.` };
  }

  const privateKey = String(parsed.private_key).replace(/\\n/g, "\n").trim();
  if (!privateKey.startsWith("-----BEGIN")) {
    return { ok: false, reason: "El campo private_key no empieza con -----BEGIN PRIVATE KEY-----. Parece incompleto o mal copiado." };
  }
  if (!privateKey.endsWith("-----")) {
    return { ok: false, reason: "El campo private_key está cortado — no termina con -----END PRIVATE KEY-----." };
  }

  return {
    ok: true,
    account: {
      project_id: String(parsed.project_id),
      client_email: String(parsed.client_email),
      private_key: privateKey,
    },
  };
}

function getAdminApp(): App {
  if (getApps().length) return getApps()[0];

  const resultado = parseServiceAccount(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  if (!resultado.ok) {
    throw new Error(resultado.reason);
  }

  return initializeApp({
    credential: cert({
      projectId: resultado.account.project_id,
      clientEmail: resultado.account.client_email,
      privateKey: resultado.account.private_key,
    }),
  });
}

export function adminAuth() {
  return getAuth(getAdminApp());
}

export function adminDb() {
  return getFirestore(getAdminApp());
}

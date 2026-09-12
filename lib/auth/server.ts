import "server-only";
import { adminAuth, adminDb } from "@/lib/firebase/admin";

/**
 * Autorización DEL LADO DEL SERVIDOR.
 *
 * Regla de oro: el uid, el correo, el rol y la organización con los que se
 * autoriza salen SIEMPRE del ID token verificado y de Firestore leído aquí.
 * Nunca del body de la petición. Cambiar el correo en el navegador o editar
 * Firestore desde el cliente no concede privilegios.
 */

export type SessionUser = { uid: string; email: string };

export type AuthError = { status: number; error: string };

export function esAuthError(v: unknown): v is AuthError {
  return !!v && typeof v === "object" && "status" in (v as any) && "error" in (v as any);
}

/** Extrae y verifica el ID token de Firebase del header Authorization. */
export async function requireUser(req: Request): Promise<SessionUser | AuthError> {
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return { status: 401, error: "Falta el token de sesión." };
  try {
    const decoded = await adminAuth().verifyIdToken(token);
    return { uid: decoded.uid, email: String(decoded.email || "").toLowerCase() };
  } catch {
    return { status: 401, error: "Sesión no válida. Vuelve a iniciar sesión." };
  }
}

/**
 * ¿Este uid está registrado como super administrador global?
 * La única fuente de verdad es la colección `systemAdmins`, que NADIE puede
 * escribir desde el cliente (firestore.rules: write = false) — solo el Admin SDK.
 */
export async function esSuperAdmin(uid: string): Promise<boolean> {
  try {
    const snap = await adminDb().collection("systemAdmins").doc(uid).get();
    return snap.exists && (snap.data() as any)?.active !== false;
  } catch {
    return false; // falla cerrado
  }
}

/** Exige sesión válida + registro de super administrador. */
export async function requireSuperAdmin(req: Request): Promise<SessionUser | AuthError> {
  const user = await requireUser(req);
  if (esAuthError(user)) return user;
  if (!(await esSuperAdmin(user.uid))) {
    // Mismo mensaje para "no es admin" y "no existe": no se filtra información.
    return { status: 403, error: "No tienes permiso para esta operación." };
  }
  return user;
}

/** Perfil de Firestore del usuario (users/{uid}), leído en servidor. */
export async function getServerProfile(uid: string): Promise<Record<string, any> | null> {
  const snap = await adminDb().collection("users").doc(uid).get();
  return snap.exists ? (snap.data() as Record<string, any>) : null;
}

/**
 * Normalización ÚNICA del correo. La usan por igual la creación de
 * invitaciones y su reclamación en el primer inicio de sesión, para que
 * "Persona@Gmail.com " y "persona@gmail.com" sean siempre el mismo correo.
 */
export function normalizarEmail(valor: unknown): string {
  return typeof valor === "string" ? valor.trim().toLowerCase().slice(0, 254) : "";
}

/** Id determinista de membresía, igual al que ya usaba el proyecto. */
export function membershipId(organizationId: string, uid: string): string {
  return `${organizationId}_${uid}`;
}

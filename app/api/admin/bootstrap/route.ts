import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireUser, esAuthError, esSuperAdmin } from "@/lib/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * BOOTSTRAP del super administrador global.
 *
 * Es el único camino para crear el PRIMER registro en `systemAdmins`, porque
 * esa colección no se puede escribir desde el cliente (firestore.rules) y el
 * panel de administración exige ya ser super admin.
 *
 * Seguridad:
 *  - exige un ID token de Firebase válido (hay que haber iniciado sesión con
 *    Google de verdad: no basta con escribir un correo);
 *  - el correo se toma del TOKEN VERIFICADO, nunca del body;
 *  - ese correo debe coincidir exactamente con SUPER_ADMIN_BOOTSTRAP_EMAIL,
 *    una variable de entorno del servidor que el usuario no controla;
 *  - es idempotente: si ese uid ya es super admin, no hace nada.
 *
 * Con esto, un distribuidor no puede convertirse en super admin: aunque llame
 * al endpoint con su sesión, su correo no es el del bootstrap.
 */
export async function POST(req: Request) {
  const user = await requireUser(req);
  if (esAuthError(user)) {
    return NextResponse.json({ ok: false, error: user.error }, { status: user.status });
  }

  const esperado = process.env.SUPER_ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
  if (!esperado) {
    return NextResponse.json(
      { ok: false, error: "SUPER_ADMIN_BOOTSTRAP_EMAIL no está configurado en el servidor." },
      { status: 500 }
    );
  }

  // Ya lo es: respuesta idempotente.
  if (await esSuperAdmin(user.uid)) {
    return NextResponse.json({ ok: true, yaEra: true });
  }

  if (!user.email || user.email !== esperado) {
    // Mismo mensaje que cualquier otra denegación: no revela cuál es el correo.
    return NextResponse.json({ ok: false, error: "No tienes permiso para esta operación." }, { status: 403 });
  }

  const db = adminDb();
  await db.collection("systemAdmins").doc(user.uid).set(
    {
      uid: user.uid,
      email: user.email,
      active: true,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: "bootstrap",
    },
    { merge: true }
  );

  // Perfil mínimo para que la app pueda cargar (users/{uid} ya existía como
  // modelo; solo se le añade el rol). No se toca organizationId si ya tenía uno.
  const perfilRef = db.collection("users").doc(user.uid);
  const perfil = await perfilRef.get();
  await perfilRef.set(
    {
      email: user.email,
      role: "super_admin",
      active: true,
      isTestUser: false,
      ...(perfil.exists ? {} : { organizationId: null, createdAt: FieldValue.serverTimestamp() }),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return NextResponse.json({ ok: true, yaEra: false });
}

import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireUser, esAuthError } from "@/lib/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Registro del usuario tras iniciar sesión con Google.
 *
 * `users/{uid}` no se puede escribir desde el cliente (firestore.rules), así que
 * este endpoint lo crea con el Admin SDK usando ÚNICAMENTE datos del ID token
 * verificado (uid, correo, nombre de la cuenta de Google).
 *
 * NO concede ningún permiso: el usuario nace SIN workspace
 * (`organizationId: null`), y con ese valor las reglas de Firestore no le
 * permiten leer ni escribir datos de ninguna organización. Un super
 * administrador debe asignarlo a un workspace desde el panel.
 *
 * En un usuario que ya existe solo refresca el correo y el nombre: nunca toca
 * `role`, `organizationId`, `active` ni `isTestUser`. Por eso llamar a este
 * endpoint no sirve para escalar privilegios.
 */
export async function POST(req: Request) {
  const user = await requireUser(req);
  if (esAuthError(user)) {
    return NextResponse.json({ ok: false, error: user.error }, { status: user.status });
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    /* el cuerpo es opcional */
  }
  // El nombre es un dato cosmético: se recorta y nunca influye en permisos.
  const displayName = typeof body?.displayName === "string" ? body.displayName.trim().slice(0, 80) : "";
  const [firstName, ...resto] = displayName.split(/\s+/).filter(Boolean);

  const ref = adminDb().collection("users").doc(user.uid);
  const snap = await ref.get();

  if (!snap.exists) {
    await ref.set({
      email: user.email,
      firstName: firstName || "",
      lastName: resto.join(" "),
      role: "salesperson",
      organizationId: null,     // sin workspace hasta que un super admin lo asigne
      active: true,
      isTestUser: false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ ok: true, creado: true });
  }

  const actual = snap.data() as any;
  const cambios: Record<string, unknown> = {};
  if (user.email && actual.email !== user.email) cambios.email = user.email;
  if (firstName && !actual.firstName) cambios.firstName = firstName;
  if (resto.length && !actual.lastName) cambios.lastName = resto.join(" ");
  if (Object.keys(cambios).length) {
    cambios.updatedAt = FieldValue.serverTimestamp();
    await ref.set(cambios, { merge: true });
  }

  return NextResponse.json({ ok: true, creado: false });
}

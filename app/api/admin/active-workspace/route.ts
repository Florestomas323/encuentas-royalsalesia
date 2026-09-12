import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireSuperAdmin, esAuthError } from "@/lib/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * "Entrar al workspace" — el super administrador abre un workspace para
 * revisarlo desde la aplicación normal.
 *
 * Cómo funciona, sin estructuras nuevas:
 *  - La aplicación ya toma el workspace activo de `users/{uid}.organizationId`.
 *    Aquí solo se cambia ESE campo del propio super admin.
 *  - NO se toca su `role`: sigue siendo `super_admin`, no se convierte en
 *    distribuidor de nadie. Tampoco se copia ni se mueve un solo dato.
 *  - El acceso de lectura ya lo concedían las reglas (`isSuperAdmin()` en
 *    firestore.rules); lo que faltaba era decirle a la app qué organización
 *    consultar.
 *
 * Autorización: `requireSuperAdmin` verifica el ID token y consulta
 * `systemAdmins/{uid}` EN EL SERVIDOR. No se mira `profile.role` en ningún
 * momento, así que un distributor/salesperson/reviewer recibe 403 aunque
 * llame al endpoint a mano — y, al ser `users` de solo lectura para el
 * cliente, tampoco puede cambiarse el campo por su cuenta.
 */
export async function POST(req: Request) {
  const admin = await requireSuperAdmin(req);
  if (esAuthError(admin)) {
    return NextResponse.json({ ok: false, error: admin.error }, { status: admin.status });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Cuerpo no válido." }, { status: 400 });
  }

  // `organizationId: null` sale del workspace y vuelve a la vista global.
  const organizationId =
    typeof body?.organizationId === "string" ? body.organizationId.slice(0, 128) : null;

  const db = adminDb();

  if (organizationId) {
    const ws = await db.collection("organizations").doc(organizationId).get();
    if (!ws.exists) {
      return NextResponse.json({ ok: false, error: "Ese workspace no existe." }, { status: 404 });
    }
  }

  await db.collection("users").doc(admin.uid).set(
    {
      organizationId,                 // workspace activo (único campo que cambia)
      activeWorkspaceSetAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return NextResponse.json({ ok: true, organizationId });
}

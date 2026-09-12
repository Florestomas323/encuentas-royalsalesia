import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireSuperAdmin, esAuthError, membershipId } from "@/lib/auth/server";
import { esRolAsignable } from "@/types/user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Membresías = colección `organizationMembers`, que ya existía en el proyecto
// (docId determinista `${organizationId}_${uid}`). No se duplica la estructura.
//
// IMPORTANTE: además de la membresía se sincroniza `users/{uid}.organizationId`
// y `users/{uid}.role`, que es de donde el resto de la aplicación (Ctx, reglas
// de Firestore, consultas) obtiene el workspace activo. Así no hubo que
// reescribir ninguna consulta comercial existente.

function deny(e: { status: number; error: string }) {
  return NextResponse.json({ ok: false, error: e.error }, { status: e.status });
}

async function leerBody(req: Request) {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

/** Asignar un usuario a un workspace (o cambiarle el rol dentro de él). */
export async function POST(req: Request) {
  const admin = await requireSuperAdmin(req);
  if (esAuthError(admin)) return deny(admin);

  const body = await leerBody(req);
  if (!body) return NextResponse.json({ ok: false, error: "Cuerpo no válido." }, { status: 400 });

  const uid = typeof body?.uid === "string" ? body.uid.slice(0, 128) : "";
  const organizationId = typeof body?.organizationId === "string" ? body.organizationId.slice(0, 128) : "";
  const role = String(body?.role || "");

  if (!uid || !organizationId) {
    return NextResponse.json({ ok: false, error: "Falta el usuario o el workspace." }, { status: 400 });
  }
  // Los roles asignables viven en types/user.ts (fuente única compartida con
  // el panel y con las invitaciones). `super_admin` nunca está en esa lista.
  if (!esRolAsignable(role)) {
    return NextResponse.json({ ok: false, error: "Rol no permitido." }, { status: 400 });
  }

  const db = adminDb();
  const [usuario, workspace] = await Promise.all([
    db.collection("users").doc(uid).get(),
    db.collection("organizations").doc(organizationId).get(),
  ]);
  if (!usuario.exists) return NextResponse.json({ ok: false, error: "Ese usuario no existe." }, { status: 404 });
  if (!workspace.exists) return NextResponse.json({ ok: false, error: "Ese workspace no existe." }, { status: 404 });

  await db.collection("organizationMembers").doc(membershipId(organizationId, uid)).set(
    {
      organizationId,
      uid,
      role,
      active: true,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: admin.uid,
      createdAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  // Workspace activo del usuario + rol efectivo (lo lee toda la app).
  await db.collection("users").doc(uid).set(
    {
      organizationId,
      role,
      active: true,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: admin.uid,
    },
    { merge: true }
  );

  return NextResponse.json({ ok: true });
}

/** Quitar el acceso de un usuario a un workspace. */
export async function DELETE(req: Request) {
  const admin = await requireSuperAdmin(req);
  if (esAuthError(admin)) return deny(admin);

  const body = await leerBody(req);
  if (!body) return NextResponse.json({ ok: false, error: "Cuerpo no válido." }, { status: 400 });

  const uid = typeof body?.uid === "string" ? body.uid.slice(0, 128) : "";
  const organizationId = typeof body?.organizationId === "string" ? body.organizationId.slice(0, 128) : "";
  if (!uid || !organizationId) {
    return NextResponse.json({ ok: false, error: "Falta el usuario o el workspace." }, { status: 400 });
  }

  const db = adminDb();
  await db.collection("organizationMembers").doc(membershipId(organizationId, uid)).set(
    { active: false, updatedAt: FieldValue.serverTimestamp(), updatedBy: admin.uid },
    { merge: true }
  );

  // Si ese era su workspace activo, se le retira el acceso efectivo: sin
  // organizationId las reglas de Firestore no le dejan leer nada de nadie.
  const perfil = await db.collection("users").doc(uid).get();
  if (perfil.exists && (perfil.data() as any)?.organizationId === organizationId) {
    const otras = await db
      .collection("organizationMembers")
      .where("uid", "==", uid)
      .where("active", "==", true)
      .get();
    const siguiente = otras.docs
      .map((d) => d.data() as any)
      .find((m) => m.organizationId !== organizationId);

    await db.collection("users").doc(uid).set(
      {
        organizationId: siguiente?.organizationId ?? null,
        ...(siguiente?.role ? { role: siguiente.role } : {}),
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: admin.uid,
      },
      { merge: true }
    );
  }

  return NextResponse.json({ ok: true });
}

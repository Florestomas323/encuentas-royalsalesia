import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireSuperAdmin, esAuthError, membershipId, normalizarEmail } from "@/lib/auth/server";
import { esRolAsignable } from "@/types/user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Invitaciones a un workspace (`workspaceInvitations`).
 *
 * Permite dar de alta a alguien ANTES de que haya iniciado sesión por primera
 * vez: se guarda la intención (correo + workspace + rol) y, cuando esa persona
 * entra con Google, /api/session reclama la invitación comparando el correo del
 * ID TOKEN verificado con el de la invitación.
 *
 * SEGURIDAD: todas las operaciones de este archivo exigen `requireSuperAdmin`,
 * que verifica el ID token y consulta `systemAdmins/{uid}` en el servidor.
 * Nunca se mira `profile.role`. La colección no se expone al cliente: las
 * reglas de Firestore la dejan fuera (deny por defecto), así que crear, editar
 * o cancelar invitaciones solo es posible por aquí.
 */

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

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Listado de invitaciones (pendientes primero). */
export async function GET(req: Request) {
  const admin = await requireSuperAdmin(req);
  if (esAuthError(admin)) return deny(admin);

  const db = adminDb();
  const [invSnap, orgsSnap] = await Promise.all([
    db.collection("workspaceInvitations").get(),
    db.collection("organizations").get(),
  ]);
  const nombreOrg = new Map(orgsSnap.docs.map((d) => [d.id, (d.data() as any).name || d.id]));

  const invitations = invSnap.docs
    .map((d) => {
      const i = d.data() as any;
      return {
        id: d.id,
        email: i.email || "",
        organizationId: i.organizationId || "",
        organizationName: nombreOrg.get(i.organizationId) || i.organizationId || "",
        role: i.role || "salesperson",
        status: i.status || "pending",
        createdAt: i.createdAt?.toDate?.()?.toISOString?.() || null,
      };
    })
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === "pending" ? -1 : 1;
      return a.email.localeCompare(b.email);
    });

  return NextResponse.json({ ok: true, invitations });
}

/** Crear una invitación pendiente. */
export async function POST(req: Request) {
  const admin = await requireSuperAdmin(req);
  if (esAuthError(admin)) return deny(admin);

  const body = await leerBody(req);
  if (!body) return NextResponse.json({ ok: false, error: "Cuerpo no válido." }, { status: 400 });

  const email = normalizarEmail(body?.email);
  const organizationId = typeof body?.organizationId === "string" ? body.organizationId.slice(0, 128) : "";
  const role = String(body?.role || "");

  if (!email || !RE_EMAIL.test(email)) {
    return NextResponse.json({ ok: false, error: "Escribe un correo válido." }, { status: 400 });
  }
  if (!organizationId) {
    return NextResponse.json({ ok: false, error: "Elige el workspace." }, { status: 400 });
  }
  if (!esRolAsignable(role)) {
    return NextResponse.json({ ok: false, error: "Rol no permitido." }, { status: 400 });
  }

  const db = adminDb();
  const ws = await db.collection("organizations").doc(organizationId).get();
  if (!ws.exists) {
    return NextResponse.json({ ok: false, error: "Ese workspace no existe." }, { status: 404 });
  }

  // ¿Ya hay una invitación pendiente equivalente? No se duplica.
  const yaPendiente = await db
    .collection("workspaceInvitations")
    .where("email", "==", email)
    .where("organizationId", "==", organizationId)
    .where("status", "==", "pending")
    .get();
  if (!yaPendiente.empty) {
    return NextResponse.json(
      { ok: false, error: "Ya existe una invitación pendiente para ese correo en ese workspace." },
      { status: 409 }
    );
  }

  // ¿Ese correo ya pertenece al workspace? Tampoco se invita de más.
  const usuario = await db.collection("users").where("email", "==", email).limit(1).get();
  if (!usuario.empty) {
    const uid = usuario.docs[0].id;
    const miembro = await db.collection("organizationMembers").doc(membershipId(organizationId, uid)).get();
    if (miembro.exists && (miembro.data() as any)?.active !== false) {
      return NextResponse.json(
        { ok: false, error: "Ese usuario ya tiene acceso a ese workspace." },
        { status: 409 }
      );
    }
  }

  const ref = await db.collection("workspaceInvitations").add({
    email,
    organizationId,
    role,
    status: "pending",
    createdAt: FieldValue.serverTimestamp(),
    createdBy: admin.uid,
    acceptedAt: null,
    acceptedBy: null,
  });

  return NextResponse.json({ ok: true, id: ref.id });
}

/** Cancelar una invitación pendiente. */
export async function DELETE(req: Request) {
  const admin = await requireSuperAdmin(req);
  if (esAuthError(admin)) return deny(admin);

  const body = await leerBody(req);
  if (!body) return NextResponse.json({ ok: false, error: "Cuerpo no válido." }, { status: 400 });

  const id = typeof body?.id === "string" ? body.id.slice(0, 128) : "";
  if (!id) return NextResponse.json({ ok: false, error: "Falta la invitación." }, { status: 400 });

  const db = adminDb();
  const ref = db.collection("workspaceInvitations").doc(id);
  const snap = await ref.get();
  if (!snap.exists) {
    return NextResponse.json({ ok: false, error: "Esa invitación no existe." }, { status: 404 });
  }
  if ((snap.data() as any)?.status !== "pending") {
    return NextResponse.json({ ok: false, error: "Solo se pueden cancelar invitaciones pendientes." }, { status: 409 });
  }

  await ref.set(
    { status: "cancelled", cancelledAt: FieldValue.serverTimestamp(), cancelledBy: admin.uid },
    { merge: true }
  );

  return NextResponse.json({ ok: true });
}

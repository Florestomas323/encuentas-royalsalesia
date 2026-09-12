import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireSuperAdmin, esAuthError } from "@/lib/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Workspaces = colección `organizations` que ya existía. NO se crea una segunda
// estructura: en la interfaz se muestran como "Workspaces".
// Todas las operaciones exigen super administrador verificado en servidor.

function deny(e: { status: number; error: string }) {
  return NextResponse.json({ ok: false, error: e.error }, { status: e.status });
}

export async function GET(req: Request) {
  const admin = await requireSuperAdmin(req);
  if (esAuthError(admin)) return deny(admin);

  const snap = await adminDb().collection("organizations").get();
  const workspaces = snap.docs
    .map((d) => {
      const data = d.data() as any;
      return {
        id: d.id,
        name: data.name || "(sin nombre)",
        active: data.active !== false,
        createdBy: data.createdBy || data.ownerUid || null,
        createdAt: data.createdAt?.toDate?.()?.toISOString?.() || null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json({ ok: true, workspaces });
}

export async function POST(req: Request) {
  const admin = await requireSuperAdmin(req);
  if (esAuthError(admin)) return deny(admin);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Cuerpo no válido." }, { status: 400 });
  }
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 120) : "";
  if (!name) return NextResponse.json({ ok: false, error: "Escribe el nombre del workspace." }, { status: 400 });

  const ref = await adminDb().collection("organizations").add({
    name,
    active: true,
    createdBy: admin.uid,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ ok: true, id: ref.id });
}

// Activar / desactivar un workspace.
export async function PATCH(req: Request) {
  const admin = await requireSuperAdmin(req);
  if (esAuthError(admin)) return deny(admin);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Cuerpo no válido." }, { status: 400 });
  }
  const id = typeof body?.id === "string" ? body.id.slice(0, 120) : "";
  if (!id) return NextResponse.json({ ok: false, error: "Falta el workspace." }, { status: 400 });
  const active = body?.active === true;

  await adminDb().collection("organizations").doc(id).set(
    { active, updatedAt: FieldValue.serverTimestamp(), updatedBy: admin.uid },
    { merge: true }
  );

  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireSuperAdmin, esAuthError } from "@/lib/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Lista de usuarios registrados con sus membresías. Solo super administrador.
// Los usuarios aparecen aquí en cuanto inician sesión con Google por primera
// vez (el layout de la app crea su documento en `users`), aunque todavía no
// tengan ningún workspace asignado.

export async function GET(req: Request) {
  const admin = await requireSuperAdmin(req);
  if (esAuthError(admin)) {
    return NextResponse.json({ ok: false, error: admin.error }, { status: admin.status });
  }

  const db = adminDb();
  const [usersSnap, membersSnap, orgsSnap, adminsSnap] = await Promise.all([
    db.collection("users").get(),
    db.collection("organizationMembers").get(),
    db.collection("organizations").get(),
    db.collection("systemAdmins").get(),
  ]);

  const nombreOrg = new Map(orgsSnap.docs.map((d) => [d.id, (d.data() as any).name || d.id]));
  const superAdmins = new Set(adminsSnap.docs.filter((d) => (d.data() as any)?.active !== false).map((d) => d.id));

  const membresiasPorUid = new Map<string, any[]>();
  for (const d of membersSnap.docs) {
    const m = d.data() as any;
    const uid = m.uid;
    if (!uid) continue;
    if (!membresiasPorUid.has(uid)) membresiasPorUid.set(uid, []);
    membresiasPorUid.get(uid)!.push({
      id: d.id,
      organizationId: m.organizationId,
      organizationName: nombreOrg.get(m.organizationId) || m.organizationId,
      role: m.role || "salesperson",
      active: m.active !== false,
    });
  }

  const users = usersSnap.docs.map((d) => {
    const u = d.data() as any;
    return {
      uid: d.id,
      email: u.email || "",
      name: [u.firstName, u.lastName].filter(Boolean).join(" ") || "",
      role: u.role || "",
      active: u.active !== false,
      activeWorkspaceId: u.organizationId || null,
      isSuperAdmin: superAdmins.has(d.id),
      memberships: membresiasPorUid.get(d.id) || [],
    };
  });

  users.sort((a, b) => a.email.localeCompare(b.email));
  return NextResponse.json({ ok: true, users });
}

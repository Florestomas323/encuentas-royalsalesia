import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireUser, esAuthError, esSuperAdmin, membershipId } from "@/lib/auth/server";

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
 * `role`, `organizationId`, `active` ni `isTestUser` por su cuenta. Por eso
 * llamar a este endpoint no sirve para escalar privilegios.
 *
 * La ÚNICA excepción es reclamar una invitación que un super administrador creó
 * antes (ver `reclamarInvitaciones`): ahí el workspace y el rol no los elige el
 * usuario, ya estaban decididos por el administrador.
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

  let creado = false;
  if (!snap.exists) {
    creado = true;
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
  } else {
    const actual = snap.data() as any;
    const cambios: Record<string, unknown> = {};
    if (user.email && actual.email !== user.email) cambios.email = user.email;
    if (firstName && !actual.firstName) cambios.firstName = firstName;
    if (resto.length && !actual.lastName) cambios.lastName = resto.join(" ");
    if (Object.keys(cambios).length) {
      cambios.updatedAt = FieldValue.serverTimestamp();
      await ref.set(cambios, { merge: true });
    }
  }

  // Invitaciones pendientes para ESTE correo verificado.
  const aceptadas = await reclamarInvitaciones(user.uid, user.email);

  return NextResponse.json({ ok: true, creado, invitacionesAceptadas: aceptadas });
}

/**
 * Reclama las invitaciones pendientes del correo AUTENTICADO.
 *
 * Punto clave de seguridad: el correo con el que se busca sale del ID token
 * verificado en `requireUser`, no del cuerpo de la petición. Nadie puede
 * reclamar la invitación de otra persona escribiendo su correo, porque para
 * llegar hasta aquí hay que haber iniciado sesión con esa cuenta de Google.
 *
 * Qué hace por cada invitación `pending` válida:
 *   1. comprueba que el workspace siga existiendo;
 *   2. crea (o reactiva) la membresía en `organizationMembers`, con el id
 *      determinista de siempre — así nunca se duplica;
 *   3. marca la invitación como `accepted`.
 *
 * El workspace ACTIVO (`users/{uid}.organizationId`) solo se fija si el usuario
 * todavía no tenía ninguno: a alguien que ya está trabajando en un workspace no
 * se le cambia el suyo por debajo.
 *
 * Al super administrador no se le aplica nada de esto: su workspace activo lo
 * controla él desde /admin y su rol no debe convertirse en uno normal.
 */
async function reclamarInvitaciones(uid: string, email: string): Promise<number> {
  if (!email) return 0;
  if (await esSuperAdmin(uid)) return 0;

  const db = adminDb();
  const pendientes = await db
    .collection("workspaceInvitations")
    .where("email", "==", email)
    .where("status", "==", "pending")
    .get();
  if (pendientes.empty) return 0;

  const perfil = await db.collection("users").doc(uid).get();
  let workspaceActivo = (perfil.data() as any)?.organizationId || null;
  let aceptadas = 0;

  for (const docInv of pendientes.docs) {
    const inv = docInv.data() as any;
    const organizationId = String(inv.organizationId || "");
    const role = String(inv.role || "");
    if (!organizationId || !role) continue;

    const ws = await db.collection("organizations").doc(organizationId).get();
    if (!ws.exists) continue;   // workspace borrado: la invitación se queda pendiente

    await db.collection("organizationMembers").doc(membershipId(organizationId, uid)).set(
      {
        organizationId,
        uid,
        role,
        active: true,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: "invitation",
      },
      { merge: true }
    );

    await docInv.ref.set(
      { status: "accepted", acceptedAt: FieldValue.serverTimestamp(), acceptedBy: uid },
      { merge: true }
    );

    if (!workspaceActivo) {
      await db.collection("users").doc(uid).set(
        {
          organizationId,
          role,
          active: true,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: "invitation",
        },
        { merge: true }
      );
      workspaceActivo = organizationId;
    }

    aceptadas++;
  }

  return aceptadas;
}

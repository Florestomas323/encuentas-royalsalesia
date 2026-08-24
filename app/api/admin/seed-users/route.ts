import { NextRequest, NextResponse } from "next/server";

// Endpoint de configuración inicial. Crea (o actualiza) los perfiles de los dos
// usuarios conocidos del sistema. Es idempotente: se puede ejecutar varias veces
// sin duplicar organizaciones ni usuarios.
//
// El secreto viaja en el body JSON, no en un header personalizado.
const DISTRIBUTOR_EMAIL = "rrhh.venezia@gmail.com";
const REVIEWER_EMAIL = "florestomas323@gmail.com";

function fail(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(req: NextRequest) {
  // --- 1. Leer el body ---
  let body: any;
  try {
    body = await req.json();
  } catch {
    return fail("No pudimos leer la solicitud. Intenta de nuevo.", 400);
  }

  const secret = String(body?.secret || "").trim();
  const expectedSecret = process.env.SEED_ADMIN_SECRET?.trim();

  // --- 2. Validar el secreto (casos 1 y 2) ---
  if (!expectedSecret) {
    return fail("SEED_ADMIN_SECRET no está configurado en Vercel.", 500);
  }
  if (!secret) {
    return fail("Escribe el secreto para continuar.", 400);
  }
  if (secret !== expectedSecret) {
    return fail("El secreto ingresado no coincide.", 401);
  }

  // --- 3. Inicializar Firebase Admin (caso 3) ---
  // Se importa dinámicamente para que un fallo de credenciales se capture aquí
  // como un error legible, en vez de romper el módulo entero al cargarse.
  let adminAuth: any, adminDb: any, FieldValue: any;
  try {
    const admin = await import("@/lib/firebase/admin");
    const firestore = await import("firebase-admin/firestore");
    adminAuth = admin.adminAuth();
    adminDb = admin.adminDb();
    FieldValue = firestore.FieldValue;
  } catch (err: any) {
    console.error("[seed-users] Firebase Admin init:", err?.message);
    return fail(
      "Firebase Admin no pudo inicializarse. Revisa FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL y FIREBASE_ADMIN_PRIVATE_KEY en Vercel.",
      500
    );
  }

  // --- 4. Buscar los usuarios en Firebase Authentication (casos 4 y 5) ---
  let andresUid: string;
  let reviewerUid: string;
  try {
    const andres = await adminAuth.getUserByEmail(DISTRIBUTOR_EMAIL);
    andresUid = andres.uid;
  } catch (err: any) {
    console.error("[seed-users] getUserByEmail distribuidor:", err?.code);
    return fail(
      `No se encontró a ${DISTRIBUTOR_EMAIL} en Firebase Authentication. Créalo primero en Firebase Console → Authentication → Users → Add user.`,
      404
    );
  }
  try {
    const reviewer = await adminAuth.getUserByEmail(REVIEWER_EMAIL);
    reviewerUid = reviewer.uid;
  } catch (err: any) {
    console.error("[seed-users] getUserByEmail reviewer:", err?.code);
    return fail(
      `No se encontró a ${REVIEWER_EMAIL} en Firebase Authentication. Créalo primero en Firebase Console → Authentication → Users → Add user.`,
      404
    );
  }

  // Reutiliza la organización existente del dueño si ya la hay (idempotencia).
  async function ensureOrganization(ownerUid: string, name: string, isTest: boolean) {
    const existing = await adminDb
      .collection("organizations")
      .where("ownerUid", "==", ownerUid)
      .limit(1)
      .get();
    if (!existing.empty) return existing.docs[0].id;

    const ref = await adminDb.collection("organizations").add({
      name,
      ownerUid,
      isTestOrganization: isTest,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return ref.id;
  }

  // ID determinista: volver a ejecutar el seed sobrescribe en vez de duplicar.
  async function ensureMembership(organizationId: string, uid: string, role: string) {
    await adminDb
      .collection("organizationMembers")
      .doc(`${organizationId}_${uid}`)
      .set(
        {
          organizationId,
          uid,
          role,
          active: true,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
  }

  const resultado: Record<string, unknown> = {};

  // --- 5. Distribuidor: organización, perfil y membresía (casos 6, 7, 8, 9) ---
  try {
    const orgId = await ensureOrganization(andresUid, "Royal Sales AI - Andres Characo", false);

    await adminDb.collection("users").doc(andresUid).set(
      {
        firstName: "Andres",
        lastName: "Characo",
        email: DISTRIBUTOR_EMAIL,
        role: "distributor",
        organizationId: orgId,
        isTestUser: false,
        active: true,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    await ensureMembership(orgId, andresUid, "distributor");
    resultado.distributor = { uid: andresUid, organizationId: orgId };
  } catch (err: any) {
    console.error("[seed-users] distribuidor:", err?.message);
    return fail("No se pudo crear la organización o el perfil del distribuidor en Firestore.", 500);
  }

  // --- 6. Reviewer: organización de testing separada, perfil y membresía ---
  try {
    const testOrgId = await ensureOrganization(reviewerUid, "Royal Sales AI — Testing", true);

    await adminDb.collection("users").doc(reviewerUid).set(
      {
        firstName: "Tomas",
        lastName: "Flores",
        email: REVIEWER_EMAIL,
        role: "reviewer",
        organizationId: testOrgId,
        isTestUser: true,
        active: true,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    await ensureMembership(testOrgId, reviewerUid, "reviewer");
    resultado.reviewer = { uid: reviewerUid, organizationId: testOrgId };
  } catch (err: any) {
    console.error("[seed-users] reviewer:", err?.message);
    return fail("No se pudo crear la organización de testing o el perfil del reviewer en Firestore.", 500);
  }

  return NextResponse.json({ ok: true, ...resultado });
}

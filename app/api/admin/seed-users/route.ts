import { NextRequest, NextResponse } from "next/server";

// GET /api/admin/seed-users?secret=XXXX — diagnóstico.
// Revisa la configuración del servidor SIN escribir nada en Firestore.
// Útil para saber exactamente qué variable falta o está mal formada.
// Protegido con el mismo secreto; nunca devuelve el contenido de las credenciales.
export async function GET(req: NextRequest) {
  const secret = (req.nextUrl.searchParams.get("secret") || "").trim();
  const expectedSecret = process.env.SEED_ADMIN_SECRET?.trim();

  if (!expectedSecret) {
    return NextResponse.json({ ok: false, error: "SEED_ADMIN_SECRET no está configurado en Vercel." }, { status: 500 });
  }
  if (secret !== expectedSecret) {
    return NextResponse.json({ ok: false, error: "El secreto no coincide." }, { status: 401 });
  }

  const diagnostico: Record<string, unknown> = {};

  // 1. ¿Está la variable y con qué forma?
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  diagnostico.variableExiste = !!raw;
  diagnostico.longitud = raw?.length ?? 0;
  diagnostico.empiezaCon = raw ? raw.trim().slice(0, 1) : null;

  // Proyecto que usa el NAVEGADOR (las NEXT_PUBLIC_* también están disponibles
  // en el servidor, así que las leemos aquí para poder compararlas).
  const clientProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? null;
  diagnostico.proyectoNavegador = clientProjectId;

  // 2. ¿Se puede interpretar?
  let serverProjectId: string | null = null;
  try {
    const { parseServiceAccount } = await import("@/lib/firebase/admin");
    const parsed = parseServiceAccount(raw);
    diagnostico.credencialesValidas = parsed.ok;
    if (parsed.ok) {
      serverProjectId = parsed.account.project_id;
      diagnostico.proyectoServidor = parsed.account.project_id;
      diagnostico.clientEmail = parsed.account.client_email;
      diagnostico.privateKeyLongitud = parsed.account.private_key.length;
    } else {
      diagnostico.motivo = parsed.reason;
    }
  } catch (err: any) {
    diagnostico.credencialesValidas = false;
    diagnostico.motivo = err?.message;
  }

  // 2b. ¿Coinciden los dos proyectos? Esta es la causa #1 de "el seed dice OK
  // pero el login no encuentra el perfil": el navegador escribe/lee en un
  // proyecto y el servidor en otro, así que el uid nunca coincide.
  if (clientProjectId && serverProjectId) {
    diagnostico.proyectosCoinciden = clientProjectId === serverProjectId;
    if (clientProjectId !== serverProjectId) {
      diagnostico.PROBLEMA =
        `El navegador usa el proyecto "${clientProjectId}" pero el servidor escribe en "${serverProjectId}". ` +
        `Corrige NEXT_PUBLIC_FIREBASE_PROJECT_ID (y AUTH_DOMAIN / STORAGE_BUCKET) en Vercel para que apunten a "${serverProjectId}", vuelve a desplegar y ejecuta el seed otra vez.`;
    }
  }

  // 3. ¿Firebase Admin conecta de verdad?
  if (diagnostico.credencialesValidas) {
    try {
      const { adminAuth } = await import("@/lib/firebase/admin");
      await adminAuth().listUsers(1);
      diagnostico.conexionFirebase = "OK";
    } catch (err: any) {
      diagnostico.conexionFirebase = "FALLÓ";
      diagnostico.motivoConexion = err?.message;
    }
  }

  // 4. Prueba definitiva: para cada correo sembrado, ¿existe en Authentication
  // y existe REALMENTE su documento users/{uid} en Firestore? Esto confirma si
  // el perfil que el login busca está donde debe estar.
  if (diagnostico.credencialesValidas && diagnostico.conexionFirebase === "OK") {
    try {
      const { adminAuth, adminDb } = await import("@/lib/firebase/admin");
      const perfiles: Record<string, unknown> = {};
      for (const [etiqueta, email] of [
        ["distribuidor", "rrhh.venezia@gmail.com"],
        ["reviewer", "florestomas323@gmail.com"],
      ] as const) {
        try {
          const u = await adminAuth().getUserByEmail(email);
          const snap = await adminDb().collection("users").doc(u.uid).get();
          perfiles[etiqueta] = {
            email,
            uid: u.uid,
            documentoUsersExiste: snap.exists,
            rol: snap.exists ? (snap.data() as any)?.role ?? null : null,
          };
        } catch {
          perfiles[etiqueta] = { email, existeEnAuth: false };
        }
      }
      diagnostico.perfiles = perfiles;
    } catch (err: any) {
      diagnostico.perfilesError = err?.message;
    }
  }

  return NextResponse.json({ ok: true, diagnostico });
}


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
  const soloDiagnostico = body?.diagnose === true;

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
    // Mostramos la razón concreta en pantalla. Es seguro: parseServiceAccount
    // nunca incluye el contenido de las credenciales en sus mensajes, solo
    // describe qué falta o qué formato tiene el valor.
    return fail(
      `Firebase Admin no pudo inicializarse. ${err?.message || "Revisa FIREBASE_SERVICE_ACCOUNT_JSON en Vercel."}`,
      500
    );
  }

  // --- 3b. Modo diagnóstico: reporta el estado y termina sin escribir nada ---
  if (soloDiagnostico) {
    const reporte: Record<string, unknown> = { credencialesValidas: true };
    try {
      const { parseServiceAccount } = await import("@/lib/firebase/admin");
      const parsed = parseServiceAccount(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      if (parsed.ok) {
        reporte.projectId = parsed.account.project_id;
        reporte.clientEmail = parsed.account.client_email;
      }
    } catch { /* ya validado arriba */ }

    for (const [etiqueta, email] of [["distribuidor", DISTRIBUTOR_EMAIL], ["reviewer", REVIEWER_EMAIL]] as const) {
      try {
        const u = await adminAuth.getUserByEmail(email);
        reporte[etiqueta] = `existe (uid ${u.uid.slice(0, 6)}…)`;
      } catch {
        reporte[etiqueta] = `NO existe en Firebase Authentication (${email})`;
      }
    }

    try {
      await adminDb.collection("organizations").limit(1).get();
      reporte.firestore = "OK";
    } catch (err: any) {
      reporte.firestore = `FALLÓ: ${err?.message}`;
    }

    return NextResponse.json({ ok: true, diagnostico: reporte });
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

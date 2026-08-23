import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";

// Endpoint de un solo uso para crear los dos perfiles iniciales de Royal Sales AI.
// Protegido con un secreto de servidor (SEED_ADMIN_SECRET) — nadie puede llamarlo
// sin conocer ese valor, que solo existe como variable de entorno en Vercel.
// Los correos están fijos en el código a propósito: este endpoint NO sirve para
// crear usuarios arbitrarios, solo para sembrar estas dos cuentas conocidas.
const DISTRIBUTOR_EMAIL = "rrhh.venezia@gmail.com";
const REVIEWER_EMAIL = "florestomas323@gmail.com";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-seed-secret");
  if (!process.env.SEED_ADMIN_SECRET || secret !== process.env.SEED_ADMIN_SECRET) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const resultado: Record<string, unknown> = {};

  try {
    // ---- Distribuidor: Andrés Characo ----
    const andresAuth = await adminAuth()
      .getUserByEmail(DISTRIBUTOR_EMAIL)
      .catch(() => null);
    if (!andresAuth) {
      return NextResponse.json(
        { error: `No existe ningún usuario en Firebase Authentication con el correo ${DISTRIBUTOR_EMAIL}. Créalo primero desde Firebase Console.` },
        { status: 404 }
      );
    }

    const db = adminDb();

    // Busca si ya existe una organización de la que Andrés sea dueño, para
    // que este endpoint se pueda llamar más de una vez sin duplicar datos.
    const orgQuery = await db.collection("organizations").where("ownerUid", "==", andresAuth.uid).limit(1).get();
    let organizationId: string;
    if (!orgQuery.empty) {
      organizationId = orgQuery.docs[0].id;
    } else {
      const orgRef = await db.collection("organizations").add({
        name: "Royal Sales AI - Andres Characo",
        ownerUid: andresAuth.uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      organizationId = orgRef.id;
    }

    await db.collection("users").doc(andresAuth.uid).set(
      {
        firstName: "Andres",
        lastName: "Characo",
        email: DISTRIBUTOR_EMAIL.toLowerCase(),
        role: "distributor",
        organizationId,
        isTestUser: false,
        active: true,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    resultado.distributor = { uid: andresAuth.uid, organizationId };

    // ---- Reviewer: cuenta interna de revisión ----
    const reviewerAuth = await adminAuth()
      .getUserByEmail(REVIEWER_EMAIL)
      .catch(() => null);
    if (!reviewerAuth) {
      return NextResponse.json(
        {
          error: `No existe ningún usuario en Firebase Authentication con el correo ${REVIEWER_EMAIL}. Créalo primero desde Firebase Console.`,
          parcial: resultado,
        },
        { status: 404 }
      );
    }

    await db.collection("users").doc(reviewerAuth.uid).set(
      {
        email: REVIEWER_EMAIL.toLowerCase(),
        role: "reviewer",
        organizationId: null,
        isTestUser: true,
        active: true,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    resultado.reviewer = { uid: reviewerAuth.uid };

    return NextResponse.json({ ok: true, ...resultado });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Error inesperado." }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { WARRANTY_KNOWLEDGE } from "@/lib/warranty/data";
import { requireSuperAdmin, esAuthError } from "@/lib/auth/server";

// Siembra la colección GLOBAL `warrantyKnowledge` con el conocimiento oficial
// de garantías Royal Prestige / Hy Cite. Protegido con SEED_ADMIN_SECRET (igual
// que /api/admin/seed-users). Idempotente: usa el id de cada registro como
// docId y merge, así que se puede reejecutar sin duplicar.

function fail(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

// GET: diagnóstico sin escribir. ¿Cuántos registros hay ya sembrados?
// AUTORIZACIÓN: ya no hay secreto compartido ni parámetros en la URL. Exige un
// ID token de Firebase de un usuario registrado en `systemAdmins` (super
// administrador), verificado en servidor. Un distribuidor recibe 403.
export async function GET(req: Request) {
  const admin = await requireSuperAdmin(req);
  if (esAuthError(admin)) return fail(admin.error, admin.status);

  try {
    const { adminDb } = await import("@/lib/firebase/admin");
    const snap = await adminDb().collection("warrantyKnowledge").get();
    return NextResponse.json({
      ok: true,
      diagnostico: {
        registrosEnFirestore: snap.size,
        registrosEnArchivo: WARRANTY_KNOWLEDGE.length,
        sembrado: snap.size >= WARRANTY_KNOWLEDGE.length,
      },
    });
  } catch (err: any) {
    return fail(`No se pudo leer Firestore. ${err?.message || ""}`, 500);
  }
}

// POST: siembra/actualiza los registros. Solo super administrador.
export async function POST(req: Request) {
  const admin = await requireSuperAdmin(req);
  if (esAuthError(admin)) return fail(admin.error, admin.status);

  let adminDb: any, FieldValue: any;
  try {
    const admin = await import("@/lib/firebase/admin");
    const firestore = await import("firebase-admin/firestore");
    adminDb = admin.adminDb();
    FieldValue = firestore.FieldValue;
  } catch (err: any) {
    console.error("[seed-warranty] Firebase Admin init:", err?.message);
    return fail(
      `Firebase Admin no pudo inicializarse. ${err?.message || "Revisa FIREBASE_SERVICE_ACCOUNT_JSON en Vercel."}`,
      500
    );
  }

  try {
    const db = adminDb;
    // Firestore limita el batch a 500 escrituras; aquí son ~30, un solo batch basta.
    const batch = db.batch();
    for (const item of WARRANTY_KNOWLEDGE) {
      const ref = db.collection("warrantyKnowledge").doc(item.id);
      batch.set(
        ref,
        { ...item, lastVerifiedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() },
        { merge: true }
      );
    }
    await batch.commit();
    return NextResponse.json({ ok: true, sembrados: WARRANTY_KNOWLEDGE.length });
  } catch (err: any) {
    console.error("[seed-warranty] commit:", err?.message);
    return fail(`No se pudieron escribir los registros. ${err?.message || ""}`, 500);
  }
}

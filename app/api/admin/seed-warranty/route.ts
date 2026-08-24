import { NextRequest, NextResponse } from "next/server";
import { WARRANTY_KNOWLEDGE } from "@/lib/warranty/data";

// Siembra la colección GLOBAL `warrantyKnowledge` con el conocimiento oficial
// de garantías Royal Prestige / Hy Cite. Protegido con SEED_ADMIN_SECRET (igual
// que /api/admin/seed-users). Idempotente: usa el id de cada registro como
// docId y merge, así que se puede reejecutar sin duplicar.

function fail(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

// GET: diagnóstico sin escribir. ¿Cuántos registros hay ya sembrados?
export async function GET(req: NextRequest) {
  const secret = (req.nextUrl.searchParams.get("secret") || "").trim();
  const expected = process.env.SEED_ADMIN_SECRET?.trim();
  if (!expected) return fail("SEED_ADMIN_SECRET no está configurado en Vercel.", 500);
  if (secret !== expected) return fail("El secreto no coincide.", 401);

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

// POST: siembra/actualiza los registros.
export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return fail("No pudimos leer la solicitud. Intenta de nuevo.", 400);
  }

  const secret = String(body?.secret || "").trim();
  const expected = process.env.SEED_ADMIN_SECRET?.trim();
  if (!expected) return fail("SEED_ADMIN_SECRET no está configurado en Vercel.", 500);
  if (!secret) return fail("Escribe el secreto para continuar.", 400);
  if (secret !== expected) return fail("El secreto ingresado no coincide.", 401);

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

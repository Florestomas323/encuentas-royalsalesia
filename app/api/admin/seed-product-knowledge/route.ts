import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { PRODUCT_KNOWLEDGE } from "@/lib/products/knowledgeData";
import { requireSuperAdmin, esAuthError } from "@/lib/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Siembra la colección GLOBAL `productKnowledge` con las fichas oficiales de
 * producto (hoy: Royal Prestige® MultiPan).
 *
 * Mismo patrón que /api/admin/seed-warranty: contenido maestro compartido por
 * todas las distribuciones, escrito solo con el Admin SDK y protegido con
 * `requireSuperAdmin` (ID token verificado contra `systemAdmins/{uid}`).
 * Idempotente: el docId es el id de catálogo del producto y se escribe con
 * merge, así que se puede reejecutar sin duplicar.
 */

function fail(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

// GET: diagnóstico sin escribir.
export async function GET(req: Request) {
  const admin = await requireSuperAdmin(req);
  if (esAuthError(admin)) return fail(admin.error, admin.status);

  try {
    const snap = await adminDb().collection("productKnowledge").get();
    return NextResponse.json({
      ok: true,
      diagnostico: {
        fichasEnFirestore: snap.size,
        fichasEnArchivo: PRODUCT_KNOWLEDGE.length,
        productos: PRODUCT_KNOWLEDGE.map((p) => p.productId),
      },
    });
  } catch (err: any) {
    console.error("[seed-product-knowledge] diagnóstico:", err?.message);
    return fail("No pudimos leer las fichas.", 500);
  }
}

export async function POST(req: Request) {
  const admin = await requireSuperAdmin(req);
  if (esAuthError(admin)) return fail(admin.error, admin.status);

  try {
    const db = adminDb();
    const batch = db.batch();
    for (const ficha of PRODUCT_KNOWLEDGE) {
      batch.set(
        db.collection("productKnowledge").doc(ficha.productId),
        { ...ficha, updatedAt: FieldValue.serverTimestamp(), updatedBy: admin.uid },
        { merge: true }
      );
    }
    await batch.commit();
    return NextResponse.json({ ok: true, sembradas: PRODUCT_KNOWLEDGE.length });
  } catch (err: any) {
    console.error("[seed-product-knowledge] commit:", err?.message);
    return fail("No se pudieron escribir las fichas.", 500);
  }
}

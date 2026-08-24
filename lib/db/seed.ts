// Seed idempotente del catálogo REAL (Royal Prestige, 179 productos).
// El catálogo es compartido por organización, así que se siembra una sola vez
// por organizationId. Usa el id del catálogo como ID de documento para evitar
// duplicados y para que pieceIds / parentSetIds resuelvan directamente.
import { db } from "@/lib/firebase/client";
import {
  collection, doc, getDoc, getDocs, query, serverTimestamp, where, writeBatch,
} from "firebase/firestore";
import type { Ctx } from "@/lib/db/services";
import { CATALOG_PRODUCTS } from "@/lib/catalog/data";
import { capabilitiesFor, classifyFamily } from "@/lib/catalog/classify";

// Un id real del catálogo que usamos como marcador de "ya sembrado".
const MARKER_ID = "elite-cooking-system-5";
// Marcador del seed de EJEMPLO de la primera pasada (para limpiarlo).
const OLD_EXAMPLE_MARKER = "elite-cooking-system";
const BATCH_SIZE = 400; // < 500 por límite de writeBatch de Firestore.

/** Elimina en lotes docs de una colección que tengan el seedKey de ejemplo. */
async function deleteOldExample(orgId: string, coll: string) {
  const snap = await getDocs(query(
    collection(db, coll),
    where("organizationId", "==", orgId),
    where("seedKey", "==", OLD_EXAMPLE_MARKER),
  ));
  if (snap.empty) return;
  for (let i = 0; i < snap.docs.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    for (const d of snap.docs.slice(i, i + BATCH_SIZE)) batch.delete(d.ref);
    await batch.commit();
  }
}

/**
 * Siembra el catálogo real si la organización aún no lo tiene.
 * Devuelve true si sembró, false si ya existía (idempotente).
 */
export async function seedCatalogIfEmpty(ctx: Ctx): Promise<boolean> {
  const orgId = ctx?.profile?.organizationId;
  if (!orgId) return false;

  // ¿Ya está el catálogo real? (lectura por id, sin índice)
  const marker = await getDoc(doc(db, "products", MARKER_ID));
  if (marker.exists() && (marker.data() as any)?.organizationId === orgId) {
    return false;
  }

  // Limpiar el seed de ejemplo de la primera pasada, si existe.
  await deleteOldExample(orgId, "products");
  await deleteOldExample(orgId, "productContent");

  // Escribir los 179 productos reales en lotes. El id de doc = id del catálogo.
  for (let i = 0; i < CATALOG_PRODUCTS.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    for (const p of CATALOG_PRODUCTS.slice(i, i + BATCH_SIZE)) {
      const caps = capabilitiesFor(p);
      batch.set(doc(db, "products", p.id), {
        ...p,
        active: p.active !== false,
        // Capacidades de contenido calculadas por el clasificador (no por IA).
        supportsRecipes: caps.supportsRecipes,
        productFamily: classifyFamily(p),
        contentCapabilities: caps,
        organizationId: orgId,
        createdBy: ctx.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  }

  return true;
}

/**
 * Migración idempotente: para catálogos ya sembrados ANTES de tener flags de
 * contenido, rellena supportsRecipes / contentCapabilities / productFamily en
 * los productos que aún no los tengan. Segura de correr varias veces (solo toca
 * los que falten). Devuelve cuántos productos actualizó.
 */
export async function upgradeCatalogCapabilities(ctx: Ctx): Promise<number> {
  const orgId = ctx?.profile?.organizationId;
  if (!orgId) return 0;
  const snap = await getDocs(query(
    collection(db, "products"),
    where("organizationId", "==", orgId),
  ));
  const faltan = snap.docs.filter((d) => (d.data() as any)?.supportsRecipes === undefined);
  if (!faltan.length) return 0;
  let total = 0;
  for (let i = 0; i < faltan.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    for (const d of faltan.slice(i, i + BATCH_SIZE)) {
      const data = d.data() as any;
      const caps = capabilitiesFor(data);
      batch.update(d.ref, {
        supportsRecipes: caps.supportsRecipes,
        productFamily: classifyFamily(data),
        contentCapabilities: caps,
        updatedAt: serverTimestamp(),
      });
      total++;
    }
    await batch.commit();
  }
  return total;
}

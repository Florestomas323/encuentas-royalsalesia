// Seed idempotente del catálogo de ejemplo (Fase A).
// Precarga el "Elite Cooking System" (set de 5 piezas) y algo de contenido.
// El catálogo es compartido por organización, así que se siembra una sola vez
// por organizationId. No borra ni sobreescribe datos existentes.
import { db } from "@/lib/firebase/client";
import {
  addDoc, collection, getDocs, query, serverTimestamp, where, writeBatch, doc,
} from "firebase/firestore";
import type { Ctx } from "@/lib/db/services";

const SEED_MARKER = "elite-cooking-system";

const PIEZAS = [
  { name: "Olla 6L con tapa", sku: "ELITE-OLLA-6L", sortOrder: 11 },
  { name: "Sartén 24cm", sku: "ELITE-SARTEN-24", sortOrder: 12 },
  { name: "Cacerola 2L", sku: "ELITE-CACEROLA-2L", sortOrder: 13 },
  { name: "Tapa universal", sku: "ELITE-TAPA-UNIV", sortOrder: 14 },
  { name: "Vaporera", sku: "ELITE-VAPORERA", sortOrder: 15 },
];

/**
 * Siembra el catálogo de ejemplo si la organización aún no tiene productos.
 * Devuelve true si sembró, false si ya existía (idempotente).
 */
export async function seedCatalogIfEmpty(ctx: Ctx): Promise<boolean> {
  if (!ctx?.profile?.organizationId) return false;

  // ¿Ya existe el producto marcado como seed? Solo igualdad -> sin índice.
  const existing = await getDocs(query(
    collection(db, "products"),
    where("organizationId", "==", ctx.profile.organizationId),
    where("seedKey", "==", SEED_MARKER),
  ));
  if (!existing.empty) return false;

  const orgBase = {
    organizationId: ctx.profile.organizationId,
    active: true,
    createdBy: ctx.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  // 1) Crear las piezas primero para obtener sus ids.
  const pieceIds: string[] = [];
  for (const p of PIEZAS) {
    const ref = await addDoc(collection(db, "products"), {
      ...orgBase,
      name: p.name,
      sku: p.sku,
      kind: "piece",
      sortOrder: p.sortOrder,
      seedKey: SEED_MARKER,
    });
    pieceIds.push(ref.id);
  }

  // 2) Crear el set que referencia las piezas.
  const setRef = await addDoc(collection(db, "products"), {
    ...orgBase,
    name: "Elite Cooking System",
    sku: "ELITE-SET",
    kind: "set",
    description: "Batería de cocina Elite de 5 piezas.",
    pieceIds,
    price: 0,
    sortOrder: 1,
    seedKey: SEED_MARKER,
  });

  // 3) Contenido de ejemplo (recetas) asociado al set.
  const batch = writeBatch(db);
  const recetas = [
    { title: "Arroz perfecto en olla Elite", type: "recipe", sortOrder: 1 },
    { title: "Vegetales al vapor", type: "recipe", sortOrder: 2 },
  ];
  for (const r of recetas) {
    batch.set(doc(collection(db, "productContent")), {
      organizationId: ctx.profile.organizationId,
      productId: setRef.id,
      type: r.type,
      title: r.title,
      sortOrder: r.sortOrder,
      seedKey: SEED_MARKER,
      createdBy: ctx.uid,
      createdAt: serverTimestamp(),
    });
  }
  await batch.commit();

  return true;
}

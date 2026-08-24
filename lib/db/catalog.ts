// Acceso al catálogo de productos y su contenido (Fase A).
// El catálogo es COMPARTIDO por organización (sin isTestData). Solo se filtra
// por organizationId (igualdad) y se ordena en memoria para no requerir
// índices compuestos de Firestore.
import { db } from "@/lib/firebase/client";
import {
  addDoc, collection, doc, getDoc, getDocs, onSnapshot, query, serverTimestamp, updateDoc, where,
} from "firebase/firestore";
import type { Ctx } from "@/lib/db/services";
import type { Product, ProductContent } from "@/lib/catalog/types";

// Orden en memoria (sin índices Firestore): sets primero, luego alfabético.
function bySortOrder<T extends { type?: string; name?: string; title?: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const sa = a.type === "set" ? 0 : 1;
    const sb = b.type === "set" ? 0 : 1;
    if (sa !== sb) return sa - sb;
    return String(a.name ?? a.title ?? "").localeCompare(String(b.name ?? b.title ?? ""), "es");
  });
}

// ---------- PRODUCTOS ----------
export async function getProducts(ctx: Ctx): Promise<Product[]> {
  const snap = await getDocs(query(
    collection(db, "products"),
    where("organizationId", "==", ctx.profile.organizationId),
  ));
  const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Product[];
  return bySortOrder(rows.filter((p) => p.active !== false));
}

export function subscribeProducts(ctx: Ctx, cb: (rows: Product[]) => void, onError?: () => void) {
  const q = query(
    collection(db, "products"),
    where("organizationId", "==", ctx.profile.organizationId),
  );
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Product[];
      cb(bySortOrder(rows.filter((p) => p.active !== false)));
    },
    onError,
  );
}

export async function getProductById(id: string): Promise<Product | null> {
  const d = await getDoc(doc(db, "products", id));
  return d.exists() ? ({ id: d.id, ...(d.data() as any) } as Product) : null;
}

export async function createProduct(ctx: Ctx, data: Partial<Product>) {
  const ref = await addDoc(collection(db, "products"), {
    ...data,
    organizationId: ctx.profile.organizationId,
    active: data.active ?? true,
    createdBy: ctx.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateProduct(ctx: Ctx, id: string, data: Partial<Product>) {
  await updateDoc(doc(db, "products", id), { ...data, updatedBy: ctx.uid, updatedAt: serverTimestamp() });
}

// ---------- CONTENIDO DE PRODUCTO (recetas, tips) ----------
export async function getProductContent(ctx: Ctx, productId: string): Promise<ProductContent[]> {
  const snap = await getDocs(query(
    collection(db, "productContent"),
    where("organizationId", "==", ctx.profile.organizationId),
    where("productId", "==", productId),
  ));
  const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as ProductContent[];
  return bySortOrder(rows);
}

export async function createProductContent(ctx: Ctx, data: Partial<ProductContent>) {
  const ref = await addDoc(collection(db, "productContent"), {
    ...data,
    organizationId: ctx.profile.organizationId,
    createdBy: ctx.uid,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/**
 * Dado el historial de compras (purchaseItems) de un cliente, resuelve el
 * conjunto de piezas que YA posee (expandiendo sets en sus pieceIds) y las que
 * podrían faltarle de un set. Útil para la ficha y para futuras sugerencias IA.
 */
export function resolveOwnedPieces(
  purchaseItems: { productId: string; pieceIdsSnapshot?: string[] }[],
  productsById: Record<string, Product>,
): { ownedProductIds: Set<string>; ownedPieceIds: Set<string> } {
  const ownedProductIds = new Set<string>();
  const ownedPieceIds = new Set<string>();
  for (const it of purchaseItems) {
    if (!it.productId) continue;
    ownedProductIds.add(it.productId);
    const prod = productsById[it.productId];
    const pieces = it.pieceIdsSnapshot?.length ? it.pieceIdsSnapshot : prod?.pieceIds || [];
    for (const pid of pieces) ownedPieceIds.add(pid);
    // Un producto individual comprado (no-set) cuenta como pieza poseída.
    if (prod && prod.type !== "set") ownedPieceIds.add(it.productId);
  }
  return { ownedProductIds, ownedPieceIds };
}

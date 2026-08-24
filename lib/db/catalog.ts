// Acceso al catálogo de productos y su contenido (Fase A).
// El catálogo es COMPARTIDO por organización (sin isTestData). Solo se filtra
// por organizationId (igualdad) y se ordena en memoria para no requerir
// índices compuestos de Firestore.
import { db } from "@/lib/firebase/client";
import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, query, serverTimestamp, updateDoc, where,
} from "firebase/firestore";
import type { Ctx } from "@/lib/db/services";
import { isOrgManager } from "@/lib/db/services";
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

// ---------- CONTENIDO DE PRODUCTO (Fase C: recetas, tips, cuidado, FAQ) ----------
// El contenido nace como borrador (draft) y solo la IA lo usa cuando está
// APROBADO. Se filtra por igualdad y se ordena en memoria (sin índices).

/** Todo el contenido de un producto (cualquier estado). Para la biblioteca. */
export async function getProductContent(ctx: Ctx, productId: string): Promise<ProductContent[]> {
  const snap = await getDocs(query(
    collection(db, "productContent"),
    where("organizationId", "==", ctx.profile.organizationId),
    where("productId", "==", productId),
  ));
  const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as ProductContent[];
  return bySortOrder(rows);
}

/** Suscripción en vivo a todo el contenido de la organización (biblioteca). */
export function subscribeProductContent(ctx: Ctx, cb: (rows: ProductContent[]) => void, onError?: () => void) {
  const q = query(
    collection(db, "productContent"),
    where("organizationId", "==", ctx.profile.organizationId),
  );
  return onSnapshot(
    q,
    (snap) => cb(bySortOrder(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as ProductContent[])),
    onError,
  );
}

/** Solo el contenido APROBADO de un producto (única fuente para la IA). */
export async function getApprovedProductContent(ctx: Ctx, productId: string): Promise<ProductContent[]> {
  const all = await getProductContent(ctx, productId);
  return all.filter((c) => c.status === "approved");
}

export async function createProductContent(ctx: Ctx, data: Partial<ProductContent>) {
  const ref = await addDoc(collection(db, "productContent"), {
    ...data,
    organizationId: ctx.profile.organizationId,
    isTestData: !!ctx.profile.isTestUser,
    status: (data.status as any) || "draft",
    source: data.source || "manual",
    active: false,
    approvedBy: null,
    approvedAt: null,
    createdBy: ctx.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateProductContent(ctx: Ctx, id: string, data: Partial<ProductContent>) {
  await updateDoc(doc(db, "productContent", id), {
    ...data,
    updatedBy: ctx.uid,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteProductContent(ctx: Ctx, id: string) {
  const snap = await getDoc(doc(db, "productContent", id));
  if (!snap.exists()) return;
  if ((snap.data() as any).organizationId !== ctx.profile.organizationId) throw new Error("Contenido de otra organización.");
  await deleteDoc(doc(db, "productContent", id));
}

/** Aprobar/rechazar: SOLO distribuidor/reviewer. Al aprobar, active=true. */
export async function setProductContentStatus(ctx: Ctx, id: string, status: "approved" | "rejected") {
  if (!isOrgManager(ctx)) throw new Error("Solo un distribuidor puede aprobar o rechazar contenido.");
  const ref = doc(db, "productContent", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("El contenido no existe.");
  if ((snap.data() as any).organizationId !== ctx.profile.organizationId) throw new Error("Contenido de otra organización.");
  await updateDoc(ref, {
    status,
    active: status === "approved",
    approvedBy: status === "approved" ? ctx.uid : null,
    approvedAt: status === "approved" ? serverTimestamp() : null,
    updatedBy: ctx.uid,
    updatedAt: serverTimestamp(),
  });
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

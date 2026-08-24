// Tipos del catálogo de productos (Fase A).
// El catálogo es compartido a nivel organización: NO lleva isTestData.

export type ProductKind = "set" | "piece" | "single";

export interface Product {
  id: string;
  organizationId: string;
  /** Nombre visible del producto, ej. "Elite Cooking System". */
  name: string;
  kind: ProductKind;
  /** SKU o código interno opcional. */
  sku?: string;
  /** Precio de referencia (puede sobreescribirse al vender). */
  price?: number;
  /** Descripción corta para mostrar en el selector y la ficha. */
  description?: string;
  /**
   * Si kind === "set": ids de los productos "piece" que componen el set.
   * Permite, tras vender un set, saber qué piezas ya tiene el cliente.
   */
  pieceIds?: string[];
  /** Orden de aparición en el selector (menor primero). */
  sortOrder?: number;
  active?: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ProductContent {
  id: string;
  organizationId: string;
  /** Producto o pieza al que pertenece este contenido. */
  productId: string;
  /** "recipe" | "tip" | "care" | "video" ... extensible en fases futuras. */
  type: string;
  title: string;
  body?: string;
  url?: string;
  sortOrder?: number;
  createdAt?: unknown;
}

export interface PurchaseItem {
  id: string;
  organizationId: string;
  isTestData: boolean;
  purchaseId: string;
  customerId: string;
  productId: string;
  /** Snapshot del nombre al momento de la venta (sobrevive a cambios del catálogo). */
  productNameSnapshot: string;
  quantity: number;
  unitPrice?: number;
  /** Si el item vendido es un set, las piezas que incluye (snapshot de pieceIds). */
  pieceIdsSnapshot?: string[];
  createdBy?: string;
  createdAt?: unknown;
}

// Tipos del catálogo de productos (Fase A) — alineados al catálogo REAL
// (Royal Prestige, 179 productos). El catálogo es compartido a nivel
// organización: NO lleva isTestData.

/** "set" = paquete con piezas; "individual_product" = producto suelto. */
export type ProductType = "set" | "individual_product";

/**
 * CatalogProduct = esquema tal cual viene del archivo fuente (lib/catalog/data.ts).
 * No inventamos campos: son exactamente los que trae el catálogo real.
 */
export interface CatalogProduct {
  id: string;
  name: string;
  brand?: string | null;
  line?: string | null;
  category?: string | null;
  type: ProductType;
  active?: boolean;
  canSellIndividually?: boolean;
  /** Si type === "set": ids de los productos que componen el set. */
  pieceIds?: string[];
  /** Si es pieza de uno o varios sets: ids de esos sets. */
  parentSetIds?: string[];
  requiresPostSaleService?: boolean;
  postSaleServiceType?: string | null;
  keepPackagedUntilService?: boolean;
  serviceChecklist?: string[];
  postServiceContentTags?: string[];
  features?: string[];
  warranty?: string | null;
  notes?: string | null;
  sourceType?: string | null;
  sourcePage?: number | string | null;
}

/**
 * Product = documento del catálogo ya en Firestore: el catálogo real más los
 * campos que añade el seed al escribirlo por organización, incluidas las
 * capacidades de contenido (supportsRecipes, etc.) calculadas por el clasificador.
 */
export interface Product extends CatalogProduct {
  organizationId: string;
  supportsRecipes?: boolean;
  productFamily?: string;
  contentCapabilities?: {
    supportsRecipes: boolean;
    supportsUsageTips: boolean;
    supportsMaintenance: boolean;
    supportsCare: boolean;
    supportsInstallationTips: boolean;
  };
  createdAt?: unknown;
  updatedAt?: unknown;
}

/**
 * ProductContent (Fase C): contenido OFICIAL por producto (recetas, tips,
 * cuidado, mantenimiento, FAQ...). Nace como borrador generado por IA y solo la
 * IA de fidelización/asistente lo usa cuando el distribuidor lo APRUEBA.
 */
export type ProductContentStatus = "draft" | "approved" | "rejected";

export interface ProductContent {
  id: string;
  organizationId: string;
  productId: string;
  productName?: string;
  type: string;          // contentType permitido: recipe, usage_tip, care, maintenance, faq...
  title: string;
  content?: string;
  tags?: string[];
  status: ProductContentStatus;
  isTestData?: boolean;
  source?: "ai" | "manual"; // origen del borrador
  createdBy?: string;
  approvedBy?: string | null;
  approvedAt?: unknown | null;
  active?: boolean;      // compat (approved => active)
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface PurchaseItem {
  id: string;
  organizationId: string;
  isTestData: boolean;
  purchaseId: string;
  customerId: string;
  visitId?: string;
  productId: string;
  /** Snapshot del nombre al momento de la venta (sobrevive a cambios del catálogo). */
  productNameSnapshot: string;
  quantity: number;
  unitPrice?: number | null;
  /** Si el item vendido es un set, las piezas que incluye (snapshot de pieceIds). */
  pieceIdsSnapshot?: string[];
  createdBy?: string;
  createdAt?: unknown;
}

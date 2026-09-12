import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { PRODUCT_KNOWLEDGE } from "./knowledgeData";

/**
 * BASE DE CONOCIMIENTO DE PRODUCTO para Royal Copilot.
 *
 * Separación intencional:
 *   - knowledgeData.ts  → los DATOS aprobados (nada de lógica).
 *   - este archivo      → lectura de Firestore, formateo de respuestas y
 *                         contexto para la IA.
 *   - el route del Copilot solo decide cuándo usar una cosa u otra.
 *
 * Objetivo de costo: los subtemas con información estructurada (beneficios,
 * qué incluye, uso, cuidados, garantía, postventa, recetas) se responden
 * DIRECTO desde esta ficha, sin llamar al modelo. La IA queda para preguntas
 * abiertas, donde la ficha se le pasa como única fuente permitida.
 */

export type KnowledgeSource = {
  type: "catalog" | "official_website" | "manual" | "warranty";
  title: string;
  url?: string;
  version?: string;
};

export type ProductKnowledge = {
  productId: string;
  name: string;
  slug: string;
  category: string;
  active: boolean;

  shortDescription: string;

  benefits: string[];
  included: string[];
  /** Qué decir cuando la fuente no detalla los componentes incluidos. */
  includedNote?: string;
  uses: string[];
  /** Precisión oficial que acompaña a los usos (p. ej. temperatura de las asas). */
  usesNote?: string;
  care: string[];

  warranty: {
    summary: string;
    duration: string;
    coverage: string[];
    exclusions: string[];
    specialParts: string[];
    claimInstructions: string[];
  };

  postSale: {
    summary: string;
    steps: string[];
    contact: string | null;
  };

  recipes: {
    enabled: boolean;
    note?: string;
    items: Array<{ name: string; description?: string; source?: string }>;
  };

  quickAnswer: string;

  approvedClaims: string[];
  prohibitedClaims: string[];

  sources: KnowledgeSource[];
};

/** Subtemas que se resuelven SIN IA cuando existe ficha. */
export const STRUCTURED_TOPICS = [
  "beneficios",
  "incluye",
  "uso",
  "cuidados",
  "postventa",
  "recetas",
] as const;
export type StructuredTopic = (typeof STRUCTURED_TOPICS)[number];

export function esTopicEstructurado(valor: unknown): valor is StructuredTopic {
  return typeof valor === "string" && (STRUCTURED_TOPICS as readonly string[]).includes(valor);
}

/**
 * El catálogo se siembra por organización con ids `${orgId}__${idDeCatálogo}`,
 * pero la ficha es contenido maestro global. Aquí se recupera el id base.
 */
export function baseProductId(productId: string): string {
  const i = productId.indexOf("__");
  return i === -1 ? productId : productId.slice(i + 2);
}

const FICHAS_LOCALES = new Map(PRODUCT_KNOWLEDGE.map((p) => [p.productId, p]));

/**
 * Lee la ficha oficial de un producto. Firestore manda; si el documento aún no
 * se ha sembrado, se usa la copia local aprobada (mismo contenido que siembra
 * /api/admin/seed-product-knowledge) para que el Copilot no dependa de que
 * alguien se acuerde de pulsar el botón. Devuelve null si el producto no tiene
 * ficha en ninguna de las dos: ahí el Copilot mantiene su comportamiento actual.
 */
export async function getProductKnowledge(productId: string): Promise<ProductKnowledge | null> {
  const id = baseProductId(productId);
  if (!id) return null;
  try {
    const snap = await adminDb().collection("productKnowledge").doc(id).get();
    if (snap.exists) {
      const data = snap.data() as ProductKnowledge;
      if (data?.active !== false) return data;
      return null;
    }
  } catch (e: any) {
    console.error("[productKnowledge] lectura:", e?.message);
  }
  return FICHAS_LOCALES.get(id) ?? null;
}

// ---------- Formateo de respuestas (sin IA) ----------

const VINETA = "• ";

function lista(items: string[]): string {
  return items.map((i) => VINETA + i).join("\n");
}

function titulos(pk: ProductKnowledge): string[] {
  return pk.sources.map((s) => s.title);
}

const SIN_DATO = "Esta información no está disponible actualmente en la ficha oficial del producto.";

export const DISCLAIMER_GARANTIA =
  "La cobertura descrita es orientativa: la aprobación de cualquier reclamo depende de la evaluación oficial de Hy Cite. Para un reclamo, contacta al Centro de Servicio autorizado.";

export type CopilotStructuredAnswer = {
  answer: string;
  actions: never[];
  sources: string[];
  disclaimer: string;
};

/** Respuesta de un subtema, construida solo con la ficha. */
export function renderTopic(pk: ProductKnowledge, topic: StructuredTopic): CopilotStructuredAnswer {
  const cabecera = `Producto: ${pk.name}`;
  let cuerpo = "";

  switch (topic) {
    case "beneficios":
      cuerpo = pk.benefits.length ? `Beneficios:\n${lista(pk.benefits)}` : SIN_DATO;
      break;

    case "incluye":
      cuerpo = pk.included.length
        ? `Qué incluye:\n${lista(pk.included)}`
        : pk.includedNote || SIN_DATO;
      break;

    case "uso":
      cuerpo = pk.uses.length
        ? `Usos y técnicas de cocción:\n${lista(pk.uses)}${pk.usesNote ? `\n\n${pk.usesNote}` : ""}`
        : SIN_DATO;
      break;

    case "cuidados":
      cuerpo = pk.care.length ? `Cuidados:\n${lista(pk.care)}` : SIN_DATO;
      break;

    case "postventa": {
      const partes = [pk.postSale.summary].filter(Boolean);
      if (pk.postSale.steps.length) partes.push(`Pasos:\n${lista(pk.postSale.steps)}`);
      if (pk.postSale.contact) partes.push(`Contacto: ${pk.postSale.contact}`);
      if (!pk.postSale.steps.length && !pk.postSale.contact) {
        partes.push(
          "Los pasos y el contacto específicos no están disponibles en esta ficha: confírmalos en la documentación oficial antes de prometer nada al cliente."
        );
      }
      cuerpo = partes.join("\n\n") || SIN_DATO;
      break;
    }

    case "recetas": {
      if (!pk.recipes.enabled) {
        cuerpo = "Este producto no es culinario, así que no aplica contenido de recetas.";
        break;
      }
      const partes: string[] = [];
      if (pk.recipes.note) partes.push(pk.recipes.note);
      if (pk.recipes.items.length) {
        partes.push(
          `Recetas oficiales:\n${lista(
            pk.recipes.items.map((r) => (r.description ? `${r.name} — ${r.description}` : r.name))
          )}`
        );
      } else {
        partes.push("Todavía no hay recetas oficiales cargadas para este producto.");
      }
      cuerpo = partes.join("\n\n");
      break;
    }
  }

  return { answer: `${cabecera}\n\n${cuerpo}`, actions: [], sources: titulos(pk), disclaimer: "" };
}

/**
 * Respuesta de garantía, construida solo con la ficha. Mantiene la estructura
 * que ya usaba el Copilot (periodo arriba, visible) y NUNCA simplifica la
 * garantía a "todo cubierto durante 50 años": la cobertura se lista tal cual y
 * las piezas con periodo propio van aparte.
 */
export function renderWarranty(pk: ProductKnowledge): CopilotStructuredAnswer {
  const partes: string[] = [`Producto: ${pk.name}`, `Garantía: ${pk.warranty.duration}`];

  if (pk.warranty.summary) partes.push(pk.warranty.summary);
  if (pk.warranty.coverage.length) partes.push(`Qué cubre:\n${lista(pk.warranty.coverage)}`);
  if (pk.warranty.specialParts.length) {
    partes.push(`Cobertura por componente:\n${lista(pk.warranty.specialParts)}`);
  }
  if (pk.warranty.exclusions.length) {
    partes.push(`Posibles exclusiones:\n${lista(pk.warranty.exclusions)}`);
  }
  partes.push(
    pk.warranty.claimInstructions.length
      ? `Para iniciar un reclamo:\n${lista(pk.warranty.claimInstructions)}`
      : `Para iniciar un reclamo: ${pk.postSale.summary}`
  );

  return {
    answer: partes.join("\n\n"),
    actions: [],
    sources: titulos(pk),
    disclaimer: DISCLAIMER_GARANTIA,
  };
}

/**
 * Bloque de contexto para la IA en preguntas abiertas. Se le entrega la ficha
 * completa, incluidas las afirmaciones aprobadas y las prohibidas, para que
 * pueda reformular sin salirse de lo oficial.
 */
export function knowledgeContextText(pk: ProductKnowledge): string {
  const bloques: string[] = [
    `Producto: ${pk.name} (${pk.category})`,
    `Descripción: ${pk.shortDescription}`,
    `Resumen rápido: ${pk.quickAnswer}`,
  ];
  if (pk.benefits.length) bloques.push(`Beneficios:\n${lista(pk.benefits)}`);
  bloques.push(
    pk.included.length ? `Qué incluye:\n${lista(pk.included)}` : `Qué incluye: ${pk.includedNote || SIN_DATO}`
  );
  if (pk.uses.length) {
    bloques.push(`Usos:\n${lista(pk.uses)}${pk.usesNote ? `\n${pk.usesNote}` : ""}`);
  }
  if (pk.care.length) bloques.push(`Cuidados:\n${lista(pk.care)}`);
  bloques.push(
    [
      `Garantía: ${pk.warranty.duration}`,
      pk.warranty.summary,
      pk.warranty.coverage.length ? `Cubre:\n${lista(pk.warranty.coverage)}` : "",
      pk.warranty.specialParts.length ? `Piezas con cobertura propia:\n${lista(pk.warranty.specialParts)}` : "",
    ]
      .filter(Boolean)
      .join("\n")
  );
  bloques.push(`Postventa: ${pk.postSale.summary}`);
  if (pk.recipes.note) bloques.push(`Recetas: ${pk.recipes.note}`);
  if (pk.approvedClaims.length) bloques.push(`AFIRMACIONES APROBADAS:\n${lista(pk.approvedClaims)}`);
  if (pk.prohibitedClaims.length) bloques.push(`AFIRMACIONES PROHIBIDAS:\n${lista(pk.prohibitedClaims)}`);
  if (pk.sources.length) {
    bloques.push(
      `Fuentes:\n${lista(pk.sources.map((s) => (s.url ? `${s.title} (${s.url})` : s.title)))}`
    );
  }
  return bloques.join("\n\n");
}

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
 * Nada de esto vive dentro de RoyalSalesAIDemo.jsx.
 *
 * Objetivo de costo: los subtemas con información estructurada (beneficios,
 * características, qué incluye, uso, cuidados, garantía, postventa, recetas)
 * se responden DIRECTO desde la ficha, sin llamar al modelo. La IA queda para
 * preguntas abiertas, donde la ficha se le pasa como única fuente permitida.
 *
 * PROCEDENCIA: cada afirmación importante (características, especificaciones,
 * claims aprobados) lleva `sourceId` apuntando a una entrada de `sources`. Así
 * siempre se puede rastrear de qué documento oficial salió un dato.
 */

// ---------- Tipos ----------

export type SourceType = "catalog" | "official_website" | "manual" | "warranty";

export type KnowledgeSource = {
  id: string;
  type: SourceType;
  title: string;
  url?: string;
  version?: string;
  /** true = el dato se leyó directamente de esa fuente; false = registrada pero aún sin datos extraídos. */
  verified: boolean;
};

/** Valor con procedencia. `null` = no hay dato oficial (NUNCA se estima). */
export type SpecValue = { value: string; sourceId?: string } | null;

export type Feature = { title: string; description?: string; sourceId?: string };

export type ApprovedClaim = { id: string; claim: string; sourceId?: string };

export type Specifications = {
  capacity: SpecValue;
  material: SpecValue;
  dimensions: SpecValue;
  temperatureLimit: SpecValue;
  compatibility: SpecValue;
  other: Array<{ title: string; value: string; sourceId?: string }>;
};

export type ProductKnowledge = {
  productId: string;
  name: string;
  slug: string;
  category: string;
  active: boolean;

  description: { short: string; full: string | null };

  benefits: string[];
  features: Feature[];

  included: string[];
  /** Qué decir cuando la fuente no detalla los componentes incluidos. */
  includedNote?: string;

  specifications: Specifications;

  /** Funciones/técnicas de cocción oficiales del producto. */
  functions: string[];
  /** Instrucciones de uso, si la fuente oficial las detalla. */
  usage: string[];
  care: string[];

  warranty: {
    summary: string;
    duration: string;
    coverage: string[];
    exclusions: string[];
    specialParts: string[];
    claimInstructions: string[];
    sourceId?: string;
  };

  postSale: { summary: string; steps: string[]; contact: string | null };

  recipes: {
    enabled: boolean;
    note?: string;
    items: Array<{ name: string; description?: string; source?: string }>;
  };

  faq: Array<{ question: string; answer: string; sourceId?: string }>;

  /** Reformulación comercial de hechos aprobados. No añade hechos nuevos. */
  salesArguments: Array<{ text: string; supportingClaims: string[] }>;

  objections: Array<{ objection: string; suggestedResponse: string; supportingClaims: string[] }>;

  quickAnswer: string;

  approvedClaims: ApprovedClaim[];
  prohibitedClaims: string[];

  sources: KnowledgeSource[];
};

// ---------- Subtemas deterministas ----------

/** Subtemas que se resuelven SIN IA cuando existe ficha. */
export const STRUCTURED_TOPICS = [
  "beneficios",
  "caracteristicas",
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

// ---------- Lectura ----------

const FICHAS_LOCALES = new Map(PRODUCT_KNOWLEDGE.map((p) => [p.productId, p]));

const ESPECIFICACIONES_VACIAS: Specifications = {
  capacity: null,
  material: null,
  dimensions: null,
  temperatureLimit: null,
  compatibility: null,
  other: [],
};

/**
 * Rellena los campos que falten. Un documento sembrado con la versión anterior
 * del esquema (shortDescription, uses) sigue funcionando: se mapea a la forma
 * nueva en lugar de romper al leerlo.
 */
function normalizar(raw: any): ProductKnowledge {
  const legacy = raw || {};
  const arr = (v: any): any[] => (Array.isArray(v) ? v : []);
  return {
    productId: String(legacy.productId || ""),
    name: String(legacy.name || ""),
    slug: String(legacy.slug || legacy.productId || ""),
    category: String(legacy.category || ""),
    active: legacy.active !== false,
    description: {
      short: String(legacy.description?.short ?? legacy.shortDescription ?? ""),
      full: legacy.description?.full ?? null,
    },
    benefits: arr(legacy.benefits),
    features: arr(legacy.features),
    included: arr(legacy.included),
    includedNote: legacy.includedNote,
    specifications: { ...ESPECIFICACIONES_VACIAS, ...(legacy.specifications || {}), other: arr(legacy.specifications?.other) },
    // `uses` era el nombre antiguo de las funciones de cocción.
    functions: arr(legacy.functions).length ? arr(legacy.functions) : arr(legacy.uses),
    usage: arr(legacy.usage),
    care: arr(legacy.care),
    warranty: {
      summary: legacy.warranty?.summary || "",
      duration: legacy.warranty?.duration || "",
      coverage: arr(legacy.warranty?.coverage),
      exclusions: arr(legacy.warranty?.exclusions),
      specialParts: arr(legacy.warranty?.specialParts),
      claimInstructions: arr(legacy.warranty?.claimInstructions),
      sourceId: legacy.warranty?.sourceId,
    },
    postSale: {
      summary: legacy.postSale?.summary || "",
      steps: arr(legacy.postSale?.steps),
      contact: legacy.postSale?.contact ?? null,
    },
    recipes: {
      enabled: legacy.recipes?.enabled !== false,
      note: legacy.recipes?.note ?? legacy.usesNote,
      items: arr(legacy.recipes?.items),
    },
    faq: arr(legacy.faq),
    salesArguments: arr(legacy.salesArguments),
    objections: arr(legacy.objections),
    quickAnswer: String(legacy.quickAnswer || ""),
    approvedClaims: arr(legacy.approvedClaims).map((c: any) =>
      typeof c === "string" ? { id: "", claim: c } : c
    ),
    prohibitedClaims: arr(legacy.prohibitedClaims),
    sources: arr(legacy.sources),
  };
}

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
      const data = snap.data() as any;
      if (data?.active !== false) return normalizar(data);
      return null;
    }
  } catch (e: any) {
    console.error("[productKnowledge] lectura:", e?.message);
  }
  const local = FICHAS_LOCALES.get(id);
  return local ? normalizar(local) : null;
}

// ---------- Formateo de respuestas (sin IA) ----------

const VINETA = "• ";

function lista(items: string[]): string {
  return items.map((i) => VINETA + i).join("\n");
}

function titulos(pk: ProductKnowledge): string[] {
  return pk.sources.filter((s) => s.verified !== false).map((s) => s.title);
}

/** Falta esa sección concreta, pero el producto sí tiene ficha. */
export const SIN_SECCION = "No tengo información oficial disponible sobre este punto todavía.";
/** El producto no tiene ficha en absoluto. */
export const SIN_FICHA = "Aún no tengo suficiente información oficial de este producto.";
/** Pregunta libre sobre un dato que la ficha no contiene. */
export const SIN_DATO_LIBRE =
  "No encuentro ese dato en la información oficial disponible del producto.";

export const DISCLAIMER_GARANTIA =
  "La cobertura descrita es orientativa: la aprobación de cualquier reclamo depende de la evaluación oficial de Hy Cite. Para un reclamo, contacta al Centro de Servicio autorizado.";

export type CopilotStructuredAnswer = {
  answer: string;
  actions: never[];
  sources: string[];
  disclaimer: string;
};

function specLinea(etiqueta: string, v: SpecValue): string | null {
  return v && v.value ? `${etiqueta}: ${v.value}` : null;
}

/** Respuesta de un subtema, construida solo con la ficha. */
export function renderTopic(pk: ProductKnowledge, topic: StructuredTopic): CopilotStructuredAnswer {
  const cabecera = `Producto: ${pk.name}`;
  let cuerpo = "";

  switch (topic) {
    case "beneficios":
      cuerpo = pk.benefits.length ? `Beneficios:\n${lista(pk.benefits)}` : SIN_SECCION;
      break;

    case "caracteristicas": {
      const partes: string[] = [];
      if (pk.features.length) {
        partes.push(
          `Características:\n${lista(
            pk.features.map((f) => (f.description ? `${f.title}: ${f.description}` : f.title))
          )}`
        );
      }
      const specs = [
        specLinea("Capacidad", pk.specifications.capacity),
        specLinea("Material", pk.specifications.material),
        specLinea("Dimensiones", pk.specifications.dimensions),
        specLinea("Temperatura máxima", pk.specifications.temperatureLimit),
        specLinea("Compatibilidad", pk.specifications.compatibility),
        ...pk.specifications.other.map((o) => `${o.title}: ${o.value}`),
      ].filter(Boolean) as string[];
      if (specs.length) partes.push(`Especificaciones:\n${lista(specs)}`);
      // Lo que NO consta se dice, no se estima.
      const faltan = [
        !pk.specifications.capacity ? "capacidad" : null,
        !pk.specifications.material ? "material" : null,
        !pk.specifications.dimensions ? "dimensiones" : null,
      ].filter(Boolean) as string[];
      if (faltan.length) {
        partes.push(`Sin dato oficial en la ficha: ${faltan.join(", ")}. No los estimes con el cliente.`);
      }
      cuerpo = partes.length ? partes.join("\n\n") : SIN_SECCION;
      break;
    }

    case "incluye":
      cuerpo = pk.included.length
        ? `Qué incluye:\n${lista(pk.included)}`
        : pk.includedNote || SIN_SECCION;
      break;

    case "uso": {
      const partes: string[] = [];
      if (pk.functions.length) {
        partes.push(`Funciones (${pk.functions.length}):\n${lista(pk.functions)}`);
      }
      if (pk.usage.length) partes.push(`Instrucciones de uso:\n${lista(pk.usage)}`);
      const temp = pk.specifications.temperatureLimit;
      if (temp?.value) partes.push(`Temperatura máxima: ${temp.value}`);
      cuerpo = partes.length ? partes.join("\n\n") : SIN_SECCION;
      break;
    }

    case "cuidados":
      cuerpo = pk.care.length ? `Cuidados:\n${lista(pk.care)}` : SIN_SECCION;
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
      cuerpo = partes.join("\n\n") || SIN_SECCION;
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
  if (!pk.warranty.duration && !pk.warranty.summary) {
    return {
      answer: `Producto: ${pk.name}\n\n${SIN_SECCION}`,
      actions: [],
      sources: titulos(pk),
      disclaimer: DISCLAIMER_GARANTIA,
    };
  }
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
 * completa, incluidas las afirmaciones aprobadas, las prohibidas, los
 * argumentos de venta y las objeciones preparadas, para que pueda reformular
 * comercialmente sin salirse de lo oficial.
 */
export function knowledgeContextText(pk: ProductKnowledge): string {
  const bloques: string[] = [
    `Producto: ${pk.name} (${pk.category})`,
    `Descripción: ${pk.description.short}`,
  ];
  if (pk.description.full) bloques.push(`Descripción ampliada: ${pk.description.full}`);
  if (pk.quickAnswer) bloques.push(`Resumen rápido: ${pk.quickAnswer}`);
  if (pk.benefits.length) bloques.push(`Beneficios:\n${lista(pk.benefits)}`);
  if (pk.features.length) {
    bloques.push(
      `Características:\n${lista(
        pk.features.map((f) => `${f.title}${f.description ? `: ${f.description}` : ""}`)
      )}`
    );
  }
  bloques.push(
    pk.included.length ? `Qué incluye:\n${lista(pk.included)}` : `Qué incluye: ${pk.includedNote || SIN_SECCION}`
  );
  if (pk.functions.length) bloques.push(`Funciones (${pk.functions.length}):\n${lista(pk.functions)}`);
  if (pk.usage.length) bloques.push(`Uso:\n${lista(pk.usage)}`);

  const specs = [
    specLinea("Capacidad", pk.specifications.capacity),
    specLinea("Material", pk.specifications.material),
    specLinea("Dimensiones", pk.specifications.dimensions),
    specLinea("Temperatura máxima", pk.specifications.temperatureLimit),
    specLinea("Compatibilidad", pk.specifications.compatibility),
    ...pk.specifications.other.map((o) => `${o.title}: ${o.value}`),
  ].filter(Boolean) as string[];
  bloques.push(
    specs.length
      ? `Especificaciones oficiales (lo que no aparece aquí NO existe en la ficha):\n${lista(specs)}`
      : "Especificaciones oficiales: no hay ninguna en la ficha."
  );

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
  if (!pk.recipes.items.length) bloques.push("Recetas oficiales cargadas: ninguna.");
  if (pk.faq.length) {
    bloques.push(`Preguntas frecuentes:\n${lista(pk.faq.map((f) => `${f.question} → ${f.answer}`))}`);
  }
  if (pk.salesArguments.length) {
    bloques.push(`ARGUMENTOS DE VENTA (reformulación de hechos aprobados):\n${lista(pk.salesArguments.map((a) => a.text))}`);
  }
  if (pk.objections.length) {
    bloques.push(
      `OBJECIONES PREPARADAS:\n${lista(pk.objections.map((o) => `"${o.objection}" → ${o.suggestedResponse}`))}`
    );
  }
  if (pk.approvedClaims.length) {
    bloques.push(`AFIRMACIONES APROBADAS:\n${lista(pk.approvedClaims.map((c) => c.claim))}`);
  }
  if (pk.prohibitedClaims.length) {
    bloques.push(`AFIRMACIONES PROHIBIDAS:\n${lista(pk.prohibitedClaims)}`);
  }
  if (pk.sources.length) {
    bloques.push(
      `Fuentes:\n${lista(pk.sources.map((s) => (s.url ? `${s.title} (${s.url})` : s.title)))}`
    );
  }
  return bloques.join("\n\n");
}

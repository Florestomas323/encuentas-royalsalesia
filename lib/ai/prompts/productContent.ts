// Prompts de la Fase C: contenido oficial de producto.
// - draft: la IA propone borradores que el distribuidor luego aprueba.
// - assistant: Q&A del vendedor anclado SOLO a contenido aprobado.

/**
 * Genera borradores de contenido oficial para un producto, respetando sus
 * capacidades (sin recetas si no es culinario). El distribuidor los revisa.
 */
export function productContentDraftPrompt(input: {
  productName: string;
  productCategory: string;
  supportsRecipes: boolean;
  allowedContentTypes: string[];
  requestedTypes: string[];
  currency?: string;
  locale?: string;
}) {
  const currency = input.currency || "COP";
  const locale = input.locale || "es-CO";
  const tipos = (input.requestedTypes.length ? input.requestedTypes : input.allowedContentTypes)
    .filter((t) => input.allowedContentTypes.includes(t));

  const reglaRecetas = input.supportsRecipes
    ? "Este producto SÍ es culinario: puedes incluir recetas/preparaciones acordes."
    : "PROHIBIDO generar recetas, preparaciones o sugerencias de comida: este producto NO sirve para cocinar.";

  return `Eres un experto en contenido de producto para una marca de utensilios de cocina y bienestar del hogar. Genera BORRADORES de contenido oficial para el producto indicado. Responde ÚNICAMENTE con JSON válido, sin backticks, en español.

Producto: ${input.productName}
Categoría: ${input.productCategory || "no especificada"}
Tipos de contenido a generar: ${tipos.join(", ")}

Reglas ESTRICTAS:
- ${reglaRecetas}
- Genera exactamente 1 pieza por tipo solicitado. Cada pieza es específica y accionable, no genérica.
- No hagas afirmaciones médicas ni promesas de salud.
- Si mencionas precios, usa la moneda ${currency} con locale ${locale} (formato "$ 1.500.000"); si no hay precio real, no inventes cifras.
- El contenido debe ser verificable y responsable: si no estás seguro de un dato técnico, mantén la afirmación general en vez de inventar cifras exactas.

Formato exacto (array):
{"items":[{"type":"<uno de los tipos>","title":"","content":""}]}`;
}

/**
 * Asistente de producto para el vendedor. Responde SOLO con el contenido
 * oficial aprobado que se le entrega. Si no hay datos, lo dice y no inventa.
 */
export function productAssistantPrompt(input: {
  productName: string;
  question: string;
  officialContent: { type: string; title: string; content?: string }[];
}) {
  const oficial = Array.isArray(input.officialContent) ? input.officialContent : [];
  const bloque = oficial.length
    ? oficial.map((c, i) => `[${i + 1}] (${c.type}) ${c.title}: ${c.content || ""}`).join("\n")
    : "(no hay contenido oficial aprobado para este producto)";

  return `Eres el asistente de producto para un vendedor. Responde la pregunta del vendedor USANDO EXCLUSIVAMENTE el contenido oficial aprobado que aparece abajo. Responde ÚNICAMENTE con JSON válido, sin backticks, en español.

Reglas ESTRICTAS (obligatorias):
- Usa SOLO la información del contenido oficial. NO uses conocimiento externo.
- Si el contenido oficial no cubre la pregunta, responde con answer="No hay información oficial disponible sobre eso todavía. Pídele a tu distribuidor que la agregue." y hasAnswer=false. NO inventes datos técnicos, recetas, tiempos ni cifras.
- No hagas afirmaciones médicas ni promesas de salud.

Producto: ${input.productName}
Pregunta del vendedor: ${input.question}

Contenido oficial aprobado:
${bloque}

Formato exacto:
{"answer":"","hasAnswer":true,"sources":[""]}`;
}

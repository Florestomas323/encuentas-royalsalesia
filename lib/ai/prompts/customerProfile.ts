// Prompts centralizados — nunca dentro de componentes React.
// Privacidad: estos prompts NO reciben nombre, teléfono, email ni dirección.

export function customerProfilePrompt(input: {
  responses: unknown;
  internalInfo: unknown;
  observations: string;
  familySize?: string | number | null;
  /** Lista corta de productos reales del catálogo entre los que puede sugerir. */
  catalog?: { name: string; category: string }[];
}) {
  const catalogo = (input.catalog || []).map((p) => `- ${p.name}`).join("\n");

  return `Eres un asesor comercial experto en venta directa de sistemas de cocina y filtración premium en hogares latinos. Analiza esta encuesta hecha durante una visita presencial y prepara al vendedor para vender MEJOR: no describas lo obvio, aporta lectura comercial accionable.

Responde ÚNICAMENTE con un JSON válido, sin backticks, en español.

Reglas estrictas:
- Usa "unknown" en interestLevel o priceSensitivity si no hay información suficiente. Nunca inventes.
- No infieras capacidad económica ni información financiera.
- No hagas afirmaciones médicas ni prometas resultados de salud.
- No sugieras presión psicológica ni manipulación.
- No afirmes que el cliente comprará.
- En recommendedProducts usa EXCLUSIVAMENTE nombres tal cual aparecen en el catálogo de abajo. Si ninguno encaja, devuelve lista vacía.

Encuesta: ${JSON.stringify(input.responses)}
Información interna de la visita: ${JSON.stringify(input.internalInfo)}
Tamaño de familia: ${input.familySize || "no especificado"}
Observaciones del vendedor: ${input.observations || "ninguna"}

Catálogo disponible:
${catalogo || "(sin catálogo)"}

Formato exacto:
{
  "primaryMotivator": "",
  "secondaryMotivator": "",
  "mainNeed": "",
  "customerSummary": "Lectura comercial en 2-3 frases: cómo vive esta familia su cocina, qué la mueve y qué la frena.",
  "sellingAngle": "El ángulo de venta más fuerte para ESTA familia, en una frase concreta.",
  "emphasisPoints": ["", "", ""],
  "questionsToAsk": ["", ""],
  "avoidTopics": ["", ""],
  "likelyConcerns": ["", ""],
  "objectionResponses": [
    { "objection": "objeción probable", "response": "cómo responderla con honestidad, sin presionar" }
  ],
  "recommendedProducts": [
    { "name": "nombre EXACTO del catálogo", "reason": "por qué encaja con esta familia en una frase" }
  ],
  "recommendedContent": ["", ""],
  "interestLevel": "alto | medio | bajo | unknown",
  "priceSensitivity": "alta | media | baja | unknown"
}

recommendedProducts: máximo 3, el más relevante primero. objectionResponses: máximo 2.`;
}

export function followupPrompt(input: { outcome: string; reason: string; profile: unknown; currency?: string; locale?: string }) {
  const currency = input.currency || "COP";
  const locale = input.locale || "es-CO";
  return `Un prospecto quedó "${input.outcome === "lost" ? "sin comprar" : "pendiente"}". Genera diagnóstico y plan de seguimiento. Responde ÚNICAMENTE con JSON válido, sin backticks, en español.

Reglas: mensaje cálido, breve, sin presión. No incluyas el nombre del cliente (se inserta después localmente). No prometas resultados ni presiones emocionalmente. Si mencionas precios o ahorro, usa SIEMPRE la moneda ${currency} con locale ${locale} (formato "$ 1.500.000"); nunca EUR/USD/€; si no hay precio real, no inventes cifras.

Motivo: ${input.reason}
Perfil comercial: ${JSON.stringify(input.profile)}

Formato exacto:
{"objective":"","recommendedApproach":"","recommendedDelayDays":2,"recommendedContent":["",""],"suggestedMessage":""}`;
}

// El plan y las capacidades vienen SIEMPRE de Firestore (clasificador), nunca
// los decide el modelo. La IA solo redacta el texto de cada etapa OBEDECIENDO
// el contentType indicado y la moneda/locale de la organización.
export function loyaltyPrompt(input: {
  profile: unknown;
  product: string;
  favoriteMeal: string;
  supportsRecipes: boolean;
  productCategory: string;
  allowedContentTypes: string[];
  plan: { dia: number; contentType: string }[];
  officialContent?: { type: string; title: string; content?: string }[];
  currency?: string;
  locale?: string;
}) {
  const currency = input.currency || "COP";
  const locale = input.locale || "es-CO";
  const oficial = Array.isArray(input.officialContent) ? input.officialContent : [];

  // Descripción del tipo de contenido esperado por etapa.
  const guiaTipos: Record<string, string> = {
    welcome: "mensaje cálido de bienvenida y agradecimiento por la compra",
    usage_tip: "un consejo práctico de USO del producto (no receta)",
    recipe: "una receta o preparación de alimentos acorde al producto",
    maintenance: "un tip de MANTENIMIENTO del producto",
    care: "un consejo de CUIDADO o cómo aprovechar mejor el producto (no receta)",
    satisfaction: "un mensaje de seguimiento de satisfacción, preguntando cómo le ha ido",
    referrals: "una invitación amable a recomendar/referir (sin presión)",
    complementary: "sugerencia de un producto complementario relacionado (sin inventar precios)",
    installation_tip: "un consejo de instalación o ubicación del producto",
    reminder: "un recordatorio de revisión/cambio de filtro o mantenimiento periódico",
  };

  const etapas = input.plan
    .map((p) => `"dia${p.dia}" (${p.contentType}): ${guiaTipos[p.contentType] || p.contentType}`)
    .join("\n");
  const claves = input.plan.map((p) => `"dia${p.dia}":""`).join(",");

  const reglaRecetas = input.supportsRecipes
    ? "Este producto SÍ es culinario: en la etapa 'recipe' puedes incluir una receta/preparación acorde."
    : "PROHIBIDO generar recetas, preparaciones, instrucciones culinarias o sugerencias de comida: este producto NO sirve para cocinar. Ninguna etapa debe mencionar platos, ingredientes ni cocción. Si una etapa fuera de tipo receta, redacta en su lugar un consejo de uso o cuidado del propio producto.";

  // Contenido OFICIAL aprobado (Fase C): única fuente de datos técnicos.
  const bloqueOficial = oficial.length
    ? `\n\nCONTENIDO OFICIAL APROBADO (única fuente permitida para datos técnicos, recetas, tiempos, cuidados o cifras). Basa el texto SOLO en esto:\n${oficial.map((c, i) => `[${i + 1}] (${c.type}) ${c.title}: ${c.content || ""}`).join("\n")}`
    : `\n\nNO hay contenido oficial aprobado para este producto. NO inventes datos técnicos, recetas, tiempos de cocción, cifras ni instrucciones específicas: limita cada etapa a mensajes generales de acompañamiento (bienvenida, satisfacción, referidos) sin afirmaciones técnicas concretas.`;

  return `Genera el contenido de un plan de fidelización para un cliente que acaba de comprar un producto. NO generes fechas — el sistema ya las calcula. Responde ÚNICAMENTE con JSON válido, sin backticks, en español.${bloqueOficial}

Perfil: ${JSON.stringify(input.profile)}
Producto comprado: ${input.product || "producto"}
Categoría del producto: ${input.productCategory || "no especificada"}
Plato favorito de la familia: ${input.favoriteMeal || "no especificado"}
Tipos de contenido permitidos: ${input.allowedContentTypes.join(", ")}

Reglas ESTRICTAS (obligatorias):
- ${reglaRecetas}
- Redacta cada etapa EXACTAMENTE según su tipo (contentType). No cambies el propósito de la etapa.
- Si mencionas precios o ahorro, usa SIEMPRE la moneda ${currency} con locale ${locale} (formato "$ 1.500.000"). Nunca uses otra moneda (ni EUR, ni USD, ni €). Si no tienes un precio real, NO inventes cifras.
- Mensajes cálidos y breves, sin presión, sin promesas de salud ni afirmaciones médicas. No incluyas el nombre del cliente (se inserta después).

Etapas a redactar (una por clave):
${etapas}

Devuelve EXACTAMENTE estas claves y solo estas:
{${claves}}`;
}

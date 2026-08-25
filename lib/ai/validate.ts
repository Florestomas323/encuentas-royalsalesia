import "server-only";

// Validación estricta de las respuestas de IA.
// En vez de confiar en el JSON tal cual llega, lo normalizamos a la forma exacta
// que la interfaz espera: campos faltantes quedan vacíos, arrays se recortan a su
// máximo, y los enums solo aceptan valores conocidos (si no, "unknown").
function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function strArray(v: unknown, max: number): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x) => typeof x === "string" && x.trim()).map((x) => x.trim()).slice(0, max);
}

function enumOr(v: unknown, allowed: string[], fallback = "unknown"): string {
  return typeof v === "string" && allowed.includes(v) ? v : fallback;
}

/** Normaliza una lista de objetos {clave: texto} con tope de elementos. */
function objArray(v: unknown, claves: string[], max: number): Record<string, string>[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x) => x && typeof x === "object")
    .map((x: any) => {
      const o: Record<string, string> = {};
      for (const k of claves) o[k] = str(x?.[k]);
      return o;
    })
    .filter((o) => claves.every((k) => o[k]))
    .slice(0, max);
}

export type CustomerProfile = {
  primaryMotivator: string;
  secondaryMotivator: string;
  mainNeed: string;
  customerSummary: string;
  emphasisPoints: string[];
  questionsToAsk: string[];
  avoidTopics: string[];
  likelyConcerns: string[];
  recommendedContent: string[];
  sellingAngle: string;
  objectionResponses: Record<string, string>[];
  recommendedProducts: Record<string, string>[];
  interestLevel: string;
  priceSensitivity: string;
};

export function validateCustomerProfile(raw: any): CustomerProfile {
  const profile: CustomerProfile = {
    primaryMotivator: str(raw?.primaryMotivator),
    secondaryMotivator: str(raw?.secondaryMotivator),
    mainNeed: str(raw?.mainNeed),
    customerSummary: str(raw?.customerSummary),
    emphasisPoints: strArray(raw?.emphasisPoints, 3),
    questionsToAsk: strArray(raw?.questionsToAsk, 2),
    avoidTopics: strArray(raw?.avoidTopics, 3),
    likelyConcerns: strArray(raw?.likelyConcerns, 2),
    recommendedContent: strArray(raw?.recommendedContent, 5),
    sellingAngle: str(raw?.sellingAngle),
    objectionResponses: objArray(raw?.objectionResponses, ["objection", "response"], 2),
    recommendedProducts: objArray(raw?.recommendedProducts, ["name", "reason"], 3),
    interestLevel: enumOr(raw?.interestLevel, ["alto", "medio", "bajo"]),
    priceSensitivity: enumOr(raw?.priceSensitivity, ["alta", "media", "baja"]),
  };
  // Sin motivador principal el perfil no sirve para nada en pantalla.
  if (!profile.primaryMotivator) throw new Error("Perfil de IA incompleto.");
  return profile;
}

export function validateFollowup(raw: any) {
  const dias = Number(raw?.recommendedDelayDays);
  return {
    objective: str(raw?.objective),
    recommendedApproach: str(raw?.recommendedApproach),
    recommendedDelayDays: Number.isFinite(dias) && dias >= 1 && dias <= 90 ? Math.round(dias) : 2,
    recommendedContent: strArray(raw?.recommendedContent, 5),
    suggestedMessage: str(raw?.suggestedMessage),
  };
}

export function validateLoyalty(raw: any, dias: number[] = [1, 3, 7, 15, 30, 45, 60]) {
  const out: Record<string, string> = {};
  for (const d of dias) out[`dia${d}`] = str(raw?.[`dia${d}`]);
  return out;
}

// Fase C: borradores de contenido oficial. Cada item debe tener un tipo
// permitido, título y contenido; se descartan los que no cumplan.
export function validateContentDraft(raw: any, allowedTypes: string[] = []) {
  const arr = Array.isArray(raw?.items) ? raw.items : [];
  const items = arr
    .map((it: any) => ({
      type: str(it?.type),
      title: str(it?.title),
      content: str(it?.content),
    }))
    .filter((it: any) => it.title && it.content && (!allowedTypes.length || allowedTypes.includes(it.type)))
    .slice(0, 12);
  if (!items.length) throw new Error("La IA no generó contenido válido.");
  return { items };
}

// Fase C: respuesta del asistente de producto.
export function validateProductAnswer(raw: any) {
  const answer = str(raw?.answer);
  return {
    answer: answer || "No hay información oficial disponible sobre eso todavía.",
    hasAnswer: raw?.hasAnswer === true && !!answer,
    sources: strArray(raw?.sources, 6),
  };
}

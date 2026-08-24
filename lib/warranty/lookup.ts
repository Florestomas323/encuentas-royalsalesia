import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { WARRANTY_KNOWLEDGE, type WarrantyKnowledge } from "./data";

// Consulta del conocimiento OFICIAL de garantías (colección global
// `warrantyKnowledge`). Lee de Firestore; si la colección aún no está sembrada,
// usa el archivo del repo como respaldo para que el Copilot nunca se quede sin
// la información oficial. NUNCA reescribe los textos: son citas literales.

let cache: { at: number; items: WarrantyKnowledge[] } | null = null;
const TTL_MS = 5 * 60 * 1000; // 5 min: el conocimiento cambia rarísima vez.

async function loadAll(): Promise<WarrantyKnowledge[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.items;
  try {
    const snap = await adminDb().collection("warrantyKnowledge").where("active", "==", true).get();
    if (!snap.empty) {
      const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as WarrantyKnowledge[];
      cache = { at: Date.now(), items };
      return items;
    }
  } catch {
    // Firestore no disponible o colección sin sembrar: usamos el respaldo local.
  }
  const fallback = WARRANTY_KNOWLEDGE.filter((w) => w.active);
  cache = { at: Date.now(), items: fallback };
  return fallback;
}

// La política global aplica SIEMPRE (elegibilidad, requisitos de reclamo, etc.).
export async function getGlobalPolicy(): Promise<WarrantyKnowledge | null> {
  const all = await loadAll();
  return all.find((w) => w.scope === "global") || null;
}

// Devuelve la garantía específica de un producto: coincidencia directa por
// productId; si no, por categoría del producto. Junto con la política global,
// es TODO lo que el Copilot puede afirmar sobre garantías.
export async function getWarrantyForProduct(
  productId: string | undefined,
  category?: string
): Promise<WarrantyKnowledge[]> {
  const all = await loadAll();
  const matches: WarrantyKnowledge[] = [];
  if (productId) {
    for (const w of all) {
      if (w.scope !== "global" && w.productIds?.includes(productId)) matches.push(w);
    }
  }
  // Respaldo por categoría cuando no hay match directo (p. ej. cuchillería).
  if (matches.length === 0 && category) {
    const cat = category.toLowerCase();
    for (const w of all) {
      if (w.scope === "category" && w.productName.toLowerCase().includes(cat)) matches.push(w);
    }
  }
  return matches;
}

// Búsqueda por texto libre (para preguntas de garantía sin producto concreto).
// Puntúa por coincidencias en nombre, resumen y componentes. Devuelve los más
// relevantes para acotar el contexto que se envía al modelo.
export async function searchWarranty(queryText: string, limit = 4): Promise<WarrantyKnowledge[]> {
  const all = await loadAll();
  const terms = queryText.toLowerCase().split(/\s+/).filter((t) => t.length > 3);
  if (terms.length === 0) return [];
  const scored = all
    .filter((w) => w.scope !== "global")
    .map((w) => {
      const haystack = [
        w.productName,
        w.coverageSummary,
        ...(w.componentCoverage || []).map((c) => `${c.component} ${c.period}`),
      ]
        .join(" ")
        .toLowerCase();
      const score = terms.reduce((s, t) => (haystack.includes(t) ? s + 1 : s), 0);
      return { w, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.w);
  return scored;
}

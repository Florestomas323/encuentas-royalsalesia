import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { getGlobalPolicy, getWarrantyForProduct } from "@/lib/warranty/lookup";
import type { WarrantyKnowledge } from "@/lib/warranty/data";

// Agregación de contexto para el Royal Copilot, 100% en el servidor con el
// service account (adminDb). El navegador solo manda IDs; aquí se relee todo y
// se VALIDA la pertenencia a la organización, para que sea imposible falsear
// datos o cruzar organizaciones. La lógica de ciclo de vida se replica ligera
// para no acoplar este módulo server-only con el SDK de cliente.

const DAY = 86400000;

function ms(t: any): number | null {
  if (!t) return null;
  if (typeof t?.toDate === "function") return t.toDate().getTime(); // Timestamp admin
  if (t instanceof Date) return t.getTime();
  if (typeof t === "number") return t;
  const d = new Date(t);
  return isNaN(d.getTime()) ? null : d.getTime();
}

async function queryByCustomer(collection: string, orgId: string, customerId: string) {
  const snap = await adminDb()
    .collection(collection)
    .where("organizationId", "==", orgId)
    .where("customerId", "==", customerId)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
}

// ---------- CONTEXTO DEL CLIENTE (resumen seguro, sin datos de contacto) ----------
export async function getCustomerContextServer(
  orgId: string,
  customerId: string,
  opts: { onlyTestData?: boolean } = {}
): Promise<string | null> {
  const doc = await adminDb().collection("customers").doc(customerId).get();
  if (!doc.exists) return null;
  const customer = { id: doc.id, ...(doc.data() as any) };

  // Aislamiento estricto: el cliente debe pertenecer a la organización.
  if (customer.organizationId !== orgId) return null;
  // El reviewer solo puede ver datos de prueba.
  if (opts.onlyTestData && customer.isTestData !== true) return null;

  const [purchases, services, followups, aiProfiles] = await Promise.all([
    queryByCustomer("purchases", orgId, customerId),
    queryByCustomer("postSaleServices", orgId, customerId),
    queryByCustomer("followups", orgId, customerId),
    queryByCustomer("aiProfiles", orgId, customerId),
  ]);

  const now = Date.now();
  const servPend = services.filter((s) => s.status !== "completed");
  const followPend = followups.filter((f) => f.status === "pending");
  const overdue = followPend.filter((f) => { const t = ms(f.scheduledAt); return t != null && t < now; });

  // Estado del ciclo de vida (mismas reglas que la Fase D).
  let estado = "Prospecto";
  if (overdue.length) estado = "Requiere atención (seguimiento vencido)";
  else if (customer.status === "lost") estado = "Perdido";
  else if (servPend.length) estado = "Servicio postventa pendiente";
  else if (followPend.length) estado = "En fidelización";
  else if (purchases.length || customer.status === "purchased") estado = "Cliente activo";

  // Próxima acción (misma prioridad que la Fase D).
  let proxima = "Sin acciones pendientes";
  if (servPend.length) {
    proxima = `Completar servicio postventa (${servPend.map((s) => s.productName).filter(Boolean).slice(0, 2).join(", ")})`;
  } else if (followPend.length) {
    const next = [...followPend].sort((a, b) => (ms(a.scheduledAt) ?? 0) - (ms(b.scheduledAt) ?? 0))[0];
    const due = ms(next.scheduledAt);
    proxima = `${next.objective || "Contactar al cliente"}${due && due < now ? " (vencido)" : ""}`;
  } else if (purchases.some((p) => p?.pendingLoyalty?.active === true)) {
    proxima = "Fidelización en espera de que se complete el servicio";
  }

  const nombre = [customer.firstName, customer.lastName].filter(Boolean).join(" ") || "Cliente";
  const señales: string[] = [];
  if (purchases.length) señales.push(`${purchases.length} compra(s)`);
  if (servPend.length) señales.push(`${servPend.length} servicio(s) pendiente(s)`);
  if (followPend.length) señales.push(`${followPend.length} seguimiento(s) pendiente(s)`);
  if (customer.familySize) señales.push(`familia de ${customer.familySize}`);

  // Perfil comercial IA más reciente (solo strings, sin PII).
  const perfilDoc = aiProfiles.sort((a, b) => (ms(b.createdAt) ?? 0) - (ms(a.createdAt) ?? 0))[0];
  const perfil = perfilDoc?.profile;
  const perfilTxt = perfil && typeof perfil === "object"
    ? Object.values(perfil).filter((v) => typeof v === "string").slice(0, 3).join(" · ")
    : "";

  // Productos que ya compró (para anclar respuestas de producto/garantía).
  const productosComprados = Array.from(
    new Set(purchases.flatMap((p) => (Array.isArray(p.products) ? p.products.map((x: any) => x?.name).filter(Boolean) : [])))
  ).slice(0, 8);

  return [
    `Cliente: ${nombre}.`,
    `Estado: ${estado}.`,
    `Próxima acción: ${proxima}.`,
    señales.length ? `Señales: ${señales.join(", ")}.` : "",
    perfilTxt ? `Perfil comercial: ${perfilTxt}.` : "",
    productosComprados.length ? `Productos comprados: ${productosComprados.join(", ")}.` : "",
  ].filter(Boolean).join("\n");
}

// ---------- IDENTIFICACIÓN FLEXIBLE DE PRODUCTO ----------
export interface ProductMatch { id: string; name: string; category?: string }

// Normaliza texto para comparar (minúsculas, sin acentos).
function norm(s: any): string {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// Sinónimos ES genéricos → tokens que aparecen en el catálogo real (mezcla
// inglés/español). Permite que "la licuadora" encuentre "Power Blender".
const SYNONYMS: Record<string, string[]> = {
  licuadora: ["blender"],
  batidora: ["blender", "mixer"],
  olla: ["pot", "cookware", "dutch", "saucepan", "stock", "casserole", "sistema", "system"],
  presion: ["pressure", "presion"],
  sarten: ["skillet", "pan", "saute", "paella", "grill"],
  paellera: ["paella"],
  cuchillo: ["knife", "cutlery"],
  cuchillos: ["knife", "cutlery"],
  cubiertos: ["cutlery", "flatware"],
  filtro: ["filter", "fresca", "frescapure", "frescaflow", "shower", "air"],
  agua: ["water", "fresca", "filter"],
  jugo: ["juicer", "juice", "exprimidor"],
  exprimidor: ["juicer", "exprimidor"],
  jugos: ["juicer", "juice"],
  cafe: ["espresso", "barista", "coffee", "expertea"],
  cafetera: ["espresso", "barista", "coffee"],
  te: ["expertea", "tea"],
  vaso: ["cup", "glass", "vaso", "copa"],
  copa: ["copa", "glass", "cup"],
  jarra: ["jarra", "pitcher", "jug", "tritan"],
  tabla: ["cutting", "tabla"],
  sartenes: ["skillet", "pan"],
};

const STOP = new Set(["para", "sobre", "cual", "cuales", "producto", "productos", "garantia", "beneficios", "beneficio", "explicame", "explica", "dame", "quiero", "necesito", "royal", "prestige", "que", "los", "las", "del", "con", "una", "uno", "este", "esta"]);

// Puntúa cada producto de la org contra el mensaje. Devuelve candidatos
// ordenados por relevancia (mayor score primero).
function scoreProducts(productos: any[], message: string): { p: any; score: number }[] {
  const m = norm(message);
  const tokens = m.split(/\s+/).filter((t) => t.length > 2 && !STOP.has(t));
  // Expandir tokens con sinónimos.
  const expanded = new Set<string>(tokens);
  for (const t of tokens) for (const syn of SYNONYMS[t] || []) expanded.add(syn);

  return productos
    .map((p) => {
      const name = norm(p.name);
      const hay = [name, norm(p.category), norm(p.line), norm(p.productFamily)].join(" ");
      let score = 0;
      if (name && m.includes(name)) score += 10; // nombre completo mencionado
      for (const t of expanded) {
        if (!t) continue;
        if (name.split(/\s+/).includes(t)) score += 3;
        else if (hay.includes(t)) score += 1;
      }
      return { p, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
}

// ---------- CONTEXTO DE PRODUCTO (CAPA 1 products + CAPA 2 productContent) ----------
// CAPA 1 (primaria): datos oficiales del catálogo (products). CAPA 2: contenido
// adicional aprobado (productContent). El Copilot responde con lo que exista en
// CAPA 1 aunque CAPA 2 esté vacía; solo dice "no tengo info" si ninguna la tiene.
function buildProductText(p: any, byId: Map<string, any>, approved: any[]): string {
  const l: string[] = [];
  l.push(`DATOS DE CATÁLOGO (CAPA 1 — fuente oficial primaria)`);
  l.push(`Producto: ${p.name}`);
  const meta = [p.brand && `Marca: ${p.brand}`, p.line && `Línea: ${p.line}`, p.category && `Categoría: ${p.category}`].filter(Boolean);
  if (meta.length) l.push(meta.join(" · "));
  l.push(`Tipo: ${p.type === "set" ? "Set (paquete con piezas)" : "Producto individual"}`);
  if (Array.isArray(p.pieceIds) && p.pieceIds.length) {
    const piezas = p.pieceIds.map((id: string) => byId.get(id)?.name || id).filter(Boolean);
    if (piezas.length) l.push(`Incluye: ${piezas.join(", ")}`);
  }
  if (Array.isArray(p.features) && p.features.length) l.push(`Características (catálogo): ${p.features.join("; ")}`);
  if (p.warranty) l.push(`Garantía (catálogo): ${p.warranty}`);
  if (p.requiresPostSaleService) l.push(`Servicio postventa: requerido${p.postSaleServiceType ? ` (${p.postSaleServiceType})` : ""}`);
  if (p.notes) l.push(`Notas: ${p.notes}`);

  if (approved.length) {
    l.push(`\nCONTENIDO APROBADO (CAPA 2 — recetas/tips/cuidados/FAQ):`);
    for (const it of approved) l.push(`• (${it.type}) ${it.title}: ${it.content || ""}`);
  } else {
    l.push(`\n(CAPA 2: sin contenido adicional aprobado todavía — responde con CAPA 1.)`);
  }
  return l.join("\n");
}

async function loadOrgProducts(orgId: string) {
  const snap = await adminDb().collection("products").where("organizationId", "==", orgId).get();
  const arr = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
  const byId = new Map(arr.map((p) => [p.id, p]));
  return { arr, byId };
}

async function approvedContent(orgId: string, productId: string) {
  const snap = await adminDb()
    .collection("productContent")
    .where("organizationId", "==", orgId)
    .where("productId", "==", productId)
    .where("status", "==", "approved")
    .get();
  return snap.docs.map((d) => d.data() as any);
}

// Contexto por productId EXPLÍCITO (el vendedor lo eligió en el selector).
export async function getProductContextById(
  orgId: string,
  productId: string
): Promise<{ text: string | null; matched: ProductMatch[] }> {
  const { byId } = await loadOrgProducts(orgId);
  const p = byId.get(productId);
  if (!p) return { text: null, matched: [] };
  const approved = await approvedContent(orgId, productId);
  return {
    text: buildProductText(p, byId, approved),
    matched: [{ id: p.id, name: p.name, category: p.category }],
  };
}

// Contexto por TEXTO LIBRE. Devuelve el contexto si hay un único match claro,
// o `candidates` para desambiguar cuando hay varios plausibles.
export async function getProductContextServer(
  orgId: string,
  message: string
): Promise<{ text: string | null; matched: ProductMatch[]; candidates: ProductMatch[] }> {
  const { arr, byId } = await loadOrgProducts(orgId);
  if (!arr.length) return { text: null, matched: [], candidates: [] };

  const scored = scoreProducts(arr, message);
  if (!scored.length) return { text: null, matched: [], candidates: [] };

  // Un solo match claro: score dominante o único resultado.
  const top = scored[0];
  const second = scored[1];
  const claro = !second || top.score >= second.score + 3 || top.score >= 10;

  if (claro) {
    const approved = await approvedContent(orgId, top.p.id);
    return {
      text: buildProductText(top.p, byId, approved),
      matched: [{ id: top.p.id, name: top.p.name, category: top.p.category }],
      candidates: [],
    };
  }

  // Varios plausibles: pedir al vendedor que elija (sin llamar a la IA).
  const candidates = scored.slice(0, 5).map((x) => ({ id: x.p.id, name: x.p.name, category: x.p.category }));
  return { text: null, matched: [], candidates };
}

// ---------- CONTEXTO DE GARANTÍA (un producto a la vez) ----------
function formatWarranty(w: WarrantyKnowledge, label: string): string {
  const partes = [`${label}: ${w.productName}`, `Cobertura: ${w.coverageSummary}`];
  if (w.componentCoverage?.length) {
    partes.push("Cobertura por componente:\n" + w.componentCoverage.map((c) => `  - ${c.component}: ${c.period}`).join("\n"));
  }
  if (w.conditions?.length) partes.push("Condiciones importantes: " + w.conditions.join(" "));
  if (w.exclusions?.length) partes.push("Exclusiones: " + w.exclusions.join(" "));
  if (w.claimRequirements?.length) partes.push("Para iniciar un reclamo: " + w.claimRequirements.join(" "));
  partes.push(`Fuente oficial: ${w.officialSourceUrl}`);
  return partes.join("\n");
}

// Garantía de UN producto conocido: registro específico como respuesta
// principal + política global SOLO como condiciones generales complementarias.
export async function getWarrantyContextServer(
  matchedProducts: ProductMatch[]
): Promise<string | null> {
  if (!matchedProducts.length) return null;
  const target = matchedProducts[0];
  const bloques: string[] = [];

  const specific = await getWarrantyForProduct(target.id, target.category);
  if (specific.length) {
    // Registro específico del producto (el primero es el más directo).
    bloques.push(formatWarranty(specific[0], "GARANTÍA ESPECÍFICA DEL PRODUCTO"));
  } else {
    bloques.push(
      `GARANTÍA ESPECÍFICA DEL PRODUCTO: ${target.name}\n(No hay un registro específico para este producto; aplica la política general de garantía a continuación.)`
    );
  }

  const global = await getGlobalPolicy();
  if (global) bloques.push(formatWarranty(global, "POLÍTICA GENERAL (complementaria, NO es la garantía específica)"));

  return bloques.join("\n\n");
}

// Reglas generales de garantía (solo cuando el vendedor pregunta explícitamente
// por la política general, sin un producto concreto).
export async function getGeneralWarrantyContext(): Promise<string | null> {
  const global = await getGlobalPolicy();
  return global ? formatWarranty(global, "POLÍTICA GENERAL DE GARANTÍA") : null;
}

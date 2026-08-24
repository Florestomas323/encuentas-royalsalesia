import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { getGlobalPolicy, getWarrantyForProduct, searchWarranty } from "@/lib/warranty/lookup";
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

// ---------- CONTEXTO DE PRODUCTO (catálogo + contenido aprobado) ----------
// Detecta productos mencionados en el mensaje (o el producto de un cliente) y
// devuelve su contenido oficial APROBADO, además de metadatos para garantías.
export async function getProductContextServer(
  orgId: string,
  message: string
): Promise<{ text: string | null; matched: { id: string; name: string; category?: string }[] }> {
  const prodSnap = await adminDb().collection("products").where("organizationId", "==", orgId).get();
  const productos = prodSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
  if (!productos.length) return { text: null, matched: [] };

  const m = message.toLowerCase();
  const matched = productos
    .filter((p) => {
      const name = String(p.name || "").toLowerCase();
      if (name.length < 3) return false;
      // Coincidencia por nombre completo o por palabras significativas del nombre.
      if (m.includes(name)) return true;
      const words = name.split(/\s+/).filter((w: string) => w.length > 3);
      return words.some((w: string) => m.includes(w));
    })
    .slice(0, 3);

  if (!matched.length) return { text: null, matched: [] };

  // Contenido oficial APROBADO de los productos coincidentes.
  const bloques: string[] = [];
  for (const p of matched) {
    const cSnap = await adminDb()
      .collection("productContent")
      .where("organizationId", "==", orgId)
      .where("productId", "==", p.id)
      .where("status", "==", "approved")
      .get();
    const items = cSnap.docs.map((d) => d.data() as any);
    if (items.length) {
      const txt = items.map((it) => `• (${it.type}) ${it.title}: ${it.content}`).join("\n");
      bloques.push(`Producto "${p.name}"${p.category ? ` [${p.category}]` : ""}:\n${txt}`);
    } else {
      bloques.push(`Producto "${p.name}"${p.category ? ` [${p.category}]` : ""}: (sin contenido oficial aprobado todavía)`);
    }
  }

  return {
    text: bloques.join("\n\n"),
    matched: matched.map((p) => ({ id: p.id, name: p.name, category: p.category })),
  };
}

// ---------- CONTEXTO DE GARANTÍA (conocimiento oficial global) ----------
function formatWarranty(w: WarrantyKnowledge): string {
  const partes = [`GARANTÍA — ${w.productName}: ${w.coverageSummary}`];
  if (w.componentCoverage?.length) {
    partes.push("Cobertura por componente: " + w.componentCoverage.map((c) => `${c.component} (${c.period})`).join("; ") + ".");
  }
  if (w.conditions?.length) partes.push("Condiciones: " + w.conditions.join(" ") );
  if (w.exclusions?.length) partes.push("Exclusiones: " + w.exclusions.join(" "));
  if (w.claimRequirements?.length) partes.push("Reclamo: " + w.claimRequirements.join(" "));
  return partes.join("\n");
}

export async function getWarrantyContextServer(
  message: string,
  matchedProducts: { id: string; name: string; category?: string }[]
): Promise<string | null> {
  const bloques: string[] = [];

  // La política global aplica SIEMPRE en temas de garantía.
  const global = await getGlobalPolicy();
  if (global) bloques.push(formatWarranty(global));

  // Garantía específica de los productos mencionados.
  const vistos = new Set<string>();
  for (const p of matchedProducts) {
    const ws = await getWarrantyForProduct(p.id, p.category);
    for (const w of ws) {
      if (!vistos.has(w.id)) { vistos.add(w.id); bloques.push(formatWarranty(w)); }
    }
  }

  // Si no se identificó producto, busca por texto libre.
  if (matchedProducts.length === 0) {
    const ws = await searchWarranty(message, 3);
    for (const w of ws) {
      if (!vistos.has(w.id)) { vistos.add(w.id); bloques.push(formatWarranty(w)); }
    }
  }

  return bloques.length ? bloques.join("\n\n") : null;
}

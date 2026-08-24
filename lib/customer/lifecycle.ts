// Fase D — Cliente 360°: lógica PURA + agregación de solo lectura.
// No escribe nada, no llama a IA y no inventa datos: todo se deriva de las
// colecciones existentes (customers, purchases, purchaseItems, postSaleServices,
// followups, visits, aiProfiles). El estado del ciclo de vida se CALCULA aquí en
// vez de guardarse como un enum nuevo.

import { tsToDate } from "@/lib/db/services";
import {
  getCustomer,
  getPurchasesForCustomer,
  getPurchaseItemsForCustomer,
  getPostSaleServicesForCustomer,
  getFollowupsForCustomer,
  getVisitsForCustomer,
  getAiProfilesForCustomer,
} from "@/lib/db/services";
import type { Ctx } from "@/lib/db/services";

const DAY = 86400000;

function ms(t: any): number | null {
  const d = tsToDate(t);
  return d ? d.getTime() : null;
}

// ---------- ESTADO DEL CICLO DE VIDA (calculado) ----------
export type LifecycleStatus =
  | "prospect"        // sin compras aún
  | "lost"            // marcado como perdido
  | "service_pending" // compró pero tiene servicio postventa pendiente
  | "loyalty_active"  // en plan de fidelización (seguimientos pendientes)
  | "overdue"         // tiene un seguimiento/servicio vencido
  | "customer";       // compró, sin pendientes

export interface LifecycleInput {
  customer: any;
  purchases: any[];
  services: any[];
  followups: any[];
}

export interface LifecycleResult {
  status: LifecycleStatus;
  label: string;
  tone: "neutral" | "brand" | "accent" | "warn" | "danger" | "success";
  hasOverdue: boolean;
}

const STATUS_META: Record<LifecycleStatus, { label: string; tone: LifecycleResult["tone"] }> = {
  prospect: { label: "Prospecto", tone: "neutral" },
  lost: { label: "Perdido", tone: "danger" },
  service_pending: { label: "Servicio pendiente", tone: "accent" },
  loyalty_active: { label: "En fidelización", tone: "brand" },
  overdue: { label: "Requiere atención", tone: "warn" },
  customer: { label: "Cliente activo", tone: "success" },
};

/** Deriva el estado del ciclo de vida a partir de los datos ya cargados. */
export function getCustomerLifecycleStatus(input: LifecycleInput): LifecycleResult {
  const { customer, purchases, services, followups } = input;
  const now = Date.now();

  const servPend = (services || []).filter((s) => s.status !== "completed");
  const followPend = (followups || []).filter((f) => f.status === "pending");
  const overdueFollow = followPend.filter((f) => {
    const t = ms(f.scheduledAt);
    return t != null && t < now;
  });

  const hasOverdue = overdueFollow.length > 0;
  let status: LifecycleStatus;

  if (hasOverdue) status = "overdue";
  else if ((customer?.status) === "lost") status = "lost";
  else if (servPend.length > 0) status = "service_pending";
  else if (followPend.length > 0) status = "loyalty_active";
  else if ((purchases || []).length > 0 || customer?.status === "purchased") status = "customer";
  else status = "prospect";

  const meta = STATUS_META[status];
  return { status, label: meta.label, tone: meta.tone, hasOverdue };
}

// ---------- PRÓXIMA ACCIÓN (determinística, sin IA) ----------
export type NextActionKind = "service" | "followup" | "loyalty_waiting" | "reengage" | "none";
export interface NextAction {
  kind: NextActionKind;
  label: string;       // qué hacer
  detail?: string;     // contexto corto
  dueMs?: number | null;
  overdue?: boolean;
}

/**
 * Calcula la ÚNICA próxima acción recomendada por prioridad:
 * 1) servicio postventa pendiente → 2) seguimiento vencido/próximo →
 * 3) fidelización en espera → 4) reenganche (cliente sin interacción) → nada.
 */
export function computeNextAction(input: LifecycleInput): NextAction {
  const { customer, purchases, services, followups } = input;
  const now = Date.now();

  const servPend = (services || []).filter((s) => s.status !== "completed");
  if (servPend.length > 0) {
    return {
      kind: "service",
      label: "Completar servicio postventa",
      detail: servPend.map((s) => s.productName).filter(Boolean).slice(0, 2).join(", "),
    };
  }

  const followPend = (followups || [])
    .filter((f) => f.status === "pending" && ms(f.scheduledAt) != null)
    .sort((a, b) => (ms(a.scheduledAt)! - ms(b.scheduledAt)!));
  if (followPend.length > 0) {
    const next = followPend[0];
    const due = ms(next.scheduledAt)!;
    return {
      kind: "followup",
      label: next.objective || "Contactar al cliente",
      detail: next.suggestedMessage ? String(next.suggestedMessage).slice(0, 90) : "",
      dueMs: due,
      overdue: due < now,
    };
  }

  // Compró, plan de fidelización en espera por servicio (edge) — informativo.
  const loyaltyWaiting = (purchases || []).some((p) => p?.pendingLoyalty?.active === true);
  if (loyaltyWaiting) {
    return { kind: "loyalty_waiting", label: "Fidelización en espera del servicio", detail: "Se activa al completar el servicio." };
  }

  // Cliente sin pendientes: sugerir reenganche solo si hace mucho no hay contacto.
  if ((purchases || []).length > 0 || customer?.status === "purchased") {
    const lastPurchase = Math.max(0, ...(purchases || []).map((p) => ms(p.purchaseDate) ?? 0));
    if (lastPurchase && now - lastPurchase > 60 * DAY) {
      return { kind: "reengage", label: "Reactivar contacto", detail: "Sin actividad reciente." };
    }
  }
  return { kind: "none", label: "Sin acciones pendientes" };
}

// ---------- LÍNEA DE TIEMPO (determinística) ----------
export type TimelineKind = "visit" | "purchase" | "service" | "service_done" | "followup" | "followup_done";
export interface TimelineEvent {
  kind: TimelineKind;
  atMs: number;
  title: string;
  detail?: string;
}

/** Une visitas, compras, servicios y seguimientos en una línea de tiempo desc. */
export function buildTimeline(input: {
  visits: any[]; purchases: any[]; services: any[]; followups: any[];
}): TimelineEvent[] {
  const ev: TimelineEvent[] = [];

  for (const v of input.visits || []) {
    const at = ms(v.createdAt) ?? ms(v.scheduledAt);
    if (at != null) ev.push({ kind: "visit", atMs: at, title: "Visita registrada", detail: v.outcome ? outcomeLabel(v.outcome) : "" });
  }
  for (const p of input.purchases || []) {
    const at = ms(p.purchaseDate) ?? ms(p.createdAt);
    if (at != null) ev.push({ kind: "purchase", atMs: at, title: "Compra", detail: Array.isArray(p.products) ? p.products.join(", ") : (p.products || "") });
  }
  for (const s of input.services || []) {
    const created = ms(s.createdAt);
    if (created != null) ev.push({ kind: "service", atMs: created, title: "Servicio postventa creado", detail: s.productName || "" });
    const done = ms(s.completedAt);
    if (done != null) ev.push({ kind: "service_done", atMs: done, title: "Servicio completado", detail: s.productName || "" });
  }
  for (const f of input.followups || []) {
    const done = ms(f.completedAt);
    if (done != null) ev.push({ kind: "followup_done", atMs: done, title: "Seguimiento realizado", detail: f.objective || "" });
    else {
      const sch = ms(f.scheduledAt);
      if (sch != null) ev.push({ kind: "followup", atMs: sch, title: "Seguimiento programado", detail: f.objective || "" });
    }
  }
  return ev.sort((a, b) => b.atMs - a.atMs);
}

function outcomeLabel(o: string): string {
  const map: Record<string, string> = {
    purchased: "Compró",
    pending: "Pendiente",
    not_interested: "No interesado",
    lost: "Perdido",
  };
  return map[o] || o;
}

// ---------- AGREGACIÓN 360 ----------
export interface Customer360 {
  customer: any;
  purchases: any[];
  items: any[];
  services: any[];
  followups: any[];
  visits: any[];
  aiProfiles: any[];
  lifecycle: LifecycleResult;
  nextAction: NextAction;
  timeline: TimelineEvent[];
  totals: {
    purchaseCount: number;
    totalAmount: number;
    servicesPending: number;
    followupsPending: number;
    followupsDone: number;
  };
}

/** Carga en paralelo todo lo del cliente y calcula estado/acción/timeline. */
export async function fetchCustomer360(ctx: Ctx, customerId: string): Promise<Customer360> {
  const [customer, purchases, items, services, followups, visits, aiProfiles] = await Promise.all([
    getCustomer(customerId),
    getPurchasesForCustomer(ctx, customerId),
    getPurchaseItemsForCustomer(ctx, customerId),
    getPostSaleServicesForCustomer(ctx, customerId),
    getFollowupsForCustomer(ctx, customerId),
    getVisitsForCustomer(ctx, customerId),
    getAiProfilesForCustomer(ctx, customerId),
  ]);

  const input = { customer, purchases, services, followups };
  const lifecycle = getCustomerLifecycleStatus(input);
  const nextAction = computeNextAction(input);
  const timeline = buildTimeline({ visits, purchases, services, followups });

  const totalAmount = (purchases as any[] || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  return {
    customer, purchases, items, services, followups, visits, aiProfiles,
    lifecycle, nextAction, timeline,
    totals: {
      purchaseCount: (purchases || []).length,
      totalAmount,
      servicesPending: (services as any[] || []).filter((s) => s.status !== "completed").length,
      followupsPending: (followups as any[] || []).filter((f) => f.status === "pending").length,
      followupsDone: (followups as any[] || []).filter((f) => f.status === "completed").length,
    },
  };
}

// ---------- CONTEXTO PARA ROYAL COPILOT (prep, sin datos de contacto) ----------
// Devuelve un resumen textual seguro del cliente para futuras funciones de IA:
// NO incluye teléfono, correo ni dirección. Solo señales comerciales.
export function getCustomerContext(c360: Customer360): {
  status: string;
  summary: string;
  signals: string[];
} {
  const { customer, totals, lifecycle, nextAction, aiProfiles } = c360;
  const nombre = [customer?.firstName, customer?.lastName].filter(Boolean).join(" ") || "Cliente";
  const signals: string[] = [];
  if (totals.purchaseCount) signals.push(`${totals.purchaseCount} compra(s)`);
  if (totals.servicesPending) signals.push(`${totals.servicesPending} servicio(s) pendiente(s)`);
  if (totals.followupsPending) signals.push(`${totals.followupsPending} seguimiento(s) pendiente(s)`);
  if (customer?.familySize) signals.push(`familia de ${customer.familySize}`);

  const perfil = aiProfiles?.[0]?.profile;
  const perfilTxt = perfil && typeof perfil === "object"
    ? Object.values(perfil).filter((v) => typeof v === "string").slice(0, 2).join(" · ")
    : "";

  const summary = [
    `${nombre}: ${lifecycle.label}.`,
    `Próxima acción: ${nextAction.label}.`,
    perfilTxt ? `Perfil: ${perfilTxt}.` : "",
  ].filter(Boolean).join(" ");

  return { status: lifecycle.status, summary, signals };
}

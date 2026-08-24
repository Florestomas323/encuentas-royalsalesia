"use client";

import { AlertCircle, CalendarClock, Wrench, ChevronRight, Clock } from "lucide-react";

/**
 * AttentionPanel (Fase D): panel "Requiere atención" del dashboard.
 * Prioriza, SIN listeners nuevos (usa los arrays ya suscritos):
 *   1. Seguimientos VENCIDOS (fecha < hoy, status pendiente)  -> rojo
 *   2. Seguimientos de HOY                                     -> ámbar
 *   3. Servicios postventa PENDIENTES                          -> azul
 * Todo el cálculo es determinístico; no hay IA ni datos inventados.
 */

function toDate(ts) {
  if (!ts) return null;
  if (ts instanceof Date) return ts;
  if (typeof ts?.toDate === "function") return ts.toDate();
  if (typeof ts === "number") return new Date(ts);
  if (typeof ts === "string") { const d = new Date(ts); return isNaN(d) ? null : d; }
  if (typeof ts?.seconds === "number") return new Date(ts.seconds * 1000);
  return null;
}

function finDelDia() { return new Date(new Date().setHours(23, 59, 59, 999)); }
function inicioDelDia() { return new Date(new Date().setHours(0, 0, 0, 0)); }

// Construye la lista priorizada de items que requieren atención.
export function buildAttentionItems({ followups = [], servicios = [], clientePorId }) {
  const hoyIni = inicioDelDia();
  const hoyFin = finDelDia();
  const items = [];

  (followups || []).forEach((f) => {
    if (f.status && f.status !== "pending") return;
    const d = toDate(f.scheduledAt);
    if (!d) return;
    const c = clientePorId ? clientePorId(f.customerId) : null;
    const nombre = c ? `${c.firstName} ${c.lastName || ""}`.trim() : "Cliente";
    if (d < hoyIni) {
      const dias = Math.floor((hoyIni - d) / 86400000);
      items.push({
        id: `f-${f.id}`, tipo: "vencido", prioridad: 0,
        nombre, detalle: f.objective || f.type || "Seguimiento",
        meta: dias <= 0 ? "Vencido" : `Vencido hace ${dias} día${dias > 1 ? "s" : ""}`,
        customerId: f.customerId,
      });
    } else if (d <= hoyFin) {
      items.push({
        id: `f-${f.id}`, tipo: "hoy", prioridad: 1,
        nombre, detalle: f.objective || f.type || "Seguimiento",
        meta: "Hoy", customerId: f.customerId,
      });
    }
  });

  (servicios || []).forEach((s) => {
    if (s.status && s.status !== "pending") return;
    const c = clientePorId ? clientePorId(s.customerId) : null;
    const nombre = c ? `${c.firstName} ${c.lastName || ""}`.trim() : (s.customerName || "Cliente");
    items.push({
      id: `s-${s.id}`, tipo: "servicio", prioridad: 2,
      nombre, detalle: s.productName || "Servicio postventa",
      meta: "Servicio pendiente", customerId: s.customerId,
    });
  });

  items.sort((a, b) => a.prioridad - b.prioridad);
  return items;
}

const ESTILO = {
  vencido: { icon: AlertCircle, wrap: "bg-red-50 border-red-200", chip: "bg-red-100 text-red-700", ic: "text-red-600" },
  hoy: { icon: CalendarClock, wrap: "bg-amber-50 border-amber-200", chip: "bg-amber-100 text-amber-800", ic: "text-amber-600" },
  servicio: { icon: Wrench, wrap: "bg-sky-50 border-sky-200", chip: "bg-sky-100 text-sky-700", ic: "text-sky-600" },
};

export default function AttentionPanel({ followups, servicios, clientePorId, onAbrirCliente, onVerSeguimientos, onVerServicios }) {
  const items = buildAttentionItems({ followups, servicios, clientePorId });
  const vencidos = items.filter((i) => i.tipo === "vencido").length;

  if (items.length === 0) {
    return (
      <div className="rounded-2xl bg-brand/[0.04] border border-hairline px-4 py-5 flex items-center gap-3">
        <span className="w-10 h-10 rounded-xl bg-brand/[0.08] grid place-items-center shrink-0">
          <Clock className="w-5 h-5 text-brand" strokeWidth={1.9} />
        </span>
        <div>
          <p className="font-display font-semibold text-[15px] text-brand-deep">Todo al día</p>
          <p className="text-[13px] text-muted">No hay seguimientos vencidos ni servicios pendientes.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display font-bold text-brand-deep text-[17px]">Requiere atención</h2>
        {vencidos > 0 && (
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
            {vencidos} vencido{vencidos > 1 ? "s" : ""}
          </span>
        )}
      </div>
      <div className="space-y-2.5">
        {items.slice(0, 6).map((it) => {
          const st = ESTILO[it.tipo] || ESTILO.hoy;
          const Icon = st.icon;
          const clickable = it.customerId && onAbrirCliente;
          return (
            <button
              key={it.id}
              onClick={() => {
                if (it.tipo === "servicio" && onVerServicios) return onVerServicios();
                if (clickable) return onAbrirCliente(it.customerId);
                if (onVerSeguimientos) onVerSeguimientos();
              }}
              className={`w-full text-left flex items-center gap-3 rounded-2xl border px-4 py-3 active:scale-[0.99] transition ${st.wrap}`}
            >
              <span className="w-10 h-10 rounded-xl bg-white/70 grid place-items-center shrink-0">
                <Icon className={`w-5 h-5 ${st.ic}`} strokeWidth={2} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-display font-semibold text-[15px] text-brand-deep truncate">{it.nombre}</p>
                <p className="text-[13px] text-muted truncate">{it.detalle}</p>
              </div>
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${st.chip}`}>{it.meta}</span>
              <ChevronRight className="w-4 h-4 text-muted/40 shrink-0" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

"use client";

// Fase D — Vista 360° del cliente. Puramente presentacional: recibe el objeto
// agregado por fetchCustomer360 y lo muestra. No llama a IA ni escribe datos.
import {
  Package, Boxes, Wrench, CalendarClock, CheckCircle2, Clock, ShoppingBag,
  Sparkles, ArrowRight, MessageCircle, Trash2, Plus, AlertCircle,
} from "lucide-react";

const TONE_BADGE = {
  neutral: "text-muted bg-surface border-hairline",
  brand: "text-brand-dark bg-brand/[0.06] border-brand/15",
  accent: "text-accent bg-accent-soft border-accent/15",
  warn: "text-amber-700 bg-amber-50 border-amber-200",
  danger: "text-danger bg-red-50 border-red-100",
  success: "text-emerald-700 bg-emerald-50 border-emerald-200",
};

function fmtDia(d) {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("es-CO", { day: "2-digit", month: "short" }); } catch { return "—"; }
}
function fmtFechaHora(ms) {
  if (!ms) return "—";
  try { return new Date(ms).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" }); } catch { return "—"; }
}

const NEXT_ICON = {
  service: Wrench, followup: CalendarClock, loyalty_waiting: Clock,
  reengage: MessageCircle, none: CheckCircle2,
};
const TIMELINE_ICON = {
  visit: Sparkles, purchase: ShoppingBag, service: Wrench, service_done: CheckCircle2,
  followup: CalendarClock, followup_done: CheckCircle2,
};

export default function Customer360({
  data, cliente, catalogoPorId, formatCurrency, currency, locale,
  onNuevaVisita, onNuevoSeguimiento, onWhatsApp, onEliminar, onServicios,
}) {
  if (data && data.error) {
    return <div className="px-5 py-10 text-center text-[14px] text-muted">No pudimos cargar la información del cliente.</div>;
  }
  const cargando = !data;
  const c = data?.customer || cliente || {};
  const lifecycle = data?.lifecycle;
  const next = data?.nextAction;
  const totals = data?.totals;
  const NextIcon = next ? (NEXT_ICON[next.kind] || CheckCircle2) : CheckCircle2;
  const fmt = (n) => (formatCurrency ? formatCurrency(n, currency, locale) : `$${n}`);

  return (
    <div className="px-5 space-y-4 pb-8">
      {/* Encabezado de estado */}
      <div className="rounded-2xl bg-brand-deep px-5 py-4 text-white">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-display font-bold text-lg truncate">{c.firstName} {c.lastName || ""}</p>
            <p className="text-[13px] text-emerald-200/80 truncate">
              {c.phone || "Sin teléfono"}{c.familySize ? ` · ${c.familySize} integrantes` : ""}
            </p>
          </div>
          {lifecycle && (
            <span className={`shrink-0 px-3 py-1 rounded-full text-[12px] font-semibold border ${TONE_BADGE[lifecycle.tone] || TONE_BADGE.neutral} bg-white/10 text-white border-white/20`}>
              {lifecycle.label}
            </span>
          )}
        </div>
        {!cargando && totals && (
          <div className="mt-4 grid grid-cols-3 gap-2">
            <MiniStat label="Compras" valor={totals.purchaseCount} />
            <MiniStat label="Total" valor={totals.totalAmount ? fmt(totals.totalAmount) : "—"} />
            <MiniStat label="Pendientes" valor={totals.followupsPending + totals.servicesPending} />
          </div>
        )}
      </div>

      {cargando ? (
        <div className="space-y-2.5">
          {[0, 1, 2].map((i) => <div key={i} className="h-20 rounded-2xl bg-card border border-hairline animate-pulse" />)}
        </div>
      ) : (
        <>
          {/* Próxima acción */}
          {next && next.kind !== "none" && (
            <div className={`rounded-2xl border p-4 ${next.overdue ? "bg-amber-50 border-amber-200" : "bg-card border-hairline shadow-card"}`}>
              <div className="flex items-center gap-2 mb-1">
                <NextIcon className={`w-4 h-4 ${next.overdue ? "text-amber-600" : "text-brand"}`} strokeWidth={2} />
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Próxima acción</p>
                {next.overdue && <span className="ml-auto text-[11px] font-semibold text-amber-700">Vencido</span>}
              </div>
              <p className="text-[15px] font-semibold text-brand-deep">{next.label}</p>
              {next.detail && <p className="text-[13px] text-muted mt-0.5 line-clamp-2">{next.detail}</p>}
              {next.dueMs && <p className="text-[12px] text-muted mt-1">Para el {fmtFechaHora(next.dueMs)}</p>}
              <div className="mt-3 flex gap-2">
                {next.kind === "service" && (
                  <button onClick={onServicios} className="flex-1 min-h-[44px] rounded-xl bg-brand-dark text-[13px] font-semibold text-white flex items-center justify-center gap-1.5">
                    <Wrench className="w-4 h-4" /> Ver servicios
                  </button>
                )}
                {(next.kind === "followup" || next.kind === "reengage") && c.phone && (
                  <button onClick={() => onWhatsApp?.(c, next)} className="flex-1 min-h-[44px] rounded-xl bg-brand-dark text-[13px] font-semibold text-white flex items-center justify-center gap-1.5">
                    <MessageCircle className="w-4 h-4" /> WhatsApp
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Perfil comercial (último aiProfile, sin regenerar) */}
          {data.aiProfiles?.[0]?.profile && <PerfilComercial profile={data.aiProfiles[0].profile} />}

          {/* Productos comprados */}
          {data.items?.length > 0 && (
            <Section titulo="Productos comprados">
              <div className="space-y-2">
                {data.items.map((it) => {
                  const esSet = it.pieceIdsSnapshot?.length > 0;
                  const piezas = esSet
                    ? it.pieceIdsSnapshot.map((pid) => catalogoPorId?.get?.(pid)?.name).filter(Boolean)
                    : [];
                  return (
                    <div key={it.id} className="rounded-2xl bg-card border border-hairline p-3.5">
                      <div className="flex items-center gap-3">
                        <span className={`w-10 h-10 rounded-xl grid place-items-center shrink-0 ${esSet ? "bg-accent-soft" : "bg-brand/[0.06]"}`}>
                          {esSet ? <Boxes className="w-5 h-5 text-accent" /> : <Package className="w-5 h-5 text-brand" />}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="font-display font-semibold text-[15px] text-brand-deep truncate">{it.productNameSnapshot}</p>
                          {esSet && <p className="text-[12px] text-muted">Set · {it.pieceIdsSnapshot.length} piezas</p>}
                        </div>
                        <span className="shrink-0 px-2 py-0.5 rounded-full text-[12px] font-semibold text-brand-dark bg-brand/[0.06] border border-brand/10">x{it.quantity}</span>
                      </div>
                      {piezas.length > 0 && (
                        <p className="mt-2 text-[12px] text-muted leading-snug">{piezas.join(" · ")}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </Section>
          )}

          {/* Servicios postventa */}
          {data.services?.length > 0 && (
            <Section titulo="Servicios postventa">
              <div className="space-y-2">
                {data.services.map((s) => {
                  const done = s.status === "completed";
                  return (
                    <div key={s.id} className="rounded-2xl bg-card border border-hairline p-3.5 flex items-center gap-3">
                      <span className={`w-9 h-9 rounded-xl grid place-items-center shrink-0 ${done ? "bg-emerald-50" : "bg-amber-50"}`}>
                        {done ? <CheckCircle2 className="w-[18px] h-[18px] text-emerald-600" /> : <Wrench className="w-[18px] h-[18px] text-amber-600" />}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-medium text-brand-deep truncate">{s.productName}</p>
                        <p className="text-[12px] text-muted">{done ? "Completado" : "Pendiente"}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Section>
          )}

          {/* Seguimientos */}
          <Section
            titulo="Seguimientos"
            action={
              <button onClick={() => onNuevoSeguimiento?.(c)} className="text-[13px] font-semibold text-brand-dark flex items-center gap-1">
                <Plus className="w-4 h-4" /> Nuevo
              </button>
            }
          >
            {(!data.followups || data.followups.length === 0) ? (
              <p className="text-[13px] text-muted">Sin seguimientos.</p>
            ) : (
              <div className="space-y-2">
                {[...data.followups]
                  .sort((a, b) => (a.status === "pending" ? -1 : 1) - (b.status === "pending" ? -1 : 1))
                  .map((f) => {
                    const done = f.status === "completed";
                    return (
                      <div key={f.id} className="rounded-2xl bg-card border border-hairline p-3.5 flex items-center gap-3">
                        <span className={`w-9 h-9 rounded-xl grid place-items-center shrink-0 ${done ? "bg-emerald-50" : "bg-brand/[0.06]"}`}>
                          {done ? <CheckCircle2 className="w-[18px] h-[18px] text-emerald-600" /> : <CalendarClock className="w-[18px] h-[18px] text-brand" />}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[14px] font-medium text-brand-deep truncate">{f.objective || f.type}</p>
                          <p className="text-[12px] text-muted">{done ? "Realizado" : `Programado · ${fmtDia(tsMs(f.scheduledAt))}`}</p>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </Section>

          {/* Línea de tiempo */}
          {data.timeline?.length > 0 && (
            <Section titulo="Historial">
              <div className="space-y-3">
                {data.timeline.map((t, i) => {
                  const Icon = TIMELINE_ICON[t.kind] || Sparkles;
                  return (
                    <div key={i} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <span className="w-7 h-7 rounded-full bg-brand/[0.06] grid place-items-center">
                          <Icon className="w-3.5 h-3.5 text-brand" strokeWidth={2} />
                        </span>
                        {i < data.timeline.length - 1 && <div className="w-px flex-1 bg-hairline mt-1" />}
                      </div>
                      <div className="pb-2 min-w-0">
                        <p className="text-[11px] text-muted">{fmtFechaHora(t.atMs)}</p>
                        <p className="text-[14px] text-brand-deep">{t.title}</p>
                        {t.detail && <p className="text-[12px] text-muted truncate">{t.detail}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Section>
          )}

          {/* Acciones */}
          <div className="space-y-2 pt-1">
            <button onClick={() => onNuevaVisita?.(c)} className="w-full min-h-[48px] rounded-2xl bg-brand-dark text-white text-[15px] font-semibold flex items-center justify-center gap-2">
              <Plus className="w-5 h-5" /> Nueva visita
            </button>
            <button onClick={() => onEliminar?.(c)} className="w-full min-h-[48px] rounded-2xl bg-red-50 border border-red-100 text-danger text-[15px] font-semibold flex items-center justify-center gap-2">
              <Trash2 className="w-[18px] h-[18px]" /> Eliminar cliente
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function tsMs(t) {
  if (!t) return null;
  if (typeof t.toDate === "function") return t.toDate().getTime();
  if (t instanceof Date) return t.getTime();
  return null;
}

function MiniStat({ label, valor }) {
  return (
    <div className="rounded-xl bg-white/10 px-2.5 py-2">
      <p className="text-[16px] font-display font-bold leading-tight truncate">{valor}</p>
      <p className="text-[11px] text-emerald-200/70">{label}</p>
    </div>
  );
}

function Section({ titulo, action, children }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] font-semibold text-muted uppercase tracking-wide">{titulo}</p>
        {action}
      </div>
      {children}
    </div>
  );
}

function PerfilComercial({ profile }) {
  // El perfil de IA es un objeto libre; mostramos pares clave/valor legibles.
  const entradas = profile && typeof profile === "object"
    ? Object.entries(profile).filter(([, v]) => typeof v === "string" && v.trim())
    : [];
  if (!entradas.length) return null;
  return (
    <Section titulo="Perfil comercial (IA)">
      <div className="rounded-2xl bg-brand/[0.04] border border-brand/10 p-4 space-y-2">
        {entradas.slice(0, 6).map(([k, v]) => (
          <div key={k}>
            <p className="text-[11px] font-semibold text-brand/70 uppercase tracking-wide">{prettyKey(k)}</p>
            <p className="text-[13px] text-ink/80 leading-snug">{v}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

function prettyKey(k) {
  const map = {
    summary: "Resumen", personality: "Personalidad", needs: "Necesidades",
    motivations: "Motivaciones", objections: "Objeciones", recommendation: "Recomendación",
    approach: "Enfoque", profile: "Perfil",
  };
  return map[k] || k.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
}

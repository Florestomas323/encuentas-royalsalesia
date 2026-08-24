"use client";

import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, Package, Wrench, ClipboardCheck } from "lucide-react";
import { serviceTypeLabel } from "@/lib/catalog/classify";

/**
 * Bottom-sheet de detalle de un servicio postventa.
 * Muestra el checklist interactivo; solo permite confirmar cuando todos los
 * pasos están marcados. La confirmación cierra el servicio y (si es el último
 * de la compra) activa el plan de fidelización.
 */
export default function ServiceSheet({
  open,
  service,
  onClose,
  onComplete,
  onAssignToMe,
  canComplete = true,
  isManager = false,
  loading = false,
}) {
  const [pasos, setPasos] = useState([]);

  // Reinicia el checklist local cada vez que se abre otro servicio.
  useEffect(() => {
    if (open && service) {
      const cl = Array.isArray(service.checklist) ? service.checklist : [];
      setPasos(cl.map((c) => ({ label: c.label, done: !!c.done })));
    }
  }, [open, service]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape" && !loading) onClose?.(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, loading, onClose]);

  if (!open || !service) return null;

  const total = pasos.length;
  const hechos = pasos.filter((p) => p.done).length;
  const todos = total > 0 && hechos === total;

  const toggle = (i) => {
    if (loading) return;
    setPasos((prev) => prev.map((p, idx) => (idx === i ? { ...p, done: !p.done } : p)));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        aria-label="Cerrar"
        onClick={() => !loading && onClose?.()}
        className="absolute inset-0 bg-brand-deep/40 backdrop-blur-[2px] animate-fade"
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-md bg-card rounded-t-3xl shadow-nav px-5 pt-3 pb-8 safe-bottom animate-sheet max-h-[88vh] overflow-y-auto"
      >
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-hairline" />

        {/* Encabezado */}
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-2xl grid place-items-center bg-brand/8 shrink-0">
            <Wrench className="w-5 h-5 text-brand" strokeWidth={2} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-brand">
              {serviceTypeLabel(service.serviceType)}
            </p>
            <h2 className="font-display font-bold text-brand-deep text-lg leading-tight text-balance">
              {service.productName}
            </h2>
            {service.customerName ? (
              <p className="text-sm text-muted mt-0.5 truncate">Cliente: {service.customerName}</p>
            ) : null}
          </div>
        </div>

        {/* Aviso de mantener empacado */}
        {service.keepPackagedUntilService ? (
          <div className="mt-4 flex items-center gap-2.5 rounded-2xl bg-amber-50 px-4 py-3">
            <Package className="w-4 h-4 text-amber-600 shrink-0" strokeWidth={2} />
            <p className="text-[13px] text-amber-800 leading-snug">
              Mantén el producto empacado hasta realizar este servicio con el cliente.
            </p>
          </div>
        ) : null}

        {/* Progreso del checklist */}
        <div className="mt-5 flex items-center justify-between">
          <h3 className="font-display font-semibold text-brand-deep text-sm flex items-center gap-1.5">
            <ClipboardCheck className="w-4 h-4 text-muted" strokeWidth={2} /> Checklist del servicio
          </h3>
          <span className="text-[12px] font-semibold text-muted">{hechos}/{total}</span>
        </div>

        {/* Pasos */}
        <ul className="mt-3 flex flex-col gap-2">
          {pasos.map((p, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => toggle(i)}
                disabled={!canComplete || loading}
                aria-pressed={p.done}
                className={`w-full min-h-[52px] flex items-center gap-3 rounded-2xl px-4 py-3 text-left transition active:scale-[0.99] disabled:opacity-70 ${
                  p.done ? "bg-brand/8" : "bg-surface"
                }`}
              >
                <span
                  className={`w-6 h-6 rounded-lg grid place-items-center shrink-0 border transition ${
                    p.done ? "bg-brand border-brand" : "border-hairline bg-card"
                  }`}
                >
                  {p.done ? <CheckCircle2 className="w-4 h-4 text-white" strokeWidth={2.5} /> : null}
                </span>
                <span className={`text-[14px] leading-snug ${p.done ? "text-brand-deep" : "text-ink"}`}>
                  {p.label}
                </span>
              </button>
            </li>
          ))}
        </ul>

        {/* Acciones */}
        <div className="mt-6 flex flex-col gap-2.5">
          {canComplete ? (
            <button
              onClick={() => onComplete?.(pasos)}
              disabled={loading || !todos}
              className="w-full min-h-[52px] rounded-2xl font-display font-semibold text-[15px] flex items-center justify-center gap-2 shadow-card active:scale-[0.98] transition bg-brand-dark text-white active:bg-brand-deep disabled:opacity-60"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {todos ? "Confirmar servicio realizado" : `Marca los ${total} pasos`}
            </button>
          ) : (
            <div className="text-center text-[13px] text-muted px-4 py-3 rounded-2xl bg-surface">
              Este servicio está asignado a otro vendedor.
            </div>
          )}

          {isManager && !canComplete ? (
            <button
              onClick={() => onAssignToMe?.()}
              disabled={loading}
              className="w-full min-h-[48px] rounded-2xl font-display font-semibold text-[14px] text-brand active:bg-surface transition disabled:opacity-60"
            >
              Asignármelo a mí
            </button>
          ) : null}

          <button
            onClick={() => !loading && onClose?.()}
            disabled={loading}
            className="w-full min-h-[48px] rounded-2xl font-display font-semibold text-[14px] text-muted active:bg-surface transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

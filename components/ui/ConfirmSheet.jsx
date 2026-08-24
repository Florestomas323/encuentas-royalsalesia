"use client";

import { useEffect } from "react";
import { Loader2, AlertTriangle } from "lucide-react";

/**
 * Bottom-sheet de confirmación para móvil.
 * Se usa para acciones destructivas (p. ej. eliminar cliente).
 */
export default function ConfirmSheet({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  tone = "danger", // "danger" | "brand"
  loading = false,
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape" && !loading) onClose?.(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, loading, onClose]);

  if (!open) return null;

  const confirmClasses =
    tone === "danger"
      ? "bg-danger text-white active:brightness-95"
      : "bg-brand-dark text-white active:bg-brand-deep";

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
        className="relative w-full max-w-md bg-card rounded-t-3xl shadow-nav px-5 pt-3 pb-8 safe-bottom animate-sheet"
      >
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-hairline" />
        <div className="flex flex-col items-center text-center">
          <div className={`w-14 h-14 rounded-2xl grid place-items-center mb-4 ${tone === "danger" ? "bg-red-50" : "bg-brand/8"}`}>
            <AlertTriangle className={`w-6 h-6 ${tone === "danger" ? "text-danger" : "text-brand"}`} strokeWidth={2} />
          </div>
          <h2 className="font-display font-bold text-brand-deep text-lg text-balance">{title}</h2>
          {description && <p className="text-sm text-muted mt-1.5 leading-relaxed max-w-[18rem]">{description}</p>}
        </div>
        <div className="mt-6 flex flex-col gap-2.5">
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`w-full min-h-[52px] rounded-2xl font-display font-semibold text-[15px] flex items-center justify-center gap-2 shadow-card active:scale-[0.98] transition disabled:opacity-60 ${confirmClasses}`}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null} {confirmLabel}
          </button>
          <button
            onClick={() => !loading && onClose?.()}
            disabled={loading}
            className="w-full min-h-[52px] rounded-2xl font-display font-semibold text-[15px] text-muted active:bg-surface transition"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

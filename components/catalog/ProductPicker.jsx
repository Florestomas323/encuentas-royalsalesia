"use client";

import { useMemo, useState } from "react";
import { Search, Package, Boxes, Check, Plus, Minus } from "lucide-react";

/**
 * Selector de productos del catálogo con cantidad.
 * - products: array de { id, name, type, line, category, brand, pieceIds }
 * - value: array de items seleccionados { productId, productNameSnapshot, quantity, unitPrice, pieceIdsSnapshot }
 * - onChange(items)
 * - allowFreeText: si el catálogo está vacío, permite seguir con texto libre
 * - freeText / onFreeTextChange: valor del texto libre de respaldo
 */
export default function ProductPicker({
  products = [],
  value = [],
  onChange,
  allowFreeText = true,
  freeText = "",
  onFreeTextChange,
}) {
  const [q, setQ] = useState("");

  const filtrados = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return products;
    return products.filter((p) =>
      `${p.name} ${p.line || ""} ${p.category || ""} ${p.brand || ""}`.toLowerCase().includes(t)
    );
  }, [q, products]);

  const cantidadDe = (id) => value.find((v) => v.productId === id)?.quantity || 0;

  function setCantidad(prod, cantidad) {
    const next = value.filter((v) => v.productId !== prod.id);
    if (cantidad > 0) {
      next.push({
        productId: prod.id,
        productNameSnapshot: prod.name,
        quantity: cantidad,
        unitPrice: undefined, // el catálogo real no trae precio; queda manual/opcional
        pieceIdsSnapshot: prod.type === "set" ? prod.pieceIds || [] : [],
      });
    }
    onChange?.(next);
  }

  // Catálogo vacío -> respaldo de texto libre.
  if (!products.length) {
    if (!allowFreeText) {
      return (
        <div className="bg-surface border border-hairline rounded-2xl px-4 py-5 text-center">
          <p className="text-sm text-muted">Aún no hay productos en el catálogo.</p>
        </div>
      );
    }
    return (
      <div>
        <label className="text-[13px] font-medium text-muted mb-1.5 block">Producto / set</label>
        <input
          value={freeText}
          onChange={(e) => onFreeTextChange?.(e.target.value)}
          placeholder="Ej. Elite Cooking System"
          className="w-full bg-card border border-hairline rounded-2xl px-4 h-[52px] text-base text-ink placeholder:text-muted/45 shadow-soft focus:border-brand focus:ring-4 focus:ring-brand/10 focus:outline-none transition"
        />
        <p className="text-xs text-muted mt-1.5">El catálogo está vacío; se registrará como texto.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2.5 bg-card border border-hairline rounded-2xl px-4 h-12 shadow-soft focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/10 transition">
        <Search className="w-[18px] h-[18px] text-muted/60 shrink-0" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar producto"
          className="flex-1 bg-transparent outline-none text-[15px] text-ink placeholder:text-muted/45"
        />
      </div>

      <div className="space-y-2 max-h-[46vh] overflow-y-auto no-scrollbar -mx-1 px-1">
        {filtrados.length === 0 ? (
          <p className="text-sm text-muted text-center py-6">Sin resultados.</p>
        ) : (
          filtrados.map((p) => {
            const cant = cantidadDe(p.id);
            const activo = cant > 0;
            const esSet = p.type === "set";
            return (
              <div
                key={p.id}
                className={`flex items-center gap-3 rounded-2xl border p-3 transition ${
                  activo ? "border-brand/40 bg-brand/[0.05]" : "border-hairline bg-card"
                }`}
              >
                <span className={`w-10 h-10 rounded-xl grid place-items-center shrink-0 ${esSet ? "bg-accent-soft" : "bg-brand/8"}`}>
                  {esSet ? <Boxes className="w-5 h-5 text-accent" /> : <Package className="w-5 h-5 text-brand" />}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-display font-semibold text-[15px] text-brand-deep truncate">{p.name}</p>
                    {esSet && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-accent-soft text-accent border border-accent/15 shrink-0">
                        Set · {p.pieceIds?.length || 0} pzs
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] text-muted truncate">
                    {[p.line, p.category].filter(Boolean).join(" · ")}
                  </p>
                </div>

                {cant === 0 ? (
                  <button
                    onClick={() => setCantidad(p, 1)}
                    aria-label={`Agregar ${p.name}`}
                    className="w-11 h-11 rounded-xl bg-brand-dark text-white grid place-items-center active:scale-95 transition shrink-0"
                  >
                    <Plus className="w-5 h-5" strokeWidth={2.4} />
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => setCantidad(p, cant - 1)}
                      aria-label="Restar"
                      className="w-9 h-9 rounded-lg bg-brand/10 text-brand-dark grid place-items-center active:scale-95 transition"
                    >
                      <Minus className="w-4 h-4" strokeWidth={2.4} />
                    </button>
                    <span className="w-6 text-center font-display font-bold text-brand-deep tabular-nums">{cant}</span>
                    <button
                      onClick={() => setCantidad(p, cant + 1)}
                      aria-label="Sumar"
                      className="w-9 h-9 rounded-lg bg-brand-dark text-white grid place-items-center active:scale-95 transition"
                    >
                      <Plus className="w-4 h-4" strokeWidth={2.4} />
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {value.length > 0 && (
        <div className="flex items-center gap-2 text-[13px] text-brand-dark font-medium">
          <Check className="w-4 h-4" /> {value.reduce((s, v) => s + v.quantity, 0)} artículo(s) seleccionado(s)
        </div>
      )}
    </div>
  );
}

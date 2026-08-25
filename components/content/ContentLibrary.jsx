"use client";

import { buscarProductos } from "@/lib/catalog/search";
import { useMemo, useState } from "react";
import {
  Loader2, Sparkles, Check, X, Trash2, ChevronRight, ArrowLeft, BookOpen, Search, Pencil,
} from "lucide-react";

// Etiquetas legibles de los tipos de contenido oficial.
const TIPO_LABEL = {
  recipe: "Receta",
  usage_tip: "Consejo de uso",
  care: "Cuidado",
  maintenance: "Mantenimiento",
  reminder: "Recordatorio",
  installation_tip: "Instalación",
  faq: "Pregunta frecuente",
  welcome: "Bienvenida",
  satisfaction: "Satisfacción",
  referrals: "Referidos",
  complementary: "Complementario",
};
const tipoLabel = (t) => TIPO_LABEL[t] || "Contenido";

const ESTADO = {
  draft: { label: "Borrador", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  approved: { label: "Aprobado", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  rejected: { label: "Rechazado", cls: "bg-rose-50 text-rose-600 border-rose-200" },
};

/**
 * Biblioteca de contenido oficial (solo distribuidor/reviewer).
 * Vista 1: lista de productos con conteo de contenido.
 * Vista 2: contenido de un producto -> generar con IA, editar, aprobar/rechazar.
 * La IA solo consumirá el contenido en estado "approved".
 */
export default function ContentLibrary({
  productos = [],
  contenido = [],       // todo el productContent de la organización
  onGenerar,            // async (producto, tiposSolicitados) => items[]
  onGuardarBorrador,    // async (producto, item) => void
  onAprobar,            // async (id) => void
  onRechazar,           // async (id) => void
  onEditar,             // async (id, {title, content}) => void
  onEliminar,           // async (id) => void
  onToast,
}) {
  const [productoSel, setProductoSel] = useState(null);
  const [busqueda, setBusqueda] = useState("");
  const [generando, setGenerando] = useState(false);
  const [procesando, setProcesando] = useState(null); // id en proceso
  const [editando, setEditando] = useState(null);      // {id, title, content}

  const porProducto = useMemo(() => {
    const m = new Map();
    for (const c of contenido) {
      const arr = m.get(c.productId) || [];
      arr.push(c);
      m.set(c.productId, arr);
    }
    return m;
  }, [contenido]);

  const productosFiltrados = useMemo(() => {
    const q = busqueda.trim();
    const list = q ? buscarProductos(productos, q, productos.length) : productos;
    return [...list].sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [productos, busqueda]);

  // -------- Vista de detalle de un producto --------
  if (productoSel) {
    const items = (porProducto.get(productoSel.id) || []).slice().sort((a, b) => {
      const orden = { draft: 0, approved: 1, rejected: 2 };
      return (orden[a.status] ?? 3) - (orden[b.status] ?? 3);
    });

    async function generar() {
      setGenerando(true);
      try {
        await onGenerar(productoSel);
      } catch (e) {
        onToast?.(e?.message || "No se pudo generar contenido.");
      } finally {
        setGenerando(false);
      }
    }

    async function accion(fn, id) {
      setProcesando(id);
      try { await fn(id); } catch (e) { onToast?.(e?.message || "Error."); } finally { setProcesando(null); }
    }

    return (
      <div className="px-5 pb-28">
        <button onClick={() => setProductoSel(null)} className="flex items-center gap-1.5 text-[13px] text-muted mb-3 min-h-[44px]">
          <ArrowLeft className="w-4 h-4" /> Todos los productos
        </button>
        <h2 className="font-display font-bold text-brand-deep text-lg leading-tight text-balance">{productoSel.name}</h2>
        <p className="text-[13px] text-muted mb-4">Solo el contenido aprobado alimenta a la IA.</p>

        <button
          onClick={generar}
          disabled={generando}
          className="w-full min-h-[48px] rounded-xl bg-brand-dark text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60 mb-4"
        >
          {generando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {generando ? "Generando borradores..." : "Generar borradores con IA"}
        </button>

        {items.length === 0 ? (
          <div className="text-center py-10 px-6">
            <BookOpen className="w-9 h-9 text-muted/40 mx-auto mb-3" strokeWidth={1.6} />
            <p className="text-[13px] text-muted">Aún no hay contenido. Genera borradores con IA y apruébalos para que la IA los use.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((c) => {
              const est = ESTADO[c.status] || ESTADO.draft;
              const enEdicion = editando?.id === c.id;
              return (
                <div key={c.id} className="rounded-2xl bg-card border border-hairline p-4 shadow-card">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[11px] font-semibold text-brand bg-brand/[0.06] rounded-full px-2 py-0.5">{tipoLabel(c.type)}</span>
                    <span className={`text-[11px] font-medium rounded-full px-2 py-0.5 border ${est.cls}`}>{est.label}</span>
                  </div>
                  {enEdicion ? (
                    <div className="space-y-2 mt-2">
                      <input
                        value={editando.title}
                        onChange={(e) => setEditando((s) => ({ ...s, title: e.target.value }))}
                        className="w-full rounded-lg border border-hairline px-3 py-2 text-sm text-brand-deep"
                        placeholder="Título"
                      />
                      <textarea
                        value={editando.content}
                        onChange={(e) => setEditando((s) => ({ ...s, content: e.target.value }))}
                        rows={5}
                        className="w-full rounded-lg border border-hairline px-3 py-2 text-sm text-brand-deep leading-relaxed"
                        placeholder="Contenido"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={async () => {
                            setProcesando(c.id);
                            try { await onEditar(c.id, { title: editando.title.trim(), content: editando.content.trim() }); setEditando(null); }
                            catch (e) { onToast?.(e?.message || "Error."); } finally { setProcesando(null); }
                          }}
                          className="flex-1 min-h-[40px] rounded-lg bg-brand-dark text-white text-[13px] font-semibold"
                        >Guardar</button>
                        <button onClick={() => setEditando(null)} className="flex-1 min-h-[40px] rounded-lg border border-hairline text-[13px] text-muted">Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="font-display font-semibold text-[15px] text-brand-deep">{c.title}</p>
                      <p className="text-[13px] text-muted leading-relaxed mt-1 whitespace-pre-line">{c.content}</p>
                      <div className="flex items-center gap-2 mt-3 flex-wrap">
                        {c.status !== "approved" && (
                          <button
                            onClick={() => accion(onAprobar, c.id)}
                            disabled={procesando === c.id}
                            className="min-h-[36px] px-3 rounded-lg bg-emerald-600 text-white text-[12px] font-semibold flex items-center gap-1 disabled:opacity-60"
                          >
                            {procesando === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Aprobar
                          </button>
                        )}
                        {c.status !== "rejected" && (
                          <button
                            onClick={() => accion(onRechazar, c.id)}
                            disabled={procesando === c.id}
                            className="min-h-[36px] px-3 rounded-lg border border-hairline text-muted text-[12px] font-medium flex items-center gap-1"
                          >
                            <X className="w-3.5 h-3.5" /> Rechazar
                          </button>
                        )}
                        <button
                          onClick={() => setEditando({ id: c.id, title: c.title || "", content: c.content || "" })}
                          className="min-h-[36px] px-3 rounded-lg border border-hairline text-muted text-[12px] font-medium flex items-center gap-1"
                        >
                          <Pencil className="w-3.5 h-3.5" /> Editar
                        </button>
                        <button
                          onClick={() => accion(onEliminar, c.id)}
                          disabled={procesando === c.id}
                          className="min-h-[36px] px-2.5 rounded-lg border border-hairline text-rose-500 text-[12px] font-medium flex items-center gap-1 ml-auto"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // -------- Vista de lista de productos --------
  return (
    <div className="px-5 pb-28">
      <div className="relative mb-4">
        <Search className="w-4 h-4 text-muted/50 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar producto..."
          className="w-full rounded-xl border border-hairline bg-card pl-9 pr-3 py-2.5 text-sm text-brand-deep"
        />
      </div>
      {productosFiltrados.length === 0 && (
        <div className="text-center py-12 px-6">
          <BookOpen className="w-9 h-9 text-muted/40 mx-auto mb-3" strokeWidth={1.6} />
          {productos.length === 0 ? (
            <p className="text-[13px] text-muted leading-relaxed">
              Aún no hay productos en el catálogo. Cuando el distribuidor agregue productos, aparecerán aquí para gestionar su contenido oficial.
            </p>
          ) : (
            <p className="text-[13px] text-muted leading-relaxed">
              Sin resultados para <span className="font-semibold text-brand-deep">&ldquo;{busqueda.trim()}&rdquo;</span>. Revisa el nombre o borra la búsqueda para ver todos los productos.
            </p>
          )}
        </div>
      )}
      <div className="space-y-2.5">
        {productosFiltrados.map((p) => {
          const arr = porProducto.get(p.id) || [];
          const aprobados = arr.filter((c) => c.status === "approved").length;
          const borradores = arr.filter((c) => c.status === "draft").length;
          return (
            <button
              key={p.id}
              onClick={() => setProductoSel(p)}
              className="w-full flex items-center gap-3 rounded-2xl bg-card border border-hairline p-4 text-left shadow-card active:bg-surface transition"
            >
              <span className="w-10 h-10 rounded-xl bg-brand/[0.06] grid place-items-center shrink-0">
                <BookOpen className="w-5 h-5 text-brand" strokeWidth={1.9} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-display font-semibold text-[15px] text-brand-deep truncate">{p.name}</p>
                <p className="text-[12px] text-muted">
                  {aprobados > 0 ? `${aprobados} aprobado${aprobados > 1 ? "s" : ""}` : "Sin contenido aprobado"}
                  {borradores > 0 ? ` · ${borradores} borrador${borradores > 1 ? "es" : ""}` : ""}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted/50 shrink-0" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

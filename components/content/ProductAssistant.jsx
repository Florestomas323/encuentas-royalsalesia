"use client";

import { useMemo, useRef, useState } from "react";
import { Loader2, Send, Bot, ArrowLeft, Search, Package, AlertCircle } from "lucide-react";

/**
 * Asistente de producto (todos los roles). El vendedor elige un producto y
 * pregunta; la IA responde SOLO con el contenido oficial APROBADO de ese
 * producto. Si no hay datos, responde que no hay información oficial.
 */
export default function ProductAssistant({
  productos = [],
  onPreguntar,   // async (producto) => ({ answer, hasAnswer }) ; recibe la pregunta vía input
  onToast,
}) {
  const [productoSel, setProductoSel] = useState(null);
  const [busqueda, setBusqueda] = useState("");
  const [pregunta, setPregunta] = useState("");
  const [cargando, setCargando] = useState(false);
  const [mensajes, setMensajes] = useState([]); // {rol: 'user'|'ai', texto, sinDatos?}
  const finRef = useRef(null);

  const productosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const list = q ? productos.filter((p) => p.name.toLowerCase().includes(q)) : productos;
    return [...list].sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [productos, busqueda]);

  async function enviar() {
    const q = pregunta.trim();
    if (!q || cargando || !productoSel) return;
    setPregunta("");
    setMensajes((m) => [...m, { rol: "user", texto: q }]);
    setCargando(true);
    try {
      const res = await onPreguntar(productoSel, q);
      setMensajes((m) => [...m, { rol: "ai", texto: res?.answer || "No hay información oficial disponible.", sinDatos: !res?.hasAnswer }]);
    } catch (e) {
      onToast?.(e?.message || "No se pudo responder.");
      setMensajes((m) => [...m, { rol: "ai", texto: "Ocurrió un error al consultar. Intenta de nuevo.", sinDatos: true }]);
    } finally {
      setCargando(false);
      requestAnimationFrame(() => finRef.current?.scrollIntoView({ behavior: "smooth" }));
    }
  }

  function onKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      if (e.nativeEvent?.isComposing || e.keyCode === 229) return;
      e.preventDefault();
      enviar();
    }
  }

  // -------- Selección de producto --------
  if (!productoSel) {
    return (
      <div className="px-5 pb-28">
        <div className="rounded-2xl bg-brand/[0.04] border border-hairline p-4 mb-4 flex items-start gap-2.5">
          <Bot className="w-5 h-5 text-brand shrink-0 mt-0.5" strokeWidth={1.9} />
          <p className="text-[13px] text-muted leading-snug">Elige un producto para preguntar. Las respuestas se basan solo en el contenido oficial aprobado.</p>
        </div>
        <div className="relative mb-4">
          <Search className="w-4 h-4 text-muted/50 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar producto..."
            className="w-full rounded-xl border border-hairline bg-card pl-9 pr-3 py-2.5 text-sm text-brand-deep"
          />
        </div>
        <div className="space-y-2.5">
          {productosFiltrados.map((p) => (
            <button
              key={p.id}
              onClick={() => { setProductoSel(p); setMensajes([]); }}
              className="w-full flex items-center gap-3 rounded-2xl bg-card border border-hairline p-4 text-left shadow-card active:bg-surface transition"
            >
              <span className="w-10 h-10 rounded-xl bg-brand/[0.06] grid place-items-center shrink-0">
                <Package className="w-5 h-5 text-brand" strokeWidth={1.9} />
              </span>
              <p className="font-display font-semibold text-[15px] text-brand-deep truncate flex-1">{p.name}</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // -------- Chat --------
  return (
    <div className="flex flex-col flex-1 min-h-0">
      <button onClick={() => setProductoSel(null)} className="flex items-center gap-1.5 text-[13px] text-muted px-5 py-2 min-h-[44px]">
        <ArrowLeft className="w-4 h-4" /> Otro producto
      </button>
      <div className="px-5">
        <div className="rounded-xl bg-brand/[0.04] border border-hairline px-3 py-2 mb-3">
          <p className="text-[12px] text-muted">Consultando</p>
          <p className="text-[14px] font-semibold text-brand-deep truncate">{productoSel.name}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 space-y-3 pb-4">
        {mensajes.length === 0 && (
          <p className="text-center text-[13px] text-muted/70 py-8">Haz una pregunta, por ejemplo: &ldquo;¿Cómo se cura esta olla?&rdquo;</p>
        )}
        {mensajes.map((m, i) => (
          <div key={i} className={`flex ${m.rol === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[14px] leading-relaxed whitespace-pre-line ${
                m.rol === "user"
                  ? "bg-brand-dark text-white rounded-br-sm"
                  : m.sinDatos
                    ? "bg-amber-50 border border-amber-200 text-amber-800 rounded-bl-sm"
                    : "bg-card border border-hairline text-brand-deep rounded-bl-sm"
              }`}
            >
              {m.rol === "ai" && m.sinDatos && <AlertCircle className="w-4 h-4 inline mr-1.5 -mt-0.5" />}
              {m.texto}
            </div>
          </div>
        ))}
        {cargando && (
          <div className="flex justify-start">
            <div className="bg-card border border-hairline rounded-2xl rounded-bl-sm px-3.5 py-2.5">
              <Loader2 className="w-4 h-4 animate-spin text-muted" />
            </div>
          </div>
        )}
        <div ref={finRef} />
      </div>

      <div className="px-4 py-3 border-t border-hairline bg-card safe-bottom">
        <div className="flex items-end gap-2">
          <textarea
            value={pregunta}
            onChange={(e) => setPregunta(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder="Escribe tu pregunta..."
            className="flex-1 resize-none rounded-xl border border-hairline px-3 py-2.5 text-sm text-brand-deep max-h-28"
          />
          <button
            onClick={enviar}
            disabled={cargando || !pregunta.trim()}
            aria-label="Enviar pregunta"
            className="w-11 h-11 rounded-xl bg-brand-dark text-white grid place-items-center disabled:opacity-50 shrink-0"
          >
            {cargando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

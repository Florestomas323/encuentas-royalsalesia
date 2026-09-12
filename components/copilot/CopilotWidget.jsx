"use client"

import { useEffect, useRef, useState } from "react"
import { buscarProductos } from "@/lib/catalog/search"
import {
  Sparkles, X, Send, MessageSquarePlus, ShieldCheck, User, Package,
  ArrowRight, Copy, Check, Loader2, Lightbulb, Wrench, HeartHandshake, Target,
  Search, ChevronLeft,
} from "lucide-react"

// Royal Copilot — copiloto interno de ventas.
// Widget autocontenido: FAB flotante + hoja modal. Habla con /api/ai/copilot
// enviando SOLO ids (el servidor rehidrata el contexto con aislamiento por
// organización). Nunca envía datos de contacto ni recibe promesas de garantía.
//
// Flujos GUIADOS (se resuelven en el widget/servidor SIN adivinar con IA):
//  - Objeción: primero se pregunta CUÁL objeción (no se asume "precio").
//  - Producto: primero se elige el producto, luego el subtema.
//  - Garantía: primero se elige el producto (un producto = una garantía).

// Acciones guiadas por intención. `needs` indica qué contexto requieren.
const ACCIONES = [
  { id: "objection", label: "Rebatir una objeción", icon: Lightbulb, needs: "none" },
  { id: "product", label: "Explicar un producto", icon: Package, needs: "none" },
  { id: "warranty", label: "Consultar garantía", icon: ShieldCheck, needs: "none" },
  { id: "postsale", label: "Guía de postventa", icon: Wrench, needs: "customer",
    seed: "¿Cuál es el siguiente paso de postventa con este cliente?" },
  { id: "loyalty", label: "Plan de fidelización", icon: HeartHandshake, needs: "customer",
    seed: "Dame ideas de fidelización para este cliente." },
  { id: "nextstep", label: "¿Qué hago ahora?", icon: Target, needs: "customer",
    seed: "¿Cuál es la mejor próxima acción con este cliente?" },
  { id: "message", label: "Redactar un mensaje", icon: MessageSquarePlus, needs: "customer",
    seed: "Redacta un mensaje breve y cálido para reactivar a este cliente." },
]

// Objeciones frecuentes. NUNCA hay una seleccionada por defecto.
const OBJECIONES = [
  "Está muy caro",
  "Lo voy a pensar",
  "Tengo que hablar con mi pareja",
  "No lo necesito",
  "Quiero comparar",
  "No es prioridad",
  "Financiamiento",
  "No confío todavía",
]

// Subtemas al explicar un producto.
const TEMAS = [
  { key: "beneficios", label: "Beneficios", q: (p) => `¿Cuáles son los beneficios clave de ${p}?` },
  { key: "caracteristicas", label: "Características", q: (p) => `¿Cuáles son las características y especificaciones de ${p}?` },
  { key: "incluye", label: "Qué incluye", q: (p) => `¿Qué incluye ${p}?` },
  { key: "uso", label: "Uso", q: (p) => `¿Cómo se usa ${p}?` },
  { key: "cuidados", label: "Cuidados", q: (p) => `¿Qué cuidados necesita ${p}?` },
  { key: "postventa", label: "Servicio postventa", q: (p) => `¿Cuál es el servicio postventa de ${p}?` },
  { key: "garantia", label: "Garantía", warranty: true },
  { key: "recetas", label: "Recetas compatibles", q: (p) => `¿Qué recetas son compatibles con ${p}?` },
  { key: "otra", label: "Otra pregunta", prefill: true },
]

function normal(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
}

export default function CopilotWidget({ getToken, customer, productos = [], customerProducts = [], onNavigate, onToast }) {
  const [abierto, setAbierto] = useState(false)
  const [mensajes, setMensajes] = useState([]) // { role, text, actions?, sources?, disclaimer?, choices?, askProduct?, next? }
  const [input, setInput] = useState("")
  const [cargando, setCargando] = useState(false)
  const [usarContexto, setUsarContexto] = useState(true)
  const [conversationId, setConversationId] = useState(null)
  const [copiado, setCopiado] = useState(null)
  // Flujo guiado activo: { type: "objection" | "objection-otra" | "pick" | "topic", next?, product?, busqueda? }
  const [flujo, setFlujo] = useState(null)
  const [busqueda, setBusqueda] = useState("")
  // Producto del que se está hablando al usar "Otra pregunta": se envía con la
  // siguiente pregunta libre para que el servidor cargue su ficha oficial.
  const [productoActivo, setProductoActivo] = useState(null)
  const [objetraTexto, setObjetraTexto] = useState("")
  const finRef = useRef(null)
  const inputRef = useRef(null)

  // Al tocar una acción rápida abrimos el flujo guiado correspondiente.
  function elegirAccion(a) {
    if (a.id === "objection") { setFlujo({ type: "objection" }); return }
    if (a.id === "product") { setFlujo({ type: "pick", next: "product" }); setBusqueda(""); return }
    if (a.id === "warranty") { setFlujo({ type: "pick", next: "warranty" }); setBusqueda(""); return }
    if (a.seed) enviar(a.seed)
  }

  // Si cambia el cliente activo, reactivamos el contexto por defecto.
  useEffect(() => { setUsarContexto(true) }, [customer?.id])

  useEffect(() => {
    if (abierto) finRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [mensajes, abierto, flujo])

  const contextoCliente = usarContexto ? customer : null

  async function enviar(texto, extra = {}) {
    const pregunta = (texto ?? input).trim()
    if (!pregunta || cargando) return
    // Pregunta libre tras elegir un producto: se arrastra su id.
    if (!extra.productId && productoActivo) {
      extra = { ...extra, productId: productoActivo.id, productName: productoActivo.name }
    }
    setInput("")
    setFlujo(null)
    setObjetraTexto("")
    // Historial reciente (para continuidad) a partir de lo ya mostrado.
    const historial = mensajes.slice(-6).map((m) => ({ role: m.role, content: m.text }))
    setMensajes((m) => [...m, { role: "user", text: pregunta }])
    setCargando(true)
    try {
      const token = await getToken?.()
      if (!token) throw new Error("sin-sesion")
      const res = await fetch("/api/ai/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          message: pregunta,
          customerId: contextoCliente?.id || null,
          conversationId,
          history: historial,
          productId: extra.productId || null,
          productName: extra.productName || null,
          objection: extra.objection || null,
          topic: extra.topic || null,
          flow: extra.flow || null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.ok) throw new Error(data?.error || `http-${res.status}`)
      const r = data.result || {}
      if (data.conversationId) setConversationId(data.conversationId)
      // "next": si el servidor pide elegir producto, recordamos si venía de
      // garantía o de producto para continuar el flujo correcto.
      const next = data.intent === "warranty" ? "warranty" : "product"
      setMensajes((m) => [...m, {
        role: "assistant",
        text: r.answer || "No pude generar una respuesta.",
        actions: Array.isArray(r.actions) ? r.actions : [],
        sources: Array.isArray(r.sources) ? r.sources : [],
        disclaimer: r.disclaimer || null,
        choices: Array.isArray(r.choices) ? r.choices : [],
        askProduct: r.askProduct === true,
        next,
      }])
    } catch (e) {
      setMensajes((m) => [...m, {
        role: "assistant",
        text: e?.message && !String(e.message).startsWith("http-") && e.message !== "sin-sesion"
          ? e.message
          : "No pude responder en este momento. Revisa tu conexión e inténtalo de nuevo.",
        actions: [], sources: [],
      }])
    } finally {
      setCargando(false)
    }
  }

  // Objeción elegida (o escrita en "Otra").
  function elegirObjecion(texto) {
    enviar(`El cliente me dijo: "${texto}". ¿Cómo lo manejo?`, { objection: texto, flow: "objection" })
  }

  // Producto elegido en el selector. Según el flujo: garantía directa o subtemas.
  function elegirProducto(prod, next) {
    if (next === "warranty") {
      enviar(`¿Qué garantía tiene ${prod.name}?`, { productId: prod.id, productName: prod.name, flow: "warranty" })
    } else {
      setFlujo({ type: "topic", product: prod })
    }
  }

  // Subtema del producto elegido.
  function elegirTema(t, prod) {
    if (t.warranty) {
      enviar(`¿Qué garantía tiene ${prod.name}?`, { productId: prod.id, productName: prod.name, flow: "warranty" })
    } else if (t.prefill) {
      setFlujo(null)
      setProductoActivo({ id: prod.id, name: prod.name })
      const base = `Sobre ${prod.name}: `
      setInput(base)
      setTimeout(() => {
        const el = inputRef.current
        if (el) { el.focus(); el.setSelectionRange(base.length, base.length) }
      }, 0)
    } else {
      enviar(t.q(prod.name), { productId: prod.id, productName: prod.name, topic: t.key, flow: "product" })
    }
  }

  function nuevaConversacion() {
    setMensajes([]); setConversationId(null); setInput(""); setFlujo(null); setProductoActivo(null)
  }

  async function copiar(texto, key) {
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(key); onToast?.("Mensaje copiado.")
      setTimeout(() => setCopiado(null), 1600)
    } catch { onToast?.("No se pudo copiar.") }
  }

  function ejecutarAccion(a) {
    if (!a) return
    if (a.screen) {
      setAbierto(false)
      onNavigate?.(a.screen, contextoCliente?.id ? { customerId: contextoCliente.id } : undefined)
    } else if (a.note) {
      copiar(a.note, `act-${(a.label || a.note).slice(0, 8)}`)
    }
  }

  const accionesVisibles = ACCIONES.filter((a) => a.needs === "none" || contextoCliente)

  // Resultados del selector de producto (búsqueda flexible sobre el catálogo).
  // Búsqueda compartida (sinónimos, plurales, prefijos) — en vivo al escribir.
  const catalogoFiltrado = buscarProductos(productos, busqueda, 30)

  // Productos del cliente activo (dedupe por id/nombre).
  const prodsCliente = []
  const vistos = new Set()
  for (const cp of customerProducts) {
    const k = cp.id || cp.name
    if (!k || vistos.has(k)) continue
    vistos.add(k); prodsCliente.push(cp)
  }

  return (
    <>
      {!abierto && (
        <button
          onClick={() => setAbierto(true)}
          aria-label="Abrir Royal Copilot"
          className="fixed right-4 z-40 flex items-center gap-2 rounded-full bg-brand-dark text-white pl-3.5 pr-4 py-3 shadow-lg active:scale-95 transition"
          style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 5.5rem)" }}
        >
          <Sparkles className="w-5 h-5 text-accent-soft" strokeWidth={2} />
          <span className="text-[14px] font-semibold">Copilot</span>
        </button>
      )}

      {abierto && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true" aria-label="Royal Copilot">
          <button className="absolute inset-0 bg-brand-deep/40" aria-label="Cerrar" onClick={() => setAbierto(false)} />

          <div
            className="relative bg-surface rounded-t-3xl shadow-2xl flex flex-col max-h-[88vh] animate-in slide-in-from-bottom duration-200"
            style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
          >
            {/* Encabezado */}
            <div className="flex items-center gap-3 px-5 pt-4 pb-3 border-b border-hairline">
              <span className="w-9 h-9 rounded-xl bg-brand-dark grid place-items-center shrink-0">
                <Sparkles className="w-5 h-5 text-accent-soft" strokeWidth={2} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-display font-bold text-brand-deep text-[16px] leading-tight">Royal Copilot</p>
                <p className="text-[11.5px] text-muted">Tu asistente de ventas · uso interno</p>
              </div>
              {mensajes.length > 0 && (
                <button onClick={nuevaConversacion} className="text-[12px] font-semibold text-brand-dark px-2 py-1 rounded-lg active:bg-hairline">
                  Nueva
                </button>
              )}
              <button onClick={() => setAbierto(false)} aria-label="Cerrar" className="w-9 h-9 grid place-items-center rounded-xl active:bg-hairline">
                <X className="w-5 h-5 text-muted" />
              </button>
            </div>

            {/* Contexto activo */}
            {customer && (
              <div className="px-5 py-2.5 border-b border-hairline bg-card/60 flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-brand shrink-0" />
                {usarContexto ? (
                  <>
                    <p className="text-[12.5px] text-ink flex-1 min-w-0 truncate">
                      Contexto: <span className="font-semibold">{customer.firstName} {customer.lastName || ""}</span>
                    </p>
                    <button onClick={() => setUsarContexto(false)} className="text-[11.5px] font-semibold text-muted px-2 py-1 rounded-lg active:bg-hairline">
                      Quitar contexto
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-[12.5px] text-muted flex-1">Sin contexto de cliente</p>
                    <button onClick={() => setUsarContexto(true)} className="text-[11.5px] font-semibold text-brand-dark px-2 py-1 rounded-lg active:bg-hairline">
                      Usar cliente
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Cuerpo */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {mensajes.length === 0 && !flujo && (
                <div className="space-y-3">
                  <p className="text-[13px] text-muted leading-relaxed">
                    ¿En qué te ayudo? Elige una acción o escríbeme tu duda de ventas, producto o garantía.
                  </p>
                  <div className="grid grid-cols-1 gap-2">
                    {accionesVisibles.map((a) => {
                      const Icon = a.icon
                      return (
                        <button
                          key={a.id}
                          onClick={() => elegirAccion(a)}
                          className="flex items-center gap-3 rounded-2xl bg-card border border-hairline px-4 py-3 text-left active:bg-hairline transition"
                        >
                          <span className="w-8 h-8 rounded-lg bg-accent-soft grid place-items-center shrink-0">
                            <Icon className="w-4 h-4 text-accent" strokeWidth={2} />
                          </span>
                          <span className="text-[14px] text-ink font-medium flex-1">{a.label}</span>
                          <ArrowRight className="w-4 h-4 text-muted/50" />
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {mensajes.map((m, i) => (
                <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                  <div className={
                    m.role === "user"
                      ? "max-w-[85%] rounded-2xl rounded-br-md bg-brand-dark text-white px-3.5 py-2.5 text-[14px] leading-relaxed"
                      : "max-w-[92%] rounded-2xl rounded-bl-md bg-card border border-hairline px-3.5 py-2.5"
                  }>
                    <p className={m.role === "user" ? "" : "text-[14px] text-ink leading-relaxed whitespace-pre-wrap"}>{m.text}</p>

                    {/* Aviso obligatorio (garantías / límites) */}
                    {m.disclaimer && (
                      <p className="mt-2 text-[11.5px] text-warning bg-warning/10 rounded-lg px-2.5 py-1.5 leading-snug">
                        {m.disclaimer}
                      </p>
                    )}

                    {/* Elegir producto para desambiguar (choices del servidor) */}
                    {m.choices?.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-2">
                        {m.choices.map((c, j) => (
                          <button
                            key={j}
                            onClick={() => elegirProducto(c, m.next)}
                            className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-dark bg-brand/[0.06] border border-brand/15 rounded-full px-3 py-1.5 active:bg-brand/10"
                          >
                            <Package className="w-3.5 h-3.5" /> {c.name}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* El servidor pide elegir producto → abrir selector */}
                    {m.askProduct && (
                      <button
                        onClick={() => { setFlujo({ type: "pick", next: m.next || "warranty" }); setBusqueda("") }}
                        className="mt-2.5 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-dark bg-brand/[0.06] border border-brand/15 rounded-full px-3 py-1.5 active:bg-brand/10"
                      >
                        <Search className="w-3.5 h-3.5" /> Elegir producto
                      </button>
                    )}

                    {/* Botones de acción sugeridos por el servidor */}
                    {m.actions?.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-2">
                        {m.actions.map((a, j) => {
                          const esCopia = !a.screen && a.note
                          const key = `act-${(a.label || a.note || "").slice(0, 8)}`
                          return (
                            <button
                              key={j}
                              onClick={() => ejecutarAccion(a)}
                              className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-dark bg-brand/[0.06] border border-brand/15 rounded-full px-3 py-1.5 active:bg-brand/10"
                            >
                              {esCopia ? (copiado === key ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />) : <ArrowRight className="w-3.5 h-3.5" />}
                              {a.label}
                            </button>
                          )
                        })}
                      </div>
                    )}

                    {/* Fuentes citadas (garantía / contenido oficial) */}
                    {m.sources?.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-hairline">
                        <p className="text-[10.5px] font-semibold text-muted uppercase tracking-wide mb-1">Fuentes</p>
                        {m.sources.map((s, k) => (
                          <p key={k} className="text-[11.5px] text-muted leading-snug">· {s}</p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {cargando && (
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-bl-md bg-card border border-hairline px-3.5 py-2.5 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 text-brand animate-spin" />
                    <span className="text-[13px] text-muted">Pensando…</span>
                  </div>
                </div>
              )}

              {/* --------- PANELES DE FLUJO GUIADO --------- */}
              {flujo?.type === "objection" && (
                <div className="rounded-2xl bg-card border border-hairline p-3.5">
                  <div className="flex items-center gap-2 mb-2.5">
                    <button onClick={() => setFlujo(null)} aria-label="Volver" className="w-7 h-7 grid place-items-center rounded-lg active:bg-hairline -ml-1">
                      <ChevronLeft className="w-4 h-4 text-muted" />
                    </button>
                    <p className="text-[13.5px] font-semibold text-ink">¿Qué objeción te dio el cliente?</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {OBJECIONES.map((o) => (
                      <button key={o} onClick={() => elegirObjecion(o)}
                        className="text-[12.5px] font-medium text-ink bg-surface border border-hairline rounded-full px-3 py-1.5 active:bg-hairline">
                        {o}
                      </button>
                    ))}
                    <button onClick={() => setFlujo({ type: "objection-otra" })}
                      className="text-[12.5px] font-semibold text-brand-dark bg-brand/[0.06] border border-brand/15 rounded-full px-3 py-1.5 active:bg-brand/10">
                      Otra
                    </button>
                  </div>
                </div>
              )}

              {flujo?.type === "objection-otra" && (
                <div className="rounded-2xl bg-card border border-hairline p-3.5">
                  <div className="flex items-center gap-2 mb-2.5">
                    <button onClick={() => setFlujo({ type: "objection" })} aria-label="Volver" className="w-7 h-7 grid place-items-center rounded-lg active:bg-hairline -ml-1">
                      <ChevronLeft className="w-4 h-4 text-muted" />
                    </button>
                    <p className="text-[13.5px] font-semibold text-ink">Escribe exactamente qué te dijo el cliente</p>
                  </div>
                  <textarea
                    value={objetraTexto}
                    onChange={(e) => setObjetraTexto(e.target.value)}
                    rows={2}
                    placeholder="Ej.: prefiero esperar a fin de año…"
                    className="w-full resize-none rounded-xl border border-hairline bg-surface px-3 py-2 text-[14px] text-ink placeholder:text-muted/70 focus:outline-none focus:border-brand/40"
                  />
                  <button
                    onClick={() => objetraTexto.trim() && elegirObjecion(objetraTexto.trim())}
                    disabled={!objetraTexto.trim()}
                    className="mt-2 w-full rounded-xl bg-brand-dark text-white text-[13.5px] font-semibold py-2.5 disabled:opacity-40 active:scale-[0.99] transition"
                  >
                    Pedir respuesta sugerida
                  </button>
                </div>
              )}

              {flujo?.type === "pick" && (
                <div className="rounded-2xl bg-card border border-hairline p-3.5">
                  <div className="flex items-center gap-2 mb-2.5">
                    <button onClick={() => setFlujo(null)} aria-label="Volver" className="w-7 h-7 grid place-items-center rounded-lg active:bg-hairline -ml-1">
                      <ChevronLeft className="w-4 h-4 text-muted" />
                    </button>
                    <p className="text-[13.5px] font-semibold text-ink">
                      {flujo.next === "warranty" ? "¿De qué producto quieres consultar la garantía?" : "¿Qué producto quieres consultar?"}
                    </p>
                  </div>

                  {prodsCliente.length > 0 && contextoCliente && (
                    <div className="mb-3">
                      <p className="text-[10.5px] font-semibold text-muted uppercase tracking-wide mb-1.5">Productos de {customer.firstName}</p>
                      <div className="flex flex-wrap gap-2">
                        {prodsCliente.map((cp, j) => (
                          <button key={j} onClick={() => elegirProducto(cp, flujo.next)}
                            className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-dark bg-brand/[0.06] border border-brand/15 rounded-full px-3 py-1.5 active:bg-brand/10">
                            <Package className="w-3.5 h-3.5" /> {cp.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2 rounded-xl border border-hairline bg-surface px-3 py-2 mb-2">
                    <Search className="w-4 h-4 text-muted shrink-0" />
                    <input
                      value={busqueda}
                      onChange={(e) => setBusqueda(e.target.value)}
                      placeholder="Buscar producto (ej.: licuadora, olla)…"
                      className="flex-1 bg-transparent text-[14px] text-ink placeholder:text-muted/70 focus:outline-none"
                    />
                  </div>

                  <div className="max-h-56 overflow-y-auto -mx-1 px-1">
                    {catalogoFiltrado.length === 0 ? (
                      <p className="text-[12.5px] text-muted py-3 text-center">No encontré productos con ese término.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {catalogoFiltrado.map((p) => (
                          <button key={p.id} onClick={() => elegirProducto(p, flujo.next)}
                            className="w-full flex items-center gap-2.5 rounded-xl bg-surface border border-hairline px-3 py-2 text-left active:bg-hairline">
                            <Package className="w-4 h-4 text-brand shrink-0" />
                            <span className="flex-1 min-w-0">
                              <span className="block text-[13.5px] text-ink font-medium truncate">{p.name}</span>
                              {(p.category || p.line) && (
                                <span className="block text-[11px] text-muted truncate">{[p.line, p.category].filter(Boolean).join(" · ")}</span>
                              )}
                            </span>
                            <ArrowRight className="w-4 h-4 text-muted/50" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {flujo?.type === "topic" && flujo.product && (
                <div className="rounded-2xl bg-card border border-hairline p-3.5">
                  <div className="flex items-center gap-2 mb-2.5">
                    <button onClick={() => { setFlujo({ type: "pick", next: "product" }); setBusqueda("") }} aria-label="Volver" className="w-7 h-7 grid place-items-center rounded-lg active:bg-hairline -ml-1">
                      <ChevronLeft className="w-4 h-4 text-muted" />
                    </button>
                    <p className="text-[13.5px] font-semibold text-ink truncate">{flujo.product.name}</p>
                  </div>
                  <p className="text-[12px] text-muted mb-2">¿Qué quieres saber?</p>
                  <div className="flex flex-wrap gap-2">
                    {TEMAS.map((t) => (
                      <button key={t.key} onClick={() => elegirTema(t, flujo.product)}
                        className="text-[12.5px] font-medium text-ink bg-surface border border-hairline rounded-full px-3 py-1.5 active:bg-hairline">
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div ref={finRef} />
            </div>

            {/* Barra de entrada */}
            <div className="px-4 py-3 border-t border-hairline bg-card">
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && e.keyCode !== 229) {
                      e.preventDefault(); enviar()
                    }
                  }}
                  rows={1}
                  placeholder="Escribe tu duda…"
                  className="flex-1 resize-none max-h-28 rounded-2xl border border-hairline bg-surface px-3.5 py-2.5 text-[14px] text-ink placeholder:text-muted/70 focus:outline-none focus:border-brand/40"
                />
                <button
                  onClick={() => enviar()}
                  disabled={!input.trim() || cargando}
                  aria-label="Enviar"
                  className="w-11 h-11 shrink-0 rounded-2xl bg-brand-dark text-white grid place-items-center disabled:opacity-40 active:scale-95 transition"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

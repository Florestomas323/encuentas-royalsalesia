"use client"

import { useEffect, useRef, useState } from "react"
import {
  Sparkles, X, Send, MessageSquarePlus, ShieldCheck, User, Package,
  ArrowRight, Copy, Check, Loader2, Lightbulb, Wrench, HeartHandshake, Target,
} from "lucide-react"

// Royal Copilot — copiloto interno de ventas.
// Widget autocontenido: FAB flotante + hoja modal. Habla con /api/ai/copilot
// enviando SOLO ids (el servidor rehidrata el contexto con aislamiento por
// organización). Nunca envía datos de contacto ni recibe promesas de garantía.

// Acciones guiadas por intención. `needs` indica qué contexto requieren.
const ACCIONES = [
  { id: "objection", label: "Rebatir una objeción", icon: Lightbulb, needs: "none",
    seed: "El cliente dice que está muy caro. ¿Cómo lo manejo?" },
  { id: "product", label: "Explicar un producto", icon: Package, needs: "none",
    prefill: "Explícame los beneficios clave de " },
  { id: "warranty", label: "Consultar garantía", icon: ShieldCheck, needs: "none",
    seed: "¿Qué cubre la garantía y qué se necesita para un reclamo?" },
  { id: "postsale", label: "Guía de postventa", icon: Wrench, needs: "customer",
    seed: "¿Cuál es el siguiente paso de postventa con este cliente?" },
  { id: "loyalty", label: "Plan de fidelización", icon: HeartHandshake, needs: "customer",
    seed: "Dame ideas de fidelización para este cliente." },
  { id: "nextstep", label: "¿Qué hago ahora?", icon: Target, needs: "customer",
    seed: "¿Cuál es la mejor próxima acción con este cliente?" },
  { id: "message", label: "Redactar un mensaje", icon: MessageSquarePlus, needs: "customer",
    seed: "Redacta un mensaje breve y cálido para reactivar a este cliente." },
]

export default function CopilotWidget({ getToken, customer, onNavigate, onToast }) {
  const [abierto, setAbierto] = useState(false)
  const [mensajes, setMensajes] = useState([]) // { role, text, actions?, sources?, disclaimer? }
  const [input, setInput] = useState("")
  const [cargando, setCargando] = useState(false)
  const [usarContexto, setUsarContexto] = useState(true)
  const [conversationId, setConversationId] = useState(null)
  const [copiado, setCopiado] = useState(null)
  const finRef = useRef(null)
  const inputRef = useRef(null)

  // Acción rápida: si trae "prefill" rellena el campo para que el vendedor
  // complete (p. ej. el nombre del producto); si trae "seed" la envía directo.
  function elegirAccion(a) {
    if (a.prefill) {
      setInput(a.prefill)
      setTimeout(() => {
        const el = inputRef.current
        if (el) { el.focus(); el.setSelectionRange(a.prefill.length, a.prefill.length) }
      }, 0)
    } else if (a.seed) {
      enviar(a.seed)
    }
  }

  // Si cambia el cliente activo, reactivamos el contexto por defecto.
  useEffect(() => { setUsarContexto(true) }, [customer?.id])

  useEffect(() => {
    if (abierto) finRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [mensajes, abierto])

  const contextoCliente = usarContexto ? customer : null

  async function enviar(texto) {
    const pregunta = (texto ?? input).trim()
    if (!pregunta || cargando) return
    setInput("")
    // Historial reciente (para continuidad) a partir de lo ya mostrado.
    const historial = mensajes.slice(-6).map((m) => ({
      role: m.role,
      content: m.text,
    }))
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
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || `http-${res.status}`)
      }
      const r = data.result || {}
      if (data.conversationId) setConversationId(data.conversationId)
      setMensajes((m) => [...m, {
        role: "assistant",
        text: r.answer || "No pude generar una respuesta.",
        actions: Array.isArray(r.actions) ? r.actions : [],
        sources: Array.isArray(r.sources) ? r.sources : [],
        disclaimer: r.disclaimer || null,
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

  function nuevaConversacion() {
    setMensajes([]); setConversationId(null); setInput("")
  }

  async function copiar(texto, key) {
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(key); onToast?.("Mensaje copiado.")
      setTimeout(() => setCopiado(null), 1600)
    } catch { onToast?.("No se pudo copiar.") }
  }

  // Acción devuelta por el servidor: { label, screen, note }. Si trae una
  // pantalla de la lista blanca, navegamos; si solo trae nota, la copiamos
  // (útil para borradores de mensaje que el vendedor pega en WhatsApp).
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

  return (
    <>
      {/* FAB flotante, consciente del safe-area del iPhone */}
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
              {mensajes.length === 0 && (
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

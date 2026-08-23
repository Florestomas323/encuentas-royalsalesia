"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Home, Users, Calendar, Plus, ChevronRight, Loader2, MessageCircle, Copy, Check,
  ArrowLeft, Clock, AlertCircle, Sparkles, Search, CheckCircle2, XCircle, HelpCircle,
  Eye, ListChecks, PlayCircle, CloudUpload, Cloud,
} from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { normalizePhone, toWhatsAppNumber, isValidPhone } from "@/lib/phone";
import { calculateOpportunity, OPPORTUNITY_LABELS } from "@/lib/scoring/opportunityScore";
import {
  findCustomerByPhone, createCustomer, updateCustomer, subscribeCustomers, getCustomer,
  createVisit, updateVisit, findInProgressVisit, getVisitsForCustomer,
  saveSurveyResponses, saveAiProfile, saveVisitResult, savePurchase,
  createFollowup, subscribeFollowups, completeFollowup, getFollowupsForCustomer,
  logInteraction, getInteractionsForCustomer, getRecentVisits, tsToDate,
} from "@/lib/db/services";

// ---------- ENCUESTA (claves semánticas camelCase — solo preguntas para el cliente) ----------
const PREGUNTAS = [
  { key: "foodPerception", texto: "¿Qué considera que hace principalmente cuando come?", tipo: "single", opciones: ["Se alimenta", "Se nutre", "Ambas", "No está seguro"], requerida: false },
  { key: "favoriteMeal", texto: "¿Cuál es el plato o comida favorita de su familia?", tipo: "texto", requerida: false },
  { key: "primaryCook", texto: "¿Quién cocina principalmente en el hogar?", tipo: "single", opciones: ["Yo", "Mi pareja", "Ambos", "Otro"], requerida: false },
  { key: "cookingFrequency", texto: "¿Cuántos días por semana cocinan en casa?", tipo: "single", opciones: ["1–2 días", "3–4 días", "5–6 días", "Todos los días"], requerida: true },
  { key: "wantsHealthierHabits", texto: "¿Les gustaría mejorar sus hábitos de alimentación?", tipo: "single", opciones: ["Sí", "No", "Tal vez"], requerida: true },
  { key: "cookingHealthImportance", texto: "¿Considera importante la forma en que se preparan los alimentos para la salud de su familia?", tipo: "single", opciones: ["Muy importante", "Importante", "Poco importante", "No lo había pensado"], requerida: true },
  { key: "cookingPriorities", texto: "¿Qué factores son más importantes al momento de cocinar?", tipo: "multi", opciones: ["Organización", "Rapidez", "Facilidad de limpieza", "Preservación de los alimentos", "Sabor", "Economía", "Salud", "Practicidad", "Durabilidad"], requerida: true },
  { key: "monthlyFoodBudget", texto: "¿Cuánto aproximadamente invierte su familia mensualmente en alimentos?", tipo: "numero", requerida: true, permiteOmitir: true },
  { key: "familyPriority", texto: "¿Cuál de estas áreas representa mayor prioridad actualmente para su familia?", tipo: "single", opciones: ["Bienestar y salud", "Economía y ahorro", "Calidad de vida", "Tiempo y practicidad", "Alimentación de los hijos", "Otro"], requerida: true },
];

// Información privada del vendedor — NO es parte de la encuesta visible al cliente.
const INFO_INTERNA = [
  { key: "cookPresent", texto: "¿La persona que cocina está presente?", opciones: ["Sí", "No", "No sé"] },
  { key: "decisionParticipation", texto: "¿Quién participa en la decisión?", opciones: ["Persona entrevistada", "Pareja", "Ambos", "Otro", "Desconocido"] },
  { key: "relevantPeoplePresent", texto: "Personas relevantes presentes", opciones: ["Todos", "Falta pareja", "Falta usuario principal", "Desconocido"] },
  { key: "observedInterest", texto: "Interés observado", opciones: ["Alto", "Medio", "Bajo", "Aún no determinado"] },
];

const MOTIVOS = ["Precio", "Debe consultarlo con su pareja", "Quiere pensarlo", "Financiamiento", "No vio suficiente necesidad", "Quiere comparar", "No era el momento", "Otro"];

const DIAS_FIDELIZACION = [
  { dia: 1, titulo: "Bienvenida" },
  { dia: 3, titulo: "Consejo de uso" },
  { dia: 7, titulo: "Receta personalizada" },
  { dia: 15, titulo: "Tip de mantenimiento" },
  { dia: 30, titulo: "Seguimiento de satisfacción" },
  { dia: 45, titulo: "Solicitud de referidos" },
  { dia: 60, titulo: "Producto complementario" },
];

// ---------- CAPA DE IA (se mueve al servidor en la Fase 3C) ----------
async function llamarIA(prompt) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1200,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await response.json();
  const text = (data.content || []).find((b) => b.type === "text")?.text || "{}";
  return JSON.parse(text.replace(/```json|```/g, "").trim());
}

function promptPerfilCliente({ respuestas, infoInterna, observaciones, familySize }) {
  // Privacidad: no se envía nombre, teléfono ni dirección — solo encuesta anónima.
  return `Eres un asistente de análisis comercial para asesores de venta directa de utensilios de cocina premium. Analiza esta encuesta y responde ÚNICAMENTE con un JSON válido, sin backticks, en español. Usa "unknown" cuando no haya información suficiente — nunca inventes. No infieras capacidad económica, no hagas afirmaciones médicas, no sugieras presión psicológica.

Encuesta: ${JSON.stringify(respuestas)}
Información interna de la visita: ${JSON.stringify(infoInterna)}
Tamaño de familia: ${familySize || "no especificado"}
Observaciones del vendedor: ${observaciones || "ninguna"}

Formato exacto:
{
  "primaryMotivator": "",
  "secondaryMotivator": "",
  "mainNeed": "",
  "customerSummary": "",
  "emphasisPoints": ["", "", ""],
  "questionsToAsk": ["", ""],
  "avoidTopics": ["", ""],
  "likelyConcerns": ["", ""],
  "recommendedContent": ["", ""],
  "interestLevel": "alto | medio | bajo | unknown",
  "priceSensitivity": "alta | media | baja | unknown"
}`;
}

function Boton({ children, onClick, variant = "primary", className = "", disabled }) {
  const base = "w-full py-4 rounded-2xl font-semibold text-base flex items-center justify-center gap-2 transition active:scale-[0.98] disabled:opacity-50";
  const variants = {
    primary: "bg-green-800 text-white shadow-lg shadow-green-900/20",
    gold: "bg-orange-500 text-green-950",
    ghost: "bg-white text-green-800 border-2 border-green-100",
  };
  return (
    <button disabled={disabled} onClick={onClick} className={`${base} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
}

function TopBar({ title, onBack, right }) {
  return (
    <div className="flex items-center gap-3 px-5 pt-6 pb-4">
      {onBack && (
        <button onClick={onBack} aria-label="Volver" className="p-2 -ml-2 rounded-full active:bg-green-50">
          <ArrowLeft className="w-5 h-5 text-green-900" />
        </button>
      )}
      <h1 className="text-lg font-bold text-green-950 flex-1">{title}</h1>
      {right}
    </div>
  );
}

function Badge({ children, className = "" }) {
  return <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold border ${className}`}>{children}</span>;
}

function fmtFecha(d) {
  if (!d) return "—";
  return d.toLocaleDateString("es-US", { day: "numeric", month: "short" }) + " " +
    d.toLocaleTimeString("es-US", { hour: "numeric", minute: "2-digit" });
}

function fmtDia(d) {
  if (!d) return "—";
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const fecha = new Date(d); fecha.setHours(0, 0, 0, 0);
  const diff = Math.round((fecha - hoy) / 86400000);
  if (diff === 0) return "Hoy";
  if (diff === 1) return "Mañana";
  if (diff < 0) return `Vencido (${fecha.toLocaleDateString("es-US", { day: "numeric", month: "short" })})`;
  return fecha.toLocaleDateString("es-US", { day: "numeric", month: "short" });
}

const PROSPECTO_VACIO = { firstName: "", lastName: "", phone: "", familySize: "" };
const ETIQUETA_ESTADO = { new: "Nuevo", pending: "Pendiente", purchased: "Compró", lost: "No compró" };
const COLOR_ESTADO = {
  new: "text-gray-600 bg-gray-100 border-gray-200",
  pending: "text-orange-700 bg-orange-50 border-orange-200",
  purchased: "text-green-700 bg-green-50 border-green-200",
  lost: "text-gray-600 bg-gray-100 border-gray-200",
};

export default function RoyalSalesAIDemo() {
  const { user, profile } = useAuth();
  const ctx = { uid: user?.uid, profile };

  const [screen, setScreen] = useState("dashboard");
  const [toast, setToast] = useState(null);
  const [prospecto, setProspecto] = useState(PROSPECTO_VACIO);
  const [duplicado, setDuplicado] = useState(null);
  const [customerId, setCustomerId] = useState(null);
  const [visitId, setVisitId] = useState(null);
  const [qIndex, setQIndex] = useState(0);
  const [respuestas, setRespuestas] = useState({});
  const [infoInterna, setInfoInterna] = useState({});
  const [observaciones, setObservaciones] = useState("");
  const [guardando, setGuardando] = useState("saved"); // saved | saving | offline
  const [loadingIA, setLoadingIA] = useState(false);
  const [perfilIA, setPerfilIA] = useState(null);
  const [errorIA, setErrorIA] = useState(null);
  const [creandoVisita, setCreandoVisita] = useState(false);
  const [compraData, setCompraData] = useState({ producto: "", monto: "" });
  const [planFidelizacion, setPlanFidelizacion] = useState(null);
  const [resultadoTipo, setResultadoTipo] = useState(null);
  const [motivoPendiente, setMotivoPendiente] = useState("");
  const [diasSeguimiento, setDiasSeguimiento] = useState(2);
  const [seguimientoIA, setSeguimientoIA] = useState(null);
  const [copiado, setCopiado] = useState(false);
  const [procesando, setProcesando] = useState(false);

  const [clientes, setClientes] = useState(null);
  const [followups, setFollowups] = useState(null);
  const [visitaEnProgreso, setVisitaEnProgreso] = useState(null);
  const [metricas, setMetricas] = useState(null);
  const [fichaCliente, setFichaCliente] = useState(null);
  const [fichaTimeline, setFichaTimeline] = useState(null);
  const [waLogFollowup, setWaLogFollowup] = useState(null);

  const draftTimer = useRef(null);

  function mostrarToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }

  const pregunta = PREGUNTAS[qIndex];
  const score = calculateOpportunity({ ...respuestas, ...infoInterna });
  const scoreUI = {
    high: { nivel: "Alta", color: "text-green-700 bg-green-50 border-green-200" },
    medium: { nivel: "Media", color: "text-orange-700 bg-orange-50 border-orange-200" },
    low: { nivel: "Baja", color: "text-gray-600 bg-gray-100 border-gray-200" },
  }[score];

  const camposFaltantes = PREGUNTAS.filter((p) => p.requerida).filter((p) => {
    const v = respuestas[p.key];
    if (p.tipo === "numero") return !(v === "omitido" || (Number(v) > 0));
    return v === undefined || v === "" || (Array.isArray(v) && v.length === 0);
  });

  // ---------- listas en tiempo real ----------
  useEffect(() => {
    if (!user || !profile?.organizationId) return;
    const un1 = subscribeCustomers(ctx, setClientes, () => setClientes([]));
    const un2 = subscribeFollowups(ctx, setFollowups, () => setFollowups([]));
    return () => { un1(); un2(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, profile?.organizationId]);

  // ---------- visita en progreso + métricas ----------
  const cargarDashboard = useCallback(async () => {
    if (!user || !profile?.organizationId) return;
    try {
      const [vp, visitas] = await Promise.all([findInProgressVisit(ctx), getRecentVisits(ctx)]);
      setVisitaEnProgreso(vp);
      const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
      const deHoy = visitas.filter((v) => { const d = tsToDate(v.createdAt); return d && d >= hoy; });
      setMetricas({
        visitasHoy: deHoy.length,
        ventasHoy: deHoy.filter((v) => v.outcome === "purchased").length,
        pendientesHoy: deHoy.filter((v) => v.outcome === "pending").length,
      });
    } catch { /* sin conexión: se reintenta al volver */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, profile?.organizationId]);

  useEffect(() => { if (screen === "dashboard") cargarDashboard(); }, [screen, cargarDashboard]);

  // ---------- autoguardado ----------
  useEffect(() => {
    if (!visitId) return;
    const draft = { respuestas, infoInterna, observaciones, qIndex };
    try { localStorage.setItem(`rsai-draft-${visitId}`, JSON.stringify(draft)); } catch {}
    setGuardando("saving");
    clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(async () => {
      try {
        await updateVisit(ctx, visitId, { surveyDraft: draft });
        setGuardando("saved");
      } catch {
        setGuardando("offline");
      }
    }, 1200);
    return () => clearTimeout(draftTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [respuestas, infoInterna, observaciones, qIndex, visitId]);

  function limpiarFlujo() {
    setProspecto(PROSPECTO_VACIO); setDuplicado(null); setCustomerId(null); setVisitId(null);
    setQIndex(0); setRespuestas({}); setInfoInterna({}); setObservaciones(""); setPerfilIA(null);
    setErrorIA(null); setCompraData({ producto: "", monto: "" }); setPlanFidelizacion(null);
    setResultadoTipo(null); setMotivoPendiente(""); setSeguimientoIA(null); setDiasSeguimiento(2);
  }

  function irADashboard() { limpiarFlujo(); setScreen("dashboard"); }

  // ---------- nueva visita ----------
  async function comenzarVisita(usarClienteExistenteId = null) {
    const phone = normalizePhone(prospecto.phone);
    if (!prospecto.firstName || !isValidPhone(phone)) return;
    setCreandoVisita(true);
    try {
      let cid = usarClienteExistenteId;
      if (!cid && !duplicado) {
        const existente = await findCustomerByPhone(ctx, phone);
        if (existente) { setDuplicado(existente); setCreandoVisita(false); return; }
      }
      if (!cid) {
        cid = await createCustomer(ctx, {
          firstName: prospecto.firstName.trim(),
          lastName: prospecto.lastName.trim(),
          phone,
          familySize: prospecto.familySize ? Number(prospecto.familySize) : null,
        });
      }
      const vid = await createVisit(ctx, cid);
      setCustomerId(cid); setVisitId(vid); setDuplicado(null);
      mostrarToast("Visita guardada");
      setScreen("encuesta");
    } catch {
      mostrarToast("No pudimos guardar. Revisa tu conexión.");
    } finally {
      setCreandoVisita(false);
    }
  }

  async function continuarVisita(v) {
    setVisitId(v.id); setCustomerId(v.customerId);
    const c = await getCustomer(v.customerId).catch(() => null);
    if (c) setProspecto({ firstName: c.firstName || "", lastName: c.lastName || "", phone: c.phone || "", familySize: c.familySize || "" });
    let draft = v.surveyDraft;
    try {
      const local = localStorage.getItem(`rsai-draft-${v.id}`);
      if (local) draft = JSON.parse(local);
    } catch {}
    if (draft) {
      setRespuestas(draft.respuestas || {});
      setInfoInterna(draft.infoInterna || {});
      setObservaciones(draft.observaciones || "");
      setQIndex(draft.qIndex || 0);
    }
    setScreen("encuesta");
  }

  function setRespuestaSingle(val) { setRespuestas((r) => ({ ...r, [pregunta.key]: val })); }
  function toggleMulti(val) {
    setRespuestas((r) => {
      const actual = r[pregunta.key] || [];
      return { ...r, [pregunta.key]: actual.includes(val) ? actual.filter((x) => x !== val) : [...actual, val] };
    });
  }

  // ---------- análisis IA ----------
  async function analizarConIA() {
    if (camposFaltantes.length > 0) return;
    setScreen("analizando"); setLoadingIA(true); setErrorIA(null);
    try {
      await saveSurveyResponses(ctx, visitId, customerId, respuestas, { ...infoInterna, observaciones });
      await updateVisit(ctx, visitId, { status: "survey_completed" });
    } catch { /* la encuesta sigue en el draft local */ }
    try {
      const perfil = await llamarIA(promptPerfilCliente({
        respuestas, infoInterna, observaciones, familySize: prospecto.familySize,
      }));
      setPerfilIA(perfil);
      saveAiProfile(ctx, visitId, customerId, perfil).catch(() => {});
      setScreen("perfilRapido");
    } catch {
      setErrorIA("No pudimos generar el análisis en este momento.");
      setScreen("errorAnalisis");
    } finally {
      setLoadingIA(false);
    }
  }

  // ---------- resultado: compró ----------
  async function registrarCompra() {
    if (procesando) return;
    setProcesando(true);
    try {
      let contenido = {};
      try {
        const res = await llamarIA(`Genera contenido personalizado (no fechas) para un plan de fidelización de un cliente que compró utensilios de cocina premium. Responde SOLO JSON sin backticks, en español.
Perfil: ${JSON.stringify(perfilIA)}
Producto: ${compraData.producto || "set de cocina"}
Plato favorito: ${respuestas.favoriteMeal || "no especificado"}
Formato: {"dia1":"","dia3":"","dia7":"","dia15":"","dia30":"","dia45":"","dia60":""}`);
        contenido = res || {};
      } catch { /* plan sin personalización — no bloquea */ }

      await savePurchase(ctx, visitId, customerId, {
        amount: compraData.monto || null,
        products: compraData.producto ? [compraData.producto] : [],
        notes: "",
      });
      await saveVisitResult(ctx, visitId, customerId, "purchased", {});
      await updateVisit(ctx, visitId, { status: "completed", completedAt: new Date(), outcome: "purchased" });
      await updateCustomer(ctx, customerId, { status: "purchased" });

      const plan = [];
      for (const { dia, titulo } of DIAS_FIDELIZACION) {
        const scheduledAt = new Date(Date.now() + dia * 86400000);
        await createFollowup(ctx, {
          customerId, visitId, type: "loyalty",
          scheduledAt, objective: titulo,
          suggestedMessage: contenido[`dia${dia}`] || "",
        });
        plan.push({ dia, titulo, accion: contenido[`dia${dia}`] || "" });
      }
      setPlanFidelizacion(plan);
      try { localStorage.removeItem(`rsai-draft-${visitId}`); } catch {}
      mostrarToast("Compra y plan guardados");
      setScreen("planFidelizacion");
    } catch {
      mostrarToast("No pudimos guardar. Intenta de nuevo.");
    } finally {
      setProcesando(false);
    }
  }

  // ---------- resultado: pendiente / no compró ----------
  async function generarSeguimiento() {
    if (procesando) return;
    setProcesando(true); setLoadingIA(true);
    try {
      let ia = null;
      try {
        ia = await llamarIA(`Un prospecto quedó "${resultadoTipo === "lost" ? "sin comprar" : "pendiente"}". Genera diagnóstico y seguimiento. SOLO JSON sin backticks, en español. Mensaje de WhatsApp cálido, breve, sin presión, sin nombre (se inserta después).
Motivo: ${motivoPendiente}
Perfil: ${JSON.stringify(perfilIA)}
Formato: {"objective":"","recommendedApproach":"","recommendedDelayDays":2,"recommendedContent":["",""],"suggestedMessage":""}`);
      } catch { /* seguimiento sin IA — no bloquea */ }
      setSeguimientoIA(ia);
      if (ia?.recommendedDelayDays) setDiasSeguimiento(ia.recommendedDelayDays);
      setScreen("seguimientoGenerado");
    } finally {
      setProcesando(false); setLoadingIA(false);
    }
  }

  async function confirmarSeguimiento() {
    if (procesando) return;
    setProcesando(true);
    try {
      const estado = resultadoTipo === "lost" ? "lost" : "pending";
      await saveVisitResult(ctx, visitId, customerId, estado, { reason: motivoPendiente });
      await updateVisit(ctx, visitId, { status: "completed", completedAt: new Date(), outcome: estado });
      await updateCustomer(ctx, customerId, { status: estado });
      await createFollowup(ctx, {
        customerId, visitId,
        type: estado === "lost" ? "reactivation" : "pending_followup",
        scheduledAt: new Date(Date.now() + diasSeguimiento * 86400000),
        objective: seguimientoIA?.objective || `Seguimiento — ${motivoPendiente}`,
        suggestedMessage: seguimientoIA?.suggestedMessage || "",
        reason: motivoPendiente,
      });
      try { localStorage.removeItem(`rsai-draft-${visitId}`); } catch {}
      mostrarToast("Seguimiento programado");
      irADashboard();
    } catch {
      mostrarToast("No pudimos guardar. Intenta de nuevo.");
    } finally {
      setProcesando(false);
    }
  }

  async function marcarSinSeguimiento() {
    if (procesando) return;
    setProcesando(true);
    try {
      await saveVisitResult(ctx, visitId, customerId, "lost", { reason: motivoPendiente, followup: "none" });
      await updateVisit(ctx, visitId, { status: "completed", completedAt: new Date(), outcome: "lost" });
      await updateCustomer(ctx, customerId, { status: "lost" });
      try { localStorage.removeItem(`rsai-draft-${visitId}`); } catch {}
      mostrarToast("Registrado sin seguimiento");
      irADashboard();
    } finally {
      setProcesando(false);
    }
  }

  // ---------- ficha del cliente ----------
  async function abrirFicha(c) {
    setFichaCliente(c); setFichaTimeline(null); setScreen("fichaCliente");
    try {
      const [visitas, fups, inter] = await Promise.all([
        getVisitsForCustomer(ctx, c.id),
        getFollowupsForCustomer(ctx, c.id),
        getInteractionsForCustomer(ctx, c.id),
      ]);
      const eventos = [];
      visitas.forEach((v) => {
        const d = tsToDate(v.startedAt || v.createdAt);
        eventos.push({ fecha: d, texto: "Visita iniciada" });
        if (v.outcome) eventos.push({ fecha: tsToDate(v.completedAt) || d, texto: `Resultado: ${ETIQUETA_ESTADO[v.outcome] || v.outcome}` });
      });
      fups.forEach((f) => {
        eventos.push({ fecha: tsToDate(f.createdAt), texto: `Seguimiento programado — ${f.objective || f.type}` });
        if (f.status === "completed") eventos.push({ fecha: tsToDate(f.completedAt), texto: "Seguimiento completado" });
      });
      inter.forEach((i) => eventos.push({ fecha: tsToDate(i.createdAt), texto: `WhatsApp: ${i.action}` }));
      eventos.sort((a, b) => (a.fecha?.getTime() || 0) - (b.fecha?.getTime() || 0));
      setFichaTimeline(eventos);
    } catch {
      setFichaTimeline([]);
    }
  }

  async function registrarInteraccion(followup, accion) {
    try {
      await logInteraction(ctx, followup.customerId, followup.id, accion);
      if (accion === "Compró" || accion === "No interesado") await completeFollowup(ctx, followup.id);
      mostrarToast("Interacción registrada");
    } catch {
      mostrarToast("No se pudo registrar.");
    }
    setWaLogFollowup(null);
  }

  const clientePorId = (id) => (clientes || []).find((c) => c.id === id);

  // ============================================================ PANTALLAS

  const Toast = toast ? (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 bg-green-950 text-white text-sm px-4 py-2 rounded-full shadow-lg">
      {toast}
    </div>
  ) : null;

  const IndicadorGuardado = visitId ? (
    <span className="flex items-center gap-1 text-[11px] font-medium text-gray-400">
      {guardando === "saving" ? <><CloudUpload className="w-3.5 h-3.5" /> Guardando…</> :
        guardando === "offline" ? <><Cloud className="w-3.5 h-3.5 text-orange-500" /> Pendiente de sincronizar</> :
          <><Check className="w-3.5 h-3.5 text-green-600" /> Guardado</>}
    </span>
  ) : null;

  // ---------- DASHBOARD ----------
  if (screen === "dashboard") {
    const seguimientosHoy = (followups || []).filter((f) => {
      const d = tsToDate(f.scheduledAt);
      return d && d <= new Date(new Date().setHours(23, 59, 59, 999));
    });
    return (
      <Shell active="dashboard" setScreen={setScreen}>
        {Toast}
        <div className="px-5 pt-6 pb-2">
          <p className="text-green-300 text-sm">Hola,</p>
          <h1 className="text-2xl font-bold text-white">{profile?.firstName || "Bienvenido"}</h1>
        </div>
        <div className="px-5 -mt-1 grid grid-cols-3 gap-2 mb-5">
          {[[metricas?.visitasHoy ?? "—", "Visitas hoy"], [metricas?.ventasHoy ?? "—", "Ventas hoy"], [seguimientosHoy.length, "Seguim. hoy"]].map(([n, l]) => (
            <div key={l} className="bg-white/10 rounded-xl py-3 text-center">
              <p className="text-white font-bold text-lg">{n}</p>
              <p className="text-green-200 text-[10px]">{l}</p>
            </div>
          ))}
        </div>
        <div className="bg-gray-50 rounded-t-[2rem] flex-1 px-5 pt-6 pb-24">
          {visitaEnProgreso && (
            <button onClick={() => continuarVisita(visitaEnProgreso)}
              className="w-full mb-4 p-4 rounded-2xl bg-orange-50 border-2 border-orange-200 flex items-center gap-3 text-left">
              <PlayCircle className="w-6 h-6 text-orange-600 shrink-0" />
              <div className="flex-1">
                <p className="font-bold text-orange-800 text-sm">Visita en progreso</p>
                <p className="text-xs text-orange-700">Toca para continuar donde quedaste</p>
              </div>
              <ChevronRight className="w-4 h-4 text-orange-600" />
            </button>
          )}
          <Boton variant="gold" onClick={() => { limpiarFlujo(); setScreen("nuevaVisita"); }} className="mb-6">
            <Plus className="w-5 h-5" /> Nueva visita
          </Boton>
          <p className="font-bold text-green-950 mb-3">Seguimientos de hoy</p>
          {followups === null ? (
            <SkeletonLista />
          ) : seguimientosHoy.length === 0 ? (
            <div className="bg-white rounded-xl p-5 border border-gray-100 text-center mb-6">
              <p className="text-sm text-gray-500 mb-2">Todavía no tienes seguimientos para hoy.</p>
              <button onClick={() => setScreen("seguimientos")} className="text-sm font-semibold text-green-800">Ver próximos</button>
            </div>
          ) : (
            <div className="space-y-2 mb-6">
              {seguimientosHoy.slice(0, 5).map((s) => {
                const c = clientePorId(s.customerId);
                return (
                  <div key={s.id} className="bg-white rounded-xl p-4 border border-gray-100 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center text-green-800 font-semibold text-sm">
                      {(c?.firstName || "?")[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-gray-900 truncate">{c ? `${c.firstName} ${c.lastName || ""}` : "Cliente"}</p>
                      <p className="text-xs text-gray-500 truncate">{s.objective || s.type}</p>
                    </div>
                    <Badge className="text-orange-700 bg-orange-50 border-orange-200">{fmtDia(tsToDate(s.scheduledAt))}</Badge>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Shell>
    );
  }

  // ---------- NUEVA VISITA ----------
  if (screen === "nuevaVisita") {
    const phoneOk = isValidPhone(prospecto.phone);
    return (
      <ScreenWrap>
        {Toast}
        <TopBar title="Nueva visita" onBack={irADashboard} />
        <div className="px-5 space-y-3 flex-1">
          <Campo label="Nombre *" value={prospecto.firstName} onChange={(v) => setProspecto({ ...prospecto, firstName: v })} placeholder="María" />
          <Campo label="Apellido" value={prospecto.lastName} onChange={(v) => setProspecto({ ...prospecto, lastName: v })} placeholder="González" />
          <Campo label="Teléfono * (con código de país)" value={prospecto.phone} onChange={(v) => { setProspecto({ ...prospecto, phone: v }); setDuplicado(null); }} placeholder="+1 254 555 0100" type="tel" />
          <Campo label="Integrantes de la familia" value={prospecto.familySize} onChange={(v) => setProspecto({ ...prospecto, familySize: v })} placeholder="4" type="number" />
          {prospecto.phone && !phoneOk && <p className="text-xs text-orange-600">Revisa el teléfono — se necesita para el seguimiento por WhatsApp.</p>}
          {duplicado && (
            <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl">
              <p className="text-sm font-semibold text-orange-800 mb-1">Parece que este cliente ya existe</p>
              <p className="text-xs text-orange-700 mb-3">{duplicado.firstName} {duplicado.lastName || ""} · {duplicado.phone}</p>
              <div className="flex gap-2">
                <button onClick={() => comenzarVisita(duplicado.id)} className="flex-1 py-2 rounded-lg bg-green-800 text-white text-xs font-semibold">Usar este cliente</button>
                <button onClick={() => comenzarVisita("nuevo") } className="flex-1 py-2 rounded-lg bg-white border border-gray-200 text-xs font-semibold text-gray-700">Es otra persona</button>
              </div>
            </div>
          )}
        </div>
        <div className="px-5 pb-8">
          <Boton onClick={() => comenzarVisita()} disabled={!prospecto.firstName || !phoneOk || creandoVisita}>
            {creandoVisita ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Comenzar encuesta <ChevronRight className="w-4 h-4" />
          </Boton>
        </div>
      </ScreenWrap>
    );
  }

  // ---------- ENCUESTA ----------
  if (screen === "encuesta") {
    const respuesta = respuestas[pregunta.key];
    const esUltima = qIndex === PREGUNTAS.length - 1;
    const puedeAvanzar =
      !pregunta.requerida ? true :
      pregunta.tipo === "numero" ? (respuesta === "omitido" || Number(respuesta) > 0) :
      pregunta.tipo === "multi" ? (respuesta || []).length > 0 :
      !!respuesta;
    return (
      <ScreenWrap>
        {Toast}
        <TopBar title="Encuesta" right={IndicadorGuardado}
          onBack={() => (qIndex === 0 ? irADashboard() : setQIndex(qIndex - 1))} />
        <div className="px-5 mb-6">
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-orange-500 rounded-full transition-all" style={{ width: `${((qIndex + 1) / PREGUNTAS.length) * 100}%` }} />
          </div>
          <p className="text-xs text-gray-400 mt-1">Pregunta {qIndex + 1} de {PREGUNTAS.length}{!pregunta.requerida && " · opcional"}</p>
        </div>
        <div className="px-5 flex-1">
          <p className="text-xl font-bold text-green-950 mb-5 leading-snug">{pregunta.texto}</p>
          {pregunta.tipo === "single" && (
            <div className="space-y-2">
              {pregunta.opciones.map((op) => (
                <button key={op} onClick={() => setRespuestaSingle(op)}
                  className={`w-full text-left px-4 py-4 rounded-xl border-2 font-medium transition ${respuesta === op ? "border-green-800 bg-green-50 text-green-900" : "border-gray-100 bg-white text-gray-700"}`}>
                  {op}
                </button>
              ))}
            </div>
          )}
          {pregunta.tipo === "multi" && (
            <div className="space-y-2">
              {pregunta.opciones.map((op) => {
                const sel = (respuesta || []).includes(op);
                return (
                  <button key={op} onClick={() => toggleMulti(op)}
                    className={`w-full text-left px-4 py-3.5 rounded-xl border-2 font-medium flex items-center justify-between transition ${sel ? "border-green-800 bg-green-50 text-green-900" : "border-gray-100 bg-white text-gray-700"}`}>
                    {op}
                    {sel && <Check className="w-4 h-4 text-green-800" />}
                  </button>
                );
              })}
            </div>
          )}
          {pregunta.tipo === "texto" && (
            <textarea value={respuesta || ""} onChange={(e) => setRespuestaSingle(e.target.value)}
              className="w-full border-2 border-gray-100 rounded-xl p-4 text-base text-gray-800 focus:border-green-800 focus:outline-none" rows={3} placeholder="Escribe aquí..." />
          )}
          {pregunta.tipo === "numero" && (
            <div>
              <input type="number" inputMode="decimal" value={respuesta === "omitido" ? "" : (respuesta || "")}
                onChange={(e) => setRespuestaSingle(e.target.value)}
                className="w-full border-2 border-gray-100 rounded-xl p-4 text-base text-gray-800 focus:border-green-800 focus:outline-none" placeholder="$ mensual" />
              {respuesta && respuesta !== "omitido" && Number(respuesta) > 0 && (
                <p className="text-xs text-gray-400 mt-2">
                  Anual: ${(respuesta * 12).toLocaleString()} · 10 años: ${(respuesta * 12 * 10).toLocaleString()} (uso interno)
                </p>
              )}
              {pregunta.permiteOmitir && (
                <button onClick={() => setRespuestaSingle("omitido")}
                  className={`mt-3 text-sm font-medium ${respuesta === "omitido" ? "text-green-800" : "text-gray-400"}`}>
                  {respuesta === "omitido" ? "✓ Prefiere no responder" : "Prefiere no responder"}
                </button>
              )}
            </div>
          )}
        </div>
        <div className="px-5 pb-8 pt-4">
          <Boton onClick={() => (esUltima ? setScreen("infoInterna") : setQIndex(qIndex + 1))} disabled={!puedeAvanzar}>
            {esUltima ? "Continuar" : "Siguiente"} <ChevronRight className="w-4 h-4" />
          </Boton>
          {pregunta.requerida && !puedeAvanzar && (
            <p className="text-xs text-orange-600 text-center mt-2">Esta pregunta es necesaria para poder analizar al cliente.</p>
          )}
        </div>
      </ScreenWrap>
    );
  }

  // ---------- INFORMACIÓN INTERNA ----------
  if (screen === "infoInterna") {
    return (
      <ScreenWrap>
        {Toast}
        <TopBar title="Información interna de la visita" right={IndicadorGuardado} onBack={() => setScreen("encuesta")} />
        <p className="px-5 text-xs text-gray-400 -mt-2 mb-4">Esta sección es privada — el cliente no la ve ni se le pregunta directamente.</p>
        <div className="px-5 flex-1 space-y-5">
          {INFO_INTERNA.map((item) => (
            <div key={item.key}>
              <p className="text-sm font-semibold text-green-950 mb-2">{item.texto}</p>
              <div className="flex flex-wrap gap-2">
                {item.opciones.map((op) => (
                  <button key={op} onClick={() => setInfoInterna((s) => ({ ...s, [item.key]: op }))}
                    className={`px-3.5 py-2.5 rounded-xl border-2 text-sm font-medium transition ${infoInterna[item.key] === op ? "border-green-800 bg-green-50 text-green-900" : "border-gray-100 bg-white text-gray-700"}`}>
                    {op}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div>
            <p className="text-sm font-semibold text-green-950 mb-2">Observaciones</p>
            <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value.slice(0, 600))}
              className="w-full border-2 border-gray-100 rounded-xl p-4 text-base text-gray-800 focus:border-green-800 focus:outline-none" rows={4}
              placeholder='"Ella mostró mucho interés en salud. Él pregunta por precio."' />
            <p className="text-[11px] text-gray-400 mt-1 text-right">{observaciones.length}/600</p>
          </div>
          {camposFaltantes.length > 0 && (
            <div className="p-4 bg-orange-50 border border-orange-100 rounded-xl">
              <p className="text-sm font-semibold text-orange-800 mb-1">Faltan {camposFaltantes.length} respuestas de la encuesta</p>
              <p className="text-xs text-orange-700">{camposFaltantes.map((p) => `#${PREGUNTAS.indexOf(p) + 1}`).join(", ")} — vuelve atrás para completarlas.</p>
            </div>
          )}
        </div>
        <div className="px-5 pb-8 pt-4">
          <Boton variant="gold" onClick={analizarConIA} disabled={camposFaltantes.length > 0 || loadingIA}>
            <Sparkles className="w-4 h-4" /> Analizar cliente con IA
          </Boton>
        </div>
      </ScreenWrap>
    );
  }

  // ---------- ANALIZANDO ----------
  if (screen === "analizando") {
    return (
      <ScreenWrap>
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
          <Loader2 className="w-10 h-10 text-green-800 animate-spin mb-4" />
          <p className="font-bold text-green-950 text-lg mb-3">Analizando la visita...</p>
          <div className="text-sm text-gray-500 space-y-1">
            <p>Identificando prioridades</p>
            <p>Analizando necesidades</p>
            <p>Preparando recomendaciones</p>
          </div>
        </div>
      </ScreenWrap>
    );
  }

  // ---------- ERROR IA ----------
  if (screen === "errorAnalisis") {
    return (
      <ScreenWrap>
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
          <AlertCircle className="w-10 h-10 text-orange-500 mb-4" />
          <p className="font-bold text-green-950 text-lg mb-1">No pudimos generar el análisis</p>
          <p className="text-sm text-gray-500 mb-6">Tu encuesta está guardada. Puedes reintentar o continuar sin análisis IA.</p>
          <div className="w-full space-y-2">
            <Boton onClick={analizarConIA}>Reintentar</Boton>
            <Boton variant="ghost" onClick={() => setScreen("resultado")}>Continuar sin análisis</Boton>
          </div>
        </div>
      </ScreenWrap>
    );
  }

  // ---------- VISTA RÁPIDA ----------
  if (screen === "perfilRapido" && perfilIA) {
    return (
      <ScreenWrap>
        {Toast}
        <TopBar title="Perfil del cliente" onBack={() => setScreen("infoInterna")} />
        <div className="px-5 flex-1 space-y-4">
          <div className="bg-green-50 border border-green-100 rounded-2xl p-5 text-center">
            <p className="text-xs font-semibold text-green-700 uppercase mb-1">Motivador principal</p>
            <p className="text-2xl font-bold text-green-950">{perfilIA.primaryMotivator}</p>
          </div>
          <div className={`rounded-xl p-4 border flex items-center justify-between ${scoreUI.color}`}>
            <span className="font-semibold text-sm">Nivel de oportunidad</span>
            <span className="font-bold">{scoreUI.nivel}</span>
          </div>
          <Seccion titulo="Necesidad principal" texto={perfilIA.mainNeed} />
          <ListaTarjetas titulo="Enfócate en" items={(perfilIA.emphasisPoints || []).slice(0, 3)} color="green" />
          <ListaTarjetas titulo="Pregunta ahora" items={(perfilIA.questionsToAsk || []).slice(0, 2)} color="green" />
          <ListaTarjetas titulo="Posible preocupación" items={(perfilIA.likelyConcerns || []).slice(0, 2)} color="red" />
          <p className="text-[11px] text-gray-400">Estas recomendaciones son una guía para ayudarte a comprender mejor las prioridades expresadas por el cliente.</p>
        </div>
        <div className="px-5 py-6 space-y-2">
          <Boton variant="ghost" onClick={() => setScreen("perfilCompleto")}>
            <Eye className="w-4 h-4" /> Ver análisis completo
          </Boton>
          <Boton variant="gold" onClick={() => setScreen("guiaPresentacion")}>
            <ListChecks className="w-4 h-4" /> Guía de presentación
          </Boton>
        </div>
      </ScreenWrap>
    );
  }

  // ---------- ANÁLISIS COMPLETO ----------
  if (screen === "perfilCompleto" && perfilIA) {
    return (
      <ScreenWrap>
        <TopBar title="Análisis completo" onBack={() => setScreen("perfilRapido")} />
        <div className="px-5 space-y-4 flex-1 pb-4">
          <div className="grid grid-cols-2 gap-3">
            <MiniCard label="Motivador principal" valor={perfilIA.primaryMotivator} />
            <MiniCard label="Motivador secundario" valor={perfilIA.secondaryMotivator} />
            <MiniCard label="Nivel de interés" valor={perfilIA.interestLevel} />
            <MiniCard label="Sensibilidad al precio" valor={perfilIA.priceSensitivity} />
          </div>
          <Seccion titulo="Necesidad detectada" texto={perfilIA.mainNeed} />
          <Seccion titulo="Resumen" texto={perfilIA.customerSummary} />
          <ListaTarjetas titulo="Qué enfatizar" items={perfilIA.emphasisPoints} color="green" />
          <ListaTarjetas titulo="Evitar" items={perfilIA.avoidTopics} color="red" />
          <ListaTarjetas titulo="Preguntas recomendadas" items={perfilIA.questionsToAsk} color="green" />
          <ListaTarjetas titulo="Posibles objeciones" items={perfilIA.likelyConcerns} color="red" />
          <ListaTarjetas titulo="Contenido recomendado" items={perfilIA.recommendedContent} color="green" />
        </div>
        <div className="px-5 py-6">
          <Boton onClick={() => setScreen("resultado")}>Registrar resultado de la visita</Boton>
        </div>
      </ScreenWrap>
    );
  }

  // ---------- GUÍA DE PRESENTACIÓN ----------
  if (screen === "guiaPresentacion" && perfilIA) {
    return (
      <ScreenWrap>
        <TopBar title="Guía de presentación" onBack={() => setScreen("perfilRapido")} />
        <div className="px-5 flex-1 space-y-4">
          <Seccion titulo="Empieza por" texto={`Lo que más le importa a esta familia: ${perfilIA.primaryMotivator}.`} />
          <ListaTarjetas titulo="Conecta con" items={(perfilIA.emphasisPoints || []).slice(0, 3)} color="green" />
          <ListaTarjetas titulo="Haz estas preguntas" items={(perfilIA.questionsToAsk || []).slice(0, 2)} color="green" />
          <ListaTarjetas titulo="Observa" items={[
            infoInterna.relevantPeoplePresent === "Falta pareja" || infoInterna.relevantPeoplePresent === "Falta usuario principal"
              ? "Falta una persona clave — considera reagendar el cierre"
              : `Interés cuando hables de ${perfilIA.primaryMotivator || "su prioridad"}`,
            "Reacción al mencionar precio o forma de pago",
            infoInterna.cookPresent === "No" ? "La persona que cocina no está — dirige el contenido a quien sí decide" : "Participación de la pareja",
          ].slice(0, 3)} color="green" />
          <ListaTarjetas titulo="Posibles objeciones" items={(perfilIA.likelyConcerns || []).slice(0, 2)} color="red" />
          <p className="text-xs text-gray-400">Copiloto, no guion — adáptala a la conversación real.</p>
        </div>
        <div className="px-5 py-6">
          <Boton onClick={() => setScreen("resultado")}>Registrar resultado de la visita</Boton>
        </div>
      </ScreenWrap>
    );
  }

  // ---------- RESULTADO ----------
  if (screen === "resultado") {
    return (
      <ScreenWrap>
        {Toast}
        <TopBar title="Resultado de la visita" onBack={() => setScreen(perfilIA ? "perfilRapido" : "infoInterna")} />
        <div className="px-5 flex-1 space-y-3">
          <button onClick={() => setScreen("compra")} className="w-full p-5 rounded-2xl bg-green-50 border-2 border-green-200 flex items-center gap-3">
            <CheckCircle2 className="w-7 h-7 text-green-600" />
            <span className="font-bold text-green-800 text-lg">Compró</span>
          </button>
          <button onClick={() => { setResultadoTipo("pending"); setScreen("pendiente"); }} className="w-full p-5 rounded-2xl bg-orange-50 border-2 border-orange-200 flex items-center gap-3">
            <HelpCircle className="w-7 h-7 text-orange-600" />
            <span className="font-bold text-orange-800 text-lg">Pendiente</span>
          </button>
          <button onClick={() => { setResultadoTipo("lost"); setScreen("pendiente"); }} className="w-full p-5 rounded-2xl bg-gray-100 border-2 border-gray-200 flex items-center gap-3">
            <XCircle className="w-7 h-7 text-gray-500" />
            <span className="font-bold text-gray-700 text-lg">No compró</span>
          </button>
        </div>
      </ScreenWrap>
    );
  }

  // ---------- COMPRA ----------
  if (screen === "compra") {
    return (
      <ScreenWrap>
        {Toast}
        <TopBar title="Detalles de la compra" onBack={() => setScreen("resultado")} />
        <div className="px-5 space-y-3 flex-1">
          <Campo label="Producto / set" value={compraData.producto} onChange={(v) => setCompraData({ ...compraData, producto: v })} placeholder="Set completo 12 piezas" />
          <Campo label="Monto aproximado" value={compraData.monto} onChange={(v) => setCompraData({ ...compraData, monto: v })} placeholder="$1,850" />
        </div>
        <div className="px-5 pb-8">
          <Boton variant="gold" onClick={registrarCompra} disabled={procesando}>
            {procesando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Guardar y crear plan de fidelización
          </Boton>
        </div>
      </ScreenWrap>
    );
  }

  // ---------- PLAN FIDELIZACIÓN ----------
  if (screen === "planFidelizacion") {
    return (
      <ScreenWrap>
        {Toast}
        <TopBar title="Plan de fidelización" />
        <div className="px-5 flex-1 space-y-3">
          {(planFidelizacion || []).map((p) => (
            <div key={p.dia} className="flex gap-3 bg-white border border-gray-100 rounded-xl p-4">
              <div className="w-12 h-12 rounded-full bg-green-800 text-white flex flex-col items-center justify-center text-xs font-bold shrink-0">
                <span>{p.dia}</span>
                <span className="text-[8px] font-normal">día{p.dia > 1 ? "s" : ""}</span>
              </div>
              <div>
                <p className="font-semibold text-sm text-green-950">{p.titulo}</p>
                <p className="text-xs text-gray-500 mt-0.5">{p.accion}</p>
              </div>
            </div>
          ))}
          <p className="text-xs text-gray-400">Cada punto ya quedó guardado como seguimiento real con su fecha — los verás en la pestaña Seguimientos.</p>
        </div>
        <div className="px-5 py-6">
          <Boton onClick={irADashboard}>Finalizar</Boton>
        </div>
      </ScreenWrap>
    );
  }

  // ---------- MOTIVO ----------
  if (screen === "pendiente") {
    return (
      <ScreenWrap>
        {Toast}
        <TopBar title={resultadoTipo === "lost" ? "Motivo — no compró" : "Motivo — pendiente"} onBack={() => setScreen("resultado")} />
        <div className="px-5 flex-1">
          <p className="text-sm text-gray-500 mb-3">¿Cuál fue el motivo principal?</p>
          <div className="space-y-2">
            {MOTIVOS.map((m) => (
              <button key={m} onClick={() => setMotivoPendiente(m)}
                className={`w-full text-left px-4 py-3.5 rounded-xl border-2 font-medium transition ${motivoPendiente === m ? "border-green-800 bg-green-50 text-green-900" : "border-gray-100 bg-white text-gray-700"}`}>
                {m}
              </button>
            ))}
          </div>
        </div>
        <div className="px-5 pb-8">
          <Boton variant="gold" onClick={generarSeguimiento} disabled={!motivoPendiente || procesando}>
            {procesando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Generar seguimiento
          </Boton>
        </div>
      </ScreenWrap>
    );
  }

  // ---------- SEGUIMIENTO GENERADO ----------
  if (screen === "seguimientoGenerado") {
    return (
      <ScreenWrap>
        {Toast}
        <TopBar title="Seguimiento" onBack={() => setScreen("pendiente")} />
        <div className="px-5 flex-1 space-y-4">
          {seguimientoIA ? (
            <>
              <Seccion titulo="Objetivo del próximo contacto" texto={seguimientoIA.objective} />
              <Seccion titulo="Enfoque recomendado" texto={seguimientoIA.recommendedApproach} />
              <ListaTarjetas titulo="Contenido recomendado" items={seguimientoIA.recommendedContent} color="green" />
              {seguimientoIA.suggestedMessage && (
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
                  <p className="text-xs font-semibold text-gray-500 mb-2">MENSAJE SUGERIDO</p>
                  <p className="text-sm text-gray-800">{seguimientoIA.suggestedMessage}</p>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-500">No pudimos generar sugerencias de IA ahora — el seguimiento se crea igual y puedes escribir el mensaje tú.</p>
          )}
          <div className="bg-green-50 border border-green-100 rounded-xl p-4">
            <p className="text-sm font-semibold text-green-900 mb-2">Contactar en</p>
            <div className="flex items-center gap-3">
              {[1, 2, 3, 5, 7, 14].map((d) => (
                <button key={d} onClick={() => setDiasSeguimiento(d)}
                  className={`w-10 h-10 rounded-full text-sm font-bold ${diasSeguimiento === d ? "bg-green-800 text-white" : "bg-white border border-gray-200 text-gray-600"}`}>
                  {d}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">días — tú tienes la última palabra sobre la fecha.</p>
          </div>
        </div>
        <div className="px-5 pb-8 space-y-2">
          <Boton onClick={confirmarSeguimiento} disabled={procesando}>
            {procesando ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Guardar seguimiento
          </Boton>
          {resultadoTipo === "lost" && (
            <Boton variant="ghost" onClick={marcarSinSeguimiento} disabled={procesando}>No hacer seguimiento activo</Boton>
          )}
        </div>
      </ScreenWrap>
    );
  }

  // ---------- CLIENTES ----------
  if (screen === "clientes") {
    return (
      <Shell active="clientes" setScreen={setScreen}>
        {Toast}
        <TopBar title="Clientes" />
        <div className="px-5 space-y-2 pb-24">
          {clientes === null ? (
            <SkeletonLista />
          ) : clientes.length === 0 ? (
            <div className="bg-white rounded-xl p-6 border border-gray-100 text-center">
              <p className="text-sm text-gray-500 mb-3">Aún no tienes clientes.</p>
              <button onClick={() => { limpiarFlujo(); setScreen("nuevaVisita"); }} className="text-sm font-semibold text-green-800">Crear primera visita</button>
            </div>
          ) : clientes.map((c) => (
            <button key={c.id} onClick={() => abrirFicha(c)}
              className="w-full bg-white rounded-xl p-4 border border-gray-100 flex items-center gap-3 text-left">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-800 font-semibold text-sm shrink-0">
                {(c.firstName || "?")[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-gray-900 truncate">{c.firstName} {c.lastName || ""}</p>
                <p className="text-xs text-gray-500 truncate">{c.phone}{c.familySize ? ` · ${c.familySize} integrantes` : ""}</p>
              </div>
              <Badge className={COLOR_ESTADO[c.status] || COLOR_ESTADO.new}>{ETIQUETA_ESTADO[c.status] || "Nuevo"}</Badge>
            </button>
          ))}
        </div>
      </Shell>
    );
  }

  // ---------- FICHA ----------
  if (screen === "fichaCliente" && fichaCliente) {
    const c = fichaCliente;
    return (
      <ScreenWrap>
        {Toast}
        <TopBar title={`${c.firstName} ${c.lastName || ""}`} onBack={() => setScreen("clientes")} />
        <div className="px-5 space-y-4 flex-1 pb-6">
          <div className="bg-green-50 border border-green-100 rounded-2xl p-4 grid grid-cols-2 gap-3">
            <MiniCard label="Estado" valor={ETIQUETA_ESTADO[c.status] || "Nuevo"} />
            <MiniCard label="Teléfono" valor={c.phone} />
            <MiniCard label="Familia" valor={c.familySize ? `${c.familySize} integrantes` : "—"} />
            <MiniCard label="Creado" valor={fmtDia(tsToDate(c.createdAt))} />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Historial</p>
            {fichaTimeline === null ? (
              <SkeletonLista />
            ) : fichaTimeline.length === 0 ? (
              <p className="text-sm text-gray-400">Sin eventos todavía.</p>
            ) : (
              <div className="space-y-3">
                {fichaTimeline.map((t, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-2.5 h-2.5 rounded-full bg-green-700 mt-1.5" />
                      {i < fichaTimeline.length - 1 && <div className="w-px flex-1 bg-gray-200" />}
                    </div>
                    <div className="pb-3">
                      <p className="text-xs text-gray-400">{fmtFecha(t.fecha)}</p>
                      <p className="text-sm text-gray-800">{t.texto}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </ScreenWrap>
    );
  }

  // ---------- SEGUIMIENTOS ----------
  if (screen === "seguimientos") {
    const ahora = new Date();
    return (
      <Shell active="seguimientos" setScreen={setScreen}>
        {Toast}
        <TopBar title="Seguimientos" />
        <div className="px-5 space-y-2 pb-24">
          {followups === null ? (
            <SkeletonLista />
          ) : followups.length === 0 ? (
            <div className="bg-white rounded-xl p-6 border border-gray-100 text-center">
              <p className="text-sm text-gray-500">No tienes seguimientos pendientes. 🎉</p>
            </div>
          ) : followups.map((s) => {
            const c = clientePorId(s.customerId);
            const fecha = tsToDate(s.scheduledAt);
            const vencido = fecha && fecha < ahora && fecha.toDateString() !== ahora.toDateString();
            const wa = c?.phone ? `https://wa.me/${toWhatsAppNumber(c.phone)}?text=${encodeURIComponent((s.suggestedMessage || "").replace("{nombre}", c?.firstName || ""))}` : null;
            return (
              <div key={s.id} className="bg-white rounded-xl p-4 border border-gray-100">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-semibold text-sm text-gray-900">{c ? `${c.firstName} ${c.lastName || ""}` : "Cliente"}</p>
                  <Badge className={vencido ? "text-red-700 bg-red-50 border-red-200" : "text-orange-700 bg-orange-50 border-orange-200"}>
                    {fmtDia(fecha)}
                  </Badge>
                </div>
                <p className="text-xs text-gray-500 mb-2">{s.objective || s.type}{s.reason ? ` · ${s.reason}` : ""}</p>
                {s.suggestedMessage && <p className="text-xs text-gray-700 mb-3 line-clamp-2">{s.suggestedMessage}</p>}
                {waLogFollowup === s.id ? (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-2">¿Qué ocurrió?</p>
                    <div className="flex flex-wrap gap-1.5">
                      {["Mensaje enviado", "Respondió", "No respondió", "Reagendar", "Compró", "No interesado"].map((a) => (
                        <button key={a} onClick={() => registrarInteraccion(s, a)}
                          className="px-3 py-1.5 rounded-full bg-green-50 border border-green-200 text-xs font-medium text-green-800">
                          {a}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={() => { navigator.clipboard?.writeText(s.suggestedMessage || ""); mostrarToast("Mensaje copiado"); }}
                      className="flex-1 py-2 rounded-lg bg-gray-100 text-xs font-semibold text-gray-700 flex items-center justify-center gap-1">
                      <Copy className="w-3 h-3" /> Copiar
                    </button>
                    {wa && (
                      <a href={wa} target="_blank" rel="noreferrer" onClick={() => setWaLogFollowup(s.id)}
                        className="flex-1 py-2 rounded-lg bg-orange-500 text-xs font-semibold text-green-950 flex items-center justify-center gap-1">
                        <MessageCircle className="w-3 h-3" /> WhatsApp
                      </a>
                    )}
                    <button onClick={async () => { await completeFollowup(ctx, s.id); mostrarToast("Seguimiento completado"); }}
                      className="flex-1 py-2 rounded-lg bg-green-800 text-xs font-semibold text-white flex items-center justify-center gap-1">
                      <Check className="w-3 h-3" /> Hecho
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Shell>
    );
  }

  return null;
}

function Shell({ children, active, setScreen }) {
  return (
    <div className="min-h-screen bg-gray-50 max-w-md mx-auto flex flex-col">
      <div className="bg-green-950 pb-2">{children}</div>
      <NavInline active={active} setScreen={setScreen} />
    </div>
  );
}

function ScreenWrap({ children }) {
  return <div className="min-h-screen bg-white max-w-md mx-auto flex flex-col">{children}</div>;
}

function NavInline({ active, setScreen }) {
  const items = [
    { id: "dashboard", label: "Inicio", icon: Home },
    { id: "clientes", label: "Clientes", icon: Users },
    { id: "seguimientos", label: "Seguim.", icon: Calendar },
  ];
  return (
    <div className="fixed bottom-0 max-w-md w-full bg-white border-t border-gray-100 flex justify-around py-2">
      {items.map(({ id, label, icon: Icon }) => (
        <button key={id} onClick={() => setScreen(id)} aria-label={label} className="flex flex-col items-center gap-0.5 px-4 py-1">
          <Icon className={`w-5 h-5 ${active === id ? "text-green-800" : "text-gray-400"}`} />
          <span className={`text-[10px] font-medium ${active === id ? "text-green-800" : "text-gray-400"}`}>{label}</span>
        </button>
      ))}
    </div>
  );
}

function Campo({ label, value, onChange, placeholder, type = "text" }) {
  return (
    <div>
      <label className="text-xs font-semibold text-gray-500 mb-1 block">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full border-2 border-gray-100 rounded-xl p-3.5 text-base text-gray-800 focus:border-green-800 focus:outline-none" />
    </div>
  );
}

function MiniCard({ label, valor }) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-3">
      <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">{label}</p>
      <p className="text-sm font-bold text-green-950 capitalize">{valor || "—"}</p>
    </div>
  );
}

function Seccion({ titulo, texto }) {
  if (!texto) return null;
  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase mb-1">{titulo}</p>
      <p className="text-sm text-gray-800">{texto}</p>
    </div>
  );
}

function ListaTarjetas({ titulo, items, color }) {
  if (!items || items.length === 0) return null;
  const colors = {
    green: "bg-green-50 text-green-800 border-green-100",
    red: "bg-red-50 text-red-800 border-red-100",
  };
  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase mb-2">{titulo}</p>
      <div className="space-y-1.5">
        {items.map((it, i) => (
          <div key={i} className={`text-sm px-3 py-2 rounded-lg border ${colors[color]}`}>{it}</div>
        ))}
      </div>
    </div>
  );
}

function SkeletonLista() {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-white rounded-xl p-4 border border-gray-100 animate-pulse">
          <div className="h-3.5 bg-gray-100 rounded w-1/2 mb-2" />
          <div className="h-3 bg-gray-100 rounded w-3/4" />
        </div>
      ))}
    </div>
  );
}

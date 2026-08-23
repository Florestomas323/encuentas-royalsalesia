"use client";

import { useState } from "react";
import {
  Home, Users, Calendar, Plus, ChevronRight, Mic,
  Loader2, MessageCircle, Copy, Check, ArrowLeft,
  Clock, AlertCircle, Sparkles, Search,
  CheckCircle2, XCircle, HelpCircle, Eye, ListChecks
} from "lucide-react";

// ---------- ENCUESTA (claves semánticas) ----------
const PREGUNTAS = [
  { key: "food_perception", texto: "¿Qué considera que hace principalmente cuando come?", tipo: "single", opciones: ["Se alimenta", "Se nutre", "Ambas", "No está seguro"], requerida: false },
  { key: "favorite_meal", texto: "¿Cuál es el plato o comida favorita de su familia?", tipo: "texto", requerida: false },
  { key: "primary_cook", texto: "¿Quién cocina principalmente en el hogar?", tipo: "single", opciones: ["Yo", "Mi pareja", "Ambos", "Otro"], requerida: false },
  { key: "cooking_frequency", texto: "¿Cuántos días por semana cocinan en casa?", tipo: "single", opciones: ["1–2 días", "3–4 días", "5–6 días", "Todos los días"], requerida: true },
  { key: "wants_healthier_habits", texto: "¿Les gustaría mejorar sus hábitos de alimentación?", tipo: "single", opciones: ["Sí", "No", "Tal vez"], requerida: true },
  { key: "cooking_health_importance", texto: "¿Considera importante la forma en que se preparan los alimentos para la salud de su familia?", tipo: "single", opciones: ["Muy importante", "Importante", "Poco importante", "No lo había pensado"], requerida: true },
  { key: "cooking_priorities", texto: "¿Qué factores son más importantes al momento de cocinar?", tipo: "multi", opciones: ["Organización", "Rapidez", "Facilidad de limpieza", "Preservación de los alimentos", "Sabor", "Economía", "Salud", "Practicidad", "Durabilidad"], requerida: true },
  { key: "monthly_food_budget", texto: "¿Cuánto aproximadamente invierte su familia mensualmente en alimentos?", tipo: "numero", requerida: true },
  { key: "family_priority", texto: "¿Cuál de estas áreas representa mayor prioridad actualmente para su familia?", tipo: "single", opciones: ["Bienestar y salud", "Economía y ahorro", "Calidad de vida", "Tiempo y practicidad", "Alimentación de los hijos", "Otro"], requerida: true },
  { key: "decision_maker", texto: "¿Quién participa en la decisión de compra?", tipo: "single", opciones: ["Persona entrevistada", "Pareja", "Ambos", "Otro", "Desconocido"], requerida: false },
  { key: "decision_maker_present", texto: "¿La persona que toma la decisión está presente en la visita?", tipo: "single", opciones: ["Sí", "No"], requerida: false },
];

const CAMPOS_OBLIGATORIOS = PREGUNTAS.filter((p) => p.requerida).map((p) => p.key);

const MOTIVOS = ["Precio", "Debe consultarlo con su pareja", "Quiere pensarlo", "Financiamiento", "No vio suficiente necesidad", "Quiere comparar", "No era el momento", "Otro"];

const CLIENTES_DEMO = [
  {
    id: "c1", nombre: "María González", telefono: "+1 254 555 0142", familia: 4, motivador: "Salud familiar",
    estado: "pending", oportunidad: "Alta", objecion: "Precio", proximoSeguimiento: "Mañana",
    timeline: [
      { fecha: "22 Ago", evento: "Nueva visita" },
      { fecha: "22 Ago", evento: "Encuesta completada" },
      { fecha: "22 Ago", evento: "Perfil IA generado" },
      { fecha: "22 Ago", evento: "Resultado: Pendiente — Precio" },
      { fecha: "24 Ago", evento: "Seguimiento programado" },
    ],
  },
  {
    id: "c2", nombre: "Carlos Rodríguez", telefono: "+1 254 555 0198", familia: 3, motivador: "Economía y ahorro",
    estado: "purchased", oportunidad: "Alta", objecion: null, proximoSeguimiento: null,
    timeline: [
      { fecha: "20 Ago", evento: "Nueva visita" },
      { fecha: "20 Ago", evento: "Encuesta completada" },
      { fecha: "20 Ago", evento: "Perfil IA generado" },
      { fecha: "20 Ago", evento: "Resultado: Compró" },
      { fecha: "21 Ago", evento: "Plan de fidelización iniciado" },
    ],
  },
  {
    id: "c3", nombre: "Ana López", telefono: "+1 254 555 0176", familia: 5, motivador: "Tiempo y practicidad",
    estado: "pending", oportunidad: "Media", objecion: "Quiere pensarlo", proximoSeguimiento: "Hoy",
    timeline: [
      { fecha: "21 Ago", evento: "Nueva visita" },
      { fecha: "21 Ago", evento: "Encuesta completada" },
      { fecha: "21 Ago", evento: "Resultado: Pendiente — Quiere pensarlo" },
      { fecha: "22 Ago", evento: "WhatsApp enviado" },
    ],
  },
];

const SEGUIMIENTOS_DEMO = [
  { id: "s1", cliente: "María González", motivador: "Salud familiar", motivo: "Precio", accion: "Enviar opciones de financiamiento", fecha: "Mañana", estado: "proximo" },
  { id: "s2", cliente: "Ana López", motivador: "Tiempo y practicidad", motivo: "Quiere pensarlo", accion: "Llamar y resolver dudas", fecha: "Hoy", estado: "hoy" },
];

// ---------- CAPA DE IA (aislada — lista para moverse a un backend real) ----------
// Nota: hoy esta función llama directo a la API desde el navegador porque es un
// artifact de demostración de un solo archivo. En la versión Next.js real, esta
// misma función se convierte en una llamada a /api/ai/* y la key vive solo en el servidor.
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
  const clean = text.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}

function promptPerfilCliente({ respuestas, observaciones }) {
  // No se envían datos identificables (nombre, teléfono, dirección) — solo la encuesta anónima.
  return `Eres un asistente de análisis comercial para asesores de venta directa de utensilios de cocina premium. Analiza esta encuesta y responde ÚNICAMENTE con un JSON válido, sin backticks, en español. Usa "unknown" en interestLevel o priceSensitivity si no hay información suficiente — nunca inventes. No infieras capacidad económica, no hagas afirmaciones médicas, no sugieras presión psicológica.

Encuesta (claves semánticas): ${JSON.stringify(respuestas)}
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

// ---------- REGLAS PROGRAMADAS: score de oportunidad ----------
// No depende de la IA — se calcula solo con señales de la encuesta y de la visita.
function calcularScore(respuestas) {
  let puntos = 0;
  if (respuestas.wants_healthier_habits === "Sí") puntos += 2;
  else if (respuestas.wants_healthier_habits === "Tal vez") puntos += 1;
  if (respuestas.cooking_health_importance === "Muy importante") puntos += 2;
  else if (respuestas.cooking_health_importance === "Importante") puntos += 1;
  if (respuestas.cooking_frequency === "Todos los días" || respuestas.cooking_frequency === "5–6 días") puntos += 1;
  if (respuestas.decision_maker_present === "Sí") puntos += 2;
  else if (respuestas.decision_maker_present === "No") puntos -= 2;
  if (respuestas.family_priority && respuestas.family_priority !== "Otro") puntos += 1;
  if ((respuestas.cooking_priorities || []).length >= 3) puntos += 1;

  if (puntos >= 5) return { nivel: "Alta", color: "text-green-700 bg-green-50 border-green-200" };
  if (puntos >= 2) return { nivel: "Media", color: "text-orange-700 bg-orange-50 border-orange-200" };
  return { nivel: "Baja", color: "text-gray-600 bg-gray-100 border-gray-200" };
}

// ¿Vale la pena seguimiento si no compró? — recomendación por reglas, el vendedor puede cambiarla.
function recomendarSeguimientoLost(score) {
  if (score.nivel === "Alta") return "Sí, seguimiento corto";
  if (score.nivel === "Media") return "Sí, reactivar más adelante";
  return "No hacer seguimiento activo";
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

function TopBar({ title, onBack }) {
  return (
    <div className="flex items-center gap-3 px-5 pt-6 pb-4">
      {onBack && (
        <button onClick={onBack} className="p-2 -ml-2 rounded-full active:bg-green-50">
          <ArrowLeft className="w-5 h-5 text-green-900" />
        </button>
      )}
      <h1 className="text-lg font-bold text-green-950">{title}</h1>
    </div>
  );
}

function Badge({ children, className = "" }) {
  return <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold border ${className}`}>{children}</span>;
}

const PROSPECTO_VACIO = { nombre: "", telefono: "", integrantes: "" };

export default function RoyalSalesAI() {
  const [screen, setScreen] = useState("dashboard");
  const [prospecto, setProspecto] = useState(PROSPECTO_VACIO);
  const [qIndex, setQIndex] = useState(0);
  const [respuestas, setRespuestas] = useState({});
  const [observaciones, setObservaciones] = useState("");
  const [loadingIA, setLoadingIA] = useState(false);
  const [perfilIA, setPerfilIA] = useState(null);
  const [errorIA, setErrorIA] = useState(null);
  const [compraData, setCompraData] = useState({ producto: "", monto: "" });
  const [planFidelizacion, setPlanFidelizacion] = useState(null);
  const [resultadoTipo, setResultadoTipo] = useState(null); // "pending" | "lost"
  const [motivoPendiente, setMotivoPendiente] = useState("");
  const [seguimientoIA, setSeguimientoIA] = useState(null);
  const [seguimientoLostRecomendado, setSeguimientoLostRecomendado] = useState(null);
  const [copiado, setCopiado] = useState(false);
  const [clientes, setClientes] = useState(CLIENTES_DEMO);
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);

  const pregunta = PREGUNTAS[qIndex];
  const score = calcularScore(respuestas);
  const camposFaltantes = CAMPOS_OBLIGATORIOS.filter((k) => {
    const v = respuestas[k];
    return v === undefined || v === "" || (Array.isArray(v) && v.length === 0);
  });

  function irADashboard() {
    setScreen("dashboard");
    setProspecto(PROSPECTO_VACIO);
    setQIndex(0);
    setRespuestas({});
    setObservaciones("");
    setPerfilIA(null);
    setErrorIA(null);
    setCompraData({ producto: "", monto: "" });
    setPlanFidelizacion(null);
    setResultadoTipo(null);
    setMotivoPendiente("");
    setSeguimientoIA(null);
  }

  function setRespuestaSingle(val) {
    setRespuestas((r) => ({ ...r, [pregunta.key]: val }));
  }
  function toggleMulti(val) {
    setRespuestas((r) => {
      const actual = r[pregunta.key] || [];
      const nuevo = actual.includes(val) ? actual.filter((x) => x !== val) : [...actual, val];
      return { ...r, [pregunta.key]: nuevo };
    });
  }

  async function analizarConIA() {
    if (camposFaltantes.length > 0) return;
    setScreen("analizando");
    setLoadingIA(true);
    setErrorIA(null);
    try {
      const perfil = await llamarIA(promptPerfilCliente({ respuestas, observaciones }));
      setPerfilIA(perfil);
      setScreen("perfilRapido");
    } catch (e) {
      setErrorIA("No pudimos generar el análisis en este momento.");
      setScreen("errorAnalisis");
    } finally {
      setLoadingIA(false);
    }
  }

  async function generarPlanFidelizacion() {
    setLoadingIA(true);
    try {
      const prompt = `Genera contenido personalizado (no fechas, esas ya las define el sistema) para un plan de fidelización. Responde ÚNICAMENTE con JSON, sin backticks, en español.

Perfil: ${JSON.stringify(perfilIA)}
Producto comprado: ${compraData.producto || "set de cocina"}
Plato favorito: ${respuestas.favorite_meal || "no especificado"}

Formato: {"contenido": {"dia1":"", "dia3":"", "dia7":"", "dia15":"", "dia30":"", "dia45":"", "dia60":""}}`;
      const res = await llamarIA(prompt);
      // Los días del calendario los define el sistema, no la IA — solo personaliza el texto.
      const dias = [1, 3, 7, 15, 30, 45, 60];
      const titulos = { 1: "Bienvenida", 3: "Consejo de uso", 7: "Receta personalizada", 15: "Tip de mantenimiento", 30: "Seguimiento de satisfacción", 45: "Solicitud de referidos", 60: "Producto complementario" };
      const plan = dias.map((d) => ({ dia: d, titulo: titulos[d], accion: res.contenido?.[`dia${d}`] || "" }));
      setPlanFidelizacion(plan);
      setScreen("planFidelizacion");
    } catch (e) {
      setErrorIA("No pudimos generar el plan en este momento.");
    } finally {
      setLoadingIA(false);
    }
  }

  async function generarSeguimiento() {
    setLoadingIA(true);
    try {
      const prompt = `Un prospecto quedó "${resultadoTipo === "lost" ? "sin comprar" : "pendiente"}". Genera diagnóstico y seguimiento. Responde ÚNICAMENTE con JSON, sin backticks, en español. El mensaje de WhatsApp debe ser cálido, breve, sin presión.

Motivo: ${motivoPendiente}
Perfil: ${JSON.stringify(perfilIA)}

Formato:
{"objecion_principal": "", "estrategia": "", "contactar_en_dias": 2, "contenido_recomendado": ["", ""], "mensaje_whatsapp": ""}`;
      const res = await llamarIA(prompt);
      setSeguimientoIA(res);
      if (resultadoTipo === "lost") setSeguimientoLostRecomendado(recomendarSeguimientoLost(score));
      setScreen("seguimientoGenerado");
    } catch (e) {
      setErrorIA("No pudimos generar el seguimiento en este momento.");
    } finally {
      setLoadingIA(false);
    }
  }

  // ---------- DASHBOARD ----------
  if (screen === "dashboard") {
    return (
      <Shell active="dashboard" setScreen={setScreen}>
        <div className="px-5 pt-6 pb-2">
          <p className="text-green-300 text-sm">Buenos días,</p>
          <h1 className="text-2xl font-bold text-white">Tomás</h1>
        </div>
        <div className="px-5 -mt-1 grid grid-cols-4 gap-2 mb-5">
          {[["3", "Visitas"], ["1", "Ventas"], ["2", "Pendientes"], ["2", "Seguim."]].map(([n, l]) => (
            <div key={l} className="bg-white/10 rounded-xl py-3 text-center">
              <p className="text-white font-bold text-lg">{n}</p>
              <p className="text-green-200 text-[10px]">{l}</p>
            </div>
          ))}
        </div>
        <div className="bg-gray-50 rounded-t-[2rem] flex-1 px-5 pt-6 pb-24">
          <Boton variant="gold" onClick={() => setScreen("nuevaVisita")} className="mb-6">
            <Plus className="w-5 h-5" /> Nueva visita
          </Boton>
          <p className="font-bold text-green-950 mb-3">Prioridad hoy</p>
          <div className="space-y-2 mb-6">
            {SEGUIMIENTOS_DEMO.map((s) => (
              <div key={s.id} className="bg-white rounded-xl p-4 border border-gray-100 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center text-green-800 font-semibold text-sm">
                  {s.cliente[0]}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm text-gray-900">{s.cliente}</p>
                  <p className="text-xs text-gray-500">{s.motivador} · {s.motivo}</p>
                </div>
                <Badge className={s.estado === "hoy" ? "text-orange-700 bg-orange-50 border-orange-200" : "text-gray-600 bg-gray-100 border-gray-200"}>{s.fecha}</Badge>
              </div>
            ))}
          </div>
          <p className="font-bold text-green-950 mb-3">Actividad reciente</p>
          <div className="space-y-2">
            <div className="bg-white rounded-xl p-4 border border-gray-100 text-sm text-gray-600 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600" /> Carlos Rodríguez compró un set completo
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-100 text-sm text-gray-600 flex items-center gap-2">
              <Clock className="w-4 h-4 text-orange-600" /> Ana López quedó pendiente — quiere pensarlo
            </div>
          </div>
        </div>
      </Shell>
    );
  }

  // ---------- NUEVA VISITA ----------
  if (screen === "nuevaVisita") {
    return (
      <ScreenWrap>
        <TopBar title="Nueva visita" onBack={() => setScreen("dashboard")} />
        <div className="px-5 space-y-3">
          <Campo label="Nombre y apellido" value={prospecto.nombre} onChange={(v) => setProspecto({ ...prospecto, nombre: v })} placeholder="María González" />
          <Campo label="Teléfono" value={prospecto.telefono} onChange={(v) => setProspecto({ ...prospecto, telefono: v })} placeholder="+1 254 555 0100" />
          <Campo label="Integrantes de la familia" value={prospecto.integrantes} onChange={(v) => setProspecto({ ...prospecto, integrantes: v })} placeholder="4" type="number" />
        </div>
        <div className="px-5 mt-8">
          <Boton onClick={() => setScreen("encuesta")} disabled={!prospecto.nombre}>
            Comenzar encuesta <ChevronRight className="w-4 h-4" />
          </Boton>
        </div>
      </ScreenWrap>
    );
  }

  // ---------- ENCUESTA ----------
  if (screen === "encuesta") {
    const respuesta = respuestas[pregunta.key];
    const puedeAvanzar =
      pregunta.tipo === "texto" ? true :
      pregunta.tipo === "numero" ? true :
      pregunta.tipo === "multi" ? true :
      !!respuesta;
    const esUltima = qIndex === PREGUNTAS.length - 1;
    return (
      <ScreenWrap>
        <TopBar title="Encuesta" onBack={() => (qIndex === 0 ? setScreen("nuevaVisita") : setQIndex(qIndex - 1))} />
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
              className="w-full border-2 border-gray-100 rounded-xl p-4 text-gray-800 focus:border-green-800 focus:outline-none" rows={3} placeholder="Escribe aquí..." />
          )}
          {pregunta.tipo === "numero" && (
            <div>
              <input type="number" value={respuesta || ""} onChange={(e) => setRespuestaSingle(e.target.value)}
                className="w-full border-2 border-gray-100 rounded-xl p-4 text-gray-800 focus:border-green-800 focus:outline-none" placeholder="$ mensual" />
              {respuesta && (
                <p className="text-xs text-gray-400 mt-2">
                  Anual: ${(respuesta * 12).toLocaleString()} · 10 años: ${(respuesta * 12 * 10).toLocaleString()} (uso interno)
                </p>
              )}
            </div>
          )}
        </div>
        <div className="px-5 pb-8 pt-4">
          <Boton
            onClick={() => (esUltima ? setScreen("observaciones") : setQIndex(qIndex + 1))}
            disabled={pregunta.requerida && !puedeAvanzar}
          >
            {esUltima ? "Continuar" : "Siguiente"} <ChevronRight className="w-4 h-4" />
          </Boton>
        </div>
      </ScreenWrap>
    );
  }

  // ---------- OBSERVACIONES ----------
  if (screen === "observaciones") {
    return (
      <ScreenWrap>
        <TopBar title="Observaciones de la visita" onBack={() => setQIndex(PREGUNTAS.length - 1) || setScreen("encuesta")} />
        <div className="px-5 flex-1">
          <p className="text-sm text-gray-500 mb-3">Ejemplo: "Ella mostró mucho interés en salud. Él está más preocupado por el precio. Tienen tres hijos y cocinan prácticamente todos los días."</p>
          <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value.slice(0, 600))}
            className="w-full border-2 border-gray-100 rounded-xl p-4 text-gray-800 focus:border-green-800 focus:outline-none" rows={6} placeholder="Escribe lo que notaste en la visita..." />
          <p className="text-[11px] text-gray-400 mt-1 text-right">{observaciones.length}/600</p>

          {camposFaltantes.length > 0 && (
            <div className="mt-2 p-4 bg-orange-50 border border-orange-100 rounded-xl">
              <p className="text-sm font-semibold text-orange-800 mb-1">Faltan {camposFaltantes.length} respuestas para poder analizar</p>
              <p className="text-xs text-orange-700">Vuelve a la encuesta y completa las preguntas marcadas como obligatorias.</p>
            </div>
          )}
        </div>
        <div className="px-5 pb-8">
          <Boton variant="gold" onClick={analizarConIA} disabled={camposFaltantes.length > 0}>
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

  // ---------- ERROR EN ANÁLISIS ----------
  if (screen === "errorAnalisis") {
    return (
      <ScreenWrap>
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
          <AlertCircle className="w-10 h-10 text-orange-500 mb-4" />
          <p className="font-bold text-green-950 text-lg mb-1">No pudimos generar el análisis</p>
          <p className="text-sm text-gray-500 mb-6">Puedes intentarlo de nuevo o seguir sin análisis IA — igual puedes registrar el resultado de la visita.</p>
          <div className="w-full space-y-2">
            <Boton onClick={analizarConIA}>Reintentar</Boton>
            <Boton variant="ghost" onClick={() => setScreen("resultado")}>Continuar sin análisis</Boton>
          </div>
        </div>
      </ScreenWrap>
    );
  }

  // ---------- VISTA RÁPIDA (para usar durante la visita) ----------
  if (screen === "perfilRapido" && perfilIA) {
    return (
      <ScreenWrap>
        <TopBar title="Perfil del cliente" onBack={() => setScreen("observaciones")} />
        <div className="px-5 flex-1 space-y-4">
          <div className="bg-green-50 border border-green-100 rounded-2xl p-5 text-center">
            <p className="text-xs font-semibold text-green-700 uppercase mb-1">Motivador principal</p>
            <p className="text-2xl font-bold text-green-950">{perfilIA.primaryMotivator}</p>
          </div>
          <div className={`rounded-xl p-4 border flex items-center justify-between ${score.color}`}>
            <span className="font-semibold text-sm">Nivel de oportunidad</span>
            <span className="font-bold">{score.nivel}</span>
          </div>
          <Seccion titulo="Necesidad principal" texto={perfilIA.mainNeed} />
          <ListaTarjetas titulo="Enfócate en" items={(perfilIA.emphasisPoints || []).slice(0, 3)} color="green" />
          <ListaTarjetas titulo="Pregunta ahora" items={(perfilIA.questionsToAsk || []).slice(0, 2)} color="green" />
          <ListaTarjetas titulo="Posible preocupación" items={(perfilIA.likelyConcerns || []).slice(0, 2)} color="red" />
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
          <p className="text-xs text-gray-400 bg-gray-50 rounded-lg p-3">
            Sugerencias generadas por IA para orientar tu conversación — la decisión es siempre tuya.
          </p>
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

  // ---------- GUÍA DE PRESENTACIÓN (generada localmente, sin nueva llamada IA) ----------
  if (screen === "guiaPresentacion" && perfilIA) {
    return (
      <ScreenWrap>
        <TopBar title="Guía de presentación" onBack={() => setScreen("perfilRapido")} />
        <div className="px-5 flex-1 space-y-4">
          <Seccion titulo="Comienza por" texto={`Menciona lo que más le importa a esta familia: ${perfilIA.primaryMotivator}.`} />
          <ListaTarjetas titulo="3 beneficios prioritarios" items={(perfilIA.emphasisPoints || []).slice(0, 3)} color="green" />
          <ListaTarjetas titulo="Preguntas pendientes" items={(perfilIA.questionsToAsk || []).slice(0, 2)} color="green" />
          <ListaTarjetas titulo="Señales que debes observar" items={[
            respuestas.decision_maker_present === "No" ? "La persona que decide no está presente — considera reagendar el cierre" : "Interés cuando hables de " + (perfilIA.primaryMotivator || "su prioridad"),
            "Reacción cuando menciones precio o forma de pago",
          ]} color="green" />
          <ListaTarjetas titulo="Posibles objeciones" items={(perfilIA.likelyConcerns || []).slice(0, 3)} color="red" />
          <p className="text-xs text-gray-400">Esta guía es un copiloto, no un guion — adáptala a la conversación real.</p>
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
        <TopBar title="Resultado de la visita" onBack={() => setScreen(perfilIA ? "perfilRapido" : "observaciones")} />
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
        <TopBar title="Detalles de la compra" onBack={() => setScreen("resultado")} />
        <div className="px-5 space-y-3 flex-1">
          <Campo label="Producto / set" value={compraData.producto} onChange={(v) => setCompraData({ ...compraData, producto: v })} placeholder="Set completo 12 piezas" />
          <Campo label="Monto aproximado" value={compraData.monto} onChange={(v) => setCompraData({ ...compraData, monto: v })} placeholder="$1,850" />
        </div>
        <div className="px-5 pb-8">
          <Boton variant="gold" onClick={generarPlanFidelizacion} disabled={loadingIA}>
            {loadingIA ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Crear plan de fidelización
          </Boton>
        </div>
      </ScreenWrap>
    );
  }

  // ---------- PLAN FIDELIZACION ----------
  if (screen === "planFidelizacion") {
    return (
      <ScreenWrap>
        <TopBar title="Plan de fidelización" onBack={() => setScreen("compra")} />
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
          <p className="text-xs text-gray-400">Las fechas las calcula el sistema — la IA solo personalizó el contenido.</p>
        </div>
        <div className="px-5 py-6">
          <Boton onClick={irADashboard}>Finalizar</Boton>
        </div>
      </ScreenWrap>
    );
  }

  // ---------- PENDIENTE / NO COMPRÓ (motivo) ----------
  if (screen === "pendiente") {
    return (
      <ScreenWrap>
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
          <Boton variant="gold" onClick={generarSeguimiento} disabled={!motivoPendiente || loadingIA}>
            {loadingIA ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Generar seguimiento con IA
          </Boton>
        </div>
      </ScreenWrap>
    );
  }

  // ---------- SEGUIMIENTO GENERADO ----------
  if (screen === "seguimientoGenerado" && seguimientoIA) {
    const telefono = (prospecto.telefono || "").replace(/[^0-9]/g, "");
    const waLink = `https://wa.me/${telefono}?text=${encodeURIComponent(seguimientoIA.mensaje_whatsapp || "")}`;
    return (
      <ScreenWrap>
        <TopBar title="Seguimiento sugerido" onBack={() => setScreen("pendiente")} />
        <div className="px-5 flex-1 space-y-4">
          {resultadoTipo === "lost" && seguimientoLostRecomendado && (
            <div className="bg-green-50 border border-green-100 rounded-xl p-4">
              <p className="text-xs font-semibold text-green-700 uppercase mb-1">Recomendación (por reglas, no IA)</p>
              <p className="text-sm font-bold text-green-950">{seguimientoLostRecomendado}</p>
              <p className="text-xs text-gray-500 mt-1">Basado en el nivel de oportunidad detectado ({score.nivel}). Tú decides si aplica.</p>
            </div>
          )}
          <Seccion titulo="Objeción principal" texto={seguimientoIA.objecion_principal} />
          <Seccion titulo="Estrategia" texto={seguimientoIA.estrategia} />
          <div className="bg-green-50 border border-green-100 rounded-xl p-4 flex items-center justify-between">
            <span className="text-sm font-semibold text-green-900">Contactar en</span>
            <span className="font-bold text-green-900">{seguimientoIA.contactar_en_dias} días</span>
          </div>
          <ListaTarjetas titulo="Contenido recomendado" items={seguimientoIA.contenido_recomendado} color="green" />
          <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
            <p className="text-xs font-semibold text-gray-500 mb-2">MENSAJE SUGERIDO</p>
            <p className="text-sm text-gray-800">{seguimientoIA.mensaje_whatsapp}</p>
          </div>
        </div>
        <div className="px-5 pb-8 space-y-2">
          <div className="flex gap-2">
            <Boton variant="ghost" onClick={() => { navigator.clipboard?.writeText(seguimientoIA.mensaje_whatsapp || ""); setCopiado(true); setTimeout(() => setCopiado(false), 1500); }}>
              {copiado ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {copiado ? "Copiado" : "Copiar"}
            </Boton>
            <a href={waLink} target="_blank" rel="noreferrer" className="w-full">
              <Boton variant="gold"><MessageCircle className="w-4 h-4" /> Abrir WhatsApp</Boton>
            </a>
          </div>
          <Boton onClick={irADashboard}>Finalizar</Boton>
        </div>
      </ScreenWrap>
    );
  }

  // ---------- CLIENTES ----------
  if (screen === "clientes") {
    const etiquetaEstado = { pending: "Pendiente", purchased: "Compró", lost: "No compró" };
    const colorEstado = {
      pending: "text-orange-700 bg-orange-50 border-orange-200",
      purchased: "text-green-700 bg-green-50 border-green-200",
      lost: "text-gray-600 bg-gray-100 border-gray-200",
    };
    return (
      <Shell active="clientes" setScreen={setScreen}>
        <TopBar title="Clientes" />
        <div className="px-5 mb-3">
          <div className="flex items-center gap-2 bg-white border border-gray-100 rounded-xl px-4 py-3">
            <Search className="w-4 h-4 text-gray-400" />
            <input placeholder="Buscar cliente..." className="flex-1 outline-none text-sm text-gray-700" />
          </div>
        </div>
        <div className="px-5 space-y-2 pb-24">
          {clientes.map((c) => (
            <button key={c.id} onClick={() => { setClienteSeleccionado(c); setScreen("fichaCliente"); }}
              className="w-full bg-white rounded-xl p-4 border border-gray-100 flex items-center gap-3 text-left">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-800 font-semibold text-sm shrink-0">
                {c.nombre[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-gray-900 truncate">{c.nombre}</p>
                <p className="text-xs text-gray-500">{c.motivador} · {c.familia} integrantes</p>
              </div>
              <Badge className={colorEstado[c.estado]}>{etiquetaEstado[c.estado]}</Badge>
            </button>
          ))}
        </div>
      </Shell>
    );
  }

  // ---------- FICHA DEL CLIENTE ----------
  if (screen === "fichaCliente" && clienteSeleccionado) {
    const c = clienteSeleccionado;
    const etiquetaEstado = { pending: "Pendiente", purchased: "Compró", lost: "No compró" };
    return (
      <ScreenWrap>
        <TopBar title={c.nombre} onBack={() => setScreen("clientes")} />
        <div className="px-5 space-y-4 flex-1 pb-6">
          <div className="bg-green-50 border border-green-100 rounded-2xl p-4 grid grid-cols-2 gap-3">
            <MiniCard label="Estado" valor={etiquetaEstado[c.estado]} />
            <MiniCard label="Motivador" valor={c.motivador} />
            <MiniCard label="Oportunidad" valor={c.oportunidad} />
            <MiniCard label="Próximo seguimiento" valor={c.proximoSeguimiento || "—"} />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Historial</p>
            <div className="space-y-3">
              {c.timeline.map((t, i) => (
                <div key={i} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-2.5 h-2.5 rounded-full bg-green-700 mt-1.5" />
                    {i < c.timeline.length - 1 && <div className="w-px flex-1 bg-gray-200" />}
                  </div>
                  <div className="pb-3">
                    <p className="text-xs text-gray-400">{t.fecha}</p>
                    <p className="text-sm text-gray-800">{t.evento}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </ScreenWrap>
    );
  }

  // ---------- SEGUIMIENTOS ----------
  if (screen === "seguimientos") {
    return (
      <Shell active="seguimientos" setScreen={setScreen}>
        <TopBar title="Seguimientos" />
        <div className="px-5 flex gap-2 mb-4 overflow-x-auto">
          {["Hoy", "Próximos", "Vencidos", "Completados"].map((f, i) => (
            <span key={f} className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ${i === 0 ? "bg-green-800 text-white" : "bg-white border border-gray-200 text-gray-600"}`}>{f}</span>
          ))}
        </div>
        <div className="px-5 space-y-2 pb-24">
          {SEGUIMIENTOS_DEMO.map((s) => (
            <div key={s.id} className="bg-white rounded-xl p-4 border border-gray-100">
              <div className="flex items-center justify-between mb-1">
                <p className="font-semibold text-sm text-gray-900">{s.cliente}</p>
                <Badge className="text-orange-700 bg-orange-50 border-orange-200">{s.fecha}</Badge>
              </div>
              <p className="text-xs text-gray-500 mb-3">{s.motivador} · Motivo: {s.motivo}</p>
              <p className="text-xs text-gray-700 mb-3">Próxima acción: {s.accion}</p>
              <div className="flex gap-2">
                <button className="flex-1 py-2 rounded-lg bg-gray-100 text-xs font-semibold text-gray-700 flex items-center justify-center gap-1">
                  <Copy className="w-3 h-3" /> Copiar mensaje
                </button>
                <button className="flex-1 py-2 rounded-lg bg-orange-500 text-xs font-semibold text-green-950 flex items-center justify-center gap-1">
                  <MessageCircle className="w-3 h-3" /> WhatsApp
                </button>
              </div>
            </div>
          ))}
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
        <button key={id} onClick={() => setScreen(id)} className="flex flex-col items-center gap-0.5 px-4 py-1">
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
        className="w-full border-2 border-gray-100 rounded-xl p-3.5 text-gray-800 focus:border-green-800 focus:outline-none" />
    </div>
  );
}

function MiniCard({ label, valor }) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-3">
      <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">{label}</p>
      <p className="text-sm font-bold text-green-950 capitalize">{valor}</p>
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

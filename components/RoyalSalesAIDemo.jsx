"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Home, Users, Calendar, Plus, ChevronRight, Loader2, MessageCircle, Copy, Check,
  ArrowLeft, Clock, AlertCircle, Sparkles, Search, CheckCircle2, XCircle, HelpCircle,
  Eye, ListChecks, PlayCircle, CloudUpload, Cloud, Menu, User, Building2, Settings,
  LogOut, TrendingUp, FlaskConical, CalendarClock, ClipboardList, Trash2, Package, Boxes,
  Wrench, BookOpen,
} from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { auth } from "@/lib/firebase/client";
import { normalizePhone, toWhatsAppNumber, isValidPhone } from "@/lib/phone";
import { calculateOpportunity, OPPORTUNITY_LABELS } from "@/lib/scoring/opportunityScore";
import {
  findCustomerByPhone, createCustomer, updateCustomer, subscribeCustomers, getCustomer,
  createVisit, updateVisit, findInProgressVisit,
  saveSurveyResponses, saveAiProfile, saveVisitResult, savePurchaseWithItems,
  createFollowup, subscribeFollowups, completeFollowup,
  logInteraction, getRecentVisits, tsToDate,
  softDeleteCustomer, repairFollowupsForDeletedCustomers,
  repairLoyaltyContentForNonCookingCustomers,
  createPostSaleServices, subscribePostSaleServices, completePostSaleService, assignPostSaleServiceToMe,
} from "@/lib/db/services";
import {
  subscribeProductContent, getApprovedProductContent,
  createProductContent, updateProductContent, deleteProductContent, setProductContentStatus,
} from "@/lib/db/catalog";
import { CATALOGO_ESTATICO } from "@/lib/catalog/static";
import {
  classifyFamily, capabilitiesFor, buildLoyaltyPlan, allowedContentTypes,
  serviceTypeLabel, serviceChecklistFor, tituloDe, serviceCoordinationMessage,
} from "@/lib/catalog/classify";
import { getOrgCurrency, formatCurrency, parseAmount } from "@/lib/format/currency";
import { fetchCustomer360 } from "@/lib/customer/lifecycle";
import ProductPicker from "@/components/catalog/ProductPicker";
import ConfirmSheet from "@/components/ui/ConfirmSheet";
import ServiceSheet from "@/components/services/ServiceSheet";
import ContentLibrary from "@/components/content/ContentLibrary";
import Customer360 from "@/components/customer/Customer360";
import AttentionPanel from "@/components/dashboard/AttentionPanel";
import CopilotWidget from "@/components/copilot/CopilotWidget";

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

// El plan de fidelización ahora es DINÁMICO según la categoría del producto
// comprado (ver lib/catalog/classify.ts → buildLoyaltyPlan).

// ---------- CAPA DE IA (llama a nuestro backend, nunca al proveedor directamente) ----------
// La API key vive solo en el servidor. Aquí solo enviamos el token de sesión de
// Firebase para que el backend verifique quién hace la llamada.
async function llamarIA(auth, payload) {
  const token = await auth.currentUser.getIdToken();
  const res = await fetch("/api/ai/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Error de IA");
  return data.result;
}

function Boton({ children, onClick, variant = "primary", className = "", disabled, type }) {
  const base = "w-full min-h-[52px] px-5 rounded-2xl font-display font-semibold text-[15px] flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98] disabled:opacity-45 disabled:pointer-events-none";
  const variants = {
    primary: "bg-brand-dark text-white shadow-card active:bg-brand-deep",
    gold: "bg-accent text-white shadow-cta active:brightness-95",
    accent: "bg-accent text-white shadow-cta active:brightness-95",
    secondary: "bg-brand/10 text-brand-dark active:bg-brand/15",
    ghost: "bg-card text-brand-dark border border-hairline shadow-soft active:bg-brand/5",
    danger: "bg-card text-danger border border-red-100 active:bg-red-50",
  };
  return (
    <button type={type} disabled={disabled} onClick={onClick} className={`${base} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
}

function TopBar({ title, onBack, right, subtitle }) {
  return (
    <header className="sticky top-0 z-20 bg-card/85 backdrop-blur-md">
      <div className="flex items-center gap-2 px-5 pt-5 pb-3">
        {onBack && (
          <button onClick={onBack} aria-label="Volver" className="grid place-items-center w-10 h-10 -ml-2 rounded-full text-brand-deep active:bg-brand/10">
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-[19px] font-display font-bold text-brand-deep truncate leading-tight text-balance">{title}</h1>
          {subtitle && <p className="text-xs text-muted truncate mt-0.5">{subtitle}</p>}
        </div>
        {right}
      </div>
    </header>
  );
}

function Badge({ children, className = "" }) {
  return <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${className}`}>{children}</span>;
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
  const { user, profile, signOut } = useAuth();
  const ctx = { uid: user?.uid, profile };

  const [screen, setScreen] = useState("dashboard");
  const [toast, setToast] = useState(null);
  const [busquedaCliente, setBusquedaCliente] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todos");
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
  const [waLogFollowup, setWaLogFollowup] = useState(null);

  // Fase A: catálogo, items de compra, eliminación y compras de la ficha.
  // Catálogo estático del repo: disponible al instante, sin conexión y sin seed.
  const productos = CATALOGO_ESTATICO;
  const [itemsCompra, setItemsCompra] = useState([]);
  const [confirmarEliminar, setConfirmarEliminar] = useState(null); // cliente a eliminar
  const [eliminando, setEliminando] = useState(false);

  // Fase B: servicios postventa pendientes + hoja de detalle.
  const [servicios, setServicios] = useState(null);
  const [servicioAbierto, setServicioAbierto] = useState(null);
  const [completandoServicio, setCompletandoServicio] = useState(false);
  const [perfilAbierto, setPerfilAbierto] = useState(false); // hoja de perfil/cerrar sesión

  // Fase C: contenido oficial por producto (biblioteca del distribuidor).
  const [contenidoProd, setContenidoProd] = useState([]);

  // Fase D: vista 360 del cliente (agregación de solo lectura).
  const [ficha360, setFicha360] = useState(null);

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

    const un4 = subscribePostSaleServices(ctx, setServicios, () => setServicios([]));
    // Biblioteca de contenido: solo el distribuidor/reviewer necesita el stream.
    const esGestor = profile?.role === "distributor" || profile?.role === "reviewer";
    const un5 = esGestor ? subscribeProductContent(ctx, setContenidoProd, () => setContenidoProd([])) : null;
    // Reparaciones idempotentes de datos previos (no borran historial):
    // 1) cancelar seguimientos de clientes eliminados;
    // 2) quitar recetas de planes de clientes sin productos culinarios.
    repairFollowupsForDeletedCustomers(ctx).catch((e) => console.log("[v0] repair followups:", e?.message));
    repairLoyaltyContentForNonCookingCustomers(ctx).catch((e) => console.log("[v0] repair recetas:", e?.message));
    return () => { un1(); un2(); un4(); un5 && un5(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, profile?.organizationId]);

  // Moneda de la organización (hoy COP/es-CO). Nunca se decide por contexto.
  const orgCurrency = useMemo(() => getOrgCurrency(profile), [profile]);

  // Seguimientos visibles = pendientes cuyo cliente existe, es de la misma
  // organización y NO está eliminado. Protege contra seguimientos huérfanos y
  // es la única fuente de verdad para dashboard, KPIs y listados.
  const followupsVisibles = useMemo(() => {
    if (!Array.isArray(followups)) return followups; // null mientras carga
    const activos = new Set((clientes || []).map((c) => c.id));
    return followups.filter((f) => {
      if (f.isActive === false) return false;
      if (f.cancelledReason === "customer_deleted") return false;
      // Si aún no cargó la lista de clientes, no ocultamos por precaución.
      if (!Array.isArray(clientes)) return true;
      return activos.has(f.customerId);
    });
  }, [followups, clientes]);

  // Servicios postventa pendientes cuyo cliente no esté eliminado.
  const serviciosPendientes = useMemo(() => {
    if (!Array.isArray(servicios)) return servicios; // null mientras carga
    const activos = new Set((clientes || []).map((c) => c.id));
    return servicios.filter((s) => (Array.isArray(clientes) ? activos.has(s.customerId) : true));
  }, [servicios, clientes]);

  // Conjunto de customerId con al menos un servicio pendiente (aviso en ficha).
  const clientesConServicio = useMemo(
    () => new Set((serviciosPendientes || []).map((s) => s.customerId)),
    [serviciosPendientes],
  );

  const numServiciosPendientes = Array.isArray(serviciosPendientes) ? serviciosPendientes.length : 0;
  const esManager = profile?.role === "distributor" || profile?.role === "reviewer";

  async function completarServicioHandler(pasos) {
    if (!servicioAbierto) return;
    setCompletandoServicio(true);
    try {
      await completePostSaleService(ctx, servicioAbierto.id, pasos);
      setServicioAbierto(null);
      mostrarToast("Servicio completado. Se activó el plan de fidelización.");
    } catch (e) {
      mostrarToast(e?.message || "No se pudo completar el servicio.");
    } finally {
      setCompletandoServicio(false);
    }
  }

  async function asignarmeServicioHandler() {
    if (!servicioAbierto) return;
    setCompletandoServicio(true);
    try {
      await assignPostSaleServiceToMe(ctx, servicioAbierto.id);
      setServicioAbierto((s) => (s ? { ...s, assignedSalespersonId: user.uid } : s));
      mostrarToast("Servicio asignado a ti.");
    } catch (e) {
      mostrarToast(e?.message || "No se pudo reasignar.");
    } finally {
      setCompletandoServicio(false);
    }
  }

  // ---------- Fase C: biblioteca de contenido ----------
  // Genera borradores con IA respetando las capacidades del producto y los
  // guarda como draft. El distribuidor luego aprueba/rechaza/edita.
  async function generarContenidoHandler(producto) {
    const caps = capabilitiesFor(producto);
    const items = await llamarIA(auth, {
      type: "productContentDraft",
      productName: producto.name,
      productCategory: producto.category || "",
      supportsRecipes: caps.supportsRecipes === true,
      allowedContentTypes: allowedContentTypes(caps),
      currency: orgCurrency.currency,
      locale: orgCurrency.locale,
    });
    const lista = Array.isArray(items?.items) ? items.items : [];
    if (!lista.length) throw new Error("La IA no generó contenido.");
    for (const it of lista) {
      await createProductContent(ctx, {
        productId: producto.id,
        productName: producto.name,
        type: it.type,
        title: it.title,
        content: it.content,
        status: "draft",
        source: "ai",
      });
    }
    mostrarToast(`${lista.length} borrador${lista.length > 1 ? "es" : ""} generado${lista.length > 1 ? "s" : ""}.`);
  }

  async function aprobarContenidoHandler(id) {
    await setProductContentStatus(ctx, id, "approved");
    mostrarToast("Contenido aprobado. La IA ya puede usarlo.");
  }
  async function rechazarContenidoHandler(id) {
    await setProductContentStatus(ctx, id, "rejected");
    mostrarToast("Contenido rechazado.");
  }
  async function editarContenidoHandler(id, data) {
    await updateProductContent(ctx, id, data);
    mostrarToast("Contenido actualizado.");
  }
  async function eliminarContenidoHandler(id) {
    await deleteProductContent(ctx, id);
    mostrarToast("Contenido eliminado.");
  }

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
      const perfil = await llamarIA(auth, {
        type: "customerProfile",
        responses: respuestas,
        internalInfo: infoInterna,
        observations: observaciones,
        familySize: prospecto.familySize,
      });
      setPerfilIA(perfil);
      saveAiProfile(ctx, visitId, customerId, perfil).catch(() => {});
      setScreen("perfilRapido");
    } catch (e) {
      setErrorIA(e?.message || "No pudimos generar el análisis en este momento.");
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
      // Nombres de producto: del catálogo (items) o del texto libre de respaldo.
      const nombresProductos = itemsCompra.length
        ? itemsCompra.map((it) => it.productNameSnapshot)
        : (compraData.producto ? [compraData.producto] : []);
      const resumenProducto = nombresProductos.join(", ");

      // Familias de producto (clasificador = fuente de verdad, NO la IA).
      // Cada item se resuelve contra el catálogo; si es texto libre, por nombre.
      const catalogoPorId = new Map((productos || []).map((p) => [p.id, p]));
      const productosComprados = itemsCompra.length
        ? itemsCompra.map((it) => catalogoPorId.get(it.productId) || { name: it.productNameSnapshot })
        : (compraData.producto ? [{ name: compraData.producto }] : []);
      const familias = productosComprados.map((p) => classifyFamily(p));
      // Plan de fidelización dinámico según la categoría comprada.
      const planPasos = buildLoyaltyPlan(familias.length ? familias : ["cooking"]);
      // Capacidades combinadas (OR) y si algún producto admite recetas.
      const capsCombinadas = productosComprados.reduce((acc, p) => {
        const c = capabilitiesFor(p);
        return {
          supportsRecipes: acc.supportsRecipes || c.supportsRecipes,
          supportsUsageTips: acc.supportsUsageTips || c.supportsUsageTips,
          supportsMaintenance: acc.supportsMaintenance || c.supportsMaintenance,
          supportsCare: acc.supportsCare || c.supportsCare,
          supportsInstallationTips: acc.supportsInstallationTips || c.supportsInstallationTips,
        };
      }, { supportsRecipes: false, supportsUsageTips: false, supportsMaintenance: false, supportsCare: false, supportsInstallationTips: false });
      const admiteRecetas = capsCombinadas.supportsRecipes;
      const categoriaRep = productosComprados.map((p) => p.category).filter(Boolean).join(", ") || "no especificada";

      // Contenido OFICIAL aprobado de los productos comprados (Fase C): única
      // fuente técnica para la IA. Si no hay, la IA no inventa datos.
      let officialContent = [];
      try {
        const ids = [...new Set(itemsCompra.map((it) => it.productId).filter(Boolean))];
        const listas = await Promise.all(ids.map((id) => getApprovedProductContent(ctx, id)));
        officialContent = listas.flat().map((c) => ({ type: c.type, title: c.title, content: c.content }));
      } catch { /* sin contenido aprobado — la IA queda sin datos técnicos */ }

      let contenido = {};
      try {
        contenido = await llamarIA(auth, {
          type: "loyalty",
          profile: perfilIA,
          product: resumenProducto,
          favoriteMeal: respuestas.favoriteMeal,
          supportsRecipes: admiteRecetas,
          productCategory: categoriaRep,
          allowedContentTypes: allowedContentTypes(capsCombinadas),
          plan: planPasos.map((p) => ({ dia: p.dia, contentType: p.contentType })),
          officialContent,
          currency: orgCurrency.currency,
          locale: orgCurrency.locale,
        }) || {};
      } catch { /* plan sin personalización — no bloquea */ }

      // Productos que requieren servicio postventa (solo desde el catálogo).
      const serviceItems = itemsCompra
        .map((it) => catalogoPorId.get(it.productId))
        .filter((p) => p && p.requiresPostSaleService)
        .map((p) => ({
          productId: p.id,
          productName: p.name,
          serviceType: p.postSaleServiceType || "testing_training",
          keepPackagedUntilService: !!p.keepPackagedUntilService,
          checklist: serviceChecklistFor(p),
          suggestedMessage: "", // se completa abajo, cuando ya se conoce el nombre del cliente
        }));
      const requiereServicio = serviceItems.length > 0;
      const planData = planPasos.map((p) => ({ dia: p.dia, titulo: p.titulo, contentType: p.contentType }));

      const purchaseId = await savePurchaseWithItems(
        ctx, visitId, customerId,
        {
          amount: parseAmount(compraData.monto),
          amountText: compraData.monto || null,
          currency: orgCurrency.currency,
          products: nombresProductos,
          notes: "",
          hasPendingService: requiereServicio,
          // Con servicio pendiente, el plan queda EN ESPERA: se activa al
          // completar el último servicio (recordatorios desde esa fecha).
          pendingLoyalty: requiereServicio
            ? { active: true, plan: planData, contenido, supportsRecipes: admiteRecetas }
            : null,
        },
        itemsCompra,
      );
      await saveVisitResult(ctx, visitId, customerId, "purchased", {});
      await updateVisit(ctx, visitId, { status: "completed", completedAt: new Date(), outcome: "purchased" });
      await updateCustomer(ctx, customerId, { status: "purchased" });

      const plan = [];
      if (requiereServicio) {
        // Crear los servicios postventa; los seguimientos NO se agendan aún.
        // El nombre sale del formulario en memoria (prospecto): la lista de
        // clientes suscrita puede no haberse actualizado aún si el cliente se
        // creó hace un instante (condición de carrera que dejaba "Cliente").
        const cliActual = (clientes || []).find((c) => c.id === customerId);
        const nombreCli = (cliActual
          ? `${cliActual.firstName || ""} ${cliActual.lastName || ""}`
          : `${prospecto.firstName || ""} ${prospecto.lastName || ""}`).trim();
        const telefonoCli = cliActual?.phone || normalizePhone(prospecto.phone) || "";
        const itemsConMensaje = serviceItems.map((it) => ({
          ...it,
          suggestedMessage: serviceCoordinationMessage({
            customerName: nombreCli.split(" ")[0] || nombreCli,
            productName: it.productName,
            serviceType: it.serviceType,
            sellerName: profile?.firstName,
          }),
        }));
        await createPostSaleServices(ctx, {
          purchaseId, customerId, visitId, customerName: nombreCli, customerPhone: telefonoCli, items: itemsConMensaje,
        });
        for (const { dia, titulo } of planPasos) {
          plan.push({ dia, titulo, accion: contenido[`dia${dia}`] || "", pendiente: true });
        }
      } else {
        for (const { dia, titulo, contentType } of planPasos) {
          const scheduledAt = new Date(Date.now() + dia * 86400000);
          await createFollowup(ctx, {
            customerId, visitId, type: "loyalty",
            contentType, supportsRecipes: admiteRecetas,
            scheduledAt, objective: titulo,
            suggestedMessage: contenido[`dia${dia}`] || "",
          });
          plan.push({ dia, titulo, accion: contenido[`dia${dia}`] || "" });
        }
      }
      setPlanFidelizacion(plan);
      setItemsCompra([]);
      try { localStorage.removeItem(`rsai-draft-${visitId}`); } catch {}
      mostrarToast(plan.some((p) => p.pendiente) ? "Compra guardada. Programa el servicio postventa." : "Compra y plan guardados");
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
        ia = await llamarIA(auth, {
          type: "followup",
          outcome: resultadoTipo,
          reason: motivoPendiente,
          profile: perfilIA,
        });
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
  // Fase D: abre la ficha 360. Muestra el encabezado de inmediato y carga en
  // paralelo todo el contexto (compras, servicios, seguimientos, perfil IA...).
  async function abrirFicha(c) {
    setFichaCliente(c); setFicha360(null); setScreen("fichaCliente");
    try {
      const data = await fetchCustomer360(ctx, c.id);
      setFicha360(data);
    } catch {
      setFicha360({ error: true });
    }
  }

  // Recarga la ficha 360 tras una acción (p. ej. crear seguimiento).
  async function recargarFicha360() {
    if (!fichaCliente) return;
    try { setFicha360(await fetchCustomer360(ctx, fichaCliente.id)); } catch {}
  }

  // Crea un seguimiento manual para dentro de 3 días desde la ficha 360.
  async function abrirNuevoSeguimientoManual(cli) {
    if (!cli?.id) return;
    try {
      await createFollowup(ctx, {
        customerId: cli.id,
        type: "manual",
        scheduledAt: new Date(Date.now() + 3 * 86400000),
        objective: "Contactar al cliente",
        suggestedMessage: "",
      });
      mostrarToast("Seguimiento creado para dentro de 3 días.");
      recargarFicha360();
    } catch {
      mostrarToast("No se pudo crear el seguimiento.");
    }
  }

  // Abre WhatsApp con el mensaje sugerido de la próxima acción (si hay).
  function abrirWhatsAppCliente(cli, next) {
    if (!cli?.phone) { mostrarToast("Este cliente no tiene teléfono."); return; }
    const msg = (next?.detail || "").replace("{nombre}", cli.firstName || "");
    const url = `https://wa.me/${toWhatsAppNumber(cli.phone)}${msg ? `?text=${encodeURIComponent(msg)}` : ""}`;
    if (typeof window !== "undefined") window.open(url, "_blank", "noopener");
  }

  async function eliminarClienteConfirmado() {
    if (!confirmarEliminar || eliminando) return;
    setEliminando(true);
    try {
      await softDeleteCustomer(ctx, confirmarEliminar.id);
      setConfirmarEliminar(null);
      setFichaCliente(null);
      setFicha360(null);
      setScreen("clientes");
      mostrarToast("Cliente eliminado");
    } catch (e) {
      mostrarToast(e?.message || "No pudimos eliminar el cliente.");
    } finally {
      setEliminando(false);
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
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-brand-deep text-white text-sm font-medium px-4 py-2.5 rounded-full shadow-nav animate-rise">
      {toast}
    </div>
  ) : null;

  const IndicadorGuardado = visitId ? (
    <span className="flex items-center gap-1 text-[11px] font-medium text-muted">
      {guardando === "saving" ? <><CloudUpload className="w-3.5 h-3.5" /> Guardando…</> :
        guardando === "offline" ? <><Cloud className="w-3.5 h-3.5 text-accent" /> Pendiente</> :
          <><Check className="w-3.5 h-3.5 text-brand" /> Guardado</>}
    </span>
  ) : null;

  // Royal Copilot — se monta en las pantallas principales. En la ficha del
  // cliente le pasamos ese cliente como contexto activo; en el resto va sin
  // contexto. La navegación desde sus acciones reutiliza setScreen/abrirFicha.
  function navegarDesdeCopilot(pantalla, payload) {
    if (pantalla === "fichaCliente" && payload?.customerId) {
      const c = clientePorId(payload.customerId);
      if (c) { abrirFicha(c); return; }
    }
    // Lista blanca: solo navegamos a pantallas reales. Evita que una acción
    // inesperada del modelo deje la app en una pantalla inexistente (en blanco).
    const PANTALLAS_VALIDAS = ["dashboard", "clientes", "seguimientos", "servicios", "biblioteca"];
    if (typeof pantalla === "string" && PANTALLAS_VALIDAS.includes(pantalla)) setScreen(pantalla);
  }
  const Copilot = (
    <CopilotWidget
      getToken={() => auth.currentUser?.getIdToken()}
      customer={screen === "fichaCliente" ? fichaCliente : null}
      productos={productos}
      customerProducts={
        screen === "fichaCliente"
          ? (ficha360?.items || []).map((it) => ({
              id: it.productId,
              name: it.productNameSnapshot,
            }))
          : []
      }
      onNavigate={navegarDesdeCopilot}
      onToast={mostrarToast}
    />
  );

  // ---------- DASHBOARD ----------
  if (screen === "dashboard") {
    const seguimientosHoy = (followupsVisibles || []).filter((f) => {
      const d = tsToDate(f.scheduledAt);
      return d && d <= new Date(new Date().setHours(23, 59, 59, 999));
    });
    const abrirNuevaVisita = () => { limpiarFlujo(); setScreen("nuevaVisita"); };
    return (
      <Shell active="dashboard" setScreen={setScreen} onNueva={abrirNuevaVisita} serviciosBadge={numServiciosPendientes}>
        {Toast}
        {Copilot}
        <div className="bg-brand-deep rounded-b-[2rem] px-5 pt-7 pb-8">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-emerald-300/80 text-sm">Hola,</p>
              <h1 className="text-[26px] font-display font-bold text-white tracking-tight">{profile?.firstName || "Bienvenido"}</h1>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setPerfilAbierto(true)}
                aria-label="Perfil y ajustes"
                className="w-11 h-11 rounded-full bg-white/10 grid place-items-center active:bg-white/20 transition"
              >
                <Avatar name={profile?.firstName} className="w-11 h-11 text-base" />
              </button>
            </div>
          </div>
          {esManager && (
            <p className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-300/80">
              <Users className="w-3.5 h-3.5" /> Vista de equipo · toda la organización
            </p>
          )}
          <div className="mt-4 grid grid-cols-3 gap-2.5">
            <KpiCard icon={Home} valor={metricas?.visitasHoy ?? "—"} label={esManager ? "Visitas equipo" : "Visitas hoy"} />
            <KpiCard icon={TrendingUp} valor={metricas?.ventasHoy ?? "—"} label={esManager ? "Ventas equipo" : "Ventas hoy"} />
            <KpiCard icon={CalendarClock} valor={seguimientosHoy.length} label="Seguim. hoy" />
          </div>
        </div>

        <div className="flex-1 px-5 pt-5 pb-28 space-y-5">
          {visitaEnProgreso && (
            <button onClick={() => continuarVisita(visitaEnProgreso)}
              className="w-full p-4 rounded-2xl bg-accent-soft border border-accent/25 flex items-center gap-3 text-left shadow-soft active:scale-[0.99] transition">
              <span className="w-11 h-11 rounded-xl bg-accent/15 grid place-items-center shrink-0">
                <PlayCircle className="w-6 h-6 text-accent" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-display font-bold text-accent text-sm">Visita en progreso</p>
                <p className="text-xs text-accent/80">Toca para continuar donde quedaste</p>
              </div>
              <ChevronRight className="w-5 h-5 text-accent shrink-0" />
            </button>
          )}

          <Boton variant="gold" onClick={abrirNuevaVisita}>
            <Plus className="w-5 h-5" strokeWidth={2.6} /> Nueva visita
          </Boton>

          {/* Fase D: panel priorizado "Requiere atención" */}
          {followupsVisibles == null ? (
            <SkeletonLista />
          ) : (
            <AttentionPanel
              followups={followupsVisibles}
              servicios={servicios}
              clientePorId={clientePorId}
              onAbrirCliente={(id) => { const c = clientePorId(id); if (c) abrirFicha(c); else setScreen("seguimientos"); }}
              onVerSeguimientos={() => setScreen("seguimientos")}
              onVerServicios={() => setScreen("servicios")}
            />
          )}
        </div>
        {perfilAbierto && (
          <PerfilSheet
            nombre={[profile?.firstName, profile?.lastName].filter(Boolean).join(" ") || "Vendedor"}
            correo={user?.email || "—"}
            rol={profile?.role === "reviewer" ? "Cuenta de revisión" : (profile?.role === "distributor" || profile?.role === "manager") ? "Distribuidor" : "Vendedor"}
            firstName={profile?.firstName}
            esManager={esManager}
            onBiblioteca={() => { setPerfilAbierto(false); setScreen("biblioteca"); }}
            onCerrar={() => setPerfilAbierto(false)}
            onSignOut={signOut}
          />
        )}
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
      <div className="h-[100dvh] bg-white max-w-md mx-auto flex flex-col overflow-hidden">
        {Toast}
        {/* Zona fija superior: barra + progreso + PREGUNTA siempre visible */}
        <div className="shrink-0">
          <TopBar title="Encuesta" right={IndicadorGuardado}
            onBack={() => (qIndex === 0 ? irADashboard() : setQIndex(qIndex - 1))} />
          <div className="px-5 mb-3">
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-orange-500 rounded-full transition-all" style={{ width: `${((qIndex + 1) / PREGUNTAS.length) * 100}%` }} />
            </div>
            <p className="text-xs text-gray-400 mt-1">Pregunta {qIndex + 1} de {PREGUNTAS.length}{!pregunta.requerida && " · opcional"}</p>
          </div>
          <p className="px-5 pb-3 text-xl font-bold text-green-950 leading-snug">{pregunta.texto}</p>
        </div>
        {/* Zona con scroll propio: SOLO las opciones */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-4">
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
                  Anual: {formatCurrency(respuesta * 12, orgCurrency)} · 10 años: {formatCurrency(respuesta * 12 * 10, orgCurrency)} (uso interno)
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
        {/* Zona fija inferior: botón SIEMPRE visible, fuera del scroll */}
        <div className="shrink-0 px-5 pt-3 pb-6 bg-white border-t border-gray-100">
          <Boton onClick={() => (esUltima ? setScreen("infoInterna") : setQIndex(qIndex + 1))} disabled={!puedeAvanzar}>
            {esUltima ? "Continuar" : "Siguiente"} <ChevronRight className="w-4 h-4" />
          </Boton>
          {pregunta.requerida && !puedeAvanzar && (
            <p className="text-xs text-orange-600 text-center mt-2">Esta pregunta es necesaria para poder analizar al cliente.</p>
          )}
        </div>
      </div>
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
          <p className="text-sm text-gray-500 mb-4">Tu encuesta está guardada. Puedes reintentar o continuar sin análisis IA.</p>
          {errorIA && (
            <p className="text-xs text-gray-400 mb-4 break-all bg-gray-50 rounded-lg px-3 py-2 w-full">
              {`Detalle: ${errorIA}`}
            </p>
          )}
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
        <div className="px-5 space-y-4 flex-1 pb-4">
          <div>
            <p className="text-[13px] font-medium text-muted mb-2">Productos comprados</p>
            <ProductPicker
              products={productos}
              value={itemsCompra}
              onChange={setItemsCompra}
              allowFreeText
              freeText={compraData.producto}
              onFreeTextChange={(v) => setCompraData({ ...compraData, producto: v })}
            />
          </div>
          <Campo label="Monto aproximado (COP)" value={compraData.monto} onChange={(v) => setCompraData({ ...compraData, monto: v })} placeholder="$ 1.500.000" />
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
          {(planFidelizacion || []).some((p) => p.pendiente) && (
            <div className="flex items-start gap-2.5 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
              <Package className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" strokeWidth={2} />
              <p className="text-[13px] text-amber-800 leading-snug">
                Este producto requiere un servicio postventa (curado, prueba o instalación). El plan queda en espera y sus recordatorios comenzarán a contar cuando completes el servicio en la pestaña <span className="font-semibold">Servicios</span>.
              </p>
            </div>
          )}
          {(planFidelizacion || []).map((p) => (
            <div key={p.dia} className="flex gap-3 bg-white border border-gray-100 rounded-xl p-4">
              <div className={`w-12 h-12 rounded-full text-white flex flex-col items-center justify-center text-xs font-bold shrink-0 ${p.pendiente ? "bg-gray-400" : "bg-green-800"}`}>
                <span>{p.dia}</span>
                <span className="text-[8px] font-normal">día{p.dia > 1 ? "s" : ""}</span>
              </div>
              <div>
                <p className="font-semibold text-sm text-green-950">{p.titulo}</p>
                <p className="text-xs text-gray-500 mt-0.5">{p.accion}</p>
              </div>
            </div>
          ))}
          <p className="text-xs text-gray-400">
            {(planFidelizacion || []).some((p) => p.pendiente)
              ? "Los seguimientos se agendarán automáticamente al completar el servicio postventa."
              : "Cada punto ya quedó guardado como seguimiento real con su fecha — los verás en la pestaña Seguimientos."}
          </p>
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
    const abrirNuevaVisita = () => { limpiarFlujo(); setScreen("nuevaVisita"); };
    const q = busquedaCliente.trim().toLowerCase();
    const lista = (clientes || []).filter((c) => {
      const coincideEstado =
        filtroEstado === "todos" ? true :
        filtroEstado === "servicio" ? clientesConServicio.has(c.id) :
        (c.status || "new") === filtroEstado;
      const nombre = `${c.firstName || ""} ${c.lastName || ""} ${c.phone || ""}`.toLowerCase();
      return coincideEstado && (!q || nombre.includes(q));
    });
    const numConServicio = (clientes || []).filter((c) => clientesConServicio.has(c.id)).length;
    const chips = [
      ["todos", "Todos"],
      ["new", ETIQUETA_ESTADO.new || "Nuevo"],
      ["customer", ETIQUETA_ESTADO.customer || "Cliente"],
      ["pending", ETIQUETA_ESTADO.pending || "Pendiente"],
      ...(numConServicio > 0 ? [["servicio", "Con servicio"]] : []),
    ];
    return (
      <Shell active="clientes" setScreen={setScreen} onNueva={abrirNuevaVisita} serviciosBadge={numServiciosPendientes}>
        {Toast}
        {Copilot}
        <TopBar title="Clientes" subtitle={clientes ? `${clientes.length} en total` : undefined} />

        {clientes && clientes.length > 0 && (
          <div className="px-5 pb-3 space-y-3">
            <div className="flex items-center gap-2.5 bg-card border border-hairline rounded-2xl px-4 h-12 shadow-soft focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/10 transition">
              <Search className="w-[18px] h-[18px] text-muted/60 shrink-0" />
              <input
                value={busquedaCliente}
                onChange={(e) => setBusquedaCliente(e.target.value)}
                placeholder="Buscar por nombre o teléfono"
                className="flex-1 bg-transparent outline-none text-[15px] text-ink placeholder:text-muted/45"
              />
              {busquedaCliente && (
                <button onClick={() => setBusquedaCliente("")} aria-label="Limpiar búsqueda" className="text-muted/60">
                  <XCircle className="w-[18px] h-[18px]" />
                </button>
              )}
            </div>
            <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
              {chips.map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setFiltroEstado(id)}
                  className={`shrink-0 px-3.5 h-9 rounded-full text-[13px] font-medium border transition ${
                    filtroEstado === id ? "bg-brand-dark text-white border-brand-dark" : "bg-card text-muted border-hairline"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="px-5 space-y-2.5 pb-28">
          {clientes === null ? (
            <SkeletonLista />
          ) : clientes.length === 0 ? (
            <EmptyState
              icon={Users}
              titulo="Aún no tienes clientes"
              texto="Registra tu primera visita y el cliente aparecerá aquí automáticamente."
              action={<Boton variant="gold" onClick={abrirNuevaVisita}><Plus className="w-5 h-5" /> Crear primera visita</Boton>}
            />
          ) : lista.length === 0 ? (
            <EmptyState icon={Search} titulo="Sin resultados" texto="Prueba con otro nombre, teléfono o cambia el filtro de estado." />
          ) : lista.map((c) => (
            <button key={c.id} onClick={() => abrirFicha(c)}
              className="w-full bg-card rounded-2xl p-3.5 border border-hairline shadow-card flex items-center gap-3 text-left active:scale-[0.99] transition">
              <Avatar name={c.firstName} className="w-11 h-11 text-base" />
              <div className="flex-1 min-w-0">
                <p className="font-display font-semibold text-[15px] text-brand-deep truncate">{c.firstName} {c.lastName || ""}</p>
                <p className="text-[13px] text-muted truncate">{c.phone}{c.familySize ? ` · ${c.familySize} integrantes` : ""}</p>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <Badge className={COLOR_ESTADO[c.status] || COLOR_ESTADO.new}>{ETIQUETA_ESTADO[c.status] || "Nuevo"}</Badge>
                {clientesConServicio.has(c.id) && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700">
                    <Wrench className="w-3 h-3" /> Servicio
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </Shell>
    );
  }

  // ---------- FICHA 360 (Fase D) ----------
  if (screen === "fichaCliente" && fichaCliente) {
    const c = fichaCliente;
    const catMap = new Map((productos || []).map((p) => [p.id, p]));
    return (
      <ScreenWrap>
        {Toast}
        {Copilot}
        <TopBar title={`${c.firstName} ${c.lastName || ""}`} onBack={() => setScreen("clientes")} />
        <div className="flex-1">
          <Customer360
            data={ficha360}
            cliente={c}
            catalogoPorId={catMap}
            formatCurrency={formatCurrency}
            currency={orgCurrency.currency}
            locale={orgCurrency.locale}
            onNuevaVisita={() => { limpiarFlujo(); setScreen("nuevaVisita"); }}
            onNuevoSeguimiento={abrirNuevoSeguimientoManual}
            onWhatsApp={abrirWhatsAppCliente}
            onServicios={() => setScreen("servicios")}
            onEliminar={(cli) => setConfirmarEliminar(cli)}
          />
        </div>

        <ConfirmSheet
          open={!!confirmarEliminar}
          onClose={() => setConfirmarEliminar(null)}
          onConfirm={eliminarClienteConfirmado}
          loading={eliminando}
          title="¿Eliminar este cliente?"
          description="Se ocultará de tu lista de clientes. Su historial de visitas y compras se conserva y no se pierde."
          confirmLabel="Eliminar"
          cancelLabel="Cancelar"
          tone="danger"
        />
      </ScreenWrap>
    );
  }

  // ---------- SEGUIMIENTOS ----------
  if (screen === "seguimientos") {
    const ahora = new Date();
    return (
      <Shell active="seguimientos" setScreen={setScreen} onNueva={() => { limpiarFlujo(); setScreen("nuevaVisita"); }} serviciosBadge={numServiciosPendientes}>
        {Toast}
        <TopBar title="Seguimientos" subtitle={Array.isArray(followupsVisibles) && followupsVisibles.length > 0 ? `${followupsVisibles.length} pendientes` : undefined} />
        <div className="px-5 space-y-2.5 pb-28">
          {followupsVisibles == null ? (
            <SkeletonLista />
          ) : followupsVisibles.length === 0 ? (
            <EmptyState icon={CheckCircle2} titulo="Todo al día" texto="No tienes seguimientos pendientes. Cuando programes uno, aparecerá aquí." />
          ) : followupsVisibles.map((s) => {
            const c = clientePorId(s.customerId);
            const fecha = tsToDate(s.scheduledAt);
            const vencido = fecha && fecha < ahora && fecha.toDateString() !== ahora.toDateString();
            const wa = c?.phone ? `https://wa.me/${toWhatsAppNumber(c.phone)}?text=${encodeURIComponent((s.suggestedMessage || "").replace("{nombre}", c?.firstName || ""))}` : null;
            return (
              <Card key={s.id} className="p-4">
                <div className="flex items-center gap-3 mb-2">
                  <Avatar name={c?.firstName} className="w-10 h-10 text-sm" />
                  <div className="flex-1 min-w-0">
                    <p className="font-display font-semibold text-[15px] text-brand-deep truncate">{c ? `${c.firstName} ${c.lastName || ""}` : "Cliente"}</p>
                    <p className="text-[13px] text-muted truncate">{s.objective || s.type}{s.reason ? ` · ${s.reason}` : ""}</p>
                  </div>
                  <Badge className={vencido ? "text-danger bg-red-50 border-red-100" : "text-accent bg-accent-soft border-accent/15"}>
                    {fmtDia(fecha)}
                  </Badge>
                </div>
                {s.suggestedMessage && <p className="text-[13px] text-ink/75 mb-3 line-clamp-2 bg-surface rounded-xl px-3 py-2 border border-hairline">{s.suggestedMessage}</p>}
                {waLogFollowup === s.id ? (
                  <div>
                    <p className="text-[13px] font-semibold text-muted mb-2">¿Qué ocurrió?</p>
                    <div className="flex flex-wrap gap-2">
                      {["Mensaje enviado", "Respondió", "No respondió", "Reagendar", "Compró", "No interesado"].map((a) => (
                        <button key={a} onClick={() => registrarInteraccion(s, a)}
                          className="px-3.5 py-2 rounded-full bg-brand/[0.06] border border-brand/15 text-[13px] font-medium text-brand-dark active:bg-brand/10 transition min-h-[40px]">
                          {a}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={() => { navigator.clipboard?.writeText(s.suggestedMessage || ""); mostrarToast("Mensaje copiado"); }}
                      className="flex-1 min-h-[44px] rounded-xl bg-brand/[0.06] text-[13px] font-semibold text-brand-dark flex items-center justify-center gap-1.5">
                      <Copy className="w-4 h-4" /> Copiar
                    </button>
                    {wa && (
                      <a href={wa} target="_blank" rel="noreferrer" onClick={() => setWaLogFollowup(s.id)}
                        className="flex-1 min-h-[44px] rounded-xl bg-accent text-[13px] font-semibold text-white flex items-center justify-center gap-1.5 shadow-cta">
                        <MessageCircle className="w-4 h-4" /> WhatsApp
                      </a>
                    )}
                    <button onClick={async () => { await completeFollowup(ctx, s.id); mostrarToast("Seguimiento completado"); }}
                      className="flex-1 min-h-[44px] rounded-xl bg-brand-dark text-[13px] font-semibold text-white flex items-center justify-center gap-1.5">
                      <Check className="w-4 h-4" /> Hecho
                    </button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </Shell>
    );
  }

  // ---------- SERVICIOS POSTVENTA (Fase B) ----------
  if (screen === "servicios") {
    return (
      <Shell active="servicios" setScreen={setScreen} onNueva={() => { limpiarFlujo(); setScreen("nuevaVisita"); }} serviciosBadge={numServiciosPendientes}>
        {Toast}
        <TopBar title="Servicios postventa" subtitle={numServiciosPendientes > 0 ? `${numServiciosPendientes} pendiente${numServiciosPendientes > 1 ? "s" : ""}` : undefined} />
        <div className="px-5 space-y-2.5 pb-28">
          {serviciosPendientes == null ? (
            <SkeletonLista />
          ) : serviciosPendientes.length === 0 ? (
            <EmptyState icon={Wrench} titulo="Sin servicios pendientes" texto="Cuando vendas un producto que requiere curado, prueba o instalación, aparecerá aquí para que lo completes." />
          ) : serviciosPendientes.map((s) => {
            const c = clientePorId(s.customerId);
            const mio = s.assignedSalespersonId === user?.uid;
            return (
              <Card key={s.id} className="p-4">
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-xl bg-accent-soft grid place-items-center shrink-0">
                    <Package className="w-5 h-5 text-accent" strokeWidth={2} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-display font-semibold text-[15px] text-brand-deep truncate">{s.productName}</p>
                    <p className="text-[13px] text-muted truncate">
                      {c ? `${c.firstName} ${c.lastName || ""}` : s.customerName || "Cliente"} · {serviceTypeLabel(s.serviceType)}
                    </p>
                  </div>
                  {!mio && <Badge className="text-muted bg-surface border-hairline shrink-0">Otro vendedor</Badge>}
                </div>
                {s.keepPackagedUntilService && (
                  <p className="mt-2.5 text-[12px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                    Mantener empacado hasta completar el servicio.
                  </p>
                )}
                {(() => {
                  const telefonoSrv = s.customerPhone || c?.phone || "";
                  const nombreSrv = (c ? `${c.firstName || ""}` : (s.customerName || "").split(" ")[0]) || "";
                  const msgSrv = s.suggestedMessage || serviceCoordinationMessage({
                    customerName: nombreSrv, productName: s.productName,
                    serviceType: s.serviceType, sellerName: profile?.firstName,
                  });
                  const waSrv = telefonoSrv ? `https://wa.me/${toWhatsAppNumber(telefonoSrv)}?text=${encodeURIComponent(msgSrv)}` : null;
                  return (
                    <div className="mt-3 flex gap-2">
                      {waSrv && (
                        <a href={waSrv} target="_blank" rel="noreferrer"
                          className="flex-1 min-h-[44px] rounded-xl bg-accent text-[13px] font-semibold text-white flex items-center justify-center gap-1.5">
                          <MessageCircle className="w-4 h-4" /> Coordinar
                        </a>
                      )}
                      <button
                        onClick={() => { navigator.clipboard?.writeText(msgSrv); mostrarToast("Mensaje copiado"); }}
                        className="min-h-[44px] px-4 rounded-xl bg-surface border border-hairline text-[13px] font-semibold text-brand-deep flex items-center justify-center gap-1.5">
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })()}
                <button
                  onClick={() => setServicioAbierto(s)}
                  className="mt-2 w-full min-h-[44px] rounded-xl bg-brand-dark text-[13px] font-semibold text-white flex items-center justify-center gap-1.5"
                >
                  <ClipboardList className="w-4 h-4" /> Ver checklist
                </button>
              </Card>
            );
          })}
        </div>

        <ServiceSheet
          open={!!servicioAbierto}
          service={servicioAbierto}
          waLink={(() => {
            if (!servicioAbierto) return null;
            const cAb = clientePorId(servicioAbierto.customerId);
            const tel = servicioAbierto.customerPhone || cAb?.phone || "";
            if (!tel) return null;
            const msg = servicioAbierto.suggestedMessage || serviceCoordinationMessage({
              customerName: (cAb ? cAb.firstName : (servicioAbierto.customerName || "").split(" ")[0]) || "",
              productName: servicioAbierto.productName,
              serviceType: servicioAbierto.serviceType,
              sellerName: profile?.firstName,
            });
            return `https://wa.me/${toWhatsAppNumber(tel)}?text=${encodeURIComponent(msg)}`;
          })()}
          canComplete={!!servicioAbierto && (servicioAbierto.assignedSalespersonId === user?.uid || esManager)}
          isManager={esManager}
          loading={completandoServicio}
          onClose={() => setServicioAbierto(null)}
          onComplete={completarServicioHandler}
          onAssignToMe={asignarmeServicioHandler}
        />
      </Shell>
    );
  }

  // ---------- BIBLIOTECA DE CONTENIDO (Fase C · solo distribuidor) ----------
  if (screen === "biblioteca") {
    return (
      <ScreenWrap>
        {Toast}
        <TopBar title="Contenido oficial" subtitle="Aprueba lo que la IA puede usar" onBack={() => setScreen("dashboard")} />
        <ContentLibrary
          productos={productos}
          contenido={contenidoProd}
          onGenerar={generarContenidoHandler}
          onAprobar={aprobarContenidoHandler}
          onRechazar={rechazarContenidoHandler}
          onEditar={editarContenidoHandler}
          onEliminar={eliminarContenidoHandler}
          onToast={mostrarToast}
        />
      </ScreenWrap>
    );
  }

  return null;
}

function Shell({ children, active, setScreen, onNueva, serviciosBadge = 0 }) {
  return (
    <div className="min-h-screen bg-surface max-w-md mx-auto flex flex-col">
      <div className="flex-1 flex flex-col">{children}</div>
      <NavInline active={active} setScreen={setScreen} onNueva={onNueva} serviciosBadge={serviciosBadge} />
    </div>
  );
}

function ScreenWrap({ children }) {
  return <div className="min-h-screen bg-surface max-w-md mx-auto flex flex-col">{children}</div>;
}

// Hoja de perfil (antes vivía en la pestaña "Más"). Muestra los datos de la
// cuenta y el botón de cerrar sesión, sin ocupar un slot en la barra inferior.
function PerfilSheet({ nombre, correo, rol, firstName, esManager, onBiblioteca, onCerrar, onSignOut }) {
  const filas = [
    { icon: User, label: "Nombre", valor: nombre },
    { icon: MessageCircle, label: "Correo", valor: correo },
    { icon: Building2, label: "Rol", valor: rol },
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label="Perfil">
      <button className="absolute inset-0 bg-brand-deep/40 backdrop-blur-[1px]" aria-label="Cerrar" onClick={onCerrar} />
      <div className="relative w-full max-w-md bg-card rounded-t-3xl px-5 pt-3 pb-8 safe-bottom animate-in slide-in-from-bottom duration-200">
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-hairline" />
        <div className="flex items-center gap-4 mb-5">
          <Avatar name={firstName} className="w-14 h-14 text-xl" />
          <div className="min-w-0">
            <p className="font-display font-bold text-brand-deep text-lg truncate">{nombre}</p>
            <p className="text-[13px] text-muted truncate">{rol}</p>
          </div>
        </div>
        <Card className="divide-y divide-hairline overflow-hidden mb-5">
          {filas.map(({ icon: Icon, label, valor }) => (
            <div key={label} className="flex items-center gap-3 px-4 py-3.5">
              <span className="w-9 h-9 rounded-xl bg-brand/[0.06] grid place-items-center shrink-0">
                <Icon className="w-[18px] h-[18px] text-brand" strokeWidth={1.9} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-muted">{label}</p>
                <p className="text-[15px] text-brand-deep font-medium truncate">{valor}</p>
              </div>
            </div>
          ))}
        </Card>
        {esManager && (
          <button
            onClick={onBiblioteca}
            className="w-full flex items-center gap-3 rounded-2xl bg-card border border-hairline px-4 py-3.5 mb-3 active:bg-surface transition"
          >
            <span className="w-9 h-9 rounded-xl bg-brand/[0.06] grid place-items-center shrink-0">
              <BookOpen className="w-[18px] h-[18px] text-brand" strokeWidth={1.9} />
            </span>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-[15px] text-brand-deep font-medium">Contenido oficial</p>
              <p className="text-[12px] text-muted">Generar, editar y aprobar contenido</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted/50 shrink-0" />
          </button>
        )}
        <Boton variant="danger" onClick={onSignOut}>
          <LogOut className="w-[18px] h-[18px]" /> Cerrar sesión
        </Boton>
        <p className="text-center text-xs text-muted/70 mt-4">Royal Sales AI · v1.0</p>
      </div>
    </div>
  );
}

function NavTab({ id, label, icon: Icon, active, setScreen, badge = 0 }) {
  const on = active === id;
  return (
    <button
      onClick={() => setScreen(id)}
      aria-label={badge > 0 ? `${label}, ${badge} pendientes` : label}
      aria-current={on ? "page" : undefined}
      className="relative flex flex-col items-center gap-1 w-16 py-1 min-h-[44px]"
    >
      {badge > 0 && (
        <span className="absolute top-0 right-3 min-w-[16px] h-4 px-1 rounded-full bg-accent text-white text-[9px] font-bold grid place-items-center leading-none">
          {badge > 9 ? "9+" : badge}
        </span>
      )}
      <Icon className={`w-[22px] h-[22px] transition-colors ${on ? "text-brand-dark" : "text-muted/55"}`} strokeWidth={on ? 2.4 : 1.9} />
      <span className={`text-[10px] font-medium transition-colors ${on ? "text-brand-dark" : "text-muted/55"}`}>{label}</span>
    </button>
  );
}

function NavInline({ active, setScreen, onNueva, serviciosBadge = 0 }) {
  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 max-w-md w-full bg-card border-t border-hairline shadow-nav z-30">
      <div className="flex items-center justify-around px-2 pt-1.5 pb-1.5 safe-bottom">
        <NavTab id="dashboard" label="Inicio" icon={Home} active={active} setScreen={setScreen} />
        <NavTab id="clientes" label="Clientes" icon={Users} active={active} setScreen={setScreen} />
        <button
          onClick={onNueva}
          aria-label="Nueva visita"
          className="flex flex-col items-center -mt-7 w-16 min-h-[44px]"
        >
          <span className="w-14 h-14 rounded-2xl bg-accent text-white grid place-items-center shadow-cta active:scale-95 transition ring-4 ring-card">
            <Plus className="w-6 h-6" strokeWidth={2.6} />
          </span>
          <span className="text-[10px] font-semibold text-brand-dark mt-1">Visita</span>
        </button>
        <NavTab id="seguimientos" label="Seguim." icon={Calendar} active={active} setScreen={setScreen} />
        <NavTab id="servicios" label="Servicios" icon={Wrench} active={active} setScreen={setScreen} badge={serviciosBadge} />
      </div>
    </nav>
  );
}

function Card({ children, className = "", ...rest }) {
  return (
    <div className={`bg-card rounded-2xl border border-hairline shadow-card ${className}`} {...rest}>
      {children}
    </div>
  );
}

function Avatar({ name, className = "" }) {
  const letra = (name || "?").trim()[0]?.toUpperCase() || "?";
  return (
    <div className={`rounded-full bg-brand/10 text-brand-dark font-display font-bold grid place-items-center shrink-0 ${className}`}>
      {letra}
    </div>
  );
}

function EmptyState({ icon: Icon, titulo, texto, action }) {
  return (
    <div className="bg-card rounded-2xl border border-hairline shadow-soft px-6 py-10 text-center flex flex-col items-center animate-rise">
      {Icon && (
        <div className="w-14 h-14 rounded-2xl bg-brand/8 grid place-items-center mb-4">
          <Icon className="w-6 h-6 text-brand" strokeWidth={1.9} />
        </div>
      )}
      <p className="font-display font-semibold text-brand-deep text-[15px]">{titulo}</p>
      {texto && <p className="text-sm text-muted mt-1.5 max-w-[16rem] leading-relaxed">{texto}</p>}
      {action && <div className="mt-5 w-full max-w-[16rem]">{action}</div>}
    </div>
  );
}

function KpiCard({ icon: Icon, valor, label }) {
  return (
    <div className="bg-white/[0.08] rounded-2xl p-3 border border-white/10 backdrop-blur-sm">
      <Icon className="w-4 h-4 text-emerald-300/90 mb-2" strokeWidth={2} />
      <p className="text-white font-display font-bold text-2xl leading-none tabular-nums">{valor}</p>
      <p className="text-emerald-200/70 text-[11px] mt-1.5 font-medium">{label}</p>
    </div>
  );
}

function Campo({ label, value, onChange, placeholder, type = "text", hint }) {
  return (
    <div>
      <label className="text-[13px] font-medium text-muted mb-1.5 block">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-card border border-hairline rounded-2xl px-4 h-[52px] text-base text-ink placeholder:text-muted/45 shadow-soft focus:border-brand focus:ring-4 focus:ring-brand/10 focus:outline-none transition"
      />
      {hint && <p className="text-xs text-muted mt-1.5">{hint}</p>}
    </div>
  );
}

function MiniCard({ label, valor }) {
  return (
    <div className="bg-card border border-hairline rounded-2xl p-3.5 shadow-soft">
      <p className="text-[11px] font-semibold text-muted uppercase tracking-wide mb-1">{label}</p>
      <p className="text-sm font-display font-bold text-brand-deep capitalize">{valor || "—"}</p>
    </div>
  );
}

function Seccion({ titulo, texto }) {
  if (!texto) return null;
  return (
    <div>
      <p className="text-[11px] font-semibold text-muted uppercase tracking-wide mb-1.5">{titulo}</p>
      <p className="text-[15px] text-ink leading-relaxed">{texto}</p>
    </div>
  );
}

function ListaTarjetas({ titulo, items, color }) {
  if (!items || items.length === 0) return null;
  const colors = {
    green: "bg-brand/[0.06] text-brand-dark border-brand/10",
    red: "bg-red-50 text-red-700 border-red-100",
  };
  return (
    <div>
      <p className="text-[11px] font-semibold text-muted uppercase tracking-wide mb-2">{titulo}</p>
      <div className="space-y-2">
        {items.map((it, i) => (
          <div key={i} className={`text-[14px] leading-relaxed px-3.5 py-2.5 rounded-xl border ${colors[color]}`}>{it}</div>
        ))}
      </div>
    </div>
  );
}

function SkeletonLista() {
  return (
    <div className="space-y-2.5">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-card rounded-2xl p-4 border border-hairline flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-hairline animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 bg-hairline rounded-full w-1/2 animate-pulse" />
            <div className="h-3 bg-hairline rounded-full w-3/4 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

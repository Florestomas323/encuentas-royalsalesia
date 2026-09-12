import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { runAIJSON } from "@/lib/ai/openai";
import { classifyIntent, type CopilotFlow } from "@/lib/ai/intent";
import { COPILOT_SYSTEM, copilotPrompt } from "@/lib/ai/prompts/copilot";
import { validateCopilotAnswer } from "@/lib/ai/validateCopilot";
import {
  getProductKnowledge,
  renderTopic,
  renderWarranty,
  knowledgeContextText,
  esTopicEstructurado,
  type ProductKnowledge,
} from "@/lib/products/productKnowledge";
import {
  getCustomerContextServer,
  getProductContextServer,
  getProductContextById,
  getWarrantyContextServer,
  getGeneralWarrantyContext,
  type ProductMatch,
} from "@/lib/ai/copilotContext";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fail(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function POST(req: Request) {
  // 1. Sesión: ID token de Firebase en el header.
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) return fail("Falta el token de sesión.", 401);

  let uid: string;
  try {
    const decoded = await adminAuth().verifyIdToken(token);
    uid = decoded.uid;
  } catch {
    return fail("Sesión no válida. Vuelve a iniciar sesión.", 401);
  }

  // 2. Perfil del usuario LEÍDO EN EL SERVIDOR (nunca del body): de aquí salen
  //    la organización y el rol que aíslan todos los datos.
  let orgId: string;
  let role: string;
  let onlyTestData = false;
  try {
    const snap = await adminDb().collection("users").doc(uid).get();
    if (!snap.exists) return fail("Tu perfil no está configurado. Contacta a tu distribuidor.", 403);
    const profile = snap.data() as any;
    orgId = String(profile.organizationId || "");
    role = String(profile.role || "");
    onlyTestData = profile.isTestUser === true || role === "reviewer";
    if (!orgId) return fail("Tu perfil no tiene organización asignada.", 403);
  } catch {
    return fail("No pudimos verificar tu perfil.", 500);
  }

  // 3. Body.
  let body: any;
  try {
    body = await req.json();
  } catch {
    return fail("Cuerpo de la petición no válido.");
  }

  const message = typeof body?.message === "string" ? body.message.trim().slice(0, 800) : "";
  if (!message) return fail("Escribe tu pregunta.");
  const customerId = typeof body?.customerId === "string" ? body.customerId.slice(0, 120) : "";
  const conversationId = typeof body?.conversationId === "string" ? body.conversationId.slice(0, 120) : "";
  const history: { role: "user" | "assistant"; content: string }[] = Array.isArray(body?.history)
    ? body.history
        .filter((h: any) => (h?.role === "user" || h?.role === "assistant") && typeof h?.content === "string")
        .slice(-6)
        .map((h: any) => ({ role: h.role, content: String(h.content).slice(0, 800) }))
    : [];
  const currency = typeof body?.currency === "string" ? body.currency : "COP";
  const locale = typeof body?.locale === "string" ? body.locale : "es-CO";

  // Campos de flujos guiados (el vendedor eligió en el widget). Resolvemos el
  // producto/objeción en código para no depender de que la IA adivine.
  const productId = typeof body?.productId === "string" ? body.productId.slice(0, 120) : "";
  const objection = typeof body?.objection === "string" ? body.objection.trim().slice(0, 300) : "";
  const topic = typeof body?.topic === "string" ? body.topic.trim().slice(0, 60) : "";
  const flow: CopilotFlow | null =
    body?.flow === "objection" || body?.flow === "product" || body?.flow === "warranty" ? body.flow : null;

  // 3b. AUTORIZACIÓN DEL conversationId (IDOR).
  //     El id llega del navegador y esta API escribe con Firebase Admin, que se
  //     salta las reglas de Firestore: por eso la comprobación tiene que estar
  //     aquí. Se valida ANTES de gastar contexto, IA o escrituras, y el uid y la
  //     organización usados para autorizar salen del token y del perfil leído en
  //     el servidor (pasos 1 y 2), nunca del body.
  if (conversationId) {
    const autorizada = await conversacionAutorizada(conversationId, uid, orgId);
    if (!autorizada) {
      // MISMA respuesta para: no existe, es de otro usuario o es de otra
      // organización. Así no se puede sondear qué conversationId existen.
      return fail("Conversación no válida. Inicia una conversación nueva.", 404);
    }
  }

  const hasCustomer = !!customerId;
  const intent = classifyIntent(message, hasCustomer, flow);

  // ¿El vendedor pide explícitamente las REGLAS GENERALES de garantía?
  const wantsGeneralWarranty = /(reglas|pol[ií]tica|condiciones)\s+generales|garant[ií]a\s+general|en general/i.test(message);

  try {
    // 3c. BASE DE CONOCIMIENTO DE PRODUCTO — respuesta SIN IA.
    //     Cuando el vendedor toca un subtema del producto (Beneficios, Qué
    //     incluye, Uso, Cuidados, Postventa, Recetas) o pide la garantía de un
    //     producto concreto, la respuesta se arma con la ficha oficial de
    //     `productKnowledge`. Es información estructurada: no hay nada que el
    //     modelo pueda aportar y sí mucho que pueda inventar, así que ni se
    //     llama. Si el producto todavía no tiene ficha, `pk` es null y el flujo
    //     sigue exactamente como antes (IA con catálogo + contenido aprobado).
    if (productId) {
      const pk = await getProductKnowledge(productId);
      if (pk) {
        if (esTopicEstructurado(topic)) {
          return NextResponse.json({
            ok: true,
            intent: intent.intent,
            conversationId: conversationId || null,
            sinIA: true,
            result: renderTopic(pk, topic),
          });
        }
        if (intent.needsWarranty && !wantsGeneralWarranty) {
          return NextResponse.json({
            ok: true,
            intent: "warranty",
            conversationId: conversationId || null,
            sinIA: true,
            result: renderWarranty(pk),
          });
        }
      }
    }

    // 4. Rehidratar SOLO el contexto que la intención necesita (menos tokens,
    //    menos lecturas). Todo aislado por organización en el servidor.
    let customerContext: string | null = null;
    if (intent.needsCustomer && customerId) {
      customerContext = await getCustomerContextServer(orgId, customerId, { onlyTestData });
    }

    // Resolver el producto PRIMERO en código/Firestore (sin IA):
    //  - si el vendedor eligió un productId explícito, lo usamos directo;
    //  - si no, búsqueda flexible por texto. Si hay varios candidatos, pedimos
    //    que elija; si no hay ninguno y se necesita producto, pedimos producto.
    let productContext: string | null = null;
    let matched: ProductMatch[] = [];
    if (productId) {
      const p = await getProductContextById(orgId, productId);
      productContext = p.text;
      matched = p.matched;
    } else if (intent.needsProduct) {
      const p = await getProductContextServer(orgId, message);
      productContext = p.text;
      matched = p.matched;

      // Desambiguación (p. ej. "la licuadora" con Max y Go): preguntar sin IA.
      if (!matched.length && p.candidates.length > 1) {
        return NextResponse.json({
          ok: true,
          intent: intent.intent,
          conversationId: conversationId || null,
          result: {
            answer: "¿Cuál producto quieres consultar?",
            actions: [],
            sources: [],
            disclaimer: "",
            choices: p.candidates.map((c) => ({ id: c.id, name: c.name })),
          },
        });
      }
    }

    // Pregunta abierta sobre un producto identificado: la ficha oficial se le
    // entrega al modelo como fuente única, para que pueda reformular y adaptar
    // el lenguaje sin añadir nada que no esté aprobado.
    let knowledgeContext: string | null = null;
    if (matched.length === 1) {
      const pk: ProductKnowledge | null = await getProductKnowledge(matched[0].id);
      if (pk) knowledgeContext = knowledgeContextText(pk);
    }

    // Garantía: SIEMPRE sobre un producto. Si no hay producto identificado y no
    // se pidieron reglas generales, pedimos el producto (sin IA, sin política
    // general suelta).
    let warrantyContext: string | null = null;
    if (intent.needsWarranty) {
      if (wantsGeneralWarranty && !matched.length) {
        warrantyContext = await getGeneralWarrantyContext();
      } else if (matched.length) {
        warrantyContext = await getWarrantyContextServer(matched);
      } else {
        return NextResponse.json({
          ok: true,
          intent: intent.intent,
          conversationId: conversationId || null,
          result: {
            answer: "Claro. ¿De qué producto quieres consultar la garantía?",
            actions: [],
            sources: [],
            disclaimer: "",
            askProduct: true,
          },
        });
      }
    }

    // 5. Una sola llamada al modelo (nivel según intención) para la respuesta.
    const prompt = copilotPrompt({
      intent: intent.intent,
      message,
      history,
      customerContext,
      warrantyContext,
      productContext,
      knowledgeContext,
      objection: objection || null,
      topic: topic || null,
      currency,
      locale,
    });
    const raw = await runAIJSON({ prompt, system: COPILOT_SYSTEM, tier: intent.tier, maxTokens: 1100 });
    const result = validateCopilotAnswer(raw, intent.intent);

    // 6. Persistir historial (best-effort: si falla, igual respondemos).
    const convId = await persistConversation({
      conversationId,
      uid,
      orgId,
      customerId,
      message,
      result,
      intent: intent.intent,
      tier: intent.tier,
      onlyTestData,
    }).catch((e) => {
      console.error("[ai/copilot] persist:", e?.message);
      return conversationId || null;
    });

    return NextResponse.json({ ok: true, result, intent: intent.intent, conversationId: convId });
  } catch (err: any) {
    // El detalle (mensaje del gateway, de Firestore, stack) SOLO va a los logs
    // del servidor. Al navegador va un mensaje genérico: los errores internos
    // filtran nombres de proveedor, rutas y estado de la infraestructura.
    console.error("[ai/copilot]", intent.intent, err?.message);
    return fail("No pudimos generar la respuesta en este momento. Intenta de nuevo.", 502);
  }
}

/**
 * ¿La conversación `conversationId` pertenece a este usuario y a su organización?
 *
 * Devuelve `true` solo si el documento existe, su `uid` es exactamente el del
 * token verificado y su `organizationId` es exactamente el del perfil leído en
 * servidor. Cualquier otro caso —no existe, es de otro usuario, es de otra
 * organización, o la lectura falla— devuelve `false` (falla cerrado). No lanza
 * ni distingue los motivos: el handler responde lo mismo en todos los casos.
 */
async function conversacionAutorizada(
  conversationId: string,
  uid: string,
  orgId: string
): Promise<boolean> {
  try {
    const snap = await adminDb().collection("copilotConversations").doc(conversationId).get();
    if (!snap.exists) return false;
    const data = snap.data() as { uid?: string; organizationId?: string } | undefined;
    if (!data) return false;
    if (data.uid !== uid) return false;
    // `organizationId` se escribe siempre en persistConversation, así que forma
    // parte del modelo: si falta o no coincide, no se autoriza.
    if (data.organizationId !== orgId) return false;
    return true;
  } catch (e: any) {
    // Fallo de lectura => se deniega. Nunca se concede acceso por un error.
    console.error("[ai/copilot] verificación de conversación:", e?.message);
    return false;
  }
}

// Guarda conversación + mensajes + uso. Todo con adminDb (server), con el uid
// del dueño para que las reglas de Firestore permitan solo lectura al propio
// usuario. Es best-effort: nunca bloquea la respuesta al vendedor.
async function persistConversation(input: {
  conversationId: string;
  uid: string;
  orgId: string;
  customerId: string;
  message: string;
  result: { answer: string };
  intent: string;
  tier: string;
  onlyTestData: boolean;
}): Promise<string> {
  const db = adminDb();

  // El conversationId que llega aquí YA pasó por `conversacionAutorizada` en el
  // handler (paso 3b): pertenece a este uid y a esta organización. Si no viene
  // conversationId, se abre una conversación nueva con id generado en servidor.
  const esNueva = !input.conversationId;
  const convRef = esNueva
    ? db.collection("copilotConversations").doc()
    : db.collection("copilotConversations").doc(input.conversationId);

  await convRef.set(
    {
      uid: input.uid,
      organizationId: input.orgId,
      customerId: input.customerId || null,
      lastIntent: input.intent,
      isTestData: input.onlyTestData,
      updatedAt: FieldValue.serverTimestamp(),
      ...(esNueva ? { createdAt: FieldValue.serverTimestamp() } : {}),
    },
    { merge: true }
  );

  const batch = db.batch();
  const userMsg = convRef.collection("messages").doc();
  batch.set(userMsg, {
    role: "user",
    content: input.message,
    uid: input.uid,
    createdAt: FieldValue.serverTimestamp(),
  });
  const aiMsg = convRef.collection("messages").doc();
  batch.set(aiMsg, {
    role: "assistant",
    content: input.result.answer,
    intent: input.intent,
    uid: input.uid,
    createdAt: FieldValue.serverTimestamp(),
  });

  // Uso agregado (para monitorear costos por usuario/intención).
  const usageRef = db.collection("copilotUsage").doc();
  batch.set(usageRef, {
    uid: input.uid,
    organizationId: input.orgId,
    conversationId: convRef.id,
    intent: input.intent,
    tier: input.tier,
    createdAt: FieldValue.serverTimestamp(),
  });

  await batch.commit();
  return convRef.id;
}

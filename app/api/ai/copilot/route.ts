import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { runAIJSON } from "@/lib/ai/openai";
import { classifyIntent, type CopilotFlow } from "@/lib/ai/intent";
import { COPILOT_SYSTEM, copilotPrompt } from "@/lib/ai/prompts/copilot";
import { validateCopilotAnswer } from "@/lib/ai/validateCopilot";
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

  const hasCustomer = !!customerId;
  const intent = classifyIntent(message, hasCustomer, flow);

  // ¿El vendedor pide explícitamente las REGLAS GENERALES de garantía?
  const wantsGeneralWarranty = /(reglas|pol[ií]tica|condiciones)\s+generales|garant[ií]a\s+general|en general/i.test(message);

  try {
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
    console.error("[ai/copilot]", intent.intent, err?.message);
    const detalle = typeof err?.message === "string" ? err.message : "";
    return fail(detalle || "No pudimos generar la respuesta en este momento.", 502);
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
  const convRef = input.conversationId
    ? db.collection("copilotConversations").doc(input.conversationId)
    : db.collection("copilotConversations").doc();

  await convRef.set(
    {
      uid: input.uid,
      organizationId: input.orgId,
      customerId: input.customerId || null,
      lastIntent: input.intent,
      isTestData: input.onlyTestData,
      updatedAt: FieldValue.serverTimestamp(),
      ...(input.conversationId ? {} : { createdAt: FieldValue.serverTimestamp() }),
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

import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import { runAI } from "@/lib/ai/openai";
import {
  customerProfilePrompt,
  followupPrompt,
  loyaltyPrompt,
} from "@/lib/ai/prompts/customerProfile";
import {
  productContentDraftPrompt,
  productAssistantPrompt,
} from "@/lib/ai/prompts/productContent";
import {
  validateCustomerProfile,
  validateFollowup,
  validateLoyalty,
  validateContentDraft,
  validateProductAnswer,
} from "@/lib/ai/validate";

// Sanea una lista de contenido oficial recibida del cliente (defensa servidor).
function sanitizeOfficialContent(raw: any): { type: string; title: string; content?: string }[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((c) => c && typeof c.title === "string")
    .slice(0, 20)
    .map((c) => ({
      type: String(c.type || "").slice(0, 40),
      title: String(c.title).slice(0, 200),
      content: typeof c.content === "string" ? c.content.slice(0, 2000) : "",
    }));
}

// El análisis usa el service account de Firebase (Node), no Edge.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fail(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function POST(req: Request) {
  // 1. Verificar sesión: el frontend manda el ID token de Firebase en el header.
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) {
    return fail("Falta el token de sesión.", 401);
  }
  try {
    await adminAuth().verifyIdToken(token);
  } catch {
    return fail("Sesión no válida. Vuelve a iniciar sesión.", 401);
  }

  // 2. Leer el cuerpo.
  let body: any;
  try {
    body = await req.json();
  } catch {
    return fail("Cuerpo de la petición no válido.");
  }

  const type = body?.type;

  try {
    // 3. Enrutar según el tipo de análisis. Cada rama arma su prompt, llama al
    //    proveedor y valida/normaliza la salida a la forma exacta que espera la UI.
    if (type === "customerProfile") {
      const prompt = customerProfilePrompt({
        responses: body.responses,
        internalInfo: body.internalInfo,
        observations: body.observations || "",
        familySize: body.familySize,
      });
      const raw = await runAI(prompt, 1200);
      const result = validateCustomerProfile(raw);
      return NextResponse.json({ ok: true, result });
    }

    if (type === "followup") {
      const prompt = followupPrompt({
        outcome: body.outcome,
        reason: body.reason || "",
        profile: body.profile,
        currency: typeof body.currency === "string" ? body.currency : "COP",
        locale: typeof body.locale === "string" ? body.locale : "es-CO",
      });
      const raw = await runAI(prompt, 700);
      const result = validateFollowup(raw);
      return NextResponse.json({ ok: true, result });
    }

    if (type === "loyalty") {
      // El plan y los flags de contenido llegan YA decididos desde el cliente
      // (a partir de Firestore/clasificador). La IA solo redacta obedeciéndolos.
      const plan: { dia: number; contentType: string }[] = Array.isArray(body.plan) && body.plan.length
        ? body.plan.filter((p: any) => Number.isFinite(Number(p?.dia)) && typeof p?.contentType === "string")
            .map((p: any) => ({ dia: Number(p.dia), contentType: String(p.contentType) }))
        : [1, 3, 7, 15, 30, 45, 60].map((d) => ({ dia: d, contentType: "usage_tip" }));
      const supportsRecipes = body.supportsRecipes === true;
      const allowed: string[] = Array.isArray(body.allowedContentTypes)
        ? body.allowedContentTypes.filter((x: any) => typeof x === "string")
        : [];
      const prompt = loyaltyPrompt({
        profile: body.profile,
        product: body.product || "",
        favoriteMeal: body.favoriteMeal || "",
        supportsRecipes,
        productCategory: typeof body.productCategory === "string" ? body.productCategory : "",
        allowedContentTypes: allowed,
        plan,
        officialContent: sanitizeOfficialContent(body.officialContent),
        currency: typeof body.currency === "string" ? body.currency : "COP",
        locale: typeof body.locale === "string" ? body.locale : "es-CO",
      });
      const raw = await runAI(prompt, 1200);
      // Refuerzo servidor: si el producto NO admite recetas, ninguna etapa de
      // tipo receta debe existir (el plan ya no la incluye, pero por si acaso).
      const result = validateLoyalty(raw, plan.map((p) => p.dia));
      return NextResponse.json({ ok: true, result });
    }

    if (type === "productContentDraft") {
      const allowed: string[] = Array.isArray(body.allowedContentTypes)
        ? body.allowedContentTypes.filter((x: any) => typeof x === "string")
        : [];
      const requested: string[] = Array.isArray(body.requestedTypes)
        ? body.requestedTypes.filter((x: any) => typeof x === "string")
        : [];
      const prompt = productContentDraftPrompt({
        productName: body.productName || "producto",
        productCategory: typeof body.productCategory === "string" ? body.productCategory : "",
        supportsRecipes: body.supportsRecipes === true,
        allowedContentTypes: allowed,
        requestedTypes: requested,
        currency: typeof body.currency === "string" ? body.currency : "COP",
        locale: typeof body.locale === "string" ? body.locale : "es-CO",
      });
      const raw = await runAI(prompt, 1600);
      const result = validateContentDraft(raw, allowed);
      return NextResponse.json({ ok: true, result });
    }

    if (type === "productAssistant") {
      const question = typeof body.question === "string" ? body.question.trim().slice(0, 500) : "";
      if (!question) return fail("Escribe una pregunta.");
      const prompt = productAssistantPrompt({
        productName: body.productName || "producto",
        question,
        officialContent: sanitizeOfficialContent(body.officialContent),
      });
      const raw = await runAI(prompt, 800);
      const result = validateProductAnswer(raw);
      return NextResponse.json({ ok: true, result });
    }

    return fail(`Tipo de análisis no reconocido: ${type}`);
  } catch (err: any) {
    // Devolvemos el mensaje real (es la app del propio usuario y necesita ver
    // por qué falla: key inválida, sin crédito, modelo inexistente, etc.).
    console.error("[ai/analyze]", type, err?.message);
    const detalle = typeof err?.message === "string" ? err.message : "";
    return fail(detalle || "No pudimos generar el análisis en este momento.", 502);
  }
}

import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import { runAI } from "@/lib/ai/openai";
import {
  customerProfilePrompt,
  followupPrompt,
  loyaltyPrompt,
} from "@/lib/ai/prompts/customerProfile";
import {
  validateCustomerProfile,
  validateFollowup,
  validateLoyalty,
} from "@/lib/ai/validate";

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
      });
      const raw = await runAI(prompt, 700);
      const result = validateFollowup(raw);
      return NextResponse.json({ ok: true, result });
    }

    if (type === "loyalty") {
      const prompt = loyaltyPrompt({
        profile: body.profile,
        product: body.product || "",
        favoriteMeal: body.favoriteMeal || "",
      });
      const raw = await runAI(prompt, 1200);
      const result = validateLoyalty(raw);
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

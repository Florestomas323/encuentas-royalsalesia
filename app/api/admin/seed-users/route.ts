import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import { runAI } from "@/lib/ai/openai";
import { customerProfilePrompt, followupPrompt, loyaltyPrompt } from "@/lib/ai/prompts/customerProfile";
import { validateCustomerProfile, validateFollowup, validateLoyalty } from "@/lib/ai/validate";

// Rate limit simple en memoria: suficiente para MVP, evita que un doble toque
// o un bucle accidental dispare cientos de llamadas. Se reinicia con el servidor.
const RATE_LIMIT = 30;          // llamadas
const RATE_WINDOW_MS = 60 * 60 * 1000; // por hora, por usuario
const hits = new Map<string, number[]>();

function rateLimited(uid: string): boolean {
  const ahora = Date.now();
  const previos = (hits.get(uid) || []).filter((t) => ahora - t < RATE_WINDOW_MS);
  previos.push(ahora);
  hits.set(uid, previos);
  return previos.length > RATE_LIMIT;
}

const MAX_OBSERVATIONS = 600;

export async function POST(req: NextRequest) {
  // 1. Verificar el token de Firebase — nunca confiar en un uid enviado por el frontend.
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  let uid: string;
  try {
    const decoded = await adminAuth().verifyIdToken(token);
    uid = decoded.uid;
  } catch {
    return NextResponse.json({ error: "Sesión inválida." }, { status: 401 });
  }

  if (rateLimited(uid)) {
    return NextResponse.json({ error: "Demasiadas solicitudes. Espera unos minutos." }, { status: 429 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  const tipo = body?.type;

  try {
    if (tipo === "customerProfile") {
      const raw = await runAI(customerProfilePrompt({
        responses: body.responses ?? {},
        internalInfo: body.internalInfo ?? {},
        observations: String(body.observations || "").slice(0, MAX_OBSERVATIONS),
        familySize: body.familySize ?? null,
      }));
      return NextResponse.json({ result: validateCustomerProfile(raw) });
    }

    if (tipo === "followup") {
      const raw = await runAI(followupPrompt({
        outcome: body.outcome === "lost" ? "lost" : "pending",
        reason: String(body.reason || "").slice(0, 200),
        profile: body.profile ?? {},
      }), 800);
      return NextResponse.json({ result: validateFollowup(raw) });
    }

    if (tipo === "loyalty") {
      const raw = await runAI(loyaltyPrompt({
        profile: body.profile ?? {},
        product: String(body.product || "").slice(0, 200),
        favoriteMeal: String(body.favoriteMeal || "").slice(0, 200),
      }), 1000);
      return NextResponse.json({ result: validateLoyalty(raw) });
    }

    return NextResponse.json({ error: "Tipo de análisis desconocido." }, { status: 400 });
  } catch (err: any) {
    // Log técnico sin datos del cliente ni credenciales.
    console.error("[ai/analyze]", tipo, err?.message);
    return NextResponse.json({ error: "No pudimos generar el análisis en este momento." }, { status: 502 });
  }
}

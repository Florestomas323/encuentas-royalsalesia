import "server-only";
import { generateText } from "ai";

// Capa de proveedor: todo el resto del código llama a runAI(), nunca al modelo
// directamente. Cambiar de proveedor o de modelo se hace solo aquí.
//
// Usamos el Vercel AI Gateway (conectado a este proyecto). En los despliegues
// de Vercel se autentica automáticamente por OIDC, así que NO depende de una
// OPENAI_API_KEY propia (que era la causa de "No pudimos generar el análisis").
//
// El modelo se referencia con el formato "proveedor/modelo". Si la variable
// AI_ANALYSIS_MODEL trae solo "gpt-4o-mini" (formato viejo de OpenAI), le
// anteponemos "openai/" para que el gateway lo entienda.
function normalizarModelo(valor: string | undefined): string {
  const base = (valor || "gpt-4o-mini").trim();
  return base.includes("/") ? base : `openai/${base}`;
}

const ANALYSIS_MODEL = normalizarModelo(process.env.AI_ANALYSIS_MODEL);

// Extrae el primer objeto JSON de un texto, tolerando ```json ... ``` o
// texto adicional alrededor. El modelo casi siempre devuelve JSON limpio,
// pero esto evita fallos por adornos ocasionales.
function extraerJSON(texto: string): unknown {
  const limpio = texto.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(limpio);
  } catch {
    const inicio = limpio.indexOf("{");
    const fin = limpio.lastIndexOf("}");
    if (inicio !== -1 && fin > inicio) {
      return JSON.parse(limpio.slice(inicio, fin + 1));
    }
    throw new Error("El modelo no devolvió un JSON válido.");
  }
}

export async function runAI(prompt: string, maxTokens = 1200): Promise<unknown> {
  try {
    const { text } = await generateText({
      model: ANALYSIS_MODEL,
      maxOutputTokens: maxTokens,
      system:
        "Responde SIEMPRE con un único objeto JSON válido, sin markdown ni texto adicional.",
      prompt,
    });

    if (!text) throw new Error("Respuesta vacía del proveedor de IA.");
    return extraerJSON(text);
  } catch (err: any) {
    // Propagamos un mensaje útil (sin filtrar credenciales) para poder
    // diagnosticar la causa desde la propia app.
    const detalle = err?.message ? `: ${err.message}` : "";
    throw new Error(`Proveedor de IA falló${detalle}`);
  }
}

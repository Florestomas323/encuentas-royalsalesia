import "server-only";

// Capa de proveedor: todo el resto del código llama a runAI(), nunca a OpenAI
// directamente. Cambiar de proveedor o de modelo se hace solo aquí.
const ANALYSIS_MODEL = process.env.AI_ANALYSIS_MODEL || "gpt-4o-mini";

export async function runAI(prompt: string, maxTokens = 1200): Promise<unknown> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("Falta OPENAI_API_KEY en el servidor.");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: ANALYSIS_MODEL,
      max_tokens: maxTokens,
      // Fuerza salida JSON válida — evita depender de limpiar markdown a mano.
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Responde siempre con un único objeto JSON válido, sin texto adicional." },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!res.ok) {
    // Extraemos el mensaje del proveedor (sin filtrar la key) para saber la
    // causa exacta: 401 = key inválida, 429 = sin crédito/cuota, 404 = modelo
    // inexistente. Sin esto, todos los fallos se ven iguales en la app.
    let detalle = "";
    try {
      const errBody = await res.json();
      detalle = errBody?.error?.message || errBody?.error?.code || "";
    } catch {
      /* respuesta sin JSON */
    }
    throw new Error(
      `Proveedor de IA respondió ${res.status}${detalle ? `: ${detalle}` : ""}`
    );
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("Respuesta vacía del proveedor de IA.");
  return JSON.parse(text);
}

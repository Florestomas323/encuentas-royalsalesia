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
    // No registramos el body completo para no filtrar datos ni la key.
    throw new Error(`Proveedor de IA respondió ${res.status}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("Respuesta vacía del proveedor de IA.");
  return JSON.parse(text);
}

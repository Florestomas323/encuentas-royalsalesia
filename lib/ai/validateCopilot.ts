import "server-only";
import type { CopilotIntent } from "./intent";

// Normaliza y ASEGURA la respuesta del Copilot antes de devolverla al cliente.
// Aunque el modelo se salte una regla, aquí forzamos las garantías de seguridad:
// - las pantallas sugeridas solo pueden ser de una lista blanca;
// - en temas de garantía SIEMPRE hay disclaimer, aunque el modelo lo omita;
// - recortamos longitudes para no romper la UI.

const ALLOWED_SCREENS = ["clientes", "seguimientos", "servicios", "asistente", "biblioteca", "dashboard", ""];

const DISCLAIMER_GARANTIA =
  "La cobertura descrita es orientativa: la aprobación de cualquier reclamo depende de la evaluación oficial de Hy Cite. Para un reclamo, contacta al Centro de Servicio autorizado.";

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export interface CopilotAction {
  label: string;
  screen: string;
  note: string;
}

export interface CopilotAnswer {
  answer: string;
  actions: CopilotAction[];
  sources: string[];
  disclaimer: string;
}

export function validateCopilotAnswer(raw: any, intent: CopilotIntent): CopilotAnswer {
  const answer = str(raw?.answer);

  const actions: CopilotAction[] = (Array.isArray(raw?.actions) ? raw.actions : [])
    .map((a: any) => ({
      label: str(a?.label).slice(0, 40),
      screen: ALLOWED_SCREENS.includes(str(a?.screen)) ? str(a?.screen) : "",
      note: str(a?.note).slice(0, 120),
    }))
    .filter((a: CopilotAction) => a.label)
    .slice(0, 3);

  const sources = (Array.isArray(raw?.sources) ? raw.sources : [])
    .filter((s: unknown) => typeof s === "string" && s.trim())
    .map((s: string) => s.trim().slice(0, 80))
    .slice(0, 6);

  // Regla dura: en garantías, el disclaimer es obligatorio pase lo que pase.
  let disclaimer = str(raw?.disclaimer);
  if (intent === "warranty") disclaimer = disclaimer || DISCLAIMER_GARANTIA;

  return {
    answer: answer || "No tengo información oficial suficiente para responder eso con certeza. Te recomiendo verificarlo con tu distribuidor o el Centro de Servicio oficial.",
    actions,
    sources,
    disclaimer,
  };
}

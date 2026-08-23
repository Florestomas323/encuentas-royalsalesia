// Score de oportunidad 2.0 — 100% programado, sin IA.
// Se eliminó el punto por "seleccionó 3+ prioridades" (no representa oportunidad real).
export type OpportunityLevel = "high" | "medium" | "low";

export type ScoreInput = {
  wantsHealthierHabits?: string;      // "Sí" | "No" | "Tal vez"
  cookingHealthImportance?: string;   // "Muy importante" | ...
  cookingFrequency?: string;          // "Todos los días" | ...
  cookPresent?: string;               // "Sí" | "No" | "No sé"
  decisionParticipation?: string;     // "Ambos" | "Pareja" | ...
  relevantPeoplePresent?: string;     // "Todos" | "Falta pareja" | ...
  observedInterest?: string;          // "Alto" | "Medio" | "Bajo" | "Aún no determinado"
};

export function calculateOpportunity(input: ScoreInput): OpportunityLevel {
  let puntos = 0;

  if (input.wantsHealthierHabits === "Sí") puntos += 2;
  else if (input.wantsHealthierHabits === "Tal vez") puntos += 1;

  if (input.cookingHealthImportance === "Muy importante") puntos += 2;
  else if (input.cookingHealthImportance === "Importante") puntos += 1;

  if (input.cookingFrequency === "Todos los días" || input.cookingFrequency === "5–6 días") puntos += 1;
  else if (input.cookingFrequency === "1–2 días") puntos -= 1;

  if (input.cookPresent === "Sí") puntos += 2;
  else if (input.cookPresent === "No") puntos -= 1;

  if (input.relevantPeoplePresent === "Todos") puntos += 2;
  else if (input.relevantPeoplePresent === "Falta pareja" || input.relevantPeoplePresent === "Falta usuario principal") puntos -= 2;

  if (input.observedInterest === "Alto") puntos += 2;
  else if (input.observedInterest === "Bajo") puntos -= 2;

  if (puntos >= 6) return "high";
  if (puntos >= 3) return "medium";
  return "low";
}

export const OPPORTUNITY_LABELS: Record<OpportunityLevel, string> = {
  high: "Alta",
  medium: "Media",
  low: "Baja",
};

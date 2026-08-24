// Moneda por organización. Hoy la distribución oficial es Colombia (COP),
// pero la arquitectura queda lista para que otra organización use otra moneda:
// getOrgCurrency() decide la config a partir del perfil/organización.

export type CurrencyConfig = {
  currency: string; // ISO 4217, p. ej. "COP"
  locale: string;   // p. ej. "es-CO"
  symbol: string;   // p. ej. "$"
  maximumFractionDigits: number;
};

// Moneda por defecto de esta organización/distribución: Peso colombiano.
export const DEFAULT_CURRENCY: CurrencyConfig = {
  currency: "COP",
  locale: "es-CO",
  symbol: "$",
  maximumFractionDigits: 0,
};

// Catálogo de monedas soportadas (ampliable en el futuro sin tocar la UI).
export const CURRENCIES: Record<string, CurrencyConfig> = {
  COP: DEFAULT_CURRENCY,
  USD: { currency: "USD", locale: "en-US", symbol: "US$", maximumFractionDigits: 2 },
  EUR: { currency: "EUR", locale: "es-ES", symbol: "€", maximumFractionDigits: 2 },
  MXN: { currency: "MXN", locale: "es-MX", symbol: "$", maximumFractionDigits: 0 },
};

/**
 * Resuelve la moneda de la organización actual.
 * Preparado para el futuro: si el perfil/organización trae un código de moneda
 * (`profile.organization?.currency` o `profile.currency`), se usa esa; si no,
 * COP. Nunca deja que otra capa (ni la IA) elija la moneda por contexto.
 */
export function getOrgCurrency(profile?: any): CurrencyConfig {
  const code =
    profile?.organization?.currency ||
    profile?.organizationCurrency ||
    profile?.currency ||
    DEFAULT_CURRENCY.currency;
  return CURRENCIES[code] || DEFAULT_CURRENCY;
}

/** Convierte cualquier entrada ("$ 1.500.000", "1500000", 1500000) a número. */
export function parseAmount(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  // Quita símbolo/espacios y separadores de miles (punto en es-CO).
  const limpio = value.replace(/[^\d,-]/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
}

/**
 * Formatea un monto con la moneda de la organización.
 * Para COP/es-CO produce exactamente "$ 1.500.000" (símbolo + espacio + miles
 * con punto), de forma determinista en cualquier entorno (no depende del ICU
 * de currency-style). Ej: 1500000 -> "$ 1.500.000".
 */
export function formatCurrency(value: unknown, config: CurrencyConfig = DEFAULT_CURRENCY): string {
  const n = parseAmount(value);
  if (n === null) return "";
  const numero = new Intl.NumberFormat(config.locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: config.maximumFractionDigits,
  }).format(n);
  return `${config.symbol} ${numero}`;
}

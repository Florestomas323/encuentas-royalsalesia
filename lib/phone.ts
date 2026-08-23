// Normalización de teléfono para guardado y WhatsApp.
// No asume que todos los números son de EE.UU. — conserva el código de país si viene.
export function normalizePhone(input: string): string {
  const trimmed = (input || "").trim();
  if (!trimmed) return "";
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  return hasPlus ? `+${digits}` : digits;
}

// wa.me requiere el número sin "+" ni símbolos.
export function toWhatsAppNumber(phone: string): string {
  return normalizePhone(phone).replace("+", "");
}

export function isValidPhone(phone: string): boolean {
  const digits = normalizePhone(phone).replace("+", "");
  return digits.length >= 7 && digits.length <= 15;
}

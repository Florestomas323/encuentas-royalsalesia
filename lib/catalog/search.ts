// Buscador de productos COMPARTIDO por toda la app (Copilot, selector de
// compra, biblioteca de contenido). Diseñado para vendedores en campo:
// - resultados en vivo con cada letra;
// - tolera acentos, mayúsculas, plurales y errores de exactitud;
// - entiende palabras comunes en español como sinónimos del catálogo en inglés
//   ("licuadora" → blender, "olla" → cookware, "cafetera" → espresso...).
// Regla: basta UNA coincidencia para aparecer; a más coincidencias, más arriba.

export function normalizarTexto(s: unknown): string {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// Reduce una palabra a su raíz aproximada: licuadoras→licuadora, sartenes→sarten.
export function raizPalabra(t: string): string {
  if (t.length > 4 && t.endsWith("es")) return t.slice(0, -2);
  if (t.length > 3 && t.endsWith("s")) return t.slice(0, -1);
  return t;
}

// Español común → tokens reales del catálogo (nombres en inglés).
export const SINONIMOS: Record<string, string[]> = {
  licuadora: ["blender", "power"], batidora: ["blender", "mixer"],
  olla: ["pot", "cookware", "dutch", "saucepan", "stock", "casserole", "system", "roaster"],
  cacerola: ["saucepan", "casserole", "pot"], caldero: ["dutch", "stock", "pot"],
  sarten: ["skillet", "pan", "saute", "paella", "grill", "fry"], paellera: ["paella"],
  cuchillo: ["knife", "cutlery", "santoku", "chef"], tijera: ["shear", "scissor"],
  filtro: ["filter", "fresca", "shower", "air", "purif"], purificador: ["filter", "fresca", "air", "water", "purif"],
  agua: ["water", "fresca"], aire: ["air"], ducha: ["shower"],
  jugo: ["juicer", "juice", "extract"], extractor: ["juicer", "extract"], exprimidor: ["juicer", "citrus"],
  cafe: ["espresso", "barista", "coffee"], cafetera: ["espresso", "barista", "coffee"],
  te: ["tea", "expertea", "kettle"], tetera: ["tea", "kettle", "expertea"], hervidor: ["kettle"],
  vaporera: ["steamer", "steam"], plancha: ["griddle", "grill"], parrilla: ["grill", "griddle"],
  tapa: ["cover", "lid"], tabla: ["board", "cutting"], molde: ["mold", "pan", "bake"],
  juego: ["set", "system"], set: ["set", "system"], sistema: ["system"], combo: ["set", "system"],
  utensilio: ["utensil", "tool", "spatula", "turner"], espatula: ["spatula", "turner"], cucharon: ["ladle"],
  freidora: ["fryer", "fry", "air"], horno: ["oven", "roaster", "bake"], wok: ["wok"],
  vaso: ["cup", "tumbler", "jar"], jarra: ["pitcher", "jar", "carafe"], termo: ["thermal", "tumbler"],
  cocina: ["cooking", "cookware", "system"], acero: ["steel", "stainless"], piezas: ["pc", "piece"],
};

function expandirConsulta(q: string): Set<string> {
  const tokens = normalizarTexto(q).split(/\s+/).filter(Boolean);
  const out = new Set<string>();
  for (const t of tokens) {
    const r = raizPalabra(t);
    out.add(t); out.add(r);
    for (const s of SINONIMOS[t] || []) out.add(s);
    for (const s of SINONIMOS[r] || []) out.add(s);
  }
  return out;
}

/**
 * Busca en la lista de productos y devuelve hasta `max` resultados ordenados
 * por relevancia. Con consulta vacía devuelve los primeros `max` del catálogo
 * (útil para mostrar sugerencias desde antes de escribir).
 */
export function buscarProductos<T extends Record<string, any>>(productos: T[], consulta: string, max = 30): T[] {
  const q = normalizarTexto(consulta).trim();
  if (!q) return (productos || []).slice(0, max);
  const expandidos = expandirConsulta(q);
  return (productos || [])
    .map((p) => {
      // El NOMBRE pesa más que línea/categoría: así "licuadora" pone primero la
      // Power Blender y no sus accesorios (que comparten línea "Power Blender").
      const nombre = normalizarTexto(p.name);
      const resto = normalizarTexto([p.category, p.line, p.productFamily, p.brand].filter(Boolean).join(" "));
      const palabrasNombre = nombre.split(/[^a-z0-9]+/).filter(Boolean);
      const palabrasResto = resto.split(/[^a-z0-9]+/).filter(Boolean);
      let score = 0;
      if (nombre.includes(q)) score += 8;
      for (const t of expandidos) {
        if (!t) continue;
        if (nombre.includes(t)) { score += 3; continue; }
        if (resto.includes(t)) { score += 1; continue; }
        // Prefijos en ambos sentidos: "licuad"→"licuadora", "blend"→"blender".
        if (t.length >= 3 && palabrasNombre.some((w) => w.startsWith(t) || (w.length >= 3 && t.startsWith(w)))) { score += 2; continue; }
        if (t.length >= 3 && palabrasResto.some((w) => w.startsWith(t) || (w.length >= 3 && t.startsWith(w)))) score += 1;
      }
      return { p, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map((x) => x.p);
}

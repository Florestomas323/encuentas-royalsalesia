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
  // Electrodomésticos
  licuadora: ["blender", "power"], batidora: ["blender", "mixer"], procesador: ["processor", "blender"],
  extractor: ["juicer", "extract"], exprimidor: ["juicer", "citrus"], jugo: ["juicer", "juice", "extract"],
  cafe: ["espresso", "barista", "coffee"], cafetera: ["espresso", "barista", "coffee"], greca: ["espresso", "coffee"],
  te: ["tea", "expertea", "kettle"], tetera: ["tea", "kettle", "expertea"], hervidor: ["kettle"],
  freidora: ["fryer", "fry"], vaporera: ["steamer", "steam"],
  arrocera: ["rice", "cooker"], parrilla: ["grill", "griddle"], plancha: ["griddle", "grill"],
  // Ollas y sartenes
  olla: ["pot", "cookware", "dutch", "saucepan", "stock", "casserole", "system", "roaster"],
  ollita: ["saucepan", "pot"], cacerola: ["saucepan", "casserole", "pot"], caldero: ["dutch", "stock", "pot"],
  perol: ["pot", "casserole"], sarten: ["skillet", "pan", "saute", "paella", "grill", "fry"],
  paellera: ["paella"], wok: ["wok"], horno: ["oven", "roaster", "bake"], asadera: ["roaster", "bake"],
  bateria: ["set", "system", "cookware"], multiolla: ["system", "pot", "cookware"],
  // Cuchillería y utensilios
  cuchillo: ["knife", "cutlery", "santoku", "chef"], cuchilleria: ["knife", "cutlery"],
  tijera: ["shear", "scissor"], utensilio: ["utensil", "tool", "spatula", "turner"],
  espatula: ["spatula", "turner"], cucharon: ["ladle"], pinza: ["tong"], tabla: ["board", "cutting"],
  colador: ["strainer", "colander"], rallador: ["grater"], pelador: ["peeler"],
  // Filtración
  filtro: ["filter", "fresca", "shower", "air", "purif"], purificador: ["filter", "fresca", "air", "water", "purif"],
  agua: ["water", "fresca"], aire: ["air"], ducha: ["ducha", "shower"], regadera: ["ducha", "shower"],
  cartucho: ["cartridge", "repuesto", "filter"], repuesto: ["cartridge", "repuesto", "replacement"],
  // Genéricos de venta
  juego: ["set", "system"], set: ["set", "system"], sistema: ["system"], combo: ["set", "system"],
  equipo: ["set", "system"], paquete: ["set", "system"], kit: ["kit", "set"],
  tapa: ["cover", "lid"], molde: ["mold", "pan", "bake"], bandeja: ["tray", "pan"],
  vaso: ["vaso", "cup", "tumbler", "jar"], jarra: ["jarra", "pitcher", "jar", "carafe"], termo: ["termo", "thermal", "tumbler", "vaso"],
  cocina: ["cooking", "cookware", "system"], acero: ["steel", "stainless"], inoxidable: ["stainless", "steel"],
  pieza: ["pc", "piece"], piezas: ["pc", "piece"], grande: ["grande", "large", "stock"], pequeno: ["small", "mini"],
  cuarto: ["qt"], cuartos: ["qt"], litro: ["l", "qt"], litros: ["l", "qt"], pulgada: ["in"], pulgadas: ["in"],
};

// Normaliza medidas y cantidades para que "12 piezas", "12pz", "12 qt" o
// "10 pulgadas" encuentren el producto aunque el catálogo los escriba distinto.
function tokensDeMedida(q: string): string[] {
  const out: string[] = [];
  const re = /(\d+)\s*(qt|q|l|lt|litros?|pulgadas?|pulg|in|"|piezas?|pzs?|pc|pcs)?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(q))) {
    const n = m[1];
    if (!n) continue;
    out.push(n);
    const u = (m[2] || "").toLowerCase();
    if (/^(qt|q|l|lt|litro)/.test(u)) out.push(`${n} qt`, `${n}qt`);
    if (/^(pulg|in|")/.test(u)) out.push(`${n}"`, `${n} in`);
    if (/^(pieza|pz|pc)/.test(u)) out.push(`${n} pc`, `${n} piezas`, `${n} pieza`);
  }
  return out;
}

function expandirConsulta(q: string): Set<string> {
  const norm = normalizarTexto(q);
  const tokens = norm.split(/\s+/).filter(Boolean);
  const out = new Set<string>();
  for (const t of tokensDeMedida(norm)) out.add(t);
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

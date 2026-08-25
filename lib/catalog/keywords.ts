// Índice INVISIBLE de palabras clave por producto.
//
// Estas palabras NUNCA se muestran en la interfaz: solo alimentan el buscador
// para que un vendedor (o un cliente al lado) encuentre el producto con la
// jerga que realmente usa — "tamalera", "comal", "greca", "picatodo",
// "olla para sancocho", "filtro de regadera".
//
// Cómo funciona: cada regla tiene un patrón que se prueba contra el nombre,
// la línea y la categoría del producto. Si coincide, ese producto hereda todas
// las palabras de la regla. Así no hay que mantener 179 listas a mano y los
// productos nuevos del catálogo heredan la jerga automáticamente.

type Regla = { patron: RegExp; palabras: string[] };

const REGLAS: Regla[] = [
  // ---------- Sistemas de cocina ----------
  {
    patron: /sistema de cocina|cooking system/i,
    palabras: [
      "juego de ollas", "set de ollas", "bateria de cocina", "ollas royal", "ollas de acero",
      "ollas quirurgicas", "ollas que no necesitan aceite", "juego de cocina", "set para cocinar",
      "multiolla", "combo de ollas", "equipo de cocina", "acero quirurgico", "sin aceite",
      "ollas quirurgicas", "ollas de acero quirurgico", "juego quirurgico",
    ],
  },

  // ---------- Sartenes ----------
  {
    patron: /sart[eé]n(?!.*protector)/i,
    palabras: [
      "sarten", "frying pan", "sarten antiadherente", "sarten sin aceite", "sarten para freir",
      "sarten de acero", "sarten con tapa", "freidor", "para freir", "antiadherente",
    ],
  },
  {
    patron: /sart[eé]n profundo/i,
    palabras: ["sarten hondo", "sarten profundo", "cacerola honda", "saute pan", "sarten para guisar"],
  },
  {
    patron: /multipan/i,
    palabras: [
      "multipan", "sarten multiuso", "olla multiuso", "sarten con colador", "vaporera",
      "olla vaporera", "sarten para hervir", "sarten para asar", "sarten para hornear",
    ],
  },
  {
    patron: /paellera/i,
    palabras: ["paellera", "paella pan", "sarten para arroz", "caldero para arroz", "sarten grande"],
  },

  // ---------- Ollas ----------
  {
    patron: /olla de presi[oó]n/i,
    palabras: [
      "olla de presion", "olla presion", "olla express", "olla expres", "pressure cooker",
      "olla rapida", "olla para frijoles", "olla para caraotas", "olla para carnes",
    ],
  },
  {
    patron: /olla grande|60 qt|30 qt|20 qt|12 qt/i,
    palabras: [
      "olla grande", "olla gigante", "olla para fiesta", "olla para eventos", "olla tamalera",
      "tamalera", "olla para tamales", "vaporera grande", "olla para sopa", "olla para sancocho",
      "olla para mondongo", "olla para hallacas", "olla para negocio", "olla para restaurante",
      "olla familiar", "olla para pozole", "olla para caldo",
    ],
  },
  {
    patron: /^olla |olla novel|olla elite|olla deluxe/i,
    palabras: ["olla", "cazuela", "caldero", "pot", "olla con tapa", "olla de acero", "olla quirurgica"],
  },
  {
    patron: /parrilla para olla/i,
    palabras: [
      "parrilla para tamales", "rejilla para olla", "vaporera", "canastilla para vapor",
      "rack para tamalera", "base para cocinar al vapor", "rejilla",
    ],
  },
  {
    patron: /pavera/i,
    palabras: [
      "pavera", "pavera ovalada", "rosticera", "asadera", "olla para pavo", "bandeja para pavo",
      "roaster", "olla para horno", "olla para pernil", "para navidad", "para thanksgiving",
    ],
  },
  {
    patron: /cacerola/i,
    palabras: ["cacerola", "cazuela", "sarten pequeno", "olla pequena", "olla individual", "cacerolita"],
  },
  {
    patron: /hervidor/i,
    palabras: [
      "hervidor", "jarrito", "ollita para leche", "lechera", "olla pequena",
      "calentador de leche", "jarro para salsa",
    ],
  },
  {
    patron: /perfect pop/i,
    palabras: [
      "palomitero", "olla para palomitas", "popcorn maker", "crispetera", "cotufera",
      "pochoclera", "olla para cotufas", "palomitas", "cotufas", "crispetas",
    ],
  },

  // ---------- Planchas y parrillas ----------
  {
    patron: /plancha sencilla/i,
    palabras: [
      "plancha", "comal", "budare", "plancha para arepas", "plancha para tortillas",
      "plancha para huevos", "plancha para carne", "griddle", "comal para tortillas",
    ],
  },
  {
    patron: /plancha doble/i,
    palabras: [
      "plancha doble", "comal grande", "budare grande", "plancha para tortillas",
      "plancha para desayuno", "griddle doble", "comal", "budare",
    ],
  },
  {
    patron: /parrilla redonda/i,
    palabras: ["parrilla", "grill", "asador", "parrilla para carne", "plancha redonda", "grill redondo"],
  },

  // ---------- Electrodomésticos ----------
  {
    patron: /power blender max|fresh max/i,
    palabras: [
      "licuadora", "blender", "licuadora potente", "licuadora profesional", "licuadora para batidos",
      "licuadora para smoothies", "licuadora de vaso", "batidora", "para batidos", "para jugos",
    ],
  },
  {
    patron: /power blender go/i,
    palabras: [
      "licuadora de mano", "batidora de mano", "batidor de inmersion", "licuadora inalambrica",
      "minipimer", "immersion blender", "licuadora portatil", "licuadora pequena",
    ],
  },
  {
    patron: /batidor de (silicona|globo)|batidor$/i,
    palabras: ["batidor", "batidor manual", "whisk", "globo", "batidor de huevos", "batidor para mezclar"],
  },
  {
    patron: /recipiente para picar/i,
    palabras: ["picador", "procesador pequeno", "mini procesador", "triturador", "picatodo", "recipiente picador"],
  },
  {
    patron: /extractor de jugos/i,
    palabras: [
      "extractor de jugos", "extractor", "juicer", "maquina de jugos", "prensa de jugos",
      "extractor lento", "slow juicer", "jugos verdes", "para jugos verdes", "juguera",
    ],
  },
  {
    patron: /exprimidor/i,
    palabras: ["exprimidor", "exprimidor de naranja", "exprimidor de citricos", "juguera", "citrus juicer"],
  },
  {
    patron: /precision cook|smart temp/i,
    palabras: [
      "parrilla de induccion", "cocina de induccion", "estufa portatil", "hornilla electrica",
      "cocina electrica", "induccion portatil", "induccion", "estufa",
    ],
  },

  // ---------- Cuchillos y preparación ----------
  {
    patron: /cuchillo de chef|hacha de cocina/i,
    palabras: ["cuchillo chef", "cuchillo cocinero", "cuchillo grande", "cuchillo para picar", "cuchillo profesional"],
  },
  {
    patron: /santoku/i,
    palabras: ["santoku", "cuchillo japones", "cuchillo para verduras", "cuchillo para picar"],
  },
  {
    patron: /churrasco|para carne/i,
    palabras: ["cuchillo de carne", "cuchillo steak", "cuchillo para bistec", "cuchillo churrasco", "para asado"],
  },
  { patron: /para pan/i, palabras: ["cuchillo de pan", "cuchillo serrucho", "cuchillo dentado"] },
  {
    patron: /trinchar/i,
    palabras: ["cuchillo para pavo", "cuchillo para pernil", "cuchillo para asado", "cuchillo trinche", "trinche"],
  },
  {
    patron: /mondador|de pelar|multiusos/i,
    palabras: ["cuchillo pequeno", "cuchillo para pelar", "cuchillo mondador", "paring knife"],
  },
  { patron: /fileteador/i, palabras: ["cuchillo fileteador", "cuchillo para pescado", "cuchillo para filetear"] },
  {
    patron: /tijeras/i,
    palabras: ["tijeras", "tijera de cocina", "kitchen shears", "tijera para pollo", "tijera para alimentos"],
  },
  { patron: /afilador|sharpener/i, palabras: ["afilador", "chaira", "afila cuchillos", "sharpening steel"] },
  {
    patron: /tabla para cortar|bloque de madera|knife block/i,
    palabras: [
      "tabla de picar", "tabla de cortar", "chopping board", "tabla para carne", "tabla para verduras",
      "bloque de cuchillos", "porta cuchillos", "cuchilleria",
    ],
  },
  {
    patron: /salad machine|rallador|cono para/i,
    palabras: [
      "rallador", "rebanador", "cortador de verduras", "maquina de ensalada", "mandolina",
      "rallador de queso", "cortador de papa", "procesador manual", "para papas fritas",
    ],
  },

  // ---------- Café, té y mesa ----------
  {
    patron: /barista(?!rt)/i,
    palabras: ["cafetera", "prensa francesa", "french press", "cafetera de prensa", "cafetera grande", "jarra para cafe"],
  },
  {
    patron: /royal espresso/i,
    palabras: ["cafetera italiana", "moka", "moka pot", "greca", "cafetera de estufa", "cafetera espresso", "cafetera"],
  },
  { patron: /expertea/i, palabras: ["tetera", "hervidor de te", "kettle", "tetera para infusiones", "jarra para te"] },
  {
    patron: /chocolatera/i,
    palabras: ["chocolatera", "olla para chocolate", "jarra para chocolate", "chocolate caliente", "hervidor de leche"],
  },
  {
    patron: /baristart/i,
    palabras: ["kit barista", "espumador de leche", "molinillo de cafe", "grinder", "frother", "accesorios para cafe"],
  },
  {
    patron: /vasos|copas|tequileros|tazas/i,
    palabras: [
      "vasos", "vasos de agua", "vasos cortos", "copas de vino", "copas", "shots", "caballitos",
      "vasos tequileros", "cristaleria", "termo", "para tomar",
    ],
  },

  // ---------- Accesorios ----------
  {
    patron: /mixing bowls|taz[oó]n para mezclar/i,
    palabras: ["bowls", "tazones", "tazones para mezclar", "recipientes con tapa", "bowl de acero", "ensaladera", "ponchera"],
  },
  {
    patron: /warmer pro/i,
    palabras: [
      "calentador de tortillas", "tortillero", "calentador de arepas", "arepera para mantener caliente",
      "calentador de comida", "mantener caliente",
    ],
  },
  {
    patron: /precision series 3/i,
    palabras: [
      "pelador", "rallador", "destapador", "espatula", "cortapizza", "machacador",
      "batidor de globo", "utensilios de cocina", "gadgets",
    ],
  },
  {
    patron: /utensilios de cocina|juego de utensilios|cuchar[oó]n|espátula|cuchara|tenedor/i,
    palabras: [
      "cucharon", "cuchara", "espatula", "tenedor de servir", "cuchara para pasta",
      "cucharon para sopa", "juego de cocina", "utensilios", "cubiertos",
    ],
  },
  {
    patron: /recipientes para almacenar/i,
    palabras: ["tuppers", "envases", "recipientes", "contenedores de comida", "envases con tapa", "storage containers", "potes"],
  },
  {
    patron: /colador|steamer/i,
    palabras: ["colador", "escurridor", "vaporera", "colador para pasta", "colador para sopa", "canastilla vaporera"],
  },

  // ---------- Filtración ----------
  {
    patron: /frescaflow/i,
    palabras: [
      "filtro de agua", "purificador de agua", "osmosis inversa", "filtro bajo fregadero",
      "filtro para cocina", "agua purificada", "purificador",
    ],
  },
  {
    patron: /frescapure (?!filtro para ducha)|filtraci[oó]n de agua/i,
    palabras: [
      "filtro de agua", "purificador", "filtro de llave", "filtro de grifo",
      "filtro para fregadero", "filtro de carbon", "purificador de agua",
    ],
  },
  {
    patron: /ducha/i,
    palabras: ["filtro de ducha", "filtro para regadera", "purificador de ducha", "filtro de bano", "filtro de cloro", "regadera"],
  },
  {
    patron: /filtraci[oó]n de aire/i,
    palabras: [
      "purificador de aire", "filtro de aire", "air purifier", "limpiador de aire",
      "filtro para polvo", "filtro para polen", "filtro para humo", "para alergias",
    ],
  },

  // ---------- Repuestos ----------
  {
    patron: /cartucho|filtro de repuesto|repuesto/i,
    palabras: ["repuesto", "cartucho", "recambio", "filtro nuevo", "cambio de filtro"],
  },
  { patron: /tapa/i, palabras: ["tapa", "cover", "lid", "tapadera"] },
];

// Modificadores que la gente añade y que no deben impedir encontrar el producto.
const RUIDO = new Set([
  "profesional", "grande", "familiar", "para", "de", "el", "la", "los", "las", "un", "una",
  "negocio", "restaurante", "inoxidable", "portatil", "electrico", "facil", "limpiar", "con", "sin",
]);

export function esPalabraDeRuido(t: string): boolean {
  return RUIDO.has(t);
}

const cache = new Map<string, string>();

/**
 * Devuelve, en una sola cadena normalizada, todas las palabras clave ocultas
 * que aplican a un producto. Se cachea por id para no recalcular en cada tecla.
 */
export function palabrasClaveDe(p: { id?: string; name?: string; line?: string; category?: string }): string {
  const clave = p.id || p.name || "";
  const enCache = cache.get(clave);
  if (enCache !== undefined) return enCache;

  // Los accesorios y repuestos NO deben heredar la jerga del producto principal
  // de su línea: un "Batidor de silicona" de la línea Power Blender no puede
  // aparecer cuando el vendedor busca "licuadora de mano". Para ellos solo se
  // evalúa el nombre; para el resto, también línea y categoría.
  const esAccesorio = /accessory|accesorio|repuesto|replacement|part/i.test(
    `${p.category || ""}`,
  );
  const contexto = esAccesorio
    ? `${p.name || ""}`
    : `${p.name || ""} ${p.line || ""} ${p.category || ""}`;
  const palabras: string[] = [];
  for (const r of REGLAS) {
    if (r.patron.test(contexto)) palabras.push(...r.palabras);
  }
  const texto = palabras
    .join(" ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  cache.set(clave, texto);
  return texto;
}

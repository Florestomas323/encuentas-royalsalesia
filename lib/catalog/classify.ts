// Clasificador de productos: única fuente de verdad para saber qué contenido
// puede generarse por producto. Se usa tanto para PRE-CALCULAR y guardar los
// flags en Firestore (seed/data) como en TIEMPO DE EJECUCIÓN (componente + API
// de IA), para no depender de que un documento viejo tenga el campo.
//
// Regla central: la IA NUNCA decide si un producto permite recetas. Eso sale de
// aquí (category / line / name), se persiste en Firestore y se le impone al modelo.

export type ContentCapabilities = {
  supportsRecipes: boolean;
  supportsUsageTips: boolean;
  supportsMaintenance: boolean;
  supportsCare: boolean;
  supportsInstallationTips: boolean;
};

export type ProductFamily =
  | "cooking"           // ollas, sartenes, sets de cocina
  | "food_appliance"    // licuadora, extractor de jugos, procesador
  | "filtration"        // agua, ducha, aire, filtros de reemplazo
  | "beverage_appliance" // café, té, espresso, chocolatera
  | "cutlery"           // cuchillos, cubiertos, utensilios, tablas
  | "accessory";        // bases, protectores, mantenimiento, almacenamiento

const COOKING_CATEGORIES = new Set([
  "cookware", "skillet", "griddle", "stock_pot", "pressure_cooker",
  "paella_pan", "casserole", "roaster", "cooking_system",
]);

const FILTRATION_CATEGORIES = new Set(["filtration", "replacement_filter"]);

const CUTLERY_CATEGORIES = new Set([
  "cutlery", "flatware", "kitchen_tool", "serving_utensil",
  "cutting_board", "servingware", "glassware",
]);

// Palabras que identifican un electrodoméstico que SÍ prepara alimentos.
const FOOD_APPLIANCE_RE =
  /blender|licuadora|juicer|extractor|jugo|precision cook|salad master|salad machine|ensalad|multipan|food processor|procesador/i;

// Palabras que identifican filtración/purificación (agua, ducha, aire).
const FILTRATION_RE = /filtr|ducha|shower|purif|fresca(flow|pure)|air filtration|aire/i;

// Palabras de café/té/bebidas calientes.
const BEVERAGE_RE = /barista|espresso|expertea|café|cafe|té |chocolatera|tazas|azucarera|jarro para leche/i;

type ClassifyInput = {
  category?: string | null;
  line?: string | null;
  name?: string | null;
  type?: string | null;
};

export function classifyFamily(p: ClassifyInput): ProductFamily {
  const cat = (p.category || "").toLowerCase();
  const hay = `${p.line || ""} ${p.name || ""}`.toLowerCase();

  // 1) Electrodoméstico de alimentos (por nombre/línea) => recetas.
  if (FOOD_APPLIANCE_RE.test(hay)) return "food_appliance";

  // 2) Cocina (cacerolas, sartenes, sets).
  if (COOKING_CATEGORIES.has(cat)) return "cooking";

  // 3) Filtración / purificación.
  if (FILTRATION_CATEGORIES.has(cat) || FILTRATION_RE.test(hay)) return "filtration";

  // 4) Café / té / bebidas.
  if (cat === "coffee_tea" || BEVERAGE_RE.test(hay)) return "beverage_appliance";

  // 5) Cuchillería, cubiertos, utensilios, tablas, vasos.
  if (CUTLERY_CATEGORIES.has(cat)) return "cutlery";

  // 6) Resto: accesorios, bases, mantenimiento, almacenamiento.
  return "accessory";
}

const CAPS: Record<ProductFamily, ContentCapabilities> = {
  cooking:            { supportsRecipes: true,  supportsUsageTips: true, supportsMaintenance: true,  supportsCare: true, supportsInstallationTips: false },
  food_appliance:     { supportsRecipes: true,  supportsUsageTips: true, supportsMaintenance: true,  supportsCare: true, supportsInstallationTips: false },
  filtration:         { supportsRecipes: false, supportsUsageTips: true, supportsMaintenance: true,  supportsCare: true, supportsInstallationTips: true  },
  beverage_appliance: { supportsRecipes: false, supportsUsageTips: true, supportsMaintenance: true,  supportsCare: true, supportsInstallationTips: false },
  cutlery:            { supportsRecipes: false, supportsUsageTips: true, supportsMaintenance: true,  supportsCare: true, supportsInstallationTips: false },
  accessory:          { supportsRecipes: false, supportsUsageTips: true, supportsMaintenance: false, supportsCare: true, supportsInstallationTips: false },
};

export function capabilitiesFor(p: ClassifyInput): ContentCapabilities {
  return { ...CAPS[classifyFamily(p)] };
}

export function supportsRecipes(p: ClassifyInput): boolean {
  return capabilitiesFor(p).supportsRecipes;
}

// ---------- Plan de fidelización dinámico ----------

// Tipos de contenido de cada etapa. La IA recibe estos tipos y los obedece.
export type ContentType =
  | "welcome" | "usage_tip" | "recipe" | "maintenance" | "care"
  | "satisfaction" | "referrals" | "complementary" | "installation_tip" | "reminder";

export type PlanStep = { dia: number; titulo: string; contentType: ContentType };

const TITULOS: Record<ContentType, string> = {
  welcome: "Bienvenida",
  usage_tip: "Consejo de uso",
  recipe: "Receta personalizada",
  maintenance: "Tip de mantenimiento",
  care: "Consejo de cuidado",
  satisfaction: "Seguimiento de satisfacción",
  referrals: "Solicitud de referidos",
  complementary: "Producto complementario",
  installation_tip: "Consejo de instalación",
  reminder: "Recordatorio de filtro",
};

export function tituloDe(t: ContentType): string {
  return TITULOS[t];
}

// Grupo del plan según el conjunto de productos comprados.
export type PlanTrack = "cooking" | "filtration" | "appliance" | "generic";

export function planTrackFor(families: ProductFamily[]): PlanTrack {
  if (families.some((f) => f === "cooking" || f === "food_appliance")) return "cooking";
  if (families.some((f) => f === "filtration")) return "filtration";
  if (families.some((f) => f === "beverage_appliance")) return "appliance";
  return "generic";
}

const TRACKS: Record<PlanTrack, PlanStep[]> = {
  // Cocina / electrodoméstico de alimentos: incluye receta en el día 7.
  cooking: [
    { dia: 1, titulo: TITULOS.welcome, contentType: "welcome" },
    { dia: 3, titulo: TITULOS.usage_tip, contentType: "usage_tip" },
    { dia: 7, titulo: TITULOS.recipe, contentType: "recipe" },
    { dia: 15, titulo: TITULOS.maintenance, contentType: "maintenance" },
    { dia: 30, titulo: TITULOS.satisfaction, contentType: "satisfaction" },
    { dia: 45, titulo: TITULOS.referrals, contentType: "referrals" },
    { dia: 60, titulo: TITULOS.complementary, contentType: "complementary" },
  ],
  // Filtración/purificación: sin receta; cuidado + mantenimiento + recordatorio.
  filtration: [
    { dia: 1, titulo: TITULOS.welcome, contentType: "welcome" },
    { dia: 3, titulo: TITULOS.usage_tip, contentType: "usage_tip" },
    { dia: 7, titulo: TITULOS.care, contentType: "care" },
    { dia: 15, titulo: TITULOS.maintenance, contentType: "maintenance" },
    { dia: 30, titulo: TITULOS.satisfaction, contentType: "satisfaction" },
    { dia: 45, titulo: TITULOS.referrals, contentType: "referrals" },
    { dia: 60, titulo: TITULOS.reminder, contentType: "reminder" },
  ],
  // Electrodomésticos de bebidas: sin receta de comida; uso + limpieza.
  appliance: [
    { dia: 1, titulo: TITULOS.welcome, contentType: "welcome" },
    { dia: 3, titulo: TITULOS.usage_tip, contentType: "usage_tip" },
    { dia: 7, titulo: TITULOS.care, contentType: "care" },
    { dia: 15, titulo: TITULOS.maintenance, contentType: "maintenance" },
    { dia: 30, titulo: TITULOS.satisfaction, contentType: "satisfaction" },
    { dia: 45, titulo: TITULOS.referrals, contentType: "referrals" },
    { dia: 60, titulo: TITULOS.complementary, contentType: "complementary" },
  ],
  // Accesorios/cuchillería: cuidado y uso, sin receta.
  generic: [
    { dia: 1, titulo: TITULOS.welcome, contentType: "welcome" },
    { dia: 3, titulo: TITULOS.usage_tip, contentType: "usage_tip" },
    { dia: 7, titulo: TITULOS.care, contentType: "care" },
    { dia: 15, titulo: TITULOS.maintenance, contentType: "maintenance" },
    { dia: 30, titulo: TITULOS.satisfaction, contentType: "satisfaction" },
    { dia: 45, titulo: TITULOS.referrals, contentType: "referrals" },
    { dia: 60, titulo: TITULOS.complementary, contentType: "complementary" },
  ],
};

/** Construye el plan de fidelización a partir de las familias de producto compradas. */
export function buildLoyaltyPlan(families: ProductFamily[]): PlanStep[] {
  return TRACKS[planTrackFor(families)].map((s) => ({ ...s }));
}

/** Lista de tipos de contenido permitidos para un conjunto de capacidades. */
export function allowedContentTypes(caps: ContentCapabilities): ContentType[] {
  const base: ContentType[] = ["welcome", "satisfaction", "referrals", "complementary"];
  if (caps.supportsUsageTips) base.push("usage_tip");
  if (caps.supportsRecipes) base.push("recipe");
  if (caps.supportsMaintenance) base.push("maintenance", "reminder");
  if (caps.supportsCare) base.push("care");
  if (caps.supportsInstallationTips) base.push("installation_tip");
  return base;
}

// ---------- Servicio postventa (Fase B) ----------
// Algunos productos deben mantenerse EMPACADOS hasta que el vendedor haga un
// servicio postventa presencial (curado de ollas, prueba/capacitación de un
// electrodoméstico, instalación de filtración). El catálogo ya trae
// postSaleServiceType, keepPackagedUntilService y serviceChecklist; aquí
// centralizamos etiquetas y un checklist de respaldo por si algún producto no
// lo trae.

export type ServiceType = "curing_preparation" | "testing_training" | "installation";

const SERVICE_LABELS: Record<ServiceType, string> = {
  curing_preparation: "Curado y preparación",
  testing_training: "Prueba y capacitación",
  installation: "Instalación",
};

export function serviceTypeLabel(t?: string | null): string {
  if (t && t in SERVICE_LABELS) return SERVICE_LABELS[t as ServiceType];
  return "Servicio postventa";
}

const FALLBACK_CHECKLISTS: Record<ServiceType, string[]> = {
  curing_preparation: [
    "Desempacar el producto junto al cliente",
    "Lavar y secar cada pieza",
    "Realizar el curado/preparación inicial",
    "Explicar el uso correcto de la tapa y el control de temperatura",
    "Resolver dudas del cliente",
    "Confirmar satisfacción con la preparación",
  ],
  testing_training: [
    "Desempacar el producto junto al cliente",
    "Verificar que enciende y funciona correctamente",
    "Hacer una prueba de funcionamiento con el cliente",
    "Explicar el uso y las funciones principales",
    "Explicar limpieza y cuidado",
    "Confirmar satisfacción del cliente",
  ],
  installation: [
    "Verificar el punto de instalación",
    "Instalar el producto",
    "Comprobar que no haya fugas / que funcione",
    "Explicar el uso correcto",
    "Explicar el mantenimiento y el cambio de filtro",
    "Confirmar satisfacción del cliente",
  ],
};

// Mensaje PREDETERMINADO para coordinar el servicio con el cliente por
// WhatsApp, según el tipo de servicio del producto comprado. No usa IA:
// plantillas fijas, cálidas y accionables, listas para enviar al vender.
export function serviceCoordinationMessage(args: {
  customerName?: string;
  productName?: string;
  serviceType?: string | null;
  sellerName?: string;
}): string {
  const nombre = (args.customerName || "").trim();
  const saludo = nombre ? `Hola ${nombre} 👋` : "Hola 👋";
  const firma = args.sellerName ? ` Soy ${args.sellerName}, su asesor de Royal Prestige.` : "";
  const producto = args.productName || "su producto Royal Prestige";

  switch (args.serviceType) {
    case "curing_preparation":
      return `${saludo}${firma} ¡Felicidades por su ${producto}! 🎉 Para estrenarlo como se debe, el siguiente paso es el curado y la preparación inicial — es un servicio sin costo que hago yo mismo en su casa. Mientras tanto, le recomiendo mantenerlo empacado. ¿Qué día y hora de esta semana le queda bien para agendarlo?`;
    case "testing_training":
      return `${saludo}${firma} ¡Felicidades por su ${producto}! 🎉 El siguiente paso es la prueba de funcionamiento y una capacitación rápida para que le saque todo el provecho desde el primer día — sin costo. Le recomiendo mantenerlo empacado hasta esa visita. ¿Qué día y hora le queda bien esta semana?`;
    case "installation":
      return `${saludo}${firma} ¡Felicidades por su ${producto}! 🎉 El siguiente paso es coordinar la instalación para dejarlo funcionando y explicarle su mantenimiento — sin costo. ¿Qué día y hora de esta semana le queda bien para agendarla?`;
    default:
      return `${saludo}${firma} ¡Felicidades por su ${producto}! 🎉 Quiero coordinar con usted el servicio de entrega y puesta en marcha para que quede funcionando perfecto. ¿Qué día y hora de esta semana le queda bien?`;
  }
}

/**
 * Devuelve el checklist a usar para un servicio: el del producto si existe, o
 * el de respaldo según el tipo. Siempre devuelve al menos un paso.
 */
export function serviceChecklistFor(p: {
  postSaleServiceType?: string | null;
  serviceChecklist?: string[] | null;
}): string[] {
  if (Array.isArray(p.serviceChecklist) && p.serviceChecklist.length) {
    return [...p.serviceChecklist];
  }
  const t = p.postSaleServiceType as ServiceType;
  return [...(FALLBACK_CHECKLISTS[t] || FALLBACK_CHECKLISTS.testing_training)];
}

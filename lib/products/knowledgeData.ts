import type { ProductKnowledge } from "./productKnowledge";

/**
 * FICHAS OFICIALES DE PRODUCTO (datos, sin lógica).
 *
 * Este archivo es la FUENTE de la colección `productKnowledge` de Firestore:
 * el endpoint /api/admin/seed-product-knowledge lo escribe tal cual, y el
 * Copilot lee de Firestore.
 *
 * REGLAS DURAS DE ESTE ARCHIVO:
 *  - Todo dato viene de una fuente oficial y lleva su `sourceId`.
 *  - Lo que la fuente no dice, NO se escribe: se deja `null` o `[]`. Nunca se
 *    estima una dimensión, un material ni una capacidad porque "debería existir".
 *  - `salesArguments` y `objections` son REFORMULACIÓN COMERCIAL de hechos ya
 *    aprobados (cada uno apunta a los claims que lo sostienen). No añaden
 *    hechos nuevos.
 *
 * `productId` es el id del catálogo (lib/catalog/data.ts), no el id del
 * documento de Firestore: el catálogo se siembra por organización con el
 * prefijo `${orgId}__`, y la ficha es contenido maestro GLOBAL.
 *
 * Para añadir más productos (sistemas de cocina, ollas de presión, filtración,
 * cuchillos, etc.) basta con crear otra constante con esta misma forma y
 * añadirla a PRODUCT_KNOWLEDGE. No hay que tocar nada más.
 */

// Identificadores de fuente, compartidos por todas las fichas.
export const SRC_PRODUCT_PAGE = "royalprestige-product-page";
export const SRC_CATALOG = "royalprestige-catalog-usa-06-26";
export const SRC_WARRANTY = "royalprestige-warranty";

const MULTIPAN: ProductKnowledge = {
  productId: "royal-multipan",
  name: "Royal Prestige® MultiPan",
  slug: "royal-multipan",
  category: "Utensilios de cocina",
  active: true,

  description: {
    short:
      "Utensilio multifuncional Royal Prestige® diseñado para realizar múltiples técnicas de cocción en una sola pieza.",
    full: null, // La página individual del producto aún no se ha incorporado.
  },

  benefits: [
    "Ofrece 11 funciones en un solo utensilio.",
    "Permite preparar distintos tipos de recetas de forma práctica.",
    "Puede utilizarse para cocinar al vapor, hervir, sellar, sofreír, saltear, dorar, asar, brasear, cocinar a fuego lento, hornear y colar.",
    "Está diseñada para ofrecer versatilidad en la cocina.",
    "Tiene garantía limitada de 50 años bajo las condiciones oficiales de Hy Cite.",
  ],

  features: [
    {
      title: "11 funciones de cocción en una sola pieza",
      description:
        "Sellar, brasear, hervir, sofreír, saltear, dorar, colar, asar, cocer a fuego lento, cocer al vapor y hornear.",
      sourceId: SRC_CATALOG,
    },
    {
      title: "Temperatura máxima de las asas",
      description: "204 °C / 400 °F.",
      sourceId: SRC_CATALOG,
    },
    {
      title: "Garantía limitada de 50 años",
      description: "Desde la fecha de compra, bajo las condiciones oficiales de Hy Cite.",
      sourceId: SRC_WARRANTY,
    },
    {
      title: "Aro silicromático",
      description:
        "Cuando esté disponible, tiene cobertura de 1 año desde la fecha de compra por defectos de material y mano de obra.",
      sourceId: SRC_WARRANTY,
    },
  ],

  // La fuente disponible no detalla los componentes incluidos: se dice, no se inventa.
  included: [],
  includedNote:
    "La información detallada sobre los componentes incluidos no está disponible en esta ficha.",

  specifications: {
    capacity: null,      // sin dato oficial
    material: null,      // sin dato oficial
    dimensions: null,    // sin dato oficial — nunca estimar
    temperatureLimit: { value: "204 °C / 400 °F (asas)", sourceId: SRC_CATALOG },
    compatibility: null, // sin dato oficial
    other: [],
  },

  functions: [
    "Sellar",
    "Brasear",
    "Hervir",
    "Sofreír",
    "Saltear",
    "Dorar",
    "Colar",
    "Asar",
    "Cocer a fuego lento",
    "Cocer al vapor",
    "Hornear",
  ],

  // La fuente disponible no detalla instrucciones paso a paso de uso.
  usage: [],

  care: [
    "Seguir las instrucciones oficiales de uso y cuidado proporcionadas por Royal Prestige®.",
    "Evitar prácticas que puedan ocasionar daños por uso incorrecto.",
    "Si se necesita información específica de mantenimiento, consultar la documentación oficial del producto.",
  ],

  warranty: {
    summary:
      "La Royal Prestige® MultiPan cuenta con una garantía limitada de 50 años desde la fecha de compra, bajo las condiciones establecidas por Hy Cite.",
    duration: "50 años desde la fecha de compra.",
    coverage: [
      "Libre de defectos de material y/o mano de obra.",
      "No debe mancharse permanentemente bajo las condiciones cubiertas.",
      "No debe oxidarse bajo las condiciones cubiertas.",
      "No debe derretirse bajo las condiciones cubiertas.",
      "No debe romperse bajo las condiciones cubiertas.",
      "No debe agrietarse permanentemente bajo las condiciones cubiertas.",
    ],
    exclusions: [],
    specialParts: [
      "El aro silicromático, cuando esté disponible, tiene cobertura de 1 año desde la fecha de compra por defectos de material y mano de obra.",
    ],
    claimInstructions: [],
    sourceId: SRC_WARRANTY,
  },

  postSale: {
    summary:
      "Las reclamaciones de garantía deben seguir el procedimiento oficial de Hy Cite / Royal Prestige®.",
    steps: [],
    contact: null,
  },

  recipes: {
    enabled: true,
    note:
      "La MultiPan es compatible con preparaciones que utilicen técnicas como sellar, sofreír, saltear, hervir, cocinar al vapor, cocinar a fuego lento, asar u hornear.",
    items: [],
  },

  faq: [],

  salesArguments: [
    {
      text:
        "En lugar de presentarla como otro sartén, preséntala como un utensilio que reúne 11 funciones diferentes en una sola pieza.",
      supportingClaims: ["11-functions"],
    },
    {
      text:
        "El respaldo también es argumento: es una pieza con garantía limitada de 50 años bajo las condiciones oficiales de Hy Cite.",
      supportingClaims: ["warranty-50y"],
    },
    {
      text:
        "Si el cliente pregunta por el horno, las asas resisten hasta 204 °C / 400 °F según el catálogo oficial.",
      supportingClaims: ["handles-204c"],
    },
  ],

  objections: [
    {
      objection: "Ya tengo suficientes sartenes.",
      suggestedResponse:
        "La diferencia es que MultiPan no está diseñada únicamente para funcionar como sartén. Reúne 11 funciones diferentes en un mismo utensilio.",
      supportingClaims: ["11-functions"],
    },
    {
      objection: "Es cara.",
      suggestedResponse:
        "Compárala con lo que reemplaza: son 11 funciones en una sola pieza, y está respaldada por una garantía limitada de 50 años bajo las condiciones oficiales de Hy Cite.",
      supportingClaims: ["11-functions", "warranty-50y"],
    },
  ],

  quickAnswer:
    "La Royal Prestige® MultiPan es un utensilio multifuncional que permite realizar 11 técnicas de cocción en una sola pieza: sellar, brasear, hervir, sofreír, saltear, dorar, colar, asar, cocinar a fuego lento, cocinar al vapor y hornear. Sus asas resisten hasta 204 °C/400 °F y cuenta con una garantía limitada de 50 años bajo las condiciones oficiales de Hy Cite.",

  approvedClaims: [
    { id: "11-functions", claim: "11 funciones en un utensilio.", sourceId: SRC_CATALOG },
    { id: "handles-204c", claim: "Asas resistentes hasta 204 °C / 400 °F.", sourceId: SRC_CATALOG },
    { id: "warranty-50y", claim: "Garantía limitada de 50 años.", sourceId: SRC_WARRANTY },
    {
      id: "silicromatic-1y",
      claim: "Aro silicromático cubierto durante 1 año cuando corresponda.",
      sourceId: SRC_WARRANTY,
    },
  ],

  prohibitedClaims: [
    "No afirmar beneficios médicos.",
    "No afirmar que previene enfermedades.",
    "No afirmar que conserva un porcentaje específico de nutrientes salvo que exista fuente oficial.",
    "No inventar especificaciones técnicas.",
    "No inventar materiales.",
    "No inventar dimensiones.",
    "No inventar recetas oficiales.",
    "No inventar condiciones de garantía.",
    "No prometer que cualquier daño será reemplazado.",
    "No ampliar la garantía más allá del texto aprobado.",
  ],

  sources: [
    {
      id: SRC_CATALOG,
      type: "catalog",
      title: "Catálogo de Productos Royal Prestige® USA — Versión 6 / 06-26",
      version: "06-26",
      verified: true,
    },
    {
      id: SRC_WARRANTY,
      type: "warranty",
      title: "Garantía limitada Royal Prestige®",
      url: "https://www.royalprestige.com/apoyo/garantia",
      verified: true,
    },
    {
      // Registrada para trazabilidad; todavía no hay datos extraídos de ella,
      // por eso `verified: false` y no se cita como fuente en las respuestas.
      id: SRC_PRODUCT_PAGE,
      type: "official_website",
      title: "Página oficial del producto — RoyalPrestige.com",
      url: "https://www.royalprestige.com/productos/detalle",
      verified: false,
    },
  ],
};

/** Todas las fichas aprobadas. Hoy solo MultiPan (producto piloto). */
export const PRODUCT_KNOWLEDGE: ProductKnowledge[] = [MULTIPAN];

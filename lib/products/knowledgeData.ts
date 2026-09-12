import type { ProductKnowledge } from "./productKnowledge";

/**
 * FICHAS OFICIALES DE PRODUCTO (datos, sin lógica).
 *
 * Este archivo es la FUENTE de la colección `productKnowledge` de Firestore:
 * el endpoint /api/admin/seed-product-knowledge lo escribe tal cual, y el
 * Copilot lee de Firestore. Todo lo que está aquí viene de fuentes oficiales
 * aprobadas; NADA se redacta ni se completa por intuición. Cuando un dato no
 * consta en la fuente, se dice explícitamente que no está disponible en lugar
 * de rellenarlo.
 *
 * `productId` es el id del catálogo (lib/catalog/data.ts), no el id del
 * documento de Firestore: el catálogo se siembra por organización con el
 * prefijo `${orgId}__`, y la ficha es contenido maestro GLOBAL, igual para
 * todas las distribuciones.
 */

const MULTIPAN: ProductKnowledge = {
  productId: "royal-multipan",
  name: "Royal Prestige® MultiPan",
  slug: "royal-multipan",
  category: "Utensilios de cocina",
  active: true,

  shortDescription:
    "Utensilio multifuncional Royal Prestige® diseñado para realizar múltiples técnicas de cocción en una sola pieza.",

  benefits: [
    "Ofrece 11 funciones en un solo utensilio.",
    "Permite preparar distintos tipos de recetas de forma práctica.",
    "Puede utilizarse para cocinar al vapor, hervir, sellar, sofreír, saltear, dorar, asar, brasear, cocinar a fuego lento, hornear y colar.",
    "Está diseñada para ofrecer versatilidad en la cocina.",
    "Tiene garantía limitada de 50 años bajo las condiciones oficiales de Hy Cite.",
  ],

  // La fuente disponible no detalla los componentes incluidos: se dice, no se inventa.
  included: [],
  includedNote:
    "La información detallada sobre los componentes incluidos no está disponible en esta ficha.",

  uses: [
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
  usesNote: "Las asas resisten hasta 204 °C / 400 °F según el catálogo oficial.",

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

  quickAnswer:
    "La Royal Prestige® MultiPan es un utensilio multifuncional que permite realizar 11 técnicas de cocción en una sola pieza: sellar, brasear, hervir, sofreír, saltear, dorar, colar, asar, cocinar a fuego lento, cocinar al vapor y hornear. Sus asas resisten hasta 204 °C/400 °F y cuenta con una garantía limitada de 50 años bajo las condiciones oficiales de Hy Cite.",

  approvedClaims: [
    "11 funciones en un utensilio.",
    "Asas resistentes hasta 204 °C / 400 °F.",
    "Garantía limitada de 50 años.",
    "Aro silicromático cubierto durante 1 año cuando corresponda.",
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
      type: "catalog",
      title: "Catálogo de Productos Royal Prestige® USA — Versión 6 / 06-26",
      version: "06-26",
    },
    {
      type: "warranty",
      title: "Garantía limitada Royal Prestige®",
      url: "https://www.royalprestige.com/apoyo/garantia",
    },
  ],
};

/** Todas las fichas aprobadas. Hoy solo MultiPan. */
export const PRODUCT_KNOWLEDGE: ProductKnowledge[] = [MULTIPAN];

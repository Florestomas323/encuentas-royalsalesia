// Conocimiento OFICIAL de garantías Royal Prestige / Hy Cite.
// Fuente única de verdad para el seed de la colección global `warrantyKnowledge`
// y respaldo en tiempo de ejecución cuando la colección aún no está sembrada.
// NO editar los textos: son citas oficiales que el Copilot muestra literalmente.

export interface WarrantyComponentCoverage {
  component: string;
  period: string;
}

export interface WarrantyKnowledge {
  id: string;
  scope: "global" | "category" | "line" | "product";
  productIds: string[];
  productName: string;
  coverageSummary: string;
  componentCoverage?: WarrantyComponentCoverage[];
  conditions?: string[];
  exclusions?: string[];
  claimRequirements?: string[];
  officialSourceUrl: string;
  sourceType: string;
  active: boolean;
}

export const WARRANTY_KNOWLEDGE: WarrantyKnowledge[] = [
  {
    "id": "warranty-global-policy",
    "scope": "global",
    "productIds": [],
    "productName": "Política general de Garantía Limitada Royal Prestige / Hy Cite",
    "coverageSummary": "Aplica a productos Hy Cite adquiridos mediante Distribuidor Autorizado Independiente y al propietario original; puede transferirse solo a familia inmediata. La cobertura puede limitarse a productos pagados completamente y cuentas en buen estado.",
    "conditions": [
      "Compra mediante Distribuidor Autorizado Independiente.",
      "Propietario original o transferencia permitida a familia inmediata.",
      "Uso doméstico normal.",
      "Producto pagado en su totalidad y cuenta en buen estado."
    ],
    "exclusions": [
      "Negligencia, ensamblaje, mantenimiento o servicio inapropiados.",
      "Reparaciones por personas no autorizadas.",
      "Uso comercial.",
      "Producto en condiciones insalubres o peligrosas que impidan inspección."
    ],
    "claimRequirements": [
      "Llamar al Centro de Servicio para obtener número de pre-autorización.",
      "Hy Cite decide si repara o reemplaza.",
      "El cliente normalmente asume el envío de devolución a Hy Cite."
    ],
    "officialSourceUrl": "https://www.royalprestige.com/apoyo/garantia",
    "sourceType": "official_royal_prestige",
    "active": true
  },
  {
    "id": "warranty-stainless-cookware",
    "scope": "category",
    "productIds": [
      "novel-skillet-8",
      "novel-skillet-10-5",
      "novel-saucepan-1-5qt",
      "novel-saucepan-2qt",
      "novel-dutch-oven-3qt",
      "novel-dutch-oven-4qt",
      "novel-dutch-oven-6qt",
      "novel-dutch-oven-8qt",
      "novel-paella-14",
      "novel-versatile-system-15",
      "novel-family-system-10",
      "novel-special-system-8",
      "novel-classic-system-7",
      "novel-complementary-system-5",
      "royal-casserole",
      "oval-roaster",
      "square-grill",
      "round-grill",
      "double-grill",
      "novel-paella-14-with-cover",
      "novel-paella-10-with-cover",
      "stock-pot-12qt",
      "stock-pot-20qt",
      "stock-pot-30qt",
      "stock-pot-60qt"
    ],
    "productName": "Utensilios de cocina de acero inoxidable y piezas relacionadas",
    "coverageSummary": "50 años desde la compra contra defectos de material/mano de obra y ciertos daños permanentes; el aro de silicona, donde esté disponible, tiene 1 año.",
    "componentCoverage": [
      {
        "component": "Utensilio de acero inoxidable / piezas relacionadas",
        "period": "50 años"
      },
      {
        "component": "Aro de silicona (donde aplique)",
        "period": "1 año"
      }
    ],
    "conditions": [
      "Uso doméstico normal y demás condiciones generales de la garantía."
    ],
    "exclusions": [],
    "officialSourceUrl": "https://www.royalprestige.com/apoyo/garantia",
    "sourceType": "official_royal_prestige",
    "active": true
  },
  {
    "id": "warranty-multipan",
    "scope": "product",
    "productIds": [
      "royal-multipan"
    ],
    "productName": "Royal Prestige MultiPan",
    "coverageSummary": "50 años para el producto, excepto el aro silicromático; el aro silicromático tiene 1 año.",
    "componentCoverage": [
      {
        "component": "MultiPan",
        "period": "50 años"
      },
      {
        "component": "Aro silicromático",
        "period": "1 año"
      }
    ],
    "conditions": [
      "Uso doméstico normal."
    ],
    "exclusions": [],
    "officialSourceUrl": "https://www.royalprestige.com/apoyo/garantia",
    "sourceType": "official_royal_prestige",
    "active": true
  },
  {
    "id": "warranty-deluxe-easy-release",
    "scope": "line",
    "productIds": [
      "deluxe-easy-release-skillet-8",
      "deluxe-easy-release-skillet-10",
      "deluxe-easy-release-skillet-12",
      "deluxe-easy-release-saucepan-2qt",
      "deluxe-easy-release-saucepan-3qt",
      "deluxe-easy-release-saute-10-5"
    ],
    "productName": "Royal Prestige Deluxe Easy Release",
    "coverageSummary": "5 años contra defectos de material y mano de obra, excepto aros de silicona.",
    "componentCoverage": [
      {
        "component": "Utensilios Deluxe Easy Release",
        "period": "5 años"
      }
    ],
    "conditions": [
      "Seguir instrucciones de uso y cuidado."
    ],
    "exclusions": [
      "Daños por sobrecalentamiento, choque térmico, caídas, utensilios/detergentes abrasivos o lavavajillas.",
      "Imperfecciones menores y variaciones de color que no afecten el rendimiento."
    ],
    "officialSourceUrl": "https://www.royalprestige.com/apoyo/garantia",
    "sourceType": "official_royal_prestige",
    "active": true
  },
  {
    "id": "warranty-elite",
    "scope": "line",
    "productIds": [
      "elite-cooking-system-5",
      "elite-skillet-10",
      "elite-casserole-3-5qt",
      "elite-cover-casserole-3-5qt",
      "elite-pot-4qt",
      "elite-cover-pot-4qt",
      "elite-skillet-8"
    ],
    "productName": "Royal Prestige Elite Cooking System",
    "coverageSummary": "50 años desde la compra original por defectos de materiales y mano de obra bajo uso doméstico normal. Incluye base, construcción tri-ply, tapa, asas, válvula, remaches, bordes sellados y recubrimiento Royal Prestige Guard. Empaque de silicona de tapa: 1 año.",
    "componentCoverage": [
      {
        "component": "Sistema / base / tri-ply / tapa / asas / válvula / remaches / bordes / recubrimiento Guard",
        "period": "50 años"
      },
      {
        "component": "Empaque de silicona de tapa",
        "period": "1 año"
      }
    ],
    "conditions": [
      "Uso doméstico normal.",
      "Para mayor durabilidad del recubrimiento, se recomiendan utensilios de madera, silicona o plástico."
    ],
    "exclusions": [
      "Desgaste normal y cambios estéticos que no interfieran con el desempeño.",
      "Daños por ciclos térmicos repetidos, impactos de utensilios, limpieza abrasiva, lavavajillas, golpes/caídas, choque térmico, uso indebido, abuso, manejo inadecuado, uso comercial o incumplimiento de instrucciones."
    ],
    "officialSourceUrl": "https://www.royalprestige.com/apoyo/garantia",
    "sourceType": "official_royal_prestige",
    "active": true
  },
  {
    "id": "warranty-pressure-cooker",
    "scope": "line",
    "productIds": [
      "pressure-cooker-6l",
      "pressure-cooker-10l"
    ],
    "productName": "Olla de Presión y piezas relacionadas",
    "coverageSummary": "Base, tapa de acero inoxidable y tapa de retención: 50 años. Partes plásticas como válvula, sistema de 3 abrazaderas y mangos: 10 años. Aro/juntas de silicona y juntas tóricas: 6 meses.",
    "componentCoverage": [
      {
        "component": "Base, tapa de acero inoxidable y tapa de retención",
        "period": "50 años"
      },
      {
        "component": "Partes plásticas",
        "period": "10 años"
      },
      {
        "component": "Aro/juntas de silicona y juntas tóricas",
        "period": "6 meses"
      }
    ],
    "conditions": [],
    "exclusions": [],
    "officialSourceUrl": "https://www.royalprestige.com/apoyo/garantia",
    "sourceType": "official_royal_prestige",
    "active": true
  },
  {
    "id": "warranty-perfect-pop",
    "scope": "product",
    "productIds": [
      "royal-perfect-pop"
    ],
    "productName": "Royal Prestige Perfect Pop",
    "coverageSummary": "3 años contra defectos de material o mano de obra.",
    "componentCoverage": [
      {
        "component": "Producto",
        "period": "3 años"
      }
    ],
    "conditions": [],
    "exclusions": [],
    "officialSourceUrl": "https://www.royalprestige.com/apoyo/garantia",
    "sourceType": "official_royal_prestige",
    "active": true
  },
  {
    "id": "warranty-smart-temp",
    "scope": "product",
    "productIds": [
      "royal-smart-temp"
    ],
    "productName": "Royal Prestige Smart Temp",
    "coverageSummary": "2 años para partes mecánicas cubiertas, incluyendo carcasa de acero inoxidable, mecanismo de esfera y cúpula de cristal templado.",
    "componentCoverage": [
      {
        "component": "Partes mecánicas cubiertas",
        "period": "2 años"
      }
    ],
    "conditions": [
      "Uso doméstico regular dentro de límites de temperatura recomendados."
    ],
    "exclusions": [
      "Uso indebido, modificaciones no autorizadas, temperaturas excesivas, impactos/caídas, químicos agresivos/corrosivos, agua/humedad excesiva, limpieza abrasiva o desmontaje no autorizado."
    ],
    "officialSourceUrl": "https://www.royalprestige.com/apoyo/garantia",
    "sourceType": "official_royal_prestige",
    "active": true
  },
  {
    "id": "warranty-warmer-pro",
    "scope": "product",
    "productIds": [
      "warmer-pro"
    ],
    "productName": "Royal Prestige Warmer Pro",
    "coverageSummary": "5 años para el producto (excluyendo batería); batería: 1 año.",
    "componentCoverage": [
      {
        "component": "Warmer Pro, excluyendo batería",
        "period": "5 años"
      },
      {
        "component": "Batería",
        "period": "1 año"
      }
    ],
    "conditions": [],
    "exclusions": [],
    "officialSourceUrl": "https://www.royalprestige.com/apoyo/garantia",
    "sourceType": "official_royal_prestige",
    "active": true
  },
  {
    "id": "warranty-precision-cook",
    "scope": "product",
    "productIds": [
      "precision-cook"
    ],
    "productName": "Royal Prestige Precision Cook",
    "coverageSummary": "1 año contra defectos de materiales y mano de obra.",
    "componentCoverage": [
      {
        "component": "Producto",
        "period": "1 año"
      }
    ],
    "conditions": [],
    "exclusions": [],
    "officialSourceUrl": "https://www.royalprestige.com/apoyo/garantia",
    "sourceType": "official_royal_prestige",
    "active": true
  },
  {
    "id": "warranty-cutlery-tools",
    "scope": "category",
    "productIds": [
      "knife-carving",
      "fork-carving",
      "knife-chef",
      "knife-filet",
      "knife-bread",
      "knife-santoku-7",
      "knife-paring",
      "sharpening-steel",
      "kitchen-shears",
      "knife-paring-2-75",
      "cleaver-7",
      "churrasco-knives",
      "knife-santoku-3-5",
      "knife-damascus-santoku-5",
      "knife-utility-5",
      "knife-santoku-5",
      "royal-sharpener",
      "knife-block-acacia",
      "kitchen-knife-set-5",
      "carving-knife-set-4",
      "steak-knife-set-4",
      "all-in-one-knife-block",
      "salad-machine"
    ],
    "productName": "Cuchillos, afiladores, bloques, herramientas de cocina y cortadores de alimentos",
    "coverageSummary": "50 años contra defectos de materiales y mano de obra. Piezas de silicona, como cabezales de espátulas: 2 años.",
    "componentCoverage": [
      {
        "component": "Cuchillos / afiladores / bloques / herramientas / cortadores",
        "period": "50 años"
      },
      {
        "component": "Piezas de silicona",
        "period": "2 años"
      }
    ],
    "conditions": [
      "Uso correcto y afilado periódico cuando aplique."
    ],
    "exclusions": [],
    "officialSourceUrl": "https://www.royalprestige.com/apoyo/garantia",
    "sourceType": "official_royal_prestige",
    "active": true
  },
  {
    "id": "warranty-cutting-boards",
    "scope": "category",
    "productIds": [
      "bamboo-cutting-board",
      "small-bamboo-cutting-board"
    ],
    "productName": "Tablas de cortar",
    "coverageSummary": "2 años contra defectos de material y mano de obra.",
    "componentCoverage": [
      {
        "component": "Tabla de cortar",
        "period": "2 años"
      }
    ],
    "conditions": [],
    "exclusions": [],
    "officialSourceUrl": "https://www.royalprestige.com/apoyo/garantia",
    "sourceType": "official_royal_prestige",
    "active": true
  },
  {
    "id": "warranty-flatware",
    "scope": "category",
    "productIds": [
      "americana-cutlery-set-24",
      "americana-teaspoon",
      "americana-table-knife",
      "americana-table-fork",
      "americana-salad-fork",
      "americana-dessert-spoon",
      "americana-soup-spoon"
    ],
    "productName": "Cubiertos Royal Prestige",
    "coverageSummary": "50 años contra defectos de material o mano de obra y ciertos daños permanentes.",
    "componentCoverage": [
      {
        "component": "Cubiertos",
        "period": "50 años"
      }
    ],
    "conditions": [],
    "exclusions": [],
    "officialSourceUrl": "https://www.royalprestige.com/apoyo/garantia",
    "sourceType": "official_royal_prestige",
    "active": true
  },
  {
    "id": "warranty-expertea",
    "scope": "product",
    "productIds": [
      "expertea"
    ],
    "productName": "Royal Prestige ExperTea",
    "coverageSummary": "50 años contra defectos de material y mano de obra.",
    "componentCoverage": [
      {
        "component": "Producto",
        "period": "50 años"
      }
    ],
    "conditions": [],
    "exclusions": [
      "Arañazos, pequeñas imperfecciones y variaciones de color debidas a sobrecalentamiento, caídas o limpieza abrasiva que no afecten rendimiento."
    ],
    "officialSourceUrl": "https://www.royalprestige.com/apoyo/garantia",
    "sourceType": "official_royal_prestige",
    "active": true
  },
  {
    "id": "warranty-barista",
    "scope": "product",
    "productIds": [
      "barista"
    ],
    "productName": "Royal Prestige Barista",
    "coverageSummary": "50 años contra defectos de material y/o mano de obra.",
    "componentCoverage": [
      {
        "component": "Producto",
        "period": "50 años"
      }
    ],
    "conditions": [],
    "exclusions": [
      "Rayaduras, pequeñas imperfecciones y variaciones de color por sobrecalentamiento, caídas o limpieza abrasiva que no afecten rendimiento."
    ],
    "officialSourceUrl": "https://www.royalprestige.com/apoyo/garantia",
    "sourceType": "official_royal_prestige",
    "active": true
  },
  {
    "id": "warranty-baristart",
    "scope": "product",
    "productIds": [
      "baristart-kit"
    ],
    "productName": "Royal Prestige BaristArt Kit",
    "coverageSummary": "1 año contra defectos de fabricación o materiales.",
    "componentCoverage": [
      {
        "component": "Kit",
        "period": "1 año"
      }
    ],
    "conditions": [],
    "exclusions": [],
    "officialSourceUrl": "https://www.royalprestige.com/apoyo/garantia",
    "sourceType": "official_royal_prestige",
    "active": true
  },
  {
    "id": "warranty-power-blender-max",
    "scope": "line",
    "productIds": [
      "power-blender-max",
      "tritan-jar",
      "max-cup-set-2"
    ],
    "productName": "Power Blender Max, Jarra de Tritán y Max Cup",
    "coverageSummary": "7 años para Power Blender Max, Jarra de Tritán y Max Cup, excepto presionador, cable eléctrico desmontable y aro de silicona. Presionador y cable: 2 años. Aro de silicona: 1 año.",
    "componentCoverage": [
      {
        "component": "Power Blender Max / Jarra de Tritán / Max Cup",
        "period": "7 años"
      },
      {
        "component": "Presionador y cable eléctrico desmontable",
        "period": "2 años"
      },
      {
        "component": "Aro de silicona",
        "period": "1 año"
      }
    ],
    "conditions": [],
    "exclusions": [
      "Cambios de color o apariencia de la jarra que no afecten rendimiento."
    ],
    "officialSourceUrl": "https://www.royalprestige.com/apoyo/garantia",
    "sourceType": "official_royal_prestige",
    "active": true
  },
  {
    "id": "warranty-fresh-max",
    "scope": "product",
    "productIds": [
      "fresh-max"
    ],
    "productName": "Royal Prestige Fresh Max",
    "coverageSummary": "2 años contra defectos de fabricación o materiales.",
    "componentCoverage": [
      {
        "component": "Bomba de vacío Fresh Max",
        "period": "2 años"
      }
    ],
    "conditions": [],
    "exclusions": [],
    "officialSourceUrl": "https://www.royalprestige.com/apoyo/garantia",
    "sourceType": "official_royal_prestige",
    "active": true
  },
  {
    "id": "warranty-power-blender-go",
    "scope": "product",
    "productIds": [
      "power-blender-go"
    ],
    "productName": "Royal Prestige Power Blender Go / Go Plus",
    "coverageSummary": "2 años contra defectos de fabricación o materiales.",
    "componentCoverage": [
      {
        "component": "Producto",
        "period": "2 años"
      }
    ],
    "conditions": [],
    "exclusions": [],
    "officialSourceUrl": "https://www.royalprestige.com/apoyo/garantia",
    "sourceType": "official_royal_prestige",
    "active": true
  },
  {
    "id": "warranty-royal-espresso",
    "scope": "line",
    "productIds": [
      "royal-espresso-10",
      "royal-espresso-4"
    ],
    "productName": "Royal Prestige Espresso",
    "coverageSummary": "1 año contra defectos de material o mano de obra.",
    "componentCoverage": [
      {
        "component": "Producto",
        "period": "1 año"
      }
    ],
    "conditions": [],
    "exclusions": [],
    "officialSourceUrl": "https://www.royalprestige.com/apoyo/garantia",
    "sourceType": "official_royal_prestige",
    "active": true
  },
  {
    "id": "warranty-glassware",
    "scope": "category",
    "productIds": [
      "london-tall-glasses-4",
      "london-short-glasses-4",
      "gala-wine-glasses-4",
      "tequila-shot-glasses-4"
    ],
    "productName": "Vasos, Copas y Jarras",
    "coverageSummary": "50 años; si una pieza se rompe, puede obtenerse repuesto pagando manejo y envío. Si no hay repuesto, puede aplicarse intercambio pieza por pieza por diseño de igual valor.",
    "componentCoverage": [
      {
        "component": "Vasos, copas y jarras",
        "period": "50 años"
      }
    ],
    "conditions": [
      "Sujeto a términos generales y disponibilidad."
    ],
    "exclusions": [],
    "officialSourceUrl": "https://www.royalprestige.com/apoyo/garantia",
    "sourceType": "official_royal_prestige",
    "active": true
  },
  {
    "id": "warranty-frescapure",
    "scope": "line",
    "productIds": [
      "frescapure-3500",
      "frescapure-5500",
      "frescapure-3500-cartridge",
      "frescapure-5500-filter"
    ],
    "productName": "Sistemas de Filtración de Agua FrescaPure",
    "coverageSummary": "Montura de base, cubierta del filtro y montura del surtidor: 15 años. Cartuchos: contra obstrucción durante 90 días. Partes eléctricas: 1 año.",
    "componentCoverage": [
      {
        "component": "Montura de base, cubierta del filtro y montura del surtidor",
        "period": "15 años"
      },
      {
        "component": "Cartuchos contra obstrucción",
        "period": "90 días"
      },
      {
        "component": "Partes eléctricas",
        "period": "1 año"
      }
    ],
    "conditions": [],
    "exclusions": [
      "Piezas de mantenimiento pueden requerir reemplazo por minerales/químicos del agua sin ser defecto."
    ],
    "officialSourceUrl": "https://www.royalprestige.com/apoyo/garantia",
    "sourceType": "official_royal_prestige",
    "active": true
  },
  {
    "id": "warranty-frescaflow",
    "scope": "product",
    "productIds": [
      "frescaflow"
    ],
    "productName": "Royal Prestige FrescaFlow",
    "coverageSummary": "Garantía limitada de 5 años para el sistema de ósmosis inversa. Cubre partes mecánicas, válvulas eléctricas, pantalla, tarjeta de control y bomba bajo condiciones específicas.",
    "componentCoverage": [
      {
        "component": "Partes mecánicas, válvulas eléctricas, pantalla, tarjeta de control y bomba",
        "period": "5 años"
      },
      {
        "component": "Cartuchos contra obstrucción",
        "period": "90 días"
      }
    ],
    "conditions": [
      "Cumplir requisitos de elegibilidad/reconocimiento.",
      "Suministro de agua exclusivamente municipal.",
      "Evaluación previa de fuente de agua y ambiente.",
      "Mantenimiento y cambios de filtros según manual.",
      "Filtros compatibles y de rendimiento igual o similar."
    ],
    "exclusions": [
      "Agua de pozo anula la garantía.",
      "Daños por cliente, modificaciones no autorizadas, instalación incorrecta, fugas externas o incumplimiento de instrucciones."
    ],
    "claimRequirements": [
      "Puede solicitarse prueba de mantenimiento.",
      "En reclamo válido, Hy Cite reemplaza la unidad completa.",
      "Cliente desinstala y retira filtros; desinstalación/instalación no están cubiertas."
    ],
    "officialSourceUrl": "https://www.royalprestige.com/apoyo/garantia",
    "sourceType": "official_royal_prestige",
    "active": true
  },
  {
    "id": "warranty-shower-filter",
    "scope": "product",
    "productIds": [
      "frescapure-shower-filter"
    ],
    "productName": "Royal Prestige Shower Filter",
    "coverageSummary": "1 año contra defectos de material y mano de obra.",
    "componentCoverage": [
      {
        "component": "Filtro de ducha",
        "period": "1 año"
      }
    ],
    "conditions": [],
    "exclusions": [],
    "officialSourceUrl": "https://www.royalprestige.com/apoyo/garantia",
    "sourceType": "official_royal_prestige",
    "active": true
  },
  {
    "id": "warranty-juicer",
    "scope": "product",
    "productIds": [
      "royal-juicer"
    ],
    "productName": "Royal Prestige Juicer",
    "coverageSummary": "Motor: 10 años. Otros componentes: 2 años.",
    "componentCoverage": [
      {
        "component": "Motor",
        "period": "10 años"
      },
      {
        "component": "Otros componentes",
        "period": "2 años"
      }
    ],
    "conditions": [],
    "exclusions": [],
    "officialSourceUrl": "https://www.royalprestige.com/apoyo/garantia",
    "sourceType": "official_royal_prestige",
    "active": true
  },
  {
    "id": "warranty-juice-squeezer",
    "scope": "product",
    "productIds": [
      "juicer-citrus-squeezer"
    ],
    "productName": "Exprimidor de Jugos Royal Prestige",
    "coverageSummary": "2 años contra defectos de material y mano de obra.",
    "componentCoverage": [
      {
        "component": "Producto",
        "period": "2 años"
      }
    ],
    "conditions": [],
    "exclusions": [],
    "officialSourceUrl": "https://www.royalprestige.com/apoyo/garantia",
    "sourceType": "official_royal_prestige",
    "active": true
  },
  {
    "id": "warranty-kitchen-tool-set",
    "scope": "product",
    "productIds": [
      "kitchen-tool-set-6"
    ],
    "productName": "Juego de Utensilios de Cocina Royal Prestige",
    "coverageSummary": "1 año contra defectos de material o mano de obra.",
    "componentCoverage": [
      {
        "component": "Juego",
        "period": "1 año"
      }
    ],
    "conditions": [],
    "exclusions": [],
    "officialSourceUrl": "https://www.royalprestige.com/apoyo/garantia",
    "sourceType": "official_royal_prestige",
    "active": true
  },
  {
    "id": "warranty-air-filtration",
    "scope": "product",
    "productIds": [
      "air-filtration-system"
    ],
    "productName": "Royal Prestige Air Filtration System",
    "coverageSummary": "1 año contra defectos de material y mano de obra.",
    "componentCoverage": [
      {
        "component": "Sistema",
        "period": "1 año"
      }
    ],
    "conditions": [],
    "exclusions": [],
    "officialSourceUrl": "https://www.royalprestige.com/apoyo/garantia",
    "sourceType": "official_royal_prestige",
    "active": true
  },
  {
    "id": "warranty-accessories",
    "scope": "category",
    "productIds": [
      "magnetic-trivet",
      "elite-magnetic-base",
      "elite-pan-protectors-3",
      "double-wall-mug-set-2",
      "double-wall-mug-set-4",
      "sugar-creamer-set"
    ],
    "productName": "Productos accesorios",
    "coverageSummary": "1 año contra defectos de material o mano de obra para accesorios como bases magnéticas, protectores de sartenes, tazas de pared doble y juegos de azucarera/jarro para leche, salvo categorías con garantía propia.",
    "componentCoverage": [
      {
        "component": "Accesorios incluidos en esta categoría",
        "period": "1 año"
      }
    ],
    "conditions": [],
    "exclusions": [],
    "officialSourceUrl": "https://www.royalprestige.com/apoyo/garantia",
    "sourceType": "official_royal_prestige",
    "active": true
  },
  {
    "id": "warranty-mixing-bowls",
    "scope": "line",
    "productIds": [
      "mixing-bowl-1-5qt",
      "mixing-bowl-2qt",
      "mixing-bowl-3qt",
      "mixing-bowl-5-5qt",
      "mixing-bowl-8-5qt",
      "mixing-bowls-set-5",
      "mixing-bowls-set-3",
      "mixing-bowl-10qt",
      "mixing-bowl-double-wall-5qt"
    ],
    "productName": "Royal Prestige Mixing Bowls",
    "coverageSummary": "Tazones: 5 años. Tapas y cuchillas incluidas: 1 año.",
    "componentCoverage": [
      {
        "component": "Tazones",
        "period": "5 años"
      },
      {
        "component": "Tapas y cuchillas incluidas",
        "period": "1 año"
      }
    ],
    "conditions": [],
    "exclusions": [],
    "officialSourceUrl": "https://www.royalprestige.com/apoyo/garantia",
    "sourceType": "official_royal_prestige",
    "active": true
  }
];

// Clasificación de intención del Copilot por heurística (SIN costo de IA).
// Decide qué fuentes de contexto cargar y qué nivel de modelo usar, para no
// gastar tokens de más ni traer datos innecesarios. Es deliberadamente simple:
// ante la duda, cae en "general" y el prompt del Copilot se encarga del resto.

export type CopilotIntent =
  | "warranty"        // garantías, cobertura, reclamos
  | "objection"       // manejo de objeciones de venta (precio, dudas)
  | "postsale"        // servicio postventa, instalación, seguimiento de servicio
  | "product"         // dudas de producto, beneficios, comparaciones
  | "customer"        // qué hacer con este cliente, próximo paso
  | "recipe"          // recetas / preparaciones (solo productos culinarios)
  | "general";        // saludo, ayuda, cualquier otra cosa

export interface IntentResult {
  intent: CopilotIntent;
  tier: "fast" | "smart";     // objeciones y postventa complejas usan "smart"
  needsCustomer: boolean;      // ¿hay que cargar el contexto 360 del cliente?
  needsWarranty: boolean;      // ¿hay que cargar el conocimiento de garantías?
  needsProduct: boolean;       // ¿hay que cargar catálogo + contenido aprobado?
}

const RE = {
  warranty: /(garant[ií]a|cobertura|reclam|defect|se da[ñn][oó]|averi|repuesto|reembolso|devoluci[oó]n|cu[aá]nto dura|a[ñn]os de garant)/i,
  objection: /(caro|precio|costoso|no.*(seguro|convencid)|pensarlo|d[eé]jame pensar|competencia|barato|descuento|objec|duda|no me alcanza|muy alto)/i,
  postsale: /(postventa|post-venta|instalaci[oó]n|instalar|curado|primer uso|servicio|mantenimiento|c[oó]mo (usar|cuidar|limpiar))/i,
  recipe: /(receta|preparaci[oó]n|cocinar|c[oó]mo hago|plato|ingredientes)/i,
  product: /(producto|beneficio|sirve para|diferencia|compar|caracter[ií]stica|material|acero|funciona)/i,
  customer: /(cliente|qu[eé] (hago|le digo)|pr[oó]ximo paso|seguimiento|contactar|c[oó]mo cierro|este cliente)/i,
};

// Flujos guiados desde el widget (el vendedor tocó un botón). Cuando llegan,
// NO adivinamos la intención por texto: la respetamos tal cual para no caer en
// defaults incorrectos (p. ej. asumir "precio" en objeciones).
export type CopilotFlow = "objection" | "product" | "warranty";

export function classifyIntent(
  message: string,
  hasCustomerContext: boolean,
  flow?: CopilotFlow | null
): IntentResult {
  const m = message || "";

  // Flujo explícito desde el widget: manda sobre la heurística.
  if (flow === "warranty") {
    return { intent: "warranty", tier: "fast", needsCustomer: hasCustomerContext, needsWarranty: true, needsProduct: true };
  }
  if (flow === "objection") {
    return { intent: "objection", tier: "smart", needsCustomer: hasCustomerContext, needsWarranty: false, needsProduct: true };
  }
  if (flow === "product") {
    return { intent: "product", tier: "fast", needsCustomer: false, needsWarranty: false, needsProduct: true };
  }

  // Orden de prioridad: garantía y objeción son los de mayor valor y ambigüedad.
  if (RE.warranty.test(m)) {
    return { intent: "warranty", tier: "fast", needsCustomer: hasCustomerContext, needsWarranty: true, needsProduct: true };
  }
  if (RE.objection.test(m)) {
    return { intent: "objection", tier: "smart", needsCustomer: hasCustomerContext, needsWarranty: false, needsProduct: true };
  }
  if (RE.postsale.test(m)) {
    return { intent: "postsale", tier: "smart", needsCustomer: hasCustomerContext, needsWarranty: false, needsProduct: true };
  }
  if (RE.recipe.test(m)) {
    return { intent: "recipe", tier: "fast", needsCustomer: false, needsWarranty: false, needsProduct: true };
  }
  if (RE.product.test(m)) {
    return { intent: "product", tier: "fast", needsCustomer: false, needsWarranty: false, needsProduct: true };
  }
  if (RE.customer.test(m) || hasCustomerContext) {
    return { intent: "customer", tier: "smart", needsCustomer: hasCustomerContext, needsWarranty: false, needsProduct: false };
  }
  return { intent: "general", tier: "fast", needsCustomer: false, needsWarranty: false, needsProduct: false };
}

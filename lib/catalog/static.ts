// Catálogo ESTÁTICO: la única fuente de productos de la app.
// Se construye una sola vez desde lib/catalog/data.ts (el repo), con los mismos
// campos calculados que antes escribía el seed en Firestore. Ventajas: cero
// lecturas, disponible sin conexión, sin sembrado y sin colisiones entre
// organizaciones. Si algún día el catálogo debe personalizarse por
// distribuidor, este módulo se reemplaza por una capa de datos.
import { CATALOG_PRODUCTS } from "@/lib/catalog/data";
import { capabilitiesFor, classifyFamily } from "@/lib/catalog/classify";
import type { Product } from "@/lib/catalog/types";

function build(): Product[] {
  const rows = CATALOG_PRODUCTS
    .filter((p: any) => p.active !== false)
    .map((p: any) => {
      const caps = capabilitiesFor(p);
      return {
        ...p,
        active: true,
        supportsRecipes: caps.supportsRecipes,
        productFamily: classifyFamily(p),
        contentCapabilities: caps,
      } as Product;
    });
  // Mismo orden que usaba la capa de datos: sets primero, luego alfabético.
  return rows.sort((a: any, b: any) => {
    const sa = a.type === "set" ? 0 : 1;
    const sb = b.type === "set" ? 0 : 1;
    if (sa !== sb) return sa - sb;
    return String(a.name || "").localeCompare(String(b.name || ""), "es");
  });
}

export const CATALOGO_ESTATICO: Product[] = build();

/**
 * Productos VENDIBLES principales (sistemas de cocina, electrodomésticos,
 * filtración, cuchillería y café). Es la lista corta que se le pasa a la IA
 * para que sugiera productos de posible interés: nombres reales del catálogo,
 * sin accesorios ni repuestos, para no inventar y no gastar tokens de más.
 */
export const PRODUCTOS_SUGERIBLES: { name: string; category: string }[] = CATALOGO_ESTATICO
  .filter((p: any) => {
    const cat = String(p.category || "");
    const esPrincipal = ["cooking_system", "appliance", "filtration", "cutlery", "coffee_tea"].includes(cat);
    const esAccesorio = /accessory|repuesto|replacement/i.test(cat);
    return esPrincipal && !esAccesorio;
  })
  .map((p: any) => ({ name: p.name, category: String(p.category || "") }));

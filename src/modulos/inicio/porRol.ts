import type { Rol } from "@/lib/sesion";

/**
 * Qué sale en Inicio para cada puesto. Antes salía todo lo que el rol alcanzaba a leer:
 * importaciones tiene "Finanzas: ver" y a Alondra le aparecía la cobranza de todos los
 * clientes. Poder leer algo no lo vuelve importante para esa persona; esto dice qué sí.
 * No es una barrera (la base decide qué puede leer cada quien): es qué tiene a la vista.
 * Quien tiene varios roles (Susana: ventas y gerencia administrativa) ve la suma.
 */
export type Tarjeta =
  | "ventas" | "cotizaciones" | "cobranza" | "por_pagar" | "taller" | "compras" | "valor_inventario" | "personal" | "embarques"
  | "grafica_ventas" | "ordenes_por_vencer" | "leads";
export type Pendiente =
  | "por_autorizar" | "tareas_vencidas" | "ajustes" | "faltantes" | "oc_atrasadas" | "requisiciones" | "costos_viejos" | "incidencias"
  | "docs_embarque" | "leads_por_tomar" | "leads_mios" | "leads_sin_atender" | "seguimientos";

interface Contenido { tarjetas: Tarjeta[]; pendientes: Pendiente[] }

export const INICIO_POR_ROL: Partial<Record<Rol, Contenido>> = {
  gerente_ventas: { tarjetas: ["ventas", "cotizaciones", "cobranza", "taller", "grafica_ventas", "ordenes_por_vencer"],
    pendientes: ["por_autorizar", "seguimientos", "leads_por_tomar", "leads_sin_atender", "tareas_vencidas"] },
  // El taller: para ver cómo van los equipos de sus clientes.
  ventas: { tarjetas: ["ventas", "cotizaciones", "taller", "grafica_ventas", "ordenes_por_vencer"], pendientes: ["seguimientos", "leads_por_tomar", "leads_mios", "tareas_vencidas"] },
  ingenieria: { tarjetas: ["taller", "ordenes_por_vencer"], pendientes: [] },
  compras: { tarjetas: ["compras", "valor_inventario", "taller"], pendientes: ["requisiciones", "oc_atrasadas", "faltantes", "costos_viejos"] },
  almacen: { tarjetas: ["compras", "taller", "ordenes_por_vencer"], pendientes: ["ajustes", "faltantes", "oc_atrasadas"] },
  gerente_produccion: { tarjetas: ["taller", "compras", "personal", "ordenes_por_vencer"], pendientes: ["ajustes", "faltantes", "incidencias"] },
  produccion: { tarjetas: ["taller", "ordenes_por_vencer"], pendientes: ["faltantes"] },
  rrhh: { tarjetas: ["personal"], pendientes: ["incidencias"] },
  finanzas: { tarjetas: ["ventas", "cobranza", "por_pagar", "valor_inventario", "grafica_ventas"], pendientes: [] },
  administracion: { tarjetas: ["ventas", "cobranza", "por_pagar", "valor_inventario", "grafica_ventas"], pendientes: [] },
  importaciones: { tarjetas: ["embarques", "compras"], pendientes: ["docs_embarque", "oc_atrasadas"] },
  // Recepción: lo que registró hoy y si alguien lo está atendiendo.
  recepcion: { tarjetas: ["leads"], pendientes: [] },
  // Mantenimiento: sus pendientes (fallas, preventivos) llegan por la campana; ve cómo va el taller.
  mantenimiento: { tarjetas: ["taller"], pendientes: [] },
  // Ingeniería de procesos: el taller y lo que vence; sus números están en Métricas.
  ingenieria_procesos: { tarjetas: ["taller", "ordenes_por_vencer"], pendientes: ["faltantes"] },
  // Sistemas: sus pendientes llegan por la campana; en Inicio no le van cifras del negocio.
  admin: { tarjetas: [], pendientes: [] },
};

/** De qué parte de indicadores() sale cada tarjeta y cada pendiente. */
const SECCION: Record<Tarjeta | Pendiente, string | string[] | null> = {
  ventas: "ventas", cotizaciones: "ventas", cobranza: "cobranza", por_pagar: "por_pagar", taller: "produccion", compras: "compras",
  valor_inventario: ["costos", "inventario"], personal: "rrhh", embarques: "importaciones", grafica_ventas: null, ordenes_por_vencer: null,
  por_autorizar: "ventas", tareas_vencidas: "ventas", ajustes: "inventario", faltantes: "produccion", oc_atrasadas: "compras",
  requisiciones: "compras", costos_viejos: "costos", incidencias: "rrhh", docs_embarque: "importaciones",
  leads: "leads", leads_por_tomar: "leads", leads_mios: "leads", leads_sin_atender: "leads",
  // Sale de v_seguimientos_por_vendedor, no de indicadores().
  seguimientos: null,
};

export function contenidoInicio(tieneRol: (r: Rol) => boolean) {
  const tarjetas = new Set<Tarjeta>(), pendientes = new Set<Pendiente>();
  for (const [rol, c] of Object.entries(INICIO_POR_ROL) as [Rol, Contenido][]) {
    if (!tieneRol(rol)) continue;
    c.tarjetas.forEach((t) => tarjetas.add(t));
    c.pendientes.forEach((p) => pendientes.add(p));
  }
  const secciones = [...new Set([...tarjetas, ...pendientes].flatMap((x) => SECCION[x] ?? []))].sort();
  return { tarjetas, pendientes, secciones };
}

import {
  LayoutDashboard, Users, FileText, ShoppingCart, Trophy, Boxes, Layers, Percent, Truck, Tags,
  ClipboardList, Warehouse, ArrowLeftRight, TrendingDown, Factory, ClipboardCheck, Monitor, Tablet,
  UserRound, CalendarOff, LineChart, Wallet, Receipt, Settings, ShieldCheck, Download, History, KanbanSquare, PhoneCall, ListTodo, FileStack,
  Ship,
  type LucideIcon,
} from "lucide-react";
import { Award, Banknote, Coins, Hash, ListChecks, Target, Waypoints } from "lucide-react";
import { AlertTriangle, CalendarDays, CalendarRange, Hand, Wrench } from "lucide-react";
import { BookOpen, Calendar, Inbox, MessageSquareQuote, PackageCheck, Store, Undo2 } from "lucide-react";
import { GanttChart, Gauge, HardHat, Lightbulb, Map as MapaIcono } from "lucide-react";
import type { Modulo, Rol } from "./lib/sesion";

// `tambien`: un segundo permiso que también hace falta (Resultados: finanzas y costos, porque trae márgenes).
export interface EntradaMenu { ruta: string; texto: string; icono: LucideIcon; modulo: Modulo; nivel?: number; tambien?: { modulo: Modulo; nivel?: number } }
export interface SeccionMenu { titulo: string; entradas: EntradaMenu[] }

// El menú se arma solo con lo que el rol puede ver: un soldador en la terminal
// de piso no ve compras, y un vendedor no ve costos. Mismo criterio que la RLS.
export const MENU: SeccionMenu[] = [
  {
    titulo: "Ventas",
    entradas: [
      { ruta: "/ventas/leads", texto: "Leads", icono: Inbox, modulo: "leads" },
      { ruta: "/catalogo", texto: "Catálogo y precios", icono: BookOpen, modulo: "catalogo" },
      { ruta: "/ventas/para-llamar", texto: "A quién llamar hoy", icono: PhoneCall, modulo: "ventas" },
      { ruta: "/ventas/oportunidades", texto: "Oportunidades", icono: KanbanSquare, modulo: "ventas" },
      { ruta: "/ventas/cotizaciones", texto: "Cotizaciones", icono: FileText, modulo: "ventas" },
      { ruta: "/ventas/cotizado", texto: "Lo cotizado", icono: Waypoints, modulo: "ventas", nivel: 2 },
      { ruta: "/ventas/solicitudes", texto: "Solicitudes de precio", icono: MessageSquareQuote, modulo: "ventas", nivel: 2 },
      { ruta: "/ventas/pedidos", texto: "Pedidos", icono: ShoppingCart, modulo: "ventas" },
      { ruta: "/ventas/clientes", texto: "Clientes", icono: Users, modulo: "ventas" },
      { ruta: "/ventas/comisiones", texto: "Comisiones", icono: Trophy, modulo: "ventas" },
      { ruta: "/ventas/devoluciones", texto: "Devoluciones y reclamos", icono: Undo2, modulo: "envios" },
      { ruta: "/ventas/mercadolibre", texto: "Mercado Libre", icono: Store, modulo: "mercadolibre" },
    ],
  },
  {
    // Dónde y en qué crecer: el BI de dirección. La gerencia de ventas lo ve sin poder cambiar metas.
    titulo: "Dirección",
    entradas: [
      // Una sola entrada: mapa, tendencias, clientes, producto, metas y ubicaciones son pestañas.
      { ruta: "/analisis", texto: "Análisis y metas", icono: MapaIcono, modulo: "analisis" },
    ],
  },
  {
    titulo: "Ingeniería y costeo",
    entradas: [
      { ruta: "/costeo/equipos", texto: "Equipos y subensambles", icono: Layers, modulo: "costeo" },
      { ruta: "/costeo/componentes", texto: "Componentes", icono: Boxes, modulo: "costeo" },
      { ruta: "/costeo/planos", texto: "Planos", icono: FileStack, modulo: "costeo" },
      { ruta: "/costeo/margenes", texto: "Márgenes y precios", icono: Percent, modulo: "margenes" },
      { ruta: "/costeo/precios-ventas", texto: "Precios vs ventas", icono: LineChart, modulo: "margenes" },
    ],
  },
  {
    titulo: "Compras",
    entradas: [
      { ruta: "/compras/solicitudes", texto: "Solicitudes de precio", icono: MessageSquareQuote, modulo: "compras", nivel: 2 },
      { ruta: "/compras/precios", texto: "Actualizar precios", icono: Tags, modulo: "compras", nivel: 2 },
      { ruta: "/compras/ordenes", texto: "Órdenes de compra", icono: ClipboardList, modulo: "compras" },
      { ruta: "/compras/proveedores", texto: "Proveedores", icono: Truck, modulo: "compras" },
    ],
  },
  {
    titulo: "Almacén",
    entradas: [
      { ruta: "/almacen/existencias", texto: "Existencias", icono: Warehouse, modulo: "inventario" },
      { ruta: "/almacen/movimientos", texto: "Entradas y salidas", icono: ArrowLeftRight, modulo: "inventario" },
      { ruta: "/almacen/reabasto", texto: "Reabasto", icono: TrendingDown, modulo: "inventario" },
      { ruta: "/almacen/metricas", texto: "Métricas de almacén", icono: Gauge, modulo: "inventario", nivel: 2 },
      { ruta: "/almacen/envios", texto: "Envíos", icono: PackageCheck, modulo: "envios" },
    ],
  },
  {
    titulo: "Importaciones",
    entradas: [
      { ruta: "/importaciones", texto: "Embarques", icono: Ship, modulo: "importaciones" },
    ],
  },
  {
    titulo: "Producción",
    entradas: [
      { ruta: "/produccion/gerencia", texto: "Tablero de producción", icono: Factory, modulo: "produccion" },
      { ruta: "/produccion/cuadrillas", texto: "Cuadrillas", icono: HardHat, modulo: "produccion", nivel: 2 },
      { ruta: "/produccion/gantt", texto: "Gantt (plan del taller)", icono: GanttChart, modulo: "produccion", nivel: 2 },
      { ruta: "/produccion/metricas", texto: "Métricas", icono: Gauge, modulo: "procesos" },
      { ruta: "/produccion/mejoras", texto: "Mejoras (kaizen)", icono: Lightbulb, modulo: "produccion", nivel: 2 },
      { ruta: "/produccion/pedidos", texto: "Pedidos", icono: ShoppingCart, modulo: "produccion", nivel: 2 },
      { ruta: "/produccion/ordenes", texto: "Órdenes y material", icono: ClipboardCheck, modulo: "produccion" },
      { ruta: "/produccion/seriales", texto: "Números de serie", icono: Hash, modulo: "produccion" },
      { ruta: "/produccion/terminal", texto: "Terminal de piso", icono: Tablet, modulo: "produccion", nivel: 2 },
      { ruta: "/piso", texto: "Pantalla de piso (TV)", icono: Monitor, modulo: "produccion" },
    ],
  },
  {
    titulo: "Servicio",
    entradas: [
      { ruta: "/servicio", texto: "Servicios y cuadrillas", icono: CalendarRange, modulo: "servicio" },
    ],
  },
  {
    // El taller por dentro: su propio módulo, aparte del servicio a clientes.
    titulo: "Mantenimiento",
    entradas: [
      { ruta: "/servicio/maquinas", texto: "Máquinas y herramienta", icono: Wrench, modulo: "mantenimiento" },
      { ruta: "/servicio/metricas", texto: "Métricas de mantenimiento", icono: Gauge, modulo: "mantenimiento" },
      { ruta: "/servicio/reportar", texto: "Reportar falla", icono: AlertTriangle, modulo: "mantenimiento", nivel: 2 },
      { ruta: "/servicio/resguardos", texto: "Resguardo de herramienta", icono: Hand, modulo: "mantenimiento", nivel: 2 },
    ],
  },
  {
    titulo: "Administración",
    entradas: [
      { ruta: "/rrhh/empleados", texto: "Personal", icono: UserRound, modulo: "rrhh" },
      { ruta: "/rrhh/incidencias", texto: "Vacaciones e incidencias", icono: CalendarOff, modulo: "rrhh" },
      { ruta: "/rrhh/objetivos", texto: "Objetivos y bonos", icono: Target, modulo: "objetivos" },
      { ruta: "/rrhh/checklist", texto: "Checklist diario", icono: ListChecks, modulo: "objetivos" },
      { ruta: "/rrhh/prenomina", texto: "Prenómina", icono: Banknote, modulo: "nomina" },
      { ruta: "/rrhh/mi-desempeno", texto: "Mi desempeño", icono: Award, modulo: "mi_desempeno" },
      { ruta: "/finanzas/cobranza", texto: "Cobranza", icono: Wallet, modulo: "finanzas" },
      { ruta: "/finanzas/pagos", texto: "Pagos a proveedores", icono: Receipt, modulo: "finanzas" },
      { ruta: "/finanzas/caja-chica", texto: "Caja chica", icono: Coins, modulo: "finanzas", nivel: 2 },
      { ruta: "/finanzas/resultados", texto: "Resultados", icono: Waypoints, modulo: "finanzas", tambien: { modulo: "costos" } },
    ],
  },
  {
    titulo: "Sistema",
    entradas: [
      { ruta: "/sistema/usuarios", texto: "Usuarios y permisos", icono: ShieldCheck, modulo: "admin", nivel: 3 },
      { ruta: "/sistema/importar", texto: "Importar de Sheets", icono: Download, modulo: "admin", nivel: 3 },
      { ruta: "/sistema/bitacora", texto: "Bitácora", icono: History, modulo: "admin" },
      { ruta: "/sistema/configuracion", texto: "Configuración", icono: Settings, modulo: "admin", nivel: 3 },
    ],
  },
];

export const INICIO: EntradaMenu = { ruta: "/", texto: "Inicio", icono: LayoutDashboard, modulo: "ventas" };
// Todos tienen pendientes (los pide y los recibe cualquiera con rol): va junto a Inicio.
export const PENDIENTES: EntradaMenu = { ruta: "/pendientes", texto: "Pendientes", icono: ListTodo, modulo: "ventas" };
// El calendario es de todos: cada quien ve lo que su puesto puede ver (lo decide la base).
export const CALENDARIO: EntradaMenu = { ruta: "/calendario", texto: "Calendario", icono: Calendar, modulo: "ventas" };
// El resumen de la semana lo arma el asistente: lo ve quien tiene asistente.
export const SEMANA: EntradaMenu = { ruta: "/semana", texto: "Tu semana", icono: CalendarDays, modulo: "asistente" };

// Qué secciones van primero según el puesto: la gerencia de producción abría el ERP y tenía que
// bajar más allá de Ventas, Ingeniería, Compras y Almacén para llegar a lo suyo. Con varios roles
// se juntan en el orden en que vienen; lo que no aparece sigue en el orden de MENU. Dirección y
// sistemas ven todo y se quedan con el orden de siempre. Cada quien puede moverlas después.
export const PRIMERO_POR_ROL: Partial<Record<Rol, string[]>> = {
  gerente_produccion: ["Producción", "Almacén", "Mantenimiento"],
  produccion: ["Producción", "Almacén", "Mantenimiento"],
  ingenieria_procesos: ["Producción", "Mantenimiento"],
  mantenimiento: ["Mantenimiento", "Producción"],
  almacen: ["Almacén", "Compras", "Producción"],
  compras: ["Compras", "Almacén", "Importaciones"],
  importaciones: ["Importaciones", "Compras", "Almacén"],
  ingenieria: ["Ingeniería y costeo", "Producción"],
  rrhh: ["Administración"],
  finanzas: ["Administración", "Compras"],
  administracion: ["Administración", "Compras"],
  ventas: ["Ventas"],
  gerente_ventas: ["Ventas", "Dirección"],
  recepcion: ["Ventas"],
  marketing: ["Ventas"],
};

/** Los títulos de sección en el orden de quien entra: su puesto primero, lo demás como en MENU. */
export function ordenPorRol(roles: Rol[]): string[] {
  const primero = roles.flatMap((r) => PRIMERO_POR_ROL[r] ?? []);
  return [...new Set([...primero, ...MENU.map((s) => s.titulo)])];
}

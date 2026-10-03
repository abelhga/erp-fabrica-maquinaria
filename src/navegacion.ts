import {
  LayoutDashboard, Users, FileText, ShoppingCart, Trophy, Boxes, Layers, Percent, Truck, Tags,
  ClipboardList, Warehouse, ArrowLeftRight, TrendingDown, Factory, ClipboardCheck, Monitor, Tablet,
  UserRound, CalendarOff, LineChart, Wallet, Receipt, Settings, ShieldCheck, Download, History, KanbanSquare, PhoneCall, ListTodo, FileStack,
  Ship,
  type LucideIcon,
} from "lucide-react";
import { Award, Banknote, ListChecks, Target } from "lucide-react";
import { AlertTriangle, CalendarRange, Hand, Wrench } from "lucide-react";
import { PackageCheck, Undo2 } from "lucide-react";
import type { Modulo } from "./lib/sesion";

export interface EntradaMenu { ruta: string; texto: string; icono: LucideIcon; modulo: Modulo; nivel?: number }
export interface SeccionMenu { titulo: string; entradas: EntradaMenu[] }

// El menú se arma solo con lo que el rol puede ver: un soldador en la terminal
// de piso no ve compras, y un vendedor no ve costos. Mismo criterio que la RLS.
export const MENU: SeccionMenu[] = [
  {
    titulo: "Ventas",
    entradas: [
      { ruta: "/ventas/para-llamar", texto: "A quién llamar hoy", icono: PhoneCall, modulo: "ventas" },
      { ruta: "/ventas/oportunidades", texto: "Oportunidades", icono: KanbanSquare, modulo: "ventas" },
      { ruta: "/ventas/cotizaciones", texto: "Cotizaciones", icono: FileText, modulo: "ventas" },
      { ruta: "/ventas/pedidos", texto: "Pedidos", icono: ShoppingCart, modulo: "ventas" },
      { ruta: "/ventas/clientes", texto: "Clientes", icono: Users, modulo: "ventas" },
      { ruta: "/ventas/comisiones", texto: "Comisiones", icono: Trophy, modulo: "ventas" },
      { ruta: "/ventas/devoluciones", texto: "Devoluciones y reclamos", icono: Undo2, modulo: "envios" },
    ],
  },
  {
    titulo: "Ingeniería y costeo",
    entradas: [
      { ruta: "/costeo/equipos", texto: "Equipos y subensambles", icono: Layers, modulo: "costeo" },
      { ruta: "/costeo/componentes", texto: "Componentes", icono: Boxes, modulo: "costeo" },
      { ruta: "/costeo/planos", texto: "Planos", icono: FileStack, modulo: "costeo" },
      { ruta: "/costeo/margenes", texto: "Márgenes y precios", icono: Percent, modulo: "costos", nivel: 2 },
      { ruta: "/costeo/precios-ventas", texto: "Precios vs ventas", icono: LineChart, modulo: "costos" },
    ],
  },
  {
    titulo: "Compras",
    entradas: [
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
      { ruta: "/produccion/gerencia", texto: "Gerencia de producción", icono: Factory, modulo: "produccion" },
      { ruta: "/produccion/ordenes", texto: "Órdenes y material", icono: ClipboardCheck, modulo: "produccion" },
      { ruta: "/produccion/terminal", texto: "Terminal de piso", icono: Tablet, modulo: "produccion", nivel: 2 },
      { ruta: "/piso", texto: "Pantalla de piso (TV)", icono: Monitor, modulo: "produccion" },
    ],
  },
  {
    titulo: "Servicio",
    // Máquinas, falla y resguardos son del personal de producción (nivel 2): un vendedor
    // tiene "servicio" para pedir servicios a sus clientes, no para el mantenimiento del taller.
    entradas: [
      { ruta: "/servicio", texto: "Servicios y cuadrillas", icono: CalendarRange, modulo: "servicio" },
      { ruta: "/servicio/maquinas", texto: "Máquinas y herramienta", icono: Wrench, modulo: "produccion", nivel: 2 },
      { ruta: "/servicio/reportar", texto: "Reportar falla", icono: AlertTriangle, modulo: "produccion", nivel: 2 },
      { ruta: "/servicio/resguardos", texto: "Resguardo de herramienta", icono: Hand, modulo: "produccion", nivel: 2 },
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

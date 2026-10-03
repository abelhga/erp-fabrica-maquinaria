import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { q } from "@/lib/consultas";
import { dinero, fecha } from "@/lib/formato";
import type { Tono } from "@/components/ui/insignia";

// ---------------------------------------------------------------------------
// Catálogos de estados con su color. Un solo lugar para que "Por autorizar" se
// vea igual en la lista, el editor, el detalle del cliente y el inicio.
// ---------------------------------------------------------------------------
export type EstadoCotizacion = "borrador" | "por_autorizar" | "autorizada" | "enviada" | "aceptada" | "rechazada" | "vencida" | "cancelada";
export const ESTADO_COT: Record<EstadoCotizacion, { texto: string; tono: Tono }> = {
  borrador: { texto: "Borrador", tono: "neutro" },
  por_autorizar: { texto: "Por autorizar", tono: "aviso" },
  autorizada: { texto: "Autorizada", tono: "info" },
  enviada: { texto: "Enviada", tono: "marca" },
  aceptada: { texto: "Aceptada", tono: "ok" },
  rechazada: { texto: "Rechazada", tono: "peligro" },
  vencida: { texto: "Vencida", tono: "peligro" },
  cancelada: { texto: "Cancelada", tono: "neutro" },
};
/** Estados en los que la base deja editar partidas (cotizacion_editable). */
export const EDITABLES: EstadoCotizacion[] = ["borrador", "por_autorizar", "autorizada"];

export type EtapaOportunidad = "prospecto" | "contactado" | "cotizado" | "negociacion" | "ganada" | "perdida";
export const ETAPAS: { valor: EtapaOportunidad; texto: string; tono: Tono }[] = [
  { valor: "prospecto", texto: "Prospecto", tono: "neutro" },
  { valor: "contactado", texto: "Contactado", tono: "info" },
  { valor: "cotizado", texto: "Cotizado", tono: "marca" },
  { valor: "negociacion", texto: "Negociación", tono: "aviso" },
  { valor: "ganada", texto: "Ganada", tono: "ok" },
  { valor: "perdida", texto: "Perdida", tono: "peligro" },
];
export const ETAPA = Object.fromEntries(ETAPAS.map((e) => [e.valor, e])) as Record<EtapaOportunidad, (typeof ETAPAS)[number]>;

export type EstadoPedido = "confirmado" | "en_produccion" | "listo" | "entregado" | "cancelado";
export const ESTADO_PEDIDO: Record<EstadoPedido, { texto: string; tono: Tono }> = {
  confirmado: { texto: "Confirmado", tono: "marca" },
  en_produccion: { texto: "En producción", tono: "info" },
  listo: { texto: "Listo para entregar", tono: "aviso" },
  entregado: { texto: "Entregado", tono: "ok" },
  cancelado: { texto: "Cancelado", tono: "neutro" },
};

export type Canal = "directo" | "mercadolibre" | "sitio_web" | "mostrador" | "distribuidor" | "amazon";
export const CANAL: Record<Canal, string> = {
  directo: "Directo", mercadolibre: "Mercado Libre", sitio_web: "Sitio web", mostrador: "Mostrador",
  distribuidor: "Distribuidor", amazon: "Amazon",
};
export type Linea = "maquinaria" | "refacciones" | "otros";
export const LINEA: Record<Linea, string> = { maquinaria: "Maquinaria", refacciones: "Refacciones", otros: "Otros" };
export type Moneda = "MXN" | "USD" | "EUR";

// ---------------------------------------------------------------------------
// Tipos de las tablas y vistas que usa el módulo
// ---------------------------------------------------------------------------
export interface Cotizacion {
  id: string; folio: string; version: number; origen_id: string | null; cliente_id: string | null; contacto_id: string | null;
  atencion: string | null; empresa: string | null; oportunidad_id: string | null; vendedor_id: string; fecha: string;
  vigencia_dias: number; moneda: Moneda; tipo_cambio: number; tasa_iva: number; precios_con_iva: boolean; descuento_pct: number;
  leyenda_promocion: string | null; condiciones_pago: string | null; tiempo_entrega: string | null; notas: string[];
  plan_meses: number | null; logo_comarca_url: string | null; estado: EstadoCotizacion; requiere_autorizacion: boolean;
  autorizada_por: string | null; autorizada_en: string | null; autorizacion_pedida_en: string | null; nota_autorizacion: string | null;
  motivo_rechazo: string | null; enviada_en: string | null; cerrada_en: string | null;
  subtotal: number; descuento: number; iva: number; total: number; creado_en: string; actualizado_en: string;
}
export interface Partida {
  id: string; cotizacion_id: string; orden: number; articulo_id: string | null; titulo: string; descripcion: string | null;
  imagen_url: string | null; unidad: string; cantidad: number; precio_unitario: number; precio_lista: number | null;
  descuento_pct: number; opcional: boolean; bajo_minimo: boolean; importe: number;
}
export interface VCotizacion {
  id: string; folio: string; version: number; fecha: string; vence: string; estado: EstadoCotizacion; cliente_id: string | null;
  cliente: string | null; atencion: string | null; empresa: string | null; vendedor_id: string; vendedor: string; iniciales: string | null;
  moneda: Moneda; tipo_cambio: number; subtotal: number; total: number; neto_mxn: number; requiere_autorizacion: boolean;
  autorizacion_pedida_en: string | null; nota_autorizacion: string | null; enviada_en: string | null; vencida: boolean;
  partidas: number; partidas_bajo_minimo: number; primera_partida: string | null; pedido_id: string | null; oportunidad_id: string | null;
  motivo_rechazo: string | null; creado_en: string; actualizado_en: string;
}
export interface VOportunidad {
  id: string; cliente_id: string; cliente: string; contacto_id: string | null; titulo: string; etapa: EtapaOportunidad; linea: Linea;
  canal: Canal; monto_estimado: number | null; probabilidad: number | null; fecha_cierre_estimada: string | null; vendedor_id: string;
  vendedor: string | null; fuente_id: number | null; fuente: string | null; motivo_perdida: string | null; notas: string | null;
  dias_en_etapa: number; tarea_id: string | null; tarea: string | null; tarea_vence: string | null; cotizaciones: number;
  ultima_cotizacion_total: number | null; creado_en: string;
}
export interface VPedido {
  id: string; folio: string; fecha: string; fecha_compromiso: string | null; estado: EstadoPedido; canal: Canal; id_externo: string | null;
  cliente_id: string; cliente: string; vendedor_id: string | null; vendedor: string | null; cotizacion_id: string | null;
  cotizacion_folio: string | null; moneda: Moneda; tipo_cambio: number; subtotal: number; iva: number; total: number; cobrado: number;
  saldo: number; facturado: boolean; ordenes: number | null; terminadas: number | null; avance: number | null; atrasado: boolean;
  credito_compartido: boolean; entregado_en: string | null; motivo_cancelacion: string | null;
}
export interface VCliente {
  id: string; nombre: string; razon_social: string | null; rfc: string | null; giro: string | null; ciudad: string | null; estado: string | null;
  pais: string; vendedor_id: string | null; vendedor: string | null; es_distribuidor: boolean; dias_credito: number; activo: boolean;
  ultima_compra: string | null; saldo: number; compras_12m: number; cotizaciones_abiertas: number;
}
export interface Contacto {
  id: string; cliente_id: string; nombre: string; puesto: string | null; telefono: string | null; whatsapp: string | null;
  correo: string | null; domicilio: string | null; principal: boolean; notas: string | null;
}
export interface Actividad {
  id: string; cliente_id: string | null; oportunidad_id: string | null; tipo: "llamada" | "whatsapp" | "correo" | "visita" | "nota" | "tarea";
  descripcion: string; vence_en: string | null; hecha: boolean; usuario_id: string | null; en: string;
}
export interface TextoComercial { id: number; tipo: "pago" | "entrega" | "vigencia" | "nota"; texto: string; por_defecto: boolean; orden: number }
export interface PlanMeses { meses: number; etiqueta: string; tasa: number }
export interface Empresa { razon_social: string; rfc: string; domicilio: string; terminos_url?: string }

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

/**
 * Trae TODAS las filas de una consulta en tandas de 1,000: PostgREST corta en
 * 1,000 y el directorio ya tiene más de 2 mil clientes (el filtro "Todos"
 * decía 1000 y los de la segunda mitad salían sin vigencia).
 */
export async function todas<T>(consulta: (desde: number, hasta: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const r: T[] = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await consulta(desde, desde + 999);
    if (error) throw new Error(error.message);
    r.push(...(data ?? []));
    if (!data || data.length < 1000) return r;
  }
}

/** "hace 3 meses", "hace 1 año" (lib/formato dice "hace 1 años"). */
export function haceCuanto(f: string | null | undefined) {
  if (!f) return "—";
  const dias = Math.round((Date.now() - new Date(/^\d{4}-\d{2}-\d{2}$/.test(f) ? f + "T12:00:00" : f).getTime()) / 86_400_000);
  if (dias <= 0) return "hoy";
  if (dias === 1) return "ayer";
  if (dias < 30) return `hace ${dias} días`;
  const meses = Math.round(dias / 30);
  if (meses < 12) return `hace ${meses} ${meses === 1 ? "mes" : "meses"}`;
  const anios = Math.round(meses / 12);
  return `hace ${anios} ${anios === 1 ? "año" : "años"}`;
}

/** Dinero en la moneda de la cotización (USD sale como "USD 1,234.00", no con "$" a secas como en la hoja). */
export function dineroEn(n: number | null | undefined, moneda: Moneda = "MXN") {
  if (moneda === "EUR") return n == null ? "—" : new Intl.NumberFormat("es-MX", { style: "currency", currency: "EUR" }).format(n);
  return dinero(n, moneda);
}

/** Espejo de public.mensualidad(): total ÷ (1 − tasa) ÷ meses. Solo para la vista previa mientras se escribe. */
export function mensualidad(total: number, plan: PlanMeses | undefined | null) {
  if (!plan || !total) return null;
  return Math.round((total / (1 - Number(plan.tasa)) / plan.meses) * 100) / 100;
}

export const venceEl = (fechaISO: string, dias: number) => {
  const d = new Date(fechaISO + "T12:00:00");
  d.setDate(d.getDate() + Number(dias));
  return d.toLocaleDateString("en-CA");
};

/** Hoy en México (la base guarda fechas de negocio en hora de México). */
export const hoyMx = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });

/** Teléfono para wa.me: solo dígitos y con 52 si viene a 10 dígitos (así lo capturan en las hojas). */
export function telefonoWa(t: string | null | undefined) {
  const d = (t ?? "").replace(/\D/g, "");
  if (!d) return "";
  return d.length === 10 ? "52" + d : d;
}
export function enlaceWhatsApp(telefono: string | null | undefined, texto: string) {
  const t = telefonoWa(telefono);
  return `https://wa.me/${t}?text=${encodeURIComponent(texto)}`;
}

export function textoWhatsApp(c: Pick<Cotizacion, "folio" | "atencion" | "total" | "moneda" | "precios_con_iva" | "fecha" | "vigencia_dias">,
  partidas: Pick<Partida, "titulo" | "opcional">[], vendedor?: { nombre?: string | null; telefono?: string | null } | null,
  plan?: PlanMeses | null) {
  const suman = partidas.filter((p) => !p.opcional);
  const lineas = [
    `Hola${c.atencion ? " " + c.atencion : ""}, le comparto la cotización ${c.folio} de HEGAMEX:`,
    ...suman.slice(0, 3).map((p) => `• ${p.titulo}`),
    suman.length > 3 ? `• y ${suman.length - 3} partida(s) más` : null,
    `Total: ${dineroEn(c.total, c.moneda)}${c.moneda !== "MXN" ? "" : " MXN"} IVA incluido.`,
    plan && mensualidad(c.total, plan) ? `O ${plan.etiqueta.toLowerCase()} ${dineroEn(mensualidad(c.total, plan), c.moneda)} con tarjeta.` : null,
    `Vigencia: hasta el ${fecha(venceEl(c.fecha, c.vigencia_dias))}.`,
    "",
    `Quedo a sus órdenes.${vendedor?.nombre ? "\n" + vendedor.nombre : ""}${vendedor?.telefono ? " · Cel. " + vendedor.telefono : ""}`,
  ];
  return lineas.filter((l) => l != null).join("\n");
}

/** Interpreta "30 días hábiles…" para proponer la fecha compromiso del pedido (días hábiles → naturales ×7/5). */
export function compromisoDesde(tiempoEntrega: string | null | undefined) {
  const m = tiempoEntrega?.match(/(\d+)\s*d[ií]as?\s*(h[áa]biles)?/i);
  const d = new Date();
  if (m) d.setDate(d.getDate() + Math.ceil(Number(m[1]) * (m[2] ? 7 / 5 : 1)));
  return d.toLocaleDateString("en-CA");
}

/** Validación de RFC igual al check de la tabla clientes (personas morales 3 letras, físicas 4). */
export const RFC_VALIDO = /^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$/;
export const normalizarRfc = (r: string) => r.toUpperCase().replace(/[\s-]/g, "");

// ---------------------------------------------------------------------------
// Catálogos compartidos (cambian poco: se piden una vez por sesión)
// ---------------------------------------------------------------------------
export function useTextosComerciales() {
  return useQuery({
    queryKey: ["textos_comerciales"], staleTime: 10 * 60_000,
    queryFn: () => q<TextoComercial[]>(supabase.from("textos_comerciales").select("id, tipo, texto, por_defecto, orden").eq("activo", true).order("orden")),
  });
}
export function usePlanesMeses() {
  return useQuery({
    queryKey: ["planes_meses"], staleTime: 10 * 60_000,
    queryFn: () => q<PlanMeses[]>(supabase.from("planes_meses").select("meses, etiqueta, tasa").eq("activo", true).order("meses")),
  });
}
export function useEmpresa() {
  return useQuery({
    queryKey: ["configuracion", "empresa_fiscal"], staleTime: 30 * 60_000,
    queryFn: async () => {
      const filas = await q<{ clave: string; valor: unknown }[]>(supabase.from("configuracion").select("clave, valor").in("clave", ["empresa_fiscal", "meses_tope", "empresa"]));
      const v = Object.fromEntries(filas.map((f) => [f.clave, f.valor]));
      return { fiscal: (v.empresa_fiscal ?? {}) as Empresa, mesesTope: Number(v.meses_tope ?? 350000), empresa: (v.empresa ?? {}) as { sitio?: string; telefono?: string } };
    },
  });
}
/** Vendedores con plan de comisión o rol de ventas, para filtros de la gerencia. */
export function useVendedores(habilitado = true) {
  return useQuery({
    queryKey: ["vendedores"], staleTime: 10 * 60_000, enabled: habilitado,
    queryFn: () => q<{ id: string; nombre: string; iniciales: string | null; telefono: string | null }[]>(
      supabase.from("perfiles").select("id, nombre, iniciales, telefono").eq("activo", true).order("nombre")),
  });
}
export function useFuentes() {
  return useQuery({
    queryKey: ["fuentes_contacto"], staleTime: 30 * 60_000,
    queryFn: () => q<{ id: number; nombre: string }[]>(supabase.from("fuentes_contacto").select("id, nombre").eq("activa", true).order("id")),
  });
}

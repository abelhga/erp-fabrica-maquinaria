import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { q, useTiempoReal } from "@/lib/consultas";
import type { Tono } from "@/components/ui/insignia";

// Todo lo de envíos y devoluciones cuelga de esta clave: un cambio (de otra persona
// o del almacén desde su celular) recarga lista, detalle, tarjeta del pedido y saldo.
export const CLAVE = ["envios"] as const;

export type TipoEnvio = "paqueteria" | "flete" | "recoge" | "full" | "a_full" | "proveedor";
export type EstadoEnvio = "solicitado" | "cotizado" | "guia_lista" | "empacado" | "enviado" | "entregado" | "cancelado";
export type TipoDevolucion = "devolucion" | "reclamo" | "cancelacion";
export type EstadoDevolucion = "abierta" | "respondida" | "recibida" | "resuelta" | "cancelada";
export type TipoArchivo = "empaque" | "guia" | "entrega" | "recepcion" | "documento";

export const TIPOS: Record<TipoEnvio, { texto: string; ayuda: string }> = {
  paqueteria: { texto: "Paquetería", ayuda: "Guía de paquetería (Estafeta, FedEx, Mercado Envíos…)." },
  flete: { texto: "Flete", ayuda: "Equipo o bultos grandes con transportista." },
  recoge: { texto: "Recoge el cliente", ayuda: "Pasa a planta: almacén lo entrega y anota quién se lo llevó." },
  full: { texto: "Lo surte Full (ML)", ayuda: "Mercado Libre lo manda desde su bodega: sale de Almacén ML." },
  a_full: { texto: "Envío a Full", ayuda: "Reabasto de la bodega de Full: traspaso a Almacén ML." },
  proveedor: { texto: "Directo del proveedor", ayuda: "El proveedor lo manda al cliente: no sale de nuestro almacén." },
};
/** Los que se piden desde un pedido (el envío a Full lo arma almacén aparte). */
export const TIPOS_PEDIDO: TipoEnvio[] = ["paqueteria", "flete", "recoge", "full", "proveedor"];

export const ESTADO_ENVIO: Record<EstadoEnvio, { texto: string; tono: Tono }> = {
  solicitado: { texto: "Por cotizar", tono: "aviso" },
  cotizado: { texto: "Cotizado", tono: "info" },
  guia_lista: { texto: "Guía lista", tono: "marca" },
  empacado: { texto: "Empacado", tono: "marca" },
  enviado: { texto: "En camino", tono: "info" },
  entregado: { texto: "Entregado", tono: "ok" },
  cancelado: { texto: "Cancelado", tono: "neutro" },
};

/** El estado en palabras del tipo: "por cotizar" solo aplica a lo que lleva guía. */
export function estadoEnvio(e: { estado: EstadoEnvio; tipo: TipoEnvio }) {
  if (e.estado === "solicitado" && e.tipo !== "paqueteria" && e.tipo !== "flete") {
    return e.tipo === "full" || e.tipo === "proveedor" ? { texto: "Pendiente", tono: "aviso" as Tono } : { texto: "Por empacar", tono: "aviso" as Tono };
  }
  if (e.estado === "enviado" && e.tipo === "full") return { texto: "Surtido por Full", tono: "info" as Tono };
  return ESTADO_ENVIO[e.estado];
}

export const TIPO_DEVOLUCION: Record<TipoDevolucion, { texto: string; ayuda: string }> = {
  devolucion: { texto: "Devolución", ayuda: "El producto regresa a planta." },
  reclamo: { texto: "Reclamo", ayuda: "El cliente reclama; hay que responder antes de la hora límite." },
  cancelacion: { texto: "Cancelación", ayuda: "Se canceló la venta." },
};

export const ESTADO_DEVOLUCION: Record<EstadoDevolucion, { texto: string; tono: Tono }> = {
  abierta: { texto: "Abierta", tono: "aviso" },
  respondida: { texto: "Respondido", tono: "info" },
  recibida: { texto: "Llegó: por decidir", tono: "marca" },
  resuelta: { texto: "Resuelta", tono: "ok" },
  cancelada: { texto: "Cancelada", tono: "neutro" },
};

export const RESULTADO: Record<string, string> = {
  reingreso: "Reingresó al inventario", merma: "Merma (ajuste por autorizar)", reclamo_transportista: "Reclamo a la paquetería",
  a_favor: "A favor", en_contra: "En contra", sin_efecto: "Sin efecto",
};

export interface Envio {
  id: string; folio: string; pedido_id: string | null; pedido_folio: string | null; canal: string | null; id_externo: string | null;
  cliente_id: string | null; cliente: string | null; vendedor_id: string | null; vendedor: string | null;
  tipo: TipoEnvio; tipo_nombre: string; estado: EstadoEnvio; paqueteria_id: number | null; paqueteria: string | null;
  usa_saldo: boolean | null; servicio: string | null; contacto_id: string | null; destinatario: string | null; telefono: string | null;
  destino: string | null; fecha_recoleccion: string | null; notas: string | null; costo_cotizado: number | null; costo_real: number | null;
  numero_guia: string | null; solicitado_por: string | null; solicitado_por_nombre: string | null; solicitado_en: string;
  cotizado_por_nombre: string | null; cotizado_en: string | null; guia_por_nombre: string | null; guia_en: string | null;
  empacado_por: string | null; empacado_por_nombre: string | null; empacado_en: string | null;
  checklist: { id: number; aplica: string; texto: string }[] | null;
  enviado_por_nombre: string | null; enviado_en: string | null; entregado_por_nombre: string | null; entregado_en: string | null;
  recibio: string | null; cancelado_por_nombre: string | null; cancelado_en: string | null; motivo_cancelacion: string | null;
  guia_reembolsada: boolean | null; inventario_descontado_en: string | null;
  bultos: number; peso_total: number | null; peso_volumetrico: number | null; sin_medidas: number;
  partidas: number; piezas: number | null; resumen: string | null; lleva_equipo: boolean; fotos: number; guia_ruta: string | null;
  abierto: boolean; lleva_empaque: boolean; falta_guia: boolean; falta_empaque: boolean; listo_para_salir: boolean;
  dias_desde_solicitud: number; dias_en_camino: number | null;
}

export interface LineaEnvio {
  id: string; envio_id: string; orden: number; pedido_linea_id: string | null; articulo_id: string | null; clave: string | null;
  nombre: string; descripcion: string; articulo_tipo: string | null; unidad: string | null; cantidad: number;
  almacen_id: number | null; almacen: string | null; series: string[]; cantidad_descontada: number | null; descontado: boolean;
  nota_inventario: string | null; paquete_kg: number | null; paquete_largo_cm: number | null; paquete_ancho_cm: number | null;
  paquete_alto_cm: number | null; paquete_piezas: number | null; series_orden: string[] | null; ordenes: string[] | null;
  ordenes_sin_terminar: number | null;
}

export interface Bulto {
  id?: string; articulo_id: string | null; contenido: string | null; piezas: number | null; peso_kg: number | null;
  largo_cm: number | null; ancho_cm: number | null; alto_cm: number | null;
}

export interface Archivo {
  id: string; envio_id: string | null; devolucion_id: string | null; tipo: TipoArchivo; ruta: string; nota: string | null;
  subido_por_nombre: string | null; en: string;
}

export interface Evento { id: number; envio_id: string | null; devolucion_id: string | null; tipo: string; nota: string | null; usuario: string | null; en: string }

export interface PlanSalida {
  linea_id: string; articulo_id: string | null; articulo: string; almacen_id: number | null; almacen: string | null; cantidad: number;
  descontar: number; accion: "salida" | "traspaso" | "nada"; nota: string | null; problema: string | null;
}

export interface Saldo {
  paqueteria_id: number; paqueteria: string; usa_saldo: boolean; recargas: number; consumo: number; saldo: number;
  saldo_minimo: number; bajo: boolean; ultima_recarga: string | null; guias_30d: number;
}

export interface Paqueteria { id: number; nombre: string; usa_saldo: boolean; saldo_minimo: number | null; activa: boolean; notas: string | null }
export interface ItemChecklist { id: number; aplica: "equipo" | "componente" | "todos"; texto: string; orden: number; activo: boolean }

export interface Devolucion {
  id: string; folio: string; pedido_id: string; pedido_folio: string; canal: string; id_externo: string | null; cliente_id: string;
  cliente: string | null; vendedor_id: string | null; vendedor: string | null; envio_id: string | null; envio_folio: string | null;
  numero_guia: string | null; paqueteria: string | null; tipo: TipoDevolucion; estado: EstadoDevolucion; codigo_autorizacion: string | null;
  motivo: string; fecha_esperada: string | null; fecha_limite: string | null; responsable_id: string | null; responsable: string | null;
  respuesta: string | null; respondido_en: string | null; respondido_por_nombre: string | null; recibido_en: string | null;
  recibido_por_nombre: string | null; nota_recepcion: string | null; resultado: string | null; almacen_id: number | null;
  almacen: string | null; reclamo_transportista: string | null; monto_reclamado: number | null; nota_resolucion: string | null;
  resuelto_en: string | null; resuelto_por_nombre: string | null; reingresado_en: string | null; cancelado_en: string | null;
  motivo_cancelacion: string | null; creado_por_nombre: string | null; creado_en: string; resumen: string | null; fotos: number;
  abierta: boolean; vence: string | null; vencida: boolean;
}

export interface LineaDevolucion {
  id: string; devolucion_id: string; pedido_linea_id: string | null; articulo_id: string | null; descripcion: string;
  cantidad: number; cantidad_recibida: number | null; movimiento_id: number | null; ajuste_id: string | null;
}

/** Recarga lo de envíos cuando cambia algo en estas tablas. */
export function useEnviosEnVivo() {
  useTiempoReal("envios", [CLAVE]);
  useTiempoReal("evidencias_envio", [CLAVE]);
  useTiempoReal("devoluciones", [CLAVE]);
}

export function useEnvios(filtro?: { pedidoId?: string }) {
  return useQuery({
    queryKey: [...CLAVE, "lista", filtro?.pedidoId ?? "todos"],
    queryFn: () => {
      let c = supabase.from("v_envios").select("*");
      if (filtro?.pedidoId) c = c.eq("pedido_id", filtro.pedidoId);
      // Abiertos todos; cerrados, los de los últimos 60 días.
      else c = c.or(`abierto.eq.true,solicitado_en.gte."${new Date(Date.now() - 60 * 86_400_000).toISOString()}"`);
      return q<Envio[]>(c.order("solicitado_en", { ascending: false }).limit(500));
    },
  });
}

export function useEnvio(id: string | null | undefined) {
  return useQuery({
    queryKey: [...CLAVE, "envio", id],
    enabled: !!id,
    queryFn: () => q<Envio | null>(supabase.from("v_envios").select("*").eq("id", id!).maybeSingle()),
  });
}

export function useLineas(envioId: string | null | undefined) {
  return useQuery({
    queryKey: [...CLAVE, "lineas", envioId],
    enabled: !!envioId,
    queryFn: () => q<LineaEnvio[]>(supabase.from("v_envio_lineas").select("*").eq("envio_id", envioId!).order("orden")),
  });
}

export function useBultos(envioId: string | null | undefined) {
  return useQuery({
    queryKey: [...CLAVE, "bultos", envioId],
    enabled: !!envioId,
    queryFn: () => q<Bulto[]>(supabase.from("envio_bultos").select("id, articulo_id, contenido, piezas, peso_kg, largo_cm, ancho_cm, alto_cm").eq("envio_id", envioId!).order("orden")),
  });
}

export function useArchivos(filtro: { envioId?: string | null; envioIds?: string[]; devolucionId?: string | null }) {
  const clave = filtro.envioIds?.join(",") ?? filtro.envioId ?? filtro.devolucionId;
  return useQuery({
    queryKey: [...CLAVE, "archivos", clave],
    enabled: !!clave,
    queryFn: () => {
      let c = supabase.from("v_evidencias_envio").select("*");
      if (filtro.envioIds) c = c.in("envio_id", filtro.envioIds);
      else if (filtro.envioId) c = c.eq("envio_id", filtro.envioId);
      else c = c.eq("devolucion_id", filtro.devolucionId!);
      return q<Archivo[]>(c.order("en"));
    },
  });
}

export function useEventos(filtro: { envioId?: string | null; devolucionId?: string | null }) {
  const id = filtro.envioId ?? filtro.devolucionId;
  return useQuery({
    queryKey: [...CLAVE, "eventos", id],
    enabled: !!id,
    queryFn: () => q<Evento[]>(supabase.from("v_eventos_envio").select("*")
      .eq(filtro.envioId ? "envio_id" : "devolucion_id", id!).order("en", { ascending: false }).order("id", { ascending: false })),
  });
}

export function usePlanSalida(envioId: string | null | undefined, habilitado = true) {
  return useQuery({
    queryKey: [...CLAVE, "plan", envioId],
    enabled: !!envioId && habilitado,
    queryFn: () => q<PlanSalida[]>(supabase.rpc("plan_salida_envio", { p_envio: envioId })),
  });
}

export function useSaldos(habilitado = true) {
  return useQuery({
    queryKey: [...CLAVE, "saldos"],
    enabled: habilitado,
    queryFn: () => q<Saldo[]>(supabase.rpc("saldos_paqueteria")),
  });
}

export function usePaqueterias() {
  return useQuery({
    queryKey: [...CLAVE, "paqueterias"],
    staleTime: 10 * 60_000,
    queryFn: () => q<Paqueteria[]>(supabase.from("paqueterias").select("*").order("nombre")),
  });
}

export function useChecklist() {
  return useQuery({
    queryKey: [...CLAVE, "checklist"],
    staleTime: 10 * 60_000,
    queryFn: () => q<ItemChecklist[]>(supabase.from("checklist_salida").select("*").order("aplica").order("orden")),
  });
}

export function useAlmacenes() {
  return useQuery({
    queryKey: ["almacenes", "todos"],
    staleTime: 30 * 60_000,
    queryFn: () => q<{ id: number; nombre: string; disponible_para_planta: boolean }[]>(
      supabase.from("almacenes").select("id, nombre, disponible_para_planta").eq("activo", true).order("id")),
  });
}

export function useDevoluciones() {
  return useQuery({
    queryKey: [...CLAVE, "devoluciones"],
    queryFn: () => q<Devolucion[]>(supabase.from("v_devoluciones").select("*")
      .or(`abierta.eq.true,creado_en.gte."${new Date(Date.now() - 120 * 86_400_000).toISOString()}"`)
      .order("creado_en", { ascending: false }).limit(500)),
  });
}

export function useDevolucion(id: string | null | undefined) {
  return useQuery({
    queryKey: [...CLAVE, "devolucion", id],
    enabled: !!id,
    queryFn: () => q<Devolucion | null>(supabase.from("v_devoluciones").select("*").eq("id", id!).maybeSingle()),
  });
}

export function useLineasDevolucion(id: string | null | undefined) {
  return useQuery({
    queryKey: [...CLAVE, "lineas_devolucion", id],
    enabled: !!id,
    queryFn: () => q<LineaDevolucion[]>(supabase.from("devolucion_lineas").select("*").eq("devolucion_id", id!)),
  });
}

// -----------------------------------------------------------------------------
// Archivos: bucket privado "envios". Las fotos se achican en el celular antes de
// subir (el almacén sube con datos) y se ven con enlaces firmados.
// -----------------------------------------------------------------------------
export const BUCKET = "envios";

export async function comprimirImagen(archivo: File, lado = 1600, calidad = 0.82): Promise<Blob> {
  if (!archivo.type.startsWith("image/") || archivo.type === "image/heic" || archivo.type === "image/heif") return archivo;
  try {
    const bmp = await createImageBitmap(archivo);
    const escala = Math.min(1, lado / Math.max(bmp.width, bmp.height));
    const lienzo = document.createElement("canvas");
    lienzo.width = Math.round(bmp.width * escala);
    lienzo.height = Math.round(bmp.height * escala);
    lienzo.getContext("2d")!.drawImage(bmp, 0, 0, lienzo.width, lienzo.height);
    const blob = await new Promise<Blob | null>((ok) => lienzo.toBlob(ok, "image/jpeg", calidad));
    return blob ?? archivo;
  } catch {
    return archivo;
  }
}

/** Sube un archivo a la carpeta del registro (envios/<id> o devoluciones/<id>) y devuelve su ruta. */
export async function subirArchivo(carpeta: string, archivo: Blob, extension: string) {
  const ruta = `${carpeta}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from(BUCKET).upload(ruta, archivo, {
    contentType: archivo.type || (extension === "pdf" ? "application/pdf" : "image/jpeg"), upsert: false,
  });
  if (error) throw new Error(/row-level security|Unauthorized|403/i.test(error.message) ? "No tienes permiso para subir archivos aquí." : error.message);
  return ruta;
}

export function useUrlsFirmadas(rutas: string[]) {
  const clave = [...rutas].sort().join("|");
  return useQuery({
    queryKey: [...CLAVE, "urls", clave],
    enabled: rutas.length > 0,
    staleTime: 50 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(rutas, 3600);
      if (error) throw new Error(error.message);
      return Object.fromEntries((data ?? []).filter((d) => d.signedUrl).map((d) => [d.path, d.signedUrl])) as Record<string, string>;
    },
  });
}

/** "13 kg · 38 × 62 × 29 cm" */
export function medidas(b: { peso_kg?: number | null; largo_cm?: number | null; ancho_cm?: number | null; alto_cm?: number | null }) {
  const n = (x: number | null | undefined) => (x == null ? "?" : new Intl.NumberFormat("es-MX", { maximumFractionDigits: 1 }).format(Number(x)));
  if (b.peso_kg == null && b.largo_cm == null) return "sin medir";
  return `${n(b.peso_kg)} kg · ${n(b.largo_cm)} × ${n(b.ancho_cm)} × ${n(b.alto_cm)} cm`;
}

/** Cuánto falta para una hora límite, en palabras cortas ("en 5 h", "venció hace 2 h"). */
export function faltan(limite: string | null) {
  if (!limite) return null;
  const min = Math.round((new Date(limite).getTime() - Date.now()) / 60_000);
  const txt = (m: number) => (m < 60 ? `${m} min` : m < 48 * 60 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} días`);
  return min >= 0 ? `en ${txt(min)}` : `venció hace ${txt(-min)}`;
}

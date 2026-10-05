import { useQuery } from "@tanstack/react-query";
import { Anchor, CheckCircle2, Factory, PackageCheck, PackageSearch, Ship, Ban, type LucideIcon } from "lucide-react";
import { Insignia, type Tono } from "@/components/ui/insignia";
import { supabase } from "@/lib/supabase";
import { q, useTiempoReal } from "@/lib/consultas";
import { useSesion } from "@/lib/sesion";
import { cn } from "@/lib/utilidades";

export type Fase = "cotizando" | "produccion" | "listo" | "transito" | "puerto" | "planta" | "cerrado" | "cancelado";
export type Debe = "proveedor" | "agente" | "naviera" | "forwarder" | "hegamex" | "transportista";
export type Modalidad = "fcl" | "lcl" | "consolidado" | "aereo";
export type Moneda = "MXN" | "USD" | "EUR";

export const FASES: Record<Fase, { texto: string; tono: Tono; icono: LucideIcon }> = {
  cotizando: { texto: "Cotizando", tono: "neutro", icono: PackageSearch },
  produccion: { texto: "En producción", tono: "info", icono: Factory },
  listo: { texto: "Listo para embarcar", tono: "info", icono: PackageCheck },
  transito: { texto: "En el mar", tono: "marca", icono: Ship },
  puerto: { texto: "En puerto", tono: "aviso", icono: Anchor },
  planta: { texto: "En planta · cierre pendiente", tono: "ok", icono: PackageCheck },
  cerrado: { texto: "Cerrado", tono: "neutro", icono: CheckCircle2 },
  cancelado: { texto: "Cancelado", tono: "peligro", icono: Ban },
};

export const NOMBRE_DEBE: Record<Debe, string> = {
  proveedor: "Proveedor", agente: "Agente aduanal", naviera: "Naviera", forwarder: "Forwarder", hegamex: "Hegamex", transportista: "Transportista",
};

export const MODALIDADES: Record<Modalidad, string> = {
  fcl: "Contenedor completo (FCL)", lcl: "Carga consolidada (LCL)", consolidado: "Consolidado de varios proveedores", aereo: "Aéreo",
};
export const MODALIDAD_CORTA: Record<Modalidad, string> = { fcl: "FCL", lcl: "LCL", consolidado: "Consolidado", aereo: "Aéreo" };

export const INCOTERMS = ["EXW", "FCA", "FAS", "FOB", "CFR", "CIF", "CPT", "CIP", "DAP", "DPU", "DDP"] as const;

export interface OrdenEmbarque { id: string; folio: string; proveedor: string; proveedor_id: string; factura: string | null; volumen_m3: number | null; estado: string; fecha: string; moneda: Moneda }
export interface DocFaltante { id: string; tipo: string; nombre: string; debe: Debe; estado: string; antes_de_arribo: boolean }

export interface Embarque {
  id: string; folio: string; descripcion: string; modalidad: Modalidad; importador: "empresa" | "persona_fisica"; incoterm: string | null;
  puerto_origen: string | null; puerto_destino: string; naviera: string | null; forwarder: string | null; agente_aduanal: string | null;
  referencia_agente: string | null; bl: string | null; bl_house: string | null; contenedores: string | null; buque: string | null; viaje: string | null;
  bultos: number | null; peso_kg: number | null; volumen_m3: number | null; etd: string | null; eta: string | null; eta_original: string | null;
  dias_libres_almacenaje: number; dias_libres_demoras: number | null; carpeta_url: string | null; notas: string | null; cancelado: boolean;
  /** El de sus órdenes manda; este es para cuando todavía no tiene orden ligada (093). */
  proveedor_id: string | null;
  creado_en: string; fase: Fase; etapa: string | null; etapa_nombre: string | null; fechas: Record<string, string>;
  arribo: string | null; despacho: string | null; en_planta: string | null; vacio: string | null;
  dias_en_puerto: number | null; dias_contenedor: number | null; llegada_planta_estimada: string | null; cambios_eta: number;
  proveedores: string | null; ordenes: OrdenEmbarque[]; docs_pendientes: number; docs_pendientes_arribo: number; docs_total: number;
  docs_faltan: DocFaltante[]; siguiente_paso: string | null; debe: Debe | null;
}

export interface Alerta {
  embarque_id: string; folio: string; descripcion: string; tipo: string; tono: "riesgo" | "atencion" | "info";
  titulo: string; detalle: string; debe: Debe | null; fecha: string | null; orden: number;
}

export interface Dinero {
  embarque_id: string; folio: string; comprometido_usd: number; pagado_usd: number; pagado_mxn: number; programado_usd: number;
  por_pagar_usd: number; por_pagar_mxn: number; tc_promedio: number | null; gastos_mxn: number; iva_acreditable_mxn: number;
  impuestos_mxn: number; por_recuperar_mxn: number; por_recuperar_usd: number; recuperado_mxn: number;
}

export interface Etapa { tipo: string; nombre: string; orden: number; fase: Fase; hito: boolean; descripcion: string | null }

export const CLAVE_EMBARQUES = ["v_embarques"];

/** Mismo criterio que ve_dinero_importacion() en la base: el menú se esconde por comodidad, la RLS es la barrera. */
export function useVeDinero() {
  const { puede } = useSesion();
  return puede("importaciones") && (puede("compras", 2) || puede("finanzas") || puede("costos"));
}

/** Embarques con su fase y lo que falta. Se recarga solo cuando alguien registra algo. */
export function useEmbarques() {
  useTiempoReal("embarques", [CLAVE_EMBARQUES, ["alertas_importacion"]]);
  useTiempoReal("embarque_eventos", [CLAVE_EMBARQUES, ["alertas_importacion"], ["embarque_eventos"]]);
  useTiempoReal("embarque_documentos", [CLAVE_EMBARQUES, ["alertas_importacion"], ["embarque_documentos"]]);
  return useQuery({
    queryKey: CLAVE_EMBARQUES,
    queryFn: () => q<Embarque[]>(supabase.from("v_embarques").select("*").order("folio", { ascending: false })),
  });
}

export function useAlertas() {
  return useQuery({ queryKey: ["alertas_importacion"], queryFn: () => q<Alerta[]>(supabase.rpc("alertas_importacion")) });
}

export function useEtapas() {
  return useQuery({
    queryKey: ["etapas_importacion"], staleTime: 60 * 60_000,
    queryFn: () => q<Etapa[]>(supabase.from("etapas_importacion").select("*").order("orden")),
  });
}

export function InsigniaFase({ fase, className }: { fase: Fase; className?: string }) {
  const f = FASES[fase];
  return <Insignia tono={f.tono} punto className={className}>{f.texto}</Insignia>;
}

export function InsigniaDebe({ debe }: { debe: Debe | null | undefined }) {
  if (!debe) return null;
  return <Insignia tono={debe === "hegamex" ? "marca" : "neutro"}>{debe === "hegamex" ? "Nos toca" : `Debe: ${NOMBRE_DEBE[debe]}`}</Insignia>;
}

/** Días usados contra días libres: la barra se pone en aviso a partir del día libres − 3 y en rojo al pasarse. */
export function DiasLibres({ usados, libres, etiqueta }: { usados: number | null; libres: number | null; etiqueta: string }) {
  if (usados == null || libres == null) return null;
  const pct = Math.min(100, libres > 0 ? (usados / libres) * 100 : 100);
  const tono = usados >= libres ? "bg-peligro" : usados >= libres - 3 ? "bg-aviso" : "bg-ok";
  return (
    <div className="space-y-1" title={`${usados} de ${libres} días libres`}>
      <div className="flex justify-between text-xs">
        <span className="text-tenue">{etiqueta}</span>
        <span className={cn("cifra font-medium", usados >= libres ? "text-peligro" : usados >= libres - 3 ? "text-aviso" : "text-texto")}>
          {usados} de {libres} días
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-fondo overflow-hidden" role="progressbar" aria-valuenow={usados} aria-valuemax={libres} aria-label={etiqueta}>
        <div className={cn("h-full rounded-full", tono)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export const CONCEPTOS_GASTO: Record<string, string> = {
  flete_internacional: "Flete internacional", seguro: "Seguro", cargos_locales: "Cargos locales", revalidacion: "Revalidación",
  desconsolidacion: "Desconsolidación", maniobras: "Maniobras", almacenaje: "Almacenaje", demoras: "Demoras", limpieza: "Limpieza de contenedor",
  honorarios: "Honorarios del agente", cuenta_gastos: "Cuenta de gastos (total)", flete_local: "Flete Manzanillo–Atotonilco", grua: "Grúa y otros", otro: "Otro",
};

export const ESTADOS_PAGO: Record<string, { texto: string; tono: Tono }> = {
  programado: { texto: "Programado", tono: "info" }, pagado: { texto: "Pagado", tono: "aviso" }, retenido: { texto: "Retenido", tono: "peligro" },
  confirmado: { texto: "Confirmado", tono: "ok" }, devuelto: { texto: "Devuelto", tono: "neutro" },
};

/** Abre un archivo del bucket con un enlace firmado de 5 minutos. La política decide si se puede. */
export async function abrirArchivo(ruta: string) {
  const { data, error } = await supabase.storage.from("importaciones").createSignedUrl(ruta, 300);
  if (error || !data) throw new Error("No tienes permiso para abrir este archivo o ya no existe.");
  window.open(data.signedUrl, "_blank", "noopener");
}

/** Sube un archivo a la carpeta del embarque y devuelve su ruta. */
export async function subirArchivo(embarque: string, tipo: string, archivo: File) {
  const limpio = archivo.name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.-]+/g, "_").slice(-80);
  const ruta = `${embarque}/${tipo}/${crypto.randomUUID().slice(0, 8)}-${limpio}`;
  const { error } = await supabase.storage.from("importaciones").upload(ruta, archivo, { contentType: archivo.type || undefined });
  if (error) throw new Error(/mime|type/i.test(error.message) ? "Ese tipo de archivo no se acepta (PDF, imagen, Word o Excel)." : error.message);
  return ruta;
}

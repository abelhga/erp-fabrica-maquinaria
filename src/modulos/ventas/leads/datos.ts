import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { q } from "@/lib/consultas";
import type { Tono } from "@/components/ui/insignia";
import { ETAPA, type EtapaOportunidad, type Linea } from "../comun";

export type EstadoLead = "nuevo" | "asignado" | "convertido" | "descartado";
export type ModoLeads = "bandeja" | "gerente" | "recepcion";
export interface ConfigLeads { modo: ModoLeads; horas_sin_tomar: number; horas_sin_atender: number; vendedores: string[] }

export interface Lead {
  id: string; nombre: string; empresa: string | null; telefono: string | null; correo: string | null;
  ciudad: string | null; estado_mx: string | null; interes: string; linea: Linea; fuente: string | null; notas: string | null;
  cliente_id: string | null; cliente_nombre: string | null; estado: EstadoLead; vendedor_id: string | null; vendedor: string | null;
  como_se_asigno: "cliente" | "bandeja" | "gerente" | "recepcion" | null; asignado_en: string | null; atendido_en: string | null;
  oportunidad_id: string | null; etapa_oportunidad: EtapaOportunidad | null; motivo_descarte: string | null;
  capturado_por: string | null; capturo: string | null; creado_en: string;
  intentos: number; contesto: boolean; ultimo_intento: string | null; ultimo_resultado: ResultadoIntento | null; ultimo_canal: CanalIntento | null;
  /** Lo que le falta para que el vendedor lo atienda (la base lo calcula: es lo que mide «Leads capturados completos»). */
  faltan: string[];
}

/** Cada vez que el vendedor le llamó o escribió, y si le contestó. */
export interface IntentoLead { id: string; canal: CanalIntento; resultado: ResultadoIntento; nota: string | null; en: string; usuario: { nombre: string } | null }
export type CanalIntento = "llamada" | "whatsapp" | "correo" | "visita";
/** «enviado»: le escribiste (WhatsApp o correo) y todavía no contesta. «no_contesto»: llamada o visita sin respuesta. */
export type ResultadoIntento = "contesto" | "no_contesto" | "enviado";
export const CANAL_INTENTO: Record<CanalIntento, string> = { llamada: "Llamada", whatsapp: "WhatsApp", correo: "Correo", visita: "Visita" };

/** Por escrito no se espera respuesta al momento: se anota que le escribiste. */
export const porEscrito = (c: CanalIntento) => c === "whatsapp" || c === "correo";

/** El botón para el intento sin respuesta, según por dónde fue. */
export function botonSinRespuesta(c: CanalIntento): { texto: string; resultado: ResultadoIntento } {
  return porEscrito(c) ? { texto: "Le escribí", resultado: "enviado" } : { texto: c === "visita" ? "No estaba" : "No contestó", resultado: "no_contesto" };
}

/** Cómo se lee un intento sin respuesta: corto (insignia) y con el medio (lista). */
export function textoIntento(c: CanalIntento | null, r: ResultadoIntento | null): { corto: string; largo: string } {
  if (r === "contesto") return { corto: "Contestó", largo: "Contestó" };
  if (r === "enviado") return { corto: "Le escribiste", largo: c === "correo" ? "Le escribiste por correo" : "Le escribiste por WhatsApp" };
  if (c === "visita") return { corto: "No estaba", largo: "Lo visitaste, no estaba" };
  if (c === "whatsapp" || c === "correo") return { corto: "No contestó", largo: `${CANAL_INTENTO[c]}, no contestó` };
  return { corto: "No contestó", largo: "Llamaste, no contestó" };
}

export const CLAVE_LEADS = ["v_leads"] as const;

export const MODOS: { valor: ModoLeads; texto: string; detalle: string }[] = [
  { valor: "bandeja", texto: "Bandeja: el primero lo toma",
    detalle: "Cae en «Por tomar» y se avisa a los vendedores. El primero que lo toma se lo queda." },
  { valor: "gerente", texto: "La gerencia de ventas lo asigna",
    detalle: "Solo la gerencia ve los nuevos y decide a qué vendedor se lo da." },
  { valor: "recepcion", texto: "Recepción elige al vendedor",
    detalle: "Al registrarlo, quien contestó escoge a quién se lo pasa." },
];

export function useConfigLeads() {
  return useQuery({
    queryKey: ["configuracion", "leads"], staleTime: 60_000,
    queryFn: async () => {
      const v = await q<{ valor: Partial<ConfigLeads> } | null>(supabase.from("configuracion").select("valor").eq("clave", "leads").maybeSingle());
      return { modo: "bandeja", horas_sin_tomar: 2, horas_sin_atender: 24, vendedores: [], ...(v?.valor ?? {}) } as ConfigLeads;
    },
  });
}

/** A quién se le puede pasar un lead (solo nombres; lo pueden pedir recepción y ventas). */
export function useVendedoresLeads(habilitado = true) {
  return useQuery({
    queryKey: ["vendedores_para_leads"], staleTime: 5 * 60_000, enabled: habilitado,
    queryFn: () => q<{ id: string; nombre: string }[]>(supabase.rpc("vendedores_para_leads")),
  });
}

/** Cómo va: por tomar, con quién, en qué etapa quedó la oportunidad o por qué se descartó. */
export function estadoLead(l: Pick<Lead, "estado" | "vendedor" | "etapa_oportunidad">, modo?: ModoLeads): { texto: string; tono: Tono } {
  if (l.estado === "nuevo") return { texto: modo === "gerente" ? "Por asignar" : "Por tomar", tono: "aviso" };
  if (l.estado === "asignado") return { texto: `Con ${l.vendedor?.split(" ")[0] ?? "vendedor"}`, tono: "info" };
  if (l.estado === "descartado") return { texto: "Descartado", tono: "neutro" };
  const e = l.etapa_oportunidad ? ETAPA[l.etapa_oportunidad] : null;
  return { texto: `Oportunidad${e ? ` · ${e.texto}` : ""}`, tono: l.etapa_oportunidad === "perdida" ? "peligro" : l.etapa_oportunidad === "ganada" ? "ok" : "marca" };
}

/** "hace 12 min", "hace 3 h", "ayer": un lead se mide en horas, no en días. */
export function hace(f: string | null | undefined) {
  if (!f) return "—";
  const min = Math.max(0, Math.round((Date.now() - new Date(f).getTime()) / 60_000));
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? "ayer" : `hace ${d} días`;
}

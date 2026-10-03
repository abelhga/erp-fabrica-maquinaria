// Cliente de la función `asistente` (supabase/functions/asistente). La llave de
// Claude vive en el servidor; aquí solo viaja la sesión de quien pregunta.
import { supabase } from "./supabase";

export type Area = "direccion" | "ventas" | "compras" | "almacen" | "produccion" | "finanzas" | "importaciones"
  | "servicio";
export type Tono = "riesgo" | "atencion" | "bueno" | "info";

export interface Resumen {
  titular: string;
  resumen: string;
  puntos: { tono: Tono; titulo: string; detalle: string; accion: string; ruta: string }[];
  generado_en: string;
  simulado?: boolean;
  guardado?: boolean;
  modelo?: string;
  aviso?: string;
}

export interface MensajeChat { rol: "usuario" | "asistente"; texto: string }

export type Evento =
  | { tipo: "texto"; texto: string }
  | { tipo: "herramienta"; nombre: string; etiqueta: string }
  | { tipo: "fin"; modelo: string; simulado?: boolean }
  | { tipo: "error"; mensaje: string; codigo: string };

// En desarrollo se puede servir con Node (scripts/asistente-local.ts) y apuntar aquí.
const URL_ASISTENTE = import.meta.env.VITE_ASISTENTE_URL || `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/asistente`;

async function cabeceras() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Tu sesión expiró. Vuelve a entrar.");
  return { Authorization: `Bearer ${token}`, apikey: import.meta.env.VITE_SUPABASE_ANON_KEY, "Content-Type": "application/json" };
}

async function llamar(cuerpo: unknown, signal?: AbortSignal) {
  let r: Response;
  try {
    r = await fetch(URL_ASISTENTE, { method: "POST", headers: await cabeceras(), body: JSON.stringify(cuerpo), signal });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new Error("No se pudo hablar con el asistente. ¿Está desplegada la función?");
  }
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    throw new Error((j as { error?: string }).error ?? `El asistente respondió ${r.status}`);
  }
  return r;
}

export async function pedirResumen(area: Area, forzar = false): Promise<Resumen> {
  return (await llamar({ modo: "resumen", area, forzar })).json();
}

// Lo mismo que semana_en_numeros() en SQL; cada sección llega solo si tu rol la ve.
type Lista = Record<string, string | number | null>[];
export interface NumerosSemana {
  semana: { lunes: string; pasada_desde: string; pasada_hasta: string; hasta: string };
  ventas?: { alcance: "empresa" | "tuyas"; monto: number; monto_anterior: number; operaciones: number; operaciones_anterior: number;
    cotizaciones_enviadas: { n: number; monto: number }; cotizaciones_ganadas: { n: number; monto: number }; cotizaciones_perdidas: number;
    cotizaciones_sin_respuesta: { n: number; monto: number }; mejores_clientes: Lista; entregas_comprometidas: Lista };
  cobranza?: { cobrado: number; cobrado_anterior: number };
  produccion?: { terminadas: number; terminadas_anterior: number; atrasadas: number; en_proceso: number; comprometidas: Lista };
  compras?: { por_llegar: Lista; atrasadas: number; ajustes_pendientes: number; ajustes_semana: number };
  importaciones?: { llegan: Lista };
  servicio?: { cerrados: number; programados: Lista };
  pendientes: { vencidos: number; esta_semana: number; cerrados: number };
}
export interface Semana extends Resumen { numeros: NumerosSemana }

export async function pedirSemana(forzar = false): Promise<Semana> {
  return (await llamar({ modo: "semana", forzar })).json();
}

export async function redactarMensaje(cliente_id: string, canal: "whatsapp" | "correo", motivo: string) {
  return (await llamar({ modo: "redactar", cliente_id, canal, motivo })).json() as Promise<{ asunto: string; mensaje: string; simulado?: boolean }>;
}

export type TipoDocumento = "proforma" | "factura" | "lista_empaque" | "bl" | "pedimento" | "cuenta_gastos";

/** Claude lee un PDF o una foto y devuelve sus campos. No guarda nada: eso lo confirma quien lo revisa. */
export async function leerDocumento(tipo: TipoDocumento, archivo: File, signal?: AbortSignal) {
  const datos = await new Promise<string>((ok, mal) => {
    const lector = new FileReader();
    lector.onload = () => ok(String(lector.result).split(",")[1] ?? "");
    lector.onerror = () => mal(new Error("No se pudo leer el archivo."));
    lector.readAsDataURL(archivo);
  });
  const r = await llamar({ modo: "leer_documento", tipo, media_type: archivo.type, datos }, signal);
  return r.json() as Promise<{ tipo: TipoDocumento; campos: Record<string, unknown>; simulado?: boolean; modelo?: string }>;
}

/** Conversación en streaming: cada evento llega en cuanto Claude lo escribe. */
export async function conversar(mensajes: MensajeChat[], ruta: string, alEvento: (e: Evento) => void, signal?: AbortSignal) {
  const r = await llamar({ modo: "chat", mensajes, ruta }, signal);
  const lector = r.body!.pipeThrough(new TextDecoderStream()).getReader();
  let pendiente = "";
  for (;;) {
    const { value, done } = await lector.read();
    if (done) break;
    pendiente += value;
    const partes = pendiente.split("\n\n");
    pendiente = partes.pop() ?? "";
    for (const p of partes) if (p.startsWith("data: ")) alEvento(JSON.parse(p.slice(6)) as Evento);
  }
}

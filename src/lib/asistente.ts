// Cliente de la función `asistente` (supabase/functions/asistente). La llave de
// Claude vive en el servidor; aquí solo viaja la sesión de quien pregunta.
import { EN_VISTA_PREVIA, supabase } from "./supabase";

export type Area = "direccion" | "ventas" | "compras" | "almacen" | "produccion" | "finanzas" | "importaciones"
  | "servicio" | "rrhh" | "ingenieria" | "mantenimiento";
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
  // En una vista previa no se le pregunta a Claude: gastaría y anotaría el uso a
  // nombre de la otra persona. La tarjeta de Inicio cae sola a las reglas de la base.
  if (EN_VISTA_PREVIA) throw new Error("En la vista previa no se usa el asistente.");
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

/** Claude corrige ortografía y estilo de una descripción de catálogo. No guarda: devuelve el texto propuesto. */
export async function pulirDescripcion(texto: string, nombre: string, tipo: string) {
  return (await llamar({ modo: "pulir_descripcion", texto, nombre, tipo })).json() as Promise<{ texto: string; dudas: string[]; simulado?: boolean }>;
}

export async function redactarMensaje(cliente_id: string, canal: "whatsapp" | "correo", motivo: string) {
  return (await llamar({ modo: "redactar", cliente_id, canal, motivo })).json() as Promise<{ asunto: string; mensaje: string; simulado?: boolean }>;
}

/** Los que lee importaciones dentro de un embarque. */
export type TipoImportacion = "proforma" | "factura" | "lista_empaque" | "bl" | "pedimento" | "cuenta_gastos";
export type TipoDocumento = TipoImportacion | "cotizacion_proveedor" | "constancia_fiscal" | "factura_proveedor";

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

/** Una mejora que Claude sugiere con los datos del taller (sugerir_mejoras en la función). */
export interface SugerenciaMejora {
  titulo: string; etapa: string; desperdicio: string; tipo: "kaizen" | "a3";
  problema: string; propuesta: string; evidencia: string; ahorro_horas_mes: number;
}
export interface SugerenciasMejora {
  lectura: string; sugerencias: SugerenciaMejora[];
  generado_en: string; simulado?: boolean; guardado?: boolean; modelo?: string | null; aviso?: string;
}

/** Solo para quien decide las mejoras (procesos 2): la función lo revisa. Las del día se reusan. */
export async function pedirSugerenciasMejora(forzar = false): Promise<SugerenciasMejora> {
  const r = await llamar({ modo: "sugerir_mejoras", forzar });
  // Las guardadas llegan como JSON; las nuevas, como flujo con latidos mientras Claude piensa
  // (el celular corta lo que pasa un minuto callado). Cuenta el último evento.
  if (!(r.headers.get("Content-Type") ?? "").includes("text/event-stream")) return r.json();
  const texto = await r.text();
  const eventos = texto.split("\n\n").filter((l) => l.startsWith("data: ")).map((l) => JSON.parse(l.slice(6)));
  const fin = eventos[eventos.length - 1] as (SugerenciasMejora & { tipo: "listo" }) | { tipo: "error"; mensaje: string } | undefined;
  if (!fin) throw new Error("El asistente cortó la respuesta. Intenta de nuevo.");
  if (fin.tipo === "error") throw new Error(fin.mensaje);
  return fin;
}

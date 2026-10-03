import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { q } from "@/lib/consultas";
import { cn } from "@/lib/utilidades";
import { hoyISO } from "@/lib/formato";
import type { Tono } from "@/components/ui/insignia";

export interface Empleado {
  id: string; numero: string | null; nombre: string; puesto: string | null;
  departamento_id: number | null; etapa_id: number | null; fecha_ingreso: string; fecha_nacimiento: string | null;
  telefono: string | null; correo: string | null; contacto_emergencia: string | null; foto_url: string | null;
  usuario_id: string | null; activo: boolean; baja_en: string | null; motivo_baja: string | null;
  departamento: { nombre: string } | null; etapa: { nombre: string; color: string } | null;
  usuario: { nombre: string; correo: string } | null;
}

export interface Vacaciones {
  empleado_id: string; nombre: string; fecha_ingreso: string; anios: number; dias_periodo: number; inicio_periodo: string;
  tomados: number; saldo: number; proximo_aniversario: string; dias_proximo_periodo: number; solicitados: number;
  disfrutar_antes_de: string;
}

export type TipoIncidencia = "vacaciones" | "permiso_con_goce" | "permiso_sin_goce" | "falta" | "incapacidad" | "retardo" | "horas_extra";
export type EstadoIncidencia = "solicitada" | "aprobada" | "rechazada";

export interface Incidencia {
  id: string; empleado_id: string; tipo: TipoIncidencia; inicio: string; fin: string; dias: number; horas: number | null;
  motivo: string | null; estado: EstadoIncidencia; creado_en: string; solicitada_por: string | null; resuelta_por: string | null;
  empleado?: { nombre: string; numero: string | null; puesto: string | null } | null;
}

/** Cómo se nombra y se pinta cada tipo. "ausencia" = la persona no está ese día. */
export const TIPOS: Record<TipoIncidencia, { texto: string; tono: Tono; ausencia: boolean; ayuda: string }> = {
  vacaciones: { texto: "Vacaciones", tono: "marca", ausencia: true, ayuda: "Se descuentan del saldo en días hábiles." },
  permiso_con_goce: { texto: "Permiso con goce", tono: "info", ausencia: true, ayuda: "Se paga el día; no toca las vacaciones." },
  permiso_sin_goce: { texto: "Permiso sin goce", tono: "neutro", ausencia: true, ayuda: "No se paga el día." },
  falta: { texto: "Falta", tono: "peligro", ausencia: true, ayuda: "Sin aviso o sin justificar." },
  incapacidad: { texto: "Incapacidad", tono: "aviso", ausencia: true, ayuda: "Del IMSS: cuenta días naturales, con folio en el motivo." },
  retardo: { texto: "Retardo", tono: "aviso", ausencia: false, ayuda: "Un solo día; anota cuánto tarde." },
  horas_extra: { texto: "Horas extra", tono: "ok", ausencia: false, ayuda: "Un solo día; anota cuántas horas." },
};

export const ESTADOS: Record<EstadoIncidencia, { texto: string; tono: Tono }> = {
  solicitada: { texto: "Por aprobar", tono: "aviso" },
  aprobada: { texto: "Aprobada", tono: "ok" },
  rechazada: { texto: "Rechazada", tono: "neutro" },
};

/** Clase de fondo para pintar un tipo en el calendario (tokens, no hex). */
export const FONDO_TIPO: Record<TipoIncidencia, string> = {
  vacaciones: "bg-marca-suave text-marca-texto",
  permiso_con_goce: "bg-info-suave text-info",
  permiso_sin_goce: "bg-fondo text-tenue",
  falta: "bg-peligro-suave text-peligro",
  incapacidad: "bg-aviso-suave text-aviso",
  retardo: "bg-aviso-suave text-aviso",
  horas_extra: "bg-ok-suave text-ok",
};

export function iniciales(nombre: string) {
  const p = nombre.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase();
}

/** "12 años 3 meses" a partir de la fecha de ingreso (hasta hoy o hasta la baja). */
export function antiguedad(desde: string, hasta?: string | null) {
  const a = new Date(desde + "T12:00:00"), b = hasta ? new Date(hasta + "T12:00:00") : new Date();
  let meses = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (b.getDate() < a.getDate()) meses--;
  if (meses < 1) return "menos de un mes";
  const anios = Math.floor(meses / 12), m = meses % 12;
  const ta = anios ? `${anios} ${anios === 1 ? "año" : "años"}` : "";
  const tm = m ? `${m} ${m === 1 ? "mes" : "meses"}` : "";
  return [ta, tm].filter(Boolean).join(" ");
}

export function mesesDeAntiguedad(desde: string) {
  const a = new Date(desde + "T12:00:00"), b = new Date();
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) - (b.getDate() < a.getDate() ? 1 : 0);
}

export function Avatar({ nombre, foto, tamano = "md", inactivo }: { nombre: string; foto?: string | null; tamano?: "sm" | "md" | "lg"; inactivo?: boolean }) {
  const t = tamano === "lg" ? "h-14 w-14 text-lg" : tamano === "sm" ? "h-7 w-7 text-[10px]" : "h-9 w-9 text-xs";
  if (foto) return <img src={foto} alt="" className={cn("rounded-full object-cover shrink-0", t, inactivo && "grayscale opacity-60")} />;
  return (
    <span className={cn("rounded-full flex items-center justify-center font-semibold shrink-0",
      inactivo ? "bg-fondo text-tenue border border-borde" : "bg-marca-suave text-marca-texto", t)}>
      {iniciales(nombre)}
    </span>
  );
}

export const CONSULTA_EMPLEADOS = "*, departamento:departamentos(nombre), etapa:etapas(nombre, color), usuario:perfiles(nombre, correo)";

export function useEmpleados() {
  return useQuery({
    queryKey: ["empleados"],
    queryFn: () => q<Empleado[]>(supabase.from("empleados").select(CONSULTA_EMPLEADOS).order("nombre")),
  });
}

export function useVacaciones() {
  return useQuery({
    queryKey: ["v_vacaciones"],
    queryFn: () => q<Vacaciones[]>(supabase.from("v_vacaciones").select("*")),
  });
}

/** Ausencias aprobadas que caen hoy (para "ausentes hoy" y el estado de cada persona). */
export function useAusentesHoy() {
  const hoy = hoyISO();
  return useQuery({
    queryKey: ["incidencias", "hoy", hoy],
    queryFn: () => q<Incidencia[]>(supabase.from("incidencias").select("*").eq("estado", "aprobada")
      .lte("inicio", hoy).gte("fin", hoy).in("tipo", Object.entries(TIPOS).filter(([, t]) => t.ausencia).map(([k]) => k))),
  });
}

export function useCatalogosRrhh() {
  const deptos = useQuery({
    queryKey: ["departamentos"],
    queryFn: () => q<{ id: number; nombre: string }[]>(supabase.from("departamentos").select("id, nombre").order("nombre")),
  });
  const etapas = useQuery({
    queryKey: ["etapas", "activas"],
    queryFn: () => q<{ id: number; nombre: string; color: string }[]>(supabase.from("etapas").select("id, nombre, color").eq("activa", true).order("orden")),
  });
  return { deptos: deptos.data ?? [], etapas: etapas.data ?? [] };
}

/** Días de vacaciones por años cumplidos, LFT reformada en 2023 (espejo de dias_vacaciones() en la base, solo para la tabla explicativa). */
export const TABLA_LFT = [
  { anios: "1", dias: 12 }, { anios: "2", dias: 14 }, { anios: "3", dias: 16 }, { anios: "4", dias: 18 }, { anios: "5", dias: 20 },
  { anios: "6 a 10", dias: 22 }, { anios: "11 a 15", dias: 24 }, { anios: "16 a 20", dias: 26 }, { anios: "21 a 25", dias: 28 },
  { anios: "26 a 30", dias: 30 }, { anios: "31 a 35", dias: 32 },
];

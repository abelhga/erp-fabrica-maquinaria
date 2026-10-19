// Llamadas a la función de borde "skydropx" (la que tiene las credenciales de Skydropx).
import { supabase } from "@/lib/supabase";

export const URL_SKYDROPX = import.meta.env.VITE_SKYDROPX_URL || `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/skydropx`;

export async function llamarSkydropx<T>(accion: "probar" | "catalogo" | "saldo" | "cotizar" | "generar" | "revisar", cuerpo: object = {}): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const r = await fetch(`${URL_SKYDROPX}/${accion}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${data.session?.access_token}`, apikey: import.meta.env.VITE_SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
  }).catch(() => { throw new Error("No se pudo hablar con el servidor. ¿Está desplegada la función skydropx?"); });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error ?? `El servidor respondió ${r.status}`);
  return d as T;
}

export interface TarifaSkydropx { id: string; paqueteria: string; servicio: string; total: number; dias: number | null; recoleccion: boolean }
export interface ResultadoGuia { ok: boolean; pendiente?: boolean; mensaje?: string; numero?: string; costo?: number; rastreo_url?: string | null }
export interface SaldoSkydropx { conectado: boolean; saldo?: number | null; moneda?: string }
export interface DireccionSkydropx {
  name?: string; company?: string; street1?: string; postal_code?: string; area_level1?: string; area_level2?: string; area_level3?: string;
  phone?: string; email?: string; reference?: string;
}
export interface PruebaSkydropx extends SaldoSkydropx {
  plantillas: { id: string; alias: string | null; tipo: string | null; predeterminada: boolean; direccion: DireccionSkydropx }[];
}
export interface ConfigSkydropx {
  origen_plantilla_id: string | null; origen: DireccionSkydropx | null; carta_porte: string | null; tipo_empaque: string | null; formato: "standard" | "thermal" | null;
}

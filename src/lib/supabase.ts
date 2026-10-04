import { createClient } from "@supabase/supabase-js";
import { esPestanaDeVistaPrevia } from "./vistaPrevia";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const llave = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// Sin estas dos variables la app arranca en blanco y el error se pierde en la
// consola; mejor fallar con un mensaje que diga exactamente qué falta.
if (!url || !llave) {
  throw new Error("Faltan VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY (ver .env.example)");
}

/** Esta pestaña es una vista previa de "Ver como" (ver lib/vistaPrevia.ts). */
export const EN_VISTA_PREVIA = esPestanaDeVistaPrevia();

// En una vista previa la sesión va en sessionStorage y con otra llave: si compartiera
// el localStorage, abrirla cerraría la sesión de quien la abrió en todas sus pestañas.
export const supabase = createClient(url, llave, {
  auth: EN_VISTA_PREVIA
    ? { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storage: window.sessionStorage, storageKey: "sb-vista-previa" }
    : { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

export const DOMINIO_EMPRESA = (import.meta.env.VITE_DOMINIO_EMPRESA as string | undefined) ?? "hegamex.com";

/** Lanza el error de Supabase como excepción para que React Query lo trate como fallo. */
export function sinError<T>(r: { data: T; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data;
}

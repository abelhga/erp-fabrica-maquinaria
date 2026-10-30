// Cómo dejó cada quien una vista: el orden de una lista, «Agrupar por» del material, la vista y el
// zoom del Gantt. Al volver, la encuentra igual (lo pidieron en la demostración con Luis, Miguel y
// Mimí). Solo cosas que acomodan lo que se ve; nunca un filtro ni una búsqueda, que esconderían
// información sin que la persona se acuerde de que los dejó puestos.
//
// Como el menú personal (menuPersonal.ts): vive en el navegador, una llave por usuario, para que
// dos personas en la misma computadora no se pisen.
import { useCallback, useEffect, useState } from "react";
import { useSesion } from "@/lib/sesion";

const llaveDe = (usuario: string | null | undefined, clave: string) => `pref.${usuario ?? "anonimo"}.${clave}`;

function leer<T>(llave: string): T | undefined {
  try {
    const v = localStorage.getItem(llave);
    return v == null ? undefined : (JSON.parse(v) as T);
  } catch { return undefined; }
}

/** Lo último que eligió esta persona para `clave`; si nunca eligió o ya no es válido, `porDefecto`. */
export function usePreferencia<T>(clave: string, porDefecto: T, esValido: (v: unknown) => v is T = (v): v is T => v !== undefined) {
  const { perfil } = useSesion();
  const llave = llaveDe(perfil?.id, clave);
  const desde = useCallback((l: string) => { const v = leer<unknown>(l); return esValido(v) ? v : porDefecto; },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []);
  const [valor, setValor] = useState<T>(() => desde(llave));
  useEffect(() => setValor(desde(llave)), [llave, desde]);
  const guardar = useCallback((v: T) => {
    setValor(v);
    try { localStorage.setItem(llave, JSON.stringify(v)); } catch { /* modo privado: dura la pestaña */ }
  }, [llave]);
  return [valor, guardar] as const;
}

/** Para opciones fijas («categoria» | «subensamble»…). */
export const unoDe = <T extends string>(opciones: readonly T[]) => (v: unknown): v is T => typeof v === "string" && (opciones as readonly string[]).includes(v);

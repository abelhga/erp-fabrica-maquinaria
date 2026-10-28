// Cómo acomodó cada quien su menú: secciones colapsadas, pantallas fijadas arriba y el orden de
// las secciones si lo movió. Es comodidad, no permiso (lo que se ve lo decide la RLS), así que vive
// en el navegador como el tema, una llave por usuario para que dos personas en la misma
// computadora no se pisen.
import { useCallback, useEffect, useState } from "react";

export interface MenuPersonal { orden: string[] | null; colapsadas: string[]; fijadas: string[] }
const VACIO: MenuPersonal = { orden: null, colapsadas: [], fijadas: [] };

function leer(llave: string): MenuPersonal {
  try {
    const v = JSON.parse(localStorage.getItem(llave) ?? "null") as Partial<MenuPersonal> | null;
    if (!v) return VACIO;
    return { orden: Array.isArray(v.orden) ? v.orden : null, colapsadas: Array.isArray(v.colapsadas) ? v.colapsadas : [],
      fijadas: Array.isArray(v.fijadas) ? v.fijadas : [] };
  } catch { return VACIO; }
}

export function useMenuPersonal(usuario: string | null | undefined) {
  const llave = `menu.${usuario ?? "anonimo"}`;
  const [prefs, setPrefs] = useState<MenuPersonal>(() => leer(llave));
  useEffect(() => setPrefs(leer(llave)), [llave]);
  const cambiar = useCallback((f: (p: MenuPersonal) => MenuPersonal) => {
    setPrefs((antes) => {
      const nuevo = f(antes);
      try { localStorage.setItem(llave, JSON.stringify(nuevo)); } catch { /* modo privado: dura la pestaña */ }
      return nuevo;
    });
  }, [llave]);
  const alternar = (lista: string[], x: string) => (lista.includes(x) ? lista.filter((y) => y !== x) : [...lista, x]);
  return {
    prefs,
    personalizado: !!prefs.orden || prefs.colapsadas.length > 0 || prefs.fijadas.length > 0,
    colapsar: (titulo: string) => cambiar((p) => ({ ...p, colapsadas: alternar(p.colapsadas, titulo) })),
    fijar: (ruta: string) => cambiar((p) => ({ ...p, fijadas: alternar(p.fijadas, ruta) })),
    /** Mueve una sección un lugar; `actual` es el orden que se está viendo (el del puesto si no lo ha movido). */
    mover: (titulo: string, paso: -1 | 1, actual: string[]) => cambiar((p) => {
      const o = [...actual];
      const i = o.indexOf(titulo), j = i + paso;
      if (i < 0 || j < 0 || j >= o.length) return p;
      [o[i], o[j]] = [o[j], o[i]];
      return { ...p, orden: o };
    }),
    restaurar: () => cambiar(() => VACIO),
  };
}

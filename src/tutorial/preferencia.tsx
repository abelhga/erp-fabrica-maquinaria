import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

/**
 * Modo tutorial encendido o apagado. Es de quien mira, no del sistema: vive en el navegador
 * (localStorage), como el tema, y no pasa por la base. Alguien que va empezando lo prende y lo
 * apaga cuando ya se sabe la pantalla; nadie más se entera.
 *
 * Se refleja como `data-tutorial` en <html> para que el CSS marque lo explicable sin que cada
 * componente tenga que preguntar.
 */
const LLAVE = "tutorial";

function leer(): boolean {
  try { return localStorage.getItem(LLAVE) === "si"; } catch { return false; }
}

interface Ctx { activo: boolean; cambiar: (v: boolean) => void }
const ContextoTutorial = createContext<Ctx>({ activo: false, cambiar: () => {} });

export function ProveedorTutorial({ children }: { children: ReactNode }) {
  const [activo, setActivo] = useState(leer);
  useEffect(() => {
    document.documentElement.setAttribute("data-tutorial", String(activo));
    try { localStorage.setItem(LLAVE, activo ? "si" : "no"); } catch { /* modo privado: dura lo que la pestaña */ }
  }, [activo]);
  const cambiar = useCallback((v: boolean) => setActivo(v), []);
  const valor = useMemo(() => ({ activo, cambiar }), [activo, cambiar]);
  return <ContextoTutorial.Provider value={valor}>{children}</ContextoTutorial.Provider>;
}

export function useTutorial(): Ctx {
  return useContext(ContextoTutorial);
}

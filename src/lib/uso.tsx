import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { EN_VISTA_PREVIA, supabase } from "@/lib/supabase";
import { useSesion } from "@/lib/sesion";

/**
 * La pantalla como se cuenta en «Uso del ERP»: sin ids ni folios, para que «la cotización 123» y
 * «la 456» sumen en la misma pantalla de detalle. No se guarda qué registro se vio.
 */
export function normalizarRuta(ruta: string) {
  return ruta
    .split("/")
    .map((s) => (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s) || /^\d+$/.test(s) ? ":id" : s))
    .join("/") || "/";
}

const MINUTO = 60_000;
/** Un minuto cuenta como activo si la pestaña se ve y hubo mouse, teclado o toque en los últimos dos. */
const INACTIVO_MS = 2 * MINUTO;

/**
 * Registra el uso del ERP para Sistema → Uso del ERP: cada pantalla que se abre y, cada minuto,
 * si la persona estuvo activa en ella. Una llamada por minuto como mucho. No registra nada en la
 * vista previa de «ver como una persona» (esa sesión es de otra persona y de solo lectura) ni en la
 * TV del taller (no la usa nadie: está prendida). Si falla, no se avisa: no debe estorbar.
 */
export function RastreoUso() {
  const { session, roles, vistaPrevia } = useSesion();
  const { pathname } = useLocation();
  const ruta = normalizarRuta(pathname);
  const rutaActual = useRef(ruta);
  const ultimaActividad = useRef(Date.now());
  const activo = !!session && !EN_VISTA_PREVIA && !vistaPrevia && !(roles.length === 1 && roles[0] === "pantalla");

  // Cada pantalla que se abre.
  useEffect(() => {
    rutaActual.current = ruta;
    if (!activo) return;
    void supabase.rpc("registrar_uso", { p_ruta: ruta, p_vista: true, p_minutos: 0 }).then(() => undefined, () => undefined);
  }, [ruta, activo]);

  // Los minutos activos.
  useEffect(() => {
    if (!activo) return;
    const marcar = () => { ultimaActividad.current = Date.now(); };
    const eventos = ["pointerdown", "keydown", "wheel", "touchstart", "mousemove"] as const;
    eventos.forEach((e) => window.addEventListener(e, marcar, { passive: true }));
    const t = window.setInterval(() => {
      if (document.visibilityState !== "visible" || Date.now() - ultimaActividad.current > INACTIVO_MS) return;
      void supabase.rpc("registrar_uso", { p_ruta: rutaActual.current, p_vista: false, p_minutos: 1 }).then(() => undefined, () => undefined);
    }, MINUTO);
    return () => { window.clearInterval(t); eventos.forEach((e) => window.removeEventListener(e, marcar)); };
  }, [activo]);

  return null;
}

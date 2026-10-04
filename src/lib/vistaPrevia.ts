// "Ver como": la vista previa vive en su propia pestaña, con la sesión de la otra
// persona guardada en sessionStorage (solo esa pestaña la conoce). Así la sesión de
// quien la abrió, en localStorage, no se toca, y al cerrar la pestaña se acaba.

export const RUTA_VISTA_PREVIA = "/vista-previa";
const MARCA = "hegamex-vista-previa";

export const MSJ_VISTA_PREVIA = "Es una vista previa: nada se guarda.";

/** ¿Esta pestaña es una vista previa? Se decide al cargar, antes de crear el cliente de Supabase. */
export function esPestanaDeVistaPrevia(): boolean {
  try {
    if (window.location.pathname === RUTA_VISTA_PREVIA) sessionStorage.setItem(MARCA, "1");
    return sessionStorage.getItem(MARCA) === "1";
  } catch {
    return false;
  }
}

/** Mensajes entre la pestaña que la pide y la vista previa (mismo origen). */
export type MensajeVista =
  | { tipo: "vista-previa-lista" }
  | { tipo: "vista-previa-sesion"; access_token: string; refresh_token: string };


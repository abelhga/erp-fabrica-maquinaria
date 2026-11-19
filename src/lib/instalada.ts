/**
 * El ERP como app instalada («Agregar a inicio» en iPad y iPhone, «Instalar» en Chrome y Edge).
 * Instalada no hay pestañas, ni barra de direcciones, ni botón de recargar: lo que en el navegador
 * se resuelve solo, aquí hay que hacerlo a propósito.
 */
import { useEffect } from "react";
import { toast } from "sonner";

declare const __VERSION__: string;

/** Corre como app instalada (sin la interfaz del navegador). */
export function instalada(): boolean {
  try {
    return window.matchMedia("(display-mode: standalone)").matches
      || (navigator as unknown as { standalone?: boolean }).standalone === true;
  } catch { return false; }
}

/**
 * Abre una página del propio ERP que en el navegador va en pestaña aparte (una hoja para imprimir).
 * Instalada no hay pestañas: iOS la sacaría a Safari, donde la persona no tiene sesión. Ahí se
 * abre en la misma ventana; todas esas páginas traen su «Volver».
 */
export function abrirPagina(ruta: string) {
  if (instalada()) window.location.assign(ruta);
  else window.open(ruta, "_blank", "noopener");
}

/** Para un <Link> o <a> a una página del ERP: pestaña nueva en el navegador, la misma ventana instalada. */
export const destinoPagina = () => (instalada() ? undefined : "_blank");

/**
 * Mientras esta pantalla está abierta, «Agregar a inicio» instala ESTA pantalla (la terminal)
 * con su nombre, en vez del ERP completo.
 */
export function useManifiesto(archivo: string) {
  useEffect(() => {
    const liga = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    const titulo = document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]');
    if (!liga) return;
    const antes = liga.href, tituloAntes = titulo?.content;
    liga.href = archivo;
    if (titulo && archivo.includes("terminal")) titulo.content = "Terminal";
    return () => { liga.href = antes; if (titulo && tituloAntes) titulo.content = tituloAntes; };
  }, [archivo]);
}

// ── Versión nueva ──────────────────────────────────────────────────────────────────────────────
// Una app instalada (y una tablet de piso) puede pasar días abierta. Tras publicar, sus pedazos de
// código ya no existen en el servidor: al cambiar de pantalla truena. Dos defensas: si un pedazo
// no carga, se recarga sola; y cada tanto pregunta si hay versión nueva.

let quiosco = false;
let avisado = false;

/**
 * La terminal y la pantalla del taller: nadie les va a dar clic a un aviso, así que cuando hay
 * versión nueva se actualizan solas. (Quien solo tiene la terminal la ve en cualquier ruta, por
 * eso lo dice la pantalla y no la dirección.)
 */
export function useQuiosco() {
  useEffect(() => { quiosco = true; return () => { quiosco = false; }; }, []);
}

/** Recarga sin dejar a nadie a medias: no mientras escribe o tiene un diálogo abierto. */
function recargarSiSePuede(): boolean {
  const a = document.activeElement;
  const escribiendo = !!a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.tagName === "SELECT" || (a as HTMLElement).isContentEditable);
  if (escribiendo || document.querySelector('[role="dialog"]')) return false;
  window.location.reload();
  return true;
}

async function revisarVersion() {
  if (avisado || document.visibilityState !== "visible") return;
  try {
    const r = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" });
    if (!r.ok) return;
    const { version } = (await r.json()) as { version?: string };
    if (!version || version === __VERSION__) return;
    if (quiosco) { recargarSiSePuede(); return; }
    avisado = true;
    toast("Hay una versión nueva del ERP", {
      description: "Actualiza para verla. No pierdes lo que ya guardaste.",
      duration: Infinity, action: { label: "Actualizar", onClick: () => window.location.reload() },
    });
  } catch { /* sin red o respuesta que no es la esperada: se vuelve a intentar después */ }
}

/** Se llama una vez al arrancar (main.tsx). En desarrollo no hace nada. */
export function vigilarVersion() {
  // Un pedazo de código que ya no existe (se publicó otra versión): recargar trae la nueva.
  // Con candado de un minuto para que un servidor caído no la deje recargando sin parar.
  window.addEventListener("vite:preloadError", (e) => {
    try {
      const ultima = Number(sessionStorage.getItem("recarga_por_version") ?? 0);
      if (Date.now() - ultima < 60_000) return;
      sessionStorage.setItem("recarga_por_version", String(Date.now()));
    } catch { /* sin almacenamiento: se recarga de todos modos */ }
    e.preventDefault();
    window.location.reload();
  });
  if (import.meta.env.DEV) return;
  document.addEventListener("visibilitychange", () => void revisarVersion());
  window.setInterval(() => void revisarVersion(), 10 * 60_000);
}

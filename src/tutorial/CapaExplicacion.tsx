import { useEffect, useRef, useState } from "react";
import { useTutorial } from "./preferencia";

/**
 * Explicación al pasar el mouse: con el modo tutorial encendido, cualquier elemento con
 * `data-explain` (y opcionalmente `data-explain-title`) se explica solo.
 *
 * Una sola capa para todo el ERP en vez de un tooltip por componente: los componentes solo
 * declaran el texto y esta capa decide cuándo y dónde mostrarlo. Así un indicador, la cabecera de
 * una tabla o una pestaña se explican igual, y apagar el modo apaga todo de una vez (sin la
 * preferencia ni escucha eventos). Es la misma capa que polyforecast, para que quien usa los dos
 * no aprenda dos modos tutorial.
 *
 * Teclado incluido: el foco muestra la explicación igual que el mouse y Escape la cierra. Gana el
 * elemento más interno (`closest`): una cabecera dentro de una tarjeta explica la cabecera.
 */

interface Burbuja { texto: string; titulo: string | null; rect: DOMRect; el: Element }

const RETRASO_MS = 220;
const ANCHO = 300;

function explicable(target: EventTarget | null): Element | null {
  return target instanceof Element ? target.closest("[data-explain]") : null;
}

export function CapaExplicacion() {
  const { activo } = useTutorial();
  const [burbuja, setBurbuja] = useState<Burbuja | null>(null);
  const temporizador = useRef<number | undefined>(undefined);
  const actual = useRef<Element | null>(null);

  useEffect(() => {
    if (!activo) { setBurbuja(null); return; }
    const mostrar = (el: Element) => {
      const texto = el.getAttribute("data-explain");
      if (!texto) return;
      actual.current = el;
      window.clearTimeout(temporizador.current);
      temporizador.current = window.setTimeout(() => {
        if (actual.current !== el) return;
        setBurbuja({ texto, titulo: el.getAttribute("data-explain-title"), rect: el.getBoundingClientRect(), el });
      }, RETRASO_MS);
    };
    const ocultar = () => {
      actual.current = null;
      window.clearTimeout(temporizador.current);
      setBurbuja(null);
    };
    const alEntrar = (e: Event) => {
      const el = explicable(e.target);
      if (el && el !== actual.current) mostrar(el);
      else if (!el && actual.current) ocultar();
    };
    const alSalir = (e: PointerEvent | FocusEvent) => { if (!explicable(e.relatedTarget)) ocultar(); };
    const alTecla = (e: KeyboardEvent) => { if (e.key === "Escape") ocultar(); };
    document.addEventListener("pointerover", alEntrar);
    document.addEventListener("pointerout", alSalir);
    document.addEventListener("focusin", alEntrar);
    document.addEventListener("focusout", alSalir);
    document.addEventListener("keydown", alTecla);
    // La página se desplaza dentro de <main>, no en window: en captura para enterarse igual.
    window.addEventListener("scroll", ocultar, true);
    return () => {
      window.clearTimeout(temporizador.current);
      document.removeEventListener("pointerover", alEntrar);
      document.removeEventListener("pointerout", alSalir);
      document.removeEventListener("focusin", alEntrar);
      document.removeEventListener("focusout", alSalir);
      document.removeEventListener("keydown", alTecla);
      window.removeEventListener("scroll", ocultar, true);
    };
  }, [activo]);

  // Mientras está abierta, el elemento apunta a la burbuja: un lector de pantalla la lee.
  useEffect(() => {
    if (!burbuja) return;
    const previo = burbuja.el.getAttribute("aria-describedby");
    burbuja.el.setAttribute("aria-describedby", "burbuja-explicacion");
    return () => {
      if (previo) burbuja.el.setAttribute("aria-describedby", previo);
      else burbuja.el.removeAttribute("aria-describedby");
    };
  }, [burbuja]);

  if (!burbuja) return null;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const ancho = Math.min(ANCHO, vw - 24);
  const izquierda = Math.min(Math.max(12, burbuja.rect.left), vw - ancho - 12);
  // Debajo si cabe; si no, encima. Nunca tapa lo que explica.
  const abajo = burbuja.rect.bottom + 150 < vh || burbuja.rect.top < 160;
  const estilo = abajo
    ? { left: izquierda, width: ancho, top: Math.min(burbuja.rect.bottom + 8, vh - 60) }
    : { left: izquierda, width: ancho, bottom: vh - burbuja.rect.top + 8 };
  return (
    <div id="burbuja-explicacion" role="tooltip" style={estilo} data-testid="burbuja-explicacion"
         className="no-imprimir burbuja-explicacion">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-info">¿Qué es?</span>
      {burbuja.titulo && <strong className="font-medium text-texto">{burbuja.titulo}</strong>}
      <span>{burbuja.texto}</span>
    </div>
  );
}

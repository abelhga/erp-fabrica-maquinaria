import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { matchPath, useLocation, useNavigate } from "react-router-dom";
import { CheckCircle2, MousePointerClick, PartyPopper, X } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { cn } from "@/lib/utilidades";
import { RECORRIDOS, type Objetivo, type Recorrido } from "./catalogo";

/**
 * Motor de los recorridos: ilumina la cosa real en la pantalla real, oscurece lo demás y espera a
 * que la persona haga lo que dice el paso. Vive fuera de React Query y de la base: el avance es de
 * quien aprende y se guarda en su navegador, como el modo tutorial.
 */

// ------------------------------------------------------------------ estado (un solo recorrido a la vez)
interface Estado { recorrido: Recorrido | null; paso: number; terminado: string | null }
let estado: Estado = { recorrido: null, paso: 0, terminado: null };
const oyentes = new Set<() => void>();
const cambiar = (e: Partial<Estado>) => { estado = { ...estado, ...e }; oyentes.forEach((f) => f()); };
const suscribir = (f: () => void) => { oyentes.add(f); return () => oyentes.delete(f); };
export const useRecorrido = () => useSyncExternalStore(suscribir, () => estado);

const HECHOS = "recorridos_hechos";
export function recorridosHechos(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(HECHOS) ?? "{}"); } catch { return {}; }
}
function marcarHecho(id: string) {
  try { localStorage.setItem(HECHOS, JSON.stringify({ ...recorridosHechos(), [id]: new Date().toISOString() })); } catch { /* modo privado */ }
}
export const empezarRecorrido = (id: string) => {
  const r = RECORRIDOS.find((x) => x.id === id);
  if (r) cambiar({ recorrido: r, paso: 0, terminado: null });
};
const salir = () => cambiar({ recorrido: null, paso: 0 });

// ------------------------------------------------------------------ buscar lo que se ilumina
const sinAcentos = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const CANDIDATOS = "button, a, [role=tab], input, textarea, label, h1, h2, h3, th, [data-explain]";

function visible(el: Element) {
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return false;
  const s = getComputedStyle(el);
  return s.visibility !== "hidden" && s.display !== "none" && Number(s.opacity) > 0.05;
}

/** El elemento del paso: por selector, o el más chico visible cuyo texto (o placeholder / etiqueta) contiene lo pedido. */
function buscar(o: Objetivo): HTMLElement | null {
  const capa = document.getElementById("capa-recorrido");
  const lista = Array.from(document.querySelectorAll<HTMLElement>(o.css ?? CANDIDATOS))
    .filter((el) => !capa?.contains(el) && visible(el));
  if (!o.texto) return lista[0] ?? null;
  const buscado = sinAcentos(o.texto);
  const texto = (el: HTMLElement) => sinAcentos(el.innerText || el.getAttribute("placeholder") || el.getAttribute("aria-label") || "");
  const hallados = lista.filter((el) => texto(el).includes(buscado));
  return hallados.sort((a, b) => texto(a).length - texto(b).length)[0] ?? null;
}

// ------------------------------------------------------------------ la capa
const MARGEN = 6;

export function MotorRecorridos() {
  const { recorrido, paso, terminado } = useRecorrido();
  const ir = useNavigate();
  const { pathname } = useLocation();
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [perdido, setPerdido] = useState(false);
  const objetivoRef = useRef<HTMLElement | null>(null);
  const p = recorrido?.pasos[paso];

  const avanzar = useCallback(() => {
    if (!recorrido) return;
    if (paso + 1 >= recorrido.pasos.length) {
      marcarHecho(recorrido.id);
      cambiar({ recorrido: null, paso: 0, terminado: recorrido.titulo });
    } else cambiar({ paso: paso + 1 });
  }, [recorrido, paso]);

  // Llevar a la pantalla del paso.
  useEffect(() => {
    if (p?.ruta && !matchPath(p.ruta, pathname)) ir(p.ruta);
  }, [p, pathname, ir]);

  // Encontrar lo que se ilumina y seguirlo (la pantalla carga, se desplaza o cambia de tamaño).
  useLayoutEffect(() => {
    setRect(null); setPerdido(false); objetivoRef.current = null;
    if (!p?.objetivo) return;
    let intentos = 0;
    let desplazado = false;
    const t = window.setInterval(() => {
      const el = buscar(p.objetivo!);
      if (el) {
        if (!desplazado) { el.scrollIntoView({ block: "center", behavior: "smooth" }); desplazado = true; }
        objetivoRef.current = el;
        setRect(el.getBoundingClientRect());
        setPerdido(false);
      } else if (++intentos > 25) setPerdido(true);   // ~5 s sin aparecer: se dice, no se cuelga
    }, 200);
    return () => window.clearInterval(t);
  }, [p]);

  // Avanzar solo cuando la persona hace lo que pide el paso.
  useEffect(() => {
    if (!p) return;
    if (p.avanza === "ruta" && p.rutaEsperada && matchPath(p.rutaEsperada, pathname)) { avanzar(); return; }
    if (p.avanza === "clic") {
      const alClic = (e: MouseEvent) => {
        if (objetivoRef.current && e.target instanceof Node && objetivoRef.current.contains(e.target)) window.setTimeout(avanzar, 250);
      };
      document.addEventListener("click", alClic, true);
      return () => document.removeEventListener("click", alClic, true);
    }
    if (p.avanza === "escribir") {
      let t: number | undefined;
      const alEscribir = (e: Event) => {
        const el = e.target as HTMLInputElement;
        if (objetivoRef.current?.contains(el) && (el.value ?? "").trim().length >= 2) { window.clearTimeout(t); t = window.setTimeout(avanzar, 700); }
      };
      document.addEventListener("input", alEscribir, true);
      return () => { document.removeEventListener("input", alEscribir, true); window.clearTimeout(t); };
    }
  }, [p, pathname, avanzar]);

  useEffect(() => {
    if (!recorrido) return;
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") salir(); };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [recorrido]);

  if (terminado) return <Festejo titulo={terminado} alCerrar={() => cambiar({ terminado: null })} />;
  if (!recorrido || !p) return null;

  const hueco = rect && { top: rect.top - MARGEN, left: rect.left - MARGEN, width: rect.width + 2 * MARGEN, height: rect.height + 2 * MARGEN };
  const vw = window.innerWidth, vh = window.innerHeight;
  const movil = vw < 640;
  const ancho = Math.min(360, vw - 24);
  // La tarjeta va debajo de lo iluminado si cabe; si no, arriba; sin objetivo, al centro. En el celular, abajo de la pantalla.
  const posicion: React.CSSProperties = movil || !hueco
    ? (hueco ? { left: 12, right: 12, bottom: 12 } : { left: "50%", top: "50%", transform: "translate(-50%, -50%)", width: ancho })
    : hueco.top + hueco.height + 230 < vh
      ? { top: hueco.top + hueco.height + 12, left: Math.min(Math.max(12, hueco.left), vw - ancho - 12), width: ancho }
      : { bottom: vh - hueco.top + 12, left: Math.min(Math.max(12, hueco.left), vw - ancho - 12), width: ancho };

  return (
    <div id="capa-recorrido" className="no-imprimir pointer-events-none fixed inset-0 z-[60]" role="dialog" aria-label={`Recorrido: ${recorrido.titulo}`}>
      {/* Lo oscuro detiene los clics fuera de lo iluminado; el hueco deja tocar la cosa de verdad. */}
      {hueco ? (
        <>
          <div className="pointer-events-auto absolute left-0 right-0 top-0 bg-black/55" style={{ height: Math.max(0, hueco.top) }} />
          <div className="pointer-events-auto absolute left-0 right-0 bottom-0 bg-black/55" style={{ top: hueco.top + hueco.height }} />
          <div className="pointer-events-auto absolute left-0 bg-black/55" style={{ top: hueco.top, height: hueco.height, width: Math.max(0, hueco.left) }} />
          <div className="pointer-events-auto absolute right-0 bg-black/55" style={{ top: hueco.top, height: hueco.height, left: hueco.left + hueco.width }} />
          <div className="pointer-events-none absolute rounded-lg ring-2 ring-info ring-offset-2 ring-offset-transparent animate-pulse"
               style={{ ...hueco, transition: "all 200ms ease" }} />
        </>
      ) : <div className="pointer-events-auto absolute inset-0 bg-black/55" />}

      <div className="tarjeta pointer-events-auto absolute space-y-3 p-4 shadow-2xl" style={posicion}>
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-info">{recorrido.titulo} · {paso + 1} de {recorrido.pasos.length}</p>
            <p className="font-semibold">{p.titulo}</p>
          </div>
          <button type="button" onClick={salir} className="rounded-md p-1 text-tenue hover:bg-fondo" aria-label="Salir del recorrido" title="Salir (Esc)"><X className="h-4 w-4" /></button>
        </div>
        <p className="text-sm">{p.texto}</p>
        {perdido && p.objetivo && (
          <p className="rounded-lg bg-aviso-suave px-3 py-2 text-xs">No lo encuentro en esta pantalla (puede que tu puesto no lo vea o que la pantalla cambió). Puedes seguir con el siguiente paso.</p>
        )}
        {/* Barra de avance por pasos. */}
        <div className="flex gap-1" aria-hidden="true">
          {recorrido.pasos.map((_, i) => <span key={i} className={cn("h-1 flex-1 rounded-full", i <= paso ? "bg-info" : "bg-borde")} />)}
        </div>
        <div className="flex items-center justify-between gap-2">
          <Boton tamano="sm" variante="fantasma" onClick={() => cambiar({ paso: Math.max(0, paso - 1) })} disabled={paso === 0}>Atrás</Boton>
          {p.avanza && !perdido ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-tenue"><MousePointerClick className="h-4 w-4 text-info" />
              {p.avanza === "clic" ? "Tócalo para seguir" : p.avanza === "escribir" ? "Escribe algo para seguir" : "Ve ahí para seguir"}</span>
          ) : (
            <Boton tamano="sm" onClick={avanzar}>{paso + 1 === recorrido.pasos.length ? "Terminar" : "Siguiente"}</Boton>
          )}
        </div>
      </div>
    </div>
  );
}

function Festejo({ titulo, alCerrar }: { titulo: string; alCerrar: () => void }) {
  useEffect(() => { const t = window.setTimeout(alCerrar, 4500); return () => window.clearTimeout(t); }, [alCerrar]);
  return (
    <div className="no-imprimir fixed bottom-24 left-1/2 z-[60] -translate-x-1/2 tarjeta flex items-center gap-3 px-5 py-4 shadow-2xl animate-[entrar-explicacion_200ms_ease-out]" role="status">
      <PartyPopper className="h-6 w-6 text-aviso" />
      <div><p className="font-semibold">¡Listo! Terminaste «{titulo}»</p>
        <p className="text-sm text-tenue inline-flex items-center gap-1"><CheckCircle2 className="h-4 w-4 text-ok" />Los demás recorridos de tu puesto están en el birrete.</p></div>
    </div>
  );
}

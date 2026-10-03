// El asistente en todas las pantallas: botón flotante o Ctrl+J. Sabe en qué pantalla
// estás y lee el ERP con tus permisos (la función corre con tu sesión, no con una
// llave maestra). Solo lee; si le pides algo, te dice dónde hacerlo.
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { ArrowUp, Loader2, RotateCcw, Sparkles, Square, X } from "lucide-react";
import { conversar, type MensajeChat } from "@/lib/asistente";
import { useSesion, type Modulo } from "@/lib/sesion";
import { cn } from "@/lib/utilidades";
import { Markdown } from "./Markdown";

interface Turno extends MensajeChat { pasos?: string[]; error?: string; enCurso?: boolean }

// Lo que conviene preguntar depende de dónde estás.
function sugerencias(ruta: string, p: (m: Modulo, n?: number) => boolean): string[] {
  if (ruta.startsWith("/ventas") && p("ventas")) return [
    "¿A quién le llamo hoy y qué le digo?",
    "¿Cuánto me falta para la siguiente meta de comisión?",
    "¿Qué clientes compraban seguido y ya no?",
    "Escríbele un WhatsApp al cliente con la cotización más grande por vencer",
  ];
  if ((ruta.startsWith("/almacen") || ruta.startsWith("/compras")) && p("inventario")) return [
    "¿Qué importados se nos van a acabar antes de que llegue el pedido?",
    "¿Qué excedentes valen más y no se mueven?",
    "¿Qué hay que pedir esta semana y a qué proveedor?",
  ];
  if (ruta.startsWith("/produccion") && p("produccion")) return [
    "¿Qué órdenes están en riesgo de entregarse tarde y por qué?",
    "¿Cuál es el cuello de botella del taller?",
    "¿Qué órdenes están paradas por material?",
  ];
  if (ruta.startsWith("/finanzas") && p("finanzas")) return [
    "¿A quién cobrarle primero esta semana?",
    "¿Cuánto entra y cuánto sale en las próximas 4 semanas?",
  ];
  return [
    "¿Cómo vamos este año contra el anterior?",
    "¿Qué es lo más urgente hoy?",
    p("ventas") ? "¿Quiénes son los 10 mejores clientes de 2025 y cuáles no han comprado en 2026?" : "¿Qué pendientes tengo en mi área?",
    p("costos") ? "¿Qué componentes subieron más este mes y a qué equipos les pega?" : "¿Qué órdenes del taller van atrasadas?",
  ];
}

const CLAVE = "asistente-conversacion";

export function Asistente() {
  const { pathname } = useLocation();
  const { puede, perfil } = useSesion();
  const [abierto, setAbierto] = useState(false);
  const [turnos, setTurnos] = useState<Turno[]>(() => {
    try { return JSON.parse(sessionStorage.getItem(CLAVE) ?? "[]"); } catch { return []; }
  });
  const [texto, setTexto] = useState("");
  const corte = useRef<AbortController | null>(null);
  const lista = useRef<HTMLDivElement>(null);
  const caja = useRef<HTMLTextAreaElement>(null);
  const enCurso = turnos.some((t) => t.enCurso);

  useEffect(() => {
    const atajo = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") { e.preventDefault(); setAbierto((a) => !a); }
      if (e.key === "Escape") setAbierto(false);
    };
    window.addEventListener("keydown", atajo);
    return () => window.removeEventListener("keydown", atajo);
  }, []);
  useEffect(() => { if (abierto) setTimeout(() => caja.current?.focus(), 50); }, [abierto]);
  useEffect(() => {
    try { sessionStorage.setItem(CLAVE, JSON.stringify(turnos.filter((t) => !t.enCurso).slice(-30))); } catch { /* modo privado */ }
    lista.current?.scrollTo({ top: lista.current.scrollHeight, behavior: "smooth" });
  }, [turnos]);

  async function enviar(pregunta: string) {
    const limpia = pregunta.trim();
    if (!limpia || enCurso) return;
    setTexto("");
    const historia: MensajeChat[] = [...turnos.filter((t) => !t.error).map(({ rol, texto }) => ({ rol, texto })), { rol: "usuario", texto: limpia }];
    setTurnos((ts) => [...ts, { rol: "usuario", texto: limpia }, { rol: "asistente", texto: "", pasos: [], enCurso: true }]);
    const actualizar = (f: (t: Turno) => Turno) => setTurnos((ts) => ts.map((t, i) => (i === ts.length - 1 ? f(t) : t)));
    corte.current = new AbortController();
    try {
      await conversar(historia, pathname, (e) => {
        if (e.tipo === "texto") actualizar((t) => ({ ...t, texto: t.texto + e.texto }));
        else if (e.tipo === "herramienta") actualizar((t) => ({ ...t, pasos: [...(t.pasos ?? []), e.etiqueta] }));
        else if (e.tipo === "error") actualizar((t) => ({ ...t, error: e.mensaje }));
      }, corte.current.signal);
    } catch (e) {
      if ((e as Error).name !== "AbortError") actualizar((t) => ({ ...t, error: (e as Error).message }));
    } finally {
      actualizar((t) => ({ ...t, enCurso: false, texto: t.texto || (t.error ? "" : "_(Sin respuesta)_") }));
      corte.current = null;
    }
  }

  if (!puede("asistente")) return null;

  return (
    <>
      <button onClick={() => setAbierto(true)} aria-label="Abrir asistente (Ctrl+J)" title="Asistente · Ctrl+J"
        className={cn("no-imprimir fixed bottom-5 right-5 z-40 h-12 px-3.5 lg:pr-4 rounded-full shadow-lg flex items-center gap-2",
          "bg-gradient-to-br from-marca to-marca/70 text-white text-sm font-medium hover:shadow-xl hover:-translate-y-0.5 transition",
          abierto && "opacity-0 pointer-events-none")}>
        {/* Solo ícono hasta escritorio: con texto medía ~190 px y en tableta tapaba la barra de acciones del cotizador. */}
        <Sparkles className="h-5 w-5" /><span className="hidden lg:inline">Pregúntale al ERP</span>
      </button>

      {abierto && <div className="fixed inset-0 z-40 bg-texto/10 backdrop-blur-[1px] lg:hidden" onClick={() => setAbierto(false)} />}
      <aside aria-hidden={!abierto}
        className={cn("no-imprimir fixed z-50 inset-y-0 right-0 w-full sm:w-[440px] bg-superficie border-l border-borde shadow-2xl flex flex-col",
          "transition-transform duration-300 ease-out", abierto ? "translate-x-0" : "translate-x-full")}>
        <header className="h-16 shrink-0 px-4 flex items-center gap-3 border-b border-borde">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-marca to-marca/60 grid place-items-center text-white"><Sparkles className="h-[18px] w-[18px]" /></div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold leading-tight">Asistente</p>
            <p className="text-xs text-tenue truncate">Lee el ERP con tus permisos · solo consulta</p>
          </div>
          {turnos.length > 0 && (
            <button onClick={() => { corte.current?.abort(); setTurnos([]); }} title="Conversación nueva"
              className="h-8 w-8 grid place-items-center rounded-lg hover:bg-fondo text-tenue"><RotateCcw className="h-4 w-4" /></button>
          )}
          <button onClick={() => setAbierto(false)} title="Cerrar (Esc)" className="h-8 w-8 grid place-items-center rounded-lg hover:bg-fondo text-tenue"><X className="h-4 w-4" /></button>
        </header>

        <div ref={lista} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {turnos.length === 0 && (
            <div className="animate-entrar">
              <p className="text-lg font-semibold">Hola{perfil?.nombre ? `, ${perfil.nombre.split(" ")[0]}` : ""}.</p>
              <p className="text-sm text-tenue mt-1">
                Pregúntame lo que necesites saber del negocio. Consulto ventas, clientes, taller, almacén y cobranza en vivo,
                y te digo qué conviene hacer.
              </p>
              <div className="mt-4 space-y-2">
                {sugerencias(pathname, puede).map((s, i) => (
                  <button key={s} onClick={() => enviar(s)} style={{ animationDelay: `${80 + i * 50}ms` }}
                    className="animate-entrar w-full text-left text-sm rounded-xl border border-borde px-3.5 py-2.5 hover:border-marca/50 hover:bg-marca-suave/40 transition">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {turnos.map((t, i) => t.rol === "usuario" ? (
            <div key={i} className="flex justify-end animate-entrar">
              <p className="max-w-[85%] rounded-2xl rounded-br-md bg-marca text-white px-3.5 py-2 text-sm whitespace-pre-wrap">{t.texto}</p>
            </div>
          ) : (
            <div key={i} className="animate-entrar">
              {(t.pasos?.length ?? 0) > 0 && (
                <div className="mb-1.5 flex flex-wrap gap-1.5">
                  {t.pasos!.map((p, j) => (
                    <span key={j} className="inline-flex items-center gap-1.5 text-[11px] text-tenue bg-fondo rounded-full px-2 py-0.5">
                      {t.enCurso && j === t.pasos!.length - 1 && !t.texto.endsWith(" ") ? <Loader2 className="h-3 w-3 animate-spin" /> : <span className="h-1.5 w-1.5 rounded-full bg-ok" />}
                      {p}
                    </span>
                  ))}
                </div>
              )}
              {t.texto && <Markdown texto={t.texto} />}
              {t.enCurso && !t.texto && (t.pasos?.length ?? 0) === 0 && (
                <span className="inline-flex gap-1 py-2" aria-label="Pensando">
                  {[0, 1, 2].map((k) => <span key={k} className="h-1.5 w-1.5 rounded-full bg-tenue/60 animate-bounce" style={{ animationDelay: `${k * 120}ms` }} />)}
                </span>
              )}
              {t.error && <p className="mt-1 text-sm rounded-lg bg-peligro-suave text-peligro px-3 py-2">{t.error}</p>}
            </div>
          ))}
        </div>

        <form onSubmit={(e) => { e.preventDefault(); enviar(texto); }} className="shrink-0 p-3 border-t border-borde">
          <div className="flex items-end gap-2 rounded-2xl border border-borde bg-fondo/50 focus-within:ring-2 focus-within:ring-marca/40 focus-within:border-marca px-3 py-2">
            <textarea ref={caja} value={texto} rows={1} placeholder="Pregunta algo del negocio…"
              onChange={(e) => { setTexto(e.target.value); e.target.style.height = "auto"; e.target.style.height = `${Math.min(160, e.target.scrollHeight)}px`; }}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(texto); } }}
              className="flex-1 resize-none bg-transparent text-sm py-1 focus:outline-none placeholder:text-tenue/70" />
            {enCurso ? (
              <button type="button" onClick={() => corte.current?.abort()} title="Detener"
                className="h-8 w-8 shrink-0 grid place-items-center rounded-full bg-texto text-superficie"><Square className="h-3.5 w-3.5" /></button>
            ) : (
              <button type="submit" disabled={!texto.trim()} title="Enviar (Enter)"
                className="h-8 w-8 shrink-0 grid place-items-center rounded-full bg-marca text-white disabled:opacity-40"><ArrowUp className="h-4 w-4" /></button>
            )}
          </div>
          <p className="mt-1.5 text-[11px] text-tenue text-center">Claude puede equivocarse: confirma las cifras importantes en su pantalla.</p>
        </form>
      </aside>
    </>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, PackageX, Pause, WifiOff } from "lucide-react";
import { Logo } from "@/components/layout/Logo";
import { supabase } from "@/lib/supabase";
import { q } from "@/lib/consultas";
import { cn } from "@/lib/utilidades";
import { CLAVE, useEtapas, useProduccionEnVivo, type Evento, type OperacionPiso, type OrdenTablero } from "./componentes/datos";
import { abreviarEquipo, folioCorto, haceRato, textoDias, textoEvento } from "./componentes/util";

// La TV se diseña a 1920×1080 y se escala a la pantalla que sea: así se ve
// igual en la tele del taller que en la laptop del gerente.
const ANCHO = 1920, ALTO = 1080;
// A 6 metros manda el tamaño de letra: 3 columnas de 2 tarjetas, y si hay más, se rota.
const POR_COLUMNA = 2, COLUMNAS = 3, ROTAR_MS = 15_000, REFRESCO_MS = 60_000;

interface Tarjeta { op: OperacionPiso; sigue: boolean }
interface Columna { etapa: string; color: string; parte: number; partes: number; total: number; tarjetas: Tarjeta[] }

function useEscala() {
  const [e, setE] = useState(1);
  useEffect(() => {
    const f = () => setE(Math.min(window.innerWidth / ANCHO, window.innerHeight / ALTO));
    f();
    window.addEventListener("resize", f);
    return () => window.removeEventListener("resize", f);
  }, []);
  return e;
}

/** Que la tele no se apague sola (donde el navegador lo permite). */
function useSinApagar() {
  useEffect(() => {
    let candado: { release: () => Promise<void> } | null = null;
    const pedir = async () => {
      try { candado = await (navigator as unknown as { wakeLock?: { request: (t: string) => Promise<typeof candado> } }).wakeLock?.request("screen") ?? null; }
      catch { /* sin permiso: no pasa nada */ }
    };
    pedir();
    const vis = () => { if (document.visibilityState === "visible") pedir(); };
    document.addEventListener("visibilitychange", vis);
    return () => { document.removeEventListener("visibilitychange", vis); candado?.release().catch(() => {}); };
  }, []);
}

function useEnLinea() {
  const [v, setV] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  useEffect(() => {
    const on = () => setV(true), off = () => setV(false);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  return v;
}

/**
 * Pantalla del taller: TV a 6 metros, sin teclado ni mouse. Siempre oscura,
 * letras enormes, una columna por etapa con lo que se trabaja y lo que sigue,
 * las atrasadas y las que esperan material, y lo último que pasó en el piso.
 * Nunca muestra dinero: el rol "pantalla" ni siquiera puede leer pedidos.
 */
export default function PantallaPiso() {
  useProduccionEnVivo();
  useSinApagar();
  const escala = useEscala();
  const enLinea = useEnLinea();
  const etapas = useEtapas();
  const piso = useQuery({
    queryKey: [...CLAVE, "piso", "tv"], refetchInterval: REFRESCO_MS,
    queryFn: () => q<OperacionPiso[]>(supabase.from("v_piso_operaciones").select("*")),
  });
  const tablero = useQuery({
    queryKey: [...CLAVE, "tablero", "tv"], refetchInterval: REFRESCO_MS,
    queryFn: () => q<OrdenTablero[]>(supabase.from("v_tablero_produccion")
      .select("id, folio, numero_serie, equipo, estado, atrasada, dias_restantes, materiales_faltantes, faltantes_sin_pedir, prioridad")),
  });
  const eventos = useQuery({
    queryKey: [...CLAVE, "eventos", "tv"], refetchInterval: REFRESCO_MS,
    queryFn: () => q<Evento[]>(supabase.from("v_op_eventos").select("*").order("en", { ascending: false }).order("id", { ascending: false }).limit(14)),
  });

  const [ahora, setAhora] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setAhora(Date.now()), 1000); return () => clearInterval(t); }, []);
  const sinConexion = !enLinea || piso.isError || tablero.isError;
  const ultima = Math.max(piso.dataUpdatedAt, tablero.dataUpdatedAt);

  // Columnas: una por etapa con trabajo; si no caben las tarjetas, la etapa se parte en varias columnas.
  const columnas = useMemo<Columna[]>(() => {
    const ops = piso.data ?? [];
    const orden = (a: OperacionPiso, b: OperacionPiso) => a.prioridad - b.prioridad || (a.dias_restantes ?? 9999) - (b.dias_restantes ?? 9999);
    const r: Columna[] = [];
    for (const e of etapas.data ?? []) {
      const de = ops.filter((o) => o.etapa_id === e.id);
      const tarjetas: Tarjeta[] = [
        ...de.filter((o) => o.estado !== "pendiente").sort((a, b) => Number(a.estado === "pausada") - Number(b.estado === "pausada") || orden(a, b)).map((op) => ({ op, sigue: false })),
        ...de.filter((o) => o.estado === "pendiente" && o.lista).sort(orden).map((op) => ({ op, sigue: true })),
      ];
      if (tarjetas.length === 0) continue;
      const partes = Math.ceil(tarjetas.length / POR_COLUMNA);
      for (let i = 0; i < partes; i++) {
        r.push({ etapa: e.nombre, color: e.color, parte: i + 1, partes, total: tarjetas.length, tarjetas: tarjetas.slice(i * POR_COLUMNA, (i + 1) * POR_COLUMNA) });
      }
    }
    return r;
  }, [piso.data, etapas.data]);
  const paginas = Math.max(1, Math.ceil(columnas.length / COLUMNAS));
  const [pagina, setPagina] = useState(0);
  useEffect(() => {
    if (paginas <= 1) { setPagina(0); return; }
    const t = setInterval(() => setPagina((p) => (p + 1) % paginas), ROTAR_MS);
    return () => clearInterval(t);
  }, [paginas]);
  const visibles = columnas.slice(pagina * COLUMNAS, pagina * COLUMNAS + COLUMNAS);

  const enTaller = (tablero.data ?? []).filter((o) => o.estado !== "terminada");
  const atrasadas = enTaller.filter((o) => o.atrasada).sort((a, b) => (a.dias_restantes ?? 0) - (b.dias_restantes ?? 0));
  const conFaltante = enTaller.filter((o) => o.materiales_faltantes > 0 && (o.estado === "liberada" || o.estado === "en_proceso"))
    .sort((a, b) => (a.dias_restantes ?? 9999) - (b.dias_restantes ?? 9999));

  const reloj = new Date(ahora);
  return (
    <div className="dark fixed inset-0 bg-fondo text-texto overflow-hidden select-none" style={{ cursor: "none" }}>
      <div className="absolute left-1/2 top-1/2 flex flex-col" style={{ width: ANCHO, height: ALTO, transform: `translate(-50%, -50%) scale(${escala})` }}>
        {/* Encabezado: logo, estado de la conexión, hora */}
        <header className="h-[120px] shrink-0 px-12 flex items-center gap-8 border-b-2 border-borde">
          <Logo className="[&_svg]:h-16 [&_svg]:w-16 [&_span]:text-[52px] [&_span]:tracking-[0.2em]" grande />
          {!sinConexion && <p className="text-[34px] text-tenue font-medium whitespace-nowrap">Producción en vivo</p>}
          <div className="ml-auto flex items-center gap-8">
            {sinConexion ? (
              <span className="flex items-center gap-3 rounded-2xl bg-peligro px-6 py-3 text-[32px] font-bold text-white whitespace-nowrap">
                <WifiOff className="h-10 w-10" />Sin conexión, reintentando…
                {ultima > 0 && <span className="font-medium opacity-90">datos de las {new Date(ultima).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false })}</span>}
              </span>
            ) : paginas > 1 && (
              <span className="flex items-center gap-3 text-[28px] text-tenue">
                {Array.from({ length: paginas }, (_, i) => (
                  <span key={i} className={cn("h-4 rounded-full transition-all", i === pagina ? "w-12 bg-marca" : "w-4 bg-borde")} />
                ))}
                <span className="cifra ml-2">{pagina + 1}/{paginas}</span>
              </span>
            )}
            <div className="text-right leading-none">
              <p className="text-[76px] font-bold cifra tracking-tight">{reloj.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false })}</p>
              <p className="text-[28px] text-tenue mt-2 first-letter:uppercase whitespace-nowrap">{reloj.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })}</p>
            </div>
          </div>
        </header>

        {/* Franja: lo que el piso tiene que ver primero */}
        <section className="h-[150px] shrink-0 px-12 py-5 grid grid-cols-2 gap-6">
          <Franja tono="peligro" icono={AlertTriangle} titulo="Atrasadas" lista={atrasadas}
                  vacio="Ninguna orden atrasada" detalle={(o) => textoDias(o.dias_restantes)} />
          <Franja tono="aviso" icono={PackageX} titulo="Con faltante de material" lista={conFaltante}
                  vacio="Todo el material completo" detalle={(o) => `${o.materiales_faltantes} material${o.materiales_faltantes === 1 ? "" : "es"}`} />
        </section>

        {/* Columnas por etapa */}
        <main className="flex-1 min-h-0 px-12 pb-5">
          {piso.isLoading ? null : columnas.length === 0 ? (
            <div className="h-full rounded-3xl border-2 border-dashed border-borde flex flex-col items-center justify-center gap-4 text-tenue">
              <CheckCircle2 className="h-24 w-24" />
              <p className="text-[48px] font-semibold text-texto">Sin órdenes en el taller</p>
              <p className="text-[32px]">Cuando la gerencia libere órdenes, aparecerán aquí.</p>
            </div>
          ) : (
            <div className="h-full grid gap-6" style={{ gridTemplateColumns: `repeat(${COLUMNAS}, minmax(0, 1fr))` }}>
              {visibles.map((c) => (
                <section key={`${c.etapa}-${c.parte}`} className="min-h-0 flex flex-col rounded-3xl bg-superficie border-2 border-borde overflow-hidden">
                  <header className="h-[84px] shrink-0 px-7 flex items-center gap-4" style={{ background: c.color }}>
                    <h2 className="text-[48px] font-extrabold text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.45)] truncate">{c.etapa}</h2>
                    <span className="ml-auto text-[36px] font-bold text-white/95 drop-shadow-[0_2px_2px_rgba(0,0,0,0.45)] cifra">
                      {c.partes > 1 ? `${c.parte}/${c.partes}` : c.total}
                    </span>
                  </header>
                  <div className="flex-1 min-h-0 p-4 grid gap-4" style={{ gridTemplateRows: `repeat(${POR_COLUMNA}, minmax(0, 1fr))` }}>
                    {c.tarjetas.map((t) => <TarjetaTV key={t.op.id} t={t} />)}
                  </div>
                </section>
              ))}
            </div>
          )}
        </main>

        {/* Lo último que pasó en el piso */}
        <Ticker eventos={eventos.data ?? []} ahora={Math.floor(ahora / 60_000) * 60_000} />
      </div>
    </div>
  );
}

function Franja({ tono, icono: I, titulo, lista, vacio, detalle }: {
  tono: "peligro" | "aviso"; icono: typeof AlertTriangle; titulo: string; lista: OrdenTablero[]; vacio: string; detalle: (o: OrdenTablero) => string;
}) {
  const hay = lista.length > 0;
  const color = !hay ? "text-ok" : tono === "peligro" ? "text-peligro" : "text-aviso";
  return (
    <div className={cn("rounded-3xl border-2 pl-6 pr-7 flex items-center gap-5 min-w-0",
      !hay ? "border-ok/40 bg-ok-suave" : tono === "peligro" ? "border-peligro bg-peligro-suave" : "border-aviso bg-aviso-suave")}>
      {hay ? <I className={cn("h-14 w-14 shrink-0", color)} /> : <CheckCircle2 className="h-14 w-14 shrink-0 text-ok" />}
      <p className={cn("text-[72px] font-extrabold leading-none cifra shrink-0", color)}>{lista.length}</p>
      <div className="min-w-0 flex-1">
        <p className={cn("text-[28px] font-bold uppercase tracking-wide leading-tight", color)}>{titulo}</p>
        {!hay ? <p className="text-[28px] text-tenue">{vacio}</p> : (
          <p className="text-[28px] leading-snug truncate">
            {lista.slice(0, 3).map((o, k) => (
              <span key={o.id}>{k > 0 && <span className="text-tenue"> · </span>}<b className="cifra">{folioCorto(o.folio)}</b> <span className="text-tenue">({detalle(o)})</span></span>
            ))}
            {lista.length > 3 && <span className="text-tenue"> y {lista.length - 3} más</span>}
          </p>
        )}
      </div>
    </div>
  );
}

function TarjetaTV({ t }: { t: Tarjeta }) {
  const o = t.op;
  const dias = o.dias_restantes;
  const tarde = dias != null && dias < 0, cerca = dias != null && dias >= 0 && dias <= 3;
  return (
    <article className={cn("min-h-0 rounded-2xl px-6 py-4 flex flex-col justify-between border-[3px] overflow-hidden",
      t.sigue ? "border-dashed border-borde bg-fondo/60" : o.estado === "pausada" ? "border-aviso bg-aviso-suave" : "border-borde bg-fondo",
      o.prioridad === 1 && !t.sigue && o.estado !== "pausada" && "border-peligro")}>
      <div className="flex items-center gap-4">
        <p className="text-[50px] font-extrabold leading-none cifra whitespace-nowrap shrink-0">{folioCorto(o.folio)}</p>
        <span className={cn("ml-auto rounded-xl px-3 py-1 text-[31px] font-bold whitespace-nowrap cifra shrink-0",
          tarde ? "bg-peligro text-white" : cerca ? "bg-aviso text-black" : "text-tenue")}>
          {textoDias(dias)}
        </span>
      </div>
      <p className="text-[38px] font-semibold leading-tight truncate">{abreviarEquipo(o.equipo)}</p>
      <p className="text-[30px] text-tenue truncate">{o.cliente ?? "Para stock"}</p>
      <div className="flex items-center gap-4">
        <div className="flex-1 h-6 rounded-full bg-borde overflow-hidden">
          <div className={cn("h-full rounded-full", o.avance >= 100 ? "bg-ok" : "bg-marca")} style={{ width: `${Math.max(0, Math.min(100, Number(o.avance)))}%` }} />
        </div>
        <span className="text-[34px] font-bold cifra w-[5.5rem] text-right">{o.avance}%</span>
      </div>
      <div className="flex items-center gap-3 min-w-0">
        {o.prioridad === 1 && <span className="shrink-0 rounded-lg bg-peligro px-3 py-0.5 text-[26px] font-extrabold text-white">URGENTE</span>}
        {o.estado === "pausada" && !t.sigue && <Pause className="h-8 w-8 shrink-0 text-aviso" />}
        <p className={cn("text-[30px] font-semibold truncate", t.sigue ? "text-tenue" : o.estado === "pausada" ? "text-aviso" : "text-marca-texto")}>
          {t.sigue ? "Sigue · lista para empezar"
            : o.estado === "pausada" ? `Pausada${o.ultimo_problema ? `: ${o.ultimo_problema}` : o.responsable ? ` · ${o.responsable}` : ""}`
            : `● ${o.responsable ?? "Trabajando"}`}
        </p>
      </div>
    </article>
  );
}

function Ticker({ eventos, ahora }: { eventos: Evento[]; ahora: number }) {
  const textos = eventos.map((e) => `${textoEvento(e)} · ${haceRato(e.en, ahora)}`);
  const linea = textos.join("     ●     ");
  // Velocidad constante sin importar cuánto texto haya (unos 120 px por segundo).
  const duracion = Math.max(30, Math.round(linea.length * 0.15));
  return (
    <footer className="h-[86px] shrink-0 border-t-2 border-borde bg-superficie flex items-center overflow-hidden">
      <span className="h-full shrink-0 px-8 flex items-center bg-marca text-white text-[28px] font-extrabold tracking-wide">ÚLTIMO</span>
      <div className="flex-1 overflow-hidden relative">
        {textos.length === 0 ? <p className="px-8 text-[30px] text-tenue">Sin movimientos todavía.</p> : (
          <div className="flex whitespace-nowrap text-[32px] font-medium" style={{ animation: `ticker-piso ${duracion}s linear infinite` }}>
            <span className="px-8">{linea}</span><span className="px-8" aria-hidden>{linea}</span>
          </div>
        )}
      </div>
      <style>{`@keyframes ticker-piso { from { transform: translateX(0); } to { transform: translateX(-50%); } }`}</style>
    </footer>
  );
}

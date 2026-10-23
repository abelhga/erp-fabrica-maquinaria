import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CalendarDays, CheckCircle2, HardHat, Moon, PackageX, Pause, WifiOff } from "lucide-react";
import { Logo } from "@/components/layout/Logo";
import { supabase } from "@/lib/supabase";
import { q } from "@/lib/consultas";
import { cn } from "@/lib/utilidades";
import { CLAVE, cuandoAbre, useEtapas, useHorarioAhora, useProduccionEnVivo, type Evento, type OperacionPiso, type OrdenTablero } from "./componentes/datos";
import { abreviarEquipo, folioTV, haceRato, textoDias, textoEvento, tintaSobre } from "./componentes/util";

// La TV se diseña a 1920×1080 y se escala a la pantalla que sea: así se ve
// igual en la tele del taller que en la laptop del gerente.
const ANCHO = 1920, ALTO = 1080;
// A 6 metros manda el tamaño de letra: 3 columnas de 2 tarjetas, y si hay más, se rota.
// 10 s por pantalla: con 15 s, en el piso se sentía que no cambiaba.
const POR_COLUMNA = 2, COLUMNAS = 3, ROTAR_MS = 10_000, REFRESCO_MS = 60_000;
// Después de las etapas, dos pantallas más: quién trabaja qué y lo que se entrega pronto.
const EXTRAS = ["cuadrillas", "entregas"] as const;
// La cinta de abajo, en px de la medida de diseño por segundo: un evento cruza la tele en unos 10 s.
const VELOCIDAD_CINTA = 180;

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
      .select("id, folio, numero_serie, equipo, estado, atrasada, dias_restantes, materiales_faltantes, faltantes_sin_pedir, prioridad, fecha_compromiso, avance, pedido_folio, cliente, para_stock, en_espera_motivo")),
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
  const paginasEtapas = Math.max(1, Math.ceil(columnas.length / COLUMNAS));
  const paginas = paginasEtapas + EXTRAS.length;
  const [pagina, setPagina] = useState(0);
  useEffect(() => {
    if (paginas <= 1) { setPagina(0); return; }
    const t = setInterval(() => setPagina((p) => (p + 1) % paginas), ROTAR_MS);
    return () => clearInterval(t);
  }, [paginas]);
  const visibles = columnas.slice(pagina * COLUMNAS, pagina * COLUMNAS + COLUMNAS);
  const extra = pagina >= paginasEtapas ? EXTRAS[pagina - paginasEtapas] : null;

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

        {/* Columnas por etapa (y, al final de la vuelta, cuadrillas y entregas) */}
        <main className="flex-1 min-h-0 px-12 pb-5">
          {extra === "cuadrillas" ? <PantallaCuadrillas ops={piso.data ?? []} etapas={etapas.data ?? []} ahora={ahora} />
          : extra === "entregas" ? <PantallaEntregas ordenes={enTaller} hoy={ahora} />
          : piso.isLoading ? null : columnas.length === 0 ? (
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
              <span key={o.id}>{k > 0 && <span className="text-tenue"> · </span>}<b>{abreviarEquipo(o.equipo)}</b> <span className="text-tenue">({detalle(o)})</span></span>
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
      {/* El taller reconoce el equipo por su nombre, no por el folio: el nombre va grande y arriba. */}
      <p className="text-[40px] font-extrabold leading-[1.1] line-clamp-2">{abreviarEquipo(o.equipo)}</p>
      <div className="flex items-center gap-3 min-w-0">
        <p className="text-[28px] text-tenue truncate min-w-0">
          <span className="cifra">{folioTV(o.folio)}</span>
          {o.pedido_folio ? <> · <b className="text-texto cifra">{folioTV(o.pedido_folio)}</b> · {o.cliente ?? "—"}</> : " · Para stock"}
        </p>
        <span className={cn("ml-auto rounded-xl px-3 py-0.5 text-[28px] font-bold whitespace-nowrap cifra shrink-0",
          tarde ? "bg-peligro text-white" : cerca ? "bg-aviso text-black" : "text-tenue")}>
          {textoDias(dias)}
        </span>
      </div>
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
            : o.estado === "pausada" ? `Pausada${o.ultimo_problema ? `: ${o.ultimo_problema}` : (o.cuadrilla ?? o.responsable) ? ` · ${o.cuadrilla ?? o.responsable}` : ""}`
            : `● ${o.cuadrilla ?? o.responsable ?? "Trabajando"}`}
        </p>
      </div>
    </article>
  );
}

function Ticker({ eventos, ahora }: { eventos: Evento[]; ahora: number }) {
  const textos = eventos.map((e) => `${textoEvento(e, true, abreviarEquipo(e.equipo))} · ${haceRato(e.en, ahora)}`);
  const linea = textos.join("     ●     ");
  // La duración sale del ancho medido, no de contar letras: los espacios del separador se
  // juntan en uno al dibujarse y el mínimo de 30 s frenaba la cinta cuando había poco texto.
  const copia = useRef<HTMLSpanElement>(null);
  const [ancho, setAncho] = useState(0);
  useLayoutEffect(() => { setAncho(copia.current?.offsetWidth ?? 0); }, [linea]);
  const duracion = Math.max(ancho / VELOCIDAD_CINTA, 6);
  return (
    <footer className="h-[86px] shrink-0 border-t-2 border-borde bg-superficie flex items-center overflow-hidden">
      <span className="h-full shrink-0 px-8 flex items-center bg-marca text-white text-[28px] font-extrabold tracking-wide">ÚLTIMO</span>
      <div className="flex-1 overflow-hidden relative">
        {textos.length === 0 ? <p className="px-8 text-[30px] text-tenue">Sin movimientos todavía.</p> : (
          // w-max: sin él, la cinta medía lo de la pantalla y no lo del texto, así que el -50 % de la
          // animación recorría media pantalla en minutos (unos 7 px/s) y nunca llegaba a los últimos.
          <div className="flex w-max whitespace-nowrap text-[32px] font-medium" style={{ animation: `ticker-piso ${duracion}s linear infinite` }}>
            <span ref={copia} className="px-8">{linea}</span><span className="px-8" aria-hidden>{linea}</span>
          </div>
        )}
      </div>
      <style>{`@keyframes ticker-piso { from { transform: translateX(0); } to { transform: translateX(-50%); } }`}</style>
    </footer>
  );
}

const CUARTOS: [number, string][] = [[0.25, "¼"], [0.5, "½"], [0.75, "¾"], [0.9, "casi"]];
const enCuartos = (a: number | null) =>
  a == null ? null : CUARTOS.reduce((m, c) => (Math.abs(c[0] - a) < Math.abs(m[0] - a) ? c : m))[1];

/** «Juan y Ramiro», «Leonardo e Isaías», «Juan, 2 sin nombre»: una persona por círculo. */
const integrantes = (quien: string) => quien.split(/, | y | e /).filter(Boolean);
const inicial = (n: string) => (/^\d+ sin nombre$/.test(n) ? `+${n.split(" ")[0]}` : n.slice(0, 1).toUpperCase());

/** El avance en cuartos, como lo marca el piso: cuatro bloques que se llenan (¼, ½, ¾, casi). */
function Cuartos({ avance, color, grande }: { avance: number | null; color: string; grande: boolean }) {
  return (
    <div className={cn("flex", grande ? "flex-col gap-2" : "items-center gap-3")}>
      <div className={cn("flex gap-1.5", grande && "gap-2.5")} aria-hidden>
        {[0, 1, 2, 3].map((k) => {
          const lleno = Math.max(0, Math.min(1, (avance ?? 0) * 4 - k));
          return (
            <span key={k} className={cn("relative overflow-hidden rounded-md bg-borde", grande ? "h-16 flex-1 rounded-xl" : "h-7 w-14")}>
              <span className="absolute inset-y-0 left-0" style={{ width: `${lleno * 100}%`, background: color }} />
            </span>
          );
        })}
      </div>
      <span className={cn("font-semibold", grande ? "text-[32px]" : "text-[26px]", avance == null && "text-tenue")}>
        {avance == null ? "sin avance reportado" : `va a ${enCuartos(avance)}`}
      </span>
    </div>
  );
}

/**
 * Quién trabaja qué ahorita: una tarjeta por cuadrilla, como el pizarrón de Luis. Desde lejos se
 * reconoce por las caras (círculos con la inicial, del color de su etapa), el equipo y cuánto va.
 */
function PantallaCuadrillas({ ops, etapas, ahora }: { ops: OperacionPiso[]; etapas: { id: number; orden: number }[]; ahora: number }) {
  const ordenEtapa = new Map(etapas.map((e) => [e.id, e.orden]));
  const horario = useHorarioAhora().data;
  const fuera = !!horario && !horario.en_horario;
  const activas = ops.filter((o) => o.estado === "en_proceso" || o.estado === "pausada");
  const grupos = new Map<string, OperacionPiso[]>();
  for (const o of activas) {
    const k = o.cuadrilla ?? "Sin cuadrilla anotada";
    grupos.set(k, [...(grupos.get(k) ?? []), o]);
  }
  const lista = [...grupos.entries()]
    .map(([quien, trabajos]) => ({ quien, trabajos: trabajos.sort((a, b) => Number(a.estado === "pausada") - Number(b.estado === "pausada")) }))
    .sort((a, b) => (ordenEtapa.get(a.trabajos[0].etapa_id) ?? 99) - (ordenEtapa.get(b.trabajos[0].etapa_id) ?? 99) || a.quien.localeCompare(b.quien, "es"))
    .slice(0, 12);
  // Pocas cuadrillas, tarjetas grandes: con tres no se queda media TV vacía.
  const n = lista.length;
  const rejilla = n <= 3 ? "grid-cols-3 grid-rows-1" : n <= 6 ? "grid-cols-3 grid-rows-2" : n <= 8 ? "grid-cols-4 grid-rows-2" : "grid-cols-4 grid-rows-3";
  const grande = n <= 3;
  // Con 9 a 12 cuadrillas cada tarjeta mide ~200 px: va lo esencial (quién, qué, cuánto va, la fecha).
  const chico = n > 8;
  return (
    <div className="h-full flex flex-col gap-4">
      <h2 className="flex items-center gap-4 text-[44px] font-extrabold"><HardHat className="h-12 w-12 text-marca" />Cuadrillas ahora
        <span className="text-[30px] font-semibold text-tenue">{n} {n === 1 ? "cuadrilla" : "cuadrillas"}</span>
        {/* De noche lo que quedó iniciado no se está trabajando: que la TV no lo presuma. */}
        {fuera && (
          <span className="ml-auto flex items-center gap-3 text-[30px] font-semibold text-tenue"><Moon className="h-9 w-9" />
            Fuera de horario{horario?.modo === "horario" && horario.abre ? ` · sigue ${cuandoAbre(horario.abre)}` : ""}</span>
        )}
      </h2>
      {n === 0 ? (
        <p className="flex-1 rounded-3xl border-2 border-dashed border-borde grid place-items-center text-[40px] text-tenue">Nadie trabajando en este momento</p>
      ) : (
        <div className={cn("flex-1 min-h-0 grid gap-4", rejilla)}>
          {lista.map(({ quien, trabajos }) => {
            const o = trabajos[0];
            const pausada = o.estado === "pausada";
            const gente = o.cuadrilla ? integrantes(o.cuadrilla) : [];
            const dias = o.dias_restantes;
            const tarde = dias != null && dias < 0, cerca = dias != null && dias >= 0 && dias <= 3;
            return (
              <article key={quien} className={cn("min-h-0 overflow-hidden rounded-2xl border-[3px] bg-superficie flex flex-col",
                pausada ? "border-aviso" : o.prioridad === 1 ? "border-peligro" : "border-borde", fuera && "opacity-75")}>
                {/* La franja de la etapa: el color que el taller ya conoce de las columnas. */}
                <div className="flex items-center gap-3 px-5 py-2" style={{ background: o.color, color: tintaSobre(o.color) }}>
                  <span className="text-[26px] font-extrabold uppercase tracking-wide truncate">{o.etapa}</span>
                  {pausada && <span className="ml-auto flex items-center gap-1.5 rounded-lg bg-black/40 px-2.5 py-0.5 text-[22px] font-bold text-white"><Pause className="h-6 w-6" />PAUSADA</span>}
                  {!pausada && o.prioridad === 1 && <span className="ml-auto rounded-lg bg-black/40 px-2.5 py-0.5 text-[22px] font-extrabold text-white">URGENTE</span>}
                </div>
                <div className={cn("flex-1 min-h-0 flex flex-col px-5 py-3", grande ? "gap-4" : "gap-2")}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex -space-x-3 shrink-0" aria-hidden>
                      {gente.slice(0, 4).map((p) => (
                        <span key={p} className={cn("grid place-items-center rounded-full font-extrabold ring-4 ring-superficie",
                          grande ? "h-20 w-20 text-[38px]" : chico ? "h-11 w-11 text-[22px]" : "h-14 w-14 text-[26px]")}
                          style={{ background: o.color, color: tintaSobre(o.color) }}>{inicial(p)}</span>
                      ))}
                      {gente.length === 0 && <span className={cn("grid place-items-center rounded-full bg-borde text-tenue", grande ? "h-20 w-20" : chico ? "h-11 w-11" : "h-14 w-14")}><HardHat className="h-7 w-7" /></span>}
                    </div>
                    <p className={cn("font-extrabold leading-tight min-w-0", grande ? "text-[40px] line-clamp-2" : chico ? "text-[26px] truncate" : "text-[30px] truncate")}>{quien}</p>
                  </div>
                  <div className="min-w-0">
                    <p className={cn("font-bold leading-tight", grande ? "text-[36px] line-clamp-2" : chico ? "text-[24px] truncate" : "text-[28px] truncate")}>{abreviarEquipo(o.equipo)}</p>
                    <p className={cn("text-[24px] text-tenue truncate", chico && "hidden")}>
                      <span className="cifra">{folioTV(o.folio)}</span>
                      {o.pedido_folio ? <> · <span className="cifra text-texto">{folioTV(o.pedido_folio)}</span>{o.cliente ? ` · ${o.cliente}` : ""}</> : " · Para stock"}
                    </p>
                  </div>
                  <Cuartos avance={o.avance_etapa} color={o.color} grande={grande} />
                  <div className={cn("mt-auto flex items-center gap-3 text-tenue min-w-0", chico ? "text-[20px]" : "text-[24px]")}>
                    {pausada && o.ultimo_problema ? <span className="text-aviso truncate">{o.ultimo_problema}</span>
                      : o.inicio && <span className="truncate">empezó {haceRato(o.inicio, ahora)}</span>}
                    <span className={cn("ml-auto rounded-lg px-2.5 py-0.5 font-bold whitespace-nowrap cifra shrink-0",
                      tarde ? "bg-peligro text-white" : cerca ? "bg-aviso text-black" : "")}>{textoDias(dias)}</span>
                  </div>
                  {trabajos.length > 1 && !chico && (
                    <p className="text-[22px] text-tenue truncate">También: {trabajos.slice(1).map((x) => `${abreviarEquipo(x.equipo)} (${x.etapa}${x.estado === "pausada" ? ", pausada" : ""})`).join(" · ")}</p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Lo que tiene que estar listo en las próximas dos semanas, día por día (lunes a viernes). */
function PantallaEntregas({ ordenes, hoy }: { ordenes: OrdenTablero[]; hoy: number }) {
  const dia = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
  const hoyIso = dia(new Date(hoy));
  const base = new Date(hoyIso + "T12:00:00-06:00");
  base.setDate(base.getDate() - ((base.getDay() + 6) % 7));
  const dias: string[] = [];
  let limite = "";
  for (let i = 0; i < 14; i++) {
    const d = new Date(base); d.setDate(base.getDate() + i);
    if (d.getDay() !== 0 && d.getDay() !== 6) dias.push(dia(d));
    limite = dia(d);
  }
  // Lo de fin de semana se pinta el viernes anterior (la entrega se prepara antes).
  const casilla = (f: string) => dias.filter((d) => d <= f).pop() ?? null;
  const porDia = new Map<string, OrdenTablero[]>();
  for (const o of ordenes) {
    if (!o.fecha_compromiso || o.en_espera_motivo || o.fecha_compromiso < dias[0] || o.fecha_compromiso > limite) continue;
    const k = casilla(o.fecha_compromiso);
    if (k) porDia.set(k, [...(porDia.get(k) ?? []), o]);
  }
  // «lun 26 oct», no «Lun 26 De Oct».
  const nombreDia = (f: string) => {
    const d = new Date(f + "T12:00:00-06:00");
    const p = (o: Intl.DateTimeFormatOptions) => d.toLocaleDateString("es-MX", { ...o, timeZone: "America/Mexico_City" }).replace(".", "");
    return `${p({ weekday: "short" })} ${p({ day: "numeric" })} ${p({ month: "short" })}`;
  };
  return (
    <div className="h-full flex flex-col gap-4">
      <h2 className="flex items-center gap-4 text-[44px] font-extrabold"><CalendarDays className="h-12 w-12 text-marca" />Entregas de las próximas dos semanas</h2>
      <div className="flex-1 min-h-0 grid grid-cols-5 grid-rows-2 gap-4">
        {dias.map((d) => {
          const lista = (porDia.get(d) ?? []).sort((a, b) => a.avance - b.avance);
          const pasado = d < hoyIso;
          return (
            <section key={d} className={cn("min-h-0 overflow-hidden rounded-2xl border-2 px-4 py-3 flex flex-col gap-2",
              d === hoyIso ? "border-marca bg-marca/10" : "border-borde bg-superficie", pasado && "opacity-50")}>
              <p className={cn("text-[28px] font-bold first-letter:uppercase", d === hoyIso ? "text-marca-texto" : "text-tenue")}>{d === hoyIso ? "Hoy" : nombreDia(d)}</p>
              {lista.slice(0, 3).map((o) => (
                <div key={o.id} className="min-w-0">
                  <p className="text-[26px] font-semibold leading-tight truncate">{abreviarEquipo(o.equipo)}</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-3 rounded-full bg-borde overflow-hidden">
                      <div className={cn("h-full rounded-full", o.avance >= 100 ? "bg-ok" : o.atrasada ? "bg-peligro" : "bg-marca")} style={{ width: `${Math.min(100, Number(o.avance))}%` }} />
                    </div>
                    <span className="text-[22px] text-tenue cifra">{o.pedido_folio ? folioTV(o.pedido_folio) : "stock"}</span>
                  </div>
                </div>
              ))}
              {lista.length > 3 && <p className="text-[22px] text-tenue">y {lista.length - 3} más</p>}
            </section>
          );
        })}
      </div>
    </div>
  );
}

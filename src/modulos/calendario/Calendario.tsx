// Calendario: todo lo que tiene fecha en el ERP y te toca ver, en un solo lugar. No guarda
// nada propio: lo arma calendario() con tus permisos (un vendedor ve sus entregas, no las
// compras; nadie ve un pago sin finanzas). Lo que ya se cerró no sale; lo atrasado, en rojo.
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Pagina } from "@/components/layout/Shell";
import { Boton } from "@/components/ui/boton";
import { Interruptor } from "@/components/ui/interruptor";
import { Lateral } from "@/components/ui/dialogo";
import { Cargando, ErrorCarga, Vacio } from "@/components/ui/estados";
import { hoyISO } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { GLOSARIO } from "@/tutorial/glosario";
import { AREAS, Renglon, areaDe, atrasado, colorDe, diaSemana, enRojo, lunesDe, masDias, ordenDelDia, useCalendario, type AreaCal, type EventoCal } from "./comun";

type Vista = "mes" | "semana" | "lista";
const VISTAS: { valor: Vista; texto: string }[] = [{ valor: "mes", texto: "Mes" }, { valor: "semana", texto: "Semana" }, { valor: "lista", texto: "Lista" }];
const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

const diaLargo = new Intl.DateTimeFormat("es-MX", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Mexico_City" });
// «martes 29» y no «mar 29»: en una agenda, «mar» se lee como marzo.
const diaCorto = new Intl.DateTimeFormat("es-MX", { weekday: "long", day: "numeric", timeZone: "America/Mexico_City" });
const deIso = (f: string) => new Date(f + "T12:00:00-06:00");
const ultimoDelMes = (iso: string) => { const d = new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)), 0); return d.toLocaleDateString("en-CA"); };
const sumarMeses = (iso: string, n: number) => new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1 + n, 1).toLocaleDateString("en-CA");

function rangoDe(vista: Vista, ancla: string) {
  if (vista === "semana") { const desde = lunesDe(ancla); return { desde, hasta: masDias(desde, 6) }; }
  const primero = ancla.slice(0, 8) + "01";
  if (vista === "lista") return { desde: primero, hasta: ultimoDelMes(primero) };
  // El mes con sus semanas completas: de lunes a domingo, como se ve en la cuadrícula.
  return { desde: lunesDe(primero), hasta: masDias(lunesDe(ultimoDelMes(primero)), 6) };
}

function tituloDe(vista: Vista, ancla: string) {
  if (vista !== "semana") return `${MESES[Number(ancla.slice(5, 7)) - 1]} ${ancla.slice(0, 4)}`;
  const a = lunesDe(ancla), b = masDias(a, 6);
  const mes = (x: string) => MESES_CORTOS[Number(x.slice(5, 7)) - 1];
  return `${Number(a.slice(8))}${mes(a) !== mes(b) ? ` ${mes(a)}` : ""} al ${Number(b.slice(8))} ${mes(b)} ${b.slice(0, 4)}`;
}

/** Cada evento en cada día que dura (vacaciones o un servicio de varios días), dentro del rango. */
function porDia(eventos: EventoCal[], desde: string, hasta: string) {
  const m = new Map<string, EventoCal[]>();
  for (const e of eventos) {
    let d = e.fecha < desde ? desde : e.fecha;
    const fin = e.fecha_fin && e.fecha_fin < hasta ? e.fecha_fin : e.fecha_fin ? hasta : e.fecha;
    for (let i = 0; d <= fin && i < 130; i++, d = masDias(d, 1)) m.set(d, [...(m.get(d) ?? []), e]);
  }
  for (const l of m.values()) l.sort(ordenDelDia);
  return m;
}

export default function Calendario() {
  const [params, setParams] = useSearchParams();
  const hoy = hoyISO();
  const vista: Vista = (params.get("vista") as Vista) ?? (typeof window !== "undefined" && window.innerWidth < 640 ? "lista" : "mes");
  const ancla = params.get("dia") ?? hoy;
  const soloMio = params.get("mio") === "1";
  const [ocultas, setOcultas] = useState<Set<AreaCal>>(new Set());
  const [abierto, setAbierto] = useState<string | null>(null);
  const poner = (cambios: Record<string, string | null>) => setParams((p) => {
    const n = new URLSearchParams(p);
    for (const [k, v] of Object.entries(cambios)) if (v == null) n.delete(k); else n.set(k, v);
    return n;
  }, { replace: true });

  const { desde, hasta } = rangoDe(vista, ancla);
  const datos = useCalendario(desde, hasta);
  const todos = datos.data ?? [];
  const visibles = useMemo(() => todos.filter((e) => (!soloMio || e.mio) && !ocultas.has(areaDe(e.area))), [todos, soloMio, ocultas]);
  const mapa = useMemo(() => porDia(visibles, desde, hasta), [visibles, desde, hasta]);
  const cuantos = (a: AreaCal) => todos.filter((e) => areaDe(e.area) === a && (!soloMio || e.mio)).length;
  const atrasados = visibles.filter(atrasado).length;

  const mover = (n: number) => poner({ dia: vista === "semana" ? masDias(ancla, 7 * n) : sumarMeses(ancla, n) });

  return (
    <Pagina titulo="Calendario" descripcion="Todo lo que tiene fecha y te toca ver: entregas, lo que llega, servicios, preventivos, pagos, vacaciones y pendientes."
      acciones={
        <div className="flex rounded-lg border border-borde bg-fondo p-0.5" role="group" aria-label="Vista">
          {VISTAS.map((v) => (
            <button key={v.valor} type="button" aria-pressed={vista === v.valor} onClick={() => poner({ vista: v.valor })}
              className={cn("h-8 rounded-md px-3 text-sm font-medium", vista === v.valor ? "bg-superficie shadow-sm text-texto" : "text-tenue hover:text-texto")}>
              {v.texto}
            </button>
          ))}
        </div>
      }>
      <div className="tarjeta overflow-hidden">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 border-b border-borde">
          <div className="flex items-center gap-1">
            <Boton variante="fantasma" tamano="icono" aria-label="Anterior" onClick={() => mover(-1)}><ChevronLeft className="h-4 w-4" /></Boton>
            <h2 className="font-semibold min-w-[11rem] text-center first-letter:uppercase cifra">{tituloDe(vista, ancla)}</h2>
            <Boton variante="fantasma" tamano="icono" aria-label="Siguiente" onClick={() => mover(1)}><ChevronRight className="h-4 w-4" /></Boton>
          </div>
          <Boton variante="secundario" tamano="sm" onClick={() => poner({ dia: null })}>Hoy</Boton>
          {atrasados > 0 && (
            <span className="text-sm font-medium text-peligro" data-explain={GLOSARIO.atrasadoCalendario} data-explain-title="Atrasado">
              {atrasados} {atrasados === 1 ? "atrasado" : "atrasados"}
            </span>
          )}
          <label className="ml-auto flex items-center gap-2 text-sm text-tenue" data-explain={GLOSARIO.soloLoMio} data-explain-title="Solo lo mío">
            <Interruptor activo={soloMio} alCambiar={(v) => poner({ mio: v ? "1" : null })} aria-label="Solo lo mío" />
            Solo lo mío
          </label>
        </div>
        <div className="flex flex-wrap gap-1.5 px-4 py-2.5 border-b border-borde" data-explain={GLOSARIO.calendarioAreas} data-explain-title="Áreas">
          {AREAS.filter((a) => cuantos(a.valor) > 0 || ocultas.has(a.valor)).map((a) => {
            const oculta = ocultas.has(a.valor);
            return (
              <button key={a.valor} type="button" aria-pressed={!oculta}
                onClick={() => setOcultas((s) => { const n = new Set(s); if (n.has(a.valor)) n.delete(a.valor); else n.add(a.valor); return n; })}
                className={cn("h-7 inline-flex items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition",
                  oculta ? "border-dashed border-borde text-tenue line-through" : "border-borde hover:bg-fondo")}>
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: oculta ? "transparent" : a.color, boxShadow: `inset 0 0 0 1.5px ${a.color}` }} />
                {a.texto}<span className="cifra text-tenue">{cuantos(a.valor)}</span>
              </button>
            );
          })}
          {!datos.isLoading && todos.length === 0 && <span className="text-xs text-tenue">Nada con fecha en estos días.</span>}
        </div>

        {datos.error ? <ErrorCarga error={datos.error} /> : datos.isLoading ? <Cargando filas={6} /> : (
          vista === "mes" ? <Mes desde={desde} hasta={hasta} mes={ancla.slice(0, 7)} hoy={hoy} mapa={mapa} alAbrir={setAbierto} />
          : vista === "semana" ? <Semana desde={desde} hoy={hoy} mapa={mapa} alAbrir={setAbierto} />
          : <Lista desde={desde} hasta={hasta} hoy={hoy} mapa={mapa} vacio={visibles.length === 0} filtrado={soloMio || ocultas.size > 0} />
        )}
      </div>

      <Lateral abierto={!!abierto} alCambiar={(v) => !v && setAbierto(null)} ancho="max-w-lg"
        titulo={abierto ? diaLargo.format(deIso(abierto)) : ""} subtitulo={abierto === hoy ? "Hoy" : undefined}>
        {abierto && ((mapa.get(abierto) ?? []).length === 0
          ? <Vacio icono={CalendarDays} titulo="Nada este día" texto="Si quitaste áreas o pusiste «Solo lo mío», quítalos para ver lo de los demás." />
          : <ul className="-mx-4 divide-y divide-borde">{(mapa.get(abierto) ?? []).map((e) => <li key={e.clave}><Renglon e={e} /></li>)}</ul>)}
      </Lateral>
    </Pagina>
  );
}

/** Una línea dentro de la cuadrícula del mes o de la semana. */
function Chip({ e, completo }: { e: EventoCal; completo?: boolean }) {
  const contenido = (
    <span title={`${e.titulo}${e.detalle ? ` · ${e.detalle}` : ""}`}
      className={cn("flex items-start gap-1 rounded px-1.5 py-0.5 text-[11px] leading-tight border-l-[3px]",
        enRojo(e) ? "bg-peligro-suave text-peligro" : e.tono === "aviso" ? "bg-aviso-suave" : "bg-fondo")}
      style={{ borderLeftColor: colorDe(e.area) }}>
      {e.hora && <span className="cifra shrink-0 text-tenue">{e.hora}</span>}
      <span className={completo ? "line-clamp-3" : "truncate"}>{e.titulo}</span>
    </span>
  );
  return e.ruta
    ? <Link to={e.ruta} onClick={(ev) => ev.stopPropagation()} className="block min-w-0 hover:opacity-80">{contenido}</Link>
    : <span className="block min-w-0">{contenido}</span>;
}

function Mes({ desde, hasta, mes, hoy, mapa, alAbrir }: {
  desde: string; hasta: string; mes: string; hoy: string; mapa: Map<string, EventoCal[]>; alAbrir: (d: string) => void;
}) {
  const dias: string[] = [];
  for (let d = desde; d <= hasta; d = masDias(d, 1)) dias.push(d);
  return (
    <div className="grid grid-cols-7">
      {DIAS.map((d) => <div key={d} className="px-2 py-1.5 text-[11px] font-medium uppercase tracking-wide text-tenue border-b border-borde bg-fondo/60">{d}</div>)}
      {dias.map((d) => {
        const lista = mapa.get(d) ?? [];
        const otroMes = d.slice(0, 7) !== mes;
        const finde = diaSemana(d) >= 5;
        return (
          // Toda la casilla abre el día (en celular solo caben puntos); las líneas llevan a su pantalla.
          <div key={d} onClick={() => alAbrir(d)}
            className={cn("min-h-[72px] sm:min-h-[112px] border-b border-r border-borde/60 p-1 sm:p-1.5 flex flex-col gap-1 cursor-pointer hover:bg-marca-suave/30 min-w-0",
              (otroMes || finde) && "bg-fondo/50")}>
            <button type="button" onClick={(ev) => { ev.stopPropagation(); alAbrir(d); }} aria-label={`Ver ${diaLargo.format(deIso(d))}`}
              className={cn("self-start text-xs cifra rounded-full", d === hoy ? "h-5 w-5 bg-marca text-white grid place-items-center font-semibold" : otroMes ? "text-tenue/60" : "text-tenue")}>
              {Number(d.slice(8))}
            </button>
            <div className="hidden sm:flex flex-col gap-0.5 min-w-0">
              {lista.slice(0, 3).map((e) => <Chip key={e.clave} e={e} />)}
              {lista.length > 3 && <span className="text-[11px] text-tenue px-1">+{lista.length - 3} más</span>}
            </div>
            {lista.length > 0 && (
              <div className="sm:hidden flex flex-wrap gap-0.5" aria-hidden>
                {lista.slice(0, 6).map((e) => <span key={e.clave} className={cn("h-1.5 w-1.5 rounded-full", enRojo(e) && "ring-1 ring-peligro")} style={{ background: colorDe(e.area) }} />)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Semana({ desde, hoy, mapa, alAbrir }: { desde: string; hoy: string; mapa: Map<string, EventoCal[]>; alAbrir: (d: string) => void }) {
  const dias = Array.from({ length: 7 }, (_, i) => masDias(desde, i));
  return (
    <div className="grid sm:grid-cols-7 divide-y sm:divide-y-0 sm:divide-x divide-borde">
      {dias.map((d) => {
        const lista = mapa.get(d) ?? [];
        return (
          <div key={d} className={cn("min-w-0 p-2 flex flex-col gap-1 sm:min-h-[320px]", diaSemana(d) >= 5 && "bg-fondo/50")}>
            <button type="button" onClick={() => alAbrir(d)}
              className={cn("self-start text-xs font-medium rounded-md px-1.5 py-0.5 first-letter:uppercase", d === hoy ? "bg-marca text-white" : "text-tenue hover:text-texto")}>
              {diaCorto.format(deIso(d))}
            </button>
            {lista.length === 0 ? <span className="hidden sm:block text-[11px] text-tenue/60 px-1">—</span> : lista.map((e) => <Chip key={e.clave} e={e} completo />)}
          </div>
        );
      })}
    </div>
  );
}

function Lista({ desde, hasta, hoy, mapa, vacio, filtrado }: {
  desde: string; hasta: string; hoy: string; mapa: Map<string, EventoCal[]>; vacio: boolean; filtrado: boolean;
}) {
  if (vacio) return (
    <Vacio icono={CalendarDays} titulo="Nada con fecha este mes"
      texto={filtrado ? "Quitaste áreas o pusiste «Solo lo mío»: quítalos para ver lo de los demás."
        : "Aquí salen las entregas de pedidos, lo que llega de compras, servicios, preventivos, vacaciones y los pendientes que te tocan, según tu puesto."} />
  );
  // Lo que dura varios días (vacaciones, un servicio) sale una vez, el primer día, con «hasta el…».
  const delDia = (d: string) => (mapa.get(d) ?? []).filter((e) => !e.fecha_fin || d === (e.fecha < desde ? desde : e.fecha));
  const dias = [...mapa.keys()].filter((d) => d >= desde && d <= hasta && delDia(d).length > 0).sort();
  return (
    <div>
      {dias.map((d) => (
        <section key={d}>
          <h3 className={cn("sticky top-0 z-[1] px-4 py-1.5 text-xs font-semibold border-b border-borde bg-fondo/95 backdrop-blur first-letter:uppercase",
            d === hoy ? "text-marca-texto" : d < hoy ? "text-tenue" : "")}>
            {d === hoy ? `Hoy · ${diaLargo.format(deIso(d))}` : diaLargo.format(deIso(d))}
          </h3>
          <ul className="divide-y divide-borde">{delDia(d).map((e) => <li key={e.clave}><Renglon e={e} /></li>)}</ul>
        </section>
      ))}
    </div>
  );
}

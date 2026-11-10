import { useMemo, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  ArrowDownRight, ArrowUpRight, Award, Bot, Gauge, Headphones, Headset, Minus, PhoneCall, ShieldAlert, Target, Users,
} from "lucide-react";
import { Pagina } from "@/components/layout/Shell";
import { Kpi } from "@/components/ui/kpi";
import { Tarjeta, EncabezadoTarjeta } from "@/components/ui/tarjeta";
import { TablaDatos, Filtro, type Columna } from "@/components/datos/TablaDatos";
import { Cargando, ErrorCarga, Vacio } from "@/components/ui/estados";
import { Insignia } from "@/components/ui/insignia";
import { Seleccion } from "@/components/ui/campo";
import { Lateral } from "@/components/ui/dialogo";
import { Boton } from "@/components/ui/boton";
import { TooltipGrafica, SERIE, ejeProps } from "@/components/graficas/comunes";
import { BarraRanking } from "@/modulos/analisis/comun";
import { supabase } from "@/lib/supabase";
import { q, useTiempoReal } from "@/lib/consultas";
import { useSesion } from "@/lib/sesion";
import { fecha, fechaYHora, hoyISO, numero } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { GLOSARIO } from "@/tutorial/glosario";
import { duracion, grabacionVigente, tonoCalificacion } from "./componentes/Llamadas";

/**
 * Coaching de llamadas: la calificación que el conmutador le pone a cada llamada atendida, con su
 * evidencia. Cada quien ve lo suyo y la gerencia de ventas/dirección el equipo; esa regla no vive
 * aquí sino en la base (RLS de llamada_coaching y coaching_resumen): esta pantalla solo pide
 * «todo lo que puedo ver» o, si es gerencia, «lo de esta persona».
 *
 * Ventas y atención van APARTE (pestañas): el conmutador califica una venta con su rúbrica de
 * ventas y lo demás (un proveedor, una factura, un trámite) con la de atención, y promediarlas
 * juntas le movía el número a un vendedor con llamadas que no eran venta. Se abre en la que tiene
 * más llamadas: a recepción en Atención, a un vendedor en Ventas.
 */

interface Semana { semana: string; n: number; promedio: number }
interface Referencia { llamada_id: string; fecha: string; calificacion: number; perfil_id?: string | null }
interface Persona {
  perfil_id: string | null; tipo: "persona" | "ia"; nombre: string; n: number; promedio: number;
  reciente: number | null; anterior: number | null; fallo: { nombre: string; n: number } | null;
  semanas: Semana[] | null; mejor: Referencia; peor: Referencia;
}
type Rubrica = "ventas" | "atencion";
const NOMBRE_RUBRICA: Record<Rubrica, string> = { ventas: "Ventas", atencion: "Atención" };
const esRubrica = (v: string | null): v is Rubrica => v === "ventas" || v === "atencion";
interface Resumen {
  rubricas: { clave: Rubrica; n: number }[];
  desde: string; hasta: string; todos: boolean; n: number; promedio: number | null; reciente: number | null; anterior: number | null;
  semanas: Semana[]; personas: Persona[];
  criterios: { clave: string; nombre: string; peso: number | null; n: number; promedio: number }[];
  fallos: { clave: string; nombre: string; n: number }[];
  tono: { clave: string; nombre: string; signo: number; n: number }[];
  mejor: Referencia | null; peor: Referencia | null;
}
interface FilaCoaching {
  llamada_id: string; fecha: string; perfil_id: string | null; atendio_tipo: "persona" | "ia"; atendio: string; quien_llamo: string | null;
  duracion_seg: number | null; area_nombre: string | null; calificacion: number; calificacion_sin_topes: number | null; topes: number;
  fallos: string[]; grabacion_url: string | null; grabacion_vence: string | null; rubrica: Rubrica;
}

type Periodo = "30" | "90" | "180" | "365";
const PERIODOS: { valor: Periodo; texto: string }[] = [
  { valor: "30", texto: "30 días" }, { valor: "90", texto: "90 días" }, { valor: "180", texto: "6 meses" }, { valor: "365", texto: "12 meses" },
];
const restarDias = (iso: string, d: number) => { const x = new Date(iso + "T12:00:00-06:00"); x.setDate(x.getDate() - d); return x.toLocaleDateString("en-CA"); };
const diaMes = new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short", timeZone: "America/Mexico_City" });
const semanaCorta = (iso: string) => diaMes.format(new Date(iso + "T12:00:00-06:00"));
/** El segundo de la grabación como «2:23». */
const minuto = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export default function Coaching() {
  const { puede } = useSesion();
  const gerencia = puede("ventas", 3);
  const [params, setParams] = useSearchParams();
  const periodo = (PERIODOS.some((p) => p.valor === params.get("periodo")) ? params.get("periodo") : "90") as Periodo;
  const hasta = hoyISO();
  const desde = useMemo(() => restarDias(hasta, Number(periodo) - 1), [hasta, periodo]);
  // ?perfil= lo usa la revisión nocturna para mandar a dirección con la persona; solo la gerencia elige.
  const persona = gerencia ? params.get("perfil") : null;
  const abierta = params.get("llamada");
  const cambiar = (llave: string, valor: string | null) => {
    const n = new URLSearchParams(params);
    if (valor) n.set(llave, valor); else n.delete(llave);
    setParams(n, { replace: true });
  };

  useTiempoReal("llamada_coaching", [["coaching_resumen"], ["coaching_llamadas"], ["coaching_detalle"]]);
  // La rúbrica: la que pidió (?rubrica=) o, si no, primero todo, y si hay de las dos, la que tenga
  // más llamadas (la base las regresa ordenadas). Con una sola, «todo» ya es esa.
  const pedida = esRubrica(params.get("rubrica")) ? (params.get("rubrica") as Rubrica) : null;
  const pedir = (r: Rubrica | null, perfil: string | null) =>
    q<Resumen>(supabase.rpc("coaching_resumen", { p_desde: desde, p_hasta: hasta, p_perfil: perfil, p_rubrica: r }));
  const base = useQuery({
    queryKey: ["coaching_resumen", desde, hasta, persona, pedida],
    queryFn: () => pedir(pedida, persona),
    placeholderData: keepPreviousData,
  });
  const grupos = base.data?.rubricas ?? [];
  const elegida: Rubrica | null = pedida ?? (grupos.length > 1 ? grupos[0].clave : null);
  const filtrada = useQuery({
    queryKey: ["coaching_resumen", desde, hasta, persona, elegida],
    queryFn: () => pedir(elegida, persona),
    enabled: !pedida && !!elegida, placeholderData: keepPreviousData,
  });
  const resumen = pedida || !elegida ? base : filtrada;
  // El equipo completo, para el selector de persona (la misma consulta que la vista del equipo).
  const equipo = useQuery({
    queryKey: ["coaching_resumen", desde, hasta, null, elegida],
    queryFn: () => pedir(elegida, null),
    enabled: gerencia, placeholderData: keepPreviousData,
  });
  const lista = useQuery({
    queryKey: ["coaching_llamadas", desde, hasta, persona, elegida],
    queryFn: () => q<FilaCoaching[]>(supabase.rpc("coaching_llamadas", { p_desde: desde, p_hasta: hasta, p_perfil: persona, p_rubrica: elegida })),
    placeholderData: keepPreviousData,
  });
  const pestanas = grupos.length > 1 || pedida
    ? (["ventas", "atencion"] as Rubrica[]).map((r) => ({
        valor: r, texto: NOMBRE_RUBRICA[r], cuenta: grupos.find((g) => g.clave === r)?.n ?? 0,
        explica: r === "ventas" ? GLOSARIO.rubricaVentas : GLOSARIO.rubricaAtencion,
      }))
    : null;

  const vistaEquipo = gerencia && !persona;
  const nombrePersona = persona ? resumen.data?.personas[0]?.nombre ?? equipo.data?.personas.find((p) => p.perfil_id === persona)?.nombre : null;
  const opcionesPersona = (equipo.data?.personas ?? []).filter((p) => p.perfil_id);
  if (persona && nombrePersona && !opcionesPersona.some((p) => p.perfil_id === persona)) {
    opcionesPersona.push({ perfil_id: persona, nombre: nombrePersona } as Persona);
  }

  return (
    <Pagina titulo="Coaching" ancho="max-w-[1500px]"
      descripcion={`${vistaEquipo ? "Todo el equipo" : nombrePersona ?? (gerencia ? "Una persona" : "Tus llamadas")}${elegida ? ` · ${NOMBRE_RUBRICA[elegida].toLowerCase()}` : ""} · del ${fecha(desde)} al ${fecha(hasta)}`}
      acciones={<>
        {pestanas && <Filtro opciones={pestanas} valor={elegida ?? "ventas"} alCambiar={(v) => cambiar("rubrica", v)} />}
        {gerencia && (
          <Seleccion aria-label="Persona" className="h-8 w-auto min-w-[200px] text-sm" value={persona ?? ""}
            onChange={(e) => cambiar("perfil", e.target.value || null)} data-explain={GLOSARIO.equipoCoaching} data-explain-title="Persona">
            <option value="">Todo el equipo</option>
            {opcionesPersona.map((p) => <option key={p.perfil_id!} value={p.perfil_id!}>{p.nombre}</option>)}
          </Seleccion>
        )}
        <Filtro opciones={PERIODOS} valor={periodo} alCambiar={(v) => cambiar("periodo", v === "90" ? null : v)} />
      </>}>
      {resumen.error ? <ErrorCarga error={resumen.error} /> : !resumen.data ? <Cargando filas={8} /> : resumen.data.n === 0 ? (
        <Tarjeta>
          <SinCoaching propio={!vistaEquipo && !persona} periodo={PERIODOS.find((p) => p.valor === periodo)!.texto} />
        </Tarjeta>
      ) : (
        <Contenido r={resumen.data} lista={lista.data} cargandoLista={lista.isLoading} errorLista={lista.error} equipo={vistaEquipo}
          propio={!gerencia} abrir={(id) => cambiar("llamada", id)} elegir={(id) => cambiar("perfil", id)} />
      )}
      <DetalleCoaching id={abierta} cerrar={() => cambiar("llamada", null)} />
    </Pagina>
  );
}

function SinCoaching({ propio, periodo }: { propio: boolean; periodo: string }) {
  const { puede } = useSesion();
  return (
    <Vacio icono={Headset} titulo={propio ? `Todavía no tienes llamadas calificadas en los últimos ${periodo}` : `No hay llamadas calificadas en los últimos ${periodo}`}
      texto={<>La calificación llega sola de cada llamada que se atiende cuando el conmutador con IA está conectado
        (Configuración → Integraciones → Teléfono). Sin conmutador no hay coaching. Si ya está conectado, prueba un periodo más largo.</>}
      accion={puede("admin", 3) ? <Boton asChild variante="secundario" tamano="sm"><Link to="/sistema/configuracion?seccion=integraciones">Ir a Integraciones</Link></Boton> : undefined} />
  );
}

/** Cambio de puntos entre las últimas 4 semanas y las 4 de antes, con flecha (nunca solo el color). */
function Tendencia({ reciente, anterior, className }: { reciente: number | null; anterior: number | null; className?: string }) {
  if (reciente == null || anterior == null) return <span className={cn("text-xs text-tenue", className)}>{reciente == null ? "sin llamadas recientes" : "sin semanas antes"}</span>;
  const d = Math.round((reciente - anterior) * 10) / 10;
  const Icono = d > 0 ? ArrowUpRight : d < 0 ? ArrowDownRight : Minus;
  return (
    <span data-explain={GLOSARIO.tendenciaCoaching} data-explain-title="Tendencia"
      className={cn("inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold cifra",
        Math.abs(d) < 0.3 ? "bg-fondo text-tenue" : d > 0 ? "bg-ok-suave text-ok" : "bg-aviso-suave text-aviso", className)}>
      <Icono className="h-3 w-3" />{d > 0 ? "+" : ""}{numero(d)}
    </span>
  );
}

function Calificacion({ v, className }: { v: number; className?: string }) {
  return <Insignia tono={tonoCalificacion(v)} className={cn("cifra", className)}>{numero(v)}</Insignia>;
}

function Contenido({ r, lista, cargandoLista, errorLista, equipo, propio, abrir, elegir }: {
  r: Resumen; lista?: FilaCoaching[]; cargandoLista: boolean; errorLista: unknown; equipo: boolean; propio: boolean;
  abrir: (id: string) => void; elegir: (id: string) => void;
}) {
  const porId = useMemo(() => new Map((lista ?? []).map((f) => [f.llamada_id, f])), [lista]);
  const criterios = [...r.criterios].sort((a, b) => b.promedio - a.promedio);
  const fuerte = criterios[0];
  const debil = criterios.length > 1 ? criterios[criterios.length - 1] : undefined;

  const colLista: Columna<FilaCoaching>[] = [
    { clave: "fecha", titulo: "Fecha", valor: (f) => f.fecha, celda: (f) => <span className="whitespace-nowrap">{fechaYHora(f.fecha)}</span> },
    { clave: "calificacion", titulo: "Calificación", alinear: "der", valor: (f) => f.calificacion, sinBusqueda: true, explica: GLOSARIO.calificacionCoaching,
      celda: (f) => <span className="inline-flex items-center gap-1.5">{f.topes > 0 && <span data-explain={GLOSARIO.topeCoaching} data-explain-title="Con tope"><ShieldAlert className="h-3.5 w-3.5 text-aviso" aria-label="Con tope" /></span>}<Calificacion v={f.calificacion} /></span> },
    ...(equipo ? [{ clave: "atendio", titulo: "Atendió", valor: (f: FilaCoaching) => f.atendio,
      celda: (f: FilaCoaching) => <span className="inline-flex items-center gap-1 whitespace-nowrap">{f.atendio_tipo === "ia" && <Bot className="h-3.5 w-3.5 text-tenue" />}{f.atendio}</span> }] : []),
    { clave: "quien_llamo", titulo: "Quién llamó", valor: (f) => `${f.quien_llamo ?? "Sin identificar"} ${f.area_nombre ?? ""}`,
      celda: (f) => <span className="block min-w-[160px]">{f.quien_llamo ?? <span className="text-tenue">Sin identificar</span>}
        {f.area_nombre && <span className="block text-xs text-tenue">{f.area_nombre}</span>}</span> },
    { clave: "duracion_seg", titulo: "Duración", alinear: "der", valor: (f) => f.duracion_seg ?? 0, sinBusqueda: true,
      celda: (f) => <span className="cifra whitespace-nowrap">{duracion(f.duracion_seg) ?? "—"}</span> },
    { clave: "fallos", titulo: "Fallos", valor: (f) => f.fallos.join(", "), explica: GLOSARIO.falloCoaching,
      celda: (f) => f.fallos.length ? <span className="block max-w-[320px] truncate text-tenue" title={f.fallos.join(", ")}>{f.fallos.join(", ")}</span> : <span className="text-tenue">—</span> },
  ];

  const colEquipo: Columna<Persona>[] = [
    { clave: "nombre", titulo: "Persona", valor: (p) => p.nombre,
      celda: (p) => <span className="inline-flex items-center gap-1.5 min-w-[160px]">{p.tipo === "ia" && <Bot className="h-3.5 w-3.5 text-tenue" />}
        <span className={cn(p.perfil_id && "font-medium")}>{p.nombre}</span></span> },
    { clave: "n", titulo: "Llamadas", alinear: "der", valor: (p) => p.n, celda: (p) => <span className="cifra">{numero(p.n)}</span> },
    { clave: "promedio", titulo: "Promedio", alinear: "der", valor: (p) => p.promedio, explica: GLOSARIO.calificacionCoaching, celda: (p) => <Calificacion v={p.promedio} /> },
    { clave: "tendencia", titulo: "Tendencia", alinear: "der", explica: GLOSARIO.tendenciaCoaching, sinBusqueda: true,
      valor: (p) => (p.reciente != null && p.anterior != null ? p.reciente - p.anterior : null), celda: (p) => <Tendencia reciente={p.reciente} anterior={p.anterior} /> },
    { clave: "fallo", titulo: "Fallo más repetido", valor: (p) => p.fallo?.nombre ?? "", explica: GLOSARIO.falloCoaching,
      celda: (p) => p.fallo ? <span>{p.fallo.nombre} <span className="text-tenue cifra">· {numero(p.fallo.n)} de {numero(p.n)}</span></span> : <span className="text-tenue">—</span> },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi titulo={equipo ? "Promedio del equipo" : propio ? "Tu calificación promedio" : "Calificación promedio"} valor={<>{numero(r.promedio)}<span className="text-base text-tenue font-normal"> de 10</span></>}
          icono={Gauge} tono={r.promedio == null ? "neutro" : tonoCalificacion(r.promedio)} explica={GLOSARIO.calificacionCoaching}
          detalle={`${numero(r.n)} ${r.n === 1 ? "llamada calificada" : "llamadas calificadas"}`} />
        <Kpi titulo="Tendencia" icono={Target} tono="info" explica={GLOSARIO.tendenciaCoaching}
          valor={r.reciente != null && r.anterior != null ? <Tendencia reciente={r.reciente} anterior={r.anterior} className="text-base" /> : "—"}
          detalle={`últimas 4 semanas ${numero(r.reciente)} · antes ${numero(r.anterior)}`} />
        {equipo ? (
          <Kpi titulo="Personas" icono={Users} tono="marca" valor={numero(r.personas.length)} explica={GLOSARIO.equipoCoaching}
            detalle={`${numero(r.personas.filter((p) => p.tipo === "ia").length)} de la IA · ${numero(r.personas.filter((p) => p.tipo === "persona" && !p.perfil_id).length)} sin ligar`} />
        ) : (
          <Kpi titulo={propio ? "Tu criterio más fuerte" : "Criterio más fuerte"} icono={Award} tono="ok" explica={GLOSARIO.criterioCoaching}
            valor={fuerte ? numero(fuerte.promedio) : "—"} detalle={fuerte?.nombre ?? "sin criterios"} />
        )}
        <Kpi titulo="Criterio a trabajar" icono={Target} tono="aviso" explica={GLOSARIO.criterioCoaching}
          valor={debil ? numero(debil.promedio) : "—"} detalle={debil?.nombre ?? "con un solo criterio no hay contra qué comparar"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Tarjeta className="lg:col-span-2 min-w-0">
          <EncabezadoTarjeta titulo="Calificación semana a semana" explica={GLOSARIO.calificacionCoaching}
            descripcion={equipo ? "Promedio de todas las llamadas calificadas de cada semana" : "Promedio de las llamadas calificadas de cada semana"} />
          <GraficaSemanas semanas={r.semanas} />
        </Tarjeta>
        <Tarjeta className="min-w-0">
          <EncabezadoTarjeta titulo="Mejor y peor llamada" explica={GLOSARIO.mejorPeorLlamada} descripcion="Escúchalas una tras otra: ahí se ve qué cambia" />
          <div className="px-5 pb-5 space-y-3">
            {r.mejor && <TarjetaLlamada etiqueta="La mejor" r={r.mejor} f={porId.get(r.mejor.llamada_id)} equipo={equipo} abrir={abrir} />}
            {r.peor && r.peor.llamada_id !== r.mejor?.llamada_id && <TarjetaLlamada etiqueta="La peor" r={r.peor} f={porId.get(r.peor.llamada_id)} equipo={equipo} abrir={abrir} />}
          </div>
        </Tarjeta>
      </div>

      {equipo && (
        <Tarjeta>
          <EncabezadoTarjeta titulo="El equipo" explica={GLOSARIO.equipoCoaching} descripcion="Clic en una persona para ver lo suyo; la tendencia son las últimas 4 semanas contra las 4 de antes" />
          <div className="px-3 pb-3">
            <TablaDatos filas={r.personas} columnas={colEquipo} claveFila={(p) => p.perfil_id ?? `${p.tipo}:${p.nombre}`} buscable={r.personas.length > 8}
              alClicFila={(p) => p.perfil_id && elegir(p.perfil_id)} exportarComo="coaching-equipo" placeholder="Buscar persona…"
              claseFila={(p) => (p.perfil_id ? undefined : "cursor-default")} />
          </div>
        </Tarjeta>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Tarjeta className="min-w-0">
          <EncabezadoTarjeta titulo="Criterios" explica={GLOSARIO.criterioCoaching} descripcion="Promedio de cada criterio, de 0 a 10; arriba los que más pesan" />
          <ul className="px-5 pb-5 space-y-3">
            {r.criterios.map((c) => (
              <li key={c.clave} className="space-y-1">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0">{c.nombre}{c.peso != null && <span className="text-xs text-tenue"> · peso {numero(c.peso)}</span>}</span>
                  <span className="cifra font-medium">{numero(c.promedio)}</span>
                </div>
                <BarraRanking valor={c.promedio} max={10} />
              </li>
            ))}
            {r.criterios.length === 0 && <li className="text-sm text-tenue">Las calificaciones de este periodo no traen criterios.</li>}
          </ul>
        </Tarjeta>
        <Tarjeta className="min-w-0">
          <EncabezadoTarjeta titulo={propio ? "Los fallos que más repites" : "Los fallos que más se repiten"} explica={GLOSARIO.falloCoaching}
            descripcion="En cuántas de las llamadas calificadas salió cada uno" />
          <ul className="px-5 pb-5 space-y-3">
            {r.fallos.map((f) => (
              <li key={f.clave} className="space-y-1">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0">{f.nombre}</span>
                  <span className="cifra text-tenue whitespace-nowrap">{numero(f.n)} de {numero(r.n)}</span>
                </div>
                <BarraRanking valor={f.n} max={r.n} />
              </li>
            ))}
            {r.fallos.length === 0 && <li className="text-sm text-tenue">Ningún fallo en este periodo. Así se sigue.</li>}
          </ul>
        </Tarjeta>
        <Tarjeta className="min-w-0">
          <EncabezadoTarjeta titulo="Señales de tono" explica={GLOSARIO.senalTono} descripcion="Cómo sonaron las llamadas: a favor y en contra" />
          <div className="px-5 pb-5 space-y-4">
            {([[1, "A favor", "ok"], [-1, "En contra", "aviso"]] as const).map(([signo, texto, tono]) => {
              const items = r.tono.filter((t) => t.signo === signo);
              return (
                <div key={signo} className="space-y-1.5">
                  <p className="text-xs font-medium text-tenue uppercase tracking-wide">{texto}</p>
                  {items.length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {items.map((t) => (
                        <Insignia key={t.clave} tono={tono}>{signo > 0 ? "+" : "−"} {t.nombre} <span className="cifra opacity-80">· {numero(t.n)}</span></Insignia>
                      ))}
                    </div>
                  ) : <p className="text-sm text-tenue">Ninguna.</p>}
                </div>
              );
            })}
          </div>
        </Tarjeta>
      </div>

      <Tarjeta>
        <EncabezadoTarjeta titulo={propio ? "Tus llamadas calificadas" : "Llamadas calificadas"} explica={GLOSARIO.calificacionCoaching}
          descripcion="Clic en una para ver cada criterio con la frase que lo justifica" />
        <div className="px-3 pb-3">
          <TablaDatos filas={lista} columnas={colLista} claveFila={(f) => f.llamada_id} cargando={cargandoLista} error={errorLista}
            alClicFila={(f) => abrir(f.llamada_id)} exportarComo="coaching-llamadas" placeholder="Buscar por cliente, área o fallo…"
            vacio={{ icono: PhoneCall, titulo: "Sin llamadas con esa búsqueda", texto: "Borra la búsqueda o elige otro periodo." }} />
        </div>
      </Tarjeta>
    </div>
  );
}

function GraficaSemanas({ semanas }: { semanas: Semana[] }) {
  const datos = semanas.map((s) => ({ ...s, etiqueta: semanaCorta(s.semana) }));
  return (
    <div className="h-64 px-2 pb-4">
      <ResponsiveContainer>
        <LineChart data={datos} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--rejilla)" />
          <XAxis dataKey="etiqueta" {...ejeProps} interval="preserveStartEnd" minTickGap={24} />
          <YAxis {...ejeProps} width={32} domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} />
          <Tooltip cursor={{ stroke: "var(--eje)", strokeWidth: 1 }}
            content={({ active, payload }) => {
              const s = payload?.[0]?.payload as (Semana & { etiqueta: string }) | undefined;
              return <TooltipGrafica active={active} formato={(v) => `${numero(v)} de 10`}
                payload={payload?.map((p) => ({ name: "Calificación", value: Number(p.value), color: SERIE(1) }))}
                label={s ? `Semana del ${s.etiqueta} · ${numero(s.n)} ${s.n === 1 ? "llamada" : "llamadas"}` : null} />;
            }} />
          <Line dataKey="promedio" name="Calificación" stroke={SERIE(1)} strokeWidth={2} dot={{ r: 3, fill: SERIE(1) }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function TarjetaLlamada({ etiqueta, r, f, equipo, abrir }: {
  etiqueta: string; r: Referencia; f?: FilaCoaching; equipo: boolean; abrir: (id: string) => void;
}) {
  return (
    <div className="rounded-lg border border-borde bg-fondo/40 p-3 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-tenue uppercase tracking-wide">{etiqueta}</span>
        <Calificacion v={r.calificacion} />
      </div>
      <p className="text-sm font-medium break-words">{f?.quien_llamo ?? "Sin identificar"}</p>
      <p className="text-xs text-tenue">{fechaYHora(r.fecha)}{f?.duracion_seg != null ? ` · ${duracion(f.duracion_seg)}` : ""}{equipo && f ? ` · ${f.atendio}` : ""}</p>
      <div className="flex flex-wrap gap-3 pt-0.5">
        {f && grabacionVigente(f) && (
          <a href={f.grabacion_url!} target="_blank" rel="noreferrer" data-explain={GLOSARIO.grabacionLlamada} data-explain-title="Escuchar"
            className="inline-flex items-center gap-1 text-xs text-marca-texto hover:underline"><Headphones className="h-3.5 w-3.5" />Escuchar</a>
        )}
        <button type="button" onClick={() => abrir(r.llamada_id)} className="text-xs text-marca-texto hover:underline">Ver el detalle</button>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Detalle de un coaching (panel derecho): de dónde sale la calificación
// -----------------------------------------------------------------------------
interface Criterio { clave: string; nombre: string; peso: number | null; nota: number | null; evidencia: string | null; segundo: number | null }
interface Detalle {
  llamada_id: string; perfil_id: string | null; atendio_tipo: "persona" | "ia"; calificacion: number; calificacion_sin_topes: number | null;
  rubrica_clave: string | null; rubrica_version: number | null; criterios: Criterio[];
  topes: { clave: string; nombre: string; maximo: number }[]; fallos: { clave: string; nombre: string; texto?: string | null }[];
  tono: { clave: string; nombre: string; signo: number; texto?: string | null }[];
  lo_bueno: string[]; a_mejorar: string[]; sugerencias: string[]; resumen: string | null; generado_en: string | null;
  llamada: {
    inicio: string | null; creado_en: string; duracion_seg: number | null; cliente_nombre: string | null; lead_nombre: string | null;
    cliente_id: string | null; lead_id: string | null; area_nombre: string | null; atendio_nombre: string | null; atendio_ia: string | null;
    grabacion_url: string | null; grabacion_vence: string | null; atendio: { nombre: string } | null;
  } | null;
}

function DetalleCoaching({ id, cerrar }: { id: string | null; cerrar: () => void }) {
  const { puede } = useSesion();
  const d = useQuery({
    queryKey: ["coaching_detalle", id], enabled: !!id,
    queryFn: () => q<Detalle | null>(supabase.from("llamada_coaching")
      .select("llamada_id, perfil_id, atendio_tipo, calificacion, calificacion_sin_topes, rubrica_clave, rubrica_version, criterios, topes, fallos, tono, lo_bueno, a_mejorar, sugerencias, resumen, generado_en, llamada:llamadas(inicio, creado_en, duracion_seg, cliente_nombre, lead_nombre, cliente_id, lead_id, area_nombre, atendio_nombre, atendio_ia, grabacion_url, grabacion_vence, atendio:perfiles!llamadas_atendio_perfil_fkey(nombre))")
      .eq("llamada_id", id!).maybeSingle().returns<Detalle | null>()),
  });
  const x = d.data;
  const ll = x?.llamada;
  const quien = x?.atendio_tipo === "ia" ? `La IA${ll?.atendio_ia ? ` (${ll.atendio_ia})` : ""}` : ll?.atendio?.nombre ?? ll?.atendio_nombre ?? "Sin nombre";
  const nombre = ll?.cliente_nombre ?? ll?.lead_nombre ?? "Sin nombre";
  const audio = ll && grabacionVigente(ll) ? ll.grabacion_url! : null;
  return (
    <Lateral abierto={!!id} alCambiar={(v) => !v && cerrar()} titulo={x ? `Llamada de ${nombre}` : "Coaching de la llamada"}
      subtitulo={ll ? `${fechaYHora(ll.inicio ?? ll.creado_en)}${ll.duracion_seg != null ? ` · ${duracion(ll.duracion_seg)}` : ""} · atendió ${quien}${ll.area_nombre ? ` · ${ll.area_nombre}` : ""}` : undefined}>
      {d.error ? <ErrorCarga error={d.error} /> : d.isLoading ? <Cargando filas={6} /> : !x ? (
        <Vacio icono={Headset} titulo="Esta calificación no está a tu alcance"
          texto="Ya no existe, o es de una llamada que atendió otra persona: cada quien ve solo las suyas, y la gerencia de ventas y dirección, todas." />
      ) : (
        <div className="space-y-6 text-sm">
          <section className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <div data-explain={GLOSARIO.calificacionCoaching} data-explain-title="Calificación">
              <p className="text-xs text-tenue">Calificación</p>
              <p className="text-4xl font-semibold cifra leading-none mt-1">{numero(x.calificacion)}<span className="text-base text-tenue font-normal"> de 10</span></p>
            </div>
            {x.calificacion_sin_topes != null && (
              <div data-explain={GLOSARIO.calificacionSinTopes} data-explain-title="Sin topes">
                <p className="text-xs text-tenue">Sin topes</p>
                <p className="text-2xl font-semibold cifra leading-none mt-1 text-tenue">{numero(x.calificacion_sin_topes)}</p>
              </div>
            )}
            <div className="flex flex-wrap gap-3 ml-auto">
              {audio && <a href={audio} target="_blank" rel="noreferrer" data-explain={GLOSARIO.grabacionLlamada} data-explain-title="Escuchar"
                className="inline-flex items-center gap-1 text-marca-texto hover:underline"><Headphones className="h-4 w-4" />Escuchar</a>}
              {ll?.cliente_id && puede("ventas") && <Link to={`/ventas/clientes/${ll.cliente_id}`} className="text-marca-texto hover:underline">Ver el cliente</Link>}
              {!ll?.cliente_id && ll?.lead_id && puede("leads") && <Link to={`/ventas/leads?id=${ll.lead_id}`} className="text-marca-texto hover:underline">Ver el lead</Link>}
            </div>
          </section>

          {x.topes.length > 0 && (
            <section className="rounded-lg border border-aviso/30 bg-aviso-suave p-3 space-y-1" data-explain={GLOSARIO.topeCoaching} data-explain-title="Topes aplicados">
              <p className="font-medium text-aviso flex items-center gap-1.5"><ShieldAlert className="h-4 w-4" />{x.topes.length === 1 ? "Se aplicó un tope" : `Se aplicaron ${x.topes.length} topes`}</p>
              {x.topes.map((t) => <p key={t.clave}>{t.nombre}: la calificación no pasa de <b className="cifra">{numero(t.maximo)}</b>.</p>)}
              {x.calificacion_sin_topes != null && x.calificacion_sin_topes > x.calificacion && (
                <p className="text-tenue">Sin el tope habría sido {numero(x.calificacion_sin_topes)}: lo demás salió mejor que lo que dice la calificación.</p>
              )}
            </section>
          )}

          {x.resumen && <Bloque titulo="Resumen"><p className="leading-relaxed">{x.resumen}</p></Bloque>}

          <Bloque titulo="Criterios" explica={GLOSARIO.criterioCoaching}>
            <ul className="divide-y divide-borde rounded-lg border border-borde">
              {x.criterios.map((c) => (
                <li key={c.clave} className="p-3 space-y-1.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-medium min-w-0">{c.nombre}{c.peso != null && <span className="text-xs text-tenue font-normal"> · peso {numero(c.peso)}</span>}</span>
                    <span className="cifra font-semibold whitespace-nowrap">{c.nota == null ? "—" : `${numero(c.nota)} de 10`}</span>
                  </div>
                  {c.nota != null && <BarraRanking valor={c.nota} max={10} />}
                  {c.evidencia ? (
                    <blockquote className="border-l-2 border-borde pl-3 text-tenue italic break-words" data-explain={GLOSARIO.evidenciaCoaching} data-explain-title="Evidencia">
                      {c.evidencia}
                      {c.segundo != null && audio && (
                        <a href={`${audio}#t=${Math.floor(c.segundo)}`} target="_blank" rel="noreferrer" className="not-italic ml-2 inline-flex items-center gap-1 text-xs text-marca-texto hover:underline">
                          <Headphones className="h-3 w-3" />Escuchar desde {minuto(c.segundo)}</a>
                      )}
                      {c.segundo != null && !audio && <span className="not-italic ml-2 text-xs">(minuto {minuto(c.segundo)})</span>}
                    </blockquote>
                  ) : <p className="text-xs text-tenue">Sin frase: no aplicó en esta llamada.</p>}
                </li>
              ))}
              {x.criterios.length === 0 && <li className="p-3 text-tenue">Esta calificación no trae criterios.</li>}
            </ul>
          </Bloque>

          {x.fallos.length > 0 && (
            <Bloque titulo="Fallos" explica={GLOSARIO.falloCoaching}>
              <ul className="space-y-1.5">{x.fallos.map((f) => <li key={f.clave}><b className="font-medium">{f.nombre}</b>{f.texto ? <span className="text-tenue">: {f.texto}</span> : null}</li>)}</ul>
            </Bloque>
          )}
          {x.tono.length > 0 && (
            <Bloque titulo="Señales de tono" explica={GLOSARIO.senalTono}>
              <ul className="space-y-1.5">{x.tono.map((t) => (
                <li key={t.clave} className="flex gap-2"><Insignia tono={t.signo < 0 ? "aviso" : "ok"}>{t.signo < 0 ? "En contra" : "A favor"}</Insignia>
                  <span><b className="font-medium">{t.nombre}</b>{t.texto ? <span className="text-tenue">: {t.texto}</span> : null}</span></li>
              ))}</ul>
            </Bloque>
          )}
          <div className="grid gap-4 sm:grid-cols-3">
            <Lista titulo="Lo bueno" items={x.lo_bueno} />
            <Lista titulo="A mejorar" items={x.a_mejorar} />
            <Lista titulo="Sugerencias" items={x.sugerencias} />
          </div>
          <p className="text-xs text-tenue border-t border-borde pt-3">
            {x.rubrica_clave
              ? `Rúbrica de ${/^atencion/i.test(x.rubrica_clave) ? "atención" : "ventas"} («${x.rubrica_clave}»${x.rubrica_version != null ? `, versión ${x.rubrica_version}` : ""})`
              : "Rúbrica del conmutador"}
            {x.generado_en ? ` · calificada el ${fechaYHora(x.generado_en)}` : ""}. La calificación la calcula el conmutador; el ERP no la cambia.
          </p>
        </div>
      )}
    </Lateral>
  );
}

function Bloque({ titulo, explica, children }: { titulo: string; explica?: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="font-semibold" data-explain={explica} data-explain-title={explica ? titulo : undefined}>{titulo}</h3>
      {children}
    </section>
  );
}

function Lista({ titulo, items }: { titulo: string; items: string[] }) {
  return (
    <div className="space-y-1.5">
      <h3 className="font-semibold">{titulo}</h3>
      {items.length ? <ul className="list-disc pl-4 space-y-1">{items.map((t, i) => <li key={i} className="break-words">{t}</li>)}</ul>
        : <p className="text-tenue">—</p>}
    </div>
  );
}

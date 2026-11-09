import { Link } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PhoneOff } from "lucide-react";
import { Cargando, ErrorCarga, Vacio } from "@/components/ui/estados";
import { Insignia } from "@/components/ui/insignia";
import { Boton } from "@/components/ui/boton";
import { Leyenda, SERIE, TooltipGrafica, ejeProps } from "@/components/graficas/comunes";
import { supabase } from "@/lib/supabase";
import { q } from "@/lib/consultas";
import { useSesion } from "@/lib/sesion";
import { fecha, hace, numero, porcentaje } from "@/lib/formato";
import { BarraRanking, Cifra, TarjetaGrafica, usePeriodo } from "./comun";
import { GLOSARIO } from "@/tutorial/glosario";

/**
 * Lo que dicen las llamadas del conmutador: solo agregados (llamadas_analitica), sin teléfonos ni
 * nombres de quien llamó. Qué piden, qué no se supo contestar, qué objetan y a qué horas llaman.
 */

interface Semana { semana: string; n: number; nadie_contesto: number }
interface Datos {
  desde: string; hasta: string; llamadas: number; nadie_contesto: number; con_analisis: number; stt_dudoso: number; pct_stt_dudoso: number | null;
  semanas: Semana[];
  equipos: { grupo: string; articulo_id: string | null; nombre: string; clave: string | null; texto: string; n: number; semanas: { semana: string; n: number }[] | null }[];
  preguntas: { clave: string; ejemplo: string; n: number; ultima: string }[];
  objeciones: { categoria: string | null; n: number; ejemplos: string[] | null }[];
  desenlaces: { desenlace: string; n: number }[];
  intenciones: { intencion: string; n: number }[];
  por_hora: { hora: number; n: number; nadie_contesto: number }[];
  por_dia: { dia: number; n: number; nadie_contesto: number }[];
}

// Las opciones del contrato con el conmutador; un valor nuevo sale tal cual (con mayúscula) en vez de perderse.
const INTENCION: Record<string, string> = {
  cotizar: "Cotizar", factura: "Factura", proveedor: "Proveedor que nos vende", empleo: "Empleo", envio: "Envío",
  soporte: "Soporte", seguimiento: "Seguimiento", otro: "Otro", "sin dato": "Sin dato",
};
const DESENLACE: Record<string, string> = {
  transferida: "Se pasó a una persona", lead: "Dejó un lead", resuelta: "Se resolvió en la llamada", abandonada: "Colgaron antes",
  "sin-valor": "No era de nada", "sin dato": "Sin dato",
};
const OBJECION: Record<string, string> = {
  precio: "Precio", tiempo_entrega: "Tiempo de entrega", ya_tiene_proveedor: "Ya tiene proveedor", lo_pensara: "Lo va a pensar",
  financiamiento: "Financiamiento", especificacion: "Especificación", otro: "Otro",
};
const legible = (mapa: Record<string, string>, v: string | null) => (v == null ? "Sin categoría" : mapa[v] ?? v.charAt(0).toUpperCase() + v.slice(1).replace(/[_-]/g, " "));
const DIAS = ["", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const diaMes = new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short", timeZone: "America/Mexico_City" });
const semanaCorta = (iso: string) => diaMes.format(new Date(iso + "T12:00:00-06:00"));
const restarDias = (iso: string, d: number) => { const x = new Date(iso + "T12:00:00-06:00"); x.setDate(x.getDate() - d); return x.toLocaleDateString("en-CA"); };
// La base no acepta más de 400 días (la consulta junta textos llamada por llamada).
const TOPE_DIAS = 400;

export default function LlamadasAnalisis() {
  const { periodo } = usePeriodo();
  const minimo = restarDias(periodo.hasta, TOPE_DIAS);
  const desde = periodo.desde < minimo ? minimo : periodo.desde;
  const datos = useQuery({
    queryKey: ["llamadas_analitica", desde, periodo.hasta],
    queryFn: () => q<Datos>(supabase.rpc("llamadas_analitica", { p_desde: desde, p_hasta: periodo.hasta })),
    placeholderData: keepPreviousData,
  });
  if (datos.error) return <ErrorCarga error={datos.error} />;
  if (!datos.data) return <Cargando filas={8} />;
  const d = datos.data;
  if (!d.llamadas) return <div className="tarjeta"><SinLlamadas /></div>;
  return <Contenido d={d} recortado={desde !== periodo.desde} />;
}

function SinLlamadas() {
  const { puede } = useSesion();
  return (
    <Vacio icono={PhoneOff} titulo="No hay llamadas en este periodo"
      texto="Estas cifras salen solas de cada llamada del conmutador con IA. Si no está conectado, se conecta en Configuración → Integraciones → Teléfono; sin conmutador no hay nada que contar. Si ya está conectado, elige un periodo más largo."
      accion={puede("admin", 3) ? <Boton asChild variante="secundario" tamano="sm"><Link to="/sistema/configuracion?seccion=integraciones">Ir a Integraciones</Link></Boton> : undefined} />
  );
}

function Contenido({ d, recortado }: { d: Datos; recortado: boolean }) {
  const semanas = d.semanas.map((s) => ({ etiqueta: semanaCorta(s.semana), Atendidas: s.n - s.nadie_contesto, "Nadie contestó": s.nadie_contesto }));
  const horas = d.por_hora.length ? Array.from({ length: Math.max(...d.por_hora.map((h) => h.hora)) - Math.min(...d.por_hora.map((h) => h.hora)) + 1 },
    (_, i) => Math.min(...d.por_hora.map((h) => h.hora)) + i) : [];
  const porHora = horas.map((h) => { const x = d.por_hora.find((y) => y.hora === h); return { etiqueta: `${h}:00`, Atendidas: (x?.n ?? 0) - (x?.nadie_contesto ?? 0), "Nadie contestó": x?.nadie_contesto ?? 0 }; });
  const porDia = [1, 2, 3, 4, 5, 6, 7].map((dia) => { const x = d.por_dia.find((y) => y.dia === dia); return { etiqueta: DIAS[dia], Atendidas: (x?.n ?? 0) - (x?.nadie_contesto ?? 0), "Nadie contestó": x?.nadie_contesto ?? 0 }; });
  const maxEquipo = Math.max(1, ...d.equipos.map((e) => e.n));
  const maxObjecion = Math.max(1, ...d.objeciones.map((o) => o.n));
  const sinAnalisis = d.con_analisis === 0;
  const preguntasRepetidas = d.preguntas.filter((p) => p.n >= 2).length;

  return (
    <div className="space-y-4">
      {recortado && <p className="text-xs text-tenue">Un periodo de más de {TOPE_DIAS} días cuenta solo los últimos {TOPE_DIAS}: del {fecha(d.desde)} al {fecha(d.hasta)}.</p>}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Cifra titulo="Llamadas" valor={<span className="cifra">{numero(d.llamadas)}</span>} explica={GLOSARIO.llamadasConAnalisis}
          detalle={`${numero(d.con_analisis)} con análisis del conmutador`} />
        <Cifra titulo="Nadie contestó" valor={<span className="cifra">{numero(d.nadie_contesto)}</span>} explica={GLOSARIO.nadieContesto}
          detalle={`${porcentaje(d.nadie_contesto / d.llamadas, 0)} de las llamadas`} />
        <Cifra titulo="Preguntas sin respuesta" valor={<span className="cifra">{numero(d.preguntas.length)}</span>} explica={GLOSARIO.preguntaSinRespuesta}
          detalle={preguntasRepetidas ? `${numero(preguntasRepetidas)} se repitieron en 2 llamadas o más` : "ninguna se repitió"} />
        <Cifra titulo="El reconocedor dudó" valor={<span className="cifra">{d.pct_stt_dudoso == null ? "—" : porcentaje(d.pct_stt_dudoso / 100, 0)}</span>} explica={GLOSARIO.sttDudoso}
          detalle={sinAnalisis ? "sin llamadas con análisis" : `${numero(d.stt_dudoso)} de ${numero(d.con_analisis)} llamadas con análisis`} />
      </div>

      <TarjetaGrafica titulo="Llamadas por semana" explica={GLOSARIO.nadieContesto}
        descripcion="Cuántas entraron cada semana y cuántas de esas nadie contestó"
        acciones={<Leyenda series={[{ nombre: "Atendidas", color: SERIE(1) }, { nombre: "Nadie contestó", color: SERIE(2) }]} />}
        tabla={<TablaSimple filas={semanas} primera="Semana del" />}>
        <Barras datos={semanas} alto="h-56" />
      </TarjetaGrafica>

      {sinAnalisis ? (
        <div className="tarjeta">
          <Vacio icono={PhoneOff} titulo="Las llamadas de este periodo todavía no traen análisis"
            texto="Qué piden, qué no se supo contestar y qué objetan llega del conmutador cuando termina de analizar cada llamada. Si nunca llega, revisa que el conmutador tenga el análisis prendido." />
        </div>
      ) : (<>
        <div className="grid gap-4 lg:grid-cols-2">
          <TarjetaGrafica titulo="Equipos más pedidos" explica={GLOSARIO.equiposPedidos} descripcion="En cuántas llamadas se pidió cada uno; la rayita, semana a semana">
            {d.equipos.length ? (
              <ol className="px-5 pb-5 space-y-3">
                {d.equipos.map((e) => {
                  const serie = d.semanas.map((s) => ({ n: e.semanas?.find((x) => x.semana === s.semana)?.n ?? 0 }));
                  return (
                    <li key={e.grupo} className="flex items-center gap-3">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-baseline justify-between gap-3 text-sm">
                          <span className="min-w-0 truncate">
                            {e.articulo_id ? <Link to={`/catalogo?articulo=${e.articulo_id}`} className="font-medium hover:underline">{e.nombre}</Link>
                              : <span className="font-medium">{e.nombre}</span>}
                            {e.clave && <span className="text-xs text-tenue cifra"> · {e.clave}</span>}
                          </span>
                          <span className="cifra font-medium">{numero(e.n)}</span>
                        </div>
                        <BarraRanking valor={e.n} max={maxEquipo} />
                      </div>
                      <div className="h-7 w-20 shrink-0" aria-hidden="true">
                        {serie.length > 1 && (
                          <ResponsiveContainer>
                            <LineChart data={serie} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
                              <Line dataKey="n" stroke={SERIE(1)} strokeWidth={1.5} dot={false} isAnimationActive={false} />
                            </LineChart>
                          </ResponsiveContainer>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            ) : <p className="px-5 pb-5 text-sm text-tenue">En este periodo no se mencionó ningún equipo.</p>}
          </TarjetaGrafica>

          <TarjetaGrafica titulo="Preguntas sin respuesta" explica={GLOSARIO.preguntaSinRespuesta}
            descripcion="Lo que se preguntó y no se supo contestar, junto si se dijo con otras palabras. Lo que se repite suele faltar en el catálogo o en precios.">
            {d.preguntas.length ? (
              <ul className="px-5 pb-5 divide-y divide-borde">
                {d.preguntas.map((p) => (
                  <li key={p.clave} className="py-2 flex items-start gap-3 text-sm">
                    <span className="min-w-0 flex-1 break-words">{p.ejemplo}<span className="block text-xs text-tenue">la última {hace(p.ultima)}</span></span>
                    <Insignia tono={p.n >= 2 ? "aviso" : "neutro"} className="cifra">{numero(p.n)} {p.n === 1 ? "llamada" : "llamadas"}</Insignia>
                  </li>
                ))}
              </ul>
            ) : <p className="px-5 pb-5 text-sm text-tenue">Todo lo que preguntaron se supo contestar.</p>}
          </TarjetaGrafica>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <TarjetaGrafica titulo="Objeciones" explica={GLOSARIO.objecionLlamada} descripcion="Lo que frenó a quien llamó, con ejemplos de cómo lo dijo">
            {d.objeciones.length ? (
              <ul className="px-5 pb-5 space-y-3">
                {d.objeciones.map((o) => (
                  <li key={o.categoria ?? "sin"} className="space-y-1">
                    <div className="flex items-baseline justify-between gap-3 text-sm"><span className="font-medium">{legible(OBJECION, o.categoria)}</span><span className="cifra">{numero(o.n)}</span></div>
                    <BarraRanking valor={o.n} max={maxObjecion} />
                    {/* Dicho igual varias veces, se muestra una. */}
                    {[...new Set(o.ejemplos ?? [])].map((t) => <p key={t} className="text-xs text-tenue italic break-words">«{t}»</p>)}
                  </li>
                ))}
              </ul>
            ) : <p className="px-5 pb-5 text-sm text-tenue">Nadie puso objeciones en este periodo.</p>}
          </TarjetaGrafica>
          <TarjetaGrafica titulo="En qué terminaron" explica={GLOSARIO.desenlaceLlamada} descripcion="De las llamadas con análisis">
            <Ranking filas={d.desenlaces.map((x) => ({ texto: legible(DESENLACE, x.desenlace), n: x.n }))} total={d.con_analisis} />
          </TarjetaGrafica>
          <TarjetaGrafica titulo="Para qué llamaron" explica={GLOSARIO.intencionLlamada} descripcion="De las llamadas con análisis">
            <Ranking filas={d.intenciones.map((x) => ({ texto: legible(INTENCION, x.intencion), n: x.n }))} total={d.con_analisis} />
          </TarjetaGrafica>
        </div>
      </>)}

      <div className="grid gap-4 lg:grid-cols-2">
        <TarjetaGrafica titulo="Llamadas por hora" explica={GLOSARIO.llamadasPorHoraDia} descripcion="Hora de la planta; arriba de cada barra, las que nadie contestó"
          acciones={<Leyenda series={[{ nombre: "Atendidas", color: SERIE(1) }, { nombre: "Nadie contestó", color: SERIE(2) }]} />}
          tabla={<TablaSimple filas={porHora} primera="Hora" />}>
          <Barras datos={porHora} alto="h-56" />
        </TarjetaGrafica>
        <TarjetaGrafica titulo="Llamadas por día" explica={GLOSARIO.llamadasPorHoraDia} descripcion="Día de la semana; arriba de cada barra, las que nadie contestó"
          acciones={<Leyenda series={[{ nombre: "Atendidas", color: SERIE(1) }, { nombre: "Nadie contestó", color: SERIE(2) }]} />}
          tabla={<TablaSimple filas={porDia} primera="Día" />}>
          <Barras datos={porDia} alto="h-56" />
        </TarjetaGrafica>
      </div>
    </div>
  );
}

type Fila = { etiqueta: string; Atendidas: number; "Nadie contestó": number };

/** Barras apiladas de dos series (atendidas y nadie contestó), un solo eje. */
function Barras({ datos, alto }: { datos: Fila[]; alto: string }) {
  return (
    <div className={`${alto} px-2 pb-4`}>
      <ResponsiveContainer>
        <BarChart data={datos} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--rejilla)" />
          <XAxis dataKey="etiqueta" {...ejeProps} interval="preserveStartEnd" minTickGap={16} />
          <YAxis {...ejeProps} width={32} allowDecimals={false} />
          <Tooltip cursor={{ fill: "var(--rejilla)" }} content={<TooltipGrafica formato={(v) => numero(v)} />} />
          <Bar dataKey="Atendidas" stackId="a" fill={SERIE(1)} isAnimationActive={false} />
          <Bar dataKey="Nadie contestó" stackId="a" fill={SERIE(2)} radius={[3, 3, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function TablaSimple({ filas, primera }: { filas: Fila[]; primera: string }) {
  return (
    <div className="px-3 pb-3 overflow-x-auto max-h-72">
      <table className="tabla">
        <thead><tr><th>{primera}</th><th className="text-right">Atendidas</th><th className="text-right">Nadie contestó</th><th className="text-right">Total</th></tr></thead>
        <tbody>{filas.map((f) => (
          <tr key={f.etiqueta}><td>{f.etiqueta}</td><td className="text-right cifra">{numero(f.Atendidas)}</td>
            <td className="text-right cifra">{numero(f["Nadie contestó"])}</td><td className="text-right cifra">{numero(f.Atendidas + f["Nadie contestó"])}</td></tr>
        ))}</tbody>
      </table>
    </div>
  );
}

function Ranking({ filas, total }: { filas: { texto: string; n: number }[]; total: number }) {
  const max = Math.max(1, ...filas.map((f) => f.n));
  return (
    <ul className="px-5 pb-5 space-y-3">
      {filas.map((f) => (
        <li key={f.texto} className="space-y-1">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0">{f.texto}</span>
            <span className="cifra whitespace-nowrap">{numero(f.n)} <span className="text-tenue">· {porcentaje(total ? f.n / total : null, 0)}</span></span>
          </div>
          <BarraRanking valor={f.n} max={max} />
        </li>
      ))}
    </ul>
  );
}

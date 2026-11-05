import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, Bot, Clock, PencilLine, Users } from "lucide-react";
import { Pagina } from "@/components/layout/Shell";
import { Kpi } from "@/components/ui/kpi";
import { Insignia } from "@/components/ui/insignia";
import { Lateral } from "@/components/ui/dialogo";
import { Cargando } from "@/components/ui/estados";
import { TablaDatos, Filtro, type Columna } from "@/components/datos/TablaDatos";
import { SERIE, TooltipGrafica, ejeProps } from "@/components/graficas/comunes";
import { supabase } from "@/lib/supabase";
import { q } from "@/lib/consultas";
import { fecha, fechaYHora, hace, numero } from "@/lib/formato";
import { NOMBRE_ROL, type Rol } from "@/lib/sesion";
import { CALENDARIO, INICIO, MENU, PENDIENTES, REVISION, SEMANA } from "@/navegacion";
import { nombreTabla } from "./componentes/diff";
import { GLOSARIO } from "@/tutorial/glosario";

interface UsoUsuario {
  id: string; nombre: string; correo: string; roles: Rol[]; activo: boolean; ultimo_acceso: string | null; ultima_actividad: string | null;
  dias_activos: number; minutos: number; vistas: number; pantallas: number; cambios: number; consultas_ia: number;
  pendientes_abiertos: number; pendientes_vencidos: number; avisos_sin_leer: number;
}
interface DetalleUso {
  por_dia: { dia: string; minutos: number; vistas: number; cambios: number; ia: number }[];
  pantallas: { ruta: string; vistas: number; minutos: number; dias: number; ultima: string }[];
  cambios: { tabla: string; altas: number; cambios: number; bajas: number }[];
  ia: { modo: string; n: number }[];
  horas: { hora: number; n: number }[];
}

type Periodo = "7" | "30" | "90";
type Vista = "personas" | "sin_uso" | "todos";
const APARATOS: Rol[] = ["pantalla", "terminal"];
const esAparato = (u: UsoUsuario) => u.roles.length > 0 && u.roles.every((r) => APARATOS.includes(r));

const hoyMx = () => new Date(new Date().toLocaleString("en-US", { timeZone: "America/Mexico_City" }));
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
function rango(p: Periodo) {
  const h = hoyMx(); const d = new Date(h); d.setDate(h.getDate() - Number(p) + 1);
  return { desde: iso(d), hasta: iso(h) };
}

/** «3 h 25 min», «40 min», «—». */
export function tiempo(min: number) {
  if (!min) return "—";
  const h = Math.floor(min / 60), m = min % 60;
  return h ? `${h} h${m ? ` ${m} min` : ""}` : `${m} min`;
}

// El nombre de cada pantalla, como en el menú; las de detalle («/ventas/cotizaciones/:id») salen como «Cotizaciones · detalle».
const RUTAS = new Map([...MENU.flatMap((s) => s.entradas), INICIO, PENDIENTES, REVISION, CALENDARIO, SEMANA].map((e) => [e.ruta, e.texto]));
const EXTRA: Record<string, string> = { "/piso": "TV del taller", "/produccion/terminal": "Terminal de piso", "/servicio/reportar": "Reportar falla" };
export function nombrePantalla(ruta: string) {
  if (RUTAS.has(ruta)) return RUTAS.get(ruta)!;
  if (EXTRA[ruta]) return EXTRA[ruta];
  const base = ruta.replace(/\/:id.*$/, "");
  if (base !== ruta && RUTAS.has(base)) return `${RUTAS.get(base)} · detalle`;
  return ruta;
}

const MODO_IA: Record<string, string> = {
  chat: "Preguntas al asistente", resumen: "Resumen de su área", semana: "Su semana", redactar: "Mensajes a clientes",
  mensaje_seguimiento: "Mensajes de seguimiento", mensaje_lead: "Mensajes a leads", respuesta_ml: "Respuestas de Mercado Libre",
  pulir_descripcion: "Descripciones del catálogo", leer_documento: "Leer documentos", correos_embarque: "Correos de embarques", mejoras: "Ideas de mejora",
};

export default function UsoErp() {
  const [periodo, setPeriodo] = useState<Periodo>("30");
  const [vista, setVista] = useState<Vista>("personas");
  const [abierto, setAbierto] = useState<UsoUsuario | null>(null);
  const { desde, hasta } = rango(periodo);
  const uso = useQuery({
    queryKey: ["uso_por_usuario", desde, hasta],
    queryFn: () => q<UsoUsuario[]>(supabase.rpc("uso_por_usuario", { p_desde: desde, p_hasta: hasta })),
  });
  const todos = uso.data ?? [];
  const personas = todos.filter((u) => u.activo && !esAparato(u));
  const sinUso = personas.filter((u) => u.dias_activos === 0);
  const filas = vista === "sin_uso" ? sinUso : vista === "todos" ? todos : personas;
  const suma = (k: keyof UsoUsuario) => personas.reduce((s, u) => s + Number(u[k] ?? 0), 0);

  const columnas: Columna<UsoUsuario>[] = [
    { clave: "nombre", titulo: "Persona", valor: (u) => `${u.nombre} ${u.correo}`,
      celda: (u) => <div className="min-w-[200px]"><p className="font-medium">{u.nombre}</p>
        <p className="text-xs text-tenue truncate">{u.roles.map((r) => NOMBRE_ROL[r] ?? r).join(", ") || "Sin rol"}{!u.activo && " · cuenta desactivada"}</p></div> },
    { clave: "ultima_actividad", titulo: "Último uso", explica: GLOSARIO.ultimoUsoErp, valor: (u) => u.ultima_actividad ?? "",
      celda: (u) => u.ultima_actividad ? <span title={fechaYHora(u.ultima_actividad)}>{hace(u.ultima_actividad)}</span> : <span className="text-tenue">Sin uso</span> },
    { clave: "dias_activos", titulo: "Días que lo usó", explica: GLOSARIO.diasActivosErp, alinear: "der", clase: "cifra" },
    { clave: "minutos", titulo: "Tiempo activo", explica: GLOSARIO.tiempoActivoErp, alinear: "der", celda: (u) => <span className="cifra">{tiempo(u.minutos)}</span> },
    { clave: "vistas", titulo: "Pantallas abiertas", alinear: "der", valor: (u) => u.vistas,
      celda: (u) => u.vistas ? <span className="cifra">{numero(u.vistas)}<span className="text-tenue text-xs"> · {u.pantallas} {u.pantallas === 1 ? "distinta" : "distintas"}</span></span> : <span className="text-tenue">—</span> },
    { clave: "cambios", titulo: "Cambios", explica: GLOSARIO.cambiosErp, alinear: "der", clase: "cifra" },
    { clave: "consultas_ia", titulo: "IA", alinear: "der", clase: "cifra" },
    { clave: "pendientes_vencidos", titulo: "Pendientes vencidos", alinear: "der",
      celda: (u) => u.pendientes_vencidos ? <span className="cifra text-peligro font-medium">{u.pendientes_vencidos}</span> : <span className="text-tenue">—</span> },
    { clave: "avisos_sin_leer", titulo: "Avisos sin leer", alinear: "der", clase: "cifra" },
  ];

  return (
    <Pagina titulo="Uso del ERP" descripcion="Quién usa el ERP, cuánto y en qué: para acompañar a quien se está quedando en la hoja o en el papel.">
      {uso.isLoading ? <Cargando filas={6} /> : (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi titulo="Personas que lo usaron" icono={Users} valor={`${personas.length - sinUso.length} de ${personas.length}`}
              detalle={sinUso.length ? `${sinUso.length} sin usarlo en el periodo` : "Todas lo usaron"} tono={sinUso.length ? "aviso" : "ok"}
              alClic={sinUso.length ? () => setVista("sin_uso") : undefined} explica={GLOSARIO.diasActivosErp} />
            <Kpi titulo="Tiempo activo" icono={Clock} valor={tiempo(suma("minutos"))} detalle="Entre todas las personas" explica={GLOSARIO.tiempoActivoErp} />
            <Kpi titulo="Cambios registrados" icono={PencilLine} valor={numero(suma("cambios"))} detalle="Altas, cambios y bajas" explica={GLOSARIO.cambiosErp} />
            <Kpi titulo="Consultas a la IA" icono={Bot} valor={numero(suma("consultas_ia"))} detalle="Asistente, mensajes, resúmenes" />
          </div>
          <TablaDatos filas={filas} columnas={columnas} cargando={uso.isLoading} error={uso.error} claveFila={(u) => u.id}
            alClicFila={setAbierto} exportarComo="uso-del-erp" placeholder="Buscar persona o rol…"
            filtros={<>
              <Filtro<Periodo> valor={periodo} alCambiar={setPeriodo} opciones={[{ valor: "7", texto: "7 días" }, { valor: "30", texto: "30 días" }, { valor: "90", texto: "90 días" }]} />
              <Filtro<Vista> valor={vista} alCambiar={setVista} opciones={[
                { valor: "personas", texto: "Personas", cuenta: personas.length },
                { valor: "sin_uso", texto: "Sin usarlo", cuenta: sinUso.length },
                { valor: "todos", texto: "Todas las cuentas", cuenta: todos.length },
              ]} />
            </>}
            vacio={{ icono: Activity, titulo: vista === "sin_uso" ? "Todos lo usaron en el periodo" : "Sin cuentas", texto: undefined }} />
          <p className="text-xs text-tenue">El tiempo activo y las pantallas se cuentan desde el 5 de noviembre de 2026; los cambios y las consultas a la IA traen su historia de antes. «Todas las cuentas» incluye las desactivadas y las de la TV y la tablet del taller.</p>
        </div>
      )}
      <DetalleUso u={abierto} desde={desde} hasta={hasta} alCerrar={() => setAbierto(null)} />
    </Pagina>
  );
}

function DetalleUso({ u, desde, hasta, alCerrar }: { u: UsoUsuario | null; desde: string; hasta: string; alCerrar: () => void }) {
  const detalle = useQuery({
    queryKey: ["uso_de_usuario", u?.id, desde, hasta], enabled: !!u,
    queryFn: () => q<DetalleUso>(supabase.rpc("uso_de_usuario", { p_usuario: u!.id, p_desde: desde, p_hasta: hasta })),
  });
  const d = detalle.data;
  const porDia = useMemo(() => (d?.por_dia ?? []).map((x) => ({ ...x, etiqueta: fecha(x.dia).slice(0, 6) })), [d]);
  const horas = useMemo(() => Array.from({ length: 17 }, (_, i) => i + 6).map((h) => ({ hora: `${h}:00`, n: d?.horas.find((x) => x.hora === h)?.n ?? 0 })), [d]);
  return (
    <Lateral abierto={!!u} alCambiar={(v) => !v && alCerrar()} ancho="max-w-3xl" titulo={u?.nombre ?? ""}
      subtitulo={u && <span>{u.roles.map((r) => NOMBRE_ROL[r] ?? r).join(", ")} · {u.ultimo_acceso ? `entró por última vez ${hace(u.ultimo_acceso)}` : "nunca ha entrado"}</span>}>
      {!u ? null : detalle.isLoading || !d ? <Cargando filas={5} /> : (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2 text-sm">
            <Insignia tono="info">{u.dias_activos} {u.dias_activos === 1 ? "día" : "días"} con uso</Insignia>
            <Insignia tono="neutro">{tiempo(u.minutos)} activo</Insignia>
            <Insignia tono="neutro">{numero(u.cambios)} cambios</Insignia>
            <Insignia tono="neutro">{numero(u.consultas_ia)} consultas a la IA</Insignia>
            {u.pendientes_abiertos > 0 && <Insignia tono={u.pendientes_vencidos ? "peligro" : "neutro"}>{u.pendientes_abiertos} pendientes abiertos{u.pendientes_vencidos ? `, ${u.pendientes_vencidos} vencidos` : ""}</Insignia>}
          </div>

          <section className="space-y-2" data-explain={GLOSARIO.tiempoActivoErp} data-explain-title="Tiempo activo por día">
            <h4 className="font-medium">Tiempo activo por día</h4>
            <div className="h-44">
              <ResponsiveContainer>
                <BarChart data={porDia} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--rejilla)" />
                  <XAxis dataKey="etiqueta" {...ejeProps} interval="preserveStartEnd" minTickGap={12} />
                  <YAxis {...ejeProps} allowDecimals={false} />
                  <Tooltip cursor={{ fill: "var(--rejilla)" }} content={<TooltipGrafica formato={(v) => tiempo(v)} />} />
                  <Bar dataKey="minutos" name="Tiempo activo" fill={SERIE(1)} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="space-y-2" data-explain={GLOSARIO.cambiosErp} data-explain-title="Cambios por día">
            <h4 className="font-medium">Cambios por día</h4>
            <div className="h-32">
              <ResponsiveContainer>
                <BarChart data={porDia} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--rejilla)" />
                  <XAxis dataKey="etiqueta" {...ejeProps} interval="preserveStartEnd" minTickGap={12} />
                  <YAxis {...ejeProps} allowDecimals={false} />
                  <Tooltip cursor={{ fill: "var(--rejilla)" }} content={<TooltipGrafica formato={(v) => numero(v)} />} />
                  <Bar dataKey="cambios" name="Cambios" fill={SERIE(2)} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="space-y-2">
            <h4 className="font-medium">Pantallas que más usa</h4>
            {d.pantallas.length === 0 ? <p className="text-sm text-tenue">Todavía no hay pantallas registradas en este periodo.</p> : (
              <table className="tabla rounded-xl border border-borde overflow-hidden">
                <thead><tr><th>Pantalla</th><th className="text-right">Tiempo activo</th><th className="text-right">Veces</th><th className="text-right">Días</th><th>Última vez</th></tr></thead>
                <tbody>
                  {d.pantallas.slice(0, 15).map((p) => (
                    <tr key={p.ruta}><td>{nombrePantalla(p.ruta)}</td><td className="text-right cifra">{tiempo(p.minutos)}</td>
                      <td className="text-right cifra">{p.vistas}</td><td className="text-right cifra">{p.dias}</td><td className="text-tenue whitespace-nowrap">{hace(p.ultima)}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="space-y-2">
            <h4 className="font-medium">En qué hizo cambios</h4>
            {d.cambios.length === 0 ? <p className="text-sm text-tenue">Sin cambios registrados en este periodo.</p> : (
              <table className="tabla rounded-xl border border-borde overflow-hidden">
                <thead><tr><th>Qué</th><th className="text-right">Altas</th><th className="text-right">Cambios</th><th className="text-right">Bajas</th></tr></thead>
                <tbody>
                  {d.cambios.slice(0, 15).map((c) => (
                    <tr key={c.tabla}><td>{nombreTabla(c.tabla)}</td><td className="text-right cifra">{c.altas || "—"}</td>
                      <td className="text-right cifra">{c.cambios || "—"}</td><td className="text-right cifra">{c.bajas || "—"}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <div className="grid gap-6 sm:grid-cols-2">
            <section className="space-y-2">
              <h4 className="font-medium">Para qué usa la IA</h4>
              {d.ia.length === 0 ? <p className="text-sm text-tenue">No la usó en este periodo.</p> : (
                <ul className="text-sm space-y-1">{d.ia.map((x) => <li key={x.modo} className="flex justify-between gap-3"><span>{MODO_IA[x.modo] ?? x.modo}</span><span className="cifra">{x.n}</span></li>)}</ul>
              )}
            </section>
            <section className="space-y-2" data-explain={GLOSARIO.horasUsoErp} data-explain-title="A qué horas lo usa">
              <h4 className="font-medium">A qué horas lo usa</h4>
              <div className="h-32">
                <ResponsiveContainer>
                  <BarChart data={horas} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                    <XAxis dataKey="hora" {...ejeProps} interval={2} />
                    <YAxis {...ejeProps} allowDecimals={false} hide />
                    <Tooltip cursor={{ fill: "var(--rejilla)" }} content={<TooltipGrafica formato={(v) => numero(v)} />} />
                    <Bar dataKey="n" name="Movimientos" fill={SERIE(1)} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>
        </div>
      )}
    </Lateral>
  );
}

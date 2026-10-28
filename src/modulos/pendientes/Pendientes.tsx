// Mis pendientes: lo que me toca y lo que pedí. Reemplaza el "??" del chat:
// quien pidió algo ve si ya se hizo, y lo vencido se ve en rojo y avisa solo.
// Arriba, cada quien ve su propio cumplimiento (y a cuántos detiene); dirección y Recursos
// Humanos ven además el de todos en «Equipo». Los números salen de la base.
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Check, CheckCircle2, Clock, Hourglass, ListTodo, Timer, Users, X } from "lucide-react";
import { Pagina } from "@/components/layout/Shell";
import { Boton } from "@/components/ui/boton";
import { Dialogo } from "@/components/ui/dialogo";
import { Insignia } from "@/components/ui/insignia";
import { Kpi } from "@/components/ui/kpi";
import { Cargando, ErrorCarga, Vacio } from "@/components/ui/estados";
import { TablaDatos, type Columna } from "@/components/datos/TablaDatos";
import { NuevoPendiente } from "@/components/avisos/NuevoPendiente";
import { supabase } from "@/lib/supabase";
import { q, useAccion, useTiempoReal } from "@/lib/consultas";
import { useSesion } from "@/lib/sesion";
import { fecha, hace, hoyISO, numero, porcentaje } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { GLOSARIO } from "@/tutorial/glosario";

type Estado = "abierto" | "hecho" | "cancelado" | "cubierto";
interface Pendiente {
  id: string; titulo: string; detalle: string | null; vence: string | null; estado: Estado;
  ruta: string | null; nota_cierre: string | null; creado_en: string; cerrado_en: string | null;
  responsable_id: string; creado_por: string; grupo_id: string | null; modo: "uno" | "todos" | null;
  responsable: { nombre: string } | null; creador: { nombre: string } | null;
}
interface Cumplimiento {
  persona_id: string; persona: string; abiertos: number; vencidos: number; cerrados: number; a_tiempo: number; tarde: number;
  sin_fecha: number; dias_promedio: number | null; esperan: number; dias_retraso: number; pidio: number; pidio_abiertos: number;
}
type Vista = "mios" | "pedidos" | "cerrados" | "equipo";

/** A tiempo entre lo que tenía fecha: cerrados a tiempo contra tarde y lo que hoy sigue vencido. */
const pctATiempo = (c: Pick<Cumplimiento, "a_tiempo" | "tarde" | "vencidos">) => {
  const base = c.a_tiempo + c.tarde + c.vencidos;
  return base ? c.a_tiempo / base : null;
};
const MODO = { uno: "basta con que uno lo haga", todos: "cada quien lo tiene que hacer" } as const;

export default function Pendientes() {
  const { perfil, puede, tieneRol } = useSesion();
  const supervisa = tieneRol("direccion") || puede("rrhh", 3);
  const [vista, setVista] = useState<Vista>("mios");
  const [cerrando, setCerrando] = useState<Pendiente | null>(null);
  const lista = useQuery({
    queryKey: ["pendientes", supervisa],
    queryFn: () => q<Pendiente[]>(supabase.from("pendientes")
      .select("*, responsable:perfiles!pendientes_responsable_id_fkey(nombre), creador:perfiles!pendientes_creado_por_fkey(nombre)")
      .order("vence", { ascending: true, nullsFirst: false }).order("creado_en", { ascending: false }).limit(supervisa ? 1500 : 300)),
  });
  const mio = useQuery({
    queryKey: ["pendientes", "mi_cumplimiento"],
    queryFn: async () => (await q<Cumplimiento[]>(supabase.rpc("mi_cumplimiento_pendientes")))[0] ?? null,
  });
  useTiempoReal("pendientes", [["pendientes"]]);
  const cancelar = useAccion((p: Pendiente) => {
    // Un pedido a varios se cancela completo: lo que siga abierto de su grupo.
    const c = supabase.from("pendientes").update({ estado: "cancelado" }).eq("estado", "abierto").eq("creado_por", perfil!.id);
    return q(p.grupo_id ? c.eq("grupo_id", p.grupo_id).select("id") : c.eq("id", p.id).select("id"));
  }, { exito: "Pendiente cancelado", invalidar: [["pendientes"]] });

  const hoy = hoyISO();
  const todos = lista.data ?? [];
  const mios = todos.filter((p) => p.estado === "abierto" && p.responsable_id === perfil?.id);
  // Lo que pedí, uno por pedido: los de un grupo van juntos aunque sean varias filas.
  const pedidos = useMemo(() => {
    const grupos = new Map<string, Pendiente[]>();
    for (const p of todos) {
      if (p.creado_por !== perfil?.id || p.responsable_id === perfil?.id) continue;
      const k = p.grupo_id ?? p.id;
      grupos.set(k, [...(grupos.get(k) ?? []), p]);
    }
    return [...grupos.values()].filter((g) => g.some((p) => p.estado === "abierto"));
  }, [todos, perfil?.id]);
  const cerrados = todos.filter((p) => p.estado !== "abierto" && (p.responsable_id === perfil?.id || p.creado_por === perfil?.id));
  const vencidos = mios.filter((p) => p.vence && p.vence < hoy).length;

  const pestanas: [Vista, string, number | null][] = [["mios", "Me tocan", mios.length], ["pedidos", "Los que pedí", pedidos.length], ["cerrados", "Cerrados", cerrados.length]];
  if (supervisa) pestanas.push(["equipo", "Equipo", null]);

  return (
    <Pagina titulo="Pendientes" descripcion="Lo que te toca y lo que pediste a otros. Cuando alguien termina, a quien lo pidió le llega un aviso."
      acciones={<NuevoPendiente />}>
      <MiCumplimiento c={mio.data ?? null} cargando={mio.isLoading} />

      <div className="flex flex-wrap gap-2">
        {pestanas.map(([v, t, n]) => (
          <button key={v} onClick={() => setVista(v)} data-explain={v === "equipo" ? GLOSARIO.cumplimientoEquipo : undefined} data-explain-title={v === "equipo" ? "Equipo" : undefined}
            className={cn("h-9 px-3.5 rounded-full border text-sm inline-flex items-center gap-2 transition",
              vista === v ? "bg-marca text-white border-marca" : "border-borde hover:border-marca/40")}>
            {v === "equipo" && <Users className="h-4 w-4" />}{t}
            {n != null && <span className={cn("cifra text-xs", vista === v ? "text-white/80" : "text-tenue")}>{n}</span>}
          </button>
        ))}
        {vencidos > 0 && <span className="self-center" data-explain={GLOSARIO.vencido}><Insignia tono="peligro">{vencidos} vencido{vencidos === 1 ? "" : "s"}</Insignia></span>}
      </div>

      {vista === "equipo" ? <Equipo todos={todos} /> : lista.error ? <ErrorCarga error={lista.error} /> : lista.isLoading ? <Cargando filas={5} /> : (
        vista === "pedidos" ? (
          pedidos.length === 0 ? <Vacio icono={ListTodo} titulo="No has pedido nada"
            texto="Desde un pedido, una orden o aquí mismo, pídele algo a una o varias personas con fecha: les llega un aviso y tú ves cuándo lo terminan." />
            : <div className="tarjeta divide-y divide-borde">{pedidos.map((g) => <FilaPedido key={g[0].grupo_id ?? g[0].id} grupo={g} hoy={hoy} alCancelar={() => cancelar.mutate(g[0])} />)}</div>
        ) : (vista === "mios" ? mios : cerrados).length === 0 ? (
          <Vacio icono={vista === "mios" ? CheckCircle2 : ListTodo} titulo={vista === "mios" ? "Nada pendiente" : "Nada cerrado todavía"}
            texto="Cuando alguien te asigne algo, aparece aquí y en la campana." />
        ) : (
          <div className="tarjeta divide-y divide-borde">
            {(vista === "mios" ? mios : cerrados).map((p, i) => (
              <FilaPendiente key={p.id} p={p} i={i} hoy={hoy} yo={perfil?.id} conQuien={vista === "cerrados" && p.creado_por === perfil?.id ? "para" : "de"}
                alCerrar={() => setCerrando(p)} />
            ))}
          </div>
        )
      )}
      {cerrando && <Cerrar p={cerrando} alCerrar={() => setCerrando(null)} />}
    </Pagina>
  );
}

/** Tu cumplimiento en los últimos 30 días: lo ve cada quien de sí mismo. */
function MiCumplimiento({ c, cargando }: { c: Cumplimiento | null; cargando: boolean }) {
  if (cargando) return <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="tarjeta h-24 animate-pulse" />)}</div>;
  const pct = c ? pctATiempo(c) : null;
  const conFecha = c ? c.a_tiempo + c.tarde + c.vencidos : 0;
  return (
    <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
      <Kpi titulo="A tiempo (30 días)" icono={Clock} explica={GLOSARIO.pendientesATiempo}
        tono={pct == null ? "neutro" : pct >= 0.9 ? "ok" : pct >= 0.7 ? "aviso" : "peligro"}
        valor={pct == null ? "—" : porcentaje(pct, 0)}
        detalle={pct == null ? "Sin pendientes con fecha cerrados todavía" : `${c!.a_tiempo} de ${conFecha} con fecha`} />
      <Kpi titulo="Te esperan" icono={Users} explica={GLOSARIO.pendientesTeEsperan}
        tono={!c?.esperan ? "ok" : c.vencidos ? "peligro" : "marca"}
        valor={<span className="cifra">{c?.esperan ?? 0}</span>}
        detalle={!c?.esperan ? "Nadie espera nada de ti" : `${c.esperan === 1 ? "persona tiene" : "personas tienen"} algo abierto contigo`} />
      <Kpi titulo="Días de retraso" icono={Hourglass} explica={GLOSARIO.pendientesDiasRetraso}
        tono={c?.dias_retraso ? "peligro" : "ok"}
        valor={<span className="cifra">{c?.dias_retraso ?? 0}</span>}
        detalle={c?.vencidos ? `en ${c.vencidos} vencido${c.vencidos === 1 ? "" : "s"}` : "Nada vencido"} />
      <Kpi titulo="Días para cerrar" icono={Timer} explica={GLOSARIO.pendientesDiasCerrar} tono="info"
        valor={c?.dias_promedio != null ? <span className="cifra">{numero(Number(c.dias_promedio))}</span> : "—"}
        detalle={c?.cerrados ? `promedio de ${c.cerrados} cerrado${c.cerrados === 1 ? "" : "s"}` : "Sin cerrados en 30 días"} />
    </div>
  );
}

function FilaPendiente({ p, i, hoy, yo, conQuien, alCerrar }: {
  p: Pendiente; i: number; hoy: string; yo: string | undefined; conQuien: "de" | "para"; alCerrar: () => void;
}) {
  const vencido = p.estado === "abierto" && p.vence && p.vence < hoy;
  const esHoy = p.vence === hoy;
  return (
    <div className="flex items-start gap-3 p-4 animate-entrar" style={{ animationDelay: `${Math.min(i, 10) * 25}ms` }}>
      {p.estado === "abierto" && p.responsable_id === yo ? (
        <button onClick={alCerrar} title="Marcar como hecho"
          className="mt-0.5 h-5 w-5 shrink-0 rounded-full border-2 border-borde hover:border-ok hover:bg-ok-suave grid place-items-center transition">
          <Check className="h-3 w-3 text-ok opacity-0 hover:opacity-100" />
        </button>
      ) : <Marca estado={p.estado} />}
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm font-medium", p.estado !== "abierto" && "line-through text-tenue")}>{p.titulo}</p>
        {p.detalle && <p className="text-xs text-tenue mt-0.5 whitespace-pre-wrap">{p.detalle}</p>}
        <p className="text-xs text-tenue mt-1">
          {conQuien === "para" ? <>Para <b className="text-texto font-medium">{p.responsable?.nombre}</b></> : <>De {p.creador?.nombre}</>}
          {" · "}{hace(p.creado_en)}
          {p.modo && <> · <span data-explain={GLOSARIO.pendienteVarios} data-explain-title="A varias personas">a varias personas: {MODO[p.modo]}</span></>}
          {p.nota_cierre && <> · <span className="text-texto">“{p.nota_cierre}”</span></>}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {p.vence && p.estado === "abierto" && (
          <Insignia tono={vencido ? "peligro" : esHoy ? "aviso" : "neutro"}>{vencido ? "Venció " : esHoy ? "Hoy" : "Para "}{!esHoy && fecha(p.vence)}</Insignia>
        )}
        {p.ruta && <Link to={p.ruta} className="h-8 w-8 grid place-items-center rounded-lg hover:bg-fondo text-tenue" title="Ir"><ArrowRight className="h-4 w-4" /></Link>}
      </div>
    </div>
  );
}

function Marca({ estado }: { estado: Estado }) {
  return (
    <span className={cn("mt-0.5 h-5 w-5 shrink-0 rounded-full grid place-items-center",
      estado === "hecho" ? "bg-ok text-white" : estado === "cubierto" ? "bg-ok-suave text-ok" : estado === "cancelado" ? "bg-fondo text-tenue" : "border-2 border-dashed border-borde")}
      title={estado === "cubierto" ? "Lo hizo otra persona del grupo" : undefined}>
      {(estado === "hecho" || estado === "cubierto") && <Check className="h-3 w-3" />}{estado === "cancelado" && <X className="h-3 w-3" />}
    </span>
  );
}

/** Lo que pedí: uno por pedido, con quién lo tiene y cuántos ya terminaron. */
function FilaPedido({ grupo, hoy, alCancelar }: { grupo: Pendiente[]; hoy: string; alCancelar: () => void }) {
  const p = grupo[0];
  const vivos = grupo.filter((x) => x.estado !== "cancelado");
  const hechos = vivos.filter((x) => x.estado === "hecho").length;
  const vencido = p.vence && p.vence < hoy;
  return (
    <div className="flex items-start gap-3 p-4">
      <Marca estado="abierto" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{p.titulo}</p>
        {p.detalle && <p className="text-xs text-tenue mt-0.5 whitespace-pre-wrap">{p.detalle}</p>}
        <div className="flex flex-wrap items-center gap-1.5 mt-1.5 text-xs">
          <span className="text-tenue">Para</span>
          {vivos.map((x) => (
            <span key={x.id} className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5",
              x.estado === "hecho" ? "border-ok/30 bg-ok-suave text-ok" : "border-borde text-texto")}>
              {x.estado === "hecho" && <Check className="h-3 w-3" />}{x.responsable?.nombre}
            </span>
          ))}
          {p.modo && <span className="text-tenue" data-explain={GLOSARIO.pendienteVarios} data-explain-title="A varias personas">
            · {p.modo === "todos" ? `${hechos} de ${vivos.length} listos` : MODO.uno}</span>}
          <span className="text-tenue">· {hace(p.creado_en)}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {p.vence && <Insignia tono={vencido ? "peligro" : p.vence === hoy ? "aviso" : "neutro"}>{vencido ? "Venció " : p.vence === hoy ? "Hoy" : "Para "}{p.vence !== hoy && fecha(p.vence)}</Insignia>}
        {p.ruta && <Link to={p.ruta} className="h-8 w-8 grid place-items-center rounded-lg hover:bg-fondo text-tenue" title="Ir"><ArrowRight className="h-4 w-4" /></Link>}
        <button onClick={alCancelar} title={grupo.length > 1 ? "Cancelar para todos" : "Cancelar"} className="h-8 w-8 grid place-items-center rounded-lg hover:bg-fondo text-tenue"><X className="h-4 w-4" /></button>
      </div>
    </div>
  );
}

/** Para dirección y Recursos Humanos: el cumplimiento de cada quien y lo que tiene abierto. */
function Equipo({ todos }: { todos: Pendiente[] }) {
  const [dias, setDias] = useState(30);
  const [persona, setPersona] = useState<Cumplimiento | null>(null);
  const desde = useMemo(() => { const d = new Date(); d.setDate(d.getDate() - dias); return d.toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" }); }, [dias]);
  const datos = useQuery({
    queryKey: ["pendientes", "equipo", desde],
    queryFn: () => q<Cumplimiento[]>(supabase.rpc("cumplimiento_pendientes", { p_desde: desde })),
  });
  const hoy = hoyISO();
  const columnas: Columna<Cumplimiento>[] = [
    { clave: "persona", titulo: "Persona", celda: (c) => <span className="font-medium">{c.persona}</span> },
    { clave: "abiertos", titulo: "Abiertos", alinear: "der", sinBusqueda: true, celda: (c) => <span className="cifra">{c.abiertos}</span> },
    { clave: "vencidos", titulo: "Vencidos", alinear: "der", sinBusqueda: true, explica: GLOSARIO.vencido,
      celda: (c) => <span className={cn("cifra", c.vencidos > 0 && "text-peligro font-semibold")}>{c.vencidos}</span> },
    { clave: "dias_retraso", titulo: "Días de retraso", alinear: "der", sinBusqueda: true, explica: GLOSARIO.pendientesDiasRetraso,
      celda: (c) => <span className={cn("cifra", c.dias_retraso > 0 && "text-peligro")}>{c.dias_retraso}</span> },
    { clave: "esperan", titulo: "Le esperan", alinear: "der", sinBusqueda: true, explica: GLOSARIO.pendientesTeEsperan, celda: (c) => <span className="cifra">{c.esperan}</span> },
    { clave: "a_tiempo", titulo: "A tiempo", alinear: "der", sinBusqueda: true, explica: GLOSARIO.pendientesATiempo,
      valor: (c) => pctATiempo(c) ?? -1,
      celda: (c) => { const p = pctATiempo(c); return p == null ? <span className="text-tenue">—</span>
        : <span className={cn("cifra font-medium", p >= 0.9 ? "text-ok" : p >= 0.7 ? "text-aviso" : "text-peligro")}>{porcentaje(p, 0)}</span>; } },
    { clave: "cerrados", titulo: "Cerrados", alinear: "der", sinBusqueda: true, celda: (c) => <span className="cifra">{c.cerrados}</span> },
    { clave: "dias_promedio", titulo: "Días para cerrar", alinear: "der", sinBusqueda: true, explica: GLOSARIO.pendientesDiasCerrar,
      valor: (c) => c.dias_promedio ?? null, celda: (c) => c.dias_promedio != null ? <span className="cifra">{numero(Number(c.dias_promedio))}</span> : <span className="text-tenue">—</span> },
    { clave: "pidio", titulo: "Pidió", alinear: "der", sinBusqueda: true, explica: GLOSARIO.pendientesPidio,
      celda: (c) => <span className="cifra">{c.pidio}{c.pidio_abiertos > 0 && <span className="text-tenue"> · {c.pidio_abiertos} abiertos</span>}</span> },
  ];
  const suyos = persona ? todos.filter((p) => p.estado === "abierto" && (p.responsable_id === persona.persona_id || p.creado_por === persona.persona_id)) : [];
  return (
    <div className="space-y-4">
      <TablaDatos filas={datos.data} columnas={columnas} cargando={datos.isLoading} error={datos.error} claveFila={(c) => c.persona_id}
        exportarComo={`cumplimiento-pendientes-${dias}d`} placeholder="Buscar persona…" alClicFila={setPersona}
        claseFila={(c) => (c.persona_id === persona?.persona_id ? "bg-marca-suave" : undefined)}
        filtros={
          <div className="inline-flex rounded-lg border border-borde p-0.5 text-sm">
            {[30, 90, 180].map((d) => (
              <button key={d} onClick={() => setDias(d)} className={cn("px-3 h-8 rounded-md", dias === d ? "bg-marca text-white" : "text-tenue hover:text-texto")}>{d} días</button>
            ))}
          </div>
        }
        vacio={{ icono: Users, titulo: "Nadie tiene pendientes todavía", texto: "Cuando alguien le pida algo a otra persona, aquí sale su cumplimiento." }} />
      {persona && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Lo abierto de {persona.persona}</h3>
          {suyos.length === 0 ? <p className="text-sm text-tenue">Nada abierto.</p> : (
            <div className="tarjeta divide-y divide-borde">
              {suyos.map((p) => {
                const vencido = p.vence && p.vence < hoy;
                return (
                  <div key={p.id} className="flex items-start gap-3 p-3 text-sm">
                    <span className="min-w-0 flex-1">
                      <span className="font-medium">{p.titulo}</span>
                      <span className="block text-xs text-tenue">
                        {p.responsable_id === persona.persona_id ? <>Le toca · lo pidió <b className="text-texto font-medium">{p.creador?.nombre}</b></>
                          : <>Lo pidió · lo tiene <b className="text-texto font-medium">{p.responsable?.nombre}</b></>} · {hace(p.creado_en)}
                      </span>
                    </span>
                    {p.vence && <Insignia tono={vencido ? "peligro" : p.vence === hoy ? "aviso" : "neutro"}>{vencido ? "Venció " : p.vence === hoy ? "Hoy" : "Para "}{p.vence !== hoy && fecha(p.vence)}</Insignia>}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function Cerrar({ p, alCerrar }: { p: Pendiente; alCerrar: () => void }) {
  const [nota, setNota] = useState("");
  const hecho = useAccion(() => q(supabase.from("pendientes").update({ estado: "hecho", nota_cierre: nota.trim() || null }).eq("id", p.id).select("id").single()),
    { exito: "Listo: a quien lo pidió le llegó el aviso", invalidar: [["pendientes"]], alTerminar: alCerrar });
  return (
    <Dialogo abierto alCambiar={(a) => !a && alCerrar()} titulo="¿Ya quedó?" descripcion={p.titulo}
      pie={<><Boton variante="secundario" onClick={alCerrar}>Todavía no</Boton><Boton variante="exito" cargando={hecho.isPending} onClick={() => hecho.mutate(undefined)}><Check className="h-4 w-4" />Hecho</Boton></>}>
      <form onSubmit={(e) => { e.preventDefault(); hecho.mutate(undefined); }}>
        {p.modo === "uno" && <p className="text-xs text-tenue mb-2">Se lo pidieron a varias personas: al marcarlo hecho, a las demás se les cierra y se les avisa que lo hiciste tú.</p>}
        <label className="block">
          <span className="etiqueta">Respuesta para {p.creador?.nombre ?? "quien lo pidió"} (opcional)</span>
          <input autoFocus className="campo mt-1" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej. $12,400, entrega en 3 semanas" />
        </label>
      </form>
    </Dialogo>
  );
}

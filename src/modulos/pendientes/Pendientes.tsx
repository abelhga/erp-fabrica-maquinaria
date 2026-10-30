// Mis pendientes: lo que me toca y lo que pedí. Reemplaza el "??" del chat:
// quien pidió algo ve si ya se hizo, y lo vencido se ve en rojo y avisa solo.
// Arriba, cada quien ve su propio cumplimiento (y a cuántos detiene); dirección y Recursos
// Humanos ven además el de todos en «Equipo». Los números salen de la base.
// Cada pendiente abre su ficha (?pendiente=): ahí quien lo tiene pregunta lo que le falta para
// terminarlo y quien lo pidió contesta; mientras espera respuesta no cuenta como retraso suyo.
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Check, CheckCircle2, Clock, Hourglass, ListTodo, MessageCircleQuestion, Send, Timer, Users, X } from "lucide-react";
import { Pagina } from "@/components/layout/Shell";
import { Boton } from "@/components/ui/boton";
import { Dialogo, Lateral } from "@/components/ui/dialogo";
import { Insignia } from "@/components/ui/insignia";
import { Kpi } from "@/components/ui/kpi";
import { Cargando, ErrorCarga, Vacio } from "@/components/ui/estados";
import { TablaDatos, type Columna } from "@/components/datos/TablaDatos";
import { NuevoPendiente } from "@/components/avisos/NuevoPendiente";
import { supabase } from "@/lib/supabase";
import { q, useAccion, useTiempoReal } from "@/lib/consultas";
import { useSesion } from "@/lib/sesion";
import { fecha, fechaYHora, hace, hoyISO, numero, porcentaje } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { GLOSARIO } from "@/tutorial/glosario";

type Estado = "abierto" | "hecho" | "cancelado" | "cubierto";
interface Pendiente {
  id: string; titulo: string; detalle: string | null; vence: string | null; estado: Estado;
  ruta: string | null; nota_cierre: string | null; creado_en: string; cerrado_en: string | null;
  responsable_id: string; creado_por: string | null; grupo_id: string | null; modo: "uno" | "todos" | null;
  /** Quien lo tiene preguntó algo y espera a quien lo pidió: mientras, no cuenta como su retraso. */
  esperando_respuesta: boolean;
  responsable: { nombre: string } | null; creador: { nombre: string } | null;
}
/** El de la revisión nocturna no lo pidió una persona (no tiene creado_por). */
const quienPidio = (p: Pendiente) => p.creador?.nombre ?? (p.creado_por ? "…" : "Revisión nocturna");
interface Mensaje { id: number; pendiente_id: string; autor_id: string; texto: string; en: string; autor: { nombre: string } | null }
interface Cumplimiento {
  persona_id: string; persona: string; abiertos: number; vencidos: number; cerrados: number; a_tiempo: number; tarde: number;
  sin_fecha: number; dias_promedio: number | null; esperan: number; dias_retraso: number; pidio: number; pidio_abiertos: number;
  por_responder: number;
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
  // La ficha abierta va en la dirección: el aviso de una pregunta lleva directo a ella.
  const [params, setParams] = useSearchParams();
  const fichaId = params.get("pendiente");
  const abrir = (id: string | null) => {
    const n = new URLSearchParams(params);
    if (id) n.set("pendiente", id); else n.delete("pendiente");
    setParams(n, { replace: true });
  };
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
  const vencidos = mios.filter((p) => p.vence && p.vence < hoy && !p.esperando_respuesta).length;
  const porResponder = todos.filter((p) => p.estado === "abierto" && p.creado_por === perfil?.id && p.esperando_respuesta);
  const ficha = fichaId ? todos.find((p) => p.id === fichaId) ?? null : null;

  const pestanas: [Vista, string, number | null][] = [["mios", "Me tocan", mios.length], ["pedidos", "Los que pedí", pedidos.length], ["cerrados", "Cerrados", cerrados.length]];
  if (supervisa) pestanas.push(["equipo", "Equipo", null]);

  return (
    <Pagina titulo="Pendientes" descripcion="Lo que te toca y lo que pediste a otros. Cuando alguien termina, a quien lo pidió le llega un aviso."
      acciones={<NuevoPendiente />}>
      <MiCumplimiento c={mio.data ?? null} cargando={mio.isLoading} />
      {porResponder.length > 0 && (
        <button type="button" onClick={() => porResponder.length === 1 ? abrir(porResponder[0].id) : setVista("pedidos")}
          data-explain={GLOSARIO.pendienteEsperandoRespuesta} data-explain-title="Te preguntaron"
          className="w-full flex items-center gap-3 rounded-xl border border-aviso/40 bg-aviso-suave px-4 py-3 text-left text-sm hover:ring-1 hover:ring-aviso/40">
          <MessageCircleQuestion className="h-5 w-5 text-aviso shrink-0" />
          <span><b>{porResponder.length === 1 ? "Te preguntaron algo" : `Te preguntaron en ${porResponder.length} pendientes`}</b> de lo que pediste: hasta que contestes, no pueden avanzar
            {porResponder.length === 1 && <> («{porResponder[0].titulo}», {porResponder[0].responsable?.nombre})</>}.</span>
        </button>
      )}

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

      {vista === "equipo" ? <Equipo todos={todos} alAbrir={abrir} /> : lista.error ? <ErrorCarga error={lista.error} /> : lista.isLoading ? <Cargando filas={5} /> : (
        vista === "pedidos" ? (
          pedidos.length === 0 ? <Vacio icono={ListTodo} titulo="No has pedido nada"
            texto="Desde un pedido, una orden o aquí mismo, pídele algo a una o varias personas con fecha: les llega un aviso y tú ves cuándo lo terminan." />
            : <div className="tarjeta divide-y divide-borde">{pedidos.map((g) => <FilaPedido key={g[0].grupo_id ?? g[0].id} grupo={g} hoy={hoy} alCancelar={() => cancelar.mutate(g[0])} alAbrir={abrir} />)}</div>
        ) : (vista === "mios" ? mios : cerrados).length === 0 ? (
          <Vacio icono={vista === "mios" ? CheckCircle2 : ListTodo} titulo={vista === "mios" ? "Nada pendiente" : "Nada cerrado todavía"}
            texto="Cuando alguien te asigne algo, aparece aquí y en la campana." />
        ) : (
          <div className="tarjeta divide-y divide-borde">
            {(vista === "mios" ? mios : cerrados).map((p, i) => (
              <FilaPendiente key={p.id} p={p} i={i} hoy={hoy} yo={perfil?.id} conQuien={vista === "cerrados" && p.creado_por === perfil?.id ? "para" : "de"}
                alCerrar={() => setCerrando(p)} alAbrir={() => abrir(p.id)} />
            ))}
          </div>
        )
      )}
      {cerrando && <Cerrar p={cerrando} alCerrar={() => setCerrando(null)} />}
      <FichaPendiente p={ficha} cargando={!!fichaId && lista.isLoading} yo={perfil?.id} hoy={hoy} alCerrar={() => abrir(null)}
        alHecho={() => { if (ficha) setCerrando(ficha); }} alCancelar={() => { if (ficha) { cancelar.mutate(ficha); abrir(null); } }} />
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

function FilaPendiente({ p, i, hoy, yo, conQuien, alCerrar, alAbrir }: {
  p: Pendiente; i: number; hoy: string; yo: string | undefined; conQuien: "de" | "para"; alCerrar: () => void; alAbrir: () => void;
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
      <button type="button" onClick={alAbrir} className="min-w-0 flex-1 text-left hover:opacity-90" title="Abrir la ficha">
        <p className={cn("text-sm font-medium", p.estado !== "abierto" && "line-through text-tenue")}>{p.titulo}</p>
        {p.detalle && <p className="text-xs text-tenue mt-0.5 whitespace-pre-wrap">{p.detalle}</p>}
        <p className="text-xs text-tenue mt-1">
          {conQuien === "para" ? <>Para <b className="text-texto font-medium">{p.responsable?.nombre}</b></> : <>De {quienPidio(p)}</>}
          {" · "}{hace(p.creado_en)}
          {p.modo && <> · <span data-explain={GLOSARIO.pendienteVarios} data-explain-title="A varias personas">a varias personas: {MODO[p.modo]}</span></>}
          {p.nota_cierre && <> · <span className="text-texto">“{p.nota_cierre}”</span></>}
        </p>
      </button>
      <div className="flex items-center gap-2 shrink-0">
        {p.estado === "abierto" && p.esperando_respuesta && <EsperaRespuesta p={p} yo={yo} />}
        {p.vence && p.estado === "abierto" && (
          <Insignia tono={vencido ? "peligro" : esHoy ? "aviso" : "neutro"}>{vencido ? "Venció " : esHoy ? "Hoy" : "Para "}{!esHoy && fecha(p.vence)}</Insignia>
        )}
        {p.ruta && <Link to={p.ruta} className="h-8 w-8 grid place-items-center rounded-lg hover:bg-fondo text-tenue" title="Ir"><ArrowRight className="h-4 w-4" /></Link>}
      </div>
    </div>
  );
}

/** «Esperando respuesta»: a quien lo tiene le dice de quién espera; a quien lo pidió, que le toca contestar. */
function EsperaRespuesta({ p, yo }: { p: Pendiente; yo: string | undefined }) {
  const meToca = p.creado_por === yo;
  return (
    <span data-explain={GLOSARIO.pendienteEsperandoRespuesta} data-explain-title="Esperando respuesta">
      <Insignia tono={meToca ? "aviso" : "info"}>{meToca ? "Te preguntaron" : `Esperando a ${(p.creador?.nombre ?? "quien lo pidió").split(" ")[0]}`}</Insignia>
    </span>
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
function FilaPedido({ grupo, hoy, alCancelar, alAbrir }: { grupo: Pendiente[]; hoy: string; alCancelar: () => void; alAbrir: (id: string) => void }) {
  const p = grupo[0];
  const vivos = grupo.filter((x) => x.estado !== "cancelado");
  const hechos = vivos.filter((x) => x.estado === "hecho").length;
  const vencido = p.vence && p.vence < hoy;
  return (
    <div className="flex items-start gap-3 p-4">
      <Marca estado="abierto" />
      <div className="min-w-0 flex-1">
        <button type="button" onClick={() => alAbrir((vivos.find((x) => x.esperando_respuesta && x.estado === "abierto") ?? vivos[0] ?? p).id)}
          className="text-sm font-medium text-left hover:opacity-90" title="Abrir la ficha">{p.titulo}</button>
        {p.detalle && <p className="text-xs text-tenue mt-0.5 whitespace-pre-wrap">{p.detalle}</p>}
        <div className="flex flex-wrap items-center gap-1.5 mt-1.5 text-xs">
          <span className="text-tenue">Para</span>
          {vivos.map((x) => (
            <button type="button" key={x.id} onClick={() => alAbrir(x.id)} title="Abrir su ficha"
              className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 hover:ring-1 hover:ring-marca/40",
                x.estado === "hecho" ? "border-ok/30 bg-ok-suave text-ok"
                  : x.esperando_respuesta && x.estado === "abierto" ? "border-aviso/40 bg-aviso-suave text-aviso" : "border-borde text-texto")}>
              {x.estado === "hecho" && <Check className="h-3 w-3" />}
              {x.esperando_respuesta && x.estado === "abierto" && <MessageCircleQuestion className="h-3 w-3" />}{x.responsable?.nombre}
            </button>
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
function Equipo({ todos, alAbrir }: { todos: Pendiente[]; alAbrir: (id: string) => void }) {
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
    { clave: "por_responder", titulo: "Por responder", alinear: "der", sinBusqueda: true, explica: GLOSARIO.pendienteEsperandoRespuesta,
      celda: (c) => <span className={cn("cifra", c.por_responder > 0 && "text-aviso font-medium")}>{c.por_responder}</span> },
    { clave: "pidio", titulo: "Pidió", alinear: "der", sinBusqueda: true, explica: GLOSARIO.pendientesPidio,
      celda: (c) => <span className="cifra">{c.pidio}{c.pidio_abiertos > 0 && <span className="text-tenue"> · {c.pidio_abiertos} abiertos</span>}</span> },
  ];
  const suyos = persona ? todos.filter((p) => p.estado === "abierto" && (p.responsable_id === persona.persona_id || p.creado_por === persona.persona_id)) : [];
  // Lo que cerró en el periodo (lo que cuenta en «Cerrados» y «A tiempo»), con la respuesta que dejó.
  const cerrados = persona ? todos.filter((p) => p.estado === "hecho" && p.responsable_id === persona.persona_id && p.cerrado_en
    && p.cerrado_en.slice(0, 10) >= desde).sort((a, b) => (b.cerrado_en ?? "").localeCompare(a.cerrado_en ?? "")) : [];
  const diaMx = (t: string) => new Date(t).toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
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
          <h3 className="text-sm font-semibold">Lo abierto de {persona.persona} <span className="font-normal text-tenue">· clic para ver su ficha</span></h3>
          {suyos.length === 0 ? <p className="text-sm text-tenue">Nada abierto.</p> : (
            <div className="tarjeta divide-y divide-borde">
              {suyos.map((p) => {
                const vencido = p.vence && p.vence < hoy;
                return (
                  <button type="button" key={p.id} onClick={() => alAbrir(p.id)} title="Abrir la ficha" className="w-full flex items-start gap-3 p-3 text-sm text-left hover:bg-fondo">
                    <span className="min-w-0 flex-1">
                      <span className="font-medium">{p.titulo}</span>
                      <span className="block text-xs text-tenue">
                        {p.responsable_id === persona.persona_id ? <>Le toca · lo pidió <b className="text-texto font-medium">{quienPidio(p)}</b></>
                          : <>Lo pidió · lo tiene <b className="text-texto font-medium">{p.responsable?.nombre}</b></>} · {hace(p.creado_en)}
                      </span>
                    </span>
                    {p.esperando_respuesta && <EsperaRespuesta p={p} yo={undefined} />}
                    {p.vence && <Insignia tono={vencido ? "peligro" : p.vence === hoy ? "aviso" : "neutro"}>{vencido ? "Venció " : p.vence === hoy ? "Hoy" : "Para "}{p.vence !== hoy && fecha(p.vence)}</Insignia>}
                  </button>
                );
              })}
            </div>
          )}
          <h3 className="text-sm font-semibold pt-2" data-explain={GLOSARIO.pendientesATiempo} data-explain-title="Cerrados">
            Lo que cerró en {dias} días ({cerrados.length})</h3>
          {cerrados.length === 0 ? <p className="text-sm text-tenue">No cerró nada en el periodo.</p> : (
            <div className="tarjeta divide-y divide-borde">
              {cerrados.map((p) => {
                const tarde = p.vence && p.cerrado_en && diaMx(p.cerrado_en) > p.vence;
                return (
                  <button type="button" key={p.id} onClick={() => alAbrir(p.id)} title="Abrir la ficha" className="w-full flex items-start gap-3 p-3 text-sm text-left hover:bg-fondo">
                    <Check className="h-4 w-4 mt-0.5 shrink-0 text-ok" />
                    <span className="min-w-0 flex-1">
                      <span className="font-medium">{p.titulo}</span>
                      <span className="block text-xs text-tenue">Lo pidió <b className="text-texto font-medium">{quienPidio(p)}</b> · lo cerró {fechaYHora(p.cerrado_en)}</span>
                      {p.nota_cierre
                        ? <span className="block text-xs mt-0.5">Respuesta: <span className="text-texto">“{p.nota_cierre}”</span></span>
                        : <span className="block text-xs text-tenue mt-0.5">Lo cerró sin dejar respuesta.</span>}
                    </span>
                    {p.vence ? <Insignia tono={tarde ? "peligro" : "ok"}>{tarde ? `Tarde (era para ${fecha(p.vence)})` : "A tiempo"}</Insignia>
                      : <Insignia tono="neutro">Sin fecha</Insignia>}
                  </button>
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

/**
 * La ficha de un pendiente: todo lo que se sabe de él y su conversación. Quien lo tiene pregunta
 * («¿de qué medida?») y queda esperando respuesta; quien lo pidió contesta. Lo demás que lo ve
 * (dirección, RH) solo lee. La conversación no se edita ni se borra.
 */
function FichaPendiente({ p, cargando, yo, hoy, alCerrar, alHecho, alCancelar }: {
  p: Pendiente | null; cargando: boolean; yo: string | undefined; hoy: string; alCerrar: () => void; alHecho: () => void; alCancelar: () => void;
}) {
  const [texto, setTexto] = useState("");
  const fin = useRef<HTMLDivElement>(null);
  const mensajes = useQuery({
    queryKey: ["pendientes", "mensajes", p?.id], enabled: !!p,
    queryFn: () => q<Mensaje[]>(supabase.from("pendiente_mensajes").select("*, autor:perfiles(nombre)").eq("pendiente_id", p!.id).order("en")),
  });
  useTiempoReal("pendiente_mensajes", [["pendientes", "mensajes"]]);
  const enviar = useAccion(() => q(supabase.rpc("comentar_pendiente", { p_pendiente: p!.id, p_texto: texto })), {
    exito: p?.responsable_id === yo ? "Pregunta enviada: le llegó un aviso" : "Respuesta enviada: le llegó un aviso",
    invalidar: [["pendientes"]], alTerminar: () => setTexto(""),
  });
  useEffect(() => { setTexto(""); }, [p?.id]);
  useEffect(() => { fin.current?.scrollIntoView({ block: "end" }); }, [mensajes.data?.length]);
  const abierto = p?.estado === "abierto";
  const soyResp = !!p && p.responsable_id === yo, soyCreador = !!p && p.creado_por === yo;
  // Al de la revisión nocturna no hay a quién preguntarle: se contesta en «Por revisar».
  const escribe = abierto && (soyResp || soyCreador) && !!p!.creado_por && p!.responsable_id !== p!.creado_por;
  const otro = soyResp ? (p ? quienPidio(p) : undefined) : p?.responsable?.nombre;
  const vencido = abierto && p?.vence && p.vence < hoy;
  const mandar = () => { if (texto.trim() && !enviar.isPending) enviar.mutate(undefined); };
  return (
    <Lateral abierto={!!p || cargando} alCambiar={(v) => !v && alCerrar()} ancho="max-w-xl"
      titulo={p?.titulo ?? "Pendiente"}
      subtitulo={p && <>De <b>{quienPidio(p)}</b> para <b>{p.responsable?.nombre}</b> · {hace(p.creado_en)}</>}
      acciones={p && abierto && (
        <div className="flex gap-2">
          {soyCreador && <Boton variante="secundario" tamano="sm" onClick={alCancelar}><X className="h-4 w-4" />{p.grupo_id ? "Cancelar para todos" : "Cancelar"}</Boton>}
          {soyResp && <Boton variante="exito" tamano="sm" onClick={alHecho}><Check className="h-4 w-4" />Ya quedó</Boton>}
        </div>
      )}>
      {!p ? <Cargando filas={3} /> : (
        <div className="flex flex-col gap-4 h-full">
          <div className="space-y-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              {p.estado === "abierto" ? (p.vence
                ? <Insignia tono={vencido ? "peligro" : p.vence === hoy ? "aviso" : "neutro"}>{vencido ? "Venció " : p.vence === hoy ? "Hoy" : "Para "}{p.vence !== hoy && fecha(p.vence)}</Insignia>
                : <Insignia tono="neutro">Sin fecha</Insignia>)
                : <Insignia tono={p.estado === "cancelado" ? "neutro" : "ok"}>{p.estado === "hecho" ? "Hecho" : p.estado === "cubierto" ? "Lo hizo otra persona" : "Cancelado"}</Insignia>}
              {abierto && p.esperando_respuesta && <EsperaRespuesta p={p} yo={yo} />}
              {p.modo && <span className="text-xs text-tenue" data-explain={GLOSARIO.pendienteVarios} data-explain-title="A varias personas">A varias personas: {MODO[p.modo]}</span>}
            </div>
            {p.detalle && <p className="whitespace-pre-wrap text-tenue">{p.detalle}</p>}
            {p.nota_cierre && <p>Respuesta al cerrar: <span className="text-texto">“{p.nota_cierre}”</span></p>}
            {p.ruta && <Link to={p.ruta} className="inline-flex items-center gap-1 text-marca-texto hover:underline">Ir a donde salió <ArrowRight className="h-3.5 w-3.5" /></Link>}
          </div>

          <section className="flex-1 min-h-0 flex flex-col gap-2 border-t border-borde pt-3">
            <h4 className="text-sm font-semibold" data-explain={GLOSARIO.pendienteEsperandoRespuesta} data-explain-title="Preguntas">Preguntas y respuestas</h4>
            <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
              {mensajes.isLoading ? <Cargando filas={2} /> : (mensajes.data ?? []).length === 0 ? (
                <p className="text-sm text-tenue">{soyResp && escribe ? `¿Te falta un dato para terminarlo? Pregúntale a ${otro ?? "quien lo pidió"} aquí: le llega un aviso y, mientras contesta, no cuenta como retraso tuyo.`
                  : p.creado_por ? "Sin preguntas todavía." : "Lo puso la revisión nocturna. Ábrelo en «Por revisar» (la flecha de arriba): ahí lo corriges o, si no es error, contestas «Está bien así»."}</p>
              ) : (mensajes.data ?? []).map((m) => {
                const mio = m.autor_id === yo;
                return (
                  <div key={m.id} className={cn("max-w-[85%] rounded-xl px-3 py-2 text-sm", mio ? "ml-auto bg-marca-suave text-texto" : "bg-fondo")}>
                    <p className="whitespace-pre-wrap">{m.texto}</p>
                    <p className="mt-0.5 text-[11px] text-tenue">{mio ? "Tú" : m.autor?.nombre} · {fechaYHora(m.en)}</p>
                  </div>
                );
              })}
              <div ref={fin} />
            </div>
            {escribe && (
              <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); mandar(); }}>
                <textarea className="campo flex-1 h-16 py-2" value={texto} onChange={(e) => setTexto(e.target.value)}
                  placeholder={soyResp ? `Pregúntale a ${otro ?? "quien lo pidió"} lo que te falta…` : `Contéstale a ${otro ?? "quien lo tiene"}…`}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); mandar(); } }} />
                <Boton type="submit" disabled={!texto.trim()} cargando={enviar.isPending} className="self-end">
                  <Send className="h-4 w-4" />{soyResp ? "Preguntar" : "Responder"}</Boton>
              </form>
            )}
          </section>
        </div>
      )}
    </Lateral>
  );
}

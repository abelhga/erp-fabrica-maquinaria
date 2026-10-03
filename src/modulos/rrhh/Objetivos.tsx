import { useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarPlus, ClipboardCheck, Copy, Flag, KeyRound, ListChecks, Pencil, Plus, Target, Trash2, UserCog, Users,
} from "lucide-react";
import { Pagina } from "@/components/layout/Shell";
import { Boton } from "@/components/ui/boton";
import { Kpi } from "@/components/ui/kpi";
import { Insignia } from "@/components/ui/insignia";
import { Dialogo, Lateral } from "@/components/ui/dialogo";
import { Campo, Entrada, Seleccion } from "@/components/ui/campo";
import { Pestanas, ListaPestanas, ContenidoPestana } from "@/components/ui/pestanas";
import { Cargando, ErrorCarga, Vacio } from "@/components/ui/estados";
import { TablaDatos, Filtro, type Columna } from "@/components/datos/TablaDatos";
import { useSesion } from "@/lib/sesion";
import { supabase } from "@/lib/supabase";
import { q, useAccion, useTiempoReal } from "@/lib/consultas";
import { dinero, fecha, hoyISO, numero } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { useEmpleados } from "./componentes/comun";
import {
  AvisoSinBase, BarraPeso, ESTADOS_EVAL, FUENTES, PanelEvaluacion, REGLAS, SelectorMes, mesAnterior, mesDe, nombreMes,
  puntos, reglaCorta, useBonos, useEvaluaciones, type EstadoEval, type Evaluacion, type Fuente, type Indicador, type Regla,
} from "./componentes/objetivos";

interface Puesto { id: number; nombre: string; departamento_id: number | null; activo: boolean }
interface Linea {
  id?: string; indicador_id: number; peso: number; regla: Regla; meta: number | null; sentido: "mayor" | "menor";
  descuento: number | null; escalones: { limite: number; pct: number }[] | null; llave_limite: number | null;
  parametros: { escala?: number; areas?: number[]; almacenes?: number[] }; texto: string | null; orden?: number;
}
interface Plantilla {
  id: string; puesto_id: number | null; empleado_id: string | null; desde: string; hasta: string | null; notas: string | null;
  lineas: Linea[]; puesto: { nombre: string } | null; empleado: { nombre: string } | null;
}
interface Asignacion {
  id: string; empleado_id: string; puesto_id: number; jefe_id: string | null; desde: string; hasta: string | null; nota: string | null;
  puesto: { nombre: string } | null; jefe: { nombre: string } | null; empleado: { nombre: string; numero: string | null; activo: boolean } | null;
}
interface Area { id: number; nombre: string }

const mesActual = () => hoyISO().slice(0, 7);

function useCatalogos() {
  const indicadores = useQuery({ queryKey: ["objetivos", "indicadores"], queryFn: () => q<Indicador[]>(supabase.from("objetivo_indicadores").select("*").order("id")) });
  const puestos = useQuery({ queryKey: ["objetivos", "puestos"], queryFn: () => q<Puesto[]>(supabase.from("puestos").select("*").order("nombre")) });
  const areas = useQuery({ queryKey: ["objetivos", "areas"], queryFn: () => q<Area[]>(supabase.from("objetivo_areas").select("id, nombre").eq("activa", true).order("nombre")) });
  return { indicadores: indicadores.data ?? [], puestos: puestos.data ?? [], areas: areas.data ?? [], cargando: indicadores.isLoading || puestos.isLoading };
}

export default function Objetivos() {
  const { puede } = useSesion();
  const [params, setParams] = useSearchParams();
  const mes = params.get("mes") ?? mesAnterior();
  const vista = params.get("vista") ?? "evaluaciones";
  const cambiar = (cambios: Record<string, string | null>) => {
    const p = new URLSearchParams(params);
    Object.entries(cambios).forEach(([k, v]) => (v == null ? p.delete(k) : p.set(k, v)));
    setParams(p, { replace: true });
  };
  const esRrhh = puede("objetivos", 3);

  return (
    <Pagina
      titulo="Objetivos y bonos"
      descripcion="Cada mes la base mide lo que puede con su evidencia; el jefe califica lo demás, RRHH revisa y dirección aprueba. Nadie se califica a sí mismo."
      acciones={<SelectorMes mes={mes} alCambiar={(m) => cambiar({ mes: m, ver: null })} maximo={mesActual()} />}
    >
      <Pestanas value={vista} onValueChange={(v) => cambiar({ vista: v === "evaluaciones" ? null : v })}>
        <ListaPestanas opciones={[
          { valor: "evaluaciones", texto: "Evaluaciones del mes" },
          { valor: "plantillas", texto: "Plantillas por puesto" },
          ...(esRrhh ? [{ valor: "personas", texto: "Personas y jefes" }] : []),
          { valor: "indicadores", texto: "Indicadores" },
        ]} />
        <ContenidoPestana value="evaluaciones" className="pt-4"><Evaluaciones mes={mes} ver={params.get("ver")} abrir={(id) => cambiar({ ver: id })} /></ContenidoPestana>
        <ContenidoPestana value="plantillas" className="pt-4"><Plantillas mes={mes} /></ContenidoPestana>
        {esRrhh && <ContenidoPestana value="personas" className="pt-4"><Personas /></ContenidoPestana>}
        <ContenidoPestana value="indicadores" className="pt-4"><Indicadores /></ContenidoPestana>
      </Pestanas>
    </Pagina>
  );
}

// ---------------------------------------------------------------------------
// Evaluaciones del mes
// ---------------------------------------------------------------------------
function Evaluaciones({ mes, ver, abrir }: { mes: string; ver: string | null; abrir: (id: string | null) => void }) {
  const { puede } = useSesion();
  const esRrhh = puede("objetivos", 3);
  const conNomina = puede("nomina", 1);
  const [estado, setEstado] = useState<"todas" | EstadoEval>("todas");
  const evaluaciones = useEvaluaciones(mes);
  const bonos = useBonos(mes, conNomina);
  useTiempoReal("objetivo_marcas", [["objetivos", "evaluaciones"]]);
  const bono = useMemo(() => new Map((bonos.data ?? []).map((b) => [b.evaluacion_id, b])), [bonos.data]);
  const [resultadoArmar, setResultadoArmar] = useState<null | { creadas: number; medidas: number; ya_calificadas: number; sin_plantilla: { empleado: string; puesto: string }[] }>(null);
  const armar = useAccion(() => q<{ creadas: number; medidas: number; ya_calificadas: number; sin_plantilla: { empleado: string; puesto: string }[] }>(
    supabase.rpc("armar_evaluaciones", { p_mes: `${mes}-01` })), {
    exito: (r) => `${r.creadas} nuevas, ${r.medidas} medidas`, invalidar: [["objetivos"]], alTerminar: (r) => setResultadoArmar(r),
  });

  const todas = evaluaciones.data ?? [];
  const filas = todas.filter((e) => estado === "todas" || e.estado === estado);
  const abierta = todas.find((e) => e.id === ver) ?? null;
  const cuenta = (s: EstadoEval) => todas.filter((e) => e.estado === s).length;
  const aprobadas = todas.filter((e) => e.estado === "aprobada");
  const promedio = aprobadas.length ? aprobadas.reduce((s, e) => s + Number(e.total_final ?? 0), 0) / aprobadas.length : null;
  const sinBase = aprobadas.filter((e) => bono.get(e.id)?.monto == null).length;

  const columnas: Columna<Evaluacion>[] = [
    {
      clave: "empleado_nombre", titulo: "Persona",
      celda: (e) => (
        <div className="min-w-[200px]">
          <p className="font-medium">{e.empleado_nombre}{e.es_mia && <span className="text-xs text-tenue font-normal"> (tú)</span>}</p>
          <p className="text-xs text-tenue">{e.puesto_nombre}</p>
        </div>
      ),
    },
    { clave: "evaluador", titulo: "Jefe directo", valor: (e) => e.evaluador ?? "RRHH", celda: (e) => e.evaluador ?? <span className="text-tenue">Sin jefe (RRHH)</span> },
    {
      clave: "estado", titulo: "Estado", valor: (e) => ESTADOS_EVAL[e.estado].texto,
      celda: (e) => (
        <div className="flex flex-wrap gap-1">
          <Insignia tono={ESTADOS_EVAL[e.estado].tono}>{ESTADOS_EVAL[e.estado].texto}</Insignia>
          {e.impugnaciones_pendientes > 0 && <Insignia tono="aviso"><Flag className="h-3 w-3" /> {e.impugnaciones_pendientes}</Insignia>}
          {e.ajustes_pendientes > 0 && <Insignia tono="info">Ajuste por autorizar</Insignia>}
        </div>
      ),
    },
    {
      clave: "avance", titulo: "Calificados", alinear: "der", sinBusqueda: true, valor: (e) => e.indicadores - e.pendientes,
      celda: (e) => <span className={e.pendientes ? "text-aviso" : "text-tenue"}>{e.indicadores - e.pendientes} de {e.indicadores}</span>,
    },
    {
      clave: "total_final", titulo: "Resultado", alinear: "der", sinBusqueda: true, valor: (e) => Number(e.total_final ?? -1),
      celda: (e) => (
        <div className="w-32 ml-auto space-y-1">
          <p className="flex items-center justify-end gap-1">
            {e.llave_activada && <KeyRound className="h-3.5 w-3.5 text-peligro" aria-label="Llave activada" />}
            <b className={e.llave_activada ? "text-peligro" : ""}>{puntos(e.total_final)}</b>
            {!e.completa && !e.llave_activada && <span className="text-xs text-tenue">parcial</span>}
          </p>
          <BarraPeso valor={e.total_final} peso={100} tono={e.llave_activada ? "peligro" : undefined} />
        </div>
      ),
    },
    ...(conNomina ? [{
      clave: "bono", titulo: "Bono", alinear: "der" as const, sinBusqueda: true, valor: (e: Evaluacion) => bono.get(e.id)?.monto ?? null,
      celda: (e: Evaluacion) => {
        const b = bono.get(e.id);
        if (e.estado !== "aprobada") return <span className="text-tenue text-xs">al aprobar</span>;
        return b?.monto != null ? <span className="cifra">{dinero(b.monto)}</span> : <span className="text-xs text-aviso whitespace-nowrap">Falta la base</span>;
      },
    }] : []),
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-2 xl:grid-cols-4">
        <Kpi titulo="Personas evaluadas" valor={numero(todas.length)} icono={Users} detalle={nombreMes(mes)} />
        <Kpi titulo="Por calificar" valor={numero(cuenta("borrador"))} icono={ClipboardCheck} tono={cuenta("borrador") ? "aviso" : "neutro"}
          detalle="Las califica su jefe directo" alClic={() => setEstado("borrador")} />
        <Kpi titulo="Por revisar o aprobar" valor={numero(cuenta("calificada") + cuenta("revisada"))} icono={ListChecks} tono="info"
          detalle={`${cuenta("calificada")} con RRHH · ${cuenta("revisada")} con dirección`} alClic={() => setEstado("calificada")} />
        <Kpi titulo="Promedio aprobado" valor={promedio == null ? "—" : puntos(Math.round(promedio * 10) / 10)} icono={Target} tono="ok"
          detalle={`${aprobadas.length} aprobadas · ${todas.filter((e) => e.llave_activada).length} con la llave activada`} />
      </div>

      {conNomina && <AvisoSinBase cuantos={sinBase} />}

      <TablaDatos
        filas={filas} columnas={columnas} cargando={evaluaciones.isLoading} error={evaluaciones.error} claveFila={(e) => e.id}
        alClicFila={(e) => abrir(e.id)} exportarComo={`objetivos-${mes}`} placeholder="Buscar persona, puesto o jefe…"
        filtros={
          <div className="flex flex-wrap items-center gap-2">
            <Filtro valor={estado} alCambiar={setEstado} opciones={[
              { valor: "todas", texto: "Todas", cuenta: todas.length },
              ...(["borrador", "calificada", "revisada", "aprobada"] as EstadoEval[]).map((s) => ({ valor: s, texto: ESTADOS_EVAL[s].texto, cuenta: cuenta(s) })),
            ]} />
            {esRrhh && <Boton tamano="sm" variante="secundario" cargando={armar.isPending} onClick={() => armar.mutate(undefined)}
              title="Crea el borrador de quien tenga puesto asignado y vuelve a medir los borradores"><CalendarPlus className="h-4 w-4" /> Armar y medir {nombreMes(mes)}</Boton>}
          </div>
        }
        vacio={esRrhh ? {
          icono: CalendarPlus, titulo: `Aún no se arma ${nombreMes(mes)}`,
          texto: "Arma el mes: la base crea el borrador de cada persona con puesto asignado y mide sola lo que puede (entregas, inventario, ventas…). El día 1 se arma solo.",
          accion: <Boton cargando={armar.isPending} onClick={() => armar.mutate(undefined)}><CalendarPlus className="h-4 w-4" /> Armar {nombreMes(mes)}</Boton>,
        } : {
          icono: Users, titulo: "Nadie a quien calificar este mes",
          texto: "Aquí aparece tu gente cuando RRHH arma el mes (el día 1). Si falta alguien, pide a RRHH que le asigne su puesto y a ti como jefe directo.",
        }}
      />

      <Lateral abierto={!!abierta} alCambiar={(v) => !v && abrir(null)} ancho="max-w-3xl"
        titulo={abierta?.empleado_nombre ?? ""}
        subtitulo={abierta && <span>{abierta.puesto_nombre} · <span className="first-letter:uppercase">{nombreMes(abierta.mes)}</span> · <Insignia tono={ESTADOS_EVAL[abierta.estado].tono}>{ESTADOS_EVAL[abierta.estado].texto}</Insignia></span>}>
        {abierta && <PanelEvaluacion evaluacion={abierta} />}
      </Lateral>

      <Dialogo abierto={!!resultadoArmar} alCambiar={(v) => !v && setResultadoArmar(null)} titulo={`${nombreMes(mes)} armado`}
        pie={<Boton onClick={() => setResultadoArmar(null)}>Listo</Boton>}>
        {resultadoArmar && (
          <div className="space-y-3 text-sm">
            <p>{resultadoArmar.creadas} borradores nuevos y {resultadoArmar.medidas} medidos con los datos de hoy. {resultadoArmar.ya_calificadas > 0 && `${resultadoArmar.ya_calificadas} ya estaban calificados y no se tocaron.`}</p>
            {resultadoArmar.sin_plantilla.length > 0 && (
              <div className="rounded-lg border border-aviso/30 bg-aviso-suave p-3 text-aviso">
                <p className="font-medium">Sin plantilla vigente (no se armaron):</p>
                <ul className="list-disc ml-5">{resultadoArmar.sin_plantilla.map((s) => <li key={s.empleado}>{s.empleado} · {s.puesto}</li>)}</ul>
              </div>
            )}
          </div>
        )}
      </Dialogo>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Plantillas por puesto, con vigencia
// ---------------------------------------------------------------------------
function Plantillas({ mes }: { mes: string }) {
  const { puede } = useSesion();
  const esRrhh = puede("objetivos", 3);
  const { indicadores, puestos, areas } = useCatalogos();
  const plantillas = useQuery({
    queryKey: ["objetivos", "plantillas"],
    queryFn: () => q<Plantilla[]>(supabase.from("objetivo_plantillas")
      .select("*, lineas:objetivo_plantilla_lineas(*), puesto:puestos(nombre), empleado:empleados(nombre)").order("desde", { ascending: false })),
  });
  const [editor, setEditor] = useState<null | { plantilla: Partial<Plantilla> & { lineas: Linea[] }; puesto: string }>(null);
  const fechaMes = `${mes}-01`;
  const vigente = (p: Plantilla) => p.desde <= fechaMes && (!p.hasta || p.hasta >= fechaMes);
  const ind = useMemo(() => new Map(indicadores.map((i) => [i.id, i])), [indicadores]);

  if (plantillas.error) return <ErrorCarga error={plantillas.error} />;
  if (plantillas.isLoading) return <Cargando />;
  const todas = plantillas.data ?? [];

  return (
    <div className="space-y-4">
      <p className="text-sm text-tenue max-w-3xl">
        Lo que se le pide a cada puesto en <b className="text-texto">{nombreMes(mes)}</b>. Los pesos siempre suman 100 (la base no deja guardar otra cosa).
        Cuando cambian los objetivos se crea una versión nueva desde un mes: la anterior se cierra sola y los meses ya calificados no cambian.
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        {puestos.filter((p) => p.activo).map((p) => {
          const versiones = todas.filter((t) => t.puesto_id === p.id);
          const actual = versiones.find(vigente);
          const lineas = [...(actual?.lineas ?? [])].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
          return (
            <div key={p.id} className="tarjeta overflow-hidden">
              <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-2">
                <div className="min-w-0">
                  <h3 className="font-semibold">{p.nombre}</h3>
                  <p className="text-xs text-tenue">
                    {actual ? <>Vigente desde {nombreMes(actual.desde)}{actual.hasta ? ` hasta ${nombreMes(actual.hasta)}` : ""}</> : "Sin plantilla en este mes"}
                    {versiones.length > 1 && ` · ${versiones.length} versiones`}
                  </p>
                </div>
                {esRrhh && (
                  <div className="flex gap-1 shrink-0">
                    {actual && <Boton variante="fantasma" tamano="sm" onClick={() => setEditor({ puesto: p.nombre, plantilla: { ...actual, lineas } })}><Pencil className="h-3.5 w-3.5" /> Editar</Boton>}
                    <Boton variante="secundario" tamano="sm" onClick={() => setEditor({
                      puesto: p.nombre,
                      plantilla: { puesto_id: p.id, desde: `${mesDe(hoyISO(), 1)}-01`, notas: actual?.notas ?? "", lineas: lineas.map(({ id: _id, ...l }) => l) },
                    })}><Copy className="h-3.5 w-3.5" /> {actual ? "Nueva versión" : "Crear"}</Boton>
                  </div>
                )}
              </div>
              {actual ? (
                <table className="tabla">
                  <tbody>
                    {lineas.map((l) => {
                      const i = ind.get(l.indicador_id);
                      return (
                        <tr key={l.id}>
                          <td>
                            <p className="font-medium text-sm">{i?.nombre}</p>
                            <p className="text-xs text-tenue">{l.texto ?? reglaCorta({ ...l, unidad: i?.unidad })}</p>
                          </td>
                          <td className="w-28"><Insignia tono={FUENTES[(i?.fuente ?? "manual") as Fuente].tono}>{FUENTES[(i?.fuente ?? "manual") as Fuente].texto}</Insignia></td>
                          <td className="text-right cifra font-medium w-14">{numero(l.peso)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot><tr><td colSpan={2} className="text-xs text-tenue">{actual.notas}</td><td className="text-right cifra font-semibold">{numero(lineas.reduce((s, l) => s + Number(l.peso), 0))}</td></tr></tfoot>
                </table>
              ) : <Vacio className="py-8" icono={Target} titulo="Sin objetivos" texto={esRrhh ? "Crea la plantilla del puesto: indicadores, peso y regla." : "RRHH todavía no define los objetivos de este puesto."} />}
            </div>
          );
        })}
      </div>
      {editor && <EditorPlantilla inicial={editor.plantilla} puesto={editor.puesto} indicadores={indicadores} areas={areas} alCerrar={() => setEditor(null)} />}
    </div>
  );
}

function EditorPlantilla({ inicial, puesto, indicadores, areas, alCerrar }: {
  inicial: Partial<Plantilla> & { lineas: Linea[] }; puesto: string; indicadores: Indicador[]; areas: Area[]; alCerrar: () => void;
}) {
  const [desde, setDesde] = useState((inicial.desde ?? `${mesActual()}-01`).slice(0, 7));
  const [notas, setNotas] = useState(inicial.notas ?? "");
  const [lineas, setLineas] = useState<Linea[]>(inicial.lineas);
  const suma = lineas.reduce((s, l) => s + (Number(l.peso) || 0), 0);
  const cambiar = (i: number, c: Partial<Linea>) => setLineas((ls) => ls.map((l, j) => (j === i ? { ...l, ...c } : l)));
  const activos = indicadores.filter((i) => i.activo);
  const guardar = useAccion(() => q(supabase.rpc("guardar_plantilla", {
    p: { id: inicial.id ?? null, puesto_id: inicial.puesto_id ?? null, empleado_id: inicial.empleado_id ?? null, desde: `${desde}-01`, hasta: inicial.hasta ?? null, notas, lineas },
  })), { exito: inicial.id ? "Plantilla guardada" : "Versión nueva guardada", invalidar: [["objetivos"]], alTerminar: alCerrar });

  function enviar(ev: FormEvent) { ev.preventDefault(); if (suma === 100) guardar.mutate(undefined); }
  return (
    <Dialogo abierto alCambiar={(v) => !v && alCerrar()} ancho="max-w-4xl"
      titulo={`${inicial.id ? "Editar" : "Nueva versión"}: ${puesto}`}
      descripcion={inicial.id ? "Si ya se calificó a alguien con esta plantilla, la base no deja cambiarla: crea una versión nueva." : "La versión anterior termina el mes antes de que empiece esta."}
      pie={<>
        <span className={cn("mr-auto text-sm font-medium cifra", suma === 100 ? "text-ok" : "text-peligro")}>Suman {numero(suma)} {suma === 100 ? "✓" : `— ${suma > 100 ? "sobran" : "faltan"} ${numero(Math.abs(100 - suma))}`}</span>
        <Boton variante="secundario" onClick={alCerrar}>Cancelar</Boton>
        <Boton cargando={guardar.isPending} disabled={suma !== 100 || lineas.length === 0} onClick={() => guardar.mutate(undefined)}>Guardar</Boton>
      </>}>
      <form onSubmit={enviar} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
          <Campo etiqueta="Vigente desde"><Entrada type="month" value={desde} onChange={(e) => setDesde(e.target.value)} /></Campo>
          <Campo etiqueta="Notas"><Entrada value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Por qué cambió, quién lo pidió…" /></Campo>
        </div>
        <div className="space-y-2">
          {lineas.map((l, i) => {
            const indicador = indicadores.find((x) => x.id === l.indicador_id);
            return (
              <div key={i} className="rounded-lg border border-borde p-3 grid gap-2 md:grid-cols-[1fr_80px_190px_auto] items-start">
                <div className="space-y-2 min-w-0">
                  <Seleccion value={l.indicador_id} onChange={(e) => cambiar(i, { indicador_id: Number(e.target.value) })} aria-label="Indicador">
                    {["ventas", "compras", "ingenieria", "produccion", "almacen", "general"].map((a) => (
                      <optgroup key={a} label={a === "ingenieria" ? "Ingeniería" : a === "produccion" ? "Producción" : a === "almacen" ? "Almacén" : a[0].toUpperCase() + a.slice(1)}>
                        {activos.filter((x) => x.area === a).map((x) => <option key={x.id} value={x.id}>{x.nombre} · {FUENTES[x.fuente].texto}</option>)}
                      </optgroup>
                    ))}
                  </Seleccion>
                  <Entrada value={l.texto ?? ""} onChange={(e) => cambiar(i, { texto: e.target.value })} placeholder="Cómo lo lee la persona: «1 entrega tarde = −10»" />
                  {indicador?.checklist === "limpieza" && (
                    <div className="flex flex-wrap gap-1">
                      {areas.map((a) => {
                        const sel = l.parametros?.areas?.includes(a.id);
                        return (
                          <button key={a.id} type="button" onClick={() => cambiar(i, { parametros: { ...l.parametros, areas: sel ? (l.parametros.areas ?? []).filter((x) => x !== a.id) : [...(l.parametros?.areas ?? []), a.id] } })}
                            className={cn("h-7 rounded-full px-2.5 text-xs border", sel ? "bg-marca text-white border-marca" : "border-borde text-tenue")}>{a.nombre}</button>
                        );
                      })}
                    </div>
                  )}
                </div>
                <label className="text-xs text-tenue">Peso
                  <Entrada className="mt-1" type="number" min={0.5} max={100} step="0.5" value={l.peso} onChange={(e) => cambiar(i, { peso: Number(e.target.value) })} />
                </label>
                <div className="space-y-2">
                  <Seleccion value={l.regla} onChange={(e) => cambiar(i, { regla: e.target.value as Regla })} aria-label="Regla" title={REGLAS[l.regla].ayuda}>
                    {(Object.keys(REGLAS) as Regla[]).map((r) => <option key={r} value={r}>{REGLAS[r].texto}</option>)}
                  </Seleccion>
                  <ParametrosRegla l={l} cambiar={(c) => cambiar(i, c)} />
                </div>
                <Boton type="button" variante="fantasma" tamano="icono" onClick={() => setLineas((ls) => ls.filter((_, j) => j !== i))} aria-label="Quitar"><Trash2 className="h-4 w-4" /></Boton>
              </div>
            );
          })}
          <Boton type="button" variante="secundario" tamano="sm" onClick={() => setLineas((ls) => [...ls, {
            indicador_id: activos[0]?.id ?? 1, peso: Math.max(0, 100 - suma), regla: "meta", meta: 1, sentido: "mayor", descuento: null,
            escalones: null, llave_limite: null, parametros: {}, texto: null,
          }])}><Plus className="h-4 w-4" /> Agregar indicador</Boton>
        </div>
      </form>
    </Dialogo>
  );
}

function ParametrosRegla({ l, cambiar }: { l: Linea; cambiar: (c: Partial<Linea>) => void }) {
  const num = (v: string) => (v === "" ? null : Number(v));
  switch (l.regla) {
    case "meta":
      return (
        <div className="flex gap-1">
          <Seleccion className="w-16 px-2" value={l.sentido} onChange={(e) => cambiar({ sentido: e.target.value as "mayor" | "menor" })} aria-label="Sentido"><option value="mayor">≥</option><option value="menor">≤</option></Seleccion>
          <Entrada type="number" step="any" value={l.meta ?? ""} onChange={(e) => cambiar({ meta: num(e.target.value) })} placeholder="Meta" />
        </div>
      );
    case "descuento":
      return <Entrada type="number" step="0.5" min={0.5} value={l.descuento ?? ""} onChange={(e) => cambiar({ descuento: num(e.target.value) })} placeholder="Puntos por incidencia" />;
    case "llave":
      return <Entrada type="number" min={1} value={l.llave_limite ?? ""} onChange={(e) => cambiar({ llave_limite: num(e.target.value) })} placeholder="Incumplimientos que anulan el bono" />;
    case "proporcional":
      return <Entrada type="number" min={1} value={l.parametros?.escala ?? ""} onChange={(e) => cambiar({ parametros: { ...l.parametros, escala: e.target.value ? Number(e.target.value) : undefined } })}
        placeholder="Escala (vacío = días marcados)" />;
    case "escalon":
      return (
        <div className="space-y-1">
          <Seleccion value={l.sentido} onChange={(e) => cambiar({ sentido: e.target.value as "mayor" | "menor" })} aria-label="Sentido">
            <option value="mayor">Mientras más, mejor</option><option value="menor">Mientras menos, mejor</option>
          </Seleccion>
          <Entrada value={(l.escalones ?? []).map((e) => `${e.limite}:${e.pct}`).join(", ")}
            onChange={(e) => cambiar({ escalones: e.target.value.split(",").map((x) => x.split(":").map((y) => Number(y.trim()))).filter(([a, b]) => !Number.isNaN(a) && !Number.isNaN(b)).map(([limite, pct]) => ({ limite, pct })) })}
            placeholder="límite:% — 5:100, 10:80" />
        </div>
      );
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Personas, puestos y jefes
// ---------------------------------------------------------------------------
function Personas() {
  const { puestos } = useCatalogos();
  const empleados = useEmpleados();
  const asignaciones = useQuery({
    queryKey: ["objetivos", "asignaciones"],
    queryFn: () => q<Asignacion[]>(supabase.from("puesto_asignaciones")
      .select("*, puesto:puestos(nombre), jefe:perfiles!puesto_asignaciones_jefe_id_fkey(nombre), empleado:empleados(nombre, numero, activo)").order("desde", { ascending: false })),
  });
  const perfiles = useQuery({ queryKey: ["perfiles", "activos"], queryFn: () => q<{ id: string; nombre: string; correo: string }[]>(supabase.from("perfiles").select("id, nombre, correo").eq("activo", true).order("nombre")) });
  const [nueva, setNueva] = useState(false);
  const [terminar, setTerminar] = useState<Asignacion | null>(null);
  const hoy = hoyISO();
  const vigentes = (asignaciones.data ?? []).filter((a) => !a.hasta || a.hasta >= hoy);
  const sinPuesto = (empleados.data ?? []).filter((e) => e.activo && !vigentes.some((a) => a.empleado_id === e.id));

  const columnas: Columna<Asignacion>[] = [
    { clave: "empleado", titulo: "Persona", valor: (a) => a.empleado?.nombre, celda: (a) => <span className="font-medium">{a.empleado?.nombre}</span> },
    { clave: "puesto", titulo: "Puesto con objetivos", valor: (a) => a.puesto?.nombre },
    { clave: "jefe", titulo: "Jefe directo (califica)", valor: (a) => a.jefe?.nombre ?? "RRHH", celda: (a) => a.jefe?.nombre ?? <span className="text-tenue">RRHH</span> },
    { clave: "desde", titulo: "Desde", valor: (a) => a.desde, celda: (a) => fecha(a.desde) },
    { clave: "hasta", titulo: "Hasta", valor: (a) => a.hasta, celda: (a) => (a.hasta ? fecha(a.hasta) : <Insignia tono="ok">Vigente</Insignia>) },
    {
      clave: "acciones", titulo: "", sinBusqueda: true,
      celda: (a) => !a.hasta && <Boton variante="fantasma" tamano="sm" onClick={(ev) => { ev.stopPropagation(); setTerminar(a); }}>Terminar</Boton>,
    },
  ];
  return (
    <div className="space-y-3">
      <p className="text-sm text-tenue max-w-3xl">
        A quién se evalúa con qué plantilla y quién lo califica. El jefe directo solo ve y califica a su gente; nadie puede ser su propio jefe.
        {sinPuesto.length > 0 && ` ${sinPuesto.length} personas activas no tienen puesto con objetivos (el taller no los tiene).`}
      </p>
      <TablaDatos filas={asignaciones.data} columnas={columnas} cargando={asignaciones.isLoading} error={asignaciones.error} claveFila={(a) => a.id}
        exportarComo="puestos-y-jefes" placeholder="Buscar persona, puesto o jefe…"
        filtros={<Boton tamano="sm" onClick={() => setNueva(true)}><UserCog className="h-4 w-4" /> Asignar puesto</Boton>}
        vacio={{ icono: UserCog, titulo: "Nadie tiene puesto con objetivos", texto: "Asigna a cada persona su puesto y su jefe directo; el día 1 se arma su evaluación del mes." }} />
      {nueva && <DialogoAsignar alCerrar={() => setNueva(false)} empleados={(empleados.data ?? []).filter((e) => e.activo)} puestos={puestos} perfiles={perfiles.data ?? []} />}
      {terminar && <DialogoTerminar a={terminar} alCerrar={() => setTerminar(null)} />}
    </div>
  );
}

function DialogoAsignar({ alCerrar, empleados, puestos, perfiles }: {
  alCerrar: () => void; empleados: { id: string; nombre: string; usuario_id: string | null }[]; puestos: Puesto[]; perfiles: { id: string; nombre: string }[];
}) {
  const [f, setF] = useState({ empleado_id: "", puesto_id: "", jefe_id: "", desde: `${mesActual()}-01` });
  const empleado = empleados.find((e) => e.id === f.empleado_id);
  const guardar = useAccion(() => q(supabase.from("puesto_asignaciones").insert({
    empleado_id: f.empleado_id, puesto_id: Number(f.puesto_id), jefe_id: f.jefe_id || null, desde: f.desde,
  })), { exito: "Puesto asignado", invalidar: [["objetivos"]], alTerminar: alCerrar });
  const valido = f.empleado_id && f.puesto_id && f.desde;
  return (
    <Dialogo abierto alCambiar={(v) => !v && alCerrar()} titulo="Asignar puesto y jefe"
      pie={<><Boton variante="secundario" onClick={alCerrar}>Cancelar</Boton><Boton cargando={guardar.isPending} disabled={!valido} onClick={() => guardar.mutate(undefined)}>Asignar</Boton></>}>
      <form className="space-y-3" onSubmit={(ev) => { ev.preventDefault(); if (valido) guardar.mutate(undefined); }}>
        <Campo etiqueta="Persona">
          <Seleccion autoFocus value={f.empleado_id} onChange={(e) => setF({ ...f, empleado_id: e.target.value })}>
            <option value="">Elige…</option>{empleados.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </Seleccion>
        </Campo>
        <Campo etiqueta="Puesto">
          <Seleccion value={f.puesto_id} onChange={(e) => setF({ ...f, puesto_id: e.target.value })}>
            <option value="">Elige…</option>{puestos.filter((p) => p.activo).map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </Seleccion>
        </Campo>
        <Campo etiqueta="Jefe directo (quien califica)" ayuda="Necesita usuario en el ERP. Si lo dejas vacío, califica RRHH.">
          <Seleccion value={f.jefe_id} onChange={(e) => setF({ ...f, jefe_id: e.target.value })}>
            <option value="">RRHH</option>
            {perfiles.filter((p) => p.id !== empleado?.usuario_id).map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </Seleccion>
        </Campo>
        <Campo etiqueta="Desde"><Entrada type="date" value={f.desde} onChange={(e) => setF({ ...f, desde: e.target.value })} /></Campo>
      </form>
    </Dialogo>
  );
}

function DialogoTerminar({ a, alCerrar }: { a: Asignacion; alCerrar: () => void }) {
  const [hasta, setHasta] = useState(hoyISO());
  const guardar = useAccion(() => q(supabase.from("puesto_asignaciones").update({ hasta }).eq("id", a.id)),
    { exito: "Asignación terminada", invalidar: [["objetivos"]], alTerminar: alCerrar });
  return (
    <Dialogo abierto alCambiar={(v) => !v && alCerrar()} titulo="Terminar asignación" descripcion={`${a.empleado?.nombre} · ${a.puesto?.nombre}`}
      pie={<><Boton variante="secundario" onClick={alCerrar}>Cancelar</Boton><Boton cargando={guardar.isPending} onClick={() => guardar.mutate(undefined)}>Terminar</Boton></>}>
      <Campo etiqueta="Último día en el puesto" ayuda="Para cambiarlo de puesto, termina esta y asigna la nueva desde el día siguiente.">
        <Entrada type="date" value={hasta} min={a.desde} onChange={(e) => setHasta(e.target.value)} />
      </Campo>
    </Dialogo>
  );
}

// ---------------------------------------------------------------------------
// Catálogo de indicadores
// ---------------------------------------------------------------------------
function Indicadores() {
  const { indicadores, cargando } = useCatalogos();
  const [fuente, setFuente] = useState<"todas" | Fuente>("todas");
  const filas = indicadores.filter((i) => fuente === "todas" || i.fuente === fuente);
  const cuenta = (f: Fuente) => indicadores.filter((i) => i.fuente === f).length;
  const columnas: Columna<Indicador>[] = [
    { clave: "id", titulo: "#", alinear: "der", valor: (i) => i.id, celda: (i) => <span className="text-tenue cifra">{i.id}</span> },
    { clave: "nombre", titulo: "Indicador", celda: (i) => <div className="min-w-[220px]"><p className={cn("font-medium", !i.activo && "text-tenue line-through")}>{i.nombre}</p><p className="text-xs text-tenue">{i.descripcion}</p></div>, valor: (i) => `${i.nombre} ${i.descripcion}` },
    { clave: "area", titulo: "Área", valor: (i) => i.area },
    { clave: "fuente", titulo: "De dónde sale", valor: (i) => FUENTES[i.fuente].texto, celda: (i) => <Insignia tono={FUENTES[i.fuente].tono}>{FUENTES[i.fuente].texto}</Insignia> },
    { clave: "unidad", titulo: "Unidad", valor: (i) => i.unidad },
    { clave: "dato_faltante", titulo: "Para que se mida solo falta", valor: (i) => i.dato_faltante, clase: "max-w-[280px] text-xs text-tenue", celda: (i) => i.dato_faltante ?? "—" },
  ];
  return (
    <TablaDatos filas={filas} columnas={columnas} cargando={cargando} claveFila={(i) => String(i.id)} exportarComo="indicadores-objetivos"
      placeholder="Buscar indicador…"
      filtros={<Filtro valor={fuente} alCambiar={setFuente} opciones={[
        { valor: "todas", texto: "Todos", cuenta: indicadores.length },
        ...(Object.keys(FUENTES) as Fuente[]).map((f) => ({ valor: f, texto: FUENTES[f].texto, cuenta: cuenta(f) })),
      ]} />}
      vacio={{ icono: Target, titulo: "Sin indicadores", texto: "El catálogo viene de la hoja de objetivos; si no aparece, falta aplicar la migración." }} />
  );
}

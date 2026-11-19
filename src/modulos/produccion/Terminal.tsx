import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle, ArrowLeft, ArrowRightLeft, CheckCircle2, ChevronDown, Clock, Cog, HardHat, HelpCircle, Hourglass, LayoutGrid, Lightbulb, Loader2, LogOut, Minus, Moon,
  ExternalLink, FileText, PackageX, Pause, PenLine, Play, PlayCircle, Plus, RotateCcw, UserPlus, Users, X,
} from "lucide-react";
import { Logo } from "@/components/layout/Logo";
import { supabase } from "@/lib/supabase";
import { mensajeError, q } from "@/lib/consultas";
import { cn } from "@/lib/utilidades";
import { useManifiesto, useQuiosco } from "@/lib/instalada";
import { fecha, numero } from "@/lib/formato";
import { TIPOS_DOC } from "@/components/planos/PlanosArticulo";
import {
  CLAVE, cuandoAbre, useAsignaciones, useCuadrillas, useEtapas, useHorarioAhora, useHorasTaller, usePersonalPiso, usePiso, useProduccionEnVivo,
  type Etapa, type OperacionPiso, type PersonaPiso,
} from "./componentes/datos";
import { MOTIVOS_PAUSA, abreviarEquipo, folioCorto, haceRato, textoDias, tintaSobre, tonoCompromiso } from "./componentes/util";
import { AvanceEtapa } from "./componentes/AvanceEtapa";
import { DialogoIdea } from "./componentes/mejoras";
import { useSesion } from "@/lib/sesion";
import { GLOSARIO } from "@/tutorial/glosario";
import { AyudaDePantalla } from "@/tutorial/Explicacion";
import { CapaExplicacion } from "@/tutorial/CapaExplicacion";
import { PANTALLAS } from "@/tutorial/pantallas";

// La tablet se queda en su estación: etapa y nombres se recuerdan en el aparato.
const LS = { etapa: "terminal.etapa", nombre: "terminal.nombre", recientes: "terminal.recientes", cuadrilla: "terminal.cuadrilla." };
const leer = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const guardar = (k: string, v: string | null) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* modo privado */ } };

type Accion = "inicio" | "pausa" | "reanudar" | "fin" | "problema";
// Por qué se deja una etapa: un toque, para que el Pareto de horas detenidas salga de lo que pasa
// en el piso y no de una nota que nadie escribe. Mismas claves que el check de op_eventos.motivo.
type Motivo = "material" | "etapa_anterior" | "maquina" | "ingenieria" | "calidad" | "prioridad" | "otro";
const MOTIVOS: { clave: Motivo; icono: typeof Play }[] = [
  { clave: "material", icono: PackageX }, { clave: "etapa_anterior", icono: Hourglass }, { clave: "maquina", icono: Cog },
  { clave: "ingenieria", icono: PenLine }, { clave: "calidad", icono: RotateCcw }, { clave: "prioridad", icono: ArrowRightLeft }, { clave: "otro", icono: HelpCircle },
];
/** Quiénes trabajan una etapa: personas con nombre más las que no se sabe quiénes son. */
interface Cuadrilla { empleados: string[]; sinNombre: number }
const ACCIONES: Record<Accion, { texto: string; verbo: string; hecho: string; icono: typeof Play; clase: string }> = {
  inicio: { texto: "Iniciar", verbo: "Iniciar", hecho: "iniciada", icono: Play, clase: "bg-ok text-white" },
  pausa: { texto: "Pausar", verbo: "Pausar", hecho: "pausada", icono: Pause, clase: "bg-aviso text-white" },
  reanudar: { texto: "Reanudar", verbo: "Reanudar", hecho: "reanudada", icono: PlayCircle, clase: "bg-ok text-white" },
  fin: { texto: "Terminar", verbo: "Terminar", hecho: "terminada", icono: CheckCircle2, clase: "bg-marca text-white" },
  problema: { texto: "Problema", verbo: "Reportar problema en", hecho: "con problema reportado", icono: AlertTriangle, clase: "bg-superficie text-peligro border-2 border-peligro/50" },
};
const EXPLICA: Record<Accion, string> = {
  inicio: GLOSARIO.botonIniciarEtapa, pausa: GLOSARIO.botonPausarEtapa, reanudar: GLOSARIO.botonReanudarEtapa,
  fin: GLOSARIO.botonTerminarEtapa, problema: GLOSARIO.botonProblemaEtapa,
};


/**
 * Terminal de piso: una tablet por estación, la usan supervisores con guantes.
 * Botones enormes, nada de tablas, y cada marca dice quién la hizo. Ocupa toda
 * la pantalla (sin el menú) para que no se toque nada más por accidente.
 */
export default function Terminal() {
  // «Agregar a inicio» desde aquí instala la terminal (abre directo aquí), no el ERP completo.
  useManifiesto("/manifest-terminal.webmanifest");
  useQuiosco();
  useProduccionEnVivo(["op_eventos", "ordenes_produccion", "op_tiempos", "op_asignaciones"]);
  const etapas = useEtapas();
  const { puede, roles } = useSesion();
  const soloTerminal = roles.length === 1 && roles[0] === "terminal";
  const piso = usePiso({ intervalo: 60_000 });
  const modoHoras = useHorasTaller().data?.modo;
  // Fuera de horario lo iniciado no es «trabajando ahora»: o no cuenta (modo horario) o hay que pausar.
  const ahoraTaller = useHorarioAhora().data;
  const fuera = !!ahoraTaller && !ahoraTaller.en_horario;
  const [etapaId, setEtapaId] = useState<number | null>(() => Number(leer(LS.etapa)) || null);
  const [nombre, setNombre] = useState<string>(() => leer(LS.nombre) ?? "");
  const [recientes, setRecientes] = useState<string[]>(() => { try { return JSON.parse(leer(LS.recientes) ?? "[]"); } catch { return []; } });
  const [eligiendoNombre, setEligiendoNombre] = useState(false);
  const [idea, setIdea] = useState(false);
  const [pendiente, setPendiente] = useState<{ op: OperacionPiso; accion: Accion } | null>(null);
  // `deshacer`: la etapa que se acaba de terminar, por si fue un toque sin querer.
  const [aviso, setAviso] = useState<{ texto: string; folio?: string; tono: "ok" | "peligro"; deshacer?: OperacionPiso } | null>(null);
  const [ahora, setAhora] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setAhora(Date.now()), 30_000); return () => clearInterval(t); }, []);
  useEffect(() => { if (!aviso) return; const t = setTimeout(() => setAviso(null), aviso.deshacer ? 10000 : aviso.tono === "ok" ? 3000 : 6000); return () => clearTimeout(t); }, [aviso]);

  const etapa = etapas.data?.find((e) => e.id === etapaId) ?? null;
  const elegirEtapa = (id: number | null) => { setEtapaId(id); guardar(LS.etapa, id ? String(id) : null); };
  const elegirNombre = (n: string) => {
    const limpio = n.trim().replace(/\s+/g, " ");
    if (!limpio) return;
    setNombre(limpio); guardar(LS.nombre, limpio);
    const r = [limpio, ...recientes.filter((x) => x.toLowerCase() !== limpio.toLowerCase())].slice(0, 8);
    setRecientes(r); guardar(LS.recientes, JSON.stringify(r));
    setEligiendoNombre(false);
  };

  const qc = useQueryClient();
  const marcar = useMutation({
    mutationFn: (a: { op: OperacionPiso; accion: Accion; nota: string; cuadrilla?: Cuadrilla; motivo?: Motivo }) =>
      q(supabase.rpc("avanzar_operacion", { p_operacion: a.op.id, p_accion: a.accion, p_nota: a.nota || null, p_responsable: nombre || null,
        p_empleados: a.cuadrilla?.empleados ?? null, p_sin_nombre: a.cuadrilla?.sinNombre ?? 0, p_motivo: a.motivo ?? null })),
    onSuccess: (_, a) => {
      // La cuadrilla se recuerda por etapa: mañana suele ser la misma gente.
      if (a.cuadrilla) guardar(LS.cuadrilla + a.op.etapa_id, JSON.stringify(a.cuadrilla));
      setPendiente(null);
      setAviso({ tono: "ok", texto: `${a.op.etapa} ${ACCIONES[a.accion].hecho}`, folio: folioCorto(a.op.folio), deshacer: a.accion === "fin" ? a.op : undefined });
      qc.invalidateQueries({ queryKey: CLAVE });
    },
    onError: (e) => { setPendiente(null); setAviso({ tono: "peligro", texto: mensajeError(e) }); qc.invalidateQueries({ queryKey: CLAVE }); },
  });

  // Quien la terminó la regresa en los primeros 15 minutos; queda pausada para reanudarla con su gente.
  const deshacer = useMutation({
    mutationFn: (op: OperacionPiso) => q(supabase.rpc("reabrir_etapa", { p_operacion: op.id })),
    onSuccess: (_, op) => { setAviso({ tono: "ok", texto: `${op.etapa} regresó a pausada`, folio: folioCorto(op.folio) }); qc.invalidateQueries({ queryKey: CLAVE }); },
    onError: (e) => setAviso({ tono: "peligro", texto: mensajeError(e) }),
  });

  const pedir = (op: OperacionPiso, accion: Accion) => {
    setPendiente({ op, accion });
    if (!nombre) setEligiendoNombre(true);
  };

  const todas = piso.data ?? [];
  const deEtapa = todas.filter((o) => o.etapa_id === etapaId);
  // Primero el orden que dejó la gerencia en la cola de Cuadrillas; lo que nadie acomodó, por prioridad y fecha.
  const orden = (a: OperacionPiso, b: OperacionPiso) => (a.turno ?? 9999) - (b.turno ?? 9999) || a.prioridad - b.prioridad
    || (a.dias_restantes ?? 9999) - (b.dias_restantes ?? 9999);
  // Los planos de las órdenes de esta etapa, en una sola consulta para todas las tarjetas.
  const idsOrden = [...new Set(deEtapa.map((o) => o.orden_id))].sort();
  const planos = useQuery({
    queryKey: [...CLAVE, "planos_piso", idsOrden.join(",")], enabled: idsOrden.length > 0, staleTime: 5 * 60_000,
    queryFn: () => q<PlanoOrden[]>(supabase.from("v_planos_orden")
      .select("orden_id, documento_id, folio, revision, revision_vigente, tipo, titulo, drive_url, registrado_en").in("orden_id", idsOrden).order("folio")),
  });
  const planosDe = useMemo(() => {
    const m = new Map<string, PlanoOrden[]>();
    // En Corte lo primero es el corte y el programa de plasma; en las demás, el plano.
    const peso = (t: string) => { const i = (/corte/i.test(etapa?.nombre ?? "") ? ORDEN_DOC_CORTE : ORDEN_DOC).indexOf(t); return i < 0 ? 99 : i; };
    for (const d of planos.data ?? []) m.set(d.orden_id, [...(m.get(d.orden_id) ?? []), d]);
    for (const l of m.values()) l.sort((a, b) => peso(a.tipo) - peso(b.tipo) || a.folio.localeCompare(b.folio));
    return m;
  }, [planos.data, etapa?.nombre]);
  const trabajando = deEtapa.filter((o) => o.estado !== "pendiente").sort(orden);
  const listas = deEtapa.filter((o) => o.estado === "pendiente" && o.lista).sort(orden);
  const despues = deEtapa.filter((o) => o.estado === "pendiente" && !o.lista).sort(orden);

  return (
    <div className="fixed inset-0 z-[35] bg-fondo flex flex-col text-lg">
      <header className="h-16 shrink-0 flex items-center gap-2 sm:gap-3 px-3 sm:px-5 border-b border-borde bg-superficie">
        {/* En la tablet no hay a dónde salir: solo abre la terminal. */}
        {!soloTerminal && <Link to="/" className="p-2 -ml-2 text-tenue" aria-label="Salir de la terminal"><ArrowLeft className="h-6 w-6" /></Link>}
        {/* En un iPad vertical (810 px) el logo no cabe junto a los botones con su texto: los
            botones mandan, y la etapa y el nombre de quien trabaja se leen completos. */}
        <Logo className="hidden lg:flex" />
        <span className="hidden xl:inline text-tenue">Terminal de piso</span>
        <div className="ml-auto flex items-center gap-2 min-w-0">
          {/* Una idea de mejora se propone aquí mismo, con el nombre de quien está en la tablet. */}
          <button onClick={() => setIdea(true)} aria-label="Tengo una idea de mejora" data-explain={GLOSARIO.botonProponerIdea} data-explain-title="Tengo una idea"
                  className="h-12 rounded-xl px-3 sm:px-4 flex items-center gap-2 border-2 border-marca/50 bg-superficie text-marca-texto font-semibold shrink-0">
            <Lightbulb className="h-6 w-6 shrink-0" /><span className="hidden sm:inline">Tengo una idea</span>
          </button>
          {/* Una máquina descompuesta se reporta desde aquí mismo, con foto (antes: foto al chat). */}
          {puede("mantenimiento", 2) && (
            <Link to={`/servicio/reportar?volver=/produccion/terminal${etapaId ? `&etapa=${etapaId}` : ""}`}
                  className="h-12 rounded-xl px-3 sm:px-4 flex items-center gap-2 border-2 border-peligro/60 bg-superficie text-peligro font-semibold shrink-0" aria-label="Reportar falla de una máquina"
                  data-explain={GLOSARIO.botonReportarFallaTerminal} data-explain-title="Reportar falla">
              <AlertTriangle className="h-6 w-6 shrink-0" /><span className="hidden sm:inline">Reportar falla</span>
            </Link>
          )}
          {etapa && (
            <button onClick={() => elegirEtapa(null)} className="h-12 rounded-xl px-3 sm:px-4 flex items-center gap-2 font-semibold min-w-0 shrink-0 max-w-[11rem]"
                    style={{ background: etapa.color, color: tintaSobre(etapa.color) }} aria-label="Cambiar de etapa"
                    data-explain={GLOSARIO.botonCambiarEtapaTerminal} data-explain-title="Cambiar de etapa">
              <span className="truncate">{etapa.nombre}</span><ChevronDown className="h-5 w-5 shrink-0" />
            </button>
          )}
          <button onClick={() => setEligiendoNombre(true)} data-explain={GLOSARIO.quienMarcaTerminal} data-explain-title="¿Quién trabaja?"
                  className={cn("h-12 rounded-xl px-3 sm:px-4 flex items-center gap-2 border-2 min-w-0", nombre ? "border-borde bg-superficie" : "border-aviso bg-aviso-suave text-aviso")}>
            <HardHat className="h-6 w-6 shrink-0" />
            <span className="truncate max-w-[9rem] sm:max-w-[14rem]">{nombre || "¿Quién trabaja?"}</span>
          </button>
        </div>
      </header>

      {idea && <DialogoIdea abierto alCambiar={setIdea} grande quien={nombre} semilla={{ etapa: etapaId }} />}
      <main className="flex-1 overflow-y-auto">
        {!etapa ? (
          <ElegirEtapa etapas={etapas.data ?? []} cargando={etapas.isLoading} piso={todas} alElegir={elegirEtapa} />
        ) : (
          <div className="max-w-7xl mx-auto p-3 sm:p-4 space-y-4">
            <AyudaDePantalla className="text-base" ayuda={PANTALLAS["/produccion/terminal"]} ruta="/produccion/terminal" />
            <div className="flex items-center gap-3">
              <span className="h-8 w-2.5 rounded-full" style={{ background: etapa.color }} />
              <h1 className="text-2xl font-bold">{etapa.nombre}</h1>
              <span className="text-tenue">{deEtapa.length} {deEtapa.length === 1 ? "orden" : "órdenes"}</span>
              <button onClick={() => elegirEtapa(null)} className="ml-auto h-11 px-4 rounded-xl border border-borde bg-superficie flex items-center gap-2"
                      data-explain={GLOSARIO.botonCambiarEtapaTerminal} data-explain-title="Otra etapa">
                <LayoutGrid className="h-5 w-5" /><span className="hidden sm:inline">Otra etapa</span>
              </button>
            </div>
            {/* Lo que más se pregunta en el piso: ¿hay que pausar para desayunar? Depende del modo. */}
            {modoHoras && (
              <p className={cn("flex items-center gap-2 text-sm leading-snug", modoHoras === "terminal" ? "text-aviso" : "text-tenue")}
                 data-explain={fuera ? GLOSARIO.fueraDeHorario : GLOSARIO.horasTaller} data-explain-title={fuera ? "Fuera de horario" : "¿Hay que pausar?"}>
                {fuera ? <Moon className="h-4 w-4 shrink-0" /> : <Clock className="h-4 w-4 shrink-0" />}
                {modoHoras === "terminal"
                  ? fuera ? "Fuera de horario: lo que esté iniciado sigue contando. Si ya se van, pausen."
                    : "Pausa al desayunar, al comer y al irte: el tiempo corre mientras la etapa esté iniciada."
                  : fuera ? `Fuera de horario: lo iniciado no cuenta ahorita y sigue solo ${cuandoAbre(ahoraTaller?.abre ?? null) ?? "cuando abra el taller"}.`
                    : "No hace falta pausar para desayunar, comer o al irte: solo cuenta el horario del taller. Pausa cuando dejen esta orden."}
              </p>
            )}
            {piso.isLoading ? <div className="flex justify-center py-20"><Loader2 className="h-10 w-10 animate-spin text-tenue" /></div> : deEtapa.length === 0 ? (
              <div className="tarjeta p-10 text-center">
                <CheckCircle2 className="h-14 w-14 text-ok mx-auto mb-3" />
                <p className="text-2xl font-semibold">Nada pendiente en {etapa.nombre}</p>
                <p className="text-tenue mt-2">Cuando la gerencia libere órdenes con esta etapa, aparecerán aquí.</p>
              </div>
            ) : (
              <>
                <Seccion titulo={fuera ? "Iniciadas (fuera de horario)" : "Trabajando ahora"} explica={GLOSARIO.terminalTrabajandoAhora} lista={trabajando} pedir={pedir} ahora={ahora} planos={planosDe} />
                <Seccion titulo="Listas para empezar" explica={GLOSARIO.terminalListasParaEmpezar} lista={listas} pedir={pedir} ahora={ahora} planos={planosDe} />
                <Seccion titulo="Todavía en otra etapa" explica={GLOSARIO.terminalEnOtraEtapa} ayuda="Se pueden empezar si hace falta" lista={despues} pedir={pedir} ahora={ahora} planos={planosDe} tenue />
              </>
            )}
          </div>
        )}
      </main>

      {eligiendoNombre && (
        <ElegirNombre actual={nombre} recientes={recientes} alElegir={elegirNombre}
                      alCerrar={() => { setEligiendoNombre(false); if (!nombre) setPendiente(null); }} />
      )}
      {pendiente && nombre && !eligiendoNombre && (
        <Confirmar p={pendiente} nombre={nombre} cargando={marcar.isPending} alCambiarNombre={() => setEligiendoNombre(true)}
                   alCancelar={() => setPendiente(null)} alConfirmar={(nota, cuadrilla, motivo) => marcar.mutate({ ...pendiente, nota, cuadrilla, motivo })} />
      )}
      {aviso && (
        <div role="status" aria-live="assertive" onClick={() => setAviso(null)}
             className={cn("fixed inset-x-3 top-20 z-[70] mx-auto max-w-3xl rounded-2xl px-6 py-5 shadow-2xl flex items-center gap-4 text-2xl font-semibold",
               aviso.tono === "ok" ? "bg-ok text-white" : "bg-peligro text-white")}>
          {aviso.tono === "ok" ? <CheckCircle2 className="h-10 w-10 shrink-0" /> : <AlertTriangle className="h-10 w-10 shrink-0" />}
          <span className="flex-1">{aviso.texto}{aviso.folio && <> · <span className="whitespace-nowrap">{aviso.folio}</span></>}</span>
          {aviso.deshacer && (
            <button onClick={(e) => { e.stopPropagation(); deshacer.mutate(aviso.deshacer!); }} disabled={deshacer.isPending}
                    data-explain={GLOSARIO.reabrirEtapa} data-explain-title="Deshacer"
                    className="shrink-0 rounded-xl bg-white/20 hover:bg-white/30 px-5 py-3 text-xl font-semibold">Deshacer</button>
          )}
        </div>
      )}
      {/* La terminal vive fuera del marco del ERP, donde se monta la capa de los globos: sin esta,
          con el modo tutorial encendido se marcaba lo explicable pero nada se explicaba. */}
      <CapaExplicacion />
    </div>
  );
}

function ElegirEtapa({ etapas, cargando, piso, alElegir }: { etapas: Etapa[]; cargando: boolean; piso: OperacionPiso[]; alElegir: (id: number) => void }) {
  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6">
      <h1 className="text-3xl font-bold mb-1">¿En qué etapa estás?</h1>
      <p className="text-tenue mb-5">La tablet se queda en esta etapa hasta que la cambies.</p>
      {cargando ? <Loader2 className="h-10 w-10 animate-spin text-tenue" /> : (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {etapas.map((e) => {
            const de = piso.filter((o) => o.etapa_id === e.id);
            const activos = de.filter((o) => o.estado !== "pendiente").length;
            const listas = de.filter((o) => o.estado === "pendiente" && o.lista).length;
            return (
              <button key={e.id} onClick={() => alElegir(e.id)} className="min-h-[7.5rem] rounded-2xl p-5 text-left shadow-sm active:scale-[0.98] transition"
                      data-explain={GLOSARIO.elegirEtapaTerminal} data-explain-title={e.nombre}
                      style={{ background: e.color, color: tintaSobre(e.color) }}>
                <span className="block text-3xl font-bold">{e.nombre}</span>
                <span className="block mt-2 text-lg opacity-95">
                  {de.length === 0 ? "Sin órdenes"
                    : activos + listas === 0 ? `${de.length} en espera de otra etapa`
                    : `${activos} trabajando · ${listas} ${listas === 1 ? "lista" : "listas"} para empezar`}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Seccion({ titulo, ayuda, explica, lista, pedir, ahora, tenue, planos }: {
  titulo: string; ayuda?: string; explica?: string; lista: OperacionPiso[]; pedir: (o: OperacionPiso, a: Accion) => void; ahora: number; tenue?: boolean;
  planos: Map<string, PlanoOrden[]>;
}) {
  if (lista.length === 0) return null;
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold" data-explain={explica} data-explain-title={explica ? titulo : undefined}>{titulo} <span className="text-tenue font-normal">{lista.length}</span>
        {ayuda && <span className="block text-base font-normal text-tenue">{ayuda}</span>}</h2>
      {/* En un iPad acostado (1080 px) caben dos columnas; parado (810 px), una. */}
      <div className="grid gap-3 lg:grid-cols-2 items-start">
        {lista.map((o) => <TarjetaPiso key={o.id} o={o} pedir={pedir} ahora={ahora} tenue={tenue} planos={planos.get(o.orden_id) ?? []} />)}
      </div>
    </section>
  );
}

function TarjetaPiso({ o, pedir, ahora, tenue, planos }: {
  o: OperacionPiso; pedir: (o: OperacionPiso, a: Accion) => void; ahora: number; tenue?: boolean; planos: PlanoOrden[];
}) {
  const [viendo, setViendo] = useState<"planos" | "material" | null>(null);
  const tono = tonoCompromiso(o.dias_restantes);
  const botones: Accion[] = o.estado === "pendiente" ? ["inicio", "problema"] : o.estado === "en_proceso" ? ["pausa", "fin", "problema"] : ["reanudar", "fin", "problema"];
  return (
    <article className={cn("tarjeta p-3 sm:p-4 border-l-[6px] flex flex-col md:flex-row gap-3", tenue && "opacity-90")} style={{ borderLeftColor: o.color }}>
      {/* Antes todo iba apilado y cabían dos órdenes por pantalla. Con los botones a un lado la
          tarjeta mide poco más de la mitad: caben cuatro paradas, y más en dos columnas. */}
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-base cifra truncate"><b>{folioCorto(o.folio)}</b><span className="text-tenue">{o.numero_serie && ` · ${o.numero_serie}`}</span></p>
            <p className="text-xl font-bold leading-tight">{abreviarEquipo(o.equipo)}</p>
            <p className="text-base text-tenue">{o.pedido_folio ? <><span className="cifra">{o.pedido_folio}</span> · {o.cliente ?? "—"}</> : "Para stock"}</p>
          </div>
          <div className="text-right shrink-0">
            <span className={cn("inline-block rounded-lg px-2.5 py-0.5 text-base font-semibold whitespace-nowrap",
              tono === "peligro" ? "bg-peligro text-white" : tono === "aviso" ? "bg-aviso text-white" : "bg-ok-suave text-ok")}
              data-explain={GLOSARIO.fechaCompromiso} data-explain-title="Fecha compromiso">
              {textoDias(o.dias_restantes)}
            </span>
            <p className="text-sm text-tenue mt-0.5 cifra whitespace-nowrap">{fecha(o.fecha_compromiso)}</p>
            {o.prioridad === 1 && <p className="text-base font-semibold text-peligro" data-explain={GLOSARIO.prioridadOrden} data-explain-title="Urgente">Urgente</p>}
          </div>
        </div>

        <div className="text-base space-y-1.5">
          {o.estado === "en_proceso" && <p className="font-medium text-marca-texto">● En proceso{o.inicio && ` · empezó ${haceRato(o.inicio, ahora)}`}</p>}
          {o.estado === "en_proceso" && <CuadrillaEnEtapa o={o} ahora={ahora} />}
          {o.estado === "pausada" && <p className="font-semibold text-aviso" data-explain={GLOSARIO.etapaPausada} data-explain-title="Pausada">❚❚ Pausada{o.responsable && ` · ${o.responsable}`}</p>}
          {o.estado !== "en_proceso" && <LeToca o={o} />}
          {(o.estado === "en_proceso" || o.estado === "pausada") && <AvanceEtapa operacion={o.id} avance={o.avance_etapa} grande />}
          {o.estado === "pendiente" && (o.lista ? <p className="text-ok font-medium">Lista para empezar</p> : <p className="text-tenue">Todavía en {o.espera_a}</p>)}
          {o.ultimo_problema && o.estado !== "pendiente" && (
            <p className="text-peligro flex gap-2"><AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" /><span>{o.ultimo_problema} <span className="text-tenue">({haceRato(o.ultimo_problema_en, ahora)})</span></span></p>
          )}
          {/* Lo que el encargado iba a buscar a otro lado: con qué plano se hace y qué material no ha llegado. */}
          {(planos.length > 0 || o.materiales_faltantes > 0) && (
            <div className="flex flex-wrap gap-2">
              {planos.length > 0 && (
                <button type="button" onClick={() => setViendo("planos")} className="h-11 rounded-xl border-2 border-borde px-3 flex items-center gap-2 font-medium"
                        data-explain={GLOSARIO.botonPlanosTerminal} data-explain-title="Planos">
                  <FileText className="h-5 w-5 shrink-0" />Planos <span className="text-tenue cifra">{planos.length}</span>
                  {planos.some(planoCambio) && <AlertTriangle className="h-5 w-5 text-peligro shrink-0" aria-label="Hay una revisión nueva" />}
                </button>
              )}
              {o.materiales_faltantes > 0 && (
                <button type="button" onClick={() => setViendo("material")} className="h-11 rounded-xl border-2 border-aviso/50 text-aviso px-3 flex items-center gap-2 font-medium"
                        data-explain={GLOSARIO.botonFaltantesTerminal} data-explain-title="Material con faltante">
                  <PackageX className="h-5 w-5 shrink-0" />{o.materiales_faltantes} con faltante
                </button>
              )}
            </div>
          )}
        </div>
        {viendo === "planos" && <PlanosDeOrden o={o} planos={planos} alCerrar={() => setViendo(null)} />}
        {viendo === "material" && <MaterialFaltante o={o} alCerrar={() => setViendo(null)} />}
      </div>

      <div className={cn("shrink-0 grid gap-2 content-start md:w-40 lg:w-[8.25rem] xl:w-40 md:grid-cols-1", botones.length === 3 ? "grid-cols-3" : "grid-cols-2")}>
        {botones.map((a) => {
          const A = ACCIONES[a];
          return (
            <button key={a} onClick={() => pedir(o, a)} data-explain={EXPLICA[a]} data-explain-title={A.texto}
                    className={cn("min-h-[56px] rounded-xl px-2 text-lg lg:text-base xl:text-lg font-bold flex items-center justify-center gap-2 lg:gap-1.5 xl:gap-2 shadow-sm active:scale-[0.98] transition", A.clase)}>
              <A.icono className="h-6 w-6 lg:h-5 lg:w-5 xl:h-6 xl:w-6 shrink-0" />{A.texto}
            </button>
          );
        })}
      </div>
    </article>
  );
}

interface PlanoOrden {
  orden_id: string; documento_id: string; folio: string; revision: string; revision_vigente: string | null;
  tipo: string; titulo: string; drive_url: string; registrado_en: string | null;
}
const ORDEN_DOC = ["plano", "corte", "programa_cnc", "ficha", "modelo_3d", "foto", "carpeta", "otro"];
const ORDEN_DOC_CORTE = ["corte", "programa_cnc", "plano", "ficha", "modelo_3d", "foto", "carpeta", "otro"];
/** La orden se revisó con una revisión y ya salió otra: hay que confirmar con ingeniería antes de seguir. */
const planoCambio = (p: PlanoOrden) => !!p.registrado_en && !!p.revision_vigente && p.revision_vigente !== p.revision;

/** Los planos con los que se fabrica esta orden; cada uno abre su archivo. */
function PlanosDeOrden({ o, planos, alCerrar }: { o: OperacionPiso; planos: PlanoOrden[]; alCerrar: () => void }) {
  return (
    <Modal titulo={`Planos · ${folioCorto(o.folio)}`} alCerrar={alCerrar}>
      <p className="text-tenue -mt-2 mb-4">{abreviarEquipo(o.equipo)}</p>
      <div className="space-y-2">
        {planos.map((p) => (
          <a key={p.documento_id} href={p.drive_url} target="_blank" rel="noreferrer"
             className={cn("flex items-center gap-3 rounded-2xl border-2 p-3 min-h-[64px] active:scale-[0.99] transition", planoCambio(p) ? "border-peligro/50 bg-peligro-suave/40" : "border-borde")}>
            <span className="h-11 w-11 rounded-xl bg-fondo grid place-items-center font-bold shrink-0" aria-label={`Revisión ${p.revision}`}>{p.revision}</span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold leading-tight">{p.titulo}</span>
              <span className="block text-base text-tenue">{TIPOS_DOC[p.tipo] ?? p.tipo} · <span className="cifra">{p.folio}</span></span>
              {planoCambio(p) && <span className="block text-base text-peligro font-medium">Ya salió la revisión {p.revision_vigente}: confirma con ingeniería antes de seguir.</span>}
            </span>
            <ExternalLink className="h-6 w-6 text-marca-texto shrink-0" />
          </a>
        ))}
      </div>
      <p className="text-base text-tenue mt-4">Se abren desde Drive. Si pide iniciar sesión, avisa a tu encargado.</p>
    </Modal>
  );
}

interface Faltante {
  id: string; clave: string; nombre: string; unidad: string; faltante: number; pedido_a_compras: number; tipo: string; categoria: string | null;
}

/** Qué material de la orden no está ni surtido ni apartado, y si ya se pidió a compras. */
function MaterialFaltante({ o, alCerrar }: { o: OperacionPiso; alCerrar: () => void }) {
  const mat = useQuery({
    queryKey: [...CLAVE, "faltante_orden", o.orden_id],
    queryFn: () => q<Faltante[]>(supabase.from("v_op_material")
      .select("id, clave, nombre, unidad, faltante, pedido_a_compras, tipo, categoria").eq("orden_id", o.orden_id).gt("faltante", 0).order("nombre")),
  });
  const lista = mat.data ?? [];
  const pedido = (m: Faltante) => Number(m.pedido_a_compras) >= Number(m.faltante) - 0.0005;
  const grupos = useMemo(() => {
    const g = new Map<string, Faltante[]>();
    for (const m of lista) { const k = m.categoria ?? "Sin categoría"; g.set(k, [...(g.get(k) ?? []), m]); }
    return [...g.entries()].sort(([a], [b]) => (a === "Sin categoría" ? 1 : b === "Sin categoría" ? -1 : a.localeCompare(b, "es")));
  }, [lista]);
  const sinPedir = lista.filter((m) => !pedido(m)).length;
  return (
    <Modal titulo={`Falta material · ${folioCorto(o.folio)}`} alCerrar={alCerrar}>
      <p className="text-tenue -mt-2 mb-3">{abreviarEquipo(o.equipo)}</p>
      {mat.isLoading ? <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-tenue" /></div>
        : mat.error ? <p className="text-peligro">{mensajeError(mat.error)}</p>
        : lista.length === 0 ? <p className="text-ok font-medium py-6 text-center">Ya no falta nada: todo está surtido o apartado.</p> : (
        <>
          <p className="mb-3">
            <b>{lista.length}</b> {lista.length === 1 ? "material" : "materiales"}
            {sinPedir > 0 ? <> · <span className="text-peligro font-semibold">{sinPedir} sin pedir a compras</span></> : <> · <span className="text-ok font-medium">todo ya se pidió a compras</span></>}
          </p>
          <div className="space-y-3">
            {grupos.map(([grupo, filas]) => (
              <section key={grupo}>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-tenue mb-1">{grupo} · {filas.length}</h3>
                <ul className="divide-y divide-borde rounded-2xl border border-borde">
                  {filas.map((m) => (
                    <li key={m.id} className="flex items-start justify-between gap-3 px-3 py-2">
                      <span className="min-w-0">
                        <span className="block font-medium leading-snug">{m.nombre}</span>
                        <span className="block text-sm text-tenue cifra">{m.clave}</span>
                      </span>
                      <span className="text-right shrink-0">
                        <span className="block font-bold cifra whitespace-nowrap">{numero(m.faltante)} <span className="font-normal text-base text-tenue">{m.unidad}</span></span>
                        <span className={cn("block text-sm whitespace-nowrap", m.tipo === "servicio" ? "text-tenue" : pedido(m) ? "text-ok" : "text-peligro font-medium")}>
                          {m.tipo === "servicio" ? (pedido(m) ? "Servicio · ya pedido" : "Servicio · sin pedir") : pedido(m) ? "Ya pedido a compras" : "Sin pedir"}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          <p className="text-base text-tenue mt-4">Lo surte almacén cuando llega. Si te detiene, pausa la orden y elige «Falta material».</p>
        </>
      )}
    </Modal>
  );
}

function Modal({ children, alCerrar, titulo }: { children: React.ReactNode; alCerrar: () => void; titulo: string }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") alCerrar(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [alCerrar]);
  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-label={titulo}>
      <div className="w-full sm:max-w-xl bg-superficie rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 sm:p-6 max-h-[92vh] overflow-y-auto text-lg">
        <div className="flex items-start justify-between gap-3 mb-4">
          <h2 className="text-2xl font-bold">{titulo}</h2>
          <button onClick={alCerrar} className="h-12 w-12 -mr-2 -mt-2 rounded-xl flex items-center justify-center text-tenue" aria-label="Cerrar"><X className="h-7 w-7" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ElegirNombre({ actual, recientes, alElegir, alCerrar }: { actual: string; recientes: string[]; alElegir: (n: string) => void; alCerrar: () => void }) {
  const [otro, setOtro] = useState("");
  // Nombres que ya se usaron en el taller, por si la tablet es nueva.
  const sugeridos = useQuery({
    queryKey: [...CLAVE, "responsables"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const r = await q<{ responsable: string }[]>(supabase.from("op_operaciones").select("responsable").not("responsable", "is", null).limit(300));
      return [...new Set(r.map((x) => x.responsable))].sort((a, b) => a.localeCompare(b, "es"));
    },
  });
  const opciones = useMemo(() => {
    const vistos = new Set(recientes.map((n) => n.toLowerCase()));
    return [...recientes, ...(sugeridos.data ?? []).filter((n) => !vistos.has(n.toLowerCase()))].slice(0, 12);
  }, [recientes, sugeridos.data]);
  return (
    <Modal titulo="¿Quién trabaja?" alCerrar={alCerrar}>
      {opciones.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-5">
          {opciones.map((n) => (
            <button key={n} onClick={() => alElegir(n)}
                    className={cn("min-h-[60px] rounded-xl border-2 px-4 text-left text-xl font-medium flex items-center gap-3",
                      n === actual ? "border-marca bg-marca-suave" : "border-borde bg-superficie")}>
              <HardHat className="h-6 w-6 text-tenue shrink-0" /><span className="truncate">{n}</span>
            </button>
          ))}
        </div>
      )}
      <form onSubmit={(e) => { e.preventDefault(); alElegir(otro); }} className="space-y-3">
        <label className="block text-lg font-medium" htmlFor="otro-nombre">{opciones.length ? "Otro nombre" : "Tu nombre"}</label>
        <input id="otro-nombre" value={otro} onChange={(e) => setOtro(e.target.value)} autoComplete="off"
               className="w-full h-16 rounded-xl border-2 border-borde bg-superficie px-4 text-xl focus:outline-none focus:border-marca" placeholder="Nombre y apellido" />
        <button type="submit" disabled={!otro.trim()} className="w-full min-h-[64px] rounded-xl bg-marca text-white text-xl font-bold disabled:opacity-40">Soy yo</button>
      </form>
    </Modal>
  );
}

function Confirmar({ p, nombre, cargando, alConfirmar, alCancelar, alCambiarNombre }: {
  p: { op: OperacionPiso; accion: Accion }; nombre: string; cargando: boolean;
  alConfirmar: (nota: string, cuadrilla?: Cuadrilla, motivo?: Motivo) => void; alCancelar: () => void; alCambiarNombre: () => void;
}) {
  const [nota, setNota] = useState("");
  // Al pausar el motivo es obligatorio; «Otro» deja escribir una nota antes de pausar.
  const [motivo, setMotivo] = useState<Motivo | null>(null);
  const A = ACCIONES[p.accion];
  const pausa = p.accion === "pausa";
  const obligatoria = p.accion === "problema";
  const conCuadrilla = p.accion === "inicio" || p.accion === "reanudar";
  const personal = usePersonalPiso();
  const asignaciones = useAsignaciones();
  // Primero la cuadrilla que planeó la gerencia en el tablero; si no hay, la última de esta tablet.
  const planeados = (asignaciones.data ?? []).filter((a) => a.operacion_id === p.op.id).map((a) => a.empleado_id);
  const [propia, setCuadrilla] = useState<Cuadrilla | null>(null);
  const cuadrilla: Cuadrilla = propia ?? (planeados.length > 0 ? { empleados: planeados, sinNombre: 0 } : (() => {
    try { return JSON.parse(leer(LS.cuadrilla + p.op.etapa_id) ?? "") as Cuadrilla; } catch { return { empleados: [], sinNombre: 0 }; }
  })());
  // Quien ya está en otra etapa no se preselecciona (la base no lo deja estar en dos).
  const libres = new Set((personal.data ?? []).filter((x) => !x.trabajando_en).map((x) => x.id));
  const elegidos = { ...cuadrilla, empleados: cuadrilla.empleados.filter((id) => libres.has(id)) };
  const cuantos = elegidos.empleados.length + elegidos.sinNombre;
  return (
    <Modal titulo={`${A.verbo} ${p.op.etapa}`} alCerrar={alCancelar}>
      <div className="rounded-xl bg-fondo p-4 mb-4">
        <p className="cifra"><b>{folioCorto(p.op.folio)}</b><span className="text-tenue">{p.op.numero_serie && ` · ${p.op.numero_serie}`}</span></p>
        <p className="text-xl font-bold">{abreviarEquipo(p.op.equipo)}</p>
        <p className="text-tenue">{p.op.cliente ?? "Para stock"}</p>
      </div>
      <p className="mb-4 flex flex-wrap items-center gap-2">
        <HardHat className="h-6 w-6 text-tenue" />Lo marca <b>{nombre}</b>
        <button onClick={alCambiarNombre} className="text-marca-texto underline underline-offset-4 min-h-[44px] px-1"
                data-explain={GLOSARIO.quienMarcaTerminal} data-explain-title="No soy yo">No soy yo</button>
      </p>
      {conCuadrilla && (
        <div className="mb-5" data-explain={GLOSARIO.cuadrillaEtapa} data-explain-title="Cuadrilla">
          <p className="font-medium mb-2 flex items-center gap-2"><Users className="h-6 w-6 text-tenue" />¿Quiénes trabajan? <span className="text-tenue font-normal">{cuantos} {cuantos === 1 ? "persona" : "personas"}</span></p>
          <ElegirPersonas etapaId={p.op.etapa_id} personal={personal.data ?? []} cargando={personal.isLoading} valor={elegidos} alCambiar={setCuadrilla} />
        </div>
      )}
      {pausa && (
        <div className="mb-5" data-explain={GLOSARIO.motivoPausa} data-explain-title="¿Por qué la dejan?">
          <p className="font-medium mb-2">¿Por qué la dejan?</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {MOTIVOS.map((m) => (
              <button key={m.clave} type="button" disabled={cargando}
                      onClick={() => { if (m.clave === "otro") setMotivo("otro"); else alConfirmar(nota.trim(), undefined, m.clave); }}
                      className={cn("min-h-[64px] rounded-xl border-2 px-4 text-left text-xl font-semibold flex items-center gap-3 active:scale-[0.98] transition disabled:opacity-50",
                        motivo === m.clave ? "border-aviso bg-aviso-suave" : "border-borde bg-superficie")}>
                <m.icono className="h-7 w-7 shrink-0 text-aviso" /><span>{MOTIVOS_PAUSA[m.clave]}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {(!pausa || motivo === "otro") && <>
      <label className="block font-medium mb-2" htmlFor="nota-piso">{obligatoria ? "¿Cuál es el problema?" : "Nota (opcional)"}</label>
      <textarea id="nota-piso" value={nota} onChange={(e) => setNota(e.target.value)} rows={3} autoFocus={obligatoria || pausa}
                className="w-full rounded-xl border-2 border-borde bg-superficie p-3 text-xl focus:outline-none focus:border-marca"
                placeholder={obligatoria ? "Falta lámina, la máquina no prende…" : pausa ? "¿Qué pasó?" : ""} />
      </>}
      <div className="grid grid-cols-2 gap-3 mt-5">
        <button onClick={alCancelar} className={cn("min-h-[64px] rounded-xl border-2 border-borde bg-superficie text-xl font-semibold", pausa && motivo !== "otro" && "col-span-2")}>Cancelar</button>
        {(!pausa || motivo === "otro") &&
        <button onClick={() => alConfirmar(nota.trim(), conCuadrilla ? elegidos : undefined, pausa ? motivo ?? undefined : undefined)}
                disabled={cargando || (obligatoria && !nota.trim()) || (conCuadrilla && cuantos === 0)}
                className={cn("min-h-[64px] rounded-xl text-xl font-bold flex items-center justify-center gap-2 disabled:opacity-40", A.clase)}>
          {cargando ? <Loader2 className="h-7 w-7 animate-spin" /> : <A.icono className="h-7 w-7" />}{A.texto}
        </button>}
      </div>
    </Modal>
  );
}

/**
 * Botones grandes con el personal: primero los de esta etapa (según su ficha), luego los
 * demás. Quien ya está en otra etapa sale apagado con dónde está. "Sin nombre" es para el
 * ayudante de paso o alguien sin alta: cuenta igual en las horas hombre.
 */
function ElegirPersonas({ etapaId, personal, cargando, valor, alCambiar, uno }: {
  etapaId: number; personal: PersonaPiso[]; cargando: boolean; valor: Cuadrilla; alCambiar: (c: Cuadrilla) => void; uno?: boolean;
}) {
  const [todos, setTodos] = useState(false);
  const deEtapa = personal.filter((x) => x.etapa_id === etapaId);
  const lista = todos || deEtapa.length === 0 ? [...deEtapa, ...personal.filter((x) => x.etapa_id !== etapaId)] : deEtapa;
  const cambiar = (id: string) => alCambiar(uno ? { empleados: [id], sinNombre: 0 }
    : { ...valor, empleados: valor.empleados.includes(id) ? valor.empleados.filter((x) => x !== id) : [...valor.empleados, id] });
  if (cargando) return <Loader2 className="h-8 w-8 animate-spin text-tenue" />;
  return (
    <div className="space-y-3">
      {personal.length === 0 && <p className="text-tenue">No hay personal activo dado de alta: usa «Sin nombre» y pide a Recursos Humanos que los registre.</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {lista.map((x) => {
          const sel = valor.empleados.includes(x.id);
          return (
            <button key={x.id} type="button" disabled={!!x.trabajando_en} onClick={() => cambiar(x.id)}
                    className={cn("min-h-[56px] rounded-xl border-2 px-3 text-left flex items-center gap-3 disabled:opacity-50",
                      sel ? "border-marca bg-marca-suave" : "border-borde bg-superficie")}>
              <HardHat className={cn("h-6 w-6 shrink-0", sel ? "text-marca-texto" : "text-tenue")} />
              <span className="min-w-0"><span className="block truncate text-lg font-medium">{x.nombre}</span>
                {x.trabajando_en && <span className="block text-sm text-tenue truncate">En {x.trabajando_en}</span>}</span>
            </button>
          );
        })}
      </div>
      {!todos && deEtapa.length > 0 && deEtapa.length < personal.length && (
        <button type="button" onClick={() => setTodos(true)} className="text-marca-texto underline underline-offset-4 min-h-[44px]">Ver a todo el personal</button>
      )}
      <div className="flex items-center gap-3 rounded-xl border-2 border-dashed border-borde px-3 py-2" data-explain={GLOSARIO.sinNombreCuadrilla} data-explain-title="Sin nombre">
        <span className="flex-1">Sin nombre <span className="text-tenue text-base">(ayudante de paso)</span></span>
        {!uno && <button type="button" aria-label="Uno menos sin nombre" disabled={valor.sinNombre === 0} onClick={() => alCambiar({ ...valor, sinNombre: valor.sinNombre - 1 })}
                className="h-12 w-12 rounded-xl border-2 border-borde flex items-center justify-center disabled:opacity-40"><Minus className="h-6 w-6" /></button>}
        {!uno && <span className="w-8 text-center text-2xl font-bold cifra">{valor.sinNombre}</span>}
        <button type="button" aria-label="Uno más sin nombre" disabled={valor.sinNombre >= 10}
                onClick={() => alCambiar(uno ? { empleados: [], sinNombre: 1 } : { ...valor, sinNombre: valor.sinNombre + 1 })}
                className={cn("h-12 rounded-xl border-2 flex items-center justify-center gap-1 px-3 disabled:opacity-40",
                  uno && valor.sinNombre > 0 ? "border-marca bg-marca-suave" : "border-borde")}><Plus className="h-6 w-6" />{uno && "1"}</button>
      </div>
    </div>
  );
}

/** En lo que no ha empezado (o está pausado): a quién le toca, según el tablero de cuadrillas. */
function LeToca({ o }: { o: OperacionPiso }) {
  const asignaciones = useAsignaciones();
  const personal = usePersonalPiso();
  const nombres = (asignaciones.data ?? []).filter((a) => a.operacion_id === o.id)
    .map((a) => (personal.data ?? []).find((x: PersonaPiso) => x.id === a.empleado_id)?.nombre).filter(Boolean);
  if (nombres.length === 0) return null;
  return (
    <p className="flex items-center gap-2" data-explain={GLOSARIO.cuadrillaPlaneada} data-explain-title="Le toca">
      <Users className="h-5 w-5 text-tenue shrink-0" /><span><span className="text-tenue">Le toca:</span> {nombres.join(", ")}</span>
    </p>
  );
}

/** Quién está ahorita en la etapa, con «Sale» para cada uno y «Se une» para alguien más. */
function CuadrillaEnEtapa({ o, ahora }: { o: OperacionPiso; ahora: number }) {
  const cuadrillas = useCuadrillas();
  const qc = useQueryClient();
  const [uniendo, setUniendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tramos = (cuadrillas.data ?? []).filter((t) => t.operacion_id === o.id);
  const salir = useMutation({
    mutationFn: (id: string) => q(supabase.rpc("salir_de_etapa", { p_tiempo: id })),
    onSuccess: () => { setError(null); qc.invalidateQueries({ queryKey: CLAVE }); },
    onError: (e) => setError(mensajeError(e)),
  });
  return (
    <div className="space-y-2" data-explain={GLOSARIO.cuadrillaEtapa} data-explain-title="Cuadrilla">
      <div className="flex flex-wrap gap-2">
        {tramos.length === 0 && <span className="text-tenue">Nadie anotado{o.responsable ? ` (marcó ${o.responsable})` : ""}</span>}
        {tramos.map((t) => (
          <span key={t.tiempo_id} className="inline-flex items-center gap-2 rounded-xl bg-fondo border border-borde pl-3 pr-1">
            {/* En dos columnas (iPad acostado) no cabe el «hace cuánto» junto a «Se une»: arriba ya dice cuándo empezó. */}
            <span>{t.nombre} <span className="text-tenue text-sm lg:hidden xl:inline">· {haceRato(t.inicio, ahora)}</span></span>
            <button type="button" onClick={() => salir.mutate(t.tiempo_id)} disabled={salir.isPending} aria-label={`${t.nombre} sale`}
                    data-explain={GLOSARIO.botonSaleDeEtapa} data-explain-title={`${t.nombre} sale`}
                    className="h-11 rounded-lg px-2 flex items-center gap-1 text-base text-tenue hover:text-texto"><LogOut className="h-5 w-5" />Sale</button>
          </span>
        ))}
        <button type="button" onClick={() => setUniendo(true)} className="h-11 rounded-xl border-2 border-borde px-3 flex items-center gap-2 font-medium"
                data-explain={GLOSARIO.botonSeUneAEtapa} data-explain-title="Se une">
          <UserPlus className="h-5 w-5" />Se une
        </button>
      </div>
      {/* Empezó sin que nadie abriera su tiempo (se cargó de la hoja): a quién le toca, para darle «Se une». */}
      {tramos.length === 0 && <LeToca o={o} />}
      {error && <p className="text-peligro">{error}</p>}
      {uniendo && <UnirAEtapa o={o} alCerrar={() => setUniendo(false)} />}
    </div>
  );
}

function UnirAEtapa({ o, alCerrar }: { o: OperacionPiso; alCerrar: () => void }) {
  const personal = usePersonalPiso();
  const qc = useQueryClient();
  const [eleccion, setEleccion] = useState<Cuadrilla>({ empleados: [], sinNombre: 0 });
  const unir = useMutation({
    mutationFn: () => q(supabase.rpc("unir_a_etapa", { p_operacion: o.id, p_empleado: eleccion.empleados[0] ?? null, p_sin_nombre: eleccion.sinNombre })),
    onSuccess: () => { qc.invalidateQueries({ queryKey: CLAVE }); alCerrar(); },
  });
  const listo = eleccion.empleados.length > 0 || eleccion.sinNombre > 0;
  return (
    <Modal titulo={`¿Quién se une a ${o.etapa}?`} alCerrar={alCerrar}>
      <p className="text-tenue mb-3 cifra">{folioCorto(o.folio)} · {abreviarEquipo(o.equipo)}</p>
      <ElegirPersonas etapaId={o.etapa_id} personal={personal.data ?? []} cargando={personal.isLoading} valor={eleccion} alCambiar={setEleccion} uno />
      {unir.error && <p className="text-peligro mt-3">{mensajeError(unir.error)}</p>}
      <div className="grid grid-cols-2 gap-3 mt-5">
        <button onClick={alCerrar} className="min-h-[64px] rounded-xl border-2 border-borde bg-superficie text-xl font-semibold">Cancelar</button>
        <button onClick={() => unir.mutate()} disabled={!listo || unir.isPending}
                className="min-h-[64px] rounded-xl bg-ok text-white text-xl font-bold flex items-center justify-center gap-2 disabled:opacity-40">
          {unir.isPending ? <Loader2 className="h-7 w-7 animate-spin" /> : <UserPlus className="h-7 w-7" />}Se une
        </button>
      </div>
    </Modal>
  );
}

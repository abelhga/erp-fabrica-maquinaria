import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle, ArrowLeft, CheckCircle2, ChevronDown, Clock, HardHat, LayoutGrid, Lightbulb, Loader2, LogOut, Minus, Moon, PackageX, Pause, Play, PlayCircle, Plus, UserPlus, Users, X,
} from "lucide-react";
import { Logo } from "@/components/layout/Logo";
import { supabase } from "@/lib/supabase";
import { mensajeError, q } from "@/lib/consultas";
import { cn } from "@/lib/utilidades";
import { fecha } from "@/lib/formato";
import {
  CLAVE, cuandoAbre, useAsignaciones, useCuadrillas, useEtapas, useHorarioAhora, useHorasTaller, usePersonalPiso, usePiso, useProduccionEnVivo,
  type Etapa, type OperacionPiso, type PersonaPiso,
} from "./componentes/datos";
import { abreviarEquipo, folioCorto, haceRato, textoDias, tintaSobre, tonoCompromiso } from "./componentes/util";
import { AvanceEtapa } from "./componentes/AvanceEtapa";
import { DialogoIdea } from "./componentes/mejoras";
import { useSesion } from "@/lib/sesion";
import { GLOSARIO } from "@/tutorial/glosario";
import { Explicacion } from "@/tutorial/Explicacion";
import { PANTALLAS } from "@/tutorial/pantallas";

// La tablet se queda en su estación: etapa y nombres se recuerdan en el aparato.
const LS = { etapa: "terminal.etapa", nombre: "terminal.nombre", recientes: "terminal.recientes", cuadrilla: "terminal.cuadrilla." };
const leer = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const guardar = (k: string, v: string | null) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* modo privado */ } };

type Accion = "inicio" | "pausa" | "reanudar" | "fin" | "problema";
/** Quiénes trabajan una etapa: personas con nombre más las que no se sabe quiénes son. */
interface Cuadrilla { empleados: string[]; sinNombre: number }
const ACCIONES: Record<Accion, { texto: string; verbo: string; hecho: string; icono: typeof Play; clase: string }> = {
  inicio: { texto: "Iniciar", verbo: "Iniciar", hecho: "iniciada", icono: Play, clase: "bg-ok text-white" },
  pausa: { texto: "Pausar", verbo: "Pausar", hecho: "pausada", icono: Pause, clase: "bg-aviso text-white" },
  reanudar: { texto: "Reanudar", verbo: "Reanudar", hecho: "reanudada", icono: PlayCircle, clase: "bg-ok text-white" },
  fin: { texto: "Terminar", verbo: "Terminar", hecho: "terminada", icono: CheckCircle2, clase: "bg-marca text-white" },
  problema: { texto: "Problema", verbo: "Reportar problema en", hecho: "con problema reportado", icono: AlertTriangle, clase: "bg-superficie text-peligro border-2 border-peligro/50" },
};


/**
 * Terminal de piso: una tablet por estación, la usan supervisores con guantes.
 * Botones enormes, nada de tablas, y cada marca dice quién la hizo. Ocupa toda
 * la pantalla (sin el menú) para que no se toque nada más por accidente.
 */
export default function Terminal() {
  useProduccionEnVivo(["op_eventos", "ordenes_produccion", "op_tiempos", "op_asignaciones"]);
  const etapas = useEtapas();
  const { puede } = useSesion();
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
    mutationFn: (a: { op: OperacionPiso; accion: Accion; nota: string; cuadrilla?: Cuadrilla }) =>
      q(supabase.rpc("avanzar_operacion", { p_operacion: a.op.id, p_accion: a.accion, p_nota: a.nota || null, p_responsable: nombre || null,
        p_empleados: a.cuadrilla?.empleados ?? null, p_sin_nombre: a.cuadrilla?.sinNombre ?? 0 })),
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
  const trabajando = deEtapa.filter((o) => o.estado !== "pendiente").sort(orden);
  const listas = deEtapa.filter((o) => o.estado === "pendiente" && o.lista).sort(orden);
  const despues = deEtapa.filter((o) => o.estado === "pendiente" && !o.lista).sort(orden);

  return (
    <div className="fixed inset-0 z-[35] bg-fondo flex flex-col text-lg">
      <header className="h-16 shrink-0 flex items-center gap-2 sm:gap-3 px-3 sm:px-5 border-b border-borde bg-superficie">
        <Link to="/" className="p-2 -ml-2 text-tenue" aria-label="Salir de la terminal"><ArrowLeft className="h-6 w-6" /></Link>
        <Logo className="hidden md:flex" />
        <span className="hidden lg:inline text-tenue">Terminal de piso</span>
        <div className="ml-auto flex items-center gap-2 min-w-0">
          {/* Una idea de mejora se propone aquí mismo, con el nombre de quien está en la tablet. */}
          <button onClick={() => setIdea(true)} aria-label="Tengo una idea de mejora"
                  className="h-12 rounded-xl px-3 sm:px-4 flex items-center gap-2 border-2 border-marca/50 bg-superficie text-marca-texto font-semibold shrink-0">
            <Lightbulb className="h-6 w-6 shrink-0" /><span className="hidden sm:inline">Tengo una idea</span>
          </button>
          {/* Una máquina descompuesta se reporta desde aquí mismo, con foto (antes: foto al chat). */}
          {puede("mantenimiento", 2) && (
            <Link to={`/servicio/reportar?volver=/produccion/terminal${etapaId ? `&etapa=${etapaId}` : ""}`}
                  className="h-12 rounded-xl px-3 sm:px-4 flex items-center gap-2 border-2 border-peligro/60 bg-superficie text-peligro font-semibold shrink-0" aria-label="Reportar falla de una máquina">
              <AlertTriangle className="h-6 w-6 shrink-0" /><span className="hidden sm:inline">Reportar falla</span>
            </Link>
          )}
          {etapa && (
            <button onClick={() => elegirEtapa(null)} className="h-12 rounded-xl px-3 sm:px-4 flex items-center gap-2 font-semibold min-w-0"
                    style={{ background: etapa.color, color: tintaSobre(etapa.color) }} aria-label="Cambiar de etapa">
              <span className="truncate">{etapa.nombre}</span><ChevronDown className="h-5 w-5 shrink-0" />
            </button>
          )}
          <button onClick={() => setEligiendoNombre(true)}
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
          <div className="max-w-5xl mx-auto p-3 sm:p-5 space-y-6">
            <Explicacion className="text-base">{PANTALLAS["/produccion/terminal"].map((t) => <p key={t}>{t}</p>)}</Explicacion>
            <div className="flex items-center gap-3">
              <span className="h-10 w-2.5 rounded-full" style={{ background: etapa.color }} />
              <h1 className="text-3xl font-bold">{etapa.nombre}</h1>
              <span className="text-tenue">{deEtapa.length} {deEtapa.length === 1 ? "orden" : "órdenes"}</span>
              <button onClick={() => elegirEtapa(null)} className="ml-auto h-12 px-4 rounded-xl border border-borde bg-superficie flex items-center gap-2">
                <LayoutGrid className="h-5 w-5" /><span className="hidden sm:inline">Otra etapa</span>
              </button>
            </div>
            {/* Lo que más se pregunta en el piso: ¿hay que pausar para desayunar? Depende del modo. */}
            {modoHoras && (
              <p className={cn("flex items-center gap-2 text-base", modoHoras === "terminal" ? "text-aviso" : "text-tenue")}
                 data-explain={fuera ? GLOSARIO.fueraDeHorario : GLOSARIO.horasTaller} data-explain-title={fuera ? "Fuera de horario" : "¿Hay que pausar?"}>
                {fuera ? <Moon className="h-5 w-5 shrink-0" /> : <Clock className="h-5 w-5 shrink-0" />}
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
                <Seccion titulo={fuera ? "Iniciadas (fuera de horario)" : "Trabajando ahora"} lista={trabajando} pedir={pedir} ahora={ahora} />
                <Seccion titulo="Listas para empezar" lista={listas} pedir={pedir} ahora={ahora} />
                <Seccion titulo="Todavía en otra etapa" ayuda="Se pueden empezar si hace falta" lista={despues} pedir={pedir} ahora={ahora} tenue />
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
                   alCancelar={() => setPendiente(null)} alConfirmar={(nota, cuadrilla) => marcar.mutate({ ...pendiente, nota, cuadrilla })} />
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

function Seccion({ titulo, ayuda, lista, pedir, ahora, tenue }: {
  titulo: string; ayuda?: string; lista: OperacionPiso[]; pedir: (o: OperacionPiso, a: Accion) => void; ahora: number; tenue?: boolean;
}) {
  if (lista.length === 0) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold">{titulo} <span className="text-tenue font-normal">{lista.length}</span>
        {ayuda && <span className="block text-base font-normal text-tenue">{ayuda}</span>}</h2>
      {lista.map((o) => <TarjetaPiso key={o.id} o={o} pedir={pedir} ahora={ahora} tenue={tenue} />)}
    </section>
  );
}

function TarjetaPiso({ o, pedir, ahora, tenue }: { o: OperacionPiso; pedir: (o: OperacionPiso, a: Accion) => void; ahora: number; tenue?: boolean }) {
  const tono = tonoCompromiso(o.dias_restantes);
  const botones: Accion[] = o.estado === "pendiente" ? ["inicio", "problema"] : o.estado === "en_proceso" ? ["pausa", "fin", "problema"] : ["reanudar", "fin", "problema"];
  return (
    <article className={cn("tarjeta p-4 sm:p-5 space-y-3 border-l-[6px]", tenue && "opacity-90")} style={{ borderLeftColor: o.color }}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-lg text-tenue cifra">{folioCorto(o.folio)}{o.numero_serie && ` · ${o.numero_serie}`}</p>
          <p className="text-2xl font-bold leading-tight">{abreviarEquipo(o.equipo)}</p>
          <p className="text-lg text-tenue">{o.pedido_folio ? <><b className="text-texto cifra">{o.pedido_folio}</b> · {o.cliente ?? "—"}</> : "Para stock"}</p>
        </div>
        <div className="text-right">
          <span className={cn("inline-block rounded-xl px-3 py-1 text-lg font-semibold",
            tono === "peligro" ? "bg-peligro text-white" : tono === "aviso" ? "bg-aviso text-white" : "bg-ok-suave text-ok")}>
            {textoDias(o.dias_restantes)}
          </span>
          <p className="text-lg text-tenue mt-1 cifra">{fecha(o.fecha_compromiso)}</p>
          {o.prioridad === 1 && <p className="text-lg font-semibold text-peligro">Urgente</p>}
        </div>
      </div>

      <div className="text-lg space-y-1">
        {o.estado === "en_proceso" && <p className="font-medium text-marca-texto">● En proceso{o.inicio && ` · empezó ${haceRato(o.inicio, ahora)}`}</p>}
        {o.estado === "en_proceso" && <CuadrillaEnEtapa o={o} ahora={ahora} />}
        {o.estado === "pausada" && <p className="font-semibold text-aviso">❚❚ Pausada{o.responsable && ` · ${o.responsable}`}</p>}
        {o.estado !== "en_proceso" && <LeToca o={o} />}
        {(o.estado === "en_proceso" || o.estado === "pausada") && <AvanceEtapa operacion={o.id} avance={o.avance_etapa} grande />}
        {o.estado === "pendiente" && (o.lista ? <p className="text-ok font-medium">Lista para empezar</p> : <p className="text-tenue">Todavía en {o.espera_a}</p>)}
        {o.ultimo_problema && o.estado !== "pendiente" && (
          <p className="text-peligro flex gap-2"><AlertTriangle className="h-6 w-6 shrink-0" /><span>{o.ultimo_problema} <span className="text-tenue">({haceRato(o.ultimo_problema_en, ahora)})</span></span></p>
        )}
        {o.materiales_faltantes > 0 && <p className="text-aviso flex gap-2"><PackageX className="h-6 w-6 shrink-0" />{o.materiales_faltantes} material{o.materiales_faltantes === 1 ? "" : "es"} con faltante</p>}
      </div>

      <div className={cn("grid gap-2", botones.length === 3 ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2")}>
        {botones.map((a, i) => {
          const A = ACCIONES[a];
          return (
            <button key={a} onClick={() => pedir(o, a)}
                    className={cn("min-h-[64px] rounded-xl px-4 text-xl font-bold flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] transition",
                      A.clase, botones.length === 3 && i === 2 && "col-span-2 sm:col-span-1")}>
              <A.icono className="h-7 w-7" />{A.texto}
            </button>
          );
        })}
      </div>
    </article>
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
  alConfirmar: (nota: string, cuadrilla?: Cuadrilla) => void; alCancelar: () => void; alCambiarNombre: () => void;
}) {
  const [nota, setNota] = useState("");
  const A = ACCIONES[p.accion];
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
        <p className="text-tenue cifra">{folioCorto(p.op.folio)}{p.op.numero_serie && ` · ${p.op.numero_serie}`}</p>
        <p className="text-xl font-bold">{abreviarEquipo(p.op.equipo)}</p>
        <p className="text-tenue">{p.op.cliente ?? "Para stock"}</p>
      </div>
      <p className="mb-4 flex flex-wrap items-center gap-2">
        <HardHat className="h-6 w-6 text-tenue" />Lo marca <b>{nombre}</b>
        <button onClick={alCambiarNombre} className="text-marca-texto underline underline-offset-4 min-h-[44px] px-1">No soy yo</button>
      </p>
      {conCuadrilla && (
        <div className="mb-5" data-explain={GLOSARIO.cuadrillaEtapa} data-explain-title="Cuadrilla">
          <p className="font-medium mb-2 flex items-center gap-2"><Users className="h-6 w-6 text-tenue" />¿Quiénes trabajan? <span className="text-tenue font-normal">{cuantos} {cuantos === 1 ? "persona" : "personas"}</span></p>
          <ElegirPersonas etapaId={p.op.etapa_id} personal={personal.data ?? []} cargando={personal.isLoading} valor={elegidos} alCambiar={setCuadrilla} />
        </div>
      )}
      <label className="block font-medium mb-2" htmlFor="nota-piso">{obligatoria ? "¿Cuál es el problema?" : "Nota (opcional)"}</label>
      <textarea id="nota-piso" value={nota} onChange={(e) => setNota(e.target.value)} rows={3} autoFocus={obligatoria}
                className="w-full rounded-xl border-2 border-borde bg-superficie p-3 text-xl focus:outline-none focus:border-marca"
                placeholder={obligatoria ? "Falta lámina, la máquina no prende…" : ""} />
      <div className="grid grid-cols-2 gap-3 mt-5">
        <button onClick={alCancelar} className="min-h-[64px] rounded-xl border-2 border-borde bg-superficie text-xl font-semibold">Cancelar</button>
        <button onClick={() => alConfirmar(nota.trim(), conCuadrilla ? elegidos : undefined)} disabled={cargando || (obligatoria && !nota.trim()) || (conCuadrilla && cuantos === 0)}
                className={cn("min-h-[64px] rounded-xl text-xl font-bold flex items-center justify-center gap-2 disabled:opacity-40", A.clase)}>
          {cargando ? <Loader2 className="h-7 w-7 animate-spin" /> : <A.icono className="h-7 w-7" />}{A.texto}
        </button>
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
      <div className="flex items-center gap-3 rounded-xl border-2 border-dashed border-borde px-3 py-2">
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
      <Users className="h-6 w-6 text-tenue shrink-0" /><span><span className="text-tenue">Le toca:</span> {nombres.join(", ")}</span>
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
          <span key={t.tiempo_id} className="inline-flex items-center gap-2 rounded-xl bg-fondo border border-borde pl-3 pr-1 py-1">
            <span>{t.nombre} <span className="text-tenue text-base">· {haceRato(t.inicio, ahora)}</span></span>
            <button type="button" onClick={() => salir.mutate(t.tiempo_id)} disabled={salir.isPending} aria-label={`${t.nombre} sale`}
                    className="h-10 rounded-lg px-2 flex items-center gap-1 text-base text-tenue hover:text-texto"><LogOut className="h-5 w-5" />Sale</button>
          </span>
        ))}
        <button type="button" onClick={() => setUniendo(true)} className="h-12 rounded-xl border-2 border-borde px-3 flex items-center gap-2 font-medium">
          <UserPlus className="h-6 w-6" />Se une
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

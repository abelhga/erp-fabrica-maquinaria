import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle, ArrowLeft, CheckCircle2, ChevronDown, HardHat, LayoutGrid, Loader2, PackageX, Pause, Play, PlayCircle, X,
} from "lucide-react";
import { Logo } from "@/components/layout/Logo";
import { supabase } from "@/lib/supabase";
import { mensajeError, q } from "@/lib/consultas";
import { cn } from "@/lib/utilidades";
import { fecha } from "@/lib/formato";
import { CLAVE, useEtapas, usePiso, useProduccionEnVivo, type Etapa, type OperacionPiso } from "./componentes/datos";
import { abreviarEquipo, folioCorto, haceRato, textoDias, tonoCompromiso } from "./componentes/util";
import { useSesion } from "@/lib/sesion";

// La tablet se queda en su estación: etapa y nombres se recuerdan en el aparato.
const LS = { etapa: "terminal.etapa", nombre: "terminal.nombre", recientes: "terminal.recientes" };
const leer = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const guardar = (k: string, v: string | null) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* modo privado */ } };

type Accion = "inicio" | "pausa" | "reanudar" | "fin" | "problema";
const ACCIONES: Record<Accion, { texto: string; verbo: string; hecho: string; icono: typeof Play; clase: string }> = {
  inicio: { texto: "Iniciar", verbo: "Iniciar", hecho: "iniciada", icono: Play, clase: "bg-ok text-white" },
  pausa: { texto: "Pausar", verbo: "Pausar", hecho: "pausada", icono: Pause, clase: "bg-aviso text-white" },
  reanudar: { texto: "Reanudar", verbo: "Reanudar", hecho: "reanudada", icono: PlayCircle, clase: "bg-ok text-white" },
  fin: { texto: "Terminar", verbo: "Terminar", hecho: "terminada", icono: CheckCircle2, clase: "bg-marca text-white" },
  problema: { texto: "Problema", verbo: "Reportar problema en", hecho: "con problema reportado", icono: AlertTriangle, clase: "bg-superficie text-peligro border-2 border-peligro/50" },
};

/** Texto negro o blanco según el color de la etapa (el amarillo de Eléctrico no aguanta letra blanca). */
function tintaSobre(hex: string) {
  const m = hex.replace("#", "").match(/.{2}/g);
  if (!m) return "#fff";
  const [r, g, b] = m.map((x) => parseInt(x, 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? "#111827" : "#ffffff";
}

/**
 * Terminal de piso: una tablet por estación, la usan supervisores con guantes.
 * Botones enormes, nada de tablas, y cada marca dice quién la hizo. Ocupa toda
 * la pantalla (sin el menú) para que no se toque nada más por accidente.
 */
export default function Terminal() {
  useProduccionEnVivo();
  const etapas = useEtapas();
  const { puede } = useSesion();
  const piso = usePiso({ intervalo: 60_000 });
  const [etapaId, setEtapaId] = useState<number | null>(() => Number(leer(LS.etapa)) || null);
  const [nombre, setNombre] = useState<string>(() => leer(LS.nombre) ?? "");
  const [recientes, setRecientes] = useState<string[]>(() => { try { return JSON.parse(leer(LS.recientes) ?? "[]"); } catch { return []; } });
  const [eligiendoNombre, setEligiendoNombre] = useState(false);
  const [pendiente, setPendiente] = useState<{ op: OperacionPiso; accion: Accion } | null>(null);
  const [aviso, setAviso] = useState<{ texto: string; folio?: string; tono: "ok" | "peligro" } | null>(null);
  const [ahora, setAhora] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setAhora(Date.now()), 30_000); return () => clearInterval(t); }, []);
  useEffect(() => { if (!aviso) return; const t = setTimeout(() => setAviso(null), aviso.tono === "ok" ? 3000 : 6000); return () => clearTimeout(t); }, [aviso]);

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
    mutationFn: (a: { op: OperacionPiso; accion: Accion; nota: string }) =>
      q(supabase.rpc("avanzar_operacion", { p_operacion: a.op.id, p_accion: a.accion, p_nota: a.nota || null, p_responsable: nombre || null })),
    onSuccess: (_, a) => {
      setPendiente(null);
      setAviso({ tono: "ok", texto: `${a.op.etapa} ${ACCIONES[a.accion].hecho}`, folio: folioCorto(a.op.folio) });
      qc.invalidateQueries({ queryKey: CLAVE });
    },
    onError: (e) => { setPendiente(null); setAviso({ tono: "peligro", texto: mensajeError(e) }); qc.invalidateQueries({ queryKey: CLAVE }); },
  });

  const pedir = (op: OperacionPiso, accion: Accion) => {
    setPendiente({ op, accion });
    if (!nombre) setEligiendoNombre(true);
  };

  const todas = piso.data ?? [];
  const deEtapa = todas.filter((o) => o.etapa_id === etapaId);
  const orden = (a: OperacionPiso, b: OperacionPiso) => a.prioridad - b.prioridad || (a.dias_restantes ?? 9999) - (b.dias_restantes ?? 9999);
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
          {/* Una máquina descompuesta se reporta desde aquí mismo, con foto (antes: foto al chat). */}
          {puede("servicio", 2) && (
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

      <main className="flex-1 overflow-y-auto">
        {!etapa ? (
          <ElegirEtapa etapas={etapas.data ?? []} cargando={etapas.isLoading} piso={todas} alElegir={elegirEtapa} />
        ) : (
          <div className="max-w-5xl mx-auto p-3 sm:p-5 space-y-6">
            <div className="flex items-center gap-3">
              <span className="h-10 w-2.5 rounded-full" style={{ background: etapa.color }} />
              <h1 className="text-3xl font-bold">{etapa.nombre}</h1>
              <span className="text-tenue">{deEtapa.length} {deEtapa.length === 1 ? "orden" : "órdenes"}</span>
              <button onClick={() => elegirEtapa(null)} className="ml-auto h-12 px-4 rounded-xl border border-borde bg-superficie flex items-center gap-2">
                <LayoutGrid className="h-5 w-5" /><span className="hidden sm:inline">Otra etapa</span>
              </button>
            </div>
            {piso.isLoading ? <div className="flex justify-center py-20"><Loader2 className="h-10 w-10 animate-spin text-tenue" /></div> : deEtapa.length === 0 ? (
              <div className="tarjeta p-10 text-center">
                <CheckCircle2 className="h-14 w-14 text-ok mx-auto mb-3" />
                <p className="text-2xl font-semibold">Nada pendiente en {etapa.nombre}</p>
                <p className="text-tenue mt-2">Cuando la gerencia libere órdenes con esta etapa, aparecerán aquí.</p>
              </div>
            ) : (
              <>
                <Seccion titulo="Trabajando ahora" lista={trabajando} pedir={pedir} ahora={ahora} />
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
                   alCancelar={() => setPendiente(null)} alConfirmar={(nota) => marcar.mutate({ ...pendiente, nota })} />
      )}
      {aviso && (
        <div role="status" aria-live="assertive" onClick={() => setAviso(null)}
             className={cn("fixed inset-x-3 top-20 z-[70] mx-auto max-w-3xl rounded-2xl px-6 py-5 shadow-2xl flex items-center gap-4 text-2xl font-semibold",
               aviso.tono === "ok" ? "bg-ok text-white" : "bg-peligro text-white")}>
          {aviso.tono === "ok" ? <CheckCircle2 className="h-10 w-10 shrink-0" /> : <AlertTriangle className="h-10 w-10 shrink-0" />}
          <span>{aviso.texto}{aviso.folio && <> · <span className="whitespace-nowrap">{aviso.folio}</span></>}</span>
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
          <p className="text-lg text-tenue">{o.cliente ?? (o.pedido_folio ? o.pedido_folio : "Para stock")}</p>
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
        {o.estado === "en_proceso" && <p className="font-medium text-marca-texto">● En proceso{o.responsable && ` · ${o.responsable}`}{o.inicio && ` · empezó ${haceRato(o.inicio, ahora)}`}</p>}
        {o.estado === "pausada" && <p className="font-semibold text-aviso">❚❚ Pausada{o.responsable && ` · ${o.responsable}`}</p>}
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
  alConfirmar: (nota: string) => void; alCancelar: () => void; alCambiarNombre: () => void;
}) {
  const [nota, setNota] = useState("");
  const A = ACCIONES[p.accion];
  const obligatoria = p.accion === "problema";
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
      <label className="block font-medium mb-2" htmlFor="nota-piso">{obligatoria ? "¿Cuál es el problema?" : "Nota (opcional)"}</label>
      <textarea id="nota-piso" value={nota} onChange={(e) => setNota(e.target.value)} rows={3} autoFocus={obligatoria}
                className="w-full rounded-xl border-2 border-borde bg-superficie p-3 text-xl focus:outline-none focus:border-marca"
                placeholder={obligatoria ? "Falta lámina, la máquina no prende…" : ""} />
      <div className="grid grid-cols-2 gap-3 mt-5">
        <button onClick={alCancelar} className="min-h-[64px] rounded-xl border-2 border-borde bg-superficie text-xl font-semibold">Cancelar</button>
        <button onClick={() => alConfirmar(nota.trim())} disabled={cargando || (obligatoria && !nota.trim())}
                className={cn("min-h-[64px] rounded-xl text-xl font-bold flex items-center justify-center gap-2 disabled:opacity-40", A.clase)}>
          {cargando ? <Loader2 className="h-7 w-7 animate-spin" /> : <A.icono className="h-7 w-7" />}{A.texto}
        </button>
      </div>
    </Modal>
  );
}

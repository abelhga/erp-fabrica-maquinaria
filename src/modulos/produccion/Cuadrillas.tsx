import { useMemo, useState, type DragEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ChevronRight, ExternalLink, GripVertical, HardHat, Tablet, UserCog, UserMinus, Users } from "lucide-react";
import { Pagina } from "@/components/layout/Shell";
import { Boton } from "@/components/ui/boton";
import { Seleccion } from "@/components/ui/campo";
import { Interruptor } from "@/components/ui/interruptor";
import { Filtro } from "@/components/datos/TablaDatos";
import { Dialogo, Lateral } from "@/components/ui/dialogo";
import { Cargando, ErrorCarga, Vacio } from "@/components/ui/estados";
import { useSesion } from "@/lib/sesion";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { fecha } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { GLOSARIO } from "@/tutorial/glosario";
import {
  CLAVE, useAsignaciones, useCuadrillas, useEtapas, usePersonalPiso, usePiso, useProduccionEnVivo,
  type Etapa, type OperacionPiso, type PersonaPiso, type TramoAbierto,
} from "./componentes/datos";
import { BotonLink } from "./componentes/BotonLink";
import { abreviarEquipo, folioCorto, haceRato, horas, textoDias, tonoCompromiso } from "./componentes/util";

/**
 * El taller por etapas, con la gente adentro. No es otra captura: quien trabaja una etapa en
 * proceso es quien tiene su tiempo abierto en la terminal, y lo que no ha empezado trae la
 * cuadrilla planeada. La gerencia arrastra personas entre tarjetas (si la etapa está en
 * proceso, eso abre y cierra tiempos de verdad, y por eso pide confirmar) y ordena la cola.
 */

interface Persona { id: string; nombre: string; trabajando: boolean; tiempo_id?: string }
interface Trabajo extends OperacionPiso { personas: Persona[]; sinNombre: number; desde: string | null; restante: number; gente: number }
type Vista = "etapa" | "cuadrilla";
type Arrastre = { tipo: "persona"; empleado: string; desde: string | null } | { tipo: "tarjeta"; operacion: string; etapa: number };
interface Cambio { titulo: string; texto: string[]; correr: () => void }

const enCola = (a: Trabajo, b: Trabajo) =>
  (a.turno ?? 9999) - (b.turno ?? 9999) || a.prioridad - b.prioridad || Number(b.atrasada) - Number(a.atrasada)
  || (a.dias_restantes ?? 9999) - (b.dias_restantes ?? 9999) || a.folio.localeCompare(b.folio);

/** Lo que falta de una etapa entre la gente que la trabaja (o la planeada). */
function faltan(t: Trabajo) {
  if (t.horas_estimadas <= 0) return null;
  return t.gente > 0 ? `faltan ≈ ${horas(Math.ceil((t.restante / t.gente) * 2) / 2)}` : `≈ ${horas(t.restante)} de trabajo`;
}

export default function Cuadrillas() {
  const { puede, veFabricacion } = useSesion();
  const gestionar = puede("produccion", 3);
  useProduccionEnVivo(["op_eventos", "ordenes_produccion", "op_tiempos", "op_asignaciones"]);
  const piso = usePiso();
  const etapas = useEtapas();
  const personal = usePersonalPiso();
  const tramos = useCuadrillas();
  const asignaciones = useAsignaciones();
  const [arrastre, setArrastre] = useState<Arrastre | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);
  const [cambio, setCambio] = useState<Cambio | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [personalAbierto, setPersonalAbierto] = useState(false);
  const [params, setParams] = useSearchParams();
  const vista: Vista = params.get("vista") === "cuadrilla" ? "cuadrilla" : "etapa";
  // Etapas con «Más adelante» abierto (por omisión cerrado: es la misma orden que ya sale en su etapa actual).
  const [masAdelante, setMasAdelante] = useState<Set<number>>(new Set());
  const tarjeta = (t: Trabajo, conEtapa = false) => (
    <TarjetaTrabajo key={t.id} t={t} ahora={ahora} gestionar={gestionar} veHoras={veFabricacion} sobre={sobre === t.id} conEtapa={conEtapa}
      alAbrir={() => setAbierto(t.id)}
      alPasar={permitir(t.id)} alSalir={() => setSobre(null)} alSoltar={alSoltar(t)}
      alArrastrarTarjeta={() => setArrastre({ tipo: "tarjeta", operacion: t.id, etapa: t.etapa_id })}
      alArrastrarPersona={(emp) => setArrastre({ tipo: "persona", empleado: emp, desde: t.id })}
      alTerminar={() => { setArrastre(null); setSobre(null); }} />
  );
  const ahora = Date.now();

  const asignar = useAccion((a: { op: string; emp: string; desde: string | null }) =>
    q<string>(supabase.rpc("asignar_a_etapa", { p_operacion: a.op, p_empleado: a.emp, p_desde: a.desde })),
  { invalidar: [CLAVE], exito: (r) => (r === "trabajando" ? "Listo: ya cuenta su tiempo ahí" : r === "planeado" ? "Quedó en la cuadrilla" : "Sin cambio") });
  const quitar = useAccion((a: { op: string; emp: string }) => q(supabase.rpc("quitar_de_etapa", { p_operacion: a.op, p_empleado: a.emp })),
    { invalidar: [CLAVE], exito: "Salió de la cuadrilla" });
  const ordenar = useAccion((ids: string[]) => q(supabase.rpc("ordenar_cola", { p_operaciones: ids })), { invalidar: [CLAVE] });

  const nombres = useMemo(() => new Map((personal.data ?? []).map((p) => [p.id, p.nombre])), [personal.data]);
  const trabajos = useMemo<Trabajo[]>(() => {
    const porOp = new Map<string, TramoAbierto[]>();
    for (const t of tramos.data ?? []) porOp.set(t.operacion_id, [...(porOp.get(t.operacion_id) ?? []), t]);
    return (piso.data ?? []).map((o) => {
      const abiertos = porOp.get(o.id) ?? [];
      const trabajando: Persona[] = abiertos.filter((t) => t.empleado_id).map((t) => ({ id: t.empleado_id!, nombre: t.nombre, trabajando: true, tiempo_id: t.tiempo_id }));
      const planeados: Persona[] = (asignaciones.data ?? []).filter((a) => a.operacion_id === o.id && !trabajando.some((p) => p.id === a.empleado_id))
        .map((a) => ({ id: a.empleado_id, nombre: nombres.get(a.empleado_id) ?? "—", trabajando: false }));
      const sinNombre = abiertos.filter((t) => !t.empleado_id).reduce((s, t) => s + t.personas, 0);
      // En proceso manda quien tiene su tiempo abierto; si nadie lo abrió todavía (lo que se cargó
      // de la hoja de Luis), se ve la cuadrilla planeada para que la columna no salga vacía.
      const personas = o.estado === "en_proceso" && abiertos.length ? trabajando : [...trabajando, ...planeados];
      return {
        ...o, personas, sinNombre,
        desde: abiertos.length ? abiertos.map((t) => t.inicio).sort()[0] : null,
        restante: Math.max(Number(o.horas_estimadas) - Number(o.horas_reales ?? 0), 0),
        gente: personas.length + sinNombre,
      };
    });
  }, [piso.data, tramos.data, asignaciones.data, nombres]);

  // Dónde trabaja cada quien ahorita, y cuántas horas tiene encima (lo suyo entre su cuadrilla).
  const trabajaEn = useMemo(() => {
    const m = new Map<string, Trabajo>();
    for (const t of trabajos) for (const p of t.personas) if (p.trabajando) m.set(p.id, t);
    return m;
  }, [trabajos]);
  const carga = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of trabajos) for (const p of t.personas) m.set(p.id, (m.get(p.id) ?? 0) + t.restante / Math.max(t.gente, 1));
    return m;
  }, [trabajos]);

  const cargando = piso.isLoading || etapas.isLoading || personal.isLoading;
  const error = piso.error ?? etapas.error ?? personal.error ?? tramos.error ?? asignaciones.error;

  /** Soltar una persona en una tarjeta: si eso abre o cierra tiempos, primero se pregunta. */
  function soltarPersona(destino: Trabajo, emp: string, desde: string | null) {
    const nombre = nombres.get(emp) ?? "Esa persona";
    const origen = desde ? trabajos.find((t) => t.id === desde) : undefined;
    if (desde === destino.id) return;
    if (!desde && trabajaEn.get(emp)) desde = trabajaEn.get(emp)!.id;
    const sale = origen ?? (desde ? trabajos.find((t) => t.id === desde) : undefined);
    const saleTrabajando = !!sale && sale.personas.some((p) => p.id === emp && p.trabajando);
    const entraTrabajando = destino.estado === "en_proceso";
    const correr = () => asignar.mutate({ op: destino.id, emp, desde });
    if (!saleTrabajando && !entraTrabajando) return correr();
    const texto: string[] = [];
    if (saleTrabajando) texto.push(`Deja ${sale!.etapa} de ${folioCorto(sale!.folio)}: su tiempo ahí se cierra ahora.`);
    texto.push(entraTrabajando
      ? `Entra a ${destino.etapa} de ${folioCorto(destino.folio)}, que está en proceso: su tiempo cuenta desde ahora.`
      : `Queda en la cuadrilla de ${destino.etapa} de ${folioCorto(destino.folio)} para cuando arranque.`);
    texto.push("La terminal lo verá igual.");
    setCambio({ titulo: `¿Mover a ${nombre}?`, texto, correr });
  }

  function sacarPersona(op: string, emp: string) {
    const t = trabajos.find((x) => x.id === op);
    const nombre = nombres.get(emp) ?? "Esa persona";
    const correr = () => quitar.mutate({ op, emp });
    if (!t?.personas.some((p) => p.id === emp && p.trabajando)) return correr();
    setCambio({ titulo: `¿Sacar a ${nombre}?`, texto: [`Deja ${t.etapa} de ${folioCorto(t.folio)}: su tiempo ahí se cierra ahora. La etapa sigue en proceso con los demás.`], correr });
  }

  /** Soltar una tarjeta de la cola sobre otra: queda antes de ella. */
  function soltarTarjeta(destino: Trabajo, op: string) {
    const cola = trabajos.filter((t) => t.etapa_id === destino.etapa_id && t.estado === "pendiente").sort(enCola).map((t) => t.id);
    if (!cola.includes(op) || op === destino.id) return;
    const sin = cola.filter((id) => id !== op);
    sin.splice(sin.indexOf(destino.id), 0, op);
    ordenar.mutate(sin);
  }
  function mover(t: Trabajo, paso: -1 | 1) {
    const cola = trabajos.filter((x) => x.etapa_id === t.etapa_id && x.estado === "pendiente").sort(enCola).map((x) => x.id);
    const i = cola.indexOf(t.id), j = i + paso;
    if (i < 0 || j < 0 || j >= cola.length) return;
    [cola[i], cola[j]] = [cola[j], cola[i]];
    ordenar.mutate(cola);
  }

  const alSoltar = (destino: Trabajo) => (e: DragEvent) => {
    e.preventDefault();
    setSobre(null);
    if (!arrastre) return;
    if (arrastre.tipo === "persona") soltarPersona(destino, arrastre.empleado, arrastre.desde);
    else if (arrastre.etapa === destino.etapa_id) soltarTarjeta(destino, arrastre.operacion);
    setArrastre(null);
  };
  const permitir = (id: string) => (e: DragEvent) => { if (gestionar && arrastre) { e.preventDefault(); setSobre(id); } };

  // Por cuadrilla: la gente que tiene exactamente el mismo trabajo (lo de ahorita y su fila) es
  // una cuadrilla, como «Isidro y César» en el tablero de Luis. Se arma sola de lo asignado.
  const cuadrillas = useMemo(() => {
    const rango = (t: Trabajo) => (t.estado === "en_proceso" ? 0 : t.estado === "pausada" ? 1 : 2);
    const porPersona = new Map<string, Trabajo[]>();
    for (const t of trabajos) for (const p of t.personas) porPersona.set(p.id, [...(porPersona.get(p.id) ?? []), t]);
    const grupos = new Map<string, { gente: string[]; lista: Trabajo[] }>();
    for (const [emp, lista] of porPersona) {
      const orden = [...lista].sort((a, b) => rango(a) - rango(b) || enCola(a, b));
      const clave = orden.map((t) => t.id).join(",");
      const g = grupos.get(clave) ?? { gente: [], lista: orden };
      g.gente.push(emp);
      grupos.set(clave, g);
    }
    const primero = (id: string) => (nombres.get(id) ?? "—").split(" ")[0];
    return [...grupos.entries()].map(([clave, g]) => {
      const n = g.gente.map(primero).sort((a, b) => a.localeCompare(b, "es"));
      return {
        clave, lista: g.lista, trabajando: g.lista.some((t) => t.estado === "en_proceso"),
        titulo: n.length === 1 ? n[0] : `${n.slice(0, -1).join(", ")} y ${n[n.length - 1]}`,
        horas: g.lista.reduce((s, t) => s + t.restante / Math.max(t.gente, 1), 0),
      };
    }).sort((a, b) => Number(b.trabajando) - Number(a.trabajando) || a.titulo.localeCompare(b.titulo, "es"));
  }, [trabajos, nombres]);
  const sinCuadrilla = trabajos.filter((t) => t.gente === 0 && (t.estado !== "pendiente" || t.lista))
    .sort((a, b) => a.etapa_orden - b.etapa_orden || enCola(a, b));

  const visibles = (etapas.data ?? []).filter((e) => trabajos.some((t) => t.etapa_id === e.id) || (personal.data ?? []).some((p) => p.etapa_id === e.id));
  const detalle = trabajos.find((t) => t.id === abierto) ?? null;

  return (
    <Pagina titulo="Cuadrillas" ancho="max-w-[1800px]"
      descripcion={`Quién trabaja qué en cada etapa y quién sigue · ${trabajaEn.size} personas trabajando ahorita`}
      acciones={<>
        {gestionar && <Boton variante="secundario" onClick={() => setPersonalAbierto(true)}><UserCog className="h-4 w-4" />Personal de piso</Boton>}
        <BotonLink a="/produccion/terminal"><Tablet className="h-4 w-4" />Terminal de piso</BotonLink>
      </>}>
      {error ? <ErrorCarga error={error} /> : cargando ? <Cargando filas={6} /> : (
        <>
          <PanelPersonal personal={personal.data ?? []} etapas={etapas.data ?? []} trabajaEn={trabajaEn} carga={veFabricacion ? carga : null}
            gestionar={gestionar} sobre={sobre === "personal"}
            alArrastrar={(emp) => setArrastre({ tipo: "persona", empleado: emp, desde: trabajaEn.get(emp)?.id ?? null })}
            alTerminar={() => { setArrastre(null); setSobre(null); }}
            alPasar={(e) => { if (gestionar && arrastre?.tipo === "persona" && arrastre.desde) { e.preventDefault(); setSobre("personal"); } }}
            alSoltar={(e) => { e.preventDefault(); setSobre(null); if (arrastre?.tipo === "persona" && arrastre.desde) sacarPersona(arrastre.desde, arrastre.empleado); setArrastre(null); }} />

          <div className="flex flex-wrap items-center gap-3">
            <Filtro opciones={[
              { valor: "etapa" as Vista, texto: "Por etapa", explica: GLOSARIO.vistaPorEtapa },
              { valor: "cuadrilla" as Vista, texto: "Por cuadrilla", explica: GLOSARIO.vistaPorCuadrilla },
            ]} valor={vista} alCambiar={(v) => setParams(v === "etapa" ? {} : { vista: v }, { replace: true })} />
            <p className="text-xs text-tenue">{vista === "etapa"
              ? "Cada etapa con lo que se trabaja y lo que ya puede empezar."
              : "Cada cuadrilla con lo que trabaja ahorita y lo que le sigue, como el tablero de Luis."}</p>
          </div>

          {visibles.length === 0 ? (
            <div className="tarjeta"><Vacio icono={Users} titulo="No hay trabajo liberado en el taller"
              texto="Cuando la gerencia libere una orden, sus etapas aparecen aquí para armar las cuadrillas." /></div>
          ) : vista === "etapa" ? (
            <div className="flex gap-3 overflow-x-auto pb-2 items-start">
              {visibles.map((et) => {
                const deEtapa = trabajos.filter((t) => t.etapa_id === et.id);
                const despues = deEtapa.filter((t) => t.estado === "pendiente" && !t.lista).sort(enCola);
                const grupos: { titulo: string; lista: Trabajo[]; explica?: string }[] = [
                  { titulo: "Trabajando", lista: deEtapa.filter((t) => t.estado === "en_proceso") },
                  { titulo: "Pausadas", lista: deEtapa.filter((t) => t.estado === "pausada") },
                  { titulo: "Listas para empezar", lista: deEtapa.filter((t) => t.estado === "pendiente" && t.lista).sort(enCola), explica: GLOSARIO.colaEtapa },
                ];
                const abierta = masAdelante.has(et.id);
                return (
                  <section key={et.id} className="w-[19rem] shrink-0 rounded-xl bg-fondo border border-borde/70 p-2" aria-label={et.nombre}>
                    <header className="flex items-center gap-2 px-1.5 pt-1 pb-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: et.color }} />
                      <h2 className="font-semibold text-sm">{et.nombre}</h2>
                      <span className="ml-auto text-xs text-tenue cifra">{deEtapa.length - despues.length}</span>
                    </header>
                    <div className="space-y-3 xl:max-h-[calc(100vh-21rem)] overflow-y-auto pr-0.5">
                      {grupos.map((g) => g.lista.length > 0 && (
                        <div key={g.titulo} className="space-y-2">
                          <p className="px-1 text-[11px] font-medium uppercase tracking-wide text-tenue" data-explain={g.explica} data-explain-title={g.explica && g.titulo}>
                            {g.titulo} <span className="cifra">{g.lista.length}</span>
                          </p>
                          {g.lista.map((t) => tarjeta(t))}
                        </div>
                      ))}
                      {deEtapa.length === despues.length && <p className="text-xs text-tenue text-center py-4">Nada que se pueda trabajar ahorita</p>}
                      {despues.length > 0 && (
                        <div className="space-y-2">
                          {/* Lo que todavía está en una etapa anterior: cerrado, para no repetir la misma orden en cada columna. */}
                          <button type="button" onClick={() => setMasAdelante((m) => { const n = new Set(m); if (n.has(et.id)) n.delete(et.id); else n.add(et.id); return n; })}
                            className="w-full flex items-center gap-1 px-1 text-[11px] font-medium uppercase tracking-wide text-tenue hover:text-texto"
                            data-explain={GLOSARIO.masAdelante} data-explain-title="Más adelante">
                            <ChevronRight className={cn("h-3.5 w-3.5 transition", abierta && "rotate-90")} />Más adelante <span className="cifra">{despues.length}</span>
                          </button>
                          {abierta && despues.map((t) => tarjeta(t))}
                        </div>
                      )}
                    </div>
                  </section>
                );
              })}
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-2 items-start">
              {cuadrillas.map((c) => (
                <section key={c.clave} className="w-[17rem] shrink-0 rounded-xl bg-fondo border border-borde/70 p-2" aria-label={c.titulo}>
                  <header className="px-1.5 pt-1 pb-2">
                    <h2 className="font-semibold text-sm leading-snug">{c.titulo}</h2>
                    <p className="text-[11px] text-tenue">{c.trabajando ? "Trabajando ahorita" : "Sin nada en proceso"}{veFabricacion && c.horas > 0 ? ` · ≈ ${horas(Math.round(c.horas))} encima` : ""}</p>
                  </header>
                  <div className="space-y-2 xl:max-h-[calc(100vh-21rem)] overflow-y-auto pr-0.5">
                    {c.lista.map((t, k) => (
                      <div key={t.id}>
                        {k === 1 && <p className="px-1 pb-1 text-[11px] font-medium uppercase tracking-wide text-tenue">Después</p>}
                        {tarjeta(t, true)}
                      </div>
                    ))}
                  </div>
                </section>
              ))}
              <section className="w-[17rem] shrink-0 rounded-xl border border-dashed border-borde p-2" aria-label="Sin cuadrilla"
                data-explain={GLOSARIO.sinCuadrilla} data-explain-title="Sin cuadrilla">
                <header className="px-1.5 pt-1 pb-2">
                  <h2 className="font-semibold text-sm">Sin cuadrilla</h2>
                  <p className="text-[11px] text-tenue">En proceso o listo para empezar, y nadie asignado</p>
                </header>
                <div className="space-y-2 xl:max-h-[calc(100vh-21rem)] overflow-y-auto pr-0.5">
                  {sinCuadrilla.length === 0 && <p className="text-xs text-tenue text-center py-6">Todo tiene quién lo haga</p>}
                  {sinCuadrilla.map((t) => tarjeta(t, true))}
                </div>
              </section>
            </div>
          )}
        </>
      )}

      <Dialogo abierto={!!cambio} alCambiar={(v) => !v && setCambio(null)} titulo={cambio?.titulo}
        pie={<>
          <Boton variante="secundario" onClick={() => setCambio(null)}>Cancelar</Boton>
          <Boton autoFocus onClick={() => { cambio?.correr(); setCambio(null); }}>Sí, cambiar</Boton>
        </>}>
        <div className="space-y-2 text-sm" data-explain={GLOSARIO.cambioDeManos} data-explain-title="Cambio de manos">
          {cambio?.texto.map((x) => <p key={x}>{x}</p>)}
        </div>
      </Dialogo>

      <Lateral abierto={personalAbierto} alCambiar={setPersonalAbierto} ancho="max-w-xl" titulo="Personal de piso"
        subtitulo="La gente de Producción: su área y si entra a cuadrillas">
        {personalAbierto && <PersonalPiso etapas={etapas.data ?? []} />}
      </Lateral>

      <Lateral abierto={!!detalle} alCambiar={(v) => !v && setAbierto(null)} ancho="max-w-md"
        titulo={detalle ? `${detalle.etapa} · ${folioCorto(detalle.folio)}` : ""} subtitulo={detalle && abreviarEquipo(detalle.equipo)}
        acciones={detalle && <Link to={`/produccion/ordenes/${detalle.orden_id}`} className="inline-flex items-center gap-1 text-sm text-marca-texto hover:underline">Orden<ExternalLink className="h-3.5 w-3.5" /></Link>}>
        {detalle && (
          <DetalleTrabajo t={detalle} personal={personal.data ?? []} trabajaEn={trabajaEn} gestionar={gestionar} veHoras={veFabricacion}
            alAgregar={(emp) => soltarPersona(detalle, emp, null)} alQuitar={(emp) => sacarPersona(detalle.id, emp)}
            alMover={(paso) => mover(detalle, paso)} />
        )}
      </Lateral>
    </Pagina>
  );
}

/** Todo el personal arriba, por área: de aquí se arrastra a una tarjeta, y aquí se suelta para sacar a alguien. */
function PanelPersonal({ personal, etapas, trabajaEn, carga, gestionar, sobre, alArrastrar, alTerminar, alPasar, alSoltar }: {
  personal: PersonaPiso[]; etapas: Etapa[]; trabajaEn: Map<string, Trabajo>; carga: Map<string, number> | null; gestionar: boolean; sobre: boolean;
  alArrastrar: (emp: string) => void; alTerminar: () => void; alPasar: (e: DragEvent) => void; alSoltar: (e: DragEvent) => void;
}) {
  const areas = [...etapas.map((e) => ({ id: e.id as number | null, nombre: e.nombre })), { id: null, nombre: "Sin área" }]
    .map((a) => ({ ...a, gente: personal.filter((p) => p.etapa_id === a.id) })).filter((a) => a.gente.length > 0);
  if (personal.length === 0) {
    return <div className="tarjeta p-4 text-sm text-tenue">No hay personal activo dado de alta. Recursos Humanos lo registra en Personal (con su área), y aquí aparece para armar las cuadrillas.</div>;
  }
  return (
    <section onDragOver={alPasar} onDragLeave={alTerminar} onDrop={alSoltar} aria-label="Personal"
      className={cn("tarjeta p-3 transition", sobre && "ring-2 ring-marca")} data-explain={GLOSARIO.panelPersonal} data-explain-title="Personal">
      <div className="flex flex-wrap items-baseline gap-x-3 mb-2">
        <h2 className="font-semibold text-sm">Personal</h2>
        <p className="text-xs text-tenue">{gestionar ? "Arrastra a alguien a una tarjeta; para sacarlo de una cuadrilla, arrástralo aquí." : "Verde: trabajando ahorita."}</p>
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {areas.map((a) => (
          <div key={a.nombre} className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-tenue mr-0.5">{a.nombre}</span>
            {a.gente.map((p) => {
              const en = trabajaEn.get(p.id);
              const h = carga?.get(p.id);
              return (
                <span key={p.id} draggable={gestionar} onDragStart={() => alArrastrar(p.id)} onDragEnd={alTerminar}
                  title={en ? `Trabajando en ${en.etapa} de ${folioCorto(en.folio)}` : "Libre"}
                  className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
                    gestionar && "cursor-grab active:cursor-grabbing", en ? "border-ok/40 bg-ok-suave" : "border-borde bg-superficie")}>
                  <span className={cn("h-2 w-2 rounded-full", en ? "bg-ok" : "bg-borde")} />
                  {p.nombre}
                  {h != null && h > 0 && <span className="text-tenue cifra" data-explain={GLOSARIO.cargaPersona} data-explain-title="Horas encima">{horas(Math.round(h))}</span>}
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}

function TarjetaTrabajo({ t, ahora, gestionar, veHoras, sobre, conEtapa, alAbrir, alPasar, alSalir, alSoltar, alArrastrarTarjeta, alArrastrarPersona, alTerminar }: {
  t: Trabajo; ahora: number; gestionar: boolean; veHoras: boolean; sobre: boolean; conEtapa?: boolean; alAbrir: () => void;
  alPasar: (e: DragEvent) => void; alSalir: () => void; alSoltar: (e: DragEvent) => void;
  alArrastrarTarjeta: () => void; alArrastrarPersona: (emp: string) => void; alTerminar: () => void;
}) {
  const tono = tonoCompromiso(t.dias_restantes);
  const deCola = t.estado === "pendiente";
  const f = veHoras ? faltan(t) : null;
  return (
    <article onDragOver={alPasar} onDragLeave={alSalir} onDrop={alSoltar}
      draggable={gestionar && deCola} onDragStart={deCola ? alArrastrarTarjeta : undefined} onDragEnd={alTerminar}
      onClick={alAbrir} onKeyDown={(e) => { if (e.key === "Enter") alAbrir(); }} tabIndex={0}
      className={cn("tarjeta p-2.5 cursor-pointer border-l-4 transition hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-marca",
        sobre && "ring-2 ring-marca")} style={{ borderLeftColor: t.color }}>
      <div className="flex items-start gap-1.5">
        {gestionar && deCola && <GripVertical className="h-4 w-4 text-tenue shrink-0 mt-0.5 cursor-grab" aria-hidden />}
        <div className="min-w-0 flex-1">
          {conEtapa && <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: t.color }}>{t.etapa}{t.estado === "pausada" ? " · pausada" : ""}</p>}
          <p className="text-xs text-tenue cifra">{folioCorto(t.folio)}{t.numero_serie && ` · ${t.numero_serie}`}{t.prioridad === 1 && <b className="text-peligro"> · Urgente</b>}</p>
          <p className="text-sm font-medium leading-snug">{abreviarEquipo(t.equipo)}</p>
          <p className="text-xs text-tenue truncate">{t.pedido_folio ? <><span className="text-texto cifra">{t.pedido_folio}</span> · {t.cliente ?? "—"}</> : "Para stock"}</p>
        </div>
        <span className={cn("text-[11px] cifra whitespace-nowrap", tono === "peligro" ? "text-peligro font-medium" : tono === "aviso" ? "text-aviso font-medium" : "text-tenue")}
          title={`Compromiso ${fecha(t.fecha_compromiso)}`}>{textoDias(t.dias_restantes)}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {t.personas.map((p) => (
          <span key={p.id} draggable={gestionar} onClick={(e) => e.stopPropagation()}
            onDragStart={(e) => { e.stopPropagation(); alArrastrarPersona(p.id); }} onDragEnd={alTerminar}
            className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs border", gestionar && "cursor-grab",
              p.trabajando ? "border-ok/40 bg-ok-suave" : "border-dashed border-borde bg-superficie")}
            title={p.trabajando ? "Trabajando ahorita (su tiempo está contando)" : "Planeado: le toca cuando arranque"}>
            {p.trabajando && <span className="h-1.5 w-1.5 rounded-full bg-ok" />}{p.nombre}
          </span>
        ))}
        {t.sinNombre > 0 && <span className="rounded-full px-2 py-0.5 text-xs bg-fondo border border-borde">+{t.sinNombre} sin nombre</span>}
        {t.gente === 0 && <span className="text-xs text-tenue" data-explain={GLOSARIO.cuadrillaPlaneada} data-explain-title="Cuadrilla">{gestionar ? "Suelta aquí a quien le toca" : "Sin cuadrilla"}</span>}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-2 text-[11px] text-tenue">
        {t.estado === "en_proceso" && t.desde && <span>desde {haceRato(t.desde, ahora).replace("hace ", "")}</span>}
        {f && <span className="cifra" data-explain={GLOSARIO.faltanHoras} data-explain-title="Faltan">{f}</span>}
        {deCola && !t.lista && <span className="text-aviso">Antes: {t.espera_a}</span>}
        {t.materiales_faltantes > 0 && <span className="text-aviso">{t.materiales_faltantes} con faltante</span>}
      </div>
    </article>
  );
}

/** Lo mismo que el arrastre, con botones: para teclado, para la tablet y para quien no arrastra. */
function DetalleTrabajo({ t, personal, trabajaEn, gestionar, veHoras, alAgregar, alQuitar, alMover }: {
  t: Trabajo; personal: PersonaPiso[]; trabajaEn: Map<string, Trabajo>; gestionar: boolean; veHoras: boolean;
  alAgregar: (emp: string) => void; alQuitar: (emp: string) => void; alMover: (paso: -1 | 1) => void;
}) {
  const [elegido, setElegido] = useState("");
  const fuera = personal.filter((p) => !t.personas.some((x) => x.id === p.id))
    .sort((a, b) => Number(b.etapa_id === t.etapa_id) - Number(a.etapa_id === t.etapa_id) || a.nombre.localeCompare(b.nombre));
  const f = veHoras ? faltan(t) : null;
  return (
    <div className="space-y-5 text-sm">
      <dl className="grid grid-cols-2 gap-3">
        <div><dt className="text-xs text-tenue">Estado</dt><dd>{t.estado === "en_proceso" ? "En proceso" : t.estado === "pausada" ? "Pausada" : t.lista ? "En cola, lista para empezar" : `En cola · antes: ${t.espera_a}`}</dd></div>
        <div><dt className="text-xs text-tenue">Compromiso</dt><dd className="cifra">{fecha(t.fecha_compromiso)} · {textoDias(t.dias_restantes)}</dd></div>
        <div><dt className="text-xs text-tenue">Cliente</dt><dd>{t.cliente ?? "Para stock"}</dd></div>
        {veHoras && <div data-explain={GLOSARIO.faltanHoras} data-explain-title="Horas"><dt className="text-xs text-tenue">Horas</dt>
          <dd className="cifra">{horas(Number(t.horas_reales))} de {horas(Number(t.horas_estimadas))}{f && ` · ${f}`}</dd></div>}
      </dl>
      <div data-explain={t.estado === "en_proceso" ? GLOSARIO.cuadrillaEtapa : GLOSARIO.cuadrillaPlaneada} data-explain-title="Cuadrilla">
        <p className="font-medium mb-2 flex items-center gap-2"><Users className="h-4 w-4 text-tenue" />
          {t.estado === "en_proceso" ? "Trabajando ahorita" : "Le toca"}</p>
        {t.personas.length === 0 && t.sinNombre === 0 && <p className="text-tenue">Nadie todavía.</p>}
        <ul className="divide-y divide-borde">
          {t.personas.map((p) => (
            <li key={p.id} className="flex items-center gap-2 py-1.5">
              <HardHat className={cn("h-4 w-4", p.trabajando ? "text-ok" : "text-tenue")} />
              <span className="flex-1">{p.nombre} <span className="text-xs text-tenue">{p.trabajando ? "· trabajando" : "· planeado"}</span></span>
              {gestionar && <Boton variante="fantasma" tamano="sm" onClick={() => alQuitar(p.id)}><UserMinus className="h-3.5 w-3.5" />Sacar</Boton>}
            </li>
          ))}
          {t.sinNombre > 0 && <li className="py-1.5 text-tenue">+{t.sinNombre} sin nombre (se sacan desde la terminal)</li>}
        </ul>
        {gestionar && (
          <div className="mt-3 flex gap-2">
            <Seleccion value={elegido} onChange={(e) => setElegido(e.target.value)} aria-label="Agregar persona" className="flex-1">
              <option value="">Agregar a alguien…</option>
              {fuera.map((p) => {
                const en = trabajaEn.get(p.id);
                return <option key={p.id} value={p.id}>{p.nombre}{en ? ` (en ${en.etapa} de ${folioCorto(en.folio)})` : ""}</option>;
              })}
            </Seleccion>
            <Boton disabled={!elegido} onClick={() => { alAgregar(elegido); setElegido(""); }}>Agregar</Boton>
          </div>
        )}
      </div>
      {gestionar && t.estado === "pendiente" && (
        <div data-explain={GLOSARIO.colaEtapa} data-explain-title="Cola">
          <p className="font-medium mb-2">Lugar en la cola</p>
          <div className="flex gap-2">
            <Boton variante="secundario" tamano="sm" onClick={() => alMover(-1)}><ArrowUp className="h-3.5 w-3.5" />Antes</Boton>
            <Boton variante="secundario" tamano="sm" onClick={() => alMover(1)}><ArrowDown className="h-3.5 w-3.5" />Después</Boton>
          </div>
        </div>
      )}
      <p className="text-xs text-tenue">Iniciar, pausar y terminar se marca en la terminal de piso: el tablero solo dice quién va.</p>
    </div>
  );
}

/**
 * La gente de Producción para que la gerencia la acomode: su área de piso y si entra a
 * cuadrillas (solo esa sale en la terminal y en el tablero). Altas, bajas, departamento y
 * datos personales siguen siendo de Recursos Humanos.
 */
interface PersonaProduccion { id: string; nombre: string; puesto: string | null; etapa_id: number | null; en_cuadrillas: boolean; trabajando_en: string | null }
function PersonalPiso({ etapas }: { etapas: Etapa[] }) {
  const lista = useQuery({ queryKey: [...CLAVE, "personal_produccion"], queryFn: () => q<PersonaProduccion[]>(supabase.rpc("personal_produccion")) });
  const ajustar = useAccion((a: { p: PersonaProduccion; etapa: number | null; cuadrillas: boolean }) =>
    q(supabase.rpc("ajustar_personal_piso", { p_empleado: a.p.id, p_etapa: a.etapa, p_en_cuadrillas: a.cuadrillas })),
  { invalidar: [CLAVE], exito: "Guardado" });
  if (lista.error) return <ErrorCarga error={lista.error} />;
  if (lista.isLoading) return <Cargando filas={6} />;
  const gente = lista.data ?? [];
  const dentro = gente.filter((p) => p.en_cuadrillas).length;
  return (
    <div className="space-y-3 text-sm">
      <p className="text-tenue" data-explain={GLOSARIO.enCuadrillas} data-explain-title="Entra a cuadrillas">
        {dentro} de {gente.length} entran a cuadrillas. Quien no entra no sale en la terminal ni aquí para asignarle trabajo.
        Para dar de alta o de baja, o cambiar a alguien de departamento, pídeselo a Recursos Humanos.
      </p>
      {gente.length === 0 && <Vacio icono={Users} titulo="No hay personal de Producción" texto="Recursos Humanos da de alta al personal con el departamento Producción; aquí aparece para acomodarlo." />}
      <ul className="divide-y divide-borde">
        {gente.map((p) => (
          <li key={p.id} className="py-2 flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium truncate">{p.nombre}</p>
              <p className="text-xs text-tenue truncate">{p.puesto ?? "Sin puesto"}{p.trabajando_en && ` · trabajando en ${p.trabajando_en}`}</p>
            </div>
            <Seleccion className="w-36" value={p.etapa_id ?? ""} aria-label={`Área de ${p.nombre}`}
              onChange={(e) => ajustar.mutate({ p, etapa: e.target.value ? Number(e.target.value) : null, cuadrillas: p.en_cuadrillas })}>
              <option value="">Sin área</option>
              {etapas.map((et) => <option key={et.id} value={et.id}>{et.nombre}</option>)}
            </Seleccion>
            <label className="flex items-center gap-2 text-xs text-tenue">
              <Interruptor activo={p.en_cuadrillas} cargando={ajustar.isPending} aria-label={`${p.nombre} entra a cuadrillas`}
                alCambiar={(v) => ajustar.mutate({ p, etapa: p.etapa_id, cuadrillas: v })} />
              Cuadrillas
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

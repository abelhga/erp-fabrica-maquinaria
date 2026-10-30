import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertTriangle, ArchiveX, CalendarClock, CheckCircle2, Clock, ExternalLink, Lightbulb, Loader2, Pause, RefreshCw, Rocket, Sparkles, Undo2, Wrench,
  type LucideIcon,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Pagina } from "@/components/layout/Shell";
import { Boton } from "@/components/ui/boton";
import { Kpi } from "@/components/ui/kpi";
import { Insignia } from "@/components/ui/insignia";
import { Dialogo, Lateral } from "@/components/ui/dialogo";
import { AreaTexto, Campo, Entrada, Seleccion } from "@/components/ui/campo";
import { Cargando, ErrorCarga, Vacio } from "@/components/ui/estados";
import { Filtro } from "@/components/datos/TablaDatos";
import { BotonSubirFoto } from "@/components/datos/SubirFoto";
import { useSesion } from "@/lib/sesion";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { pedirSugerenciasMejora, type SugerenciaMejora } from "@/lib/asistente";
import { fecha, hace, hoyISO, numero } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { GLOSARIO } from "@/tutorial/glosario";
import { useEtapas } from "./componentes/datos";
import { folioCorto, horas } from "./componentes/util";
import {
  CLAVE_MEJORAS, DESPERDICIOS, DialogoIdea, FotoMejora, subirFotoMejora, textoDesperdicio, useMejoras, usePersonasMejoras, useProblemasSinMejora,
  type EstadoMejora, type Mejora, type ProblemaPiso, type Semilla,
} from "./componentes/mejoras";

/**
 * Mejoras (kaizen): las ideas del piso y los problemas que reporta, convertidos en mejoras con
 * responsable, fecha y resultado. Las grandes se trabajan como A3. Quién puede qué lo decide la
 * base (proponer_mejora, editar_mejora, mover_mejora); aquí solo se esconde lo que no aplica.
 */
const COLUMNAS: { estado: EstadoMejora; titulo: string; icono: LucideIcon; explica: string }[] = [
  { estado: "propuesta", titulo: "Propuestas", icono: Lightbulb, explica: GLOSARIO.mejoraPropuesta },
  { estado: "en_marcha", titulo: "En marcha", icono: Rocket, explica: GLOSARIO.mejoraEnMarcha },
  { estado: "hecha", titulo: "Hechas", icono: CheckCircle2, explica: GLOSARIO.mejoraHecha },
];
const ICONO_PROBLEMA: Record<string, LucideIcon> = { problema: AlertTriangle, pausa: Pause, reabierta: Undo2, falla: Wrench };
const TEXTO_PROBLEMA: Record<string, string> = { problema: "Problema", pausa: "Pausa", reabierta: "Etapa reabierta", falla: "Falla de máquina" };
const NOMBRE_ESTADO: Record<EstadoMejora, string> = { propuesta: "Propuesta", en_marcha: "En marcha", hecha: "Hecha", descartada: "Descartada" };
const TONO_ESTADO = { propuesta: "marca", en_marcha: "aviso", hecha: "ok", descartada: "neutro" } as const;
const NOVENTA_DIAS = 90 * 86_400_000;

export default function Mejoras() {
  const { puede } = useSesion();
  const decide = puede("procesos", 2);
  const [sugerir, setSugerir] = useState(false);
  const mejoras = useMejoras();
  const problemas = useProblemasSinMejora();
  const etapas = useEtapas();
  const [params, setParams] = useSearchParams();
  const [area, setArea] = useState("todas");
  const [verDescartadas, setVerDescartadas] = useState(false);
  const [idea, setIdea] = useState<Semilla | null>(null);
  const [todosProblemas, setTodosProblemas] = useState(false);
  const abierta = params.get("mejora");
  const abrir = (id: string | null) => setParams(id ? { mejora: id } : {}, { replace: true });

  const lista = mejoras.data ?? [];
  const delArea = lista.filter((m) => area === "todas" || String(m.etapa_id ?? "") === area);
  const ahora = Date.now();
  const hechasRecientes = lista.filter((m) => m.estado === "hecha" && m.hecha_en && ahora - new Date(m.hecha_en).getTime() < NOVENTA_DIAS);
  const enMarcha = lista.filter((m) => m.estado === "en_marcha");
  const ahorro = lista.filter((m) => m.estado === "hecha").reduce((s, m) => s + Number(m.ahorro_horas_mes ?? 0), 0);
  const areas = useMemo(() => [
    { valor: "todas", texto: "Todo el taller" },
    ...(etapas.data ?? []).filter((e) => lista.some((m) => m.etapa_id === e.id)).map((e) => ({ valor: String(e.id), texto: e.nombre })),
  ], [etapas.data, lista]);
  const detalle = lista.find((m) => m.id === abierta) ?? null;
  const pendientes = problemas.data ?? [];

  return (
    <Pagina titulo="Mejoras (kaizen)" descripcion="Las ideas y los problemas del piso, convertidos en mejoras con quién las lleva y qué se logró"
      acciones={<>
        {decide && <Boton variante="secundario" onClick={() => setSugerir(true)}><Sparkles className="h-4 w-4" />Sugerir con IA</Boton>}
        <Boton onClick={() => setIdea({})}><Lightbulb className="h-4 w-4" />Tengo una idea</Boton>
      </>}>
      {mejoras.error ? <ErrorCarga error={mejoras.error} /> : mejoras.isLoading ? <Cargando filas={6} /> : (
        <>
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <Kpi titulo="Propuestas" valor={numero(lista.filter((m) => m.estado === "propuesta").length)} icono={Lightbulb}
              detalle="esperan que alguien las decida" explica={GLOSARIO.mejoraPropuesta} />
            <Kpi titulo="En marcha" valor={numero(enMarcha.length)} icono={Rocket} tono={enMarcha.some((m) => m.vencida) ? "peligro" : "aviso"}
              detalle={enMarcha.some((m) => m.vencida) ? `${enMarcha.filter((m) => m.vencida).length} pasadas de su fecha` : "con responsable y fecha"}
              explica={GLOSARIO.mejoraEnMarcha} />
            <Kpi titulo="Hechas en 90 días" valor={numero(hechasRecientes.length)} icono={CheckCircle2} tono="ok" explica={GLOSARIO.mejoraHecha} />
            <Kpi titulo="Horas ahorradas al mes" valor={horas(ahorro)} icono={Clock} tono="ok"
              detalle="lo que estiman las mejoras hechas" explica={GLOSARIO.ahorroHorasMes} />
          </div>

          {pendientes.length > 0 && (
            <section className="tarjeta p-4 space-y-3" data-explain={GLOSARIO.problemasSinMejora} data-explain-title="Del piso, sin mejora">
              <div className="flex flex-wrap items-baseline gap-x-3">
                <h2 className="font-semibold">Del piso, sin mejora todavía</h2>
                <p className="text-xs text-tenue">Lo que se reportó en los últimos 30 días: problemas, pausas con motivo, etapas reabiertas y fallas de máquinas.</p>
              </div>
              <ul className="divide-y divide-borde">
                {(todosProblemas ? pendientes : pendientes.slice(0, 5)).map((p) => (
                  <RenglonProblema key={p.evento_id ?? p.mantenimiento_id} p={p} alConvertir={() => setIdea({
                    titulo: (p.nota ?? "").slice(0, 120), problema: p.nota ?? undefined, etapa: p.etapa_id,
                    evento: p.evento_id, mantenimiento: p.mantenimiento_id,
                  })} />
                ))}
              </ul>
              {pendientes.length > 5 && (
                <Boton variante="fantasma" tamano="sm" onClick={() => setTodosProblemas((v) => !v)}>
                  {todosProblemas ? "Ver menos" : `Ver los ${pendientes.length}`}
                </Boton>
              )}
            </section>
          )}

          <div className="flex flex-wrap items-center gap-3">
            {areas.length > 2 && <Filtro opciones={areas} valor={area} alCambiar={setArea} />}
            <label className="ml-auto flex items-center gap-2 text-sm text-tenue">
              <input type="checkbox" checked={verDescartadas} onChange={(e) => setVerDescartadas(e.target.checked)} />
              Ver descartadas ({lista.filter((m) => m.estado === "descartada").length})
            </label>
          </div>

          {lista.length === 0 ? (
            <div className="tarjeta"><Vacio icono={Lightbulb} titulo="Todavía no hay mejoras"
              texto="Propón la primera con «Tengo una idea», o vuelve mejora un problema del piso. Desde la terminal también se puede."
              accion={<Boton onClick={() => setIdea({})}><Lightbulb className="h-4 w-4" />Tengo una idea</Boton>} /></div>
          ) : (
            <div className="grid gap-3 md:grid-cols-3 items-start">
              {COLUMNAS.map((c) => {
                const deCol = delArea.filter((m) => m.estado === c.estado
                  && (c.estado !== "hecha" || (m.hecha_en && ahora - new Date(m.hecha_en).getTime() < NOVENTA_DIAS)));
                return (
                  <section key={c.estado} className="rounded-xl bg-fondo/60 border border-borde p-2.5 space-y-2" aria-label={c.titulo}>
                    <header className="flex items-center gap-2 px-1" data-explain={c.explica} data-explain-title={c.titulo}>
                      <c.icono className="h-4 w-4 text-tenue" /><h2 className="font-semibold text-sm">{c.titulo}</h2>
                      <span className="text-xs text-tenue cifra">{deCol.length}</span>
                      {c.estado === "hecha" && <span className="ml-auto text-[11px] text-tenue">últimos 90 días</span>}
                    </header>
                    {deCol.length === 0 && <p className="text-xs text-tenue text-center py-6">{c.estado === "propuesta" ? "Ninguna idea esperando" : "Nada aquí"}</p>}
                    {deCol.map((m) => <TarjetaMejora key={m.id} m={m} alAbrir={() => abrir(m.id)} />)}
                  </section>
                );
              })}
            </div>
          )}

          {verDescartadas && (
            <section className="tarjeta p-4 space-y-2">
              <h2 className="font-semibold text-sm flex items-center gap-2"><ArchiveX className="h-4 w-4 text-tenue" />Descartadas</h2>
              <ul className="divide-y divide-borde">
                {delArea.filter((m) => m.estado === "descartada").map((m) => (
                  <li key={m.id}>
                    <button onClick={() => abrir(m.id)} className="w-full text-left py-2 flex gap-3 hover:bg-fondo rounded">
                      <span className="text-xs text-tenue cifra w-12 shrink-0">{m.folio}</span>
                      <span className="min-w-0 flex-1"><span className="block text-sm truncate">{m.titulo}</span>
                        <span className="block text-xs text-tenue truncate">{m.motivo_descarte}</span></span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {idea && <DialogoIdea abierto alCambiar={(v) => !v && setIdea(null)} semilla={idea} alCrear={(id) => abrir(id)} />}
      <Lateral abierto={sugerir} alCambiar={setSugerir} ancho="max-w-3xl" titulo="Sugerencias de la IA"
        subtitulo="Mejoras que salen de los datos del taller de los últimos 90 días. Tú decides cuáles se proponen.">
        {sugerir && <PanelSugerencias existentes={lista} />}
      </Lateral>
      <Lateral abierto={!!detalle} alCambiar={(v) => !v && abrir(null)} ancho="max-w-3xl"
        titulo={detalle ? `${detalle.folio} · ${detalle.titulo}` : ""}
        subtitulo={detalle && <span className="inline-flex items-center gap-2">
          <Insignia tono={TONO_ESTADO[detalle.estado]}>{NOMBRE_ESTADO[detalle.estado]}</Insignia>
          {detalle.tipo === "a3" && <span data-explain={GLOSARIO.mejoraA3} data-explain-title="A3"><Insignia tono="info">A3</Insignia></span>}
          Propuso {detalle.propuso ?? "—"} · {fecha(detalle.propuesta_en)}
        </span>}>
        {detalle && <FichaMejora key={detalle.id + detalle.estado} m={detalle} />}
      </Lateral>
    </Pagina>
  );
}

function RenglonProblema({ p, alConvertir }: { p: ProblemaPiso; alConvertir: () => void }) {
  const Icono = ICONO_PROBLEMA[p.tipo] ?? AlertTriangle;
  return (
    <li className="py-2 flex items-center gap-3">
      <Icono className={cn("h-4 w-4 shrink-0", p.tipo === "pausa" ? "text-aviso" : "text-peligro")} aria-label={TEXTO_PROBLEMA[p.tipo]} />
      <div className="min-w-0 flex-1">
        <p className="text-sm truncate">{p.nota ?? TEXTO_PROBLEMA[p.tipo]}</p>
        <p className="text-xs text-tenue truncate">
          {TEXTO_PROBLEMA[p.tipo]}{p.etapa && ` · ${p.etapa}`}
          {p.folio && <> · <Link className="hover:underline cifra" to={`/produccion/ordenes/${p.orden_id}`}>{folioCorto(p.folio)}</Link></>}
          {p.equipo && ` · ${p.equipo}`}{p.maquina && ` · ${p.maquina}`} · {hace(p.en)}
        </p>
      </div>
      <Boton variante="secundario" tamano="sm" onClick={alConvertir}><Lightbulb className="h-3.5 w-3.5" />Volverla mejora</Boton>
    </li>
  );
}

function TarjetaMejora({ m, alAbrir }: { m: Mejora; alAbrir: () => void }) {
  return (
    <button onClick={alAbrir} className={cn("tarjeta w-full text-left p-3 space-y-1.5 border-l-4 transition hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-marca",
      m.vencida && "ring-1 ring-peligro/50")} style={{ borderLeftColor: m.etapa_color ?? "var(--color-borde)" }}>
      <div className="flex items-center gap-2 text-xs text-tenue">
        <span className="cifra">{m.folio}</span>
        {m.etapa && <span className="truncate">{m.etapa}</span>}
        <span className="ml-auto flex items-center gap-1">
          {m.origen === "piso" && <AlertTriangle className="h-3.5 w-3.5" aria-label="Salió de un problema del piso" />}
          {m.origen === "maquina" && <Wrench className="h-3.5 w-3.5" aria-label="Salió de una falla de máquina" />}
          {m.tipo === "a3" && <Insignia tono="info">A3</Insignia>}
        </span>
      </div>
      <p className="text-sm font-medium leading-snug">{m.titulo}</p>
      {textoDesperdicio(m.desperdicio) && <p className="text-[11px] text-tenue">{textoDesperdicio(m.desperdicio)}</p>}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-tenue">
        {m.responsable ? <span>Lleva: <span className="text-texto">{m.responsable}</span></span> : <span>Propuso {m.propuso ?? "—"}</span>}
        {m.estado === "en_marcha" && m.fecha_compromiso && (
          <span className={cn("cifra flex items-center gap-1", m.vencida && "text-peligro font-medium")}><CalendarClock className="h-3.5 w-3.5" />{fecha(m.fecha_compromiso)}</span>
        )}
        {m.estado === "hecha" && m.ahorro_horas_mes != null && Number(m.ahorro_horas_mes) > 0 && <span className="text-ok cifra">ahorra {horas(Number(m.ahorro_horas_mes))}/mes</span>}
      </div>
    </button>
  );
}

type Campos = Partial<Record<"titulo" | "problema" | "propuesta" | "etapa_id" | "desperdicio" | "tipo" | "objetivo" | "causa_raiz" | "plan"
  | "responsable_id" | "fecha_compromiso" | "resultado" | "ahorro_horas_mes", string | number | null>>;

/** La ficha: lo que cada quien puede cambiar (lo mismo que deja la base) y los botones para moverla. */
function FichaMejora({ m }: { m: Mejora }) {
  const { puede, perfil } = useSesion();
  const etapas = useEtapas();
  const gestor = puede("procesos", 2);
  const esResponsable = !!perfil && m.responsable_id === perfil.id;
  const esAutor = !!perfil && m.propuesta_por === perfil.id;
  const abierta = m.estado === "propuesta" || m.estado === "en_marcha";
  const puedeCampo = (c: keyof Campos) => gestor
    || (esResponsable && abierta && ["problema", "propuesta", "objetivo", "causa_raiz", "plan", "resultado", "ahorro_horas_mes"].includes(c))
    || (esAutor && m.estado === "propuesta" && ["titulo", "problema", "propuesta", "etapa_id", "desperdicio"].includes(c));
  const puedeFotos = gestor || (esResponsable && abierta) || (esAutor && m.estado === "propuesta");
  const personas = usePersonasMejoras();
  const original: Campos = {
    titulo: m.titulo, problema: m.problema ?? "", propuesta: m.propuesta ?? "", etapa_id: m.etapa_id ?? "", desperdicio: m.desperdicio ?? "",
    tipo: m.tipo, objetivo: m.objetivo ?? "", causa_raiz: m.causa_raiz ?? "", plan: m.plan ?? "", responsable_id: m.responsable_id ?? "",
    fecha_compromiso: m.fecha_compromiso ?? "", resultado: m.resultado ?? "", ahorro_horas_mes: m.ahorro_horas_mes ?? "",
  };
  const [c, setC] = useState<Campos>(original);
  const [descartar, setDescartar] = useState(false);
  const [motivo, setMotivo] = useState("");
  const cambios = Object.fromEntries(Object.entries(c).filter(([k, v]) => v !== original[k as keyof Campos])
    .map(([k, v]) => [k, v === "" ? null : k === "etapa_id" || k === "ahorro_horas_mes" ? Number(v) : v]));
  const hayCambios = Object.keys(cambios).length > 0;
  const poner = (k: keyof Campos) => (v: string) => setC((x) => ({ ...x, [k]: v }));

  // Guardar y mover en una sola acción: «Ponerla en marcha» con el responsable recién elegido.
  const accion = useAccion(async (a: { estado?: EstadoMejora; nota?: string }) => {
    if (hayCambios) await q(supabase.rpc("editar_mejora", { p_id: m.id, p_datos: cambios }));
    if (a.estado) await q(supabase.rpc("mover_mejora", { p_id: m.id, p_estado: a.estado, p_nota: a.nota ?? null }));
    return a.estado;
  }, {
    invalidar: [CLAVE_MEJORAS],
    exito: (e) => (e === "en_marcha" ? "En marcha: el responsable ya tiene el aviso" : e === "hecha" ? "Hecha: quien la propuso ya se enteró"
      : e === "descartada" ? "Descartada: quien la propuso ve el motivo" : e === "propuesta" ? "Regresó a propuesta" : "Guardado"),
  });
  const foto = useAccion((d: { campo: "foto_antes" | "foto_despues"; ruta: string }) =>
    q(supabase.rpc("editar_mejora", { p_id: m.id, p_datos: { [d.campo]: d.ruta } })), { invalidar: [CLAVE_MEJORAS], exito: "Foto guardada" });

  const area = (k: keyof Campos, etiqueta: string, ayuda?: string, filas = 3) => puedeCampo(k) ? (
    <Campo etiqueta={etiqueta} ayuda={ayuda}><AreaTexto rows={filas} value={String(c[k] ?? "")} onChange={(e) => poner(k)(e.target.value)} /></Campo>
  ) : (
    <div><p className="text-xs text-tenue">{etiqueta}</p><p className="text-sm whitespace-pre-wrap">{String(c[k] || "—")}</p></div>
  );
  const a3 = c.tipo === "a3";
  const vencida = m.estado === "en_marcha" && !!m.fecha_compromiso && m.fecha_compromiso < hoyISO();

  return (
    <form className="space-y-5 text-sm" onSubmit={(e) => { e.preventDefault(); if (hayCambios) accion.mutate({}); }}>
      {(m.origen_nota || m.origen_falla) && (
        <div className="rounded-lg border border-borde bg-fondo px-3 py-2 text-xs flex items-start gap-2">
          {m.origen === "maquina" ? <Wrench className="h-4 w-4 text-peligro shrink-0" /> : <AlertTriangle className="h-4 w-4 text-peligro shrink-0" />}
          <p className="flex-1">Salió de {m.origen === "maquina" ? "una falla" : "lo que reportó el piso"}: «{m.origen_nota ?? m.origen_falla}»
            {m.origen_en && <span className="text-tenue"> · {fecha(m.origen_en)}</span>}</p>
          {m.origen_orden_id && <Link to={`/produccion/ordenes/${m.origen_orden_id}`} className="inline-flex items-center gap-1 text-marca-texto hover:underline shrink-0">{folioCorto(m.origen_folio ?? "")}<ExternalLink className="h-3 w-3" /></Link>}
          {m.origen_maquina_id && <Link to={`/servicio/maquinas/${m.origen_maquina_id}`} className="inline-flex items-center gap-1 text-marca-texto hover:underline shrink-0">{m.origen_maquina}<ExternalLink className="h-3 w-3" /></Link>}
        </div>
      )}
      {m.estado === "descartada" && m.motivo_descarte && <p className="rounded-lg bg-fondo px-3 py-2"><b>Se descartó:</b> {m.motivo_descarte}</p>}

      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        {puedeCampo("titulo") ? <Campo etiqueta="Qué se mejora"><Entrada value={String(c.titulo)} onChange={(e) => poner("titulo")(e.target.value)} maxLength={140} /></Campo>
          : <div><p className="text-xs text-tenue">Qué se mejora</p><p className="font-medium">{m.titulo}</p></div>}
        <Campo etiqueta="Área">
          <Seleccion value={String(c.etapa_id ?? "")} onChange={(e) => poner("etapa_id")(e.target.value)} disabled={!puedeCampo("etapa_id")}>
            <option value="">Todo el taller</option>
            {(etapas.data ?? []).map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </Seleccion>
        </Campo>
        <Campo etiqueta="Desperdicio">
          <span className="block" data-explain={GLOSARIO.desperdicioLean} data-explain-title="Desperdicio">
            <Seleccion value={String(c.desperdicio ?? "")} onChange={(e) => poner("desperdicio")(e.target.value)} disabled={!puedeCampo("desperdicio")}>
              <option value="">No sé / varios</option>
              {DESPERDICIOS.map((d) => <option key={d.valor} value={d.valor}>{d.texto}</option>)}
            </Seleccion>
          </span>
        </Campo>
      </div>

      {gestor && (
        <label className="flex items-center gap-2 text-sm" data-explain={GLOSARIO.mejoraA3} data-explain-title="A3">
          <input type="checkbox" checked={a3} onChange={(e) => poner("tipo")(e.target.checked ? "a3" : "kaizen")} />
          Trabajarla como A3 (es grande: pide análisis de causa raíz y un plan)
        </label>
      )}

      {/* El A3 en dos columnas, como la hoja: lo que pasa a la izquierda, lo que se hace a la derecha. */}
      <div className={cn("grid gap-4", a3 && "sm:grid-cols-2")}>
        <div className="space-y-3">
          {area("problema", a3 ? "Situación actual" : "¿Qué pasa hoy?", a3 ? "Qué pasa, dónde y cuánto cuesta (tiempo, retrabajos)." : undefined)}
          {a3 && area("objetivo", "Objetivo", "A dónde se quiere llegar, con número si se puede.", 2)}
          {a3 && area("causa_raiz", "Causa raíz", "Pregunta «¿por qué?» hasta llegar a lo que de verdad lo provoca (los 5 porqués).", 4)}
        </div>
        <div className="space-y-3">
          {area("propuesta", a3 ? "Contramedidas" : "¿Qué se propone?")}
          {a3 && area("plan", "Plan", "Qué se hace, quién y para cuándo.", 4)}
          {(m.estado !== "propuesta" || a3) && area("resultado", a3 ? "Resultado y seguimiento" : "Resultado", "Qué se logró. Sin esto no se puede marcar hecha.")}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Campo etiqueta="Quién la lleva">
          <Seleccion value={String(c.responsable_id ?? "")} onChange={(e) => poner("responsable_id")(e.target.value)} disabled={!puedeCampo("responsable_id")}>
            <option value="">Nadie todavía</option>
            {(personas.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            {m.responsable_id && !(personas.data ?? []).some((p) => p.id === m.responsable_id) && <option value={m.responsable_id}>{m.responsable}</option>}
          </Seleccion>
        </Campo>
        <Campo etiqueta="Para cuándo">
          <Entrada type="date" value={String(c.fecha_compromiso ?? "")} onChange={(e) => poner("fecha_compromiso")(e.target.value)}
            disabled={!puedeCampo("fecha_compromiso")} className={cn(vencida && "border-peligro text-peligro")} />
        </Campo>
        <Campo etiqueta="Horas ahorradas al mes">
          <span className="block" data-explain={GLOSARIO.ahorroHorasMes} data-explain-title="Horas ahorradas">
            <Entrada type="number" min={0} step="0.5" value={String(c.ahorro_horas_mes ?? "")} onChange={(e) => poner("ahorro_horas_mes")(e.target.value)}
              disabled={!puedeCampo("ahorro_horas_mes")} placeholder="estimado" className="cifra" />
          </span>
        </Campo>
      </div>

      <div className="grid gap-3 grid-cols-2">
        {(["foto_antes", "foto_despues"] as const).map((k) => (
          <div key={k} className="space-y-1.5">
            <p className="text-xs text-tenue">{k === "foto_antes" ? "Antes" : "Después"}</p>
            {m[k] ? <FotoMejora ruta={m[k]} alt={k === "foto_antes" ? "Antes" : "Después"} className="h-40 w-full rounded-lg object-cover bg-fondo grid place-items-center" />
              : <div className="h-40 w-full rounded-lg border border-dashed border-borde grid place-items-center text-xs text-tenue">Sin foto</div>}
            {puedeFotos && (k === "foto_antes" || m.estado !== "propuesta") && (
              <BotonSubirFoto carpeta={m.id} subir={subirFotoMejora} texto={m[k] ? "Cambiar foto" : "Subir foto"}
                alSubir={(ruta) => foto.mutate({ campo: k, ruta })} />
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-borde pt-4">
        {hayCambios && <Boton type="submit" disabled={accion.isPending}>Guardar cambios</Boton>}
        {gestor && m.estado === "propuesta" && (
          <Boton type="button" onClick={() => accion.mutate({ estado: "en_marcha" })} disabled={accion.isPending || !c.responsable_id || !c.fecha_compromiso}
            title={!c.responsable_id || !c.fecha_compromiso ? "Primero elige quién la lleva y para cuándo" : undefined}>
            <Rocket className="h-4 w-4" />Ponerla en marcha
          </Boton>
        )}
        {(gestor || esResponsable) && m.estado === "en_marcha" && (
          <Boton type="button" onClick={() => accion.mutate({ estado: "hecha" })} disabled={accion.isPending || !String(c.resultado ?? "").trim()}
            title={!String(c.resultado ?? "").trim() ? "Escribe el resultado para marcarla hecha" : undefined}>
            <CheckCircle2 className="h-4 w-4" />Marcar hecha
          </Boton>
        )}
        {gestor && m.estado !== "propuesta" && (
          <Boton type="button" variante="secundario" onClick={() => accion.mutate({ estado: "propuesta" })} disabled={accion.isPending}>
            <Undo2 className="h-4 w-4" />Regresar a propuesta
          </Boton>
        )}
        {gestor && m.estado !== "descartada" && m.estado !== "hecha" && (
          <Boton type="button" variante="fantasma" onClick={() => setDescartar(true)} disabled={accion.isPending}><ArchiveX className="h-4 w-4" />Descartar</Boton>
        )}
        {!gestor && !esResponsable && !(esAutor && m.estado === "propuesta") && (
          <p className="text-xs text-tenue">La deciden ingeniería de procesos y la gerencia de producción; la trabaja quien la lleva.</p>
        )}
      </div>

      <Dialogo abierto={descartar} alCambiar={setDescartar} titulo={`Descartar ${m.folio}`}
        descripcion="Quien la propuso va a leer el motivo: que se entienda por qué no va."
        pie={<>
          <Boton variante="secundario" onClick={() => setDescartar(false)}>Cancelar</Boton>
          <Boton disabled={!motivo.trim() || accion.isPending} onClick={() => { accion.mutate({ estado: "descartada", nota: motivo }); setDescartar(false); }}>Descartar</Boton>
        </>}>
        <Campo etiqueta="¿Por qué se descarta?"><AreaTexto autoFocus rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} /></Campo>
      </Dialogo>
    </form>
  );
}

/**
 * Lo que Claude ve en los datos del taller (métricas de 90 días, problemas del piso, fallas,
 * mejoras que ya hay) y lo que propone. Nada se guarda solo: «Proponerla» la vuelve propuesta,
 * a nombre de Claude, para que se decida como cualquier otra.
 */
function PanelSugerencias({ existentes }: { existentes: Mejora[] }) {
  const etapas = useEtapas();
  const [forzar, setForzar] = useState(0);
  const [hechas, setHechas] = useState<string[]>([]);
  const sug = useQuery({
    queryKey: [...CLAVE_MEJORAS, "sugerencias", forzar], staleTime: Infinity, retry: false,
    queryFn: () => pedirSugerenciasMejora(forzar > 0),
  });
  const proponer = useAccion(async (s: SugerenciaMejora) => {
    const etapa = (etapas.data ?? []).find((e) => e.nombre === s.etapa)?.id ?? null;
    const id = await q<string>(supabase.rpc("proponer_mejora", {
      p_titulo: s.titulo.slice(0, 140), p_problema: `${s.problema}\n\nDe dónde sale: ${s.evidencia}`, p_propuesta: s.propuesta,
      p_etapa: etapa, p_quien: "IA (sugerencia)", p_desperdicio: s.desperdicio,
    }));
    if (s.tipo === "a3" || s.ahorro_horas_mes > 0)
      await q(supabase.rpc("editar_mejora", { p_id: id, p_datos: { tipo: s.tipo, ...(s.ahorro_horas_mes > 0 ? { ahorro_horas_mes: s.ahorro_horas_mes } : {}) } }));
    setHechas((x) => [...x, s.titulo]);
  }, { invalidar: [CLAVE_MEJORAS], exito: "Quedó como propuesta: la decides en el tablero como cualquier otra" });
  const yaExiste = (s: SugerenciaMejora) => hechas.includes(s.titulo) || existentes.some((m) => m.titulo === s.titulo.slice(0, 140));

  if (sug.isLoading) return (
    <div className="py-16 flex flex-col items-center gap-3 text-sm text-tenue">
      <Loader2 className="h-8 w-8 animate-spin" />
      <p>La IA está revisando las métricas, los problemas del piso y las fallas de los últimos 90 días…</p>
      <p className="text-xs">Tarda alrededor de un minuto.</p>
    </div>
  );
  if (sug.error) return <ErrorCarga error={sug.error} />;
  const d = sug.data!;
  return (
    <div className="space-y-4 text-sm" data-explain={GLOSARIO.sugerenciasClaude} data-explain-title="Sugerencias de la IA">
      {d.simulado && d.aviso && <p className="rounded-lg border border-aviso/40 bg-aviso-suave px-3 py-2 text-aviso">{d.aviso}</p>}
      <p className="rounded-lg bg-fondo px-3 py-2 leading-relaxed">{d.lectura}</p>
      {d.sugerencias.length === 0 && <Vacio icono={Sparkles} titulo="Sin sugerencias" texto="Con estos datos no hay nada claro que proponer. Cuando el piso marque más en la terminal, vuelve a pedirlas." />}
      <ul className="space-y-3">
        {d.sugerencias.map((s) => {
          const color = (etapas.data ?? []).find((e) => e.nombre === s.etapa)?.color;
          return (
            <li key={s.titulo} className="tarjeta p-3 space-y-2 border-l-4" style={{ borderLeftColor: color ?? "var(--color-borde)" }}>
              <div className="flex items-start gap-2">
                <p className="font-medium flex-1">{s.titulo}</p>
                {s.tipo === "a3" && <Insignia tono="info">A3</Insignia>}
              </div>
              <p className="text-xs text-tenue">{s.etapa} · {textoDesperdicio(s.desperdicio) ?? s.desperdicio}{s.ahorro_horas_mes > 0 && <> · ahorraría ≈ <span className="cifra">{horas(s.ahorro_horas_mes)}</span> al mes</>}</p>
              <p><span className="text-tenue">Hoy: </span>{s.problema}</p>
              <p><span className="text-tenue">Propuesta: </span>{s.propuesta}</p>
              <p className="text-xs text-tenue">De dónde sale: {s.evidencia}</p>
              <div className="flex justify-end">
                {yaExiste(s) ? <span className="text-xs text-ok flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" />Ya está en el tablero</span>
                  : <Boton tamano="sm" onClick={() => proponer.mutate(s)} disabled={proponer.isPending}><Lightbulb className="h-3.5 w-3.5" />Proponerla</Boton>}
              </div>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-center gap-3 border-t border-borde pt-3 text-xs text-tenue">
        <span>{d.guardado ? "Guardadas" : "Hechas"} {hace(d.generado_en)}{d.modelo ? " con IA" : ""}.</span>
        <Boton variante="fantasma" tamano="sm" className="ml-auto" onClick={() => setForzar((n) => n + 1)} disabled={sug.isFetching}>
          <RefreshCw className="h-3.5 w-3.5" />Volver a pedirlas
        </Boton>
      </div>
    </div>
  );
}

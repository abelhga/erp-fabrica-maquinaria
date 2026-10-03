import { useMemo, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle, Check, ChevronDown, ChevronLeft, ChevronRight, ExternalLink, Flag, Gauge, KeyRound, MessageSquare,
  RefreshCw, Scale, Send, ShieldCheck, Undo2, X,
} from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { Insignia, type Tono } from "@/components/ui/insignia";
import { Dialogo } from "@/components/ui/dialogo";
import { AreaTexto, Campo, Entrada } from "@/components/ui/campo";
import { Cargando, ErrorCarga } from "@/components/ui/estados";
import { useSesion } from "@/lib/sesion";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { dinero, fecha, fechaYHora, numero, porcentaje } from "@/lib/formato";
import { cn } from "@/lib/utilidades";

// ---------------------------------------------------------------------------
// Tipos (espejo de las tablas y de v_objetivo_evaluaciones)
// ---------------------------------------------------------------------------
export type EstadoEval = "borrador" | "calificada" | "revisada" | "aprobada";
export type Regla = "meta" | "descuento" | "una_incidencia" | "proporcional" | "escalon" | "llave";
export type Fuente = "automatica" | "checklist" | "manual" | "externa";

export interface Evaluacion {
  id: string; empleado_id: string; mes: string; puesto_id: number | null; plantilla_id: string | null; evaluador_id: string | null;
  empleado_nombre: string; empleado_numero: string | null; puesto_nombre: string | null; estado: EstadoEval;
  suma_renglones: number | null; total: number | null; completa: boolean; llave_activada: boolean; llave_detalle: string | null;
  medida_en: string | null; calificada_por: string | null; calificada_en: string | null; revisada_por: string | null; revisada_en: string | null;
  aprobada_por: string | null; aprobada_en: string | null; devuelta_motivo: string | null; creado_en: string;
  evaluador: string | null; calificada_por_nombre: string | null; revisada_por_nombre: string | null; aprobada_por_nombre: string | null;
  total_corregido: number | null; total_final: number | null; pendientes: number; indicadores: number;
  impugnaciones_pendientes: number; ajustes_pendientes: number; es_mia: boolean | null; soy_evaluador: boolean | null;
}

export interface Indicador {
  id: number; clave: string; nombre: string; area: string; fuente: Fuente; checklist: string | null; unidad: string;
  descripcion: string; dato_faltante: string | null; activo: boolean;
}

export interface Resultado {
  id: string; evaluacion_id: string; orden: number; indicador_id: number; fuente: Fuente; peso: number; regla: Regla;
  meta: number | null; sentido: "mayor" | "menor"; descuento: number | null; escalones: { limite: number; pct: number }[] | null;
  llave_limite: number | null; parametros: { escala?: number; areas?: number[]; almacenes?: number[] }; texto: string | null;
  valor: number | null; incidencias: number | null; posibles: number | null; modo_valor: "no" | "resta" | "porcentaje";
  pct: number | null; calificacion: number | null; nota: string | null; evidencia_url: string | null; nota_medicion: string | null;
  medido_en: string | null; capturado_por: string | null; capturado_en: string | null;
  indicador: Pick<Indicador, "nombre" | "clave" | "unidad" | "descripcion" | "checklist"> | null;
  capturo: { nombre: string } | null;
}

export interface Evidencia {
  id: number; resultado_id: string; tipo: string; referencia: string; folio: string | null; detalle: string | null; fecha: string | null;
  cantidad: number | null; unidades: number; cuenta: boolean; vigente: boolean;
  impugnacion: "pendiente" | "aceptada" | "rechazada" | null; impugnada_en: string | null; motivo_impugnacion: string | null;
  impugnada_por: string | null; impugnacion_comentario: string | null; impugnacion_resuelta_en: string | null;
  impugnador: { nombre: string } | null; resolutor: { nombre: string } | null;
}

interface Comentario { id: string; texto: string; en: string; autor_id: string; autor: { nombre: string } | null }
interface Ajuste {
  id: string; total_anterior: number | null; total_corregido: number; motivo: string; estado: "pendiente" | "autorizado" | "rechazado";
  solicitado_por: string; solicitado_en: string; resuelto_en: string | null; comentario: string | null;
  solicitante: { nombre: string } | null; resolutor: { nombre: string } | null;
}

// ---------------------------------------------------------------------------
// Cómo se nombra cada cosa
// ---------------------------------------------------------------------------
export const ESTADOS_EVAL: Record<EstadoEval, { texto: string; tono: Tono; siguiente: string }> = {
  borrador: { texto: "Por calificar", tono: "aviso", siguiente: "Lo califica su jefe" },
  calificada: { texto: "Por revisar", tono: "info", siguiente: "Lo revisa Recursos Humanos" },
  revisada: { texto: "Por aprobar", tono: "marca", siguiente: "Lo aprueba dirección" },
  aprobada: { texto: "Aprobada", tono: "ok", siguiente: "Cerrada: solo se corrige con un ajuste" },
};

export const REGLAS: Record<Regla, { texto: string; ayuda: string }> = {
  meta: { texto: "Meta", ayuda: "Si llega a la meta, todo el peso; si no, 0." },
  descuento: { texto: "Descuento por incidencia", ayuda: "Cada incidencia resta puntos del peso." },
  una_incidencia: { texto: "Una incidencia = 0", ayuda: "Con una sola incidencia el indicador vale 0." },
  proporcional: { texto: "Proporcional", ayuda: "Peso × lo cumplido entre lo posible (días marcados o calificación del jefe)." },
  escalon: { texto: "Escalón", ayuda: "El primer escalón que alcanza da su porcentaje." },
  llave: { texto: "Llave del bono", ayuda: "Con ese número de incumplimientos en el mes, el bono total vale 0." },
};

export const FUENTES: Record<Fuente, { texto: string; tono: Tono }> = {
  automatica: { texto: "Lo mide el sistema", tono: "marca" },
  checklist: { texto: "Checklist diario", tono: "info" },
  manual: { texto: "Califica el jefe", tono: "neutro" },
  externa: { texto: "Captura con evidencia", tono: "neutro" },
};

/** 60 → "60%", 82.5 → "82.5%". Los totales de objetivos van de 0 a 100. */
export const puntos = (n: number | null | undefined) => (n == null ? "—" : porcentaje(Number(n) / 100, Number.isInteger(Number(n)) ? 0 : 1));

const fmtMes = new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric" });
/** "2026-09" o "2026-09-01" → "septiembre de 2026". */
export function nombreMes(m: string) {
  const [a, b] = m.split("-").map(Number);
  return fmtMes.format(new Date(a, b - 1, 15));
}
export function mesDe(fechaISO: string, desplazar = 0) {
  const [a, b] = fechaISO.split("-").map(Number);
  const d = new Date(a, b - 1 + desplazar, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
export function mesAnterior() {
  const h = new Date();
  return mesDe(`${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, "0")}`, -1);
}

/** Cómo se lee la regla de un renglón: "≥ $2,000,000", "−10 por incidencia"… */
export function describirRegla(r: Pick<Resultado, "regla" | "meta" | "sentido" | "descuento" | "escalones" | "llave_limite" | "parametros"> & { unidad?: string }) {
  const signo = r.sentido === "menor" ? "≤" : "≥";
  const meta = (n: number | null) => (r.unidad === "pesos" ? dinero(n) : `${numero(n)}${r.unidad === "%" ? " %" : ""}`);
  switch (r.regla) {
    case "meta": return `${signo} ${meta(r.meta)}`;
    case "descuento": return `−${numero(r.descuento)} por incidencia`;
    case "una_incidencia": return "Una incidencia = 0";
    case "proporcional": return r.parametros?.escala ? `Calificación de 0 a ${r.parametros.escala}` : "Proporcional a los días marcados";
    case "escalon": return (r.escalones ?? []).map((e) => `${signo} ${numero(e.limite)}${r.unidad === "%" ? " %" : ""} → ${numero(e.pct)} %`).join(" · ");
    case "llave": return `${r.llave_limite} incumplimientos = bono 0`;
  }
}

/** La regla en una línea, sin repetir el nombre cuando ya lo dice ("Una incidencia = 0", "Calificación de 0 a 10"). */
export function reglaCorta(r: Parameters<typeof describirRegla>[0]) {
  const d = describirRegla(r);
  return r.regla === "una_incidencia" || r.regla === "proporcional" || r.regla === "llave" ? d : `${REGLAS[r.regla].texto}: ${d}`;
}

/** Lo medido o capturado, en palabras: "124 de 125 días", "2 incidencias", "$9,061,538". */
export function describirValor(r: Resultado) {
  const u = r.indicador?.unidad;
  if (r.regla === "proporcional") {
    if (r.valor == null || r.posibles == null) return null;
    return r.parametros?.escala ? `${numero(r.valor)} de ${numero(r.posibles)}` : `${numero(r.valor)} de ${numero(r.posibles)} ${u === "días" ? "días" : ""}`.trim();
  }
  if (["descuento", "una_incidencia", "llave"].includes(r.regla)) {
    if (r.incidencias == null) return null;
    const n = Number(r.incidencias);
    return `${numero(n)} ${n === 1 ? "incidencia" : "incidencias"}${r.posibles != null && r.modo_valor !== "no" ? ` de ${numero(r.posibles)}` : ""}`;
  }
  if (r.valor == null) return null;
  if (u === "pesos") return dinero(r.valor);
  if (u === "%") return `${numero(r.valor)} %`;
  return `${numero(r.valor)} ${Number(r.valor) === 1 ? SINGULAR[u ?? ""] ?? u : u ?? ""}`.trim();
}
const SINGULAR: Record<string, string> = {
  registros: "registro", conteos: "conteo", proveedores: "proveedor", "artículos": "artículo", partidas: "partida", entregables: "entregable",
  videos: "video", "reseñas": "reseña", "créditos": "crédito", chats: "chat", bajas: "baja", "días": "día", incidencias: "incidencia", puntos: "punto",
};

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------
export function useEvaluaciones(mes: string | null, filtro?: { soloMias?: boolean }) {
  return useQuery({
    queryKey: ["objetivos", "evaluaciones", mes, filtro?.soloMias ?? false],
    queryFn: () => {
      let c = supabase.from("v_objetivo_evaluaciones").select("*").order("empleado_nombre");
      if (mes) c = c.eq("mes", `${mes}-01`);
      if (filtro?.soloMias) c = c.eq("es_mia", true).order("mes", { ascending: false });
      return q<Evaluacion[]>(c);
    },
  });
}

/** El bono en pesos solo existe para quien tiene nómina (la base lo niega a los demás). */
export function useBonos(mes: string, habilitado: boolean) {
  return useQuery({
    queryKey: ["objetivos", "bonos", mes],
    enabled: habilitado,
    queryFn: () => q<{ evaluacion_id: string; pct: number | null; base: number | null; monto: number | null; aviso: string | null; pagado_semana: string | null; pagado_monto: number | null }[]>(
      supabase.rpc("bonos_objetivos", { p_mes: `${mes}-01` })),
  });
}

// ---------------------------------------------------------------------------
// Selector de mes (◀ septiembre de 2026 ▶)
// ---------------------------------------------------------------------------
export function SelectorMes({ mes, alCambiar, maximo }: { mes: string; alCambiar: (m: string) => void; maximo?: string }) {
  const siguiente = mesDe(`${mes}-01`, 1);
  return (
    <div className="inline-flex items-center rounded-lg border border-borde bg-superficie">
      <button className="p-2 text-tenue hover:text-texto" onClick={() => alCambiar(mesDe(`${mes}-01`, -1))} aria-label="Mes anterior"><ChevronLeft className="h-4 w-4" /></button>
      <span className="px-2 text-sm font-medium min-w-[150px] text-center first-letter:uppercase">{nombreMes(mes)}</span>
      <button className="p-2 text-tenue hover:text-texto disabled:opacity-30" disabled={!!maximo && siguiente > maximo}
        onClick={() => alCambiar(siguiente)} aria-label="Mes siguiente"><ChevronRight className="h-4 w-4" /></button>
    </div>
  );
}

/** Barra de un renglón: cuánto obtuvo de su peso. */
export function BarraPeso({ valor, peso, tono }: { valor: number | null; peso: number; tono?: "ok" | "aviso" | "peligro" }) {
  const p = valor == null ? 0 : Math.max(0, Math.min(100, (Number(valor) / Number(peso)) * 100));
  const t = tono ?? (valor == null ? undefined : p >= 99.5 ? "ok" : p > 0 ? "aviso" : "peligro");
  return (
    <div className="h-1.5 w-full rounded-full bg-fondo overflow-hidden">
      <div className={cn("h-full rounded-full", t === "ok" ? "bg-ok" : t === "aviso" ? "bg-aviso" : "bg-peligro")} style={{ width: `${p}%` }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel de una evaluación: resultado, evidencia, captura y flujo
// ---------------------------------------------------------------------------
export function PanelEvaluacion({ evaluacion: e, propia = false }: { evaluacion: Evaluacion; propia?: boolean }) {
  const { puede, tieneRol, perfil } = useSesion();
  const yo = perfil?.id;
  const esRrhh = puede("objetivos", 3);
  const puedoCalificar = !propia && !e.es_mia && (esRrhh || (puede("objetivos", 1) && e.evaluador_id === yo));
  const editable = puedoCalificar && e.estado === "borrador";
  const claves = [["objetivos"]];

  const resultados = useQuery({
    queryKey: ["objetivos", "resultados", e.id],
    queryFn: () => q<Resultado[]>(supabase.from("objetivo_resultados")
      .select("*, indicador:objetivo_indicadores(nombre, clave, unidad, descripcion, checklist), capturo:perfiles!objetivo_resultados_capturado_por_fkey(nombre)")
      .eq("evaluacion_id", e.id).order("orden")),
  });
  const ids = (resultados.data ?? []).map((r) => r.id);
  const evidencias = useQuery({
    queryKey: ["objetivos", "evidencias", e.id, ids.length],
    enabled: ids.length > 0,
    queryFn: () => q<Evidencia[]>(supabase.from("objetivo_evidencias")
      .select("*, impugnador:perfiles!objetivo_evidencias_impugnada_por_fkey(nombre), resolutor:perfiles!objetivo_evidencias_impugnacion_resuelta_por_fkey(nombre)")
      .in("resultado_id", ids).eq("vigente", true).order("fecha", { ascending: true }).order("id")),
  });
  const comentarios = useQuery({
    queryKey: ["objetivos", "comentarios", e.id],
    queryFn: () => q<Comentario[]>(supabase.from("objetivo_comentarios").select("*, autor:perfiles(nombre)").eq("evaluacion_id", e.id).order("en")),
  });
  const ajustes = useQuery({
    queryKey: ["objetivos", "ajustes", e.id],
    queryFn: () => q<Ajuste[]>(supabase.from("objetivo_ajustes")
      .select("*, solicitante:perfiles!objetivo_ajustes_solicitado_por_fkey(nombre), resolutor:perfiles!objetivo_ajustes_resuelto_por_fkey(nombre)")
      .eq("evaluacion_id", e.id).order("solicitado_en")),
  });
  const bonos = useBonos(e.mes.slice(0, 7), puede("nomina", 1) && !propia);
  const bono = bonos.data?.find((b) => b.evaluacion_id === e.id);

  const porResultado = useMemo(() => {
    const m = new Map<string, Evidencia[]>();
    (evidencias.data ?? []).forEach((v) => m.set(v.resultado_id, [...(m.get(v.resultado_id) ?? []), v]));
    return m;
  }, [evidencias.data]);

  const medir = useAccion(() => q(supabase.rpc("medir_evaluacion", { p_evaluacion: e.id })), { exito: "Medido otra vez con los datos de hoy", invalidar: claves });
  const enviar = useAccion(() => q(supabase.rpc("enviar_evaluacion", { p_evaluacion: e.id })), { exito: "Enviada a Recursos Humanos", invalidar: claves });
  const revisar = useAccion(() => q(supabase.rpc("revisar_evaluacion", { p_evaluacion: e.id })), { exito: "Revisada: pasa a dirección", invalidar: claves });
  const aprobar = useAccion(() => q(supabase.rpc("aprobar_evaluacion", { p_evaluacion: e.id })), { exito: "Aprobada y cerrada", invalidar: claves });
  const [dialogo, setDialogo] = useState<null | "devolver" | "ajuste">(null);

  const pasos: { estado: EstadoEval; texto: string; quien: string | null; cuando: string | null }[] = [
    { estado: "borrador", texto: "Armado", quien: "Sistema", cuando: e.creado_en },
    { estado: "calificada", texto: "Calificado", quien: e.calificada_por_nombre, cuando: e.calificada_en },
    { estado: "revisada", texto: "Revisado", quien: e.revisada_por_nombre, cuando: e.revisada_en },
    { estado: "aprobada", texto: "Aprobado", quien: e.aprobada_por_nombre, cuando: e.aprobada_en },
  ];
  const orden = ["borrador", "calificada", "revisada", "aprobada"];
  const actual = orden.indexOf(e.estado);
  const ajustePendiente = (ajustes.data ?? []).find((a) => a.estado === "pendiente");

  return (
    <div className="space-y-5">
      {/* Resultado del mes */}
      <div className="grid gap-3 sm:grid-cols-[auto_1fr] items-start">
        <div className="tarjeta px-5 py-4 text-center min-w-[150px]">
          <p className="text-xs text-tenue">Resultado del mes</p>
          <p className={cn("text-4xl font-semibold cifra leading-tight mt-1", e.llave_activada ? "text-peligro" : "")}>{puntos(e.total_final)}</p>
          {e.total_corregido != null && <p className="text-xs text-tenue mt-1">ajustado; calificado {puntos(e.total)}</p>}
          {!e.completa && !e.llave_activada && e.estado === "borrador" && <p className="text-xs text-aviso mt-1">parcial: faltan {e.pendientes}</p>}
          {!propia && puede("nomina", 1) && (
            <p className="text-xs mt-2 pt-2 border-t border-borde">
              {bono?.monto != null ? <>Bono <b className="cifra">{dinero(bono.monto)}</b></> : <span className="text-aviso">Falta definir la base del bono</span>}
            </p>
          )}
        </div>
        <ol className="grid grid-cols-4 gap-1">
          {pasos.map((p, i) => (
            <li key={p.estado} className="min-w-0">
              <div className={cn("h-1.5 rounded-full", i <= actual ? (e.estado === "aprobada" ? "bg-ok" : "bg-marca") : "bg-fondo border border-borde")} />
              <p className={cn("text-xs font-medium mt-1.5", i <= actual ? "text-texto" : "text-tenue")}>{p.texto}</p>
              {i <= actual && p.cuando && <p className="text-[11px] text-tenue truncate" title={`${p.quien ?? ""} · ${fechaYHora(p.cuando)}`}>{i > 0 ? p.quien : ""} {fecha(p.cuando)}</p>}
            </li>
          ))}
          <li className="col-span-4 text-xs text-tenue mt-1">{ESTADOS_EVAL[e.estado].siguiente}{e.evaluador ? ` · jefe directo: ${e.evaluador}` : " · sin jefe asignado: califica RRHH"}</li>
        </ol>
      </div>

      {e.llave_activada && (
        <div className="rounded-lg border border-peligro/30 bg-peligro-suave p-3 text-sm text-peligro flex gap-2">
          <KeyRound className="h-4 w-4 mt-0.5 shrink-0" />
          <div><b>Llave activada: el bono vale 0.</b> {e.llave_detalle}. Los indicadores suman {puntos(e.suma_renglones)}; si una marca estuvo mal, impúgnala.</div>
        </div>
      )}
      {e.devuelta_motivo && e.estado === "borrador" && (
        <div className="rounded-lg border border-aviso/30 bg-aviso-suave p-3 text-sm text-aviso flex gap-2">
          <Undo2 className="h-4 w-4 mt-0.5 shrink-0" /><div><b>Devuelta:</b> {e.devuelta_motivo}</div>
        </div>
      )}

      {/* Indicadores */}
      {resultados.error ? <ErrorCarga error={resultados.error} /> : resultados.isLoading ? <Cargando /> : (
        <div className="tarjeta divide-y divide-borde">
          {(resultados.data ?? []).map((r) => (
            <Renglon key={r.id} r={r} evidencias={porResultado.get(r.id) ?? []} editable={editable}
              puedoImpugnar={puedoCalificar && ["borrador", "calificada"].includes(e.estado)}
              puedoResolver={!propia && !e.es_mia && esRrhh && ["borrador", "calificada"].includes(e.estado)} yo={yo} />
          ))}
          <div className="flex items-center justify-between px-4 py-3 bg-fondo/60 rounded-b-xl text-sm">
            <span className="text-tenue">Suma de los indicadores {e.llave_activada ? "(la llave la deja en 0)" : "(tope de 100 %)"}</span>
            <b className="cifra">{puntos(e.suma_renglones)}</b>
          </div>
        </div>
      )}

      {/* Ajustes (solo meses aprobados) */}
      {(ajustes.data?.length ?? 0) > 0 && (
        <div className="space-y-2">
          <p className="etiqueta">Ajustes</p>
          {ajustes.data!.map((a) => <TarjetaAjuste key={a.id} a={a} puedoResolver={!propia && esRrhh && !e.es_mia && a.solicitado_por !== yo} />)}
        </div>
      )}

      {/* Acciones según el rol y el estado */}
      {!propia && (
        <div className="flex flex-wrap gap-2">
          {editable && <Boton variante="secundario" cargando={medir.isPending} onClick={() => medir.mutate(undefined)}><RefreshCw className="h-4 w-4" /> Volver a medir</Boton>}
          {editable && (
            <Boton cargando={enviar.isPending} disabled={!e.completa && !e.llave_activada} onClick={() => enviar.mutate(undefined)}
              title={!e.completa && !e.llave_activada ? `Faltan ${e.pendientes} por calificar` : undefined}>
              <Send className="h-4 w-4" /> Enviar a RRHH
            </Boton>
          )}
          {esRrhh && !e.es_mia && e.estado === "calificada" && (
            <Boton cargando={revisar.isPending} disabled={e.impugnaciones_pendientes > 0 || e.calificada_por === yo} onClick={() => revisar.mutate(undefined)}
              title={e.impugnaciones_pendientes > 0 ? "Resuelve primero las impugnaciones" : e.calificada_por === yo ? "La calificaste tú: que la revise otra persona" : undefined}>
              <ShieldCheck className="h-4 w-4" /> Marcar revisada
            </Boton>
          )}
          {tieneRol("direccion") && !e.es_mia && e.estado === "revisada" && (
            <Boton variante="exito" cargando={aprobar.isPending} disabled={e.revisada_por === yo} onClick={() => aprobar.mutate(undefined)}>
              <Check className="h-4 w-4" /> Aprobar y cerrar el mes
            </Boton>
          )}
          {esRrhh && ["calificada", "revisada"].includes(e.estado) && (
            <Boton variante="secundario" onClick={() => setDialogo("devolver")}><Undo2 className="h-4 w-4" /> Devolver al jefe</Boton>
          )}
          {esRrhh && !e.es_mia && e.estado === "aprobada" && !ajustePendiente && (
            <Boton variante="secundario" onClick={() => setDialogo("ajuste")}><Scale className="h-4 w-4" /> Pedir un ajuste</Boton>
          )}
        </div>
      )}

      <Comentarios evaluacionId={e.id} lista={comentarios.data ?? []} />
      <DialogoDevolver abierto={dialogo === "devolver"} alCerrar={() => setDialogo(null)} id={e.id} />
      <DialogoAjuste abierto={dialogo === "ajuste"} alCerrar={() => setDialogo(null)} e={e} />
    </div>
  );
}

function Renglon({ r, evidencias, editable, puedoImpugnar, puedoResolver, yo }: {
  r: Resultado; evidencias: Evidencia[]; editable: boolean; puedoImpugnar: boolean; puedoResolver: boolean; yo?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const enContra = evidencias.filter((v) => v.cuenta);
  const pendientes = evidencias.filter((v) => v.impugnacion === "pendiente").length;
  const capturable = editable && (r.fuente === "manual" || r.fuente === "externa" || !r.medido_en);
  const valor = describirValor(r);
  return (
    <div className="px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="font-medium">{r.indicador?.nombre}</p>
            <Insignia tono={FUENTES[r.fuente].tono}>{FUENTES[r.fuente].texto}</Insignia>
            {r.regla === "llave" && <Insignia tono="peligro"><KeyRound className="h-3 w-3" /> Llave</Insignia>}
            {pendientes > 0 && <Insignia tono="aviso"><Flag className="h-3 w-3" /> {pendientes} impugnada{pendientes > 1 ? "s" : ""}</Insignia>}
          </div>
          {r.texto && <p className="text-sm text-tenue mt-0.5">{r.texto}</p>}
          <p className="text-xs text-tenue mt-1">
            {reglaCorta({ ...r, unidad: r.indicador?.unidad })}
            {valor && <> · <span className="text-texto font-medium">{valor}</span></>}
            {r.capturo && r.capturado_en && <> · calificó {r.capturo.nombre}</>}
          </p>
          {r.nota && <p className="text-xs mt-1">“{r.nota}”</p>}
          {r.evidencia_url && <a href={r.evidencia_url} target="_blank" rel="noreferrer" className="text-xs text-marca-texto inline-flex items-center gap-1 mt-1"><ExternalLink className="h-3 w-3" /> Evidencia</a>}
          {r.nota_medicion && !r.capturado_en && <p className="text-xs text-tenue mt-1 flex gap-1"><Gauge className="h-3.5 w-3.5 shrink-0 mt-px" />{r.nota_medicion}</p>}
        </div>
        <div className="w-16 sm:w-28 shrink-0 text-right space-y-1">
          <p className="cifra text-sm"><b className={r.calificacion == null ? "text-tenue" : ""}>{r.calificacion == null ? "—" : numero(r.calificacion)}</b><span className="text-tenue"> / {numero(r.peso)}</span></p>
          <BarraPeso valor={r.calificacion} peso={r.peso} />
        </div>
      </div>
      {capturable && <Captura r={r} />}
      {evidencias.length > 0 && (
        <div className="mt-2">
          <button className="text-xs text-marca-texto inline-flex items-center gap-1" onClick={() => setAbierto(!abierto)}>
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", abierto && "rotate-180")} />
            {abierto ? "Ocultar" : "Ver"} evidencia ({evidencias.length}{enContra.length ? `, ${enContra.length} en contra` : ""})
          </button>
          {abierto && (
            <ul className="mt-2 rounded-lg border border-borde divide-y divide-borde text-sm max-h-80 overflow-y-auto">
              {evidencias.map((v) => <FilaEvidencia key={v.id} v={v} puedoImpugnar={puedoImpugnar} puedoResolver={puedoResolver && v.impugnada_por !== yo} unidad={r.indicador?.unidad} />)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function FilaEvidencia({ v, puedoImpugnar, puedoResolver, unidad }: { v: Evidencia; puedoImpugnar: boolean; puedoResolver: boolean; unidad?: string }) {
  const [impugnando, setImpugnando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const impugnar = useAccion(() => q(supabase.rpc("impugnar_evidencia", { p_evidencia: v.id, p_motivo: motivo })),
    { exito: "Impugnada: RRHH la resuelve", invalidar: [["objetivos"]], alTerminar: () => setImpugnando(false) });
  const resolver = useAccion((aceptar: boolean) => q(supabase.rpc("resolver_impugnacion", { p_evidencia: v.id, p_aceptar: aceptar, p_comentario: null })),
    { exito: "Impugnación resuelta", invalidar: [["objetivos"]] });
  const cantidad = v.cantidad == null ? null : v.tipo === "pedido" || v.tipo === "resumen" && unidad === "pesos" ? dinero(v.cantidad) : null;
  return (
    <li className={cn("px-3 py-2", v.impugnacion === "aceptada" && "opacity-60")}>
      <div className="flex items-start gap-2">
        <span className={cn("mt-1.5 h-2 w-2 rounded-full shrink-0", v.cuenta ? (v.impugnacion === "aceptada" ? "bg-tenue" : "bg-peligro") : "bg-ok")} />
        <div className="min-w-0 flex-1">
          <p><b className="font-medium">{v.folio}</b>{v.fecha && <span className="text-tenue text-xs"> · {fecha(v.fecha)}</span>}{cantidad && <span className="cifra text-xs text-tenue"> · {cantidad}</span>}</p>
          {v.detalle && <p className="text-xs text-tenue">{v.detalle}{v.unidades > 1 ? ` (${numero(v.unidades)} incidencias)` : ""}</p>}
          {v.impugnacion && (
            <p className={cn("text-xs mt-1", v.impugnacion === "pendiente" ? "text-aviso" : v.impugnacion === "aceptada" ? "text-ok" : "text-tenue")}>
              {v.impugnacion === "pendiente" ? "Impugnada" : v.impugnacion === "aceptada" ? "Impugnación aceptada: no cuenta" : "Impugnación rechazada: sí cuenta"}
              {v.impugnador && ` por ${v.impugnador.nombre}`}: “{v.motivo_impugnacion}”
              {v.resolutor && ` · resolvió ${v.resolutor.nombre}`}{v.impugnacion_comentario && ` (${v.impugnacion_comentario})`}
            </p>
          )}
        </div>
        {v.cuenta && v.vigente && !v.impugnacion && puedoImpugnar && !impugnando && (
          <Boton variante="fantasma" tamano="sm" onClick={() => setImpugnando(true)}><Flag className="h-3.5 w-3.5" /> Impugnar</Boton>
        )}
        {v.impugnacion === "pendiente" && puedoResolver && (
          <div className="flex gap-1 shrink-0">
            <Boton variante="secundario" tamano="sm" onClick={() => resolver.mutate(false)} cargando={resolver.isPending && resolver.variables === false}><X className="h-3.5 w-3.5" /> Sí cuenta</Boton>
            <Boton variante="exito" tamano="sm" onClick={() => resolver.mutate(true)} cargando={resolver.isPending && resolver.variables === true}><Check className="h-3.5 w-3.5" /> No cuenta</Boton>
          </div>
        )}
      </div>
      {impugnando && (
        <form className="mt-2 flex flex-col sm:flex-row gap-2" onSubmit={(ev) => { ev.preventDefault(); impugnar.mutate(undefined); }}>
          <Entrada autoFocus value={motivo} onChange={(ev) => setMotivo(ev.target.value)} placeholder="¿Por qué no aplica? Quedará como constancia; no se borra." />
          <div className="flex gap-2 shrink-0">
            <Boton type="button" variante="secundario" tamano="sm" onClick={() => setImpugnando(false)}>Cancelar</Boton>
            <Boton type="submit" tamano="sm" cargando={impugnar.isPending} disabled={motivo.trim().length < 10}>Impugnar</Boton>
          </div>
        </form>
      )}
    </li>
  );
}

/** Captura del jefe: un campo según la regla; Enter guarda. */
function Captura({ r }: { r: Resultado }) {
  const escala = r.parametros?.escala;
  const [valor, setValor] = useState(r.valor != null ? String(r.valor) : "");
  const [incid, setIncid] = useState(r.incidencias != null ? String(r.incidencias) : "");
  const [posibles, setPosibles] = useState(r.posibles != null ? String(r.posibles) : escala ? String(escala) : "");
  const [nota, setNota] = useState(r.nota ?? "");
  const [url, setUrl] = useState(r.evidencia_url ?? "");
  const guardar = useAccion(() => q(supabase.rpc("capturar_resultado", {
    p_resultado: r.id,
    p_valor: valor === "" ? null : Number(valor),
    p_incidencias: incid === "" ? null : Number(incid),
    p_posibles: posibles === "" ? null : Number(posibles),
    p_nota: nota || null,
    p_evidencia_url: url || null,
  })), { exito: "Guardado", invalidar: [["objetivos"]] });
  const porIncidencias = ["descuento", "una_incidencia", "llave"].includes(r.regla);

  function enviar(ev: FormEvent) { ev.preventDefault(); guardar.mutate(undefined); }
  return (
    <form onSubmit={enviar} className="mt-2 rounded-lg bg-fondo/70 border border-borde p-2.5 grid gap-2 sm:grid-cols-[auto_1fr_auto] items-end">
      <div className="flex gap-2 items-end">
        {porIncidencias && (
          <label className="text-xs text-tenue flex flex-col">Incidencias
            <Entrada className="w-24 mt-1" type="number" min={0} step="0.5" value={incid} onChange={(ev) => setIncid(ev.target.value)} placeholder="¿Cuántas?" />
          </label>
        )}
        {(r.regla === "meta" || r.regla === "escalon") && (
          <label className="text-xs text-tenue flex flex-col">Resultado {r.indicador?.unidad ? `(${r.indicador.unidad})` : ""}
            <Entrada className="w-32 mt-1" type="number" step="any" value={valor} onChange={(ev) => setValor(ev.target.value)} />
          </label>
        )}
        {r.regla === "proporcional" && (
          <>
            <label className="text-xs text-tenue flex flex-col">{escala ? "Calificación" : "Cumplidos"}
              <Entrada className="w-20 mt-1" type="number" min={0} step="any" value={valor} onChange={(ev) => setValor(ev.target.value)} />
            </label>
            <label className="text-xs text-tenue flex flex-col">de
              <Entrada className="w-20 mt-1" type="number" min={1} step="any" value={posibles} onChange={(ev) => setPosibles(ev.target.value)} readOnly={!!escala} />
            </label>
          </>
        )}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Entrada value={nota} onChange={(ev) => setNota(ev.target.value)} placeholder="Nota (pedido, orden, qué pasó)" />
        <Entrada value={url} onChange={(ev) => setUrl(ev.target.value)} placeholder="Liga de evidencia (opcional)" />
      </div>
      <Boton type="submit" tamano="sm" cargando={guardar.isPending}><Check className="h-4 w-4" /> Guardar</Boton>
    </form>
  );
}

function TarjetaAjuste({ a, puedoResolver }: { a: Ajuste; puedoResolver: boolean }) {
  const resolver = useAccion((autorizar: boolean) => q(supabase.rpc("resolver_ajuste_objetivo", { p_ajuste: a.id, p_autorizar: autorizar, p_comentario: null })),
    { exito: "Ajuste resuelto", invalidar: [["objetivos"]] });
  const tono: Tono = a.estado === "pendiente" ? "aviso" : a.estado === "autorizado" ? "ok" : "neutro";
  return (
    <div className="rounded-lg border border-borde p-3 text-sm flex flex-col sm:flex-row sm:items-center gap-2">
      <div className="flex-1 min-w-0">
        <p><Insignia tono={tono}>{a.estado === "pendiente" ? "Por autorizar" : a.estado === "autorizado" ? "Autorizado" : "Rechazado"}</Insignia>
          <span className="ml-2 cifra">{puntos(a.total_anterior)} → <b>{puntos(a.total_corregido)}</b></span></p>
        <p className="text-tenue text-xs mt-1">“{a.motivo}” · pidió {a.solicitante?.nombre} {fecha(a.solicitado_en)}{a.resolutor && ` · resolvió ${a.resolutor.nombre}`}</p>
      </div>
      {a.estado === "pendiente" && puedoResolver && (
        <div className="flex gap-2">
          <Boton variante="secundario" tamano="sm" onClick={() => resolver.mutate(false)}>Rechazar</Boton>
          <Boton variante="exito" tamano="sm" onClick={() => resolver.mutate(true)}>Autorizar</Boton>
        </div>
      )}
    </div>
  );
}

function Comentarios({ evaluacionId, lista }: { evaluacionId: string; lista: Comentario[] }) {
  const [texto, setTexto] = useState("");
  const agregar = useAccion(() => q(supabase.from("objetivo_comentarios").insert({ evaluacion_id: evaluacionId, texto: texto.trim() })),
    { invalidar: [["objetivos", "comentarios", evaluacionId]], alTerminar: () => setTexto("") });
  return (
    <div className="space-y-2">
      <p className="etiqueta flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" /> Comentarios</p>
      {lista.length === 0 && <p className="text-sm text-tenue">Sin comentarios. La persona, su jefe y RRHH pueden dejar uno aquí.</p>}
      {lista.map((c) => (
        <div key={c.id} className="text-sm rounded-lg bg-fondo/70 px-3 py-2">
          <p className="text-xs text-tenue">{c.autor?.nombre} · {fechaYHora(c.en)}</p>
          <p className="whitespace-pre-wrap">{c.texto}</p>
        </div>
      ))}
      <form className="flex gap-2" onSubmit={(ev) => { ev.preventDefault(); if (texto.trim()) agregar.mutate(undefined); }}>
        <Entrada value={texto} onChange={(ev) => setTexto(ev.target.value)} placeholder="Escribe un comentario…" />
        <Boton type="submit" variante="secundario" cargando={agregar.isPending} disabled={!texto.trim()}>Comentar</Boton>
      </form>
    </div>
  );
}

function DialogoDevolver({ abierto, alCerrar, id }: { abierto: boolean; alCerrar: () => void; id: string }) {
  const [motivo, setMotivo] = useState("");
  const devolver = useAccion(() => q(supabase.rpc("devolver_evaluacion", { p_evaluacion: id, p_motivo: motivo })),
    { exito: "Devuelta al jefe", invalidar: [["objetivos"]], alTerminar: () => { setMotivo(""); alCerrar(); } });
  return (
    <Dialogo abierto={abierto} alCambiar={(v) => !v && alCerrar()} titulo="Devolver al jefe" descripcion="Vuelve a borrador para que la corrija. El motivo queda en los comentarios."
      pie={<><Boton variante="secundario" onClick={alCerrar}>Cancelar</Boton>
        <Boton cargando={devolver.isPending} disabled={motivo.trim().length < 5} onClick={() => devolver.mutate(undefined)}>Devolver</Boton></>}>
      <Campo etiqueta="¿Qué hay que corregir?">
        <AreaTexto autoFocus value={motivo} onChange={(ev) => setMotivo(ev.target.value)} placeholder="Falta la evidencia del video; la garantía del pedido 7xx no fue por calidad…" />
      </Campo>
    </Dialogo>
  );
}

function DialogoAjuste({ abierto, alCerrar, e }: { abierto: boolean; alCerrar: () => void; e: Evaluacion }) {
  const [total, setTotal] = useState("");
  const [motivo, setMotivo] = useState("");
  const pedir = useAccion(() => q(supabase.rpc("solicitar_ajuste_objetivo", { p_evaluacion: e.id, p_total: Number(total), p_motivo: motivo })),
    { exito: "Ajuste pedido: lo autoriza otra persona", invalidar: [["objetivos"]], alTerminar: () => { setTotal(""); setMotivo(""); alCerrar(); } });
  const valido = total !== "" && Number(total) >= 0 && Number(total) <= 100 && motivo.trim().length >= 10;
  return (
    <Dialogo abierto={abierto} alCambiar={(v) => !v && alCerrar()} titulo="Pedir un ajuste"
      descripcion={`El mes de ${e.empleado_nombre} ya está cerrado (${puntos(e.total_final)}). El ajuste lo autoriza otra persona de RRHH o dirección.`}
      pie={<><Boton variante="secundario" onClick={alCerrar}>Cancelar</Boton>
        <Boton cargando={pedir.isPending} disabled={!valido} onClick={() => pedir.mutate(undefined)}>Pedir ajuste</Boton></>}>
      <form className="space-y-3" onSubmit={(ev) => { ev.preventDefault(); if (valido) pedir.mutate(undefined); }}>
        <Campo etiqueta="Resultado corregido (%)" ayuda="De 0 a 100.">
          <Entrada autoFocus type="number" min={0} max={100} step="0.5" value={total} onChange={(ev) => setTotal(ev.target.value)} />
        </Campo>
        <Campo etiqueta="Motivo" ayuda="Al menos 10 letras. Queda en el historial del mes.">
          <AreaTexto value={motivo} onChange={(ev) => setMotivo(ev.target.value)} />
        </Campo>
      </form>
    </Dialogo>
  );
}

export function AvisoSinBase({ cuantos, className }: { cuantos: number; className?: string }) {
  if (!cuantos) return null;
  return (
    <div className={cn("rounded-lg border border-aviso/30 bg-aviso-suave p-3 text-sm text-aviso flex gap-2", className)}>
      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
      <span><b>Falta definir la base del bono.</b> {cuantos === 1 ? "Hay 1 evaluación aprobada" : `Hay ${cuantos} evaluaciones aprobadas`} con su %, pero dirección no ha dicho cuánto vale el bono por puesto o por persona. Mientras tanto se enseña el % y ningún monto.</span>
    </div>
  );
}

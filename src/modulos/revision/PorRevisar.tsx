// Por revisar: lo que la revisión de la madrugada encontró y le toca a cada quien. Las reglas y
// Claude solo señalan; la persona contesta «Está bien así», «Ya lo corregí» o, si la corrección es
// segura y está definida en la base, «Corrígelo». Quién ve qué lo decide la base: cada quien lo
// suyo y dirección todo, incluidos los patrones que nunca le llegan al responsable.
// «Está bien así» lleva porqué y la IA lo puede cuestionar; «Ayúdame a corregirlo» propone un cambio
// de captura que la persona acepta. En los dos casos la base decide qué se guarda (ver migración 246).
import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Check, CheckCircle2, Lightbulb, Moon, Play, ScanSearch, ShieldAlert, Sparkles, ThumbsDown, ThumbsUp, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Pagina } from "@/components/layout/Shell";
import { Boton } from "@/components/ui/boton";
import { Dialogo } from "@/components/ui/dialogo";
import { Insignia, type Tono } from "@/components/ui/insignia";
import { Interruptor } from "@/components/ui/interruptor";
import { Tarjeta, EncabezadoTarjeta } from "@/components/ui/tarjeta";
import { Cargando, ErrorCarga, Vacio } from "@/components/ui/estados";
import { Pestanas, ListaPestanas, ContenidoPestana } from "@/components/ui/pestanas";
import { supabase } from "@/lib/supabase";
import { ayudaCorregir, revisarPorque } from "@/lib/asistente";
import { AreaTexto } from "@/components/ui/campo";
import { q, useAccion } from "@/lib/consultas";
import { useSesion } from "@/lib/sesion";
import { fecha, fechaYHora, hace, numero } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { GLOSARIO } from "@/tutorial/glosario";

export interface Hallazgo {
  id: string; corrida_id: number | null; origen: "regla" | "claude"; regla: string | null; modulo: string; ruta: string | null;
  titulo: string; detalle: string; para: "responsable" | "direccion"; responsables: string[]; gravedad: "baja" | "media" | "alta";
  evidencia: { tipo?: string; folio?: string; detalle?: string; cantidad?: number; fecha?: string; quien?: string }[];
  accion: { tipo: string; texto?: string } | null; estado: "abierto" | "bien_asi" | "corregido" | "resuelto";
  respuesta: string | null; creado_en: string; cerrado_en: string | null; cerrado_por: string | null;
  tabla: string | null; registro_id: string | null; escalado_en: string | null;
}
interface Corrida {
  id: number; empezo_en: string; termino_en: string | null; claude_estado: string; peticiones: number; entrada_tokens: number; salida_tokens: number;
  hallazgos_reglas: number; hallazgos_claude: number; consejos: number; lecturas: Record<string, string>; nota: string | null;
}
interface Regla { clave: string; modulo: string; nombre: string; descripcion: string; para: string; activa: boolean }
interface Consejo { id: string; usuario_id: string; semana: string; tema: string; titulo: string; texto: string; por_que: string | null; experimento: string | null; opinion: string | null }

const MODULOS: Record<string, string> = {
  inventario: "Inventario", almacen: "Almacén", compras: "Compras", ventas: "Ventas", produccion: "Producción", finanzas: "Finanzas", rrhh: "Recursos Humanos",
};
const GRAVEDAD: Record<Hallazgo["gravedad"], Tono> = { alta: "peligro", media: "aviso", baja: "neutro" };
const ESTADO: Record<Hallazgo["estado"], { texto: string; tono: Tono }> = {
  abierto: { texto: "Abierto", tono: "aviso" }, bien_asi: { texto: "Está bien así", tono: "neutro" },
  corregido: { texto: "Corregido", tono: "ok" }, resuelto: { texto: "Se corrigió solo", tono: "ok" },
};
const CLAUDE: Record<string, string> = {
  no: "Sin IA", enviado: "Esperando a la IA", recogido: "La IA leyó", error: "La IA falló", apagado: "IA apagada", tope: "Tope del mes",
};

const claves = { abiertos: ["revision", "abiertos"], cerrados: ["revision", "cerrados"] };

export default function PorRevisar() {
  const { perfil, tieneRol } = useSesion();
  const dir = tieneRol("direccion");
  // Dirección casi nunca captura lo que se revisa: abre en todo lo abierto.
  const [vista, setVista] = useState(dir ? "todo" : "mios");
  const abiertos = useQuery({
    queryKey: claves.abiertos,
    queryFn: () => q<Hallazgo[]>(supabase.from("revision_hallazgos").select("*").eq("estado", "abierto").order("creado_en", { ascending: false }).limit(500)),
  });
  const todos = abiertos.data ?? [];
  const mios = todos.filter((h) => h.para === "responsable" && perfil && h.responsables.includes(perfil.id));
  const patrones = todos.filter((h) => h.para === "direccion");

  const opciones = [
    { valor: "mios", texto: "Para ti", cuenta: mios.length, explica: GLOSARIO.revisionParaTi },
    ...(dir ? [
      { valor: "patrones", texto: "Patrones", cuenta: patrones.length, explica: GLOSARIO.revisionPatron },
      { valor: "todo", texto: "Todo lo abierto", cuenta: todos.length, explica: GLOSARIO.revisionTodoAbierto },
      { valor: "contestado", texto: "Contestado", explica: GLOSARIO.revisionContestado },
      { valor: "anoche", texto: "Anoche", explica: GLOSARIO.revisionLectura },
      { valor: "consejos", texto: "Consejos", explica: GLOSARIO.consejoSemana },
      { valor: "reglas", texto: "Reglas", explica: GLOSARIO.revisionListaReglas },
    ] : [{ valor: "contestado", texto: "Contestado", explica: GLOSARIO.revisionContestado }]),
  ];

  return (
    <Pagina titulo="Por revisar" descripcion="Lo que la revisión de la madrugada encontró en lo capturado y te toca ver a ti. Contesta cada uno: así no vuelve a salir.">
      <Pestanas value={vista} onValueChange={setVista}>
        <ListaPestanas opciones={opciones} />
        <ContenidoPestana value="mios" className="pt-4">
          <ListaHallazgos consulta={abiertos} lista={mios} yo={perfil?.id}
            vacio={{ titulo: "Nada por revisar", texto: "Cada madrugada el ERP revisa lo que se capturó. Si encuentra algo tuyo que parece error (un artículo repetido, un pago dos veces, una compra atrasada), te llega un aviso y aparece aquí." }} />
        </ContenidoPestana>
        {dir && (
          <>
            <ContenidoPestana value="patrones" className="pt-4 space-y-3">
              <div className="flex items-start gap-3 rounded-xl border border-borde bg-fondo px-4 py-3 text-sm" data-explain={GLOSARIO.revisionPatron}>
                <ShieldAlert className="h-5 w-5 text-tenue shrink-0" />
                <p>Estos solo los ves tú: son patrones (consumos que se disparan, ajustes a la baja que se repiten, gastos iguales) que pueden tener una explicación normal. No acusan a nadie; son para preguntar.</p>
              </div>
              <ListaHallazgos consulta={abiertos} lista={patrones} yo={perfil?.id} conResponsables
                vacio={{ titulo: "Sin patrones abiertos", texto: "Cuando la revisión vea algo que conviene preguntar, sale aquí con su evidencia." }} />
            </ContenidoPestana>
            <ContenidoPestana value="todo" className="pt-4">
              <ListaHallazgos consulta={abiertos} lista={todos} yo={perfil?.id} conResponsables
                vacio={{ titulo: "Nada abierto", texto: "Todo lo que encontró la revisión ya se contestó." }} />
            </ContenidoPestana>
            <ContenidoPestana value="anoche" className="pt-4"><Anoche /></ContenidoPestana>
            <ContenidoPestana value="consejos" className="pt-4"><ConsejosDeTodos /></ContenidoPestana>
            <ContenidoPestana value="reglas" className="pt-4"><Reglas /></ContenidoPestana>
          </>
        )}
        <ContenidoPestana value="contestado" className="pt-4"><Contestado activo={vista === "contestado"} /></ContenidoPestana>
      </Pestanas>
    </Pagina>
  );
}

// Los nombres de quienes responden, para que dirección vea a quién le tocó cada cosa.
function useNombres(ids: string[]) {
  const unicos = [...new Set(ids.filter(Boolean))].sort();
  const r = useQuery({
    queryKey: ["revision", "nombres", unicos],
    enabled: unicos.length > 0,
    queryFn: () => q<{ id: string; nombre: string }[]>(supabase.from("perfiles").select("id, nombre").in("id", unicos)),
    staleTime: 10 * 60_000,
  });
  return new Map((r.data ?? []).map((p) => [p.id, p.nombre]));
}

function ListaHallazgos({ consulta, lista, yo, conResponsables, vacio }: {
  consulta: { isLoading: boolean; error: unknown }; lista: Hallazgo[]; yo?: string; conResponsables?: boolean;
  vacio: { titulo: string; texto: string };
}) {
  const nombres = useNombres(conResponsables ? lista.flatMap((h) => h.responsables) : []);
  if (consulta.error) return <ErrorCarga error={consulta.error} />;
  if (consulta.isLoading) return <Cargando filas={4} />;
  if (!lista.length) return <Vacio icono={CheckCircle2} titulo={vacio.titulo} texto={vacio.texto} />;
  return (
    <div className="space-y-3">
      {lista.map((h) => <TarjetaHallazgo key={h.id} h={h} yo={yo}
        para={conResponsables ? (h.para === "direccion" ? "Solo dirección" : h.responsables.map((r) => nombres.get(r) ?? "…").join(", ")) : undefined} />)}
    </div>
  );
}

// Las tablas cuyos hallazgos admiten «Ayúdame a corregirlo» (la lista vive en la base).
function useTablasCorregibles() {
  return useQuery({
    queryKey: ["revision", "tablas_corregibles"], staleTime: Infinity,
    queryFn: () => q<string[] | null>(supabase.rpc("revision_tablas_corregibles")),
  }).data ?? [];
}

export function TarjetaHallazgo({ h, para }: { h: Hallazgo; yo?: string; para?: string }) {
  const { tieneRol } = useSesion();
  const dir = tieneRol("direccion");
  const [porque, setPorque] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [ayuda, setAyuda] = useState(false);
  const corregibles = useTablasCorregibles();
  const puedeAyuda = !h.accion && !!h.registro_id && !!h.tabla && corregibles.includes(h.tabla);
  const responder = useAccion((a: { respuesta: "corregido" | "corregir"; nota?: string }) =>
    q<string>(supabase.rpc("revision_responder", { p_hallazgo: h.id, p_respuesta: a.respuesta, p_nota: a.nota ?? null })), {
    exito: (m) => m, invalidar: [claves.abiertos, claves.cerrados], alTerminar: () => setConfirmar(false),
  });
  const escalado = !!h.escalado_en;
  return (
    <Tarjeta className="p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span data-explain={GLOSARIO.revisionGravedad}><Insignia tono={GRAVEDAD[h.gravedad]} punto>{h.gravedad === "alta" ? "Urgente" : h.gravedad === "media" ? "Revisar" : "Cuando puedas"}</Insignia></span>
        <span data-explain={h.origen === "claude" ? GLOSARIO.revisionClaude : GLOSARIO.revisionRegla}>
          <Insignia tono={h.origen === "claude" ? "marca" : "neutro"}>{h.origen === "claude" ? <><Sparkles className="h-3 w-3" />IA</> : "Regla"}</Insignia>
        </span>
        {escalado && <span data-explain={GLOSARIO.revisionEscalado} data-explain-title="Lo ve dirección"><Insignia tono="info">Lo ve dirección</Insignia></span>}
        <span className="text-tenue">{MODULOS[h.modulo] ?? h.modulo} · {hace(h.creado_en)}</span>
        {para && <span className="text-tenue" data-explain={GLOSARIO.revisionParaQuien} data-explain-title="Para quién">· Para: {para}</span>}
      </div>
      <div>
        <p className="font-medium">{h.titulo}</p>
        <p className="text-sm text-tenue mt-1">{h.detalle}</p>
      </div>
      {h.evidencia.length > 0 && (
        <ul className="text-sm space-y-1 rounded-lg bg-fondo px-3 py-2" data-explain={GLOSARIO.revisionEvidencia} data-explain-title="Evidencia">
          {h.evidencia.slice(0, 12).map((e, i) => (
            <li key={i} className="flex flex-wrap gap-x-2">
              {e.folio && <b>{e.folio}</b>}
              {e.detalle && <span>{e.detalle}</span>}
              {e.quien && <span className="text-tenue">· {e.quien}</span>}
              {e.cantidad != null && <span className="cifra text-tenue">· {numero(e.cantidad)}</span>}
              {e.fecha && <span className="text-tenue">· {fecha(e.fecha)}</span>}
            </li>
          ))}
          {h.evidencia.length > 12 && <li className="text-tenue">y {h.evidencia.length - 12} más</li>}
        </ul>
      )}
      {escalado && !porque && <Conversacion hallazgo={h.id} titulo="Lo que se platicó con la IA" />}
      {porque ? (
        <PorQue h={h} dir={dir} alCerrar={() => setPorque(false)} />
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {h.accion && (
            <Boton tamano="sm" onClick={() => setConfirmar(true)} data-explain={GLOSARIO.revisionCorrigelo} data-explain-title="Corrígelo">
              <Wand2 className="h-4 w-4" />Corrígelo
            </Boton>
          )}
          {puedeAyuda && (
            <Boton tamano="sm" variante="secundario" onClick={() => setAyuda(true)} data-explain={GLOSARIO.revisionAyudaCorregir} data-explain-title="Ayúdame a corregirlo">
              <Sparkles className="h-4 w-4" />Ayúdame a corregirlo
            </Boton>
          )}
          {/* Se deshabilita mientras guarda: la explicación va en el envoltorio para que no se pierda. */}
          <span data-explain={GLOSARIO.revisionYaLoCorregi} data-explain-title={h.para === "direccion" ? "Ya lo revisé" : "Ya lo corregí"}>
            <Boton tamano="sm" variante="secundario" onClick={() => responder.mutate({ respuesta: "corregido" })} cargando={responder.isPending && !confirmar}>
              <CheckCircle2 className="h-4 w-4" />{h.para === "direccion" ? "Ya lo revisé" : "Ya lo corregí"}
            </Boton>
          </span>
          {(!escalado || dir) && (
            <Boton tamano="sm" variante="secundario" onClick={() => setPorque(true)} data-explain={GLOSARIO.revisionBienAsi} data-explain-title="Está bien así">
              Está bien así
            </Boton>
          )}
          {h.ruta && <Link to={h.ruta} className="ml-auto inline-flex items-center gap-1 text-sm text-marca-texto hover:underline">Abrir <ArrowRight className="h-4 w-4" /></Link>}
        </div>
      )}
      <Dialogo abierto={confirmar} alCambiar={setConfirmar} titulo="¿Lo corrijo?" descripcion={h.accion?.texto}
        pie={<>
          <Boton variante="secundario" onClick={() => setConfirmar(false)}>Cancelar</Boton>
          <Boton onClick={() => responder.mutate({ respuesta: "corregir" })} cargando={responder.isPending}><Wand2 className="h-4 w-4" />Sí, corrígelo</Boton>
        </>}>
        <p className="text-sm text-tenue">Se hace con tus permisos, como si lo hicieras a mano. Si algo lo impide (por ejemplo, el artículo tiene existencias), te dice qué hacer primero.</p>
      </Dialogo>
      {ayuda && <AyudaCorregir h={h} alCerrar={() => setAyuda(false)} />}
    </Tarjeta>
  );
}

interface Turno { id: number; usuario_id: string; rol: "persona" | "ia"; texto: string; veredicto: "acepta" | "pregunta" | "no_convence" | null; creado_en: string }

function useConversacion(hallazgo: string, activo = true) {
  return useQuery({
    queryKey: ["revision", "dialogo", hallazgo], enabled: activo,
    queryFn: () => q<Turno[]>(supabase.from("revision_dialogos").select("*").eq("hallazgo_id", hallazgo).order("id")),
  });
}

function Burbujas({ turnos, nombres }: { turnos: Turno[]; nombres?: Map<string, string> }) {
  return (
    <ol className="space-y-2">
      {turnos.map((t) => (
        <li key={t.id} className={cn("max-w-[85%] rounded-xl px-3 py-2 text-sm", t.rol === "ia" ? "bg-marca-suave text-marca-texto" : "ml-auto bg-fondo")}>
          <span className="block text-xs text-tenue">
            {t.rol === "ia" ? <span className="inline-flex items-center gap-1"><Sparkles className="h-3 w-3" />IA</span> : (nombres?.get(t.usuario_id) ?? "Respuesta")}
          </span>
          {t.texto}
        </li>
      ))}
    </ol>
  );
}

/** Lo que se platicó con la IA sobre un «Está bien así» (para dirección y para quien lo contestó). */
function Conversacion({ hallazgo, titulo }: { hallazgo: string; titulo: string }) {
  const [abierto, setAbierto] = useState(false);
  const r = useConversacion(hallazgo, abierto);
  const nombres = useNombres((r.data ?? []).map((t) => t.usuario_id));
  return (
    <details className="rounded-lg border border-borde px-3 py-2 text-sm" onToggle={(e) => setAbierto((e.target as HTMLDetailsElement).open)}>
      <summary className="cursor-pointer text-marca-texto">{titulo}</summary>
      <div className="pt-2">
        {r.isLoading ? <Cargando filas={2} /> : r.data?.length ? <Burbujas turnos={r.data} nombres={nombres} /> : <p className="text-tenue">No hubo conversación.</p>}
      </div>
    </details>
  );
}

/** «Está bien así»: el porqué siempre; si la IA lo cuestiona, la conversación sigue aquí mismo. */
function PorQue({ h, dir, alCerrar }: { h: Hallazgo; dir: boolean; alCerrar: () => void }) {
  const { perfil } = useSesion();
  const [texto, setTexto] = useState("");
  const conv = useConversacion(h.id);
  const mios = (conv.data ?? []).filter((t) => t.usuario_id === perfil?.id);
  const ultimo = mios.at(-1);
  // Su turno quedó anotado pero la IA no contestó (se cayó la red, por ejemplo): se reintenta sin volver a escribir.
  const esperando = ultimo?.rol === "persona";
  const preguntas = mios.filter((t) => t.veredicto === "pregunta").length;
  const enviar = useAccion(async (t: string) => {
    const r = await q<{ estado: "cerrado" | "revisar"; mensaje?: string }>(supabase.rpc("revision_bien_asi", { p_hallazgo: h.id, p_texto: t }));
    if (r.estado === "cerrado") return { fin: true, mensaje: r.mensaje ?? "Listo: no vuelve a salir" };
    const v = await revisarPorque(h.id);
    if (v.veredicto === "acepta") return { fin: true, mensaje: "La IA quedó de acuerdo: no vuelve a salir" };
    if (v.veredicto === "no_convence") return { fin: true, mensaje: "No quedó claro: se queda abierto y lo ve dirección con esta conversación" };
    return { fin: false, mensaje: "" };
  }, {
    // Sin aviso cuando la IA pregunta: la pregunta ya está a la vista.
    invalidar: [claves.abiertos, claves.cerrados, ["revision", "dialogo", h.id]],
    alTerminar: (r) => { setTexto(""); if (r.fin) { toast.success(r.mensaje); alCerrar(); } },
  });
  const primera = mios.length === 0;
  const corto = primera ? texto.trim().length < 10 : texto.trim().length < 2;
  return (
    <div className="space-y-3 rounded-xl border border-borde p-3">
      {mios.length > 0 && <Burbujas turnos={mios} nombres={new Map(perfil ? [[perfil.id, "Tú"]] : [])} />}
      {enviar.isPending || esperando ? (
        <div className="flex flex-wrap items-center gap-2 text-sm text-tenue">
          {enviar.isPending ? <><Sparkles className="h-4 w-4 animate-pulse text-marca-texto" />La IA está leyendo tu respuesta…</> : (
            <>
              <span>La IA no alcanzó a contestar.</span>
              <Boton tamano="sm" variante="secundario" onClick={() => enviar.mutate("")}>Volver a intentar</Boton>
            </>
          )}
        </div>
      ) : (
        <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); if (!corto) enviar.mutate(texto); }}>
          <label className="block text-sm font-medium" htmlFor={`porque-${h.id}`}>
            {primera ? "¿Por qué está bien así?" : "Tu respuesta"}
            {primera && !dir && <span className="ml-1 font-normal text-tenue">· la IA la lee y, si algo no queda claro, te pregunta (máximo {3 - preguntas} veces)</span>}
          </label>
          <AreaTexto id={`porque-${h.id}`} autoFocus value={texto} onChange={(e) => setTexto(e.target.value)} rows={2}
            placeholder={primera ? "Ej.: «Son dos sucursales con distinto RFC». Escribe el motivo de verdad: así no vuelve a salir algo igual." : "Contesta la pregunta de la IA"}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (!corto) enviar.mutate(texto); } }} />
          <div className="flex flex-wrap items-center gap-2">
            <Boton type="submit" tamano="sm" disabled={corto}><Check className="h-4 w-4" />{primera ? "Guardar" : "Contestar"}</Boton>
            <Boton type="button" tamano="sm" variante="fantasma" onClick={alCerrar}>{primera ? "Cancelar" : "Dejarlo para después"}</Boton>
            {primera && corto && texto.length > 0 && <span className="text-xs text-tenue">Escribe una frase completa.</span>}
          </div>
        </form>
      )}
    </div>
  );
}

/** «Ayúdame a corregirlo»: la IA propone el cambio exacto; nada se aplica hasta que lo aceptas. */
function AyudaCorregir({ h, alCerrar }: { h: Hallazgo; alCerrar: () => void }) {
  const [instruccion, setInstruccion] = useState("");
  const pedir = useAccion((t: string) => ayudaCorregir(h.id, t));
  const aplicar = useAccion((id: string) => q<string>(supabase.rpc("revision_aplicar_propuesta", { p_propuesta: id })), {
    exito: (m) => m, invalidar: [claves.abiertos, claves.cerrados], alTerminar: alCerrar,
  });
  const p = pedir.data;
  return (
    <Dialogo abierto alCambiar={(x) => { if (!x) alCerrar(); }} titulo="Ayúdame a corregirlo"
      descripcion="La IA propone el cambio exacto. No se aplica nada hasta que lo aceptas, y se hace a tu nombre con tus permisos."
      pie={<>
        <Boton variante="secundario" onClick={alCerrar}>{p?.propuesta_id ? "No, gracias" : "Cerrar"}</Boton>
        {p?.propuesta_id
          ? <span data-explain={GLOSARIO.revisionAplicarPropuesta} data-explain-title="Aplicar a mi nombre">
              <Boton onClick={() => aplicar.mutate(p.propuesta_id!)} cargando={aplicar.isPending}><Check className="h-4 w-4" />Aplicar a mi nombre</Boton></span>
          : <span data-explain={GLOSARIO.revisionAyudaCorregir} data-explain-title={p ? "Volver a pedir" : "Pedir propuesta"}>
              <Boton onClick={() => pedir.mutate(instruccion)} cargando={pedir.isPending}><Sparkles className="h-4 w-4" />{p ? "Volver a pedir" : "Pedir propuesta"}</Boton></span>}
      </>}>
      <div className="space-y-3 text-sm">
        <p className="font-medium">{h.titulo}</p>
        <label className="block space-y-1">
          <span className="text-tenue">¿Algo que la IA deba saber? (opcional)</span>
          <AreaTexto value={instruccion} onChange={(e) => setInstruccion(e.target.value)} rows={2} disabled={pedir.isPending || !!p?.propuesta_id}
            placeholder="Ej.: «el tiempo es de 45 días hábiles» o «el contacto es Ana»" />
        </label>
        {pedir.isPending && <p className="flex items-center gap-2 text-tenue"><Sparkles className="h-4 w-4 animate-pulse text-marca-texto" />La IA está revisando el registro…</p>}
        {p && !pedir.isPending && (
          <div className="space-y-2">
            <p>{p.explicacion}</p>
            {p.cambios.length > 0 && (
              <ul className="divide-y divide-borde rounded-lg border border-borde">
                {p.cambios.map((c) => (
                  <li key={`${c.tabla}-${c.id}-${c.campo}`} className="px-3 py-2">
                    <span className="block text-xs text-tenue">{c.etiqueta}</span>
                    <span className="text-tenue line-through">{c.antes_texto}</span>
                    <ArrowRight className="mx-2 inline h-3.5 w-3.5 text-tenue" />
                    <b>{c.despues_texto}</b>
                  </li>
                ))}
              </ul>
            )}
            {p.que_hacer && <p className="rounded-lg bg-aviso-suave px-3 py-2">{p.que_hacer}</p>}
            {p.simulado && <p className="text-xs text-tenue">Modo demostración: sin la IA conectada.</p>}
          </div>
        )}
      </div>
    </Dialogo>
  );
}

function Contestado({ activo }: { activo: boolean }) {
  const dir = useSesion().tieneRol("direccion");
  const r = useQuery({
    queryKey: claves.cerrados, enabled: activo,
    queryFn: () => q<Hallazgo[]>(supabase.from("revision_hallazgos").select("*").neq("estado", "abierto")
      .order("cerrado_en", { ascending: false }).limit(200)),
  });
  const nombres = useNombres((r.data ?? []).map((h) => h.cerrado_por).filter((x): x is string => !!x));
  if (r.error) return <ErrorCarga error={r.error} />;
  if (r.isLoading) return <Cargando filas={4} />;
  if (!r.data?.length) return <Vacio icono={CheckCircle2} titulo="Nada contestado todavía" texto="Lo que contestes en «Para ti» queda aquí, con tu respuesta." />;
  return (
    <div className="tarjeta divide-y divide-borde">
      {r.data.map((h) => (
        <div key={h.id} className="px-4 py-3 text-sm flex flex-wrap items-start gap-x-3 gap-y-1">
          <span data-explain={GLOSARIO.revisionEstadoContestado} data-explain-title={ESTADO[h.estado].texto}><Insignia tono={ESTADO[h.estado].tono}>{ESTADO[h.estado].texto}</Insignia></span>
          <div className="flex-1 min-w-60">
            <p className="font-medium">{h.titulo}</p>
            {h.respuesta && <p className="text-tenue">«{h.respuesta}»</p>}
            {h.estado === "bien_asi" && dir && <div className="mt-1"><Conversacion hallazgo={h.id} titulo="Ver lo que se platicó con la IA" /></div>}
          </div>
          <span className="text-tenue text-xs">{h.cerrado_por ? `${nombres.get(h.cerrado_por) ?? "…"} · ` : ""}{fechaYHora(h.cerrado_en)}</span>
        </div>
      ))}
    </div>
  );
}

function Anoche() {
  const r = useQuery({
    queryKey: ["revision", "corridas"],
    queryFn: () => q<Corrida[]>(supabase.from("revision_corridas").select("*").order("id", { ascending: false }).limit(14)),
  });
  if (r.error) return <ErrorCarga error={r.error} />;
  if (r.isLoading) return <Cargando filas={4} />;
  const [ultima, ...antes] = r.data ?? [];
  if (!ultima) return <Vacio icono={Moon} titulo="Todavía no corre" texto="La revisión corre cada madrugada a las 2:07. Puedes correr las reglas ahora desde «Reglas»." />;
  const lecturas = Object.entries(ultima.lecturas ?? {}).filter(([, t]) => t);
  return (
    <div className="space-y-4">
      <Tarjeta>
        <EncabezadoTarjeta titulo={`Corrida del ${fechaYHora(ultima.empezo_en)}`} explica={GLOSARIO.revisionLectura}
          descripcion={`${ultima.hallazgos_reglas} de reglas · ${ultima.hallazgos_claude} de la IA · ${ultima.consejos} consejos · ${CLAUDE[ultima.claude_estado] ?? ultima.claude_estado}`} />
        <div className="px-5 pb-5 space-y-3">
          {lecturas.length ? lecturas.map(([m, t]) => (
            <div key={m}><p className="text-xs font-semibold uppercase tracking-wide text-tenue">{MODULOS[m] ?? m}</p><p className="text-sm">{t}</p></div>
          )) : <p className="text-sm text-tenue">La IA no dejó lectura en esta corrida{ultima.nota ? `: ${ultima.nota}` : "."}</p>}
          {lecturas.length > 0 && ultima.nota && <p className="text-xs text-tenue">Nota: {ultima.nota}</p>}
        </div>
      </Tarjeta>
      {antes.length > 0 && (
        <div className="tarjeta divide-y divide-borde text-sm">
          {antes.map((c) => (
            <div key={c.id} className="px-4 py-2.5 flex flex-wrap gap-x-4 gap-y-1">
              <span className="w-36">{fechaYHora(c.empezo_en)}</span>
              <span className="cifra">{c.hallazgos_reglas} reglas</span>
              <span className="cifra">{c.hallazgos_claude} IA</span>
              <span className="cifra">{c.consejos} consejos</span>
              <span className="text-tenue" data-explain={GLOSARIO.revisionEstadoIA} data-explain-title="La IA esa noche">{CLAUDE[c.claude_estado] ?? c.claude_estado}</span>
              {c.nota && <span className="text-tenue truncate max-w-md">{c.nota}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ConsejosDeTodos() {
  const r = useQuery({
    queryKey: ["revision", "consejos"],
    queryFn: () => q<Consejo[]>(supabase.from("consejos").select("*").order("semana", { ascending: false }).order("usuario_id").limit(300)),
  });
  const nombres = useNombres((r.data ?? []).map((c) => c.usuario_id));
  if (r.error) return <ErrorCarga error={r.error} />;
  if (r.isLoading) return <Cargando filas={4} />;
  if (!r.data?.length) return <Vacio icono={Lightbulb} titulo="Sin consejos todavía" texto="Los lunes en la madrugada la IA le escribe a cada quien hasta tres consejos con sus números. Aquí ves lo que le dijo a cada persona y si le sirvió." />;
  const utiles = r.data.filter((c) => c.opinion === "util").length, no = r.data.filter((c) => c.opinion === "no_util").length;
  return (
    <div className="space-y-3">
      <p className="text-sm text-tenue">{numero(r.data.length)} consejos · {utiles} «me sirve» · {no} «no me sirve». Cada persona solo ve los suyos.</p>
      <div className="tarjeta divide-y divide-borde">
        {r.data.map((c) => (
          <div key={c.id} className="px-4 py-3 text-sm space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <b>{nombres.get(c.usuario_id) ?? "…"}</b><span className="text-tenue">· semana del {fecha(c.semana)}</span>
              {c.opinion && <Insignia tono={c.opinion === "util" ? "ok" : "neutro"}>{c.opinion === "util" ? "Le sirvió" : "No le sirvió"}</Insignia>}
            </div>
            <p className="font-medium">{c.titulo}</p>
            <p className="text-tenue">{c.texto}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Reglas() {
  const cfg = useQuery({
    queryKey: ["revision", "config"],
    queryFn: () => q<{ valor: { activa: boolean; claude: boolean; consejos: boolean; modelo: string; cuestionar_bien_asi?: boolean } }>(
      supabase.from("configuracion").select("valor").eq("clave", "revision_nocturna").single()),
  });
  const reglas = useQuery({ queryKey: ["revision", "reglas"], queryFn: () => q<Regla[]>(supabase.from("revision_reglas").select("*").order("modulo").order("nombre")) });
  const cambiar = useAccion((c: object) => q(supabase.rpc("revision_configurar", { p_cambios: c })), {
    exito: "Guardado", invalidar: [["revision", "config"], ["revision", "reglas"]],
  });
  const correr = useAccion(() => q<number>(supabase.rpc("revision_correr_ahora")), {
    exito: "Listo: las reglas corrieron y cada quien ya tiene lo suyo", invalidar: [claves.abiertos, ["revision", "corridas"]],
  });
  const v = cfg.data?.valor;
  if (cfg.error || reglas.error) return <ErrorCarga error={cfg.error ?? reglas.error} />;
  if (!v || reglas.isLoading) return <Cargando filas={4} />;
  const fila = (texto: string, detalle: string, activo: boolean, clave: string, explica?: string) => (
    <label className="flex items-start gap-3 px-4 py-3" data-explain={explica} data-explain-title={explica ? texto : undefined}>
      <Interruptor activo={activo} alCambiar={(x) => cambiar.mutate({ [clave]: x })} cargando={cambiar.isPending} aria-label={texto} />
      <span className="text-sm"><b>{texto}</b><span className="block text-tenue">{detalle}</span></span>
    </label>
  );
  return (
    <div className="space-y-4">
      <Tarjeta>
        <EncabezadoTarjeta titulo="La revisión" descripcion="Corre cada madrugada a las 2:07; los avisos salen a las 6 de la mañana."
          acciones={<span data-explain={GLOSARIO.revisionCorrerAhora} data-explain-title="Correr las reglas ahora">
            <Boton tamano="sm" variante="secundario" onClick={() => correr.mutate(undefined)} cargando={correr.isPending}><Play className="h-4 w-4" />Correr las reglas ahora</Boton></span>} />
        <div className="divide-y divide-borde border-t border-borde">
          {fila("Revisión nocturna", "Si la apagas, no corre nada: ni reglas ni IA.", v.activa, "activa", GLOSARIO.revisionNocturnaActiva)}
          {fila("Que la IA lea lo de ayer", "Además de las reglas, la IA lee lo capturado por módulo y señala lo que una regla no ve. Sin costos de artículos, sueldos ni datos personales.", v.claude, "claude", GLOSARIO.revisionClaude)}
          {fila("Que la IA cuestione el «Está bien así»", "Cada «Está bien así» lleva su porqué. Prendido, la IA lo lee y, si no le convence, pregunta hasta 3 veces; si sigue sin convencer, se queda abierto y te llega con la conversación. Lo que contesta dirección no pasa por la IA.", v.cuestionar_bien_asi ?? false, "cuestionar_bien_asi", GLOSARIO.revisionBienAsi)}
          {fila("Consejos de los lunes", "Hasta tres consejos para cada persona con sus propios números (cómo vende, cómo usa el ERP).", v.consejos, "consejos", GLOSARIO.consejoSemana)}
        </div>
      </Tarjeta>
      <Tarjeta>
        <EncabezadoTarjeta titulo="Reglas" descripcion="Las que dicen «Solo dirección» nunca le llegan al responsable." />
        <div className="divide-y divide-borde border-t border-borde">
          {(reglas.data ?? []).map((r) => (
            <div key={r.clave} className="flex items-start gap-3 px-4 py-3">
              <Interruptor activo={r.activa} alCambiar={(x) => cambiar.mutate({ reglas: { [r.clave]: x } })} cargando={cambiar.isPending} aria-label={r.nombre}
                data-explain={GLOSARIO.revisionReglaActiva} data-explain-title={r.nombre} />
              <div className="text-sm flex-1">
                <p className="flex flex-wrap items-center gap-2"><b>{r.nombre}</b><span className="text-tenue">· {MODULOS[r.modulo] ?? r.modulo}</span>
                  {r.para === "direccion" && <span data-explain={GLOSARIO.revisionPatron} data-explain-title="Solo dirección"><Insignia tono="info">Solo dirección</Insignia></span>}</p>
                <p className="text-tenue">{r.descripcion}</p>
              </div>
            </div>
          ))}
        </div>
      </Tarjeta>
    </div>
  );
}

/** En Inicio: cuántas cosas te dejó la revisión (sale solo si hay). */
export function useMisPorRevisar() {
  const { perfil } = useSesion();
  return useQuery({
    queryKey: [...claves.abiertos, "mios", perfil?.id],
    enabled: !!perfil,
    queryFn: async () => {
      const { count, error } = await supabase.from("revision_hallazgos").select("id", { count: "exact", head: true })
        .eq("estado", "abierto").eq("para", "responsable").contains("responsables", [perfil!.id]);
      if (error) throw error;
      return count ?? 0;
    },
  });
}

/** Los consejos de la semana de quien entra, con «me sirve / no me sirve». */
export function ConsejosSemana() {
  const { perfil } = useSesion();
  const r = useQuery({
    queryKey: ["consejos", "mios", perfil?.id],
    enabled: !!perfil,
    queryFn: () => q<Consejo[]>(supabase.from("consejos").select("*").eq("usuario_id", perfil!.id).order("semana", { ascending: false }).limit(6)),
  });
  const opinar = useAccion((a: { id: string; util: boolean }) => q(supabase.rpc("consejo_opinar", { p_consejo: a.id, p_util: a.util })), {
    exito: "Gracias: los consejos que siguen toman en cuenta lo que dijiste", invalidar: [["consejos", "mios"]],
  });
  const semana = r.data?.[0]?.semana;
  const lista = (r.data ?? []).filter((c) => c.semana === semana);
  if (!lista.length) return null;
  return (
    <Tarjeta>
      <EncabezadoTarjeta titulo={<span className="inline-flex items-center gap-2"><Lightbulb className="h-4 w-4 text-aviso" />Tus consejos de la semana</span>}
        descripcion="Salen de tus propios números. Dinos si te sirven: los de la semana que viene lo toman en cuenta." explica={GLOSARIO.consejoSemana} />
      <div className="grid gap-3 px-5 pb-5 md:grid-cols-2 xl:grid-cols-3">
        {lista.map((c) => (
          <div key={c.id} className={cn("rounded-xl border border-borde p-4 space-y-2", c.opinion === "no_util" && "opacity-60")}>
            <p className="font-medium">{c.titulo}</p>
            <p className="text-sm">{c.texto}</p>
            {c.por_que && <p className="text-xs text-tenue">{c.por_que}</p>}
            {c.experimento && (
              <p className="text-sm rounded-lg bg-marca-suave text-marca-texto px-3 py-2" data-explain={GLOSARIO.consejoExperimento} data-explain-title="Tu experimento">
                <b>Pruébalo:</b> {c.experimento}
              </p>
            )}
            <div className="flex gap-2 pt-1">
              {c.opinion ? <span className="text-xs text-tenue">{c.opinion === "util" ? "Te sirvió" : "No te sirvió"}</span> : (
                <span className="flex gap-2" data-explain={GLOSARIO.opinarConsejo} data-explain-title="¿Te sirvió?">
                  <Boton tamano="sm" variante="secundario" onClick={() => opinar.mutate({ id: c.id, util: true })} disabled={opinar.isPending}><ThumbsUp className="h-4 w-4" />Me sirve</Boton>
                  <Boton tamano="sm" variante="fantasma" onClick={() => opinar.mutate({ id: c.id, util: false })} disabled={opinar.isPending}><ThumbsDown className="h-4 w-4" />No me sirve</Boton>
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </Tarjeta>
  );
}

export const ICONO_REVISION = ScanSearch;

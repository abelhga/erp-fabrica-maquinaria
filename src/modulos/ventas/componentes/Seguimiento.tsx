// El seguimiento de cada cotización enviada: la cola de lo que toca preguntar, el diálogo
// «¿Qué pasó?» (lo único que lo cierra; el resultado mueve la oportunidad) y cómo va cada
// vendedor para la gerencia. Las reglas (plazos, freno, quién puede) viven en la base.
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle, CalendarClock, CircleX, Copy, Handshake, Hourglass, Lightbulb, LockOpen, Mail, MapPin, MessageCircle, MessageCircleQuestionMark,
  Phone, PhoneOff, RefreshCw, ShoppingCart, Sparkles, UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { mensajeSeguimiento } from "@/lib/asistente";
import { useSesion } from "@/lib/sesion";
import { fecha } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { Dialogo } from "@/components/ui/dialogo";
import { Boton } from "@/components/ui/boton";
import { AreaTexto, Campo, Entrada } from "@/components/ui/campo";
import { Insignia } from "@/components/ui/insignia";
import { Cargando, Vacio } from "@/components/ui/estados";
import { GLOSARIO } from "@/tutorial/glosario";
import { DialogoMotivo, MOTIVOS_PERDIDA } from "./dialogos";
import { dineroEn, enlaceWhatsApp, folioCot, haceCuanto, hoyMx, type EtapaOportunidad, type Moneda } from "../comun";

export interface Seguimiento {
  id: string; oportunidad_id: string; cotizacion_id: string | null; vendedor_id: string; vendedor: string | null; vence: string;
  creado_en: string; vencido: boolean; dias_vencido: number; titulo: string; etapa: EtapaOportunidad; cliente_id: string;
  cliente: string | null; monto_estimado: number | null; folio: string | null; total: number | null; moneda: Moneda | null;
  enviada_en: string | null; contacto: string | null; telefono: string | null; veces: number; ultimo_que_paso: string | null;
  ultimo_en: string | null;
}
export interface PorVendedor {
  vendedor_id: string; vendedor: string; pendientes: number; vencidos: number; para_hoy: number; anotados_7d: number;
  enviadas_7d: number; frenado: boolean; liberado_motivo: string | null;
}
export interface Freno { vencidos: number; tope: number; frenado: boolean; liberado: boolean; liberado_por: string | null; motivo: string | null }

/** Una cotización que todavía no sale al cliente: con el freno puesto no se envía ni se saca su PDF. */
export const SIN_ENVIAR = ["borrador", "por_autorizar", "autorizada"];
export const mensajeFreno = (f: Pick<Freno, "vencidos" | "tope">) =>
  `Tienes ${f.vencidos} seguimientos vencidos y el tope es ${f.tope}: antes de sacar o enviar otra cotización, anota qué pasó con las que ya mandaste. Si el cliente está esperando, pide a la gerencia de ventas que te libere por hoy.`;

/** Lo que el diálogo necesita saber de la venta, venga de la cola o de una tarjeta del tablero. */
export interface ParaAnotar {
  oportunidad_id: string; titulo: string; cliente: string | null; etapa: EtapaOportunidad; cotizacion_id?: string | null;
  folio?: string | null; total?: number | null; moneda?: Moneda | null; telefono?: string | null; contacto?: string | null;
  vence?: string | null; ultimo_que_paso?: string | null; ultimo_en?: string | null;
}
export type Resultado = "sigue" | "no_contesta" | "contactado" | "negociacion" | "pedido" | "perdida";

const INVALIDAR = [["seguimientos"], ["v_oportunidades"], ["v_cotizaciones"], ["actividades"], ["calendario"], ["indicadores"]];

export function useSeguimientos(habilitado = true) {
  return useQuery({
    queryKey: ["seguimientos", "cola"], enabled: habilitado,
    queryFn: () => q<Seguimiento[]>(supabase.from("v_seguimientos").select("*").order("vence").order("creado_en")),
  });
}
export function usePorVendedor(habilitado = true) {
  return useQuery({
    queryKey: ["seguimientos", "por_vendedor"], enabled: habilitado,
    queryFn: () => q<PorVendedor[]>(supabase.from("v_seguimientos_por_vendedor").select("*").order("vencidos", { ascending: false })),
  });
}
export function useFreno(habilitado = true) {
  return useQuery({
    queryKey: ["seguimientos", "freno"], enabled: habilitado, staleTime: 30_000,
    queryFn: () => q<Freno>(supabase.rpc("freno_seguimiento")),
  });
}

export const deSeguimiento = (s: Seguimiento): ParaAnotar => ({
  oportunidad_id: s.oportunidad_id, titulo: s.titulo, cliente: s.cliente, etapa: s.etapa, cotizacion_id: s.cotizacion_id, folio: s.folio,
  total: s.total, moneda: s.moneda, telefono: s.telefono, contacto: s.contacto, vence: s.vence, ultimo_que_paso: s.ultimo_que_paso, ultimo_en: s.ultimo_en,
});

/** «Ing. Juan Pérez» → «Juan»: el botón dice a quién le escribes, sin el título. */
const nombrePila = (n: string) => n.split(/\s+/).find((p) => p && !p.endsWith(".")) ?? n;

/** «Venció 21 oct», «Hoy», «28 oct»: cuándo toca preguntar (el año solo si no es este). */
export function textoVence(vence: string) {
  const hoy = hoyMx();
  const f = vence.slice(0, 4) === hoy.slice(0, 4) ? fecha(vence).replace(/ \d{4}$/, "") : fecha(vence);
  return vence < hoy ? `Venció ${f}` : vence === hoy ? "Hoy" : f;
}

/** El recordatorio en una tarjeta o renglón; clic abre «¿Qué pasó?» sin abrir lo de abajo. */
export function ChipSeguimiento({ vence, alClic, className }: { vence: string; alClic?: () => void; className?: string }) {
  const hoy = hoyMx();
  const tono = vence < hoy ? "bg-peligro-suave text-peligro" : vence === hoy ? "bg-aviso-suave text-aviso" : "bg-fondo text-tenue";
  return (
    <button type="button" onClick={(e) => { e.stopPropagation(); alClic?.(); }} data-explain={GLOSARIO.seguimientoCotizacion}
      data-explain-title="Seguimiento" className={cn("inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium whitespace-nowrap hover:ring-1 hover:ring-borde", tono, className)}>
      <MessageCircleQuestionMark className="h-3.5 w-3.5 shrink-0" />
      {vence < hoy ? textoVence(vence) : `Seguimiento ${textoVence(vence).toLowerCase()}`}
    </button>
  );
}

const RESULTADOS: { valor: Resultado; texto: string; icono: typeof Phone; ayuda: string }[] = [
  { valor: "sigue", texto: "Sigue en pie", icono: Hourglass, ayuda: "Lo está pensando o comparando. Le vuelves a buscar en la fecha de abajo." },
  { valor: "no_contesta", texto: "No contestó", icono: PhoneOff, ayuda: "Se vuelve a intentar en 2 días hábiles (o la fecha que pongas)." },
  { valor: "contactado", texto: "Contactado", icono: UserCheck, ayuda: "Ya hubo plática: la oportunidad pasa a Contactado." },
  { valor: "negociacion", texto: "Negociando", icono: Handshake, ayuda: "Pidió descuento, otra forma de pago o cambios: pasa a Negociación." },
  { valor: "pedido", texto: "Ya compró", icono: ShoppingCart, ayuda: "Te lleva a la cotización para convertirla en pedido; eso cierra el seguimiento." },
  { valor: "perdida", texto: "Se perdió", icono: CircleX, ayuda: "Elige por qué: la oportunidad y su cotización se cierran." },
];
const CANALES = [
  { valor: "llamada", texto: "Llamada", icono: Phone },
  { valor: "whatsapp", texto: "WhatsApp", icono: MessageCircle },
  { valor: "correo", texto: "Correo", icono: Mail },
  { valor: "visita", texto: "Visita", icono: MapPin },
] as const;

/**
 * El WhatsApp de seguimiento que escribe Claude con lo anotado en «¿Qué pasó?». Es lo que le
 * devuelve al vendedor el trabajo de anotar: con notas retoma lo que dijo el cliente; sin
 * ellas sale general, y lo dice. Nada se manda solo: el vendedor lo revisa y lo abre en WhatsApp.
 */
export function BorradorMensaje({ objetivo, alt = 40 }: { objetivo: ParaAnotar; alt?: number }) {
  // La llave lleva la última nota: anotar algo nuevo pide un mensaje nuevo, no el de antes.
  const borrador = useQuery({
    queryKey: ["mensaje_seguimiento", objetivo.oportunidad_id, objetivo.ultimo_en ?? ""],
    queryFn: () => mensajeSeguimiento(objetivo.oportunidad_id),
    staleTime: Infinity, retry: false,
  });
  const [texto, setTexto] = useState<string | null>(null);
  useEffect(() => setTexto(null), [borrador.data]);
  const mensaje = texto ?? borrador.data?.mensaje ?? "";
  const d = borrador.data;
  if (borrador.isLoading || borrador.isFetching) {
    return <div className="rounded-lg bg-fondo animate-pulse grid place-items-center text-sm text-tenue" style={{ height: alt * 4 }}>
      <span className="inline-flex items-center gap-2"><Sparkles className="h-4 w-4" />Leyendo lo que has anotado y escribiendo…</span></div>;
  }
  if (borrador.error) return <p className="text-sm text-peligro">{(borrador.error as Error).message}</p>;
  return (
    <div className="space-y-2">
      <textarea className="campo py-2 leading-relaxed" style={{ height: alt * 4 }} value={mensaje} onChange={(e) => setTexto(e.target.value)}
        aria-label="Mensaje para el cliente" />
      {d?.consejo && <p className="flex gap-2 rounded-lg bg-marca-suave text-marca-texto px-3 py-2 text-xs">
        <Lightbulb className="h-4 w-4 shrink-0" /><span><b>Para ti:</b> {d.consejo}</span></p>}
      <p className="text-xs text-tenue" data-explain={GLOSARIO.mensajeSeguimiento} data-explain-title="Mensaje con IA">
        {d?.simulado ? "Plantilla básica: con la IA conectada, el mensaje se escribe con lo que anotaste."
          : d?.notas ? `La IA lo escribió con ${d.notas === 1 ? "1 nota" : `${d.notas} notas`} de esta venta. Entre más anotes qué pasó, más a la medida sale.`
          : "Esta venta todavía no tiene notas: el mensaje es general. Anota lo que te diga el cliente en «¿Qué pasó?» y el siguiente saldrá a la medida."}
      </p>
      <div className="flex flex-wrap gap-2">
        <Boton tamano="sm" variante="secundario" disabled={!mensaje}
          onClick={() => { navigator.clipboard.writeText(mensaje); toast.success("Mensaje copiado"); }}><Copy className="h-4 w-4" />Copiar</Boton>
        {objetivo.telefono && <Boton tamano="sm" asChild><a href={enlaceWhatsApp(objetivo.telefono, mensaje)} target="_blank" rel="noopener noreferrer">
          <MessageCircle className="h-4 w-4" />Abrir en WhatsApp</a></Boton>}
        {!d?.simulado && <Boton tamano="sm" variante="fantasma" onClick={() => borrador.refetch()}><RefreshCw className="h-4 w-4" />Otra versión</Boton>}
      </div>
    </div>
  );
}

/** El borrador solo, desde la cola: para escribirle sin abrir «¿Qué pasó?». */
export function DialogoMensaje({ objetivo, alCerrar }: { objetivo: ParaAnotar | null; alCerrar: () => void }) {
  if (!objetivo) return null;
  return (
    <Dialogo abierto alCambiar={(v) => !v && alCerrar()} ancho="max-w-xl"
      titulo={`Mensaje para ${objetivo.contacto ? nombrePila(objetivo.contacto) : objetivo.cliente ?? "el cliente"}`}
      descripcion={[objetivo.cliente, objetivo.folio && folioCot(objetivo.folio), objetivo.titulo].filter(Boolean).join(" · ")}
      pie={<Boton variante="secundario" onClick={alCerrar}>Cerrar</Boton>}>
      <BorradorMensaje objetivo={objetivo} />
    </Dialogo>
  );
}

/**
 * «¿Qué pasó?»: lo único que cierra un seguimiento. Lo que se escribe queda en la bitácora del
 * cliente y el resultado mueve la oportunidad; si sigue viva, agenda el siguiente.
 */
export function DialogoQuePaso({ objetivo, resultadoInicial, alCerrar, alGuardado }: {
  objetivo: ParaAnotar | null; resultadoInicial?: Resultado; alCerrar: () => void; alGuardado?: () => void;
}) {
  const ir = useNavigate();
  const { puede } = useSesion();
  const [redactar, setRedactar] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [texto, setTexto] = useState("");
  const [canal, setCanal] = useState<(typeof CANALES)[number]["valor"]>("llamada");
  const [proxima, setProxima] = useState("");
  const [motivo, setMotivo] = useState("");
  // Se limpia al cambiar de venta, no cada vez que la lista de atrás se recarga.
  const llave = objetivo?.oportunidad_id ?? null;
  useEffect(() => {
    if (!llave) return;
    setResultado(resultadoInicial ?? null); setTexto(""); setCanal("llamada"); setProxima(""); setMotivo(""); setRedactar(false);
  }, [llave, resultadoInicial]);

  const guardar = useAccion(
    () => q(supabase.rpc("registrar_seguimiento", {
      p_oportunidad: objetivo!.oportunidad_id, p_resultado: resultado, p_que_paso: texto.trim() || null, p_canal: canal,
      p_proxima: proxima || null, p_motivo: resultado === "perdida" ? motivo.trim() : null,
    })),
    {
      exito: resultado === "perdida" ? "Anotado: la oportunidad quedó perdida" : resultado === "negociacion" ? "Anotado: pasó a Negociación" : "Seguimiento anotado",
      invalidar: INVALIDAR, alTerminar: () => (alGuardado ?? alCerrar)(),
    },
  );
  if (!objetivo) return null;
  const opciones = RESULTADOS.filter((r) => r.valor !== "contactado" || objetivo.etapa === "prospecto" || resultadoInicial === "contactado");
  const elegido = RESULTADOS.find((r) => r.valor === resultado);
  const textoValido = resultado === "no_contesta" || texto.trim().length >= 3;
  const valido = !!resultado && resultado !== "pedido" && textoValido && (resultado !== "perdida" || motivo.trim().length >= 3);
  const conFecha = resultado && !["perdida", "pedido"].includes(resultado);
  const enviar = () => { if (valido && !guardar.isPending) guardar.mutate(undefined); };

  return (
    <Dialogo abierto={!!objetivo} alCambiar={(v) => !v && alCerrar()} ancho="max-w-xl"
      titulo={`¿Qué pasó con ${objetivo.folio ? folioCot(objetivo.folio) : "esta venta"}?`}
      descripcion={<span>{[objetivo.cliente, objetivo.titulo].filter(Boolean).join(" · ")}
        {objetivo.total != null && <> · <b className="cifra">{dineroEn(Number(objetivo.total), objetivo.moneda ?? "MXN")}</b></>}</span>}
      pie={<>
        <Boton variante="secundario" onClick={alCerrar}>Cancelar</Boton>
        {resultado === "pedido"
          ? <Boton disabled={!objetivo.cotizacion_id} onClick={() => { alCerrar(); ir(`/ventas/cotizaciones/${objetivo.cotizacion_id}`); }}>
              <ShoppingCart className="h-4 w-4" />Ir a convertirla en pedido</Boton>
          : <Boton onClick={enviar} disabled={!valido} cargando={guardar.isPending} variante={resultado === "perdida" ? "peligro" : "primario"}>Guardar</Boton>}
      </>}>
      <div className="space-y-4">
        {(objetivo.telefono || objetivo.ultimo_que_paso || puede("asistente", 1)) && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {objetivo.telefono && <>
              <a className="inline-flex items-center gap-1 rounded-md border border-borde px-2 py-1 text-xs hover:bg-fondo" href={enlaceWhatsApp(objetivo.telefono, "")} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="h-3.5 w-3.5" />WhatsApp{objetivo.contacto ? ` a ${nombrePila(objetivo.contacto)}` : ""}</a>
              <a className="inline-flex items-center gap-1 rounded-md border border-borde px-2 py-1 text-xs hover:bg-fondo" href={`tel:${objetivo.telefono}`}>
                <Phone className="h-3.5 w-3.5" />Llamar</a>
            </>}
            {puede("asistente", 1) && !redactar && (
              <button type="button" onClick={() => setRedactar(true)} data-explain={GLOSARIO.mensajeSeguimiento} data-explain-title="Mensaje con IA"
                className="inline-flex items-center gap-1 rounded-md border border-marca/30 bg-marca-suave text-marca-texto px-2 py-1 text-xs hover:ring-1 hover:ring-marca/40">
                <Sparkles className="h-3.5 w-3.5" />Redactar mensaje</button>
            )}
            {objetivo.ultimo_que_paso && <p className="w-full text-xs text-tenue">La última vez ({haceCuanto(objetivo.ultimo_en)}): {objetivo.ultimo_que_paso}</p>}
          </div>
        )}
        {redactar && <div className="rounded-lg border border-borde p-3"><BorradorMensaje objetivo={objetivo} alt={32} /></div>}

        <div className="space-y-1.5">
          <p className="text-sm font-medium" data-explain={GLOSARIO.resultadoSeguimiento} data-explain-title="Resultado">¿Cómo va?</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {opciones.map((r) => (
              <button key={r.valor} type="button" onClick={() => setResultado(r.valor)}
                className={cn("inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-left transition",
                  resultado === r.valor ? (r.valor === "perdida" ? "border-peligro bg-peligro-suave text-peligro" : "border-marca bg-marca-suave text-marca-texto")
                    : "border-borde hover:bg-fondo")}>
                <r.icono className="h-4 w-4 shrink-0" />{r.texto}
              </button>
            ))}
          </div>
          {elegido && <p className="text-xs text-tenue">{elegido.ayuda}</p>}
        </div>

        {resultado === "perdida" && (
          <div className="space-y-1.5">
            <p className="text-sm font-medium" data-explain={GLOSARIO.motivoPerdida}>¿Por qué se perdió?</p>
            <div className="flex flex-wrap gap-1.5">
              {MOTIVOS_PERDIDA.map((m) => (
                <button key={m} type="button" onClick={() => setMotivo(m)}
                  className={cn("rounded-full border px-3 py-1 text-xs", motivo === m ? "border-peligro bg-peligro-suave text-peligro" : "border-borde text-tenue hover:text-texto hover:bg-fondo")}>{m}</button>
              ))}
            </div>
            <Entrada value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="U otro motivo" />
          </div>
        )}

        {resultado !== "pedido" && <>
          <Campo etiqueta="¿Qué pasó?" ayuda={resultado === "no_contesta" ? "Opcional: cuántas veces le buscaste, si dejaste recado." : "Lo que dijo el cliente y qué sigue. Enter guarda."}>
            <AreaTexto autoFocus rows={2} value={texto} onChange={(e) => setTexto(e.target.value)}
              placeholder="Ej.: lo está viendo con su socio; quiere que le incluyamos la instalación"
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }} />
          </Campo>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <p className="text-sm font-medium">¿Por dónde?</p>
              <div className="flex flex-wrap gap-1">
                {CANALES.map((c) => (
                  <button key={c.valor} type="button" onClick={() => setCanal(c.valor)}
                    className={cn("inline-flex items-center gap-1.5 h-8 rounded-full px-3 text-xs font-medium border transition",
                      canal === c.valor ? "bg-marca text-white border-marca" : "border-borde text-tenue hover:text-texto hover:bg-fondo")}>
                    <c.icono className="h-3.5 w-3.5" />{c.texto}
                  </button>
                ))}
              </div>
            </div>
            {conFecha && (
              <Campo etiqueta="Siguiente seguimiento" className="sm:w-48"
                ayuda={proxima ? undefined : resultado === "no_contesta" ? "Vacío: en 2 días hábiles" : resultado === "contactado" ? "Vacío: sin fecha si no hay cotización" : "Vacío: en 3 días hábiles"}>
                <Entrada type="date" value={proxima} min={hoyMx()} onChange={(e) => setProxima(e.target.value)} />
              </Campo>
            )}
          </div>
        </>}
      </div>
    </Dialogo>
  );
}

/**
 * La cola: primero lo vencido, luego lo de hoy, luego lo que viene. Al guardar uno se abre el
 * siguiente que ya toca, para ponerse al día de corrido.
 */
export function ColaSeguimientos({ filas, cargando, conVendedor }: { filas: Seguimiento[]; cargando: boolean; conVendedor: boolean }) {
  const { puede } = useSesion();
  const [actual, setActual] = useState<string | null>(null);
  const [paraMensaje, setParaMensaje] = useState<Seguimiento | null>(null);
  const hoy = hoyMx();
  const grupos = useMemo(() => [
    { titulo: "Vencidos", filas: filas.filter((s) => s.vence < hoy), tono: "peligro" as const },
    { titulo: "Para hoy", filas: filas.filter((s) => s.vence === hoy), tono: "aviso" as const },
    { titulo: "Próximos", filas: filas.filter((s) => s.vence > hoy), tono: "neutro" as const },
  ].filter((g) => g.filas.length > 0), [filas, hoy]);
  const sel = filas.find((s) => s.id === actual) ?? null;

  function siguiente() {
    const orden = grupos.flatMap((g) => g.filas).filter((s) => s.vence <= hoy);
    const i = orden.findIndex((s) => s.id === actual);
    setActual(orden.find((_, k) => k > i)?.id ?? null);
  }

  if (cargando) return <div className="tarjeta"><Cargando /></div>;
  if (!filas.length) {
    return <div className="tarjeta"><Vacio icono={MessageCircleQuestionMark} titulo="Al día: no hay seguimientos pendientes"
      texto="Cada cotización que envías agenda aquí su seguimiento a 3 días hábiles. Cuando toque, anota qué pasó." /></div>;
  }
  return (
    <div className="space-y-4">
      {grupos.map((g) => (
        <section key={g.titulo} className="space-y-2">
          <h3 className="text-sm font-semibold flex items-center gap-2">{g.titulo}<Insignia tono={g.tono}>{g.filas.length}</Insignia></h3>
          <div className="tarjeta divide-y divide-borde">
            {g.filas.map((s) => (
              <div key={s.id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{s.cliente ?? "Sin cliente"}
                    {conVendedor && s.vendedor && <span className="ml-2 text-xs font-normal text-tenue">{s.vendedor.split(" ")[0]}</span>}</p>
                  <p className="text-sm text-tenue truncate">{[s.folio && folioCot(s.folio), s.titulo].filter(Boolean).join(" · ")}
                    {s.total != null && <> · <span className="cifra">{dineroEn(Number(s.total), s.moneda ?? "MXN")}</span></>}</p>
                  {s.ultimo_que_paso && <p className="text-xs text-tenue truncate mt-0.5">Última vez: {s.ultimo_que_paso}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={cn("text-xs whitespace-nowrap", s.vence < hoy ? "text-peligro font-medium" : "text-tenue")}>{textoVence(s.vence)}</span>
                  {s.telefono && <a href={enlaceWhatsApp(s.telefono, "")} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp a ${s.cliente ?? "cliente"}`}
                    className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-borde text-tenue hover:text-texto hover:bg-fondo"><MessageCircle className="h-4 w-4" /></a>}
                  {puede("asistente", 1) && <button type="button" onClick={() => setParaMensaje(s)} aria-label={`Redactar mensaje para ${s.cliente ?? "el cliente"}`}
                    data-explain={GLOSARIO.mensajeSeguimiento} data-explain-title="Mensaje con IA"
                    className="h-8 px-2.5 inline-flex items-center gap-1.5 rounded-lg border border-marca/30 bg-marca-suave text-marca-texto text-xs font-medium hover:ring-1 hover:ring-marca/40"><Sparkles className="h-4 w-4" />Mensaje</button>}
                  <Boton tamano="sm" variante={s.vence <= hoy ? "primario" : "secundario"} onClick={() => setActual(s.id)}>¿Qué pasó?</Boton>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
      <DialogoQuePaso objetivo={sel && deSeguimiento(sel)} alCerrar={() => setActual(null)} alGuardado={siguiente} />
      <DialogoMensaje objetivo={paraMensaje && deSeguimiento(paraMensaje)} alCerrar={() => setParaMensaje(null)} />
    </div>
  );
}

/** Para la gerencia: cuánto debe cada vendedor, quién está frenado y lo que hizo en la semana. */
export function ResumenVendedores({ filas, elegido, alElegir }: { filas: PorVendedor[]; elegido: string; alElegir: (id: string) => void }) {
  const [liberar, setLiberar] = useState<PorVendedor | null>(null);
  const accion = useAccion(
    (m: string) => q(supabase.rpc("liberar_freno_seguimiento", { p_vendedor: liberar!.vendedor_id, p_motivo: m })),
    { exito: "Liberado por hoy: ya le avisamos", invalidar: [["seguimientos"]], alTerminar: () => setLiberar(null) },
  );
  if (!filas.length) return null;
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" data-explain={GLOSARIO.seguimientosPorVendedor} data-explain-title="Seguimiento por vendedor">
        {filas.map((v) => (
          <div key={v.vendedor_id} role="button" tabIndex={0} onClick={() => alElegir(elegido === v.vendedor_id ? "todos" : v.vendedor_id)}
            onKeyDown={(e) => { if (e.key === "Enter") alElegir(elegido === v.vendedor_id ? "todos" : v.vendedor_id); }}
            className={cn("tarjeta p-4 cursor-pointer hover:border-marca/40", elegido === v.vendedor_id && "ring-2 ring-marca/50", v.frenado && "border-peligro/40")}>
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold truncate">{v.vendedor}</p>
              {v.frenado ? <span data-explain={GLOSARIO.frenoSeguimientos} data-explain-title="Frenado"><Insignia tono="peligro">Frenado</Insignia></span>
                : v.liberado_motivo ? <Insignia tono="info">Liberado hoy</Insignia> : null}
            </div>
            <p className="mt-2 text-sm"><b className={cn("cifra", v.vencidos > 0 && "text-peligro")}>{v.vencidos}</b> vencidos · <b className="cifra">{v.para_hoy}</b> para hoy · <span className="cifra">{v.pendientes}</span> en total</p>
            <p className="text-xs text-tenue mt-1">Últimos 7 días: envió <span className="cifra">{v.enviadas_7d}</span> cotización{v.enviadas_7d === 1 ? "" : "es"} y anotó <span className="cifra">{v.anotados_7d}</span> seguimiento{v.anotados_7d === 1 ? "" : "s"}</p>
            {v.frenado && (
              <Boton tamano="sm" variante="secundario" className="mt-3" onClick={(e) => { e.stopPropagation(); setLiberar(v); }}>
                <LockOpen className="h-3.5 w-3.5" />Liberar por hoy</Boton>
            )}
          </div>
        ))}
      </div>
      <DialogoMotivo abierto={!!liberar} alCambiar={(v) => !v && setLiberar(null)} peligro={false}
        titulo={`¿Dejar enviar cotizaciones a ${liberar?.vendedor.split(" ")[0] ?? ""} hoy?`}
        descripcion={`Tiene ${liberar?.vencidos ?? 0} seguimientos vencidos. Vale solo por hoy; mañana el freno vuelve si sigue sin ponerse al día.`}
        etiqueta="¿Por qué?" sugerencias={["Cliente esperando la cotización", "Se pone al día hoy en la tarde"]}
        textoBoton="Liberar por hoy" cargando={accion.isPending} alConfirmar={(m) => accion.mutate(m)} />
    </>
  );
}

/**
 * Arriba de Cotizaciones: cuántos tocan y, si ya se pasó del tope, que no puede enviar. Dentro
 * de la pestaña de seguimiento (enCola) solo dice cuántos le faltan para volver a enviar.
 */
export function AvisoSeguimientos({ alAbrir, enCola = false }: { alAbrir: () => void; enCola?: boolean }) {
  const { perfil, puede } = useSesion();
  const esGerente = puede("ventas", 3);
  const cola = useSeguimientos(puede("ventas"));
  const freno = useFreno(puede("ventas", 2) && !esGerente);
  const hoy = hoyMx();
  const mias = (cola.data ?? []).filter((s) => esGerente || s.vendedor_id === perfil?.id);
  const vencidos = mias.filter((s) => s.vence < hoy).length, paraHoy = mias.filter((s) => s.vence === hoy).length;
  if (freno.data?.frenado && enCola) {
    const faltan = freno.data.vencidos - freno.data.tope;
    return (
      <p className="flex items-center gap-2 rounded-xl border border-peligro/30 bg-peligro-suave px-4 py-2.5 text-sm" data-explain={GLOSARIO.frenoSeguimientos} data-explain-title="Freno">
        <AlertTriangle className="h-4 w-4 text-peligro shrink-0" />
        Anota qué pasó con {faltan} vencido{faltan === 1 ? "" : "s"} más y vuelves a poder enviar cotizaciones.
      </p>
    );
  }
  if (enCola) return null;
  if (freno.data?.frenado) {
    return (
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-peligro/30 bg-peligro-suave px-4 py-3 text-sm"
        data-explain={GLOSARIO.frenoSeguimientos} data-explain-title="Freno">
        <AlertTriangle className="h-5 w-5 text-peligro shrink-0" />
        <p className="flex-1"><b className="text-peligro">No puedes enviar cotizaciones nuevas.</b> Tienes {freno.data.vencidos} seguimientos vencidos y el tope es {freno.data.tope}: anota qué pasó con las que ya mandaste. Si un cliente está esperando, pide a la gerencia que te libere por hoy.</p>
        <Boton tamano="sm" onClick={alAbrir}>Ponerme al día</Boton>
      </div>
    );
  }
  if (!vencidos && !paraHoy) return null;
  return (
    <div className={cn("flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border px-4 py-3 text-sm",
      vencidos ? "border-aviso/30 bg-aviso-suave" : "border-borde bg-superficie")} data-explain={GLOSARIO.seguimientoCotizacion} data-explain-title="Seguimiento">
      <CalendarClock className={cn("h-5 w-5 shrink-0", vencidos ? "text-aviso" : "text-tenue")} />
      <p className="flex-1">
        {esGerente ? "El equipo tiene " : "Tienes "}
        {vencidos > 0 && <b>{vencidos} seguimiento{vencidos === 1 ? "" : "s"} vencido{vencidos === 1 ? "" : "s"}</b>}
        {vencidos > 0 && paraHoy > 0 && " y "}
        {paraHoy > 0 && <b>{paraHoy} para hoy</b>}
        {": pregunta qué pasó con esas cotizaciones."}
        {!esGerente && freno.data && vencidos > 0 && <span className="text-tenue"> Con más de {freno.data.tope} vencidos ya no se pueden enviar cotizaciones.</span>}
      </p>
      <Boton tamano="sm" variante="secundario" onClick={alAbrir}>{esGerente ? "Ver seguimiento" : "Ponerme al día"}</Boton>
    </div>
  );
}

/** En el centro de mando de dirección: cómo va cada vendedor con sus seguimientos. */
export function SeguimientoEquipo() {
  const ir = useNavigate();
  const filas = usePorVendedor();
  const conAlgo = (filas.data ?? []).filter((v) => v.pendientes > 0 || v.anotados_7d > 0);
  if (!conAlgo.length) return null;
  return (
    <div className="border-t border-borde pt-3 mt-1 space-y-2" data-explain={GLOSARIO.seguimientoEquipo} data-explain-title="Seguimiento de cotizaciones">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium titulo-explicable">Seguimiento de cotizaciones</p>
        <button className="text-sm text-marca-texto" onClick={() => ir("/ventas/cotizaciones?estado=seguimiento")}>Ver</button>
      </div>
      {conAlgo.map((v) => (
        <button key={v.vendedor_id} onClick={() => ir("/ventas/cotizaciones?estado=seguimiento")}
          className="w-full flex items-center justify-between gap-2 text-left text-sm hover:text-marca-texto">
          <span className="truncate">{v.vendedor.split(" ")[0]}
            {v.frenado && <Insignia tono="peligro" className="ml-2">Frenado</Insignia>}
            {!v.frenado && v.liberado_motivo && <Insignia tono="info" className="ml-2">Liberado hoy</Insignia>}</span>
          <span className="cifra text-xs text-tenue whitespace-nowrap">
            <b className={cn(v.vencidos > 0 ? "text-peligro" : "text-texto")}>{v.vencidos}</b> vencidos · {v.para_hoy} hoy · anotó {v.anotados_7d} en 7 días
          </span>
        </button>
      ))}
    </div>
  );
}

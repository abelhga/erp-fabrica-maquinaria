// A quién llamar hoy. La lista la arma la base (oportunidades_sugeridas): sale del
// libro de ventas desde 2018, de las cotizaciones vivas y de las oportunidades
// abiertas, y respeta la cartera (cada vendedor ve sus clientes y los libres).
// Claude solo entra al final, a redactar el mensaje; enviarlo lo decide el vendedor.
// Cada mensaje o llamada queda como intento (v_seguimiento_clientes): la tarjeta pasa
// a "En seguimiento" con el siguiente paso, y se cierra con un resultado.
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, Check, Copy, FileText, Hourglass, MessageCircle, PhoneCall, RefreshCcw, Sparkles, ThumbsDown, ThumbsUp, UserX, Wrench, X } from "lucide-react";
import { toast } from "sonner";
import { Pagina } from "@/components/layout/Shell";
import { Boton } from "@/components/ui/boton";
import { Dialogo } from "@/components/ui/dialogo";
import { Insignia, type Tono } from "@/components/ui/insignia";
import { Cargando, ErrorCarga, Vacio } from "@/components/ui/estados";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { useSesion } from "@/lib/sesion";
import { redactarMensaje } from "@/lib/asistente";
import { dinero, dineroCompacto, fecha, hace, hoyISO, numero } from "@/lib/formato";
import { cn, coincide } from "@/lib/utilidades";
import { MenuAcciones, OpcionMenu } from "@/modulos/ventas/componentes/campos";
import { GLOSARIO } from "@/tutorial/glosario";

interface Oportunidad {
  cliente_id: string; cliente: string; vendedor: string | null; motivo: Motivo; detalle: string;
  ultima_compra: string | null; compras: number | null; total_historico: number | null; ticket_promedio: number | null;
  dias_sin_comprar: number | null; intervalo_tipico: number | null; valor_estimado: number; puntaje: number;
  cotizacion_id: string | null; contacto: string | null; telefono: string | null; whatsapp: string | null; correo: string | null;
}
type Motivo = "cotizacion" | "le_toca" | "refacciones" | "reactivar";
type Canal = "whatsapp" | "llamada" | "correo";
interface Seguimiento {
  cliente_id: string; intentos: number | null; ultimo_en: string | null; ultimo_canal: Canal | null; ultimo_quien: string | null;
  estado: "seguimiento" | "interesa" | "no_por_ahora" | "ya_no_compra" | "sin_respuesta" | null;
  siguiente: "llamar" | "ultimo_mensaje" | "esperar" | null; siguiente_el: string | null;
}
const CANAL: Record<Canal, string> = { whatsapp: "por WhatsApp", llamada: "por teléfono", correo: "por correo" };
const SIGUIENTE = { llamar: "Toca llamar", ultimo_mensaje: "Toca el último mensaje", esperar: "Esperando respuesta" } as const;
const INVALIDAR = [["oportunidades_sugeridas"], ["v_seguimiento_clientes"], ["oportunidades"]];

/** La regla de cada motivo para el modo tutorial (la misma de oportunidades_sugeridas, con números). */
const EXPLICA: Record<Motivo, string> = {
  cotizacion: GLOSARIO.motivoCotizacionPorVencer, le_toca: GLOSARIO.motivoLeToca,
  refacciones: GLOSARIO.motivoRefacciones, reactivar: GLOSARIO.motivoReactivar,
};

const MOTIVOS: Record<Motivo, { texto: string; tono: Tono; icono: typeof FileText; ayuda: string }> = {
  cotizacion: { texto: "Cotización por vencer", tono: "peligro", icono: FileText, ayuda: "Tiene una cotización enviada que vence en 7 días o venció hace poco." },
  le_toca: { texto: "Ya le toca", tono: "aviso", icono: CalendarClock, ayuda: "Compra con un ritmo y ya pasó el tiempo de siempre." },
  refacciones: { texto: "Refacciones", tono: "info", icono: Wrench, ayuda: "Compró un equipo hace 6 meses o más: ya pide rodillos, banda, cangilones o servicio." },
  reactivar: { texto: "Reactivar", tono: "neutro", icono: RefreshCcw, ayuda: "Compró 2 o más veces y lleva entre 6 meses y 3 años sin comprar." },
};

/** wa.me necesita el número con lada de país; los de la hoja vienen a 10 dígitos. */
function numeroWhatsApp(t: string | null) {
  const d = (t ?? "").replace(/\D/g, "");
  if (d.length === 10) return "52" + d;
  if (d.length === 12 && d.startsWith("52")) return d;
  if (d.length === 13 && d.startsWith("521")) return "52" + d.slice(3);
  return null;
}

export default function ParaLlamar() {
  const { puede } = useSesion();
  const registra = puede("ventas", 2);
  const [filtro, setFiltro] = useState<Motivo | "todas" | "seguimiento">("todas");
  const [busca, setBusca] = useState("");
  const [redactando, setRedactando] = useState<Oportunidad | null>(null);
  // Tocó WhatsApp o llamar: al volver, la tarjeta pregunta si sí le escribió (un toque).
  const [porConfirmar, setPorConfirmar] = useState<Record<string, Canal>>({});
  const lista = useQuery({
    queryKey: ["oportunidades_sugeridas"],
    queryFn: () => q<Oportunidad[]>(supabase.rpc("oportunidades_sugeridas", { p_limite: 150 })),
  });
  const seguimiento = useQuery({
    queryKey: ["v_seguimiento_clientes"],
    enabled: registra,
    queryFn: () => q<Seguimiento[]>(supabase.from("v_seguimiento_clientes")
      .select("cliente_id, intentos, ultimo_en, ultimo_canal, ultimo_quien, estado, siguiente, siguiente_el").eq("estado", "seguimiento")),
  });
  const seg = useMemo(() => new Map((seguimiento.data ?? []).map((s) => [s.cliente_id, s])), [seguimiento.data]);
  const marcar = (o: Oportunidad, canal: Canal) => { if (registra) setPorConfirmar((p) => ({ ...p, [o.cliente_id]: canal })); };

  // Los que ya tienen un intento en curso van aparte: así nadie le vuelve a escribir sin querer.
  const pendientes = (lista.data ?? []).filter((o) => !seg.has(o.cliente_id));
  const enSeguimiento = (lista.data ?? []).filter((o) => seg.has(o.cliente_id))
    .sort((a, b) => (seg.get(a.cliente_id)!.siguiente_el ?? "").localeCompare(seg.get(b.cliente_id)!.siguiente_el ?? ""));
  const tocanHoy = enSeguimiento.filter((o) => { const s = seg.get(o.cliente_id)!; return s.siguiente !== "esperar" && (s.siguiente_el ?? "") <= hoyISO(); }).length;
  const conteo = useMemo(() => {
    const c: Record<string, { n: number; valor: number }> = {};
    for (const o of pendientes) {
      c[o.motivo] ??= { n: 0, valor: 0 };
      c[o.motivo].n++; c[o.motivo].valor += Number(o.valor_estimado);
    }
    return c;
  }, [pendientes]);
  const base = filtro === "seguimiento" ? enSeguimiento : pendientes;
  const visibles = base.filter((o) => (filtro === "todas" || filtro === "seguimiento" || o.motivo === filtro) && (!busca || coincide(`${o.cliente} ${o.detalle} ${o.vendedor ?? ""}`, busca)));
  const total = pendientes.reduce((s, o) => s + Number(o.valor_estimado), 0);

  return (
    <Pagina titulo="A quién llamar hoy"
      descripcion="Clientes con un motivo concreto para buscarlos, ordenados por lo que hay en juego. Sale del libro de ventas desde 2018 y de las cotizaciones vivas.">
      {lista.error ? <ErrorCarga error={lista.error} /> : lista.isLoading ? <Cargando filas={8} /> : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            <button onClick={() => setFiltro("todas")}
              className={cn("tarjeta p-4 text-left transition hover:border-marca/40", filtro === "todas" && "ring-2 ring-marca/50 border-marca/50")}>
              <p className="text-sm text-tenue flex items-center gap-2"><PhoneCall className="h-4 w-4 text-marca" />Todas</p>
              <p className="text-2xl font-semibold cifra mt-1">{numero(pendientes.length)}</p>
              <p className="text-xs text-tenue" data-explain={GLOSARIO.enJuego}>{dineroCompacto(total)} en juego</p>
            </button>
            {(Object.keys(MOTIVOS) as Motivo[]).map((m) => {
              const M = MOTIVOS[m];
              return (
                <button key={m} onClick={() => setFiltro(m)} title={M.ayuda} data-explain={EXPLICA[m]} data-explain-title={M.texto}
                  className={cn("tarjeta p-4 text-left transition hover:border-marca/40", filtro === m && "ring-2 ring-marca/50 border-marca/50")}>
                  <p className="text-sm text-tenue flex items-center gap-2"><M.icono className="h-4 w-4" />{M.texto}</p>
                  <p className="text-2xl font-semibold cifra mt-1">{numero(conteo[m]?.n ?? 0)}</p>
                  <p className="text-xs text-tenue">{dineroCompacto(conteo[m]?.valor ?? 0)} en juego</p>
                </button>
              );
            })}
            {registra && (
              <button onClick={() => setFiltro("seguimiento")} data-explain={GLOSARIO.enSeguimiento} data-explain-title="En seguimiento" title="Les escribiste o llamaste y falta su respuesta. Cadencia: WhatsApp, llamada al día 3 y último mensaje al día 10."
                className={cn("tarjeta p-4 text-left transition hover:border-marca/40", filtro === "seguimiento" && "ring-2 ring-marca/50 border-marca/50")}>
                <p className="text-sm text-tenue flex items-center gap-2"><Hourglass className="h-4 w-4" /><span className="titulo-explicable">En seguimiento</span></p>
                <p className="text-2xl font-semibold cifra mt-1">{numero(enSeguimiento.length)}</p>
                <p className={cn("text-xs", tocanHoy ? "text-aviso font-medium" : "text-tenue")}>{tocanHoy ? `${tocanHoy} ${tocanHoy === 1 ? "toca" : "tocan"} hoy` : "Nada para hoy"}</p>
              </button>
            )}
          </div>

          <input className="campo max-w-md" placeholder="Buscar cliente, producto o vendedor…" value={busca} onChange={(e) => setBusca(e.target.value)} />

          {visibles.length === 0 ? (
            <Vacio icono={filtro === "seguimiento" ? Hourglass : PhoneCall} titulo={filtro === "seguimiento" ? "Nadie en seguimiento" : "Nadie en esta lista"}
              texto={filtro === "seguimiento"
                ? "Cuando le escribas o llames a alguien de la lista, aparece aquí con el siguiente paso hasta que contesten."
                : "Cuando un cliente deje pasar su ritmo de compra o una cotización esté por vencer, aparecerá aquí."} />
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {visibles.map((o, i) => {
                const M = MOTIVOS[o.motivo];
                const wa = numeroWhatsApp(o.whatsapp ?? o.telefono);
                const s = seg.get(o.cliente_id);
                return (
                  <article key={o.cliente_id} className="tarjeta p-4 flex flex-col gap-3 animate-entrar min-w-0" style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-semibold leading-snug truncate">{o.cliente}</h3>
                        <p className="text-xs text-tenue">{o.vendedor ?? "Sin vendedor (libre)"}{o.contacto && ` · ${o.contacto}`}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <Insignia tono={M.tono}><M.icono className="h-3 w-3" />{M.texto}</Insignia>
                        <p className="text-sm font-semibold cifra mt-1" data-explain={GLOSARIO.enJuego} data-explain-title="Valor estimado">{dinero(o.valor_estimado)}</p>
                      </div>
                    </div>
                    {s && <EstadoSeguimiento s={s} />}
                    {/* break-words: las descripciones de la hoja traen claves pegadas sin espacios
                        y en celular estiraban la tarjeta fuera de la pantalla. */}
                    <p className="text-sm break-words">{o.detalle}</p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-tenue">
                      {o.ultima_compra && <span>Última compra {fecha(o.ultima_compra)}</span>}
                      {o.compras != null && <span>{numero(o.compras)} {o.compras === 1 ? "compra" : "compras"} · {dineroCompacto(o.total_historico)} desde 2018</span>}
                      {o.intervalo_tipico != null && <span data-explain={GLOSARIO.ritmoCompra}>Ritmo ~{o.intervalo_tipico} días</span>}
                    </div>
                    {porConfirmar[o.cliente_id] ? (
                      <ConfirmarIntento o={o} canal={porConfirmar[o.cliente_id]}
                        alTerminar={() => setPorConfirmar((p) => { const { [o.cliente_id]: _, ...resto } = p; return resto; })} />
                    ) : (
                      <div className="flex flex-wrap gap-2 mt-auto">
                        <Boton tamano="sm" onClick={() => setRedactando(o)}><Sparkles className="h-3.5 w-3.5" />Redactar mensaje</Boton>
                        {wa && (
                          <Boton tamano="sm" variante="secundario" asChild>
                            <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" onClick={() => marcar(o, "whatsapp")}><MessageCircle className="h-3.5 w-3.5" />WhatsApp</a>
                          </Boton>
                        )}
                        {o.telefono && (
                          <Boton tamano="sm" variante="fantasma" asChild>
                            <a href={`tel:${o.telefono.replace(/\s/g, "")}`} onClick={() => marcar(o, "llamada")}><PhoneCall className="h-3.5 w-3.5" />{o.telefono}</a>
                          </Boton>
                        )}
                        {s && registra && <Resultado o={o} />}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}
      {redactando && <Redactar o={redactando} alCerrar={() => setRedactando(null)} alEnviar={(canal) => marcar(redactando, canal)} />}
    </Pagina>
  );
}

/** "Isaac le escribió por WhatsApp hace 3 días · intento 1 de 3 · Toca llamar (18 oct)". */
function EstadoSeguimiento({ s }: { s: Seguimiento }) {
  const toca = s.siguiente !== "esperar" && (s.siguiente_el ?? "") <= hoyISO();
  return (
    <div className={cn("rounded-lg border px-3 py-2 text-sm flex flex-wrap items-center gap-x-3 gap-y-1",
      toca ? "border-aviso/40 bg-aviso-suave" : "border-borde bg-fondo")}>
      <span><b>{s.ultimo_quien ?? "Alguien"}</b> {s.ultimo_canal === "llamada" ? "le llamó" : "le escribió"} {s.ultimo_canal && CANAL[s.ultimo_canal]} {hace(s.ultimo_en)}</span>
      <span className="text-tenue">intento {s.intentos} de 3</span>
      {s.siguiente && (
        <span className={cn("ml-auto font-medium", toca ? "text-aviso" : "text-tenue")}>
          {SIGUIENTE[s.siguiente]}{s.siguiente !== "esperar" ? (toca ? " hoy" : ` el ${fecha(s.siguiente_el)}`) : ` hasta el ${fecha(s.siguiente_el)}`}
        </span>
      )}
    </div>
  );
}

/** Al volver de WhatsApp o del teléfono: "¿Le escribiste?" con un toque. Se puede deshacer. */
function ConfirmarIntento({ o, canal, alTerminar }: { o: Oportunidad; canal: Canal; alTerminar: () => void }) {
  const registrar = useAccion(() => q<string>(supabase.rpc("registrar_intento", { p_cliente: o.cliente_id, p_canal: canal, p_motivo: o.motivo })), {
    exito: `Quedó registrado: ${canal === "llamada" ? "llamada" : "mensaje"} a ${o.cliente}`, invalidar: INVALIDAR, alTerminar,
    deshacer: (id) => q(supabase.rpc("deshacer_intento", { p_id: id })),
  });
  return (
    <div className="mt-auto rounded-lg border border-marca/40 bg-marca-suave/60 px-3 py-2 flex flex-wrap items-center gap-2 text-sm">
      <span className="font-medium mr-auto">{canal === "llamada" ? "¿Sí le llamaste?" : "¿Sí le escribiste?"}</span>
      <Boton tamano="sm" onClick={() => registrar.mutate(undefined)} cargando={registrar.isPending}><Check className="h-3.5 w-3.5" />Sí, {canal === "llamada" ? "le llamé" : "le escribí"}</Boton>
      <Boton tamano="sm" variante="fantasma" onClick={alTerminar}><X className="h-3.5 w-3.5" />No</Boton>
    </div>
  );
}

/** Cómo terminó: le interesa (crea la oportunidad), no por ahora / sin respuesta (vuelve en 90 días) o ya no compra. */
function Resultado({ o }: { o: Oportunidad }) {
  const cerrar = useAccion((a: { resultado: string; razon?: string }) => q<string | null>(supabase.rpc("cerrar_seguimiento", {
    p_cliente: o.cliente_id, p_resultado: a.resultado, p_razon: a.razon ?? null })), {
    exito: (op) => (op ? `Oportunidad creada en Contactado: ${o.cliente}` : `${o.cliente} sale de la lista`), invalidar: INVALIDAR,
  });
  return (
    <MenuAcciones disparador={<Boton tamano="sm" variante="secundario" cargando={cerrar.isPending}>¿Cómo terminó?</Boton>}>
      <OpcionMenu icono={ThumbsUp} alElegir={() => cerrar.mutate({ resultado: "interesa" })}>Le interesa · crear oportunidad</OpcionMenu>
      <OpcionMenu icono={CalendarClock} alElegir={() => cerrar.mutate({ resultado: "no_por_ahora" })}>No por ahora · volver en 90 días</OpcionMenu>
      <OpcionMenu icono={Hourglass} alElegir={() => cerrar.mutate({ resultado: "sin_respuesta" })}>No contesta · volver en 90 días</OpcionMenu>
      <OpcionMenu icono={UserX} peligro alElegir={() => cerrar.mutate({ resultado: "ya_no_compra", razon: "cerro" })}>Ya no compra: cerró</OpcionMenu>
      <OpcionMenu icono={ThumbsDown} peligro alElegir={() => cerrar.mutate({ resultado: "ya_no_compra", razon: "competencia" })}>Ya no compra: compra a la competencia</OpcionMenu>
      <OpcionMenu icono={ThumbsDown} peligro alElegir={() => cerrar.mutate({ resultado: "ya_no_compra", razon: "ya_no_ocupa" })}>Ya no compra: ya no lo ocupa</OpcionMenu>
    </MenuAcciones>
  );
}

function Redactar({ o, alCerrar, alEnviar }: { o: Oportunidad; alCerrar: () => void; alEnviar: (canal: Canal) => void }) {
  const [canal, setCanal] = useState<"whatsapp" | "correo">(o.whatsapp || o.telefono || !o.correo ? "whatsapp" : "correo");
  const borrador = useQuery({
    queryKey: ["redactar", o.cliente_id, canal],
    queryFn: () => redactarMensaje(o.cliente_id, canal, o.detalle),
    staleTime: Infinity,
    retry: false,
  });
  const [texto, setTexto] = useState<string | null>(null);
  const mensaje = texto ?? borrador.data?.mensaje ?? "";
  const wa = numeroWhatsApp(o.whatsapp ?? o.telefono);

  return (
    <Dialogo abierto alCambiar={(a) => !a && alCerrar()} titulo={`Mensaje para ${o.cliente}`} ancho="max-w-xl"
      descripcion={borrador.data?.simulado ? "Plantilla básica: con la llave de la IA conectada, el mensaje se escribe con su historial de compras." : "Lo escribió la IA con el historial del cliente. Revísalo y ajústalo antes de mandarlo."}
      pie={
        <div className="flex flex-wrap justify-end gap-2">
          <Boton variante="secundario" onClick={() => { navigator.clipboard.writeText(mensaje); toast.success("Mensaje copiado"); }} disabled={!mensaje}>
            <Copy className="h-4 w-4" />Copiar
          </Boton>
          {canal === "whatsapp" && wa && (
            <Boton asChild><a href={`https://wa.me/${wa}?text=${encodeURIComponent(mensaje)}`} target="_blank" rel="noreferrer"
              onClick={() => { alEnviar("whatsapp"); alCerrar(); }}><MessageCircle className="h-4 w-4" />Abrir en WhatsApp</a></Boton>
          )}
          {canal === "correo" && o.correo && (
            <Boton asChild><a href={`mailto:${o.correo}?subject=${encodeURIComponent(borrador.data?.asunto ?? "")}&body=${encodeURIComponent(mensaje)}`}
              onClick={() => { alEnviar("correo"); alCerrar(); }}>Abrir correo</a></Boton>
          )}
        </div>
      }>
      <div className="space-y-3">
        <div className="inline-flex rounded-lg border border-borde p-0.5 text-sm">
          {(["whatsapp", "correo"] as const).map((c) => (
            <button key={c} onClick={() => { setCanal(c); setTexto(null); }}
              className={cn("px-3 h-8 rounded-md", canal === c ? "bg-marca text-white" : "text-tenue hover:text-texto")}>
              {c === "whatsapp" ? "WhatsApp" : "Correo"}
            </button>
          ))}
        </div>
        {borrador.isLoading ? (
          <div className="h-40 rounded-lg bg-fondo animate-pulse grid place-items-center text-sm text-tenue">
            <span className="inline-flex items-center gap-2"><Sparkles className="h-4 w-4" />Leyendo su historial y escribiendo…</span>
          </div>
        ) : borrador.error ? (
          <p className="text-sm text-peligro">{(borrador.error as Error).message}</p>
        ) : (
          <>
            {canal === "correo" && borrador.data?.asunto && <p className="text-sm"><span className="text-tenue">Asunto:</span> {borrador.data.asunto}</p>}
            <textarea className="campo h-48 py-2 leading-relaxed" value={mensaje} onChange={(e) => setTexto(e.target.value)} />
          </>
        )}
      </div>
    </Dialogo>
  );
}

// Los correos del embarque: los hilos de Gmail ligados, su texto (sin lo citado) y lo que la IA
// propone después de leerlos. Nada se aplica solo: Alondra marca lo que es correcto y lo aplica
// con las mismas reglas que si lo capturara a mano. Lleva montos: solo quien ve el dinero.
import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Link2, Loader2, Mail, Paperclip, RefreshCw, Search, Sparkles, Unlink } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { Dialogo } from "@/components/ui/dialogo";
import { Campo, Entrada } from "@/components/ui/campo";
import { Tarjeta, EncabezadoTarjeta } from "@/components/ui/tarjeta";
import { Insignia } from "@/components/ui/insignia";
import { Cargando, Vacio } from "@/components/ui/estados";
import { useSesion } from "@/lib/sesion";
import { supabase } from "@/lib/supabase";
import { q, useAccion, mensajeError } from "@/lib/consultas";
import { conectarGmail, llamarCorreo, ErrorCorreo, type MiCorreo } from "@/lib/correo";
import { leerCorreosEmbarque, type PropuestaEmbarque } from "@/lib/asistente";
import { fecha, fechaYHora, numero } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { GLOSARIO } from "@/tutorial/glosario";
import { CLAVE_EMBARQUES, InsigniaDebe, useEtapas, type Embarque } from "./comun";

interface Hilo { id: string; usuario_id: string; cuenta: string; asunto: string | null; mensajes: number; ultimo_mensaje_en: string | null; traido_en: string }
interface Correo { id: string; hilo_id: string; enviado_en: string; de: string | null; para: string | null; asunto: string | null; texto: string; adjuntos: string[] }
interface Propuesta { id: string; estado: "nueva" | "aplicada" | "descartada"; contenido: PropuestaEmbarque; correos: number; creada_en: string; resuelta_en: string | null }
interface Encontrado { id: string; asunto: string | null; de: string | null; mensajes: number; ultimo: string | null; fragmento: string | null; ligado: boolean }

const CAMPOS: Record<string, string> = {
  bl: "BL", bl_house: "BL house", contenedores: "Contenedores", buque: "Buque", viaje: "Viaje", naviera: "Naviera",
  forwarder: "Forwarder", agente_aduanal: "Agente aduanal", referencia_agente: "Referencia del agente", puerto_origen: "Puerto de origen",
};
const quitarNombre = (de: string | null) => de?.replace(/\s*<[^>]+>/, "").replace(/"/g, "").trim() || de || "—";

export function CorreosEmbarque({ e }: { e: Embarque }) {
  const { puede, perfil } = useSesion();
  const captura = puede("importaciones", 2);
  const qc = useQueryClient();
  const etapas = useEtapas();
  const catalogo = useQuery({ queryKey: ["documentos_importacion", "nombres"], staleTime: 60 * 60_000,
    queryFn: () => q<{ tipo: string; nombre: string }[]>(supabase.from("documentos_importacion").select("tipo, nombre")) });
  const [buscando, setBuscando] = useState(false);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [simulada, setSimulada] = useState<PropuestaEmbarque | null>(null);

  const mi = useQuery({ queryKey: ["mi_correo"], queryFn: () => q<MiCorreo>(supabase.rpc("mi_correo")), enabled: captura });
  const hilos = useQuery({ queryKey: ["embarque_hilos", e.id], queryFn: () => q<Hilo[]>(supabase.from("embarque_hilos")
    .select("id, usuario_id, cuenta, asunto, mensajes, ultimo_mensaje_en, traido_en").eq("embarque_id", e.id).order("ultimo_mensaje_en", { ascending: false })) });
  const ids = (hilos.data ?? []).map((h) => h.id);
  const correos = useQuery({
    queryKey: ["embarque_correos", e.id, ids.join()], enabled: ids.length > 0,
    queryFn: () => q<Correo[]>(supabase.from("embarque_correos").select("id, hilo_id, enviado_en, de, para, asunto, texto, adjuntos").in("hilo_id", ids).order("enviado_en")),
  });
  const propuesta = useQuery({ queryKey: ["embarque_propuestas", e.id], queryFn: () => q<Propuesta | null>(supabase.from("embarque_propuestas")
    .select("id, estado, contenido, correos, creada_en, resuelta_en").eq("embarque_id", e.id).order("creada_en", { ascending: false }).limit(1).maybeSingle()) });
  const recargar = () => ["embarque_hilos", "embarque_correos", "embarque_propuestas"].forEach((k) => qc.invalidateQueries({ queryKey: [k, e.id] }));

  const actualizar = useAccion((id: string) => llamarCorreo<{ nuevos: number }>("actualizar", { hilo_id: id }),
    { exito: (r) => (r.nuevos ? `${r.nuevos} correo${r.nuevos === 1 ? "" : "s"} nuevo${r.nuevos === 1 ? "" : "s"}` : "No hay correos nuevos"), alTerminar: recargar });
  const quitar = useAccion((id: string) => q(supabase.rpc("desligar_hilo_embarque", { p_hilo: id })), { exito: "Hilo quitado del embarque", alTerminar: recargar });
  const leer = useMutation({
    mutationFn: () => leerCorreosEmbarque(e.id),
    onSuccess: (r) => {
      if (r.simulado) { setSimulada(r.propuesta); return; }
      setSimulada(null);
      toast.success(`La IA leyó ${r.correos} correo${r.correos === 1 ? "" : "s"}${r.fuera ? ` (los ${r.fuera} más viejos no cupieron)` : ""}`);
      qc.invalidateQueries({ queryKey: ["embarque_propuestas", e.id] });
    },
    onError: (x) => toast.error(mensajeError(x)),
  });

  if (hilos.isLoading || propuesta.isLoading) return <Tarjeta><Cargando /></Tarjeta>;
  const lista = correos.data ?? [];
  const sinPermisoLeer = captura && mi.data && (!mi.data.conectado || !mi.data.lee || !!mi.data.error);
  const vigente = propuesta.data?.estado === "nueva" ? propuesta.data : null;
  const verCorreo = (n: number) => {
    const c = lista[n - 1];
    if (!c) return;
    setAbierto(c.id);
    requestAnimationFrame(() => document.getElementById(`correo-${c.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px] items-start">
      <div className="space-y-5 min-w-0">
        {(vigente || simulada) && (
          <PanelPropuesta e={e} p={simulada ?? vigente!.contenido} propuestaId={simulada ? null : vigente!.id} creada={simulada ? null : vigente!.creada_en}
            etapas={new Map((etapas.data ?? []).map((t) => [t.tipo, t.nombre]))} documentos={new Map((catalogo.data ?? []).map((t) => [t.tipo, t.nombre]))} captura={captura} verCorreo={verCorreo}
            alTerminar={() => { setSimulada(null); recargar(); qc.invalidateQueries({ queryKey: CLAVE_EMBARQUES }); qc.invalidateQueries({ queryKey: ["embarque_eventos", e.id] }); qc.invalidateQueries({ queryKey: ["embarque_documentos"] }); }} />
        )}
        {!vigente && !simulada && propuesta.data && (
          <p className="text-sm text-tenue">La última lectura ({fechaYHora(propuesta.data.creada_en)}) quedó {propuesta.data.estado}.</p>
        )}

        <Tarjeta>
          <EncabezadoTarjeta titulo="Correos" explica={GLOSARIO.correosEmbarque}
            descripcion={lista.length ? `${lista.length} correo${lista.length === 1 ? "" : "s"}, del más nuevo al más viejo. Sin lo citado de correos anteriores.` : undefined}
            acciones={captura && lista.length > 0 && (
              <Boton onClick={() => leer.mutate()} disabled={leer.isPending} data-explain={GLOSARIO.botonLeerCorreosIA}>
                {leer.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} {leer.isPending ? "Leyendo…" : "Leer correos con IA"}
              </Boton>
            )} />
          {!lista.length ? (
            <Vacio icono={Mail} titulo="Este embarque todavía no tiene correos"
              texto={captura ? "Liga los hilos de Gmail donde se lleva este embarque (con el proveedor, el forwarder, la naviera o el agente) y aquí aparecen sus correos." : "Importaciones liga aquí los hilos de correo del embarque."} />
          ) : (
            <ol className="divide-y divide-borde border-t border-borde">
              {[...lista].reverse().map((c) => {
                const n = lista.indexOf(c) + 1;
                const ver = abierto === c.id;
                return (
                  <li key={c.id} id={`correo-${c.id}`} className={cn("px-5 py-3", ver && "bg-fondo/60")}>
                    <button className="w-full text-left flex items-start gap-3" onClick={() => setAbierto(ver ? null : c.id)} aria-expanded={ver}>
                      <span className="cifra text-xs text-tenue w-7 shrink-0 pt-0.5">{n}</span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                          <span className="font-medium text-sm truncate">{quitarNombre(c.de)}</span>
                          <span className="text-xs text-tenue cifra">{fechaYHora(c.enviado_en)}</span>
                        </span>
                        <span className={cn("block text-sm text-tenue", !ver && "line-clamp-2")}>{ver ? c.asunto : (c.texto || c.asunto || "(sin texto)")}</span>
                      </span>
                    </button>
                    {ver && (
                      <div className="mt-2 ml-10 space-y-2">
                        <p className="text-xs text-tenue break-words">Para: {c.para ?? "—"}</p>
                        <p className="text-sm whitespace-pre-wrap break-words">{c.texto || "(sin texto)"}</p>
                        {c.adjuntos.length > 0 && (
                          <p className="text-xs text-tenue flex flex-wrap gap-x-3 gap-y-1">
                            {c.adjuntos.map((a) => <span key={a} className="inline-flex items-center gap-1"><Paperclip className="h-3 w-3" />{a}</span>)}
                          </p>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </Tarjeta>
      </div>

      <Tarjeta>
        <EncabezadoTarjeta titulo="Hilos de Gmail" explica={GLOSARIO.hiloCorreo}
          descripcion="Cada hilo lo pone al día quien lo ligó."
          acciones={captura && (sinPermisoLeer
            ? <Boton variante="secundario" onClick={() => conectarGmail().catch((x) => toast.error(mensajeError(x)))} data-explain={GLOSARIO.botonConectarGmailLectura}><Mail className="h-4 w-4" /> Conectar mi Gmail</Boton>
            : <Boton variante="secundario" onClick={() => setBuscando(true)} disabled={!mi.data}><Link2 className="h-4 w-4" /> Ligar hilo</Boton>)} />
        {sinPermisoLeer && (
          <p className="mx-5 mb-3 text-xs text-aviso">
            {mi.data?.conectado ? "Tu Gmail está conectado sin el permiso de leer. Vuelve a conectarlo y deja marcadas las dos casillas." : "Para ligar hilos, conecta tu Gmail (una sola vez)."}
          </p>
        )}
        {!(hilos.data ?? []).length ? (
          <p className="px-5 pb-5 text-sm text-tenue">Ningún hilo ligado.</p>
        ) : (
          <ul className="divide-y divide-borde border-t border-borde">
            {(hilos.data ?? []).map((h) => (
              <li key={h.id} className="px-5 py-3 space-y-1">
                <p className="text-sm font-medium break-words">{h.asunto || "(sin asunto)"}</p>
                <p className="text-xs text-tenue">{h.mensajes} correo{h.mensajes === 1 ? "" : "s"} · último {fecha(h.ultimo_mensaje_en)} · {h.cuenta}</p>
                <p className="text-xs text-tenue">Traído {fechaYHora(h.traido_en)}</p>
                {captura && (
                  <div className="flex gap-1 pt-1">
                    {h.usuario_id === perfil?.id && (
                      <Boton tamano="sm" variante="fantasma" onClick={() => actualizar.mutate(h.id)} disabled={actualizar.isPending} data-explain={GLOSARIO.botonTraerLoNuevoHilo}>
                        <RefreshCw className={cn("h-3.5 w-3.5", actualizar.isPending && "animate-spin")} /> Traer lo nuevo
                      </Boton>
                    )}
                    <Boton tamano="sm" variante="fantasma" onClick={() => quitar.mutate(h.id)} disabled={quitar.isPending} data-explain={GLOSARIO.botonQuitarHilo}><Unlink className="h-3.5 w-3.5" /> Quitar</Boton>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>

      {buscando && <BuscarHilos e={e} abierto={buscando} alCambiar={setBuscando} alLigar={recargar} />}
    </div>
  );
}

function BuscarHilos({ e, abierto, alCambiar, alLigar }: { e: Embarque; abierto: boolean; alCambiar: (v: boolean) => void; alLigar: () => void }) {
  const [texto, setTexto] = useState(e.bl || e.referencia_agente || e.folio);
  const buscar = useMutation({
    mutationFn: (consulta: string) => llamarCorreo<{ hilos: Encontrado[] }>("buscar", { q: consulta, embarque_id: e.id }),
    onError: (x) => (x instanceof ErrorCorreo && x.conectar ? conectarGmail().catch(() => undefined) : toast.error(mensajeError(x))),
  });
  const ligar = useAccion((hilo: string) => llamarCorreo<{ mensajes: number }>("ligar", { embarque_id: e.id, hilo }),
    { exito: (r) => `Hilo ligado: ${r.mensajes} correo${r.mensajes === 1 ? "" : "s"}`, alTerminar: () => { alLigar(); buscar.mutate(texto); } });
  const enviar = (ev: FormEvent) => { ev.preventDefault(); if (texto.trim()) buscar.mutate(texto.trim()); };

  return (
    <Dialogo abierto={abierto} alCambiar={alCambiar} ancho="max-w-2xl" titulo="Ligar un hilo de Gmail"
      descripcion="Busca en tu Gmail como lo harías allá: el BL, la referencia del agente, el número de la PI o el nombre del proveedor.">
      <form onSubmit={enviar} className="flex gap-2 items-end">
        <Campo etiqueta="Buscar en mi Gmail" className="flex-1"><Entrada id="buscar-hilo" value={texto} onChange={(x) => setTexto(x.target.value)} autoFocus
          data-explain={GLOSARIO.ligarHiloGmail} data-explain-title="Buscar en mi Gmail" /></Campo>
        <Boton type="submit" disabled={buscar.isPending}>{buscar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Buscar</Boton>
      </form>
      {buscar.data && (
        buscar.data.hilos.length === 0 ? <p className="mt-4 text-sm text-tenue">No salió nada. Prueba con otra palabra (el proveedor, el contenedor, el puerto).</p> : (
          <ul className="mt-4 divide-y divide-borde border border-borde rounded-lg">
            {buscar.data.hilos.map((h) => (
              <li key={h.id} className="p-3 flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium break-words">{h.asunto || "(sin asunto)"}</p>
                  <p className="text-xs text-tenue">{quitarNombre(h.de)} · {h.mensajes} correo{h.mensajes === 1 ? "" : "s"} · {fecha(h.ultimo)}</p>
                  {h.fragmento && <p className="text-xs text-tenue line-clamp-2 mt-0.5">{h.fragmento}</p>}
                </div>
                {h.ligado ? <Insignia tono="ok">Ligado</Insignia>
                  : <Boton tamano="sm" onClick={() => ligar.mutate(h.id)} disabled={ligar.isPending} data-explain={GLOSARIO.ligarHiloGmail}><Link2 className="h-3.5 w-3.5" /> Ligar</Boton>}
              </li>
            ))}
          </ul>
        )
      )}
    </Dialogo>
  );
}

type Clave = string;
function PanelPropuesta({ e, p, propuestaId, creada, etapas, documentos, captura, verCorreo, alTerminar }: {
  e: Embarque; p: PropuestaEmbarque; propuestaId: string | null; creada: string | null; etapas: Map<string, string>; documentos: Map<string, string>;
  captura: boolean; verCorreo: (n: number) => void; alTerminar: () => void;
}) {
  // Todo marcado de entrada: lo normal es que la propuesta sea correcta y Alondra quite lo que no.
  const todas = useMemo(() => new Set<Clave>([
    ...p.eventos.map((_, i) => `ev${i}`), ...(p.eta ? ["eta"] : []), ...(p.etd ? ["etd"] : []),
    ...p.campos.map((_, i) => `ca${i}`), ...p.documentos.map((_, i) => `do${i}`)]), [p]);
  const [marcadas, setMarcadas] = useState(todas);
  const alternar = (k: Clave) => setMarcadas((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const aplicar = useAccion(() => {
    const campos: Record<string, string> = {};
    if (p.eta && marcadas.has("eta")) campos.eta = p.eta.fecha;
    if (p.etd && marcadas.has("etd")) campos.etd = p.etd.fecha;
    p.campos.forEach((c, i) => { if (marcadas.has(`ca${i}`)) campos[c.campo] = c.valor; });
    return q<{ eventos: number; campos: number; documentos: number }>(supabase.rpc("aplicar_propuesta_embarque", { p_propuesta: propuestaId, p_items: {
      eventos: p.eventos.filter((_, i) => marcadas.has(`ev${i}`)).map((x) => ({ tipo: x.tipo, fecha: x.fecha, detalle: `Según el correo ${x.correo}: «${x.cita}»`.slice(0, 300) })),
      campos,
      documentos: p.documentos.filter((_, i) => marcadas.has(`do${i}`)).map((x) => ({ tipo: x.tipo, fecha: x.fecha })),
    } }));
  }, { exito: (r) => `Aplicado: ${r.eventos} fecha${r.eventos === 1 ? "" : "s"}, ${r.campos} dato${r.campos === 1 ? "" : "s"} y ${r.documentos} documento${r.documentos === 1 ? "" : "s"}`, alTerminar });
  const descartar = useAccion(() => q(supabase.rpc("descartar_propuesta_embarque", { p_propuesta: propuestaId })), { exito: "Propuesta descartada", alTerminar });
  const aplicables = todas.size;
  const Origen = ({ n, cita }: { n: number; cita?: string }) => (
    <span className="text-xs text-tenue">
      <button className="underline decoration-dotted hover:text-texto" onClick={() => verCorreo(n)}>Correo {n}</button>{cita ? ` · «${cita}»` : ""}
    </span>
  );
  const Fila = ({ k, titulo, detalle }: { k: Clave; titulo: React.ReactNode; detalle: React.ReactNode }) => (
    <label className="flex items-start gap-3 py-2 cursor-pointer">
      <input type="checkbox" className="mt-1 h-4 w-4 accent-[hsl(var(--marca))]" checked={marcadas.has(k)} onChange={() => alternar(k)} disabled={!captura || !propuestaId} />
      <span className="min-w-0"><span className="block text-sm">{titulo}</span>{detalle}</span>
    </label>
  );

  return (
    <Tarjeta className="border-marca/40">
      <EncabezadoTarjeta titulo={<span className="inline-flex items-center gap-2"><Sparkles className="h-4 w-4 text-marca" /> Lo que dicen los correos</span>}
        explica={GLOSARIO.propuestaCorreos}
        descripcion={propuestaId ? `Leído el ${fechaYHora(creada)}. Marca lo que es correcto y aplícalo; todavía no se cambia nada.` : "Ejemplo: así se verá cuando la IA esté conectada. No se puede aplicar."} />
      <div className="px-5 pb-5 space-y-4">
        <p className="text-sm leading-relaxed">{p.resumen}</p>
        {p.advertencias.length > 0 && (
          <ul className="rounded-lg bg-aviso-suave text-aviso text-sm p-3 space-y-1">
            {p.advertencias.map((a, i) => <li key={i} className="flex gap-2"><AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />{a}</li>)}
          </ul>
        )}
        {aplicables > 0 && (
          <div className="divide-y divide-borde">
            {p.eventos.map((x, i) => <Fila key={`ev${i}`} k={`ev${i}`} titulo={<><b className="font-medium">{etapas.get(x.tipo) ?? x.tipo}</b> el {fecha(x.fecha)}</>} detalle={<Origen n={x.correo} cita={x.cita} />} />)}
            {p.eta && <Fila k="eta" titulo={<><b className="font-medium">ETA</b> {fecha(p.eta.fecha)} <span className="text-tenue">(hoy: {fecha(e.eta)})</span></>} detalle={<Origen n={p.eta.correo} cita={p.eta.cita} />} />}
            {p.etd && <Fila k="etd" titulo={<><b className="font-medium">ETD</b> {fecha(p.etd.fecha)} <span className="text-tenue">(hoy: {fecha(e.etd)})</span></>} detalle={<Origen n={p.etd.correo} cita={p.etd.cita} />} />}
            {p.campos.map((x, i) => (
              <Fila key={`ca${i}`} k={`ca${i}`} titulo={<><b className="font-medium">{CAMPOS[x.campo] ?? x.campo}:</b> {x.valor} <span className="text-tenue">(hoy: {(e as unknown as Record<string, string | null>)[x.campo] || "—"})</span></>}
                detalle={<Origen n={x.correo} cita={x.cita} />} />
            ))}
            {p.documentos.map((x, i) => (
              <Fila key={`do${i}`} k={`do${i}`} titulo={<><b className="font-medium">Llegó:</b> {documentos.get(x.tipo) ?? x.tipo}{x.fecha ? ` el ${fecha(x.fecha)}` : ""}</>}
                detalle={<Origen n={x.correo} cita={x.cita} />} />
            ))}
          </div>
        )}
        {p.pendientes.length > 0 && (
          <div>
            <p className="text-xs font-medium text-tenue uppercase tracking-wide mb-1" data-explain={GLOSARIO.pendientesCorreos}>Pendiente</p>
            <ul className="space-y-1.5">
              {p.pendientes.map((x, i) => (
                <li key={i} className="text-sm flex flex-wrap items-center gap-2">
                  <InsigniaDebe debe={x.quien as never} /> <span>{x.que}</span>
                  <span className="text-xs text-tenue">{x.desde ? `desde el ${fecha(x.desde)} · ` : ""}<button className="underline decoration-dotted" onClick={() => verCorreo(x.correo)}>Correo {x.correo}</button></span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {p.montos.length > 0 && (
          <div>
            <p className="text-xs font-medium text-tenue uppercase tracking-wide mb-1" data-explain={GLOSARIO.montosCorreos} data-explain-title="Montos que mencionan">Montos que mencionan (no se aplican)</p>
            <ul className="space-y-1">
              {p.montos.map((x, i) => (
                <li key={i} className="text-sm flex flex-wrap gap-x-2">
                  <span>{x.concepto}</span><span className="cifra">{numero(x.monto)} {x.moneda}</span>
                  <button className="text-xs text-tenue underline decoration-dotted" onClick={() => verCorreo(x.correo)}>Correo {x.correo}</button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {captura && propuestaId && (
          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <Boton variante="fantasma" onClick={() => descartar.mutate(undefined)} disabled={descartar.isPending} data-explain={GLOSARIO.botonDescartarPropuestaCorreos}>Descartar</Boton>
            {aplicables > 0 && (
              <Boton onClick={() => aplicar.mutate(undefined)} disabled={aplicar.isPending || marcadas.size === 0}>
                Aplicar {marcadas.size} de {aplicables}
              </Boton>
            )}
          </div>
        )}
      </div>
    </Tarjeta>
  );
}

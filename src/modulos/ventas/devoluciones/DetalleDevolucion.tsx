import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Ban, CheckCircle2, MessageSquareReply, PackageOpen, ShieldCheck } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { Insignia } from "@/components/ui/insignia";
import { Dialogo } from "@/components/ui/dialogo";
import { AreaTexto, Campo, Entrada, Seleccion } from "@/components/ui/campo";
import { useSesion } from "@/lib/sesion";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { dinero, fecha, fechaYHora, numero } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { CampoNumero, Dato } from "@/modulos/ventas/componentes/campos";
import { DialogoMotivo } from "@/modulos/ventas/componentes/dialogos";
import { Galeria, SubirArchivo } from "@/modulos/almacen/envios/Archivos";
import { EvidenciaSalida } from "@/modulos/almacen/envios/EvidenciaSalida";
import {
  CLAVE, RESULTADO, faltan, useAlmacenes, useArchivos, useEnvios, useEventos, useLineasDevolucion, type Devolucion,
} from "@/modulos/almacen/envios/datos";

const CANAL: Record<string, string> = { mercadolibre: "Mercado Libre", sitio_web: "Sitio web", amazon: "Amazon", directo: "Directo", mostrador: "Mostrador", distribuidor: "Distribuidor" };

/**
 * Una devolución, reclamo o cancelación: lo que pasó, lo que toca, y junto a todo
 * la evidencia de salida de esa venta (fotos, check list, serie, quién empacó),
 * que es con lo que uno se defiende ante Mercado Libre o el cliente.
 */
export function DetalleDevolucion({ dev: d }: { dev: Devolucion }) {
  const { puede } = useSesion();
  const lineas = useLineasDevolucion(d.id);
  const archivos = useArchivos({ devolucionId: d.id });
  const eventos = useEventos({ devolucionId: d.id });
  const envios = useEnvios({ pedidoId: d.pedido_id });
  const almacen = puede("envios", 2) && puede("inventario", 2);
  const captura = puede("envios", 2);
  const [dlg, setDlg] = useState<null | "responder" | "recibir" | "decidir" | "cerrar" | "cancelar">(null);
  const inv = { invalidar: [CLAVE] };
  const actualizar = useAccion((datos: Record<string, unknown>) => q(supabase.rpc("actualizar_devolucion", { p_dev: d.id, p_datos: datos })), { ...inv, exito: "Guardado" });
  const responder = useAccion((r: string) => q(supabase.rpc("responder_reclamo", { p_dev: d.id, p_respuesta: r })), { ...inv, exito: "Respuesta registrada", alTerminar: () => setDlg(null) });
  const cancelar = useAccion((m: string) => q(supabase.rpc("cancelar_devolucion", { p_dev: d.id, p_motivo: m })), { ...inv, exito: "Cancelada", alTerminar: () => setDlg(null) });
  const fotosRecepcion = (archivos.data ?? []).filter((a) => a.tipo === "recepcion");
  const documentos = (archivos.data ?? []).filter((a) => a.tipo === "documento");
  const enviosVenta = (envios.data ?? []).filter((e) => e.estado !== "cancelado");
  const restante = faltan(d.vence);

  return (
    <div className="space-y-6">
      {d.abierta && d.vence && (
        <p className={cn("rounded-xl px-4 py-2.5 text-sm font-medium", d.vencida ? "bg-peligro-suave text-peligro" : "bg-aviso-suave text-aviso")}>
          {d.tipo === "reclamo" ? `Responder ${restante}` : d.tipo === "devolucion" ? (d.vencida ? `Debía llegar el ${fecha(d.fecha_esperada)}` : `Llega ~${fecha(d.fecha_esperada)}`) : `Límite ${restante}`}
          {d.tipo === "reclamo" && d.fecha_limite && <span className="font-normal"> · {fechaYHora(d.fecha_limite)}</span>}
        </p>
      )}

      {/* Lo que toca */}
      {d.abierta && (
        <div className="flex flex-wrap gap-2">
          {d.tipo === "reclamo" && d.estado === "abierta" && captura && <Boton onClick={() => setDlg("responder")}><MessageSquareReply className="h-4 w-4" />Registrar respuesta</Boton>}
          {d.tipo !== "devolucion" && captura && <Boton variante={d.estado === "respondida" ? "primario" : "secundario"} onClick={() => setDlg("cerrar")}><CheckCircle2 className="h-4 w-4" />Cerrar con resultado</Boton>}
          {d.tipo === "devolucion" && d.estado === "abierta" && almacen && <Boton onClick={() => setDlg("recibir")}><PackageOpen className="h-4 w-4" />Recibir en almacén</Boton>}
          {d.tipo === "devolucion" && d.estado === "recibida" && almacen && <Boton onClick={() => setDlg("decidir")}><CheckCircle2 className="h-4 w-4" />Decidir qué se hace</Boton>}
          {d.estado === "abierta" && captura && <Boton variante="fantasma" className="text-peligro" onClick={() => setDlg("cancelar")}><Ban className="h-4 w-4" />Cancelar</Boton>}
        </div>
      )}
      {d.tipo === "cancelacion" && d.abierta && enviosVenta.filter((e) => e.abierto).map((e) => (
        <p key={e.id} className="rounded-xl border border-aviso/30 bg-aviso-suave px-4 py-2.5 text-sm">
          El envío <Link to={`/almacen/envios?envio=${e.id}`} className="font-medium cifra text-marca-texto hover:underline">{e.folio}</Link> sigue abierto:
          cancélalo para que almacén no lo empaque{e.numero_guia ? " (y cancela la guía en la plataforma para que regrese el saldo)" : ""}.
        </p>
      ))}
      {d.tipo === "devolucion" && d.estado === "abierta" && !almacen && <p className="text-sm text-tenue">Cuando llegue, almacén la recibe con fotos y decide si reingresa, es merma o se reclama a la paquetería.</p>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Dato etiqueta="Venta"><Link to={`/ventas/pedidos/${d.pedido_id}`} className="text-marca-texto hover:underline cifra">{d.id_externo ? `#${d.id_externo}` : d.pedido_folio}</Link>
          <span className="block text-xs text-tenue font-normal">{d.pedido_folio} · {CANAL[d.canal] ?? d.canal}</span></Dato>
        <Dato etiqueta="Cliente">{d.cliente ?? "—"}{d.vendedor && <span className="block text-xs text-tenue font-normal">{d.vendedor}</span>}</Dato>
        <Dato etiqueta="Lo lleva">{d.responsable ?? "—"}</Dato>
        <Dato etiqueta="Código de autorización">
          {d.abierta && captura ? <CampoTexto valor={d.codigo_autorizacion} alGuardar={(v) => actualizar.mutate({ codigo_autorizacion: v })} placeholder="El de Mercado Libre" />
            : <span className="cifra">{d.codigo_autorizacion ?? "—"}</span>}
        </Dato>
        {d.tipo === "devolucion" && (
          <Dato etiqueta="Llega">
            {d.estado === "abierta" && captura ? <input type="date" className="campo h-8" defaultValue={d.fecha_esperada ?? ""} aria-label="Fecha en que llega"
              onBlur={(e) => { if (e.target.value !== (d.fecha_esperada ?? "")) actualizar.mutate({ fecha_esperada: e.target.value || null }); }} /> : fecha(d.fecha_esperada)}
          </Dato>
        )}
        {d.tipo === "reclamo" && <Dato etiqueta="Responder antes de">{fechaYHora(d.fecha_limite)}</Dato>}
        <Dato etiqueta="Envío">{d.envio_folio ?? "—"}{d.numero_guia && <span className="block text-xs text-tenue font-normal cifra">{d.paqueteria} · {d.numero_guia}</span>}</Dato>
      </div>
      <div className="rounded-xl border border-borde px-4 py-3 text-sm space-y-1">
        <p><span className="text-tenue">Motivo:</span> {d.motivo}</p>
        {d.respuesta && <p><span className="text-tenue">Se respondió ({fechaYHora(d.respondido_en)}, {d.respondido_por_nombre}):</span> {d.respuesta}</p>}
        {d.recibido_en && <p><span className="text-tenue">Llegó {fechaYHora(d.recibido_en)} ({d.recibido_por_nombre}):</span> {d.nota_recepcion ?? "sin nota"}</p>}
        {d.resultado && <p className="font-medium"><span className="text-tenue font-normal">Resultado:</span> {RESULTADO[d.resultado]}{d.almacen && ` · ${d.almacen}`}
          {d.reclamo_transportista && ` · folio ${d.reclamo_transportista}`}{d.monto_reclamado != null && ` · ${dinero(d.monto_reclamado)}`}
          {d.nota_resolucion && <span className="font-normal"> · {d.nota_resolucion}</span>}</p>}
        {d.motivo_cancelacion && <p><span className="text-tenue">Cancelada:</span> {d.motivo_cancelacion}</p>}
      </div>

      {(lineas.data?.length ?? 0) > 0 && (
        <section className="space-y-1">
          <h4 className="font-semibold">Partidas</h4>
          <ul className="text-sm divide-y divide-borde rounded-xl border border-borde">
            {lineas.data!.map((l) => (
              <li key={l.id} className="flex items-center gap-3 px-3 py-2">
                <span className="cifra font-semibold w-10 text-right">{numero(Number(l.cantidad))}</span>
                <span className="flex-1">{l.descripcion}</span>
                {l.cantidad_recibida != null && <Insignia tono={Number(l.cantidad_recibida) === Number(l.cantidad) ? "ok" : "aviso"}>llegaron {numero(Number(l.cantidad_recibida))}</Insignia>}
                {l.ajuste_id && <Insignia tono="aviso">ajuste por autorizar</Insignia>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {(d.tipo === "devolucion" || fotosRecepcion.length > 0 || documentos.length > 0) && (
        <section className="space-y-2">
          <h4 className="font-semibold">Cómo llegó</h4>
          <Galeria archivos={[...fotosRecepcion, ...documentos]} vacio={d.tipo === "devolucion" ? "Sin fotos todavía: al llegar, fotos antes de abrirla." : undefined} />
          {d.abierta && d.estado !== "recibida" && (
            <div className="flex flex-wrap gap-2">
              {almacen && d.tipo === "devolucion" && <SubirArchivo tipo="recepcion" devolucionId={d.id} texto="Foto de cómo llegó" grande className="sm:w-auto" />}
              {captura && <SubirArchivo tipo="documento" devolucionId={d.id} texto="Captura de Mercado Libre" />}
            </div>
          )}
        </section>
      )}

      {/* Lo que sirve para defenderse */}
      <section className="space-y-3 rounded-xl border border-ok/30 bg-ok-suave/40 p-4">
        <h4 className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-5 w-5 text-ok" />Evidencia de salida de esta venta</h4>
        {envios.isLoading ? <p className="text-sm text-tenue">Cargando…</p> : enviosVenta.length === 0 ? (
          <p className="text-sm text-tenue">Esta venta no salió con un envío del ERP: no hay fotos ni check list registrados.</p>
        ) : enviosVenta.map((e) => <EvidenciaSalida key={e.id} envio={e} className="border-t border-borde pt-3 first:border-0 first:pt-0" />)}
      </section>

      {(eventos.data?.length ?? 0) > 0 && (
        <section className="space-y-2 border-t border-borde pt-5">
          <h4 className="font-semibold">Historia</h4>
          <ol className="space-y-1.5 text-sm">
            {eventos.data!.map((v) => (
              <li key={v.id} className="flex gap-3"><span className="w-28 shrink-0 text-xs text-tenue cifra pt-0.5">{fechaYHora(v.en)}</span>
                <span><b className="font-medium">{v.usuario ?? "Sistema"}</b>{v.nota && <span className="text-tenue"> · {v.nota}</span>}</span></li>
            ))}
          </ol>
        </section>
      )}

      <DialogoMotivo abierto={dlg === "responder"} alCambiar={(v) => setDlg(v ? "responder" : null)} titulo={`Respuesta a ${d.folio}`} peligro={false}
        etiqueta="Qué se le contestó" textoBoton="Registrar respuesta" cargando={responder.isPending} alConfirmar={(r) => responder.mutate(r)}
        sugerencias={["Se le mandaron las fotos del empaque y la guía", "Se le ofreció cambio", "Se le pidió foto del producto"]} />
      <DialogoMotivo abierto={dlg === "cancelar"} alCambiar={(v) => setDlg(v ? "cancelar" : null)} titulo={`Cancelar ${d.folio}`}
        textoBoton="Cancelar" cargando={cancelar.isPending} alConfirmar={(m) => cancelar.mutate(m)}
        sugerencias={["El comprador ya no la mandó", "Se registró dos veces", "Mercado Libre la cerró"]} />
      <DialogoRecibir dev={d} abierto={dlg === "recibir"} alCambiar={(v) => setDlg(v ? "recibir" : null)} fotos={fotosRecepcion.length} />
      <DialogoResolver dev={d} abierto={dlg === "decidir" || dlg === "cerrar"} alCambiar={(v) => setDlg(v ? (d.tipo === "devolucion" ? "decidir" : "cerrar") : null)} />
    </div>
  );
}

function CampoTexto({ valor, alGuardar, placeholder }: { valor: string | null; alGuardar: (v: string | null) => void; placeholder?: string }) {
  const [v, setV] = useState(valor ?? "");
  useEffect(() => setV(valor ?? ""), [valor]);
  return <input className="campo h-8 cifra" value={v} placeholder={placeholder} onChange={(e) => setV(e.target.value)}
    onBlur={() => { if ((v.trim() || null) !== valor) alGuardar(v.trim() || null); }} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />;
}

/** Almacén recibe: cuántas piezas llegaron de verdad, con fotos antes de abrir. */
function DialogoRecibir({ dev, abierto, alCambiar, fotos }: { dev: Devolucion; abierto: boolean; alCambiar: (v: boolean) => void; fotos: number }) {
  const lineas = useLineasDevolucion(dev.id);
  const [cant, setCant] = useState<Record<string, number>>({});
  const [nota, setNota] = useState("");
  useEffect(() => { if (abierto) { setCant(Object.fromEntries((lineas.data ?? []).map((l) => [l.id, Number(l.cantidad)]))); setNota(""); } }, [abierto, lineas.data]);
  const recibir = useAccion(() => q(supabase.rpc("recibir_devolucion", { p_dev: dev.id, p_lineas: Object.entries(cant).map(([linea_id, cantidad_recibida]) => ({ linea_id, cantidad_recibida })), p_nota: nota || null })),
    { exito: "Devolución recibida: ahora decide qué se hace", invalidar: [CLAVE], alTerminar: () => alCambiar(false) });
  return (
    <Dialogo abierto={abierto} alCambiar={alCambiar} titulo={`Recibir ${dev.folio}`} descripcion={fotos ? `${fotos} foto(s) de cómo llegó.` : "Primero toma al menos una foto de cómo llegó (antes de abrirla)."}
      pie={<><Boton variante="secundario" onClick={() => alCambiar(false)}>Cancelar</Boton><Boton onClick={() => recibir.mutate(undefined)} cargando={recibir.isPending} disabled={!fotos}>Recibir</Boton></>}>
      <div className="space-y-3">
        {!fotos && <SubirArchivo tipo="recepcion" devolucionId={dev.id} texto="Tomar foto de cómo llegó" grande />}
        {(lineas.data ?? []).map((l) => (
          <div key={l.id} className="grid grid-cols-[1fr_7rem] items-center gap-3 text-sm">
            <span>{l.descripcion} <span className="text-tenue">· se esperaban {numero(Number(l.cantidad))}</span></span>
            <CampoNumero valor={cant[l.id] ?? 0} decimales={3} min={0} max={Number(l.cantidad)} etiqueta={`Llegaron de ${l.descripcion}`} alCambiar={(n) => setCant((c) => ({ ...c, [l.id]: n }))} />
          </div>
        ))}
        <Campo etiqueta="Cómo llegó"><AreaTexto value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Caja golpeada, sin manivela, completa…" /></Campo>
      </div>
    </Dialogo>
  );
}

/** Devolución: reingreso, merma o reclamo a la paquetería. Reclamo/cancelación: el resultado. */
function DialogoResolver({ dev, abierto, alCambiar }: { dev: Devolucion; abierto: boolean; alCambiar: (v: boolean) => void }) {
  const almacenes = useAlmacenes();
  const esDev = dev.tipo === "devolucion";
  const opciones = esDev ? ["reingreso", "merma", "reclamo_transportista"] : ["a_favor", "en_contra", "sin_efecto"];
  const [f, setF] = useState({ resultado: opciones[0], almacen: 0, nota: "", reclamo: "", monto: null as number | null });
  useEffect(() => { if (abierto) setF({ resultado: opciones[0], almacen: almacenes.data?.find((a) => a.disponible_para_planta)?.id ?? 0, nota: "", reclamo: "", monto: null }); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [abierto, almacenes.data]);
  const resolver = useAccion(() => q(supabase.rpc("resolver_devolucion", {
    p_dev: dev.id, p_resultado: f.resultado, p_almacen: ["reingreso", "merma"].includes(f.resultado) ? f.almacen : null,
    p_nota: f.nota || null, p_reclamo: f.resultado === "reclamo_transportista" ? f.reclamo : null, p_monto: f.monto,
  })), { exito: f.resultado === "reingreso" ? "Reingresó al inventario" : f.resultado === "merma" ? "Merma registrada: el ajuste lo autoriza la gerencia" : "Resuelto",
    invalidar: [CLAVE], alTerminar: () => alCambiar(false) });
  const OPCION: Record<string, string> = { reingreso: "Reingresa al inventario", merma: "Es merma", reclamo_transportista: "Se reclama a la paquetería" };
  const AYUDA: Record<string, string> = {
    reingreso: "Está bien para venderse: entra al almacén que elijas (una sola vez).",
    merma: "No sirve para vender: entra y se pide el ajuste de salida, que autoriza otra persona.",
    reclamo_transportista: "Llegó dañado por la paquetería: se reclama con su folio. No entra al inventario.",
    a_favor: "Mercado Libre o el cliente nos dio la razón.", en_contra: "Se perdió el reclamo.", sin_efecto: "Se cerró sin consecuencia.",
  };
  return (
    <Dialogo abierto={abierto} alCambiar={alCambiar} titulo={esDev ? `¿Qué se hace con ${dev.folio}?` : `Cerrar ${dev.folio}`}
      pie={<><Boton variante="secundario" onClick={() => alCambiar(false)}>Cancelar</Boton>
        <Boton onClick={() => resolver.mutate(undefined)} cargando={resolver.isPending}
          disabled={(f.resultado === "merma" && f.nota.trim().length < 5) || (f.resultado === "reclamo_transportista" && !f.reclamo.trim())}>Guardar</Boton></>}>
      <div className="space-y-3">
        <div className="grid gap-2">
          {opciones.map((o) => (
            <label key={o} className={cn("flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5", f.resultado === o ? "border-marca bg-marca-suave" : "border-borde hover:bg-fondo")}>
              <input type="radio" name="resultado" className="mt-1 h-4 w-4 accent-marca" checked={f.resultado === o} onChange={() => setF({ ...f, resultado: o })} />
              <span><span className="font-medium">{OPCION[o] ?? RESULTADO[o]}</span><span className="block text-xs text-tenue">{AYUDA[o]}</span></span>
            </label>
          ))}
        </div>
        {["reingreso", "merma"].includes(f.resultado) && (
          <Campo etiqueta="Entra a">
            <Seleccion value={f.almacen} onChange={(e) => setF({ ...f, almacen: Number(e.target.value) })}>
              {(almacenes.data ?? []).map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
            </Seleccion>
          </Campo>
        )}
        {f.resultado === "reclamo_transportista" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo etiqueta="Folio del reclamo con la paquetería"><Entrada value={f.reclamo} onChange={(e) => setF({ ...f, reclamo: e.target.value })} /></Campo>
            <Campo etiqueta="Monto reclamado"><CampoNumero valor={f.monto} prefijo="$" vacioEsCero={false} alCambiar={(n) => setF({ ...f, monto: n })} /></Campo>
          </div>
        )}
        <Campo etiqueta={f.resultado === "merma" ? "¿Qué tiene? (por qué es merma)" : "Nota"}>
          <AreaTexto value={f.nota} onChange={(e) => setF({ ...f, nota: e.target.value })} placeholder={f.resultado === "merma" ? "Carcasa partida, sin arreglo…" : "Opcional"} />
        </Campo>
      </div>
    </Dialogo>
  );
}


import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { AlertTriangle, Ban, Check, ClipboardCopy, FileText, PackageCheck, Truck, Warehouse } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { Cargando } from "@/components/ui/estados";
import { Seleccion } from "@/components/ui/campo";
import { useSesion } from "@/lib/sesion";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { dinero, fecha, fechaYHora, hoyISO, numero } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { DialogoMotivo } from "@/modulos/ventas/componentes/dialogos";
import { Dato } from "@/modulos/ventas/componentes/campos";
import { Empacar } from "./Empacar";
import { EvidenciaSalida } from "./EvidenciaSalida";
import { DialogoCotizar, DialogoEntregado, DialogoGuia } from "./Dialogos";
import { CLAVE, medidas, useAlmacenes, useBultos, useEventos, useLineas, usePlanSalida, type Envio } from "./datos";

/** Lo que va en el panel lateral de un envío: pasos, acciones, empaque y evidencia. */
export function DetalleEnvio({ envio: e }: { envio: Envio }) {
  const { puede } = useSesion();
  const lineas = useLineas(e.id);
  const bultos = useBultos(e.id);
  const eventos = useEventos({ envioId: e.id });
  const almacenes = useAlmacenes();
  const almacen = puede("envios", 2) && puede("inventario", 2);
  const captura = puede("envios", 2);
  const plan = usePlanSalida(e.id, almacen && !e.inventario_descontado_en && e.estado !== "cancelado");
  const [dlg, setDlg] = useState<null | "cotizar" | "guia" | "entregado" | "cancelar">(null);

  const inv = { invalidar: [CLAVE] };
  const actualizar = useAccion((datos: Record<string, unknown>) => q(supabase.rpc("actualizar_envio", { p_envio: e.id, p_datos: datos })), { ...inv, exito: "Guardado" });
  const enviar = useAccion(() => q<number>(supabase.rpc("marcar_enviado", { p_envio: e.id })), {
    ...inv, exito: (n) => e.tipo === "full" ? "Listo: salió de Almacén ML" : `Salió ${e.folio}${n ? ` · ${n} salida(s) de inventario` : ""}`,
  });
  const cancelar = useAccion((motivo: string) => q(supabase.rpc("cancelar_envio", { p_envio: e.id, p_motivo: motivo })), { ...inv, exito: "Envío cancelado", alTerminar: () => setDlg(null) });

  const pasos = [
    { texto: "Pedido", quien: e.solicitado_por_nombre, cuando: e.solicitado_en, hecho: true, aplica: true },
    { texto: "Cotizado", quien: e.cotizado_por_nombre, cuando: e.cotizado_en, hecho: !!e.cotizado_en || !!e.guia_en, aplica: e.tipo === "paqueteria" || e.tipo === "flete" },
    { texto: "Guía", quien: e.guia_por_nombre, cuando: e.guia_en, hecho: !!e.guia_en, aplica: e.tipo === "paqueteria" || e.tipo === "flete" },
    { texto: "Empacado", quien: e.empacado_por_nombre, cuando: e.empacado_en, hecho: !!e.empacado_en, aplica: e.lleva_empaque },
    { texto: e.tipo === "recoge" ? "Se lo llevó" : "Salió", quien: e.enviado_por_nombre, cuando: e.enviado_en, hecho: !!e.enviado_en, aplica: e.tipo !== "recoge" },
    { texto: "Entregado", quien: e.entregado_por_nombre, cuando: e.entregado_en, hecho: !!e.entregado_en, aplica: true },
  ].filter((p) => p.aplica);

  const problemas = (plan.data ?? []).filter((p) => p.problema);
  const copiarDestino = () => {
    const t = [e.destinatario, e.telefono, e.destino].filter(Boolean).join("\n");
    navigator.clipboard?.writeText(t).then(() => toast.success("Destino copiado para la plataforma de la paquetería"), () => toast.error("No se pudo copiar"));
  };

  return (
    <div className="space-y-6">
      {e.estado === "cancelado" && (
        <p className="rounded-xl border border-borde bg-fondo px-4 py-3 text-sm">Cancelado {fechaYHora(e.cancelado_en)} por {e.cancelado_por_nombre}: {e.motivo_cancelacion}
          {e.numero_guia && <span className="block text-xs text-tenue">{e.guia_reembolsada ? "La guía se canceló y regresó el saldo." : "La guía no se reembolsó: cuenta en el saldo."}</span>}</p>
      )}

      {/* Pasos: quién y cuándo */}
      <ol className="grid gap-2" style={{ gridTemplateColumns: `repeat(${pasos.length}, minmax(0, 1fr))` }}>
        {pasos.map((p, i) => (
          <li key={p.texto} className="relative text-center">
            {i > 0 && <span className={cn("absolute top-3 right-1/2 w-full h-0.5", p.hecho ? "bg-ok" : "bg-borde")} />}
            <span className={cn("relative mx-auto flex h-6 w-6 items-center justify-center rounded-full border-2 bg-superficie",
              p.hecho ? "border-ok bg-ok text-white" : "border-borde")}>{p.hecho && <Check className="h-3.5 w-3.5" />}</span>
            <p className={cn("mt-1 text-xs font-medium", !p.hecho && "text-tenue")}>{p.texto}</p>
            {p.hecho && <p className="text-[10px] leading-tight text-tenue">{p.quien?.split(" ")[0]}<br />{fechaYHora(p.cuando)}</p>}
          </li>
        ))}
      </ol>

      {/* Acciones de lo que toca */}
      {e.abierto && (
        <div className="flex flex-wrap gap-2">
          {captura && (e.tipo === "paqueteria" || e.tipo === "flete") && !e.numero_guia && (
            <Boton variante={e.estado === "solicitado" ? "primario" : "secundario"} onClick={() => setDlg("cotizar")}>{e.costo_cotizado != null ? "Cambiar cotización" : "Cotizar"}</Boton>
          )}
          {captura && (e.tipo === "paqueteria" || e.tipo === "flete" || e.tipo === "a_full" || e.tipo === "proveedor") && (
            <Boton variante={e.estado === "cotizado" ? "primario" : "secundario"} onClick={() => setDlg("guia")}><FileText className="h-4 w-4" />{e.numero_guia ? "Cambiar guía" : "Registrar guía"}</Boton>
          )}
          {almacen && e.empacado_en && e.tipo !== "recoge" && e.listo_para_salir && (
            <Boton variante="exito" onClick={() => enviar.mutate(undefined)} cargando={enviar.isPending}><Truck className="h-4 w-4" />Ya salió</Boton>
          )}
          {captura && (e.tipo === "full" || e.tipo === "proveedor") && (
            <Boton variante="exito" onClick={() => enviar.mutate(undefined)} cargando={enviar.isPending}><Truck className="h-4 w-4" />{e.tipo === "full" ? "Lo surtió Full" : "Ya lo mandó el proveedor"}</Boton>
          )}
          {almacen && e.tipo === "recoge" && e.empacado_en && (
            <Boton variante="exito" onClick={() => setDlg("entregado")}><PackageCheck className="h-4 w-4" />Se lo llevaron</Boton>
          )}
          {captura && <Boton variante="fantasma" className="text-peligro" onClick={() => setDlg("cancelar")}><Ban className="h-4 w-4" />Cancelar</Boton>}
        </div>
      )}
      {e.estado === "enviado" && captura && (
        <Boton variante="exito" onClick={() => setDlg("entregado")}><Check className="h-4 w-4" />Marcar entregado</Boton>
      )}

      {/* Datos */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Dato etiqueta="Tipo">{e.tipo_nombre}</Dato>
        <Dato etiqueta={e.tipo === "flete" ? "Transportista" : "Paquetería"}>{e.paqueteria ?? "—"}{e.servicio && <span className="text-tenue font-normal"> · {e.servicio}</span>}</Dato>
        <Dato etiqueta="Guía">{e.numero_guia ? <span className="cifra">{e.numero_guia}</span> : "—"}</Dato>
        <Dato etiqueta="Cotizado">{e.costo_cotizado != null ? <span className="cifra">{dinero(e.costo_cotizado)}</span> : "—"}</Dato>
        <Dato etiqueta="Costo de la guía">{e.costo_real != null ? <span className="cifra">{dinero(e.costo_real)}</span> : "—"}</Dato>
        <Dato etiqueta={e.tipo === "recoge" ? "Pasan por él" : "Recolección"}>
          {e.abierto && captura ? (
            <input type="date" className="campo h-8" defaultValue={e.fecha_recoleccion ?? ""} min={hoyISO()} aria-label="Fecha de recolección"
              onBlur={(ev) => { if (ev.target.value !== (e.fecha_recoleccion ?? "")) actualizar.mutate({ fecha_recoleccion: ev.target.value || null }); }} />
          ) : fecha(e.fecha_recoleccion)}
        </Dato>
      </div>
      {e.notas && <p className="rounded-lg bg-aviso-suave px-3 py-2 text-sm">{e.notas}</p>}

      {(e.destino || e.destinatario) && (
        <section className="rounded-xl border border-borde p-3 text-sm">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="etiqueta mb-1">Destino</p>
              <p><b>{e.destinatario}</b>{e.telefono && <span className="text-tenue"> · {e.telefono}</span>}</p>
              <p className="whitespace-pre-line">{e.destino}</p>
            </div>
            <Boton variante="fantasma" tamano="sm" onClick={copiarDestino}><ClipboardCopy className="h-3.5 w-3.5" />Copiar</Boton>
          </div>
        </section>
      )}

      {/* Partidas */}
      <section className="space-y-2">
        <h4 className="font-semibold">Qué lleva</h4>
        {lineas.isLoading ? <Cargando filas={2} /> : (
          <ul className="divide-y divide-borde rounded-xl border border-borde">
            {(lineas.data ?? []).map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
                <span className="cifra font-semibold w-10 text-right">{numero(Number(l.cantidad))}</span>
                <span className="flex-1 min-w-[10rem]">{l.nombre}{l.clave && <span className="text-xs text-tenue cifra"> · {l.clave}</span>}
                  {l.series.length > 0 && <span className="block text-xs">Serie <b className="cifra">{l.series.join(", ")}</b></span>}
                  {l.nota_inventario && <span className="block text-xs text-tenue">{l.nota_inventario}</span>}</span>
                {almacen && e.abierto && !e.empacado_en && e.tipo !== "full" && e.tipo !== "proveedor" && l.articulo_tipo !== "equipo" ? (
                  <Seleccion className="h-8 w-40 text-xs" value={l.almacen_id ?? ""} aria-label={`Almacén de salida de ${l.nombre}`}
                    onChange={(ev) => actualizar.mutate({ almacenes: [{ linea_id: l.id, almacen_id: Number(ev.target.value) }] })}>
                    {(almacenes.data ?? []).filter((a) => a.disponible_para_planta).map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                  </Seleccion>
                ) : l.almacen && !l.ordenes?.length && <span className="inline-flex items-center gap-1 text-xs text-tenue"><Warehouse className="h-3.5 w-3.5" />{l.almacen}</span>}
              </li>
            ))}
          </ul>
        )}
        {(bultos.data?.length ?? 0) > 0 && !(almacen && e.abierto && e.falta_empaque) && (
          <p className="text-xs text-tenue">
            {bultos.data!.length} {bultos.data!.length === 1 ? "bulto" : "bultos"}: {bultos.data!.map((b) => medidas(b)).join(" · ")}
            {e.peso_volumetrico != null && <> · volumétrico <span className="cifra">{numero(e.peso_volumetrico)} kg</span></>}
          </p>
        )}
      </section>

      {/* Lo que va a pasar con el inventario */}
      {almacen && !e.inventario_descontado_en && e.estado !== "cancelado" && (plan.data?.length ?? 0) > 0 && (
        <section className={cn("rounded-xl border p-3 text-sm space-y-1", problemas.length ? "border-peligro/30 bg-peligro-suave" : "border-borde bg-fondo/60")}>
          <p className="font-medium flex items-center gap-1.5">{problemas.length > 0 && <AlertTriangle className="h-4 w-4 text-peligro" />}Al salir, en el inventario</p>
          {plan.data!.map((p) => (
            <p key={p.linea_id} className={cn(p.problema && "text-peligro")}>
              {p.accion === "nada" ? <span className="text-tenue">{p.articulo}: {p.nota ?? "no se descuenta"}</span>
                : <>{p.accion === "traspaso" ? "Pasan" : "Salen"} <b className="cifra">{numero(Number(p.descontar))}</b> {p.articulo} de {p.almacen}{p.nota ? ` · ${p.nota}` : ""}</>}
              {p.problema && <span className="block text-xs">{p.problema}</span>}
            </p>
          ))}
        </section>
      )}

      {/* Empacar (almacén) o la evidencia */}
      {almacen && e.abierto && e.falta_empaque ? (
        <section className="space-y-3 border-t border-borde pt-5">
          <h3 className="text-lg font-semibold">Empacar</h3>
          {lineas.data && bultos.data && <Empacar envio={e} lineas={lineas.data} bultosIniciales={bultos.data} />}
        </section>
      ) : e.lleva_empaque && (
        <section className="space-y-2 border-t border-borde pt-5">
          <h3 className="text-lg font-semibold">Evidencia de salida</h3>
          <EvidenciaSalida envio={e} titulo={false} />
        </section>
      )}

      {/* Línea de tiempo */}
      {(eventos.data?.length ?? 0) > 0 && (
        <section className="space-y-2 border-t border-borde pt-5">
          <h4 className="font-semibold">Historia</h4>
          <ol className="space-y-1.5 text-sm">
            {eventos.data!.map((v) => (
              <li key={v.id} className="flex gap-3">
                <span className="w-28 shrink-0 text-xs text-tenue cifra pt-0.5">{fechaYHora(v.en)}</span>
                <span><b className="font-medium">{v.usuario ?? "Sistema"}</b> · {NOMBRE_EVENTO[v.tipo] ?? v.tipo}{v.nota && <span className="text-tenue"> · {v.nota}</span>}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {e.pedido_id && puede("ventas") && (
        <p className="text-sm"><Link to={`/ventas/pedidos/${e.pedido_id}`} className="text-marca-texto hover:underline">Ver el pedido {e.pedido_folio}</Link></p>
      )}

      <DialogoCotizar envio={e} abierto={dlg === "cotizar"} alCambiar={(v) => setDlg(v ? "cotizar" : null)} />
      <DialogoGuia envio={e} abierto={dlg === "guia"} alCambiar={(v) => setDlg(v ? "guia" : null)} />
      <DialogoEntregado envio={e} abierto={dlg === "entregado"} alCambiar={(v) => setDlg(v ? "entregado" : null)} />
      <DialogoMotivo abierto={dlg === "cancelar"} alCambiar={(v) => setDlg(v ? "cancelar" : null)} titulo={`Cancelar ${e.folio}`}
        descripcion={e.numero_guia ? "Si ya se generó la guía, cancélala también en la plataforma para que regrese el saldo." : "Almacén recibe el aviso."}
        sugerencias={["El cliente canceló", "Lo va a recoger en planta", "Se pidió dos veces", "Cambió el domicilio"]}
        textoBoton="Cancelar envío" cargando={cancelar.isPending} alConfirmar={(m) => cancelar.mutate(m)} />
    </div>
  );
}

const NOMBRE_EVENTO: Record<string, string> = {
  solicitado: "pidió el envío", cotizado: "cotizó", guia: "registró la guía", bultos: "ajustó bultos", cambio: "cambió",
  empacado: "empacó", inventario: "salida de inventario", enviado: "marcó la salida", entregado: "marcó entregado", cancelado: "canceló",
};


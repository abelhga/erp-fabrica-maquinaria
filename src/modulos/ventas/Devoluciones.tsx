import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, Undo2 } from "lucide-react";
import { Pagina } from "@/components/layout/Shell";
import { Boton } from "@/components/ui/boton";
import { Insignia, type Tono } from "@/components/ui/insignia";
import { Lateral } from "@/components/ui/dialogo";
import { Cargando, ErrorCarga, Vacio } from "@/components/ui/estados";
import { TablaDatos, Filtro, type Columna } from "@/components/datos/TablaDatos";
import { useSesion } from "@/lib/sesion";
import { fecha, hace } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { DetalleDevolucion } from "./devoluciones/DetalleDevolucion";
import { DialogoAlta } from "./devoluciones/DialogoAlta";
import { ESTADO_DEVOLUCION, TIPO_DEVOLUCION, faltan, useDevolucion, useDevoluciones, useEnviosEnVivo, type Devolucion } from "@/modulos/almacen/envios/datos";

type Vista = "abiertas" | "vencen" | "resueltas" | "todas";
const CANAL: Record<string, string> = { mercadolibre: "ML", sitio_web: "Web", amazon: "Amazon", directo: "Directo", mostrador: "Mostrador", distribuidor: "Distribuidor" };

/** Qué tan urgente es: vencido en rojo, menos de un día en ámbar. */
function tonoVence(d: Devolucion): Tono {
  if (!d.vence || !d.abierta) return "neutro";
  if (d.vencida) return "peligro";
  return new Date(d.vence).getTime() - Date.now() < 24 * 3_600_000 ? "aviso" : "neutro";
}

function Vence({ d }: { d: Devolucion }) {
  if (!d.abierta || !d.vence) return <span className="text-tenue">—</span>;
  const t = d.tipo === "devolucion" ? (d.vencida ? `debía llegar ${fecha(d.fecha_esperada)}` : `llega ${fecha(d.fecha_esperada)}`) : faltan(d.vence);
  return <Insignia tono={tonoVence(d)} punto>{t}</Insignia>;
}

export default function Devoluciones() {
  const { puede } = useSesion();
  const [params, setParams] = useSearchParams();
  useEnviosEnVivo();
  const lista = useDevoluciones();
  const [alta, setAlta] = useState(false);
  const vista = (params.get("vista") as Vista | null) ?? "abiertas";
  const abierto = params.get("id");
  const detalle = useDevolucion(abierto);
  const cambiar = (cambios: Record<string, string | null>) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(cambios)) { if (v == null) p.delete(k); else p.set(k, v); }
    setParams(p, { replace: true });
  };

  const filtros: Record<Vista, (d: Devolucion) => boolean> = {
    abiertas: (d) => d.abierta,
    vencen: (d) => d.abierta && (d.vencida || tonoVence(d) === "aviso"),
    resueltas: (d) => !d.abierta,
    todas: () => true,
  };
  const filas = useMemo(() => (lista.data ?? []).filter(filtros[vista])
    .sort((a, b) => (a.abierta && b.abierta ? (a.vence ?? "9").localeCompare(b.vence ?? "9") : 0)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lista.data, vista]);
  const cuenta = (v: Vista) => (lista.data ?? []).filter(filtros[v]).length;

  const columnas: Columna<Devolucion>[] = [
    { clave: "folio", titulo: "Folio", valor: (d) => d.folio,
      celda: (d) => <span className="whitespace-nowrap"><b className="cifra">{d.folio}</b><span className="block text-xs text-tenue">{TIPO_DEVOLUCION[d.tipo].texto} · {hace(d.creado_en)}</span></span> },
    { clave: "venta", titulo: "Venta", valor: (d) => `${d.id_externo ?? ""} ${d.pedido_folio}`,
      celda: (d) => <span className="cifra whitespace-nowrap">{d.id_externo ? `#${d.id_externo}` : d.pedido_folio}<span className="block text-xs text-tenue">{CANAL[d.canal] ?? d.canal}</span></span> },
    { clave: "cliente", titulo: "Cliente", celda: (d) => <span className="block max-w-[150px] truncate">{d.cliente ?? "—"}</span> },
    { clave: "motivo", titulo: "Motivo", celda: (d) => <span className="block max-w-[210px] truncate" title={d.motivo}>{d.motivo}
      {d.codigo_autorizacion && <span className="block text-xs text-tenue cifra">código {d.codigo_autorizacion}</span>}</span> },
    { clave: "vence", titulo: "Vence", valor: (d) => (d.abierta ? d.vence : null) ?? "", celda: (d) => <Vence d={d} /> },
    { clave: "responsable", titulo: "Lo lleva", celda: (d) => <span className="text-sm whitespace-nowrap">{d.responsable ?? "—"}</span> },
    { clave: "estado", titulo: "Estado", valor: (d) => ESTADO_DEVOLUCION[d.estado].texto,
      celda: (d) => <Insignia tono={ESTADO_DEVOLUCION[d.estado].tono}>{ESTADO_DEVOLUCION[d.estado].texto}</Insignia> },
  ];
  const vacio = vista === "abiertas"
    ? { icono: Undo2, titulo: "Nada abierto", texto: "Cuando Mercado Libre avise de una devolución o un reclamo, dalo de alta con el número de venta: almacén sabe que viene y el código queda aquí.",
        accion: puede("envios", 2) ? <Boton onClick={() => setAlta(true)}><Plus className="h-4 w-4" />Nueva</Boton> : undefined }
    : { icono: Undo2, titulo: "Sin registros aquí", texto: "Cambia el filtro para ver los demás." };

  return (
    <Pagina titulo="Devoluciones y reclamos"
      descripcion="De Mercado Libre, Amazon, el sitio y directos. Con su código, su hora límite y, junto a cada uno, la evidencia de salida para defenderse."
      acciones={puede("envios", 2) && <Boton onClick={() => setAlta(true)}><Plus className="h-4 w-4" />Nueva</Boton>}>
      <Filtro<Vista> valor={vista} alCambiar={(v) => cambiar({ vista: v })} opciones={[
        { valor: "abiertas", texto: "Abiertas", cuenta: cuenta("abiertas") },
        { valor: "vencen", texto: "Vencidas o por vencer", cuenta: cuenta("vencen") },
        { valor: "resueltas", texto: "Cerradas", cuenta: cuenta("resueltas") },
        { valor: "todas", texto: "Todas" },
      ]} />
      <div className="hidden md:block">
        <TablaDatos filas={filas} columnas={columnas} cargando={lista.isLoading} error={lista.error} claveFila={(d) => d.id}
          alClicFila={(d) => cambiar({ id: d.id })} exportarComo="devoluciones" placeholder="Buscar venta, cliente, código…" vacio={vacio}
          claseFila={(d) => (d.vencida ? "bg-peligro-suave/40" : undefined)} />
      </div>
      <div className="md:hidden space-y-2">
        {lista.error ? <ErrorCarga error={lista.error} /> : lista.isLoading ? <Cargando filas={4} />
          : filas.length === 0 ? <div className="tarjeta"><Vacio {...vacio} /></div>
          : filas.map((d) => (
            <button key={d.id} type="button" onClick={() => cambiar({ id: d.id })} className={cn("tarjeta w-full p-3 text-left", d.vencida && "border-peligro/40")}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold cifra">{d.folio}</span>
                {d.abierta && d.vence && d.estado === "abierta" ? <Vence d={d} /> : <Insignia tono={ESTADO_DEVOLUCION[d.estado].tono}>{ESTADO_DEVOLUCION[d.estado].texto}</Insignia>}
              </div>
              <p className="mt-1 text-sm truncate">{d.cliente} <span className="text-tenue cifra">· {d.id_externo ? `#${d.id_externo}` : d.pedido_folio}</span></p>
              <p className="text-xs text-tenue truncate">{TIPO_DEVOLUCION[d.tipo].texto} · {d.motivo}</p>
            </button>
          ))}
      </div>

      <Lateral abierto={!!abierto} alCambiar={(v) => { if (!v) cambiar({ id: null }); }}
        titulo={detalle.data ? <span className="inline-flex items-center gap-2"><span className="cifra">{detalle.data.folio}</span>
          <Insignia tono={ESTADO_DEVOLUCION[detalle.data.estado].tono}>{ESTADO_DEVOLUCION[detalle.data.estado].texto}</Insignia></span> : "Devolución"}
        subtitulo={detalle.data && <>{TIPO_DEVOLUCION[detalle.data.tipo].texto} · {detalle.data.cliente}{detalle.data.id_externo && ` · venta #${detalle.data.id_externo}`}</>}>
        {detalle.isLoading ? <Cargando filas={6} /> : detalle.data ? <DetalleDevolucion dev={detalle.data} />
          : <Vacio icono={Undo2} titulo="No encontramos este registro" texto="Puede ser de la venta de otro vendedor." />}
      </Lateral>
      <DialogoAlta abierto={alta} alCambiar={setAlta} alCrear={(id) => cambiar({ id, vista: "abiertas" })} />
    </Pagina>
  );
}

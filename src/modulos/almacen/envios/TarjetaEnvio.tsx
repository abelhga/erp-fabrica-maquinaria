import { useState } from "react";
import { Link } from "react-router-dom";
import { Camera, ChevronRight, Truck } from "lucide-react";
import { Tarjeta, EncabezadoTarjeta } from "@/components/ui/tarjeta";
import { Boton } from "@/components/ui/boton";
import { Insignia } from "@/components/ui/insignia";
import { useSesion } from "@/lib/sesion";
import { dinero, fecha, fechaYHora } from "@/lib/formato";
import { DialogoPedirEnvio } from "./DialogoPedirEnvio";
import { EvidenciaSalida } from "./EvidenciaSalida";
import { estadoEnvio, useEnvios, useEnviosEnVivo } from "./datos";

/**
 * La tarjeta "Envío" del detalle del pedido: en qué va cada envío, su evidencia de
 * salida y el botón para pedirlo (prellenado con lo que falta por enviar).
 */
export function TarjetaEnvio({ pedido }: {
  pedido: { id: string; folio: string; canal: string; cliente_id: string; direccion_entrega: string | null; estado: string; historico?: boolean };
}) {
  const { puede } = useSesion();
  useEnviosEnVivo();
  const envios = useEnvios({ pedidoId: pedido.id });
  const [pidiendo, setPidiendo] = useState(false);
  const [abierto, setAbierto] = useState<string | null>(null);
  if (!puede("envios")) return null;
  const lista = envios.data ?? [];
  const puedePedir = puede("envios", 2) && !pedido.historico && !["cancelado", "entregado"].includes(pedido.estado);

  return (
    <Tarjeta>
      <EncabezadoTarjeta titulo="Envío"
        descripcion={lista.length === 0 ? "Peso, medidas y destino salen del pedido." : `${lista.length} ${lista.length === 1 ? "envío" : "envíos"}`}
        acciones={puedePedir && <Boton variante={lista.length ? "secundario" : "primario"} tamano="sm" onClick={() => setPidiendo(true)}><Truck className="h-3.5 w-3.5" />Pedir envío</Boton>} />
      <div className="px-5 pb-4 space-y-3 text-sm">
        {envios.isLoading ? <p className="text-tenue">Cargando…</p> : lista.length === 0 ? (
          <p className="text-tenue">{puedePedir ? "Cuando esté listo, pide el envío: almacén lo ve, lo empaca con fotos y la guía queda aquí." : "Sin envíos."}</p>
        ) : lista.map((e) => (
          <div key={e.id} className="rounded-lg border border-borde">
            <button type="button" className="flex w-full items-start justify-between gap-2 px-3 py-2 text-left hover:bg-fondo"
              onClick={() => setAbierto(abierto === e.id ? null : e.id)} aria-expanded={abierto === e.id}>
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-1.5">
                  <b className="cifra">{e.folio}</b>
                  <Insignia tono={estadoEnvio(e).tono} punto>{estadoEnvio(e).texto}</Insignia>
                  {e.fotos > 0 && <Insignia tono="ok"><Camera className="h-3 w-3" />{e.fotos}</Insignia>}
                </span>
                <span className="block text-xs text-tenue mt-0.5">
                  {e.tipo_nombre}{e.paqueteria && ` · ${e.paqueteria}`}{e.numero_guia && ` · guía ${e.numero_guia}`}
                  {e.costo_real != null ? ` · ${dinero(e.costo_real)}` : e.costo_cotizado != null ? ` · cotizado ${dinero(e.costo_cotizado)}` : ""}
                </span>
                <span className="block text-xs text-tenue">
                  {e.entregado_en ? `Entregado ${fechaYHora(e.entregado_en)}` : e.enviado_en ? `Salió ${fechaYHora(e.enviado_en)}`
                    : e.fecha_recoleccion ? `Recolección ${fecha(e.fecha_recoleccion)}` : `Pedido ${fechaYHora(e.solicitado_en)}`}
                </span>
              </span>
              <ChevronRight className={`h-4 w-4 mt-1 shrink-0 text-tenue transition ${abierto === e.id ? "rotate-90" : ""}`} />
            </button>
            {abierto === e.id && (
              <div className="border-t border-borde px-3 py-3 space-y-2">
                <EvidenciaSalida envio={e} titulo={false} />
                <Link to={`/almacen/envios?envio=${e.id}`} className="inline-block text-xs text-marca-texto hover:underline">Abrir en Envíos</Link>
              </div>
            )}
          </div>
        ))}
      </div>
      {puedePedir && (
        <DialogoPedirEnvio pedido={pedido} abierto={pidiendo} alCambiar={setPidiendo} alCrear={(id) => setAbierto(id)} />
      )}
    </Tarjeta>
  );
}

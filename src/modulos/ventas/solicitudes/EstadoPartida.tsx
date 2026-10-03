import { CheckCircle2, Hand, Hourglass, MessageSquareQuote, Siren, XCircle } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { dinero } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { cuando, type Solicitud } from "@/modulos/compras/solicitudes/datos";

/**
 * En la partida del cotizador: por dónde va el precio que se le pidió a compras.
 * El vendedor ya no pregunta "¿alguna respuesta?": ve quién la tiene y para cuándo,
 * y cuando hay precio lo aplica con un clic (precio de lista y entrega; nunca el costo).
 */
export function EstadoPartida({ s, editable, alAplicar, aplicando, textoAplicar = "Aplicar precio" }: {
  s: Solicitud; editable: boolean; alAplicar: (s: Solicitud) => void; aplicando?: boolean; textoAplicar?: string;
}) {
  const base = "inline-flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border px-2 py-1 text-xs";
  if (s.estado === "abierta" || s.estado === "tomada") {
    const vencida = s.semaforo === "vencida";
    return (
      <span className={cn(base, vencida ? "border-peligro/30 bg-peligro-suave text-peligro" : "border-aviso/30 bg-aviso-suave/70 text-texto")}>
        {s.urgente ? <Siren className="h-3.5 w-3.5 text-peligro" /> : s.estado === "tomada" ? <Hand className="h-3.5 w-3.5 text-info" /> : <Hourglass className="h-3.5 w-3.5 text-aviso" />}
        <span>
          <b className="cifra">{s.folio}</b>{" "}
          {s.estado === "tomada" ? <>· lo cotiza {s.tomada_por_nombre ?? "compras"}</> : <>· pedido a compras</>}
          {" "}· {vencida ? <b>venció {cuando(s.vence_en)}</b> : <>vence {cuando(s.vence_en)}</>}
        </span>
      </span>
    );
  }
  if (s.estado === "no_se_consigue") {
    return (
      <span className={cn(base, "border-peligro/30 bg-peligro-suave")}>
        <XCircle className="h-3.5 w-3.5 text-peligro" /><span><b className="text-peligro">No se consigue</b> · {s.respuesta}</span>
      </span>
    );
  }
  if (s.estado !== "contestada") return null;
  const precio = s.precio_lista_actual ?? s.precio_lista;
  if (s.aplicada_en) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-tenue">
        <CheckCircle2 className="h-3.5 w-3.5 text-ok" />Precio de compras ({s.folio}) · entrega {s.tiempo_entrega_dias ?? "—"} días hábiles
      </span>
    );
  }
  return (
    <span className={cn(base, "border-ok/30 bg-ok-suave/70")}>
      <MessageSquareQuote className="h-3.5 w-3.5 text-ok" />
      <span>Compras: <b className="cifra">{dinero(precio)}</b> de lista · entrega <b>{s.tiempo_entrega_dias ?? "—"} días hábiles</b>{s.respuesta ? ` · “${s.respuesta}”` : ""}</span>
      {editable && precio != null && (
        <Boton tamano="sm" variante="exito" className="h-6 px-2 text-[11px]" cargando={aplicando}
          onClick={(e) => { e.stopPropagation(); alAplicar(s); }}>{textoAplicar}</Boton>
      )}
    </span>
  );
}

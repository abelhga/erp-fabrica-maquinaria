import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, CircleDot, FileText, Hand, ImageOff, Loader2, Siren, XCircle } from "lucide-react";
import { Insignia } from "@/components/ui/insignia";
import { dinero, fecha, numero } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import {
  ESTADO_SOL, SEMAFORO, abierta, cuando, horas, marcaModelo, queSePide, useFotosSolicitud, type Solicitud,
} from "./datos";

/** Estado + semáforo + urgencia, en una línea. */
export function InsigniasSolicitud({ s, sinEstado }: { s: Solicitud; sinEstado?: boolean }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {s.urgente && abierta(s) && <Insignia tono="peligro"><Siren className="h-3 w-3" />Cliente esperando</Insignia>}
      {s.semaforo && s.semaforo !== "a_tiempo" && <Insignia tono={SEMAFORO[s.semaforo].tono} punto>{SEMAFORO[s.semaforo].texto}</Insignia>}
      {!sinEstado && <Insignia tono={ESTADO_SOL[s.estado].tono}>{ESTADO_SOL[s.estado].texto}</Insignia>}
    </span>
  );
}

/** Punto del semáforo para la primera columna de la cola. */
export function PuntoSemaforo({ s }: { s: Solicitud }) {
  if (!s.semaforo) return <span className="block h-2.5 w-2.5 rounded-full bg-borde" aria-hidden />;
  return <span className={cn("block h-2.5 w-2.5 rounded-full", SEMAFORO[s.semaforo].punto, s.semaforo === "vencida" && "animate-pulse")}
    title={SEMAFORO[s.semaforo].texto} aria-label={SEMAFORO[s.semaforo].texto} />;
}

/** Qué se pide, con marca y modelo y cuántas. */
export function QueSePide({ s, chico }: { s: Solicitud; chico?: boolean }) {
  const mm = marcaModelo(s);
  return (
    <div className="min-w-0">
      <p className={cn("font-medium leading-snug", chico ? "text-sm" : "text-[15px]")}>{queSePide(s)}</p>
      <p className="text-xs text-tenue">
        {numero(Number(s.cantidad))} {s.unidad}
        {s.clave && <> · <span className="cifra">{s.clave}</span></>}
        {mm && <> · {mm}</>}
        {/* Si el artículo se dio de alta con la misma descripción, no se repite. */}
        {s.articulo && s.descripcion && s.descripcion.trim().toLowerCase() !== s.articulo.trim().toLowerCase() && <> · {s.descripcion}</>}
      </p>
    </div>
  );
}

/** Las fotos que mandó el vendedor (enlaces firmados: el bucket es privado). */
export function FotosSolicitud({ s }: { s: Solicitud }) {
  const fotos = useFotosSolicitud(s.id, s.fotos);
  if (!s.fotos) return null;
  if (fotos.isLoading) return <Loader2 className="h-4 w-4 animate-spin text-tenue" />;
  return (
    <div className="flex flex-wrap gap-2">
      {(fotos.data ?? []).map((f) => f.url ? (
        <a key={f.id} href={f.url} target="_blank" rel="noreferrer" className="block rounded-lg border border-borde overflow-hidden hover:border-marca/50">
          {f.pdf ? <span className="h-20 w-20 flex flex-col items-center justify-center gap-1 text-xs text-tenue"><FileText className="h-6 w-6" />PDF</span>
            : <img src={f.url} alt="Foto de la solicitud" className="h-20 w-20 object-cover" />}
        </a>
      ) : <span key={f.id} className="h-20 w-20 rounded-lg border border-borde flex items-center justify-center text-tenue"><ImageOff className="h-5 w-5" /></span>)}
    </div>
  );
}

/** Lo que ve cualquiera que abra la solicitud: qué, para quién, y por dónde va. */
export function DetalleSolicitud({ s, verCotizacion }: { s: Solicitud; verCotizacion?: boolean }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2"><InsigniasSolicitud s={s} /></div>
      <QueSePide s={s} />
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <div><dt className="text-xs text-tenue">Lo pide</dt><dd>{s.solicitante}</dd></div>
        <div>
          <dt className="text-xs text-tenue">Para</dt>
          <dd>
            {s.cliente ?? (s.cotizacion_folio ? "Cotización" : <span className="text-tenue">Sin cliente</span>)}
            {s.cotizacion_folio && (verCotizacion && s.cotizacion_id
              ? <Link to={`/ventas/cotizaciones/${s.cotizacion_id}`} className="block text-xs text-marca-texto cifra">{s.cotizacion_folio}</Link>
              : <span className="block text-xs text-tenue cifra">{s.cotizacion_folio}</span>)}
          </dd>
        </div>
      </dl>
      {s.notas && <p className="rounded-lg bg-fondo px-3 py-2 text-sm">“{s.notas}”</p>}
      <FotosSolicitud s={s} />
      <LineaTiempo s={s} />
    </div>
  );
}

/** Pedida → tomada → contestada (con horas hábiles), como la ve el vendedor sin preguntar. */
export function LineaTiempo({ s }: { s: Solicitud }) {
  const pasos: { icono: typeof CircleDot; texto: ReactNode; tono?: string }[] = [
    { icono: CircleDot, texto: <>Pedida {cuando(s.creado_en)} · {s.urgente ? "urgente: 4 h hábiles" : "plazo: 1 día hábil"} (vence {cuando(s.vence_en)})</> },
  ];
  if (s.tomada_en) pasos.push({ icono: Hand, texto: <>La tomó <b>{s.tomada_por_nombre ?? "compras"}</b> {cuando(s.tomada_en)}{s.horas_acuse != null ? ` · ${horas(s.horas_acuse)} hábiles después` : ""}</> });
  if (s.estado === "contestada") {
    pasos.push({ icono: CheckCircle2, tono: "text-ok", texto: <>Contestó <b>{s.contestada_por_nombre ?? "compras"}</b> {cuando(s.contestada_en)} · {horas(s.horas_respuesta)} hábiles{s.a_tiempo === false ? " (fuera de plazo)" : ""}</> });
  }
  if (s.estado === "no_se_consigue") {
    pasos.push({ icono: XCircle, tono: "text-peligro", texto: <>No se consigue · {s.contestada_por_nombre ?? "compras"} {cuando(s.contestada_en)}</> });
  }
  if (s.estado === "cancelada") {
    pasos.push({ icono: XCircle, tono: "text-tenue", texto: <>Cancelada por {s.cancelada_por_nombre ?? "quien la pidió"} {cuando(s.cancelada_en)}{s.motivo_cancelacion ? ` · ${s.motivo_cancelacion}` : ""}</> });
  }
  return (
    <ol className="space-y-1.5 text-sm">
      {pasos.map((p, i) => (
        <li key={i} className="flex gap-2"><p.icono className={cn("h-4 w-4 mt-0.5 shrink-0 text-tenue", p.tono)} /><span>{p.texto}</span></li>
      ))}
    </ol>
  );
}

/** La respuesta como la ve el vendedor: precio de lista y entrega, nunca el costo. */
export function RespuestaVenta({ s }: { s: Solicitud }) {
  if (s.estado === "no_se_consigue") {
    return <p className="rounded-lg border border-peligro/30 bg-peligro-suave px-3 py-2 text-sm"><b className="text-peligro">No se consigue.</b> {s.respuesta}</p>;
  }
  if (s.estado !== "contestada") return null;
  const precio = s.precio_lista_actual ?? s.precio_lista;
  return (
    <div className="rounded-lg border border-ok/30 bg-ok-suave/60 px-3 py-2.5 text-sm space-y-1">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="text-tenue">Precio de lista</span>
        <span className="text-lg font-semibold cifra">{dinero(precio)} <span className="text-xs font-normal text-tenue">+ IVA</span></span>
      </div>
      <div className="flex flex-wrap justify-between gap-x-4 text-tenue">
        <span>Entrega: <b className="text-texto">{s.tiempo_entrega_dias != null ? `${s.tiempo_entrega_dias} días hábiles` : "por confirmar"}</b></span>
        {s.vigencia_hasta && <span>Precio válido al {fecha(s.vigencia_hasta)}</span>}
      </div>
      {s.clave && <p className="text-xs text-tenue">Ya está en el catálogo como <span className="cifra">{s.clave}</span>: el buscador del cotizador lo encuentra.</p>}
      {s.respuesta && <p className="text-texto">“{s.respuesta}”</p>}
    </div>
  );
}

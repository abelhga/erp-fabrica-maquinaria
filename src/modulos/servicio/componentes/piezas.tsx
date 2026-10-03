import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Insignia } from "@/components/ui/insignia";
import { cn } from "@/lib/utilidades";
import { useSesion } from "@/lib/sesion";
import { ESTADO_MAQUINA, ESTADO_MTO, ESTADO_SERVICIO, TIPOS, type EstadoMaquina, type EstadoMto, type EstadoServicio, type TipoServicio } from "../datos";

export function InsigniaEstado({ estado }: { estado: EstadoServicio }) {
  const e = ESTADO_SERVICIO[estado];
  return <Insignia tono={e.tono} punto>{e.texto}</Insignia>;
}

export function InsigniaMaquina({ estado }: { estado: EstadoMaquina }) {
  const e = ESTADO_MAQUINA[estado];
  return <Insignia tono={e.tono} punto>{e.texto}</Insignia>;
}

export function InsigniaMto({ estado }: { estado: EstadoMto }) {
  const e = ESTADO_MTO[estado];
  return <Insignia tono={e.tono} punto>{e.texto}</Insignia>;
}

/** El tipo con su color fijo: la muestra lleva la identidad, el texto va en tinta. */
export function Tipo({ tipo, corto, className }: { tipo: TipoServicio; corto?: boolean; className?: string }) {
  const t = TIPOS[tipo];
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap", className)}>
      <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: t.color }} />
      {corto ? t.corto : t.texto}
    </span>
  );
}

/** Fondo y borde de una barra del calendario con el color del tipo, legible en claro y oscuro. */
export const estiloTipo = (tipo: TipoServicio) => ({
  background: `color-mix(in srgb, ${TIPOS[tipo].color} 20%, hsl(var(--superficie)))`,
  borderLeft: `3px solid ${TIPOS[tipo].color}`,
});

export function Dato({ etiqueta, children, className }: { etiqueta: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="etiqueta">{etiqueta}</p>
      <div className="mt-0.5 text-sm break-words">{children}</div>
    </div>
  );
}

export function EnlaceBoton({ a, children, variante = "secundario", className }: {
  a: string; children: ReactNode; variante?: "primario" | "secundario" | "peligro"; className?: string;
}) {
  return (
    <Link to={a} className={cn(
      "inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors h-9 px-4 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca/50",
      variante === "primario" && "bg-marca text-white hover:bg-marca/90 shadow-sm",
      variante === "secundario" && "bg-superficie border border-borde hover:bg-fondo text-texto",
      variante === "peligro" && "bg-superficie border-2 border-peligro/50 text-peligro hover:bg-peligro-suave",
      className)}>
      {children}
    </Link>
  );
}

/** Quién hace qué en servicio, igual que en la base (es_personal_servicio, puede). */
export function usePermisosServicio() {
  const { puede } = useSesion();
  return {
    ver: puede("servicio", 1),
    pedir: puede("servicio", 2),
    gerencia: puede("servicio", 3),
    personal: puede("servicio", 3) || (puede("servicio", 2) && puede("produccion", 2)),
    almacen: puede("inventario", 2),
    costos: puede("servicio", 3) || puede("costos", 1),
    // El costo de una refacción de almacén es el costo del artículo: solo con "costos".
    costosArticulo: puede("costos", 1),
  };
}

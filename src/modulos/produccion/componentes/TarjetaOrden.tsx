import { useState } from "react";
import { Link } from "react-router-dom";
import * as P from "@radix-ui/react-popover";
import { AlertTriangle, CalendarDays, ChevronDown, ChevronUp, Flame, PauseCircle, PackageX, Truck, Unlock } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { cn } from "@/lib/utilidades";
import { Boton } from "@/components/ui/boton";
import { Insignia } from "@/components/ui/insignia";
import { CLAVE, type OrdenTablero } from "./datos";
import { BarraAvance, ChipEtapa, InsigniaCompromiso } from "./piezas";
import { abreviarEquipo, horas } from "./util";

/**
 * Tarjeta del kanban del gerente: lo que necesita para decidir sin abrir la
 * orden (cliente, compromiso, etapa, material) y las tres acciones que más usa.
 * Sin permiso de gerencia (vendedores, ingeniería) se ve igual pero sin botones.
 */
export function TarjetaOrden({ o, puedeGestionar }: { o: OrdenTablero; puedeGestionar: boolean }) {
  const liberar = useAccion((id: string) => q(supabase.rpc("liberar_orden", { p_op: id })),
    { exito: `${o.folio} liberada al taller`, invalidar: [CLAVE] });
  const editar = useAccion((a: { p_prioridad?: number; p_fecha_compromiso?: string }) =>
    q(supabase.rpc("editar_orden", { p_op: o.id, ...a })), { invalidar: [CLAVE] });
  const entregar = useAccion(() => q(supabase.rpc("entregar_orden", { p_op: o.id })),
    { exito: `${o.folio} entregada`, invalidar: [CLAVE] });
  const cerrada = o.estado === "terminada";

  return (
    <div className={cn("tarjeta p-3 space-y-2.5 text-sm", o.atrasada && "border-peligro/40", o.pausada && "border-aviso/50")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link to={`/produccion/ordenes/${o.id}`} className="font-semibold hover:text-marca-texto hover:underline cifra">{o.folio}</Link>
          {o.numero_serie && <p className="text-xs text-tenue truncate cifra">{o.numero_serie}</p>}
        </div>
        {o.prioridad === 1 && <Insignia tono="peligro"><Flame className="h-3 w-3" />Urgente</Insignia>}
        {o.prioridad === 3 && <Insignia>Baja</Insignia>}
      </div>

      <div>
        <p className="font-medium leading-snug line-clamp-2" title={o.equipo}>{abreviarEquipo(o.equipo)}{o.cantidad > 1 && ` × ${o.cantidad}`}</p>
        <p className="text-xs text-tenue truncate">{o.para_stock ? "Para stock" : o.cliente ?? "—"}{o.pedido_folio && ` · ${o.pedido_folio}`}</p>
      </div>

      {o.etapas_activas.length > 0 ? (
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {o.etapas_activas.map((e) => (
            <ChipEtapa key={e.id} nombre={`${e.nombre}${e.estado === "pausada" ? " (pausada)" : ""}${e.responsable ? ` · ${e.responsable.split(" ")[0]}` : ""}`}
                       color={e.color} estado={e.estado} />
          ))}
        </div>
      ) : o.siguiente_etapa && !cerrada ? (
        <ChipEtapa nombre={`Sigue: ${o.siguiente_etapa}`} color={o.siguiente_etapa_color} className="text-tenue" />
      ) : null}

      <div className="space-y-1">
        <div className="flex justify-between text-xs text-tenue cifra">
          <span>{o.avance}%</span>
          <span>{horas(o.horas_terminadas)} de {horas(o.horas_totales)}</span>
        </div>
        <BarraAvance valor={o.avance} />
      </div>

      <div className="flex flex-wrap gap-1.5">
        <InsigniaCompromiso dias={o.dias_restantes} fechaCompromiso={o.fecha_compromiso} cerrada={cerrada} />
        {o.materiales_faltantes > 0 && (
          <Insignia tono={o.faltantes_sin_pedir > 0 ? "peligro" : "aviso"}>
            <PackageX className="h-3 w-3" />{o.materiales_faltantes} faltante{o.materiales_faltantes === 1 ? "" : "s"}
          </Insignia>
        )}
        {o.pausada && <Insignia tono="aviso"><PauseCircle className="h-3 w-3" />Pausada</Insignia>}
        {o.estado === "planeada" && !o.revisada_ingenieria && <Insignia><AlertTriangle className="h-3 w-3" />Sin revisión de ingeniería</Insignia>}
      </div>

      {puedeGestionar && (
        <div className="flex items-center gap-1 pt-2 border-t border-borde/70">
          {o.estado === "planeada" && (
            <Boton tamano="sm" variante="primario" disabled={!o.revisada_ingenieria} cargando={liberar.isPending}
                   title={o.revisada_ingenieria ? "Pasa al taller" : "Falta que ingeniería revise la lista de materiales"}
                   onClick={() => liberar.mutate(o.id)}>
              <Unlock className="h-3.5 w-3.5" />Liberar
            </Boton>
          )}
          {o.estado === "terminada" && (
            <Boton tamano="sm" variante="secundario" cargando={entregar.isPending} onClick={() => entregar.mutate()}>
              <Truck className="h-3.5 w-3.5" />Entregada
            </Boton>
          )}
          {!cerrada && (
            <>
              <div className="ml-auto flex items-center">
                <Boton tamano="icono" variante="fantasma" className="h-8 w-8" aria-label="Subir prioridad" title="Subir prioridad"
                       disabled={o.prioridad <= 1 || editar.isPending} onClick={() => editar.mutate({ p_prioridad: o.prioridad - 1 })}>
                  <ChevronUp className="h-4 w-4" />
                </Boton>
                <Boton tamano="icono" variante="fantasma" className="h-8 w-8" aria-label="Bajar prioridad" title="Bajar prioridad"
                       disabled={o.prioridad >= 3 || editar.isPending} onClick={() => editar.mutate({ p_prioridad: o.prioridad + 1 })}>
                  <ChevronDown className="h-4 w-4" />
                </Boton>
                <CambiarFecha actual={o.fecha_compromiso} alGuardar={(f) => editar.mutate({ p_fecha_compromiso: f })} />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function CambiarFecha({ actual, alGuardar }: { actual: string | null; alGuardar: (f: string) => void }) {
  const [abierto, setAbierto] = useState(false);
  const [valor, setValor] = useState(actual ?? "");
  return (
    <P.Root open={abierto} onOpenChange={(v) => { setAbierto(v); if (v) setValor(actual ?? ""); }}>
      <P.Trigger asChild>
        <Boton tamano="icono" variante="fantasma" className="h-8 w-8" aria-label="Cambiar compromiso" title="Cambiar fecha compromiso">
          <CalendarDays className="h-4 w-4" />
        </Boton>
      </P.Trigger>
      <P.Portal>
        <P.Content align="end" sideOffset={4} className="z-50 tarjeta shadow-xl p-3 w-64">
          <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); if (valor) { alGuardar(valor); setAbierto(false); } }}>
            <label className="block text-sm font-medium" htmlFor="compromiso-nuevo">Nueva fecha compromiso</label>
            <input id="compromiso-nuevo" type="date" className="campo" value={valor} onChange={(e) => setValor(e.target.value)} autoFocus />
            <p className="text-xs text-tenue">Queda en la línea de tiempo de la orden.</p>
            <div className="flex justify-end gap-2">
              <Boton type="button" tamano="sm" variante="fantasma" onClick={() => setAbierto(false)}>Cancelar</Boton>
              <Boton type="submit" tamano="sm" disabled={!valor || valor === actual}>Guardar</Boton>
            </div>
          </form>
        </P.Content>
      </P.Portal>
    </P.Root>
  );
}

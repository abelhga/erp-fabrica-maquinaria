import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Layers, X } from "lucide-react";
import { Dialogo } from "@/components/ui/dialogo";
import { Boton } from "@/components/ui/boton";
import { Campo, Entrada, Seleccion } from "@/components/ui/campo";
import { Cargando, ErrorCarga, Vacio } from "@/components/ui/estados";
import { Insignia } from "@/components/ui/insignia";
import { BuscadorArticulo, type ArticuloEncontrado } from "@/components/datos/BuscadorArticulo";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { fecha, hoyISO } from "@/lib/formato";
import { CLAVE } from "./datos";
import { tonoCompromiso, textoDias } from "./util";

interface PedidoPorProducir {
  id: string; folio: string; fecha: string; fecha_compromiso: string | null; estado: string; cliente: string;
  unidades: number; partidas_sin_lista: number; dias_restantes: number | null;
  partidas: { linea_id: string; articulo_id: string; clave: string; equipo: string; cantidad: number; tiene_lista: boolean }[];
}

/**
 * Pedidos confirmados con equipos que todavía no tienen orden. Una orden por
 * unidad, como hoy una pestaña por equipo, pero sin copiar el MACHOTE a mano.
 * Lo que no tiene lista de materiales se dice aquí, no se brinca en silencio.
 */
export function DialogoDesdePedido({ abierto, alCambiar }: { abierto: boolean; alCambiar: (v: boolean) => void }) {
  const pedidos = useQuery({
    queryKey: [...CLAVE, "por_producir"],
    enabled: abierto,
    queryFn: () => q<PedidoPorProducir[]>(supabase.from("v_pedidos_por_producir").select("*").order("fecha_compromiso", { nullsFirst: false })),
  });
  const crear = useAccion((id: string) => q<number>(supabase.rpc("ordenes_desde_pedido", { p_pedido: id })), {
    exito: (n) => (n === 1 ? "Se creó 1 orden de producción" : `Se crearon ${n} órdenes de producción`),
    invalidar: [CLAVE],
  });

  return (
    <Dialogo abierto={abierto} alCambiar={alCambiar} ancho="max-w-2xl" titulo="Crear órdenes desde pedido"
             descripcion="Pedidos confirmados con equipos sin orden de producción. Se crea una orden por unidad, con su lista de materiales congelada y sus horas por etapa.">
      {pedidos.error ? <ErrorCarga error={pedidos.error} /> : pedidos.isLoading ? <Cargando filas={3} /> : (pedidos.data ?? []).length === 0 ? (
        <Vacio icono={CheckCircle2} titulo="Todos los pedidos ya tienen sus órdenes" texto="Cuando ventas confirme un pedido con equipos, aparecerá aquí." />
      ) : (
        <div className="space-y-3">
          {pedidos.data!.map((p) => {
            const dias = p.dias_restantes;
            return (
              <div key={p.id} className="rounded-lg border border-borde p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{p.folio} <span className="font-normal text-tenue">· {p.cliente}</span></p>
                    <p className="text-xs text-tenue mt-0.5">
                      Pedido del {fecha(p.fecha)} · compromiso{" "}
                      <Insignia tono={tonoCompromiso(dias)} className="ml-0.5">{p.fecha_compromiso ? `${fecha(p.fecha_compromiso)} · ${textoDias(dias).toLowerCase()}` : "sin fecha"}</Insignia>
                    </p>
                  </div>
                  <Boton tamano="sm" disabled={p.unidades === 0} cargando={crear.isPending && crear.variables === p.id}
                         onClick={() => crear.mutate(p.id)}>
                    {p.unidades === 0 ? "Nada que crear" : p.unidades === 1 ? "Crear 1 orden" : `Crear ${p.unidades} órdenes`}
                  </Boton>
                </div>
                <ul className="mt-2 space-y-1">
                  {p.partidas.map((l) => (
                    <li key={l.linea_id} className="flex items-start gap-2 text-sm">
                      {l.tiene_lista ? <Layers className="h-4 w-4 text-tenue mt-0.5 shrink-0" /> : <AlertTriangle className="h-4 w-4 text-aviso mt-0.5 shrink-0" />}
                      <span className="min-w-0">
                        <span className="cifra">{Math.ceil(l.cantidad)} ×</span> {l.equipo}
                        {!l.tiene_lista && <span className="block text-xs text-aviso">Sin lista de materiales: ingeniería tiene que capturarla antes de fabricar.</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </Dialogo>
  );
}

const TIPOS_FABRICADOS: ArticuloEncontrado["tipo"][] = ["equipo", "subensamble"];

/** Orden para stock: equipo, cantidad, compromiso y serie. Lo demás lo pone la base. */
export function DialogoOrdenStock({ abierto, alCambiar }: { abierto: boolean; alCambiar: (v: boolean) => void }) {
  const ir = useNavigate();
  const [equipo, setEquipo] = useState<ArticuloEncontrado | null>(null);
  const [cantidad, setCantidad] = useState("1");
  const [compromiso, setCompromiso] = useState("");
  const [serie, setSerie] = useState("");
  const [prioridad, setPrioridad] = useState("2");
  const crear = useAccion(() => q<string>(supabase.rpc("crear_orden_produccion", {
    p_articulo: equipo!.id, p_cantidad: Number(cantidad), p_fecha_compromiso: compromiso || null,
    p_prioridad: Number(prioridad), p_numero_serie: serie.trim() || null,
  })), {
    exito: "Orden creada", invalidar: [CLAVE],
    alTerminar: (id) => { alCambiar(false); setEquipo(null); setSerie(""); setCompromiso(""); setCantidad("1"); ir(`/produccion/ordenes/${id}`); },
  });
  const valido = !!equipo && Number(cantidad) > 0;

  return (
    <Dialogo abierto={abierto} alCambiar={alCambiar} titulo="Orden para stock"
             descripcion="Para fabricar sin pedido (equipos de exhibición o de línea). La lista de materiales se congela al crearla."
             pie={<>
               <Boton variante="secundario" onClick={() => alCambiar(false)}>Cancelar</Boton>
               <Boton form="orden-stock" type="submit" disabled={!valido} cargando={crear.isPending}>Crear orden</Boton>
             </>}>
      <form id="orden-stock" className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (valido) crear.mutate(undefined); }}>
        <Campo etiqueta="Equipo o subensamble">
          {equipo ? (
            <div className="campo h-auto py-2 flex items-start justify-between gap-2">
              <span className="text-sm"><span className="text-tenue">{equipo.clave}</span> · {equipo.nombre}</span>
              <button type="button" onClick={() => setEquipo(null)} className="text-tenue hover:text-texto" aria-label="Quitar equipo"><X className="h-4 w-4" /></button>
            </div>
          ) : (
            <BuscadorArticulo alElegir={setEquipo} tipos={TIPOS_FABRICADOS} mostrarPrecio={false} autoFocus placeholder="Escribe el equipo: bazuca 10, zar 4t, thor…" />
          )}
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Cantidad">
            <Entrada type="number" min="1" step="1" inputMode="numeric" value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
          </Campo>
          <Campo etiqueta="Prioridad">
            <Seleccion value={prioridad} onChange={(e) => setPrioridad(e.target.value)}>
              <option value="1">Urgente</option><option value="2">Normal</option><option value="3">Baja</option>
            </Seleccion>
          </Campo>
          <Campo etiqueta="Fecha compromiso">
            <Entrada type="date" min={hoyISO()} value={compromiso} onChange={(e) => setCompromiso(e.target.value)} />
          </Campo>
          <Campo etiqueta="Número de serie" ayuda="Opcional; se puede poner después.">
            <Entrada value={serie} onChange={(e) => setSerie(e.target.value)} placeholder="CV0200N157" />
          </Campo>
        </div>
      </form>
    </Dialogo>
  );
}

import { useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ClipboardCheck } from "lucide-react";
import { TablaDatos, Filtro, type Columna } from "@/components/datos/TablaDatos";
import { Insignia, type Tono } from "@/components/ui/insignia";
import { supabase } from "@/lib/supabase";
import { q } from "@/lib/consultas";
import { fecha } from "@/lib/formato";
import { GLOSARIO } from "@/tutorial/glosario";

type Area = "almacen" | "compras" | "produccion" | "ventas";
export interface PorAtender {
  pedido_id: string; folio: string; cliente: string | null; vendedor_id: string | null; vendedor: string | null; creado_en: string;
  fecha_compromiso: string | null; area: Area; accion: string; detalle: string; dias: number; atrasado: boolean;
}
export const AREA: Record<Area, { texto: string; tono: Tono }> = {
  almacen: { texto: "Almacén", tono: "info" }, compras: { texto: "Compras", tono: "aviso" },
  produccion: { texto: "Producción", tono: "marca" }, ventas: { texto: "Vendedor", tono: "neutro" },
};

/** El numerito rojo del menú: lo que le toca a mi área (o, si vendo, mis pedidos atrasados). */
export function useMisPedidosPorAtender() {
  return useQuery({
    queryKey: ["mis_pedidos_por_atender"], staleTime: 60_000, refetchInterval: 5 * 60_000,
    queryFn: () => q<{ total: number; atrasados: number }>(supabase.rpc("mis_pedidos_por_atender")),
  }).data;
}

/** Lo que espera cada pedido, por pedido: para marcarlo en las listas normales de pedidos. */
export function usePorAtenderPorPedido() {
  const lista = useQuery({
    queryKey: ["pedidos_por_atender"], staleTime: 60_000,
    queryFn: () => q<PorAtender[]>(supabase.rpc("pedidos_por_atender")),
  });
  return useMemo(() => {
    const m = new Map<string, PorAtender[]>();
    for (const f of lista.data ?? []) m.set(f.pedido_id, [...(m.get(f.pedido_id) ?? []), f]);
    return m;
  }, [lista.data]);
}

/**
 * La marca en la lista de pedidos: a quién le toca y cuántos días lleva («Compras · 20 días»). Roja
 * si ya pasó el tiempo de esa área; gris mientras todavía está en tiempo.
 */
export function MarcaPorAtender({ filas }: { filas?: PorAtender[] }) {
  if (!filas?.length) return null;
  const areas = [...new Map(filas.map((f) => [f.area, f])).values()];
  return (
    <>
      {areas.map((f) => (
        <span key={f.area} data-explain={GLOSARIO.marcaPorAtender} data-explain-title={`${f.accion}: ${f.detalle}`}>
          <Insignia tono={f.atrasado ? "peligro" : "neutro"}>{AREA[f.area].texto} · {f.dias} {f.dias === 1 ? "día" : "días"}</Insignia>
        </span>
      ))}
    </>
  );
}

/**
 * Qué le falta a cada pedido y a quién le toca: almacén entrega lo que hay, compras pide lo que falta,
 * producción crea la orden o fabrica, el vendedor liga la partida a mano o consigue el anticipo. Lo
 * calcula la base (pedidos_por_atender); de entrada enseña lo de mi área.
 */
export function PedidosPorAtender({ filtros }: { filtros?: ReactNode }) {
  const ir = useNavigate();
  const lista = useQuery({
    queryKey: ["pedidos_por_atender"], staleTime: 60_000,
    queryFn: () => q<PorAtender[]>(supabase.rpc("pedidos_por_atender")),
  });
  const misAreas = useQuery({ queryKey: ["mis_areas_de_pedidos"], staleTime: Infinity, queryFn: () => q<Area[]>(supabase.rpc("mis_areas_de_pedidos")) }).data;
  const [area, setArea] = useState<Area | "todas" | null>(null);
  const elegida = area ?? (misAreas?.length === 1 ? misAreas[0] : "todas");
  const todas = lista.data ?? [];
  const filas = useMemo(() => (elegida === "todas" ? todas : todas.filter((f) => f.area === elegida)), [todas, elegida]);
  const cuenta = (a: Area) => todas.filter((f) => f.area === a).length;
  const columnas: Columna<PorAtender>[] = [
    { clave: "folio", titulo: "Pedido", celda: (f) => <div className="whitespace-nowrap"><p className="font-medium cifra">{f.folio}</p><p className="text-xs text-tenue">{fecha(f.creado_en)}</p></div> },
    { clave: "cliente", titulo: "Cliente", clase: "max-w-[220px]", celda: (f) => <div className="min-w-0"><p className="truncate">{f.cliente ?? "—"}</p><p className="text-xs text-tenue truncate">{f.vendedor ?? ""}</p></div> },
    { clave: "area", titulo: "Le toca a", explica: GLOSARIO.pedidoLeTocaA, valor: (f) => AREA[f.area].texto,
      celda: (f) => <Insignia tono={AREA[f.area].tono}>{AREA[f.area].texto}</Insignia> },
    { clave: "accion", titulo: "Qué falta", clase: "min-w-[260px] max-w-[520px]", valor: (f) => `${f.accion} ${f.detalle}`,
      celda: (f) => <div><p className="font-medium">{f.accion}</p><p className="text-xs text-tenue break-words">{f.detalle}</p></div> },
    { clave: "dias", titulo: "Días", alinear: "der", sinBusqueda: true, explica: GLOSARIO.pedidoDiasEsperando, valor: (f) => f.dias,
      celda: (f) => <span className={`cifra ${f.atrasado ? "text-peligro font-medium" : "text-tenue"}`}>{f.dias}</span> },
  ];
  return (
    <TablaDatos filas={filas} columnas={columnas} cargando={lista.isLoading} error={lista.error} claveFila={(f) => `${f.pedido_id}-${f.area}-${f.accion}`}
      alClicFila={(f) => ir(`/ventas/pedidos/${f.pedido_id}`)} exportarComo="pedidos-por-atender" placeholder="Pedido, cliente, artículo…"
      claseFila={(f) => (f.atrasado ? "bg-peligro-suave/30" : undefined)}
      filtros={<div className="flex flex-wrap items-center gap-2">
        {filtros}
        <Filtro valor={elegida} alCambiar={setArea} opciones={[
          { valor: "todas", texto: "Todas", cuenta: todas.length },
          { valor: "almacen", texto: "Almacén", cuenta: cuenta("almacen") },
          { valor: "compras", texto: "Compras", cuenta: cuenta("compras") },
          { valor: "produccion", texto: "Producción", cuenta: cuenta("produccion") },
          { valor: "ventas", texto: "Vendedor", cuenta: cuenta("ventas") },
        ]} />
      </div>}
      vacio={{ icono: ClipboardCheck, titulo: "Nada esperando", texto: "Todos los pedidos abiertos tienen quién los atienda: lo que hay se entregó, lo que falta ya se pidió y los equipos tienen su orden." }} />
  );
}

import { useQuery } from "@tanstack/react-query";
import { Lock } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { q } from "@/lib/consultas";
import { numero } from "@/lib/formato";
import { Insignia, type Tono } from "@/components/ui/insignia";
import { cn } from "@/lib/utilidades";

export interface Almacen { id: number; nombre: string; tipo: string; disponible_para_planta: boolean; activo: boolean }

/** Los almacenes casi no cambian: se piden una vez y se comparten entre pantallas. */
export function useAlmacenes() {
  return useQuery({
    queryKey: ["almacenes"],
    staleTime: 10 * 60_000,
    queryFn: () => q<Almacen[]>(supabase.from("almacenes").select("id, nombre, tipo, disponible_para_planta, activo").eq("activo", true).order("id")),
  });
}

/** Encabezados de columna que caben en una tabla de 7 almacenes. */
export function nombreCorto(nombre: string) {
  return nombre
    .replace(/^Planta /, "P. ")
    .replace(/^Contenedor /, "Cont. ")
    .replace(/^Almacén ML.*$/i, "ML Full");
}

export type TipoMovimiento =
  | "inicial" | "entrada_compra" | "devolucion" | "salida_produccion" | "salida_venta" | "salida_consumo"
  | "traspaso_salida" | "traspaso_entrada" | "ajuste_entrada" | "ajuste_salida";

export const TIPO_MOV: Record<TipoMovimiento, { texto: string; tono: Tono }> = {
  inicial: { texto: "Saldo inicial", tono: "neutro" },
  entrada_compra: { texto: "Entrada de compra", tono: "ok" },
  devolucion: { texto: "Devolución", tono: "ok" },
  salida_produccion: { texto: "Salida a producción", tono: "marca" },
  salida_venta: { texto: "Venta", tono: "info" },
  salida_consumo: { texto: "Consumo", tono: "aviso" },
  traspaso_salida: { texto: "Traspaso (sale)", tono: "neutro" },
  traspaso_entrada: { texto: "Traspaso (entra)", tono: "neutro" },
  ajuste_entrada: { texto: "Ajuste +", tono: "peligro" },
  ajuste_salida: { texto: "Ajuste −", tono: "peligro" },
};

export function InsigniaMovimiento({ tipo }: { tipo: TipoMovimiento }) {
  const t = TIPO_MOV[tipo] ?? { texto: tipo, tono: "neutro" as Tono };
  return <Insignia tono={t.tono}>{t.texto}</Insignia>;
}

/** "2 piezas", "1 pieza", "3 kg": las unidades vienen en singular del catálogo. */
export function unidadEn(unidad: string, n: number) {
  const u = unidad.trim();
  if (Math.abs(n) === 1 || u.length <= 2 || /[\d.]/.test(u)) return u;
  return /[aeiouáéó]$/i.test(u) ? `${u}s` : /[lnrd]$/i.test(u) ? `${u}es` : u;
}

/** Cantidad con signo y color: lo que entra en verde, lo que sale en rojo. */
export function CantidadConSigno({ n, unidad, className }: { n: number; unidad?: string; className?: string }) {
  return (
    <span className={cn("cifra font-medium whitespace-nowrap", n > 0 ? "text-ok" : n < 0 ? "text-peligro" : "text-tenue", className)}>
      {n > 0 ? "+" : n < 0 ? "−" : ""}{numero(Math.abs(n))}{unidad ? <span className="text-tenue font-normal text-xs"> {unidadEn(unidad, n)}</span> : null}
    </span>
  );
}

/** Para pantallas que su rol no debe operar: explica en vez de mostrar errores. */
export function SinPermiso({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6">
      <div className="h-12 w-12 rounded-full bg-fondo text-tenue flex items-center justify-center mb-3"><Lock className="h-6 w-6" /></div>
      <p className="font-medium">{titulo}</p>
      <p className="text-sm text-tenue mt-1 max-w-md">{texto}</p>
    </div>
  );
}

/**
 * La API entrega máximo 1,000 filas por consulta (max_rows de Supabase) y el
 * catálogo ya pasa de 5,000 artículos: sin esto la tabla se cortaría en silencio.
 * Pide de mil en mil hasta que llega una página incompleta. La consulta debe
 * tener un orden estable (con una llave única al final) para no repetir filas.
 */
export async function todasLasFilas<T>(
  armar: (desde: number, hasta: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  tope = 50_000,
): Promise<T[]> {
  const TAM = 1000;
  const filas: T[] = [];
  for (let desde = 0; desde < tope; desde += TAM) {
    const lote = (await q<T[]>(armar(desde, desde + TAM - 1))) ?? [];
    filas.push(...lote);
    if (lote.length < TAM) break;
  }
  return filas;
}

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Command } from "cmdk";
import * as P from "@radix-ui/react-popover";
import { ChevronsUpDown, Globe2, Loader2, Truck } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { q } from "@/lib/consultas";
import { Insignia, type Tono } from "@/components/ui/insignia";
import { cn } from "@/lib/utilidades";
import { hace as haceCompartido } from "@/lib/formato";

/** lib/formato.hace dice "hace 1 años"; aquí en singular mientras se corrige allá. */
export const hace = (f: string | Date | null | undefined) => haceCompartido(f).replace(/^hace 1 años$/, "hace 1 año");

export type Moneda = "MXN" | "USD" | "EUR";
export type EstadoOC = "borrador" | "enviada" | "parcial" | "recibida" | "cancelada";

export const ESTADO_OC: Record<EstadoOC, { texto: string; tono: Tono }> = {
  borrador: { texto: "Borrador", tono: "neutro" },
  enviada: { texto: "Enviada", tono: "info" },
  parcial: { texto: "Recibida en parte", tono: "aviso" },
  recibida: { texto: "Recibida", tono: "ok" },
  cancelada: { texto: "Cancelada", tono: "peligro" },
};

export function InsigniaOC({ estado, atrasada, dias }: { estado: EstadoOC; atrasada?: boolean; dias?: number | null }) {
  return (
    <span className="inline-flex flex-wrap gap-1">
      <Insignia tono={ESTADO_OC[estado].tono} punto>{ESTADO_OC[estado].texto}</Insignia>
      {atrasada && <Insignia tono="peligro">{dias ? `${dias} días tarde` : "atrasada"}</Insignia>}
    </span>
  );
}

export interface OrdenCompra {
  id: string; folio: string; proveedor_id: string; proveedor: string; es_importacion: boolean; estado: EstadoOC; fecha: string;
  fecha_entrega: string | null; moneda: Moneda; tipo_cambio: number; tasa_iva: number; condiciones: string | null; notas: string | null;
  factura_proveedor: string | null; subtotal: number; iva: number; total: number; vence_pago: string | null; creado_por_nombre: string | null;
  partidas: number; avance_recibido: number; atrasada: boolean; dias_atraso: number | null; pagado: number; creado_en: string;
}

/** Último tipo de cambio por moneda (lo que usa la base en tc()). */
export function useTiposCambio() {
  return useQuery({
    queryKey: ["tipos_cambio"],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const filas = await q<{ moneda: Moneda; valor: number; fecha: string }[]>(supabase.from("tipos_cambio").select("moneda, valor, fecha").order("fecha", { ascending: false }).limit(60));
      const tc: Record<Moneda, number> = { MXN: 1, USD: 1, EUR: 1 };
      const vistos = new Set<string>();
      for (const f of filas) if (!vistos.has(f.moneda)) { tc[f.moneda] = Number(f.valor); vistos.add(f.moneda); }
      return tc;
    },
  });
}

export interface ProveedorBreve { id: string; nombre: string; categoria: string | null; pais: string; es_importacion: boolean; moneda: Moneda; dias_entrega: number | null; dias_credito: number }

/**
 * Elegir proveedor escribiendo. El directorio importado mezcla proveedores de
 * compras con acreedores (nómina, casetas, hoteles): se muestran primero los que
 * surten artículos.
 */
export function SelectorProveedor({ valor, alCambiar, className, deshabilitado, placeholder = "Elegir proveedor…" }: {
  valor: { id: string; nombre: string } | null; alCambiar: (p: ProveedorBreve) => void; className?: string; deshabilitado?: boolean; placeholder?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const [res, setRes] = useState<(ProveedorBreve & { articulos: number })[]>([]);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    setCargando(true);
    const t = setTimeout(async () => {
      let c = supabase.from("v_proveedores").select("id, nombre, categoria, pais, es_importacion, moneda, dias_entrega, dias_credito, articulos")
        .eq("activo", true).order("articulos", { ascending: false }).order("nombre").limit(30);
      if (texto.trim()) c = c.ilike("nombre", `%${texto.trim().replace(/\s+/g, "%")}%`);
      const { data } = await c;
      setRes((data as (ProveedorBreve & { articulos: number })[]) ?? []);
      setCargando(false);
    }, 150);
    return () => clearTimeout(t);
  }, [texto, abierto]);

  return (
    <P.Root open={abierto} onOpenChange={setAbierto}>
      <P.Trigger asChild disabled={deshabilitado}>
        <button type="button" className={cn("campo flex items-center justify-between text-left", className)}>
          <span className={cn("truncate", !valor && "text-tenue")}>{valor?.nombre ?? placeholder}</span>
          <ChevronsUpDown className="h-4 w-4 text-tenue shrink-0" />
        </button>
      </P.Trigger>
      <P.Portal>
        <P.Content align="start" sideOffset={4} collisionPadding={12}
          className="z-50 w-[var(--radix-popover-trigger-width)] min-w-[min(380px,calc(100vw-24px))] tarjeta shadow-xl overflow-hidden">
          <Command shouldFilter={false} loop>
            <div className="flex items-center gap-2 px-3 border-b border-borde">
              {cargando ? <Loader2 className="h-4 w-4 animate-spin text-tenue" /> : <Truck className="h-4 w-4 text-tenue" />}
              <Command.Input autoFocus value={texto} onValueChange={setTexto} placeholder="Nombre del proveedor…" className="h-10 flex-1 bg-transparent outline-none text-sm" />
            </div>
            <Command.List className="max-h-[300px] overflow-y-auto p-1">
              {res.map((p) => (
                <Command.Item key={p.id} value={p.id} onSelect={() => { alCambiar(p); setAbierto(false); }}
                  className="rounded-lg px-2 py-2 cursor-pointer data-[selected=true]:bg-marca-suave">
                  <p className="text-sm flex items-center gap-1.5">{p.nombre}{p.es_importacion && <Globe2 className="h-3.5 w-3.5 text-info" />}</p>
                  <p className="text-xs text-tenue">{[p.categoria, p.articulos ? `${p.articulos} artículos` : null, p.moneda !== "MXN" ? p.moneda : null].filter(Boolean).join(" · ")}</p>
                </Command.Item>
              ))}
              {!cargando && res.length === 0 && <p className="p-4 text-sm text-tenue text-center">Sin proveedores con ese nombre.</p>}
            </Command.List>
          </Command>
        </P.Content>
      </P.Portal>
    </P.Root>
  );
}

import { useEffect, useRef, useState } from "react";
import { Command } from "cmdk";
import * as P from "@radix-ui/react-popover";
import { Boxes, Layers, Loader2, Search } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { dinero, numero } from "@/lib/formato";
import { cn } from "@/lib/utilidades";

export interface ArticuloEncontrado {
  id: string; clave: string; nombre: string; tipo: "componente" | "materia_prima" | "subensamble" | "equipo" | "servicio";
  unidad: string; descripcion: string | null; imagen_url: string | null; precio: number | null;
  existencia: number | null; tiempo_entrega_dias: number | null; es_importado: boolean;
}

/**
 * Buscador de artículos para capturar partidas (cotizaciones, listas de
 * materiales, órdenes de compra, salidas). Escribe parte del nombre o la clave,
 * flechas para moverse, Enter para elegir. Reemplaza al menú de 4,555 nombres
 * del cotizador en hojas.
 */
export function BuscadorArticulo({ alElegir, tipos, placeholder = "Buscar equipo o componente…", autoFocus, className, mostrarPrecio = true }: {
  alElegir: (a: ArticuloEncontrado) => void; tipos?: ArticuloEncontrado["tipo"][]; placeholder?: string;
  autoFocus?: boolean; className?: string; mostrarPrecio?: boolean;
}) {
  const [q, setQ] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [res, setRes] = useState<ArticuloEncontrado[]>([]);
  const [cargando, setCargando] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!abierto) return;
    setCargando(true);
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc("buscar_articulos", { q, p_tipos: tipos ?? null, p_limite: 30 });
      setRes((data as ArticuloEncontrado[]) ?? []);
      setCargando(false);
    }, 150);
    return () => clearTimeout(t);
  }, [q, abierto, tipos]);

  return (
    <P.Root open={abierto && (q.length > 0 || res.length > 0)} onOpenChange={setAbierto}>
      <Command shouldFilter={false} className={cn("relative", className)} loop>
        <P.Anchor asChild>
          <div className="relative">
            {cargando ? <Loader2 className="h-4 w-4 text-tenue absolute left-3 top-1/2 -translate-y-1/2 animate-spin" />
                      : <Search className="h-4 w-4 text-tenue absolute left-3 top-1/2 -translate-y-1/2" />}
            <Command.Input ref={entrada} autoFocus={autoFocus} value={q} onValueChange={(v) => { setQ(v); setAbierto(true); }}
              onFocus={() => setAbierto(true)} placeholder={placeholder} className="campo pl-9" />
          </div>
        </P.Anchor>
        <P.Portal>
          <P.Content align="start" sideOffset={4} onOpenAutoFocus={(e) => e.preventDefault()}
            className="z-50 w-[var(--radix-popover-trigger-width)] min-w-[420px] tarjeta shadow-xl overflow-hidden">
            <Command.List className="max-h-[360px] overflow-y-auto p-1">
              {!cargando && <Command.Empty className="p-4 text-sm text-tenue text-center">No hay artículos con “{q}”.</Command.Empty>}
              {res.map((a) => (
                <Command.Item key={a.id} value={a.id}
                  onSelect={() => { alElegir(a); setQ(""); setAbierto(false); entrada.current?.focus(); }}
                  className="flex items-center gap-3 rounded-lg px-2 py-2 cursor-pointer data-[selected=true]:bg-marca-suave">
                  {a.imagen_url ? <img src={a.imagen_url} alt="" className="h-9 w-9 rounded object-cover bg-fondo shrink-0" loading="lazy" />
                    : <div className="h-9 w-9 rounded bg-fondo flex items-center justify-center shrink-0">
                        {a.tipo === "equipo" || a.tipo === "subensamble" ? <Layers className="h-4 w-4 text-tenue" /> : <Boxes className="h-4 w-4 text-tenue" />}
                      </div>}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm truncate">{a.nombre}</p>
                    <p className="text-xs text-tenue">
                      {a.clave} · {a.unidad}
                      {a.existencia != null && <> · <span className={a.existencia > 0 ? "text-ok" : "text-peligro"}>{numero(a.existencia)} en planta</span></>}
                    </p>
                  </div>
                  {mostrarPrecio && <span className="text-sm font-medium cifra">{dinero(a.precio)}</span>}
                </Command.Item>
              ))}
            </Command.List>
          </P.Content>
        </P.Portal>
      </Command>
    </P.Root>
  );
}

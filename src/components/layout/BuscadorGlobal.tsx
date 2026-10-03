import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Command } from "cmdk";
import * as D from "@radix-ui/react-dialog";
import { Boxes, ClipboardCheck, ClipboardList, FileText, Layers, Loader2, Search, ShoppingCart, Truck, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface Resultado { tipo: string; id: string; titulo: string; subtitulo: string | null; ruta: string }

const ICONOS: Record<string, typeof Users> = {
  cliente: Users, equipo: Layers, subensamble: Layers, componente: Boxes, cotizacion: FileText,
  pedido: ShoppingCart, proveedor: Truck, orden_produccion: ClipboardCheck, orden_compra: ClipboardList,
};
const NOMBRES: Record<string, string> = {
  cliente: "Clientes", equipo: "Equipos", subensamble: "Subensambles", componente: "Componentes",
  cotizacion: "Cotizaciones", pedido: "Pedidos", proveedor: "Proveedores", orden_produccion: "Órdenes de producción",
  orden_compra: "Órdenes de compra",
};

/** Un solo buscador para todo (Ctrl+K). La base filtra por permisos: cada quien ve solo lo suyo. */
export function BuscadorGlobal({ abierto, alCambiar }: { abierto: boolean; alCambiar: (v: boolean) => void }) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<Resultado[]>([]);
  const [cargando, setCargando] = useState(false);
  const navegar = useNavigate();

  useEffect(() => {
    if (q.trim().length < 2) { setRes([]); return; }
    setCargando(true);
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc("buscar_global", { q });
      setRes((data as Resultado[]) ?? []);
      setCargando(false);
    }, 180);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => { if (!abierto) setQ(""); }, [abierto]);

  const grupos = res.reduce<Record<string, Resultado[]>>((a, r) => ((a[r.tipo] ??= []).push(r), a), {});

  return (
    <D.Root open={abierto} onOpenChange={alCambiar}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <D.Content className="fixed left-1/2 top-[12vh] z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 tarjeta shadow-2xl overflow-hidden">
          <D.Title className="sr-only">Buscar</D.Title>
          <Command shouldFilter={false} label="Buscar en el ERP">
            <div className="flex items-center gap-2 px-4 border-b border-borde">
              {cargando ? <Loader2 className="h-4 w-4 animate-spin text-tenue" /> : <Search className="h-4 w-4 text-tenue" />}
              <Command.Input autoFocus value={q} onValueChange={setQ} placeholder="Escribe lo que buscas…" className="h-12 flex-1 bg-transparent outline-none text-sm" />
            </div>
            <Command.List className="max-h-[60vh] overflow-y-auto p-2">
              {q.trim().length >= 2 && !cargando && <Command.Empty className="py-8 text-center text-sm text-tenue">Sin resultados para “{q}”.</Command.Empty>}
              {Object.entries(grupos).map(([tipo, items]) => {
                const Icono = ICONOS[tipo] ?? Search;
                return (
                  <Command.Group key={tipo} heading={NOMBRES[tipo] ?? tipo} className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-tenue">
                    {items.map((r) => (
                      <Command.Item
                        key={r.tipo + r.id}
                        value={r.tipo + r.id}
                        onSelect={() => { alCambiar(false); navegar(r.ruta); }}
                        className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm cursor-pointer data-[selected=true]:bg-marca-suave"
                      >
                        <Icono className="h-4 w-4 text-tenue shrink-0" />
                        <div className="min-w-0">
                          <p className="truncate">{r.titulo}</p>
                          {r.subtitulo && <p className="text-xs text-tenue truncate">{r.subtitulo}</p>}
                        </div>
                      </Command.Item>
                    ))}
                  </Command.Group>
                );
              })}
            </Command.List>
          </Command>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

import { useEffect, useState } from "react";
import { Command } from "cmdk";
import * as P from "@radix-ui/react-popover";
import { ChevronsUpDown, Loader2, Plus, UserRound } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utilidades";

export interface ClienteBreve { id: string; nombre: string; razon_social: string | null; ciudad: string | null; vendedor: string | null; vendedor_id: string | null }

/** Elegir cliente escribiendo. Muestra de quién es cada cuenta para no pisarse entre vendedores. */
export function SelectorCliente({ valor, alCambiar, alCrear, className, deshabilitado }: {
  valor: { id: string; nombre: string } | null; alCambiar: (c: ClienteBreve | null) => void;
  alCrear?: (nombre: string) => void; className?: string; deshabilitado?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [q, setQ] = useState("");
  const [res, setRes] = useState<ClienteBreve[]>([]);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    setCargando(true);
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc("buscar_clientes", { q, p_limite: 20 });
      setRes((data as ClienteBreve[]) ?? []);
      setCargando(false);
    }, 150);
    return () => clearTimeout(t);
  }, [q, abierto]);

  return (
    <P.Root open={abierto} onOpenChange={setAbierto}>
      <P.Trigger asChild disabled={deshabilitado}>
        <button type="button" className={cn("campo flex items-center justify-between text-left", className)}>
          <span className={cn("truncate", !valor && "text-tenue")}>{valor?.nombre ?? "Elegir cliente…"}</span>
          <ChevronsUpDown className="h-4 w-4 text-tenue shrink-0" />
        </button>
      </P.Trigger>
      <P.Portal>
        <P.Content align="start" sideOffset={4} className="z-50 w-[var(--radix-popover-trigger-width)] min-w-[360px] tarjeta shadow-xl overflow-hidden">
          <Command shouldFilter={false} loop>
            <div className="flex items-center gap-2 px-3 border-b border-borde">
              {cargando ? <Loader2 className="h-4 w-4 animate-spin text-tenue" /> : <UserRound className="h-4 w-4 text-tenue" />}
              <Command.Input autoFocus value={q} onValueChange={setQ} placeholder="Nombre, razón social o RFC…" className="h-10 flex-1 bg-transparent outline-none text-sm" />
            </div>
            <Command.List className="max-h-[300px] overflow-y-auto p-1">
              {res.map((c) => (
                <Command.Item key={c.id} value={c.id} onSelect={() => { alCambiar(c); setAbierto(false); }}
                  className="rounded-lg px-2 py-2 cursor-pointer data-[selected=true]:bg-marca-suave">
                  <p className="text-sm">{c.nombre}</p>
                  <p className="text-xs text-tenue">{[c.razon_social, c.ciudad, c.vendedor && `de ${c.vendedor}`].filter(Boolean).join(" · ")}</p>
                </Command.Item>
              ))}
              {alCrear && q.trim().length > 2 && (
                <Command.Item value="__crear" onSelect={() => { alCrear(q.trim()); setAbierto(false); }}
                  className="flex items-center gap-2 rounded-lg px-2 py-2 cursor-pointer text-marca-texto data-[selected=true]:bg-marca-suave">
                  <Plus className="h-4 w-4" /> Dar de alta “{q.trim()}”
                </Command.Item>
              )}
              {!cargando && res.length === 0 && !alCrear && <p className="p-4 text-sm text-tenue text-center">Sin clientes.</p>}
            </Command.List>
          </Command>
        </P.Content>
      </P.Portal>
    </P.Root>
  );
}

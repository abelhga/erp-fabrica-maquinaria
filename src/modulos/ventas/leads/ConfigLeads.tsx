import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Campo, Entrada } from "@/components/ui/campo";
import { Cargando } from "@/components/ui/estados";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { cn } from "@/lib/utilidades";
import { GLOSARIO } from "@/tutorial/glosario";
import { TarjetaForm } from "@/modulos/sistema/componentes/ConfigEmpresa";
import { MODOS, useConfigLeads, type ConfigLeads as Config } from "./datos";

/**
 * A quién le llegan los leads que registra recepción: las tres formas de repartir, cuándo
 * se avisa a la gerencia si nadie lo atiende, y qué vendedores los reciben. Vive en
 * Configuración → Ventas y también en la pantalla de Leads para la gerencia.
 */
export function ConfigLeads({ editable }: { editable: boolean }) {
  const cfg = useConfigLeads();
  // Solo quien puede vender: ni la pantalla del taller ni almacén reciben leads.
  const personas = useQuery({ queryKey: ["candidatos_leads"], staleTime: 5 * 60_000,
    queryFn: () => q<{ id: string; nombre: string }[]>(supabase.rpc("candidatos_leads")) });
  const [f, setF] = useState<Config | null>(null);
  useEffect(() => { if (cfg.data) setF(cfg.data); }, [cfg.data]);
  const guardar = useAccion((c: Config) => q(supabase.rpc("fijar_config_leads", {
    p_modo: c.modo, p_horas_sin_tomar: Number(c.horas_sin_tomar), p_horas_sin_atender: Number(c.horas_sin_atender), p_vendedores: c.vendedores,
  })), { exito: "Reparto de leads guardado", invalidar: [["configuracion"], ["vendedores_para_leads"]] });

  if (!f) return <Cargando filas={3} />;
  const marcar = (id: string) => setF({ ...f, vendedores: f.vendedores.includes(id) ? f.vendedores.filter((v) => v !== id) : [...f.vendedores, id] });

  return (
    <TarjetaForm titulo="Leads de recepción" explica={GLOSARIO.modoLeads} editable={editable} quien="la gerencia de ventas o dirección"
      guardando={guardar.isPending} alGuardar={() => guardar.mutate(f)}
      descripcion="A quién le llega cada lead que se registra. Si ya es cliente con vendedor vigente, le llega a su vendedor sin importar la opción."
      pie={f.vendedores.length === 0 ? "Reciben leads todos los que tienen el rol de ventas." : `Reciben leads ${f.vendedores.length} vendedor(es).`}>
      <fieldset className="grid gap-2 sm:grid-cols-3" disabled={!editable}>
        {MODOS.map((m) => (
          <label key={m.valor} className={cn("flex cursor-pointer gap-2 rounded-lg border p-3 text-sm",
            f.modo === m.valor ? "border-marca bg-marca-suave" : "border-borde hover:bg-fondo")}>
            <input type="radio" name="modo_leads" className="mt-0.5" checked={f.modo === m.valor} onChange={() => setF({ ...f, modo: m.valor })} />
            <span><b>{m.texto}</b><span className="block text-xs text-tenue mt-0.5">{m.detalle}</span></span>
          </label>
        ))}
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Horas sin tomar" ayuda="Si un lead nuevo sigue sin vendedor, se avisa a la gerencia.">
          <Entrada type="number" min="0.5" step="0.5" className="cifra w-28 block" disabled={!editable} value={f.horas_sin_tomar}
            onChange={(e) => setF({ ...f, horas_sin_tomar: e.target.value as unknown as number })} />
        </Campo>
        <Campo etiqueta="Horas sin atender" ayuda="Si el vendedor no lo vuelve oportunidad ni lo descarta, se le avisa a él y a la gerencia.">
          <Entrada type="number" min="1" step="1" className="cifra w-28 block" disabled={!editable} value={f.horas_sin_atender}
            onChange={(e) => setF({ ...f, horas_sin_atender: e.target.value as unknown as number })} />
        </Campo>
      </div>
      <Campo etiqueta="¿Quiénes reciben leads?" ayuda="Si no marcas a nadie, todos los que tienen el rol de ventas.">
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-1">
          {(personas.data ?? []).map((p) => (
            <label key={p.id} className="inline-flex items-center gap-1.5 text-sm">
              <input type="checkbox" className="h-4 w-4" disabled={!editable} checked={f.vendedores.includes(p.id)} onChange={() => marcar(p.id)} />{p.nombre}
            </label>
          ))}
        </div>
      </Campo>
    </TarjetaForm>
  );
}

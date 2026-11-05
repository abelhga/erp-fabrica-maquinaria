import { useState } from "react";
import type { QueryKey } from "@tanstack/react-query";
import { Boton } from "@/components/ui/boton";
import { Entrada } from "@/components/ui/campo";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { GLOSARIO } from "@/tutorial/glosario";
import type { Lead } from "./datos";

/**
 * Lo que le falta a un lead para que el vendedor lo pueda atender (dónde está, la empresa, qué busca
 * con modelo o medida). Antes no había forma de corregir un lead ya registrado; ahora lo completa
 * quien lo registró, el vendedor que lo tiene o la gerencia. Es lo que mide «Leads capturados completos».
 */
export function CompletarLead({ lead: l, invalidar }: { lead: Lead; invalidar: QueryKey[] }) {
  const [f, setF] = useState({ empresa: l.empresa ?? "", ciudad: l.ciudad ?? "", estado_mx: l.estado_mx ?? "", interes: l.interes });
  const cambia = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const guardar = useAccion(() => q(supabase.rpc("completar_lead", { p_lead: l.id, p_empresa: f.empresa, p_ciudad: f.ciudad, p_estado: f.estado_mx, p_interes: f.interes })),
    { exito: "Datos del lead guardados", invalidar });
  const enviar = (e: React.FormEvent) => { e.preventDefault(); guardar.mutate(undefined); };

  return (
    <form onSubmit={enviar} className="rounded-lg border border-aviso/30 bg-aviso-suave p-3 space-y-2" data-explain={GLOSARIO.leadCompleto} data-explain-title="Lead completo">
      <p className="text-sm"><b>Le falta {l.faltan.join(", ")}.</b> <span className="text-tenue">Sin eso el vendedor no sabe si conviene ir ni qué cotizarle.</span></p>
      <div className="grid gap-2 sm:grid-cols-2">
        {!l.cliente_id && (
          <div className="flex gap-1.5 sm:col-span-2">
            <Entrada value={f.empresa} onChange={cambia("empresa")} aria-label="Empresa" placeholder="Empresa" />
            <Boton type="button" variante="secundario" tamano="sm" onClick={() => setF({ ...f, empresa: "Particular" })} data-explain={GLOSARIO.botonLeadParticular}>Es particular</Boton>
          </div>
        )}
        {!l.cliente_id && <Entrada value={f.ciudad} onChange={cambia("ciudad")} aria-label="Ciudad" placeholder="Ciudad" />}
        {!l.cliente_id && <Entrada value={f.estado_mx} onChange={cambia("estado_mx")} aria-label="Estado" placeholder="Estado" />}
        <Entrada className="sm:col-span-2" value={f.interes} onChange={cambia("interes")} aria-label="Qué busca"
          placeholder="Qué busca: equipo con modelo o medida, para qué material" />
      </div>
      <div className="flex justify-end"><Boton type="submit" tamano="sm" cargando={guardar.isPending}>Guardar</Boton></div>
    </form>
  );
}

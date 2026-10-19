import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Ban, RotateCcw } from "lucide-react";
import { Dialogo } from "@/components/ui/dialogo";
import { Boton } from "@/components/ui/boton";
import { Insignia } from "@/components/ui/insignia";
import { Interruptor } from "@/components/ui/interruptor";
import { Cargando } from "@/components/ui/estados";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { useSesion } from "@/lib/sesion";
import { GLOSARIO } from "@/tutorial/glosario";
import type { ArticuloCatalogo } from "./comun";

type Art = Pick<ArticuloCatalogo, "id" | "clave" | "nombre" | "tipo" | "activo">;
interface Uso { equipos_activos: number; pedidos_abiertos: number; cotizaciones_abiertas: number }

/**
 * Activo / inhabilitado de un equipo o subensamble. Inhabilitar pide confirmar con lo que
 * conviene saber (dónde se usa, qué pedidos lo traen); reactivar es un clic. Quien no puede
 * cambiarlo solo ve la insignia.
 */
export function ActivoArticulo({ a, forma }: { a: Art; forma: "interruptor" | "boton" }) {
  const { puede } = useSesion();
  const [confirmar, setConfirmar] = useState(false);
  const fijar = useAccion((activo: boolean) => q(supabase.rpc("fijar_articulo_activo", { p_articulo: a.id, p_activo: activo })), {
    exito: (r) => ((r as { activo: boolean }).activo ? `${a.clave} reactivado: ya sale en el cotizador` : `${a.clave} inhabilitado`),
    invalidar: [["costeo"]], alTerminar: () => setConfirmar(false),
  });
  const cambiar = (v: boolean) => (v ? fijar.mutate(true) : setConfirmar(true));

  if (!puede("costeo", 2)) {
    return a.activo ? (forma === "interruptor" ? <span className="text-tenue">Sí</span> : null)
      : <span data-explain={GLOSARIO.articuloInhabilitado} data-explain-title="Inhabilitado"><Insignia tono="neutro">Inhabilitado</Insignia></span>;
  }
  // En la tabla, ni el interruptor ni el diálogo (que React sigue considerando dentro del
  // renglón) deben abrir la ficha al hacer clic.
  return (
    <span onClick={forma === "interruptor" ? (e) => e.stopPropagation() : undefined} className="contents">
      {forma === "interruptor" ? (
        <Interruptor activo={a.activo} alCambiar={cambiar} cargando={fijar.isPending}
          aria-label={`${a.clave} ${a.activo ? "activo" : "inhabilitado"}`} title={a.activo ? "Activo: clic para inhabilitar" : "Inhabilitado: clic para reactivar"} />
      ) : a.activo ? (
        <Boton variante="fantasma" onClick={() => cambiar(false)} data-explain={GLOSARIO.articuloInhabilitado} data-explain-title="Inhabilitar">
          <Ban className="h-4 w-4" /> Inhabilitar</Boton>
      ) : (
        <Boton variante="secundario" onClick={() => cambiar(true)} cargando={fijar.isPending}><RotateCcw className="h-4 w-4" /> Reactivar</Boton>
      )}
      {confirmar && <Confirmar a={a} cargando={fijar.isPending} alCerrar={() => setConfirmar(false)} alConfirmar={() => fijar.mutate(false)} />}
    </span>
  );
}

function Confirmar({ a, cargando, alCerrar, alConfirmar }: { a: Art; cargando: boolean; alCerrar: () => void; alConfirmar: () => void }) {
  const uso = useQuery({ queryKey: ["costeo", "uso_abierto", a.id], queryFn: () => q<Uso>(supabase.rpc("articulo_uso_abierto", { p_articulo: a.id })) });
  const u = uso.data;
  const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
  return (
    <Dialogo abierto alCambiar={(v) => !v && alCerrar()} titulo={`Inhabilitar ${a.clave}`}
      descripcion={a.nombre}
      pie={<><Boton variante="secundario" onClick={alCerrar}>Cancelar</Boton>
        <Boton variante="peligro" onClick={alConfirmar} cargando={cargando} disabled={!u}><Ban className="h-4 w-4" /> Inhabilitar</Boton></>}>
      {!u ? <Cargando filas={2} /> : (
        <ul className="space-y-2 text-sm list-disc pl-5">
          <li>Deja de salir en el cotizador, en pedidos nuevos y al armar listas de materiales, y pierde su precio de lista.</li>
          {u.equipos_activos > 0 && <li>Lo usan <b>{plural(u.equipos_activos, "equipo activo", "equipos activos")}</b>: ahí sigue igual, con su costo y en sus órdenes.</li>}
          {u.pedidos_abiertos + u.cotizaciones_abiertas > 0 && (
            <li>Lo traen {[u.pedidos_abiertos && plural(u.pedidos_abiertos, "pedido abierto", "pedidos abiertos"),
              u.cotizaciones_abiertas && plural(u.cotizaciones_abiertas, "cotización abierta", "cotizaciones abiertas")].filter(Boolean).join(" y ")}: no cambian.</li>
          )}
          <li>Lo puedes reactivar cuando quieras desde el filtro «Inhabilitados»; regresa con su precio.</li>
        </ul>
      )}
    </Dialogo>
  );
}

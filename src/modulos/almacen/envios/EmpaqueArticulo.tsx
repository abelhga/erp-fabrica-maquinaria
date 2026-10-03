import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Package, Pencil } from "lucide-react";
import { Tarjeta, EncabezadoTarjeta } from "@/components/ui/tarjeta";
import { Boton } from "@/components/ui/boton";
import { useSesion } from "@/lib/sesion";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { fecha, numero } from "@/lib/formato";
import { CampoNumero } from "@/modulos/ventas/componentes/campos";
import { CLAVE } from "./datos";

interface Empaque {
  paquete_kg: number | null; paquete_largo_cm: number | null; paquete_ancho_cm: number | null; paquete_alto_cm: number | null;
  paquete_piezas: number; paquete_medido_en: string | null; medido: { nombre: string } | null;
}
const CAMPOS = [["paquete_kg", "Peso", "kg"], ["paquete_largo_cm", "Largo", "cm"], ["paquete_ancho_cm", "Ancho", "cm"], ["paquete_alto_cm", "Alto", "cm"], ["paquete_piezas", "Piezas por paquete", ""]] as const;

/**
 * Peso y medidas del paquete, en la ficha del artículo. Se capturan una vez
 * (almacén o ingeniería) y prellenan cada envío: ya no se le pregunta al almacén
 * "pásame peso y medidas" ni se teclean 20 versiones de la misma caja.
 */
export function EmpaqueArticulo({ articuloId }: { articuloId: string }) {
  const { puede } = useSesion();
  const editable = puede("inventario", 2) || puede("costeo", 2);
  const datos = useQuery({
    queryKey: [...CLAVE, "empaque", articuloId],
    queryFn: () => q<Empaque>(supabase.from("articulos")
      .select("paquete_kg, paquete_largo_cm, paquete_ancho_cm, paquete_alto_cm, paquete_piezas, paquete_medido_en, medido:perfiles!articulos_paquete_medido_por_fkey(nombre)")
      .eq("id", articuloId).single() as never),
  });
  const [editando, setEditando] = useState(false);
  const [f, setF] = useState<Record<string, number | null>>({});
  useEffect(() => {
    if (datos.data) setF(Object.fromEntries(CAMPOS.map(([k]) => [k, datos.data![k] == null ? null : Number(datos.data![k])])));
  }, [datos.data, editando]);
  const guardar = useAccion(() => q(supabase.rpc("guardar_empaque", {
    p_articulo: articuloId, p_kg: f.paquete_kg, p_largo: f.paquete_largo_cm, p_ancho: f.paquete_ancho_cm, p_alto: f.paquete_alto_cm, p_piezas: f.paquete_piezas ?? 1,
  })), { exito: "Empaque guardado: los próximos envíos ya salen con estos datos", invalidar: [CLAVE], alTerminar: () => setEditando(false) });

  const d = datos.data;
  const tiene = d?.paquete_kg != null;
  return (
    <Tarjeta>
      <EncabezadoTarjeta titulo="Empaque para envío"
        descripcion={tiene ? `Medido${d?.medido ? ` por ${d.medido.nombre}` : ""}${d?.paquete_medido_en ? ` el ${fecha(d.paquete_medido_en)}` : ""}` : "Sin peso ni medidas todavía"}
        acciones={editable && !editando && <Boton variante="secundario" tamano="sm" onClick={() => setEditando(true)}><Pencil className="h-3.5 w-3.5" />{tiene ? "Corregir" : "Capturar"}</Boton>} />
      <div className="px-5 pb-5">
        {editando ? (
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); guardar.mutate(undefined); }}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {CAMPOS.map(([k, et, u]) => (
                <label key={k} className="space-y-1">
                  <span className="text-xs text-tenue">{et}</span>
                  <CampoNumero valor={f[k]} sufijo={u || undefined} decimales={k === "paquete_piezas" ? 3 : 1} vacioEsCero={false} min={0} etiqueta={et}
                    alCambiar={(n) => setF((x) => ({ ...x, [k]: n }))} />
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <Boton type="submit" cargando={guardar.isPending}>Guardar</Boton>
              <Boton type="button" variante="secundario" onClick={() => setEditando(false)}>Cancelar</Boton>
            </div>
          </form>
        ) : tiene ? (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <span className="inline-flex items-center gap-2"><Package className="h-5 w-5 text-tenue" />
              <span className="text-xl font-semibold cifra">{numero(d!.paquete_kg)} kg</span></span>
            <span className="cifra">{numero(d!.paquete_largo_cm)} × {numero(d!.paquete_ancho_cm)} × {numero(d!.paquete_alto_cm)} cm</span>
            <span className="text-sm text-tenue">{Number(d!.paquete_piezas) === 1 ? "1 pieza por paquete" : `${numero(d!.paquete_piezas)} piezas por paquete`}
              {" · "}volumétrico <span className="cifra">{numero(Math.round(Number(d!.paquete_largo_cm) * Number(d!.paquete_ancho_cm) * Number(d!.paquete_alto_cm) / 500) / 10)} kg</span></span>
          </div>
        ) : (
          <p className="text-sm text-tenue">
            {editable ? "Pésalo y mídelo una vez (con su caja): cada envío lo toma de aquí." : "Almacén lo captura la primera vez que lo empaca; desde ahí cada envío sale con estos datos."}
          </p>
        )}
      </div>
    </Tarjeta>
  );
}

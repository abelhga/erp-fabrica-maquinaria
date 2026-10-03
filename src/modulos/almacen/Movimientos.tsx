import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Pagina } from "@/components/layout/Shell";
import { Pestanas, ListaPestanas, ContenidoPestana } from "@/components/ui/pestanas";
import { useSesion } from "@/lib/sesion";
import { supabase } from "@/lib/supabase";
import { useTiempoReal } from "@/lib/consultas";
import { Registrar } from "./componentes/Registrar";
import { Historial } from "./componentes/Historial";
import { Ajustes } from "./componentes/Ajustes";
import { Conteos } from "./componentes/Conteos";

type Vista = "registrar" | "historial" | "ajustes" | "conteos";

export default function Movimientos() {
  const { puede } = useSesion();
  const [params, setParams] = useSearchParams();
  const capturar = puede("inventario", 2);
  // La base enseña movimientos a almacén y a quien ve costos; al vendedor no.
  const verMovimientos = capturar || puede("costos", 1);
  const opciones: { valor: Vista; texto: string; cuenta?: number }[] = [];

  const pendientes = useQuery({
    queryKey: ["ajustes_pendientes_cuenta"],
    queryFn: async () => {
      const { count } = await supabase.from("ajustes_inventario").select("id", { count: "exact", head: true }).eq("estado", "pendiente");
      return count ?? 0;
    },
  });
  useTiempoReal("ajustes_inventario", [["ajustes_pendientes_cuenta"], ["v_ajustes"]]);

  if (capturar) opciones.push({ valor: "registrar", texto: "Registrar" });
  if (verMovimientos) opciones.push({ valor: "historial", texto: "Historial" });
  opciones.push({ valor: "ajustes", texto: "Ajustes", cuenta: pendientes.data || undefined });
  opciones.push({ valor: "conteos", texto: "Conteos físicos" });

  const pedida = params.get("vista") as Vista | null;
  const vista: Vista = pedida && opciones.some((o) => o.valor === pedida) ? pedida : opciones[0].valor;
  const cambiar = (v: string) => {
    const p = new URLSearchParams(params);
    p.set("vista", v);
    if (v !== "conteos") p.delete("conteo");
    setParams(p, { replace: true });
  };

  return (
    <Pagina
      titulo="Entradas y salidas"
      descripcion="Cada movimiento queda con quién, cuándo y para qué. Nada se edita: un error se corrige con un ajuste que autoriza otra persona."
    >
      <Pestanas value={vista} onValueChange={cambiar}>
        <ListaPestanas opciones={opciones} />
        {capturar && <ContenidoPestana value="registrar" className="pt-5"><Registrar irAAjustes={() => cambiar("ajustes")} /></ContenidoPestana>}
        {verMovimientos && <ContenidoPestana value="historial" className="pt-5"><Historial /></ContenidoPestana>}
        <ContenidoPestana value="ajustes" className="pt-5"><Ajustes /></ContenidoPestana>
        <ContenidoPestana value="conteos" className="pt-5"><Conteos irAAjustes={() => cambiar("ajustes")} /></ContenidoPestana>
      </Pestanas>
    </Pagina>
  );
}

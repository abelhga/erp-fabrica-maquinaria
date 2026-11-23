import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ScanBarcode, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { useSesion } from "@/lib/sesion";
import { GLOSARIO } from "@/tutorial/glosario";

interface Codigo { id: number; codigo: string }

/**
 * Los códigos de barras de un artículo. Se dan de alta leyéndolos: el cursor en el campo, se
 * pasa el lector y el Enter que manda lo guarda. El campo lleva `data-lector` para que el
 * detector de la pantalla no se lleve esa lectura a otra parte.
 */
export function CodigosArticulo({ articuloId, clave }: { articuloId: string; clave: string }) {
  const { puede } = useSesion();
  const editable = puede("inventario", 2) || puede("compras", 2) || puede("costeo", 2);
  const [nuevo, setNuevo] = useState("");
  const llave = ["articulo_codigos", articuloId];
  const codigos = useQuery({
    queryKey: llave,
    queryFn: () => q<Codigo[]>(supabase.from("articulo_codigos").select("id, codigo").eq("articulo_id", articuloId).order("id")),
  });
  const agregar = useAccion((codigo: string) => q(supabase.from("articulo_codigos").insert({ articulo_id: articuloId, codigo })), {
    exito: "Código ligado al artículo", invalidar: [llave], alTerminar: () => setNuevo(""),
  });
  const quitar = useAccion((id: number) => q(supabase.from("articulo_codigos").delete().eq("id", id)), { exito: "Código quitado", invalidar: [llave] });
  return (
    <section>
      <h3 className="etiqueta mb-2 flex items-center gap-1.5" data-explain={GLOSARIO.codigosDeBarras} data-explain-title="Códigos de barras">
        <ScanBarcode className="h-3.5 w-3.5" />Códigos de barras
      </h3>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center rounded-full border border-borde px-2.5 py-1 text-xs cifra text-tenue"
          data-explain={GLOSARIO.claveComoCodigo} data-explain-title="La clave también se lee">{clave}</span>
        {(codigos.data ?? []).map((c) => (
          <span key={c.id} className="inline-flex items-center gap-1 rounded-full border border-borde bg-fondo pl-2.5 pr-1 py-0.5 text-xs cifra">
            {c.codigo}
            {editable && (
              <button type="button" onClick={() => quitar.mutate(c.id)} disabled={quitar.isPending} aria-label={`Quitar el código ${c.codigo}`}
                className="rounded-full p-0.5 text-tenue hover:bg-superficie hover:text-peligro"><X className="h-3 w-3" /></button>
            )}
          </span>
        ))}
      </div>
      {editable && (
        <form className="mt-2" onSubmit={(e) => { e.preventDefault(); const c = nuevo.trim(); if (c.length >= 3 && !agregar.isPending) agregar.mutate(c); }}>
          <input className="campo" data-lector value={nuevo} onChange={(e) => setNuevo(e.target.value)}
            placeholder="Pon el cursor aquí y lee el código del empaque (o escríbelo y da Enter)" aria-label="Código de barras nuevo" />
        </form>
      )}
    </section>
  );
}

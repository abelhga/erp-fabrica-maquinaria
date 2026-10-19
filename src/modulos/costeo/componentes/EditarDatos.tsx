import { useEffect, useState, type FormEvent } from "react";
import { Pencil } from "lucide-react";
import { Dialogo } from "@/components/ui/dialogo";
import { Boton } from "@/components/ui/boton";
import { Campo, Entrada, Seleccion } from "@/components/ui/campo";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { useTiposEquipo, type ArticuloCatalogo } from "./comun";

/**
 * Nombre, tipo de equipo y descripción de un equipo o subensamble. Los componentes ya se
 * editan en su ficha, campo por campo; los fabricados no tenían dónde. El nombre nuevo sale
 * en las cotizaciones nuevas: las que ya existen conservan el texto con el que se hicieron.
 */
export function EditarDatos({ a }: { a: ArticuloCatalogo }) {
  const tipos = useTiposEquipo();
  const [abierto, setAbierto] = useState(false);
  const [f, setF] = useState({ nombre: a.nombre, categoria: a.categoria_id ? String(a.categoria_id) : "", descripcion: a.descripcion ?? "" });
  useEffect(() => { if (abierto) setF({ nombre: a.nombre, categoria: a.categoria_id ? String(a.categoria_id) : "", descripcion: a.descripcion ?? "" }); }, [abierto, a]);
  const guardar = useAccion(() => q(supabase.from("articulos").update({
    nombre: f.nombre.trim(), descripcion: f.descripcion.trim() || null,
    ...(a.tipo === "equipo" ? { categoria_id: f.categoria ? Number(f.categoria) : null } : {}),
  }).eq("id", a.id).select("id").single()), { exito: "Datos guardados", invalidar: [["costeo"]], alTerminar: () => setAbierto(false) });
  const enviar = (e: FormEvent) => { e.preventDefault(); if (f.nombre.trim()) guardar.mutate(undefined); };
  const cambiaTipo = a.tipo === "equipo" && (f.categoria || null) !== (a.categoria_id ? String(a.categoria_id) : null);

  return (
    <>
      <Boton variante="secundario" onClick={() => setAbierto(true)}><Pencil className="h-4 w-4" /> Editar datos</Boton>
      <Dialogo abierto={abierto} alCambiar={setAbierto} titulo={`Datos de ${a.clave}`}
        descripcion="Las cotizaciones y pedidos que ya existen conservan el nombre con el que se hicieron."
        pie={<><Boton variante="secundario" onClick={() => setAbierto(false)}>Cancelar</Boton>
          <Boton onClick={() => guardar.mutate(undefined)} cargando={guardar.isPending} disabled={!f.nombre.trim()}>Guardar</Boton></>}>
        <form className="grid gap-3" onSubmit={enviar}>
          <Campo etiqueta="Nombre"><Entrada value={f.nombre} autoFocus onChange={(e) => setF({ ...f, nombre: e.target.value })} /></Campo>
          {a.tipo === "equipo" && (
            <Campo etiqueta="Tipo de equipo" ayuda={cambiaTipo ? "Al cambiar el tipo, el precio de lista se vuelve a calcular con la política de ese tipo." : undefined}>
              <Seleccion value={f.categoria} onChange={(e) => setF({ ...f, categoria: e.target.value })}>
                <option value="">OTRO (política por defecto)</option>
                {tipos.data?.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </Seleccion>
            </Campo>
          )}
          <Campo etiqueta="Descripción" ayuda="Sale en la cotización debajo del nombre: una viñeta por renglón.">
            <textarea className="campo min-h-24 py-2" value={f.descripcion} onChange={(e) => setF({ ...f, descripcion: e.target.value })} />
          </Campo>
          <button type="submit" className="hidden" />
        </form>
      </Dialogo>
    </>
  );
}

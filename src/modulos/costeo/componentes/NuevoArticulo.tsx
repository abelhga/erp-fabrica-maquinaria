import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialogo } from "@/components/ui/dialogo";
import { Boton } from "@/components/ui/boton";
import { Campo, Entrada, Seleccion } from "@/components/ui/campo";
import { supabase } from "@/lib/supabase";
import { mensajeError } from "@/lib/consultas";
import { useSesion } from "@/lib/sesion";
import { leerNumero, rutaArticulo, useTiposEquipo, type TipoArticulo } from "./comun";

const UNIDADES = ["pieza", "metro", "kilo", "litro", "juego", "tramo", "m2", "caja", "carga", "rollo", "servicio", "horas"];

/**
 * Alta corta: lo mínimo para que el artículo exista (clave, nombre y lo que
 * define su precio). El resto se completa en su ficha, donde cada campo se
 * guarda solo. La clave llega sugerida con el siguiente número del prefijo
 * que ya se usa para ese tipo.
 */
export function NuevoArticulo({ abierto, alCambiar, tipo }: {
  abierto: boolean; alCambiar: (v: boolean) => void; tipo: "componente" | "equipo" | "subensamble";
}) {
  const { puede } = useSesion();
  const ir = useNavigate();
  const qc = useQueryClient();
  const tipos = useTiposEquipo();
  const [clave, setClave] = useState("");
  const [nombre, setNombre] = useState("");
  const [subtipo, setSubtipo] = useState<TipoArticulo>("componente");
  const [unidad, setUnidad] = useState("pieza");
  const [categoria, setCategoria] = useState<string>("");
  const [medida, setMedida] = useState(false);
  const [costo, setCosto] = useState("");
  const [moneda, setMoneda] = useState<"MXN" | "USD" | "EUR">("MXN");
  const [guardando, setGuardando] = useState(false);
  const real: TipoArticulo = tipo === "componente" ? subtipo : tipo;

  useEffect(() => {
    if (!abierto) return;
    setNombre(""); setCosto(""); setMedida(false); setCategoria(""); setUnidad(tipo === "componente" ? "pieza" : "pieza");
    supabase.rpc("sugerir_clave", { p_tipo: real }).then(({ data }) => setClave((data as string) ?? ""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, real]);

  async function crear(e: FormEvent) {
    e.preventDefault();
    if (!clave.trim() || !nombre.trim()) { toast.error("Falta la clave o el nombre."); return; }
    setGuardando(true);
    try {
      const { data, error } = await supabase.from("articulos").insert({
        clave: clave.trim(), nombre: nombre.trim(), tipo: real, unidad: real === "servicio" ? "servicio" : unidad,
        categoria_id: categoria ? Number(categoria) : null, medida_especial: medida,
        controla_inventario: real === "componente" || real === "materia_prima",
      }).select("id").single();
      if (error) throw error;
      const n = leerNumero(costo);
      if (n != null && puede("costos", 2)) {
        const r = await supabase.rpc("actualizar_costos", { p_cambios: [{ articulo_id: data.id, costo: n, moneda }] });
        if (r.error) toast.error(`Se creó, pero el costo no se guardó: ${mensajeError(r.error)}`);
      }
      toast.success(`${clave.trim()} dado de alta.`);
      qc.invalidateQueries({ queryKey: ["costeo"] });
      alCambiar(false);
      ir(rutaArticulo({ id: data.id, tipo: real }) + (real === "equipo" || real === "subensamble" ? "?pestana=lista" : ""));
    } catch (err) {
      toast.error(mensajeError(err));
    } finally {
      setGuardando(false);
    }
  }

  const titulo = tipo === "componente" ? "Nuevo componente" : tipo === "equipo" ? "Nuevo equipo" : "Nuevo subensamble";
  const ayuda = tipo === "equipo"
    ? "Después le agregas su lista de materiales y sus horas. Si se parece a uno que ya existe, mejor ábrelo y usa «Duplicar con otros parámetros»."
    : tipo === "subensamble"
      ? "Un subensamble se arma una vez y se usa en muchos equipos: si cambia una pieza, cambian todos."
      : "Lo que se compra. El precio de lista sale del costo con la política de su tipo.";

  return (
    <Dialogo abierto={abierto} alCambiar={alCambiar} titulo={titulo} descripcion={ayuda}
      pie={<>
        <Boton variante="secundario" type="button" onClick={() => alCambiar(false)}>Cancelar</Boton>
        <Boton type="submit" form="nuevo-articulo" cargando={guardando}>Crear y abrir</Boton>
      </>}>
      <form id="nuevo-articulo" onSubmit={crear} className="grid gap-4 sm:grid-cols-[140px_1fr]">
        <Campo etiqueta="Clave"><Entrada value={clave} onChange={(e) => setClave(e.target.value)} className="cifra" /></Campo>
        <Campo etiqueta="Nombre">
          <Entrada autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)}
            placeholder={tipo === "equipo" ? 'Banda transportadora 18" x 20 m' : tipo === "subensamble" ? 'Cabezal motriz 18"' : "Chumacera de piso 1 7/16\" UCP-207"} />
        </Campo>
        {tipo === "componente" && (
          <>
            <Campo etiqueta="Tipo">
              <Seleccion value={subtipo} onChange={(e) => setSubtipo(e.target.value as TipoArticulo)}>
                <option value="componente">Componente</option>
                <option value="materia_prima">Materia prima</option>
                <option value="servicio">Servicio</option>
              </Seleccion>
            </Campo>
            <Campo etiqueta="Unidad">
              <Entrada list="unidades-costeo" value={subtipo === "servicio" ? "servicio" : unidad} disabled={subtipo === "servicio"}
                onChange={(e) => setUnidad(e.target.value)} />
              <datalist id="unidades-costeo">{UNIDADES.map((u) => <option key={u} value={u} />)}</datalist>
            </Campo>
            {puede("costos", 2) && (
              <>
                <Campo etiqueta="Moneda">
                  <Seleccion value={moneda} onChange={(e) => setMoneda(e.target.value as "MXN")}>
                    <option>MXN</option><option>USD</option><option>EUR</option>
                  </Seleccion>
                </Campo>
                <Campo etiqueta="Costo (opcional)" ayuda="Sin IVA, por unidad. Queda en su historial.">
                  <Entrada inputMode="decimal" value={costo} onChange={(e) => setCosto(e.target.value)} placeholder="0.00" className="cifra" />
                </Campo>
              </>
            )}
          </>
        )}
        {tipo === "equipo" && (
          <>
            <Campo etiqueta="Tipo de equipo" className="sm:col-span-2" ayuda="Define su política de utilidad y recargos (pestaña Márgenes).">
              <Seleccion value={categoria} onChange={(e) => setCategoria(e.target.value)}>
                <option value="">OTRO (política por defecto)</option>
                {tipos.data?.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </Seleccion>
            </Campo>
            <label className="sm:col-span-2 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={medida} onChange={(e) => setMedida(e.target.checked)} className="h-4 w-4 accent-[hsl(var(--marca))]" />
              Medida especial (suma el recargo de medida especial de su política)
            </label>
          </>
        )}
      </form>
    </Dialogo>
  );
}

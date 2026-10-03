import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import { Dialogo } from "@/components/ui/dialogo";
import { Boton } from "@/components/ui/boton";
import { Campo, Entrada } from "@/components/ui/campo";
import { supabase } from "@/lib/supabase";
import { mensajeError, q } from "@/lib/consultas";
import { cant, leerNumero, type ArticuloCatalogo, type Parametro } from "./comun";

/** Si el nombre trae el valor del parámetro ("x 20 m"), la copia propone el nuevo ("x 22 m"). */
function nombreSugerido(nombre: string, parametros: Parametro[], valores: Record<string, string>) {
  let n = nombre;
  for (const p of parametros) {
    const nuevo = leerNumero(valores[p.nombre] ?? "");
    if (nuevo == null || nuevo === Number(p.valor)) continue;
    const viejo = cant(Number(p.valor));
    n = n.replace(new RegExp(`(^|[^\\d.,])${viejo.replace(/[.,]/g, "\\$&")}(?![\\d])`), `$1${cant(nuevo)}`);
  }
  return n;
}

/**
 * "Una banda de 20 m pero se necesita una de 22 m": se copia con su lista,
 * horas y parámetros, cambiando los parámetros que se quiera. Los
 * subensambles no se copian, se siguen compartiendo. Al terminar abre la copia
 * y ahí se ve cuánto cambió el costo y el precio contra el original.
 */
export function DialogoDuplicar({ abierto, alCambiar, articulo, parametros }: {
  abierto: boolean; alCambiar: (v: boolean) => void; articulo: ArticuloCatalogo; parametros: Parametro[];
}) {
  const ir = useNavigate();
  const qc = useQueryClient();
  const [clave, setClave] = useState("");
  const [nombre, setNombre] = useState("");
  const [nombreTocado, setNombreTocado] = useState(false);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    setValores(Object.fromEntries(parametros.map((p) => [p.nombre, cant(Number(p.valor)).replace(/,/g, "")])));
    setNombre(`${articulo.nombre} (copia)`);
    setNombreTocado(false);
    supabase.rpc("sugerir_clave", { p_tipo: articulo.tipo }).then(({ data }) => setClave((data as string) ?? ""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);

  function cambiarValor(p: string, v: string) {
    const nuevos = { ...valores, [p]: v };
    setValores(nuevos);
    if (!nombreTocado) {
      const s = nombreSugerido(articulo.nombre, parametros, nuevos);
      setNombre(s === articulo.nombre ? `${articulo.nombre} (copia)` : s);
    }
  }

  async function duplicar(e: FormEvent) {
    e.preventDefault();
    const cambios: Record<string, number> = {};
    for (const p of parametros) {
      const n = leerNumero(valores[p.nombre] ?? "");
      if (n == null) { toast.error(`Falta el valor de ${p.nombre}.`); return; }
      if (n !== Number(p.valor)) cambios[p.nombre] = n;
    }
    setGuardando(true);
    try {
      const nuevo = await q<string>(supabase.rpc("duplicar_articulo", { p_origen: articulo.id, p_clave: clave.trim(), p_nombre: nombre.trim(), p_parametros: cambios }));
      toast.success(`${clave.trim()} creado a partir de ${articulo.clave}.`);
      await qc.invalidateQueries({ queryKey: ["costeo"] });
      alCambiar(false);
      ir(`/costeo/equipos/${nuevo}`, { state: { origen: articulo.id } });
    } catch (err) { toast.error(mensajeError(err)); } finally { setGuardando(false); }
  }

  return (
    <Dialogo abierto={abierto} alCambiar={alCambiar} titulo="Duplicar con otros parámetros" ancho="max-w-xl"
      descripcion={<>Copia <b className="text-texto">{articulo.clave}</b> con su lista de materiales, horas y parámetros. Los subensambles no se copian: se siguen compartiendo.</>}
      pie={<>
        <Boton variante="secundario" type="button" onClick={() => alCambiar(false)}>Cancelar</Boton>
        <Boton type="submit" form="duplicar" cargando={guardando}><Copy className="h-4 w-4" /> Duplicar y abrir</Boton>
      </>}>
      <form id="duplicar" onSubmit={duplicar} className="space-y-4">
        {parametros.length > 0 ? (
          <div className="rounded-lg border border-borde p-3 space-y-2">
            <p className="etiqueta">Parámetros de la copia</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {parametros.map((p, k) => (
                <Campo key={p.nombre} etiqueta={p.descripcion ?? p.nombre} ayuda={<>Hoy: {cant(Number(p.valor))} {p.unidad} · <code>{p.nombre}</code></>}>
                  <div className="relative">
                    <Entrada autoFocus={k === 0} inputMode="decimal" className="text-right cifra pr-12" value={valores[p.nombre] ?? ""}
                      onChange={(e) => cambiarValor(p.nombre, e.target.value)} onFocus={(e) => e.currentTarget.select()} />
                    {p.unidad && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-tenue">{p.unidad}</span>}
                  </div>
                </Campo>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm rounded-lg bg-aviso-suave text-aviso px-3 py-2">
            Este {articulo.tipo} no tiene parámetros: la copia saldrá idéntica. Para que la lista cambie sola con el largo, define <code>largo_m</code> en la pestaña Parámetros.
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-[150px_1fr]">
          <Campo etiqueta="Clave"><Entrada value={clave} onChange={(e) => setClave(e.target.value)} className="cifra" /></Campo>
          <Campo etiqueta="Nombre"><Entrada value={nombre} onChange={(e) => { setNombre(e.target.value); setNombreTocado(true); }} autoFocus={!parametros.length} /></Campo>
        </div>
      </form>
    </Dialogo>
  );
}

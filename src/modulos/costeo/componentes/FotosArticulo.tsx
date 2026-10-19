import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Camera, ImageOff, Images, Link2, Loader2, Star, Trash2 } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { Entrada } from "@/components/ui/campo";
import { Insignia } from "@/components/ui/insignia";
import { Cargando, ErrorCarga, Vacio } from "@/components/ui/estados";
import { subirFoto } from "@/components/datos/SubirFoto";
import { supabase } from "@/lib/supabase";
import { mensajeError, q } from "@/lib/consultas";
import { useSesion } from "@/lib/sesion";
import { cn } from "@/lib/utilidades";
import { GLOSARIO } from "@/tutorial/glosario";

interface Foto { id: string; url: string; orden: number }

/**
 * Las fotos de un equipo o subensamble. La primera es la principal: sale en el buscador y
 * junto a la partida de la cotización; las demás salen en la hoja de fotos del PDF. Las
 * cotizaciones que ya existen se quedan con las fotos que tenían.
 */
export function FotosArticulo({ articuloId }: { articuloId: string }) {
  const { puede } = useSesion();
  const editar = puede("costeo", 2);
  const qc = useQueryClient();
  const clave = ["costeo", "fotos", articuloId];
  const fotos = useQuery({
    queryKey: clave,
    queryFn: () => q<Foto[]>(supabase.from("articulo_imagenes").select("id, url, orden").eq("articulo_id", articuloId).order("orden").order("creado_en")),
  });
  const entrada = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(0);
  const [liga, setLiga] = useState("");
  const [rotas, setRotas] = useState<Set<string>>(new Set());
  const lista = fotos.data ?? [];
  const siguiente = () => (lista.length ? Math.max(...lista.map((f) => f.orden)) + 1 : 0);

  async function hacer(fn: () => PromiseLike<{ error: { message: string } | null }>, ok?: string) {
    const { error } = await fn();
    if (error) toast.error(mensajeError(error)); else if (ok) toast.success(ok);
    // La principal cambia también la imagen del equipo (buscador, encabezado).
    qc.invalidateQueries({ queryKey: ["costeo"] });
  }
  async function subir(archivos: File[]) {
    setSubiendo(archivos.length);
    let orden = siguiente();
    for (const f of archivos) {
      try {
        const url = await subirFoto(`articulos/${articuloId}`, f);
        const o = orden++;
        await hacer(() => supabase.from("articulo_imagenes").insert({ articulo_id: articuloId, url, orden: o }));
      } catch (e) { toast.error(`${f.name}: ${mensajeError(e)}`); }
      setSubiendo((n) => n - 1);
    }
  }
  const pegar = () => {
    if (!liga.trim()) return;
    hacer(() => supabase.from("articulo_imagenes").insert({ articulo_id: articuloId, url: liga.trim(), orden: siguiente() }), "Foto agregada");
    setLiga("");
  };
  const principal = (f: Foto) => hacer(() => supabase.from("articulo_imagenes").update({ orden: Math.min(...lista.map((x) => x.orden)) - 1 }).eq("id", f.id), "Ahora es la principal");
  async function mover(i: number, d: -1 | 1) {
    const a = lista[i], b = lista[i + d];
    if (!a || !b) return;
    // Se intercambian los órdenes; si eran iguales, se separan.
    const oa = a.orden === b.orden ? b.orden + d : b.orden;
    await hacer(() => supabase.from("articulo_imagenes").update({ orden: oa }).eq("id", a.id));
    await hacer(() => supabase.from("articulo_imagenes").update({ orden: a.orden }).eq("id", b.id));
  }
  const quitar = (f: Foto) => hacer(() => supabase.from("articulo_imagenes").delete().eq("id", f.id), "Foto quitada");

  if (fotos.error) return <ErrorCarga error={fotos.error} />;
  if (fotos.isLoading) return <Cargando filas={2} />;

  return (
    <section className="space-y-3">
      {editar && (
        <div className="flex flex-wrap items-center gap-2">
          <input ref={entrada} type="file" accept="image/*" multiple hidden
            onChange={(e) => { const fs = [...(e.target.files ?? [])]; e.target.value = ""; if (fs.length) subir(fs); }} />
          <Boton onClick={() => entrada.current?.click()} cargando={subiendo > 0}>
            {subiendo > 0 ? `Subiendo ${subiendo}…` : <><Camera className="h-4 w-4" /> Subir fotos</>}</Boton>
          <div className="flex min-w-[260px] flex-1 items-center gap-2">
            <Entrada value={liga} onChange={(e) => setLiga(e.target.value)} placeholder="o pega la liga de Drive o de una imagen y Enter"
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); pegar(); } }} aria-label="Liga de la foto" />
            <Boton variante="secundario" onClick={pegar} disabled={!liga.trim()}><Link2 className="h-4 w-4" /> Agregar</Boton>
          </div>
        </div>
      )}
      {lista.length === 0 ? (
        <div className="tarjeta"><Vacio icono={Images} titulo="Este equipo no tiene fotos"
          texto={editar ? "Sube una o varias. La primera es la principal: sale junto a la partida de la cotización; las demás, en la hoja de fotos del PDF."
            : "Ingeniería las agrega; la principal sale junto a la partida de la cotización."} /></div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {lista.map((f, i) => (
            <li key={f.id} className={cn("tarjeta overflow-hidden", i === 0 && "ring-2 ring-marca/50")}>
              <div className="relative aspect-[4/3] bg-fondo">
                {rotas.has(f.id) ? (
                  <div className="flex h-full flex-col items-center justify-center gap-1 p-3 text-center text-xs text-aviso">
                    <ImageOff className="h-5 w-5" />No se pudo ver. Si es de Drive, compártela con «Cualquier persona con el enlace».</div>
                ) : <img src={f.url} alt={`Foto ${i + 1}`} className="h-full w-full object-cover" loading="lazy"
                      onError={() => setRotas((s) => new Set(s).add(f.id))} />}
                {i === 0 && <span className="absolute left-2 top-2" data-explain={GLOSARIO.fotosEquipo} data-explain-title="Foto principal">
                  <Insignia tono="marca"><Star className="h-3 w-3" /> Principal</Insignia></span>}
              </div>
              {editar && (
                <div className="flex items-center gap-1 px-2 py-1.5">
                  <button type="button" className="rounded p-1 text-tenue hover:bg-fondo hover:text-texto disabled:opacity-30" disabled={i === 0}
                    onClick={() => mover(i, -1)} aria-label="Mover antes"><ArrowLeft className="h-4 w-4" /></button>
                  <button type="button" className="rounded p-1 text-tenue hover:bg-fondo hover:text-texto disabled:opacity-30" disabled={i === lista.length - 1}
                    onClick={() => mover(i, 1)} aria-label="Mover después"><ArrowRight className="h-4 w-4" /></button>
                  {i > 0 && <button type="button" className="ml-1 text-xs text-marca-texto hover:underline" onClick={() => principal(f)}>Hacerla principal</button>}
                  <button type="button" className="ml-auto rounded p-1 text-tenue hover:bg-peligro-suave hover:text-peligro" onClick={() => quitar(f)}
                    aria-label={`Quitar foto ${i + 1}`}><Trash2 className="h-4 w-4" /></button>
                </div>
              )}
            </li>
          ))}
          {subiendo > 0 && <li className="tarjeta flex aspect-[4/3] items-center justify-center text-tenue"><Loader2 className="h-5 w-5 animate-spin" /></li>}
        </ul>
      )}
      {lista.length > 0 && <p className="text-xs text-tenue">La principal sale junto a la partida de la cotización; las demás, en la hoja de fotos al final del PDF. Las cotizaciones ya hechas se quedan con las fotos que tenían.</p>}
    </section>
  );
}

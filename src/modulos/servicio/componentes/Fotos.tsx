import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Camera, ImageOff, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { mensajeError, q } from "@/lib/consultas";
import { fechaYHora } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { Seleccion } from "@/components/ui/campo";
import { CLAVE, MOMENTOS, comprimirImagen, subirArchivo, useUrlsFirmadas, type Evidencia, type Momento } from "../datos";

/** Miniatura de una foto del bucket privado (con enlace firmado). */
export function Miniatura({ ruta, url, alt, className }: { ruta: string; url?: string; alt: string; className?: string }) {
  return url ? (
    <a href={url} target="_blank" rel="noreferrer" className={cn("block overflow-hidden rounded-lg border border-borde bg-fondo", className)} title="Ver en grande">
      <img src={url} alt={alt} className="h-full w-full object-cover" loading="lazy" />
    </a>
  ) : (
    <div className={cn("flex items-center justify-center rounded-lg border border-borde bg-fondo text-tenue", className)} title={ruta}>
      <ImageOff className="h-5 w-5" />
    </div>
  );
}

export function useEvidencias(filtro: { servicioId?: string; mantenimientoId?: string }) {
  return useQuery({
    queryKey: [...CLAVE, "evidencias", filtro.servicioId ?? filtro.mantenimientoId],
    enabled: !!(filtro.servicioId || filtro.mantenimientoId),
    queryFn: () => {
      let c = supabase.from("v_servicio_evidencias").select("*");
      c = filtro.servicioId ? c.eq("servicio_id", filtro.servicioId) : c.eq("mantenimiento_id", filtro.mantenimientoId!);
      return q<Evidencia[]>(c.order("en"));
    },
  });
}

/**
 * Botón grande para tomar o elegir fotos. En el celular abre la cámara. Achica cada
 * foto, la sube a la carpeta del registro y la registra como evidencia en la base
 * (que revisa que la foto exista y sea de esa carpeta).
 */
export function SubirFotos({ carpeta, servicioId, mantenimientoId, momento, nombre, texto = "Agregar fotos", alTerminar, grande, className }: {
  carpeta: string; servicioId?: string; mantenimientoId?: string; momento: Momento; nombre?: string; texto?: string;
  alTerminar?: (rutas: string[]) => void; grande?: boolean; className?: string;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(0);
  const qc = useQueryClient();

  async function elegir(archivos: FileList | null) {
    if (!archivos?.length) return;
    const lista = Array.from(archivos).slice(0, 6);
    setSubiendo(lista.length);
    const rutas: string[] = [];
    try {
      for (const a of lista) {
        const blob = await comprimirImagen(a);
        const ext = blob.type === "image/png" ? "png" : blob.type === "application/pdf" ? "pdf" : "jpg";
        const ruta = await subirArchivo(carpeta, blob, ext);
        await q(supabase.rpc("agregar_evidencia", {
          p_ruta: ruta, p_momento: momento, p_servicio: servicioId ?? null, p_mantenimiento: mantenimientoId ?? null, p_nombre: nombre ?? null,
        }));
        rutas.push(ruta);
        setSubiendo((n) => n - 1);
      }
      toast.success(rutas.length === 1 ? "Foto guardada" : `${rutas.length} fotos guardadas`);
      alTerminar?.(rutas);
    } catch (e) {
      toast.error(mensajeError(e));
    } finally {
      setSubiendo(0);
      if (entrada.current) entrada.current.value = "";
      qc.invalidateQueries({ queryKey: CLAVE });
    }
  }

  return (
    <>
      <input ref={entrada} type="file" accept="image/*" capture="environment" multiple className="sr-only" tabIndex={-1}
             onChange={(e) => elegir(e.target.files)} aria-label={texto} />
      <button type="button" onClick={() => entrada.current?.click()} disabled={subiendo > 0}
              className={cn("inline-flex items-center justify-center gap-2 rounded-lg border border-borde bg-superficie font-medium hover:bg-fondo disabled:opacity-60",
                grande ? "min-h-[56px] px-5 text-lg w-full" : "h-9 px-3 text-sm", className)}>
        {subiendo > 0 ? <Loader2 className={cn("animate-spin", grande ? "h-6 w-6" : "h-4 w-4")} /> : <Camera className={grande ? "h-6 w-6" : "h-4 w-4"} />}
        {subiendo > 0 ? `Subiendo ${subiendo}…` : texto}
      </button>
    </>
  );
}

/** Galería de evidencias agrupada por momento, con subida si se puede. */
export function GaleriaEvidencias({ servicioId, mantenimientoId, carpeta, puedeSubir, momentos, momentoInicial }: {
  servicioId?: string; mantenimientoId?: string; carpeta: string; puedeSubir: boolean; momentos: Momento[]; momentoInicial?: Momento;
}) {
  const ev = useEvidencias({ servicioId, mantenimientoId });
  const lista = (ev.data ?? []).filter((e) => e.momento !== "firma");
  const urls = useUrlsFirmadas(lista.map((e) => e.ruta));
  const [momento, setMomento] = useState<Momento>(momentoInicial ?? momentos[0]);
  const grupos = momentos.map((m) => ({ m, fotos: lista.filter((e) => e.momento === m) })).filter((g) => g.fotos.length);
  const otros = lista.filter((e) => !momentos.includes(e.momento));

  return (
    <div className="space-y-3">
      {ev.isLoading ? <p className="text-sm text-tenue">Cargando fotos…</p> : lista.length === 0 ? (
        <p className="text-sm text-tenue">
          Sin fotos todavía. {puedeSubir ? "Toma fotos del equipo: son la evidencia si después hay un reclamo." : ""}
        </p>
      ) : (
        [...grupos, ...(otros.length ? [{ m: "otros" as const, fotos: otros }] : [])].map((g) => (
          <div key={g.m}>
            <p className="etiqueta mb-1.5">{g.m === "otros" ? "Otras" : MOMENTOS[g.m]} <span className="cifra">({g.fotos.length})</span></p>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {g.fotos.map((f) => (
                <figure key={f.id} className="space-y-1">
                  <Miniatura ruta={f.ruta} url={urls.data?.[f.ruta]} alt={`${MOMENTOS[f.momento]} · ${f.nota ?? ""}`} className="aspect-square" />
                  <figcaption className="text-[11px] text-tenue leading-tight truncate" title={`${f.subido_por_nombre ?? ""} · ${fechaYHora(f.en)}`}>
                    {f.nota ?? fechaYHora(f.en)}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        ))
      )}
      {puedeSubir && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {momentos.length > 1 && (
            <Seleccion className="w-auto" value={momento} onChange={(e) => setMomento(e.target.value as Momento)} aria-label="¿De qué momento es la foto?">
              {momentos.map((m) => <option key={m} value={m}>{MOMENTOS[m]}</option>)}
            </Seleccion>
          )}
          <SubirFotos carpeta={carpeta} servicioId={servicioId} mantenimientoId={mantenimientoId} momento={momento} />
        </div>
      )}
    </div>
  );
}

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Camera, FileText, ImageOff, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { mensajeError, q } from "@/lib/consultas";
import { fechaYHora } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { CLAVE, comprimirImagen, subirArchivo, useUrlsFirmadas, type Archivo, type TipoArchivo } from "./datos";

/** Miniatura de una foto (o un PDF) del bucket privado, con enlace firmado. */
export function Miniatura({ archivo, url, className }: { archivo: Pick<Archivo, "ruta" | "nota" | "en" | "subido_por_nombre">; url?: string; className?: string }) {
  const pdf = archivo.ruta.toLowerCase().endsWith(".pdf");
  const titulo = [archivo.nota, archivo.subido_por_nombre, fechaYHora(archivo.en)].filter(Boolean).join(" · ");
  if (!url) {
    return (
      <div className={cn("flex items-center justify-center rounded-lg border border-borde bg-fondo text-tenue", className)} title={titulo}>
        {pdf ? <FileText className="h-5 w-5" /> : <ImageOff className="h-5 w-5" />}
      </div>
    );
  }
  return (
    <a href={url} target="_blank" rel="noreferrer" title={titulo}
       className={cn("block overflow-hidden rounded-lg border border-borde bg-fondo hover:ring-2 hover:ring-marca/40", className)}>
      {pdf ? (
        <span className="flex h-full w-full flex-col items-center justify-center gap-1 text-marca-texto">
          <FileText className="h-7 w-7" /><span className="text-xs font-medium">PDF</span>
        </span>
      ) : <img src={url} alt={archivo.nota ?? "Foto"} className="h-full w-full object-cover" loading="lazy" />}
    </a>
  );
}

/** Rejilla de fotos con su nota y quién la tomó. */
export function Galeria({ archivos, vacio, className }: { archivos: Archivo[]; vacio?: string; className?: string }) {
  const urls = useUrlsFirmadas(archivos.map((a) => a.ruta));
  if (archivos.length === 0) return vacio ? <p className="text-sm text-tenue">{vacio}</p> : null;
  return (
    <div className={cn("grid grid-cols-3 sm:grid-cols-4 gap-2", className)}>
      {archivos.map((a) => (
        <figure key={a.id} className="space-y-1 min-w-0">
          <Miniatura archivo={a} url={urls.data?.[a.ruta]} className="aspect-square" />
          <figcaption className="text-[11px] text-tenue leading-tight truncate">{a.nota ?? fechaYHora(a.en)}</figcaption>
        </figure>
      ))}
    </div>
  );
}

/**
 * Botón para tomar o elegir fotos (en el celular abre la cámara trasera) o un PDF.
 * Achica cada foto, la sube a la carpeta del registro y la registra en la base, que
 * revisa que el archivo exista y sea de esa carpeta. Lo registrado ya no se borra.
 */
export function SubirArchivo({ tipo, envioId, devolucionId, texto, pdf, maximo = 6, grande, className, alTerminar }: {
  tipo: TipoArchivo; envioId?: string; devolucionId?: string; texto: string; pdf?: boolean; maximo?: number;
  grande?: boolean; className?: string; alTerminar?: (rutas: string[]) => void;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(0);
  const qc = useQueryClient();
  const carpeta = envioId ? `envios/${envioId}` : `devoluciones/${devolucionId}`;

  async function elegir(archivos: FileList | null) {
    if (!archivos?.length) return;
    const lista = Array.from(archivos).slice(0, Math.max(1, maximo));
    setSubiendo(lista.length);
    const rutas: string[] = [];
    try {
      for (const a of lista) {
        const esPdf = a.type === "application/pdf";
        const blob = esPdf ? a : await comprimirImagen(a);
        const ext = esPdf ? "pdf" : blob.type === "image/png" ? "png" : "jpg";
        const ruta = await subirArchivo(carpeta, blob, ext);
        // La guía se registra junto con su número (registrar_guia); lo demás, aquí.
        if (tipo !== "guia") {
          await q(supabase.rpc("agregar_archivo_envio", { p_ruta: ruta, p_tipo: tipo, p_envio: envioId ?? null, p_devolucion: devolucionId ?? null }));
        }
        rutas.push(ruta);
        setSubiendo((n) => n - 1);
      }
      if (tipo !== "guia") toast.success(rutas.length === 1 ? "Foto guardada" : `${rutas.length} fotos guardadas`);
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
      <input ref={entrada} type="file" accept={pdf ? "application/pdf,image/*" : "image/*"} capture={pdf ? undefined : "environment"}
             multiple={!pdf && maximo > 1} className="sr-only" tabIndex={-1} aria-label={texto} onChange={(e) => elegir(e.target.files)} />
      <button type="button" onClick={() => entrada.current?.click()} disabled={subiendo > 0 || maximo <= 0}
              className={cn("inline-flex items-center justify-center gap-2 rounded-lg border border-borde bg-superficie font-medium hover:bg-fondo disabled:opacity-60",
                grande ? "min-h-[56px] px-5 text-base w-full" : "h-9 px-3 text-sm", className)}>
        {subiendo > 0 ? <Loader2 className={cn("animate-spin", grande ? "h-6 w-6" : "h-4 w-4")} />
          : pdf ? <FileText className={grande ? "h-6 w-6" : "h-4 w-4"} /> : <Camera className={grande ? "h-6 w-6" : "h-4 w-4"} />}
        {subiendo > 0 ? `Subiendo ${subiendo}…` : texto}
      </button>
    </>
  );
}

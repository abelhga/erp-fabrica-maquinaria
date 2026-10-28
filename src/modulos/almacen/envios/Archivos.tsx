import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Camera, ChevronRight, EyeOff, FileText, ImageOff, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { mensajeError, q, useAccion } from "@/lib/consultas";
import { DialogoMotivo } from "@/modulos/ventas/componentes/dialogos";
import { GLOSARIO } from "@/tutorial/glosario";
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

/**
 * Rejilla de fotos con su nota y quién la tomó. Con `retirar`, cada foto trae «Retirar» (pide
 * motivo): la foto no se borra, pasa a «Retiradas» con su motivo y deja de contar. Lo retirado lo
 * ve todo el que ve la evidencia, para que quitar una foto nunca sea a escondidas.
 */
export function Galeria({ archivos, vacio, className, retirar }: { archivos: Archivo[]; vacio?: string; className?: string; retirar?: boolean }) {
  const urls = useUrlsFirmadas(archivos.map((a) => a.ruta));
  const [quitar, setQuitar] = useState<Archivo | null>(null);
  const [verRetiradas, setVerRetiradas] = useState(false);
  const accion = useAccion((m: string) => q(supabase.rpc("retirar_evidencia", { p_evidencia: quitar!.id, p_motivo: m })),
    { exito: "Foto retirada: queda en «Retiradas» con su motivo", invalidar: [CLAVE], alTerminar: () => setQuitar(null) });
  const vivas = archivos.filter((a) => !a.retirada), retiradas = archivos.filter((a) => a.retirada);
  if (archivos.length === 0) return vacio ? <p className="text-sm text-tenue">{vacio}</p> : null;
  return (
    <div className={cn("space-y-2", className)}>
      {vivas.length === 0 ? vacio && <p className="text-sm text-tenue">{vacio}</p> : (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {vivas.map((a) => (
            <figure key={a.id} className="space-y-1 min-w-0">
              <Miniatura archivo={a} url={urls.data?.[a.ruta]} className="aspect-square" />
              <figcaption className="flex items-center gap-1 text-[11px] text-tenue leading-tight min-w-0">
                <span className="truncate flex-1">{a.nota ?? fechaYHora(a.en)}</span>
                {retirar && a.tipo !== "guia" && (
                  <button type="button" onClick={() => setQuitar(a)} data-explain={GLOSARIO.fotoRetirada} data-explain-title="Retirar foto"
                    className="shrink-0 inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-tenue hover:text-peligro hover:bg-peligro-suave">
                    <EyeOff className="h-3 w-3" />Retirar</button>
                )}
              </figcaption>
            </figure>
          ))}
        </div>
      )}
      {retiradas.length > 0 && (
        <div className="text-xs">
          <button type="button" onClick={() => setVerRetiradas((v) => !v)} data-explain={GLOSARIO.fotoRetirada} data-explain-title="Retiradas"
            className="inline-flex items-center gap-1 text-tenue hover:text-texto">
            <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", verRetiradas && "rotate-90")} />
            Retiradas ({retiradas.length}): no cuentan como evidencia
          </button>
          {verRetiradas && (
            <ul className="mt-2 space-y-2">
              {retiradas.map((a) => (
                <li key={a.id} className="flex items-start gap-3">
                  <Miniatura archivo={a} url={urls.data?.[a.ruta]} className="h-14 w-14 shrink-0 opacity-50 grayscale" />
                  <span className="text-tenue">
                    <b className="text-texto font-medium">«{a.motivo_retiro}»</b>
                    <span className="block">Retiró {a.retirada_por_nombre ?? "—"} · {fechaYHora(a.retirada_en)} · la subió {a.subido_por_nombre ?? "—"} · {fechaYHora(a.en)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <DialogoMotivo abierto={!!quitar} alCambiar={(v) => !v && setQuitar(null)} titulo="Retirar esta foto"
        descripcion="No se borra: queda en «Retiradas» con tu motivo, tu nombre y la hora, y deja de contar como evidencia. Si ya se empacó, sube primero la foto correcta."
        sugerencias={["Era de otro paquete", "Foto equivocada", "Está duplicada", "Salió borrosa"]}
        textoBoton="Retirar foto" cargando={accion.isPending} alConfirmar={(m) => accion.mutate(m)} />
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

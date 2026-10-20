import { useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utilidades";

/**
 * Sube una foto al catálogo del ERP y devuelve su liga pública. Público porque la foto
 * sale en el PDF que recibe el cliente; quién puede subir lo decide la base por carpeta
 * ("articulos/…" quien edita artículos, "cotizaciones/…" quien captura ventas).
 */
export async function subirFoto(carpeta: string, archivo: File): Promise<string> {
  const ruta = await subirImagen("catalogo", carpeta, archivo);
  return supabase.storage.from("catalogo").getPublicUrl(ruta).data.publicUrl;
}

/** Revisa y sube una imagen a un bucket; regresa su ruta dentro del bucket. */
export async function subirImagen(bucket: string, carpeta: string, archivo: File): Promise<string> {
  if (!archivo.type.startsWith("image/")) throw new Error("Eso no es una imagen: sube un JPG, PNG o WEBP.");
  if (archivo.size > 5 * 1024 * 1024) throw new Error("La foto pesa más de 5 MB: tómala con menos resolución o recórtala.");
  const ext = (archivo.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "jpg";
  const ruta = `${carpeta}/${crypto.randomUUID().slice(0, 12)}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(ruta, archivo, { contentType: archivo.type, cacheControl: "31536000" });
  if (error) throw new Error(/row-level|policy|unauthorized|403/i.test(error.message) ? "Tu rol no puede subir fotos aquí." : error.message);
  return ruta;
}

/** Botón "Subir foto": en el celular abre la cámara o la galería. */
export function BotonSubirFoto({ carpeta, alSubir, className, texto = "Subir foto", subir = subirFoto }: {
  carpeta: string; alSubir: (url: string) => void; className?: string; texto?: string;
  /** Otro destino (p. ej. el bucket privado del personal); por omisión, el catálogo público. */
  subir?: (carpeta: string, archivo: File) => Promise<string>;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  return (
    <>
      <input ref={entrada} type="file" accept="image/*" hidden onChange={async (e) => {
        const f = e.target.files?.[0];
        e.target.value = "";
        if (!f) return;
        setSubiendo(true);
        try { alSubir(await subir(carpeta, f)); } catch (err) { toast.error(err instanceof Error ? err.message : String(err)); } finally { setSubiendo(false); }
      }} />
      <button type="button" onClick={() => entrada.current?.click()} aria-busy={subiendo}
        className={cn("inline-flex items-center gap-1.5 text-sm text-marca-texto font-medium hover:underline whitespace-nowrap", className)}>
        {subiendo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}{subiendo ? "Subiendo…" : texto}
      </button>
    </>
  );
}

import { useState } from "react";
import { Image as ImagenIcono } from "lucide-react";
import { cn } from "@/lib/utilidades";

/**
 * Foto de catálogo que no se rompe: muchas ligas vienen de la hoja (Wix,
 * Google Drive) y algunas ya no existen. Si no carga, queda el recuadro.
 */
export function Imagen({ src, className, alt = "" }: { src: string | null | undefined; className?: string; alt?: string }) {
  const [rota, setRota] = useState(false);
  if (!src || rota) {
    return (
      <div className={cn("rounded-lg border border-dashed border-borde bg-fondo flex items-center justify-center text-tenue", className)}>
        <ImagenIcono className="h-4 w-4" />
      </div>
    );
  }
  return <img src={src} alt={alt} loading="lazy" onError={() => setRota(true)} className={cn("rounded-lg object-cover bg-fondo border border-borde", className)} />;
}

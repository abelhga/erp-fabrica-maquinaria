import * as D from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utilidades";

/** Ventana modal centrada. `ancho` en clases de Tailwind para formularios largos. */
export function Dialogo({ abierto, alCambiar, titulo, descripcion, children, pie, ancho = "max-w-lg" }: {
  abierto: boolean; alCambiar: (v: boolean) => void; titulo: ReactNode; descripcion?: ReactNode;
  children: ReactNode; pie?: ReactNode; ancho?: string;
}) {
  return (
    <D.Root open={abierto} onOpenChange={alCambiar}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-in" />
        <D.Content
          className={cn("fixed left-1/2 top-[8vh] z-50 w-[calc(100%-2rem)] -translate-x-1/2 tarjeta shadow-2xl max-h-[84vh] flex flex-col", ancho)}
        >
          <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-3 border-b border-borde">
            <div>
              <D.Title className="text-lg font-semibold">{titulo}</D.Title>
              {descripcion && <D.Description className="text-sm text-tenue mt-1">{descripcion}</D.Description>}
            </div>
            <D.Close className="rounded-md p-1 text-tenue hover:bg-fondo" aria-label="Cerrar"><X className="h-5 w-5" /></D.Close>
          </div>
          <div className="px-5 py-4 overflow-y-auto">{children}</div>
          {pie && <div className="px-5 py-3 border-t border-borde flex justify-end gap-2 bg-fondo/50 rounded-b-xl">{pie}</div>}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

/** Panel lateral para ver el detalle de un registro sin perder la lista de fondo. */
export function Lateral({ abierto, alCambiar, titulo, subtitulo, children, acciones, ancho = "max-w-2xl" }: {
  abierto: boolean; alCambiar: (v: boolean) => void; titulo: ReactNode; subtitulo?: ReactNode;
  children: ReactNode; acciones?: ReactNode; ancho?: string;
}) {
  return (
    <D.Root open={abierto} onOpenChange={alCambiar}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-40 bg-black/30" />
        <D.Content className={cn("fixed right-0 top-0 z-50 h-full w-full bg-superficie border-l border-borde shadow-2xl flex flex-col", ancho)}>
          <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-borde">
            <div className="min-w-0">
              <D.Title className="text-lg font-semibold truncate">{titulo}</D.Title>
              {subtitulo && <D.Description asChild><div className="text-sm text-tenue mt-0.5">{subtitulo}</div></D.Description>}
            </div>
            <div className="flex items-center gap-2">
              {acciones}
              <D.Close className="rounded-md p-1 text-tenue hover:bg-fondo" aria-label="Cerrar"><X className="h-5 w-5" /></D.Close>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

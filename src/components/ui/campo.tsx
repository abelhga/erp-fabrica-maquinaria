import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utilidades";

export const Entrada = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...p }, ref) => (
  <input ref={ref} className={cn("campo", className)} {...p} />
));
Entrada.displayName = "Entrada";

export const AreaTexto = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...p }, ref) => (
  <textarea ref={ref} className={cn("campo h-auto min-h-[80px] py-2", className)} {...p} />
));
AreaTexto.displayName = "AreaTexto";

export const Seleccion = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(({ className, children, ...p }, ref) => (
  <select ref={ref} className={cn("campo pr-8", className)} {...p}>
    {children}
  </select>
));
Seleccion.displayName = "Seleccion";

export function Campo({ etiqueta, ayuda, error, children, className }: {
  etiqueta: string; ayuda?: ReactNode; error?: string; children: ReactNode; className?: string;
}) {
  return (
    <label className={cn("block space-y-1.5", className)}>
      <span className="text-sm font-medium">{etiqueta}</span>
      {children}
      {error ? <span className="block text-xs text-peligro">{error}</span> : ayuda ? <span className="block text-xs text-tenue">{ayuda}</span> : null}
    </label>
  );
}

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utilidades";

const estilos = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca/50 disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap",
  {
    variants: {
      variante: {
        primario: "bg-marca text-white hover:bg-marca/90 shadow-sm",
        secundario: "bg-superficie border border-borde hover:bg-fondo text-texto",
        fantasma: "hover:bg-fondo text-texto",
        peligro: "bg-peligro text-white hover:bg-peligro/90",
        exito: "bg-ok text-white hover:bg-ok/90",
      },
      tamano: { sm: "h-8 px-3 text-xs", md: "h-9 px-4", lg: "h-11 px-5 text-base", icono: "h-9 w-9" },
    },
    defaultVariants: { variante: "primario", tamano: "md" },
  },
);

type Props = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof estilos> & { asChild?: boolean; cargando?: boolean };

export const Boton = forwardRef<HTMLButtonElement, Props>(
  ({ className, variante, tamano, asChild, cargando, children, disabled, ...props }, ref) => {
    const C = asChild ? Slot : "button";
    return (
      <C ref={ref} className={cn(estilos({ variante, tamano }), className)} disabled={disabled || cargando} {...props}>
        {cargando && <Loader2 className="h-4 w-4 animate-spin" />}
        {children}
      </C>
    );
  },
);
Boton.displayName = "Boton";

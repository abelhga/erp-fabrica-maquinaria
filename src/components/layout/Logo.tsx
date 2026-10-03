import { cn } from "@/lib/utilidades";

/** Engrane azul + HEGAMEX, igual que el logo de la marca, en SVG para que no se pixele en la TV. */
export function Logo({ className, grande }: { className?: string; grande?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2 select-none", className)}>
      <svg viewBox="0 0 24 24" className={grande ? "h-10 w-10" : "h-7 w-7"} aria-hidden>
        <path fill="#0a74ff" d="M10.6 1.5h2.8c.4 0 .7.3.7.7v1.6c.8.2 1.5.5 2.2.9l1.1-1.1c.3-.3.7-.3 1 0l2 2c.3.3.3.7 0 1l-1.1 1.1c.4.7.7 1.4.9 2.2h1.6c.4 0 .7.3.7.7v2.8c0 .4-.3.7-.7.7h-1.6c-.2.8-.5 1.5-.9 2.2l1.1 1.1c.3.3.3.7 0 1l-2 2c-.3.3-.7.3-1 0l-1.1-1.1c-.7.4-1.4.7-2.2.9v1.6c0 .4-.3.7-.7.7h-2.8c-.4 0-.7-.3-.7-.7v-1.6c-.8-.2-1.5-.5-2.2-.9l-1.1 1.1c-.3.3-.7.3-1 0l-2-2c-.3-.3-.3-.7 0-1l1.1-1.1c-.4-.7-.7-1.4-.9-2.2H2.2c-.4 0-.7-.3-.7-.7v-2.8c0-.4.3-.7.7-.7h1.6c.2-.8.5-1.5.9-2.2L3.6 6.7c-.3-.3-.3-.7 0-1l2-2c.3-.3.7-.3 1 0l1.1 1.1c.7-.4 1.4-.7 2.2-.9V2.2c0-.4.3-.7.7-.7ZM12 8.4a3.6 3.6 0 1 0 0 7.2 3.6 3.6 0 0 0 0-7.2Z" />
      </svg>
      <span className={cn("font-bold tracking-[0.18em]", grande ? "text-3xl" : "text-lg")}>HEGAMEX</span>
    </div>
  );
}

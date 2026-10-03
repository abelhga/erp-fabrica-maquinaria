import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { cn } from "@/lib/utilidades";
import { cant, leerNumero } from "./comun";

/**
 * Celdas de captura "como hoja de cálculo": se ven como texto, al enfocarlas se
 * editan; Enter guarda y baja a la misma columna de la fila siguiente, Tab
 * avanza, Esc deshace. Solo se guarda si el valor cambió.
 */
const base =
  "h-7 w-full rounded-md border border-transparent bg-transparent px-1.5 text-sm outline-none transition " +
  "hover:border-borde focus:border-marca focus:bg-superficie focus:ring-2 focus:ring-marca/30 disabled:hover:border-transparent disabled:opacity-100";

function bajar(e: KeyboardEvent<HTMLInputElement>, arriba = false) {
  const actual = e.currentTarget;
  const col = actual.dataset.col;
  if (!col) return false;
  const todas = Array.from(document.querySelectorAll<HTMLInputElement>(`input[data-col="${col}"]:not([disabled])`));
  const i = todas.indexOf(actual);
  const sig = todas[arriba ? i - 1 : i + 1];
  if (sig) { sig.focus(); sig.select(); return true; }
  return false;
}

export function CeldaNumero({ valor, alGuardar, col, porcentaje, deshabilitado, className, placeholder, autoFocus, etiqueta, vacioEsNull }: {
  valor: number | null | undefined; alGuardar: (v: number | null) => void; col?: string; porcentaje?: boolean;
  deshabilitado?: boolean; className?: string; placeholder?: string; autoFocus?: boolean; etiqueta?: string; vacioEsNull?: boolean;
}) {
  const mostrar = (v: number | null | undefined) => (v == null ? "" : porcentaje ? cant(Math.round(v * 1e6) / 1e4) : cant(v)).replace(/,/g, "");
  const [texto, setTexto] = useState(mostrar(valor));
  const [enfocada, setEnfocada] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (!enfocada) setTexto(mostrar(valor)); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [valor, enfocada]);
  useEffect(() => { if (autoFocus) { ref.current?.focus(); ref.current?.select(); } }, [autoFocus]);

  function guardar() {
    const n = leerNumero(texto);
    const nuevo = n == null ? (vacioEsNull ? null : 0) : porcentaje ? n / 100 : n;
    const antes = valor ?? (vacioEsNull ? null : 0);
    if (nuevo !== antes && !(nuevo != null && antes != null && Math.abs(nuevo - antes) < 1e-9)) alGuardar(nuevo);
    else setTexto(mostrar(valor));
  }

  return (
    <input
      ref={ref} data-col={col} disabled={deshabilitado} inputMode="decimal" aria-label={etiqueta} placeholder={placeholder}
      className={cn(base, "text-right cifra", className)} value={texto}
      onChange={(e) => setTexto(e.target.value)}
      onFocus={(e) => { setEnfocada(true); e.currentTarget.select(); }}
      onBlur={() => { setEnfocada(false); guardar(); }}
      onKeyDown={(e) => {
        if (e.key === "Enter") { e.preventDefault(); if (!bajar(e, e.shiftKey)) e.currentTarget.blur(); }
        else if (e.key === "Escape") { setTexto(mostrar(valor)); setTimeout(() => ref.current?.blur(), 0); }
        else if (e.key === "ArrowDown" && col) { e.preventDefault(); bajar(e); }
        else if (e.key === "ArrowUp" && col) { e.preventDefault(); bajar(e, true); }
      }}
    />
  );
}

export function CeldaTexto({ valor, alGuardar, col, deshabilitado, className, placeholder, etiqueta, lista }: {
  valor: string | null | undefined; alGuardar: (v: string | null) => void; col?: string; deshabilitado?: boolean;
  className?: string; placeholder?: string; etiqueta?: string; lista?: string;
}) {
  const [texto, setTexto] = useState(valor ?? "");
  const [enfocada, setEnfocada] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (!enfocada) setTexto(valor ?? ""); }, [valor, enfocada]);

  return (
    <input
      ref={ref} data-col={col} disabled={deshabilitado} aria-label={etiqueta} placeholder={placeholder} list={lista}
      className={cn(base, className)} value={texto}
      onChange={(e) => setTexto(e.target.value)}
      onFocus={() => setEnfocada(true)}
      onBlur={() => {
        setEnfocada(false);
        const nuevo = texto.trim() || null;
        if (nuevo !== (valor ?? null)) alGuardar(nuevo);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") { e.preventDefault(); if (!bajar(e, e.shiftKey)) e.currentTarget.blur(); }
        else if (e.key === "Escape") { setTexto(valor ?? ""); setTimeout(() => ref.current?.blur(), 0); }
      }}
    />
  );
}

/** Casilla para valores sí/no dentro de una tabla. */
export function CeldaCasilla({ valor, alCambiar, deshabilitado, etiqueta }: {
  valor: boolean; alCambiar: (v: boolean) => void; deshabilitado?: boolean; etiqueta: string;
}) {
  return (
    <input type="checkbox" aria-label={etiqueta} title={etiqueta} checked={valor} disabled={deshabilitado}
      onChange={(e) => alCambiar(e.target.checked)} className="h-4 w-4 accent-[hsl(var(--marca))] cursor-pointer disabled:cursor-default" />
  );
}

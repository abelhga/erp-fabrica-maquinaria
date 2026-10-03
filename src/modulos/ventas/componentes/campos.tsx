import { forwardRef, useEffect, useState, type KeyboardEvent, type ReactNode } from "react";
import * as M from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/utilidades";

const fmt = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 4 });

/**
 * Número que se escribe como en la hoja: acepta "1,250.5", "15%", "$900".
 * Mientras tiene el foco guarda el texto tal cual (para poder escribir "1.");
 * al salir lo muestra con separadores. Enter sale del campo (la tabla decide a
 * dónde ir); Escape regresa el valor anterior.
 */
export const CampoNumero = forwardRef<HTMLInputElement, {
  valor: number | null | undefined; alCambiar: (n: number) => void; decimales?: number; escala?: number;
  prefijo?: string; sufijo?: string; className?: string; deshabilitado?: boolean; min?: number; max?: number;
  alEnter?: (e: KeyboardEvent<HTMLInputElement>) => void; etiqueta?: string; placeholder?: string; vacioEsCero?: boolean;
}>(({ valor, alCambiar, decimales = 2, escala = 1, prefijo, sufijo, className, deshabilitado, min, max, alEnter, etiqueta, placeholder, vacioEsCero = true }, ref) => {
  const mostrar = (v: number | null | undefined) => (v == null || Number.isNaN(v) ? "" : fmt.format(Math.round(v * escala * 10 ** decimales) / 10 ** decimales));
  const [texto, setTexto] = useState(mostrar(valor));
  const [foco, setFoco] = useState(false);
  useEffect(() => { if (!foco) setTexto(mostrar(valor)); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [valor, foco]);

  function leer(t: string) {
    const limpio = t.replace(/[$,%\s]/g, "");
    if (limpio === "") return vacioEsCero ? 0 : null;
    const n = Number(limpio);
    if (Number.isNaN(n)) return null;
    let r = n / escala;
    if (min != null) r = Math.max(min, r);
    if (max != null) r = Math.min(max, r);
    return r;
  }

  return (
    <div className={cn("relative", className)}>
      {prefijo && <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-tenue">{prefijo}</span>}
      <input
        ref={ref}
        aria-label={etiqueta}
        inputMode="decimal"
        disabled={deshabilitado}
        placeholder={placeholder}
        className={cn("campo cifra text-right", prefijo && "pl-6", sufijo && "pr-7")}
        value={texto}
        onFocus={(e) => { setFoco(true); setTexto(valor == null ? "" : String(Math.round(valor * escala * 10 ** decimales) / 10 ** decimales)); requestAnimationFrame(() => e.target.select()); }}
        onBlur={() => setFoco(false)}
        onChange={(e) => {
          setTexto(e.target.value);
          const n = leer(e.target.value);
          if (n != null && n !== valor) alCambiar(n);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") { setTexto(mostrar(valor)); (e.target as HTMLInputElement).blur(); }
          if (e.key === "Enter") { e.preventDefault(); alEnter ? alEnter(e) : (e.target as HTMLInputElement).blur(); }
        }}
      />
      {sufijo && <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-tenue">{sufijo}</span>}
    </div>
  );
});
CampoNumero.displayName = "CampoNumero";

/**
 * Elegir un texto de catálogo (pago, entrega) o escribir otro, como hoy hacen
 * en la hoja con validaciones no estrictas. Si el valor no está en el
 * catálogo, se muestra como texto libre.
 */
export function SelectorTexto({ valor, opciones, alCambiar, deshabilitado, placeholder }: {
  valor: string | null; opciones: string[]; alCambiar: (v: string | null) => void; deshabilitado?: boolean; placeholder?: string;
}) {
  const enCatalogo = valor == null || valor === "" || opciones.includes(valor);
  const [libre, setLibre] = useState(!enCatalogo);
  useEffect(() => { if (!enCatalogo) setLibre(true); }, [enCatalogo]);
  if (libre) {
    return (
      <div className="flex gap-1">
        <input className="campo" value={valor ?? ""} disabled={deshabilitado} placeholder={placeholder}
          onChange={(e) => alCambiar(e.target.value)} />
        {!deshabilitado && (
          <button type="button" className="shrink-0 rounded-lg border border-borde px-2 text-xs text-tenue hover:text-texto"
            onClick={() => { setLibre(false); alCambiar(opciones[0] ?? null); }} title="Elegir del catálogo">Catálogo</button>
        )}
      </div>
    );
  }
  return (
    <select className="campo pr-8" value={valor ?? ""} disabled={deshabilitado}
      onChange={(e) => { if (e.target.value === "__otra") { setLibre(true); } else alCambiar(e.target.value || null); }}>
      <option value="">—</option>
      {opciones.map((o) => <option key={o} value={o}>{o}</option>)}
      <option value="__otra">Otra (escribir)…</option>
    </select>
  );
}

/** Menú desplegable de acciones ("Más"). */
export function MenuAcciones({ disparador, children, alinear = "end" }: { disparador: ReactNode; children: ReactNode; alinear?: "start" | "end" }) {
  return (
    <M.Root modal={false}>
      <M.Trigger asChild>{disparador}</M.Trigger>
      <M.Portal>
        <M.Content align={alinear} sideOffset={4} className="z-50 min-w-[220px] tarjeta shadow-xl p-1">
          {children}
        </M.Content>
      </M.Portal>
    </M.Root>
  );
}
export function OpcionMenu({ icono: Icono, children, alElegir, peligro, deshabilitado }: {
  icono?: React.ComponentType<{ className?: string }>; children: ReactNode; alElegir: () => void; peligro?: boolean; deshabilitado?: boolean;
}) {
  return (
    <M.Item disabled={deshabilitado} onSelect={alElegir}
      className={cn("flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm cursor-pointer outline-none data-[highlighted]:bg-fondo data-[disabled]:opacity-40 data-[disabled]:pointer-events-none",
        peligro && "text-peligro")}>
      {Icono && <Icono className="h-4 w-4 shrink-0" />}{children}
    </M.Item>
  );
}
export const SeparadorMenu = () => <M.Separator className="my-1 h-px bg-borde" />;

/** Barra de avance (producción, meta de comisión). */
export function Barra({ valor, tono = "marca", className, alto = "h-2" }: { valor: number | null | undefined; tono?: "marca" | "ok" | "aviso" | "peligro"; className?: string; alto?: string }) {
  const v = Math.max(0, Math.min(100, valor ?? 0));
  const color = { marca: "bg-marca", ok: "bg-ok", aviso: "bg-aviso", peligro: "bg-peligro" }[tono];
  return (
    <div className={cn("w-full rounded-full bg-fondo border border-borde/60 overflow-hidden", alto, className)} role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${v}%` }} />
    </div>
  );
}

/** Dato con etiqueta pequeña arriba (fichas de detalle). */
export function Dato({ etiqueta, children, className }: { etiqueta: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="text-xs text-tenue">{etiqueta}</p>
      <div className="text-sm font-medium mt-0.5 break-words">{children}</div>
    </div>
  );
}

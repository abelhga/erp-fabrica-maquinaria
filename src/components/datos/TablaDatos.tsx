import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Download, Search, type LucideIcon } from "lucide-react";
import { cn, coincide } from "@/lib/utilidades";
import { Vacio, Cargando, ErrorCarga } from "@/components/ui/estados";

export interface Columna<T> {
  clave: string;
  titulo: ReactNode;
  /** Valor para ordenar, buscar y exportar. Si falta, se usa fila[clave]. */
  valor?: (f: T) => string | number | null | undefined;
  celda?: (f: T) => ReactNode;
  alinear?: "izq" | "der" | "centro";
  clase?: string;
  oculta?: boolean;
  /** No entra en la búsqueda de texto (p.ej. importes). */
  sinBusqueda?: boolean;
}

/**
 * Tabla estándar del ERP: búsqueda sin acentos, orden por columna, filas
 * clicables y exportar a CSV (la gente viene de hojas de cálculo y lo va a pedir).
 */
export function TablaDatos<T>({
  filas, columnas, cargando, error, alClicFila, claveFila, buscable = true, placeholder = "Buscar…",
  vacio, filtros, exportarComo, limite = 300, pie, claseFila, compacta,
}: {
  filas: T[] | undefined; columnas: Columna<T>[]; cargando?: boolean; error?: unknown;
  alClicFila?: (f: T) => void; claveFila: (f: T) => string; buscable?: boolean; placeholder?: string;
  vacio?: { icono: LucideIcon; titulo: string; texto?: ReactNode; accion?: ReactNode };
  filtros?: ReactNode; exportarComo?: string; limite?: number; pie?: ReactNode;
  claseFila?: (f: T) => string | undefined; compacta?: boolean;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [orden, setOrden] = useState<{ clave: string; asc: boolean } | null>(null);
  const [mostrar, setMostrar] = useState(limite);
  const visibles = columnas.filter((c) => !c.oculta);

  const valorDe = (c: Columna<T>, f: T) => (c.valor ? c.valor(f) : (f as Record<string, unknown>)[c.clave] as string | number | null | undefined);

  const procesadas = useMemo(() => {
    let r = filas ?? [];
    if (busqueda.trim()) {
      r = r.filter((f) => coincide(visibles.filter((c) => !c.sinBusqueda).map((c) => String(valorDe(c, f) ?? "")).join(" "), busqueda));
    }
    if (orden) {
      const c = columnas.find((x) => x.clave === orden.clave);
      if (c) {
        r = [...r].sort((a, b) => {
          const va = valorDe(c, a), vb = valorDe(c, b);
          if (va == null) return 1;
          if (vb == null) return -1;
          const d = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "es", { numeric: true });
          return orden.asc ? d : -d;
        });
      }
    }
    return r;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filas, busqueda, orden, columnas]);

  function exportar() {
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const enc = visibles.map((c) => esc(typeof c.titulo === "string" ? c.titulo : c.clave)).join(",");
    const cuerpo = procesadas.map((f) => visibles.map((c) => esc(valorDe(c, f))).join(",")).join("\n");
    // BOM para que Excel abra bien los acentos.
    const blob = new Blob(["﻿" + enc + "\n" + cuerpo], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${exportarComo ?? "datos"}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const alinear = (c: Columna<T>) => (c.alinear === "der" ? "text-right" : c.alinear === "centro" ? "text-center" : "");

  return (
    <div className="tarjeta overflow-hidden">
      {(buscable || filtros || exportarComo) && (
        <div className="flex flex-wrap items-center gap-2 p-3 border-b border-borde">
          {buscable && (
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="h-4 w-4 text-tenue absolute left-3 top-1/2 -translate-y-1/2" />
              <input className="campo pl-9" placeholder={placeholder} value={busqueda} onChange={(e) => { setBusqueda(e.target.value); setMostrar(limite); }} />
            </div>
          )}
          {filtros}
          <div className="ml-auto flex items-center gap-3 text-sm text-tenue">
            {filas && <span className="cifra">{procesadas.length.toLocaleString("es-MX")} {procesadas.length === 1 ? "registro" : "registros"}</span>}
            {exportarComo && (
              <button onClick={exportar} className="inline-flex items-center gap-1 hover:text-texto" title="Descargar para Excel">
                <Download className="h-4 w-4" /> CSV
              </button>
            )}
          </div>
        </div>
      )}
      {error ? <ErrorCarga error={error} /> : cargando ? <Cargando /> : procesadas.length === 0 ? (
        vacio ? <Vacio {...vacio} /> : <p className="p-8 text-center text-tenue text-sm">Sin resultados.</p>
      ) : (
        <div className="overflow-x-auto max-h-[70vh]">
          <table className={cn("tabla", compacta && "[&_td]:py-1.5")}>
            <thead>
              <tr>
                {visibles.map((c) => (
                  <th key={c.clave} className={cn(alinear(c), "cursor-pointer select-none whitespace-nowrap", c.clase)}
                      onClick={() => setOrden((o) => (o?.clave === c.clave ? (o.asc ? { clave: c.clave, asc: false } : null) : { clave: c.clave, asc: true }))}>
                    <span className="inline-flex items-center gap-1">
                      {c.titulo}
                      {orden?.clave === c.clave && (orden.asc ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {procesadas.slice(0, mostrar).map((f) => (
                <tr key={claveFila(f)} onClick={alClicFila ? () => alClicFila(f) : undefined}
                    className={cn(alClicFila && "cursor-pointer", claseFila?.(f))}>
                  {visibles.map((c) => (
                    <td key={c.clave} className={cn(alinear(c), c.alinear === "der" && "cifra", c.clase)}>
                      {c.celda ? c.celda(f) : String(valorDe(c, f) ?? "—")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {procesadas.length > mostrar && (
            <button onClick={() => setMostrar((m) => m + limite)} className="w-full py-3 text-sm text-marca-texto hover:bg-fondo">
              Mostrar {Math.min(limite, procesadas.length - mostrar)} más de {procesadas.length - mostrar} restantes
            </button>
          )}
        </div>
      )}
      {pie && <div className="border-t border-borde px-3 py-2 bg-fondo/50">{pie}</div>}
    </div>
  );
}

/** Botones de filtro tipo "pastilla" para la barra de la tabla. */
export function Filtro<T extends string>({ opciones, valor, alCambiar }: {
  opciones: { valor: T; texto: string; cuenta?: number }[]; valor: T; alCambiar: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {opciones.map((o) => (
        <button key={o.valor} onClick={() => alCambiar(o.valor)}
          className={cn("h-8 rounded-full px-3 text-xs font-medium border transition",
            valor === o.valor ? "bg-marca text-white border-marca" : "border-borde text-tenue hover:text-texto hover:bg-fondo")}>
          {o.texto}{o.cuenta != null && <span className="ml-1 opacity-75 cifra">{o.cuenta}</span>}
        </button>
      ))}
    </div>
  );
}

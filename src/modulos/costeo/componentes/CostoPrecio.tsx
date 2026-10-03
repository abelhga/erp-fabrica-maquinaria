import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { Tarjeta, EncabezadoTarjeta } from "@/components/ui/tarjeta";
import { Cargando, ErrorCarga } from "@/components/ui/estados";
import { Insignia } from "@/components/ui/insignia";
import { supabase } from "@/lib/supabase";
import { q } from "@/lib/consultas";
import { useSesion } from "@/lib/sesion";
import { dinero, fecha, hace, numero } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { cant, esCostoViejo, esFabricado, pct, rutaArticulo, type ArticuloCatalogo } from "./comun";
import { useArbol, useCostosDe } from "./datosLista";

export interface Recargo { nombre: string; pct: number; monto: number }
export interface Desglose {
  costo_material: number; costo_mano_obra: number; costo: number; horas: number | null; sin_costo: number; costo_mas_viejo: string | null;
  politica: { id: number; nombre: string; utilidad: number; compensar_isr: boolean; pct_medida_especial: number; descuento_maximo: number };
  isr: number; utilidad: number; margen_propio: number | null; utilidad_compensada: number; medida_especial: boolean;
  recargos_costo: Recargo[]; pct_recargos_costo: number; monto_medida_especial: number; base: number;
  recargos_precio: Recargo[]; pct_recargos_precio: number; divisor: number; precio_sin_redondeo: number | null;
  utilidad_antes_isr: number; isr_monto: number; multiplo_redondeo: number | null; precio_redondeado: number | null;
  precio_fijo: number | null; precio_lista: number | null; factor: number | null; costo_con_recargos: number;
  utilidad_bruta: number | null; utilidad_neta: number | null; pct_neto: number | null;
}

/** Desglose del precio calculado por la base (desglose_precio). Sin permiso de costos ni se pide. */
export function useDesglose(id: string | undefined) {
  const { puede } = useSesion();
  return useQuery({
    queryKey: ["costeo", "desglose", id],
    enabled: !!id && puede("costos"),
    queryFn: () => q<Desglose | null>(supabase.rpc("desglose_precio", { p_articulo: id })),
  });
}

function Renglon({ etiqueta, valor, detalle, fuerte, signo, sangria, tono }: {
  etiqueta: React.ReactNode; valor: React.ReactNode; detalle?: React.ReactNode; fuerte?: boolean; signo?: "+" | "=" | "−";
  sangria?: boolean; tono?: "tenue";
}) {
  return (
    <div className={cn("flex items-baseline gap-3 py-1.5", fuerte && "border-t border-borde mt-1 pt-2.5 font-semibold", tono === "tenue" && "text-tenue")}>
      <span className="w-4 text-tenue text-center shrink-0">{signo}</span>
      <span className={cn("flex-1 min-w-0", sangria && "pl-3")}>
        {etiqueta}
        {detalle && <span className="block text-xs text-tenue font-normal">{detalle}</span>}
      </span>
      <span className="cifra whitespace-nowrap">{valor}</span>
    </div>
  );
}

const multiploTexto = (m: number | null) => (m == null ? "" : m >= 1 ? dinero(m).replace(".00", "") : "centavo");

/** La fórmula escrita con los números de este artículo, como la explicaría ingeniería a dirección. */
export function FormulaEnPalabras({ d }: { d: Desglose }) {
  if (d.precio_fijo != null) {
    return <p className="text-sm">Este artículo tiene <b>precio fijo de {dinero(d.precio_fijo)}</b>: la fórmula de su política no se aplica.</p>;
  }
  if (!d.costo || d.precio_sin_redondeo == null) {
    return <p className="text-sm text-tenue">Sin costo no hay precio: captura el costo de sus componentes y el precio sale solo.</p>;
  }
  const medida = d.medida_especial && d.politica.pct_medida_especial > 0;
  const factorCosto = 1 + d.pct_recargos_costo + (medida ? d.politica.pct_medida_especial : 0);
  return (
    <div className="space-y-3 text-sm leading-relaxed">
      {d.politica.compensar_isr ? (
        <p>
          <b>Precio</b> = costo × (1 + recargos sobre costo{medida && " + medida especial"}) ÷ (1 − utilidad ÷ (1 − ISR) − recargos sobre precio)
        </p>
      ) : (
        <p><b>Precio</b> = costo × (1 + recargos sobre costo) ÷ (1 − utilidad − recargos sobre precio)</p>
      )}
      <p className="rounded-lg bg-fondo px-3 py-2 cifra">
        = {dinero(d.costo)} × {cant(factorCosto)} ÷ (1 − {cant(d.utilidad)}{d.politica.compensar_isr && <> ÷ {cant(1 - d.isr)}</>}
        {d.pct_recargos_precio > 0 && <> − {cant(d.pct_recargos_precio)}</>})
        <br />= {dinero(d.base)} ÷ {cant(d.divisor)} = <b>{dinero(d.precio_sin_redondeo)}</b>
        <br />→ hacia arriba al {multiploTexto(d.multiplo_redondeo)} más cercano: <b>{dinero(d.precio_redondeado)}</b>
      </p>
      <p className="text-tenue">
        {d.politica.compensar_isr
          ? <>La utilidad de {pct(d.utilidad)} es <b className="text-texto">neta después de ISR</b>: para que quede {pct(d.utilidad)} libre, antes de un ISR de {pct(d.isr)} hay que cobrar {pct(d.utilidad_compensada)} del precio. </>
          : <>La utilidad de {pct(d.utilidad)} es sobre el precio de venta, sin compensar ISR. </>}
        Cada peso de costo se vende en <b className="text-texto cifra">{d.factor ? `${cant(Math.round(d.factor * 1000) / 1000)} pesos` : "—"}</b> antes del redondeo.
        {d.margen_propio != null && <> Este artículo tiene utilidad propia de {pct(d.margen_propio)} (no la de su política).</>}
      </p>
    </div>
  );
}

/** Pestaña "Costo y precio": de dónde sale cada peso del precio de lista. */
export function CostoPrecio({ articulo }: { articulo: ArticuloCatalogo }) {
  const d = useDesglose(articulo.id);
  const fab = esFabricado(articulo.tipo);
  const arbol = useArbol(fab ? articulo.id : undefined);
  const ids = useMemo(() => [...new Set((arbol.data ?? []).map((l) => l.articulo_id))], [arbol.data]);
  const costos = useCostosDe(ids, fab);

  // Hojas (lo que se compra) sin costo o con costo viejo, en cualquier nivel del árbol.
  const hojas = useMemo(() => {
    if (!arbol.data || !costos.data) return { sin: [], viejos: [] };
    const vistos = new Map<string, { id: string; clave: string; nombre: string; tipo: ArticuloCatalogo["tipo"]; donde: string | null; fecha: string | null; costo: number }>();
    for (const l of arbol.data) {
      if (esFabricado(l.tipo) || vistos.has(l.articulo_id)) continue;
      const c = costos.data.get(l.articulo_id);
      const padre = l.nivel > 1 ? arbol.data.find((x) => x.linea_id === l.ruta[l.ruta.length - 2])?.nombre ?? null : null;
      vistos.set(l.articulo_id, { id: l.articulo_id, clave: l.clave, nombre: l.nombre, tipo: l.tipo, donde: padre, fecha: c?.costo_mas_viejo ?? null, costo: c?.costo_total ?? 0 });
    }
    const todas = [...vistos.values()];
    return {
      sin: todas.filter((h) => !h.costo),
      viejos: todas.filter((h) => h.costo && esCostoViejo(h.fecha)).sort((a, b) => (a.fecha ?? "").localeCompare(b.fecha ?? "")).slice(0, 8),
    };
  }, [arbol.data, costos.data]);

  if (d.isLoading) return <Cargando filas={8} />;
  if (d.error) return <ErrorCarga error={d.error} />;
  const x = d.data;
  if (!x) return null;
  const medida = x.medida_especial && x.politica.pct_medida_especial > 0;

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <Tarjeta className="lg:col-span-3">
        <EncabezadoTarjeta titulo="De dónde sale el precio" descripcion={<>Política <b className="text-texto">{x.politica.nombre}</b> · utilidad {pct(x.utilidad)} · ISR de compensación {pct(x.isr)}</>} />
        <div className="px-5 pb-5 text-sm">
          {fab && <Renglon etiqueta="Material" detalle="Lista de materiales, incluidos sus subensambles" valor={dinero(x.costo_material)} />}
          {fab && <Renglon signo="+" etiqueta="Mano de obra" detalle={`${numero(x.horas)} h a la tarifa de cada etapa`} valor={dinero(x.costo_mano_obra)} />}
          <Renglon signo={fab ? "=" : undefined} fuerte={fab} etiqueta="Costo" valor={dinero(x.costo)} />
          {x.recargos_costo.length > 0 && <p className="etiqueta mt-3 mb-0.5 pl-7">Recargos sobre el costo</p>}
          {x.recargos_costo.map((r) => <Renglon key={r.nombre} signo="+" sangria etiqueta={<>{r.nombre} <span className="text-tenue">{pct(r.pct)}</span></>} valor={dinero(r.monto)} />)}
          {medida && <Renglon signo="+" sangria etiqueta={<>Medida especial <span className="text-tenue">{pct(x.politica.pct_medida_especial)}</span></>} valor={dinero(x.monto_medida_especial)} />}
          {(x.recargos_costo.length > 0 || medida) && <Renglon signo="=" fuerte etiqueta="Costo con recargos" valor={dinero(x.base)} />}

          {x.precio_sin_redondeo != null && (
            <>
              <p className="etiqueta mt-3 mb-0.5 pl-7">Sobre el precio de {dinero(x.precio_sin_redondeo)}</p>
              {x.recargos_precio.map((r) => <Renglon key={r.nombre} signo="+" sangria etiqueta={<>{r.nombre} <span className="text-tenue">{pct(r.pct)}</span></>} valor={dinero(r.monto)} />)}
              <Renglon signo="+" sangria etiqueta={<>Utilidad <span className="text-tenue">{pct(x.utilidad_compensada)} del precio</span></>}
                detalle={x.politica.compensar_isr ? <>{dinero(x.isr_monto)} de ISR y {dinero(x.utilidad_antes_isr - x.isr_monto)} libres ({pct(x.utilidad)})</> : undefined}
                valor={dinero(x.utilidad_antes_isr)} />
              <Renglon signo="=" fuerte etiqueta="Precio sin redondear" valor={dinero(x.precio_sin_redondeo)} />
              <Renglon signo="+" etiqueta={<>Redondeo hacia arriba <span className="text-tenue">al {multiploTexto(x.multiplo_redondeo)}</span></>}
                valor={dinero((x.precio_redondeado ?? 0) - x.precio_sin_redondeo)} tono="tenue" />
            </>
          )}
          <div className="flex items-baseline gap-3 mt-2 rounded-lg bg-marca-suave px-3 py-3">
            <span className="flex-1 font-semibold text-marca-texto">Precio de lista sin IVA</span>
            <span className="text-2xl font-semibold cifra">{dinero(x.precio_lista)}</span>
          </div>
          {x.precio_fijo != null && <p className="text-xs text-aviso mt-2">Precio fijo capturado a mano: manda sobre la fórmula.</p>}
        </div>
      </Tarjeta>

      <div className="lg:col-span-2 space-y-4">
        <Tarjeta>
          <EncabezadoTarjeta titulo="La fórmula, con estos números" />
          <div className="px-5 pb-5"><FormulaEnPalabras d={x} /></div>
        </Tarjeta>
        {x.precio_lista != null && (
          <Tarjeta>
            <EncabezadoTarjeta titulo="Lo que queda con el precio de lista" descripcion="Como las columnas Z a AC de la hoja" />
            <div className="px-5 pb-4 text-sm">
              <Renglon etiqueta="Precio de lista" valor={dinero(x.precio_lista)} />
              <Renglon signo="−" etiqueta="Costo con todos los recargos" valor={dinero(x.costo_con_recargos)} />
              <Renglon signo="=" fuerte etiqueta="Utilidad bruta" valor={dinero(x.utilidad_bruta)} />
              {x.politica.compensar_isr && <Renglon signo="−" etiqueta={<>ISR <span className="text-tenue">{pct(x.isr)}</span></>} valor={dinero((x.utilidad_bruta ?? 0) - (x.utilidad_neta ?? 0))} />}
              <Renglon signo="=" fuerte etiqueta="Utilidad neta" valor={<>{dinero(x.utilidad_neta)} <span className="text-tenue font-normal">· {pct(x.pct_neto)}</span></>} />
              <p className="text-xs text-tenue mt-2">El vendedor puede bajar hasta {pct(x.politica.descuento_maximo)} sin autorización ({dinero((x.precio_lista ?? 0) * (1 - x.politica.descuento_maximo))}).</p>
            </div>
          </Tarjeta>
        )}
      </div>

      {fab && (
        <Tarjeta className="lg:col-span-5">
          <EncabezadoTarjeta titulo="Confiabilidad del costo"
            descripcion="Piezas sin costo cuentan como $0 y bajan el precio sin avisar; un costo de hace meses ya no es el de hoy." />
          <div className="px-5 pb-5 grid gap-5 md:grid-cols-2">
            <div>
              <p className="etiqueta mb-2 flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5 text-peligro" /> Sin costo ({hojas.sin.length})</p>
              {hojas.sin.length === 0
                ? <p className="text-sm text-tenue flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-ok" /> Todas las piezas tienen costo.</p>
                : <ul className="space-y-1">{hojas.sin.map((h) => (
                    <li key={h.id} className="text-sm rounded-md bg-peligro-suave px-2.5 py-1.5 flex items-center gap-2">
                      <Link to={rutaArticulo(h)} className="hover:underline min-w-0 flex-1 truncate"><span className="cifra text-tenue">{h.clave}</span> {h.nombre}</Link>
                      {h.donde && <span className="text-xs text-tenue shrink-0">en {h.donde}</span>}
                    </li>))}
                  </ul>}
            </div>
            <div>
              <p className="etiqueta mb-2 flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-aviso" /> Costos de más de 6 meses</p>
              {hojas.viejos.length === 0
                ? <p className="text-sm text-tenue flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-ok" /> Ningún costo tiene más de 6 meses.</p>
                : <ul className="space-y-1">{hojas.viejos.map((h) => (
                    <li key={h.id} className="text-sm flex items-center gap-2">
                      <Link to={rutaArticulo(h)} className="hover:underline min-w-0 flex-1 truncate"><span className="cifra text-tenue">{h.clave}</span> {h.nombre}</Link>
                      <Insignia tono="aviso">{fecha(h.fecha)} · {hace(h.fecha)}</Insignia>
                    </li>))}
                  </ul>}
            </div>
          </div>
        </Tarjeta>
      )}
    </div>
  );
}

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialogo } from "@/components/ui/dialogo";
import { Boton } from "@/components/ui/boton";
import { Campo, Entrada } from "@/components/ui/campo";
import { Insignia } from "@/components/ui/insignia";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { dinero, fecha } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { GLOSARIO } from "@/tutorial/glosario";
import { INVALIDAR_PROVEEDORES } from "./cuentas";

/** Una orden que puede ser de la factura, como la ordena la base (la ligada, la que casa por folio, la del mismo total). */
export interface OrdenParaLigar {
  id: string; folio: string; fecha: string; estado: "enviada" | "parcial" | "recibida"; moneda: string;
  total: number; total_mxn: number; factura_proveedor: string | null; partidas: number; sin_articulo: number;
  ligada: boolean; facturada: boolean; casa_folio: boolean; casa_total: boolean;
}

const ESTADO: Record<OrdenParaLigar["estado"], string> = { enviada: "Por recibir", parcial: "Recibida en parte", recibida: "Recibida" };

/** Las órdenes del proveedor que pueden ser de esta factura. */
export function useOrdenesParaLigar(proveedor: string | null | undefined, factura: string | null, monto: number | null, movimiento?: string) {
  return useQuery({
    queryKey: ["ordenes_para_ligar", proveedor, factura, monto, movimiento], enabled: !!proveedor, staleTime: 30_000,
    queryFn: () => q<OrdenParaLigar[]>(supabase.rpc("ordenes_para_ligar", {
      p_proveedor: proveedor, p_factura: factura || null, p_monto: monto || null, p_movimiento: movimiento ?? null,
    })),
  });
}

/**
 * Casillas con las órdenes de compra del proveedor. Con orden, cada partida cuenta por su artículo;
 * sin orden, la categoría de la factura dice en qué se gastó.
 */
export function ElegirOrdenes({ ordenes, elegidas, alCambiar }: {
  ordenes: OrdenParaLigar[]; elegidas: string[]; alCambiar: (ids: string[]) => void;
}) {
  const [todas, setTodas] = useState(false);
  // Las elegidas siempre se ven, aunque estén más abajo.
  const visibles = todas ? ordenes : ordenes.filter((o, i) => i < 4 || elegidas.includes(o.id));
  const cambiar = (id: string, si: boolean) => alCambiar(si ? [...elegidas, id] : elegidas.filter((x) => x !== id));
  return (
    <div className="space-y-1.5" role="group" aria-label="Orden de compra">
      <span className="text-sm font-medium" data-explain={GLOSARIO.ordenDeLaFactura} data-explain-title="¿De qué orden de compra es?">¿De qué orden de compra es?</span>
      <div className="rounded-lg border border-borde divide-y divide-borde">
        {visibles.map((o) => (
          <label key={o.id} className={cn("flex items-start gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-fondo", elegidas.includes(o.id) && "bg-marca-suave/40")}>
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[hsl(var(--marca))]" checked={elegidas.includes(o.id)} onChange={(e) => cambiar(o.id, e.target.checked)} />
            <span className="flex-1 min-w-0">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <b>{o.folio}</b>
                <span className="text-tenue">{fecha(o.fecha)} · {ESTADO[o.estado]}</span>
                {o.casa_folio && <Insignia tono="ok">Casa el folio</Insignia>}
                {o.casa_total && !o.casa_folio && <Insignia tono="info">Mismo total</Insignia>}
                {o.facturada && <Insignia tono="neutro">Ya tiene otra factura</Insignia>}
                {o.sin_articulo > 0 && <span data-explain={GLOSARIO.partidaSinArticulo} data-explain-title="Partida sin artículo">
                  <Insignia tono="aviso">{o.sin_articulo} de {o.partidas} sin artículo</Insignia></span>}
              </span>
              <span className="block text-xs text-tenue">
                {o.moneda === "MXN" ? dinero(o.total) : `${dinero(o.total)} ${o.moneda} ≈ ${dinero(o.total_mxn)}`}
                {o.factura_proveedor ? ` · almacén anotó la factura ${o.factura_proveedor}` : ""}
              </span>
            </span>
            <span className="cifra shrink-0 text-xs text-tenue">{o.partidas} {o.partidas === 1 ? "partida" : "partidas"}</span>
          </label>
        ))}
      </div>
      {!todas && ordenes.length > visibles.length && (
        <button type="button" className="text-xs text-marca-texto hover:underline" onClick={() => setTodas(true)}>Ver {ordenes.length - visibles.length} órdenes más</button>
      )}
      <p className="text-xs text-tenue">
        {elegidas.length ? "Cada partida cuenta por su artículo: consumible del taller, material o, si no tiene artículo, la categoría de abajo."
          : "Sin orden de compra (un gasto o servicio), la categoría de abajo dice en qué se gastó."}
      </p>
    </div>
  );
}

/** Cambiar de qué órdenes es una compra ya registrada, y su categoría. */
export function DialogoLigarOrdenes({ compra, alCerrar }: {
  compra: { id: string; proveedor_id: string; factura: string | null; monto: number; categoria: string | null; fecha: string } | null;
  alCerrar: () => void;
}) {
  const ordenes = useOrdenesParaLigar(compra?.proveedor_id, compra?.factura ?? null, compra?.monto ?? null, compra?.id);
  const [elegidas, setElegidas] = useState<string[]>([]);
  const [categoria, setCategoria] = useState("");
  const [cargadas, setCargadas] = useState(false);
  useEffect(() => { setCargadas(false); setCategoria(compra?.categoria ?? ""); }, [compra?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // Empieza con las que ya tiene ligadas.
  useEffect(() => {
    if (ordenes.data && !cargadas) { setElegidas(ordenes.data.filter((o) => o.ligada).map((o) => o.id)); setCargadas(true); }
  }, [ordenes.data, cargadas]);
  const guardar = useAccion(() => q<number>(supabase.rpc("ligar_compra_oc", { p_movimiento: compra!.id, p_ordenes: elegidas, p_categoria: categoria.trim() || null })), {
    exito: (n) => (n ? `Ligada a ${n === 1 ? "su orden" : `${n} órdenes`}` : "Sin orden de compra"),
    invalidar: [...INVALIDAR_PROVEEDORES, ["compra_oc"], ["ordenes_para_ligar"], ["v_por_pagar"], ["facturas_de_oc"]], alTerminar: alCerrar,
  });
  const falta = elegidas.length === 0 && !categoria.trim();
  function enviar(e: FormEvent) { e.preventDefault(); if (!falta) guardar.mutate(undefined); }
  return (
    <Dialogo abierto={!!compra} alCambiar={(v) => !v && alCerrar()} ancho="max-w-xl"
      titulo={`Orden de compra de ${compra?.factura ? `la factura ${compra.factura}` : "la compra"}`}
      descripcion={compra && `${dinero(compra.monto)} del ${fecha(compra.fecha)}`}
      pie={<>
        <Boton variante="secundario" type="button" onClick={alCerrar}>Cancelar</Boton>
        <Boton type="submit" form="ligar-ordenes" cargando={guardar.isPending} disabled={falta || !cargadas}>Guardar</Boton>
      </>}>
      <form id="ligar-ordenes" onSubmit={enviar} className="space-y-4">
        {ordenes.isLoading ? <p className="text-sm text-tenue">Buscando sus órdenes…</p>
          : (ordenes.data?.length ?? 0) === 0 ? <p className="text-sm text-tenue">Este proveedor no tiene órdenes de compra del último año.</p>
          : <ElegirOrdenes ordenes={ordenes.data!} elegidas={elegidas} alCambiar={setElegidas} />}
        <Campo etiqueta={elegidas.length ? "Categoría (para las partidas sin artículo)" : "Categoría"}
          ayuda={elegidas.length ? undefined : "Obligatoria sin orden de compra: es lo que dice en qué se gastó."}>
          <Entrada value={categoria} list="categorias-ligar" onChange={(e) => setCategoria(e.target.value)} required={elegidas.length === 0} />
          <ListaCategorias id="categorias-ligar" />
        </Campo>
      </form>
    </Dialogo>
  );
}

/** Las categorías que ya existen, para no escribir "Fletes" de tres formas. */
export function useCategorias() {
  const datos = useQuery({
    queryKey: ["proveedores", "categorias"], staleTime: 10 * 60_000,
    queryFn: () => q<{ categoria: string | null }[]>(supabase.from("proveedores").select("categoria").not("categoria", "is", null).limit(2000)),
  });
  return useMemo(() => [...new Set((datos.data ?? []).map((d) => d.categoria!.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es")), [datos.data]);
}

export function ListaCategorias({ id }: { id: string }) {
  const categorias = useCategorias();
  return <datalist id={id}>{categorias.map((c) => <option key={c} value={c} />)}</datalist>;
}

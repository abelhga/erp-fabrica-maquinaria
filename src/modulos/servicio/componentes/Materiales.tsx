import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PackageCheck, ShoppingCart, Trash2 } from "lucide-react";
import { BuscadorArticulo, type ArticuloEncontrado } from "@/components/datos/BuscadorArticulo";
import { Boton } from "@/components/ui/boton";
import { Entrada, Seleccion } from "@/components/ui/campo";
import { Insignia } from "@/components/ui/insignia";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { numero, fecha } from "@/lib/formato";
import { CLAVE, useAlmacenesPlanta, type Material } from "../datos";
import { usePermisosServicio } from "./piezas";

const ESTADO = {
  pendiente: { texto: "Por entregar", tono: "aviso" },
  surtido: { texto: "Entregado", tono: "ok" },
  en_compra: { texto: "En compras", tono: "info" },
  cancelado: { texto: "Quitado", tono: "neutro" },
} as const;

export function useMateriales(filtro: { servicioId?: string; mantenimientoId?: string }) {
  return useQuery({
    queryKey: [...CLAVE, "materiales", filtro.servicioId ?? filtro.mantenimientoId],
    queryFn: () => {
      let c = supabase.from("v_servicio_materiales").select("*");
      c = filtro.servicioId ? c.eq("servicio_id", filtro.servicioId) : c.eq("mantenimiento_id", filtro.mantenimientoId!);
      return q<Material[]>(c.neq("estado", "cancelado").order("pedido_en"));
    },
  });
}

/** Botón de almacén para entregar una partida: elige de qué almacén sale. */
export function Entregar({ m }: { m: Material }) {
  const almacenes = useAlmacenesPlanta();
  const [almacen, setAlmacen] = useState<string>("");
  const surtir = useAccion((a: { linea: string; almacen: number }) => q(supabase.rpc("surtir_material_servicio", { p_linea: a.linea, p_almacen: a.almacen })),
    { exito: "Material entregado: la salida quedó registrada con el folio", invalidar: [CLAVE, ["inventario"]] });
  const elegido = almacen || String(almacenes.data?.[0]?.id ?? "");
  return (
    <div className="flex items-center gap-1.5">
      <Seleccion className="h-8 w-auto text-xs" value={elegido} onChange={(e) => setAlmacen(e.target.value)} aria-label="Almacén">
        {(almacenes.data ?? []).map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
      </Seleccion>
      <Boton tamano="sm" variante="exito" cargando={surtir.isPending} disabled={!elegido}
             onClick={() => surtir.mutate({ linea: m.id, almacen: Number(elegido) })}>
        <PackageCheck className="h-3.5 w-3.5" />Entregar
      </Boton>
    </div>
  );
}

/**
 * Insumos de un servicio o refacciones de un mantenimiento. Producción los pide,
 * almacén los entrega (salida con registrar_salida) y lo que no hay se pide a
 * compras como requisición. Aquí no hay costos: los ve quien tiene "costos".
 */
export function Materiales({ servicioId, mantenimientoId, abierto }: { servicioId?: string; mantenimientoId?: string; abierto: boolean }) {
  const p = usePermisosServicio();
  const lista = useMateriales({ servicioId, mantenimientoId });
  const [art, setArt] = useState<ArticuloEncontrado | null>(null);
  const [cant, setCant] = useState("1");
  const agregar = useAccion(() => q(supabase.rpc("agregar_material_servicio", {
    p_articulo: art!.id, p_cantidad: Number(cant), p_servicio: servicioId ?? null, p_mantenimiento: mantenimientoId ?? null,
  })), { exito: "Agregado: almacén ya tiene el aviso", invalidar: [CLAVE], alTerminar: () => { setArt(null); setCant("1"); } });
  const quitar = useAccion((id: string) => q(supabase.rpc("cancelar_material_servicio", { p_linea: id })), { invalidar: [CLAVE] });
  const compras = useAccion(() => q<string | null>(supabase.rpc("pedir_material_a_compras", { p_servicio: servicioId ?? null, p_mantenimiento: mantenimientoId ?? null })),
    { exito: (r) => (r ? "Pedido a compras como requisición" : "No había nada por pedir"), invalidar: [CLAVE] });
  const filas = lista.data ?? [];
  const pendientes = filas.filter((m) => m.estado === "pendiente");

  return (
    <div className="space-y-3">
      {lista.isLoading ? <p className="text-sm text-tenue">Cargando…</p> : filas.length === 0 ? (
        <p className="text-sm text-tenue">{abierto && p.personal ? "Nada pedido. Agrega lo que hay que llevar o cambiar; almacén recibe el aviso." : "Sin material."}</p>
      ) : (
        <div className="overflow-x-auto -mx-1">
          <table className="tabla">
            <thead><tr><th>Artículo</th><th className="text-right">Cantidad</th><th className="text-right">En planta</th><th>Estado</th><th /></tr></thead>
            <tbody>
              {filas.map((m) => (
                <tr key={m.id}>
                  <td className="min-w-[180px]">
                    <p className="font-medium leading-tight">{m.nombre}</p>
                    <p className="text-xs text-tenue">{m.clave}{m.notas ? ` · ${m.notas}` : ""}</p>
                  </td>
                  <td className="text-right cifra whitespace-nowrap">{numero(m.cantidad)} {m.unidad}</td>
                  <td className={`text-right cifra ${m.estado === "pendiente" && m.existencia_planta < m.cantidad ? "text-peligro font-medium" : ""}`}>{numero(m.existencia_planta)}</td>
                  <td className="whitespace-nowrap">
                    <Insignia tono={ESTADO[m.estado].tono}>{ESTADO[m.estado].texto}</Insignia>
                    <p className="text-[11px] text-tenue mt-0.5">
                      {m.estado === "surtido" ? `${m.surtido_por_nombre ?? ""} · ${fecha(m.surtido_en)}` : m.estado === "en_compra" ? (m.requisicion_folio ?? "") : `pidió ${m.pedido_por_nombre ?? ""}`}
                    </p>
                    {/* Almacén entrega desde aquí mismo (debajo, para que quepa en el celular). */}
                    {abierto && (m.estado === "pendiente" || m.estado === "en_compra") && p.almacen && <div className="mt-1.5"><Entregar m={m} /></div>}
                  </td>
                  <td className="text-right w-10">
                    {abierto && m.estado === "pendiente" && p.personal && (
                      <Boton variante="fantasma" tamano="icono" onClick={() => quitar.mutate(m.id)} aria-label={`Quitar ${m.nombre}`}><Trash2 className="h-4 w-4" /></Boton>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {abierto && p.personal && (
        <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); if (art && Number(cant) > 0) agregar.mutate(); }}>
          <div className="flex-1 min-w-[220px]">
            {art ? (
              <button type="button" onClick={() => setArt(null)} className="campo text-left truncate" title="Cambiar artículo">{art.clave} · {art.nombre}</button>
            ) : (
              <BuscadorArticulo alElegir={setArt} tipos={["componente", "materia_prima"]} placeholder="Agregar insumo o refacción…" mostrarPrecio={false} />
            )}
          </div>
          <Entrada type="number" min="0.001" step="any" className="w-24" value={cant} onChange={(e) => setCant(e.target.value)} aria-label="Cantidad" />
          <Boton type="submit" variante="secundario" disabled={!art || !(Number(cant) > 0)} cargando={agregar.isPending}>Agregar</Boton>
          {pendientes.some((m) => m.existencia_planta < m.cantidad) && (
            <Boton type="button" variante="secundario" onClick={() => compras.mutate()} cargando={compras.isPending}>
              <ShoppingCart className="h-4 w-4" />Pedir a compras lo pendiente
            </Boton>
          )}
        </form>
      )}
    </div>
  );
}

import { useQuery } from "@tanstack/react-query";
import { ExternalLink, PackageCheck, ShieldCheck, Store, Timer, Truck } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { q } from "@/lib/consultas";
import { dinero, fechaYHora, numero, porcentaje } from "@/lib/formato";
import { Insignia } from "@/components/ui/insignia";
import { Cargando } from "@/components/ui/estados";
import { Boton } from "@/components/ui/boton";
import { cn } from "@/lib/utilidades";
import { Imagen } from "./Imagen";
import { dineroEn, mensualidad, usePlanesMeses, type Moneda } from "../comun";

export interface Ficha {
  clave: string; nombre: string; tipo: string; unidad: string; imagen_url: string | null; es_importado: boolean;
  precio: number | null; precio_minimo: number | null; descuento_maximo: number; existencia: number | null; apartado: number | null;
  en_mercadolibre: number | null; tiempo_entrega_dias: number | null; envio_gratis: boolean | null; envio_gratis_desde: number | null;
  precio_ml: number | null; precio_ml_con_envio: number | null;
  publicacion_ml: { precio: number | null; url: string | null; id_externo: string | null; con_envio: boolean } | null;
  actualizado: string | null;
}

export function useFicha(articuloId: string | null | undefined) {
  return useQuery({
    queryKey: ["ficha_venta", articuloId], enabled: !!articuloId, staleTime: 60_000,
    queryFn: () => q<Ficha>(supabase.rpc("ficha_venta", { p_articulo: articuloId })),
  });
}

/**
 * Lo que el vendedor veía en el BUSCADOR de la hoja, al lado de la partida:
 * precio y precio mínimo autorizado (sin y con IVA, y en la moneda de la
 * cotización), existencia en planta y en Full de Mercado Libre, plazo, envío
 * gratis, precio en ML y mensualidades. Los cálculos los hace la base
 * (ficha_venta); aquí solo se acomodan.
 */
export function FichaVenta({ articuloId, moneda = "MXN", tipoCambio = 1, conIva = false, tasaIva = 0.16, precioActual, alAplicarPrecio, compacta }: {
  articuloId: string; moneda?: Moneda; tipoCambio?: number; conIva?: boolean; tasaIva?: number; precioActual?: number;
  alAplicarPrecio?: (precio: number) => void; compacta?: boolean;
}) {
  const ficha = useFicha(articuloId);
  const planes = usePlanesMeses();
  if (ficha.isLoading) return <Cargando filas={4} />;
  const f = ficha.data;
  if (!f) return <p className="p-4 text-sm text-tenue">Sin información de este artículo.</p>;

  // Precio de lista en la moneda/forma en que se está cotizando (mismo cálculo que agregar_partida).
  const enCot = (p: number | null) => (p == null ? null : Math.round((p / tipoCambio) * (conIva ? 1 + tasaIva : 1) * 100) / 100);
  const disponible = f.existencia == null ? null : Math.max(0, Number(f.existencia) - Number(f.apartado ?? 0));
  const fabricado = f.tipo === "equipo" || f.tipo === "subensamble";
  const bajo = precioActual != null && f.precio_minimo != null && precioActual < (enCot(f.precio_minimo) ?? 0) - 0.005;

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <Imagen key={f.imagen_url ?? ""} src={f.imagen_url} className="h-16 w-16 shrink-0" />
        <div className="min-w-0">
          <p className="text-xs text-tenue">{f.clave} · {f.unidad}{f.es_importado ? " · importado" : ""}</p>
          <p className="text-sm font-medium leading-snug">{f.nombre}</p>
        </div>
      </div>

      <div className="rounded-lg border border-borde">
        <div className="flex items-start justify-between gap-3 px-3 py-2">
          <span className="text-sm text-tenue">Precio de lista</span>
          <span className="text-right">
            <span className="block font-semibold cifra">{dinero(f.precio)}</span>
            <span className="block text-xs text-tenue cifra">{dinero(f.precio == null ? null : f.precio * (1 + tasaIva))} con IVA</span>
          </span>
        </div>
        <div className={cn("flex items-start justify-between gap-3 px-3 py-2 border-t border-borde rounded-b-lg", bajo ? "bg-peligro-suave" : "bg-aviso-suave/50")}>
          <span className="text-sm">
            <span className="flex items-center gap-1 font-medium"><ShieldCheck className="h-3.5 w-3.5" />Precio mínimo</span>
            <span className="block text-xs text-tenue">−{porcentaje(f.descuento_maximo, 2).replace(".00%", "%")} máx.</span>
          </span>
          <span className="text-right">
            <span className={cn("block font-semibold cifra", bajo && "text-peligro")}>{dinero(f.precio_minimo)}</span>
            <span className="block text-xs text-tenue cifra">{dinero(f.precio_minimo == null ? null : f.precio_minimo * (1 + tasaIva))} con IVA</span>
          </span>
        </div>
      </div>
      {(moneda !== "MXN" || conIva) && f.precio != null && (
        <p className="text-xs text-tenue">
          En esta cotización ({moneda}{conIva ? ", IVA incluido" : ""}): lista <b className="cifra text-texto">{dineroEn(enCot(f.precio), moneda)}</b>,
          mínimo <b className="cifra text-texto">{dineroEn(enCot(f.precio_minimo), moneda)}</b>
        </p>
      )}
      {alAplicarPrecio && f.precio != null && (
        <div className="flex gap-2">
          <Boton tamano="sm" variante="secundario" className="flex-1" onClick={() => alAplicarPrecio(enCot(f.precio)!)}>Precio de lista</Boton>
          <Boton tamano="sm" variante="secundario" className="flex-1" onClick={() => alAplicarPrecio(enCot(f.precio_minimo)!)}>Precio mínimo</Boton>
        </div>
      )}

      <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5 text-sm">
        <div>
          <dt className="text-xs text-tenue flex items-center gap-1"><PackageCheck className="h-3.5 w-3.5" /> En planta</dt>
          <dd className={cn("font-medium cifra", (f.existencia ?? 0) > 0 ? "text-ok" : fabricado ? "text-texto" : "text-peligro")}>
            {!(Number(f.existencia ?? 0) > 0) && fabricado ? "Sobre pedido" : <>{numero(f.existencia ?? 0)} {f.unidad}</>}
            {Number(f.apartado ?? 0) > 0 && <span className="block text-xs font-normal text-tenue">{numero(disponible)} libres ({numero(f.apartado)} apartadas)</span>}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-tenue flex items-center gap-1"><Store className="h-3.5 w-3.5" /> En Full ML</dt>
          <dd className="font-medium cifra">{numero(f.en_mercadolibre ?? 0)}</dd>
        </div>
        <div>
          <dt className="text-xs text-tenue flex items-center gap-1"><Timer className="h-3.5 w-3.5" /> Entrega</dt>
          <dd className="font-medium">{f.tiempo_entrega_dias != null ? `${f.tiempo_entrega_dias} días hábiles` : (f.tipo === "equipo" ? "Según taller" : "—")}</dd>
        </div>
        <div>
          <dt className="text-xs text-tenue flex items-center gap-1"><Truck className="h-3.5 w-3.5" /> Envío gratis</dt>
          <dd className="font-medium">
            {f.envio_gratis ? <Insignia tono="ok">Sí aplica</Insignia>
              : f.envio_gratis_desde ? <span className="text-sm">desde {numero(f.envio_gratis_desde)} pzas</span>
              : <span className="text-tenue">No aplica</span>}
          </dd>
        </div>
      </dl>

      {!compacta && ((f.precio_ml != null && !fabricado) || f.publicacion_ml) && (
        <div className="rounded-lg bg-fondo p-2.5 text-sm space-y-1">
          <p className="text-xs font-medium text-tenue uppercase tracking-wide">Mercado Libre</p>
          {f.publicacion_ml?.precio != null && (
            <p className="flex justify-between gap-2"><span>Publicado</span>
              <span className="cifra font-medium inline-flex items-center gap-1">{dinero(f.publicacion_ml.precio)}
                {f.publicacion_ml.url && <a href={f.publicacion_ml.url} target="_blank" rel="noreferrer" className="text-marca-texto"><ExternalLink className="h-3.5 w-3.5" /></a>}
              </span></p>
          )}
          <p className="flex justify-between gap-2"><span className="text-tenue">Sugerido sin envío</span><span className="cifra">{dinero(f.precio_ml)}</span></p>
          <p className="flex justify-between gap-2"><span className="text-tenue">Sugerido con envío</span><span className="cifra">{dinero(f.precio_ml_con_envio)}</span></p>
        </div>
      )}

      {!compacta && f.precio != null && (planes.data?.length ?? 0) > 0 && (
        <div className="text-sm">
          <p className="text-xs font-medium text-tenue uppercase tracking-wide mb-1">Mensualidades (1 pieza, con IVA)</p>
          <div className="grid grid-cols-3 gap-1.5">
            {planes.data!.map((p) => (
              <div key={p.meses} className="rounded-md bg-fondo px-2 py-1">
                <p className="text-[11px] text-tenue">{p.meses} meses</p>
                <p className="text-xs font-medium cifra">{dinero(mensualidad(f.precio! * (1 + tasaIva), p))}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      {f.actualizado && <p className="text-[11px] text-tenue">Precio recalculado {fechaYHora(f.actualizado)}</p>}
    </div>
  );
}

import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, MapPinned } from "lucide-react";
import { MapaMexico, FUENTE_MAPAS } from "@/components/graficas/MapaMexico";
import { useSesion } from "@/lib/sesion";
import { supabase } from "@/lib/supabase";
import { q } from "@/lib/consultas";
import { dineroCompacto, porcentaje } from "@/lib/formato";
import { VACIO, escalaCuantiles, LeyendaEscala } from "./comun";
import type { DatosMapa } from "./MapaVentas";

/** Tarjeta chica del inicio de dirección: dónde se vendió este año, y la puerta al análisis. */
export function DondeVendemos() {
  const { puede } = useSesion();
  const anio = new Date().getFullYear();
  const desde = `${anio}-01-01`;
  const hasta = new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
  const m = useQuery({
    queryKey: ["analisis_mapa", desde, hasta, null],
    enabled: puede("analisis"),
    queryFn: () => q<DatosMapa>(supabase.rpc("analisis_mapa", { p_desde: desde, p_hasta: hasta, p_cve_ent: null })),
    refetchInterval: 300_000,
  });
  const porCve = useMemo(() => new Map((m.data?.regiones ?? []).map((r) => [r.cve, r.monto])), [m.data]);
  const escala = useMemo(() => escalaCuantiles([...porCve.values()], 5), [porCve]);
  if (!puede("analisis")) return null;
  const top = (m.data?.regiones ?? []).filter((r) => r.monto > 0).slice(0, 3);

  return (
    <section className="tarjeta p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold flex items-center gap-2"><MapPinned className="h-4 w-4 text-marca" /> Dónde vendemos {anio}</h3>
          <p className="text-xs text-tenue mt-0.5">
            {m.data ? <>{m.data.regiones_con_venta} estados con venta · los 3 primeros pesan {porcentaje(m.data.concentracion_top3, 0)}</> : "Cargando…"}
          </p>
        </div>
        <Link to="/analisis" className="text-sm text-marca-texto inline-flex items-center gap-1 shrink-0 hover:underline">Análisis <ArrowRight className="h-3.5 w-3.5" /></Link>
      </div>
      <Link to="/analisis" aria-label="Abrir el mapa de ventas" className="block w-full max-w-[340px] mx-auto rounded-lg hover:bg-fondo/60 transition">
        <MapaMexico compacto color={(cve) => (porCve.get(cve) ?? 0) > 0 ? escala.colores[escala.claseDe(porCve.get(cve)!)] : VACIO} />
      </Link>
      <ol className="space-y-1 text-sm">
        {top.map((r, i) => (
          <li key={r.cve} className="flex items-baseline gap-2">
            <span className="text-xs text-tenue cifra w-3">{i + 1}</span>
            <span className="truncate">{r.nombre}</span>
            <span className="ml-auto cifra font-medium">{dineroCompacto(r.monto)}</span>
            <span className="text-xs text-tenue cifra w-10 text-right">{porcentaje(r.participacion, 0)}</span>
          </li>
        ))}
      </ol>
      <LeyendaEscala escala={escala} formato={dineroCompacto} className="text-[11px]" />
      <p className="text-[10px] text-tenue">{FUENTE_MAPAS}.</p>
    </section>
  );
}

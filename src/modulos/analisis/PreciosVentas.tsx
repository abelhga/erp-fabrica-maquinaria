import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { TrendingUp } from "lucide-react";
import { Pagina } from "@/components/layout/Shell";
import { Tarjeta, EncabezadoTarjeta } from "@/components/ui/tarjeta";
import { Seleccion } from "@/components/ui/campo";
import { Kpi } from "@/components/ui/kpi";
import { Cargando, ErrorCarga } from "@/components/ui/estados";
import { SERIE, TooltipGrafica, ejeProps, Leyenda } from "@/components/graficas/comunes";
import { supabase } from "@/lib/supabase";
import { q } from "@/lib/consultas";
import { dinero, dineroCompacto, numero } from "@/lib/formato";

interface Punto { mes: string; indice_costo: number | null; indice_precio: number | null; equipos: number; ventas_importe: number; ventas_num: number }
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const etiqueta = (m: string) => { const [a, mm] = m.split("-"); return `${MESES[Number(mm) - 1]} ${a.slice(2)}`; };

/** Correlación de Pearson; null si no hay variación o hay muy pocos puntos. */
function pearson(x: number[], y: number[]) {
  if (x.length < 4) return null;
  const mx = x.reduce((a, b) => a + b, 0) / x.length, my = y.reduce((a, b) => a + b, 0) / y.length;
  let num = 0, dx = 0, dy = 0;
  x.forEach((v, i) => { num += (v - mx) * (y[i] - my); dx += (v - mx) ** 2; dy += (y[i] - my) ** 2; });
  return dx && dy ? num / Math.sqrt(dx * dy) : null;
}

/**
 * Cómo se movió el costo (y, desde el arranque, el precio) de una familia de
 * equipos, junto a lo que se vendió de esa familia. Dos gráficas con el mismo
 * eje de tiempo y escalas separadas: mezclar índice y pesos en un eje engaña.
 */
export default function PreciosVentas() {
  const [familia, setFamilia] = useState("Banda Transportadora");
  const [desde, setDesde] = useState("2021-01-01");
  const familias = useQuery({
    queryKey: ["familias_equipo"],
    queryFn: () => q<{ familia: string; equipos: number }[]>(supabase.from("v_familias_equipo").select("*").order("equipos", { ascending: false })),
  });
  const datos = useQuery({
    queryKey: ["analisis_precios", familia, desde],
    queryFn: () => q<Punto[]>(supabase.rpc("analisis_precios_familia", { p_familia: familia, p_desde: desde })),
  });

  const serie = (datos.data ?? []).map((p) => ({
    mes: etiqueta(p.mes.slice(0, 7)), "Costo": p.indice_costo, "Precio de lista": p.indice_precio, "Ventas": Number(p.ventas_importe), n: p.ventas_num,
  }));

  // Por trimestre: con pocas ventas al mes, el mes a mes es puro ruido.
  const relacion = useMemo(() => {
    const t = new Map<string, { ic: number[]; v: number }>();
    for (const p of datos.data ?? []) {
      if (p.indice_costo == null) continue;
      const [a, m] = p.mes.split("-");
      const k = `${a}T${Math.ceil(Number(m) / 3)}`;
      const x = t.get(k) ?? { ic: [], v: 0 };
      x.ic.push(Number(p.indice_costo)); x.v += Number(p.ventas_importe);
      t.set(k, x);
    }
    const filas = [...t.values()].filter((x) => x.ic.length === 3);
    return { r: pearson(filas.map((x) => x.ic.reduce((a, b) => a + b, 0) / 3), filas.map((x) => x.v)), trimestres: filas.length };
  }, [datos.data]);

  const ultimo = datos.data?.filter((p) => p.indice_costo != null).at(-1);
  const total = (datos.data ?? []).reduce((s, p) => s + Number(p.ventas_importe), 0);
  const fuerza = (r: number) => (Math.abs(r) < 0.2 ? "prácticamente nula" : Math.abs(r) < 0.5 ? "débil" : Math.abs(r) < 0.7 ? "moderada" : "fuerte");

  return (
    <Pagina titulo="Precios vs ventas" descripcion="Cómo se movieron costo y precio de cada familia de equipos, y qué se vendió en esos meses."
      acciones={<>
        <Seleccion value={familia} onChange={(e) => setFamilia(e.target.value)} className="w-64">
          {(familias.data ?? []).map((f) => <option key={f.familia} value={f.familia}>{f.familia} ({f.equipos})</option>)}
        </Seleccion>
        <Seleccion value={desde} onChange={(e) => setDesde(e.target.value)} className="w-36">
          {["2019-01-01", "2021-01-01", "2023-01-01", "2025-01-01"].map((d) => <option key={d} value={d}>Desde {d.slice(0, 4)}</option>)}
        </Seleccion>
      </>}>
      {datos.error ? <ErrorCarga error={datos.error} /> : datos.isLoading ? <Cargando /> : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Kpi titulo="Costo hoy vs. inicio del periodo" icono={TrendingUp} tono={ultimo && Number(ultimo.indice_costo) > 100 ? "aviso" : "ok"}
              valor={ultimo ? `${Number(ultimo.indice_costo) >= 100 ? "+" : ""}${(Number(ultimo.indice_costo) - 100).toFixed(1)}%` : "—"}
              detalle={`Promedio encadenado de ${numero(ultimo?.equipos)} equipos`} />
            <Kpi titulo="Vendido en el periodo" icono={TrendingUp} tono="marca" valor={dineroCompacto(total)}
              detalle={`${numero((datos.data ?? []).reduce((s, p) => s + p.ventas_num, 0))} ventas de la familia`} />
            <Kpi titulo="Relación costo ↔ ventas" icono={TrendingUp} tono="info"
              valor={relacion.r == null ? "—" : relacion.r.toFixed(2)}
              detalle={relacion.r == null ? "Faltan datos para calcularla" : `${fuerza(relacion.r)} en ${relacion.trimestres} trimestres (orientativa: no es causa)`} />
          </div>

          <Tarjeta>
            <EncabezadoTarjeta titulo="Índice de costo y de precio" descripcion="Base 100 al inicio del periodo. El precio de lista se registra desde el arranque del ERP; antes la hoja no guardaba la utilidad aplicada." />
            <div className="px-5"><Leyenda series={[{ nombre: "Costo", color: SERIE(1) }, { nombre: "Precio de lista", color: SERIE(2) }]} /></div>
            <div className="h-64 px-2 pb-3 pt-2">
              <ResponsiveContainer>
                <LineChart data={serie} margin={{ top: 8, right: 16, left: 4, bottom: 0 }} syncId="pv">
                  <CartesianGrid vertical={false} stroke="var(--rejilla)" />
                  <XAxis dataKey="mes" {...ejeProps} minTickGap={24} />
                  <YAxis {...ejeProps} width={40} domain={["auto", "auto"]} />
                  <ReferenceLine y={100} stroke="var(--eje)" strokeDasharray="3 3" />
                  <Tooltip content={<TooltipGrafica formato={(v) => (v == null ? "—" : Number(v).toFixed(1))} />} />
                  <Line type="monotone" dataKey="Costo" stroke={SERIE(1)} strokeWidth={2} dot={false} connectNulls />
                  <Line type="monotone" dataKey="Precio de lista" stroke={SERIE(2)} strokeWidth={2} dot={false} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Tarjeta>

          <Tarjeta>
            <EncabezadoTarjeta titulo="Ventas de la familia" descripcion="Importe con IVA por mes. Antes del arranque: libro de ventas de la hoja (ventas desde $40,000 clasificadas por descripción); después: pedidos del ERP." />
            <div className="h-56 px-2 pb-3">
              <ResponsiveContainer>
                <BarChart data={serie} margin={{ top: 8, right: 16, left: 4, bottom: 0 }} syncId="pv">
                  <CartesianGrid vertical={false} stroke="var(--rejilla)" />
                  <XAxis dataKey="mes" {...ejeProps} minTickGap={24} />
                  <YAxis {...ejeProps} width={56} tickFormatter={(v) => dineroCompacto(v)} />
                  <Tooltip cursor={{ fill: "var(--rejilla)", opacity: 0.4 }} content={<TooltipGrafica formato={(v) => dinero(v)} />} />
                  <Bar dataKey="Ventas" fill={SERIE(3)} radius={[4, 4, 0, 0]} maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Tarjeta>
        </>
      )}
    </Pagina>
  );
}

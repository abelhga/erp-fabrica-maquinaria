import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Info, Save } from "lucide-react";
import { Tarjeta, EncabezadoTarjeta } from "@/components/ui/tarjeta";
import { Boton } from "@/components/ui/boton";
import { Campo, Entrada } from "@/components/ui/campo";
import { Cargando } from "@/components/ui/estados";
import { SERIE, TooltipGrafica, ejeProps } from "@/components/graficas/comunes";
import { useSesion } from "@/lib/sesion";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { fecha, hoyISO } from "@/lib/formato";
import { SoloLectura } from "./Editables";

interface Tc { fecha: string; moneda: "USD" | "EUR"; valor: number; fuente: string | null }

const fmt = (v: number) => `$${Number(v).toFixed(4)}`;

export function ConfigTipoCambio() {
  const { puede } = useSesion();
  const editable = puede("compras", 2) || puede("finanzas", 2);
  const datos = useQuery({
    queryKey: ["tipos_cambio", "historial"],
    queryFn: () => q<Tc[]>(supabase.from("tipos_cambio").select("fecha, moneda, valor, fuente").order("fecha", { ascending: false }).limit(240)),
  });
  const ultimo = (m: "USD" | "EUR") => datos.data?.find((t) => t.moneda === m);
  const [f, setF] = useState<{ fecha: string; USD: string; EUR: string } | null>(null);
  const valores = f ?? { fecha: hoyISO(), USD: ultimo("USD") ? String(ultimo("USD")!.valor) : "", EUR: ultimo("EUR") ? String(ultimo("EUR")!.valor) : "" };
  const guardar = useAccion(() => {
    const filas = (["USD", "EUR"] as const).filter((m) => Number(valores[m]) > 0).map((m) => ({ fecha: valores.fecha, moneda: m, valor: Number(valores[m]), fuente: "manual" }));
    return q(supabase.from("tipos_cambio").upsert(filas));
  }, {
    exito: "Tipo de cambio guardado: costos y precios en dólares se recalculan", invalidar: [["tipos_cambio"], ["v_por_pagar"], ["v_cobranza"]],
    alTerminar: () => setF(null),
  });

  const serie = [...(datos.data ?? [])].filter((t) => t.moneda === "USD").reverse().slice(-60)
    .map((t) => ({ dia: fecha(t.fecha).slice(0, 6), Dólar: Number(t.valor) }));
  const valoresUsd = serie.map((s) => s.Dólar);

  return (
    <div className="grid gap-4 lg:grid-cols-[360px_1fr] items-start">
      <div className="space-y-4">
        <Tarjeta>
          <EncabezadoTarjeta titulo="Captura del día" descripcion="Con el más reciente se convierten los costos en dólares y los saldos de proveedores y clientes." />
          <form className="px-5 pb-5 space-y-4" onSubmit={(e: FormEvent) => { e.preventDefault(); guardar.mutate(undefined); }}>
            <fieldset disabled={!editable} className="space-y-4">
              <Campo etiqueta="Fecha"><Entrada type="date" value={valores.fecha} max={hoyISO()} onChange={(e) => setF({ ...valores, fecha: e.target.value })} /></Campo>
              <div className="grid grid-cols-2 gap-3">
                <Campo etiqueta="Dólar (USD)" ayuda={ultimo("USD") ? `Último: ${fmt(ultimo("USD")!.valor)} del ${fecha(ultimo("USD")!.fecha)}` : undefined}>
                  <Entrada type="number" step="0.0001" min="0" value={valores.USD} onChange={(e) => setF({ ...valores, USD: e.target.value })} className="cifra" />
                </Campo>
                <Campo etiqueta="Euro (EUR)" ayuda={ultimo("EUR") ? `Último: ${fmt(ultimo("EUR")!.valor)} del ${fecha(ultimo("EUR")!.fecha)}` : undefined}>
                  <Entrada type="number" step="0.0001" min="0" value={valores.EUR} onChange={(e) => setF({ ...valores, EUR: e.target.value })} className="cifra" />
                </Campo>
              </div>
            </fieldset>
            {editable ? <Boton type="submit" className="w-full" cargando={guardar.isPending}><Save className="h-4 w-4" /> Guardar</Boton>
              : <SoloLectura quien="compras o finanzas (y dirección)" />}
          </form>
        </Tarjeta>
        <p className="text-xs text-tenue flex gap-2 px-1">
          <Info className="h-4 w-4 shrink-0" />
          A futuro se puede traer solo del Banxico (serie FIX, SF43718) todos los días hábiles; mientras, se captura aquí o en Cobranza y Pagos.
        </p>
      </div>
      <Tarjeta>
        <EncabezadoTarjeta titulo="Dólar, últimos registros" descripcion="Pesos por dólar" />
        {datos.isLoading ? <Cargando /> : (
          <>
            {serie.length > 1 && (
              <div className="h-52 px-2">
                <ResponsiveContainer>
                  <LineChart data={serie} margin={{ top: 8, right: 16, left: 4, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="var(--rejilla)" />
                    <XAxis dataKey="dia" {...ejeProps} minTickGap={24} />
                    <YAxis {...ejeProps} width={52} domain={[Math.floor(Math.min(...valoresUsd) * 10) / 10, Math.ceil(Math.max(...valoresUsd) * 10) / 10]} tickFormatter={(v) => `$${v}`} />
                    <Tooltip content={<TooltipGrafica formato={fmt} />} />
                    <Line type="linear" dataKey="Dólar" stroke={SERIE(1)} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="max-h-72 overflow-y-auto border-t border-borde">
              <table className="tabla">
                <thead><tr><th>Fecha</th><th>Moneda</th><th className="!text-right">Valor</th><th>Fuente</th></tr></thead>
                <tbody>
                  {(datos.data ?? []).slice(0, 60).map((t) => (
                    <tr key={`${t.fecha}-${t.moneda}`}>
                      <td>{fecha(t.fecha)}</td><td>{t.moneda}</td><td className="text-right cifra">{fmt(t.valor)}</td>
                      <td className="text-tenue">{t.fuente === "manual" ? "Captura" : t.fuente ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Tarjeta>
    </div>
  );
}

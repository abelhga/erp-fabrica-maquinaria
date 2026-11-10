import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PhoneOff } from "lucide-react";
import { Cargando, ErrorCarga, Vacio } from "@/components/ui/estados";
import { Leyenda, SERIE, TooltipGrafica, ejeProps } from "@/components/graficas/comunes";
import { supabase } from "@/lib/supabase";
import { q } from "@/lib/consultas";
import { numero, porcentaje } from "@/lib/formato";
import { BarraRanking, Cifra, TarjetaGrafica, usePeriodo } from "./comun";
import { GLOSARIO } from "@/tutorial/glosario";

/**
 * El teléfono como negocio: si las llamadas llegan a cotización y a pedido (embudo), si las que
 * nadie contestó se regresan y qué tan rápido, y si una llamada bien calificada vende más que una
 * mal calificada (¿sirve el coaching?). Solo conteos, sin montos ni quién llamó (telefono_tablero);
 * la parte del coaching solo llega a quien puede ver el coaching de todos.
 */

interface Datos {
  desde: string; hasta: string;
  embudo: { llamadas: number; atendidas: number; leads: number; cotizaciones: number; pedidos: number };
  semanas: { semana: string; llamadas: number; leads: number; cotizaciones: number }[];
  regresar: { nadie_contesto: number; regresadas: number; en_2h: number; mediana_horas: number | null;
    semanas: { semana: string; regresadas: number; sin_regresar: number }[] };
  coaching_resultado: { banda: "baja" | "media" | "alta"; n: number; cotizaron: number; pidieron: number }[] | null;
}

const diaMes = new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short", timeZone: "America/Mexico_City" });
const semanaCorta = (iso: string) => diaMes.format(new Date(iso + "T12:00:00-06:00"));
const restarDias = (iso: string, d: number) => { const x = new Date(iso + "T12:00:00-06:00"); x.setDate(x.getDate() - d); return x.toLocaleDateString("en-CA"); };
const pct = (a: number, b: number) => (b > 0 ? porcentaje(a / b, 0) : "—");
const BANDA: Record<string, string> = { baja: "Menos de 5", media: "De 5 a 7", alta: "7 o más" };

export default function TelefonoTablero() {
  const { periodo } = usePeriodo();
  const minimo = restarDias(periodo.hasta, 400);
  const desde = periodo.desde < minimo ? minimo : periodo.desde;
  const datos = useQuery({
    queryKey: ["telefono_tablero", desde, periodo.hasta],
    queryFn: () => q<Datos>(supabase.rpc("telefono_tablero", { p_desde: desde, p_hasta: periodo.hasta })),
    placeholderData: keepPreviousData,
  });
  if (datos.error) return <ErrorCarga error={datos.error} />;
  if (!datos.data) return <Cargando filas={8} />;
  const d = datos.data;
  if (!d.embudo.llamadas) {
    return (
      <div className="tarjeta">
        <Vacio icono={PhoneOff} titulo="No hay llamadas en este periodo"
          texto="El tablero sale solo de las llamadas del conmutador con IA. Si no está conectado, se conecta en Configuración → Integraciones → Teléfono; si ya lo está, elige un periodo más largo." />
      </div>
    );
  }
  return <Contenido d={d} />;
}

function Contenido({ d }: { d: Datos }) {
  const e = d.embudo;
  const pasos = [
    { clave: "llamadas", nombre: "Llamadas", n: e.llamadas, explica: GLOSARIO.embudoTelefono },
    { clave: "atendidas", nombre: "Las atendió una persona", n: e.atendidas, explica: GLOSARIO.embudoTelefono },
    { clave: "leads", nombre: "Dejaron un lead", n: e.leads, explica: GLOSARIO.embudoTelefono },
    { clave: "cotizaciones", nombre: "Llegaron a cotización", n: e.cotizaciones, explica: GLOSARIO.embudoTelefono },
    { clave: "pedidos", nombre: "Llegaron a pedido", n: e.pedidos, explica: GLOSARIO.embudoTelefono },
  ];
  const semanas = d.semanas.map((s) => ({ etiqueta: semanaCorta(s.semana), Llamadas: s.llamadas, Leads: s.leads, Cotizaciones: s.cotizaciones }));
  const r = d.regresar;
  const regresar = r.semanas.map((s) => ({ etiqueta: semanaCorta(s.semana), Regresadas: s.regresadas, "Sin regresar": s.sin_regresar }));
  const bandas = d.coaching_resultado?.filter((b) => b.n > 0) ?? [];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Cifra titulo="Llamadas" valor={<span className="cifra">{numero(e.llamadas)}</span>} explica={GLOSARIO.embudoTelefono}
          detalle={`${pct(e.atendidas, e.llamadas)} las atendió una persona`} />
        <Cifra titulo="Llegaron a cotización" valor={<span className="cifra">{numero(e.cotizaciones)}</span>} explica={GLOSARIO.embudoTelefono}
          detalle={`${pct(e.cotizaciones, e.llamadas)} de las llamadas · ${numero(e.pedidos)} a pedido`} />
        <Cifra titulo="Regresadas" valor={<span className="cifra">{pct(r.regresadas, r.nadie_contesto)}</span>} explica={GLOSARIO.regresarTelefono}
          detalle={`${numero(r.regresadas)} de ${numero(r.nadie_contesto)} que nadie contestó`} />
        <Cifra titulo="Tiempo para regresarla" explica={GLOSARIO.regresarTelefono}
          valor={<span className="cifra">{r.mediana_horas == null ? "—" : `${numero(r.mediana_horas)} h`}</span>}
          detalle={`la mitad, en menos de eso · ${numero(r.en_2h)} en 2 horas o menos`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <TarjetaGrafica titulo="De la llamada al pedido" explica={GLOSARIO.embudoTelefono}
          descripcion="Cuántas llamadas llegaron a cada paso; a la derecha, cuántas pasaron del paso anterior">
          <div className="px-5 pb-5 space-y-3">
            {pasos.map((p, i) => (
              <div key={p.clave}>
                <div className="flex items-baseline justify-between text-sm mb-1">
                  <span>{p.nombre}</span>
                  <span className="cifra"><b>{numero(p.n)}</b>{i > 0 && <span className="text-tenue"> · {pct(p.n, pasos[i - 1].n)}</span>}</span>
                </div>
                <BarraRanking valor={p.n} max={e.llamadas} className="h-3" />
              </div>
            ))}
          </div>
        </TarjetaGrafica>

        {bandas.length > 0 ? (
          <TarjetaGrafica titulo="¿Sirve el coaching?" explica={GLOSARIO.coachingResultado}
            descripcion="De las llamadas de venta calificadas, cuántas llegaron a cotización, según su calificación">
            <div className="px-5 pb-5 space-y-4">
              {bandas.map((b) => (
                <div key={b.banda}>
                  <div className="flex items-baseline justify-between text-sm mb-1">
                    <span>Calificación {BANDA[b.banda].toLowerCase()}</span>
                    <span className="cifra"><b>{pct(b.cotizaron, b.n)}</b><span className="text-tenue"> · {numero(b.cotizaron)} de {numero(b.n)}</span></span>
                  </div>
                  <BarraRanking valor={b.cotizaron} max={b.n} className="h-3" />
                </div>
              ))}
              <p className="text-xs text-tenue">Si las mejor calificadas cotizan más, lo que pide la rúbrica es lo que vende. Con pocas llamadas, la diferencia todavía puede ser suerte.</p>
            </div>
          </TarjetaGrafica>
        ) : (
          <TarjetaGrafica titulo="Llamadas por semana" explica={GLOSARIO.embudoTelefono} descripcion="Llamadas, leads y cotizaciones de cada semana">
            <Semanas datos={semanas} />
          </TarjetaGrafica>
        )}
      </div>

      {bandas.length > 0 && (
        <TarjetaGrafica titulo="Semana a semana" explica={GLOSARIO.embudoTelefono} descripcion="Llamadas, leads y cotizaciones de cada semana">
          <Semanas datos={semanas} />
        </TarjetaGrafica>
      )}

      {r.nadie_contesto > 0 && (
        <TarjetaGrafica titulo="Las que nadie contestó: ¿se regresaron?" explica={GLOSARIO.regresarTelefono}
          descripcion="Cada semana, las que alguien regresó y las que se quedaron sin regresar">
          <div className="h-56 px-2">
            <ResponsiveContainer>
              <BarChart data={regresar} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--rejilla)" />
                <XAxis dataKey="etiqueta" {...ejeProps} interval="preserveStartEnd" minTickGap={16} />
                <YAxis {...ejeProps} width={32} allowDecimals={false} />
                <Tooltip cursor={{ fill: "var(--rejilla)" }} content={<TooltipGrafica formato={(v) => numero(v)} />} />
                <Bar dataKey="Regresadas" stackId="a" fill={SERIE(1)} isAnimationActive={false} />
                <Bar dataKey="Sin regresar" stackId="a" fill={SERIE(2)} radius={[3, 3, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="px-5 pb-4"><Leyenda series={[{ nombre: "Regresadas", color: SERIE(1) }, { nombre: "Sin regresar", color: SERIE(2) }]} /></div>
        </TarjetaGrafica>
      )}
    </div>
  );
}

function Semanas({ datos }: { datos: { etiqueta: string; Llamadas: number; Leads: number; Cotizaciones: number }[] }) {
  return (
    <>
      <div className="h-60 px-2">
        <ResponsiveContainer>
          <LineChart data={datos} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--rejilla)" />
            <XAxis dataKey="etiqueta" {...ejeProps} interval="preserveStartEnd" minTickGap={16} />
            <YAxis {...ejeProps} width={32} allowDecimals={false} />
            <Tooltip content={<TooltipSemanas />} />
            <Line dataKey="Llamadas" stroke={SERIE(1)} strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
            <Line dataKey="Leads" stroke={SERIE(2)} strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
            <Line dataKey="Cotizaciones" stroke={SERIE(3)} strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="px-5 pb-4"><Leyenda series={[{ nombre: "Llamadas", color: SERIE(1) }, { nombre: "Leads", color: SERIE(2) }, { nombre: "Cotizaciones", color: SERIE(3) }]} /></div>
    </>
  );
}

/** Tooltip sin «Total»: llamadas, leads y cotizaciones no se suman (una contiene a la otra). */
function TooltipSemanas({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-borde bg-superficie px-3 py-2 text-xs shadow-sm">
      <p className="font-medium mb-1">Semana del {label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 py-0.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} />
          <span className="text-tenue">{p.name}</span>
          <span className="ml-auto cifra font-medium">{numero(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Cargando, ErrorCarga } from "@/components/ui/estados";
import { Leyenda, SERIE, ejeProps } from "@/components/graficas/comunes";
import { supabase } from "@/lib/supabase";
import { q } from "@/lib/consultas";
import { dinero, dineroCompacto, porcentaje } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import {
  DIV, FAMILIAS_CON_COLOR, LeyendaEscala, MESES_CORTOS, MESES_LARGOS, SEQ_TINTA, TarjetaGrafica, colorFamilia, escalaCuantiles,
} from "./comun";

interface Mes { mes: string; monto: number; operaciones: number; clientes: number; parcial: boolean; movil_12: number | null; crecimiento_12: number | null }
interface DatosTendencias {
  hoy: string; mensual: Mes[];
  familias: { clave: string; nombre: string; orden: number }[];
  familias_anio: { anio: number; familia: string; monto: number }[];
}

const etiquetaMes = (iso: string) => `${MESES_CORTOS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(2, 4)}`;

export default function Tendencias() {
  const t = useQuery({ queryKey: ["analisis_tendencias"], queryFn: () => q<DatosTendencias>(supabase.rpc("analisis_tendencias", {})) });
  const d = t.data;
  const anioActual = d ? Number(d.hoy.slice(0, 4)) : new Date().getFullYear();

  // Año contra año: un renglón por mes, una columna por año.
  const anios = useMemo(() => [...new Set((d?.mensual ?? []).map((m) => Number(m.mes.slice(0, 4))))].sort(), [d]);
  const porMes = useMemo(() => MESES_CORTOS.map((nombre, i) => {
    const fila: Record<string, string | number | null> = { mes: nombre, i };
    for (const a of anios) {
      const m = d?.mensual.find((x) => x.mes.startsWith(`${a}-${String(i + 1).padStart(2, "0")}`));
      // El mes en curso va a medias: dibujarlo parecía una caída.
      fila[String(a)] = m && !m.parcial ? Number(m.monto) : null;
    }
    return fila;
  }), [d, anios]);

  const movil = useMemo(() => (d?.mensual ?? []).filter((m) => m.movil_12 != null && !m.parcial).map((m) => ({ mes: m.mes, etiqueta: etiquetaMes(m.mes), valor: Number(m.movil_12) })), [d]);
  const crec = useMemo(() => (d?.mensual ?? []).filter((m) => m.crecimiento_12 != null).map((m) => ({ mes: m.mes, etiqueta: etiquetaMes(m.mes), valor: Number(m.crecimiento_12) })), [d]);

  // Mapa de calor: año × mes, con cortes por cuantiles de todos los meses con venta.
  const escalaCalor = useMemo(() => escalaCuantiles((d?.mensual ?? []).filter((m) => !m.parcial).map((m) => Number(m.monto))), [d]);

  // Mezcla por familia: 7 familias con color fijo + "Resto" en gris.
  const nombreFam = useMemo(() => new Map((d?.familias ?? []).map((f) => [f.clave, f.nombre])), [d]);
  const mezcla = useMemo(() => anios.map((a) => {
    const fila: Record<string, number | string> = { anio: String(a) };
    for (const f of FAMILIAS_CON_COLOR) fila[f] = 0;
    fila.resto = 0;
    for (const x of (d?.familias_anio ?? []).filter((x) => x.anio === a)) {
      const k = (FAMILIAS_CON_COLOR as readonly string[]).includes(x.familia) ? x.familia : "resto";
      fila[k] = Number(fila[k]) + Number(x.monto);
    }
    return fila;
  }), [d, anios]);
  const seriesMezcla = [...FAMILIAS_CON_COLOR.map((f) => ({ clave: f as string, nombre: nombreFam.get(f) ?? f, color: colorFamilia(f) })),
    { clave: "resto", nombre: "Resto (cosedoras, colectores, poleas, servicio, otros)", color: "var(--serie-resto)" }];

  if (t.error) return <ErrorCarga error={t.error} />;
  if (!d) return <Cargando filas={8} />;

  const anterior = anioActual - 1;
  const viejos = anios.filter((a) => a < anterior);
  const totalAnio = (a: number) => d.mensual.filter((m) => m.mes.startsWith(String(a))).reduce((s, m) => s + Number(m.monto), 0);
  const ultimoCrec = crec[crec.length - 1];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-2">
        <TarjetaGrafica titulo={`Venta por mes: ${anioActual} contra ${anterior} y los años anteriores`}
          descripcion="Importe con IVA, con la misma regla que el tablero de inicio. Los años viejos en gris, para comparar la forma; el mes en curso entra cuando cierre."
          tabla={<TablaAnioMes anios={anios} porMes={porMes} />}>
          <div className="px-5"><Leyenda series={[
            { nombre: String(anioActual), color: SERIE(1) }, { nombre: String(anterior), color: SERIE(2) },
            ...(viejos.length ? [{ nombre: `${viejos[0]}–${viejos[viejos.length - 1]}`, color: "var(--serie-resto)" }] : []),
          ]} /></div>
          <div className="h-72 px-2 pb-3 pt-2">
            <ResponsiveContainer>
              <LineChart data={porMes} margin={{ top: 8, right: 16, left: 4, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--rejilla)" />
                <XAxis dataKey="mes" {...ejeProps} />
                <YAxis {...ejeProps} width={58} tickFormatter={(x) => dineroCompacto(x)} />
                <Tooltip cursor={{ stroke: "var(--eje)", strokeWidth: 1 }} content={<TooltipAnios anioActual={anioActual} anterior={anterior} />} />
                {viejos.map((a) => (
                  <Line key={a} dataKey={String(a)} stroke="var(--serie-resto)" strokeWidth={1} strokeOpacity={0.55} dot={false} isAnimationActive={false} />
                ))}
                <Line dataKey={String(anterior)} stroke={SERIE(2)} strokeWidth={2} dot={false} strokeLinecap="round" isAnimationActive={false} />
                <Line dataKey={String(anioActual)} stroke={SERIE(1)} strokeWidth={2} strokeLinecap="round" connectNulls={false}
                  dot={{ r: 4, fill: SERIE(1), stroke: "hsl(var(--superficie))", strokeWidth: 2 }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </TarjetaGrafica>

        <TarjetaGrafica titulo="Venta de los últimos 12 meses, mes con mes"
          descripcion="Cada punto suma los 12 meses que terminan ahí: quita la estacionalidad y deja ver la tendencia."
          tabla={<TablaSimple filas={movil.map((m) => ({ etiqueta: etiquetaMes(m.mes), valor: dinero(m.valor) }))} titulo="Últimos 12 meses" />}>
          <div className="h-64 px-2 pb-3">
            <ResponsiveContainer>
              <LineChart data={movil} margin={{ top: 8, right: 16, left: 4, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--rejilla)" />
                <XAxis dataKey="etiqueta" {...ejeProps} interval="preserveStartEnd" minTickGap={28} />
                <YAxis {...ejeProps} width={58} tickFormatter={(x) => dineroCompacto(x)} />
                <Tooltip cursor={{ stroke: "var(--eje)", strokeWidth: 1 }} content={<TooltipUno formato={dinero} nombre="12 meses" />} />
                <Line dataKey="valor" stroke={SERIE(1)} strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </TarjetaGrafica>
      </div>

        <TarjetaGrafica titulo="Estacionalidad: venta por año y mes"
          descripcion="Cada celda es un mes, con el tono de la leyenda de abajo. Sirve para ver qué meses pesan cada año."
          tabla={<TablaAnioMes anios={anios} porMes={porMes} />}
          pie={<LeyendaEscala escala={escalaCalor} formato={dineroCompacto} vacio={null} />}>
          <div className="px-5 pb-2 overflow-x-auto">
            <table className="w-full text-[11px] border-separate" style={{ borderSpacing: 2 }}>
              <thead>
                <tr><th className="text-left font-medium text-tenue pr-2" />{MESES_CORTOS.map((m) => <th key={m} className="font-medium text-tenue">{m}</th>)}
                  <th className="font-medium text-tenue text-right pl-2">Año</th></tr>
              </thead>
              <tbody>
                {[...anios].reverse().map((a) => (
                  <tr key={a}>
                    <th className="text-left font-medium pr-2 cifra">{a}</th>
                    {MESES_CORTOS.map((_, i) => {
                      const m = d.mensual.find((x) => x.mes.startsWith(`${a}-${String(i + 1).padStart(2, "0")}`));
                      if (!m) return <td key={i} />;
                      const v = Number(m.monto);
                      const k = escalaCalor.claseDe(v);
                      const tono = escalaCalor.colores[k];
                      const n = Number(tono.match(/\d+/)?.[0] ?? 1);
                      return (
                        <td key={i} title={`${MESES_LARGOS[i]} ${a}: ${dinero(v)}${m.parcial ? " (mes en curso)" : ""}`}
                          aria-label={`${MESES_LARGOS[i]} ${a}: ${dinero(v)}`}
                          className={cn("h-7 rounded-[3px] text-center cifra", m.parcial && "opacity-60")}
                          style={{ background: v > 0 ? tono : "var(--mapa-vacio)", color: v > 0 ? SEQ_TINTA(n) : undefined }}>
                          <span className="hidden sm:inline">{v > 0 ? dineroCompacto(v).replace("$", "") : ""}</span>
                        </td>
                      );
                    })}
                    <td className="text-right pl-2 cifra font-medium">{dineroCompacto(totalAnio(a))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TarjetaGrafica>

        <TarjetaGrafica titulo="Crecimiento anual móvil"
          descripcion={<>Los 12 meses que terminan en cada mes contra los 12 anteriores. Azul creció, rojo cayó.
            {ultimoCrec && <> Al cierre de {etiquetaMes(ultimoCrec.mes)}: <b className="text-texto">{ultimoCrec.valor >= 0 ? "+" : "−"}{porcentaje(Math.abs(ultimoCrec.valor), 1)}</b>.</>}</>}
          tabla={<TablaSimple filas={crec.map((m) => ({ etiqueta: etiquetaMes(m.mes), valor: `${m.valor >= 0 ? "+" : "−"}${porcentaje(Math.abs(m.valor), 1)}` }))} titulo="Crecimiento" />}>
          <div className="h-64 px-2 pb-3">
            <ResponsiveContainer>
              <BarChart data={crec} margin={{ top: 8, right: 16, left: 4, bottom: 0 }} barCategoryGap={1}>
                <CartesianGrid vertical={false} stroke="var(--rejilla)" />
                <XAxis dataKey="etiqueta" {...ejeProps} interval="preserveStartEnd" minTickGap={28} />
                <YAxis {...ejeProps} width={48} tickFormatter={(x) => porcentaje(x, 0)} />
                <ReferenceLine y={0} stroke="var(--eje)" />
                <Tooltip cursor={{ fill: "var(--rejilla)", opacity: 0.35 }} content={<TooltipUno formato={(v) => `${v >= 0 ? "+" : "−"}${porcentaje(Math.abs(v), 1)}`} nombre="Crecimiento" />} />
                <Bar dataKey="valor" maxBarSize={10} isAnimationActive={false}>
                  {crec.map((m) => <Cell key={m.mes} fill={m.valor >= 0 ? DIV(6) : DIV(2)} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </TarjetaGrafica>

      <TarjetaGrafica titulo="Mezcla por familia de producto"
        descripcion="Qué parte de la venta de cada año fue de cada familia. Las familias salen del texto de cada venta (reglas en «Producto × región»)."
        tabla={<TablaMezcla mezcla={mezcla} series={seriesMezcla} />}>
        <div className="px-5"><Leyenda series={seriesMezcla.map((s) => ({ nombre: s.nombre, color: s.color }))} /></div>
        <div className="h-80 px-2 pb-3 pt-2">
          <ResponsiveContainer>
            <BarChart data={mezcla} margin={{ top: 8, right: 16, left: 4, bottom: 0 }} stackOffset="expand">
              <CartesianGrid vertical={false} stroke="var(--rejilla)" />
              <XAxis dataKey="anio" {...ejeProps} />
              <YAxis {...ejeProps} width={44} tickFormatter={(x) => porcentaje(x, 0)} />
              <Tooltip cursor={{ fill: "var(--rejilla)", opacity: 0.35 }} content={<TooltipMezcla series={seriesMezcla} />} />
              {seriesMezcla.map((s) => (
                <Bar key={s.clave} dataKey={s.clave} name={s.nombre} stackId="m" fill={s.color} maxBarSize={56}
                  stroke="hsl(var(--superficie))" strokeWidth={1} isAnimationActive={false} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </TarjetaGrafica>
    </div>
  );
}

// --- tooltips con tinta de texto; el valor primero, el nombre después --------------------
interface PropsTooltip { active?: boolean; payload?: { dataKey: string; value: number | null; payload: Record<string, number | string> }[]; label?: string }

function TooltipAnios({ active, payload, label, anioActual, anterior }: PropsTooltip & { anioActual: number; anterior: number }) {
  if (!active || !payload?.length) return null;
  const filas = payload.filter((p) => p.value != null).sort((a, b) => Number(b.dataKey) - Number(a.dataKey));
  return (
    <div className="tarjeta px-3 py-2 text-xs shadow-lg min-w-[170px]">
      <p className="font-medium mb-1 capitalize">{MESES_LARGOS[MESES_CORTOS.indexOf(String(label))] ?? label}</p>
      {filas.map((p) => (
        <div key={p.dataKey} className={cn("flex items-center gap-2 py-0.5", Number(p.dataKey) < anterior && "text-tenue")}>
          <span className="h-0.5 w-3 rounded" style={{ background: Number(p.dataKey) === anioActual ? SERIE(1) : Number(p.dataKey) === anterior ? SERIE(2) : "var(--serie-resto)" }} />
          <span>{p.dataKey}</span>
          <span className={cn("ml-auto cifra", Number(p.dataKey) >= anterior && "font-semibold")}>{dinero(Number(p.value))}</span>
        </div>
      ))}
    </div>
  );
}

function TooltipUno({ active, payload, label, formato, nombre }: PropsTooltip & { formato: (v: number) => string; nombre: string }) {
  if (!active || !payload?.length) return null;
  const v = Number(payload[0].value);
  return (
    <div className="tarjeta px-3 py-2 text-xs shadow-lg">
      <p className="text-sm font-semibold cifra">{formato(v)}</p>
      <p className="text-tenue">{nombre} · {String(payload[0].payload.etiqueta ?? label)}</p>
    </div>
  );
}

function TooltipMezcla({ active, payload, label, series }: PropsTooltip & { series: { clave: string; nombre: string; color: string }[] }) {
  if (!active || !payload?.length) return null;
  const fila = payload[0].payload;
  const total = series.reduce((s, x) => s + Number(fila[x.clave] ?? 0), 0);
  return (
    <div className="tarjeta px-3 py-2 text-xs shadow-lg min-w-[240px]">
      <p className="font-medium mb-1">{label} · {dineroCompacto(total)}</p>
      {[...series].reverse().map((s) => {
        const v = Number(fila[s.clave] ?? 0);
        return (
          <div key={s.clave} className="flex items-center gap-2 py-0.5">
            <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: s.color }} />
            <span className="text-tenue truncate max-w-[150px]">{s.nombre.split(" (")[0]}</span>
            <span className="ml-auto cifra font-medium">{porcentaje(total ? v / total : 0, 0)}</span>
            <span className="cifra text-tenue w-14 text-right">{dineroCompacto(v)}</span>
          </div>
        );
      })}
    </div>
  );
}

// --- gemelas en tabla ------------------------------------------------------------------
function TablaAnioMes({ anios, porMes }: { anios: number[]; porMes: Record<string, string | number | null>[] }) {
  return (
    <div className="overflow-x-auto max-h-[420px] px-1 pb-2">
      <table className="tabla text-xs">
        <thead><tr><th>Mes</th>{[...anios].reverse().map((a) => <th key={a} className="text-right">{a}</th>)}</tr></thead>
        <tbody>
          {porMes.map((f) => (
            <tr key={String(f.mes)}>
              <td className="capitalize">{f.mes}</td>
              {[...anios].reverse().map((a) => <td key={a} className="text-right cifra">{f[String(a)] == null ? "—" : dinero(Number(f[String(a)]))}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TablaSimple({ filas, titulo }: { filas: { etiqueta: string; valor: string }[]; titulo: string }) {
  return (
    <div className="overflow-y-auto max-h-[300px] px-1 pb-2">
      <table className="tabla text-xs">
        <thead><tr><th>Mes</th><th className="text-right">{titulo}</th></tr></thead>
        <tbody>{[...filas].reverse().map((f) => <tr key={f.etiqueta}><td>{f.etiqueta}</td><td className="text-right cifra">{f.valor}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

function TablaMezcla({ mezcla, series }: { mezcla: Record<string, number | string>[]; series: { clave: string; nombre: string }[] }) {
  return (
    <div className="overflow-x-auto px-1 pb-2">
      <table className="tabla text-xs">
        <thead><tr><th>Familia</th>{mezcla.map((m) => <th key={String(m.anio)} className="text-right">{m.anio}</th>)}</tr></thead>
        <tbody>
          {series.map((s) => (
            <tr key={s.clave}>
              <td className="whitespace-nowrap">{s.nombre.split(" (")[0]}</td>
              {mezcla.map((m) => <td key={String(m.anio)} className="text-right cifra">{dineroCompacto(Number(m[s.clave] ?? 0))}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

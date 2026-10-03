import { useEffect, useId, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  AlertTriangle, ArrowDownRight, ArrowUpRight, Boxes, Factory, Flame, Gauge, PackageX, Sparkles, Target, TrendingUp, Wallet,
} from "lucide-react";
import { Tarjeta, EncabezadoTarjeta } from "@/components/ui/tarjeta";
import { Insignia } from "@/components/ui/insignia";
import { Cargando, ErrorCarga } from "@/components/ui/estados";
import { SERIE, TooltipGrafica, ejeProps, Leyenda } from "@/components/graficas/comunes";
import { supabase } from "@/lib/supabase";
import { q, useTiempoReal } from "@/lib/consultas";
import { useSesion } from "@/lib/sesion";
import { dinero, dineroCompacto, numero, porcentaje } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { ResumenIA } from "./ResumenIA";

interface Tablero {
  generado: string;
  ventas?: { mes: number; mes_anio_anterior: number; anio: number; anio_anterior_misma_fecha: number; anio_anterior_total: number;
    proyeccion_anio: number; serie_12: { mes: string; monto: number }[] | null };
  top_clientes?: { id: string; nombre: string; monto: number }[];
  embudo?: { etapa: string; n: number; monto: number }[];
  cotizaciones?: { abiertas: number; monto_abierto: number; por_autorizar: number; cierre_90d: number | null; del_mes: number };
  vendedores?: { nombre: string; maquinaria: number; refacciones: number; siguiente_meta: number | null; comision: number }[];
  canales?: { canal: string; monto: number }[];
  produccion?: { abiertas: number; atrasadas: number; en_proceso: number; con_faltantes: number; a_tiempo_90d: number | null;
    terminadas_mes: number; carga: { etapa: string; color: string; horas: number; semanas: number | null }[] };
  inventario?: { valor: number; por_almacen: { almacen: string; valor: number }[]; excedentes_valor: number; excedentes_n: number;
    a_ordenar_n: number; inversion_sugerida: number; ajustes_pendientes: number;
    importados_en_riesgo: { id: string; nombre: string; disponible: number; reorden: number; dias: number }[] };
  costos_al_alza?: { id: string; nombre: string; costo_anterior: number; costo_nuevo: number; cambio: number; equipos: number }[];
  equipos_que_subieron?: { id: string; clave: string; nombre: string; precio: number; cambio: number }[];
  cobranza?: { erp: number; arranque: number; cobrado_mes: number; antiguedad: { d0_30: number; d31_60: number; d61_90: number; d90: number } };
  por_pagar?: { total: number; vencido: number };
}

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const ETAPAS: Record<string, string> = { prospecto: "Prospecto", contactado: "Contactado", cotizado: "Cotizado", negociacion: "Negociación" };
const CANALES: Record<string, string> = { directo: "Vendedores", mercadolibre: "Mercado Libre", sitio_web: "Sitio web", mostrador: "Mostrador", distribuidor: "Distribuidores", amazon: "Amazon" };
const cambio = (a: number, b: number) => (b ? a / b - 1 : null);

function Delta({ v, invertido }: { v: number | null; invertido?: boolean }) {
  if (v == null || !Number.isFinite(v)) return null;
  const bueno = invertido ? v < 0 : v >= 0;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-semibold rounded-full px-1.5 py-0.5",
      bueno ? "bg-ok-suave text-ok" : "bg-peligro-suave text-peligro")}>
      {v >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}{porcentaje(Math.abs(v), 1)}
    </span>
  );
}

/** Indicador principal: cifra grande, contexto, variación y (opcional) minigráfica. */
function Indicador({ titulo, valor, detalle, delta, icono: Icono, serie, alClic, tono = "marca" }: {
  titulo: string; valor: string; detalle?: React.ReactNode; delta?: React.ReactNode; icono: typeof TrendingUp;
  serie?: { x: string; y: number }[]; alClic?: () => void; tono?: "marca" | "ok" | "aviso" | "peligro" | "info";
}) {
  const color = { marca: "text-marca", ok: "text-ok", aviso: "text-aviso", peligro: "text-peligro", info: "text-info" }[tono];
  // Sin espacios ni acentos: un id así no se puede referenciar con url(#…) y el área salía negra.
  const idDegradado = "g-" + useId().replace(/[^a-zA-Z0-9-]/g, "");
  return (
    <button onClick={alClic} disabled={!alClic}
      className="tarjeta text-left p-4 flex flex-col gap-2 hover:border-marca/40 hover:shadow-md transition group relative overflow-hidden">
      <div className="flex items-center gap-2 text-sm text-tenue">
        <Icono className={cn("h-4 w-4", color)} />{titulo}
      </div>
      <div className="flex items-end gap-2">
        <span className="text-[28px] leading-none font-semibold tracking-tight cifra">{valor}</span>
        {delta}
      </div>
      {detalle && <p className="text-xs text-tenue">{detalle}</p>}
      {serie && serie.length > 1 && (
        <div className="h-10 -mx-1 mt-auto">
          <ResponsiveContainer>
            <AreaChart data={serie} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={idDegradado} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={SERIE(1)} stopOpacity={0.35} /><stop offset="100%" stopColor={SERIE(1)} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area dataKey="y" stroke={SERIE(1)} strokeWidth={2} fill={`url(#${idDegradado})`} dot={false} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </button>
  );
}

function EnVivo({ desde }: { desde: string | undefined }) {
  const [, forzar] = useState(0);
  useEffect(() => { const t = setInterval(() => forzar((x) => x + 1), 5000); return () => clearInterval(t); }, []);
  const s = desde ? Math.max(0, Math.round((Date.now() - new Date(desde).getTime()) / 1000)) : null;
  return (
    <span className="inline-flex items-center gap-2 text-xs text-tenue">
      <span className="relative flex h-2.5 w-2.5">
        <span className="absolute inline-flex h-full w-full rounded-full bg-ok opacity-60 animate-ping" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-ok" />
      </span>
      En vivo{s != null && ` · actualizado ${s < 10 ? "ahora" : s < 60 ? `hace ${s} s` : `hace ${Math.round(s / 60)} min`}`}
    </span>
  );
}

/** Barra horizontal con etiqueta y valor (para rankings y cargas). */
function Fila({ etiqueta, valor, max, color = SERIE(1), sub, alClic }: { etiqueta: React.ReactNode; valor: number; max: number; color?: string; sub?: React.ReactNode; alClic?: () => void }) {
  return (
    <button onClick={alClic} disabled={!alClic} className="w-full text-left group">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="truncate group-hover:text-marca-texto">{etiqueta}</span>
        <span className="cifra text-tenue shrink-0">{sub}</span>
      </div>
      <div className="h-2 mt-1 rounded-full bg-fondo overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.max(2, Math.min(100, (valor / (max || 1)) * 100))}%`, background: color }} />
      </div>
    </button>
  );
}

export function TableroDireccion() {
  const ir = useNavigate();
  const { perfil } = useSesion();
  const t = useQuery({
    queryKey: ["tablero_direccion"],
    queryFn: () => q<Tablero>(supabase.rpc("tablero_direccion")),
    refetchInterval: 60_000,
  });
  const historia = useQuery({
    queryKey: ["ventas_historicas_mes", "3a"],
    queryFn: () => q<{ mes: string; monto: number }[]>(supabase.rpc("ventas_historicas_mes", { p_desde: `${new Date().getFullYear() - 2}-01-01` })),
    refetchInterval: 300_000,
  });
  // Se mueve solo: cualquier pedido, cobro, cotización, avance de taller o existencia nueva refresca el tablero.
  for (const tabla of ["pedidos", "cobros", "cotizaciones", "ordenes_produccion", "op_eventos", "existencias", "ajustes_inventario"]) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useTiempoReal(tabla, [["tablero_direccion"]]);
  }

  const anio = new Date().getFullYear();
  const comparativo = useMemo(() => {
    const por = new Map((historia.data ?? []).map((h) => [h.mes.slice(0, 7), Number(h.monto)]));
    return MESES.map((m, i) => {
      const mm = String(i + 1).padStart(2, "0");
      return { mes: m, [String(anio)]: por.get(`${anio}-${mm}`) ?? null, [String(anio - 1)]: por.get(`${anio - 1}-${mm}`) ?? 0, [String(anio - 2)]: por.get(`${anio - 2}-${mm}`) ?? 0 };
    });
  }, [historia.data, anio]);

  if (t.error) return <ErrorCarga error={t.error} />;
  if (t.isLoading || !t.data) return <Cargando filas={8} />;
  const d = t.data;
  const v = d.ventas;
  const yoy = v ? cambio(v.anio, v.anio_anterior_misma_fecha) : null;
  const porCobrar = (d.cobranza?.erp ?? 0) + (d.cobranza?.arranque ?? 0);
  const maxVend = Math.max(...(d.vendedores ?? []).map((x) => Math.max(x.maquinaria, x.siguiente_meta ?? 0)), 1);
  const maxCli = Math.max(...(d.top_clientes ?? []).map((x) => x.monto), 1);
  const maxEmbudo = Math.max(...(d.embudo ?? []).map((x) => x.monto ?? 0), 1);
  const aging = d.cobranza?.antiguedad;

  return (
    <div className="mx-auto max-w-[1600px] px-4 lg:px-8 py-6 space-y-5">
      {/* Encabezado */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-tenue">{new Date().toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
          <h1 className="text-2xl font-semibold tracking-tight">Centro de mando · {perfil?.nombre.split(" ")[0]}</h1>
        </div>
        <EnVivo desde={t.dataUpdatedAt ? new Date(t.dataUpdatedAt).toISOString() : d.generado} />
      </div>

      <ResumenIA />

      {/* Indicadores principales */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        {v && (
          <Indicador titulo={`Ventas ${anio}`} valor={dineroCompacto(v.anio)} icono={TrendingUp} delta={<Delta v={yoy} />}
            detalle={`vs ${dineroCompacto(v.anio_anterior_misma_fecha)} a la misma fecha de ${anio - 1}`}
            serie={(v.serie_12 ?? []).map((x) => ({ x: x.mes, y: Number(x.monto) }))} alClic={() => ir("/ventas/pedidos")} />
        )}
        {v && (
          <Indicador titulo="Cierre de año a este ritmo" valor={dineroCompacto(v.proyeccion_anio)} icono={Target}
            delta={<Delta v={cambio(v.proyeccion_anio, v.anio_anterior_total)} />} tono={v.proyeccion_anio >= v.anio_anterior_total ? "ok" : "aviso"}
            detalle={`Con la estacionalidad de ${anio - 1}, que cerró en ${dineroCompacto(v.anio_anterior_total)}`} />
        )}
        {d.cotizaciones && (
          <Indicador titulo="Cotizado vivo" valor={dineroCompacto(d.cotizaciones.monto_abierto)} icono={Flame} tono="info"
            detalle={<>{numero(d.cotizaciones.abiertas)} cotizaciones · cierre {d.cotizaciones.cierre_90d == null ? "—" : porcentaje(d.cotizaciones.cierre_90d, 0)} (90 d)
              {d.cotizaciones.por_autorizar > 0 && <> · <b className="text-aviso">{d.cotizaciones.por_autorizar} por autorizar</b></>}</>}
            alClic={() => ir("/ventas/cotizaciones")} />
        )}
        {d.cobranza && (
          <Indicador titulo="Por cobrar" valor={dineroCompacto(porCobrar)} icono={Wallet} tono={aging && aging.d90 > 0 ? "aviso" : "marca"}
            detalle={<>Cobrado este mes {dineroCompacto(d.cobranza.cobrado_mes)}{aging && aging.d90 > 0 && <> · <b className="text-peligro">{dineroCompacto(aging.d90)} +90 d</b></>}</>}
            alClic={() => ir("/finanzas/cobranza")} />
        )}
        {d.inventario && (
          <Indicador titulo="Inventario" valor={dineroCompacto(d.inventario.valor)} icono={Boxes} tono="marca"
            detalle={<><b className="text-aviso">{dineroCompacto(d.inventario.excedentes_valor)}</b> en excedentes ({numero(d.inventario.excedentes_n)} artículos)</>}
            alClic={() => ir("/almacen/existencias")} />
        )}
        {d.produccion && (
          <Indicador titulo="Taller" valor={`${numero(d.produccion.abiertas)} órdenes`} icono={Factory}
            tono={d.produccion.atrasadas ? "peligro" : "ok"}
            detalle={<>{d.produccion.atrasadas > 0 ? <b className="text-peligro">{d.produccion.atrasadas} atrasadas</b> : "Ninguna atrasada"} · a tiempo {d.produccion.a_tiempo_90d == null ? "—" : porcentaje(d.produccion.a_tiempo_90d, 0)}</>}
            alClic={() => ir("/produccion/gerencia")} />
        )}
      </div>

      {/* Ventas: este año contra los anteriores */}
      {v && (
        <div className="grid gap-4 xl:grid-cols-3">
          <Tarjeta className="xl:col-span-2">
            <EncabezadoTarjeta titulo={`Ventas por mes · ${anio} contra ${anio - 1} y ${anio - 2}`}
              descripcion="Importe con IVA. Hasta el arranque, del libro de ventas de la hoja (2018 →); después, de los pedidos del ERP." />
            <div className="px-5"><Leyenda series={[{ nombre: String(anio), color: SERIE(1) }, { nombre: String(anio - 1), color: SERIE(2) }, { nombre: String(anio - 2), color: "var(--eje)" }]} /></div>
            <div className="h-72 px-2 pb-3 pt-2">
              <ResponsiveContainer>
                <ComposedChart data={comparativo} margin={{ top: 8, right: 16, left: 4, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--rejilla)" />
                  <XAxis dataKey="mes" {...ejeProps} />
                  <YAxis {...ejeProps} width={58} tickFormatter={(x) => dineroCompacto(x)} />
                  <Tooltip cursor={{ fill: "var(--rejilla)", opacity: 0.35 }} content={<TooltipGrafica formato={(x) => dinero(x)} />} />
                  <Bar dataKey={String(anio)} fill={SERIE(1)} radius={[4, 4, 0, 0]} maxBarSize={34} />
                  <Line dataKey={String(anio - 1)} stroke={SERIE(2)} strokeWidth={2} dot={{ r: 3 }} type="monotone" />
                  <Line dataKey={String(anio - 2)} stroke="var(--eje)" strokeWidth={1.5} strokeDasharray="4 4" dot={false} type="monotone" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Tarjeta>
          <Tarjeta>
            <EncabezadoTarjeta titulo={`Mejores clientes ${anio}`} descripcion="Por importe vendido" />
            <div className="px-5 pb-5 space-y-3">
              {(d.top_clientes ?? []).length === 0 ? <p className="text-sm text-tenue">Sin ventas este año.</p> :
                d.top_clientes!.map((c, i) => (
                  <Fila key={c.id} etiqueta={<><span className="text-tenue mr-1.5 cifra">{i + 1}</span>{c.nombre}</>} valor={c.monto} max={maxCli}
                    sub={dineroCompacto(c.monto)} color={i < 3 ? SERIE(1) : "hsl(var(--marca) / 0.45)"} alClic={() => ir(`/ventas/clientes/${c.id}`)} />
                ))}
            </div>
          </Tarjeta>
        </div>
      )}

      {/* Comercial */}
      {(d.vendedores || d.embudo) && (
        <div className="grid gap-4 lg:grid-cols-3">
          {d.vendedores && (
            <Tarjeta>
              <EncabezadoTarjeta titulo="Vendedores este mes" descripcion="Maquinaria contra su siguiente meta de bono" acciones={<button className="text-sm text-marca-texto" onClick={() => ir("/ventas/comisiones")}>Comisiones</button>} />
              <div className="px-5 pb-5 space-y-4">
                {d.vendedores.length === 0 ? <p className="text-sm text-tenue">Sin planes de comisión asignados.</p> :
                  d.vendedores.map((x) => (
                    <div key={x.nombre}>
                      <Fila etiqueta={x.nombre} valor={x.maquinaria} max={x.siguiente_meta ?? maxVend} sub={dineroCompacto(x.maquinaria)} />
                      <p className="text-[11px] text-tenue mt-1">
                        {x.siguiente_meta ? <>Le faltan <b className="text-texto">{dineroCompacto(x.siguiente_meta - x.maquinaria)}</b> para la meta de {dineroCompacto(x.siguiente_meta)}</> : "Meta máxima alcanzada"}
                        {" · "}refacciones {dineroCompacto(x.refacciones)}
                      </p>
                    </div>
                  ))}
              </div>
            </Tarjeta>
          )}
          {d.embudo && (
            <Tarjeta>
              <EncabezadoTarjeta titulo="Embudo comercial" descripcion="Oportunidades abiertas por etapa" acciones={<button className="text-sm text-marca-texto" onClick={() => ir("/ventas/oportunidades")}>Tablero</button>} />
              <div className="px-5 pb-5 space-y-2">
                {d.embudo.map((e, i) => (
                  <div key={e.etapa} className="flex items-center gap-3">
                    <div className="h-9 rounded-lg flex items-center px-3 text-xs font-medium text-white transition-all duration-700"
                      style={{ width: `${Math.max(22, ((e.monto ?? 0) / maxEmbudo) * 100)}%`, background: SERIE(1), opacity: 1 - i * 0.15 }}>
                      {ETAPAS[e.etapa]}
                    </div>
                    <div className="text-sm cifra whitespace-nowrap"><b>{numero(e.n)}</b> <span className="text-tenue">· {dineroCompacto(e.monto)}</span></div>
                  </div>
                ))}
              </div>
            </Tarjeta>
          )}
          {d.canales && (
            <Tarjeta>
              <EncabezadoTarjeta titulo={`Mezcla por canal ${anio}`} descripcion="Pedidos sin IVA" />
              <div className="px-5 pb-5 space-y-3">
                {d.canales.length === 0 ? <p className="text-sm text-tenue">Sin pedidos este año.</p> :
                  d.canales.map((c, i) => (
                    <Fila key={c.canal} etiqueta={CANALES[c.canal] ?? c.canal} valor={c.monto} max={d.canales![0].monto} color={SERIE(i + 1)}
                      sub={`${dineroCompacto(c.monto)} · ${porcentaje(c.monto / d.canales!.reduce((s, x) => s + x.monto, 0), 0)}`} />
                  ))}
                <p className="text-xs text-tenue pt-1">Mercado Libre y sitio web se conectan en la siguiente fase; hoy se registran como pedidos.</p>
              </div>
            </Tarjeta>
          )}
        </div>
      )}

      {/* Operación */}
      <div className="grid gap-4 lg:grid-cols-3">
        {d.produccion && (
          <Tarjeta>
            <EncabezadoTarjeta titulo="Carga del taller" descripcion="Semanas de trabajo pendientes por área" acciones={<button className="text-sm text-marca-texto" onClick={() => ir("/produccion/gerencia")}>Gerencia</button>} />
            <div className="px-5 pb-5 space-y-3">
              {d.produccion.carga.filter((c) => c.horas > 0).length === 0 ? <p className="text-sm text-tenue">Sin órdenes liberadas en el taller.</p> :
                d.produccion.carga.filter((c) => c.horas > 0).map((c) => (
                  <Fila key={c.etapa} etiqueta={c.etapa} valor={c.semanas ?? 0} max={Math.max(4, ...d.produccion!.carga.map((x) => x.semanas ?? 0))}
                    color={c.color} sub={`${numero(c.semanas)} sem · ${numero(c.horas)} h`} />
                ))}
              {d.produccion.con_faltantes > 0 && (
                <button onClick={() => ir("/produccion/ordenes?filtro=faltantes")} className="flex items-center gap-2 text-sm text-aviso pt-1">
                  <PackageX className="h-4 w-4" /> {d.produccion.con_faltantes} órdenes con material faltante
                </button>
              )}
            </div>
          </Tarjeta>
        )}
        {d.inventario && (
          <Tarjeta>
            <EncabezadoTarjeta titulo="Inventario" descripcion={`${dineroCompacto(d.inventario.inversion_sugerida)} sugerido en ${d.inventario.a_ordenar_n} compras`}
              acciones={<button className="text-sm text-marca-texto" onClick={() => ir("/almacen/reabasto")}>Reabasto</button>} />
            <div className="px-5 pb-5 space-y-3">
              {d.inventario.por_almacen.map((a, i) => (
                <Fila key={a.almacen} etiqueta={a.almacen} valor={a.valor} max={d.inventario!.por_almacen[0]?.valor ?? 1} color={SERIE(i + 1)} sub={dineroCompacto(a.valor)} />
              ))}
              {d.inventario.importados_en_riesgo.length > 0 && (
                <div className="pt-2 border-t border-borde">
                  <p className="etiqueta mb-2 flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5 text-peligro" /> Importados bajo su punto de reorden</p>
                  {d.inventario.importados_en_riesgo.slice(0, 4).map((x) => (
                    <button key={x.id} onClick={() => ir(`/costeo/componentes/${x.id}`)} className="w-full flex justify-between gap-2 text-sm py-0.5 hover:text-marca-texto">
                      <span className="truncate">{x.nombre}</span><span className="cifra text-tenue shrink-0">{numero(x.disponible)} / {numero(x.reorden)} · {x.dias} d</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Tarjeta>
        )}
        {d.cobranza && aging && (
          <Tarjeta>
            <EncabezadoTarjeta titulo="Cobranza por antigüedad" descripcion={`Pedidos del ERP · más ${dineroCompacto(d.cobranza.arranque)} de saldo de arranque (hoja)`}
              acciones={<button className="text-sm text-marca-texto" onClick={() => ir("/finanzas/cobranza")}>Cobranza</button>} />
            <div className="h-40 px-2">
              <ResponsiveContainer>
                <BarChart data={[{ r: "0-30", v: aging.d0_30 }, { r: "31-60", v: aging.d31_60 }, { r: "61-90", v: aging.d61_90 }, { r: "+90", v: aging.d90 }]} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--rejilla)" />
                  <XAxis dataKey="r" {...ejeProps} />
                  <YAxis {...ejeProps} width={52} tickFormatter={(x) => dineroCompacto(x)} />
                  <Tooltip cursor={{ fill: "var(--rejilla)", opacity: 0.35 }} content={<TooltipGrafica formato={(x) => dinero(x)} />} />
                  <Bar dataKey="v" name="Saldo" radius={[4, 4, 0, 0]} maxBarSize={44} fill={SERIE(1)} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {d.por_pagar && (
              <div className="px-5 pb-4 pt-2 text-sm flex justify-between border-t border-borde mt-2">
                <span className="text-tenue">Por pagar a proveedores</span>
                <span className="cifra">{dineroCompacto(d.por_pagar.total)}{d.por_pagar.vencido > 0 && <span className="text-peligro"> · {dineroCompacto(d.por_pagar.vencido)} vencido</span>}</span>
              </div>
            )}
          </Tarjeta>
        )}
      </div>

      {/* Alertas de costos */}
      {(d.costos_al_alza?.length || d.equipos_que_subieron?.length) ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {!!d.costos_al_alza?.length && (
            <Tarjeta>
              <EncabezadoTarjeta titulo={<span className="inline-flex items-center gap-2"><Gauge className="h-4 w-4 text-aviso" /> Costos que más subieron (30 días)</span>}
                descripcion="Y en cuántos equipos pegan" />
              <table className="tabla">
                <tbody>
                  {d.costos_al_alza.map((c) => (
                    <tr key={c.id + c.costo_nuevo} className="cursor-pointer" onClick={() => ir(`/costeo/componentes/${c.id}`)}>
                      <td className="max-w-[280px] truncate">{c.nombre}</td>
                      <td className="text-right cifra text-tenue">{dinero(c.costo_anterior)} → {dinero(c.costo_nuevo)}</td>
                      <td className="text-right"><Insignia tono="peligro">+{porcentaje(c.cambio, 1)}</Insignia></td>
                      <td className="text-right text-tenue text-xs whitespace-nowrap">{c.equipos} equipos</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Tarjeta>
          )}
          {!!d.equipos_que_subieron?.length && (
            <Tarjeta>
              <EncabezadoTarjeta titulo={<span className="inline-flex items-center gap-2"><Sparkles className="h-4 w-4 text-marca" /> Precios de lista que se movieron (30 días)</span>}
                descripcion="Por costos o por cambios de utilidad" />
              <table className="tabla">
                <tbody>
                  {d.equipos_que_subieron.map((e) => (
                    <tr key={e.id} className="cursor-pointer" onClick={() => ir(`/costeo/equipos/${e.id}`)}>
                      <td className="text-tenue">{e.clave}</td>
                      <td className="max-w-[300px] truncate">{e.nombre}</td>
                      <td className="text-right cifra">{dinero(e.precio)}</td>
                      <td className="text-right"><Insignia tono={e.cambio >= 0 ? "aviso" : "ok"}>{e.cambio >= 0 ? "+" : ""}{porcentaje(e.cambio, 1)}</Insignia></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Tarjeta>
          )}
        </div>
      ) : null}
    </div>
  );
}

import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  AlertTriangle, Boxes, CheckCircle2, ClipboardList, Factory, FileText, PackageCheck, Scale, ShoppingCart,
  TrendingUp, Truck, UserRound, Wallet,
} from "lucide-react";
import { Pagina } from "@/components/layout/Shell";
import { Kpi } from "@/components/ui/kpi";
import { Tarjeta, EncabezadoTarjeta } from "@/components/ui/tarjeta";
import { Insignia } from "@/components/ui/insignia";
import { Cargando } from "@/components/ui/estados";
import { SERIE, TooltipGrafica, ejeProps, Leyenda } from "@/components/graficas/comunes";
import { useSesion, type Modulo, type Rol } from "@/lib/sesion";
import type { Area } from "@/lib/asistente";
import { TableroDireccion } from "./TableroDireccion";
import { ResumenIA } from "./ResumenIA";
import { supabase } from "@/lib/supabase";
import { q } from "@/lib/consultas";
import { dinero, dineroCompacto, fecha, numero, porcentaje } from "@/lib/formato";

interface Indicadores {
  ventas?: { mes: number; mes_anterior: number; anio: number; pedidos_mes: number };
  cotizaciones?: { abiertas: number; monto_abierto: number; por_autorizar: number; mes: number; ganadas_90d: number; cerradas_90d: number };
  tareas_vencidas?: number;
  cobranza?: { por_cobrar: number; pedidos_con_saldo: number };
  por_pagar?: { total: number; vencido: number };
  inventario?: { ajustes_pendientes: number; articulos_con_existencia: number };
  valor_inventario?: number;
  costos_viejos?: number;
  compras?: { oc_abiertas: number; oc_atrasadas: number; requisiciones_abiertas: number };
  produccion?: { abiertas: number; atrasadas: number; en_proceso: number; con_faltantes: number; terminadas_mes: number };
  rrhh?: { empleados: number; incidencias_pendientes: number; ausentes_hoy: number };
}

const LINEAS = [
  { clave: "maquinaria", nombre: "Maquinaria" },
  { clave: "refacciones", nombre: "Refacciones" },
  { clave: "otros", nombre: "Otros" },
];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function saludo() {
  const h = new Date().getHours();
  return h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";
}

// Dirección ve el centro de mando; los demás, su tablero de área con el resumen del día.
export default function Inicio() {
  const { tieneRol } = useSesion();
  return tieneRol("direccion") ? <TableroDireccion /> : <InicioPorArea />;
}

function areaDeRoles(tieneRol: (r: Rol) => boolean, puede: (m: Modulo, n?: number) => boolean): Area | null {
  if (tieneRol("gerente_ventas") || tieneRol("ventas")) return "ventas";
  if (tieneRol("gerente_produccion")) return "produccion";
  if (tieneRol("almacen")) return "almacen";
  if (tieneRol("compras")) return "compras";
  if (tieneRol("finanzas")) return "finanzas";
  return puede("asistente") ? "direccion" : null;
}

function InicioPorArea() {
  const { perfil, puede, tieneRol } = useSesion();
  const area = areaDeRoles(tieneRol, puede);
  const ir = useNavigate();
  const ind = useQuery({ queryKey: ["indicadores"], queryFn: () => q<Indicadores>(supabase.rpc("indicadores")) });
  const ventas = useQuery({
    queryKey: ["ventas_por_mes", 12],
    enabled: puede("ventas"),
    queryFn: () => q<{ mes: string; canal: string; linea: string; importe: number }[]>(supabase.rpc("ventas_por_mes", { p_meses: 12 })),
  });
  const atrasadas = useQuery({
    queryKey: ["tablero_produccion", "atrasadas"],
    enabled: puede("produccion"),
    queryFn: () => q<{ id: string; folio: string; equipo: string; cliente: string | null; para_stock: boolean; fecha_compromiso: string; avance: number; dias_restantes: number }[]>(
      supabase.from("v_tablero_produccion").select("id, folio, equipo, cliente, para_stock, fecha_compromiso, avance, dias_restantes")
        .or("atrasada.eq.true,dias_restantes.lte.5").order("fecha_compromiso").limit(6)),
  });

  const i = ind.data ?? {};
  // Barras apiladas por línea, un mes por barra (12 meses, incluido el actual).
  const serie = (() => {
    const hoy = new Date();
    const meses = Array.from({ length: 12 }, (_, k) => new Date(hoy.getFullYear(), hoy.getMonth() - 11 + k, 1));
    return meses.map((m) => {
      const clave = m.toLocaleDateString("en-CA").slice(0, 7);
      const fila: Record<string, number | string> = { mes: `${MESES[m.getMonth()]} ${String(m.getFullYear()).slice(2)}` };
      for (const l of LINEAS) {
        fila[l.nombre] = (ventas.data ?? []).filter((v) => v.mes.startsWith(clave) && v.linea === l.clave).reduce((s, v) => s + Number(v.importe), 0);
      }
      return fila;
    });
  })();

  const variacion = i.ventas && i.ventas.mes_anterior > 0 ? i.ventas.mes / i.ventas.mes_anterior - 1 : null;
  const conversion = i.cotizaciones && i.cotizaciones.cerradas_90d > 0 ? i.cotizaciones.ganadas_90d / i.cotizaciones.cerradas_90d : null;

  const pendientes = [
    i.cotizaciones?.por_autorizar && puede("ventas", 3) ? { texto: `${i.cotizaciones.por_autorizar} cotización(es) esperan tu autorización de precio`, ruta: "/ventas/cotizaciones?estado=por_autorizar", icono: FileText, tono: "aviso" as const } : null,
    i.tareas_vencidas ? { texto: `${i.tareas_vencidas} seguimiento(s) vencido(s) con clientes`, ruta: "/ventas/oportunidades", icono: UserRound, tono: "peligro" as const } : null,
    i.inventario?.ajustes_pendientes && (puede("inventario", 3) || puede("produccion", 3)) ? { texto: `${i.inventario.ajustes_pendientes} ajuste(s) de inventario por autorizar`, ruta: "/almacen/movimientos?vista=ajustes", icono: Scale, tono: "aviso" as const } : null,
    i.produccion?.con_faltantes ? { texto: `${i.produccion.con_faltantes} orden(es) de producción con material faltante`, ruta: "/produccion/ordenes?filtro=faltantes", icono: AlertTriangle, tono: "peligro" as const } : null,
    i.compras?.oc_atrasadas ? { texto: `${i.compras.oc_atrasadas} orden(es) de compra con entrega atrasada`, ruta: "/compras/ordenes?filtro=atrasadas", icono: Truck, tono: "aviso" as const } : null,
    i.compras?.requisiciones_abiertas && puede("compras", 2) ? { texto: `${i.compras.requisiciones_abiertas} requisición(es) por comprar`, ruta: "/compras/ordenes?vista=requisiciones", icono: ClipboardList, tono: "marca" as const } : null,
    i.costos_viejos && puede("compras", 2) ? { texto: `${numero(i.costos_viejos)} costos con más de 6 meses sin actualizar`, ruta: "/compras/precios?filtro=viejos", icono: Boxes, tono: "neutro" as const } : null,
    i.rrhh?.incidencias_pendientes ? { texto: `${i.rrhh.incidencias_pendientes} solicitud(es) de vacaciones o permisos`, ruta: "/rrhh/incidencias", icono: UserRound, tono: "marca" as const } : null,
  ].filter(Boolean) as { texto: string; ruta: string; icono: typeof FileText; tono: "aviso" | "peligro" | "marca" | "neutro" }[];

  return (
    <Pagina
      titulo={`${saludo()}, ${perfil?.nombre.split(" ")[0] ?? ""}`}
      descripcion={new Date().toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
    >
      {area && <ResumenIA area={area} />}
      {ind.isLoading ? <Cargando filas={4} /> : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {i.ventas && (
              <Kpi titulo="Ventas del mes" valor={dineroCompacto(i.ventas.mes)} icono={TrendingUp} tono="marca"
                detalle={variacion == null ? `${i.ventas.pedidos_mes} pedidos` : `${variacion >= 0 ? "▲" : "▼"} ${porcentaje(Math.abs(variacion), 0)} vs. mes anterior · ${i.ventas.pedidos_mes} pedidos`}
                alClic={() => ir("/ventas/pedidos")} />
            )}
            {i.cotizaciones && (
              <Kpi titulo="Cotizaciones vivas" valor={numero(i.cotizaciones.abiertas)} icono={FileText} tono="info"
                detalle={`${dineroCompacto(i.cotizaciones.monto_abierto)} enviadas${conversion != null ? ` · cierre ${porcentaje(conversion, 0)} (90 días)` : ""}`}
                alClic={() => ir("/ventas/cotizaciones")} />
            )}
            {i.cobranza && (
              <Kpi titulo="Por cobrar" valor={dineroCompacto(i.cobranza.por_cobrar)} icono={Wallet} tono="aviso"
                detalle={`${i.cobranza.pedidos_con_saldo} pedidos con saldo`} alClic={puede("finanzas") ? () => ir("/finanzas/cobranza") : undefined} />
            )}
            {i.produccion && (
              <Kpi titulo="Órdenes en taller" valor={numero(i.produccion.abiertas)} icono={Factory}
                tono={i.produccion.atrasadas ? "peligro" : "ok"}
                detalle={`${i.produccion.atrasadas} atrasadas · ${i.produccion.terminadas_mes} terminadas este mes`}
                alClic={() => ir("/produccion/gerencia")} />
            )}
            {i.compras && (
              <Kpi titulo="Compras en camino" valor={numero(i.compras.oc_abiertas)} icono={Truck} tono="info"
                detalle={`${i.compras.oc_atrasadas} atrasadas`} alClic={() => ir("/compras/ordenes")} />
            )}
            {i.valor_inventario != null && (
              <Kpi titulo="Valor del inventario" valor={dineroCompacto(i.valor_inventario)} icono={PackageCheck} tono="neutro"
                detalle={`${numero(i.inventario?.articulos_con_existencia)} artículos con existencia`} alClic={() => ir("/almacen/existencias")} />
            )}
            {i.por_pagar && (
              <Kpi titulo="Por pagar a proveedores" valor={dineroCompacto(i.por_pagar.total)} icono={ShoppingCart}
                tono={i.por_pagar.vencido > 0 ? "peligro" : "neutro"} detalle={`${dinero(i.por_pagar.vencido)} vencido`}
                alClic={() => ir("/finanzas/pagos")} />
            )}
            {i.rrhh && (
              <Kpi titulo="Personal" valor={numero(i.rrhh.empleados)} icono={UserRound} tono="neutro"
                detalle={`${i.rrhh.ausentes_hoy} ausentes hoy`} alClic={() => ir("/rrhh/empleados")} />
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {puede("ventas") && (
              <Tarjeta className="lg:col-span-2">
                <EncabezadoTarjeta titulo="Ventas por mes" descripcion="Pedidos sin IVA, por línea"
                  acciones={i.ventas && <span className="text-sm text-tenue">Año: <b className="text-texto cifra">{dinero(i.ventas.anio)}</b></span>} />
                <div className="px-5"><Leyenda series={LINEAS.map((l, k) => ({ nombre: l.nombre, color: SERIE(k + 1) }))} /></div>
                <div className="h-64 px-2 pb-3 pt-2">
                  <ResponsiveContainer>
                    <BarChart data={serie} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="var(--rejilla)" />
                      <XAxis dataKey="mes" {...ejeProps} />
                      <YAxis {...ejeProps} tickFormatter={(v) => dineroCompacto(v)} width={56} />
                      <Tooltip cursor={{ fill: "var(--rejilla)", opacity: 0.4 }} content={<TooltipGrafica formato={(v) => dinero(v)} />} />
                      {LINEAS.map((l, k) => (
                        <Bar key={l.clave} dataKey={l.nombre} stackId="v" fill={SERIE(k + 1)} stroke="hsl(var(--superficie))" strokeWidth={2}
                          radius={k === LINEAS.length - 1 ? [4, 4, 0, 0] : 0} maxBarSize={36} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Tarjeta>
            )}

            <Tarjeta className={puede("ventas") ? "" : "lg:col-span-3"}>
              <EncabezadoTarjeta titulo="Pendientes" descripcion="Lo que espera algo de ti" />
              <div className="px-3 pb-3 space-y-1">
                {pendientes.length === 0 ? (
                  <div className="flex items-center gap-2 px-2 py-6 text-sm text-tenue justify-center">
                    <CheckCircle2 className="h-5 w-5 text-ok" /> Nada pendiente. Todo al día.
                  </div>
                ) : pendientes.map((p) => (
                  <button key={p.texto} onClick={() => ir(p.ruta)} className="w-full flex items-start gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-fondo">
                    <p.icono className={`h-4 w-4 mt-0.5 shrink-0 ${p.tono === "peligro" ? "text-peligro" : p.tono === "aviso" ? "text-aviso" : "text-marca"}`} />
                    <span className="text-sm">{p.texto}</span>
                  </button>
                ))}
              </div>
            </Tarjeta>
          </div>

          {puede("produccion") && (atrasadas.data?.length ?? 0) > 0 && (
            <Tarjeta>
              <EncabezadoTarjeta titulo="Órdenes por vencer o atrasadas" descripcion="Compromiso en 5 días o menos"
                acciones={<button className="text-sm text-marca-texto" onClick={() => ir("/produccion/gerencia")}>Ver tablero</button>} />
              <table className="tabla">
                <thead><tr><th>Orden</th><th>Equipo</th><th>Cliente</th><th>Compromiso</th><th className="text-right">Avance</th></tr></thead>
                <tbody>
                  {atrasadas.data!.map((o) => (
                    <tr key={o.id} className="cursor-pointer" onClick={() => ir(`/produccion/ordenes/${o.id}`)}>
                      <td className="font-medium">{o.folio}</td>
                      <td className="max-w-[280px] truncate">{o.equipo}</td>
                      <td className="text-tenue">{o.para_stock ? "Para stock" : o.cliente ?? "—"}</td>
                      <td>
                        {fecha(o.fecha_compromiso)}{" "}
                        {o.dias_restantes < 0 ? <Insignia tono="peligro">{-o.dias_restantes} días tarde</Insignia>
                          : <Insignia tono="aviso">en {o.dias_restantes} días</Insignia>}
                      </td>
                      <td className="text-right cifra">{o.avance}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Tarjeta>
          )}
        </>
      )}
    </Pagina>
  );
}

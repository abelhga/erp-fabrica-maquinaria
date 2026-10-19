import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { HandCoins } from "lucide-react";
import { TablaDatos, Filtro, type Columna } from "@/components/datos/TablaDatos";
import { Entrada, Seleccion } from "@/components/ui/campo";
import { Insignia } from "@/components/ui/insignia";
import { supabase } from "@/lib/supabase";
import { q } from "@/lib/consultas";
import { dinero, fecha, hoyISO, numero } from "@/lib/formato";
import { traerTodas } from "@/modulos/costeo/componentes/comun";
import { GLOSARIO } from "@/tutorial/glosario";
import { TIPO_ACREEDOR, type TipoAcreedor } from "./cuentas";

interface Pago {
  id: string; origen: "erp" | "hoja" | "orden"; fecha: string; proveedor_llave: string | null; proveedor: string | null;
  tipo_acreedor: TipoAcreedor; monto: number; moneda: string; monto_mxn: number; cuenta: string | null; cuenta_nombre: string | null;
  referencia: string | null; descripcion: string | null; registrado_por: string | null;
}
type Periodo = "mes" | "mes_pasado" | "anio" | "todo" | "rango";
const ORIGEN: Record<Pago["origen"], string> = { erp: "ERP", hoja: "Hoja", orden: "Orden de compra" };

function rangoDe(p: Periodo, desde: string, hasta: string): [string | null, string | null] {
  const hoy = hoyISO(), [a, m] = hoy.split("-").map(Number);
  const iso = (y: number, mm: number, d: number) => `${y}-${String(mm).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  if (p === "mes") return [iso(a, m, 1), hoy];
  if (p === "mes_pasado") { const y = m === 1 ? a - 1 : a, mm = m === 1 ? 12 : m - 1; return [iso(y, mm, 1), iso(y, mm, new Date(y, mm, 0).getDate())]; }
  if (p === "anio") return [iso(a, 1, 1), hoy];
  if (p === "rango") return [desde || null, hasta || null];
  return [null, null];
}

/**
 * Todos los pagos a proveedores en una lista: los del ERP, los del libro de compras (sin
 * contar dos veces los que están en los dos lados) y los de órdenes de compra. Para ver
 * cuánto se pagó en un periodo, de qué cuenta salió y bajarlo a Excel para el contador.
 */
export function PagosHechos({ alAbrirProveedor }: { alAbrirProveedor: (llave: string) => void }) {
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [desde, setDesde] = useState(""), [hasta, setHasta] = useState("");
  const [cuenta, setCuenta] = useState("");
  const [tipo, setTipo] = useState<"proveedores" | "todos" | "socios">("proveedores");
  const [ini, fin] = rangoDe(periodo, desde, hasta);

  const pagos = useQuery({
    queryKey: ["v_pagos_hechos", ini, fin],
    queryFn: () => traerTodas<Pago>((d, h) => {
      let c = supabase.from("v_pagos_hechos").select("*");
      if (ini) c = c.gte("fecha", ini);
      if (fin) c = c.lte("fecha", fin);
      return c.order("fecha", { ascending: false }).order("id").range(d, h) as unknown as PromiseLike<{ data: Pago[] | null; error: { message: string } | null }>;
    }),
  });
  const cuentas = useQuery({ queryKey: ["cuentas_dinero"], staleTime: Infinity,
    queryFn: () => q<{ clave: string; nombre: string }[]>(supabase.from("cuentas_dinero").select("clave, nombre").order("orden")) });

  const filas = useMemo(() => (pagos.data ?? []).filter((p) =>
    (!cuenta || (cuenta === "sin" ? !p.cuenta : p.cuenta === cuenta)) &&
    (tipo === "todos" || (tipo === "proveedores" ? p.tipo_acreedor === "proveedor" : p.tipo_acreedor !== "proveedor"))), [pagos.data, cuenta, tipo]);
  const total = filas.reduce((s, p) => s + Number(p.monto_mxn), 0);
  // Cuánto salió de cada cuenta en lo que se ve: lo primero que pregunta el contador.
  const porCuenta = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of filas) m.set(p.cuenta_nombre ?? "Sin cuenta", (m.get(p.cuenta_nombre ?? "Sin cuenta") ?? 0) + Number(p.monto_mxn));
    return [...m].sort((a, b) => b[1] - a[1]);
  }, [filas]);

  const columnas: Columna<Pago>[] = [
    { clave: "fecha", titulo: "Fecha", clase: "whitespace-nowrap cifra", valor: (p) => p.fecha, celda: (p) => fecha(p.fecha) },
    { clave: "proveedor", titulo: "Proveedor", clase: "min-w-[200px]", valor: (p) => p.proveedor,
      celda: (p) => <span>{p.proveedor ?? "—"}{p.tipo_acreedor !== "proveedor" && <Insignia className="ml-2">{TIPO_ACREEDOR[p.tipo_acreedor]}</Insignia>}</span> },
    { clave: "cuenta_nombre", titulo: "Cuenta", clase: "whitespace-nowrap", valor: (p) => p.cuenta_nombre ?? "" },
    { clave: "referencia", titulo: "Factura / referencia", clase: "max-w-[260px] truncate", valor: (p) => [p.referencia, p.descripcion].filter(Boolean).join(" · "),
      celda: (p) => <span title={p.descripcion ?? undefined}>{p.referencia ?? <span className="text-tenue">{p.descripcion ?? "—"}</span>}</span> },
    { clave: "monto_mxn", titulo: "Monto", alinear: "der", sinBusqueda: true, valor: (p) => Number(p.monto_mxn),
      celda: (p) => <span className="font-medium">{dinero(p.monto_mxn)}{p.moneda !== "MXN" && <span className="block text-xs text-tenue">{p.moneda} {numero(p.monto)}</span>}</span> },
    { clave: "origen", titulo: "Se registró en", clase: "whitespace-nowrap text-tenue", valor: (p) => ORIGEN[p.origen], explica: GLOSARIO.pagosHechos,
      celda: (p) => <>{ORIGEN[p.origen]}{p.registrado_por && <span className="block text-xs">{p.registrado_por}</span>}</> },
  ];

  return (
    <TablaDatos filas={filas} columnas={columnas} cargando={pagos.isLoading} error={pagos.error} claveFila={(p) => p.id}
      alClicFila={(p) => { if (p.proveedor_llave) alAbrirProveedor(p.proveedor_llave); }}
      exportarComo={`pagos-${ini ?? "inicio"}-a-${fin ?? hoyISO()}`} placeholder="Buscar proveedor, factura o concepto…"
      filtros={<>
        <Filtro<Periodo> valor={periodo} alCambiar={setPeriodo} opciones={[
          { valor: "mes", texto: "Este mes" }, { valor: "mes_pasado", texto: "Mes pasado" }, { valor: "anio", texto: "Este año" },
          { valor: "todo", texto: "Todo" }, { valor: "rango", texto: "Fechas…" },
        ]} />
        {periodo === "rango" && <span className="flex items-center gap-1 text-xs text-tenue">
          <Entrada type="date" className="h-8 w-36 text-xs" value={desde} max={hasta || undefined} onChange={(e) => setDesde(e.target.value)} aria-label="Desde" />a
          <Entrada type="date" className="h-8 w-36 text-xs" value={hasta} min={desde || undefined} onChange={(e) => setHasta(e.target.value)} aria-label="Hasta" />
        </span>}
        <Seleccion value={cuenta} onChange={(e) => setCuenta(e.target.value)} className="h-8 w-auto text-xs" aria-label="Cuenta">
          <option value="">Todas las cuentas</option>
          {(cuentas.data ?? []).map((c) => <option key={c.clave} value={c.clave}>{c.nombre}</option>)}
          <option value="sin">Sin cuenta (órdenes de compra)</option>
        </Seleccion>
        <Seleccion value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)} className="h-8 w-auto text-xs" aria-label="A quién">
          <option value="proveedores">Solo proveedores</option>
          <option value="socios">Socios y bancos</option>
          <option value="todos">Todos</option>
        </Seleccion>
      </>}
      pie={filas.length > 0 && (
        <div className="flex flex-wrap items-baseline justify-end gap-x-6 gap-y-1 text-sm">
          {porCuenta.length > 1 && porCuenta.map(([n, v]) => <span key={n} className="text-tenue">{n} <b className="cifra text-texto">{dinero(v)}</b></span>)}
          <span><span className="text-tenue">{numero(filas.length)} {filas.length === 1 ? "pago" : "pagos"} · total </span><b className="cifra">{dinero(total)}</b></span>
        </div>
      )}
      vacio={{ icono: HandCoins, titulo: "Sin pagos en este periodo", texto: "Prueba con «Este año» o «Todo». Los pagos se registran en la cuenta de cada proveedor o desde su orden de compra." }}
    />
  );
}

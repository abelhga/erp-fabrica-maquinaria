import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlarmClock, Clock, Hourglass, Wallet, X } from "lucide-react";
import { Pagina } from "@/components/layout/Shell";
import { Kpi } from "@/components/ui/kpi";
import { Insignia } from "@/components/ui/insignia";
import { Tarjeta, EncabezadoTarjeta } from "@/components/ui/tarjeta";
import { Pestanas, ListaPestanas, ContenidoPestana } from "@/components/ui/pestanas";
import { TablaDatos, Filtro, type Columna } from "@/components/datos/TablaDatos";
import { SERIE, TooltipGrafica, ejeProps } from "@/components/graficas/comunes";
import { supabase } from "@/lib/supabase";
import { q } from "@/lib/consultas";
import { dinero, dineroCompacto, fecha, numero } from "@/lib/formato";
import { ESTADO_PEDIDO, RANGOS, TipoCambioDia, enMoneda, tonoRango, type Rango } from "./componentes/comun";
import { DetalleCobranza, type FilaCobranza } from "./componentes/CobranzaPedido";
import { SaldosArranque } from "./componentes/SaldosArranque";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const ICONO_RANGO = { "0-30": Clock, "31-60": Hourglass, "61-90": AlarmClock, "90+": AlarmClock } as const;

interface Grupo { clave: string; nombre: string; detalle: string; pedidos: number; total: number; mas_antiguo: number; rangos: Record<Rango, number> }

function agrupar(filas: FilaCobranza[], clave: (f: FilaCobranza) => string, nombre: (f: FilaCobranza) => string, detalle: (fs: FilaCobranza[]) => string): Grupo[] {
  const m = new Map<string, FilaCobranza[]>();
  for (const f of filas) m.set(clave(f), [...(m.get(clave(f)) ?? []), f]);
  return [...m.entries()].map(([k, fs]) => ({
    clave: k, nombre: nombre(fs[0]), detalle: detalle(fs), pedidos: fs.length,
    total: fs.reduce((s, f) => s + Number(f.saldo_mxn), 0),
    mas_antiguo: Math.max(...fs.map((f) => f.dias)),
    rangos: Object.fromEntries(RANGOS.map((r) => [r.valor, fs.filter((f) => f.rango === r.valor).reduce((s, f) => s + Number(f.saldo_mxn), 0)])) as Record<Rango, number>,
  })).sort((a, b) => b.total - a.total);
}

export default function Cobranza() {
  const [vista, setVista] = useState("pedidos");
  const [rango, setRango] = useState<Rango | "todos">("todos");
  const [conSaldo, setConSaldo] = useState<"saldo" | "todos" | "sin_factura">("saldo");
  const [filtro, setFiltro] = useState<{ tipo: "cliente" | "vendedor"; clave: string; nombre: string } | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);

  const datos = useQuery({
    queryKey: ["v_cobranza"],
    queryFn: () => q<FilaCobranza[]>(supabase.from("v_cobranza").select("*").order("fecha", { ascending: true })),
  });
  const porMes = useQuery({
    queryKey: ["cobranza_por_mes", 12],
    queryFn: () => q<{ mes: string; cobrado: number; facturado: number; cobros: number }[]>(supabase.rpc("cobranza_por_mes", { p_meses: 12 })),
  });

  const todas = datos.data ?? [];
  const pendientes = todas.filter((f) => Number(f.saldo) > 0.009);
  const total = pendientes.reduce((s, f) => s + Number(f.saldo_mxn), 0);
  const porRango = Object.fromEntries(RANGOS.map((r) => [r.valor, pendientes.filter((f) => f.rango === r.valor)])) as Record<Rango, FilaCobranza[]>;
  const suma = (fs: FilaCobranza[]) => fs.reduce((s, f) => s + Number(f.saldo_mxn), 0);
  const vencido = pendientes.filter((f) => f.vence < new Date().toLocaleDateString("en-CA") && f.estado !== "en_produccion" && f.estado !== "confirmado");

  const filas = (conSaldo === "todos" ? todas : conSaldo === "sin_factura" ? todas.filter((f) => !f.facturado && f.estado !== "cancelado") : pendientes)
    .filter((f) => rango === "todos" || f.rango === rango)
    .filter((f) => !filtro || (filtro.tipo === "cliente" ? f.cliente_id === filtro.clave : (f.vendedor_id ?? "—") === filtro.clave));

  const grafica = (porMes.data ?? []).map((m) => {
    const d = new Date(m.mes + "T12:00:00");
    return { mes: `${MESES[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`, Cobrado: Number(m.cobrado), cobros: m.cobros };
  });
  const promedio = grafica.length ? grafica.reduce((s, g) => s + g.Cobrado, 0) / grafica.length : 0;
  const masViejos = [...pendientes].sort((a, b) => b.dias - a.dias).slice(0, 5);
  const seleccion = todas.find((f) => f.pedido_id === abierto) ?? null;

  const clientes = useMemo(() => agrupar(pendientes, (f) => f.cliente_id, (f) => f.cliente, (fs) => [...new Set(fs.map((f) => f.vendedor ?? "Sin vendedor"))].join(", ")), [pendientes]);
  const vendedores = useMemo(() => agrupar(pendientes, (f) => f.vendedor_id ?? "—", (f) => f.vendedor ?? "Sin vendedor", (fs) => `${new Set(fs.map((f) => f.cliente_id)).size} clientes`), [pendientes]);

  // "Isaac H.": el nombre completo está en el detalle; aquí cuenta el ancho de la tabla.
  const corto = (n: string | null) => { if (!n) return "—"; const p = n.split(" "); return p.length > 1 ? `${p[0]} ${p[1][0]}.` : p[0]; };
  const columnas: Columna<FilaCobranza>[] = [
    {
      clave: "folio", titulo: "Pedido", valor: (f) => `${f.folio} ${f.facturas ?? ""}`,
      celda: (f) => (
        <div className="whitespace-nowrap">
          <p className="font-medium">{f.folio}</p>
          <p className="text-xs text-tenue">{fecha(f.fecha)} · {f.facturas ? `Fact. ${f.facturas}` : <span className="text-aviso">sin facturar</span>}</p>
        </div>
      ),
    },
    { clave: "cliente", titulo: "Cliente", clase: "max-w-[200px]", celda: (f) => <span className="block truncate" title={f.cliente}>{f.cliente}</span> },
    { clave: "vendedor", titulo: "Vendedor", valor: (f) => f.vendedor ?? "—", celda: (f) => <span className="whitespace-nowrap" title={f.vendedor ?? undefined}>{corto(f.vendedor)}</span> },
    { clave: "estado", titulo: "Estado", valor: (f) => ESTADO_PEDIDO[f.estado]?.texto ?? f.estado, celda: (f) => <Insignia tono={ESTADO_PEDIDO[f.estado]?.tono}>{ESTADO_PEDIDO[f.estado]?.texto ?? f.estado}</Insignia> },
    { clave: "total", titulo: "Total", alinear: "der", sinBusqueda: true, valor: (f) => Number(f.total_mxn), celda: (f) => enMoneda(f.total, f.moneda) },
    {
      clave: "cobrado", titulo: "Cobrado", alinear: "der", sinBusqueda: true, valor: (f) => Number(f.cobrado),
      celda: (f) => <div><p>{enMoneda(f.cobrado, f.moneda)}</p>{f.ultimo_cobro && <p className="text-xs text-tenue">último {fecha(f.ultimo_cobro).slice(0, 6)}</p>}</div>,
    },
    { clave: "saldo", titulo: "Saldo", alinear: "der", sinBusqueda: true, valor: (f) => Number(f.saldo_mxn), celda: (f) => <b>{enMoneda(f.saldo, f.moneda)}</b> },
    {
      clave: "dias", titulo: "Antigüedad", sinBusqueda: true, valor: (f) => f.dias,
      celda: (f) => Number(f.saldo) > 0.009 ? <Insignia tono={tonoRango(f.rango)}>{f.dias} días</Insignia> : <Insignia tono="ok">Pagado</Insignia>,
    },
  ];

  const columnasGrupo = (titulo: string): Columna<Grupo>[] => [
    { clave: "nombre", titulo, celda: (g) => <div><p className="font-medium">{g.nombre}</p><p className="text-xs text-tenue">{g.detalle}</p></div> },
    { clave: "pedidos", titulo: "Pedidos", alinear: "der", sinBusqueda: true },
    ...RANGOS.map((r): Columna<Grupo> => ({
      clave: r.valor, titulo: r.valor === "90+" ? "+90" : r.valor.replace("-", "–"), alinear: "der", sinBusqueda: true, valor: (g) => g.rangos[r.valor],
      celda: (g) => g.rangos[r.valor] ? <span className={r.valor === "90+" ? "text-peligro" : r.valor === "61-90" ? "text-aviso" : ""}>{dinero(g.rangos[r.valor])}</span> : <span className="text-tenue">—</span>,
    })),
    { clave: "total", titulo: "Saldo total", alinear: "der", sinBusqueda: true, celda: (g) => <b>{dinero(g.total)}</b> },
    { clave: "mas_antiguo", titulo: "Más antiguo", alinear: "der", sinBusqueda: true, celda: (g) => `${g.mas_antiguo} días` },
  ];

  return (
    <Pagina titulo="Cobranza" descripcion="Lo que nos deben los clientes, desde cuándo, y lo que se ha cobrado mes a mes." acciones={<TipoCambioDia />}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="sm:col-span-2 lg:col-span-1">
          <Kpi titulo="Por cobrar" valor={dineroCompacto(total)} icono={Wallet} tono="marca"
            detalle={`${pendientes.length} pedidos · ${dineroCompacto(suma(vencido))} vencido según crédito`}
            alClic={() => { setRango("todos"); setConSaldo("saldo"); setVista("pedidos"); }} />
        </div>
        {RANGOS.map((r) => (
          <Kpi key={r.valor} titulo={r.texto} valor={dineroCompacto(suma(porRango[r.valor]))} icono={ICONO_RANGO[r.valor]} tono={r.tono}
            detalle={`${porRango[r.valor].length} ${porRango[r.valor].length === 1 ? "pedido" : "pedidos"} · ${total ? Math.round((suma(porRango[r.valor]) / total) * 100) : 0} %`}
            alClic={() => { setRango(r.valor); setConSaldo("saldo"); setVista("pedidos"); }} />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Tarjeta className="lg:col-span-2 flex flex-col">
          <EncabezadoTarjeta titulo="Cobrado por mes" descripcion="Cobros registrados, en pesos (los de dólares al tipo de cambio del pedido)"
            acciones={<span className="text-sm text-tenue">Promedio: <b className="text-texto cifra">{dinero(promedio)}</b></span>} />
          <div className="flex-1 min-h-[240px] px-2 pb-3">
            <ResponsiveContainer>
              <BarChart data={grafica} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--rejilla)" />
                <XAxis dataKey="mes" {...ejeProps} interval={0} tick={{ fontSize: 11 }} />
                <YAxis {...ejeProps} tickFormatter={(v) => dineroCompacto(v)} width={56} />
                <Tooltip cursor={{ fill: "var(--rejilla)", opacity: 0.4 }} content={<TooltipGrafica formato={(v) => dinero(v)} />} />
                <Bar dataKey="Cobrado" fill={SERIE(1)} radius={[4, 4, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Tarjeta>
        <Tarjeta>
          <EncabezadoTarjeta titulo="Los más atrasados" descripcion="Por dónde empezar a llamar" />
          <ul className="px-3 pb-3 space-y-1">
            {masViejos.length === 0 && <li className="px-2 py-6 text-sm text-tenue text-center">Nadie nos debe. Todo cobrado.</li>}
            {masViejos.map((f) => (
              <li key={f.pedido_id}>
                <button onClick={() => setAbierto(f.pedido_id)} className="w-full flex items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-fondo">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{f.cliente}</p>
                    <p className="text-xs text-tenue">{f.folio}{f.vendedor ? ` · ${f.vendedor}` : ""}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm cifra font-medium">{dinero(f.saldo_mxn)}</p>
                    <Insignia tono={tonoRango(f.rango)}>{f.dias} días</Insignia>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </Tarjeta>
      </div>

      <Pestanas value={vista} onValueChange={setVista}>
        <ListaPestanas opciones={[
          { valor: "pedidos", texto: "Por pedido" },
          { valor: "clientes", texto: "Por cliente", cuenta: clientes.length },
          { valor: "vendedores", texto: "Por vendedor", cuenta: vendedores.length },
          { valor: "arranque", texto: "Saldos de arranque (hoja)" },
        ]} />
        <ContenidoPestana value="pedidos" className="pt-4">
          <TablaDatos
            filas={filas} columnas={columnas} cargando={datos.isLoading} error={datos.error}
            claveFila={(f) => f.pedido_id} alClicFila={(f) => setAbierto(f.pedido_id)} exportarComo="cobranza"
            placeholder="Buscar pedido, cliente, vendedor o factura…"
            filtros={
              <div className="flex flex-wrap items-center gap-2">
                <Filtro valor={conSaldo} alCambiar={setConSaldo} opciones={[
                  { valor: "saldo", texto: "Con saldo", cuenta: pendientes.length },
                  { valor: "sin_factura", texto: "Sin facturar", cuenta: todas.filter((f) => !f.facturado).length },
                  { valor: "todos", texto: "Todos" },
                ]} />
                <Filtro valor={rango} alCambiar={setRango} opciones={[{ valor: "todos", texto: "Cualquier antigüedad" }, ...RANGOS.map((r) => ({ valor: r.valor, texto: r.valor === "90+" ? "+90" : r.valor.replace("-", "–") }))]} />
                {filtro && (
                  <button onClick={() => setFiltro(null)} className="h-8 inline-flex items-center gap-1 rounded-full bg-marca-suave text-marca-texto px-3 text-xs font-medium">
                    {filtro.tipo === "cliente" ? "Cliente" : "Vendedor"}: {filtro.nombre} <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            }
            pie={filas.length > 0 && (
              <div className="flex justify-end gap-6 text-sm">
                <span className="text-tenue">Saldo de lo que se ve:</span>
                <b className="cifra">{dinero(filas.reduce((s, f) => s + Number(f.saldo_mxn), 0))}</b>
              </div>
            )}
            vacio={{ icono: Wallet, titulo: conSaldo === "saldo" ? "Nadie nos debe" : "Sin pedidos", texto: "Los pedidos de ventas aparecen aquí con su saldo; registra cada cobro al recibirlo." }}
          />
        </ContenidoPestana>
        <ContenidoPestana value="clientes" className="pt-4">
          <TablaDatos filas={clientes} columnas={columnasGrupo("Cliente")} cargando={datos.isLoading} claveFila={(g) => g.clave}
            exportarComo="cobranza-por-cliente" placeholder="Buscar cliente…"
            alClicFila={(g) => { setFiltro({ tipo: "cliente", clave: g.clave, nombre: g.nombre }); setRango("todos"); setVista("pedidos"); }}
            vacio={{ icono: Wallet, titulo: "Ningún cliente con saldo" }} />
        </ContenidoPestana>
        <ContenidoPestana value="vendedores" className="pt-4">
          <TablaDatos filas={vendedores} columnas={columnasGrupo("Vendedor")} cargando={datos.isLoading} claveFila={(g) => g.clave}
            exportarComo="cobranza-por-vendedor" placeholder="Buscar vendedor…"
            alClicFila={(g) => { setFiltro({ tipo: "vendedor", clave: g.clave, nombre: g.nombre }); setRango("todos"); setVista("pedidos"); }}
            vacio={{ icono: Wallet, titulo: "Ningún vendedor con saldo pendiente" }} />
          <p className="text-xs text-tenue mt-2">Saldos en pesos al tipo de cambio de hoy. Clic en un renglón para ver sus pedidos. {numero(pendientes.length)} pedidos con saldo.</p>
        </ContenidoPestana>
        <ContenidoPestana value="arranque" className="pt-4">
          <SaldosArranque />
        </ContenidoPestana>
      </Pestanas>

      <DetalleCobranza fila={seleccion} alCerrar={() => setAbierto(null)} />
    </Pagina>
  );
}

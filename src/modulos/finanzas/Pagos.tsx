import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CalendarDays, CalendarRange, ExternalLink, FilePlus2, Landmark, Receipt, Wallet } from "lucide-react";
import { Pagina } from "@/components/layout/Shell";
import { Kpi } from "@/components/ui/kpi";
import { Boton } from "@/components/ui/boton";
import { Dialogo } from "@/components/ui/dialogo";
import { Campo, Entrada, Seleccion } from "@/components/ui/campo";
import { Tarjeta, EncabezadoTarjeta } from "@/components/ui/tarjeta";
import { Pestanas, ListaPestanas, ContenidoPestana } from "@/components/ui/pestanas";
import { Cargando } from "@/components/ui/estados";
import { TablaDatos, Filtro, type Columna } from "@/components/datos/TablaDatos";
import { useSesion } from "@/lib/sesion";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { dinero, dineroCompacto, fecha, hoyISO } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { METODOS, TipoCambioDia, iso, lunesDe, enMoneda, nombreMetodo, type Moneda } from "./componentes/comun";
import { InsigniaRepetida } from "./componentes/Repetida";
import { diasPara, useCuentasProveedor, useFacturasPendientes, Vencimiento, type FacturaPendiente } from "./componentes/cuentas";
import { CuentasProveedores, PanelProveedor } from "./componentes/CuentasProveedores";
import { RegistrarCompra } from "./componentes/RegistrarCompra";
import { PagosHechos } from "./componentes/PagosHechos";
import { GLOSARIO } from "@/tutorial/glosario";

interface PorPagar {
  orden_compra_id: string; folio: string; proveedor_id: string; proveedor: string; fecha: string; vence_pago: string | null;
  moneda: Moneda; total: number; pagado: number; saldo: number; factura_proveedor: string | null; dias_credito: number;
  categoria: string | null; datos_bancarios: string | null; saldo_mxn: number; dias_para_vencer: number | null; ultimo_pago: string | null;
}
/** Una factura pendiente con el nombre de su proveedor. */
type Factura = FacturaPendiente & { nombre: string; dias: number };
/** Lo que entra en la agenda: una orden del ERP o una factura de la cuenta de un proveedor. */
interface Pendiente { grupo: string; proveedor: string; vence: string | null; dias: number | null; monto: number; abrir: () => void }

type Pestana = "facturas" | "proveedores" | "ordenes" | "pagados";

export default function Pagos() {
  const { puede } = useSesion();
  // La cuenta de proveedores trae nómina, impuestos y préstamos: solo quien lleva finanzas
  // (compras ve las órdenes; la RLS es la que manda).
  const verCuentas = puede("finanzas", 2);
  const [vista, setVista] = useState<"todas" | "vencidas" | "semana">("todas");
  const [abierta, setAbierta] = useState<PorPagar | null>(null);
  // ?proveedor=<llave> abre su cuenta (viene de la ficha del proveedor en Compras).
  const [params] = useSearchParams();
  const [llave, setLlave] = useState<string | null>(params.get("proveedor"));
  const [compra, setCompra] = useState<{ abierto: boolean; proveedor: { id: string; nombre: string } | null }>({ abierto: false, proveedor: null });
  const [pestanaElegida, setPestana] = useState<Pestana>("facturas");
  const [vistaProveedores, setVistaProveedores] = useState<"debemos" | "socios">("debemos");
  const pestana = verCuentas ? pestanaElegida : "ordenes";

  const datos = useQuery({
    queryKey: ["v_por_pagar"],
    queryFn: () => q<PorPagar[]>(supabase.from("v_por_pagar").select("*")),
  });
  const cuentas = useCuentasProveedor(verCuentas);
  const pendientes = useFacturasPendientes(verCuentas);
  const porLlave = useMemo(() => new Map((cuentas.data ?? []).map((c) => [c.proveedor_llave, c])), [cuentas.data]);
  // Solo proveedores: lo que se debe a socios y bancos no entra a la agenda (va en su filtro).
  const facturas: Factura[] = useMemo(() => (pendientes.data ?? [])
    .filter((x) => (porLlave.get(x.proveedor_llave)?.tipo_acreedor ?? "proveedor") === "proveedor")
    .map((x) => ({ ...x, nombre: porLlave.get(x.proveedor_llave)?.nombre ?? x.proveedor_llave, dias: diasPara(x.vence_el) ?? 0 })), [pendientes.data, porLlave]);
  const socios = (cuentas.data ?? []).filter((c) => c.tipo_acreedor !== "proveedor" && Number(c.saldo) > 1);

  const ordenes = [...(datos.data ?? [])].sort((a, b) => (a.dias_para_vencer ?? 1e9) - (b.dias_para_vencer ?? 1e9));
  const todo: Pendiente[] = [
    ...ordenes.map((o) => ({ grupo: `oc:${o.proveedor_id}`, proveedor: o.proveedor, vence: o.vence_pago, dias: o.dias_para_vencer, monto: Number(o.saldo_mxn), abrir: () => setAbierta(o) })),
    ...facturas.map((x) => ({ grupo: x.proveedor_llave, proveedor: x.nombre, vence: x.vence_el, dias: x.dias, monto: Number(x.restante), abrir: () => setLlave(x.proveedor_llave) })),
  ];
  const suma = (fs: { monto: number }[]) => fs.reduce((s, f) => s + f.monto, 0);
  const vencido = todo.filter((f) => (f.dias ?? 1) < 0);
  const semana = todo.filter((f) => f.dias != null && f.dias >= 0 && f.dias <= 7);
  const proveedoresCon = (fs: Pendiente[]) => new Set(fs.map((f) => f.grupo)).size;

  // Agenda: lo vencido y las próximas 4 semanas, de lunes a domingo, agrupado por proveedor.
  const lunes = lunesDe(new Date());
  const semanas = Array.from({ length: 4 }, (_, k) => {
    const ini = new Date(lunes); ini.setDate(ini.getDate() + 7 * k);
    const fin = new Date(ini); fin.setDate(fin.getDate() + 6);
    return { ini: iso(ini), fin: iso(fin), titulo: ["Esta semana", "La próxima", "En 2 semanas", "En 3 semanas"][k] };
  });
  const enSemana = (s: { ini: string; fin: string }) => todo.filter((f) => f.vence && f.vence >= s.ini && f.vence <= s.fin && (f.dias ?? 0) >= 0);
  const columnasAgenda = [
    { titulo: "Vencido", detalle: "Pagar ya", filas: vencido, peligro: true },
    ...semanas.map((s) => ({ titulo: s.titulo, detalle: `${fecha(s.ini).slice(0, 6)} – ${fecha(s.fin).slice(0, 6)}`, filas: enSemana(s), peligro: false })),
  ];
  const cuatroSemanas = columnasAgenda.slice(1).reduce((s, c) => s + suma(c.filas), 0);
  const agrupar = (fs: Pendiente[]) => {
    const m = new Map<string, { proveedor: string; monto: number; n: number; abrir: () => void }>();
    for (const f of fs) {
      const g = m.get(f.grupo) ?? { proveedor: f.proveedor, monto: 0, n: 0, abrir: f.abrir };
      g.monto += f.monto; g.n += 1; m.set(f.grupo, g);
    }
    return [...m.entries()].map(([grupo, g]) => ({ grupo, ...g })).sort((a, b) => b.monto - a.monto);
  };
  const cargando = datos.isLoading || (verCuentas && (cuentas.isLoading || pendientes.isLoading));

  const filasOrdenes = vista === "vencidas" ? ordenes.filter((f) => (f.dias_para_vencer ?? 1) < 0)
    : vista === "semana" ? ordenes.filter((f) => f.dias_para_vencer != null && f.dias_para_vencer >= 0 && f.dias_para_vencer <= 7) : ordenes;
  const filasFacturas = vista === "vencidas" ? facturas.filter((f) => f.dias < 0) : vista === "semana" ? facturas.filter((f) => f.dias >= 0 && f.dias <= 7) : facturas;
  const filtroVista = (lista: { dias: number | null }[]) => <Filtro valor={vista} alCambiar={setVista} opciones={[
    { valor: "todas", texto: "Todas", cuenta: lista.length },
    { valor: "vencidas", texto: "Vencidas", cuenta: lista.filter((f) => (f.dias ?? 1) < 0).length },
    { valor: "semana", texto: "Próximos 7 días", cuenta: lista.filter((f) => f.dias != null && f.dias >= 0 && f.dias <= 7).length },
  ]} />;

  const columnasOrdenes: Columna<PorPagar>[] = [
    { clave: "vence_pago", titulo: "Vence", explica: GLOSARIO.vencePago, sinBusqueda: true, valor: (f) => f.dias_para_vencer ?? 99999, celda: (f) => <Vencimiento vence={f.vence_pago} /> },
    { clave: "proveedor", titulo: "Proveedor", celda: (f) => <div className="min-w-[180px]"><p className="font-medium">{f.proveedor}</p><p className="text-xs text-tenue">{f.categoria ?? ""}{f.dias_credito ? ` · crédito ${f.dias_credito} días` : " · contado"}</p></div> },
    { clave: "folio", titulo: "Orden", celda: (f) => <span className="whitespace-nowrap">{f.folio}</span> },
    { clave: "factura_proveedor", titulo: "Factura", valor: (f) => f.factura_proveedor ?? "", celda: (f) => f.factura_proveedor ?? <span className="text-aviso text-xs">Sin factura</span> },
    { clave: "fecha", titulo: "Fecha", sinBusqueda: true, celda: (f) => <span className="whitespace-nowrap text-tenue">{fecha(f.fecha)}</span> },
    { clave: "total", titulo: "Total", alinear: "der", sinBusqueda: true, valor: (f) => Number(f.total), celda: (f) => enMoneda(f.total, f.moneda) },
    { clave: "pagado", titulo: "Pagado", alinear: "der", sinBusqueda: true, valor: (f) => Number(f.pagado), celda: (f) => (Number(f.pagado) ? enMoneda(f.pagado, f.moneda) : <span className="text-tenue">—</span>) },
    { clave: "saldo", titulo: "Saldo", alinear: "der", sinBusqueda: true, valor: (f) => Number(f.saldo_mxn),
      celda: (f) => <div><b>{enMoneda(f.saldo, f.moneda)}</b>{f.moneda !== "MXN" && <p className="text-xs text-tenue">≈ {dinero(f.saldo_mxn)}</p>}</div> },
  ];
  const columnasFacturas: Columna<Factura>[] = [
    { clave: "vence_el", titulo: "Vence", explica: GLOSARIO.vencePago, sinBusqueda: true, valor: (f) => f.dias, celda: (f) => <Vencimiento vence={f.vence_el} /> },
    { clave: "nombre", titulo: "Proveedor", clase: "min-w-[180px] max-w-[300px]", celda: (f) => <div><p className="font-medium break-words">{f.nombre}</p>{f.categoria && <p className="text-xs text-tenue">{f.categoria}</p>}</div> },
    { clave: "factura", titulo: "Factura", clase: "max-w-[320px]", valor: (f) => `${f.factura ?? ""} ${f.descripcion ?? ""}`,
      celda: (f) => <div>{f.factura ? <p>{f.factura}</p> : null}{f.posible_repetida && <InsigniaRepetida />}{f.descripcion && <p className="text-xs text-tenue line-clamp-2 break-words">{f.descripcion}</p>}{!f.factura && !f.descripcion && <span className="text-tenue">—</span>}</div> },
    { clave: "fecha", titulo: "Fecha", sinBusqueda: true, celda: (f) => <span className="whitespace-nowrap text-tenue">{fecha(f.fecha)}</span> },
    { clave: "monto", titulo: "Monto", alinear: "der", sinBusqueda: true, valor: (f) => Number(f.monto), celda: (f) => dinero(f.monto) },
    { clave: "restante", titulo: "Por pagar", alinear: "der", sinBusqueda: true, valor: (f) => Number(f.restante), explica: GLOSARIO.facturasPendientes, celda: (f) => <b>{dinero(f.restante)}</b> },
  ];

  return (
    <Pagina titulo="Pagos a proveedores" descripcion="Lo que debemos: lo vencido primero y lo que viene en las próximas 4 semanas."
      acciones={<>
        <TipoCambioDia />
        {verCuentas && <Boton onClick={() => setCompra({ abierto: true, proveedor: null })}><FilePlus2 className="h-4 w-4" /> Registrar compra o gasto</Boton>}
      </>}>
      <div className={cn("grid gap-3 sm:grid-cols-2", verCuentas ? "xl:grid-cols-5" : "xl:grid-cols-4")}>
        <Kpi titulo="Por pagar" valor={dineroCompacto(suma(todo))} icono={Wallet} tono="marca" explica={GLOSARIO.porPagar}
          detalle={verCuentas ? `${proveedoresCon(todo)} proveedores` : `${ordenes.length} órdenes recibidas con saldo`} alClic={() => setVista("todas")} />
        <Kpi titulo="Vencido" valor={dineroCompacto(suma(vencido))} icono={AlertTriangle} explica={GLOSARIO.vencePago} tono={vencido.length ? "peligro" : "ok"}
          detalle={vencido.length ? `${proveedoresCon(vencido)} proveedores · lo más viejo hace ${-Math.min(...vencido.map((f) => f.dias!))} días` : "Nada vencido"} alClic={() => setVista("vencidas")} />
        <Kpi titulo="Vence en 7 días" valor={dineroCompacto(suma(semana))} icono={CalendarDays} explica={GLOSARIO.vencePago} tono="aviso" detalle={`${proveedoresCon(semana)} proveedores`} alClic={() => setVista("semana")} />
        <Kpi titulo="Próximas 4 semanas" valor={dineroCompacto(cuatroSemanas)} icono={CalendarRange} explica={GLOSARIO.agendaPagos} tono="info" detalle="Sin contar lo vencido" />
        {verCuentas && <Kpi titulo="Socios y bancos" valor={dineroCompacto(socios.reduce((s, c) => s + Number(c.saldo), 0))} icono={Landmark} explica={GLOSARIO.sociosBancos} tono="neutro"
          detalle="Aparte de proveedores" alClic={() => { setPestana("proveedores"); setVistaProveedores("socios"); }} />}
      </div>

      <Tarjeta>
        <EncabezadoTarjeta titulo="Agenda de pagos" explica={GLOSARIO.agendaPagos} descripcion="Por fecha de vencimiento (fecha de la factura o de la recepción + días de crédito del proveedor)" />
        {cargando ? <Cargando filas={3} /> : (
          <div className="grid gap-3 px-4 pb-4 sm:grid-cols-2 lg:grid-cols-5">
            {columnasAgenda.map((c) => {
              const grupos = agrupar(c.filas);
              return (
                <div key={c.titulo} className={cn("rounded-xl border p-3 flex flex-col min-w-0", c.peligro && c.filas.length ? "border-peligro/30 bg-peligro-suave/50" : "border-borde bg-fondo/50")}>
                  <div className="flex items-baseline justify-between gap-2">
                    <p className={cn("font-medium text-sm", c.peligro && c.filas.length && "text-peligro")}>{c.titulo}</p>
                    <p className="text-xs text-tenue">{c.detalle}</p>
                  </div>
                  <p className="text-lg font-semibold cifra mt-1">{dinero(suma(c.filas))}</p>
                  <ul className="mt-2 space-y-1 flex-1">
                    {grupos.length === 0 && <li className="text-xs text-tenue py-1">Nada que pagar</li>}
                    {grupos.slice(0, 5).map((g) => (
                      <li key={g.grupo}>
                        <button onClick={g.abrir} className="w-full text-left rounded-md px-1.5 py-1 hover:bg-superficie flex justify-between gap-2 text-xs">
                          <span className="truncate">{g.proveedor.replace(/^DEMO /, "")}{g.n > 1 && <span className="text-tenue"> · {g.n}</span>}</span>
                          <span className="cifra shrink-0">{dineroCompacto(g.monto)}</span>
                        </button>
                      </li>
                    ))}
                    {grupos.length > 5 && <li className="text-xs text-tenue px-1.5">y {grupos.length - 5} proveedores más</li>}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </Tarjeta>

      <Pestanas value={pestana} onValueChange={(v) => setPestana(v as Pestana)}>
        {verCuentas && <ListaPestanas opciones={[
          { valor: "facturas", texto: "Facturas por pagar", cuenta: facturas.length, explica: GLOSARIO.facturasPendientes },
          { valor: "proveedores", texto: "Por proveedor", cuenta: new Set(facturas.map((f) => f.proveedor_llave)).size, explica: GLOSARIO.saldoProveedor },
          { valor: "ordenes", texto: "Órdenes de compra", cuenta: ordenes.length },
          { valor: "pagados", texto: "Pagos hechos", explica: GLOSARIO.pagosHechos },
        ]} />}
        {verCuentas && <ContenidoPestana value="facturas" className="pt-4">
          <TablaDatos
            filas={filasFacturas} columnas={columnasFacturas} cargando={pendientes.isLoading || cuentas.isLoading} error={pendientes.error ?? cuentas.error}
            claveFila={(f) => f.id} alClicFila={(f) => setLlave(f.proveedor_llave)} exportarComo="facturas-por-pagar"
            placeholder="Buscar proveedor, factura o concepto…" claseFila={(f) => (f.dias < 0 ? "bg-peligro-suave/30" : undefined)}
            filtros={filtroVista(facturas)}
            pie={filasFacturas.length > 0 && <div className="flex justify-end gap-6 text-sm"><span className="text-tenue">Por pagar de lo que se ve:</span><b className="cifra">{dinero(filasFacturas.reduce((s, f) => s + Number(f.restante), 0))}</b></div>}
            vacio={{ icono: Receipt, titulo: vista === "vencidas" ? "Nada vencido" : "No hay facturas por pagar", texto: "Registra cada factura con «Registrar compra o gasto» (sube el XML y se llena solo). Las que tienen saldo aparecen aquí con su vencimiento." }}
          />
        </ContenidoPestana>}
        {verCuentas && <ContenidoPestana value="proveedores" className="pt-4">
          <CuentasProveedores cuentas={cuentas.data ?? []} cargando={cuentas.isLoading} error={cuentas.error} alAbrir={setLlave} vistaInicial={vistaProveedores} />
        </ContenidoPestana>}
        {verCuentas && <ContenidoPestana value="pagados" className="pt-4"><PagosHechos alAbrirProveedor={setLlave} /></ContenidoPestana>}
        <ContenidoPestana value="ordenes" className="pt-4">
          <TablaDatos
            filas={filasOrdenes} columnas={columnasOrdenes} cargando={datos.isLoading} error={datos.error}
            claveFila={(f) => f.orden_compra_id} alClicFila={setAbierta} exportarComo="ordenes-por-pagar"
            placeholder="Buscar proveedor, orden o factura…"
            claseFila={(f) => ((f.dias_para_vencer ?? 1) < 0 ? "bg-peligro-suave/30" : undefined)}
            filtros={filtroVista(ordenes.map((o) => ({ dias: o.dias_para_vencer })))}
            pie={filasOrdenes.length > 0 && <div className="flex justify-end gap-6 text-sm"><span className="text-tenue">Saldo de lo que se ve:</span><b className="cifra">{dinero(filasOrdenes.reduce((s, f) => s + Number(f.saldo_mxn), 0))}</b></div>}
            vacio={{ icono: Receipt, titulo: vista === "vencidas" ? "Nada vencido" : "Ninguna orden por pagar", texto: "Aquí aparecen las órdenes de compra recibidas (completas o parciales) que tienen saldo." + (verCuentas ? " Lo que se compra sin orden está en «Facturas por pagar»." : "") }}
          />
        </ContenidoPestana>
      </Pestanas>

      <RegistrarPago orden={abierta} alCerrar={() => setAbierta(null)} />
      {verCuentas && <>
        {/* Del renglón vivo, no de una copia: al registrar un pago el saldo se actualiza aquí. */}
        <PanelProveedor cuenta={llave ? porLlave.get(llave) ?? null : null} facturas={(pendientes.data ?? []).filter((x) => x.proveedor_llave === llave)}
          alCerrar={() => setLlave(null)} alRegistrarCompra={(p) => setCompra({ abierto: true, proveedor: p })} />
        <RegistrarCompra abierto={compra.abierto} proveedorInicial={compra.proveedor} alCerrar={() => setCompra({ abierto: false, proveedor: null })} />
      </>}
    </Pagina>
  );
}

function RegistrarPago({ orden: o, alCerrar }: { orden: PorPagar | null; alCerrar: () => void }) {
  const { puede } = useSesion();
  const editable = puede("finanzas", 2);
  const [f, setF] = useState({ fecha: hoyISO(), monto: "", metodo: "transferencia", referencia: "" });
  useEffect(() => { if (o) setF({ fecha: hoyISO(), monto: String(o.saldo), metodo: "transferencia", referencia: "" }); }, [o]);
  const pagos = useQuery({
    queryKey: ["pagos_proveedor", o?.orden_compra_id],
    enabled: !!o,
    queryFn: () => q<{ id: string; fecha: string; monto: number; metodo: string; referencia: string | null }[]>(
      supabase.from("pagos_proveedor").select("id, fecha, monto, metodo, referencia").eq("orden_compra_id", o!.orden_compra_id).order("fecha")),
  });
  const guardar = useAccion(() => q(supabase.from("pagos_proveedor").insert({
    orden_compra_id: o!.orden_compra_id, fecha: f.fecha, monto: Number(f.monto), metodo: f.metodo, referencia: f.referencia.trim() || null,
  })), { exito: "Pago registrado", invalidar: [["v_por_pagar"], ["pagos_proveedor"], ["indicadores"]], alTerminar: alCerrar });
  const monto = Number(f.monto) || 0;
  function enviar(e: FormEvent) { e.preventDefault(); if (monto > 0) guardar.mutate(undefined); }
  if (!o) return null;
  return (
    <Dialogo abierto={!!o} alCambiar={(v) => !v && alCerrar()} ancho="max-w-xl"
      titulo={`${o.folio} · ${o.proveedor}`}
      descripcion={<>Total {enMoneda(o.total, o.moneda)} · pagado {enMoneda(o.pagado, o.moneda)} · <b>saldo {enMoneda(o.saldo, o.moneda)}</b>{o.factura_proveedor && ` · factura ${o.factura_proveedor}`}</>}
      pie={editable ? <>
        <Boton variante="secundario" onClick={alCerrar}>Cerrar</Boton>
        <Boton type="submit" form="registrar-pago" cargando={guardar.isPending} disabled={monto <= 0}>Registrar pago</Boton>
      </> : <Boton variante="secundario" onClick={alCerrar}>Cerrar</Boton>}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Vencimiento vence={o.vence_pago} />
          {o.datos_bancarios && <span className="text-tenue">Cuenta: <span className="font-mono text-texto">{o.datos_bancarios}</span></span>}
          {puede("compras") && <Link to={`/compras/ordenes/${o.orden_compra_id}`} className="inline-flex items-center gap-1 text-marca-texto"><ExternalLink className="h-3.5 w-3.5" /> Ver la orden</Link>}
        </div>
        {(pagos.data ?? []).length > 0 && (
          <table className="tabla">
            <thead><tr><th>Pagos anteriores</th><th>Método</th><th>Referencia</th><th className="!text-right">Monto</th></tr></thead>
            <tbody>{pagos.data!.map((p) => (
              <tr key={p.id}><td>{fecha(p.fecha)}</td><td>{nombreMetodo(p.metodo)}</td><td className="text-tenue">{p.referencia ?? "—"}</td><td className="text-right cifra">{enMoneda(p.monto, o.moneda)}</td></tr>
            ))}</tbody>
          </table>
        )}
        {editable ? (
          <form id="registrar-pago" onSubmit={enviar} className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta={`Monto (${o.moneda})`} ayuda={monto > 0 && monto < Number(o.saldo) ? `Queda un saldo de ${enMoneda(Number(o.saldo) - monto, o.moneda)}` : "Liquida la orden"}>
              <Entrada autoFocus type="number" step="0.01" min="0" max={o.saldo} value={f.monto} onChange={(e) => setF({ ...f, monto: e.target.value })} className="cifra" required />
            </Campo>
            <Campo etiqueta="Fecha del pago">
              <Entrada type="date" value={f.fecha} max={hoyISO()} onChange={(e) => setF({ ...f, fecha: e.target.value })} required />
            </Campo>
            <Campo etiqueta="Método">
              <Seleccion value={f.metodo} onChange={(e) => setF({ ...f, metodo: e.target.value })}>
                {METODOS.filter((m) => m.valor !== "mercadopago").map((m) => <option key={m.valor} value={m.valor}>{m.texto}</option>)}
              </Seleccion>
            </Campo>
            <Campo etiqueta="Referencia">
              <Entrada value={f.referencia} onChange={(e) => setF({ ...f, referencia: e.target.value })} placeholder="SPEI, cheque, cuenta de salida…" />
            </Campo>
          </form>
        ) : <p className="text-sm text-tenue">Solo finanzas registra pagos.</p>}
      </div>
    </Dialogo>
  );
}

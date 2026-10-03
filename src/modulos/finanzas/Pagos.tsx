import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CalendarDays, CalendarRange, ExternalLink, Receipt, Wallet } from "lucide-react";
import { Pagina } from "@/components/layout/Shell";
import { Kpi } from "@/components/ui/kpi";
import { Insignia } from "@/components/ui/insignia";
import { Boton } from "@/components/ui/boton";
import { Dialogo } from "@/components/ui/dialogo";
import { Campo, Entrada, Seleccion } from "@/components/ui/campo";
import { Tarjeta, EncabezadoTarjeta } from "@/components/ui/tarjeta";
import { Cargando } from "@/components/ui/estados";
import { TablaDatos, Filtro, type Columna } from "@/components/datos/TablaDatos";
import { useSesion } from "@/lib/sesion";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { dinero, dineroCompacto, fecha, hoyISO } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { METODOS, TipoCambioDia, iso, lunesDe, enMoneda, nombreMetodo, type Moneda } from "./componentes/comun";

interface PorPagar {
  orden_compra_id: string; folio: string; proveedor_id: string; proveedor: string; fecha: string; vence_pago: string | null;
  moneda: Moneda; total: number; pagado: number; saldo: number; factura_proveedor: string | null; dias_credito: number;
  categoria: string | null; datos_bancarios: string | null; saldo_mxn: number; dias_para_vencer: number | null; ultimo_pago: string | null;
}

function Vence({ f }: { f: PorPagar }) {
  if (f.dias_para_vencer == null) return <Insignia tono="neutro">Sin fecha</Insignia>;
  if (f.dias_para_vencer < 0) return <Insignia tono="peligro" punto>Vencida hace {-f.dias_para_vencer} {f.dias_para_vencer === -1 ? "día" : "días"}</Insignia>;
  if (f.dias_para_vencer === 0) return <Insignia tono="aviso" punto>Vence hoy</Insignia>;
  if (f.dias_para_vencer <= 7) return <Insignia tono="aviso">En {f.dias_para_vencer} {f.dias_para_vencer === 1 ? "día" : "días"}</Insignia>;
  return <span className="text-tenue text-sm whitespace-nowrap">{fecha(f.vence_pago)}</span>;
}

export default function Pagos() {
  const [vista, setVista] = useState<"todas" | "vencidas" | "semana">("todas");
  const [abierta, setAbierta] = useState<PorPagar | null>(null);
  const datos = useQuery({
    queryKey: ["v_por_pagar"],
    queryFn: () => q<PorPagar[]>(supabase.from("v_por_pagar").select("*")),
  });
  // Vencidas primero (la más vieja arriba), luego por fecha; las que no tienen fecha al final.
  const todas = [...(datos.data ?? [])].sort((a, b) => (a.dias_para_vencer ?? 1e9) - (b.dias_para_vencer ?? 1e9));
  const vencidas = todas.filter((f) => (f.dias_para_vencer ?? 1) < 0);
  const semana = todas.filter((f) => f.dias_para_vencer != null && f.dias_para_vencer >= 0 && f.dias_para_vencer <= 7);
  const suma = (fs: PorPagar[]) => fs.reduce((s, f) => s + Number(f.saldo_mxn), 0);
  const filas = vista === "vencidas" ? vencidas : vista === "semana" ? semana : todas;

  // Agenda: lo vencido y las próximas 4 semanas, de lunes a domingo.
  const lunes = lunesDe(new Date());
  const semanas = Array.from({ length: 4 }, (_, k) => {
    const ini = new Date(lunes); ini.setDate(ini.getDate() + 7 * k);
    const fin = new Date(ini); fin.setDate(fin.getDate() + 6);
    return { ini: iso(ini), fin: iso(fin), titulo: ["Esta semana", "La próxima", "En 2 semanas", "En 3 semanas"][k] };
  });
  const enSemana = (s: { ini: string; fin: string }) => todas.filter((f) => f.vence_pago && f.vence_pago >= s.ini && f.vence_pago <= s.fin && (f.dias_para_vencer ?? 0) >= 0);
  const columnasAgenda = [
    { titulo: "Vencido", detalle: "Pagar ya", filas: vencidas, peligro: true },
    ...semanas.map((s) => ({ titulo: s.titulo, detalle: `${fecha(s.ini).slice(0, 6)} – ${fecha(s.fin).slice(0, 6)}`, filas: enSemana(s), peligro: false })),
  ];
  const cuatroSemanas = columnasAgenda.slice(1).reduce((s, c) => s + suma(c.filas), 0);

  const columnas: Columna<PorPagar>[] = [
    { clave: "vence_pago", titulo: "Vence", sinBusqueda: true, valor: (f) => f.dias_para_vencer ?? 99999, celda: (f) => <Vence f={f} /> },
    { clave: "proveedor", titulo: "Proveedor", celda: (f) => <div className="min-w-[180px]"><p className="font-medium">{f.proveedor}</p><p className="text-xs text-tenue">{f.categoria ?? ""}{f.dias_credito ? ` · crédito ${f.dias_credito} días` : " · contado"}</p></div> },
    { clave: "folio", titulo: "Orden", celda: (f) => <span className="whitespace-nowrap">{f.folio}</span> },
    { clave: "factura_proveedor", titulo: "Factura", valor: (f) => f.factura_proveedor ?? "", celda: (f) => f.factura_proveedor ?? <span className="text-aviso text-xs">Sin factura</span> },
    { clave: "fecha", titulo: "Fecha", sinBusqueda: true, celda: (f) => <span className="whitespace-nowrap text-tenue">{fecha(f.fecha)}</span> },
    { clave: "total", titulo: "Total", alinear: "der", sinBusqueda: true, valor: (f) => Number(f.total), celda: (f) => enMoneda(f.total, f.moneda) },
    { clave: "pagado", titulo: "Pagado", alinear: "der", sinBusqueda: true, valor: (f) => Number(f.pagado), celda: (f) => (Number(f.pagado) ? enMoneda(f.pagado, f.moneda) : <span className="text-tenue">—</span>) },
    { clave: "saldo", titulo: "Saldo", alinear: "der", sinBusqueda: true, valor: (f) => Number(f.saldo_mxn),
      celda: (f) => <div><b>{enMoneda(f.saldo, f.moneda)}</b>{f.moneda !== "MXN" && <p className="text-xs text-tenue">≈ {dinero(f.saldo_mxn)}</p>}</div> },
  ];

  return (
    <Pagina titulo="Pagos a proveedores" descripcion="Lo que debemos por material recibido: lo vencido primero y lo que viene en las próximas 4 semanas." acciones={<TipoCambioDia />}>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi titulo="Por pagar" valor={dineroCompacto(suma(todas))} icono={Wallet} tono="marca" detalle={`${todas.length} órdenes recibidas con saldo`} alClic={() => setVista("todas")} />
        <Kpi titulo="Vencido" valor={dineroCompacto(suma(vencidas))} icono={AlertTriangle} tono={vencidas.length ? "peligro" : "ok"}
          detalle={vencidas.length ? `${vencidas.length} órdenes · la más vieja hace ${-Math.min(...vencidas.map((f) => f.dias_para_vencer!))} días` : "Nada vencido"} alClic={() => setVista("vencidas")} />
        <Kpi titulo="Vence en 7 días" valor={dineroCompacto(suma(semana))} icono={CalendarDays} tono="aviso" detalle={`${semana.length} órdenes`} alClic={() => setVista("semana")} />
        <Kpi titulo="Próximas 4 semanas" valor={dineroCompacto(cuatroSemanas)} icono={CalendarRange} tono="info" detalle="Sin contar lo vencido" />
      </div>

      <Tarjeta>
        <EncabezadoTarjeta titulo="Agenda de pagos" descripcion="Por fecha de vencimiento (fecha de recepción + días de crédito del proveedor)" />
        {datos.isLoading ? <Cargando filas={3} /> : (
          <div className="grid gap-3 px-4 pb-4 sm:grid-cols-2 lg:grid-cols-5">
            {columnasAgenda.map((c) => (
              <div key={c.titulo} className={cn("rounded-xl border p-3 flex flex-col", c.peligro && c.filas.length ? "border-peligro/30 bg-peligro-suave/50" : "border-borde bg-fondo/50")}>
                <div className="flex items-baseline justify-between gap-2">
                  <p className={cn("font-medium text-sm", c.peligro && c.filas.length && "text-peligro")}>{c.titulo}</p>
                  <p className="text-xs text-tenue">{c.detalle}</p>
                </div>
                <p className="text-lg font-semibold cifra mt-1">{dinero(suma(c.filas))}</p>
                <ul className="mt-2 space-y-1 flex-1">
                  {c.filas.length === 0 && <li className="text-xs text-tenue py-1">Nada que pagar</li>}
                  {c.filas.slice(0, 5).map((f) => (
                    <li key={f.orden_compra_id}>
                      <button onClick={() => setAbierta(f)} className="w-full text-left rounded-md px-1.5 py-1 hover:bg-superficie flex justify-between gap-2 text-xs">
                        <span className="truncate">{f.proveedor.replace(/^DEMO /, "")}<span className="text-tenue"> · {fecha(f.vence_pago).slice(0, 6)}</span></span>
                        <span className="cifra shrink-0">{dineroCompacto(f.saldo_mxn)}</span>
                      </button>
                    </li>
                  ))}
                  {c.filas.length > 5 && <li className="text-xs text-tenue px-1.5">y {c.filas.length - 5} más</li>}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Tarjeta>

      <TablaDatos
        filas={filas} columnas={columnas} cargando={datos.isLoading} error={datos.error}
        claveFila={(f) => f.orden_compra_id} alClicFila={setAbierta} exportarComo="cuentas-por-pagar"
        placeholder="Buscar proveedor, orden o factura…"
        claseFila={(f) => ((f.dias_para_vencer ?? 1) < 0 ? "bg-peligro-suave/30" : undefined)}
        filtros={<Filtro valor={vista} alCambiar={setVista} opciones={[
          { valor: "todas", texto: "Todas", cuenta: todas.length },
          { valor: "vencidas", texto: "Vencidas", cuenta: vencidas.length },
          { valor: "semana", texto: "Próximos 7 días", cuenta: semana.length },
        ]} />}
        pie={filas.length > 0 && <div className="flex justify-end gap-6 text-sm"><span className="text-tenue">Saldo de lo que se ve:</span><b className="cifra">{dinero(suma(filas))}</b></div>}
        vacio={{ icono: Receipt, titulo: vista === "vencidas" ? "Nada vencido" : "No debemos nada", texto: "Aquí aparecen las órdenes de compra recibidas (completas o parciales) que tienen saldo." }}
      />

      <RegistrarPago orden={abierta} alCerrar={() => setAbierta(null)} />
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
          <Vence f={o} />
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

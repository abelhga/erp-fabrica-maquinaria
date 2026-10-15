import { useEffect, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileSpreadsheet, Trash2 } from "lucide-react";
import { TablaDatos, Filtro, type Columna } from "@/components/datos/TablaDatos";
import { Lateral } from "@/components/ui/dialogo";
import { Insignia } from "@/components/ui/insignia";
import { Boton } from "@/components/ui/boton";
import { Campo, Entrada, Seleccion } from "@/components/ui/campo";
import { Cargando } from "@/components/ui/estados";
import { useSesion } from "@/lib/sesion";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { dinero, fecha, hace, hoyISO } from "@/lib/formato";
import { METODOS, nombreMetodo } from "./comun";

export type TipoAcreedor = "proveedor" | "socio" | "financiamiento";
export interface SaldoProveedorHoja {
  proveedor_llave: string; proveedor_id: string | null; nombre: string; categoria: string | null; tipo_acreedor: TipoAcreedor;
  adeudo_2021: number | null; comprado: number | null; pagado: number | null; saldo_hoja: number; pagado_erp: number; saldo: number;
  ultima_compra: string | null; ultimo_pago: string | null; movimientos: number;
}
interface PagoErp { id: string; fecha: string; monto: number; metodo: string; referencia: string | null; en_hoja: boolean }
const TIPO: Record<TipoAcreedor, string> = { proveedor: "Proveedor", socio: "Préstamo de socio", financiamiento: "Crédito bancario" };
const INVALIDAR = [["v_saldo_arranque_proveedores"], ["v_pagos_saldo_hoja"], ["tablero_direccion"]];
interface Movimiento { id: number; fecha: string; tipo: string; monto: number; cuenta: string | null; descripcion: string | null; factura: string | null; orden: string | null }

/** Lo que suma o resta cada tipo, como la pestaña Tipo de la hoja. */
const RESTA = new Set(["Pago", "Reembolso Pend."]);

/**
 * Saldos por proveedor según el libro de compras de la hoja (adeudo 2021 + compras − pagos
 * ± reembolsos) hasta el arranque del ERP. Van aparte de las órdenes de compra del ERP para
 * no contar dos veces. Positivo: le debemos; negativo: anticipo o reembolso a favor.
 */
export function SaldosProveedoresHoja() {
  const [vista, setVista] = useState<"debemos" | "socios" | "favor" | "todos">("debemos");
  const [abierto, setAbierto] = useState<string | null>(null);
  const datos = useQuery({
    queryKey: ["v_saldo_arranque_proveedores"],
    queryFn: () => q<SaldoProveedorHoja[]>(supabase.from("v_saldo_arranque_proveedores").select("*")),
  });
  const todos = datos.data ?? [];
  // Préstamos de socios y créditos de banco van aparte: no son deuda con proveedores.
  const debemos = todos.filter((f) => Number(f.saldo) > 1 && f.tipo_acreedor === "proveedor");
  const socios = todos.filter((f) => Number(f.saldo) > 1 && f.tipo_acreedor !== "proveedor");
  const favor = todos.filter((f) => Number(f.saldo) < -1);
  const suma = (fs: SaldoProveedorHoja[]) => fs.reduce((s, f) => s + Number(f.saldo), 0);
  const filas = (vista === "debemos" ? debemos : vista === "socios" ? socios : vista === "favor" ? favor : todos).slice()
    .sort((a, b) => (vista === "favor" ? Number(a.saldo) - Number(b.saldo) : Number(b.saldo) - Number(a.saldo)));

  const columnas: Columna<SaldoProveedorHoja>[] = [
    { clave: "nombre", titulo: "Proveedor", clase: "min-w-[200px] max-w-[340px]",
      celda: (f) => <div><p className="font-medium break-words">{f.nombre}</p>
        {(f.tipo_acreedor !== "proveedor" || f.categoria) && <p className="text-xs text-tenue">{f.tipo_acreedor !== "proveedor" ? TIPO[f.tipo_acreedor] : f.categoria}</p>}</div> },
    { clave: "comprado", titulo: "Comprado desde 2022", alinear: "der", sinBusqueda: true, valor: (f) => Number(f.comprado ?? 0), celda: (f) => dinero(f.comprado ?? 0) },
    { clave: "pagado", titulo: "Pagado", alinear: "der", sinBusqueda: true, valor: (f) => Number(f.pagado ?? 0), celda: (f) => dinero(f.pagado ?? 0) },
    { clave: "saldo", titulo: "Saldo", alinear: "der", sinBusqueda: true, valor: (f) => Number(f.saldo),
      celda: (f) => <div><b className={Number(f.saldo) < -1 ? "text-info" : ""}>{dinero(f.saldo)}</b>
        {Number(f.pagado_erp) > 0 && <p className="text-xs text-ok whitespace-nowrap">−{dinero(f.pagado_erp)} pagado en el ERP</p>}</div> },
    { clave: "ultima_compra", titulo: "Última compra", sinBusqueda: true, celda: (f) => <span className="whitespace-nowrap">{fecha(f.ultima_compra)}</span> },
    { clave: "ultimo_pago", titulo: "Último pago", sinBusqueda: true, valor: (f) => f.ultimo_pago,
      celda: (f) => f.ultimo_pago ? <span className="whitespace-nowrap" title={fecha(f.ultimo_pago)}>{hace(f.ultimo_pago)}</span> : <span className="text-aviso text-xs">Nunca</span> },
  ];

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-borde bg-fondo px-3 py-2 text-sm flex flex-wrap items-center gap-x-4 gap-y-1">
        <FileSpreadsheet className="h-4 w-4 text-tenue" />
        <span>Saldos del libro de compras de la hoja (adeudo de 2021 más compras menos pagos, con IVA).</span>
        <span className="text-tenue">No se suman a las órdenes de compra del ERP para no contarlos dos veces.</span>
        <span className="ml-auto flex flex-wrap gap-x-4 cifra">
          <b>A proveedores {dinero(suma(debemos))}</b>
          {socios.length > 0 && <span>Socios y bancos {dinero(suma(socios))}</span>}
          {favor.length > 0 && <span className="text-info">A favor {dinero(-suma(favor))}</span>}
        </span>
      </div>
      <TablaDatos filas={filas} columnas={columnas} cargando={datos.isLoading} error={datos.error} claveFila={(f) => f.proveedor_llave}
        alClicFila={(f) => setAbierto(f.proveedor_llave)} exportarComo="saldos-proveedores-hoja" placeholder="Buscar proveedor o categoría…"
        filtros={<Filtro valor={vista} alCambiar={setVista} opciones={[
          { valor: "debemos", texto: "Les debemos", cuenta: debemos.length },
          { valor: "socios", texto: "Socios y bancos", cuenta: socios.length },
          { valor: "favor", texto: "A nuestro favor", cuenta: favor.length },
          { valor: "todos", texto: "Todos", cuenta: todos.length },
        ]} />}
        vacio={{ icono: FileSpreadsheet, titulo: vista === "favor" ? "Ningún saldo a favor" : vista === "socios" ? "Sin préstamos de socios ni créditos" : "Sin saldos de la hoja",
          texto: "Aparecen cuando se importa el libro de compras de la hoja (pestaña COMPRAS de BASE DE DATOS ACTUAL)." }} />
      {/* Del renglón vivo, no de una copia: al registrar un pago el saldo se actualiza aquí. */}
      <MovimientosProveedor fila={todos.find((f) => f.proveedor_llave === abierto) ?? null} alCerrar={() => setAbierto(null)} />
    </div>
  );
}

/**
 * El panel de un proveedor: registrar un pago a su saldo de la hoja (finanzas), los pagos
 * que ya se hicieron en el ERP y sus movimientos en el libro, para conciliar.
 */
function MovimientosProveedor({ fila, alCerrar }: { fila: SaldoProveedorHoja | null; alCerrar: () => void }) {
  const { puede } = useSesion();
  const editable = puede("finanzas", 2);
  const llave = fila?.proveedor_llave;
  const movs = useQuery({
    queryKey: ["historial_compras_hoja", llave],
    enabled: !!llave,
    queryFn: () => q<Movimiento[]>(supabase.from("historial_compras_hoja")
      .select("id, fecha, tipo, monto, cuenta, descripcion, factura, orden")
      .eq("proveedor_llave", llave!).order("fecha", { ascending: false }).order("id", { ascending: false }).limit(200)),
  });
  const pagos = useQuery({
    queryKey: ["v_pagos_saldo_hoja", llave],
    enabled: !!llave,
    queryFn: () => q<PagoErp[]>(supabase.from("v_pagos_saldo_hoja").select("id, fecha, monto, metodo, referencia, en_hoja")
      .eq("proveedor_llave", llave!).order("fecha", { ascending: false })),
  });
  const borrar = useAccion((id: string) => q(supabase.from("pagos_saldo_hoja").delete().eq("id", id)), { exito: "Pago borrado", invalidar: INVALIDAR });
  return (
    <Lateral abierto={!!fila} alCambiar={(v) => !v && alCerrar()} titulo={fila?.nombre ?? ""}
      subtitulo={fila && <span>Saldo: <b className="cifra">{dinero(fila.saldo)}</b>
        {Number(fila.pagado_erp) > 0 && ` (hoja ${dinero(fila.saldo_hoja)} − pagado en el ERP ${dinero(fila.pagado_erp)})`}
        {fila.tipo_acreedor !== "proveedor" && ` · ${TIPO[fila.tipo_acreedor]}`}
        {Number(fila.adeudo_2021) ? ` · venía de 2021 con ${dinero(fila.adeudo_2021)}` : ""}</span>}>
      {fila && editable && Number(fila.saldo) > 0.5 && <PagarSaldo fila={fila} />}
      {(pagos.data ?? []).length > 0 && (
        <div className="mb-5">
          <p className="etiqueta mb-1">Pagos registrados en el ERP</p>
          <div className="divide-y divide-borde">
            {pagos.data!.map((p) => (
              <div key={p.id} className="py-2 flex items-center gap-3 text-sm">
                <span className="w-20 shrink-0 text-tenue whitespace-nowrap">{fecha(p.fecha)}</span>
                <span className="flex-1 min-w-0 flex flex-wrap items-center gap-2">
                  <Insignia tono="ok">Pago ERP</Insignia>
                  <span className="text-tenue">{nombreMetodo(p.metodo)}{p.referencia ? ` · ${p.referencia}` : ""}</span>
                  {p.en_hoja && <span title="La hoja trae un pago igual a este proveedor: no se descuenta dos veces."><Insignia tono="info">También en la hoja</Insignia></span>}
                </span>
                <span className="cifra shrink-0 font-medium">−{dinero(p.monto)}</span>
                {editable && (
                  <button type="button" onClick={() => { if (confirm(`¿Borrar el pago de ${dinero(p.monto)} del ${fecha(p.fecha)}?`)) borrar.mutate(p.id); }}
                    className="shrink-0 p-1 rounded text-tenue hover:text-peligro hover:bg-fondo" aria-label="Borrar pago" title="Borrar (pago mal capturado)">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      <p className="etiqueta mb-1">Movimientos en la hoja</p>
      {movs.isLoading ? <Cargando filas={6} /> : (
        <div className="divide-y divide-borde">
          {(movs.data ?? []).map((m) => (
            <div key={m.id} className="py-2 flex items-start gap-3 text-sm">
              <span className="w-20 shrink-0 text-tenue whitespace-nowrap">{fecha(m.fecha)}</span>
              <div className="flex-1 min-w-0">
                <p className="flex flex-wrap items-center gap-2">
                  <Insignia tono={m.tipo === "Compra" || m.tipo === "Adeudo 2021" ? "neutro" : m.tipo === "Pago" ? "ok" : "info"}>{m.tipo}</Insignia>
                  {m.factura && <span className="text-tenue">Fact. {m.factura}</span>}
                  {m.cuenta && <span className="text-tenue">{m.cuenta}</span>}
                </p>
                {m.descripcion && <p className="text-tenue mt-0.5 whitespace-pre-line break-words">{m.descripcion}</p>}
              </div>
              <span className="cifra shrink-0 font-medium">{RESTA.has(m.tipo) ? "−" : ""}{dinero(m.monto)}</span>
            </div>
          ))}
          {movs.data?.length === 200 && <p className="py-2 text-xs text-tenue">Se muestran los 200 más recientes.</p>}
        </div>
      )}
    </Lateral>
  );
}

/** Pagar (todo o una parte) el saldo de la hoja. La base no deja pagar más que el saldo. */
function PagarSaldo({ fila }: { fila: SaldoProveedorHoja }) {
  const [f, setF] = useState({ fecha: hoyISO(), monto: "", metodo: "transferencia", referencia: "" });
  useEffect(() => { setF({ fecha: hoyISO(), monto: "", metodo: "transferencia", referencia: "" }); }, [fila.proveedor_llave]);
  const monto = Number(f.monto) || 0;
  const guardar = useAccion(() => q(supabase.rpc("pagar_saldo_hoja", {
    p_llave: fila.proveedor_llave, p_monto: monto, p_fecha: f.fecha, p_metodo: f.metodo, p_referencia: f.referencia.trim() || null,
  })), { exito: "Pago registrado", invalidar: INVALIDAR, alTerminar: () => setF((x) => ({ ...x, monto: "", referencia: "" })) });
  function enviar(e: FormEvent) { e.preventDefault(); if (monto > 0) guardar.mutate(undefined); }
  return (
    <form onSubmit={enviar} className="mb-5 rounded-xl border border-borde bg-fondo/50 p-3 grid gap-3 sm:grid-cols-2">
      <p className="sm:col-span-2 font-medium text-sm">Registrar pago</p>
      <Campo etiqueta="Monto (MXN, con IVA)" ayuda={monto > 0 && monto < Number(fila.saldo) - 0.5 ? `Queda un saldo de ${dinero(Number(fila.saldo) - monto)}` : monto > 0 ? "Liquida el saldo" : undefined}>
        <div className="flex gap-2">
          <Entrada type="number" step="0.01" min="0" max={Number(fila.saldo)} value={f.monto} onChange={(e) => setF({ ...f, monto: e.target.value })}
            className="cifra" placeholder={Number(fila.saldo).toFixed(2)} required />
          <Boton type="button" variante="secundario" onClick={() => setF({ ...f, monto: Number(fila.saldo).toFixed(2) })}>Todo</Boton>
        </div>
      </Campo>
      <Campo etiqueta="Fecha">
        <Entrada type="date" value={f.fecha} max={hoyISO()} onChange={(e) => setF({ ...f, fecha: e.target.value })} required />
      </Campo>
      <Campo etiqueta="Método">
        <Seleccion value={f.metodo} onChange={(e) => setF({ ...f, metodo: e.target.value })}>
          {METODOS.filter((m) => m.valor !== "mercadopago").map((m) => <option key={m.valor} value={m.valor}>{m.texto}</option>)}
        </Seleccion>
      </Campo>
      <Campo etiqueta="Referencia">
        <Entrada value={f.referencia} onChange={(e) => setF({ ...f, referencia: e.target.value })} placeholder="SPEI, cheque, factura que liquida…" />
      </Campo>
      <div className="sm:col-span-2 flex justify-end">
        <Boton type="submit" cargando={guardar.isPending} disabled={monto <= 0}>Registrar pago</Boton>
      </div>
    </form>
  );
}

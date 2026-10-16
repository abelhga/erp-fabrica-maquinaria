import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileSpreadsheet, Trash2 } from "lucide-react";
import { TablaDatos, Filtro, type Columna } from "@/components/datos/TablaDatos";
import { Lateral } from "@/components/ui/dialogo";
import { Insignia } from "@/components/ui/insignia";
import { Boton } from "@/components/ui/boton";
import { Campo, Entrada } from "@/components/ui/campo";
import { Cargando } from "@/components/ui/estados";
import { useSesion } from "@/lib/sesion";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { dinero, fecha, hace, hoyISO } from "@/lib/formato";
import { GLOSARIO } from "@/tutorial/glosario";
import { todasLasFilas } from "@/modulos/almacen/componentes/comun";
import { SelectorCuenta, useCuentasDinero } from "./cuentas";
import type { Rango } from "./comun";

interface SaldoArranque {
  cliente_id: string; nombre: string; vendedor_id: string | null; vendido: number | null; pagado: number | null;
  saldo: number; ultima_venta: string | null; ultimo_pago: string | null; cobrado_erp: number;
}
const INVALIDAR = [["v_saldo_arranque_clientes"], ["v_cobros_saldo_hoja"], ["tablero_direccion"], ["v_cobranza"], ["saldo_arranque_antiguedad"]];

export interface SaldoHoja { total: number; clientes: number; rangos: Record<Rango, number> }
/**
 * Lo que los clientes ya debían en la hoja, con su antigüedad. Mientras los pedidos sean de
 * la hoja, ahí está casi todo lo que nos deben: sin sumarlo, "por cobrar" decía $0.
 * La base filtra por permisos: un vendedor recibe solo lo de sus clientes.
 */
export const useSaldoHoja = (activo = true) => useQuery({
  queryKey: ["saldo_arranque_antiguedad"], enabled: activo,
  queryFn: () => q<SaldoHoja>(supabase.rpc("saldo_arranque_antiguedad")),
});

/**
 * Saldos por cliente según el libro de ventas de la hoja (ventas − pagos − notas de crédito)
 * hasta el arranque del ERP, menos lo cobrado aquí. Van aparte de los pedidos del ERP para
 * no contar dos veces.
 */
export function SaldosArranque() {
  const [vista, setVista] = useState<"saldo" | "todos">("saldo");
  const [abierto, setAbierto] = useState<string | null>(null);
  const datos = useQuery({
    queryKey: ["v_saldo_arranque_clientes"],
    // Más de 1,000 clientes en el libro de la hoja: por páginas, que la API corta en 1,000.
    queryFn: () => todasLasFilas<SaldoArranque>((d, h) => supabase.from("v_saldo_arranque_clientes").select("*").order("cliente_id").range(d, h)),
  });
  const personas = useQuery({
    queryKey: ["perfiles", "breves"],
    queryFn: () => q<{ id: string; nombre: string }[]>(supabase.from("perfiles").select("id, nombre, correo, activo").order("nombre")),
  });
  const arranque = useQuery({
    queryKey: ["configuracion", "fecha_arranque"],
    queryFn: () => q<{ valor: string } | null>(supabase.from("configuracion").select("valor").eq("clave", "fecha_arranque").maybeSingle()),
  });
  const nombres = useMemo(() => new Map((personas.data ?? []).map((p) => [p.id, p.nombre])), [personas.data]);
  const conSaldo = (datos.data ?? []).filter((f) => Number(f.saldo) > 0.5);
  const filas = (vista === "saldo" ? conSaldo : datos.data ?? []).slice().sort((a, b) => Number(b.saldo) - Number(a.saldo));
  const total = conSaldo.reduce((s, f) => s + Number(f.saldo), 0);

  const columnas: Columna<SaldoArranque>[] = [
    { clave: "nombre", titulo: "Cliente", clase: "max-w-[280px]", celda: (f) => <span className="block truncate font-medium">{f.nombre}</span> },
    { clave: "vendedor", titulo: "Vendedor", valor: (f) => (f.vendedor_id ? nombres.get(f.vendedor_id) ?? "" : ""), celda: (f) => (f.vendedor_id ? nombres.get(f.vendedor_id) : null) ?? <span className="text-tenue">—</span> },
    { clave: "vendido", titulo: "Vendido", alinear: "der", sinBusqueda: true, valor: (f) => Number(f.vendido ?? 0), celda: (f) => dinero(f.vendido ?? 0) },
    { clave: "pagado", titulo: "Pagado", alinear: "der", sinBusqueda: true, valor: (f) => Number(f.pagado ?? 0), celda: (f) => dinero(f.pagado ?? 0) },
    { clave: "saldo", titulo: "Saldo", alinear: "der", sinBusqueda: true, valor: (f) => Number(f.saldo),
      celda: (f) => <div><b className={Number(f.saldo) < -0.5 ? "text-info" : ""}>{dinero(f.saldo)}</b>
        {Number(f.cobrado_erp) > 0 && <p className="text-xs text-ok whitespace-nowrap">−{dinero(f.cobrado_erp)} cobrado en el ERP</p>}</div> },
    { clave: "ultima_venta", titulo: "Última venta", sinBusqueda: true, celda: (f) => <span className="whitespace-nowrap">{fecha(f.ultima_venta)}</span> },
    { clave: "ultimo_pago", titulo: "Último pago", sinBusqueda: true, valor: (f) => f.ultimo_pago,
      celda: (f) => f.ultimo_pago ? <span className="whitespace-nowrap" title={fecha(f.ultimo_pago)}>{hace(f.ultimo_pago)}</span> : <span className="text-aviso text-xs">Nunca</span> },
  ];

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-borde bg-fondo px-3 py-2 text-sm flex flex-wrap items-center gap-x-4 gap-y-1">
        <FileSpreadsheet className="h-4 w-4 text-tenue" />
        <span>Saldos del libro de ventas de la hoja (ventas menos pagos, con IVA){arranque.data?.valor ? ` hasta el arranque del ERP, ${fecha(String(arranque.data.valor))}` : ""}.</span>
        <span className="text-tenue">Los pedidos que vienen de la hoja se cobran contra este saldo, no aparte, para no contarlos dos veces.</span>
        <b className="ml-auto cifra">{conSaldo.length} clientes · {dinero(total)}</b>
      </div>
      <TablaDatos filas={filas} columnas={columnas} cargando={datos.isLoading} error={datos.error} claveFila={(f) => f.cliente_id}
        alClicFila={(f) => setAbierto(f.cliente_id)} exportarComo="saldos-arranque-hoja" placeholder="Buscar cliente o vendedor…"
        filtros={<Filtro valor={vista} alCambiar={setVista} opciones={[{ valor: "saldo", texto: "Con saldo", cuenta: conSaldo.length }, { valor: "todos", texto: "Todos", cuenta: datos.data?.length }]} />}
        vacio={{ icono: FileSpreadsheet, titulo: "Sin saldos de la hoja", texto: "Aparecen cuando se importa el libro de ventas desde Sistema → Importar de Sheets." }} />
      {/* Del renglón vivo: al registrar un cobro el saldo baja aquí mismo. */}
      <CobrosCliente fila={(datos.data ?? []).find((f) => f.cliente_id === abierto) ?? null} alCerrar={() => setAbierto(null)} />
    </div>
  );
}

interface Cobro { id: string; fecha: string; monto: number; cuenta: string; referencia: string | null; en_hoja: boolean }
interface MovHoja { id: number; fecha: string; tipo: string; monto: number; factura: string | null; descripcion: string | null }

/** Un cliente con saldo de la hoja: sus cobros en el ERP, registrar uno, y su libro de la hoja. */
function CobrosCliente({ fila, alCerrar }: { fila: SaldoArranque | null; alCerrar: () => void }) {
  const { puede } = useSesion();
  const editable = puede("finanzas", 2);
  const id = fila?.cliente_id;
  const cuentas = useCuentasDinero();
  const cobros = useQuery({
    queryKey: ["v_cobros_saldo_hoja", id], enabled: !!id,
    queryFn: () => q<Cobro[]>(supabase.from("v_cobros_saldo_hoja").select("id, fecha, monto, cuenta, referencia, en_hoja").eq("cliente_id", id!).order("fecha", { ascending: false })),
  });
  const hoja = useQuery({
    queryKey: ["historial_ventas_hoja", "cliente", id], enabled: !!id,
    queryFn: () => q<MovHoja[]>(supabase.from("historial_ventas_hoja").select("id, fecha, tipo, monto, factura, descripcion")
      .eq("cliente_id", id!).order("fecha", { ascending: false }).limit(30)),
  });
  const borrar = useAccion((x: string) => q(supabase.from("cobros_saldo_hoja").delete().eq("id", x)), { exito: "Cobro borrado", invalidar: INVALIDAR });
  return (
    <Lateral abierto={!!fila} alCambiar={(v) => !v && alCerrar()} titulo={fila?.nombre ?? ""}
      subtitulo={fila && <span>Saldo de la hoja: <b className="cifra text-texto">{dinero(fila.saldo)}</b>{Number(fila.cobrado_erp) > 0 && ` (ya con ${dinero(fila.cobrado_erp)} cobrado aquí)`}</span>}>
      {fila && editable && Number(fila.saldo) > 0.5 && <RegistrarCobro fila={fila} />}
      {(cobros.data ?? []).length > 0 && (
        <div className="mb-5">
          <p className="etiqueta mb-1">Cobros registrados en el ERP</p>
          <div className="divide-y divide-borde">
            {cobros.data!.map((c) => (
              <div key={c.id} className="py-2 flex items-center gap-3 text-sm">
                <span className="w-20 shrink-0 text-tenue whitespace-nowrap">{fecha(c.fecha)}</span>
                <span className="flex-1 min-w-0 flex flex-wrap items-center gap-2">
                  <span>{cuentas.data?.find((x) => x.clave === c.cuenta)?.nombre ?? c.cuenta}</span>
                  {c.referencia && <span className="text-tenue">{c.referencia}</span>}
                  {c.en_hoja && <span data-explain={GLOSARIO.tambienEnHoja} data-explain-title="También en la hoja"><Insignia tono="info">También en la hoja</Insignia></span>}
                </span>
                <span className="cifra shrink-0 font-medium">−{dinero(c.monto)}</span>
                {editable && (
                  <button type="button" onClick={() => { if (confirm(`¿Borrar el cobro de ${dinero(c.monto)} del ${fecha(c.fecha)}?`)) borrar.mutate(c.id); }}
                    className="shrink-0 p-1 rounded text-tenue hover:text-peligro hover:bg-fondo" aria-label="Borrar cobro" title="Borrar (mal capturado)">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      <p className="etiqueta mb-1">Últimos movimientos en la hoja</p>
      {hoja.isLoading ? <Cargando filas={5} /> : (
        <div className="divide-y divide-borde">
          {(hoja.data ?? []).map((m) => (
            <div key={m.id} className="py-2 flex items-start gap-3 text-sm">
              <span className="w-20 shrink-0 text-tenue whitespace-nowrap">{fecha(m.fecha)}</span>
              <div className="flex-1 min-w-0">
                <p className="flex flex-wrap items-center gap-2"><Insignia tono={m.tipo === "Venta" ? "neutro" : "ok"}>{m.tipo}</Insignia>{m.factura && <span className="text-tenue">Fact. {m.factura}</span>}</p>
                {m.descripcion && <p className="text-tenue mt-0.5 break-words line-clamp-2">{m.descripcion}</p>}
              </div>
              <span className="cifra shrink-0 font-medium">{m.tipo === "Venta" ? "" : "−"}{dinero(m.monto)}</span>
            </div>
          ))}
        </div>
      )}
    </Lateral>
  );
}

/** Cobrar (todo o una parte) el saldo de la hoja. La base no deja cobrar de más. */
function RegistrarCobro({ fila }: { fila: SaldoArranque }) {
  const saldo = Number(fila.saldo);
  const [f, setF] = useState({ fecha: hoyISO(), monto: "", cuenta: "", referencia: "" });
  useEffect(() => setF({ fecha: hoyISO(), monto: "", cuenta: "", referencia: "" }), [fila.cliente_id]);
  const monto = Number(f.monto) || 0;
  const guardar = useAccion(() => q(supabase.rpc("registrar_cobro_saldo_hoja", {
    p_cliente: fila.cliente_id, p_monto: monto, p_cuenta: f.cuenta, p_fecha: f.fecha, p_referencia: f.referencia.trim() || null,
  })), { exito: "Cobro registrado", invalidar: INVALIDAR, alTerminar: () => setF((x) => ({ ...x, monto: "", referencia: "" })) });
  function enviar(e: FormEvent) { e.preventDefault(); if (monto > 0 && f.cuenta) guardar.mutate(undefined); }
  return (
    <form onSubmit={enviar} className="mb-5 rounded-xl border border-borde bg-fondo/50 p-3 grid gap-3 sm:grid-cols-2" data-explain={GLOSARIO.cobroSaldoHoja} data-explain-title="Cobro a un saldo de la hoja">
      <p className="sm:col-span-2 font-medium text-sm">Registrar cobro</p>
      <Campo etiqueta="Monto (con IVA)" className="sm:col-span-2" ayuda={monto > 0 && monto < saldo - 0.5 ? `Queda un saldo de ${dinero(saldo - monto)}` : monto > 0 ? "Liquida el saldo" : undefined}>
        <div className="flex gap-2">
          <Entrada autoFocus type="number" step="0.01" min="0" max={saldo} value={f.monto} onChange={(e) => setF({ ...f, monto: e.target.value })} className="cifra" placeholder={saldo.toFixed(2)} required />
          <Boton type="button" variante="secundario" onClick={() => setF({ ...f, monto: saldo.toFixed(2) })}>Todo</Boton>
        </div>
      </Campo>
      <Campo etiqueta="Entró a la cuenta"><SelectorCuenta valor={f.cuenta} alCambiar={(v) => setF({ ...f, cuenta: v })} /></Campo>
      <Campo etiqueta="Fecha"><Entrada type="date" value={f.fecha} max={hoyISO()} onChange={(e) => setF({ ...f, fecha: e.target.value })} required /></Campo>
      <Campo etiqueta="Referencia" className="sm:col-span-2"><Entrada value={f.referencia} onChange={(e) => setF({ ...f, referencia: e.target.value })} placeholder="SPEI, depósito, factura que paga…" /></Campo>
      <div className="sm:col-span-2 flex justify-end"><Boton type="submit" cargando={guardar.isPending} disabled={monto <= 0 || !f.cuenta}>Registrar cobro</Boton></div>
    </form>
  );
}

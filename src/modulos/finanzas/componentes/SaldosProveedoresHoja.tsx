import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileSpreadsheet } from "lucide-react";
import { TablaDatos, Filtro, type Columna } from "@/components/datos/TablaDatos";
import { Lateral } from "@/components/ui/dialogo";
import { Insignia } from "@/components/ui/insignia";
import { Cargando } from "@/components/ui/estados";
import { supabase } from "@/lib/supabase";
import { q } from "@/lib/consultas";
import { dinero, fecha, hace } from "@/lib/formato";

export interface SaldoProveedorHoja {
  proveedor_llave: string; proveedor_id: string | null; nombre: string; categoria: string | null;
  adeudo_2021: number | null; comprado: number | null; pagado: number | null; saldo: number;
  ultima_compra: string | null; ultimo_pago: string | null; movimientos: number;
}
interface Movimiento { id: number; fecha: string; tipo: string; monto: number; cuenta: string | null; descripcion: string | null; factura: string | null; orden: string | null }

/** Lo que suma o resta cada tipo, como la pestaña Tipo de la hoja. */
const RESTA = new Set(["Pago", "Reembolso Pend."]);

/**
 * Saldos por proveedor según el libro de compras de la hoja (adeudo 2021 + compras − pagos
 * ± reembolsos) hasta el arranque del ERP. Van aparte de las órdenes de compra del ERP para
 * no contar dos veces. Positivo: le debemos; negativo: anticipo o reembolso a favor.
 */
export function SaldosProveedoresHoja() {
  const [vista, setVista] = useState<"debemos" | "favor" | "todos">("debemos");
  const [abierto, setAbierto] = useState<SaldoProveedorHoja | null>(null);
  const datos = useQuery({
    queryKey: ["v_saldo_arranque_proveedores"],
    queryFn: () => q<SaldoProveedorHoja[]>(supabase.from("v_saldo_arranque_proveedores").select("*")),
  });
  const todos = datos.data ?? [];
  const debemos = todos.filter((f) => Number(f.saldo) > 1);
  const favor = todos.filter((f) => Number(f.saldo) < -1);
  const suma = (fs: SaldoProveedorHoja[]) => fs.reduce((s, f) => s + Number(f.saldo), 0);
  const filas = (vista === "debemos" ? debemos : vista === "favor" ? favor : todos).slice()
    .sort((a, b) => (vista === "favor" ? Number(a.saldo) - Number(b.saldo) : Number(b.saldo) - Number(a.saldo)));

  const columnas: Columna<SaldoProveedorHoja>[] = [
    { clave: "nombre", titulo: "Proveedor", clase: "min-w-[200px] max-w-[340px]",
      celda: (f) => <div><p className="font-medium break-words">{f.nombre}</p>{f.categoria && <p className="text-xs text-tenue">{f.categoria}</p>}</div> },
    { clave: "comprado", titulo: "Comprado desde 2022", alinear: "der", sinBusqueda: true, valor: (f) => Number(f.comprado ?? 0), celda: (f) => dinero(f.comprado ?? 0) },
    { clave: "pagado", titulo: "Pagado", alinear: "der", sinBusqueda: true, valor: (f) => Number(f.pagado ?? 0), celda: (f) => dinero(f.pagado ?? 0) },
    { clave: "saldo", titulo: "Saldo", alinear: "der", sinBusqueda: true, valor: (f) => Number(f.saldo),
      celda: (f) => <b className={Number(f.saldo) < -1 ? "text-info" : ""}>{dinero(f.saldo)}</b> },
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
          <b>Debemos {dinero(suma(debemos))}</b>
          {favor.length > 0 && <span className="text-info">A favor {dinero(-suma(favor))}</span>}
          <span className="text-tenue">Neto {dinero(suma(todos))}</span>
        </span>
      </div>
      <TablaDatos filas={filas} columnas={columnas} cargando={datos.isLoading} error={datos.error} claveFila={(f) => f.proveedor_llave}
        alClicFila={setAbierto} exportarComo="saldos-proveedores-hoja" placeholder="Buscar proveedor o categoría…"
        filtros={<Filtro valor={vista} alCambiar={setVista} opciones={[
          { valor: "debemos", texto: "Les debemos", cuenta: debemos.length },
          { valor: "favor", texto: "A nuestro favor", cuenta: favor.length },
          { valor: "todos", texto: "Todos", cuenta: todos.length },
        ]} />}
        vacio={{ icono: FileSpreadsheet, titulo: vista === "favor" ? "Ningún saldo a favor" : "Sin saldos de la hoja",
          texto: "Aparecen cuando se importa el libro de compras de la hoja (pestaña COMPRAS de BASE DE DATOS ACTUAL)." }} />
      <MovimientosProveedor fila={abierto} alCerrar={() => setAbierto(null)} />
    </div>
  );
}

/** Los movimientos de un proveedor en el libro, del más reciente al más viejo, para conciliar. */
function MovimientosProveedor({ fila, alCerrar }: { fila: SaldoProveedorHoja | null; alCerrar: () => void }) {
  const movs = useQuery({
    queryKey: ["historial_compras_hoja", fila?.proveedor_llave],
    enabled: !!fila,
    queryFn: () => q<Movimiento[]>(supabase.from("historial_compras_hoja")
      .select("id, fecha, tipo, monto, cuenta, descripcion, factura, orden")
      .eq("proveedor_llave", fila!.proveedor_llave).order("fecha", { ascending: false }).order("id", { ascending: false }).limit(200)),
  });
  return (
    <Lateral abierto={!!fila} alCambiar={(v) => !v && alCerrar()} titulo={fila?.nombre ?? ""}
      subtitulo={fila && <span>Saldo en la hoja: <b className="cifra">{dinero(fila.saldo)}</b>{Number(fila.adeudo_2021) ? ` · venía de 2021 con ${dinero(fila.adeudo_2021)}` : ""}</span>}>
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

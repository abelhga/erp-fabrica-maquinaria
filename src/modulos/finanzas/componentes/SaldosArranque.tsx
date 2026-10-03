import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileSpreadsheet } from "lucide-react";
import { TablaDatos, Filtro, type Columna } from "@/components/datos/TablaDatos";
import { supabase } from "@/lib/supabase";
import { q } from "@/lib/consultas";
import { dinero, fecha, hace } from "@/lib/formato";

interface SaldoArranque {
  cliente_id: string; nombre: string; vendedor_id: string | null; vendido: number | null; pagado: number | null;
  saldo: number; ultima_venta: string | null; ultimo_pago: string | null;
}

/**
 * Saldos por cliente según el libro de ventas de la hoja (ventas − pagos − notas de crédito)
 * hasta el arranque del ERP. Van aparte de los pedidos del ERP para no contar dos veces.
 */
export function SaldosArranque() {
  const [vista, setVista] = useState<"saldo" | "todos">("saldo");
  const datos = useQuery({
    queryKey: ["v_saldo_arranque_clientes"],
    queryFn: () => q<SaldoArranque[]>(supabase.from("v_saldo_arranque_clientes").select("*")),
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
    { clave: "saldo", titulo: "Saldo", alinear: "der", sinBusqueda: true, valor: (f) => Number(f.saldo), celda: (f) => <b className={Number(f.saldo) < -0.5 ? "text-info" : ""}>{dinero(f.saldo)}</b> },
    { clave: "ultima_venta", titulo: "Última venta", sinBusqueda: true, celda: (f) => <span className="whitespace-nowrap">{fecha(f.ultima_venta)}</span> },
    { clave: "ultimo_pago", titulo: "Último pago", sinBusqueda: true, valor: (f) => f.ultimo_pago,
      celda: (f) => f.ultimo_pago ? <span className="whitespace-nowrap" title={fecha(f.ultimo_pago)}>{hace(f.ultimo_pago)}</span> : <span className="text-aviso text-xs">Nunca</span> },
  ];

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-borde bg-fondo px-3 py-2 text-sm flex flex-wrap items-center gap-x-4 gap-y-1">
        <FileSpreadsheet className="h-4 w-4 text-tenue" />
        <span>Saldos del libro de ventas de la hoja (ventas menos pagos, con IVA){arranque.data?.valor ? ` hasta el arranque del ERP, ${fecha(String(arranque.data.valor))}` : ""}.</span>
        <span className="text-tenue">No se suman a los saldos de pedidos del ERP para no contarlos dos veces.</span>
        <b className="ml-auto cifra">{conSaldo.length} clientes · {dinero(total)}</b>
      </div>
      <TablaDatos filas={filas} columnas={columnas} cargando={datos.isLoading} error={datos.error} claveFila={(f) => f.cliente_id}
        exportarComo="saldos-arranque-hoja" placeholder="Buscar cliente o vendedor…"
        filtros={<Filtro valor={vista} alCambiar={setVista} opciones={[{ valor: "saldo", texto: "Con saldo", cuenta: conSaldo.length }, { valor: "todos", texto: "Todos", cuenta: datos.data?.length }]} />}
        vacio={{ icono: FileSpreadsheet, titulo: "Sin saldos de la hoja", texto: "Aparecen cuando se importa el libro de ventas desde Sistema → Importar de Sheets." }} />
    </div>
  );
}

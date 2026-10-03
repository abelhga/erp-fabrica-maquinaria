import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Database, Terminal } from "lucide-react";
import { Pagina } from "@/components/layout/Shell";
import { Tarjeta, EncabezadoTarjeta } from "@/components/ui/tarjeta";
import { Kpi } from "@/components/ui/kpi";
import { Vacio, Cargando } from "@/components/ui/estados";
import { supabase } from "@/lib/supabase";
import { q } from "@/lib/consultas";
import { fechaYHora, numero } from "@/lib/formato";
import { SugerenciasSubensamble } from "./SugerenciasSubensamble";

interface Importacion {
  id: number; fuente: string; en: string;
  resumen: {
    leidos?: Record<string, number>; validacion_precios?: { comparados: number; iguales: number; distintos: number; ejemplos: { clave: string; hoja: number; erp: number }[] };
    avisos?: string[]; existencias_cargadas?: number; historial_costos?: number; ventas_historicas?: number; clientes_paneles?: number;
  };
}

const NOMBRES: Record<string, string> = {
  proveedores: "Proveedores", componentes: "Componentes", precios_historicos: "Precios históricos", equipos: "Equipos",
  lineas_bom: "Líneas de materiales", filas_inventario: "Artículos en inventario", movimientos_hoja: "Movimientos de almacén",
  clientes_paneles: "Clientes (paneles)", ventas_paneles: "Ventas (paneles)",
};

/** Estado de la migración desde las hojas: qué se trajo, si los precios cuadran y qué hay que revisar. */
export default function Importar() {
  const hist = useQuery({
    queryKey: ["importaciones"],
    queryFn: () => q<Importacion[]>(supabase.from("importaciones").select("*").order("en", { ascending: false }).limit(10)),
  });
  // Lo cargado se lee de la base, no de la última corrida: al reimportar, las
  // existencias no se vuelven a cargar y el resumen de esa corrida diría 0.
  const cargado = useQuery({
    queryKey: ["importaciones", "estado"],
    queryFn: async () => {
      // existencias y no movimientos_inventario: los movimientos llevan costo y sistemas no los ve.
      const { count } = await supabase.from("existencias").select("articulo_id", { count: "exact", head: true }).gt("cantidad", 0);
      return { existencias: count ?? 0 };
    },
  });
  const ultima = hist.data?.[0];
  const v = ultima?.resumen.validacion_precios;

  return (
    <Pagina titulo="Importar de Google Sheets" descripcion="La migración desde las hojas: qué se trajo, si los números cuadran y qué falta limpiar.">
      {hist.isLoading ? <Cargando /> : !ultima ? (
        <Tarjeta><Vacio icono={Database} titulo="Todavía no se ha importado nada" texto="Corre el importador (instrucciones abajo) y aquí aparecerá el resultado." /></Tarjeta>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {v && (
              <Kpi titulo="Precios de equipo iguales a Nuevo Costeo" valor={`${v.iguales} de ${v.comparados}`}
                icono={v.distintos ? AlertTriangle : CheckCircle2} tono={v.distintos ? "aviso" : "ok"}
                detalle={v.distintos ? `${v.distintos} con diferencia: revisar antes de cotizar` : "El ERP calcula exactamente lo mismo que la hoja"} />
            )}
            <Kpi titulo="Existencias de arranque" valor={numero(cargado.data?.existencias)} icono={Database} tono="marca" detalle="Artículo × almacén, cargadas una sola vez" />
            <Kpi titulo="Historial de costos" valor={numero(ultima.resumen.historial_costos)} icono={Database} tono="info" detalle="Precios de compra desde 2011" />
            <Kpi titulo="Ventas históricas" valor={numero(ultima.resumen.ventas_historicas)} icono={Database} tono="neutro" detalle={`${numero(ultima.resumen.clientes_paneles)} clientes de los paneles`} />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Tarjeta className="lg:col-span-1">
              <EncabezadoTarjeta titulo="Lo que se leyó" descripcion={`Última importación: ${fechaYHora(ultima.en)}`} />
              <table className="tabla">
                <tbody>
                  {Object.entries(ultima.resumen.leidos ?? {}).map(([k, n]) => (
                    <tr key={k}><td>{NOMBRES[k] ?? k}</td><td className="text-right cifra">{numero(n)}</td></tr>
                  ))}
                </tbody>
              </table>
            </Tarjeta>
            <Tarjeta className="lg:col-span-2">
              <EncabezadoTarjeta titulo="Para revisar" descripcion="Problemas que ya existían en las hojas y que el ERP hizo visibles" />
              <ul className="px-5 pb-4 space-y-2 text-sm">
                {(ultima.resumen.avisos ?? []).length === 0 ? <li className="text-tenue">Nada pendiente.</li> :
                  ultima.resumen.avisos!.map((a, i) => (
                    <li key={i} className="flex gap-2"><AlertTriangle className="h-4 w-4 text-aviso shrink-0 mt-0.5" /><span className="break-words">{a}</span></li>
                  ))}
              </ul>
            </Tarjeta>
          </div>
        </>
      )}

      <SugerenciasSubensamble />

      <Tarjeta>
        <EncabezadoTarjeta titulo={<span className="inline-flex items-center gap-2"><Terminal className="h-4 w-4" /> Cómo volver a importar</span>}
          descripcion="Mientras dure la transición se puede correr las veces que haga falta: actualiza por clave y no duplica." />
        <div className="px-5 pb-5 text-sm space-y-2">
          <p>Desde una computadora con el repositorio y la cadena de conexión de la base (Supabase → Project Settings → Database):</p>
          <pre className="bg-fondo border border-borde rounded-lg p-3 overflow-x-auto text-xs font-mono">{`DATABASE_URL=… GOOGLE_ACCESS_TOKEN=… npm run importar -- --google
npx tsx scripts/detectar-subensambles.ts`}</pre>
          <p className="text-tenue">Las existencias de arranque solo se cargan una vez. Después del día de corte, cualquier diferencia se corrige con un ajuste de inventario autorizado, no reimportando.</p>
        </div>
      </Tarjeta>

      {hist.data && hist.data.length > 1 && (
        <Tarjeta>
          <EncabezadoTarjeta titulo="Importaciones anteriores" />
          <table className="tabla">
            <thead><tr><th>Fecha</th><th>Fuente</th><th className="text-right">Precios iguales</th></tr></thead>
            <tbody>
              {hist.data.map((h) => (
                <tr key={h.id}><td>{fechaYHora(h.en)}</td><td className="text-tenue">{h.fuente.startsWith("archivos") ? "Archivos" : "Google Sheets"}</td>
                  <td className="text-right cifra">{h.resumen.validacion_precios ? `${h.resumen.validacion_precios.iguales}/${h.resumen.validacion_precios.comparados}` : "—"}</td></tr>
              ))}
            </tbody>
          </table>
        </Tarjeta>
      )}
    </Pagina>
  );
}

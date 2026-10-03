import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, History, Lock } from "lucide-react";
import { Pagina } from "@/components/layout/Shell";
import { Insignia, type Tono } from "@/components/ui/insignia";
import { Entrada, Seleccion } from "@/components/ui/campo";
import { Lateral } from "@/components/ui/dialogo";
import { Cargando } from "@/components/ui/estados";
import { TablaDatos, type Columna } from "@/components/datos/TablaDatos";
import { useSesion } from "@/lib/sesion";
import { supabase } from "@/lib/supabase";
import { q } from "@/lib/consultas";
import { fechaYHora, hace } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { TABLAS, etiquetaDeCambios, filasDiff, nombreColumna, nombreTabla, valorLegible, type Cambios } from "./componentes/diff";

interface Registro {
  id: number; tabla: string; registro_id: string; accion: "alta" | "cambio" | "baja"; cambios: Cambios; usuario_id: string | null; en: string;
  usuario: string | null; usuario_correo: string | null; etiqueta: string | null;
}

const ACCIONES: Record<Registro["accion"], { texto: string; tono: Tono }> = {
  alta: { texto: "Alta", tono: "ok" }, cambio: { texto: "Cambio", tono: "info" }, baja: { texto: "Baja", tono: "peligro" },
};
const LIMITE = 500;

/** A dónde llevar desde la bitácora a la pantalla del registro, si existe una. */
function rutaDe(r: Registro): string | null {
  const id = r.registro_id;
  switch (r.tabla) {
    case "pedidos": return `/ventas/pedidos/${id}`;
    case "cotizaciones": return `/ventas/cotizaciones/${id}`;
    case "clientes": return `/ventas/clientes/${id}`;
    case "proveedores": return `/compras/proveedores/${id}`;
    case "ordenes_compra": return `/compras/ordenes/${id}`;
    case "ordenes_produccion": return `/produccion/ordenes/${id}`;
    case "articulos": return `/costeo/componentes/${id}`;
    case "empleados": case "empleado_datos": return `/rrhh/empleados?empleado=${id}`;
    default: return null;
  }
}

export default function Bitacora() {
  const [tabla, setTabla] = useState("");
  const [usuario, setUsuario] = useState("");
  const [accion, setAccion] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [abierto, setAbierto] = useState<Registro | null>(null);

  const personas = useQuery({
    queryKey: ["perfiles", "breves"],
    queryFn: () => q<{ id: string; nombre: string; correo: string; activo: boolean }[]>(supabase.from("perfiles").select("id, nombre, correo, activo").order("nombre")),
  });
  const nombres = useMemo(() => new Map((personas.data ?? []).map((p) => [p.id, p.nombre])), [personas.data]);

  const datos = useQuery({
    queryKey: ["v_bitacora", tabla, usuario, accion, desde, hasta],
    queryFn: () => {
      let c = supabase.from("v_bitacora").select("*").order("en", { ascending: false }).limit(LIMITE);
      if (tabla) c = c.eq("tabla", tabla);
      if (usuario === "sistema") c = c.is("usuario_id", null);
      else if (usuario) c = c.eq("usuario_id", usuario);
      if (accion) c = c.eq("accion", accion);
      if (desde) c = c.gte("en", new Date(desde + "T00:00:00").toISOString());
      if (hasta) c = c.lt("en", new Date(new Date(hasta + "T00:00:00").getTime() + 86_400_000).toISOString());
      return q<Registro[]>(c);
    },
  });

  const columnas: Columna<Registro>[] = [
    { clave: "en", titulo: "Cuándo", sinBusqueda: true, celda: (r) => <span className="whitespace-nowrap" title={hace(r.en)}>{fechaYHora(r.en)}</span> },
    { clave: "usuario", titulo: "Quién", valor: (r) => r.usuario ?? "Sistema", celda: (r) => r.usuario ?? <span className="text-tenue">Sistema</span> },
    { clave: "accion", titulo: "Acción", valor: (r) => ACCIONES[r.accion].texto, celda: (r) => <Insignia tono={ACCIONES[r.accion].tono}>{ACCIONES[r.accion].texto}</Insignia> },
    { clave: "tabla", titulo: "Qué", valor: (r) => nombreTabla(r.tabla), celda: (r) => <span className="whitespace-nowrap">{nombreTabla(r.tabla)}</span> },
    {
      clave: "registro", titulo: "Registro", valor: (r) => r.etiqueta ?? etiquetaDeCambios(r.cambios) ?? r.registro_id,
      celda: (r) => <span className="block max-w-[260px] truncate">{r.etiqueta ?? etiquetaDeCambios(r.cambios) ?? <span className="text-tenue font-mono text-xs">{r.registro_id.slice(0, 18)}</span>}</span>,
    },
    {
      clave: "resumen", titulo: "Cambió", valor: (r) => (r.accion === "cambio" ? Object.keys(r.cambios ?? {}).map(nombreColumna).join(", ") : ""),
      celda: (r) => {
        const filas = filasDiff(r.cambios, r.accion);
        if (r.accion !== "cambio") return <span className="text-tenue">{filas.length ? `${filas.length} datos` : "—"}</span>;
        const una = filas.length === 1 ? filas[0] : null;
        return una ? (
          <span className="block max-w-[320px] truncate">
            {nombreColumna(una.columna)}: <span className="text-tenue line-through">{valorLegible(una.antes, una.columna, nombres)}</span> → {valorLegible(una.despues, una.columna, nombres)}
          </span>
        ) : <span className="block max-w-[320px] truncate">{filas.map((f) => nombreColumna(f.columna)).join(", ")}</span>;
      },
    },
  ];

  const hayFiltros = tabla || usuario || accion || desde || hasta;

  return (
    <Pagina titulo="Bitácora" descripcion="Quién cambió qué y cuándo. Nada se borra de aquí.">
      <div className="tarjeta p-3 grid gap-2 grid-cols-2 md:grid-cols-[1.4fr_1.2fr_1fr_1fr_1fr_auto] items-end">
        <label className="space-y-1 col-span-2 md:col-span-1">
          <span className="etiqueta">Qué</span>
          <Seleccion value={tabla} onChange={(e) => setTabla(e.target.value)}>
            <option value="">Todo</option>
            {Object.entries(TABLAS).sort((a, b) => a[1].localeCompare(b[1], "es")).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Seleccion>
        </label>
        <label className="space-y-1 col-span-2 md:col-span-1">
          <span className="etiqueta">Quién</span>
          <Seleccion value={usuario} onChange={(e) => setUsuario(e.target.value)}>
            <option value="">Cualquiera</option>
            <option value="sistema">Sistema (procesos automáticos)</option>
            {(personas.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </Seleccion>
        </label>
        <label className="space-y-1">
          <span className="etiqueta">Acción</span>
          <Seleccion value={accion} onChange={(e) => setAccion(e.target.value)}>
            <option value="">Todas</option>
            {Object.entries(ACCIONES).map(([k, v]) => <option key={k} value={k}>{v.texto}</option>)}
          </Seleccion>
        </label>
        <label className="space-y-1">
          <span className="etiqueta">Desde</span>
          <Entrada type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="etiqueta">Hasta</span>
          <Entrada type="date" value={hasta} min={desde || undefined} onChange={(e) => setHasta(e.target.value)} />
        </label>
        <button className={cn("h-9 px-3 text-sm text-marca-texto", !hayFiltros && "invisible")}
          onClick={() => { setTabla(""); setUsuario(""); setAccion(""); setDesde(""); setHasta(""); }}>Quitar filtros</button>
      </div>

      <TablaDatos
        filas={datos.data} columnas={columnas} cargando={datos.isLoading} error={datos.error} claveFila={(r) => String(r.id)}
        alClicFila={setAbierto} exportarComo="bitacora" placeholder="Buscar en lo que se ve: persona, registro, columna…" compacta
        pie={(datos.data?.length ?? 0) >= LIMITE && <p className="text-xs text-tenue">Se muestran los {LIMITE} cambios más recientes. Usa los filtros para ir más atrás.</p>}
        vacio={{ icono: History, titulo: hayFiltros ? "Nada con esos filtros" : "Sin cambios registrados", texto: hayFiltros ? "Prueba con otras fechas o quita filtros." : "Cada alta, cambio o baja en el ERP queda aquí con quién la hizo." }}
      />
      <p className="text-xs text-tenue flex items-center gap-1.5">
        <Lock className="h-3.5 w-3.5" /> Solo ves los cambios de lo que tu rol puede ver: sueldos y datos sensibles solo con Recursos humanos nivel 3; costos y márgenes solo con Costos.
      </p>

      <Detalle registro={abierto} nombres={nombres} alCerrar={() => setAbierto(null)} />
    </Pagina>
  );
}

function Detalle({ registro: r, nombres, alCerrar }: { registro: Registro | null; nombres: Map<string, string>; alCerrar: () => void }) {
  const { puede } = useSesion();
  const historia = useQuery({
    queryKey: ["v_bitacora", "registro", r?.tabla, r?.registro_id],
    enabled: !!r,
    queryFn: () => q<Registro[]>(supabase.from("v_bitacora").select("*").eq("tabla", r!.tabla).eq("registro_id", r!.registro_id).order("en", { ascending: false }).limit(50)),
  });
  const filas = r ? filasDiff(r.cambios, r.accion) : [];
  // El empleado de una incidencia es el registro mismo: se nombra con su etiqueta en vez del id.
  const nombresDetalle = r?.etiqueta && ["incidencias", "empleado_datos"].includes(r.tabla)
    ? new Map([...nombres, ...filas.filter((f) => f.columna === "empleado_id").flatMap((f) => [f.antes, f.despues]).filter(Boolean).map((v) => [String(v), r.etiqueta!] as [string, string])])
    : nombres;
  const ruta = r ? rutaDe(r) : null;
  const puedeIr = r && ruta && (!r.tabla.startsWith("emplea") || puede("rrhh"));
  return (
    <Lateral abierto={!!r} alCambiar={(v) => !v && alCerrar()} ancho="max-w-2xl"
      titulo={r ? `${ACCIONES[r.accion].texto} en ${nombreTabla(r.tabla).toLowerCase()}` : ""}
      subtitulo={r && <span>{r.etiqueta ?? etiquetaDeCambios(r.cambios) ?? r.registro_id} · {r.usuario ?? "Sistema"} · {fechaYHora(r.en)}</span>}>
      {r && (
        <div className="space-y-6">
          {puedeIr && <Link to={ruta!} className="inline-flex items-center gap-1 text-sm text-marca-texto"><ExternalLink className="h-3.5 w-3.5" /> Abrir el registro</Link>}
          {filas.length === 0 ? <p className="text-sm text-tenue">Este movimiento no guardó el detalle de los datos (se registró antes de que la bitácora guardara las altas).</p> : (
            <table className="tabla rounded-xl border border-borde overflow-hidden">
              <thead>
                <tr>
                  <th>Dato</th>
                  {r.accion !== "alta" && <th>{r.accion === "baja" ? "Tenía" : "Antes"}</th>}
                  {r.accion !== "baja" && <th>{r.accion === "alta" ? "Valor" : "Después"}</th>}
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <tr key={f.columna}>
                    <td className="font-medium whitespace-nowrap align-top">{nombreColumna(f.columna)}</td>
                    {r.accion !== "alta" && <td className={cn("align-top break-words max-w-[260px]", r.accion === "cambio" && "text-peligro/90 line-through decoration-peligro/40")}>{valorLegible(f.antes, f.columna, nombresDetalle)}</td>}
                    {r.accion !== "baja" && <td className={cn("align-top break-words max-w-[260px]", r.accion === "cambio" && "text-ok font-medium")}>{valorLegible(f.despues, f.columna, nombresDetalle)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <section className="space-y-2">
            <h4 className="font-medium">Historia de este registro</h4>
            {historia.isLoading ? <Cargando filas={2} /> : (
              <ol className="relative border-l border-borde ml-2 space-y-3">
                {(historia.data ?? []).map((h) => (
                  <li key={h.id} className="ml-4">
                    <span className={cn("absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border-2 border-superficie", h.id === r.id ? "bg-marca" : "bg-borde")} />
                    <p className="text-sm"><Insignia tono={ACCIONES[h.accion].tono}>{ACCIONES[h.accion].texto}</Insignia> <span className="text-tenue">{fechaYHora(h.en)} · {h.usuario ?? "Sistema"}</span></p>
                    {h.accion === "cambio" && <p className="text-xs text-tenue mt-0.5">{filasDiff(h.cambios, h.accion).map((f) => nombreColumna(f.columna)).join(", ")}</p>}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      )}
    </Lateral>
  );
}

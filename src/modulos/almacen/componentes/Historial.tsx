import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { TablaDatos, type Columna } from "@/components/datos/TablaDatos";
import { Seleccion } from "@/components/ui/campo";
import { Insignia } from "@/components/ui/insignia";
import { useSesion } from "@/lib/sesion";
import { supabase } from "@/lib/supabase";
import { q } from "@/lib/consultas";
import { dinero, fechaYHora, hoyISO, numero } from "@/lib/formato";
import { CantidadConSigno, InsigniaMovimiento, TIPO_MOV, nombreCorto, todasLasFilas, useAlmacenes, type TipoMovimiento } from "./comun";

interface Mov {
  id: number; en: string; tipo: TipoMovimiento; clave: string; nombre: string; unidad: string; almacen: string; cantidad: number;
  costo_unitario: number | null; motivo: string | null; usuario: string | null; referencia: string | null; fuera_de_lista: boolean;
}

const GRUPOS: { valor: string; texto: string; tipos: TipoMovimiento[] }[] = [
  { valor: "", texto: "Todos los tipos", tipos: [] },
  { valor: "entradas", texto: "Entradas de compra", tipos: ["entrada_compra"] },
  { valor: "salidas", texto: "Todas las salidas", tipos: ["salida_produccion", "salida_venta", "salida_consumo"] },
  { valor: "produccion", texto: "Salidas a producción", tipos: ["salida_produccion"] },
  { valor: "venta", texto: "Ventas", tipos: ["salida_venta"] },
  { valor: "consumo", texto: "Consumo (taller, EPP…)", tipos: ["salida_consumo"] },
  { valor: "devolucion", texto: "Devoluciones", tipos: ["devolucion"] },
  { valor: "traspaso", texto: "Traspasos", tipos: ["traspaso_salida", "traspaso_entrada"] },
  { valor: "ajuste", texto: "Ajustes autorizados", tipos: ["ajuste_entrada", "ajuste_salida"] },
  { valor: "inicial", texto: "Saldos iniciales", tipos: ["inicial"] },
];

const hace30 = () => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toLocaleDateString("en-CA"); };

/** Libro de movimientos con filtros del lado del servidor (son decenas de miles) y exportar a Excel. */
export function Historial() {
  const { puede } = useSesion();
  const almacenes = useAlmacenes();
  const [grupo, setGrupo] = useState("");
  const [almacen, setAlmacen] = useState("");
  const [usuario, setUsuario] = useState("");
  const [desde, setDesde] = useState(hace30());
  const [hasta, setHasta] = useState(hoyISO());
  const verCostos = puede("costos", 1);
  const LIMITE = 2000;

  const usuarios = useQuery({
    queryKey: ["perfiles", "activos"],
    staleTime: 10 * 60_000,
    queryFn: () => q<{ id: string; nombre: string }[]>(supabase.from("perfiles").select("id, nombre").eq("activo", true).order("nombre")),
  });
  const datos = useQuery({
    queryKey: ["v_movimientos", grupo, almacen, usuario, desde, hasta],
    queryFn: () => {
      const tipos = GRUPOS.find((g) => g.valor === grupo)?.tipos ?? [];
      return todasLasFilas<Mov>((d, h) => {
        let c = supabase.from("v_movimientos")
          .select("id, en, tipo, clave, nombre, unidad, almacen, cantidad, costo_unitario, motivo, usuario, referencia, fuera_de_lista")
          .order("en", { ascending: false }).order("id", { ascending: false });
        if (tipos.length) c = c.in("tipo", tipos);
        if (almacen) c = c.eq("almacen_id", Number(almacen));
        if (usuario) c = c.eq("usuario_id", usuario);
        if (desde) c = c.gte("en", new Date(desde + "T00:00:00").toISOString());
        if (hasta) c = c.lt("en", new Date(new Date(hasta + "T00:00:00").getTime() + 86_400_000).toISOString());
        return c.range(d, h);
      }, LIMITE);
    },
  });

  const columnas: Columna<Mov>[] = [
    { clave: "en", titulo: "Fecha", clase: "whitespace-nowrap text-xs text-tenue px-2", valor: (m) => m.en, celda: (m) => fechaYHora(m.en) },
    { clave: "tipo", titulo: "Movimiento", valor: (m) => TIPO_MOV[m.tipo]?.texto ?? m.tipo,
      clase: "px-2", celda: (m) => <><InsigniaMovimiento tipo={m.tipo} />{m.fuera_de_lista && <Insignia tono="aviso" className="ml-1">fuera de lista</Insignia>}</> },
    // La clave va en su columna solo en pantallas muy anchas; el CSV la trae siempre.
    { clave: "clave", titulo: "Clave", clase: "whitespace-nowrap text-tenue text-xs hidden 2xl:table-cell" },
    { clave: "nombre", titulo: "Artículo", clase: "min-w-[220px]",
      celda: (m) => <><p>{m.nombre}</p><p className="text-xs text-tenue 2xl:hidden">{m.clave}</p></> },
    { clave: "almacen", titulo: "Almacén", clase: "whitespace-nowrap px-2", celda: (m) => nombreCorto(m.almacen) },
    { clave: "cantidad", titulo: "Cantidad", alinear: "der", sinBusqueda: true, clase: "px-2", valor: (m) => Number(m.cantidad),
      celda: (m) => <CantidadConSigno n={Number(m.cantidad)} unidad={m.unidad} /> },
    { clave: "referencia", titulo: "Referencia", clase: "whitespace-nowrap px-2 text-xs", celda: (m) => m.referencia ?? <span className="text-tenue">—</span> },
    { clave: "motivo", titulo: "Motivo", clase: "max-w-[200px] truncate text-tenue text-xs px-2", celda: (m) => <span title={m.motivo ?? ""}>{m.motivo ?? "—"}</span> },
    { clave: "usuario", titulo: "Quién", clase: "whitespace-nowrap text-xs px-2" },
    { clave: "valor", titulo: "Valor", alinear: "der", sinBusqueda: true, oculta: !verCostos,
      valor: (m) => (m.costo_unitario == null ? null : Math.round(Number(m.cantidad) * Number(m.costo_unitario) * 100) / 100),
      celda: (m) => (m.costo_unitario == null ? "—" : dinero(Number(m.cantidad) * Number(m.costo_unitario))) },
  ];

  return (
    <TablaDatos
      filas={datos.data}
      columnas={columnas}
      cargando={datos.isLoading}
      error={datos.error}
      claveFila={(m) => String(m.id)}
      exportarComo="movimientos"
      placeholder="Filtrar por artículo, motivo, referencia…"
      compacta
      filtros={
        <div className="flex flex-wrap items-center gap-2">
          <Seleccion className="w-auto h-8 text-xs" value={grupo} onChange={(e) => setGrupo(e.target.value)} aria-label="Tipo">
            {GRUPOS.map((g) => <option key={g.valor} value={g.valor}>{g.texto}</option>)}
          </Seleccion>
          <Seleccion className="w-auto h-8 text-xs" value={almacen} onChange={(e) => setAlmacen(e.target.value)} aria-label="Almacén">
            <option value="">Todos los almacenes</option>
            {(almacenes.data ?? []).map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
          </Seleccion>
          <Seleccion className="w-auto h-8 text-xs max-w-[180px]" value={usuario} onChange={(e) => setUsuario(e.target.value)} aria-label="Usuario">
            <option value="">Cualquier usuario</option>
            {(usuarios.data ?? []).map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
          </Seleccion>
          <label className="flex items-center gap-1 text-xs text-tenue">
            Del <input type="date" className="campo h-8 w-[136px] text-xs" value={desde} max={hasta} onChange={(e) => setDesde(e.target.value)} />
          </label>
          <label className="flex items-center gap-1 text-xs text-tenue">
            al <input type="date" className="campo h-8 w-[136px] text-xs" value={hasta} min={desde} onChange={(e) => setHasta(e.target.value)} />
          </label>
        </div>
      }
      vacio={{ icono: History, titulo: "Sin movimientos con estos filtros", texto: "Amplía las fechas o quita el filtro de tipo, almacén o usuario." }}
      pie={(datos.data?.length ?? 0) >= LIMITE
        ? <p className="text-xs text-aviso">Se muestran los {numero(LIMITE)} más recientes. Acorta las fechas para ver el resto o exportarlo completo.</p>
        : <p className="text-xs text-tenue">Fechas y usuarios los pone el servidor al registrar: no se pueden capturar con fecha atrasada ni a nombre de otro.</p>}
    />
  );
}

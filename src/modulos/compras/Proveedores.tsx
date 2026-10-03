import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Globe2, Plus, Truck } from "lucide-react";
import { Pagina } from "@/components/layout/Shell";
import { TablaDatos, Filtro, type Columna } from "@/components/datos/TablaDatos";
import { Boton } from "@/components/ui/boton";
import { Insignia } from "@/components/ui/insignia";
import { useSesion } from "@/lib/sesion";
import { supabase } from "@/lib/supabase";
import { dineroCompacto, fecha, numero } from "@/lib/formato";
import { todasLasFilas } from "@/modulos/almacen/componentes/comun";
import { DialogoProveedor } from "./componentes/DialogoProveedor";
import type { Moneda } from "./componentes/comun";

interface FilaProveedor {
  id: string; nombre: string; razon_social: string | null; categoria: string | null; pais: string; es_importacion: boolean; moneda: Moneda;
  dias_credito: number; dias_entrega: number | null; activo: boolean; articulos: number; oc_abiertas: number; oc_atrasadas: number;
  comprado_12m: number | null; ultima_compra: string | null;
}
type Vista = "surten" | "importacion" | "abiertas" | "todos" | "inactivos";

/**
 * Proveedores. El directorio que se importó de las hojas mezcla proveedores de
 * compras con acreedores (nómina, casetas, hoteles); por eso de entrada se ven
 * solo los que surten algún artículo.
 */
export default function Proveedores() {
  const { puede } = useSesion();
  const ir = useNavigate();
  const [vista, setVista] = useState<Vista>("surten");
  const [nuevo, setNuevo] = useState(false);
  const verDinero = puede("costos", 1) || puede("finanzas", 1);

  const datos = useQuery({
    queryKey: ["v_proveedores"],
    queryFn: () => todasLasFilas<FilaProveedor>((d, h) => supabase.from("v_proveedores")
      .select("id, nombre, razon_social, categoria, pais, es_importacion, moneda, dias_credito, dias_entrega, activo, articulos, oc_abiertas, oc_atrasadas, comprado_12m, ultima_compra")
      .order("nombre").order("id").range(d, h)),
  });
  const filas = datos.data ?? [];
  const pasa = (p: FilaProveedor, v: Vista) => {
    if (v === "inactivos") return !p.activo;
    if (!p.activo) return false;
    if (v === "surten") return p.articulos > 0 || p.oc_abiertas > 0;
    if (v === "importacion") return p.es_importacion;
    if (v === "abiertas") return p.oc_abiertas > 0;
    return true;
  };

  const columnas: Columna<FilaProveedor>[] = [
    {
      clave: "nombre", titulo: "Proveedor", clase: "max-w-[280px]", valor: (p) => `${p.nombre} ${p.razon_social ?? ""}`,
      celda: (p) => <><p className="truncate font-medium" title={p.nombre}>{p.nombre}</p>{p.razon_social && p.razon_social !== p.nombre && <p className="text-xs text-tenue truncate">{p.razon_social}</p>}</>,
    },
    { clave: "categoria", titulo: "Categoría", clase: "max-w-[170px] truncate text-tenue text-xs px-2", celda: (p) => <span title={p.categoria ?? ""}>{p.categoria ?? "—"}</span> },
    {
      clave: "pais", titulo: "Origen", clase: "px-2 whitespace-nowrap", valor: (p) => `${p.pais}${p.es_importacion ? " importación" : ""} ${p.moneda}`,
      celda: (p) => <>{p.es_importacion ? <Insignia tono="info"><Globe2 className="h-3 w-3" /> {p.pais}</Insignia> : <span className="text-sm">{p.pais}</span>}
        {p.moneda !== "MXN" && <span className="ml-1 text-xs text-tenue">{p.moneda}</span>}</>,
    },
    { clave: "dias_credito", titulo: "Crédito", alinear: "der", sinBusqueda: true, clase: "px-2 whitespace-nowrap", celda: (p) => p.dias_credito ? `${p.dias_credito} d` : <span className="text-tenue">contado</span> },
    { clave: "dias_entrega", titulo: "Entrega", alinear: "der", sinBusqueda: true, clase: "px-2 whitespace-nowrap", celda: (p) => p.dias_entrega != null ? `${p.dias_entrega} d háb.` : <span className="text-tenue">—</span> },
    { clave: "articulos", titulo: "Artículos", alinear: "der", sinBusqueda: true, clase: "px-2", celda: (p) => p.articulos ? numero(p.articulos) : <span className="text-tenue/50">·</span> },
    {
      clave: "oc_abiertas", titulo: "OC abiertas", alinear: "der", sinBusqueda: true, clase: "px-2 whitespace-nowrap",
      celda: (p) => p.oc_abiertas ? <span>{p.oc_abiertas}{p.oc_atrasadas > 0 && <Insignia tono="peligro" className="ml-1">{p.oc_atrasadas} tarde</Insignia>}</span> : <span className="text-tenue/50">·</span>,
    },
    { clave: "comprado_12m", titulo: "Comprado 12 m", alinear: "der", sinBusqueda: true, oculta: !verDinero, clase: "px-2 whitespace-nowrap", celda: (p) => p.comprado_12m ? dineroCompacto(p.comprado_12m) : <span className="text-tenue/50">·</span> },
    { clave: "ultima_compra", titulo: "Última OC", clase: "whitespace-nowrap text-tenue text-xs px-2 hidden 2xl:table-cell", celda: (p) => p.ultima_compra ? fecha(p.ultima_compra) : "—" },
  ];

  return (
    <Pagina
      titulo="Proveedores"
      descripcion="A quién se le compra, en qué moneda, con cuánto crédito y en cuántos días entrega."
      acciones={puede("compras", 2) && <Boton onClick={() => setNuevo(true)}><Plus className="h-4 w-4" /> Nuevo proveedor</Boton>}
    >
      <TablaDatos
        filas={filas.filter((p) => pasa(p, vista))}
        columnas={columnas}
        cargando={datos.isLoading}
        error={datos.error}
        claveFila={(p) => p.id}
        alClicFila={(p) => ir(`/compras/proveedores/${p.id}`)}
        exportarComo="proveedores"
        placeholder="Nombre, razón social, categoría…"
        filtros={<Filtro<Vista> valor={vista} alCambiar={setVista} opciones={[
          { valor: "surten", texto: "Surten artículos", cuenta: filas.filter((p) => pasa(p, "surten")).length },
          { valor: "importacion", texto: "Importación", cuenta: filas.filter((p) => pasa(p, "importacion")).length },
          { valor: "abiertas", texto: "Con OC abiertas", cuenta: filas.filter((p) => pasa(p, "abiertas")).length },
          { valor: "todos", texto: "Todo el directorio", cuenta: filas.filter((p) => pasa(p, "todos")).length },
          { valor: "inactivos", texto: "Inactivos" },
        ]} />}
        vacio={{ icono: Truck, titulo: "Sin proveedores con este filtro", texto: "Prueba con “Todo el directorio” o da de alta uno nuevo." }}
      />
      <DialogoProveedor abierto={nuevo} alCambiar={setNuevo} alGuardar={(id) => ir(`/compras/proveedores/${id}`)} />
    </Pagina>
  );
}

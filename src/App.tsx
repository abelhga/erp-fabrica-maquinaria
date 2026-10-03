import { lazy, Suspense, type ComponentType, type ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Loader2, Lock } from "lucide-react";
import { useSesion, type Modulo } from "./lib/sesion";
import { Shell } from "./components/layout/Shell";
import { Entrar, SinAcceso } from "./paginas/Entrar";

// Cada pantalla se baja solo cuando se abre: el almacenista no descarga el cotizador.
const p = (f: () => Promise<{ default: ComponentType }>) => lazy(f);
const Inicio = p(() => import("./modulos/inicio/Inicio"));
const Componentes = p(() => import("./modulos/costeo/Componentes"));
const Equipos = p(() => import("./modulos/costeo/Equipos"));
const DetalleArticulo = p(() => import("./modulos/costeo/DetalleArticulo"));
const Margenes = p(() => import("./modulos/costeo/Margenes"));
const PreciosVentas = p(() => import("./modulos/analisis/PreciosVentas"));
const Oportunidades = p(() => import("./modulos/ventas/Oportunidades"));
const Cotizaciones = p(() => import("./modulos/ventas/Cotizaciones"));
const EditorCotizacion = p(() => import("./modulos/ventas/EditorCotizacion"));
const ImprimirCotizacion = p(() => import("./modulos/ventas/ImprimirCotizacion"));
const Pedidos = p(() => import("./modulos/ventas/Pedidos"));
const DetallePedido = p(() => import("./modulos/ventas/DetallePedido"));
const Clientes = p(() => import("./modulos/ventas/Clientes"));
const DetalleCliente = p(() => import("./modulos/ventas/DetalleCliente"));
const Comisiones = p(() => import("./modulos/ventas/Comisiones"));
const Precios = p(() => import("./modulos/compras/Precios"));
const OrdenesCompra = p(() => import("./modulos/compras/OrdenesCompra"));
const DetalleOrdenCompra = p(() => import("./modulos/compras/DetalleOrdenCompra"));
const Proveedores = p(() => import("./modulos/compras/Proveedores"));
const DetalleProveedor = p(() => import("./modulos/compras/DetalleProveedor"));
const Existencias = p(() => import("./modulos/almacen/Existencias"));
const Movimientos = p(() => import("./modulos/almacen/Movimientos"));
const Reabasto = p(() => import("./modulos/almacen/Reabasto"));
const Gerencia = p(() => import("./modulos/produccion/Gerencia"));
const OrdenesProduccion = p(() => import("./modulos/produccion/Ordenes"));
const DetalleOrden = p(() => import("./modulos/produccion/DetalleOrden"));
const Terminal = p(() => import("./modulos/produccion/Terminal"));
const PantallaPiso = p(() => import("./modulos/produccion/PantallaPiso"));
const Empleados = p(() => import("./modulos/rrhh/Empleados"));
const Incidencias = p(() => import("./modulos/rrhh/Incidencias"));
const Objetivos = p(() => import("./modulos/rrhh/Objetivos"));
const Checklist = p(() => import("./modulos/rrhh/Checklist"));
const Prenomina = p(() => import("./modulos/rrhh/Prenomina"));
const MiDesempeno = p(() => import("./modulos/rrhh/MiDesempeno"));
const Cobranza = p(() => import("./modulos/finanzas/Cobranza"));
const Pagos = p(() => import("./modulos/finanzas/Pagos"));
const Usuarios = p(() => import("./modulos/sistema/Usuarios"));
const Importar = p(() => import("./modulos/sistema/Importar"));
const Bitacora = p(() => import("./modulos/sistema/Bitacora"));
const Configuracion = p(() => import("./modulos/sistema/Configuracion"));
const ParaLlamar = p(() => import("./modulos/asistente/ParaLlamar"));
const Pendientes = p(() => import("./modulos/pendientes/Pendientes"));

function Cargando() {
  return <div className="h-full flex items-center justify-center text-tenue"><Loader2 className="h-6 w-6 animate-spin" /></div>;
}

/** La misma regla que la base: si no puedes, ni siquiera se carga la pantalla. */
function Con({ m, n = 1, children }: { m: Modulo; n?: number; children: ReactNode }) {
  const { puede } = useSesion();
  if (!puede(m, n)) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8 text-tenue">
        <Lock className="h-8 w-8 mb-3" />
        <p className="font-medium text-texto">Esta sección no está en tu rol</p>
        <p className="text-sm mt-1">Si la necesitas, pídele a dirección o a sistemas que te den acceso.</p>
      </div>
    );
  }
  return <>{children}</>;
}

export function App() {
  const { cargando, session, perfil, roles, salir } = useSesion();
  if (cargando) return <Cargando />;
  if (!session) return <Entrar />;
  if (!perfil || roles.length === 0) return <SinAcceso correo={session.user.email ?? ""} salir={salir} />;

  // La TV del taller entra directo a su pantalla y no ve nada más.
  if (roles.length === 1 && roles[0] === "pantalla") {
    return <Suspense fallback={<Cargando />}><PantallaPiso /></Suspense>;
  }

  return (
    <Suspense fallback={<Cargando />}>
      <Routes>
        <Route path="/piso" element={<Con m="produccion"><PantallaPiso /></Con>} />
        <Route path="/produccion/terminal" element={<Con m="produccion" n={2}><Terminal /></Con>} />
        <Route path="/ventas/cotizaciones/:id/imprimir" element={<Con m="ventas"><ImprimirCotizacion /></Con>} />
        <Route element={<Shell />}>
          <Route index element={<Inicio />} />
          <Route path="costeo/componentes" element={<Con m="costeo"><Componentes /></Con>} />
          <Route path="costeo/componentes/:id" element={<Con m="costeo"><DetalleArticulo /></Con>} />
          <Route path="costeo/equipos" element={<Con m="costeo"><Equipos /></Con>} />
          <Route path="costeo/equipos/:id" element={<Con m="costeo"><DetalleArticulo /></Con>} />
          <Route path="costeo/margenes" element={<Con m="costos" n={2}><Margenes /></Con>} />
          <Route path="costeo/precios-ventas" element={<Con m="costos"><PreciosVentas /></Con>} />
          <Route path="pendientes" element={<Pendientes />} />
          <Route path="ventas/para-llamar" element={<Con m="ventas"><ParaLlamar /></Con>} />
          <Route path="ventas/oportunidades" element={<Con m="ventas"><Oportunidades /></Con>} />
          <Route path="ventas/cotizaciones" element={<Con m="ventas"><Cotizaciones /></Con>} />
          <Route path="ventas/cotizaciones/:id" element={<Con m="ventas"><EditorCotizacion /></Con>} />
          <Route path="ventas/pedidos" element={<Con m="ventas"><Pedidos /></Con>} />
          <Route path="ventas/pedidos/:id" element={<Con m="ventas"><DetallePedido /></Con>} />
          <Route path="ventas/clientes" element={<Con m="ventas"><Clientes /></Con>} />
          <Route path="ventas/clientes/:id" element={<Con m="ventas"><DetalleCliente /></Con>} />
          <Route path="ventas/comisiones" element={<Con m="ventas"><Comisiones /></Con>} />
          <Route path="compras/precios" element={<Con m="compras" n={2}><Precios /></Con>} />
          <Route path="compras/ordenes" element={<Con m="compras"><OrdenesCompra /></Con>} />
          <Route path="compras/ordenes/:id" element={<Con m="compras"><DetalleOrdenCompra /></Con>} />
          <Route path="compras/proveedores" element={<Con m="compras"><Proveedores /></Con>} />
          <Route path="compras/proveedores/:id" element={<Con m="compras"><DetalleProveedor /></Con>} />
          <Route path="almacen/existencias" element={<Con m="inventario"><Existencias /></Con>} />
          <Route path="almacen/movimientos" element={<Con m="inventario"><Movimientos /></Con>} />
          <Route path="almacen/reabasto" element={<Con m="inventario"><Reabasto /></Con>} />
          <Route path="produccion/gerencia" element={<Con m="produccion"><Gerencia /></Con>} />
          <Route path="produccion/ordenes" element={<Con m="produccion"><OrdenesProduccion /></Con>} />
          <Route path="produccion/ordenes/:id" element={<Con m="produccion"><DetalleOrden /></Con>} />
          <Route path="rrhh/empleados" element={<Con m="rrhh"><Empleados /></Con>} />
          <Route path="rrhh/incidencias" element={<Con m="rrhh"><Incidencias /></Con>} />
          <Route path="rrhh/objetivos" element={<Con m="objetivos"><Objetivos /></Con>} />
          <Route path="rrhh/checklist" element={<Con m="objetivos"><Checklist /></Con>} />
          <Route path="rrhh/prenomina" element={<Con m="nomina"><Prenomina /></Con>} />
          <Route path="rrhh/mi-desempeno" element={<Con m="mi_desempeno"><MiDesempeno /></Con>} />
          <Route path="finanzas/cobranza" element={<Con m="finanzas"><Cobranza /></Con>} />
          <Route path="finanzas/pagos" element={<Con m="finanzas"><Pagos /></Con>} />
          <Route path="sistema/usuarios" element={<Con m="admin" n={3}><Usuarios /></Con>} />
          <Route path="sistema/importar" element={<Con m="admin" n={3}><Importar /></Con>} />
          <Route path="sistema/bitacora" element={<Con m="admin"><Bitacora /></Con>} />
          <Route path="sistema/configuracion" element={<Con m="admin" n={3}><Configuracion /></Con>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

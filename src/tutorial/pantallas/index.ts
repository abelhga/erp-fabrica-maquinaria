import { matchRoutes } from "react-router-dom";
import { GENERAL } from "./general";
import { VENTAS } from "./ventas";
import { COSTEO } from "./costeo";
import { COMPRAS } from "./compras";
import { ANALISIS } from "./analisis";
import { ALMACEN } from "./almacen";
import { IMPORTACIONES } from "./importaciones";
import { PRODUCCION } from "./produccion";
import { SERVICIO } from "./servicio";
import { ADMINISTRACION } from "./administracion";
import { SISTEMA } from "./sistema";

/**
 * Lo que el modo tutorial dice arriba de cada pantalla: para qué sirve y cómo se usa, en párrafos
 * cortos. La llave es la ruta tal como está en `App.tsx` (con `:id` en los detalles), así que
 * `Pagina` la encuentra sola y ninguna pantalla tiene que acordarse de pedirla.
 *
 * Un archivo por sección del menú para que cambiar Ventas no toque lo de Almacén.
 * `tutorial.test.ts` falla si una entrada del menú no tiene su texto.
 */
export type AyudaPantalla = string[];

export const PANTALLAS: Record<string, AyudaPantalla> = {
  ...GENERAL, ...VENTAS, ...COSTEO, ...COMPRAS, ...ANALISIS, ...ALMACEN, ...IMPORTACIONES,
  ...PRODUCCION, ...SERVICIO, ...ADMINISTRACION, ...SISTEMA,
};

export const SECCIONES = {
  GENERAL, VENTAS, COSTEO, COMPRAS, ANALISIS, ALMACEN, IMPORTACIONES, PRODUCCION, SERVICIO, ADMINISTRACION, SISTEMA,
};

const RUTAS = Object.keys(PANTALLAS).map((path) => ({ path }));

/** El texto de la pantalla en esa dirección; con `/ventas/pedidos/123` encuentra `/ventas/pedidos/:id`. */
export function ayudaDe(pathname: string): AyudaPantalla | null {
  // matchRoutes ordena por especificidad: "/ventas/cotizaciones/nueva" gana a ".../:id".
  const m = matchRoutes(RUTAS, pathname);
  return m ? PANTALLAS[m[0].route.path] ?? null : null;
}

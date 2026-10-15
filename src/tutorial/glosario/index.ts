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
 * Glosario del modo tutorial: qué es cada cosa, dicho para alguien que viene de las hojas y no
 * vive dentro del ERP. Una definición por concepto, reutilizada donde aparezca (indicador,
 * cabecera de tabla, pestaña), para que "disponible" signifique lo mismo en Existencias que en
 * el cotizador. Se usa como `explica={GLOSARIO.disponible}` o `data-explain={GLOSARIO.disponible}`.
 *
 * Frases cortas, sin fórmulas salvo que la fórmula sea lo que la gente necesita saber; si un número
 * tiene dirección buena, se dice cuál. Un archivo por sección; `tutorial.test.ts` falla si dos
 * secciones definen la misma llave (la segunda pisaría a la primera sin avisar).
 */
export const GLOSARIO = {
  ...GENERAL, ...VENTAS, ...COSTEO, ...COMPRAS, ...ANALISIS, ...ALMACEN, ...IMPORTACIONES,
  ...PRODUCCION, ...SERVICIO, ...ADMINISTRACION, ...SISTEMA,
};

export const SECCIONES_GLOSARIO = {
  GENERAL, VENTAS, COSTEO, COMPRAS, ANALISIS, ALMACEN, IMPORTACIONES, PRODUCCION, SERVICIO, ADMINISTRACION, SISTEMA,
};

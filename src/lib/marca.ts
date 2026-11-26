// De quién es este ERP, en un solo lugar. En la planta es Hegamex; la versión de
// demostración (y, si se comercializa, la de cada cliente) se construye con otro nombre
// y otro logo sin tocar las pantallas:
//   VITE_EMPRESA=Maquinaria Modelo VITE_LOGO=generico npm run build
// Los documentos (cotización, orden de compra, recibos) usan la razón social de
// Configuración → Empresa; esto es para lo que se dice antes de tener esos datos
// (la pantalla de entrar, el título de la pestaña) o en frases del texto.
export const EMPRESA = (import.meta.env.VITE_EMPRESA as string | undefined)?.trim() || "Hegamex";

/** "generico": engrane y el nombre en letras, para la demostración o un cliente sin logo cargado. */
export const LOGO_GENERICO = import.meta.env.VITE_LOGO === "generico";

/** Para el título de la pestaña: "OC-26-0012 - Hegamex". */
export const conMarca = (texto: string) => `${texto} - ${EMPRESA}`;

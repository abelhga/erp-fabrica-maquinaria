import type { AyudaPantalla } from "./index";

// Equipos, Componentes y Planos los ven también ventas y producción (costeo nivel 1): su texto no
// habla de costos ni de cómo sale el precio. Márgenes y Precios vs ventas son del módulo de márgenes
// (compras tiene costos pero no márgenes: tampoco ahí se explica la utilidad).
export const COSTEO: Record<string, AyudaPantalla> = {
  "/costeo/equipos": [
    "Aquí viven los equipos que fabricamos y sus subensambles: qué lleva cada uno y cuántas horas toma hacerlo. Ingeniería los da de alta y los mantiene; ventas y producción los consultan.",
    "Busca por clave o nombre y dale clic a un renglón para abrir su ficha. Las pestañas separan Equipos, Subensambles y Solicitudes de cambio (las correcciones que manda producción desde una orden). El filtro «Sin lista de materiales» te dice qué falta capturar, y el botón CSV baja la tabla para Excel.",
    "Un subensamble se captura una vez y se comparte: si lo cambias, cambia en todos los equipos que lo usan. Para armar uno, abre un equipo, marca las líneas que siempre van juntas y usa «Convertir en subensamble».",
    "Si cambian una pieza en la maquinaria (se descontinuó, otro proveedor), «Reemplazar componente» la cambia en las listas que elijas con las mismas cantidades; la pieza vieja sigue en el catálogo para venderse como refacción. Lo hace ingeniería.",
    "Lo que ya no se fabrica ni se vende se inhabilita con el interruptor de la columna «Activo» (lo cambia ingeniería o compras): deja de salir en el cotizador y en pedidos nuevos, pero no cambia en los equipos que ya lo usan. Antes de inhabilitar te dice en cuántos equipos activos y pedidos abiertos está. Los inhabilitados se ven en el filtro «Inhabilitados», y ahí mismo se reactivan.",
    "Quien tiene permiso de costos ve además columnas y alertas de costo; al pasar el mouse por ellas se explica cada una.",
  ],
  "/costeo/equipos/:id": [
    "La ficha de un equipo o subensamble: su lista de materiales, sus parámetros, las horas por etapa, dónde se usa y sus planos. Ingeniería la edita; los demás la consultan.",
    "En la lista de materiales escribe la clave o el nombre de un componente y Enter: entra con cantidad 1 y el cursor queda en la cantidad. Enter guarda y baja, Tab avanza, Esc deshace y Alt+↑/↓ mueve la línea; todo se guarda solo. Marca varias líneas para volverlas subensamble o moverlas a un grupo.",
    "Lo de adentro de un subensamble sale en gris y no se edita aquí: se cambia en el propio subensamble, porque el cambio llega a todos los equipos que lo usan.",
    "Si una cantidad depende de una medida (largo, ancho), defínela en la pestaña Parámetros. Para la misma banda con otra medida sin tocar esta, usa «Duplicar con otros parámetros».",
    "En «Fotos» se suben una o varias fotos (o se pega la liga de Drive). La primera es la principal y sale junto a la partida de la cotización; las demás, en la hoja de fotos del PDF. Con las flechas o «Hacerla principal» cambias el orden.",
    "Para cambiar una pieza por otra con la misma cantidad, usa el botón de flechas de su línea. «Editar datos» cambia el nombre, el tipo de equipo y la descripción; las cotizaciones que ya existen conservan el nombre anterior. Junto a la descripción, «Pulir redacción» le pide al asistente que corrija ortografía y estilo: ves la propuesta y decides si la usas.",
    "«Inhabilitar» lo saca del cotizador y de pedidos nuevos cuando ya no se fabrica; arriba sale la marca «Inhabilitado» y el botón cambia a «Reactivar».",
  ],
  "/costeo/componentes": [
    "Todo lo que se compra: componentes, materia prima y servicios, con lo que hay en planta (y su precio de lista, si tu puesto vende). Ingeniería y compras lo dan de alta; los demás lo consultan.",
    "Busca por clave, nombre, categoría o proveedor y dale clic a un renglón para abrir su ficha. Los filtros separan lo importado y lo que tiene existencia; el botón CSV baja la lista para Excel.",
    "La existencia suma los almacenes de planta: lo que está en el Full de Mercado Libre no cuenta aquí.",
    "Quien tiene permiso de costos ve además el costo, su fecha y el proveedor, y los filtros «Sin costo» y «Costo de +6 meses»; los renglones en rojo no tienen costo capturado.",
  ],
  "/costeo/componentes/:id": [
    "La ficha de lo que se compra: datos generales, existencias por almacén, precios por canal en línea, planos y en qué equipos se usa. Lo que ves depende de tu permiso.",
    "Si puedes editar, cada campo se guarda solo al salir de él (o con Enter). La descripción sale en la cotización: una viñeta por renglón. «Pulir redacción» la corrige (ortografía, acentos, estilo) sin tocar medidas ni marcas; ves la propuesta y decides si la usas. Para la foto, pega la liga de Drive o de una imagen, o súbela con «Subir foto». Marcarlo como importado pide 6 meses de cobertura en lugar de 1, y el stock de seguridad se suma al punto de reorden.",
    "Junto a «Dónde se usa», «Reemplazar componente» (ingeniería) la cambia por otra pieza en las listas que elijas, con las mismas cantidades; esta pieza se queda en el catálogo con su precio.",
    "«Canales en línea» compara el precio sugerido de cada canal contra lo que está publicado y avisa si una publicación quedó abajo.",
    "Quien tiene permiso de costos ve aquí el costo con su historial (cada cambio con su origen) y lo puede actualizar; al guardarlo se recalcula todo lo que depende de él.",
  ],
  "/costeo/planos": [
    "El índice de planos: cada uno con su folio y su revisión, para saber cuál es el bueno y con cuál se fabricó cada orden. El archivo sigue en Drive; aquí solo se lleva el control.",
    "Elige Vigentes, Por aprobar o Anteriores (las dos últimas las ve ingeniería) y busca por folio, equipo o título. La revisión en verde es la vigente y en amarillo la que está por aprobar; «Drive» abre el archivo y el nombre del equipo abre su ficha.",
    "Para ligar un plano, entra al equipo (Equipos y subensambles), pestaña Planos, y liga el archivo de Drive: el ERP le da folio y revisión. Si hay equipos en producción sin plano vigente, ingeniería los ve arriba en un aviso.",
  ],
  "/costeo/margenes": [
    "El panel de utilidad, antes la pestaña Reglas de Nuevo Costeo: de aquí sale el precio de lista de todo el catálogo. Lo consultan finanzas y la gerencia administrativa; solo dirección lo cambia.",
    "Cada tarjeta es una política de precio: utilidad, recargos sobre costo y sobre precio, medida especial, redondeo y descuento máximo. «Editar» abre el simulador: antes de guardar ves cuántos precios se mueven y cuáles más. Cada cambio queda en la bitácora con quién y cuándo.",
    "El precio de un equipo es: costo × (1 + recargos sobre costo + medida especial) ÷ (1 − utilidad ÷ (1 − ISR) − recargos sobre precio), redondeado hacia arriba. Lo que se revende usa el margen sobre precio de su política, sin compensar ISR: costo ÷ (1 − margen).",
    "El ISR de compensación, la mano de obra por etapa y el tipo de cambio también mueven precios: al cambiarlos se recalcula todo lo que depende de ellos. El tipo de cambio lo capturan compras (en Actualizar precios) o finanzas: escribe el valor y Enter.",
  ],
  "/costeo/precios-ventas": [
    "Para ver si los cambios de costo y de precio de una familia de equipos se notaron en lo que se vende: el costo y el precio de lista mes a mes, junto a lo vendido de esa familia. Lo ve quien tiene permiso de márgenes.",
    "Arriba eliges la familia y desde qué año. La primera gráfica es un índice (100 al inicio del periodo) y la segunda son pesos; van separadas a propósito, porque mezclar índice y pesos en un mismo eje engaña.",
    "El precio de lista se registra desde el arranque del ERP (la hoja no guardaba la utilidad aplicada), por eso su línea empieza después. Las ventas de antes del arranque salen del libro de la hoja (ventas desde $40,000, clasificadas por su descripción); después, de los pedidos.",
    "La relación costo ↔ ventas se mide por trimestre, porque con pocas ventas al mes el mes a mes es puro ruido. Es orientativa: no prueba que una cosa cause la otra.",
  ],
};

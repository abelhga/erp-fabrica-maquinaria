import type { AyudaPantalla } from "./index";

// Equipos, Componentes y Planos los ven también producción y almacén (costeo nivel 1): su texto no
// habla de cómo sale el precio ni de utilidad, aunque mencione que quien tiene costos ve más columnas.
// Márgenes y Precios vs ventas son del módulo de márgenes (compras e ingeniería tienen costos pero no
// márgenes: fuera de esas dos pantallas no se explica la utilidad). Los botones, columnas y pestañas se
// explican en sus globos (glosario de costeo); aquí queda para qué sirve cada pantalla, lo mínimo para
// usarla y, en «detalle», el resto de las reglas, porque el asistente lee esto como su manual.
export const COSTEO: Record<string, AyudaPantalla> = {
  "/costeo/equipos": {
    resumen: "Los equipos que fabricamos y sus subensambles, con lo que lleva cada uno y sus horas: ingeniería los mantiene; producción y almacén los consultan.",
    pasos: [
      "Elige la pestaña Equipos o Subensambles y busca por clave o nombre.",
      "Dale clic a un renglón para abrir su ficha.",
      "Con el filtro «Sin lista de materiales» ves qué falta capturar.",
    ],
    detalle: [
      "El botón CSV baja la tabla para Excel. En Equipos también puedes filtrar por tipo de equipo.",
      "«Solicitudes de cambio» junta las correcciones a la lista de materiales que mandan producción o almacén desde una orden. Cada una también te llega a Pendientes y se cierra sola al aplicarla o descartarla.",
      "Un subensamble se captura una vez y se comparte: si lo cambias, cambia en todos los equipos que lo usan. Para armar uno, abre un equipo, marca las líneas que siempre van juntas y usa «Convertir en subensamble».",
      "Si cambian una pieza en la maquinaria (se descontinuó, otro proveedor), «Reemplazar componente» la cambia en las listas que elijas con las mismas cantidades. La pieza vieja sigue en el catálogo para venderse como refacción. Lo hace ingeniería.",
      "Lo que ya no se fabrica ni se vende se inhabilita con el interruptor de la columna «Activo» (lo cambian ingeniería o compras). Deja de salir en el cotizador y en pedidos nuevos, pero no cambia en los equipos que ya lo usan.",
      "Antes de inhabilitar te dice en cuántos equipos activos y pedidos abiertos está. Los inhabilitados se ven en el filtro «Inhabilitados», y ahí mismo se reactivan.",
      "Quien tiene permiso de costos ve además columnas y alertas de costo, y el filtro «Con piezas sin costo»; al pasar el mouse por cada una se explica.",
    ],
  },
  "/costeo/equipos/:id": {
    resumen: "La ficha de un equipo o subensamble, con su lista de materiales, parámetros, horas por etapa, fotos y planos: ingeniería la edita y los demás la consultan.",
    pasos: [
      "En «Lista de materiales», escribe la clave o el nombre de una pieza y da Enter.",
      "Escribe la cantidad: Enter guarda y baja, Tab avanza; todo se guarda solo.",
      "Para piezas que siempre van juntas, márcalas y usa «Convertir en subensamble».",
    ],
    detalle: [
      "Cada pieza entra con cantidad 1 y el cursor queda en la cantidad. Esc deshace y Alt+↑/↓ mueve la línea. Marca varias líneas para volverlas subensamble o moverlas a un grupo.",
      "Lo de adentro de un subensamble sale en gris y no se edita aquí: se cambia en el propio subensamble, porque el cambio llega a todos los equipos que lo usan.",
      "Si una cantidad depende de una medida (largo, ancho), defínela en la pestaña Parámetros. Para la misma banda con otra medida sin tocar ésta, usa «Duplicar con otros parámetros».",
      "En «Fotos» se suben una o varias fotos (o se pega la liga de Drive). La primera es la principal y sale junto a la partida de la cotización; las demás, en la hoja de fotos del PDF. Con las flechas o «Hacerla principal» cambias el orden.",
      "Para cambiar una pieza por otra con la misma cantidad, usa el botón de flechas de su línea. La pestaña «Dónde se usa» dice en qué listas está un subensamble.",
      "«Editar datos» cambia el nombre, el tipo de equipo y la descripción, que sale arriba en «Descripción»: qué es, para qué sirve y lo que conviene saber al armarlo. Las cotizaciones que ya existen conservan el nombre anterior.",
      "Ahí mismo, junto a la descripción, «Pulir redacción» le pide a la IA que corrija ortografía y estilo: ves la propuesta y decides si la usas.",
      "«Inhabilitar» lo saca del cotizador y de pedidos nuevos cuando ya no se fabrica; arriba sale la marca «Inhabilitado» y el botón cambia a «Reactivar».",
      "Quien tiene permiso de costos ve además la pestaña de costo y la de Historial; cada cifra se explica al pasar el mouse.",
    ],
  },
  "/costeo/componentes": {
    resumen: "Todo lo que se compra (componentes, materia prima y servicios) con lo que hay en planta y, si tu puesto vende, su precio de lista.",
    pasos: [
      "Busca por clave, nombre, categoría o proveedor.",
      "Dale clic a un renglón para abrir su ficha.",
      "Usa los filtros para ver solo lo importado o lo que tiene existencia.",
    ],
    detalle: [
      "Ingeniería y compras lo dan de alta con «Nuevo componente»; los demás lo consultan. El botón CSV baja la lista para Excel.",
      "La existencia suma los almacenes de planta: lo que está en el Full de Mercado Libre no cuenta aquí.",
      "Quien tiene permiso de costos ve además el costo, su fecha y el proveedor, y los filtros «Sin costo» y «Costo de +6 meses»; los renglones en rojo no tienen costo capturado.",
    ],
  },
  "/costeo/componentes/:id": {
    resumen: "La ficha de lo que se compra: sus datos, existencias por almacén, precios por canal, planos y dónde se usa; lo que ves depende de tu permiso.",
    pasos: [
      "Si puedes editar, cambia el campo y sal de él (o da Enter): se guarda solo.",
      "Escribe la descripción con una viñeta por renglón: es la que sale en la cotización.",
      "Para la foto, pega la liga de Drive o de una imagen, o usa «Subir foto».",
    ],
    detalle: [
      "«Pulir redacción» corrige la descripción (ortografía, acentos, estilo) sin tocar medidas ni marcas; ves la propuesta y decides si la usas.",
      "Marcarlo como importado pide 6 meses de cobertura en lugar de 1, y el stock de seguridad se suma al punto de reorden.",
      "Junto a «Dónde se usa», «Reemplazar componente» (ingeniería) la cambia por otra pieza en las listas que elijas, con las mismas cantidades; esta pieza se queda en el catálogo con su precio.",
      "«Canales en línea» (si ves precios de venta) compara el precio sugerido de cada canal contra lo que está publicado y avisa si una publicación quedó abajo.",
      "«Empaque para envío» guarda el peso y las medidas del paquete: lo capturan almacén o ingeniería y con eso se prellena cada envío.",
      "Quien tiene permiso de costos ve aquí el costo con su historial (cada cambio con su origen) y lo puede actualizar; al guardarlo se recalcula todo lo que depende de él.",
    ],
  },
  "/costeo/planos": {
    resumen: "El índice de planos, cada uno con su folio y su revisión, para saber cuál es el bueno y con cuál se fabricó cada orden.",
    pasos: [
      "Elige Vigentes, Por aprobar o Anteriores y busca por folio, equipo o título.",
      "Dale «Drive» para abrir el archivo, o el nombre del equipo para abrir su ficha.",
    ],
    detalle: [
      "El archivo sigue en Drive; aquí solo se lleva el control. «Por aprobar» y «Anteriores» las ven ingeniería, compras y dirección; los demás ven solo los vigentes.",
      "La revisión en verde es la vigente y en amarillo la que está por aprobar.",
      "Para ligar un plano, entra al equipo (Equipos y subensambles), pestaña Planos, y usa «Ligar plano de Drive»: el ERP le da folio y revisión.",
      "Si hay equipos en producción sin plano vigente, ingeniería los ve arriba en un aviso.",
    ],
  },
  "/costeo/margenes": {
    resumen: "El panel de utilidad, antes la pestaña Reglas de Nuevo Costeo: de aquí sale el precio de lista de todo el catálogo, y solo dirección lo cambia.",
    pasos: [
      "Si eres de dirección, dale «Editar» en la tarjeta de una política: se abre el simulador.",
      "Cambia la utilidad o un recargo y revisa en «Qué pasaría» cuántos precios se mueven.",
      "Si te convence, dale «Guardar y mover…»: el cambio queda en la bitácora.",
    ],
    detalle: [
      "Lo consultan finanzas y la gerencia administrativa. Cada tarjeta es una política de precio: utilidad, recargos sobre costo y sobre precio, medida especial, redondeo y descuento máximo.",
      "Antes de guardar ves cuántos precios se mueven y cuáles más. Cada cambio queda en la bitácora con quién y cuándo.",
      "El precio de un equipo es: costo × (1 + recargos sobre costo + medida especial) ÷ (1 − utilidad ÷ (1 − ISR) − recargos sobre precio), redondeado hacia arriba.",
      "Lo que se revende usa el margen sobre precio de su política, sin compensar ISR: costo ÷ (1 − margen).",
      "El ISR de compensación, la mano de obra por etapa y el tipo de cambio también mueven precios: al cambiarlos se recalcula todo lo que depende de ellos.",
      "El tipo de cambio lo capturan compras (en Actualizar precios) o finanzas: escribe el valor y Enter.",
    ],
  },
  "/costeo/precios-ventas": {
    resumen: "Para ver si los cambios de costo y de precio de una familia de equipos se notaron en lo vendido; lo ve quien tiene permiso de márgenes.",
    pasos: [
      "Arriba elige la familia y desde qué año.",
      "Compara el índice de costo y de precio con las ventas de la familia.",
    ],
    detalle: [
      "Muestra el costo y el precio de lista mes a mes, junto a lo vendido de esa familia.",
      "La primera gráfica es un índice (100 al inicio del periodo) y la segunda son pesos; van separadas a propósito, porque mezclar índice y pesos en un mismo eje engaña.",
      "El precio de lista se registra desde el arranque del ERP (la hoja no guardaba la utilidad aplicada), por eso su línea empieza después.",
      "Las ventas de antes del arranque salen del libro de la hoja (ventas desde $40,000, clasificadas por su descripción); después, de los pedidos.",
      "La relación costo ↔ ventas se mide por trimestre, porque con pocas ventas al mes el mes a mes es puro ruido. Es orientativa: no prueba que una cosa cause la otra.",
    ],
  },
};

import type { AyudaPantalla } from "./index";

// Compras sí ve costos de compra, así que aquí se puede hablar de ellos; lo que no va es cómo se
// arma el precio de venta. Los botones y columnas se explican en sus globos (glosario de compras):
// aquí solo queda para qué sirve la pantalla, lo mínimo para usarla y, en «detalle», el resto de
// las reglas, porque el asistente lee esto como su manual.
export const COMPRAS: Record<string, AyudaPantalla> = {
  "/compras/solicitudes": {
    resumen: "La cola de precios que piden los vendedores desde sus cotizaciones: qué sigue abierto, quién lo tiene y qué ya venció.",
    pasos: [
      "Atiende de arriba hacia abajo: lo vencido va primero y en rojo.",
      "Dale «Tomar» para que el vendedor sepa que ya la tienes tú.",
      "En «Contestar», elige el artículo, escribe proveedor, costo y días de entrega, y Enter.",
    ],
    detalle: [
      "Antes se pedía por el chat («¿me ayudas a cotizar esta polea?») y no se sabía qué seguía abierto. Aquí la lista va ordenada por vencimiento, con lo vencido arriba y en rojo.",
      "«Contestar» (o clic en el renglón) abre el panel de la derecha: elige el artículo del catálogo o dalo de alta ahí mismo, escribe proveedor, costo y días de entrega, y Enter contesta. «Contestar» solo aparece si tu puesto también captura costos.",
      "Si no se consigue, usa «No se consigue…» y escribe el motivo: el vendedor se lo explica al cliente.",
      "La «Nota para quien lo pidió» la lee el vendedor: nada de costos ahí.",
      "Los cuadros de arriba filtran la lista con un clic. El tiempo de respuesta se cuenta en horas hábiles de la planta y se compara contra lo que se tardaba en el chat.",
    ],
  },
  "/compras/precios": {
    resumen: "Aquí pones al día el costo de lo que se compra cuando un proveedor cambia sus precios; reemplaza la hoja ACTUALIZACIONES.",
    pasos: [
      "Filtra «Más de 6 meses» o «Sin costo», o elige un proveedor para pasar su lista.",
      "Escribe el costo nuevo en su fila y Enter: se guarda y bajas a la siguiente.",
      "Si te moviste con las flechas sin guardar, al terminar dale «Guardar cambios».",
    ],
    detalle: [
      "Con ↑ ↓ te mueves sin guardar: lo escrito queda en amarillo hasta «Guardar cambios», y «Descartar» lo borra. Esc deshace la fila. Solo captura quien tiene permiso de costos; los demás solo ven.",
      "La columna Cambio compara en pesos, con los dólares al tipo de cambio de hoy. Un triángulo avisa que el cambio pasa de 50 %: casi siempre es por unidad o moneda equivocada.",
      "Al guardar te dice a cuántos equipos les cambia el precio. A la derecha quedan los últimos cambios, con quién y cuándo.",
      "En la tarjeta «Tipo de cambio» está el que se usa para costear lo importado: si el del día no te sirve, captúralo ahí y Enter.",
    ],
  },
  "/compras/ordenes": {
    resumen: "Todas las órdenes de compra, de la requisición al proveedor y del proveedor al almacén: compras las arma y envía, almacén recibe y finanzas registra pagos.",
    pasos: [
      "Usa los cuadros de arriba o los filtros para cambiar la vista; de entrada ves las abiertas.",
      "Dale clic a un renglón para abrir la orden.",
      "En la pestaña Requisiciones, marca partidas y dale «Crear órdenes de compra».",
    ],
    detalle: [
      "Las abiertas son los borradores, las enviadas y las recibidas en parte. Las atrasadas van en rojo, y la barra de Recibido dice qué parte de lo pedido ya llegó.",
      "La pestaña Requisiciones tiene lo que producción y almacén le piden a compras. «Crear órdenes de compra» arma una orden en borrador por cada proveedor de las partidas marcadas.",
      "Los importes y lo que falta por pagar solo los ve quien tiene costos o finanzas.",
    ],
  },
  "/compras/ordenes/nueva": {
    resumen: "Para armar una orden de compra nueva, empezando por el proveedor: de él salen la moneda, el crédito y los días de entrega.",
    pasos: [
      "Si tienes la cotización del proveedor en PDF o foto, dale «Subir cotización».",
      "Revisa lo que leyó la IA y dale «Crear orden en borrador».",
      "Sin cotización, elige al proveedor y dale «Crear orden en borrador»; las partidas van después.",
    ],
    detalle: [
      "La IA lee las partidas de la cotización y las empareja con el catálogo; tú revisas todo antes de crear la orden. Nada se guarda hasta entonces.",
      "Sin cotización, la orden se crea vacía, en borrador y con la moneda y las condiciones de pago del proveedor. Si llegas desde la ficha de un proveedor, ya viene elegido.",
      "Las órdenes solo las crea compras.",
    ],
  },
  "/compras/ordenes/:id": {
    resumen: "Una orden de compra completa: sus partidas, los datos para el proveedor, lo que ya llegó al almacén y, para quien ve dinero, sus pagos.",
    pasos: [
      "En borrador, busca artículos abajo de las partidas y Enter; corrige cantidad y costo en su lugar.",
      "Dale «Enviar al proveedor» y luego imprímela o mándala «Por correo».",
      "Cuando llegue la mercancía, almacén da «Recibir» y captura lo que de verdad llegó.",
    ],
    detalle: [
      "El costo sugerido de cada partida es el vigente del artículo; debajo ves si el del proveedor sale más caro o más barato. «Enviar al proveedor» fija las partidas, y no se envía con partidas en $0.",
      "«Por correo» la manda desde tu propio Gmail con el PDF de la orden adjunto (el mismo que sale al imprimir), al correo del proveedor que está en su ficha; puedes cambiar a quién, el asunto y el mensaje. La primera vez te pide conectar tu Gmail.",
      "Si estaba en borrador, al mandarla por correo queda enviada, con las mismas reglas que «Enviar al proveedor». Imprimir y «Por correo» solo salen a quien ve importes (costos o finanzas).",
      "En «Recibir», lo que falte queda pendiente. Si todavía no se recibe nada, compras la puede cancelar y sus requisiciones vuelven a pendientes.",
      "Si después de enviarla se acuerda con el proveedor otro artículo, otra cantidad u otro precio, compras da el lápiz de esa partida, la corrige y escribe por qué. Una partida de la que ya llegó algo no se cambia.",
      "El folio se queda (el proveedor ya lo tiene) y la orden sube de revisión: «Rev. 2» en el título y en lo impreso, para mandársela otra vez. Abajo de las partidas queda cada cambio con su antes y después, quién lo hizo y por qué.",
      "Las partidas escritas a mano dicen «Sin artículo del catálogo» y también se reciben. Si son material, en «Recibir» busca su artículo para que entren al almacén y cuenten como material. Si son un cobro, como «Manejo» o un flete, recíbelas tal cual: cuentan como recibidas y no tocan el inventario.",
      "Cuando finanzas registra la factura del proveedor y la liga a la orden, en «Factura del proveedor» dice «Registrada en finanzas» y los pagos ya se llevan en esa factura, no en la orden. Si el folio que anotó almacén al recibir es el de la factura, se ligan solas.",
      "Si no pones fecha de entrega, se calcula al enviar con los días hábiles del proveedor; si pasa sin que llegue todo, la orden sale atrasada. El vencimiento del pago se fija al recibir, con los días de crédito del proveedor.",
    ],
  },
  "/compras/proveedores": {
    resumen: "El directorio de proveedores: a quién se le compra, en qué moneda, con cuánto crédito y en cuántos días entrega.",
    pasos: [
      "Busca por nombre o usa los filtros; «Todo el directorio» los muestra todos.",
      "Dale clic a un renglón para abrir su ficha.",
      "Para dar de alta uno, usa «Nuevo proveedor».",
    ],
    detalle: [
      "«Nuevo proveedor» lo da de alta compras, o finanzas con sus datos fiscales. Si lo da de alta finanzas y ya existe uno con ese RFC, le pone al día los datos en lugar de duplicarlo.",
      "De entrada ves solo los que surten algún artículo o tienen órdenes abiertas (y, si ves importes, a los que se les compró en 12 meses), porque el directorio de las hojas mezclaba acreedores (nómina, casetas, hoteles). CSV baja la lista para Excel.",
      "«OC abiertas» cuenta las órdenes enviadas o recibidas en parte que todavía esperan mercancía, con las atrasadas en rojo. Lo comprado en 12 meses solo lo ve quien tiene costos o finanzas.",
    ],
  },
  "/compras/proveedores/:id": {
    resumen: "La ficha de un proveedor: sus datos, lo que nos surte, sus órdenes de compra y cómo se han movido sus precios.",
    pasos: [
      "Dale «Nueva orden» para armar una orden ya con este proveedor elegido.",
      "Usa «Editar» para poner al día sus datos; puedes llenarlos subiendo su constancia fiscal.",
      "Dale clic a una orden de la derecha para abrirla.",
    ],
    detalle: [
      "Compras edita todo; finanzas y la gerencia administrativa ponen al día lo fiscal, lo bancario, el crédito y el contacto, y pueden llenarlo subiendo su constancia de situación fiscal. Si cambian los datos bancarios, dirección recibe un aviso.",
      "Un artículo con la nota «su costo vigente es de otro proveedor» también se le compra a otro, y el costo de hoy viene de aquel.",
      "Finanzas ve además «Le debemos»: el saldo del proveedor y lo vencido. Dale clic para abrir su cuenta con sus facturas, todos sus movimientos y el botón para registrar un pago.",
      "Con permiso de costos ves el índice de precios del proveedor (100 en el primer mes con datos) y el cambio de sus precios en el último año; los costos en amarillo tienen más de 6 meses.",
    ],
  },
};

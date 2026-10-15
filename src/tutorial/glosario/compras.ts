// Compras. Aquí sí hay costos de compra (compras tiene permiso de costos), pero nada de cómo se
// arma el precio de venta: eso vive en el glosario de costeo.
export const COMPRAS = {
  // --- Solicitudes de precio (la cola que manda ventas) ---
  semaforoSolicitud: "Verde: a tiempo. Amarillo: vence en menos de una hora hábil. Rojo: ya venció y el vendedor sigue esperando. Las vencidas van arriba de la lista.",
  plazoSolicitud: "Cuánto tiempo tiene compras para contestar: normalmente un día hábil (10 horas hábiles), o 4 si el vendedor la marcó urgente porque el cliente está esperando. Solo corre en horario de la planta: una solicitud del domingo empieza a contar el lunes.",
  tomarSolicitud: "«Tomar» le avisa al vendedor que ya la tienes tú y que estás cotizando. No contesta nada todavía; evita que dos compradores busquen el mismo precio.",
  estadoSolicitud: "Sin tomar: nadie la ha agarrado. Cotizando: alguien de compras la tomó. Con precio: ya se contestó y el vendedor ve el precio de lista. No se consigue: se le explicó por qué. Cancelada: el vendedor ya no la necesita.",
  contestarSolicitud: "Contestar es capturar el costo que dio el proveedor: entra al catálogo con su historial, el precio de lista se recalcula solo y el vendedor lo ve en su cotización. La nota para el vendedor nunca lleva costos.",
  tiempoRespuestaPrecio: "Mediana de horas hábiles desde que el vendedor pidió el precio hasta que compras lo contestó, este mes, contra lo que se tardaba cuando se pedía por el chat. Las que siguen abiertas y ya pasaron de un día cuentan como tardadas.",

  // --- Actualizar precios ---
  costoVigente: "El costo con el que se calcula hoy: el último que se capturó, a mano, al contestar una solicitud de precio o al recibir una orden de compra.",
  cambioCosto: "Cuánto sube o baja el costo nuevo contra el actual, comparado en pesos. Rojo: sube más de 10 %. Amarillo: sube. Verde: baja. Con un triángulo, el cambio pasa de 50 %: revisa que la unidad y la moneda sean las mismas.",
  usadoEnEquipos: "En cuántos equipos y subensambles va directamente este artículo. Al guardar su costo, el precio de todos ellos se recalcula en ese momento.",
  origenCosto: "De dónde salió el cambio: a mano (aquí o en la ficha), por orden de compra (al recibirla), por cotización (al contestar una solicitud de precio) o importado de la hoja.",

  // --- Órdenes de compra ---
  estadoOrdenCompra: "Borrador: todavía se edita y el proveedor no la tiene. Enviada: ya se mandó y lo pedido cuenta como en camino. Recibida en parte: llegó algo y falta lo demás. Recibida: llegó todo. Cancelada: lo que venía de requisiciones regresa a pendiente.",
  ordenAtrasada: "Una orden enviada o recibida en parte cuya fecha de entrega ya pasó. Llámale al proveedor o mueve la fecha si ya te dio otra.",
  avanceRecibido: "Qué parte de lo pedido ya llegó al almacén, sumando todas las partidas.",
  porPagarOrden: "Total de la orden menos los pagos que ha registrado finanzas.",
  requisicionCompra: "Lo que producción y almacén le piden a compras: los faltantes de las órdenes de producción y lo que almacén pide desde el reabasto. Elige partidas y se vuelven órdenes en borrador, una por proveedor; el mismo artículo pedido varias veces se suma.",
  origenRequisicion: "Quién la pidió: Producción (faltante de una orden de producción), Reabasto (almacén, por stock mínimo) o Manual. La fecha en rojo es para menos de una semana.",
  fechaEntregaOrden: "Si no la capturas, al enviar la orden se calcula con los días hábiles de entrega del proveedor (7 si no tiene). Pasada esa fecha, la orden sale como atrasada.",
  costoContraVigente: "Cuánto difiere el costo de esta partida del costo vigente del artículo. Rojo: más de 10 % arriba; amarillo: arriba; verde: abajo.",
  recibirOrden: "Almacén captura lo que de verdad llegó, a qué almacén y con qué factura; lo que falte se queda pendiente. No deja recibir más de 10 % arriba de lo pendiente. Con la casilla marcada, el costo de la orden pasa a ser el costo vigente del artículo.",
  leerCotizacionProveedor: "Sube el PDF o la foto de la cotización del proveedor y Claude lee proveedor, partidas, cantidades y precios y los empareja con el catálogo. Tú lo revisas: nada se guarda hasta crear la orden.",

  // --- Proveedores ---
  creditoProveedor: "Días que da el proveedor para pagar. El vencimiento de cada orden se fija al recibirla: fecha de recepción más estos días. Sin crédito, es de contado.",
  entregaProveedor: "Días hábiles que tarda en entregar desde que se le manda la orden. Sin dato se usa 7. De aquí sale la fecha de entrega de sus órdenes.",
  ordenesAbiertasProveedor: "Órdenes enviadas o recibidas en parte que todavía esperan mercancía. «Tarde» cuenta las que ya pasaron su fecha de entrega.",
  compradoDoceMeses: "Suma de sus órdenes de compra de los últimos 12 meses (sin canceladas), en pesos y con IVA.",
  indicePreciosProveedor: "Cómo se han movido sus precios, con 100 en el primer mes con datos. Cada mes promedia cuánto cambió el costo de cada artículo que nos vende (los que no cambiaron cuentan como 0 %): 110 quiere decir 10 % más caro.",
  directorioProveedores: "El directorio que vino de las hojas mezcla proveedores con acreedores (nómina, casetas, hoteles). Por eso de entrada solo se ven los que surten algún artículo o tienen órdenes abiertas.",
} satisfies Record<string, string>;

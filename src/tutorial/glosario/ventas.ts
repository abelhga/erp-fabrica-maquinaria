export const VENTAS = {
  // --- Leads ---
  lead: "Alguien que llamó o escribió interesado y todavía no es oportunidad: quién es, cómo contactarlo y qué busca. Lo registra recepción (o cualquier vendedor) y se vuelve oportunidad cuando un vendedor lo atiende.",
  modoLeads: "A quién le llega un lead nuevo. Hay tres formas, se escoge en Configuración: bandeja (se avisa a los vendedores y el primero que lo toma se lo queda), la gerencia de ventas lo asigna, o quien lo registra escoge al vendedor. En las tres, si ya es cliente y tiene vendedor vigente, le llega directo a su vendedor.",
  estadoLead: "Por tomar (o por asignar): nadie lo tiene todavía. Con…: ya tiene vendedor y está pendiente de que lo atienda. Oportunidad: el vendedor ya lo volvió oportunidad; junto sale en qué etapa va (cotizado, ganada, perdida…). Descartado: no se siguió, con su motivo. Si nadie lo toma o nadie lo atiende a tiempo, se avisa a la gerencia.",
  yaEsCliente: "Mientras escribes el teléfono, la empresa o el nombre, se busca entre los clientes. Solo dice el nombre, la ciudad y de qué vendedor es; nada de ventas ni saldos. Si escoges «Es este» y tiene vendedor vigente, el lead le llega directo a él.",
  convertirLead: "Atenderlo es volverlo oportunidad: si ya era cliente va a su cuenta; si no, eliges la empresa si ya existe o se da de alta como cliente nuevo con este contacto. La oportunidad nace en Prospecto, a tu nombre, y quien registró el lead ve en qué etapa va.",
  // --- Oportunidades ---
  embudo: "Las oportunidades abiertas por etapa: prospecto → contactado → cotizado → negociación. Al enviar una cotización, su oportunidad pasa sola a “cotizado” (y si no había, se abre); al convertirla en pedido, a “ganada”.",
  etapaOportunidad: "En qué va la venta: Prospecto (apenas lo conoces), Contactado, Cotizado, Negociación, Ganada o Perdida. La cambias arrastrando la tarjeta en el tablero o desde el detalle.",
  diasEnEtapa: "Días que lleva la oportunidad en su etapa actual; vuelve a cero cuando cambia de etapa. En el tablero, más de 14 días se pinta en ámbar: está atorada.",
  proximaTarea: "La tarea con fecha más cercana de esa oportunidad (una llamada, una visita…). En rojo si ya venció.",
  montoEstimado: "Lo que crees que vale la venta, sin IVA. Si la oportunidad la abre una cotización enviada, toma el total sin IVA de esa cotización.",
  motivoPerdida: "Por qué se perdió (precio, tiempo de entrega, seguimiento…). Es obligatorio: sin eso no se sabe qué corregir.",

  // --- Cotizaciones ---
  estadoCotizacion: "Borrador (se está capturando) → Por autorizar (tiene precios abajo del mínimo) → Autorizada (la gerencia ya los aprobó) → Enviada (ya la tiene el cliente) → Aceptada (se convirtió en pedido). También puede quedar Rechazada (con motivo), Vencida o Cancelada.",
  cotizacionAbierta: "Una cotización que sigue viva: en borrador, por autorizar, autorizada o enviada.",
  vigenciaCotizacion: "Días que vale la cotización desde su emisión. Si pasa la fecha “Vence” sin cerrarse, se marca Vencida en rojo.",
  nuevaVersion: "Copia la cotización con el mismo folio y “-v2”, “-v3”… para seguir la misma negociación sin tocar lo que ya se mandó. “Duplicar” en cambio le da un folio nuevo.",
  precioLista: "El precio oficial del catálogo, en pesos y sin IVA. Al agregar una partida se llena solo y se convierte a la moneda de la cotización (y con IVA si la cotizas con IVA incluido).",
  precioMinimo: "Lo más bajo a lo que puedes dejar una pieza del catálogo sin pedir permiso: el precio de lista menos el descuento máximo autorizado para ese artículo. Se compara con el precio ya con todos los descuentos, en pesos y sin IVA.",
  bajoMinimo: "La partida quedó abajo del precio mínimo (o en $0). La cotización pasa a “Por autorizar” y no se puede enviar ni convertir en pedido hasta que la gerencia de ventas la autorice.",
  autorizacionPrecios: "Cuando hay partidas abajo del mínimo, terminas de capturar y das “Pedir autorización” (con una nota del porqué, si quieres). La gerencia de ventas la ve en su cola y autoriza. Si después cambias las partidas, el descuento, la moneda o el IVA, la autorización se pierde y hay que pedirla otra vez.",
  descuentoVsLista: "Cuánto abajo del precio de lista va lo cotizado del catálogo, sumando todos los descuentos (en pesos y sin IVA).",
  descuentoGeneral: "Porcentaje que se descuenta del subtotal de todas las partidas, además del descuento de cada una. Cuenta para el precio mínimo.",
  ivaIncluido: "Marcado, los precios de las partidas ya traen IVA y el total es su suma; sin marcar, el IVA se agrega al final. Cambiarlo convierte los precios y el total no se mueve.",
  mesesConTarjeta: "Plan de meses para pagar con tarjeta. La mensualidad ya incluye la comisión del plan: total ÷ (1 − tasa del plan) ÷ meses. Sale en la cotización y en el mensaje de WhatsApp.",
  partidaOpcional: "Partida que sale en la cotización como opción o alternativa, pero no suma al total ni cuenta para el precio mínimo.",
  partidaLibre: "Renglón escrito a mano que no viene del catálogo (flete, instalación, servicio). No tiene precio de lista ni precio mínimo.",
  fichaVenta: "Lo que veías en el BUSCADOR de la hoja: precio de lista y mínimo, existencia en planta (y cuánto está apartado), piezas en Full de Mercado Libre, tiempo de entrega, envío gratis y precio sugerido en Mercado Libre.",
  envioGratis: "Si la pieza alcanza el monto de envío gratis (con IVA) que fija la gerencia. Cuando no lo alcanza sola, dice desde cuántas piezas aplica. Algunos productos, como bandas y cangilones, nunca llevan envío gratis.",

  // --- Pedidos ---
  estadoPedido: "Confirmado → En producción → Listo para entregar → Entregado. Cancelado lleva su motivo y deja de contar para comisiones y cobranza.",
  pedidoAtrasado: "La fecha compromiso ya pasó y el pedido todavía no se entrega.",
  entregaRealista: "Cuándo sale de verdad lo que vas a vender: lo que tarda el equipo, o lo que tarda el taller en acabar todo lo que ya tiene antes que este pedido, lo que sea más tarde. Cambia todos los días con lo que entra y sale del taller. Si prometes menos, el pedido nace atrasado.",
  fechaCompromisoPedido: "El día que se le prometió la entrega al cliente. Con ella se marca el pedido como atrasado y sale en la agenda de la semana.",
  saldoPorCobrar: "Lo que falta por cobrar: lo de sus pedidos (total con IVA menos los cobros registrados) más lo que ya debía en la hoja al arrancar el ERP. Los pedidos cancelados y los que vienen de la hoja no suman aparte: lo de la hoja ya va en su saldo. Los cobros los registra finanzas.",
  avancePedido: "Qué tanto lleva producción con este pedido: el promedio de sus órdenes de taller, donde cada orden avanza según las horas de trabajo ya terminadas. Una orden terminada cuenta 100 %.",
  canalVenta: "Por dónde entró la venta: Directo (vendedores), Mercado Libre, Sitio web, Mostrador, Distribuidor o Amazon.",
  numeroVentaExterno: "El número de venta de Mercado Libre (o del sitio web). No se puede repetir dentro del mismo canal, así nadie captura dos veces la misma venta.",
  pedidoHistorico: "Pedido que viene de las hojas. Cuenta para el historial y para las comisiones de su mes, pero no es una cuenta por cobrar del ERP: lo que el cliente debe está en su saldo de arranque. Si sigue en el taller, su avance y su entrega se llevan aquí como cualquier otro.",
  lineaVenta: "Maquinaria, Refacciones u Otros (fletes, servicios, instalaciones). La pone el catálogo en cada partida y de ella depende cómo cuenta para la comisión; solo la gerencia la puede cambiar.",
  creditoCompartido: "Cuando varios vendedores cierran una venta, la gerencia reparte el crédito en porcentajes que suman 100 %. A cada uno le cuenta para su comisión y sus metas solo su parte del pedido.",

  // --- Comisiones ---
  comision: "El porcentaje de tu plan sobre lo que vendiste en el mes de todo lo que no es refacción (maquinaria y, si el plan lo dice, “otros”), sin IVA. Más un bono por escalón de maquinaria, otro por escalón de refacciones y los ajustes.",
  bonoMeta: "Bono fijo cuando la venta del mes de maquinaria (y otros) llega a un escalón de meta. Los escalones no se suman: se paga solo el más alto alcanzado. La barra muestra cuánto falta para el siguiente.",
  bonoRefacciones: "Bono fijo por escalón de venta de refacciones en el mes. Igual que la meta: se paga solo el escalón más alto alcanzado.",
  ajusteComision: "Bonos o descuentos que no salen de una fórmula (bonos de Mercado Libre, correcciones). Los agrega la gerencia de ventas o dirección; uno negativo descuenta.",
  comisionPagada: "Finanzas la marca pagada y se guarda una foto del cálculo de ese momento. Si después se mueve un pedido del mes, la tarjeta te avisa la diferencia.",

  // --- Clientes ---
  cartera: "Cada cliente es de un vendedor hasta la fecha que ves: la más lejana entre su última venta con él + 12 meses, su último seguimiento (cotización, oportunidad o actividad) + 90 días y, si es nuevo, su alta + 90 días. Los plazos se ajustan en Configuración. Pasada esa fecha la cuenta vence y puede quedar libre.",
  clienteLibre: "Cliente sin vendedor dueño: cualquiera le puede cotizar o darle “Hacerlo mío”.",
  ultimaCompra: "Fecha del último pedido del cliente (o de la última venta en el libro de la hoja, si es más reciente). De clientes de otro vendedor no se muestra.",
  compras12m: "Suma sin IVA, en pesos, de los pedidos no cancelados del cliente en los últimos 365 días.",
  saldoArranque: "Lo que el cliente ya debía en la hoja el día que arrancó el ERP, menos lo que ha pagado de eso desde entonces. Se muestra aparte del saldo de los pedidos nuevos.",
  comprasAnterioresErp: "Lo que el cliente compró y pagó según el libro de ventas de la hoja, antes del ERP. Solo lo ven el dueño, la gerencia y cobranza.",
  actividad: "Llamadas, WhatsApp, correos, visitas y notas con el cliente. Una tarea lleva fecha y se queda arriba hasta que la marcas hecha; vencida sale en rojo. También cuenta como seguimiento para la vigencia de la cuenta.",

  // --- A quién llamar ---
  enSeguimiento: "Clientes a los que alguien del equipo ya les escribió o llamó y falta su respuesta. Cada uno dice quién, cuándo, por dónde y qué sigue: llamar al día 3, último mensaje al día 10, luego esperar una semana. Lo ven todos los que venden.",
  enJuego: "Lo que vale buscarlo, más o menos: lo cotizado si tiene una cotización por vencer; lo que suele gastar por compra si ya le toca o hay que reactivarlo; en refacciones, el 5 % del equipo que compró (entre $10 mil y $150 mil).",
  motivoCotizacionPorVencer: "Tiene una cotización enviada o autorizada que vence en los próximos 7 días o venció hace 10 días o menos. Llamar antes de que se enfríe.",
  motivoLeToca: "Compra con ritmo (3 compras o más, cada 1 a 12 meses) y ya pasó su tiempo de siempre, pero no el doble. Es el momento de buscarlo.",
  motivoRefacciones: "Compró un equipo de $40 mil o más hace entre 6 meses y 4 años: a estas alturas ya pide rodillos, banda, cangilones o mantenimiento.",
  motivoReactivar: "Compró 2 veces o más y lleva entre 6 meses y 3 años sin comprar.",
  ritmoCompra: "Cada cuántos días suele comprar este cliente (lo típico entre una compra y otra). Compras a menos de 2 semanas de la anterior cuentan como la misma.",

  // --- Solicitudes de precio ---
  solicitudPrecio: "Cuando algo no tiene precio de lista, se lo pides a compras desde la partida o con “Pedir precio”. Compras tiene un plazo en horas hábiles (más corto si es urgente) y, al contestar, ves el precio de lista y la entrega, nunca el costo. Con un clic lo aplicas a la cotización.",

  // --- Devoluciones ---
  tipoDevolucion: "Devolución: el producto regresa a planta y almacén lo recibe. Reclamo: el cliente reclama y hay que responder antes de la hora límite. Cancelación: se canceló la venta.",
  venceDevolucion: "Lo que corre: en un reclamo, la hora límite para responder; en una devolución, cuándo debe llegar. Rojo si ya pasó, ámbar si falta menos de un día.",
  codigoAutorizacion: "El código que da Mercado Libre para esa devolución o reclamo. Queda aquí y no en el chat.",
  estadoDevolucion: "Abierta → Respondido (reclamo) o Llegó: por decidir (devolución, ya en almacén) → Resuelta con su resultado. O Cancelada, con motivo.",
  fleteCotizacion: "Para poner el flete en la cotización antes de que el cliente compre: con el código postal, estado, municipio y colonia, y los bultos que salen del empaque de cada artículo, cotizan todas las paqueterías de Skydropx a la vez. Al elegir una se agrega la partida de flete con lo que cobra la paquetería más el recargo fijo que puso envíos, redondeado hacia arriba; la puedes cambiar como cualquier partida. No genera guía ni cobra nada: la guía se hace hasta que haya pedido y envío.",
  conexionML: "Con la cuenta de Mercado Libre conectada (y las ventas prendidas), cada venta pagada desde ese momento entra sola como pedido (a nombre de la persona elegida para las ventas de ML) y se pide su envío: si es Full sale de la bodega de Mercado Libre; si no, se surte en planta con la guía de Mercado Envíos. Una cancelación en ML cancela el pedido; los reclamos y devoluciones se abren solos con su hora límite, y las preguntas llegan con aviso.",
  atiendenML: "Las personas que atienden Mercado Libre: a todas les llegan los avisos de preguntas por contestar, reclamos con su fecha límite y ventas cuya publicación falta ligar. Puedes elegir a alguien invitado que todavía no entra: le empiezan a llegar en cuanto acepte su invitación. Las ventas, en cambio, quedan a nombre de una sola persona (la que cuenta para la comisión).",
  traerPendienteML: "Mercado Libre solo avisa lo que pasa después de conectar la cuenta. Este botón trae lo que ya estaba: las preguntas sin contestar y los reclamos abiertos. Un reclamo de una venta que no está en el ERP (de antes de conectar) te llega como aviso para que lo atiendas en Mercado Libre. Las ventas anteriores solo se traen si las ventas están prendidas y eliges desde qué fecha, porque las que ya se capturaron a mano en Pedidos quedarían repetidas. Puedes usarlo las veces que quieras: lo que ya entró no se duplica.",
  publicacionLigada: "Una publicación de Mercado Libre que el ERP ya sabe qué artículo es y cuántas piezas trae cada venta. Si se ligó mal (otro artículo, o es un paquete y se ligó como pieza suelta), dale «Corregir»: las ventas abiertas que todavía no tienen guía se rehacen. «Desligar» la regresa a «Por ligar».",
  piezasPorVentaML: "Cuántas piezas del artículo salen en cada venta de esa publicación. Una publicación de «24 cangilones» lleva 24: una venta entra al pedido como 24 cangilones al precio de cada uno, y descuenta 24 del almacén.",
  ventasMLActivas: "Si las ventas de Mercado Libre entran solas como pedidos (con su envío). Apagado, las ventas no entran al ERP, pero las preguntas y los reclamos sí. Lo prende o apaga dirección; al prenderlo, «Traer lo pendiente» puede traer las ventas desde una fecha.",
  publicacionPorLigar: "Una publicación de Mercado Libre que se vendió y el ERP no sabe qué artículo es (no tiene SKU, o su SKU no es una clave del catálogo). Se liga una sola vez: desde ese momento sus ventas entran con su artículo, y las que estaban esperando piden su envío. Para no tener que ligar, pon la clave del ERP como SKU en la publicación.",
  preguntaSinPublicacion: "Una pregunta de una publicación que está pausada o cerrada en Mercado Libre. Mercado Libre ya no deja contestarla, así que no sale por contestar ni cuenta en «Preguntas sin contestar». Si la publicación se vuelve a activar, la pregunta regresa sola.",
  tiempoRespuestaML: "Cuánto se tardan en contestar las preguntas de Mercado Libre (la mediana de los últimos 30 días) y qué parte se contestó en menos de una hora. Es lo que mide el bono de tiempo de respuesta y lo que ML toma en cuenta para la reputación.",
} satisfies Record<string, string>;

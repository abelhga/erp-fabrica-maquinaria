export const GENERAL = {
  // --- Conceptos que se repiten en todo el ERP ---
  folioPedido: "El número del pedido. Los de clientes van PED-26-799: el año en que se levantó y el número corrido de siempre (el que seguía al pedido 798 de la hoja); el número no vuelve a 1 al cambiar de año. Mercado Libre, la tienda web y Amazon llevan su propia serie que sí empieza cada año (ML-26-0001, WEB-26-0001). Un equipo de stock que se vende lleva un folio de pedido normal. Si el pedido tenía otro folio antes (HIS-…, P-…, PED-2026-…), sale como «antes …» y también lo encuentras por él.",
  folio: "El número que el sistema le pone solo a cada documento (cotización, pedido, orden…), en orden y sin repetirse. Con él lo buscas y lo citas; no se escribe a mano.",
  iva: "Impuesto al valor agregado, normalmente 16 %. Los precios de lista son sin IVA; el total con IVA es lo que paga el cliente. Si un número ya trae IVA, la pantalla lo dice.",
  montoSinIva: "El importe antes del impuesto. Las ventas del mes, las comisiones y las compras de 12 meses se miden sin IVA, para comparar parejo sin importar cómo se cotizó.",
  tipoCambio: "Cuántos pesos vale un dólar (o un euro). Se toma solo cada día hábil: el dólar del Diario Oficial y el euro del Banco Central Europeo; finanzas o compras pueden capturar otro a mano. Una cotización o un pedido en otra moneda guarda su propio tipo de cambio, y con él se convierte a pesos para sumarlo con lo demás.",
  pendiente: "Algo que una persona le pide a otra, con fecha. Al asignarlo le llega un aviso al responsable; cuando lo marca hecho, le llega un aviso a quien lo pidió.",
  aviso: "Notificación que llega a la campana del encabezado: un pendiente nuevo, algo que se terminó, una autorización que espera. Al darle clic te lleva a la pantalla donde se atiende.",
  vencido: "Ya pasó su fecha y sigue abierto. Se pinta en rojo; lo que vence hoy, en ámbar.",
  enVivo: "La pantalla se actualiza sola cuando alguien registra algo (un pedido, un cobro, un avance de taller). No hace falta recargar.",
  alcanceRol: "Los números salen con tus permisos: un vendedor ve lo de sus clientes; la gerencia y dirección ven toda la empresa. Por eso dos personas pueden ver cifras distintas en la misma pantalla.",

  // --- Inicio ---
  loQueImportaHoy: "Resumen del día de tu área. En rojo los riesgos, en ámbar lo que pide atención, en verde lo que va bien. Si tu puesto tiene el Asistente y Claude está conectado, lo redacta él con los datos del ERP; si no, salen los avisos calculados por reglas (dice “Reglas de la base · sin IA”). Cada tarjeta lleva a donde se atiende.",
  avisosDeReglas: "Estos avisos los calcula el ERP con reglas fijas (órdenes atrasadas, máquinas paradas, preventivos vencidos…), sin Claude. Así salen en puestos que no usan el Asistente, como los supervisores de piso y mantenimiento.",
  ventasDelMes: "Pedidos no cancelados con fecha de este mes, sin IVA y en pesos. La flecha compara contra el mismo tramo del mes pasado (del día 1 al día de hoy), no contra el mes completo.",
  cotizacionesVivas: "Cotizaciones abiertas (de borrador a enviada) que todavía no vencen. El monto es lo ya enviado y vigente, sin IVA. El cierre es qué parte de las cotizaciones de los últimos 90 días que ya se cerraron se ganó.",
  tasaCierre: "De las cotizaciones emitidas en los últimos 90 días que ya se cerraron (aceptadas, rechazadas o vencidas), qué porcentaje se aceptó. Más alto es mejor.",
  porCobrar: "Lo que los clientes nos deben, en pesos: lo de sus pedidos (total con IVA menos los cobros registrados) más lo que ya debían en la hoja el día que arrancó el ERP, menos lo que han pagado de eso.",
  ventasAnio: "Lo vendido en el año, con IVA y en pesos. Antes del arranque del ERP sale del libro de ventas de la hoja; después, de los pedidos. La flecha compara contra el mismo tramo del año pasado.",
  proyeccionCierre: "Cuánto cerraría el año si seguimos al mismo ritmo, con la estacionalidad del año pasado: si vamos 20 % arriba a la misma fecha, cierra 20 % arriba de lo que cerró el año pasado.",
  cotizadoVivo: "Total con IVA, en pesos, de las cotizaciones enviadas o autorizadas que siguen vigentes: lo que está en la calle esperando respuesta. Abajo, el cierre de 90 días y las que esperan autorización de precio.",

  // --- Tu semana ---
  ventasSemana: "Lo vendido la semana pasada (lunes a domingo), con IVA y en pesos, contra la semana anterior a esa. Si eres vendedor, solo cuenta lo de tus clientes.",
  cotizacionesSemana: "Cotizaciones que se enviaron la semana pasada y cuántas se ganaron. “Sin respuesta” son las enviadas hace más de una semana que siguen en “Enviada”: nadie las aceptó ni rechazó. Es el seguimiento que se cae.",
  agendaSemana: "Lo que tiene fecha de lunes a domingo de esta semana, sacado del calendario: entregas, lo que llega de compras e importaciones, órdenes del taller, servicios, preventivos, pagos, vacaciones y tus pendientes (lo que tu puesto puede ver). Lo que ya pasó su fecha y sigue abierto sale en rojo como «Atrasado».",
  soloLoMio: "Deja solo lo que está a tu nombre: tus pedidos, oportunidades, llamadas y reclamos; las requisiciones, compras, embarques y envíos que tú pediste; los servicios que programaste o en los que vas; las máquinas a tu cargo y la herramienta que tienes; lo que entra a tu área del taller; tus pendientes, tus vacaciones y tu cumpleaños.",
  atrasadoCalendario: "Ya pasó su fecha y sigue abierto: la entrega no se ha hecho, la compra no ha llegado, el preventivo no se ha cerrado, el pendiente sigue sin hacerse. Lo que ya se cerró no sale en el calendario. También sale en rojo, como «Después del compromiso», el día en que una orden termina según el plan del taller si eso es después de su fecha compromiso: todavía no está atrasada, pero va a llegar tarde si nada cambia.",
  calendarioAreas: "Cada color es un área, y es siempre el mismo. Toca un área para esconderla o volver a mostrarla; el número es cuántas cosas tiene en estos días. Solo salen las áreas que tu puesto puede ver: un vendedor no ve las compras ni los pagos, y los pagos solo los ve finanzas.",
} satisfies Record<string, string>;

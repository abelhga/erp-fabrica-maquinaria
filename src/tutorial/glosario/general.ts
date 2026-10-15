export const GENERAL = {
  // --- Conceptos que se repiten en todo el ERP ---
  folio: "El número que el sistema le pone solo a cada documento (cotización, pedido, orden…), en orden y sin repetirse. Con él lo buscas y lo citas; no se escribe a mano.",
  iva: "Impuesto al valor agregado, normalmente 16 %. Los precios de lista son sin IVA; el total con IVA es lo que paga el cliente. Si un número ya trae IVA, la pantalla lo dice.",
  montoSinIva: "El importe antes del impuesto. Las ventas del mes, las comisiones y las compras de 12 meses se miden sin IVA, para comparar parejo sin importar cómo se cotizó.",
  tipoCambio: "Cuántos pesos vale un dólar (o un euro). Una cotización o un pedido en otra moneda guarda su propio tipo de cambio, y con él se convierte a pesos para sumarlo con lo demás.",
  pendiente: "Algo que una persona le pide a otra, con fecha. Al asignarlo le llega un aviso al responsable; cuando lo marca hecho, le llega un aviso a quien lo pidió.",
  aviso: "Notificación que llega a la campana del encabezado: un pendiente nuevo, algo que se terminó, una autorización que espera. Al darle clic te lleva a la pantalla donde se atiende.",
  vencido: "Ya pasó su fecha y sigue abierto. Se pinta en rojo; lo que vence hoy, en ámbar.",
  enVivo: "La pantalla se actualiza sola cuando alguien registra algo (un pedido, un cobro, un avance de taller). No hace falta recargar.",
  alcanceRol: "Los números salen con tus permisos: un vendedor ve lo de sus clientes; la gerencia y dirección ven toda la empresa. Por eso dos personas pueden ver cifras distintas en la misma pantalla.",

  // --- Inicio ---
  loQueImportaHoy: "Resumen del día de tu área. En rojo los riesgos, en ámbar lo que pide atención, en verde lo que va bien. Si Claude está conectado lo redacta él con los datos del ERP; si no, salen los hallazgos calculados por reglas (dice “Reglas de la base · sin IA”). Cada tarjeta lleva a donde se atiende.",
  ventasDelMes: "Pedidos no cancelados con fecha de este mes, sin IVA y en pesos. La flecha compara contra el mismo tramo del mes pasado (del día 1 al día de hoy), no contra el mes completo.",
  cotizacionesVivas: "Cotizaciones abiertas (de borrador a enviada) que todavía no vencen. El monto es lo ya enviado y vigente, sin IVA. El cierre es qué parte de las cotizaciones de los últimos 90 días que ya se cerraron se ganó.",
  tasaCierre: "De las cotizaciones emitidas en los últimos 90 días que ya se cerraron (aceptadas, rechazadas o vencidas), qué porcentaje se aceptó. Más alto es mejor.",
  porCobrar: "Lo que los clientes deben de sus pedidos: total con IVA menos los cobros registrados, en pesos. En el centro de mando se suma además el saldo que ya venía de la hoja el día del arranque.",
  ventasAnio: "Lo vendido en el año, con IVA y en pesos. Antes del arranque del ERP sale del libro de ventas de la hoja; después, de los pedidos. La flecha compara contra el mismo tramo del año pasado.",
  proyeccionCierre: "Cuánto cerraría el año si seguimos al mismo ritmo, con la estacionalidad del año pasado: si vamos 20 % arriba a la misma fecha, cierra 20 % arriba de lo que cerró el año pasado.",
  cotizadoVivo: "Total con IVA, en pesos, de las cotizaciones enviadas o autorizadas que siguen vigentes: lo que está en la calle esperando respuesta. Abajo, el cierre de 90 días y las que esperan autorización de precio.",

  // --- Tu semana ---
  ventasSemana: "Lo vendido la semana pasada (lunes a domingo), con IVA y en pesos, contra la semana anterior a esa. Si eres vendedor, solo cuenta lo de tus clientes.",
  cotizacionesSemana: "Cotizaciones que se enviaron la semana pasada y cuántas se ganaron. “Sin respuesta” son las enviadas hace más de una semana que siguen en “Enviada”: nadie las aceptó ni rechazó. Es el seguimiento que se cae.",
  agendaSemana: "Todo lo que tiene fecha de lunes a domingo de esta semana: entregas comprometidas, órdenes de taller, compras que llegan, embarques y servicios (lo que tu rol puede ver). Lo que ya pasó su fecha y sigue abierto sale en rojo como “Atrasada”.",
} satisfies Record<string, string>;

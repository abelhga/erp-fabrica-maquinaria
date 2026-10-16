import type { AyudaPantalla } from "./index";

export const ADMINISTRACION: Record<string, AyudaPantalla> = {
  "/rrhh/empleados": [
    "Aquí está la plantilla de la empresa: cada persona con su puesto, departamento, área del taller, antigüedad y vacaciones. La usa Recursos Humanos para dar altas, bajas y llevar la ficha de cada quien.",
    "Dale clic a un renglón para abrir su ficha a la derecha sin perder la lista. Ahí cambias sus datos (Enter guarda), ves su historial de vacaciones e incidencias y, al final, la das de baja o registras un reingreso. Con «Nuevo empleado» das de alta a alguien.",
    "Arriba filtras activos, bajas o todos, y por departamento. Los indicadores de ausentes y solicitudes te llevan directo a Vacaciones e incidencias. El botón CSV baja la lista para Excel.",
    "La antigüedad y las vacaciones salen solas de la fecha de ingreso. Una baja no borra a nadie: su historial se conserva. Si la persona tenía cuenta en el ERP, desactívala al darla de baja para que ya no pueda entrar.",
  ],
  "/rrhh/incidencias": [
    "Aquí se llevan las vacaciones, permisos, faltas, incapacidades, retardos y horas extra. Recursos Humanos aprueba las solicitudes y ve quién falta cada día; la gerencia de producción también puede registrar las de su gente.",
    "«Por aprobar» muestra cada solicitud con el saldo que le quedaría y quién más falta esos días: apruébala o recházala con un motivo, que la persona verá en su historial. «Calendario» pinta el mes con un color por tipo; las solicitudes pendientes salen punteadas y puedes dar clic en un día para registrar algo en esa fecha.",
    "«Saldos de vacaciones» tiene la tabla de la ley y lo que le queda a cada quien, con el plazo para tomarlos. «Historial» muestra lo de los últimos 13 meses, con filtros por tipo y estado, y se puede bajar en CSV.",
    "Solo lo aprobado cuenta en el saldo y en la prenómina. Vacaciones y permisos se cuentan en días hábiles (la semana laboral y los descansos de Configuración, sin feriados de ley); la incapacidad, en días naturales como el IMSS.",
  ],
  "/rrhh/objetivos": [
    "Aquí se califican los objetivos de cada persona mes con mes y de ahí sale su bono. Los jefes directos califican a su gente, Recursos Humanos revisa y arma las plantillas, y dirección aprueba.",
    "Con las flechas de arriba eliges el mes. En «Evaluaciones del mes» dale clic a una persona para ver cada indicador con su regla, lo medido y la evidencia; ahí el jefe captura lo que falta (Enter guarda) y la envía a Recursos Humanos. Las insignias de estado dicen en qué paso va cada una.",
    "«Plantillas por puesto» define qué se le pide a cada puesto y cuánto pesa; «Personas y jefes» dice quién evalúa a quién (solo Recursos Humanos); «Indicadores» es el catálogo completo, con lo que falta para que cada uno se mida solo.",
    "Lo que el sistema puede medir (entregas, inventario, ventas, checklist) se mide solo y guarda su evidencia; lo demás lo pone el jefe. Nadie se califica a sí mismo y un mes aprobado ya no se toca: se corrige con un ajuste que autoriza otra persona. Los montos del bono solo los ve quien tiene nómina.",
  ],
  "/rrhh/checklist": [
    "Aquí se marca, día por día, si cada persona cumplió: entrega del celular, equipo de protección, limpieza de su área y revisión de vehículos. Está hecho para el celular de quien supervisa: un toque por persona.",
    "Arriba eliges qué revisas y el día (con las flechas o la fecha). El celular se revisa tres veces: entrada, break 1 y break 2. Toca la palomita si cumplió o la X si no; con la X puedes anotar qué pasó (Enter guarda). «Los restantes cumplieron» marca de un jalón a quienes falten.",
    "Primero salen quienes tienen ese punto en sus objetivos; abajo puedes mostrar a todos. A ti no te puedes marcar: te marca otra persona. La limpieza se marca por área y cuenta para todos los que comparten esa área.",
    "Estas marcas alimentan los objetivos del mes. Un día sin marca no cuenta en contra. Puedes corregir hasta una semana atrás; después solo Recursos Humanos, y nunca en un mes ya calificado.",
  ],
  "/rrhh/prenomina": [
    "Aquí se arma la nómina de cada semana, de viernes a jueves, para pagarla el viernes siguiente. La usa Recursos Humanos: revisa, agrega conceptos, cierra la semana y le pasa el CSV al contador.",
    "Elige la semana arriba; por omisión abre la que ya terminó y falta cerrar. Dale clic a una persona para ver su renglón desglosado. «Agregar concepto» registra pagos o descuentos fuera del sueldo con su motivo, y «Cerrar semana» la congela. Las pestañas Préstamos y Sueldos llevan los préstamos con su saldo y el historial de sueldos.",
    "Todo sale de lo aprobado en Vacaciones e incidencias: las faltas y los permisos sin goce descuentan días, el retardo descuenta su tiempo, las vacaciones pagan prima, y las horas extra se pagan dobles hasta 9 a la semana y triples después. El bono sale de los objetivos aprobados y se paga cuando dirección define su base.",
    "Es lo que se le paga a cada quien antes de lo fiscal: ISR, IMSS y timbrado los calcula el contador con el CSV. Una semana cerrada ya no cambia; un error se corrige en la semana abierta con otro concepto.",
  ],
  "/rrhh/mi-desempeno": [
    "Aquí ves tus objetivos de cada mes y cómo te fue en cada uno. Lo ves tú, tu jefe directo, Recursos Humanos y dirección; aquí no aparecen montos.",
    "Arriba elige el mes: cada tarjeta trae tu resultado. Abre por omisión el último mes ya calificado. «En calificación» quiere decir que tu jefe todavía no termina, «En revisión» que lo están revisando Recursos Humanos o dirección, y «Aprobado» que ya es definitivo. En rojo con una llave: se activó la llave y ese mes el bono vale 0.",
    "Abajo está cada indicador con su peso, su regla y lo que se midió. Dale a «Ver evidencia» para ver los pedidos, órdenes o marcas del checklist que lo explican: un punto rojo cuenta en contra; uno verde, no.",
    "Tú no te calificas. Si algo no te cuadra, escríbelo en Comentarios: tu jefe y Recursos Humanos lo leen y pueden corregirlo antes de que se apruebe. Ya aprobado, solo se cambia con un ajuste que autoriza otra persona.",
  ],
  "/finanzas/cobranza": [
    "Aquí ves lo que nos deben los clientes por sus pedidos, desde cuándo, y lo que se ha cobrado mes a mes. La usa finanzas para saber a quién llamar primero y para registrar cobros y facturas.",
    "Los indicadores de arriba parten el saldo por antigüedad; dale clic a uno para filtrar la tabla. «Los más atrasados» es por dónde empezar a llamar. Dale clic a un pedido para ver sus cobros y facturas y registrar uno nuevo; un cobro negativo es una devolución al cliente.",
    "Las pestañas agrupan por cliente o por vendedor (clic en un renglón para ver sus pedidos) y «Saldos de arranque» trae lo que se debía en la hoja antes del ERP, aparte para no contarlo dos veces; dale clic a un cliente para ver sus movimientos y registrar lo que pague de ese saldo. Los filtros separan lo que tiene saldo y lo que falta facturar; el CSV baja lo que ves.",
    "Las facturas y los cobros se pueden registrar subiendo su XML: en el pedido, «Registrar factura» lee la factura que timbramos (folio, UUID, fecha y total) y revisa que sea de ese cliente; «Subir complementos de pago», arriba, registra cada pago en el pedido de su factura, aunque subas muchos a la vez, y no duplica lo que ya estaba.",
    "La antigüedad corre desde la primera factura, o desde el pedido si aún no se factura. Los saldos en dólares se pasan a pesos con el tipo de cambio de hoy, que se ve arriba (finanzas y compras lo pueden capturar ahí).",
  ],
  "/finanzas/pagos": [
    "Aquí ves lo que debemos a proveedores y cuándo vence cada cosa: lo vencido primero y lo que viene en las próximas 4 semanas. La usa finanzas para planear los pagos y para registrar cada compra, gasto y pago; compras ve solo las órdenes de compra.",
    "Cada factura que llega (material, flete, luz, servicio) se registra con «Registrar compra o gasto»: sube el XML y se llena solo (proveedor por su RFC, folio, total y fecha); puedes subir varios a la vez. Si la factura dice que es de contado, marca «Ya se pagó» y elige la cuenta. Si el proveedor no existe, se da de alta ahí mismo con su RFC.",
    "La agenda suma por proveedor lo que vence cada semana; dale clic a uno para abrir su cuenta: sus facturas pendientes, todos sus movimientos (los de la hoja y los de aquí) y el botón para registrar un pago. Al pagar puedes elegir qué factura liquidas; si no eliges, el pago va a las que vencen primero. Pagar de más solo se puede como anticipo.",
    "«Facturas por pagar» es la lista de facturas con saldo; «Por proveedor», lo que se le debe a cada uno (ahí están aparte los préstamos de socios y los créditos del banco, y lo que tenemos a favor); «Órdenes de compra», las órdenes recibidas con saldo, que se pagan desde la orden.",
    "Cada factura vence en su fecha más los días de crédito del proveedor; cámbialos en su cuenta si no están bien y todas sus fechas se recorren. Lo que venía de 2021 cuenta como vencido. Si un pago o compra también se anotó en la hoja, no se cuenta dos veces. Las órdenes en dólares se pasan a pesos con el tipo de cambio de hoy.",
  ],
  "/finanzas/caja-chica": [
    "Aquí se lleva el efectivo de la oficina: cada gasto y cada reposición, con el saldo después de cada uno. La usa finanzas.",
    "Para anotar, elige «Sale» o «Entra», escribe el concepto y el monto y dale Enter. Un movimiento mal capturado se borra con el bote de basura; lo que vino de la hoja no se borra.",
    "Cuando cuentes el efectivo, usa «Arqueo»: escribe cuánto hay y, si no cuadra con el saldo, la diferencia queda anotada como sobrante o faltante con tu nombre.",
    "El saldo es la suma de todo lo que ha entrado menos lo que ha salido desde que empezó la hoja. Se pinta en rojo abajo del mínimo (toca reponer) y en amarillo arriba del máximo (sobra efectivo).",
  ],
};

import type { AyudaPantalla } from "./index";

// Arriba de cada pantalla solo va para qué sirve y lo mínimo para trabajar; los botones, columnas y
// pestañas ya traen su globo (glosario de administración). El «detalle» conserva todas las reglas
// porque el asistente lo lee como manual: si se quita de aquí, el asistente deja de saberlo.
// Resultados la ven solo quienes tienen costos: es la única pantalla de aquí que habla de utilidad.
export const ADMINISTRACION: Record<string, AyudaPantalla> = {
  "/rrhh/empleados": {
    resumen: "Aquí Recursos Humanos lleva la plantilla: cada persona con su puesto, departamento, área del taller, antigüedad y vacaciones, y da altas y bajas.",
    pasos: [
      "Dale clic a un renglón para abrir su ficha a la derecha sin perder la lista.",
      "Cambia sus datos en la ficha; Enter o «Guardar cambios» guarda.",
      "Da de alta a alguien con «Nuevo empleado» y su fecha de ingreso.",
    ],
    detalle: [
      "En la ficha ves su historial de vacaciones e incidencias y, al final, la das de baja con «Dar de baja» o registras un «Reingreso». Una baja no borra a nadie: su historial se conserva. Si la persona tenía cuenta en el ERP, desactívala al darla de baja para que ya no pueda entrar.",
      "Quien es de Producción trae «Entra a cuadrillas»: con eso sale en la terminal de piso para asignarle trabajo (al darlo de alta con su área entra de una vez). La gerencia de producción ve y acomoda solo a la gente de Producción.",
      "Debajo de su inicial, «Subir foto» le pone foto (en el celular abre la cámara). La ven solo Recursos Humanos, la gerencia de producción (de su gente) y la propia persona.",
      "En «Checklist diario» palomeas qué se le revisa cada día (EPP, entrega de celular, revisión de vehículo): sin palomear no sale en ese checklist. La columna «Checklist» de la lista te dice a quién te falta.",
      "La pestaña «Datos sensibles» (CURP, RFC, NSS, salario, cuenta bancaria y demás) solo la ven Recursos Humanos con permiso de administrar y dirección.",
      "Arriba filtras activos, bajas o todos, y por departamento. Los indicadores de ausentes y solicitudes te llevan directo a Vacaciones e incidencias. El botón CSV baja la lista para Excel.",
      "La antigüedad y las vacaciones salen solas de la fecha de ingreso. Quien venía del control de vacaciones en Excel arranca con el saldo que tenía ahí; en su ficha puedes corregirlo eligiendo de qué periodo es.",
      "En la ficha ves cada periodo (cuánto le tocó, usó, adelantó y le queda, y cuándo vence) y, en su historial, a qué periodo se cargó cada vacación o si fue adelanto.",
    ],
  },
  "/rrhh/incidencias": {
    resumen: "Aquí se llevan vacaciones, permisos, faltas, incapacidades, retardos y horas extra: Recursos Humanos aprueba las solicitudes y ve quién falta cada día.",
    pasos: [
      "En «Por aprobar» revisa el saldo de la persona y quién más falta esos días.",
      "Dale «Aprobar», o «Rechazar» con un motivo que la persona verá en su historial.",
      "Con «Registrar» anota vacaciones, permisos, faltas, incapacidades, retardos u horas extra.",
    ],
    detalle: [
      "La gerencia de producción también puede registrar las de su gente. Lo que registra alguien que no es Recursos Humanos queda como solicitud por aprobar.",
      "Cada solicitud de «Por aprobar» enseña el saldo de hoy, de qué periodo saldrían los días o cuántos serían adelanto, y quién más falta esos días. Cuenta la fecha: después de su aniversario ya salen del periodo nuevo.",
      "«Calendario» pinta el mes con un color por tipo; las solicitudes pendientes salen punteadas. Dale clic a un día para registrar algo en esa fecha.",
      "«Saldos de vacaciones» tiene la tabla de la ley y lo que le queda a cada quien: lo vigente, lo adelantado y qué días vencen primero.",
      "Cada vacación se carga al periodo más viejo vigente; si ya no hay, queda como adelanto del siguiente y se le descuenta cuando llegue, sin perdonarse al cumplir año. Lo que sobra de un periodo vence 18 meses después de su aniversario.",
      "«Historial» muestra lo de los últimos 13 meses, con filtros por tipo y estado, y se puede bajar en CSV.",
      "Solo lo aprobado cuenta en el saldo y en la prenómina. Vacaciones y permisos se cuentan en días hábiles (la semana laboral y los descansos de Configuración, sin feriados de ley); la incapacidad, en días naturales, como el IMSS.",
    ],
  },
  "/rrhh/objetivos": {
    resumen: "Aquí se califican cada mes los objetivos de cada persona y de ahí sale su bono: los jefes califican, Recursos Humanos revisa y dirección aprueba.",
    pasos: [
      "Elige el mes con las flechas de arriba.",
      "En «Evaluaciones del mes» dale clic a una persona y captura lo que falta (Enter guarda).",
      "Cuando esté todo calificado, dale «Enviar a RRHH».",
    ],
    detalle: [
      "Los jefes directos califican a su gente y Recursos Humanos, además de revisar, arma las plantillas. En la evaluación de cada persona ves cada indicador con su regla, lo medido y la evidencia. Las insignias de estado dicen en qué paso va cada una.",
      "«Plantillas por puesto» define qué se le pide a cada puesto y cuánto pesa; «Personas y jefes» dice quién evalúa a quién (solo Recursos Humanos); «Indicadores» es el catálogo completo, con lo que falta para que cada uno se mida solo.",
      "Lo que el sistema puede medir se mide solo y guarda su evidencia: ventas, entregas, inventario, el checklist, qué tan rápido se asignan y se atienden los leads, los seguimientos de cotización y las preguntas de Mercado Libre.",
      "También se miden solos los preventivos y las fallas de las máquinas, las etapas marcadas en la terminal, los pendientes a tiempo y las ideas de mejora. Lo demás lo pone el jefe.",
      "Los plazos («en 4 horas», «al siguiente día hábil») cuentan horas de horario: lo que llega de noche no cuenta en contra hasta que se abre.",
      "Nadie se califica a sí mismo y un mes aprobado ya no se toca: se corrige con un ajuste que autoriza otra persona. Los montos del bono solo los ve quien tiene nómina.",
    ],
  },
  "/rrhh/checklist": {
    resumen: "Aquí se marca, día por día, si cada persona cumplió con celular, equipo de protección, limpieza y vehículos; hecho para el celular de quien supervisa.",
    pasos: [
      "Arriba elige qué revisas (Celular, EPP, Limpieza o Vehículos) y el día.",
      "Toca la palomita si cumplió o la X si no; con la X anota qué pasó.",
      "Usa «Los … restantes cumplieron» para marcar de un jalón a quienes falten.",
    ],
    detalle: [
      "Se revisa la entrega del celular, el equipo de protección (EPP), la limpieza de su área y la revisión de vehículos: un toque por persona. El día se cambia con las flechas o con la fecha. El celular se revisa tres veces: entrada, break 1 y break 2. Con la X, Enter guarda la nota.",
      "Solo salen las personas que tienen ese punto palomeado en su ficha (Personal): el EPP, por ejemplo, al personal de taller. Si no sale alguien, pídele a Recursos Humanos que lo palomee.",
      "A ti no te puedes marcar: te marca otra persona. La limpieza se marca por área y cuenta para todos los que comparten esa área.",
      "Estas marcas alimentan los objetivos del mes. Un día sin marca no cuenta en contra. Puedes corregir hasta una semana atrás; después solo Recursos Humanos, y nunca en un mes ya calificado.",
    ],
  },
  "/rrhh/prenomina": {
    resumen: "Aquí Recursos Humanos arma la nómina de cada semana, de viernes a jueves, para pagarla el viernes siguiente, y le pasa el CSV al contador.",
    pasos: [
      "Elige la semana arriba; de entrada abre la que ya terminó y falta cerrar.",
      "Dale clic a una persona para ver su renglón desglosado; con «Agregar concepto» agregas pagos o descuentos.",
      "Dale «Cerrar semana» y baja el archivo para el contador con «Exportar CSV».",
    ],
    detalle: [
      "«Agregar concepto» registra pagos o descuentos fuera del sueldo con su motivo, y «Cerrar semana» la congela. Ya cerrada, finanzas da «Registrar pago» con la fecha y la cuenta de donde salió el dinero, y la semana dice «Pagada el…» para que sepas que ya se pagó.",
      "Las pestañas Préstamos, Ahorro y Sueldos llevan los préstamos con su saldo, la caja de ahorro y el historial de sueldos.",
      "En «Préstamos», al registrar uno sale su pagaré para imprimir y firmar (sin interés); dale clic a «Pagaré por firmar» para anotar la fecha de firma o reimprimirlo.",
      "«Abonar» registra un pago mayor al descuento: en efectivo (dices a qué cuenta entró, queda en finanzas y sale recibo) o descontando más en la nómina de una semana abierta. Si alguien se da de baja debiendo, el saldo completo se descuenta en su última semana (finiquito).",
      "En «Ahorro», el botón «Ahorro» de cada renglón captura cuánto decidió ahorrar la persona por semana: se descuenta solo hasta que lo cambies, y al cerrar la semana pasa a su saldo.",
      "Cuando pida su dinero, «Retiro» lo registra el día que se le entrega, con la fecha en que lo pidió (respetando los días de anticipación de las reglas) y la cuenta de donde salió, que queda también en finanzas. Saca el recibo con folio para firmar.",
      "En «Ahorro», dale clic a una persona para ver sus movimientos, reimprimir recibos o registrar el saldo que ya traía de Excel. «Cambiar» en Reglas fija los días de anticipación, lo que pone la empresa (hoy nada) y el interés de los préstamos (hoy ninguno).",
      "Todo sale de lo aprobado en Vacaciones e incidencias: las faltas y los permisos sin goce descuentan días, el retardo descuenta su tiempo, las vacaciones pagan prima, y las horas extra se pagan dobles hasta 9 a la semana y triples después.",
      "El bono sale de los objetivos aprobados y se paga cuando dirección define su base.",
      "Es lo que se le paga a cada quien antes de lo fiscal: ISR, IMSS y timbrado los calcula el contador con el CSV. Una semana cerrada ya no cambia; un error se corrige en la semana abierta con otro concepto.",
    ],
  },
  "/rrhh/mi-desempeno": {
    resumen: "Aquí ves tus objetivos de cada mes y cómo te fue en cada uno; lo ven tú, tu jefe directo, Recursos Humanos y dirección, sin montos.",
    pasos: [
      "Arriba elige el mes: cada tarjeta trae tu resultado.",
      "Abajo, dale «Ver evidencia» en un indicador para ver lo que explica su número.",
    ],
    detalle: [
      "Abre por omisión el último mes ya calificado. «En calificación» quiere decir que tu jefe todavía no termina, «En revisión» que lo están revisando Recursos Humanos o dirección, y «Aprobado» que ya es definitivo. En rojo con una llave: se activó la llave y ese mes el bono vale 0.",
      "Cada indicador trae su peso, su regla y lo que se midió. La evidencia son los pedidos, órdenes o marcas del checklist que lo explican: un punto rojo cuenta en contra; uno verde, no.",
      "Tú no te calificas. Si algo no te cuadra, escríbelo en Comentarios: tu jefe y Recursos Humanos lo leen y pueden corregirlo antes de que se apruebe. Ya aprobado, solo se cambia con un ajuste que autoriza otra persona.",
    ],
  },
  "/finanzas/cobranza": {
    resumen: "Lo que nos deben los clientes (pedidos y saldos de la hoja), desde cuándo, y lo cobrado cada mes: para que finanzas sepa a quién llamar y registre cobros.",
    pasos: [
      "Empieza por «Los más atrasados»: son los pedidos con más días sin pagarse.",
      "Dale clic a un pedido para ver sus cobros y facturas.",
      "Ahí anota el pago con «Registrar cobro» o la factura con «Registrar factura».",
    ],
    detalle: [
      "Los indicadores de arriba suman los pedidos y lo de la hoja, y parten el saldo por antigüedad; dale clic a uno para filtrar la tabla de pedidos. Un cobro negativo es una devolución al cliente.",
      "Las pestañas agrupan por cliente o por vendedor (clic en un renglón para ver sus pedidos). Los filtros separan lo que tiene saldo y lo que falta facturar; el CSV baja lo que ves.",
      "«Saldos de arranque (hoja)» trae, cliente por cliente, lo que se debía en la hoja antes del ERP; los pedidos que vienen de la hoja se cobran contra eso, no aparte. Dale clic a un cliente para ver sus movimientos y registrar lo que pague de ese saldo.",
      "Las facturas y los cobros se pueden registrar subiendo su XML. En el pedido, «Registrar factura» lee la factura que timbramos (folio, UUID, fecha y total) y revisa que sea de ese cliente.",
      "«Subir complementos de pago», arriba, registra cada pago en el pedido de su factura, aunque subas muchos a la vez, y no duplica lo que ya estaba.",
      "Si a una factura le falta el UUID o tiene un dato mal, corrígela con el lápiz en vez de registrarla otra vez: un folio o un UUID repetido no entra.",
      "La antigüedad corre desde la primera factura, o desde el pedido si aún no se factura; la de la hoja, desde la venta (los pagos tapan primero las ventas más viejas).",
      "Los saldos en dólares se pasan a pesos con el tipo de cambio de hoy, que se ve arriba (finanzas y compras lo pueden capturar ahí).",
    ],
  },
  "/finanzas/pagos": {
    resumen: "Lo que debemos a proveedores y cuándo vence, lo vencido primero: finanzas planea los pagos y registra cada compra, gasto y pago; compras ve solo las órdenes.",
    pasos: [
      "Registra cada factura que llega con «Registrar compra o gasto»: sube el XML y se llena solo.",
      "En la agenda, dale clic a un proveedor para abrir su cuenta.",
      "En su cuenta, dale «Registrar pago» y, si quieres, elige qué factura liquidas.",
    ],
    detalle: [
      "La agenda enseña lo vencido primero y lo que viene en las próximas 4 semanas, sumado por proveedor cada semana. La cuenta de cada proveedor trae sus facturas pendientes, todos sus movimientos (los de la hoja y los de aquí) y el botón para registrar un pago.",
      "Al pagar, si no eliges factura, el pago va a las que vencen primero. Pagar de más solo se puede como anticipo.",
      "Cada factura que llega (material, flete, luz, servicio) se registra con «Registrar compra o gasto»: el XML llena proveedor (por su RFC), folio, total y fecha, y puedes subir varios a la vez. Si no tienes el XML, sube el PDF o una foto: la IA la lee, y tú revisas los datos antes de registrar.",
      "Si la factura dice que es de contado, marca «Ya se pagó (de contado)» y elige la cuenta. Si el proveedor no existe, se da de alta ahí mismo con su RFC.",
      "Si el proveedor tiene órdenes de compra, el formulario te pregunta de cuál es la factura; ya viene marcada la que casa con el folio que anotó almacén al recibir. En la cuenta del proveedor, el botón del portapapeles en cada compra cambia de qué orden es.",
      "Con orden, cada partida cuenta por su artículo (consumible del taller o material) y la categoría solo aplica a lo que no tiene artículo, como un flete. Sin orden (luz, honorarios, publicidad), la categoría es obligatoria: es lo que dice en qué se gastó.",
      "Con el XML, la categoría se sugiere por la clave del SAT de lo que se compró (o por cómo registraste antes esa clave); si no, viene la del proveedor.",
      "«Facturas por pagar» es la lista de facturas con saldo. «Por proveedor», lo que se le debe a cada uno; ahí están aparte los préstamos de socios y los créditos del banco, y lo que tenemos a favor.",
      "«Órdenes de compra» son las órdenes recibidas con saldo que todavía no tienen su factura registrada; en cuanto se liga su factura, lo que se debe se paga por la factura.",
      "«Pagos hechos» es todo lo que ya se pagó, por periodo y por cuenta, con su total y el botón CSV para el contador. Va por la fecha del pago; lo que acabas de registrar, aunque sea de otro mes, está en «Recién capturados».",
      "Los retiros de caja de ahorro que entrega Recursos Humanos salen en «Pagos hechos» al elegir «Nómina e impuestos», a nombre de «Caja de ahorro del personal». Los abonos en efectivo a préstamos entran en la cuenta de «Préstamos al personal». De los dos te llega un aviso.",
      "Cada factura vence en su fecha más los días de crédito del proveedor; cámbialos en su cuenta si no están bien y todas sus fechas se recorren. Lo que venía de 2021 cuenta como vencido. Las órdenes en dólares se pasan a pesos con el tipo de cambio de hoy.",
      "Si un pago o compra también se anotó en la hoja, no se cuenta dos veces. Una factura ya registrada (mismo folio y proveedor) no entra otra vez; si se parece a otra (mismo monto, misma semana), te lo avisa antes de guardar.",
      "Si una factura sale «¿Repetida en la hoja?», es que la hoja la tiene dos veces y la otra ya se pagó: no la pagues; ábrela en la cuenta del proveedor y márcala con «Estaba repetida».",
      "Si encuentras en la hoja una compra o un pago de más (aunque la copia esté con otro nombre de proveedor) o una factura que se canceló, usa el botón de la derecha del renglón en los movimientos de la cuenta: queda tachado con tu motivo, deja de contar y se puede deshacer.",
      "Una factura de la hoja de menos de $1 por pagar son centavos de redondeo y no se enseña. Si una cuenta de la hoja dice que no está ligada a un proveedor del catálogo, elige cuál es ahí mismo para poder pagarle.",
    ],
  },
  "/finanzas/caja-chica": {
    resumen: "Aquí se lleva el efectivo de la oficina, cada gasto y reposición con su saldo; lo lleva finanzas, y recepción y compras anotan cuando no está.",
    pasos: [
      "Elige «Sale» o «Entra», escribe el concepto y el monto, y dale Enter.",
      "Cuando cuentes el efectivo, usa «Arqueo» y escribe cuánto hay.",
    ],
    detalle: [
      "Cada movimiento enseña el saldo después de él. Un movimiento mal capturado lo borra finanzas con el bote de basura; lo que vino de la hoja no se borra.",
      "Los retiros de ahorro y los abonos a préstamos que Recursos Humanos paga o recibe en efectivo de la caja entran solos, con su folio en el concepto.",
      "El arqueo y borrar un movimiento son de finanzas: quien toma el dinero no es quien cuenta la caja. En el arqueo, si lo contado no cuadra con el saldo, la diferencia queda anotada como sobrante o faltante con tu nombre.",
      "El saldo es la suma de todo lo que ha entrado menos lo que ha salido desde que empezó la hoja. Se pinta en rojo abajo del mínimo (toca reponer) y en amarillo arriba del máximo (sobra efectivo).",
    ],
  },
  "/finanzas/sin-registrar": {
    resumen: "Finanzas ve aquí lo que el SAT dice que nos facturaron y nadie ha registrado: ni en la hoja, ni en las compras del ERP, ni en caja chica.",
    pasos: [
      "Carga los XML del mes en «Facturas anteriores (XML)»; el botón «Cargar XML» te lleva.",
      "Dale «Registrar» en cada factura, o «Registrar las…» para pasarlas todas, una por una.",
    ],
    detalle: [
      "Sale de los XML cargados en «Facturas anteriores (XML)»: carga ahí los del mes y aquí aparece lo que no está en la hoja de compras, en las compras del ERP ni en caja chica.",
      "Arriba: cuántas faltan y cuánto suman, cuánto es a crédito (cuentas por pagar que no salen en Pagos a proveedores) y cuántas son de un proveedor que todavía no está dado de alta. Clic en un indicador filtra la lista.",
      "«Registrar» abre «Registrar compra o gasto» ya lleno con la factura, igual que si subieras su XML; si el proveedor no existe, se da de alta ahí con su RFC. Ya registrada, sale sola de la lista.",
      "Las que no se registran aquí (las cobra el banco directo, son de un socio, se pagaron con un anticipo ya registrado) se sacan con el botón de cada renglón y su motivo; quedan en «No se registran» y se pueden regresar. Las canceladas nunca salen.",
    ],
  },
  "/finanzas/facturas-anteriores": {
    resumen: "Aquí entran los XML de años pasados (la carpeta FACTURAS de Drive) para que la historia de antes del ERP diga qué se compró y no solo a quién.",
    pasos: [
      "Descarga de Drive la carpeta FACTURAS, un año a la vez o todo.",
      "Elígela con «Elegir carpeta», o elige los ZIP que da Drive con «XML o ZIP».",
      "Si un proveedor sale «sin renglón en la hoja», dale su RFC y usa «Volver a amarrar».",
    ],
    detalle: [
      "La usa finanzas; lo ve también dirección. Los XML se leen en tu navegador y solo sube lo que dicen; puede tardar unos minutos por año.",
      "Volver a cargar lo mismo no duplica nada: cada factura se guarda una vez por su folio fiscal. Las que no son de Hegamex (ni la emitió ni la recibió) no se guardan.",
      "Cada factura recibida se amarra a su renglón del libro de compras de la hoja (por folio y monto, o por monto exacto y fecha cercana); de ahí sale su número de orden de compra, que abre el PDF de esa orden en Drive. Cada factura emitida se amarra a su venta por serie y folio.",
      "La tabla de arriba dice, por año, cuántas compras y ventas de la hoja ya tienen su XML; clic en un año para ver sus facturas.",
      "Las facturas canceladas no cuentan: las que vienen de una carpeta «Canceladas» de Drive se marcan solas, y si el SAT dice que otra está cancelada, el botón al final de su renglón la marca (y su renglón de la hoja pasa a la factura que la reemplazó).",
      "Las canceladas se ven en «Recibidas» o «Emitidas» con la marca «Cancelada»; no salen entre lo pendiente.",
      "Si un proveedor sale en «sin renglón en la hoja», casi siempre le falta su RFC en el ERP o se llama distinto en la hoja.",
      "Con su XML, una compra de antes cuenta en Resultados por lo que se compró (su clave del SAT) y no por el giro del proveedor. Salvo que el proveedor esté en una categoría que no es gasto, como «Sin efectos», retiros o compra de activos: esa la hoja la dejó fuera a propósito y así se queda.",
    ],
  },
  "/finanzas/resultados": {
    resumen: "Cuánto deja de verdad lo que se vende, desde 2018: de las ventas, cuánto se va en fabricar, vender y administrar, impuestos e intereses, y cuánto queda.",
    pasos: [
      "Elige el periodo arriba: de entrada abre «Mes pasado»; también hay «Año pasado» o «Rango».",
      "Lee el diagrama de izquierda a derecha y pasa el mouse por una franja.",
    ],
    detalle: [
      "La ven dirección, finanzas y la gerencia administrativa. Con «Rango» eliges fechas desde 2018.",
      "En el diagrama, las ventas por línea se juntan y se reparten en costo de fabricación, gastos de operación, impuestos e intereses y utilidad; el grueso de cada franja es el dinero. Al pasar el mouse ves cuánto es y qué parte de las ventas.",
      "Con el botón de tabla ves lo mismo en números. «Año por año» compara cada año desde 2018.",
      "Antes del 12 de octubre de 2026 los números salen de las hojas: ventas y compras como se registraron ahí. Cada compra cuenta por lo que se compró si su XML está cargado en «Facturas anteriores» y su clave del SAT lo dice; si no, por la categoría de su proveedor.",
      "Lo que la hoja tenía en «Sin efectos» u otra categoría que no es gasto se queda fuera aunque su XML diga otra cosa.",
      "Desde el 12 de octubre de 2026 los números salen del ERP, donde una factura ligada a su orden de compra cuenta por sus partidas: los consumibles del taller como gasto de fabricación y el material en lo vendido.",
      "Los números con ≈ son estimados: lo vendido de la hoja no tiene costeo y la nómina de la hoja se reparte entre taller y oficina con la proporción de hoy. La tabla de abajo dice de dónde sale cada número, y lo que no es gasto (retiros de socios, préstamos, compra de activos) se enseña aparte sin restarse.",
      "Mercado Libre sale de Mercado Pago venta por venta desde fines de octubre de 2025 (Mercado Libre no da ventas más viejas): lo que pagó el comprador cuenta como venta y lo que se quedó Mercado Libre (su comisión, el envío que pagamos y otros cargos) como gasto.",
      "La hoja solo anotaba como venta las que se facturaban y nunca anotó esos cargos, porque Mercado Libre los descuenta antes de depositar; por eso, desde esa fecha, sus renglones de Mercado Libre ya no cuentan. Antes de esa fecha, las ventas de Mercado Libre son las de la hoja y sus cargos salen en $0.",
      "Las comisiones de los vendedores van en el mes de las ventas que las generaron, aunque se hayan pagado después. Antes del arranque, las que se registraron como pagadas en Comisiones (en un mes sin ninguna registrada, las que anotó la hoja); desde el arranque, lo que da la regla de cada vendedor.",
      "En «Categorías de compra» decides cómo cuenta cada categoría: material, gasto de fabricación, gasto de operación, nómina, impuestos, intereses o «no es gasto». Finanzas la cambia; el cambio se ve en todos los periodos.",
    ],
  },
};

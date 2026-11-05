import type { AyudaPantalla } from "./index";

export const IMPORTACIONES: Record<string, AyudaPantalla> = {
  "/importaciones": {
    resumen: "El tablero de importaciones: cada embarque en su etapa, lo urgente arriba y lo que esperamos del proveedor, el agente aduanal o la naviera.",
    pasos: [
      "Revisa «Lo que no puede esperar»: dale clic a un aviso para abrir su embarque.",
      "En las columnas, cada tarjeta dice el siguiente paso y quién lo debe; «Nos toca» es nuestro.",
      "Al volver a pedir un documento a otros, dale «Ya lo pedí» en su renglón.",
    ],
    detalle: [
      "Lo lleva importaciones; almacén y producción lo consultan para saber qué llega y cuándo. Con «Nuevo embarque» das de alta uno: basta con decir qué viene, y si ya tienes el BL, la PI, la factura o el packing list, la IA llena el alta.",
      "Arriba ves cuántos embarques van en curso y los riesgos de hoy. Si ves el dinero de importaciones, también lo que falta pagar a proveedores y lo que hay por recuperar; si no, cuántos llegan a planta en los próximos 14 días.",
      "«Lo que no puede esperar» son avisos que arma el sistema solo: rojo es riesgo y ámbar, atención. Clic en uno abre su embarque.",
      "Cada columna es una etapa: con el proveedor, en el mar, en puerto y en planta. La etapa de cada embarque la marca la última fecha real capturada, no una casilla. La barra de días libres se pone ámbar cuando faltan 3 días o menos y roja cuando se acaban.",
      "«Lo que estamos esperando de otros» junta los documentos pendientes por quién los debe, con la última vez que se pidieron. «Ya lo pedí» anota que hoy los volviste a pedir.",
      "«Tiempos por proveedor» dice cuánto tarda de verdad cada proveedor, de la orden a planta. El reabasto usa esos días en lugar del tiempo capturado a mano. Si ves dinero, la pestaña Dinero junta pagos y saldos de todos los embarques.",
    ],
  },
  "/importaciones/dinero": {
    resumen: "El dinero de las importaciones: qué se les debe a los proveedores del extranjero, qué pagos vienen y qué nos tienen que regresar.",
    pasos: [
      "En «Pagos en dólares que vienen», revisa los próximos pagos; la fecha en rojo ya pasó.",
      "En «Dinero por recuperar», reclama los saldos y garantías en rojo: ya pasaron de su fecha.",
    ],
    detalle: [
      "Lo ven importaciones, compras y finanzas. Si tu puesto no ve el dinero de importaciones, esta pestaña no aparece y te quedas en Embarques.",
      "Arriba: lo que falta pagar a proveedores, lo programado en los próximos 30 días y lo que hay por recuperar. No hay cuenta en dólares: todo sale de pesos o por EBANX.",
      "«Pagos en dólares que vienen» lista cada orden ligada a un embarque con lo pagado, lo que falta y su próximo pago; la fecha en rojo ya pasó. Lo que sigue en producción no tiene fecha hasta que el proveedor avisa que está listo. Los pesos son aproximados al tipo de cambio de hoy.",
      "«Dinero por recuperar» son los saldos a favor con el agente aduanal y las garantías de contenedor que nadie ha marcado como recuperados; en rojo los que ya pasaron de su fecha. Se marcan con «Recuperado» en la pestaña Dinero de cada embarque.",
      "«Por embarque» resume mercancía, lo pagado con su tipo de cambio real, gastos e impuestos, el IVA acreditable aparte y lo que falta recuperar. «Pagos en dólares que vienen» y «Por embarque» se bajan a Excel con el botón CSV.",
    ],
  },
  "/importaciones/:id": {
    resumen: "La ficha de un embarque: dónde va, qué sigue y quién lo debe, con sus fechas por etapa, sus documentos y las órdenes de compra que trae.",
    pasos: [
      "Revisa arriba el siguiente paso, quién lo debe, la llegada y los días libres.",
      "En Etapas, captura la fecha real de cada paso y dale Enter para guardarla.",
      "En Documentos, sube cada archivo que llegue, o usa «Leer con IA» para que llene los datos.",
    ],
    detalle: [
      "Arriba ves el siguiente paso, la llegada (ETA o fecha real, y cuándo se espera en planta) y, ya que arribó, los días libres en puerto y del contenedor. Antes del arribo, ese cuadro dice cuántos documentos están listos y cuántos pide el agente antes de que llegue.",
      "En Etapas no se aceptan fechas futuras: para eso está la ETA. Con el lápiz corriges una fecha; si el paso se registró por error (un embarque cerrado que no era), «Quitar este paso» lo borra con su motivo y deja la nota en la historia.",
      "«Cerrado» quiere decir que ya se recuperó el saldo a favor y la garantía. Para registrarlo hace falta la cuenta de gastos y que lo que había por recuperar ya esté marcado como recuperado en Dinero → Por recuperar; si no, no te deja.",
      "Documentos es la lista de lo que necesita este embarque, con quién debe cada uno. Los marcados «antes del arribo» los pide el agente aduanal antes de que llegue.",
      "«Leer con IA» lee un PDF o una foto (proforma, factura, packing list, BL, pedimento o cuenta de gastos) y te propone los datos junto al archivo. Nada se guarda hasta que lo revisas y confirmas.",
      "En Órdenes ligas las órdenes de compra que viajan en el embarque; de ellas sale lo que se le debe a cada proveedor. Las pestañas Correos y Dinero solo aparecen si ves el dinero de importaciones, y Costeo si ves costos.",
      "En Correos ligas los hilos de tu Gmail donde se lleva el embarque (con el proveedor, el forwarder, la naviera o el agente). La primera vez, «Conectar mi Gmail». «Ligar hilo» busca en tu Gmail como lo harías allá: por BL, referencia del agente o proveedor.",
      "El ERP guarda cada correo sin lo citado de los anteriores, así que lo ve cualquiera que vea esta pestaña aunque no sea su Gmail. «Traer lo nuevo» lo pone al día y solo lo puede hacer quien ligó el hilo. Como los correos traen montos, solo la ve quien ve el dinero de importaciones.",
      "«Leer correos con IA» lee los correos del embarque y te dice en qué va: fechas de etapas que ya pasaron, ETA, datos como BL, buque o contenedor, documentos que llegaron y lo que está pendiente y de quién. Si son demasiados, deja fuera los más viejos y te avisa cuántos. Cada punto dice de qué correo salió (dale clic para verlo).",
      "Nada cambia hasta que lo revisas: vienen todos marcados, quitas lo que no es y le das «Aplicar». Se aplica igual que si lo capturaras a mano: una fecha futura no se acepta como etapa (y entonces no se aplica nada) y un cambio de ETA queda en la historia. Los documentos que llegaron pasan a recibidos, pero el archivo se sube aparte. Los montos que menciona solo se muestran.",
    ],
  },
};

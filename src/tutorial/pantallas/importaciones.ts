import type { AyudaPantalla } from "./index";

export const IMPORTACIONES: Record<string, AyudaPantalla> = {
  "/importaciones": [
    "El tablero de las importaciones: cada embarque en su etapa, lo urgente arriba y lo que estamos esperando del proveedor, el agente aduanal o la naviera. Lo lleva importaciones; almacén y producción lo consultan para saber qué llega y cuándo.",
    "\"Lo que no puede esperar\" son avisos que arma el sistema solo: rojo es riesgo y ámbar, atención; clic en uno abre su embarque. Abajo, cada columna es una etapa (con el proveedor, en el mar, en puerto, en planta) y cada tarjeta dice el siguiente paso y quién lo debe; \"Nos toca\" es nuestro. La barra de días libres se pone ámbar a 3 días de acabarse y roja al pasarse.",
    "En \"Lo que estamos esperando de otros\" están los documentos pendientes por quién los debe, con la última vez que se pidieron; \"Ya lo pedí\" anota que hoy los volviste a pedir. La etapa de cada embarque la marca la última fecha real capturada, no una casilla.",
    "En \"Tiempos por proveedor\" ves cuánto tarda de verdad cada proveedor, de la orden a planta. El reabasto usa esos días en lugar del tiempo capturado a mano. Si ves dinero, la pestaña Dinero junta pagos y saldos de todos los embarques.",
  ],
  "/importaciones/dinero": [
    "El dinero de las importaciones: qué se les debe a los proveedores del extranjero, qué pagos vienen y qué nos tienen que regresar. Lo ven importaciones, compras y finanzas.",
    "\"Pagos en dólares que vienen\" lista cada orden ligada a un embarque con lo pagado, lo que falta y su próximo pago; la fecha en rojo ya pasó. Lo que sigue en producción no tiene fecha hasta que el proveedor avisa que está listo. Los pesos son aproximados al tipo de cambio de hoy.",
    "\"Dinero por recuperar\" son los saldos a favor con el agente aduanal y las garantías de contenedor; en rojo los que ya pasaron de su fecha. \"Por embarque\" resume mercancía, lo pagado con su tipo de cambio real, gastos e impuestos, el IVA acreditable aparte y lo que falta recuperar. Todo se baja a Excel.",
  ],
  "/importaciones/:id": [
    "La ficha de un embarque: dónde va, qué sigue y quién lo debe, con sus fechas por etapa, sus documentos y las órdenes de compra que trae.",
    "Arriba ves el siguiente paso, la llegada (ETA o fecha real, y cuándo se espera en planta) y, ya que arribó, los días libres en puerto y del contenedor. En Etapas se captura la fecha real de cada paso (Enter guarda; no acepta fechas futuras, para eso está la ETA). Con el lápiz corriges la fecha o, si el paso se registró por error (un embarque cerrado que no era), «Quitar este paso» lo borra con su motivo y deja la nota en la historia. «Cerrado» quiere decir que ya se recuperó el saldo a favor y la garantía: antes de cerrarlo, márcalos como recuperados en Dinero → Por recuperar, o no te deja. Documentos es la lista de lo que necesita este embarque, con quién debe cada uno; los marcados \"antes del arribo\" los pide el agente aduanal antes de que llegue.",
    "\"Leer con IA\" lee un PDF o una foto (proforma, factura, packing list, BL, pedimento, cuenta de gastos) y te propone los datos junto al archivo; nada se guarda hasta que lo revisas y confirmas. Las pestañas de dinero y costeo solo aparecen si tu puesto las ve.",
    "En Correos ligas los hilos de tu Gmail donde se lleva el embarque (con el proveedor, el forwarder, la naviera o el agente): «Ligar hilo» busca en tu Gmail como lo harías allá, por BL, referencia del agente o proveedor. El ERP guarda cada correo sin lo citado de los anteriores, así que lo ve cualquiera de importaciones aunque no sea su Gmail; «Traer lo nuevo» lo pone al día y solo lo puede hacer quien ligó el hilo. Como los correos traen montos, esta pestaña solo la ve quien ve el dinero de importaciones.",
    "«Leer con IA», en Correos, lee todos los correos del embarque y te dice en qué va: fechas de etapas que ya pasaron, ETA, datos como BL, buque o contenedor, documentos que llegaron y lo que está pendiente y de quién. Cada punto dice de qué correo salió (dale clic para verlo). Nada cambia hasta que lo revisas: vienen todos marcados, quitas lo que no es y le das «Aplicar»; se aplica igual que si lo capturaras a mano (una fecha futura no entra como etapa y un cambio de ETA queda en la historia). Los montos que menciona solo se muestran.",
  ],
};

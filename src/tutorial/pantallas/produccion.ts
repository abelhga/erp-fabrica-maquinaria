import type { AyudaPantalla } from "./index";

export const PRODUCCION: Record<string, AyudaPantalla> = {
  "/produccion/gerencia": [
    "El tablero de producción: todas las órdenes abiertas por estado, qué está atrasado, qué no tiene material y cuánto trabajo tiene cada área. Lo consulta todo el que ve producción (mantenimiento, almacén, ingeniería y los vendedores, para ver cómo van sus equipos); los botones de cada tarjeta solo los ve la gerencia de producción.",
    "Las columnas van de Planeada (validando material) a Liberada (lista para el taller), En proceso y Terminada (por entregar); en cada una, lo urgente y lo atrasado va arriba. Los indicadores de arriba filtran el tablero al darles clic, y también puedes buscar por folio, serie, equipo o cliente, o filtrar por cliente o etapa.",
    "En cada tarjeta: el avance (el personal de planta, almacén, ingeniería y compras ven también las horas), la fecha compromiso en verde, ámbar (3 días o menos) o rojo (ya pasó) y los faltantes de material, en rojo si alguno no se ha pedido a compras. La gerencia libera, sube o baja la prioridad y cambia la fecha desde la tarjeta; una orden no se libera sin la revisión de ingeniería.",
    "Una orden con la insignia \"En espera\" (cliente ausente, por ejemplo) no cuenta en los atrasos ni en la carga hasta que se reactive desde su detalle. Abajo, \"Carga del taller\" dice cuántas semanas de trabajo tiene cada etapa contra lo que puede trabajar por semana, y \"Actividad reciente\" muestra en vivo lo que marcan el taller, almacén e ingeniería; clic en una línea abre su orden.",
  ],
  "/produccion/pedidos": [
    "Los pedidos vistos desde la planta: qué se vendió, a quién, para cuándo y cómo va cada equipo en el taller. No trae montos. La usan la gerencia de producción, los supervisores y almacén.",
    "«Activos» son los confirmados, en producción y listos para entregar; «Sin orden», los que tienen equipos que nadie está fabricando todavía. Dale clic a un pedido para ver sus partidas y las órdenes de cada una, con su avance; el folio de la orden te lleva a su detalle.",
    "La gerencia crea desde aquí las órdenes que faltan. Si hay un equipo igual hecho (o en proceso) para stock, sale «Usar OP-…»: se asigna al pedido y ya no se fabrica otro. Así se reemplaza la «S-» de la hoja.",
  ],
  "/produccion/seriales": [
    "Aquí está cada equipo que hemos hecho con su número de serie: los del libro de seriales de la hoja (desde 2015) y los que numera el ERP. Sirve para saber de quién es un equipo, de qué pedido y factura, y qué tiene cada cliente. La usan producción, servicio y ventas.",
    "Busca por serie, cliente, equipo, pedido o factura; filtra por familia o por lo que sigue en taller. Clic en un renglón abre su ficha, con la orden de producción y los servicios que ha tenido.",
    "El número de serie ya no se escribe a mano: al crear la orden de producción de un equipo, el ERP arma su código y le pone el siguiente número de su familia, sin repetir ni saltar. Para eso cada equipo necesita su código una vez, en la pestaña Códigos y tiempos por equipo; la flecha muestra el serial que saldría con el número que sigue.",
    "En esa misma pestaña van los días de fabricación de cada equipo: lo que tarda con el taller libre. Con ellos y con la fila del taller, ventas ve al cotizar cuándo sale de verdad un equipo; si un equipo no tiene días, solo cuenta la fila.",
    "Si un equipo no tenía código cuando se creó su orden, la orden queda sin serie; captura el código y asígnalo desde la orden.",
  ],
  "/produccion/terminal": [
    "La tablet de cada estación del taller: muestra lo que se trabaja en su etapa y con botones grandes se inicia, pausa, reanuda o termina cada orden, o se reporta un problema. La usan los encargados de piso.",
    "Al iniciar o reanudar, toca quiénes trabajan (primero sale la gente de esa etapa; la tablet recuerda la última cuadrilla). Si alguien no está dado de alta o es un ayudante de paso, súmalo en «Sin nombre». En cada orden en proceso, «Se une» agrega a alguien y «Sale» lo quita, sin detener la etapa. Una persona no puede estar en dos etapas a la vez.",
    "Con eso salen las horas hombre de cada etapa: el tiempo de cada persona sumado. Se ven en el detalle de la orden contra las horas estimadas del costeo. Al pausar o terminar la etapa salen todos.",
    "¿Terminaste una por error? El aviso verde trae «Deshacer» unos segundos: la etapa regresa a pausada. Tienes 15 minutos; después, pídeselo a la gerencia de producción.",
  ],
  "/produccion/ordenes": [
    "La lista de todas las órdenes de producción con su material: qué está apartado, qué falta y si ya se pidió a compras. La usan la gerencia, almacén e ingeniería para preparar cada orden antes de que entre al taller.",
    "Filtra por estado, atrasadas o con faltantes; el buscador encuentra folio, serie, equipo, cliente o pedido. Clic en un renglón abre la orden. Los renglones en rojo están atrasados; \"En espera\" en lugar de la fecha quiere decir que la orden está detenida (pasa el mouse para ver por qué). Debajo del material van tres palomitas: Ing. (ingeniería revisó la lista), Apartado (se apartó el material) y Alm. (almacén revisó la existencia física).",
    "\"Crear órdenes desde pedido\" muestra los pedidos confirmados que todavía tienen equipos por producir (el número del botón) y \"Orden para stock\" crea una sin cliente. Cada orden copia la lista de materiales del equipo al crearse, así un cambio posterior al catálogo no la mueve. Cada orden de un equipo saca su número de serie sola, si el equipo ya tiene código.",
  ],
  "/produccion/ordenes/:id": [
    "Todo lo de una orden de producción en una pantalla: para quién es, su compromiso y avance, el material, las etapas del taller y quién hizo qué y cuándo. Ventas y quien solo sigue el avance ven el compromiso, las etapas y la historia; el material, los planos y las horas son de planta, almacén, ingeniería y compras.",
    "\"Validación de material\" son los cinco pasos antes del taller, en orden: ingeniería revisa la lista, se aparta el material, se piden los faltantes a compras, almacén revisa la existencia física y la gerencia la libera. Cada paso guarda quién y cuándo, y cada quien ve el botón del suyo. Sin la revisión de ingeniería no se puede liberar.",
    "En Material, Falta es lo requerido que todavía no está surtido ni apartado; Pedido es lo que ya se pidió a compras para esta orden; Disponible es lo que hay en planta sin apartar para nadie. Almacén entrega con el botón Surtir y no puede llevarse lo apartado para otra orden.",
    "En Etapas, el taller inicia, pausa, reanuda y termina cada una; el avance sale de las horas de las etapas terminadas. Si una se terminó por error, el aviso trae «Deshacer» (15 minutos para quien la terminó) y la gerencia tiene «Reabrir» en la etapa, con el motivo: regresa a pausada. Si algo de la lista está mal, usa \"Solicitar cambio a ingeniería\": queda en la orden y en la línea de tiempo.",
    "Si el equipo se detiene sin cancelarse (el cliente dejó anticipo y no ha regresado), la gerencia usa \"Poner en espera\" con el motivo: deja de contar en la carga del taller y en los tiempos de entrega, no sale atrasada y la terminal no la muestra. \"Reactivar\" la regresa tal como estaba.",
  ],
};

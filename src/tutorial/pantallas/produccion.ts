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
  "/produccion/cuadrillas": [
    "El taller por etapas con la gente adentro: quién trabaja qué ahorita, qué está pausado y qué sigue en cada etapa. No es otra captura: lo que se marca en la terminal de piso sale aquí al momento, y lo que se mueve aquí lo ve la terminal. La usan la gerencia de producción y los supervisores.",
    "Arriba está el personal por área; en verde quien está trabajando. Hay dos vistas. «Por etapa»: una columna por área con lo que está trabajando (con quien tiene su tiempo contando), lo pausado y lo que ya puede empezar; lo que todavía está en una etapa anterior se junta cerrado en «Más adelante», para no repetir la misma orden en todas las columnas. «Por cuadrilla»: una columna por cuadrilla con lo que trabaja ahorita y lo que le sigue, como el tablero de Luis, y al final «Sin cuadrilla» con lo que nadie tiene asignado. En las dos, quien está planeado sale en línea punteada.",
    "La gerencia de producción arrastra a una persona a una tarjeta para meterla a esa cuadrilla, de una tarjeta a otra para moverla, o de regreso al personal para sacarla. Si con eso alguien deja de trabajar o empieza en una etapa en proceso, primero pregunta: su tiempo se cierra o empieza a contar en ese momento, así las horas de cada quien son las de verdad. Lo que no ha empezado solo queda planeado.",
    "«Personal de piso» (arriba, para la gerencia) es la gente de Producción: ahí le cambias el área y decides si entra a cuadrillas. Solo quien entra sale aquí y en la terminal; un coordinador o un ayudante de almacén quizá no. Altas, bajas y cambios de departamento siguen siendo de Recursos Humanos.",
    "La cola se acomoda arrastrando una tarjeta sobre otra. Clic en una tarjeta abre su detalle con lo mismo en botones (agregar, sacar, antes y después). Iniciar, pausar y terminar se sigue marcando en la terminal.",
    "Las horas que faltan y las que tiene encima cada persona salen de las horas estimadas menos las ya trabajadas, repartidas entre la cuadrilla. Son para darse idea, no una promesa.",
  ],
  "/produccion/metricas": [
    "Los números de la planta para mejorar el proceso (lean): si entregamos a tiempo, cuánto tarda un equipo, qué parte de ese tiempo se trabaja de verdad, dónde se espera, cuántas horas se van contra lo estimado y cómo andan las máquinas. La usan ingeniería de procesos, la gerencia de producción y dirección.",
    "Arriba eliges el periodo (30 días a 12 meses). Lo primero que ves, si hace falta, es cuánto se marcó en la terminal: las horas, los tiempos y la eficiencia del flujo salen solo de las etapas que el piso marcó con quién las trabajó. Las entregas a tiempo y los equipos terminados no dependen de eso.",
    "«Por etapa» dice dónde se va el tiempo: cuánto espera cada área para empezar, cuánto se trabaja, las horas reales contra las del costeo, las pausas, los problemas y las etapas reabiertas. «Por equipo» compara las horas de cada modelo y «Por persona» las horas hombre de cada quien. Todas se descargan en CSV.",
    "Quien además ve costos tiene la mano de obra real contra la estimada a la tarifa de cada oficio: la diferencia en rojo es lo que costó tardarse de más. Las herramientas lean (5S, kaizen, A3, OEE, SMED) se irán habilitando conforme el equipo las use.",
  ],
  "/produccion/seriales": [
    "Aquí está cada equipo que hemos hecho con su número de serie: los del libro de seriales de la hoja (desde 2015) y los que numera el ERP. Sirve para saber de quién es un equipo, de qué pedido y factura, y qué tiene cada cliente. La usan producción, servicio y ventas.",
    "Busca por serie, cliente, equipo, pedido o factura; filtra por familia o por lo que sigue en taller. Clic en un renglón abre su ficha, con la orden de producción y los servicios que ha tenido.",
    "El número de serie ya no se escribe a mano: al crear la orden de producción de un equipo, el ERP arma su código y le pone el siguiente número de su familia, sin repetir ni saltar. Para eso cada equipo necesita su código una vez, en la pestaña Códigos y tiempos por equipo; la flecha muestra el serial que saldría con el número que sigue.",
    "En esa misma pestaña van los días de fabricación de cada equipo: lo que tarda con el taller libre. Con ellos y con la fila del taller, ventas ve al cotizar cuándo sale de verdad un equipo; si un equipo no tiene días, solo cuenta la fila.",
    "Si un equipo no tenía código cuando se creó su orden, la orden queda sin serie; captura el código y asígnalo desde la orden.",
  ],
  "/produccion/terminal": [
    "La tablet de cada estación del taller: muestra lo que se trabaja en su etapa, en el orden de la cola que acomoda la gerencia en Cuadrillas, y con botones grandes se inicia, pausa, reanuda o termina cada orden, o se reporta un problema. La usan los encargados de piso.",
    "Al iniciar o reanudar, toca quiénes trabajan: vienen marcados los que planeó la gerencia en Cuadrillas (en lo que no ha empezado dice «Le toca»); si no hay, la última cuadrilla de esa tablet. Primero sale la gente de esa etapa. Si alguien no está dado de alta o es un ayudante de paso, súmalo en «Sin nombre». En cada orden en proceso, «Se une» agrega a alguien y «Sale» lo quita, sin detener la etapa. Una persona no puede estar en dos etapas a la vez.",
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

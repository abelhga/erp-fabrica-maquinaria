import type { AyudaPantalla } from "./index";

export const PRODUCCION: Record<string, AyudaPantalla> = {
  "/produccion/gerencia": [
    "El tablero de la gerencia de producción: todas las órdenes abiertas por estado, qué está atrasado, qué no tiene material y cuánto trabajo tiene cada área. Los vendedores también lo consultan para ver cómo van sus equipos; los botones de cada tarjeta solo los ve la gerencia.",
    "Las columnas van de Planeada (validando material) a Liberada (lista para el taller), En proceso y Terminada (por entregar); en cada una, lo urgente y lo atrasado va arriba. Los indicadores de arriba filtran el tablero al darles clic, y también puedes buscar por folio, serie, equipo o cliente, o filtrar por cliente o etapa.",
    "En cada tarjeta: el avance (horas terminadas contra las estimadas), la fecha compromiso en verde, ámbar (3 días o menos) o rojo (ya pasó) y los faltantes de material, en rojo si alguno no se ha pedido a compras. La gerencia libera, sube o baja la prioridad y cambia la fecha desde la tarjeta; una orden no se libera sin la revisión de ingeniería.",
    "Abajo, \"Carga del taller\" dice cuántas semanas de trabajo tiene cada etapa contra lo que puede trabajar por semana, y \"Actividad reciente\" muestra en vivo lo que marcan el taller, almacén e ingeniería; clic en una línea abre su orden.",
  ],
  "/produccion/ordenes": [
    "La lista de todas las órdenes de producción con su material: qué está apartado, qué falta y si ya se pidió a compras. La usan la gerencia, almacén e ingeniería para preparar cada orden antes de que entre al taller.",
    "Filtra por estado, atrasadas o con faltantes; el buscador encuentra folio, serie, equipo, cliente o pedido. Clic en un renglón abre la orden. Los renglones en rojo están atrasados. Debajo del material van tres palomitas: Ing. (ingeniería revisó la lista), Apartado (se apartó el material) y Alm. (almacén revisó la existencia física).",
    "\"Crear órdenes desde pedido\" muestra los pedidos confirmados que todavía tienen equipos por producir (el número del botón) y \"Orden para stock\" crea una sin cliente. Cada orden copia la lista de materiales del equipo al crearse, así un cambio posterior al catálogo no la mueve.",
  ],
  "/produccion/ordenes/:id": [
    "Todo lo de una orden de producción en una pantalla: para quién es, su compromiso y avance, el material, las etapas del taller y quién hizo qué y cuándo.",
    "\"Validación de material\" son los cinco pasos antes del taller, en orden: ingeniería revisa la lista, se aparta el material, se piden los faltantes a compras, almacén revisa la existencia física y la gerencia la libera. Cada paso guarda quién y cuándo, y cada quien ve el botón del suyo. Sin la revisión de ingeniería no se puede liberar.",
    "En Material, Falta es lo requerido que todavía no está surtido ni apartado; Pedido es lo que ya se pidió a compras para esta orden; Disponible es lo que hay en planta sin apartar para nadie. Almacén entrega con el botón Surtir y no puede llevarse lo apartado para otra orden.",
    "En Etapas, el taller inicia, pausa, reanuda y termina cada una; el avance sale de las horas de las etapas terminadas. Si algo de la lista está mal, usa \"Solicitar cambio a ingeniería\": queda en la orden y en la línea de tiempo.",
  ],
};

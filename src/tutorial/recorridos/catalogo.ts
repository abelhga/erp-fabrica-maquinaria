import type { Modulo } from "@/lib/sesion";

/**
 * Recorridos guiados: misiones cortas por puesto que se hacen en las pantallas de verdad. Cada paso
 * ilumina una cosa y espera a que la persona haga algo (un clic, llegar a una pantalla, escribir) o
 * a que le dé «Siguiente». Ningún paso pide guardar: lo que tiene consecuencias se enseña y se
 * deja para cuando sea de verdad (para practicar con datos de mentira hace falta el ambiente de
 * práctica, que es aparte).
 *
 * El objetivo se busca por el texto que se ve (o un selector), no por marcas en el código: así un
 * recorrido no obliga a tocar la pantalla, y si el texto cambia el paso lo dice en vez de romperse.
 */
export interface Objetivo {
  /** Texto visible (o placeholder / aria-label) del elemento; gana el más chico que lo contiene. */
  texto?: string;
  /** Selector CSS cuando no hay texto (un botón de solo ícono). */
  css?: string;
}
export interface PasoRecorrido {
  /** Si la persona no está ahí, el recorrido la lleva. */
  ruta?: string;
  objetivo?: Objetivo;
  titulo: string;
  texto: string;
  /** «clic» avanza al tocar lo iluminado; «ruta» al llegar a `rutaEsperada`; «escribir» al teclear algo. Sin esto, «Siguiente». */
  avanza?: "clic" | "ruta" | "escribir";
  rutaEsperada?: string;
}
export interface Recorrido {
  id: string;
  titulo: string;
  descripcion: string;
  minutos: number;
  /** Lo que hay que poder ver para que el recorrido le salga a alguien. Sin esto, es para todos. */
  para?: { modulo: Modulo; nivel?: number };
  pasos: PasoRecorrido[];
}

export const RECORRIDOS: Recorrido[] = [
  {
    id: "conoce-el-erp", titulo: "Conoce el ERP", minutos: 2,
    descripcion: "El buscador, tus avisos, las explicaciones y la IA: lo que vas a usar todos los días.",
    pasos: [
      { titulo: "Bienvenido", texto: "En dos minutos te enseño lo básico. Cada paso ilumina algo; puedes salir cuando quieras y retomarlo después." },
      { objetivo: { texto: "Buscar cliente, equipo" }, titulo: "Encuentra lo que sea",
        texto: "Escribe un cliente, un folio, un equipo o una clave y llegas directo. Desde cualquier pantalla también abre con Ctrl K." },
      { objetivo: { css: "[aria-label^='Avisos']" }, titulo: "Tus avisos",
        texto: "Aquí te llega lo que te toca: un pedido nuevo, una autorización, algo por revisar. El número rojo es lo que no has visto." },
      { objetivo: { css: "[data-recorrido='aprende']" }, titulo: "Aprende sin preguntar",
        texto: "El birrete prende las explicaciones: arriba de cada pantalla sale para qué sirve, y todo lo marcado con ? se explica al pasar el mouse o tocarlo." },
      { objetivo: { css: "[aria-label^='Abrir asistente']" }, titulo: "Pregúntale al ERP",
        texto: "La IA contesta con los datos que tu puesto ya puede ver. Pruébalo después con «¿qué tengo pendiente hoy?»." },
      { ruta: "/pendientes", objetivo: { css: "main h1" }, titulo: "Tus pendientes",
        texto: "Lo que te asignaron, con su fecha. Cuando lo cumples lo marcas; si se vence, se pone en rojo. Listo: ya conoces lo básico." },
    ],
  },
  {
    id: "arma-una-cotizacion", titulo: "Arma una cotización", minutos: 3, para: { modulo: "ventas", nivel: 2 },
    descripcion: "De cero a una cotización lista para enviar: cliente, partidas, tiempo de entrega.",
    pasos: [
      { ruta: "/ventas/cotizaciones", objetivo: { texto: "Nueva cotización" }, avanza: "clic", titulo: "Empieza aquí",
        texto: "Dale clic a «Nueva cotización». Se abre un borrador a tu nombre; si solo estás practicando, al final te enseño a borrarlo." },
      { objetivo: { texto: "Elegir cliente" }, titulo: "Primero el cliente",
        texto: "Escribe su nombre, razón social o RFC. Si es nuevo, ahí mismo lo das de alta. Lo que captures queda como borrador a tu nombre: al cliente no le llega nada hasta que la envías." },
      { objetivo: { css: "input[placeholder^='Agregar partida']" }, titulo: "Las partidas",
        texto: "Escribe un equipo, componente o clave y Enter. El precio sale de la lista; si lo bajas del mínimo, la cotización pide autorización antes de enviarse." },
      { objetivo: { texto: "Tiempo de entrega" }, titulo: "El tiempo de entrega",
        texto: "Sin él no se puede enviar. Si todavía no sabes el plazo, usa el atajo «Se confirma al recibir el anticipo»." },
      { objetivo: { texto: "Enviar" }, titulo: "Enviar",
        texto: "Cuando esté lista (con cliente, partidas y tiempo de entrega), «Enviar» la da por enviada. Si sacas una versión nueva, te pregunta si la anterior sigue vigente." },
      { objetivo: { css: "[aria-label='Más acciones']" }, titulo: "Más acciones",
        texto: "Aquí están la vista previa, el PDF y compartir por WhatsApp o correo. Si solo estabas practicando, aquí mismo está «Eliminar borrador»." },
    ],
  },
  {
    id: "tu-seguimiento", titulo: "Tu seguimiento del día", minutos: 3, para: { modulo: "ventas", nivel: 2 },
    descripcion: "A quién llamar hoy, cómo va cada oportunidad y qué leads no has atendido.",
    pasos: [
      { ruta: "/ventas/para-llamar", objetivo: { css: "button[data-explain-title='Cotización por vencer']" }, titulo: "Empieza por lo que se enfría",
        texto: "Cada tarjeta de arriba es un motivo para buscar al cliente. «Cotización por vencer» son cotizaciones que vencen en 7 días o vencieron hace poco: llama antes de que se enfríen." },
      { objetivo: { css: "button[data-explain-title='En seguimiento']" }, titulo: "Lo que ya empezaste",
        texto: "Aquí están los clientes a los que alguien ya les escribió o llamó. Cada uno dice qué sigue: llamar al día 3, último mensaje al día 10. Lo que toca hoy sale en ámbar." },
      { objetivo: { texto: "Redactar mensaje" }, titulo: "El mensaje te lo escribe la IA",
        texto: "Lo arma con el historial de compras del cliente; tú lo revisas y lo mandas. Al volver de WhatsApp o del teléfono, la tarjeta te pregunta «¿Sí le escribiste?» para anotar el intento." },
      { ruta: "/ventas/oportunidades", objetivo: { texto: "Tablero" }, titulo: "Tus oportunidades",
        texto: "Cada venta en su etapa: Prospecto, Contactado, Cotizado, Negociación y cierre. Enviar una cotización la pasa sola a Cotizado; convertirla en pedido, a Ganada." },
      { objetivo: { texto: "Negociación" }, titulo: "Lo que está atorado",
        texto: "Mueves una tarjeta arrastrándola. Para pasarla a Negociación te pide anotar qué pasó. Más de 14 días en la misma etapa se pinta en ámbar, y una tarea vencida, en rojo." },
      { ruta: "/ventas/leads", objetivo: { texto: "Sin contactar" }, titulo: "Leads sin atender",
        texto: "Los leads que ya son tuyos y a los que no les has escrito ni llamado. Ábrelo, anota cada intento y, cuando te conteste, vuélvelo oportunidad." },
    ],
  },
  {
    id: "compras-del-dia", titulo: "Compras: qué pedir y qué falta que llegue", minutos: 3, para: { modulo: "compras", nivel: 2 },
    descripcion: "Requisiciones, órdenes atrasadas y el reabasto que arma las órdenes por ti.",
    pasos: [
      { ruta: "/compras/ordenes", objetivo: { texto: "Requisiciones" }, titulo: "Lo que te piden",
        texto: "Los faltantes de las órdenes de producción y lo que almacén pide desde el reabasto. Eliges partidas y se vuelven órdenes en borrador, una por proveedor." },
      { objetivo: { texto: "Atrasadas" }, titulo: "Lo que ya debió llegar",
        texto: "Órdenes enviadas o recibidas en parte que ya pasaron su fecha de entrega. Llámale al proveedor, o mueve la fecha si ya te dio otra." },
      { objetivo: { texto: "Nueva orden" }, titulo: "Una orden a mano",
        texto: "Eliges al proveedor o subes su cotización y la IA la lee. Queda en borrador: el proveedor no la tiene hasta que la envías." },
      { ruta: "/almacen/reabasto", objetivo: { texto: "A ordenar" }, titulo: "El reabasto",
        texto: "Lo que quedó abajo de su punto de reorden: la demanda de los días que tarda en llegar más el stock de seguridad." },
      { objetivo: { texto: "Sugerido" }, titulo: "Cuánto pedir",
        texto: "El lote más lo que falta para llegar al punto de reorden, redondeado al empaque del proveedor. Si ya está en un borrador o en una requisición, te avisa." },
      { objetivo: { css: "input[aria-label='Elegir todos los que hay que pedir']" }, titulo: "De aquí salen las órdenes",
        texto: "Marca lo que quieres pedir y aparece «Generar órdenes de compra»: crea borradores, uno por proveedor, para que revises precios y fechas antes de enviarlos." },
    ],
  },
  {
    id: "almacen-del-dia", titulo: "Salidas, ajustes y conteos", minutos: 3, para: { modulo: "inventario", nivel: 3 },
    descripcion: "Registra una salida sin errores, corrige con un ajuste y cuenta a ciegas.",
    pasos: [
      { ruta: "/almacen/movimientos", objetivo: { css: "[aria-label='Tipo de movimiento']" }, titulo: "Qué vas a registrar",
        texto: "Salida, devolución o traspaso entre almacenes. Lo que llega de compras entra al recibir la orden, y lo que va a una orden de producción sale al surtirla desde la orden." },
      { objetivo: { texto: "Nombre o clave: chumacera 1" }, titulo: "El artículo",
        texto: "Escribe el nombre o la clave. Te enseña cuánto hay en cada almacén para que elijas de cuál sale; la base no deja sacar más de lo que hay." },
      { objetivo: { texto: "pide un ajuste" }, titulo: "Si te equivocas",
        texto: "Un movimiento no se edita ni se borra. Una salida o un traspaso tuyo lo deshaces aquí mismo en los primeros minutos, con el motivo (este aviso te dice cuántos). Después, pide un ajuste y lo autoriza otra persona." },
      { objetivo: { texto: "Conteos físicos" }, avanza: "clic", titulo: "Los conteos",
        texto: "Dale clic: aquí abres un conteo por almacén y capturas lo que hay en cada estante." },
      { objetivo: { texto: "A ciegas" }, titulo: "Cuenta a ciegas",
        texto: "Viene marcado: quien cuenta no ve lo que dice el sistema hasta capturar lo contado. Así el número esperado no contagia el conteo." },
      { objetivo: { css: "select[aria-label='Qué contar']" }, titulo: "Qué entra en la lista",
        texto: "Lo que piden las órdenes de producción, lo que salió en los últimos 30 días, claves que pegues o todo el almacén. La existencia no cambia hasta que se autoriza cada ajuste del conteo." },
    ],
  },
  {
    // Nivel 2: producción nivel 1 lo tienen los vendedores, y esto es para el personal de producción.
    id: "taller-de-un-vistazo", titulo: "El taller de un vistazo", minutos: 3, para: { modulo: "produccion", nivel: 2 },
    descripcion: "En qué va cada orden, qué material falta, qué va tarde y quién trabaja qué.",
    pasos: [
      { ruta: "/produccion/gerencia", objetivo: { texto: "Planeada" }, titulo: "Las cuatro columnas",
        texto: "Cada orden pasa por Planeada (se valida el material), Liberada (lista para el taller), En proceso (alguna etapa empezó) y Terminada (por entregar)." },
      { objetivo: { texto: "Con faltantes de material" }, titulo: "Lo que falta",
        texto: "Órdenes que necesitan algo que no está ni surtido ni apartado. En ámbar si todo ya se pidió a compras; en rojo si algo nadie lo ha pedido. Clic para verlas." },
      { ruta: "/produccion/ordenes", objetivo: { texto: "Material y validación" }, titulo: "Antes de entrar al taller",
        texto: "Cinco pasos: ingeniería revisa la lista, se aparta el material, se piden los faltantes, almacén revisa y la gerencia libera. Cada uno guarda quién y cuándo." },
      { ruta: "/produccion/gantt", objetivo: { texto: "Van tarde según el plan" }, titulo: "Lo que va tarde",
        texto: "Órdenes cuyo plan termina después de su fecha compromiso. El plan lo calcula el ERP solo con la capacidad de cada área y su cuadrilla, y se recalcula con cada cambio del taller." },
      { ruta: "/produccion/cuadrillas", objetivo: { texto: "Por etapa" }, titulo: "Quién trabaja qué",
        texto: "Por etapa ves cada área con lo que se trabaja, lo pausado y lo que ya puede empezar; por cuadrilla, lo que trae cada quien y lo que le sigue." },
      { objetivo: { css: "main [data-explain-title='Terminal de piso']" }, titulo: "Donde se marca",
        texto: "Iniciar, pausar y terminar se marca en la terminal de piso, con quién lo trabaja. Lo que se marca ahí sale aquí al momento." },
    ],
  },
  {
    id: "planea-el-taller", titulo: "Planea el taller", minutos: 3, para: { modulo: "produccion", nivel: 3 },
    descripcion: "Crea las órdenes, lee el Gantt y ajusta la gente de piso.",
    pasos: [
      { ruta: "/produccion/gerencia", objetivo: { texto: "Nueva orden" }, titulo: "Órdenes desde los pedidos",
        texto: "Te abre los pedidos confirmados con equipos sin orden: una orden por equipo, con su lista de materiales y sus horas por etapa. Para un equipo sin cliente, usa «Orden para stock» en Órdenes y material." },
      { ruta: "/produccion/gantt", objetivo: { texto: "El taller acaba lo que tiene" }, titulo: "Qué tan llena está la planta",
        texto: "El día en que el taller acabaría todo lo abierto según el plan, si no entrara nada nuevo." },
      { objetivo: { texto: "Área más cargada" }, titulo: "El cuello de botella",
        texto: "La etapa con más trabajo en fila. Es la que manda cuánto tiene que esperar un pedido nuevo." },
      { objetivo: { texto: "Por orden" }, titulo: "Cambia el orden de la fila",
        texto: "En la vista por orden arrastras una orden por su asa para subirla o bajarla. El plan se recalcula, y la cola de Cuadrillas y de la terminal queda en ese orden." },
      { ruta: "/produccion/cuadrillas", objetivo: { texto: "Personal de piso" }, titulo: "Tu gente y tu horario",
        texto: "El área y la especialidad de cada quien, si entra a cuadrillas, cómo se cuentan las horas, el horario del taller y la capacidad por área." },
    ],
  },
  {
    id: "terminal-de-piso", titulo: "Marca tu trabajo en la terminal", minutos: 2, para: { modulo: "produccion", nivel: 2 },
    descripcion: "Elige tu etapa y tu nombre, y aprende cuándo iniciar, pausar y terminar.",
    pasos: [
      { ruta: "/produccion/terminal", objetivo: { css: "main h1" }, titulo: "Tu etapa",
        texto: "Arriba dice la etapa de esta tablet. Si todavía no tiene una, elígela: se queda en esa hasta que la cambies." },
      { objetivo: { css: "header button[data-explain-title='¿Quién trabaja?']" }, titulo: "Quién marca",
        texto: "Toca aquí y elige tu nombre. Las pausas, los términos y los problemas quedan a tu nombre; la tablet lo recuerda." },
      { objetivo: { texto: "Iniciar" }, titulo: "Iniciar",
        texto: "Empieza la etapa: eliges quiénes la trabajan y desde ese momento cuentan sus horas. Tócalo solo cuando de verdad empiecen." },
      { objetivo: { texto: "Pausar" }, titulo: "Pausar",
        texto: "Cuando dejan la orden (falta material, los mueven a otra) se pausa: se cierra el tiempo de todos y la cuadrilla queda anotada para reanudar. Arriba de la lista dice si también hay que pausar al comer." },
      { objetivo: { texto: "Terminar" }, titulo: "Terminar",
        texto: "Marca la etapa como acabada y cierra el tiempo de todos. Si fue por error, el aviso trae «Deshacer» los primeros 15 minutos." },
      { objetivo: { texto: "Tengo una idea" }, titulo: "Problemas e ideas",
        texto: "«Problema» anota algo que estorba sin detener la etapa. «Tengo una idea» manda tu propuesta al tablero de Mejoras, a tu nombre." },
    ],
  },
  {
    id: "listas-de-materiales", titulo: "Equipos y listas de materiales", minutos: 3, para: { modulo: "costeo", nivel: 3 },
    descripcion: "Subensambles compartidos, equipos sin lista, parámetros y lo que producción te pide corregir.",
    pasos: [
      { ruta: "/costeo/equipos", objetivo: { texto: "Subensambles" }, titulo: "Captura una vez",
        texto: "Un subensamble agrupa piezas que siempre van juntas (cabezal motriz, tambor de cola…) y se usa en varios equipos. No se copia: si lo cambias, cambia en todos." },
      { objetivo: { texto: "Sin lista de materiales" }, titulo: "Lo que falta capturar",
        texto: "Equipos sin ningún renglón en su lista. Producción surte cada orden con la lista, así que lo que no está ahí no llega al taller." },
      { objetivo: { css: "main tbody tr" }, avanza: "ruta", rutaEsperada: "/costeo/:tipo/:id", titulo: "Abre uno",
        texto: "Dale clic a cualquiera de la lista para ver su ficha." },
      { objetivo: { texto: "Parámetros" }, titulo: "Parámetros",
        texto: "Una medida del equipo (largo, ancho…) de la que dependen algunas cantidades u horas. Así la banda de 22 m es la de 20 m con otro largo." },
      { objetivo: { texto: "Horas por etapa" }, titulo: "Horas por etapa",
        texto: "Las horas hombre de cada etapa del taller para fabricarlo. Producción planea el taller con estas mismas horas." },
      { ruta: "/costeo/equipos", objetivo: { texto: "Solicitudes de cambio" }, titulo: "Lo que te piden corregir",
        texto: "Cuando algo de la lista está mal, producción, almacén o ventas lo reportan desde la orden y te llega aquí con aviso en la campana." },
    ],
  },
  {
    id: "rrhh-del-mes", titulo: "Personal, objetivos y prenómina", minutos: 3, para: { modulo: "rrhh", nivel: 3 },
    descripcion: "Quién falta hoy, cómo se califica cada mes y qué se paga cada semana.",
    pasos: [
      { ruta: "/rrhh/empleados", objetivo: { texto: "Solicitudes por aprobar" }, titulo: "Lo que espera tu visto bueno",
        texto: "Vacaciones, permisos o faltas que alguien registró y no has aprobado. Mientras tanto no se restan del saldo ni cuentan en la prenómina." },
      { ruta: "/rrhh/objetivos", objetivo: { texto: "Evaluaciones del mes" }, titulo: "La calificación del mes",
        texto: "Al empezar el mes se arma sola la del mes que terminó. Pasa por cuatro pasos: la califica el jefe directo, la revisa Recursos Humanos, la aprueba dirección y queda aprobada." },
      { objetivo: { texto: "Plantillas por puesto" }, titulo: "Qué se le pide a cada puesto",
        texto: "Sus indicadores, el peso de cada uno (siempre suman 100) y la regla. Si cambian, se crea una versión nueva desde un mes; los meses ya calificados no cambian." },
      { objetivo: { texto: "Bases del bono" }, titulo: "Cuánto vale el bono",
        texto: "La base al 100 % por puesto y, si hace falta, por persona. Con base de $2,000 y 85 % aprobado, cobra $1,700." },
      { ruta: "/rrhh/prenomina", objetivo: { texto: "Total a pagar" }, titulo: "La prenómina de la semana",
        texto: "Va de viernes a jueves y se calcula sola con las incidencias aprobadas. Es antes de lo fiscal: ISR, IMSS y timbrado los calcula el contador." },
      { objetivo: { texto: "Cerrar semana" }, titulo: "Cerrar la semana",
        texto: "Se puede desde el viernes. Al cerrarla se congelan los renglones, se descuentan los préstamos y lo del ahorro pasa al saldo de cada quien. Un error después se corrige con otro concepto en una semana abierta." },
    ],
  },
  {
    id: "cobrar-y-pagar", titulo: "Cobrar y pagar", minutos: 2, para: { modulo: "finanzas", nivel: 3 },
    descripcion: "Quién nos debe y desde cuándo, y qué hay que pagar esta semana.",
    pasos: [
      { ruta: "/finanzas/cobranza", objetivo: { texto: "Por cobrar" }, titulo: "Lo que nos deben",
        texto: "Los pedidos con saldo más lo que ya se debía en la hoja. A la derecha, partido por antigüedad: pasando 90 días se pinta en rojo. Clic en uno para filtrar." },
      { objetivo: { texto: "Los más atrasados" }, titulo: "Por dónde empezar a llamar",
        texto: "Los 5 pedidos con saldo de más antigüedad. Clic en uno para ver sus cobros y facturas." },
      { objetivo: { texto: "Por vendedor" }, titulo: "Con quién hablar",
        texto: "Lo que deben los clientes de cada vendedor. Sirve para pedirle a cada quien que cobre lo suyo." },
      { ruta: "/finanzas/pagos", objetivo: { texto: "Agenda de pagos" }, titulo: "Lo que hay que pagar",
        texto: "Por semana: primero lo vencido y luego las próximas 4 semanas, sumado por proveedor. El vencimiento es la fecha de la factura más los días de crédito del proveedor." },
      { objetivo: { texto: "Vence en 7 días" }, titulo: "Esta semana",
        texto: "Clic y te deja solo lo que vence en los próximos 7 días, para armar el pago de la semana." },
    ],
  },
  {
    id: "embarques", titulo: "Tus embarques de importación", minutos: 2, para: { modulo: "importaciones", nivel: 2 },
    descripcion: "Los riesgos del día, en qué va cada embarque y qué estamos esperando de otros.",
    pasos: [
      { ruta: "/importaciones", objetivo: { texto: "Lo que no puede esperar" }, titulo: "Primero los riesgos",
        texto: "Documentos que faltan cerca del arribo, días libres por acabarse, cambios de ETA o cuentas de gastos que no llegan. Rojo es riesgo; ámbar, atención." },
      { objetivo: { texto: "En puerto" }, titulo: "En qué va cada uno",
        texto: "Cada embarque en su columna: con el proveedor, en el mar, en puerto y en planta. En puerto los días libres corren." },
      { objetivo: { texto: "Lo que estamos esperando de otros" }, titulo: "Lo que debemos pedir",
        texto: "Los documentos pendientes por quién los debe (proveedor, agente, naviera…), con la última vez que se pidieron." },
      { objetivo: { texto: "Tiempos por proveedor" }, titulo: "Cuánto tarda de verdad",
        texto: "La mediana de días de cada proveedor, de la orden a planta. El reabasto usa estos días en vez del tiempo capturado a mano." },
    ],
  },
  {
    id: "leads-marketing", titulo: "Que ningún lead se quede sin atender", minutos: 2, para: { modulo: "leads", nivel: 3 },
    descripcion: "Cómo se reparten los leads, cuáles no se han contactado y en qué quedaron.",
    pasos: [
      { ruta: "/ventas/leads", objetivo: { texto: "A quién le llega" }, titulo: "El reparto",
        texto: "Bandeja (el primer vendedor que lo toma se lo queda), lo asigna la gerencia, o quien lo registra escoge. Si ya es cliente con vendedor, le llega directo a él." },
      { objetivo: { texto: "Sin contactar" }, titulo: "Asignados sin intento",
        texto: "Leads que ya tienen vendedor y a los que nadie les ha escrito ni llamado. Aquí ves los de todos los vendedores." },
      { objetivo: { texto: "Incompletos" }, titulo: "Lo que le falta al vendedor",
        texto: "Leads abiertos sin ciudad, sin empresa o sin decir qué buscan con modelo o medida. Ábrelo y complétalo ahí." },
      { objetivo: { texto: "Atendidos" }, titulo: "En qué quedaron",
        texto: "Los que ya se volvieron oportunidad o se descartaron con su motivo. Con «CSV» los bajas a Excel para revisarlos." },
    ],
  },
  {
    id: "registra-un-lead", titulo: "Atiende a quien llama", minutos: 2, para: { modulo: "leads", nivel: 2 },
    descripcion: "Encuentra el producto, registra al interesado y ve en qué quedó.",
    pasos: [
      { ruta: "/catalogo", objetivo: { texto: "Buscar por clave, nombre o descripción" }, titulo: "Lo que vendemos",
        texto: "Busca lo que te piden por nombre o clave: sale con su foto y lo que hay en planta." },
      { objetivo: { texto: "Con existencia" }, titulo: "Lo que hay ya",
        texto: "Solo lo que tiene existencia en los almacenes de planta. Lo del Full de Mercado Libre no cuenta." },
      { ruta: "/ventas/leads", objetivo: { texto: "Registrar lead" }, titulo: "Anota al interesado",
        texto: "Su nombre, un teléfono o correo y qué busca. Mientras escribes te dice si ya es cliente, y al guardarlo le llega a quien toque." },
      { objetivo: { texto: "Incompletos" }, titulo: "Que el vendedor tenga con qué",
        texto: "Un lead está completo con ciudad o estado, empresa (o «Particular») y qué busca con modelo o medida, no solo «Informes». Aquí juntas los que les falta algo." },
      { objetivo: { texto: "Los que registré" }, titulo: "En qué quedaron",
        texto: "Los que anotaste tú: quién los tomó y si ya se volvieron oportunidad." },
    ],
  },
  {
    id: "salud-del-inventario", titulo: "¿Cómo está el inventario?", minutos: 2, para: { modulo: "inventario", nivel: 2 },
    descripcion: "Qué falta, qué sobra y qué no se ha movido en un año, y cómo bajar la lista para actuar.",
    pasos: [
      { ruta: "/almacen/metricas", objetivo: { texto: "Salud del inventario hoy" }, titulo: "La foto de hoy",
        texto: "Esta barra reparte todo lo que hay en existencia según cuánto alcanza contra lo que sale: lo que falta en rojo y ámbar, lo que sobra en azul." },
      { objetivo: { texto: "Sin movimiento en 12 meses" }, avanza: "clic", titulo: "Lo que no se mueve",
        texto: "Dale clic: te trae la lista de lo que tiene existencia y no ha salido en un año." },
      { objetivo: { texto: "CSV" }, titulo: "Bájala a Excel",
        texto: "Con la lista puedes decidir con compras qué rematar, devolver o usar en otro equipo." },
      { objetivo: { texto: "Matriz ABC-XYZ" }, titulo: "Qué controlar de cerca",
        texto: "Pasa el mouse por una celda de la matriz: te dice cómo conviene controlar esos artículos (reorden fino, contra pedido o no tenerlo)." },
    ],
  },
  {
    id: "metricas-mantenimiento", titulo: "Lee tus métricas de mantenimiento", minutos: 2, para: { modulo: "mantenimiento", nivel: 1 },
    descripcion: "Qué máquinas se llevan el paro, qué carga de preventivo viene y cuáles fallan seguido.",
    pasos: [
      { ruta: "/servicio/metricas", objetivo: { texto: "Pareto de horas paradas" }, titulo: "Dónde se va el tiempo",
        texto: "Pocas máquinas suelen juntar casi todo el paro. Las de antes de la línea del 80 % son las primeras a atender. Clic en una barra abre su ficha." },
      { objetivo: { texto: "Carga de preventivo" }, titulo: "Lo que viene",
        texto: "Los preventivos de las próximas 8 semanas, proyectados de cada plan, con las horas de técnico. Úsalo para repartir antes las semanas pesadas." },
      { objetivo: { texto: "Fallas contra tiempo de reparación" }, titulo: "Crónicas y agudas",
        texto: "A la derecha las que fallan seguido (buscar la causa); arriba las que tardan en volver (refacciones, proveedor)." },
    ],
  },
  {
    id: "tu-manana", titulo: "Tu mañana en tres minutos", minutos: 3, para: { modulo: "analisis", nivel: 1 },
    descripcion: "El tablero, lo que la revisión encontró anoche y quién está usando el ERP.",
    pasos: [
      { ruta: "/", objetivo: { texto: "Cierre de año a este ritmo" }, titulo: "Cómo va el año",
        texto: "Arriba, lo que importa del negocio: a qué ritmo cierras el año, lo cotizado vivo, por cobrar, inventario y taller. Clic en uno te lleva al detalle." },
      { ruta: "/revision", objetivo: { css: "main h1" }, titulo: "Lo que encontró la revisión",
        texto: "Cada madrugada el ERP revisa lo capturado. Aquí ves lo de todos, los patrones que solo ves tú y lo que cada quien contestó." },
      { ruta: "/sistema/uso", objetivo: { css: "main h1" }, titulo: "Quién lo usa",
        texto: "Quién usa el ERP, cuánto y en qué, y cuánto cuesta la IA. Sirve para acompañar a quien se está quedando en la hoja." },
    ],
  },
];

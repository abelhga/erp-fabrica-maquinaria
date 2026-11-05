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

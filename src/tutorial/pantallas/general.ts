import type { Ayuda } from "./index";

export const GENERAL: Record<string, Ayuda> = {
  "/": {
    resumen: "Tu punto de partida del día: lo urgente de tu área y sus números. Dirección ve el centro de mando de toda la empresa; los demás, lo de su puesto.",
    pasos: [
      "Lee «Lo que importa hoy»: rojo es riesgo, ámbar pide atención, verde va bien.",
      "Dale clic a una tarjeta o a un indicador para ir directo a donde se atiende.",
    ],
    detalle: [
      "Lo que ves depende de tu puesto: ventas ve sus ventas y cotizaciones, finanzas lo que se cobra y se paga, importaciones sus embarques, producción el taller, recepción los leads que registró. Si tienes dos puestos, ves lo de los dos.",
      "«Lo que importa hoy» junta lo urgente de tu área (en morado, lo que conviene saber); el botón de flechas lo vuelve a analizar. Abajo, a almacén le sale «Por surtir»: las órdenes con material pendiente, en el orden en que el taller las va a trabajar.",
      "A los supervisores de piso les sale lo del taller y a mantenimiento lo de las máquinas: paradas, fallas sin atender, preventivos vencidos o por vencer y herramienta sin regresar. Eso lo calcula el ERP con reglas, sin IA.",
      "Casi todos los indicadores se abren con un clic y te llevan a la lista de donde salen (Ventas del mes abre los pedidos, por ejemplo). Todo se calcula con tus permisos: un vendedor ve lo suyo, no el total de la empresa.",
      "En el tablero de área, la tarjeta «Pendientes» reúne lo que espera algo de ti según tu puesto: lo que encontró la revisión de la madrugada en algo tuyo, precios por autorizar, seguimientos de cotizaciones vencidos o para hoy, tareas con clientes vencidas, ajustes de inventario, compras atrasadas o documentos de embarques que faltan.",
      "A la gerencia de ventas los seguimientos le salen de todo el equipo, con quién está frenado. Un vendedor frenado no puede enviar cotizaciones nuevas hasta ponerse al día.",
      "En el centro de mando las cifras se actualizan solas cuando alguien registra un pedido, un cobro o un avance del taller. Abajo del embudo comercial ves cómo va cada vendedor con el seguimiento de sus cotizaciones y quién está frenado.",
      "El ERP recuerda cómo dejaste las cosas, en tu computadora o celular y por persona: el orden de cada lista (la columna por la que ordenaste), «Agrupar por» en el material de una orden y la vista y el zoom del Gantt. Los filtros y las búsquedas no, para que nunca se te esconda algo sin darte cuenta.",
      "Cada lunes la IA te puede escribir hasta tres consejos con tus propios números (cómo capturas y, si vendes, qué podrías probar para cerrar más). Salen aquí, en «Tus consejos de la semana», y solo los ves tú (y dirección, que cuida lo que se dice). Dale «Me sirve» o «No me sirve»: los de la semana siguiente lo toman en cuenta.",
    ],
  },
  "/pendientes": {
    resumen: "Lo que te pidieron y lo que pediste a otros, con fecha. Reemplaza el «¿ya quedó?» por chat: al terminar, a quien lo pidió le llega un aviso.",
    pasos: [
      "En «Me tocan», dale clic al círculo para marcarlo hecho; si quieres, deja una respuesta corta.",
      "Para pedir algo nuevo usa «Pedir algo a alguien»: qué hay que hacer, quién y para cuándo.",
      "Si te falta un dato, abre el pendiente y pregúntale ahí a quien te lo pidió.",
    ],
    detalle: [
      "Al marcarlo hecho, a quien lo pidió le llega un aviso en la campana. La respuesta corta puede ser un precio o una fecha. En la ficha también lo cierras con «Ya quedó».",
      "«Los que pedí» son los que esperas de otros. Si ya no hace falta, cancélalo con la X: te pide confirmarlo y, si quieres, por qué (el motivo lo ve quien lo tenía). La flecha te lleva al pedido, orden o pantalla de donde salió.",
      "Si lo cancelaste o lo marcaste hecho por error, tienes unos minutos para regresarlo (15 de inicio; los fija dirección en Configuración): con «Deshacer» en el aviso que sale, o con «Reabrir» en «Cerrados» o en su ficha. Pasado ese tiempo, pide uno nuevo.",
      "Lo reabre solo quien lo cerró. En la conversación del pendiente queda quién lo reabrió y por qué, y si estaba hecho, a quien lo pidió le avisa.",
      "Algunos los pone la revisión nocturna (dicen «De Revisión nocturna»): son errores urgentes en algo tuyo. Márcalo hecho cuando lo corrijas; si no es error, contéstalo en «Por revisar» con «Está bien así».",
      "La fecha sale en ámbar si vence hoy y en rojo si ya venció; mientras siga vencido, el sistema les recuerda a los dos.",
      "Puedes pedirle algo a varias personas a la vez y elegir si «Basta con que uno lo haga» o si «Cada quien lo tiene que hacer».",
      "Arriba ves tu propio cumplimiento de los últimos 30 días: qué tanto cierras a tiempo, a cuántas personas tienes esperando algo tuyo, cuántos días de retraso suman tus vencidos y cuánto tardas en cerrar. Dirección y Recursos Humanos ven además la pestaña «Equipo» con el de todos.",
      "Dale clic a un pendiente para abrir su ficha. Si preguntas ahí, a quien te lo pidió le llega un aviso y, mientras contesta, el pendiente dice «Esperando a» y su nombre, y no cuenta como retraso tuyo.",
      "Si alguien te preguntó en algo que pediste, arriba sale «Te preguntaron»: contesta en su ficha.",
    ],
  },
  "/revision": {
    resumen: "Lo que la revisión de cada madrugada encontró en algo tuyo y parece error: un registro repetido, un pago doble, una compra atrasada. Contesta cada uno.",
    pasos: [
      "En «Para ti», lee el hallazgo y su evidencia; «Abrir» te lleva al registro.",
      "Si lo arreglaste, dale «Ya lo corregí»; si no es error, «Está bien así» con el porqué.",
      "Si sale «Corrígelo», el ERP hace la corrección por ti, con tus permisos.",
    ],
    detalle: [
      "Busca, por ejemplo, un artículo o un cliente dado de alta dos veces, un pago capturado dos veces, una compra que ya debió llegar y no se recibió, una compra a un precio muy distinto al de la anterior o etapas terminadas sin pasar por la terminal. Si sale algo, a las 6 de la mañana te llega un aviso.",
      "Lo urgente (un pago repetido, una compra con un cero de más, una compra muy atrasada) también te llega a Pendientes, para el siguiente día hábil: ahí se pone rojo si se vence y cuenta para tu cumplimiento. Contestarlo en cualquiera de los dos lados cierra el otro.",
      "Si no era error, «Está bien así» lo cancela en Pendientes y no cuenta para nadie. Lo que se arregla solo (una compra que por fin se recibe) se cierra sin que hagas nada.",
      "«Está bien así» pide siempre el porqué. Si dirección lo tiene prendido, la IA lo lee (salvo en una compra a un precio muy distinto al de la anterior): si es una razón de verdad (son dos sucursales, el proveedor cambió la fecha) se cierra; si suena a costumbre (dejar vacío un dato porque «todavía no se sabe»), te pregunta, hasta 3 veces.",
      "Si al final no queda claro, se queda abierto con «Lo ve dirección» y le llega con la conversación. Lo que contesta dirección no pasa por la IA.",
      "«Ayúdame a corregirlo» sale cuando la corrección es un dato de captura (fechas, tiempo de entrega, notas, contacto, categoría, cantidades de partida). La IA te propone el cambio exacto, con cómo está y cómo quedaría; puedes decirle algo que deba saber («el tiempo es de 45 días hábiles»).",
      "Nada se aplica hasta que eliges «Aplicar a mi nombre»: se hace con tus permisos, como si lo capturaras a mano, y queda en la bitácora. Precios, dinero, existencias y permisos nunca se cambian así.",
      "Lo que dice «Regla» lo encontró una regla fija; lo que dice «IA» (con destellos ✦) lo señaló la IA al leer lo de ayer. Ninguno cambia nada sin que tú lo digas. En «Contestado» ves lo que ya respondiste.",
      "Dirección abre en «Todo lo abierto», con a quién le toca cada cosa, y ve además «Patrones» (consumos que se disparan, ajustes a la baja que se repiten, gastos iguales en caja chica), que nunca le llegan a la persona.",
      "En «Anoche» dirección ve lo que la IA leyó de cada módulo, y en «Consejos», los que recibió cada quien y si les sirvieron.",
      "En «Reglas», dirección puede apagar la revisión, la IA, los consejos, que la IA cuestione el «Está bien así» o cada regla, y correr las reglas en ese momento. En «Contestado» puede ver lo que cada quien platicó con la IA.",
    ],
  },
  "/calendario": {
    resumen: "Todo lo que tiene fecha y te toca ver, en un solo lugar. Aquí no se captura nada: cada cosa sale de su pantalla.",
    pasos: [
      "Elige Mes, Semana o Lista y muévete con las flechas; «Hoy» te regresa.",
      "Toca un área para esconderla, o prende «Solo lo mío» para dejar lo tuyo.",
      "Clic en un día para verlo completo; clic en una línea para ir a su pantalla.",
    ],
    detalle: [
      "Salen entregas de pedidos, cierres de oportunidades y llamadas, compras y embarques que llegan, envíos por recolectar, compromisos del taller y cuándo termina cada orden según el plan, servicios, preventivos, herramienta por devolver, pagos, vacaciones, cumpleaños y tus pendientes.",
      "Cada quien ve lo de su puesto: un vendedor ve sus entregas y sus llamadas, no las compras; los pagos solo los ve finanzas.",
      "Lo que ya se cerró no sale; lo que ya pasó su fecha y sigue abierto sale en rojo («atrasado»). Cada área tiene siempre el mismo color.",
    ],
  },
  "/semana": {
    resumen: "Tu resumen de los lunes: la semana pasada contra la anterior y lo que viene en esta. Sirve para preparar la junta o saber cómo vamos.",
    pasos: [
      "Lee «La semana en una frase» y dale clic a una tarjeta para ir a atenderla.",
      "Revisa «Esta semana» para ver lo que tiene fecha de lunes a domingo.",
    ],
    detalle: [
      "«La semana en una frase» la narra la IA con los números (o las reglas del ERP si no está conectada); el botón de flechas la vuelve a escribir. En las tarjetas, el porcentaje compara contra la semana anterior: verde si subió, rojo si bajó.",
      "La agenda «Esta semana» sale del calendario: todo lo que tiene fecha de lunes a domingo y tu puesto puede ver (entregas, lo que llega, taller, servicios, pagos, vacaciones, tus pendientes). Lo que ya pasó su fecha y sigue abierto sale en rojo.",
      "Dale clic a un renglón para ir a su pantalla, o a «Abrir el calendario» para ver más allá de esta semana.",
      "Si eres vendedor, las ventas y «Quién compró más» son solo de tus clientes. Las ventas de esta pantalla van con IVA, como en el libro de ventas de la hoja.",
      "Esta pantalla sale en el menú de los puestos que tienen el Asistente.",
    ],
  },
};

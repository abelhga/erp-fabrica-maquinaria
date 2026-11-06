import type { AyudaPantalla } from "./index";

// Esto lo leen vendedores: nada de cómo se arma el precio, ni costos ni márgenes (es texto, pero
// filtra igual). Arriba va solo para qué sirve la pantalla y lo mínimo para usarla; los botones y
// columnas se explican en su globo (glosario de ventas). «detalle» guarda todas las reglas que
// antes eran párrafos, porque el asistente lee esto como su manual y lo que aquí falte no lo sabe.
export const VENTAS: Record<string, AyudaPantalla> = {
  "/ventas/para-llamar": {
    resumen: "Tu lista para arrancar el día: a qué clientes buscar hoy, por qué y cuánto puede valer cada uno.",
    pasos: [
      "Toca un motivo de arriba para filtrar, o busca por cliente, producto o vendedor.",
      "En la tarjeta, dale «Redactar mensaje», revísalo y ábrelo en WhatsApp o cópialo.",
      "Al volver, contesta «¿Sí le escribiste?»; cuando haya respuesta, usa «¿Cómo terminó?».",
    ],
    detalle: [
      "La usan los vendedores: cada quien ve sus clientes y los que no tienen vendedor; la gerencia de ventas ve la de todo el equipo.",
      "No aparecen los clientes que ya tienen una oportunidad abierta (ya estás en eso) ni los que tienen una cotización abierta de los últimos 45 días, salvo que esté por vencer.",
      "Los motivos de arriba son cotización por vencer (rojo), ya le toca (ámbar), refacciones (azul) y reactivar (gris). Pasa el mouse por cada uno para ver su regla.",
      "«Redactar mensaje» arma un WhatsApp o un correo con el historial del cliente: lo escribe la IA si está conectada; si no, sale una plantilla. Revísalo y ajústalo. Enviarlo lo decides tú, con «Abrir en WhatsApp» o copiándolo.",
      "«¿Sí le escribiste?» lo registra con un toque (con Deshacer) y el cliente pasa a «En seguimiento», con el siguiente paso: llamar al día 3, último mensaje al día 10 y luego esperar una semana. Así nadie del equipo le vuelve a escribir sin saberlo.",
      "«¿Cómo terminó?» cierra el intento: si le interesa se crea la oportunidad; «no por ahora» o «no contesta» lo regresan a la lista en 90 días; «ya no compra» lo saca, con la razón. Tres intentos y una semana sin respuesta cuentan solos como «no contesta».",
    ],
  },
  "/ventas/oportunidades": {
    resumen: "El embudo de ventas: cada tarjeta es una venta posible, desde que alguien pregunta hasta que se gana o se pierde.",
    pasos: [
      "Dale «Nueva oportunidad», elige el cliente y escribe qué busca.",
      "Arrastra una tarjeta a otra columna para cambiarla de etapa.",
      "Dale clic a una tarjeta para editarla, sacar una cotización o anotar qué pasó.",
    ],
    detalle: [
      "Los vendedores la usan para no soltar a nadie; la gerencia, para ver qué está atorado, y puede filtrar por vendedor.",
      "Si sueltas una tarjeta en «Perdida» te pide el motivo. A «Negociación» (y de Prospecto a Contactado) no pasa solo con arrastrar: se abre «¿Qué pasó?», escribes lo que dijo el cliente y eso la mueve.",
      "En el detalle de la derecha editas monto, probabilidad y cierre estimado, sacas una cotización y anotas qué pasó.",
      "Los días en ámbar dicen que lleva más de 14 en la misma etapa; la tarea en rojo, que ya venció. La etiqueta «Seguimiento» dice cuándo toca preguntarle al cliente qué pasó con su cotización (en rojo si ya venció); dale clic para anotarlo ahí mismo.",
      "Ganadas y perdidas se quedan 60 días en el tablero; después solo en la vista de lista, que también se descarga a CSV.",
      "No todo se mueve a mano: enviar una cotización pasa su oportunidad a «Cotizado» (y la crea si no existía) y le agenda su seguimiento a 3 días hábiles; convertirla en pedido la marca «Ganada», y rechazarla la cierra como «Perdida» si no tiene otra cotización viva.",
      "Al anotar qué pasó, «Negociando» la pasa a Negociación y «Se perdió» la cierra con su motivo.",
    ],
  },
  "/ventas/cotizado": {
    resumen: "Qué pasó con lo que cotizas: cuánto se volvió pedido, cuánto se perdió y por qué, y cuánto sigue abierto y qué le falta.",
    pasos: [
      "Elige el periodo arriba; la gerencia también puede elegir a un vendedor.",
      "Toca un bloque del diagrama o un indicador para ver abajo sus cotizaciones.",
    ],
    detalle: [
      "Cada vendedor ve lo suyo; la gerencia de ventas ve a todo el equipo.",
      "El diagrama se lee de izquierda a derecha: lo cotizado se divide en lo que se envió y lo que nunca salió, y lo enviado en ganado, perdido y abierto. El grueso de cada franja es el dinero sin IVA; con «En cotizaciones» cuenta cuántas son.",
      "Abajo, un renglón abre su cotización.",
      "Lo perdido se agrupa por el motivo que anotaste al rechazarla o al decir qué pasó: si casi todo dice «No respondió», el problema es el seguimiento, no el precio.",
      "Lo abierto se divide por lo que le falta: «Seguimiento atrasado» y «No contesta» son las que hay que llamar hoy.",
      "Cada cotización cuenta una vez aunque tenga varias versiones, con el monto de la última, y entra en el periodo por la fecha de su primera versión.",
    ],
  },
  "/ventas/cotizaciones": {
    resumen: "El registro de todas las cotizaciones con su folio y versión; aquí también das seguimiento a las enviadas y la gerencia autoriza precios.",
    pasos: [
      "Dale «Nueva cotización» para abrir el editor con una en blanco.",
      "Usa las pestañas para filtrar; clic en un renglón abre la cotización.",
      "En «Seguimiento», dale «¿Qué pasó?», escribe lo que dijo el cliente y Enter.",
    ],
    detalle: [
      "Los vendedores ven las suyas; la gerencia de ventas ve las de todo el equipo y autoriza precios.",
      "«Solo vencidas» deja las que pasaron su vigencia sin cerrarse (renglones en rojo). Abajo ves cuánto suma lo filtrado en pesos y sin IVA; con CSV te la llevas a Excel.",
      "Para la gerencia, «Por autorizar» es la cola de precios abajo del mínimo: primero las que el vendedor ya pidió, con su nota, cuántas partidas van bajo el mínimo y qué tanto abajo de lista. «Autorizar» deja al vendedor enviarla.",
      "«Seguimiento» es la lista de cotizaciones enviadas a las que toca preguntarles qué pasó: primero las vencidas, luego las de hoy y luego las que vienen. Cada cotización enviada aparece aquí 3 días hábiles después.",
      "En «¿Qué pasó?» eliges cómo va (sigue en pie, no contestó, contactado, negociando, ya compró o se perdió) y escribes lo que dijo el cliente; Enter lo guarda y abre la siguiente. Si sigue viva, se agenda la próxima.",
      "El botón «Mensaje» (con destellos) de cada renglón, o «Redactar mensaje» dentro de «¿Qué pasó?», le pide a la IA el WhatsApp de seguimiento con lo que has anotado de esa venta: entre más detalle anotes, más a la medida sale.",
      "El mensaje lo revisas, lo cambias si quieres y lo abres en WhatsApp; no se manda solo.",
      "Con más de 10 seguimientos vencidos no puedes enviar cotizaciones nuevas hasta ponerte al día; el aviso de arriba te lo dice antes.",
      "La gerencia ve en «Seguimiento» cuánto trae cada vendedor y lo que hizo en la semana, y con «Liberar por hoy» deja enviar a alguien por el día si un cliente está esperando.",
    ],
  },
  "/ventas/cotizaciones/nueva": {
    resumen: "Se crea una cotización con las condiciones de pago, entrega y notas que la gerencia dejó por defecto, y en un momento se abre el editor.",
    detalle: [
      "El folio se asigna cuando agregas la primera partida (o cuando la mandas a autorizar o la envías): si abres y sales sin capturar, no se gasta un folio y el borrador vacío se borra solo al día siguiente.",
      "Si llegas desde un cliente o una oportunidad, la cotización ya sale ligada a ellos y con el contacto principal del cliente. Desde un cliente se liga a la oportunidad que tenía abierta sin cotizar (la del lead primero); si tiene varias, antes te pregunta cuál.",
    ],
  },
  "/ventas/cotizaciones/:id": {
    resumen: "El editor de la cotización, con la plantilla de la hoja: agregas partidas, pones condiciones y la envías; cada versión se guarda sin pisar la anterior.",
    pasos: [
      "Agrega partidas: escribe parte del nombre o la clave y Enter.",
      "Llena «Tiempo de entrega»: sin él no se puede enviar.",
      "Dale «Enviar» y elige «Enviar por WhatsApp», «Por correo» o «Solo marcar enviada».",
    ],
    detalle: [
      "Se guarda sola mientras escribes; arriba dice «Guardado» con la hora.",
      "Arriba, «Oportunidad» dice a qué venta pertenece. Sale sola con la que el cliente tenía abierta; si cambias el cliente, toma la del nuevo. Si es otro proyecto, elige «Una nueva al enviar».",
      "Al agregar una partida, el precio de lista, la descripción y la foto se llenan solos (clic en la foto para pegar otra liga o subir una). Clic en una partida muestra su ficha de venta: precio mínimo, existencia y entrega.",
      "Para fletes, instalación o servicios usa «Partida libre». Con «Flete con Skydropx» cotizas el envío con el código postal del cliente y los bultos de las partidas, y se agrega la partida de flete con su precio (no se genera guía ni se cobra).",
      "Si algo no tiene precio, «Pedir precio a compras» y aquí ves cuando contestan.",
      "Si un precio queda abajo del mínimo, la partida se marca en rojo y la cotización pasa a «Por autorizar»: pide la autorización a la gerencia con «Pedir autorización» antes de enviarla. La gerencia la da con «Autorizar precios».",
      "Junto a «Tiempo de entrega» están los atajos «Inmediata (en existencia)» y «Se confirma al recibir el anticipo», además del que estima el ERP con la carga del taller.",
      "Abajo de «Tiempo de entrega» ves cuándo sale de verdad con el taller como está hoy: lo que tarda el equipo o lo que tarda la fila del taller, lo que sea más tarde. Con «Usar» lo pones en la cotización; si prometes menos días, se pone en amarillo. Al convertir a pedido, la fecha compromiso ya viene con esa fecha.",
      "El botón principal cambia según el estado: «Enviar», «Convertir a pedido» (eliges partidas y fecha compromiso) o «Nueva versión».",
      "Enviar la deja como enviada y agenda preguntar qué pasó en 3 días hábiles. «Abrir PDF» solo abre la hoja: si la mandas por otro lado, dale después «Solo marcar enviada». Con más de 10 seguimientos vencidos no deja enviar, ni sacar el PDF o la vista previa de una cotización que todavía no envías, hasta ponerte al día.",
      "Ya enviada no se edita; para cambiarla saca una nueva versión: te pregunta si la actual ya no vale (queda rechazada, o cancelada si no se envió) o si sigue vigente.",
      "En el menú «···» están imprimir, duplicar y marcar rechazada con su motivo. «Vista previa» te enseña la hoja tal como la recibe el cliente sin salir del editor.",
      "Si el equipo tiene más fotos, salen en miniatura bajo la partida y en la hoja de fotos al final del PDF; pasa el mouse por una y con la × la quitas de esta cotización.",
      "«Por correo» (en Enviar) o «Mandar por correo» (en el menú «···») manda la cotización desde tu propio Gmail con el PDF adjunto: el mismo que sale en Imprimir. Propone el correo del contacto y los demás contactos del cliente con correo; puedes cambiar el asunto y el mensaje.",
      "Las respuestas te llegan a tu Gmail, como siempre. La primera vez te pide conectar tu Gmail. Si la cotización no se puede enviar (precios abajo del mínimo sin autorizar, seguimientos vencidos), te dice por qué y no sale nada.",
      "Ya mandada por correo queda como enviada, con su seguimiento, y en la bitácora del cliente queda a qué correo se fue.",
      "Si el cliente no quiere factura, marca «Sin IVA (no lleva factura)»: el precio de cada partida queda igual sin IVA y el total es el subtotal. Si los precios traían IVA incluido, se les quita. En la hoja impresa solo sale el total (sin renglón de IVA) y el pedido sale sin IVA.",
      "«Sin IVA» se cambia mientras la cotización no se haya enviado; ya enviada, saca una nueva versión.",
    ],
  },
  "/ventas/pedidos": {
    resumen: "Los pedidos de todos los canales en una sola lista: ventas, producción y cobranza saben en qué va cada uno sin preguntar por WhatsApp.",
    pasos: [
      "Filtra por abiertos, entregados o cancelados y por canal; clic en un renglón abre el pedido.",
      "Para una venta de Mercado Libre, sitio web o mostrador, usa «Pedido sin cotización».",
    ],
    detalle: [
      "Los renglones en rojo están atrasados: pasó su fecha compromiso. «Producción» muestra el avance del taller y «Saldo» lo que falta por cobrar (dice «pagado» en verde si ya se cobró todo).",
      "En «Pedido sin cotización» eliges cliente, canal y número de venta, y en el siguiente paso agregas las partidas con su precio de lista. Los servicios sin precio fijo, como «Servicio de paquetería», te piden el monto (sin IVA) al agregarlos.",
      "Abajo ves el total y lo por cobrar de lo filtrado, en pesos, y aparte lo que tus clientes ya debían en la hoja (los pedidos que vienen de la hoja se cobran contra eso).",
      "Los pedidos ya entregados que vienen de las hojas no salen de entrada; actívalos con «Incluir históricos de los paneles».",
      "Los de la hoja que siguen en el taller sí salen siempre, con «en saldo de arranque» en la columna de saldo: su cobro se lleva en el saldo de arranque del cliente.",
    ],
  },
  "/ventas/pedidos/:id": {
    resumen: "Todo lo de un pedido en una página: partidas, avance de producción, envío, facturas, cobros y a quién le cuenta la venta.",
    pasos: [
      "Mira en la línea de arriba por dónde va: confirmado, en producción, listo o entregado.",
      "Imprime la «Hoja de salida» para que el cliente la firme.",
      "Dale «Entregar»: elige qué sale, quién recibió y sube la foto de la hoja firmada.",
    ],
    detalle: [
      "Mientras está Confirmado se pueden ajustar las partidas; se guardan al salir del campo (Enter o Tab). Los precios que vienen de una cotización ya pasaron por la autorización: solo la gerencia los cambia, o sacas una nueva versión de la cotización.",
      "«Mandar a producción» (lo usa producción) crea una orden por cada equipo con lista de materiales; «Marcar listo» avanza el estado; «Cancelar» pide el motivo. La «Hoja de salida» sale sin precios.",
      "En «Entregar» sacas todo o una parte de cada partida: lo demás queda por entregar. La foto de la hoja firmada la puedes subir después. Lo que sale se descuenta del inventario, y cada entrega sale en el recuadro de entregas con su hoja.",
      "Si te equivocaste, el aviso trae «Deshacer» por 15 minutos; después la reabre la gerencia de ventas con el motivo. Entregan almacén, el vendedor sus pedidos, la gerencia de ventas y dirección.",
      "Facturas y cobros los registra finanzas, y el saldo se recalcula solo; una factura ya registrada se corrige o se quita con su lápiz.",
      "Si el pedido tiene equipos en el taller, «Plan del taller» enseña cuándo entra y sale cada uno de cada área y si llega a la fecha compromiso (el rombo verde llega, el rojo no). Es el plan de la planta: se mueve solo con lo que pasa en el piso. Clic en un equipo abre su orden.",
      "Si es una venta de Mercado Libre, el recuadro «Mercado Libre» dice cómo va su envío allá (lista para enviar, en camino, entregada) y el dinero: lo que pagó el comprador, lo que se quedó Mercado Libre, las retenciones y lo que llega a Mercado Pago.",
      "En una venta de Mercado Libre el cobro entra solo en cuanto se aprueba el pago, y el envío y el pedido avanzan solos con lo que dice Mercado Libre.",
      "Si el cliente no quiere factura, en los totales «Quitar IVA» deja el total igual al subtotal (y «Agregar IVA» lo regresa). Lo cambian el vendedor del pedido, la gerencia de ventas y finanzas.",
      "A un pedido que ya tiene factura registrada no se le puede quitar el IVA hasta que se quite la factura. La comisión no cambia: se calcula sin IVA.",
      "«Crédito de la venta» dice qué vendedor cobra comisión por este pedido; si la cerraron entre varios, la gerencia lo comparte con «Compartir», en porcentajes que suman 100 %.",
    ],
  },
  "/ventas/clientes": {
    resumen: "El directorio de clientes de todos los vendedores: de quién es cada cuenta y hasta cuándo, para no duplicarla ni pisarse.",
    pasos: [
      "Antes de dar de alta uno, búscalo por nombre, razón social, RFC o ciudad.",
      "Si no existe, dale «Nuevo cliente»; si existe, clic en su renglón abre su ficha.",
    ],
    detalle: [
      "Todos ven que la cuenta existe y de quién es; teléfonos, historial y saldo solo los ven el dueño, la gerencia y cobranza.",
      "«Mis clientes» son los tuyos y «Libres» los que no tienen dueño. En «Vendedor dueño» ves hasta cuándo es suya la cuenta: en ámbar si le quedan menos de 30 días, en rojo si ya venció.",
      "Con CSV te llevas la lista a Excel.",
    ],
  },
  "/ventas/clientes/:id": {
    resumen: "La ficha del cliente: datos fiscales, contactos, seguimiento e historial completo de cotizaciones, pedidos, oportunidades y lo que compró antes del ERP.",
    pasos: [
      "Si la cuenta está libre, dale «Hacerlo mío» para que quede a tu nombre.",
      "En «Actividad», anota cada llamada, WhatsApp o visita en una línea y Enter.",
      "Dale «Nueva cotización»: sale ligada a su oportunidad abierta; si tiene varias, eliges cuál.",
    ],
    detalle: [
      "«Nueva cotización» usa la oportunidad que el cliente tenía abierta sin cotizar (la del lead primero). Si tiene varias, o una ya cotizada, te pregunta para cuál es; «Es otro proyecto» abre una nueva al enviarla.",
      "Arriba ves de quién es la cuenta y hasta cuándo. Si es de otro vendedor solo ves eso: contactos, compras y saldo quedan privados. Si te buscó a ti, pídele a la gerencia que lo reasigne o que compartan el crédito.",
      "En «Actividad», si le pones fecha a una nota se vuelve tarea. Tus seguimientos alargan la vigencia de la cuenta a tu nombre.",
      "Para facturar bien captura RFC, régimen, CP fiscal y uso de CFDI, o llénalos con la constancia de situación fiscal.",
      "Si el mismo cliente está dos veces (uno con el nombre del contacto y otro con el de la empresa), «Juntar con otro» pasa todo al que se queda: pedidos, cotizaciones, oportunidades, saldo de la hoja, facturas y contactos (los que ya tiene no se repiten).",
      "Al juntar, lo que le falte al que se queda (RFC, régimen, ciudad, vendedor) lo toma del otro, y el otro se borra. Lo hacen la gerencia de ventas, o tú si los dos clientes son tuyos o libres.",
      "Si otro cliente tiene el mismo RFC, arriba sale el aviso con su botón «Juntar»; si es una sucursal, déjalo así.",
    ],
  },
  "/ventas/comisiones": {
    resumen: "La comisión de cada mes, calculada sola con los pedidos: sin rangos de filas que mover a mano.",
    pasos: [
      "Elige el mes arriba, con las flechas o con la lista.",
      "Abre «Pedidos que cuentan este mes» para ver de dónde sale la comisión.",
    ],
    detalle: [
      "Cada vendedor ve la suya; la gerencia de ventas, dirección y finanzas ven a todos (la gerencia administrativa, por ahora, solo la suya).",
      "Cada tarjeta trae la venta de maquinaria con su comisión, la barra hacia el siguiente escalón de meta, la venta de refacciones con su bono y los ajustes. Con crédito compartido, «Pedidos que cuentan este mes» dice qué parte te toca.",
      "La regla está abajo, en «Cómo se calcula»: el porcentaje de tu plan (2 % en los planes actuales) sobre la venta sin IVA de todo lo que no es refacción, más un bono fijo por el escalón de meta alcanzado y otro por el de refacciones.",
      "Los escalones no se suman: se paga el más alto. El plan dice si la venta cuenta por la fecha del pedido, de la factura o del cobro.",
      "La gerencia o dirección agregan ajustes (bonos de Mercado Libre, correcciones) con «Ajuste», y finanzas la marca pagada con «Marcar pagada»: se guarda la foto del cálculo y el mismo mes no se paga dos veces.",
    ],
  },
  "/ventas/leads": {
    resumen: "Aquí se anota a quien llama o escribe interesado y todavía no es cliente ni oportunidad, para que no se pierda en un papel.",
    pasos: [
      "Dale «Registrar lead», escribe quién es, cómo contactarlo y qué busca, y Enter.",
      "Abre el lead y anota cada intento: «Le escribí», «No contestó» o «Contestó».",
      "Cuando conteste, dale «Crear oportunidad»; si no le interesa, «Descartar» con el motivo.",
    ],
    detalle: [
      "Lo usan recepción, los vendedores, la gerencia de ventas y marketing, que los ve todos para saber de dónde llegan y qué pasó con ellos.",
      "Al registrarlo pon también dónde está, su empresa (o «Particular») y qué busca con modelo o medida. Si se te pasó algo, al abrirlo te dice qué le falta y lo completas ahí; «Incompletos» junta los que tienen algo pendiente.",
      "Mientras escribes el teléfono o la empresa te dice si ya es cliente y de quién; si lo es y dices «Es este», le llega directo a su vendedor.",
      "A quién le llega lo demás depende de cómo lo dejó la gerencia: en bandeja se avisa a los vendedores y el primero que lo toma se lo queda; o la gerencia lo asigna; o quien lo registra escoge al vendedor. Si nadie lo toma o nadie lo atiende a tiempo, se le avisa a la gerencia.",
      "Dale clic a un lead para ver sus datos, llamarle o escribirle por WhatsApp. Cada intento se anota, conteste o no: «Le escribí» si fue por WhatsApp o correo, «No contestó» si le llamaste (o «No estaba» si fuiste), y «Contestó» con lo que te dijo.",
      "«Crear oportunidad» se habilita hasta que contesta (o pide cotización). Si no era cliente, se da de alta; si su teléfono ya es de un cliente, te ofrece esa cuenta. Si no le interesa, se descarta con el motivo.",
      "Para escribirle, «Mensaje con IA» te lo redacta con lo que busca y lo que le pidas en la caja de contexto. Cada uno sale distinto, porque WhatsApp bloquea a quien manda el mismo texto a muchos; al abrirlo en WhatsApp se anota «Le escribí».",
      "La columna «Intentos» dice lo último que hiciste y cuándo («Le escribiste por WhatsApp · hace 2 h»), y «Sin contactar» junta a los que todavía no les has escrito ni llamado.",
      "Ya convertido, «Cotizar» abre la cotización en la oportunidad del lead; al enviarla el lead dice «Cotizado».",
      "Quien lo registró ve en «Los que registré» quién lo tomó y en qué etapa va la oportunidad.",
    ],
  },
  "/catalogo": {
    resumen: "Lo que vendemos: cada equipo y componente con su foto, descripción, precio de lista y lo que hay en planta.",
    pasos: [
      "Busca por clave, nombre o una palabra de la descripción.",
      "Clic en un renglón para ver su ficha con la foto grande.",
    ],
    detalle: [
      "Lo usan recepción, para contestar el teléfono, y ventas. El buscador de arriba también te trae aquí cuando buscas un artículo.",
      "Los filtros de arriba separan equipos, componentes y lo que tiene existencia. Si ingeniería ya las subió, la ficha trae también la ficha técnica y las fotos para mandarle al cliente.",
      "El precio es el de lista, en pesos y sin IVA. Si dice «Pregunta a ventas» o el cliente quiere cotización, descuento o algo a la medida, regístralo como lead para que lo atienda un vendedor.",
      "Marketing pone las fotos: en la ficha, «Subir foto» o pega la liga de Google Drive y Enter. El filtro «Sin foto» deja solo lo que todavía no tiene. La foto sale aquí y en las cotizaciones nuevas.",
    ],
  },
  "/ventas/solicitudes": {
    resumen: "Todos los precios que le pediste a compras, juntos: cuáles siguen pendientes, cuáles ya tienen precio y cuáles pasaron su plazo.",
    pasos: [
      "Pide un precio suelto con «Pedir precio»; casi siempre se pide desde la partida de la cotización.",
      "Cuando llegue el precio, dale «Aplicar a COT-…» para ponerlo en esa partida.",
    ],
    detalle: [
      "También se pide desde el buscador cuando algo no aparece.",
      "«Sin tomar»: nadie de compras la ha agarrado. «Cotizando»: ya la tiene alguien. «Con precio»: ya contestaron. En rojo las que pasaron su plazo, que corre en horas hábiles (las urgentes tienen menos).",
      "De compras solo ves el precio de lista y la entrega en días hábiles.",
      "Si ya no hace falta, «Ya no la necesito» la cancela y compras deja de cotizarla.",
    ],
  },
  "/ventas/mercadolibre": {
    resumen: "Lo de Mercado Libre que necesita a alguien: las preguntas de compradores por contestar y las publicaciones vendidas que falta ligar a su artículo.",
    pasos: [
      "En «Preguntas», escribe la respuesta y dale «Contestar» (o Ctrl+Enter).",
      "En «Por ligar», busca qué artículo es cada publicación y elígelo.",
    ],
    detalle: [
      "Las ventas no se capturan aquí: entran solas a Pedidos. La usan quien atiende Mercado Libre y marketing; la pestaña «Dinero» solo la ven ventas y finanzas.",
      "La respuesta se publica en Mercado Libre tal cual. Si el mismo comprador ya había preguntado en esa publicación, arriba de su pregunta ves lo que preguntó antes y lo que se le contestó.",
      "Solo salen las preguntas de publicaciones activas: Mercado Libre no deja contestar las de una publicación pausada o cerrada, y esas se quitan de la lista. Cada pregunta dice cuánto lleva esperando; arriba ves el tiempo de respuesta de los últimos 30 días.",
      "«Sugerir respuesta» le pide a la IA una propuesta con la ficha del artículo, lo que dice la publicación y lo que ese comprador ya preguntó; o elige una respuesta rápida. Lo que salga queda en la caja para corregirlo antes de contestar.",
      "En «Datos para contestar» escribes lo que siempre aplica (factura, envíos, garantía) y guardas las respuestas rápidas.",
      "Al ligar una publicación, sus ventas y sus envíos toman ese artículo. El envío ya se pidió solo cuando entró la venta, así que almacén ve el paquete aunque nadie la haya ligado, y también la puede ligar desde el envío; lo que no puede es cerrar la caja sin ligarla.",
      "Si la publicación es un paquete (24 cangilones), pon en «Piezas por venta» cuántas trae: cada venta entra como esas piezas al precio de cada una. Si cada venta es una parte de lo que cuenta el catálogo (1 juego y la clave es una caja de 4), pon la fracción: 0.25.",
      "Si la publicación trae como SKU la clave del ERP, se liga sola.",
      "Si una publicación no es de Hegamex (en la misma cuenta vende otra tienda), da «No es de Hegamex»: sus ventas en el ERP se cancelan sin cobro y las siguientes ya no entran. Quedan abajo, en «No son de Hegamex», con «Sí es nuestra» por si fue un error.",
      "En «Ligadas» ves cada publicación con su artículo. Si se ligó mal, «Corregir» cambia el artículo o las piezas y rehace las ventas abiertas que todavía no tienen guía; «Desligar» la regresa a «Por ligar».",
      "«Publicaciones» pone cada publicación junto a lo que dice el catálogo: precio en ML contra el sugerido de su tipo (clásica o premium, con la comisión y el envío que ML le cobra a esa publicación), existencia en ML contra lo libre en planta, visitas, preguntas, ventas y conversión de 30 días.",
      "Ahí, «Por revisar» deja lo que conviene arreglar. «Traer de Mercado Libre» lo pone al día; solo lee, no cambia nada allá.",
      "«Cambios sugeridos» corrige desde aquí el precio y la existencia que no cuadran: ves el antes y el después, palomeas y das «Mandar … a Mercado Libre». Antes de mandar se vuelve a leer cada publicación: si alguien la cambió en Mercado Libre, esa no se toca.",
      "Abajo, «Corregir solo» lo hace cada hora con lo seguro si gerencia de ventas o dirección lo prende (viene apagado), y «Cambios hechos desde el ERP» dice qué se cambió, quién y qué contestó Mercado Libre.",
      "«Reputación» muestra el termómetro de la cuenta y lo que lo mueve (reclamos, demoras, cancelaciones), y los reclamos abiertos con su fecha límite.",
      "En «Dinero» está cada pago de Mercado Libre del mes, como lo da Mercado Pago: lo que pagó el comprador, la comisión, el envío que pagamos, las retenciones de IVA e ISR y lo que llega a Mercado Pago, con el día en que queda disponible. Si un pago se reembolsó, lo que llega y lo que se quedó Mercado Libre ya traen descontado lo que se devolvió; los intentos de pago rechazados o cancelados no salen.",
      "En «Dinero», arriba van los totales del mes; abajo puedes bajarlo a Excel para conciliar la cuenta de Mercado Pago.",
    ],
  },
  "/ventas/devoluciones": {
    resumen: "Registra y sigue las devoluciones, reclamos y cancelaciones de cada venta, sobre todo de Mercado Libre, para que el código y la hora límite no se pierdan.",
    pasos: [
      "Dale «Nueva», escribe el número de venta de Mercado Libre o el folio del pedido y Enter.",
      "Elige si es devolución, reclamo o cancelación, y anota el motivo y el código.",
      "Revisa la columna «Vence» y abre un renglón para ver su detalle.",
    ],
    detalle: [
      "La usan quien atiende las ventas en línea y almacén.",
      "Los reclamos que abren los compradores en Mercado Libre entran solos, con su motivo y fecha límite, en cuanto Mercado Libre avisa. Contestarlos y resolverlos se sigue haciendo en Mercado Libre; aquí se ve qué está abierto, quién lo atiende y lo que hace almacén.",
      "En una devolución, almacén ya sabe que viene; en un reclamo, queda la hora límite para responder.",
      "«Vence» dice qué corre: rojo si ya pasó, ámbar si falta menos de un día; el filtro «Vencidas o por vencer» deja solo eso.",
      "El detalle se abre a la derecha, con la evidencia de salida de esa venta (fotos, check list, quién empacó) para defenderte.",
      "Cuando una devolución llega, almacén la recibe con fotos y decide si reingresa al inventario, es merma o se le reclama a la paquetería.",
    ],
  },
};

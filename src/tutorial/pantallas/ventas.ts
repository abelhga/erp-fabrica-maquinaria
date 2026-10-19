import type { AyudaPantalla } from "./index";

export const VENTAS: Record<string, AyudaPantalla> = {
  "/ventas/para-llamar": [
    "Tu lista para arrancar el día: cada tarjeta dice por qué buscar a ese cliente y cuánto puede valer. La usan los vendedores: cada quien ve sus clientes y los que no tienen vendedor; la gerencia de ventas ve la de todo el equipo.",
    "Las tarjetas de arriba filtran por motivo: cotización por vencer (rojo), ya le toca (ámbar), refacciones (azul) y reactivar (gris). Pasa el mouse por cada una para ver la regla. El buscador encuentra cliente, producto o vendedor.",
    "“Redactar mensaje” arma un WhatsApp o un correo con el historial del cliente (lo escribe Claude si está conectado; si no, sale una plantilla). Revísalo y ajústalo: enviarlo lo decides tú, con “Abrir en WhatsApp” o copiándolo.",
    "Cuando vuelves de WhatsApp o del teléfono, la tarjeta pregunta “¿Sí le escribiste?”: un toque lo registra (con Deshacer) y el cliente pasa a “En seguimiento”, con el siguiente paso: llamar al día 3, último mensaje al día 10 y luego esperar una semana. Así nadie del equipo le vuelve a escribir sin saberlo.",
    "En la tarjeta de un cliente en seguimiento, “¿Cómo terminó?” cierra el intento: si le interesa se crea la oportunidad; “no por ahora” o “no contesta” lo regresan a la lista en 90 días; “ya no compra” lo saca, con la razón. Tres intentos y una semana sin respuesta cuentan solos como “no contesta”.",
    "Solo salen tus clientes y los libres. No aparecen los que ya tienen una oportunidad abierta (ya estás en eso) ni los que tienen una cotización abierta de los últimos 45 días, salvo que esté por vencer.",
  ],
  "/ventas/oportunidades": [
    "El embudo de ventas: cada tarjeta es una venta posible, desde que alguien pregunta hasta que se gana o se pierde. Los vendedores la usan para no soltar a nadie; la gerencia, para ver qué está atorado (y puede filtrar por vendedor).",
    "Arrastra una tarjeta a otra columna para cambiarla de etapa; si la sueltas en “Perdida” te pide el motivo. Dale clic para abrir su detalle a la derecha: ahí editas monto, probabilidad y cierre estimado, sacas una cotización y anotas el seguimiento.",
    "Los días en ámbar dicen que lleva más de 14 en la misma etapa; la tarea en rojo, que ya venció. Ganadas y perdidas se quedan 60 días en el tablero; después solo en la vista de lista, que también se descarga a CSV.",
    "No todo se mueve a mano: enviar una cotización pasa su oportunidad a “Cotizado” (y la crea si no existía), convertirla en pedido la marca “Ganada”, y rechazarla la cierra como “Perdida” si no tiene otra cotización viva.",
  ],
  "/ventas/cotizaciones": [
    "El registro de todas las cotizaciones, cada una con su folio y versión. Los vendedores ven las suyas; la gerencia de ventas ve las de todo el equipo y autoriza precios.",
    "Las pestañas filtran por estado y “Solo vencidas” deja las que pasaron su vigencia sin cerrarse (renglones en rojo). Clic en un renglón la abre. Abajo ves cuánto suma lo filtrado en pesos y sin IVA; con CSV te la llevas a Excel.",
    "Para la gerencia, “Por autorizar” es la cola de precios abajo del mínimo: primero las que el vendedor ya pidió, con su nota, cuántas partidas van bajo el mínimo y qué tanto abajo de lista. “Autorizar” deja al vendedor enviarla.",
  ],
  "/ventas/cotizaciones/nueva": [
    "Al entrar aquí se crea una cotización con las condiciones de pago, entrega y notas que la gerencia dejó por defecto; en un momento se abre el editor.",
    "El folio se asigna cuando agregas la primera partida (o cuando la mandas a autorizar o la envías): si abres y sales sin capturar, no se gasta un folio y el borrador vacío se borra solo al día siguiente.",
    "Si llegas desde un cliente o una oportunidad, la cotización ya sale ligada a ellos y con el contacto principal del cliente.",
  ],
  "/ventas/cotizaciones/:id": [
    "El editor de la cotización: la plantilla de la hoja, pero cada versión se guarda y no pisa la anterior. Se guarda solo mientras escribes; arriba dice “Guardado” con la hora.",
    "Agrega partidas escribiendo parte del nombre o la clave y Enter: precio de lista, descripción y foto se llenan solos (clic en la foto para pegar otra liga o subir una). Para fletes, instalación o servicios usa “Partida libre”; con “Flete con Skydropx” cotizas el envío con el código postal del cliente y los bultos de las partidas, y se agrega la partida de flete con su precio (no se genera guía ni se cobra); si algo no tiene precio, “Pedir precio a compras” y aquí ves cuando contestan. Clic en una partida muestra su ficha de venta: precio mínimo, existencia y entrega.",
    "Si un precio queda abajo del mínimo, la partida se marca en rojo y la cotización pasa a “Por autorizar”: pide la autorización a la gerencia antes de enviarla. Ya enviada no se edita; para cambiarla saca una nueva versión.",
    "El botón principal cambia según el estado: Enviar (por WhatsApp o PDF; la deja como enviada), Convertir a pedido (eliges partidas y fecha compromiso) o Nueva versión. En el menú “···” están imprimir, duplicar y marcar rechazada con su motivo. “Vista previa” te enseña la hoja tal como la recibe el cliente sin salir del editor.",
    "Abajo de “Tiempo de entrega” ves cuándo sale de verdad con el taller como está hoy: lo que tarda el equipo o lo que tarda la fila del taller, lo que sea más tarde. Con “Usar” lo pones en la cotización; si prometes menos días, se pone en amarillo. Al convertir a pedido, la fecha compromiso ya viene con esa fecha.",
  ],
  "/ventas/pedidos": [
    "Los pedidos de todos los canales en una sola lista. Ventas, producción y cobranza la usan para saber en qué va cada uno sin preguntar por WhatsApp.",
    "Filtra por abiertos, entregados o cancelados y por canal. Los renglones en rojo están atrasados: pasó su fecha compromiso. “Producción” muestra el avance del taller y “Saldo” lo que falta por cobrar (dice “pagado” en verde si ya se cobró todo). Clic en un renglón abre el pedido.",
    "“Pedido sin cotización” es para ventas de Mercado Libre, sitio web o mostrador: eliges cliente, canal y número de venta, y en el siguiente paso agregas las partidas con su precio de lista. Abajo ves el total y lo por cobrar de lo filtrado, en pesos, y aparte lo que tus clientes ya debían en la hoja (los pedidos que vienen de la hoja se cobran contra eso).",
    "Los pedidos ya entregados que vienen de las hojas no salen de entrada; actívalos con “Incluir históricos de los paneles”. Los de la hoja que siguen en el taller sí salen siempre, con «en saldo de arranque» en la columna de saldo: su cobro se lleva en el saldo de arranque del cliente.",
  ],
  "/ventas/pedidos/:id": [
    "Todo lo de un pedido en una página: partidas, avance de producción, envío, facturas, cobros y a quién le cuenta la venta. La línea de arriba marca por dónde va: confirmado, en producción, listo y entregado.",
    "Mientras está Confirmado se pueden ajustar las partidas; se guardan al salir del campo (Enter o Tab). Los precios que vienen de una cotización ya pasaron por la autorización: solo la gerencia los cambia, o sacas una nueva versión de la cotización.",
    "Arriba: “Mandar a producción” (lo usa producción) crea una orden por cada equipo con lista de materiales; “Marcar listo” y “Entregar” avanzan el estado; “Cancelar” pide el motivo. Facturas y cobros los registra finanzas, y el saldo se recalcula solo.",
    "“Crédito de la venta” dice qué vendedor cobra comisión por este pedido; si la cerraron entre varios, la gerencia lo comparte en porcentajes que suman 100 %.",
  ],
  "/ventas/clientes": [
    "El directorio de clientes de todos los vendedores. Todos ven que la cuenta existe y de quién es, para no duplicarla ni pisarse; teléfonos, historial y saldo solo los ven el dueño, la gerencia y cobranza.",
    "“Mis clientes” son los tuyos y “Libres” los que no tienen dueño. En “Vendedor dueño” ves hasta cuándo es suya la cuenta: en ámbar si le quedan menos de 30 días, en rojo si ya venció.",
    "Busca por nombre, razón social, RFC o ciudad antes de dar de alta uno nuevo, para no duplicarlo. Clic en un renglón abre la ficha del cliente; con CSV te llevas la lista a Excel.",
  ],
  "/ventas/clientes/:id": [
    "La ficha del cliente: datos fiscales, contactos, seguimiento e historial completo (cotizaciones, pedidos, oportunidades y lo que compró antes del ERP).",
    "Arriba ves de quién es la cuenta y hasta cuándo. Si está libre, “Hacerlo mío” te la asigna. Si es de otro vendedor solo ves eso: contactos, compras y saldo quedan privados. Si te buscó a ti, pídele a la gerencia que lo reasigne o que compartan el crédito.",
    "En “Actividad” anota cada llamada, WhatsApp o visita en una línea y Enter; si le pones fecha se vuelve tarea. Tus seguimientos alargan la vigencia de la cuenta a tu nombre.",
    "Para facturar bien captura RFC, régimen, CP fiscal y uso de CFDI, o llénalos con la constancia de situación fiscal. “Nueva cotización” sale ya ligada a este cliente.",
  ],
  "/ventas/comisiones": [
    "La comisión de cada mes, calculada sola con los pedidos: sin rangos de filas que mover a mano. Cada vendedor ve la suya; la gerencia de ventas, dirección y finanzas ven a todos (la gerencia administrativa, por ahora, solo la suya).",
    "Cada tarjeta trae la venta de maquinaria con su comisión, la barra hacia el siguiente escalón de meta, la venta de refacciones con su bono y los ajustes. “Pedidos que cuentan este mes” dice de dónde sale; con crédito compartido, qué parte te toca. Cambia de mes con las flechas.",
    "La regla (abajo, en “Cómo se calcula”): el porcentaje de tu plan (2 % en los planes actuales) sobre la venta sin IVA de todo lo que no es refacción, más un bono fijo por el escalón de meta alcanzado y otro por el de refacciones. Los escalones no se suman: se paga el más alto. El plan dice si la venta cuenta por la fecha del pedido, de la factura o del cobro.",
    "La gerencia o dirección agregan ajustes (bonos de Mercado Libre, correcciones) y finanzas la marca pagada: se guarda la foto del cálculo y el mismo mes no se paga dos veces.",
  ],
  "/ventas/solicitudes": [
    "Casi siempre pides un precio desde la partida de tu cotización (o desde el buscador cuando algo no aparece). Aquí ves todas juntas y puedes pedir una suelta con “Pedir precio”.",
    "“Sin tomar”: nadie de compras la ha agarrado. “Cotizando”: ya la tiene alguien. “Con precio”: ya contestaron. En rojo las que pasaron su plazo, que corre en horas hábiles (las urgentes tienen menos).",
    "Cuando llega el precio, “Aplicar a COT-…” lo pone en la partida de esa cotización. Ves el precio de lista y la entrega en días hábiles, nunca el costo. Si ya no hace falta, “Ya no la necesito” la cancela y compras deja de cotizarla.",
  ],
  "/ventas/mercadolibre": [
    "Lo de Mercado Libre que necesita a alguien: las preguntas de compradores por contestar y las publicaciones vendidas que falta ligar a su artículo. Las ventas no se capturan aquí: entran solas a Pedidos. La usa quien atiende Mercado Libre.",
    "En «Preguntas», escribe la respuesta y da «Contestar» (o Ctrl+Enter): se publica en Mercado Libre tal cual. Cada pregunta dice cuánto lleva esperando; arriba ves el tiempo de respuesta de los últimos 30 días.",
    "En «Por ligar», busca qué artículo es cada publicación y elígelo: sus ventas toman ese artículo y se pide el envío que estaba esperando. Si la publicación trae como SKU la clave del ERP, se liga sola.",
  ],
  "/ventas/devoluciones": [
    "Aquí se registran y se siguen las devoluciones, reclamos y cancelaciones de cada venta, sobre todo de Mercado Libre, para que el código y la hora límite no se pierdan en el chat. La usan quien atiende las ventas en línea y almacén.",
    "“Nueva”: escribe el número de venta de Mercado Libre (o el folio del pedido) y Enter, elige si es devolución, reclamo o cancelación, y anota el motivo y el código. En una devolución, almacén ya sabe que viene; en un reclamo, queda la hora límite para responder.",
    "La columna “Vence” dice qué corre: rojo si ya pasó, ámbar si falta menos de un día; el filtro “Vencidas o por vencer” deja solo eso. Clic en un renglón abre el detalle a la derecha, con la evidencia de salida de esa venta (fotos, check list, quién empacó) para defenderte.",
    "Cuando una devolución llega, almacén la recibe con fotos y decide si reingresa al inventario, es merma o se le reclama a la paquetería.",
  ],
};

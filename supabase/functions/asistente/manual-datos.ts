// Generado desde src/tutorial con `npm run manual`. No se edita a mano: se cambia el tutorial.
import type { ConceptoManual, PantallaManual } from "./manual.ts";

export const PANTALLAS_MANUAL: PantallaManual[] = [
 {
  "ruta": "/",
  "nombre": "Inicio",
  "modulos": [],
  "nivel": 1,
  "texto": [
   "Tu punto de partida del día: lo urgente de tu área y sus números. Dirección ve el centro de mando de toda la empresa; los demás, lo de su puesto.",
   "Paso 1: Lee «Lo que importa hoy»: rojo es riesgo, ámbar pide atención, verde va bien.",
   "Paso 2: Dale clic a una tarjeta o a un indicador para ir directo a donde se atiende.",
   "Lo que ves depende de tu puesto: ventas ve sus ventas y cotizaciones, finanzas lo que se cobra y se paga, importaciones sus embarques, producción el taller, recepción los leads que registró. Si tienes dos puestos, ves lo de los dos.",
   "«Lo que importa hoy» junta lo urgente de tu área (en azul, lo que conviene saber); el botón de flechas lo vuelve a analizar. A almacén le sale primero «Por surtir»: las órdenes con material pendiente, en el orden en que el taller las va a trabajar.",
   "A los supervisores de piso les sale lo del taller y a mantenimiento lo de las máquinas: paradas, fallas sin atender, preventivos vencidos o por vencer y herramienta sin regresar. Eso lo calcula el ERP con reglas, sin IA.",
   "Casi todos los indicadores se abren con un clic y te llevan a la lista de donde salen (Ventas del mes abre los pedidos, por ejemplo). Todo se calcula con tus permisos: un vendedor ve lo suyo, no el total de la empresa.",
   "En el tablero de área, la tarjeta «Pendientes» reúne lo que espera algo de ti según tu puesto: lo que encontró la revisión de la madrugada en algo tuyo, precios por autorizar, seguimientos de cotizaciones vencidos o para hoy, tareas con clientes vencidas, ajustes de inventario, compras atrasadas o documentos de embarques que faltan.",
   "A la gerencia de ventas los seguimientos le salen de todo el equipo, con quién está frenado. Un vendedor frenado no puede enviar cotizaciones nuevas hasta ponerse al día.",
   "En el centro de mando las cifras se actualizan solas cuando alguien registra un pedido, un cobro o un avance del taller. Abajo del embudo comercial ves cómo va cada vendedor con el seguimiento de sus cotizaciones y quién está frenado.",
   "El ERP recuerda cómo dejaste las cosas, en tu computadora o celular y por persona: el orden de cada lista (la columna por la que ordenaste), «Agrupar por» en el material de una orden y la vista y el zoom del Gantt. Los filtros y las búsquedas no, para que nunca se te esconda algo sin darte cuenta.",
   "Cada lunes la IA te puede escribir hasta tres consejos con tus propios números (cómo capturas y, si vendes, qué podrías probar para cerrar más). Salen aquí, en «Tus consejos de la semana», y solo los ves tú. Dale «Me sirve» o «No me sirve»: los de la semana siguiente lo toman en cuenta."
  ]
 },
 {
  "ruta": "/almacen/envios",
  "nombre": "Envíos",
  "modulos": [
   "envios"
  ],
  "nivel": 1,
  "texto": [
   "Aquí se sigue cada envío desde que se pide en un pedido hasta que el cliente lo recibe: cotización y guía de paquetería (con Skydropx o a mano), empaque con fotos y check list, salida y entrega. Ventas pide, cotiza y genera la guía; almacén empaca y marca la salida.",
   "Las pestañas son la fila de trabajo, de izquierda a derecha: Por cotizar y guía, Por empacar, Hoy salen o recogen, En camino y Entregados (los de los últimos 60 días). Dale clic a un renglón para abrir el envío a un lado: arriba ves cada paso con quién y cuándo, y el botón del paso que sigue.",
   "Empacar pide fotos del paquete, el check list completo y, si es un equipo, su número de serie, que tiene que ser el de su orden de producción. Esa evidencia no se puede cambiar ni borrar; una foto equivocada se retira con su motivo (queda a la vista como «retirada») y, mientras el paquete no salga, se sube la correcta. Al marcar que salió, se descuenta del inventario lo que falte, una sola vez y sin tocar lo apartado para otros; lo que surte Full sale de Almacén ML.",
   "Una venta de Mercado Libre de una publicación que el ERP no conoce también llega aquí, con el título de la publicación y un aviso en ámbar. Con «Ligar artículo» dices qué artículo del catálogo es y cuántas piezas lleva cada venta; sin eso, la caja no se puede cerrar. Si Mercado Libre se lleva el paquete antes de que alguien la ligue, el inventario se descuenta cuando se ligue.",
   "Si manejas envíos, arriba ves el saldo de cada paquetería de prepago (recargas menos guías); se pone en rojo abajo del mínimo. En la de Skydropx también ves lo que Skydropx reporta, para comparar. Almacén arma desde aquí los envíos para reabastecer el Full de Mercado Libre.",
   "Para un envío por paquetería, «Cotizar con Skydropx» pide el destino por campos (código postal, estado, municipio, colonia, calle) y el peso y medidas de cada bulto; con eso cotizan todas las paqueterías a la vez y eliges una. Al confirmar, Skydropx cobra la guía de su saldo y el PDF, el número de guía y el rastreo quedan en el envío, que pasa a «Guía lista». La dirección se le queda al contacto del cliente para la próxima vez. Si el PDF tarda, el envío lo dice y «Revisar guía» lo trae sin volver a cobrar. «Cotizar a mano» y «Registrar guía a mano» siguen para fletes o si Skydropx falla."
  ]
 },
 {
  "ruta": "/almacen/existencias",
  "nombre": "Existencias",
  "modulos": [
   "inventario"
  ],
  "nivel": 1,
  "texto": [
   "Aquí ves cuánto hay de cada componente y materia prima, en qué almacén está, cuánto ya está apartado y, si tu puesto lo ve, cuánto viene en camino. Sirve para saber si algo se puede surtir sin ir a buscarlo al estante.",
   "Busca por clave o nombre y usa los filtros de arriba de la tabla: Apartados, En tránsito, Negativos o Todos. El selector de almacén deja solo lo que hay en ese almacén. Dale clic a un renglón para abrir el artículo a un lado: ahí ves cuánto hay en cada almacén, para qué orden o pedido está apartado y, si te toca, su kardex. El botón de CSV baja la lista para Excel.",
   "La columna que importa es Disponible: lo que hay en planta menos lo apartado. Lo del Full de Mercado Libre existe, pero no cuenta para planta. Un número en rojo es existencia negativa: salió algo cuya entrada nunca se registró, y se corrige con un conteo y un ajuste. La tabla se actualiza sola cuando alguien registra un movimiento."
  ]
 },
 {
  "ruta": "/almacen/metricas",
  "nombre": "Métricas de almacén",
  "modulos": [
   "inventario"
  ],
  "nivel": 2,
  "texto": [
   "Aquí ves cómo anda el almacén, en dos pestañas. «Salud del inventario» es una foto de hoy: cuánto alcanza lo que hay contra lo que sale, qué sobra y qué falta, y qué artículos conviene controlar de cerca. «Movimiento del periodo» es lo que pasó en el periodo: surtido a órdenes, lo que sale fuera de su lista, consumibles por persona, ajustes y conteos. La usan almacén, compras, la gerencia de producción y dirección.",
   "En «Salud del inventario» la barra reparte lo que hay en existencia por clase (quiebre, bajo el punto de reorden, sano, exceso, esporádico, sin movimiento); con permiso de costos se ve por valor o por artículos. La frase de arriba dice cuánto no tiene demanda regular. Clic en cualquier pedazo, en la leyenda o en una celda de la matriz trae la lista de esos artículos, para bajarla a Excel y actuar (rematar, devolver, no volver a pedir, pedir ya).",
   "La matriz ABC-XYZ cruza cuánto pesa cada artículo (por valor consumido si ves costos; si no, por qué tan seguido sale) con qué tan parejo sale mes con mes; al pasar el mouse por una celda dice qué conviene hacer con esos artículos. «Cobertura contra la meta» dice, para nacionales e importados, cuántos artículos alcanzan menos de su meta (en naranja) y cuántos de más (en azul). Abajo, lo que salió cada mes en los últimos 12.",
   "En «Movimiento del periodo» eliges el periodo (30 días, 90, 6 o 12 meses) y pasas el mouse por cada indicador para ver de dónde sale. La gráfica de control enseña, por semana, qué parte de lo surtido a órdenes salió fuera de su lista contra su promedio y sus límites: un punto rojo arriba del límite es un cambio real que hay que investigar.",
   "«Fuera de lista» trae cada partida que salió a una orden sin estar en su lista, con quién la recibió, quién la registró y el motivo: es la lista para preguntar por qué y, si a la receta le falta algo, avisar a ingeniería. Clic en la orden la abre. Se busca y se baja a Excel como cualquier tabla.",
   "«Consumibles por persona» suma lo que se llevó cada quien de las categorías consumibles (discos, lijas, soldadura, EPP…); «Sin anotar» son salidas a consumo que no dicen quién lo recibió. «Contra receta» compara lo que salió de cada consumible con lo que prevén las recetas de las órdenes terminadas en el periodo: en rojo, más de 20 % arriba. Lo que no viene en ninguna receta, como los guantes, solo se ve por persona.",
   "Abajo están los ajustes del periodo y los que esperan autorización, los conteos cerrados con cuántos renglones no coincidieron, y cuántos movimientos registró cada persona. Los montos solo los ve quien tiene acceso a costos."
  ]
 },
 {
  "ruta": "/almacen/movimientos",
  "nombre": "Entradas y salidas",
  "modulos": [
   "inventario"
  ],
  "nivel": 1,
  "texto": [
   "Aquí se registra todo lo que sale, regresa o cambia de almacén, y se consulta la historia de cada movimiento. La usa almacén desde el celular o la computadora; la gerencia entra a autorizar ajustes.",
   "En Registrar elige Salida (consumo o venta), Devolución o Traspaso, busca el artículo, toca el almacén (cada botón dice cuánto hay ahí), escribe la cantidad y el motivo; en un consumo, también quién se lo lleva (se queda para la siguiente salida). Enter en la cantidad te pasa al motivo; Enter otra vez guarda. Los botones de motivo llenan el texto por ti. No deja sacar más de lo que hay en ese almacén. A la derecha ves lo que registraste hoy para confirmar que quedó bien.",
   "Historial filtra por tipo, almacén, persona y fechas (al abrir, los últimos 30 días) y se baja a Excel. «Recibió» es quién se llevó el material; «Quién» es quién lo registró. En Ajustes pides una corrección cuando lo del estante no cuadra, y la gerencia la aprueba o la rechaza. En Conteos físicos abres un conteo por almacén, capturas cada artículo en cuanto lo cuentas (Enter guarda y baja al siguiente) y, al cerrarlo, cada diferencia se vuelve un ajuste por autorizar.",
   "Nada se edita ni se borra. Si te equivocaste en una salida o un traspaso que registraste tú, en «Lo que registraste hoy» tienes unos minutos para «Deshacer», con el motivo (15 de inicio; los fija dirección en Configuración y el botón dice cuántos quedan): queda el movimiento contrario ligado al original (sale como «corrección» y el original como «deshecho»), con tu nombre y la hora, y el consumo se compensa. Un traspaso solo regresa si lo que llegó sigue en el destino. Pasado ese tiempo, o si lo registró otra persona, no lo vuelvas a capturar al revés: pide un ajuste. Lo surtido a una orden, lo recibido de una compra, las entregas de pedidos y los envíos se corrigen desde su propia pantalla. La fecha, la hora y tu nombre los pone el sistema, así que no se puede capturar con fecha atrasada ni a nombre de otro."
  ]
 },
 {
  "ruta": "/almacen/reabasto",
  "nombre": "Reabasto",
  "modulos": [
   "inventario"
  ],
  "nivel": 1,
  "texto": [
   "Te dice qué componentes y materias primas hay que pedir, cuánto y por qué. Compras la usa para generar órdenes de compra y almacén para pedirle material a compras.",
   "Abre en \"A ordenar\" si hay algo abajo de su punto de reorden. Marca las casillas (la de arriba elige todos los que tienen sugerido) y, según tu puesto, dale \"Generar órdenes de compra\" (salen en borrador, separadas por proveedor) o \"Pedir a compras\" (sale una requisición). Si algo ya está en una orden en borrador o en una requisición, se ve debajo del sugerido para que no lo pidas dos veces.",
   "La regla es la de la hoja Demanda: un artículo genera demanda si tuvo consumo en suficientes meses de los últimos seis, y su demanda es el promedio de esos meses. El punto de reorden es la demanda de los días que tarda en llegar más el stock de seguridad. Si el disponible (en planta − apartado + en tránsito) queda abajo, se sugiere el lote (1 mes de cobertura si es nacional, 6 si es importado) más lo que falta para el punto de reorden, redondeado al empaque. La regla vigente está al pie de la tabla y el botón \"¿por qué?\" hace la cuenta con los números de cada artículo.",
   "Cobertura y Seguridad se cambian ahí mismo si tu puesto puede: escribe y Enter guarda; vacío regresa al valor normal. Los días de entrega son los reales del proveedor cuando ya hay historia. Excedente es lo que no se usó en 12 meses y sigue en el estante."
  ]
 },
 {
  "ruta": "/analisis",
  "nombre": "Análisis y metas",
  "modulos": [
   "analisis"
  ],
  "nivel": 1,
  "texto": [
   "El mapa de ventas de dirección y gerencia de ventas: dónde se vende y dónde se dejó de vender, por estado y por municipio.",
   "Elige el periodo arriba (se queda al cambiar de pestaña) y qué pinta el mapa: venta, clientes, ticket promedio o crecimiento. Clic en un estado para ver sus municipios; «México» te regresa. El botón de tabla junto al ranking muestra todos los renglones, con CSV para Excel.",
   "Todo se compara contra el periodo anterior: el mismo tramo del año pasado si el periodo es de un año o menos. «Zonas que se enfriaron» junta los lugares que cayeron 30 % o más, con los clientes que dejaron de comprar para llamarles.",
   "La venta es con IVA y sale de la misma regla que el tablero de inicio. Lo de clientes sin ubicar o del extranjero cuenta en el total pero no sale en el mapa; lo sin ubicar se arregla en «Ubicaciones por revisar»."
  ]
 },
 {
  "ruta": "/analisis/capacidad",
  "nombre": "Análisis y metas › capacidad",
  "modulos": [
   "analisis"
  ],
  "nivel": 1,
  "texto": [
   "Si prometemos más de lo que el taller saca. Todo va en semanas de la etapa más cargada (la que más trabajo tiene en fila contra su gente), para compararlo con el calendario.",
   "La primera gráfica dice cuánto trabajo se prometió para cada mes contra las semanas que tiene el mes; «Ya vencido» es lo que debió salir y sigue en el taller. La segunda, lo que entra y sale del taller cada mes: si entra más, la fila crece.",
   "«Se pone al día» es cuándo acabaría el taller todo lo que tiene si no entrara nada más. Para acortar la fila hay que sacar más (gente, horas extra, maquila) o prometer con la fecha realista que da el cotizador."
  ]
 },
 {
  "ruta": "/analisis/clientes",
  "nombre": "Análisis y metas › clientes",
  "modulos": [
   "analisis"
  ],
  "nivel": 1,
  "texto": [
   "Cuánto depende la venta de pocos clientes, quiénes regresan y a quiénes se está perdiendo, para decidir a quién buscar.",
   "Los cuadros, la curva de Pareto y los que más compraron usan el periodo de arriba. Los segmentos se calculan al último día del periodo: elige uno (de entrada «En riesgo») y abajo sale la lista con su vendedor; clic en un renglón abre la ficha del cliente.",
   "Las cohortes dicen qué parte de los clientes de cada año volvió a comprar después; pasa el mouse por una celda para ver cuántos clientes son."
  ]
 },
 {
  "ruta": "/analisis/entregas",
  "nombre": "Análisis y metas › entregas",
  "modulos": [
   "analisis"
  ],
  "nivel": 1,
  "texto": [
   "Si cumplimos lo que prometemos. Arriba, cuántos pedidos con fecha compromiso en el periodo se entregaron a tiempo y con cuánto atraso los que no; abajo, por mes, por vendedor y por familia de equipo.",
   "«Lo que viene» es lo más útil: cada orden del taller con la fecha a la que sale de verdad. En rojo las que ya no llegan a su fecha; dale clic para abrir el pedido. Bájala en CSV para revisarla con producción.",
   "La fila va por fecha compromiso: cada orden sale cuando la etapa más cargada acaba lo prometido antes que ella más lo suyo, con la capacidad semanal de cada área (la calcula el ERP con la gente asignada). Cambia cada día con lo que el taller termina y lo que entra."
  ]
 },
 {
  "ruta": "/analisis/planeacion",
  "nombre": "Análisis y metas › planeacion",
  "modulos": [
   "analisis"
  ],
  "nivel": 1,
  "texto": [
   "La meta del año repartida por mes y por estado, contra lo vendido: dice a qué ritmo hay que vender lo que falta.",
   "Dirección captura la meta (acepta «32 M») y Enter guarda; el escenario calcula una meta creciendo un porcentaje sobre el año anterior y «Usar como meta» la copia. Con las flechas cambias de año.",
   "La meta de cada mes sale de lo que pesó ese mes en los últimos 3 años completos, y la de cada estado, de lo que pesó cada estado. «Cierre a este ritmo» proyecta el año con lo que se va arriba o abajo del anterior a la misma fecha, igual que el tablero de inicio."
  ]
 },
 {
  "ruta": "/analisis/producto",
  "nombre": "Análisis y metas › producto",
  "modulos": [
   "analisis"
  ],
  "nivel": 1,
  "texto": [
   "Qué familia de producto se vende en cada región, para saber qué ofrecer dónde.",
   "La matriz cruza las familias con los 12 estados que más venden. En «Mezcla del estado» cada columna suma 100 %; en «Monto», son pesos. Clic en un estado para ver qué se vende ahí y en qué municipios; clic en una familia para ver su mapa.",
   "Las ventas de la hoja solo traen texto, así que se clasifican con reglas de familia; abajo están las reglas y lo que quedó sin clasificar, de más a menos dinero. Solo dirección agrega reglas, y antes de guardar ve a cuántas ventas les pegaría."
  ]
 },
 {
  "ruta": "/analisis/tendencias",
  "nombre": "Análisis y metas › tendencias",
  "modulos": [
   "analisis"
  ],
  "nivel": 1,
  "texto": [
   "La venta mes a mes desde 2018, para ver estacionalidad, crecimiento y qué familias pesan cada año. No usa el periodo: siempre muestra toda la historia.",
   "Cada gráfica tiene su botón de tabla para ver los números o copiarlos. En la comparación año contra año el mes en curso no se dibuja hasta que cierre, porque a medias parecería una caída.",
   "«Últimos 12 meses» y «Crecimiento anual móvil» quitan la estacionalidad: cada punto suma o compara 12 meses completos. La mezcla por familia sale del texto de cada venta, con las reglas de «Producto × región»."
  ]
 },
 {
  "ruta": "/analisis/ubicaciones",
  "nombre": "Análisis y metas › ubicaciones",
  "modulos": [
   "analisis"
  ],
  "nivel": 1,
  "texto": [
   "Las ciudades y estados escritos a mano en las fichas de clientes que no se reconocieron. Mientras no se ubiquen, su venta no sale en el mapa.",
   "Los filtros separan lo que hay que resolver, lo que hay que confirmar y lo que falta capturar en la ficha del cliente. Dirección elige el municipio correcto (o confirma el sugerido con ✓) y se aplica a todos los clientes que lo escribieron igual; «No se puede» lo saca de la lista (por ejemplo «Varios»).",
   "Clic en el número de clientes para ver quiénes son. Lo corregido queda en «Corregidas por dirección», donde se puede deshacer."
  ]
 },
 {
  "ruta": "/calendario",
  "nombre": "Calendario",
  "modulos": [],
  "nivel": 1,
  "texto": [
   "Todo lo que tiene fecha y te toca ver, en un solo lugar. Aquí no se captura nada: cada cosa sale de su pantalla.",
   "Paso 1: Elige Mes, Semana o Lista y muévete con las flechas; «Hoy» te regresa.",
   "Paso 2: Toca un área para esconderla, o prende «Solo lo mío» para dejar lo tuyo.",
   "Paso 3: Clic en un día para verlo completo; clic en una línea para ir a su pantalla.",
   "Salen entregas de pedidos, cierres de oportunidades y llamadas, compras y embarques que llegan, envíos por recolectar, compromisos del taller y cuándo termina cada orden según el plan, servicios, preventivos, herramienta por devolver, pagos, vacaciones, cumpleaños y tus pendientes.",
   "Cada quien ve lo de su puesto: un vendedor ve sus entregas y sus llamadas, no las compras; los pagos solo los ve finanzas.",
   "Lo que ya se cerró no sale; lo que ya pasó su fecha y sigue abierto sale en rojo («atrasado»). Cada área tiene siempre el mismo color."
  ]
 },
 {
  "ruta": "/catalogo",
  "nombre": "Catálogo y precios",
  "modulos": [
   "catalogo"
  ],
  "nivel": 1,
  "texto": [
   "Lo que vendemos: cada equipo y componente con su foto, descripción, precio de lista y lo que hay en planta. Lo usan recepción, para contestar el teléfono, y ventas. El buscador de arriba también te trae aquí cuando buscas un artículo.",
   "Escribe la clave, el nombre o una palabra de la descripción para encontrarlo; los filtros de arriba separan equipos, componentes y lo que tiene existencia. Clic en un renglón abre la ficha con la foto grande y, si ingeniería ya la subió, la ficha técnica y las fotos para mandarle al cliente.",
   "El precio es el de lista, en pesos y sin IVA. Si dice «Pregunta a ventas» o el cliente quiere cotización, descuento o algo a la medida, regístralo como lead para que lo atienda un vendedor.",
   "Marketing pone las fotos: en la ficha, «Subir foto» o pega la liga de Google Drive y Enter. El filtro «Sin foto» deja solo lo que todavía no tiene. La foto sale aquí y en las cotizaciones nuevas."
  ]
 },
 {
  "ruta": "/compras/ordenes",
  "nombre": "Órdenes de compra",
  "modulos": [
   "compras"
  ],
  "nivel": 1,
  "texto": [
   "Todas las órdenes de compra, de la requisición al proveedor y del proveedor al almacén. Compras las arma y las envía, almacén las recibe y finanzas registra los pagos.",
   "De entrada ves las abiertas (borradores, enviadas y recibidas en parte); los cuadros de arriba y los filtros cambian la vista, y clic en un renglón abre la orden. Las atrasadas van en rojo. La barra de Recibido dice qué parte de lo pedido ya llegó.",
   "La pestaña Requisiciones tiene lo que producción y almacén le piden a compras: marca partidas y «Crear órdenes de compra» arma una en borrador por proveedor. Los importes y lo que falta por pagar solo los ve quien tiene costos o finanzas."
  ]
 },
 {
  "ruta": "/compras/ordenes/:id",
  "nombre": "Órdenes de compra › ficha",
  "modulos": [
   "compras"
  ],
  "nivel": 1,
  "texto": [
   "Una orden de compra completa: sus partidas, los datos para el proveedor, lo que ya se recibió en almacén y, para quien ve dinero, sus pagos.",
   "En borrador agregas artículos con el buscador de abajo (Enter) y editas cantidad y costo en su lugar; el costo sugerido es el vigente del artículo, y debajo ves si el del proveedor sale más caro o más barato. «Enviar al proveedor» fija las partidas; no se envía con partidas en $0. Después imprímela o mándala.",
   "«Por correo» la manda desde tu propio Gmail con el PDF de la orden adjunto (el mismo que sale al imprimir), al correo del proveedor que está en su ficha; puedes cambiar a quién, el asunto y el mensaje. Si estaba en borrador, al mandarla queda enviada, con las mismas reglas que «Enviar al proveedor». La primera vez te pide conectar tu Gmail.",
   "Cuando llega mercancía, almacén usa «Recibir»: captura lo que de verdad llegó y lo que falte queda pendiente. Si todavía no se recibe nada, compras la puede cancelar y sus requisiciones vuelven a pendientes.",
   "Si después de enviarla se acuerda con el proveedor otro artículo, otra cantidad u otro precio, compras da el lápiz de esa partida, la corrige y escribe por qué. El folio se queda (el proveedor ya lo tiene) y la orden sube de revisión: «Rev. 2» en el título y en lo impreso, para mandársela otra vez. Abajo de las partidas queda cada cambio con su antes y después, quién lo hizo y por qué. Una partida de la que ya llegó algo no se cambia.",
   "Las partidas escritas a mano (sin artículo del catálogo) también se reciben. Si son material, en «Recibir» busca su artículo para que entren al almacén; si son un cobro, como «Manejo» o un flete, recíbelas tal cual: cuentan como recibidas y no tocan el inventario.",
   "Cuando finanzas registra la factura del proveedor y la liga a la orden, en «Factura del proveedor» dice «Registrada en finanzas» y los pagos ya se llevan en esa factura, no en la orden. Si el folio que anotó almacén al recibir es el de la factura, se ligan solas. Una partida sin artículo dice «Sin artículo del catálogo»: si es material, ponle su artículo para que entre al almacén y cuente como material.",
   "Si no pones fecha de entrega, se calcula al enviar con los días hábiles del proveedor; si pasa sin que llegue todo, la orden sale atrasada. El vencimiento del pago se fija al recibir, con los días de crédito del proveedor."
  ]
 },
 {
  "ruta": "/compras/ordenes/nueva",
  "nombre": "Órdenes de compra › nueva",
  "modulos": [
   "compras"
  ],
  "nivel": 1,
  "texto": [
   "Para armar una orden de compra nueva. Empieza por el proveedor: de él salen la moneda, el crédito y los días de entrega.",
   "Si tienes la cotización del proveedor en PDF o foto, súbela: la IA lee las partidas y las empareja con el catálogo, y tú revisas todo antes de crear la orden. Si no, elige al proveedor y «Crear orden en borrador»; las partidas se agregan después."
  ]
 },
 {
  "ruta": "/compras/precios",
  "nombre": "Actualizar precios",
  "modulos": [
   "compras"
  ],
  "nivel": 2,
  "texto": [
   "Reemplaza la hoja ACTUALIZACIONES: aquí compras pone al día el costo de lo que compra cuando un proveedor cambia sus precios.",
   "Escribe el costo nuevo y Enter: se guarda esa fila y bajas a la siguiente. Con ↑ ↓ te mueves sin guardar (lo escrito queda en amarillo hasta «Guardar cambios») y Esc deshace la fila. Filtra los costos de más de 6 meses o los que no tienen, o elige un proveedor para pasar su lista completa.",
   "La columna Cambio compara en pesos, con los dólares al tipo de cambio de hoy; un triángulo avisa si el cambio pasa de 50 %, casi siempre por unidad o moneda equivocada. Al guardar te dice a cuántos equipos les cambia el precio, y a la derecha quedan los últimos cambios con quién y cuándo.",
   "Arriba a la derecha está el tipo de cambio con que se costea lo importado: si el del día no te sirve, captúralo ahí y Enter."
  ]
 },
 {
  "ruta": "/compras/proveedores",
  "nombre": "Proveedores",
  "modulos": [
   "compras"
  ],
  "nivel": 1,
  "texto": [
   "El directorio de proveedores: a quién se le compra, en qué moneda, con cuánto crédito y en cuántos días entrega.",
   "«Nuevo proveedor» lo da de alta compras, o finanzas con sus datos fiscales (si ya existe uno con ese RFC, le pone al día los datos en lugar de duplicarlo). De entrada ves solo los que surten algún artículo o tienen órdenes abiertas, porque el directorio de las hojas mezclaba acreedores (nómina, casetas, hoteles); «Todo el directorio» los muestra todos. Clic en un renglón abre su ficha; CSV baja la lista para Excel.",
   "«OC abiertas» cuenta las órdenes enviadas que esperan mercancía, con las atrasadas en rojo. Lo comprado en 12 meses solo lo ve quien tiene costos o finanzas."
  ]
 },
 {
  "ruta": "/compras/proveedores/:id",
  "nombre": "Proveedores › ficha",
  "modulos": [
   "compras"
  ],
  "nivel": 1,
  "texto": [
   "La ficha de un proveedor: sus datos, lo que nos surte, sus órdenes de compra y cómo se han movido sus precios.",
   "Desde aquí haces una «Nueva orden» ya con este proveedor, o editas sus datos. Compras edita todo; finanzas y la gerencia administrativa ponen al día lo fiscal, lo bancario, el crédito y el contacto, y pueden llenarlo subiendo su constancia de situación fiscal. Si cambian los datos bancarios, dirección recibe un aviso. Clic en una orden de la derecha la abre. Un artículo con la nota «su costo vigente es de otro proveedor» también se le compra a otro, y el costo de hoy viene de aquel.",
   "Finanzas ve además «Le debemos»: el saldo del proveedor y lo vencido. Dale clic para abrir su cuenta con sus facturas, todos sus movimientos y el botón para registrar un pago.",
   "Con permiso de costos ves el índice de precios del proveedor (100 en el primer mes con datos) y el cambio de sus precios en el último año; los costos en amarillo tienen más de 6 meses."
  ]
 },
 {
  "ruta": "/compras/solicitudes",
  "nombre": "Solicitudes de precio",
  "modulos": [
   "compras"
  ],
  "nivel": 2,
  "texto": [
   "La cola de precios que piden los vendedores desde sus cotizaciones. Antes era «¿me ayudas a cotizar esta polea?» en el chat; aquí se ve qué sigue abierto, quién lo tiene y qué ya venció.",
   "Va ordenada por vencimiento, con lo vencido arriba y en rojo. «Tomar» le avisa al vendedor que ya la tienes. «Contestar» (o clic en el renglón) abre el panel de la derecha: elige el artículo del catálogo o dalo de alta, escribe proveedor, costo y días de entrega, y Enter contesta. Si no se consigue, dilo con el motivo: el vendedor se lo explica al cliente.",
   "La «Nota para quien lo pidió» la lee el vendedor: nada de costos ahí. Los cuadros de arriba filtran la lista con un clic, y el tiempo de respuesta se cuenta en horas hábiles de la planta, comparado contra lo que se tardaba en el chat."
  ]
 },
 {
  "ruta": "/costeo/componentes",
  "nombre": "Componentes",
  "modulos": [
   "costeo"
  ],
  "nivel": 1,
  "texto": [
   "Todo lo que se compra: componentes, materia prima y servicios, con lo que hay en planta (y su precio de lista, si tu puesto vende). Ingeniería y compras lo dan de alta; los demás lo consultan.",
   "Busca por clave, nombre, categoría o proveedor y dale clic a un renglón para abrir su ficha. Los filtros separan lo importado y lo que tiene existencia; el botón CSV baja la lista para Excel.",
   "La existencia suma los almacenes de planta: lo que está en el Full de Mercado Libre no cuenta aquí.",
   "Quien tiene permiso de costos ve además el costo, su fecha y el proveedor, y los filtros «Sin costo» y «Costo de +6 meses»; los renglones en rojo no tienen costo capturado."
  ]
 },
 {
  "ruta": "/costeo/componentes/:id",
  "nombre": "Componentes › ficha",
  "modulos": [
   "costeo"
  ],
  "nivel": 1,
  "texto": [
   "La ficha de lo que se compra: datos generales, existencias por almacén, precios por canal en línea, planos y en qué equipos se usa. Lo que ves depende de tu permiso.",
   "Si puedes editar, cada campo se guarda solo al salir de él (o con Enter). La descripción sale en la cotización: una viñeta por renglón. «Pulir redacción» la corrige (ortografía, acentos, estilo) sin tocar medidas ni marcas; ves la propuesta y decides si la usas. Para la foto, pega la liga de Drive o de una imagen, o súbela con «Subir foto». Marcarlo como importado pide 6 meses de cobertura en lugar de 1, y el stock de seguridad se suma al punto de reorden.",
   "Junto a «Dónde se usa», «Reemplazar componente» (ingeniería) la cambia por otra pieza en las listas que elijas, con las mismas cantidades; esta pieza se queda en el catálogo con su precio.",
   "«Canales en línea» compara el precio sugerido de cada canal contra lo que está publicado y avisa si una publicación quedó abajo.",
   "Quien tiene permiso de costos ve aquí el costo con su historial (cada cambio con su origen) y lo puede actualizar; al guardarlo se recalcula todo lo que depende de él."
  ]
 },
 {
  "ruta": "/costeo/equipos",
  "nombre": "Equipos y subensambles",
  "modulos": [
   "costeo"
  ],
  "nivel": 1,
  "texto": [
   "Aquí viven los equipos que fabricamos y sus subensambles: qué lleva cada uno y cuántas horas toma hacerlo. Ingeniería los da de alta y los mantiene; ventas y producción los consultan.",
   "Busca por clave o nombre y dale clic a un renglón para abrir su ficha. Las pestañas separan Equipos, Subensambles y Solicitudes de cambio (las correcciones que mandan producción o almacén desde una orden; cada una también te llega a Pendientes y se cierra sola al aplicarla o descartarla). El filtro «Sin lista de materiales» te dice qué falta capturar, y el botón CSV baja la tabla para Excel.",
   "Un subensamble se captura una vez y se comparte: si lo cambias, cambia en todos los equipos que lo usan. Para armar uno, abre un equipo, marca las líneas que siempre van juntas y usa «Convertir en subensamble».",
   "Si cambian una pieza en la maquinaria (se descontinuó, otro proveedor), «Reemplazar componente» la cambia en las listas que elijas con las mismas cantidades; la pieza vieja sigue en el catálogo para venderse como refacción. Lo hace ingeniería.",
   "Lo que ya no se fabrica ni se vende se inhabilita con el interruptor de la columna «Activo» (lo cambia ingeniería o compras): deja de salir en el cotizador y en pedidos nuevos, pero no cambia en los equipos que ya lo usan. Antes de inhabilitar te dice en cuántos equipos activos y pedidos abiertos está. Los inhabilitados se ven en el filtro «Inhabilitados», y ahí mismo se reactivan.",
   "Quien tiene permiso de costos ve además columnas y alertas de costo; al pasar el mouse por ellas se explica cada una."
  ]
 },
 {
  "ruta": "/costeo/equipos/:id",
  "nombre": "Equipos y subensambles › ficha",
  "modulos": [
   "costeo"
  ],
  "nivel": 1,
  "texto": [
   "La ficha de un equipo o subensamble: su lista de materiales, sus parámetros, las horas por etapa, dónde se usa y sus planos. Ingeniería la edita; los demás la consultan.",
   "En la lista de materiales escribe la clave o el nombre de un componente y Enter: entra con cantidad 1 y el cursor queda en la cantidad. Enter guarda y baja, Tab avanza, Esc deshace y Alt+↑/↓ mueve la línea; todo se guarda solo. Marca varias líneas para volverlas subensamble o moverlas a un grupo.",
   "Lo de adentro de un subensamble sale en gris y no se edita aquí: se cambia en el propio subensamble, porque el cambio llega a todos los equipos que lo usan.",
   "Si una cantidad depende de una medida (largo, ancho), defínela en la pestaña Parámetros. Para la misma banda con otra medida sin tocar esta, usa «Duplicar con otros parámetros».",
   "En «Fotos» se suben una o varias fotos (o se pega la liga de Drive). La primera es la principal y sale junto a la partida de la cotización; las demás, en la hoja de fotos del PDF. Con las flechas o «Hacerla principal» cambias el orden.",
   "Para cambiar una pieza por otra con la misma cantidad, usa el botón de flechas de su línea. «Editar datos» cambia el nombre, el tipo de equipo y la descripción (sale arriba, en «Descripción»: qué es, para qué sirve y lo que conviene saber al armarlo); las cotizaciones que ya existen conservan el nombre anterior. Junto a la descripción, «Pulir redacción» le pide al asistente que corrija ortografía y estilo: ves la propuesta y decides si la usas.",
   "«Inhabilitar» lo saca del cotizador y de pedidos nuevos cuando ya no se fabrica; arriba sale la marca «Inhabilitado» y el botón cambia a «Reactivar»."
  ]
 },
 {
  "ruta": "/costeo/margenes",
  "nombre": "Márgenes y precios",
  "modulos": [
   "margenes"
  ],
  "nivel": 1,
  "texto": [
   "El panel de utilidad, antes la pestaña Reglas de Nuevo Costeo: de aquí sale el precio de lista de todo el catálogo. Lo consultan finanzas y la gerencia administrativa; solo dirección lo cambia.",
   "Cada tarjeta es una política de precio: utilidad, recargos sobre costo y sobre precio, medida especial, redondeo y descuento máximo. «Editar» abre el simulador: antes de guardar ves cuántos precios se mueven y cuáles más. Cada cambio queda en la bitácora con quién y cuándo.",
   "El precio de un equipo es: costo × (1 + recargos sobre costo + medida especial) ÷ (1 − utilidad ÷ (1 − ISR) − recargos sobre precio), redondeado hacia arriba. Lo que se revende usa el margen sobre precio de su política, sin compensar ISR: costo ÷ (1 − margen).",
   "El ISR de compensación, la mano de obra por etapa y el tipo de cambio también mueven precios: al cambiarlos se recalcula todo lo que depende de ellos. El tipo de cambio lo capturan compras (en Actualizar precios) o finanzas: escribe el valor y Enter."
  ]
 },
 {
  "ruta": "/costeo/planos",
  "nombre": "Planos",
  "modulos": [
   "costeo"
  ],
  "nivel": 1,
  "texto": [
   "El índice de planos: cada uno con su folio y su revisión, para saber cuál es el bueno y con cuál se fabricó cada orden. El archivo sigue en Drive; aquí solo se lleva el control.",
   "Elige Vigentes, Por aprobar o Anteriores (las dos últimas las ve ingeniería) y busca por folio, equipo o título. La revisión en verde es la vigente y en amarillo la que está por aprobar; «Drive» abre el archivo y el nombre del equipo abre su ficha.",
   "Para ligar un plano, entra al equipo (Equipos y subensambles), pestaña Planos, y liga el archivo de Drive: el ERP le da folio y revisión. Si hay equipos en producción sin plano vigente, ingeniería los ve arriba en un aviso."
  ]
 },
 {
  "ruta": "/costeo/precios-ventas",
  "nombre": "Precios vs ventas",
  "modulos": [
   "margenes"
  ],
  "nivel": 1,
  "texto": [
   "Para ver si los cambios de costo y de precio de una familia de equipos se notaron en lo que se vende: el costo y el precio de lista mes a mes, junto a lo vendido de esa familia. Lo ve quien tiene permiso de márgenes.",
   "Arriba eliges la familia y desde qué año. La primera gráfica es un índice (100 al inicio del periodo) y la segunda son pesos; van separadas a propósito, porque mezclar índice y pesos en un mismo eje engaña.",
   "El precio de lista se registra desde el arranque del ERP (la hoja no guardaba la utilidad aplicada), por eso su línea empieza después. Las ventas de antes del arranque salen del libro de la hoja (ventas desde $40,000, clasificadas por su descripción); después, de los pedidos.",
   "La relación costo ↔ ventas se mide por trimestre, porque con pocas ventas al mes el mes a mes es puro ruido. Es orientativa: no prueba que una cosa cause la otra."
  ]
 },
 {
  "ruta": "/finanzas/caja-chica",
  "nombre": "Caja chica",
  "modulos": [
   "caja_chica"
  ],
  "nivel": 1,
  "texto": [
   "Aquí se lleva el efectivo de la oficina: cada gasto y cada reposición, con el saldo después de cada uno. La lleva finanzas; cuando finanzas no está, recepción y compras anotan lo que se toma o se repone.",
   "Para anotar, elige «Sale» o «Entra», escribe el concepto y el monto y dale Enter. Un movimiento mal capturado lo borra finanzas con el bote de basura; lo que vino de la hoja no se borra. Los retiros de ahorro y los abonos a préstamos que Recursos Humanos paga o recibe en efectivo de la caja entran solos, con su folio en el concepto.",
   "El arqueo y borrar un movimiento son de finanzas: quien toma el dinero no es quien cuenta la caja. Cuando cuentes el efectivo, usa «Arqueo»: escribe cuánto hay y, si no cuadra con el saldo, la diferencia queda anotada como sobrante o faltante con tu nombre.",
   "El saldo es la suma de todo lo que ha entrado menos lo que ha salido desde que empezó la hoja. Se pinta en rojo abajo del mínimo (toca reponer) y en amarillo arriba del máximo (sobra efectivo)."
  ]
 },
 {
  "ruta": "/finanzas/cobranza",
  "nombre": "Cobranza",
  "modulos": [
   "finanzas"
  ],
  "nivel": 1,
  "texto": [
   "Aquí ves lo que nos deben los clientes, por sus pedidos y por lo que ya debían en la hoja, desde cuándo, y lo que se ha cobrado mes a mes. La usa finanzas para saber a quién llamar primero y para registrar cobros y facturas.",
   "Los indicadores de arriba suman los pedidos y lo de la hoja, y parten el saldo por antigüedad; dale clic a uno para filtrar la tabla de pedidos. «Los más atrasados» es por dónde empezar a llamar. Dale clic a un pedido para ver sus cobros y facturas y registrar uno nuevo; un cobro negativo es una devolución al cliente.",
   "Las pestañas agrupan por cliente o por vendedor (clic en un renglón para ver sus pedidos) y «Saldos de arranque» trae, cliente por cliente, lo que se debía en la hoja antes del ERP (los pedidos que vienen de la hoja se cobran contra eso, no aparte); dale clic a un cliente para ver sus movimientos y registrar lo que pague de ese saldo. Los filtros separan lo que tiene saldo y lo que falta facturar; el CSV baja lo que ves.",
   "Las facturas y los cobros se pueden registrar subiendo su XML: en el pedido, «Registrar factura» lee la factura que timbramos (folio, UUID, fecha y total) y revisa que sea de ese cliente; «Subir complementos de pago», arriba, registra cada pago en el pedido de su factura, aunque subas muchos a la vez, y no duplica lo que ya estaba. Si a una factura le falta el UUID o tiene un dato mal, corrígela con el lápiz en vez de registrarla otra vez: un folio o un UUID repetido no entra.",
   "La antigüedad corre desde la primera factura, o desde el pedido si aún no se factura; la de la hoja, desde la venta (los pagos tapan primero las ventas más viejas). Los saldos en dólares se pasan a pesos con el tipo de cambio de hoy, que se ve arriba (finanzas y compras lo pueden capturar ahí)."
  ]
 },
 {
  "ruta": "/finanzas/facturas-anteriores",
  "nombre": "Facturas anteriores (XML)",
  "modulos": [
   "finanzas"
  ],
  "nivel": 1,
  "texto": [
   "Aquí entran los XML de años pasados (la carpeta FACTURAS de Drive) para que la historia de antes del ERP diga qué se compró y no solo a quién. La usa finanzas; lo ve también dirección.",
   "Descarga de Drive la carpeta (un año a la vez, o todo) y elígela con «Elegir carpeta», o elige los ZIP que da Drive con «XML o ZIP». Los XML se leen en tu navegador y solo sube lo que dicen; puede tardar unos minutos por año. Volver a cargar lo mismo no duplica nada: cada factura se guarda una vez por su folio fiscal. Las que no son de Hegamex (ni la emitió ni la recibió) no se guardan.",
   "Cada factura recibida se amarra a su renglón del libro de compras de la hoja (por folio y monto, o por monto exacto y fecha cercana); de ahí sale su número de orden de compra, que abre el PDF de esa orden en Drive. Cada factura emitida se amarra a su venta por serie y folio. La tabla de arriba dice, por año, cuántas compras y ventas de la hoja ya tienen su XML; clic en un año para ver sus facturas.",
   "Las facturas canceladas no cuentan: las que vienen de una carpeta «Canceladas» de Drive se marcan solas, y si el SAT dice que otra está cancelada, el botón al final de su renglón la marca (y su renglón de la hoja pasa a la factura que la reemplazó). Se ven en «Recibidas» o «Emitidas» con la marca «Cancelada»; no salen entre lo pendiente.",
   "Si un proveedor sale en «sin renglón en la hoja», casi siempre le falta su RFC en el ERP o se llama distinto en la hoja: dale su RFC y usa «Volver a amarrar». Con su XML, una compra de antes cuenta en Resultados por lo que se compró (su clave del SAT) y no por el giro del proveedor; salvo que el proveedor esté en una categoría que no es gasto, como «Sin efectos», retiros o compra de activos: esa la hoja la dejó fuera a propósito y así se queda."
  ]
 },
 {
  "ruta": "/finanzas/pagos",
  "nombre": "Pagos a proveedores",
  "modulos": [
   "finanzas"
  ],
  "nivel": 1,
  "texto": [
   "Aquí ves lo que debemos a proveedores y cuándo vence cada cosa: lo vencido primero y lo que viene en las próximas 4 semanas. La usa finanzas para planear los pagos y para registrar cada compra, gasto y pago; compras ve solo las órdenes de compra.",
   "Cada factura que llega (material, flete, luz, servicio) se registra con «Registrar compra o gasto»: sube el XML y se llena solo (proveedor por su RFC, folio, total y fecha); puedes subir varios a la vez. Si no tienes el XML, sube el PDF o una foto: la IA la lee, y tú revisas los datos antes de registrar. Si la factura dice que es de contado, marca «Ya se pagó» y elige la cuenta. Si el proveedor no existe, se da de alta ahí mismo con su RFC.",
   "Si el proveedor tiene órdenes de compra, el formulario te pregunta de cuál es la factura; ya viene marcada la que casa con el folio que anotó almacén al recibir. Con orden, cada partida cuenta por su artículo (consumible del taller o material) y la categoría solo aplica a lo que no tiene artículo, como un flete. Sin orden (luz, honorarios, publicidad), la categoría es obligatoria: es lo que dice en qué se gastó. Con el XML, se sugiere por la clave del SAT de lo que se compró (o por cómo registraste antes esa clave); si no, viene la del proveedor. En la cuenta del proveedor, el botón del portapapeles en cada compra cambia de qué orden es.",
   "La agenda suma por proveedor lo que vence cada semana; dale clic a uno para abrir su cuenta: sus facturas pendientes, todos sus movimientos (los de la hoja y los de aquí) y el botón para registrar un pago. Al pagar puedes elegir qué factura liquidas; si no eliges, el pago va a las que vencen primero. Pagar de más solo se puede como anticipo.",
   "«Facturas por pagar» es la lista de facturas con saldo; «Por proveedor», lo que se le debe a cada uno (ahí están aparte los préstamos de socios y los créditos del banco, y lo que tenemos a favor); «Órdenes de compra», las órdenes recibidas con saldo que todavía no tienen su factura registrada (en cuanto se liga su factura, lo que se debe se paga por la factura); «Pagos hechos», todo lo que ya se pagó, por periodo y por cuenta, con su total y el botón CSV para el contador. Va por la fecha del pago; lo que acabas de registrar, aunque sea de otro mes, está en «Recién capturados». Los retiros de caja de ahorro que entrega Recursos Humanos salen ahí al elegir «Nómina e impuestos», a nombre de «Caja de ahorro del personal»; los abonos en efectivo a préstamos entran en la cuenta de «Préstamos al personal». De los dos te llega un aviso.",
   "Cada factura vence en su fecha más los días de crédito del proveedor; cámbialos en su cuenta si no están bien y todas sus fechas se recorren. Lo que venía de 2021 cuenta como vencido. Si un pago o compra también se anotó en la hoja, no se cuenta dos veces. Una factura ya registrada (mismo folio y proveedor) no entra otra vez; si se parece a otra (mismo monto, misma semana), te lo avisa antes de guardar. Si una factura sale «¿Repetida en la hoja?», es que la hoja la tiene dos veces y la otra ya se pagó: no la pagues, ábrela en la cuenta del proveedor y márcala con «Estaba repetida». Si encuentras en la hoja una compra o un pago de más (aunque la copia esté con otro nombre de proveedor) o una factura que se canceló, en los movimientos de la cuenta usa el botón de la derecha del renglón: queda tachado con tu motivo, deja de contar y se puede deshacer. Una factura de la hoja de menos de $1 por pagar son centavos de redondeo y no se enseña. Si una cuenta de la hoja dice que no está ligada a un proveedor del catálogo, elige cuál es ahí mismo para poder pagarle. Las órdenes en dólares se pasan a pesos con el tipo de cambio de hoy."
  ]
 },
 {
  "ruta": "/finanzas/resultados",
  "nombre": "Resultados",
  "modulos": [
   "finanzas"
  ],
  "nivel": 1,
  "texto": [
   "Aquí ves cuánto deja de verdad lo que se vende, desde 2018: de las ventas del periodo, cuánto se va en fabricar, cuánto en vender y administrar, cuánto en impuestos e intereses, y cuánto queda. La ven dirección, finanzas y la gerencia administrativa.",
   "Elige el periodo arriba (también «Año pasado» o un rango desde 2018). El diagrama se lee de izquierda a derecha: las ventas por línea se juntan y se reparten en costo de fabricación, gastos de operación, impuestos e intereses y utilidad; el grueso de cada franja es el dinero. Pasa el mouse por una franja para ver cuánto es y qué parte de las ventas. Con el botón de tabla ves lo mismo en números. «Año por año» compara cada año desde 2018.",
   "Antes del 12 de octubre de 2026 los números salen de las hojas (ventas y compras como se registraron ahí; cada compra por lo que se compró si su XML está cargado en «Facturas anteriores» y su clave del SAT lo dice, y si no, por la categoría de su proveedor; lo que la hoja tenía en «Sin efectos» u otra categoría que no es gasto se queda fuera aunque su XML diga otra cosa); desde ahí, del ERP, donde una factura ligada a su orden de compra cuenta por sus partidas: los consumibles del taller como gasto de fabricación y el material en lo vendido. Los números con ≈ son estimados: lo vendido de la hoja no tiene costeo y la nómina de la hoja se reparte entre taller y oficina con la proporción de hoy. La tabla de abajo dice de dónde sale cada número, y lo que no es gasto (retiros de socios, préstamos, compra de activos) se enseña aparte sin restarse. Mercado Libre sale de Mercado Pago venta por venta desde fines de octubre de 2025 (Mercado Libre no da ventas más viejas): lo que pagó el comprador cuenta como venta y lo que se quedó Mercado Libre (su comisión, el envío que pagamos y otros cargos) como gasto. La hoja solo anotaba como venta las que se facturaban y nunca anotó esos cargos, porque Mercado Libre los descuenta antes de depositar; por eso, desde esa fecha, sus renglones de Mercado Libre ya no cuentan. Antes de esa fecha, las ventas de Mercado Libre son las de la hoja y sus cargos salen en $0. Las comisiones de los vendedores van en el mes de las ventas que las generaron, aunque se hayan pagado después: antes del arranque, las que se registraron como pagadas en Comisiones (en un mes sin ninguna registrada, las que anotó la hoja); desde el arranque, lo que da la regla de cada vendedor.",
   "En «Categorías de compra» decides cómo cuenta cada categoría: material, gasto de fabricación, gasto de operación, nómina, impuestos, intereses o «no es gasto». Finanzas la cambia; el cambio se ve en todos los periodos."
  ]
 },
 {
  "ruta": "/finanzas/sin-registrar",
  "nombre": "Facturas sin registrar",
  "modulos": [
   "finanzas"
  ],
  "nivel": 1,
  "texto": [
   "Lo que el SAT dice que nos facturaron y que nadie ha registrado: ni en la hoja de compras, ni en las compras del ERP, ni en caja chica. Sale de los XML cargados en «Facturas anteriores (XML)»; carga ahí los del mes y aquí aparece lo que falta. La usa finanzas.",
   "Arriba: cuántas faltan y cuánto suman, cuánto es a crédito (cuentas por pagar que no salen en Pagos a proveedores) y cuántas son de un proveedor que todavía no está dado de alta. Clic en un indicador filtra la lista.",
   "«Registrar» abre «Registrar compra o gasto» ya lleno con la factura, igual que si subieras su XML; si el proveedor no existe, se da de alta ahí con su RFC. «Registrar las…» las pasa todas, una por una. Ya registrada, sale sola de la lista.",
   "Las que no se registran aquí (las cobra el banco directo, son de un socio, se pagaron con un anticipo ya registrado) se sacan con el botón de cada renglón y su motivo; quedan en «No se registran» y se pueden regresar. Las canceladas nunca salen."
  ]
 },
 {
  "ruta": "/importaciones",
  "nombre": "Embarques",
  "modulos": [
   "importaciones"
  ],
  "nivel": 1,
  "texto": [
   "El tablero de las importaciones: cada embarque en su etapa, lo urgente arriba y lo que estamos esperando del proveedor, el agente aduanal o la naviera. Lo lleva importaciones; almacén y producción lo consultan para saber qué llega y cuándo.",
   "\"Lo que no puede esperar\" son avisos que arma el sistema solo: rojo es riesgo y ámbar, atención; clic en uno abre su embarque. Abajo, cada columna es una etapa (con el proveedor, en el mar, en puerto, en planta) y cada tarjeta dice el siguiente paso y quién lo debe; \"Nos toca\" es nuestro. La barra de días libres se pone ámbar a 3 días de acabarse y roja al pasarse.",
   "En \"Lo que estamos esperando de otros\" están los documentos pendientes por quién los debe, con la última vez que se pidieron; \"Ya lo pedí\" anota que hoy los volviste a pedir. La etapa de cada embarque la marca la última fecha real capturada, no una casilla.",
   "En \"Tiempos por proveedor\" ves cuánto tarda de verdad cada proveedor, de la orden a planta. El reabasto usa esos días en lugar del tiempo capturado a mano. Si ves dinero, la pestaña Dinero junta pagos y saldos de todos los embarques."
  ]
 },
 {
  "ruta": "/importaciones/:id",
  "nombre": "Embarques › ficha",
  "modulos": [
   "importaciones"
  ],
  "nivel": 1,
  "texto": [
   "La ficha de un embarque: dónde va, qué sigue y quién lo debe, con sus fechas por etapa, sus documentos y las órdenes de compra que trae.",
   "Arriba ves el siguiente paso, la llegada (ETA o fecha real, y cuándo se espera en planta) y, ya que arribó, los días libres en puerto y del contenedor. En Etapas se captura la fecha real de cada paso (Enter guarda; no acepta fechas futuras, para eso está la ETA). Con el lápiz corriges la fecha o, si el paso se registró por error (un embarque cerrado que no era), «Quitar este paso» lo borra con su motivo y deja la nota en la historia. «Cerrado» quiere decir que ya se recuperó el saldo a favor y la garantía: antes de cerrarlo, márcalos como recuperados en Dinero → Por recuperar, o no te deja. Documentos es la lista de lo que necesita este embarque, con quién debe cada uno; los marcados \"antes del arribo\" los pide el agente aduanal antes de que llegue.",
   "\"Leer con IA\" lee un PDF o una foto (proforma, factura, packing list, BL, pedimento, cuenta de gastos) y te propone los datos junto al archivo; nada se guarda hasta que lo revisas y confirmas. Las pestañas de dinero y costeo solo aparecen si tu puesto las ve.",
   "En Correos ligas los hilos de tu Gmail donde se lleva el embarque (con el proveedor, el forwarder, la naviera o el agente): «Ligar hilo» busca en tu Gmail como lo harías allá, por BL, referencia del agente o proveedor. El ERP guarda cada correo sin lo citado de los anteriores, así que lo ve cualquiera de importaciones aunque no sea su Gmail; «Traer lo nuevo» lo pone al día y solo lo puede hacer quien ligó el hilo. Como los correos traen montos, esta pestaña solo la ve quien ve el dinero de importaciones.",
   "«Leer con IA», en Correos, lee todos los correos del embarque y te dice en qué va: fechas de etapas que ya pasaron, ETA, datos como BL, buque o contenedor, documentos que llegaron y lo que está pendiente y de quién. Cada punto dice de qué correo salió (dale clic para verlo). Nada cambia hasta que lo revisas: vienen todos marcados, quitas lo que no es y le das «Aplicar»; se aplica igual que si lo capturaras a mano (una fecha futura no entra como etapa y un cambio de ETA queda en la historia). Los montos que menciona solo se muestran."
  ]
 },
 {
  "ruta": "/importaciones/dinero",
  "nombre": "Embarques › dinero",
  "modulos": [
   "importaciones"
  ],
  "nivel": 1,
  "texto": [
   "El dinero de las importaciones: qué se les debe a los proveedores del extranjero, qué pagos vienen y qué nos tienen que regresar. Lo ven importaciones, compras y finanzas.",
   "\"Pagos en dólares que vienen\" lista cada orden ligada a un embarque con lo pagado, lo que falta y su próximo pago; la fecha en rojo ya pasó. Lo que sigue en producción no tiene fecha hasta que el proveedor avisa que está listo. Los pesos son aproximados al tipo de cambio de hoy.",
   "\"Dinero por recuperar\" son los saldos a favor con el agente aduanal y las garantías de contenedor; en rojo los que ya pasaron de su fecha. \"Por embarque\" resume mercancía, lo pagado con su tipo de cambio real, gastos e impuestos, el IVA acreditable aparte y lo que falta recuperar. Todo se baja a Excel."
  ]
 },
 {
  "ruta": "/pendientes",
  "nombre": "Pendientes",
  "modulos": [],
  "nivel": 1,
  "texto": [
   "Lo que te pidieron y lo que pediste a otros, con fecha. Reemplaza el «¿ya quedó?» por chat: al terminar, a quien lo pidió le llega un aviso.",
   "Paso 1: En «Me tocan», dale clic al círculo para marcarlo hecho; si quieres, deja una respuesta corta.",
   "Paso 2: Para pedir algo nuevo usa «Pedir algo a alguien»: qué hay que hacer, quién y para cuándo.",
   "Paso 3: Si te falta un dato, abre el pendiente y pregúntale ahí a quien te lo pidió.",
   "Al marcarlo hecho, a quien lo pidió le llega un aviso en la campana. La respuesta corta puede ser un precio o una fecha. En la ficha también lo cierras con «Ya quedó».",
   "«Los que pedí» son los que esperas de otros. Si ya no hace falta, cancélalo con la X: te pide confirmarlo y, si quieres, por qué (el motivo lo ve quien lo tenía). La flecha te lleva al pedido, orden o pantalla de donde salió.",
   "Si lo cancelaste o lo marcaste hecho por error, tienes unos minutos para regresarlo (15 de inicio; los fija dirección en Configuración): con «Deshacer» en el aviso que sale, o con «Reabrir» en «Cerrados» o en su ficha. Pasado ese tiempo, pide uno nuevo.",
   "Lo reabre solo quien lo cerró. En la conversación del pendiente queda quién lo reabrió y por qué, y si estaba hecho, a quien lo pidió le avisa.",
   "Algunos los pone la revisión nocturna (dicen «De Revisión nocturna»): son errores urgentes en algo tuyo. Márcalo hecho cuando lo corrijas; si no es error, contéstalo en «Por revisar» con «Está bien así».",
   "La fecha sale en ámbar si vence hoy y en rojo si ya venció; mientras siga vencido, el sistema les recuerda a los dos.",
   "Puedes pedirle algo a varias personas a la vez y elegir si «Basta con que uno lo haga» o si «Cada quien lo tiene que hacer».",
   "Arriba ves tu propio cumplimiento de los últimos 30 días: qué tanto cierras a tiempo, a cuántas personas tienes esperando algo tuyo, cuántos días de retraso suman tus vencidos y cuánto tardas en cerrar. Dirección y Recursos Humanos ven además la pestaña «Equipo» con el de todos.",
   "Dale clic a un pendiente para abrir su ficha. Si preguntas ahí, a quien te lo pidió le llega un aviso y, mientras contesta, el pendiente dice «Esperando a» y su nombre, y no cuenta como retraso tuyo.",
   "Si alguien te preguntó en algo que pediste, arriba sale «Te preguntaron»: contesta en su ficha."
  ]
 },
 {
  "ruta": "/produccion/cuadrillas",
  "nombre": "Cuadrillas",
  "modulos": [
   "produccion"
  ],
  "nivel": 2,
  "texto": [
   "El taller por etapas con la gente adentro: quién trabaja qué ahorita, qué está pausado y qué sigue en cada etapa. No es otra captura: lo que se marca en la terminal de piso sale aquí al momento, y lo que se mueve aquí lo ve la terminal. La usan la gerencia de producción y los supervisores.",
   "Arriba está el personal por área; en verde quien está trabajando. Fuera del horario del taller (de noche, en fin de semana) ya no sale en verde: un aviso dice quién dejó su tiempo abierto y si está contando o no. Hay dos vistas. «Por etapa»: una columna por área con lo que está trabajando (con quien tiene su tiempo contando), lo pausado y lo que ya puede empezar; lo que todavía está en una etapa anterior se junta cerrado en «Más adelante» (Torno, que va en paralelo, sale lista desde que se libera la orden), para no repetir la misma orden en todas las columnas. «Por cuadrilla»: una columna por cuadrilla con lo que trabaja ahorita y lo que le sigue, como el tablero de Luis, y al final «Sin cuadrilla» con lo que nadie tiene asignado. En las dos, quien está planeado sale en línea punteada.",
   "La gerencia de producción arrastra a una persona a una tarjeta para meterla a esa cuadrilla, de una tarjeta a otra para moverla, o de regreso al personal para sacarla. Si con eso alguien deja de trabajar o empieza en una etapa en proceso, primero pregunta: su tiempo se cierra o empieza a contar en ese momento, así las horas de cada quien son las de verdad. Lo que no ha empezado solo queda planeado.",
   "«Personal de piso» (arriba, para la gerencia) es la gente de Producción: ahí le cambias el área y decides si entra a cuadrillas. Arriba de la lista eliges cómo se cuentan las horas de la terminal: solo el horario del taller (nadie pausa para desayunar o al irse) o lo que se marque tal cual (cuando haya una terminal por área). Abajo pones el horario del taller: qué días se trabaja, entrada y salida, los descansos y los días con otro horario (tiempo extra o un día que no se trabaja). Con ese horario se cuentan las horas y se arma el plan del Gantt. «Capacidad por área» dice cuántas horas por semana da cada área: en las automáticas, la gente del área que entra a cuadrillas × las horas de la semana del taller × el aprovechamiento (85 % al empezar). Cambia sola cuando mueves a alguien de área o de cuadrillas, y con ella se recalculan el plan y las fechas de entrega. Ahí mismo pones el aprovechamiento y decides qué áreas van a mano (Pruebas y Embarque, que no tienen gente fija). En «Especialidades» armas las cuadrillas por tipo de equipo dentro de un área (en Pailería: cribadoras, dosificadoras…): a cada una le dices qué equipos hace, y en la lista de la gente eliges la especialidad de cada quien; quien no tiene hace de todo. Con eso el plan le da a cada especialidad las horas de su gente, la gente del área sale junta por especialidad arriba del tablero y cada tarjeta dice de cuál es. Solo quien entra sale aquí y en la terminal; un coordinador o un ayudante de almacén quizá no. Altas, bajas y cambios de departamento siguen siendo de Recursos Humanos.",
   "La cola se acomoda arrastrando una tarjeta sobre otra; es la misma fila del Gantt, así que el plan se recalcula con ese orden. Clic en una tarjeta abre su detalle con lo mismo en botones (agregar, sacar, antes y después). Iniciar, pausar y terminar se sigue marcando en la terminal.",
   "Las horas que faltan y las que tiene encima cada persona salen de las horas estimadas menos las ya trabajadas, repartidas entre la cuadrilla. Son para darse idea, no una promesa."
  ]
 },
 {
  "ruta": "/produccion/gantt",
  "nombre": "Gantt (plan del taller)",
  "modulos": [
   "produccion"
  ],
  "nivel": 2,
  "texto": [
   "El plan del taller en el tiempo: cuándo empieza y termina cada etapa de cada orden y si llega a su fecha compromiso. No se captura nada: el ERP lo calcula con las horas estimadas de cada etapa, lo que puede trabajar cada área, la cuadrilla de cada etapa y el orden de la fila, y lo recalcula al momento con lo que se marca en el piso. Lo ven la gerencia de producción, los supervisores, almacén e ingeniería de procesos.",
   "Cómo se lee: cada barra es una etapa con el color de su área. Apagada, ya se hizo; llena con rayas que se mueven, se está trabajando (llena hasta hoy, translúcida en lo que le falta); rayada, pausada; translúcida, planeada. El rombo es la fecha compromiso: verde si el plan llega antes, rojo si no, y la franja roja son los días que faltarían. La línea azul es hoy.",
   "Arriba cambias la vista y el zoom. «Por orden»: un renglón por orden, en el orden de la fila. «Por pedido»: las órdenes juntas por pedido, con cuándo acaba el pedido completo. «Por área»: un renglón por área con lo que va a trabajar, y si el área tiene especialidades, un renglón por especialidad (Pailería · Cribadoras) y uno con lo demás; al pasar el mouse por una orden se resaltan sus etapas en todas las áreas. Días, semanas o meses cambia cuánto tiempo cabe en la pantalla, y puedes buscar una orden o ver solo las que van tarde. La vista y el zoom que dejes se quedan para la próxima vez.",
   "Pasa el mouse por una barra para ver sus fechas, cuánto le falta y quién la trabaja; clic abre la orden con todas sus etapas. La gerencia de producción acomoda la fila arrastrando una orden por su asa, o con Subir y Bajar en su detalle: el plan se recalcula y la cola de Cuadrillas y de la terminal queda en ese mismo orden.",
   "De dónde salen las fechas: el plan sigue el horario del taller (los días que no se trabaja se los salta). Cada área trabaja cada día su parte de sus horas por semana, y cada etapa avanza al día lo que dura la jornada por cada persona de su cuadrilla (sin cuadrilla, cuenta 2). En un área con especialidades, cada una trabaja con las horas de su gente: una cribadora solo avanza con la cuadrilla de cribadoras y con quien hace de todo, y lo que no es de ninguna especialidad lo hace cualquiera del área; una etapa empieza al día siguiente de que acaban las anteriores, salvo las que van en paralelo (Torno), que arrancan sin esperar. Las órdenes en espera no entran al plan: salen abajo con su motivo. Es un plan, no una promesa: si algo se atrasa en el piso, las barras se recorren solas."
  ]
 },
 {
  "ruta": "/produccion/gerencia",
  "nombre": "Tablero de producción",
  "modulos": [
   "produccion"
  ],
  "nivel": 1,
  "texto": [
   "El tablero de producción: todas las órdenes abiertas por estado, qué está atrasado, qué no tiene material y cuánto trabajo tiene cada área. Lo consulta todo el que ve producción (mantenimiento, almacén, ingeniería y los vendedores, para ver cómo van sus equipos); los botones de cada tarjeta solo los ve la gerencia de producción.",
   "Las columnas van de Planeada (validando material) a Liberada (lista para el taller), En proceso y Terminada (por entregar); en cada una, lo urgente y lo atrasado va arriba. Los indicadores de arriba filtran el tablero al darles clic, y también puedes buscar por folio, serie, equipo o cliente, o filtrar por cliente o etapa.",
   "En cada tarjeta: el avance (el personal de planta, almacén, ingeniería y compras ven también las horas), la fecha compromiso en verde, ámbar (3 días o menos) o rojo (ya pasó) y los faltantes de material, en rojo si alguno no se ha pedido a compras. La gerencia libera, sube o baja la prioridad y cambia la fecha desde la tarjeta; una orden no se libera sin la revisión de ingeniería.",
   "Una orden con la insignia \"En espera\" (cliente ausente, por ejemplo) no cuenta en los atrasos ni en la carga hasta que se reactive desde su detalle. Abajo, \"Carga del taller\" dice cuántas semanas de trabajo tiene cada etapa contra lo que puede trabajar por semana, y \"Actividad reciente\" muestra en vivo lo que marcan el taller, almacén e ingeniería; clic en una línea abre su orden."
  ]
 },
 {
  "ruta": "/produccion/mejoras",
  "nombre": "Mejoras (kaizen)",
  "modulos": [
   "produccion"
  ],
  "nivel": 2,
  "texto": [
   "Las mejoras del taller (kaizen): las ideas de la gente y los problemas que reporta el piso, cada una con quién la lleva, para cuándo y qué se logró. La ven y la usan producción, ingeniería de procesos y la gerencia.",
   "Cualquiera propone con «Tengo una idea», aquí o en la terminal de piso; basta una línea, y se le reconoce a quien la tuvo. Arriba, «Del piso, sin mejora todavía» junta lo que se reportó en los últimos 30 días (problemas, pausas con motivo, etapas reabiertas y fallas de máquinas): «Volverla mejora» la propone con lo que se reportó.",
   "El tablero va de izquierda a derecha: Propuestas, En marcha y Hechas. Ingeniería de procesos y la gerencia de producción deciden: le ponen quién la lleva y para cuándo y la ponen en marcha, o la descartan diciendo por qué. Quien la lleva escribe el resultado, sube la foto de antes y la de después, y la marca hecha. Quien la propuso recibe un aviso en cada paso.",
   "Las grandes se trabajan como A3: la ficha se abre en dos columnas, con la situación actual, el objetivo y la causa raíz a la izquierda, y las contramedidas, el plan y el resultado a la derecha. Las horas ahorradas al mes las estima quien la lleva.",
   "«Sugerir con IA» (para ingeniería de procesos y la gerencia) revisa los datos del taller de los últimos 90 días y propone mejoras con las cifras de donde salen. No guarda nada solo: «Proponerla» la manda al tablero y se decide como cualquier otra."
  ]
 },
 {
  "ruta": "/produccion/metricas",
  "nombre": "Métricas",
  "modulos": [
   "procesos"
  ],
  "nivel": 1,
  "texto": [
   "Los números de la planta para mejorar el proceso (lean): si entregamos a tiempo, cuánto tarda un equipo, qué parte de ese tiempo se trabaja de verdad, dónde se espera, cuántas horas se van contra lo estimado y cómo andan las máquinas. La usan ingeniería de procesos, la gerencia de producción y dirección.",
   "Arriba eliges el periodo (30 días a 12 meses). Lo primero que ves, si hace falta, es cuánto se marcó en la terminal: las horas, los tiempos y la eficiencia del flujo salen solo de las etapas que el piso marcó con quién las trabajó. Las entregas a tiempo y los equipos terminados no dependen de eso.",
   "«Por etapa» dice dónde se va el tiempo: cuánto espera cada área para empezar, cuánto se trabaja, las horas reales contra las del costeo, las pausas, los problemas y las etapas reabiertas. «Por equipo» compara las horas de cada modelo y «Por persona» las horas hombre de cada quien. Todas se descargan en CSV.",
   "Quien además ve costos tiene la mano de obra real contra la estimada a la tarifa de cada oficio: la diferencia en rojo es lo que costó tardarse de más. Las herramientas lean (5S, kaizen, A3, OEE, SMED) se irán habilitando conforme el equipo las use."
  ]
 },
 {
  "ruta": "/produccion/ordenes",
  "nombre": "Órdenes y material",
  "modulos": [
   "produccion"
  ],
  "nivel": 1,
  "texto": [
   "La lista de todas las órdenes de producción con su material: qué está apartado, qué falta y si ya se pidió a compras. La usan la gerencia, almacén e ingeniería para preparar cada orden antes de que entre al taller.",
   "Filtra por estado, atrasadas o con faltantes; el buscador encuentra folio, serie, equipo, cliente o pedido. Clic en un renglón abre la orden. Los renglones en rojo están atrasados; \"En espera\" en lugar de la fecha quiere decir que la orden está detenida (pasa el mouse para ver por qué). Debajo del material van tres palomitas: Ing. (ingeniería revisó la lista), Apartado (se apartó el material) y Alm. (almacén revisó la existencia física).",
   "\"Crear órdenes desde pedido\" muestra los pedidos confirmados que todavía tienen equipos por producir (el número del botón) y \"Orden para stock\" crea una sin cliente. Cada orden copia la lista de materiales del equipo al crearse, así un cambio posterior al catálogo no la mueve. Cada orden de un equipo saca su número de serie sola, si el equipo ya tiene código."
  ]
 },
 {
  "ruta": "/produccion/ordenes/:id",
  "nombre": "Órdenes y material › ficha",
  "modulos": [
   "produccion"
  ],
  "nivel": 1,
  "texto": [
   "Todo lo de una orden de producción en una pantalla: para quién es, su compromiso y avance, lo que se le vendió al cliente (la descripción de su partida, sin precio; «Imprimir» la saca en una hoja para el taller), el material, las etapas del taller y quién hizo qué y cuándo. Clic en el recuadro «Pedido y cliente» abre el pedido de la orden. Ventas y quien solo sigue el avance ven el compromiso, las etapas y la historia; el material, los planos y las horas son de planta, almacén, ingeniería y compras.",
   "\"Validación de material\" son los cinco pasos antes del taller, en orden: ingeniería revisa la lista, se aparta el material, se piden los faltantes a compras, almacén revisa la existencia física y la gerencia la libera. Cada paso guarda quién y cuándo, y cada quien ve el botón del suyo. Sin la revisión de ingeniería no se puede liberar.",
   "En Material, la lista sale agrupada por categoría (todo lo eléctrico junto, todo el material para aire, la tornillería…); con «Agrupar por» la cambias a subensamble (la parte del equipo donde va) y la próxima vez te sale como la dejaste; el buscador encuentra por nombre, clave o categoría, sin acentos. Al surtir, la lista también sale por categoría y con buscador; si escribiste cantidades en partidas que la búsqueda esconde, te avisa que también salen.",
   "En Material, Falta es lo requerido que todavía no está surtido ni apartado; Pedido es lo que ya se pidió a compras para esta orden; Disponible es lo que hay en planta sin apartar para nadie. Almacén entrega con el botón Surtir: anota quién recibe y lo que sale (si es una parte, lo demás queda por surtir). Las cantidades empiezan vacías: toca el número de «Por surtir» o de «Apartado» para llenarlo. De una partida no sale más de lo que falta: si hace falta más, pide el cambio a ingeniería con «Solicitar cambio a ingeniería», para que la lista del equipo quede como en la realidad; y no puede llevarse lo apartado para otra orden. En las órdenes que venían de la hoja, «Ya se había entregado con la hoja» registra lo que ya se dio antes del ERP sin descontar inventario otra vez. Si «Consumibles del taller» está encendido, lo marcado «Del taller» (discos, lijas, soldadura, EPP) no falta ni se surte a la orden: almacén lo da a nombre de quien lo recibe. En la línea de tiempo, «Ver partidas» en cada surtido dice qué salió, cuánto y de qué almacén.",
   "Ingeniería y la gerencia de producción cambian la lista solo para esta orden: «Agregar material» mete un componente o un subensamble completo (para fabricarlo aquí, con sus componentes, o ya hecho como pieza); en cada renglón, las flechas lo reemplazan por otro y el bote lo quita. Lo reemplazado o quitado no se borra: queda tachado con quién, cuándo y por qué, y se regresa con «Volver» si fue un error. Si el cambio es porque la lista del equipo está mal, pide además el cambio a ingeniería.",
   "En Etapas, el taller inicia, pausa, reanuda y termina cada una; el avance sale de las horas de las etapas terminadas. Si una se terminó por error, el aviso trae «Deshacer» (15 minutos para quien la terminó) y la gerencia tiene «Reabrir» en la etapa, con el motivo: regresa a pausada. Si algo de la lista está mal, usa \"Solicitar cambio a ingeniería\": queda en la orden y en la línea de tiempo.",
   "Las etapas de la orden salen de las horas por etapa del equipo, y la orden se termina sola al acabar la última. Si al equipo le falta una (por ejemplo Detallado), la gerencia usa «Agregar etapa» con sus horas: queda pendiente para el taller y, si la orden ya estaba terminada, regresa a «en proceso».",
   "Si el equipo se detiene sin cancelarse (el cliente dejó anticipo y no ha regresado), la gerencia usa \"Poner en espera\" con el motivo: deja de contar en la carga del taller y en los tiempos de entrega, no sale atrasada y la terminal no la muestra. \"Reactivar\" la regresa tal como estaba.",
   "Si el cliente canceló su pedido, arriba sale un aviso: la orden sigue siendo de ese pedido. «Regresar a stock» (de la gerencia, con el motivo) la suelta: vuelve a «Para stock» con su avance, su serie y el material surtido, y se le puede dar a otro pedido con «Usar». También sirve si se le dio «Usar» a la orden equivocada.",
   "Abajo, «Plan del taller» es el Gantt de esta orden y de las demás de su pedido: cuándo empieza y termina cada etapa y si llega a la fecha compromiso (el rombo). Pasa el mouse por una barra para ver sus fechas; clic en otra orden la abre. Se recalcula solo con lo que se marca en el piso."
  ]
 },
 {
  "ruta": "/produccion/pedidos",
  "nombre": "Pedidos",
  "modulos": [
   "produccion"
  ],
  "nivel": 2,
  "texto": [
   "Los pedidos vistos desde la planta: qué se vendió, a quién, para cuándo y cómo va cada equipo en el taller. No trae montos. La usan la gerencia de producción, los supervisores y almacén. Al abrir un pedido, cada partida trae su descripción tal como se le cotizó al cliente (medidas, calibres, motor, acabado), sin precio; las largas se abren con «Ver toda la descripción».",
   "«Activos» son los confirmados, en producción y listos para entregar; «Sin orden», los que tienen equipos que nadie está fabricando todavía. Las ventas de Mercado Libre que no llevan nada que fabricar no salen ahí: están en «Mercado Libre», y su envío se lleva en Almacén → Envíos. Dale clic a un pedido para ver sus partidas y las órdenes de cada una, con su avance; el folio de la orden te lleva a su detalle. Hasta abajo, «Plan del taller» es el Gantt de los equipos del pedido: cuándo entra y sale cada uno de cada área.",
   "La gerencia crea desde aquí las órdenes que faltan. Si hay un equipo igual (la misma clave) hecho o en proceso para stock, sale «Usar OP-…»: se asigna al pedido con un clic y ya no se fabrica otro. Usa primero «Usar» y después crea las que falten: una orden creada antes ocupa la partida y «Usar» ya no sale. Si te equivocas de orden, o el cliente cancela, la flecha junto a la orden la regresa a stock. Las partidas de texto, como una instalación, dicen «No se fabrica». Así se reemplaza la «S-» de la hoja.",
   "«Imprimir descripción» saca en una hoja lo que se vendió, partida por partida, para el taller (sin precios). Almacén entrega desde aquí: en el pedido, «Hoja de salida» imprime lo que firma el cliente (sin precios) y «Entregar» pide quién recibió y la foto de la hoja firmada. Si fue un error, «Deshacer» en el aviso durante 15 minutos."
  ]
 },
 {
  "ruta": "/produccion/seriales",
  "nombre": "Números de serie",
  "modulos": [
   "produccion"
  ],
  "nivel": 1,
  "texto": [
   "Aquí está cada equipo que hemos hecho con su número de serie: los del libro de seriales de la hoja (desde 2015) y los que numera el ERP. Sirve para saber de quién es un equipo, de qué pedido y factura, y qué tiene cada cliente. La usan producción, servicio y ventas.",
   "Busca por serie, cliente, equipo, pedido o factura; filtra por familia o por lo que sigue en taller. Clic en un renglón abre su ficha, con la orden de producción y los servicios que ha tenido.",
   "El número de serie ya no se escribe a mano: al crear la orden de producción de un equipo, el ERP arma su código y le pone el siguiente número de su familia, sin repetir ni saltar. Para eso cada equipo necesita su código una vez, en la pestaña Códigos y tiempos por equipo; la flecha muestra el serial que saldría con el número que sigue.",
   "En esa misma pestaña van los días de fabricación de cada equipo: lo que tarda con el taller libre. Con ellos y con la fila del taller, ventas ve al cotizar cuándo sale de verdad un equipo; si un equipo no tiene días, solo cuenta la fila.",
   "Si un equipo no tenía código cuando se creó su orden, la orden queda sin serie; captura el código y asígnalo desde la orden."
  ]
 },
 {
  "ruta": "/produccion/terminal",
  "nombre": "Terminal de piso",
  "modulos": [
   "produccion"
  ],
  "nivel": 2,
  "texto": [
   "La tablet de cada estación del taller: muestra lo que se trabaja en su etapa, en el orden de la cola que acomoda la gerencia en Cuadrillas o en el Gantt, y con botones grandes se inicia, pausa, reanuda o termina cada orden, o se reporta un problema. La usan los encargados de piso. Cada tarjeta dice primero la OP (la orden que se fabrica) y el equipo; abajo, más chico, el pedido y el cliente. En la TV, la cinta «Último» dice lo que pasó en el taller en los últimos días: qué OP empezó, pausó o terminó cada área y quién, los problemas, el material que entregó almacén y las órdenes nuevas o terminadas.",
   "Al iniciar o reanudar, toca quiénes trabajan: vienen marcados los que planeó la gerencia en Cuadrillas (en lo que no ha empezado dice «Le toca»); si no hay, la última cuadrilla de esa tablet. Primero sale la gente de esa etapa. Si alguien no está dado de alta o es un ayudante de paso, súmalo en «Sin nombre». En cada orden en proceso, «Se une» agrega a alguien y «Sale» lo quita, sin detener la etapa. Una persona no puede estar en dos etapas a la vez.",
   "Con eso salen las horas hombre de cada etapa: el tiempo de cada persona sumado. Se ven en el detalle de la orden contra las horas estimadas del costeo. Al pausar o terminar la etapa salen todos.",
   "¿Hay que pausar para desayunar? Arriba de la lista lo dice. Si la gerencia eligió «Solo el horario del taller», no: la noche, los días que no se trabaja y los descansos no cuentan; pausa solo cuando dejen la orden. Fuera de horario, lo que quedó iniciado dice «fuera de horario» y sigue solo cuando abre el taller. Si eligió «Lo que marque la terminal», sí: pausa al desayunar, al comer y al irte.",
   "¿Terminaste una por error? El aviso verde trae «Deshacer» unos segundos: la etapa regresa a pausada. Tienes 15 minutos; después, pídeselo a la gerencia de producción.",
   "¿Se te ocurre cómo hacerlo mejor? «Tengo una idea» (arriba, el foco) la manda a ingeniería de procesos y a la gerencia con tu nombre; basta una línea. Los problemas que reportas también les llegan para volverlos mejora.",
   "En lo que ya empezó, «¿Cuánto lleva?» (¼, ½, ¾, casi) dice cómo va la etapa: con eso el tablero, la TV y el plan saben cuánto falta aunque las horas no se hayan marcado desde el principio."
  ]
 },
 {
  "ruta": "/revision",
  "nombre": "Por revisar",
  "modulos": [],
  "nivel": 1,
  "texto": [
   "Lo que la revisión de cada madrugada encontró en algo tuyo y parece error: un registro repetido, un pago doble, una compra atrasada. Contesta cada uno.",
   "Paso 1: En «Para ti», lee el hallazgo y su evidencia; «Abrir» te lleva al registro.",
   "Paso 2: Si lo arreglaste, dale «Ya lo corregí»; si no es error, «Está bien así» con el porqué.",
   "Paso 3: Si sale «Corrígelo», el ERP hace la corrección por ti, con tus permisos.",
   "Busca, por ejemplo, un artículo o un cliente dado de alta dos veces, un pago capturado dos veces, una compra que ya debió llegar y no se recibió, una compra a un precio muy distinto al de la anterior o etapas terminadas sin pasar por la terminal. Si sale algo, a las 6 de la mañana te llega un aviso.",
   "Lo urgente (un pago repetido, una compra con un cero de más, una compra muy atrasada) también te llega a Pendientes, para el siguiente día hábil: ahí se pone rojo si se vence y cuenta para tu cumplimiento. Contestarlo en cualquiera de los dos lados cierra el otro.",
   "Si no era error, «Está bien así» lo cancela en Pendientes y no cuenta para nadie. Lo que se arregla solo (una compra que por fin se recibe) se cierra sin que hagas nada.",
   "«Está bien así» pide siempre el porqué. Si dirección lo tiene prendido, la IA lo lee: si es una razón de verdad (son dos sucursales, el proveedor cambió la fecha) se cierra; si suena a costumbre (dejar vacío un dato porque «todavía no se sabe»), te pregunta, hasta 3 veces.",
   "Si al final no queda claro, se queda abierto con «Lo ve dirección» y le llega con la conversación. Lo que contesta dirección no pasa por la IA.",
   "«Ayúdame a corregirlo» sale cuando la corrección es un dato de captura (fechas, tiempo de entrega, notas, contacto, categoría, cantidades de partida). La IA te propone el cambio exacto, con cómo está y cómo quedaría; puedes decirle algo que deba saber («el tiempo es de 45 días hábiles»).",
   "Nada se aplica hasta que eliges «Aplicar a mi nombre»: se hace con tus permisos, como si lo capturaras a mano, y queda en la bitácora. Precios, dinero, existencias y permisos nunca se cambian así.",
   "Lo que dice «Regla» lo encontró una regla fija; lo que dice «IA» (con destellos ✦) lo señaló la IA al leer lo de ayer. Ninguno cambia nada sin que tú lo digas. En «Contestado» ves lo que ya respondiste.",
   "Dirección abre en «Todo lo abierto», con a quién le toca cada cosa, y ve además «Patrones» (consumos que se disparan, ajustes a la baja que se repiten, gastos iguales en caja chica), que nunca le llegan a la persona.",
   "En «Anoche» dirección ve lo que la IA leyó de cada módulo, y en «Consejos», los que recibió cada quien y si les sirvieron.",
   "En «Reglas», dirección puede apagar la revisión, la IA, los consejos, que la IA cuestione el «Está bien así» o cada regla, y correr las reglas en ese momento. En «Contestado» puede ver lo que cada quien platicó con la IA."
  ]
 },
 {
  "ruta": "/rrhh/checklist",
  "nombre": "Checklist diario",
  "modulos": [
   "objetivos"
  ],
  "nivel": 1,
  "texto": [
   "Aquí se marca, día por día, si cada persona cumplió: entrega del celular, equipo de protección, limpieza de su área y revisión de vehículos. Está hecho para el celular de quien supervisa: un toque por persona.",
   "Arriba eliges qué revisas y el día (con las flechas o la fecha). El celular se revisa tres veces: entrada, break 1 y break 2. Toca la palomita si cumplió o la X si no; con la X puedes anotar qué pasó (Enter guarda). «Los restantes cumplieron» marca de un jalón a quienes falten.",
   "Solo salen las personas que tienen ese punto palomeado en su ficha (Personal): el EPP, por ejemplo, al personal de taller. Si no sale alguien, pídele a Recursos Humanos que lo palomee. A ti no te puedes marcar: te marca otra persona. La limpieza se marca por área y cuenta para todos los que comparten esa área.",
   "Estas marcas alimentan los objetivos del mes. Un día sin marca no cuenta en contra. Puedes corregir hasta una semana atrás; después solo Recursos Humanos, y nunca en un mes ya calificado."
  ]
 },
 {
  "ruta": "/rrhh/empleados",
  "nombre": "Personal",
  "modulos": [
   "rrhh"
  ],
  "nivel": 1,
  "texto": [
   "Aquí está la plantilla de la empresa: cada persona con su puesto, departamento, área del taller, antigüedad y vacaciones. La usa Recursos Humanos para dar altas, bajas y llevar la ficha de cada quien.",
   "Dale clic a un renglón para abrir su ficha a la derecha sin perder la lista. Ahí cambias sus datos (Enter guarda), ves su historial de vacaciones e incidencias y, al final, la das de baja o registras un reingreso. Con «Nuevo empleado» das de alta a alguien. Quien es de Producción trae «Entra a cuadrillas»: con eso sale en la terminal de piso para asignarle trabajo (al darlo de alta con su área entra de una vez). La gerencia de producción ve y acomoda solo a la gente de Producción.",
   "En la ficha, debajo de su inicial, «Subir foto» le pone foto (en el celular abre la cámara); la ven solo Recursos Humanos, la gerencia de producción (de su gente) y la propia persona. En «Checklist diario» palomeas qué se le revisa cada día (EPP, entrega de celular, revisión de vehículo): sin palomear no sale en ese checklist. La columna «Checklist» de la lista te dice a quién te falta.",
   "Arriba filtras activos, bajas o todos, y por departamento. Los indicadores de ausentes y solicitudes te llevan directo a Vacaciones e incidencias. El botón CSV baja la lista para Excel.",
   "La antigüedad y las vacaciones salen solas de la fecha de ingreso; quien venía del control de vacaciones en Excel arranca con el saldo que tenía ahí, y en su ficha puedes corregirlo eligiendo de qué periodo es. En la ficha ves cada periodo (cuánto le tocó, usó, adelantó y le queda, y cuándo vence) y en su historial a qué periodo se cargó cada vacación, o si fue adelanto. Una baja no borra a nadie: su historial se conserva. Si la persona tenía cuenta en el ERP, desactívala al darla de baja para que ya no pueda entrar."
  ]
 },
 {
  "ruta": "/rrhh/incidencias",
  "nombre": "Vacaciones e incidencias",
  "modulos": [
   "rrhh"
  ],
  "nivel": 1,
  "texto": [
   "Aquí se llevan las vacaciones, permisos, faltas, incapacidades, retardos y horas extra. Recursos Humanos aprueba las solicitudes y ve quién falta cada día; la gerencia de producción también puede registrar las de su gente.",
   "«Por aprobar» muestra cada solicitud con el saldo de hoy, de qué periodo saldrían los días o cuántos serían adelanto (cuenta la fecha: después de su aniversario ya salen del periodo nuevo), y quién más falta esos días: apruébala o recházala con un motivo, que la persona verá en su historial. «Calendario» pinta el mes con un color por tipo; las solicitudes pendientes salen punteadas y puedes dar clic en un día para registrar algo en esa fecha.",
   "«Saldos de vacaciones» tiene la tabla de la ley y lo que le queda a cada quien: lo vigente, lo adelantado y qué días vencen primero. Cada vacación se carga al periodo más viejo vigente; si ya no hay, queda como adelanto del siguiente y se le descuenta cuando llegue, sin perdonarse al cumplir año. Lo que sobra de un periodo vence 18 meses después de su aniversario. «Historial» muestra lo de los últimos 13 meses, con filtros por tipo y estado, y se puede bajar en CSV.",
   "Solo lo aprobado cuenta en el saldo y en la prenómina. Vacaciones y permisos se cuentan en días hábiles (la semana laboral y los descansos de Configuración, sin feriados de ley); la incapacidad, en días naturales como el IMSS."
  ]
 },
 {
  "ruta": "/rrhh/mi-desempeno",
  "nombre": "Mi desempeño",
  "modulos": [
   "mi_desempeno"
  ],
  "nivel": 1,
  "texto": [
   "Aquí ves tus objetivos de cada mes y cómo te fue en cada uno. Lo ves tú, tu jefe directo, Recursos Humanos y dirección; aquí no aparecen montos.",
   "Arriba elige el mes: cada tarjeta trae tu resultado. Abre por omisión el último mes ya calificado. «En calificación» quiere decir que tu jefe todavía no termina, «En revisión» que lo están revisando Recursos Humanos o dirección, y «Aprobado» que ya es definitivo. En rojo con una llave: se activó la llave y ese mes el bono vale 0.",
   "Abajo está cada indicador con su peso, su regla y lo que se midió. Dale a «Ver evidencia» para ver los pedidos, órdenes o marcas del checklist que lo explican: un punto rojo cuenta en contra; uno verde, no.",
   "Tú no te calificas. Si algo no te cuadra, escríbelo en Comentarios: tu jefe y Recursos Humanos lo leen y pueden corregirlo antes de que se apruebe. Ya aprobado, solo se cambia con un ajuste que autoriza otra persona."
  ]
 },
 {
  "ruta": "/rrhh/objetivos",
  "nombre": "Objetivos y bonos",
  "modulos": [
   "objetivos"
  ],
  "nivel": 1,
  "texto": [
   "Aquí se califican los objetivos de cada persona mes con mes y de ahí sale su bono. Los jefes directos califican a su gente, Recursos Humanos revisa y arma las plantillas, y dirección aprueba.",
   "Con las flechas de arriba eliges el mes. En «Evaluaciones del mes» dale clic a una persona para ver cada indicador con su regla, lo medido y la evidencia; ahí el jefe captura lo que falta (Enter guarda) y la envía a Recursos Humanos. Las insignias de estado dicen en qué paso va cada una.",
   "«Plantillas por puesto» define qué se le pide a cada puesto y cuánto pesa; «Personas y jefes» dice quién evalúa a quién (solo Recursos Humanos); «Indicadores» es el catálogo completo, con lo que falta para que cada uno se mida solo.",
   "Lo que el sistema puede medir se mide solo y guarda su evidencia: ventas, entregas, inventario, el checklist, qué tan rápido se asignan y se atienden los leads, los seguimientos de cotización, las preguntas de Mercado Libre, los preventivos y las fallas de las máquinas, las etapas marcadas en la terminal, los pendientes a tiempo y las ideas de mejora. Los plazos («en 4 horas», «al siguiente día hábil») cuentan horas de horario: lo que llega de noche no cuenta en contra hasta que se abre. Lo demás lo pone el jefe. Nadie se califica a sí mismo y un mes aprobado ya no se toca: se corrige con un ajuste que autoriza otra persona. Los montos del bono solo los ve quien tiene nómina."
  ]
 },
 {
  "ruta": "/rrhh/prenomina",
  "nombre": "Prenómina",
  "modulos": [
   "nomina"
  ],
  "nivel": 1,
  "texto": [
   "Aquí se arma la nómina de cada semana, de viernes a jueves, para pagarla el viernes siguiente. La usa Recursos Humanos: revisa, agrega conceptos, cierra la semana y le pasa el CSV al contador.",
   "Elige la semana arriba; por omisión abre la que ya terminó y falta cerrar. Dale clic a una persona para ver su renglón desglosado. «Agregar concepto» registra pagos o descuentos fuera del sueldo con su motivo, y «Cerrar semana» la congela. Ya cerrada, finanzas da «Registrar pago» con la fecha y la cuenta de donde salió el dinero, y la semana dice «Pagada el…» para que sepas que ya se pagó. Las pestañas Préstamos, Ahorro y Sueldos llevan los préstamos con su saldo, la caja de ahorro y el historial de sueldos.",
   "En «Préstamos», al registrar uno sale su pagaré para imprimir y firmar (sin interés); dale clic a «Pagaré por firmar» para anotar la fecha de firma o reimprimirlo. «Abonar» registra un pago mayor al descuento: en efectivo (dices a qué cuenta entró, queda en finanzas y sale recibo), o descontando más en la nómina de una semana abierta. Si alguien se da de baja debiendo, el saldo completo se descuenta en su última semana (finiquito).",
   "En «Ahorro», «Ahorro» en cada renglón captura cuánto decidió ahorrar la persona por semana: se descuenta solo hasta que lo cambies, y al cerrar la semana pasa a su saldo. Cuando pida su dinero, «Retiro» lo registra el día que se le entrega, con la fecha en que lo pidió (respetando los días de anticipación de las reglas) y la cuenta de donde salió, que queda también en finanzas, y saca el recibo con folio para firmar. Dale clic a una persona para ver sus movimientos, reimprimir recibos o registrar el saldo que ya traía de Excel. «Cambiar» en Reglas fija los días de anticipación, lo que pone la empresa (hoy nada) y el interés de los préstamos (hoy ninguno).",
   "Todo sale de lo aprobado en Vacaciones e incidencias: las faltas y los permisos sin goce descuentan días, el retardo descuenta su tiempo, las vacaciones pagan prima, y las horas extra se pagan dobles hasta 9 a la semana y triples después. El bono sale de los objetivos aprobados y se paga cuando dirección define su base.",
   "Es lo que se le paga a cada quien antes de lo fiscal: ISR, IMSS y timbrado los calcula el contador con el CSV. Una semana cerrada ya no cambia; un error se corrige en la semana abierta con otro concepto."
  ]
 },
 {
  "ruta": "/semana",
  "nombre": "Tu semana",
  "modulos": [
   "asistente"
  ],
  "nivel": 1,
  "texto": [
   "Tu resumen de los lunes: la semana pasada contra la anterior y lo que viene en esta. Sirve para preparar la junta o saber cómo vamos.",
   "Paso 1: Lee «La semana en una frase» y dale clic a una tarjeta para ir a atenderla.",
   "Paso 2: Revisa «Esta semana» para ver lo que tiene fecha de lunes a domingo.",
   "«La semana en una frase» la narra la IA con los números (o las reglas del ERP si no está conectada); el botón de flechas la vuelve a escribir. En las tarjetas, el porcentaje compara contra la semana anterior: verde si subió, rojo si bajó.",
   "La agenda «Esta semana» sale del calendario: todo lo que tiene fecha de lunes a domingo y tu puesto puede ver (entregas, lo que llega, taller, servicios, pagos, vacaciones, tus pendientes). Lo que ya pasó su fecha y sigue abierto sale en rojo.",
   "Dale clic a un renglón para ir a su pantalla, o a «Abrir el calendario» para ver más allá de esta semana.",
   "Si eres vendedor, las ventas y «Quién compró más» son solo de tus clientes. Las ventas de esta pantalla van con IVA, como en el libro de ventas de la hoja.",
   "Esta pantalla sale en el menú de los puestos que tienen el Asistente."
  ]
 },
 {
  "ruta": "/servicio",
  "nombre": "Servicios y cuadrillas",
  "modulos": [
   "servicio"
  ],
  "nivel": 1,
  "texto": [
   "El tablero del servicio postventa. Ventas pide aquí el servicio para su cliente (\"Pedir servicio\") y la gerencia de producción le pone fecha y cuadrilla; a quien pidió le llega un aviso.",
   "Los indicadores de arriba filtran la lista al darles clic. El calendario de cuadrillas muestra quién sale y cuándo, dos semanas a la vez (el botón Hoy regresa a esta semana): una persona nunca aparece en dos servicios a la vez porque el sistema no lo permite, ni la deja salir con vacaciones o incapacidad aprobadas. Clic en un renglón de la lista abre el servicio.",
   "\"Carga del taller por semana\" suma producción y horas en servicio contra la capacidad de cada área: verde con holgura, ámbar justa (85 a 100 %) y rojo cuando se pasa. Pasa el mouse por una celda para ver de dónde sale. Si eres de almacén, a la derecha ves los insumos y refacciones que tienes que entregar."
  ]
 },
 {
  "ruta": "/servicio/:id",
  "nombre": "Servicios y cuadrillas › ficha",
  "modulos": [
   "servicio"
  ],
  "nivel": 1,
  "texto": [
   "La ficha de un servicio: qué pidió el cliente, cuándo y con quién se atiende, los insumos que lleva, las fotos y el cierre.",
   "Los pasos de arriba (Pedido, Programado, En curso, Cerrado) se marcan con fecha y quién. Una reparación en planta no empieza sin recibir el equipo con fotos de cómo llegó, y ningún servicio se cierra sin foto del trabajo terminado, el nombre de quien recibe y las notas de lo que se hizo.",
   "En una garantía ves si sigue vigente según la entrega del equipo con ese número de serie. Las horas de la cuadrilla se descuentan de la capacidad de su área en el taller. Los insumos salen de almacén o se piden a compras. Las fotos no se pueden borrar."
  ]
 },
 {
  "ruta": "/servicio/maquinas",
  "nombre": "Máquinas y herramienta",
  "modulos": [
   "mantenimiento"
  ],
  "nivel": 1,
  "texto": [
   "El catálogo de máquinas, herramienta, vehículos, instalaciones y equipo de oficina: en qué estado está cada uno, cuánto ha fallado y qué mantenimiento preventivo le toca. La lleva mantenimiento (o la gerencia de producción); el personal de producción reporta fallas y presta herramienta.",
   "El estado no se captura: sale de las órdenes de mantenimiento abiertas. Operando, Con falla (sigue trabajando pero alguien reportó algo), Parada (la falla la detiene) y En reparación. \"Reportar falla\" abre el formulario rápido y \"Resguardos\" lleva la herramienta prestada.",
   "Pestañas: Máquinas (clic abre su ficha), Órdenes abiertas (fallas y preventivos; clic abre el detalle a un lado) y Preventivos. Un preventivo se programa por fecha (cada tantos días, «el primer lunes de cada mes» o «el día 15»), por horas de uso o lo que pase primero, y su orden se genera sola con el checklist de su rutina, siempre en un día que el taller trabaja.",
   "\"Terminal\" abre la pantalla de mantenimiento para darle play a la máquina que vas a trabajar y pausa al dejarla.",
   "\"Etiquetas QR\" abre una hoja para imprimir y recortar las etiquetas de todas las máquinas (o de las del filtro que tengas puesto). Pegada en la máquina, quien vea una falla la escanea con el celular y le sale el reporte de esa máquina, sin buscarla.",
   "En Máquinas, el filtro «Dadas de baja» muestra lo que ya no conviene reparar, con la fecha y el motivo. Al dar de alta, la categoría se elige de la lista o se escribe una nueva (impresora, aire acondicionado…); el tipo «Equipo de oficina» es para computadoras, impresoras y lo demás que no es del taller.",
   "Al abrir una orden preventiva, cada punto del checklist se marca Bien o Falla (con qué tiene); la orden no se cierra mientras falte alguno. Al cerrarla, mantenimiento anota qué se hizo y las horas que le dedicó (no las que estuvo parada la máquina); si le dieron play en la terminal, las horas ya vienen llenas."
  ]
 },
 {
  "ruta": "/servicio/maquinas/:id",
  "nombre": "Máquinas y herramienta › ficha",
  "modulos": [
   "mantenimiento"
  ],
  "nivel": 1,
  "texto": [
   "La ficha de una máquina o herramienta: sus datos, su historial de mantenimiento, sus planes preventivos y, si se presta, quién la tiene.",
   "La tarjeta «Criticidad» dice por qué la máquina tiene la que tiene: los puntos de cada factor. Dos los califica mantenimiento con el lápiz (qué pasa si se para y su riesgo de seguridad); las fallas y el costo del año salen de sus órdenes; el respaldo y los días de refacción los busca el sistema, y se pueden corregir. Se recalcula sola al reportar o cerrar una falla y cada madrugada. Mientras falten los dos que se califican, se queda la de la hoja.",
   "Fallas y tiempo parada cuentan los últimos 12 meses. Muy alta o alta es crítica: sus fallas van primero. También dice el tipo de mantenimiento (preventivo, predictivo o autónomo), quién lo hace y, si es herramienta que siempre trae la misma persona, a quién está asignada. Si tiene horómetro, registra sus horas con \"Registrar horas\": la lectura no puede ser menor que la anterior y, al guardarla, si ya toca un preventivo por horas, su orden sale en ese momento.",
   "En \"Plan preventivo\" mantenimiento o la gerencia agregan o editan los planes y le ponen su rutina: la lista de puntos que se palomean. En «Cuándo toca» eliges cada tantos días, un día de la semana del mes (el primer lunes, el último viernes) o un día fijo del mes, cada uno o cada varios meses; además puede ser cada tantas horas de uso, lo que pase primero. Abajo te dice qué día toca el siguiente. Si cae en fin de semana, feriado o descanso, pasa al siguiente día que se trabaja (en los planes por mes, sin brincarse al mes siguiente). La orden se genera sola: por fecha, unos días antes de vencer; por horas, al llegar a ellas.",
   "\"Manuales y fichas técnicas\" junta el manual, la ficha técnica, diagramas y garantía: un PDF, una foto o una liga de Drive. Al agregarlo eliges si es solo de esta máquina o de todas las de su tipo y modelo. \"Etiqueta QR\" la enseña para imprimirla y pegarla en la máquina; en un Android con Chrome también la graba en una etiqueta NFC.",
   "Lo que ya no conviene reparar se da de baja con «Dar de baja» y el motivo: sus órdenes abiertas se cancelan, sus planes se apagan y deja de contar en las métricas. Si estaba prestada, primero se recibe en Resguardos. Se puede reactivar desde la misma ficha; sus planes se quedan apagados hasta que los prendas.",
   "Abajo, \"Refacciones de este tipo de máquina\" lista las piezas que lleva (por tipo y modelo) y cuántas hay en planta; se piden desde una orden de mantenimiento."
  ]
 },
 {
  "ruta": "/servicio/metricas",
  "nombre": "Métricas de mantenimiento",
  "modulos": [
   "mantenimiento"
  ],
  "nivel": 1,
  "texto": [
   "Cómo anda el mantenimiento: si las máquinas están disponibles, cada cuánto fallan, cuánto tardan en volver a trabajar y si el preventivo se hace a tiempo. La usan mantenimiento, la gerencia de producción, ingeniería de procesos y dirección.",
   "Arriba eliges el periodo. Los indicadores: disponibilidad (qué parte del tiempo estuvieron listas), MTBF (cada cuánto fallan), MTTR (cuánto tardan en repararse), preventivo a tiempo, cuánto del trabajo de mantenimiento es preventivo y lo que sigue abierto.",
   "«Disponibilidad por semana» enseña la disponibilidad contra la meta del 98 % y, debajo y en las mismas semanas, las fallas y los preventivos a tiempo o tarde: así se ve si una semana mala vino de fallas o de preventivo atrasado. El Pareto dice cuántas máquinas juntan el 80 % de las horas paradas (clic en una barra abre su ficha).",
   "«Carga de preventivo» proyecta de cada plan los preventivos de las próximas 8 semanas, por criticidad y con horas de técnico estimadas, para repartir antes las semanas pesadas. «Fallas contra tiempo de reparación» separa las máquinas que fallan seguido (crónicas: causa raíz, preventivo) de las que tardan en volver (agudas: refacciones, proveedor). «Lo abierto» las reparte por antigüedad; «Vuelven a fallar», las reparaciones que no duraron 30 días. En «Por máquina» ves todo por máquina (clic abre su ficha) y lo descargas en CSV.",
   "Los números salen de las órdenes de mantenimiento: cuándo se reportó, cuándo se paró y volvió la máquina, cuándo se cerró y las horas del técnico. Si una orden se cierra sin esos datos, no cuenta bien. Quien ve costos también ve lo que costó cada máquina.",
   "Todos los tiempos (disponibilidad, horas paradas, MTBF y MTTR) son horas laborales del taller: no cuentan noches, fines de semana, feriados ni descansos, con el horario que pone la gerencia de producción. Lo dado de baja cuenta solo hasta el día de su baja."
  ]
 },
 {
  "ruta": "/servicio/resguardos",
  "nombre": "Resguardo de herramienta",
  "modulos": [
   "mantenimiento"
  ],
  "nivel": 2,
  "texto": [
   "Aquí se anota quién se lleva una herramienta del taller (a campo o a otra área), desde cuándo y cómo la regresó. Lo usan mantenimiento, la gerencia y el personal de producción. La herramienta que siempre trae la misma persona (su soldadora) no se presta aquí: se asigna en la ficha de la máquina.",
   "\"Prestar herramienta\" registra quién se la lleva, para qué (o para qué servicio; uno de los dos es obligatorio) y cuándo debe regresar. \"Recibir\" la cierra con su estado: bien, dañada o incompleta, y si quieres una foto de cómo regresó; si regresa dañada o incompleta, la falla se reporta sola, con la foto. Una máquina parada o en reparación no se presta.",
   "Sale en rojo lo que pasó de su fecha de regreso o lleva más días fuera que el límite. El límite lo cambias junto a los filtros (\"Marcar después de … días\")."
  ]
 },
 {
  "ruta": "/servicio/rutinas",
  "nombre": "Rutinas (checklist)",
  "modulos": [
   "mantenimiento"
  ],
  "nivel": 1,
  "texto": [
   "Las rutinas de mantenimiento: la lista de puntos que se palomea en cada preventivo, por tipo de máquina y frecuencia. Las edita el encargado de mantenimiento (o la gerencia de producción); los demás las ven.",
   "Clic en una rutina la abre a un lado. Cada punto lleva su sección (Seguridad, Limpieza, Eléctrico…) y qué se revisa; Enter agrega otro debajo, y con las flechas los acomodas. Las recomendaciones salen arriba del checklist en cada orden. «Duplicar» sirve para hacer la trimestral a partir de la mensual.",
   "Al guardar, los preventivos que ya salieron con esa rutina y nadie ha empezado toman la lista nueva; los que ya se están palomeando se quedan como estaban. La columna «La usan» dice qué máquinas la tienen en su plan; una rutina en uso no se puede desactivar. A cada plan se le pone su rutina en la ficha de la máquina."
  ]
 },
 {
  "ruta": "/servicio/terminal",
  "nombre": "Servicios y cuadrillas › terminal",
  "modulos": [
   "servicio"
  ],
  "nivel": 1,
  "texto": [
   "La terminal de mantenimiento: para llevar el tiempo de cada reparación o preventivo sin anotarlo. Le das play a la orden que vas a trabajar y pausa cuando la dejas; al cerrarla, las horas trabajadas salen solas. La usan mantenimiento y el personal de piso que atiende máquinas.",
   "Arriba está lo que traes en play (con cuánto llevas) y luego lo que está en pausa, primero lo último que pausaste, para regresar rápido. Abajo, los preventivos por hacer (los vencidos primero) y las fallas reportadas (las que tienen la máquina parada y las más críticas primero). El buscador encuentra la máquina por número o nombre.",
   "Dar play en otra orden pausa la que traías: una persona trabaja una a la vez. Al pausar eliges por qué (esperando refacción, te vas a otra, fin del día) o solo pausas. Si dos personas trabajan la misma máquina, cada quien le da play y sus horas se suman.",
   "Toca la tarjeta para abrir la orden: ahí palomeas el checklist, escribes el diagnóstico, pides refacciones y la cierras. El play no pide diagnóstico; ese se escribe cuando ya sabes qué tiene."
  ]
 },
 {
  "ruta": "/sistema/bitacora",
  "nombre": "Bitácora",
  "modulos": [
   "admin"
  ],
  "nivel": 1,
  "texto": [
   "Aquí queda quién cambió qué y cuándo en el ERP: altas, cambios y bajas de pedidos, clientes, usuarios, permisos, configuración y lo demás. Nada se borra de aquí.",
   "Filtra por qué se cambió, quién, el tipo de acción y las fechas. La columna «Registro» dice de qué es cada cambio; en las listas de materiales, el equipo, el artículo y la cantidad, y en el material de una orden, la OP, el artículo y cuánto lleva. Dale clic a un renglón para ver el antes y el después de cada dato (los artículos, órdenes y personas salen con su nombre), la historia completa de ese registro y, si existe, un enlace para abrirlo. El CSV baja lo que ves.",
   "Se muestran los 500 cambios más recientes: para ir más atrás usa los filtros. Solo ves los cambios de lo que tu rol puede ver: sueldos y datos sensibles necesitan Recursos Humanos nivel 3, y costos, el módulo de costos."
  ]
 },
 {
  "ruta": "/sistema/configuracion",
  "nombre": "Configuración",
  "modulos": [
   "admin"
  ],
  "nivel": 3,
  "texto": [
   "Aquí están los datos de la empresa y los catálogos que usan todas las pantallas: datos fiscales, IVA, fecha de arranque, tema con el que abre el ERP (oscuro o claro), semana laboral, reglas de venta, almacenes, etapas del taller, tipos de cambio e integraciones (Mercado Libre y Skydropx). La usan sistemas y dirección.",
   "Cada pestaña es una sección. En las tarjetas con formulario cambias los datos y das «Guardar»; en las tablas cada celda se guarda sola al salir de ella o con Enter, como en la hoja (Escape la regresa). Lo que tu rol no puede cambiar sale en solo lectura y dice quién sí puede.",
   "Algunas cosas mueven números en otras pantallas: la semana laboral y los descansos cuentan los días de vacaciones y permisos; la fecha de arranque marca el corte entre la hoja y el ERP; un almacén no disponible para planta no cuenta para producción ni para el cotizador; en Taller, la capacidad de las áreas automáticas sale de su gente (no se escribe a mano) y la de las demás sí; con «Consumibles del taller» encendido (en Almacenes), lo de las categorías marcadas sale a nombre de quien lo recibe y no a la orden, y al encenderlo se suelta lo que estaba apartado de esos artículos para órdenes; el tipo de cambio más reciente convierte todo lo que está en dólares. Cada cambio queda en la bitácora.",
   "En «Empresa», «Deshacer errores» fija cuántos minutos tiene quien se equivocó para deshacer una salida o un traspaso en almacén, y para reabrir un pendiente que cerró (15 de inicio). En 0 se apaga: almacén pide un ajuste y el pendiente se pide de nuevo.",
   "En «Integraciones», dirección conecta la cuenta de Mercado Libre (los pasos vienen ahí mismo), elige a las personas que la atienden (a todas les llegan los avisos, aunque alguna todavía no acepte su invitación), si las ventas entran como pedidos y a nombre de quién quedan. La tarjeta dice si los avisos de ML están entrando; «Revisar ahora» vuelve a intentar lo que quedó pendiente. ML solo avisa lo nuevo: «Traer lo pendiente» trae las preguntas sin contestar y los reclamos que ya estaban, y las ventas desde la fecha que elijas. En la de Skydropx, quien administra envíos prueba la conexión (muestra el saldo), elige la dirección de la planta de las que ya están en Skydropx, la clave de carta porte, el tipo de empaque y el recargo que se le suma al flete cuando un vendedor lo cotiza en una cotización; sin dirección y carta porte no se puede generar guía.",
   "En «Ventas», la tarjeta «Leads de recepción» dice a quién le llega cada lead nuevo: bandeja (el primero que lo toma), la gerencia lo asigna o quien lo registra escoge. Ahí mismo se ponen las horas para avisar a la gerencia si nadie lo toma o nadie lo atiende, y qué vendedores reciben leads. La cambian la gerencia de ventas o dirección."
  ]
 },
 {
  "ruta": "/sistema/importar",
  "nombre": "Importar de Sheets",
  "modulos": [
   "admin"
  ],
  "nivel": 3,
  "texto": [
   "Aquí ves cómo va la migración desde las hojas de Google: qué se trajo, si los precios del ERP cuadran con los de la hoja y qué problemas de las hojas quedaron a la vista. La usan sistemas y dirección durante la transición.",
   "Arriba, el indicador de precios compara los precios de equipo del ERP contra «Nuevo Costeo»: si alguno sale distinto, revísalo antes de cotizarlo. «Lo que se leyó» cuenta lo que trajo la última importación y «Para revisar» lista lo que hay que limpiar.",
   "«Subensambles escondidos» propone grupos de piezas que se repiten idénticos en varios equipos; quien edita listas de materiales puede convertirlos en subensamble o descartarlos, y el costo no cambia. La reimportación se corre desde una computadora (instrucciones abajo) y no duplica nada; las existencias de arranque se cargaron una sola vez."
  ]
 },
 {
  "ruta": "/sistema/uso",
  "nombre": "Uso del ERP",
  "modulos": [
   "admin"
  ],
  "nivel": 3,
  "texto": [
   "Quién usa el ERP, cuánto, en qué y cuánto cuesta la IA. Es para dirección y sistemas: sirve para acompañar a quien se está quedando en la hoja, en el papel o en WhatsApp, ver qué pantallas de verdad se usan y cuidar el gasto de la IA.",
   "Arriba están los filtros, que cambian todo: el periodo (7, 30 o 90 días), el rol, qué medir (tiempo activo, cambios, consultas a la IA, costo de la IA o personas activas) y «Comparar» con el periodo anterior del mismo largo. Los indicadores dicen cuánto subió o bajó cada cosa contra ese periodo.",
   "Las gráficas: la medida día por día contra el periodo anterior (línea punteada); cada persona contra sí misma (barra gris = antes); el mapa de calor, un cuadro por persona y día, más oscuro entre más uso; en qué secciones del ERP se le va el tiempo a cada quien; y en qué se va el costo de la IA (resúmenes, preguntas, documentos, revisión nocturna…). Abajo, la tabla por persona; «Sin usarlo» junta las cuentas activas que no hicieron nada. Dale clic a una persona para ver su detalle por día, sus pantallas, en qué registra cambios, para qué usa la IA y cuánto costó, y a qué horas trabaja.",
   "El tiempo activo cuenta solo los minutos en que la persona estuvo moviéndose en el ERP con la pestaña a la vista; dejarlo abierto no suma. No se guarda qué datos vio, solo qué pantalla. El costo de la IA es un estimado con los precios de Configuración; lo que factura el proveedor manda. El tiempo y las pantallas se cuentan desde el 5 de noviembre de 2026; los cambios y la IA traen su historia de antes."
  ]
 },
 {
  "ruta": "/sistema/usuarios",
  "nombre": "Usuarios y permisos",
  "modulos": [
   "admin"
  ],
  "nivel": 3,
  "texto": [
   "Aquí decides quién entra al ERP y qué puede hacer cada quien. La usan sistemas y dirección.",
   "Así funcionan los permisos: cada persona tiene uno o varios roles (Ventas, Almacén, RR. HH.…) y cada rol tiene, en cada módulo, un nivel: 1 ver, 2 capturar, 3 administrar (aprobar, borrar, configurar). Si alguien tiene dos roles, vale el nivel más alto. La pestaña «Permisos por rol» muestra la tabla completa; solo dirección la cambia y dirección siempre tiene todo. Esconder una opción del menú es comodidad: lo que de verdad impide ver un dato es la base, que no se lo entrega a quien no tiene permiso.",
   "En «Usuarios» dale clic a alguien para darle o quitarle roles, o para desactivar su cuenta (pierde todo al instante, aunque tenga la sesión abierta). «Espera rol» es alguien que ya entró con Google pero todavía no puede ver nada; en rojo, «Empleado dado de baja», alguien que RRHH ya dio de baja y sigue pudiendo entrar: desactívalo. Nadie cambia sus propios roles, solo dirección da el rol de dirección y los cambios valen cuando la persona recarga el ERP. En «Invitaciones y pantallas» dejas lista la cuenta de alguien antes de que entre y creas las de los aparatos del taller, que no necesitan cuenta de Google: la de la TV, que solo ve el tablero de piso, y la de la tablet, que solo abre la terminal.",
   "«Ver como», en el encabezado: dirección puede ver el ERP con los permisos de otro rol para revisar qué ve esa gente; una franja te recuerda que estás simulando, y lo que guardes mientras tanto es real y queda a tu nombre. Dirección y sistemas también pueden abrir la sesión de una persona en particular en otra pestaña, con sus pedidos y sus avisos: es solo para ver, no deja guardar nada y queda registrado."
  ]
 },
 {
  "ruta": "/ventas/clientes",
  "nombre": "Clientes",
  "modulos": [
   "ventas"
  ],
  "nivel": 1,
  "texto": [
   "El directorio de clientes de todos los vendedores. Todos ven que la cuenta existe y de quién es, para no duplicarla ni pisarse; teléfonos, historial y saldo solo los ven el dueño, la gerencia y cobranza.",
   "“Mis clientes” son los tuyos y “Libres” los que no tienen dueño. En “Vendedor dueño” ves hasta cuándo es suya la cuenta: en ámbar si le quedan menos de 30 días, en rojo si ya venció.",
   "Busca por nombre, razón social, RFC o ciudad antes de dar de alta uno nuevo, para no duplicarlo. Clic en un renglón abre la ficha del cliente; con CSV te llevas la lista a Excel."
  ]
 },
 {
  "ruta": "/ventas/clientes/:id",
  "nombre": "Clientes › ficha",
  "modulos": [
   "ventas"
  ],
  "nivel": 1,
  "texto": [
   "La ficha del cliente: datos fiscales, contactos, seguimiento e historial completo (cotizaciones, pedidos, oportunidades y lo que compró antes del ERP).",
   "Arriba ves de quién es la cuenta y hasta cuándo. Si está libre, “Hacerlo mío” te la asigna. Si es de otro vendedor solo ves eso: contactos, compras y saldo quedan privados. Si te buscó a ti, pídele a la gerencia que lo reasigne o que compartan el crédito.",
   "En “Actividad” anota cada llamada, WhatsApp o visita en una línea y Enter; si le pones fecha se vuelve tarea. Tus seguimientos alargan la vigencia de la cuenta a tu nombre.",
   "Para facturar bien captura RFC, régimen, CP fiscal y uso de CFDI, o llénalos con la constancia de situación fiscal. “Nueva cotización” sale ya ligada a este cliente.",
   "Si el mismo cliente está dos veces (uno con el nombre del contacto y otro con el de la empresa), «Juntar con otro» pasa todo al que se queda: pedidos, cotizaciones, oportunidades, saldo de la hoja, facturas y contactos (los que ya tiene no se repiten). Lo que le falte (RFC, régimen, ciudad, vendedor) lo toma del otro, y el otro se borra. Si otro cliente tiene el mismo RFC, arriba sale el aviso con su botón «Juntar»; si es una sucursal, déjalo así. Lo hacen la gerencia de ventas, o tú si los dos clientes son tuyos o libres."
  ]
 },
 {
  "ruta": "/ventas/comisiones",
  "nombre": "Comisiones",
  "modulos": [
   "ventas"
  ],
  "nivel": 1,
  "texto": [
   "La comisión de cada mes, calculada sola con los pedidos: sin rangos de filas que mover a mano. Cada vendedor ve la suya; la gerencia de ventas, dirección y finanzas ven a todos (la gerencia administrativa, por ahora, solo la suya).",
   "Cada tarjeta trae la venta de maquinaria con su comisión, la barra hacia el siguiente escalón de meta, la venta de refacciones con su bono y los ajustes. “Pedidos que cuentan este mes” dice de dónde sale; con crédito compartido, qué parte te toca. Cambia de mes con las flechas.",
   "La regla (abajo, en “Cómo se calcula”): el porcentaje de tu plan (2 % en los planes actuales) sobre la venta sin IVA de todo lo que no es refacción, más un bono fijo por el escalón de meta alcanzado y otro por el de refacciones. Los escalones no se suman: se paga el más alto. El plan dice si la venta cuenta por la fecha del pedido, de la factura o del cobro.",
   "La gerencia o dirección agregan ajustes (bonos de Mercado Libre, correcciones) y finanzas la marca pagada: se guarda la foto del cálculo y el mismo mes no se paga dos veces."
  ]
 },
 {
  "ruta": "/ventas/cotizaciones",
  "nombre": "Cotizaciones",
  "modulos": [
   "ventas"
  ],
  "nivel": 1,
  "texto": [
   "El registro de todas las cotizaciones, cada una con su folio y versión. Los vendedores ven las suyas; la gerencia de ventas ve las de todo el equipo y autoriza precios.",
   "Las pestañas filtran por estado y “Solo vencidas” deja las que pasaron su vigencia sin cerrarse (renglones en rojo). Clic en un renglón la abre. Abajo ves cuánto suma lo filtrado en pesos y sin IVA; con CSV te la llevas a Excel.",
   "Para la gerencia, “Por autorizar” es la cola de precios abajo del mínimo: primero las que el vendedor ya pidió, con su nota, cuántas partidas van bajo el mínimo y qué tanto abajo de lista. “Autorizar” deja al vendedor enviarla.",
   "“Seguimiento” es la lista de cotizaciones enviadas a las que toca preguntarles qué pasó: primero las vencidas, luego las de hoy y luego las que vienen. Cada cotización enviada aparece aquí 3 días hábiles después. Con “¿Qué pasó?” eliges cómo va (sigue en pie, no contestó, negociando, ya compró o se perdió), escribes lo que dijo el cliente y Enter: se guarda y se abre la siguiente. Si sigue viva, se agenda la próxima.",
   "El botón “Mensaje” (con destellos ✦) de cada renglón, o “Redactar mensaje” dentro de “¿Qué pasó?”, le pide a la IA el WhatsApp de seguimiento: lo escribe con lo que has anotado de esa venta, así que entre más detalle anotes, más a la medida sale. Lo revisas, lo cambias si quieres y lo abres en WhatsApp; no se manda solo.",
   "Con más de 10 seguimientos vencidos no puedes enviar cotizaciones nuevas hasta ponerte al día; el aviso de arriba te lo dice antes. La gerencia ve en esa pestaña cuánto trae cada vendedor y lo que hizo en la semana, y puede liberar a alguien por el día si un cliente está esperando."
  ]
 },
 {
  "ruta": "/ventas/cotizaciones/:id",
  "nombre": "Cotizaciones › ficha",
  "modulos": [
   "ventas"
  ],
  "nivel": 1,
  "texto": [
   "El editor de la cotización: la plantilla de la hoja, pero cada versión se guarda y no pisa la anterior. Se guarda solo mientras escribes; arriba dice “Guardado” con la hora.",
   "Agrega partidas escribiendo parte del nombre o la clave y Enter: precio de lista, descripción y foto se llenan solos (clic en la foto para pegar otra liga o subir una). Para fletes, instalación o servicios usa “Partida libre”; con “Flete con Skydropx” cotizas el envío con el código postal del cliente y los bultos de las partidas, y se agrega la partida de flete con su precio (no se genera guía ni se cobra); si algo no tiene precio, “Pedir precio a compras” y aquí ves cuando contestan. Clic en una partida muestra su ficha de venta: precio mínimo, existencia y entrega.",
   "Si un precio queda abajo del mínimo, la partida se marca en rojo y la cotización pasa a “Por autorizar”: pide la autorización a la gerencia antes de enviarla. El tiempo de entrega es obligatorio para enviarla; junto al campo están los atajos «Inmediata (en existencia)» y «Se confirma al recibir el anticipo», además del que estima el ERP con la carga del taller. Ya enviada no se edita; para cambiarla saca una nueva versión: te pregunta si la actual ya no vale (queda rechazada, o cancelada si no se envió) o si sigue vigente.",
   "El botón principal cambia según el estado: Enviar (por WhatsApp, por correo o PDF; la deja como enviada y agenda preguntar qué pasó en 3 días hábiles; con más de 10 seguimientos vencidos no deja enviar, ni sacar el PDF o la vista previa de una cotización que todavía no envías, hasta ponerte al día), Convertir a pedido (eliges partidas y fecha compromiso) o Nueva versión. En el menú “···” están imprimir, duplicar y marcar rechazada con su motivo. “Vista previa” te enseña la hoja tal como la recibe el cliente sin salir del editor. Si el equipo tiene más fotos, salen en miniatura bajo la partida y en la hoja de fotos al final del PDF; pasa el mouse por una y con la × la quitas de esta cotización.",
   "«Por correo» (en Enviar o en el menú “···”) manda la cotización desde tu propio Gmail con el PDF adjunto: el mismo que sale en Imprimir. Propone el correo del contacto y los demás contactos del cliente con correo; puedes cambiar el asunto y el mensaje. Las respuestas te llegan a tu Gmail, como siempre. La primera vez te pide conectar tu Gmail. Si la cotización no se puede enviar (precios abajo del mínimo sin autorizar, seguimientos vencidos), te dice por qué y no sale nada. Ya mandada queda como enviada, con su seguimiento, y en la bitácora del cliente queda a qué correo se fue.",
   "Si el cliente no quiere factura, marca «Sin IVA (no lleva factura)»: el precio de cada partida queda igual sin IVA y el total es el subtotal. Si los precios traían IVA incluido, se les quita. En la hoja impresa solo sale el total (sin renglón de IVA) y el pedido sale sin IVA. Se cambia mientras la cotización no se haya enviado; ya enviada, saca una nueva versión.",
   "Abajo de “Tiempo de entrega” ves cuándo sale de verdad con el taller como está hoy: lo que tarda el equipo o lo que tarda la fila del taller, lo que sea más tarde. Con “Usar” lo pones en la cotización; si prometes menos días, se pone en amarillo. Al convertir a pedido, la fecha compromiso ya viene con esa fecha."
  ]
 },
 {
  "ruta": "/ventas/cotizaciones/nueva",
  "nombre": "Cotizaciones › nueva",
  "modulos": [
   "ventas"
  ],
  "nivel": 1,
  "texto": [
   "Al entrar aquí se crea una cotización con las condiciones de pago, entrega y notas que la gerencia dejó por defecto; en un momento se abre el editor.",
   "El folio se asigna cuando agregas la primera partida (o cuando la mandas a autorizar o la envías): si abres y sales sin capturar, no se gasta un folio y el borrador vacío se borra solo al día siguiente.",
   "Si llegas desde un cliente o una oportunidad, la cotización ya sale ligada a ellos y con el contacto principal del cliente."
  ]
 },
 {
  "ruta": "/ventas/cotizado",
  "nombre": "Lo cotizado",
  "modulos": [
   "ventas"
  ],
  "nivel": 2,
  "texto": [
   "Aquí ves qué pasó con lo que cotizas: cuánto se volvió pedido, cuánto se perdió y por qué, y cuánto sigue abierto y qué le falta. Cada vendedor ve lo suyo; la gerencia de ventas ve a todo el equipo y puede elegir a un vendedor arriba.",
   "El diagrama se lee de izquierda a derecha: lo cotizado se divide en lo que se envió y lo que nunca salió, y lo enviado en ganado, perdido y abierto. El grueso de cada franja es el dinero sin IVA; con «En cotizaciones» cuenta cuántas son. Toca un bloque (o un indicador) para ver abajo sus cotizaciones, y un renglón para abrirla.",
   "Lo perdido se agrupa por el motivo que anotaste al rechazarla o al decir qué pasó: si casi todo dice «No respondió», el problema es el seguimiento, no el precio. Lo abierto se divide por lo que le falta: «Seguimiento atrasado» y «No contesta» son las que hay que llamar hoy.",
   "Cada cotización cuenta una vez aunque tenga varias versiones, con el monto de la última, y entra en el periodo por la fecha de su primera versión."
  ]
 },
 {
  "ruta": "/ventas/devoluciones",
  "nombre": "Devoluciones y reclamos",
  "modulos": [
   "envios"
  ],
  "nivel": 1,
  "texto": [
   "Aquí se registran y se siguen las devoluciones, reclamos y cancelaciones de cada venta, sobre todo de Mercado Libre, para que el código y la hora límite no se pierdan en el chat. La usan quien atiende las ventas en línea y almacén.",
   "Los reclamos que abren los compradores en Mercado Libre entran solos, con su motivo y fecha límite, en cuanto ML avisa. Contestarlos y resolverlos se sigue haciendo en Mercado Libre; aquí se ve qué está abierto, quién lo atiende y lo que hace almacén.",
   "“Nueva”: escribe el número de venta de Mercado Libre (o el folio del pedido) y Enter, elige si es devolución, reclamo o cancelación, y anota el motivo y el código. En una devolución, almacén ya sabe que viene; en un reclamo, queda la hora límite para responder.",
   "La columna “Vence” dice qué corre: rojo si ya pasó, ámbar si falta menos de un día; el filtro “Vencidas o por vencer” deja solo eso. Clic en un renglón abre el detalle a la derecha, con la evidencia de salida de esa venta (fotos, check list, quién empacó) para defenderte.",
   "Cuando una devolución llega, almacén la recibe con fotos y decide si reingresa al inventario, es merma o se le reclama a la paquetería."
  ]
 },
 {
  "ruta": "/ventas/leads",
  "nombre": "Leads",
  "modulos": [
   "leads"
  ],
  "nivel": 1,
  "texto": [
   "Aquí se anota a quien llama o escribe interesado y todavía no es cliente ni oportunidad, para que no se pierda en un papel. Lo usan recepción, los vendedores, la gerencia de ventas y marketing, que los ve todos para saber de dónde llegan y qué pasó con ellos.",
   "Con «Registrar lead» anotas quién es, su teléfono o correo, dónde está, su empresa (o «Particular») y qué busca con modelo o medida. Si se te pasó algo, al abrirlo te dice qué le falta y lo completas ahí; «Incompletos» junta los que tienen algo pendiente. Mientras escribes el teléfono o la empresa te dice si ya es cliente y de quién; si lo es y dices «Es este», le llega directo a su vendedor. Enter lo guarda.",
   "A quién le llega lo demás depende de cómo lo dejó la gerencia: en bandeja se avisa a los vendedores y el primero que lo toma se lo queda; o la gerencia lo asigna; o quien lo registra escoge al vendedor. Si nadie lo toma o nadie lo atiende a tiempo, se le avisa a la gerencia.",
   "Dale clic a un lead para ver sus datos, llamarle o escribirle por WhatsApp. Cada intento se anota, conteste o no: «Le escribí» si fue por WhatsApp o correo, «No contestó» si le llamaste (o «No estaba» si fuiste), y «Contestó» con lo que te dijo. Hasta que contesta (o pide cotización) se habilita «Crear oportunidad» (si no era cliente, se da de alta; si su teléfono ya es de un cliente, te ofrece esa cuenta). Si no le interesa, se descarta con el motivo. Para escribirle, «Mensaje con IA» te lo redacta con lo que busca y lo que le pidas en la caja de contexto; cada uno sale distinto, porque WhatsApp bloquea a quien manda el mismo texto a muchos, y al abrirlo en WhatsApp se anota «Le escribí». La columna «Intentos» dice lo último que hiciste y cuándo («Le escribiste por WhatsApp · hace 2 h»), y «Sin contactar» junta a los que todavía no les has escrito ni llamado. Quien lo registró ve en «Los que registré» quién lo tomó y en qué etapa va la oportunidad."
  ]
 },
 {
  "ruta": "/ventas/mercadolibre",
  "nombre": "Mercado Libre",
  "modulos": [
   "mercadolibre"
  ],
  "nivel": 1,
  "texto": [
   "Lo de Mercado Libre que necesita a alguien: las preguntas de compradores por contestar y las publicaciones vendidas que falta ligar a su artículo. Las ventas no se capturan aquí: entran solas a Pedidos. La usan quien atiende Mercado Libre y marketing; la pestaña «Dinero» solo la ven ventas y finanzas.",
   "En «Preguntas», escribe la respuesta y da «Contestar» (o Ctrl+Enter): se publica en Mercado Libre tal cual. Si el mismo comprador ya había preguntado en esa publicación, arriba de su pregunta ves lo que preguntó antes y lo que se le contestó. Solo salen las de publicaciones activas: Mercado Libre no deja contestar las de una publicación pausada o cerrada, y esas se quitan de la lista. Cada pregunta dice cuánto lleva esperando; arriba ves el tiempo de respuesta de los últimos 30 días.",
   "En «Por ligar», busca qué artículo es cada publicación y elígelo: sus ventas y sus envíos toman ese artículo. El envío ya se pidió solo cuando entró la venta, así que almacén ve el paquete aunque nadie la haya ligado, y también la puede ligar desde el envío; lo que no puede es cerrar la caja sin ligarla. Si la publicación es un paquete (24 cangilones), pon en «Piezas por venta» cuántas trae: cada venta entra como esas piezas al precio de cada una. Si cada venta es una parte de lo que cuenta el catálogo (1 juego y la clave es una caja de 4), pon la fracción: 0.25. Si la publicación trae como SKU la clave del ERP, se liga sola.",
   "Si una publicación no es de Hegamex (en la misma cuenta vende otra tienda), da «No es de Hegamex»: sus ventas en el ERP se cancelan sin cobro y las siguientes ya no entran. Quedan abajo, en «No son de Hegamex», con «Sí es nuestra» por si fue un error.",
   "En «Ligadas» ves cada publicación con su artículo. Si se ligó mal, «Corregir» cambia el artículo o las piezas y rehace las ventas abiertas que todavía no tienen guía; «Desligar» la regresa a «Por ligar».",
   "Para contestar, «Sugerir respuesta» le pide a la IA una propuesta con la ficha del artículo, lo que dice la publicación y lo que ese comprador ya preguntó; o elige una respuesta rápida. Lo que salga queda en la caja para corregirlo antes de contestar. En «Datos para contestar» escribes lo que siempre aplica (factura, envíos, garantía) y guardas las respuestas rápidas.",
   "«Publicaciones» pone cada publicación junto a lo que dice el catálogo: precio en ML contra el sugerido de su tipo (clásica o premium, con la comisión y el envío que ML le cobra a esa publicación), existencia en ML contra lo libre en planta, visitas, preguntas, ventas y conversión de 30 días. «Por revisar» deja lo que conviene arreglar. «Traer de Mercado Libre» lo pone al día; solo lee, no cambia nada allá.",
   "«Cambios sugeridos» corrige desde aquí el precio y la existencia que no cuadran: ves el antes y el después, palomeas y das «Mandar a Mercado Libre». Abajo, «Corregir solo» lo hace cada hora con lo seguro si gerencia de ventas o dirección lo prende (viene apagado), y «Cambios hechos desde el ERP» dice qué se cambió, quién y qué contestó Mercado Libre.",
   "«Reputación» muestra el termómetro de la cuenta y lo que lo mueve (reclamos, demoras, cancelaciones), y los reclamos abiertos con su fecha límite.",
   "En «Dinero» está cada pago de Mercado Libre del mes, tal cual lo da Mercado Pago: lo que pagó el comprador, la comisión, el envío que pagamos, las retenciones de IVA e ISR y lo que llega a Mercado Pago, con el día en que queda disponible. Arriba, los totales del mes; abajo puedes bajarlo a Excel para conciliar la cuenta de Mercado Pago."
  ]
 },
 {
  "ruta": "/ventas/oportunidades",
  "nombre": "Oportunidades",
  "modulos": [
   "ventas"
  ],
  "nivel": 1,
  "texto": [
   "El embudo de ventas: cada tarjeta es una venta posible, desde que alguien pregunta hasta que se gana o se pierde. Los vendedores la usan para no soltar a nadie; la gerencia, para ver qué está atorado (y puede filtrar por vendedor).",
   "Arrastra una tarjeta a otra columna para cambiarla de etapa; si la sueltas en “Perdida” te pide el motivo. A “Negociación” (y de Prospecto a Contactado) no pasa solo con arrastrar: se abre “¿Qué pasó?”, escribes lo que dijo el cliente y eso la mueve. Dale clic para abrir su detalle a la derecha: ahí editas monto, probabilidad y cierre estimado, sacas una cotización y anotas qué pasó.",
   "Los días en ámbar dicen que lleva más de 14 en la misma etapa; la tarea en rojo, que ya venció. La etiqueta “Seguimiento” dice cuándo toca preguntarle al cliente qué pasó con su cotización (en rojo si ya venció); dale clic para anotarlo ahí mismo. Ganadas y perdidas se quedan 60 días en el tablero; después solo en la vista de lista, que también se descarga a CSV.",
   "No todo se mueve a mano: enviar una cotización pasa su oportunidad a “Cotizado” (y la crea si no existía) y le agenda su seguimiento a 3 días hábiles, convertirla en pedido la marca “Ganada”, y rechazarla la cierra como “Perdida” si no tiene otra cotización viva. Al anotar qué pasó, “Negociando” la pasa a Negociación y “Se perdió” la cierra con su motivo."
  ]
 },
 {
  "ruta": "/ventas/para-llamar",
  "nombre": "A quién llamar hoy",
  "modulos": [
   "ventas"
  ],
  "nivel": 1,
  "texto": [
   "Tu lista para arrancar el día: cada tarjeta dice por qué buscar a ese cliente y cuánto puede valer. La usan los vendedores: cada quien ve sus clientes y los que no tienen vendedor; la gerencia de ventas ve la de todo el equipo.",
   "Las tarjetas de arriba filtran por motivo: cotización por vencer (rojo), ya le toca (ámbar), refacciones (azul) y reactivar (gris). Pasa el mouse por cada una para ver la regla. El buscador encuentra cliente, producto o vendedor.",
   "“Redactar mensaje” arma un WhatsApp o un correo con el historial del cliente (lo escribe la IA si está conectada; si no, sale una plantilla). Revísalo y ajústalo: enviarlo lo decides tú, con “Abrir en WhatsApp” o copiándolo.",
   "Cuando vuelves de WhatsApp o del teléfono, la tarjeta pregunta “¿Sí le escribiste?”: un toque lo registra (con Deshacer) y el cliente pasa a “En seguimiento”, con el siguiente paso: llamar al día 3, último mensaje al día 10 y luego esperar una semana. Así nadie del equipo le vuelve a escribir sin saberlo.",
   "En la tarjeta de un cliente en seguimiento, “¿Cómo terminó?” cierra el intento: si le interesa se crea la oportunidad; “no por ahora” o “no contesta” lo regresan a la lista en 90 días; “ya no compra” lo saca, con la razón. Tres intentos y una semana sin respuesta cuentan solos como “no contesta”.",
   "Solo salen tus clientes y los libres. No aparecen los que ya tienen una oportunidad abierta (ya estás en eso) ni los que tienen una cotización abierta de los últimos 45 días, salvo que esté por vencer."
  ]
 },
 {
  "ruta": "/ventas/pedidos",
  "nombre": "Pedidos",
  "modulos": [
   "ventas"
  ],
  "nivel": 1,
  "texto": [
   "Los pedidos de todos los canales en una sola lista. Ventas, producción y cobranza la usan para saber en qué va cada uno sin preguntar por WhatsApp.",
   "Filtra por abiertos, entregados o cancelados y por canal. Los renglones en rojo están atrasados: pasó su fecha compromiso. “Producción” muestra el avance del taller y “Saldo” lo que falta por cobrar (dice “pagado” en verde si ya se cobró todo). Clic en un renglón abre el pedido.",
   "“Pedido sin cotización” es para ventas de Mercado Libre, sitio web o mostrador: eliges cliente, canal y número de venta, y en el siguiente paso agregas las partidas con su precio de lista. Los servicios sin precio fijo, como «Servicio de paquetería», te piden el monto (sin IVA) al agregarlos. Abajo ves el total y lo por cobrar de lo filtrado, en pesos, y aparte lo que tus clientes ya debían en la hoja (los pedidos que vienen de la hoja se cobran contra eso).",
   "Los pedidos ya entregados que vienen de las hojas no salen de entrada; actívalos con “Incluir históricos de los paneles”. Los de la hoja que siguen en el taller sí salen siempre, con «en saldo de arranque» en la columna de saldo: su cobro se lleva en el saldo de arranque del cliente."
  ]
 },
 {
  "ruta": "/ventas/pedidos/:id",
  "nombre": "Pedidos › ficha",
  "modulos": [
   "ventas"
  ],
  "nivel": 1,
  "texto": [
   "Todo lo de un pedido en una página: partidas, avance de producción, envío, facturas, cobros y a quién le cuenta la venta. La línea de arriba marca por dónde va: confirmado, en producción, listo y entregado.",
   "Mientras está Confirmado se pueden ajustar las partidas; se guardan al salir del campo (Enter o Tab). Los precios que vienen de una cotización ya pasaron por la autorización: solo la gerencia los cambia, o sacas una nueva versión de la cotización.",
   "Arriba: “Mandar a producción” (lo usa producción) crea una orden por cada equipo con lista de materiales; “Marcar listo” avanza el estado; “Cancelar” pide el motivo. “Hoja de salida” imprime lo que firma el cliente (sin precios). “Entregar” pide qué sale de cada partida (todo o una parte: lo demás queda por entregar), quién recibió y la foto de la hoja firmada (la puedes subir después); lo que sale se descuenta del inventario. Cada entrega sale en el recuadro de entregas con su hoja. Si te equivocaste, el aviso trae “Deshacer” por 15 minutos, y después la reabre la gerencia de ventas con el motivo. Entregan almacén, el vendedor sus pedidos, la gerencia de ventas y dirección. Facturas y cobros los registra finanzas, y el saldo se recalcula solo; una factura ya registrada se corrige o se quita con su lápiz.",
   "Si el pedido tiene equipos en el taller, «Plan del taller» enseña cuándo entra y sale cada uno de cada área y si llega a la fecha compromiso (el rombo verde llega, el rojo no). Es el plan de la planta: se mueve solo con lo que pasa en el piso. Clic en un equipo abre su orden.",
   "Si es una venta de Mercado Libre, el recuadro «Mercado Libre» dice cómo va su envío allá (lista para enviar, en camino, entregada) y el dinero: lo que pagó el comprador, lo que se quedó Mercado Libre, las retenciones y lo que llega a Mercado Pago. El cobro entra solo en cuanto se aprueba el pago, y el envío y el pedido avanzan solos con lo que dice Mercado Libre.",
   "Si el cliente no quiere factura, en los totales «Quitar IVA» deja el total igual al subtotal (y «Agregar IVA» lo regresa). Lo cambian el vendedor del pedido, la gerencia de ventas y finanzas; un pedido que ya tiene factura registrada no se puede quitar el IVA hasta que se quite la factura. La comisión no cambia: se calcula sin IVA.",
   "“Crédito de la venta” dice qué vendedor cobra comisión por este pedido; si la cerraron entre varios, la gerencia lo comparte en porcentajes que suman 100 %."
  ]
 },
 {
  "ruta": "/ventas/solicitudes",
  "nombre": "Solicitudes de precio",
  "modulos": [
   "ventas"
  ],
  "nivel": 2,
  "texto": [
   "Casi siempre pides un precio desde la partida de tu cotización (o desde el buscador cuando algo no aparece). Aquí ves todas juntas y puedes pedir una suelta con “Pedir precio”.",
   "“Sin tomar”: nadie de compras la ha agarrado. “Cotizando”: ya la tiene alguien. “Con precio”: ya contestaron. En rojo las que pasaron su plazo, que corre en horas hábiles (las urgentes tienen menos).",
   "Cuando llega el precio, “Aplicar a COT-…” lo pone en la partida de esa cotización. Ves el precio de lista y la entrega en días hábiles, nunca el costo. Si ya no hace falta, “Ya no la necesito” la cancela y compras deja de cotizarla."
  ]
 }
];

export const CONCEPTOS_MANUAL: ConceptoManual[] = [
 {
  "clave": "abiertoCotizado",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Lo enviado que ni se ganó ni se perdió. Se divide por lo que hace falta: Negociando (el cliente está negociando), Seguimiento atrasado (ya pasó el día de preguntar qué pasó), No contesta (en el último seguimiento no contestó), Vigencia vencida (pasaron sus días de vigencia: toca actualizarla) y Esperando respuesta (lo demás, con su seguimiento al día)."
 },
 {
  "clave": "abonoPrestamo",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Lo que ya se pagó del préstamo: lo descontado en las semanas cerradas más los abonos que hizo aparte. Con «Abonar» registras un pago mayor al descuento: en efectivo (dices a qué cuenta entró, queda en finanzas y sale un recibo con folio para firmar) o descontando más en la nómina de una semana abierta. El saldo y las semanas que faltan se recalculan solos, con el mismo descuento semanal."
 },
 {
  "clave": "abrirDetalleExistencia",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Dale clic a un renglón para abrir el artículo a la derecha sin perder la lista: cuánto hay en cada almacén, para qué está apartado y, si tu puesto los ve, sus movimientos."
 },
 {
  "clave": "abrirPedidoDeOrden",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "El pedido del que sale esta orden y su cliente. Haz clic en el recuadro para abrir el pedido: ventas, finanzas y dirección llegan a la ficha completa; la planta y almacén, a la ficha de Producción → Pedidos, con lo que se vendió y cómo va cada equipo, sin montos."
 },
 {
  "clave": "accionBitacora",
  "modulos": [
   "admin"
  ],
  "texto": "Alta: se creó el registro. Cambio: se modificó (se ve el antes y el después). Baja: se borró (se ve lo que tenía)."
 },
 {
  "clave": "actividad",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Llamadas, WhatsApp, correos, visitas y notas con el cliente. Una tarea lleva fecha y se queda arriba hasta que la marcas hecha; vencida sale en rojo. También cuenta como seguimiento para la vigencia de la cuenta."
 },
 {
  "clave": "actividadReciente",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Los últimos 15 movimientos de las órdenes, en vivo: órdenes creadas, liberadas, terminadas o entregadas; etapas que empiezan, se pausan, terminan o se reabren; problemas del piso, material surtido y cambios de material. Clic en una línea abre su orden."
 },
 {
  "clave": "actualizarCostoAlRecibir",
  "modulos": [
   "compras"
  ],
  "texto": "Marcada, el precio de esta orden pasa a ser el costo vigente de cada artículo (en el historial dice «por orden de compra») y el costeo de los equipos que lo usan se mueve con él. Desmárcala si fue un precio especial. En una orden que viene en un embarque de importación no cambia el costo: ahí manda el costeo de la importación."
 },
 {
  "clave": "actualizarCostoDesdeCotizacion",
  "modulos": [
   "compras"
  ],
  "texto": "Los precios de esta cotización pasan a ser el costo vigente de cada artículo (en el historial dice «cotización») y se recalculan sus precios. Solo lo ve quien administra costos."
 },
 {
  "clave": "acumuladoMetaAnio",
  "modulos": [
   "analisis"
  ],
  "texto": "Lo vendido sumado mes con mes contra la meta sumada igual. Si la línea de lo vendido va abajo de la de la meta, vas atrasado; arriba, adelantado."
 },
 {
  "clave": "adelantoVacaciones",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Días tomados antes de que empiece el periodo al que se cargan: cuando ya no le queda nada vigente, o antes de su primer año. Se descuentan de ese periodo cuando llega (en la hoja se anotaban como «proporcionales»)."
 },
 {
  "clave": "agendaPagos",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Lo que hay que pagar acomodado por semana, de lunes a domingo: primero lo vencido y luego las próximas 4 semanas, sumado por proveedor. Clic en un proveedor para ver sus facturas y registrar el pago."
 },
 {
  "clave": "agendaSemana",
  "modulos": [],
  "texto": "Lo que tiene fecha de lunes a domingo de esta semana, sacado del calendario: entregas, lo que llega de compras e importaciones, órdenes del taller, servicios, preventivos, pagos, vacaciones y tus pendientes (lo que tu puesto puede ver). Lo que ya pasó su fecha y sigue abierto sale en rojo como «Atrasado»."
 },
 {
  "clave": "agenteAduanalEmbarque",
  "modulos": [
   "importaciones"
  ],
  "texto": "Quien despacha la mercancía en la aduana: revalida el BL, hace el previo, paga el pedimento y al final manda la cuenta de gastos. Su referencia es con la que se busca todo con él."
 },
 {
  "clave": "agregarACuadrilla",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Mete a alguien a esta etapa sin arrastrar; salen primero los de su área y su especialidad. Si la etapa está en proceso, su tiempo empieza a contar en ese momento y, si trabajaba en otra, sale de ahí (primero te pregunta). Si no ha empezado, queda planeado."
 },
 {
  "clave": "agregarAlConteo",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "¿Hay en el estante algo que no viene en la lista? Búscalo aquí: se agrega al conteo con 0 y te lleva a su renglón para que escribas cuánto hay."
 },
 {
  "clave": "agregarEtapa",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Agrega a esta orden una etapa que le falta, con sus horas y el porqué. Las etapas de una orden salen de las horas por etapa del equipo; si el equipo no trae una (por ejemplo Detallado), la orden se termina al acabar la anterior. La agrega la gerencia de producción y queda pendiente para el taller; si la orden ya estaba terminada, regresa a «en proceso» y su pedido deja de estar listo. Solo cambia esta orden: para que las siguientes la traigan, ingeniería la agrega al equipo."
 },
 {
  "clave": "agregarInsumoServicio",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Busca el insumo o la refacción, pon la cantidad y dale Agregar. Almacén recibe un aviso para entregarlo."
 },
 {
  "clave": "agregarOtroDocumentoEmbarque",
  "modulos": [
   "importaciones"
  ],
  "texto": "Para un documento que no está en la lista (una carta de no previo, el DODA, otro): elige el tipo y luego «Elegir archivo». Entra ya como recibido."
 },
 {
  "clave": "agregarPartidaOrden",
  "modulos": [
   "compras"
  ],
  "texto": "Busca el artículo y Enter: entra con cantidad 1 y su costo vigente como precio sugerido, en la moneda de la orden. Si ya estaba en la orden, le suma 1."
 },
 {
  "clave": "agruparMaterial",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Cómo se ordena la lista de material. «Categoría» (la que sale primero): junta lo del mismo tipo aunque vaya en partes distintas (todo lo eléctrico, todo el material para aire, la tornillería), para encontrarlo rápido en el almacén. «Subensamble»: por la parte del equipo donde va (como en la lista de materiales del costeo); si lo eliges, se recuerda en tu navegador. El buscador encuentra por nombre, clave o categoría."
 },
 {
  "clave": "ahorradoTotal",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Todo lo que ha entrado a su ahorro: lo descontado en semanas cerradas, lo que puso la empresa y su saldo inicial."
 },
 {
  "clave": "ahorroHorasMes",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Cuántas horas de trabajo al mes se ahorran con la mejora, según la estima quien la lleva. Es una estimación, no una medición: sirve para ver qué mejoras rinden más."
 },
 {
  "clave": "ahorroLineasSubensamble",
  "modulos": [
   "admin"
  ],
  "texto": "Cuántos renglones de listas de materiales se dejan de capturar si lo conviertes: (equipos − 1) × (piezas − 1). Arriba van las que más ahorran."
 },
 {
  "clave": "ahorroSemanal",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Lo que cada colaborador decidió ahorrar por semana. Se descuenta solo en la prenómina desde la semana que elijas hasta que lo cambies (0 = deja de ahorrar). Si una semana capturas a mano el concepto «Caja de ahorro», ese importe reemplaza al de siempre solo esa semana."
 },
 {
  "clave": "ajusteComision",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Bonos o descuentos que no salen de una fórmula (bonos de Mercado Libre, correcciones). Los agrega la gerencia de ventas o dirección; uno negativo descuenta."
 },
 {
  "clave": "ajusteInventario",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "La única forma de corregir una existencia. Lo pide quien encontró la diferencia y lo autoriza la gerencia de producción, dirección o el jefe de almacén; quien lo pidió no se lo autoriza (salvo dirección). Hasta entonces la existencia no cambia. Al autorizarlo se aplica la diferencia que se encontró, así que lo que entró o salió desde que se pidió se respeta; si con eso la existencia quedaría negativa, no se autoriza y se vuelve a contar. Si el artículo se contó en ese almacén después de pedir el ajuste, ya no se autoriza: el conteo ya lo dejó en lo que hay, así que se rechaza y queda como constancia."
 },
 {
  "clave": "ajusteObjetivo",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Un mes aprobado ya no se vuelve a calificar: si hubo un error, Recursos Humanos o dirección piden un ajuste con el resultado corregido y el motivo. Lo autoriza otra persona, no quien lo pidió; autorizado, el resultado corregido es el que cuenta."
 },
 {
  "clave": "alcanceRol",
  "modulos": [],
  "texto": "Los números salen con tus permisos: un vendedor ve lo de sus clientes; la gerencia y dirección ven toda la empresa. Por eso dos personas pueden ver cifras distintas en la misma pantalla."
 },
 {
  "clave": "alcanzaMesesSalud",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Cuántos meses dura lo disponible al ritmo que sale: disponible ÷ lo que sale al mes. Solo se calcula en artículos con demanda mensual."
 },
 {
  "clave": "alDiaTaller",
  "modulos": [
   "analisis"
  ],
  "texto": "El día en que el taller acabaría todo lo que tiene en fila si no entrara ningún pedido más, trabajando a su capacidad de hoy."
 },
 {
  "clave": "alertaImportacion",
  "modulos": [
   "importaciones"
  ],
  "texto": "Avisos que arma el sistema solo: documentos que faltan cerca del arribo, días libres o del contenedor por acabarse, cambios de ETA, cuenta de gastos o EIR que no llegan y, si ves dinero, pagos retenidos o sin comprobante y dinero por recuperar. Rojo es riesgo; ámbar, atención. A importaciones le llegan a la campana una vez al día."
 },
 {
  "clave": "almacenOrigenMovimiento",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Cada cuadro es un almacén con lo que hay hoy de este artículo: toca de cuál sale (o, en una devolución, a cuál regresa). Ya viene marcado el que tiene más; al sacar, los que están en cero se ven pálidos."
 },
 {
  "clave": "almacenParaPlanta",
  "modulos": [
   "admin"
  ],
  "texto": "Si lo que hay en ese almacén cuenta para producción y para el cotizador. El Full de Mercado Libre existe, pero no está disponible para planta."
 },
 {
  "clave": "almacenParaTodas",
  "modulos": [
   "compras"
  ],
  "texto": "Pone el mismo almacén en todas las partidas de una vez; después puedes cambiar el de cada una. De entrada, cada artículo va a su almacén de siempre."
 },
 {
  "clave": "altaProveedorDesdeCotizacion",
  "modulos": [
   "compras"
  ],
  "texto": "El proveedor de la cotización no está en el catálogo: dalo de alta con lo que leyó la IA (nombre, razón social, RFC y moneda) y queda elegido para esta orden."
 },
 {
  "clave": "amarreXml",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Con qué renglón de la hoja quedó una factura anterior. Por folio: el folio del XML está en la columna de factura de la hoja y el monto se parece. Por monto: la hoja no trae el folio, pero el monto es exacto y la fecha está a 15 días o menos. Sin renglón: no se encontró; casi siempre falta el RFC del proveedor en el ERP o se llama distinto en la hoja."
 },
 {
  "clave": "anioPorAnio",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Cada año desde 2018 con la misma cuenta del diagrama: ventas, costo de fabricación, gastos de operación, impuestos e intereses y utilidad. Hasta el 12 oct 2026 sale de las hojas; desde ahí, del ERP. El año en curso va a la fecha."
 },
 {
  "clave": "anticipo",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Un pago mayor a lo que se le debe al proveedor. Lo que sobra queda a nuestro favor y se descuenta de su siguiente factura. Se marca a propósito, para que un cero de más no se vuelva un anticipo."
 },
 {
  "clave": "antiguedadCobranza",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Días desde la primera factura del pedido o, si aún no se factura, desde la fecha del pedido. Lo que se debía en la hoja cuenta desde la venta: los pagos van tapando las ventas más viejas, así que lo que falta es lo más reciente. Se agrupa en 0 a 30, 31 a 60, 61 a 90 y más de 90 días; pasando 90 se pinta en rojo."
 },
 {
  "clave": "antiguedadPersonal",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Tiempo desde su fecha de ingreso hasta hoy (o hasta su baja). De ahí salen sus vacaciones. Si reingresa después de una baja, cuenta desde la nueva fecha."
 },
 {
  "clave": "aPagarNomina",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Lo que se le paga en la semana antes de lo fiscal: sueldo de los días pagados + horas extra + prima + otros pagos + bono − descuentos y préstamos. ISR, IMSS y timbrado los calcula el contador."
 },
 {
  "clave": "apartado",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Material que ya tiene dueño: está reservado para una orden de producción o un pedido y todavía no sale del almacén. Sigue en el estante, pero no está libre."
 },
 {
  "clave": "apartadoOrden",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Material reservado para esta orden: sigue en el almacén, pero nadie más lo puede tomar."
 },
 {
  "clave": "apartadosDetalle",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Para qué orden de producción o pedido está apartado, quién lo apartó y cuándo. El número grande es lo que falta por entregar; abajo, cuánto ya se surtió de lo apartado."
 },
 {
  "clave": "aplicarPrecioCompras",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Pone en la partida el precio de lista que dio compras, en la moneda de la cotización. Si la partida estaba escrita a mano, se vuelve el artículo del catálogo con su nombre y su unidad. Solo mientras la cotización no se haya enviado."
 },
 {
  "clave": "aplicarPrecioFicha",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Pone en la partida el precio de lista o el mínimo, ya en la moneda de la cotización (y con IVA si va con IVA incluido). El descuento de la partida y el general se aplican encima."
 },
 {
  "clave": "aprovechamientoTaller",
  "modulos": [
   "admin"
  ],
  "texto": "Qué parte de las horas de la gente se va de verdad a órdenes. Descuenta faltas, vacaciones, limpieza, esperar material y juntas. Empieza en 85 %; se afina comparando con las horas que registra la terminal. Lo pone la gerencia de producción."
 },
 {
  "clave": "aproximadoPesosHoyImportacion",
  "modulos": [
   "importaciones"
  ],
  "texto": "Lo que falta, pasado a pesos con el tipo de cambio de hoy. Es aproximado: lo que cueste de verdad depende del tipo de cambio del día en que se pague."
 },
 {
  "clave": "areaPiso",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "La etapa del taller donde trabaja la persona (la misma de la pantalla de piso). Sirve para planear la carga del taller. Vacío = no es personal de piso."
 },
 {
  "clave": "areasLimpiezaPlantilla",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Las áreas cuya limpieza cuenta para este puesto. La marca de limpieza de un área cuenta para todos los que la tienen elegida."
 },
 {
  "clave": "armarMes",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Crea el borrador del mes para cada persona con puesto asignado y vuelve a medir los borradores con los datos de hoy. Lo ya calificado no se toca, y quien no tiene plantilla vigente se queda fuera (te dice quién). Al empezar cada mes se hace solo para el mes que terminó."
 },
 {
  "clave": "arqueo",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Contar el efectivo de la caja y compararlo con lo que dice el sistema. La diferencia (sobrante o faltante) queda registrada como un movimiento, con quién lo contó."
 },
 {
  "clave": "articuloInhabilitado",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Un equipo o subensamble que ya no se fabrica ni se vende: deja de salir en el cotizador, en pedidos nuevos y al armar listas de materiales, y no tiene precio de lista. Lo que ya existe no cambia: dentro de los equipos que lo usan sigue igual, y las cotizaciones y pedidos abiertos conservan sus partidas. Se reactiva con el mismo interruptor y regresa con su precio."
 },
 {
  "clave": "articulosConExistencia",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Cuántos artículos tienen más de cero en planta (lo del Full de Mercado Libre no cuenta). Abajo, cuántos componentes y materias primas controla el almacén en total, tengan o no."
 },
 {
  "clave": "articulosQueSurte",
  "modulos": [
   "compras"
  ],
  "texto": "Artículos activos que tienen a este proveedor como su proveedor de siempre o como el del costo vigente."
 },
 {
  "clave": "asignarStock",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Si ya hay un equipo igual fabricándose (o terminado) para stock, la gerencia lo asigna a esta partida con «Usar»: la orden pasa a ser del pedido, con su número de serie, y ya no hay que fabricar otro."
 },
 {
  "clave": "atajosViaticos",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Atajos para no escribir: ponen el concepto más común en la descripción. Luego escribe el monto y dale Agregar."
 },
 {
  "clave": "aTiempo",
  "modulos": [
   "analisis"
  ],
  "texto": "Pedidos con fecha compromiso en el periodo que se entregaron ese día o antes. Se juzga lo entregado y lo que ya venció sin entregarse; lo que todavía puede llegar a tiempo no cuenta aún."
 },
 {
  "clave": "atiendenML",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Las personas que atienden Mercado Libre: a todas les llegan los avisos de preguntas por contestar, reclamos con su fecha límite y ventas cuya publicación falta ligar. Puedes elegir a alguien invitado que todavía no entra: le empiezan a llegar en cuanto acepte su invitación. Las ventas, en cambio, quedan a nombre de una sola persona (la que cuenta para la comisión)."
 },
 {
  "clave": "atrasadoCalendario",
  "modulos": [],
  "texto": "Ya pasó su fecha y sigue abierto: la entrega no se ha hecho, la compra no ha llegado, el preventivo no se ha cerrado, el pendiente sigue sin hacerse. Lo que ya se cerró no sale en el calendario. También sale en rojo, como «Después del compromiso», el día en que una orden termina según el plan del taller si eso es después de su fecha compromiso: todavía no está atrasada, pero va a llegar tarde si nada cambia."
 },
 {
  "clave": "ausentesHoy",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Personas con vacaciones, permiso, falta o incapacidad aprobada que cae hoy. Los retardos y las horas extra no cuentan como ausencia. Clic para ver el calendario."
 },
 {
  "clave": "automaticoML",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Con el interruptor prendido, cada hora de 7:41 a 19:41 el ERP trae las publicaciones y corrige solo lo seguro. Precio: si la comisión y el envío los dio Mercado Libre, la publicación está activa y el cambio es de 15 % o menos. Existencia: nunca la deja en 0 ni la sube si el artículo está en otra publicación activa, para no venderlo dos veces. Lo demás se queda para el botón. Hasta 30 cambios por vuelta. Lo prenden gerencia de ventas o dirección, por separado para precio y existencia; viene apagado."
 },
 {
  "clave": "autorizacionPedida",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "El vendedor ya terminó de capturar y pidió la autorización, con su nota: está esperando a la gerencia de ventas. «Todavía capturando» quiere decir que tiene precios abajo del mínimo pero aún no la pide."
 },
 {
  "clave": "autorizacionPrecios",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Cuando hay partidas abajo del mínimo, terminas de capturar y das “Pedir autorización” (con una nota del porqué, si quieres). La gerencia de ventas la ve en su cola y autoriza. Si después cambias las partidas, el descuento, la moneda o el IVA, la autorización se pierde y hay que pedirla otra vez."
 },
 {
  "clave": "avanceEtapa",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Cuánto lleva una etapa empezada, como se dice en el piso: ¼, ½, ¾ o casi. Lo reporta el supervisor en la terminal o la gerencia en la orden. Cuenta en el avance de la orden, en lo que le falta a su área y en el plan del Gantt. Para acabarla se sigue usando «Terminar»."
 },
 {
  "clave": "avanceMetaEstado",
  "modulos": [
   "analisis"
  ],
  "texto": "Lo vendido este año en el estado entre su meta: la que puso dirección o, si no hay, la sugerida. 100 % quiere decir que ya llegó."
 },
 {
  "clave": "avanceOrden",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Cuánto lleva: las horas de las etapas terminadas, más lo que lleva la que está en proceso según lo reportó el piso (¼, ½, ¾), contra las horas estimadas de todas sus etapas."
 },
 {
  "clave": "avancePedido",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Qué tanto lleva producción con este pedido: el promedio de sus órdenes de taller, donde cada orden avanza según las horas de trabajo ya terminadas. Una orden terminada cuenta 100 %."
 },
 {
  "clave": "avanceRecibido",
  "modulos": [
   "compras"
  ],
  "texto": "Qué parte de lo pedido ya llegó al almacén, sumando todas las partidas."
 },
 {
  "clave": "avanceServicio",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Por dónde va el servicio: Pedido, Programado, En curso y Cerrado. Los pasos que ya pasaron se ven en verde, con su fecha y quién lo hizo."
 },
 {
  "clave": "aviso",
  "modulos": [],
  "texto": "Notificación que llega a la campana del encabezado: un pendiente nuevo, algo que se terminó, una autorización que espera. Al darle clic te lleva a la pantalla donde se atiende."
 },
 {
  "clave": "avisosDeReglas",
  "modulos": [],
  "texto": "Estos avisos los calcula el ERP con reglas fijas (órdenes atrasadas, máquinas paradas, preventivos vencidos…), sin IA. Así salen en puestos que no usan el Asistente, como los supervisores de piso y mantenimiento."
 },
 {
  "clave": "avisosImportacion",
  "modulos": [
   "admin"
  ],
  "texto": "Problemas que ya venían en las hojas y que la última importación encontró: nombres repetidos, materiales que no están en el catálogo, existencias negativas que no se cargaron, equipos sin lista de materiales…"
 },
 {
  "clave": "avisosSinLeerUso",
  "modulos": [
   "admin"
  ],
  "texto": "Los avisos de la campana que tiene sin abrir, a hoy (no depende del periodo). Si se juntan muchos, quizá no está revisando la campana."
 },
 {
  "clave": "backlogMantenimiento",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Órdenes de mantenimiento abiertas (fallas y preventivos) y cuántos días llevan desde que se reportaron. Una falla abierta muchos días suele estar esperando una refacción o a alguien externo."
 },
 {
  "clave": "bajaConAcceso",
  "modulos": [
   "admin"
  ],
  "texto": "Personas que Recursos Humanos ya dio de baja pero que todavía pueden entrar al ERP. Desactiva su cuenta hoy mismo."
 },
 {
  "clave": "bajoMinimo",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "La partida quedó abajo del precio mínimo (o en $0). La cotización pasa a “Por autorizar” y no se puede enviar ni convertir en pedido hasta que la gerencia de ventas la autorice."
 },
 {
  "clave": "bitacoraSistema",
  "modulos": [
   "admin"
  ],
  "texto": "Quién hizo el cambio. «Sistema» es un proceso automático del ERP, no una persona."
 },
 {
  "clave": "bl",
  "modulos": [
   "importaciones"
  ],
  "texto": "Bill of lading: el documento de la naviera que ampara la carga. Hay que revalidarlo en el puerto para poder sacar la mercancía."
 },
 {
  "clave": "bonoMeta",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Bono fijo cuando la venta del mes de maquinaria (y otros) llega a un escalón de meta. Los escalones no se suman: se paga solo el más alto alcanzado. La barra muestra cuánto falta para el siguiente."
 },
 {
  "clave": "bonoObjetivos",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Lo que se paga por los objetivos: el % del mes aprobado por la base del bono de su puesto o de la persona. Mientras dirección no defina esa base se muestra solo el % y no se paga nada."
 },
 {
  "clave": "bonoRefacciones",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Bono fijo por escalón de venta de refacciones en el mes. Igual que la meta: se paga solo el escalón más alto alcanzado."
 },
 {
  "clave": "borrarEspecialidad",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Borra la especialidad (pide un segundo clic para confirmar). Su gente queda haciendo de todo en el área y sus equipos los hace cualquiera."
 },
 {
  "clave": "botonAgregarConceptoNomina",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Registra un pago o un descuento fuera del sueldo para una persona esta semana (servicio fuera de planta, apoyo, herramienta dañada…), con una nota. Solo en semanas abiertas; queda quién lo registró."
 },
 {
  "clave": "botonAgregarGastoEmbarque",
  "modulos": [
   "importaciones"
  ],
  "texto": "Captura a mano un gasto del embarque: quién lo cobra, monto sin IVA, su IVA aparte y cómo se reparte. Marca «estimado» si todavía no llega la cuenta de gastos."
 },
 {
  "clave": "botonAjusteComision",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Agrega un bono o un descuento a la comisión de este mes, con su concepto (un bono de Mercado Libre, una corrección…). Negativo descuenta. Lo hacen la gerencia de ventas y dirección."
 },
 {
  "clave": "botonAnotarPorRecuperar",
  "modulos": [
   "importaciones"
  ],
  "texto": "Anota dinero que nos tienen que regresar: la garantía del contenedor, un saldo a favor con el agente u otro. El saldo a favor de una cuenta de gastos leída con la IA se anota solo."
 },
 {
  "clave": "botonAprobarAjuste",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Aplica la diferencia a la existencia de hoy, con un movimiento de ajuste a tu nombre. No se puede si tú lo pediste (salvo dirección), si la existencia quedaría en negativo o si el artículo se volvió a contar en ese almacén después de pedirlo."
 },
 {
  "clave": "botonAprobarSolicitud",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "La das por buena: si son vacaciones se restan del saldo, sale en el calendario y cuenta en la prenómina de esa semana."
 },
 {
  "clave": "botonAQuienLlamar",
  "modulos": [
   "analisis"
  ],
  "texto": "Abre «A quién llamar»: los clientes que conviene buscar, cada uno con su motivo (le toca comprar, refacciones, reactivar o una cotización por vencer) y su contacto a la mano."
 },
 {
  "clave": "botonAsignarPuesto",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Dice con qué plantilla se evalúa a una persona y quién es su jefe directo, desde una fecha. Sin jefe, la califica Recursos Humanos. Con esto entra a la evaluación de cada mes."
 },
 {
  "clave": "botonAutorizarPrecios",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Aprueba los precios abajo del mínimo: la cotización queda Autorizada y el vendedor ya la puede enviar o convertir en pedido. Solo la gerencia de ventas autoriza. Si después le cambian partidas, descuento, moneda o IVA, la autorización se pierde."
 },
 {
  "clave": "botonBorrarCobroPedido",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Borra un cobro mal capturado (te pide confirmar). El saldo del pedido sube otra vez."
 },
 {
  "clave": "botonBorrarContacto",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Borra este contacto del cliente (te pide confirmar). Si solo cambió de teléfono o de puesto, mejor edítalo con el lápiz."
 },
 {
  "clave": "botonBorrarFirma",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Limpia el recuadro para volver a firmar. Nada se guarda hasta que cierras el servicio."
 },
 {
  "clave": "botonCancelarDevolucion",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Cancela el registro con su motivo, por ejemplo si se capturó dos veces o el comprador ya no la mandó. Solo mientras sigue abierta: si ya llegó a almacén, ya no."
 },
 {
  "clave": "botonCancelarInvitacion",
  "modulos": [
   "admin"
  ],
  "texto": "Borra la invitación. Un correo de fuera de la empresa ya no podrá entrar; uno de la empresa sí entra, pero sin rol, hasta que se lo des."
 },
 {
  "clave": "botonCancelarOrdenMto",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Cancela la orden con su motivo (por ejemplo, era el mismo reporte). Se quitan las refacciones que nadie había entregado ni pedido a compras, se pausan los play y la máquina recalcula su estado."
 },
 {
  "clave": "botonCancelarPedido",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Cancela el pedido con su motivo: deja de contar para comisiones y cobranza. Sus órdenes de taller no se cancelan solas: avísale a producción."
 },
 {
  "clave": "botonCancelarPendiente",
  "modulos": [],
  "texto": "Se lo quitas a quien lo tiene: te pide confirmarlo y, si quieres, por qué (el motivo lo ve esa persona). Si se lo pediste a varias, se cancela para todas. Si fue error, lo puedes reabrir durante los minutos que fije dirección (15 de inicio)."
 },
 {
  "clave": "botonCancelarPrestamo",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Deja de descontarse desde ya, con el motivo (lo pagó en efectivo, se condonó…). Lo ya descontado se queda en el historial: un préstamo no se borra."
 },
 {
  "clave": "botonCancelarServicio",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Cancela el servicio con su motivo: la cuadrilla queda libre y se quitan los insumos que nadie había entregado ni pedido a compras. Quien lo pidió puede cancelarlo mientras no tenga fecha; después, solo la gerencia."
 },
 {
  "clave": "botonCapturarPedimento",
  "modulos": [
   "importaciones"
  ],
  "texto": "Captura a mano el pedimento pagado: número de 15 dígitos, fecha de pago e impuestos. Con eso se anota la etapa «Pedimento pagado» y ya se puede calcular el costeo preliminar. También lo puedes leer con la IA desde Documentos."
 },
 {
  "clave": "botonCerrarCosteoImportacion",
  "modulos": [
   "importaciones"
  ],
  "texto": "Cierra esta versión. El final pone el costo puesto en planta a los artículos del catálogo (con historial y el folio del embarque), sus precios se recalculan y se avisa a compras e ingeniería; el preliminar solo queda de referencia. Si cambió algo desde que se calculó, te pide recalcular."
 },
 {
  "clave": "botonCerrarReclamo",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Cierra el reclamo o la cancelación con lo que pasó: a favor (nos dieron la razón), en contra (se perdió) o sin efecto. Ya cerrado no se cambia."
 },
 {
  "clave": "botonCerrarServicio",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Termina el servicio. Pide al menos una foto del trabajo, qué se hizo y el nombre de quien recibe (la firma es opcional); en una garantía, si procedió. A quien lo pidió y al vendedor les llega un aviso, y si acabó antes de lo programado, la cuadrilla queda libre desde ese momento."
 },
 {
  "clave": "botonCompartirCredito",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Reparte el crédito de esta venta entre varios vendedores, en porcentajes que deben sumar 100 %. Cada uno cobra comisión solo sobre su parte. Solo la gerencia de ventas."
 },
 {
  "clave": "botonConectarGmailLectura",
  "modulos": [
   "importaciones"
  ],
  "texto": "Te lleva a Google para conectar tu Gmail una sola vez, con permiso de leer, para poder buscar y ligar hilos. Deja marcadas las dos casillas que te pide."
 },
 {
  "clave": "botonConectarML",
  "modulos": [
   "admin"
  ],
  "texto": "Te lleva a Mercado Libre para dar permiso con la cuenta de Hegamex. Antes hay que hacer los pasos de «Cómo se conecta»."
 },
 {
  "clave": "botonConfirmarMunicipio",
  "modulos": [
   "analisis"
  ],
  "texto": "Acepta el municipio que propuso el ERP y lo aplica a todos los clientes que escribieron igual, también a los que se den de alta después."
 },
 {
  "clave": "botonConvertirSugerencia",
  "modulos": [
   "admin"
  ],
  "texto": "Le pones nombre y clave, y el grupo se vuelve un subensamble: en cada equipo de la sugerencia, esas piezas sueltas se cambian por una línea con el subensamble. El costo y el precio no cambian."
 },
 {
  "clave": "botonCorregirFechaEtapa",
  "modulos": [
   "importaciones"
  ],
  "texto": "Corrige la fecha de este paso si se anotó mal. Ahí mismo sale «Quitar este paso» por si no debió registrarse."
 },
 {
  "clave": "botonCorregirSaldoVacaciones",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Fija a mano cuántos días le quedan hoy de un periodo, como diga el control en papel o en Excel. Los periodos anteriores se dan por usados y desde hoy se le cargan las vacaciones que se aprueben."
 },
 {
  "clave": "botonCrearOrdenesFaltantes",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Crea una orden de producción por cada equipo vendido que todavía no tiene, con su lista de materiales y la fecha compromiso del pedido. Solo entran los equipos con lista de materiales. Si hay uno igual para stock, usa antes «Usar»."
 },
 {
  "clave": "botonCrearOrdenesRequisicion",
  "modulos": [
   "compras"
  ],
  "texto": "Convierte las partidas marcadas en órdenes en borrador, una por proveedor: el mismo artículo de varias requisiciones va en una sola partida, con su costo vigente como precio. Si alguna no tiene proveedor, primero te pregunta a quién comprársela."
 },
 {
  "clave": "botonDarDeBaja",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Registra su último día y el motivo. Deja de contar en el personal activo y en las vacaciones; su historial se conserva. Te recuerda lo de su finiquito (vacaciones sin tomar, préstamo, ahorro) y, si tiene cuenta en el ERP, que se desactive."
 },
 {
  "clave": "botonDatosEmbarque",
  "modulos": [
   "importaciones"
  ],
  "texto": "Corrige o completa los datos del embarque: modalidad, incoterm, naviera, agente, BL, ETA, días libres… Si cambias la ETA, queda en la historia y se avisa a importaciones, compras y almacén; si cambias la modalidad o el incoterm, se ajusta la lista de documentos."
 },
 {
  "clave": "botonDecidirDevolucion",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Qué pasa con lo que regresó: reingresa al inventario si está bien para venderse (entra al almacén que elijas), es merma (entra y se pide el ajuste de salida, que autoriza otra persona) o se reclama a la paquetería con su folio (no entra al inventario). Lo decide almacén."
 },
 {
  "clave": "botonDescartarMejora",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Descarta la idea con su motivo: a quien la propuso le llega el aviso con el porqué. Sale del tablero y queda en «Ver descartadas»."
 },
 {
  "clave": "botonDescartarPropuestaCorreos",
  "modulos": [
   "importaciones"
  ],
  "texto": "Descarta lo que propuso la IA sin aplicar nada. Puedes volver a leer los correos cuando quieras."
 },
 {
  "clave": "botonDescartarSolicitud",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Cierra la solicitud sin cambiar la lista, porque no procede. Pasa a Resueltas como descartada, el pendiente de ingeniería se cierra y a quien la pidió le llega el aviso."
 },
 {
  "clave": "botonDescartarSugerencia",
  "modulos": [
   "admin"
  ],
  "texto": "Marca la sugerencia como descartada: deja de estar pendiente y ninguna lista de materiales cambia."
 },
 {
  "clave": "botonDesconectarML",
  "modulos": [
   "admin"
  ],
  "texto": "Quita la conexión con Mercado Libre (pide confirmar): las ventas, los reclamos y las preguntas dejan de entrar solos hasta que se vuelva a conectar."
 },
 {
  "clave": "botonDeshacerPunto",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Regresa el punto a «sin revisar» para volver a marcarlo."
 },
 {
  "clave": "botonDeshacerUbicacion",
  "modulos": [
   "analisis"
  ],
  "texto": "Borra esta corrección: los clientes que lo escribieron igual se vuelven a ubicar con su texto y, si no se reconoce, regresan a la lista por revisar."
 },
 {
  "clave": "botonDevolverJefe",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Regresa la evaluación a borrador para que el jefe la corrija, con el motivo de lo que hay que arreglar. Se borran el calificado y el revisado, y el motivo queda en los comentarios. Solo antes de aprobarla."
 },
 {
  "clave": "botonEditarDatosFabricado",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Cambia el nombre, la descripción y, en un equipo, su tipo. Las cotizaciones y pedidos que ya existen conservan el nombre con el que se hicieron."
 },
 {
  "clave": "botonEditarPlantilla",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Cambia la versión vigente: indicadores, pesos, reglas y desde qué mes vale. Si ya se calificó a alguien con ella, no se deja: crea una versión nueva."
 },
 {
  "clave": "botonEmpezarReparacion",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Guarda el diagnóstico. Si la orden estaba sin atender, pasa a En reparación con la hora de ahora; si la falla detiene la máquina, o es un preventivo, la máquina se ve En reparación hasta que se cierre la orden."
 },
 {
  "clave": "botonEntregarInsumo",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Para almacén: elige de qué almacén de planta sale y dale Entregar. Se registra la salida de inventario con el folio del servicio u orden, y la partida queda como Entregado."
 },
 {
  "clave": "botonEntregarPedido",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Registra lo que sale: cuánto de cada partida (todo lo que falta o solo una parte), quién recibió y, si ya la tienes, la foto de la hoja firmada. Lo que sale se descuenta del inventario. Si te equivocas, «Deshacer» en el aviso lo regresa todo."
 },
 {
  "clave": "botonEnviarCotizacion",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Abre el envío: por WhatsApp con el mensaje ya armado, por correo desde tu Gmail con el PDF, o solo marcarla enviada. Al enviarla ya no se edita, su oportunidad pasa a Cotizado (si no había, se abre) y se agenda preguntar qué pasó en 3 días hábiles. Antes te pide el tiempo de entrega."
 },
 {
  "clave": "botonesFlujoEvaluacion",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "«Enviar a RRHH»: el jefe la manda cuando ya calificó todo. «Marcar revisada»: Recursos Humanos, cuando ya no quedan impugnaciones pendientes; no la revisa quien la calificó. «Aprobar y cerrar el mes»: dirección, y no quien la revisó; después ya no se cambia."
 },
 {
  "clave": "botonesMarcaChecklist",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Palomita: cumplió. Tache: no cumplió, y se abre un campo para anotar qué pasó (Enter guarda). Si te equivocaste, toca la otra: la marca se reemplaza y la anterior queda guardada."
 },
 {
  "clave": "botonEstadoMatriz",
  "modulos": [
   "analisis"
  ],
  "texto": "Abre abajo qué se vende en este estado, en qué municipios y los textos que más se vendieron. Otro clic lo quita."
 },
 {
  "clave": "botonExpedienteEmbarque",
  "modulos": [
   "importaciones"
  ],
  "texto": "Abre en otra pestaña la carpeta del expediente de este embarque (la de Drive), la que se capturó en sus datos."
 },
 {
  "clave": "botonFamiliaMatriz",
  "modulos": [
   "analisis"
  ],
  "texto": "Pinta abajo el mapa de dónde se vende esta familia. Otro clic lo quita."
 },
 {
  "clave": "botonGenerarOrdenesReabasto",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Crea órdenes de compra en borrador, una por proveedor, con lo sugerido de lo que marcaste, menos lo que ya está en un borrador o en una requisición. Lo que no tiene proveedor no se pide y te lo enlista. Quedan en borrador para que compras las revise antes de enviarlas."
 },
 {
  "clave": "botonHacerloMio",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Este cliente no tiene dueño: con esto pasa a tu cartera. Desde ese momento sus contactos y su historia solo los ven tú, la gerencia y cobranza."
 },
 {
  "clave": "botonIniciarServicio",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Marca que la cuadrilla ya empezó: el servicio pasa a En curso con la hora de ahora. Una reparación en planta no se inicia sin recibir antes el equipo con fotos."
 },
 {
  "clave": "botonIrCuadrillas",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Quién trabaja qué en cada etapa ahorita y qué sigue. Ahí la gerencia de producción arma las cuadrillas arrastrando a la gente y acomoda la cola."
 },
 {
  "clave": "botonIrMaquinasHerramienta",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Te lleva a las máquinas y la herramienta del taller: su estado, las fallas reportadas, los preventivos y los préstamos. Es el mantenimiento de la planta, no el servicio a clientes."
 },
 {
  "clave": "botonIvaPedido",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "«Quitar IVA» es para cuando el cliente no quiere factura: el total queda igual al subtotal. «Agregar IVA» lo regresa y sube el total. No se puede quitar si el pedido ya tiene una factura registrada."
 },
 {
  "clave": "botonJefeCuadrilla",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Marca a esta persona como jefe de cuadrilla: lleva la corona en el servicio y en el calendario. Si no eliges a nadie, el jefe es el primero que marcaste."
 },
 {
  "clave": "botonLeerCorreosIA",
  "modulos": [
   "importaciones"
  ],
  "texto": "La IA lee todos los correos ligados a este embarque y te propone fechas de etapas, ETA, datos y documentos que llegaron, cada uno con el correo de donde salió. Nada cambia hasta que lo revisas y lo aplicas."
 },
 {
  "clave": "botonLeerDocumentoEmbarqueIA",
  "modulos": [
   "importaciones"
  ],
  "texto": "Sube un PDF o una foto (proforma, factura, packing list, BL, pedimento o cuenta de gastos) y la IA te propone sus datos junto al archivo. Nada se guarda hasta que lo revisas y das «Confirmar y guardar»."
 },
 {
  "clave": "botonLlenarEmbarqueConDocumento",
  "modulos": [
   "importaciones"
  ],
  "texto": "Sube el BL (o la PI, la factura o el packing list) y la IA llena el alta. Lo que llenó queda marcado para que lo revises; el archivo se guarda en el expediente al dar de alta."
 },
 {
  "clave": "botonMandarProduccion",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Crea una orden de taller por cada equipo de este pedido que tiene lista de materiales y todavía no tiene orden (una por pieza), y el pedido pasa a «En producción». Si ya hay uno igual hecho para stock, mejor asígnalo con «Usar» en Producción → Pedidos."
 },
 {
  "clave": "botonMarcarAplicada",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Dice que ya corregiste la lista de materiales: la solicitud pasa a Resueltas, tu pendiente se cierra solo y a quien la pidió le llega el aviso. No cambia nada de la lista: la corrección la haces antes con «Abrir lista»."
 },
 {
  "clave": "botonMarcarListoPedido",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Pasa el pedido a «Listo para entregar». Con equipos pasa solo cuando el taller termina su última orden; este botón es para lo que no se fabrica (refacciones, piezas de almacén)."
 },
 {
  "clave": "botonMarcarMejoraHecha",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Pasa la mejora a «Hechas». Antes escribe el resultado: qué se logró. La marcan quien la lleva o quien decide, y a quien la propuso le llega el aviso."
 },
 {
  "clave": "botonMarcarRecuperado",
  "modulos": [
   "importaciones"
  ],
  "texto": "Márcalo cuando ya te lo regresaron: queda recuperado con fecha de hoy y por el monto completo, y deja de avisar. Hace falta para poder cerrar el embarque."
 },
 {
  "clave": "botonNoSePuedeUbicar",
  "modulos": [
   "analisis"
  ],
  "texto": "Para textos que no son un lugar, como «Varios»: deja de salir aquí y esos clientes se quedan fuera del mapa. Se deshace en «Corregidas por dirección»."
 },
 {
  "clave": "botonNuevaCotizacion",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Abre una cotización en borrador con las condiciones de pago, entrega y notas que dejó la gerencia. El folio se asigna cuando agregas la primera partida: si sales sin capturar, no se gasta."
 },
 {
  "clave": "botonNuevaDevolucion",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Registra una devolución, un reclamo o una cancelación: buscas la venta por su número de Mercado Libre o el folio del pedido, eliges qué es y anotas el motivo y el código. Con una devolución, almacén ya sabe que viene."
 },
 {
  "clave": "botonNuevaOportunidad",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Registra una venta posible: el cliente, qué busca y cuánto podría ser. Queda a tu nombre en la etapa que elijas (Prospecto, Contactado o Cotizado); lo demás lo llenas después."
 },
 {
  "clave": "botonNuevaOrdenCompra",
  "modulos": [
   "compras"
  ],
  "texto": "Arma una orden de compra nueva: eliges al proveedor (desde su ficha ya viene elegido) o subes su cotización y la IA la lee. Queda en borrador para agregarle partidas."
 },
 {
  "clave": "botonNuevaOrdenTablero",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Abre los pedidos confirmados que tienen equipos sin orden, para crearles la suya: una orden por equipo, con su lista de materiales y sus horas por etapa. Para un equipo sin cliente, usa «Orden para stock» en Órdenes y material."
 },
 {
  "clave": "botonNuevaVersionPlantilla",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Copia la plantilla vigente para cambiarla desde el mes que elijas (de entrada, el siguiente). La versión anterior termina el mes antes y los meses ya calificados no cambian."
 },
 {
  "clave": "botonNuevoCliente",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Da de alta un cliente con lo mínimo para cotizar: su nombre y un teléfono; lo fiscal se completa después o con su constancia. Queda a tu nombre. Búscalo antes en la lista: ahí salen todos, también los de otros vendedores."
 },
 {
  "clave": "botonNuevoClienteRapido",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Da de alta un cliente que no está en la lista, con su nombre y un teléfono. Búscalo primero: si ya existe y lo das de alta otra vez, queda repetido."
 },
 {
  "clave": "botonNuevoEmbarque",
  "modulos": [
   "importaciones"
  ],
  "texto": "Da de alta un embarque. Basta con decir qué viene; si ya tienes el BL, la PI, la factura o el packing list, la IA llena el alta por ti. Al guardarlo se arma su lista de documentos y te lleva a su ficha."
 },
 {
  "clave": "botonNuevoEmpleado",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Da de alta a una persona. Con su fecha de ingreso se calculan solas la antigüedad y las vacaciones. Si es de Producción, de entrada queda en cuadrillas."
 },
 {
  "clave": "botonNuevoEquipo",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Da de alta un equipo con su clave (te propone la siguiente), nombre y tipo, y abre su ficha para que le captures la lista de materiales y las horas. Si se parece a uno que ya existe, es más rápido abrir ése y usar «Duplicar con otros parámetros»."
 },
 {
  "clave": "botonNuevoPrestamo",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Registra el préstamo con su descuento semanal y la semana en que empieza a descontarse. Queda autorizado a tu nombre (nadie se autoriza uno a sí mismo) y se abre su pagaré para imprimir y firmar."
 },
 {
  "clave": "botonNuevoProveedor",
  "modulos": [
   "compras"
  ],
  "texto": "Da de alta un proveedor: basta el nombre, lo demás es opcional, y lo fiscal se llena subiendo su constancia de situación fiscal. Si lo da de alta finanzas y ya existe uno con ese RFC, le pone al día los datos en vez de duplicarlo."
 },
 {
  "clave": "botonNuevoSubensamble",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Da de alta un subensamble vacío con su clave y nombre, y abre su ficha para capturarle sus piezas. Si esas piezas ya están en un equipo, es más rápido marcarlas ahí y usar «Convertir en subensamble»."
 },
 {
  "clave": "botonOrdenesMaterial",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "La lista de todas las órdenes con su material: qué está apartado, qué falta y si ya se pidió a compras. Ahí también se crean órdenes desde pedido o para stock."
 },
 {
  "clave": "botonOtraContrasena",
  "modulos": [
   "admin"
  ],
  "texto": "Genera otra contraseña fácil de dictar: letras y números separados por guiones, sin 0, O, 1 ni l."
 },
 {
  "clave": "botonPagarComision",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Marca la comisión del mes como pagada, con la fecha y la referencia del pago. Se guarda el cálculo de ese momento: si después cambia un pedido del mes, la tarjeta te enseña la diferencia. El mismo mes no se paga dos veces."
 },
 {
  "clave": "botonPantallaPiso",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Abre en otra pestaña lo que se ve en la TV del taller: lo que se trabaja en cada etapa, quién trabaja qué y lo que se entrega pronto, rotando solo, con la cinta de lo último que pasó. Ahí no se captura nada."
 },
 {
  "clave": "botonPedirACompras",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Le manda a compras una requisición con lo sugerido de lo que marcaste, menos lo que ya está pedido en un borrador o en otra requisición. Compras la convierte en órdenes de compra."
 },
 {
  "clave": "botonPedirAlgo",
  "modulos": [],
  "texto": "Le pides algo con fecha a una o varias personas: a cada una le llega un aviso y en «Los que pedí» ves cuándo lo terminan. Con varias, eliges si basta con que uno lo haga o si cada quien lo tiene que hacer."
 },
 {
  "clave": "botonPedirInsumosCompras",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Manda a compras, en una sola requisición con el folio, todo lo que sigue por entregar aquí. Esas partidas pasan a «En compras» y ya no se pueden quitar. Sale cuando lo pedido es más de lo que hay en planta."
 },
 {
  "clave": "botonPedirServicio",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Abre el formulario para pedir una instalación, puesta en marcha, garantía, reparación en planta o servicio en campo para un cliente. Al guardarlo le llega un aviso a la gerencia de producción, que le pone fecha y cuadrilla; a ti te llega otro cuando queda programado."
 },
 {
  "clave": "botonPendienteHecho",
  "modulos": [],
  "texto": "Lo das por terminado. Puedes dejar una respuesta corta (un precio, una fecha) y a quien te lo pidió le llega un aviso. Si fue error, lo puedes deshacer durante los minutos que fije dirección (15 de inicio)."
 },
 {
  "clave": "botonPersonalPiso",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "La gente de Producción y cómo trabaja el taller: el área y la especialidad de cada quien y si entra a cuadrillas, cómo se cuentan las horas, el horario del taller y la capacidad por área. Solo la gerencia de producción."
 },
 {
  "clave": "botonPonerMejoraEnMarcha",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Guarda lo que cambiaste y pasa la mejora a «En marcha». Antes elige quién la lleva y para cuándo. A quien la propuso le llega el aviso."
 },
 {
  "clave": "botonPorQueReabasto",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Abre el cálculo de este artículo paso a paso, con sus números: consumo de los últimos meses, demanda, punto de reorden, lote, disponible y por qué quedó en este estado."
 },
 {
  "clave": "botonProbarSkydropx",
  "modulos": [
   "admin"
  ],
  "texto": "Revisa que el ERP pueda entrar a Skydropx: muestra el saldo de la cuenta y las direcciones dadas de alta allá, para que elijas la de la planta. No genera ni cobra nada."
 },
 {
  "clave": "botonProgramarServicio",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Le pones día, hora, duración y cuadrilla. No te deja poner a alguien que ya va en otro servicio a esa hora ni a quien tiene vacaciones, permiso o incapacidad aprobados. Al guardar, a quien lo pidió y al vendedor del cliente les llega un aviso."
 },
 {
  "clave": "botonProponerIdea",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Manda la idea al tablero de Mejoras como propuesta, a nombre de quien la tuvo. A ingeniería de procesos y a la gerencia de producción les llega el aviso para decidirla."
 },
 {
  "clave": "botonPuntoBien",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Marca este punto como revisado y en buen estado, a tu nombre."
 },
 {
  "clave": "botonPuntoFalla",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Marca este punto con falla: escribe qué tiene y confírmalo. Queda anotado en rojo en la orden."
 },
 {
  "clave": "botonQuitarAjusteComision",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Quita este ajuste de la comisión del mes. Ya no se puede cuando la comisión está pagada."
 },
 {
  "clave": "botonQuitarConceptoNomina",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Quita este concepto capturado a mano. Solo se puede mientras la semana está abierta; el préstamo, el ahorro y el bono no se quitan aquí."
 },
 {
  "clave": "botonQuitarCostoServicio",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Borra este costo. Las refacciones que entregó almacén no se quitan desde aquí."
 },
 {
  "clave": "botonQuitarGastoEmbarque",
  "modulos": [
   "importaciones"
  ],
  "texto": "Borra este gasto del embarque al instante, sin preguntar. Si ya calculaste el costeo, vuelve a calcularlo antes de cerrarlo."
 },
 {
  "clave": "botonQuitarHilo",
  "modulos": [
   "importaciones"
  ],
  "texto": "Quita el hilo de este embarque y borra los correos que se guardaron de él. En Gmail no se toca nada."
 },
 {
  "clave": "botonQuitarIndicador",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Quita este indicador de la plantilla. Sus puntos quedan libres: repártelos para que vuelvan a sumar 100."
 },
 {
  "clave": "botonQuitarInsumoServicio",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Quita esta partida. Solo se puede mientras almacén no la haya entregado ni se haya pedido a compras."
 },
 {
  "clave": "botonQuitarOrdenEmbarque",
  "modulos": [
   "importaciones"
  ],
  "texto": "Quita esta orden del embarque; la orden no se borra. No te deja si ya tiene pagos registrados en este embarque."
 },
 {
  "clave": "botonQuitarReglaFamilia",
  "modulos": [
   "analisis"
  ],
  "texto": "Borra la regla y vuelve a clasificar todas las ventas de la hoja sin ella. No pide confirmación."
 },
 {
  "clave": "botonRechazarAjuste",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Lo cierra sin mover la existencia; queda en el historial con tu comentario. Úsalo cuando haya que volver a contar o cuando un conteo posterior ya dejó bien el artículo."
 },
 {
  "clave": "botonRechazarSolicitud",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "La rechazas con un motivo, que la persona ve en su historial. No se resta del saldo, no sale en el calendario y no cuenta en la prenómina."
 },
 {
  "clave": "botonRecibirDevolucion",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Almacén registra que llegó: cuántas piezas de cada partida llegaron de verdad y cómo venía. Antes pide al menos una foto de cómo llegó, sin abrirla: es la prueba ante Mercado Libre o la paquetería. Todavía no entra al inventario."
 },
 {
  "clave": "botonRecibirEquipo",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Registra que el equipo ya llegó al taller: tomas fotos de cómo llega y anotas su condición (golpes, piezas que faltan). Sin al menos una foto no se recibe. Una reparación en planta no se puede iniciar ni cerrar sin esto."
 },
 {
  "clave": "botonReciboRetiro",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Abre el recibo de este retiro para volver a imprimirlo: sale con su folio, original y copia."
 },
 {
  "clave": "botonReescribirSemana",
  "modulos": [],
  "texto": "Pide que la IA vuelva a escribir la semana con los números de este momento. Si no, se queda la primera que escribió esta semana. Cuenta para tus consultas de IA del día."
 },
 {
  "clave": "botonRegistrarEtapaEmbarque",
  "modulos": [
   "importaciones"
  ],
  "texto": "Guarda la fecha real de este paso (Enter también). Solo acepta hoy o antes. «Cerrado» pide antes la cuenta de gastos y que lo que había por recuperar ya esté marcado como recuperado."
 },
 {
  "clave": "botonRegistrarIncidencia",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Registra vacaciones, permiso, falta, incapacidad, retardo u horas extra. Recursos Humanos lo puede dejar aprobado de una vez; si lo registra alguien más, queda como solicitud por aprobar."
 },
 {
  "clave": "botonRegistrarMovimiento",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Te lleva a Entradas y salidas para registrar una salida (consumo o venta), una devolución o un traspaso. Desde la ficha de un artículo, llega con el artículo ya elegido."
 },
 {
  "clave": "botonRegistrarPagoImportacion",
  "modulos": [
   "importaciones"
  ],
  "texto": "Registra un anticipo, saldo o pago total de una orden del embarque, o déjalo programado con su fecha. Si ya salió, pide los pesos que salieron para sacar el tipo de cambio real."
 },
 {
  "clave": "botonRegistrarPagoNomina",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Anota que la nómina de esta semana ya se pagó: fecha, cuenta de donde salió y monto. Queda en los pagos de finanzas como nómina (aparte de proveedores), la semana dice «Pagada el…» y Recursos Humanos recibe un aviso."
 },
 {
  "clave": "botonRegistrarSueldo",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Registra el sueldo base semanal de una persona desde una fecha, con su motivo. El anterior no se borra y las semanas ya cerradas no cambian."
 },
 {
  "clave": "botonRegresarMejoraPropuesta",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Regresa la mejora a «Propuestas» para volver a decidirla. Si estaba descartada, se borra el motivo."
 },
 {
  "clave": "botonReingreso",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Lo vuelve a activar. La antigüedad y las vacaciones cuentan desde la fecha de reingreso; si la baja fue un error de captura, marca que conserve su fecha de ingreso original."
 },
 {
  "clave": "botonResponderReclamo",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Anota lo que se le contestó al cliente o a Mercado Libre. El reclamo pasa a «Respondido»; después lo cierras con su resultado."
 },
 {
  "clave": "botonRestantesCumplieron",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Marca «cumplió» de un jalón a todos los que todavía no tienen marca este día (y en este momento, si es el celular). Las marcas que ya pusiste no cambian y a ti no te marca."
 },
 {
  "clave": "botonRevisarAhoraML",
  "modulos": [
   "admin"
  ],
  "texto": "Vuelve a procesar los avisos de Mercado Libre que quedaron pendientes o con error, hasta 50 a la vez, también los que ya se habían dejado de intentar."
 },
 {
  "clave": "botonSacarDeCuadrilla",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Saca a la persona de esta etapa. Si estaba trabajando, su tiempo ahí se cierra en ese momento (primero te pregunta) y la etapa sigue con los demás; si solo estaba planeada, deja de tocarle."
 },
 {
  "clave": "botonSaldoInicialAhorro",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Lo que ya tenía ahorrado antes del ERP, según el control en Excel. Se registra una sola vez: un ajuste después se hace con un retiro o en la nómina."
 },
 {
  "clave": "botonSubirDocumentoEmbarque",
  "modulos": [
   "importaciones"
  ],
  "texto": "Sube el archivo (PDF, imagen, Word o Excel) sin leerlo con la IA: queda en su casilla y pasa a recibido. Si ya tenía uno, el nuevo se agrega como otro renglón del mismo documento y el anterior se queda."
 },
 {
  "clave": "botonTerminarAsignacion",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Pone su último día en ese puesto. Para cambiarla de puesto, termina esta asignación y asigna la nueva desde el día siguiente."
 },
 {
  "clave": "botonTraerLoNuevoHilo",
  "modulos": [
   "importaciones"
  ],
  "texto": "Trae los correos nuevos de este hilo desde tu Gmail. Solo te sale si tú lo ligaste, porque es tu cuenta."
 },
 {
  "clave": "botonUsarEscenario",
  "modulos": [
   "analisis"
  ],
  "texto": "Copia la meta del escenario en la casilla de la meta. Todavía no queda guardada: revísala y dale Guardar."
 },
 {
  "clave": "botonUsarTextoRegla",
  "modulos": [
   "analisis"
  ],
  "texto": "Copia este texto como patrón en el formulario de arriba, sin números ni medidas, para que lo ajustes y elijas la familia. No guarda nada."
 },
 {
  "clave": "botonVerClientesUbicacion",
  "modulos": [
   "analisis"
  ],
  "texto": "Abre la lista de clientes que escribieron esta combinación, para corregir su ficha si hace falta."
 },
 {
  "clave": "botonVerDetalleSugerencia",
  "modulos": [
   "admin"
  ],
  "texto": "Muestra las piezas del grupo y los equipos que lo tienen completo."
 },
 {
  "clave": "botonVerEmbarquesCerrados",
  "modulos": [
   "importaciones"
  ],
  "texto": "Muestra la lista de los embarques ya cerrados y los cancelados. No salen en las columnas de arriba ni cuentan en «En curso»."
 },
 {
  "clave": "botonVerGraficaTabla",
  "modulos": [
   "analisis"
  ],
  "texto": "Cambia entre la gráfica y la misma información en tabla, para leer las cifras exactas o copiarlas."
 },
 {
  "clave": "botonVerTodasAlertasImportacion",
  "modulos": [
   "importaciones"
  ],
  "texto": "De inicio ves hasta 6 avisos rojos o ámbar. «Ver las…» muestra todos, también los informativos (como una ETA que se adelantó); «Solo lo urgente» regresa a los primeros."
 },
 {
  "clave": "botonVolverAnalizar",
  "modulos": [],
  "texto": "Pide el resumen otra vez, con los datos de este momento. Si no lo pides, el que escribió la IA se reusa hasta 6 horas. Cuando lo escribe la IA cuenta para tus consultas de IA del día; sin IA, solo se recalculan los avisos."
 },
 {
  "clave": "botonVolverMedir",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Vuelve a medir con los datos de hoy lo que mide el sistema y el checklist, y toma los cambios de la plantilla del puesto. Lo que el jefe calificó a mano se queda, salvo en un indicador que cambió en la plantilla."
 },
 {
  "clave": "botonVolverPaisMapa",
  "modulos": [
   "analisis"
  ],
  "texto": "Regresa al mapa de todo el país, con el mismo periodo y la misma medida."
 },
 {
  "clave": "botonYaLoPediDocumento",
  "modulos": [
   "importaciones"
  ],
  "texto": "Anota que hoy volviste a pedir este documento a quien lo debe, para que se vea hace cuánto se pidió. No manda ningún correo. Si te equivocaste, usa «Deshacer» en el aviso."
 },
 {
  "clave": "bultosEnvio",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Cuántos paquetes lleva y su peso total. Salen del empaque guardado en cada artículo; \"sin medir\" son paquetes a los que les faltan medidas."
 },
 {
  "clave": "bultosFlete",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Las cajas que van a salir, con peso y medidas. Salen del empaque capturado de cada artículo de la cotización (sin contar opcionales ni servicios); si a uno le falta, escríbelo o agrega un bulto a mano. Sin peso y medidas de todos, la paquetería no cotiza."
 },
 {
  "clave": "calendarioAreas",
  "modulos": [],
  "texto": "Cada color es un área, y es siempre el mismo. Toca un área para esconderla o volver a mostrarla; el número es cuántas cosas tiene en estos días. Solo salen las áreas que tu puesto puede ver: un vendedor no ve las compras ni los pagos, y los pagos solo los ve finanzas."
 },
 {
  "clave": "calendarioAusencias",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Quién falta cada día del mes, con un color por tipo. Las solicitudes por aprobar se ven punteadas y los días que no se trabajan, en gris. Clic en un día para registrar algo en esa fecha."
 },
 {
  "clave": "calendarioCuadrillas",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Una fila por persona y una barra por servicio, dos semanas a la vez; los fines de semana van sombreados. El color es el tipo de servicio y, si la barra se ve más clara, ya se cerró. Pasa el mouse por una barra para ver su horario y sus horas de taller; con clic abres el servicio."
 },
 {
  "clave": "calificacionIndicador",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Los puntos que sacó en este indicador contra su peso, que es lo más que puede dar. Verde: todo el peso; amarillo: una parte; rojo: 0. Un guion: falta calificarlo."
 },
 {
  "clave": "cambiarMesAusencias",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Pasa al mes anterior o al siguiente. «Hoy» te regresa al mes en curso."
 },
 {
  "clave": "cambioBitacora",
  "modulos": [
   "admin"
  ],
  "texto": "Qué datos cambiaron. Si fue uno solo, ves el antes tachado y el después; en altas y bajas, cuántos datos traía. Dale clic al renglón para ver todo."
 },
 {
  "clave": "cambioCosto",
  "modulos": [
   "compras"
  ],
  "texto": "Cuánto sube o baja el costo nuevo contra el actual, comparado en pesos. Rojo: sube más de 10 %. Amarillo: sube. Verde: baja. Con un triángulo, el cambio pasa de 50 %: revisa que la unidad y la moneda sean las mismas. Sin nada escrito, en gris va el último cambio que tuvo."
 },
 {
  "clave": "cambioDeManos",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Mover a alguien que está trabajando, o meterlo a una etapa en proceso, cambia sus horas de verdad: su tiempo donde estaba se cierra en ese momento y el nuevo empieza a contar. Por eso se confirma. Es lo mismo que marcar «Sale» y «Se une» en la terminal, y la terminal lo ve al instante."
 },
 {
  "clave": "cambiosErp",
  "modulos": [
   "admin"
  ],
  "texto": "Las altas, cambios y bajas que la persona registró en el periodo, los mismos de la Bitácora: una cotización, un surtido, un pendiente cerrado, una partida corregida…"
 },
 {
  "clave": "cambiosSugeridosML",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Lo que habría que cambiar en Mercado Libre para que cuadre con el ERP: el precio, cuando difiere 2 % o más del sugerido, y la existencia, cuando Mercado Libre tiene más de lo libre en planta o se agotó allá y en planta sí hay. Te enseña el antes y el después; palomeas los que quieres y se mandan. El valor siempre es el sugerido. Antes de mandar se vuelve a leer cada publicación: si alguien la cambió en Mercado Libre, esa no se toca. Dejar una en 0 viene sin palomear porque Mercado Libre la pausa."
 },
 {
  "clave": "campoMetaAnual",
  "modulos": [
   "analisis"
  ],
  "texto": "Escribe la meta del año con IVA: acepta «32,000,000» o «32 M». Enter o Guardar la guarda; abajo ves cuánto es contra lo que cerró el año anterior."
 },
 {
  "clave": "canalesEnLinea",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Precio sugerido con IVA para cada canal (Mercado Libre, sitio web…): parte del precio de lista y le suma la comisión del canal, la cuota fija y el envío. «Abajo del sugerido» avisa que una publicación está más barata que eso."
 },
 {
  "clave": "canalSeguimientoCotizacion",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Por dónde hablaste con el cliente. Lo que escribes queda en su historia con ese medio y cuenta como seguimiento para la vigencia de su cuenta."
 },
 {
  "clave": "canalVenta",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Por dónde entró la venta: Directo (vendedores), Mercado Libre, Sitio web, Mostrador, Distribuidor o Amazon."
 },
 {
  "clave": "cancelarOrdenCompra",
  "modulos": [
   "compras"
  ],
  "texto": "Cancela una orden enviada de la que no ha llegado nada. Escribes el motivo (queda en sus notas) y lo que venía de requisiciones regresa a pendiente para volver a pedirse."
 },
 {
  "clave": "cancelarPartidaRequisicion",
  "modulos": [
   "compras"
  ],
  "texto": "Cancela esta partida porque ya no se necesita: sale de la lista y ya no se comprará. Te pide confirmar."
 },
 {
  "clave": "cancelarSolicitudPrecio",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Cancela la solicitud con su motivo: compras deja de cotizarla y, si ya la tenía alguien, le llega un aviso. Solo se puede mientras no la contesten."
 },
 {
  "clave": "cantidadEfectiva",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Lo que de verdad lleva el equipo: la cantidad fija más lo que suma el parámetro, redondeada hacia arriba si está marcado, y con la merma. Si depende de un parámetro, la cifra sale subrayada: pasa el mouse sobre ella para ver la cuenta."
 },
 {
  "clave": "cantidadFijaLinea",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Cuánto lleva de esa pieza, en su unidad (piezas, metros, kilos…). Si la línea depende de un parámetro, ésta es la parte fija y se le suma lo de «Por parámetro»."
 },
 {
  "clave": "cantidadIncidencia",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Vacaciones, permisos y faltas se cuentan en días hábiles; la incapacidad, en días naturales, como el IMSS. El retardo va en minutos y las horas extra, en horas."
 },
 {
  "clave": "cantidadRecibidaDevolucion",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Cuántas piezas llegaron de verdad, según almacén al recibirla. En ámbar si llegaron menos de las que se esperaban."
 },
 {
  "clave": "capacidadAutomatica",
  "modulos": [
   "admin"
  ],
  "texto": "La capacidad del área sale de su gente: personas del área que entran a cuadrillas × horas de la semana del taller × aprovechamiento, redondeada a 5. Se recalcula sola cuando alguien cambia de área o de cuadrillas, entra o se va, o cambia el horario. Apagada, se pone a mano (para áreas sin gente fija, como Pruebas o Embarque). Un área automática que se queda sin gente conserva su último número."
 },
 {
  "clave": "capacidadEtapa",
  "modulos": [
   "admin"
  ],
  "texto": "Horas hombre por semana que da esa área del taller. Con ellas se arma el plan del taller, la fecha realista de entrega y la carga por semana. Si es automática, la calcula el ERP con la gente del área; si no, se pone a mano."
 },
 {
  "clave": "capacidadTotalTaller",
  "modulos": [
   "admin"
  ],
  "texto": "La suma de la capacidad por semana de las etapas activas, en horas hombre."
 },
 {
  "clave": "capturaConteo",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Escribe lo que contaste y Enter: se guarda y bajas al siguiente (con ↑ ↓ también te mueves). Esc borra lo que escribiste. La palomita verde dice que ya quedó guardado."
 },
 {
  "clave": "capturaIndicador",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Lo que pone el jefe según la regla: cuántas incidencias, el resultado del mes o lo cumplido de lo posible, con una nota y, si quieres, una liga de evidencia. Enter guarda y el resultado se recalcula."
 },
 {
  "clave": "cargaPersona",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Horas de trabajo que esta persona tiene encima: de cada etapa donde está (trabajando o planeada), lo que falta repartido entre su cuadrilla. Sirve para ver quién va a quedar libre primero."
 },
 {
  "clave": "cargaPreventivo",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Cuántos preventivos tocan cada una de las próximas 8 semanas, proyectados de cada plan activo (no solo las órdenes que ya se generaron, que salen pocos días antes) y la orden abierta de cada plan. «Vencidos» son los que ya pasaron su fecha. Arriba de cada barra, las horas de técnico estimadas con lo que tardó ese plan antes (o el promedio). Sirve para ver semanas pesadas y repartir antes."
 },
 {
  "clave": "cargaSemanal",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Cuánto trabajo tiene cada área por semana: producción liberada (repartida entre hoy y su fecha de compromiso) más las horas de su gente en servicio, contra lo que el área puede trabajar. Las órdenes atrasadas cuentan completas en esta semana; las que están en espera no cuentan, y lo planeado sin liberar se ve aparte («plan.») sin sumar."
 },
 {
  "clave": "cargaTaller",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Semanas de trabajo pendientes en cada etapa: horas que faltan ÷ horas que esa etapa puede trabajar por semana. Oscuro es lo liberado; claro, lo planeado que viene."
 },
 {
  "clave": "cargaTallerTablero",
  "modulos": [],
  "texto": "Cuántas semanas de trabajo le quedan a cada área con lo que ya entró al taller (órdenes liberadas y en proceso, sin las que están en espera): horas que faltan ÷ horas que el área trabaja por semana. Lo planeado que no se ha liberado no cuenta aquí."
 },
 {
  "clave": "cartaPorte",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "La clave del SAT que describe lo que se manda. La paquetería la exige en cada guía; aquí se elige una vez para todas."
 },
 {
  "clave": "cartera",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Cada cliente es de un vendedor hasta la fecha que ves: la más lejana entre su última venta con él + 12 meses, su último seguimiento (cotización, oportunidad o actividad) + 90 días y, si es nuevo, su alta + 90 días. Los plazos se ajustan en Configuración. Pasada esa fecha la cuenta vence y puede quedar libre."
 },
 {
  "clave": "casillaElegirReabasto",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Marca lo que quieres pedir; solo se pueden marcar los artículos con sugerido. La casilla de arriba marca todos los de la vista que tienen sugerido."
 },
 {
  "clave": "categoriaMaquina",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Qué clase de equipo es (soldadora, compresor, impresora, aire acondicionado…). Es libre: si no está en la lista, se escribe. Agrupa las refacciones que lleva y las rutinas de mantenimiento, así que conviene usar la misma palabra para lo mismo."
 },
 {
  "clave": "categoriasConsumibles",
  "modulos": [
   "admin"
  ],
  "texto": "Las categorías cuyos artículos cuentan como consumibles del taller. Marca o desmarca y da «Guardar categorías»; con el interruptor prendido, al guardar se suelta lo apartado para órdenes de las que quedaron marcadas."
 },
 {
  "clave": "categoriaSugeridaSat",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "La categoría que sugiere lo que dice la factura, no el proveedor. Cada concepto del XML trae su clave de producto o servicio del SAT (78101802 es flete por carretera, 31191500 abrasivos, 83101800 luz). Si ya registraste antes una compra sin orden de compra con esa clave, se sugiere la categoría que le pusiste; si nunca, la de una tabla de arranque revisada contra el catálogo del SAT. Cuando la factura trae varios conceptos, gana lo que más vale. La clave genérica 01010101 no dice nada y no cuenta. Es una sugerencia: cámbiala si no es, y la próxima vez se sugiere lo que elegiste."
 },
 {
  "clave": "categoriaXml",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "En qué se gastó, según el XML: por lo comprado cuando las claves del SAT de sus conceptos lo dicen (como al registrar una compra de hoy); si no dicen nada, por el giro del proveedor. La de «por lo comprado» es la que cuenta en Resultados, salvo cuando el proveedor está en una categoría que no es gasto (como «Sin efectos»): ahí manda la del proveedor."
 },
 {
  "clave": "cerrarOrdenesCreadas",
  "modulos": [
   "compras"
  ],
  "texto": "Quita este aviso y regresa a la lista con su filtro de siempre. Las órdenes que se crearon siguen ahí, en borrador."
 },
 {
  "clave": "cerrarOrdenMto",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Escribe qué se hizo y, si hace falta, corrige las horas trabajadas y el horómetro. No se cierra mientras falte un punto del checklist. Al cerrar se pausan los play abiertos, la máquina recalcula su estado y, si es preventivo, su plan empieza a contar desde hoy."
 },
 {
  "clave": "cerrarSemana",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Al cerrar la semana se congelan los renglones, se descuentan los préstamos, lo descontado para la caja de ahorro pasa al saldo de cada quien y se marcan pagados los bonos que ya tienen base. Después ya no cambia: un error se corrige en una semana abierta con otro concepto."
 },
 {
  "clave": "cfdi",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "El archivo XML de la factura electrónica (el que timbra el SAT, junto al PDF). Trae el RFC del proveedor, el folio, el total, la fecha y si es de contado o a crédito; al subirlo se llena todo. La misma factura no entra dos veces."
 },
 {
  "clave": "cfdiCancelada",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Una factura que se canceló en el SAT (casi siempre porque salió mal y se volvió a timbrar). No cuenta: no se amarra a la hoja ni sale como pendiente. Las que vienen de una carpeta «Canceladas» de Drive se marcan solas; si el SAT dice que otra está cancelada, márcala con su botón y su renglón de la hoja pasa a la factura que la reemplazó."
 },
 {
  "clave": "checklistAplica",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Los puntos del checklist diario que le revisan a esta persona: EPP (casco, botas y guantes, normalmente el personal de taller), entrega de celular y revisión de vehículo (quien maneja). Los palomea Recursos Humanos en su ficha. Sin palomear, la persona no sale en ese checklist y no se le puede marcar. Si sus objetivos miden uno de esos puntos, palomealo, o ese objetivo se queda sin dato. La limpieza no va aquí: se marca por área."
 },
 {
  "clave": "checklistCelular",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Si entregó el celular. Se revisa tres veces al día (entrada, break 1 y break 2) y cada vez es una marca aparte. Salen quienes lo tienen palomeado en su ficha."
 },
 {
  "clave": "checklistEpp",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Si trae su equipo de protección: casco, botas y guantes. Salen quienes lo tienen palomeado en su ficha, normalmente el personal de taller."
 },
 {
  "clave": "checklistLimpieza",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Se marca por área, no por persona: la marca de un área cuenta para todos los que la tienen en sus objetivos."
 },
 {
  "clave": "checklistMantenimiento",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Los puntos de la rutina en esta orden. Cada uno se marca bien, o con falla y qué tiene. La orden no se cierra mientras quede alguno sin revisar."
 },
 {
  "clave": "checklistVehiculos",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "La revisión del vehículo y el montacargas: niveles, llantas y documentos. Salen quienes lo tienen palomeado en su ficha (quien maneja)."
 },
 {
  "clave": "choqueCuadrilla",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Esta persona ya va en otro servicio que se encima con estas fechas. Así no se puede guardar: quítala o mueve uno de los dos."
 },
 {
  "clave": "cierreEstimadoOportunidad",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "El día en que crees que el cliente va a decidir. Sale en el calendario como «Cierre esperado», en ámbar si ya pasó y sigue abierta."
 },
 {
  "clave": "claveInegi",
  "modulos": [
   "analisis"
  ],
  "texto": "La clave oficial del INEGI del estado o del municipio. Sirve para cruzar estos datos con otras bases o mapas."
 },
 {
  "clave": "claveSugerida",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "La clave que te propone el ERP: el siguiente número de la serie que más se usa en ese tipo. Puedes cambiarla; nunca te propone una que ya exista."
 },
 {
  "clave": "clienteLibre",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Cliente sin vendedor dueño: cualquiera le puede cotizar o darle “Hacerlo mío”."
 },
 {
  "clave": "clienteQuedaAMiNombre",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Marcado, el cliente queda en tu cartera. Sin marcar queda libre, sin dueño: cualquier vendedor le puede dar «Hacerlo mío»."
 },
 {
  "clave": "clientesDejaronComprar",
  "modulos": [
   "analisis"
  ],
  "texto": "Clientes de ese lugar que compraron en el periodo anterior y en este nada, con lo que compraban y su vendedor. Salen hasta 6, los que más compraban primero; clic para abrir su ficha."
 },
 {
  "clave": "clientesNuevosRecurrentes",
  "modulos": [
   "analisis"
  ],
  "texto": "Nuevo: su primera compra fue ese año (en la cifra de arriba, dentro del periodo). Recurrente: ya había comprado antes."
 },
 {
  "clave": "clientesQueCompraron",
  "modulos": [
   "analisis"
  ],
  "texto": "Cuántos clientes distintos compraron en el periodo. Un cliente con varias compras cuenta una vez."
 },
 {
  "clave": "coberturaContraMeta",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Cuántos meses alcanza lo disponible con lo que sale al mes, dividido entre la meta de cobertura del artículo (1 mes nacional y 6 importado, salvo que el artículo tenga la suya). «En la meta» es de 1 a 2 veces; abajo falta, arriba sobra. Solo cuenta artículos con demanda mensual."
 },
 {
  "clave": "coberturaEstado",
  "modulos": [
   "analisis"
  ],
  "texto": "Qué parte de toda la venta desde 2018 es de clientes con estado reconocido: eso es lo que sale en el mapa. Más alto es mejor."
 },
 {
  "clave": "coberturaMunicipio",
  "modulos": [
   "analisis"
  ],
  "texto": "Qué parte de toda la venta desde 2018 es de clientes ubicados hasta su municipio. Abajo, cuántos clientes lo están."
 },
 {
  "clave": "coberturaTerminal",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Qué parte de las etapas terminadas se marcó en la terminal con quién la trabajó. Las horas, los tiempos de espera y la eficiencia del flujo salen solo de esas; si la cobertura es baja, esos números dicen poco. Las entregas a tiempo y los terminados no dependen de esto."
 },
 {
  "clave": "coberturaXml",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Por año, cuántas compras y ventas de la hoja ya tienen su XML amarrado. «Con OC»: las que en la hoja traen número de orden de compra. «Por lo comprado»: las que tienen categoría por su clave del SAT. Mientras más alto, más fiel es la historia en Resultados."
 },
 {
  "clave": "cobradoPorMes",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Los cobros registrados cada mes, en pesos, con los pagos que trae la hoja y lo que se ha cobrado aquí de los saldos de la hoja. Los de pedidos en dólares se convierten al tipo de cambio del pedido, no al de hoy."
 },
 {
  "clave": "cobradoSemana",
  "modulos": [],
  "texto": "Lo que se cobró la semana pasada de pedidos del ERP, en pesos (los de dólares, al tipo de cambio del pedido), contra la semana anterior. Verde si subió."
 },
 {
  "clave": "cobranzaAntiguedadTablero",
  "modulos": [],
  "texto": "Lo que deben los clientes en pedidos del ERP, agrupado por días desde la fecha del pedido: 0 a 30, 31 a 60, 61 a 90 y más de 90. Lo que se debía en la hoja no entra en las barras: su total va arriba, en la descripción."
 },
 {
  "clave": "cobroSaldoHoja",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Un pago de un cliente a lo que debía en la hoja (antes de que sus pedidos se capturaran aquí). Baja su saldo al momento; no deja cobrar más de lo que debe."
 },
 {
  "clave": "cobrosPedido",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Los pagos de este pedido, con su fecha, forma de pago y referencia. Los registra finanzas; los de Mercado Libre entran solos con su pago. La barra es lo cobrado contra el total."
 },
 {
  "clave": "codigoAutorizacion",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "El código que da Mercado Libre para esa devolución o reclamo. Queda aquí y no en el chat."
 },
 {
  "clave": "codigoSerie",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "La parte fija del número de serie de un equipo: su tipo, medidas y motor, como en la hoja (TB20090275E = banda, 20 pulgadas, 9 m, 2 HP, caja 75). Se captura una vez por equipo; sin él, su orden de producción se crea sin número de serie."
 },
 {
  "clave": "cohortesClientes",
  "modulos": [
   "analisis"
  ],
  "texto": "Clientes agrupados por el año de su primera compra, y qué parte volvió a comprar 1, 2, 3… años después. 2018 junta a todos los que ya compraban, porque ahí empieza el libro de ventas."
 },
 {
  "clave": "colaEtapa",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Lo que espera en esta etapa, en el orden en que se va a trabajar. La gerencia de producción lo acomoda arrastrando una tarjeta sobre otra (queda antes) o con «Antes» y «Después» en su detalle, o subiendo la orden en el Gantt: es la misma fila y el plan la sigue. Lo que nadie acomodó va por prioridad, atrasos y fecha compromiso. «Antes: Pailería» quiere decir que esa etapa todavía no termina en la misma orden. Una etapa en paralelo, como Torno, sale lista aunque las anteriores sigan."
 },
 {
  "clave": "columnaAlmacen",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Cuánto hay de este artículo en ese almacén. El punto (·) es cero; en rojo, negativo."
 },
 {
  "clave": "columnaLlevaPedido",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Los equipos que se vendieron en el pedido, con su cantidad. Abajo, con «+», lo demás que lleva y no se fabrica (componentes, refacciones, servicios)."
 },
 {
  "clave": "comentariosEvaluacion",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Lo que escriben la persona, su jefe y Recursos Humanos sobre ese mes. Sirve para aclarar algo antes de que se apruebe; cuando se devuelve una evaluación, el motivo también queda aquí."
 },
 {
  "clave": "comision",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "El porcentaje de tu plan sobre lo que vendiste en el mes de todo lo que no es refacción (maquinaria y, si el plan lo dice, “otros”), sin IVA. Más un bono por escalón de maquinaria, otro por escalón de refacciones y los ajustes."
 },
 {
  "clave": "comisionCanal",
  "modulos": [
   "admin"
  ],
  "texto": "Lo que se queda el canal de cada venta. El precio en ese canal sube para que, después de la comisión, llegue completo el precio de lista."
 },
 {
  "clave": "comisionPagada",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Finanzas la marca pagada y se guarda una foto del cálculo de ese momento. Si después se mueve un pedido del mes, la tarjeta te avisa la diferencia."
 },
 {
  "clave": "comoLoLleva",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Directo: va en la lista de ese equipo o subensamble, con la cantidad que ves. Dentro de un subensamble: lo lleva a través de uno; nivel 2 es un subensamble del equipo, nivel 3 un subensamble dentro de otro."
 },
 {
  "clave": "comoTerminoSeguimientoCliente",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Cierra el seguimiento. Le interesa: se crea su oportunidad en Contactado (o se usa la que ya tenía abierta). No por ahora o No contesta: vuelve a esta lista en 90 días. Ya no compra: sale de la lista, con la razón."
 },
 {
  "clave": "comoVaCotizacion",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "En qué quedó cada una: «Se volvió pedido»; perdida, con su motivo; lo abierto, según lo que le falta (Negociando, Seguimiento atrasado, No contesta, Vigencia vencida, Esperando respuesta); lo que nunca salió (Borrador, Por autorizar, Autorizada sin enviar, Cancelada sin enviar); o «Se cerró con otra cotización», cuando la venta se ganó con otra."
 },
 {
  "clave": "comparacionCopia",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Así quedó la copia contra el equipo del que salió: la flecha dice si subió o bajó y cuánto. Este aviso solo sale justo después de duplicar."
 },
 {
  "clave": "compararPeriodoUsoErp",
  "modulos": [
   "admin"
  ],
  "texto": "Prendido, las gráficas también muestran el periodo anterior del mismo largo: la línea punteada y las barras grises. Los indicadores siempre comparan."
 },
 {
  "clave": "comparativoPersonaUsoErp",
  "modulos": [
   "admin"
  ],
  "texto": "Cada persona contra sí misma: la barra de color es este periodo y la gris, el anterior. Salen hasta 14, de más a menos; quien no tuvo nada en ninguno de los dos no sale."
 },
 {
  "clave": "complementoPago",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "El XML que timbramos cuando un cliente a crédito (factura PPD) nos paga. Dice qué facturas paga y cuánto de cada una; al subirlo, cada pago se registra como cobro en el pedido de su factura. Si la factura no está registrada en el ERP, se avisa y no se registra."
 },
 {
  "clave": "compradoDoceMeses",
  "modulos": [
   "compras"
  ],
  "texto": "Lo que se le compró en los últimos 12 meses, en pesos y con IVA: sus facturas (las de la hoja y las registradas en el ERP, sin las repetidas) más sus órdenes de compra no canceladas que todavía no tienen su factura registrada. Solo proveedores: la nómina, los impuestos y los préstamos no son compras y van en finanzas. Una orden con su factura cuenta por la factura, así que nada se cuenta dos veces."
 },
 {
  "clave": "compraRepetidaHoja",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "La misma factura capturada dos veces en la hoja (mismo proveedor y monto, a una semana o menos, con el mismo folio o sin folio en una). Si la otra ya se pagó, esta parece deuda pero no lo es. No se paga: se marca con «Estaba repetida» y deja de contar en el saldo. En los movimientos queda tachada; la flecha la regresa."
 },
 {
  "clave": "compras12m",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Suma sin IVA, en pesos, de los pedidos no cancelados del cliente en los últimos 365 días."
 },
 {
  "clave": "comprasAnterioresErp",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Lo que el cliente compró y pagó según el libro de ventas de la hoja, antes del ERP. Solo lo ven el dueño, la gerencia y cobranza."
 },
 {
  "clave": "comprasEnCaminoInicio",
  "modulos": [],
  "texto": "Órdenes de compra ya enviadas al proveedor o recibidas en parte: lo que está por llegar. «Atrasadas» son las que ya pasaron su fecha de entrega: llámale al proveedor o mueve la fecha."
 },
 {
  "clave": "comprasQueLleganSemana",
  "modulos": [],
  "texto": "Órdenes de compra enviadas o recibidas en parte con fecha de entrega de lunes a domingo de esta semana. «Atrasadas» son las que ya pasaron su fecha sin llegar completas; también dice cuántos ajustes de inventario esperan autorización."
 },
 {
  "clave": "comprasTresAnios",
  "modulos": [
   "analisis"
  ],
  "texto": "Cuántas compras distintas (facturas o pedidos) hizo en los 3 años antes del último día del periodo."
 },
 {
  "clave": "comprobantePagoImportacion",
  "modulos": [
   "importaciones"
  ],
  "texto": "El comprobante del banco (o de EBANX) de un pago que ya salió. El agente aduanal lo pide para demostrar el tipo de cambio; mientras falte, sale un aviso."
 },
 {
  "clave": "concentracionTop3",
  "modulos": [
   "analisis"
  ],
  "texto": "Qué parte de la venta juntan los 3 estados (o municipios) que más vendieron. Muy alto quiere decir que dependes de pocos lugares."
 },
 {
  "clave": "conceptoCostoServicio",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "De qué es el gasto: viáticos (en un servicio con cliente: hospedaje, comidas, gasolina, pasajes), servicio externo (un taller de fuera), mano de obra (un técnico externo) u otro."
 },
 {
  "clave": "conceptoEntraComoGasto",
  "modulos": [
   "importaciones"
  ],
  "texto": "Marca los conceptos de la cuenta de gastos que entran como gasto del costeo. Los impuestos y el anticipo no se pueden marcar: los impuestos ya vienen en el pedimento y el anticipo no es gasto."
 },
 {
  "clave": "condicionesCotizacion",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Forma de pago, tiempo de entrega y notas: salen al pie de la cotización. Vienen llenas con lo que dejó la gerencia por defecto; puedes elegir otra opción del catálogo o escribir la tuya."
 },
 {
  "clave": "conDiferenciaConteo",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Lo contado menos lo que decía el sistema al capturarlo: en verde sobra, en rojo falta. Al cerrar el conteo, cada artículo con diferencia se vuelve un ajuste por autorizar."
 },
 {
  "clave": "conexionML",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Con la cuenta de Mercado Libre conectada (y las ventas prendidas), cada venta pagada desde ese momento entra sola como pedido (a nombre de la persona elegida para las ventas de ML) y se pide su envío: si es Full sale de la bodega de Mercado Libre; si no, se surte en planta con la guía de Mercado Envíos. Una cancelación en ML cancela el pedido; los reclamos y devoluciones se abren solos con su hora límite, y las preguntas llegan con aviso."
 },
 {
  "clave": "confiabilidadCosto",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Lo que puede hacer que el costo esté mal: piezas sin costo (cuentan como $0) y costos de hace más de 6 meses. Corrígelos y el precio se recalcula solo."
 },
 {
  "clave": "confirmarIntentoCliente",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Anota el intento (quién, cuándo y por dónde) y el cliente pasa a «En seguimiento» con el siguiente paso. Si fue un error, «Deshacer» en el aviso lo quita: un intento tuyo se deshace en los primeros 15 minutos."
 },
 {
  "clave": "consejoExperimento",
  "modulos": [],
  "texto": "Una prueba que haces tú durante unas semanas, con la forma de ver en el ERP si funcionó. Por ejemplo: llamar el primer día a la mitad de tus cotizaciones nuevas y comparar cuántas cierran de cada mitad."
 },
 {
  "clave": "consejoSemana",
  "modulos": [],
  "texto": "Cada lunes en la madrugada la IA le escribe a cada persona hasta tres consejos con sus propios números de las últimas semanas: cómo usa el ERP (por ejemplo, si captura todo de golpe en la tarde, como en la hoja) y, a quien vende, qué podría probar para cerrar más. Solo los ves tú; dirección puede ver todos para cuidar lo que se dice. No menciona costos ni compara con compañeros."
 },
 {
  "clave": "consultasIaErp",
  "modulos": [
   "admin"
  ],
  "texto": "Cuántas veces la IA trabajó para la persona: preguntas al asistente, resúmenes, mensajes que redactó, documentos que leyó… Las que fallaron no cuentan, y la revisión nocturna va aparte porque no es de nadie."
 },
 {
  "clave": "consumibleTaller",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Lo que se gasta trabajando y no se queda en el equipo: discos, lijas, soldadura, EPP y lo demás de las categorías marcadas en Configuración → Almacenes. Con «Consumibles del taller» encendido sale a nombre de quien lo recibe, no a la orden: en la orden se ve como «Del taller» y no cuenta como faltante, no se aparta ni se pide a compras por orden (lo cubre el reabasto)."
 },
 {
  "clave": "consumo12Meses",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Lo que salió cada mes del último año (salidas a producción, ventas y consumo). Las seis barras de color son los meses que cuenta la regla; las grises, los anteriores."
 },
 {
  "clave": "consumoMensualAlmacen",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Lo que salió del almacén cada mes (a producción, ventas y consumo del taller), de la hoja y del ERP. Con permiso de costos es el valor al costo de hoy; sin costos, cuántos artículos distintos tuvieron salida."
 },
 {
  "clave": "consumoTaller",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Lo que salió de los consumibles del taller en el periodo: renglones y a cuántas personas. «Sin anotar» son salidas a consumo que no dicen quién lo recibió."
 },
 {
  "clave": "consumoVsReceta",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Lo que salió de cada consumible en el periodo contra lo que prevén las recetas de las órdenes que se terminaron en ese mismo periodo. Arriba de la receta es más de 20 % sobre lo previsto. Lo que no viene en ninguna receta (como el EPP) solo se ve por persona."
 },
 {
  "clave": "contactoParaLlamar",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Abre el chat, el correo o marca el número. Al volver, la tarjeta te pregunta si sí le escribiste o le llamaste: un toque lo anota y el cliente pasa a «En seguimiento», para que nadie del equipo le vuelva a escribir sin saber."
 },
 {
  "clave": "contactoPrincipal",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "El contacto que sale en las cotizaciones de este cliente. Hay uno solo: si marcas otro como principal, este deja de serlo."
 },
 {
  "clave": "contactosCliente",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Las personas con quien tratas en este cliente: teléfono, WhatsApp, correo y domicilio. Los ven su vendedor, la gerencia y cobranza (si el cliente es libre, cualquiera); si es de otro vendedor, te salen bloqueados."
 },
 {
  "clave": "contactosPrivadosCotizacion",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Este cliente es de la cartera de otro vendedor: sus contactos solo los ven él y la gerencia. Si la regla de cartera está prendida y su cuenta sigue vigente, no te deja ligarlo a tu cotización: pide a la gerencia que lo reasigne o que compartan el crédito."
 },
 {
  "clave": "contadosConteo",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Cuántos artículos de la lista ya capturaste. La lista trae lo que el sistema dice que hay en este almacén más lo que agregaste; lo que no captures no se ajusta al cerrar."
 },
 {
  "clave": "conteoFisico",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Contar lo que hay en un almacén, artículo por artículo. Al cerrar el conteo, cada diferencia se vuelve un ajuste por autorizar; lo que no se contó no se ajusta. La diferencia se mide contra lo que decía el sistema cuando capturaste cada artículo: captúralo en cuanto lo cuentes, y antes de empezar registra las salidas que tengas pendientes."
 },
 {
  "clave": "contestarSolicitud",
  "modulos": [
   "compras"
  ],
  "texto": "Contestar es capturar el costo que dio el proveedor: entra al catálogo con su historial, el precio de lista se recalcula solo y el vendedor lo ve en su cotización. Pide costo y días de entrega; la nota para el vendedor nunca lleva costos."
 },
 {
  "clave": "contraRecetaPorcentaje",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Lo que salió entre lo que prevén las recetas. En rojo, más de 120 % (se gastó de más); en verde, de 80 a 120 %; en gris, menos de 80 %."
 },
 {
  "clave": "contribucionesPedimento",
  "modulos": [
   "importaciones"
  ],
  "texto": "IGI es el arancel; DTA, el derecho de trámite aduanero; PRV, la prevalidación. Son costo y entran al costeo repartidos por valor. El IVA del pedimento va aparte porque se acredita."
 },
 {
  "clave": "conversionML",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "De cada 100 visitas, cuántas terminaron en venta (ventas de 30 días entre visitas de 30 días). Una publicación con muchas visitas y poca conversión suele pedir mejores fotos, otra descripción o revisar el precio."
 },
 {
  "clave": "convertirCotizacionPedido",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Crea el pedido con los precios, descuentos y condiciones de esta cotización: eliges qué partidas entran y la fecha compromiso. La cotización queda Aceptada, su oportunidad Ganada y su seguimiento se cierra. Producción y cobranza lo ven al momento."
 },
 {
  "clave": "convertirEnSubensamble",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Las líneas marcadas pasan a un subensamble nuevo y aquí quedan como una sola línea de 1 pieza. Solo se reorganiza: lo que lleva el equipo no cambia. Antes de crearlo te avisa si esas piezas ya son un subensamble, para que uses ése."
 },
 {
  "clave": "convertirLead",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Un lead se vuelve oportunidad cuando ya te contestó: primero anotas en «Intentos de contacto» que contestó y qué te dijo, y entonces se habilita «Crear oportunidad». Si ya era cliente va a su cuenta; si no, eliges la empresa si ya existe o se da de alta como cliente nuevo con este contacto. Si su teléfono o correo ya es de otro cliente, no deja darlo de alta otra vez: te dice cuál es para que lo elijas. La oportunidad nace en Contactado, a tu nombre, con lo que te dijo, y quien registró el lead ve en qué etapa va."
 },
 {
  "clave": "convertirMonedaCotizacion",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Cambiar la moneda o el tipo de cambio convierte el precio de todas las partidas para que, en pesos, la cotización valga lo mismo. En dólares toma el tipo de cambio más reciente; puedes escribir otro y aplicarlo con Enter. Ya enviada no se cambia: saca una nueva versión."
 },
 {
  "clave": "correccionUbicacion",
  "modulos": [
   "analisis"
  ],
  "texto": "Corregir una combinación de estado y ciudad escritos ubica a todos los clientes que la escribieron igual, también a los que se den de alta después. Se puede deshacer en «Corregidas por dirección»."
 },
 {
  "clave": "corregirFactura",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Con el lápiz corriges una factura que ya registraste: le pones el UUID que le faltaba o arreglas folio, fecha o total. Si se registró por error, desde ahí la quitas. Una factura se registra una sola vez: si el folio o el UUID ya están en otra, el sistema no la deja entrar y te dice en qué pedido está, para que corrijas esa."
 },
 {
  "clave": "correosEmbarque",
  "modulos": [
   "importaciones"
  ],
  "texto": "Los correos de los hilos de Gmail ligados a este embarque, guardados en el ERP sin lo citado de correos anteriores. Traen montos: solo los ve quien ve el dinero de importaciones."
 },
 {
  "clave": "costeoPorPartida",
  "modulos": [
   "importaciones"
  ],
  "texto": "El costo de cada partida: su valor en pesos, los gastos que le tocaron y el costo unitario sin IVA. «Antes» es el costo que tenía en el catálogo al calcular; la flecha dice cuánto sube o baja."
 },
 {
  "clave": "costoArticulo",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Lo que nos cuesta. En lo que se compra, el último costo capturado (si está en dólares o euros, convertido a pesos con el tipo de cambio del costeo). En lo que se fabrica, el material de su lista más la mano de obra de sus horas."
 },
 {
  "clave": "costoContraVigente",
  "modulos": [
   "compras"
  ],
  "texto": "Cuánto difiere el costo de esta partida del costo vigente del artículo. Rojo: más de 10 % arriba; amarillo: arriba; verde: abajo."
 },
 {
  "clave": "costoDeOtroProveedor",
  "modulos": [
   "compras"
  ],
  "texto": "Este proveedor es el de siempre del artículo, pero el último costo capturado se le compró a otro: el costo de hoy viene de aquel."
 },
 {
  "clave": "costoDesperdicio",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "La mano de obra de las etapas marcadas a la tarifa de su oficio: lo real (horas hombre marcadas) contra lo estimado (horas del costeo). La diferencia en rojo es lo que costó tardarse de más."
 },
 {
  "clave": "costoFabricacion",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Lo que cuesta hacer lo que se vende: el material de lo vendido, los sueldos de la gente de Producción y las compras del taller que no se quedan en el equipo (consumibles, gases, reparaciones)."
 },
 {
  "clave": "costoIa",
  "modulos": [
   "admin"
  ],
  "texto": "Lo que cuesta la IA, estimado con lo que lee y escribe cada consulta y los precios del proveedor que tiene guardados el ERP; en dólares, y en pesos al tipo de cambio del día. El total suma la revisión nocturna (va por lotes, a mitad de precio), que no es de nadie; cada persona, solo lo suyo. Es un estimado: lo que factura el proveedor es lo que manda."
 },
 {
  "clave": "costoMasViejo",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "La fecha del costo más antiguo entre las piezas del equipo. En la lista de equipos se marca en amarillo si pasa de un año: el costo del equipo ya no es el de hoy."
 },
 {
  "clave": "costoPuestoEnPlanta",
  "modulos": [
   "importaciones"
  ],
  "texto": "Lo que de verdad costó cada artículo ya en planta: su precio al tipo de cambio real de los pagos más los gastos e impuestos sin IVA, repartidos entre las partidas. El preliminar se calcula con el pedimento; el final, con la cuenta de gastos, y es el único que cambia el costo del catálogo al cerrarlo."
 },
 {
  "clave": "costoReparacionCriticidad",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Lo que se ha gastado en reparar esta máquina en los últimos 12 meses (refacciones, servicio externo, mano de obra), en escalones: casi nada, bajo, medio o alto. Suma hasta 3 puntos a la criticidad. Aquí no se ve el monto; quien ve costos lo ve en la ficha."
 },
 {
  "clave": "costosOrdenMto",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Lo que costó la reparación: servicio externo, mano de obra u otros que anota mantenimiento o la gerencia; las refacciones que entrega almacén se suman solas (solo las ve quien tiene permiso de costos). Todo suma al costo de reparación de los últimos 12 meses, uno de los factores de la criticidad."
 },
 {
  "clave": "costosQueSubieronTablero",
  "modulos": [],
  "texto": "Los artículos cuyo costo subió más de 3 % en los últimos 30 días, de mayor a menor alza: costo anterior → nuevo, cuánto subió y en cuántos equipos y subensambles se usa, que es donde pega el alza. Clic para abrir el artículo."
 },
 {
  "clave": "costosServicio",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Lo que costó de verdad el servicio: viáticos, servicio externo, mano de obra y otros que anota la gerencia. Las refacciones que entrega almacén se suman solas, y esas solo las ve quien tiene permiso de costos."
 },
 {
  "clave": "costoViejo",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Un costo capturado hace más de 6 meses. Ya no es confiable para cotizar: conviene confirmarlo con el proveedor."
 },
 {
  "clave": "costoVigente",
  "modulos": [
   "compras"
  ],
  "texto": "El costo con el que se calcula hoy: el último que se capturó, ya sea a mano, al contestar una solicitud de precio, desde la cotización de un proveedor o al recibir una orden de compra."
 },
 {
  "clave": "cotizacionAbierta",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Una cotización que sigue viva: en borrador, por autorizar, autorizada o enviada."
 },
 {
  "clave": "cotizacionesAceptadas",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Las que se convirtieron en pedido. Al abrir una, «Ver pedido» te lleva a su pedido."
 },
 {
  "clave": "cotizacionesEnviadas",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Las que ya tiene el cliente y siguen sin respuesta: ni pedido ni rechazo. Ya no se editan; para cambiar algo, saca una nueva versión."
 },
 {
  "clave": "cotizacionesSemana",
  "modulos": [],
  "texto": "Cotizaciones que se enviaron la semana pasada y cuántas se ganaron. “Sin respuesta” son las enviadas hace más de una semana que siguen en “Enviada”: nadie las aceptó ni rechazó. Es el seguimiento que se cae."
 },
 {
  "clave": "cotizacionesVivas",
  "modulos": [],
  "texto": "Cotizaciones abiertas (de borrador a enviada) que todavía no vencen. El monto es lo ya enviado y vigente, sin IVA. El cierre es qué parte de las cotizaciones de los últimos 90 días que ya se cerraron se ganó."
 },
 {
  "clave": "cotizadoVivo",
  "modulos": [],
  "texto": "Total con IVA, en pesos, de las cotizaciones enviadas o autorizadas que siguen vigentes: lo que está en la calle esperando respuesta. Abajo, el cierre de 90 días y las que esperan autorización de precio."
 },
 {
  "clave": "cotizarSkydropx",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Cotiza el envío con todas las paqueterías de Skydropx a la vez y genera la guía sin salir del ERP: el PDF, el número, el rastreo y el costo quedan en el envío y el costo se descuenta del saldo de Skydropx. La guía se cobra al generarla. Si Skydropx falla o es flete, registra la guía a mano como antes."
 },
 {
  "clave": "crearOrdenBorrador",
  "modulos": [
   "compras"
  ],
  "texto": "Crea la orden vacía con la moneda y las condiciones de pago del proveedor. Queda en borrador: ahí le agregas partidas y, cuando esté lista, la envías."
 },
 {
  "clave": "crearOrdenDesdeCotizacion",
  "modulos": [
   "compras"
  ],
  "texto": "Crea la orden en borrador con lo que revisaste: partidas, moneda, condiciones y fecha de entrega (con los días que escribiste o los del proveedor). Si marcaste las casillas, también recuerda las claves y pone al día los costos."
 },
 {
  "clave": "crecimientoMovil",
  "modulos": [
   "analisis"
  ],
  "texto": "Los 12 meses que terminan en cada mes contra los 12 anteriores. Azul creció, rojo cayó."
 },
 {
  "clave": "crecimientoVenta",
  "modulos": [
   "analisis"
  ],
  "texto": "Cambio de la venta contra el periodo anterior. Gris: casi igual (±5 %). «Nuevo»: antes no había venta ahí."
 },
 {
  "clave": "creditoCliente",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Los días de crédito del cliente. La fecha de pago es la primera factura (o el pedido) más esos días; sin crédito, es de contado."
 },
 {
  "clave": "creditoCompartido",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Cuando varios vendedores cierran una venta, la gerencia reparte el crédito en porcentajes que suman 100 %. A cada uno le cuenta para su comisión y sus metas solo su parte del pedido."
 },
 {
  "clave": "creditoProveedor",
  "modulos": [
   "compras"
  ],
  "texto": "Días que da el proveedor para pagar. El vencimiento de cada orden se fija al recibirla: fecha de recepción más estos días. Sin crédito, es de contado."
 },
 {
  "clave": "criterioRepartoGasto",
  "modulos": [
   "importaciones"
  ],
  "texto": "Cómo se reparte el gasto entre las partidas en el costeo. Por valor: cada partida carga según lo que vale. Por volumen (consolidado): según el volumen de cada orden y, dentro de ella, por valor; pide el volumen en la pestaña Órdenes."
 },
 {
  "clave": "criticidadMaquina",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Qué tanto importa la máquina, de muy alta a muy baja. Se calcula sola con seis factores: qué pasa si se para, su riesgo de seguridad, cuántas veces falló en el año, cuánto costó repararla, si hay otra con qué suplirla y cuánto tarda en llegar su refacción. Con 20 puntos o más (de 30) es muy alta, con 14 alta, con 8 media y con 4 baja; un riesgo grave, o parar el área sin respaldo, la deja en alta por lo menos. Mientras no se califiquen los dos primeros, se queda la de la hoja. Muy alta o alta cuenta como crítica: sus fallas van primero."
 },
 {
  "clave": "cuadrilla",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Las personas del taller que salen al servicio. Una persona no puede estar en dos servicios que se enciman, ni salir con vacaciones, permiso o incapacidad aprobados. La corona marca al jefe de cuadrilla."
 },
 {
  "clave": "cuadrillaEtapa",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Quiénes trabajan esta etapa ahorita. Se eligen al iniciarla o reanudarla (vienen marcados los que planeó la gerencia en Cuadrillas; si no planeó a nadie, la última cuadrilla de esa tablet); con «Se une» entra alguien más y con «Sale» se va, sin detener la etapa. Al pausar o terminar, salen todos. Una persona no puede estar en dos etapas a la vez. Si no sabes quién es (un ayudante de paso), súmalo en «Sin nombre»: cuenta igual en las horas hombre. Si la etapa ya estaba en proceso y nadie ha abierto su tiempo, abajo dice a quién le toca: dale «Se une» para que sus horas empiecen a contar."
 },
 {
  "clave": "cuadrillaPlaneada",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Quiénes van a trabajar esta etapa cuando arranque. La planea la gerencia de producción en Cuadrillas, arrastrando a la gente, y la terminal la trae marcada al iniciar. Si se inicia con otras personas, manda lo que se hizo: la cuadrilla queda como arrancó. Al pausar, la cuadrilla se queda para reanudar. Una persona puede estar planeada en varias etapas (es su fila de trabajo), pero trabajando solo en una."
 },
 {
  "clave": "cuelloBotellaTaller",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "El área con más semanas de trabajo liberado, cuando pasa de una semana. Es la que marca el paso del taller: lo que se adelante en las demás termina esperando aquí."
 },
 {
  "clave": "cuentaActiva",
  "modulos": [
   "admin"
  ],
  "texto": "Activa: puede entrar con sus roles. Desactivada: no ve ni hace nada, aunque tenga la sesión abierta; sus roles se guardan para cuando regrese. En rojo si RRHH ya lo dio de baja y su cuenta sigue abierta."
 },
 {
  "clave": "cuentaColumnaEtapa",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Lo que esta área tiene ahorita: trabajando, pausado y listo para empezar. No cuenta lo de «Más adelante»."
 },
 {
  "clave": "cuentaDinero",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "De dónde sale o a dónde entra el dinero: Santander fiscal, Banorte fiscal, no fiscal, Mercado Pago o caja chica. Las mismas cuentas de la hoja."
 },
 {
  "clave": "cuentaGastos",
  "modulos": [
   "importaciones"
  ],
  "texto": "La cuenta que manda el agente aduanal al final con todo lo que pagó por nosotros (maniobras, almacenaje, honorarios…) y el saldo a favor o en contra."
 },
 {
  "clave": "cuentaHojaSinLigar",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Una cuenta que viene de la hoja con un nombre que no está en el catálogo de proveedores. Sin proveedor no se le puede registrar pago. Elige cuál es y queda ligada; si el proveedor no existe, al darlo de alta con el mismo nombre se liga solo."
 },
 {
  "clave": "cuentaNomina",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "De qué cuenta salió el retiro de ahorro o a cuál entró el abono en efectivo. Finanzas lo ve en «Pagos hechos» (retiros, a nombre de «Caja de ahorro del personal») y en la cuenta de «Préstamos al personal» (abonos), y le llega un aviso. Si eliges caja chica, también entra a su libro para que el arqueo cuadre."
 },
 {
  "clave": "cuentaPantalla",
  "modulos": [
   "admin"
  ],
  "texto": "Cuenta con correo y contraseña para la TV del taller, con el rol Pantalla de piso: entra directo al tablero de piso y no ve nada más. El correo se arma solo con el nombre de la pantalla (sin acentos ni espacios, que un correo no admite) y no necesita ser un buzón real."
 },
 {
  "clave": "cuentaTerminal",
  "modulos": [
   "admin"
  ],
  "texto": "Cuenta con correo y contraseña para la tablet del taller, con el rol Terminal de piso: entra directo a la terminal y no ve nada más. Con ella se marca el avance de las etapas (iniciar, pausar, terminar, quién trabaja) y se reportan fallas de máquinas. Cada quien elige su nombre en la terminal, así que una cuenta basta para toda el área. No necesita cuenta de Google y el correo no tiene que ser un buzón real."
 },
 {
  "clave": "cumplimientoEquipo",
  "modulos": [],
  "texto": "Para dirección y Recursos Humanos: el cumplimiento de cada persona con sus pendientes (abiertos, vencidos, días de retraso, a cuántos detiene, a tiempo y días para cerrar), en 30, 90 o 180 días. Dale clic a una persona para ver lo que tiene abierto y lo que cerró en el periodo, con la respuesta que dejó y si fue a tiempo; clic en cualquiera abre su ficha con la conversación. Solo se ve: cerrar o cambiar sigue siendo de quien lo tiene y de quien lo pidió."
 },
 {
  "clave": "cumplimientoPreventivo",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "De los preventivos que vencían en el periodo, cuántos se hicieron en su fecha o antes. Un preventivo hecho tarde ya no previno igual. Los vencidos son los que pasaron su fecha y siguen abiertos."
 },
 {
  "clave": "cuotaFijaCanal",
  "modulos": [
   "admin"
  ],
  "texto": "Un cargo fijo por venta que se suma al precio del canal (antes de IVA) cuando el precio con IVA queda abajo del umbral. Arriba del umbral no se suma."
 },
 {
  "clave": "datoFaltante",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Lo que haría falta capturar en el ERP para que ese indicador se mida solo en vez de calificarlo a mano."
 },
 {
  "clave": "datosBancariosProveedor",
  "modulos": [
   "compras"
  ],
  "texto": "La cuenta donde se le paga. Si alguien la cambia, dirección recibe un aviso para revisarla antes del siguiente pago: un correo de «cambiamos de cuenta» es el engaño más común."
 },
 {
  "clave": "datosContestarML",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Lo que siempre aplica al contestar en Mercado Libre: si se factura, tiempos de envío, garantía, horario, medidas especiales. La IA lo toma como la verdad de la empresa al sugerir respuestas. Aquí también se guardan las respuestas rápidas."
 },
 {
  "clave": "datosFiscalesCliente",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Lo que va en la factura (razón social, RFC, régimen, CP fiscal y uso de CFDI) y lo comercial: giro, ubicación, días de crédito y por dónde llegó. Lo editan su vendedor y la gerencia (si es libre, cualquier vendedor); con la constancia de situación fiscal, lo fiscal se llena solo."
 },
 {
  "clave": "datosFiscalesEmpresa",
  "modulos": [
   "admin"
  ],
  "texto": "La razón social, el RFC y el domicilio fiscal salen en el encabezado de la cotización impresa y de la hoja de salida; el enlace de términos y condiciones, al pie de la cotización."
 },
 {
  "clave": "datosOrdenCompra",
  "modulos": [
   "compras"
  ],
  "texto": "Lo que va impreso para el proveedor. En borrador compras cambia proveedor, moneda, tipo de cambio e IVA; la fecha de entrega, las condiciones y las notas se pueden corregir después (la fecha, hasta que llegue todo)."
 },
 {
  "clave": "datosSensibles",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "CURP, RFC, NSS, salario, cuenta bancaria, domicilio, tipo de sangre, alergias, crédito Infonavit y si sus contratos están firmados. Solo los ven Recursos Humanos con nivel de administrar y dirección; cada cambio queda en la bitácora."
 },
 {
  "clave": "deDondeSaleCapacidad",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Automática: personas × horas de la semana del taller × aprovechamiento. A mano: el número lo puso la gerencia; al lado dice cuánto daría con su gente (en ámbar si difiere en 10 horas o más). Un área automática sin gente conserva su último número."
 },
 {
  "clave": "demandaMensual",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Cuánto se usa al mes. Se calcula solo si el artículo tuvo consumo en suficientes meses de los últimos seis, y es el promedio de los meses con consumo. Un importado con consumo de vez en cuando promedia el año."
 },
 {
  "clave": "demorasContenedor",
  "modulos": [
   "importaciones"
  ],
  "texto": "Días que la naviera presta el contenedor sin cobrar, desde el arribo hasta que se devuelve vacío (21 si no se captura otra cosa). Al pasarse se pagan demoras; 5 días antes sale un aviso."
 },
 {
  "clave": "dependeDelParametro",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Las líneas de la lista y las etapas de horas que usan este parámetro, con su cuenta. Mientras algo dependa de él no se puede eliminar."
 },
 {
  "clave": "desabasto",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "De los artículos que tienen punto de reorden, qué porcentaje está abajo de él. Entre más bajo, mejor: menos de 8 % es óptimo, de 8 a 17 % aceptable y más de 17 % deficiente."
 },
 {
  "clave": "descansosEmpresa",
  "modulos": [
   "admin"
  ],
  "texto": "Días que la empresa no trabaja aunque caigan en día laboral (12 de diciembre, Semana Santa…). Se descuentan igual que los feriados al contar vacaciones y permisos."
 },
 {
  "clave": "descansosTaller",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Lo que se descuenta del horario cada día. Si el descanso va por turnos (unos desayunan de 10:00 a 10:40 y otros de 10:20 a 11:00), se pone la ventana completa y cuánto dura: de lo que un tiempo abierto cubra de esa ventana, se descuenta la parte que dura el descanso."
 },
 {
  "clave": "descartarCotizacionLeida",
  "modulos": [
   "compras"
  ],
  "texto": "Descarta lo que leyó la IA y regresa a armar la orden a mano. No se había guardado nada."
 },
 {
  "clave": "descripcionFabricado",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Qué es el equipo o subensamble en palabras: para qué sirve y lo que conviene saber al armarlo. La captura ingeniería en «Editar datos». En un equipo, además, sale en la cotización debajo del nombre."
 },
 {
  "clave": "descripcionVenta",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Lo que se le cotizó al cliente en esa partida, tal como lo escribió el vendedor: medidas, calibres, motor, acabado. Sin precio. Es la referencia para fabricar lo que se vendió."
 },
 {
  "clave": "descuentoGeneral",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Porcentaje que se descuenta del subtotal de todas las partidas, además del descuento de cada una. Cuenta para el precio mínimo."
 },
 {
  "clave": "descuentoMaximoPolitica",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Lo más que un vendedor puede bajar del precio de lista sin pedir autorización."
 },
 {
  "clave": "descuentoPartidaCotizacion",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Descuento de esta partida, en porcentaje. Se aplica además del descuento general, y los dos cuentan para el precio mínimo."
 },
 {
  "clave": "descuentosNomina",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Lo que se le resta esta semana: conceptos de descuento capturados (herramienta dañada, etc.) y el abono de sus préstamos."
 },
 {
  "clave": "descuentoVsLista",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Cuánto abajo del precio de lista va lo cotizado del catálogo, sumando todos los descuentos (en pesos y sin IVA)."
 },
 {
  "clave": "deshacerCambiosHorario",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Regresa el horario a como está guardado, sin guardar nada."
 },
 {
  "clave": "deshacerMovimiento",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Si registraste mal una salida o un traspaso, tienes unos minutos para deshacerlo tú, con el motivo (15 de inicio; los fija dirección en Configuración y en 0 se apaga). No se borra nada: queda el movimiento contrario ligado al original, con quién, cuándo y por qué, y el consumo se compensa. Pasado ese tiempo, o si lo registró otra persona, se pide un ajuste y lo autoriza alguien más."
 },
 {
  "clave": "desperdicioLean",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Lo que la mejora quita, según los ocho desperdicios de lean: espera (gente o equipos parados), transporte (mover material de un lado a otro), movimiento de más (buscar, agacharse, dar vueltas), inventario de más, sobreproceso (hacer más de lo que el cliente necesita), sobreproducción (hacer antes o más de lo pedido), defectos y retrabajo, y talento no aprovechado."
 },
 {
  "clave": "devolucionAbierta",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Falta atenderla. Un reclamo se responde antes de su hora límite; una devolución la recibe almacén cuando llega; una cancelación se cierra con su resultado."
 },
 {
  "clave": "devolucionAlmacen",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Material que regresa al almacén: lo que sobró de una orden, lo que devolvió un cliente o una garantía."
 },
 {
  "clave": "devolucionCancelada",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Se canceló el registro con su motivo (se capturó dos veces, el comprador ya no la mandó…). No movió nada del inventario."
 },
 {
  "clave": "devolucionDanada",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Herramienta que regresó dañada o incompleta. Al recibirla así, la falla se reporta sola."
 },
 {
  "clave": "devolucionRecibida",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Ya llegó a almacén, con fotos de cómo venía. Falta decidir qué se hace: reingresa al inventario, es merma o se reclama a la paquetería."
 },
 {
  "clave": "devolucionRespondida",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Ya se le contestó al reclamo. Falta cerrarlo con su resultado cuando Mercado Libre o el cliente decidan."
 },
 {
  "clave": "devolucionResuelta",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Cerrada con su resultado: en una devolución, qué se hizo con lo que regresó; en un reclamo o una cancelación, si quedó a favor, en contra o sin efecto."
 },
 {
  "clave": "diaCalendario",
  "modulos": [],
  "texto": "Abre todo lo de ese día en un panel a la derecha, aunque en la casilla no quepa. Cada línea te lleva a la pantalla donde se atiende."
 },
 {
  "clave": "diaChecklist",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "El día que estás marcando; cámbialo con las flechas o con la fecha. No se marca un día que no ha llegado. Puedes corregir hasta una semana atrás; después, solo Recursos Humanos, y nunca en un mes ya calificado."
 },
 {
  "clave": "diaEspecialTaller",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Un día con otro horario: tiempo extra (un sábado de 8:00 a 14:00, salir a las 7 de la noche) o un día que no se trabaja. Manda sobre el horario de ese día, y también sobre un feriado si deciden trabajarlo. Cuenta en las horas hombre y en el plan. Si lo quitas después, las horas de ese día se vuelven a contar sin él."
 },
 {
  "clave": "diagnosticoMto",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Qué tiene la máquina y quién la repara (alguien del taller o un externo). Se escribe cuando ya se sabe qué tiene; el play de la terminal no lo pide."
 },
 {
  "clave": "diaHabilPreventivo",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Si la fecha del preventivo cae en sábado, domingo, feriado de ley o un descanso de la empresa, pasa al siguiente día que el taller trabaja (según el horario que pone la gerencia de producción). En los planes por mes, si ese día ya es del mes siguiente, se adelanta al último día hábil del mes, para que ningún mes se salte."
 },
 {
  "clave": "diasActivosErp",
  "modulos": [
   "admin"
  ],
  "texto": "Los días del periodo en que la persona hizo algo en el ERP: abrió una pantalla, registró un cambio o le preguntó a la IA."
 },
 {
  "clave": "diasAtraso",
  "modulos": [
   "analisis"
  ],
  "texto": "En promedio, cuántos días después de lo prometido se entregaron los que llegaron tarde (los vencidos sin entregar cuentan hasta hoy)."
 },
 {
  "clave": "diasCredito",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Cuántos días da el proveedor para pagar. Deciden cuándo vence cada factura, también las que vienen de la hoja: si lo cambias, todas sus fechas se recorren."
 },
 {
  "clave": "diasCreditoCliente",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Cuántos días tiene el cliente para pagar. En cobranza, su pago vence esos días después de la primera factura (o del pedido, si no se ha facturado). En 0 es de contado."
 },
 {
  "clave": "diasEnEtapa",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Días que lleva la oportunidad en su etapa actual; vuelve a cero cuando cambia de etapa. En el tablero, más de 14 días se pinta en ámbar: está atorada."
 },
 {
  "clave": "diasEntrega",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Días hábiles que tarda el proveedor en entregar. Si ya hay historia, son los reales del proveedor; si no, los capturados o el estándar."
 },
 {
  "clave": "diasFabricacion",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Días hábiles (lunes a viernes) que tarda el equipo cuando el taller está libre. Vienen de la tabla de tiempos de entrega de producción; en elevadores y bazucas se ajustan por metro como en la tabla. Ventas los usa para prometer la fecha, junto con la fila del taller."
 },
 {
  "clave": "diasHabiles",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Los días que sí se trabajan según la semana laboral de Configuración, sin los descansos de la empresa ni los feriados de ley. Así se cuentan vacaciones y permisos."
 },
 {
  "clave": "diasLibres",
  "modulos": [
   "importaciones"
  ],
  "texto": "Días que el puerto deja la mercancía sin cobrar almacenaje (7 si no se captura otra cosa). La barra se pone ámbar cuando faltan 3 días o menos y roja cuando se acaban: lo que pase de ahí se paga."
 },
 {
  "clave": "diasPagados",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "De los 7 días de la semana, cuántos se le pagan. Restan las faltas, los permisos sin goce, la incapacidad, los días antes de entrar o después de la baja y el tiempo de retardo. Vacaciones y permisos con goce sí se pagan."
 },
 {
  "clave": "diasPorAprobar",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Días de vacaciones que ya pidió y que nadie ha aprobado. Todavía no se restan del saldo."
 },
 {
  "clave": "diasPorLey",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Días de vacaciones que da la Ley Federal del Trabajo por los años cumplidos: 12 al primer año, 2 más por año hasta 20 a los 5 años, y después 2 más cada 5 años."
 },
 {
  "clave": "diasRefaccion",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Cuántos días tarda en llegar la refacción más lenta. Si no lo escribes, sale de las refacciones de su tipo de máquina (el tiempo de entrega del artículo o de su proveedor; si es importada y no tiene dato, 60 días). Hasta 2 días no suma; más de 30 suma lo más (3 puntos)."
 },
 {
  "clave": "diasSinGoce",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Días que no se pagan esta semana: faltas, permisos sin goce e incapacidades (la incapacidad la paga el IMSS)."
 },
 {
  "clave": "diasTomados",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Días usados del periodo que corre (el de su último aniversario), incluidos los que adelantó antes de que empezara y los que ya había tomado según el control de vacaciones."
 },
 {
  "clave": "diasVigentesVacaciones",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Lo que le queda hoy de sus periodos que no han vencido, sin restar lo que adelantó. Cada vacación aprobada sale primero del periodo más viejo."
 },
 {
  "clave": "diferenciaAjusteInventario",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Lo contado menos lo que decía el sistema: en verde sobraba, en rojo faltaba. En los aprobados es lo que de verdad se aplicó. Abajo, sistema → contado."
 },
 {
  "clave": "diferenciaPromesa",
  "modulos": [
   "analisis"
  ],
  "texto": "Días entre la fecha a la que sale y la prometida. En rojo, cuántos días tarde llegaría; en verde, cuántos le sobran."
 },
 {
  "clave": "dineroML",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Lo que pasó con el dinero de una venta de Mercado Libre, tal cual lo da Mercado Pago: lo que pagó el comprador, lo que se quedó Mercado Libre (su comisión y el envío que pagamos nosotros), las retenciones de impuestos y lo que llega a la cuenta de Mercado Pago, con la fecha en que queda disponible. El cobro del pedido entra solo, por Mercado Pago, en cuanto el pago se aprueba; si Mercado Libre le regresa el dinero al comprador, entra el reembolso en negativo."
 },
 {
  "clave": "disponibilidadMaquina",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Qué parte del periodo la máquina estuvo lista para trabajar: 1 menos las horas que estuvo fuera de servicio entre las horas del periodo, todo en horas laborales del taller (sin noches, fines de semana, feriados ni descansos). Verde arriba de 98 %, ámbar arriba de 95 %, rojo abajo. «Críticas» es lo mismo solo de las máquinas de criticidad alta o muy alta. Una máquina dada de baja cuenta solo hasta el día de su baja."
 },
 {
  "clave": "disponibilidadSemanal",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "La disponibilidad de todas las máquinas juntas cada semana, en horas laborales del taller (1 − horas paradas ÷ horas que debieron estar listas). La línea verde punteada es la meta del 98 %; lo sombreado debajo es zona de aviso. Abajo, en las mismas semanas, las fallas reportadas y los preventivos que vencían esa semana: a tiempo o tarde. Las semanas antes de que se empezara a registrar mantenimiento no salen."
 },
 {
  "clave": "disponible",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "En planta menos lo apartado: lo que de verdad se puede usar o vender hoy. En rojo quiere decir que hay más apartado que existencia."
 },
 {
  "clave": "disponiblePlanta",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Lo que hay en planta sin apartar para ninguna orden ni pedido: lo que todavía se puede tomar."
 },
 {
  "clave": "disponibleReabasto",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Para decidir si pedir: en planta menos apartado más lo que ya viene en tránsito. Así no se vuelve a pedir lo que ya está en camino."
 },
 {
  "clave": "documentoConPrecios",
  "modulos": [
   "importaciones"
  ],
  "texto": "Este documento trae precios o montos: solo lo abre quien ve el dinero de importaciones. Tú ves que llegó, pero no puedes abrirlo."
 },
 {
  "clave": "documentosAntesArribo",
  "modulos": [
   "importaciones"
  ],
  "texto": "Los que el agente aduanal necesita antes de que la mercancía llegue (factura, packing list, BL…). Si faltan a pocos días del arribo, salen como riesgo."
 },
 {
  "clave": "documentosMaquina",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "El manual, la ficha técnica, los diagramas o la garantía de la máquina: un archivo (PDF o foto, hasta 50 MB) o una liga de Drive. Puede ser solo de esta máquina o de todas las de su tipo y modelo, para no subir el mismo manual a cada inversora. Los ve todo el que ve mantenimiento; los agrega o quita el encargado."
 },
 {
  "clave": "documentosPendientesEmbarque",
  "modulos": [
   "importaciones"
  ],
  "texto": "Documentos de la lista de este embarque que todavía no llegan o llegaron con observaciones. Se pone ámbar si va en el mar o en puerto y falta alguno de los que el agente pide antes del arribo."
 },
 {
  "clave": "dondeVendemosInicio",
  "modulos": [
   "analisis"
  ],
  "texto": "La venta de este año por estado, con IVA; el tono dice cuánto (gris: sin venta). Abajo, los 3 estados que más venden y su parte del total. Clic en el mapa para abrir el análisis."
 },
 {
  "clave": "duplicarConParametros",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Hace una copia del equipo con su lista, horas y parámetros, para otra medida. Los subensambles no se copian: la copia usa los mismos. Al terminar se abre la copia y arriba ves cómo cambió contra el original."
 },
 {
  "clave": "duracionServicio",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Cuánto dura, en días o en horas. En días, termina a la hora de salida del taller del último día; en horas, cuenta seguidas desde que sale."
 },
 {
  "clave": "editarProveedor",
  "modulos": [
   "compras"
  ],
  "texto": "Cambia sus datos. Compras edita todo; finanzas y la gerencia administrativa, lo fiscal, lo bancario, el crédito y el contacto. Cada cambio queda registrado, y si cambian los datos bancarios dirección recibe un aviso."
 },
 {
  "clave": "eficienciaFlujo",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Del tiempo que las órdenes pasaron en el taller (de liberada a terminada), qué parte había alguien trabajándolas según la terminal. Lo demás es espera: material, cola, otra etapa ocupada. En talleres como el nuestro suele salir bajo (10 a 25 %); subirlo es reducir esperas, no trabajar más rápido."
 },
 {
  "clave": "eir",
  "modulos": [
   "importaciones"
  ],
  "texto": "El comprobante de que el contenedor vacío se devolvió a la naviera. Sin él no se recupera la garantía."
 },
 {
  "clave": "eliminarBorradorOrden",
  "modulos": [
   "compras"
  ],
  "texto": "Borra el borrador completo (te pide confirmar). Lo que venía de requisiciones regresa a pendiente. Una orden ya enviada no se borra: se cancela."
 },
 {
  "clave": "embarque",
  "modulos": [
   "importaciones"
  ],
  "texto": "Un viaje de mercancía importada: puede traer una o varias órdenes de compra (un consolidado junta varios proveedores). Lleva sus fechas reales por etapa, sus documentos y su dinero."
 },
 {
  "clave": "embarquesEnCamino",
  "modulos": [
   "importaciones"
  ],
  "texto": "Embarques en el mar o en puerto. En ámbar si alguno llega a planta en los próximos 7 días; abiertos son todos los que no se han cerrado ni cancelado, incluidos los que siguen en producción con el proveedor."
 },
 {
  "clave": "embarquesEnCurso",
  "modulos": [
   "importaciones"
  ],
  "texto": "Los embarques abiertos: todos los que no se han cerrado ni cancelado, desde que se cotizan con el proveedor hasta que se cierran sus cuentas. Abajo dice cuántos van en el mar y cuántos en puerto."
 },
 {
  "clave": "embudo",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Las oportunidades abiertas por etapa: prospecto → contactado → cotizado → negociación. Al enviar una cotización, su oportunidad pasa sola a “cotizado” (y si no había, se abre); al convertirla en pedido, a “ganada”."
 },
 {
  "clave": "empaqueSkydropx",
  "modulos": [
   "admin"
  ],
  "texto": "La clave del SAT del tipo de empaque que se declara en cada paquete de la guía. Si no se elige otra, va 4G (caja de cartón)."
 },
 {
  "clave": "emparejadoCotizacion",
  "modulos": [
   "compras"
  ],
  "texto": "Cómo se encontró el artículo del catálogo. «Ya la conocemos»: esa clave del proveedor ya se usó con este artículo. «Por su clave»: la clave es la del catálogo o viene en el nombre. «Sugerido: revísalo»: por el parecido del nombre; confirma que sea el mismo."
 },
 {
  "clave": "enCuadrillas",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Si la persona trabaja en el piso y se le puede asignar trabajo: solo quien entra a cuadrillas sale en la terminal para iniciar etapas y en el tablero de Cuadrillas. Solo puede entrar gente del departamento Producción. Quien da de alta en Producción con su área entra de una vez; la gerencia de producción lo quita o lo pone (un coordinador o un ayudante de almacén quizá no) y Recursos Humanos también, desde su ficha."
 },
 {
  "clave": "enJuego",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Lo que vale buscarlo, más o menos: lo cotizado si tiene una cotización por vencer; lo que suele gastar por compra si ya le toca o hay que reactivarlo; en refacciones, el 5 % del equipo que compró (entre $10 mil y $150 mil)."
 },
 {
  "clave": "enPlanta",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Lo que hay en todos los almacenes de la planta (Planta Baja, Mallado, Planta Alta, contenedores, Revolución). No incluye lo que está en el Full de Mercado Libre."
 },
 {
  "clave": "enSeguimiento",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Clientes a los que alguien del equipo ya les escribió o llamó y falta su respuesta. Cada uno dice quién, cuándo, por dónde y qué sigue: llamar al día 3, último mensaje al día 10, luego esperar una semana. Lo ven todos los que venden."
 },
 {
  "clave": "entradaCompraAlmacen",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Material que llegó de una orden de compra. Entra cuando almacén recibe la orden y captura lo que llegó y a qué almacén; en la referencia va el folio de la orden."
 },
 {
  "clave": "enTransito",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Lo que viene en órdenes de compra ya enviadas al proveedor y que todavía no llega. En lo importado se ve en qué tramo va (con el proveedor, en el mar o en puerto) y cuándo llega a planta."
 },
 {
  "clave": "entraSaleTaller",
  "modulos": [
   "analisis"
  ],
  "texto": "Entra: el trabajo de las órdenes nuevas del mes. Sale: lo que el taller marcó terminado. Si entra más de lo que sale, la fila crece y las fechas se alargan para todos."
 },
 {
  "clave": "entregaArticuloFicha",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Días hábiles que tarda en salir según el catálogo o, si el artículo no lo tiene, lo que tarda su proveedor. En un equipo sin dato dice «Según taller»: la fecha realista sale bajo «Tiempo de entrega»."
 },
 {
  "clave": "entregadoAntesDelErp",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Material que almacén ya le había entregado a una orden con la hoja de salidas, antes de usar el ERP. Al registrarlo con «Ya se había entregado con la hoja» cuenta como surtido y deja de salir pendiente, pero no se descuenta del inventario, porque el inventario que se cargó en el ERP ya venía sin eso. Solo se puede en las órdenes que ya existían antes de arrancar; las nuevas se surten normal."
 },
 {
  "clave": "entregaParcial",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Entregar solo una parte del pedido: en «Entregar» escribes cuánto sale de cada partida y lo demás queda por entregar. Cada entrega tiene su hoja de salida, quién recibió y su hoja firmada, y descuenta del inventario lo que salió (lo que ya había salido a mano o con un envío no se descuenta otra vez). El pedido queda entregado cuando ya no falta nada."
 },
 {
  "clave": "entregaProveedor",
  "modulos": [
   "compras"
  ],
  "texto": "Días hábiles que tarda en entregar desde que se le manda la orden; sin dato se usa 7. Con esto se calcula la fecha de entrega de sus órdenes (en las que salen de requisiciones cuenta primero el tiempo de entrega de cada artículo, y la orden toma el más largo)."
 },
 {
  "clave": "entregaRealista",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Cuándo sale de verdad lo que vas a vender: lo que tarda el equipo, o lo que tarda el taller en acabar todo lo que ya tiene antes que este pedido, lo que sea más tarde. Cambia todos los días con lo que entra y sale del taller. Si prometes menos, el pedido nace atrasado."
 },
 {
  "clave": "entregasATiempo",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "De las órdenes que se terminaron en el periodo y tenían fecha compromiso, cuántas se terminaron ese día o antes. Abajo, lo mismo para los pedidos entregados (fecha de entrega contra compromiso). En lean es el OTD: lo primero que ve el cliente."
 },
 {
  "clave": "entregaSolicitudPrecio",
  "modulos": [
   "compras"
  ],
  "texto": "Días hábiles que tarda en llegar. Es obligatorio, porque es lo primero que pregunta el cliente. Se guarda en el artículo, así que la ficha de venta también lo muestra."
 },
 {
  "clave": "entregasPorFamilia",
  "modulos": [
   "analisis"
  ],
  "texto": "Lo mismo con las órdenes de producción: qué parte de las que tenían compromiso en el periodo se terminó a tiempo, por familia de equipo. Una orden abierta solo cuenta cuando ya venció."
 },
 {
  "clave": "entregasPorVendedor",
  "modulos": [
   "analisis"
  ],
  "texto": "Qué parte de los pedidos de cada vendedor con compromiso en el periodo se entregó a tiempo. Después del porcentaje: cuántos se juzgaron y, si hubo tarde, el atraso promedio en días."
 },
 {
  "clave": "enviarOrdenCompra",
  "modulos": [
   "compras"
  ],
  "texto": "Fija la orden: deja de ser borrador, lo pedido cuenta como en camino para almacén y, si no tenía fecha de entrega, se calcula con los días del proveedor. No le manda nada al proveedor: imprímela o usa «Por correo». No se envía si alguna partida está en $0."
 },
 {
  "clave": "envioCanal",
  "modulos": [
   "admin"
  ],
  "texto": "Lo que se suma al precio del canal (antes de IVA) cuando se publica con envío incluido."
 },
 {
  "clave": "envioDevolucion",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "El envío del ERP con que salió esta venta (el último, si hubo varios), con su paquetería y su guía. De él sale la evidencia de abajo."
 },
 {
  "clave": "envioEnCamino",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Ya salió de planta y todavía no se marca como entregado."
 },
 {
  "clave": "envioEntregados",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Entregados y cancelados de los últimos 60 días, con su evidencia."
 },
 {
  "clave": "envioGratis",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Si la pieza alcanza el monto de envío gratis (con IVA) que fija la gerencia. Cuando no lo alcanza sola, dice desde cuántas piezas aplica. Algunos productos, como bandas y cangilones, nunca llevan envío gratis."
 },
 {
  "clave": "envioHoySale",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Lo que ya está empacado y con guía, listo para que pasen por él, y lo que tiene recolección para hoy o ya se pasó."
 },
 {
  "clave": "envioML",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Cómo va el envío en Mercado Libre: lista para enviar (ya hay guía), en camino, entregada. El envío del ERP lo sigue solo: con la guía de ML pasa a «guía lista», en camino descuenta el inventario aunque no se haya marcado aquí (y lo anota) y entregada deja el pedido entregado."
 },
 {
  "clave": "envioPorCotizar",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Envíos por paquetería o flete que todavía no tienen guía: hay que cotizarlos y registrar la guía."
 },
 {
  "clave": "envioPorEmpacar",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Envíos que almacén tiene que empacar con fotos, check list y, si es equipo, su número de serie."
 },
 {
  "clave": "enVivo",
  "modulos": [],
  "texto": "La pantalla se actualiza sola cuando alguien registra algo (un pedido, un cobro, un avance de taller). No hace falta recargar."
 },
 {
  "clave": "equipoFabricado",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Una máquina que fabricamos y vendemos completa: banda transportadora, cribadora, dosificadora, tolva, silo, elevador… Tiene su lista de materiales y sus horas por etapa, y sus subensambles se comparten con otros equipos."
 },
 {
  "clave": "equipoHistorico",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Equipo que viene del libro de seriales de la hoja (desde 2015): se puede buscar y dar servicio, pero no tiene orden de producción en el ERP. ERP = lo numeró el ERP."
 },
 {
  "clave": "equiposDeEspecialidad",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Los tipos de equipo que hace esta cuadrilla. Cada tipo es de una sola especialidad por área: si ya lo tiene otra, sale apagado con su nombre. «Modelos» es cuántos equipos del catálogo son de ese tipo."
 },
 {
  "clave": "equiposEnTallerSerie",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Equipos con número de serie que todavía no se entregan: en espera, en proceso o terminados en planta."
 },
 {
  "clave": "equipoServicio",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Los equipos que le hemos hecho a este cliente, con su número de serie y su pedido. En una garantía es obligatorio elegirlo: de ahí sale si sigue vigente. Si no es nuestro o no aparece, deja «Otro equipo» y escríbelo abajo."
 },
 {
  "clave": "equiposTerminados",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Órdenes de producción que se terminaron en el periodo. Es la salida del taller (throughput): cuánto produce de verdad por semana."
 },
 {
  "clave": "equiposTerminadosSemana",
  "modulos": [],
  "texto": "Órdenes de producción que se terminaron la semana pasada, contra la anterior. Abajo, cuántas están en proceso hoy y cuántas ya pasaron su fecha compromiso sin terminarse (las que están en espera no cuentan)."
 },
 {
  "clave": "escalaCuantiles",
  "modulos": [
   "analisis"
  ],
  "texto": "Cada tono junta un número parecido de regiones (o de celdas): así un estado muy grande no deja a los demás en el mismo color pálido. Gris: sin venta."
 },
 {
  "clave": "escalonesComision",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Cada renglón es un escalón: desde cuánto vendido en el mes, sin IVA, se gana ese bono fijo. Se paga solo el escalón más alto que se alcanzó, no la suma de todos."
 },
 {
  "clave": "escenarioMeta",
  "modulos": [
   "analisis"
  ],
  "texto": "Una meta de prueba: lo que cerró el año anterior más el porcentaje que escribas, redondeada a miles. No se guarda; mientras no haya meta capturada, las cifras, las gráficas y la meta por estado la usan para que veas cómo quedaría."
 },
 {
  "clave": "esDistribuidor",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Cliente que revende nuestros equipos. Se marca en sus datos comerciales y sale con esta etiqueta en la lista."
 },
 {
  "clave": "especialidad",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "La cuadrilla por tipo de equipo dentro de un área: en Pailería, por ejemplo, la de cribadoras y la de dosificadoras. Cada especialidad dice qué equipos hace y quién es de ella; quien no tiene especialidad hace de todo. El plan le da a cada especialidad la parte de las horas del área que es de su gente: una cribadora solo avanza con las horas de la cuadrilla de cribadoras y de quien hace de todo, y los equipos que no son de ninguna especialidad los hace cualquiera del área. Sirve para planear: no impide anotar a nadie en una etapa. La gerencia de producción las acomoda en «Personal de piso»."
 },
 {
  "clave": "esperaEtapa",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "En promedio, cuántas horas pasaron desde que la etapa pudo empezar (la orden se liberó y terminó la etapa anterior) hasta que empezó. Es la cola de esa área."
 },
 {
  "clave": "esperandoMaterial",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Órdenes abiertas con partidas de su lista todavía por surtir (sin contar los consumibles del taller). Las que ya están en proceso empezaron sin su material completo."
 },
 {
  "clave": "esperaRol",
  "modulos": [
   "admin"
  ],
  "texto": "Entró con su cuenta de Google de la empresa, pero todavía no tiene rol: ve un aviso para que pida acceso y no puede ver nada. Dale clic y márcale su rol."
 },
 {
  "clave": "estacionalidadVenta",
  "modulos": [
   "analisis"
  ],
  "texto": "Qué meses pesan más en la venta del año. La meta de cada mes se reparte con lo que pesó ese mes en los últimos 3 años completos."
 },
 {
  "clave": "estadoAjusteInventario",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Por autorizar: la existencia todavía no cambia. Aprobado: la diferencia ya se aplicó. Rechazado: no se movió nada; queda como constancia con el comentario de quien lo resolvió."
 },
 {
  "clave": "estadoConteoFisico",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Abierto: se sigue capturando y todavía no hay ajustes. Cerrado: ya no se captura y cada diferencia se volvió un ajuste por autorizar; en la lista de conteos dice cuántos salieron y cuántos faltan por autorizar."
 },
 {
  "clave": "estadoCotizacion",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Borrador (se está capturando) → Por autorizar (tiene precios abajo del mínimo) → Autorizada (la gerencia ya los aprobó) → Enviada (ya la tiene el cliente) → Aceptada (se convirtió en pedido). También puede quedar Rechazada (con motivo), Vencida o Cancelada."
 },
 {
  "clave": "estadoDevolucion",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Abierta → Respondido (reclamo) o Llegó: por decidir (devolución, ya en almacén) → Resuelta con su resultado. O Cancelada, con motivo."
 },
 {
  "clave": "estadoDocumentoImportacion",
  "modulos": [
   "importaciones"
  ],
  "texto": "Pendiente: todavía no llega. Recibido: ya está (subir el archivo lo marca solo). Con observaciones: llegó con algo que corregir y sigue contando como pendiente. Aceptado: revisado y bueno. No aplica: este embarque no lo necesita."
 },
 {
  "clave": "estadoEnvio",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "En qué paso va: Por cotizar, Cotizado, Guía lista, Empacado, En camino, Entregado o Cancelado. Lo que recoge el cliente o surte Full se salta los pasos de guía."
 },
 {
  "clave": "estadoEquipoSerie",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "En espera: su orden todavía no empieza en el taller. En proceso: alguna etapa ya empezó. Terminado: está hecho y falta entregarlo. Entregado: ya es del cliente. Los del libro de la hoja traen el estado que tenían ahí."
 },
 {
  "clave": "estadoIncidencia",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Por aprobar: la pidió alguien y espera a Recursos Humanos. Aprobada: cuenta en el saldo, en el calendario y en la prenómina. Rechazada: no cuenta; el motivo queda en el historial."
 },
 {
  "clave": "estadoInsumoServicio",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Por entregar: almacén ya tiene el aviso y no lo ha entregado. En compras: se pidió a compras con una requisición (dice su folio); almacén lo entrega cuando llegue. Entregado: ya salió de almacén con el folio, y dice quién y cuándo."
 },
 {
  "clave": "estadoLead",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Por tomar (o por asignar): nadie lo tiene todavía. Con…: ya tiene vendedor y está pendiente de que lo atienda. Oportunidad: el vendedor ya lo volvió oportunidad; junto sale en qué etapa va (cotizado, ganada, perdida…). Descartado: no se siguió, con su motivo. Si nadie lo toma o nadie lo atiende a tiempo, se avisa a la gerencia."
 },
 {
  "clave": "estadoMaquina",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Sale solo de sus órdenes de mantenimiento, no se captura. Operando: sin pendientes. Con falla: alguien reportó algo, pero sigue trabajando. Parada: la falla la detiene. En reparación: la están atendiendo con la máquina detenida."
 },
 {
  "clave": "estadoOrdenCompra",
  "modulos": [
   "compras"
  ],
  "texto": "Borrador: todavía se edita y el proveedor no la tiene. Enviada: ya se mandó y lo pedido cuenta como en camino. Recibida en parte: llegó algo y falta lo demás. Recibida: llegó todo. Cancelada: lo que venía de requisiciones regresa a pendiente."
 },
 {
  "clave": "estadoOrdenMto",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Sin atender: se reportó o se generó y nadie la ha tomado. En reparación: alguien ya escribió el diagnóstico o le dio play. Cerrada: se terminó y se anotó qué se hizo. Cancelada: no procedía, con su motivo."
 },
 {
  "clave": "estadoPagoImportacion",
  "modulos": [
   "importaciones"
  ],
  "texto": "Programado: tiene fecha pero no ha salido. Pagado: ya salió del banco. Retenido: el banco lo detuvo (sale como riesgo). Confirmado: el proveedor dijo que lo recibió; si a los 7 días de pagado no confirma, sale un aviso. Devuelto: regresó y ya no cuenta."
 },
 {
  "clave": "estadoPedido",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Confirmado → En producción → Listo para entregar → Entregado. Cancelado lleva su motivo y deja de contar para comisiones y cobranza."
 },
 {
  "clave": "estadoPendienteCerrado",
  "modulos": [],
  "texto": "Hecho (palomita verde): lo terminó quien lo tenía. Lo hizo otra persona (palomita clara): era «basta con que uno lo haga» y otro del grupo lo terminó primero. Cancelado (tache): ya no hacía falta."
 },
 {
  "clave": "estadoPersonal",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Activo si trabaja hoy. Si hoy tiene vacaciones, permiso, falta o incapacidad aprobada, dice cuál y hasta cuándo. «Baja» con su fecha si ya no trabaja aquí: su historial se conserva."
 },
 {
  "clave": "estadoPrestamo",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Cuántas semanas le faltan con su descuento semanal. Liquidado: ya no debe nada. Cancelado: ya no se descuenta; lo descontado se queda en el historial."
 },
 {
  "clave": "estadoReabasto",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Negativo: la existencia en planta es menor que cero (se revisa antes que lo demás). Ordenar: lo disponible está abajo de su punto de reorden. Excedente: no salió nada en 12 meses, hay existencia en planta y no tiene stock de seguridad (dinero parado). OK: alcanza."
 },
 {
  "clave": "estadoSemanaNomina",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "En curso: todavía no llega el jueves en que termina. Lista para cerrar: ya terminó; revísala y ciérrala. Cerrada: ya no cambia y finanzas registra su pago."
 },
 {
  "clave": "estadoServicio",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Por programar: se pidió y nadie le ha puesto fecha. Programado: ya tiene fecha y cuadrilla. En curso: la cuadrilla ya empezó. Cerrado: terminó, con fotos, qué se hizo y quién recibió. Cancelado: no se hizo, con su motivo."
 },
 {
  "clave": "estadoSolicitud",
  "modulos": [
   "compras"
  ],
  "texto": "Sin tomar: nadie la ha agarrado. Cotizando: alguien de compras la tomó. Con precio: ya se contestó y el vendedor ve el precio de lista. No se consigue: se le explicó por qué. Cancelada: el vendedor ya no la necesita."
 },
 {
  "clave": "estadoSolicitudCambio",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Aplicada: ingeniería ya corrigió la lista de materiales. Descartada: se revisó y no procedía. En los dos casos el pendiente de ingeniería se cierra solo y a quien la pidió le llega el aviso."
 },
 {
  "clave": "estadoSugerenciaSubensamble",
  "modulos": [
   "admin"
  ],
  "texto": "Aplicada: ya es un subensamble y lo usan sus equipos. Descartada: alguien decidió dejar las listas como estaban."
 },
 {
  "clave": "estimadoResultados",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Un número con ≈ es estimado, no exacto. En «De dónde sale cada número» ves cómo se calculó y qué hace falta para que sea exacto."
 },
 {
  "clave": "eta",
  "modulos": [
   "importaciones"
  ],
  "texto": "Fecha estimada de arribo al puerto que da la naviera. Si cambia, queda en la historia del embarque y cuenta cuántas veces cambió."
 },
 {
  "clave": "etapaActivaTaller",
  "modulos": [
   "admin"
  ],
  "texto": "Apagada, la etapa deja de ofrecerse para capturar horas de los equipos y para acomodar gente o máquinas, y no entra al plan del taller ni a la capacidad total. Lo que ya tenía registrado se conserva."
 },
 {
  "clave": "etapaEnParalelo",
  "modulos": [
   "admin"
  ],
  "texto": "Una etapa en paralelo se trabaja al mismo tiempo que las anteriores: no espera a que terminen (Torno hace flechas y poleas mientras Pailería arma la estructura). Las etapas que siguen sí la esperan: Pintura no empieza hasta que terminan Pailería y Torno. Lo usan el plan del taller, las fechas y la columna «Listas para empezar»."
 },
 {
  "clave": "etapaOportunidad",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "En qué va la venta: Prospecto (apenas lo conoces), Contactado, Cotizado, Negociación, Ganada o Perdida. La cambias arrastrando la tarjeta en el tablero o desde el detalle; para pasarla a Negociación tienes que anotar qué pasó."
 },
 {
  "clave": "etapaPausada",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Una etapa que empezó y el taller detuvo. La orden se marca en ámbar hasta que la reanudan."
 },
 {
  "clave": "etapasEmbarque",
  "modulos": [
   "importaciones"
  ],
  "texto": "Los pasos del embarque, de la PI aceptada al cierre, cada uno con la fecha real en que pasó: no acepta fechas futuras (lo esperado va en la ETA). La palomita verde ya pasó y el círculo marcado es el que sigue. Algunos se anotan solos: el anticipo al registrar el pago y el pedimento al capturarlo."
 },
 {
  "clave": "etapaTrabajando",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Etapas que el taller inició y no ha pausado ni terminado. En verde, quien tiene su tiempo contando ahí."
 },
 {
  "clave": "etdEmbarque",
  "modulos": [
   "importaciones"
  ],
  "texto": "Fecha estimada en que sale el buque del puerto de origen. La salida real se anota en la etapa «Zarpó»; si el ETD pasa y no ha zarpado, sale un aviso para pedirle fecha al proveedor."
 },
 {
  "clave": "etiquetaQR",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Una etiqueta para pegar en la máquina con su número y un código QR. Al escanearlo con la cámara del celular se abre «Reportar falla» con esa máquina ya elegida. La misma liga se puede grabar en una etiqueta NFC: basta acercar el celular. Si quien escanea no ha entrado al sistema, primero entra y luego llega directo al reporte."
 },
 {
  "clave": "evaluacionDevuelta",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Recursos Humanos la regresó a borrador para que el jefe la corrija; el motivo también queda en los comentarios. El aviso se quita cuando el jefe la vuelve a enviar."
 },
 {
  "clave": "evaluacionMes",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "La calificación de los objetivos de una persona en un mes. Al empezar cada mes se arma sola la del mes que terminó, para quien tiene puesto asignado, con lo que el sistema ya puede medir; lo demás lo califica su jefe."
 },
 {
  "clave": "evidenciaEmpaque",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Las fotos del paquete antes de salir, el check list y el número de serie del equipo. No se pueden cambiar ni borrar: es con lo que uno se defiende de un reclamo. Una foto equivocada se retira (con motivo) y queda a la vista como retirada; mientras el paquete no salga, almacén puede subir la correcta."
 },
 {
  "clave": "evidenciaObjetivo",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Los pedidos, órdenes, conteos o marcas del checklist que explican el número. Punto rojo = cuenta en contra; verde = no cuenta en contra. Una marca impugnada y aceptada deja de contar."
 },
 {
  "clave": "evidenciaServicio",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Fotos de cómo llegó, del trabajo y de la entrega, más el nombre (y si se puede, la firma) de quien recibe. No se pueden borrar."
 },
 {
  "clave": "exactitudConteo",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "De los renglones contados en los conteos que se cerraron en el periodo, cuántos coincidieron con el sistema. Cada renglón que no coincidió se volvió un ajuste."
 },
 {
  "clave": "existenciaNegativa",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "El sistema dice que hay menos de cero: salió algo cuya entrada nunca se registró. Se corrige contando y pidiendo un ajuste, no capturando una entrada inventada."
 },
 {
  "clave": "existenciaPublicableML",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Cuántas ventas se pueden surtir hoy desde planta: lo que hay en los almacenes de planta menos lo apartado para otros pedidos, entre las piezas que lleva cada venta. Si la publicación tiene más existencia que eso, se puede vender lo que no hay. Las de Full no cuentan: esa existencia la maneja Mercado Libre."
 },
 {
  "clave": "existenciasArranque",
  "modulos": [
   "admin"
  ],
  "texto": "El inventario con el que arrancó el ERP se cargó una sola vez, por artículo y almacén; el número cuenta cuántos artículo × almacén tienen existencia hoy. Después, una diferencia se corrige con un ajuste autorizado, no reimportando."
 },
 {
  "clave": "exportacionVenta",
  "modulos": [
   "analisis"
  ],
  "texto": "Venta a clientes fuera de México: cuenta en el total, pero no sale en el mapa."
 },
 {
  "clave": "factorCosteoImportacion",
  "modulos": [
   "importaciones"
  ],
  "texto": "Cuánto se suma de gastos por cada peso de mercancía: los gastos sin IVA entre el valor de la mercancía. Un factor de 0.25 quiere decir $0.25 de gastos por cada $1."
 },
 {
  "clave": "facturaAlRecibir",
  "modulos": [
   "compras"
  ],
  "texto": "El folio de la factura o remisión que vino con la mercancía. Queda en la orden y en la entrada del inventario; si es el de la factura, finanzas la liga sola a la orden."
 },
 {
  "clave": "facturaDeLaOrden",
  "modulos": [
   "compras"
  ],
  "texto": "La factura de esta orden que finanzas registró en la cuenta del proveedor. Si el folio que anotó almacén al recibir casa con el de la factura, se liga sola; si no, finanzas la liga al registrarla. Con su factura, lo que se debe se paga por la factura y la orden ya no sale en «Órdenes de compra» por pagar."
 },
 {
  "clave": "facturaLeidaPdf",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Cuando no hay XML, la IA lee el PDF o la foto de la factura y llena el formulario. Casi siempre acierta, pero no siempre: revisa total, fecha, folio y proveedor antes de registrar. Queda marcada como «leída de PDF» para que el contador pida su XML; si después llega el XML de la misma factura, el ERP la reconoce por su folio fiscal y no la duplica."
 },
 {
  "clave": "facturaNoSeRegistra",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Facturas que finanzas sacó de la lista porque no se registran en estos libros (las cobra el banco directo, son de un socio, se pagaron con un anticipo que ya está registrado). Cada una dice por qué y quién la sacó; se pueden regresar."
 },
 {
  "clave": "facturaProveedorEmbarque",
  "modulos": [
   "importaciones"
  ],
  "texto": "El número de la factura comercial (commercial invoice) del proveedor para esta orden. Se guarda al salir del campo o con Enter; también se llena sola al leer la factura con la IA."
 },
 {
  "clave": "facturaRepetida",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Una factura con el mismo folio del mismo proveedor no se puede registrar dos veces (ni si ya está en la hoja): el sistema dice cuándo y quién la registró. Si no tiene folio o el folio es otro pero el monto es igual y la fecha está a una semana o menos, solo avisa: marca «Sí, es otra compra» si de verdad lo es."
 },
 {
  "clave": "facturaSinRegistrar",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Una factura que el SAT dice que nos hicieron (está en los XML cargados) y que no está en ningún libro: ni en la hoja de compras, ni en las compras del ERP, ni en caja chica. Para saber si ya está, se busca por su folio fiscal, por su folio con el mismo proveedor o por el mismo monto del mismo proveedor en una fecha cercana. Mientras no se registre, Resultados sale con menos gasto del real."
 },
 {
  "clave": "facturasPedido",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Las facturas registradas de este pedido: folio, fecha, total y UUID del SAT. Las registra finanzas. Con una factura registrada, el pedido ya no puede quedar sin IVA."
 },
 {
  "clave": "facturasPendientes",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Cada factura que sigue sin pagar y cuánto le falta. Un pago que dice qué factura paga se aplica a esa; uno que no lo dice, a la que vence primero: si le pagaste 10 mil a un proveedor sin decir cuál, se liquidan sus facturas más viejas hasta donde alcance."
 },
 {
  "clave": "fallasUltimoAnio",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Cuántas fallas tuvo en los últimos 12 meses y cuánto tiempo estuvo parada por ellas."
 },
 {
  "clave": "faltanHoras",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Horas estimadas de la etapa menos las horas hombre ya trabajadas, repartidas entre la gente que la trabaja (o la planeada). Es un cálculo para darse idea; si la etapa ya se pasó de lo estimado, sale en cero."
 },
 {
  "clave": "faltanteMaterial",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Lo que la orden necesita y todavía no está ni surtido ni apartado. Después de apartar, lo que queda es lo que no había libre en planta. En las tarjetas: ámbar si todo ya se pidió a compras, rojo si algo nadie lo ha pedido."
 },
 {
  "clave": "faltanteMeta",
  "modulos": [
   "analisis"
  ],
  "texto": "La meta menos lo vendido en el año, nunca menos de cero. Abajo, los meses que quedan contando el que corre."
 },
 {
  "clave": "faltanteSinPedir",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Material que falta para la orden y todavía no se pidió a compras. Es lo primero que hay que resolver."
 },
 {
  "clave": "familiaProducto",
  "modulos": [
   "analisis"
  ],
  "texto": "Tipo de producto de cada venta. En las ventas de la hoja sale del texto, con las reglas de familia; en los pedidos del ERP, de la categoría del artículo (si la categoría no tiene familia, de las mismas reglas sobre el texto de la partida)."
 },
 {
  "clave": "familiaSerie",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "El tipo de equipo que lleva su propia numeración (bandas, tolvas, cribadoras…). Cada familia tiene su consecutivo, y el ERP sigue donde se quedó el libro de seriales."
 },
 {
  "clave": "faseEmbarque",
  "modulos": [
   "importaciones"
  ],
  "texto": "En qué va el embarque: cotizando, en producción, listo para embarcar, en el mar, en puerto, en planta (falta cerrar cuentas) y cerrado. La marca la última etapa con fecha real, no una casilla. Si ya se devolvió el vacío o llegó la cuenta de gastos, cuenta como en planta aunque falte anotar el día que llegó."
 },
 {
  "clave": "fechaArranque",
  "modulos": [
   "admin"
  ],
  "texto": "El día en que el ERP empezó a llevar ventas y cobros. Antes de esa fecha, los análisis y los saldos de arranque salen del libro de la hoja; cambiarla mueve ese corte en los reportes."
 },
 {
  "clave": "fechaCompromiso",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "El día en que se prometió terminar. Verde si va con tiempo, ámbar si quedan 3 días o menos, rojo si ya pasó."
 },
 {
  "clave": "fechaCompromisoPedido",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "El día que se le prometió la entrega al cliente. Con ella se marca el pedido como atrasado y sale en la agenda de la semana."
 },
 {
  "clave": "fechaEntregaOrden",
  "modulos": [
   "compras"
  ],
  "texto": "Cuándo debe llegar. Las órdenes que salen de requisiciones o de una cotización ya la traen; si no la capturas, al enviar la orden se calcula con los días hábiles de entrega del proveedor (7 si no tiene). Pasada esa fecha, la orden sale como atrasada."
 },
 {
  "clave": "fechasHistorialMovimientos",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "De entrada, los últimos 30 días. Se muestran hasta 2,000 movimientos, los más recientes; si llegas a ese tope, acorta las fechas para ver o exportar el resto."
 },
 {
  "clave": "feriadosLey",
  "modulos": [
   "admin"
  ],
  "texto": "Los descansos obligatorios del artículo 74 de la Ley Federal del Trabajo de este año (los que van en lunes ya vienen movidos). Los pone el ERP solo y se descuentan de vacaciones y permisos."
 },
 {
  "clave": "fichaTecnica",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Lo que ingeniería aprobó para mandarle al cliente: la ficha técnica (medidas, capacidad, motor) y las fotos del equipo. Se abren en Drive y se pueden compartir. Los planos de fabricación no salen aquí: son del taller."
 },
 {
  "clave": "fichaVenta",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Lo que veías en el BUSCADOR de la hoja: precio de lista y mínimo, existencia en planta (y cuánto está apartado), piezas en Full de Mercado Libre, tiempo de entrega, envío gratis y precio sugerido en Mercado Libre."
 },
 {
  "clave": "filaAreaGantt",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Semanas de fila: lo que le falta a esta área (o especialidad), liberado y planeado, entre las horas que da por semana. h/sem: lo que da por semana; en una especialidad, las horas de su gente, y en «Lo demás», lo que queda del área."
 },
 {
  "clave": "filaTaller",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Lo que un pedido nuevo tiene que esperar: las horas que ya tienen las órdenes en el taller y las planeadas, entre lo que trabaja cada etapa por semana. La etapa más cargada manda."
 },
 {
  "clave": "filtroAlmacenExistencias",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Deja solo los artículos que tienen algo (o un negativo) en ese almacén y resalta su columna. El almacén elegido queda en el enlace de la página: si lo compartes, abre igual."
 },
 {
  "clave": "filtroBajasPersonal",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Quienes ya no trabajan aquí, con su fecha de baja. Su ficha y su historial se conservan; desde la ficha se registra un reingreso."
 },
 {
  "clave": "filtroConExistencia",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Los artículos que tienen algo en planta o en el Full de Mercado Libre, incluidos los que están en negativo. Es la vista con la que abre la pantalla."
 },
 {
  "clave": "filtroDevolucionesPorVencer",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Las abiertas cuya hora límite (o fecha de llegada) ya pasó o vence en menos de un día. Empieza por aquí."
 },
 {
  "clave": "filtroEtapaTablero",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Deja solo las órdenes que se están trabajando en esa etapa o que la tienen como la siguiente."
 },
 {
  "clave": "filtroMisClientes",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Los clientes que están a tu nombre. Junto a cada uno dice hasta cuándo es tuyo."
 },
 {
  "clave": "filtroOrdenesAbiertas",
  "modulos": [
   "compras"
  ],
  "texto": "Lo que sigue en curso: borradores, enviadas y recibidas en parte. Es la vista de entrada."
 },
 {
  "clave": "filtroPedidosActivos",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Pedidos confirmados, en producción o listos para entregar. No salen las ventas de Mercado Libre que no llevan nada que fabricar: esas están en «Mercado Libre»."
 },
 {
  "clave": "filtroPedidosEntregados",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Pedidos que se entregaron en los últimos 60 días."
 },
 {
  "clave": "filtroPedidosListos",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Pedidos con todas sus órdenes terminadas en el taller: falta entregarlos. El pedido queda así solo, al terminar su última orden."
 },
 {
  "clave": "filtroPersonasUso",
  "modulos": [
   "admin"
  ],
  "texto": "Las personas con cuenta activa, sin la TV ni la tablet del taller."
 },
 {
  "clave": "filtroProveedoresSurten",
  "modulos": [
   "compras"
  ],
  "texto": "Los que surten algún artículo, tienen órdenes abiertas o se les compró en los últimos 12 meses. Es la vista de entrada: el directorio de las hojas mezclaba acreedores (nómina, casetas, hoteles)."
 },
 {
  "clave": "filtroRolUsoErp",
  "modulos": [
   "admin"
  ],
  "texto": "Deja solo a quien tiene ese rol en los indicadores, la tabla y las gráficas por persona. La gráfica día por día sigue contando a todos, y el costo de la revisión nocturna solo se suma con «Todos los roles»."
 },
 {
  "clave": "filtroServiciosAbiertos",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Lo que no se ha cerrado ni cancelado: por programar, programado y en curso. Es con lo que abre la lista."
 },
 {
  "clave": "filtroSinUsoErp",
  "modulos": [
   "admin"
  ],
  "texto": "Personas con cuenta activa que en todo el periodo no abrieron una pantalla, no registraron un cambio ni le preguntaron a la IA. Son a quienes conviene acompañar."
 },
 {
  "clave": "filtroTodasCuentasUso",
  "modulos": [
   "admin"
  ],
  "texto": "Todas las cuentas: también las desactivadas y las de la TV y la tablet del taller."
 },
 {
  "clave": "filtroTodoDirectorio",
  "modulos": [
   "compras"
  ],
  "texto": "Todos los proveedores activos, aunque no surtan artículos. La nómina, los impuestos, los socios y los bancos no salen aquí: son de finanzas."
 },
 {
  "clave": "finDelPlan",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "El día en que el taller acabaría todas las órdenes abiertas según el plan, si no entrara nada nuevo. Dice qué tan llena está la planta."
 },
 {
  "clave": "firmaServicio",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Quien recibe firma con el dedo (o con el mouse) en el recuadro. Es opcional: lo obligatorio es su nombre. Se guarda al cerrar y sale en el cierre del servicio."
 },
 {
  "clave": "fleteCotizacion",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Para poner el flete en la cotización antes de que el cliente compre: con el código postal, estado, municipio y colonia, y los bultos que salen del empaque de cada artículo, cotizan todas las paqueterías de Skydropx a la vez. Al elegir una se agrega la partida de flete con lo que cobra la paquetería más el recargo fijo que puso envíos, redondeado hacia arriba; la puedes cambiar como cualquier partida. No genera guía ni cobra nada: la guía se hace hasta que haya pedido y envío."
 },
 {
  "clave": "flujoEvaluacion",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Cada mes pasa por cuatro pasos: por calificar (lo califica el jefe directo), por revisar (Recursos Humanos), por aprobar (dirección) y aprobada. Ya aprobada no se toca: un error se corrige con un ajuste que autoriza otra persona."
 },
 {
  "clave": "folio",
  "modulos": [],
  "texto": "El número que el sistema le pone solo a cada documento (cotización, pedido, orden…), en orden y sin repetirse. Con él lo buscas y lo citas; no se escribe a mano."
 },
 {
  "clave": "folioCotizacion",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "El número de la cotización. Se asigna cuando agregas la primera partida: abrir y salir sin capturar no gasta folios. Sus nuevas versiones llevan el mismo número con -v2, -v3…"
 },
 {
  "clave": "folioPedido",
  "modulos": [],
  "texto": "El número del pedido. Los de clientes van PED-26-799: el año en que se levantó y el número corrido de siempre (el que seguía al pedido 798 de la hoja); el número no vuelve a 1 al cambiar de año. Mercado Libre, la tienda web y Amazon llevan su propia serie que sí empieza cada año (ML-26-0001, WEB-26-0001). Un equipo de stock que se vende lleva un folio de pedido normal. Si el pedido tenía otro folio antes (HIS-…, P-…, PED-2026-…), sale como «antes …» y también lo encuentras por él."
 },
 {
  "clave": "formatoComarca",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Para cotizar con la marca de un distribuidor o del cliente: pega la liga de su logo y la hoja sale con ese logo y «Powered by HEGAMEX»."
 },
 {
  "clave": "formulaPrecio",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Cómo sale el precio de un equipo: al costo se le suman los recargos sobre costo (y el de medida especial, si aplica). Eso se divide entre lo que queda del precio después de apartar la utilidad (subida para cubrir el ISR) y los recargos sobre precio. Al final se redondea hacia arriba según la política: en equipos, a $100 abajo de $100,000 y a $1,000 arriba. Lo que se revende sale del costo con el margen sobre precio de su política."
 },
 {
  "clave": "forwarderEmbarque",
  "modulos": [
   "importaciones"
  ],
  "texto": "Quien contrata el flete internacional y, en carga consolidada, junta nuestra mercancía con la de otros (Sea Bridge, Interteam, XPD…). En una carga LCL manda el aviso de desconsolidación."
 },
 {
  "clave": "fotoCatalogo",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "La foto con la que sale el artículo en el catálogo y en las cotizaciones nuevas. Marketing la pone: «Subir foto» desde la computadora o el celular, o pega la liga de Google Drive (se convierte sola en imagen). Solo cambia la foto, nada más de la ficha. Con el filtro «Sin foto» ves lo que falta."
 },
 {
  "clave": "fotoDevolucion",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Una foto opcional de cómo regresó la herramienta, tomada al recibirla. Si regresó dañada o incompleta, la foto va también en el reporte de falla que se abre solo."
 },
 {
  "clave": "fotoEmpleado",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "La foto de su ficha (en el celular abre la cámara). La ven Recursos Humanos, la gerencia de producción y la propia persona; no queda en una liga abierta."
 },
 {
  "clave": "fotoPartidaCotizacion",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "La foto con la que sale esta partida en la cotización; viene del catálogo. Clic para pegar otra liga (la de Drive se convierte sola) o subir una: solo cambia en esta cotización, no en el catálogo."
 },
 {
  "clave": "fotoRetirada",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Si subiste una foto que no era (de otro paquete, repetida, borrosa), «Retirar» la quita de la evidencia sin borrarla: pide el motivo y queda en «Retiradas» con tu nombre y la hora, a la vista de todos, y en la historia. Almacén la retira mientras el paquete siga en el almacén (o la devolución esté abierta); ya en camino, solo la gerencia. Si ya se empacó, sube primero la foto correcta: un paquete empacado no se queda sin foto. La guía no se retira: se registra la correcta."
 },
 {
  "clave": "fotosEquipo",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Las fotos del equipo. La primera es la principal: sale en el buscador y junto a la partida de la cotización; las demás salen en la hoja de fotos al final del PDF. Al agregar el equipo a una cotización, sus fotos se copian: cambiarlas después no cambia las cotizaciones ya hechas."
 },
 {
  "clave": "fotosLlegadaDevolucion",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Las fotos de cómo llegó el paquete, tomadas antes de abrirlo, y las capturas de Mercado Libre. Son la prueba si hay que reclamar."
 },
 {
  "clave": "fotosMejora",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Cómo estaba y cómo quedó. La de antes se sube desde que se propone; la de después, ya en marcha. Las suben quien la propuso (mientras es propuesta), quien la lleva y quien decide las mejoras."
 },
 {
  "clave": "fotoSolicitudPrecio",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Una foto de la pieza, de su placa o de su ficha técnica (imagen o PDF): con eso compras sabe qué buscar. Se sube junto con la solicitud."
 },
 {
  "clave": "fotosOrdenMto",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Fotos de la falla (las que se tomaron al reportarla), de antes, de durante y del trabajo terminado. No se pueden borrar."
 },
 {
  "clave": "frenoSeguimientos",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Con más de 10 seguimientos vencidos no puedes enviar cotizaciones nuevas, ni sacar el PDF o la vista previa de una que todavía no envías, hasta anotar qué pasó con las que ya mandaste: la idea es no seguir cotizando sin saber qué pasó con lo anterior. Las que ya enviaste sí las puedes volver a compartir. Convertir en pedido nunca se frena. Si un cliente está esperando, la gerencia de ventas te libera por ese día con un motivo, y te llega el aviso."
 },
 {
  "clave": "fuenteCliente",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Por dónde llegó el cliente: una visita de ruta, una llamada a recepción, el formulario del sitio web, una pregunta de Mercado Libre, una recomendación… La lista la mantiene la gerencia de ventas."
 },
 {
  "clave": "fuenteIndicador",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "De dónde sale cada indicador. Lo mide el sistema: lo calcula solo con lo capturado en el ERP. Checklist diario: de las marcas de cada día. Califica el jefe o Captura con evidencia: lo pone el jefe, con nota o liga."
 },
 {
  "clave": "fuenteOportunidad",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Por dónde llegó esta venta: una llamada a recepción, el sitio web, Mercado Libre, una recomendación… Si nació de un lead, ya viene llena."
 },
 {
  "clave": "fueraDeHorario",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "El taller está fuera de su horario (de noche, en fin de semana, en feriado) y alguien dejó su tiempo abierto en una etapa. Con «Solo el horario del taller» es normal: ahorita no cuenta horas y sigue solo cuando el taller vuelve a abrir; no hace falta pausar al irse. Con «Lo que marque la terminal» las horas sí siguen corriendo, por eso sale en ámbar: hay que pausar en la terminal."
 },
 {
  "clave": "fueraDeLista",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Salió a una orden de producción sin estar en su lista de materiales, con el motivo que escribió almacén. Puede estar bien, pero conviene preguntar por qué y revisar si a la lista le falta algo. Si «Consumibles del taller» está encendido en Configuración, los consumibles no cuentan aquí: salen a nombre de quien los recibe."
 },
 {
  "clave": "fueraDeResultados",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Lo que salió del dinero pero no es gasto del negocio: retiros y gastos personales de los socios, préstamos de socios y pagos de capital de créditos, y compra de activos (vehículos, maquinaria, instalaciones). Se enseña para que cuadre con el libro de compras, pero no se resta."
 },
 {
  "clave": "ganadoCotizado",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Lo cotizado que se volvió pedido."
 },
 {
  "clave": "ganttHecho",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Etapa terminada: va de cuando se inició a cuando se terminó en la terminal."
 },
 {
  "clave": "ganttPlaneado",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Lo que todavía no empieza: cuándo lo trabajaría su área según el plan. Se recorre solo si algo se adelanta o se atrasa."
 },
 {
  "clave": "ganttPorArea",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Un renglón por área con lo que va a trabajar y cuándo. Si dos órdenes se trabajan a la vez en la misma área, salen una debajo de la otra. Un área con especialidades sale en un renglón por especialidad (por ejemplo «Pailería · Cribadoras»), con las horas por semana de su gente, y uno más con lo que hace cualquiera. Al pasar el mouse por una orden se resaltan sus etapas en todas las áreas."
 },
 {
  "clave": "ganttPorOrden",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Un renglón por orden, en el orden de la fila: la de arriba es la primera que toma cada área. La gerencia de producción la acomoda arrastrando."
 },
 {
  "clave": "ganttPorPedido",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Las órdenes juntas por pedido. Cada grupo dice cuántos equipos lleva, cuándo termina el pedido completo según el plan y cuántos días va tarde. Las de stock van en «Para stock»."
 },
 {
  "clave": "ganttTrabajandose",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Etapa en proceso: llena hasta hoy y translúcida en lo que, según el plan, le falta. Las rayas se mueven: es lo que se trabaja ahorita."
 },
 {
  "clave": "garantiaProcede",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Al cerrar una garantía se anota si procedió (era defecto nuestro) o no (mal uso, desgaste…). Sin esa respuesta la garantía no se cierra."
 },
 {
  "clave": "garantiaVigente",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Si la garantía sigue en pie cuando se pidió el servicio. Cuenta desde que se entregó (o terminó) el equipo con ese número de serie."
 },
 {
  "clave": "gastoEstimadoImportacion",
  "modulos": [
   "importaciones"
  ],
  "texto": "Un gasto calculado antes de tener la cuenta de gastos. Entra al costeo preliminar, pero no al final: ahí manda lo que de verdad cobraron."
 },
 {
  "clave": "gastosEImpuestosEmbarque",
  "modulos": [
   "importaciones"
  ],
  "texto": "Fletes, maniobras, almacenaje, honorarios y demás gastos sin IVA, más el IGI, DTA, PRV y otras contribuciones del pedimento. El IVA no entra aquí: va aparte porque se acredita."
 },
 {
  "clave": "gastosEmbarque",
  "modulos": [
   "importaciones"
  ],
  "texto": "Lo que cuesta traer la mercancía además de su precio: fletes, cargos locales, maniobras, almacenaje, honorarios del agente, flete a planta… Va sin IVA y dice cómo se reparte entre las partidas. Al confirmar la cuenta de gastos leída con la IA, sus conceptos entran solos."
 },
 {
  "clave": "gastosFabricacion",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Compras del libro de compras con categoría de taller: consumibles, gases, equipo de seguridad, reparación de máquinas. Una factura ligada a su orden de compra suma aquí lo de sus partidas que son consumibles del taller. Sin IVA si la compra tiene factura."
 },
 {
  "clave": "gastoSoloUnaOrden",
  "modulos": [
   "importaciones"
  ],
  "texto": "Si el gasto le toca a una sola orden (por ejemplo, el flete de un proveedor), elígela: se reparte solo entre sus partidas. Si no, entre todo el embarque."
 },
 {
  "clave": "gastosOperacion",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Lo que cuesta vender y administrar: sueldos de oficina (todos los departamentos menos Producción), comisiones de los vendedores, compras de oficina y servicios, salidas de caja chica, lo que se queda Mercado Libre de cada venta y las guías pagadas en Envíos."
 },
 {
  "clave": "gastosQueEntraronCosteo",
  "modulos": [
   "importaciones"
  ],
  "texto": "La foto de los gastos que usó este cálculo y cómo se repartió cada uno. El final no lleva estimados. Si después llega otro gasto, sale un aviso para calcular otra versión del final."
 },
 {
  "clave": "gmailConectado",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Tu cuenta de Gmail, conectada una vez para mandar cotizaciones y órdenes de compra desde el ERP. El correo sale de tu cuenta, así que lo ves en tus enviados y las respuestas te llegan a ti. Google te pide permiso de enviar y de leer: leer servirá para ligar al ERP las respuestas a lo que mandes desde aquí. Nadie más puede mandar desde tu cuenta."
 },
 {
  "clave": "graficaControlFueraLista",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Gráfica de control (tipo p): cada punto es la parte de las partidas surtidas a órdenes que salió fuera de su lista esa semana. La línea punteada es el promedio y las grises los límites a 3 desviaciones, más abiertos en semanas con pocas partidas. Un punto rojo arriba del límite es un cambio real que hay que investigar; lo que se mueve entre los límites es variación normal."
 },
 {
  "clave": "grupoLista",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Una sección de la lista de materiales (Estructura, Motriz…) para tenerla ordenada; no cambia cantidades. Arriba eliges en qué grupo entran las líneas nuevas; para pasar las que ya están, márcalas y usa «Mover a grupo». Vacío las deja sin grupo."
 },
 {
  "clave": "guardadoAutomaticoCotizacion",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "La cotización se guarda sola un momento después de que dejas de escribir: no hay botón de guardar. «Sin guardar» quiere decir que el cambio va en camino; si dice «No se guardó», dale clic para reintentar."
 },
 {
  "clave": "guardadoSoloLista",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Cada cambio se guarda en cuanto das Enter o sales de la celda; no hay botón de guardar. Esc, antes de salir, regresa la celda a como estaba."
 },
 {
  "clave": "herramientaAsignada",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "La herramienta que siempre trae la misma persona, como su soldadora. No vence ni sale como préstamo sin regresar; si se cambia de persona, se edita aquí. Un préstamo de unos días se registra en Resguardos."
 },
 {
  "clave": "herramientaSinRegresar",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Prestada que ya pasó la fecha en que debía regresar, o que lleva más días fuera que el límite marcado."
 },
 {
  "clave": "herramientasLean",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Las herramientas que ingeniería de procesos irá usando conforme se capacite. Kaizen y A3 ya se trabajan en Producción → Mejoras; las demás se habilitan una por una, cuando el equipo las vaya a usar."
 },
 {
  "clave": "hiloCorreo",
  "modulos": [
   "importaciones"
  ],
  "texto": "Una conversación de Gmail (el correo y todas sus respuestas). Se liga desde el Gmail de quien lo busca, y solo esa persona lo pone al día con «Traer lo nuevo», porque es su cuenta."
 },
 {
  "clave": "historiaEmbarque",
  "modulos": [
   "importaciones"
  ],
  "texto": "Lo que pasó fuera de las etapas: cada cambio de ETA (se anota solo), las notas de importaciones y las etapas que se quitaron, con su motivo. No se borra."
 },
 {
  "clave": "historialCambiosML",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Cada precio o existencia que el ERP mandó a Mercado Libre, con quién lo pidió (o si fue automático), el antes y el después. «Sin tocar» quiere decir que la publicación ya no estaba como la vio el tablero o tiene variantes; «Error» trae lo que contestó Mercado Libre (por ejemplo, una promoción activa que no deja cambiar el precio)."
 },
 {
  "clave": "historialCosteo",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Una foto del costo y del precio cada vez que cambian. Con permiso de márgenes también ves la línea «a utilidad de hoy», que dice qué precio habría tenido con la utilidad actual: si se separa del precio real, la diferencia vino de cambiar la utilidad, no el costo."
 },
 {
  "clave": "historialCostosImportado",
  "modulos": [
   "admin"
  ],
  "texto": "Cuántos precios de compra de las hojas se trajeron como historia, desde 2011. Así cada artículo trae cómo ha cambiado lo que se paga por él."
 },
 {
  "clave": "historialIncidencias",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Todo lo registrado que terminó en los últimos 400 días: aprobado, por aprobar y rechazado. Filtra por tipo o estado y bájalo en CSV."
 },
 {
  "clave": "historiaRegistroBitacora",
  "modulos": [
   "admin"
  ],
  "texto": "Todos los cambios de este mismo registro, del más reciente al más viejo (hasta 50). El punto de color marca el que abriste."
 },
 {
  "clave": "hojaSalida",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "La hoja que firma el cliente al recibir: qué se le entrega con sus números de serie, sin precios, y los renglones de firma. Se imprime desde el pedido (también almacén); al entregar se anota qué sale de cada partida, quién recibió y se sube la foto o el PDF de la hoja firmada, que queda en el pedido para descargarla. Cada entrega tiene su hoja. Entregan almacén, el vendedor sus pedidos, la gerencia de ventas y dirección."
 },
 {
  "clave": "horarioTaller",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "El horario del taller: qué días se trabaja y a qué hora se entra y se sale. Con él se cuentan las horas hombre (si se cuentan con el horario) y lo que da cada día en el plan del Gantt. Lo pone la gerencia de producción en Cuadrillas → Personal de piso. Si lo cambias, las horas ya marcadas se vuelven a contar con el horario nuevo. Los feriados de ley y los días de descanso de toda la empresa no se trabajan."
 },
 {
  "clave": "horasDoblesTriples",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Las horas extra aprobadas de la semana. Las primeras 9 se pagan al doble y de la décima en adelante al triple (LFT arts. 67 y 68). En amarillo si alguien tiene triples."
 },
 {
  "clave": "horasEncimaCuadrilla",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Las horas que faltan de lo que tiene esta cuadrilla (lo de ahorita y lo que sigue), cada etapa repartida entre su gente. Sirve para darse idea de cuándo queda libre."
 },
 {
  "clave": "horasEtapa",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Horas hombre de cada etapa del taller para fabricar este artículo, sin contar las de sus subensambles (cada uno trae las suyas). Producción planea el taller con estas mismas horas."
 },
 {
  "clave": "horasHombre",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Las horas de trabajo de las personas, no del reloj: si tres trabajan 4 horas en una etapa son 12 horas hombre, y si una se fue a la hora, 9. Salen de lo que se anota en la terminal (quién inició, quién se unió y quién salió) y se comparan contra las horas estimadas del costeo; en ámbar si ya se pasaron. «Sin nombre» son las personas que se contaron sin decir quiénes. Cuántas horas cuenta un tiempo abierto depende de cómo las cuente la gerencia (solo el horario del taller, o lo marcado tal cual)."
 },
 {
  "clave": "horasParadaLaborales",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Las horas laborales del periodo que la máquina estuvo fuera de servicio por sus órdenes de mantenimiento: de que se paró a que volvió a operar, sin contar noches, fines de semana, feriados ni descansos."
 },
 {
  "clave": "horasPendientesColumna",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Las horas estimadas que les faltan a las órdenes de esta columna: las de sus etapas sin terminar, menos lo que el piso ya reportó de avance."
 },
 {
  "clave": "horasPorParametro",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Horas que se suman por cada unidad del parámetro. El total de la etapa es horas fijas + esto × el valor del parámetro: una banda más larga pide más horas sin capturarlas aparte."
 },
 {
  "clave": "horasRealesVsEstimadas",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Horas hombre que se marcaron en la terminal contra las horas que trae el costeo para esas etapas. Solo cuenta las etapas que sí se marcaron con quién trabajó. Arriba de 100 % se tardó más de lo estimado (en ámbar arriba de 105 %, en rojo arriba de 120 %)."
 },
 {
  "clave": "horasServicio",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Las horas de taller que la cuadrilla pasa en el servicio, contadas con el horario del taller que pone la gerencia de producción: sin noches, fines de semana, feriados ni descansos; un día de tiempo extra sí cuenta. Se descuentan de la capacidad semanal del área de cada persona."
 },
 {
  "clave": "horasTaller",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Cómo se cuentan las horas de la terminal; lo elige la gerencia de producción en Cuadrillas → Personal de piso. «Solo el horario del taller»: cuenta el horario que pone la gerencia (qué días, entrada y salida) menos los descansos; la noche, los días que no se trabaja y los feriados no cuentan, así que nadie tiene que pausar para desayunar, comer o al irse. El tiempo extra cuenta solo si la gerencia da de alta ese día con su horario. «Lo que marque la terminal»: cuenta tal cual el tiempo que la etapa estuvo iniciada, también fuera de horario; el piso pausa en cada descanso y al irse. En los dos, «Pausar» es para cuando dejan la orden (falta material, los mueven a otra)."
 },
 {
  "clave": "horasTotalesFabricado",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Todas las horas hombre que lleva fabricarlo completo: las de cada etapa del taller más las de sus subensambles, multiplicadas por cuántos lleva. El detalle está en la pestaña Horas por etapa."
 },
 {
  "clave": "horasTrabajadas",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Cuántas horas le dedicó la persona de mantenimiento a esta orden (no cuánto estuvo parada la máquina). Si le dieron play en la terminal, se llenan solas con sus tramos; quien cierra puede escribir otra cifra si alguien olvidó darle play. Con ellas sale la mano de obra y qué parte del trabajo de mantenimiento es preventivo."
 },
 {
  "clave": "horasUsoErp",
  "modulos": [
   "admin"
  ],
  "texto": "En qué horas del día abre pantallas y registra cambios. Sirve para ver si captura al momento o deja todo para el final del día."
 },
 {
  "clave": "horometro",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "El contador de horas de uso de una máquina. La lectura nueva no puede ser menor que la anterior; al registrarla se revisa si ya toca un preventivo."
 },
 {
  "clave": "horometroAlCerrar",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "La lectura del contador de horas de la máquina al terminar. No puede ser menor que la última. Con ella se cuentan las horas que faltan para su siguiente preventivo por horas."
 },
 {
  "clave": "iaAnalizando",
  "modulos": [],
  "texto": "La IA está escribiendo el resumen (la primera vez del día puede tardar medio minuto). Mientras, ves los avisos que calcula el ERP con reglas; cuando termine, se cambian solos."
 },
 {
  "clave": "iaRedacto",
  "modulos": [],
  "texto": "Lo escribió la IA con los números del ERP, hace el tiempo que dice. Para que salga con lo más reciente, dale a las flechas."
 },
 {
  "clave": "imagenArticulo",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "La foto del artículo: sale en el buscador, en la ficha de venta y en la cotización que recibe el cliente. Puedes pegar la liga de Drive tal cual (el archivo tiene que estar compartido con «Cualquier persona con el enlace») o la de cualquier imagen, o subir la foto desde la computadora o el celular. La subida no depende de Drive: si alguien mueve o deja de compartir el archivo, sigue viéndose."
 },
 {
  "clave": "impactoProduccion",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Qué pasa en el taller si esta máquina se para: no afecta, la hace más lenta, detiene una parte o para el área. Lo califica mantenimiento. Pesa hasta 9 de los 30 puntos de la criticidad; si hay otra con qué suplirla, cuenta un escalón menos."
 },
 {
  "clave": "importadorEmbarque",
  "modulos": [
   "importaciones"
  ],
  "texto": "A nombre de quién se importa: la empresa o la persona física. Se ha importado de las dos formas, así que cada embarque dice de quién es."
 },
 {
  "clave": "importadosBajoReordenTablero",
  "modulos": [],
  "texto": "Artículos importados que ya están abajo de su punto de reorden, los que más les falta primero: disponible / punto de reorden · días que tarda en llegar. Como tardan meses, son los primeros que conviene pedir."
 },
 {
  "clave": "importeAproxRequisicion",
  "modulos": [
   "compras"
  ],
  "texto": "Lo que costarían las partidas marcadas con su costo vigente, en pesos (los dólares al tipo de cambio de hoy). Es aproximado: el precio final queda en la orden."
 },
 {
  "clave": "importeLinea",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Cantidad efectiva por el costo unitario de la pieza. La suma de la lista más la mano de obra propia da el costo del equipo."
 },
 {
  "clave": "importePartidaCotizacion",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Cantidad por precio unitario, menos el descuento de la partida. Si la partida es opcional, se ve tachado: no suma al total."
 },
 {
  "clave": "imprimirDescripcion",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Abre en otra pestaña la descripción de lo que se vendió, lista para imprimir o guardar en PDF: cliente, vendedor, compromiso y cada partida con su descripción y sus órdenes. Sin precios. Desde una orden sale solo su partida. Los pedidos que se cargaron de la hoja traen solo el nombre de cada partida: se imprimen igual, y la descripción completa está en el PDF del pedido."
 },
 {
  "clave": "imprimirOrdenCompra",
  "modulos": [
   "compras"
  ],
  "texto": "Imprime la orden o guárdala como PDF, tal como la recibe el proveedor. Si se cambió después de enviarla, sale con su revisión («Rev. 2») y dice que sustituye a la anterior."
 },
 {
  "clave": "impuestosFinancieros",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Impuestos, PTU, intereses de bancos y financieras que se pagaron en el periodo, según el libro de compras. Se restan de la utilidad de operación para llegar a la utilidad."
 },
 {
  "clave": "impugnacion",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Cuando una evidencia en contra no aplica, el jefe la impugna con un motivo y Recursos Humanos decide si cuenta o no. Queda como constancia; no se borra."
 },
 {
  "clave": "incidenciaYaAutorizada",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Palomeado, queda aprobado al guardar y cuenta de una vez en el saldo, el calendario y la prenómina. Sin palomear, queda por aprobar."
 },
 {
  "clave": "incluirHistoricosPedidos",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Los pedidos que vienen de las hojas y ya se entregaron o cancelaron no salen, para no llenar la lista. Márcalo para verlos. Los de la hoja que siguen en el taller salen siempre."
 },
 {
  "clave": "incoterm",
  "modulos": [
   "importaciones"
  ],
  "texto": "El acuerdo con el proveedor sobre hasta dónde paga él el flete y el seguro (FOB, CIF, EXW…). Define qué gastos nos tocan a nosotros; en CIF o CIP la lista de documentos pide además la póliza de seguro."
 },
 {
  "clave": "indicadoresCalificados",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Cuántos indicadores del mes ya tienen calificación. Mientras falte alguno, el resultado es parcial y el jefe no puede enviarlo a Recursos Humanos (salvo que la llave del bono ya se haya activado)."
 },
 {
  "clave": "indiceCostoFamilia",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Cómo se movió el costo (y el precio de lista) de la familia, con 100 al inicio del periodo: 112 quiere decir 12 % más caro. Cada mes compara solo los equipos que ya existían el mes anterior, así un equipo nuevo en el catálogo no mueve el índice."
 },
 {
  "clave": "indicePreciosProveedor",
  "modulos": [
   "compras"
  ],
  "texto": "Cómo se han movido sus precios, con 100 en el primer mes con datos. Cada mes promedia cuánto cambió el costo de cada artículo que nos vende (los que no cambiaron cuentan como 0 %): 110 quiere decir 10 % más caro."
 },
 {
  "clave": "indiceRegional",
  "modulos": [
   "analisis"
  ],
  "texto": "Peso de la familia en el estado entre su peso en todo el país. Mayor a 1: ahí se vende más de esa familia que en el resto; resaltado de 1.25 para arriba."
 },
 {
  "clave": "infonavit",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Si tiene crédito Infonavit, su número y el descuento que dice el aviso de retención. Sirve para no olvidar el descuento al hacer la nómina."
 },
 {
  "clave": "inicialesVendedorCotizacion",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Las iniciales del vendedor de la cotización. Salen junto al folio en la hoja que recibe el cliente."
 },
 {
  "clave": "instruccionIA",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Lo que quieres que diga el mensaje o algo que la IA no sabe: si ya hay existencia, si lo invitas a planta, si ya te había llamado antes, el tono. Es opcional. No escribas precios que no hayas confirmado: la IA los pone tal cual."
 },
 {
  "clave": "insumosServicio",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Lo que lleva la cuadrilla o la reparación: sale de almacén con el folio del servicio, o se pide a compras si no hay."
 },
 {
  "clave": "intentoLead",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Cada vez que le llamas, le escribes o lo visitas, anótalo. Si le escribiste por WhatsApp o correo, «Le escribí»; si le llamaste y no contestó, «No contestó»; si fuiste y no estaba, «No estaba»; y cuando conteste, «Contestó» con lo que te dijo. Todo cuenta como intento, conteste o no, y en la lista se ve lo último que hiciste y cuándo. Mientras no conteste, sigue siendo lead (no se da de alta como cliente). Los leads que alguien tiene varios días sin ningún intento, o que se volvieron oportunidad y no se cotizan, le aparecen a dirección en «Por revisar»."
 },
 {
  "clave": "interruptorConsumiblesTaller",
  "modulos": [
   "admin"
  ],
  "texto": "Prendido, lo de las categorías marcadas sale a nombre de quien lo recibe y no a la orden. Al prenderlo se suelta lo que estaba apartado de esos artículos para órdenes. Apagado, todo lo que sale para una orden se carga a la orden."
 },
 {
  "clave": "inventarioTablero",
  "modulos": [],
  "texto": "Lo que vale la existencia de cada almacén, al costo de hoy. Arriba, cuánto costaría comprar lo que sugiere Reabasto y para cuántos artículos (los que están abajo de su punto de reorden)."
 },
 {
  "clave": "inversionSugeridaReabasto",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Lo que costaría comprar lo sugerido de los artículos marcados «Ordenar», al costo vigente y sin IVA. Solo lo ve quien tiene permiso de costos."
 },
 {
  "clave": "invitacion",
  "modulos": [
   "admin"
  ],
  "texto": "Deja lista la cuenta de alguien antes de que entre: al entrar por primera vez recibe los roles de la invitación. Un correo de fuera de la empresa solo puede entrar si está invitado. No se manda ningún correo: avísale tú."
 },
 {
  "clave": "invitacionesPendientes",
  "modulos": [
   "admin"
  ],
  "texto": "Correos invitados que todavía no entran por primera vez. Al entrar reciben los roles de su invitación y desaparecen de aquí."
 },
 {
  "clave": "irAlOrigenPendiente",
  "modulos": [],
  "texto": "Te lleva al pedido, la orden o la pantalla de donde salió este pendiente."
 },
 {
  "clave": "isrCompensacion",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "En los equipos la utilidad se pide neta: se divide entre (1 − ISR) para que, después de pagar el impuesto, quede libre la utilidad de la política. Cambiarlo mueve el precio de todo lo que compensa ISR."
 },
 {
  "clave": "iva",
  "modulos": [],
  "texto": "Impuesto al valor agregado, normalmente 16 %. Los precios de lista son sin IVA; el total con IVA es lo que paga el cliente. Si un número ya trae IVA, la pantalla lo dice."
 },
 {
  "clave": "ivaAcreditable",
  "modulos": [
   "importaciones"
  ],
  "texto": "El IVA de la importación y de los gastos. Va aparte porque se acredita (se descuenta del IVA que se paga al SAT); no se suma a lo que cuesta la mercancía."
 },
 {
  "clave": "ivaIncluido",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Marcado, los precios de las partidas ya traen IVA y el total es su suma; sin marcar, el IVA se agrega al final. Cambiarlo convierte los precios y el total no se mueve."
 },
 {
  "clave": "ivaOrdenCompra",
  "modulos": [
   "compras"
  ],
  "texto": "La tasa que cobra el proveedor: 16 % normal, 8 % en zona fronteriza, 0 % en importaciones o exentos. Cambia el IVA y el total de la orden."
 },
 {
  "clave": "jackKnife",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Cada máquina con fallas cerradas es un punto: a la derecha las que fallan más veces, arriba las que más tardan en volver (MTTR). Las líneas punteadas son los promedios. Arriba a la izquierda las «agudas» (fallan poco pero tardan: refacciones, proveedor, conocimiento); abajo a la derecha las «crónicas» (fallan seguido: buscar la causa raíz o el preventivo); arriba a la derecha las dos cosas, lo más urgente. El tamaño del punto son sus horas paradas."
 },
 {
  "clave": "jefeDirecto",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Quien califica a la persona. Solo ve y califica a su gente, y nadie puede ser su propio jefe. Si no tiene jefe asignado, califica Recursos Humanos."
 },
 {
  "clave": "juntarClientes",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Para cuando el mismo cliente está dado de alta dos veces. Tú eliges cuál se queda (se propone el que trae lo de la hoja y las facturas o, si no, el que tiene RFC). Todo lo del otro (pedidos, cotizaciones, saldo de la hoja, facturas, contactos) pasa al que se queda, le completa los datos que le falten y el repetido se borra. Con RFC distinto no se pueden juntar. Lo hace la gerencia de ventas, o tú si los dos son tuyos o libres."
 },
 {
  "clave": "kardex",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "La historia de un artículo: cada entrada y salida con fecha, quién la hizo, para qué y el saldo que quedó en ese almacén."
 },
 {
  "clave": "kpiGarantiasAbiertas",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Garantías que no se han cerrado ni cancelado, tengan fecha o no. Abajo, cuántas siguen sin fecha. Al cerrar cada una se anota si procedió."
 },
 {
  "clave": "kpiServiciosEnCurso",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Servicios que ya se iniciaron y no se han cerrado: la cuadrilla está trabajando en ellos. Abajo, el cliente y el lugar de uno de ellos. Clic para verlos en la lista."
 },
 {
  "clave": "kpiServiciosEstaSemana",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Servicios programados o en curso que caen en algún día de esta semana, de lunes a domingo. Abajo, cuántas personas salen del taller, sumando la cuadrilla de cada servicio. Clic para ver los programados."
 },
 {
  "clave": "kpiServiciosPorProgramar",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Servicios que ya se pidieron y nadie les ha puesto fecha ni cuadrilla. Abajo, el que lleva más tiempo esperando. Lo ideal es cero; clic para ver solo esos."
 },
 {
  "clave": "lead",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Alguien que llamó o escribió interesado y todavía no es oportunidad: quién es, cómo contactarlo y qué busca. Lo registra recepción (o cualquier vendedor) y se vuelve oportunidad cuando un vendedor lo atiende."
 },
 {
  "clave": "leadCompleto",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Un lead está completo cuando el vendedor tiene con qué atenderlo: dónde está (ciudad o estado), la empresa (o «Particular» si es una persona) y qué busca con modelo, medida o para qué («Cribadora V3», «Silo fijo para cemento», no solo «Informes»). Si ya es cliente, la empresa y el lugar salen de su ficha. Al abrir uno incompleto te dice qué le falta y lo completas ahí; lo puede completar quien lo registró, el vendedor que lo tiene o la gerencia, mientras siga abierto. «Incompletos» junta los que tienen algo pendiente. Para recepción es un objetivo: cuenta cómo están al revisar el mes, así que si lo completas antes, ya no cuenta."
 },
 {
  "clave": "leadsDeHoyInicio",
  "modulos": [],
  "texto": "Los leads que tú registraste hoy. Abajo, de los que puedes ver, cuántos esperan vendedor y cuántos ya tienen vendedor pero no los ha atendido; se pinta en ámbar si alguno espera vendedor. Clic para abrir Leads."
 },
 {
  "clave": "leadTime",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Cuánto tarda un equipo desde que se libera al taller hasta que se termina, en días de calendario. La mediana es el caso típico: no la mueven uno o dos equipos que se quedaron detenidos meses."
 },
 {
  "clave": "leerCotizacionProveedor",
  "modulos": [
   "compras"
  ],
  "texto": "Sube el PDF o la foto de la cotización del proveedor y la IA lee proveedor, partidas, cantidades y precios y los empareja con el catálogo. Tú lo revisas: nada se guarda hasta crear la orden."
 },
 {
  "clave": "leyendaPromocion",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Un texto en rojo bajo el total de la hoja, por ejemplo hasta cuándo vale la promoción. Si hay descuento, sale después de «Ahorro de $…»."
 },
 {
  "clave": "liberarFrenoSeguimiento",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Deja enviar cotizaciones a este vendedor solo por hoy, aunque siga con seguimientos vencidos. Pide el motivo y le llega un aviso; mañana el freno vuelve si no se pone al día."
 },
 {
  "clave": "ligaEmpleado",
  "modulos": [
   "admin"
  ],
  "texto": "La ficha de Personal ligada a esta cuenta. Con ella la persona ve su saldo de vacaciones y su desempeño, y aquí se avisa si la dieron de baja."
 },
 {
  "clave": "ligarHiloGmail",
  "modulos": [
   "importaciones"
  ],
  "texto": "Busca en tu Gmail (como lo harías allá: BL, referencia del agente, PI o proveedor) y liga el hilo a este embarque. Sus correos se guardan aquí sin lo citado, para que los vea quien ve el dinero de importaciones."
 },
 {
  "clave": "ligarOrdenEmbarque",
  "modulos": [
   "importaciones"
  ],
  "texto": "Elige una orden de compra (en borrador, enviada o recibida en parte) para que viaje en este embarque; primero salen las de importación o en otra moneda. Al ligarla, si traía IVA se pone en 0: el IVA se paga en el pedimento."
 },
 {
  "clave": "ligaTerminalPiso",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "La pantalla de la tablet del taller, donde se inicia, pausa y termina cada etapa con quién la trabaja. Lo que se marca ahí sale aquí al momento."
 },
 {
  "clave": "lineaOportunidad",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Qué se está vendiendo: Maquinaria, Refacciones u Otros (fletes, servicios, instalaciones). La eliges tú; para la comisión cuenta la línea de cada partida del pedido, no esta."
 },
 {
  "clave": "lineasLista",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Cuántos renglones tiene su lista de materiales (un subensamble cuenta como un renglón). Cero quiere decir que ingeniería todavía no lo captura."
 },
 {
  "clave": "lineaTiempoSolicitud",
  "modulos": [
   "compras"
  ],
  "texto": "Por dónde va: cuándo se pidió y su plazo, quién de compras la tomó y cuándo se contestó. Las horas son hábiles: solo cuentan las del horario de la planta."
 },
 {
  "clave": "lineaVenta",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Maquinaria, Refacciones u Otros (fletes, servicios, instalaciones). La pone el catálogo en cada partida y de ella depende cómo cuenta para la comisión; solo la gerencia la puede cambiar."
 },
 {
  "clave": "listaDocumentosEmbarque",
  "modulos": [
   "importaciones"
  ],
  "texto": "Lo que necesita este embarque, según su modalidad y su incoterm (la póliza de seguro, por ejemplo, solo en CIF o CIP). Cada uno dice quién lo debe y en qué va; subir el archivo lo marca como recibido. Los que traen precios solo los abre quien ve el dinero."
 },
 {
  "clave": "listaMateriales",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "La receta del artículo: cada componente, materia prima o subensamble que lleva y en qué cantidad. Producción surte cada orden con esta lista, así que lo que no está aquí no llega al taller."
 },
 {
  "clave": "listaParaLlamar",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Todos los clientes con un motivo para buscarlos, menos los que ya están en seguimiento. Salen tus clientes y los que no tienen vendedor (la gerencia ve los de todos); primero, los que más vale buscar."
 },
 {
  "clave": "listasDondeVaDirecto",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Los equipos y subensambles que llevan esta pieza en su propia lista (no dentro de un subensamble). Ninguna viene marcada: elige en cuáles cambiarla. Si eliges un subensamble, el cambio llega a todos los equipos que lo usan."
 },
 {
  "clave": "llaveBono",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Un indicador que funciona como candado: si en el mes llega a cierto número de incumplimientos (por ejemplo, días sin entregar el celular), el bono completo vale 0, sin importar lo demás."
 },
 {
  "clave": "llegadaPlanta",
  "modulos": [
   "importaciones"
  ],
  "texto": "Cuándo llega a planta. Mientras está en el mar o en puerto, es el arribo (o la ETA) más lo que suelen tardar los embarques de puerto a planta; ya despachado, el día siguiente; ya en planta, la fecha real (si nadie la anotó, dice que falta)."
 },
 {
  "clave": "lleganPlantaCatorceDias",
  "modulos": [
   "importaciones"
  ],
  "texto": "Embarques que todavía no están en planta y que, según su llegada estimada, llegan en las próximas dos semanas. Sirve para preparar espacio y quién recibe."
 },
 {
  "clave": "llenarSurtido",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Al surtir, las cantidades empiezan vacías para que no salga nada sin querer. Toca el número de «Por surtir» para llenar lo que falta, o el de «Apartado» para llenar lo apartado; luego ajusta si das solo una parte. De una partida de la lista no sale más de lo que falta: si hace falta más, pide el cambio a ingeniería desde la orden para que la lista quede como en la realidad. Los consumibles del taller y lo que no está en la lista no tienen ese tope."
 },
 {
  "clave": "loCotizado",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Todas las cotizaciones que empezaron en el periodo, cada una una sola vez aunque tenga varias versiones, con el monto de su última versión, sin IVA y en pesos (las de dólares, con su tipo de cambio)."
 },
 {
  "clave": "loLeidoImportacion",
  "modulos": [
   "admin"
  ],
  "texto": "Cuántos renglones de cada hoja leyó la última importación: proveedores, componentes, equipos, líneas de materiales… Es lo que se trajo en esa corrida, no lo que hay hoy en el ERP."
 },
 {
  "clave": "loQueImportaHoy",
  "modulos": [],
  "texto": "Resumen del día de tu área. En rojo los riesgos, en ámbar lo que pide atención, en verde lo que va bien. Si tu puesto tiene el Asistente y la IA está conectada, ella lo redacta con los datos del ERP; si no, salen los avisos calculados por reglas (dice “Reglas de la base · sin IA”). Cada tarjeta lleva a donde se atiende."
 },
 {
  "clave": "lote",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Cuánto se pide normalmente: los meses de cobertura por la demanda mensual."
 },
 {
  "clave": "lugarEnFila",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "El lugar de la orden en la fila del taller: la primera es la que toma antes cada área. «Hasta arriba», «Subir» y «Bajar» la mueven; el plan se recalcula y la cola de Cuadrillas y de la terminal queda en ese orden."
 },
 {
  "clave": "manoObraPropia",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Lo que cuestan las horas de este equipo o subensamble en cada etapa (horas × tarifa de la etapa), sin las de sus subensambles: ésas ya vienen dentro del costo de cada uno."
 },
 {
  "clave": "manoObraTaller",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Los sueldos de la gente del departamento de Producción en el periodo. Desde el arranque: de una semana de nómina cerrada, lo que se pagó; de las demás, su sueldo semanal ÷ 7 por cada día de alta. Antes del arranque: la nómina pagada según el libro de compras de la hoja (nómina, IMSS y servicios médicos), repartida entre taller y oficina con la proporción de los sueldos de hoy, por eso es estimada."
 },
 {
  "clave": "mantenimientoMetricas",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Fallas: correctivos reportados en el periodo y cuántos pararon la máquina. Horas fuera de servicio: el tiempo que las máquinas estuvieron paradas dentro del periodo. Tiempo de reparación: de que se reporta la falla a que se cierra (MTTR). Preventivos a tiempo: los hechos antes de su fecha."
 },
 {
  "clave": "mapaCalorUsoErp",
  "modulos": [
   "admin"
  ],
  "texto": "Un renglón por persona (hasta 25, las de más uso primero) y un cuadro por día. Entre más oscuro, más de la medida que escojas ese día (con «Costo de la IA» cuenta las consultas). Los huecos dicen quién deja de usar el ERP algunos días o quién ya no lo usa."
 },
 {
  "clave": "mapaFamilia",
  "modulos": [
   "analisis"
  ],
  "texto": "Cuánto se vendió de una familia en cada estado en el periodo; cada tono junta estados con venta parecida. Clic en un estado para ver qué más se vende ahí."
 },
 {
  "clave": "mapaVentasComoLeer",
  "modulos": [
   "analisis"
  ],
  "texto": "El tono de cada lugar dice cuánto tiene de lo que elegiste (venta, clientes, ticket o crecimiento); gris es sin venta. Pasa el mouse para ver sus números y, en el país, dale clic a un estado para ver sus municipios."
 },
 {
  "clave": "maquinaCritica",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Una máquina que, si se para, para el área completa."
 },
 {
  "clave": "maquinaDeBaja",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Una máquina o herramienta que ya no conviene reparar o que ya no está en el taller. Se da de baja desde su ficha con el motivo: sus órdenes abiertas se cancelan, sus planes preventivos se apagan y deja de contar en las métricas desde ese día. Su historial se queda y se puede reactivar."
 },
 {
  "clave": "marcaChecklist",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Cada marca guarda a quién, quién marcó y a qué hora. Se puede corregir hasta una semana atrás (después, solo Recursos Humanos) y nunca en un mes ya calificado. Un día sin marca no cuenta en contra."
 },
 {
  "clave": "masAdelante",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Órdenes que todavía están en una etapa anterior (siguen en Corte o en Pailería, por ejemplo). Se juntan aquí, cerradas, para no repetir la misma orden en todas las columnas; ábrelas si quieres planear desde ya quién las va a hacer."
 },
 {
  "clave": "masDeUnDiaPrecio",
  "modulos": [
   "compras"
  ],
  "texto": "Qué parte de las solicitudes de este mes tardó más de un día hábil (10 horas) en contestarse; cuentan también las abiertas que ya pasaron de un día. Menos es mejor: en verde si es igual o mejor que en el chat."
 },
 {
  "clave": "materialQuitado",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Cuando un material de la orden se quita o se reemplaza no se borra: queda tachado al final de su grupo con la cantidad que llevaba, quién lo hizo, cuándo y por qué, y el reemplazo dice «Reemplaza a …». Deja de pedirse a compras y suelta lo que tenía apartado. Si ya se había surtido, hay que regresarlo al almacén. Un quitado por error se regresa con «Volver». Lo cambian ingeniería y la gerencia de producción, y cada cambio queda en la línea de tiempo."
 },
 {
  "clave": "materialVendido",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "El material de lo vendido. Desde el arranque: si la partida es de un artículo con costeo, su costo de material de hoy por la cantidad; si es de texto, se estima con lo que el material suele pesar en el precio de esa línea (de lo vendido con costeo en el último año si hay al menos 10 partidas; si no, del catálogo). Antes del arranque no hay costeo de lo vendido: cuenta lo que se compró de material según el libro de compras de la hoja."
 },
 {
  "clave": "matrizAbcXyz",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Cruza dos preguntas para decidir cómo controlar cada artículo. ABC: con permiso de costos, cuánto valor salió en 12 meses (A es el 80 % del valor, B el siguiente 15 %, C el resto); sin costos, qué tan seguido sale (A 6 meses o más de 12, B de 3 a 5, C 1 o 2). XYZ: qué tan parejo sale mes con mes, medido con la variación (desviación ÷ promedio): X hasta 0.5, Y hasta 1, Z más de 1. Un AX se controla fino con punto de reorden; un CZ casi nunca conviene tenerlo en almacén."
 },
 {
  "clave": "matrizFamiliaEstado",
  "modulos": [
   "analisis"
  ],
  "texto": "Cada renglón es una familia y cada columna uno de los 12 estados que más compran; los demás van juntos en «Resto». Clic en el nombre de un estado para verlo de cerca abajo, o en una familia para ver su mapa; otro clic lo quita."
 },
 {
  "clave": "medianaRespuestaPrecio",
  "modulos": [
   "compras"
  ],
  "texto": "La mitad de los precios de este mes se contestó en menos de este tiempo, contado en horas hábiles desde que se pidió. Menos es mejor: en verde si es igual o mejor que en el chat."
 },
 {
  "clave": "medidaEspecial",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Equipo hecho a una medida fuera de la estándar. Se marca al darlo de alta (y la copia de «Duplicar» lo conserva); su precio de lista ya lo toma en cuenta."
 },
 {
  "clave": "medidaLoCotizado",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "En dinero: el grueso de cada franja es el monto sin IVA, en pesos. En cotizaciones: cuántas son, sin importar su monto."
 },
 {
  "clave": "medidaUsoErp",
  "modulos": [
   "admin"
  ],
  "texto": "Qué medir en las gráficas: tiempo activo, cambios, consultas a la IA, su costo o personas activas (cuántas personas hicieron algo cada día). Los indicadores y la tabla no cambian."
 },
 {
  "clave": "mejoraA3",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Una mejora grande se trabaja como A3, la hoja de una sola página de lean: a la izquierda la situación actual, el objetivo y la causa raíz (preguntar «¿por qué?» hasta llegar al fondo); a la derecha las contramedidas, el plan y el resultado. La decide ingeniería de procesos o la gerencia."
 },
 {
  "clave": "mejoraDescartada",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Ideas que se decidió no hacer. Al descartarla se escribe el porqué y a quien la propuso le llega el aviso con el motivo. No salen en el tablero; «Regresar a propuesta» la vuelve a abrir."
 },
 {
  "clave": "mejoraEnMarcha",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Mejoras que ya tienen responsable y fecha. En rojo, las que pasaron su fecha y no se han hecho. Quien la lleva escribe el resultado y la marca hecha."
 },
 {
  "clave": "mejoraHecha",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Mejoras terminadas, con lo que se logró escrito. Aquí se ven las de los últimos 90 días; quien la propuso recibe el aviso de que ya se hizo."
 },
 {
  "clave": "mejoraKaizen",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Una mejora (kaizen) es cualquier cambio chico que quite trabajo de más, esperas, vueltas o retrabajos. La propone cualquiera del taller, aquí o desde la terminal con «Tengo una idea», y se le reconoce a quien la tuvo. Ingeniería de procesos y la gerencia de producción la deciden: le ponen quién la lleva y para cuándo, o la descartan diciendo por qué."
 },
 {
  "clave": "mejoraPropuesta",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Ideas que todavía nadie decide. Ingeniería de procesos o la gerencia de producción las revisan: si van, les ponen quién las lleva y para cuándo y las ponen en marcha; si no, las descartan con su motivo (quien la propuso lo lee)."
 },
 {
  "clave": "mejoresClientesAnio",
  "modulos": [],
  "texto": "Los 8 clientes que más han comprado este año, con IVA y en pesos: lo del libro de ventas de la hoja más los pedidos del ERP no cancelados. Clic para abrir su ficha."
 },
 {
  "clave": "mensajeIALead",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "«Mensaje con IA» te escribe el WhatsApp o el correo para este lead. Arriba puedes ponerle contexto o una instrucción («dile que la banda está en existencia», «pregúntale si ya tiene dónde instalarlo», «más formal, es para una constructora»); si lo dejas vacío, lo escribe con lo que busca y los intentos anteriores. No inventa precios, tiempos ni existencias. Lo revisas, lo cambias si quieres y lo abres en WhatsApp o en el correo; al abrirlo se anota «Le escribí» con ese texto. Cada mensaje sale distinto a los últimos que mandaste: WhatsApp bloquea por un día a quien manda casi el mismo texto a muchos números. Aun así, escríbele a uno a la vez y deja unos minutos entre uno y otro."
 },
 {
  "clave": "mensajeSeguimiento",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "El botón «Mensaje» (con destellos ✦) le pide a la IA el WhatsApp de seguimiento para ese cliente. Lo escribe con lo que has anotado en «¿Qué pasó?» de esa venta y el equipo que cotizaste: entre más detalle anotes (qué dijo, qué le preocupa, quién decide), más a la medida sale; sin notas, sale un mensaje general. No inventa precios, descuentos ni fechas, y no se manda solo: lo revisas, lo cambias si quieres y lo abres en WhatsApp. Abajo te da un consejo de qué averiguar en ese contacto. Cuando el cliente conteste, anota qué pasó."
 },
 {
  "clave": "menuFijadas",
  "modulos": [],
  "texto": "Las pantallas que más usas, arriba. Pasa el mouse por cualquier opción del menú y con el alfiler la fijas aquí; con el alfiler tachado la quitas. Siguen también en su sección."
 },
 {
  "clave": "menuMasCotizacion",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Más acciones: vista previa, imprimir, compartir por WhatsApp o correo, nueva versión, duplicar con folio nuevo, convertir a pedido y marcar rechazada con su motivo. En un borrador también lo puedes eliminar."
 },
 {
  "clave": "menuPersonal",
  "modulos": [],
  "texto": "Las secciones del menú salen en el orden de tu puesto: si eres de producción, Producción va primero. Clic en el nombre de una sección la colapsa o la abre; con las flechas que aparecen al pasar el mouse la subes o la bajas. Lo que acomodas se queda en esta computadora, solo para ti. «Restaurar el menú de mi puesto», al final, lo regresa como estaba."
 },
 {
  "clave": "mercanciaEmbarque",
  "modulos": [
   "importaciones"
  ],
  "texto": "El total de las órdenes de compra que van en el embarque, en dólares. Si alguna está en pesos o euros, se pasa a dólares con el tipo de cambio de hoy."
 },
 {
  "clave": "mermaLinea",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Lo que se pierde al cortar o armar. La cantidad se divide entre (1 − merma): 10 m con 5 % de merma piden 10.53 m."
 },
 {
  "clave": "mesesCobertura",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Para cuántos meses de demanda se pide cada vez: 1 si es nacional, 6 si es importado, salvo que el artículo tenga el suyo. Vacío regresa al valor normal."
 },
 {
  "clave": "mesesConTarjeta",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Plan de meses para pagar con tarjeta. La mensualidad ya incluye la comisión del plan: total ÷ (1 − tasa del plan) ÷ meses. Sale en la cotización y en el mensaje de WhatsApp."
 },
 {
  "clave": "mesMiDesempeno",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Tu resultado de ese mes, de 0 a 100 %. «En calificación»: tu jefe todavía no termina. «En revisión»: lo revisan Recursos Humanos o dirección. «Aprobado»: ya es definitivo. En rojo con la llave: ese mes el bono vale 0."
 },
 {
  "clave": "metaAnual",
  "modulos": [
   "analisis"
  ],
  "texto": "La meta de venta del año, con IVA. La captura dirección; el escenario calcula una meta creciendo el porcentaje que escribas sobre el cierre del año anterior."
 },
 {
  "clave": "metaPorEstado",
  "modulos": [
   "analisis"
  ],
  "texto": "La sugerida reparte la meta del año con lo que pesó cada estado en los 3 años completos anteriores. Dirección puede escribir otra (se guarda con Enter o al salir de la casilla); vacía regresa a la sugerida. Solo se puede ya capturada la meta del año."
 },
 {
  "clave": "metodoAcceso",
  "modulos": [
   "admin"
  ],
  "texto": "Google: entra con «Continuar con Google». Contraseña: entra con correo y contraseña, como las cuentas de la TV y la tablet del taller."
 },
 {
  "clave": "metodoPagoCfdi",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Lo dice la factura. De contado (PUE): ya se pagó o se paga al momento. A crédito (PPD): se paga después; si no se registra, es una cuenta por pagar que no sale en Pagos a proveedores."
 },
 {
  "clave": "metodoPagoImportacion",
  "modulos": [
   "importaciones"
  ],
  "texto": "Transferencia internacional desde una cuenta en pesos, o EBANX cuando se paga por Alibaba. No hay cuenta en dólares: todo sale de pesos."
 },
 {
  "clave": "metricasPorEquipo",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Una fila por modelo terminado en el periodo: cuántos salieron, las horas hombre por equipo contra las del costeo y cuántos días tardó en promedio de liberado a terminado."
 },
 {
  "clave": "metricasPorEtapa",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Una fila por área con las etapas que terminaron en el periodo: cuántas se marcaron en la terminal, horas reales contra estimadas y cuánto esperaron y se trabajaron en promedio. Las pausas, los problemas y las reabiertas son del periodo; «En proceso hoy», de ahorita."
 },
 {
  "clave": "mezclaEstadoMatriz",
  "modulos": [
   "analisis"
  ],
  "texto": "Cada columna suma 100 %: qué parte de lo que compró ese estado fue de cada familia. Sirve para comparar un estado chico con uno grande."
 },
 {
  "clave": "mezclaUsoErp",
  "modulos": [
   "admin"
  ],
  "texto": "De todo el tiempo activo de cada persona (o, si todavía no hay tiempo, de las pantallas que abrió), qué parte es de cada sección del menú: Ventas, Almacén, Producción… Cada sección conserva su color en todas las personas."
 },
 {
  "clave": "minutosDeshacer",
  "modulos": [
   "admin"
  ],
  "texto": "Cuántos minutos tiene quien se equivocó para deshacerlo él mismo: en almacén, una salida o un traspaso que registró; en pendientes, reabrir uno que cerró. Queda el motivo y quién fue. En 0 se apaga, y entonces lo de almacén se corrige con un ajuste y el pendiente se pide de nuevo. Va de 0 a 240."
 },
 {
  "clave": "mlFull",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Almacén ML: lo que está en la bodega de Mercado Libre (Full). Es nuestro y se vende desde ahí, pero no se puede usar en planta, así que no suma al disponible."
 },
 {
  "clave": "modalidad",
  "modulos": [
   "importaciones"
  ],
  "texto": "Cómo viaja: contenedor completo (FCL), carga consolidada con otros (LCL), consolidado de varios proveedores nuestros o aéreo. De eso depende la lista de documentos."
 },
 {
  "clave": "modoCatalogoSolicitud",
  "modulos": [
   "compras"
  ],
  "texto": "«Está en el catálogo»: busca y elige el artículo que ya existe. «Dar de alta»: si no existe, se crea aquí como componente con la clave que sigue, y el vendedor ya lo encuentra en su buscador."
 },
 {
  "clave": "modoLeads",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "A quién le llega un lead nuevo. Hay tres formas, se escoge en Configuración: bandeja (se avisa a los vendedores y el primero que lo toma se lo queda), la gerencia de ventas lo asigna, o quien lo registra escoge al vendedor. En las tres, si ya es cliente y tiene vendedor vigente, le llega directo a su vendedor."
 },
 {
  "clave": "momentoCelular",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Qué revisión del celular estás marcando. Se elige sola según la hora: antes de las 11, entrada; antes de las 3 de la tarde, break 1; después, break 2."
 },
 {
  "clave": "montoEstimado",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Lo que crees que vale la venta, sin IVA. Si la oportunidad la abre una cotización enviada, toma el total sin IVA de esa cotización."
 },
 {
  "clave": "montoMatriz",
  "modulos": [
   "analisis"
  ],
  "texto": "Los pesos vendidos de cada familia en cada estado, con IVA. Aquí resaltan los estados que más compran."
 },
 {
  "clave": "montosCorreos",
  "modulos": [
   "importaciones"
  ],
  "texto": "Importes que se mencionan en los correos (fletes, saldos, cargos). Solo se muestran: para que cuenten hay que capturarlos como pago, gasto o saldo por recuperar."
 },
 {
  "clave": "montoSinIva",
  "modulos": [],
  "texto": "El importe antes del impuesto. Las ventas del mes, las comisiones y las compras de 12 meses se miden sin IVA, para comparar parejo sin importar cómo se cotizó."
 },
 {
  "clave": "motivoCotizacionPorVencer",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Tiene una cotización enviada o autorizada que vence en los próximos 7 días o venció hace 10 días o menos. Llamar antes de que se enfríe."
 },
 {
  "clave": "motivoLeToca",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Compra con ritmo (3 compras o más, cada 1 a 12 meses) y ya pasó su tiempo de siempre, pero no el doble. Es el momento de buscarlo."
 },
 {
  "clave": "motivoMovimientoAlmacen",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Obligatorio: queda en el historial para saber a dónde fue cada cosa. Los botones de abajo lo llenan rápido; si ya escribiste algo, el botón lo pone adelante de tu texto."
 },
 {
  "clave": "motivoPerdida",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Por qué se perdió (precio, tiempo de entrega, seguimiento…). Es obligatorio: sin eso no se sabe qué corregir."
 },
 {
  "clave": "motivoReactivar",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Compró 2 veces o más y lleva entre 6 meses y 3 años sin comprar."
 },
 {
  "clave": "motivoRefacciones",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Compró un equipo de $40 mil o más hace entre 6 meses y 4 años: a estas alturas ya pide rodillos, banda, cangilones o mantenimiento."
 },
 {
  "clave": "motivoUbicacion",
  "modulos": [
   "analisis"
  ],
  "texto": "Por resolver: el estado o la ciudad no se reconocieron. Por confirmar: se ligó por parecido, a una ciudad de otro estado o adivinando el estado por la ciudad. Falta el dato en la ficha: no hay ciudad escrita y se arregla en el cliente. Por aproximación: el nombre corto o largo de un solo municipio."
 },
 {
  "clave": "moverCalendario",
  "modulos": [],
  "texto": "Pasa al mes anterior o al siguiente (a la semana, en la vista Semana). «Hoy» te regresa a la fecha de hoy."
 },
 {
  "clave": "moverCalendarioCuadrillas",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Recorre el calendario una semana para atrás o para adelante. «Hoy» lo regresa a esta semana."
 },
 {
  "clave": "movimientoCorreccion",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "«Corrección» es el movimiento que deshizo otro (lo regresó al revés, con su motivo); «Deshecho» es el original que se corrigió. Los dos se quedan en el historial y se compensan."
 },
 {
  "clave": "mtbf",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Tiempo promedio entre fallas: las horas laborales que la máquina estuvo operando entre el número de fallas (órdenes correctivas) del periodo. Más alto es mejor. «Sin fallas» quiere decir que no falló en el periodo."
 },
 {
  "clave": "mttr",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Tiempo promedio de reparación, en horas laborales: de que se reporta la falla a que se cierra su orden. Si se paró el viernes a las 5 y quedó el lunes a las 9, cuenta una hora, no todo el fin de semana. Más bajo es mejor. El «paro promedio» es solo de las fallas que detuvieron la máquina, de que se paró a que volvió a operar, también en horas laborales."
 },
 {
  "clave": "municipiosEstado",
  "modulos": [
   "analisis"
  ],
  "texto": "Los 8 municipios del estado que más compraron en el periodo. Lo de clientes sin municipio no sale aquí."
 },
 {
  "clave": "netoML",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Lo que de verdad llega a la cuenta de Mercado Pago: lo que pagó el comprador menos la comisión, el envío que pagamos y las retenciones. Mercado Pago lo deja disponible unos días después (la fecha sale junto)."
 },
 {
  "clave": "nivelPermiso",
  "modulos": [
   "admin"
  ],
  "texto": "Lo que un rol puede hacer en un módulo: 1 ver, 2 capturar (ver y registrar), 3 administrar (aprobar, borrar, configurar). Un guion = sin acceso: ni lo ve en el menú ni el ERP le entrega esos datos."
 },
 {
  "clave": "nombreParametro",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Cómo se llama el parámetro en las cuentas (largo_m, ancho_pulg…): sin acentos ni espacios. Si escribes «Largo en metros», se guarda como largo_en_metros."
 },
 {
  "clave": "nominaPagada",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Cuando finanzas registra la salida del dinero de una semana cerrada, la semana dice la fecha, la cuenta de donde salió y el monto. Mientras diga «Sin pago registrado», finanzas todavía no la anota como pagada."
 },
 {
  "clave": "noSeConsigueSolicitud",
  "modulos": [
   "compras"
  ],
  "texto": "Contesta que no se puede conseguir (descontinuado, sin proveedor…). Escribes el motivo, al vendedor le llega un aviso y se lo explica al cliente. Después ya no se puede contestar con precio."
 },
 {
  "clave": "noSeVendeSuelto",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Artículo que solo se usa dentro de un equipo: no se cotiza por separado."
 },
 {
  "clave": "notaEmbarque",
  "modulos": [
   "importaciones"
  ],
  "texto": "Escribe algo que deba saber quien vea el embarque (lo que pidió el agente, un acuerdo con el proveedor) y da Enter. Queda en la historia con tu nombre y la fecha."
 },
 {
  "clave": "notasCotizacion",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Las notas del catálogo se palomean y salen en su orden; abajo escribes las tuyas y Enter. Todas salen al pie de la cotización."
 },
 {
  "clave": "nuevaVersion",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Copia la cotización con el mismo folio y “-v2”, “-v3”… para seguir la misma negociación sin tocar lo que ya se mandó. “Duplicar” en cambio le da un folio nuevo."
 },
 {
  "clave": "nuevaVersionCotizacion",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Una nueva versión sale como borrador con las mismas partidas y el folio con -v2, -v3… Si la actual sigue viva, te pregunta qué pasa con ella: «Ya no vale» la deja rechazada (si ya se había enviado) o cancelada (si no), con «Se reemplazó por la versión…»; deja de agendar seguimientos, no se puede convertir a pedido por error y no cuenta como venta perdida. «Sigue vigente» la deja como está, para cuando el cliente puede escoger cualquiera de las dos."
 },
 {
  "clave": "nuevoCostoPrecios",
  "modulos": [
   "compras"
  ],
  "texto": "Escribe el costo nuevo y Enter: se guarda esa fila con tu nombre y bajas a la siguiente. Con ↑ ↓ te mueves sin guardar y lo escrito queda en amarillo; Esc deshace la fila. Cambiar solo la moneda también cuenta como cambio."
 },
 {
  "clave": "numeroSerie",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "El número que identifica a un equipo fabricado. Lo pone el ERP solo al crear la orden de producción: el código del equipo (medidas y motor) más el siguiente número de su familia. Se usa para la garantía y es el que se revisa al empacarlo para enviarlo."
 },
 {
  "clave": "numeroVentaExterno",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "El número de venta de Mercado Libre (o del sitio web). No se puede repetir dentro del mismo canal, así nadie captura dos veces la misma venta."
 },
 {
  "clave": "ocAtrasada",
  "modulos": [
   "compras"
  ],
  "texto": "Una orden enviada o recibida en parte cuya fecha de entrega ya pasó. Llámale al proveedor o mueve la fecha si ya te dio otra."
 },
 {
  "clave": "ocContratoAduana",
  "modulos": [
   "compras"
  ],
  "texto": "Abre la orden y el contrato de compraventa bilingües que pide el agente aduanal. Sale en órdenes de proveedores de importación o en otra moneda."
 },
 {
  "clave": "ocupacionArea",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Qué tanto de su capacidad tiene ocupada el área esa semana. Con holgura: menos de 85 %. Justa: de 85 a 100 %. Se pasa: más de 100 %, algo se va a atrasar."
 },
 {
  "clave": "opcionesPartidaCotizacion",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Lo que puedes hacer con la partida: ver su ficha de venta, pedir su precio a compras, volver al precio de lista, duplicarla, subirla o bajarla y quitarla."
 },
 {
  "clave": "opEnProceso",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "En proceso: alguna etapa del taller ya empezó."
 },
 {
  "clave": "operacionesVenta",
  "modulos": [
   "analisis"
  ],
  "texto": "Cuántas ventas distintas hubo: cada factura o venta del libro de la hoja y cada pedido del ERP cuentan una vez, tengan las partidas que tengan."
 },
 {
  "clave": "opinarConsejo",
  "modulos": [],
  "texto": "Dile a la IA si este consejo te sirvió. Los consejos de las semanas siguientes lo toman en cuenta. Se contesta una sola vez."
 },
 {
  "clave": "opLiberada",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Liberada: la gerencia ya la pasó al taller, pero ninguna etapa ha empezado."
 },
 {
  "clave": "opPlaneada",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Planeada: la orden existe y se está validando el material. Todavía no entra al taller."
 },
 {
  "clave": "opTerminada",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Terminada: el taller acabó sus etapas y falta marcarla como entregada."
 },
 {
  "clave": "ordenAtrasada",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Ya pasó su fecha compromiso y no está terminada."
 },
 {
  "clave": "ordenDeLaFactura",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "La orden de compra de la que sale esta factura. Con orden, la factura se reparte entre sus partidas según lo que vale cada una: lo que es consumible del taller (discos, puntas, brocas) cuenta como gasto de fabricación; lo que entra al inventario, como material, que ya va en lo vendido; las partidas sin artículo (fletes, servicios) toman la categoría de la factura. Sin orden, la categoría dice en qué se gastó y por eso es obligatoria. Si el folio que anotó almacén al recibir casa con el de la factura, se liga sola. Una orden con su factura ya no sale en «Órdenes de compra» por pagar: lo que se debe está en la factura."
 },
 {
  "clave": "ordenEnEspera",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Una orden detenida sin cancelarla, casi siempre porque el cliente dejó anticipo y no ha regresado. Mientras está en espera no cuenta en la carga del taller ni en los tiempos de entrega que se prometen, no sale atrasada y no se puede trabajar en la terminal. La pone y la reactiva la gerencia de producción desde el detalle de la orden, con su motivo."
 },
 {
  "clave": "ordenesAbiertasProveedor",
  "modulos": [
   "compras"
  ],
  "texto": "Órdenes enviadas o recibidas en parte que todavía esperan mercancía. «Tarde» cuenta las que ya pasaron su fecha de entrega."
 },
 {
  "clave": "ordenesEmbarque",
  "modulos": [
   "importaciones"
  ],
  "texto": "Las órdenes de compra que viajan en este embarque: un BL puede traer varias facturas y un consolidado, varios proveedores. De ellas salen lo que se le debe a cada proveedor, el tope de los pagos y las partidas del costeo."
 },
 {
  "clave": "ordenesEnBorrador",
  "modulos": [
   "compras"
  ],
  "texto": "Órdenes que compras armó pero no ha enviado: el proveedor no las tiene y lo pedido todavía no cuenta como en camino. Ábrela, revisa precios y fechas, y «Enviar al proveedor»."
 },
 {
  "clave": "ordenesEnTallerInicio",
  "modulos": [],
  "texto": "Órdenes de producción que no se han entregado ni cancelado: planeadas, liberadas, en proceso y terminadas por entregar. Se pinta en rojo si alguna ya pasó su fecha compromiso sin terminarse (las que están en espera no cuentan). Clic para abrir el tablero de producción."
 },
 {
  "clave": "ordenesPorVencer",
  "modulos": [],
  "texto": "Órdenes sin entregar cuya fecha compromiso es en 5 días o menos, o ya pasó: hasta 6, la fecha más vieja primero. «N días tarde» ya pasó su compromiso; «en N días» es lo que le queda. Clic en una para abrirla."
 },
 {
  "clave": "ordenesSueltas",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Órdenes del pedido que no están ligadas a una partida. Pasa con los pedidos que vinieron de la hoja: la partida dice algo general («línea de envasado») y cada equipo es una orden. Aquí ves cada equipo con su orden y su avance."
 },
 {
  "clave": "ordenEtapaTaller",
  "modulos": [
   "admin"
  ],
  "texto": "El lugar de la etapa en el recorrido del equipo: va de menor a mayor. Una etapa nueva se agrega al final."
 },
 {
  "clave": "ordenMantenimiento",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "El registro de una falla (correctivo) o de un preventivo que tocó: qué tiene, quién lo reportó, quién la atiende, las refacciones y cuánto tiempo estuvo parada."
 },
 {
  "clave": "ordenPorCorreo",
  "modulos": [
   "compras"
  ],
  "texto": "La manda desde tu Gmail al correo del proveedor, con el PDF de la orden adjunto; antes puedes cambiar a quién, el asunto y el mensaje. Si estaba en borrador, al mandarla queda enviada."
 },
 {
  "clave": "ordenProduccion",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "La orden para fabricar un equipo (o varios iguales). Al crearse copia la lista de materiales del equipo, así un cambio posterior al catálogo no la mueve."
 },
 {
  "clave": "ordenReglaFamilia",
  "modulos": [
   "analisis"
  ],
  "texto": "Si dos reglas atrapan la misma venta, gana la de número más bajo. De entrada es 50."
 },
 {
  "clave": "origenCosto",
  "modulos": [
   "compras"
  ],
  "texto": "De dónde salió el cambio: a mano (aquí o en la ficha), por orden de compra (al recibirla), por cotización (al contestar una solicitud de precio o al crear una orden desde la cotización del proveedor) o importado de la hoja."
 },
 {
  "clave": "origenMejora",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Esta mejora salió de algo que reportó el piso (un problema, una pausa con motivo o una etapa reabierta) o de una falla de máquina. En su ficha está lo que se reportó y la liga a la orden o a la máquina."
 },
 {
  "clave": "origenRequisicion",
  "modulos": [
   "compras"
  ],
  "texto": "Quién la pidió: Producción (faltante de una orden de producción), Reabasto (almacén, por stock mínimo) o Manual. La fecha en rojo es para menos de una semana."
 },
 {
  "clave": "origenSkydropx",
  "modulos": [
   "admin"
  ],
  "texto": "La dirección de la planta de donde salen los paquetes. Se elige de las que ya están dadas de alta en Skydropx, después de «Probar conexión». Sin ella no se puede cotizar ni generar guía."
 },
 {
  "clave": "otraVersionMensajeIA",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Le pide a la IA otro mensaje con los mismos datos. Lo que hayas cambiado a mano en la caja se pierde."
 },
 {
  "clave": "otrosPagosNomina",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Pagos fuera del sueldo agregados como concepto: servicios fuera de planta, apoyos, gratificaciones. Cada uno queda con su motivo y quién lo registró."
 },
 {
  "clave": "pagarePrestamo",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "El documento que firma la persona al recibir el préstamo: dice cuánto se le prestó, el descuento semanal por nómina y que el saldo se descuenta del finiquito si se va. No lleva interés; solo si en las reglas se pone un interés moratorio, el pagaré lo menciona. Imprímelo, que lo firme, guarda el original y anota aquí la fecha de firma."
 },
 {
  "clave": "pagosHechos",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Todo lo que ya se pagó a proveedores, en una lista: lo registrado en el ERP, lo del libro de compras desde 2022 y los pagos de órdenes de compra. Si un pago está en la hoja y también se registró aquí, se cuenta una sola vez. Las órdenes en dólares se suman en pesos con el tipo de cambio de la orden."
 },
 {
  "clave": "pagosOrdenCompra",
  "modulos": [
   "compras"
  ],
  "texto": "Los pagos al proveedor por esta orden: los ve compras y los registra solo finanzas. El saldo es el total menos lo pagado. Si su factura ya está registrada, se paga desde la cuenta del proveedor, no aquí."
 },
 {
  "clave": "pagosProveedorEmbarque",
  "modulos": [
   "importaciones"
  ],
  "texto": "Lo que se le paga al proveedor por cada orden del embarque: anticipo, saldo o pago total, con el tipo de cambio real de cada uno. No deja pagar más de lo que se debe por la orden, contando lo que finanzas ya le pagó. El primer anticipo pagado marca solo la etapa «Anticipo pagado»."
 },
 {
  "clave": "pagosQueVienenImportacion",
  "modulos": [
   "importaciones"
  ],
  "texto": "Cada orden de compra que va en un embarque y todavía tiene saldo con el proveedor: lo pagado, lo que falta y su próximo pago programado. Lo que sigue en producción no tiene fecha hasta que el proveedor avisa que está listo."
 },
 {
  "clave": "panelPersonal",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Todo el personal activo, por su área. En verde, quien está trabajando ahorita (tiene su tiempo abierto en alguna etapa). La gerencia de producción arrastra de aquí a una tarjeta para meter a alguien, y arrastra a alguien de una tarjeta hasta aquí para sacarlo de esa cuadrilla."
 },
 {
  "clave": "pantallasAbiertasErp",
  "modulos": [
   "admin"
  ],
  "texto": "Cuántas veces abrió una pantalla en el periodo y cuántas pantallas distintas. Se cuenta desde el 5 de noviembre de 2026."
 },
 {
  "clave": "pantallasQueMasUsa",
  "modulos": [
   "admin"
  ],
  "texto": "Las 15 pantallas donde más tiempo activo tuvo en el periodo: cuánto tiempo, cuántas veces la abrió, en cuántos días y la última vez."
 },
 {
  "clave": "parametroEquipo",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Una medida del equipo (largo_m, ancho…) de la que dependen algunas cantidades u horas: cantidad = fija + por parámetro × valor. Así la banda de 22 m es la de 20 m con otro largo."
 },
 {
  "clave": "parametrosCopia",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "La medida que tendrá la copia: con ella se recalculan sus cantidades y horas; lo que no cambies queda como en el original. Si el nombre trae la medida («20 m»), se ajusta solo mientras no lo cambies a mano."
 },
 {
  "clave": "paraQuePrestamo",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Qué va a hacer con la herramienta o en qué trabajo la va a usar. Es obligatorio, salvo que se la lleve a un servicio (entonces el servicio dice para qué)."
 },
 {
  "clave": "paraRequisicion",
  "modulos": [
   "compras"
  ],
  "texto": "Para qué es: el folio de la orden de producción que lo necesita, o «stock» si lo pidió el reabasto para reponer existencias."
 },
 {
  "clave": "paraStock",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Orden sin cliente: el equipo se fabrica para tenerlo listo, no para un pedido. Ya no lleva la «S-» de la hoja: es una orden sin pedido. Cuando se vende, la gerencia de producción la asigna al pedido desde Pedidos."
 },
 {
  "clave": "parcialResultados",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Al número le faltan datos: el periodo empieza antes de que el ERP tuviera esa información (el libro de compras con categoría o la caja chica), o tu rol no ve las comisiones de todos."
 },
 {
  "clave": "paretoClientes",
  "modulos": [
   "analisis"
  ],
  "texto": "Clientes ordenados del que más compró al que menos, y qué parte de la venta juntan. El punto marca cuántos clientes hacen el 80 % de la venta."
 },
 {
  "clave": "paretoFallas",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Cada barra es la parte de todas las horas paradas del periodo que se llevó una máquina (las 8 que más, y el resto junto); la línea va sumando. Las que quedan antes de cruzar la línea punteada del 80 % son las pocas que se llevan casi todo el tiempo perdido: ahí conviene atender primero (refacciones, cambio o un preventivo más seguido)."
 },
 {
  "clave": "parosRetrabajo",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Pausas: cuántas veces se detuvo una etapa. Problemas: lo que el piso reportó en la terminal. Reabiertas: etapas que se habían marcado terminadas y se regresaron (retrabajo o error de captura)."
 },
 {
  "clave": "participacionVenta",
  "modulos": [
   "analisis"
  ],
  "texto": "Qué parte de la venta total del periodo es de esa región, familia o cliente."
 },
 {
  "clave": "partidaLibre",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Renglón escrito a mano que no viene del catálogo (flete, instalación, servicio). No tiene precio de lista ni precio mínimo."
 },
 {
  "clave": "partidaOpcional",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Partida que sale en la cotización como opción o alternativa, pero no suma al total ni cuenta para el precio mínimo."
 },
 {
  "clave": "partidasAlConvertir",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Palomea las partidas que entran al pedido. Las opcionales vienen sin palomear porque no suman; si el cliente escogió esa alternativa, palomeala. Lo que no palomees no pasa al pedido."
 },
 {
  "clave": "partidaSinArticulo",
  "modulos": [
   "compras"
  ],
  "texto": "Una partida escrita a mano, sin artículo del catálogo (vienen así de la hoja o de un PDF). Si es material, búscala y elige su artículo: entra al almacén con el costo de la orden, como cualquier otra. Si es un cobro como «Manejo» o un flete, recíbela tal cual: cuenta como recibida y no toca el inventario. Cuando finanzas liga la factura a la orden, una partida sin artículo cuenta con la categoría de la factura; con artículo, como material o consumible del taller."
 },
 {
  "clave": "partidaSinCosto",
  "modulos": [
   "compras"
  ],
  "texto": "Esta partida está en $0: captura el precio que dio el proveedor. Con una partida en $0 la orden no se puede enviar."
 },
 {
  "clave": "partidasOrdenCompra",
  "modulos": [
   "compras"
  ],
  "texto": "Lo que se le pide al proveedor. En borrador, cantidad y costo se editan en su lugar (Enter o salir guarda). Ya enviada, solo se cambia con el lápiz de cada partida y la orden sube de revisión."
 },
 {
  "clave": "partidasPedido",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Lo que se vendió. Mientras el pedido está confirmado, su vendedor o la gerencia agregan, quitan o cambian cantidades; el precio que viene de una cotización solo lo cambia la gerencia. Abajo de la cantidad sale cuánto ya se entregó."
 },
 {
  "clave": "partidasPorSurtir",
  "modulos": [],
  "texto": "Cuántos renglones del material de la orden faltan por entregar al taller, completos o en parte. No cuenta los consumibles del taller cuando esa opción está encendida."
 },
 {
  "clave": "patronReglaFamilia",
  "modulos": [
   "analisis"
  ],
  "texto": "El texto que se busca en la descripción de cada venta de la hoja, en minúsculas y sin acentos. Con | separas opciones: «molino|martillo» atrapa cualquiera de las dos. Al guardar se vuelven a clasificar todas las ventas de la hoja."
 },
 {
  "clave": "pdfCotizacion",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Abre la hoja en otra pestaña para imprimirla o guardarla en PDF. Sacar el PDF no la marca como enviada: para eso es Enviar, que le agenda su seguimiento. Con el freno de seguimientos no sale si la cotización todavía no se envía."
 },
 {
  "clave": "pedidoACompras",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Lo que ya se pidió a compras para esta orden, en una requisición."
 },
 {
  "clave": "pedidoAtrasado",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "La fecha compromiso ya pasó y el pedido todavía no se entrega."
 },
 {
  "clave": "pedidoEstadoCancelado",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Se canceló, con su motivo. Ya no cuenta para comisiones ni para cobranza."
 },
 {
  "clave": "pedidoEstadoConfirmado",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Ya es venta y todavía no entra al taller. Mientras está así, su vendedor o la gerencia pueden ajustar las partidas. Sigue: producción crea sus órdenes o, si no lleva nada que fabricar, se marca listo."
 },
 {
  "clave": "pedidoEstadoEnProduccion",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Ya tiene órdenes en el taller; su avance sale en Producción. Pasa solo a «Listo para entregar» cuando el taller termina todas."
 },
 {
  "clave": "pedidoEstadoEntregado",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Ya salió todo lo del pedido, con su hoja de salida. Si se marcó por error, la gerencia de ventas o dirección reabren la entrega."
 },
 {
  "clave": "pedidoEstadoListo",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Lo que se vende ya está terminado. Sigue entregarlo: qué sale, quién recibe y la hoja de salida firmada."
 },
 {
  "clave": "pedidoHistorico",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Pedido que viene de las hojas. Cuenta para el historial y para las comisiones de su mes, pero no es una cuenta por cobrar del ERP: lo que el cliente debe está en su saldo de arranque. Si sigue en el taller, su avance y su entrega se llevan aquí como cualquier otro."
 },
 {
  "clave": "pedidosAbiertos",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Los que todavía no se entregan: confirmados, en producción y listos para entregar."
 },
 {
  "clave": "pedidosComisionMes",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Los pedidos con fecha de este mes que se le acreditan al vendedor, sin los cancelados. Arriba, lo de maquinaria y otros; abajo, lo de refacciones; sin IVA y en pesos. Si el crédito es compartido, sale qué parte le toca."
 },
 {
  "clave": "pedidoSinCotizacion",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Para las ventas que no salieron de una cotización: Mercado Libre, sitio web o mostrador. Eliges cliente, canal y número de venta; las partidas las agregas después, en el pedido. Con la cuenta de Mercado Libre conectada sus ventas entran solas: no las captures otra vez."
 },
 {
  "clave": "pedidosMercadoLibre",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Ventas de Mercado Libre de los últimos 60 días que no llevan nada que fabricar (componentes, refacciones). Van aparte para no tapar los pedidos del taller, y su envío se lleva en Almacén → Envíos. Si una venta de Mercado Libre lleva un equipo, sale con los demás pedidos."
 },
 {
  "clave": "pedimento",
  "modulos": [
   "importaciones"
  ],
  "texto": "La declaración de la importación ante la aduana, con sus impuestos (IGI, DTA, PRV e IVA). Pagarlo marca la etapa \"pedimento pagado\"."
 },
 {
  "clave": "pendiente",
  "modulos": [],
  "texto": "Algo que una persona le pide a otra, con fecha. Al asignarlo le llega un aviso al responsable; cuando lo marca hecho, le llega un aviso a quien lo pidió."
 },
 {
  "clave": "pendienteDeRevision",
  "modulos": [],
  "texto": "Lo puso la revisión de la madrugada: encontró algo urgente en lo que capturaste. Márcalo hecho cuando lo corrijas (cuenta como «Ya lo corregí»); si no es error, contéstalo en «Por revisar» con «Está bien así» y se cancela sin contar en tu contra."
 },
 {
  "clave": "pendienteEsperandoRespuesta",
  "modulos": [],
  "texto": "Quien tiene el pendiente preguntó algo que necesita para terminarlo y espera la respuesta de quien lo pidió. Mientras tanto, el pendiente no cuenta como vencido ni suma días de retraso a quien lo tiene (no lo detiene él), y a quien lo pidió le sale como «Te preguntaron» o «Por responder» hasta que conteste en la ficha. Todos los que ven el pendiente ven la conversación."
 },
 {
  "clave": "pendientesATiempo",
  "modulos": [],
  "texto": "De tus pendientes con fecha, cuántos cerraste ese día o antes, contando como fallas los que cerraste tarde y los que hoy siguen vencidos. Arriba cuenta lo cerrado en los últimos 30 días; en «Equipo», en el periodo que elijas. Verde de 90 % para arriba, ámbar de 70 % a 89 %, rojo abajo de 70 %; los que no tenían fecha no cuentan."
 },
 {
  "clave": "pendientesCerradosPeriodo",
  "modulos": [],
  "texto": "Pendientes que esta persona marcó hechos en el periodo. No cuenta los cancelados ni los que terminó otra persona de su grupo."
 },
 {
  "clave": "pendientesCorreos",
  "modulos": [
   "importaciones"
  ],
  "texto": "Lo que alguien pidió en los correos y todavía no se contesta o entrega, con quién lo debe. Es para que lo veas; no se guarda como pendiente del ERP."
 },
 {
  "clave": "pendientesDiasCerrar",
  "modulos": [],
  "texto": "En promedio, cuántos días pasan desde que te piden algo hasta que lo marcas hecho, con lo cerrado en el periodo."
 },
 {
  "clave": "pendientesDiasRetraso",
  "modulos": [],
  "texto": "La suma de los días que lleva vencido cada pendiente tuyo que sigue abierto: uno vencido hace 3 días y otro hace 2 son 5 días de retraso. Mide cuánto está esperando la gente por ti; baja a cero al cerrarlos."
 },
 {
  "clave": "pendientesInicio",
  "modulos": [],
  "texto": "Lo que espera algo de ti según tu puesto: lo que la revisión de la madrugada encontró en algo tuyo, seguimientos de cotizaciones, leads sin atender, autorizaciones, ajustes de inventario, compras atrasadas o documentos de embarques, entre otros. Clic en un renglón para ir a donde se atiende. Lo que alguien te pidió con fecha está en Pendientes."
 },
 {
  "clave": "pendientesPidio",
  "modulos": [],
  "texto": "Cuántos pendientes le pidió esta persona a otros en el periodo y cuántos siguen abiertos."
 },
 {
  "clave": "pendientesSemana",
  "modulos": [],
  "texto": "El número grande son tus pendientes vencidos: siguen abiertos y su fecha ya pasó. Abajo, los que vencen de hoy al domingo y cuántos se cerraron la semana pasada."
 },
 {
  "clave": "pendientesTeEsperan",
  "modulos": [],
  "texto": "Cuántas personas te pidieron algo que sigue abierto: es a cuántos detiene tu trabajo mientras no lo cierres. En rojo si alguno ya está vencido."
 },
 {
  "clave": "pendientesVencidosUso",
  "modulos": [
   "admin"
  ],
  "texto": "Sus pendientes que siguen abiertos y ya pasaron su fecha, a hoy. No depende del periodo que escojas."
 },
 {
  "clave": "pendienteVarios",
  "modulos": [],
  "texto": "Un pendiente a varias personas: cada una recibe el suyo. «Basta con que uno lo haga»: al primero que lo termine, a los demás se les cierra solo como «Lo hizo …» y se les avisa; eso no cuenta ni a favor ni en contra de nadie. «Cada quien lo tiene que hacer»: cada uno cierra el suyo, a quien lo pidió le llega «2 de 3» y queda hecho cuando todos terminan. Si lo cancelas, se cancela para todos."
 },
 {
  "clave": "perdidoCotizado",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Lo cotizado que se rechazó, se canceló o venció después de enviarse, o cuya oportunidad se marcó perdida. Se agrupa por el motivo que anotó el vendedor."
 },
 {
  "clave": "periodoAnalisis",
  "modulos": [
   "analisis"
  ],
  "texto": "El periodo se queda al cambiar de pestaña y va en la liga, así que puedes mandarla tal cual. Si es de un año o menos se compara contra el mismo tramo del año anterior; si es más largo, contra el tramo de la misma duración justo antes."
 },
 {
  "clave": "periodoAnioAnterior",
  "modulos": [
   "analisis"
  ],
  "texto": "El año pasado completo, de enero a diciembre, contra el año antes de ese."
 },
 {
  "clave": "periodoDesde2018",
  "modulos": [
   "analisis"
  ],
  "texto": "Toda la historia, del 1 de enero de 2018 a hoy. El libro de ventas empieza en 2018, así que aquí no hay contra qué comparar: el crecimiento sale vacío o «nuevo»."
 },
 {
  "clave": "periodoDoceMeses",
  "modulos": [
   "analisis"
  ],
  "texto": "Los 12 meses que terminan hoy, contra los 12 meses anteriores a esos. Sirve para comparar sin que importe en qué mes del año vas."
 },
 {
  "clave": "periodoEsteAnio",
  "modulos": [
   "analisis"
  ],
  "texto": "Del 1 de enero a hoy, contra el mismo tramo del año pasado."
 },
 {
  "clave": "periodoLoCotizado",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Qué cotizaciones entran: las que empezaron en ese periodo, por la fecha de su primera versión. Lo que les pasó después cuenta aunque haya sido fuera del periodo."
 },
 {
  "clave": "periodoMetricas",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Cuántos días hacia atrás se cuentan, hasta hoy. Lo de ahorita (en proceso, pausadas, órdenes abiertas) no cambia con el periodo."
 },
 {
  "clave": "periodoMetricasAlmacen",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Cuántos días hacia atrás, contando hoy, se miden los números de «Movimiento del periodo». La salud del inventario no cambia con esto: es una foto de hoy."
 },
 {
  "clave": "periodoPendientesEquipo",
  "modulos": [],
  "texto": "Cuántos días hacia atrás se miden lo cerrado, lo hecho a tiempo, los días para cerrar y lo que pidió cada quien. Abiertos, vencidos, días de retraso, a cuántos detiene y lo que tiene por responder son de hoy, sin importar el periodo."
 },
 {
  "clave": "periodoRango",
  "modulos": [
   "analisis"
  ],
  "texto": "Tú eliges desde y hasta; se aplica al salir de cada fecha o con Enter. Si dura un año o menos se compara con las mismas fechas del año anterior; si es más largo, con un tramo igual de largo justo antes."
 },
 {
  "clave": "periodoUsoErp",
  "modulos": [
   "admin"
  ],
  "texto": "Los últimos 7, 30 o 90 días, contando hoy. Todo se compara contra los días justo anteriores, del mismo largo."
 },
 {
  "clave": "periodoVacaciones",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Los días que da la ley al cumplir cada año en la empresa. Empiezan en ese aniversario y vencen 18 meses después: 6 meses para darlas (art. 81 LFT) y un año más antes de que prescriban (art. 516). Lo que no se tomó para entonces se pierde. Cada vacación se carga al periodo más viejo que siga vigente."
 },
 {
  "clave": "permisosRolModulo",
  "modulos": [
   "admin"
  ],
  "texto": "La tabla de rol × módulo: cada cruce dice el nivel de ese rol en ese módulo. Solo dirección la cambia, y dirección siempre tiene nivel 3 en todo. Cada quien ve el cambio al recargar el ERP."
 },
 {
  "clave": "personalActivoRrhh",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Personas dadas de alta que no tienen baja. Abajo, cuántas tienen área de piso y cuántos años llevan en promedio en la empresa."
 },
 {
  "clave": "personalInicio",
  "modulos": [],
  "texto": "Cuántas personas están activas en Recursos Humanos (sin las bajas). Abajo, las ausentes hoy: vacaciones, permiso, falta o incapacidad aprobada que cae hoy. Clic para ver la lista de personal."
 },
 {
  "clave": "personasActivasErp",
  "modulos": [
   "admin"
  ],
  "texto": "De las personas con cuenta activa (sin la TV ni la tablet del taller), cuántas hicieron algo en el periodo: abrir una pantalla, registrar un cambio o preguntarle a la IA. Si alguien no lo usó, dale clic para ver quién."
 },
 {
  "clave": "personasCapacidad",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "La gente activa del área que entra a cuadrillas. Con ella se calcula la capacidad automática."
 },
 {
  "clave": "personasDelPendiente",
  "modulos": [],
  "texto": "A quién se lo pediste. En verde, quien ya lo hizo; en ámbar con signo de pregunta, quien te preguntó algo y espera tu respuesta. Clic en un nombre para abrir su ficha."
 },
 {
  "clave": "pesoEstadoTresAnios",
  "modulos": [
   "analisis"
  ],
  "texto": "Qué parte de la venta de los 3 años completos anteriores fue de ese estado. Con eso se reparte la meta sugerida."
 },
 {
  "clave": "pesoFamiliaEstado",
  "modulos": [
   "analisis"
  ],
  "texto": "La barra es qué parte de la venta del estado fue de esa familia; la rayita, lo que pesa en todo el país. Si la barra pasa la rayita, ahí se vende más de esa familia que en el promedio."
 },
 {
  "clave": "pesoIndicador",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Cuántos puntos de los 100 vale este indicador. Entre todos deben sumar 100 exactos para poder guardar."
 },
 {
  "clave": "pestanaCapacidadTaller",
  "modulos": [
   "analisis"
  ],
  "texto": "Si se promete más de lo que el taller saca: lo prometido para cada mes contra lo que cabe, y lo que entra contra lo que sale."
 },
 {
  "clave": "pestanaClientesAnalisis",
  "modulos": [
   "analisis"
  ],
  "texto": "Cuánto depende la venta de pocos clientes, quiénes regresan y a quiénes se está perdiendo, con la lista de cada grupo y su vendedor."
 },
 {
  "clave": "pestanaConfigAlmacenes",
  "modulos": [
   "admin"
  ],
  "texto": "Los almacenes, cuáles cuentan para planta y los consumibles del taller."
 },
 {
  "clave": "pestanaConfigEmpresa",
  "modulos": [
   "admin"
  ],
  "texto": "Datos fiscales y comerciales, IVA, fecha de arranque, tema, minutos para deshacer errores y la semana laboral con sus descansos."
 },
 {
  "clave": "pestanaConfigIntegraciones",
  "modulos": [
   "admin"
  ],
  "texto": "Mercado Libre (conectar la cuenta, quién la atiende y a nombre de quién quedan las ventas) y Skydropx (guías de paquetería)."
 },
 {
  "clave": "pestanaConfigTaller",
  "modulos": [
   "admin"
  ],
  "texto": "Las etapas del taller (orden, color, capacidad por semana y cuáles van en paralelo) y el aprovechamiento con que se calcula la capacidad automática."
 },
 {
  "clave": "pestanaConfigTipoCambio",
  "modulos": [
   "admin"
  ],
  "texto": "El dólar y el euro del día, y su historial."
 },
 {
  "clave": "pestanaConfigVentas",
  "modulos": [
   "admin"
  ],
  "texto": "Envío gratis, tope de meses, la regla de cartera, a quién le llegan los leads, los textos de la cotización, los planes de meses y la comisión de cada canal."
 },
 {
  "clave": "pestanaDineroEmbarque",
  "modulos": [
   "importaciones"
  ],
  "texto": "Los pagos al proveedor con su tipo de cambio real, los gastos, el pedimento y lo que nos tienen que regresar. Solo aparece si tu puesto ve el dinero de importaciones."
 },
 {
  "clave": "pestanaDineroImportaciones",
  "modulos": [
   "importaciones"
  ],
  "texto": "Lo que se les debe a los proveedores del extranjero, los pagos que vienen, lo que nos tienen que regresar y el dinero de cada embarque. Solo aparece si tu puesto ve el dinero de importaciones."
 },
 {
  "clave": "pestanaEntregas",
  "modulos": [
   "analisis"
  ],
  "texto": "Si cumplimos las fechas prometidas: pedidos a tiempo, días de atraso y cada orden del taller con la fecha a la que sale de verdad."
 },
 {
  "clave": "pestanaHistorialMovimientos",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Todos los movimientos de inventario, con quién, cuándo y para qué. Filtra por tipo, almacén, persona y fechas (abre con los últimos 30 días) y bájalo a Excel con el botón de CSV."
 },
 {
  "clave": "pestanaLosQuePedi",
  "modulos": [],
  "texto": "Lo que tú pediste a otros y sigue abierto. Si se lo pediste a varias personas sale una sola vez, con quién ya terminó. Con la X lo cancelas."
 },
 {
  "clave": "pestanaMapaVentas",
  "modulos": [
   "analisis"
  ],
  "texto": "Dónde se vende y dónde se dejó de vender: el mapa por estado y municipio, el ranking y las zonas que se enfriaron."
 },
 {
  "clave": "pestanaMeTocan",
  "modulos": [],
  "texto": "Lo que te pidieron a ti y sigue abierto, lo que vence primero arriba. Dale clic al círculo para marcarlo hecho, o al título para abrir su ficha y preguntar lo que te falte."
 },
 {
  "clave": "pestanaMovimientoPeriodo",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Lo que pasó en el almacén en el periodo que eliges (de 30 días a 12 meses): surtido a órdenes, lo que salió fuera de lista, consumibles por persona, ajustes y conteos."
 },
 {
  "clave": "pestanaPendientesCerrados",
  "modulos": [],
  "texto": "Lo que ya se cerró, tuyo o que tú pediste: hecho, cancelado o que hizo otra persona del grupo. Si lo cerraste tú hace unos minutos, aquí lo puedes reabrir."
 },
 {
  "clave": "pestanaPlaneacion",
  "modulos": [
   "analisis"
  ],
  "texto": "La meta del año repartida por mes y por estado contra lo vendido, y a qué ritmo hay que vender lo que falta. El año se elige con las flechas."
 },
 {
  "clave": "pestanaProductoRegion",
  "modulos": [
   "analisis"
  ],
  "texto": "Qué familia de producto se vende en cada estado, y las reglas que clasifican las ventas de la hoja."
 },
 {
  "clave": "pestanaRegistrarMovimiento",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Para registrar una salida (consumo del taller o venta), una devolución o un traspaso entre almacenes. Lo que llega de compras entra al recibir la orden de compra, y lo que va a una orden de producción sale al surtirla desde la orden."
 },
 {
  "clave": "pestanaTendencias",
  "modulos": [
   "analisis"
  ],
  "texto": "La venta mes a mes desde 2018: estacionalidad, crecimiento y qué familias pesan cada año. No usa el periodo: siempre es toda la historia."
 },
 {
  "clave": "pestanaUbicacionesRevisar",
  "modulos": [
   "analisis"
  ],
  "texto": "Ciudades y estados de clientes que no se reconocieron y por eso no salen en el mapa. Lo que dirección corrige aquí se queda para los clientes que vengan después."
 },
 {
  "clave": "pestanaUsuariosLista",
  "modulos": [
   "admin"
  ],
  "texto": "Todas las cuentas del ERP: con qué roles entra cada quien y si su cuenta está activa. Dale clic a alguien para darle o quitarle roles, o para desactivarlo."
 },
 {
  "clave": "pestanaVacacionesFicha",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Su saldo de vacaciones, cada periodo (cuánto le tocó, usó y le queda, y cuándo vence) y todo lo que se le ha registrado: vacaciones, permisos, faltas, incapacidades, retardos y horas extra."
 },
 {
  "clave": "piezasPorVentaML",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Cuántas piezas del artículo salen en cada venta de esa publicación. Una publicación de «24 cangilones» lleva 24: una venta entra al pedido como 24 cangilones al precio de cada uno, y descuenta 24 del almacén. Puede ser fracción cuando cada venta es una parte de lo que el catálogo cuenta: si la publicación vende 1 juego de grapas y la clave es una caja de 4 juegos, lleva 0.25."
 },
 {
  "clave": "piezasSinCosto",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Componentes dentro de la lista, en cualquier nivel, que no tienen costo capturado. Cuentan como $0: el costo y el precio del equipo salen más bajos de lo real sin avisar."
 },
 {
  "clave": "planComision",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "El plan de comisión del vendedor: su porcentaje, sus escalones de bono y con qué fecha cuenta cada venta. Lo asigna dirección; el detalle está abajo, en «Cómo se calcula»."
 },
 {
  "clave": "planoEstado",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Vigente: la revisión con la que se fabrica. Por aprobar: un borrador que todavía no sustituye al vigente. Anteriores: revisiones que ya se reemplazaron."
 },
 {
  "clave": "planosArticulo",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Los planos y archivos técnicos del artículo (plano, corte DXF, programa de plasma, modelo 3D…), cada uno con su folio y su revisión. El archivo vive en Drive; aquí queda cuál es el vigente, qué cambió y quién lo aprobó. Los da de alta y los aprueba ingeniería."
 },
 {
  "clave": "planoSinVigente",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Equipos con órdenes de producción abiertas que no tienen plano vigente ligado en el ERP: el taller trabaja con lo que encuentra en Drive."
 },
 {
  "clave": "planPreventivo",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "El mantenimiento que le toca a una máquina por fecha, por horas de uso o lo que pase primero. La fecha puede ser cada tantos días, un día de la semana del mes (el primer lunes, el último viernes) o un día fijo del mes (el 15), cada uno o cada varios meses. Su orden se genera sola: por fecha, unos días antes de vencer; por horas, al llegar a ellas. Si cambias el calendario de un plan, la orden que ya salió y nadie ha tocado se mueve a la fecha nueva, o se cancela y vuelve a salir cuando toque."
 },
 {
  "clave": "planTaller",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "El plan lo calcula el ERP solo, día por día con el horario del taller: los días que no se trabaja se los salta y un día de tiempo extra sí cuenta. Cada área trabaja hasta lo que da ese día (su parte de las horas por semana) y cada etapa avanza a lo que da su cuadrilla: las horas de la jornada por persona (sin cuadrilla cuenta 2 personas). Una etapa empieza al día siguiente de que terminan las anteriores de la misma orden, salvo las que van en paralelo (Torno), que arrancan sin esperar; lo que ya está en proceso o pausado sigue desde hoy. Va primero lo que ya se trabaja, luego la fila que acomoda la gerencia, luego lo urgente y la fecha compromiso. De una etapa empezada falta lo que el piso reportó (si va a ¾, falta ¼); si nadie lo ha reportado, lo estimado menos las horas hombre marcadas en la terminal (al menos 15 %). Entran las órdenes planeadas, liberadas y en proceso; las que están en espera, no. Se recalcula solo con cada cambio del taller. En la ficha de un pedido, ventas ve solo las fechas; las horas y la cuadrilla de cada etapa son de la planta."
 },
 {
  "clave": "plantillaPuesto",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Lo que se le pide a un puesto: sus indicadores, el peso de cada uno (siempre suman 100) y la regla. Cuando cambian los objetivos se crea una versión nueva desde un mes; los meses ya calificados no cambian."
 },
 {
  "clave": "plazoSolicitud",
  "modulos": [
   "compras"
  ],
  "texto": "Cuánto tiempo tiene compras para contestar: 10 horas hábiles (un día de planta), o 4 si quien la pidió la marcó urgente porque el cliente está esperando. Solo corre en horario de la planta: una solicitud del domingo empieza a contar el lunes."
 },
 {
  "clave": "politicaPrecio",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "La regla de precio de un tipo de equipo: utilidad, recargos, medida especial, redondeo y descuento máximo. Cada categoría con política propia la usa; lo que no tiene categoría usa la de por defecto."
 },
 {
  "clave": "porAlmacenDetalle",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Cuánto hay de este artículo en cada almacén, incluido el Full de Mercado Libre. En rojo, negativo: hay que contarlo y pedir un ajuste."
 },
 {
  "clave": "porCobrar",
  "modulos": [],
  "texto": "Lo que los clientes nos deben, en pesos: lo de sus pedidos (total con IVA menos los cobros registrados) más lo que ya debían en la hoja el día que arrancó el ERP, menos lo que han pagado de eso."
 },
 {
  "clave": "porContestarSolicitud",
  "modulos": [
   "compras"
  ],
  "texto": "Las que siguen abiertas: las que nadie ha tomado más las que alguien ya está cotizando. Abajo, cuántas no tiene nadie todavía."
 },
 {
  "clave": "porEntregarAlmacenServicio",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Insumos de servicios y refacciones de mantenimiento que almacén todavía no entrega, también los que se pidieron a compras; lo más viejo arriba. «Hay» es lo que hay en planta de ese artículo."
 },
 {
  "clave": "porPagar",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Lo que debemos a proveedores, en pesos: las facturas que siguen sin pagar (las de la hoja y las registradas aquí) y las órdenes de compra recibidas con saldo que todavía no tienen su factura registrada (con factura, cuenta la factura). Si no llevas finanzas, solo ves las órdenes."
 },
 {
  "clave": "porPagarOrden",
  "modulos": [
   "compras"
  ],
  "texto": "Total de la orden menos los pagos que ha registrado finanzas. «Sin precio» = la orden está en $0 porque a sus partidas les falta el costo (pasa con las que vinieron de la hoja con partidas escritas a mano): ponle precio antes de recibirla."
 },
 {
  "clave": "porPagarProveedores",
  "modulos": [
   "importaciones"
  ],
  "texto": "Lo que falta pagar a proveedores del extranjero de las órdenes que van en embarques. Los pesos son aproximados al tipo de cambio de hoy."
 },
 {
  "clave": "porRecibirOrdenes",
  "modulos": [
   "compras"
  ],
  "texto": "Órdenes enviadas o recibidas en parte que todavía esperan mercancía. Si ves importes, abajo dice cuánto dinero viene en camino: lo que falta por llegar, en pesos."
 },
 {
  "clave": "porRecuperar",
  "modulos": [
   "importaciones"
  ],
  "texto": "Dinero nuestro que alguien tiene que regresar: el saldo a favor de la cuenta de gastos con el agente y la garantía del contenedor. Si no se dice otra fecha, se espera a los 15 días el saldo y a los 30 la garantía. Cuando te lo regresen, márcalo con «Recuperado»: si pasa su fecha sin marcarse, a importaciones le llega el aviso cada día, y el embarque no se puede cerrar mientras haya algo sin marcar."
 },
 {
  "clave": "porSurtirAlmacen",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Las órdenes con material pendiente de entregar al taller, en el orden en que el taller las va a trabajar según el plan del taller. «Empieza» es el día en que el plan dice que arranca su siguiente etapa: sirve para tener el material listo antes de que vengan por él. «Venía de la hoja» es una orden que ya existía antes del ERP y puede tener material ya entregado: regístralo con «Ya se había entregado con la hoja»."
 },
 {
  "clave": "precioEntreCosto",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Cuántos pesos de precio salen por cada peso de costo, antes del redondeo. Sirve para comparar equipos de un vistazo."
 },
 {
  "clave": "precioFijo",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Precio capturado a mano: manda sobre la fórmula de su política y no se mueve cuando cambia el costo."
 },
 {
  "clave": "precioIgualHoja",
  "modulos": [
   "admin"
  ],
  "texto": "Al importar, cuántos precios de equipo que calcula el ERP salieron idénticos a los de la hoja «Nuevo Costeo». Si alguno sale distinto, revísalo antes de cotizar ese equipo."
 },
 {
  "clave": "precioLista",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "El precio oficial del catálogo, en pesos y sin IVA. Al agregar una partida se llena solo y se convierte a la moneda de la cotización (y con IVA si la cotizas con IVA incluido)."
 },
 {
  "clave": "precioListaCatalogo",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "El precio oficial de cada artículo, en pesos y sin IVA: el que se da por teléfono. Descuentos, fletes y condiciones de pago los ve el vendedor con el cliente."
 },
 {
  "clave": "precioListaEstimadoSolicitud",
  "modulos": [
   "compras"
  ],
  "texto": "Cómo quedará el precio de lista con el costo que escribes, con la misma regla del catálogo. Solo lo ves si tu rol también ve precios de venta. «Sin política de precio»: ese artículo todavía no tiene regla para calcular su precio."
 },
 {
  "clave": "precioMinimo",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Lo más bajo a lo que puedes dejar una pieza del catálogo sin pedir permiso: el precio de lista menos el descuento máximo autorizado para ese artículo. Se compara con el precio ya con todos los descuentos, en pesos y sin IVA."
 },
 {
  "clave": "preciosQueSeMovieronTablero",
  "modulos": [],
  "texto": "Equipos cuyo precio de lista de hoy es distinto al que tenían hace 30 días: los 6 que más cambiaron. Ámbar si subió, verde si bajó. Clic para abrir el equipo."
 },
 {
  "clave": "precioSugeridoML",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "El precio que debería tener la publicación para que llegue completo el precio de lista: el precio de lista con IVA por las piezas que lleva cada venta, más el envío que Mercado Libre le cobra a esa publicación, y encima la comisión de su tipo. Mercado Libre tiene dos tipos: clásica (cobra menos) y premium (cobra más y deja pagar a meses sin intereses), así que cada publicación tiene dos sugeridos; se compara contra el de su tipo y abajo ves el del otro. Abajo de $299 el envío lo paga el comprador y en su lugar entra la cuota fija por venta. Si ML muestra otro precio, el tablero lo marca."
 },
 {
  "clave": "preguntasAnterioresML",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Lo que el mismo comprador ya había preguntado en esa publicación, con lo que se le contestó, en orden. Muchas preguntas siguen a otra («¿y en 6 pulgadas?»): así contestas sabiendo de qué venía la plática, aunque la primera se haya contestado antes de que existiera el ERP o la haya contestado otra persona."
 },
 {
  "clave": "preguntaSinPublicacion",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Una pregunta de una publicación que está pausada o cerrada en Mercado Libre. Mercado Libre ya no deja contestarla, así que no sale por contestar ni cuenta en «Preguntas sin contestar». Si la publicación se vuelve a activar, la pregunta regresa sola."
 },
 {
  "clave": "prestamoNomina",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Dinero adelantado que se descuenta en la prenómina con una cantidad fija cada semana, desde la semana que elijas, hasta liquidarlo (la última puede ser menor). Lo autoriza alguien que no es quien lo recibe. Al registrarlo sale su pagaré para firmar. Si la persona se da de baja debiendo, el saldo completo se descuenta en su última semana (el finiquito)."
 },
 {
  "clave": "preventivoVsCorrectivo",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "De las horas que mantenimiento dedicó a órdenes cerradas en el periodo, qué parte fue preventivo. La meta es que el preventivo sea la mayor parte (60 % o más) y que con el tiempo las fallas bajen."
 },
 {
  "clave": "primaVacacional",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Lo que se paga además del sueldo por los días de vacaciones de la semana: un porcentaje del salario de esos días (la ley pide al menos 25 %)."
 },
 {
  "clave": "prioridadOrden",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Urgente, normal o baja. Las urgentes y las atrasadas van arriba en cada columna. Solo la gerencia la cambia."
 },
 {
  "clave": "prioridadServicio",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Para cuándo lo quiere el cliente y qué tan urgente es: urgente (equipo parado), normal o puede esperar. Al programarlo, el día que se propone es esa fecha si todavía no pasa."
 },
 {
  "clave": "probabilidadOportunidad",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Qué tan seguro ves el cierre, de 0 a 100 %. Lo pones tú como referencia; el ERP no lo calcula."
 },
 {
  "clave": "problemasSinMejora",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Lo que el piso reportó en los últimos 30 días y todavía no tiene mejora: los problemas de la terminal, las pausas con motivo, las etapas reabiertas y las fallas de máquinas. «Volverla mejora» la propone con lo que se reportó; cada problema da una sola mejora."
 },
 {
  "clave": "productosEstado",
  "modulos": [
   "analisis"
  ],
  "texto": "Los 10 textos de venta que más dinero juntaron en el estado, sumando los que se escriben igual (sin importar mayúsculas ni acentos), con cuántas veces se vendieron."
 },
 {
  "clave": "programadoTreintaDiasImportacion",
  "modulos": [
   "importaciones"
  ],
  "texto": "La suma del siguiente pago programado de cada orden con fecha en los próximos 30 días. Incluye los que ya pasaron de su fecha y siguen sin registrarse como pagados."
 },
 {
  "clave": "promedioAprobado",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "El promedio del resultado de las evaluaciones ya aprobadas de este mes. Las que siguen en camino no cuentan."
 },
 {
  "clave": "promesaEnRiesgo",
  "modulos": [
   "analisis"
  ],
  "texto": "Una orden abierta que, con la fila del taller, sale después de su fecha compromiso. La fila va por fecha compromiso: cada orden sale cuando su etapa más cargada acaba lo prometido antes que ella y lo suyo. Las órdenes en espera no cuentan. Avisa al cliente a tiempo o mueve prioridades."
 },
 {
  "clave": "promesasTodas",
  "modulos": [
   "analisis"
  ],
  "texto": "Todas las órdenes abiertas con fecha compromiso, también las que van con holgura, de la más atrasada a la más holgada."
 },
 {
  "clave": "prometidoVsCapacidad",
  "modulos": [
   "analisis"
  ],
  "texto": "Barra: el trabajo de las órdenes que se prometieron para ese mes, en semanas de la etapa más cargada. Línea: las semanas hábiles que tiene el mes (en el actual, las que quedan). Si la barra pasa la línea, ese mes ya se prometió más de lo que cabe. Las órdenes en espera no cuentan."
 },
 {
  "clave": "propuestaCorreos",
  "modulos": [
   "importaciones"
  ],
  "texto": "Lo que la IA encontró al leer todos los correos del embarque: fechas de etapas que ya pasaron, ETA, datos y documentos que llegaron, cada uno con el correo de donde salió. Es una propuesta: nada cambia hasta que la revisas y la aplicas."
 },
 {
  "clave": "proveedorActivo",
  "modulos": [
   "compras"
  ],
  "texto": "Desactivado, ya no aparece en los buscadores de proveedor (órdenes, solicitudes de precio); sus órdenes y su historial se quedan. Lo encuentras en el filtro «Inactivos»."
 },
 {
  "clave": "proveedorFiltroPrecios",
  "modulos": [
   "compras"
  ],
  "texto": "Deja solo los artículos de ese proveedor (el de su costo vigente o, si el costo no lo dice, su proveedor de siempre), para pasar su lista de precios completa de una vez."
 },
 {
  "clave": "proveedorImportacion",
  "modulos": [
   "compras"
  ],
  "texto": "Proveedor del extranjero (importación). En sus órdenes aparece «OC y contrato para aduana», la versión que pide el agente aduanal."
 },
 {
  "clave": "proximaTarea",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "La tarea con fecha más cercana de esa oportunidad (una llamada, una visita…). En rojo si ya venció."
 },
 {
  "clave": "proximoAniversario",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Cuándo cumple otro año en la empresa y cuántos días de vacaciones le tocarán a partir de esa fecha."
 },
 {
  "clave": "proximoPagoImportacion",
  "modulos": [
   "importaciones"
  ],
  "texto": "El siguiente pago programado a ese proveedor por esa orden, con su monto. En rojo si la fecha ya pasó y no se ha registrado como pagado."
 },
 {
  "clave": "proyeccionCierre",
  "modulos": [],
  "texto": "Cuánto cerraría el año si seguimos al mismo ritmo, con la estacionalidad del año pasado: si vamos 20 % arriba a la misma fecha, cierra 20 % arriba de lo que cerró el año pasado."
 },
 {
  "clave": "pruebaReglaFamilia",
  "modulos": [
   "analisis"
  ],
  "texto": "Lo que haría la regla antes de guardarla: a cuántas ventas de la hoja les pega, cuántas estaban sin clasificar y, ya con familia elegida, cuántas quedarían en otra. Si una regla de número más bajo ya atrapa alguna, esa no cambia."
 },
 {
  "clave": "publicacionAjenaML",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Una publicación de la misma cuenta de Mercado Libre que no es de Hegamex (otra tienda vende ahí, como el extracto de café). Al marcarla, sus ventas que ya habían entrado se cancelan en el ERP y se les quita el cobro, porque ese dinero no es de Hegamex, y sus ventas siguientes ya no entran. Si ya se empacó o salió, no te deja: revísala a mano. «Sí es nuestra» la regresa a «Por ligar»."
 },
 {
  "clave": "publicacionLigada",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Una publicación de Mercado Libre que el ERP ya sabe qué artículo es y cuántas piezas trae cada venta. Si se ligó mal (otro artículo, o es un paquete y se ligó como pieza suelta), dale «Corregir»: las ventas abiertas que todavía no tienen guía se rehacen. «Desligar» la regresa a «Por ligar»."
 },
 {
  "clave": "publicacionPorLigar",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Una publicación de Mercado Libre que se vendió y el ERP no sabe qué artículo es (no tiene SKU, o su SKU no es una clave del catálogo). Su envío se pide igual, para que almacén vea el paquete en cuanto Mercado Libre imprime la guía, pero la caja no se cierra hasta que alguien diga qué artículo es: ventas en «Por ligar» o almacén con «Ligar artículo» en el envío. Se liga una sola vez: desde ese momento sus ventas entran con su artículo. Si Mercado Libre se lleva el paquete antes, el inventario se descuenta al ligarla. Para no tener que ligar, pon la clave del ERP como SKU en la publicación."
 },
 {
  "clave": "puePpd",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Lo que dice la factura sobre cómo se paga. PUE (pago en una sola exhibición) = de contado: ya se pagó o se paga ese día. PPD (pago en parcialidades o diferido) = a crédito: se paga después."
 },
 {
  "clave": "pulirRedaccion",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "La IA revisa la descripción que sale en las cotizaciones: corrige ortografía, acentos, puntuación y redacción, y la deja en viñetas si es una lista. No cambia medidas, marcas ni materiales: si algo le parece un error de dato, te lo señala aparte. No guarda nada solo: ves cómo está y la propuesta, la puedes retocar, y tú decides si la usas. Cuenta como una consulta del asistente."
 },
 {
  "clave": "puntoReorden",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Cuándo pedir: la demanda de los días que tarda en llegar (demanda ÷ días hábiles del mes × días de entrega) más el stock de seguridad. Si el disponible queda abajo, toca pedir."
 },
 {
  "clave": "quePasoCotizacion",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Lo último que anotó el vendedor en «¿Qué pasó?» de esa venta. Si no hay nota, el motivo con que se rechazó o se perdió."
 },
 {
  "clave": "quienCambioQue",
  "modulos": [
   "compras"
  ],
  "texto": "Cada alta o cambio del proveedor queda registrado con el nombre de quien lo hizo, la fecha y qué datos cambió. Solo dirección y sistemas ven esta lista."
 },
 {
  "clave": "quienCapturoMovimiento",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Quién lo registró en el ERP. Lo pone el servidor: no se puede capturar a nombre de otra persona. No es quien se llevó el material; eso va en «Recibió»."
 },
 {
  "clave": "quienComproMas",
  "modulos": [],
  "texto": "Los 3 clientes que más compraron la semana pasada, con IVA y en pesos, de pedidos no cancelados. Si eres vendedor, solo cuentan tus clientes."
 },
 {
  "clave": "quienDebe",
  "modulos": [
   "importaciones"
  ],
  "texto": "Quién tiene que mover el siguiente paso o mandar el documento: proveedor, agente aduanal, naviera, forwarder o transportista. \"Nos toca\" quiere decir que es nuestro."
 },
 {
  "clave": "quienRecibe",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "La persona del taller que se lleva el material. Se elige de la gente de piso (o se escribe el nombre) y queda en la historia de la orden y en la salida del inventario: así se sabe qué se entregó y a quién. Si das solo una parte, escribe lo que sale; lo demás queda por surtir y la siguiente vez solo aparece eso."
 },
 {
  "clave": "quienRegistra",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Cuántos movimientos registró cada persona en el ERP en el periodo, por tipo. Es quién lo capturó, no quién se lo llevó."
 },
 {
  "clave": "quitarDocumentoAlta",
  "modulos": [
   "importaciones"
  ],
  "texto": "Quita el documento del alta: lo que ya llenó se queda en el formulario, pero el archivo ya no se guarda."
 },
 {
  "clave": "quitarEtapaEmbarque",
  "modulos": [
   "importaciones"
  ],
  "texto": "Borra una etapa que se registró por error (por ejemplo, cerraste un embarque que no era). Pide el motivo y en la historia queda una nota con la fecha que tenía, quién la quitó y por qué. La cuenta de gastos no se quita mientras el embarque esté cerrado: quita primero «Cerrado»."
 },
 {
  "clave": "quitarLineasLista",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Quita la línea (o las marcadas) de la lista de materiales. Desde el aviso que sale lo puedes deshacer."
 },
 {
  "clave": "quitarPartidaOrden",
  "modulos": [
   "compras"
  ],
  "texto": "Quita la partida del borrador. Si venía de una requisición, esa partida regresa a pendiente."
 },
 {
  "clave": "quitarPartidaPedido",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Quita la partida del pedido y los totales se recalculan. Solo mientras el pedido está confirmado."
 },
 {
  "clave": "reabrirEntrega",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Deshace la última entrega: lo que salió regresa a las partidas y al inventario, los equipos vuelven a terminados y el pedido a como estaba. Quien marcó la entrega la deshace en los primeros 15 minutos con «Deshacer»; después, solo la gerencia de ventas o dirección, con el motivo."
 },
 {
  "clave": "reabrirEtapa",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Regresa una etapa marcada «Terminada» por error. Queda pausada, con su hora de inicio, y el taller la reanuda en la terminal eligiendo quién la trabaja. Quien la terminó la deshace con «Deshacer» en los primeros 15 minutos; después, la reabre la gerencia de producción desde el detalle de la orden, escribiendo por qué. Si era la última etapa, la orden deja de estar terminada y su pedido de estar listo. Queda en la historia de la orden."
 },
 {
  "clave": "reabrirPendiente",
  "modulos": [],
  "texto": "Regresa a abierto un pendiente que cerraste (cancelado o hecho) hace poco: 15 minutos de inicio, o los que fije dirección en Configuración (en 0 se apaga). Solo lo puede hacer quien lo cerró; en su conversación queda quién lo reabrió y por qué."
 },
 {
  "clave": "recargosCosto",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Porcentajes que se suman al costo antes de calcular el precio: mermas, luz, administración…"
 },
 {
  "clave": "recargosPrecio",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Porcentajes que se apartan del precio de venta: comisiones, garantía, mercadotecnia… Se cobran sobre el precio, no sobre el costo."
 },
 {
  "clave": "recepcionEquipo",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Cuando un equipo llega a reparación se reciben primero fotos de cómo llegó (golpes, piezas que faltan, placa). Sin recepción la reparación no empieza."
 },
 {
  "clave": "recepcionesOrden",
  "modulos": [
   "compras"
  ],
  "texto": "Cada entrada al almacén de esta orden: cuándo, qué, cuánto, a qué almacén y quién, con la factura si se anotó. Las partidas sin artículo no salen aquí porque no entran al inventario."
 },
 {
  "clave": "recibirOrden",
  "modulos": [
   "compras"
  ],
  "texto": "Almacén captura lo que de verdad llegó, a qué almacén y con qué factura; lo que falte se queda pendiente. No deja que lo recibido pase de 10 % arriba de lo pedido. Con la casilla marcada, el costo de la orden pasa a ser el costo vigente del artículo."
 },
 {
  "clave": "recienCapturados",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Los pagos que alguien registró en el ERP en los últimos 7 días, sin importar la fecha del pago. Sirve para revisar lo que se acaba de capturar: si alguien registra hoy un pago de septiembre, en «Este mes» no sale porque la lista va por la fecha del pago. Los de la hoja no tienen fecha de captura y aquí no salen."
 },
 {
  "clave": "reclamoML",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Un reclamo, devolución o cancelación de una venta de Mercado Libre que sigue abierto. Responderlo antes de la fecha límite y resolverlo a favor del comprador cuando procede es lo que cuida la reputación. Aquí no salen montos; el detalle lo atiende almacén en Devoluciones y reclamos."
 },
 {
  "clave": "recoleccion",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "El día que la paquetería o el cliente pasa por el envío. En ámbar si es hoy o ya pasó y sigue abierto."
 },
 {
  "clave": "recordarClavesProveedor",
  "modulos": [
   "compras"
  ],
  "texto": "Guarda con qué clave llama este proveedor a cada artículo. La próxima cotización suya llega con esas partidas ya emparejadas («Ya la conocemos»)."
 },
 {
  "clave": "redactarMensajeCliente",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "La IA escribe un WhatsApp o un correo para este cliente con su historial de compras y el motivo de la tarjeta. No se manda solo: lo revisas, lo cambias si quieres y lo abres en WhatsApp o en tu correo. Sin la IA conectada sale una plantilla."
 },
 {
  "clave": "redondearArriba",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Si está marcado, la cantidad sube a piezas enteras (2.3 rodillos se vuelven 3). Sirve para lo que no se compra en fracciones."
 },
 {
  "clave": "redondeoPrecio",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "El precio sin redondear se sube al siguiente múltiplo (por ejemplo $100 o $1,000, según el tramo). Por eso el precio de lista casi siempre es un poco más alto que la fórmula."
 },
 {
  "clave": "reemplazarComponente",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Cambia una pieza por otra en varias listas de materiales a la vez, con las mismas cantidades: eliges en cuáles. La pieza actual no se borra ni pierde su precio, así que se puede seguir vendiendo como refacción. Lo hace ingeniería; en cada línea queda la nota de qué pieza había antes."
 },
 {
  "clave": "reemplazarPieza",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Cambia la pieza de esta línea por otra y deja igual la cantidad, el parámetro, la merma, el grupo y la nota. Solo en este equipo; se puede deshacer desde el aviso."
 },
 {
  "clave": "refaccionesMaquina",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Las piezas que lleva este tipo de máquina (y modelo), con cuántas hay en almacén. Si no hay, se pide desde la orden de mantenimiento."
 },
 {
  "clave": "referenciaMovimiento",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "De qué documento salió: la orden de compra, la orden de producción, el pedido o el ajuste. En un traspaso dice a qué almacén fue o de cuál vino."
 },
 {
  "clave": "referenciaServicio",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "El número con que el cliente identifica su reporte o su orden, si te lo dio. Sale en la ficha del servicio para que lo cites al hablar con él."
 },
 {
  "clave": "registradoHoyAlmacen",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Lo que tú registraste hoy, lo más reciente arriba (hasta 30), para que confirmes que quedó bien. Mientras corre el tiempo para deshacer, cada salida o traspaso tuyo trae su botón «Deshacer»."
 },
 {
  "clave": "registroBitacora",
  "modulos": [
   "admin"
  ],
  "texto": "De qué es el cambio: el folio, el nombre o la clave. En listas de materiales dice el equipo, el artículo y la cantidad; en el material de una orden, la OP, el artículo y cuánto lleva."
 },
 {
  "clave": "reglaCarteraEncendida",
  "modulos": [
   "admin"
  ],
  "texto": "Prendida, cada noche los clientes vencidos quedan libres, y nadie puede cotizar a un cliente vigente de otro vendedor (la gerencia de ventas sí). Un cliente libre es del primero que lo cotiza. Apagada, solo se calcula y se muestra."
 },
 {
  "clave": "reglaDeFabrica",
  "modulos": [
   "analisis"
  ],
  "texto": "Viene con el ERP y no se quita desde aquí. Para ganarle, agrega una regla con número de orden más bajo."
 },
 {
  "clave": "reglaEnvioGratis",
  "modulos": [
   "admin"
  ],
  "texto": "Desde qué monto con IVA una pieza lleva envío gratis, y las palabras que lo quitan: si el nombre del artículo lleva una (banda, cangilón…), nunca lleva envío gratis. El vendedor lo ve al elegir la partida."
 },
 {
  "clave": "reglaFamilia",
  "modulos": [
   "analisis"
  ],
  "texto": "Un patrón de texto que, si aparece en la descripción de una venta de la hoja (en minúsculas y sin acentos), la manda a una familia. Si dos reglas atrapan la misma venta, gana la de orden más bajo. Solo dirección las cambia."
 },
 {
  "clave": "reglaIndicador",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Cómo se convierte lo medido en puntos: meta (todo o nada), descuento por incidencia, una incidencia = 0, proporcional a lo cumplido, escalones o llave del bono."
 },
 {
  "clave": "reglasAhorroPrestamos",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Cuántos días antes se pide un retiro de ahorro, qué porcentaje de lo ahorrado pone la empresa y el interés moratorio de los préstamos. El interés solo cambia lo que dice el pagaré: la prenómina no cobra intereses."
 },
 {
  "clave": "regresarStock",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Suelta una orden de su pedido y la regresa a «Para stock», con su avance, su número de serie y el material que ya se le surtió. Sirve cuando se le dio «Usar» a la orden equivocada o cuando el cliente canceló: el equipo se puede dar a otro pedido. En el pedido, ese equipo vuelve a quedar «Sin orden». Solo la gerencia de producción, con el motivo."
 },
 {
  "clave": "reimportarHojas",
  "modulos": [
   "admin"
  ],
  "texto": "La importación se corre desde una computadora (los pasos están aquí abajo), no desde esta pantalla. Actualiza por clave, así que no duplica, y no vuelve a cargar las existencias de arranque."
 },
 {
  "clave": "reincidencia",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Una máquina que vuelve a fallar a menos de 30 días de que se cerró una reparación. Suele indicar que se arregló el síntoma y no la causa: conviene revisar el diagnóstico de la orden anterior."
 },
 {
  "clave": "relacionCostoVentas",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Qué tanto se mueven juntos el costo de la familia y lo vendido, por trimestre. Cerca de 1: suben juntos; cerca de −1: uno sube cuando el otro baja; cerca de 0: no hay relación. Es orientativa: no dice que una cosa cause la otra."
 },
 {
  "clave": "renglonHojaNoCuenta",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Un renglón de la hoja que finanzas marcó para que no cuente: una compra o un pago capturado de más (aunque la copia esté con otro nombre de proveedor) o una factura que se canceló. Se ve tachado con su motivo, no suma en el saldo ni sale en el historial de pagos, y la hoja no se toca. Para marcar uno, usa el botón de la derecha del renglón; con la flecha se deshace."
 },
 {
  "clave": "reputacionML",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "El termómetro de la cuenta en Mercado Libre (de rojo a verde) y lo que lo mueve: reclamos, despachos con demora y cancelaciones, como porcentaje de las ventas del periodo que ML toma. MercadoLíder sale de las ventas y de mantenerse en verde."
 },
 {
  "clave": "requisicionCompra",
  "modulos": [
   "compras"
  ],
  "texto": "Lo que producción y almacén le piden a compras: los faltantes de las órdenes de producción y lo que almacén pide desde el reabasto. Elige partidas y se vuelven órdenes en borrador, una por proveedor; el mismo artículo pedido varias veces se suma."
 },
 {
  "clave": "resguardo",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "El registro de quién se llevó una herramienta, desde cuándo y para qué. Se cierra cuando alguien la recibe de regreso y anota cómo llegó."
 },
 {
  "clave": "resolverImpugnacion",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Tú decides si la evidencia impugnada cuenta en contra. «No cuenta»: deja de restar y el indicador se recalcula. «Sí cuenta»: se queda como estaba. No la resuelve quien la impugnó."
 },
 {
  "clave": "respaldoMaquina",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Si hay otra máquina con qué suplirla. Si no lo calificas, el sistema la busca solo: otra de la misma categoría, en la misma área y que no esté dada de baja. Con respaldo, «si se para» cuenta un escalón menos."
 },
 {
  "clave": "responsableDevolucion",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Quién la atiende: la persona que la registró, salvo que se le haya asignado a otra."
 },
 {
  "clave": "responsableMejora",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Quien trabaja la mejora: escribe el plan y el resultado, sube las fotos y la marca hecha. Al elegirlo le llega el aviso. Solo puede ser alguien de producción o de ingeniería de procesos."
 },
 {
  "clave": "responsableVentasML",
  "modulos": [
   "admin"
  ],
  "texto": "La persona a cuyo nombre entran como pedidos las ventas de Mercado Libre: es a quien se le cuentan para la comisión. «Nadie» = los pedidos entran sin vendedor."
 },
 {
  "clave": "respuestaRapidaML",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Un texto que se escribe seguido («Sí facturamos…»): se elige de la lista y queda en la caja de respuesta para ajustarlo."
 },
 {
  "clave": "respuestaSugeridaML",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "La IA propone la respuesta con la ficha del artículo (medidas, existencia libre, días de fabricación), lo que dice la publicación en Mercado Libre, lo que ese comprador ya preguntó y los datos para contestar. Queda en la caja para que la leas y la corrijas: no se manda sola. Debajo te dice en qué se basó y qué no sabía. Nunca pone teléfonos, correos ni ligas, porque Mercado Libre lo castiga."
 },
 {
  "clave": "restarHorasSubensamble",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Quita de las horas de este equipo, etapa por etapa, las que el subensamble ya trae, para no contar dos veces el mismo trabajo; nunca quedan negativas. Márcalo si las horas del equipo ya incluían armar esas piezas (pasa en las listas que vinieron planas de la hoja)."
 },
 {
  "clave": "resultadoObjetivos",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "La suma de lo que obtuvo en cada indicador, de 0 a 100 %, con tope de 100 %. Si un ajuste autorizado lo corrigió, se muestra el corregido. En rojo con la llave: el bono vale 0."
 },
 {
  "clave": "resultadoSeguimiento",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Cómo va la venta después de hablar con el cliente. Sigue en pie: lo está pensando; le vuelves a buscar en 3 días hábiles o la fecha que pongas. No contestó: se reintenta en 2. Negociando: pasa a Negociación. Ya compró: te lleva a convertir la cotización en pedido. Se perdió: con su motivo, la oportunidad y su cotización se cierran. Lo que escribes queda en la historia del cliente."
 },
 {
  "clave": "resumenDineroPorEmbarque",
  "modulos": [
   "importaciones"
  ],
  "texto": "Un renglón por embarque: lo que vale su mercancía, lo pagado con su tipo de cambio real, los gastos e impuestos, el IVA acreditable aparte y lo que falta recuperar."
 },
 {
  "clave": "resumenSinIA",
  "modulos": [],
  "texto": "Lo armó el ERP con reglas fijas, sin IA: la IA no está conectada o ya se usaron tus consultas de IA de hoy. Los números son los mismos."
 },
 {
  "clave": "retencionesML",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Mercado Libre retiene impuestos de cada venta y se los entrega al SAT a nombre de Hegamex: IVA (8 % del precio sin IVA) e ISR (2.5 % del precio sin IVA). No es un gasto: se acredita en la declaración. Por eso se ven aparte de la comisión."
 },
 {
  "clave": "retiroAhorro",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Cuando la persona pide su ahorro, Recursos Humanos registra el retiro (hasta su saldo) el día que se le entrega el dinero, con la fecha en que lo pidió: entre una y otra van los días de anticipación de las reglas. Se dice de qué cuenta salió y queda también en finanzas. Sale un recibo con folio, original y copia, para que lo firme. Si se da de baja con ahorro, la prenómina avisa para entregárselo con su finiquito."
 },
 {
  "clave": "revisionAlmacen",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Almacén revisó la existencia física del material de la orden, no solo lo que dice el sistema."
 },
 {
  "clave": "revisionAplicarPropuesta",
  "modulos": [],
  "texto": "Hace el cambio que propuso la IA a tu nombre y con tus permisos, como si lo capturaras tú, y queda en la bitácora. Si a mano no podrías cambiarlo, así tampoco. Al aplicarse, el hallazgo se cierra como corregido."
 },
 {
  "clave": "revisionAyudaCorregir",
  "modulos": [],
  "texto": "La IA lee lo que se señaló y el registro y te propone el cambio exacto (por ejemplo, escribir el tiempo de entrega que falta). Nada se aplica hasta que lo aceptas, y se hace a tu nombre con tus permisos, como si lo capturaras a mano: queda en la bitácora. Solo cambia datos de captura (fechas, tiempo de entrega, notas, contacto, categoría, cantidades de partida); nunca precios, dinero, existencias ni permisos. Si el dato correcto solo lo sabes tú, te lo pide."
 },
 {
  "clave": "revisionBienAsi",
  "modulos": [],
  "texto": "Dices que no es un error, y escribes por qué (es obligatorio: sin el porqué no se sabe si era falsa alarma o costumbre). Si dirección lo tiene prendido, la IA lee tu porqué y, si algo no queda claro, te pregunta hasta 3 veces aquí mismo. Si queda claro, se cierra y no vuelve a salir; si no, se queda abierto y lo ve dirección con la conversación."
 },
 {
  "clave": "revisionClaude",
  "modulos": [],
  "texto": "Lo señaló la IA al leer lo que se capturó ayer: cosas que una regla no ve, como una nota que contradice la orden o una cantidad que no cuadra con la unidad. La IA solo señala; no cambia nada."
 },
 {
  "clave": "revisionContestado",
  "modulos": [],
  "texto": "Lo que ya se contestó, lo más reciente primero, con la respuesta y quién la dio. Ves lo que te tocaba a ti; dirección ve lo de todos y lo que cada quien platicó con la IA."
 },
 {
  "clave": "revisionCorrerAhora",
  "modulos": [],
  "texto": "Corre en este momento todas las reglas prendidas, sin la IA, y les avisa de una vez a quienes les tocó algo (lo urgente también va a sus Pendientes). Sirve para probar una regla nueva o ver si algo ya quedó corregido."
 },
 {
  "clave": "revisionCorrigelo",
  "modulos": [],
  "texto": "El ERP hace la corrección por ti, con tus permisos, como si la hicieras a mano. Solo sale cuando la corrección es segura (inhabilitar el artículo repetido y quedarse con el que ya existía; ligar tu cuenta a tu ficha). Si algo lo impide, te dice qué hacer primero."
 },
 {
  "clave": "revisionEscalado",
  "modulos": [],
  "texto": "Contestaste «Está bien así», la IA hizo sus preguntas y el porqué no quedó claro. Se queda abierto y dirección lo ve con la conversación para decidir. Si mientras lo corriges, contesta «Ya lo corregí»."
 },
 {
  "clave": "revisionEstadoContestado",
  "modulos": [],
  "texto": "Corregido: alguien contestó «Ya lo corregí» (o marcó hecho su pendiente), usó «Corrígelo» o aplicó la propuesta de la IA. Está bien así: no era error; abajo va el porqué. Se corrigió solo: la siguiente revisión ya no lo encontró."
 },
 {
  "clave": "revisionEstadoIA",
  "modulos": [],
  "texto": "Qué pasó con la IA esa noche. «La IA leyó»: regresó su lectura. «Esperando a la IA»: todavía no contesta. «La IA falló»: hubo un error o no regresó a tiempo (la nota dice cuál). «IA apagada»: estaba apagada o se corrió a mano, solo con reglas. «Tope del mes»: ya se usó lo permitido. «Sin IA»: no está conectada."
 },
 {
  "clave": "revisionEvidencia",
  "modulos": [],
  "texto": "Los registros en los que se basa: folio, qué se vio, quién, cantidad y fecha. Salen hasta 12; si hay más, dice cuántos."
 },
 {
  "clave": "revisionGravedad",
  "modulos": [],
  "texto": "Qué tan pronto conviene verlo. «Urgente»: puede costar dinero o descuadrar el inventario si se deja (un pago repetido, una compra con un cero de más); además te queda como pendiente para el siguiente día hábil. «Revisar»: un error que conviene corregir esta semana. «Cuando puedas»: algo menor."
 },
 {
  "clave": "revisionIngenieria",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Ingeniería confirmó que la lista de materiales y las cantidades de la orden están bien. Sin esto la orden no se puede liberar."
 },
 {
  "clave": "revisionLectura",
  "modulos": [],
  "texto": "Lo que la IA leyó de cada módulo la madrugada pasada, en dos o tres frases, y cuántas cosas encontraron las reglas y la IA. Si la IA no corrió (apagada, sin llave, tope del mes), lo dice."
 },
 {
  "clave": "revisionListaReglas",
  "modulos": [],
  "texto": "Para prender o apagar la revisión, la IA, los consejos y cada regla, y para correr las reglas a mano. Lo que apagas deja de buscarse desde la siguiente corrida; lo ya encontrado sigue abierto."
 },
 {
  "clave": "revisionNocturnaActiva",
  "modulos": [],
  "texto": "Cada madrugada a las 2:07 corre las reglas sobre lo capturado y, si la IA está prendida, ella lee lo de ayer; los avisos salen a partir de las 6. Apagada no corre nada, pero lo que ya se encontró sigue abierto."
 },
 {
  "clave": "revisionOC",
  "modulos": [
   "compras"
  ],
  "texto": "Una orden ya enviada se puede cambiar cuando el proveedor y quien la pidió acuerdan otro artículo, otra cantidad u otro precio. Compras lo hace con el lápiz de la partida, siempre que de esa partida no haya llegado nada, y escribe por qué. El folio no cambia (el proveedor ya lo tiene): la orden sube de revisión, lo impreso dice «Rev. 2» para mandársela otra vez, y abajo queda el antes y el después de cada cambio. Si lo que cambia es el proveedor, cancélala y haz otra."
 },
 {
  "clave": "revisionParaQuien",
  "modulos": [],
  "texto": "A quién le toca contestarlo. «Solo dirección» es un patrón: no le llega a nadie más."
 },
 {
  "clave": "revisionParaTi",
  "modulos": [],
  "texto": "Lo que la revisión de la madrugada encontró en algo que tú capturaste o que te toca: un artículo o cliente que parece dado de alta dos veces, un pago repetido, una compra que ya debió llegar, un costo muy distinto al de la última vez. Contesta cada uno; lo contestado no vuelve a salir."
 },
 {
  "clave": "revisionPatron",
  "modulos": [],
  "texto": "Algo que conviene preguntar, no un error de una persona: un consumo que se dispara, ajustes a la baja que se repiten en el mismo artículo, el mismo gasto de caja chica varias veces. Solo lo ve dirección, con su evidencia; puede tener una explicación normal (un trabajo especial, un gasto fijo)."
 },
 {
  "clave": "revisionRegla",
  "modulos": [],
  "texto": "Lo encontró una regla fija del ERP (por ejemplo: mismo tipo, unidad y medidas y un nombre casi igual). Siempre revisa lo mismo y de la misma forma."
 },
 {
  "clave": "revisionReglaActiva",
  "modulos": [],
  "texto": "Prendida, esta regla busca cada madrugada. Apagada, deja de buscar; lo que ya encontró sigue abierto hasta que alguien lo conteste."
 },
 {
  "clave": "revisionTodoAbierto",
  "modulos": [],
  "texto": "Todo lo que la revisión encontró y nadie ha contestado, de todas las personas y con a quién le toca. Tú también lo puedes contestar desde aquí."
 },
 {
  "clave": "revisionYaLoCorregi",
  "modulos": [],
  "texto": "Dices que ya lo arreglaste en su pantalla: se cierra como corregido y, si también estaba en tus Pendientes, ahí queda hecho. Si es algo que la revisión puede volver a medir (un dato que falta, una compra sin recibir) y sigue igual, vuelve a salir la siguiente madrugada. En los patrones dice «Ya lo revisé»."
 },
 {
  "clave": "riesgoSeguridad",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Qué tan peligrosa es la máquina si falla o al repararla: ninguno, golpe o corte leve, lesión que incapacita o grave (eléctrico, atrapamiento, presión). Lo califica mantenimiento. Pesa hasta 9 de 30 puntos, y un riesgo grave hace la criticidad alta por lo menos."
 },
 {
  "clave": "ritmoCompra",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Cada cuántos días suele comprar este cliente (lo típico entre una compra y otra). Compras a menos de 2 semanas de la anterior cuentan como la misma."
 },
 {
  "clave": "ritmoNecesario",
  "modulos": [
   "analisis"
  ],
  "texto": "Lo que falta para la meta entre los meses que quedan. Si sale una insignia «×1.3 el ritmo», hay que vender 1.3 veces el promedio mensual que lleva el año."
 },
 {
  "clave": "rolUsuario",
  "modulos": [
   "admin"
  ],
  "texto": "El puesto de la persona dentro del ERP (Ventas, Almacén, RR. HH.…). Cada rol trae sus permisos por módulo; alguien puede tener varios y vale el nivel más alto. «Espera rol» = entró, pero todavía no puede ver nada."
 },
 {
  "clave": "rutinaEnUso",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Las máquinas cuyo plan preventivo usa esta rutina. Una rutina que algún plan usa no se puede desactivar: primero se le cambia la rutina al plan."
 },
 {
  "clave": "rutinaMantenimiento",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "La lista de puntos que se revisan en un preventivo, por tipo de máquina y frecuencia (por ejemplo, inversoras AXT cada mes). Cada orden que sale del plan trae esa lista para palomearla, con sus recomendaciones arriba. Las edita el encargado de mantenimiento en Rutinas; si la cambia, los preventivos que ya salieron y nadie ha empezado toman la lista nueva, y los que ya se están palomeando se quedan como estaban."
 },
 {
  "clave": "saldoAhorro",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Lo que se le debe devolver a cada persona: lo descontado de su nómina en semanas cerradas, más lo que haya puesto la empresa (si se configuró) y su saldo inicial, menos sus retiros. Lo de la semana abierta entra al cerrarla."
 },
 {
  "clave": "saldoArranque",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Lo que el cliente ya debía en la hoja el día que arrancó el ERP, menos lo que ha pagado de eso desde entonces. Se muestra aparte del saldo de los pedidos nuevos."
 },
 {
  "clave": "saldoArranqueVacaciones",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Lo que decía el control de vacaciones en Excel al pasar al ERP: cuántos días le quedaban de cierto periodo en esa fecha. Los periodos anteriores se dan por usados y lo tomado antes de esa fecha ya venía descontado. Si no cuadra, corrígelo eligiendo el periodo."
 },
 {
  "clave": "saldoCaja",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "El efectivo que debería haber en caja chica: todas las entradas menos todas las salidas, desde que empezó la hoja. Si el conteo no cuadra, el arqueo lo corrige."
 },
 {
  "clave": "saldoInicialInventario",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "La existencia con la que arrancó el ERP: lo que había en cada almacén según la hoja Inventario. De ahí en adelante, todo cambio es un movimiento."
 },
 {
  "clave": "saldoPaqueteria",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Lo que queda en la cuenta de prepago de una paquetería: recargas menos lo que costaron las guías. En rojo, abajo del mínimo."
 },
 {
  "clave": "saldoPedido",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Lo que falta por cobrar de este pedido: su total menos los cobros registrados. Un pedido cancelado no debe nada; uno que viene de la hoja se cobra contra el saldo de arranque del cliente."
 },
 {
  "clave": "saldoPedidosCliente",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Lo que falta por cobrar de sus pedidos del ERP, en pesos: el total menos los cobros registrados. No incluye lo que ya debía en la hoja al arrancar: eso sale en su ficha, en «Saldo por cobrar»."
 },
 {
  "clave": "saldoPorCobrar",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Lo que falta por cobrar: lo de sus pedidos (total con IVA menos los cobros registrados) más lo que ya debía en la hoja al arrancar el ERP. Los pedidos cancelados y los que vienen de la hoja no suman aparte: lo de la hoja ya va en su saldo. Los cobros los registra finanzas."
 },
 {
  "clave": "saldoPrestamo",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Lo que todavía debe: lo prestado menos lo descontado en semanas cerradas y lo que abonó aparte. Si se da de baja debiendo, se descuenta completo en su última semana."
 },
 {
  "clave": "saldoProveedor",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Lo que le debemos a cada proveedor: lo que venía en la hoja más las compras registradas aquí, menos los pagos. Negativo = nos debe él (un anticipo o un reembolso)."
 },
 {
  "clave": "saldoSkydropx",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Lo que Skydropx dice que queda en la cuenta. Si no cuadra con el calculado (recargas menos guías), falta registrar una recarga o un cargo, como un sobrepeso."
 },
 {
  "clave": "saldoVacaciones",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Días de vacaciones que puede tomar hoy, en días hábiles: lo que le queda de sus periodos vigentes menos lo que ya adelantó de periodos que todavía no empiezan. En rojo (negativo) si debe días: se los descuenta su próximo periodo, no se perdonan al cumplir año."
 },
 {
  "clave": "saleHaciaOrden",
  "modulos": [
   "analisis"
  ],
  "texto": "El día en que la orden saldría con la fila de hoy: cuando su etapa más cargada acaba lo prometido antes que ella y lo suyo, contando de lunes a viernes. Cambia cada día con lo que el taller termina y lo que entra."
 },
 {
  "clave": "salidaConsumo",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Material que se gasta en la planta y no va a un cliente: taller, EPP, plasma, torno, pintura, uniformes, mantenimiento. Se anota quién lo recibe, para ver cuánto se lleva cada persona."
 },
 {
  "clave": "salidaManualAlmacen",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Lo que sale del almacén sin una orden de producción: consumo del taller o venta. No deja sacar más de lo que hay en el almacén que elijas. Lo que va a una orden de producción se surte desde la orden."
 },
 {
  "clave": "salidaProduccionAlmacen",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Material que almacén le entregó a una orden de producción. Se registra al surtir desde la orden, no desde aquí; en la referencia va el folio de la orden."
 },
 {
  "clave": "salidaVentaAlmacen",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Material que salió vendido. La registra sola el ERP al entregar o enviar un pedido, o almacén a mano (mostrador, Mercado Libre, sitio web) desde Entradas y salidas, con el motivo de qué venta fue."
 },
 {
  "clave": "saludBajoReorden",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Tiene demanda y lo disponible ya está debajo del punto de reorden: es lo que Reabasto marca para ordenar."
 },
 {
  "clave": "saludEsporadico",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Hay existencia y algo salió en los últimos 12 meses, pero tan pocas veces que no alcanza a tener demanda mensual. Suele ser refacción o material de un solo equipo."
 },
 {
  "clave": "saludExceso",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Tiene demanda, pero lo disponible pasa del punto de reorden más dos compras completas. Es dinero detenido: conviene no volver a pedir hasta que baje."
 },
 {
  "clave": "saludInventario",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Cada artículo con existencia o con demanda, clasificado por cuánto alcanza lo disponible contra lo que sale: quiebre, debajo del punto de reorden, sano, exceso, esporádico o sin movimiento. Es una foto de hoy y sale de los mismos 12 meses de salidas (hoja y ERP) que usa Reabasto."
 },
 {
  "clave": "saludNegativo",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "El sistema dice que hay menos de cero. Siempre es un error de captura (una salida sin su entrada, un traspaso al revés): hay que contar y ajustar."
 },
 {
  "clave": "saludPorValorArticulos",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "«Por valor» mide cada clase por lo que vale su existencia al costo; «Por artículos», por cuántos artículos tiene. Solo con permiso de costos se puede ver por valor."
 },
 {
  "clave": "saludQuiebre",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Tiene demanda y lo disponible (en planta, menos lo apartado, más lo que viene en camino) es cero o menos. Si se pide hoy, no hay."
 },
 {
  "clave": "saludSano",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Tiene demanda y lo disponible está entre el punto de reorden y dos compras encima: alcanza sin sobrar."
 },
 {
  "clave": "saludSinMovimiento",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Hay existencia y no salió nada en 12 meses. Es el primer lugar para buscar qué rematar, devolver o usar en otro equipo, y para revisar si el conteo es real."
 },
 {
  "clave": "seEsperaRecuperarImportacion",
  "modulos": [
   "importaciones"
  ],
  "texto": "Cuándo nos deben regresar ese dinero. Si nadie pone otra fecha, son 15 días después de su fecha de inicio para un saldo a favor (la de la cuenta de gastos, si salió de ahí) y 30 para una garantía. En rojo, con los días de retraso, si ya pasó."
 },
 {
  "clave": "segmentoCampeones",
  "modulos": [
   "analisis"
  ],
  "texto": "Compraron en el último año, 3 o más veces en 3 años, y están en el 20 % que más compró en esos 3 años."
 },
 {
  "clave": "segmentoCliente",
  "modulos": [
   "analisis"
  ],
  "texto": "Grupo según qué tan reciente fue su última compra, qué tan seguido compran y cuánto: campeones, nuevos, leales, ocasionales, en riesgo, dormidos y perdidos. Se calcula al último día del periodo. Pasa el mouse por cada uno para ver su regla y dale clic para ver quiénes son."
 },
 {
  "clave": "segmentoDormidos",
  "modulos": [
   "analisis"
  ],
  "texto": "Su última compra fue hace 12 a 24 meses; compraron una sola vez en 3 años y poco."
 },
 {
  "clave": "segmentoEnRiesgo",
  "modulos": [
   "analisis"
  ],
  "texto": "Su última compra fue hace 12 a 24 meses y compraban seguido (2 o más veces en 3 años) o mucho (más que la mitad de los clientes)."
 },
 {
  "clave": "segmentoLeales",
  "modulos": [
   "analisis"
  ],
  "texto": "Compraron en el último año y 2 o más veces en 3 años."
 },
 {
  "clave": "segmentoNuevos",
  "modulos": [
   "analisis"
  ],
  "texto": "Su primera compra fue en los últimos 12 meses."
 },
 {
  "clave": "segmentoOcasionales",
  "modulos": [
   "analisis"
  ],
  "texto": "Compraron en el último año, una sola vez en 3 años."
 },
 {
  "clave": "segmentoPerdidos",
  "modulos": [
   "analisis"
  ],
  "texto": "Hace más de 2 años que no compran."
 },
 {
  "clave": "seguimientoCotizacion",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "El día en que toca preguntarle al cliente qué pasó con una cotización. Se agenda solo al enviarla, a 3 días hábiles (sin contar fines de semana ni festivos), y solo se cierra anotando qué pasó; si sigue viva, se agenda el siguiente. Si mandas otra versión, se recorre en vez de duplicarse; si se vuelve pedido o se rechaza, se cierra solo. En rojo, los vencidos."
 },
 {
  "clave": "seguimientoEquipo",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Cómo va cada vendedor con el seguimiento de sus cotizaciones: cuántos tiene vencidos, cuántos le tocan hoy y cuántos anotó en los últimos 7 días. «Frenado» = pasó de 10 vencidos y no puede enviar cotizaciones nuevas; «Liberado hoy» = la gerencia de ventas lo dejó enviar ese día. Clic para ver la lista completa."
 },
 {
  "clave": "seguimientosPorVendedor",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Cuántos seguimientos trae cada vendedor: vencidos, para hoy y en total, y en los últimos 7 días cuántas cotizaciones envió contra cuántos seguimientos anotó. «Frenado» = pasó de 10 vencidos y no puede enviar; con «Liberar por hoy» lo dejas enviar ese día (pide el motivo y le avisa). Clic en un vendedor filtra la lista de abajo."
 },
 {
  "clave": "selectorMesObjetivos",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "El mes que estás viendo. De entrada abre el que terminó, que es el que se califica. No se puede pasar del mes en curso."
 },
 {
  "clave": "selectorMunicipioCorrecto",
  "modulos": [
   "analisis"
  ],
  "texto": "Escribe para buscar el municipio: dentro del estado reconocido o, si no hay (o la ciudad es de otro estado), en todo el país. Sin escribir, salen los que más se parecen. Al elegirlo se aplica de inmediato a todos los que lo escribieron igual."
 },
 {
  "clave": "semaforoSolicitud",
  "modulos": [
   "compras"
  ],
  "texto": "Verde: a tiempo. Amarillo: vence en menos de una hora hábil. Rojo: ya venció y el vendedor sigue esperando. Las vencidas van arriba de la lista."
 },
 {
  "clave": "semanaEnUnaFrase",
  "modulos": [],
  "texto": "La semana pasada contada con tus números: qué subió, qué bajó y qué conviene atender. La escribe la IA una vez por semana (o las reglas del ERP si no hay IA); con las flechas la pides de nuevo. Cada tarjeta lleva a donde se atiende."
 },
 {
  "clave": "semanaNomina",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "La semana de nómina va de viernes a jueves y se paga el viernes siguiente. Se calcula sola con las incidencias aprobadas hasta que alguien la cierra."
 },
 {
  "clave": "senalesPublicacionML",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Lo que conviene revisar de una publicación: que no esté ligada a un artículo, que su precio se aleje 2 % o más del sugerido, que publique más piezas de las que hay libres en planta, que tenga menos de 3 fotos, o que tenga 50 visitas o más en 30 días sin ninguna venta."
 },
 {
  "clave": "serialSiguiente",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "El número de serie que sacaría la siguiente orden de este equipo: su código más el consecutivo que sigue en su familia."
 },
 {
  "clave": "siguientePaso",
  "modulos": [
   "importaciones"
  ],
  "texto": "Lo que sigue para que el embarque avance, según la etapa en que va y los documentos que faltan."
 },
 {
  "clave": "siguienteSeguimientoCotizacion",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Cuándo le vuelves a preguntar, de hoy a cuatro meses. Si lo dejas vacío se agenda solo: en 2 días hábiles si no contestó y en 3 si sigue en pie o negociando."
 },
 {
  "clave": "simuladorPrecios",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Antes de guardar un cambio de utilidad, recargo o ISR, ves cuántos precios se mueven, cuánto en promedio y los diez que más cambian. Respeta precios fijos y utilidades propias, igual que el cálculo real."
 },
 {
  "clave": "sinAutoMarcaChecklist",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Nadie se marca a sí mismo: tu marca la pone otra persona."
 },
 {
  "clave": "sinContactarLead",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Los leads que ya tienes asignados y a los que todavía no les has escrito, llamado ni visitado (ningún intento anotado). La gerencia ve los de todos los vendedores."
 },
 {
  "clave": "sinCostoPrecios",
  "modulos": [
   "compras"
  ],
  "texto": "Artículos que no tienen costo o lo tienen en $0. En el costeo de los equipos donde van cuentan como $0, así que el precio de esos equipos sale más bajo de lo real."
 },
 {
  "clave": "sinCuadrilla",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Trabajo en proceso o listo para empezar que nadie tiene asignado. Arrastra a alguien del personal a la tarjeta para que le toque."
 },
 {
  "clave": "sinEnviarCotizado",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Cotizaciones que nunca se mandaron al cliente: en borrador, esperando que la gerencia autorice el precio, autorizadas pero sin enviar, o canceladas antes de enviarse."
 },
 {
  "clave": "sinGuardarPrecios",
  "modulos": [
   "compras"
  ],
  "texto": "Lo que escribiste y todavía no se guarda (las filas en amarillo). «Guardar cambios» las guarda todas juntas; «Descartar» las borra sin guardar."
 },
 {
  "clave": "sinIva",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "La venta va sin factura: el total es el subtotal, sin el 16 %. El precio de cada partida es el mismo que con factura; solo no se agrega el IVA. La comisión no cambia porque siempre se calcula sin IVA. Un pedido con factura registrada no puede quedar sin IVA."
 },
 {
  "clave": "sinOrden",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Equipos vendidos que todavía no tienen orden de producción: nadie los está fabricando. La gerencia los crea con «Crear las órdenes que faltan» o les asigna uno de stock."
 },
 {
  "clave": "sinProveedorRequisicion",
  "modulos": [
   "compras"
  ],
  "texto": "Ni su costo ni el catálogo dicen a quién se le compra. Al crear las órdenes te pide elegir uno para estas partidas; si no, se quedan pendientes."
 },
 {
  "clave": "sinSalidaInventario",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Algo salió con la entrega pero en el ERP no había suficiente para descontarlo, por ejemplo porque la existencia no estaba al día. La entrega se registró igual, porque el cliente ya se lo llevó; almacén revisa la existencia y la corrige con un ajuste."
 },
 {
  "clave": "sinSueldoNomina",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "No tiene sueldo en nómina ni salario diario en su ficha, así que no se le calcula sueldo. Regístralo en la pestaña Sueldos."
 },
 {
  "clave": "sistemaAlContar",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Lo que decía el sistema cuando capturaste ese artículo; si todavía no lo cuentas, lo que dice ahorita. La diferencia se mide contra ese número, así que lo que entre o salga después no la cambia."
 },
 {
  "clave": "sistemaAlPedirAjuste",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Lo que dice el sistema hoy en ese almacén. Se guarda con el ajuste: al autorizarlo se aplica la diferencia contra este número, aunque mientras tanto entre o salga algo."
 },
 {
  "clave": "situacionPreventivo",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Al día: todavía no toca. Por vencer: faltan pocos días o ya lleva 90 % de las horas. Vencido: ya pasó la fecha o las horas."
 },
 {
  "clave": "sobranFaltanConteo",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "De los artículos con diferencia, en cuántos hay más de lo que dice el sistema (sobran) y en cuántos menos (faltan)."
 },
 {
  "clave": "sociosBancos",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Préstamos de los socios y créditos del banco. Se deben, pero no son proveedores: van aparte para que no se mezclen con la agenda de pagos. La nómina (con IMSS, PTU, aguinaldos y bonos) y los impuestos tampoco son proveedores, pero sí entran a la agenda porque vencen como una factura; en «Pagos hechos» tienen su propio filtro y en compras no aparecen."
 },
 {
  "clave": "solicitudCambio",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Cuando algo de la lista de materiales está mal, producción, almacén o ventas lo reportan desde la orden. A ingeniería le llega como pendiente (con aviso en la campana) para dentro de dos días hábiles; cuando lo marca como aplicado o descartado, el pendiente se cierra solo y a quien lo pidió le llega el aviso."
 },
 {
  "clave": "solicitudesConPrecio",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Las que compras ya contestó con precio de lista y entrega, las hayas usado o no."
 },
 {
  "clave": "solicitudesContestadas",
  "modulos": [
   "compras"
  ],
  "texto": "Las que compras ya contestó: con precio o con «no se consigue». Las que canceló el vendedor solo salen en «Todas»."
 },
 {
  "clave": "solicitudesPorAprobar",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Lo que alguien pidió o registró sin autorizar (vacaciones, permisos, faltas…) y que Recursos Humanos todavía no aprueba ni rechaza. Mientras tanto no se resta del saldo ni cuenta en la prenómina."
 },
 {
  "clave": "solicitudesPorUsar",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Las que compras todavía no contesta y las que ya tienen precio que no has usado: ni lo aplicaste a la cotización ni has cotizado ese artículo desde que te contestaron."
 },
 {
  "clave": "solicitudPrecio",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Cuando algo no tiene precio de lista, se lo pides a compras desde la partida o con “Pedir precio”. Compras tiene un plazo en horas hábiles (más corto si es urgente) y, al contestar, ves el precio de lista y la entrega, nunca el costo. Con un clic lo aplicas a la cotización."
 },
 {
  "clave": "solicitudUrgente",
  "modulos": [
   "compras"
  ],
  "texto": "Quien la pidió la marcó urgente porque el cliente está esperando: compras tiene 4 horas hábiles en vez de un día, y va antes que las demás de su mismo color."
 },
 {
  "clave": "solicitudVencida",
  "modulos": [
   "compras"
  ],
  "texto": "Ya pasó su plazo y el vendedor sigue esperando. Le llega un aviso a quien la tiene (o a todo compras, si nadie la tomó) y a la gerencia de quien la pidió. Mientras menos, mejor."
 },
 {
  "clave": "soloLoMio",
  "modulos": [],
  "texto": "Deja solo lo que está a tu nombre: tus pedidos, oportunidades, llamadas y reclamos; las requisiciones, compras, embarques y envíos que tú pediste; los servicios que programaste o en los que vas; las máquinas a tu cargo y la herramienta que tienes; lo que entra a tu área del taller; tus pendientes, tus vacaciones y tu cumpleaños."
 },
 {
  "clave": "stockSeguridad",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Piezas extra que siempre deben quedar, por si la entrega se atrasa. Se suman al punto de reorden. Vacío es cero."
 },
 {
  "clave": "subensamble",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Un grupo de piezas que siempre van juntas (cabezal motriz, tambor de cola…) capturado una sola vez y usado en varios equipos. No se copia: si lo cambias, cambia en todos los equipos que lo usan."
 },
 {
  "clave": "subensambleEnOrden",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "A una orden también se le agrega un subensamble completo. «Se fabrica aquí» mete sus componentes y materia prima a la lista (agrupados bajo ese subensamble, y si alguno ya estaba se le suma); «Ya está hecho» lo agrega como una sola pieza que sale del almacén. Queda en la línea de tiempo con su motivo."
 },
 {
  "clave": "subensamblesCoincidentes",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Subensambles activos que ya llevan alguna de las piezas marcadas con la misma cantidad. «Idéntico»: mismas piezas y cantidades, ni una más ni una menos. «3 de 5 iguales»: se parecen, pero al sustituir la lista del equipo cambia."
 },
 {
  "clave": "subensambleSugerido",
  "modulos": [
   "admin"
  ],
  "texto": "Un grupo de piezas que se repite idéntico en varios equipos porque las listas se copiaron. Convertirlo en subensamble lo deja en un solo lugar para todos esos equipos; el costo y el precio no cambian."
 },
 {
  "clave": "subirFotosEvidencia",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Elige de qué momento es la foto y tómala o elígela; en el celular se abre la cámara. Puedes subir hasta 6 a la vez. Una foto subida ya no se borra."
 },
 {
  "clave": "sueldoDeLaFicha",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Esta persona no tiene sueldo registrado en nómina: se usa el salario diario de su ficha de Personal × 7. Registra su sueldo para que deje de depender de la ficha."
 },
 {
  "clave": "sueldoDiasNomina",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Lo que le toca de su sueldo semanal por los días pagados de esta semana."
 },
 {
  "clave": "sueldoPorDia",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "El sueldo semanal entre 7: lo que vale cada día."
 },
 {
  "clave": "sueldoSemanal",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "El sueldo base de 7 días. Un aumento es un renglón nuevo con su fecha y motivo; el anterior no se reescribe y las semanas ya cerradas no cambian."
 },
 {
  "clave": "sugerenciasClaude",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "La IA revisa los datos del taller de los últimos 90 días (horas reales contra estimadas por área, esperas entre etapas, pausas, problemas y etapas reabiertas, fallas de máquinas) y las mejoras que ya hay, y propone de 3 a 6 con las cifras de donde salen. No guarda nada: «Proponerla» la manda al tablero como propuesta, marcada como sugerencia, y se decide como cualquier otra. Las horas por persona no se le mandan: una mejora arregla el proceso, no señala a nadie. Las sugerencias del día se guardan; «Volver a pedirlas» gasta una consulta."
 },
 {
  "clave": "sugerido",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Lo que conviene pedir: el lote más lo que falta para llegar al punto de reorden, redondeado al empaque del proveedor. Abajo avisa si ya está en una orden en borrador o en una requisición."
 },
 {
  "clave": "sugeridoMLFicha",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "«Publicado» es el precio que tiene hoy su publicación en Mercado Libre. «Sugerido» es el que habría que poner allá para que llegue completo el precio de lista: el precio de lista con IVA más la comisión de Mercado Libre (y su cuota fija si es barato); «con envío» suma además lo que se paga por el envío."
 },
 {
  "clave": "sumaEtapaOportunidad",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "La suma del monto estimado de las tarjetas de esta columna, sin IVA. En Ganada y Perdida solo cuentan las de los últimos 60 días."
 },
 {
  "clave": "surtidoOrden",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Lo que almacén ya le entregó al taller para esta orden (salió del inventario)."
 },
 {
  "clave": "surtidoOrdenes",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Partidas que almacén entregó a órdenes de producción en el periodo (cada artículo en cada surtido es una partida) y a cuántas órdenes distintas."
 },
 {
  "clave": "tableroML",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Cada publicación de Mercado Libre con lo que dice ML (precio, existencia, visitas, fotos) junto a lo que dice el catálogo, y sus preguntas y ventas de los últimos 30 días. Se pone al día con «Traer de Mercado Libre», que solo lee. Para corregir precio o existencia allá está «Cambios sugeridos»."
 },
 {
  "clave": "tallerCentroMando",
  "modulos": [],
  "texto": "Órdenes de producción sin entregar ni cancelar; en rojo si alguna ya pasó su fecha compromiso (las que están en espera no cuentan). «A tiempo» es qué parte de las terminadas en los últimos 90 días con fecha compromiso se terminó ese día o antes. «Promesas en riesgo» son órdenes que, con la fila del taller, saldrían tarde: si hay, el clic te lleva al análisis de entregas."
 },
 {
  "clave": "tambienEnHoja",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "La hoja trae un movimiento igual (mismo proveedor o cliente, mismo monto, con una semana de diferencia o menos), así que se cuenta una sola vez. Por eso un pago capturado con la fecha de un pago que ya está en la hoja no baja el saldo; desde el arranque de finanzas el sistema ya no lo deja capturar y te dice por qué."
 },
 {
  "clave": "tambienFaltanEsosDias",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Otras personas con vacaciones, permiso, falta o incapacidad aprobada que se cruzan con esas fechas. Sirve para ver si el área se queda corta antes de aprobar."
 },
 {
  "clave": "tardeSegunPlan",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Órdenes cuyo plan termina después de su fecha compromiso. La franja roja va del compromiso a donde acaba el plan: son los días que faltarían. Se corrige subiéndola en la fila, poniéndole más gente a sus etapas o acordando otra fecha con el cliente."
 },
 {
  "clave": "tareaConFechaActividad",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Una tarea con fecha: se queda arriba, en «Pendientes», hasta que la palomeas como hecha. Vencida sale en rojo, y aparece en el calendario de la semana."
 },
 {
  "clave": "tarifaManoObra",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Costo por hora hombre de cada etapa del taller. Se multiplica por las horas de esa etapa en cada equipo; al cambiarla se recalculan costos y precios."
 },
 {
  "clave": "tarifaML",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Lo que Mercado Libre le cobra a esta publicación por cada venta: el porcentaje de comisión de su categoría y tipo, y el envío gratis que paga la cuenta. ML los cambia según la categoría, el peso y la reputación, por eso se leen de cada publicación al traerlas. «Estimado» quiere decir que ML no los dio esta vez y se usaron los de la configuración del canal."
 },
 {
  "clave": "tarifasFlete",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Lo que cotizó cada paquetería para esa ruta, de la más barata a la más cara, con los días hábiles aproximados que tarda. Elige una y «Agregar flete» la pone como partida."
 },
 {
  "clave": "tasaCierre",
  "modulos": [],
  "texto": "De las cotizaciones emitidas en los últimos 90 días que ya se cerraron (aceptadas, rechazadas o vencidas), qué porcentaje se aceptó. Más alto es mejor."
 },
 {
  "clave": "tasaCierreCotizado",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "De lo que ya se decidió (ganado más perdido), qué parte se ganó, en dinero. Lo abierto no cuenta todavía."
 },
 {
  "clave": "tasaPlanMeses",
  "modulos": [
   "admin"
  ],
  "texto": "La comisión del banco por ese plan, con IVA; la paga el cliente en la mensualidad. Solo salen en la cotización los planes activos."
 },
 {
  "clave": "tcReal",
  "modulos": [
   "importaciones"
  ],
  "texto": "El tipo de cambio que de verdad nos costó: los pesos que salieron entre los dólares que se pagaron. Es el que pide el agente para demostrarlo ante la aduana."
 },
 {
  "clave": "temaPorDefecto",
  "modulos": [
   "admin"
  ],
  "texto": "El tema con el que abre el ERP para todos. Cada persona puede cambiarlo con el botón de la luna o el sol (arriba a la derecha); lo que escoja se queda en su navegador y manda sobre este."
 },
 {
  "clave": "tendenciaUsoErp",
  "modulos": [
   "admin"
  ],
  "texto": "La medida que escojas arriba (tiempo, cambios, consultas o costo de la IA, o cuántas personas lo usaron), día por día. La línea punteada es el periodo anterior del mismo largo, alineado por día: el primero contra el primero, y así. Cuenta a todas las cuentas, aunque arriba escojas un rol."
 },
 {
  "clave": "terminadasEsteMes",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Órdenes que el taller terminó desde el día 1 de este mes, ya entregadas o no. Abajo, cuántas terminadas siguen esperando que se entreguen."
 },
 {
  "clave": "textoPorDefectoCotizacion",
  "modulos": [
   "admin"
  ],
  "texto": "Marcado, sale ya puesto en cada cotización nueva: la condición de pago y el tiempo de entrega marcados (si no hay, el primero de la lista) y todas las notas al pie marcadas. El vendedor lo puede cambiar."
 },
 {
  "clave": "textosComerciales",
  "modulos": [
   "admin"
  ],
  "texto": "Las opciones que el vendedor escoge en la cotización: condiciones de pago, tiempo de entrega, vigencia y notas al pie. Apagar una («Activo») la quita de la lista; las cotizaciones que ya la usan no cambian."
 },
 {
  "clave": "ticketPromedio",
  "modulos": [
   "analisis"
  ],
  "texto": "Venta entre número de operaciones (facturas o pedidos). Dice si ahí se venden equipos grandes o refacciones sueltas."
 },
 {
  "clave": "tiempoActivoErp",
  "modulos": [
   "admin"
  ],
  "texto": "Los minutos en que la persona estuvo trabajando en el ERP: un minuto cuenta si la pestaña estaba a la vista y movió el mouse, tecleó o tocó la pantalla en los últimos dos minutos. Dejar el ERP abierto sin usarlo no suma. Se cuenta desde el 5 de noviembre de 2026."
 },
 {
  "clave": "tiempoEntregaCotizacion",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Cuándo recibe el cliente. Es obligatorio para enviar la cotización: sin él no se puede mandar por WhatsApp ni por correo. Escoge uno del catálogo, escribe otro, usa el que estima el ERP con la carga del taller («Usar … días hábiles»), o los atajos: «Inmediata (en existencia)» si ya está en almacén, o «Se confirma al recibir el anticipo» si todavía no se sabe."
 },
 {
  "clave": "tiempoParadaOrden",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Cuánto estuvo (o lleva) la máquina fuera de servicio por esta orden, de que se paró a que se cerró, en horas de reloj. «No se paró» quiere decir que no ha dejado de trabajar por esta orden. Las métricas lo cuentan solo en horas laborales."
 },
 {
  "clave": "tiempoProveedor",
  "modulos": [
   "importaciones"
  ],
  "texto": "Cuánto tarda de verdad cada proveedor, de la orden (o la PI) a planta: la mediana de sus embarques. El reabasto usa estos días hábiles en vez del tiempo capturado a mano."
 },
 {
  "clave": "tiempoRespuestaML",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Cuánto se tardan en contestar las preguntas de Mercado Libre (la mediana de los últimos 30 días) y qué parte se contestó en menos de una hora. Es lo que mide el bono de tiempo de respuesta y lo que ML toma en cuenta para la reputación."
 },
 {
  "clave": "tiempoRespuestaPrecio",
  "modulos": [
   "compras"
  ],
  "texto": "Mediana de horas hábiles desde que el vendedor pidió el precio hasta que compras lo contestó, este mes, contra lo que se tardaba cuando se pedía por el chat. Las que siguen abiertas y ya pasaron de un día cuentan como tardadas. «Acuse» es lo que tardó compras en tomarla."
 },
 {
  "clave": "tipoAlmacen",
  "modulos": [
   "admin"
  ],
  "texto": "Físico: una bodega de Hegamex. Mercado Libre (Full): la bodega de Mercado Libre; ahí llega lo que se manda a Full y de ahí salen sus ventas. Un almacén físico nuevo nace disponible para planta; uno de Mercado Libre, no."
 },
 {
  "clave": "tipoArticulo",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Equipo: lo que fabricamos y vendemos completo. Subensamble: un grupo de piezas que se captura una vez y se usa en varios equipos. Componente, materia prima y servicio son lo que se compra; los servicios (vulcanizado, calibración, puesta en marcha…) van en la lista de materiales, pero no se surten del almacén."
 },
 {
  "clave": "tipoCambio",
  "modulos": [],
  "texto": "Cuántos pesos vale un dólar (o un euro). Se toma solo cada día hábil: el dólar del Diario Oficial y el euro del Banco Central Europeo; finanzas o compras pueden capturar otro a mano. Una cotización o un pedido en otra moneda guarda su propio tipo de cambio, y con él se convierte a pesos para sumarlo con lo demás."
 },
 {
  "clave": "tipoCambioCosteo",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Pesos por dólar y por euro con que se costea lo importado. No cambia todos los días: sigue al del día solo cuando éste se aleja 3% o más, o cuando alguien lo captura aquí. Cada vez que cambia se recalculan esos costos y sus precios."
 },
 {
  "clave": "tipoCategoriaCompra",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Cómo cuenta cada categoría de compra. Material: no se suma como gasto cuando ya va en el material de lo vendido (antes del arranque es el material mismo). Gasto de fabricación: del taller, pero no se queda en el equipo. Gasto de operación: vender y administrar. Nómina: sueldos, IMSS y servicios médicos. Impuestos y PTU, e intereses: se restan al final. No es gasto: retiros de socios, préstamos y compra de activos; no se resta. Una categoría nueva cuenta como operación hasta que alguien la clasifique. Desde el arranque, una factura ligada a su orden de compra no cuenta por su categoría sino por sus partidas: «Consumibles del taller» (fabricación), «Material de inventario» o la del proveedor si es de material, y la de la factura para fletes y servicios."
 },
 {
  "clave": "tipoDevolucion",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Devolución: el producto regresa a planta y almacén lo recibe. Reclamo: el cliente reclama y hay que responder antes de la hora límite. Cancelación: se canceló la venta."
 },
 {
  "clave": "tipoDocumentoLeerIA",
  "modulos": [
   "importaciones"
  ],
  "texto": "Dile a la IA qué documento es para que sepa qué datos buscar. Abajo dice qué pasa con cada tipo al guardarlo."
 },
 {
  "clave": "tipoEquipo",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "La familia del equipo: banda transportadora, cribadora, dosificadora, tolva, silo, elevador… Sirve para filtrar el catálogo. Lo cambia ingeniería en «Editar datos»; al cambiarlo, su precio de lista se vuelve a calcular."
 },
 {
  "clave": "tipoIncidencia",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Vacaciones: se restan del saldo. Permiso con goce: se paga y no toca las vacaciones. Permiso sin goce y falta: no se pagan. Incapacidad: la paga el IMSS y cuenta días naturales. Retardo y horas extra: un solo día, en horas."
 },
 {
  "clave": "tipoMantenimiento",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Preventivo: se le da servicio cada cierto tiempo aunque funcione. Predictivo: se revisa su condición (ruido, temperatura, desgaste) para cambiar la pieza antes de que falle. Autónomo: lo hace el mismo operador en su rutina (limpiar, lubricar, revisar)."
 },
 {
  "clave": "tipoMovimiento",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Qué fue: entrada de compra, devolución, salida a producción, venta, consumo, traspaso, ajuste autorizado o saldo inicial. Lo que entra suma (verde) y lo que sale resta (rojo)."
 },
 {
  "clave": "tipoOrdenMto",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Correctivo: una falla que alguien reportó. Preventivo: lo generó solo su plan cuando le tocaba, con el checklist de su rutina si tiene."
 },
 {
  "clave": "tipoPartidaPlanta",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Qué le toca al taller de esta partida. No se fabrica: es un concepto sin artículo del catálogo, como una instalación. Componente: sale del almacén, no lleva orden. Con orden: cada equipo de la partida ya tiene su orden de producción."
 },
 {
  "clave": "tipoServicio",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Instalación, puesta en marcha (arranque), garantía, reparación en planta o servicio en campo. Cada tipo tiene siempre el mismo color en la lista y en el calendario."
 },
 {
  "clave": "tomarSolicitud",
  "modulos": [
   "compras"
  ],
  "texto": "«Tomar» le avisa al vendedor que ya la tienes tú y que estás cotizando. No contesta nada todavía; evita que dos compradores busquen el mismo precio."
 },
 {
  "clave": "topClientesPeriodo",
  "modulos": [
   "analisis"
  ],
  "texto": "Los clientes que más compraron en el periodo. La primera cifra chica es lo que pesa cada uno en la venta; la segunda, lo que juntan del primero hasta él. «Ver 15» muestra más; clic en uno para abrir su ficha."
 },
 {
  "clave": "topeMesesTarjeta",
  "modulos": [
   "admin"
  ],
  "texto": "El monto más alto que el banco deja diferir a meses en una sola transacción. Sale impreso en la cotización, junto a los planes de meses."
 },
 {
  "clave": "topesCaja",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Abajo del mínimo toca reponer el efectivo; arriba del máximo hay dinero que debería estar en el banco."
 },
 {
  "clave": "totalCotizacion",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Lo que paga el cliente, en la moneda en que se cotizó y con IVA (sin IVA si no lleva factura). La suma de abajo es otra cuenta: todo en pesos y sin IVA, para poder sumar pesos y dólares."
 },
 {
  "clave": "trabajoEnProceso",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Etapas que están en proceso ahorita (y cuántas pausadas). En lean es el WIP: mucho trabajo abierto al mismo tiempo alarga el lead time de todos."
 },
 {
  "clave": "trabajoEtapa",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "En promedio, cuántas horas de reloj hubo alguien trabajando la etapa (si dos personas trabajan al mismo tiempo cuenta una vez). Junto con la espera dice dónde se va el tiempo."
 },
 {
  "clave": "trabajoSinFechaTaller",
  "modulos": [
   "analisis"
  ],
  "texto": "Semanas de trabajo de órdenes sin fecha compromiso, como las de stock. En la fila van al final, después de todo lo prometido."
 },
 {
  "clave": "trabajoVencidoTaller",
  "modulos": [
   "analisis"
  ],
  "texto": "Semanas de trabajo de la etapa más cargada en órdenes cuya fecha compromiso ya pasó y siguen en el taller. En la gráfica va en su propia barra, antes de los meses."
 },
 {
  "clave": "traerPendienteML",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Mercado Libre solo avisa lo que pasa después de conectar la cuenta. Este botón trae lo que ya estaba: las preguntas sin contestar y los reclamos abiertos. Un reclamo de una venta que no está en el ERP (de antes de conectar) te llega como aviso para que lo atiendas en Mercado Libre. Las ventas anteriores solo se traen si las ventas están prendidas y eliges desde qué fecha, porque las que ya se capturaron a mano en Pedidos quedarían repetidas. Puedes usarlo las veces que quieras: lo que ya entró no se duplica."
 },
 {
  "clave": "tramoMantenimiento",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Cada vez que alguien le da play a una orden de mantenimiento empieza un tramo, y la pausa lo cierra. Al cerrar la orden, las horas trabajadas son la suma de los tramos de todos los que le dieron play, contadas como las del taller (sin noches, fines de semana ni descansos). Dar play en otra orden pausa la que traías."
 },
 {
  "clave": "tramoPedidoPlanta",
  "modulos": [
   "importaciones"
  ],
  "texto": "Todo el viaje en días naturales: de la orden (o la PI o el anticipo) a planta. En la lista por proveedor es la mediana de sus últimos 5 embarques que llegaron a planta en los últimos 3 años."
 },
 {
  "clave": "tramoPedidoZarpe",
  "modulos": [
   "importaciones"
  ],
  "texto": "Días de la orden (o la PI o el anticipo, lo que haya sido primero) a que zarpó el buque: lo que tarda el proveedor en fabricar y embarcar."
 },
 {
  "clave": "tramoPlantaCuentaGastos",
  "modulos": [
   "importaciones"
  ],
  "texto": "Días que tarda el agente aduanal en mandar la cuenta de gastos (CG) después de que la mercancía llegó a planta. A los 7 días sin ella sale un aviso."
 },
 {
  "clave": "tramoPuertoPlanta",
  "modulos": [
   "importaciones"
  ],
  "texto": "Días de que llegó a puerto a que se recibió en planta: revalidar el BL, previo, pedimento y flete."
 },
 {
  "clave": "tramoTravesia",
  "modulos": [
   "importaciones"
  ],
  "texto": "Días en el mar: del zarpe a que llegó a puerto."
 },
 {
  "clave": "traspaso",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Mover material de un almacén a otro. El total no cambia, solo dónde está. Mandar mercancía al Full de Mercado Libre es un traspaso."
 },
 {
  "clave": "ubicacionesAproximadas",
  "modulos": [
   "analisis"
  ],
  "texto": "Se ubicaron por el nombre corto o largo de un solo municipio («Tepatitlán» por «Tepatitlán de Morelos») y ya salen en el mapa. Si está bien, confírmalo con ✓ y deja de salir aquí."
 },
 {
  "clave": "ubicacionesCorregidas",
  "modulos": [
   "analisis"
  ],
  "texto": "Lo que dirección ya corrigió a mano, con quién y cuándo. «Deshacer» borra la corrección y esos clientes se vuelven a ubicar con lo que escribieron."
 },
 {
  "clave": "ubicacionesFaltaDato",
  "modulos": [
   "analisis"
  ],
  "texto": "La ficha del cliente no tiene ciudad (o ni estado ni ciudad): aquí no hay texto que corregir. Abre sus clientes y captura el dato en su ficha; al guardar se ubica solo."
 },
 {
  "clave": "ubicacionesPorConfirmar",
  "modulos": [
   "analisis"
  ],
  "texto": "El ERP ya los ubicó, pero con duda: por parecido (un error de dedo), porque la ciudad es de otro estado o porque adivinó el estado por la ciudad. Confirma con ✓ o elige otro municipio."
 },
 {
  "clave": "ubicacionesPorResolver",
  "modulos": [
   "analisis"
  ],
  "texto": "El estado o la ciudad escritos no se reconocieron: esos clientes no salen en el mapa (o salen sin municipio). Elige el municipio correcto o márcalo «No se puede»."
 },
 {
  "clave": "ubicacionHoyQuedaEn",
  "modulos": [
   "analisis"
  ],
  "texto": "Dónde se ubica hoy esa combinación: municipio y estado, solo el estado si la ciudad no se reconoció, o una raya si no se sabe nada."
 },
 {
  "clave": "ultimaCompra",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Fecha del último pedido del cliente (o de la última venta en el libro de la hoja, si es más reciente). De clientes de otro vendedor no se muestra."
 },
 {
  "clave": "ultimoAccesoCuenta",
  "modulos": [
   "admin"
  ],
  "texto": "La última vez que inició sesión. La sesión dura semanas, así que puede verse vieja aunque use el ERP a diario: el uso real está en «Uso del ERP»."
 },
 {
  "clave": "ultimoAvisoML",
  "modulos": [
   "admin"
  ],
  "texto": "Cuándo llegó el último aviso de Mercado Libre (una venta, un reclamo o una pregunta que cambió). «Pendientes» son avisos que todavía no se procesan; si alguno falló, el error sale abajo en rojo."
 },
 {
  "clave": "ultimoUsoErp",
  "modulos": [
   "admin"
  ],
  "texto": "La última vez que la persona hizo algo en el ERP (abrir una pantalla, un cambio o una consulta a la IA). No es lo mismo que el último inicio de sesión: la sesión dura semanas sin volver a entrar."
 },
 {
  "clave": "usadoEnEquipos",
  "modulos": [
   "compras"
  ],
  "texto": "En cuántos equipos y subensambles va directamente este artículo. Al guardar su costo, el precio de todos ellos se recalcula en ese momento."
 },
 {
  "clave": "usadoEnListas",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "En cuántas listas de materiales aparece directamente. Un subensamble en ninguna lista todavía no se usa en ningún equipo."
 },
 {
  "clave": "usarEntregaRealista",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Pone esos días hábiles como tiempo de entrega de la cotización, en lugar del que tiene ahora."
 },
 {
  "clave": "usarSubensambleExistente",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Pone un subensamble que ya existe como una línea de 1 pieza. Si marcaste líneas, las quita y deja el subensamble en su lugar; si no son idénticas a las suyas te avisa antes, porque la lista del equipo ya no queda igual. Un cambio en el subensamble llega a todos los equipos que lo usan."
 },
 {
  "clave": "utilidadNeta",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Lo que queda libre del precio de lista después de restar el costo con todos sus recargos y el ISR, como porcentaje del precio. Si sale abajo de lo que pide su política se marca en amarillo para que lo revises (precio fijo, utilidad propia…)."
 },
 {
  "clave": "utilidadPeriodo",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Ventas menos costo de fabricación, gastos de operación e impuestos e intereses registrados. Lo que no es gasto (retiros y gastos personales de los socios, préstamos, compra de activos) no se resta. Solo cuenta lo que se registró en el ERP o en las hojas: lo que se pagó por fuera no está."
 },
 {
  "clave": "utilidadPolitica",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "La utilidad que pide la política. En equipos es neta de ISR: lo que queda libre después del impuesto. En lo que se revende es un margen sobre el precio."
 },
 {
  "clave": "validacionMaterial",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Los cinco pasos antes del taller: ingeniería revisa la lista, se aparta el material, se piden los faltantes, almacén revisa y la gerencia libera. Cada uno guarda quién y cuándo."
 },
 {
  "clave": "valorDelInventario",
  "modulos": [],
  "texto": "Lo que vale todo lo que hay en existencia, en todos los almacenes (incluido el de Mercado Libre), al costo de hoy de cada artículo. «En excedentes» es lo que hay en planta de artículos sin salidas en 12 meses: dinero parado."
 },
 {
  "clave": "valorExistenciasCosto",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Lo que vale lo que hay en planta más lo del Full de Mercado Libre, al costo vigente de cada artículo y sin IVA. Solo lo ve quien tiene permiso de costos."
 },
 {
  "clave": "valorMovimientoInventario",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "La cantidad por el costo que tenía el artículo cuando se registró el movimiento, en pesos y sin IVA. Solo lo ve quien tiene permiso de costos."
 },
 {
  "clave": "valorNetoDiferenciasInventario",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Lo que valen las diferencias al costo de cada artículo, sin IVA: lo que sobra suma y lo que falta resta. En rojo, falta más de lo que sobra. Solo lo ve quien tiene permiso de costos."
 },
 {
  "clave": "valorParametro",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "La medida de este artículo. Al cambiarla se recalculan las cantidades y horas que dependen de ella, solo en este artículo. Para otra medida sin tocar éste, usa «Duplicar con otros parámetros»."
 },
 {
  "clave": "variacionPreciosProveedor",
  "modulos": [
   "compras"
  ],
  "texto": "Cuánto cambió su índice de precios contra hace 12 meses (o contra el primer mes con datos, si hay menos). Rojo: subió más de 10 %; amarillo: subió; verde: igual o bajó."
 },
 {
  "clave": "venceDevolucion",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Lo que corre: en un reclamo, la hora límite para responder; en una devolución, cuándo debe llegar. Rojo si ya pasó, ámbar si falta menos de un día."
 },
 {
  "clave": "vencePago",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "La fecha en que hay que pagar: la fecha de la factura (o la recepción, en una orden de compra) más los días de crédito del proveedor. Lo que traía de 2021 cuenta como vencido. Rojo = vencida; amarillo = vence en 7 días o menos."
 },
 {
  "clave": "venceVacaciones",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "La fecha en que vencen los días que tiene vigentes del periodo más viejo, y cuántos son. Pasada esa fecha se pierden: conviene programarlos antes."
 },
 {
  "clave": "vencido",
  "modulos": [],
  "texto": "Ya pasó su fecha y sigue abierto. Se pinta en rojo; lo que vence hoy, en ámbar."
 },
 {
  "clave": "vencidosSinEntregar",
  "modulos": [
   "analisis"
  ],
  "texto": "Pedidos con fecha compromiso en el periodo que ya pasó y siguen sin entregarse. En el porcentaje a tiempo cuentan como tarde."
 },
 {
  "clave": "vendidoUbicacion",
  "modulos": [
   "analisis"
  ],
  "texto": "Todo lo vendido desde 2018 a los clientes de esa combinación, con IVA. La lista va de más a menos: corrige primero lo que más pesa."
 },
 {
  "clave": "ventaAnalisis",
  "modulos": [
   "analisis"
  ],
  "texto": "Importe con IVA de lo vendido, con la misma regla que el tablero de inicio: hasta el arranque del ERP, el libro de ventas de la hoja; desde entonces, los pedidos del ERP sin los cancelados."
 },
 {
  "clave": "ventaMovil12",
  "modulos": [
   "analisis"
  ],
  "texto": "Cada punto suma los 12 meses que terminan ahí. Quita la estacionalidad y deja ver si la venta va para arriba o para abajo."
 },
 {
  "clave": "ventaPerdidaZona",
  "modulos": [
   "analisis"
  ],
  "texto": "Lo que se dejó de vender ahí: lo del periodo anterior menos lo de este."
 },
 {
  "clave": "ventasAnio",
  "modulos": [],
  "texto": "Lo vendido en el año, con IVA y en pesos. Antes del arranque del ERP sale del libro de ventas de la hoja; después, de los pedidos. La flecha compara contra el mismo tramo del año pasado."
 },
 {
  "clave": "ventasContraAniosAnteriores",
  "modulos": [],
  "texto": "Cada barra es lo vendido en un mes de este año, con IVA; la línea sólida es el mismo mes del año pasado y la punteada, el de hace dos años. Sirve para ver si un mes flojo es de temporada o de verdad viene abajo."
 },
 {
  "clave": "ventasDelArticulo",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Cada pedido que trajo este artículo, con el precio por pieza ya con su descuento. Compáralo con el precio de lista que regía ese día en la gráfica de arriba: así ves si los cambios de precio se notaron al vender."
 },
 {
  "clave": "ventasDelMes",
  "modulos": [],
  "texto": "Pedidos no cancelados con fecha de este mes, sin IVA y en pesos. La flecha compara contra el mismo tramo del mes pasado (del día 1 al día de hoy), no contra el mes completo."
 },
 {
  "clave": "ventasHistoricasImportadas",
  "modulos": [
   "admin"
  ],
  "texto": "Las ventas de los paneles de ventas de la hoja, traídas como pedidos ya entregados y marcados como históricos (cada venta en una sola partida). Con ellas cada cliente trae su historia de compras."
 },
 {
  "clave": "ventaSinClasificar",
  "modulos": [
   "analisis"
  ],
  "texto": "Ventas que no cayeron en ninguna familia: textos de la hoja que ninguna regla atrapó y partidas del ERP sin familia en su categoría ni en su texto. El porcentaje clasificado es sobre el dinero del periodo; mientras más alto, más confiables las gráficas por familia. La lista «Sin clasificar» junta los textos de toda la historia de la hoja."
 },
 {
  "clave": "ventaSinUbicar",
  "modulos": [
   "analisis"
  ],
  "texto": "Venta de clientes cuyo estado o ciudad no se reconoció: cuenta en el total pero no sale en el mapa. Se arregla en «Ubicaciones por revisar»."
 },
 {
  "clave": "ventasMLActivas",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Si las ventas de Mercado Libre entran solas como pedidos (con su envío). Apagado, las ventas no entran al ERP, pero las preguntas y los reclamos sí. Lo prende o apaga dirección; al prenderlo, «Traer lo pendiente» puede traer las ventas desde una fecha."
 },
 {
  "clave": "ventasResultados",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Lo vendido en el periodo, sin IVA. Desde el arranque del ERP (12 oct 2026): las partidas de los pedidos con fecha en el periodo, sin cancelados; las de dólares, con su tipo de cambio. Antes: el libro de ventas de la hoja, sin IVA si tuvo factura, con la línea según la familia del producto. Las de Mercado Libre desde el 30 oct 2025 salen de lo que pagó el comprador en Mercado Pago, sin IVA, porque la hoja solo anotaba las facturadas. Es la misma regla de Análisis."
 },
 {
  "clave": "ventasSemana",
  "modulos": [],
  "texto": "Lo vendido la semana pasada (lunes a domingo), con IVA y en pesos, contra la semana anterior a esa. Si eres vendedor, solo cuenta lo de tus clientes."
 },
 {
  "clave": "ventaTresAnios",
  "modulos": [
   "analisis"
  ],
  "texto": "Lo que compró en esos mismos 3 años, con IVA. Con esto se decide quién está entre los que más compran."
 },
 {
  "clave": "verComo",
  "modulos": [
   "admin"
  ],
  "texto": "Dirección puede ver el ERP con los permisos de otro rol para revisar qué ve esa gente; lo que guarde mientras tanto es real y queda a su nombre. Dirección y sistemas también pueden abrir la sesión de una persona en otra pestaña, solo para ver: no deja guardar nada y queda registrado."
 },
 {
  "clave": "verContenidoSubensambles",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Despliega lo que lleva cada subensamble, en gris. Ahí no se edita: se cambia en el propio subensamble, porque el cambio llega a todos los equipos que lo usan."
 },
 {
  "clave": "versionCosteoImportacion",
  "modulos": [
   "importaciones"
  ],
  "texto": "Cada cálculo es una versión. En borrador se puede volver a calcular (el borrador anterior se reemplaza); cerrado ya quedó. Dale clic para ver su detalle."
 },
 {
  "clave": "verTodoElTaller",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Apagado, solo salen las personas que van a algún servicio en estas dos semanas. Prendido, sale también el resto de la gente activa de las áreas del taller, para ver quién está libre."
 },
 {
  "clave": "vigenciaCotizacion",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Días que vale la cotización desde su emisión. Si pasa la fecha “Vence” sin cerrarse, se marca Vencida en rojo."
 },
 {
  "clave": "vigenciaPrecioSolicitud",
  "modulos": [
   "compras"
  ],
  "texto": "Hasta qué día sostiene el proveedor ese precio. Compras la pone al contestar (de entrada, 15 días); pasada la fecha, conviene confirmarlo antes de cerrar la venta."
 },
 {
  "clave": "visitasML",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Cuántas veces se vio la publicación en los últimos 30 días, según Mercado Libre."
 },
 {
  "clave": "vistaCalendario",
  "modulos": [],
  "texto": "Mes: la cuadrícula de lunes a domingo; en cada día caben 3 cosas y «+N más» dice cuántas no cupieron. Semana: siete columnas con todo lo de cada día. Lista: el mes día por día, sin cuadrícula (así abre en el celular)."
 },
 {
  "clave": "vistaPorCuadrilla",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Una columna por cuadrilla con lo que trabaja ahorita y lo que le sigue, como el tablero de Luis. La cuadrilla se arma sola: la gente que trabaja junta ahorita sale en la misma columna, con sus primeros nombres («Isidro y César»); si nadie ha arrancado, la que empieza junta lo siguiente. Abajo, en «Después», va lo que sigue de cada quien: cada tarjeta dice quién la trabaja. El nombre cambia solo cuando cambia la gente. Al final, «Sin cuadrilla» junta lo que nadie tiene asignado."
 },
 {
  "clave": "vistaPorEtapa",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Una columna por etapa (Corte, Pailería, Pintura…) con lo que se trabaja, lo pausado y lo que ya puede empezar. Sirve para ver cómo va cada área del taller."
 },
 {
  "clave": "vistaPreviaCotizacion",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Te enseña la hoja tal como la recibe el cliente, sin salir del editor; antes guarda lo último que escribiste. No la envía ni le cambia el estado. Con el freno de seguimientos no se abre si la cotización todavía no se envía."
 },
 {
  "clave": "vistaTableroOportunidades",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Tablero: una columna por etapa, para arrastrar las tarjetas. Lista: todas en una tabla que se ordena y se descarga a CSV, incluidas las ganadas y perdidas de hace más de 60 días. Se queda la que elijas."
 },
 {
  "clave": "volumenOrdenConsolidado",
  "modulos": [
   "importaciones"
  ],
  "texto": "En un consolidado, el volumen que da el forwarder para cada proveedor (m³ o su %). Con él se reparten los gastos que se capturan «por volumen»."
 },
 {
  "clave": "volverPrecioLista",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Regresa el precio de la partida al de lista de hoy, convertido a la moneda de la cotización (y con IVA si la cotizas con IVA incluido)."
 },
 {
  "clave": "whatsappSeguimientoCotizacion",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Abre el chat con el contacto de la cotización, sin mensaje escrito. Abrirlo no cierra el seguimiento: cuando te conteste, anota qué pasó."
 },
 {
  "clave": "yaDebioEmpezar",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Según el plan, esta etapa ya tenía que haber empezado y en el piso todavía no se inicia."
 },
 {
  "clave": "yaEsCliente",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Mientras escribes el teléfono, la empresa o el nombre, se busca entre los clientes. Solo dice el nombre, la ciudad y de qué vendedor es; nada de ventas ni saldos. Si escoges «Es este» y tiene vendedor vigente, el lead le llega directo a él."
 },
 {
  "clave": "zonasFrias",
  "modulos": [
   "analisis"
  ],
  "texto": "Lugares que compraban en el periodo anterior y cayeron 30 % o más (o dejaron de comprar). Salen hasta 8, los que más dejaron de vender primero, con los clientes que ya no compraron ahí para llamarles."
 },
 {
  "clave": "zoomGantt",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Cuánto tiempo cabe en la pantalla: días, semanas o meses. Se queda como lo dejes para la próxima vez."
 }
];

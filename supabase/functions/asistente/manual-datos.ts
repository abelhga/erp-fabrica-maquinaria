// Generado desde src/tutorial con `npm run manual`. No se edita a mano: se cambia el tutorial.
import type { ConceptoManual, PantallaManual } from "./manual.ts";

export const PANTALLAS_MANUAL: PantallaManual[] = [
 {
  "ruta": "/",
  "nombre": "Inicio",
  "modulos": [],
  "nivel": 1,
  "texto": [
   "Es tu punto de partida del día. Lo que ves depende de tu puesto: dirección ve el centro de mando de toda la empresa; los demás ven solo lo que le importa a su área (ventas sus ventas y cotizaciones, finanzas lo que se cobra y se paga, importaciones sus embarques, producción el taller, recepción los leads que registró…). Si tienes dos puestos, ves lo de los dos.",
   "Arriba, “Lo que importa hoy” junta lo urgente de tu área: en rojo los riesgos, en ámbar lo que pide atención, en verde lo que va bien. Dale clic a una tarjeta para ir directo a donde se atiende; el botón de flechas lo vuelve a analizar. A almacén le sale primero «Por surtir»: las órdenes con material pendiente, en el orden en que el taller las va a trabajar. A los supervisores de piso les sale lo del taller y a mantenimiento lo de las máquinas (paradas, fallas sin atender, preventivos vencidos o por vencer, herramienta sin regresar), calculado por reglas, sin IA.",
   "Casi todos los indicadores se abren con un clic y te llevan a la lista de donde salen (Ventas del mes abre los pedidos, por ejemplo). Todo se calcula con tus permisos: un vendedor ve lo suyo, no el total de la empresa.",
   "En el tablero de área, la tarjeta “Pendientes” reúne lo que espera algo de ti según tu puesto: lo que la revisión de la madrugada encontró en algo tuyo, precios por autorizar, seguimientos de cotizaciones vencidos o para hoy (a la gerencia, los del equipo y quién está frenado), tareas con clientes vencidas, ajustes de inventario, compras atrasadas, documentos de embarques que faltan. En el centro de mando las cifras se actualizan solas cuando alguien registra un pedido, un cobro o un avance del taller; abajo del embudo comercial ves cómo va cada vendedor con el seguimiento de sus cotizaciones y quién está frenado.",
   "El ERP recuerda cómo dejaste las cosas: el orden de cada lista (la columna por la que ordenaste), «Agrupar por» en el material de una orden y la vista y el zoom del Gantt. Los filtros y las búsquedas no se recuerdan, para que nunca se te esconda algo sin darte cuenta. Se guarda en tu computadora o celular, por persona.",
   "Los lunes, si hay, te salen «Tus consejos de la semana»: hasta tres, escritos por la IA con tus propios números (cómo capturas, y si vendes, qué podrías probar para cerrar más). Solo los ves tú. Dale «Me sirve» o «No me sirve»: los de la semana siguiente lo toman en cuenta."
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
   "Aquí ves cómo anda el almacén: lo que se surte a las órdenes, lo que sale fuera de su lista, cuánto consumible se lleva cada persona y si cuadra con las recetas, los ajustes y qué tan exactos salen los conteos. La usan almacén, compras, la gerencia de producción y dirección.",
   "Arriba eliges el periodo (30 días, 90, 6 o 12 meses). Pasa el mouse por cada indicador para ver de dónde sale. La gráfica cuenta partidas por semana: las de la lista de la orden, las que salieron fuera de lista y las de consumo del taller.",
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
   "Historial filtra por tipo, almacén, persona y fechas (al abrir, los últimos 30 días) y se baja a Excel. «Recibió» es quién se llevó el material; «Quién» es quién lo registró. En Ajustes pides una corrección cuando lo del estante no cuadra, y la gerencia la aprueba o la rechaza. En Conteos físicos abres un conteo por almacén, capturas lo contado renglón por renglón (Enter guarda y baja al siguiente) y, al cerrarlo, cada diferencia se vuelve un ajuste por autorizar.",
   "Nada se edita ni se borra. Si te equivocaste, no lo vuelvas a capturar al revés: pide un ajuste. La fecha, la hora y tu nombre los pone el sistema, así que no se puede capturar con fecha atrasada ni a nombre de otro."
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
   "Todo lo que tiene fecha y te toca ver, en un solo lugar: entregas de pedidos, cierres de oportunidades y llamadas, compras y embarques que llegan, envíos por recolectar, compromisos del taller y cuándo termina cada orden según el plan, servicios, preventivos, herramienta por devolver, pagos, vacaciones, cumpleaños y tus pendientes. No se captura nada aquí: cada cosa sale de su pantalla.",
   "Cada quien ve lo de su puesto: un vendedor ve sus entregas y sus llamadas, no las compras; los pagos solo los ve finanzas. Lo que ya se cerró no sale; lo que ya pasó su fecha y sigue abierto sale en rojo («atrasado»).",
   "Arriba eliges Mes, Semana o Lista y te mueves con las flechas; «Hoy» te regresa. Los colores son las áreas: toca una para esconderla. «Solo lo mío» deja lo que está a tu nombre. Dale clic a un día para ver todo lo de ese día, y a una línea para ir a su pantalla."
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
   "Busca por clave o nombre y dale clic a un renglón para abrir su ficha. Las pestañas separan Equipos, Subensambles y Solicitudes de cambio (las correcciones que manda producción desde una orden). El filtro «Sin lista de materiales» te dice qué falta capturar, y el botón CSV baja la tabla para Excel.",
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
   "Antes del 12 de octubre de 2026 los números salen de las hojas (ventas y compras como se registraron ahí, cada compra por la categoría de su proveedor); desde ahí, del ERP, donde una factura ligada a su orden de compra cuenta por sus partidas: los consumibles del taller como gasto de fabricación y el material en lo vendido. Los números con ≈ son estimados: lo vendido de la hoja no tiene costeo y la nómina de la hoja se reparte entre taller y oficina con la proporción de hoy. La tabla de abajo dice de dónde sale cada número, y lo que no es gasto (retiros de socios, préstamos, compra de activos) se enseña aparte sin restarse.",
   "En «Categorías de compra» decides cómo cuenta cada categoría: material, gasto de fabricación, gasto de operación, nómina, impuestos, intereses o «no es gasto». Finanzas la cambia; el cambio se ve en todos los periodos."
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
   "Arriba ves el siguiente paso, la llegada (ETA o fecha real, y cuándo se espera en planta) y, ya que arribó, los días libres en puerto y del contenedor. En Etapas se captura la fecha real de cada paso (Enter guarda; no acepta fechas futuras, para eso está la ETA). Documentos es la lista de lo que necesita este embarque, con quién debe cada uno; los marcados \"antes del arribo\" los pide el agente aduanal antes de que llegue.",
   "\"Leer con IA\" lee un PDF o una foto (proforma, factura, packing list, BL, pedimento, cuenta de gastos) y te propone los datos junto al archivo; nada se guarda hasta que lo revisas y confirmas. Las pestañas de dinero y costeo solo aparecen si tu puesto las ve."
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
   "Aquí ves lo que te pidieron a ti y lo que tú les pediste a otros, con fecha. Reemplaza el “¿ya quedó?” por chat: cuando alguien termina, a quien lo pidió le llega un aviso en la campana.",
   "“Me tocan” son los tuyos: dale clic al círculo para marcarlo hecho y, si quieres, deja una respuesta corta (un precio, una fecha). “Los que pedí” son los que esperas de otros; si ya no hace falta, cancélalo con la X. La flecha te lleva al pedido, orden o pantalla de donde salió.",
   "Algunos los pone la revisión nocturna (dicen «De Revisión nocturna»): son errores urgentes en algo tuyo. Márcalo hecho cuando lo corrijas; si no es error, contéstalo en «Por revisar» con «Está bien así».",
   "La fecha sale en ámbar si vence hoy y en rojo si ya venció; mientras siga vencido, el sistema les recuerda a los dos. Para pedir algo nuevo usa “Pedir algo a alguien”: qué hay que hacer, quién y para cuándo. Puedes agregar a varias personas y elegir si basta con que uno lo haga o si cada quien lo tiene que hacer.",
   "Arriba ves tu propio cumplimiento de los últimos 30 días: qué tanto cierras a tiempo, a cuántas personas tienes esperando algo tuyo, cuántos días de retraso suman tus vencidos y cuánto tardas en cerrar. Dirección y Recursos Humanos ven además la pestaña “Equipo” con el de todos.",
   "Dale clic a un pendiente para abrir su ficha. Si te falta un dato para terminarlo, pregúntale ahí a quien te lo pidió: le llega un aviso y, mientras contesta, el pendiente dice “Esperando respuesta” y no cuenta como retraso tuyo. Si alguien te preguntó en algo que pediste, arriba sale “Te preguntaron”: contesta en su ficha."
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
   "La tablet de cada estación del taller: muestra lo que se trabaja en su etapa, en el orden de la cola que acomoda la gerencia en Cuadrillas o en el Gantt, y con botones grandes se inicia, pausa, reanuda o termina cada orden, o se reporta un problema. La usan los encargados de piso.",
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
   "Cada madrugada el ERP revisa lo que se capturó y te deja aquí lo que parece un error en algo tuyo: un artículo o un cliente dado de alta dos veces, un pago capturado dos veces, una compra que ya debió llegar y no se recibió, un costo muy distinto al de la última compra, etapas que se terminaron sin pasar por la terminal. Si sale algo, a las 6 de la mañana te llega un aviso.",
   "Lo urgente (un pago repetido, una compra con un cero de más, una compra muy atrasada) también te llega a Pendientes, para el siguiente día hábil: ahí se pone rojo si se vence y cuenta para tu cumplimiento. Contestarlo en cualquiera de los dos lados cierra el otro; si no era error, «Está bien así» lo cancela y no cuenta para nadie.",
   "Contesta cada uno: «Ya lo corregí» si lo arreglaste, «Está bien así» si no es error (escribe por qué y no vuelve a salir algo igual), o «Corrígelo» cuando el ERP puede hacer la corrección por ti con tus permisos. «Abrir» te lleva al registro. Lo que se arregla solo (una compra que por fin se recibe) se cierra sin que hagas nada.",
   "Lo que dice «Regla» lo encontró una regla fija; lo que dice «IA» (con destellos ✦) lo señaló la IA al leer lo de ayer. Ninguno cambia nada sin que tú lo digas. En «Contestado» ves lo que ya respondiste.",
   "Dirección ve además los patrones (consumos que se disparan, ajustes a la baja que se repiten, gastos iguales en caja chica), que nunca le llegan a la persona; todo lo abierto con a quién le toca; lo que la IA leyó anoche de cada módulo; los consejos que recibió cada quien y si les sirvieron; y puede apagar la revisión, la IA, los consejos o cada regla."
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
   "Tu resumen de los lunes: lo que pasó la semana pasada comparado con la anterior, y lo que viene en esta. Sirve para preparar la junta o para saber de un vistazo cómo vamos.",
   "Arriba, “La semana en una frase” la narra la IA con los números (o las reglas del ERP si no está conectada); el botón de flechas la vuelve a escribir. En las tarjetas, el porcentaje compara contra la semana anterior: verde si subió, rojo si bajó.",
   "La agenda “Esta semana” sale del calendario: todo lo que tiene fecha de lunes a domingo y tu puesto puede ver (entregas, lo que llega, taller, servicios, pagos, vacaciones, tus pendientes). Lo que ya pasó su fecha y sigue abierto sale en rojo. Dale clic a un renglón para ir a su pantalla, o a «Abrir el calendario» para ver más allá de esta semana.",
   "Si eres vendedor, las ventas y “Quién compró más” son solo de tus clientes. Las ventas de esta pantalla van con IVA, como en el libro de ventas de la hoja."
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
   "El catálogo de máquinas, herramienta y vehículos del taller: en qué estado está cada una, cuánto ha fallado y qué mantenimiento preventivo le toca. La lleva mantenimiento (o la gerencia de producción); el personal de producción reporta fallas y presta herramienta.",
   "El estado no se captura: sale de las órdenes de mantenimiento abiertas. Operando, Con falla (sigue trabajando pero alguien reportó algo), Parada (la falla la detiene) y En reparación. \"Reportar falla\" abre el formulario rápido y \"Resguardos\" lleva la herramienta prestada.",
   "Pestañas: Máquinas (clic abre su ficha), Órdenes abiertas (fallas y preventivos; clic abre el detalle a un lado) y Preventivos. Un preventivo se programa por fecha, por horas de uso o lo que pase primero, y su orden se genera sola con el checklist de su rutina.",
   "Al abrir una orden preventiva, cada punto del checklist se marca Bien o Falla (con qué tiene); la orden no se cierra mientras falte alguno. Al cerrarla, mantenimiento anota qué se hizo y las horas que le dedicó (no las que estuvo parada la máquina)."
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
   "Fallas y tiempo parada cuentan los últimos 12 meses. \"Criticidad\" va de muy alta a muy baja; muy alta o alta es crítica: si se para, se para el área. También dice el tipo de mantenimiento (preventivo, predictivo o autónomo), quién lo hace y, si es herramienta que siempre trae la misma persona, a quién está asignada. Si tiene horómetro, registra sus horas con \"Registrar horas\": la lectura no puede ser menor que la anterior y, al guardarla, si ya toca un preventivo por horas, su orden sale en ese momento.",
   "En \"Plan preventivo\" mantenimiento o la gerencia agregan o editan los planes (cada tantos días, cada tantas horas o lo que pase primero) y le ponen su rutina: la lista de puntos que se palomean. La orden se genera sola: por fecha, unos días antes de vencer; por horas, al llegar a ellas.",
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
   "«Las que más paran» dice dónde se va el tiempo de máquina; «Vuelven a fallar», las reparaciones que no duraron 30 días. En «Por máquina» ves todo por máquina (clic abre su ficha) y lo descargas en CSV.",
   "Los números salen de las órdenes de mantenimiento: cuándo se reportó, cuándo se paró y volvió la máquina, cuándo se cerró y las horas del técnico. Si una orden se cierra sin esos datos, no cuenta bien. Quien ve costos también ve lo que costó cada máquina."
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
   "\"Prestar herramienta\" registra quién se la lleva, para qué servicio y cuándo debe regresar. \"Recibir\" la cierra con su estado: bien, dañada o incompleta; si regresa dañada o incompleta, la falla se reporta sola. Una máquina parada o en reparación no se presta.",
   "Sale en rojo lo que pasó de su fecha de regreso o lleva más días fuera que el límite. El límite lo cambias junto a los filtros (\"Marcar después de … días\")."
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
   "Filtra por qué se cambió, quién, el tipo de acción y las fechas. Dale clic a un renglón para ver el antes y el después de cada dato, la historia completa de ese registro y, si existe, un enlace para abrirlo. El CSV baja lo que ves.",
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
   "Para facturar bien captura RFC, régimen, CP fiscal y uso de CFDI, o llénalos con la constancia de situación fiscal. “Nueva cotización” sale ya ligada a este cliente."
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
   "Si un precio queda abajo del mínimo, la partida se marca en rojo y la cotización pasa a “Por autorizar”: pide la autorización a la gerencia antes de enviarla. Ya enviada no se edita; para cambiarla saca una nueva versión.",
   "El botón principal cambia según el estado: Enviar (por WhatsApp o PDF; la deja como enviada y agenda preguntar qué pasó en 3 días hábiles; con más de 10 seguimientos vencidos no deja enviar, ni sacar el PDF o la vista previa de una cotización que todavía no envías, hasta ponerte al día), Convertir a pedido (eliges partidas y fecha compromiso) o Nueva versión. En el menú “···” están imprimir, duplicar y marcar rechazada con su motivo. “Vista previa” te enseña la hoja tal como la recibe el cliente sin salir del editor. Si el equipo tiene más fotos, salen en miniatura bajo la partida y en la hoja de fotos al final del PDF; pasa el mouse por una y con la × la quitas de esta cotización.",
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
   "Con «Registrar lead» anotas quién es, su teléfono o correo y qué busca, con sus palabras. Mientras escribes el teléfono o la empresa te dice si ya es cliente y de quién; si lo es y dices «Es este», le llega directo a su vendedor. Enter lo guarda.",
   "A quién le llega lo demás depende de cómo lo dejó la gerencia: en bandeja se avisa a los vendedores y el primero que lo toma se lo queda; o la gerencia lo asigna; o quien lo registra escoge al vendedor. Si nadie lo toma o nadie lo atiende a tiempo, se le avisa a la gerencia.",
   "Dale clic a un lead para ver sus datos, llamarle o escribirle por WhatsApp. El vendedor que lo tiene lo vuelve oportunidad con «Crear oportunidad» (si no era cliente, se da de alta) o lo descarta con el motivo. Quien lo registró ve en «Los que registré» quién lo tomó y en qué etapa va la oportunidad."
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
   "“Pedido sin cotización” es para ventas de Mercado Libre, sitio web o mostrador: eliges cliente, canal y número de venta, y en el siguiente paso agregas las partidas con su precio de lista. Abajo ves el total y lo por cobrar de lo filtrado, en pesos, y aparte lo que tus clientes ya debían en la hoja (los pedidos que vienen de la hoja se cobran contra eso).",
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
  "clave": "agregarEtapa",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Agrega a esta orden una etapa que le falta, con sus horas y el porqué. Las etapas de una orden salen de las horas por etapa del equipo; si el equipo no trae una (por ejemplo Detallado), la orden se termina al acabar la anterior. La agrega la gerencia de producción y queda pendiente para el taller; si la orden ya estaba terminada, regresa a «en proceso» y su pedido deja de estar listo. Solo cambia esta orden: para que las siguientes la traigan, ingeniería la agrega al equipo."
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
  "clave": "ahorroHorasMes",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Cuántas horas de trabajo al mes se ahorran con la mejora, según la estima quien la lleva. Es una estimación, no una medición: sirve para ver qué mejoras rinden más."
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
  "texto": "La única forma de corregir una existencia. Lo pide quien encontró la diferencia y lo autoriza la gerencia de producción, dirección o el jefe de almacén; quien lo pidió no se lo autoriza (salvo dirección). Hasta entonces la existencia no cambia."
 },
 {
  "clave": "alcanceRol",
  "modulos": [],
  "texto": "Los números salen con tus permisos: un vendedor ve lo de sus clientes; la gerencia y dirección ven toda la empresa. Por eso dos personas pueden ver cifras distintas en la misma pantalla."
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
  "texto": "Avisos que arma el sistema solo: documentos que faltan cerca del arribo, días libres por acabarse, cambios de ETA y, si ves dinero, pagos retenidos o sin comprobante y dinero por recuperar. Rojo es riesgo; ámbar, atención."
 },
 {
  "clave": "almacenParaPlanta",
  "modulos": [
   "admin"
  ],
  "texto": "Si lo que hay en ese almacén cuenta para producción y para el cotizador. El Full de Mercado Libre existe, pero no está disponible para planta."
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
  "clave": "aprovechamientoTaller",
  "modulos": [
   "admin"
  ],
  "texto": "Qué parte de las horas de la gente se va de verdad a órdenes. Descuenta faltas, vacaciones, limpieza, esperar material y juntas. Empieza en 85 %; se afina comparando con las horas que registra la terminal. Lo pone la gerencia de producción."
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
  "clave": "armarMes",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Crea el borrador del mes para cada persona con puesto asignado y vuelve a medir los borradores con los datos de hoy. Lo ya calificado no se toca. Al empezar cada mes se hace solo para el mes que terminó."
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
  "clave": "asignarStock",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Si ya hay un equipo igual fabricándose (o terminado) para stock, la gerencia lo asigna a esta partida con «Usar»: la orden pasa a ser del pedido, con su número de serie, y ya no hay que fabricar otro."
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
  "clave": "bultosEnvio",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Cuántos paquetes lleva y su peso total. Salen del empaque guardado en cada artículo; \"sin medir\" son paquetes a los que les faltan medidas."
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
  "clave": "cambioCosto",
  "modulos": [
   "compras"
  ],
  "texto": "Cuánto sube o baja el costo nuevo contra el actual, comparado en pesos. Rojo: sube más de 10 %. Amarillo: sube. Verde: baja. Con un triángulo, el cambio pasa de 50 %: revisa que la unidad y la moneda sean las mismas."
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
  "clave": "canalesEnLinea",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Precio sugerido con IVA para cada canal (Mercado Libre, sitio web…): parte del precio de lista y le suma la comisión del canal, la cuota fija y el envío. «Abajo del sugerido» avisa que una publicación está más barata que eso."
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
  "clave": "cantidadEfectiva",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Lo que de verdad lleva el equipo: la cantidad fija más lo que suma el parámetro, redondeada hacia arriba si está marcado, y con la merma. Pasa el mouse sobre la cifra para ver la cuenta."
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
  "clave": "cargaPersona",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Horas de trabajo que esta persona tiene encima: de cada etapa donde está (trabajando o planeada), lo que falta repartido entre su cuadrilla. Sirve para ver quién va a quedar libre primero."
 },
 {
  "clave": "cargaSemanal",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Cuánto trabajo tiene cada área por semana: producción liberada más horas en servicio, contra lo que el área puede trabajar. Las órdenes atrasadas cuentan completas en esta semana."
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
  "clave": "cerrarSemana",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Al cerrar la semana se congelan los renglones, se descuentan los préstamos y se marcan pagados los bonos que ya tienen base. Después ya no cambia: un error se corrige en una semana abierta con otro concepto."
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
  "clave": "checklistMantenimiento",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Los puntos de la rutina en esta orden. Cada uno se marca bien, o con falla y qué tiene. La orden no se cierra mientras quede alguno sin revisar."
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
  "clave": "clientesNuevosRecurrentes",
  "modulos": [
   "analisis"
  ],
  "texto": "Nuevo: su primera compra fue ese año. Recurrente: ya había comprado antes."
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
  "clave": "concentracionTop3",
  "modulos": [
   "analisis"
  ],
  "texto": "Qué parte de la venta juntan los 3 estados (o municipios) que más vendieron. Muy alto quiere decir que dependes de pocos lugares."
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
  "clave": "conteoFisico",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Contar lo que hay en un almacén, artículo por artículo. Al cerrar el conteo, cada diferencia se vuelve un ajuste por autorizar; lo que no se contó no se ajusta."
 },
 {
  "clave": "contestarSolicitud",
  "modulos": [
   "compras"
  ],
  "texto": "Contestar es capturar el costo que dio el proveedor: entra al catálogo con su historial, el precio de lista se recalcula solo y el vendedor lo ve en su cotización. La nota para el vendedor nunca lleva costos."
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
  "clave": "convertirLead",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Atenderlo es volverlo oportunidad: si ya era cliente va a su cuenta; si no, eliges la empresa si ya existe o se da de alta como cliente nuevo con este contacto. La oportunidad nace en Prospecto, a tu nombre, y quien registró el lead ve en qué etapa va."
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
  "clave": "costoMasViejo",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "La fecha del costo más antiguo entre las piezas del equipo. Si pasa de un año se marca en amarillo: el costo del equipo ya no es el de hoy."
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
  "texto": "El costo con el que se calcula hoy: el último que se capturó, a mano, al contestar una solicitud de precio o al recibir una orden de compra."
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
  "clave": "criticidadMaquina",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Qué tanto afecta si la máquina se para, de muy alta a muy baja (como en el programa de mantenimiento). Muy alta o alta cuenta como crítica: si se para, se para el área, y sus fallas van primero."
 },
 {
  "clave": "cuadrilla",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Las personas del taller que salen al servicio. Una persona no puede estar en dos servicios que se enciman, ni salir con vacaciones o incapacidad aprobadas. La corona marca al jefe de cuadrilla."
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
  "clave": "cuentaActiva",
  "modulos": [
   "admin"
  ],
  "texto": "Activa: puede entrar con sus roles. Desactivada: no ve ni hace nada, aunque tenga la sesión abierta; sus roles se guardan para cuando regrese. En rojo si RRHH ya lo dio de baja y su cuenta sigue abierta."
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
  "texto": "Días que la naviera presta el contenedor sin cobrar, desde el arribo hasta que se devuelve vacío. Al pasarse se pagan demoras."
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
  "clave": "descansosTaller",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Lo que se descuenta del horario cada día. Si el descanso va por turnos (unos desayunan de 10:00 a 10:40 y otros de 10:20 a 11:00), se pone la ventana completa y cuánto dura: de lo que un tiempo abierto cubra de esa ventana, se descuenta la parte que dura el descanso."
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
  "clave": "desperdicioLean",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Lo que la mejora quita, según los ocho desperdicios de lean: espera (gente o equipos parados), transporte (mover material de un lado a otro), movimiento de más (buscar, agacharse, dar vueltas), inventario de más, sobreproceso (hacer más de lo que el cliente necesita), sobreproducción (hacer antes o más de lo pedido), defectos y retrabajo, y talento no aprovechado."
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
  "clave": "devolucionDanada",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Herramienta que regresó dañada o incompleta. Al recibirla así, la falla se reporta sola."
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
  "texto": "Días que el puerto deja la mercancía sin cobrar almacenaje. La barra se pone ámbar a 3 días de acabarse y roja al pasarse: desde ahí se paga."
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
  "texto": "Qué parte del periodo la máquina estuvo lista para trabajar: 1 menos las horas que estuvo fuera de servicio entre las horas del periodo (horas de calendario, como se captura el paro). Verde arriba de 98 %, ámbar arriba de 95 %, rojo abajo. «Críticas» es lo mismo solo de las máquinas de criticidad alta o muy alta."
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
  "clave": "documentosAntesArribo",
  "modulos": [
   "importaciones"
  ],
  "texto": "Los que el agente aduanal necesita antes de que la mercancía llegue (factura, packing list, BL…). Si faltan a pocos días del arribo, salen como riesgo."
 },
 {
  "clave": "duplicarConParametros",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Hace una copia del equipo con su lista, horas y parámetros, para otra medida. Los subensambles no se copian: la copia usa los mismos."
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
  "texto": "Días hábiles que tarda en entregar desde que se le manda la orden. Sin dato se usa 7. De aquí sale la fecha de entrega de sus órdenes."
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
  "clave": "equipoHistorico",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Equipo que viene del libro de seriales de la hoja (desde 2015): se puede buscar y dar servicio, pero no tiene orden de producción en el ERP. ERP = lo numeró el ERP."
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
  "clave": "escalaCuantiles",
  "modulos": [
   "analisis"
  ],
  "texto": "Cada tono junta un número parecido de regiones (o de celdas): así un estado muy grande no deja a los demás en el mismo color pálido. Gris: sin venta."
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
  "clave": "estacionalidadVenta",
  "modulos": [
   "analisis"
  ],
  "texto": "Qué meses pesan más en la venta del año. La meta de cada mes se reparte con lo que pesó ese mes en los últimos 3 años completos."
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
  "clave": "estadoEnvio",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "En qué paso va: Por cotizar, Cotizado, Guía lista, Empacado, En camino, Entregado o Cancelado. Lo que recoge el cliente o surte Full se salta los pasos de guía."
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
  "clave": "estadoReabasto",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Ordenar: está abajo de su punto de reorden. OK: alcanza. Excedente: no se usó en 12 meses y hay existencia (dinero parado). Negativo: la existencia en planta es menor que cero."
 },
 {
  "clave": "estadoServicio",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Por programar (se pidió y nadie le ha puesto fecha), Programado (tiene fecha y cuadrilla), En curso, Cerrado o Cancelado."
 },
 {
  "clave": "estadoSolicitud",
  "modulos": [
   "compras"
  ],
  "texto": "Sin tomar: nadie la ha agarrado. Cotizando: alguien de compras la tomó. Con precio: ya se contestó y el vendedor ve el precio de lista. No se consigue: se le explicó por qué. Cancelada: el vendedor ya no la necesita."
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
  "texto": "El inventario con el que arrancó el ERP, por artículo y almacén. Se carga una sola vez; después, una diferencia se corrige con un ajuste autorizado, no reimportando."
 },
 {
  "clave": "exportacionVenta",
  "modulos": [
   "analisis"
  ],
  "texto": "Venta a clientes fuera de México: cuenta en el total, pero no sale en el mapa."
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
  "texto": "Tipo de producto de cada venta. En las ventas de la hoja sale del texto, con las reglas de familia; en los pedidos del ERP, de la categoría del artículo."
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
  "texto": "Si no la capturas, al enviar la orden se calcula con los días hábiles de entrega del proveedor (7 si no tiene). Pasada esa fecha, la orden sale como atrasada."
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
  "clave": "filaTaller",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Lo que un pedido nuevo tiene que esperar: las horas que ya tienen las órdenes en el taller y las planeadas, entre lo que trabaja cada etapa por semana. La etapa más cargada manda."
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
  "clave": "folioPedido",
  "modulos": [],
  "texto": "El número del pedido. Los de clientes van PED-26-799: el año en que se levantó y el número corrido de siempre (el que seguía al pedido 798 de la hoja); el número no vuelve a 1 al cambiar de año. Mercado Libre, la tienda web y Amazon llevan su propia serie que sí empieza cada año (ML-26-0001, WEB-26-0001). Un equipo de stock que se vende lleva un folio de pedido normal. Si el pedido tenía otro folio antes (HIS-…, P-…, PED-2026-…), sale como «antes …» y también lo encuentras por él."
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
  "clave": "ganttTrabajandose",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Etapa en proceso: llena hasta hoy y translúcida en lo que, según el plan, le falta. Las rayas se mueven: es lo que se trabaja ahorita."
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
  "texto": "Las herramientas que ingeniería de procesos irá usando conforme se capacite. Se habilitan una por una, cuando el equipo las vaya a usar; ninguna está activa todavía."
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
  "clave": "horasTrabajadas",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Cuántas horas le dedicó la persona de mantenimiento a esta orden (no cuánto estuvo parada la máquina). Con ellas sale el tiempo promedio de reparación y la mano de obra."
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
  "clave": "imagenArticulo",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "La foto del artículo: sale en el buscador, en la ficha de venta y en la cotización que recibe el cliente. Puedes pegar la liga de Drive tal cual (el archivo tiene que estar compartido con «Cualquier persona con el enlace») o la de cualquier imagen, o subir la foto desde la computadora o el celular. La subida no depende de Drive: si alguien mueve o deja de compartir el archivo, sigue viéndose."
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
  "clave": "imprimirDescripcion",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Abre en otra pestaña la descripción de lo que se vendió, lista para imprimir o guardar en PDF: cliente, vendedor, compromiso y cada partida con su descripción y sus órdenes. Sin precios. Desde una orden sale solo su partida."
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
  "clave": "incoterm",
  "modulos": [
   "importaciones"
  ],
  "texto": "El acuerdo con el proveedor sobre hasta dónde paga él el flete y el seguro (FOB, CIF, EXW…). Define qué gastos nos tocan a nosotros."
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
  "texto": "Cuántos indicadores del mes ya tienen calificación. Mientras falte alguno, el resultado es parcial y el jefe no puede enviarlo a Recursos Humanos."
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
  "texto": "Peso de la familia en el estado entre su peso en todo el país. Mayor a 1: ahí se vende más de esa familia que en el resto; resaltado arriba de 1.25."
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
  "clave": "insumosServicio",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Lo que lleva la cuadrilla o la reparación: sale de almacén con el folio del servicio, o se pide a compras si no hay."
 },
 {
  "clave": "invitacion",
  "modulos": [
   "admin"
  ],
  "texto": "Deja lista la cuenta de alguien antes de que entre: al entrar por primera vez recibe los roles de la invitación. Un correo de fuera de la empresa solo puede entrar si está invitado. No se manda ningún correo: avísale tú."
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
  "clave": "kardex",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "La historia de un artículo: cada entrada y salida con fecha, quién la hizo, para qué y el saldo que quedó en ese almacén."
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
  "clave": "ligaEmpleado",
  "modulos": [
   "admin"
  ],
  "texto": "La ficha de Personal ligada a esta cuenta. Con ella la persona ve su saldo de vacaciones y su desempeño, y aquí se avisa si la dieron de baja."
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
  "clave": "listaMateriales",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "La receta del artículo: cada componente, materia prima o subensamble que lleva y en qué cantidad. Producción surte cada orden con esta lista, así que lo que no está aquí no llega al taller."
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
  "texto": "Cuándo llega a planta. Mientras está en el mar o en puerto, es el arribo (o la ETA) más lo que normalmente tarda en salir del puerto; ya despachado, el día siguiente; ya en planta, la fecha real (si nadie la anotó, dice que falta)."
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
  "clave": "maquinaCritica",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Una máquina que, si se para, para el área completa."
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
  "clave": "medidaEspecial",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Equipo hecho a una medida fuera de la estándar. Se marca en su ficha y su precio de lista ya lo toma en cuenta."
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
  "clave": "menuPersonal",
  "modulos": [],
  "texto": "Las secciones del menú salen en el orden de tu puesto: si eres de producción, Producción va primero. Clic en el nombre de una sección la colapsa o la abre; con las flechas que aparecen al pasar el mouse la subes o la bajas. Lo que acomodas se queda en esta computadora, solo para ti. «Restaurar el menú de mi puesto», al final, lo regresa como estaba."
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
  "texto": "La sugerida reparte la meta del año con lo que pesó cada estado en los últimos 3 años. Dirección puede poner otra; vacía regresa a la sugerida."
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
  "texto": "Por resolver: el estado o la ciudad no se reconocieron. Por confirmar: se ligó por parecido o a una ciudad de otro estado. Falta el dato en la ficha: no hay ciudad escrita y se arregla en el cliente. Por aproximación: el nombre corto o largo de un solo municipio."
 },
 {
  "clave": "mtbf",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Tiempo promedio entre fallas: las horas que la máquina estuvo operando entre el número de fallas (órdenes correctivas) del periodo. Más alto es mejor. «Sin fallas» quiere decir que no falló en el periodo."
 },
 {
  "clave": "mttr",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Tiempo promedio de reparación: de que se reporta la falla a que se cierra su orden. Más bajo es mejor. El «paro promedio» es solo de las fallas que detuvieron la máquina, de que se paró a que volvió a operar."
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
  "texto": "Lo que un rol puede hacer en un módulo: 1 ver, 2 capturar (ver y registrar), 3 administrar (aprobar, borrar, configurar). Un guion = sin acceso: ni lo ve en el menú ni la base le entrega esos datos."
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
  "clave": "noSeVendeSuelto",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Artículo que solo se usa dentro de un equipo: no se cotiza por separado."
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
  "clave": "ocupacionArea",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Qué tanto de su capacidad tiene ocupada el área esa semana. Con holgura: menos de 85 %. Justa: de 85 a 100 %. Se pasa: más de 100 %, algo se va a atrasar."
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
  "clave": "ordenesSueltas",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Órdenes del pedido que no están ligadas a una partida. Pasa con los pedidos que vinieron de la hoja: la partida dice algo general («línea de envasado») y cada equipo es una orden. Aquí ves cada equipo con su orden y su avance."
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
  "clave": "ordenProduccion",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "La orden para fabricar un equipo (o varios iguales). Al crearse copia la lista de materiales del equipo, así un cambio posterior al catálogo no la mueve."
 },
 {
  "clave": "origenCosto",
  "modulos": [
   "compras"
  ],
  "texto": "De dónde salió el cambio: a mano (aquí o en la ficha), por orden de compra (al recibirla), por cotización (al contestar una solicitud de precio) o importado de la hoja."
 },
 {
  "clave": "origenRequisicion",
  "modulos": [
   "compras"
  ],
  "texto": "Quién la pidió: Producción (faltante de una orden de producción), Reabasto (almacén, por stock mínimo) o Manual. La fecha en rojo es para menos de una semana."
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
  "clave": "panelPersonal",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Todo el personal activo, por su área. En verde, quien está trabajando ahorita (tiene su tiempo abierto en alguna etapa). La gerencia de producción arrastra de aquí a una tarjeta para meter a alguien, y arrastra a alguien de una tarjeta hasta aquí para sacarlo de esa cuadrilla."
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
  "texto": "Las cinco máquinas que más horas estuvieron paradas en el periodo, con sus fallas. Casi siempre unas pocas máquinas se llevan la mayor parte del tiempo perdido: ahí conviene atender primero (refacciones, cambio o un preventivo más seguido)."
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
  "clave": "partidaSinArticulo",
  "modulos": [
   "compras"
  ],
  "texto": "Una partida escrita a mano, sin artículo del catálogo (vienen así de la hoja o de un PDF). Si es material, búscala y elige su artículo: entra al almacén con el costo de la orden, como cualquier otra. Si es un cobro como «Manejo» o un flete, recíbela tal cual: cuenta como recibida y no toca el inventario. Cuando finanzas liga la factura a la orden, una partida sin artículo cuenta con la categoría de la factura; con artículo, como material o consumible del taller."
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
  "clave": "pendienteEsperandoRespuesta",
  "modulos": [],
  "texto": "Quien tiene el pendiente preguntó algo que necesita para terminarlo y espera la respuesta de quien lo pidió. Mientras tanto, el pendiente no cuenta como vencido ni suma días de retraso a quien lo tiene (no lo detiene él), y a quien lo pidió le sale como «Te preguntaron» o «Por responder» hasta que conteste en la ficha. Todos los que ven el pendiente ven la conversación."
 },
 {
  "clave": "pendientesATiempo",
  "modulos": [],
  "texto": "De tus pendientes con fecha de los últimos 30 días, cuántos cerraste a tiempo, contando como fallas los que cerraste tarde y los que hoy siguen vencidos. Verde de 90 % para arriba, ámbar de 70 % a 89 %, rojo abajo de 70 %. Los que no tenían fecha no cuentan aquí."
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
  "clave": "pendientesPidio",
  "modulos": [],
  "texto": "Cuántos pendientes le pidió esta persona a otros en el periodo y cuántos siguen abiertos."
 },
 {
  "clave": "pendientesTeEsperan",
  "modulos": [],
  "texto": "Cuántas personas te pidieron algo que sigue abierto: es a cuántos detiene tu trabajo mientras no lo cierres. En rojo si alguno ya está vencido."
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
  "texto": "La tabla de rol × módulo. Cada cruce dice el nivel que tiene ese rol en ese módulo. Solo dirección la cambia, y dirección siempre tiene nivel 3 en todo."
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
  "clave": "planoEstado",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Vigente: la revisión con la que se fabrica. Por aprobar: un borrador que todavía no sustituye al vigente. Anteriores: revisiones que ya se reemplazaron."
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
  "texto": "El mantenimiento que le toca a una máquina cada cierto tiempo o cada tantas horas de uso, lo que pase primero. Su orden se genera sola: por fecha, unos días antes de vencer; por horas, al llegar a ellas."
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
  "texto": "Cuánto tiempo tiene compras para contestar: unas horas hábiles que se fijan en Configuración (al arrancar: un día hábil, o medio día si el vendedor la marcó urgente porque el cliente está esperando). Solo corre en horario de la planta: una solicitud del domingo empieza a contar el lunes."
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
  "clave": "porCobrar",
  "modulos": [],
  "texto": "Lo que los clientes nos deben, en pesos: lo de sus pedidos (total con IVA menos los cobros registrados) más lo que ya debían en la hoja el día que arrancó el ERP, menos lo que han pagado de eso."
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
  "clave": "porRecuperar",
  "modulos": [
   "importaciones"
  ],
  "texto": "Dinero nuestro que alguien tiene que regresar: el saldo a favor de la cuenta de gastos con el agente y la garantía del contenedor. Si no se dice otra fecha, se espera a los 15 días el saldo y a los 30 la garantía."
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
  "texto": "Cuántos precios de equipo que calcula el ERP salen idénticos a los de la hoja «Nuevo Costeo». Si alguno sale distinto, revísalo antes de cotizar ese equipo."
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
  "clave": "problemasSinMejora",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Lo que el piso reportó en los últimos 30 días y todavía no tiene mejora: los problemas de la terminal, las pausas con motivo, las etapas reabiertas y las fallas de máquinas. «Volverla mejora» la propone con lo que se reportó; cada problema da una sola mejora."
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
  "texto": "Una orden abierta que, con la fila del taller, sale después de su fecha compromiso. La fila va por fecha compromiso: cada orden sale cuando la etapa más cargada acaba lo prometido antes que ella y lo suyo. Avisar al cliente a tiempo o mover prioridades."
 },
 {
  "clave": "prometidoVsCapacidad",
  "modulos": [
   "analisis"
  ],
  "texto": "Barra: el trabajo de las órdenes que se prometieron para ese mes, en semanas de la etapa más cargada. Línea: las semanas que tiene el mes. Si la barra pasa la línea, ese mes ya se prometió más de lo que cabe."
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
  "clave": "proyeccionCierre",
  "modulos": [],
  "texto": "Cuánto cerraría el año si seguimos al mismo ritmo, con la estacionalidad del año pasado: si vamos 20 % arriba a la misma fecha, cierra 20 % arriba de lo que cerró el año pasado."
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
  "clave": "quienCambioQue",
  "modulos": [
   "compras"
  ],
  "texto": "Cada alta o cambio del proveedor queda registrado con el nombre de quien lo hizo, la fecha y qué datos cambió. Solo dirección y sistemas ven esta lista."
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
  "clave": "recibirOrden",
  "modulos": [
   "compras"
  ],
  "texto": "Almacén captura lo que de verdad llegó, a qué almacén y con qué factura; lo que falte se queda pendiente. No deja recibir más de 10 % arriba de lo pendiente. Con la casilla marcada, el costo de la orden pasa a ser el costo vigente del artículo."
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
  "clave": "regresarStock",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Suelta una orden de su pedido y la regresa a «Para stock», con su avance, su número de serie y el material que ya se le surtió. Sirve cuando se le dio «Usar» a la orden equivocada o cuando el cliente canceló: el equipo se puede dar a otro pedido. En el pedido, ese equipo vuelve a quedar «Sin orden». Solo la gerencia de producción, con el motivo."
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
  "clave": "revisionBienAsi",
  "modulos": [],
  "texto": "Dices que no es un error. No vuelve a salir, y si escribes por qué, la revisión lo toma en cuenta para no señalar algo igual."
 },
 {
  "clave": "revisionClaude",
  "modulos": [],
  "texto": "Lo señaló la IA al leer lo que se capturó ayer: cosas que una regla no ve, como una nota que contradice la orden o una cantidad que no cuadra con la unidad. La IA solo señala; no cambia nada."
 },
 {
  "clave": "revisionCorrigelo",
  "modulos": [],
  "texto": "El ERP hace la corrección por ti, con tus permisos, como si la hicieras a mano. Solo sale cuando la corrección es segura (inhabilitar el artículo repetido y quedarse con el que ya existía; ligar tu cuenta a tu ficha). Si algo lo impide, te dice qué hacer primero."
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
  "clave": "revisionOC",
  "modulos": [
   "compras"
  ],
  "texto": "Una orden ya enviada se puede cambiar cuando el proveedor y quien la pidió acuerdan otro artículo, otra cantidad u otro precio. Compras lo hace con el lápiz de la partida, siempre que de esa partida no haya llegado nada, y escribe por qué. El folio no cambia (el proveedor ya lo tiene): la orden sube de revisión, lo impreso dice «Rev. 2» para mandársela otra vez, y abajo queda el antes y el después de cada cambio. Si lo que cambia es el proveedor, cancélala y haz otra."
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
  "clave": "rutinaMantenimiento",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "La lista de puntos que se revisan en un preventivo, por tipo de máquina y frecuencia (por ejemplo, inversoras AXT cada mes). Cada orden que sale del plan trae esa lista para palomearla."
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
  "clave": "saldoPaqueteria",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Lo que queda en la cuenta de prepago de una paquetería: recargas menos lo que costaron las guías. En rojo, abajo del mínimo."
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
  "clave": "salidaConsumo",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Material que se gasta en la planta y no va a un cliente: taller, EPP, plasma, torno, pintura, uniformes, mantenimiento. Se anota quién lo recibe, para ver cuánto se lleva cada persona."
 },
 {
  "clave": "segmentoCliente",
  "modulos": [
   "analisis"
  ],
  "texto": "Grupo según qué tan reciente fue su última compra, qué tan seguido compran y cuánto: campeones, nuevos, leales, ocasionales, en riesgo, dormidos y perdidos. Pasa el mouse por cada uno para ver su regla y dale clic para ver quiénes son."
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
  "clave": "semaforoSolicitud",
  "modulos": [
   "compras"
  ],
  "texto": "Verde: a tiempo. Amarillo: vence en menos de una hora hábil. Rojo: ya venció y el vendedor sigue esperando. Las vencidas van arriba de la lista."
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
  "clave": "siguientePaso",
  "modulos": [
   "importaciones"
  ],
  "texto": "Lo que sigue para que el embarque avance, según la etapa en que va y los documentos que faltan."
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
  "texto": "Cotizaciones que nunca se mandaron al cliente: en borrador, esperando que la gerencia autorice el precio o canceladas antes de enviarse."
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
  "clave": "situacionPreventivo",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Al día: todavía no toca. Por vencer: faltan pocos días o ya lleva 90 % de las horas. Vencido: ya pasó la fecha o las horas."
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
  "texto": "Cuando algo de la lista de materiales está mal, producción, almacén o ventas lo reportan desde la orden; ingeniería lo corrige y lo marca como aplicado o descartado."
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
  "texto": "Vacaciones y permisos que alguien pidió y que Recursos Humanos todavía no aprueba ni rechaza. Mientras tanto no se restan del saldo."
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
  "clave": "subensambleSugerido",
  "modulos": [
   "admin"
  ],
  "texto": "Un grupo de piezas que se repite idéntico en varios equipos porque las listas se copiaron. Convertirlo en subensamble lo deja en un solo lugar para todos esos equipos; el costo y el precio no cambian."
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
  "clave": "tardeSegunPlan",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Órdenes cuyo plan termina después de su fecha compromiso. La franja roja va del compromiso a donde acaba el plan: son los días que faltarían. Se corrige subiéndola en la fila, poniéndole más gente a sus etapas o acordando otra fecha con el cliente."
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
  "clave": "ticketPromedio",
  "modulos": [
   "analisis"
  ],
  "texto": "Venta entre número de operaciones (facturas o pedidos). Dice si ahí se venden equipos grandes o refacciones sueltas."
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
  "texto": "Mediana de horas hábiles desde que el vendedor pidió el precio hasta que compras lo contestó, este mes, contra lo que se tardaba cuando se pedía por el chat. Las que siguen abiertas y ya pasaron de un día cuentan como tardadas."
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
  "clave": "traspaso",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Mover material de un almacén a otro. El total no cambia, solo dónde está. Mandar mercancía al Full de Mercado Libre es un traspaso."
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
  "clave": "ventasAnio",
  "modulos": [],
  "texto": "Lo vendido en el año, con IVA y en pesos. Antes del arranque del ERP sale del libro de ventas de la hoja; después, de los pedidos. La flecha compara contra el mismo tramo del año pasado."
 },
 {
  "clave": "ventasDelMes",
  "modulos": [],
  "texto": "Pedidos no cancelados con fecha de este mes, sin IVA y en pesos. La flecha compara contra el mismo tramo del mes pasado (del día 1 al día de hoy), no contra el mes completo."
 },
 {
  "clave": "ventaSinClasificar",
  "modulos": [
   "analisis"
  ],
  "texto": "Ventas de la hoja cuyo texto no cayó en ninguna regla de familia. Mientras más alto el porcentaje clasificado, más confiables son las gráficas por familia."
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
  "texto": "Lo vendido en el periodo, sin IVA. Desde el arranque del ERP (12 oct 2026): las partidas de los pedidos con fecha en el periodo, sin cancelados; las de dólares, con su tipo de cambio. Antes: el libro de ventas de la hoja, sin IVA si tuvo factura, con la línea según la familia del producto. Es la misma regla de Análisis."
 },
 {
  "clave": "ventasSemana",
  "modulos": [],
  "texto": "Lo vendido la semana pasada (lunes a domingo), con IVA y en pesos, contra la semana anterior a esa. Si eres vendedor, solo cuenta lo de tus clientes."
 },
 {
  "clave": "verComo",
  "modulos": [
   "admin"
  ],
  "texto": "Dirección puede ver el ERP con los permisos de otro rol para revisar qué ve esa gente; lo que guarde mientras tanto es real y queda a su nombre. Dirección y sistemas también pueden abrir la sesión de una persona en otra pestaña, solo para ver: no deja guardar nada y queda registrado."
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
  "texto": "Lugares que compraban en el periodo anterior y cayeron 30 % o más (o dejaron de comprar), con lo que se dejó de vender y los clientes que ya no compraron ahí, para llamarles."
 }
];

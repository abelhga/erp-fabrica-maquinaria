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
   "«Lo que importa hoy» junta lo urgente de tu área (en morado, lo que conviene saber); el botón de flechas lo vuelve a analizar. Abajo, a almacén le sale «Por surtir»: las órdenes con material pendiente, en el orden en que el taller las va a trabajar.",
   "A los supervisores de piso les sale lo del taller y a mantenimiento lo de las máquinas: paradas, fallas sin atender, preventivos vencidos o por vencer y herramienta sin regresar. Eso lo calcula el ERP con reglas, sin IA.",
   "Casi todos los indicadores se abren con un clic y te llevan a la lista de donde salen (Ventas del mes abre los pedidos, por ejemplo). Todo se calcula con tus permisos: un vendedor ve lo suyo, no el total de la empresa.",
   "En el tablero de área, la tarjeta «Pendientes» reúne lo que espera algo de ti según tu puesto: lo que encontró la revisión de la madrugada en algo tuyo, precios por autorizar, seguimientos de cotizaciones vencidos o para hoy, tareas con clientes vencidas, ajustes de inventario, compras atrasadas o documentos de embarques que faltan.",
   "A la gerencia de ventas los seguimientos le salen de todo el equipo, con quién está frenado. Un vendedor frenado no puede enviar cotizaciones nuevas hasta ponerse al día.",
   "En el centro de mando las cifras se actualizan solas cuando alguien registra un pedido, un cobro o un avance del taller. Abajo del embudo comercial ves cómo va cada vendedor con el seguimiento de sus cotizaciones y quién está frenado.",
   "El ERP recuerda cómo dejaste las cosas, en tu computadora o celular y por persona: el orden de cada lista (la columna por la que ordenaste), «Agrupar por» en el material de una orden y la vista y el zoom del Gantt. Los filtros y las búsquedas no, para que nunca se te esconda algo sin darte cuenta.",
   "Cada lunes la IA te puede escribir hasta tres consejos con tus propios números (cómo capturas y, si vendes, qué podrías probar para cerrar más). Salen aquí, en «Tus consejos de la semana», y solo los ves tú (y dirección, que cuida lo que se dice). Dale «Me sirve» o «No me sirve»: los de la semana siguiente lo toman en cuenta."
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
   "Sigue cada envío del pedido a la puerta del cliente: ventas lo pide, cotiza y saca la guía; almacén lo empaca con evidencia y marca la salida.",
   "Paso 1: Abre la pestaña de tu paso: Por cotizar y guía, Por empacar u Hoy salen o recogen.",
   "Paso 2: Dale clic a un envío: arriba ves cada paso y el botón de lo que sigue.",
   "Paso 3: Para empacar, sube fotos, palomea el check list y dale «Marcar empacado».",
   "Un envío se pide desde su pedido y llega con peso, medidas y destino ya llenos. Según cómo vaya, pasa por cotización y guía de paquetería (con Skydropx o a mano), empaque con fotos y check list, salida y entrega.",
   "Las pestañas son la fila de trabajo, de izquierda a derecha: Por cotizar y guía, Por empacar, Hoy salen o recogen, En camino y Entregados (los de los últimos 60 días). Almacén abre en «Hoy salen o recogen» si hay algo, si no en «Por empacar»; los demás, en «Por cotizar y guía».",
   "Al abrir un envío se ve a un lado: arriba cada paso con quién y cuándo, y el botón del paso que sigue.",
   "Empacar pide fotos del paquete, el check list completo, el número de serie si es un equipo (tiene que ser el de su orden de producción) y, en paquetería y envíos a Full, el peso y las medidas de cada bulto. Abajo del botón dice qué falta.",
   "Esa evidencia no se puede cambiar ni borrar; una foto equivocada se retira con su motivo (queda a la vista como «retirada») y, mientras el paquete no salga, se sube la correcta.",
   "Al marcar «Ya salió» (o «Lo surtió Full»), se descuenta del inventario lo que falte, una sola vez y sin tocar lo apartado para otros; lo de Full sale de Almacén ML. Lo que recoge el cliente se cierra con «Se lo llevaron», y lo que va en camino, con «Marcar entregado».",
   "Una venta de Mercado Libre de una publicación que el ERP no conoce también llega aquí, con el título de la publicación y un aviso en ámbar. Con «Ligar artículo» dices qué artículo del catálogo es y cuántas piezas lleva cada venta.",
   "Sin ligar el artículo, la caja no se puede cerrar. Si Mercado Libre se lleva el paquete antes de que alguien lo ligue, el inventario se descuenta cuando se ligue.",
   "Si manejas envíos o finanzas, arriba ves el saldo de cada paquetería de prepago (recargas menos guías); se pone en rojo abajo del mínimo. En la de Skydropx también ves lo que Skydropx reporta, para comparar.",
   "Almacén arma con «Envío a Full» los envíos para reabastecer el Full de Mercado Libre.",
   "Para un envío por paquetería, «Cotizar con Skydropx» pide el destino por campos (código postal, estado, municipio, colonia, calle) y el peso y medidas de cada bulto; con eso cotizan todas las paqueterías a la vez y eliges una.",
   "Al confirmar con «Sí, generar y pagar», Skydropx cobra la guía de su saldo y el PDF, el número de guía y el rastreo quedan en el envío, que pasa a «Guía lista» si todavía no se empacaba. La dirección se le queda al contacto del cliente para la próxima vez.",
   "Si el PDF tarda, el envío lo dice y «Revisar guía de Skydropx» lo trae sin volver a cobrar. «Cotizar a mano» y «Registrar guía a mano» quedan por si Skydropx falla; en un flete los botones dicen «Cotizar» y «Registrar guía»."
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
   "Cuánto hay de cada componente y materia prima, en qué almacén y cuánto ya está apartado: para saber si algo se surte sin ir al estante.",
   "Paso 1: Busca por clave o nombre, o elige un filtro: Con existencia, Apartados, Negativos o Todos.",
   "Paso 2: Fíjate en la columna Disponible: es lo que de verdad se puede usar hoy.",
   "Paso 3: Dale clic a un renglón para ver el artículo por almacén y para qué está apartado.",
   "Disponible es lo que hay en planta menos lo apartado. Lo del Full de Mercado Libre existe, pero no cuenta para planta. Un número en rojo es existencia negativa: salió algo cuya entrada nunca se registró, y se corrige con un conteo y un ajuste.",
   "Si tu puesto ve compras o finanzas, también ves la columna Tránsito y el filtro En tránsito: lo que viene en órdenes de compra enviadas que todavía no llegan.",
   "El selector de almacén deja solo lo que hay en ese almacén. El panel del artículo se abre a un lado: cuánto hay en cada almacén, para qué orden o pedido está apartado y, si tu puesto lo ve, su kardex.",
   "«Registrar entrada o salida» te lleva a Entradas y salidas; desde el panel del artículo llegas con el artículo ya elegido. El botón de CSV baja la lista para Excel. La tabla se actualiza sola cuando alguien registra un movimiento."
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
   "Cómo anda el almacén: la salud del inventario hoy y lo que se movió en el periodo. La usan almacén, compras, la gerencia de producción y dirección.",
   "Paso 1: En «Salud del inventario», dale clic a un pedazo de la barra o de la matriz.",
   "Paso 2: Baja esa lista a Excel y actúa: rematar, devolver, no volver a pedir o pedir ya.",
   "Paso 3: En «Movimiento del periodo», elige el periodo y revisa la tabla «Fuera de lista».",
   "«Salud del inventario» es una foto de hoy: cuánto alcanza lo que hay contra lo que sale, qué sobra y qué falta, y qué conviene controlar de cerca. No cambia con el periodo.",
   "La barra reparte lo que hay en existencia por clase (negativo, quiebre, bajo el punto de reorden, sano, exceso, esporádico, sin movimiento en 12 meses); con permiso de costos se ve por valor o por artículos.",
   "La frase de arriba dice cuánto no tiene demanda regular (exceso, esporádico y sin movimiento) y cuántos artículos con demanda están en quiebre o debajo del punto de reorden.",
   "Clic en un pedazo de la barra, en la leyenda o en una celda de la matriz trae hasta 300 de esos artículos, los de más valor en existencia primero, para bajarlos a Excel.",
   "La matriz ABC-XYZ cruza cuánto pesa cada artículo (por valor consumido si ves costos; si no, por qué tan seguido sale) con qué tan parejo sale mes con mes; al pasar el mouse por una celda dice qué conviene hacer con esos artículos.",
   "«Cobertura contra la meta» dice, para nacionales (meta 1 mes) e importados (meta 6 meses), cuántos artículos alcanzan menos de su meta (en naranja) y cuántos de más (en azul). Abajo, lo que salió cada mes en los últimos 12, con su promedio punteado.",
   "En «Movimiento del periodo» eliges 30 días, 90, 6 o 12 meses y pasas el mouse por cada indicador para ver de dónde sale. Fuera de lista va en verde hasta 5 %, ámbar hasta 15 % y rojo arriba; la exactitud de conteos, verde desde 95 % y ámbar desde 85 %.",
   "La gráfica de control enseña, por semana, qué parte de lo surtido a órdenes salió fuera de su lista contra su promedio y sus límites: un punto rojo arriba del límite es un cambio real que hay que investigar.",
   "«Esperando material» lista las órdenes abiertas con partidas por surtir y marca las que ya están en proceso; clic en una la abre.",
   "La tabla «Fuera de lista» trae cada partida que salió a una orden sin estar en su lista, con quién la recibió, quién la registró y el motivo: es la lista para preguntar por qué y, si a la receta le falta algo, avisar a ingeniería. Clic en la orden la abre; se busca y se baja a Excel.",
   "Si «Consumibles del taller» está apagado en Configuración, arriba sale un aviso: los discos, la soldadura y el EPP que salen para una orden se cargan a la orden y cuentan como fuera de lista.",
   "«Consumibles por persona» suma lo que se llevó cada quien de las categorías consumibles (discos, lijas, soldadura, EPP…); «Sin anotar» son salidas a consumo que no dicen quién lo recibió.",
   "«Consumibles contra receta» compara lo que salió de cada consumible con lo que prevén las recetas de las órdenes terminadas en el periodo: en rojo, más de 20 % arriba. Lo que no viene en ninguna receta, como los guantes, solo se ve por persona.",
   "Abajo están los ajustes del periodo y los que esperan autorización, los conteos cerrados con cuántos renglones no coincidieron (clic en uno lo abre) y cuántos movimientos registró cada persona. Los montos solo los ve quien tiene acceso a costos."
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
   "Aquí almacén registra lo que sale, regresa o cambia de almacén, desde el celular o la computadora, y consulta la historia; la gerencia entra a autorizar ajustes.",
   "Paso 1: En Registrar elige Salida, Devolución o Traspaso y busca el artículo.",
   "Paso 2: Toca el almacén (cada botón dice cuánto hay), escribe la cantidad y Enter.",
   "Paso 3: Escribe el motivo (en un consumo, también quién lo recibe) y Enter guarda.",
   "En una salida eliges si es Consumo (taller, EPP, plasma…) o Venta (mostrador, ML). En un consumo también anotas quién lo recibe; el nombre se queda para la siguiente salida. En un traspaso eliges a qué almacén entra. No deja sacar más de lo que hay en ese almacén.",
   "Los botones de motivo llenan el texto por ti. A la derecha, «Lo que registraste hoy» enseña tus movimientos del día para que confirmes que quedaron bien. La fecha, la hora y tu nombre los pone el sistema: no se puede capturar con fecha atrasada ni a nombre de otro.",
   "Nada se edita ni se borra. Si te equivocaste en una salida o un traspaso que registraste tú, en «Lo que registraste hoy» tienes unos minutos para «Deshacer», con el motivo (15 de inicio; los fija dirección en Configuración y el botón dice cuántos quedan).",
   "Deshacer deja el movimiento contrario ligado al original (sale como «corrección» y el original como «deshecho»), con tu nombre y la hora, y el consumo se compensa. Un traspaso solo regresa si lo que llegó sigue en el destino.",
   "Pasado ese tiempo, o si lo registró otra persona, no lo vuelvas a capturar al revés: pide un ajuste. Lo surtido a una orden, lo recibido de una compra, las entregas de pedidos y los envíos se corrigen desde su propia pantalla.",
   "Historial filtra por tipo, almacén, persona y fechas (al abrir, los últimos 30 días) y se baja a Excel. «Recibió» es quién se llevó el material; «Quién» es quién lo registró. Registrar solo sale si tu puesto captura almacén; Historial, si capturas almacén o tienes permiso de costos.",
   "En Ajustes pides una corrección cuando lo del estante no cuadra, y la gerencia la aprueba o la rechaza; hasta entonces la existencia no cambia.",
   "En Conteos físicos abres un conteo por almacén: eliges qué contar (lo que piden las órdenes de producción, lo que salió en los últimos 30 días, unas claves o todo el almacén) y si va a ciegas, y le das «Empezar a contar». Capturas cada artículo en cuanto lo cuentas (Enter guarda y baja al siguiente) y, al cerrarlo, cada diferencia se vuelve un ajuste por autorizar."
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
   "Qué componentes y materias primas hay que pedir, cuánto y por qué. Compras la usa para generar órdenes de compra y almacén para pedirle material a compras.",
   "Paso 1: Revisa el filtro «A ordenar»: lo que quedó abajo de su punto de reorden.",
   "Paso 2: Marca las casillas de lo que quieres pedir; la de arriba marca todos los sugeridos.",
   "Paso 3: Dale «Generar órdenes de compra» o, si eres de almacén, «Pedir a compras».",
   "La pantalla abre en «A ordenar» si hay algo abajo de su punto de reorden; si no, en «Todos». Los otros filtros son Importados, Excedentes y Negativos. Solo se pueden marcar los artículos que tienen sugerido.",
   "«Generar órdenes de compra» lo tiene quien captura compras: salen en borrador, separadas por proveedor, y lo que no tiene proveedor no se pide y te lo enlista. «Pedir a compras» lo tiene almacén: sale una requisición.",
   "Si algo ya está en una orden en borrador o en una requisición, se ve debajo del sugerido para que no lo pidas dos veces.",
   "La regla es la de la hoja Demanda: un artículo genera demanda si tuvo consumo en suficientes meses de los últimos seis, y su demanda es el promedio de esos meses. El punto de reorden es la demanda de los días que tarda en llegar más el stock de seguridad.",
   "Si el disponible (en planta − apartado + en tránsito) queda abajo, se sugiere el lote (1 mes de cobertura si es nacional, 6 si es importado) más lo que falta para el punto de reorden, redondeado al empaque.",
   "La regla vigente está al pie de la tabla y el botón «¿por qué?» hace la cuenta con los números de cada artículo.",
   "Cobertura y Seguridad se cambian ahí mismo si tu puesto puede: escribe y Enter guarda; vacío regresa al valor normal. Los días de entrega son los reales del proveedor cuando ya hay historia.",
   "Excedente es lo que no se usó en 12 meses, sigue en el estante y no tiene stock de seguridad.",
   "El cálculo sale de los movimientos de almacén: si tu puesto ve existencias pero no movimientos, aquí no ves la lista y te manda a Existencias."
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
   "Paso 1: Elige el periodo arriba y qué pinta el mapa: venta, clientes, ticket promedio o crecimiento.",
   "Paso 2: Dale clic a un estado para ver sus municipios; «México» te regresa a todo el país.",
   "Paso 3: Revisa «Zonas que se enfriaron» y llama a los clientes que dejaron de comprar.",
   "El periodo se queda al cambiar de pestaña. Todo se compara contra el periodo anterior: el mismo tramo del año pasado si el periodo es de un año o menos; si es más largo, un tramo igual de largo justo antes.",
   "El botón de tabla junto al ranking muestra todos los renglones, con CSV para Excel.",
   "«Zonas que se enfriaron» junta los lugares que cayeron 30 % o más, con los clientes que dejaron de comprar para llamarles.",
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
   "Si prometemos más de lo que el taller saca, todo en semanas de la etapa más cargada para compararlo con el calendario.",
   "Paso 1: En la primera gráfica, busca los meses donde la barra pasa la línea: ahí no cabe.",
   "Paso 2: En la segunda, compara lo que entra con lo que sale: si entra más, la fila crece.",
   "La etapa más cargada es la que más trabajo tiene en fila contra su gente.",
   "La primera gráfica dice cuánto trabajo se prometió para cada mes contra las semanas que tiene el mes; «Ya vencido» es lo que debió salir y sigue en el taller. La segunda, lo que entra y sale del taller cada mes.",
   "«Se pone al día» es cuándo acabaría el taller todo lo que tiene si no entrara nada más.",
   "Para acortar la fila hay que sacar más (gente, horas extra, maquila) o prometer con la fecha realista que da el cotizador."
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
   "Paso 1: Elige el periodo arriba: los cuadros, el Pareto y los que más compraron lo usan.",
   "Paso 2: Abajo, elige un segmento (de entrada «En riesgo») para ver la lista con su vendedor.",
   "Paso 3: Dale clic a un renglón para abrir la ficha del cliente.",
   "Los segmentos se calculan al último día del periodo.",
   "«Clientes nuevos y recurrentes por año» y las cohortes usan toda la historia, no el periodo.",
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
   "Si cumplimos lo que prometemos: qué parte de los pedidos se entregó a tiempo y qué órdenes del taller ya no llegan a su fecha.",
   "Paso 1: Revisa «Lo que viene»: en rojo, las órdenes que ya no llegan a su fecha.",
   "Paso 2: Dale clic a una para abrir su pedido y avisa al cliente a tiempo.",
   "Paso 3: Bájala en CSV para revisarla con producción.",
   "Arriba, cuántos pedidos con fecha compromiso en el periodo se entregaron a tiempo y con cuánto atraso los que no; abajo, por mes, por vendedor y por familia de equipo.",
   "«Lo que viene» es lo más útil: cada orden del taller con la fecha a la que sale de verdad. Una orden para stock, sin pedido, abre la orden de producción.",
   "La fila va por fecha compromiso: cada orden sale cuando la etapa más cargada acaba lo prometido antes que ella más lo suyo, con la capacidad semanal de cada área (la calcula el ERP con la gente asignada). Las órdenes en espera no cuentan.",
   "La fecha a la que sale cambia cada día con lo que el taller termina y lo que entra."
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
   "Paso 1: Elige el año con las flechas.",
   "Paso 2: Si eres de dirección, escribe la meta (acepta «32 M») y Enter la guarda.",
   "Paso 3: Para probar, escribe cuánto crecer en «Escenario»; dirección lo pasa con «Usar como meta» y Guardar.",
   "Dirección captura la meta. El escenario calcula una meta creciendo un porcentaje sobre el año anterior, y «Usar como meta» la copia a la casilla.",
   "La meta de cada mes sale de lo que pesó ese mes en los últimos 3 años completos, y la de cada estado, de lo que pesó cada estado.",
   "«Cierre a este ritmo» proyecta el año con lo que se va arriba o abajo del anterior a la misma fecha, igual que el tablero de inicio."
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
   "Paso 1: En la matriz, cambia entre «Mezcla del estado» (porcentajes) y «Monto» (pesos).",
   "Paso 2: Dale clic a un estado para ver qué se vende ahí, o a una familia para su mapa.",
   "La matriz cruza las familias con los 12 estados que más venden. En «Mezcla del estado» cada columna suma 100 %; en «Monto», son pesos. Al elegir un estado, abajo ves también en qué municipios se vende.",
   "Las ventas de la hoja solo traen texto, así que se clasifican con reglas de familia; abajo están las reglas y lo que quedó sin clasificar, de más a menos dinero.",
   "Solo dirección agrega reglas, y antes de guardar ve a cuántas ventas les pegaría."
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
   "La venta mes a mes desde 2018, para ver estacionalidad, crecimiento y qué familias pesan cada año.",
   "Paso 1: En «Venta por mes», compara la línea de este año contra la del año pasado.",
   "Paso 2: Usa el botón de tabla de cada gráfica para ver los números o copiarlos.",
   "Esta pestaña no usa el periodo: siempre muestra toda la historia.",
   "En la comparación año contra año el mes en curso no se dibuja hasta que cierre, porque a medias parecería una caída.",
   "«Venta de los últimos 12 meses» y «Crecimiento anual móvil» quitan la estacionalidad: cada punto suma o compara 12 meses completos.",
   "La mezcla por familia usa las reglas de «Producto × región»: en las ventas de la hoja la familia sale del texto de cada venta; en los pedidos del ERP, de la categoría del artículo."
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
   "Las ciudades y estados escritos a mano en las fichas de clientes que no se reconocieron: mientras no se ubiquen, su venta no sale en el mapa.",
   "Paso 1: Empieza por el filtro «Por resolver»: lo que más se vendió va primero.",
   "Paso 2: Si eres de dirección, elige el municipio correcto o confirma el sugerido con ✓.",
   "Paso 3: Si no es un lugar (por ejemplo «Varios»), dale «No se puede».",
   "Los filtros separan lo que hay que resolver, lo que hay que confirmar y lo que falta capturar en la ficha del cliente.",
   "Solo dirección corrige. Lo que elige se aplica a todos los clientes que lo escribieron igual; «No se puede» lo saca de la lista.",
   "Clic en el número de clientes para ver quiénes son.",
   "Lo corregido queda en «Corregidas por dirección», donde se puede deshacer."
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
   "Lo que vendemos: cada equipo y componente con su foto, descripción, precio de lista y lo que hay en planta.",
   "Paso 1: Busca por clave, nombre o una palabra de la descripción.",
   "Paso 2: Clic en un renglón para ver su ficha con la foto grande.",
   "Lo usan recepción, para contestar el teléfono, y ventas. El buscador de arriba también te trae aquí cuando buscas un artículo.",
   "Los filtros de arriba separan equipos, componentes y lo que tiene existencia. Si ingeniería ya las subió, la ficha trae también la ficha técnica y las fotos para mandarle al cliente.",
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
   "Todas las órdenes de compra, de la requisición al proveedor y del proveedor al almacén: compras las arma y envía, almacén recibe y finanzas registra pagos.",
   "Paso 1: Usa los cuadros de arriba o los filtros para cambiar la vista; de entrada ves las abiertas.",
   "Paso 2: Dale clic a un renglón para abrir la orden.",
   "Paso 3: En la pestaña Requisiciones, marca partidas y dale «Crear órdenes de compra».",
   "Las abiertas son los borradores, las enviadas y las recibidas en parte. Las atrasadas van en rojo, y la barra de Recibido dice qué parte de lo pedido ya llegó.",
   "La pestaña Requisiciones tiene lo que producción y almacén le piden a compras. «Crear órdenes de compra» arma una orden en borrador por cada proveedor de las partidas marcadas.",
   "Los importes y lo que falta por pagar solo los ve quien tiene costos o finanzas."
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
   "Una orden de compra completa: sus partidas, los datos para el proveedor, lo que ya llegó al almacén y, para quien ve dinero, sus pagos.",
   "Paso 1: En borrador, busca artículos abajo de las partidas y Enter; corrige cantidad y costo en su lugar.",
   "Paso 2: Dale «Enviar al proveedor» y luego imprímela o mándala «Por correo».",
   "Paso 3: Cuando llegue la mercancía, almacén da «Recibir» y captura lo que de verdad llegó.",
   "El costo sugerido de cada partida es el vigente del artículo; debajo ves si el del proveedor sale más caro o más barato. «Enviar al proveedor» fija las partidas, y no se envía con partidas en $0.",
   "«Por correo» la manda desde tu propio Gmail con el PDF de la orden adjunto (el mismo que sale al imprimir), al correo del proveedor que está en su ficha; puedes cambiar a quién, el asunto y el mensaje. La primera vez te pide conectar tu Gmail.",
   "Si estaba en borrador, al mandarla por correo queda enviada, con las mismas reglas que «Enviar al proveedor». Imprimir y «Por correo» solo salen a quien ve importes (costos o finanzas).",
   "En «Recibir», lo que falte queda pendiente. Si todavía no se recibe nada, compras la puede cancelar y sus requisiciones vuelven a pendientes.",
   "Si después de enviarla se acuerda con el proveedor otro artículo, otra cantidad u otro precio, compras da el lápiz de esa partida, la corrige y escribe por qué. Una partida de la que ya llegó algo no se cambia.",
   "El folio se queda (el proveedor ya lo tiene) y la orden sube de revisión: «Rev. 2» en el título y en lo impreso, para mandársela otra vez. Abajo de las partidas queda cada cambio con su antes y después, quién lo hizo y por qué.",
   "Las partidas escritas a mano dicen «Sin artículo del catálogo» y también se reciben. Si son material, en «Recibir» busca su artículo para que entren al almacén y cuenten como material. Si son un cobro, como «Manejo» o un flete, recíbelas tal cual: cuentan como recibidas y no tocan el inventario.",
   "Cuando finanzas registra la factura del proveedor y la liga a la orden, en «Factura del proveedor» dice «Registrada en finanzas» y los pagos ya se llevan en esa factura, no en la orden. Si el folio que anotó almacén al recibir es el de la factura, se ligan solas.",
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
   "Para armar una orden de compra nueva, empezando por el proveedor: de él salen la moneda, el crédito y los días de entrega.",
   "Paso 1: Si tienes la cotización del proveedor en PDF o foto, dale «Subir cotización».",
   "Paso 2: Revisa lo que leyó la IA y dale «Crear orden en borrador».",
   "Paso 3: Sin cotización, elige al proveedor y dale «Crear orden en borrador»; las partidas van después.",
   "La IA lee las partidas de la cotización y las empareja con el catálogo; tú revisas todo antes de crear la orden. Nada se guarda hasta entonces.",
   "Sin cotización, la orden se crea vacía, en borrador y con la moneda y las condiciones de pago del proveedor. Si llegas desde la ficha de un proveedor, ya viene elegido.",
   "Las órdenes solo las crea compras."
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
   "Aquí pones al día el costo de lo que se compra cuando un proveedor cambia sus precios; reemplaza la hoja ACTUALIZACIONES.",
   "Paso 1: Filtra «Más de 6 meses» o «Sin costo», o elige un proveedor para pasar su lista.",
   "Paso 2: Escribe el costo nuevo en su fila y Enter: se guarda y bajas a la siguiente.",
   "Paso 3: Si te moviste con las flechas sin guardar, al terminar dale «Guardar cambios».",
   "Con ↑ ↓ te mueves sin guardar: lo escrito queda en amarillo hasta «Guardar cambios», y «Descartar» lo borra. Esc deshace la fila. Solo captura quien tiene permiso de costos; los demás solo ven.",
   "La columna Cambio compara en pesos, con los dólares al tipo de cambio de hoy. Un triángulo avisa que el cambio pasa de 50 %: casi siempre es por unidad o moneda equivocada.",
   "Al guardar te dice a cuántos equipos les cambia el precio. A la derecha quedan los últimos cambios, con quién y cuándo.",
   "En la tarjeta «Tipo de cambio» está el que se usa para costear lo importado: si el del día no te sirve, captúralo ahí y Enter."
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
   "Paso 1: Busca por nombre o usa los filtros; «Todo el directorio» los muestra todos.",
   "Paso 2: Dale clic a un renglón para abrir su ficha.",
   "Paso 3: Para dar de alta uno, usa «Nuevo proveedor».",
   "«Nuevo proveedor» lo da de alta compras, o finanzas con sus datos fiscales. Si lo da de alta finanzas y ya existe uno con ese RFC, le pone al día los datos en lugar de duplicarlo.",
   "De entrada ves solo los que surten algún artículo o tienen órdenes abiertas (y, si ves importes, a los que se les compró en 12 meses), porque el directorio de las hojas mezclaba acreedores (nómina, casetas, hoteles). CSV baja la lista para Excel.",
   "«OC abiertas» cuenta las órdenes enviadas o recibidas en parte que todavía esperan mercancía, con las atrasadas en rojo. Lo comprado en 12 meses solo lo ve quien tiene costos o finanzas."
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
   "Paso 1: Dale «Nueva orden» para armar una orden ya con este proveedor elegido.",
   "Paso 2: Usa «Editar» para poner al día sus datos; puedes llenarlos subiendo su constancia fiscal.",
   "Paso 3: Dale clic a una orden de la derecha para abrirla.",
   "Compras edita todo; finanzas y la gerencia administrativa ponen al día lo fiscal, lo bancario, el crédito y el contacto, y pueden llenarlo subiendo su constancia de situación fiscal. Si cambian los datos bancarios, dirección recibe un aviso.",
   "Un artículo con la nota «su costo vigente es de otro proveedor» también se le compra a otro, y el costo de hoy viene de aquel.",
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
   "La cola de precios que piden los vendedores desde sus cotizaciones: qué sigue abierto, quién lo tiene y qué ya venció.",
   "Paso 1: Atiende de arriba hacia abajo: lo vencido va primero y en rojo.",
   "Paso 2: Dale «Tomar» para que el vendedor sepa que ya la tienes tú.",
   "Paso 3: En «Contestar», elige el artículo, escribe proveedor, costo y días de entrega, y Enter.",
   "Antes se pedía por el chat («¿me ayudas a cotizar esta polea?») y no se sabía qué seguía abierto. Aquí la lista va ordenada por vencimiento, con lo vencido arriba y en rojo.",
   "«Contestar» (o clic en el renglón) abre el panel de la derecha: elige el artículo del catálogo o dalo de alta ahí mismo, escribe proveedor, costo y días de entrega, y Enter contesta. «Contestar» solo aparece si tu puesto también captura costos.",
   "Si no se consigue, usa «No se consigue…» y escribe el motivo: el vendedor se lo explica al cliente.",
   "La «Nota para quien lo pidió» la lee el vendedor: nada de costos ahí.",
   "Los cuadros de arriba filtran la lista con un clic. El tiempo de respuesta se cuenta en horas hábiles de la planta y se compara contra lo que se tardaba en el chat."
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
   "Todo lo que se compra (componentes, materia prima y servicios) con lo que hay en planta y, si tu puesto vende, su precio de lista.",
   "Paso 1: Busca por clave, nombre, categoría o proveedor.",
   "Paso 2: Dale clic a un renglón para abrir su ficha.",
   "Paso 3: Usa los filtros para ver solo lo importado o lo que tiene existencia.",
   "Ingeniería y compras lo dan de alta con «Nuevo componente»; los demás lo consultan. El botón CSV baja la lista para Excel.",
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
   "La ficha de lo que se compra: sus datos, existencias por almacén, precios por canal, planos y dónde se usa; lo que ves depende de tu permiso.",
   "Paso 1: Si puedes editar, cambia el campo y sal de él (o da Enter): se guarda solo.",
   "Paso 2: Escribe la descripción con una viñeta por renglón: es la que sale en la cotización.",
   "Paso 3: Para la foto, pega la liga de Drive o de una imagen, o usa «Subir foto».",
   "«Pulir redacción» corrige la descripción (ortografía, acentos, estilo) sin tocar medidas ni marcas; ves la propuesta y decides si la usas.",
   "Marcarlo como importado pide 6 meses de cobertura en lugar de 1, y el stock de seguridad se suma al punto de reorden.",
   "Junto a «Dónde se usa», «Reemplazar componente» (ingeniería) la cambia por otra pieza en las listas que elijas, con las mismas cantidades; esta pieza se queda en el catálogo con su precio.",
   "«Canales en línea» (si ves precios de venta) compara el precio sugerido de cada canal contra lo que está publicado y avisa si una publicación quedó abajo.",
   "«Empaque para envío» guarda el peso y las medidas del paquete: lo capturan almacén o ingeniería y con eso se prellena cada envío.",
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
   "Los equipos que fabricamos y sus subensambles, con lo que lleva cada uno y sus horas: ingeniería los mantiene; producción y almacén los consultan.",
   "Paso 1: Elige la pestaña Equipos o Subensambles y busca por clave o nombre.",
   "Paso 2: Dale clic a un renglón para abrir su ficha.",
   "Paso 3: Con el filtro «Sin lista de materiales» ves qué falta capturar.",
   "El botón CSV baja la tabla para Excel. En Equipos también puedes filtrar por tipo de equipo.",
   "«Solicitudes de cambio» junta las correcciones a la lista de materiales que mandan producción o almacén desde una orden. Cada una también te llega a Pendientes y se cierra sola al aplicarla o descartarla.",
   "Un subensamble se captura una vez y se comparte: si lo cambias, cambia en todos los equipos que lo usan. Para armar uno, abre un equipo, marca las líneas que siempre van juntas y usa «Convertir en subensamble».",
   "Si cambian una pieza en la maquinaria (se descontinuó, otro proveedor), «Reemplazar componente» la cambia en las listas que elijas con las mismas cantidades. La pieza vieja sigue en el catálogo para venderse como refacción. Lo hace ingeniería.",
   "Lo que ya no se fabrica ni se vende se inhabilita con el interruptor de la columna «Activo» (lo cambian ingeniería o compras). Deja de salir en el cotizador y en pedidos nuevos, pero no cambia en los equipos que ya lo usan.",
   "Antes de inhabilitar te dice en cuántos equipos activos y pedidos abiertos está. Los inhabilitados se ven en el filtro «Inhabilitados», y ahí mismo se reactivan.",
   "Quien tiene permiso de costos ve además columnas y alertas de costo, y el filtro «Con piezas sin costo»; al pasar el mouse por cada una se explica."
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
   "La ficha de un equipo o subensamble, con su lista de materiales, parámetros, horas por etapa, fotos y planos: ingeniería la edita y los demás la consultan.",
   "Paso 1: En «Lista de materiales», escribe la clave o el nombre de una pieza y da Enter.",
   "Paso 2: Escribe la cantidad: Enter guarda y baja, Tab avanza; todo se guarda solo.",
   "Paso 3: Para piezas que siempre van juntas, márcalas y usa «Convertir en subensamble».",
   "Cada pieza entra con cantidad 1 y el cursor queda en la cantidad. Esc deshace y Alt+↑/↓ mueve la línea. Marca varias líneas para volverlas subensamble o moverlas a un grupo.",
   "Lo de adentro de un subensamble sale en gris y no se edita aquí: se cambia en el propio subensamble, porque el cambio llega a todos los equipos que lo usan.",
   "Si una cantidad depende de una medida (largo, ancho), defínela en la pestaña Parámetros. Para la misma banda con otra medida sin tocar ésta, usa «Duplicar con otros parámetros».",
   "En «Fotos» se suben una o varias fotos (o se pega la liga de Drive). La primera es la principal y sale junto a la partida de la cotización; las demás, en la hoja de fotos del PDF. Con las flechas o «Hacerla principal» cambias el orden.",
   "Para cambiar una pieza por otra con la misma cantidad, usa el botón de flechas de su línea. La pestaña «Dónde se usa» dice en qué listas está un subensamble.",
   "«Editar datos» cambia el nombre, el tipo de equipo y la descripción, que sale arriba en «Descripción»: qué es, para qué sirve y lo que conviene saber al armarlo. Las cotizaciones que ya existen conservan el nombre anterior.",
   "Ahí mismo, junto a la descripción, «Pulir redacción» le pide a la IA que corrija ortografía y estilo: ves la propuesta y decides si la usas.",
   "«Inhabilitar» lo saca del cotizador y de pedidos nuevos cuando ya no se fabrica; arriba sale la marca «Inhabilitado» y el botón cambia a «Reactivar».",
   "Quien tiene permiso de costos ve además la pestaña de costo y la de Historial; cada cifra se explica al pasar el mouse."
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
   "El panel de utilidad, antes la pestaña Reglas de Nuevo Costeo: de aquí sale el precio de lista de todo el catálogo, y solo dirección lo cambia.",
   "Paso 1: Si eres de dirección, dale «Editar» en la tarjeta de una política: se abre el simulador.",
   "Paso 2: Cambia la utilidad o un recargo y revisa en «Qué pasaría» cuántos precios se mueven.",
   "Paso 3: Si te convence, dale «Guardar y mover…»: el cambio queda en la bitácora.",
   "Lo consultan finanzas y la gerencia administrativa. Cada tarjeta es una política de precio: utilidad, recargos sobre costo y sobre precio, medida especial, redondeo y descuento máximo.",
   "Antes de guardar ves cuántos precios se mueven y cuáles más. Cada cambio queda en la bitácora con quién y cuándo.",
   "El precio de un equipo es: costo × (1 + recargos sobre costo + medida especial) ÷ (1 − utilidad ÷ (1 − ISR) − recargos sobre precio), redondeado hacia arriba.",
   "Lo que se revende usa el margen sobre precio de su política, sin compensar ISR: costo ÷ (1 − margen).",
   "El ISR de compensación, la mano de obra por etapa y el tipo de cambio también mueven precios: al cambiarlos se recalcula todo lo que depende de ellos.",
   "El tipo de cambio lo capturan compras (en Actualizar precios) o finanzas: escribe el valor y Enter."
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
   "El índice de planos, cada uno con su folio y su revisión, para saber cuál es el bueno y con cuál se fabricó cada orden.",
   "Paso 1: Elige Vigentes, Por aprobar o Anteriores y busca por folio, equipo o título.",
   "Paso 2: Dale «Drive» para abrir el archivo, o el nombre del equipo para abrir su ficha.",
   "El archivo sigue en Drive; aquí solo se lleva el control. «Por aprobar» y «Anteriores» las ven ingeniería, compras y dirección; los demás ven solo los vigentes.",
   "La revisión en verde es la vigente y en amarillo la que está por aprobar.",
   "Para ligar un plano, entra al equipo (Equipos y subensambles), pestaña Planos, y usa «Ligar plano de Drive»: el ERP le da folio y revisión.",
   "Si hay equipos en producción sin plano vigente, ingeniería los ve arriba en un aviso."
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
   "Para ver si los cambios de costo y de precio de una familia de equipos se notaron en lo vendido; lo ve quien tiene permiso de márgenes.",
   "Paso 1: Arriba elige la familia y desde qué año.",
   "Paso 2: Compara el índice de costo y de precio con las ventas de la familia.",
   "Muestra el costo y el precio de lista mes a mes, junto a lo vendido de esa familia.",
   "La primera gráfica es un índice (100 al inicio del periodo) y la segunda son pesos; van separadas a propósito, porque mezclar índice y pesos en un mismo eje engaña.",
   "El precio de lista se registra desde el arranque del ERP (la hoja no guardaba la utilidad aplicada), por eso su línea empieza después.",
   "Las ventas de antes del arranque salen del libro de la hoja (ventas desde $40,000, clasificadas por su descripción); después, de los pedidos.",
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
   "Aquí se lleva el efectivo de la oficina, cada gasto y reposición con su saldo; lo lleva finanzas, y recepción y compras anotan cuando no está.",
   "Paso 1: Elige «Sale» o «Entra», escribe el concepto y el monto, y dale Enter.",
   "Paso 2: Cuando cuentes el efectivo, usa «Arqueo» y escribe cuánto hay.",
   "Cada movimiento enseña el saldo después de él. Un movimiento mal capturado lo borra finanzas con el bote de basura; lo que vino de la hoja no se borra.",
   "Los retiros de ahorro y los abonos a préstamos que Recursos Humanos paga o recibe en efectivo de la caja entran solos, con su folio en el concepto.",
   "El arqueo y borrar un movimiento son de finanzas: quien toma el dinero no es quien cuenta la caja. En el arqueo, si lo contado no cuadra con el saldo, la diferencia queda anotada como sobrante o faltante con tu nombre.",
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
   "Lo que nos deben los clientes (pedidos y saldos de la hoja), desde cuándo, y lo cobrado cada mes: para que finanzas sepa a quién llamar y registre cobros.",
   "Paso 1: Empieza por «Los más atrasados»: son los pedidos con más días sin pagarse.",
   "Paso 2: Dale clic a un pedido para ver sus cobros y facturas.",
   "Paso 3: Ahí anota el pago con «Registrar cobro» o la factura con «Registrar factura».",
   "Los indicadores de arriba suman los pedidos y lo de la hoja, y parten el saldo por antigüedad; dale clic a uno para filtrar la tabla de pedidos. Un cobro negativo es una devolución al cliente.",
   "Las pestañas agrupan por cliente o por vendedor (clic en un renglón para ver sus pedidos). Los filtros separan lo que tiene saldo y lo que falta facturar; el CSV baja lo que ves.",
   "«Saldos de arranque (hoja)» trae, cliente por cliente, lo que se debía en la hoja antes del ERP; los pedidos que vienen de la hoja se cobran contra eso, no aparte. Dale clic a un cliente para ver sus movimientos y registrar lo que pague de ese saldo.",
   "Las facturas y los cobros se pueden registrar subiendo su XML. En el pedido, «Registrar factura» lee la factura que timbramos (folio, UUID, fecha y total) y revisa que sea de ese cliente.",
   "«Subir complementos de pago», arriba, registra cada pago en el pedido de su factura, aunque subas muchos a la vez, y no duplica lo que ya estaba.",
   "Si a una factura le falta el UUID o tiene un dato mal, corrígela con el lápiz en vez de registrarla otra vez: un folio o un UUID repetido no entra.",
   "La antigüedad corre desde la primera factura, o desde el pedido si aún no se factura; la de la hoja, desde la venta (los pagos tapan primero las ventas más viejas).",
   "Los saldos en dólares se pasan a pesos con el tipo de cambio de hoy, que se ve arriba (finanzas y compras lo pueden capturar ahí)."
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
   "Aquí entran los XML de años pasados (la carpeta FACTURAS de Drive) para que la historia de antes del ERP diga qué se compró y no solo a quién.",
   "Paso 1: Descarga de Drive la carpeta FACTURAS, un año a la vez o todo.",
   "Paso 2: Elígela con «Elegir carpeta», o elige los ZIP que da Drive con «XML o ZIP».",
   "Paso 3: Si un proveedor sale «sin renglón en la hoja», dale su RFC y usa «Volver a amarrar».",
   "La usa finanzas; lo ve también dirección. Los XML se leen en tu navegador y solo sube lo que dicen; puede tardar unos minutos por año.",
   "Volver a cargar lo mismo no duplica nada: cada factura se guarda una vez por su folio fiscal. Las que no son de Hegamex (ni la emitió ni la recibió) no se guardan.",
   "Cada factura recibida se amarra a su renglón del libro de compras de la hoja (por folio y monto, o por monto exacto y fecha cercana); de ahí sale su número de orden de compra, que abre el PDF de esa orden en Drive. Cada factura emitida se amarra a su venta por serie y folio.",
   "La tabla de arriba dice, por año, cuántas compras y ventas de la hoja ya tienen su XML; clic en un año para ver sus facturas.",
   "Las facturas canceladas no cuentan: las que vienen de una carpeta «Canceladas» de Drive se marcan solas, y si el SAT dice que otra está cancelada, el botón al final de su renglón la marca (y su renglón de la hoja pasa a la factura que la reemplazó).",
   "Las canceladas se ven en «Recibidas» o «Emitidas» con la marca «Cancelada»; no salen entre lo pendiente.",
   "Si un proveedor sale en «sin renglón en la hoja», casi siempre le falta su RFC en el ERP o se llama distinto en la hoja.",
   "Con su XML, una compra de antes cuenta en Resultados por lo que se compró (su clave del SAT) y no por el giro del proveedor. Salvo que el proveedor esté en una categoría que no es gasto, como «Sin efectos», retiros o compra de activos: esa la hoja la dejó fuera a propósito y así se queda."
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
   "Lo que debemos a proveedores y cuándo vence, lo vencido primero: finanzas planea los pagos y registra cada compra, gasto y pago; compras ve solo las órdenes.",
   "Paso 1: Registra cada factura que llega con «Registrar compra o gasto»: sube el XML y se llena solo.",
   "Paso 2: En la agenda, dale clic a un proveedor para abrir su cuenta.",
   "Paso 3: En su cuenta, dale «Registrar pago» y, si quieres, elige qué factura liquidas.",
   "La agenda enseña lo vencido primero y lo que viene en las próximas 4 semanas, sumado por proveedor cada semana. La cuenta de cada proveedor trae sus facturas pendientes, todos sus movimientos (los de la hoja y los de aquí) y el botón para registrar un pago.",
   "Al pagar, si no eliges factura, el pago va a las que vencen primero. Pagar de más solo se puede como anticipo.",
   "Cada factura que llega (material, flete, luz, servicio) se registra con «Registrar compra o gasto»: el XML llena proveedor (por su RFC), folio, total y fecha, y puedes subir varios a la vez. Si no tienes el XML, sube el PDF o una foto: la IA la lee, y tú revisas los datos antes de registrar.",
   "Si la factura dice que es de contado, marca «Ya se pagó (de contado)» y elige la cuenta. Si el proveedor no existe, se da de alta ahí mismo con su RFC.",
   "Si el proveedor tiene órdenes de compra, el formulario te pregunta de cuál es la factura; ya viene marcada la que casa con el folio que anotó almacén al recibir. En la cuenta del proveedor, el botón del portapapeles en cada compra cambia de qué orden es.",
   "Con orden, cada partida cuenta por su artículo (consumible del taller o material) y la categoría solo aplica a lo que no tiene artículo, como un flete. Sin orden (luz, honorarios, publicidad), la categoría es obligatoria: es lo que dice en qué se gastó.",
   "Con el XML, la categoría se sugiere por la clave del SAT de lo que se compró (o por cómo registraste antes esa clave); si no, viene la del proveedor.",
   "«Facturas por pagar» es la lista de facturas con saldo. «Por proveedor», lo que se le debe a cada uno; ahí están aparte los préstamos de socios y los créditos del banco, y lo que tenemos a favor.",
   "«Órdenes de compra» son las órdenes recibidas con saldo que todavía no tienen su factura registrada; en cuanto se liga su factura, lo que se debe se paga por la factura.",
   "«Pagos hechos» es todo lo que ya se pagó, por periodo y por cuenta, con su total y el botón CSV para el contador. Va por la fecha del pago; lo que acabas de registrar, aunque sea de otro mes, está en «Recién capturados».",
   "Los retiros de caja de ahorro que entrega Recursos Humanos salen en «Pagos hechos» al elegir «Nómina e impuestos», a nombre de «Caja de ahorro del personal». Los abonos en efectivo a préstamos entran en la cuenta de «Préstamos al personal». De los dos te llega un aviso.",
   "Cada factura vence en su fecha más los días de crédito del proveedor; cámbialos en su cuenta si no están bien y todas sus fechas se recorren. Lo que venía de 2021 cuenta como vencido. Las órdenes en dólares se pasan a pesos con el tipo de cambio de hoy.",
   "Si un pago o compra también se anotó en la hoja, no se cuenta dos veces. Una factura ya registrada (mismo folio y proveedor) no entra otra vez; si se parece a otra (mismo monto, misma semana), te lo avisa antes de guardar.",
   "Si una factura sale «¿Repetida en la hoja?», es que la hoja la tiene dos veces y la otra ya se pagó: no la pagues; ábrela en la cuenta del proveedor y márcala con «Estaba repetida».",
   "Si encuentras en la hoja una compra o un pago de más (aunque la copia esté con otro nombre de proveedor) o una factura que se canceló, usa el botón de la derecha del renglón en los movimientos de la cuenta: queda tachado con tu motivo, deja de contar y se puede deshacer.",
   "Una factura de la hoja de menos de $1 por pagar son centavos de redondeo y no se enseña. Si una cuenta de la hoja dice que no está ligada a un proveedor del catálogo, elige cuál es ahí mismo para poder pagarle."
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
   "Cuánto deja de verdad lo que se vende, desde 2018: de las ventas, cuánto se va en fabricar, vender y administrar, impuestos e intereses, y cuánto queda.",
   "Paso 1: Elige el periodo arriba: de entrada abre «Mes pasado»; también hay «Año pasado» o «Rango».",
   "Paso 2: Lee el diagrama de izquierda a derecha y pasa el mouse por una franja.",
   "La ven dirección, finanzas y la gerencia administrativa. Con «Rango» eliges fechas desde 2018.",
   "En el diagrama, las ventas por línea se juntan y se reparten en costo de fabricación, gastos de operación, impuestos e intereses y utilidad; el grueso de cada franja es el dinero. Al pasar el mouse ves cuánto es y qué parte de las ventas.",
   "Con el botón de tabla ves lo mismo en números. «Año por año» compara cada año desde 2018.",
   "Antes del 12 de octubre de 2026 los números salen de las hojas: ventas y compras como se registraron ahí. Cada compra cuenta por lo que se compró si su XML está cargado en «Facturas anteriores» y su clave del SAT lo dice; si no, por la categoría de su proveedor.",
   "Lo que la hoja tenía en «Sin efectos» u otra categoría que no es gasto se queda fuera aunque su XML diga otra cosa.",
   "Desde el 12 de octubre de 2026 los números salen del ERP, donde una factura ligada a su orden de compra cuenta por sus partidas: los consumibles del taller como gasto de fabricación y el material en lo vendido.",
   "Los números con ≈ son estimados: lo vendido de la hoja no tiene costeo y la nómina de la hoja se reparte entre taller y oficina con la proporción de hoy. La tabla de abajo dice de dónde sale cada número, y lo que no es gasto (retiros de socios, préstamos, compra de activos) se enseña aparte sin restarse.",
   "Mercado Libre sale de Mercado Pago venta por venta desde fines de octubre de 2025 (Mercado Libre no da ventas más viejas): lo que pagó el comprador cuenta como venta y lo que se quedó Mercado Libre (su comisión, el envío que pagamos y otros cargos) como gasto.",
   "La hoja solo anotaba como venta las que se facturaban y nunca anotó esos cargos, porque Mercado Libre los descuenta antes de depositar; por eso, desde esa fecha, sus renglones de Mercado Libre ya no cuentan. Antes de esa fecha, las ventas de Mercado Libre son las de la hoja y sus cargos salen en $0.",
   "Las comisiones de los vendedores van en el mes de las ventas que las generaron, aunque se hayan pagado después. Antes del arranque, las que se registraron como pagadas en Comisiones (en un mes sin ninguna registrada, las que anotó la hoja); desde el arranque, lo que da la regla de cada vendedor.",
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
   "Finanzas ve aquí lo que el SAT dice que nos facturaron y nadie ha registrado: ni en la hoja, ni en las compras del ERP, ni en caja chica.",
   "Paso 1: Carga los XML del mes en «Facturas anteriores (XML)»; el botón «Cargar XML» te lleva.",
   "Paso 2: Dale «Registrar» en cada factura, o «Registrar las…» para pasarlas todas, una por una.",
   "Sale de los XML cargados en «Facturas anteriores (XML)»: carga ahí los del mes y aquí aparece lo que no está en la hoja de compras, en las compras del ERP ni en caja chica.",
   "Arriba: cuántas faltan y cuánto suman, cuánto es a crédito (cuentas por pagar que no salen en Pagos a proveedores) y cuántas son de un proveedor que todavía no está dado de alta. Clic en un indicador filtra la lista.",
   "«Registrar» abre «Registrar compra o gasto» ya lleno con la factura, igual que si subieras su XML; si el proveedor no existe, se da de alta ahí con su RFC. Ya registrada, sale sola de la lista.",
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
   "El tablero de importaciones: cada embarque en su etapa, lo urgente arriba y lo que esperamos del proveedor, el agente aduanal o la naviera.",
   "Paso 1: Revisa «Lo que no puede esperar»: dale clic a un aviso para abrir su embarque.",
   "Paso 2: En las columnas, cada tarjeta dice el siguiente paso y quién lo debe; «Nos toca» es nuestro.",
   "Paso 3: Al volver a pedir un documento a otros, dale «Ya lo pedí» en su renglón.",
   "Lo lleva importaciones; almacén y producción lo consultan para saber qué llega y cuándo. Con «Nuevo embarque» das de alta uno: basta con decir qué viene, y si ya tienes el BL, la PI, la factura o el packing list, la IA llena el alta.",
   "Arriba ves cuántos embarques van en curso y los riesgos de hoy. Si ves el dinero de importaciones, también lo que falta pagar a proveedores y lo que hay por recuperar; si no, cuántos llegan a planta en los próximos 14 días.",
   "«Lo que no puede esperar» son avisos que arma el sistema solo: rojo es riesgo y ámbar, atención. Clic en uno abre su embarque.",
   "Cada columna es una etapa: con el proveedor, en el mar, en puerto y en planta. La etapa de cada embarque la marca la última fecha real capturada, no una casilla. La barra de días libres se pone ámbar cuando faltan 3 días o menos y roja cuando se acaban.",
   "«Lo que estamos esperando de otros» junta los documentos pendientes por quién los debe, con la última vez que se pidieron. «Ya lo pedí» anota que hoy los volviste a pedir.",
   "«Tiempos por proveedor» dice cuánto tarda de verdad cada proveedor, de la orden a planta. El reabasto usa esos días en lugar del tiempo capturado a mano. Si ves dinero, la pestaña Dinero junta pagos y saldos de todos los embarques."
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
   "Paso 1: Revisa arriba el siguiente paso, quién lo debe, la llegada y los días libres.",
   "Paso 2: En Etapas, captura la fecha real de cada paso y dale Enter para guardarla.",
   "Paso 3: En Documentos, sube cada archivo que llegue, o usa «Leer con IA» para que llene los datos.",
   "Arriba ves el siguiente paso, la llegada (ETA o fecha real, y cuándo se espera en planta) y, ya que arribó, los días libres en puerto y del contenedor. Antes del arribo, ese cuadro dice cuántos documentos están listos y cuántos pide el agente antes de que llegue.",
   "En Etapas no se aceptan fechas futuras: para eso está la ETA. Con el lápiz corriges una fecha; si el paso se registró por error (un embarque cerrado que no era), «Quitar este paso» lo borra con su motivo y deja la nota en la historia.",
   "«Cerrado» quiere decir que ya se recuperó el saldo a favor y la garantía. Para registrarlo hace falta la cuenta de gastos y que lo que había por recuperar ya esté marcado como recuperado en Dinero → Por recuperar; si no, no te deja.",
   "Documentos es la lista de lo que necesita este embarque, con quién debe cada uno. Los marcados «antes del arribo» los pide el agente aduanal antes de que llegue.",
   "«Leer con IA» lee un PDF o una foto (proforma, factura, packing list, BL, pedimento o cuenta de gastos) y te propone los datos junto al archivo. Nada se guarda hasta que lo revisas y confirmas.",
   "En Órdenes ligas las órdenes de compra que viajan en el embarque; de ellas sale lo que se le debe a cada proveedor. Las pestañas Correos y Dinero solo aparecen si ves el dinero de importaciones, y Costeo si ves costos.",
   "En Correos ligas los hilos de tu Gmail donde se lleva el embarque (con el proveedor, el forwarder, la naviera o el agente). La primera vez, «Conectar mi Gmail». «Ligar hilo» busca en tu Gmail como lo harías allá: por BL, referencia del agente o proveedor.",
   "El ERP guarda cada correo sin lo citado de los anteriores, así que lo ve cualquiera que vea esta pestaña aunque no sea su Gmail. «Traer lo nuevo» lo pone al día y solo lo puede hacer quien ligó el hilo. Como los correos traen montos, solo la ve quien ve el dinero de importaciones.",
   "«Leer correos con IA» lee los correos del embarque y te dice en qué va: fechas de etapas que ya pasaron, ETA, datos como BL, buque o contenedor, documentos que llegaron y lo que está pendiente y de quién. Si son demasiados, deja fuera los más viejos y te avisa cuántos. Cada punto dice de qué correo salió (dale clic para verlo).",
   "Nada cambia hasta que lo revisas: vienen todos marcados, quitas lo que no es y le das «Aplicar». Se aplica igual que si lo capturaras a mano: una fecha futura no se acepta como etapa (y entonces no se aplica nada) y un cambio de ETA queda en la historia. Los documentos que llegaron pasan a recibidos, pero el archivo se sube aparte. Los montos que menciona solo se muestran."
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
   "El dinero de las importaciones: qué se les debe a los proveedores del extranjero, qué pagos vienen y qué nos tienen que regresar.",
   "Paso 1: En «Pagos en dólares que vienen», revisa los próximos pagos; la fecha en rojo ya pasó.",
   "Paso 2: En «Dinero por recuperar», reclama los saldos y garantías en rojo: ya pasaron de su fecha.",
   "Lo ven importaciones, compras y finanzas. Si tu puesto no ve el dinero de importaciones, esta pestaña no aparece y te quedas en Embarques.",
   "Arriba: lo que falta pagar a proveedores, lo programado en los próximos 30 días y lo que hay por recuperar. No hay cuenta en dólares: todo sale de pesos o por EBANX.",
   "«Pagos en dólares que vienen» lista cada orden ligada a un embarque con lo pagado, lo que falta y su próximo pago; la fecha en rojo ya pasó. Lo que sigue en producción no tiene fecha hasta que el proveedor avisa que está listo. Los pesos son aproximados al tipo de cambio de hoy.",
   "«Dinero por recuperar» son los saldos a favor con el agente aduanal y las garantías de contenedor que nadie ha marcado como recuperados; en rojo los que ya pasaron de su fecha. Se marcan con «Recuperado» en la pestaña Dinero de cada embarque.",
   "«Por embarque» resume mercancía, lo pagado con su tipo de cambio real, gastos e impuestos, el IVA acreditable aparte y lo que falta recuperar. «Pagos en dólares que vienen» y «Por embarque» se bajan a Excel con el botón CSV."
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
   "El taller por etapas con la gente adentro: quién trabaja qué ahorita, qué está pausado y qué sigue. La usan la gerencia de producción y los supervisores.",
   "Paso 1: Elige la vista «Por etapa» o «Por cuadrilla»; en verde, quien está trabajando ahorita.",
   "Paso 2: Gerencia: arrastra a una persona del personal a una tarjeta para meterla a esa cuadrilla.",
   "Paso 3: Acomoda la cola arrastrando una tarjeta sobre otra; iniciar, pausar y terminar se marca en la terminal.",
   "No es otra captura: lo que se marca en la terminal de piso sale aquí al momento, y lo que se mueve aquí lo ve la terminal.",
   "Arriba está el personal por área. Fuera del horario del taller (de noche, en fin de semana) ya no sale en verde: un aviso dice quién dejó su tiempo abierto y si está contando o no.",
   "«Por etapa»: una columna por área con lo que está trabajando (con quien tiene su tiempo contando), lo pausado y lo que ya puede empezar. Lo que todavía está en una etapa anterior se junta cerrado en «Más adelante», para no repetir la misma orden en todas las columnas; Torno, que va en paralelo, sale lista desde que se libera la orden.",
   "«Por cuadrilla»: una columna por cuadrilla con lo que trabaja ahorita y lo que le sigue, como el tablero de Luis, y al final «Sin cuadrilla» con lo que nadie tiene asignado. En las dos vistas, quien está planeado sale en línea punteada.",
   "La gerencia de producción arrastra a una persona a una tarjeta para meterla a esa cuadrilla, de una tarjeta a otra para moverla, o de regreso al personal para sacarla. Lo que no ha empezado solo queda planeado.",
   "Si con eso alguien deja de trabajar o empieza en una etapa en proceso, primero pregunta: su tiempo se cierra o empieza a contar en ese momento, así las horas de cada quien son las de verdad.",
   "La cola es la misma fila del Gantt, así que el plan se recalcula con ese orden. Clic en una tarjeta abre su detalle con lo mismo en botones (agregar, sacar, «Antes» y «Después»).",
   "Las horas que faltan y las que tiene encima cada persona salen de las horas estimadas menos las ya trabajadas, repartidas entre la cuadrilla. Son para darse idea, no una promesa.",
   "«Personal de piso» (arriba, para la gerencia) es la gente de Producción: ahí le cambias el área y decides si entra a cuadrillas. Solo quien entra sale aquí y en la terminal; un coordinador o un ayudante de almacén quizá no. Altas, bajas y cambios de departamento siguen siendo de Recursos Humanos.",
   "Arriba de esa lista eliges cómo se cuentan las horas de la terminal: «Solo el horario del taller» (nadie pausa para desayunar o al irse) o «Lo que marque la terminal», tal cual (para cuando haya una terminal por área).",
   "Abajo pones el horario del taller: qué días se trabaja, entrada y salida, los descansos y los días con otro horario (tiempo extra o un día que no se trabaja). Con ese horario se cuentan las horas y se arma el plan del Gantt.",
   "«Capacidad por área» dice cuántas horas por semana da cada área. En las automáticas: la gente del área que entra a cuadrillas × las horas de la semana del taller × el aprovechamiento (85 % al empezar). Cambia sola cuando mueves a alguien de área o de cuadrillas, y con ella se recalculan el plan y las fechas de entrega.",
   "Ahí mismo pones el aprovechamiento y decides qué áreas van a mano (Pruebas y Embarque, que no tienen gente fija).",
   "En «Especialidades» armas las cuadrillas por tipo de equipo dentro de un área (en Pailería: cribadoras, dosificadoras…): a cada una le dices qué equipos hace, y en la lista de la gente eliges la especialidad de cada quien; quien no tiene hace de todo.",
   "Con las especialidades, el plan le da a cada una las horas de su gente, la gente del área sale junta por especialidad arriba del tablero y cada tarjeta dice de cuál es."
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
   "El plan del taller en el tiempo: cuándo empieza y termina cada etapa de cada orden y si llega a su fecha compromiso. No se captura nada.",
   "Paso 1: Elige la vista (Por orden, Por pedido o Por área) y el zoom (Días, Semanas o Meses).",
   "Paso 2: Pasa el mouse por una barra para ver sus fechas; clic abre la orden con sus etapas.",
   "Paso 3: Gerencia: arrastra una orden por su asa para cambiar su lugar en la fila.",
   "El ERP lo calcula con las horas estimadas de cada etapa, lo que puede trabajar cada área, la cuadrilla de cada etapa y el orden de la fila, y lo recalcula al momento con lo que se marca en el piso. Lo ven la gerencia de producción, los supervisores, almacén e ingeniería de procesos.",
   "Cómo se lee: cada barra es una etapa con el color de su área. Apagada, ya se hizo; llena con rayas que se mueven, se está trabajando (llena hasta hoy, translúcida en lo que le falta); rayada, pausada; translúcida, planeada.",
   "El rombo es la fecha compromiso: verde si el plan llega antes, rojo si no, y la franja roja son los días que faltarían. La línea azul es hoy.",
   "«Por orden»: un renglón por orden, en el orden de la fila. «Por pedido»: las órdenes juntas por pedido, con cuándo acaba el pedido completo. «Por área»: un renglón por área con lo que va a trabajar; si el área tiene especialidades, un renglón por especialidad (Pailería · Cribadoras) y uno con lo demás.",
   "En «Por área», al pasar el mouse por una orden se resaltan sus etapas en todas las áreas. Días, semanas o meses cambia cuánto tiempo cabe en la pantalla. Puedes buscar una orden o ver solo las que van tarde. La vista y el zoom que dejes se quedan para la próxima vez.",
   "Al pasar el mouse por una barra ves también cuánto le falta y quién la trabaja. La gerencia acomoda la fila arrastrando una orden por su asa, o con «Subir» y «Bajar» en su detalle: el plan se recalcula y la cola de Cuadrillas y de la terminal queda en ese mismo orden.",
   "De dónde salen las fechas: el plan sigue el horario del taller (los días que no se trabaja se los salta). Cada área trabaja cada día su parte de sus horas por semana, y cada etapa avanza al día lo que dura la jornada por cada persona de su cuadrilla (sin cuadrilla, cuenta 2).",
   "En un área con especialidades, cada una trabaja con las horas de su gente: una cribadora solo avanza con la cuadrilla de cribadoras y con quien hace de todo, y lo que no es de ninguna especialidad lo hace cualquiera del área.",
   "Una etapa empieza al día siguiente de que acaban las anteriores, salvo las que van en paralelo (Torno), que arrancan sin esperar. Las órdenes en espera no entran al plan: salen abajo con su motivo.",
   "Es un plan, no una promesa: si algo se atrasa en el piso, las barras se recorren solas."
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
   "El tablero de producción: todas las órdenes abiertas por estado, qué va atrasado, qué no tiene material y cuánto trabajo tiene cada área.",
   "Paso 1: Dale clic a un indicador para filtrar el tablero, o busca por folio, serie, equipo o cliente.",
   "Paso 2: Revisa en cada tarjeta el compromiso y los faltantes de material: lo rojo es lo que urge.",
   "Paso 3: Si eres de la gerencia, libera, sube o baja la prioridad o cambia la fecha desde la tarjeta.",
   "Lo consulta todo el que ve producción: mantenimiento, almacén, ingeniería y los vendedores, para ver cómo van sus equipos. Los botones de cada tarjeta solo los ve la gerencia de producción.",
   "Las columnas van de Planeada (validando material) a Liberada (lista para el taller), En proceso y Terminada (por entregar). En cada una, lo urgente y lo atrasado va arriba. También puedes filtrar por cliente o por etapa.",
   "En cada tarjeta: el avance (el personal de planta, almacén, ingeniería y compras ve también las horas), la fecha compromiso en verde, ámbar (3 días o menos) o rojo (ya pasó) y los faltantes de material, en rojo si alguno no se ha pedido a compras.",
   "Una orden no se libera sin la revisión de ingeniería: mientras falte, el botón Liberar está apagado.",
   "Una orden con la insignia «En espera» (cliente ausente, por ejemplo) no cuenta en los atrasos ni en la carga hasta que se reactive desde su detalle.",
   "Abajo, «Carga del taller» dice cuántas semanas de trabajo tiene cada etapa contra lo que puede trabajar por semana, y «Actividad reciente» muestra en vivo lo que marcan el taller, almacén e ingeniería; clic en una línea abre su orden."
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
   "Las mejoras del taller (kaizen): las ideas de la gente y los problemas que reporta el piso, cada una con quién la lleva, para cuándo y qué se logró.",
   "Paso 1: Propón una con «Tengo una idea»: basta una línea, aquí o en la terminal de piso.",
   "Paso 2: Revisa «Del piso, sin mejora todavía» y usa «Volverla mejora» en lo que valga la pena.",
   "Paso 3: Abre una tarjeta para decidirla, ponerla en marcha o escribir su resultado y marcarla hecha.",
   "La ven y la usan producción, ingeniería de procesos y la gerencia. A quien tuvo la idea se le reconoce.",
   "«Del piso, sin mejora todavía» junta lo que se reportó en los últimos 30 días: problemas, pausas con motivo, etapas reabiertas y fallas de máquinas. «Volverla mejora» la propone con lo que se reportó.",
   "El tablero va de izquierda a derecha: Propuestas, En marcha y Hechas. Ingeniería de procesos y la gerencia de producción deciden: le ponen quién la lleva y para cuándo y la ponen en marcha, o la descartan diciendo por qué.",
   "Quien la lleva escribe el resultado, sube la foto de antes y la de después, y la marca hecha. Quien la propuso recibe un aviso en cada paso.",
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
   "Los números de la planta para mejorar el proceso (lean): entregas a tiempo, cuánto tarda un equipo, dónde se espera, horas contra lo estimado y cómo andan las máquinas.",
   "Paso 1: Elige arriba el periodo, de 30 días a 12 meses.",
   "Paso 2: Revisa «Por etapa» para ver dónde se va el tiempo; cada tabla se descarga en CSV.",
   "La usan ingeniería de procesos, la gerencia de producción y dirección. También dice qué parte del tiempo de un equipo en el taller se trabaja de verdad (la eficiencia del flujo).",
   "Lo primero que ves, si hace falta, es cuánto se marcó en la terminal: las horas, los tiempos y la eficiencia del flujo salen solo de las etapas que el piso marcó con quién las trabajó. Las entregas a tiempo y los equipos terminados no dependen de eso.",
   "«Por etapa» dice dónde se va el tiempo: cuánto espera cada área para empezar, cuánto se trabaja, las horas reales contra las del costeo, las pausas, los problemas y las etapas reabiertas. «Por equipo» compara las horas de cada modelo y «Por persona» las horas hombre de cada quien.",
   "«Máquinas» junta las fallas y los preventivos del periodo, y «Problemas y retrabajo», lo que reportó el piso y las etapas que se reabrieron.",
   "Quien además ve costos tiene la mano de obra real contra la estimada a la tarifa de cada oficio: la diferencia en rojo es lo que costó tardarse de más.",
   "De las herramientas lean, kaizen y A3 ya se trabajan en Mejoras; 5S, OEE y SMED se irán habilitando conforme el equipo las use."
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
   "Todas las órdenes de producción con su material: qué está apartado, qué falta y si ya se pidió a compras, para preparar cada orden antes del taller.",
   "Paso 1: Filtra por estado, atrasadas o con faltantes, o busca por folio, serie, equipo, cliente o pedido.",
   "Paso 2: Dale clic a un renglón para abrir la orden y trabajar su material.",
   "Paso 3: Para crear, usa «Crear órdenes desde pedido», u «Orden para stock» si no tiene cliente.",
   "La usan la gerencia, almacén e ingeniería. Los renglones en rojo están atrasados; «En espera» en lugar de la fecha quiere decir que la orden está detenida (pasa el mouse para ver por qué).",
   "Debajo del material van tres palomitas: Ing. (ingeniería revisó la lista), Apartado (se apartó el material) y Alm. (almacén revisó la existencia física).",
   "«Crear órdenes desde pedido» muestra los pedidos confirmados que todavía tienen equipos por producir (el número del botón) y «Orden para stock» crea una sin cliente.",
   "Cada orden copia la lista de materiales del equipo al crearse, así un cambio posterior al catálogo no la mueve. Cada orden de un equipo saca su número de serie sola, si el equipo ya tiene código."
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
   "Todo lo de una orden de producción en una pantalla: para quién es, su compromiso y avance, lo que se vendió, el material, las etapas y quién hizo qué.",
   "Paso 1: Sigue los pasos de «Validación de material»: cada quien ve el botón del suyo.",
   "Paso 2: Almacén: entrega con «Surtir», anotando quién recibe y lo que sale.",
   "Paso 3: Si algo de la lista está mal, usa «Solicitar cambio a ingeniería».",
   "Clic en el recuadro «Pedido y cliente» abre el pedido de la orden. «Lo que se le vendió al cliente» trae la descripción de su partida, sin precio; «Imprimir» la saca en una hoja para el taller.",
   "Ventas y quien solo sigue el avance ven el compromiso, las etapas y la historia; el material, los planos y las horas son de planta, almacén, ingeniería y compras.",
   "«Validación de material» son los cinco pasos antes del taller, en orden: ingeniería revisa la lista, se aparta el material, se piden los faltantes a compras, almacén revisa la existencia física y la gerencia la libera. Cada paso guarda quién y cuándo. Sin la revisión de ingeniería no se puede liberar.",
   "En Material, la lista sale agrupada por categoría (todo lo eléctrico junto, todo el material para aire, la tornillería…); con «Agrupar por» la cambias a subensamble (la parte del equipo donde va) y la próxima vez te sale como la dejaste. El buscador encuentra por nombre, clave o categoría, sin acentos.",
   "Falta es lo requerido que todavía no está surtido ni apartado; Pedido es lo que ya se pidió a compras para esta orden; Disponible es lo que hay en planta sin apartar para nadie.",
   "Al surtir, la lista también sale por categoría y con buscador; si escribiste cantidades en partidas que la búsqueda esconde, te avisa que también salen. Las cantidades empiezan vacías: toca el número de «Por surtir» o de «Apartado» para llenarlo. Si es una parte, lo demás queda por surtir.",
   "De una partida no sale más de lo que falta: si hace falta más, pide el cambio con «Solicitar cambio a ingeniería», para que la lista del equipo quede como en la realidad. Tampoco puede llevarse lo apartado para otra orden.",
   "En las órdenes que venían de la hoja, «Ya se había entregado con la hoja» registra lo que ya se dio antes del ERP sin descontar inventario otra vez.",
   "Si «Consumibles del taller» está encendido, lo marcado «Del taller» (discos, lijas, soldadura, EPP) no falta ni se surte a la orden: almacén lo da a nombre de quien lo recibe. En la línea de tiempo, «Ver partidas» en cada surtido dice qué salió, cuánto y de qué almacén.",
   "Ingeniería y la gerencia de producción cambian la lista solo para esta orden: «Agregar material» mete un componente o un subensamble completo (para fabricarlo aquí, con sus componentes, o ya hecho como pieza); en cada renglón, las flechas lo reemplazan por otro y el bote lo quita.",
   "Lo reemplazado o quitado no se borra: queda tachado con quién, cuándo y por qué, y se regresa con «Volver» si fue un error. Si el cambio es porque la lista del equipo está mal, pide además el cambio a ingeniería.",
   "En Etapas, el taller inicia, pausa, reanuda y termina cada una. Desde aquí no se anota quién la trabaja: para que cuenten las horas hombre, hazlo en la terminal. El avance sale de las horas de las etapas terminadas más lo que el piso reportó de las que van a medias.",
   "Si una se terminó por error, el aviso trae «Deshacer» (15 minutos para quien la terminó) y la gerencia tiene «Reabrir» en la etapa, con el motivo: regresa a pausada. Lo que pidas a ingeniería queda en la orden y en la línea de tiempo.",
   "Las etapas de la orden salen de las horas por etapa del equipo, y la orden se termina sola al acabar la última. Si al equipo le falta una (por ejemplo Detallado), la gerencia usa «Agregar etapa» con sus horas: queda pendiente para el taller y, si la orden ya estaba terminada, regresa a «en proceso».",
   "Si el equipo se detiene sin cancelarse (el cliente dejó anticipo y no ha regresado), la gerencia usa «Poner en espera» con el motivo: deja de contar en la carga del taller y en los tiempos de entrega, no sale atrasada y la terminal no la muestra. «Reactivar» la regresa tal como estaba.",
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
   "Los pedidos vistos desde la planta: qué se vendió, a quién, para cuándo y cómo va cada equipo en el taller. No trae montos.",
   "Paso 1: Elige un filtro (Activos, Sin orden, Listos para entregar…) y dale clic a un pedido.",
   "Paso 2: Revisa cada partida con su descripción y sus órdenes; el folio de la orden abre su detalle.",
   "Paso 3: Gerencia: usa primero «Usar OP-…» si hay uno en stock, y luego «Crear las órdenes que faltan».",
   "La usan la gerencia de producción, los supervisores y almacén. Cada partida trae su descripción tal como se le cotizó al cliente (medidas, calibres, motor, acabado), sin precio; las largas se abren con «Ver toda la descripción».",
   "«Activos» son los confirmados, en producción y listos para entregar; «Sin orden», los que tienen equipos que nadie está fabricando todavía. Las ventas de Mercado Libre que no llevan nada que fabricar no salen ahí: están en «Mercado Libre», y su envío se lleva en Almacén → Envíos.",
   "Al abrir un pedido ves sus partidas y las órdenes de cada una, con su avance. Hasta abajo, «Plan del taller» es el Gantt de los equipos del pedido: cuándo entra y sale cada uno de cada área.",
   "La gerencia crea desde aquí las órdenes que faltan. Si hay un equipo igual (la misma clave) hecho o en proceso para stock, sale «Usar OP-…»: se asigna al pedido con un clic y ya no se fabrica otro. Así se reemplaza la «S-» de la hoja.",
   "Usa primero «Usar» y después crea las que falten: una orden creada antes ocupa la partida y «Usar» ya no sale. Si te equivocas de orden, o el cliente cancela, la flecha junto a la orden la regresa a stock.",
   "Las partidas de texto, como una instalación, dicen «No se fabrica».",
   "«Imprimir descripción» saca en una hoja lo que se vendió, partida por partida, para el taller (sin precios).",
   "Almacén entrega desde aquí: en el pedido, «Hoja de salida» imprime lo que firma el cliente (sin precios) y «Entregar» pide quién recibió y, si la tienes, la foto de la hoja firmada. Si fue un error, «Deshacer» en el aviso durante 15 minutos."
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
   "Cada equipo que hemos hecho con su número de serie: de quién es, de qué pedido y factura, y qué tiene cada cliente. La usan producción, servicio y ventas.",
   "Paso 1: Busca por serie, cliente, equipo, pedido o factura, o filtra por familia.",
   "Paso 2: Dale clic a un renglón para abrir su ficha, con su orden y sus servicios.",
   "Aquí están los del libro de seriales de la hoja (desde 2015) y los que numera el ERP. «En taller o por entregar» deja solo lo que sigue en planta.",
   "El número de serie ya no se escribe a mano: al crear la orden de producción de un equipo, el ERP arma su código y le pone el siguiente número de su familia, sin repetir ni saltar.",
   "Para eso cada equipo necesita su código una vez, en la pestaña «Códigos y tiempos por equipo»; la flecha muestra el serial que saldría con el número que sigue.",
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
   "La tablet de cada estación del taller: con botones grandes inicias, pausas, reanudas o terminas cada orden de tu etapa, o reportas un problema.",
   "Paso 1: Toca «Iniciar» en una orden y marca quiénes la trabajan.",
   "Paso 2: Usa «Se une» o «Sale» cuando alguien entra o se va, sin detener la etapa.",
   "Paso 3: Al acabar toca «Terminar»; si dejan la orden a medias, «Pausar».",
   "La usan los encargados de piso. Sale lo que se trabaja en su etapa, en el orden de la cola que acomoda la gerencia en Cuadrillas o en el Gantt. Cada tarjeta dice primero la OP (la orden que se fabrica) y el equipo; abajo, más chico, el pedido y el cliente.",
   "Al iniciar o reanudar vienen marcados los que planeó la gerencia en Cuadrillas (en lo que no ha empezado dice «Le toca»); si no hay, la última cuadrilla de esa tablet. Primero sale la gente de esa etapa. Si alguien no está dado de alta o es un ayudante de paso, súmalo en «Sin nombre».",
   "Una persona no puede estar en dos etapas a la vez. Con eso salen las horas hombre de cada etapa: el tiempo de cada persona sumado. Se ven en el detalle de la orden contra las horas estimadas del costeo. Al pausar o terminar la etapa salen todos.",
   "¿Hay que pausar para desayunar? Arriba de la lista lo dice. Si la gerencia eligió «Solo el horario del taller», no: la noche, los días que no se trabaja y los descansos no cuentan; pausa solo cuando dejen la orden. Fuera de horario, lo que quedó iniciado dice «fuera de horario» y sigue solo cuando abre el taller.",
   "Si eligió «Lo que marque la terminal», sí: pausa al desayunar, al comer y al irte.",
   "¿Terminaste una por error? El aviso verde trae «Deshacer» unos segundos: la etapa regresa a pausada. Tienes 15 minutos; después, pídeselo a la gerencia de producción.",
   "En lo que ya empezó, «¿Cuánto lleva?» (¼, ½, ¾, casi) dice cómo va la etapa: con eso el tablero, la TV y el plan saben cuánto falta aunque las horas no se hayan marcado desde el principio.",
   "¿Se te ocurre cómo hacerlo mejor? «Tengo una idea» (arriba, el foco) la manda a ingeniería de procesos y a la gerencia con tu nombre; basta una línea. Los problemas que reportas también les llegan para volverlos mejora.",
   "En la TV, la cinta «Último» dice lo que pasó en el taller en los últimos días: qué OP empezó, pausó o terminó cada área y quién, los problemas, el material que entregó almacén y las órdenes nuevas o terminadas."
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
   "«Está bien así» pide siempre el porqué. Si dirección lo tiene prendido, la IA lo lee (salvo en una compra a un precio muy distinto al de la anterior): si es una razón de verdad (son dos sucursales, el proveedor cambió la fecha) se cierra; si suena a costumbre (dejar vacío un dato porque «todavía no se sabe»), te pregunta, hasta 3 veces.",
   "Si al final no queda claro, se queda abierto con «Lo ve dirección» y le llega con la conversación. Lo que contesta dirección no pasa por la IA.",
   "«Ayúdame a corregirlo» sale cuando la corrección es un dato de captura (fechas, tiempo de entrega, notas, contacto, categoría, cantidades de partida). La IA te propone el cambio exacto, con cómo está y cómo quedaría; puedes decirle algo que deba saber («el tiempo es de 45 días hábiles»).",
   "Nada se aplica hasta que eliges «Aplicar a mi nombre»: se hace con tus permisos, como si lo capturaras a mano, y queda en la bitácora. Precios, dinero, existencias y permisos nunca se cambian así.",
   "Lo que dice «Regla» lo encontró una regla fija; lo que dice «IA» (con destellos ✦) lo señaló la IA al leer lo de ayer. Ninguno cambia nada sin que tú lo digas. En «Contestado» ves lo que ya respondiste.",
   "Todos abren en «Para ti», con lo suyo. Dirección tiene además «Todo lo abierto», donde lo de otra persona dice «Le toca a …» y se filtra por persona con «De quién», y «Patrones» (consumos que se disparan, ajustes a la baja que se repiten, gastos iguales en caja chica), que nunca le llegan a la persona.",
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
   "Aquí se marca, día por día, si cada persona cumplió con celular, equipo de protección, limpieza y vehículos; hecho para el celular de quien supervisa.",
   "Paso 1: Arriba elige qué revisas (Celular, EPP, Limpieza o Vehículos) y el día.",
   "Paso 2: Toca la palomita si cumplió o la X si no; con la X anota qué pasó.",
   "Paso 3: Usa «Los … restantes cumplieron» para marcar de un jalón a quienes falten.",
   "Se revisa la entrega del celular, el equipo de protección (EPP), la limpieza de su área y la revisión de vehículos: un toque por persona. El día se cambia con las flechas o con la fecha. El celular se revisa tres veces: entrada, break 1 y break 2. Con la X, Enter guarda la nota.",
   "Solo salen las personas que tienen ese punto palomeado en su ficha (Personal): el EPP, por ejemplo, al personal de taller. Si no sale alguien, pídele a Recursos Humanos que lo palomee.",
   "A ti no te puedes marcar: te marca otra persona. La limpieza se marca por área y cuenta para todos los que comparten esa área.",
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
   "Aquí Recursos Humanos lleva la plantilla: cada persona con su puesto, departamento, área del taller, antigüedad y vacaciones, y da altas y bajas.",
   "Paso 1: Dale clic a un renglón para abrir su ficha a la derecha sin perder la lista.",
   "Paso 2: Cambia sus datos en la ficha; Enter o «Guardar cambios» guarda.",
   "Paso 3: Da de alta a alguien con «Nuevo empleado» y su fecha de ingreso.",
   "En la ficha ves su historial de vacaciones e incidencias y, al final, la das de baja con «Dar de baja» o registras un «Reingreso». Una baja no borra a nadie: su historial se conserva. Si la persona tenía cuenta en el ERP, desactívala al darla de baja para que ya no pueda entrar.",
   "Quien es de Producción trae «Entra a cuadrillas»: con eso sale en la terminal de piso para asignarle trabajo (al darlo de alta con su área entra de una vez). La gerencia de producción ve y acomoda solo a la gente de Producción.",
   "Debajo de su inicial, «Subir foto» le pone foto (en el celular abre la cámara). La ven solo Recursos Humanos, la gerencia de producción (de su gente) y la propia persona.",
   "En «Checklist diario» palomeas qué se le revisa cada día (EPP, entrega de celular, revisión de vehículo): sin palomear no sale en ese checklist. La columna «Checklist» de la lista te dice a quién te falta.",
   "La pestaña «Datos sensibles» (CURP, RFC, NSS, salario, cuenta bancaria y demás) solo la ven Recursos Humanos con permiso de administrar y dirección.",
   "Arriba filtras activos, bajas o todos, y por departamento. Los indicadores de ausentes y solicitudes te llevan directo a Vacaciones e incidencias. El botón CSV baja la lista para Excel.",
   "La antigüedad y las vacaciones salen solas de la fecha de ingreso. Quien venía del control de vacaciones en Excel arranca con el saldo que tenía ahí; en su ficha puedes corregirlo eligiendo de qué periodo es.",
   "En la ficha ves cada periodo (cuánto le tocó, usó, adelantó y le queda, y cuándo vence) y, en su historial, a qué periodo se cargó cada vacación o si fue adelanto."
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
   "Aquí se llevan vacaciones, permisos, faltas, incapacidades, retardos y horas extra: Recursos Humanos aprueba las solicitudes y ve quién falta cada día.",
   "Paso 1: En «Por aprobar» revisa el saldo de la persona y quién más falta esos días.",
   "Paso 2: Dale «Aprobar», o «Rechazar» con un motivo que la persona verá en su historial.",
   "Paso 3: Con «Registrar» anota vacaciones, permisos, faltas, incapacidades, retardos u horas extra.",
   "La gerencia de producción también puede registrar las de su gente. Lo que registra alguien que no es Recursos Humanos queda como solicitud por aprobar.",
   "Cada solicitud de «Por aprobar» enseña el saldo de hoy, de qué periodo saldrían los días o cuántos serían adelanto, y quién más falta esos días. Cuenta la fecha: después de su aniversario ya salen del periodo nuevo.",
   "«Calendario» pinta el mes con un color por tipo; las solicitudes pendientes salen punteadas. Dale clic a un día para registrar algo en esa fecha.",
   "«Saldos de vacaciones» tiene la tabla de la ley y lo que le queda a cada quien: lo vigente, lo adelantado y qué días vencen primero.",
   "Cada vacación se carga al periodo más viejo vigente; si ya no hay, queda como adelanto del siguiente y se le descuenta cuando llegue, sin perdonarse al cumplir año. Lo que sobra de un periodo vence 18 meses después de su aniversario.",
   "«Historial» muestra lo de los últimos 13 meses, con filtros por tipo y estado, y se puede bajar en CSV.",
   "Solo lo aprobado cuenta en el saldo y en la prenómina. Vacaciones y permisos se cuentan en días hábiles (la semana laboral y los descansos de Configuración, sin feriados de ley); la incapacidad, en días naturales, como el IMSS."
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
   "Aquí ves tus objetivos de cada mes y cómo te fue en cada uno; lo ven tú, tu jefe directo, Recursos Humanos y dirección, sin montos.",
   "Paso 1: Arriba elige el mes: cada tarjeta trae tu resultado.",
   "Paso 2: Abajo, dale «Ver evidencia» en un indicador para ver lo que explica su número.",
   "Abre por omisión el último mes ya calificado. «En calificación» quiere decir que tu jefe todavía no termina, «En revisión» que lo están revisando Recursos Humanos o dirección, y «Aprobado» que ya es definitivo. En rojo con una llave: se activó la llave y ese mes el bono vale 0.",
   "Cada indicador trae su peso, su regla y lo que se midió. La evidencia son los pedidos, órdenes o marcas del checklist que lo explican: un punto rojo cuenta en contra; uno verde, no.",
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
   "Aquí se califican cada mes los objetivos de cada persona y de ahí sale su bono: los jefes califican, Recursos Humanos revisa y dirección aprueba.",
   "Paso 1: Elige el mes con las flechas de arriba.",
   "Paso 2: En «Evaluaciones del mes» dale clic a una persona y captura lo que falta (Enter guarda).",
   "Paso 3: Cuando esté todo calificado, dale «Enviar a RRHH».",
   "Los jefes directos califican a su gente y Recursos Humanos, además de revisar, arma las plantillas. En la evaluación de cada persona ves cada indicador con su regla, lo medido y la evidencia. Las insignias de estado dicen en qué paso va cada una.",
   "«Plantillas por puesto» define qué se le pide a cada puesto y cuánto pesa; «Personas y jefes» dice quién evalúa a quién (solo Recursos Humanos); «Indicadores» es el catálogo completo, con lo que falta para que cada uno se mida solo.",
   "Lo que el sistema puede medir se mide solo y guarda su evidencia: ventas, entregas, inventario, el checklist, qué tan rápido se asignan y se atienden los leads, los seguimientos de cotización y las preguntas de Mercado Libre.",
   "También se miden solos los preventivos y las fallas de las máquinas, las etapas marcadas en la terminal, los pendientes a tiempo y las ideas de mejora. Lo demás lo pone el jefe.",
   "Los plazos («en 4 horas», «al siguiente día hábil») cuentan horas de horario: lo que llega de noche no cuenta en contra hasta que se abre.",
   "Nadie se califica a sí mismo y un mes aprobado ya no se toca: se corrige con un ajuste que autoriza otra persona. Los montos del bono solo los ve quien tiene nómina.",
   "«Bases del bono» (solo quien tiene nómina) dice cuánto vale el bono al 100 % de cada puesto y, si alguien gana distinto, de cada persona. Cada base vale desde un mes y para los siguientes; lo ya pagado no cambia. La captura Recursos Humanos."
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
   "Aquí Recursos Humanos arma la nómina de cada semana, de viernes a jueves, para pagarla el viernes siguiente, y le pasa el CSV al contador.",
   "Paso 1: Elige la semana arriba; de entrada abre la que ya terminó y falta cerrar.",
   "Paso 2: Dale clic a una persona para ver su renglón desglosado; con «Agregar concepto» agregas pagos o descuentos.",
   "Paso 3: Dale «Cerrar semana» y baja el archivo para el contador con «Exportar CSV».",
   "«Agregar concepto» registra pagos o descuentos fuera del sueldo con su motivo, y «Cerrar semana» la congela. Ya cerrada, finanzas da «Registrar pago» con la fecha y la cuenta de donde salió el dinero, y la semana dice «Pagada el…» para que sepas que ya se pagó.",
   "Las pestañas Préstamos, Ahorro y Sueldos llevan los préstamos con su saldo, la caja de ahorro y el historial de sueldos.",
   "En «Préstamos», al registrar uno sale su pagaré para imprimir y firmar (sin interés); dale clic a «Pagaré por firmar» para anotar la fecha de firma o reimprimirlo.",
   "«Abonar» registra un pago mayor al descuento: en efectivo (dices a qué cuenta entró, queda en finanzas y sale recibo) o descontando más en la nómina de una semana abierta. Si alguien se da de baja debiendo, el saldo completo se descuenta en su última semana (finiquito).",
   "En «Ahorro», el botón «Ahorro» de cada renglón captura cuánto decidió ahorrar la persona por semana: se descuenta solo hasta que lo cambies, y al cerrar la semana pasa a su saldo.",
   "Cuando pida su dinero, «Retiro» lo registra el día que se le entrega, con la fecha en que lo pidió (respetando los días de anticipación de las reglas) y la cuenta de donde salió, que queda también en finanzas. Saca el recibo con folio para firmar.",
   "En «Ahorro», dale clic a una persona para ver sus movimientos, reimprimir recibos o registrar el saldo que ya traía de Excel. «Cambiar» en Reglas fija los días de anticipación, lo que pone la empresa (hoy nada) y el interés de los préstamos (hoy ninguno).",
   "Todo sale de lo aprobado en Vacaciones e incidencias: las faltas y los permisos sin goce descuentan días, el retardo descuenta su tiempo, las vacaciones pagan prima, y las horas extra se pagan dobles hasta 9 a la semana y triples después.",
   "El bono sale de los objetivos aprobados y se paga cuando dirección define su base.",
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
   "El tablero del servicio postventa: ventas pide aquí instalaciones, garantías y reparaciones para su cliente, y la gerencia de producción les pone fecha y cuadrilla.",
   "Paso 1: Para pedir uno, dale «Pedir servicio»: elige qué necesita, el cliente, y describe lo que pide.",
   "Paso 2: Si programas, filtra «Por programar», abre el servicio y dale «Programar» con día y cuadrilla.",
   "Paso 3: Mira en el calendario de cuadrillas quién sale, a dónde y cuándo.",
   "Al pedir un servicio le llega un aviso a la gerencia de producción, que le pone fecha y cuadrilla; a quien lo pidió le llega otro aviso cuando queda programado.",
   "Los indicadores Por programar, Esta semana y En curso filtran la lista al darles clic. La lista abre en «Abiertos»; clic en un renglón abre el servicio.",
   "El calendario de cuadrillas muestra quién sale y cuándo, dos semanas a la vez; las flechas lo mueven una semana y «Hoy» lo regresa a esta semana. Una persona nunca aparece en dos servicios a la vez porque el sistema no lo permite, ni la deja salir con vacaciones o incapacidad aprobadas.",
   "«Carga del taller por semana» suma producción y horas en servicio contra la capacidad de cada área: verde con holgura, ámbar justa (85 a 100 %) y rojo cuando se pasa. Pasa el mouse por una celda para ver de dónde sale.",
   "Si eres de almacén, a la derecha ves los insumos y refacciones que tienes que entregar."
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
   "Paso 1: Si programas, dale «Programar» y elige día, hora, duración y cuadrilla.",
   "Paso 2: En una reparación en planta, dale «Recibir equipo» con fotos de cómo llegó antes de iniciar.",
   "Paso 3: Dale «Iniciar» al empezar y «Cerrar servicio» con foto del trabajo, qué se hizo y quién recibe.",
   "Los pasos de arriba (Pedido, Programado, En curso, Cerrado) se marcan con fecha y quién. Programar o reprogramar le toca a la gerencia.",
   "Una reparación en planta no empieza sin recibir el equipo con fotos de cómo llegó, y ningún servicio se cierra sin foto del trabajo terminado, el nombre de quien recibe y las notas de lo que se hizo. Al cerrar una garantía se anota si procedió.",
   "En una garantía ves si sigue vigente según la entrega del equipo con ese número de serie. Las horas de la cuadrilla se descuentan de la capacidad de su área en el taller.",
   "Los insumos salen de almacén o se piden a compras. Las fotos no se pueden borrar.",
   "Quien lo pidió puede cancelarlo mientras no tenga fecha; después, solo la gerencia."
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
   "El catálogo de máquinas, herramienta, vehículos, instalaciones y equipo de oficina: en qué estado está cada uno, cuánto ha fallado y qué preventivo le toca.",
   "Paso 1: Si algo falla, dale «Reportar falla», elige la máquina y di qué le pasa.",
   "Paso 2: Usa las pestañas Máquinas, Órdenes abiertas y Preventivos; clic en un renglón abre su detalle.",
   "Paso 3: Para trabajar una orden con el tiempo contado, abre «Terminal» y dale play.",
   "La lleva mantenimiento (o la gerencia de producción); el personal de producción reporta fallas y presta herramienta. «Nueva máquina» y «Etiquetas QR» solo le salen a quien la lleva.",
   "El estado no se captura: sale de las órdenes de mantenimiento abiertas. Operando, Con falla (sigue trabajando pero alguien reportó algo), Parada (la falla la detiene) y En reparación.",
   "Los indicadores te llevan a lo suyo: Paradas filtra lo que tiene algo pendiente, Con falla reportada abre las órdenes, Preventivos vencidos abre los preventivos y Herramienta prestada te lleva a Resguardos.",
   "En Máquinas, clic abre su ficha. En Órdenes abiertas (fallas y preventivos), el detalle se abre a un lado. En Preventivos, clic abre su orden si ya salió o, si no, la ficha de la máquina.",
   "Un preventivo se programa por fecha (cada tantos días, «el primer lunes de cada mes» o «el día 15»), por horas de uso o lo que pase primero, y su orden se genera sola con el checklist de su rutina. Si cae en día que el taller no trabaja, pasa al siguiente que sí (así viene cada plan).",
   "«Terminal» abre la pantalla de mantenimiento para darle play a la máquina que vas a trabajar y pausa al dejarla. «Resguardos» lleva la herramienta prestada.",
   "«Etiquetas QR» abre una hoja para imprimir y recortar las etiquetas de todas las máquinas (o de las del filtro que tengas puesto). Pegada en la máquina, quien vea una falla la escanea con el celular y le sale el reporte de esa máquina, sin buscarla.",
   "En Máquinas, el filtro «Dadas de baja» muestra lo que ya no conviene reparar, con la fecha y el motivo. Al dar de alta, la categoría se elige de la lista o se escribe una nueva (impresora, aire acondicionado…); el tipo «Equipo de oficina» es para computadoras, impresoras y lo demás que no es del taller.",
   "Al abrir una orden preventiva, cada punto del checklist se marca Bien o Falla (con qué tiene); la orden no se cierra mientras falte alguno.",
   "Al cerrar una orden, mantenimiento anota qué se hizo y las horas que le dedicó (no las que estuvo parada la máquina); si le dieron play en la terminal, las horas ya vienen llenas."
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
   "La ficha de una máquina o herramienta: sus datos, por qué tiene su criticidad, su historial de mantenimiento, sus planes preventivos y, si se presta, quién la tiene.",
   "Paso 1: Si falla, dale «Reportar falla»: ya sale con esta máquina elegida.",
   "Paso 2: Si tiene horómetro, anota su lectura con «Registrar horas».",
   "Paso 3: Si la llevas, en «Plan preventivo» dale «Agregar» y elige cuándo toca y su rutina.",
   "La tarjeta «Criticidad» dice por qué la máquina tiene la que tiene: los puntos de cada factor. Dos los califica mantenimiento con el lápiz (qué pasa si se para y su riesgo de seguridad); las fallas y el costo del año salen de sus órdenes; el respaldo y los días de refacción los busca el sistema, y se pueden corregir.",
   "La criticidad se recalcula sola al reportar o cerrar una falla y cada madrugada. Mientras falten los dos que se califican, se queda la de la hoja. Muy alta o alta es crítica: sus fallas van primero.",
   "Fallas y tiempo parada cuentan los últimos 12 meses. También dice el tipo de mantenimiento (preventivo, predictivo o autónomo), quién lo hace y, si es herramienta que siempre trae la misma persona, a quién está asignada.",
   "La lectura del horómetro no puede ser menor que la anterior y, al guardarla, si ya toca un preventivo por horas, su orden sale en ese momento.",
   "En «Historial de mantenimiento», clic en una orden la abre a un lado. «Prestar» te lleva a Resguardos con esta herramienta ya elegida.",
   "En «Plan preventivo» mantenimiento o la gerencia agregan o editan los planes y les ponen su rutina: la lista de puntos que se palomean.",
   "En «Cuándo toca» eliges cada tantos días, un día de la semana del mes (el primer lunes, el último viernes) o un día fijo del mes, cada uno o cada varios meses; además puede ser cada tantas horas de uso, lo que pase primero. Abajo te dice qué día toca el siguiente.",
   "Si cae en fin de semana, feriado o descanso, pasa al siguiente día que se trabaja (en los planes por mes, sin brincarse al mes siguiente); esa casilla viene marcada. La orden se genera sola: por fecha, unos días antes de vencer; por horas, al llegar a ellas.",
   "«Manuales y fichas técnicas» junta el manual, la ficha técnica, diagramas y garantía: un PDF, una foto o una liga de Drive. Al agregarlo eliges si es solo de esta máquina o de todas las de su tipo y modelo.",
   "«Etiqueta QR» la enseña para imprimirla y pegarla en la máquina; en un Android con Chrome también la graba en una etiqueta NFC.",
   "Lo que ya no conviene reparar se da de baja con «Dar de baja» y el motivo: sus órdenes abiertas se cancelan, sus planes se apagan y deja de contar en las métricas. Si estaba prestada, primero se recibe en Resguardos.",
   "Se puede reactivar desde la misma ficha; sus planes se quedan apagados hasta que los prendas.",
   "Abajo, «Refacciones de este tipo de máquina» lista las piezas que lleva (por tipo y modelo) y cuántas hay en planta; se piden desde una orden de mantenimiento."
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
   "Cómo anda el mantenimiento: si las máquinas están disponibles, cada cuánto fallan, cuánto tardan en volver a trabajar y si el preventivo se hace a tiempo.",
   "Paso 1: Elige arriba el periodo: 30 días, 90 días, 6 meses o 12 meses.",
   "Paso 2: Empieza por el Pareto: ahí están las pocas máquinas que juntan casi todo el tiempo parado.",
   "La usan mantenimiento, la gerencia de producción, ingeniería de procesos y dirección. Abre con los últimos 90 días.",
   "Los indicadores: disponibilidad (qué parte del tiempo estuvieron listas), MTBF (cada cuánto fallan), MTTR (cuánto tardan en repararse), preventivo a tiempo, cuánto del trabajo de mantenimiento es preventivo y lo que sigue abierto.",
   "«Disponibilidad por semana» enseña la disponibilidad contra la meta del 98 % y, debajo y en las mismas semanas, las fallas y los preventivos a tiempo o tarde: así se ve si una semana mala vino de fallas o de preventivo atrasado.",
   "El Pareto dice cuántas máquinas juntan el 80 % de las horas paradas; clic en una barra abre su ficha.",
   "«Carga de preventivo» proyecta de cada plan los preventivos de las próximas 8 semanas, por criticidad y con horas de técnico estimadas, para repartir antes las semanas pesadas.",
   "«Fallas contra tiempo de reparación» separa las máquinas que fallan seguido (crónicas: causa raíz, preventivo) de las que tardan en volver (agudas: refacciones, proveedor).",
   "«Lo abierto» reparte las órdenes abiertas por antigüedad; «Vuelven a fallar», las reparaciones que no duraron 30 días; «Horas del técnico», las horas de las órdenes cerradas, por quien las atendió. En «Por máquina» ves todo por máquina (clic abre su ficha) y lo descargas en CSV.",
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
   "Aquí se anota quién se lleva una herramienta del taller (a campo o a otra área), desde cuándo y cómo la regresó.",
   "Paso 1: Dale «Prestar herramienta»: elige la herramienta, quién se la lleva y para qué o para qué servicio.",
   "Paso 2: Cuando regrese, dale «Recibir» en su renglón y marca si llegó bien, dañada o incompleta.",
   "Lo usan mantenimiento, la gerencia y el personal de producción. La herramienta que siempre trae la misma persona (su soldadora) no se presta aquí: se asigna en la ficha de la máquina.",
   "Al prestar, para qué o para qué servicio es obligatorio (uno de los dos) y la fecha de regreso es opcional. Una máquina parada o en reparación no se presta.",
   "Al recibir, si quieres, tomas una foto de cómo regresó; si regresa dañada o incompleta, la falla se reporta sola, con la foto.",
   "Sale en rojo lo que pasó de su fecha de regreso o lleva más días fuera que el límite. El límite lo cambias junto a los filtros («Marcar después de … días»). Los filtros son Prestadas, Sin regresar y Regresadas (el historial)."
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
   "Las rutinas de mantenimiento: la lista de puntos que se palomea en cada preventivo, por tipo de máquina y frecuencia.",
   "Paso 1: Dale «Nueva rutina» y ponle nombre, tipo de máquina y frecuencia.",
   "Paso 2: Escribe cada punto con su sección; Enter agrega otro debajo.",
   "Paso 3: Dale Guardar y elígela en el plan preventivo de cada máquina, desde su ficha.",
   "Las edita el encargado de mantenimiento (o la gerencia de producción); los demás las ven. Clic en una rutina la abre a un lado.",
   "Cada punto lleva su sección (Seguridad, Limpieza, Eléctrico…) y qué se revisa; con las flechas los acomodas. Las recomendaciones salen arriba del checklist en cada orden. «Duplicar» sirve para hacer la trimestral a partir de la mensual.",
   "Al guardar, los preventivos que ya salieron con esa rutina y nadie ha empezado toman la lista nueva; los que ya se están palomeando se quedan como estaban.",
   "La columna «La usan» dice qué máquinas la tienen en un plan preventivo activo; mientras alguno la use, no se puede desactivar. El filtro «Desactivadas» enseña las que ya no salen para elegir en los planes."
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
   "Para llevar el tiempo de cada reparación o preventivo sin anotarlo: le das play a la orden que vas a trabajar y pausa cuando la dejas.",
   "Paso 1: Busca la máquina por número o nombre, o elígela en Preventivos por hacer o Fallas reportadas.",
   "Paso 2: Dale Play al empezar; al dejarla, dale Pausa y elige por qué.",
   "Paso 3: Toca la tarjeta para abrir la orden: checklist, diagnóstico y refacciones.",
   "La usan mantenimiento y el personal de piso que atiende máquinas. Quien no es del personal de mantenimiento ve lo que está en trabajo, pero no da play.",
   "Arriba está lo que traes en play (con cuánto llevas) y luego lo que está en pausa, primero lo último que pausaste, para regresar rápido. Abajo, los preventivos por hacer (los vencidos primero) y las fallas reportadas (las que tienen la máquina parada y las más críticas primero).",
   "Dar play en otra orden pausa la que traías: una persona trabaja una a la vez. Al pausar eliges por qué («Esperando refacción», «Me voy a otra», «Fin del día») o «Solo pausar». Si dos personas trabajan la misma máquina, cada quien le da play y sus horas se suman.",
   "En la orden palomeas el checklist, escribes el diagnóstico y pides refacciones. El play no pide diagnóstico; ese se escribe cuando ya sabes qué tiene.",
   "La orden la cierran mantenimiento o la gerencia de producción, y al cerrarla las horas trabajadas salen solas de los play."
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
   "Quién cambió qué y cuándo en el ERP: altas, cambios y bajas de pedidos, clientes, usuarios, permisos, configuración y lo demás. Nada se borra de aquí.",
   "Paso 1: Filtra arriba por «Qué», «Quién», «Acción» o las fechas «Desde» y «Hasta».",
   "Paso 2: Dale clic a un renglón para ver el antes y el después de cada dato.",
   "La columna «Registro» dice de qué es cada cambio: el folio, el nombre o la clave. En las listas de materiales, el equipo, el artículo y la cantidad; en el material de una orden, la OP, el artículo y cuánto lleva. «Sistema», en «Quién», es un proceso automático del ERP, no una persona.",
   "En el detalle, los artículos, órdenes y personas salen con su nombre. Abajo está la historia de ese registro (sus últimos 50 cambios) y, si tiene pantalla, «Abrir el registro» te lleva a ella. El CSV baja lo que ves.",
   "Se muestran los 500 cambios más recientes: para ir más atrás usa los filtros. Solo ves los cambios de lo que tu rol puede ver: sueldos y datos sensibles necesitan Recursos humanos nivel 3; los costos, el módulo de Costos; las políticas de precio, el de Márgenes, y los cambios del costo de un artículo y del historial de costeo, los dos."
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
   "Datos de la empresa y catálogos que usan todas las pantallas: IVA, almacenes, etapas del taller, tipos de cambio, reglas de venta e integraciones. Para sistemas y dirección.",
   "Paso 1: Elige la pestaña de lo que quieres cambiar: Empresa, Ventas, Almacenes, Taller, Tipos de cambio o Integraciones.",
   "Paso 2: En las tarjetas con formulario, cambia los datos y dale «Guardar».",
   "Paso 3: En las tablas, la celda se guarda sola al salir de ella o con Enter; Escape la regresa.",
   "También están los datos fiscales, la fecha de arranque, el tema con el que abre el ERP (oscuro o claro), los minutos para deshacer errores y la semana laboral. Lo que tu rol no puede cambiar sale en solo lectura y dice quién sí puede. Cada cambio queda en la bitácora.",
   "Algunas cosas mueven números en otras pantallas: la semana laboral y los descansos cuentan los días de vacaciones y permisos; la fecha de arranque marca el corte entre la hoja y el ERP; un almacén no disponible para planta no cuenta para producción ni para el cotizador; el tipo de cambio más reciente convierte los costos en dólares y los saldos de proveedores y clientes (una cotización o un pedido en dólares guarda el suyo).",
   "En «Taller», la capacidad de las áreas automáticas sale de su gente (no se escribe a mano) y la de las demás sí. En «Almacenes», con «Consumibles del taller» prendido, lo de las categorías marcadas sale a nombre de quien lo recibe y no a la orden; al prenderlo se suelta lo que estaba apartado de esos artículos para órdenes.",
   "En «Empresa», «Deshacer errores» fija cuántos minutos tiene quien se equivocó para deshacer una salida o un traspaso en almacén, y para reabrir un pendiente que cerró (15 de inicio). En 0 se apaga: almacén pide un ajuste y el pendiente se pide de nuevo.",
   "En «Ventas», la tarjeta «Leads de recepción» dice a quién le llega cada lead nuevo: bandeja (el primero que lo toma), la gerencia de ventas lo asigna o recepción elige al vendedor. La cambian la gerencia de ventas o dirección.",
   "Ahí mismo se ponen las horas para avisar a la gerencia si nadie toma un lead o nadie lo atiende, y qué vendedores reciben leads.",
   "En «Integraciones», dirección conecta la cuenta de Mercado Libre (los pasos vienen ahí mismo), elige quiénes la atienden, si las ventas entran como pedidos y a nombre de quién quedan. Los avisos les llegan a quienes la atienden y también a la persona a cuyo nombre quedan las ventas; si no hay nadie, a una persona de dirección. Si eliges a alguien invitado que todavía no entra, le empiezan a llegar en cuanto entre.",
   "La tarjeta dice si los avisos de Mercado Libre están entrando; «Revisar ahora» vuelve a intentar lo que quedó pendiente. Mercado Libre solo avisa lo nuevo: «Traer lo pendiente» trae las preguntas sin contestar y los reclamos que ya estaban y, si las ventas entran como pedidos, las ventas desde la fecha que elijas.",
   "En la tarjeta de Skydropx, quien administra envíos prueba la conexión (muestra el saldo) y elige la dirección de la planta de las que ya están en Skydropx, la clave de carta porte, el tipo de empaque y el formato de la guía. Sin dirección y carta porte no se puede generar guía.",
   "Ahí también pone el recargo que se le suma al flete cuando un vendedor lo cotiza en una cotización."
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
   "Cómo va la migración desde las hojas de Google: qué se trajo, si los precios cuadran con la hoja y qué falta limpiar. Para sistemas y dirección durante la transición.",
   "Paso 1: Mira «Precios de equipo iguales a Nuevo Costeo»: si alguno difiere, revísalo antes de cotizarlo.",
   "Paso 2: Atiende lo que liste «Para revisar»: son problemas que ya traían las hojas.",
   "Paso 3: Si editas listas de materiales, dale «Convertir en subensamble» o «Descartar» a cada grupo sugerido.",
   "El indicador de precios compara los precios de equipo que calcula el ERP contra los de «Nuevo Costeo». «Lo que se leyó» cuenta lo que trajo la última importación de cada hoja, no lo que hay hoy en el ERP. «Para revisar» lista lo que hay que limpiar: nombres repetidos, materiales fuera del catálogo, existencias negativas que no se cargaron…",
   "Las existencias de arranque se cargaron una sola vez, por artículo y almacén. Después del día de corte, una diferencia se corrige con un ajuste de inventario autorizado, no reimportando. Arriba también ves cuánto historial de precios de compra se trajo (desde 2011) y las ventas históricas de los paneles, que le dan a cada cliente su historia de compras.",
   "«Subensambles escondidos» propone grupos de piezas que se repiten idénticos en varios equipos porque las listas se copiaron. Quien edita listas de materiales puede convertirlos en subensamble (le pone nombre y clave y queda en un solo lugar para todos esos equipos) o descartarlos. El costo no cambia.",
   "La reimportación se corre desde una computadora, no desde esta pantalla: los pasos están en «Cómo volver a importar». Actualiza por clave, así que no duplica, y no vuelve a cargar las existencias de arranque."
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
   "Quién usa el ERP, cuánto, en qué y cuánto cuesta la IA, para acompañar a quien se queda en la hoja o el papel. Para dirección y sistemas.",
   "Paso 1: Elige arriba el periodo, el rol y qué medir; con «Comparar» ves también el periodo anterior.",
   "Paso 2: Abre «Sin usarlo» para ver a quién conviene acompañar.",
   "Paso 3: Dale clic a una persona para ver su detalle: días, pantallas, cambios, IA y horas.",
   "Sirve para acompañar a quien se está quedando en la hoja, en el papel o en WhatsApp, ver qué pantallas de verdad se usan y cuidar el gasto de la IA.",
   "El periodo (7, 30 o 90 días) cambia todo. El rol deja solo a esa gente en los indicadores, la tabla, el mapa de calor y las gráficas por persona; la gráfica día por día y la de en qué se va el costo de la IA siguen contando a todos.",
   "«Medir» (tiempo activo, cambios, consultas a la IA, su costo o personas activas) cambia la gráfica día por día, la de cada persona y el mapa de calor; los indicadores y la tabla no cambian.",
   "Los indicadores dicen cuánto subió o bajó cada cosa contra el periodo anterior del mismo largo.",
   "Las gráficas: la medida día por día (la línea punteada es el periodo anterior); cada persona contra sí misma (barra gris = antes); y el mapa de calor, un cuadro por persona y día, más oscuro entre más uso.",
   "Abajo de esas, en qué secciones del ERP se le va el tiempo a cada quien y en qué se va el costo de la IA (resúmenes, preguntas, documentos, revisión nocturna…).",
   "Abajo, la tabla por persona. «Personas» son las cuentas activas sin la TV ni la tablet del taller; «Sin usarlo», las que no hicieron nada en el periodo; «Todas las cuentas» suma las desactivadas y los aparatos del taller.",
   "Al darle clic a una persona ves su tiempo y sus cambios por día, las pantallas que más usa, en qué registra cambios, para qué usa la IA y cuánto costó, y a qué horas trabaja.",
   "El tiempo activo cuenta solo los minutos en que la persona estuvo moviéndose en el ERP con la pestaña a la vista; dejarlo abierto no suma. No se guarda qué datos vio, solo qué pantalla.",
   "El costo de la IA es un estimado con los precios del proveedor que tiene guardados el ERP; lo que factura el proveedor manda. El total suma la revisión nocturna, que no es de nadie, solo con «Todos los roles».",
   "El tiempo y las pantallas se cuentan desde el 5 de noviembre de 2026; los cambios y la IA traen su historia de antes."
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
   "Paso 1: En «Usuarios», dale clic a una persona para darle o quitarle roles.",
   "Paso 2: «Espera rol»: márcale su rol. «Empleado dado de baja»: ábrelo y dale «Desactivar».",
   "Paso 3: Para quien aún no entra, o para la TV y la tablet, usa «Invitaciones y pantallas».",
   "Cada persona tiene uno o varios roles (Ventas, Almacén, Recursos humanos…) y cada rol tiene, en cada módulo, un nivel: 1 ver, 2 capturar, 3 administrar (aprobar, borrar, configurar). Si alguien tiene dos roles, vale el nivel más alto.",
   "La pestaña «Permisos por rol» muestra la tabla completa. Solo dirección la cambia, y dirección siempre tiene todo. Si le das Costos a un rol que no lo tenía, te pide confirmar: toda la gente con ese rol verá lo que cuesta cada equipo y cada componente. Márgenes (la utilidad y las políticas de precio) es un módulo aparte.",
   "Esconder una opción del menú es solo comodidad: lo que de verdad protege un dato es que el ERP no se lo entrega a quien no tiene permiso, aunque lo busque por otro lado.",
   "Al desactivar una cuenta, la persona pierde todo al instante, aunque tenga la sesión abierta; sus roles se guardan para cuando regrese. «Espera rol» es alguien que ya entró con Google pero todavía no puede ver nada. «Empleado dado de baja», en rojo, es alguien que RRHH ya dio de baja y sigue pudiendo entrar: desactívalo.",
   "Nadie cambia sus propios roles ni desactiva su propia cuenta. Solo dirección da el rol de dirección y desactiva a alguien de dirección. Los cambios valen cuando la persona recarga el ERP y quedan en la bitácora.",
   "En «Invitaciones y pantallas» dejas lista la cuenta de alguien antes de que entre: al entrar por primera vez recibe los roles de la invitación. Un correo de fuera de la empresa solo entra si está invitado, y su invitación tiene que llevar al menos un rol. No se manda ningún correo: avísale tú.",
   "Ahí mismo creas las cuentas de los aparatos del taller, que no necesitan cuenta de Google: la de la TV solo ve el tablero de piso y la de la tablet solo abre la terminal. La contraseña se muestra una sola vez: guárdala.",
   "«Ver como», en el encabezado: dirección puede ver el ERP con los permisos de otro rol para revisar qué ve esa gente. Una franja te recuerda que estás simulando, y lo que guardes mientras tanto es real y queda a tu nombre.",
   "Dirección y sistemas también pueden abrir la sesión de una persona en particular en otra pestaña, con sus pedidos y sus avisos: es solo para ver, no deja guardar nada y queda registrado."
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
   "El directorio de clientes de todos los vendedores: de quién es cada cuenta y hasta cuándo, para no duplicarla ni pisarse.",
   "Paso 1: Antes de dar de alta uno, búscalo por nombre, razón social, RFC o ciudad.",
   "Paso 2: Si no existe, dale «Nuevo cliente»; si existe, clic en su renglón abre su ficha.",
   "Todos ven que la cuenta existe y de quién es; teléfonos, historial y saldo solo los ven el dueño, la gerencia y cobranza.",
   "«Mis clientes» son los tuyos y «Libres» los que no tienen dueño. En «Vendedor dueño» ves hasta cuándo es suya la cuenta: en ámbar si le quedan menos de 30 días, en rojo si ya venció.",
   "Con CSV te llevas la lista a Excel."
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
   "La ficha del cliente: datos fiscales, contactos, seguimiento e historial completo de cotizaciones, pedidos, oportunidades y lo que compró antes del ERP.",
   "Paso 1: Si la cuenta está libre, dale «Hacerlo mío» para que quede a tu nombre.",
   "Paso 2: En «Actividad», anota cada llamada, WhatsApp o visita en una línea y Enter.",
   "Paso 3: Dale «Nueva cotización» para cotizarle: sale ya ligada a este cliente.",
   "Arriba ves de quién es la cuenta y hasta cuándo. Si es de otro vendedor solo ves eso: contactos, compras y saldo quedan privados. Si te buscó a ti, pídele a la gerencia que lo reasigne o que compartan el crédito.",
   "En «Actividad», si le pones fecha a una nota se vuelve tarea. Tus seguimientos alargan la vigencia de la cuenta a tu nombre.",
   "Para facturar bien captura RFC, régimen, CP fiscal y uso de CFDI, o llénalos con la constancia de situación fiscal.",
   "Si el mismo cliente está dos veces (uno con el nombre del contacto y otro con el de la empresa), «Juntar con otro» pasa todo al que se queda: pedidos, cotizaciones, oportunidades, saldo de la hoja, facturas y contactos (los que ya tiene no se repiten).",
   "Al juntar, lo que le falte al que se queda (RFC, régimen, ciudad, vendedor) lo toma del otro, y el otro se borra. Lo hacen la gerencia de ventas, o tú si los dos clientes son tuyos o libres.",
   "Si otro cliente tiene el mismo RFC, arriba sale el aviso con su botón «Juntar»; si es una sucursal, déjalo así."
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
   "La comisión de cada mes, calculada sola con los pedidos: sin rangos de filas que mover a mano.",
   "Paso 1: Elige el mes arriba, con las flechas o con la lista.",
   "Paso 2: Abre «Pedidos que cuentan este mes» para ver de dónde sale la comisión.",
   "Cada vendedor ve la suya; la gerencia de ventas, dirección y finanzas ven a todos (la gerencia administrativa, por ahora, solo la suya).",
   "Cada tarjeta trae la venta de maquinaria con su comisión, la barra hacia el siguiente escalón de meta, la venta de refacciones con su bono y los ajustes. Con crédito compartido, «Pedidos que cuentan este mes» dice qué parte te toca.",
   "La regla está abajo, en «Cómo se calcula»: el porcentaje de tu plan (2 % en los planes actuales) sobre la venta sin IVA de todo lo que no es refacción, más un bono fijo por el escalón de meta alcanzado y otro por el de refacciones.",
   "Los escalones no se suman: se paga el más alto. El plan dice si la venta cuenta por la fecha del pedido, de la factura o del cobro.",
   "La gerencia o dirección agregan ajustes (bonos de Mercado Libre, correcciones) con «Ajuste», y finanzas la marca pagada con «Marcar pagada»: se guarda la foto del cálculo y el mismo mes no se paga dos veces."
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
   "El registro de todas las cotizaciones con su folio y versión; aquí también das seguimiento a las enviadas y la gerencia autoriza precios.",
   "Paso 1: Dale «Nueva cotización» para abrir el editor con una en blanco.",
   "Paso 2: Usa las pestañas para filtrar; clic en un renglón abre la cotización.",
   "Paso 3: En «Seguimiento», dale «¿Qué pasó?», escribe lo que dijo el cliente y Enter.",
   "Los vendedores ven las suyas; la gerencia de ventas ve las de todo el equipo y autoriza precios.",
   "«Solo vencidas» deja las que pasaron su vigencia sin cerrarse (renglones en rojo). Abajo ves cuánto suma lo filtrado en pesos y sin IVA; con CSV te la llevas a Excel.",
   "Para la gerencia, «Por autorizar» es la cola de precios abajo del mínimo: primero las que el vendedor ya pidió, con su nota, cuántas partidas van bajo el mínimo y qué tanto abajo de lista. «Autorizar» deja al vendedor enviarla.",
   "«Seguimiento» es la lista de cotizaciones enviadas a las que toca preguntarles qué pasó: primero las vencidas, luego las de hoy y luego las que vienen. Cada cotización enviada aparece aquí 3 días hábiles después.",
   "En «¿Qué pasó?» eliges cómo va (sigue en pie, no contestó, contactado, negociando, ya compró o se perdió) y escribes lo que dijo el cliente; Enter lo guarda y abre la siguiente. Si sigue viva, se agenda la próxima.",
   "El botón «Mensaje» (con destellos) de cada renglón, o «Redactar mensaje» dentro de «¿Qué pasó?», le pide a la IA el WhatsApp de seguimiento con lo que has anotado de esa venta: entre más detalle anotes, más a la medida sale.",
   "El mensaje lo revisas, lo cambias si quieres y lo abres en WhatsApp; no se manda solo.",
   "Con más de 10 seguimientos vencidos no puedes enviar cotizaciones nuevas hasta ponerte al día; el aviso de arriba te lo dice antes.",
   "La gerencia ve en «Seguimiento» cuánto trae cada vendedor y lo que hizo en la semana, y con «Liberar por hoy» deja enviar a alguien por el día si un cliente está esperando."
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
   "El editor de la cotización, con la plantilla de la hoja: agregas partidas, pones condiciones y la envías; cada versión se guarda sin pisar la anterior.",
   "Paso 1: Agrega partidas: escribe parte del nombre o la clave y Enter.",
   "Paso 2: Llena «Tiempo de entrega»: sin él no se puede enviar.",
   "Paso 3: Dale «Enviar» y elige «Enviar por WhatsApp», «Por correo» o «Solo marcar enviada».",
   "Se guarda sola mientras escribes; arriba dice «Guardado» con la hora.",
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
   "«Sin IVA» se cambia mientras la cotización no se haya enviado; ya enviada, saca una nueva versión."
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
   "Se crea una cotización con las condiciones de pago, entrega y notas que la gerencia dejó por defecto, y en un momento se abre el editor.",
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
   "Qué pasó con lo que cotizas: cuánto se volvió pedido, cuánto se perdió y por qué, y cuánto sigue abierto y qué le falta.",
   "Paso 1: Elige el periodo arriba; la gerencia también puede elegir a un vendedor.",
   "Paso 2: Toca un bloque del diagrama o un indicador para ver abajo sus cotizaciones.",
   "Cada vendedor ve lo suyo; la gerencia de ventas ve a todo el equipo.",
   "El diagrama se lee de izquierda a derecha: lo cotizado se divide en lo que se envió y lo que nunca salió, y lo enviado en ganado, perdido y abierto. El grueso de cada franja es el dinero sin IVA; con «En cotizaciones» cuenta cuántas son.",
   "Abajo, un renglón abre su cotización.",
   "Lo perdido se agrupa por el motivo que anotaste al rechazarla o al decir qué pasó: si casi todo dice «No respondió», el problema es el seguimiento, no el precio.",
   "Lo abierto se divide por lo que le falta: «Seguimiento atrasado» y «No contesta» son las que hay que llamar hoy.",
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
   "Registra y sigue las devoluciones, reclamos y cancelaciones de cada venta, sobre todo de Mercado Libre, para que el código y la hora límite no se pierdan.",
   "Paso 1: Dale «Nueva», escribe el número de venta de Mercado Libre o el folio del pedido y Enter.",
   "Paso 2: Elige si es devolución, reclamo o cancelación, y anota el motivo y el código.",
   "Paso 3: Revisa la columna «Vence» y abre un renglón para ver su detalle.",
   "La usan quien atiende las ventas en línea y almacén.",
   "Los reclamos que abren los compradores en Mercado Libre entran solos, con su motivo y fecha límite, en cuanto Mercado Libre avisa. Contestarlos y resolverlos se sigue haciendo en Mercado Libre; aquí se ve qué está abierto, quién lo atiende y lo que hace almacén.",
   "En una devolución, almacén ya sabe que viene; en un reclamo, queda la hora límite para responder.",
   "«Vence» dice qué corre: rojo si ya pasó, ámbar si falta menos de un día; el filtro «Vencidas o por vencer» deja solo eso.",
   "El detalle se abre a la derecha, con la evidencia de salida de esa venta (fotos, check list, quién empacó) para defenderte.",
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
   "Aquí se anota a quien llama o escribe interesado y todavía no es cliente ni oportunidad, para que no se pierda en un papel.",
   "Paso 1: Dale «Registrar lead», escribe quién es, cómo contactarlo y qué busca, y Enter.",
   "Paso 2: Abre el lead y anota cada intento: «Le escribí», «No contestó» o «Contestó».",
   "Paso 3: Cuando conteste, dale «Crear oportunidad»; si no le interesa, «Descartar» con el motivo.",
   "Lo usan recepción, los vendedores, la gerencia de ventas y marketing, que los ve todos para saber de dónde llegan y qué pasó con ellos.",
   "Al registrarlo pon también dónde está, su empresa (o «Particular») y qué busca con modelo o medida. Si se te pasó algo, al abrirlo te dice qué le falta y lo completas ahí; «Incompletos» junta los que tienen algo pendiente.",
   "Mientras escribes el teléfono o la empresa te dice si ya es cliente y de quién; si lo es y dices «Es este», le llega directo a su vendedor.",
   "A quién le llega lo demás depende de cómo lo dejó la gerencia: en bandeja se avisa a los vendedores y el primero que lo toma se lo queda; o la gerencia lo asigna; o quien lo registra escoge al vendedor. Si nadie lo toma o nadie lo atiende a tiempo, se le avisa a la gerencia.",
   "Dale clic a un lead para ver sus datos, llamarle o escribirle por WhatsApp. Cada intento se anota, conteste o no: «Le escribí» si fue por WhatsApp o correo, «No contestó» si le llamaste (o «No estaba» si fuiste), y «Contestó» con lo que te dijo.",
   "«Crear oportunidad» se habilita hasta que contesta (o pide cotización). Si no era cliente, se da de alta; si su teléfono ya es de un cliente, te ofrece esa cuenta. Si no le interesa, se descarta con el motivo.",
   "Para escribirle, «Mensaje con IA» te lo redacta con lo que busca y lo que le pidas en la caja de contexto. Cada uno sale distinto, porque WhatsApp bloquea a quien manda el mismo texto a muchos; al abrirlo en WhatsApp se anota «Le escribí».",
   "La columna «Intentos» dice lo último que hiciste y cuándo («Le escribiste por WhatsApp · hace 2 h»), y «Sin contactar» junta a los que todavía no les has escrito ni llamado.",
   "Quien lo registró ve en «Los que registré» quién lo tomó y en qué etapa va la oportunidad."
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
   "Lo de Mercado Libre que necesita a alguien: las preguntas de compradores por contestar y las publicaciones vendidas que falta ligar a su artículo.",
   "Paso 1: En «Preguntas», escribe la respuesta y dale «Contestar» (o Ctrl+Enter).",
   "Paso 2: En «Por ligar», busca qué artículo es cada publicación y elígelo.",
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
   "En «Dinero», arriba van los totales del mes; abajo puedes bajarlo a Excel para conciliar la cuenta de Mercado Pago."
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
   "El embudo de ventas: cada tarjeta es una venta posible, desde que alguien pregunta hasta que se gana o se pierde.",
   "Paso 1: Dale «Nueva oportunidad», elige el cliente y escribe qué busca.",
   "Paso 2: Arrastra una tarjeta a otra columna para cambiarla de etapa.",
   "Paso 3: Dale clic a una tarjeta para editarla, sacar una cotización o anotar qué pasó.",
   "Los vendedores la usan para no soltar a nadie; la gerencia, para ver qué está atorado, y puede filtrar por vendedor.",
   "Si sueltas una tarjeta en «Perdida» te pide el motivo. A «Negociación» (y de Prospecto a Contactado) no pasa solo con arrastrar: se abre «¿Qué pasó?», escribes lo que dijo el cliente y eso la mueve.",
   "En el detalle de la derecha editas monto, probabilidad y cierre estimado, sacas una cotización y anotas qué pasó.",
   "Los días en ámbar dicen que lleva más de 14 en la misma etapa; la tarea en rojo, que ya venció. La etiqueta «Seguimiento» dice cuándo toca preguntarle al cliente qué pasó con su cotización (en rojo si ya venció); dale clic para anotarlo ahí mismo.",
   "Ganadas y perdidas se quedan 60 días en el tablero; después solo en la vista de lista, que también se descarga a CSV.",
   "No todo se mueve a mano: enviar una cotización pasa su oportunidad a «Cotizado» (y la crea si no existía) y le agenda su seguimiento a 3 días hábiles; convertirla en pedido la marca «Ganada», y rechazarla la cierra como «Perdida» si no tiene otra cotización viva.",
   "Al anotar qué pasó, «Negociando» la pasa a Negociación y «Se perdió» la cierra con su motivo."
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
   "Tu lista para arrancar el día: a qué clientes buscar hoy, por qué y cuánto puede valer cada uno.",
   "Paso 1: Toca un motivo de arriba para filtrar, o busca por cliente, producto o vendedor.",
   "Paso 2: En la tarjeta, dale «Redactar mensaje», revísalo y ábrelo en WhatsApp o cópialo.",
   "Paso 3: Al volver, contesta «¿Sí le escribiste?»; cuando haya respuesta, usa «¿Cómo terminó?».",
   "La usan los vendedores: cada quien ve sus clientes y los que no tienen vendedor; la gerencia de ventas ve la de todo el equipo.",
   "No aparecen los clientes que ya tienen una oportunidad abierta (ya estás en eso) ni los que tienen una cotización abierta de los últimos 45 días, salvo que esté por vencer.",
   "Los motivos de arriba son cotización por vencer (rojo), ya le toca (ámbar), refacciones (azul) y reactivar (gris). Pasa el mouse por cada uno para ver su regla.",
   "«Redactar mensaje» arma un WhatsApp o un correo con el historial del cliente: lo escribe la IA si está conectada; si no, sale una plantilla. Revísalo y ajústalo. Enviarlo lo decides tú, con «Abrir en WhatsApp» o copiándolo.",
   "«¿Sí le escribiste?» lo registra con un toque (con Deshacer) y el cliente pasa a «En seguimiento», con el siguiente paso: llamar al día 3, último mensaje al día 10 y luego esperar una semana. Así nadie del equipo le vuelve a escribir sin saberlo.",
   "«¿Cómo terminó?» cierra el intento: si le interesa se crea la oportunidad; «no por ahora» o «no contesta» lo regresan a la lista en 90 días; «ya no compra» lo saca, con la razón. Tres intentos y una semana sin respuesta cuentan solos como «no contesta»."
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
   "Los pedidos de todos los canales en una sola lista: ventas, producción y cobranza saben en qué va cada uno sin preguntar por WhatsApp.",
   "Paso 1: Filtra por abiertos, entregados o cancelados y por canal; clic en un renglón abre el pedido.",
   "Paso 2: Para una venta de Mercado Libre, sitio web o mostrador, usa «Pedido sin cotización».",
   "Los renglones en rojo están atrasados: pasó su fecha compromiso. «Producción» muestra el avance del taller y «Saldo» lo que falta por cobrar (dice «pagado» en verde si ya se cobró todo).",
   "En «Pedido sin cotización» eliges cliente, canal y número de venta, y en el siguiente paso agregas las partidas con su precio de lista. Los servicios sin precio fijo, como «Servicio de paquetería», te piden el monto (sin IVA) al agregarlos.",
   "Abajo ves el total y lo por cobrar de lo filtrado, en pesos, y aparte lo que tus clientes ya debían en la hoja (los pedidos que vienen de la hoja se cobran contra eso).",
   "Los pedidos ya entregados que vienen de las hojas no salen de entrada; actívalos con «Incluir históricos de los paneles».",
   "Los de la hoja que siguen en el taller sí salen siempre, con «en saldo de arranque» en la columna de saldo: su cobro se lleva en el saldo de arranque del cliente."
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
   "Todo lo de un pedido en una página: partidas, avance de producción, envío, facturas, cobros y a quién le cuenta la venta.",
   "Paso 1: Mira en la línea de arriba por dónde va: confirmado, en producción, listo o entregado.",
   "Paso 2: Imprime la «Hoja de salida» para que el cliente la firme.",
   "Paso 3: Dale «Entregar»: elige qué sale, quién recibió y sube la foto de la hoja firmada.",
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
   "«Crédito de la venta» dice qué vendedor cobra comisión por este pedido; si la cerraron entre varios, la gerencia lo comparte con «Compartir», en porcentajes que suman 100 %."
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
   "Todos los precios que le pediste a compras, juntos: cuáles siguen pendientes, cuáles ya tienen precio y cuáles pasaron su plazo.",
   "Paso 1: Pide un precio suelto con «Pedir precio»; casi siempre se pide desde la partida de la cotización.",
   "Paso 2: Cuando llegue el precio, dale «Aplicar a COT-…» para ponerlo en esa partida.",
   "También se pide desde el buscador cuando algo no aparece.",
   "«Sin tomar»: nadie de compras la ha agarrado. «Cotizando»: ya la tiene alguien. «Con precio»: ya contestaron. En rojo las que pasaron su plazo, que corre en horas hábiles (las urgentes tienen menos).",
   "De compras solo ves el precio de lista y la entrega en días hábiles.",
   "Si ya no hace falta, «Ya no la necesito» la cancela y compras deja de cotizarla."
  ]
 }
];

export const CONCEPTOS_MANUAL: ConceptoManual[] = [
 {
  "clave": "abajoDelSugerido",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Esta publicación está más barata que el sugerido del canal (por las piezas que trae cada venta): después de la comisión no llega completo el precio de lista. Revisa su precio en el canal."
 },
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
  "clave": "abrirEnMercadoLibre",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Lo abre en Mercado Libre, en otra pestaña, para verlo como se ve allá. Con esto no se cambia nada."
 },
 {
  "clave": "abrirMensajeLead",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Abre WhatsApp o tu correo con el mensaje ya escrito y anota «Le escribí» con ese texto en sus intentos. Desde aquí no se envía nada: lo mandas tú allá."
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
  "texto": "Los precios de esta cotización pasan a ser el costo vigente de cada artículo (en el historial dice «cotización») y se recalculan sus precios. Solo lo ve quien captura costos."
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
  "clave": "alcanceDocumentoMaquina",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Solo de esta máquina, de todas las de su tipo y modelo, o de todas las de su tipo de cualquier modelo. Así el mismo manual no se sube a cada una."
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
  "clave": "almacenDeSalidaSurtir",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "De qué almacén sale cada partida. Solo aparecen los que surten a planta, con lo que tiene cada uno; viene elegido el que tiene más."
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
  "clave": "almacenSalidaEnvio",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "De qué almacén sale esa partida. Si nadie lo elige, sale del almacén preferido del artículo cuando ahí alcanza o, si no, del de planta que tiene más; lo que surte Full sale del Almacén ML. Almacén lo puede cambiar mientras no se empaca."
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
  "clave": "antiguedadOrdenesMto",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Las órdenes abiertas por cuántos días llevan desde que se reportaron, separadas en preventivos, fallas y fallas con la máquina parada. Si se juntan en las barras de más días, el taller no se da abasto."
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
  "clave": "aprobacionPlano",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Quién aprobó la revisión y cuándo. Al aprobarla se vuelve la vigente y la anterior pasa a Anteriores. Si hay órdenes abiertas que ingeniería revisó con la anterior, les llega un aviso a la gerencia de producción y a ingeniería."
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
  "clave": "areaMaquina",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "En qué área del taller está. Sirve para buscarle respaldo (otra igual en la misma área) y, al reportar una falla desde la terminal de piso de esa área, sale primero en la lista."
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
  "clave": "articuloImportado",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Lo que se trae del extranjero. Para reabastecer se piden 6 meses de cobertura en lugar de 1 (salvo que tenga los suyos) y, si no se usa seguido, su demanda sale del promedio de 12 meses."
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
  "clave": "asignarLead",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "La gerencia escoge qué vendedor lo atiende, o se lo pasa a otro. Al vendedor le llega un aviso y el lead queda a su nombre."
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
  "clave": "avanceCargaXml",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Cómo va la carga. Nuevas: no estaban y se guardaron. Amarradas: encontraron su renglón en la hoja. Ya estaban: se habían subido antes y no se duplican. De otro RFC: la empresa no las emitió ni las recibió, y no se guardan. No se pudieron leer: no son una factura válida o no traen folio fiscal."
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
  "texto": "Lo vendido en el estado en el año que ves, entre su meta: la que puso dirección o, si no hay, la sugerida. 100 % quiere decir que ya llegó."
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
  "clave": "avisarDiasAntesPreventivo",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Cuántos días antes de la fecha sale la orden del preventivo, para que dé tiempo de planearlo. Desde ese día el plan se ve «Por vencer»."
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
  "clave": "baseBono",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Cuánto vale el bono al 100 % en un mes. Cada persona cobra su % aprobado por esta base: con base de $2,000 y 85 %, cobra $1,700. Se define por puesto y, si alguien debe ganar distinto, por persona. La captura Recursos Humanos; solo la ve quien tiene nómina."
 },
 {
  "clave": "baseBonoDesde",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "El mes desde el que vale la base, para ese mes y los siguientes hasta que se capture otra. La de cada mes es la más reciente que ya empezó. Cambiarla no toca lo que ya se pagó en nómina."
 },
 {
  "clave": "baseBonoPersona",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Una base propia para alguien que debe ganar distinto a los demás de su puesto. Mientras exista, se usa la suya y no la del puesto."
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
  "texto": "Lo que se paga por los objetivos: el % del mes aprobado por la base del bono de su puesto o de la persona. Las bases se capturan en Objetivos › Bases del bono; mientras no haya una para ese mes se muestra solo el % y no se paga nada."
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
  "clave": "botonActualizarCosto",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Guarda el costo nuevo por unidad, sin IVA y en la moneda que elegiste, con fecha de hoy. Queda en el historial como «a mano» y en ese momento se recalculan su precio de lista y el costo y el precio de los equipos que lo usan."
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
  "clave": "botonAgregarDocumentoMaquina",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Sube un PDF o una foto (hasta 50 MB) o pega una liga de Drive, y elige si es solo de esta máquina o de todas las de su tipo y modelo."
 },
 {
  "clave": "botonAgregarFotoEmpaque",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Agrega otra foto del paquete mientras siga en el almacén, por ejemplo para reemplazar una que se retiró. La historia dice que se agregó después de empacar."
 },
 {
  "clave": "botonAgregarGastoEmbarque",
  "modulos": [
   "importaciones"
  ],
  "texto": "Captura a mano un gasto del embarque: quién lo cobra, monto sin IVA, su IVA aparte y cómo se reparte. Marca «estimado» si todavía no llega la cuenta de gastos."
 },
 {
  "clave": "botonAgregarMaterialOrden",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Agrega a esta orden, y solo a ella, un componente, materia prima o un subensamble completo (un extra del pedido), con su motivo en la línea de tiempo. Si la lista del equipo está mal, pide además el cambio a ingeniería."
 },
 {
  "clave": "botonAgregarPlanPreventivo",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Agrega un plan: cada cuánto toca (por fecha, por horas de uso o lo que pase primero), su checklist y cuántos días antes sale la orden. Si ya le toca, la orden sale al guardar."
 },
 {
  "clave": "botonAgregarPuntoRutina",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Agrega un renglón al final. También puedes dar Enter en un punto para agregar otro justo debajo."
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
  "clave": "botonAplicarPropuestaCorreos",
  "modulos": [
   "importaciones"
  ],
  "texto": "Aplica lo que dejaste marcado, igual que si lo capturaras a mano: las fechas como etapas, la ETA y los datos al embarque (el cambio de ETA queda en la historia) y los documentos pendientes como recibidos. Si algo no se puede, como una fecha futura, no se aplica nada y te dice por qué."
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
  "texto": "Abre «A quién llamar hoy»: los clientes que conviene buscar, cada uno con su motivo (le toca comprar, refacciones, reactivar o una cotización por vencer) y su contacto a la mano."
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
  "clave": "botonAsignarSerie",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Le pone a la orden su número de serie: el código del equipo más el siguiente número de su familia. Sirve si la orden se creó cuando el equipo no tenía código; si sigue sin código, te dice dónde capturarlo."
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
  "clave": "botonBasePersona",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Le pone a una persona una base distinta a la de su puesto."
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
  "clave": "botonBorrarCobroSaldoHoja",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Borra un cobro mal capturado (te pide confirmar). El saldo de la hoja del cliente vuelve a subir y el borrado queda en la bitácora."
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
  "clave": "botonBorrarMovimientoCaja",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Borra un movimiento mal capturado (te pide confirmar) y el saldo se recalcula; el borrado queda en la bitácora. Solo lo hace finanzas, y lo que vino de la hoja no se borra."
 },
 {
  "clave": "botonBorrarMovimientoProveedor",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Borra una compra o un pago que se capturó mal en el ERP (te pide confirmar); el saldo se recalcula y el borrado queda en la bitácora. Lo que viene de la hoja no se borra: se marca para que no cuente."
 },
 {
  "clave": "botonCalcularCosteoImportacion",
  "modulos": [
   "importaciones"
  ],
  "texto": "El preliminar se puede calcular en cuanto se registra el pedimento pagado e incluye los gastos estimados; el final, en cuanto se registra la cuenta de gastos, y va sin estimados. Volver a calcular reemplaza el borrador de ese tipo. Calcular no cambia el catálogo: eso pasa al cerrar el final."
 },
 {
  "clave": "botonCalificarCriticidad",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Abre «Editar» de la máquina para calificar qué pasa si se para, su riesgo de seguridad, si tiene respaldo y cuánto tarda su refacción. Con los dos primeros la criticidad se calcula sola."
 },
 {
  "clave": "botonCambiarEtapaTerminal",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "La etapa de esta tablet. Tócala para elegir otra; la tablet se queda en la que elijas hasta que la cambies."
 },
 {
  "clave": "botonCambiarIsr",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Cambia el ISR con que se compensa la utilidad (de 0 % a menos de 60 %). Antes de guardar ves cuántos precios se mueven; al guardar se recalculan todos los que compensan ISR y el cambio queda en la bitácora."
 },
 {
  "clave": "botonCambiarPrioridad",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Sube o baja la prioridad de la orden (urgente, normal o baja): las urgentes van arriba en cada columna del tablero. En la fila del taller manda primero el lugar que acomoda la gerencia en el Gantt o en Cuadrillas. Queda en la línea de tiempo."
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
  "clave": "botonCancelarEnvio",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Lo cancela con su motivo, mientras no haya salido (ya en camino, si regresa es una devolución). No mueve el inventario. Si ya tenía guía, el ERP la deja de descontar del saldo: cancélala también en la plataforma de la paquetería para que allá regrese igual."
 },
 {
  "clave": "botonCancelarInvitacion",
  "modulos": [
   "admin"
  ],
  "texto": "Borra la invitación. Un correo de fuera de la empresa ya no podrá entrar; uno de la empresa sí entra, pero sin rol, hasta que se lo des."
 },
 {
  "clave": "botonCancelarOrden",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Cancela la orden con su motivo: suelta el material apartado y cancela lo que se pidió a compras y todavía no está en una orden de compra. No se puede deshacer. Si ya se había surtido material, hay que regresarlo al almacén."
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
  "clave": "botonCargarXmlFacturas",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Te lleva a «Facturas anteriores (XML)» para subir los XML del mes. Lo que el SAT dice que nos facturaron y nadie ha registrado aparece aquí."
 },
 {
  "clave": "botonCargarZipXml",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Elige XML sueltos o los ZIP que da Drive al descargar. Se leen en tu navegador y solo sube lo que dicen; volver a subir lo mismo no duplica nada."
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
  "clave": "botonConfigurarEnvios",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Las paqueterías que se usan (si son de prepago y su saldo mínimo) y el check list que almacén palomea al empacar."
 },
 {
  "clave": "botonConfirmarDocumentoLeido",
  "modulos": [
   "importaciones"
  ],
  "texto": "Guarda el archivo en su casilla del embarque y los datos como los dejaste; abajo dice qué pasa con este tipo de documento. Si es una factura y el embarque trae varias órdenes, primero elige de cuál es."
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
  "clave": "botonCopiarDestino",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Copia quién recibe, su teléfono y el domicilio, para pegarlos en la página de la paquetería sin volver a teclearlos."
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
  "clave": "botonCotizarEnvioMano",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Anota cuánto cobra la paquetería o el transportista, con IVA, y qué servicio, si lo cotizaste fuera del ERP. Si estaba «Por cotizar», pasa a «Cotizado»; se puede cambiar mientras no tenga guía."
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
  "clave": "botonDefinirBase",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Captura la base mensual y desde qué mes vale. Si ese mes ya tenía base, la corrige; si eliges un mes nuevo, la de antes sigue valiendo para los meses anteriores."
 },
 {
  "clave": "botonDescartarLead",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Lo cierra sin volverlo oportunidad, con el motivo (no contestó, busca algo que no vendemos, duplicado…). Sale de los pendientes, quien lo registró ve por qué y ya no se reabre."
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
  "clave": "botonDesligarPublicacionML",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Le quita el artículo a la publicación: vuelve a «Por ligar», sus ventas abiertas se quedan sin artículo y su envío que todavía no tiene guía se cancela. Las que ya tienen guía no cambian."
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
  "clave": "botonDuplicarRutina",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Abre una copia de esta rutina con «(copia)» en el nombre, para armar otra parecida sin tocar la original. No se guarda hasta que le das Guardar."
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
  "clave": "botonEditarMaquina",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Cambia los datos de la máquina: número, área, ubicación, a quién está asignada, si se presta, si tiene horómetro y lo que se califica de su criticidad (si se para, riesgo, respaldo y días de refacción)."
 },
 {
  "clave": "botonEditarOrden",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Cambia la prioridad, la fecha compromiso, el número de serie o las notas para el taller. Cada cambio queda en la línea de tiempo con tu nombre; la fecha del pedido no cambia."
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
  "clave": "botonEditarPolitica",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Abre la política para cambiar su utilidad, recargos, medida especial, redondeo o descuento máximo. Al lado ves, antes de guardar, cuántos precios se mueven y cuáles más; al guardar se recalculan los precios y el cambio queda en la bitácora."
 },
 {
  "clave": "botonElegirCarpetaXml",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Elige la carpeta FACTURAS que descargaste de Drive (un año o todo): se leen los XML y los ZIP que trae, también los de sus subcarpetas. Puede tardar unos minutos por año."
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
  "clave": "botonEntregarOrden",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Marca que el equipo terminado ya se entregó. La orden se cierra y deja de salir en el tablero y en Órdenes y material. La marcan la gerencia de producción o almacén."
 },
 {
  "clave": "botonEntregarPedido",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Registra lo que sale: cuánto de cada partida (todo lo que falta o solo una parte), quién recibió y, si ya la tienes, la foto de la hoja firmada. Lo que sale se descuenta del inventario. Si te equivocas, «Deshacer» en el aviso regresa esa entrega en los primeros 15 minutos; después la reabre la gerencia de ventas."
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
  "clave": "botonEnvioAFull",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Arma un envío para reabastecer la bodega de Full de Mercado Libre: eliges qué va y de qué almacén sale. Se empaca con fotos y check list como cualquier envío y, al marcar que salió, se vuelve un traspaso a Almacén ML."
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
  "clave": "botonesMontoPagoProveedor",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Atajos para el monto: «Lo vencido» pone solo lo que ya venció; «Todo», lo que se le debe completo."
 },
 {
  "clave": "botonEstadoMatriz",
  "modulos": [
   "analisis"
  ],
  "texto": "Abre abajo qué se vende en este estado, en qué municipios y los textos que más se vendieron. Otro clic lo quita."
 },
 {
  "clave": "botonEtiquetasQR",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Abre la hoja de etiquetas con QR para imprimir y pegar en las máquinas. Con un filtro elegido salen solo las de la lista; con «Todas» o «Dadas de baja», todas las que siguen activas."
 },
 {
  "clave": "botonExpedienteEmbarque",
  "modulos": [
   "importaciones"
  ],
  "texto": "Abre en otra pestaña la carpeta del expediente de este embarque (la de Drive), la que se capturó en sus datos."
 },
 {
  "clave": "botonExportarCsvNomina",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Baja la semana en un archivo para Excel: un renglón por persona con días pagados, horas extra, prima, bono, descuentos, préstamos y lo que se le paga. Es el que se le pasa al contador para ISR, IMSS y timbrado; si la semana sigue abierta, sale como borrador."
 },
 {
  "clave": "botonFamiliaMatriz",
  "modulos": [
   "analisis"
  ],
  "texto": "Pinta abajo el mapa de dónde se vende esta familia. Otro clic lo quita."
 },
 {
  "clave": "botonFotoMaquina",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Toma o elige una foto de la máquina (en el celular se abre la cámara). Reemplaza la que tenía."
 },
 {
  "clave": "botonGenerarGuiaSkydropx",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Genera la guía con la tarifa elegida y Skydropx la cobra de su saldo en ese momento. El PDF, el número y el rastreo quedan en el envío y, si todavía no se empaca, pasa a «Guía lista» y almacén recibe el aviso. Para cancelarla después, hay que hacerlo en el panel de Skydropx."
 },
 {
  "clave": "botonGenerarMensajeLead",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "La IA escribe el mensaje con lo que busca, sus intentos anteriores y tu instrucción (Ctrl+Enter en la caja hace lo mismo). Si ya había uno, escribe otro y se pierde lo que le hayas cambiado a mano."
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
  "clave": "botonGrabarNfc",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Graba en una etiqueta NFC la liga para reportar falla de esta máquina: dale clic y acerca el celular a la etiqueta. Solo sale en Chrome de Android."
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
  "clave": "botonHacerPrincipalFoto",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "La pasa al primer lugar: desde ahora es la que sale en el buscador y junto a la partida en las cotizaciones nuevas. Las cotizaciones ya hechas se quedan con la que tenían."
 },
 {
  "clave": "botonImprimirEtiqueta",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Abre en otra pestaña la hoja tamaño carta con esta etiqueta, lista para imprimir o guardar como PDF."
 },
 {
  "clave": "botonIniciarEtapa",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Empieza la etapa: eliges quiénes la trabajan (vienen marcados los que planeó la gerencia) y desde ese momento cuentan sus horas hombre."
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
  "clave": "botonIrResguardos",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Te lleva a los préstamos de herramienta: quién se llevó qué, desde cuándo, y para recibirla cuando la regresen."
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
  "clave": "botonLeadParticular",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Escribe «Particular» como empresa, para cuando quien llamó es una persona y no una empresa. Luego dale Guardar."
 },
 {
  "clave": "botonLeerCorreosIA",
  "modulos": [
   "importaciones"
  ],
  "texto": "La IA lee los correos ligados a este embarque (si son demasiados, deja fuera los más viejos y te avisa) y te propone fechas de etapas, ETA, datos y documentos que llegaron, cada uno con el correo de donde salió. Nada cambia hasta que lo revisas y lo aplicas."
 },
 {
  "clave": "botonLeerDocumentoEmbarqueIA",
  "modulos": [
   "importaciones"
  ],
  "texto": "Sube un PDF o una foto (proforma, factura, packing list, BL, pedimento o cuenta de gastos) y la IA te propone sus datos junto al archivo. Nada se guarda hasta que lo revisas y das «Confirmar y guardar»."
 },
 {
  "clave": "botonLigarPublicacionML",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Le dice al ERP qué artículo es esta publicación y cuántas piezas lleva cada venta. Sus ventas que ya entraron se completan con ese artículo (si el paquete ya salió, se descuenta del inventario) y las siguientes entran solas."
 },
 {
  "clave": "botonLlenarConApartado",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Escribe en cada partida lo que ya tiene apartado (sin pasar de lo que falta), para surtir de una vez lo reservado. Revisa y ajusta antes de «Surtir»."
 },
 {
  "clave": "botonLlenarConFaltante",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Escribe en cada partida todo lo que falta por surtir, para registrar de una vez lo que ya se había entregado con la hoja. Ajusta lo que no se dio completo."
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
  "clave": "botonMarcarEmpacado",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Cierra la caja: guarda fotos, check list, números de serie y bultos como evidencia y el envío pasa a «Empacado». Se prende cuando no falta nada (abajo dice qué falta) y antes revisa que haya de dónde sacar cada cosa del inventario."
 },
 {
  "clave": "botonMarcarEntregado",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Confirma que el cliente ya lo recibió; si quieres, anota quién (como sale en el rastreo). Se anota como entregado en el pedido y, cuando ya se entregó todo lo que lleva (sin contar servicios), el pedido queda entregado."
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
  "clave": "botonNuevaMaquina",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Da de alta una máquina, herramienta, vehículo, instalación o equipo de oficina, con el número que tiene pintado."
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
  "clave": "botonNuevaRutina",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Escribe la lista de puntos que se revisan en un preventivo. Después la eliges en el plan preventivo de cada máquina de ese tipo."
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
  "texto": "Da de alta un cliente con lo mínimo para cotizar: su nombre y un teléfono; lo fiscal se completa después o con su constancia. Queda a tu nombre (la gerencia puede dejarlo libre). Búscalo antes en la lista: ahí salen todos, también los de otros vendedores."
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
  "clave": "botonNuevoComponente",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Da de alta lo que se compra: componente, materia prima o servicio, con su clave (te propone la siguiente), nombre y unidad, y su costo si tu puesto los captura. Al crearlo se abre su ficha para completar lo demás. Los servicios no llevan existencia."
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
  "clave": "botonOrdenParaStock",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Crea una orden sin cliente, para tener el equipo listo (de exhibición o de línea). Cuando se venda, la gerencia de producción la asigna al pedido con «Usar» en Pedidos. El equipo necesita su lista de materiales."
 },
 {
  "clave": "botonOtraContrasena",
  "modulos": [
   "admin"
  ],
  "texto": "Genera otra contraseña fácil de dictar: letras y números separados por guiones, sin 0, O, 1 ni l."
 },
 {
  "clave": "botonOtroBultoEmpaque",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Agrega otro bulto, vacío, para que escribas qué lleva, su peso y sus medidas."
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
  "clave": "botonPalomearTodas",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Palomea de una vez todos los puntos del check list. Úsalo solo si de verdad ya revisaste cada uno: el empaque queda a tu nombre."
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
  "clave": "botonPausaMto",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Abre las razones para pausar (esperando refacción, te vas a otra, fin del día) o «Solo pausar». Al elegir, deja de contar tu tiempo; la orden sigue abierta para retomarla."
 },
 {
  "clave": "botonPausarEtapa",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Detiene la etapa cuando la dejan (falta material, los mueven a otra orden): se cierra el tiempo de todos los que la trabajaban, pero su cuadrilla queda anotada para reanudar."
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
  "texto": "Le pides algo a una o varias personas, con la fecha para cuándo si la sabes (es opcional): a cada una le llega un aviso y en «Los que pedí» ves cuándo lo terminan. Con varias, eliges si basta con que uno lo haga o si cada quien lo tiene que hacer."
 },
 {
  "clave": "botonPedirEnvioAlmacen",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Pide el envío de lo que falta mandar de este pedido. Las partidas, el peso y las medidas de cada artículo y el domicilio ya vienen llenos; tú eliges cómo va y cuánto de cada cosa. Si lo empaca almacén, le llega el aviso."
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
  "texto": "Lo das por terminado. Puedes dejar una respuesta corta (un precio, una fecha) y a quien te lo pidió le llega un aviso. Si fue error, lo puedes deshacer durante los minutos que fije dirección (15 de inicio), salvo los de la revisión nocturna."
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
  "clave": "botonPlayMto",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Empiezas a trabajar esta orden y tu tiempo se cuenta desde ahora. Si traías otra en play, esa se pausa sola. La orden pasa a En reparación y, si es preventivo o la falla la detiene, la máquina también."
 },
 {
  "clave": "botonPonerEnEspera",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Detiene la orden sin cancelarla, con su motivo (por ejemplo, el cliente dejó anticipo y no ha regresado). Lo que se estaba trabajando se pausa, deja de contar en la carga del taller y no sale atrasada. «Reactivar» la regresa."
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
  "clave": "botonPrestarHerramienta",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Registra que alguien se lleva una herramienta: quién, para qué (o para qué servicio) y cuándo la regresa. Queda en Resguardos hasta que alguien la recibe."
 },
 {
  "clave": "botonProbarSkydropx",
  "modulos": [
   "admin"
  ],
  "texto": "Revisa que el ERP pueda entrar a Skydropx: muestra el saldo de la cuenta y las direcciones dadas de alta allá, para que elijas la de la planta. No genera ni cobra nada."
 },
 {
  "clave": "botonProblemaEtapa",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Reporta algo que estorba (falta lámina, la máquina no prende) sin detener la etapa. Queda en la historia de la orden y aparece en Mejoras para buscarle solución. Si ya no pueden seguir, pausa también."
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
  "clave": "botonQuitarBase",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Quita esa base del historial. Si fue un error, el aviso trae «Deshacer». Lo que ya se pagó no cambia."
 },
 {
  "clave": "botonQuitarBultoEmpaque",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Quita este bulto de la lista, por ejemplo si dos piezas van juntas en una sola caja. El cambio se guarda al marcar empacado."
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
  "clave": "botonQuitarDocumentoMaquina",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Quita este documento. Si es de todas las máquinas de su tipo, se quita de todas. Te pide confirmar."
 },
 {
  "clave": "botonQuitarFacturaPedido",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Quita del pedido una factura que se registró por error: deja de contar como facturada y queda en la bitácora. Te pide confirmar con «Sí, quitarla»."
 },
 {
  "clave": "botonQuitarFotoCatalogo",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Quita la foto del artículo: deja de salir en el catálogo y en las cotizaciones nuevas. Las cotizaciones que ya la llevan no cambian."
 },
 {
  "clave": "botonQuitarFotoEquipo",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Quita la foto en ese momento, sin preguntar. Las cotizaciones que ya la llevan la conservan. Si era la principal, la siguiente toma su lugar."
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
  "clave": "botonQuitarPuntoRutina",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Quita este punto de la lista. Nada cambia hasta que le das Guardar."
 },
 {
  "clave": "botonQuitarReglaFamilia",
  "modulos": [
   "analisis"
  ],
  "texto": "Borra la regla y vuelve a clasificar todas las ventas de la hoja sin ella. No pide confirmación."
 },
 {
  "clave": "botonQuitarRespuestaRapida",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Borra esta respuesta rápida de la lista para todos. Las respuestas que ya se mandaron con ella no cambian."
 },
 {
  "clave": "botonReactivarMaquina",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "La regresa a la lista de máquinas como Operando, con todo su historial. Sus planes preventivos siguen apagados: ábrelos aquí abajo y prende los que sigan."
 },
 {
  "clave": "botonReactivarOrden",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Quita la espera: la orden vuelve a contar en la carga del taller y en los tiempos de entrega, y se puede trabajar en la terminal. Lo que se pausó al ponerla en espera sigue pausado hasta que el taller lo reanude."
 },
 {
  "clave": "botonReanudarEtapa",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Sigue con una etapa pausada: eliges quiénes la trabajan (viene marcada la cuadrilla de antes) y su tiempo vuelve a contar."
 },
 {
  "clave": "botonRecargaPaqueteria",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Registra lo que se depositó en la cuenta de prepago de una paquetería: suma a su saldo. Un cargo que la paquetería hizo por su cuenta, como un sobrepeso, va en negativo y con su explicación."
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
  "clave": "botonRecibirHerramienta",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Registra que la herramienta regresó: cómo llegó (bien, dañada o incompleta) y, si quieres, una foto. Si llegó dañada o incompleta, se abre sola una orden de falla."
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
  "clave": "botonReemplazarMaterial",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Cambia este material por otro solo en esta orden. El de ahora queda tachado con «Reemplazado por…», quién y por qué, y suelta lo que tenía apartado; el nuevo entra con su cantidad."
 },
 {
  "clave": "botonReescribirSemana",
  "modulos": [],
  "texto": "Pide que la IA vuelva a escribir la semana con los números de este momento. Si no, se queda la primera que escribió esta semana. Cuenta para tus consultas de IA del día."
 },
 {
  "clave": "botonRegistrarCobroPedido",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Anota un pago del cliente para este pedido: monto, fecha en que entró, método y referencia. El saldo baja al momento y le llega un aviso al vendedor. No deja cobrar más del total; un monto negativo es una devolución."
 },
 {
  "clave": "botonRegistrarCompraGasto",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Anota en la cuenta del proveedor una factura que nos hicieron: material, flete, luz, servicio. Sube el XML y se llena solo (puedes subir varios); sin XML, sube el PDF o una foto y la IA la lee, o captúrala a mano. Si ya se pagó de contado, el pago va en el mismo paso."
 },
 {
  "clave": "botonRegistrarEtapaEmbarque",
  "modulos": [
   "importaciones"
  ],
  "texto": "Guarda la fecha real de este paso (Enter también). Solo acepta hoy o antes. «Cerrado» pide antes la cuenta de gastos y que lo que había por recuperar ya esté marcado como recuperado."
 },
 {
  "clave": "botonRegistrarFacturaPedido",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Anota una factura que timbramos para este pedido. Sube su XML y se llenan folio, UUID, fecha y total (sin XML, captúralos a mano); no la deja pasar si la emitió otro RFC o si ya está registrada. La antigüedad del saldo corre desde la primera factura."
 },
 {
  "clave": "botonRegistrarFacturaSat",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Abre «Registrar compra o gasto» ya lleno con esta factura, como si subieras su XML. Ya registrada, sale sola de esta lista."
 },
 {
  "clave": "botonRegistrarGuiaMano",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Anota el número de guía (en flete, la carta porte o una referencia) y lo que costó; en paquetería, sube también el PDF. Si todavía no se empaca, pasa a «Guía lista» y a almacén le llega el aviso. Si la paquetería es de prepago, el costo se descuenta de su saldo; si cambias la guía, la historia guarda la anterior."
 },
 {
  "clave": "botonRegistrarHoras",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Anota la lectura de hoy del horómetro. No puede ser menor que la anterior. Si con eso ya le toca un preventivo por horas, su orden sale en ese momento."
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
  "clave": "botonRegistrarLead",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Anota a quien llamó o escribió interesado: su nombre, un teléfono o correo y qué busca. Mientras escribes te dice si ya es cliente. Al guardarlo le llega a quien toque según el reparto; si ya es cliente con vendedor, directo a él."
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
  "clave": "botonRegistrarPagoProveedor",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Anota un pago a este proveedor: cuánto, de qué cuenta salió y, si quieres, qué factura paga. Si no eliges factura, se aplica a las que vencen primero. Pagar más de lo que se le debe solo se puede marcándolo como anticipo."
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
  "clave": "botonRegistrarTodasSinRegistrar",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Abre «Registrar compra o gasto» con todas las facturas del filtro que elegiste (Todas, A crédito o Proveedor nuevo), para capturarlas una tras otra. Con «Saltar» dejas una para después."
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
  "clave": "botonRepartoLeads",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Cómo se reparten los leads nuevos (bandeja, la gerencia asigna o quien lo registra escoge), cuántas horas pasan antes de avisar si nadie lo toma o nadie lo atiende, y qué vendedores los reciben. Lo cambian la gerencia de ventas, dirección y marketing."
 },
 {
  "clave": "botonReponerMaterial",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Regresa a la lista un material quitado por error, con la cantidad que llevaba, y queda en la línea de tiempo. Para apartarlo otra vez, usa «Volver a apartar»."
 },
 {
  "clave": "botonReportarFallaMaquina",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Abre el reporte de falla: eliges la máquina, qué le pasa, si todavía se puede usar y, si quieres, una foto. Se abre una orden de mantenimiento y a la gerencia de producción le llega el aviso."
 },
 {
  "clave": "botonReportarFallaTerminal",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Avisa a mantenimiento de una máquina descompuesta desde la tablet: eliges la máquina, dices qué pasa y si está parada, y puedes tomarle foto. Se crea su orden de mantenimiento y con «Volver» regresas a la terminal."
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
  "clave": "botonRevisarGuiaSkydropx",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Skydropx ya cobró la guía de este envío, pero no había entregado el PDF. «Revisar guía» lo trae, con el número y el rastreo, sin volver a cobrar."
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
  "clave": "botonSaleDeEtapa",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Cierra ahora el tiempo de esta persona en la etapa (se fue a otra cosa o ya se va) y la saca de la cuadrilla. La etapa sigue con los demás."
 },
 {
  "clave": "botonSalioFullProveedor",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Marca que Mercado Libre ya lo mandó desde su bodega (sale del Almacén ML) o que el proveedor ya se lo envió al cliente (no sale de nuestro almacén). Pasa a la pestaña «En camino» (lo de Full dice «Surtido por Full») hasta que se marca entregado."
 },
 {
  "clave": "botonSaltarFactura",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Deja esta factura sin registrar y pasa a la siguiente (en la última, cierra). No se registra nada de ella: la puedes registrar después."
 },
 {
  "clave": "botonSeLoLlevaron",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Para lo que recoge el cliente en planta: escribes quién se lo llevó y en ese momento sale del inventario y queda entregado. Antes se empaca con fotos y check list."
 },
 {
  "clave": "botonSeUneAEtapa",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Agrega a una persona a la etapa sin detenerla: su tiempo empieza a contar desde ahora. Si está trabajando en otra etapa, primero tiene que salir de ahí."
 },
 {
  "clave": "botonSiEsNuestraML",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Quita la marca de otra tienda: la publicación regresa a «Por ligar» y sus ventas siguientes vuelven a entrar al ERP. Las que se cancelaron al marcarla no regresan solas."
 },
 {
  "clave": "botonSubirDocumentoEmbarque",
  "modulos": [
   "importaciones"
  ],
  "texto": "Sube el archivo (PDF, imagen, Word o Excel) sin leerlo con la IA: queda en su casilla y pasa a recibido. Si ya tenía uno, el botón dice «Agregar otro»: el nuevo entra como otro renglón del mismo documento y el anterior se queda como estaba."
 },
 {
  "clave": "botonSubirFotosEquipo",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Sube una o varias fotos desde la computadora o el celular (hasta 5 MB cada una); se agregan al final. Si el equipo no tenía fotos, la primera que subas queda como principal."
 },
 {
  "clave": "botonSurtirOrden",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Registra lo que almacén le entrega al taller para esta orden: anotas quién lo recibe, sale del inventario y descuenta lo apartado. Se puede dar por partes; de una partida de la lista no sale más de lo que falta."
 },
 {
  "clave": "botonTerminalMantenimiento",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Abre la terminal de mantenimiento: le das play a la orden que vas a trabajar y pausa al dejarla. Así las horas de cada orden se cuentan solas."
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
  "clave": "botonTerminarEtapa",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Marca la etapa como acabada y cierra el tiempo de todos. Si era la última, la orden queda terminada, y si ya no queda otra orden de su pedido por terminar, el pedido queda listo para entregar. Si fue por error, el aviso trae «Deshacer»."
 },
 {
  "clave": "botonTomarLead",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Te lo quedas: pasa a «Míos» y nadie más lo puede tomar; si alguien te ganó, te dice quién. Si pasan las horas que fijó la gerencia sin que lo vuelvas oportunidad o lo descartes, se les avisa a ti y a la gerencia."
 },
 {
  "clave": "botonTraerLoNuevoHilo",
  "modulos": [
   "importaciones"
  ],
  "texto": "Trae los correos nuevos de este hilo desde tu Gmail. Solo te sale si tú lo ligaste, porque es tu cuenta."
 },
 {
  "clave": "botonTraerPublicacionesML",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Lee de Mercado Libre las publicaciones activas y pausadas (precio, existencia, fotos, visitas de 30 días, comisión y envío) y la reputación de la cuenta, y las cruza con el catálogo. Solo lee: no cambia nada allá."
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
  "texto": "Pone como patrón, en el formulario de arriba, hasta 3 palabras de este texto, sin números ni medidas, para que lo ajustes y elijas la familia. No guarda nada."
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
  "clave": "botonVolverAmarrarXml",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Vuelve a buscar el renglón de la hoja de las facturas que no lo tienen, y la categoría por lo comprado de las que no la tienen. Úsalo después de darle su RFC a un proveedor o de corregir la hoja."
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
  "clave": "botonYaSalio",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Marca que el paquete ya salió de planta: pasa a «En camino» y se descuenta del inventario lo que falte, una sola vez (en un envío a Full, es el traspaso a Almacén ML). Si es un equipo de una orden terminada, la orden queda entregada. Ya no se puede cancelar: si regresa, es una devolución."
 },
 {
  "clave": "bultosEnvio",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Cuántos bultos (cajas) lleva y cuánto pesan en total. Salen del empaque guardado en cada artículo y almacén los corrige al empacar; \"sin medir\" son bultos a los que les falta peso o medidas."
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
  "clave": "cadaHorasPreventivo",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Opcional: cada cuántas horas del horómetro toca. Si también tiene fecha, toca lo que llegue primero. La orden sale cuando el horómetro llega a esas horas."
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
  "clave": "cambiarCompromisoOrden",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Cambia la fecha compromiso de esta orden. Queda en la línea de tiempo; la fecha del pedido no cambia."
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
  "clave": "cambioContraAnterior",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Cuánto subió (rojo) o bajó (verde) contra el costo anterior. Si cambió de moneda, el anterior se convierte a la nueva antes de comparar."
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
  "clave": "cambioPromedioSimulacion",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Cuánto subirían (en rojo) o bajarían (en verde) en promedio los precios que cambian, ya redondeados."
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
  "clave": "canalesComisionesConfig",
  "modulos": [
   "admin"
  ],
  "texto": "Lo que cobra cada canal de venta (Mercado Libre, sitio web, Amazon…) y lo que se suma al precio para publicar ahí. Con esto sale el precio de cada canal: al cambiar un dato, los precios de ese canal se recalculan."
 },
 {
  "clave": "canalesEnLinea",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Precio sugerido con IVA para cada canal (Mercado Libre, sitio web…): parte del precio de lista y le suma la comisión del canal y, cuando aplican, su cuota fija y el envío. «Abajo del sugerido» avisa que una publicación está más barata que eso."
 },
 {
  "clave": "canalMensajeLead",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Si el mensaje es para WhatsApp o para correo (el correo lleva asunto). Al cambiarlo se borra lo escrito: dale «Generar mensaje» otra vez."
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
  "clave": "capturarTipoCambioCosteo",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Escribe otro y da Enter para fijarlo a mano: desde ese momento lo importado se costea con él y se recalculan sus costos y precios. Cobranza y pagos siguen con el del día. Después vuelve a seguir al del día solo cuando éste se aleje el porcentaje que dice arriba."
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
  "texto": "Cuántos preventivos tocan en cada una de las próximas 8 semanas, calculados con el calendario de cada plan activo (no solo las órdenes que ya salieron). «Vencidos» son los que ya pasaron su fecha. El color es la criticidad de la máquina y arriba de cada barra van las horas de técnico estimadas con lo que tardó ese plan antes (o el promedio). Los planes que van solo por horas de uso no salen."
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
  "clave": "casillaRutinaActiva",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Apagada, la rutina ya no sale para elegir en los planes, pero se queda guardada con sus puntos. Solo se puede apagar si ningún plan preventivo activo la usa."
 },
 {
  "clave": "catalogoPaqueteriasEnvio",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Las paqueterías que salen para elegir al cotizar y al registrar guías (la casilla de la izquierda las prende o apaga). «saldo» es de prepago: cada guía se descuenta de lo recargado y a la derecha va el mínimo abajo del cual se pinta en rojo y avisa. Las cambia la gerencia de ventas."
 },
 {
  "clave": "categoriaArticulo",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "El grupo del artículo (rodamientos, tornillería, lámina…): sirve para buscarlo y filtrarlo. Si la categoría tiene su propia política de precio, su precio de lista sale con ella. Con «Consumibles del taller» encendido, también decide si sale como consumible del taller."
 },
 {
  "clave": "categoriaCompraNueva",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Una categoría de compra que nadie ha clasificado todavía: cuenta como gasto de operación hasta que en «Categorías de compra» elijas cómo cuenta."
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
  "texto": "Se puede desde el viernes, cuando ya terminó la semana. Al cerrarla se congelan los renglones, se descuentan los préstamos, lo descontado para la caja de ahorro pasa al saldo de cada quien y se marcan pagados los bonos que ya tienen base. Después ya no cambia: un error se corrige en una semana abierta con otro concepto."
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
  "clave": "checklistSalidaEnvio",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Los puntos que almacén revisa y palomea antes de cerrar cada caja; sin todos no se puede marcar empacado. Salen los de equipo si lleva un equipo o subensamble, los de componentes si lleva otra cosa y los de todos los envíos siempre. Lo palomeado queda en la evidencia."
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
  "clave": "chipEtapaOrden",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "En qué etapa va la orden: el punto lleva su color (el mismo de la terminal y la TV) y un anillo ámbar si está pausada. Puede decir también cuánto lleva y quién la trabaja. «Sigue:» es la próxima etapa, cuando ninguna se está trabajando."
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
  "texto": "Lo que se cobró la semana pasada, en pesos: cobros de pedidos (los de dólares, al tipo de cambio del pedido), pagos de la hoja y lo cobrado aquí de saldos de la hoja, contra la semana anterior. Es la misma cuenta que «Cobrado por mes» en Cobranza. Verde si subió."
 },
 {
  "clave": "cobranzaAntiguedadTablero",
  "modulos": [],
  "texto": "Lo que deben los clientes, agrupado por días: 0 a 30, 31 a 60, 61 a 90 y más de 90. Los pedidos del ERP cuentan desde la fecha del pedido; lo que se debía en la hoja, desde la venta (los pagos tapan las ventas más viejas, así que lo que falta es lo más reciente). Lo de la hoja se reparte igual que en Cobranza, y lo de más de 90 días es lo que sale en rojo en «Por cobrar»."
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
  "clave": "coincidenciaOrdenFactura",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Por qué esta orden puede ser de la factura. Casa el folio: almacén anotó el folio de esta factura al recibir la orden; al registrar la factura, viene marcada sola. Mismo total: vale lo mismo que la factura (1 % de diferencia o menos). Ya tiene otra factura: ya se ligó a otra."
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
  "clave": "colorEtapaTaller",
  "modulos": [
   "admin"
  ],
  "texto": "El color con que sale la etapa en la TV del taller, la terminal, el Gantt y las órdenes, para reconocer cada área de un vistazo."
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
  "texto": "En qué quedó cada una: «Se volvió pedido»; perdida, con su motivo; lo abierto, según lo que le falta (Negociando, Seguimiento atrasado, No contesta, Vigencia vencida, Esperando respuesta); lo que nunca salió (Borrador, Por autorizar, «Autorizada, sin enviar», Cancelada sin enviar); o «Se cerró con otra cotización», cuando la venta se ganó con otra."
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
  "clave": "componenteSinCosto",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "No tiene costo capturado: cuenta como $0 en los equipos que lo llevan (su costo y su precio salen más bajos sin avisar) y él mismo no tiene precio de lista. Captúralo en su ficha o en «Actualizar precios» de Compras."
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
  "clave": "configurarChecklistSalida",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Aquí agregas puntos al check list o los apagas quitándoles la palomita (no se borran). Cada punto es de equipos, de componentes o de todos los envíos. Un cambio cuenta desde el siguiente empaque: lo ya empacado guarda el check list que se palomeó."
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
  "clave": "contactoDirectoLead",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Marca su número, abre su chat de WhatsApp o tu correo. WhatsApp abre sin texto escrito: el mismo saludo a muchos números hace que bloqueen la cuenta. Abrirlo no anota nada: cuando le llames o le escribas, anótalo en «Intentos de contacto»."
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
  "texto": "Este cliente es de la cartera de otro vendedor: sus contactos solo los ven él, la gerencia y cobranza. Si la regla de cartera está prendida y su cuenta sigue vigente, no te deja ligarlo a tu cotización (a la gerencia sí): pide a la gerencia que lo reasigne o que compartan el crédito."
 },
 {
  "clave": "contadosConteo",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Cuántos artículos de la lista ya capturaste. En un conteo de todo el almacén la lista trae lo que el sistema dice que hay ahí; en uno con lista, solo lo que se pidió contar. En los dos entra lo que agregaste, y lo que no captures no se ajusta al cerrar."
 },
 {
  "clave": "conteoACiegas",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Quien cuenta no ve lo que dice el sistema hasta capturar lo contado: así el número esperado no contagia el conteo. En cuanto capturas, aparecen lo que decía el sistema y la diferencia."
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
  "texto": "Crea el pedido con los precios, descuentos y condiciones de esta cotización: eliges qué partidas entran y la fecha compromiso. La cotización queda Aceptada, su oportunidad Ganada y su seguimiento se cierra. Al terminar te lleva al pedido."
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
  "texto": "Un lead se vuelve oportunidad cuando ya te contestó: primero anotas en «Intentos de contacto» que contestó y qué te dijo, y entonces se habilita «Crear oportunidad». Si ya era cliente va a su cuenta; si no, eliges la empresa si ya existe o se da de alta como cliente nuevo con este contacto. Si su teléfono o correo ya es de otro cliente, no deja darlo de alta otra vez: te dice cuál es para que lo elijas. La oportunidad nace en Contactado, a nombre del vendedor que tiene el lead, con lo que te dijo, y quien registró el lead ve en qué etapa va."
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
  "clave": "costoAltaArticulo",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "El costo por unidad, sin IVA, en la moneda de al lado. Queda como el primer renglón de su historial y con él sale su precio de lista. Si lo dejas vacío, el artículo queda «sin costo»."
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
  "clave": "costoEnvioPaqueteria",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Cotizado: lo que dijo la paquetería o el transportista que costaría, con IVA; si nadie lo cotizó aparte, es lo de la guía. Costo de la guía: lo que costó de verdad al registrarla; si la paquetería es de prepago, es lo que se descuenta de su saldo."
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
  "clave": "costoMantenimientoPeriodo",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Lo que se anotó como costo en sus órdenes de mantenimiento dentro del periodo: refacciones, servicio externo, mano de obra y otros. Solo sale si tienes permiso de costos."
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
  "clave": "costoMaterialFabricado",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Lo que cuestan las piezas que se compran para hacerlo, en todos sus niveles (también las que van dentro de sus subensambles): la cantidad efectiva de cada una por su costo. Una pieza sin costo cuenta como $0."
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
  "modulos": [
   "costeo",
   "margenes"
  ],
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
  "texto": "Cotizaciones abiertas (de borrador a enviada) que todavía no vencen. Cada cotización cuenta una vez aunque tenga varias versiones. El monto es lo ya enviado y vigente, sin IVA, con la última versión enviada de cada una. El cierre es qué parte de las cotizaciones de los últimos 90 días que ya se cerraron se ganó; la versión que diste de baja al sacar otra no cuenta como perdida."
 },
 {
  "clave": "cotizadoVivo",
  "modulos": [],
  "texto": "Total con IVA, en pesos, de las cotizaciones enviadas o autorizadas que siguen vigentes: lo que está en la calle esperando respuesta. Cada cotización cuenta una vez aunque tenga varias versiones, con el total de la última. Abajo, el cierre de 90 días (la versión que se dio de baja al sacar otra no cuenta como perdida) y las que esperan autorización de precio."
 },
 {
  "clave": "cotizarSkydropx",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Cotiza el envío con todas las paqueterías de Skydropx a la vez y genera la guía sin salir del ERP: el PDF, el número, el rastreo y el costo quedan en el envío y el costo se descuenta del saldo de Skydropx. La guía se cobra al generarla. Si Skydropx falla o es flete, registra la guía a mano."
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
  "clave": "criticidadDeLaHoja",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "La criticidad que traía la máquina de la hoja de mantenimiento. Vale mientras no califiques «si se para» y el riesgo de seguridad; con esos dos se calcula sola."
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
  "texto": "Cuenta con correo y contraseña para la TV del taller, con el rol Pantalla de piso: entra directo al tablero de piso y no ve nada más. El correo se arma solo con el nombre de la pantalla (sin acentos ni espacios, que un correo no admite) y no necesita ser un buzón real, salvo que al crearla el ERP pida confirmar el correo."
 },
 {
  "clave": "cuentaTerminal",
  "modulos": [
   "admin"
  ],
  "texto": "Cuenta con correo y contraseña para la tablet del taller, con el rol Terminal de piso: entra directo a la terminal y no ve nada más. Con ella se marca el avance de las etapas (iniciar, pausar, terminar, quién trabaja) y se reportan fallas de máquinas. Cada quien elige su nombre en la terminal, así que una cuenta basta para toda el área. No necesita cuenta de Google, y el correo no tiene que ser un buzón real salvo que al crearla el ERP pida confirmar el correo."
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
  "clave": "descripcionComponente",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Lo que sale debajo del nombre al agregarlo a una cotización o a un pedido: medidas, material, marca. Una viñeta por renglón. Se copia a la partida en ese momento, así que cambiarla después no cambia lo que ya se cotizó."
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
  "clave": "destinoDelEnvio",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "A dónde va y quién lo recibe: la dirección de entrega del pedido o, si no tiene, el domicilio del contacto. Con «Cambiar» lo escribes distinto solo para este envío."
 },
 {
  "clave": "destinoPedidoSkydropx",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "El domicilio como viene escrito en el pedido. Skydropx lo pide por partes (código postal, estado, municipio, colonia y calle): pásalo a los campos de abajo. Al cotizar, se le queda al contacto para la próxima vez."
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
  "clave": "diasMarcarSinRegresar",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Con más de estos días fuera, la herramienta se marca como sin regresar, aunque no tenga fecha de regreso o todavía no llegue. Empieza con el número configurado (7 si nadie lo cambió); si lo cambias aquí, solo cambia lo que ves tú mientras tengas abierta la pantalla."
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
  "clave": "dondeSeUsaPieza",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Todos los equipos y subensambles que llevan esta pieza, directo en su lista o dentro de un subensamble. Revísalos antes de cambiarla. Clic en uno para abrir su ficha."
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
  "clave": "duplicarCotizacion",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Hace otra cotización en borrador, con folio nuevo, el mismo cliente, las mismas partidas y condiciones. Es para una venta aparte: la original no cambia. Para seguir la misma negociación usa «Nueva versión»."
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
  "clave": "editarConceptosRecargo",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Agrega o quita conceptos de esta lista y escribe su porcentaje. Un concepto sin nombre no se guarda, y nada cambia hasta que das «Guardar y mover…»: antes ves en «Qué pasaría» cuántos precios se mueven."
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
  "clave": "elegirEtapaTerminal",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Elige la etapa de esta estación. Cada botón dice cuántas órdenes se trabajan ahí (iniciadas o pausadas) y cuántas ya pueden empezar."
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
  "clave": "empacarEnvio",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Los pasos para cerrar la caja: fotos, check list, número de serie si lleva equipo y, salvo en lo que recoge el cliente, peso y medidas de cada bulto. Cuando no falta nada se prende «Marcar empacado»; ya empacado, el check list, las series y los bultos quedan fijos."
 },
 {
  "clave": "empaqueArticuloEnvio",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "El peso y las medidas del paquete de este artículo, con su caja, y cuántas piezas van en cada paquete. Se capturan una vez (almacén o ingeniería) y de aquí los toman cada envío y cada flete que se cotiza."
 },
 {
  "clave": "empaqueCompra",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "De a cuánto se compra (una caja de 100, un rollo de 30 m…). Lo que sugiere Reabasto se redondea hacia arriba a este múltiplo."
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
  "clave": "enlaceAbrirRegistroBitacora",
  "modulos": [
   "admin"
  ],
  "texto": "Te lleva a la pantalla de ese registro: el pedido, la cotización, el cliente, el proveedor, la orden o el artículo. Solo sale si el registro tiene pantalla propia; en empleados, además, si puedes ver Recursos humanos."
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
  "texto": "Ya salió de planta (o ya lo surtió Full o lo mandó el proveedor) y todavía no se marca como entregado. El inventario ya se descontó, salvo una venta de Mercado Libre sin artículo ligado: esa se descuenta al ligarla."
 },
 {
  "clave": "envioEntregados",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Entregados y cancelados que se pidieron en los últimos 60 días, con su evidencia."
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
  "texto": "Lo que ya puede salir (empacado, y con guía si va por paquetería), lo que surte Full o manda el proveedor y nadie ha marcado, y lo abierto con recolección para hoy o una fecha que ya pasó."
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
  "texto": "Envíos por paquetería o flete que todavía no tienen guía: hay que cotizarlos y registrar la guía (la de paquetería puede salir de Skydropx). Mientras, almacén ya los puede ir empacando."
 },
 {
  "clave": "envioPorEmpacar",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Lo que almacén tiene que empacar: paquetería, flete, lo que pasa a recoger el cliente y los envíos a Full. Aparece desde que se pide, aunque todavía no tenga guía, y se empaca con fotos, check list y, si es equipo, su número de serie."
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
  "clave": "esperaPreguntaML",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Cuánto lleva esperando respuesta, en horas de reloj (cuentan también la noche y el fin de semana). Se pone en ámbar pasada media hora y en rojo pasada una hora."
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
  "clave": "estadoDevolucionHerramienta",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Bien: regresó completa y funciona. Dañada o incompleta: escribe qué le pasó o qué le falta; al recibirla se abre sola una orden de falla de esa herramienta y la gerencia de producción recibe el aviso."
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
  "texto": "En qué paso va: Por cotizar, Cotizado, Guía lista, Empacado, En camino, Entregado o Cancelado. Lo que recoge el cliente o va a Full empieza en «Por empacar». Lo que surte Full o manda el proveedor está «Pendiente» hasta que se marca que salió (lo de Full queda «Surtido por Full»)."
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
  "texto": "Hecho (palomita verde): lo terminó quien lo tenía. Lo hizo otra persona (palomita clara): era «basta con que uno lo haga» y otro del grupo lo terminó primero. Cancelado (tache): quien lo pidió ya no lo necesitó o, si era de la revisión nocturna, no era error."
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
  "clave": "etapaEnProceso",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "En proceso: el taller ya la empezó y no la ha pausado ni terminado."
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
  "clave": "etapaPendiente",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Pendiente: la etapa todavía no empieza en el taller."
 },
 {
  "clave": "etapasDeOrden",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Las etapas del taller que lleva esta orden, en orden, y en qué va cada una. La orden se termina sola al acabar la última."
 },
 {
  "clave": "etapasEmbarque",
  "modulos": [
   "importaciones"
  ],
  "texto": "Los pasos del embarque, de la PI aceptada al cierre, cada uno con la fecha real en que pasó: no acepta fechas futuras (lo esperado va en la ETA). La palomita verde ya pasó y el círculo marcado es el que sigue. Algunos se anotan solos: el anticipo al registrar el pago y el pedimento al capturarlo."
 },
 {
  "clave": "etapaTerminada",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Terminada: el taller la marcó como acabada. Si fue por error, la gerencia de producción la reabre con «Reabrir»."
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
  "clave": "exactoResultados",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Sale tal cual de lo capturado en el ERP o en las hojas: no se estima nada."
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
  "clave": "fallasMaquinaPeriodo",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Fallas que le reportaron en el periodo, sin contar las canceladas."
 },
 {
  "clave": "fallasUltimoAnio",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Cuántas fallas le reportaron en los últimos 12 meses, sin contar las canceladas. En la lista de máquinas, abajo, las horas que estuvo parada en ese tiempo (por fallas o mientras le hacían un preventivo)."
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
  "clave": "familiaPreciosVentas",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "La familia de equipos que analizas (el tipo de cada equipo); entre paréntesis, cuántos equipos activos tiene. El índice sigue a los equipos de esa familia y las ventas son las de esa familia."
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
  "clave": "fechaDevolverPrestamo",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Opcional. Si pasa esa fecha y no ha regresado, se marca en rojo como sin regresar."
 },
 {
  "clave": "fechaEntregaOrden",
  "modulos": [
   "compras"
  ],
  "texto": "Cuándo debe llegar. Las órdenes que salen de requisiciones o de una cotización ya la traen; si no la capturas, al enviar la orden se calcula con los días hábiles de entrega del proveedor (7 si no tiene). Pasada esa fecha, la orden sale como atrasada."
 },
 {
  "clave": "fechaNecesariaRequisicion",
  "modulos": [
   "compras"
  ],
  "texto": "Para cuándo la necesita quien la pidió; las más próximas van arriba. En rojo si falta menos de una semana o ya pasó."
 },
 {
  "clave": "fechaRegresoResguardo",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "En los préstamos: la fecha en que quedó de regresarla (en rojo si ya pasó). En «Regresadas»: cuándo regresó, cómo llegó y quién la recibió."
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
  "clave": "fechaUltimoCosto",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Cuándo se capturó el último costo. Con punto amarillo si tiene más de 6 meses: ya no es confiable para cotizar y conviene confirmarlo con el proveedor."
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
  "clave": "filtroAFavorProveedor",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Proveedores que nos deben a nosotros: les pagamos de más como anticipo o tienen una nota de crédito por aplicar. Lo que tenemos a favor se va contra su siguiente factura."
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
  "clave": "filtroComponentesConExistencia",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Solo lo que tiene algo en los almacenes de planta. Lo que está nada más en el Full de Mercado Libre, o en negativo, no sale aquí."
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
  "clave": "filtroEmitidasXml",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Las facturas que timbró la empresa (ventas). Cada una se amarra a su venta del libro de ventas de la hoja por serie y folio."
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
  "clave": "filtroLeadsAbiertos",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Todos los leads pendientes: los que nadie ha tomado y los que ya tienen vendedor pero todavía no se vuelven oportunidad ni se descartan."
 },
 {
  "clave": "filtroLeadsAtendidos",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Los que ya se cerraron: se volvieron oportunidad o se descartaron con su motivo."
 },
 {
  "clave": "filtroLeadsMios",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Los leads que tienes tú y siguen abiertos. Llámale o escríbele, anota cada intento y, cuando conteste, vuélvelo oportunidad o descártalo."
 },
 {
  "clave": "filtroLeadsRegistre",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Los leads que anotaste tú, abiertos y cerrados: aquí ves quién los tomó y en qué quedaron."
 },
 {
  "clave": "filtroMaquinasConPendiente",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Las que no están operando (con falla, parada o en reparación) y las que tienen su preventivo vencido."
 },
 {
  "clave": "filtroMaquinasHerramienta",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Lo que es herramienta o se presta con resguardo."
 },
 {
  "clave": "filtroMaquinasPrestadas",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "La herramienta que alguien tiene prestada ahora, con quién y desde cuándo."
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
  "clave": "filtroOpAbiertas",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Las órdenes que el taller todavía no termina: planeadas, liberadas y en proceso. Las terminadas tienen su propio filtro; las entregadas y las canceladas ya no salen en esta lista."
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
  "texto": "Los que surten algún artículo o tienen órdenes abiertas (y, si ves importes, a los que se les compró en los últimos 12 meses). Es la vista de entrada: el directorio de las hojas mezclaba acreedores (nómina, casetas, hoteles)."
 },
 {
  "clave": "filtroQueBitacora",
  "modulos": [
   "admin"
  ],
  "texto": "El tipo de registro que cambió: pedidos, clientes, artículos, listas de materiales, usuarios, configuración… Con «Todo» ves todos."
 },
 {
  "clave": "filtroResguardosRegresados",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "El historial de lo que ya regresó: cuándo, cómo llegó, quién lo recibió y su foto si la tomaron."
 },
 {
  "clave": "filtroRolUsoErp",
  "modulos": [
   "admin"
  ],
  "texto": "Deja solo a quien tiene ese rol en los indicadores, la tabla, el mapa de calor y las gráficas por persona. La gráfica día por día y la de en qué se va el costo de la IA siguen contando a todos, y el costo de la revisión nocturna solo se suma al indicador con «Todos los roles»."
 },
 {
  "clave": "filtroRutinasDesactivadas",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Rutinas que ya no salen para elegir en los planes. Siguen guardadas: ábrela y prende «Activa» para volver a usarla."
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
  "clave": "filtroSinFacturarCobranza",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Los pedidos que todavía no tienen ninguna factura registrada, deban o no (sin los cancelados). Sirve para ver qué falta facturar; su antigüedad corre desde la fecha del pedido."
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
  "clave": "folioPlano",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "El número que el ERP le da a cada plano (PL-00001). Es el mismo en todas sus revisiones: con él lo citas en el taller y lo buscas aquí."
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
  "clave": "formulaConNumeros",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "La misma cuenta de «De dónde sale el precio», escrita como fórmula con los números de este artículo: para revisarla a mano o explicarla. Al final dice cuántos pesos de precio salen por cada peso de costo."
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
  "clave": "fotosEmpaqueEnvio",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Las fotos del paquete que toma almacén al empacar, hasta 6: abierto con lo que lleva y cerrado con la etiqueta. Sin al menos una no se puede marcar empacado; las retiradas no cuentan."
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
  "clave": "frecuenciaRutina",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Cada cuánto se hace esta rutina, de diaria a anual, o por horas de uso. Sirve para encontrarla; cuándo toca de verdad lo dice el plan preventivo de cada máquina."
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
  "clave": "grupoEnPausaMto",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Órdenes ya empezadas que tú no traes en play (si alguien más sí, lo dice abajo). Primero las que tú pausaste, la más reciente arriba."
 },
 {
  "clave": "grupoFallasPorAtender",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Fallas reportadas que nadie ha empezado. Primero las que tienen la máquina parada, luego las de máquinas más críticas y luego las más viejas."
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
  "clave": "grupoPreventivosPorHacer",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Preventivos que ya salieron de su plan y nadie ha empezado. Primero los vencidos, luego por fecha y luego los de máquinas más críticas."
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
  "clave": "guardarEmpaqueArticulo",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Guarda este peso y estas medidas en la ficha del artículo, para que los próximos envíos ya salgan con ellos. Se guarda al marcar empacado."
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
  "clave": "herramientaParaPrestar",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Solo sale la herramienta que se presta, que nadie tiene ahora y que no está parada, en reparación ni dada de baja."
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
  "clave": "historiaEnvio",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Todo lo que ha pasado con el envío, lo más reciente arriba: quién lo pidió, lo cotizó, registró la guía, lo empacó, agregó o retiró una foto, lo sacó y lo entregó, y cada cambio de fecha, destino, paquetería o almacén."
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
  "clave": "historialCostoComponente",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Cada vez que cambió el costo de esta pieza, registrado solo: la gráfica es escalonada (el costo vale lo mismo hasta el siguiente cambio) y la tabla dice la fecha, el costo nuevo, cuánto cambió y de dónde salió. Si el costo cambió de moneda, la gráfica muestra solo los de la moneda de hoy."
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
  "clave": "historialMantenimientoMaquina",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Cada falla y cada preventivo de esta máquina, del más nuevo al más viejo, con cuánto estuvo parada y en qué quedó. Con clic abres la orden."
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
  "clave": "horasEtapaAgregada",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Las horas hombre que calculas que lleva la etapa. Cuentan en el avance de la orden, en lo que le falta a su área y en el plan del taller."
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
  "clave": "horasTecnicoMto",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Las horas trabajadas de las órdenes que se cerraron en el periodo, por quien las atendió (quien quedó en el diagnóstico o el primero que les dio play), y cuántas eran preventivos y cuántas fallas. «Sin anotar»: órdenes sin nadie a cargo."
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
  "clave": "importacionesAnteriores",
  "modulos": [
   "admin"
  ],
  "texto": "Las últimas corridas del importador (hasta 10), la más reciente arriba: cuándo, si se leyó de Google Sheets o de archivos y cuántos precios de equipo salieron iguales a la hoja."
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
  "clave": "iniciarEtapaDesdeOrden",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Empieza (o sigue) la etapa desde aquí, sin anotar quién la trabaja: así no cuentan horas hombre. La cuadrilla planeada se queda; para que cuenten sus horas, iníciala en la terminal con su gente."
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
  "modulos": [
   "costeo",
   "margenes"
  ],
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
  "clave": "invitacionSinRol",
  "modulos": [
   "admin"
  ],
  "texto": "La invitación no trae rol: al entrar queda en «Espera rol» y no ve nada hasta que le des uno."
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
  "clave": "kilosPorUnidad",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Cuánto pesa cada unidad (cada metro, cada pieza…). Por ahora solo queda guardado aquí: ningún reporte lo usa todavía; está pensado para medir el consumo de acero en kilos."
 },
 {
  "clave": "kpiCostoAcumuladoMaquina",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Todo lo que se ha anotado como costo en las órdenes de esta máquina: servicio externo, mano de obra, otros y las refacciones que entregó almacén (esas solo con permiso de costos). Abajo, lo de las órdenes de los últimos 12 meses."
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
  "clave": "kpiHerramientaPrestada",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Herramienta que alguien tiene prestada ahora. Con clic vas a Resguardos para ver quién la tiene o recibirla."
 },
 {
  "clave": "kpiMaquinasConFalla",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Máquinas con una falla reportada que todavía trabajan. Con clic vas a las órdenes abiertas."
 },
 {
  "clave": "kpiMaquinasParadas",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Máquinas que no están trabajando ahora: paradas por una falla o en reparación. Abajo, sus números. Lo ideal es cero; con clic ves las que tienen algo pendiente."
 },
 {
  "clave": "kpiOrdenesAbiertasMaquina",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Fallas y preventivos de esta máquina que no se han cerrado ni cancelado. Abajo, el folio de la que la tiene parada o, si ninguna, el de la más vieja."
 },
 {
  "clave": "kpiPreventivosVencidos",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Planes preventivos activos que ya pasaron su fecha o sus horas de uso. Abajo, cuántos planes activos hay. Lo ideal es cero; con clic vas a la pestaña Preventivos."
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
  "clave": "kpiTiempoParadaMaquina",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Las horas de reloj que estuvo fuera de servicio en los últimos 12 meses, por fallas que la pararon o mientras le hacían un preventivo: de que se paró a que se cerró la orden. De 48 horas para arriba se ve en días. Más bajo es mejor."
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
  "clave": "ligaFotoEquipo",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Pega la liga de Drive o de cualquier imagen y da Enter: se agrega al final. La de Drive se convierte sola en imagen, pero el archivo tiene que estar compartido con «Cualquier persona con el enlace»."
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
  "clave": "lineaLead",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Qué busca, a grandes rasgos: Maquinaria, Refacciones u Otros (fletes, servicios, instalaciones). Pasa tal cual a la oportunidad cuando se convierte."
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
  "clave": "lineaTiempoOrden",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Todo lo que le ha pasado a la orden, lo más nuevo arriba: quién la creó y la liberó, cada etapa que empezó, se pausó o terminó, los problemas del piso, el material surtido y cada cambio de material o de fechas."
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
  "clave": "listaMaterialOrden",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "El material de esta orden, copiado de la lista del equipo al crearla: un cambio aquí es solo para esta orden y queda en la línea de tiempo. Arriba, cuántas partidas lleva, cuántas tienen faltante y cuántas faltan por entregar al taller."
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
  "clave": "manoObraTotal",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Las horas hombre de todo el equipo, sumadas las de sus subensambles, por la tarifa de cada etapa del taller."
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
  "texto": "Un renglón por persona (hasta 25, las de más uso primero) y un cuadro por día. Entre más oscuro, más de la medida que escojas ese día (con «Costo de la IA» cuenta las consultas). Los huecos dicen quién deja de usar el ERP algunos días o quién ya no lo usa. El cuadro de hoy se enciende en el momento en que alguien registra un cambio (destello fuerte) o usa una pantalla (suave)."
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
  "texto": "El tono de cada lugar dice cuánto tiene de lo que elegiste (venta, clientes, ticket o crecimiento); la leyenda de abajo dice qué es cada tono, incluido el de «Sin venta». Pasa el mouse para ver sus números y, en el país, dale clic a un estado para ver sus municipios."
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
  "texto": "Una máquina o herramienta que ya no conviene reparar o que ya no está en el taller. Se da de baja desde su ficha con el motivo: sus órdenes abiertas se cancelan, sus planes preventivos se apagan y deja de contar en las métricas desde ese día. Su historial se queda y se puede reactivar. Si alguien la tiene prestada, primero hay que recibirla."
 },
 {
  "clave": "maquinaPrestable",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Prendido, se puede prestar: aparece para elegir en Resguardos y en su ficha sale «Prestar». La herramienta siempre se presta."
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
  "clave": "margenResultados",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Utilidad ÷ ventas del año: de cada peso vendido, cuánto quedó. Más alto es mejor."
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
  "clave": "masAntiguoCobranza",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Los días que lleva el pedido con saldo más viejo de ese cliente o vendedor."
 },
 {
  "clave": "masAtrasadosCobranza",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Los 5 pedidos con saldo de más antigüedad (días desde su primera factura o, sin factura, desde el pedido): por dónde empezar a llamar. Clic en uno para ver sus cobros y facturas. Lo que se debía en la hoja no sale aquí; está en «Saldos de arranque (hoja)»."
 },
 {
  "clave": "masDeUnDiaPrecio",
  "modulos": [
   "compras"
  ],
  "texto": "Qué parte de las solicitudes de este mes tardó más de un día hábil (10 horas) en contestarse; cuentan también las abiertas que ya pasaron de un día. Menos es mejor: en verde si es igual o mejor que en el chat."
 },
 {
  "clave": "materialAgregadoOrden",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "No venía en la lista del equipo. «Agregado»: lo puso ingeniería o la gerencia de producción, con su motivo en la línea de tiempo. «Fuera de lista»: almacén lo surtió sin estar en la lista."
 },
 {
  "clave": "materialCompletoOrden",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Ya se apartó el material y no falta nada: todo lo de la lista está apartado o ya se le entregó al taller."
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
  "clave": "medidasBultosEnvio",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Peso en kg y largo, ancho y alto en cm de cada bulto ya armado. Vienen del empaque guardado en cada artículo: si al pesar sale distinto, corrígelo. Sin ellos no se empaca un envío por paquetería o a Full ni se cotiza con Skydropx; en flete no detienen la salida."
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
  "texto": "La sugerida reparte la meta del año con lo que pesó cada estado en los 3 años completos anteriores. Dirección puede escribir otra (se guarda con Enter o al salir de la casilla); vacía regresa a la sugerida. Solo se puede cuando ya está capturada la meta del año."
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
  "clave": "metricasReputacionML",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Qué parte de las ventas del periodo tuvo un reclamo, se despachó con demora o la cancelamos nosotros, según Mercado Libre; junto, cuántas fueron. Entre más bajo, mejor. «Ventas del periodo» es cuántas ventas toma para medirlo."
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
  "clave": "modoDestelloUso",
  "modulos": [
   "admin"
  ],
  "texto": "Cómo destella el cuadro de hoy. «Por acción»: una vez por cada guardado, aunque escriba muchos renglones. «Por renglón»: un pulso por cada renglón de la bitácora (una orden con 40 partidas son 40 pulsos seguidos, hasta 60). Se recuerda en este navegador."
 },
 {
  "clave": "modoLeads",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "A quién le llega un lead nuevo. Hay tres formas y la escogen la gerencia de ventas, dirección o marketing (en «A quién le llega» o en Configuración): bandeja (se avisa a los vendedores y el primero que lo toma se lo queda), la gerencia de ventas lo asigna, o quien lo registra escoge al vendedor. En las tres, si ya es cliente y tiene vendedor vigente, le llega directo a su vendedor."
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
  "clave": "monedaProveedor",
  "modulos": [
   "compras"
  ],
  "texto": "En qué moneda le compras. De entrada, sus órdenes nuevas salen en esta moneda; mientras una orden está en borrador se puede cambiar."
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
  "clave": "movimientosHojaCliente",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Los últimos 30 movimientos de este cliente en el libro de ventas de la hoja (ventas, pagos y notas de crédito), como se capturaron ahí. Son de consulta: aquí no se cambian."
 },
 {
  "clave": "movimientosProveedor",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Todo lo de este proveedor, del más nuevo al más viejo: compras, pagos, notas de crédito y reembolsos. «ERP» se capturó aquí; «Hoja» viene del libro de compras (los 200 más recientes). Lo tachado no cuenta en el saldo."
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
  "texto": "Lo que de verdad llega a la cuenta de Mercado Pago: lo que pagó el comprador menos la comisión, el envío que pagamos y las retenciones. Si el pago se reembolsó, también se resta lo que se le regresó al comprador y se suma lo que Mercado Libre devolvió de sus cargos; si no devolvió nada, sale en negativo: es lo que se perdió. Mercado Pago lo deja disponible unos días después (la fecha sale junto)."
 },
 {
  "clave": "nivelPermiso",
  "modulos": [
   "admin"
  ],
  "texto": "Lo que un rol puede hacer en un módulo: 1 ver, 2 capturar (ver y registrar), 3 administrar (aprobar, borrar, configurar). Un guion = sin acceso: ni lo ve en el menú ni el ERP le entrega esos datos."
 },
 {
  "clave": "noEsEsteClienteLead",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Quita el cliente que escogiste, por si no era él: el lead se registra sin ligarlo a un cliente y se reparte con la regla de siempre."
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
  "clave": "nominaXml",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Recibos de nómina timbrados de ese año. Se cuentan, pero no se amarran a la hoja."
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
  "clave": "notaConteo",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Qué revisar en ese artículo al contarlo, por ejemplo si también hay que buscarlo en otro almacén."
 },
 {
  "clave": "notaEmbarque",
  "modulos": [
   "importaciones"
  ],
  "texto": "Escribe algo que deba saber quien vea el embarque (lo que pidió el agente, un acuerdo con el proveedor) y da Enter. Queda en la historia con tu nombre y la fecha."
 },
 {
  "clave": "notaParaVendedorSolicitud",
  "modulos": [
   "compras"
  ],
  "texto": "La lee el vendedor tal cual, junto con el precio de lista y la entrega: sirve para condiciones como un mínimo de compra o cómo llega. Nada de costos aquí."
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
  "clave": "notasOrdenCompra",
  "modulos": [
   "compras"
  ],
  "texto": "Van impresas en la orden y en el PDF que recibe el proveedor: lugar y horario de entrega, o lo que haya que aclararle. Se guardan al salir del cuadro. Si la orden se cancela, aquí queda el motivo."
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
  "clave": "numeroGuiaEnvio",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "El número de guía de la paquetería (en flete, la carta porte o una referencia). Si la guía salió de Skydropx, dale clic para ver el rastreo."
 },
 {
  "clave": "numeroMaquina",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "El número pintado en la máquina, como SOL-03. Con él la encuentran al reportar una falla y sale grande en su etiqueta QR. Se guarda en mayúsculas."
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
  "clave": "ocHojaXml",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "El número de orden de compra que trae el renglón de la hoja donde quedó la factura. Si la carpeta de órdenes de Drive está configurada, clic para buscar su PDF."
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
  "clave": "opCancelada",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Cancelada: la orden ya no se va a fabricar. Al cancelarla se soltó su material apartado y se canceló lo que se había pedido a compras y todavía no estaba en una orden de compra."
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
  "clave": "opEntregada",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Entregada: el equipo terminado ya se entregó. La orden está cerrada y ya no sale en el tablero ni en Órdenes y material."
 },
 {
  "clave": "operacionesVenta",
  "modulos": [
   "analisis"
  ],
  "texto": "Cuántas ventas distintas hubo: cada factura o venta del libro de la hoja y cada pedido del ERP cuentan una vez, tengan las partidas que tengan. Cada venta de Mercado Libre sin pedido cuenta aparte."
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
  "clave": "ordenesDelProveedor",
  "modulos": [
   "compras"
  ],
  "texto": "Sus 50 órdenes de compra más recientes, con su estado. Clic en una para abrirla."
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
  "clave": "origenNumerosResultados",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Cada número del diagrama con su importe, qué parte de las ventas es y cómo se calculó. Exacto: sale tal cual de lo capturado. Estimado: sale de una regla. Parcial: al periodo le faltan datos."
 },
 {
  "clave": "origenRequisicion",
  "modulos": [
   "compras"
  ],
  "texto": "Quién la pidió: Producción (faltante de una orden de producción), Reabasto (almacén, por stock mínimo) o Manual."
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
  "clave": "otrosEnPlayMto",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Otras personas que tienen esta orden en play ahora. Varios pueden trabajar la misma orden: al cerrarla se suman las horas de todos."
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
  "clave": "pagaronCompradoresML",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Lo que pagaron los compradores en el mes (por la fecha del pago), ya sin lo que se les regresó. Abajo, cuántos pagos fueron."
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
  "texto": "Cada barra es la parte de todas las horas paradas del periodo que se llevó una máquina (las 6 que más, y el resto junto); la línea va sumando. Las que quedan antes de cruzar la línea punteada del 80 % son las pocas que se llevan casi todo el tiempo perdido: ahí conviene atender primero (refacciones, cambio o un preventivo más seguido)."
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
  "clave": "partidasPorEnviarPedido",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Lo que falta por mandar de cada partida: lo pedido menos lo que ya va en otros envíos no cancelados. Baja la cantidad si mandas en partes; en 0, esa partida no va."
 },
 {
  "clave": "partidasPorSurtir",
  "modulos": [],
  "texto": "Cuántos renglones del material de la orden faltan por entregar al taller, completos o en parte. No cuenta los consumibles del taller cuando esa opción está encendida."
 },
 {
  "clave": "pasoApartarMaterial",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Aparta para esta orden lo que hay libre en planta de lo que le falta, hasta lo que necesita: sigue en el almacén, pero nadie más lo puede tomar. Lo que no alcanzó queda «Con faltantes»; «Volver a apartar» lo intenta otra vez cuando llega material. Pide la revisión de ingeniería primero: sin ella solo la gerencia de producción aparta, con el motivo, que queda en la orden. Si ingeniería baja o quita algo después, lo apartado de más se suelta solo."
 },
 {
  "clave": "pasoLiberarOrden",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "La gerencia de producción pasa la orden al taller: desde ese momento sale en la terminal y en la TV para trabajar sus etapas. Solo pide la revisión de ingeniería; el material y la revisión de almacén no la detienen."
 },
 {
  "clave": "pasoPedirFaltantes",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Manda a compras, en una sola requisición, lo que falta y nadie ha pedido todavía. Si después falta algo más, el botón vuelve a salir. «No hizo falta»: no faltaba nada."
 },
 {
  "clave": "pasosEnvio",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Por dónde va el envío: cada paso con quién lo hizo y cuándo; en verde, los que ya pasaron. Solo salen los que aplican: cotizar y guía son de paquetería y flete, y lo que surte Full o manda el proveedor no se empaca."
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
  "texto": "Ya salió todo lo del pedido, con su hoja de salida o con su envío. Si se marcó por error, quien entregó lo deshace en los primeros 15 minutos; después la reabren la gerencia de ventas o dirección, con el motivo."
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
  "clave": "pedidosPorProducir",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Cuántos pedidos confirmados tienen equipos con lista de materiales que todavía no tienen orden de producción."
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
  "clave": "periodoMesPasadoResultados",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "El último mes completo. Es el que abre de entrada porque ya trae sus compras y su caja chica completas; el mes en curso todavía va a medias."
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
  "clave": "periodoMetricasMto",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Cuántos días hacia atrás, contando hoy, se miden los números de esta pantalla. Lo de hoy no cambia con el periodo: las órdenes abiertas, «Lo abierto», las paradas de ahorita y la carga de preventivo de las próximas 8 semanas."
 },
 {
  "clave": "periodoPendientesEquipo",
  "modulos": [],
  "texto": "Cuántos días hacia atrás se miden lo cerrado, lo hecho a tiempo, los días para cerrar y lo que pidió cada quien. Abiertos, vencidos, días de retraso, a cuántos detiene y lo que tiene por responder son de hoy, sin importar el periodo."
 },
 {
  "clave": "periodoPreciosVentas",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Desde qué año se mide. En el primer mes el índice vale 100 y las ventas se suman desde ahí."
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
  "clave": "personasPuestoBono",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Cuántas personas tienen hoy ese puesto con objetivos (en «Personas y jefes»)."
 },
 {
  "clave": "pesoEstadoTresAnios",
  "modulos": [
   "analisis"
  ],
  "texto": "Qué parte de la venta con estado de los 3 años completos anteriores fue de ese estado. Con eso se reparte la meta sugerida."
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
  "clave": "pesoVolumetricoEnvio",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "El peso por tamaño que usan las paqueterías para cobrar cajas grandes y ligeras: largo × ancho × alto en cm ÷ 5,000 por caja (en un envío, sumado de todos los bultos)."
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
  "clave": "pestanaCobranzaPorCliente",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Lo que debe cada cliente por sus pedidos del ERP, partido por antigüedad. Clic en un cliente para ver solo sus pedidos. Lo que ya debía en la hoja está en «Saldos de arranque (hoja)»."
 },
 {
  "clave": "pestanaCobranzaPorPedido",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Cada pedido del ERP con su total, lo cobrado, el saldo y su antigüedad. Clic en uno para registrar un cobro o una factura."
 },
 {
  "clave": "pestanaCobranzaPorVendedor",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Lo que deben los clientes de cada vendedor por sus pedidos del ERP, partido por antigüedad. Clic en un vendedor para ver solo sus pedidos."
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
  "clave": "pestanaOrdenesPorPagar",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Las órdenes de compra recibidas (completas o en parte) que tienen saldo y todavía no tienen su factura registrada. En cuanto se liga su factura, lo que se debe se paga por la factura. Clic en una para registrar su pago."
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
  "clave": "pestanaPreguntasML",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Las preguntas por contestar, de la más vieja a la más nueva, y abajo las últimas 50 contestadas con lo que se tardó cada una. Lo que contestas aquí se publica en Mercado Libre."
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
  "texto": "Ciudades y estados de clientes que no se reconocieron o se ubicaron con duda; lo que no se ubica no sale en el mapa. Lo que dirección corrige aquí se queda para los clientes que vengan después."
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
  "clave": "planActivoPreventivo",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Apagado, el plan se queda guardado pero ya no genera órdenes ni sale en la lista de preventivos."
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
  "clave": "planosOrden",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Los planos con que se fabrica esta orden. Cuando ingeniería la marca como revisada, la orden se queda con la revisión vigente de ese día; si después sale otra, aquí sale en rojo para confirmarlo con ingeniería. «Abrir» lo abre en Drive."
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
  "clave": "planSalidaInventarioEnvio",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Lo que va a pasar con el inventario cuando el envío salga: qué sale y de qué almacén, o por qué no se descuenta (equipo fabricado, ya salió a mano con el pedido, no lleva inventario). En rojo lo que lo impide, como que no alcance en ese almacén o que lo libre esté apartado para otro: así no se puede empacar ni sacar, corrígelo antes."
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
  "clave": "pocasFotosML",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Publicaciones con menos de 3 fotos. Las fotos se suben en Mercado Libre: aquí solo se cuentan."
 },
 {
  "clave": "politicaPrecio",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "La regla de precio de un grupo de artículos: utilidad, recargos, medida especial, redondeo y descuento máximo. La usan los artículos de las categorías ligadas a ella (en equipos, su tipo de equipo); lo que no tiene categoría con política propia usa la de por defecto de su tipo."
 },
 {
  "clave": "politicaReventa",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Lo que se compra y se vende tal cual (componentes, materia prima…). Su utilidad es un margen sobre el precio de venta y no compensa ISR: con 30 % de margen y sin recargos, el precio es el costo ÷ 0.70."
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
  "texto": "Las que siguen abiertas: las que nadie ha tomado («sin tomar») más las que alguien ya está cotizando."
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
  "clave": "precioConEnvioCanal",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "El sugerido para una publicación con envío incluido: antes del IVA se le suma lo que cobra el envío en ese canal."
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
  "clave": "preciosQueCambianSimulacion",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Cuántos precios de lista quedarían distintos con lo que escribiste, de los artículos con costo que usan esta política (en el ISR, de todas las que lo compensan). Cuenta también los que hoy no tienen precio y lo tendrían. Los de precio fijo no entran."
 },
 {
  "clave": "preciosQueSeMovieronTablero",
  "modulos": [],
  "texto": "Equipos cuyo precio de lista de hoy es distinto al que tenían hace 30 días: los 6 que más cambiaron. Ámbar si subió, verde si bajó. Clic para abrir el equipo."
 },
 {
  "clave": "precioSugeridoCanal",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Lo que debería costar con IVA en ese canal para que, después de su comisión, llegue completo el precio de lista. Si queda abajo del umbral del canal, también se le suma su cuota fija por venta."
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
  "clave": "precioUnitarioPartidaCotizacion",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "El precio por pieza con que cotizas esta partida, en la moneda de la cotización. Llega con el precio de lista y lo puedes cambiar; si queda abajo del mínimo se pone en rojo y la cotización pasa a «Por autorizar»."
 },
 {
  "clave": "preguntas30dML",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Preguntas que llegaron en los últimos 30 días. En ámbar, las que siguen sin contestar (de cualquier fecha)."
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
  "clave": "preguntasSinContestarML",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Preguntas de compradores que nadie ha contestado, en publicaciones activas. Abajo, cuánto lleva esperando la más vieja. Entre más rápido contestes, mejor: cuenta para la reputación y para el bono de tiempo de respuesta."
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
  "clave": "prestamoParaServicio",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Si se la lleva a un servicio con cliente programado o en curso, elígelo: el préstamo queda con su folio y ya no es obligatorio escribir para qué."
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
  "texto": "La suma del siguiente pago programado de cada orden en dólares con fecha en los próximos 30 días. Incluye los que ya pasaron de su fecha y siguen sin registrarse como pagados."
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
  "clave": "promedioCobradoMes",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Lo cobrado en promedio por mes en los 12 meses de la gráfica, contando el mes en curso aunque vaya a medias."
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
  "texto": "Lo que la IA encontró al leer los correos del embarque: fechas de etapas que ya pasaron, ETA, datos y documentos que llegaron, cada uno con el correo de donde salió. Es una propuesta: nada cambia hasta que la revisas y la aplicas."
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
  "clave": "proveedorPrincipal",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "A quién se le compra normalmente. Reabasto se lo propone si el último costo no dice de qué proveedor es, y con él calcula cuánto tarda en llegar."
 },
 {
  "clave": "proveedorSinAltaXml",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "El RFC de la factura no lo tiene ningún proveedor del ERP. Al registrarla puedes darlo de alta con un clic, con el nombre y el RFC que trae la factura, o elegir uno que ya exista."
 },
 {
  "clave": "proveedorSolicitudPrecio",
  "modulos": [
   "compras"
  ],
  "texto": "Quién lo vende (es opcional). Queda como el proveedor de ese costo y, si el artículo no tenía proveedor de siempre, también como ese. Al elegirlo se ponen su moneda y sus días de entrega, si aún no escribías el costo ni la entrega."
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
  "texto": "Sale al escribir 3 letras o más: a cuántas ventas de la hoja les pega el patrón, cuántas estaban sin clasificar y, ya con familia elegida, cuántas cambiarían a esa familia. Esa cuenta no ve el orden: si una regla de número más bajo ya atrapa alguna, al guardar esa no cambia."
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
  "clave": "publicacionNoActiva",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "La publicación está pausada o cerrada en el canal: hoy no se vende por ahí."
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
  "clave": "puntosRutina",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Cuántos puntos tiene el checklist y en cuántas secciones están agrupados (Seguridad, Limpieza…)."
 },
 {
  "clave": "queContarConteo",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Qué trae la lista del conteo. Lo que piden las órdenes de producción: el material que las órdenes abiertas todavía no reciben o que está apartado, si hay en este almacén. Lo que salió en los últimos 30 días: lo que tuvo salidas de este almacén. Pegar claves: solo las que escribas. Todo el almacén: todo lo que el sistema dice que hay ahí, para un conteo general."
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
  "clave": "quienAnotoCaja",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Quién anotó el movimiento en el ERP. En lo que viene de la hoja (dice «Hoja» abajo), quién llevaba la caja ese día, tal como se escribió ahí."
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
  "clave": "quienMarcaTerminal",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Quién está marcando en la tablet: las pausas, los términos y los problemas quedan a su nombre (al iniciar, los nombres de la cuadrilla). Tócalo para cambiar de persona; la tablet lo recuerda."
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
  "clave": "quienRecibioMaterialAlmacen",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Quién se llevó el material del almacén, que no siempre es quien lo registró. En una salida a consumo es obligatorio: eliges a alguien de la gente de piso o escribes el nombre, y se queda para la siguiente salida. Así se ve cuánto consumible se lleva cada persona."
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
  "clave": "quitarFiltroCobranza",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Estás viendo solo los pedidos de este cliente o vendedor. Clic para quitar el filtro y ver todos."
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
  "clave": "rangoGraficaCosteo",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Cuánto tiempo hacia atrás ves en la gráfica y en la tabla. La frase «el costo cambió…» se mide desde el primer punto que queda a la vista."
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
  "clave": "recargoMedidaEspecial",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Porcentaje que se suma al costo, junto con los recargos sobre costo, solo en los equipos marcados como medida especial."
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
  "texto": "El día que la paquetería o el cliente pasa por el envío. Desde ese día sale en «Hoy salen o recogen» (en ámbar si sigue abierto) y, al ponerle la fecha de hoy, le llega un aviso a almacén. Se puede cambiar mientras el envío no sale."
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
  "clave": "reembolsadoML",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Lo que Mercado Libre le regresó al comprador de ese pago. En el pedido entra como un cobro en negativo."
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
  "clave": "refaccionesEntregadasOrden",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Cuántas refacciones de la orden ya entregó almacén, de todas las que se le pidieron."
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
  "clave": "requeridoOrden",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Cuánto lleva la orden según su lista. Ingeniería y la gerencia de producción lo corrigen aquí mismo (escribe y da Enter): queda en la línea de tiempo y, si baja, se suelta lo apartado de más."
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
  "clave": "resolverSolicitudOrden",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "«Ya se corrigió»: ya cambiaste la lista del equipo (este botón no la cambia). «Descartar»: no procede. En los dos casos se cierran la solicitud y el pendiente de ingeniería, y queda en la línea de tiempo de la orden."
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
  "clave": "respuestaPreguntaML",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Lo que escribas se publica en Mercado Libre tal cual (Ctrl+Enter también la manda). No pongas teléfonos, correos ni ligas: Mercado Libre lo castiga. Si la publicación ya está pausada o cerrada, no deja contestar y la pregunta sale de la lista."
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
  "clave": "resultadoComplementoPago",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Qué pasó con cada factura del complemento. Cobro registrado: se anotó en el pedido de esa factura. Ya estaba: ese pago ya se había subido. Factura no registrada: regístrala en su pedido y vuelve a subir el complemento. Sin importe: no trae monto. Rechazado: no se aceptó; al lado dice por qué."
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
  "texto": "Corre en este momento todas las reglas prendidas, sin la IA, y les avisa de una vez a quienes les tocó algo nuevo (lo urgente también va a sus Pendientes). Corre aunque la revisión nocturna esté apagada. Sirve para probar una regla nueva o ver si algo ya quedó corregido."
 },
 {
  "clave": "revisionCorrigelo",
  "modulos": [],
  "texto": "El ERP hace la corrección por ti, con tus permisos, como si la hicieras a mano. Solo sale cuando la corrección es segura (inhabilitar el artículo repetido y quedarse con el que ya existía; ligar tu cuenta a tu ficha). Si algo lo impide, te dice qué hacer primero."
 },
 {
  "clave": "revisionCuestionarBienAsi",
  "modulos": [],
  "texto": "Prendido, la IA lee el porqué de cada «Está bien así» y, si no le convence, pregunta hasta 3 veces; si sigue sin quedar claro, se queda abierto y te llega con la conversación. Apagado, el porqué lo cierra sin preguntas. Lo que contestas tú nunca pasa por la IA, ni el porqué de una compra con costo muy distinto al anterior (ese costo no le llega)."
 },
 {
  "clave": "revisionDeQuien",
  "modulos": [],
  "texto": "Filtra lo abierto: todo, lo tuyo, los patrones que solo ve dirección o lo que le toca a una persona (con cuántos tiene cada quien)."
 },
 {
  "clave": "revisionEscalado",
  "modulos": [],
  "texto": "Contestaste «Está bien así», la IA hizo sus preguntas y el porqué no quedó claro. Se queda abierto y dirección lo ve con la conversación para decidir. Si mientras tanto lo corriges, contesta «Ya lo corregí»."
 },
 {
  "clave": "revisionEstadoContestado",
  "modulos": [],
  "texto": "Corregido: alguien contestó «Ya lo corregí» («Ya lo revisé» en los patrones) o marcó hecho su pendiente, usó «Corrígelo» o aplicó la propuesta de la IA. Está bien así: no era error; abajo va el porqué. Se corrigió solo: la siguiente revisión ya no lo encontró."
 },
 {
  "clave": "revisionEstadoIA",
  "modulos": [],
  "texto": "Qué pasó con la IA esa noche. «La IA leyó»: regresó su lectura. «Esperando a la IA»: todavía no contesta. «La IA falló»: hubo un error o no regresó a tiempo (la nota dice cuál). «IA apagada»: estaba apagada o se corrió a mano, solo con reglas. «Tope del mes»: ya se usó lo permitido. «Sin IA»: no se le mandó nada (no está conectada o la corrida apenas empezaba)."
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
  "texto": "Ingeniería confirmó que la lista de materiales y las cantidades de la orden están bien. Sin esto la orden no se puede liberar, y almacén no puede apartar su material (la gerencia de producción sí, con un motivo, si es urgente). Lo que lleva un día hábil sin revisar le sale a ingeniería en «Por revisar»."
 },
 {
  "clave": "revisionLectura",
  "modulos": [],
  "texto": "Lo que la IA leyó de cada módulo la madrugada pasada, en dos o tres frases, y cuántas cosas encontraron las reglas y la IA. Si la IA no corrió (apagada, sin llave, tope del mes), lo dice."
 },
 {
  "clave": "revisionListaReglas",
  "modulos": [],
  "texto": "Para prender o apagar la revisión, la IA, que la IA cuestione el «Está bien así», los consejos y cada regla, y para correr las reglas a mano. Lo que apagas deja de buscarse desde la siguiente corrida; lo ya encontrado sigue abierto."
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
  "texto": "Lo que la revisión de la madrugada encontró en algo que tú capturaste o que te toca: un artículo o cliente que parece dado de alta dos veces, un pago repetido, una compra que ya debió llegar, un costo muy distinto al de la última vez. Contesta cada uno: lo que dices que está bien así ya no vuelve a salir."
 },
 {
  "clave": "revisionPatron",
  "modulos": [],
  "texto": "Algo que conviene preguntar, no un error de una persona: un consumo que se dispara, ajustes a la baja que se repiten en el mismo artículo, el mismo gasto de caja chica varias veces. Solo lo ve dirección, con su evidencia; puede tener una explicación normal (un trabajo especial, un gasto fijo)."
 },
 {
  "clave": "revisionPlano",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "La letra de la revisión: A la primera, B la siguiente… En verde la vigente, con la que se fabrica; en amarillo la que está por aprobar; en gris las anteriores. Un plano aprobado ya no se edita: se saca una revisión nueva."
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
  "texto": "Todo lo que la revisión encontró y nadie ha contestado, de todas las personas. Lo de otra persona dice en amarillo «Le toca a …»: es suyo, aunque tú también lo puedes contestar desde aquí. Con «De quién» ves solo lo tuyo, los patrones o lo de una persona."
 },
 {
  "clave": "revisionYaLoCorregi",
  "modulos": [],
  "texto": "Dices que ya lo arreglaste en su pantalla: se cierra como corregido y, si también estaba en tus Pendientes, ahí queda hecho. Si es algo que la revisión vuelve a medir cada noche (un artículo o cliente repetido, una cuenta sin ficha, una compra sin recibir) y sigue igual, vuelve a salir en la siguiente revisión. En los patrones dice «Ya lo revisé»."
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
  "texto": "Las máquinas cuyo plan preventivo activo usa esta rutina. Mientras algún plan activo la use, no se puede desactivar: primero cámbiale la rutina al plan."
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
  "texto": "Lo que queda en la cuenta de prepago de cada paquetería: recargas menos lo que costaron sus guías (las de envíos cancelados no cuentan). En rojo, abajo del mínimo: le llega un aviso a la gerencia de ventas, a la administrativa, a finanzas y a quien generó guías ahí en el último mes. Si registras recargas, dale clic a una para registrar la suya."
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
  "texto": "Lo que Skydropx dice que queda en su cuenta, junto al saldo calculado (recargas menos guías). En ámbar si no cuadran: falta registrar una recarga o un cargo que Skydropx hizo por su cuenta, como un sobrepeso."
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
  "clave": "saleEntraCaja",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "«Sale» es un gasto pagado con efectivo de la caja: baja el saldo. «Entra» es una reposición, dinero que se mete a la caja: sube el saldo. Escribe el concepto y el monto y dale Enter."
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
  "clave": "seccionPuntoRutina",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Agrupa los puntos en el checklist (Seguridad, Limpieza, Eléctrico…). Escribe una nueva o elige una que ya usaste en esta rutina."
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
  "texto": "Su última compra fue hace 12 a 24 meses y compraban seguido (2 o más veces en 3 años) o mucho (en la mitad que más compró en esos 3 años)."
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
  "clave": "seQuedoML",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Lo que se quedó Mercado Libre de cada pago: su comisión (según la categoría y el tipo de publicación), lo que nos descontó por el envío (el envío gratis lo paga la cuenta) y otros cargos. Sale del desglose de Mercado Pago; si el pago se reembolsó, ya sin lo que Mercado Libre devolvió de esos cargos. Las retenciones van aparte: son impuestos."
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
  "clave": "serieAlCrearOrden",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Déjalo vacío: si la orden es de una sola pieza y el equipo tiene su código, el ERP le pone el número de serie solo. Escribe uno solo si debe llevar otro; no puede repetir el de otra orden."
 },
 {
  "clave": "serieAlEditarOrden",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Corrige el número de serie a mano; no puede repetir el de otra orden. Si lo borras, la orden queda sin serie y con «Asignar» saca el siguiente de su familia."
 },
 {
  "clave": "serieEquipoEmpaque",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "El número de la placa de cada equipo, uno por equipo. Si salió de una orden de producción, tiene que ser el de esa orden y la orden tiene que estar terminada; el mismo número no puede salir dos veces."
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
  "clave": "sinLigarTableroML",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Publicaciones que el ERP todavía no sabe qué artículo son, así que no tienen precio sugerido ni existencia en planta con qué compararse. Se ligan solas con su primera venta si su SKU es la clave del ERP; si no, en «Por ligar» cuando se vendan."
 },
 {
  "clave": "sinNombreCuadrilla",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Para alguien sin alta en Personal o un ayudante de paso: se cuenta sin nombre y sus horas suman igual en las horas hombre."
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
  "clave": "sinPrecioListaCatalogo",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Este artículo todavía no tiene precio de lista, así que no lo des por teléfono. El vendedor se lo pide a compras con «Pedir precio» y le contestan con el precio y la entrega."
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
  "texto": "Al día: todavía no toca. Por vencer: ya entró en los días de aviso de su plan (cuando sale su orden) o ya lleva 90 % de sus horas. Vencido: ya pasó la fecha o llegó a las horas."
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
  "texto": "«Publicado» es el precio que tiene hoy su publicación en Mercado Libre. «Sugerido sin envío» es el que habría que poner allá para que llegue completo el precio de lista: el precio de lista con IVA más la comisión de Mercado Libre (y su cuota fija si es barato); «Sugerido con envío» suma además lo que se paga por el envío."
 },
 {
  "clave": "sumaCotizacionesSinIva",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Lo que suman las cotizaciones de la lista con el filtro de ahora, todo en pesos y sin IVA (las de dólares, con su tipo de cambio), para poder sumar pesos y dólares."
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
  "clave": "tablaMetricasPorMaquina",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Los mismos indicadores de arriba, máquina por máquina, de la que más horas estuvo parada a la que menos. Con clic en el nombre abres su ficha."
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
  "clave": "tarifasGuiaSkydropx",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Lo que cobra cada paquetería por esta ruta y estos bultos, ya con IVA, de la más barata a la más cara, y los días que tarda. Elige una (con doble clic pasas directo a confirmar); todavía no se cobra nada."
 },
 {
  "clave": "tarjetaEnvioPedido",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Los envíos de este pedido: en qué paso va cada uno, su guía y lo que costó. Dale clic a uno para ver su evidencia de salida (fotos, check list y número de serie)."
 },
 {
  "clave": "tarjetasDelResumen",
  "modulos": [],
  "texto": "Cada tarjeta es algo que conviene ver. El ícono dice qué tan urgente es: rojo, un riesgo; ámbar, pide atención; verde, va bien; morado, para que lo sepas. Dale clic para ir a donde se atiende."
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
  "clave": "tasaIvaEmpresa",
  "modulos": [
   "admin"
  ],
  "texto": "La tasa de IVA con que nacen las cotizaciones y los pedidos nuevos: 16 % general, 8 % en la región fronteriza. Los que ya están hechos guardan su propia tasa y no cambian."
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
  "clave": "terminalEnOtraEtapa",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Órdenes que todavía están en una etapa anterior (la tarjeta dice cuál). Si hace falta adelantar, se pueden empezar aquí sin esperar."
 },
 {
  "clave": "terminalListasParaEmpezar",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Órdenes que ya pueden empezar en esta etapa: las etapas anteriores ya terminaron (o esta va en paralelo, como Torno). Van en el orden que acomoda la gerencia en Cuadrillas o en el Gantt."
 },
 {
  "clave": "terminalTrabajandoAhora",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Lo que ya se inició en esta etapa, esté trabajándose o pausado, en el orden de la fila del taller."
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
  "clave": "tiempoEntregaArticulo",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Días hábiles que tarda en llegar desde que se le pide al proveedor. Si lo dejas vacío, la ficha de venta muestra el del proveedor. Para reabastecer, si el proveedor ya tiene embarques que llegaron a planta, manda lo que tardaron de verdad."
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
  "texto": "Cuánto se tardan en contestar las preguntas de Mercado Libre (la mediana de los últimos 30 días) y qué parte se contestó en menos de una hora, contando horas de reloj: lo que llega de noche cuenta desde que llegó. El bono de tiempo de respuesta se mide distinto: solo cuenta las horas del horario de trabajo y su plazo es de 2 horas (o el que diga la plantilla de tu puesto), así que una pregunta de la noche contestada temprano no te cuenta en contra."
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
  "clave": "tipoCatalogoVenta",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Equipo: una máquina que fabrica el taller, como banda transportadora, cribadora, silo o elevador. Componente: una pieza que se vende sola, como polea, cangilón, catarina o colector."
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
  "clave": "tipoDeEnvio",
  "modulos": [
   "inventario",
   "envios"
  ],
  "texto": "Cómo llega al cliente: por paquetería (con guía), por flete (transportista, para equipo o bultos grandes), lo recoge el cliente en planta, lo surte Full desde la bodega de Mercado Libre o lo manda el proveedor directo. «Envío a Full» es mercancía nuestra que va a reabastecer la bodega de Mercado Libre."
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
  "clave": "tipoMaquinaCatalogo",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Máquina, herramienta, vehículo, instalación o equipo de oficina. La herramienta siempre se puede prestar con resguardo."
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
  "texto": "Los clientes que más compraron en el periodo. La primera cifra chica es lo que pesa cada uno en la venta; la segunda, lo que juntan del primero hasta él. Si hay más de 10, «Ver 15» muestra más; clic en uno para abrir su ficha."
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
  "clave": "ultimaVueltaML",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Lo que hizo la última vez que corrió solo: cuántos cambió, cuántos dejó sin tocar, cuántos dieron error y cuántos esperan a la siguiente vuelta, porque cada una hace hasta 30. Si falló, sale el error en rojo."
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
  "clave": "ultimoPreventivoHecho",
  "modulos": [
   "servicio",
   "mantenimiento"
  ],
  "texto": "Cuándo se hizo por última vez y con cuántas horas de uso. De ahí se cuenta el siguiente. Al cerrar cada preventivo de este plan se actualiza solo."
 },
 {
  "clave": "ultimosCambiosMargenes",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Los 12 cambios más recientes a políticas de precio, tarifas de mano de obra, categorías, tipos de cambio y configuración (el ISR, el tipo de cambio de costeo…), con quién y cuándo. Solo dirección y sistemas lo ven; «Ver bitácora» trae todo."
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
  "clave": "usoEnVivo",
  "modulos": [
   "admin"
  ],
  "texto": "La pantalla está escuchando lo que pasa ahorita: cada vez que alguien registra un cambio o usa una pantalla, su cuadro de hoy en el mapa se enciende, sin recargar. Solo llega quién fue y si fue un cambio o una pantalla; las cifras se ponen al día unos segundos después."
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
  "clave": "utilidadOperacionResultados",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Ventas menos costo de fabricación y gastos de operación, antes de restar impuestos e intereses."
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
  "modulos": [
   "costeo",
   "margenes"
  ],
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
  "clave": "vendidoFamiliaPeriodo",
  "modulos": [
   "costeo",
   "margenes"
  ],
  "texto": "Lo vendido de esa familia en el periodo, con IVA y en pesos. Antes del arranque del ERP sale del libro de ventas de la hoja (solo ventas desde $40,000, clasificadas por su descripción); después, de los pedidos del ERP que no se cancelaron."
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
  "texto": "Importe con IVA de lo vendido, con la misma regla que el tablero de inicio: hasta el arranque del ERP, el libro de ventas de la hoja; desde entonces, los pedidos del ERP sin los cancelados. Las de Mercado Libre sin pedido salen de lo que pagó el comprador."
 },
 {
  "clave": "ventaFullML",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Esta venta sale de la bodega de Mercado Libre (Full): no se surte en planta."
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
  "clave": "ventas30dML",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Ventas de los últimos 30 días, sin las canceladas. Si en alguna se compró más de una, junto sale cuántas se vendieron en total («u.»)."
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
  "texto": "Cada pedido que trajo este artículo (sin los cancelados), con el precio por pieza ya con su descuento. Compáralo con el precio de lista que regía ese día en la gráfica de arriba: así ves si los cambios de precio se notaron al vender."
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
  "texto": "Ventas que no cayeron en ninguna familia: textos de la hoja que ninguna regla atrapó y partidas del ERP sin familia en su categoría ni en su texto; también las de Mercado Libre sin pedido, que no dicen qué se vendió. El porcentaje clasificado es sobre el dinero del periodo; mientras más alto, más confiables las gráficas por familia. La lista «Sin clasificar» junta los textos de toda la historia de la hoja."
 },
 {
  "clave": "ventaSinUbicar",
  "modulos": [
   "analisis"
  ],
  "texto": "Venta de clientes cuyo estado o ciudad no se reconoció: cuenta en el total pero no sale en el mapa. Se arregla en «Ubicaciones por revisar». En todo el país también junta las ventas de Mercado Libre sin pedido, que no traen cliente."
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
  "clave": "ventasPorMesInicio",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Lo vendido cada mes en pedidos sin cancelar, sin IVA y en pesos, apilado por línea: Maquinaria, Refacciones u Otros (fletes, servicios, instalaciones). Cuenta los pedidos capturados en el ERP y los que se trajeron de los paneles de vendedores de la hoja. No cuenta el libro de ventas de la hoja ni las ventas de Mercado Libre que solo llegaron como pago de Mercado Pago, porque no vienen separadas por línea. Si eres vendedor, solo ves tus pedidos y los que compartes. Por eso no cuadra con el tablero de dirección en los mismos meses: allá las cifras van con IVA, entran esas dos y no entran los pedidos de los paneles. El «Año» de junto sale de los mismos pedidos, del 1 de enero a hoy."
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
  "clave": "verPartidasSurtido",
  "modulos": [
   "produccion",
   "procesos"
  ],
  "texto": "Qué salió en ese surtido: cada material, cuánto y de qué almacén. «Fuera de lista»: no venía en la lista; «Al taller»: un consumible que salió a nombre de quien lo recibió."
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
  "clave": "visitasSinVentasML",
  "modulos": [
   "ventas",
   "leads",
   "catalogo",
   "mercadolibre"
  ],
  "texto": "Publicaciones con 50 visitas o más en 30 días y ninguna venta: la gente las ve y no compra. Revisa el precio, las fotos y la descripción."
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
  "clave": "vistaPreviaCartera",
  "modulos": [
   "admin"
  ],
  "texto": "Cuántos clientes vigentes y vencidos tiene cada vendedor con los plazos ya guardados, no con lo que estás escribiendo: guarda para recalcularla. Los vencidos son los que se liberarían cada noche con la regla encendida."
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
  "clave": "yaSePagoContado",
  "modulos": [
   "rrhh",
   "nomina",
   "objetivos",
   "finanzas",
   "caja_chica",
   "mi_desempeno"
  ],
  "texto": "Márcalo si la factura ya se pagó de contado: elige de qué cuenta salió y el pago se anota en el mismo paso, con la fecha de la factura, sin dejar nada por pagar. Viene marcado cuando el XML dice de contado (PUE)."
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

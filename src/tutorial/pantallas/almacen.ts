import type { AyudaPantalla } from "./index";

// Arriba de cada pantalla solo va para qué sirve y lo mínimo para trabajar; cada botón, columna y
// filtro ya trae su globo (glosario de almacén). El «detalle» conserva todas las reglas porque el
// asistente lo lee como manual: si se quita de aquí, el asistente deja de saberlo.
// Existencias y Envíos los ven también vendedores: aquí no se habla de costos ni de márgenes.
export const ALMACEN: Record<string, AyudaPantalla> = {
  "/almacen/existencias": {
    resumen: "Cuánto hay de cada componente y materia prima, en qué almacén y cuánto ya está apartado: para saber si algo se surte sin ir al estante.",
    pasos: [
      "Busca por clave o nombre, o elige un filtro: Con existencia, Apartados, Negativos o Todos.",
      "Fíjate en la columna Disponible: es lo que de verdad se puede usar hoy.",
      "Dale clic a un renglón para ver el artículo por almacén y para qué está apartado.",
    ],
    detalle: [
      "Disponible es lo que hay en planta menos lo apartado. Lo del Full de Mercado Libre existe, pero no cuenta para planta. Un número en rojo es existencia negativa: salió algo cuya entrada nunca se registró, y se corrige con un conteo y un ajuste.",
      "Si tu puesto ve compras o finanzas, también ves la columna Tránsito y el filtro En tránsito: lo que viene en órdenes de compra enviadas que todavía no llegan.",
      "El selector de almacén deja solo lo que hay en ese almacén. El panel del artículo se abre a un lado: cuánto hay en cada almacén, para qué orden o pedido está apartado y, si tu puesto lo ve, su kardex.",
      "«Registrar entrada o salida» te lleva a Entradas y salidas; desde el panel del artículo llegas con el artículo ya elegido. El botón de CSV baja la lista para Excel. La tabla se actualiza sola cuando alguien registra un movimiento.",
    ],
  },
  "/almacen/movimientos": {
    resumen: "Aquí almacén registra lo que sale, regresa o cambia de almacén, desde el celular o la computadora, y consulta la historia; la gerencia entra a autorizar ajustes.",
    pasos: [
      "En Registrar elige Salida, Devolución o Traspaso y busca el artículo.",
      "Toca el almacén (cada botón dice cuánto hay), escribe la cantidad y Enter.",
      "Escribe el motivo (en un consumo, también quién lo recibe) y Enter guarda.",
    ],
    detalle: [
      "En una salida eliges si es Consumo (taller, EPP, plasma…) o Venta (mostrador, ML). En un consumo también anotas quién lo recibe; el nombre se queda para la siguiente salida. En un traspaso eliges a qué almacén entra. No deja sacar más de lo que hay en ese almacén.",
      "Los botones de motivo llenan el texto por ti. A la derecha, «Lo que registraste hoy» enseña tus movimientos del día para que confirmes que quedaron bien. La fecha, la hora y tu nombre los pone el sistema: no se puede capturar con fecha atrasada ni a nombre de otro.",
      "Nada se edita ni se borra. Si te equivocaste en una salida o un traspaso que registraste tú, en «Lo que registraste hoy» tienes unos minutos para «Deshacer», con el motivo (15 de inicio; los fija dirección en Configuración y el botón dice cuántos quedan).",
      "Deshacer deja el movimiento contrario ligado al original (sale como «corrección» y el original como «deshecho»), con tu nombre y la hora, y el consumo se compensa. Un traspaso solo regresa si lo que llegó sigue en el destino.",
      "Pasado ese tiempo, o si lo registró otra persona, no lo vuelvas a capturar al revés: pide un ajuste. Lo surtido a una orden, lo recibido de una compra, las entregas de pedidos y los envíos se corrigen desde su propia pantalla.",
      "Historial filtra por tipo, almacén, persona y fechas (al abrir, los últimos 30 días) y se baja a Excel. «Recibió» es quién se llevó el material; «Quién» es quién lo registró. Registrar solo sale si tu puesto captura almacén; Historial, si capturas almacén o tienes permiso de costos.",
      "En Ajustes pides una corrección cuando lo del estante no cuadra, y la gerencia la aprueba o la rechaza; hasta entonces la existencia no cambia.",
      "En Conteos físicos abres un conteo por almacén con «Empezar a contar», capturas cada artículo en cuanto lo cuentas (Enter guarda y baja al siguiente) y, al cerrarlo, cada diferencia se vuelve un ajuste por autorizar.",
    ],
  },
  "/almacen/reabasto": {
    resumen: "Qué componentes y materias primas hay que pedir, cuánto y por qué. Compras la usa para generar órdenes de compra y almacén para pedirle material a compras.",
    pasos: [
      "Revisa el filtro «A ordenar»: lo que quedó abajo de su punto de reorden.",
      "Marca las casillas de lo que quieres pedir; la de arriba marca todos los sugeridos.",
      "Dale «Generar órdenes de compra» o, si eres de almacén, «Pedir a compras».",
    ],
    detalle: [
      "La pantalla abre en «A ordenar» si hay algo abajo de su punto de reorden; si no, en «Todos». Los otros filtros son Importados, Excedentes y Negativos. Solo se pueden marcar los artículos que tienen sugerido.",
      "«Generar órdenes de compra» lo tiene quien captura compras: salen en borrador, separadas por proveedor, y lo que no tiene proveedor no se pide y te lo enlista. «Pedir a compras» lo tiene almacén: sale una requisición.",
      "Si algo ya está en una orden en borrador o en una requisición, se ve debajo del sugerido para que no lo pidas dos veces.",
      "La regla es la de la hoja Demanda: un artículo genera demanda si tuvo consumo en suficientes meses de los últimos seis, y su demanda es el promedio de esos meses. El punto de reorden es la demanda de los días que tarda en llegar más el stock de seguridad.",
      "Si el disponible (en planta − apartado + en tránsito) queda abajo, se sugiere el lote (1 mes de cobertura si es nacional, 6 si es importado) más lo que falta para el punto de reorden, redondeado al empaque.",
      "La regla vigente está al pie de la tabla y el botón «¿por qué?» hace la cuenta con los números de cada artículo.",
      "Cobertura y Seguridad se cambian ahí mismo si tu puesto puede: escribe y Enter guarda; vacío regresa al valor normal. Los días de entrega son los reales del proveedor cuando ya hay historia.",
      "Excedente es lo que no se usó en 12 meses, sigue en el estante y no tiene stock de seguridad.",
      "El cálculo sale de los movimientos de almacén: si tu puesto ve existencias pero no movimientos, aquí no ves la lista y te manda a Existencias.",
    ],
  },
  "/almacen/metricas": {
    resumen: "Cómo anda el almacén: la salud del inventario hoy y lo que se movió en el periodo. La usan almacén, compras, la gerencia de producción y dirección.",
    pasos: [
      "En «Salud del inventario», dale clic a un pedazo de la barra o de la matriz.",
      "Baja esa lista a Excel y actúa: rematar, devolver, no volver a pedir o pedir ya.",
      "En «Movimiento del periodo», elige el periodo y revisa la tabla «Fuera de lista».",
    ],
    detalle: [
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
      "Abajo están los ajustes del periodo y los que esperan autorización, los conteos cerrados con cuántos renglones no coincidieron (clic en uno lo abre) y cuántos movimientos registró cada persona. Los montos solo los ve quien tiene acceso a costos.",
    ],
  },
  "/almacen/envios": {
    resumen: "Sigue cada envío del pedido a la puerta del cliente: ventas lo pide, cotiza y saca la guía; almacén lo empaca con evidencia y marca la salida.",
    pasos: [
      "Abre la pestaña de tu paso: Por cotizar y guía, Por empacar u Hoy salen o recogen.",
      "Dale clic a un envío: arriba ves cada paso y el botón de lo que sigue.",
      "Para empacar, sube fotos, palomea el check list y dale «Marcar empacado».",
    ],
    detalle: [
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
      "Si el PDF tarda, el envío lo dice y «Revisar guía de Skydropx» lo trae sin volver a cobrar. «Cotizar a mano» y «Registrar guía a mano» quedan por si Skydropx falla; en un flete los botones dicen «Cotizar» y «Registrar guía».",
    ],
  },
};

import type { AyudaPantalla } from "./index";

// Lo ven dirección y la gerencia de ventas: solo venta, clientes y metas, nunca costos ni márgenes.
// Cada cifra, pestaña y botón ya trae su globo (glosario de análisis): arriba queda solo para qué
// sirve la pantalla y lo mínimo para usarla; en «detalle», el resto de las reglas, porque el
// asistente lee esto como su manual y lo que aquí no está, no lo sabe.
export const ANALISIS: Record<string, AyudaPantalla> = {
  "/analisis": {
    resumen: "El mapa de ventas de dirección y gerencia de ventas: dónde se vende y dónde se dejó de vender, por estado y por municipio.",
    pasos: [
      "Elige el periodo arriba y qué pinta el mapa: venta, clientes, ticket promedio o crecimiento.",
      "Dale clic a un estado para ver sus municipios; «México» te regresa a todo el país.",
      "Revisa «Zonas que se enfriaron» y llama a los clientes que dejaron de comprar.",
    ],
    detalle: [
      "El periodo se queda al cambiar de pestaña. Todo se compara contra el periodo anterior: el mismo tramo del año pasado si el periodo es de un año o menos; si es más largo, un tramo igual de largo justo antes.",
      "El botón de tabla junto al ranking muestra todos los renglones, con CSV para Excel.",
      "«Zonas que se enfriaron» junta los lugares que cayeron 30 % o más, con los clientes que dejaron de comprar para llamarles.",
      "La venta es con IVA y sale de la misma regla que el tablero de inicio. Lo de clientes sin ubicar o del extranjero cuenta en el total pero no sale en el mapa; lo sin ubicar se arregla en «Ubicaciones por revisar».",
    ],
  },
  "/analisis/tendencias": {
    resumen: "La venta mes a mes desde 2018, para ver estacionalidad, crecimiento y qué familias pesan cada año.",
    pasos: [
      "En «Venta por mes», compara la línea de este año contra la del año pasado.",
      "Usa el botón de tabla de cada gráfica para ver los números o copiarlos.",
    ],
    detalle: [
      "Esta pestaña no usa el periodo: siempre muestra toda la historia.",
      "En la comparación año contra año el mes en curso no se dibuja hasta que cierre, porque a medias parecería una caída.",
      "«Venta de los últimos 12 meses» y «Crecimiento anual móvil» quitan la estacionalidad: cada punto suma o compara 12 meses completos.",
      "La mezcla por familia usa las reglas de «Producto × región»: en las ventas de la hoja la familia sale del texto de cada venta; en los pedidos del ERP, de la categoría del artículo.",
    ],
  },
  "/analisis/clientes": {
    resumen: "Cuánto depende la venta de pocos clientes, quiénes regresan y a quiénes se está perdiendo, para decidir a quién buscar.",
    pasos: [
      "Elige el periodo arriba: los cuadros, el Pareto y los que más compraron lo usan.",
      "Abajo, elige un segmento (de entrada «En riesgo») para ver la lista con su vendedor.",
      "Dale clic a un renglón para abrir la ficha del cliente.",
    ],
    detalle: [
      "Los segmentos se calculan al último día del periodo.",
      "«Clientes nuevos y recurrentes por año» y las cohortes usan toda la historia, no el periodo.",
      "Las cohortes dicen qué parte de los clientes de cada año volvió a comprar después; pasa el mouse por una celda para ver cuántos clientes son.",
    ],
  },
  "/analisis/producto": {
    resumen: "Qué familia de producto se vende en cada región, para saber qué ofrecer dónde.",
    pasos: [
      "En la matriz, cambia entre «Mezcla del estado» (porcentajes) y «Monto» (pesos).",
      "Dale clic a un estado para ver qué se vende ahí, o a una familia para su mapa.",
    ],
    detalle: [
      "La matriz cruza las familias con los 12 estados que más venden. En «Mezcla del estado» cada columna suma 100 %; en «Monto», son pesos. Al elegir un estado, abajo ves también en qué municipios se vende.",
      "Las ventas de la hoja solo traen texto, así que se clasifican con reglas de familia; abajo están las reglas y lo que quedó sin clasificar, de más a menos dinero.",
      "Solo dirección agrega reglas, y antes de guardar ve a cuántas ventas les pegaría.",
    ],
  },
  "/analisis/planeacion": {
    resumen: "La meta del año repartida por mes y por estado, contra lo vendido: dice a qué ritmo hay que vender lo que falta.",
    pasos: [
      "Elige el año con las flechas.",
      "Si eres de dirección, escribe la meta (acepta «32 M») y Enter la guarda.",
      "Para probar, escribe cuánto crecer en «Escenario»; dirección lo pasa con «Usar como meta» y Guardar.",
    ],
    detalle: [
      "Dirección captura la meta. El escenario calcula una meta creciendo un porcentaje sobre el año anterior, y «Usar como meta» la copia a la casilla.",
      "La meta de cada mes sale de lo que pesó ese mes en los últimos 3 años completos, y la de cada estado, de lo que pesó cada estado.",
      "«Cierre a este ritmo» proyecta el año con lo que se va arriba o abajo del anterior a la misma fecha, igual que el tablero de inicio.",
    ],
  },
  "/analisis/entregas": {
    resumen: "Si cumplimos lo que prometemos: qué parte de los pedidos se entregó a tiempo y qué órdenes del taller ya no llegan a su fecha.",
    pasos: [
      "Revisa «Lo que viene»: en rojo, las órdenes que ya no llegan a su fecha.",
      "Dale clic a una para abrir su pedido y avisa al cliente a tiempo.",
      "Bájala en CSV para revisarla con producción.",
    ],
    detalle: [
      "Arriba, cuántos pedidos con fecha compromiso en el periodo se entregaron a tiempo y con cuánto atraso los que no; abajo, por mes, por vendedor y por familia de equipo.",
      "«Lo que viene» es lo más útil: cada orden del taller con la fecha a la que sale de verdad. Una orden para stock, sin pedido, abre la orden de producción.",
      "La fila va por fecha compromiso: cada orden sale cuando la etapa más cargada acaba lo prometido antes que ella más lo suyo, con la capacidad semanal de cada área (la calcula el ERP con la gente asignada). Las órdenes en espera no cuentan.",
      "La fecha a la que sale cambia cada día con lo que el taller termina y lo que entra.",
    ],
  },
  "/analisis/capacidad": {
    resumen: "Si prometemos más de lo que el taller saca, todo en semanas de la etapa más cargada para compararlo con el calendario.",
    pasos: [
      "En la primera gráfica, busca los meses donde la barra pasa la línea: ahí no cabe.",
      "En la segunda, compara lo que entra con lo que sale: si entra más, la fila crece.",
    ],
    detalle: [
      "La etapa más cargada es la que más trabajo tiene en fila contra su gente.",
      "La primera gráfica dice cuánto trabajo se prometió para cada mes contra las semanas que tiene el mes; «Ya vencido» es lo que debió salir y sigue en el taller. La segunda, lo que entra y sale del taller cada mes.",
      "«Se pone al día» es cuándo acabaría el taller todo lo que tiene si no entrara nada más.",
      "Para acortar la fila hay que sacar más (gente, horas extra, maquila) o prometer con la fecha realista que da el cotizador.",
    ],
  },
  "/analisis/ubicaciones": {
    resumen: "Las ciudades y estados escritos a mano en las fichas de clientes que no se reconocieron: mientras no se ubiquen, su venta no sale en el mapa.",
    pasos: [
      "Empieza por el filtro «Por resolver»: lo que más se vendió va primero.",
      "Si eres de dirección, elige el municipio correcto o confirma el sugerido con ✓.",
      "Si no es un lugar (por ejemplo «Varios»), dale «No se puede».",
    ],
    detalle: [
      "Los filtros separan lo que hay que resolver, lo que hay que confirmar y lo que falta capturar en la ficha del cliente.",
      "Solo dirección corrige. Lo que elige se aplica a todos los clientes que lo escribieron igual; «No se puede» lo saca de la lista.",
      "Clic en el número de clientes para ver quiénes son.",
      "Lo corregido queda en «Corregidas por dirección», donde se puede deshacer.",
    ],
  },
};

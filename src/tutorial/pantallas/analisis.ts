import type { AyudaPantalla } from "./index";

// Lo ven dirección y la gerencia de ventas: solo venta, clientes y metas, nunca costos ni márgenes.
export const ANALISIS: Record<string, AyudaPantalla> = {
  "/analisis": [
    "El mapa de ventas de dirección y gerencia de ventas: dónde se vende y dónde se dejó de vender, por estado y por municipio.",
    "Elige el periodo arriba (se queda al cambiar de pestaña) y qué pinta el mapa: venta, clientes, ticket promedio o crecimiento. Clic en un estado para ver sus municipios; «México» te regresa. El botón de tabla junto al ranking muestra todos los renglones, con CSV para Excel.",
    "Todo se compara contra el periodo anterior: el mismo tramo del año pasado si el periodo es de un año o menos. «Zonas que se enfriaron» junta los lugares que cayeron 30 % o más, con los clientes que dejaron de comprar para llamarles.",
    "La venta es con IVA y sale de la misma regla que el tablero de inicio. Lo de clientes sin ubicar o del extranjero cuenta en el total pero no sale en el mapa; lo sin ubicar se arregla en «Ubicaciones por revisar».",
  ],
  "/analisis/tendencias": [
    "La venta mes a mes desde 2018, para ver estacionalidad, crecimiento y qué familias pesan cada año. No usa el periodo: siempre muestra toda la historia.",
    "Cada gráfica tiene su botón de tabla para ver los números o copiarlos. En la comparación año contra año el mes en curso no se dibuja hasta que cierre, porque a medias parecería una caída.",
    "«Últimos 12 meses» y «Crecimiento anual móvil» quitan la estacionalidad: cada punto suma o compara 12 meses completos. La mezcla por familia sale del texto de cada venta, con las reglas de «Producto × región».",
  ],
  "/analisis/clientes": [
    "Cuánto depende la venta de pocos clientes, quiénes regresan y a quiénes se está perdiendo, para decidir a quién buscar.",
    "Los cuadros, la curva de Pareto y los que más compraron usan el periodo de arriba. Los segmentos se calculan al último día del periodo: elige uno (de entrada «En riesgo») y abajo sale la lista con su vendedor; clic en un renglón abre la ficha del cliente.",
    "Las cohortes dicen qué parte de los clientes de cada año volvió a comprar después; pasa el mouse por una celda para ver cuántos clientes son.",
  ],
  "/analisis/producto": [
    "Qué familia de producto se vende en cada región, para saber qué ofrecer dónde.",
    "La matriz cruza las familias con los 12 estados que más venden. En «Mezcla del estado» cada columna suma 100 %; en «Monto», son pesos. Clic en un estado para ver qué se vende ahí y en qué municipios; clic en una familia para ver su mapa.",
    "Las ventas de la hoja solo traen texto, así que se clasifican con reglas de familia; abajo están las reglas y lo que quedó sin clasificar, de más a menos dinero. Solo dirección agrega reglas, y antes de guardar ve a cuántas ventas les pegaría.",
  ],
  "/analisis/planeacion": [
    "La meta del año repartida por mes y por estado, contra lo vendido: dice a qué ritmo hay que vender lo que falta.",
    "Dirección captura la meta (acepta «32 M») y Enter guarda; el escenario calcula una meta creciendo un porcentaje sobre el año anterior y «Usar como meta» la copia. Con las flechas cambias de año.",
    "La meta de cada mes sale de lo que pesó ese mes en los últimos 3 años completos, y la de cada estado, de lo que pesó cada estado. «Cierre a este ritmo» proyecta el año con lo que se va arriba o abajo del anterior a la misma fecha, igual que el tablero de inicio.",
  ],
  "/analisis/ubicaciones": [
    "Las ciudades y estados escritos a mano en las fichas de clientes que no se reconocieron. Mientras no se ubiquen, su venta no sale en el mapa.",
    "Los filtros separan lo que hay que resolver, lo que hay que confirmar y lo que falta capturar en la ficha del cliente. Dirección elige el municipio correcto (o confirma el sugerido con ✓) y se aplica a todos los clientes que lo escribieron igual; «No se puede» lo saca de la lista (por ejemplo «Varios»).",
    "Clic en el número de clientes para ver quiénes son. Lo corregido queda en «Corregidas por dirección», donde se puede deshacer.",
  ],
};

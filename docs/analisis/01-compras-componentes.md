# Análisis de la hoja "Costo y actualizaciones de los componentes 2.0"

- **spreadsheetId:** `1yMB2r3KAPPpIBghyd8qzB-dgmpxPiq1fs1lY03smRxw`
- **Fecha de lectura:** 2026-10-03 (solo lectura; no se modificó nada).
- **Método:** lectura de encabezados y fórmulas (`userEnteredValue`) de cada pestaña. En las pestañas grandes se bajaron completas las columnas clave para perfilarlas con Python (conteos, duplicados, formatos). Los volcados JSON quedaron en `scratchpad/analisis/raw/` (`lc.json`, `act.json`, `ord.json`, `lca.json`, `reg.json`, `prov.json`) por si sirven para probar el importador.
- Todas las cifras de este documento salen de esos volcados; cuando algo es una inferencia, lo digo explícitamente.

---

## 0. Resumen ejecutivo

1. **Así funciona el sistema.** El comprador captura cada precio nuevo como una fila más en **ACTUALIZACIONES**, que es un historial de solo agregar (15,032 registros, 2011–02/10/2026; casi todo desde 2019). **ListaComponentes** es el catálogo maestro (4,073 artículos). Sus columnas de costo, fecha, proveedor y tiempo de entrega son **fórmulas que toman la última fila de ACTUALIZACIONES** de ese nombre. El precio de venta sugerido es `costo / (1 − 0.30)`.
2. **El nombre es la llave.** No hay SKU. Todo se une por el **texto exacto del nombre del componente**, aquí y en los otros archivos (inventario, costeo). El "Número de Ítem" es un consecutivo manual con duplicados y huecos. Renombrar un artículo rompe el historial y el costeo, y la propia hoja lo advierte en la fila 1.
3. **Faltan datos que el ERP necesita.** No hay categorías, moneda, tipo de cambio ni IVA separado. Todo costo está en **MXN sin IVA**. Las importaciones se costean a mano en pestañas sueltas y solo el resultado final se captura como costo.
4. **El stock bajo y el punto mínimo no se calculan aquí.** Se calculan en el archivo de inventario (`1sOh_…`, pestaña `Demanda`). Esta hoja solo los recibe por IMPORTRANGE (`ListaComponentesAlmacen`, `STOCKS BAJOS 2.0`) y le devuelve al inventario la lista de costos, el tiempo de entrega y las órdenes.
5. **Órdenes** son las órdenes de compra: 9,893 renglones y 3,747 números de OC, de 03/2021 a 09/2026, con status, proveedor, factura y vencimiento o pago.
6. **Pestañas abandonadas o rotas:** STOCKSBAJOS (v1), Análisis de Precios, Cotizaciones, Lista para Imprimir, Hoja 22 y Listas Desplegables. Las tres de cálculo (Calculo costos import, Cálculos Antonio, Calculos Montacargas) son hojas de trabajo ad hoc, pero documentan la regla de costo de importación.

---

## 1. Pestañas: propósito y estado

| Pestaña | Cuadrícula | Visible | Datos reales | Propósito | Estado |
|---|---|---|---|---|---|
| **PANEL COMPRAS** | 997×27 | sí | celdas sueltas y tabla desde la fila 25 | Buscador: eliges un suministro y ves último costo, proveedor, tiempo de entrega, stock, punto mínimo, cantidad a ordenar, historial de precios con gráfica y "análisis IA". También busca proveedores. | **Vivo** |
| **ACTUALIZACIONES** | 16956×27 | sí | filas 7–15038 (15,032) | Historial de precios por componente. Es la **única captura manual de costos**. | **Vivo** (último registro 02/10/26) |
| **ListaComponentes** | 4497×34 | sí | filas 3–4075 (4,073 artículos); 4076–4109 solo tienen ítems preasignados | Catálogo maestro de componentes y materia prima con su costo vigente y precio sugerido | **Vivo** |
| **Registros Inventario** | 32208×26 | sí | filas 6–31738 (31,733 movimientos) | **Espejo** (IMPORTRANGE) de los movimientos de almacén del archivo de inventario | Vivo, pero de solo lectura; ninguna fórmula de esta hoja lo usa |
| **Órdenes** | 11016×28 | sí | filas 6–10016 (9,893 renglones) | Órdenes de compra (renglón = artículo) | **Vivo** (última OC 4368, 30/09/26) |
| **STOCKS BAJOS 2.0** | 8426×39 | sí | filas 4–20 (17 artículos hoy) | Lista de artículos bajo punto mínimo (importada) + inversión aproximada + status de la última orden | **Vivo** |
| **ListaComponentesAlmacen** | 6658×26 | sí | filas 4–3654 (3,651) | Espejo del inventario: stock, unidad, paquete, status, pendiente, punto mínimo, stock de seguridad y demanda | **Vivo** (100 % IMPORTRANGE, protegida) |
| **Directorio Proveedores** | 999×26 | sí | filas 3–936 (934) | Espejo del directorio de proveedores y acreedores de "BASE DE DATOS ACTUAL HEGAMEX" | **Vivo** (100 % IMPORTRANGE) |
| Análisis de Precios | 2955×26 | **oculta** | — | Versión anterior del historial con gráfica y `jkGPT` | **Rota**: `#NAME?`, el complemento ya no existe |
| STOCKSBAJOS | 1000×28 | **oculta** | — | Versión 1 de stocks bajos (nota "SE VALIDARON EL 20/12/21…") | **Abandonada**: su IMPORTRANGE apunta a un archivo que ya no existe (`#REF!`) |
| Calculo costos import | 1000×26 | **oculta** | ~50 celdas | Cálculo puntual del costo puesto en planta de celdas de carga y bandas importadas | Hoja de trabajo ad hoc |
| Listas Desplegables | 1000×26 | **oculta** | B2:C3 | Listas "Sí/-" y "Dar de baja/Dar de alta" (rangos con nombre `Condicional` y `AltaOBaja`) | Vestigial: no encontré validaciones que las usen |
| Lista para Imprimir | 1003×26 | sí | — | Plantilla de lista de material por equipo (Cantidad, Nombre, Unidad, Número de Ítem) | **Rota**: todas las celdas `=#REF!` |
| Cálculos Antonio | 1000×26 | sí | A3:F13 | Prorrateo del costo de importación de bandas (grip top y lisa) por metro | Ad hoc |
| Calculos Montacargas | 995×28 | sí | B1:AB41 | Costo puesto y margen de 2 montacargas y 4 patines importados | Ad hoc |
| PROMPTS | 1000×26 | sí | B3 | Plantilla de prompt para el `GPT()` de PANEL COMPRAS | Vivo pero accesorio |
| Hoja 22 | 1000×26 | **oculta** | B1:D40 | Lista estática de 39 materiales inoxidables con "material a solicitar" y "stock" | Abandonada (captura puntual) |
| Cotizaciones | 1001×32 | **oculta** | A2:T20 | Comparativo de hasta 6 cotizaciones por componente, de agosto de 2019 | **Abandonada** |

**Rangos con nombre:**

| Nombre | Rango | Uso |
|---|---|---|
| `NombresSuministros` | `ListaComponentes!A3:A4497` | Validación de ACTUALIZACIONES!B y de PANEL COMPRAS!C3 |
| `ComponentesInventario` | `ListaComponentesAlmacen!A4:A5496` | Validación de Órdenes!C |
| `Proveedores` | `Directorio Proveedores!A3:A999` | Validación de ACTUALIZACIONES!E, Órdenes!H y PANEL COMPRAS!H8 |
| `StatusOrdenes` | `Órdenes!M2:M5` | Lista de status: Pendiente, Pedido, Recibido, Enviado |
| `Condicional`, `AltaOBaja` | `Listas Desplegables` | Vestigiales |

**Protecciones:**
- **ACTUALIZACIONES!D4:G4** (tiempo estándar de entrega): abel.jr, jorge, abelfigugu.
- **STOCKS BAJOS 2.0**, **STOCKSBAJOS**, **ListaComponentesAlmacen** y **Directorio Proveedores** están protegidas completas.
- **PANEL COMPRAS** tiene protegidos los rangos de los buscadores.
- **ListaComponentes no tiene protección**, aunque la fila 1 advierte: *"Modificar o eliminar nombres de la lista puede afectar al costeo de los equipos. Avisar antes al encargado de generar los costeos"*.

---

## 2. Columnas de las pestañas importantes

### 2.1 ListaComponentes (catálogo maestro)

- Fila 1: la advertencia citada arriba. Fila 2: encabezados. Datos: filas 3–4075.
- Filtro básico en A2:P4497, ordenado por D ascendente y luego I descendente.
- Las filas 4076–4109 solo tienen el número de ítem (4978–5011) preasignado y fórmulas que devuelven "".

| Col | Encabezado | Tipo | Ejemplo real | Captura | Significado / fórmula |
|---|---|---|---|---|---|
| A | Componente | texto | `Catarina 80-17` | **manual** | Nombre único del artículo: es la **llave de todo**. 4,073 filas, 34 nombres duplicados exactos (35 sin distinguir mayúsculas). |
| B | Unidad de medida | texto libre (sin validación) | `pieza`, `metro`, `cm`, `tramo`, `caja` | **manual** | Unidad en la que se expresa el costo. 33 variantes de escritura (ver §6). |
| C | "Nuevo — Cantidad mínima de unidades por paquete o metros/cm por pieza" | número | `300` (Cadena de paso 80, unidad cm); `580` (Cuadrado 3/8" x 5.80 m, cm); `100` (Cable 3X10, metro) | **manual** | Lote o empaque mínimo de compra en unidades base. Valores: 1 en 3,577 filas, 10 en 202, 6 en 126, 100 en 47, 24 en 30, 27 vacías. El inventario lo usa para redondear la cantidad a pedir. |
| D | Número de Ítem | entero | `7` | **manual** | Consecutivo de 0 a 4977. Hay 911 huecos y 6 duplicados (263, 264, 265, 530, 533, 3935). "Nuevo Costeo" lo importa junto con el costo (D:E). |
| E | Último costo por unidad registrado | moneda MXN sin IVA | `$250.00` | **fórmula** | `=IFERROR(IF(G3<TODAY()-2000,"Fecha muy antigua. Costo Bloqueado",IF(A3="","",INDEX(ACTUALIZACIONES!B:E,MAX(FILTER(ROW(ACTUALIZACIONES!B:B),ACTUALIZACIONES!B:B=A3)),3))),"Aún no hay registros")`. Toma el COSTO de la **última fila** del historial con ese nombre. Resultados: 3,940 numéricos, 57 "Aún no hay registros", 75 vacíos (el registro existe pero el costo está en blanco), 1 "-". |
| F | Precio de venta sugerido (antes de IVA) | moneda | `$357.14` | **fórmula** | En 4,060 filas: `=IF(A3="","",IFERROR((E3/(1-0.3)),"No disponible"))`, o sea **30 % de utilidad sobre el precio de venta**. **24 filas tienen el margen escrito a mano dentro de la fórmula**: 0.4 (9 filas), 0.45 (3), 0.5 (2), 0.33 (2), y una fila cada una con 0.64, 0.65, 0.363, 0.35714286, 0.34, 0.257, 0.317 y 0.35. **2 filas** usan la columna N: `=IF(A#="","",IFERROR(E#/(1-IF(N#="",0.3,N#)),"No disponible"))`. |
| G | Fecha de actualización más reciente | fecha dd/mm/yy | `07/07/26` | **fórmula** | `INDEX(ACTUALIZACIONES!A:G, MAX(FILTER(ROW(...),B=A3)), 1)` |
| H | Proveedor del último precio registrado | texto | `Baleros e Insumos Agricolas` | **fórmula** | Mismo patrón que G, columna 5. Hay 184 proveedores distintos. |
| I | Tiempo estimado de entrega del último precio (días hábiles) | entero | `60` | **fórmula** | `=IFERROR(IF(A3="","", IF(INDEX(ACTUALIZACIONES!A:G,MAX(FILTER(...)),6)="",ACTUALIZACIONES!$F$4,INDEX(...,6))),"")`. Si el registro no trae tiempo, usa el estándar `ACTUALIZACIONES!F4` = **7**. |
| J | DESCRIPCIÓN (cuidar ortografía y redacción) | texto multilínea | "• Trifásico 2hp 220/440 volts / • Caja tamaño 75 / • Relación 25:1" | manual | Ficha técnica. Llena en 395 filas. |
| K | Notas | texto | `UNICA VEZ`, `NO SE UTILIZA`, `SE COBRA EN MULTIPLOS DE 6"` | manual | Llena en 110 filas. Sirve de facto como bandera de estado (obsoleto, compra única, etc.). |
| L | Imagen (link de Drive o .jpg/.png) | URL | `https://static.wixstatic.com/media/627ccd_…png` | manual | 264 filas: 240 de Wix y 23 de Drive. |
| M | Link Convertido | URL | — | **ARRAYFORMULA** (en M3) | Convierte los enlaces de Drive `/d/ID` u `open?id=` a `https://lh3.googleusercontent.com/d/ID=w1000?authuser=1`. |
| N | Ut. personalizada | % | `45.00%` | manual | Margen específico del artículo; solo hay 1 valor capturado. |
| O | IMAGEN | imagen | — | **ARRAYFORMULA** `=ARRAYFORMULA( if(M3:M="","", IMAGE(M3:M)))` | Vista previa |
| P–AH | — | — | — | — | Vacías |

Formato condicional en esta pestaña:
- E:F en gris cuando dice "No disponible" o "Aún no hay registros"; E en rojo cuando dice "antigua".
- G con degradado por antigüedad y en verde si la fecha es del mes pasado.
- I con degradado.

### 2.2 ACTUALIZACIONES (historial de precios)

- A4: *"NO BORRAR NINGUNA ACTUALIZACIÓN, ESTE ES UN HISTORIAL QUE NOS AYUDA A VER CÓMO HA IDO CAMBIADO EL PRECIO DE ALGO, NO ES UNA LISTA DE PRECIOS."*
- F3:G4 son un parámetro: "Tiempo Estándar de Entrega: **7** días hábiles" (protegido).
- Encabezados en la fila 6 y datos en las filas 7–15038.
- Filtro básico en A6:H16956. Su orden guardado es B y luego A, pero hoy los datos están en orden de captura, casi cronológico.

| Col | Encabezado | Tipo | Ejemplo | Captura | Significado |
|---|---|---|---|---|---|
| A | FECHA DEL PRECIO | fecha (serial, formato dd/mm/yy) | `28/09/26` | manual | Fecha de la cotización o compra. Por año: 2011: 9, 2017: 1, 2018: 15, 2019: 350, 2020: 761, 2021: 2,130, 2022: 2,016, 2023: 2,092, 2024: 3,536, 2025: 3,152, 2026: 875. |
| B | Componente | texto con validación `NombresSuministros` (con flecha) | `Grapas RS 125 de 24" FLEXCO` | manual (lista) | Llave hacia ListaComponentes. 4,015 componentes distintos. |
| C | Unidad de medida | texto | `caja` | **fórmula** `=IF(B7=0,"",VLOOKUP(B7,ListaComponentes!$A$3:B,2,0))` | Muestra la unidad **actual** del catálogo, no la que valía al registrar (ver §6). 37 filas dan `#N/A` porque el componente ya no existe. |
| D | COSTO sin iva | moneda MXN | `$4,300.00` | manual | Costo unitario en la unidad de B. 14,946 numéricos, 82 vacíos, 15 en cero y 3 sin formato de moneda (`260`, `2000`, `250`). |
| E | Proveedor de la referencia | texto con validación `Proveedores` (no estricta) | `Transbelt S.A. de C.V.` | manual (lista) | 239 valores distintos y 83 vacíos. 35 nombres no existen en el directorio (186 filas): `Hegamex` 124, `HEGAMEX` 11, `hegamex` 2, `Mercado Libre` 7, `TRACTOZONE`/`TRACTOZON`, `Huesario`/`huesario`/`HUESARIO`, etc. |
| F | Tiempo Estimado de Entrega (días hábiles) | entero | `12` | manual | Vacío significa estándar. Vacíos: 7,391; 7: 5,570; 2: 499; 4: 423; 15: 369; 60: 159. La nota de la celda explica para qué sirve (ver §3.4). |
| G | Nota | texto libre, a menudo un número | `4280`, `"624 se cobran 24""`, `"6,724.48 -10% = 6,052.04 + iva"` | manual | Ver §3.5. Llena en 8,833 filas, casi todas desde 2023. |
| H–AA | — | — | — | — | Vacías salvo T9:X17, un cálculo suelto ajeno (envíos "Lanzup", "Lluvia de Estrellas") que es **basura**. |

### 2.3 Órdenes (órdenes de compra)

- M1:M5 trae la lista de status: Entregado, Pendiente, Pedido, Recibido, Enviado. `StatusOrdenes` = M2:M5.
- Encabezados en la fila 5 y datos en las filas 6–10016.
- Filtro básico en A5:K10016, ordenado por H y luego C.

| Col | Encabezado | Tipo | Ejemplo | Captura | Significado |
|---|---|---|---|---|---|
| A | Fecha | fecha (validación DATE_IS_VALID) | `30/9/26` | manual | Fecha de la orden. Va de 26/03/21 a 30/09/26. Desde la fila ~7963 cambia el formato de presentación (dd-mm-yy a d/m/yy), pero el valor sigue siendo serial. Hay 15 fechas en el futuro (`12-03-35`, `07/09/29`). |
| B | #Ord | entero | `4367` | manual | Folio de la OC; **una OC ocupa varias filas** (un artículo por fila). Hay 3,747 folios. Valores raros: `Vale` (51), `1594.1` (9), `-` (5), `s/n`, `NC`. 12 OC tienen más de un proveedor y 21 tienen más de una fecha. |
| C | Articulo | texto con validación `ComponentesInventario` (lista del **inventario**, no de ListaComponentes) | `Chumacera 1" 2B piso UCP 205-16` | manual (lista) | 723 renglones con artículos que no existen en ListaComponentes. 110 renglones sin artículo, que lo traen escrito en G. |
| D | Cantidad Ordenada | número | `40` | manual | 29 vacías |
| E | Unidad | texto | `pieza` | **fórmula** `=IFERROR(IF(C6="","",VLOOKUP(C6,ListaComponentes!A$3:B,2,0)),"")` | 593 vacías porque el artículo no está en el catálogo |
| F | Status | lista `StatusOrdenes` | `Recibido` | manual | Recibido: 8,521; Enviado: 663; Pedido: 478; vacío: 142; CANCELADO: 59 (más `CALCELADO`, `CACELADO`); Pendiente: 26; ENTREGADO: 2 |
| G | Nota Extra | texto | `ALMACEN`, `Venta M.L.`, `P. 714 - Silo Aux Fijo`, `S126 - Zar 4T`, `SOLICITO LUIS FLORES`, `Minimos` | manual | **Destino o motivo de la compra**: para almacén, para una venta, para un pedido de producción (`P. ###`) o un servicio (`S###`), o quién lo pidió |
| H | Proveedor | lista `Proveedores` | `Baleros e Insumos Agricolas` | manual | 144 distintos, 34 vacíos |
| I | Factura | texto | `C7774`, `DOT - 2103`, `13950, 13961` | manual | Llena en 7,785 renglones. A veces trae varias facturas separadas por coma. |
| J | Fecha de Vencimiento | **mezcla** de fecha y texto | `PAGADA`, `PAGADO`, `CANCELADO`, `PAGADO POR ANTICIPADO`, `SE DEBE`, `ANT` | manual | Cuentas por pagar improvisadas: 3,727 fechas y 2,231 textos |
| K | (vacía) | | | | |
| L | "Factura " | casilla | TRUE/FALSE en 40 filas | manual | Uso marginal |

### 2.4 ListaComponentesAlmacen (espejo del inventario)

- A1: *"Lista vinculada al documento de Stock total de inventario (no modificar)"*.
- Todo es IMPORTRANGE desde `1sOh_Gyj0ofi7aSYKdKmCJSyT_H6G1_wH18OlrybY2QE` ("2025 - Inventario 2.0- HEGAMEX").

| Col | Encabezado | Origen | Ejemplo | Nota |
|---|---|---|---|---|
| A | Nombre del artículo | `Inventario!B7:B` | `Aceite soluble PETROL` | 3,651 artículos. 2,450 coinciden exacto con ListaComponentes. **1,607 artículos del catálogo no están en inventario.** |
| B | STOCK ACTUAL TOTAL DISP | `Inventario!E7:E` | `0.0` | 2 negativos (−0.5 y −2) |
| C | Unidad | `Inventario!C7:C` | `pieza` | 675 vacías; 5 no coinciden con la unidad del catálogo (p. ej. `Cordon grafitado 1/2`: metro en el catálogo, pieza en inventario) |
| D | Cantidad por paquete… | `Demanda!S7:S` | `1` | Viene a su vez de ListaComponentes!C |
| E | STATUS | `Demanda!Y7:Y` | `STOCK BAJO,ORDENAR` | OK: 2,680; Excedente: 948; STOCK BAJO,ORDENAR: 18; `#VALUE!`: 3; "Error, stock negativo": 2 |
| F | CANTIDAD MÍNIMA PENDIENTE | `Demanda!X7:X` | `47` | |
| G | Punto mínimo de reorden | `Demanda!V7:V` | `12` | 261 artículos con valor mayor a 0 |
| H | **"Notas 1"** (está mal etiquetada) | `Demanda!U7:U` | | En realidad es el **stock de seguridad manual** (PANEL COMPRAS la lee como tal). Hay 3 celdas con texto ("ya no se utiliza", "F900A Serie 300611", "NO SE USA ") que causan los 3 `#VALUE!` de status. |
| I | DEMANDA PROM. POR MES | `Demanda!R7:R` | `35` | 262 artículos con demanda mayor a 0 |

### 2.5 STOCKS BAJOS 2.0

- H1: `=IMPORTRANGE("1sFjjiLxpsiFf0zroiv4RSWb4a5zmvCacABNg2bf9y6E","'Monitor Stocks Bajos'!F2")` = **$2,000**, el umbral de inversión, que vive en "Nuevo Costeo".
- B3: `=IMPORTRANGE("1sOh_…","'STOCKS BAJOS 2.0'!A1:E")` trae B:F (Nombre, STATUS, STOCK, CANTIDAD MÍNIMA PENDIENTE, Unidad).
- J3: `=IMPORTRANGE("1sOh_…","'STOCKS BAJOS 2.0'!K1:Y")` trae J:V (demanda de los últimos 12 meses, de oct-2025 a sep-2026, y el promedio).
- Y3: `=IMPORTRANGE("1sOh_…","'STOCKS BAJOS 2.0'!Z1")` trae el porcentaje de desabasto (6.9 %).

Columnas locales:

| Col | Encabezado | Fórmula |
|---|---|---|
| G | Inversión Aprox | `=IFERROR(IF(B4="","",VLOOKUP(B4,ListaComponentes!A3:E,5,0)*E4),"Se desconoce el precio")`, es decir, costo vigente × cantidad pendiente. **Bug:** el rango es relativo y en la fila 5 ya busca en `A4:E`, en la 6 en `A5:E`, etc., así que las filas de abajo ignoran los primeros componentes del catálogo. |
| H | Notas | `=IF(B4="","", if(G4="Se desconoce el precio","Inversión desconocida", IF(G4>=$H$1,"Inversión mayor a " & TEXT(H$1,"$0,0") & " pesos","Inversión menor a " & TEXT(H$1,"$0,0") & " pesos 😮‍💨")))` |
| I | (status de la orden) | Status de la **última** fila de Órdenes de ese artículo, salvo que sea "Recibido": `=IF(IFERROR(IF(B4="","",INDEX('Órdenes'!C:G,MAX(FILTER(ROW('Órdenes'!C:C),'Órdenes'!C:C=B4)),4)),"")="Recibido","",IFERROR(...))` |

### 2.6 PANEL COMPRAS (pantalla, no datos)

- **C3** elige el suministro (validación `NombresSuministros`) y alimenta:
  - C4 costo: `=IFERROR(VLOOKUP(C3,ListaComponentes!A2:H,5,0),"")`
  - C5 proveedor y C6 tiempo de entrega: `=IFERROR( CONCATENATE(VLOOKUP(C3,ListaComponentes!A3:I,9,0)," días hábiles"),"")`
  - C7 fecha.
  - C8 stock: `VLOOKUP(C3,ListaComponentesAlmacen!A4:B,2,0)`
  - E4 demanda: col 9. E6 stock de seguridad manual: col 8. E7 punto mínimo: col 7. E8 status: col 5. E9 cantidad mínima pendiente: col 6.
- **B9:**
  ```
  =IF(VLOOKUP(C3,ListaComponentesAlmacen!A4:B,2,0)<E7,("El stock actual es menor al punto mínimo." & " En esta ocasión hay que ordenar mínimo " & E9 & " " & VLOOKUP(C3,ListaComponentesAlmacen!A4:C,3,0) & "(s)" ),"No es urgente ordenar por ahora.")
  ```
- **E5** explica la regla de demanda: *"Este artículo se ha necesitado en al menos 3 meses de los últimos 6 meses"*; si no, *"…su demanda se considera que no es constante y considera que es 0."*
- **G2:H4** traen el porcentaje de desabasto desde el inventario con `IMPORTRANGE("1sOh_…","'Registro'!H1:I2")`, `'Registro'!J2:J4` y `'Registro'!H4:I4`. Leyenda en I3:I5: "<8% OPTIMO", "8%-17% ACEPTABLE", ">17% DEFICIENTE". Texto actual: *"De 261 artículos que actualmente tienen punto mínimo (ya sea por demanda y/o por mínimos de seguridad manual), 18 tienen stock bajo, lo que da como resultado un 6.90% de desabasto actual."*
- **H8:J16** buscan proveedores: H8 se valida con `Proveedores` y H9…J16 hacen `VLOOKUP($H$8,'Directorio Proveedores'!$A$3:$S,n,0)` con n = 2…19.
- **H20** es una casilla. **H22:** `=IF(C3="","",IF(H20=FALSE,"Marcar casilla para ejecutar análisis",GPT(PROMPTS!B3, $B$25:F120,0.2)))` (complemento "GPT for Sheets").
- **B25:** `=query(ACTUALIZACIONES!A6:G,CONCATENATE("select A,D,E,F,G WHERE B ='",C3,"'"),1)` muestra el historial, con una gráfica de área de costo contra fecha.
- **F12:** `=IFERROR(VLOOKUP(C3,#REF!,3,0),"")`, una referencia rota.

### 2.7 Directorio Proveedores (espejo)

- A2: `=IMPORTRANGE("1bMPe8wRcFv66tap2k7qW6MOIDWDYMeng8Mii4ZwAdFs","Directorio Proveedores!B2:S")` ("BASE DE DATOS ACTUAL HEGAMEX").
- S2: `=IMPORTRANGE(…,"Directorio Proveedores!W2:W")` (Días de Crédito).
- Columnas: Nombre, Tipo de Proveedor, TELÉFONO, TELÉFONO 2, CONTACTO 1, CORREO 1, CELULAR 1, CONTACTO 2, CORREO 2, CELULAR 2, DOMICILIO, Municipio, CP, ESTADO, PAÍS, RFC, NÚMERO DE CUENTA, NOTAS, Días de Crédito.
- 934 entradas. **Mezcla proveedores de compras con acreedores y conceptos de gasto**: "IMPUESTOS (Retenciones ISR)", "NOMINA ATOTONILCO", "Aguinaldo", "Casetas", restaurantes, hoteles, "RETIRO DIVIDENDOS". Hay 100 "tipos" y 326 sin tipo.
- Cuántas entradas traen cada dato:

  | Dato | Llenas |
  |---|---|
  | Tipo | 608 |
  | Teléfono | 363 |
  | Correo 1 | 284 |
  | RFC | 541 |
  | CP | 439 |
  | País | 483 |
  | Días de crédito | 70 |
  | Número de cuenta | 25 |

- Solo **221 entradas** aparecen como proveedor en ACTUALIZACIONES u Órdenes.

### 2.8 Registros Inventario (espejo, no se usa aquí)

- A4: `=IMPORTRANGE("1sOh_…","'Registro'!B11:K")`.
- Columnas: Fecha y Hora, Producto, Unidad, Cantidad, Tipo, Almacén, Personal, N. de Pedido / Motivo, # Factura / vale / nota, Proveedor.
- 31,733 movimientos, del 24/4/2024 al 2/10/2026.
- **Tipo:** SALIDA 22,773; ENTRADA 7,091; AJUSTE SALIDA 952; AJUSTE ENTRADA 916; "Nuevo Artículo" 1.
- **Almacén:** Planta Baja 16,469; Mallado 11,267 (más "mallado" 1); Planta Alta 2,132; Contenedor 1 917; RESERVADO 393; Contenedor 2 369; Revolución 95; Almacén ML 90.
- **Motivo:** códigos de pedido de producción `P736`, `P760`…; de servicio `S113`, `S091`…; y textos libres "TALLER", "VENTA ML", "cambio de almacen".
- La fuente de verdad es el archivo de inventario; esto le toca a otro análisis.

---

## 3. Reglas de negocio descubiertas

### 3.1 Costo vigente de un componente
- **Regla.** Costo vigente = COSTO sin IVA (col D) de la **última fila física** de ACTUALIZACIONES cuyo B es igual al nombre (`MAX(FILTER(ROW(...)))`).
  - No toma la fecha más reciente; toma la última fila. Hoy coinciden para todos los componentes, pero hay 28 filas capturadas fuera de orden cronológico. En el ERP conviene usar la vigencia por fecha y, en empate, el último capturado.
- **No promedia ni pondera por proveedor.** El último precio capturado, de cualquier proveedor, se vuelve el costo del catálogo.
- **No hay costo por proveedor ni lista de precios por proveedor.** El proveedor es solo un atributo del registro.
- **Bloqueo por antigüedad.** Si la fecha del último precio es menor a `TODAY()-2000` (≈5.5 años; hoy el corte es 12/04/2021), el costo se reemplaza por el texto "Fecha muy antigua. Costo Bloqueado". Hoy no hay ninguno bloqueado.
- **Antigüedad del último precio** (al 03/10/2026):

  | Antigüedad | Componentes |
  |---|---|
  | menos de 1 año | 1,005 |
  | 1 a 2 años | 1,548 |
  | 2 a 3 años | 1,002 |
  | más de 3 años | 461 |
  | sin registro | 57 |

### 3.2 Precio de venta sugerido
- `Precio = Costo / (1 − margen)`. El margen es **utilidad sobre precio de venta** (no markup). El estándar es **0.30**, equivalente a un markup de 42.86 %.
- Las excepciones están escritas a mano dentro de la fórmula de 24 filas, y en 2 filas como "Ut. personalizada" (col N).
- Notas reales lo confirman: *"Se bajó del 50% de ut sobre precio de venta al 40% el 2 de abril del 2026"* y *"…al 34%…"* (colectores de polvos DKT).
- Una nota en ACTUALIZACIONES dice: *"Se ajusta % de utilidad en su formula en la ListaComponentes para mantener casi mismo precio anterior."* Es decir, a veces el margen se ajusta para **mantener fijo el precio de venta** cuando el costo baja.

### 3.3 IVA y moneda
- Todo costo capturado es **MXN antes de IVA**.
- En las hojas de cálculo, el IVA siempre se maneja como 16 %: `/1.16` para quitarlo y `*1.16` para agregarlo.
- No existe columna de moneda. Las compras en dólares se convierten a mano antes de capturarse. Ejemplos de nota: *"el precio es en dlls, actualizar al dolar"*, *"3,400 dolares mas iva"*, *"$1547 c/u + $237 gestión aduanal y maniobras. No incluye iva."*

### 3.4 Tiempo de entrega (lead time)
- Se captura por registro de precio (ACTUALIZACIONES!F), en **días hábiles**. Si está vacío vale el estándar `ACTUALIZACIONES!F4` = 7.
- Si es entrega inmediata, la nota de la celda pide **poner 1**.
- ListaComponentes!I toma el del último precio. El inventario lo usa para el punto mínimo (§3.9).
- Nota de F6: *"…la cantidad mínima de orden así como los puntos mínimos se calcularán considerando la demanda promedio y el tiempo de entrega… A mayores tiempos, órdenes más grandes y puntos mínimos más altos."*

### 3.5 "COSTO sin iva" (D) contra "Nota" (G): hay dos costos
Desde 2023, el comprador casi siempre escribe en **G el costo real cotizado o facturado (sin IVA)** y en **D un costo redondeado hacia arriba** que es el que alimenta al catálogo. Los números:

| Comparación (8,225 filas con D y G numéricos) | Filas |
|---|---|
| G < D | 5,444 (mediana D/G = 1.067; la mayoría entre 1.01 y 1.10) |
| G = D | 2,717 |
| G > D | 64 |

Ejemplos:

| D | G | Lectura |
|---|---|---|
| $2,500 | 2241.38 | 2241.38 = 2600/1.16, precio con IVA convertido |
| $6,900 | 6840 | |
| $4,300 | 4280 | |
| $1,490 | 1,465.52 | |

Las notas de texto lo confirman:
- *"6,724.48 -10% = 6,052.04 + iva"*: precio de lista menos el descuento del proveedor.
- *"precio real $53+iva"*.
- *"no es lo que nos costo"*, *"CORRECCIÓN, COSTO REAL"*, *"Precio aproximado"*.

Esto es **inferencia**, pero bien sustentada: D funciona como costo estándar con colchón y G como costo real. **Hay que confirmarlo con el comprador.** El ERP debería guardar ambos: `costo_real` y `costo_estandar`.

### 3.6 Unidades, paquetes y "tramos"
- El costo se expresa en la unidad de ListaComponentes!B: pieza, metro, cm, kilo, litro, caja, juego, par, kit, tramo, servicio, horas, pulgada, galon, rollo, m2, carga.
- **ListaComponentes!C es el lote mínimo de compra en unidades base.** Ejemplos:
  - "Cadena de paso 80 (vienen 3 metros)": unidad cm, paquete 300.
  - "Cuadrado acero 1018 3/8" x 5.80 mts": unidad cm, paquete 580.
  - Cable: unidad metro, paquete 100 (rollo).
  - Cangilones: cajas de 24, según la nota del inventario.
- Los materiales en barra o perfil se costean **por cm o metro** aunque se compren por tramo de 6.10 m o 5.80 m. **La unidad cambió con el tiempo sin dejar historial.** Ejemplo: "Cuadrado acero 1018 3/4" x 5.80 mts" pasó de $120 a $1.00 el 24/02/2021 al cambiar de pieza a cm. Detecté 27 saltos de más de 8× entre precios consecutivos (ver §6).
- Las bandas armadas a la medida se dan de alta **como artículo propio con unidad "tramo"**, una por pedido. Ejemplo: `31 mts PVC120 blanca de 12" vulcanizada`, unidad tramo, $6,900. Esto infla el catálogo con artículos de una sola compra (la nota "UNICA VEZ" aparece 14 veces).

### 3.7 Bandas: precio por pulgada de ancho, en múltiplos de 6"
- Las notas muestran que Transbelt cobra la banda grip top de 3 capas a **$26 por pulgada de ancho por metro**, con el ancho redondeado al múltiplo de 6" siguiente:

  | Banda pedida | Nota | Precio |
  |---|---|---|
  | 20" | "624 se cobran 24"" | 24 × 26 |
  | 8" | "312 se cobran 12"" | |
  | 81 cm | "936 se cobran 36"" | |
  | 19" | "624 SE COBRAN 24"" | |

- ListaComponentes!K lo dice 13 veces: `SE COBRA EN MULTIPLOS DE 6"`.
- Es una **regla de precio paramétrica** que hoy se replica capturando un artículo por cada ancho.

### 3.8 Mano de obra y servicios como "componentes"
- La mano de obra vive en el catálogo con proveedor "Hegamex", unidad horas o hora:
  - "Horas hombre pailería" $87.67
  - "Horas hombre Pintor" $80.18
  - "Horas hombre tornero" $90.80
  - "Horas hombre detallado", "Hora de Ingeniería y Planeación", "Horas hombre Extras", "Horas hombre habilitado"
- PROMPTS lo aclara: *"Si dice 'hora hombre de...' no se refiere a un componente… se refiere a salario de ese personal… el proveedor somos nosotros mismos."*
- También hay **servicios** con unidad "servicio": vulcanizado, fletes ("Flete Atotonilco-Veracruz"), puestas en marcha, grúas, permisos.
- Varias bandas "H" con proveedor Hegamex son **artículos fabricados en casa costeados como componentes**.
- En el ERP deben ser tipos de artículo distintos (mano de obra, servicio, fabricado), no inventariables.

### 3.9 Stock bajo, punto mínimo y cantidad a ordenar
Esto se calcula en `1sOh_…` › **Demanda** (fila 8 de ejemplo); aquí solo se importa. Fórmulas literales:
- **Demanda mensual (F:Q, últimos 12 meses) y R = DEMANDA PROM. POR MES.** Vienen de `IMPORTRANGE("1gSkwDhdQ3xiVBrGUJszNK_af2dOtfBk4_s3GAq6_9Eg","Demanda!F8:R")` ("Almacen Registros").
  - Regla (Demanda!D3:H3): **"Consumo en al menos 3 de los últimos 6 meses"**. Si no se cumple, la demanda vale 0 (nota de R7).
- **S, paquete:** `=IFERROR(IF(B8="", "", VLOOKUP(B8,'LISTA ENLAZADA COSTOS'!$A$4:C,3,)),"")`, que es ListaComponentes!C.
- **T, días de entrega:** `=IFERROR(IF(B8="", "", VLOOKUP(B8,'LISTA ENLAZADA COSTOS'!$A$4:I,9,)),"")`, que es ListaComponentes!I.
- **U, stock de seguridad manual:** `IMPORTRANGE(…,"Inventario!W7:W")`. Según la nota, es para artículos sin demanda constante que igual deben tenerse, como las celdas de carga o lo publicado en Mercado Libre.
- **V, Punto mínimo de reorden:**
  ```
  =IF(B8="","",ROUNDUP(((R8/22)*IF(T8="",7,T8))+U8))
  ```
  Demanda diaria (22 días hábiles al mes) × días de entrega + stock de seguridad.
- **W, Cantidad mínima por orden de compra** (un mes de demanda): `=IF(B8="","",ROUNDUP(R8))`
- **X, CANTIDAD MÍNIMA PENDIENTE:**
  ```
  =IF(B8="", "", IF(OR(Y8="OK",(W8+(V8-E8)<=0)), "", MROUND((W8+(V8-E8))+(IF(S8="",1,S8)/2)-1,IF(S8="",1,S8)) ) )
  ```
  Un mes de demanda más lo que falta para llegar al punto mínimo, redondeado al múltiplo del paquete. Es una aproximación a `CEILING(x, paquete)`.
- **Y, STATUS:**
  ```
  =IF(B8="", "", 
     IF(E8<0, 
        IF(COUNTIF(L8:Q8, ">0")<$G$3, 
           "Error, stock negativo", 
           "STOCK BAJO,ORDENAR"), 
        IF(E8<V8, 
           "STOCK BAJO,ORDENAR", 
           IF(AND(SUM(F8:Q8)=0, E8>0, U1922=""), 
              "Excedente", 
              "OK"
           )
        )
     )
  )
  ```
  - **Stock bajo** = stock < punto mínimo.
  - **Excedente** = sin consumo en 12 meses, con stock y sin stock de seguridad manual.
  - **Bug:** compara `U1922` en lugar de `U8`. La referencia relativa apunta 1,914 filas más abajo, así que "Excedente" depende de otra fila.
- **% de desabasto** = artículos en stock bajo ÷ artículos con punto mínimo mayor a 0. Hoy: 18 / 261 = 6.9 %. Semáforo: menos de 8 % óptimo, de 8 a 17 % aceptable, más de 17 % deficiente.

### 3.10 Status de una orden de compra
- Lista: Pendiente, Pedido, Enviado, Recibido; existen además "Entregado" y "CANCELADO" tecleados.
- En STOCKS BAJOS 2.0, un artículo con una orden abierta muestra el status de su **última** orden.
- STOCKS BAJOS 2.0!C2: *"Los artículos se borran automaticamente una vez ingresan a almacén."* La salida de la lista la provoca la entrada de almacén, no el status de la orden.
- **La semántica exacta de "Pedido" contra "Enviado" no está documentada.** Hay 663 "Enviado" viejos (desde 2021) sin cerrar, varios con nota "Venta". Hay que confirmarla con el comprador.

### 3.11 Umbral de inversión ("flexibilidad")
- En "Nuevo Costeo" › Monitor Stocks Bajos, D2:F2: *"Compras mayores a esta cantidad se permite su flexibilidad de compra o esperas debido a alta inversión."* Valor: **$2,000**.
- STOCKS BAJOS 2.0 etiqueta cada faltante como mayor o menor a ese umbral, con inversión = costo vigente × cantidad pendiente.
- La instrucción de B1 es: *"Intentar ir comprando los artículos de menor inversión y mayor importancia."*

### 3.12 Costo puesto en planta de importaciones (landed cost)
No hay un proceso formal; el método se repite en tres hojas ad hoc:
- **Calculo costos import** (celdas de carga GSB205C, GSL301 y GBS800):
  - `TC = K2/N4` (MXN pagados ÷ USD = 46,367.80/2,274 = **20.39**).
  - Gastos generales: envío marítimo `=715*N5` (USD × TC), desconsolidación, envío terrestre. `Total = SUM(D6:D8)` y `por pieza = D9/32`; la etiqueta dice "30 piezas", pero son 16 + 8 + 8 = 32.
  - `precio bruto = USD × TC`.
  - **Impuestos + liberación + agente prorrateados por valor:** `=D13/((H8*H9)+(J8*J9)+(L8*L9))*H9`.
  - `Costo neto (incluye iva) = bruto + envío p/u + importación p/u` y luego `Costo bruto en hegamex = neto/1.16`.
  - Un segundo caso convierte bandas de USD a MXN con `C18/B18` (TC 20.13) y saca el precio por metro según el ancho: `E25/3` para 20" contra 63", luego `*1.4` y `/1.16`.
- **Cálculos Antonio** (bandas importadas): costo de bandas, impuestos, liberación y fletes. Lo reparte **80 % grip top / 20 % lisa** (`=B4*0.8`, `=B4*0.2`), lo divide entre metros (`/150`, `/100`) y calcula el sobrecosto `=100*((B9/B4)-1)` = **51.15 %** sobre el valor de la mercancía.
- **Calculos Montacargas:**
  - EXW en USD más el envío asignado por valor.
  - **TC de la transacción** = monto pagado MXN ÷ USD (`=N13/I8` = 17.4649).
  - Costos extra sin IVA (naviera `=G17*18`, impuestos `=182544-98344`, maniobras, honorarios de agencia, flete Manzanillo–Atotonilco) prorrateados por "peso" = % del valor (`=L4/I8`).
  - Margen respecto a venta y respecto a costo.
  - Comisión de meses sin intereses: `=C3*0.047*1.16` (3 MSI). Comisión de vendedor: `=C3*0.028`.

Resultado: el costo que llega a ACTUALIZACIONES ya es el **costo puesto en planta, en MXN y sin IVA**, sin trazabilidad de USD, TC ni gastos. El ERP debería tener un módulo de **costeo de importación** (pedimento o embarque, gastos, prorrateo por valor) que genere el registro de costo.

### 3.13 Cotizaciones comparativas (abandonado)
- La pestaña Cotizaciones (agosto de 2019) tenía hasta 6 pares precio/proveedor/fecha por componente, con precios en USD escritos como texto (`$420    dlls`).
- Ya no se usa; hoy cada cotización es una fila de ACTUALIZACIONES.

### 3.14 Códigos de artículo y categorías
- **No hay SKU ni categoría.** El único identificador es el nombre. "Número de Ítem" es un consecutivo sin significado que hoy se ordena por fecha de alta.
- La categoría se puede **inferir de la primera palabra** del nombre (top: banda 457, tornillo 171, motorreductor 135, lamina 121, polea 118, motor 118, chumacera 97, catarina 96, cangilón 81, tubo 69, cable 66, tuerca 62, variador 45…).
- En "Nuevo Costeo" › Componentes Inventario hay una columna de clasificación (p. ej. "Mano de Obra"); conviene revisarla en el análisis de ese archivo.
- **La nomenclatura codifica atributos** que el ERP podría separar:
  - Motorreductor: fases, HP, caja, relación (`Motorreductor 3F  2HP caja 75  25:1`).
  - Catarina: paso y dientes (`Catarina 80-17`).
  - Chumacera: diámetro, barrenos, montaje y código UCP/UCF (`Chumacera 1 1/2 de 2B. piso UCP 208-24`).
  - Banda: tipo, capas y ancho.
  - Lámina: calibre y medida.

---

## 4. Conexiones con otros archivos

### 4.1 Entradas (IMPORTRANGE hacia esta hoja)

| Destino en esta hoja | Archivo origen (ID) | Rango origen | Qué trae |
|---|---|---|---|
| ListaComponentesAlmacen!A3 | `1sOh_Gyj0ofi7aSYKdKmCJSyT_H6G1_wH18OlrybY2QE` ("2025 - Inventario 2.0- HEGAMEX") | `Inventario!B7:B` | Nombre del artículo en inventario |
| ListaComponentesAlmacen!B3 | mismo | `Inventario!E7:E` | Stock actual total |
| ListaComponentesAlmacen!C3 | mismo | `Inventario!C7:C` | Unidad |
| ListaComponentesAlmacen!D3 | mismo | `Demanda!S7:S` | Cantidad por paquete |
| ListaComponentesAlmacen!E3 | mismo | `Demanda!Y7:Y` | STATUS |
| ListaComponentesAlmacen!F3 | mismo | `Demanda!X7:X` | Cantidad mínima pendiente |
| ListaComponentesAlmacen!G3 | mismo | `Demanda!V7:V` | Punto mínimo |
| ListaComponentesAlmacen!H3 | mismo | `Demanda!U7:U` | Stock de seguridad manual |
| ListaComponentesAlmacen!I3 | mismo | `Demanda!R7:R` | Demanda promedio mensual |
| STOCKS BAJOS 2.0!B3 | mismo | `'STOCKS BAJOS 2.0'!A1:E` | Lista de faltantes |
| STOCKS BAJOS 2.0!J3 | mismo | `'STOCKS BAJOS 2.0'!K1:Y` | Demanda de 12 meses y promedio |
| STOCKS BAJOS 2.0!Y3 | mismo | `'STOCKS BAJOS 2.0'!Z1` | % de desabasto |
| PANEL COMPRAS!G2, I3, G4 | mismo | `'Registro'!H1:I2`, `'Registro'!J2:J4`, `'Registro'!H4:I4` | Indicador de desabasto |
| Registros Inventario!A4 | mismo | `'Registro'!B11:K` | Movimientos de almacén (espejo) |
| STOCKS BAJOS 2.0!H1 | `1sFjjiLxpsiFf0zroiv4RSWb4a5zmvCacABNg2bf9y6E` ("Nuevo Costeo") | `'Monitor Stocks Bajos'!F2` | Umbral de inversión ($2,000) |
| Directorio Proveedores!A2 | `1bMPe8wRcFv66tap2k7qW6MOIDWDYMeng8Mii4ZwAdFs` ("BASE DE DATOS ACTUAL HEGAMEX") | `Directorio Proveedores!B2:S` | Directorio de proveedores y acreedores |
| Directorio Proveedores!S2 | mismo | `Directorio Proveedores!W2:W` | Días de crédito |
| STOCKSBAJOS!H1, A5 (rota) | `100aZ8cnmbGSpVBX4r7YXsVzBzFvlbAl2mfz1A9PQCT0` (**ya no existe**) | `EscasezEnAlmacén!H1:H1`, `!A4:E` | Versión vieja |

Indirectamente, Demanda del inventario consume `1gSkwDhdQ3xiVBrGUJszNK_af2dOtfBk4_s3GAq6_9Eg` ("Almacen Registros") › `Demanda!F8:R`, que da la demanda mensual.

### 4.2 Salidas (otros archivos que leen de esta hoja; no es una búsqueda exhaustiva)

| Archivo que lee | Hoja / celda | Rango de esta hoja | Para qué |
|---|---|---|---|
| `1sOh_…` (Inventario 2.0) | LISTA ENLAZADA COSTOS!A3 | `=SORT(IMPORTRANGE(…,"ListaComponentes!A2:I"))` | Costo, proveedor, paquete (col 3) y tiempo de entrega (col 9) para calcular punto mínimo y cantidad a pedir |
| `1sOh_…` | LISTA ENLAZADA COSTOS!F1 | `Actualizaciones!F3:F4` | Tiempo estándar de entrega (7) |
| `1sOh_…` | ORDENES!A4 | `Órdenes!A5:J` | Órdenes de compra (probablemente para recepción en almacén) |
| `1sFjj…` (Nuevo Costeo) | Componentes!A2 y C2 | `ListaComponentes!A2:B5000` y `ListaComponentes!D2:E5000` | **Costeo de maquinaria**: nombre, unidad, número de ítem y último costo |
| `1sFjj…` | Monitor Stocks Bajos!G4 | `'STOCKS BAJOS 2.0'!G3:H300` | Inversión aproximada por faltante |

Implicaciones:
- El costeo de maquinaria usa **E (último costo)**, no F (precio sugerido). El cotizador no lo revisé; conviene buscar en él IMPORTRANGE hacia `1yMB2r3…`.
- Como todo cruza por nombre, **un renombre en ListaComponentes rompe** el historial (ACTUALIZACIONES!C da `#N/A`), el costeo y el inventario.

---

## 5. Entidades propuestas para el ERP y mapeo para el importador

Convenciones: Postgres/Supabase, `id uuid` o `bigserial`, `created_at` y `updated_at` en todas. Importes en `numeric(14,4)`. Moneda ISO (`MXN`/`USD`).

### 5.1 `unidad_medida`

| Campo | Notas |
|---|---|
| `codigo` (PK, texto) | `pza`, `m`, `cm`, `kg`, `l`, `caja`, `jgo`, `par`, `kit`, `tramo`, `serv`, `h`, `pulg`, `gal`, `rollo`, `m2`, `carga`, `paq`, `set`, `unidad` |
| `nombre` | |
| `tipo` | longitud, pieza, masa, volumen, tiempo, servicio |
| `factor_a_base` | opcional, para conversiones cm↔m |

Normalización de las 33 variantes observadas:

| Variantes | Código |
|---|---|
| pieza, Pieza, `pieza `, pza, Unidad | `pza` |
| metro, Metro, mts | `m` |
| tramo, Tramo | `tramo` |
| hora, horas | `h` |
| litro, Litro | `l` |
| caja, Caja | `caja` |
| juego, Juego | `jgo` |
| kit, Kit | `kit` |
| par, Par | `par` |
| Rollo | `rollo` |
| `-` y vacío | revisión manual |

### 5.2 `categoria_articulo` (nueva; hoy no existe)
- Campos: `id`, `nombre`, `padre_id`.
- Carga inicial sugerida por la primera palabra del nombre: Bandas, Tornillería, Motorreductores, Motores, Lámina y acero, Poleas, Chumaceras y rodamientos, Catarinas y cadenas, Cangilones, Eléctrico y control, Neumático, Llantas y rodajas, Consumibles, Mano de obra, Servicios.

### 5.3 `articulo` (= ListaComponentes)

| Campo ERP | Origen | Transformación |
|---|---|---|
| `id` | — | nuevo |
| `codigo` | — | **Generar un SKU nuevo** (p. ej. prefijo de categoría + consecutivo). No reusar el número de ítem como llave. |
| `legacy_item_num` | ListaComponentes!D | Entero. **No es único**: hay 6 duplicados. |
| `nombre` | A | `trim`, colapsar espacios dobles, reemplazar NBSP (`\xa0`). Guardar el texto original en `nombre_legacy` para poder cruzar con los otros archivos. |
| `nombre_legacy` | A tal cual | Llave de cruce con ACTUALIZACIONES, Órdenes y el inventario |
| `unidad_codigo` | B | Normalizar según 5.1 |
| `cantidad_empaque` | C | Número; vacío = 1 |
| `descripcion` | J | texto |
| `notas` | K | texto; de aquí derivar `estado` |
| `estado` | K | `activo` / `obsoleto` ("NO SE UTILIZA", "NO SE USA", "YA NO SE …") / `compra_unica` ("UNICA VEZ") / `sin_compra` ("NO SE HA COMPRADO ROLLO") |
| `imagen_url` | L | Guardar la URL original; descargarla a Storage si es de Drive |
| `margen_venta` | N, o el número escrito en la fórmula de F | Default 0.30. **Para las 24 filas con margen fijo en la fórmula, extraerlo con regex** `\(1-([0-9.]+)\)` de la fórmula de F; necesita leer `userEnteredValue`. |
| `tipo_articulo` | inferido | `material` / `mano_obra` ("Horas hombre…", "Hora de…") / `servicio` (unidad servicio, "Flete…", "Puesta en marcha…") / `fabricado` (proveedor Hegamex con unidad tramo o metro) / `reventa` |
| `categoria_id` | inferido | primera palabra (5.2) |
| `inventariable` | inferido | false para mano de obra y servicios |
| `lead_time_dias_habiles` | I | Se puede derivar del último precio, pero conviene guardarlo explícito |

**No se migran** E, F, G, H ni I como datos del artículo: se **calculan** a partir de `precio_articulo`, como vista o materializado.

### 5.4 `proveedor` (= Directorio Proveedores; el maestro está en "BASE DE DATOS ACTUAL HEGAMEX")

| Campo ERP | Origen |
|---|---|
| `nombre` | A |
| `tipo_proveedor` | B |
| `telefono1`, `telefono2` | C, D |
| `contacto` (tabla hija `proveedor_contacto`: nombre, correo, celular) | E–G, H–J |
| `domicilio`, `municipio`, `cp`, `estado`, `pais` | K–O; normalizar país (México/MEXICO/Mexico/Mex/CDMX → MX) |
| `rfc` | P; validar contra `^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$` (hay 6 que no cumplen) |
| `cuenta_bancaria` | Q |
| `notas` | R |
| `dias_credito` | S |
| `es_proveedor_compras` | true si aparece en ACTUALIZACIONES u Órdenes (221). El resto (gastos, impuestos, nómina) va a un catálogo de **acreedores/gastos** aparte o con otra bandera. |

También hay que dar de alta los proveedores "huérfanos" de ACTUALIZACIONES y Órdenes (Hegamex, Mercado Libre, TRACTOZONE, Huesario…) con un mapa de alias.

### 5.5 `precio_articulo` (= ACTUALIZACIONES; historial de solo agregar)

| Campo ERP | Origen | Transformación |
|---|---|---|
| `articulo_id` | B → `articulo.nombre_legacy` | Match exacto; si falla, match normalizado (trim/lower/espacios). 44 filas de 33 nombres borrados: crear el artículo como `obsoleto` o mandarlas a revisión. |
| `fecha` | A | Serial de Sheets a fecha. Pedir `userEnteredValue`/`UNFORMATTED_VALUE` para no parsear dd/mm/yy. |
| `proveedor_id` | E | mapa de alias |
| `costo_estandar` | D | Número; en blanco o 0 queda null y se marca |
| `costo_real` | G si es número | Parsear números de G (quitar `$`, `,`). Si G trae texto, va a `nota`. |
| `nota` | G si es texto | |
| `moneda` | — | `MXN` (todo el histórico) |
| `incluye_iva` | — | false |
| `lead_time_dias_habiles` | F | vacío = null (aplicar default 7 al consultar) |
| `unidad_codigo` | — | **Unidad vigente** al importar. Las filas con salto de más de 8× (§6) se marcan como "unidad dudosa". |
| `origen` | — | `migracion_sheets`, más el número de fila de origen para trazabilidad |
| `costeo_importacion_id` | — | null en el histórico |

Vista `articulo_costo_vigente`: el registro más reciente por artículo (por fecha y luego por `id`). Precio sugerido = `costo_estandar / (1 - margen_venta)`. Se marca "bloqueado" si la fecha tiene más de 2000 días.

### 5.6 `orden_compra` y `orden_compra_linea` (= Órdenes)

| Tabla.campo | Origen | Transformación |
|---|---|---|
| `orden_compra.folio` | B | Agrupar renglones por B. Los folios `Vale`, `-`, `s/n` y `NC` llevan folio sintético y `tipo = vale/sin_folio`. `1594.1` es un sub-folio. |
| `orden_compra.fecha` | A | Usar la mínima del grupo y marcar las inconsistencias (21 OC con varias fechas). Las fechas futuras (2029, 2035) van a corrección: probablemente 2026 y 2023 o 2025. |
| `orden_compra.proveedor_id` | H | Una OC por proveedor. Las 12 OC con varios proveedores se separan. |
| `orden_compra.status` | derivado | Del peor status de sus renglones |
| `linea.articulo_id` | C | Cruzar con `articulo.nombre_legacy`, y si no, con el inventario (723 renglones no están en ListaComponentes). En los 110 renglones sin artículo, tomar el nombre de G. |
| `linea.cantidad` | D | |
| `linea.unidad_codigo` | E o la unidad del artículo | |
| `linea.status` | F | Enum `pendiente`, `pedido`, `enviado`, `recibido`, `cancelado` (unificar CANCELADO/CALCELADO/CACELADO y ENTREGADO→recibido; vacío = desconocido) |
| `linea.destino` / `linea.referencia` | G | Parsear `P. ###` o `P###` como pedido de producción, `S###` como servicio, ALMACEN/Almacen como reposición, "Venta …"/"VENTA ML" como venta, "SOLICITO X" como solicitante; guardar el texto original |
| `linea.costo_unitario` | — | **No existe en Órdenes.** Se puede aproximar con el precio vigente a la fecha desde `precio_articulo` (mismo artículo y proveedor, fecha ≤ OC) |
| `factura_proveedor` (tabla aparte: folio, OC) | I | Separar por comas |
| `cxp` (cuenta por pagar: vencimiento, estado de pago) | J | Fecha = vencimiento; PAGADA/PAGADO/PAGADO POR ANTICIPADO/ANT = pagada; SE DEBE / SE DEBE RESTO = pendiente; CANCELADO = cancelada |

### 5.7 `politica_reabasto` (por artículo y almacén; hoy vive en el inventario)
- Campos: `articulo_id`, `stock_seguridad_manual` (Demanda!U), `cantidad_empaque` (de `articulo`), `lead_time` (de `articulo` o del último precio), `meses_minimos_consumo` (=3), `ventana_meses` (=6), `dias_habiles_mes` (=22).
- Salidas calculadas: `demanda_prom_mensual`, `punto_minimo`, `cantidad_min_orden`, `cantidad_pendiente` y `status` (OK / STOCK_BAJO / EXCEDENTE / ERROR_NEGATIVO), con las fórmulas de §3.9. **Corregir el bug de `U1922`.**

### 5.8 `parametro_sistema`

| clave | valor | origen |
|---|---|---|
| `lead_time_estandar_dias_habiles` | 7 | ACTUALIZACIONES!F4 |
| `margen_venta_default` | 0.30 | ListaComponentes!F |
| `dias_bloqueo_costo` | 2000 | ListaComponentes!E |
| `umbral_inversion_flexible` | 2000 MXN | Nuevo Costeo › Monitor Stocks Bajos!F2 |
| `iva` | 0.16 | hojas de cálculo |
| `desabasto_optimo` / `aceptable` | 0.08 / 0.17 | PANEL COMPRAS |
| `regla_demanda_meses` | 3 de 6 | Demanda!G3 |

### 5.9 `costeo_importacion`, `costeo_importacion_gasto` y `costeo_importacion_linea` (nuevo)
- **Cabecera:** proveedor, fecha, `moneda_origen` (USD), `tipo_cambio` (= MXN pagados ÷ USD), incoterm, referencia de pedimento.
- **Gastos:** concepto (flete marítimo, desconsolidación, flete terrestre, maniobras, impuestos, liberación, agente aduanal, honorarios), importe MXN y `criterio_prorrateo` (valor, cantidad, peso).
- **Líneas:** artículo, cantidad, precio unitario en USD; calculados: `precio_mxn`, `gastos_prorrateados`, `costo_puesto_sin_iva`.
- Al cerrar el costeo se generan registros en `precio_articulo` con `costeo_importacion_id`.
- No hay datos para migrar; las pestañas Calculo costos import, Cálculos Antonio y Calculos Montacargas sirven de **casos de prueba**.

### 5.10 `regla_precio_banda` (opcional, para bandas paramétricas)
- Campos: tipo de banda (grip top 2 o 3 capas, PVC120…), `precio_por_pulgada_metro` (p. ej. $26), `multiplo_ancho_pulg` (6), proveedor y vigencia.
- Así no hace falta crear un artículo por ancho.

### 5.11 Lo que **no** conviene migrar desde esta hoja
- **Registros Inventario** y **ListaComponentesAlmacen**: se migran desde el archivo de inventario (`1sOh_…`), que es la fuente.
- **Directorio Proveedores**: desde "BASE DE DATOS ACTUAL HEGAMEX" (`1bMPe8…`).
- **Cotizaciones** (2019): como mucho como registros históricos de `precio_articulo`, con origen `cotizacion_2019`. 18 renglones; los precios en USD vienen como texto.

### 5.12 Orden sugerido del importador
1. `unidad_medida` (catálogo fijo y mapa de variantes).
2. `proveedor`, desde el directorio, más los alias huérfanos.
3. `articulo`, desde ListaComponentes (rango A3:N4075, con fórmulas de F para extraer márgenes). Dedupe: los 34 nombres duplicados se fusionan o reciben sufijo, revisados a mano.
4. `precio_articulo`, desde ACTUALIZACIONES A7:G15038 con `UNFORMATTED_VALUE`. Validación: para cada artículo, el registro vigente importado debe coincidir con ListaComponentes!E y G actuales.
5. `orden_compra` y sus líneas, desde Órdenes A6:L10016.
6. Políticas de reabasto y stock, desde el archivo de inventario (otro análisis).
7. Pruebas de conciliación:
   - número de artículos;
   - suma de costos vigentes;
   - número de OC por status;
   - para 20 artículos al azar, que el precio sugerido del ERP sea igual al F actual.

---

## 6. Problemas de calidad de datos

**Identidad y llaves**
1. **No hay llave estable.** Todo cruza por nombre de texto:
   - 34 nombres duplicados exactos en ListaComponentes; ejemplos: "Banda B-40", "Catarina 60-45", "Motorreductor 3F  2HP caja 63  25:1".
   - 577 nombres con espacios dobles o al inicio o al final, y 43 con espacio duro (NBSP).
   - Variantes de nombre entre archivos: solo 2,450 de 3,651 artículos de inventario coinciden exacto con el catálogo.
2. **Número de Ítem** duplicado en 6 casos (263, 264, 265, 530, 533, 3935), con 911 huecos y 34 números preasignados sin artículo.
3. **ACTUALIZACIONES tiene 44 filas (33 nombres) cuyo componente ya no existe** en ListaComponentes (C = `#N/A` en 37). Son renombres o borrados que rompieron el historial. Ejemplos: "Reductor caja 90 25:1", "Buril calzado 3/8"  AR6  Derecho  K-68".
4. Al revés, **58 componentes del catálogo no tienen ningún precio** (57 con "Aún no hay registros").

**Unidades**

5. **33 variantes de unidad** (pieza/Pieza/`pieza `/pza, metro/Metro/mts, tramo/Tramo…), con 2 vacías y 1 "-". No hay validación.
6. **La unidad de los precios históricos no se guarda**: ACTUALIZACIONES!C es un VLOOKUP a la unidad actual. Cuando cambió la unidad (pieza→cm en perfiles y barras), el historial quedó mezclado.
   - Hay 27 saltos de más de 8× entre precios consecutivos de un mismo artículo; p. ej. "Cuadrado acero 1018 3/4" x 5.80 mts" $120 → $1.00, "Tuerca 1" ACME" $4.23 → $76.56, "Motor de 6.5 hp… kohler" $27,500 → $2,750.
   - Algunos son errores de captura (un cero de más o de menos).
7. 5 artículos con unidad distinta entre el catálogo y el inventario (p. ej. "Malla tejida 3/16"…": pieza contra metro).

**Costos**

8. **Dos "costos" por registro** (D redondeado contra G real) sin que esté documentado (§3.5). G mezcla números, números con texto ("228 SE COBRAN 12"") y notas libres.
9. 82 registros sin costo, 15 con costo 0, 3 costos sin formato de moneda (`260`, `2000`, `250`) y 48 filas duplicadas exactas (misma fecha, componente, costo y proveedor).
10. **Margen de venta escrito a mano dentro de la fórmula** en 24 filas; no se ve sin abrir la fórmula. La columna "Ut. personalizada" solo se usa en 2.
11. Orden físico: 28 filas fuera de orden cronológico en ACTUALIZACIONES. Hoy no afecta el costo vigente, pero el catálogo toma la última fila y no la última fecha. Hay 9 registros de 2011 y 1 de 2017 (fechas de 2011 posiblemente mal capturadas).

**Proveedores**

12. Validación no estricta: 35 nombres de proveedor fuera del directorio en ACTUALIZACIONES (186 filas) y 11 en Órdenes. Hay variantes de mayúsculas ("Hegamex"/"HEGAMEX"/"hegamex", "Huesario"/"HUESARIO", "Ovillos y conos"/"Ovillos y Conos"), 83 registros de precio sin proveedor y 34 renglones de OC sin proveedor.
13. Directorio:
    - 5 nombres duplicados ("Riasa", "Emerson Gualberto Sanchez Salazar", …) y 4 RFC repetidos (`ANE140618P37` ×3).
    - 6 RFC mal formados (`CAL020408-HZ4`, `FKA120227---`, `IIN160318Q`…).
    - País escrito de 7 formas.
    - Mezcla proveedores con conceptos de gasto y personas.

**Órdenes**

14. Fechas: 15 en el futuro (2035, 2029). El formato de presentación cambia desde la fila ~7963; el tipo no.
15. Folio: "Vale" (51), "-", "s/n", "NC", "1594.1". La secuencia retrocede 10 veces. Hay OC con varios proveedores o varias fechas.
16. Status con faltas de ortografía (CALCELADO, CACELADO), mayúsculas mezcladas (ENTREGADO, que no está en la lista) y 142 vacíos. Hay 663 "Enviado" y 478 "Pedido" abiertos desde 2021, que probablemente nunca se cerraron.
17. La columna "Fecha de Vencimiento" mezcla fechas con estados de pago (PAGADA/PAGADO/ANT/SE DEBE…).
18. 110 renglones con el artículo escrito en "Nota Extra" en lugar de "Articulo". 723 renglones con artículos que no existen en el catálogo, porque la validación usa la lista del inventario.
19. Órdenes **no tiene precio ni importe**: no se puede reconstruir el gasto por OC sin cruzar con ACTUALIZACIONES.

**Fórmulas y estructura**

20. `STOCKS BAJOS 2.0!G`: el rango del VLOOKUP es relativo (`ListaComponentes!A3:E` → `A4:E` → …), así que puede no encontrar artículos de las primeras filas del catálogo.
21. En el inventario, `Demanda!Y`: `U1922` en lugar de `U8` en la regla de "Excedente".
22. `ListaComponentesAlmacen!H` se llama "Notas 1" pero contiene el stock de seguridad manual. 3 celdas con texto ("ya no se utiliza", "NO SE USA ", "F900A Serie 300611") rompen el cálculo y producen `#VALUE!` en status, pendiente y punto mínimo.
23. Stock negativo en 2 artículos ("Manguera licuatite 2"" −0.5, "Tiron tipo gancho…" −2).
24. Referencias rotas:
    - `PANEL COMPRAS!F12` (`#REF!`).
    - `Lista para Imprimir` completa (`=#REF!`).
    - `STOCKSBAJOS` (archivo origen borrado).
    - `Análisis de Precios!A21` (`jkGPT` → `#NAME?`).
    - `Calculos Montacargas!X4`, `X6`, `X10`… (`#REF!`).
25. Basura en ACTUALIZACIONES!T9:X17: un cálculo de envíos de otro negocio.
26. Artículos "de una sola vez": bandas armadas o tramos vulcanizados a la medida dados de alta como artículos permanentes (unidad "tramo" 72, nota "UNICA VEZ" 14). Inflan el catálogo.
27. Valores de status `#VALUE!` y "Error, stock negativo" llegan como texto al espejo. El importador no debe tomarlos como estados válidos.

---

## 7. Preguntas abiertas para el negocio (antes de cerrar el esquema)

1. ¿D ("COSTO sin iva") es deliberadamente un costo con colchón, y G el costo real? ¿Cuál debe usar el costeo de maquinaria?
2. ¿Qué significa exactamente cada status de orden: Pendiente, Pedido, Enviado, Recibido y Entregado? ¿Las "Enviado" de 2021 están cerradas?
3. ¿El cotizador lee ListaComponentes!E (costo) o F (precio sugerido)? ¿Desde qué archivo?
4. ¿Las bandas a la medida ("31 mts PVC120… vulcanizada", unidad tramo) deben ser artículos de catálogo o líneas configurables de cotización u OC?
5. ¿Quieren conservar el margen por artículo (las 24 excepciones) o pasar a márgenes por categoría?
6. ¿El directorio de proveedores en el ERP incluirá acreedores y gastos (impuestos, nómina, casetas) o solo proveedores de compras?

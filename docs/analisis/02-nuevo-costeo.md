# 02 · "Nuevo Costeo": análisis para el ERP

- **Archivo:** `Nuevo Costeo`, spreadsheetId `1sFjjiLxpsiFf0zroiv4RSWb4a5zmvCacABNg2bf9y6E`
- **Dueño:** abel.jr@hegamex.com. Creado el 2021-07-16 y modificado por última vez el **2026-10-02**: está vivo.
- **Configuración que importa:** locale `es_MX`, zona `America/Mexico_City`, **cálculo iterativo ACTIVADO** (`maxIterations 50`, `convergenceThreshold 0.05`). Hace falta porque el precio tiene una referencia circular (ver §3.5).
- **Método:** todo se hizo en solo lectura. Leí las fórmulas con `get_spreadsheet` y los valores con `get_values`. Las pestañas grandes (BASE EQUIPOS, EQUIPOS, Componentes, Componentes Inventario) las bajé a archivos locales y las procesé con Python fuera del contexto, para contar filas, cruzar llaves y recalcular precios. Los valores que leí son los **formateados** (por ejemplo, `0.33` donde la celda guarda 1/3).
- **Verificación clave:** recalculé el precio de lista de los **476 equipos con costo numérico** con la fórmula de §3.6. Coincide al centavo con la columna V y al peso con la W en los 476 casos, sin ninguna diferencia.

---

## 0. Resumen ejecutivo

1. **El modelo es sencillo y es determinista.** Costo directo = Σ (cantidad × último costo del componente) sobre la lista de materiales (BOM) del equipo. A ese costo se le suman recargos en % **sobre el costo** (mermas, luz, administración y, opcionalmente, medida especial) y recargos en % **sobre el precio de venta** (Planta Milpillas, MKT, tarjeta de crédito, comisiones y garantía). La utilidad esperada se "infla" para compensar el ISR (25%). Al final el precio se redondea hacia arriba, a $100 si es menor a $100,000 y a $1,000 si no.
2. **El BOM es plano, de un solo nivel:** `BASE EQUIPOS` = (ID equipo, nombre del componente, cantidad). Tiene **24,414 líneas para 481 equipos**, con una mediana de 49 líneas por equipo y un máximo de 248 (E-221). No hay sub-ensambles ni reglas paramétricas.
3. **"Reglas" no son reglas de configuración.** Es la **tabla de porcentajes por tipo de equipo** (el "panel de utilidad"), con 11 tipos. **"Condicionantes"** es solo la lista `No`/`Sí` que alimenta la validación de "¿Medida especial?". Ninguna de las dos tiene lógica del tipo "si mide X lleva tal motor": cada variante es un equipo aparte con su BOM completo.
4. **El acero no se calcula en kg.** Se captura como fracciones de pieza comercial (por ejemplo, 5.5 láminas cal. 14 de 4×10), como metros de perfil o como centímetros de barra. **Las horas hombre son 4 "componentes"** con unidad `horas`: pailería $87.67/h, tornero $90.80/h, pintor $80.18/h y detallado $71.94/h. Su tarifa viene de la hoja de compras igual que cualquier pieza. La mano de obra es el **21.5%** del costo directo sumado de todo el catálogo.
5. **Todas las llaves son nombres de texto.** El BOM se liga al componente por **nombre** (VLOOKUP exacto, insensible a mayúsculas) y el costo del equipo se suma por **nombre del equipo** (SUMIF sobre la columna B), no por ID. Hoy hay **6 equipos en "Error en el costeo"** porque dos nombres de componente ya no existen en compras.
6. **Entradas:** la hoja de compras (`ListaComponentes`, nombre/unidad/ítem/último costo, tope de 5,000 filas) y la de inventario (stocks bajos). **Salidas:** el COTIZADOR GENERAL importa `EQUIPOS!A,B,G,W,AG` (ID, nombre, descripción, **precio de lista sin IVA** e imagen), y compras lee el umbral de `Monitor Stocks Bajos!F2`.

---

## 1. Pestañas: propósito, estado y filas reales

| # | Pestaña | Cuadrícula | Filas con datos reales | Propósito | Estado |
|---|---|---|---|---|---|
| 0 | **Buscador** | 1019×41 | El selector (A2), un encabezado (fila 22) y **0 filas de resultado** hoy | Ficha de consulta: eliges un equipo por **nombre** en A2 y un `QUERY` trae su resumen (costo, precio, utilidades) y su BOM. Tiene una gráfica de dona "Costo" por categoría de componente, más otra gráfica "Costo". | **Semi-roto.** El nombre seleccionado ("Transportador helicoidal tipo bazuca de 6" x 8 metros sin cabrilla") ya no existe en EQUIPOS, así que no muestra nada. Es una herramienta de consulta, no un dato. |
| 1 | **BASE EQUIPOS** | 26265×8 | **24,415 filas** (4–24418): 24,414 líneas de BOM más la fila base E-000 | **Lista de materiales de todos los equipos.** Va una fila por (equipo, componente) y está ordenada alfabéticamente por material. | **Viva y es el núcleo.** Tiene un filtro activo que oculta 479 IDs. |
| 2 | **EQUIPOS** | 990×35 | **482 equipos con nombre** (481 reales más E-000) y 504 filas con ID reservado sin nombre (hasta E-998) | **Catálogo de equipos y hoja de precios:** tipo, medida especial, descripción comercial, imagen, costo, recargos, precio de lista, utilidades. | **Viva.** Es la que lee el cotizador. Tiene un filtro activo que oculta 480 nombres. |
| 3 | Monitor Stocks Bajos | 8927×26 | **18 artículos** (filas 5–22) | Espejo de "stocks bajos" de inventario: estatus, mínimo pendiente, inversión aproximada y demanda mensual de oct-2025 a sep-2026. Tiene un parámetro editable "Controlador de Flexibilidad" ($2,000 en F2). | **Viva**, pero es del dominio de inventario y compras, no de costeo. Está protegida para 4 usuarios. |
| 4 | **Reglas** | 250×16 | 11 tipos (filas 4–14) y unas 20 notas de historial (N:O) | **Panel de utilidad:** porcentajes por tipo de equipo. | **Viva.** Protegida: solo pueden editar abel.jr@ y abel@. La última nota de historial es del 11/01/24. |
| 5 | Componentes Inventario | 6662×26 | **3,658** (filas 3–3660) | Lista **estática** de componentes → categoría (por ejemplo, "Mano de Obra", "Acero", "Eléctricos"). Solo la usa el Buscador para su gráfica por categoría. | **Desactualizada.** Son valores pegados sin fórmula. 1,560 componentes de compras no aparecen aquí. |
| 6 | Hoja 12 (oculta) | 1000×39 | ~30 celdas | Prototipo viejo de "ficha de costeo" de una ZEUS 30 con porcentajes antiguos, valores estáticos. | **Abandonada.** |
| 7 | Condicionantes (oculta) | 1000×8 | 2 (`No`, `Sí` en B3:B4) | Lista para la validación de `EQUIPOS!F` ("¿Medida especial?"). El rango con nombre `Condicionantes` = B3:B7. | Viva, pero trivial. |
| 8 | **Componentes** | 7703×8 | **4,073** (filas 3–4075) | **Espejo de la lista de precios de compras**, vía 2 `IMPORTRANGE`: nombre, unidad, número de ítem y último costo. Es el origen del costo unitario del BOM. | **Viva.** Es la entrada principal. |
| 9 | debug | 1001×15 | ~20 | Comparativo único entre E-178 (acero al carbón) y E-472 (inoxidable): "3.1 veces más costoso en acero inoxidable". Estático. | Abandonada (análisis puntual). |
| 10 | Prov | 1000×26 | **0** | Vacía. | Abandonada. |
| 11 | Hoja 13 | 1000×26 | 12 meses | Tabla de impuestos pagados por mes (ISR RESICO PM, retenciones, IVA, recargos). Nada que ver con el costeo. | Abandonada o ajena. |
| 12 | Hoja 18 | 1000×26 | 462 | Catálogo **viejo** de nombres de equipo con su costo anterior (G, estático) contra el costo recalculado por nombre (F, `SUMIF`). Solo 9 de los 462 nombres existen hoy. Era una ayuda para una migración o renombre. | Abandonada. |
| 13 | Hoja 20 | 1000×26 | 61 | Lista suelta (cantidad, material) de material eléctrico y neumático para un tablero. | Borrador. |
| 14 | Hoja 19 | 854×26 | 57 | Lista suelta (material, cantidad). | Borrador. |

**Rangos con nombre** (sirven para validaciones y listas desplegables):

| Nombre | Rango | Uso |
|---|---|---|
| `ID` | EQUIPOS!A3:A990 | Validación de `BASE EQUIPOS!A` |
| `Equipos` | EQUIPOS!B3:B990 | Validación de `Buscador!A2` |
| `Componentes` | Componentes!A3:A7703 | Validación de `BASE EQUIPOS!C` |
| `TiposEquipos` | Reglas!A4:A50 | Validación de `EQUIPOS!E` |
| `Condicionantes` | Condicionantes!B3:B7 | Validación de `EQUIPOS!F` |

---

## 2. Columnas de las pestañas importantes

### 2.1 BASE EQUIPOS: líneas de BOM

Las filas 1–3 son título y encabezado, y los datos empiezan en la fila 4. La fila 4 es `E-000 BASE (NO BORRAR)`: es la que contiene las `ARRAYFORMULA` de B, E, F y G. Nota en C1: *"Filtrar materiales para hacer correción masiva o sustitución de material."*

| Col | Encabezado | Tipo | Ejemplo real (fila 5) | Significado | Manual / fórmula |
|---|---|---|---|---|---|
| A | ID | texto `E-###` | `E-442` | Equipo al que pertenece la línea | **Manual**, con desplegable validado contra `=ID` |
| B | Nombre del equipo | texto | `Banda transportadora para granel de 18" x 6.5 metros en acero inoxidable ` | Nombre del equipo | Fórmula en B4: `=arrayformula(IF(A4:A="","",VLOOKUP(A4:A,EQUIPOS!$A$3:$B,2,0)))` |
| C | Material | texto | `12.35 MTS BANDA NERVADA EN 18" ANCHO SIN FIN` | **Componente: es la llave por NOMBRE** hacia Componentes | **Manual**, con desplegable validado contra `=Componentes` |
| D | Cantidad | número (decimales) | `1.30` | Cantidad en la unidad del componente | **Manual** |
| E | Unidad | texto | `tramo` | Unidad del componente | Fórmula en E4: `=arrayformula(IF(C4:C="","",VLOOKUP(C4:C,Componentes!$A$3:B,2,0)))` |
| F | Costo Unit | moneda | `$11,500.00` | Último costo registrado por compras | Fórmula en F4: `=ARRAYFORMULA(IF(C4:C="", "", VLOOKUP(C4:C, Componentes!$A$3:$D, 4, 0)))` |
| G | Costo | moneda | `$14,950.00` | D × F | Fórmula en G4: `=arrayformula(IF(D4:D="","",(D4:D*F4:F)))` |
| H | ¿Repetido? | booleano | `FALSE` | Avisa si la fila repite equipo y material de la fila **anterior** | Fórmula por fila, `=IF(B5="","", AND((B5=B4),(C5=C4)))`. La de la fila 4 dice `B4=B2`, `C4=C3`. |

Distribución de unidades en las 24,415 líneas: `pieza` 15,488 · `metro` 3,923 · **`horas` 1,507** · `cm` 1,396 · `kilo` 692 · `litro` 546 · `carga` 243 · `juego` 194 · `servicio` 117 · `caja` 82 · `m2` 75 · `pulgada` 66. Además hay variantes sucias: `Pieza`, `pieza `, `mts`, `Metro`, `Tramo`, etc.

### 2.2 EQUIPOS: catálogo y precio

La fila 2 es el encabezado y los datos empiezan en la fila 3 (E-000). En la fila 1 están la nota B1 *"Este será el nombre mostrado en el cotizador."*, el parámetro **AB1 "ISR recup aprox=" / AC1 = 25%** y una celda suelta AA1 `=J455/X455`. Las columnas A–H están congeladas.

| Col | Encabezado | Tipo | Ejemplo real (E-315, fila 4) | Significado | Manual / fórmula |
|---|---|---|---|---|---|
| A | ID | texto | `E-315` | Clave del equipo | Manual. Hay IDs pre-capturados hasta E-998. |
| B | Título del Equipo | texto | `Banda cargadora de 18" x 13 metros con levante y cable` | **Nombre comercial; es la llave real del costeo** | Manual |
| C | Inoxidable | — | (vacío en todas) | Bandera sin usar | Manual, 0 valores |
| D | GASOLINA | — | (vacío en todas) | Bandera sin usar | Manual, 0 valores |
| E | Tipo | lista | `Banda Transportadora` | Tipo de equipo → fila de Reglas | Manual, validado contra `=TiposEquipos` |
| F | ¿Medida especial? | `Sí`/`No` | `No` | Activa el cargo extra por medida especial | Manual, validado contra `=Condicionantes` |
| G | Descripcion | texto largo con viñetas | `• Tipo Cargadora para Costales… • Motorreductor de 3 Hp…` | Ficha técnica para la cotización (436 de 482 la tienen, mediana de 644 caracteres) | Manual |
| H | Imagen (link) | URL | (71 equipos con link) | Link de Drive o .jpg/.png | Manual |
| I | Imagen del link | imagen | — | Vista previa | `=ARRAYFORMULA( if(AG3:AG="","", IMAGE(AG3:AG)))` |
| **J** | **Costo** | moneda | **$91,345.69** | **Costo directo = Σ BOM** | Por fila: `=IF(B4="", "", IFERROR(SUMIF('BASE EQUIPOS'!$B$4:$B, B4, 'BASE EQUIPOS'!$G$4:$G), "Error en el costeo, revisar la lista de componentes"))`. Nota en J2: *"NO SE PUEDE APLICAR FORMULA ARRAY, FALLA A PARTIR DE CIERTA FILA"*. |
| K | Cargo por medida especial | moneda | (vacío) | J × % de medida especial | Por fila: `=IF(F4="Sí", IFERROR(J4*VLOOKUP(E4,Reglas!$A$4:$L,12,0),""),"")` |
| L | Mermas | moneda | $2,740.37 | J × % de mermas | ARRAYFORMULA en L3: `=ARRAYFORMULA(IF(E3:E="", "", IFERROR(J3:J * VLOOKUP(E3:E, Reglas!$A$4:$J, 3, 0), "")))` |
| M | Luz | moneda | $913.46 | J × % de luz | Igual que L, columna 4 de Reglas |
| N | Administrativos y servicios | moneda | $5,937.47 | J × % de administración | Igual que L, columna 5 de Reglas |
| O | Gastos Fin y de recup por Planta Milpillas | moneda | $2,019.41 | **V** × % de Planta Milpillas | `=arrayformula(IFERROR(V3:V*VLOOKUP(E3:E,Reglas!$A$4:$J,6,0),""))` |
| P | MKT | moneda | $2,019.41 | **V** × % de MKT | Igual que O, columna 7 de Reglas |
| Q | Rec. Tarjeta Cr. | moneda | $706.79 | **V** × % de tarjeta | Igual que O, columna 8 de Reglas |
| R | Comisiones | moneda | $6,058.24 | **V** × % de comisiones | Igual que O, columna 9 de Reglas |
| S | Rec Garantía | moneda | $4,038.83 | **V** × % de garantía | Igual que O, columna 10 de Reglas |
| T | Gastos de publicidad y venta | moneda | $12,823.27 | P+Q+R+S | `=ARRAYFORMULA(IF(B3:B="", "", P3:P + Q3:Q + R3:R + S3:S))` |
| U | Costo Total | moneda | $115,779.67 | J+K+L+M+N+O+T | `=ARRAYFORMULA(IF(B3:B="", "", J3:J + K3:K + L3:L + M3:M + N3:N + O3:O + T3:T))` |
| **V** | **Precio Bruto** | moneda | **$201,941.29** | Precio calculado sin redondear | Por fila: `=IFERROR(U4/(1-(VLOOKUP(E4,Reglas!$A$4:$J,2,0))/(1-EQUIPOS!$AC$1)),"")` |
| **W** | **Precio de lista bruto (sin iva)** | moneda | **$202,000.00** | **El precio que consume el cotizador** | Por fila: `=IF(B4="","",IF(J4="Error en el costeo, revisar la lista de componentes","Error en el costeo",IF(V4<100000,ROUNDUP(V4,-2),ROUNDUP(V4,-3))))` |
| X | Precio Neto | moneda | $234,320.00 | W con IVA | `=IF(B4="","",W4*1.16)` |
| Y | Utilidad e iva | moneda | $118,540.33 | X − U | `=IF(B4="","",X4-U4)` |
| Z | Utilidad Bruta (libre de Iva) | moneda | $86,220.33 | Y − 16%·W (equivale a W − U) | `=IF(B4="","",Y4-(W4*0.16))` |
| AA | Ut. Bruta % | % | 42.70% | Z / **V** | `=IFERROR(IF(B4="","",Z4/V4),"")` |
| AB | Utilidad Neta (libre de ISR) | moneda | $64,665.25 | Z × (1 − ISR) | `=IF(Z4="","",Z4-(Z4*EQUIPOS!$AC$1))` |
| AC | Ut. NETO % | % | 32.01% | AB / **W** | `=IF(AB4="","",AB4/W4)` |
| AD | (sin encabezado) | — | — | Vacía, salvo una fórmula suelta en AD499 | — |
| AE | (sin encabezado) | `OK`/`REPETIDO` | `OK` | Avisa si el nombre es igual al de la fila anterior | Por fila: `=IF(B4="","", IF(B4=B3,"REPETIDO","OK"))` |
| AF | Notas | texto | `Fabricada originalmente para Holcim` (E-002) | Nota libre (solo 2 equipos la tienen) | Manual |
| AG | Link Imagen Convertida | URL | — | Convierte el link de Drive a `lh3.googleusercontent.com/d/<id>=w1000` | ARRAYFORMULA con `REGEXMATCH`/`REGEXEXTRACT` sobre H |

Tipos de los 482 equipos con nombre: Bazuca 145 · Banda Transportadora 115 · OTRO 45 · Elevador 43 · Tolva 39 · Cribadora 27 · Silo para Cemento 26 · Dosificadora 23 · Mezcladora 11 · ESPECIAL CEMEX 4 · Baja Utilidad 4. "¿Medida especial?": `No` 472, `Sí` 5 (E-351, E-221, E-263, E-409, E-341) y vacío 5.

### 2.3 Reglas: panel de porcentajes

Encabezados: en la fila 1 agrupan "De Administración" sobre E y "De Venta" sobre G. En la fila 3 vienen las notas: C3 *"Porcentaje extra respecto al costo."*, F3 *"Porcentaje extra respecto al precio de venta."* y L3 *"Porcentaje extra respecto al costo (no respecto al precio de venta)."*

| Col | Encabezado | Base | Leída desde EQUIPOS |
|---|---|---|---|
| A | Equipo (tipo) | — | Llave de los `VLOOKUP` (E de EQUIPOS) |
| B | Utilidad Esperada | margen sobre precio, compensado por ISR | V (col. 2) |
| C | Mermas | costo | L (col. 3) |
| D | Luz | costo | M (col. 4) |
| E | Administrativos y servicios | costo | N (col. 5) |
| F | Uso de Planta Milpillas | precio | O (col. 6) |
| G | MKT | precio | P (col. 7) |
| H | Rec. Tarjeta Cr. | precio | Q (col. 8) |
| I | Comisiones | precio | R (col. 9) |
| J | Rec Garantía | precio | S (col. 10) |
| K | (vacía) | — | — |
| L | ¿Medida Especial? | costo | K (col. 12) |
| N:O | Fecha / Historial | texto libre | No la lee ninguna fórmula |

Los valores actuales están en §4.

### 2.4 Componentes: espejo de la lista de precios de compras

| Col | Encabezado | Ejemplo | Origen |
|---|---|---|---|
| A | Componente | `Festo Sensor Magnetico Smt-8m-a-ps-24v-e-0,3-m8d` | A2: `=IMPORTRANGE("1yMB2r3KAPPpIBghyd8qzB-dgmpxPiq1fs1lY03smRxw","ListaComponentes!A2:B5000")` |
| B | Unidad de medida | `pieza` | (mismo IMPORTRANGE) |
| C | Número de Ítem | `0` … `4,977` | C2: `=IMPORTRANGE("1yMB2r3KAPPpIBghyd8qzB-dgmpxPiq1fs1lY03smRxw","ListaComponentes!D2:E5000")` |
| D | Último costo por unidad registrado | `$735.00` | (mismo IMPORTRANGE) |
| E–H | (vacías) | | |

Hoy hay 4,073 componentes. En el origen, `ListaComponentes!B1` advierte: *"Modificar o eliminar nombres de la lista puede afectar al costeo de los equipos. Avisar antes al encargado de generar los costeos"*. Es decir, el propio negocio sabe que el nombre es la llave. El origen también tiene la columna C ("cantidad mínima por paquete") y la F ("Precio de venta sugerido"), que este archivo no importa.

### 2.5 Componentes Inventario

Es estática: B = nombre del componente, C = unidad, D = **categoría**. Hay 53 categorías, por ejemplo Eléctricos 364, Tornillería 285, Material para aire 228, Perforación 184, Acero 175, Motores 170, Mano de Obra… y 493 filas sin categoría. Solo la usa `Buscador!I`: `=IF(B23="","", IFERROR(VLOOKUP(C23,'Componentes Inventario'!$B$3:E,3,0),"Otros"))`.

### 2.6 Buscador

- A2: nombre del equipo, con desplegable validado contra `=Equipos`.
- C4: `=query(EQUIPOS!B2:AC,CONCATENATE("select B, J, W, Y, AB, AC WHERE B ='",A2,"'"),1)` trae título, costo, precio de lista, utilidad e IVA, utilidad neta y % neto.
- A22: `=query('BASE EQUIPOS'!A3:G,CONCATENATE("select * WHERE B ='",A2,"'"),1)` trae el BOM del equipo.
- I23:J: categoría (de Componentes Inventario) y costo de cada línea, que alimentan la dona "Costo" (`pieChart`, dominio I22:I1019, serie J22:J1019).

### 2.7 Monitor Stocks Bajos

| Col | Contenido | Origen |
|---|---|---|
| F2 | **$2,000**, "Controlador de Flexibilidad": *"Compras mayores a esta cantidad se permite su flexibilidad de compra o esperas debido a alta inversión."* | **Manual. Es una SALIDA** (compras la lee). |
| B:F | Nombre, STATUS, STOCK ACTUAL, CANT. MÍN. PENDIENTE, Unidad | B4: `=IMPORTRANGE("1sOh_Gyj0ofi7aSYKdKmCJSyT_H6G1_wH18OlrybY2QE","'STOCKS BAJOS 2.0'!A1:E")` |
| G:H | Inversión Aprox, Notas | G4: `=IMPORTRANGE("1yMB2r3KAPPpIBghyd8qzB-dgmpxPiq1fs1lY03smRxw","'STOCKS BAJOS 2.0'!G3:H300")`. En el origen, G = `VLOOKUP(B4,ListaComponentes!A3:E,5,0)*E4` y H compara contra el umbral. |
| L:X | Demanda por mes (oct-2025 … sep-2026) y DEMANDA PROM. POR MES | L4: `=IMPORTRANGE("1sOh_Gyj0ofi7aSYKdKmCJSyT_H6G1_wH18OlrybY2QE","'STOCKS BAJOS 2.0'!K1:Y")` |
| Z4 | "Porcentaje de Desabasto:" | Etiqueta sin valor |

---

## 3. El modelo de costeo completo

### 3.1 Flujo de datos

```
Compras "Costo y actualizaciones de los componentes 2.0" (1yMB…)
   ListaComponentes!A:B (nombre, unidad), D:E (ítem, último costo)
        │ IMPORTRANGE (tope de 5,000 filas)
        ▼
 Componentes!A:D ──VLOOKUP por NOMBRE──► BASE EQUIPOS (ID, Material, Cantidad → Unidad, Costo Unit, Costo)
                                              │ SUMIF por NOMBRE de equipo (columna B)
                                              ▼
 Reglas (% por tipo) ──VLOOKUP por Tipo──► EQUIPOS: J costo → K..N recargos s/costo
 EQUIPOS!AC1 (ISR 25%) ─────────────────►         → V precio (circular con O..S) → W redondeo
                                                                            │
                                                            IMPORTRANGE A, B, G, W, AG
                                                                            ▼
                                                          COTIZADOR GENERAL (1q7Gc…)
```

### 3.2 Nivel 1: línea de BOM

`Costo línea (G) = Cantidad (D) × Último costo unitario del componente (F)`, donde `F = VLOOKUP(Material, Componentes!A:D, 4, 0)`.

- La coincidencia es **exacta pero no distingue mayúsculas**. Por ejemplo, `estopa` encuentra `Estopa`.
- Si el nombre no está en Componentes, F da `#N/A`, G da `#N/A` y el `SUMIF` del equipo falla. Por eso J muestra "Error en el costeo…".
- Si la cantidad está vacía, G queda `""` y la línea **cuenta como $0 sin avisar**.
- Si el componente no tiene costo en compras, F queda `""` y G = $0, también sin avisar.

### 3.3 Nivel 2: costo directo del equipo (J)

`J = SUMIF('BASE EQUIPOS'!B:B, <nombre del equipo>, 'BASE EQUIPOS'!G:G)`

Se agrega por **nombre**, no por ID. Lo comprobé: la suma por ID da el mismo resultado en los 482 equipos, así que hoy no hay nombres duplicados. Aun así, la relación depende del texto.

### 3.4 Nivel 3: recargos sobre el costo

```
K = J × Reglas.L   (solo si EQUIPOS.F = "Sí")      medida especial
L = J × Reglas.C   mermas
M = J × Reglas.D   luz
N = J × Reglas.E   administrativos y servicios
```

Ojo: L, M y N se calculan sobre J, **no** sobre J+K.

### 3.5 Nivel 4: recargos sobre el precio (circulares)

```
O = V × Reglas.F   Planta Milpillas
P = V × Reglas.G   MKT
Q = V × Reglas.H   tarjeta de crédito
R = V × Reglas.I   comisiones
S = V × Reglas.J   garantía
T = P + Q + R + S
U = J + K + L + M + N + O + T     ← "Costo Total" (incluye O, que no está en T)
V = U / (1 − Reglas.B / (1 − ISR))     ← V depende de U, y U depende de V: referencia CIRCULAR
```

La hoja la resuelve con **cálculo iterativo** (50 iteraciones, umbral 0.05).

### 3.6 Forma cerrada (la que debe implementar el ERP)

Si se despeja la circularidad:

```
costo_base   = J × (1 + %mermas + %luz + %admin) + K
%sobre_precio = %milpillas + %mkt + %tarjeta + %comisiones + %garantía
V = costo_base / (1 − %utilidad/(1 − ISR) − %sobre_precio)
W = ROUNDUP(V, −2) si V < 100,000;  si no ROUNDUP(V, −3)      (en pesos, hacia arriba)
X = W × 1.16
```

Con esta fórmula se reproducen los 476 precios V/W de la hoja **sin ninguna diferencia**.

Lo que significa: como `Z = W − U` y `AB = (1−ISR)·Z`, el % neto `AC = AB/W` ≈ **%utilidad esperada de Reglas**. La "Utilidad Esperada" es el **margen neto después de ISR sobre el precio de venta**, y lo que queda por encima sale solo del redondeo hacia arriba (E-315: 32% esperado → 32.01% real).

Con los parámetros vigentes, para una banda (u = 32%), el factor es `1.105 / (1 − 0.32/0.75 − 0.0735) = 1.105 / 0.499833 = 2.2107 × J`. Para dosificadora, tolva, silo, mezcladora y elevador (u = 34%) es `1.105 / 0.473167 = 2.3353 × J`.

### 3.7 Acero (kg) y horas hombre: cómo están modelados de verdad

- **Acero: no hay ningún cálculo en kg en este archivo.** El acero entra como un componente más, en su unidad comercial:
  - Lámina y placa por **pieza 4×10**, con fracciones: `Lamina calibre 14 4X10` 5.5 pza × $1,040.
  - PTR por pieza: `PTR 4X3 Blanco` 4.5 pza × $1,200.
  - Ángulo, solera, tubo, canal, redondo y viga IPR por **metro**.
  - Cuadrado de acero 1018 por **cm**.
  - Placa de 1/2 por **m²**.
  - Corte CNC por **pulgada**.

  Algunos nombres traen el peso (`Canal U 6" x 12.12 Kg/Mt`, `Viga IPR 10" x 8" x 49.10 kg/mt`), pero se cobran por metro. Si el ERP necesita kg de acero, tendrá que agregar el atributo `kg_por_unidad` al componente; hoy no existe.
- **Consumibles** (soldadura, micro alambre, CO₂, argón, discos, estopa, thinner, pintura) también son líneas del BOM, con cantidades prorrateadas: `Carga de CO2 de 25 kg` 0.6 carga, `Cubeta de pintura…` 0.6 pza.
- **Horas hombre**: son 4 componentes con unidad `horas` cuyo "último costo" viene de compras igual que cualquier pieza. Aparecen en 476 de los 481 equipos.

  | Componente | Tarifa actual | Horas totales en el catálogo |
  |---|---|---|
  | Horas hombre pailería | $87.67/h | 114,021 h |
  | Horas hombre tornero | $90.80/h | 10,722 h |
  | Horas hombre Pintor | $80.18/h | 13,043 h |
  | Horas hombre detallado | $71.94/h | 15,351 h |

  Mano de obra = **21.5%** del costo directo sumado de todo el catálogo ($61.04 M).
- **Servicios externos** (vulcanizado, calibración de tolva, puesta en marcha, permisos, grúas) son líneas con unidad `servicio`.

### 3.8 Ejemplos trazados con números reales

#### Ejemplo A: E-315 "Banda cargadora de 18" x 13 metros con levante y cable"

Tipo Banda Transportadora, medida especial `No`. **49 líneas de BOM.**

Líneas principales:

| Material | Cant. | Unidad | C. unit. | Costo |
|---|---|---|---|---|
| Horas hombre pailería | 195 | horas | $87.67 | $17,095.65 |
| Motorreductor 3F 3HP caja 90 25:1 | 1 | pieza | $15,000.00 | $15,000.00 |
| Banda grip top 2 capas 20" de ancho | 27 | metro | $380.00 | $10,260.00 |
| Cubeta de pintura blanca epóxica… | 0.6 | pieza | $10,000.00 | $6,000.00 |
| Lamina calibre 14 4X10 | 5.5 | pieza | $1,040.00 | $5,720.00 |
| PTR 4X3 Blanco | 4.5 | pieza | $1,200.00 | $5,400.00 |
| Horas hombre Pintor | 40 | horas | $80.18 | $3,207.20 |
| Rin 14", masa, espiga | 2 | juego | $1,550.00 | $3,100.00 |
| Horas hombre tornero | 22 | horas | $90.80 | $1,997.60 |
| … 40 líneas más (tornillería, chumaceras, cable, catarinas, etc.) | | | | |
| **Σ = J** | | | | **$91,345.69** |

Por categoría, tal como lo agruparía el Buscador: Mano de obra 24.4% · Acero 23.9% · Motores 19.3% · Bandas 11.2% · Otros 6.9% · Neumáticos 5.3%. Son 257 horas hombre en total.

| Concepto | Cálculo | Valor |
|---|---|---|
| J Costo | Σ BOM | $91,345.69 |
| K Medida especial | F = "No" | — |
| L Mermas | 91,345.69 × 3% | $2,740.37 |
| M Luz | × 1% | $913.46 |
| N Administración | × 6.5% | $5,937.47 |
| V Precio bruto | (91,345.69 × 1.105) / (1 − 0.32/0.75 − 0.0735) = 100,936.99 / 0.499833 | **$201,941.29** |
| O Planta Milpillas | V × 1% | $2,019.41 |
| P MKT | V × 1% | $2,019.41 |
| Q Tarjeta | V × 0.35% | $706.79 |
| R Comisiones | V × 3% | $6,058.24 |
| S Garantía | V × 2% | $4,038.83 |
| T | P+Q+R+S | $12,823.27 |
| U Costo total | J+L+M+N+O+T | $115,779.67 (comprobación: 115,779.67 / (1 − 0.32/0.75) = 201,941.29 ✔) |
| **W Precio de lista sin IVA** | V ≥ 100k → ROUNDUP(V, −3) | **$202,000.00** |
| X Con IVA | × 1.16 | $234,320.00 |
| Y Utilidad e IVA | X − U | $118,540.33 |
| Z Utilidad bruta | Y − 0.16 × W | $86,220.33 → AA = 42.70% |
| AB Utilidad neta | Z × 0.75 | $64,665.25 → **AC = 32.01%** |

#### Ejemplo B: E-198 "Dosificadora ZEUS 15 móvil"

Tipo Dosificadora (u = 34%), medida especial `No`. **157 líneas.**

Líneas principales: Horas hombre pailería 770 h × $87.67 = $67,505.90 · Rodillo cargador triple 24" 35° 14 × $2,800 = $39,200 · Compresor 5 HP 300 lts $35,000 · PTR 4X4 13 × $1,254.87 = $16,313.31 · Gato cuello de ganso 5 × $3,200 = $16,000 · Pintura 1.5 × $10,000 = $15,000 · Banda 2 capas 26" 26 m × $570 = $14,820 · Horas pintor 180 h = $14,432.40 · … · Servicio de vulcanizado de banda $8,500 · Horas tornero 80 h · Horas detallado 100 h.

**J = $479,917.31** (1,130 horas hombre = $96,396.30, el 20.1%).

| Concepto | Valor |
|---|---|
| L / M / N | $14,397.52 / $4,799.17 / $31,194.62 |
| V | 479,917.31 × 1.105 / (1 − 0.34/0.75 − 0.0735) = 530,308.63 / 0.473167 = **$1,120,764.97** |
| O, P, Q, R, S | $11,207.65, $11,207.65, $3,922.68, $33,622.95, $22,415.30 (T = $71,168.58) |
| U | $612,684.85 |
| **W** | **$1,121,000.00** · X = $1,300,360.00 |
| Z / AA | $508,315.15 / 45.35% |
| AB / AC | $381,236.36 / **34.01%** |

#### Ejemplo C: E-409 "Tolva de 2.5 metros con descarga lateral, pesaje calibre 10 inoxidable"

Tipo Tolva (u = 34%), **medida especial `Sí`**. **23 líneas.**

Líneas principales: Lámina cal. 12 4×10 Inox 2.5 × $5,500 = $13,750 · Horas pailería 130 h = $11,397.10 · 4 celdas de carga × $2,400 = $9,600 · PTR 3×3 Inox 2.5 × $3,200 = $8,000 · Servicio de calibración de tolva de 8 m³ $8,000 · …

**J = $73,049.83.**

| Concepto | Valor |
|---|---|
| **K = J × 10%** | **$7,304.98** |
| L / M / N (sobre J, no sobre J+K) | $2,191.49 / $730.50 / $4,748.24 |
| V | (73,049.83 × 1.105 + 7,304.98) / 0.473167 = 88,025.04 / 0.473167 = **$186,033.91** |
| T | $11,813.15 |
| U | $101,698.54 |
| **W** | **$187,000.00** · X = $216,920.00 |
| AC | 34.21% |

---

## 4. Panel de utilidad (pestaña `Reglas` más `EQUIPOS!AC1`)

### 4.1 Valores vigentes por tipo de equipo (Reglas!A4:L14)

| Tipo | Utilidad esperada | Mermas | Luz | Admin. y serv. | Planta Milpillas | MKT | Tarjeta | Comisiones | Garantía | Medida especial |
|---|---|---|---|---|---|---|---|---|---|---|
| Banda Transportadora | **32%** | 3% | 1% | 6.5% | 1% | 1% | 0.35% | 3% | 2% | 10% |
| Bazuca | **32%** | 3% | 1% | 6.5% | 1% | 1% | 0.35% | 3% | 2% | 10% |
| Cribadora | **32%** | 3% | 1% | 6.5% | 1% | 1% | 0.35% | 3% | 2% | 10% |
| Dosificadora | **34%** | 3% | 1% | 6.5% | 1% | 1% | 0.35% | 3% | 2% | 10% |
| Silo para Cemento | **34%** | 3% | 1% | 6.5% | 1% | 1% | 0.35% | 3% | 2% | 10% |
| Tolva | **34%** | 3% | 1% | 6.5% | 1% | 1% | 0.35% | 3% | 2% | 10% |
| Mezcladora | **34%** | 3% | 1% | 6.5% | 1% | 1% | 0.35% | 3% | 2% | 10% |
| Elevador | **34%** | 3% | 1% | 6.5% | 1% | 1% | 0.35% | 3% | 2% | 10% |
| OTRO | **32%** | 3% | 1% | 6.5% | 1% | 1% | 0.35% | 3% | 2% | 10% |
| Baja Utilidad | **26%** | 3% | 1% | 6.5% | 1% | 1% | 0.35% | 3% | 2% | *(vacío → 0)* |
| ESPECIAL CEMEX | **30%** | 3% | 1% | 6.5% | 1% | 1% | 0.35% | 3% | 2% | 10% |

Cómo se aplica cada grupo:

- **Sobre el costo J** (suman 10.5%): mermas, luz y administración. Medida especial (+10%) solo aplica si `EQUIPOS!F = "Sí"`.
- **Sobre el precio de venta V** (suman 7.35%): Planta Milpillas, MKT, tarjeta, comisiones y garantía.
- **Utilidad esperada:** es el margen neto después de ISR sobre el precio. En la fórmula se divide entre `(1 − ISR)`.

### 4.2 Parámetros globales (no están en Reglas)

| Parámetro | Valor | Dónde |
|---|---|---|
| **ISR recup aprox** (compensación de ISR) | **25%** | `EQUIPOS!AC1`, con la etiqueta en AB1 |
| IVA | 16% | Fijo dentro de las fórmulas X y Z (`*1.16`, `*0.16`) |
| Redondeo | a $100 si V < $100,000; a $1,000 si V ≥ $100,000; siempre hacia arriba | Fijo dentro de la fórmula W |
| Umbral "Controlador de Flexibilidad" | $2,000 | `Monitor Stocks Bajos!F2` (compras; no afecta el precio) |

### 4.3 Historial (Reglas!N:O, texto libre, no versionado)

Selección literal, en orden de aparición:

- 28/01/22 *"Se aumentó del 2.5% al 3% sobre venta la recaudación para comisiones."*
- 31/1/22 *"Se aumentó del 1% al 2% … Recuperación por Garantía"*
- 31/01/22 *"Se bajó del 2% al 1% el concepto de Luz…"*
- 31/1/22 Gasto administrativo: *"$67,200 pesos mensuales … un 6.5% respecto a los costos del 2021"*
- 04/04/22 bandas de 31% a 32%
- Nota sin fecha: *"Se tomó en cuenta el ISR para el cálculo del precio de venta…"*. Con esa medida se bajó la administración del 10% al 6.5%, los gastos financieros del 3% al 1% y la tarjeta del 0.5% al 0.09%.
- 29/04/22 mermas de 2% a 3%
- 15/02/23 se bajan utilidades
- 25/05/23 bandas y bazucas regresan a 30%
- 21/06/23 *"La compensación de ISR pasa del 30 al 25."*
- 05/07/23 administración a 6.5% para silos y plantas
- 05/09/23 *"Se modifican utilidades…"*; tarjeta de 0.09% a 0.35%
- 11/01/24 *"Se sube carga de comisiones del 2% al 3% en todos los equipos."*

**Implicación:** cambiar un % en Reglas o un costo en compras **mueve al instante** el precio que ve el cotizador. No se guarda ninguna foto del precio anterior.

---

## 5. Conexiones con otros archivos

### 5.1 Entradas (IMPORTRANGE dentro de este archivo)

| Celda destino | Archivo origen | Rango origen | Qué trae |
|---|---|---|---|
| `Componentes!A2` | `1yMB2r3KAPPpIBghyd8qzB-dgmpxPiq1fs1lY03smRxw` (Costo y actualizaciones de los componentes 2.0) | `ListaComponentes!A2:B5000` | Nombre, unidad |
| `Componentes!C2` | ídem | `ListaComponentes!D2:E5000` | Número de ítem, último costo |
| `Monitor Stocks Bajos!B4` | `1sOh_Gyj0ofi7aSYKdKmCJSyT_H6G1_wH18OlrybY2QE` (**"2025 - Inventario 2.0- HEGAMEX"**) | `'STOCKS BAJOS 2.0'!A1:E` | Artículo, estatus, stock, mínimo pendiente, unidad |
| `Monitor Stocks Bajos!G4` | `1yMB2r3K…` (compras) | `'STOCKS BAJOS 2.0'!G3:H300` | Inversión aprox, notas |
| `Monitor Stocks Bajos!L4` | `1sOh_Gyj…` (inventario) | `'STOCKS BAJOS 2.0'!K1:Y` | Demanda mensual de 12 meses y promedio |

### 5.2 Salidas (otros archivos que leen de éste; verificado en los archivos destino)

| Archivo destino | Celda | Rango de Nuevo Costeo |
|---|---|---|
| **COTIZADOR GENERAL** `1q7GcReynay14azuRvWBNzUND5KbMap6dSziqXtt8ZH8`, pestaña `precio_equipos` | A2, D2, F2, H2 | `EQUIPOS!A4:B` (id, nombre), `EQUIPOS!W4:W` (**precio_bruto**), `EQUIPOS!G4:G` (descripción), `EQUIPOS!AG4:AG` (imagen_url). En el cotizador: `precio_neto = D*1.16`. |
| COTIZADOR GENERAL, pestaña `PreciosGeneral` | A3, B3, C3, D3, E3 | `EQUIPOS!A2:A`, `EQUIPOS!B2:B`, `EQUIPOS!A2:A`, `EQUIPOS!W2:W`, `EQUIPOS!G2:G` |
| Compras `1yMB2r3K…`, pestaña `'STOCKS BAJOS 2.0'` | H1 | `'Monitor Stocks Bajos'!F2`: umbral de $2,000. **Es un ciclo**: compras lee el umbral de aquí y este archivo vuelve a importar el resultado G:H. |

Puede haber más consumidores. Solo revisé los que se pudieron confirmar abriendo el destino.

---

## 6. Entidades propuestas para el ERP y mapeo del importador

### 6.1 Esquema propuesto (Postgres)

```sql
-- Catálogo de componentes (es dueño compras; aquí solo se referencia)
componente(
  id               bigserial PK,
  numero_item      int UNIQUE,          -- ListaComponentes!D  (= Componentes!C aquí)
  nombre           text NOT NULL,       -- ListaComponentes!A  (único, normalizado)
  unidad_id        → unidad,            -- ListaComponentes!B  (normalizada)
  categoria_id     → categoria_componente, -- Componentes Inventario!D (join por nombre)
  es_mano_obra     bool,                -- true para los 4 "Horas hombre …"
  kg_por_unidad    numeric NULL         -- NUEVO: hoy no existe (para calcular acero en kg)
)
componente_costo(componente_id, costo_unitario numeric, vigente_desde timestamptz, fuente)  -- histórico de "último costo"

tipo_equipo(id, nombre UNIQUE)          -- Reglas!A4:A14 (11 tipos)

concepto_recargo(codigo PK, nombre, base CHECK (base IN ('costo','precio')), condicional bool)
  -- mermas(costo), luz(costo), admin(costo), medida_especial(costo, condicional),
  -- planta_milpillas(precio), mkt(precio), tarjeta(precio), comisiones(precio), garantia(precio)

politica_precio(id, tipo_equipo_id, utilidad_objetivo numeric, vigente_desde, vigente_hasta, nota)
politica_recargo(politica_id, concepto_codigo, porcentaje numeric)   -- una fila por celda de Reglas B..L
parametro_global(clave PK, valor numeric, vigente_desde)            -- isr_compensacion=0.25, iva=0.16,
                                                                     -- redondeo_umbral=100000, redondeo_bajo=100, redondeo_alto=1000

equipo(
  id               bigserial PK,
  clave            text UNIQUE,          -- EQUIPOS!A  ('E-315'); normalizar 'E-39'→? (ver §7)
  nombre           text NOT NULL,        -- EQUIPOS!B
  tipo_equipo_id   → tipo_equipo,        -- EQUIPOS!E
  medida_especial  bool DEFAULT false,   -- EQUIPOS!F = 'Sí'
  descripcion      text,                 -- EQUIPOS!G
  imagen_url       text,                 -- EQUIPOS!AG (normalizada) o H
  notas            text,                 -- EQUIPOS!AF
  es_provisional   bool,                 -- derivado: nombre contiene 'provisional'
  activo           bool
)

bom_linea(
  id               bigserial PK,
  equipo_id        → equipo,             -- BASE EQUIPOS!A (por ID, no por nombre)
  componente_id    → componente,         -- BASE EQUIPOS!C resuelto a numero_item
  cantidad         numeric(14,4) NOT NULL CHECK (cantidad > 0),  -- BASE EQUIPOS!D (valor sin formato)
  orden            int,
  origen_fila      int                    -- trazabilidad hacia la hoja
)

-- Foto de cada cálculo (hoy no existe y hace falta para cotizaciones)
costeo_equipo(
  id, equipo_id, calculado_en timestamptz, politica_id,
  costo_directo, costo_mano_obra, cargo_medida_especial,
  recargos_costo jsonb, recargos_precio jsonb,
  costo_total, precio_calculado, precio_lista, precio_con_iva,
  utilidad_bruta, utilidad_neta, pct_neto
)
```

`precio_lista` se calcula con la **forma cerrada** de §3.6, sin iteraciones. Puede vivir en una vista o función `fn_precio_equipo(equipo_id)` y en una tabla de fotos `costeo_equipo` que se llene cuando cambien los costos o las políticas, para que el cotizador congele el precio cotizado.

### 6.2 Mapeo columna → campo para el importador

| Hoja!Col | Campo ERP | Transformación |
|---|---|---|
| `Componentes!A` | componente.nombre | `trim`, colapsar espacios dobles; **la llave canónica es el número de ítem**. Mejor importar directo de `ListaComponentes` (archivo de compras). |
| `Componentes!B` | componente.unidad_id | Normalizar: `Pieza`, `pieza `, `pza` → pieza; `Metro`, `mts`, `metro ` → metro; `Tramo` → tramo; `Litro` → litro, etc. |
| `Componentes!C` | componente.numero_item | Quitar la coma de miles (`4,977` → 4977) |
| `Componentes!D` | componente_costo.costo_unitario | Parsear moneda; vacío → NULL y marcarlo |
| `Componentes Inventario!D` | componente.categoria_id | Join por nombre (`lower(trim)`); `trim` a la categoría (`'Pintura '`); lo que no tenga categoría va a "Sin categoría" |
| `Reglas!A` | tipo_equipo.nombre | — |
| `Reglas!B` | politica_precio.utilidad_objetivo | % → decimal |
| `Reglas!C,D,E` | politica_recargo (mermas, luz, admin; base costo) | — |
| `Reglas!F,G,H,I,J` | politica_recargo (milpillas, mkt, tarjeta, comisiones, garantía; base precio) | — |
| `Reglas!L` | politica_recargo (medida_especial, condicional) | Vacío (Baja Utilidad) → 0 |
| `Reglas!N:O` | politica_precio.nota o tabla `bitacora_politica` | Texto libre; fechas en formato mixto (`28/01/22`, `31/1/22`) |
| `EQUIPOS!AC1` | parametro_global `isr_compensacion` | 0.25 |
| `EQUIPOS!A` | equipo.clave | Solo filas con B no vacío. Excluir E-000. Marcar `E-39` (no hay E-039). |
| `EQUIPOS!B` | equipo.nombre | `trim`; sustituir `\n` por espacio (E-504, E-435) |
| `EQUIPOS!E` | equipo.tipo_equipo_id | Lookup por nombre del tipo |
| `EQUIPOS!F` | equipo.medida_especial | `'Sí'` → true; `'No'` o vacío → false |
| `EQUIPOS!G` | equipo.descripcion | Tal cual (conservar viñetas y saltos) |
| `EQUIPOS!H` / `AG` | equipo.imagen_url | Usar AG (link ya convertido) o recalcular la regla REGEX |
| `EQUIPOS!AF` | equipo.notas | — |
| `EQUIPOS!J,K..AC` | **no se importan como dato**; sirven para **conciliar** | Recalcular y comparar con W (tolerancia $0.5) |
| `BASE EQUIPOS!A` | bom_linea.equipo_id | Lookup por clave |
| `BASE EQUIPOS!C` | bom_linea.componente_id | Lookup `lower(trim(nombre))` → componente; reportar los que no se resuelven |
| `BASE EQUIPOS!D` | bom_linea.cantidad | **Leer UNFORMATTED_VALUE** (en pantalla se ve redondeado a 2 decimales, por ejemplo 0.33 en lugar de 1/3) |
| `BASE EQUIPOS!B,E,F,G,H` | no se importan | Son derivados |

**Orden y validación del importador:**

1. Componentes, desde compras.
2. Tipos y políticas.
3. Equipos.
4. BOM.
5. Recalcular `precio_lista` con la forma cerrada y compararlo contra `EQUIPOS!W`. Debe dar 476 de 476 coincidencias. Las diferencias esperadas son los 6 equipos en error y los 2 con costo $0.

No migrar Monitor Stocks Bajos, Hoja 12/13/18/19/20, debug ni Prov. Monitor Stocks es una vista del módulo de inventario.

### 6.3 Recomendaciones de diseño que salen del análisis

- **Llaves numéricas en lugar de nombres.** Hoy un renombre en compras rompe el costeo, y el aviso en `ListaComponentes!B1` lo confirma.
- **Fotos de precio.** El precio cambia en tiempo real y el cotizador no congela nada. Guardar `costeo_equipo` con la política vigente.
- **Variantes y configuración.** No existen. Las 23 dosificadoras (ZEUS 15/30/60/80 × 2/3/4 tolvas × fija/móvil × suspensión) son BOMs completos copiados entre sí, y E-221 tiene 248 líneas. Un BOM multinivel (sub-ensambles reutilizables) reduciría mucho la duplicación, pero sería un rediseño, no una migración.
- **Kilos de acero:** agregar `kg_por_unidad` al componente si se quiere reportar consumo de acero.

---

## 7. Problemas de calidad de datos

**Integridad del costeo**

1. **6 equipos con precio "Error en el costeo"**, que el cotizador recibe como texto:
   - E-205, E-206, E-207 (ZEUS 80), E-166 y E-169 (mezcladoras): `Polea 18.4" 3rb con buje barreno piloto de fierro` no existe en compras (filas 14583–14587).
   - E-222 (`Listado de refacciones para silo THOR 36`): `Filtro para colector de polvos DK R01 92cm x 14cm` (fila 8441).
2. **E-055 "Banda cargadora de 26" x 15 metros"** no tiene BOM, así que tiene costo $0 y **precio de lista $0** en el cotizador.
3. **15 líneas de BOM sin cantidad** que valen $0 sin avisar. Por ejemplo, **`Colector de polvos de 14 cartuchos marca DKT` ($17,787) en E-225**, `Lamina calibre 16 4X10` en E-410 y `Rodaja giratoria de 8"…` en E-010. Esos equipos quedan subcosteados.
4. **5 líneas usan componentes sin costo en compras** y quedan en $0: 3 contactores Square D y `Cable uso rudo 4x6 awg` en E-221, y `cople 1" galvanizado` en E-168.
5. **Las llaves son de texto:** el BOM se liga por nombre de componente y el costo del equipo por **nombre** de equipo (SUMIF sobre B). Además, el `VLOOKUP` no distingue mayúsculas.
6. **Referencia circular** V↔O..S, que depende del cálculo iterativo (50 iteraciones, umbral 0.05). Hoy converge, pero no es auditable.
7. **Inconsistencias internas de la fórmula:**
   - O..S se calculan sobre V (sin redondear), no sobre W.
   - AA = Z/**V** pero AC = AB/**W**.
   - L, M y N no incluyen K.

**Fórmulas rotas o inconsistentes**

8. Columnas con fórmulas dañadas:
   - `EQUIPOS!K476` (E-507): `VLOOKUP(#REF!,…)`. Hoy no afecta porque F = "No".
   - `EQUIPOS!AA278` (E-367): `IF(#REF!="",…)`, así que su Ut. Bruta % sale vacía.
   - `EQUIPOS!AE320` (E-341) muestra `#REF!`.
   - `EQUIPOS!AA161` apunta a `B159`.
   - Hay una fórmula de costo suelta en `EQUIPOS!AD499`.
9. `BASE EQUIPOS!H` ("¿Repetido?"):
   - Falta en **775 filas**.
   - Muestra `#REF!` en 4.
   - Solo compara contra la fila anterior.

   Hay **50 pares (equipo, material) duplicados** en todo el BOM, y solo 16 están marcados como TRUE. Algunos pueden ser intencionales; hay que revisarlos.
10. La nota en `EQUIPOS!J2` reconoce que la `ARRAYFORMULA` "falla a partir de cierta fila", por eso J, K, V y W son fórmulas copiadas fila por fila.

**Catálogos**

11. **EQUIPOS tiene 504 filas con ID reservado sin nombre** (E-506 en la fila 111 y E-335…E-998 en las filas 488–990). El cotizador también las importa. Hay 26 huecos en la secuencia de IDs. Los IDs `E-39` (con nombre) y `E-85` (reservado) no siguen el formato `E-###`.
12. **5 equipos sin "¿Medida especial?"**: E-333, E-301, E-122, E-500, E-306.
13. Las columnas C "Inoxidable" y D "GASOLINA" de EQUIPOS están vacías en todo el catálogo.
14. Nombres de equipo:
    - 2 con salto de línea: E-504 y E-435.
    - 19 con espacios al final.
    - 8 "Provisional…" y un "Listado de refacciones…" mezclados con productos de catálogo.
15. **Componentes (compras):**
    - 34 nombres duplicados y 5 casi duplicados (doble espacio, mayúsculas). Hoy tienen el mismo costo, pero `VLOOKUP` toma el primero.
    - 75 sin costo y 15 con costo 0.
    - `IMPORTRANGE` con tope de **5,000 filas**: ya hay 4,073 usadas (81%). Al pasar de 5,000, los componentes nuevos no se verán.
16. **Unidades sucias:** `pieza`/`Pieza`/`pieza `/`pza`, `metro`/`Metro`/`mts`/`metro `, `Tramo`/`tramo`, `Litro`/`litro`, `kit`/`Kit`/`kit `. Además hay unidades semánticamente raras: `Placa de 3/4, metro cuadrado` con unidad `pieza`, `Carga de argón` en `pieza` mientras CO₂ va en `carga`, y vigas cuyo nombre trae kg/mt pero se cobran por metro.
17. **Componentes Inventario** (las categorías) está desactualizada:
    - 1,560 componentes de compras no aparecen.
    - 348 de los 1,390 materiales usados en BOMs caen en "Otros" en el Buscador.
    - 493 filas sin categoría.
    - Hay categorías duplicadas o casi iguales (`Bandas transportadoras `, `Bandas transportadoras H`, `Bandas`; `Pintura ` con espacio).
    - Hay una fila (14) con datos sueltos en H.

**Uso y mantenimiento**

18. El **Buscador** tiene seleccionado un nombre que ya no existe, así que no muestra nada.
19. Hay **filtros activos** en BASE EQUIPOS (ocultan 479 IDs) y en EQUIPOS (ocultan 480 nombres). Quien vea la hoja ve un subconjunto. La API no respeta filtros, así que el importador no se ve afectado.
20. El **historial de Reglas** es texto libre y no cuadra con la tabla. Por ejemplo, la nota 25/05/23 dice "bandas y bazucas al 30%" y hoy están en 32%. La única nota posterior sobre utilidades (05/09/23) dice "Se modifican utilidades" sin dar los valores nuevos, así que no se puede reconstruir qué % regía en cada fecha. "Baja Utilidad" no tiene % de medida especial.
21. Nombres inconsistentes del mismo concepto: `Reglas!F` "Uso de Planta Milpillas" contra `EQUIPOS!O` "Gastos Fin y de recup por Planta Milpillas". El historial lo llama "gastos financieros".
22. Hay un posible BOM copiado y pegado: E-409 (tolva de **2.5 m³**) incluye `Servicio de calibracion de tolva de 8 mts cubicos`. Hay que confirmarlo con producción.
23. Lo que se ve en pantalla está redondeado: las cantidades se muestran con 2 decimales (`0.33`, `0.13`) aunque la celda guarde más. 22 líneas no cuadran visualmente D×F = G por esto. Hay que importar sin formato.
24. **Pestañas basura** sin uso que conviene no migrar: Hoja 12, debug, Prov (vacía), Hoja 13 (impuestos, ajena), Hoja 18 (462 nombres viejos, solo 9 vigentes), Hoja 19 y Hoja 20.

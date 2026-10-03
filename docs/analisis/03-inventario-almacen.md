# 03 · Inventario y almacén: cómo funciona hoy y qué hay que llevarse al ERP

Lectura hecha el **3-oct-2026**, en **solo lectura**: no se editó, compartió ni escribió nada. Los datos llegan al **2-oct-2026**.

Archivos analizados:

| Alias | Archivo | ID |
|---|---|---|
| **A** | 2025 - Inventario 2.0- HEGAMEX | `1sOh_Gyj0ofi7aSYKdKmCJSyT_H6G1_wH18OlrybY2QE` |
| **B** | Almacen Registros | `1gSkwDhdQ3xiVBrGUJszNK_af2dOtfBk4_s3GAq6_9Eg` |

Para seguir las conexiones también se leyeron los encabezados y fórmulas de estos archivos:

| Alias | Archivo | ID |
|---|---|---|
| **H21** | 2021 - 2023 Inventario 2.0- HEGAMEX | `1HgxUOhxoFVYbUT2U0UWPj8rnrF5DDGDV15DulCvrymI` |
| **H24** | BACKUP -2024 - Inventario 2.0- HEGAMEX | `1Vw5RbNmLjiYRDySIROL3CPtAvpY_DuXql9AcZtU3HVo` |
| **CYA** | Costo y actualizaciones de los componentes 2.0 | `1yMB2r3KAPPpIBghyd8qzB-dgmpxPiq1fs1lY03smRxw` |
| **VAL** | 2026 - 2S - VALIDACIÓN MATERIAL/PEDIDO | `14xsHeDYrlZLEa5scsRkcJhjIgRRExgmPHAxFdWGDWSk` |

Cómo se obtuvieron los números:
- **Conteos de movimientos** de A·Registro: salen del espejo exacto `CYA!'Registros Inventario'`, que ya estaba descargado en `analisis/raw/reg.json` por otro análisis de esta sesión. Tiene las mismas 31,733 filas y la misma última fila que verifiqué directamente en A.
- **Estados y totales de Inventario**: salen de `raw/lca.json`, que es el espejo de Inventario en CYA.
- **Todo lo demás**: muestreo directo de las hojas.

---

## 0. Resumen ejecutivo

1. **El modelo es un libro de movimientos más fórmulas.**
   - El almacén captura cada entrada, salida o ajuste en `A·Registro`: una fila por artículo con fecha, artículo, cantidad, tipo, almacén, persona, pedido o motivo, factura y proveedor.
   - Unas `ARRAYFORMULA` convierten cada fila en "+/−" en la columna del almacén que corresponde.
   - `CALCULO` (hoja oculta) agrupa con `QUERY`.
   - `Inventario` suma un saldo inicial manual más esos movimientos y obtiene la existencia por almacén.
   - **El artículo se identifica por su nombre de texto**, no por un ID.
2. **La demanda se calcula en otro archivo (B)** porque necesita todo el historial.
   - B concatena con tres `IMPORTRANGE` los registros de 2021-23, de 2024 y de 2025-26: **88,337 movimientos desde feb-2021**.
   - Suma las `SALIDA` por mes de los últimos 12 meses.
   - Saca un promedio mensual **solo si hubo consumo en al menos 3 de los últimos 6 meses**.
   - El resultado regresa a A con otro `IMPORTRANGE`.
3. **El "stock mínimo de un mes" del dueño se reconstruye así:**
   - Punto de reorden `V` = demanda mensual ÷ 22 × días de entrega (7 si no hay dato) + stock de seguridad manual.
   - Cantidad mínima de compra `W` = **1 mes de demanda** (`ROUNDUP(R)`).
   - Cuando la existencia es menor que `V` sugiere comprar `W + V − existencia`, redondeado al múltiplo de empaque.
   - **No existe un parámetro de "meses de cobertura" por artículo.** Por eso los importados que necesitan 6 meses solo se pueden cubrir con el stock de seguridad manual.
   - **Ese stock manual hoy NO llega a la fórmula** por un corrimiento de columnas: Demanda lee la columna `W` "Notas 1" de Inventario en lugar de la `Y` "Inventario de seguridad manual". Está en §7, falla F1.
4. **"Reservas" es un almacén virtual llamado `RESERVADO`.**
   - Se pasa material con un par AJUSTE SALIDA / AJUSTE ENTRADA, anotando cliente, vendedor o pedido como texto.
   - **`FULL ML` es el stock que está físicamente en bodegas de Mercado Libre Full** (almacén `Almacén ML`).
   - Ninguno de los dos cuenta como "STOCK ACTUAL TOTAL DISP".
5. **`ORDENES` son órdenes de compra a proveedor** que vienen importadas de CYA (~10 mil renglones, OC #461 a #4368).
   - `EXCEDENTES` es el stock sin consumo en 12 meses (~950 artículos, valuados en $4.2 M con un cálculo inflado).
   - `Pedaseras de bandas` y `Herramientero` son hojas abandonadas o rotas.
   - **No existe ningún dato de ubicación** (estante, pasillo, rack): la máxima granularidad son 8 "almacenes".
6. **Riesgos urgentes:**
   - `B·Registro` tiene 88,500 filas y la importación ya llega a la fila 88,338. Le quedan **~160 filas, unos 2-3 días hábiles de captura**. Después, el `IMPORTRANGE` del bloque 2025 ya no podrá expandirse y la demanda dejará de calcular (§7, R1).
   - La hoja de validación de material (VAL) mostraba `#REF!` en su importación de existencias al momento de la lectura.

### Mapa del flujo actual

```
 Vale de papel "PEDIDO A ALMACÉN"         Facturas / remisiones de proveedor
            │                                        │
            ▼                                        ▼
 A·Registro (B:K captura manual; L:S = ARRAYFORMULA ± por almacén)
            │──────────────► CYA·'Registros Inventario' (IMPORTRANGE B11:K)
            │──────────────► B·Registro, 3er bloque (IMPORTRANGE B8:I)
            ▼
 A·CALCULO (QUERY: suma por producto × almacén)
            ▼
 A·Inventario (saldo inicial + movimientos = existencia por almacén; E = total disponible)
   │  ├─► A·Demanda B:E (IMPORTRANGE propio, B7:E4000)     ├─► pivote RESERVAS (U>0)
   │  ├─► B·Demanda B:E y B·'Componentes Actual'           ├─► pivote FULL ML (S>0)
   │  └─► VAL·ListaAlmacen (B, E, C) → faltantes por pedido de maquinaria
   ▼
 B·Registro = H21 (2021-23) + H24 (2024) + A (2025-26)
   ▼
 B·Demanda F:Q (SUMIFS SALIDA por mes) + R (promedio) ──IMPORTRANGE──► A·Demanda F:R
 CYA·ListaComponentes ─► A·'LISTA ENLAZADA COSTOS' ─► A·Demanda S (empaque), T (días de entrega)
 A·Demanda S:V, G3 ──IMPORTRANGE──► B·Demanda (W, X, Y se recalculan allá)
 A·Demanda ─► pivote STOCKS BAJOS 2.0 (status STOCK BAJO) y pivote EXCEDENTES (status Excedente)
 A·Demanda!Y ─► A·Inventario!V (STATUS)
 CYA·'STOCKS BAJOS 2.0'!H:I (notas de compras) ─► A·STOCKS BAJOS G:H, RESERVAS G, FULL ML G
 CYA·Órdenes ─► A·ORDENES
```

---

## 1. Propósito de cada pestaña y si está viva

### Archivo A: "2025 - Inventario 2.0- HEGAMEX"

| Pestaña | Tamaño de la rejilla | Datos reales | Propósito | ¿Viva? |
|---|---|---|---|---|
| **Registro** | 32322×24 | **31,733 movimientos** (filas 13–31,745), del 24-abr-2024 al 2-oct-2026. El flujo normal empieza el 13-dic-2024: hay 478 filas fechadas en 2024. Promedio de ~1,540 movimientos al mes. | Libro de movimientos: entradas, salidas y ajustes. Las filas 1–10 tienen un "buscador" de disponibilidad y el KPI de desabasto. | **Sí, a diario** |
| **Inventario** | 6162×27 | **3,651 artículos con nombre** (filas 8–3,660). 1,867 tienen existencia mayor que 0. | Maestro de artículos del almacén y existencia por almacén. | Sí |
| C1 | 6157×11 | ~137 renglones (A2:B139) | Hoja de conteo físico de Contenedor 1, "al 20 agosto 14:48pm", con casilla VERIFICADO. | Puntual (ago-2026) |
| C2 | 6157×10 | ~32 renglones | Checklist de Contenedor 2: "SUPUESTAMENTE HAY INVENTARIO DE ESTO… Verificar incluso si realmente no hay". | Puntual |
| INVENTARIADO | 6157×30 | ~3,597 renglones | Foto de existencias "STOCK marcado en sistema el 17-agosto-2026 11:15am" por almacén (A:H). La compara contra la existencia viva (K:Q) en S `DIFERENCIAS`. | Auditoría ago-2026; la fórmula sigue viva |
| CALCULO (oculta) | 3031×11 | ~2,290 productos | Motor: `QUERY` que agrupa los movimientos por producto y almacén. | Sí (motor) |
| RESERVAS | 8925×15 | **12 artículos** | Tabla dinámica de Inventario con el almacén `RESERVADO` mayor que 0. | Sí |
| STOCKS BAJOS 2.0 | 8924×30 | **18 artículos** | Tabla dinámica de Demanda con status "STOCK BAJO,ORDENAR", más notas de Compras importadas. | Sí |
| **Demanda** | 5087×27 | ~3,653 renglones; **261 con punto mínimo mayor que 0** | Consumo mensual, punto de reorden, cantidad a pedir y status. | Sí |
| ORDENES | 10503×15 | ~10,013 renglones de OC (#461 del 26-mar-2021 a #4368 del 30-sep-2026) | Espejo de `CYA·Órdenes` (órdenes de compra). | Sí (importado) |
| LISTA ENLAZADA COSTOS (oculta) | 5499×26 | ~4,100 componentes | `SORT` de `CYA·ListaComponentes`: unidad, empaque, costo, precio, proveedor y días de entrega. | Sí (importado) |
| FULL ML | 8925×15 | **7 artículos** | Tabla dinámica de Inventario con `Almacén ML` mayor que 0: stock en bodegas de Mercado Libre Full ("INVENTARIO EN MERCADOLIBRE"). | Sí |
| EXCEDENTES | 2333×34 | **~950 artículos**, valor mostrado de $4,225,571.40 | Tabla dinámica de Demanda con status "Excedente": "Artículos que no se han necesitado en los últimos 12 meses, no tienen configurado stock de seguridad y que aún así tienen stock". | Sí |
| Hojas Solicitudes Almacen (oculta) | 100×16 | 0 datos | Plantilla imprimible "PEDIDO A ALMACÉN" (Solicita, Fecha, Cantidad, Nombre del Material, Número de Pedido), dos copias por hoja. | Formato en papel |
| ListasDesplegables | 1289×9 | 5 tipos, 8 almacenes, ~62 categorías, ~70 personas y ~930 proveedores (importados) | Catálogos para las validaciones. | Sí |
| Pedaseras de bandas (oculta) | 1006×50 | 4 renglones de prueba | Borrador de cómo registrar el corte de una banda ancha en tiras (SALIDA del rollo y AJUSTE ENTRADA de tiras "… H"). Repite una cadena que parece contraseña (ver Contactos). | **Muerta** |
| Contactos (oculta) | 1000×25 | ~5 celdas | Correos y teléfonos, y la etiqueta **"FIEL"** junto a lo que parece la contraseña de la e.firma y el RFC. | **Muerta y sensible** |
| Herramientero | 2104×156 | 58 herramientas | Lista de herramientas con "Stock inicial" y "Stock". **No registra préstamos.** | **Rota y abandonada** |

### Archivo B: "Almacen Registros"

| Pestaña | Tamaño de la rejilla | Datos reales | Propósito | ¿Viva? |
|---|---|---|---|---|
| **Registro** | 88500×20 | **88,337 filas útiles** (filas 2–88,338), del 26-feb-2021 al 2-oct-2026. Se arma con tres `IMPORTRANGE`. | Historial consolidado para calcular la demanda. Solo agrega Mes, Año y mov_group. | Sí, **casi lleno** |
| **Demanda** | 6662×26 | ~3,653 renglones | Calcula el consumo mensual de los últimos 12 meses y el promedio, y lo devuelve a A. | Sí |
| DemandaEspejo | 6656×26 | ~3,653 | `IMPORTRANGE` de su propia hoja `Demanda!B7:Y`: un espejo para que otro archivo la consuma. **No identifiqué qué archivo la consume.** | Sí |
| Componentes Actual | 6656×26 | ~3,651 | `IMPORTRANGE(A,"Inventario!B7:E")`: nombre, unidad, concepto y existencia. Rango con nombre `Componentes` = A2:A4078. **No identifiqué qué archivo la consume.** | Sí |

---

## 2. Columnas de las pestañas importantes

### 2.1 A·Registro (encabezados en la fila 12, datos desde la fila 13)

| Col | Encabezado | Tipo | Ejemplo real | Significado | Manual o fórmula |
|---|---|---|---|---|---|
| A | MOV GRUP | 0/1 | `1` | `=IF(H13=H12,0,1)`: vale 1 cuando cambia la persona respecto a la fila anterior (agrupa un "vale"). **Solo está en filas viejas; vacía desde ~2025.** | Fórmula no arrastrada |
| B | Fecha y Hora | fecha y hora (serial); a veces solo fecha o texto | `2/10/2026 14:22:43` | Momento de **captura**, no de entrega: hay lotes de hasta 159 filas con el mismo segundo. | Manual o pegado |
| C | Producto | texto, validación **estricta** `ComponentesInventario` (=Inventario!B8:B6162) | `Tuerca 5/16` | Artículo, por nombre. | Manual |
| D | "pieza" (unidad) | texto | `pieza` | `=IFERROR(VLOOKUP(C28000,'LISTA ENLAZADA COSTOS'!$A$4:B,2,0),"")`. **No se arrastró:** hay 1,602 filas vacías. | Fórmula |
| E | Cantidad | número ≥ 0 | `4.00`, `19.18` | Siempre positiva; el signo lo da F. | Manual |
| F | Tipo | validación estricta `Tipo` | `SALIDA` | `Nuevo Artículo` / `ENTRADA` / `SALIDA` / `AJUSTE ENTRADA` / `AJUSTE SALIDA` | Manual |
| G | Almacén | validación estricta `Almacenes` | `Planta Baja` | 8 valores (ver §4). | Manual |
| H | Personal | validación `EMPLEADOS`, **no estricta** | `Juan esteban camacho` | En salidas: quien retira el material. En entradas y ajustes: casi siempre la almacenista `Noemí Rizo Ramírez`. | Manual |
| I | N. de Pedido / Motivo | texto libre | `P717`, `S102`, `VENTA ML`, `taller`, `TUXTLA` | Destino del consumo: pedido de producción, serie, venta, área o proyecto. El aviso de la fila 11 dice "No dejar vacío si es salida". | Manual |
| J | # Factura / vale / nota | texto | `F89973`, `N98940`, `R68770` | Documento del proveedor en las entradas. El aviso dice "No dejar vacío si es entrada". | Manual |
| K | Proveedor | validación `Proveedores`, no estricta | `Refaccionaria Agricola de Atotonilco S.A. de C.V.` | Proveedor de la entrada. | Manual |
| L–S | Operaciónes P. Alta / P. Baja / Mallado / Contenedor / Contenedor 2 / Revolución / Almacén ML / RESERVADO ML +/- | número con signo | `-4.00` | Una `ARRAYFORMULA` por almacén (§3.1). | Fórmula (en la fila 13) |
| T | Notas y comentarios (cambio de almacén, error, corte, etc...) | texto | `NO ESTA DADO DE ALTA EL PRODUCTO` | Casi sin uso: 2 notas en 7,700 filas recientes. | Manual |
| U | Mes | número | `10` | Valores solo desde oct-2025. **No encontré la fórmula que los genera** (no hay `userEnteredValue`). | ? |
| V | Año | — | vacío | Sin uso. | — |
| W | ¿Fue una Merma? | casilla | `FALSE` | Merma. El aviso (en X11) dice "Solo en Salidas. Explicar motivo en notas". | Manual |
| X | (sin encabezado) | casilla | `FALSE` | Propósito desconocido. | Manual |

Filas 1–10 de la misma hoja:
- **C2** es un selector de producto. C3 = `=IFERROR(INDEX(Inventario!G8:G, MATCH(C1, Inventario!B8:B, 0)), "")`, y **C4:C10 dan `#REF!`**.
- **H2** es el KPI de desabasto (§3.8), con semáforo: "<8% OPTIMO", "8%-17% ACEPTABLE", ">17% DEFICIENTE".
- Formato condicional: pinta de rojo `SALIDA`/`AJUSTE SALIDA` sin motivo (desde la fila 29,619) y `ENTRADA` sin proveedor.
- La hoja tiene un filtro básico con orden por B, C y K. Los usuarios pueden reordenarla.

### 2.2 A·Inventario (encabezados en la fila 7, datos desde la fila 8)

| Col | Encabezado | Ejemplo | Contenido | Manual o fórmula |
|---|---|---|---|---|
| B | Nombre del artículo | `Cangilon 4x3 azul, marca Tapco` | Validación (no estricta) `NombreComponentes` (=LISTA ENLAZADA COSTOS!A4:A5499). Es la **llave por texto** de todo el sistema. | Manual |
| C | Unidad | `pieza` | Protegida. Es independiente de la unidad en LEC, así que puede diferir. | Manual |
| D | Concepto | `Cangilones` | Categoría (`TipoArticulo`, ~62 valores). | Manual |
| E | STOCK ACTUAL TOTAL DISP | `165.00` | `=IF(B8="","",(G8+I8+K8+M8+O8+Q8))`: PA+PB+M+C1+C2+Revolución. **Excluye ML y Reservado.** | Fórmula |
| F / G | "Inventario Inicial 12/2025" / `1 - PA` | `596` / `0.00` | `G =IF($B8="","",F8+IFERROR(INDEX(CALCULO!$C$4:$C, MATCH($B8, CALCULO!$B$4:$B, 0)),0))` | F manual, G fórmula |
| H / I | "Inventario Inicial 12/2025" / `2 - PB` | `1` / `50.00` | `I = H + CALCULO!D` | Igual |
| J / K | "Inventario Inicial 12/2025" / `3 - M` (Mallado) | `6` / `206.00` | `K = J + CALCULO!E` | Igual |
| L / M | "Inventario inicial: 31/12/23" / `4 - C1` | `120` / `0.00` | `M = L + CALCULO!F` | Igual |
| N / O | "Inventario Inicial 1/08/2024" / `5- C2` | — / `72.00` | `O = N + CALCULO!G` | Igual |
| P / Q | (sin título) / `" R"` = **Revolución** | — / `0.00` | `Q = P + CALCULO!H` | Igual |
| R / S | "I.INICIAL ML" / `6 - ML` | — / `15.00` | `S = R + CALCULO!I` | Igual |
| T / U | (sin título) / `7 - R` = **RESERVADO** | — / `101.00` | `U = T + CALCULO!J` | Igual |
| V | STATUS | `OK` / `Excedente` / `STOCK BAJO,ORDENAR` | `=IMPORTRANGE("1sOh_…","Demanda!Y7:Y")`, importándose a sí mismo. | Fórmula |
| W | Notas 1 | `ya no se utiliza` | Texto libre. | Manual |
| X | Notas 2 | `Se le puso Stock Manual porque aunque no tiene demanda constante, está dado de alta en ML` | Texto libre. | Manual |
| Y | **Inventario de seguridad manual** | `48`, `100` | Mínimo de seguridad manual. La nota de Y1 dice "Solo agregar … cuando sea MUY necesario…". **~60 artículos lo tienen.** | Manual |
| Z | ⚠️Artículos en más de un almacén ⚠️ | `Componente en 2 almacenes` | Fórmula `COUNTIF` sobre G, I, K, M y O (§3.8). | Fórmula |
| AA | ¿ML? | `FALSE` | Casilla: el artículo está publicado en Mercado Libre. | Manual |

Los "Inventario inicial" son ajustes de apertura escasos y con etiquetas de fechas distintas.
- La columna F (PA) tiene muchos valores que **cancelan exactamente** salidas viejas. Ejemplo: "Tornillo 1/2 x1 1/2 negro de alta", con F=596 y movimientos PA de −596, da G=0.
- La columna L (C1) tiene ~40 valores, que suman ~1,180 unidades.
- Comprobé la regla **existencia = inicial + Σ movimientos** en 3 artículos y coincide exactamente: Cangilon 4x3 (C1: 120 − 120 = 0), vidrio sombra 11 (PB: 1 + 49 = 50) y Ángulo 1/4×1 1/2 (M: 6 + 200 = 206).

### 2.3 A·CALCULO (oculta)

`B3 = =QUERY(Registro!C12:S, "SELECT C, SUM(L), SUM(M), SUM(N), SUM(O), SUM(P), SUM(Q), SUM(R), SUM(S) WHERE C IS NOT NULL GROUP BY C ORDER BY C", 1)`

Da una fila por producto y una columna por almacén. Basura detectada: un "producto" `30/10/2025 14:02:44` con −1 (es una fecha capturada en la columna Producto).

### 2.4 Demanda (A y B tienen el mismo diseño; encabezados en la fila 7)

| Col | Encabezado | En A | En B |
|---|---|---|---|
| B:E | Nombre, Unidad, Concepto, STOCK ACTUAL TOTAL DISP | `=IMPORTRANGE("1sOh_…","Inventario!B7:E4000")`. Es una autoimportación **topada en la fila 4000**. | `=IMPORTRANGE("1sOh_…","Inventario!B7:E")` |
| F:Q | 12 meses (A los rotula `oct - 2025` … `sep - 2026` con `=TEXT(EDATE(B4,-12),"mmm - yyyy")`) | `F8 = =IMPORTRANGE("1gSk…","Demanda!F8:R")` | `SUMIFS` de SALIDA por mes (§3.5) |
| R | DEMANDA PROM. POR MES | Importado de B | Fórmula (§3.5) |
| S | Cantidad por paquete o metros/cm por pieza | `=IFERROR(IF(B8="", "", VLOOKUP(B8,'LISTA ENLAZADA COSTOS'!$A$4:C,3,)),"")` | `IMPORTRANGE(A,"Demanda!S7:S")` |
| T | Días que tarda en llegar un artículo | `=IFERROR(IF(B8="", "", VLOOKUP(B8,'LISTA ENLAZADA COSTOS'!$A$4:I,9,)),"")` | `IMPORTRANGE(A,"Demanda!T7:T")` |
| U | "Notas 1" (pensada como **stock de seguridad manual**) | `=IMPORTRANGE("1sOh_…","Inventario!W7:W")`. **Error: lee W y debería leer Y.** | `IMPORTRANGE(A,"Demanda!U7:U")` |
| V | Punto mínimo de reorden | `=IF(B8="","",ROUNDUP(((R8/22)*IF(T8="",7,T8))+U8))` | `IMPORTRANGE(A,"Demanda!V7:V")` |
| W | Cantidad mínima por órden de compra | `=IF(B8="","",ROUNDUP(R8))` | Igual |
| X | CANTIDAD MÍNIMA PENDIENTE | §3.6 | Igual |
| Y | STATUS | §3.6, versión con "Error, stock negativo" | §3.6, versión simple |
| Z | Notas | Manual | Manual |
| AA | Movimientos | `=COUNTIFS(Registro!C$13:C, B8, Registro!J$13:J, "SALIDA")`. **Siempre da 0**: J es la columna de factura. | — |
| G3 | "Consumo en al menos **3** de los últimos 6 meses" | Manual; es la única celda editable de la hoja protegida. | `IMPORTRANGE(A,"Demanda!G3")` |
| V6 | Artículos con mínimos | `=COUNTIF(V8:V, ">0")`, que hoy da **261** | — |

Estados actuales (espejo `lca.json`): OK 2,680 · Excedente 948 · STOCK BAJO,ORDENAR 18 · `#VALUE!` 3 · "Error, stock negativo" 2.

### 2.5 A·LISTA ENLAZADA COSTOS (oculta)

`A3 = =SORT(IMPORTRANGE("…1yMB2r3K…","ListaComponentes!A2:I"))`. `F1:F2 = IMPORTRANGE(CYA,"Actualizaciones!F3:F4")` da "Tiempo Estándar de Entrega:" `7`.

Columnas:

| Col | Contenido | Ejemplo |
|---|---|---|
| A | Nombre | |
| B | Unidad | |
| C | Cantidad por paquete | |
| D | ID consecutivo | `4,661` |
| E | Costo | `$400.00` |
| F | Precio (= costo / 0.7) | `$571.43` |
| G | Fecha de actualización | `04/11/25` |
| H | Proveedor | `Transbelt S.A. de C.V.` |
| I | Días de entrega | `45` |

En el archivo de origen (CYA·ACTUALIZACIONES) la columna se llama **"Tiempo Estimado de Entrega (días hábiles)"**. Por eso el `/22` de la fórmula es coherente (22 días hábiles al mes).

Distribución de días de entrega (~4,100 componentes):

| Días | Artículos |
|---|---|
| 7 | 2,884 (70 %, el valor por defecto) |
| 4 | 260 |
| 2 | 243 |
| 15 | 238 |
| 60 | 112 |
| vacío | 91 (se toma 7) |
| 100 (máximo) | 3 |

**Ningún artículo tiene 120 días o más.**

Empaque (C): 1 en 3,577; 10 en 202; 6 en 126; 100 en 47; 24 en 30.

### 2.6 Pivotes de seguimiento

**STOCKS BAJOS 2.0**
- A:E es una tabla dinámica sobre `Demanda!B7:Z5087`, filtrada por Y = "STOCK BAJO,ORDENAR". Columnas: nombre, status, existencia, cantidad pendiente y unidad.
- G "Notas" = `IMPORTRANGE(CYA,"'STOCKS BAJOS 2.0'!H3:H")`, con valores como "Inversión menor a $2,000 pesos 😮‍💨".
- H = `IMPORTRANGE(CYA,"'STOCKS BAJOS 2.0'!I3:I")`, con valores como "Enviado" (el seguimiento de Compras).
- K:V traen 12 meses de demanda con `=IF($A2="","", VLOOKUP($A2,Demanda!B8:R,5,0))` (5..17).
- X = `=IF(W2="","",IF(W2=0,if(C2 <0, "El stock es negativo ⚠️","No ha tenido suficiente demanda pero tiene configurado stock de seguridad (probablemente por Mercado Libre) y está incompleto."),""))`
- Z1:AA1: "Porcentaje de Desabasto:" `=COUNTIF($A$2:$A, "<>")/Demanda!$V$6` da **6.9 %** (18 de 261).
- AD "Demanda mes actual": `=IF($A2="","", VLOOKUP($A2,Inventario!$B$7:$V,25,0))` da `#REF!`.

**RESERVAS**
- Tabla dinámica sobre `Inventario!B7:V3485` con U (`7 - R`) > 0. Columnas: nombre, unidad y cantidad reservada.
- 12 artículos, por ejemplo `Cangilon 6x5 azul, marca Tapco` 122 y `Tornillo p/cangilon 1/4 X 1 1/4 Galv.` 700.
- G importa las notas de STOCKS BAJOS de CYA alineadas por fila, así que no corresponden a estos artículos.

**FULL ML** ("INVENTARIO EN MERCADOLIBRE")
- Tabla dinámica sobre `Inventario!B7:V3485` con S (`6 - ML`) > 0.
- 7 artículos y 818 piezas, por ejemplo `Aerovibrador Fluidificador OLI` 15 y `Tornillo p/cangilon 1/4 X 1 1/2 con uña Galv.` 300.

**EXCEDENTES**
- Tabla dinámica sobre `Demanda!B7:AA5087` con Y = "Excedente" y AA = 0. Columnas: nombre, existencia, unidad y demanda.
- Valor: F3 = `=IFERROR(IF(A3="","",VLOOKUP(A3,'LISTA ENLAZADA COSTOS'!A4:F,6,0)*B3*1.16),"Se desconoce el costo")` y F2 = `=SUM(F3:F)` dan **$4,225,571.40**. Ese valor usa el **precio de venta** (col F = costo/0.7) **más IVA**, no el costo.
- J:V traen la demanda con `ARRAYFORMULA(VLOOKUP(A3:A, Demanda!B8:R, 5..17))`.

### 2.7 Conteos físicos

**INVENTARIADO**
- A:H es la foto del 17-ago-2026 con PA, PB, M, C1, C2, Revolución y TOTAL.
- K:Q traen la existencia viva con `=ARRAYFORMULA(IF($A3:A="","",IFERROR(VLOOKUP($A3:A,Inventario!B3:S,6,0),0)))` (columnas 6/8/10/12/14/16) y Q = suma.
- S = `=ARRAYFORMULA(IF(A3="","",(-H3:H+Q3:Q)))` (DIFERENCIAS).
- Un formato condicional resalta los artículos que se movieron después de la fila 29,606 de Registro.

**C1**: Artículo, Cantidad, VERIFICADO (casilla), observación.

**C2**: Artículo (validación `NombreComponentes`), VERIFICADO.

### 2.8 B·Registro

| Col | Encabezado | Origen |
|---|---|---|
| A:H | Fecha y Hora, Articulo/Componente/Producto, Unidad, Cantidad, Tipo, Almacén, Personal, Uso/N. de Pedido | 3 `IMPORTRANGE` (§5) |
| I | Mes | `=IF(A2="","",MONTH(A2))`, prellenada hasta la fila ~88,500 |
| J | Año | `=IF(A2="","",YEAR(A2))` |
| K | mov_group | `=IF(G2=G1,0,1)` |

Bloques:

| Filas | Contenido | Movimientos | Fechas |
|---|---|---|---|
| 2–34,994 | 2021–23 | 34,993 | Las primeras 19 están en 30/12/1899 (sin fecha); luego del 26-feb-2021 al 29-dic-2023 |
| 34,997 | Fórmula del bloque 2024 | — | — |
| 34,998–56,595 | 2024 | 21,598 | 2-ene a 20-dic-2024 |
| 56,601–56,605 | Basura | 5 | Encabezados y avisos de A filas 8–12 |
| 56,606–88,338 | 2025–26 | 31,733 | — |

### 2.9 A·ListasDesplegables (fila 3 = encabezados)

| Col | Lista | Valores |
|---|---|---|
| A | Tipos | `Nuevo Artículo`, `ENTRADA`, `SALIDA`, `AJUSTE ENTRADA`, `AJUSTE SALIDA` |
| B | Almacenes | `Planta Alta`, `Planta Baja`, `Mallado`, `Contenedor 1`, `Contenedor 2`, `Almacén ML`, `RESERVADO`, `Revolución` |
| C | Tipo Articulo | ~62 categorías, por ejemplo Cadenas, Chumacera, Poleas, Cangilones, Bandas transportadoras, "Bandas transportadoras H", Colectores de Polvos… |
| D | Personal | ~70 nombres, entre ellos "Taller", "Sr. Abel ", "Precticante de Ingieneria " |
| E | Proveedores | `=IMPORTRANGE("1bMPe8wRcFv66tap2k7qW6MOIDWDYMeng8Mii4ZwAdFs","Directorio Proveedores!B3:B")`. Es el directorio **general de gastos**: incluye IMSS, IMPUESTOS, restaurantes, casetas… |

Rangos con nombre:

| Nombre | Rango |
|---|---|
| `Tipo` | A4:A12 |
| `Almacenes` | B4:B12 |
| `TipoArticulo` | C4:C65 |
| `EMPLEADOS` | D4:D300 |
| `Proveedores` | E4:E1100 |
| `ComponentesInventario` | Inventario!B8:B6162 |
| `NombreComponentes` | LEC!A4:A5499 |
| `Motivos` | Registro!I13:I9035 |

### 2.10 Otras pestañas

**ORDENES**
- A4 = `=IMPORTRANGE(CYA,"Órdenes!A5:J")`.
- Columnas: Fecha, #Ord, Articulo, Cantidad Ordenada, Unidad, Status (Pedido/Enviado/Recibido/CANCELADO), Nota Extra (destino: `ALMACEN`, `VENTA MERCADO LIBRE`, `P.773 Mezcladora`, `S129 - Zeus 30 2 Tolvas`…), Proveedor, Factura, Fecha de Vencimiento (a veces dice "PAGADA").
- Son **órdenes de compra**. Le corresponde al informe de compras.

**Herramientero**
- Columnas: B Herramientas, C Categoría, D Stock inicial, E Stock.
- E = `=IF(B5="","",D5+IFERROR(VLOOKUP(B5,Registro!$C$13:O,8,0),"0"))`. La columna 8 de C:O es **J (factura)**, así que da `#VALUE!` o, en el caso de "Mototool aire", **130048**.
- No existe registro de préstamos.

**Pedaseras de bandas**: SALIDA de 2 m de `Banda grip top 2 capas 20" de ancho`, más AJUSTE ENTRADA de 2 m `… 8" de ancho H` y 2 m `… 12" de ancho H`. Ver §4.5.

---

## 3. Reglas de negocio (fórmulas literales)

### 3.1 Tipos de movimiento y signo

En A·Registro L:S hay una fórmula por almacén, todas con el mismo patrón:

```
=ARRAYFORMULA(IF(G13:G="Planta Alta",IF((F13:F="SALIDA")+(F13:F="AJUSTE SALIDA"),E13:E*-1,E13:E),""))
```

- **Restan:** `SALIDA` y `AJUSTE SALIDA`.
- **Suman:** `ENTRADA`, `AJUSTE ENTRADA` y `Nuevo Artículo` (cualquier otro valor también sumaría).

Uso real en 2024-12 → 2026-10:

| Tipo | Movimientos | Uso observado |
|---|---|---|
| SALIDA | 22,773 (71.8 %) | Consumo. Motivo `P###` (pedido) 10,803 · `S###` 4,267 · otros textos 2,978 (PLASMA 391, TUXTLA 121, TURBINAS, SILO P714, UNIFORME, EPP…) · **vacío 1,736** · taller 1,195 · VENTA ML/FULL 787 · VENTA 635 · torno 353. |
| ENTRADA | 7,091 (22.3 %) | Compras. Factura vacía en 100 y proveedor vacío en 41. 161 entran **directo a RESERVADO**. |
| AJUSTE SALIDA | 952 (3.0 %) | Traspaso ("cambio de almacén" ~350), corrección de conteo (~170), **ventas** (~130 "VENTA…"), envío a ML, "para corte". |
| AJUSTE ENTRADA | 916 (2.9 %) | Contraparte del traspaso (~310), apartar en RESERVADO, devoluciones (47), "corte de stock/venta". |
| Nuevo Artículo | 1 | Prácticamente sin uso. |

No hay tipos para devolución, traspaso ni merma. Todo eso se expresa con ajustes más texto, y la merma con la casilla W.

### 3.2 Existencia

```
existencia[artículo, almacén] = inventario_inicial[artículo, almacén]  (Inventario F/H/J/L/N/P/R/T, manual)
                              + Σ movimientos con signo de A·Registro (CALCULO)
STOCK ACTUAL TOTAL DISP (E)   = PA + PB + Mallado + C1 + C2 + Revolución   (sin ML ni RESERVADO)
```

- No resta lo comprometido para pedidos de maquinaria: la validación de material (§3.10) compara contra E sin apartar nada.
- La existencia negativa es posible; hay 2 artículos con status "Error, stock negativo".

### 3.3 Reservas (material apartado)

- No existe una entidad de reserva: `RESERVADO` es un almacén más.
- Para apartar se usa `AJUSTE SALIDA` del almacén físico y `AJUSTE ENTRADA` en `RESERVADO`, con H = vendedor o responsable e I = cliente o pedido.
- Al entregar se registra `SALIDA` desde `RESERVADO`, que **sí** cuenta como demanda.
- También se compra directo a RESERVADO (161 `ENTRADA`).
- Ejemplo real del 28-sep-2026, `Colector de polvos motorizado de 14 cartuchos marca DKT`:
  - AJUSTE SALIDA de 5 en Mallado, "para reserva".
  - AJUSTE ENTRADA de 2 en RESERVADO "VENTA JM", 2 en "SPI INGENIERIA" y 1 en "P792".
  - SALIDA de 2 desde RESERVADO, "VENTA A GDL".
- Motivos más frecuentes en RESERVADO: `TUXTLA` (130), `SILO P714` (24), `P773,781,780 …` (18), `VENTA…`, `P715`, `S111`, `S114`.
- **Sí es material apartado**, tanto para órdenes de producción (P###/S###) como para ventas.
- Lo reservado no tiene fecha de expiración, cantidad comprometida separada de la física, ni liga estructurada al pedido.

### 3.4 Mercado Libre Full

- `Almacén ML` = existencias enviadas a bodegas Full.
- El envío se registra como AJUSTE SALIDA del almacén físico y AJUSTE ENTRADA en Almacén ML ("ENVIO A ML", "MERCADO FULL").
- La venta se registra como `SALIDA` desde Almacén ML ("VENTA FULL", "VENTA ML FULL").
- Las ventas ML que no son Full salen de almacenes físicos con motivo `VENTA ML` (787 salidas).
- `Inventario!AA ¿ML?` marca los artículos publicados.

### 3.5 Demanda mensual (archivo B)

Consumo de cada uno de los últimos 12 meses (F = mes-12 … Q = mes-1):

```
=IF(B8="","",SUMIFS(Registro!D$2:D,Registro!$I$2:I, "="&MONTH(DATE(YEAR($B$4),MONTH($B$4)-12,1)),Registro!$J$2:J, "="&YEAR(DATE(YEAR($B$4),MONTH($B$4)-12,1)), Registro!B$2:B, B8,Registro!$E$2:E,"=SALIDA"))
```

Promedio mensual R:

```
=IF(B8="","",IF(COUNTIF(L8:Q8,">0")>=$G$3, AVERAGEIF(L8:Q8,">0"), 0))
```

- Solo cuentan los `SALIDA` de **cualquier almacén**, incluidos RESERVADO y ML. **Los `AJUSTE SALIDA` no cuentan**, aunque ~130 de ellos son ventas.
- Un artículo "genera demanda" cuando tuvo salidas en **al menos G3 = 3 de los últimos 6 meses** cerrados (L:Q). En ese caso R es el **promedio de solo los meses con consumo**, lo que infla la cifra. Si no se cumple, R = 0.
- Ejemplo real, `Cangilon 5x4 azul, marca Tapco`:
  - Los últimos 6 meses fueron 0, 0, 24, 110, 5 y 24: 4 meses con consumo.
  - R = 163/4 = **40.75**, cuando el promedio real de 6 meses es 27.2.

### 3.6 Punto de reorden, cantidad a pedir y status (archivo A)

```
V  Punto mínimo de reorden          =IF(B8="","",ROUNDUP(((R8/22)*IF(T8="",7,T8))+U8))
W  Cantidad mínima por orden compra =IF(B8="","",ROUNDUP(R8))
X  CANTIDAD MÍNIMA PENDIENTE        =IF(B8="", "", IF(OR(Y8="OK",(W8+(V8-E8)<=0)), "", MROUND((W8+(V8-E8))+(IF(S8="",1,S8)/2)-1,IF(S8="",1,S8)) ) )
Y  STATUS (A) =IF(B8="", "",
                 IF(E8<0,
                    IF(COUNTIF(L8:Q8, ">0")<$G$3, "Error, stock negativo", "STOCK BAJO,ORDENAR"),
                    IF(E8<V8, "STOCK BAJO,ORDENAR",
                       IF(AND(SUM(F8:Q8)=0, E8>0, U1922=""), "Excedente", "OK"))))
Y  STATUS (B) =IF(B8="", "", IF(E8<V8,"STOCK BAJO,ORDENAR",IF(AND(SUM(F8:Q8)=0,E8>0,U8=""),"Excedente","OK")))
```

Interpretación:

| Concepto | Cálculo |
|---|---|
| Demanda diaria | R / 22 (días hábiles) |
| **Punto de reorden** | Demanda durante el tiempo de entrega (T días hábiles, 7 por defecto) + stock de seguridad manual U |
| **Lote mínimo** | 1 mes de demanda |
| **Sugerido** | `MROUND(...)` es un truco para redondear **hacia arriba** al múltiplo de empaque S |
| **Máximo implícito** | V + W, es decir, el tiempo de entrega más un mes |
| **Excedente** | Cero consumo en 12 meses y existencia mayor que 0 |

No existe un parámetro de stock máximo explícito.

Ejemplos reales:
- `Aceite soluble PETROL`: R = 6 L/mes, T vacío (se toma 7), V = ⌈6/22·7⌉ = 2, W = 6, E = 0, S = 1. Pendiente = MROUND(6+2−0+0.5−1, 1) = **8**, y aparece en STOCKS BAJOS con 8.
- `Cangilon 5x4 Tapco`: R = 40.75, T = 7, V = ⌈12.97⌉ = 13, W = 41, E = 91 ≥ 13, así que el status es OK.

### 3.7 Lo que dice el dueño frente a lo que hacen las fórmulas

> *"cuando un artículo genera demanda, automáticamente genera un stock mínimo para un mes … ciertos componentes de importación necesitan tener al menos 6 meses"*

| Lo que dice el dueño | Lo que hace la fórmula |
|---|---|
| "genera demanda" | Salidas en ≥ 3 de los últimos 6 meses (G3, global para todos los artículos). |
| "stock mínimo para un mes" | W = `ROUNDUP(R)`: cada sugerencia de compra lleva al menos 1 mes de demanda encima del punto de reorden. El punto de reorden en sí solo cubre el tiempo de entrega. |
| "importados necesitan 6 meses" | **No existe un parámetro por artículo.** Con T = 60 días hábiles, V ≈ 2.7 meses y el lote es 1 mes. La única vía es el stock de seguridad manual (`Inventario!Y`), y **esa vía está rota** (F1). Además, los artículos con consumo esporádico (< 3 de 6 meses) quedan con R = 0: sin mínimo, sin alerta y marcados como "Excedente", justo el caso típico de las refacciones importadas. |

### 3.8 Indicadores auxiliares

- **Desabasto:** `=COUNTIF('STOCKS BAJOS 2.0'!A2:A, "<>")/Demanda!$V$6` = 18/261 = 6.9 %. El texto en Registro H4 lo explica.
- **Varios almacenes:**
  ```
  =IF(SUM(COUNTIF(G8,">0"),COUNTIF(I8,">0"),COUNTIF(K8,">0"),COUNTIF(M8,">0"),COUNTIF(O8,">0"))>1, "Componente en " & SUM(...) & " almacenes", "")
  ```
  No considera ni Revolución ni ML.

### 3.9 Quién registra y cómo

**Quién captura**
- No queda registro del usuario que captura. La hoja Registro solo la pueden editar: `susana@`, `elizabeth@`, `abel.jr@`, `almacen@hegamex.com` y **una cuenta personal de Gmail (ver permisos del archivo)**.
- `Noemí Rizo Ramírez` aparece en 8,486 movimientos (27 %), prácticamente todas las entradas y ajustes. **Es la almacenista.**
- En las salidas, H es quien recibe el material: 89 nombres distintos. Los más frecuentes:

| Nombre | Movimientos |
|---|---|
| Gustavo | 1,552 |
| Cesar Mauricio Torres Zuñiga | 1,454 |
| Fernando Glez | 1,452 |
| Juan esteban camacho | 1,275 |
| Emmanuel | 1,257 |

**Cómo llega la información**
- Hay un vale de papel ("Hojas Solicitudes Almacen": Solicita, Fecha, Cantidad, Material, Número de Pedido).
- Hay **captura por lotes**: 7,050 marcas de tiempo distintas para 31,733 filas, y lotes de hasta 159 filas con el mismo segundo. El 2-oct-2026 14:22:43 contiene en un mismo lote entradas con factura y salidas de varias personas.
- La fecha es, entonces, de captura. **No se pudo verificar si hay Apps Script**: la API de Sheets no lo expone.

**Protecciones**

| Rango protegido | Editores |
|---|---|
| Inventario C y E:V | Los mismos 5 que Registro |
| Demanda (todo menos G3) | Los mismos 5, más `jose.antonio@` y `abel@` |
| STOCKS BAJOS | `elizabeth@`, `abel.jr@`, `abel@` |
| INVENTARIADO | `abel.jr@` |

### 3.10 Validación de material para maquinaria (lo que alimenta el inventario)

En VAL "2026 - 2S - VALIDACIÓN MATERIAL/PEDIDO" hay una pestaña por pedido o serie (`P. 786 - Bazuca 10" x 12 S/C S/M`, `S133 - Zeus 30 2 Tolvas`…), copiada de `MACHOTE`.

- **ListaAlmacen:**
  - A1 = `=IMPORTRANGE("1sOh_…","Inventario!B7:B")`
  - B1 = `…"Inventario!E7:E"`
  - C1 = `…"Inventario!C7:C"`
  - **Al leerla, las tres mostraban `#REF!`.**
- **Columnas de cada pestaña de pedido:** Componente · Cantidad necesaria · Unidad · Miguel/Abel (casilla) · Stock Disp `=IFERROR(VLOOKUP(A5,ListaAlmacen!A$2:C,2,0)," ")` · Enc. Almacén (casilla) · Faltante `=IFERROR(IF(B5-E5<0,0,B5-E5),"")` · COMPRADO · INGRESADO · NOTAS.
- **Alerta:** "¡ALERTA!" si faltan menos de 10 días para la entrega y hay faltantes sin COMPRADO o sin INGRESADO.
- **Consecuencia:** cada pedido compara contra la existencia total sin apartar nada, así que dos pedidos pueden "contar" la misma pieza. El ERP debe resolverlo con reservas.

---

## 4. Almacenes y ubicaciones

### 4.1 Valores exactos que existen y su frecuencia

**Columna `Almacén` de A·Registro** (31,733 movimientos, dic-2024 → oct-2026):

| Valor exacto | Movimientos | % | Primer y último movimiento | Encabezado en Inventario | Qué es |
|---|---|---|---|---|---|
| `Planta Baja` | 16,469 | 51.9 | 24-abr-2024 → 2-oct-2026 | `PLANTA BAJA` / `2 - PB` | Almacén principal de consumibles. Familias más movidas: discos, rondanas, tornillos, tuercas, calcas, puntas, conectores, vidrios. |
| `Mallado` | 11,267 (+1 `mallado`) | 35.5 | 24-abr-2024 → 2-oct-2026 | `MALLADO` / `3 - M` | Segundo almacén. Familias más movidas: bandas, discos, chumaceras, láminas, tornillos, cable, PTR, guantes, ángulos. |
| `Planta Alta` | 2,132 | 6.7 | 18-dic-2024 → 24-ago-2026 | `PLANTA ALTA` / `1 - PA` | Poleas, catarinas, gabinetes, cosedoras. **Vaciada el 21 y 24-ago-2026** con 183 AJUSTE SALIDA "cambio de almacen" hacia Mallado, Contenedor 1 y Contenedor 2. |
| `Contenedor 1` | 917 | 2.9 | 13-dic-2024 → 1-oct-2026 | `CONTENEDOR` / `4 - C1` | Contenedor ("Contenedor 1"): bandas, cangilones, motores, mangueras, motorreductores, llantas, ejes. |
| `RESERVADO` | 393 | 1.2 | 6-jun-2025 → 28-sep-2026 | `7 - R`, y en Registro "RESERVADO ML" | Almacén **virtual** de apartados (§3.3). |
| `Contenedor 2` | 369 | 1.2 | 13-dic-2024 → 1-oct-2026 | `CONTENEDOR 2` / `5- C2` | Segundo contenedor: discos, catarinas, poleas, cangilones, válvulas, colectores. Inicial del 1/08/2024. |
| `Revolución` | 95 | 0.3 | 5-nov-2025 → 23-sep-2026 | `REVOLUCIÓN` / `" R"` | Otra bodega o sitio ("INVETARIO REVOL"): poleas, catarinas, cosedoras, motovibradores. Hoy la están vaciando hacia C1, C2 y PA. |
| `Almacén ML` | 90 | 0.3 | 16-may-2025 → 11-sep-2026 | `ALMACÉN ML` / `6 - ML` | Bodegas de **Mercado Libre Full** (de terceros). |

**Por año**, en el historial consolidado de B:

| Periodo | Almacenes válidos | Fuente |
|---|---|---|
| 2021–2023 | `Planta Alta`, `Planta Baja`, `Mallado`, `Contenedor` (uno solo) | H21·ListasDesplegables. En B·Registro aparecen filas como "Contenedor" el 29/12/2023. |
| 2024 | `Planta Alta`, `Planta Baja`, `Mallado`, `Contenedor 1`, `Contenedor 2` | H24·ListasDesplegables; Inventario 2024 con "Inventario inicial: 31/12/23" y C2 "1/08/2024". |
| 2025–2026 | Los 8 de la tabla anterior | A·ListasDesplegables |

No descargué la columna de almacén completa del historial 2021-24 (88 mil filas) para contar frecuencias, porque la instrucción fue muestrear.

**Para el importador hay que mapear:**
- `Contenedor` (2021-23) → `Contenedor 1`.
- `mallado` → `Mallado`.
- `RESERVADO` → una reserva sobre el almacén físico de origen, no un almacén.

### 4.2 Artículos y unidades por almacén (aproximado)

Existencia total disponible (Inventario E, sin ML ni Reservado):
- **1,867 artículos con existencia mayor que 0**, de 3,651.
- Por unidad: ≈ 90,500 piezas · 30,400 cm · 6,900 m · 1,300 L · 640 kg · 11,000 sin unidad capturada.
- Son unidades heterogéneas: sumarlas no tiene sentido físico.

Estimación por almacén. Sale de Σ movimientos dic-2024→oct-2026 más los saldos iniciales que pude verificar. No descargué las 8 columnas de saldo completas: son cotas, no cifras de cierre.

| Almacén | Artículos con saldo > 0 | Unidades netas aprox. | Nota |
|---|---|---|---|
| Mallado | ~860 | ~76,000 (≈42.6 k pz, 22.5 k cm, 5.4 k m, 1 k L) | Más el inicial J (escaso) |
| Planta Baja | ~620 | ~22,000 (≈21.4 k pz) | Más el inicial H (escaso) |
| Contenedor 2 | ~150 | ~11,200 (casi todo piezas) | |
| Contenedor 1 | ~130–170 | ~1,650 (477 de movimientos + ~1,180 del inicial L "31/12/23") | |
| Revolución | ~40 | ~1,440 pz | |
| RESERVADO | **12** (exacto, pivote RESERVAS) | **~1,043** (exacto) | Por movimientos da 14 y 1,048: la diferencia es que el pivote solo llega a la fila 3,485. |
| Almacén ML | **7** (exacto, pivote FULL ML) | **818 pz** (exacto, cuadra con los movimientos) | |
| Planta Alta | ≈0 | ≈0 | En todas las muestras de `Inventario!G` hay 0.00. Los iniciales de F cancelan salidas viejas. |

Las cotas suman ~112 k unidades contra ~141 k de E. La diferencia (~29 k) está en los saldos iniciales H/J/N/P que no sumé. **168 artículos tienen existencia en 2 o más almacenes.**

### 4.3 Cómo se registran los traspasos

- No existe un tipo "traspaso".
- Se capturan **dos filas en el mismo lote**:
  - `AJUSTE SALIDA` en el almacén origen.
  - `AJUSTE ENTRADA` en el destino.
  - Mismo producto y cantidad, con motivo libre `cambio de almacen`. Variantes reales: `Camobio de almacen`, `cambio de alamcen`, `cambio de almacen y ajist`, `CAMBIO DE ALMACEN`, `correccion de almacen`, `ENVIO A ML`, `para reserva`.
- Volumen: ~610 ajustes con "cambio de almacén" y variantes, y 113 pares exactos con la misma marca de tiempo y producto.
- De esos, 69 pares cuadran también en cantidad con almacenes distintos. Rutas más comunes:

| Ruta | Pares |
|---|---|
| Revolución → C2 | 10 |
| Revolución → C1 | 8 |
| PA → Mallado | 7 |
| Mallado → PA | 6 |
| Revolución → PA | 6 |
| Mallado → C1 | 5 |
| PA → Revolución | 4 |
| Mallado → RESERVADO | 4 |

- **Eventos masivos:**
  - 21-ago-2026: 73 AJUSTE SALIDA de PA → 57 AJUSTE ENTRADA en Mallado y 9 en C1.
  - 24-ago-2026: 110 AJUSTE SALIDA de PA → 109 AJUSTE ENTRADA en C2, "cambio de almacen y ajuste".
- Muchos pares no cuadran porque el traspaso se mezcla con una corrección de conteo en el mismo renglón.
- **Riesgo para el importador:** un ajuste puede ser traspaso, corrección, venta o apartado. Hay que clasificarlo por emparejamiento y texto (§6.3).

### 4.4 Ubicaciones dentro del almacén (estante, pasillo, rack)

**No existen.** Revisé:
- Encabezados de A·Inventario, A·Registro, INVENTARIADO, C1 y C2.
- Inventarios de H21 y H24.
- ListaComponentes de CYA (11 columnas).
- Textos de motivo y notas: no aparece ningún código tipo `A-3-2` ni las palabras estante, anaquel, pasillo, rack o repisa.

Lo más cercano son notas sueltas en `Inventario!X`: "se moverán a planta baja" (~17 artículos), "quedo 1 para refacciones se movio a mallado"; en Registro, "OFICINA PLANTA ALTA".

**El ERP tiene que crear las ubicaciones desde cero.** Conviene hacerlas opcionales al principio: `almacen` obligatorio y `ubicacion` nula, con un formato por definir con el almacén.

### 4.5 Otras "bodegas" lógicas que aparecen en los datos

| Nombre en los datos | ¿Es almacén? | Cómo funciona hoy | Propuesta en el ERP |
|---|---|---|---|
| `FULL ML` / `Almacén ML` | Sí, de un tercero (consignación en ML Full) | Almacén con movimientos; pivote FULL ML | Almacén de tipo `consignacion_ml`, no disponible para producción |
| `RESERVADO` | No: es un estado | Almacén virtual con par de ajustes | Tabla `reserva` sobre el almacén físico |
| `EXCEDENTES` | No: es una clasificación | Status de Demanda = "Excedente" | Vista o reporte calculado |
| `Herramientero` | Lista aparte, sin movimientos | 58 herramientas con stock estático y fórmula rota | Almacén "Herramientas" o módulo de préstamo (no existe hoy) |
| Retazos de banda ("Pedaseras") | No: son artículos | Se crean artículos aparte con sufijo **" H"** (42 artículos, p. ej. `Banda 2 capas 1/8 x 1/16 20" H`, categoría "Bandas transportadoras H"). El corte se registra como SALIDA o AJUSTE SALIDA del rollo y AJUSTE ENTRADA de la tira (165 movimientos; motivos "para corte", "corte de venta", "se corta por 35 y 8"). Hay también "Sobrantes de grapa RS…", "Cable … un tramo pedasera" y "TRAMO DE BANDA …". | Artículo con variante de ancho y lote con largo, u operación "corte/transformación" con consumo y producción. |
| `Contenedor` (2021-23) | Sí, histórico | Se renombró a `Contenedor 1` en 2024 | Mapear |

---

## 5. Conexiones IMPORTRANGE

### Entran a A

| Destino en A | Origen | Rango |
|---|---|---|
| ListasDesplegables!E4 | `1bMPe8wRcFv66tap2k7qW6MOIDWDYMeng8Mii4ZwAdFs` (Directorio Proveedores) | `Directorio Proveedores!B3:B` |
| LISTA ENLAZADA COSTOS!A3 | CYA `1yMB2r3K…` | `ListaComponentes!A2:I` (con `SORT`) |
| LISTA ENLAZADA COSTOS!F1 | CYA | `Actualizaciones!F3:F4` |
| ORDENES!A4 | CYA | `Órdenes!A5:J` |
| STOCKS BAJOS 2.0!G1 / H1 | CYA | `'STOCKS BAJOS 2.0'!H3:H` / `I3:I` |
| RESERVAS!G2, FULL ML!G2 | CYA | `'STOCKS BAJOS 2.0'!I3:I` (desalineado) |
| Demanda!F8 | **B** | `Demanda!F8:R` |
| Demanda!B7 | **A (sí mismo)** | `Inventario!B7:E4000` |
| Demanda!U7 | **A (sí mismo)** | `Inventario!W7:W` (**error**) |
| Inventario!V7 | **A (sí mismo)** | `Demanda!Y7:Y` |

### Salen de A

| Destino | Rango de A |
|---|---|
| B·Registro!A56601 | `Registro!B8:I` |
| B·Demanda!B7 y B·'Componentes Actual'!A1 | `Inventario!B7:E` |
| B·Demanda G3 / S7 / T7 / U7 / V7 | `Demanda!G3`, `S7:S`, `T7:T`, `U7:U`, `V7:V` |
| CYA·'Registros Inventario'!A4 | `'Registro'!B11:K` |
| VAL·ListaAlmacen A1/B1/C1 | `Inventario!B7:B`, `E7:E`, `C7:C` |
| CYA·'STOCKS BAJOS 2.0' | Probable: es el origen de las notas de compras. No verifiqué su fórmula. |

### Entran a B

| Destino | Origen |
|---|---|
| Registro!A1 | H21 `Registro!B8:I` |
| Registro!A34997 | H24 `Registro!B9:I` |
| Registro!A56601 | A `Registro!B8:I` |
| Demanda!B7 / G3 / S7:V7 | A |
| DemandaEspejo!A1 | B mismo, `Demanda!B7:Y` |

### Salen de B

| Destino | Rango |
|---|---|
| A·Demanda!F8 | `Demanda!F8:R` |
| A·EXCEDENTES!J2 | `Demanda!F7:Q7` |
| DemandaEspejo y Componentes Actual | Sin consumidor identificado |

---

## 6. Entidades propuestas para el ERP e importador

### 6.1 Entidades (Postgres)

| Entidad | Campos clave | Origen hoy |
|---|---|---|
| `almacen` | id, codigo, nombre, tipo (`propio`/`consignacion_ml`/`herramientas`), activo, disponible_para_produccion | ListasDesplegables B. Los 8 valores menos RESERVADO, más "Herramientas" |
| `ubicacion` | id, almacen_id, codigo (formato por definir, p. ej. `PB-A-03-2`), descripcion, activo | **No existe**; crear vacía |
| `articulo` | id, **clave/sku**, nombre, nombre_normalizado (único), unidad_id, categoria_id, cantidad_por_empaque, publicado_ml, activo, notas | Inventario B/C/D/W/X/AA + ListaComponentes (ID en col D). Lo detalla el informe de componentes. |
| `unidad` | id, codigo (`pza`, `m`, `cm`, `kg`, `L`, `caja`, `par`, `juego`, `tramo`, `servicio`) | Normalizar `Pieza`/`pieza `/`Litro`… |
| `categoria_articulo` | id, nombre | ListasDesplegables C (~62) |
| `empleado` | id, nombre, alias[], activo | ListasDesplegables D más los distintos de Registro H (89) |
| `documento_inventario` (cabecera) | id, tipo, folio, fecha_movimiento, fecha_captura, capturado_por (usuario), empleado_id (recibe/entrega), referencia_tipo (`pedido`/`serie`/`venta`/`venta_ml`/`area`/`proyecto`), referencia (texto + FK opcional a pedido/OC), proveedor_id, documento_proveedor (factura/remisión/nota), notas, origen_importacion | Registro B, H, I, J, K, T, agrupado por lote |
| `movimiento_inventario` (renglón) | id, documento_id, articulo_id, almacen_id, ubicacion_id, cantidad (> 0), signo/sentido, unidad_id, costo_unitario (opcional), es_merma, motivo_ajuste, origen (archivo, hoja, fila) | Registro C, D, E, F, G, W |
| `traspaso` | Documento con almacén origen y destino (genera 2 movimientos) | Pares AJUSTE SALIDA/ENTRADA |
| `existencia` (vista o tabla materializada) | articulo_id, almacen_id, ubicacion_id, cantidad, actualizado_en | Inventario G…U |
| `reserva` | id, articulo_id, almacen_id, cantidad, referencia_tipo/ref (pedido de producción, cotización o venta, cliente), vendedor/empleado_id, estado (`activa`/`surtida`/`cancelada`), fechas | `RESERVADO` |
| `parametro_reabasto` (por artículo, opcional por almacén) | tiempo_entrega_dias_habiles, multiplo_compra, stock_seguridad, **cobertura_objetivo_meses** (1 por defecto, 6 para importados), ventana_meses (6), min_meses_con_consumo (3), dias_habiles_mes (22), es_importado, punto_reorden_manual, maximo_manual, motivo | LEC I, LEC C, Inventario Y, Demanda G3, constantes de fórmula |
| `demanda_mensual` (vista materializada) | articulo_id, anio, mes, cantidad_salida, cantidad_venta, cantidad_ajuste | B·Demanda F:Q, recalculada desde movimientos |
| `conteo_fisico` + `conteo_fisico_linea` | almacen_id, fecha, responsable; articulo_id, cantidad_sistema, cantidad_contada, verificado, observacion → genera ajustes | INVENTARIADO, C1, C2 |
| `orden_compra` / `orden_compra_linea` | Ver el informe de compras | ORDENES (CYA·Órdenes) |
| `herramienta` / `prestamo_herramienta` (opcional) | herramienta, cantidad, empleado, fecha_salida, fecha_regreso | Herramientero (solo stock inicial) |
| `transformacion` (corte de banda, opcional) | Consumo de rollo → producción de tiras o retazos con largo y ancho | Patrón "… H" y "corte" |

**Regla de cálculo sugerida en el ERP:**

```
punto_reorden = ceil(dem_diaria × tiempo_entrega + stock_seguridad)
objetivo      = punto_reorden + dem_mensual × cobertura_objetivo_meses
sugerido      = ceil_multiplo(objetivo − (existencia − reservado) − en_transito_OC, multiplo)
```

- `dem_mensual` debe promediar **sobre todos los meses de la ventana, incluidos los de cero consumo**, o usar un percentil, en lugar de promediar solo los meses con consumo.
- `en_transito` sale de las OC "Pedido/Enviado".

### 6.2 Mapeo columna → campo para el importador

**Movimientos de A·Registro (2024-12 → hoy) y B·Registro (2021–2024)**

| Origen A (B) | Campo destino | Transformación |
|---|---|---|
| B (A) Fecha y Hora | `documento.fecha_captura` (también `fecha_movimiento`) | Interpretar como serial, `d/m/yyyy H:MM:SS`, `d/m/yyyy H:MM` (123 de texto), `d/m/yyyy` (414) o `dd/mm/yy`. **`30/12/1899` = nula** (19 filas de 2021). Zona America/Mexico_City. |
| C (B) Producto/Articulo | `movimiento.articulo_id` | Normalizar: quitar espacios y tabuladores (124 nombres), colapsar espacios, comparar sin mayúsculas, y buscar contra el catálogo. Guardar `nombre_original`. 30 nombres de Registro no existen en Inventario: van a una tabla de pendientes. |
| D (C) Unidad | `movimiento.unidad_capturada` | Si está vacía, usar la del artículo. **Ojo con los cambios de unidad entre años**: "Varilla roscada 3/4"" estaba en `cm` en 2021 y en `pieza` en 2024. |
| E (D) Cantidad | `movimiento.cantidad` | Interpretar `´2` → 2; las vacías (6) se rechazan. Se permiten decimales (596). |
| F (E) Tipo | `documento.tipo` / `movimiento.sentido` | `ENTRADA` → `entrada_compra` si J o K tienen dato, si no `entrada_otra`. `SALIDA` → `salida_venta` si I contiene VENTA/ML/FULL, si no `salida_consumo`. `AJUSTE SALIDA/ENTRADA` → `traspaso` si se empareja en el mismo lote, producto y cantidad con almacenes distintos, o si I contiene "cambio de alm/camobio/alamcen"; `reserva` si el destino es RESERVADO; `venta` si I contiene VENTA; si no, `ajuste_conteo`. `Nuevo Artículo` → `entrada_otra`. |
| G (F) Almacén | `movimiento.almacen_id` | Normalizar mayúsculas. `Contenedor` → `Contenedor 1`. `RESERVADO` → reserva sobre el almacén de origen del par; si fue una ENTRADA directa, sobre Mallado o PB según el caso, a decidir. |
| H (G) Personal | `documento.empleado_id` | Coincidencia por alias; "Taller", "Sr. Abel" y similares → alias. 206 vacíos → nulo. |
| I (H) Pedido/Motivo | `documento.referencia_texto`, `referencia_tipo` y `referencia` | Expresiones: `^P\.?\s*-?\s*(\d{3,4})` = pedido de producción; `^S\s*-?\s*(\d{2,4})` = serie o stock; `VENTA.*(ML|FULL|MERCADO)` = venta_ml; `VENTA` = venta; taller/torno/plasma/pintura/EPP = área; lo demás = proyecto o texto. Hay varios pedidos en un texto ("P773,781,780") → varias referencias. |
| J (—) Factura | `documento.documento_proveedor` | Prefijo `F`/`FA`/`FB` = factura, `R` = remisión, `N` = nota (inferido del formato). |
| K (—) Proveedor | `documento.proveedor_id` | Contra el catálogo de proveedores (directorio general) con coincidencia aproximada. |
| T Notas, W Merma | `documento.notas`, `movimiento.es_merma` | — |
| Hoja y fila | `origen_importacion` | Para trazabilidad y reprocesos. |

**Otras fuentes**

| Dato | Origen | Destino |
|---|---|---|
| **Saldos de apertura** | `A·Inventario` G (PA), I (PB), K (M), M (C1), O (C2), Q (Revolución), S (ML), U (Reservado) a la fecha de corte | `movimiento` tipo `apertura` por artículo × almacén, más `reserva` por el saldo de U |
| Parámetros | LEC I (días hábiles, vacío = 7), LEC C (múltiplo), Inventario Y (seguridad), Inventario AA (publicado ML), Demanda G3 (3), constante 22 | `parametro_reabasto` y `articulo` |
| Notas de artículo | Inventario W, X | `articulo.notas` |
| Reservas abiertas | Inventario U > 0 (12 artículos) más el último AJUSTE ENTRADA/ENTRADA a RESERVADO de cada artículo (H = responsable, I = referencia) | `reserva` |
| Conteo ago-2026 | INVENTARIADO A:H (foto 17-ago-2026), C1, C2 | `conteo_fisico` (histórico) |
| Catálogos | ListasDesplegables A–D | `tipo`, `almacen`, `categoria`, `empleado` |

### 6.3 Estrategia de corte recomendada

1. **Existencia oficial = saldos de A·Inventario a la fecha de corte** (carga de apertura por almacén). No hay que intentar reconstruirla desde 2021: hay saldos iniciales manuales y cambios de unidad.
2. Los movimientos históricos se cargan como **historial** con `afecta_existencia = false`, para demanda, auditoría y consumo por pedido.
   - Bastan los 12–24 meses recientes (todo está en A).
   - Si se importan 2021–2024 desde H21/H24, **descartar el traslape 13–20-dic-2024**, que existe en H24 y en A. Las filas no son idénticas: en algunas el almacén se corrigió, de Planta Baja a Mallado.
3. Conciliación automática: para cada artículo y almacén, `inicial (F..T) + Σ mov A = Inventario`. Ya se verificó en 3 casos y el reporte de diferencias debe salir en cero.

---

## 7. Problemas de calidad de datos y fallas de fórmula

### Riesgos operativos inmediatos

| # | Problema |
|---|---|
| **R1** | **`B·Registro` está a ~160 filas de su límite** (datos hasta la fila 88,338 de 88,500; se capturan ~70 movimientos por día hábil). Cuando el bloque de A crezca, el `IMPORTRANGE` de A56601 no tendrá filas para expandirse: en Sheets da `#REF!` ("no se expandió automáticamente") y la **demanda, los mínimos y STOCKS BAJOS se caen**. |
| R2 | A·Registro tiene 32,322 filas con datos hasta la 31,745 (quedan ~580). A·Demanda importa solo `Inventario!B7:E4000` y el inventario ya va en la fila 3,660. |
| R3 | **VAL·ListaAlmacen mostraba `#REF!`** en los tres `IMPORTRANGE` de existencias el 3-oct-2026: la validación de material por pedido no ve stock. |
| R4 | **Seguridad**: `Contactos` (oculta) y `Pedaseras de bandas` tienen en texto plano lo que parece la **contraseña de la FIEL**, junto al RFC. Una **cuenta personal de Gmail** tiene permiso de editar las hojas protegidas. |

### Fallas de fórmula

| # | Problema |
|---|---|
| **F1** | `A·Demanda!U7 = IMPORTRANGE(…,"Inventario!W7:W")` lee "Notas 1" y no Y "Inventario de seguridad manual". **El stock de seguridad manual (~60 artículos, p. ej. Cangilones Tapco 48, tornillos p/cangilón 100) no entra al punto de reorden.** Cangilon 3x2 tiene Y=48 y V=0. Donde la nota tiene texto ("ya no se utiliza") da `#VALUE!` en V, X e Y: 3 artículos. Probable causa: se insertaron las columnas de Notas después de escribir la fórmula. |
| F2 | `A·Demanda!Y` usa `U1922=""`: referencia desfasada que debería ser `U8`. |
| F3 | `A·Demanda!AA` cuenta `Registro!J` (factura) = "SALIDA", así que siempre da 0. El filtro de EXCEDENTES "AA=0" no filtra nada. |
| F4 | Los pivotes RESERVAS y FULL ML leen `Inventario!B7:V3485`, pero hay artículos hasta la fila 3,660: **~175 artículos quedan fuera**. |
| F5 | STOCKS BAJOS y EXCEDENTES, columna AD `VLOOKUP(…,Inventario!$B$7:$V,25,0)` da `#REF!` (el rango tiene 21 columnas). Registro C4:C10 da `#REF!`. Herramientero!E suma el número de factura. |
| F6 | Las notas de Compras (`CYA·'STOCKS BAJOS 2.0'!H/I`) se pegan por **posición de fila** junto a un pivote que cambia: las notas pueden quedar en el artículo equivocado. RESERVAS y FULL ML muestran "Enviado" sin sentido. |
| F7 | El valor de EXCEDENTES ($4.23 M) usa el **precio de venta** (costo/0.7) más IVA en lugar del costo. Además hay rangos relativos que se recorren (`'LISTA ENLAZADA COSTOS'!A4:F` → `A5:F`…, `Demanda!B8:R` → `B9:R`…). |
| F8 | La demanda promedia **solo los meses con consumo** e ignora los `AJUSTE SALIDA` de venta (~130). Los artículos con menos de 3 de 6 meses de consumo quedan sin mínimo. El `/22` supone días hábiles, que es coherente con el encabezado de origen, pero el 70 % de los artículos tiene el valor por defecto de 7 días. **Ningún artículo tiene un tiempo de entrega de importación realista (máximo 100 días).** |
| F9 | Registro D (unidad) y A (MOV GRUP) no se arrastraron a las filas nuevas (1,602 sin unidad). Registro U (Mes) aparece sin fórmula visible. |

### Datos

| # | Problema |
|---|---|
| D1 | **No hay llave de artículo**: todo cruza por nombre de texto. 124 nombres en Registro tienen espacios o tabuladores al final, 9 duplicados solo difieren en mayúsculas o espacios (`Estopa`/`estopa`/`ESTOPA`), **19 nombres están repetidos dentro de Inventario** (p. ej. `aceitera 500ml`, `Motor 2F 10 HP 4 polos Weg`) y ListaComponentes tiene 36 duplicados normalizados. `MATCH` toma el primero, así que el segundo renglón duplica la existencia en los totales. |
| D2 | Fechas mezcladas (serial, texto sin segundos, solo fecha, `1899`). La fecha es **de captura por lotes**, no del movimiento. |
| D3 | **Traslape dic-2024** entre el respaldo 2024 y el archivo 2025, que se cuenta dos veces en B·Registro. Hoy no afecta porque está fuera de la ventana de 12 meses, pero sí afecta al historial. |
| D4 | Unidades sin normalizar (`Litro`/`litro`, `Par`/`par`, `pieza `, vacío) y cambios de unidad de un mismo artículo entre años (cm ↔ pieza). La unidad de Registro D sale de LEC, que puede diferir de `Inventario!C`. |
| D5 | Personal libre: 89 nombres, apodos ("Gustavo", "Isaac"), "Taller" como persona, "Sr. Abel"/"Sr. Abel ". 206 filas sin persona. |
| D6 | Motivo libre: 1,736 salidas sin motivo (~8 %). Hay pedidos escritos de 6 formas (`P717`, `p675`, `P.773 Mezcladora`, `P 797`, `P773,781,780 3.30MTS`). Proyectos (`TUXTLA`, `SILO P714`) y áreas (`PLASMA`, `taller`) mezclados en el mismo campo. |
| D7 | Los ajustes se usan para todo: traspaso, conteo, venta, apartado, corte. 100 entradas sin factura y 41 sin proveedor. El catálogo de proveedores es el directorio general de gastos. |
| D8 | Saldos iniciales escasos con etiquetas de fecha contradictorias ("12/2025", "31/12/23", "1/08/2024"). Abreviaturas ambiguas: `" R"` = Revolución y `7 - R` = Reservado; "RESERVADO ML" en Registro. |
| D9 | 2 artículos con existencia negativa. La casilla de merma y la columna X no tienen uso evidente. Notas de Registro prácticamente vacías. |
| D10 | Basura: una fecha capturada como producto (`30/10/2025 14:02:44`), 5 filas de encabezado incrustadas en B·Registro (56,601–56,605) y hojas muertas (Pedaseras, Contactos, Herramientero). |

---

## 8. No verificado o pendiente

- **Apps Script** (si existe un botón o script de captura por lotes): la API de Sheets no lo expone.
- Qué archivo consume `B·DemandaEspejo` y `B·Componentes Actual`.
- Las fórmulas de `CYA·'STOCKS BAJOS 2.0'`.
- Las validaciones "2026 - 1S" y "VALIDACIÓN MATERIAL/PEDIDO" (2023): por nombre parecen iguales a la 2S.
- **Existencias exactas por almacén**: no descargué completas las columnas G…U de Inventario. Las cifras de §4.2 son estimaciones a partir de movimientos.
- Frecuencias exactas de almacén y tipo en el historial 2021-2024 (88 mil filas): no descargadas, por la instrucción de muestrear.
- Origen de la columna `Registro!U` (Mes).
- Si los ~60 artículos con stock de seguridad manual alguna vez se reflejaron en el punto de reorden. La hipótesis de columnas insertadas se apoya en el texto de STOCKS BAJOS!X ("tiene configurado stock de seguridad… y está incompleto").

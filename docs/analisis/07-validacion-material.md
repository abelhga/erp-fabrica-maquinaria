# 07 · "2026 - 2S - VALIDACIÓN MATERIAL/PEDIDO": análisis para el ERP

- **Archivo:** `14xsHeDYrlZLEa5scsRkcJhjIgRRExgmPHAxFdWGDWSk`. Creado el 7-ago-2026 y modificado por última vez el 2-oct-2026. Lo revisé el 3-oct-2026, **solo en lectura**.
- **Pestaña que señaló el dueño:** gid `1306271802` = **`MACHOTE`**, la plantilla de la que se copia cada pestaña de pedido.
- **Archivos hermanos** (se encontraron por título en Drive; solo los revisé por encima):
  - `2026 - 1S - VALIDACIÓN MATERIAL/PEDIDO` (`15rAKkSUoG3jixtWtTwBQgEfcsYBb5rmOkbfBbsFftEg`): pedidos 768 a 785 y S129 a S130. Tiene la **misma estructura** y **su cruce con inventario sí funciona**.
  - `VALIDACIÓN MATERIAL/PEDIDO` (`1uzY9ii0CyIV-WjUPZEzv5Ep9vKo0XijXWYk1GXhd7LY`): el original de 2023, con encabezados anteriores ("Enc. Compras" y "Enc. Almacén" en H e I).
  - `RESTARUADO VALIDACION 2026` (`1g2genQ5xJR3rnovJVsh_qkKCVc-TevkTjuNu5UlWa5E`): no lo revisé.
  - Carpetas `HISTORIAL DE VALIDACIÓN DE EQUIPOS (PDF)` y `Validación de Materiales Por Pedido`: no las revisé.

---

## 0. Resumen ejecutivo

1. **Qué es.** Cada **equipo de un pedido** tiene **su propia pestaña**. Se copia el `MACHOTE` y se captura el pedido, el número de serie, la fecha de entrega y el equipo (lista desplegable con el catálogo del costeo). Un `QUERY` **explota la lista de materiales** del equipo desde `Nuevo Costeo › BASE EQUIPOS`. Después, cuatro casillas por renglón recorren el proceso: **técnico (Miguel/Abel) → almacén (revisión física) → compras (faltante pedido) → almacén (empaquetado y salida)**. Las notas de celda en D4, F4, H4 e I4 explican cada paso (cita literal en §3.3).
2. **En este archivo (2S) el cruce con inventario está roto desde que se creó.** `ListaAlmacen` (IMPORTRANGE al inventario) devuelve `#REF!` con el mensaje *"Please use a desktop web browser to connect this sheet"*: nunca se dio "Permitir acceso". Por eso `Stock Disp` sale en blanco en los **~1,248 renglones** de las **22 pestañas de pedido**, `Faltante` sale vacío, el formato condicional nunca pinta rojo y la `¡ALERTA!` nunca se dispara. En el archivo 1S el mismo mecanismo sí calcula. Ahí se ve `¡ALERTA!` con 7 faltantes en el P.784.
3. **En la práctica solo se usan dos casillas: D (Miguel/Abel) y F (Enc. Almacén).** `COMPRADO` e `INGRESADO` están en **FALSE en el 100 % de los renglones** de las 22 pestañas, y también en el P.784 del 1S, que sí tenía faltantes. Las compras y las salidas ocurren, pero **fuera de esta hoja**. La salida se registra a mano en `Inventario › Registro` con el pedido escrito como texto libre (por ejemplo "P786" o "S131, S132,S134 P793").
4. **No hay reservas ni suma entre pedidos.** Cada pestaña compara su renglón contra **todo** el stock. Por ejemplo, las dos bazucas del pedido 786 (dos pestañas) más el S133 piden 28 m de `Tubo 2" ced. 40` y hay 18 m. Cada pestaña, por separado, diría "faltante 0".
5. **La lista de materiales está viva** (un `QUERY` al costeo), pero las casillas y notas son **estáticas**. Si alguien edita el costeo, el renglón se mueve y las marcas quedan sobre otro material. La propia hoja lo prohíbe por convención: *"Una vez validado NO modificar hasta el siguiente pedido"*.
6. **Las correcciones técnicas y los extras del pedido viven en notas libres:** "Son de 14"", "DEBE SER 4X3", "LLEVA UNA ENVASADORA…", "Será a 2 Fases Por esta ocasion". No regresan al costeo ni generan nada para compras.
7. **Lo que de verdad sale del almacén para un pedido no se parece a la lista validada** (caso P786 en §3.6). El ERP tiene que conciliar la lista contra los vales de salida.

---

## 1. Pestañas: propósito y si están vivas

### 1.1 Pestañas auxiliares

| # | Pestaña | Visible | Tamaño de la cuadrícula | Contenido | Estado |
|---|---|---|---|---|---|
| 0 | `EspejoBaseEquipos` | oculta | 26,763 × 26 | `A1 =IMPORTRANGE("1sFjjiLxpsiFf0zroiv4RSWb4a5zmvCacABNg2bf9y6E","'BASE EQUIPOS'!A3:E")` → ID, Nombre del equipo, Material, Cantidad, Unidad (una fila por renglón de BOM de todos los equipos) | **Viva**, trae datos |
| 1 | `NombreEquipos` | oculta | 1,000 × 26 | `A1 =IMPORTRANGE("1sFjjiLxpsiFf0zroiv4RSWb4a5zmvCacABNg2bf9y6E","'EQUIPOS'!B2:B")` → "Título del Equipo". Rango con nombre `NombreEquipos` = `NombreEquipos!A2:A1000` | **Viva**, alimenta la lista desplegable de B2 |
| 3 | `ListaAlmacen` | oculta | 7,818 × 26 | `A1 =IMPORTRANGE("1sOh_Gyj0ofi7aSYKdKmCJSyT_H6G1_wH18OlrybY2QE","Inventario!B7:B")`, `B1 =IMPORTRANGE("https://docs.google.com/spreadsheets/d/1sOh_…/edit#gid=2013039626","Inventario!E7:E")`, `C1 =IMPORTRANGE("…/edit#gid=2013039626","Inventario!C7:C")` → nombre, **STOCK ACTUAL TOTAL DISP**, unidad | **ROTA**: las tres celdas dan `#REF!` "Please use a desktop web browser to connect this sheet." |
| 4 | `HOY` | visible | 1,000 × 26 | `A1 "Hoy es: "`, `B1 =TODAY()` | Viva; la usa la alerta |
| 2 | **`MACHOTE`** | visible | 24,262 × 11, filas 1 a 4 fijas | Plantilla. Viene precargada con el equipo "Banda cargadora de 18" x 15 metros inoxidable" y todas sus casillas en FALSE | Viva como plantilla |

Sobre `ListaAlmacen`: en el archivo 1S y en el de 2023, la misma `ListaAlmacen` sí regresa datos ("4 pilas alcalina tamaño AAA", 14.00, pieza…). La falla es solo de este archivo: falta autorizar la conexión entre archivos. El `gid=2013039626` de la URL no existe en el inventario actual, pero IMPORTRANGE ignora el gid, así que eso no causa la falla.

### 1.2 Pestañas de pedido (22, todas vivas)

Leyenda: **D** = Miguel/Abel, **F** = Enc. Almacén, **H** = COMPRADO, **I** = INGRESADO. Se cuentan los renglones marcados sobre el total. "HH" = renglones de "Horas hombre …".

| Pestaña | B1 Pedido | F1 Serie | J1 Entrega | B2 Equipo | Renglones | D | F | H / I | Notas (col. J) |
|---|---|---|---|---|---|---|---|---|---|
| P. 786 - Bazuca 10" x 12 S/C S/M | 786 | BH1012000N345 | 23/09/26 | Transportador helicoidal tipo bazuca de 10" x 12 S/C S/M | 26 | 22 (4 HH sin marcar) | 22 | 0 / 0 | — |
| P. 786.1 - (ídem) | 786 (A1 dice "-") | BH1012000N346 | 23/09/26 | ídem | 26 | 21 (`Varilla roscada 1"` D=FALSE) | 22 | 0 / 0 | — |
| P. 788 - Mezcladora Inox | 788 | MC0103EV010 | 18/09/26 | **Mezcladora Andres** | 55 | 52 | 52 | 0 / 0 | — (dos renglones `Opresor Allen NC 3/8" X 1"`, 4 y 6) |
| P. 789 - Tren 4 Tolvas | 789 | TC15R068 | 26/10/26 | **PROVISIONAL TREN DE 4 TOLVAS** | 18 | 15 | 15 | 0 / 0 | — |
| P. 790 Helicoide Teremana | 790 | SIN | 14/09/26 | **Teremana Helicoidal** | 10 | 9 | 9 | 0 / 0 | — |
| P. 791 - Zar 4T c/alimentador de cang. | 791 | "CZ0202VT141⏎EC04030302T037" (dos series en una celda) | 03/11/26 | Cribadora Zar 4T con turbina con alimentador | 70 | **8** (en curso) | **0** | 0 / 0 | J5:J7 "LLEVA UN JUEGO EXTRA / DE CRIBAS - REVISAR CON / EL VENDEDOR"; J45 y J46 "Son de 14"" (en `Polea 16"` 1rb y 2rb); J47 y J48 "Son de 3"" (en `Polea 4"` 1rb y 2rb) |
| P. 792 - Bazuca rompesacos 8" x 8 | 792 | BH080810ET347 | 11/11/26 | Transportador helicoidal tipo bazuca rompesacos 8" x 8 metros con manga y 2 registros | 68 | 64 | 64 | 0 / 0 | — |
| P. 792 - Tolva p/env 5 mts3 | 792 | TC05B069 | 11/11/26 | Tolva para envasadora de 5 metros cúbicos | 17 | 13 (Estopa y 3 HH sin marcar) | 13 | 0 / 0 | J5:J7 "LLEVA UNA ENVASADORA / ELECTRONICA A PRUEBA / DE POLVOS EN ACERO AC" |
| P. 792 - Banda pedestal 2.5 mts | 792 | TP12020163E257 | 11/11/26 | Banda pedestal de 2.5 metros para cabezal - Hegamex® | 88 | 84 | 84 | 0 / 0 | J5:J6 "LLEVA UN CABEZAL / COSEDOR F900A" |
| P. 792 - Banda cargadora 18" x 6.60 mts lev. elec. | 792 | TB18060275E258 | 11/11/26 | Banda cargadora de 18" x 6.60 metros con levante electrónico | 86 | 82 | 82 | 0 / 0 | — |
| P. 793 - Zar 4T | 793 | CZ0202VT158 | 03/11/26 | Cribadora Zar 4T con turbina | 91 | 81 | 87 | 0 / 0 | J5:J7 "LLEVA UN JUEGO EXTRA…"; J8 sobre bifásico; J39, J71, J72 y J93 (ver §3.6 y §5) |
| P. 793 - Elevador 2.80 mts | 793 | EC05040302T038 | 01/12/26 | Elevador de 2.8 metros de 4" x 5" para zaranda | 39 | 35 | **0** | 0 / 0 | J9 "DEBE SER 4X3" (en `Cangilon 5x4 azul, marca Tapco`) |
| S131 - V3 | S131 | CV0200N155 | 12/10/26 | Cribadora V3 con turbina bifásica | 64 | 64 (también las HH) | 64 | 0 / 0 | J6 "VENDIDO" (en `Angulo 1/4 x 1 1/2 x 6.10 mts`) |
| S131 -Bazuca 6" x 9 mts | S131 | BH060905ET348 | 12/10/26 | Transportador helicoidal tipo bazuca de 6" x 9 motor punta | 49 | 45 | 45 | 0 / 0 | — |
| P. 794 - Helicoidal 13" x 11.50 mts | 794 | S/N | 12/11/26 | Helicoidal completo para bazuca de 13" x 11.5 Mts | 8 | 5 | 5 | 0 / 0 | — |
| P. 795 - Tolva 32 mts3 | 795 | TC32RB070 | 21/12/26 | Tolva de 32 metros cúbicos rectangular dos descargas para envasadoras | 19 | 16 | 16 | 0 / 0 | — |
| P. 796 - **2** Helicoidal armado 16" x 12 mts | 796 | S/N | 27/10/26 | Helicoidal armado para 16" x 12 metros | 8 | 6 | 6 | 0 / 0 | — (el nombre dice 2 piezas; la lista es la de 1) |
| S132 - V3 | S132 | CV0200N156 | **(vacía)** | Cribadora V3 con turbina bifásica | 64 | 64 | 64 | 0 / 0 | — |
| S133 - Zeus 30 2 Tolvas | S133 | 3AAMBACE7TMMJA042 | **(vacía)** | Dosificadora ZEUS 30 con 2 tolvas móvil suspensión de aire, frenos | 189 | 185 | 189 | 0 / 0 | J15 "Son 16 m" (en `Cable 3X10 uso rudo`) |
| S134 - Thor 36 | S134 | 3AAMBACE9TMMJA043 | **(vacía)** | Silo móvil THOR 36 con pesaje, colector, válvula, suspensión y frenos | 171 | 167 | **0** | 0 / 0 | — (`Tapon macho 1/2` aparece dos veces, una con cantidad vacía) |
| P 797 Banda artesa 20x3.5 | **S134** (copiado) | **3AAMBACE9TMMJA043** (copiado) | (vacía) | Banda transportadora tipo artesa de 20" x 3.5 metros | 41 | 41 | 41 | 0 / 0 | — |
| P 797 Banda artesa 20x5 | **S134** (copiado) | **3AAMBACE9TMMJA043** (copiado) | (vacía) | Banda transportadora tipo artesa de 20" x 5.0 metros | 41 | 41 | **0** | 0 / 0 | — |

Lo que se lee de la tabla:

- **Todas las pestañas están vivas** (entregas de sep a dic 2026). Ninguna tiene marcado `¿ESPECIAL?` (K2). En ninguna se dispara la alerta (I2 vacío), porque `Faltante` siempre sale vacío.
- **En qué paso va cada pedido** (solo se deduce de D y F):
  - Validación técnica a medias: P.791.
  - Técnica terminada y almacén pendiente: P.793 Elevador, S134 Thor 36, P 797 20x5.
  - Las dos completas: el resto.
- **Los pedidos con prefijo "S"** (S131 a S134) siguen otra numeración que los "P." (786 a 797). No hay nada en la hoja que diga qué significa "S". **Por confirmar con el dueño.** En el inventario las salidas se etiquetan igual: "S133", "S131, S132,S134 P793".
- **Equipos "provisionales" o hechos a medida** ("PROVISIONAL TREN DE 4 TOLVAS", "Mezcladora Andres", "Teremana Helicoidal") aparecen como si fueran equipos del catálogo del costeo. Así resuelven lo "especial"; la casilla `¿ESPECIAL?` no se usa.
- **Cada pestaña pesa 24,262 filas × 11 columnas** con casillas precargadas (22 pestañas ≈ 534 mil filas), aunque la más larga usa 193.

---

## 2. Columnas (plantilla `MACHOTE`, igual en las 22 pestañas)

### 2.1 Encabezado (filas 1 a 3)

| Celda | Etiqueta | Tipo | Ejemplo real | Significado | Manual o fórmula |
|---|---|---|---|---|---|
| A1 | "Número de Pedido:" | texto | | etiqueta | fija (en P.786.1 la cambiaron a "-") |
| B1 (B1:C1 combinadas) | — | número o texto | `786`, `S131` | número de pedido de venta (o "S…") | **manual** |
| D1 (D1:E1) | "Número de Serie:" | texto | | etiqueta | fija |
| F1 (F1:H1) | — | texto | `BH1012000N345`, `3AAMBACE7TMMJA042`, `S/N`, `SIN` | número de serie del equipo (de placa o VIN) | **manual** |
| I1 | "Fecha de entrega:" | texto | | etiqueta | fija |
| J1 | — | fecha `dd/mm/yy` | `23/09/26` (serial 46288) | fecha comprometida de entrega | **manual** (vacía en 5 pestañas) |
| K1 | "¿ESPECIAL?" | texto | | etiqueta | fija |
| K2 | — | casilla | FALSE en todas | marca de equipo especial | manual; **ninguna fórmula ni regla la usa** |
| A2 | "Equipo:" | texto | | etiqueta | fija |
| B2 (B2:H2) | — | texto con validación `ONE_OF_RANGE =NombreEquipos`, strict, tipo chip | "Transportador helicoidal tipo bazuca de 10" x 12 S/C S/M" | equipo a fabricar (título del catálogo `EQUIPOS!B`) | **manual, de la lista desplegable** |
| I2 (I2:J2) | — | texto | "¡ALERTA!" o "" | alerta de faltantes a menos de 10 días | **fórmula** |
| B3 (B3:H3) | "Validación" | texto | | título de la sección | fija |
| I3 (I3:J3) | — | texto | "Componentes faltantes a menos de 10 días de la entrega ⚠️" | mensaje de la alerta | **fórmula** |

### 2.2 Detalle (encabezados en la fila 4, datos desde la fila 5)

| Col | Encabezado | Tipo | Ejemplo (P.786 fila 6) | Significado | Manual o fórmula |
|---|---|---|---|---|---|
| A | Componente | texto | `Chumacera 2" 4B pared UCF 211-32` | material, mano de obra o servicio de la lista | **fórmula** (QUERY que se derrama desde A5) |
| B | Cantidad necesaria | número | `2.00` | cantidad por **1** equipo | **fórmula** (QUERY que se derrama desde B5 a B:C) |
| C | Unidad | texto | `pieza` | unidad tal como está en el costeo | fórmula (derrame de B5) |
| D | Miguel/Abel | casilla | TRUE | validación técnica del renglón | **manual** |
| E | Stock Disp | número o " " | `" "` (hoy, en todas) | existencia total en el inventario | **fórmula** VLOOKUP |
| F | Enc. Almacén | casilla | TRUE | almacén revisó la existencia física | **manual** |
| G | Faltante | número o "" | `""` (hoy, en todas) | max(0, necesaria − stock) | **fórmula** |
| H | COMPRADO | casilla | FALSE | compras ya pidió el faltante | **manual** (nunca usada en 2S) |
| I | INGRESADO | casilla | FALSE | material empaquetado y con salida en inventario (según la nota de I4) | **manual** (nunca usada en 2S) |
| J | NOTAS | texto | "DEBE SER 4X3" | correcciones, extras e instrucciones | **manual**, sin estructura |
| K | — | — | — | (solo se usa K1:K2) | — |

**Tipos de renglón que vienen en la explosión** (todos salen del costeo; la hoja no los distingue):

- Material de almacén: tornillería, acero, eléctrico.
- Consumibles: `Thinner Americano`, `Estopa`, `Carga de CO2`.
- **Mano de obra:** `Horas hombre detallado`, `pailería`, `Pintor` y `tornero`, en horas.
- **Servicios:**
  - `Pulgada de corte CNC…`, en pulgadas.
  - `Servicio de vulcanizado de banda en Planta Atotonilco`.
  - `Permisos`.
  - `Montaje llantas camión`.

Por regla general las HH se dejan sin marcar en D y F, pero no siempre. En S131 V3, P 797 3.5, P.790 y P.796 sí se marcaron algunas o todas.

---

## 3. Proceso y reglas

### 3.1 Fórmulas, citadas literalmente

**Explosión de materiales** (solo en A5 y B5; el resto se derrama):
```
A5  =query(EspejoBaseEquipos!A2:G,CONCATENATE("select C WHERE B ='",B2,"'"),0)
B5  =query(EspejoBaseEquipos!A2:G,CONCATENATE("select D, E WHERE B ='",B2,"'"),0)
```
- Une por **nombre del equipo** (`B = 'texto de B2'`), no por ID.
- Son **dos consultas separadas**. A y B/C cuadran solo porque las dos leen las mismas filas en el mismo orden.
- La cantidad es **por un equipo**. No existe un campo de "cuántos equipos".

**Existencia** (copiada fila por fila hasta la 24,262):
```
E5  =IFERROR(VLOOKUP(A5,ListaAlmacen!A$2:C,2,0)," ")
```
- Une por **nombre exacto del material** contra `Inventario!B`. Si no lo encuentra, o si `ListaAlmacen` está rota, devuelve un **espacio**.
- Trae la columna 2 de `ListaAlmacen` = `Inventario!E` "STOCK ACTUAL TOTAL DISP", que en el inventario se calcula así:
  `Inventario!E8 =IF(B8="","",(G8+I8+K8+M8+O8+Q8))`, la suma de los almacenes 1-PA, 2-PB, 3-M, 4-C1, 5-C2 y " R" (Revolución).
  **No incluye** `6 - ML` (S) ni `7 - R` = RESERVADO (U).
- Es existencia **física actual y viva**. No descuenta lo que necesitan otros pedidos ni guarda una foto del momento de la validación.

**Faltante:**
```
G5  =IFERROR(IF(B5-E5<0,0,B5-E5),"")
```
Cuando E es `" "`, `B5-" "` da error y G queda en `""`. **Un material que no se encuentra no cuenta como faltante; cuenta como "sin dato" y nadie se entera.**

**Alerta:**
```
I2  =IF(AND(
       MINUS($J$1, HOY!$B$1) < 10,
       COUNTIFS(G5:G, ">0", H5:H, FALSE) + COUNTIFS(G5:G, ">0", I5:I, FALSE) > 0
    ), "¡ALERTA!", "")
I3  =IF(I2<>"","Componentes faltantes a menos de 10 días de la entrega ⚠️","")
HOY!B1  =TODAY()
```
- El umbral de 10 días está **fijo en la fórmula**.
- Cuenta los faltantes que no se han comprado **más** los que no se han "ingresado" (un mismo renglón puede contar dos veces, pero solo importa que sea > 0).
- Si J1 está vacía, `MINUS(0, hoy)` da negativo, y negativo < 10 es verdadero. **Sin fecha de entrega, la alerta salta en cuanto aparezca cualquier faltante.** Hoy no pasa en S132, S133, S134 ni en las P 797 solo porque el stock está roto.

### 3.2 Formato condicional (rango `G5:G24262` y `I5:I24262` del MACHOTE, copiado en cada pestaña)

| Rango | Regla | Formato | Lectura |
|---|---|---|---|
| G5:G24262 | `=AND(AND(G5>0,G5<>""),H5=FALSE)` | fondo rojo | hay faltante y compras no lo ha pedido |
| I5:I24262 | `=AND(AND(G5>0,H5=TRUE),I5=FALSE)` | fondo rojo | ya se compró pero falta "ingresar" (o dar salida) |
| I2:J3 | `NOT_BLANK` (dos reglas) | fondo rojo | alerta visible |

Validaciones de datos: `B2` lista `=NombreEquipos` (strict, chip); `D5:D`, `F5:F`, `H5:H`, `I5:I` y `K2` son casillas `BOOLEAN`. `MACHOTE` no tiene rangos protegidos (en las pestañas de pedido no lo revisé).

### 3.3 Las reglas del proceso, escritas por ellos (notas de celda en la fila 4)

> **D4 "Miguel/Abel":** "Se corrobora que cantidades y materiales sean los correctos.
> Si hay un error modificarlo en el costeo.
> Se valida hasta que esté todo correcto. Una vez validado NO modificar hasta el siguiente pedido."

> **F4 "Enc. Almacén":** "Validar cuando se haya completado el siguiente paso:
> 1.-Se revisó la existencia del material físicamente.
> \*NO DAR SALIDA TODAVÍA\*"

> **H4 "COMPRADO":** "Validar cuando:
> Los faltantes son 0.
> Ó
> Cuando el faltante ya se pidió."

> **I4 "INGRESADO":** "Una vez que el Enc. Compras valide un componente del paso anterior, hacer lo siguiente:
> 1.-Se coloca material en paquete.
> 2. Se da salida en Inventario.
> Una vez hecho esto, se valida este paso."

Ojo: el encabezado dice "INGRESADO" y el formato condicional de I lo trata como "comprado pero no recibido". La nota lo define como **empaquetado y salida en inventario**, que es un **surtido a producción**. En el archivo de 2023 esas columnas se llamaban "Enc. Compras" y "Enc. Almacén".

### 3.4 El proceso reconstruido (quién, qué y en qué orden)

```
Pedido de venta (fuera de esta hoja)
   │  alguien copia MACHOTE (o una pestaña anterior) → "P. ### - <equipo corto>"
   ▼
[0] Captura de encabezado: B1 pedido · F1 serie · J1 fecha entrega · B2 equipo (lista del costeo)
   │  QUERY → explosión de la BOM del costeo (cantidades para 1 equipo; 1 pestaña por unidad)
   ▼
[1] Miguel/Abel (técnico)  – revisa renglón por renglón, marca D.
   │   · error en la lista → "modificarlo en el costeo" (en la práctica: nota en J)
   │   · sustitución puntual → D=FALSE + nota ("Será a 2 Fases Por esta ocasion")
   │   · HH y servicios normalmente quedan sin marcar
   ▼
[2] Enc. Almacén – revisa existencia FÍSICA, marca F. "NO DAR SALIDA TODAVÍA"
   │   (Stock Disp/Faltante deberían ayudar aquí; en 2S están en blanco)
   ▼
[3] Enc. Compras – por renglón con faltante: marca H cuando faltante=0 o ya se pidió
   │   (no genera requisición; la OC vive en otro archivo de compras)   → NUNCA marcado en 2S
   ▼
[4] Almacén – empaqueta el material del renglón y "da salida en Inventario", marca I
   │   (la salida se captura a mano en Inventario›Registro con "P786", "S133"…) → NUNCA marcado en 2S
   ▼
[Alerta] si faltan <10 días y hay faltantes no comprados/no "ingresados" → ¡ALERTA! en I2:J3
```

No hay un estatus de pedido, ni fecha o usuario de cada paso, ni un cierre. Cuando pasa la entrega, la pestaña se queda tal cual (P.790, P.788 y P.786 tienen entregas vencidas y siguen igual). El archivo se corta por semestre (1S y 2S).

### 3.5 Lo que el mecanismo hace cuando funciona (P.784 del archivo 1S, mismo equipo que el P.793)

`2026 - 1S › P.784 - Zar 4T`, "Cribadora Zar 4T con turbina", entrega 12/10/26. I2 = **"¡ALERTA!"**, I3 = "Componentes faltantes a menos de 10 días de la entrega ⚠️".

| Componente | Necesaria | Stock Disp | Faltante | COMPRADO | INGRESADO | Nota |
|---|---|---|---|---|---|---|
| Disco laminado 4 1/2" G120 | 2 | 0 | 2.00 | FALSE | FALSE | |
| Lamina perforada cal. 14 de 5mm 1x2 | 1 | 0 | 1.00 | FALSE | FALSE | |
| Motor 2HP 3F 4 Polos Weg | 1 | 0 | 1.00 | FALSE | FALSE | |
| Rodaja giratoria de 8" color tinto… con freno | 4 | 0 | 4.00 | FALSE | FALSE | |
| Termica 20 amperes 3F | 1 | 0 | 1.00 | FALSE | FALSE | "Pastilla para riel din 3x16 Amp" |
| Tornillo 3/4 x 3" | 2 | 0 | 2.00 | FALSE | FALSE | |
| Variador p/2HP 220 volts CHZIRI … | 1 | 0 | 1.00 | FALSE | FALSE | "A 440 VOLTS por esta ocasion" |
| Rondana presion 5/16 | 10 | **" "** | **""** | FALSE | FALSE | no aparece con ese nombre en el inventario: **queda sin faltante sin que nadie lo note** |
| Tornillo 3/4 x 5" | 8 | **" "** | **""** | FALSE | FALSE | ídem |

Aun con la alerta encendida, **nadie marcó COMPRADO ni INGRESADO**. Los Stock Disp de esa tabla son los de hoy, no los del día en que se validó.

### 3.6 Caso real de punta a punta: pedido 786 (dos bazucas 10" x 12 S/C S/M)

1. **Alta.** Hay dos pestañas, una por unidad: `P. 786 - …` (serie BH1012000N345) y `P. 786.1 - …` (BH1012000N346). Las dos llevan B1 = 786 y J1 = 23/09/26. B2 = "Transportador helicoidal tipo bazuca de 10" x 12 S/C S/M" se escogió de la lista desplegable.
2. **Explosión.** El QUERY trae 26 renglones de `BASE EQUIPOS`: 22 materiales y 4 de horas hombre (detallado 6, pailería 150, Pintor 14, tornero 4). Algunos ejemplos: `Chumacera 2" 4B pared UCF 211-32` 2 pieza; `Tubo 2" ced. 40` 12 metro; `Lamina calibre 10 4X10` 4.5 pieza; `Varilla roscada 1"` 70 cm; `Tornillo 5/8 X 3"` 4 pieza; `Tuerca 3/8"` 10 pieza.
3. **Paso 1 (Miguel/Abel).** D=TRUE en los 22 materiales y FALSE en las 4 HH. En la 786.1, `Varilla roscada 1"` quedó con D=FALSE y F=TRUE, sin nota que lo explique.
4. **Paso 2 (almacén).** F=TRUE en los mismos 22.
5. **Existencia y faltante.** E = `" "` y G = `""` en los 26 renglones, porque `ListaAlmacen` está rota. Así se vería si el enlace funcionara, con el inventario de hoy (`Inventario!B:E`):
   - `Chumacera 2" 4B pared UCF 211-32`: stock 10. Necesita 2 por pestaña, faltante 0 en cada una.
   - `Tubo 2" ced. 40`: stock 18. Necesita 12 por pestaña, **faltante 0 en cada una**. Pero 786 + 786.1 + S133 (4 m) suman **28 m contra 18 m**. Faltan 10 m y **ninguna pestaña lo vería**.
   - `Varilla roscada 1"`: stock 1,261.20 cm. Necesita 70 cm, faltante 0.
6. **Alerta.** `MINUS(23/09/26, 03/10/26)` = −10, menor que 10, así que la primera condición se cumple. COUNTIFS da 0, así que **no hay alerta**.
7. **Pasos 3 y 4.** H e I están en FALSE en los 26 renglones de las dos pestañas.
8. **Lo que sí pasó, según `Inventario › Registro`** (solo revisé la ventana de agosto a octubre de 2026). Las salidas con motivo "P786" fueron:
   - 3-sep-2026, a Leonardo Carranza: 8 de cada una de `Tuerca 3/4"`, `Tornillo 3/8 x 1"`, `Tuerca 3/8"`, `Rondana plana 3/8`, `Rondana de presion 3/8`, `Tornillo 1/2 x 2"`, `Tuerca 1/2"`, `Rondana plana 1/2` y `Rondana de presion 1/2`. **Ocho de esos nueve artículos no están en la lista del equipo**, que pide tornillería de 3/8 x 2" y de 5/8.
   - 10-sep-2026: `Chumacera 2" 4B pared UCF 211-32` **3** piezas (la lista de dos unidades pide 4). También `vidrio sombra 11`, `Cristal transparente`, `Kilo de soldadura 6013` (la lista trae `Micro alambre 0.35`), `disco laminado 4 1/2" G80` (la lista trae `disco laminado 7" G120`), `Disco corte 4 1/2"`, `Lente transparente antiempaño` y `Lija de esmeril 80`.
   - **Conclusión del caso:** la validación quedó "completa" en D y F. No hay registro de compra ni de surtido en la hoja. Lo que se entregó a producción se anotó en otro archivo, con texto libre, **y no coincide con la lista validada**.

**Otro caso en curso, P.793 Zar 4T:** 91 renglones, D en 81 de 91 y F en 87 de 91.
- J8: "Este Equipo es Bifasico, unicamente el motor de fierro vaciado solicitarlo a 2F, el otro motor si puede ser de 3F (Trifasico) ya que el variador es de 2F de entrada y dá una salida de 3F."
- `Motor 2HP 3F 4 Polos Weg Fierro Vaciado`: D=FALSE, nota "Será a 2 Fases Por esta ocasion".
- `Variador p/2HP 220 volts CHZIRI…`: D=FALSE, nota "sera bifasico por esta ocasion".
- La nota "sera 2 fases por esta ocasion" está **en el renglón de `Thinner Americano`**, que tiene D=FALSE, y "no hay variador vifasico" está en el de `Tornillo 1 x 6"`. Por el contenido, deberían ir un renglón más arriba (`Termica 20 amperes 3F`, que también tiene D=FALSE). O se escribieron fuera de lugar o la lista se movió debajo de las notas. En cualquier caso, la sustitución (motor, térmica y variador a 2F) **no queda como dato**: no hay "material sustituto", así que compras y almacén tienen que leer la nota.

---

## 4. Conexiones IMPORTRANGE

### 4.1 Entradas (dentro de este archivo)

| Celda destino | Archivo origen | Rango | Qué trae | Estado |
|---|---|---|---|---|
| `EspejoBaseEquipos!A1` | `1sFjjiLxpsiFf0zroiv4RSWb4a5zmvCacABNg2bf9y6E` (**Nuevo Costeo**) | `'BASE EQUIPOS'!A3:E` | ID, Nombre del equipo, Material, Cantidad, Unidad | OK |
| `NombreEquipos!A1` | ídem | `'EQUIPOS'!B2:B` | Título del Equipo (catálogo del cotizador) | OK |
| `ListaAlmacen!A1` | `1sOh_Gyj0ofi7aSYKdKmCJSyT_H6G1_wH18OlrybY2QE` (**2025 - Inventario 2.0- HEGAMEX**) | `Inventario!B7:B` | Nombre del artículo | **#REF! (sin autorizar)** |
| `ListaAlmacen!B1` | ídem (por URL con `#gid=2013039626`) | `Inventario!E7:E` | STOCK ACTUAL TOTAL DISP | **#REF!** |
| `ListaAlmacen!C1` | ídem (por URL) | `Inventario!C7:C` | Unidad | **#REF!** |

### 4.2 Salidas

- **No encontré ningún archivo que lea de éste.** Revisé las pestañas del inventario que podían tener que ver (`RESERVAS`, `Hojas Solicitudes Almacen`) y no tienen un IMPORTRANGE hacia `14xsHe…`. `RESERVAS` importa de `1yMB2r3K…` (compras), no de aquí. Puede haber consumidores que no vi.
- El enlace con el inventario **es manual y en sentido contrario**. El almacenista captura las salidas en `Inventario › Registro`: columna I "pedido/motivo" con texto libre ("P786", "S133", "P790, P791, P792", "S131, S132,S134 P793", "S133 PLANTA 2 TOLVAS C/SUSP") y columna H con el nombre de quien recibe.
- **Las reservas por pedido** también son manuales, en el inventario: un "AJUSTE SALIDA" de un almacén y un "AJUSTE ENTRADA" al almacén `RESERVADO` con el motivo escrito. Por ejemplo, el 28-sep-2026: `Colector de polvos motorizado de 14 cartuchos marca DKT`, 1, AJUSTE ENTRADA, RESERVADO, Isaac, "P792". La hoja de validación no se entera.

---

## 5. Lo que hace mal o a mano (dolores que el ERP debe resolver)

| # | Dolor | Evidencia |
|---|---|---|
| 1 | **La validación de existencias está apagada en el archivo vigente** y nadie lo notó. El IFERROR convierte la falla en celdas en blanco. | `ListaAlmacen` da `#REF!` desde la creación (7-ago-2026). En las 22 pestañas, E = " " y G = "". En el 1S sí funciona. |
| 2 | **Sin reservas ni suma de la demanda.** Cada pestaña compara contra el stock total; pedidos y unidades compiten por el mismo material. | `Tubo 2" ced. 40`: 786 + 786.1 + S133 = 28 m contra 18 m en stock, y cada pestaña diría "0". Las reservas reales se hacen moviendo material al almacén RESERVADO con texto libre. |
| 3 | **Stock vivo, sin foto.** El faltante cambia cada vez que se mueve el inventario, incluso por la salida del mismo pedido. No queda historial de qué faltaba el día que se validó. | `E5` es un VLOOKUP en vivo y la columna "DISP" es física (Inventario!E). |
| 4 | **La lista viva queda debajo de marcas estáticas.** Cualquier cambio en el costeo mueve renglones y deja casillas y notas sobre otro material. Se "resuelve" prohibiendo editar el costeo. | Nota de D4: "Una vez validado NO modificar hasta el siguiente pedido". Notas del P.793 desfasadas un renglón. |
| 5 | **Las correcciones a la lista no regresan al costeo**, aunque la regla lo pide ("Si hay un error modificarlo en el costeo"). | P.791 (Zar 4T con alimentador): "Son de 14"" y "Son de 3"" sobre `Polea 16"` y `Polea 4"`; el costeo sigue mandando 16" y 4". P.793 Elevador: "DEBE SER 4X3" sobre `Cangilon 5x4`. |
| 6 | **Sustituciones y extras del pedido en texto libre.** No hay "material sustituto" ni "renglones adicionales del pedido"; `¿ESPECIAL?` no se usa. | "LLEVA UNA ENVASADORA ELECTRONICA A PRUEBA DE POLVOS EN ACERO AC", "LLEVA UN CABEZAL COSEDOR F900A", "LLEVA UN JUEGO EXTRA DE CRIBAS - REVISAR CON EL VENDEDOR", "Será a 2 Fases…", "A 440 VOLTS por esta ocasion". Equipos hechos a medida dados de alta como catálogo ("PROVISIONAL TREN DE 4 TOLVAS", "Mezcladora Andres"). |
| 7 | **No hay cantidad de equipos.** Se hace una pestaña por unidad, o el nombre de la pestaña dice "2" y la lista es de 1. | 786 y 786.1; "P. 796 - 2 Helicoidal armado…" con la lista de 1 helicoidal. |
| 8 | **Las pestañas se copian a mano** y arrastran errores de encabezado. | Las dos "P 797 Banda artesa" dicen pedido **S134** y la serie del Thor 36. En P.786.1 A1 dice "-". En P.791 hay dos series en una celda. Los nombres de pestaña no siguen un formato. 24,262 filas precargadas por pestaña. Un archivo por semestre. |
| 9 | **Todo se une por nombre de texto**: el equipo en el QUERY, el material en el VLOOKUP y el pedido en el inventario. Un espacio o una mayúscula distinta rompen la unión sin avisar; un apóstrofo en el nombre rompería el QUERY. | P.784 (1S): `Rondana presion 5/16` y `Tornillo 3/4 x 5"` dan stock " " y por tanto faltante "", sin alerta. El inventario tiene entradas duplicadas o variantes (`Chumacera 2" 2 B piso UCP 211-32` y `…J7 Marca Fag`). |
| 10 | **Material, mano de obra y servicios mezclados** en la misma lista, y el marcado de D/F es inconsistente para HH y servicios. | `Horas hombre…`, `Pulgada de corte CNC…`, `Servicio de vulcanizado…`, `Permisos`, `Montaje llantas camión`. |
| 11 | **Datos de la lista con errores que nadie detecta.** | `Cuadrado acero 1018 5/16" x 3.69 mts` **0.10 cm** (S133, S131 Bazuca). Duplicados: `Opresor Allen NC 3/8" X 1"` dos veces (P.788); `Tapon macho 1/2` dos veces, una sin cantidad (S134). Unidades mezcladas (`pieza`/`Pieza`/`pieza `). |
| 12 | **Compras y surtido no se registran aquí.** No se genera requisición, no hay vínculo con la OC y no hay vale de salida. | H e I en FALSE en el 100 % de los renglones de 2S, y también en P.784 (1S), que tenía 7 faltantes y alerta. |
| 13 | **Lo surtido no coincide con lo validado** y nadie lo compara. | P786: salieron 8 piezas de nueve tornillos, tuercas y rondanas de 3/8 y 1/2, y 8 de esos artículos no están en la lista; 3 chumaceras contra 4; soldadura 6013 contra micro alambre de la lista. |
| 14 | **No hay rastro de quién hizo qué ni cuándo.** "Miguel/Abel" es una sola columna para dos personas; una casilla no guarda usuario ni fecha. No hay estatus ni cierre del pedido. | Pestañas con entrega vencida (14/09, 18/09, 23/09) siguen abiertas, sin marca de "entregado". |
| 15 | **Errores en la lógica de la alerta**: salta siempre si no hay fecha, solo considera faltantes (no D/F pendientes), el umbral de 10 días está fijo y no avisa a nadie (hay que abrir la pestaña). | Fórmula de I2. J1 vacía en 5 pestañas. |
| 16 | **Notas en celdas sueltas**: un mensaje que ocupa tres renglones (J5:J7) se pega a materiales que no tienen nada que ver. | P.791, P.792 Tolva y Banda pedestal, P.793. |
| 17 | **"VENDIDO" en la nota de un material comprometido.** Sugiere que ese material se vendió a otro cliente. No hay reserva que lo impida. | S131 V3, `Angulo 1/4 x 1 1/2 x 6.10 mts`. El registro de inventario muestra ventas por ML de material de producción (p. ej. 24 `Cangilon 5x4` el 28-sep). **Interpretación; confirmar con el dueño.** |

---

## 6. Entidades propuestas para el ERP y mapeo

### 6.1 Modelo

La idea central: la orden de producción **congela** su propia explosión (una copia versionada de la lista de materiales). Sobre esa explosión trabajan las validaciones, las reservas, los faltantes, las requisiciones y los vales de salida, renglón por renglón y con usuario y fecha.

```sql
-- Referencias a módulos de otros informes: equipo, bom_linea (02-nuevo-costeo), componente,
-- almacen, existencia/movimiento_inventario (03-inventario), pedido_venta (ventas).

orden_produccion(
  id                 bigserial PK,
  folio              text UNIQUE,            -- 'OP-786-1' (generado)
  pedido_venta_id    → pedido_venta NULL,    -- B1 '786'
  pedido_folio_hoja  text,                   -- B1 tal cual ('786','S131') para la migración
  origen             text CHECK (origen IN ('pedido','stock','otro')), -- 'S###' por confirmar
  equipo_id          → equipo,               -- B2 resuelto por nombre → equipo.id
  cantidad           int NOT NULL DEFAULT 1, -- NO existe hoy (una pestaña por unidad)
  fecha_compromiso   date,                   -- J1
  es_especial        bool DEFAULT false,     -- K2
  bom_version_id     → bom_version,          -- foto de la lista usada
  estatus            text,                   -- borrador → validacion_tecnica → validacion_almacen
                                             -- → abastecimiento → surtida → cerrada / cancelada
  notas              text,                   -- notas de nivel pedido (hoy en J5:J7)
  creada_por, creada_en
)

op_unidad(            -- una fila por equipo físico (serie)
  id, orden_produccion_id → orden_produccion,
  numero_serie text UNIQUE NULL               -- F1 ('BH1012000N345', 'S/N' → NULL)
)

bom_version(          -- foto inmutable de BASE EQUIPOS para un equipo
  id, equipo_id → equipo, version int, congelada_en timestamptz, origen text
)

op_material(          -- = un renglón de la pestaña (explosión congelada)
  id                    bigserial PK,
  orden_produccion_id   → orden_produccion,
  renglon               int,                  -- orden
  bom_linea_id          → bom_linea NULL,     -- de dónde salió (NULL si se agregó a mano)
  componente_id         → componente,         -- A (resuelto a id, no a nombre)
  tipo                  text CHECK (tipo IN ('material','mano_obra','servicio','consumible')),
  cantidad_unitaria     numeric(14,4),        -- B (por equipo)
  cantidad_requerida    numeric(14,4),        -- B × orden_produccion.cantidad
  unidad_id             → unidad,             -- C
  sustituye_a_id        → op_material NULL,   -- sustituciones ("Será a 2 Fases")
  es_adicional          bool DEFAULT false,   -- extras del pedido ("LLEVA UNA ENVASADORA…")
  estatus               text,                 -- pendiente → validado_tecnico → verificado_almacen
                                              -- → reservado / faltante → comprado → recibido → surtido
  nota                  text                  -- J
)

op_material_validacion(  -- reemplaza las casillas D y F (con usuario y fecha)
  id, op_material_id → op_material,
  paso text CHECK (paso IN ('tecnica','almacen_fisico')),   -- D, F
  resultado text CHECK (resultado IN ('ok','corregir','sustituir','no_aplica')),
  usuario_id → usuario, fecha timestamptz, comentario text
)

reserva(
  id, op_material_id → op_material, componente_id, almacen_id → almacen,
  cantidad numeric, estatus text CHECK (estatus IN ('activa','consumida','liberada')),
  creada_en, creada_por
)
-- disponible_para_reservar = existencia física (todos los almacenes válidos) − reservas activas

faltante  -- VISTA, no tabla:
  -- por op_material: max(0, requerida − reservado − surtido)
  -- y agregado por componente: Σ requerida de OPs abiertas − disponible (lo que hoy nadie ve)

requisicion_compra(id, folio, origen text DEFAULT 'faltante_op', solicitada_por, fecha, estatus)
requisicion_renglon(
  id, requisicion_id, componente_id, cantidad, fecha_requerida,  -- = fecha_compromiso − tiempo de proceso
  op_material_id → op_material NULL,                              -- trazabilidad del faltante (H)
  orden_compra_renglon_id → orden_compra_renglon NULL            -- se llena cuando compras pide (H=TRUE)
)

vale_salida(id, folio, orden_produccion_id, almacen_id, entregado_por, recibido_por, fecha, estatus)
vale_salida_renglon(
  id, vale_salida_id, op_material_id → op_material NULL,  -- NULL = consumo no planeado (EPP, discos…)
  componente_id, cantidad, unidad_id
)  -- cada renglón genera un movimiento_inventario tipo SALIDA con referencia a la OP
   -- (reemplaza "I = INGRESADO" + la captura manual en Inventario›Registro con 'P786')

cambio_bom_solicitud(  -- correcciones que hoy mueren en notas ("Son de 14\"", "DEBE SER 4X3")
  id, equipo_id, bom_linea_id NULL, op_material_id, propuesta text,
  estatus text CHECK (estatus IN ('abierta','aplicada','rechazada')), solicitada_por, fecha
)

alerta_op  -- VISTA: OPs con fecha_compromiso − hoy < parametro('dias_alerta_faltante', 10)
           -- y faltantes sin requisición, o requisición sin recepción; o validaciones pendientes.
           -- Si fecha_compromiso IS NULL → "sin fecha", no alerta falsa.
```

### 6.2 Mapeo columna → campo (para el importador de las 22 pestañas, y de 1S y 2023 si se quiere historial)

| Hoja / celda | Campo en el ERP | Transformación y validación |
|---|---|---|
| Nombre de la pestaña | `orden_produccion.notas` (o solo para trazabilidad) | No es confiable (en P 797 el nombre y el encabezado no coinciden). Usar B1 y B2. |
| B1 | `pedido_folio_hoja`, `pedido_venta_id`, `origen` | `'786'` → pedido 786. `'S131'` → origen por confirmar. Si dos pestañas tienen el mismo B1 y el mismo B2, fusionarlas en una OP con `cantidad` = número de pestañas (786 y 786.1 → cantidad 2). |
| F1 | `op_unidad.numero_serie` | Partir por salto de línea (P.791 trae 2 series). `'S/N'`/`'SIN'` → NULL. Detectar series repetidas entre pestañas (P 797 = S134). |
| J1 | `orden_produccion.fecha_compromiso` | Serial de fecha → `date`; vacía → NULL. |
| K2 | `es_especial` | TRUE/FALSE (hoy siempre FALSE). |
| B2 | `equipo_id` | Unir con `equipo.nombre` (`EQUIPOS!B`) **con nombres normalizados** (trim, espacios dobles). Si no se encuentra, marcar para revisión. |
| (QUERY) | `bom_version_id` | Al importar, crear `bom_version` con la lista **tal como está hoy en la pestaña** (A:C), no la del costeo actual. |
| A (fila n) | `op_material.componente_id` | Unir con `componente.nombre` normalizado. Los que no se encuentren van a una cola de conciliación (caso `Rondana presion 5/16`). |
| A, por patrón | `op_material.tipo` | `^Horas hombre` → `mano_obra`. `^Servicio`, `Permisos`, `Montaje`, `Pulgada de corte` → `servicio`. El resto → `material`. |
| B | `cantidad_unitaria`, `cantidad_requerida` | Valor sin formato (`2,000.00` → 2000). Vacía → error de datos (S134 `Tapon macho 1/2`). |
| C | `unidad_id` | Normalizar (`Pieza`, `pieza `, `pieza` → pieza). Revisar `cm` contra la unidad del inventario. |
| D | `op_material_validacion(paso='tecnica', resultado=…)` | TRUE → `ok`. FALSE con nota → `sustituir` o `corregir`. FALSE en HH → `no_aplica`. Usuario: "Miguel/Abel" (no se puede saber cuál); fecha desconocida. |
| E | — (no se importa) | Derivado y hoy roto. El ERP lo calcula desde `existencia` y `reserva`. |
| F | `op_material_validacion(paso='almacen_fisico')` | TRUE → `ok`, sin usuario ni fecha. |
| G | — (vista `faltante`) | Derivado. |
| H | `requisicion_renglon` + `orden_compra_renglon_id` | Hoy siempre FALSE. Si se importan 1S/2023, TRUE → crear un renglón de requisición "histórico" sin OC. |
| I | `vale_salida_renglon` | Hoy siempre FALSE. El surtido real se reconstruye desde `Inventario›Registro` con `tipo='SALIDA'` y `I` (pedido/motivo) que contenga el folio ("P786", "S133"…). Cuando el motivo nombra varios pedidos ("P790, P791, P792") no hay forma de repartir; se deja ligado a todos o sin OP. |
| J | `op_material.nota` / `orden_produccion.notas` / `cambio_bom_solicitud` | Las notas de J5:J7 que siguen en J6 y J7 son **de la OP**: unirlas y pasarlas a `orden_produccion.notas`. Las de un solo renglón con forma de corrección ("Son de…", "DEBE SER…") → `cambio_bom_solicitud`. Las de sustitución ("por esta ocasion") → `sustituye_a_id` capturado a mano. |
| I2/I3 | — (vista `alerta_op`) | Derivado. |

### 6.3 Reglas de diseño que salen del análisis

1. **Unir siempre por ID**: equipo, componente y OP. Nunca por nombre. Los nombres se normalizan solo una vez, al migrar.
2. **Explosión congelada y versionada** al liberar la OP. Los cambios de BOM posteriores se aplican a la OP solo con una acción explícita ("re-explotar"), nunca de forma silenciosa.
3. **El disponible descuenta reservas**, y el faltante se calcula **agregado por componente** sobre todas las OP abiertas, además del faltante por OP.
4. **Si un material no se resuelve, eso es un faltante (o un error), nunca un vacío.** Un material desconocido bloquea la validación del renglón.
5. **El faltante genera la requisición en automático.** `COMPRADO` deja de ser una casilla y se vuelve un estado que viene de la OC; `INGRESADO` se vuelve la recepción de la OC.
6. **El vale de salida es el único camino para sacar material hacia una OP.** Mueve el inventario y salda la reserva. El consumo fuera de la lista (EPP, discos, soldadura distinta) queda como renglón "no planeado" y sirve para corregir el costeo.
7. **Validaciones con usuario y fecha**, separadas para Miguel y para Abel. Estatus por OP y cierre al entregar.
8. **Mano de obra y servicios** no pasan por almacén: se separan por `tipo` y alimentan el costo real o la programación, no la validación de material.
9. **La alerta es un parámetro**, sin el error de la fecha vacía, y avisa a alguien (notificación) en vez de esperar a que abran la pestaña.

---

## 7. Pendientes para confirmar con el dueño

- Qué significa el prefijo **"S"** (S131 a S134) frente a "P." en los pedidos. Las dos pestañas "P 797" llevan el encabezado del S134: ¿son parte del pedido S134 o del 797?
- Si **F (Enc. Almacén)** significa solo "revisé físicamente", como dice la nota, o si en la práctica también quiere decir "ya está apartado". Ejemplo: en S133 F=TRUE en `Gato cuello de ganso…`, pero los 6 gatos entraron y salieron a "S133" hasta el 1-oct-2026.
- Quiénes son **Miguel** y **Abel** en esta columna, y si alguien más valida.
- Si los consumibles y el EPP que salen con motivo "P786" deben cargarse a la OP (hoy no están en la lista).
- Si el archivo `RESTARUADO VALIDACION 2026` y la carpeta `HISTORIAL DE VALIDACIÓN DE EQUIPOS (PDF)` guardan otro paso del proceso, por ejemplo una "validación final" del equipo terminado (`FORMATO DE VALIDACION FINAL.pdf`).

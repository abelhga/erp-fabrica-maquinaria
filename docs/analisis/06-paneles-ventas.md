# 06 — Paneles de ventas por vendedor (Google Sheets)

Análisis **solo lectura** de las tres hojas "Panel Ventas" (Isaac Hernández, Juan Manuel Ramírez, Susana "Susy" Rizo), revisadas el 3 oct 2026.
Fuente: valores, fórmulas (`userEnteredValue`), validaciones (`dataValidation`), notas de celda, rangos con nombre y propiedades de pestaña.
No se transcriben datos personales de clientes: se dan formatos, conteos y referencias por **número de fila** para poder verificar.

| Hoja | ID | Pestañas (orden) |
|---|---|---|
| Panel Ventas Isaac Hernández | `1Db6Og9Qg1q3VpR5Wcad2qthq9ACpnSn2PZN4Kq11ll0` | Instrucciones · Registro de Clientes · Registro Ventas · **Configuración de Comisiones** · Listas (visible) |
| Panel Ventas Juan Manuel | `10CSFm-DZD4UCAHwmgTM-LeFSatBQGjo9JDxwispKLg4` | Registro de Clientes · Registro Ventas · Comisiones · Instrucciones · Listas (**oculta**) |
| Panel Ventas Susy | `1uAo5cuNSACBkPsuh8sle7j15V7WfPtDpMV5fTrojlgo` | Instrucciones · Registro de Clientes · Registro Ventas · Comisiones · Listas (**oculta**) |

Las tres son copias de una misma plantilla: los `sheetId` de cada pestaña son idénticos en los tres archivos (p. ej. Registro Ventas = 732539992), al igual que los rangos con nombre. Locale `es_MX`, zona `America/Mexico_City`. No hay `IMPORTRANGE` ni ninguna referencia entre archivos: cada hoja está aislada y no existe una consolidación entre ellas.

---

## 0. Números clave

| Hoja | Filas en Registro de Clientes | Filas en Registro Ventas | Primera venta | Última venta | Clientes únicos aprox. |
|---|---|---|---|---|---|
| Isaac | **171** (filas 2–172) | **292** (filas 2–293) | 22/05/2025 | 01/10/2026 | ≈168 (3 pares duplicados) |
| Juan Manuel | **137** (filas 2–138) | **213** (filas 2–214) | 16/05/2025 | 01/10/2026 | ≈134–136 |
| Susy | **52** (filas 2–53) | **71** (filas 2–72) | 10/02/2025 | 01/09/2026 | 52 (lista = clientes con venta) |
| **Total** | **360 filas** | **576 filas** | | | |

- Susy no tiene ninguna venta registrada entre el 19/11/2025 y el 04/03/2026, y su historial de comisiones 2026 empieza en marzo.
- Comprobación cruzada: los rangos que usan las fórmulas de comisión de septiembre 2026 (`D281:D292` en Isaac y `D199:D213` en Juan) coinciden exactamente con las filas fechadas en septiembre. Sus sumas también coinciden: Isaac, maquinaria $2,857,000 y refacciones $246,269.91; Juan, maquinaria $697,892 y refacciones $161,716.25.
- Las columnas Fecha y Monto son números de verdad: en Isaac se verificaron las 292 filas una por una; en Juan y Susy, una muestra. No hay fechas guardadas como texto. Hay un monto con 3 decimales (Juan, fila 210: 2811.433).
- **Los registros no tienen fórmulas.** Todo es captura manual. Las únicas fórmulas del libro están en la pestaña de comisiones.

---

## 1. Proceso descrito en "Instrucciones"

El texto es idéntico en las tres hojas y es literalmente todo lo que hay:

> **Pasos**
> Paso 1: Registrar al cliente en la pestaña "Registro de Clientes"
> Paso 2: Registrar la venta en la pestaña "Registro Ventas"
>
> Para adjuntar archivos de drive en una celda, solo hay que copiar y pegar el link del archivo en cuestión a la celda.
>
> NOTA: La hoja de cálculo de comisiones sigue en proceso. Pero por el momento ya se pueden hacer registros.

**Proceso real que se deduce de los datos:**

1. **Solo se registran ventas cerradas.** No existen prospectos, oportunidades, etapas, estatus de cotización ni ventas perdidas. Tampoco hay una lista desplegable de etapas o estatus en ninguna hoja. El "pipeline" no existe en el sistema actual.
2. El cliente se da de alta en una lista plana, y la venta se liga al cliente escribiendo su nombre a mano (no hay desplegable en Registro Ventas).
3. **Un supervisor revisa las hojas y deja observaciones** en Nota 1, y el vendedor contesta en Nota 2. Ejemplo en Juan, filas 3 y 6: Nota 1 *"Observación: Hay que pedir la información del cliente para la próxima; los datos son oro."* / Nota 2 *"Enterado"*; y *"Observación: Falta dar de alta al cliente con sus datos"* / *"Listo"*.
4. **La comisión se calcula una vez al mes y a mano.** Alguien edita los rangos de filas de las fórmulas `SUMIF` para que abarquen el mes (ver §4). Solo Susy lleva un historial mensual de comisiones con marca PAGADO/PENDIENTE.
5. **Cobro, forma de pago y situación fiscal se apuntan como texto libre en las notas** (ver §7). Ninguna columna los recoge de forma estructurada.
6. **Nadie usa la función de adjuntar archivos de Drive:** no se encontró ningún enlace en las tres hojas.

---

## 2. Columnas

### 2.1 Registro de Clientes (A–M; las columnas N–X están vacías)

| Col | Encabezado (literal) | Tipo / formato de celda | Ejemplo de formato real | Significado | Origen |
|---|---|---|---|---|---|
| A | `Nombre del Cliente / Empresa` | Texto. Validación `ONE_OF_RANGE =Clientes` estricta (ver §3) | "EMPRESA S.A. DE C.V.", "Nombre Apellido", "Persona EMPRESA", "EMPRESA-Persona" | Nombre del cliente. Hace las veces de llave que une ventas y clientes | Manual |
| B | `Contacto 1` | Texto. **En Isaac (filas 50–172) y en Juan (≈86–88) tiene un desplegable estricto con la lista de clientes, puesto por error** | "Nombre Apellido", "Ing. Nombre" | Persona de contacto principal | Manual |
| C | `Correo electrónico 1` | Texto | usuario@dominio.com | Correo del contacto 1 | Manual |
| D | `Celular 1` | Formato **TEXTO** | "3312345678", "33 1234 5678", "52 1 33…", "+52 55 …" | Teléfono del contacto 1 | Manual |
| E | `Contacto 2 (Opcional)` | Texto | — | Segundo contacto | Manual |
| F | `Correo electrónico 2 (Opcional)` | Texto | — | | Manual |
| G | `Celular 2 (Opcional)` | Formato TEXTO | — | | Manual |
| H | `ESTADO` (Juan y Susy) / **`Coahuila de Zaragoza`** (Isaac: el encabezado se sobrescribió) | Texto | "Jalisco", "jalisco", "CDMX", "Michoacán " | Entidad federativa | Manual |
| I | `CP` | Formato TEXTO (conserva ceros: "07830") | 5 dígitos | Código postal | Manual |
| J | `PAÍS` | Texto | "México", "Mexico", "El salvador" | País | Manual |
| K | `DOMICILIO (Opcional)` | Texto | "Calle X No.40" | Calle y número | Manual |
| L | `Municipio (Opcional)` | Texto | — | Municipio | Manual |
| M | `RFC (Opcional)` | Texto | — | RFC | Manual |

Qué tan llenas están (aproximado, contado sobre los valores):

| Campo | Isaac (171) | Juan (137) | Susy (52) |
|---|---|---|---|
| Contacto 1 | ≈23 (casi todos en las primeras ~45 filas) | ≈137 (casi todas) | 0 |
| Correo 1 válido | ≈3 | ≈11 (solo filas tempranas) | 0 |
| Celular 1 | ≈160 | ≈133 | 0 |
| Estado / CP / País | Estado ≈113 (2/3); CP y País en aprox. la mitad o un poco más | **1 / 1 / 1** (solo la fila 2) | 0 |
| Domicilio / Municipio | 0 / 0 | 1 / 1 | 0 |
| RFC | **0** | **0** | **0** |

No existe columna de "Fuente del cliente", a pesar de que la pestaña Listas tiene esa lista. Tampoco hay fecha de alta, vendedor asignado, giro, ni datos fiscales.

### 2.2 Registro Ventas (A–K; las columnas L–AC están vacías)

Fila 1 congelada y columnas A–C congeladas. Nota de celda en E1: **"Antes de iva"**.

| Col | Encabezado (literal) | Tipo / formato | Ejemplo de formato | Significado | Origen |
|---|---|---|---|---|---|
| A | `Fecha` | Fecha (número de serie). Isaac y Juan con patrón `d/M/yyyy`; Susy con `dd/mm/yyyy` | 22/5/2025 · 10/02/2025 | Fecha de la venta. **Es la fecha que decide en qué mes cuenta la comisión** | Manual |
| B | `Cliente` | Texto libre, **sin validación** | igual que la columna A de Clientes | Nombre del cliente, escrito a mano | Manual |
| C | `Concepto ` (con espacio al final) | Texto libre, a veces en varias líneas | "Cribadora V3", "Juego de grapas RS125 24\"", "Zeus 30 2 tolvas y silo thor 36", "… PEDIDO 768", "… SIN FACTURA" | Descripción de lo vendido (una o varias partidas en un solo texto) | Manual |
| D | `Tipo` | Texto, **sin validación**. Valores observados: solo los 3 de la lista | Maquinaria · Refacciones y/o Herramientas · Otros | Categoría. **Decide la comisión** (§4) | Manual |
| E | `Monto Bruto` (nota: "Antes de iva") | Moneda. Isaac y Juan con `"$"#,##0.00`; Susy con formato contable | $12,900.00 | Subtotal **sin IVA**: es la base de la comisión | Manual |
| F | `Fuente de la Venta` | Texto, sin validación | "Llamada por parte del cliente" | Origen de la venta | Manual |
| G | `# Cotización (si aplica)` (Isaac) / `Cotización (si aplica)` | Texto o número | Isaac "1566", "COT-56243924", "COT 166437371", "020-25", "C3989", "1716 y 1717"; Juan "JM176"; Susy "F 1434-25" | Folio de cotización | Manual |
| H | `Factura (si aplica)` | Texto | Isaac "A-2749", "N/A", "sin factura", "3149"; Susy "A 2632", "S/F" | Folio de factura, o "sin factura" | Manual |
| I | `N. Pedido (si aplica)` | Texto o número | Susy "661", "-"; Juan "679" (una sola vez) | Folio de pedido | Manual |
| J | `Nota 1` | Texto | "PAGADO", "pago en efectivo", "Observación: …", "* Pinto, Isaac, Susy", "OC M26-0200" | Notas libres: cobro, forma de pago, crédito compartido, OC, observaciones del supervisor | Manual |
| K | `Nota 2` | Texto | "Enterado", "Listo" | Respuesta del vendedor a la observación | Manual |

Uso real de las columnas opcionales:

| Campo | Isaac (292) | Juan (213) | Susy (71) |
|---|---|---|---|
| Fuente de la Venta | **18** (solo hasta el 17/06/2025) | ≈172 (≈80 %; casi vacío desde ago-2026) | **3** |
| Cotización | mayoría de las filas | **3** (JM176/JM208/JM262) | mayoría en 2025 ("F nnnn-aa"); en 2026 "-" |
| Factura | minoría (aprox. un tercio; serie "A-") | **0** | casi todas ("A nnnn" o "S/F") |
| N. Pedido | **0** | 1 (luego el pedido se escribe dentro de Concepto: "PEDIDO 758") | 2025: "nnn" o "-" |
| Nota 1 | ≈25 (forma de pago, descuentos, país, OC) | ≈8 (observaciones, "Boton de facebook") | 2025: "PAGADO" en todas; 2026: origen y crédito compartido |

**Una fila = una partida, no un pedido.** Una venta con varios productos se reparte en varias filas que comparten cotización, factura o pedido. Ejemplos: Isaac, filas 118–119 (misma cotización 3277 y factura A-2950, una fila "Refacciones" y otra "Otros"); Susy, filas 2–5 (4 filas con cotización F 1434-25 / factura A 2632 / pedido 661); Juan, filas 168–169 (PEDIDO 781, una fila Refacciones y otra Maquinaria).

---

## 3. Listas desplegables y sus opciones

### 3.1 Pestaña "Listas"

Fila 2 = encabezados; opciones desde la fila 3.

| Tipo (rango con nombre `Tipo` = `Listas!A3:A13`) | Fuente del Cliente (rango con nombre `Fuente` = `Listas!B3:B20`) | Fuente de la Venta (sin rango con nombre, col. C) |
|---|---|---|
| Maquinaria | Correo del vendedor no solicitado | Visita de ruta |
| Refacciones y/o Herramientas | Correo por parte del cliente | Llamada por parte del cliente |
| Otros | Formulario de Facebook | Correo por parte del cliente |
| | Formulario del sitio web | Visita por parte del cliente |
| | Llamada del vendedor no solicitada | Formulario del sitio web |
| | Llamada por parte del cliente | Formulario de Facebook |
| | Otro (Especificar en Notas) | Otro formulario |
| | Otro formulario | Llamada del vendedor no solicitada |
| | Visita de ruta | Correo del vendedor no solicitado |
| | Visita por parte del cliente | Otro (Especificar en Notas) |
| | **Ya había comprado** (solo Isaac) | **Ya había comprado** (solo Isaac) |

- Juan y Susy tienen 10 opciones de fuente; Isaac tiene 11 (agregó "Ya había comprado" en las dos listas).
- **No hay listas de etapa, estatus, probabilidad, motivo de pérdida, forma de pago, estatus de cobro ni línea de producto más fina que "Tipo".**
- Valor encontrado en los datos que no está en ninguna lista: **"Nuevo"** (Isaac, Registro Ventas fila 17, en Fuente de la Venta). Juan usó además "Boton de facebook" y Susy "Whatsapp por parte del cliente" y "Pregunta de ML", ambos como "Otro (Especificar en Notas)". Son canales que faltan en la lista: **WhatsApp, Mercado Libre y el botón de Facebook**.

### 3.2 Validaciones de datos que existen de verdad

| Dónde | Regla | Efecto real |
|---|---|---|
| Registro de Clientes!A (todas las filas con datos de las 3 hojas) | `ONE_OF_RANGE =Clientes`, estricta, con flecha | `Clientes` es justamente `'Registro de Clientes'!A2:A1000` (A2:A999 en Juan, A2:A1004 en Susy): la columna se valida contra sí misma, así que no restringe nada. Parece que estaba pensada para `Registro Ventas!B` y se puso en la pestaña equivocada |
| Registro de Clientes!B, **Isaac filas 50–172**; Juan filas ≈86–88 | `ONE_OF_RANGE =Clientes`, estricta | **Rechaza cualquier nombre de contacto que no sea un nombre de cliente.** En Isaac coincide con el momento en que dejan de capturarse contactos (fila ~50): a partir de ahí el contacto aparece pegado al nombre ("EMPRESA-Persona") o metido en la columna de correo |
| Configuración de Comisiones / Comisiones!B10 (las 3 hojas) | `ONE_OF_RANGE =#REF!` | Validación rota que sobró de alguna edición |
| Juan, Registro Ventas!C (2 celdas sueltas) | `ONE_OF_RANGE =#REF!` | Rota |
| **Registro Ventas!B, D y F** (las 3 hojas) | **Ninguna** | Cliente, Tipo y Fuente se escriben a mano. Las listas de §3.1 no se usan como desplegable en ningún lado |

Rangos con nombre (iguales en las tres): `Clientes`, `Fuente`, `Tipo`. No hay formato condicional ni rangos protegidos.

---

## 4. Comisiones: reglas y fórmulas literales

### 4.1 Calculadora mensual (bloque superior, igual en las 3 hojas salvo lo que se indica)

| Celda | Etiqueta | Isaac | Juan | Susy |
|---|---|---|---|---|
| A1 / A2 | vendedor / mes | A1 "Isaac", A2 `46266` → "septiembre 2026" | A1 "septiembre 2026", A2 "Juan Manuel Ramírez" | A1 "julio 2026" (`46204`), A2 "Susana Rizo" |
| B4 | Sueldo base ("cantidad mensual inicial") | `16000` | `=2800*4.36` (= 12,208: semanal × 4.36) | `18800` ("Sueldo base mensual") |
| B5 | Porcentaje | `0.02` | `0.02` | `0.02` ("Porcentaje de comisión") |
| B7 | Venta total mensual maquinaria | `=SUMIF('Registro Ventas'!D281:D292, "<>Refacciones y/o Herramientas", 'Registro Ventas'!E281:E292)` | `=SUMIF('Registro Ventas'!D199:D213, "<>Refacciones y/o Herramientas", 'Registro Ventas'!E199:E213)` | `=SUMIF('Registro Ventas'!D69, "<>Refacciones y/o Herramientas", 'Registro Ventas'!E69)` |
| B8 | Ventas de refacciones ($) | `=SUMIF('Registro Ventas'!D281:D292, "=Refacciones y/o Herramientas", 'Registro Ventas'!E281:E292)` | mismo patrón, D199:D213 | mismo patrón, **solo D69** |
| B13 | Sueldo base | `16000` (constante, no `=B4`) | `=B4` | `=B4` |
| B14 | Comisiones eq | `=B7*B5` | `=B7*B5` | `=B7*B5` |
| B15 | META equipos | `=VLOOKUP(B7,F6:G11,2,TRUE)` | igual | igual (etiqueta: "META equipos (A partir de Agosto)") |
| B16 | Bonos refacciones | `=VLOOKUP(B8,E16:G22,3,TRUE)` | igual | igual |
| B17 | SUMA AL MES | `=SUM(B13:B16)` | igual | igual |
| A21 | % variable efectivo | `=(SUM(B14:B16))/(B7+B8)` | igual | igual |
| A22 | Comisión final variable incluido bonos | `=B14+B15+B16` | igual | igual |

Resultados visibles hoy: Isaac sept-2026 → comisión eq. $57,140 + meta $10,000 + bono refacciones $6,400 = **$73,540** variable (2.37 %). Juan → $13,957.84 + $2,500 + $6,400 = **$22,857.84** (2.66 %). Susy (julio, una sola fila) → $0.

*(El sueldo base es dato de nómina: en el ERP conviene restringirlo por rol.)*

### 4.2 Reglas que se desprenden de las fórmulas

1. **Comisión de equipos = 2 % del Monto Bruto (sin IVA) de todo lo que NO sea "Refacciones y/o Herramientas".** La condición es `"<>Refacciones y/o Herramientas"`, así que **"Otros"** (servicios, instalaciones, fletes, levantamientos, reparaciones) y cualquier celda vacía o mal escrita **cuentan como maquinaria** y suman tanto al 2 % como a la meta.
2. **Las refacciones no pagan porcentaje**, solo un bono fijo por escalón.
3. **META equipos**: un bono fijo según el escalón alcanzado por la venta mensual de maquinaria. Los escalones no se acumulan y el `VLOOKUP` es aproximado (`TRUE`).

   | Venta maquinaria del mes ≥ | Bono |
   |---|---|
   | $0 | $0 |
   | $500,000 | $2,500 |
   | $1,000,000 | $5,000 |
   | $2,000,000 | $10,000 |
   | $5,000,000 | $25,000 |
   | $10,000,000 | $50,000 |

   El bono equivale al 0.5 % del umbral. En Isaac y Juan hay además `I7:I11 = 2500` (constantes sin etiqueta y sin uso). En Susy, "A partir de Agosto" (2025).
4. **Bono de refacciones**: monto fijo por escalón de venta mensual de refacciones. La tabla es **distinta según el vendedor**:

   | Isaac y Juan (`E16:G20`) | Bono | Fórmula |
   |---|---|---|
   | $0 – $39,999 | $0 | `0` |
   | $40,000 – $79,999 | $1,600 | `=E17*0.04` |
   | $80,000 – $159,999 | $3,200 | `=E18*0.04` |
   | $160,000 – $319,999 | $6,400 | `=E19*0.04` |
   | `=E19*2` ($320,000) – "y más" | $12,800 | `=E20*0.04` |

   | Susy (`E16:G21`, constantes) | Bono |
   |---|---|
   | $0 – $69,999 | $0 |
   | $70,000 – $139,999 | $2,800 |
   | $140,000 – $189,999 | $5,600 |
   | $190,000 – $249,999 | $7,600 |
   | $250,000 – $339,999 | $10,000 |
   | $340,000 – "y más" | $13,600 |

   En las dos tablas el bono es el 4 % del límite inferior del escalón. Solo cambian los umbrales.
5. **Bonos de Mercado Libre (solo Susy, `I14:K20`)**, escritos en la hoja pero **sin conectar a ninguna fórmula**: Cuenta en Verde $800 · MercadoLider $800 · MercadoLider Gold $1,600 · MercadoLider Platino $5,600 · Tiempo de respuesta < 2h $500 · Tiempo de respuesta < 1h $1,000.
6. **Ingreso mensual = sueldo base + comisión eq + meta + bono refacciones** (`SUMA AL MES`).

### 4.3 ¿Se paga al facturar o al cobrar?

**No está escrito en ningún lado**, y la propia hoja de Instrucciones dice que las comisiones "siguen en proceso". Lo que muestran los datos:

- La comisión se calcula por **mes calendario según la `Fecha` de la venta** y sobre **Monto Bruto antes de IVA**. Ninguna fórmula mira la factura ni el cobro.
- Se registran ventas que todavía no están cobradas o que solo tienen anticipo: Isaac fila 100, "Aún no pagan"; fila 270, "dio 10 mil de anticipo en efectivo". También ventas **sin factura** (§7). Todas entran igual al cálculo.
- El historial de Susy (abajo) marca la comisión como **PAGADO / PENDIENTE** y la forma de pago ("Transferencia"). Las de mayo y junio 2026 siguen **PENDIENTE** meses después. No se puede saber si esperan el cobro al cliente o si solo es atraso.
- En la práctica, la comisión **se devenga al registrar la venta**. Antes de modelarlo, hay que confirmar con dirección la regla que se quiere (venta, factura o cobro, o un esquema proporcional al cobro).

### 4.4 Historial de comisiones (solo Susy, desde la fila 28)

Las tablas por año tienen las columnas `Mes | Equipos | Refacciones | Porcentaje | Comisión (=B*D) | [Meta equipos] | Bono refacciones | Total | PAGADO/PENDIENTE | Transferencia`.

- 2025, primera tabla (Feb–Jul; sin meta): Febrero $580,244.83 → $11,604.90; Abril $97,000 + $77,910 → $1,940 + $2,800 = $4,740; Julio $87,408.83 refacciones → $2,800. Subtotal `=SUM(G29:G34)` = $19,144.90. Todo PAGADO.
- 2025, segunda tabla (Ago–Nov; con meta): Octubre $1,107,697 → $22,153.94 + meta $5,000 + bono $2,800 = $29,953.94; Noviembre $226,000 / $224,068.99 → $4,520 + $7,600 = $12,120. Subtotal `=SUM(H38:H41)` = $45,186.18. PAGADO, por transferencia.
- 2026 (Mar–Sep): Mayo $1,371,580 al **1 %** → $13,715.80, meta $2,500, **Total $18,715.80 escrito a mano**; Junio $850,000 → $17,000 + $2,500 = $19,500. Ambos **PENDIENTE**. Subtotal `=SUM(H46:H49)` = $38,215.80.
- Todas las cifras de Equipos y Refacciones del historial **coinciden con Registro Ventas** al sumar por mes (comprobado mes a mes), con dos excepciones: agosto y septiembre 2025 tienen refacciones registradas pero el historial pone $0 (estaban por debajo del umbral, así que el bono no cambia).
- La venta de mayo 2026 al 1 % lleva en Nota 1 "**\* Pinto, Isaac, Susy**" (filas 64 y 72 de Registro Ventas). Indica que **hubo crédito compartido y se repartió la comisión**. Esa venta solo aparece en la hoja de Susy.

---

## 5. Diferencias entre vendedores

| Aspecto | Isaac | Juan Manuel | Susy |
|---|---|---|---|
| Nombre de la pestaña de comisiones | "Configuración de Comisiones" | "Comisiones" | "Comisiones" |
| Listas | visible; con "Ya había comprado" | oculta | oculta |
| Encabezado H de Clientes | "Coahuila de Zaragoza" (dañado) | ESTADO | ESTADO |
| Encabezado G de Ventas | "# Cotización (si aplica)" | "Cotización (si aplica)" | igual que Juan |
| Captura de clientes | nombre + celular + estado; contacto solo al inicio (bloqueado por la validación) | nombre + contacto + celular; **sin ubicación** | **solo nombre** |
| Uso de Fuente de la Venta | casi nulo (6 %) | alto (≈80 %) | casi nulo |
| Folio de cotización | numérico interno / "COT-…" | "JM###" (luego ya no) | "F nnnn-aa" |
| Folio de factura | "A-nnnn" | no lo captura | "A nnnn" / "S/F" |
| Pedido | no | dentro de Concepto ("PEDIDO 7xx") | columna I |
| Estatus de cobro | en notas, a veces | no | "PAGADO" en Nota 1 (2025) |
| Formato de fecha | d/M/yyyy | d/M/yyyy | dd/mm/yyyy |
| Sueldo base | $16,000 fijo (B13 constante) | 2,800 × 4.36 | $18,800 |
| Tabla bono refacciones | 40k/80k/160k/320k | igual que Isaac | **70k/140k/190k/250k/340k** |
| Bonos Mercado Libre | no | no | sí (sin conectar) |
| Historial de comisiones | no | no | sí (2025–2026) |
| Mes que muestra la calculadora | sep-2026, al día | sep-2026, al día | **jul-2026, desactualizada y apuntando a 1 sola fila (D69)** |
| Perfil de ventas | mezcla: plantas grandes, servicios, refacciones | mezcla, mucho por teléfono y Facebook | casi todo refacciones; Mercado Libre y mostrador |

---

## 6. Modelo propuesto y mapeo para el importador

### 6.1 Entidades (Postgres/Supabase)

| Entidad | Campos clave | De dónde viene |
|---|---|---|
| `vendedor` (usuario) | id, nombre, email, `hoja_origen_id`, activo | una hoja = un vendedor |
| `cliente` (cuenta) | id, nombre_comercial, razon_social, rfc, tipo_persona, estado (catálogo INEGI), municipio, cp, pais (ISO), domicilio, `fuente_cliente_id`, `vendedor_asignado_id`, fecha_alta, nombre_original_hoja, es_generico (mostrador/público) | Registro de Clientes A, H–M |
| `contacto` | id, cliente_id, nombre, email, celular_e164, celular_original, puesto, es_principal | Registro de Clientes B–G, más los contactos que hay que separar del nombre en A |
| `oportunidad` (nueva) | id, cliente_id, contacto_id, vendedor_id, titulo, linea (maquinaria/refacciones/servicio), monto_estimado, **etapa** (prospecto → contactado → cotizado → negociación → ganada / perdida), probabilidad, fuente_venta_id, fecha_cierre_est, motivo_perdida | **No existe hoy.** Las ventas históricas se importan como oportunidades ganadas (opcional) |
| `cotizacion` | folio, fecha, oportunidad_id, monto | columna G (solo el folio) |
| `venta` (pedido) | id, cliente_id, fecha, folio_pedido, cotizacion_folio, fuente_venta_id, estatus (registrada/facturada/cobrada parcial/cobrada/cancelada), requiere_factura (bool), notas | Registro Ventas A, B, F, G, I, J, K agrupados |
| `venta_partida` | venta_id, concepto, **categoria** (Maquinaria / Refacciones y/o Herramientas / Servicio / Flete / Otros), producto_id (opcional), cantidad, importe_sin_iva | C, D, E (una fila = una partida) |
| `venta_vendedor` (crédito) | venta_id, vendedor_id, porcentaje | por defecto 100 % al dueño de la hoja; "* Pinto, Isaac, Susy" → reparto |
| `factura` | serie, folio, fecha, uuid_cfdi, venta_id, importe | H ("A-2749", "A 2632") |
| `pago` / cobranza | venta_id, fecha, importe, metodo (efectivo/transferencia/tarjeta/especie), tipo (anticipo/abono/liquidación), referencia, cuenta_destino | hoy solo está en notas |
| `plan_comision` | id, nombre, vigencia_desde/hasta, pct_maquinaria (0.02), categorias_base_pct, base_evento (venta/factura/cobro), incluye_otros (bool) | Comisiones B5 y la regla `<>Refacciones` |
| `plan_comision_tramo` | plan_id, tipo (meta_equipos / bono_refacciones), desde, hasta, bono | F6:G11, E16:G21 |
| `bono_adicional` | plan_id o vendedor_id, concepto (MercadoLider Gold, respuesta < 1h…), monto, periodo | Susy I14:K20 |
| `vendedor_plan` | vendedor_id, plan_id, sueldo_base, vigencia | B4 (sueldo distinto por vendedor; tabla de refacciones distinta en Susy) |
| `meta` | vendedor_id, periodo, tipo (maquinaria/refacciones), monto | hoy solo existen escalones, no metas individuales |
| `liquidacion_comision` | vendedor_id, periodo (YYYY-MM), venta_maq, venta_ref, pct_aplicado, comision, bono_meta, bono_ref, bonos_extra, total, estatus (calculada/aprobada/pagada/pendiente), fecha_pago, metodo_pago, ajuste_manual + motivo | historial de Susy (filas 28–53) |
| `comentario` | entidad, entidad_id, autor, texto, respuesta | las "Observación:" de Nota 1 / "Enterado" de Nota 2 |
| `adjunto` | entidad, entidad_id, url / storage_path | la instrucción de pegar ligas de Drive |
| Catálogos | `categoria_producto`, `fuente_cliente`, `fuente_venta` (+ WhatsApp, Mercado Libre, Botón Facebook, Mostrador) | pestaña Listas |

### 6.2 Mapeo columna → campo

**Registro de Clientes → `cliente` + `contacto`**

| Columna | Destino | Transformación |
|---|---|---|
| (archivo) | `cliente.vendedor_asignado_id` | dueño de la hoja |
| A | `cliente.nombre_comercial`; `nombre_original_hoja` | `trim`, quitar saltos de línea, comparar sin acentos ni mayúsculas. Si trae "EMPRESA-Persona", "Persona EMPRESA" o "Persona/Empresa", proponer la separación en contacto y revisarla a mano. Marcar como `es_generico` "VENTA MOSTRADOR", "publico en general", "Visita de cliente", "CLIENTE TEMPORAL" |
| B | `contacto.nombre` (principal) | si viene igual al nombre del cliente, es una persona física |
| C | `contacto.email` | validar que sea correo; si no lo es (un nombre), mandarlo a `contacto.nombre` |
| D | `contacto.celular_e164` + `celular_original` | quitar espacios y caracteres de control Unicode; agregar +52 cuando sean 10 dígitos; los extranjeros (502/503/1…) a revisión manual; si tiene menos de 10 dígitos o es texto ("VISITA DE CLIENTE"), marcar inválido |
| E, F, G | `contacto` secundario | igual que arriba |
| H | `cliente.estado` | mapear al catálogo de 32 entidades. Si el valor es una ciudad o municipio ("Fresnillo", "Lagos", "Atotonilco", "Ecatepec…", "CUAUTITLAN IZCALLI"), mandarlo a `municipio` e inferir el estado |
| I | `cliente.cp` | texto de 5 dígitos, `trim` |
| J | `cliente.pais` | normalizar ("Méxicoo", "mÉXICO", "Mexico" → MX; "El salvador" → SV; "Guatemala" → GT) |
| K, L, M | domicilio, municipio, rfc | casi vacíos; validar el RFC con expresión regular |

**Registro Ventas → `venta` + `venta_partida` (+ `factura`, `pago`, `venta_vendedor`)**

| Columna | Destino | Transformación |
|---|---|---|
| (archivo) | `venta_vendedor` (100 %) | dueño de la hoja |
| A | `venta.fecha` | ya son fechas |
| B | `venta.cliente_id` | emparejar con los clientes **de la misma hoja** por nombre normalizado; si no aparece, búsqueda difusa y luego cola de revisión |
| C | `venta_partida.concepto` | extraer `PEDIDO (\d+)` a `venta.folio_pedido` y `SIN FACTURA` a `requiere_factura=false` |
| D | `venta_partida.categoria` | conservar el valor original y, además, reclasificar "Otros" en servicio, flete o instalación |
| E | `venta_partida.importe_sin_iva` | redondear a 2 decimales |
| F | `venta.fuente_venta_id` | por catálogo; "Nuevo" y vacío → null |
| G | `cotizacion.folio` | "N/A", "-" y vacío → null. Normalizar "COT-", "COT ", "JM", "F nnnn-aa". Si dice "1716 y 1717", son varias |
| H | `factura` | `A[- ]?(\d+)` → serie A + folio. "S/F", "sin factura" → `requiere_factura=false`. "N/A" → null. "A-2937 Y A-2936" son varias. Un número suelto ("3149") va a revisión |
| I | `venta.folio_pedido` | "-" → null |
| J, K | `venta.notas` y además | "PAGADO" → estatus cobrado (sin fecha); "efectivo / transferencia / tarjeta / camioneta" → `pago.metodo`; "anticipo" → `pago.tipo`; "OC …" → orden de compra del cliente; "\* A, B, C" → `venta_vendedor` repartido; "Observación:" + K → `comentario` |
| Agrupación | `venta` | filas con el mismo cliente y la misma factura, cotización o pedido (y fecha cercana) → una venta con varias partidas |

**Comisiones → `vendedor_plan`, `plan_comision_tramo`, `bono_adicional`, `liquidacion_comision`**

- B4 → sueldo_base · B5 → pct_maquinaria · F6:G11 → tramos de meta · E16:G21 → tramos de refacciones (por vendedor) · I14:K20 (Susy) → bonos adicionales · tablas desde la fila 28 (Susy) → `liquidacion_comision` histórica con su estatus y método de pago.

---

## 7. Problemas de calidad

**Comisiones**

1. **Los rangos de las fórmulas se cambian a mano cada mes** (`D281:D292`, `D199:D213`, `D69`). No hay filtro por fecha. Es fácil equivocarse; la calculadora de Susy está desactualizada (julio, una sola fila) y su historial se llena a mano aparte.
2. **"Otros" y cualquier Tipo vacío o mal escrito pagan el 2 % como maquinaria** por la condición `<>`. Con eso, instalaciones, fletes, levantamientos o "Componentes y Servicios" (Susy fila 43, $1,004,447) generan comisión de equipos y meta.
3. **La clasificación de Tipo es inconsistente y mueve dinero.**
   - Productos parecidos caen en tipos distintos según quién captura: banda flexible o de gravedad (Maquinaria en Isaac; Refacciones en Juan, filas 110 y 177); compresor 300 L (Isaac fila 100 Refacciones, fila 145 Maquinaria); envasadora electrónica (Isaac fila 284, $121,630, Refacciones); generador de $175,172 como "Otros" (Juan fila 163).
   - Servicios marcados como Maquinaria: Isaac fila 140 ("instalación de equipos…", $512,400), fila 232 (instalación, $80,000), fila 270 (reparación), fila 104 (reparación de tanque); Juan fila 157 ("Modificación y adecuaciones").
   - Montos mínimos como Maquinaria: Isaac fila 50 ($780), fila 65 ($613.20), fila 219 ($8,342.86).
4. **Posibles ventas duplicadas que inflan la comisión** (hay que revisarlas):
   - Isaac filas 235 y 238: misma cotización 3681 y mismo monto, $550,285.71, en mayo y en junio 2026.
   - Isaac filas 39–40 (mismo producto y monto el mismo día); filas 179 y 181 ($2,090 en días consecutivos); filas 30 y 49 ($81,000).
   - Juan filas 62–63: dos plantas de $2,738,000 el mismo día, para dos clientes que comparten contacto y teléfono.
   - Susy filas 4–5: mismo producto, misma cotización y misma factura.
   - **Entre vendedores:** Susy fila 50 (19/11/2025) e Isaac fila 149 (04/12/2025): mismo cliente, mismo producto, $12,068.99 contra $12,068.98.
5. **Historial de Susy con errores:** mayo 2026, Total $18,715.80 tecleado, contra la suma de sus componentes, $16,215.80 (difieren $2,500). La meta anotada es $2,500, pero la tabla da $5,000 para $1,371,580. El 1 % por venta compartida no queda documentado en ninguna regla.
6. Isaac B13 tiene el sueldo como constante y no como `=B4`. A21 da `#DIV/0!` en un mes sin ventas. B10 tiene una validación hacia `#REF!`. Isaac y Juan tienen I7:I11 sin etiqueta. Los bonos de Mercado Libre no están conectados.
7. **Crédito compartido sin estructura:** "\* Pinto, Isaac, Susy" está en una nota y la venta solo aparece en la hoja de Susy.

**Clientes y llaves**

8. **No hay ID de cliente:** la unión se hace por nombre libre. Hay espacios al inicio o al final, saltos de línea dentro del texto, mayúsculas y minúsculas mezcladas, errores de dedo (p. ej. "CRUPO") y nombres genéricos ("publico en general", "VENTA MOSTRADOR", "Visita de cliente", "RODRIGO CLIENTE TEMPORAL", nombres de pila sueltos).
9. **Ventas cuyo cliente no está en el registro, o está escrito distinto:** Isaac 2 (filas 175, 257); Juan 3 (filas 68, 84, 166 contra los clientes "… La barca" y "LEONARDO LEON MEZA"); Susy 0.
10. **Duplicados dentro de una misma hoja:** Isaac, Clientes filas 42 y 44 (idénticos), 56 y 62 (con y sin acento, mismo celular), 105 y 136 (mismo celular). Juan, filas 12 y 105 (mayúsculas), 24 y 138 (mismo contacto y teléfono, distinta razón social), 43 y 46 (mismo contacto y teléfono).
11. **Clientes compartidos entre vendedores** (el CRM tendrá que resolver quién es dueño de la cuenta): Forrajera Atotonilco aparece en las 3 hojas; una persona física aparece en las 3 (Isaac y Juan con el mismo celular); Empacadora el Centenario (Isaac y Susy); Carbonatos y Estucos Premium del Sureste (Juan y Susy); Fertilizantes Tepeyac (Isaac y Susy, con distinta escritura); otra persona física en Juan y Susy. En Juan, la fila 53 lleva como contacto "CLIENTE SUSY".
12. **La validación mal puesta en Contacto 1 (Isaac, filas 50–172) impidió capturar contactos.** El dato terminó pegado al nombre o en la columna equivocada: Isaac fila 132 (nombre en la columna de correo, con tabulador), fila 135 (nombre en correo y correo en celular), fila 67 (correo en Correo 2).
13. **Teléfonos:** formatos mezclados (con y sin espacios, "52 1 …", "+52 …" con caracteres invisibles U+202A/U+202C), números de 8 o 9 dígitos, extranjeros sin prefijo claro, texto en lugar de número (Juan fila 91).
14. **Ubicación:** el estado se escribe libre (ciudades, municipios, "EDMEX", "ED de mexico", "OAXXACA", "Nueo León", "hIDALGO"), el país tiene variantes, Juan solo tiene ubicación en 1 de 137 clientes y Susy no tiene ningún dato fuera del nombre.
15. **RFC = 0 en las tres hojas, y casi no hay domicilios.** No alcanza para facturar desde el CRM.

**Ventas**

16. **Folios sin formato común:** las cotizaciones vienen en 7 o más formatos. La factura aparece como "A-2749", "A 2632", "3149" sin serie, "A-29355" (dedazo, Isaac fila 104) o varias en una celda. Los vacíos se marcan de muchas formas: "N/A", "-", "S/F", "sin factura" o vacío.
17. **Folios repetidos para clientes distintos:** Susy usa la factura A 2647 en las filas 6 y 9, y la cotización F 1460-25 en las filas 8 y 9.
18. **Datos estructurados escondidos en texto libre:** "SIN FACTURA" y "PEDIDO nnn" dentro de Concepto (Juan; la fila 208 dice "PEDIDO " sin número); OC, forma de pago, anticipos, descuentos ("se le dio un descuento del 10 %"), país, sobreprecio ("Le subí 3,000 pesos") y pago en especie (camioneta, Isaac filas 176 y 184) dentro de las notas.
19. **Situación fiscal sin campo propio:** ventas marcadas "sin factura" (Juan 5 filas; Isaac ≈4; Susy "S/F" en ≈8) y una con "transferencia a cuenta no fiscal" (Isaac fila 233). El ERP necesita un indicador explícito de facturación.
20. **Fuente de la venta casi vacía** en Isaac (18 de 292) y Susy (3 de 71). La "Fuente del cliente" tiene lista pero no tiene columna.
21. **El orden no es cronológico del todo** (Juan filas 185–186). Hay un monto con 3 decimales (Juan fila 210). Susy no registra nada de dic-2025 a feb-2026.
22. **Los conceptos tienen muchos errores de dedo** ("banfa", "Bnada", "Coseedora", "Crivadora", "acero al cabron") y no hay catálogo de productos. Para reportes por línea de producto hará falta un catálogo, o al menos una subcategoría (cribadora, banda, bazuca, planta/silo, cosedora, grapas, cangilones…).
23. **No se usan los adjuntos de Drive** que piden las instrucciones.

# 05 — Tablero de Indicadores y Base Unificada 2018-2021 (insumo para el ERP)

Revisión: 3 oct 2026, solo lectura (get_values / get_spreadsheet con fórmulas; no se escribió nada).

- **A**: "Tablero de Indicadores - HEGAMEX" `17Aa3rBjmjBoe6-oLE5Xp1twxP1rFtSs7yNQfq_4urP4`
- **B**: "2018-2021 BASE DE DATOS UNIFICADA HEGAMEX" `1TtNqWOn1ooYDTlUpeDY-7ukRqhCdMr5p82nB_OjoJUU`
- Descubiertos al seguir los IMPORTRANGE (no estaban en el encargo, solo se revisaron metadatos y encabezados):
  - **C**: "BASE DE DATOS ACTUAL HEGAMEX" `1bMPe8wRcFv66tap2k7qW6MOIDWDYMeng8Mii4ZwAdFs`: **la base viva de 2022 en adelante**.
  - **D**: "Caja Chica Milpillas" `1lHhdFXsA60l4KzL2_a2MsY2NEyRaCtfve4pBwPrqvlA`

Razón social que aparece en los encabezados: *Máquinas y Herramientas Gamex S.A. de C.V.* El banco fiscal es Santander, y en C se agrega Banorte.

---

## Resumen ejecutivo

1. **A es el dashboard vivo.** Tiene datos hasta el **30/09/2026**. Sus pestañas `DATA:` se llenan con IMPORTRANGE: los años **2018-2021 vienen de B** (rangos fijos) y **2022 en adelante vienen de C**. B quedó congelado: tiene datos hasta el 26/05/2023 y lo que trae de 2022 a mayo de 2023 es **copia** de C. Al importar hay que cortar B al 31/12/2021 para no duplicar.
2. El modelo de datos de las hojas es un **libro mayor de movimientos**. Cada renglón de VENTAS es un `Venta` (cargo) o un `Pago` (abono), y cada renglón de COMPRAS es un `Compra` o un `Pago`. Los saldos de clientes y proveedores (CxC y CxP) salen de Σ cargos − Σ abonos. **No hay tabla de facturas ni de pagos separadas.** La relación pago→factura se hace por texto (mismo folio, o el folio escrito en la descripción).
3. Los KPIs de ANALISIS son pocos y sencillos: **Ventas, Compras y Utilidad (Ventas − Compras) por mes y por año**, más el margen trimestral, cuatrimestral y semestral y un "punto de equilibrio". Esa "utilidad" **no es contable**: las compras incluyen nómina, IMSS, impuestos, retiros de socios, activos y capital de créditos, y los montos incluyen IVA.
4. En B hay un **estado de resultados administrativo** (pestaña CUENTAS) que agrupa **97 categorías de proveedor** en 11 grupos contables. También hay pronósticos de IVA e ISR. **La categoría es del proveedor, no de la compra.**
5. Hay errores que hoy distorsionan los números:
   - el IVA se calcula como 16 % del total, cuando el total ya incluye IVA;
   - la categoría de compras se importa solo hasta la fila 16000 de C, así que **desde noviembre de 2025 no hay categoría** y la exclusión de "Sin efectos" dejó de funcionar;
   - algunas compras traen vacío el `#año y #mes` y quedan fuera de los totales;
   - los totales de `Reporte` (B) no cuadran con ANALISIS porque los rangos de filas están desfasados.

---

## 1. Pestañas: propósito y si están vivas

### 1.1 Flujo de datos

```
C "BASE DE DATOS ACTUAL" ── VENTAS!B13:V ─────────────────┐
   (2022 → hoy)            COMPRAS!B15:J110000 ────────────┤
                           COMPRAS!N15:N110000 (#año y mes)┤
                           COMPRAS!U15:U16000 (categoría) ─┤
                                                           ▼
B "2018-2021 UNIFICADA" ── VENTAS!B12:V2178 ───────► A "DATA: VENTAS"  ─┐
   (congelado may-2023)    COMPRAS!B14:V10986 ─────► A "DATA: COMPRAS" ─┤
                                                                         ▼
                                                                 A "ANALISIS" (KPIs + gráficas)
D "Caja Chica Milpillas" ── Caja Chica Milp!A1:H ──► B "CCh Milp"
```

### 1.2 Archivo A: Tablero de Indicadores

| Pestaña | Tamaño | Propósito | Estado |
|---|---|---|---|
| **ANALISIS** | 3520×32 (se usan las filas 1-142 y 184) | Dashboard: totales anuales 2018-2025, tabla mensual ene-2018 a dic-2026 (Ventas, Compras, Utilidad, margen), márgenes trimestral, cuatrimestral y semestral, punto de equilibrio, 6 gráficas | **Viva** (datos a sep-2026; oct-2026 sale en $0 y `#DIV/0!`) |
| **DATA: VENTAS** | 7180×26 (se usan las filas 1-6593) | Concentrado de movimientos de venta. A1 = IMPORTRANGE de B (2018-2021) y A2168 = IMPORTRANGE de C (2022+) | **Viva** (último movimiento 30/09/2026). Tiene una gráfica rota, sin series |
| **DATA: COMPRAS** | 35447×26 (se usan las filas 1-30433) | Igual que la anterior, para compras. A1 = "NO EDITAR AQUÍ" y A2 = IMPORTRANGE de B; en la fila 10975 hay 3 IMPORTRANGE de C (A, M y T) | **Viva** (último movimiento ~23/09/2026) |
| Hoja 6 | 1000×26 | Borrador: ~90 pagos de proveedores de marzo de 2022 pegados como valores, con un total (F3 = SUM(F7:F96) = $956,575.87) | Muerta |
| Hoja 7 | 1000×26 | Borrador: listas de importes pegados (C1:C100, E1:E18, G1:G21) con sumas. ANALISIS!T184 = SUM('Hoja 7'!C1:C100) | Muerta / auxiliar |

### 1.3 Archivo B: Base Unificada 2018-2021

| Pestaña | Tamaño | Propósito | Estado |
|---|---|---|---|
| Pedidos (oculta) | 1000×25 | Lista de números de pedido (desde el 104) con su cliente. La columna Fecha está vacía | Muerta (lo sustituye la columna "N. Pedido" de VENTAS) |
| **VENTAS** | 3993×20 | Registro de ventas y cobros. Filas 1-11: ficha del cliente seleccionado (VLOOKUP al directorio), saldo, CxC total. Fila 12: encabezados. Datos en las filas 13-3252 (03/01/2018 → 26/05/2023) | Congelada. **Solo las filas 13-2178 (2018-2021) alimentan a A** |
| **Directorio Clientes** | 989×37 | Catálogo de clientes (~756, filas 4-759) con contacto, domicilio, RFC, saldo (BALANCE) y ventas históricas | Congelada (C tiene su propio directorio de 1298 filas) |
| **COMPRAS** | 18999×22 | Registro de compras y pagos. Filas 1-12: ficha del proveedor y CxP. Fila 14: encabezados. Datos en las filas 15-~16190 (01/01/2018 → 26/05/2023) | Congelada. **Solo las filas 15-10986 alimentan a A** |
| **Directorio Proveedores** | 983×30 | Catálogo de proveedores (~588, filas 3-~590) con **categoría ("Tipo de Proveedor")**, días de crédito, saldo y compras por año | Congelada |
| Hoja 19 | 1000×26 | Columna de importes pegados | Muerta |
| **Vencimiento de Facturas** | 1364×26 | **Tabla dinámica** sobre COMPRAS: Tipo = Compra, fechas posteriores al 01/01/23, agrupada por Fecha de vencimiento ↓ / Proveedor / N. Factura con SUM(MONTO NETO). Semáforo con formato condicional (vencido, vence hoy, vence mañana, vigente) | Congelada (llega a jun-2023). **No descuenta pagos**, así que no es una antigüedad real de CxP |
| CCh Atot (oculta) | 2584×26 | Caja chica de **Atotonilco**: filas 5-~1709, del 04/11/2017 al 03/03/2020. Cierra con "Salida para caja de Milpillas" | Muerta (cerrada en 2020) |
| **Reporte** | 300×25 | Página de gráficas (16): ventas y compras por mes, ingresos y salidas de la cuenta fiscal y no fiscal, adeudo de clientes y proveedores, compras por categoría 2022 y 2023, clientes y ventas por estado. A2:E2 = ventas anuales por **rangos de filas fijos** | Congelada |
| **Categorías Prov.** | 200×11 | **Catálogo de 97 categorías de gasto** (filas 2-98) → grupo contable ("Tipo"), con compras por categoría 2019-2022 | Referencia útil (en C está oculta) |
| **CUENTAS** | 300×26 | Lista de 12 grupos (A2:A13, rango con nombre `CUENTAS`) y **Estado de Resultados Administrativo** 2019, 2020, 2021 y 2022 | Congelada |
| CCh Milp | 2582×12 | Caja chica de **Milpillas**: IMPORTRANGE de D, filas 5-~1958, del 07/02/2020 al 29/05/2023 | Congelada (el origen también se detuvo en may-2023; C tiene una pestaña oculta `CajaChica` que quizá sea la actual) |
| **PRONÓSTICO IVA** | 200×17 | Gráficas: IVA por pagar, IVA acreditable y pronóstico; ingresos y salidas de la cuenta fiscal | Congelada |
| **PRONÓSTICO ISR** | 195×17 | Gráficas: ingresos y egresos fiscales, utilidad fiscal mensual, ISR al 30 % | Congelada |
| IVAeISR (oculta) | 999×16 | **Cálculo mensual de IVA e ISR** que alimenta las dos pestañas anteriores (ene-2018 a abr-2023) | Congelada |
| Nombre de Cuentas (oculta) | 1000×26 | Catálogo de cuentas de tesorería (C4:C6 = rango `Cuenta`), saldo estimado de Santander y catálogo de estados (`EstadosMexico`) | Referencia |
| Tipo (oculta) | 1000×26 | Códigos de movimiento y su signo (rangos `tipoventas` y `tipocompras`). El título dice "Listado de productos y precios", pero solo trae 4 códigos | Referencia |
| Clasificación (oculta) | 1000×26 | Lista **sin usar**: Venta de Maquinaria / Venta de Refacciones; Material y consumibles / Suministros de Oficina / Pago de Servicios / Otras compras; Retiros dueños / Préstamos dueños | Muerta, pero muestra **una intención de negocio**: separar maquinaria de refacciones |
| Stock (oculta) | 1000×26 | Solo `#REF!` | Muerta |

### 1.4 Rango de fechas y volumen

**Ventas.** La columna "Movimientos" cuenta los renglones Venta + Pago. Los montos son las ventas (Tipo = Venta) y salen de ANALISIS. Las facturas se estiman por el rango de folios de la serie A y no incluyen las ventas S/F (sin factura) ni las de Mercado Libre (ECOM).

| Año | Movimientos | Ventas $ | Compras $ | "Utilidad" | Margen | Folios serie A (≈ facturas) |
|---|---|---|---|---|---|---|
| 2018 | ~375 | 14,211,506 | 12,012,194 | 2,199,312 | 15.5 % | A268 → A624 (~355) |
| 2019 | ~524 | 9,171,374 | 8,684,366 | 487,008 | 5.3 % | → A926 (~300) |
| 2020 | ~587 | 16,848,562 | 13,642,341 | 3,206,220 | 19.0 % | → A1314 (~388) |
| 2021 | ~680 | 21,935,044 | 18,308,054 | 3,626,989 | 16.5 % | → A1730 (~416) |
| 2022 | 784 | 19,203,534 | 15,551,909 | 3,651,625 | 19.0 % | → ~A2056 (~325) |
| 2023 | 742 | 21,035,129 | 18,472,482 | 2,562,647 | 12.2 % | → A2294 (~238) |
| 2024 | 847 | 33,102,101 | 26,580,321 | 6,521,780 | 19.7 % | → A2602 (~308) |
| 2025 | 1,162 | 52,142,087 | 35,250,849 | 16,891,239 | 32.4 % | → ~A3036 (~434) |
| 2026 (ene-sep) | 891 | 34,751,771 | 32,319,316 | 2,432,455 | 7.0 % | → A3346 (~310) |

- **Compras:** de 2018 a 2021 hay 10,972 movimientos (Compra + Pago; ~2,200 en 2018 → ~3,300 en 2021). De 2022 a sep-2026 hay 19,459 (~4,100 al año). Las compras de sep-2026 ($0.77 M) se ven incompletas.
- **Directorios en B:** ~756 clientes y ~588 proveedores.
- **Pedidos:** la numeración pasa de ~98 (ene-2018) a ~790 (sep-2026).
- Los movimientos por año se contaron con las fronteras de fila de cada año (en B para 2018-2021 y en `DATA: VENTAS` para 2022+). No se descargaron columnas completas.

---

## 2. Columnas de las pestañas importantes

Abreviaturas de origen: **M** = captura manual, **F** = fórmula, **I** = IMPORTRANGE.

### 2.1 VENTAS (B, encabezados en la fila 12, datos desde la 13). Mismo diseño en C (VENTAS!B12:S)

La columna **A(DATA)** indica dónde cae cada una en `A › DATA: VENTAS`, que es la misma tabla corrida una columna a la izquierda.

| B | A(DATA) | Encabezado | Tipo | Ejemplo | Significado | Origen |
|---|---|---|---|---|---|---|
| B | A | Fecha | fecha dd/mm/aa | 03/01/18 | Fecha del movimiento (venta o cobro) | M |
| C | B | Cliente | texto (validado contra el directorio, no estricto) | "Grupo … SA de CV" | Nombre del cliente tal como está en el Directorio | M |
| D | C | Tipo | lista estricta `tipoventas` | Venta / Pago | **Venta** = cargo (+1), **Pago** = abono o cobro (−1) | M |
| E | D | MONTO NETO | número | 53,197.60 | Importe **total con IVA** cuando hay factura (p. ej. 222,720/1.16 = 192,000 y 235,480/1.16 = 203,000) | M |
| F | E | CUENTA RECEPTORA DE PAGO | lista `Cuenta` | SANTANDER FISCAL / NO FISCAL / NOTA DE CRÉDITO (en C también BANORTE FISCAL) | Cuenta en la que entró el cobro. En los renglones Venta suele ir vacía | M |
| G | F | Descripción | texto libre | "ant. bazuca helicoidal 8" x 4.60 mts  A 2139" | Producto o concepto. En los pagos: anticipo, liquidación, forma de pago y folio de la factura que liquidan. Desde ~2025: "– Venta Isaac" (vendedor), "Fac. Pub. Gen." | M |
| H | G | N. Factura | texto | `A 1731`, `S/F`, `REP - 94`, `ECOM 2000…`, `-` | Folio fiscal: serie A; S/F = sin factura; REP = complemento de pago; ECOM = orden de Mercado Libre | M |
| I | H | N. Pedido | texto o número | 459, `R012`, `REF - 034`, `-` | Número de pedido u orden (R = reparación, REF = refacción; inferido) | M |
| J | I | Ventas | número | `=IF(D=Tipo!B7,E,"")` | Importe si Tipo = Venta | F |
| K | J | Abonos | número | `=IF(D=Tipo!B8,E,"")` | Importe si Tipo = Pago | F |
| L | K | Operación | número con signo | `=IF(E>0, VLOOKUP(D,Tipo!B7:D,3)*E)` | +Venta / −Pago, para calcular saldos | F |
| M | L | # mes | número | `=MONTH(B)` | Mes | F |
| N | M | #año y #mes | **texto** | "2018 1" | `=YEAR(B)&" "&MONTH(B)`: llave de periodo de todos los SUMIF | F (en A, I) |
| O | N | VentasFisc | — | — | Encabezado sin fórmula, vacío | — |
| P | O | AbonosFisc | número | `=IF(F="SANTANDER FISCAL", IF(Tipo=Pago,E))` (en C también BANORTE) | Cobro que entró a la cuenta fiscal | F |
| Q | P | IVA trasladado | número | `=P*0.16` | IVA del cobro (**fórmula incorrecta**: tendría que ser ×0.16/1.16) | F |
| S | R | abonos NO FISCALES | número | `=IF(F="NO FISCAL", IF(Tipo=Pago,E))` | Cobro en efectivo o en cuentas personales | F |

Encabezado de la pestaña (filas 1-11, interfaz de "ficha"):
- C3: cliente seleccionado. Con él se rellenan teléfono, contactos, domicilio, RFC, N. de cuenta y notas por VLOOKUP al directorio.
- E3: "SALDO PENDIENTE" = BALANCE del directorio.
- I3: "BALANCE" de Santander = P3 + SUMIF(VENTAS!F,"SANTANDER FISCAL",K) − SUMIF(COMPRAS!F, …, K).
- J6: **"Cuentas por cobrar total"** = SUM('Directorio Clientes'!T4:T), que da $1,280,405.04 con datos a may-2023.

### 2.2 COMPRAS (B, encabezados en la fila 14, datos desde la 15). Mismo diseño en C

| B | A(DATA) | Encabezado | Tipo | Ejemplo | Significado | Origen |
|---|---|---|---|---|---|---|
| B | A | FECHA | fecha | 02/01/18 | Fecha de la compra o del pago | M |
| C | B | PROVEEDOR | texto (validado contra el directorio, no estricto) | "Aceros … S.A. de C.V." | Proveedor. Incluye pseudoproveedores: `NOMINA ATOTONILCO (NÓMINA)`, `IMSS`, `IMPUESTOS (Retenciones ISR)`, `Santander (Capital de Créditos)`… | M |
| D | C | Tipo | lista estricta `tipocompras` | Compra / Pago | **Compra** = cargo (+1), **Pago** = pago al proveedor (−1) | M |
| E | D | MONTO NETO | número | 13,730.25 | Total con IVA | M |
| F | E | CUENTA DE SALIDA | lista `Cuenta` | SANTANDER FISCAL / NO FISCAL / NOTA DE CRÉDITO / (C: BANORTE FISCAL) | Cuenta de la que salió el pago | M |
| G | F | Descripción | texto | "cheque 0000670", "comisiones diciembre", "efectivo para nomina" | Concepto, número de cheque, referencia | M |
| H | G | N. Factura | texto | `OO89237`, `A - 22160`, `-`, `S/F` | Folio de la factura del proveedor (formato libre) | M |
| I | H | N. Orden/Vale | texto | 1836, "2633, 2665", "27,212,722" (lista mal formateada como número) | Orden de compra o vale interno | M |
| J | I | Compras | número | `=IF(D=Tipo!B12,E)` | Importe si Tipo = Compra | F |
| K | J | Pagos | número | `=IF(D=Tipo!B13,E)` | Importe si Tipo = Pago | F (**en A no se importa para 2022+**) |
| L | K | Operación | número con signo | `=VLOOKUP(D,Tipo!B7:D30,3)*E` | +Compra / −Pago | F |
| M | L | Mes | número | MONTH | | F |
| N | M | #año y #mes | texto | "2021 12" | Llave de periodo | F (I) |
| P | O | Pago Fiscal | número | `=IF(F="SANTANDER FISCAL", IF(Pago,E))` | Pago desde la cuenta fiscal | F |
| Q | P | Pago Fiscal deducible de iva | número | igual a P, **salvo** si el proveedor ∈ {IMPUESTOS, IMSS, Iteso A.C., ITESM…, NOMINA ATOTONILCO (NÓMINA), Santander (Capital de Créditos)} | Base para el IVA acreditable | F |
| R | Q | Iva Fisc | número | `=Q*0.16` | IVA acreditable (mismo error de ×0.16) | F |
| T | S | Pago NO Fiscal | número | `=IF(F="NO FISCAL", IF(Pago,E))` | Pago en efectivo o no fiscal | F |
| U | T | (sin encabezado) **Categoría** | texto | "Aceros", "Nómina", "Publicidad" | `=VLOOKUP(C,'Directorio Proveedores'!B:C,2)`: **categoría del proveedor** | F (I hasta la fila 16000 de C) |
| V | U | Fecha de Vencimiento | fecha | 01/02/18 | `=B + VLOOKUP(C, Directorio!B:AB, 27)` → fecha + días de crédito del proveedor | F (en C cambia a la columna W del directorio) |

Encabezado de COMPRAS (filas 1-12):
- Ficha del proveedor seleccionado; E3 "ADEUDO".
- J9: **"Cuentas por pagar total a corto plazo"** = SUM('Directorio Proveedores'!U3:U) − BALANCE de "Santander (Capital de Créditos)", que da $431,618.07.
- R4: "+ Ajuste 2019 para consolidación" $1,419,795.14 capturado a mano.
- U13: `=NOW()` rotulado "Última modificación del archivo".
- A1:B1: texto basura ("transb", "oiuytreq").

**DATA: COMPRAS de 2022+ solo trae A:I (de Fecha a Compras), M y T.** Pagos, Operación, fiscal y vencimiento no se importan.

### 2.3 Directorio Clientes (B, encabezados en la fila 3, datos en las filas 4-759, se ordena a mano de la A a la Z)

| Col | Encabezado | Tipo / ejemplo | Origen |
|---|---|---|---|
| B | Cliente / Empresa | texto. **Es la llave natural**; VENTAS la valida contra B4:B989 | M |
| C, D | TELÉFONO, TELÉFONO 2 | texto libre ("91 7 09 96/ 91 7 07 68 ext. 13", "045 …") | M |
| E, F, G | CONTACTO 1, CORREO 1, CELULAR 1 | texto | M |
| H, I, J | CONTACTO 2, CORREO 2, CELULAR 2 | texto | M |
| K | DOMICILIO | calle, número y colonia en un solo texto | M |
| L | Municipio | texto (a veces trae el estado) | M |
| M | CP | número o texto (hay casos con la letra O en lugar de cero) | M |
| N | ESTADO | texto (`EstadosMexico` + OTRO, TX) | M |
| O | PAÍS | texto | M |
| P | RFC | 12-13 caracteres alfanuméricos (persona moral o física); también el genérico de público en general `XAXX010101000` | M |
| Q | NUMERO DE CUENTA | dígitos (cuenta bancaria del cliente u otros números); **sensible** | M |
| R | NOTAS | texto (p. ej. el nombre del banco) | M |
| S | Adeudo fin de año anterior | número (saldo inicial) | M |
| T | **BALANCE** | `=S + SUMIF(VENTAS!C, B, VENTAS!L)` → saldo por cobrar | F |
| U | Ventas Históricas | `=SUMIF(VENTAS!C, B, VENTAS!J)` | F |
| V | Agente de Ventas | casi siempre vacío | M |

### 2.4 Directorio Proveedores (B, encabezados en la fila 2, datos desde la 3)

| Col | Encabezado | Notas | Origen |
|---|---|---|---|
| B | PROVEEDOR / Empresa | llave natural (rango `Proveedor`) | M |
| C | **Tipo de Proveedor** | **categoría de gasto**: una de las 97 de `Categorías Prov.` (rango `CategoriasProveedores`) | M |
| D-K | TELÉFONO, TELÉFONO 2, CONTACTO 1, CORREO 1, CEL 1, CONTACTO 2, CORREO 2, CEL 2 | texto | M |
| L-P | DOMICILIO, Municipio, CP, ESTADO, PAÍS | | M |
| Q | RFC | mismo formato (en el extranjero va vacío o con un genérico) | M |
| R | NUMERO DE CUENTA | sensible | M |
| S | NOTAS | p. ej. la patente del agente aduanal | M |
| T | Adeudo fin de año 2017 | saldo inicial | M |
| U | **BALANCE** | `=T + SUMIF(COMPRAS!C15:C, B, COMPRAS!L15:L)` → saldo por pagar | F |
| W-AA | Compras 2019, 2020, 2021, 2022, "2022" (en realidad 2023) | `SUMIF(COMPRAS!C<filaIni>:C<filaFin>, B, COMPRAS!J…)` con **rangos de fila fijos** (2230-4496, 4497-7665, 7670-10981, 10982-14536, 14537-fin) | F |
| AB | **Días de Crédito** | 0, 30… (muchos vacíos) | M |

### 2.5 Categorías Prov. (B): catálogo de cuentas de gasto

- B = categoría. Hay 97, entre ellas: Aceros, Acero inoxidable, Motores y componentes afines, Bandas y mangas de hule, Rodamientos y chumaceras, Pintura, Celdas de carga, Nómina, IMSS, Impuestos, Fletes (exclusivamente), Publicidad, Comisiones, Combustible, Servicios aduanales, Equipos para reventa, Retiros Personales (Dividendos), Sin efectos…
- C = **grupo contable**. Hay 11: Costos de producción · MOD · Gastos de ventas · Gastos administrativos · Gastos Financieros · Impuestos · PTU · Dividendos (Retiros accionistas) · Adquisición de Activos · Fletes de envío · Otros. "Sin efectos" no tiene grupo.
- E-H = compras 2019-2022 por categoría: `SUMIF('Directorio Proveedores'!C, categoría, columna del año)`.
- J = `UNIQUE(C2:C)` (lista de grupos) y K = un orden manual de los grupos.
- Algunas asignaciones llaman la atención: *Concreto premezclado*, *Fertilizantes* y *Seguros* van a **Dividendos** (son gastos personales de los socios). *Luz* y *Servicios de paquetería* van a Costos de producción. *Fletes (exclusivamente)* va a "Fletes de envío", que el estado de resultados presenta como "Flete al comprador".

### 2.6 Catálogos menores

- **Tipo**: B7 "Venta" (+1) y B8 "Pago" ("Recepción de abono", −1) para ventas; B12 "Compra" (+1) y B13 "Pago" ("Pago a proveedor", −1) para compras. Rotulados "No Modificar".
- **Nombre de Cuentas**:
  - cuenta 1 SANTANDER FISCAL, cuenta 2 NO FISCAL, cuenta 3 NOTA DE CRÉDITO;
  - E4 = saldo de Santander "al 17/06/21" $1,912,501, capturado a mano;
  - G4 "Actual estimado" = `E4 + SUM(VENTAS!P1806:P) − SUM(COMPRAS!P9102:P)`;
  - J:L = catálogo de estados con abreviatura y capital.

### 2.7 Caja chica (CCh Atot y CCh Milp)

| Col | Atot (2017-11 → 2020-03) | Milp (2020-02 → 2023-05, importado de D) |
|---|---|---|
| B | FECHA | FECHA |
| C | CONCEPTO (libre: "1 garrafon de agua", "PAQUETERIA YaVoy 0317", "SALIDA") | CONCEPTO |
| D | Cod. Valor (método: Efectivo / Cheque al Portador) | **En turno** (persona responsable) |
| E | ENTRADAS | Método |
| F | SALIDAS | ENTRADAS |
| G | SALDO `=G(ant) − F + E` | SALIDAS |
| H | — | SALDO |

- En Atot, F2 = saldo total. El fondo **mínimo es $1,500 y el máximo $3,500**, y la alerta textual pide "recargar o retirar para los $3000 exactos". J:N contienen el saldo por método.
- **Atot = Atotonilco** y **Milp = Milpillas**: son dos sedes o cajas. La caja de Atotonilco se vació hacia Milpillas el 03/03/2020. El nombre completo de la sede Milpillas hay que confirmarlo con el negocio.
- La caja también **recibe ventas de mostrador en efectivo** (grapas, reparaciones de cosedoras). En VENTAS esas mismas ventas aparecen como Pago "NO FISCAL" con la descripción "efectivo (en) caja chica". También paga nómina parcial, viáticos, paquetería, agua y despensa.

### 2.8 IVAeISR (B, oculta; alimenta las pestañas PRONÓSTICO)

| Col | Encabezado | Fórmula |
|---|---|---|
| A | Año y mes | "2018 1" (texto) y después números de fecha |
| B | IVA POR PAGAR | `−SUMIF(VENTAS!N, A, VENTAS!Q)` (IVA trasladado cobrado) |
| C | IVA ACREDITABLE | `SUMIF(COMPRAS!N, A, COMPRAS!R)` |
| D | PRONÓSTICO (+ a favor / − por pagar) | `B + C` |
| F | Ingresos fisc | `SUMIF(VENTAS!N, A, VENTAS!P)/1.16` |
| G | Egresos Fisc | `SUMIF(COMPRAS!N, A, COMPRAS!P)/1.16` (**incluye** nómina, IMSS, impuestos y capital de créditos, porque usa P y no Q) |
| H | Ut. Fiscal | `F − G` |
| I (I1 = 0.0795) | ISR estimado | `F × 0.0795`. Inferencia: 0.0795 = 26.5 % (coeficiente de utilidad) × 30 %, es decir, un pago provisional estimado |
| J (J1 = 0.3) | ISR 30 % | `H × 0.3` (solo de 2022 en adelante) |
| N49:P52 | totales sueltos | SUM(F38:F49), SUM(G38:G48) (rangos dispares), etc. |

### 2.9 ANALISIS (A): disposición

- **B1:Q8**: bloques anuales 2018-2025 (Ventas, Compras, % y Utilidad). Cada año es un `SUM` de 12 filas fijas de la tabla mensual.
- **R1:S8**: tabla Año → % de utilidad (llega a 2024) que alimenta la gráfica "Utilidad frente a Año".
- **A28:F136**: tabla mensual.
  - A = fecha del día 1 de cada mes (con formato "yyyy m").
  - B = la misma fecha si hay ventas.
  - C VENTAS = `SUMIF('DATA: VENTAS'!M, A, 'DATA: VENTAS'!I)`.
  - D COMPRAS = `SUMIF('DATA: COMPRAS'!M, A, I)` hasta dic-2021; desde ene-2022 es `SUMIFS(I, M, A, T, "<>Sin efectos")`.
  - E = C − D.
  - F = E/C.
- **G:L**: márgenes trimestral (G etiqueta, H valor), cuatrimestral (I, J) y semestral (K, L).
- **M45:P51**: "Punto de equilibrio a seis meses".
- **M71:N74**: utilidad mensual promedio por año.
- Celdas sueltas: N11, N14, P13, P14, H142 y T184 (se describen en el §3).

---

## 3. KPIs y sus fórmulas

### 3.1 Archivo A: ANALISIS (vivo)

| # | KPI | Fórmula (en la hoja) | Equivalente en el ERP |
|---|---|---|---|
| 1 | **Ventas del mes** | `SUMIF(DATA:VENTAS!M="aaaa m", DATA:VENTAS!I)` | Σ total (con IVA) de los documentos Tipo = Venta del mes, por fecha del documento |
| 2 | **Compras del mes** | `SUMIF(DATA:COMPRAS!M, I)`; desde 2022 `SUMIFS(…, T,"<>Sin efectos")` | Σ total de los documentos Tipo = Compra del mes, excepto la categoría "Sin efectos" |
| 3 | **Utilidad/pérdida mensual** | `C − D` | Ventas − Compras (flujo devengado mixto, con IVA) |
| 4 | Margen mensual | `E / C` | Utilidad / Ventas |
| 5 | **Ventas anuales** (B4, D4…P4) | `SUM(C29:C40)` … `SUM(C113:C124)` | Σ de los 12 meses |
| 6 | **Compras anuales** (B6…) | `SUM(D…)` | |
| 7 | Compras / Ventas (C6…) | `B6/B4` | |
| 8 | **Utilidad anual** y **margen anual** (B8, C8…) | `B4 − B6` y `B8/B4` | |
| 9 | Margen trimestral (H, etiqueta "1,801" = 18-T1) | `SUM(E 3 meses)/SUM(C 3 meses)` | Margen del trimestre |
| 10 | Margen cuatrimestral (J, "18-C1") | ídem con 4 meses | |
| 11 | Margen semestral (L, "18-S1") | ídem con 6 meses | |
| 12 | Margen 2023+2024 (N11) | `(L8+N8)/(L4+N4)` = 16.78 % | Margen acumulado de varios años |
| 13 | Crecimiento de ventas 2024 vs 2023 (N14) | `N4/L4 − 1` = 57.37 % | Crecimiento interanual |
| 14 | "Punto de equilibrio a seis meses" (M48, P48, N51) | Ventas prom. = `SUM(C101:C108)/COUNT(...)` (ene-ago 2024); Utilidad prom. = ídem sobre E; **"Punto de equilib prom" = M48 − P48** ("Ventas mensuales mínimas para tener utilidad") | En realidad es **compras promedio** de ene-ago 2024 ($1.94 M). Un punto de equilibrio de verdad necesita separar costos fijos y variables |
| 15 | Utilidad mensual promedio por año (M71-M74) | `SUM(E año)/12` para 2018-2021 | |
| 16 | Variación de la utilidad promedio (N72, N73) | `M(n+1)/M(n) − 1` (2020 vs 2019 = 558 %; 2021 vs 2020 = 13 %) | |
| 17 | Sin etiqueta: P13 = 25,592,098 (fijo); P14 = `4501000/N6` = 16.93 % (4.5 M ÷ compras 2024) | Preguntar qué representan (¿meta? ¿un rubro?) | |
| 18 | Sin etiqueta: H142 = `SUM(E125:E136)*0.05` = 5 % de la utilidad de 2026 ($121,622.76) | ¿Bono o reparto? | |
| 19 | T184 = `SUM('Hoja 7'!C1:C100)` = $1,028,865.83 | Suma de una lista pegada a mano (¿cartera?) | |

**Gráficas de ANALISIS:**
- líneas de Ventas, Compras y Utilidad por mes (B28:E);
- líneas de margen trimestral, cuatrimestral y semestral;
- "Utilidad frente a Año" (R1:S8);
- una más de margen cuatrimestral contra ventas.

El formato condicional pone en rojo los valores negativos.

### 3.2 Archivo B: indicadores adicionales (congelados, pero sirven de diseño)

| KPI | Dónde | Fórmula |
|---|---|---|
| **Saldo por cliente (CxC)** | Directorio Clientes!T | Adeudo inicial + Σ(Venta) − Σ(Pago) |
| **CxC total** | VENTAS!J6 | Σ de todos los BALANCE de clientes |
| Ventas históricas por cliente | Directorio Clientes!U | Σ Ventas del cliente |
| **Saldo por proveedor (CxP)** | Directorio Proveedores!U | Adeudo 2017 + Σ(Compra) − Σ(Pago) |
| **CxP a corto plazo** | COMPRAS!J9 | Σ BALANCE de proveedores − BALANCE de "Santander (Capital de Créditos)" |
| Compras por proveedor por año | Dir. Proveedores!W:AA | SUMIF sobre rangos de fila de cada año |
| **Compras por categoría por año** | Categorías Prov.!E:H | SUMIF de lo anterior por categoría |
| **Estado de Resultados Administrativo** | CUENTAS (2019 en F:I; 2020, 2021 y 2022 en F:Y desde la fila 33) | Ventas (`Reporte!B2…`) − [Flete al comprador] − Costos de producción − MOD = **Utilidad bruta**; − Gastos administrativos − Gastos de ventas − Gastos financieros = **Utilidad antes de impuestos**; − Impuestos − PTU = **Utilidad neta**; − Dividendos (retiros) = remanente. Cada renglón = `SUMIF('Categorías Prov.'!C, grupo, columna del año)`. Se presenta en % de ventas, % del costo y "variación promedio mensual vs año anterior" (`(U35/9) − (N35/12)`, que **supone 9 meses en 2022**). En 2020-2022 también se desglosa por categoría |
| Ventas anuales (Reporte) | Reporte!A2:E2 | `SUM(VENTAS!J13:J388)`, `J388:J912`, `J913:J1501`, `J1502:J2177`, `J2178:J2957` (rangos fijos; ver §7) |
| **IVA por pagar / acreditable / pronóstico** | IVAeISR B:D | Ver §2.8 |
| **Ingresos fiscales, egresos fiscales, utilidad fiscal, ISR** | IVAeISR F:J | Ver §2.8 |
| Saldo estimado del banco fiscal | Nombre de Cuentas!G4 | Saldo al 17/06/21 + cobros fiscales posteriores − pagos fiscales posteriores |
| Vencimientos de facturas de proveedores | Vencimiento de Facturas | Tabla dinámica por fecha de vencimiento con semáforo |
| Saldo de caja chica y alerta de reposición | CCh Atot F2:H2 | Σ entradas − Σ salidas; avisa si queda fuera del rango [1,500, 3,500] |

**Gráficas de Reporte:**
- Ventas y Compras por mes (combo y área);
- ingresos y salidas de la cuenta fiscal (columnas P de VENTAS y COMPRAS);
- ingresos y salidas no fiscales (S y T);
- "Adeudo de clientes actual" y "Adeudo actual a proveedores" (pastel);
- "Compras del 2022" y "Compras del 2023" por categoría;
- "Recuento de clientes por estado" y "Ventas $$$ por Estado".

---

## 4. Reglas de negocio implícitas

1. **Partida doble simplificada.** Toda operación se registra en dos renglones:
   - ventas: Venta (cargo) + Pago (abono);
   - compras: Compra (cargo) + Pago.

   El saldo se calcula como Σ cargos − Σ abonos por nombre de cliente o proveedor. Una compra o venta de contado lleva los dos renglones el mismo día.
2. **Anticipos y liquidaciones.** Las máquinas se cobran con anticipo (casi siempre 50 %) y liquidación. La descripción dice "ant. …", "liq. …" o "pago final" y trae el folio de la factura original ("ant. bazuca … A 2139"). Desde ~2022 el pago lleva su propio folio **`REP - n`** (complemento de pago) en "N. Factura".
3. **Folios:**
   - Ventas: serie única `A` consecutiva (A270 en ene-2018 → A3346 en sep-2026). `S/F` = venta sin factura (casi siempre cobrada como NO FISCAL). `ECOM <orden>` = Mercado Libre (cliente "Público General (Mercadolibre)"). "Fac. Pub. Gen." = factura global a público en general. Un pago puede cubrir varias facturas ("A 2024 - A 3025").
   - Proveedores: formato libre ("OO89237", "A - 22160", "F 102868", "-").
4. **Pedido u orden.** La columna "N. Pedido" liga la venta con un número de pedido consecutivo (≈98 en 2018 → ≈790 en 2026). Hay prefijos `R0xx` (reparación, inferido) y `REF - 0xx` (refacciones, inferido). En compras, "N. Orden/Vale" es la orden de compra o vale interno y puede traer varias ("2633, 2665").
5. **Cuentas de tesorería.**
   - `SANTANDER FISCAL` es el banco donde entra lo facturado.
   - `BANORTE FISCAL` aparece en C hacia 2025, y allí las fórmulas fiscales ya lo incluyen.
   - `NO FISCAL` agrupa efectivo, caja chica y cuentas personales ("Bancomer personal", "santander personal", "depósito bancomer").
   - `NOTA DE CRÉDITO` es un **medio de liquidación**, no una cuenta: se usa en los dos lados ("NC de factura 71173"; "NC 23 – Por liq. de equipo").
6. **Criterio fiscal = flujo.** Un ingreso es "fiscal" si el cobro entró a una cuenta fiscal, y un egreso lo es si el pago salió de una cuenta fiscal. El IVA se calcula sobre lo efectivamente cobrado o pagado, como pide la LIVA, pero con el factor equivocado (ver §7).
7. **IVA acreditable.** Se excluyen por **nombre exacto** del proveedor: IMPUESTOS, IMSS, Iteso A.C., ITESM, NOMINA ATOTONILCO (NÓMINA) y Santander (Capital de Créditos).
8. **ISR estimado.** Pago provisional ≈ ingresos fiscales sin IVA × 7.95 %. Anual ≈ (ingresos − egresos fiscales) × 30 %.
9. **La categoría es del proveedor.** Cada compra hereda la categoría del Directorio con un VLOOKUP en vivo. Si se cambia la categoría del proveedor, **se reescribe la historia**. Un proveedor genérico (Alibaba, Mercado Libre, Amazon) queda con una sola categoría, aunque para Mercado Libre se crearon variantes del nombre, como "Mercado Libre (Equipo de Oficina)".
10. **Grupos contables.** Categoría → grupo (Categorías Prov.!C). El estado de resultados resta los grupos en orden fijo. Los **retiros de socios y los gastos personales** van como compras con la categoría "Retiros Personales (Dividendos)" (y Fertilizantes, Concreto, Seguros…), y en el estado de resultados se restan después de la utilidad neta.
11. **"Sin efectos".** Es una categoría para movimientos que no deben afectar la utilidad (p. ej. facturas cuyo propósito es obtener efectivo para nómina, con la descripción "efectivo para nomina"). ANALISIS los excluye de Compras desde 2022.
12. **Pseudoproveedores** para nómina (fiscal y no fiscal, como Compra + Pago), IMSS, impuestos (ISR, retenciones de ISR e IVA, estatales/ISN), créditos bancarios (capital e intereses), comisiones de vendedores (personas como proveedores, categoría "Comisiones") y donativos.
13. **Vencimiento de CxP** = fecha de la compra + "Días de Crédito" del proveedor.
14. **Vendedor.** No hay campo. El directorio de clientes tiene "Agente de Ventas" casi vacío. Desde ~2025 se escribe en la descripción ("– Venta Isaac", "– Venta J. Manuel", "– Venta Susy"). Las comisiones se registran como compras.
15. **Caja chica.**
    - Atotonilco: fondo fijo de $3,000 (mínimo 1,500 y máximo 3,500), con métodos Efectivo y Cheque al portador.
    - Milpillas: responsable "en turno".
    - Cobra ventas de mostrador y paga gastos menores.
16. **Directorios.** Se ordenan a mano de la A a la Z después de cada alta. VENTAS y COMPRAS validan el nombre contra el directorio, pero la validación no es estricta.
17. **Periodo.** La llave de mes es el texto "aaaa m". Los años nuevos se agregan copiando bloques de 12 filas y fórmulas con rangos fijos.

---

## 5. Conexiones IMPORTRANGE

| Destino | Celda | Origen (ID) | Rango | Comentario |
|---|---|---|---|---|
| A › DATA: VENTAS | A1 | B `1TtNqWOn…` (la URL trae gid=432513886, que es "Categorías Prov.", pero no importa) | `VENTAS!B12:V2178` | Encabezado + 2018-01-03 → 2021-12-31. **Fijo**: corte duro en el año 2021 |
| A › DATA: VENTAS | A2168 | C `1bMPe8wR…` | `VENTAS!B13:V` | 2022 → hoy (abierto). Trae todas las columnas |
| A › DATA: COMPRAS | A2 | B | `COMPRAS!B14:V10986` | Encabezado + 2018-01-01 → 2021-12-31 |
| A › DATA: COMPRAS | A10975 | C | `COMPRAS!B15:J110000` | Solo de Fecha a Compras (sin Pagos ni columnas fiscales) |
| A › DATA: COMPRAS | M10975 | C | `COMPRAS!N15:N110000` | #año y #mes |
| A › DATA: COMPRAS | T10975 | C | `COMPRAS!U15:U16000` | **Categoría, truncada en la fila 16000 de C** (= fila 26960 de A, ~05/11/2025) |
| B › CCh Milp | A1 | D `1lHhdFXs…` "Caja Chica Milpillas" | `Caja Chica Milp!A1:H` | Caja chica de Milpillas (el origen se detuvo en may-2023) |

C tiene la misma estructura que B en VENTAS y COMPRAS, más estas pestañas: Clientes-Contacto, Clientes-Contacto Unified, CajaChica (oculta), Vencimiento de Facturas (4257 filas) e IVAeISR visible. **El importador de 2022 en adelante debe leer de C**, que merece su propio análisis. Diferencias ya vistas en C:
- `Tipo!B15` en lugar de B13 para el Pago a proveedor;
- días de crédito en la columna W del directorio;
- BANORTE FISCAL dentro de las fórmulas fiscales.

---

## 6. Entidades propuestas para el ERP y mapeo para el importador

### 6.1 Modelo (Postgres/Supabase)

Separar **documentos** (factura de venta y factura de compra) de **movimientos de dinero** (cobros y pagos), con una tabla de **aplicación** entre ellos. Las hojas los mezclan.

| Entidad | Campos clave | Notas |
|---|---|---|
| `cliente` | id, razon_social, nombre_normalizado, rfc, regimen?, telefono[], domicilio (calle, colonia), municipio, cp, estado_id, pais, notas, agente_id, saldo_inicial, saldo_inicial_fecha, origen (B/C + fila) | Llave natural de la hoja = nombre. Hace falta una tabla `cliente_alias` para variantes |
| `contacto` | id, cliente_id \| proveedor_id, nombre, correo, celular, rol | Las hojas guardan 2 contactos en columnas planas |
| `proveedor` | id, razon_social, nombre_normalizado, rfc, categoria_gasto_id (por defecto), dias_credito, saldo_inicial, es_pseudo (nómina, IMSS, impuestos, banco), datos_bancarios (cifrados o fuera de alcance) | |
| `categoria_gasto` | id, nombre, grupo_contable_id, afecta_utilidad (bool; false para "Sin efectos"), es_retiro_socio (bool), deducible_iva (bool) | Se siembra con las 97 de `Categorías Prov.` |
| `grupo_contable` | id, nombre, orden_er (orden en el estado de resultados), naturaleza | Los 11 grupos más "Ventas" |
| `cuenta_tesoreria` | id, nombre, tipo (banco, caja, no_fiscal), banco, es_fiscal, sede_id | SANTANDER FISCAL, BANORTE FISCAL, NO FISCAL, Caja chica Atotonilco, Caja chica Milpillas |
| `sede` | id, nombre | Atotonilco, Milpillas (confirmar) |
| `vendedor` | id, nombre, comision_pct? | Isaac, J. Manuel, Susy…, que hoy se sacan de la descripción |
| `pedido` | id, folio, tipo (equipo, reparación, refacción), cliente_id, fecha, vendedor_id, descripcion | De "N. Pedido" |
| `factura_venta` (documento) | id, fecha, cliente_id, serie, folio, tipo_doc (factura, sin_factura, ecom, otro), canal (directo, Mercado Libre), subtotal, iva, total, es_fiscal, pedido_id, vendedor_id, clasificacion (maquinaria, refacción, servicio, reparación), descripcion, estado (abierta, pagada, cancelada) | Viene de Tipo = Venta |
| `cobro` | id, fecha, cliente_id, monto, cuenta_tesoreria_id, forma (transferencia, efectivo, cheque, tarjeta, Mercado Pago), folio_rep, es_anticipo, descripcion | Viene de Tipo = Pago en VENTAS (excepto cuenta NOTA DE CRÉDITO) |
| `cobro_aplicacion` | cobro_id, factura_venta_id, monto | Liga el cobro con una o varias facturas |
| `nota_credito` | id, lado (venta, compra), fecha, cliente_id \| proveedor_id, folio, monto, documento_origen_id | Viene de Pago con cuenta "NOTA DE CRÉDITO" |
| `factura_compra` (documento) | id, fecha, proveedor_id, folio_proveedor, orden_compra, subtotal, iva, total, categoria_gasto_id (**copiada al registrar**), fecha_vencimiento, es_fiscal, descripcion | Viene de Tipo = Compra |
| `pago_proveedor` | id, fecha, proveedor_id, monto, cuenta_tesoreria_id, referencia (cheque, transferencia), descripcion | Viene de Tipo = Pago en COMPRAS |
| `pago_aplicacion` | pago_id, factura_compra_id, monto | |
| `movimiento_caja` | id, cuenta_tesoreria_id (caja), fecha, concepto, responsable, metodo, entrada, salida, categoria_gasto_id?, documento_vinculado? | Saldo calculado, no capturado. Opcional: fondo mínimo y máximo por caja |
| `parametro_fiscal` | vigencia, tasa_iva (0.16), coef_utilidad, tasa_isr (0.30) | Sustituye a 0.16, 0.0795 y 0.3 escritos en las fórmulas |
| `importacion_origen` | archivo, pestaña, fila, hash del renglón | Trazabilidad y prevención de duplicados |

**Vistas para el dashboard:**
- `v_ventas_mes` y `v_compras_mes`, con el filtro afecta_utilidad;
- `v_utilidad_mes` y los márgenes por trimestre, cuatrimestre y semestre;
- `v_estado_resultados` (por grupo contable);
- `v_cxc_saldo`, `v_cxc_antiguedad`, `v_cxp_saldo` y `v_cxp_vencimientos`;
- `v_iva_mes` (trasladado y acreditable sobre base total/1.16) y `v_isr_estimado`;
- `v_caja_saldo`.

### 6.2 Fuentes que debe leer el importador (evita duplicados)

| Periodo | Ventas | Compras |
|---|---|---|
| 2018-01-01 → 2021-12-31 | B › VENTAS filas 13-2178 | B › COMPRAS filas 15-10986 |
| 2022-01-01 → hoy | C › VENTAS fila 13 → fin | C › COMPRAS fila 15 → fin |
| **No importar** | B › VENTAS ≥2179 (2022-may 2023, copia de C) | B › COMPRAS ≥10987 (copia de C) |

**No importar desde `A › DATA:`.** Para 2022+ le faltan columnas de compras y trae la categoría truncada.

Directorios: B para 2018-2021 y **C como versión vigente**. Hay que conciliar nombres entre los dos.

### 6.3 Mapeo de VENTAS (B y C) → ERP

| Columna en la hoja | Campo destino | Transformación |
|---|---|---|
| B Fecha | factura_venta.fecha / cobro.fecha | dd/mm/aa → date. Rechazar si sale de [2017-11, hoy+30d] |
| C Cliente | cliente_id | normalizar (trim, mayúsculas, sin acentos ni puntos, "S.A. de C.V." ≈ "SA de CV") → buscar en `cliente_alias`; si no aparece, crear el cliente y marcarlo para revisión |
| D Tipo | discriminador | `Venta` → factura_venta; `Pago` con F = NOTA DE CRÉDITO → nota_credito; resto de `Pago` → cobro |
| E MONTO NETO | total / monto | número. Si es fiscal (serie A): subtotal = total/1.16 e iva = total − subtotal (**validar con el contador**) |
| F Cuenta receptora | cobro.cuenta_tesoreria_id | catálogo. En renglones Venta, "NO FISCAL" sirve de pista de es_fiscal = false |
| G Descripción | descripcion | conservar el original. Extraer: vendedor `/- Venta ([\wÁÉÍÓÚ .]+)/`, anticipo `/^ant\.?/i`, liquidación `/^(liq\.?|pago final)/i`, folios citados `/A ?\d{3,4}/g` → cobro_aplicacion, "Fac. Pub. Gen.", forma de pago (transferencia, efectivo, cheque N, tarjeta, Mercado Pago) |
| H N. Factura | serie + folio / folio_rep | `^A ?-? ?(\d+)$` → serie A; `S/F` → tipo_doc = sin_factura; `^REP ?- ?(\d+)` → cobro.folio_rep; `^ECOM (\d+)` → canal = Mercado Libre; `-` o vacío → null; `A x - A y` → varias aplicaciones |
| I N. Pedido | pedido_id | `-` → null; numérico → pedido equipo; `R\d+` → reparación; `REF - \d+` → refacción (confirmar) |
| J:S (calculadas) | — | **No importar.** Usarlas solo como control de totales por mes contra ANALISIS |
| (derivado) | cobro_aplicacion | 1) mismo folio en H en la Venta y en el Pago del mismo cliente; 2) folio citado en G; 3) FIFO por cliente para lo que sobre (marcar "aplicación inferida") |

### 6.4 Mapeo de COMPRAS (B y C) → ERP

| Columna | Campo | Transformación |
|---|---|---|
| B FECHA | factura_compra.fecha / pago_proveedor.fecha | igual que en ventas; corregir años imposibles (p. ej. 15/09/29) |
| C PROVEEDOR | proveedor_id | normalizar y usar alias; los pseudoproveedores van con es_pseudo |
| D Tipo | discriminador | Compra → factura_compra; Pago con NOTA DE CRÉDITO → nota_credito (lado compra); Pago → pago_proveedor |
| E MONTO NETO | total / monto | igual que en ventas |
| F CUENTA DE SALIDA | pago.cuenta_tesoreria_id | catálogo |
| G Descripción | descripcion | extraer el número de cheque (`cheque 0000\d+`) y la referencia |
| H N. Factura | folio_proveedor | texto libre; `-`, `S/F`, vacío → null |
| I N. Orden/Vale | orden_compra (texto[]) | separar por comas; si viene numérico con separador de miles, reconstruir ("27,212,722" → ¿"27, 212, 722"?) |
| U Categoría | factura_compra.categoria_gasto_id | **No confiar en ella** (es un VLOOKUP vivo). Usar la categoría del proveedor *al momento de importar* y marcar `categoria_inferida` |
| V Fecha vencimiento | fecha_vencimiento | importar el valor calculado o recalcularlo con dias_credito |
| J:T | — | no importar (control) |

### 6.5 Directorios y catálogos

- **Clientes (B y C):**
  - B → razon_social; C/D → telefonos; E:G y H:J → 2 filas de `contacto`;
  - K:O → domicilio; P → rfc (validar con regex de RFC; `XAXX010101000` → público en general);
  - Q y R → **no migrar a texto plano** (cuenta bancaria): cifrar o descartar;
  - S → saldo_inicial; V → agente; T y U → solo control.
- **Proveedores:** igual que clientes, más C → categoria_gasto_id por defecto, T → saldo_inicial (fin de 2017) y AB (B) / W (C) → dias_credito.
- **Categorías Prov.:** B → categoria_gasto.nombre y C → grupo_contable. Marcar "Sin efectos" con afecta_utilidad = false y "Retiros Personales (Dividendos)" (y las demás del grupo Dividendos) con es_retiro_socio = true.
- **Nombre de Cuentas:** C4:C6 → cuenta_tesoreria, más BANORTE FISCAL de C. E4 → saldo inicial de Santander al 17/06/2021 (alternativa: arrancar con saldo 0 en 2018 y conciliar).
- **Caja chica:** CCh Atot B:G → movimiento_caja (caja Atotonilco; D = método) y CCh Milp (de D) B:H → movimiento_caja (caja Milpillas; D = responsable, E = método). Revisar también la pestaña `CajaChica` de C. Las entradas de venta en efectivo **ya existen** en VENTAS como Pago NO FISCAL, así que no hay que duplicarlas como ingreso.
- **Pedidos (B, oculta):** sirve para sembrar `pedido` (folio y cliente), aunque no trae fecha.

---

## 7. Problemas de calidad (por impacto)

**Afectan los KPIs actuales**

1. **Categoría de compras truncada.** `IMPORTRANGE(C,"COMPRAS!U15:U16000")` corta en la fila 26960 de A (~05/11/2025). Desde ahí `DATA: COMPRAS!T` está vacía. Por eso el filtro `"<>Sin efectos"` de ANALISIS **dejó de excluir** desde nov/dic-2025, y cualquier análisis por categoría queda sin dato.
2. **Compras con `#año y #mes` vacío en C.** Ejemplo: `DATA: COMPRAS` fila 25000, Compra de $4,196 del 20/06/25. El SUMIF las ignora y **subestima las compras sin avisar**. Pasa en renglones intercalados, probablemente insertados sin arrastrar la fórmula.
3. **IVA con el factor equivocado.** `IVA = monto × 0.16` (VENTAS!Q y COMPRAS!R), pero el monto ya incluye IVA: hay importes que divididos entre 1.16 dan cifras redondas (222,720 → 192,000; 235,480 → 203,000; 3,352.40 → 2,890). El IVA trasladado y el acreditable salen **inflados 16 %**. Además IVAeISR divide los ingresos y egresos entre 1.16, así que es incoherente con su propio cálculo de IVA.
4. **La lista de exclusión del IVA acreditable es por nombre exacto.** "IMPUESTOS (Retenciones ISR)", "IMPUESTOS (Retenciones IVA)" e "IMPUESTOS (Estatales)" no coinciden con "IMPUESTOS". Ejemplo: un Pago de $8,250 de retenciones de ISR recibió $1,320 de "IVA acreditable".
5. **"Ventas" incluye renglones que no son ventas:** "Prestamo con cheque" (Venta + Pago de $15,000), "devolucion dropbox", "reembolso membresia". **"Compras" incluye** nómina, IMSS, impuestos, retiros de socios, activos y capital de créditos. La "utilidad" de ANALISIS es flujo y no utilidad contable, y lleva IVA en los dos lados.
6. **Los totales de `Reporte` (B) no cuadran con ANALISIS.** Los rangos de fila fijos están desfasados 3 filas: `J913:J1501` (2020) incluye 3 renglones de ene-2021 ($18,560 + $502,570), así que 2020 sale en $17,369,692 cuando es $16,848,562, y 2021 sale en $21,413,914 cuando es $21,935,044. Pasa lo mismo con los rangos por año del Directorio de Proveedores (2021 termina en la fila 10981, pero el año llega a la 10986) y la fila 388 se cuenta en 2018 y en 2019.
7. **Cadena frágil en ANALISIS.** Cada mes calcula solo si el mes anterior no está vacío ni en cero (`IF(C28="","",IF(C28=0,"",SUMIF…))`). Un mes sin ventas apaga todos los siguientes. Además, B110 apunta a C111 (desfase de una fila) y oct-2026 muestra `#DIV/0!`.
8. **La llave de periodo es texto ("2018 1")** y se compara con una fecha por coerción implícita de SUMIF. Funciona, pero depende de la configuración regional y del formato.
9. **Valores fijos que se vuelven obsoletos:**
   - bloques anuales con `SUM(Cxx:Cyy)` hasta 2025 (no hay bloque 2026);
   - tabla Año→Utilidad hasta 2024;
   - punto de equilibrio fijo en ene-ago 2024;
   - P13 = 25,592,098;
   - CUENTAS 2022 dividido entre 9 meses;
   - saldo de Santander al 17/06/21 con filas de corte 1806 y 9102;
   - "Ajuste 2019 para consolidación" $1,419,795.14;
   - encabezado "Compras 2022" repetido para 2023.

**Afectan la migración**

10. **Duplicación entre B y C.** B trae 2022 a may-2023 (VENTAS ≥2179 y COMPRAS ≥10987) con las mismas filas que el inicio de C.
11. **La relación pago→factura es textual y ambigua:** mismo folio en H, folio citado en la descripción, folios `REP`, varios folios en una celda ("A 2024 - A 3025"), anticipos sin folio (S/F) y diferencias de centavos ($1,716.00 de venta contra $1,716.80 de pago). Las notas de crédito se capturan como "Pago" con la cuenta NOTA DE CRÉDITO.
12. **Fechas inválidas o desordenadas:** 15/09/29 ("2029 9", fuera de cualquier mes de ANALISIS) y renglones fuera de orden cronológico en C (06/09 después de 23/09…).
13. **Categoría y vencimiento calculados en vivo** con VLOOKUP al directorio: no hay foto histórica. Si se cambia la categoría o los días de crédito de un proveedor, se reescriben todas sus compras.
14. **Directorios:**
    - duplicados y variantes ("Terracerías y Construcciones de Chihuahua, S.A. de C.V." y "Terracerias Y Construcciones de Chihuahua, SA de CV" con el mismo RFC);
    - la misma entidad como cliente y como proveedor con otra grafía ("Villa-Oro Agro SA de CV" / "VILLA ORO AGRO SA DE CV", este último con categoría Fertilizantes → Dividendos);
    - el RFC dentro del nombre ("Publico en general XAXX010101000");
    - municipio y estado cruzados ("Quintana Roo" en municipio y "Yucatán" en estado);
    - CP con letras ("O4100");
    - teléfonos en formatos libres (prefijo 045, "ext.", varios en una celda);
    - "Agente de Ventas" vacío;
    - "NUMERO DE CUENTA" con cuentas bancarias y otros números mezclados, y el banco en NOTAS.
15. **El vendedor solo está en texto libre** y únicamente en los años recientes. No hay histórico de vendedor por venta.
16. **Una sola categoría por proveedor.** Los proveedores genéricos (Alibaba, Amazon, Oxxo, Mercado Libre) no permiten clasificar bien el gasto.
17. **La caja chica no tiene categoría:**
    - conceptos libres y genéricos ("SALIDA", "PAGADO", "ENTRADA");
    - saldos negativos (−$1,824.50 en Atot y −$1,725 en Milp), que indican recargas no capturadas;
    - las ventas en efectivo se registran aquí **y** en VENTAS (conciliar sin duplicar);
    - mezcla gastos del negocio con gastos personales o de despensa (croquetas, queso, pastel).
18. **Gastos personales y retiros dentro de "compras"** (grupo Dividendos: fertilizantes, concreto, seguros, clases de natación…) y la categoría "Sin efectos" para facturas de efectivo. El ERP necesita banderas explícitas y no depender del nombre de la categoría.
19. **La lógica fiscal depende de nombres literales de cuentas** ("SANTANDER FISCAL"). BANORTE se agregó a mano en C y no en B.
20. **Basura y pestañas muertas:** "transb"/"oiuytreq" en COMPRAS A1:B1; marcas manuales "error" en VENTAS K3 y "correcto" en COMPRAS O9; `Stock` = `#REF!`; `Pedidos` sin fechas; Hoja 6, Hoja 7 y Hoja 19 son pegotes; `Clasificación` no se usa; hay una gráfica sin series en DATA: VENTAS; las etiquetas trimestrales mezclan formatos ("1,801" contra "2201").
21. **`NOW()` y `TODAY()` se presentan como "Última modificación del archivo"** (13/4/2026), pero solo indican la última vez que se recalculó la hoja, no la última edición.
22. **"Vencimiento de Facturas" lista todas las compras sin restar los pagos.** No sirve como antigüedad de CxP y quedó en 2023.

---

## 8. Preguntas abiertas para el negocio

1. ¿"MONTO NETO" siempre incluye IVA, también en ventas S/F y en compras sin factura?
2. ¿Qué significan P13 (25,592,098), P14 (4,501,000 / compras 2024) y H142 (5 % de la utilidad 2026) en ANALISIS?
3. ¿Qué es "Milpillas": planta, bodega o sucursal? ¿La caja chica actual es la pestaña `CajaChica` de C?
4. ¿El prefijo `R` en pedidos significa reparación y `REF` refacción? ¿Quieren separar las ventas de maquinaria de las de refacciones (la hoja `Clasificación` sugiere que sí)?
5. ¿Quieren que el ERP mantenga el criterio "utilidad = ventas − compras" del tablero, o pasar a un estado de resultados por grupo contable sin IVA, como el de CUENTAS?
6. ¿Cómo debe tratar el ERP los movimientos "Sin efectos", los retiros de socios y las cuentas "NO FISCAL" (visibilidad, permisos, reportes separados)?

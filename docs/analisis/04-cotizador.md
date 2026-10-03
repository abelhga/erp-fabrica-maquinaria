# 04 — COTIZADOR GENERAL (Google Sheets)

- **ID:** `1q7GcReynay14azuRvWBNzUND5KbMap6dSziqXtt8ZH8` · locale `es_MX` · zona `America/Mexico_City`
- **Creado:** 2019-06-04 · **Última modificación:** 2026-10-02 (archivo vivo) · **Tamaño:** ~222 MB (muchas imágenes incrustadas)
- **Método:** solo lectura. Leí valores y fórmulas (`userEnteredValue`), validaciones, notas, rangos con nombre y protecciones de cada pestaña. De las pestañas grandes leí el principio, el medio y el final, y perfilé las listas completas con un script (duplicados, vacíos y cobertura). Los datos de clientes que aparecen en las plantillas no se copian aquí.

> **Glosario de la casa, imprescindible para el ERP:** "**bruto**" = **sin IVA**; "**neto**" = **con IVA** (×1.16). "Precio de venta **más IVA**" = precio sin IVA al que se le suma el IVA. "Equipo" = máquina fabricada (ID `E-###`); "componente/refacción/artículo" = ítem numérico de "Componentes 2.0".

---

## 0. Resumen ejecutivo

1. **No hay un registro de cotizaciones.** Cada vendedor tiene 1 a 6 pestañas-plantilla ("Aut XX", "PM XX", "S1…S5") que **reescribe en cada cotización** y exporta a PDF. El libro no guarda un historial: lo único que queda es la última cotización de cada pestaña (≈30 instantáneas). El historial real está en los PDF que se mandaron.
2. **Casi todo es manual:** el folio (sin consecutivo central), el cliente ("En atención a", texto libre que no está ligado a la lista de clientes), el tipo de cambio (celda oculta, escrita a mano), la leyenda de promoción y casi siempre las notas. **Ninguna plantilla tiene fecha de emisión**, aunque la vigencia dice "a partir de su emisión".
3. **Precios:** `PreciosGeneral` une por IMPORTRANGE la lista de equipos (Nuevo Costeo `EQUIPOS!W` = "Precio de lista bruto (sin iva)") y la de componentes (Componentes 2.0 `ListaComponentes!F` = "Precio de venta sugerido (antes de iva)"). La une en una sola lista ordenada por **nombre** (`ListaGeneral`), y de ella salen los menús de las plantillas. **La llave de búsqueda es el nombre, no el ID.**
4. **Reglas fijas en las fórmulas:** IVA 16 % (`*0.16`, `*1.16`); descuento = un % para toda la cotización; meses sin intereses con la tabla `DiferirAMeses`; precio mínimo de componentes = `((neto/1.16)*0.7/(1-0.23))*1.16` (≈ −9.1 %); envío gratis si el neto es ≥ $5,000 y el artículo no es banda ni cangilón.
5. **`precio_articulos` y `precio_equipos`** son tablas planas en snake_case pensadas para que las lea una app. El repositorio `quick-bid-maker` trae un Apps Script que sincroniza `precio_articulos` → Supabase, pero **el orden de columnas que espera ya no coincide** con el de la hoja (ver §7).
6. **Dependencias frágiles:** el complemento "GPT for Sheets" (`GPT()`, `GPT_LIST()`) se quedó **sin créditos** (`[GPT ERROR] No credits left`); `Ficha Técnica` está rota (`#REF!`); hay rangos con nombre que se cortan antes de que acabe la lista.

---

## 1. Pestañas: propósito, filas reales y si siguen en uso

Leyenda de estado: **VIVA** = la usan hoy (folios recientes o fórmulas sanas) · **SEMI** = existe pero está desactualizada o rota en parte · **MUERTA** = oculta, rota o vacía.

| Pestaña | Cuadrícula | Filas reales (est.) | Propósito | Estado y evidencia |
|---|---|---|---|---|
| **BUSCADOR** | 2682×26 | ~25 (A1:V25) | Consulta rápida: precio, stock, proveedor y fecha de un componente; precio de un equipo; mensualidades; envío gratis; precios para MercadoLibre y Amazon; ficha del cliente (CRM). Protegida: solo se editan las celdas de entrada. | VIVA (último precio leído 7/4/2026). La celda de IA del cliente marca error de créditos. |
| RecuperdadorDeClientes (oculta) | 1003×22 | ~26 | Con GPT arma mensajes de WhatsApp para recuperar clientes que atendía Víctor Padilla, o clientes en general, y genera ligas `api.whatsapp.com` con los teléfonos que da BUSCADOR. Tiene la lista `NombreAgentes2`. | SEMI (depende de GPT sin créditos). |
| **Aut IH** | 973×23 | ~50 | Plantilla automática (precio y descripción por fórmula) de **Isaac Hernández**. Protegida ("Hoja Isaac"). | VIVA (folio 4619, el más alto que vi). |
| **ListaDeDescripciones** | 3688×25 | **~797** (filas 4–800) | Catálogo "comercial": clasificación, ID, nombre comercial, descripción con viñetas, precio bruto (fórmula), **imagen dentro de la celda**, notas, tiempo estándar, título y descripción en **inglés**. Da el rango `TituloEquipos`. | VIVA (de aquí salen las descripciones e imágenes de las plantillas). |
| Aut AH | 973×23 | ~50 | Plantilla de Abel Hernández G. | VIVA (folio "234-26"). |
| Aut EH | 973×23 | ~50 | Plantilla que fue de Elizabeth Hernández; **hoy la usa Abel** (iniciales A-H). Variante que busca en `TituloEquipos`/`ListaDeDescripciones`. | SEMI (folio "107-25", de 2025; precio sobrescrito, total $0). |
| PM | 991×23 | ~70 | "PM" = plantilla de precios **manuales** (valores pegados, 18 partidas). Isaac. | VIVA (folio 4617). |
| Aut Componentes AH | 1002×22 | ~65 | Plantilla de **componentes**: una fila por artículo, sin imagen ni descripción, ~40 renglones. Hoy la usa Isaac. | VIVA, aunque con `#N/A` y validación `=#REF!` en las primeras filas. |
| PM2 | 989×23 | ~70 | Segunda plantilla manual de Isaac. | VIVA (folio 4602). |
| IHG M | 987×23 | ~70 | Plantilla manual de Isaac ("Hoja Isaac M", protegida). Tiene un ejemplo de descripción generada con GPT. | VIVA. |
| Copia de IHG M | 987×23 | ~70 | Copia de la anterior (servicio de automatización con secciones). | VIVA. |
| Aut JM | 973×23 | ~60 | Plantilla de **Juan Manuel Ramírez** ("Asesor de ventas"). | VIVA (folio 2325). |
| PM JM / PM JM1 / PM JM2 | ~980×23 | ~60 c/u | Plantillas manuales de Juan Manuel. | VIVAS (folios 2325, 2239, 2205). |
| JM Aut Componentes | 997×22 | ~65 | Plantilla de componentes de Juan Manuel. Trae un servicio grande y su esquema de pago **escritos como si fueran partidas**. | VIVA (folio "100-1"). |
| **Aut JA** | 974×20 | ~52 | Plantilla de **"Junior, A. Hernández"** (Abel Jr.). Es la **versión más pulida**: columna "Con descuento", leyenda "-Descuento distribuidor/a", mensualidad protegida contra "No aplica". | VIVA (folio 720; promoción "REMATE… 30 de septiembre"). |
| Aut JA 2 | 974×20 | ~52 | Segunda plantilla de JA. | VIVA (folio 699). |
| Aut SR | 983×23 | ~70 | Plantilla de **Susana Rizo**. Pone **varias opciones sin cantidad** (cuentan $0) y deja el folio con prefijo "F" y año. | VIVA (folio "F 2250-26"). |
| Aut Componentes SR | 1002×22 | ~65 | Plantilla de componentes; hoy la usa Isaac. | VIVA (folio 2718). |
| PML | 973×23 | ~60 | Plantilla **co-marca**: otro logo en A1 y "Powered by: [logo Hegamex]"; no lleva razón social. Es de JA. | VIVA (folio 703). |
| Aut VP (oculta) | 973×23 | ~50 | Plantilla de Víctor Padilla, que ya no trabaja en la empresa. | MUERTA (vacía, folio 1585). |
| VIC1 (oculta) | 1011×31 | ~60 | Formato viejo de Víctor (folio "F-734"). Una nota dice que el logo limpia la hoja con un script. | MUERTA. |
| PML-2 | 973×23 | ~60 | Plantilla co-marca de JA, esta sí con razón social. | VIVA (folio 624). |
| **Invoice** | 999×28 | ~30 | Factura comercial de **exportación** en inglés, llenada a mano (sin fórmulas). | SEMI (última, 15-08-2025). |
| **Packing List** | 999×26 | ~30 | Lista de empaque de exportación, a mano. | SEMI (acompaña a esa factura). |
| **Clientes** (oculta) | 2998×31 | **2,258 nombres** (A2:A2259) | Solo los **nombres** de 'Clientes-Contacto Unified' (CRM), traídos por IMPORTRANGE; alimenta el menú del BUSCADOR. La columna I es un `SORT` sobrante. | VIVA (como lista para el menú). |
| PM IVA inc | 974×23 | ~50 | Plantilla manual con **precios netos (IVA incluido)**: "Precio Unitario Neto", "TOTAL NETO", sin renglón de IVA. Usada en USD para un cliente extranjero. | VIVA (folio "632-B"). |
| S1 … S5 | ~1000×23 | ~70 c/u | Cinco plantillas de **Susana Rizo**. Precios a mano, menú `TituloEquipos`, muchas opciones. | VIVAS (folios F 2263-26, 2243-26, 2199-26, 2258-26, 2264-26). |
| Copia de VP (oculta) | 1000×29 | ~60 | Formato viejo de Víctor, con descuento 3 % y columna "Con descuento". | MUERTA. |
| PROMPT | 1000×26 | 1 | Indicación (`B3`, "default") que usa `GPT()` para "mejorar la descripción" cuando la cantidad es "-". | SEMI (GPT sin créditos). |
| Manual con Imagenes (oculta) | 981×23 | ~50 | Formato viejo de Elizabeth (folio 3602), con protección parcial. | MUERTA. |
| **precio_articulos** | 6638×30 | **~4,074** (ítems 0–4977) + IDs reservados vacíos | Tabla plana de **componentes** para una API/app: id, nombre, unidad, tiempo_entrega, precio_bruto, precio_neto, fecha_ultimo_precio, descripción, stock, imagen_url. | VIVA (último precio 2/10/2026). |
| **precio_equipos** | 4175×28 | **~481 con nombre** (988 IDs) | Tabla plana de **equipos**: id, nombre, tiempo_entrega (vacío), precio_bruto, precio_neto, descripción, stock (vacío), imagen_url. | VIVA. |
| Generador de Links | 1000×26 | 0 | Vacía. | MUERTA. |
| **PreciosGeneral** | 16490×33 | Equipos A4:E488 (**482**), componentes H4:L4076 (**4,073**), lista unida N4:Q4558 (**4,555**) | **Corazón de precios**: importa las dos fuentes y las une ordenadas por nombre. Protegida. | VIVA. |
| **DiferirAMeses** | 1000×24 | 13 | Tabla de comisiones para meses sin intereses (3/6/9/12/18/24). | VIVA. |
| Ficha Técnica (oculta) | 1012×26 | ~40 | Ficha técnica con plantilla de texto; todas sus búsquedas dan `#REF!` porque se borró la hoja 'Datos Tecnicos'. | MUERTA (rota). |
| **PoliticaDePago** | 1003×26 | ~139 | Catálogos: política de pago, descuentos, tiempos de entrega, notas, vigencias, moneda, tipo. Protegida. | VIVA. |
| **Agentes de ventas** | 1000×26 | 12 | Lista `NombreAgentesVentas` (9 nombres). Protegida. | VIVA. |

### Plantillas por vendedor: las iniciales salen de una fórmula

Las iniciales del nombre de cada pestaña coinciden con `F7 =LEFT(C5,1)` y `G7 =MID(C5,FIND(" ",C5,1)+1,1)`: primera letra del nombre del agente y primera letra después del primer espacio. Por eso "Junior, A. Hernández" da **J-A**.

| Iniciales | Agente (como aparece) | Pestañas | En "Agentes de ventas" | Nota |
|---|---|---|---|---|
| AH | Abel Hernández G | Aut AH (y hoy Aut EH) | Sí | Aparece entre los editores con más permisos. |
| EH | Elizabeth Hernández | Aut EH (origen), Manual con Imagenes | Sí | Su plantilla la usa hoy Abel. |
| JA | Junior, A. Hernández (Abel Jr.) | Aut JA, Aut JA 2, PML, PML-2, PM IVA inc | Sí | Es la cuenta dueña de casi todas las protecciones (BUSCADOR, PoliticaDePago, Agentes): funge de administrador del cotizador. |
| IH | Isaac Hernández | Aut IH, IHG M, Copia de IHG M, PM, PM2 (y hoy Aut Componentes AH/SR) | Sí | Vendedor con más volumen (folio ~4619). |
| SR | Susana Rizo | Aut SR, S1–S5 | Sí | Folios "F nnnn-26". |
| JM | Juan Manuel Ramírez | Aut JM, PM JM, PM JM1, PM JM2, JM Aut Componentes | **No** | Está en `NombreAgentes2` como "Manuel Ramírez" y en el CRM como propietario "J. Manuel". Firma como "Asesor de ventas". |
| VP | Víctor Padilla | Aut VP, VIC1, Copia de VP (ocultas) | Sí (desactualizado) | Ya no trabaja aquí; según el prompt de RecuperadorDeClientes "se fue con la competencia". |
| — | César Pinto, Francisco Prado, Alondra Guzmán | (ninguna pestaña propia) | Sí | Seguramente usan las plantillas de otros o ya no cotizan. |

> Las pestañas **no dicen bien de quién son**: Aut EH la usa Abel; Aut Componentes AH y SR las usa Isaac. El dueño real está en `C5` (agente) y en las iniciales del folio.

---

## 2. Columnas de las pestañas importantes

### 2.1 PreciosGeneral (protegida; filas de datos desde la 4, encabezados en la 3)

| Col | Encabezado (fila 3) | Tipo | Ejemplo | Significado | Origen |
|---|---|---|---|---|---|
| A | ID | texto | `E-315` | ID del equipo | `IMPORTRANGE(NuevoCosteo,"EQUIPOS!A2:A")` |
| B | Título del Equipo | texto | `Banda cargadora de 18" x 13 metros con levante y cable` | Nombre que muestra el cotizador (rango `EquiposCosteo` = B4:B2091) | `EQUIPOS!B2:B` |
| C | ID | texto | `E-315` | Repite A (para buscar el ID a partir del título) | `EQUIPOS!A2:A` |
| D | Precio de lista bruto (sin iva) | moneda | `$202,000.00` | Precio de lista sin IVA | `EQUIPOS!W2:W` |
| E | Descripcion | texto largo | `• Tipo Cargadora…` | Viñetas técnicas | `EQUIPOS!G2:G` |
| H | Componente | texto | `Cordon grafitado 1/2` | Nombre del componente (rango `Refacciones` = H4:H3986) | `IMPORTRANGE(Componentes2.0,"ListaComponentes!A2:A")` |
| I | Número de Ítem | número | `1` … `4977` | ID del componente | `ListaComponentes!D2:D` |
| J | Precio de venta sugerido (antes de iva) | moneda | `$417.14` | Precio sin IVA | `ListaComponentes!F2:F` |
| K | DESCRIPCIÓN (Cuidar ortografía y redacción) | texto | viñetas | Solo ~395 de 4,073 tienen | `ListaComponentes!J2:J` |
| L | IMAGEN | imagen | (imagen dentro de la celda) | Foto | `ListaComponentes!O2:O` |
| N | Producto/Equipo | texto | `Zapata sencilla` | **Lista unida y ordenada** (`ListaGeneral` = N4:N16490) | `=SORT({B4:E2000;H4:K},1,TRUE)` |
| O | ID | texto/num | `4,697` o `E-123` | ID (rango `ID` = O4:O3986) | sale del SORT |
| P | Precio | moneda | `$1,142.86` | Precio **sin IVA** | sale del SORT |
| Q | Descripcion | texto | | Descripción | sale del SORT |
| R | (sin encabezado) | texto | | `=ARRAYFORMULA(N4:N)`, copia de N | fórmula |

Filas que sí son datos: A4 `E-000 BASE (NO BORRAR)`; **482 equipos con título** (A4:A488, con 2 filas vacías). Después vienen ~507 IDs reservados (`E-335`…`E-998`) **sin título**, que ensucian la lista unida. Hay **4,073 componentes** (H4:H4076; ítems 0–4977, con huecos).

### 2.2 precio_articulos (exportación plana de componentes)

| Col | Encabezado | Tipo | Ejemplo | Origen |
|---|---|---|---|---|
| A | id | entero | `2` | `IMPORTRANGE(…,"ListaComponentes!D3:D")` |
| B | nombre | texto | `Banda grip top 2 capas 20" de ancho` | `ListaComponentes!A3:B` (llena B y C) |
| C | unidad | texto | `pieza`, `metro`, `tramo`, `Caja` | (la columna B de origen) |
| D | tiempo_entrega | entero (días hábiles) | `7` | `ListaComponentes!I3:I` (plazo del proveedor) |
| E | precio_bruto | moneda | `$542.86` | `ListaComponentes!F3:F` |
| F | precio_neto | moneda | `$629.71` | `=ARRAYFORMULA( IF(B2="","", E2:E*1.16))` (ver el error en §7) |
| G | fecha_ultimo_precio | fecha d/m/aaaa | `23/4/2026` | `ListaComponentes!G3:G` |
| H | descripción | texto | viñetas | `ListaComponentes!J3:J` |
| I | stock | decimal | `68.50` | `ARRAYFORMULA(IFERROR(VLOOKUP(B2:B, IMPORTRANGE(…,"ListaComponentesAlmacen!A3:C"),2,0),0))`, es decir, existencia **buscada por nombre** |
| J | imagen_url | URL | `https://static.wixstatic.com/…png` o `lh3.googleusercontent.com/d/…` | `ListaComponentes!M3:M` ("Link Convertido") |

### 2.3 precio_equipos (exportación plana de equipos)

| Col | Encabezado | Ejemplo | Origen |
|---|---|---|---|
| A | id | `E-315` | `IMPORTRANGE(NuevoCosteo,"EQUIPOS!A4:B")` (llena A y B) |
| B | nombre | `Banda cargadora de 18" x 13 metros…` | (la B de origen) |
| C | tiempo_entrega | *(vacía en todas)* | — |
| D | precio_bruto | `$202,000.00` | `EQUIPOS!W4:W` |
| E | precio_neto | `$234,320.00` | `=ARRAYFORMULA( IF(B2:B="","", D2:D*1.16))` |
| F | descripción | viñetas | `EQUIPOS!G4:G` (436 de 481 la tienen) |
| G | stock | *(vacía)* | — |
| H | imagen_url | `https://static.wixstatic.com/…` | `EQUIPOS!AG4:AG` (solo 70 de 481) |

Precio bruto de los equipos: mínimo $1,300, mediana $184,000, máximo $3,871,000. Hay 7 equipos con nombre pero sin precio.

### 2.4 ListaDeDescripciones (encabezados en la fila 3, datos de la 4 a la 800; protegida)

| Col | Encabezado | Tipo | Ejemplo | Significado | Captura |
|---|---|---|---|---|---|
| A | Clasificación | texto (categoría libre) | `BANDA CARGADORA`, `HELICOIDAL`, `REFACCIÓN`, `METRO DE BANDA`, `FLETE`, `SERVICIO` | Familia o categoría | manual |
| B | ID | texto o número | `E-087`, `2`, `4821` | Liga al ID de equipo o componente; ~70 filas no lo tienen | manual |
| C | Nombre | texto | `BANDA GRANELERA 10" X 12 METROS` | Título comercial (rango `TituloEquipos` = C4:C3688) | manual |
| D | Descripción | texto largo | `• Fabricada en…` | Viñetas para la cotización | manual |
| E | Precio Bruto (NO PONER MANUALMENTE) | moneda | ` $ 542.86 ` | `=IF(B4="","",VLOOKUP(B4,PreciosGeneral!$O$4:$P,2,0))` | fórmula |
| F | IMAGEN | imagen dentro de la celda | — | Foto que sale en la cotización | manual |
| G | NOTAS | texto | `SI TIENE 5, MISMO PRECIO` | Nota interna | manual |
| H | VINCULADO A | texto | (casi vacío) | — | manual |
| I | Tiempo estándar de entrega (días hab) | número | (casi vacío) | — | manual |
| J | Title | texto (inglés) | `Dosificadora ZEUS 30 con 4 tolvas fija` | Nombre corto o en inglés | manual |
| K | Description | texto (inglés) | `BULK TROUGH BELT CONVEYOR 39 FT…` | Descripción en inglés (escasa) | manual |

En la fila 1 hay una fórmula `GPT("Corrige puntuación…")`. La fila 2 es un mini-buscador: en `E2` se escribe el nombre y `F2 =VLOOKUP(E2,PreciosGeneral!N4:R,2,0)` devuelve el ID. Avisos en la hoja: "Si no aparece el equipo es porque no se ha costeado" y "'Error en el costeo'… se modificó el nombre de algún componente".

### 2.5 Clientes (oculta)

| Col | Contenido | Origen |
|---|---|---|
| A (A2:A2259) | Nombre "Empresa / Contacto" (mezcla de personas y razones sociales; rango `Clientes` = A2:A2998) | `=IMPORTRANGE("1bMPe8wR…","'Clientes-Contacto Unified'!A2:A")` |
| I | `=SORT({A3:C1999;E3:G1999},1,TRUE)`, que es un residuo (B, C, E, F y G están vacías) | fórmula |

Perfil: 2,258 nombres, **1,914 únicos** (344 repetidos; por ejemplo un nombre aparece 4 veces), 30 con espacios al principio o al final, ~319 con forma de empresa (S.A., S. de R.L., SPR…), 81 de una sola palabra y 1 "Publico en general" con su RFC genérico.

**Columnas del CRM origen ('Clientes-Contacto Unified', hoja "BASE DE DATOS ACTUAL HEGAMEX")**, deducidas de los `VLOOKUP` del BUSCADOR (la fila 1 del origen está vacía):

| Col origen | # | Uso en el BUSCADOR |
|---|---|---|
| A | 1 | Empresa / Contacto (llave de búsqueda) |
| B | 2 | Teléfono |
| C | 3 | Teléfono 2 |
| D | 4 | Contacto / Empresa (nombre del contacto) |
| E | 5 | Correo del contacto 1 |
| F | 6 | Celular del contacto 1 |
| G | 7 | Nombre del contacto 2 |
| H | 8 | Correo del contacto 2 |
| I | 9 | Celular del contacto 2 |
| J | 10 | Domicilio |
| K | 11 | Ciudad |
| L | 12 | CP |
| M | 13 | Estado |
| N | 14 | País |
| O | 15 | Historial de compras (conceptos separados por "\|", con folios tipo `A1234` y notas de pago); lo usa la IA |
| P | 16 | Propietario (vendedor; por ejemplo "J. Manuel" o "Victor") |

### 2.6 PoliticaDePago (catálogos; protegida; todo en la columna B)

| Rango con nombre | Celdas | Valores |
|---|---|---|
| `PoliticaPago` | B2:B7 | "En una sóla exhibición" · "50% anticipo, 50% al aviso de la entrega." · "60% anticipo, 40% al aviso de la entrega." |
| `Descuentos` | B9:B19 | "Descuento del 10% " (C9 = 10 %) · "Descuento del 5%" · "Descuento del 3%" (**no lo usa ninguna plantilla**) |
| `TiempoDeEntrega` | B22:B101 | "Entrega inmediata." · "1 día hábil tiempo estimado de entrega." · "N días hábiles tiempo estimado de entrega." (2…70) · "Entrega inmediata. (Salvo previa venta)" |
| `Notas` | B105:B115 | Garantía de fabricación por escrito ★★★★★ · No incluye envío (se cotiza según destino) · No incluye instalaciones, calibración ni soporte en destino · No incluye adecuaciones del terreno ni obra civil · Si se exporta no aplica IVA y se paga el Sub-Total · Se aceptan tarjetas de débito y crédito · La mercancía viaja por cuenta y riesgo del comprador · Equipos eléctricos a 220 V, tres fases, salvo indicación · Penalización del 20 % si se cancela después del anticipo (+ liga a términos en hegamex.com) |
| `Vigencia` | B117:B126 | "Vigencia de cotización: 7 / 15 / 30 / 45 / 60 días naturales a partir de su emisión." |
| `moneda` | B129:B134 | "Pesos Mexicanos (MXN)" · "Dólar estadounidense. (USD)" |
| `Tipo` | B138:B143 | "equipo(s)" · "refaccion(es)" (no encontré dónde se usa) |

Las columnas C y D frente a las notas están vacías. Las fórmulas auxiliares de las plantillas (`VLOOKUP(Bxx,PoliticaDePago!$B$105:$D$126,2|3,0)` en F y G) devuelven vacío: son restos muertos.

### 2.7 DiferirAMeses (rango `mesesdiferidos` = F7:F13)

| E "Base: INTERÉS TOTAL" | F (texto del menú) | G Comisión | H IVA | I "Actual: INTERÉS TOTAL" | J meses | K interés/mes | L interés/año |
|---|---|---|---|---|---|---|---|
| 4.69 % | 3 pagos SIN INTERESES de | **0 %** | 16 % | `=(G7+0)*1.16` → 0 % | 3 | `=I7/J7` | `=(I7/J7)*12` |
| 7.69 % | 6 pagos mensuales de | `=E8` | 16 % | `=(G8+0)*1.16` → 8.92 % | 6 | 1.49 % | 17.84 % |
| 11.19 % | 9 pagos mensuales de | `=E9` | 16 % | `=(G9)*1.16` → 12.98 % | 9 | | |
| 12.89 % | 12 pagos mensuales de | `=E10` | 16 % | 14.95 % | 12 | | |
| 19.39 % | 18 pagos mensuales de | `=E11` | 16 % | 22.49 % | 18 | | |
| 27.29 % | 24 pagos mensuales de | `=E12` | 16 % | 31.66 % | 24 | | |
| — | No aplica | 0 | 0 | 0 | "-" | | |

Al lado dice "+ 3.49 % por transacción con tarjeta, absorbido siempre por Hegamex". A 3 meses Hegamex absorbe la comisión base de 4.69 % (por eso es "sin intereses"); de 6 meses en adelante la comisión, más su IVA, la paga el cliente.

### 2.8 Agentes de ventas

B2 "Agentes Activos", B3 "Nombre" y de B4 a B12 (rango `NombreAgentesVentas` = B4:B18): Abel Hernández G · Elizabeth Hernández · Junior, A. Hernández · Víctor Padilla · Susana Rizo · Isaac Hernández · César Pinto · Francisco Prado · Alondra Guzmán. Solo hay nombres; ni teléfonos ni correos. El celular de cada vendedor se escribe a mano en `D5` de su plantilla.
Hay una segunda lista, `NombreAgentes2` (RecuperdadorDeClientes!C21:C26): Abel Hernández · Isaac Hernández · Susana Rizo · Manuel Ramírez.

### 2.9 BUSCADOR: mapa de celdas (un formulario, no una tabla)

Las únicas celdas que se pueden editar son D3, I5, D15, M6:M7, P4:Q4, Q5 y U5; el resto está protegido ("modificar solo celdas en blanco").

| Bloque | Celda | Etiqueta | Fórmula o fuente |
|---|---|---|---|
| Componentes | D3 | Suministro (entrada) | menú `ListaGeneral` |
| | F3 | ID | `VLOOKUP(D3,IMPORTRANGE(…"ListaComponentes!A3:H"),4,0)`; si no está, "No se ha registrado en almacén" |
| | D4 | Proveedor de referencia | ListaComponentes, columna 8 |
| | D5 | Tiempo de entrega estándar del proveedor | ListaComponentes, columna 9 & " días" |
| | D6 | Fecha del último precio | ListaComponentes, columna 7 |
| | D7 / D8 | Precio de venta sin IVA / NETO | `=D8/1.16` / columna 6 ×1.16 |
| | E8 | "precio por <unidad>" | ListaComponentesAlmacen, columna 3 |
| | F8 | Precio Mínimo Neto | ver §4.5 |
| | C9 / D9 | Plazo de meses / mensualidad (IVA incluido) | ver §4.6 |
| | D10 / D11 | ¿Envío gratis? / cantidad mínima | ver §4.5 |
| | D12 / E12 | Stock actual en planta / unidad | ListaComponentesAlmacen, columnas 2 y 3 |
| Equipos | I5 | Equipo (entrada) | menú `EquiposCosteo` |
| | I6 / I7 / I8 | Precio más IVA (= sin IVA) / ID / NETO | `VLOOKUP(I5,PreciosGeneral!B4:D,3,0)` / `,2,0)` / `=I6*1.16` |
| | H10 / I10 | Plazo / mensualidad | (I10 revisa `C9` por error) |
| | I9 | Stock actual | "pendiente" (a mano) |
| Marketplaces | M2:V12 | ML, ML mínimo, AMZ, AMZ mínimo | ver §4.7 |
| Clientes | D15 | Empresa / Contacto (entrada) | menú `Clientes` (estricto) |
| | F15 | Propietario de Cliente | CRM, columna 16 ("Sin propietario (por ahora)" / "(anteriormente de Victor)") |
| | D16/F16, D17/F17, D18/F18, D19/F19 | Teléfono 1/2, Contacto 1/2, Celular 1/2, Correo 1/2 | CRM, columnas 2/3, 4/7, 6/9, 5/8 ("Privado" si tiene dueño) |
| | D20, D21/F21, D22/F22 | Domicilio, Ciudad/Estado, CP/País | CRM, columnas 10, 11/13, 12/14 |
| | D23 | ¿Qué ha adquirido? (IA) | `gpt(…, VLOOKUP(D15,…,15))` |

### 2.10 Invoice y Packing List (exportación; todo a mano)

- **Invoice:** A3 "INVOICE" · E3 número (`A-2843`) · G3/H3 "DATE:" + fecha en texto (`15 - 08 - 2025`) · A5 "ISSUER:" con razón social, TAX ID (RFC), domicilio, correo del vendedor y teléfono de la empresa · F5 "TO:" con nombre, TAX ID (NIT), domicilio y teléfono del cliente extranjero · fila 9: **QUANTITY | NAME | SERIAL NUMBER | HS | DESCRIPTION (EN + ES) | UNIT PRICE ($) | AMOUNT ($)** · H12 "TOTAL (EXW)" (número a mano) · "INCOTERM: EXW" · "1. Country of Origin: MEXICO 2. Payment: 50% T/T in advance, 50% T/T Before shipping." · pie con teléfono, web y correo de atención a clientes.
- **Packing List:** mismos bloques ISSUER/TO · "INVOICE:" + número · fila 9: **MODEL | NAME | SERIAL NUMBER | PACKAGES | NET WEIGHT (KGS) | GROSS WEIGHT (KGS) | DIMENSION (CM)** · fila TOTAL (bultos y pesos) · "TERMS: EXW".

---

## 3. El formato de la cotización y cómo trabaja el vendedor

### 3.1 La plantilla "Aut" canónica (Aut IH, Aut AH, Aut JA…; columnas A–H)

| Fila(s) | Celdas | Contenido | Cómo se llena |
|---|---|---|---|
| 1–2 | A1:C1 (combinada) · E1:G3 | **Logo Hegamex** (imagen) · segunda imagen o banner | fijo |
| 3 | A3:D3 | "Máquinas y Herramientas Gamex S.A. de C.V. \| RFC: MHG160202UX1" (en PM IVA inc: "TAX ID") | fijo |
| 4 | A4 | Domicilio: Carretera Atotonilco–La Barca 151, Crucero Milpillas, 47775, Atotonilco el Alto, Jal. | fijo |
| 5 | A5 "Agente de ventas:" (JM: "Asesor de ventas:") · **C5** · D5 | C5 = nombre del agente (menú `NombreAgentesVentas`, nota "Seleccione su nombre", validación **no estricta**) · D5 = "Cel. ##########" (texto a mano) | menú + texto |
| 7 | A7 "En atención a:" · **C7** · D7 "COTIZACIÓN" · **E7** · F7 · G7 | C7 = persona o empresa (**texto libre**, no ligado a `Clientes`) · E7 = **folio a mano** (texto) · F7/G7 = iniciales del agente por fórmula (blanco sobre gris oscuro) | texto + fórmula |
| 8 | A8 (nota "Empresa") | Segunda línea opcional con la empresa (en S1 va en A6) | texto |
| 10 | B "Cantidad" · C "Artículo y Descripción" · D "Precio unitario" · E "Precio" · G `=IF($E$30="","","Con descuento")` | encabezado de la tabla | fijo |
| 11–28 | **9 partidas de 2 filas** | Fila impar: B cantidad · C artículo (menú `ListaGeneral`) · D precio unitario (fórmula) · E importe · G importe con descuento. Fila par: C **descripción** (fórmula, o GPT si B = "-") · D:E **imagen** (fórmula) | menú + fórmulas |
| 30 | D30 "-Descuento en equipos participantes:" (JA: "-Descuento distribuidor/a:") · **E30** | % de descuento (nota "Inserta aquí el porcentaje de descuento", en rojo) | número a mano |
| 31 | D "Sub-Total" · E31 · F31 | `=SUM(E11:E28)` · subtotal con descuento | fórmula |
| 32 | **B32** · D "IVA" · E32 · F32 | B32 = **tipo de cambio** (nota "¿A cuánto está el tipo de cambio?", **blanco sobre blanco**, oculto); vi 16, 17.8, 18, 19 y 21 · `=E31*0.16` | número a mano |
| 33 | B "Moneda:" · **C33** · D "TOTAL" · E33 · F33 | menú `moneda` · `=E31+E32` | menú |
| 34 | B "Pago:" · **C34** · G34 | menú `PoliticaPago` · G34 = monto del descuento con IVA (en rojo) | menú |
| 35 | **B35** · G35 | Tiempo de entrega (menú `TiempoDeEntrega`, a menudo texto libre) · leyenda de la promoción a mano y en rojo ("de descuento ya aplicado por el FLASH SALE / BUEN FIN / REMATE. Válido hasta…") | menú/texto |
| 36 | B "Notas:" | | fijo |
| 37–43 | **B37** + B38:B43 (combinadas B:E) | B37 = vigencia (menú `Vigencia`); de B38 a B43 = notas (menú `Notas`, **no estricto**: se escriben notas nuevas) | menú/texto |
| 46 | C46 | "¡Puedes diferir en hasta 24 meses el total o una parte con cualquier tarjeta de crédito!*" | fijo |
| 47 | **C47** · D47 | plazo (menú `mesesdiferidos`) · mensualidad (fórmula) | menú |
| 48 | C48 | imagen (seguramente los logos de pago) | fijo |
| 49–50 | C49, C50 | "*Solicítalo con anticipación… Opciones a 3, 6, 9, 12, 18 y 24 meses." (JA agrega "*No aplica con descuentos.") · "*El monto máximo a diferir por transacción es de $350,000 MXN…" | fijo |

**Lo que el documento no trae:** fecha de emisión, fecha de vencimiento, RFC o datos fiscales del cliente, correo o teléfono del cliente, firma, cuentas bancarias (**no hay datos bancarios en ninguna plantilla**), unidad de medida por partida, número de partida, ni el texto completo de los términos (solo la liga a hegamex.com/terminos-y-condiciones).

### 3.2 Variantes de plantilla

| Variante | Pestañas | Qué cambia |
|---|---|---|
| **Aut (equipos)** | Aut IH, Aut AH, Aut JA, Aut JA 2, Aut SR, Aut JM, Aut VP, PML, PML-2 | Precio y descripción por fórmula desde `PreciosGeneral`; 9 partidas de 2 filas. |
| **Aut con ListaDeDescripciones** | Aut EH (y una partida de Aut JA) | Menú `TituloEquipos`; precio `VLOOKUP(C,ListaDeDescripciones!$C$4:E,3,0)`; descripción `…$C$4:D,2`; imagen `…$C$4:F,4`. |
| **Componentes** | Aut Componentes AH, Aut Componentes SR, JM Aut Componentes | Una fila por artículo (~40), sin descripción ni imagen, cantidades con decimales; totales en las filas 58–62, TC en B60. |
| **PM (manual)** | PM, PM2, IHG M, Copia de IHG M, PM JM, PM JM1, PM JM2, S1–S5 | Mismo esqueleto, pero precios y descripciones **pegados como valores**; hasta 18 partidas (filas 10–45). Susana lista **alternativas sin cantidad** (importe vacío, no suman) y marca con cantidad 1 la que se elige. |
| **IVA incluido** | PM IVA inc | "Precio Unitario Neto" · "TOTAL NETO" `=SUM(E12:E29)` · sin renglón de IVA · la etiqueta "USD" escrita a mano. |
| **Co-marca** | PML, PML-2, PM IVA inc | Logo de otra marca en A1 + "Powered by:" con el logo de Hegamex. |
| **Formato viejo** | VIC1, Copia de VP, Manual con Imagenes (ocultas) | Datos fiscales en B2–B4, agente en E4, folio en E6 (con prefijo "F-" o "D-"). Una nota dice que se limpia "dando clic en el logo de HEGAMEX" (script en la imagen). |

### 3.3 Cómo cotiza un vendedor hoy (reconstruido)

1. **Busca** (opcional) en **BUSCADOR**:
   - Componente: elige en `D3` (menú `ListaGeneral`) y ve ID, proveedor de referencia, tiempo del proveedor, fecha del último precio, precio sin y con IVA, unidad ("precio por kit"), **precio mínimo neto** para promociones o clientes frecuentes, la mensualidad del plazo que elija, si aplica envío gratis y desde qué cantidad, y el **stock en planta**. Al lado ve los precios para **MercadoLibre** (Clásica 12 %, Premium 16.5 %) y **Amazon**, sueltos o por paquete, con o sin envío.
   - Equipo: elige en `I5` (menú `EquiposCosteo`) y ve precio sin IVA, ID, precio neto y mensualidad. El stock de equipos dice "pendiente".
   - Cliente: elige en `D15` (menú `Clientes`, estricto) y ve el propietario. Si el cliente **ya tiene dueño**, los teléfonos, correos y domicilio salen como "**Privado**"; solo se muestran si no tiene dueño o si era de Víctor. Además ve un resumen con IA de lo que ha comprado (hoy da error de créditos).
2. **Abre su pestaña** (Aut XX si el artículo está en el catálogo; PM XX o S# si va a pegar precios y textos a mano; "Componentes" si son muchas refacciones) y **pisa la cotización anterior**.
3. Elige su nombre en `C5` y escribe a mano celular, cliente (`C7`), empresa (`A8`) y **el siguiente folio** (`E7`, de su propio contador).
4. Por cada partida: cantidad en B y artículo en C (menú con ~4,555 nombres, ordenados alfabéticamente). Precio, descripción e imagen se llenan solos. Si escribe "-" en la cantidad de la fila de descripción, GPT reescribe la descripción. Si el artículo no está en el catálogo, escribe a mano y **pisa las fórmulas**.
5. Si hace falta: % de descuento (`E30`) y su leyenda en rojo (`G35`); moneda USD + tipo de cambio en la celda oculta `B32`.
6. Elige política de pago, tiempo de entrega, vigencia, notas (o las escribe) y el plazo de meses sin intereses para enseñar la mensualidad.
7. Exporta o imprime a **PDF** y lo manda (WhatsApp o correo). El libro no guarda nada más: no hay registro, estado ni seguimiento de la cotización.
8. Si se exporta: llena **Invoice** y **Packing List** a mano (número de factura, fecha, bloque emisor/receptor con Tax ID, partidas con número de serie, HS, descripción bilingüe, Incoterm EXW, origen MEXICO, pago 50 % T/T por adelantado y 50 % antes del embarque; pesos y dimensiones en el packing).

### 3.4 Folio y numeración
- Es **manual y por vendedor**, sin control central ni validación de duplicados. Formatos vistos: `4619`, `4617`, `4602`, `4205`, `2718`, `1732` (Isaac) · `234-26`, `107-25` (Abel, con sufijo de año) · `720`, `699`, `703`, `624`, `632-B` (JA) · `F 2250-26`, `F 2264-26` (Susana) · `2325`, `2239`, `2205`, `100-1` (Juan Manuel) · `1585`, `F-734`, `D-4727` (Víctor) · `3602` (Elizabeth).
- El folio impreso se compone de `E7` + las iniciales `F7`/`G7`; por ejemplo, "4619 · I · H".
- La factura de exportación usa otra serie: `A-2843`.

---

## 4. Reglas de negocio (fórmulas literales)

### 4.1 Precio unitario en la cotización
```
D11 =IF(C11="","", VLOOKUP(C11,PreciosGeneral!N4:P,3,0)/IF($C$33<>"Pesos Mexicanos (MXN)",$B$32,1))
E11 =IF(B11="","",B11*D11)
```
- El precio base es el **precio de lista sin IVA**: para equipos, `EQUIPOS!W` de Nuevo Costeo; para componentes, `ListaComponentes!F` de Componentes 2.0.
- Se busca **por nombre**, coincidencia exacta. Las filas siguientes desplazan el inicio del rango (`N6:P`, `N8:P`…), lo cual funciona porque la lista está ordenada y la búsqueda es exacta.
- **USD:** precio en MXN ÷ tipo de cambio escrito a mano en `B32`. No hay tipo de cambio de referencia ni fecha. Solo se convierten los precios que vienen por fórmula; los pegados a mano no.
- La lista no maneja **volumen, escalas ni listas por tipo de cliente**. El único "precio por cliente" es el precio mínimo del BUSCADOR, solo para consulta.

### 4.2 Descripción e imagen de la partida
```
C12 =IF(C11="","", IF(B12="-",GPT(PROMPT!$B$3,C11 & VLOOKUP(C11,PreciosGeneral!N4:Q,4,0)),VLOOKUP(C11,PreciosGeneral!N4:Q,4,0)))
D12 =IF(C11="","", VLOOKUP(VLOOKUP(C11,PreciosGeneral!$N$4:O,2,0),ListaDeDescripciones!B4:F,5,0))
```
El nombre lleva al ID; el ID lleva a la imagen de `ListaDeDescripciones!F`. Si en la cantidad de la fila de descripción se escribe "-", la descripción la reescribe GPT con la indicación de `PROMPT!B3`.

### 4.3 IVA y totales
```
E31 Sub-Total =SUM(E11:E28)
E32 IVA       =E31*0.16
E33 TOTAL     =E31+E32
```
- IVA fijo de 16 %. No contempla 8 % de frontera, exento ni exportación; la exportación solo se avisa en una nota ("no aplica el IVA y el monto a pagar será el Sub-Total. (Obligatorio pedimento de exportación)"), así que el total impreso sigue llevando IVA.
- "PM IVA inc": `TOTAL NETO =SUM(E12:E29)` sobre precios que ya traen IVA.
- **No hay redondeos** (`ROUND` no aparece en ninguna fórmula). Los precios de componentes salen con centavos (por ejemplo $6,142.86 = neto ÷ 1.16); los de equipos son cerrados en miles porque así vienen de Nuevo Costeo.

### 4.4 Descuento
```
G11 (Con descuento)  =IF(E11="","",IF($E$30="","",E11*(1-$E$30)))
F31 Sub-Total desc.  =IF(E33="","",IF($E$30="","",E31*(1-$E$30)))
F32 IVA desc.        =IF(E33="","",IF($E$30="","",E32*(1-$E$30)))
F33 TOTAL desc.      =IF(E33="","",IF($E$30="","",E33*(1-$E$30)))
G34 Monto descuento  =(SUM(E11:E28)*1.16)-(SUM(G11:H28)*1.16)
```
- Un solo % (`E30`) para **todas** las partidas, aunque la leyenda dice "equipos participantes". No hay descuento por partida.
- Se imprimen los dos juegos de cifras: el original (columna E) y el descontado (F/G), más el monto descontado con IVA en rojo.
- El catálogo `Descuentos` (10/5/3 %) existe pero no lo usan.
- Las promociones viven solo en el texto libre de `G35` ("FLASH SALE. Válido hasta el 3 de junio", "BUEN FIN", "REMATE. Válido hasta el 30 de Septiembre"). No tienen fecha de inicio ni de fin que el sistema controle.

### 4.5 Precio mínimo y envío gratis (BUSCADOR, componentes)
```
D8 Precio NETO          =IFERROR(IF(D3="","",VLOOKUP(D3,IMPORTRANGE("1yMB2…","ListaComponentes!A3:H"),6,0)*1.16),"Error")
D7 Precio sin IVA       =D8/1.16
F8 Precio Mínimo Neto   =(((D8/1.16)*0.7)/(1-0.23))*1.16      ' "Para promociones o clientes muy frecuentes"
D10 ¿Envío gratis?      =IF( AND(REGEXMATCH(LOWER(D3),".*banda.*")=FALSE, REGEXMATCH(LOWER(D3),".*cangilon.*")=FALSE, D8>=5000), "Puede Aplicar Envío Gratis","No")
D11 Cant. mínima envío  =IF(OR(REGEXMATCH(LOWER(D3),".*banda.*")=TRUE,REGEXMATCH(LOWER(D3),".*tapco.*")=TRUE),"No aplica", ROUNDUP(IF(D10="No",5000/D8,"1")))
```
- La fórmula supone que el **costo es el 70 % del precio sin IVA** (en Componentes 2.0 el precio sugerido es costo ÷ 0.7; por ejemplo $735 → $1,050) y que el piso es un **margen de 23 %**. En la práctica, el precio mínimo es el neto × 0.9091 (unos 9.1 % de descuento como máximo).
- Envío gratis: neto ≥ **$5,000 MXN**, sin bandas, cangilones ni Tapco; la paquetería la elige Hegamex. "En promoción no aplica meses ni envío gratis."

### 4.6 Meses sin intereses (diferir a meses)
```
Plantilla:  D47 =IF(C47="","",((E33/( 1-VLOOKUP(C47,DiferirAMeses!F7:I13,4,0)))/VLOOKUP(C47,DiferirAMeses!F7:J13,5,0)))
Aut JA:     D48 =IF(OR(C48="",C48="No aplica"),"",((E33/( 1-VLOOKUP(C48,DiferirAMeses!F7:J13,4,0)))/VLOOKUP(C48,DiferirAMeses!F7:J13,5,0)))
BUSCADOR:   D9  =IF(C9="","",((1+VLOOKUP(C9,DiferirAMeses!F7:J12,4,0))*D8)/VLOOKUP(C9,DiferirAMeses!F7:J12,5,0))
```
- En la plantilla, la mensualidad es TOTAL ÷ (1 − tasa con IVA) ÷ meses: se infla el total para que, después de la comisión, Hegamex reciba el total completo. Ejemplo comprobado: $94,772 a 24 meses da 94,772/(1−0.316564)/24 = $5,777.91.
- **El BUSCADOR usa otra fórmula**, (1 + tasa) × precio ÷ meses, y da mensualidades más bajas. Hay que unificar.
- La mensualidad se calcula sobre el **total sin descuento** (E33); por eso JA aclara "No aplica con descuentos". Tope de **$350,000 MXN por transacción** (solo como texto).

### 4.7 Precios para marketplaces (BUSCADOR, columnas M–V)
```
M6 Clásica = 12% ; M7 Premium = 16.5%   (editables)
P4 envío indiv = 110 ; Q4 envío paquete = 190 ; O5 = 20 pzas/paquete s/env ; Q5 = 24 pzas/paquete c/env
N6 ML indiv s/env     =IF((D7/(1-M6)*1.16)<299,((D7/(1-M6))+37)*1.16,((D7/(1-M6)*1.16)))
P6 ML indiv c/env     =IF(((D7/(1-M6)+P4)*1.16)<299,(((D7/(1-M6))+P4+37)*1.16),(((D7/(1-M6))+P4)*1.16))
T6 ML mínimo indiv    =IF((F8/(1-M6))<299,((F8/(1-M6))+25),((F8/(1-M6))))
N10 AMZ               =15+N6/(1-0.1)        ' Amazon = ML + 10 % de comisión + $15
```
Debajo de $299 se suma la cuota fija de MercadoLibre ($37, o $25 y $30 en otras fórmulas). Esta lógica es de canal en línea; conviene llevarla al ERP como "listas de precio por canal" y no dejarla en el módulo de cotizaciones.

### 4.8 Condiciones comerciales
- **Pago:** contado, 50/50 o 60/40 en el catálogo. A mano aparecieron "30 % anticipo, 70 % al aviso de la entrega" y "60 % anticipo, 20 % en el transcurso y 20 % al finalizar", esta última escrita como partida. Exportación: "50% T/T in advance, 50% T/T before shipping".
- **Tiempo de entrega:** catálogo de días hábiles (0–70) con mucho texto libre ("65-70 días hábiles", "5 días hábiles de trabajo", "2 días hábiles tiempo estimado de envío"). El plazo del proveedor (`ListaComponentes!I`) se ve en el BUSCADOR, pero no llega a la cotización.
- **Vigencia:** 7/15/30/45/60 días naturales "a partir de su emisión", sin que la cotización tenga fecha de emisión.
- **Garantía:** "por escrito" sin plazo, o a mano "(6 meses)" / "6 meses… dentro de la República". En Ficha Técnica se escribía como número de meses.
- **Cancelación:** 20 % de penalización si se cancela después del anticipo.

---

## 5. Conexiones IMPORTRANGE (y otras dependencias externas)

| Destino (en este libro) | Archivo origen | Rango origen | Para qué |
|---|---|---|---|
| PreciosGeneral!A3, C3 | **Nuevo Costeo** `1sFjjiLxpsiFf0zroiv4RSWb4a5zmvCacABNg2bf9y6E` | `EQUIPOS!A2:A` | ID del equipo |
| PreciosGeneral!B3 | Nuevo Costeo | `EQUIPOS!B2:B` | Título |
| PreciosGeneral!D3 | Nuevo Costeo | `EQUIPOS!W2:W` | Precio de lista bruto (sin IVA) |
| PreciosGeneral!E3 | Nuevo Costeo | `EQUIPOS!G2:G` | Descripción |
| precio_equipos!A2 (A:B) | Nuevo Costeo | `EQUIPOS!A4:B` | id y nombre (empieza en la fila 4: se brinca E-000) |
| precio_equipos!D2 | Nuevo Costeo | `EQUIPOS!W4:W` | precio_bruto |
| precio_equipos!F2 | Nuevo Costeo | `EQUIPOS!G4:G` | descripción |
| precio_equipos!H2 | Nuevo Costeo | `EQUIPOS!AG4:AG` | imagen_url ("Link Imagen Convertida") |
| PreciosGeneral!H3 / I3 / J3 / K3 / L3 | **Componentes 2.0** `1yMB2r3KAPPpIBghyd8qzB-dgmpxPiq1fs1lY03smRxw` | `ListaComponentes!A2:A` / `D2:D` / `F2:F` / `J2:J` / `O2:O` | nombre / nº de ítem / precio sugerido sin IVA / descripción / imagen |
| precio_articulos!A2 / B2 (B:C) / D2 / E2 / G2 / H2 / J2 | Componentes 2.0 | `ListaComponentes!D3:D` / `A3:B` / `I3:I` / `F3:F` / `G3:G` / `J3:J` / `M3:M` | id / nombre+unidad / tiempo / precio / fecha / descripción / imagen |
| precio_articulos!I2 | Componentes 2.0 | `ListaComponentesAlmacen!A3:C` (columna 2) | stock (por nombre) |
| BUSCADOR!F3, D4, D5, D6, D8 | Componentes 2.0 | `ListaComponentes!A3:H` (cols 4, 8, 7, 6) y `A3:I` (col 9) | ID, proveedor, fecha, precio, tiempo del proveedor |
| BUSCADOR!E8, E11, D12, E12 | Componentes 2.0 | `ListaComponentesAlmacen!A3:C` (cols 2–3) | stock y unidad |
| Clientes!A2 | **BASE DE DATOS ACTUAL HEGAMEX** `1bMPe8wRcFv66tap2k7qW6MOIDWDYMeng8Mii4ZwAdFs` | `'Clientes-Contacto Unified'!A2:A` | menú de clientes |
| BUSCADOR!F15 … F22, D23 | BASE DE DATOS ACTUAL HEGAMEX | `'Clientes-Contacto Unified'!A2:M` y `A2:P` (cols 2–16) | ficha del cliente, propietario, historial |

Encabezados confirmados en el origen:
- `EQUIPOS` fila 2: ID, Título del Equipo, Inoxidable, GASOLINA, Tipo, ¿Medida especial?, Descripcion, Imagen…, Costo, cargos (Mermas, Luz, Administrativos, Gastos Fin, MKT, Rec. Tarjeta, Comisiones, Rec Garantía, Publicidad), Costo Total, Precio Bruto, **Precio de lista bruto (sin iva)** [W], Precio Neto, utilidades…, Link Imagen Convertida [AG].
- `ListaComponentes` fila 2: Componente, Unidad de medida, cantidad por paquete, **Número de Ítem** [D], Último costo, **Precio de venta sugerido (antes de iva)** [F], Fecha de actualización [G], Proveedor del último precio [H], Tiempo estimado de entrega [I], DESCRIPCIÓN [J], Notas, Imagen (link), Link Convertido [M], Ut. personalizada, IMAGEN [O].
- `ListaComponentesAlmacen` fila 3: Nombre del artículo, STOCK ACTUAL TOTAL DISP, Unidad, Cantidad por paquete, STATUS.

**Otras dependencias:**
- Complemento **GPT for Sheets** (`GPT()`, `GPT_LIST()`, modelos `gpt-4o-mini` y `o3`): sin créditos.
- Un **Apps Script** asignado al logo que limpia la hoja (formatos viejos).
- El script del repositorio `quick-bid-maker/google-apps-script.js`, que con un disparador `onEdit` sincroniza `precio_articulos` con Supabase (`/functions/v1/sync-articulos`).

---

## 6. Entidades propuestas y mapeo para un importador

### 6.1 Entidades

| Entidad | Campos clave | Notas |
|---|---|---|
| **vendedor** | id, nombre, nombre_corto, **serie_folio** (iniciales), celular, email, activo, puede_ver_contactos_de_otros | Las iniciales se calculan como hoy, pero se guardan para no depender del nombre. |
| **cliente** (cuenta) | id, nombre_mostrar, razon_social, rfc/tax_id, tipo (persona/empresa), domicilio, ciudad, estado, cp, pais, **vendedor_propietario_id**, origen | Hoy "Empresa/Contacto" mezcla los dos. Al importar hay que separar persona y empresa y deduplicar. |
| **contacto** | id, cliente_id, nombre, telefono, celular, email, orden (1/2) | El CRM trae 2 contactos aplanados por fila (cols D–I). |
| **producto** | id, **sku** (`E-###` o número de ítem), tipo (equipo/componente/servicio/flete/descuento), nombre, nombre_comercial, clasificacion, descripcion, nombre_en, descripcion_en, unidad, imagen_url, tiempo_entrega_dias, proveedor_ref, activo | Unifica PreciosGeneral, ListaDeDescripciones, precio_articulos y precio_equipos. Llave = **sku**, no nombre. |
| **lista_precios** / **precio** | lista (general, mínimo, ML clásica, ML premium, Amazon), producto_id, moneda, precio_sin_iva, vigente_desde, fuente (costeo/compras) | La lista general hoy se calcula fuera (Nuevo Costeo y Componentes 2.0); el ERP la tomaría del costeo. |
| **cotizacion** | id, **folio** (serie del vendedor + consecutivo + año, generado), vendedor_id, cliente_id, contacto_id, atencion_texto, **fecha_emision**, vigencia_dias, **fecha_vencimiento**, moneda, **tipo_cambio** (+ fecha y fuente), condicion_pago_id (+ texto libre), tiempo_entrega_texto/días, descuento_pct, descuento_leyenda, promocion_id, aplica_iva / tasa_iva (16/8/0 para exportación), subtotal, iva, total, total_con_descuento, msi_plan_id, mensualidad, plantilla (normal / IVA incluido / co-marca + logo), estado (borrador/enviada/aceptada/rechazada/vencida), version, pdf_url | Lo nuevo de verdad: **fecha, estado, historial y folio automático**. |
| **cotizacion_partida** | id, cotizacion_id, orden, producto_id (nulo si es libre), cantidad (decimal), unidad, nombre, descripcion (copiada al momento), imagen_url, precio_unitario (copiado), descuento_pct, importe, **es_opcional/alternativa** | "Opcional" refleja la práctica de Susana: partidas sin cantidad que no suman. |
| **cotizacion_nota** | cotizacion_id, orden, nota_catalogo_id \| texto | Las notas son de catálogo, pero editables. |
| **condicion_pago** | id, nombre, % de anticipo, % contra entrega, texto | Contado, 50/50, 60/40, 30/70… |
| **nota_catalogo**, **vigencia**, **tiempo_entrega** | catálogos | Vienen de PoliticaDePago. |
| **plan_msi** | meses, comision_base, comision_cobrada, iva, absorbe_hegamex, tope_por_transaccion (350,000) | Viene de DiferirAMeses. |
| **promocion** | nombre (FLASH SALE, BUEN FIN, REMATE), %, vigente_desde/hasta, alcance (productos), compatible_msi (no), compatible_envio_gratis (no) | Hoy es solo texto. |
| **documento_exportacion** (invoice / packing) | numero, fecha, cotizacion_id/pedido_id, incoterm, pais_origen, condiciones_pago, emisor, receptor (tax_id, domicilio, teléfono); por partida: modelo, nombre, **número de serie**, HS, descripción EN/ES, precio, bultos, peso neto/bruto, dimensiones | Hoy está todo escrito a mano. |

### 6.2 Mapeo columna → campo (importador)

**Productos (equipos)**, desde `precio_equipos` o `PreciosGeneral!A:E`, mejor directo de Nuevo Costeo:

| Origen | Campo |
|---|---|
| precio_equipos!A `id` | producto.sku (normalizar: `E-39` → `E-039`, `e-254` → `E-254`; ¿`E-85`?) ; producto.tipo = 'equipo' |
| precio_equipos!B `nombre` | producto.nombre (`trim`) |
| precio_equipos!D `precio_bruto` | precio.precio_sin_iva (lista 'general', MXN) |
| precio_equipos!E `precio_neto` | **no importar** (se calcula) |
| precio_equipos!F `descripción` | producto.descripcion (quitar la comilla `"` del final en 22 casos) |
| precio_equipos!H `imagen_url` | producto.imagen_url |
| ListaDeDescripciones!A (por ID) | producto.clasificacion (normalizar mayúsculas, acentos y saltos de línea) |
| ListaDeDescripciones!C, D (por ID) | producto.nombre_comercial, producto.descripcion_cotizacion (si difiere de la de costeo) |
| ListaDeDescripciones!J, K | producto.nombre_en, producto.descripcion_en |
| ListaDeDescripciones!F (imagen dentro de la celda) | requiere exportar las imágenes aparte (la API de valores no las devuelve) |
| Filtro | descartar filas sin nombre (~507 IDs reservados) y `E-000 BASE` |

**Productos (componentes)**, desde `precio_articulos`:

| Origen | Campo |
|---|---|
| A `id` | producto.sku (entero); tipo = 'componente' |
| B `nombre` | producto.nombre (`trim`; 194 nombres con espacios sobrantes y 33 duplicados exactos en la lista unida) |
| C `unidad` | producto.unidad (pieza, metro, tramo, Caja… normalizar) |
| D `tiempo_entrega` | producto.tiempo_entrega_dias (plazo del proveedor) |
| E `precio_bruto` | precio.precio_sin_iva (lista 'general') |
| F `precio_neto` | no importar |
| G `fecha_ultimo_precio` (d/m/aaaa) | precio.vigente_desde |
| H `descripción` | producto.descripcion |
| I `stock` | **no** importar al producto: va a inventario, que viene de otro archivo |
| J `imagen_url` | producto.imagen_url |
| Filtro | quitar filas sin nombre (IDs ≥ 4978 vacíos) y precio 0 (156 artículos en la lista unida; marcar "sin precio") |

**Catálogo de servicios y fletes**: las filas de `ListaDeDescripciones` **sin ID** (~70: FLETE a ciudades, ENVÍO, SERVICIO, básculas Rhino/Torrey, "Descuento 10%") → producto.tipo = servicio/flete/reventa. **Ojo:** no tienen precio en ninguna parte (la columna E solo funciona con ID).

**Clientes y contactos**, desde 'Clientes-Contacto Unified' (otro archivo; aquí solo llega la columna A):

| Origen | Campo |
|---|---|
| A | cliente.nombre_mostrar (y heurística para persona o empresa: S.A., S. de R.L., SPR, S.C.) |
| D, E, F | contacto[1].nombre, email, celular |
| B, C | cliente.telefono, telefono2 |
| G, H, I | contacto[2].nombre, email, celular |
| J, K, L, M, N | cliente.domicilio, ciudad, cp, estado, pais |
| O | cliente.historial_texto (o, mejor, reconstruirlo desde VENTAS) |
| P | cliente.vendedor_propietario_id (mapear "J. Manuel" → Juan Manuel Ramírez, "Victor" → sin dueño) |

**Vendedores**, desde `Agentes de ventas!B4:B12`, `NombreAgentes2` y el `C5` de cada plantilla. Iniciales = `LEFT(nombre,1)` + primera letra después del primer espacio. Agregar a Juan Manuel Ramírez, que hoy falta. Marcar a Víctor como inactivo.

**Catálogos**, desde `PoliticaDePago` (tabla §2.6) y `DiferirAMeses` (tabla §2.7). Agregar las notas libres que ya se usan (por ejemplo "No incluye cable de alimentación eléctrica ni arrancador", "Incluye envío a…", "Contamos con el mejor servicio post venta…", "Garantía… (6 meses)").

**Cotizaciones históricas:** **no vale la pena importarlas de este libro**: hay ~30 instantáneas sin fecha y sin ID de cliente. Si se quiere historial, hay que sacarlo de los PDF enviados o de VENTAS. Si aun así se importan, el mapeo por plantilla es: C5 → vendedor, C7/A8 → atencion_texto, E7(+F7/G7) → folio, partidas en filas impares 11–27 (B, C, D, E) con descripción en la fila siguiente, E30 → descuento_pct, B32 → tipo_cambio, C33 → moneda, C34 → condicion_pago, B35 → tiempo_entrega, B37 → vigencia, B38:B43 → notas, C47 → plan MSI.

---

## 7. Problemas de calidad (con evidencia)

**Llaves e integridad**
1. **Se busca por nombre en todas partes** (`VLOOKUP` sobre `ListaGeneral`, stock por nombre en Almacén, cliente por nombre). En la lista unida hay **33 nombres duplicados exactos (66 filas)**, como dos "Polea 10" 2rb masa fija de fierro internacional" con ítems 4906 y 4907 o "Carda" ×2; `VLOOKUP` siempre toma el primero. Hay 194 nombres con espacios sobrantes y 3 con saltos de línea. Si se renombra algo en el origen, se rompen cotizaciones y costeos (ListaDeDescripciones lo advierte).
2. **Rangos con nombre más cortos que la lista:** `Refacciones` (H4:H3986) e `ID` (O4:O3986) se cortan en la fila 3986, pero los componentes llegan a la 4076, así que **faltan ~90 componentes recientes**. `ListaGeneral` sí llega.
3. La lista unida incluye ~507 **IDs de equipo reservados sin nombre** (E-335…E-998) y `E-506` sin nombre, además de **156 artículos con precio 0 o vacío** (8 de ellos equipos; varias poleas "internacional" en $0.00).
4. `ListaDeDescripciones`:
   - **IDs repetidos** con productos distintos: `E-110` ×3, `E-246` (BÁSCULA y SILO), `E-368` (BANDA y MEZCLADORA), `E-437`, `E-454`, `E-472`, `E-098`, `E-238`, `E-265`, `E-185`, `E-390`, `E-393`, `E-397`.
   - **Títulos que no corresponden** a su fila: `E-485` "TRANSISION PARA MOTOVENTILADOR" con Title "Banda transportadora tipo artesa…"; `E-492` "2 depósitos c/pesaje…" con "V3 para puntas de trompo"; `E-475` dice 11.5 m, 8.10 m y 18 m a la vez.
   - IDs sin formato uniforme (`E-39`, `e-254`, `E-85`); clasificación sin normalizar ("REFACCION"/"REFACCIÓN", "Banda Artesa"/"BANDA ARTESA", "BANDA GRANELARA", "RODILLLO", saltos de línea dentro de la celda).
   - ~70 filas sin ID y sin precio.
5. **Descripciones escasas:** solo **~395 de 4,073 componentes** (≈10 %) tienen descripción; 22 descripciones de equipo terminan con una comilla `"` suelta; las imágenes de equipo (`imagen_url`) están solo en 70 de 481.

**Plantillas**
6. **Sin fecha de emisión ni de vencimiento**, con la vigencia redactada "a partir de su emisión".
7. **El folio es manual y libre**, con formatos distintos por vendedor y sin control de duplicados.
8. **No se guarda nada:** cada cotización pisa a la anterior. No hay registro, estado, seguimiento ni conversión a pedido.
9. **Tipo de cambio oculto** (texto blanco en `B32`) y desactualizado (16, 17.8, 18, 19 y 21 en distintas pestañas). Solo convierte los precios por fórmula, y USD y MXN se imprimen los dos con "$".
10. **Fórmulas sobrescritas por valores** en las PM, en S1–S5 y en partidas de las Aut; por ejemplo, Aut EH sale con total $0 porque se borró el precio. Hay errores visibles: `#N/A` (Aut Componentes AH, Manual con Imagenes, Aut JM), `#VALUE!` en la mensualidad cuando se elige "No aplica" (Aut IH, PM2), validación `=#REF!` (Aut Componentes AH) y `#REF!` en fórmulas auxiliares (G de notas, G13 de PM IVA inc, G12 de Aut SR).
11. **Fórmulas de descuento desalineadas:** en las filas de descripción, `G14 =…E14*(1-E33)` usa el TOTAL como si fuera un %. Es inofensivo porque E14 está vacía, pero muestra que la plantilla se copió y pegó a mano.
12. **Las validaciones no son estrictas** (salvo la de cliente del BUSCADOR): se escribe texto libre en agente (Juan Manuel no está en la lista), tiempo de entrega, notas y pago. Las condiciones de pago llegan a escribirse como partidas.
13. **El cliente no se liga a la cotización:** "En atención a" es texto libre; ni RFC ni datos fiscales.
14. Las pestañas no corresponden a su dueño (Aut EH = Abel; Aut Componentes AH/SR = Isaac). Hay pestañas muertas visibles (Generador de Links) y ocultas (VP, VIC1, Copia de VP, Manual con Imagenes, Ficha Técnica rota).
15. Leyendas de promoción viejas que siguen en las plantillas ("Válido hasta el 3 de junio", "30 de Septiembre") y texto duplicado ("de descuento ya aplicadode descuento ya aplicado por el FLASH SALE").
16. La mensualidad sale con dos fórmulas distintas (BUSCADOR y plantillas) y se calcula sobre el total sin descuento. En el BUSCADOR, `I10` revisa `C9` en lugar de `H10`.
17. IVA fijo de 16 %, sin manejo de exportación (0 %) ni frontera (8 %); en exportación el total impreso sigue llevando IVA.
18. Las cantidades con decimales (1.70, 0.20 de "Redondo 1018") no muestran unidad en la cotización.

**Dependencias y seguridad**
19. **GPT for Sheets sin créditos:** se caen las descripciones "mejoradas", el "¿Qué ha adquirido?" y los mensajes de WhatsApp de RecuperadorDeClientes. Esos mensajes se mandan a una IA externa junto con el historial del cliente.
20. **Privacidad aparente:** el BUSCADOR esconde los datos ("Privado") de los clientes con dueño, pero cualquier editor puede leer la fuente por IMPORTRANGE. Las protecciones de las plantillas dejan editar a varias cuentas, entre ellas cuentas personales de Gmail.
21. `precio_articulos!F2 =ARRAYFORMULA(IF(B2="","",E2:E*1.16))` evalúa solo `B2`, así que pone "$0.00" en las filas vacías. Esas filas tienen IDs (4978…) pero no nombre.
22. **Sincronización con quick-bid-maker rota:** `google-apps-script.js` espera "A: id, B: nombre, C: tiempo_entrega, D: precio_bruto, E: precio_neto, F: fecha_ultimo_precio, G: descripcion, H: unidad, I: stock", pero la hoja hoy tiene **C = unidad, D = tiempo_entrega, E = precio_bruto, F = precio_neto, G = fecha, H = descripción, I = stock, J = imagen_url**. Si corre, mete la unidad en tiempo_entrega (null), el tiempo en precio_bruto, etc. Además el disparador es `onEdit`, que **no se ejecuta** cuando lo que cambia es un IMPORTRANGE, así que solo funciona con "Sincronizar ahora".
23. **Ficha Técnica** apunta a una hoja borrada ('Datos Tecnicos'); todo sale `#REF!`. En `BUSCADOR!H21` hay una celda suelta `=g` que da `#NAME?`, y en `BUSCADOR!A19` una copia suelta del ID del equipo.
24. El archivo pesa 222 MB por las imágenes incrustadas (logos, fotos de producto y en ListaDeDescripciones); se vuelve lento.
25. Invoice y Packing List son 100 % manuales (hasta el total), sin liga a la cotización ni al pedido; los números de serie se escriben a mano.

---

## 8. Qué tiene que igualar o mejorar el módulo nuevo (por qué hoy les resulta cómodo)

- **Un solo buscador** de equipos y componentes por nombre, con autocompletado, que al elegir llene precio, descripción con viñetas e **imagen**. Es la razón principal por la que usan las hojas.
- **Vista del vendedor en el BUSCADOR:** precio sin y con IVA, **precio mínimo autorizado**, stock, proveedor y su plazo, fecha del último precio, envío gratis y mensualidades. Conviene un panel lateral en la captura de la partida.
- **PDF idéntico** al actual: encabezado con logo y datos fiscales, agente y celular, "En atención a" y empresa, folio con iniciales, tabla de 2 renglones por partida (artículo y descripción con foto), subtotal, IVA y total, columna "con descuento" y leyenda roja de la promoción, condiciones (pago, entrega, vigencia, notas) y banner de meses sin intereses con la mensualidad.
- **Libertad controlada:** partidas libres (servicios, fletes, textos largos con secciones), notas editables, **partidas opcionales o alternativas** que no suman, plantilla con IVA incluido, plantilla co-marca con otro logo y USD con tipo de cambio.
- **Lo que hoy no existe y el ERP debe aportar:** folio automático por serie de vendedor, fecha y vencimiento, cliente y contacto ligados (con privacidad por propietario), historial y versiones, estado y seguimiento, duplicar una cotización, promociones con fechas, y convertir la cotización en pedido o en invoice/packing de exportación.

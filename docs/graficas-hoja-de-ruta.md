# Gráficas y métricas: hoja de ruta única

Ya rehechas y fuera de esta lista: Métricas de almacén, Métricas de mantenimiento, Métricas de producción y Uso del ERP.

## 1. Lo que ya está bien

- **Tablero de dirección:** sparkline, ventas por mes contra los dos años anteriores, mini mapa.
- **Resultados:** Sankey de a dónde va el dinero.
- **Costeo › Gráficas:** costo contra precio de lista y precio al margen; historial escalonado.
- **Tendencias:** año contra año, total móvil, mapa de calor estacional, crecimiento divergente.
- **Precios vs ventas:** índices de costo y de precio, base 100.
- **Clientes:** Pareto/Lorenz, top con participación, cohortes de retención, RFM.
- **Mapa de ventas:** coroplético por cuantiles, ranking, zonas que se enfriaron.
- **Producto × región:** matriz familia × estado y cociente de localización.

## 2. Hoja de ruta

51 propuestas. Cada renglón: **título** · pantalla · decisión · gráfica · datos · esfuerzo. ⏳ = hoy saldría casi vacía. † = de la primera auditoría, sin revisar contra el SQL: medir en la nube antes.

### Ola 1 · Los datos ya llegan

**Valor 4**
- **Antigüedad completa en el tablero** · Tablero · a quién cobrar · sumar los tramos de la hoja: hoy se ve menos vencido · `saldo_arranque_antiguedad` · chico
- **Puente de utilidad contra el año anterior** · Resultados · qué movió la utilidad · cascada; si cruza el arranque, material en neutro («cambio de método») · `resultados_periodo` · chico
- **Por qué cambió la nómina** · Prenómina · pagar o corregir antes de cerrar · cascada contra la semana anterior · `prenomina` · medio
- **Indirectos de importación** · Embarque › Costeo · qué tramo negociar · cascada de $1 de mercancía al factor · `costeos_importacion` · chico (⏳ la referencia)

**Valor 3**
- **Envejecimiento del embudo** · Oportunidades · qué limpiar o reasignar · apiladas por etapa y días en ella, en número · `v_oportunidades` · chico
- **Lo que se queda ML según el monto** · ML › Dinero · piso de ticket o paquete · dispersión, solo pagos aprobados · `v_ml_dinero` · chico
- **Conversión por publicación** ⏳ hasta el 18 nov · ML › Publicaciones · a cuál meterle trabajo · funnel plot por franja de precio · `ml_tablero` · chico
- **Resultados por año como composición** † · Resultados · cómo cambia la estructura de costos · 100 % apilado con `COLOR` · chico
- **Nuevos contra recurrentes en $** † · Clientes · si se crece con nuevos o con los de siempre · cohortes de ingreso · libro desde 2018 · medio
- **% cobrado contra % avance** ⏳ · Cobranza · qué equipo no sale sin cobrar · dispersión; resaltados los terminados con saldo · `v_pedidos` · chico
- **Tramos de la importación** ⏳ · Importaciones · a qué ETA creerle · apiladas por embarque y desvío contra la ETA · `v_tiempos_importacion` · chico
- **Horas extra persona × semana** ⏳ · Incidencias · repartir o contratar · mapa de calor neutro, hora 10 marcada · `incidencias` · chico
- **Puntos perdidos por indicador** ⏳ · Objetivos · qué indicador recalibrar · Pareto con acumulado · `objetivo_resultados` · chico
- **Sueldo contra antigüedad** · Prenómina › Sueldos · aumento anual y ofertas · dispersión; bandas solo con 4+ por puesto · `sueldos_nomina` · chico

**Valor 2**
- **Arreglos chicos del tablero** † · mejores clientes y mezcla por canal contra el año anterior, sin «Público General (Mercadolibre)»; inventario en un renglón de $ en quiebre / exceso / sin movimiento, con liga a almacén · chico
- **Ventas por mes por línea en múltiplos pequeños** † · Inicio fuera de ventas · con `ventas_entre` · chico
- **Índice de precio contra unidades** † · Precios vs ventas · si subir precio cuesta volumen · dispersión de cambios anuales, sin la r · chico

### Ola 2 · SQL nuevo

**Valor 5**
- **DSO y antigüedad a fin de mes, junto a cobrado contra facturado** · Cobranza · si se cobra más lento y cuándo apretar · DSO contra el año anterior, con meta; área apilada por tramo · `cobranza_fin_de_mes()` · medio

**Valor 4**
- **A quién cobrarle primero** · Cobranza · a quién llamar o pedirle más anticipo · dispersión saldo (log) × días de lo más viejo que debe · `saldo_arranque_antiguedad` por cliente · chico
- **Flujo de efectivo** · Pagos · qué pagos mover y qué cobros apurar · entradas y salidas divergentes a 6–8 semanas, vencido aparte · por pagar, `v_pedidos` y retraso por cliente · grande
- **¿Llego al escalón?** · Comisiones, tablero e Inicio de ventas, un componente · qué cerrar antes de fin de mes · bullet con proyección p25–p75 y las 3 cotizaciones que más acercan · `ritmo_comision()` · medio
- **Curva de cierre** ⏳ hasta mediados de enero · Lo cotizado · hasta cuándo perseguir · ganado acumulado SERIE(1), perdido SERIE(2) tenue · `lo_cotizado` · medio
- **Carga acumulada contra capacidad** · Análisis › Capacidad, Gantt y tablero · cuántas semanas de gente faltan por área · múltiplos por área en semanas: escalón contra diagonal; flujo con backlog · reemplaza `analisis_capacidad` · medio
- **Trabajo atorado por etapa** · Gerencia de producción · a quién mandar a destrabar · reutilizar `EdadTrabajo` (`produccion/componentes/GraficasProduccion.tsx`) con `produccion_analitica().edad` · chico
- **Cierre del año con escenarios** · Tablero y Planeación · empujar el cierre o fijar la meta 2027 · mediana de 8 años, banda mín–máx, «en k de 8 se pasa la meta»; en Planeación, desviación mensual divergente · `pronostico_cierre()` · chico
- **Puente de ventas: operaciones × ticket** · Tendencias · si se cayeron las operaciones o el ticket · cascada por familia; mezcla en múltiplos como detalle · `analisis_puente()` · medio
- **Qué costo recotizar primero** · Precios de compra · el orden de recotización · cifra de $ con costo viejo y Pareto acumulado · envoltura de `almacen_clasificacion` · chico
- **Sobreprecio contra la mejor alternativa** · Proveedores · a quién renegociar · barras en $ al año · `comparativa_proveedores()` · medio
- **Índice de compra contra INPP** · Precios y Detalle de proveedor · si suben más que la inflación · línea base 100 y % de la canasta con precio fresco · `historial_costos` + INPP · medio
- **Reputación ML** · ML › Reputación · aceptar la devolución o priorizar el despacho · bullet por métrica; lo principal, «te quedan N» · `ml_reputacion` + topes · chico
- **Checklist del mes** · Objetivos · con quién hablar; hoy se paga bono sin evidencia · 100 % apilado cumplió / no / sin marca, por jefe · `checklist_cobertura()` · medio
- **Horas-persona fuera por área** ⏳ lo pasado · Incidencias › Cobertura · mover vacaciones o bajar el 85 % · múltiplos de −8 a +8 semanas · función propia · medio
- **Puente del margen por orden** ⏳ · Márgenes · qué recotizar o recostear · cascada del margen a lista al real · función de costos · grande

**Valor 3**
- **Preguntas ML sin contestar** · ML · guardia fuera de horario · Kaplan–Meier en horas de horario · `ml_preguntas` · chico
- **Qué fotografiar y publicar primero** · Catálogo · el orden de marketing · una cifra y la lista por rotación · rpc sin costos · chico
- **Tramos del envío** · Envíos · qué tramo arreglar · mediana y p25–p75 en horas hábiles · `v_envios` · medio
- **Dólares de las próximas 13 semanas** · Importaciones › Dinero y Pagos · cuándo comprar dólares · apiladas programado / estimado · `embarque_pagos` · chico
- **Entrega real de nacionales** ⏳ · Detalle de proveedor · qué días de entrega capturar · puntos por orden contra el dato del reabasto · `entrega_real_nacionales()` · medio
- **Margen por hora del cuello** · Márgenes · qué empujar con el taller lleno · dispersión horas de cuello × (precio − material) · árbol de `estimar_entrega` · medio
- **Qué componente movió el costo** · Equipo › Historial · qué renegociar · divergentes en $ · `historial_costos` · medio
- **Entregas a tiempo** ⏳ · Análisis › Entregas (la parte de producción ya está en Métricas de producción: `Cumplimiento`) · si cambió de verdad · gráfica p con meta 90 % e histograma de retraso; funnel plot por familia cuando haya n · regla de `analisis_entregas` · chico
- **Gasto por categoría contra ventas** · Resultados · qué gasto recortar · puntos de crecimiento con línea en ventas · `gasto_categoria_por_mes()` · medio
- **Cotizado vivo contra lo que falta** ⏳ · Tablero (en lugar del Embudo) y Planeación · cotizar más o cerrar · bullet faltante / cotizado / ponderado · `lo_cotizado` · chico
- **Plazo real contra estándar por familia** ⏳ (hoy 0 órdenes con liberación vista en el ERP: las de la hoja no tienen esa fecha) · Métricas de producción · qué `dias_fabricacion` corregir · mediana y P25–P75 en días hábiles · `produccion_analitica` · medio

**Valor 2**
- **Reembolsos ML** · Devoluciones · investigar o es ruido · gráfica p · rpc de conteos · chico
- **Ritmo de compra del cliente** · Detalle de cliente · qué ofrecerle · línea de tiempo · `oportunidades_sugeridas` · medio

### Ola 3 · Falta capturar el dato

- **Embudo de leads** (3) · Leads · en qué paso se fuga y en qué fuente invertir · embudo con % entre pasos · **Capturar:** en el diálogo del lead, quitar «Llamada a recepción» por omisión y separar por dónde llegó de cómo se enteró · medio
- **Conversión entre etapas** (3) · Oportunidades · **Capturar:** historia de etapas (`oportunidades` no tiene `auditar()`) · chico
- **Qué motivo de «A quién llamar hoy» vende** (2) · Para llamar · recalibrar el puntaje · **Capturar:** foto diaria de la lista sugerida · medio

También destraban la Ola 2: saldo de bancos cada lunes (flujo), días de crédito de clientes y de los 15–20 proveedores grandes, INPP mensual y la fecha límite de despacho de ML.

## 3. Reglas rotas para arreglar de paso

- `finanzas/Resultados.tsx:86-88` y `:296`: SERIE fuera de orden; arreglar una vez en `COLOR`.
- `analisis/PreciosVentas.tsx:119`: SERIE(3) en serie única; `:51-62` calcula en React.
- `inicio/TableroDireccion.tsx:239`, `:249`: `var(--eje)` como serie; `:310`, `:346` color por posición; `:260` color de marca; `:330` hex.
- Hex sueltos: `produccion/componentes/CargaTaller.tsx:77`, `costeo/Margenes.tsx:377`.
- `costeo/componentes/Graficas.tsx:12`, `:201`, `:209`: $ armado a mano.
- `compras/DetalleProveedor.tsx:129-146`: índice en área; va en línea.
- Estado sin estado: `ventas/Comisiones.tsx:125`, `:136`; `produccion/Gerencia.tsx:113`, `:116`; `produccion/Gantt.tsx:277`; `produccion/Mejoras.tsx:89`, `:92-93`; `finanzas/Pagos.tsx:142-143`; `ventas/componentes/DineroML.tsx:146`; `rrhh/Objetivos.tsx:169-170`.
- Signo pintado como estado: `costeo/Margenes.tsx:63-68`, `:82`; `rrhh/Prenomina.tsx:144`, `:207`, `:493-495` («+-5 %» en verde); `rrhh/componentes/AhorroPrestamos.tsx:205`.
- `rrhh/componentes/comun.tsx:113-121`: `FONDO_TIPO` usa estado como categoría.

Cifras que hoy dicen otra cosa: `TableroDireccion.tsx:277` (meta mal), `:214-215` (sin la hoja); `Inicio.tsx:179` (cuenta versiones), `:223` (sin libro ni ML); `Semana.tsx:140` (otro «cobrado»); `DineroML.tsx:147` (suma reembolsadas); `TableroML.tsx:218` (debe leer `completed`); `MercadoLibre.tsx:68` (reloj contra horario); `Envios.tsx:93` (cuenta cancelados); `Embarques.tsx:395` (MXN como USD); `costeo/componentes/Historial.tsx:38` (incluye cancelados).

Ajusté dos colores de lo verificado: la curva de cierre pasa de SERIE(3)/(8) a SERIE(1)/(2), y los totales de la nómina, de `SERIE(0)` (no existe, `comunes.tsx:4`) a gris.

## 4. Mis 5 primeras

1. **DSO y antigüedad a fin de mes:** la única de valor 5, con historia desde 2018.
2. **A quién cobrarle primero**, con la antigüedad completa del tablero: chica, y junta por primera vez la deuda de la hoja y la del ERP.
3. **¿Llego al escalón?:** decisión con fecha y dinero (bonos de $1,600 a $50,000); corrige de paso la meta del tablero.
4. **Carga acumulada contra capacidad:** dice en qué semana se rompe lo prometido y cuánta gente falta en pailería.
5. **Reputación ML:** chica, sin historia, y cambia un % por «te queda un reclamo».

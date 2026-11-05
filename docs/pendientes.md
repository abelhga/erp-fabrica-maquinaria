# Pendientes

Lo que quedó acordado para después, para que no se pierda entre sesiones. Cuando algo se hace,
se borra de aquí (y queda en `git log`). Lo más reciente arriba en cada sección.

## Por decidir o esperar a alguien

- **Conteo de lo que no cuadra con la hoja (Noemí, vence 5 y 6 nov):** 3 pendientes con 96
  renglones; el documento «Conteo de almacén: dudas al cerrar la hoja (29-oct)» tiene la misma
  lista para imprimir. Cuando se cierren los conteos:
  - soltar las reservas «Apartado en la hoja (RESERVADO) al importar» de lo que ya no esté en
    Planta Baja (cangilones 5x4 y 6x5, bandas, celda de carga, cabezal F900);
  - confirmar las salidas dobles: C-N3914 (venta de mostrador del 28-oct y PED-26-823) y
    C-00891 y C-00156 (venta de ML capturada a mano el 30-oct y el envío que descontó solo).
    Si vuelve a pasar lo de ML, avisar en Registrar o con una regla de la revisión nocturna.
- **OC-26-4399 (motorreductor 2 HP, C-N0998):** José Antonio no ha contestado el precio (su
  pendiente sigue abierto y la partida está en $15,000). Con el precio: recibirla en Contenedor 1
  y dar la salida de consumo a Gustavo para Luis (en la hoja: 28-oct 14:49, filas 32772–32773).
- **Surtido de OP-2026-00010, 00039 y 00048:** se regresó a cero el surtido que había puesto la
  carga inicial (16 oct). Mimí registra lo que sí entregó: normal, o «Ya se había entregado con la
  hoja (antes del ERP)».
- **Vacaciones (Margarita):** después de que revise el informe «Cuadre de vacaciones»:
  - mostrar el adelanto como «−4 · del periodo que viene le quedan 8 de 12»;
  - recargar los saldos de arranque de la hoja en su periodo correcto;
  - registrar las vacaciones futuras ya pedidas.
  Antes del 18 nov (aniversario de Noemí).
- **Cuentas sin ficha de empleado:** RRHH liga las cuentas a sus fichas (la revisión nocturna ya
  lo pide: Luis Eduardo, Esteban; Isaac no tiene ficha).

## Mantenimiento (junta con Esteban, 30 oct)

Ya hecho: preventivos por mes en día hábil, categorías libres y equipo de oficina, dar de baja,
MTBF y MTTR en horas laborales (212); editor de rutinas, manuales por máquina, préstamo con para
qué y foto, etiquetas QR/NFC (213); terminal con play y pausa, y criticidad calculada (216). Falta:

- **Para Esteban:** calificar en cada máquina «si se para…» y «riesgo de seguridad» (Editar →
  Criticidad). Hasta entonces se queda la criticidad de la hoja; con las dos, se calcula sola.
- **Para Esteban:** los 62 planes «Rutina mensual» están como «cada 30 o 31 días»; si en realidad son
  «el primer lunes» (o el día que sea), cambiarlos en la ficha de cada máquina.

## Para hacer

- **Gráficas que faltan pasar a analíticas** (auditoría del 5 nov; almacén, mantenimiento y uso del
  ERP ya están). En orden de lo que ayudan a decidir:
  1. Cobranza: cobrado contra facturado por mes (el dato ya llega) y DSO por mes (SQL nuevo:
     saldo por cobrar a fin de mes); antigüedad de saldos mes a mes.
  2. Cumplimiento de entregas (Análisis › Entregas y Producción › Métricas): % a tiempo por
     semana/mes como gráfica de control con meta 90 % (datos ya existen).
  3. Capacidad: carga acumulada contra capacidad acumulada y flujo acumulado entra/sale con el
     backlog (datos ya existen).
  4. Embudo del tablero: conversión entre etapas y días en cada etapa (SQL: historia de etapas).
  5. Planeación: avance acumulado contra meta con proyección a diciembre y desviación por mes.
  6. Producción: horas de espera contra horas de trabajo por etapa (cuello de botella; `espera_h`,
     `trabajo_h` ya llegan).
  7. Proveedor: cumplimiento y variación del tiempo de entrega; índice de precios contra INPC.
  8. Resultados por año como composición (costo, gastos, impuestos, utilidad) y Precios vs
     ventas como dispersión índice de precio contra unidades (el monto mezcla precio y volumen).
  Reglas rotas a corregir de paso: colores por posición en el tablero (canales y almacenes cambian
  de color si cambia el orden), `SERIE` fuera de orden en Resultados y Precios vs ventas, colores de
  etapa en hex que no cambian con el modo oscuro, y `$` armado a mano en costeo/Graficas.

- **Correo con Gmail, segunda etapa: leer.** Mandar (217) y los correos de importaciones (225:
  hilos ligados al embarque y la IA que propone en qué va) ya están. Falta:
  - Ventas y compras: ver en la cotización o la OC si el cliente o el proveedor contestó (el hilo
    ya se guarda en correos_enviados.gmail_hilo).
  - Importaciones, cuando se use: traer lo nuevo de los hilos cada noche en lugar de con el botón.
- **Kit o subensamble:** el subensamble se fabrica en el taller y lleva horas; el kit son
  piezas compradas que solo se surten juntas. Marcar cuáles son kits (sin horas, se surten como
  paquete).
- **Bitácora de cambios** (`docs/bitacora.md`) y mapa de qué es de Hegamex y qué es genérico, con
  la regla en CLAUDE.md de mantenerlos al día (para cuando se comercialice).
- **Hegamex-voz ↔ ERP:** conectar el teléfono con el ERP (clientes, pedidos, recados).
- **Interruptor Activo / Inhabilitado** también en la lista de Componentes.
- **Borrar las cuentas de prueba** de la nube.
- Ideas sueltas:
  - en el material de la orden agrupado por subensamble, mostrar la descripción del
    subensamble en su encabezado;
  - que las vistas recordadas sigan a la persona en todos sus aparatos (hoy son por aparato).

## Para revisar en unos días

- **«Está bien así» con la IA (246):** en una o dos semanas, leer en «Contestado» qué aceptó y qué
  escaló la IA. Si escala razones buenas, aflojar `REGLAS_PORQUE` en el asistente; si deja pasar
  costumbres, apretarlo. Ver también si «Ayúdame a corregirlo» propone cosas que no se pueden aplicar.
- **Revisión nocturna:** cuántos hallazgos contestan y cuántos son «Está bien así» (si una regla
  saca puro «bien así», ajustarla). Los primeros consejos salen el lunes 2 nov.
- **Candado al surtir de más:** revisar cada semana las solicitudes de cambio a ingeniería y lo
  que salió «fuera de la lista»; dicen qué le falta a la lista de cada equipo.

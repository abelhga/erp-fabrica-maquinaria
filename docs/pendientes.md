# Pendientes

Lo que quedó acordado para después, para que no se pierda entre sesiones. Cuando algo se hace,
se borra de aquí (y queda en `git log`). Lo más reciente arriba en cada sección.

## Por decidir o esperar a alguien

- **Teléfono con IA, fase 4 (262, WhatsApp del vendedor):** ya está en la nube. Falta que cada vendedor
  quede ligado por su WhatsApp en «Quién contesta» (el primer mensaje de un número sin ligar lo deja ahí
  «Sin persona») y luego prender «CRM externo» en el panel de voz.
- **Teléfono con IA, fase 3 (261, coaching y análisis):** ya está en la nube. Falta agregar el indicador 75
  a las plantillas de vendedores y recepción, y el relleno histórico desde voz (`llamada.historica`), con
  ensayo primero.
- **Teléfono con IA, fase 1 (258):** ligar en «Quién contesta» los nombres que no se ligaron solos por
  el teléfono de su perfil (al ligarlos también se les asignan sus coachings).
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

- **Pendientes «Con copia a»** (idea de dirección, 5 nov): alguien que ve el pendiente y recibe sus avisos
  (creado, preguntas, terminado) sin ser responsable ni contar para su cumplimiento. Hacerlo si se
  vuelve a pedir; por ahora se avisa por fuera.

- **Lo que encontró la revisión del tutorial (5 nov) y no era del tutorial.** Los agentes solo podían
  agregar explicaciones, así que esto quedó sin tocar. Verificar en el código antes de corregir.
  - Posibles errores de lógica: «Iniciar»/«Reanudar» desde el detalle de la orden no anota a nadie
    (no cuenta horas hombre) y borra la cuadrilla planeada (`avanzar_operacion`); el contador «Sin
    facturar» de Cobranza cuenta pedidos cancelados que la lista quita; «Reemplazar» en los
    documentos del embarque agrega otro renglón en vez de reemplazar; recibir herramienta dañada
    dice que no se vuelve a prestar sin revisar, pero `prestar_herramienta` sí la deja prestar;
    Comisiones dice que la diferencia «va como ajuste del mes siguiente» y nada crea ese ajuste.
  - Textos en pantalla que no dicen lo que hace el código: recibir OC («10 % arriba de lo
    pendiente», revisa contra lo pedido); proveedor «es importación (6 meses de cobertura)», depende
    de cada artículo; ficha de componente «al tipo de cambio de hoy» (usa el de costeo); IVA de
    Configuración (la cotización nueva no lo lee); tope de meses con tarjeta (nada lo hace cumplir);
    diálogo de permisos y pie de Bitácora («Costos da márgenes», ya no desde la 117); «Mezcla por
    canal» del tablero (ML ya está conectado); «Herramientas lean» de Métricas de producción (Kaizen
    y A3 ya existen); vacíos de «Por empacar» y de «Sin clasificar» en Producto × región; textos de
    bono del Checklist sin comprobar contra la plantilla de cada puesto.
  - Para que los globos lleguen a todo: el buscador de artículos y las celdas editables (componentes
    compartidos) no reenvían `data-explain`; /servicio/reportar y las etiquetas viven fuera del marco
    sin la capa de globos; las tarjetas de saldo de paquetería son botones apagados para ventas.
  - Ventas › Leads: la configuración dice que la cambian «la gerencia de ventas o dirección», pero
    marketing también tiene leads nivel 3. Decidir si marketing debe poder.
- **Gráficas y métricas:** la hoja de ruta completa (54 propuestas verificadas contra el SQL, en tres
  olas, con mis 5 primeras) está en [`docs/graficas-hoja-de-ruta.md`](graficas-hoja-de-ruta.md).
  Antes que gráficas nuevas, revisar las **cifras que hoy dicen otra cosa** que lista ahí (p. ej.
  pesos tomados como dólares en Embarques, la meta del tablero, envíos cancelados contados): son
  errores de número, no de diseño. Verificar cada una en el código antes de corregir.
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

import type { AyudaPantalla } from "./index";

export const SERVICIO: Record<string, AyudaPantalla> = {
  "/servicio": [
    "El tablero del servicio postventa. Ventas pide aquí el servicio para su cliente (\"Pedir servicio\") y la gerencia de producción le pone fecha y cuadrilla; a quien pidió le llega un aviso.",
    "Los indicadores de arriba filtran la lista al darles clic. El calendario de cuadrillas muestra quién sale y cuándo, dos semanas a la vez (el botón Hoy regresa a esta semana): una persona nunca aparece en dos servicios a la vez porque el sistema no lo permite, ni la deja salir con vacaciones o incapacidad aprobadas. Clic en un renglón de la lista abre el servicio.",
    "\"Carga del taller por semana\" suma producción y horas en servicio contra la capacidad de cada área: verde con holgura, ámbar justa (85 a 100 %) y rojo cuando se pasa. Pasa el mouse por una celda para ver de dónde sale. Si eres de almacén, a la derecha ves los insumos y refacciones que tienes que entregar.",
  ],
  "/servicio/:id": [
    "La ficha de un servicio: qué pidió el cliente, cuándo y con quién se atiende, los insumos que lleva, las fotos y el cierre.",
    "Los pasos de arriba (Pedido, Programado, En curso, Cerrado) se marcan con fecha y quién. Una reparación en planta no empieza sin recibir el equipo con fotos de cómo llegó, y ningún servicio se cierra sin foto del trabajo terminado, el nombre de quien recibe y las notas de lo que se hizo.",
    "En una garantía ves si sigue vigente según la entrega del equipo con ese número de serie. Las horas de la cuadrilla se descuentan de la capacidad de su área en el taller. Los insumos salen de almacén o se piden a compras. Las fotos no se pueden borrar.",
  ],
  "/servicio/metricas": [
    "Cómo anda el mantenimiento: si las máquinas están disponibles, cada cuánto fallan, cuánto tardan en volver a trabajar y si el preventivo se hace a tiempo. La usan mantenimiento, la gerencia de producción, ingeniería de procesos y dirección.",
    "Arriba eliges el periodo. Los indicadores: disponibilidad (qué parte del tiempo estuvieron listas), MTBF (cada cuánto fallan), MTTR (cuánto tardan en repararse), preventivo a tiempo, cuánto del trabajo de mantenimiento es preventivo y lo que sigue abierto.",
    "«Las que más paran» dice dónde se va el tiempo de máquina; «Vuelven a fallar», las reparaciones que no duraron 30 días. En «Por máquina» ves todo por máquina (clic abre su ficha) y lo descargas en CSV.",
    "Los números salen de las órdenes de mantenimiento: cuándo se reportó, cuándo se paró y volvió la máquina, cuándo se cerró y las horas del técnico. Si una orden se cierra sin esos datos, no cuenta bien. Quien ve costos también ve lo que costó cada máquina.",
    "Todos los tiempos (disponibilidad, horas paradas, MTBF y MTTR) son horas laborales del taller: no cuentan noches, fines de semana, feriados ni descansos, con el horario que pone la gerencia de producción. Lo dado de baja cuenta solo hasta el día de su baja.",
  ],
  "/servicio/maquinas": [
    "El catálogo de máquinas, herramienta, vehículos, instalaciones y equipo de oficina: en qué estado está cada uno, cuánto ha fallado y qué mantenimiento preventivo le toca. La lleva mantenimiento (o la gerencia de producción); el personal de producción reporta fallas y presta herramienta.",
    "El estado no se captura: sale de las órdenes de mantenimiento abiertas. Operando, Con falla (sigue trabajando pero alguien reportó algo), Parada (la falla la detiene) y En reparación. \"Reportar falla\" abre el formulario rápido y \"Resguardos\" lleva la herramienta prestada.",
    "Pestañas: Máquinas (clic abre su ficha), Órdenes abiertas (fallas y preventivos; clic abre el detalle a un lado) y Preventivos. Un preventivo se programa por fecha (cada tantos días, «el primer lunes de cada mes» o «el día 15»), por horas de uso o lo que pase primero, y su orden se genera sola con el checklist de su rutina, siempre en un día que el taller trabaja.",
    "\"Etiquetas QR\" abre una hoja para imprimir y recortar las etiquetas de todas las máquinas (o de las del filtro que tengas puesto). Pegada en la máquina, quien vea una falla la escanea con el celular y le sale el reporte de esa máquina, sin buscarla.",
    "En Máquinas, el filtro «Dadas de baja» muestra lo que ya no conviene reparar, con la fecha y el motivo. Al dar de alta, la categoría se elige de la lista o se escribe una nueva (impresora, aire acondicionado…); el tipo «Equipo de oficina» es para computadoras, impresoras y lo demás que no es del taller.",
    "Al abrir una orden preventiva, cada punto del checklist se marca Bien o Falla (con qué tiene); la orden no se cierra mientras falte alguno. Al cerrarla, mantenimiento anota qué se hizo y las horas que le dedicó (no las que estuvo parada la máquina).",
  ],
  "/servicio/maquinas/:id": [
    "La ficha de una máquina o herramienta: sus datos, su historial de mantenimiento, sus planes preventivos y, si se presta, quién la tiene.",
    "Fallas y tiempo parada cuentan los últimos 12 meses. \"Criticidad\" va de muy alta a muy baja; muy alta o alta es crítica: si se para, se para el área. También dice el tipo de mantenimiento (preventivo, predictivo o autónomo), quién lo hace y, si es herramienta que siempre trae la misma persona, a quién está asignada. Si tiene horómetro, registra sus horas con \"Registrar horas\": la lectura no puede ser menor que la anterior y, al guardarla, si ya toca un preventivo por horas, su orden sale en ese momento.",
    "En \"Plan preventivo\" mantenimiento o la gerencia agregan o editan los planes y le ponen su rutina: la lista de puntos que se palomean. En «Cuándo toca» eliges cada tantos días, un día de la semana del mes (el primer lunes, el último viernes) o un día fijo del mes, cada uno o cada varios meses; además puede ser cada tantas horas de uso, lo que pase primero. Abajo te dice qué día toca el siguiente. Si cae en fin de semana, feriado o descanso, pasa al siguiente día que se trabaja (en los planes por mes, sin brincarse al mes siguiente). La orden se genera sola: por fecha, unos días antes de vencer; por horas, al llegar a ellas.",
    "\"Manuales y fichas técnicas\" junta el manual, la ficha técnica, diagramas y garantía: un PDF, una foto o una liga de Drive. Al agregarlo eliges si es solo de esta máquina o de todas las de su tipo y modelo. \"Etiqueta QR\" la enseña para imprimirla y pegarla en la máquina; en un Android con Chrome también la graba en una etiqueta NFC.",
    "Lo que ya no conviene reparar se da de baja con «Dar de baja» y el motivo: sus órdenes abiertas se cancelan, sus planes se apagan y deja de contar en las métricas. Si estaba prestada, primero se recibe en Resguardos. Se puede reactivar desde la misma ficha; sus planes se quedan apagados hasta que los prendas.",
    "Abajo, \"Refacciones de este tipo de máquina\" lista las piezas que lleva (por tipo y modelo) y cuántas hay en planta; se piden desde una orden de mantenimiento.",
  ],
  "/servicio/rutinas": [
    "Las rutinas de mantenimiento: la lista de puntos que se palomea en cada preventivo, por tipo de máquina y frecuencia. Las edita el encargado de mantenimiento (o la gerencia de producción); los demás las ven.",
    "Clic en una rutina la abre a un lado. Cada punto lleva su sección (Seguridad, Limpieza, Eléctrico…) y qué se revisa; Enter agrega otro debajo, y con las flechas los acomodas. Las recomendaciones salen arriba del checklist en cada orden. «Duplicar» sirve para hacer la trimestral a partir de la mensual.",
    "Al guardar, los preventivos que ya salieron con esa rutina y nadie ha empezado toman la lista nueva; los que ya se están palomeando se quedan como estaban. La columna «La usan» dice qué máquinas la tienen en su plan; una rutina en uso no se puede desactivar. A cada plan se le pone su rutina en la ficha de la máquina.",
  ],
  "/servicio/resguardos": [
    "Aquí se anota quién se lleva una herramienta del taller (a campo o a otra área), desde cuándo y cómo la regresó. Lo usan mantenimiento, la gerencia y el personal de producción. La herramienta que siempre trae la misma persona (su soldadora) no se presta aquí: se asigna en la ficha de la máquina.",
    "\"Prestar herramienta\" registra quién se la lleva, para qué (o para qué servicio; uno de los dos es obligatorio) y cuándo debe regresar. \"Recibir\" la cierra con su estado: bien, dañada o incompleta, y si quieres una foto de cómo regresó; si regresa dañada o incompleta, la falla se reporta sola, con la foto. Una máquina parada o en reparación no se presta.",
    "Sale en rojo lo que pasó de su fecha de regreso o lleva más días fuera que el límite. El límite lo cambias junto a los filtros (\"Marcar después de … días\").",
  ],
};

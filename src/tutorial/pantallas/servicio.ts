import type { AyudaPantalla } from "./index";

// Arriba de cada pantalla solo va para qué sirve y lo mínimo para trabajar; cada botón, columna y
// sección ya trae su globo (glosario de servicio). El «detalle» conserva todas las reglas porque el
// asistente lo lee como manual: si se quita de aquí, el asistente deja de saberlo.
// El tablero y la ficha de servicio los ven también vendedores: ahí no se habla de costos.
export const SERVICIO: Record<string, AyudaPantalla> = {
  "/servicio": {
    resumen: "El tablero del servicio postventa: ventas pide aquí instalaciones, garantías y reparaciones para su cliente, y la gerencia de producción les pone fecha y cuadrilla.",
    pasos: [
      "Para pedir uno, dale «Pedir servicio»: elige qué necesita, el cliente, y describe lo que pide.",
      "Si programas, filtra «Por programar», abre el servicio y dale «Programar» con día y cuadrilla.",
      "Mira en el calendario de cuadrillas quién sale, a dónde y cuándo.",
    ],
    detalle: [
      "Al pedir un servicio le llega un aviso a la gerencia de producción, que le pone fecha y cuadrilla; a quien lo pidió le llega otro aviso cuando queda programado.",
      "Los indicadores Por programar, Esta semana y En curso filtran la lista al darles clic. La lista abre en «Abiertos»; clic en un renglón abre el servicio.",
      "El calendario de cuadrillas muestra quién sale y cuándo, dos semanas a la vez; las flechas lo mueven una semana y «Hoy» lo regresa a esta semana. Una persona nunca aparece en dos servicios a la vez porque el sistema no lo permite, ni la deja salir con vacaciones o incapacidad aprobadas.",
      "«Carga del taller por semana» suma producción y horas en servicio contra la capacidad de cada área: verde con holgura, ámbar justa (85 a 100 %) y rojo cuando se pasa. Pasa el mouse por una celda para ver de dónde sale.",
      "Si eres de almacén, a la derecha ves los insumos y refacciones que tienes que entregar.",
    ],
  },
  "/servicio/:id": {
    resumen: "La ficha de un servicio: qué pidió el cliente, cuándo y con quién se atiende, los insumos que lleva, las fotos y el cierre.",
    pasos: [
      "Si programas, dale «Programar» y elige día, hora, duración y cuadrilla.",
      "En una reparación en planta, dale «Recibir equipo» con fotos de cómo llegó antes de iniciar.",
      "Dale «Iniciar» al empezar y «Cerrar servicio» con foto del trabajo, qué se hizo y quién recibe.",
    ],
    detalle: [
      "Los pasos de arriba (Pedido, Programado, En curso, Cerrado) se marcan con fecha y quién. Programar o reprogramar le toca a la gerencia.",
      "Una reparación en planta no empieza sin recibir el equipo con fotos de cómo llegó, y ningún servicio se cierra sin foto del trabajo terminado, el nombre de quien recibe y las notas de lo que se hizo. Al cerrar una garantía se anota si procedió.",
      "En una garantía ves si sigue vigente según la entrega del equipo con ese número de serie. Las horas de la cuadrilla se descuentan de la capacidad de su área en el taller.",
      "Los insumos salen de almacén o se piden a compras. Las fotos no se pueden borrar.",
      "Quien lo pidió puede cancelarlo mientras no tenga fecha; después, solo la gerencia.",
    ],
  },
  "/servicio/metricas": {
    resumen: "Cómo anda el mantenimiento: si las máquinas están disponibles, cada cuánto fallan, cuánto tardan en volver a trabajar y si el preventivo se hace a tiempo.",
    pasos: [
      "Elige arriba el periodo: 30 días, 90 días, 6 meses o 12 meses.",
      "Empieza por el Pareto: ahí están las pocas máquinas que juntan casi todo el tiempo parado.",
    ],
    detalle: [
      "La usan mantenimiento, la gerencia de producción, ingeniería de procesos y dirección. Abre con los últimos 90 días.",
      "Los indicadores: disponibilidad (qué parte del tiempo estuvieron listas), MTBF (cada cuánto fallan), MTTR (cuánto tardan en repararse), preventivo a tiempo, cuánto del trabajo de mantenimiento es preventivo y lo que sigue abierto.",
      "«Disponibilidad por semana» enseña la disponibilidad contra la meta del 98 % y, debajo y en las mismas semanas, las fallas y los preventivos a tiempo o tarde: así se ve si una semana mala vino de fallas o de preventivo atrasado.",
      "El Pareto dice cuántas máquinas juntan el 80 % de las horas paradas; clic en una barra abre su ficha.",
      "«Carga de preventivo» proyecta de cada plan los preventivos de las próximas 8 semanas, por criticidad y con horas de técnico estimadas, para repartir antes las semanas pesadas.",
      "«Fallas contra tiempo de reparación» separa las máquinas que fallan seguido (crónicas: causa raíz, preventivo) de las que tardan en volver (agudas: refacciones, proveedor).",
      "«Lo abierto» reparte las órdenes abiertas por antigüedad; «Vuelven a fallar», las reparaciones que no duraron 30 días; «Horas del técnico», las horas de las órdenes cerradas, por quien las atendió. En «Por máquina» ves todo por máquina (clic abre su ficha) y lo descargas en CSV.",
      "Los números salen de las órdenes de mantenimiento: cuándo se reportó, cuándo se paró y volvió la máquina, cuándo se cerró y las horas del técnico. Si una orden se cierra sin esos datos, no cuenta bien. Quien ve costos también ve lo que costó cada máquina.",
      "Todos los tiempos (disponibilidad, horas paradas, MTBF y MTTR) son horas laborales del taller: no cuentan noches, fines de semana, feriados ni descansos, con el horario que pone la gerencia de producción. Lo dado de baja cuenta solo hasta el día de su baja.",
    ],
  },
  "/servicio/maquinas": {
    resumen: "El catálogo de máquinas, herramienta, vehículos, instalaciones y equipo de oficina: en qué estado está cada uno, cuánto ha fallado y qué preventivo le toca.",
    pasos: [
      "Si algo falla, dale «Reportar falla», elige la máquina y di qué le pasa.",
      "Usa las pestañas Máquinas, Órdenes abiertas y Preventivos; clic en un renglón abre su detalle.",
      "Para trabajar una orden con el tiempo contado, abre «Terminal» y dale play.",
    ],
    detalle: [
      "La lleva mantenimiento (o la gerencia de producción); el personal de producción reporta fallas y presta herramienta. «Nueva máquina» y «Etiquetas QR» solo le salen a quien la lleva.",
      "El estado no se captura: sale de las órdenes de mantenimiento abiertas. Operando, Con falla (sigue trabajando pero alguien reportó algo), Parada (la falla la detiene) y En reparación.",
      "Los indicadores te llevan a lo suyo: Paradas filtra lo que tiene algo pendiente, Con falla reportada abre las órdenes, Preventivos vencidos abre los preventivos y Herramienta prestada te lleva a Resguardos.",
      "En Máquinas, clic abre su ficha. En Órdenes abiertas (fallas y preventivos), el detalle se abre a un lado. En Preventivos, clic abre su orden si ya salió o, si no, la ficha de la máquina.",
      "Un preventivo se programa por fecha (cada tantos días, «el primer lunes de cada mes» o «el día 15»), por horas de uso o lo que pase primero, y su orden se genera sola con el checklist de su rutina. Si cae en día que el taller no trabaja, pasa al siguiente que sí (así viene cada plan).",
      "«Terminal» abre la pantalla de mantenimiento para darle play a la máquina que vas a trabajar y pausa al dejarla. «Resguardos» lleva la herramienta prestada.",
      "«Etiquetas QR» abre una hoja para imprimir y recortar las etiquetas de todas las máquinas (o de las del filtro que tengas puesto). Pegada en la máquina, quien vea una falla la escanea con el celular y le sale el reporte de esa máquina, sin buscarla.",
      "En Máquinas, el filtro «Dadas de baja» muestra lo que ya no conviene reparar, con la fecha y el motivo. Al dar de alta, la categoría se elige de la lista o se escribe una nueva (impresora, aire acondicionado…); el tipo «Equipo de oficina» es para computadoras, impresoras y lo demás que no es del taller.",
      "Al abrir una orden preventiva, cada punto del checklist se marca Bien o Falla (con qué tiene); la orden no se cierra mientras falte alguno.",
      "Al cerrar una orden, mantenimiento anota qué se hizo y las horas que le dedicó (no las que estuvo parada la máquina); si le dieron play en la terminal, las horas ya vienen llenas.",
    ],
  },
  "/servicio/terminal": {
    resumen: "Para llevar el tiempo de cada reparación o preventivo sin anotarlo: le das play a la orden que vas a trabajar y pausa cuando la dejas.",
    pasos: [
      "Busca la máquina por número o nombre, o elígela en Preventivos por hacer o Fallas reportadas.",
      "Dale Play al empezar; al dejarla, dale Pausa y elige por qué.",
      "Toca la tarjeta para abrir la orden: checklist, diagnóstico y refacciones.",
    ],
    detalle: [
      "La usan mantenimiento y el personal de piso que atiende máquinas. Quien no es del personal de mantenimiento ve lo que está en trabajo, pero no da play.",
      "Arriba está lo que traes en play (con cuánto llevas) y luego lo que está en pausa, primero lo último que pausaste, para regresar rápido. Abajo, los preventivos por hacer (los vencidos primero) y las fallas reportadas (las que tienen la máquina parada y las más críticas primero).",
      "Dar play en otra orden pausa la que traías: una persona trabaja una a la vez. Al pausar eliges por qué («Esperando refacción», «Me voy a otra», «Fin del día») o «Solo pausar». Si dos personas trabajan la misma máquina, cada quien le da play y sus horas se suman.",
      "En la orden palomeas el checklist, escribes el diagnóstico y pides refacciones. El play no pide diagnóstico; ese se escribe cuando ya sabes qué tiene.",
      "La orden la cierran mantenimiento o la gerencia de producción, y al cerrarla las horas trabajadas salen solas de los play.",
    ],
  },
  "/servicio/maquinas/:id": {
    resumen: "La ficha de una máquina o herramienta: sus datos, por qué tiene su criticidad, su historial de mantenimiento, sus planes preventivos y, si se presta, quién la tiene.",
    pasos: [
      "Si falla, dale «Reportar falla»: ya sale con esta máquina elegida.",
      "Si tiene horómetro, anota su lectura con «Registrar horas».",
      "Si la llevas, en «Plan preventivo» dale «Agregar» y elige cuándo toca y su rutina.",
    ],
    detalle: [
      "La tarjeta «Criticidad» dice por qué la máquina tiene la que tiene: los puntos de cada factor. Dos los califica mantenimiento con el lápiz (qué pasa si se para y su riesgo de seguridad); las fallas y el costo del año salen de sus órdenes; el respaldo y los días de refacción los busca el sistema, y se pueden corregir.",
      "La criticidad se recalcula sola al reportar o cerrar una falla y cada madrugada. Mientras falten los dos que se califican, se queda la de la hoja. Muy alta o alta es crítica: sus fallas van primero.",
      "Fallas y tiempo parada cuentan los últimos 12 meses. También dice el tipo de mantenimiento (preventivo, predictivo o autónomo), quién lo hace y, si es herramienta que siempre trae la misma persona, a quién está asignada.",
      "La lectura del horómetro no puede ser menor que la anterior y, al guardarla, si ya toca un preventivo por horas, su orden sale en ese momento.",
      "En «Historial de mantenimiento», clic en una orden la abre a un lado. «Prestar» te lleva a Resguardos con esta herramienta ya elegida.",
      "En «Plan preventivo» mantenimiento o la gerencia agregan o editan los planes y les ponen su rutina: la lista de puntos que se palomean.",
      "En «Cuándo toca» eliges cada tantos días, un día de la semana del mes (el primer lunes, el último viernes) o un día fijo del mes, cada uno o cada varios meses; además puede ser cada tantas horas de uso, lo que pase primero. Abajo te dice qué día toca el siguiente.",
      "Si cae en fin de semana, feriado o descanso, pasa al siguiente día que se trabaja (en los planes por mes, sin brincarse al mes siguiente); esa casilla viene marcada. La orden se genera sola: por fecha, unos días antes de vencer; por horas, al llegar a ellas.",
      "«Manuales y fichas técnicas» junta el manual, la ficha técnica, diagramas y garantía: un PDF, una foto o una liga de Drive. Al agregarlo eliges si es solo de esta máquina o de todas las de su tipo y modelo.",
      "«Etiqueta QR» la enseña para imprimirla y pegarla en la máquina; en un Android con Chrome también la graba en una etiqueta NFC.",
      "Lo que ya no conviene reparar se da de baja con «Dar de baja» y el motivo: sus órdenes abiertas se cancelan, sus planes se apagan y deja de contar en las métricas. Si estaba prestada, primero se recibe en Resguardos.",
      "Se puede reactivar desde la misma ficha; sus planes se quedan apagados hasta que los prendas.",
      "Abajo, «Refacciones de este tipo de máquina» lista las piezas que lleva (por tipo y modelo) y cuántas hay en planta; se piden desde una orden de mantenimiento.",
    ],
  },
  "/servicio/rutinas": {
    resumen: "Las rutinas de mantenimiento: la lista de puntos que se palomea en cada preventivo, por tipo de máquina y frecuencia.",
    pasos: [
      "Dale «Nueva rutina» y ponle nombre, tipo de máquina y frecuencia.",
      "Escribe cada punto con su sección; Enter agrega otro debajo.",
      "Dale Guardar y elígela en el plan preventivo de cada máquina, desde su ficha.",
    ],
    detalle: [
      "Las edita el encargado de mantenimiento (o la gerencia de producción); los demás las ven. Clic en una rutina la abre a un lado.",
      "Cada punto lleva su sección (Seguridad, Limpieza, Eléctrico…) y qué se revisa; con las flechas los acomodas. Las recomendaciones salen arriba del checklist en cada orden. «Duplicar» sirve para hacer la trimestral a partir de la mensual.",
      "Al guardar, los preventivos que ya salieron con esa rutina y nadie ha empezado toman la lista nueva; los que ya se están palomeando se quedan como estaban.",
      "La columna «La usan» dice qué máquinas la tienen en un plan preventivo activo; mientras alguno la use, no se puede desactivar. El filtro «Desactivadas» enseña las que ya no salen para elegir en los planes.",
    ],
  },
  "/servicio/resguardos": {
    resumen: "Aquí se anota quién se lleva una herramienta del taller (a campo o a otra área), desde cuándo y cómo la regresó.",
    pasos: [
      "Dale «Prestar herramienta»: elige la herramienta, quién se la lleva y para qué o para qué servicio.",
      "Cuando regrese, dale «Recibir» en su renglón y marca si llegó bien, dañada o incompleta.",
    ],
    detalle: [
      "Lo usan mantenimiento, la gerencia y el personal de producción. La herramienta que siempre trae la misma persona (su soldadora) no se presta aquí: se asigna en la ficha de la máquina.",
      "Al prestar, para qué o para qué servicio es obligatorio (uno de los dos) y la fecha de regreso es opcional. Una máquina parada o en reparación no se presta.",
      "Al recibir, si quieres, tomas una foto de cómo regresó; si regresa dañada o incompleta, la falla se reporta sola, con la foto.",
      "Sale en rojo lo que pasó de su fecha de regreso o lleva más días fuera que el límite. El límite lo cambias junto a los filtros («Marcar después de … días»). Los filtros son Prestadas, Sin regresar y Regresadas (el historial).",
    ],
  },
};

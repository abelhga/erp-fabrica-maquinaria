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
  "/servicio/maquinas": [
    "El catálogo de máquinas, herramienta y vehículos del taller: en qué estado está cada una, cuánto ha fallado y qué mantenimiento preventivo le toca. Lo usan la gerencia y el personal de producción.",
    "El estado no se captura: sale de las órdenes de mantenimiento abiertas. Operando, Con falla (sigue trabajando pero alguien reportó algo), Parada (la falla la detiene) y En reparación. \"Reportar falla\" abre el formulario rápido y \"Resguardos\" lleva la herramienta prestada.",
    "Pestañas: Máquinas (clic abre su ficha), Órdenes abiertas (fallas y preventivos; clic abre el detalle a un lado) y Preventivos. Un preventivo se programa por fecha, por horas de uso o lo que pase primero, y su orden se genera sola.",
  ],
  "/servicio/maquinas/:id": [
    "La ficha de una máquina o herramienta: sus datos, su historial de mantenimiento, sus planes preventivos y, si se presta, quién la tiene.",
    "Fallas y tiempo parada cuentan los últimos 12 meses. \"Crítica\" quiere decir que, si se para, se para el área. Si tiene horómetro, registra sus horas con \"Registrar horas\": la lectura no puede ser menor que la anterior y, al guardarla, si ya toca un preventivo por horas, su orden sale en ese momento.",
    "En \"Plan preventivo\" la gerencia agrega o edita los planes (cada tantos días, cada tantas horas o lo que pase primero). La orden se genera sola: por fecha, unos días antes de vencer; por horas, al llegar a ellas.",
  ],
  "/servicio/resguardos": [
    "Aquí se anota quién se lleva una herramienta del taller (a campo o a otra área), desde cuándo y cómo la regresó. Lo usan la gerencia y el personal de producción.",
    "\"Prestar herramienta\" registra quién se la lleva, para qué servicio y cuándo debe regresar. \"Recibir\" la cierra con su estado: bien, dañada o incompleta; si regresa dañada o incompleta, la falla se reporta sola. Una máquina parada o en reparación no se presta.",
    "Sale en rojo lo que pasó de su fecha de regreso o lleva más días fuera que el límite. El límite lo cambias junto a los filtros (\"Marcar después de … días\").",
  ],
};

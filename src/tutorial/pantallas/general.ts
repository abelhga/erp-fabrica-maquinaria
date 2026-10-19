import type { AyudaPantalla } from "./index";

export const GENERAL: Record<string, AyudaPantalla> = {
  "/": [
    "Es tu punto de partida del día. Lo que ves depende de tu puesto: dirección ve el centro de mando de toda la empresa; los demás ven solo lo que le importa a su área (ventas sus ventas y cotizaciones, finanzas lo que se cobra y se paga, importaciones sus embarques, producción el taller, recepción los leads que registró…). Si tienes dos puestos, ves lo de los dos.",
    "Arriba, “Lo que importa hoy” junta lo urgente de tu área: en rojo los riesgos, en ámbar lo que pide atención, en verde lo que va bien. Dale clic a una tarjeta para ir directo a donde se atiende; el botón de flechas lo vuelve a analizar.",
    "Casi todos los indicadores se abren con un clic y te llevan a la lista de donde salen (Ventas del mes abre los pedidos, por ejemplo). Todo se calcula con tus permisos: un vendedor ve lo suyo, no el total de la empresa.",
    "En el tablero de área, la tarjeta “Pendientes” reúne lo que espera algo de ti según tu puesto: precios por autorizar, seguimientos vencidos con clientes, ajustes de inventario, compras atrasadas, documentos de embarques que faltan. En el centro de mando las cifras se actualizan solas cuando alguien registra un pedido, un cobro o un avance del taller.",
  ],
  "/pendientes": [
    "Aquí ves lo que te pidieron a ti y lo que tú les pediste a otros, con fecha. Reemplaza el “¿ya quedó?” por chat: cuando alguien termina, a quien lo pidió le llega un aviso en la campana.",
    "“Me tocan” son los tuyos: dale clic al círculo para marcarlo hecho y, si quieres, deja una respuesta corta (un precio, una fecha). “Los que pedí” son los que esperas de otros; si ya no hace falta, cancélalo con la X. La flecha te lleva al pedido, orden o pantalla de donde salió.",
    "La fecha sale en ámbar si vence hoy y en rojo si ya venció; mientras siga vencido, el sistema les recuerda a los dos. Para pedir algo nuevo usa “Pedir algo a alguien”: qué hay que hacer, quién y para cuándo.",
  ],
  "/semana": [
    "Tu resumen de los lunes: lo que pasó la semana pasada comparado con la anterior, y lo que viene en esta. Sirve para preparar la junta o para saber de un vistazo cómo vamos.",
    "Arriba, “La semana en una frase” la narra Claude con los números (o las reglas del ERP si no está conectado); el botón de flechas la vuelve a escribir. En las tarjetas, el porcentaje compara contra la semana anterior: verde si subió, rojo si bajó.",
    "La agenda “Esta semana” junta todo lo que tiene fecha de lunes a domingo: entregas, órdenes de taller, compras que llegan, embarques y servicios. Lo que ya pasó su fecha y sigue abierto sale en rojo. Dale clic a un renglón para ir a su lista.",
    "Si eres vendedor, las ventas y “Quién compró más” son solo de tus clientes. Las ventas de esta pantalla van con IVA, como en el libro de ventas de la hoja.",
  ],
};

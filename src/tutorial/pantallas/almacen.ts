import type { AyudaPantalla } from "./index";

export const ALMACEN: Record<string, AyudaPantalla> = {
  "/almacen/existencias": [
    "Aquí ves cuánto hay de cada componente y materia prima, en qué almacén está, cuánto ya está apartado y, si tu puesto lo ve, cuánto viene en camino. Sirve para saber si algo se puede surtir sin ir a buscarlo al estante.",
    "Busca por clave o nombre y usa los filtros de arriba de la tabla: Apartados, En tránsito, Negativos o Todos. El selector de almacén deja solo lo que hay en ese almacén. Dale clic a un renglón para abrir el artículo a un lado: ahí ves cuánto hay en cada almacén, para qué orden o pedido está apartado y, si te toca, su kardex. El botón de CSV baja la lista para Excel.",
    "La columna que importa es Disponible: lo que hay en planta menos lo apartado. Lo del Full de Mercado Libre existe, pero no cuenta para planta. Un número en rojo es existencia negativa: salió algo cuya entrada nunca se registró, y se corrige con un conteo y un ajuste. La tabla se actualiza sola cuando alguien registra un movimiento.",
  ],
  "/almacen/movimientos": [
    "Aquí se registra todo lo que sale, regresa o cambia de almacén, y se consulta la historia de cada movimiento. La usa almacén desde el celular o la computadora; la gerencia entra a autorizar ajustes.",
    "En Registrar elige Salida (consumo o venta), Devolución o Traspaso, busca el artículo, toca el almacén (cada botón dice cuánto hay ahí), escribe la cantidad y el motivo. Enter en la cantidad te pasa al motivo; Enter otra vez guarda. Los botones de motivo llenan el texto por ti. No deja sacar más de lo que hay en ese almacén. A la derecha ves lo que registraste hoy para confirmar que quedó bien.",
    "Historial filtra por tipo, almacén, persona y fechas (al abrir, los últimos 30 días) y se baja a Excel. En Ajustes pides una corrección cuando lo del estante no cuadra, y la gerencia la aprueba o la rechaza. En Conteos físicos abres un conteo por almacén, capturas lo contado renglón por renglón (Enter guarda y baja al siguiente) y, al cerrarlo, cada diferencia se vuelve un ajuste por autorizar.",
    "Nada se edita ni se borra. Si te equivocaste, no lo vuelvas a capturar al revés: pide un ajuste. La fecha, la hora y tu nombre los pone el sistema, así que no se puede capturar con fecha atrasada ni a nombre de otro.",
  ],
  "/almacen/reabasto": [
    "Te dice qué componentes y materias primas hay que pedir, cuánto y por qué. Compras la usa para generar órdenes de compra y almacén para pedirle material a compras.",
    "Abre en \"A ordenar\" si hay algo abajo de su punto de reorden. Marca las casillas (la de arriba elige todos los que tienen sugerido) y, según tu puesto, dale \"Generar órdenes de compra\" (salen en borrador, separadas por proveedor) o \"Pedir a compras\" (sale una requisición). Si algo ya está en una orden en borrador o en una requisición, se ve debajo del sugerido para que no lo pidas dos veces.",
    "La regla es la de la hoja Demanda: un artículo genera demanda si tuvo consumo en suficientes meses de los últimos seis, y su demanda es el promedio de esos meses. El punto de reorden es la demanda de los días que tarda en llegar más el stock de seguridad. Si el disponible (en planta − apartado + en tránsito) queda abajo, se sugiere el lote (1 mes de cobertura si es nacional, 6 si es importado) más lo que falta para el punto de reorden, redondeado al empaque. La regla vigente está al pie de la tabla y el botón \"¿por qué?\" hace la cuenta con los números de cada artículo.",
    "Cobertura y Seguridad se cambian ahí mismo si tu puesto puede: escribe y Enter guarda; vacío regresa al valor normal. Los días de entrega son los reales del proveedor cuando ya hay historia. Excedente es lo que no se usó en 12 meses y sigue en el estante.",
  ],
  "/almacen/envios": [
    "Aquí se sigue cada envío desde que se pide en un pedido hasta que el cliente lo recibe: cotización y guía de paquetería, empaque con fotos y check list, salida y entrega. Ventas pide, cotiza y registra la guía; almacén empaca y marca la salida.",
    "Las pestañas son la fila de trabajo, de izquierda a derecha: Por cotizar y guía, Por empacar, Hoy salen o recogen, En camino y Entregados (los de los últimos 60 días). Dale clic a un renglón para abrir el envío a un lado: arriba ves cada paso con quién y cuándo, y el botón del paso que sigue.",
    "Empacar pide fotos del paquete, el check list completo y, si es un equipo, su número de serie, que tiene que ser el de su orden de producción. Esa evidencia no se puede cambiar ni borrar. Al marcar que salió, se descuenta del inventario lo que falte, una sola vez y sin tocar lo apartado para otros; lo que surte Full sale de Almacén ML.",
    "Si manejas envíos, arriba ves el saldo de cada paquetería de prepago (recargas menos guías); se pone en rojo abajo del mínimo. Almacén arma desde aquí los envíos para reabastecer el Full de Mercado Libre.",
  ],
};

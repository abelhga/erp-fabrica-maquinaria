import type { Ayuda } from "./index";

// Sistema lo usan sistemas y dirección. Los botones, columnas y tarjetas se explican en sus globos
// (glosario de sistema): aquí solo queda para qué sirve cada pantalla, lo mínimo para usarla y, en
// «detalle», el resto de las reglas, porque el asistente lee esto como su manual.
export const SISTEMA: Record<string, Ayuda> = {
  "/sistema/usuarios": {
    resumen: "Aquí decides quién entra al ERP y qué puede hacer cada quien. La usan sistemas y dirección.",
    pasos: [
      "En «Usuarios», dale clic a una persona para darle o quitarle roles.",
      "«Espera rol»: márcale su rol. «Empleado dado de baja»: ábrelo y dale «Desactivar».",
      "Para quien aún no entra, o para la TV y la tablet, usa «Invitaciones y pantallas».",
    ],
    detalle: [
      "Cada persona tiene uno o varios roles (Ventas, Almacén, Recursos humanos…) y cada rol tiene, en cada módulo, un nivel: 1 ver, 2 capturar, 3 administrar (aprobar, borrar, configurar). Si alguien tiene dos roles, vale el nivel más alto.",
      "La pestaña «Permisos por rol» muestra la tabla completa. Solo dirección la cambia, y dirección siempre tiene todo. Si le das Costos a un rol que no lo tenía, te pide confirmar: toda la gente con ese rol verá lo que cuesta cada equipo y cada componente. Márgenes (la utilidad y las políticas de precio) es un módulo aparte.",
      "Esconder una opción del menú es solo comodidad: lo que de verdad protege un dato es que el ERP no se lo entrega a quien no tiene permiso, aunque lo busque por otro lado.",
      "Al desactivar una cuenta, la persona pierde todo al instante, aunque tenga la sesión abierta; sus roles se guardan para cuando regrese. «Espera rol» es alguien que ya entró con Google pero todavía no puede ver nada. «Empleado dado de baja», en rojo, es alguien que RRHH ya dio de baja y sigue pudiendo entrar: desactívalo.",
      "Nadie cambia sus propios roles ni desactiva su propia cuenta. Solo dirección da el rol de dirección y desactiva a alguien de dirección. Los cambios valen cuando la persona recarga el ERP y quedan en la bitácora.",
      "En «Invitaciones y pantallas» dejas lista la cuenta de alguien antes de que entre: al entrar por primera vez recibe los roles de la invitación. Un correo de fuera de la empresa solo entra si está invitado, y su invitación tiene que llevar al menos un rol. No se manda ningún correo: avísale tú.",
      "Ahí mismo creas las cuentas de los aparatos del taller, que no necesitan cuenta de Google: la de la TV solo ve el tablero de piso y la de la tablet solo abre la terminal. La contraseña se muestra una sola vez: guárdala.",
      "«Ver como», en el encabezado: dirección puede ver el ERP con los permisos de otro rol para revisar qué ve esa gente. Una franja te recuerda que estás simulando, y lo que guardes mientras tanto es real y queda a tu nombre.",
      "Dirección y sistemas también pueden abrir la sesión de una persona en particular en otra pestaña, con sus pedidos y sus avisos: es solo para ver, no deja guardar nada y queda registrado.",
    ],
  },
  "/sistema/importar": {
    resumen: "Cómo va la migración desde las hojas de Google: qué se trajo, si los precios cuadran con la hoja y qué falta limpiar. Para sistemas y dirección durante la transición.",
    pasos: [
      "Mira «Precios de equipo iguales a Nuevo Costeo»: si alguno difiere, revísalo antes de cotizarlo.",
      "Atiende lo que liste «Para revisar»: son problemas que ya traían las hojas.",
      "Si editas listas de materiales, dale «Convertir en subensamble» o «Descartar» a cada grupo sugerido.",
    ],
    detalle: [
      "El indicador de precios compara los precios de equipo que calcula el ERP contra los de «Nuevo Costeo». «Lo que se leyó» cuenta lo que trajo la última importación de cada hoja, no lo que hay hoy en el ERP. «Para revisar» lista lo que hay que limpiar: nombres repetidos, materiales fuera del catálogo, existencias negativas que no se cargaron…",
      "Las existencias de arranque se cargaron una sola vez, por artículo y almacén. Después del día de corte, una diferencia se corrige con un ajuste de inventario autorizado, no reimportando. Arriba también ves cuánto historial de precios de compra se trajo (desde 2011) y las ventas históricas de los paneles, que le dan a cada cliente su historia de compras.",
      "«Subensambles escondidos» propone grupos de piezas que se repiten idénticos en varios equipos porque las listas se copiaron. Quien edita listas de materiales puede convertirlos en subensamble (le pone nombre y clave y queda en un solo lugar para todos esos equipos) o descartarlos. El costo no cambia.",
      "La reimportación se corre desde una computadora, no desde esta pantalla: los pasos están en «Cómo volver a importar». Actualiza por clave, así que no duplica, y no vuelve a cargar las existencias de arranque.",
    ],
  },
  "/sistema/uso": {
    resumen: "Quién usa el ERP, cuánto, en qué y cuánto cuesta la IA, para acompañar a quien se queda en la hoja o el papel. Para dirección y sistemas.",
    pasos: [
      "Elige arriba el periodo, el rol y qué medir; con «Comparar» ves también el periodo anterior.",
      "Abre «Sin usarlo» para ver a quién conviene acompañar.",
      "Dale clic a una persona para ver su detalle: días, pantallas, cambios, IA y horas.",
    ],
    detalle: [
      "Sirve para acompañar a quien se está quedando en la hoja, en el papel o en WhatsApp, ver qué pantallas de verdad se usan y cuidar el gasto de la IA.",
      "El periodo (7, 30 o 90 días) cambia todo. El rol deja solo a esa gente en los indicadores, la tabla, el mapa de calor y las gráficas por persona; la gráfica día por día y la de en qué se va el costo de la IA siguen contando a todos.",
      "«Medir» (tiempo activo, cambios, consultas a la IA, su costo o personas activas) cambia la gráfica día por día, la de cada persona y el mapa de calor; los indicadores y la tabla no cambian.",
      "Los indicadores dicen cuánto subió o bajó cada cosa contra el periodo anterior del mismo largo.",
      "Las gráficas: la medida día por día (la línea punteada es el periodo anterior); cada persona contra sí misma (barra gris = antes); y el mapa de calor, un cuadro por persona y día, más oscuro entre más uso.",
      "Abajo de esas, en qué secciones del ERP se le va el tiempo a cada quien y en qué se va el costo de la IA (resúmenes, preguntas, documentos, revisión nocturna…).",
      "Abajo, la tabla por persona. «Personas» son las cuentas activas sin la TV ni la tablet del taller; «Sin usarlo», las que no hicieron nada en el periodo; «Todas las cuentas» suma las desactivadas y los aparatos del taller.",
      "Al darle clic a una persona ves su tiempo y sus cambios por día, las pantallas que más usa, en qué registra cambios, para qué usa la IA y cuánto costó, y a qué horas trabaja.",
      "El tiempo activo cuenta solo los minutos en que la persona estuvo moviéndose en el ERP con la pestaña a la vista; dejarlo abierto no suma. No se guarda qué datos vio, solo qué pantalla.",
      "El costo de la IA es un estimado con los precios del proveedor que tiene guardados el ERP; lo que factura el proveedor manda. El total suma la revisión nocturna, que no es de nadie, solo con «Todos los roles».",
      "El tiempo y las pantallas se cuentan desde el 5 de noviembre de 2026; los cambios y la IA traen su historia de antes.",
    ],
  },
  "/sistema/bitacora": {
    resumen: "Quién cambió qué y cuándo en el ERP: altas, cambios y bajas de pedidos, clientes, usuarios, permisos, configuración y lo demás. Nada se borra de aquí.",
    pasos: [
      "Filtra arriba por «Qué», «Quién», «Acción» o las fechas «Desde» y «Hasta».",
      "Dale clic a un renglón para ver el antes y el después de cada dato.",
    ],
    detalle: [
      "La columna «Registro» dice de qué es cada cambio: el folio, el nombre o la clave. En las listas de materiales, el equipo, el artículo y la cantidad; en el material de una orden, la OP, el artículo y cuánto lleva. «Sistema», en «Quién», es un proceso automático del ERP, no una persona.",
      "En el detalle, los artículos, órdenes y personas salen con su nombre. Abajo está la historia de ese registro (sus últimos 50 cambios) y, si tiene pantalla, «Abrir el registro» te lleva a ella. El CSV baja lo que ves.",
      "Se muestran los 500 cambios más recientes: para ir más atrás usa los filtros. Solo ves los cambios de lo que tu rol puede ver: sueldos y datos sensibles necesitan Recursos humanos nivel 3; los costos, el módulo de Costos; las políticas de precio, el de Márgenes, y los cambios del costo de un artículo y del historial de costeo, los dos.",
    ],
  },
  "/sistema/configuracion": {
    resumen: "Datos de la empresa y catálogos que usan todas las pantallas: IVA, almacenes, etapas del taller, tipos de cambio, reglas de venta e integraciones. Para sistemas y dirección.",
    pasos: [
      "Elige la pestaña de lo que quieres cambiar: Empresa, Ventas, Almacenes, Taller, Tipos de cambio o Integraciones.",
      "En las tarjetas con formulario, cambia los datos y dale «Guardar».",
      "En las tablas, la celda se guarda sola al salir de ella o con Enter; Escape la regresa.",
    ],
    detalle: [
      "También están los datos fiscales, la fecha de arranque, el tema con el que abre el ERP (oscuro o claro), los minutos para deshacer errores y la semana laboral. Lo que tu rol no puede cambiar sale en solo lectura y dice quién sí puede. Cada cambio queda en la bitácora.",
      "Algunas cosas mueven números en otras pantallas: la semana laboral y los descansos cuentan los días de vacaciones y permisos; la fecha de arranque marca el corte entre la hoja y el ERP; un almacén no disponible para planta no cuenta para producción ni para el cotizador; el tipo de cambio más reciente convierte los costos en dólares y los saldos de proveedores y clientes (una cotización o un pedido en dólares guarda el suyo).",
      "En «Taller», la capacidad de las áreas automáticas sale de su gente (no se escribe a mano) y la de las demás sí. En «Almacenes», con «Consumibles del taller» prendido, lo de las categorías marcadas sale a nombre de quien lo recibe y no a la orden; al prenderlo se suelta lo que estaba apartado de esos artículos para órdenes.",
      "En «Empresa», «Deshacer errores» fija cuántos minutos tiene quien se equivocó para deshacer una salida o un traspaso en almacén, y para reabrir un pendiente que cerró (15 de inicio). En 0 se apaga: almacén pide un ajuste y el pendiente se pide de nuevo.",
      "En «Ventas», la tarjeta «Leads de recepción» dice a quién le llega cada lead nuevo: bandeja (el primero que lo toma), la gerencia de ventas lo asigna o recepción elige al vendedor. La cambian la gerencia de ventas o dirección.",
      "Ahí mismo se ponen las horas para avisar a la gerencia si nadie toma un lead o nadie lo atiende, y qué vendedores reciben leads.",
      "En «Integraciones», dirección conecta la cuenta de Mercado Libre (los pasos vienen ahí mismo), elige quiénes la atienden, si las ventas entran como pedidos y a nombre de quién quedan. Los avisos les llegan a quienes la atienden y también a la persona a cuyo nombre quedan las ventas; si no hay nadie, a una persona de dirección. Si eliges a alguien invitado que todavía no entra, le empiezan a llegar en cuanto entre.",
      "La tarjeta dice si los avisos de Mercado Libre están entrando; «Revisar ahora» vuelve a intentar lo que quedó pendiente. Mercado Libre solo avisa lo nuevo: «Traer lo pendiente» trae las preguntas sin contestar y los reclamos que ya estaban y, si las ventas entran como pedidos, las ventas desde la fecha que elijas.",
      "En la tarjeta de Skydropx, quien administra envíos prueba la conexión (muestra el saldo) y elige la dirección de la planta de las que ya están en Skydropx, la clave de carta porte, el tipo de empaque y el formato de la guía. Sin dirección y carta porte no se puede generar guía.",
      "Ahí también pone el recargo que se le suma al flete cuando un vendedor lo cotiza en una cotización.",
      "La tarjeta «Teléfono (recepción con IA)» dice si el conmutador está mandando las llamadas y cuándo llegó la última. Para conectarlo, en Railway se ponen ERP_URL (la dirección que viene ahí, con su botón de copiar) y ERP_LLAVE, la llave que genera dirección con «Generar llave».",
      "La llave se ve una sola vez: cópiala al momento. Generar otra deja sin servir la anterior. En «Quién contesta» dirección liga cada nombre del conmutador a su persona del ERP; los que traen el mismo teléfono que su perfil se ligan solos. Al ligarlo, sus llamadas y sus calificaciones de coaching anteriores quedan a su nombre.",
    ],
  },
};

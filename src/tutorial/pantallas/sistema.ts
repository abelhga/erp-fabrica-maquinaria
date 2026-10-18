import type { AyudaPantalla } from "./index";

export const SISTEMA: Record<string, AyudaPantalla> = {
  "/sistema/usuarios": [
    "Aquí decides quién entra al ERP y qué puede hacer cada quien. La usan sistemas y dirección.",
    "Así funcionan los permisos: cada persona tiene uno o varios roles (Ventas, Almacén, RR. HH.…) y cada rol tiene, en cada módulo, un nivel: 1 ver, 2 capturar, 3 administrar (aprobar, borrar, configurar). Si alguien tiene dos roles, vale el nivel más alto. La pestaña «Permisos por rol» muestra la tabla completa; solo dirección la cambia y dirección siempre tiene todo. Esconder una opción del menú es comodidad: lo que de verdad impide ver un dato es la base, que no se lo entrega a quien no tiene permiso.",
    "En «Usuarios» dale clic a alguien para darle o quitarle roles, o para desactivar su cuenta (pierde todo al instante, aunque tenga la sesión abierta). «Espera rol» es alguien que ya entró con Google pero todavía no puede ver nada; en rojo, «Empleado dado de baja», alguien que RRHH ya dio de baja y sigue pudiendo entrar: desactívalo. Nadie cambia sus propios roles, solo dirección da el rol de dirección y los cambios valen cuando la persona recarga el ERP. En «Invitaciones y pantallas» dejas lista la cuenta de alguien antes de que entre y creas la de la TV del taller.",
    "«Ver como», en el encabezado: dirección puede ver el ERP con los permisos de otro rol para revisar qué ve esa gente; una franja te recuerda que estás simulando, y lo que guardes mientras tanto es real y queda a tu nombre. Dirección y sistemas también pueden abrir la sesión de una persona en particular en otra pestaña, con sus pedidos y sus avisos: es solo para ver, no deja guardar nada y queda registrado.",
  ],
  "/sistema/importar": [
    "Aquí ves cómo va la migración desde las hojas de Google: qué se trajo, si los precios del ERP cuadran con los de la hoja y qué problemas de las hojas quedaron a la vista. La usan sistemas y dirección durante la transición.",
    "Arriba, el indicador de precios compara los precios de equipo del ERP contra «Nuevo Costeo»: si alguno sale distinto, revísalo antes de cotizarlo. «Lo que se leyó» cuenta lo que trajo la última importación y «Para revisar» lista lo que hay que limpiar.",
    "«Subensambles escondidos» propone grupos de piezas que se repiten idénticos en varios equipos; quien edita listas de materiales puede convertirlos en subensamble o descartarlos, y el costo no cambia. La reimportación se corre desde una computadora (instrucciones abajo) y no duplica nada; las existencias de arranque se cargaron una sola vez.",
  ],
  "/sistema/bitacora": [
    "Aquí queda quién cambió qué y cuándo en el ERP: altas, cambios y bajas de pedidos, clientes, usuarios, permisos, configuración y lo demás. Nada se borra de aquí.",
    "Filtra por qué se cambió, quién, el tipo de acción y las fechas. Dale clic a un renglón para ver el antes y el después de cada dato, la historia completa de ese registro y, si existe, un enlace para abrirlo. El CSV baja lo que ves.",
    "Se muestran los 500 cambios más recientes: para ir más atrás usa los filtros. Solo ves los cambios de lo que tu rol puede ver: sueldos y datos sensibles necesitan Recursos Humanos nivel 3, y costos, el módulo de costos.",
  ],
  "/sistema/configuracion": [
    "Aquí están los datos de la empresa y los catálogos que usan todas las pantallas: datos fiscales, IVA, fecha de arranque, tema con el que abre el ERP (oscuro o claro), semana laboral, reglas de venta, almacenes, etapas del taller, tipos de cambio e integraciones (Mercado Libre y Skydropx). La usan sistemas y dirección.",
    "Cada pestaña es una sección. En las tarjetas con formulario cambias los datos y das «Guardar»; en las tablas cada celda se guarda sola al salir de ella o con Enter, como en la hoja (Escape la regresa). Lo que tu rol no puede cambiar sale en solo lectura y dice quién sí puede.",
    "Algunas cosas mueven números en otras pantallas: la semana laboral y los descansos cuentan los días de vacaciones y permisos; la fecha de arranque marca el corte entre la hoja y el ERP; un almacén no disponible para planta no cuenta para producción ni para el cotizador; el tipo de cambio más reciente convierte todo lo que está en dólares. Cada cambio queda en la bitácora.",
    "En «Integraciones», dirección conecta la cuenta de Mercado Libre (los pasos vienen ahí mismo) y elige quién la atiende. La tarjeta dice si los avisos de ML están entrando; «Revisar ahora» vuelve a intentar lo que quedó pendiente. En la de Skydropx, quien administra envíos prueba la conexión (muestra el saldo), elige la dirección de la planta de las que ya están en Skydropx, la clave de carta porte y el tipo de empaque; sin dirección y carta porte no se puede generar guía.",
  ],
};

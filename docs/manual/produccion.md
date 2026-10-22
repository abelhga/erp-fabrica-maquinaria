# Producción

## Equipos de stock: fabricarlos y venderlos

**Para qué:** tener equipos hechos (o avanzados) antes de que alguien los compre, para
entregar más rápido, y que al venderlos el ERP sepa de qué equipo se trata, sin fabricar otro.

**Quién:** la gerencia de producción decide qué se fabrica para stock y asigna cada equipo de
stock al pedido que lo compra. Ventas captura el pedido como cualquier otro.

### 1. Fabricar para stock

1. En **Producción → Órdenes y material**, botón **Orden para stock**.
2. Se elige el equipo y la cantidad. La orden se crea **sin pedido** y en el tablero dice
   «Para stock» en lugar del cliente.
3. A partir de ahí sigue el mismo camino que cualquier orden:
   - ingeniería revisa la lista de materiales;
   - se aparta el material y se piden los faltantes;
   - almacén revisa y la gerencia la libera;
   - el taller la trabaja en la terminal de piso.
4. Al crearse, la orden toma su número **OP** y, si el equipo tiene código, su **número de
   serie**. Los dos se quedan con el equipo aunque después se venda.

### 2. Cuando se vende

1. El vendedor captura el pedido normal en Ventas, con el equipo como partida.
2. En **Producción → Pedidos**, ese pedido sale en el filtro **Sin orden**, porque nadie está
   fabricando su equipo para ese cliente.
3. Al abrir el pedido, en la partida del equipo aparecen los botones **Usar OP-…**: uno por
   cada orden de stock que sirve. Solo la gerencia de producción los ve. Una orden de stock
   sirve si:
   - es **exactamente el mismo equipo** (la misma clave) que la partida;
   - no tiene pedido;
   - no está entregada ni cancelada. Puede estar planeada, en proceso o ya terminada.
4. Al darle **Usar OP-…**:
   - la orden pasa a ser de ese pedido y toma la **fecha compromiso del pedido**;
   - en la historia de la orden queda «Venía de stock: se asignó al pedido …»;
   - si el pedido estaba confirmado, pasa a **en producción**;
   - si con eso ya está todo terminado, el pedido queda **listo para entregar**.
5. Si la partida pide más equipos que los que hay en stock, se usan los que hay y
   **Crear las órdenes que faltan** fabrica solo el resto.

### Qué no se puede

- Usar una orden de stock de otro equipo (aunque se parezca, por ejemplo de otra medida).
  Si el cliente acepta el de stock, primero ventas corrige la partida del pedido.
- Asignarla a un pedido entregado o cancelado, o a una partida que ya tiene todas sus órdenes.
- Asignar una orden que ya es de otro pedido.

### Cómo se hacía antes

En la hoja, el equipo de stock vendido se anotaba con su número S (por ejemplo «S091-P691»)
en un texto, y el ERP no tenía cómo ligarlo al pedido. Ahora la liga es la orden: el pedido
la ve con su avance, la planta sabe para quién es y el número de serie llega con su cliente.

---

## Cuadrillas y terminal de piso

**Para qué:** saber quién trabaja qué en cada etapa, quién sigue, y medir las horas de cada
persona sin capturar dos veces.

**Quién:** la gerencia de producción arma las cuadrillas y la cola en **Producción →
Cuadrillas**. Los supervisores marcan en la **Terminal de piso** lo que pasa (iniciar,
pausar, terminar, quién entra y quién sale).

### Cómo se conectan

- Mientras una etapa está **en proceso**, su cuadrilla es la gente que tiene su tiempo
  contando en la terminal. No hay otra lista.
- Antes de empezar, o cuando está **pausada**, la cuadrilla es la que **planeó la gerencia**.
- Lo que se hace en un lado se ve en el otro al momento.

### En el tablero de cuadrillas (gerencia de producción)

1. Arriba está el personal por área. En verde, quien trabaja ahorita.
2. Para planear quién hace algo, arrastra a la persona a la tarjeta de esa etapa. En una
   tarjeta que no ha empezado, solo queda planeada (línea punteada).
3. Si arrastras a alguien a una etapa **en proceso**, o lo sacas de una donde está
   trabajando, el ERP pregunta antes de hacerlo. Si dices que sí:
   - su tiempo donde estaba se cierra en ese momento;
   - su tiempo nuevo empieza a contar.

   Es lo mismo que marcar «Sale» y «Se une» en la terminal.
4. Para sacar a alguien de una cuadrilla, arrástralo de la tarjeta al recuadro de Personal.
5. Para acomodar lo que sigue, arrastra una tarjeta de **En cola** encima de otra: queda
   antes de ella. La terminal muestra la cola en ese mismo orden.
6. Sin mouse (tablet o celular), toca la tarjeta. En su detalle están los mismos cambios con
   botones: Agregar, Sacar, Antes y Después.

### En la terminal (supervisor)

1. Las tarjetas que no han empezado dicen **Le toca: …** con la cuadrilla planeada.
2. Al **Iniciar** o **Reanudar**, esa cuadrilla ya viene marcada. Si trabaja otra gente,
   cámbiala ahí: manda lo que se hizo, y el tablero queda como arrancó.
3. **Se une** y **Sale** cambian la cuadrilla sin detener la etapa.
4. **Pausar** cierra los tiempos de todos, pero la cuadrilla se queda para reanudar.

### Reglas que conviene saber

- Una persona puede estar planeada en varias etapas: es su fila de trabajo. Pero solo puede
  estar **trabajando** en una a la vez.
- Iniciar, pausar y terminar se marca solo en la terminal. El tablero dice quién va, no
  arranca etapas.
- Las horas que «faltan» y las que tiene «encima» cada persona son una estimación: las horas
  estimadas menos las ya trabajadas, repartidas entre la cuadrilla.

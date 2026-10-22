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

Hay dos vistas, con el selector de arriba:

- **Por etapa:** una columna por área (Corte, Pailería, Pintura…). Lo que todavía está en una
  etapa anterior se junta cerrado en «Más adelante», así cada orden sale una vez donde va.
- **Por cuadrilla:** una columna por cuadrilla («Isidro y César») con lo que trabaja ahorita y lo
  que le sigue. La cuadrilla se arma sola con la gente que tiene el mismo trabajo asignado. Al
  final, «Sin cuadrilla» junta lo que nadie tiene: de ahí sale a quién hay que asignarle trabajo.

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

---

## Gantt: el plan del taller

**Para qué:** ver cuándo empieza y termina cada etapa de cada orden, qué no va a llegar a su fecha
compromiso y qué área está atorando al resto, sin hacer cuentas en una hoja.

**Quién:** lo ven la gerencia de producción, los supervisores, almacén e ingeniería de procesos
(Producción → Gantt). Solo la gerencia de producción cambia el orden de la fila.

### De dónde salen las fechas

Nadie las captura. El ERP simula el taller día por día, de lunes a viernes:

- cada área trabaja hasta lo que da por día: sus horas por semana entre 5 (Pailería 400 h por
  semana = 80 h por día);
- cada etapa avanza 9 h al día por cada persona de su cuadrilla (la planeada en Cuadrillas o la que
  está trabajando); sin cuadrilla, cuenta 2 personas;
- una etapa empieza al día siguiente de que acaba la anterior de la misma orden; lo que ya está en
  proceso o pausado sigue desde hoy;
- de una etapa empezada falta lo estimado menos las horas hombre ya marcadas en la terminal;
- va primero lo que ya se trabaja, luego la fila, luego lo urgente y la fecha compromiso.

Las órdenes en espera no entran al plan. Cada vez que el piso marca algo (inicia, termina, se une
alguien, se pausa), el plan se recalcula y las barras se recorren solas.

### Cómo se lee

- Barra apagada: etapa hecha. Llena con rayas que se mueven: se está trabajando (llena hasta hoy).
  Rayada: pausada. Translúcida: planeada.
- Rombo y raya punteada: la fecha compromiso. Verde si el plan llega antes; rojo si no, y la franja
  roja son los días que faltarían.
- La línea azul es hoy.
- Vistas: **Por orden** (en el orden de la fila), **Por pedido** (cuándo acaba el pedido completo) y
  **Por área** (qué va a trabajar cada área; al pasar el mouse por una orden se resaltan sus etapas
  en todas las áreas).

### Acomodar la fila (gerencia de producción)

1. En la vista **Por orden**, arrastra la orden por su asa (los puntitos de la izquierda) a su nuevo
   lugar. Sin mouse: clic en la orden y **Hasta arriba**, **Subir** o **Bajar**.
2. El plan se recalcula con ese orden.
3. La cola de cada área en Cuadrillas y en la terminal queda en ese mismo orden. Al revés también:
   acomodar la cola de un área en Cuadrillas mueve esas órdenes en el Gantt.

### Qué hacer con una orden que va tarde

- Subirla en la fila, para que su área la tome antes.
- Ponerle más gente a sus etapas en Cuadrillas: el plan cuenta 9 h por persona al día.
- Si nada alcanza, acordar otra fecha con el cliente (ventas) y cambiar el compromiso.

**Importante:** es un plan, no una promesa. Las horas estimadas de cada etapa salen del costeo; si
están lejos de la realidad, el plan también. Las métricas de producción dicen qué tan lejos.

---

## Personal de piso: quién entra a cuadrillas

**Para qué:** que la terminal y el tablero ofrezcan solo a la gente que trabaja en el piso, no a
vendedores ni administrativos.

**Quién:**
- **Recursos Humanos** da de alta y de baja, decide el departamento de cada quien y lleva su ficha.
- **La gerencia de producción** acomoda solo a la gente del departamento Producción: su área de
  piso (Pailería, Pintura…) y si **entra a cuadrillas**. También ve la ficha, las vacaciones y las
  incidencias solo de su gente.

**Cómo:**
1. RH da de alta a alguien en Producción con su área: entra a cuadrillas de una vez.
2. En **Cuadrillas → Personal de piso**, la gerencia cambia el área o quita a quien no trabaja en
   cuadrillas (por ejemplo, un coordinador o un auxiliar de supervisor).
3. Quien no entra a cuadrillas no sale en la terminal ni en el tablero, y la base no deja anotarlo
   en una etapa.
4. Si alguien cambia de departamento, RH lo cambia en su ficha; fuera de Producción deja de entrar
   a cuadrillas solo.

---

## Métricas de producción

**Para qué:** medir la planta para mejorarla (lean). **Quién:** ingeniería de procesos, la gerencia
de producción y dirección. Los costos dentro de las métricas solo los ve quien tiene Costos
(ingeniería de procesos sí; la gerencia de producción no).

**Qué mide** (Producción → Métricas, por periodo):
- **Entregas a tiempo:** órdenes terminadas en su fecha compromiso, y pedidos entregados a tiempo.
- **Equipos terminados** por semana.
- **Lead time:** días de liberada a terminada. Las órdenes que se cargaron de la hoja ya
  terminadas cuentan como terminadas pero no para los tiempos.
- **Eficiencia del flujo:** del tiempo en el taller, qué parte se trabajó de verdad.
- **Horas reales contra estimadas** por etapa, por equipo y por persona.
- **Trabajo en proceso**, pausas, problemas reportados y etapas reabiertas.
- **Máquinas:** fallas, horas fuera de servicio, tiempo de reparación y preventivos a tiempo.

**Importante:** las horas, los tiempos y la eficiencia salen de lo que el piso marca en la terminal
(iniciar, pausar, terminar y quién trabaja). La pantalla dice qué parte de las etapas se marcó; si es
poca, esos números dicen poco. Las entregas a tiempo y los terminados no dependen de eso.

**Siguiente:** las herramientas lean (5S, kaizen, A3, OEE, SMED) se habilitan una por una cuando
ingeniería de procesos las vaya a usar.

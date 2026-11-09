# Contrato Teléfono ↔ ERP (versión 1; fase 1: voz → ERP, fase 2: ERP → voz, fase 3: coaching y análisis)

Dos productos que se venden por separado. hegamex-voz (Railway, su Postgres) contesta llamadas;
el ERP (Supabase) lleva el CRM. Cuando están conectados, voz le manda al ERP cada llamada y el lead
que salió de ella; el ERP es dueño de leads, etapas y seguimiento. Desde la fase 2, al empezar cada
llamada voz le pregunta al ERP quién llama (`GET /contexto`, abajo). Sin `ERP_URL`/`ERP_LLAVE`, voz se
comporta exactamente como antes de conectarlo.

## Transporte
- `POST {ERP_URL}/evento` con `Content-Type: application/json` y `x-llave: <ERP_LLAVE>`.
  - `ERP_URL` = `https://<proyecto>.supabase.co/functions/v1/telefono` (sin barra final).
  - La llave la genera dirección en el ERP (Configuración → Integraciones → Teléfono) y la pega el
    dueño en las variables de Railway. Nunca va en el repo ni en el chat. Mínimo 32 caracteres.
- Respuestas del ERP:
  - `200 {"ok":true,"llamada_id":"<uuid>","lead_id":"<uuid>|null","cliente_id":"<uuid>|null"}`
  - `401 {"error":"Llave inválida"}` → voz NO reintenta hasta que cambie la llave (marca error).
  - `400 {"error":"..."}` (cuerpo mal formado) → voz no reintenta ese envío tal cual; anota el error.
    En el ERP también es 400 un dato que la base no puede leer (una fecha o un número mal escrito,
    errores 22xxx de Postgres). Un error de la base que no es de datos es 500. Más de 256 KB es 400.
  - `5xx`/red → voz reintenta con espera creciente (1, 5, 15, 60 min… tope 6 h), hasta 3 días.
- **Idempotente por `call_sid`.** Voz manda la FOTO COMPLETA y actual de la llamada cada vez (no
  deltas). Mandar la misma foto dos veces deja lo mismo. Una foto nueva de la misma llamada la
  actualiza. Campos `null` en la foto no borran lo que el ERP ya tiene (coalesce), salvo los que
  dicen lo contrario abajo.

## Cuerpo
```json
{
  "version": 1,
  "tipo": "llamada",
  "call_sid": "CA0123…",
  "enviado_en": "2026-11-06T22:10:00Z",
  "llamada": {
    "telefono": "+523312345678",          // quien llamó, marcable (telefonoDeSip); null si no se sabe
    "inicio": "2026-11-06T22:01:00Z",
    "fin": "2026-11-06T22:05:12Z",        // null si sigue
    "duracion_seg": 252,                  // fin - inicio; null si sigue
    "estado": "completed",                // calls.status tal cual (texto libre del lado de voz)
    "area": "ventas",                     // departments.slug; null si no llegó a ninguna
    "area_nombre": "Ventas",
    "atendio": { "nombre": "Isaac Hernández", "telefono": "+523300000000" },  // persona que de verdad habló; null si nadie
    "atendio_ia": "Sofía",                // nombre del agente de IA si la llevó una IA; null si no
    "nadie_contesto": false,              // true = se intentó pasar a una persona y nadie la tomó, o fue recado
    "resumen": "Busca una banda de 20 m para grava…",
    "grabacion_url": "https://voz…/w/grabacion/CA0123.mp3?e=…&t=…",  // enlace firmado de voz; null si no hay
    "grabacion_vence": "2026-12-06T22:05:12Z"
  },
  "lead": {                               // null si la llamada no dejó lead
    "id_voz": 482,
    "nombre": "Juan Pérez",
    "empresa": "Agregados del Bajío",
    "telefono": "+523312345678",
    "correo": "juan@ejemplo.com",
    "ciudad": "Tepatitlán",               // opcional (desde 260): como lo dijo quien llamó; null si no se sabe
    "estado": "Jalisco",                  // opcional (desde 260): estado de la República, texto libre; null si no se sabe
    "interes": "Banda transportadora 20 m",
    "detalle": "Para grava, 60 t/h, la quiere en enero",
    "notas": "Llamó por el anuncio de Facebook"
  }
}
```

Reglas de cada lado:
- `atendio` solo cuando una PERSONA aceptó (tecla en el susurro, `aceptada_at`) o habló sin tecla
  ≥ `SUSURRO_PUENTE_MIN_SEG`. Un destino que solo sonó NO es `atendio`.
- `nadie_contesto` = la llamada terminó sin que ninguna persona la tomara y alguien la debía tomar
  (`llamadaSinPersona` / status `no-answer`, o recado). Una llamada resuelta por la IA sin pasar a
  nadie (`atendida-ia` con desenlace resuelto) no es «nadie contestó».
- La grabación llega minutos después del fin: voz vuelve a mandar la foto cuando llega.
- Teléfonos en E.164 si se puede; el ERP compara por los últimos 10 dígitos (`telefono10`).

## Lo que hace el ERP con cada foto
Lo hace `telefono_registrar_evento(jsonb)` (migración 258), que solo puede llamar la función de
borde `telefono` con la llave de servicio. La función de borde revisa `x-llave`
(`telefono_llave_valida`), la forma del cuerpo y traduce el resultado a 200/400/401/5xx.

1. Upsert de `llamadas` por `call_sid` (datos crudos en `datos` jsonb, **sin transcripción**: si
   algún día llega un campo `transcripcion`/`transcript`, se descarta). Si la foto trae
   `enviado_en` más viejo que el de la última foto aplicada, se contesta 200 con los mismos ids
   y no se toca nada (un reintento atrasado no pisa una foto nueva).
2. Liga la llamada a un cliente por teléfono (`cliente_con_contacto(telefono, correo)`: últimos
   10 dígitos del teléfono o el correo del lead), mientras no tenga cliente.
3. Quién atendió: busca su teléfono (10 dígitos; si no trae, el nombre sin acentos) en
   `telefono_directorio`, que se llena solo la primera vez que aparece; si no está ligado y su
   teléfono coincide con el de **un solo** perfil activo (`perfiles.telefono`), se liga solo.
   Dirección liga los demás en Configuración → Integraciones → Teléfono
   (`fijar_directorio_telefono`); al ligarlo, sus llamadas anteriores quedan a su nombre.
4. Si trae `lead`: crea el lead la primera vez (fuente «Llamada a recepción», `capturado_por`
   vacío = lo capturó la IA, `leads.llamada_id` = la llamada, nota «Entró por el teléfono (IA).»
   seguida de `detalle` y `notas`). Si falta `interes` se usa el resumen; si falta `nombre`, la
   empresa o «Sin nombre». Sin teléfono, correo ni cliente no se crea (la base lo exige).
   `ciudad` se guarda sin espacios de más (tope 80 letras). `estado` se traduce al nombre del
   catálogo de estados del ERP (`normalizar_estado_mx`, migración 260: «Edo. de México», «Edomex»
   → «Estado de México»; «CDMX», «DF» → «Ciudad de México»; «nuevo leon» → «Nuevo León»;
   «Coahuila de Zaragoza» → «Coahuila»); lo que no se reconoce sin duda («México» a secas, una
   ciudad, un estado de otro país) queda vacío y la pantalla lo sigue pidiendo. El texto tal cual
   queda en `llamadas.datos`. Sin los dos campos el lead entra igual que antes.
   Las siguientes fotos solo llenan lo que le falta (empresa, teléfono, correo, ciudad, estado,
   notas): nunca pisan lo capturado. La excepción es la ubicación que el mismo teléfono corrige
   (fase 3, abajo). Si una persona del ERP que recibe leads (`vendedores_leads()`) lo atendió,
   el lead se le asigna (`como_se_asigno = 'llamada'`), salvo que el cliente ya tenga vendedor
   vigente (manda el dueño, `'cliente'`). Si no, aplica el modo de leads: en bandeja queda por
   tomar; en modo gerente, por asignar; en modo «recepción elige» **no falla** (no hay quién
   escoja): queda «nuevo» sin vendedor para que la gerencia lo asigne. El aviso «Lead por asignar»
   va a la gerencia de ventas o, si no hay gerente activo, a dirección. Si el lead se creó antes
   de saber quién atendió y sigue sin vendedor, una foto posterior con `atendio` se lo asigna.
5. Si hubo cliente y una persona del ERP atendió: registra una actividad «llamada» a nombre de esa
   persona, una sola vez por llamada (`llamadas.actividad_id`); si el resumen llega después, se
   completa mientras nadie haya editado la actividad.
6. `nadie_contesto = true` → aparece en «A quién llamar hoy» (y, para recepción, arriba de Leads)
   como «Regresar llamada» (`llamadas_por_regresar()`, últimos 7 días) para el dueño (vendedor del
   cliente o del lead) o, sin dueño, para quien reparte leads (recepción y quien tiene leads nivel 3);
   la gerencia de ventas y dirección ven todas. Al dueño le llega un aviso una vez. Se quita al
   marcar que ya se regresó (`marcar_llamada_regresada`, que puede dejar también un intento
   «llamada» en su lead y una actividad en el cliente), al registrar un intento en su lead o si el
   mismo número vuelve a llamar y lo atiende una persona.

## Quién ve las llamadas (RLS)
Gerencia de ventas y dirección (`puede('ventas', 3)`), quien la atendió, el dueño (vendedor del
cliente o del lead) y, si no son de nadie, recepción y leads nivel 3. Nunca otro vendedor. Nadie
escribe `llamadas` directo. El directorio lo ven sistemas y dirección (`admin` 3).
El coaching tiene su propia regla, más cerrada (fase 3): el dueño del cliente ve la llamada, pero no
la calificación de quien la atendió.

## La llave
`telefono_generar_llave()` (solo dirección) devuelve una llave nueva una sola vez; la base guarda
solo su huella (sha256). Generar otra deja sin servir la anterior al momento. `estado_telefono()`
dice si hay llave (nunca la regresa), el último aviso, el último error, llamadas y «nadie
contestó» de 7 días y cuántos nombres del directorio no tienen persona.

## Fase 2: GET /contexto (el ERP le dice a voz quién llama)

Para que la IA del teléfono sepa si quien llama ya es cliente, se lo pase primero a su vendedor y le
pueda decir cómo va su pedido. Lo contesta `telefono_contexto(text)` (migración 259), que solo puede
llamar la función de borde con la llave de servicio (ni `anon` ni `authenticated`).

### Transporte
- `GET {ERP_URL}/contexto?tel=<teléfono como venga, +52… o 10 dígitos>` con `x-llave: <ERP_LLAVE>`
  (la misma llave de la fase 1). Sin cuerpo.
- Respuestas:
  - `200` con el cuerpo de abajo, también cuando el número no es de nadie (`conocido: false`).
  - `400 {"error":"Teléfono inválido"}` si `tel` falta o trae menos de 10 dígitos.
  - `401 {"error":"Llave inválida"}` (una llave de menos de 32 caracteres ni se le pregunta a la base).
  - `500 {"error":"No se pudo consultar quién llama"}` cualquier otra cosa; queda anotado en
    Integraciones como «último error», sin el teléfono.
- Voz espera máximo `ERP_CONTEXTO_MS` (800 ms por omisión); si no llega, la llamada sigue sin
  contexto. Por eso es una sola función SQL, todo por índice (en local, con 8,000 contactos y
  3,000 pedidos, de 2 a 9 ms).

### Cuerpo (200)
```json
{
  "ok": true,
  "conocido": true,
  "cliente": { "nombre": "Agregados del Bajío" },                    // null si no es cliente
  "lead": { "nombre": "Juan Pérez", "interes": "Banda 20 m" },       // null; solo sin cliente y con lead abierto
  "vendedor": { "nombre": "Isaac Hernández", "telefono": "+523300000000" },  // null si no hay dueño vigente y activo
  "pedidos": [
    {
      "folio": "PED-26-812",
      "que_es": "Thor 36",                // títulos de las partidas unidos con coma, máximo 80 caracteres
      "estado": "En producción",          // Confirmado | En producción | Listo para entregar
      "etapa": "Pintura",                 // etapa actual de la orden más atrasada; null si no hay orden o no ha arrancado
      "avance": 70,                       // 0–100 entero; null si no hay órdenes
      "en_espera": false,                 // alguna orden en espera
      "fecha_compromiso": "2026-11-20",   // null si no tiene
      "atrasado": false                   // fecha_compromiso < hoy (planta) y no está listo
    }
  ],
  "cotizaciones": [ { "folio": "COT-2026-00312", "fecha": "2026-11-02", "vence": "2026-11-17" } ]
}
```

### De dónde sale cada cosa
- **Cliente**: `cliente_con_contacto(tel, null)`, los últimos 10 dígitos del teléfono o el WhatsApp
  de alguno de sus contactos (cliente activo; si hay dos, el más antiguo).
- **Vendedor**: el dueño del cliente solo si `vigencia_cliente()` dice que su cartera sigue vigente
  y su perfil está activo (el mismo criterio con el que la fase 1 le da el lead al dueño). Su
  teléfono es `perfiles.telefono` tal cual. Sin cliente: el vendedor del lead abierto, si ya está
  asignado.
- **Lead** (solo sin cliente): un lead `nuevo` o `asignado` con ese teléfono, o el que dejó una
  llamada anterior del mismo número (`llamadas.telefono10`). Primero el asignado, luego el más nuevo.
- **Pedidos abiertos**: `confirmado`, `en_produccion` o `listo`, sin los históricos de la hoja;
  máximo 5, los de fecha compromiso más próxima primero (sin fecha al final).
  - Avance: la fórmula del tablero de planta (161): horas de etapas terminadas más horas × avance
    reportado de las que están en proceso o pausadas, entre las horas totales; una orden terminada o
    entregada es 100; las canceladas no cuentan. El del pedido es el promedio de sus órdenes, el
    mismo número que ve la planta en Producción → Pedidos.
  - Etapa: de la orden con menos avance que no ha terminado, la etapa en proceso o pausada; si está
    entre etapas, la que sigue; si sigue planeada, ninguna.
  - Se calcula sobre las tablas, no con `v_pedidos_produccion`/`pedidos_basicos`: esas dependen de
    `puede()` (sale de `auth.uid()`) y con la llave de servicio regresan vacío.
- **Cotizaciones vivas**: `autorizada` o `enviada`, `fecha + vigencia_dias >= hoy`, sin folios
  `BORRADOR-`; máximo 5, las más recientes. Solo folio, fecha y vence.
- **Nunca** montos, precios, costos, márgenes, RFC, direcciones, correos ni los otros contactos del
  cliente. Lo prueba `supabase/pruebas/259_telefono_contexto.sql` revisando todas las llaves del
  jsonb a cualquier profundidad.

### Lo que hace voz con esto
- Lo pide al empezar la llamada (en paralelo al saludo) y lo guarda por `callSid`.
- En el prompt va como «POSIBLE CLIENTE CONOCIDO (según el ERP)…» (bloque no cacheado) con nombre,
  vendedor y cuántos pedidos y cotizaciones tiene. La IA confirma nombre o empresa de forma natural
  antes de usarlo, nunca lee el registro ni dice «aparece en el sistema», y si no es quien dice el
  ERP, sigue como con alguien nuevo.
- Ruteo: el vendedor va primero en la cola (después de «pidió a alguien por nombre»), si está en el
  directorio de voz (por los últimos 10 dígitos o por nombre). Si no contesta, sigue la cola normal.
- Herramienta `estado_pedido`: solo después de confirmar identidad. Dice estado, etapa, «va como al
  N %» y fecha compromiso; si va `atrasado` o `en_espera`, no da fecha y ofrece pasarlo con su
  vendedor. Nunca montos.

## Fase 3: coaching y análisis

Sigue siendo **versión 1**: solo se agregan campos opcionales a la misma foto (`POST /evento`). Un
conmutador que no los mande sigue funcionando igual. El ERP se publica primero (migración 261 y la
función `telefono` redesplegada, porque cambió el validador).

### Regla de presencia (para `coaching` y `analisis`)
- **Llave ausente** → el ERP no toca lo que ya tenía.
- **`null`** → ya no existe (se borró, o se rehízo y falló): el ERP borra lo suyo.
- **Objeto** → reemplaza completo lo que tenía (no se mezcla: un «Rehacer» sin fallos deja cero fallos).

### `llamada.historica` (boolean, opcional, por omisión false)
Foto de una llamada anterior a la conexión, mandada para llenar la historia. El ERP guarda la
llamada, su coaching y su análisis, y la liga al cliente por teléfono, pero **no crea ni toca leads,
actividades, avisos ni «Regresar llamada»**, y no la liga a leads. Una vez marcada, la llamada se
queda como histórica aunque una foto posterior no traiga la marca (`llamadas.historica`).

### `coaching` (objeto | null)
```json
{
  "rubrica": { "clave": "ventas-2026-11", "version": 3 },
  "calificacion": 7.4,                  // 1.0–10.0, un decimal. La CALCULA el conmutador con pesos y topes; el ERP no la recalcula
  "calificacion_sin_topes": 8.1,        // la que salía antes de aplicar topes (para explicar); 0–10 o null
  "criterios": [                        // los de la rúbrica, en su orden (hasta 30)
    { "clave": "siguiente_paso", "nombre": "Siguiente paso con fecha", "peso": 20,
      "nota": 4,                        // 0–10 entero, la pone la IA
      "evidencia": "«Le marco el jueves a las 10 para confirmar medidas»",  // cita breve, ≤ 200 car.; puede ser ""
      "segundo": 143 }                  // segundo de la grabación donde está la evidencia, o null
  ],
  "topes": [ { "clave": "sin_canal", "nombre": "Colgó sin canal de seguimiento", "maximo": 4 } ],   // los que se aplicaron (hasta 20)
  "fallos": [ { "clave": "no-cerro-fecha", "nombre": "No cerró fecha", "texto": "…" } ],           // máx. 5
  "tono": [ { "clave": "sono-calido", "nombre": "Sonó cálido", "signo": 1, "texto": "…" } ],       // signo 1 a favor, -1 en contra; máx. 5
  "lo_bueno": ["…"], "a_mejorar": ["…"], "sugerencias": ["…"],   // máx. 3 cada una, ≤ 300 car.
  "resumen": "…",                       // ≤ 600 car.
  "atendio_tipo": "persona",            // "persona" | "ia": a quién califica (la persona sale de llamada.atendio)
  "modelo": "…", "generado_en": "2026-11-09T18:00:00Z"
}
```
Reglas del conmutador:
- Nunca transcripción, teléfonos, correos ni montos dentro de los textos.
- Solo coaching en estado «listo». Califica a quien de verdad atendió (`llamada.atendio`, con prueba).
- `fallos` y `tono` llevan siempre `nombre` legible: el ERP no mantiene una copia del catálogo.

### `analisis` (objeto | null)
```json
{
  "intencion": "cotizar|factura|proveedor|empleo|envio|soporte|seguimiento|otro",
  "desenlace": "transferida|lead|resuelta|abandonada|sin-valor",
  "equipos": [ { "texto": "banda transportadora", "clave_catalogo": "BT-20" } ],   // hasta 20; texto normalizado; clave del catálogo del ERP o null
  "preguntas_sin_respuesta": ["¿Manejan bandas de PVC grado alimenticio?"],          // máx. 5, ≤ 300 car., sin datos personales
  "objeciones": [ { "categoria": "precio|tiempo_entrega|ya_tiene_proveedor|lo_pensara|financiamiento|especificacion|otro", "texto": "…" } ],  // hasta 10
  "stt_dudoso": false,
  "fuente_transcripcion": "en_vivo|scribe",
  "modelo": "…", "generado_en": "…"
}
```
Las listas de intención, desenlace y categoría son las que usa el conmutador hoy; el ERP **no las
cierra**: un valor nuevo se guarda tal cual y sale como su propio grupo (rechazarlo tiraría la
llamada entera). Una objeción sin categoría queda como `otro`.

### Respuestas
Las mismas de la fase 1. Una forma que no cumple lo de arriba (calificación fuera de 1–10, criterios
que no son lista, más fallos de los permitidos, `atendio_tipo` desconocido, `historica` que no es
booleano…) es **400** con el campo en el mensaje, y no toca nada de la llamada (la revisan la función
de borde y otra vez la base, con 22023). Queda anotado en Integraciones como «último error».

### Corrección de ubicación del lead
Cuando el conmutador vuelve a oír la grabación (Scribe v2 + entidades) y corrige `lead.ciudad` /
`lead.estado`, manda la foto nueva con el valor corregido. El ERP **reemplaza** `ciudad` y
`estado_mx` si el valor actual en el lead es igual al que mandó el teléfono en una foto anterior de
esa misma llamada (nadie lo tocó a mano) o si está vacío. Si una persona cambió la ciudad **o** el
estado, la ubicación ya la revisó una persona: el teléfono solo llena lo que siga vacío. «Lo que
mandó el teléfono» es el último valor no vacío de cada campo del `lead` en `llamadas.datos` (una foto
que no trae la ciudad no hace olvidar la anterior).

### Lo que hace el ERP (migración 261)
- Quita `coaching` y `analisis` de `llamadas.datos` (como la transcripción; `datos` lo ve también el
  dueño del cliente) y los guarda en `llamada_coaching` y `llamada_analisis`, una fila por llamada.
  Solo `telefono_registrar_evento` las escribe; nadie con sesión.
- **Quién ve el coaching**: quien atendió (`perfil_id = auth.uid()`) y la gerencia de ventas y
  dirección (`puede('ventas', 3)`). **Nunca otro vendedor**, ni el dueño del cliente si atendió otro.
  - `perfil_id` = `llamadas.atendio_perfil` resuelto por el directorio. Si nadie del ERP está ligado,
    se guarda con `perfil_id` null (lo ve solo la gerencia) y aparece en «Quién contesta» para
    ligarlo; al ligarlo (`fijar_directorio_telefono`) sus coachings se le asignan, igual que sus
    llamadas, y lo mismo cuando se liga solo por teléfono. La calificación sigue a la llamada: si una
    foto posterior (sin `coaching`, porque se está rehaciendo) dice quién atendió, el coaching es de
    esa persona aunque antes dijera otra. Desligarlo («Sin persona») le quita a esa persona las
    llamadas y los coachings que se le habían pasado: casi siempre es corregir un ligado equivocado.
  - Un coaching con `atendio_tipo = "ia"` califica a la IA: no es de nadie (lo ve la gerencia).
- **Quién ve el análisis**: quien ve la llamada (la regla de `llamadas`). Los agregados, con permiso de
  análisis (abajo).
- **Equipos**: `clave_catalogo` se busca en `articulos.clave`; si existe, se guarda su `articulo_id`.
- **Filtro de respaldo**: los textos del análisis (equipos, preguntas, objeciones) pasan por
  `sin_datos_personales()`: 7 dígitos o más seguidos son `[teléfono]` y un correo es `[correo]`.
- **Llamadas históricas**: ver arriba. Tampoco salen en «Regresar llamada» (`llamadas_por_regresar`).

### Para las pantallas
- `coaching_resumen(p_desde date, p_hasta date, p_perfil uuid default null) → jsonb` (fechas de la
  planta, las dos incluidas; máximo 400 días). Cada quien recibe lo suyo; la gerencia de ventas y
  dirección, el de todos o el de `p_perfil`. Pedir el de otro sin ser gerencia es error 42501.
  Devuelve `n`, `promedio`, `semanas` [{semana (lunes), n, promedio}], `personas` [{perfil_id, tipo,
  nombre, n, promedio, semanas, mejor, peor}], `criterios` [{clave, nombre, peso, n, promedio}],
  `fallos` (los 10 más repetidos) [{clave, nombre, n}], `tono` [{clave, nombre, signo, n}], `mejor` y
  `peor` [{llamada_id, fecha, calificacion, perfil_id}]. La IA y los nombres sin ligar salen como su
  propia «persona» (`tipo`, `perfil_id` null). Cada persona trae también `fallo` (el que más repite) y
  `reciente`/`anterior`: el promedio de las últimas 4 semanas hasta `p_hasta` y el de las 4 de antes,
  aunque el periodo sea más corto (lo mismo, para todo lo visible, en `reciente`/`anterior` de arriba).
- `coaching_llamadas(p_desde, p_hasta, p_perfil default null)`: las llamadas calificadas del periodo,
  una por renglón (calificación, sin topes, cuántos topes, nombres de los fallos, quién atendió, quién
  llamó, grabación), hasta 2,000. `security invoker`: la RLS de `llamada_coaching` decide. El detalle
  (criterios con evidencia, topes, lo bueno…) se lee de `llamada_coaching` al abrir una.
- Pantallas: «Coaching» en `/ventas/coaching` (`?perfil=` para la gerencia, `?llamada=` abre el
  detalle) y «Lo que dicen las llamadas» en `/analisis/llamadas`. La ficha de cada llamada muestra la
  calificación junto a la duración solo si `llamada_coaching` se la deja leer a quien la ve.
- `llamadas_analitica(p_desde date, p_hasta date) → jsonb`, para `puede('analisis', 1)` o
  `puede('ventas', 3)` (si no, error 42501). Solo agregados, sin teléfonos ni nombres de quien llamó:
  `llamadas`, `nadie_contesto`, `con_analisis`, `stt_dudoso`, `pct_stt_dudoso`, `semanas`, `equipos`
  (los 15 más pedidos, por artículo del catálogo o por texto normalizado, con su serie semanal),
  `preguntas` (las 20 más repetidas, juntando las que dicen lo mismo con otras palabras, con un
  ejemplo y la última vez), `objeciones` por categoría (con hasta 3 ejemplos), `desenlaces`,
  `intenciones`, `por_hora` (0–23) y `por_dia` (1 lunes … 7 domingo), cada uno con su «nadie contestó».
  Con 20,000 llamadas en local, 90 días tardan unos 230 ms.
- Las preguntas «parecidas» se juntan con `llamada_texto_clave()`: sin acentos ni signos, sin
  palabras de relleno, en singular y en orden («¿Manejan bandas de PVC grado alimenticio?» = «¿tienen
  banda PVC grado alimenticio?»).

### Objetivos
Indicador 75 `calificacion_coaching` («Calificación de coaching», área ventas, automático, en
puntos): el promedio del mes de los coachings que son suyos (`llamada_coaching.perfil_id`, la misma
llave que decide quién los ve) y que la califican a ella (no a la IA). `posibles` = 10, así que la regla proporcional da promedio × 10 %.
Cada llamada es evidencia (tipo `llamada`) con su calificación; cuenta como incidencia la que queda
por debajo de la mínima (parámetro `minima`, 6 si no se dice). Sin llamadas calificadas en el mes, no
hay dato y lo califica el jefe. Se agrega a las plantillas desde la pantalla.

### Revisión nocturna (solo SQL; a la IA no le llega nada de esto)
- `preguntas_sin_respuesta` (ventas, para responsable, se cierra sola): la misma pregunta en 2
  llamadas o más en 7 días. Le llega a quien administra el catálogo o los costos
  (`usuarios_con_permiso('catalogo', 3)` ∪ `('costos', 3)`: quien puede dar de alta lo que falta o
  ponerle precio; hoy es dirección, y si se le da ese nivel a alguien más, le llega a esa persona),
  siempre que además pueda abrir «Lo que dicen las llamadas» (análisis 1 o ventas 3), que es a donde
  lleva; si nadie cumple las dos, a dirección. Una pregunta cuya clave queda solo en «precio»
  («¿Cuánto cuesta?» a secas) no sale: no dice qué falta, y el conmutador no da precios a propósito.
- `coaching_bajo_repetido` (ventas, para dirección): una persona con 5 llamadas o más en 2 semanas,
  promedio menor a 6 y la mayoría (6 de cada 10) abajo de 6, escrita como patrón y sin acusar. A lo más
  uno por persona y por mes, y ninguno nuevo mientras siga abierto el anterior. Medido con 90 días
  simulados: solo con el promedio, quien promedia 6.2 salía casi una noche de cada dos y dos llamadas
  pésimas entre tres buenas ya eran «patrón»; así solo salen quienes andan en 5.5 o menos. El título no lleva nombre ni calificación,
  porque los títulos de los hallazgos sí se le mandan a la IA nocturna para que no se repita; el
  nombre va en el detalle, que solo ve dirección.

## Para conectarlo (una vez)
1. `npx supabase functions deploy telefono --no-verify-jwt` (no necesita secretos propios).
2. Migraciones 258 a 261 aplicadas en la nube (la 259 es la de «quién llama»; sin ella `/contexto`
   contesta 500 y voz sigue sin contexto; la 261 es la del coaching y el análisis, y **va antes** de
   que voz los mande: sin ella caerían en `llamadas.datos`, que ve el dueño del cliente).
3. Dirección: Configuración → Integraciones → Teléfono → «Generar llave».
4. En Railway, en el conmutador: `ERP_URL` = la dirección que muestra esa tarjeta
   (`https://<proyecto>.supabase.co/functions/v1/telefono`) y `ERP_LLAVE` = la llave.
5. Ligar en «Quién contesta» los nombres que no se ligaron solos.

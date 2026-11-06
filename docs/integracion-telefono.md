# Contrato Teléfono ↔ ERP (versión 1, fase 1: voz → ERP)

Dos productos que se venden por separado. hegamex-voz (Railway, su Postgres) contesta llamadas;
el ERP (Supabase) lleva el CRM. Cuando están conectados, voz le manda al ERP cada llamada y el lead
que salió de ella; el ERP es dueño de leads, etapas y seguimiento. Sin `ERP_URL`/`ERP_LLAVE`, voz se
comporta exactamente como hoy.

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
   Las siguientes fotos solo llenan lo que le falta (empresa, teléfono, correo, notas): nunca
   pisan lo capturado. Si una persona del ERP que recibe leads (`vendedores_leads()`) lo atendió,
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

## La llave
`telefono_generar_llave()` (solo dirección) devuelve una llave nueva una sola vez; la base guarda
solo su huella (sha256). Generar otra deja sin servir la anterior al momento. `estado_telefono()`
dice si hay llave (nunca la regresa), el último aviso, el último error, llamadas y «nadie
contestó» de 7 días y cuántos nombres del directorio no tienen persona.

## Para conectarlo (una vez)
1. `npx supabase functions deploy telefono --no-verify-jwt` (no necesita secretos propios).
2. Migración 258 aplicada en la nube.
3. Dirección: Configuración → Integraciones → Teléfono → «Generar llave».
4. En Railway, en el conmutador: `ERP_URL` = la dirección que muestra esa tarjeta
   (`https://<proyecto>.supabase.co/functions/v1/telefono`) y `ERP_LLAVE` = la llave.
5. Ligar en «Quién contesta» los nombres que no se ligaron solos.

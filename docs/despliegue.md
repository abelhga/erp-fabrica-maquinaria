# Despliegue

Dos piezas: la base (Supabase) y el sitio (estático, en Cloudflare Workers).

El 3 de octubre de 2026 se creó el proyecto `erp-hegamex` (Supabase, us-west-1) con las
migraciones, los datos de la instancia local de verificación y usuarios de prueba por rol con
contraseña propia (no "hegamex-local"). Ya tiene entrada con Google, la llave de Claude y el
sitio en `erp-fabrica-maquinaria.figugu.workers.dev`. El 4 de octubre se le quitó toda la
demostración con `scripts/demo/limpiar_todo.sql`: quedan solo las migraciones, lo importado
de las hojas y lo que han capturado personas reales. Si alguna vez se vuelve a cargar
demostración en una base que se va a usar en serio, ese mismo script la quita (corre en una
transacción y se detiene si algo real depende de lo que iba a borrar).

## 1. Supabase

1. Crear un proyecto nuevo (región `us-east` o la más cercana disponible). Para un ERP
   conviene el plan **Pro**: respaldos diarios y opción de restaurar a un punto en el tiempo.
2. **Database → Extensions**: activar `pg_cron` y `pg_net` **antes** de aplicar las
   migraciones. Las migraciones son las que programan las tareas automáticas; si la extensión
   no está, solo dejan un aviso y siguen, y nada queda programado.
3. Desde el repositorio:
   ```bash
   npx supabase link --project-ref <ref>
   npx supabase db push          # aplica supabase/migrations en orden
   ```
   Comprobar en el SQL Editor que quedaron las ocho tareas
   (`select jobname, schedule from cron.job order by 1;`). Los horarios están en UTC; la planta
   está en UTC−6 todo el año:

   | Tarea | Cuándo (planta) | Qué hace |
   |---|---|---|
   | `avisos-periodicos` | cada 30 min | Validaciones de más de 4 horas y pendientes vencidos |
   | `avisos-solicitudes-precio` | cada 15 min, en horario hábil | Solicitudes de precio por vencer y vencidas (a compras; vencidas, a la gerencia) |
   | `avisos-envios` | :07 y :37, de 7 a 20 h | Envíos sin cotizar, "hoy vienen por él", devoluciones que debían llegar, reclamos por vencer, saldo de paquetería bajo |
   | `avisos-importaciones` | cada hora | Las alertas del tablero de importaciones, una vez al día mientras sigan vivas |
   | `avisos-servicio` | 6:47 diario | Genera los preventivos que vencen; recuerda vencidos y herramienta sin regresar |
   | `avisos-objetivos-nomina` | 8:05 diario | Semana de nómina sin cerrar; del 1 al 3, arma el mes de objetivos |
   | `liberar-clientes-vencidos` | 2:10 diario | Libera clientes sin venta ni seguimiento (regla de cartera) |
   | `resumen-semanal` | lunes 6:53 | Aviso "Tu semana" a quien usa el asistente |

   Si `pg_cron` se activó después, vuelve a correr solo los bloques `cron.schedule` de esas
   migraciones (buscar `cron.schedule` en `supabase/migrations/`).
4. **Authentication → Providers → Google**:
   - En Google Cloud (con la cuenta de Workspace de Hegamex) crear un cliente OAuth de tipo
     *Aplicación web*. Pantalla de consentimiento **Interna**: así solo cuentas de la empresa
     pueden siquiera intentarlo.
   - URI de redirección autorizada: `https://<ref>.supabase.co/auth/v1/callback`.
   - Pegar Client ID y Secret en Supabase.
5. **Authentication → URL Configuration**: *Site URL* = dominio del ERP
   (p. ej. `https://erp.hegamex.com`) y agregarlo también a *Redirect URLs*.
6. Primer acceso de dirección (SQL Editor):
   ```sql
   insert into invitaciones (correo, nombre, roles) values ('<correo-de-direccion>@hegamex.com', 'Dirección', '{direccion}');
   ```
   Al entrar con Google toma ese rol. Desde **Sistema → Usuarios** se invita a los demás.
7. Cuenta de la TV del taller: invitar `tv@hegamex.com` (o el correo que se use) con rol
   `pantalla`, crear el usuario en **Authentication → Users → Add user** con contraseña, y en
   la TV entrar con "correo y contraseña". Solo ve la pantalla de piso.

8. **Asistente con Claude** (función de borde `asistente`):
   ```bash
   npx supabase functions deploy asistente
   npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...   # de console.anthropic.com → API Keys
   ```
   - Sin la llave, el asistente funciona en **modo demostración**: los resúmenes salen de las
     reglas de la base (`hallazgos()`) y la pantalla lo dice. Nada se rompe.
   - **Tope de gasto**: en console.anthropic.com → Settings → Limits poner un tope mensual y un
     aviso por correo. Si el tope se llena, el asistente lo dice en pantalla ("la cuenta de
     Claude no aceptó la consulta") en lugar de fallar en silencio, que es lo que le pasó al
     teléfono el 28 de septiembre de 2026.
   - **Cupo por persona**: `configuracion.asistente.limite_diario` (40 consultas al día por
     defecto). El modelo y el esfuerzo también van ahí (`modelo`, `esfuerzo`).
   - Cuánto se usa: tabla `asistente_uso` (quién, cuándo, tokens, errores). Dirección y
     sistemas la ven completa; cada quien ve la suya.
   - La llave **nunca** va en el navegador ni en `.env` del sitio: solo como secreto de la
     función. Cada consulta corre con la sesión de quien pregunta, así que Claude ve lo mismo
     que esa persona y nada más.

### Sin `supabase link`: por la API de administración

Si no hay salida directa a Postgres (puerto 5432/6543), como en una sesión de Claude en la
nube, lo mismo se hace por HTTPS con `scripts/nube/`:

```bash
export NUBE_REF=<ref>                       # Project Settings → General → Reference ID
export SUPABASE_ACCESS_TOKEN=sbp_...        # supabase.com/dashboard/account/tokens
python3 scripts/nube/migrar.py              # aplica las migraciones que falten y las registra
python3 scripts/nube/pruebas.py             # supabase/pruebas/*.sql, cada una se deshace
python3 scripts/nube/sql_nube.py consulta.sql
```

- `migrar.py` registra cada versión en `supabase_migrations.schema_migrations`, la misma
  tabla que lee `supabase db push`: se pueden mezclar los dos sin aplicar nada dos veces.
- El token personal da control total de **todos** los proyectos de la cuenta. Créalo con
  vencimiento corto y bórralo al terminar. En una sesión de Claude en la nube va como
  *API credential* del entorno (el proxy lo agrega; Claude no lo ve), nunca en el chat.
- No se usa una función de borde que ejecute SQL "para cargar rápido": queda como puerta
  abierta a la base aunque se borre después.

### "Ver como" (función de borde `ver-como`)

```bash
npx supabase functions deploy ver-como --no-verify-jwt
```
- No necesita secretos: usa `SUPABASE_SERVICE_ROLE_KEY`, que Supabase pone solo, y solo
  después de que `vista_previa_destino()` dijo que quien la pide es dirección o sistemas.
- La migración 091 pone `pgrst.db_pre_request = public.antes_de_cada_peticion` en el rol
  `authenticator`: antes de cada petición de la API revisa si la sesión es una vista
  previa y, si lo es, vuelve la transacción de solo lectura. Si algún día la API entera
  empieza a fallar con un error de esa función, se quita con
  `alter role authenticator reset pgrst.db_pre_request; notify pgrst, 'reload config';`.
- El registro de quién vio como quién está en la tabla `vistas_previas`.

## 2. Sitio (Cloudflare Workers)

- **Workers & Pages → Create application → Import a repository**, elegir el repositorio y la
  rama. Nombre del proyecto: `erp-fabrica-maquinaria` (tiene que coincidir con `name` en
  `wrangler.jsonc`, o el build falla).
- Build command `npm run build`; deploy command `npx wrangler deploy` (lo pone solo).
  `wrangler.jsonc` sirve `dist/` y manda cualquier ruta a `index.html` (modo
  `single-page-application`), así que /ventas/pedidos/123 abre bien aunque no sea un archivo.
- **Variables de build** (Advanced settings → Build variables, o después en Settings → Build):
  `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (Project Settings → API, llave publicable) y
  `VITE_DOMINIO_EMPRESA=hegamex.com`. Vite las mete en el código al construir: si se cambian,
  hay que volver a construir.
- Dominio propio: Settings → Domains & Routes → `erp.hegamex.com`.

## 3. Datos

Con la cadena de conexión (Project Settings → Database → *Session pooler*) y un token de
Google con permiso de lectura de Sheets:

```bash
DATABASE_URL='postgresql://…' GOOGLE_ACCESS_TOKEN=$(gcloud auth print-access-token) npm run importar -- --google
DATABASE_URL='postgresql://…' npx tsx scripts/detectar-subensambles.ts
```

Antes, poner en `scripts/importar.config.json` los correos reales de los vendedores y que
cada uno ya exista como usuario (invitado y con su primer acceso hecho).
El resultado se ve en **Sistema → Importar de Sheets**: debe decir 474 de 474 precios iguales.

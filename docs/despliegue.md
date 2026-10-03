# Despliegue

Dos piezas: la base (Supabase) y el sitio (estático, en Cloudflare Pages). Nada de esto
está creado todavía: requiere decisiones y cuentas del dueño.

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
   Comprobar en el SQL Editor que quedaron las seis tareas
   (`select jobname, schedule from cron.job order by 1;`). Los horarios están en UTC; la planta
   está en UTC−6 todo el año:

   | Tarea | Cuándo (planta) | Qué hace |
   |---|---|---|
   | `avisos-periodicos` | cada 30 min | Validaciones de más de 4 horas y pendientes vencidos |
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

## 2. Sitio (Cloudflare Pages)

- Conectar el repositorio. Comando de build `npm run build`, carpeta `dist`.
- Variables de entorno: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (Project Settings → API,
  llave publicable) y `VITE_DOMINIO_EMPRESA=hegamex.com`.
- `public/_redirects` ya manda todas las rutas a `index.html` (la app maneja sus rutas).
- Dominio propio: `erp.hegamex.com` → CNAME al proyecto de Pages.

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

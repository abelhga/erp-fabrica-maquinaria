# Despliegue

Dos piezas: la base (Supabase) y el sitio (estático, en Cloudflare Pages). Nada de esto
está creado todavía: requiere decisiones y cuentas del dueño.

## 1. Supabase

1. Crear un proyecto nuevo (región `us-east` o la más cercana disponible). Para un ERP
   conviene el plan **Pro**: respaldos diarios y opción de restaurar a un punto en el tiempo.
2. Desde el repositorio:
   ```bash
   npx supabase link --project-ref <ref>
   npx supabase db push          # aplica supabase/migrations en orden
   ```
3. **Database → Extensions**: activar `pg_cron` (la liberación nocturna de clientes vencidos
   la usa; si no está, la migración solo avisa).
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

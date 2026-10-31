# Correo desde el ERP con Gmail

Cada quien manda la cotización o la orden de compra desde **su propio Gmail**, con el PDF
adjunto. El correo sale de su cuenta: lo ve en sus enviados y las respuestas le llegan a él.
En el ERP queda a quién se mandó, cuándo y el hilo de Gmail, para que la segunda etapa ligue
las respuestas.

- Base: `supabase/migrations/20261003000217_correo_gmail.sql` (prueba `217_correo_gmail.sql`).
- Función de borde: `supabase/functions/correo` (prueba con un Google falso en `nucleo.test.ts`).
- Pantalla: `src/components/correo/DialogoCorreo.tsx`, en la cotización («Por correo» dentro de
  Enviar, o en el menú «···») y en la orden de compra («Por correo»).

## Configurar Google (una sola vez, dirección)

Lo hace una persona que administre la cuenta de Google Workspace de hegamex.com. Las llaves
**nunca** pasan por el chat ni por el repositorio.

1. Entra a <https://console.cloud.google.com> con tu cuenta de Hegamex y elige el proyecto
   donde está el inicio de sesión con Google del ERP (o crea uno: «ERP Hegamex»).
2. **APIs y servicios → Biblioteca**: busca **Gmail API** y dale **Habilitar**.
3. **APIs y servicios → Pantalla de consentimiento de OAuth** (o «Google Auth Platform →
   Público»): tipo de usuario **Interno**. Interno quiere decir que solo cuentas de
   hegamex.com pueden darle permiso, y Google no pide revisar la app.
   En **Acceso a los datos / Permisos**, agrega:
   `.../auth/gmail.send`, `.../auth/gmail.readonly`, `openid` y `email`.
4. **Credenciales → Crear credenciales → ID de cliente de OAuth → Aplicación web**.
   En **URI de redireccionamiento autorizados** pon exactamente:
   `https://lhrmdlqzejyxplpftste.supabase.co/functions/v1/correo/autorizar`
   (Si reutilizas el cliente del inicio de sesión, solo agrégale esta URI.)
5. Copia el **ID de cliente** y el **Secreto del cliente** y pégalos en Supabase →
   **Edge Functions → Secrets** como `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`.
6. Si Workspace tiene restringidas las apps de terceros: <https://admin.google.com> →
   **Seguridad → Acceso y control de datos → Controles de API → Administrar el acceso de apps
   de terceros**, busca la app por su ID de cliente y márcala **De confianza**. Este es el
   «permiso interno» de la consola.

Después, cada persona conecta su Gmail la primera vez que manda algo («Conectar mi Gmail»).
Si Google le pregunta por casillas, **deben quedar marcadas las dos** (enviar y leer).

## Si algo falla

- «Falta configurar Google…»: faltan los secretos del paso 5.
- `redirect_uri_mismatch` en la página de Google: la URI del paso 4 no es idéntica (sin
  diagonal al final, con `https`).
- «Google ya no deja usar tu Gmail desde el ERP»: la persona quitó el permiso, cambió su
  contraseña o el administrador bloqueó la app. Que vuelva a conectar.
- Viendo el ERP como otra persona no se conecta ni se manda nada: saldría de su cuenta.

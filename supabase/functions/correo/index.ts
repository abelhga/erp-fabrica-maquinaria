// Entrada en Supabase (Deno). La lógica está en nucleo.ts para probarla en Node con un Google
// falso (nucleo.test.ts).
//
// Secretos (los pone dirección en Supabase → Edge Functions → Secrets; nunca pasan por el chat
// ni por el repositorio): GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET, del cliente OAuth «Aplicación
// web» de Google Cloud con la pantalla de permiso en «Interna» (solo cuentas de Hegamex).
// SUPABASE_URL, SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY los pone Supabase solo. Se
// despliega sin verificar JWT (Google regresa sin uno): cada ruta que actúa a nombre de
// alguien revisa su sesión aquí.
import { atender } from "./nucleo.ts";

Deno.serve((req) =>
  atender(req, {
    supabaseUrl: Deno.env.get("SUPABASE_URL")!,
    supabaseAnonKey: Deno.env.get("SUPABASE_ANON_KEY")!,
    serviceKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    clientId: Deno.env.get("GOOGLE_CLIENT_ID") || undefined,
    clientSecret: Deno.env.get("GOOGLE_CLIENT_SECRET") || undefined,
    appUrl: Deno.env.get("APP_URL") || "https://erp.hegamex.com",
  })
);

// Entrada en Supabase (Deno). La lógica está en nucleo.ts para probarla en Node con una
// API de Skydropx falsa (nucleo.test.ts).
//
// Secretos (los pone dirección en Supabase → Edge Functions → Secrets; nunca pasan por el
// chat ni por el repositorio): SKYDROPX_CLIENT_ID y SKYDROPX_CLIENT_SECRET, de
// app.skydropx.com → Configuración → API. Son de producción: generar una guía la cobra.
// Se despliega sin verificar JWT para contestar el preflight del navegador; cada ruta
// revisa la sesión aquí y todo lo de la base va con esa sesión.
import { atender } from "./nucleo.ts";

Deno.serve((req) =>
  atender(req, {
    supabaseUrl: Deno.env.get("SUPABASE_URL")!,
    supabaseAnonKey: Deno.env.get("SUPABASE_ANON_KEY")!,
    clientId: Deno.env.get("SKYDROPX_CLIENT_ID") || undefined,
    clientSecret: Deno.env.get("SKYDROPX_CLIENT_SECRET") || undefined,
  })
);

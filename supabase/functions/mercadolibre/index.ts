// Entrada en Supabase (Deno). La lógica está en nucleo.ts para probarla en Node con una
// API de Mercado Libre falsa (nucleo.test.ts).
//
// Secretos (los pone dirección en Supabase → Edge Functions → Secrets; nunca pasan por el
// chat ni por el repositorio): ML_CLIENT_ID y ML_CLIENT_SECRET, de la aplicación creada en
// developers.mercadolibre.com.mx. SUPABASE_URL, SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY
// los pone Supabase solo. Se despliega sin verificar JWT (ML no manda uno): cada ruta que
// actúa a nombre de alguien revisa su sesión aquí.
import { atender } from "./nucleo.ts";

// Lo que ML pide responder en menos de medio segundo se contesta ya; el trabajo sigue después.
const enSegundoPlano = (p: Promise<unknown>) => {
  const rt = (globalThis as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } }).EdgeRuntime;
  if (rt) rt.waitUntil(p); else p.catch(() => undefined);
};

Deno.serve((req) =>
  atender(req, {
    supabaseUrl: Deno.env.get("SUPABASE_URL")!,
    supabaseAnonKey: Deno.env.get("SUPABASE_ANON_KEY")!,
    serviceKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    clientId: Deno.env.get("ML_CLIENT_ID") || undefined,
    clientSecret: Deno.env.get("ML_CLIENT_SECRET") || undefined,
    appUrl: Deno.env.get("APP_URL") || "https://erp.hegamex.com",
    enSegundoPlano,
  })
);

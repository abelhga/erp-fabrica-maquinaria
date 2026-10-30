// Entrada en Supabase (Deno). La lógica está en nucleo.ts para probarla en Node con una API de
// lotes falsa (nucleo.test.ts).
//
// Secretos (Supabase → Edge Functions → Secrets; nunca pasan por el chat ni por el repositorio):
// ANTHROPIC_API_KEY, la misma del asistente. SUPABASE_URL, SUPABASE_ANON_KEY y
// SUPABASE_SERVICE_ROLE_KEY los pone Supabase solo. Se despliega sin verificar JWT (pg_cron no
// manda uno): las rutas de pg_cron revisan la llave de revision_cuenta y la de la pantalla, la sesión.
import { atender } from "./nucleo.ts";

const enSegundoPlano = (p: Promise<unknown>) => {
  const rt = (globalThis as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } }).EdgeRuntime;
  if (rt) rt.waitUntil(p); else p.catch(() => undefined);
};

Deno.serve((req) =>
  atender(req, {
    supabaseUrl: Deno.env.get("SUPABASE_URL")!,
    supabaseAnonKey: Deno.env.get("SUPABASE_ANON_KEY")!,
    serviceKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    anthropicKey: Deno.env.get("ANTHROPIC_API_KEY") || undefined,
    enSegundoPlano,
  })
);

// Entrada en Supabase (Deno). Toda la lógica está en nucleo.ts para poder probarla
// y servirla igual en Node (scripts/asistente-local.ts).
//
// Secretos: `npx supabase secrets set ANTHROPIC_API_KEY=...`. Sin llave, el asistente
// funciona en modo demostración con los hallazgos de la base. SUPABASE_URL y
// SUPABASE_ANON_KEY los pone Supabase solo.
import { atender } from "./nucleo.ts";

Deno.serve((req) =>
  atender(req, {
    supabaseUrl: Deno.env.get("SUPABASE_URL")!,
    supabaseAnonKey: Deno.env.get("SUPABASE_ANON_KEY")!,
    anthropicKey: Deno.env.get("ANTHROPIC_API_KEY") || undefined,
  })
);

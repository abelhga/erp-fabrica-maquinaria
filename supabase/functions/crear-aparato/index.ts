// Entrada en Supabase (Deno). La lógica está en nucleo.ts para probarla en Node
// contra la base local (nucleo.test.ts).
//
// SUPABASE_URL, SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY los pone Supabase solo.
// La llave de servicio nunca sale de aquí: solo crea la cuenta de la TV o la tablet,
// después de que la base dijo que quien la pide puede invitar.
import { atender } from "./nucleo.ts";

Deno.serve((req) =>
  atender(req, {
    supabaseUrl: Deno.env.get("SUPABASE_URL")!,
    supabaseAnonKey: Deno.env.get("SUPABASE_ANON_KEY")!,
    serviceKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  })
);

// Entrada en Supabase (Deno). La lógica está en nucleo.ts para probarla en Node contra la base
// local (nucleo.test.ts).
//
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los pone Supabase solo. Se despliega sin verificar JWT
// (`npx supabase functions deploy telefono --no-verify-jwt`): el conmutador no trae sesión del ERP
// y entra con la llave que genera dirección en Configuración → Integraciones (va en Railway como
// ERP_LLAVE; nunca en el repositorio ni en el chat).
import { atender } from "./nucleo.ts";

Deno.serve((req) =>
  atender(req, {
    supabaseUrl: Deno.env.get("SUPABASE_URL")!,
    serviceKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    // Para las ligas que viajan por WhatsApp (fase 4); igual que en las funciones de correo y ML.
    appUrl: Deno.env.get("APP_URL") || "https://erp.hegamex.com",
  })
);

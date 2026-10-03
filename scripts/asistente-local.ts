// La función del asistente servida con Node, para desarrollar sin el runtime de
// Supabase (que en este entorno no corre). Mismo código: supabase/functions/asistente/nucleo.ts.
//   npx tsx scripts/asistente-local.ts            → http://localhost:54329
//   ANTHROPIC_API_KEY=... npx tsx scripts/asistente-local.ts   → con Claude de verdad
// En el navegador: VITE_ASISTENTE_URL=http://localhost:54329 en .env.local.
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { Readable } from "node:stream";
import { atender } from "../supabase/functions/asistente/nucleo.ts";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")
    .map((l) => l.match(/^([A-Z_]+)=(.*)$/)).filter((m): m is RegExpMatchArray => !!m).map((m) => [m[1], m[2]]),
);
const puerto = Number(process.env.PUERTO ?? 54329);

createServer(async (req, res) => {
  const cuerpo = req.method === "POST" ? Readable.toWeb(req) as ReadableStream : undefined;
  const peticion = new Request(`http://localhost:${puerto}${req.url}`, {
    method: req.method, headers: req.headers as Record<string, string>, body: cuerpo, duplex: "half",
  } as RequestInit);
  const r = await atender(peticion, {
    // Las variables del proceso ganan, igual que en Vite (para apuntar a otra base local).
    supabaseUrl: process.env.VITE_SUPABASE_URL ?? env.VITE_SUPABASE_URL,
    supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY ?? env.VITE_SUPABASE_ANON_KEY,
    anthropicKey: process.env.ANTHROPIC_API_KEY || undefined,
  });
  res.writeHead(r.status, Object.fromEntries(r.headers));
  if (r.body) for await (const trozo of r.body as unknown as AsyncIterable<Uint8Array>) res.write(trozo);
  res.end();
}).listen(puerto, () => console.log(`Asistente local en http://localhost:${puerto} (${process.env.ANTHROPIC_API_KEY ? "con Claude" : "modo demostración"})`));

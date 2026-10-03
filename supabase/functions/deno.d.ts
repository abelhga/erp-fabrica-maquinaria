// Solo para que tsc revise las funciones desde Node; en Supabase, Deno trae lo suyo.
declare const Deno: {
  serve(handler: (req: Request) => Response | Promise<Response>): void;
  env: { get(nombre: string): string | undefined };
};

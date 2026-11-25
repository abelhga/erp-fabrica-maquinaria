import { useQuery } from "@tanstack/react-query";
import { Seleccion } from "@/components/ui/campo";
import { supabase } from "@/lib/supabase";
import { q } from "@/lib/consultas";

/**
 * El estado de la República, elegido de la lista. Escrito a mano salían «Toluca», «Pachuca» o
 * «USA» en el estado, y así no se puede saber de dónde es un cliente ni cotizar el flete. Un valor
 * viejo que no está en la lista se sigue enseñando para que no se pierda al guardar.
 */
export function SelectorEstado({ valor, alCambiar, className, ...resto }: {
  valor: string | null | undefined; alCambiar: (v: string) => void; className?: string; "aria-label"?: string;
}) {
  const estados = useQuery({
    queryKey: ["geo_estados"], staleTime: Infinity,
    queryFn: () => q<{ nombre: string }[]>(supabase.from("geo_estados").select("nombre").order("nombre")),
  });
  const lista = (estados.data ?? []).map((e) => e.nombre);
  const v = valor ?? "";
  return (
    <Seleccion value={v} onChange={(e) => alCambiar(e.target.value)} className={className} aria-label={resto["aria-label"] ?? "Estado"}>
      <option value="">Estado…</option>
      {v && !lista.includes(v) && <option value={v}>{v} (revisar)</option>}
      {lista.map((n) => <option key={n} value={n}>{n}</option>)}
    </Seleccion>
  );
}

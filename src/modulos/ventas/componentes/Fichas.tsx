import { useQuery } from "@tanstack/react-query";
import { ExternalLink, FileText, Images } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { q } from "@/lib/consultas";

export interface FichaDoc {
  articulo_id: string; documento_id: string; folio: string; revision: string; tipo: "ficha" | "foto"; titulo: string; drive_url: string;
}

/**
 * Fichas técnicas y fotos VIGENTES de los artículos (fichas_de_articulos: la RLS de
 * documentos_tecnicos ya le da a ventas solo lo vigente). Antes eran 29 pedidos a
 * marketing por chat ("¿tenemos video de prueba de la Zar-6? No lo encontré").
 */
export function useFichas(articulos: (string | null | undefined)[]) {
  const ids = [...new Set(articulos.filter(Boolean) as string[])].sort();
  return useQuery({
    queryKey: ["fichas_de_articulos", ids.join(",")], enabled: ids.length > 0, staleTime: 5 * 60_000,
    queryFn: async () => {
      const filas = await q<FichaDoc[]>(supabase.rpc("fichas_de_articulos", { p_articulos: ids }));
      const porArticulo: Record<string, FichaDoc[]> = {};
      for (const f of filas) (porArticulo[f.articulo_id] ??= []).push(f);
      return porArticulo;
    },
  });
}

const Icono = ({ tipo }: { tipo: FichaDoc["tipo"] }) => tipo === "foto" ? <Images className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />;

/** Ligas cortas junto a la partida: "Ficha", "Fotos". */
export function ChipsFichas({ docs }: { docs: FichaDoc[] | undefined }) {
  if (!docs?.length) return null;
  return (
    <>
      {docs.map((d) => (
        <a key={d.documento_id} href={d.drive_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} title={`${d.titulo} (${d.folio} rev. ${d.revision})`}
          className="inline-flex items-center gap-1 rounded-full border border-marca/25 bg-marca-suave px-2 py-0.5 text-xs font-medium text-marca-texto hover:border-marca/50">
          <Icono tipo={d.tipo} />{d.tipo === "foto" ? "Fotos" : "Ficha"}
        </a>
      ))}
    </>
  );
}

/** Sección de la ficha de venta (panel de la partida). */
export function FichasTecnicas({ articuloId, tipo }: { articuloId: string; tipo?: string }) {
  const f = useFichas([articuloId]);
  const docs = f.data?.[articuloId] ?? [];
  if (f.isLoading) return null;
  return (
    <div className="text-sm">
      <p className="text-xs font-medium text-tenue uppercase tracking-wide mb-1.5">Fichas técnicas y fotos</p>
      {docs.length === 0 ? (
        <p className="text-xs text-tenue">{tipo === "equipo" ? "Este equipo no tiene ficha vigente en el ERP; ingeniería ya lo ve en sus pendientes." : "Sin ficha ni fotos en el ERP."}</p>
      ) : (
        <ul className="space-y-1">
          {docs.map((d) => (
            <li key={d.documento_id}>
              <a href={d.drive_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-md px-2 py-1.5 bg-fondo hover:bg-marca-suave text-texto">
                <span className="text-marca-texto"><Icono tipo={d.tipo} /></span>
                <span className="flex-1 min-w-0 truncate">{d.titulo}</span>
                <span className="text-[11px] text-tenue cifra">rev. {d.revision}</span>
                <ExternalLink className="h-3.5 w-3.5 text-tenue" />
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** El bloque que se agrega al mensaje de WhatsApp/correo. */
export function textoFichas(docs: { titulo: string; drive_url: string }[]) {
  if (!docs.length) return "";
  return "\n\n" + ["Fichas técnicas:", ...docs.map((d) => `• ${d.titulo}: ${d.drive_url}`)].join("\n");
}

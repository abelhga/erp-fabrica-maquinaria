// Todos los planos con su folio y revisión, y lo que falta: equipos que se están
// fabricando sin plano vigente en el ERP. Lo de la carpeta de Drive que no tiene
// dueño claro se resuelve desde aquí, un equipo a la vez.
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ExternalLink, FileStack } from "lucide-react";
import { Pagina } from "@/components/layout/Shell";
import { Insignia } from "@/components/ui/insignia";
import { Cargando, ErrorCarga, Vacio } from "@/components/ui/estados";
import { TIPOS_DOC, type DocTecnico } from "@/components/planos/PlanosArticulo";
import { supabase } from "@/lib/supabase";
import { q } from "@/lib/consultas";
import { useSesion } from "@/lib/sesion";
import { fecha } from "@/lib/formato";
import { cn, coincide } from "@/lib/utilidades";

const ESTADOS = { vigente: "Vigentes", borrador: "Por aprobar", obsoleto: "Anteriores" } as const;

export default function Planos() {
  const { puede } = useSesion();
  const [params] = useSearchParams();
  const [busca, setBusca] = useState(params.get("folio") ?? "");
  const [estado, setEstado] = useState<keyof typeof ESTADOS>("vigente");
  const docs = useQuery({
    queryKey: ["documentos_tecnicos"],
    queryFn: () => q<DocTecnico[]>(supabase.from("v_documentos_tecnicos").select("*").order("folio").order("revision", { ascending: false })),
  });
  // Equipos en producción sin plano vigente: lo más urgente de ligar.
  const sinPlano = useQuery({
    queryKey: ["equipos_sin_plano", docs.dataUpdatedAt],
    // Se calcula contra los planos ya cargados; antes de eso todo parecería sin plano.
    enabled: puede("costeo", 2) && !!docs.data,
    queryFn: async () => {
      const ops = await q<{ folio: string; equipo: string; clave: string }[]>(
        supabase.from("v_tablero_produccion").select("folio, equipo, clave").limit(500));
      const vig = new Set((docs.data ?? []).filter((d) => d.estado === "vigente" && d.tipo === "plano").map((d) => d.clave));
      const por = new Map<string, { clave: string; equipo: string; ordenes: string[] }>();
      for (const o of ops) if (!vig.has(o.clave)) {
        const e = por.get(o.clave) ?? { clave: o.clave, equipo: o.equipo, ordenes: [] };
        e.ordenes.push(o.folio); por.set(o.clave, e);
      }
      return [...por.values()].sort((a, b) => b.ordenes.length - a.ordenes.length);
    },
  });

  const lista = (docs.data ?? []).filter((d) => d.estado === estado && (!busca || coincide(`${d.folio} ${d.titulo} ${d.clave ?? ""} ${d.articulo ?? ""}`, busca)));
  const cuenta = (e: string) => (docs.data ?? []).filter((d) => d.estado === e).length;

  return (
    <Pagina titulo="Planos" descripcion="Cada plano con su folio y su revisión vigente. El archivo sigue en Drive; aquí se sabe cuál es el bueno y con cuál se fabricó cada orden.">
      {puede("costeo", 2) && (sinPlano.data?.length ?? 0) > 0 && (
        <div className="tarjeta p-4 border-aviso/40">
          <p className="font-semibold flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-aviso" />Se están fabricando sin plano vigente en el ERP</p>
          <p className="text-sm text-tenue mt-0.5">El taller trabaja con lo que encuentra en Drive. Liga el plano bueno desde la ficha del equipo (pestaña Planos).</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {sinPlano.data!.slice(0, 12).map((e) => (
              <span key={e.clave} className="inline-flex items-center gap-2 rounded-lg border border-borde px-2.5 py-1.5 text-sm">
                <span className="font-medium">{e.equipo}</span>
                <span className="text-xs text-tenue">{e.ordenes.length} {e.ordenes.length === 1 ? "orden" : "órdenes"}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {(Object.keys(ESTADOS) as (keyof typeof ESTADOS)[]).filter((e) => e === "vigente" || puede("costeo", 2)).map((e) => (
          <button key={e} onClick={() => setEstado(e)}
            className={cn("h-9 px-3.5 rounded-full border text-sm inline-flex items-center gap-2", estado === e ? "bg-marca text-white border-marca" : "border-borde hover:border-marca/40")}>
            {ESTADOS[e]}<span className={cn("cifra text-xs", estado === e ? "text-white/80" : "text-tenue")}>{cuenta(e)}</span>
          </button>
        ))}
        <input className="campo max-w-sm ml-auto" placeholder="Folio, equipo o título…" value={busca} onChange={(e) => setBusca(e.target.value)} />
      </div>

      {docs.error ? <ErrorCarga error={docs.error} /> : docs.isLoading ? <Cargando filas={6} /> : lista.length === 0 ? (
        <Vacio icono={FileStack} titulo={estado === "vigente" ? "Todavía no hay planos ligados" : "Nada aquí"}
          texto="Entra a un equipo (Ingeniería → Equipos y subensambles), pestaña Planos, y liga el archivo de Drive: el ERP le da folio y revisión." />
      ) : (
        <div className="tarjeta overflow-x-auto">
          <table className="tabla">
            <thead><tr><th>Folio</th><th>Rev.</th><th>Título</th><th>Equipo o componente</th><th>Tipo</th><th>Aprobó</th><th></th></tr></thead>
            <tbody>
              {lista.map((d) => (
                <tr key={d.id}>
                  <td className="cifra font-medium">{d.folio}</td>
                  <td><Insignia tono={d.estado === "vigente" ? "ok" : d.estado === "borrador" ? "aviso" : "neutro"}>{d.revision}</Insignia></td>
                  <td>{d.titulo}{d.cambio && <p className="text-xs text-tenue">{d.cambio}</p>}</td>
                  <td>{d.articulo_id ? <Link to={`/costeo/equipos/${d.articulo_id}?pestana=planos`} className="hover:text-marca-texto">{d.clave} · {d.articulo}</Link> : "—"}</td>
                  <td className="text-tenue">{TIPOS_DOC[d.tipo] ?? d.tipo}</td>
                  <td className="text-tenue text-xs">{d.aprobado_en ? `${d.aprobado_por_nombre ?? ""} · ${fecha(d.aprobado_en)}` : "—"}</td>
                  <td><a href={d.drive_url} target="_blank" rel="noreferrer" className="text-marca-texto inline-flex items-center gap-1 text-sm"><ExternalLink className="h-3.5 w-3.5" />Drive</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Pagina>
  );
}

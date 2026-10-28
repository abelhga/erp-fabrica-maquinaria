// "Te toca a ti, para tal día": un pendiente ligado al registro donde estás
// (pedido, orden, cliente). Quien lo pide ve si ya se hizo sin tener que preguntar.
// A varias personas: cada una recibe el suyo (grupo_id) y quien pide elige si basta con que
// uno lo haga o si cada quien lo tiene que hacer; la base cierra el resto según eso.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ListPlus, X } from "lucide-react";
import { Dialogo } from "@/components/ui/dialogo";
import { Boton } from "@/components/ui/boton";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { useSesion } from "@/lib/sesion";
import { cn } from "@/lib/utilidades";
import { GLOSARIO } from "@/tutorial/glosario";

export function NuevoPendiente({ tabla, registroId, ruta, tituloSugerido, children }: {
  tabla?: string; registroId?: string; ruta?: string; tituloSugerido?: string; children?: React.ReactNode;
}) {
  const { perfil } = useSesion();
  const [abierto, setAbierto] = useState(false);
  const [titulo, setTitulo] = useState(tituloSugerido ?? "");
  const [responsables, setResponsables] = useState<string[]>([]);
  const [modo, setModo] = useState<"uno" | "todos">("uno");
  const [vence, setVence] = useState("");
  const [detalle, setDetalle] = useState("");
  const personas = useQuery({
    queryKey: ["perfiles_activos"],
    enabled: abierto,
    queryFn: () => q<{ id: string; nombre: string; puesto: string | null }[]>(
      supabase.from("perfiles").select("id, nombre, puesto").eq("activo", true).order("nombre")),
    staleTime: 10 * 60_000,
  });
  const crear = useAccion(() => {
    const varios = responsables.length > 1;
    const grupo = varios ? crypto.randomUUID() : null;
    return q(supabase.from("pendientes").insert(responsables.map((r) => ({
      titulo: titulo.trim(), responsable_id: r, vence: vence || null, detalle: detalle.trim() || null,
      tabla: tabla ?? null, registro_id: registroId ?? null, ruta: ruta ?? null, creado_por: perfil!.id,
      grupo_id: grupo, modo: varios ? modo : null,
    }))).select("id"));
  }, {
    exito: responsables.length > 1 ? `Pendiente asignado a ${responsables.length} personas: les llegó un aviso` : "Pendiente asignado: le llegó un aviso",
    invalidar: [["pendientes"]],
    alTerminar: () => { setAbierto(false); setTitulo(tituloSugerido ?? ""); setResponsables([]); setModo("uno"); setVence(""); setDetalle(""); },
  });
  const listo = titulo.trim() && responsables.length > 0;
  const nombre = (id: string) => personas.data?.find((p) => p.id === id)?.nombre ?? "…";

  return (
    <>
      <span onClick={() => setAbierto(true)}>
        {children ?? <Boton variante="secundario" tamano="sm"><ListPlus className="h-4 w-4" />Pedir algo a alguien</Boton>}
      </span>
      <Dialogo abierto={abierto} alCambiar={setAbierto} titulo="Nuevo pendiente"
        descripcion="Le llega un aviso a cada persona; cuando lo terminen, te llega a ti."
        pie={<><Boton variante="secundario" onClick={() => setAbierto(false)}>Cancelar</Boton>
          <Boton disabled={!listo} cargando={crear.isPending} onClick={() => crear.mutate(undefined)}>Asignar</Boton></>}>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (listo) crear.mutate(undefined); }}>
          <label className="block">
            <span className="etiqueta">Qué hay que hacer</span>
            <input autoFocus className="campo mt-1" value={titulo} onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ej. Precio y tiempo de entrega del motorreductor 5 HP" />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="etiqueta">Quién{responsables.length > 0 && " (puedes agregar más)"}</span>
              <select className="campo mt-1" value="" onChange={(e) => e.target.value && setResponsables((r) => [...r, e.target.value])}>
                <option value="">{responsables.length ? "Agregar a otra persona…" : "Elige a la persona…"}</option>
                {(personas.data ?? []).filter((p) => p.id !== perfil?.id && !responsables.includes(p.id)).map((p) => (
                  <option key={p.id} value={p.id}>{p.nombre}{p.puesto ? ` · ${p.puesto}` : ""}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="etiqueta">Para cuándo</span>
              <input type="date" className="campo mt-1" value={vence} onChange={(e) => setVence(e.target.value)} />
            </label>
          </div>
          {responsables.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {responsables.map((r) => (
                <span key={r} className="inline-flex items-center gap-1 rounded-full border border-marca/30 bg-marca-suave text-marca-texto pl-2.5 pr-1 py-0.5 text-xs">
                  {nombre(r)}
                  <button type="button" onClick={() => setResponsables((x) => x.filter((y) => y !== r))} aria-label={`Quitar a ${nombre(r)}`}
                    className="rounded-full p-0.5 hover:bg-marca/20"><X className="h-3 w-3" /></button>
                </span>
              ))}
            </div>
          )}
          {responsables.length > 1 && (
            <div className="space-y-1.5" data-explain={GLOSARIO.pendienteVarios} data-explain-title="A varias personas">
              <span className="etiqueta">¿Cuándo queda hecho?</span>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {([["uno", "Basta con que uno lo haga", "Al primero que lo termine, a los demás se les cierra solo."],
                   ["todos", "Cada quien lo tiene que hacer", "Queda hecho cuando todos terminan; te llega cuántos van."]] as const).map(([v, t, d]) => (
                  <button key={v} type="button" onClick={() => setModo(v)}
                    className={cn("rounded-lg border px-3 py-2 text-left text-sm transition",
                      modo === v ? "border-marca bg-marca-suave text-marca-texto" : "border-borde hover:bg-fondo")}>
                    <span className="font-medium block">{t}</span><span className="text-xs text-tenue">{d}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <label className="block">
            <span className="etiqueta">Detalle (opcional)</span>
            <textarea className="campo mt-1 h-20 py-2" value={detalle} onChange={(e) => setDetalle(e.target.value)} />
          </label>
          {ruta && <p className="text-xs text-tenue">Queda ligado a esta pantalla: quien lo reciba llega directo aquí.</p>}
        </form>
      </Dialogo>
    </>
  );
}

// "Te toca a ti, para tal día": un pendiente ligado al registro donde estás
// (pedido, orden, cliente). Quien lo pide ve si ya se hizo sin tener que preguntar.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ListPlus } from "lucide-react";
import { Dialogo } from "@/components/ui/dialogo";
import { Boton } from "@/components/ui/boton";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { useSesion } from "@/lib/sesion";

export function NuevoPendiente({ tabla, registroId, ruta, tituloSugerido, children }: {
  tabla?: string; registroId?: string; ruta?: string; tituloSugerido?: string; children?: React.ReactNode;
}) {
  const { perfil } = useSesion();
  const [abierto, setAbierto] = useState(false);
  const [titulo, setTitulo] = useState(tituloSugerido ?? "");
  const [responsable, setResponsable] = useState("");
  const [vence, setVence] = useState("");
  const [detalle, setDetalle] = useState("");
  const personas = useQuery({
    queryKey: ["perfiles_activos"],
    enabled: abierto,
    queryFn: () => q<{ id: string; nombre: string; puesto: string | null }[]>(
      supabase.from("perfiles").select("id, nombre, puesto").eq("activo", true).order("nombre")),
    staleTime: 10 * 60_000,
  });
  const crear = useAccion(() => q(supabase.from("pendientes").insert({
    titulo: titulo.trim(), responsable_id: responsable, vence: vence || null, detalle: detalle.trim() || null,
    tabla: tabla ?? null, registro_id: registroId ?? null, ruta: ruta ?? null, creado_por: perfil!.id,
  }).select("id").single()), {
    exito: "Pendiente asignado: le llegó un aviso", invalidar: [["pendientes"]],
    alTerminar: () => { setAbierto(false); setTitulo(tituloSugerido ?? ""); setResponsable(""); setVence(""); setDetalle(""); },
  });
  const listo = titulo.trim() && responsable;

  return (
    <>
      <span onClick={() => setAbierto(true)}>
        {children ?? <Boton variante="secundario" tamano="sm"><ListPlus className="h-4 w-4" />Pedir algo a alguien</Boton>}
      </span>
      <Dialogo abierto={abierto} alCambiar={setAbierto} titulo="Nuevo pendiente"
        descripcion="Le llega un aviso a la persona; cuando lo termine, te llega a ti."
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
              <span className="etiqueta">Quién</span>
              <select className="campo mt-1" value={responsable} onChange={(e) => setResponsable(e.target.value)}>
                <option value="">Elige a la persona…</option>
                {(personas.data ?? []).filter((p) => p.id !== perfil?.id).map((p) => (
                  <option key={p.id} value={p.id}>{p.nombre}{p.puesto ? ` · ${p.puesto}` : ""}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="etiqueta">Para cuándo</span>
              <input type="date" className="campo mt-1" value={vence} onChange={(e) => setVence(e.target.value)} />
            </label>
          </div>
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

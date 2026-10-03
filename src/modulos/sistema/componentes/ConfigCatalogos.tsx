import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Tarjeta, EncabezadoTarjeta } from "@/components/ui/tarjeta";
import { Boton } from "@/components/ui/boton";
import { Entrada, Seleccion } from "@/components/ui/campo";
import { Cargando } from "@/components/ui/estados";
import { useSesion } from "@/lib/sesion";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { numero } from "@/lib/formato";
import { CeldaCheck, CeldaTexto, SoloLectura } from "./Editables";

interface Almacen { id: number; nombre: string; tipo: "fisico" | "mercadolibre"; disponible_para_planta: boolean; descripcion: string | null; activo: boolean }
interface Etapa { id: number; nombre: string; orden: number; color: string; activa: boolean; capacidad_horas_semana: number }

export function ConfigAlmacenes() {
  const { puede } = useSesion();
  const editable = puede("inventario", 3) || puede("admin", 3);
  const almacenes = useQuery({ queryKey: ["almacenes", "todos"], queryFn: () => q<Almacen[]>(supabase.from("almacenes").select("*").order("id")) });
  const cambiar = useAccion(({ id, datos }: { id: number; datos: Partial<Almacen> }) => q(supabase.from("almacenes").update(datos).eq("id", id)),
    { invalidar: [["almacenes"]] });
  const [nuevo, setNuevo] = useState<{ nombre: string; tipo: Almacen["tipo"] }>({ nombre: "", tipo: "fisico" });
  const agregar = useAccion(() => q(supabase.from("almacenes").insert({ nombre: nuevo.nombre.trim(), tipo: nuevo.tipo, disponible_para_planta: nuevo.tipo === "fisico" })),
    { exito: "Almacén dado de alta", invalidar: [["almacenes"]], alTerminar: () => setNuevo({ nombre: "", tipo: "fisico" }) });
  return (
    <Tarjeta>
      <EncabezadoTarjeta titulo="Almacenes" descripcion="Dónde se guarda el material. Lo que no está disponible para planta (Full de Mercado Libre) existe, pero no cuenta para producción ni para el cotizador." />
      <div className="px-5 pb-5 space-y-3">
        {!editable && <SoloLectura quien="almacén (nivel administrar), sistemas o dirección" />}
        {almacenes.isLoading ? <Cargando /> : (
          <div className="overflow-x-auto">
            <table className="tabla">
              <thead><tr><th>Nombre</th><th>Tipo</th><th className="!text-center">Disponible para planta</th><th>Descripción</th><th className="!text-center">Activo</th></tr></thead>
              <tbody>
                {(almacenes.data ?? []).map((a) => (
                  <tr key={a.id} className={a.activo ? "" : "opacity-60"}>
                    <td><CeldaTexto valor={a.nombre} deshabilitado={!editable} ariaLabel="Nombre" className="min-w-[160px] font-medium" alGuardar={(v) => v.trim() && cambiar.mutate({ id: a.id, datos: { nombre: v.trim() } })} /></td>
                    <td>
                      <Seleccion className="h-8 min-w-[150px]" disabled={!editable} value={a.tipo} aria-label="Tipo"
                        onChange={(e) => cambiar.mutate({ id: a.id, datos: { tipo: e.target.value as Almacen["tipo"] } })}>
                        <option value="fisico">Físico</option>
                        <option value="mercadolibre">Mercado Libre (Full)</option>
                      </Seleccion>
                    </td>
                    <td className="text-center"><CeldaCheck valor={a.disponible_para_planta} deshabilitado={!editable} ariaLabel="Disponible para planta" alCambiar={(v) => cambiar.mutate({ id: a.id, datos: { disponible_para_planta: v } })} /></td>
                    <td><CeldaTexto valor={a.descripcion} deshabilitado={!editable} ariaLabel="Descripción" placeholder={editable ? "Dónde está, qué guarda…" : ""} className="min-w-[200px]" alGuardar={(v) => cambiar.mutate({ id: a.id, datos: { descripcion: v.trim() || null } })} /></td>
                    <td className="text-center"><CeldaCheck valor={a.activo} deshabilitado={!editable} ariaLabel="Activo" alCambiar={(v) => cambiar.mutate({ id: a.id, datos: { activo: v } })} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {editable && (
          <form className="flex flex-wrap gap-2" onSubmit={(e: FormEvent) => { e.preventDefault(); if (nuevo.nombre.trim()) agregar.mutate(undefined); }}>
            <Entrada value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} placeholder="Nuevo almacén (p. ej. Contenedor 3)" className="max-w-xs" />
            <Seleccion value={nuevo.tipo} onChange={(e) => setNuevo({ ...nuevo, tipo: e.target.value as Almacen["tipo"] })} className="w-auto">
              <option value="fisico">Físico</option>
              <option value="mercadolibre">Mercado Libre (Full)</option>
            </Seleccion>
            <Boton type="submit" variante="secundario" cargando={agregar.isPending} disabled={!nuevo.nombre.trim()}><Plus className="h-4 w-4" /> Agregar</Boton>
          </form>
        )}
      </div>
    </Tarjeta>
  );
}

export function ConfigTaller() {
  const { puede } = useSesion();
  const editable = puede("produccion", 3) || puede("admin", 3);
  const etapas = useQuery({ queryKey: ["etapas", "todas"], queryFn: () => q<Etapa[]>(supabase.from("etapas").select("*").order("orden")) });
  const cambiar = useAccion(({ id, datos }: { id: number; datos: Partial<Etapa> }) => q(supabase.from("etapas").update(datos).eq("id", id)),
    { invalidar: [["etapas"]] });
  const [nombre, setNombre] = useState("");
  const agregar = useAccion(() => q(supabase.from("etapas").insert({ nombre: nombre.trim(), orden: Math.max(0, ...(etapas.data ?? []).map((e) => e.orden)) + 10 })),
    { exito: "Etapa agregada", invalidar: [["etapas"]], alTerminar: () => setNombre("") });
  const capacidad = (etapas.data ?? []).filter((e) => e.activa).reduce((s, e) => s + Number(e.capacidad_horas_semana), 0);
  return (
    <Tarjeta>
      <EncabezadoTarjeta titulo="Etapas del taller" descripcion="El recorrido de un equipo por el taller. El color es el de la pantalla de piso; la capacidad, las horas hombre por semana contra las que se mide la carga."
        acciones={<span className="text-sm text-tenue whitespace-nowrap">Capacidad total: <b className="text-texto cifra">{numero(capacidad)} h/sem</b></span>} />
      <div className="px-5 pb-5 space-y-3">
        {!editable && <SoloLectura quien="gerencia de producción, sistemas o dirección" />}
        {etapas.isLoading ? <Cargando /> : (
          <div className="overflow-x-auto">
            <table className="tabla">
              <thead><tr><th className="w-16">Color</th><th>Etapa</th><th className="w-24 !text-right">Orden</th><th className="w-36 !text-right">Capacidad h/semana</th><th className="w-20 !text-center">Activa</th></tr></thead>
              <tbody>
                {(etapas.data ?? []).map((e) => (
                  <tr key={e.id} className={e.activa ? "" : "opacity-60"}>
                    <td><CeldaTexto tipo="color" valor={e.color} deshabilitado={!editable} ariaLabel={`Color de ${e.nombre}`} alGuardar={(v) => cambiar.mutate({ id: e.id, datos: { color: v } })} /></td>
                    <td><CeldaTexto valor={e.nombre} deshabilitado={!editable} ariaLabel="Nombre" className="font-medium min-w-[140px]" alGuardar={(v) => v.trim() && cambiar.mutate({ id: e.id, datos: { nombre: v.trim() } })} /></td>
                    <td><CeldaTexto tipo="number" paso="1" valor={e.orden} deshabilitado={!editable} ariaLabel="Orden" className="w-20 ml-auto" alGuardar={(v) => cambiar.mutate({ id: e.id, datos: { orden: Number(v) } })} /></td>
                    <td><CeldaTexto tipo="number" paso="0.5" valor={e.capacidad_horas_semana} deshabilitado={!editable} ariaLabel="Capacidad" className="w-28 ml-auto" alGuardar={(v) => cambiar.mutate({ id: e.id, datos: { capacidad_horas_semana: Number(v) } })} /></td>
                    <td className="text-center"><CeldaCheck valor={e.activa} deshabilitado={!editable} ariaLabel="Activa" alCambiar={(v) => cambiar.mutate({ id: e.id, datos: { activa: v } })} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {editable && (
          <form className="flex gap-2" onSubmit={(ev: FormEvent) => { ev.preventDefault(); if (nombre.trim()) agregar.mutate(undefined); }}>
            <Entrada value={nombre} onChange={(ev) => setNombre(ev.target.value)} placeholder="Nueva etapa (p. ej. Armado)" className="max-w-xs" />
            <Boton type="submit" variante="secundario" cargando={agregar.isPending} disabled={!nombre.trim()}><Plus className="h-4 w-4" /> Agregar</Boton>
          </form>
        )}
        <p className="text-xs text-tenue">Las horas de cada equipo por etapa se capturan en su lista de materiales (Ingeniería). 45 h por persona a la semana es una buena base.</p>
      </div>
    </Tarjeta>
  );
}

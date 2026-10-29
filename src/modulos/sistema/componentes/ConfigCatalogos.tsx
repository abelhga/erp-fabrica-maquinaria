import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Tarjeta, EncabezadoTarjeta } from "@/components/ui/tarjeta";
import { Boton } from "@/components/ui/boton";
import { Entrada, Seleccion } from "@/components/ui/campo";
import { Cargando } from "@/components/ui/estados";
import { Insignia } from "@/components/ui/insignia";
import { Interruptor } from "@/components/ui/interruptor";
import { useSesion } from "@/lib/sesion";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { numero } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { CeldaCheck, CeldaTexto, SoloLectura } from "./Editables";
import { GLOSARIO } from "@/tutorial/glosario";

interface Almacen { id: number; nombre: string; tipo: "fisico" | "mercadolibre"; disponible_para_planta: boolean; descripcion: string | null; activo: boolean }
interface Etapa { id: number; nombre: string; orden: number; color: string; activa: boolean; capacidad_horas_semana: number; en_paralelo: boolean }

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
              <thead><tr><th>Nombre</th><th>Tipo</th><th className="!text-center" data-explain={GLOSARIO.almacenParaPlanta}>Disponible para planta</th><th>Descripción</th><th className="!text-center">Activo</th></tr></thead>
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

interface CategoriaConsumible { id: number; nombre: string; consumible_taller: boolean }

/**
 * El switch de consumibles del taller y qué categorías cuentan. La regla vive en la base
 * (surtir manda esas partidas a consumo a nombre de quien recibe); aquí solo se prende.
 */
export function ConfigConsumibles() {
  const { puede } = useSesion();
  const editable = puede("inventario", 3) || puede("admin", 3);
  const datos = useQuery({
    queryKey: ["consumibles_taller"],
    queryFn: async () => {
      const [cats, conf] = await Promise.all([
        q<CategoriaConsumible[]>(supabase.from("categorias").select("id, nombre, consumible_taller").order("nombre")),
        q<{ valor: unknown }[]>(supabase.from("configuracion").select("valor").eq("clave", "almacen_consumibles_taller")),
      ]);
      return { cats, activo: conf[0]?.valor === true };
    },
  });
  const guardadas = new Set((datos.data?.cats ?? []).filter((c) => c.consumible_taller).map((c) => c.id));
  const [marcadas, setMarcadas] = useState<Set<number> | null>(null);
  const actuales = marcadas ?? guardadas;
  const cambiaron = marcadas != null && (marcadas.size !== guardadas.size || [...marcadas].some((id) => !guardadas.has(id)));
  const fijar = useAccion((v: { activo: boolean; categorias: number[] | null }) =>
    q<number>(supabase.rpc("fijar_consumibles_taller", { p_activo: v.activo, p_categorias: v.categorias })), {
    exito: (n) => (n > 0 ? `Listo. Se soltó lo apartado para órdenes de ${numero(n)} consumible(s)` : "Listo"),
    invalidar: [["consumibles_taller"]], alTerminar: () => setMarcadas(null),
  });
  const activo = datos.data?.activo ?? false;
  const alternar = (id: number) => {
    const n = new Set(actuales);
    if (n.has(id)) n.delete(id); else n.add(id);
    setMarcadas(n);
  };
  return (
    <Tarjeta>
      <EncabezadoTarjeta titulo="Consumibles del taller" explica={GLOSARIO.consumibleTaller}
        descripcion="Lo que se gasta trabajando (discos, lijas, soldadura, EPP) sale a nombre de quien lo recibe, no a la orden. En la orden se ve como «Del taller» y no cuenta como faltante." />
      <div className="px-5 pb-5 space-y-4">
        {!editable && <SoloLectura quien="almacén (nivel administrar), sistemas o dirección" />}
        {datos.isLoading ? <Cargando /> : (
          <>
            <div className="flex items-center justify-between gap-4 rounded-lg border border-borde px-4 py-3">
              <div>
                <p className="text-sm font-medium">Sacar los consumibles a nombre de quien los recibe</p>
                <p className="text-xs text-tenue">Apagado, todo lo que sale para una orden se carga a la orden, como en la hoja. Al prenderlo se suelta lo que estaba apartado de consumibles para órdenes.</p>
              </div>
              {editable
                ? <Interruptor activo={activo} cargando={fijar.isPending} aria-label="Consumibles del taller" alCambiar={(v) => fijar.mutate({ activo: v, categorias: null })} />
                : <Insignia tono={activo ? "ok" : "neutro"}>{activo ? "Prendido" : "Apagado"}</Insignia>}
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Categorías que cuentan como consumibles <span className="text-tenue font-normal cifra">({numero(actuales.size)})</span></p>
              <div className="flex flex-wrap gap-1.5">
                {(datos.data?.cats ?? []).map((c) => (
                  <button key={c.id} type="button" disabled={!editable} aria-pressed={actuales.has(c.id)} onClick={() => alternar(c.id)}
                    className={cn("h-7 rounded-full border px-2.5 text-xs transition",
                      actuales.has(c.id) ? "border-marca bg-marca-suave text-marca-texto font-medium" : "border-borde text-tenue hover:text-texto",
                      !editable && !actuales.has(c.id) && "hidden")}>
                    {c.nombre}
                  </button>
                ))}
              </div>
              {editable && cambiaron && (
                <div className="flex gap-2">
                  <Boton tamano="sm" cargando={fijar.isPending} onClick={() => fijar.mutate({ activo, categorias: [...actuales] })}>Guardar categorías</Boton>
                  <Boton tamano="sm" variante="fantasma" onClick={() => setMarcadas(null)}>Deshacer</Boton>
                </div>
              )}
            </div>
          </>
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
      <EncabezadoTarjeta titulo="Etapas del taller" descripcion="El recorrido de un equipo por el taller, en el orden de la columna «Orden». El color es el de la pantalla de piso; la capacidad, las horas hombre por semana contra las que se mide la carga. «En paralelo»: esa etapa no espera a las anteriores."
        acciones={<span className="text-sm text-tenue whitespace-nowrap">Capacidad total: <b className="text-texto cifra">{numero(capacidad)} h/sem</b></span>} />
      <div className="px-5 pb-5 space-y-3">
        {!editable && <SoloLectura quien="gerencia de producción, sistemas o dirección" />}
        {etapas.isLoading ? <Cargando /> : (
          <div className="overflow-x-auto">
            <table className="tabla">
              <thead><tr><th className="w-16">Color</th><th>Etapa</th><th className="w-24 !text-right">Orden</th><th className="w-36 !text-right" data-explain={GLOSARIO.capacidadEtapa}>Capacidad h/semana</th><th className="w-24 !text-center" data-explain={GLOSARIO.etapaEnParalelo}>En paralelo</th><th className="w-20 !text-center">Activa</th></tr></thead>
              <tbody>
                {(etapas.data ?? []).map((e) => (
                  <tr key={e.id} className={e.activa ? "" : "opacity-60"}>
                    <td><CeldaTexto tipo="color" valor={e.color} deshabilitado={!editable} ariaLabel={`Color de ${e.nombre}`} alGuardar={(v) => cambiar.mutate({ id: e.id, datos: { color: v } })} /></td>
                    <td><CeldaTexto valor={e.nombre} deshabilitado={!editable} ariaLabel="Nombre" className="font-medium min-w-[140px]" alGuardar={(v) => v.trim() && cambiar.mutate({ id: e.id, datos: { nombre: v.trim() } })} /></td>
                    <td><CeldaTexto tipo="number" paso="1" valor={e.orden} deshabilitado={!editable} ariaLabel="Orden" className="w-20 ml-auto" alGuardar={(v) => cambiar.mutate({ id: e.id, datos: { orden: Number(v) } })} /></td>
                    <td><CeldaTexto tipo="number" paso="0.5" valor={e.capacidad_horas_semana} deshabilitado={!editable} ariaLabel="Capacidad" className="w-28 ml-auto" alGuardar={(v) => cambiar.mutate({ id: e.id, datos: { capacidad_horas_semana: Number(v) } })} /></td>
                    <td className="text-center"><CeldaCheck valor={e.en_paralelo} deshabilitado={!editable} ariaLabel={`${e.nombre} en paralelo`} alCambiar={(v) => cambiar.mutate({ id: e.id, datos: { en_paralelo: v } })} /></td>
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

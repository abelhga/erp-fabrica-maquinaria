import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Layers, Search } from "lucide-react";
import { Dialogo } from "@/components/ui/dialogo";
import { Boton } from "@/components/ui/boton";
import { Campo, Entrada } from "@/components/ui/campo";
import { Insignia } from "@/components/ui/insignia";
import { BuscadorArticulo, type ArticuloEncontrado } from "@/components/datos/BuscadorArticulo";
import { supabase } from "@/lib/supabase";
import { mensajeError, q } from "@/lib/consultas";
import { cn } from "@/lib/utilidades";
import { cant } from "./comun";
import type { LineaArbol } from "./datosLista";

interface Coincidencia {
  subensamble_id: string; clave: string; nombre: string; lineas_subensamble: number; lineas_elegidas: number;
  iguales: number; misma_pieza_otra_cantidad: number; exacto: boolean; horas_propias: number; horas_detalle: string | null;
}

const SOLO_SUBENSAMBLES: ArticuloEncontrado["tipo"][] = ["subensamble"];

function useCoincidencias(padre: string, lineas: LineaArbol[], abierto: boolean) {
  const ids = lineas.map((l) => l.linea_id);
  return useQuery({
    queryKey: ["costeo", "coincidencias", padre, ids.join(",")],
    enabled: abierto && ids.length > 0,
    queryFn: () => q<Coincidencia[]>(supabase.rpc("subensambles_coincidentes", { p_padre: padre, p_lineas: ids })),
  });
}

function ResumenLineas({ lineas }: { lineas: LineaArbol[] }) {
  return (
    <ul className="max-h-40 overflow-y-auto rounded-lg border border-borde divide-y divide-borde text-sm">
      {lineas.map((l) => (
        <li key={l.linea_id} className="flex items-center gap-2 px-3 py-1.5">
          <span className="cifra text-tenue w-32 shrink-0 truncate" title={l.clave}>{l.clave}</span>
          <span className="truncate flex-1">{l.nombre}</span>
          <span className="cifra whitespace-nowrap">{cant(l.cantidad_efectiva)} {l.unidad}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * "Convertir en subensamble": las líneas elegidas se vuelven un subensamble
 * nuevo y en el equipo quedan como una sola línea de 1 pieza. Antes de crear
 * otro, revisa si esas mismas piezas ya son un subensamble que existe.
 */
export function DialogoConvertir({ abierto, alCambiar, padre, lineas, alTerminar }: {
  abierto: boolean; alCambiar: (v: boolean) => void; padre: { id: string; nombre: string }; lineas: LineaArbol[]; alTerminar: () => void;
}) {
  const ir = useNavigate();
  const qc = useQueryClient();
  const [clave, setClave] = useState("");
  const [nombre, setNombre] = useState("");
  const [guardando, setGuardando] = useState(false);
  const coinc = useCoincidencias(padre.id, lineas, abierto);
  const identico = coinc.data?.find((c) => c.exacto);
  const conParametro = lineas.filter((l) => l.parametro);
  const parametros = [...new Set(conParametro.map((l) => l.parametro!))];

  useEffect(() => {
    if (!abierto) return;
    const grupos = [...new Set(lineas.map((l) => l.grupo))];
    setNombre(grupos.length === 1 && grupos[0] ? grupos[0] : "");
    supabase.rpc("sugerir_clave", { p_tipo: "subensamble" }).then(({ data }) => setClave((data as string) ?? ""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);

  async function terminar(nuevo: string | null, mensaje: string) {
    toast.success(mensaje, nuevo ? { action: { label: "Abrir subensamble", onClick: () => ir(`/costeo/equipos/${nuevo}`) } } : undefined);
    await qc.invalidateQueries({ queryKey: ["costeo"] });
    alTerminar();
    alCambiar(false);
  }

  async function crear(e: FormEvent) {
    e.preventDefault();
    if (!clave.trim() || !nombre.trim()) { toast.error("El subensamble necesita clave y nombre."); return; }
    setGuardando(true);
    try {
      const id = await q<string>(supabase.rpc("extraer_subensamble", {
        p_padre: padre.id, p_lineas: lineas.map((l) => l.linea_id), p_clave: clave.trim(), p_nombre: nombre.trim(),
      }));
      await terminar(id, `${clave.trim()} creado con ${lineas.length} líneas. El costo de «${padre.nombre}» no cambió.`);
    } catch (err) { toast.error(mensajeError(err)); } finally { setGuardando(false); }
  }

  async function usarIdentico() {
    if (!identico) return;
    setGuardando(true);
    try {
      await q(supabase.rpc("sustituir_por_subensamble", { p_padre: padre.id, p_lineas: lineas.map((l) => l.linea_id), p_subensamble: identico.subensamble_id, p_restar_horas: false }));
      await terminar(identico.subensamble_id, `Las ${lineas.length} líneas se sustituyeron por ${identico.clave}.`);
    } catch (err) { toast.error(mensajeError(err)); } finally { setGuardando(false); }
  }

  return (
    <Dialogo abierto={abierto} alCambiar={alCambiar} ancho="max-w-xl" titulo="Convertir en subensamble"
      descripcion="Las líneas elegidas pasan a un subensamble nuevo y aquí quedan como una sola línea de 1 pieza. El costo no cambia: es reorganizar, no recostear."
      pie={<>
        <Boton variante="secundario" type="button" onClick={() => alCambiar(false)}>Cancelar</Boton>
        <Boton type="submit" form="convertir-sub" cargando={guardando}><Layers className="h-4 w-4" /> Crear subensamble</Boton>
      </>}>
      <div className="space-y-4">
        {identico && (
          <div className="rounded-lg border border-ok/30 bg-ok-suave p-3 text-sm flex gap-3 items-start">
            <CheckCircle2 className="h-5 w-5 text-ok shrink-0 mt-0.5" />
            <div className="flex-1">
              <p><b>Estas piezas ya son un subensamble:</b> <span className="cifra">{identico.clave}</span> {identico.nombre} (mismas piezas y cantidades).</p>
              <p className="text-tenue mt-0.5">Mejor úsalo en lugar de crear otro igual; así un cambio en él llega a todos los equipos.</p>
              <Boton tamano="sm" variante="exito" className="mt-2" type="button" onClick={usarIdentico} cargando={guardando}>Usar {identico.clave}</Boton>
            </div>
          </div>
        )}
        <ResumenLineas lineas={lineas} />
        {parametros.length > 0 && (
          <p className="text-sm rounded-lg bg-info-suave text-info px-3 py-2">
            {conParametro.length === 1 ? "Una línea depende" : `${conParametro.length} líneas dependen`} de {parametros.map((p) => <code key={p} className="mx-0.5">{p}</code>)}:
            el subensamble recibe su propia copia con el mismo valor, para que las cantidades no cambien.
            {/* Un subensamble compartido no puede seguir el largo de cada equipo que lo usa: al duplicar
                la banda de 20 m como de 22 m, lo de adentro se queda en 20 m. Mejor saberlo antes. */}
            <span className="block mt-1">Ojo: si después duplicas el equipo con otro valor, esas cantidades ya no lo siguen. Lo que cambia con el largo conviene dejarlo fuera del subensamble.</span>
          </p>
        )}
        <form id="convertir-sub" onSubmit={crear} className="grid gap-4 sm:grid-cols-[190px_1fr]">
          <Campo etiqueta="Clave"><Entrada value={clave} onChange={(e) => setClave(e.target.value)} className="cifra" /></Campo>
          <Campo etiqueta="Nombre del subensamble">
            <Entrada autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder='Cabezal motriz 18" con motorreductor 3 HP' />
          </Campo>
        </form>
      </div>
    </Dialogo>
  );
}

/**
 * "Usar subensamble existente". Con líneas elegidas: las sustituye por el
 * subensamble (y avisa si no son idénticas, porque entonces el costo cambia).
 * Sin líneas elegidas: agrega una línea de 1 pieza del subensamble.
 */
export function DialogoUsarExistente({ abierto, alCambiar, padre, lineas, grupo, alTerminar }: {
  abierto: boolean; alCambiar: (v: boolean) => void; padre: { id: string; nombre: string }; lineas: LineaArbol[];
  grupo: string | null; alTerminar: () => void;
}) {
  const qc = useQueryClient();
  const todas = useCoincidencias(padre.id, lineas, abierto);
  // Solo los que comparten al menos una pieza con la misma cantidad: "0 de 7 iguales" es ruido.
  const coincData = useMemo(() => todas.data?.filter((c) => c.iguales > 0), [todas.data]);
  const coinc = { data: coincData };
  const [elegido, setElegido] = useState<{ id: string; clave: string; nombre: string; c?: Coincidencia } | null>(null);
  const [restar, setRestar] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const sustituir = lineas.length > 0;

  useEffect(() => { if (abierto) { setElegido(null); setRestar(false); } }, [abierto]);
  useEffect(() => {
    // Si hay uno idéntico, se propone de entrada.
    const id = coinc.data?.find((c) => c.exacto);
    if (id && !elegido) setElegido({ id: id.subensamble_id, clave: id.clave, nombre: id.nombre, c: id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coinc.data]);

  const horasElegido = useQuery({
    queryKey: ["costeo", "horas-propias", elegido?.id],
    enabled: !!elegido && !elegido.c && sustituir,
    queryFn: async () => {
      const filas = await q<{ horas_operacion: number; etapa: { nombre: string } }[]>(
        supabase.from("bom_operaciones").select("horas_operacion, etapa:etapas(nombre)").eq("articulo_id", elegido!.id) as unknown as
          PromiseLike<{ data: { horas_operacion: number; etapa: { nombre: string } }[] | null; error: { message: string } | null }>);
      const conHoras = filas.filter((f) => Number(f.horas_operacion) > 0);
      return { total: conHoras.reduce((s, f) => s + Number(f.horas_operacion), 0), detalle: conHoras.map((f) => `${cant(Number(f.horas_operacion))} h ${f.etapa.nombre.toLowerCase()}`).join(", ") };
    },
  });
  const horas = elegido?.c ? { total: Number(elegido.c.horas_propias), detalle: elegido.c.horas_detalle } : horasElegido.data;

  async function aplicar(sub: { id: string; clave: string; nombre: string }) {
    setGuardando(true);
    try {
      if (sustituir) {
        await q(supabase.rpc("sustituir_por_subensamble", { p_padre: padre.id, p_lineas: lineas.map((l) => l.linea_id), p_subensamble: sub.id, p_restar_horas: restar }));
        toast.success(`${lineas.length} líneas sustituidas por ${sub.clave}.`);
      } else {
        const { data: orden } = await supabase.from("bom_lineas").select("orden").eq("padre_id", padre.id).order("orden", { ascending: false }).limit(1).maybeSingle();
        const { error } = await supabase.from("bom_lineas").insert({ padre_id: padre.id, hijo_id: sub.id, cantidad: 1, grupo, orden: (orden?.orden ?? 0) + 10 });
        if (error) throw error;
        toast.success(`${sub.clave} agregado a la lista.`);
      }
      await qc.invalidateQueries({ queryKey: ["costeo"] });
      alTerminar();
      alCambiar(false);
    } catch (err) { toast.error(mensajeError(err)); } finally { setGuardando(false); }
  }

  return (
    <Dialogo abierto={abierto} alCambiar={alCambiar} ancho="max-w-xl" titulo="Usar subensamble existente"
      descripcion={sustituir
        ? `Las ${lineas.length} líneas elegidas se quitan y en su lugar queda 1 pieza del subensamble.`
        : "Agrega una línea de 1 pieza de un subensamble que ya existe. Si cambia, cambian todos los equipos que lo usan."}
      pie={sustituir ? <>
        <Boton variante="secundario" type="button" onClick={() => alCambiar(false)}>Cancelar</Boton>
        <Boton disabled={!elegido} cargando={guardando} onClick={() => elegido && aplicar(elegido)}>Sustituir por {elegido?.clave ?? "…"}</Boton>
      </> : undefined}>
      <div className="space-y-4">
        {sustituir && <ResumenLineas lineas={lineas} />}
        {sustituir && (coinc.data?.length ?? 0) > 0 && (
          <div className="space-y-1.5">
            <p className="etiqueta">Subensambles con estas piezas</p>
            {coinc.data!.map((c) => (
              <button key={c.subensamble_id} type="button" onClick={() => setElegido({ id: c.subensamble_id, clave: c.clave, nombre: c.nombre, c })}
                className={cn("w-full text-left rounded-lg border px-3 py-2 flex items-center gap-3 hover:bg-fondo",
                  elegido?.id === c.subensamble_id ? "border-marca bg-marca-suave/50" : "border-borde")}>
                <Layers className="h-4 w-4 text-tenue shrink-0" />
                <span className="flex-1 min-w-0">
                  <span className="cifra font-medium">{c.clave}</span> <span className="truncate">{c.nombre}</span>
                  {c.horas_detalle && <span className="block text-xs text-tenue">Horas propias: {c.horas_detalle}</span>}
                </span>
                {c.exacto ? <Insignia tono="ok">idéntico</Insignia>
                  : <Insignia tono="aviso">{c.iguales} de {Math.max(c.lineas_subensamble, c.lineas_elegidas)} iguales</Insignia>}
              </button>
            ))}
          </div>
        )}
        <div className="space-y-1.5">
          <p className="etiqueta flex items-center gap-1.5"><Search className="h-3.5 w-3.5" /> {sustituir ? "U otro subensamble" : "Buscar subensamble"}</p>
          <BuscadorArticulo tipos={SOLO_SUBENSAMBLES} autoFocus={!sustituir} placeholder="Cabezal, tambor, tablero…" mostrarPrecio={false}
            alElegir={(a) => (sustituir ? setElegido({ id: a.id, clave: a.clave, nombre: a.nombre }) : aplicar(a))} />
        </div>
        {sustituir && elegido && (
          <div className="rounded-lg border border-borde p-3 text-sm space-y-2">
            <p>Queda: <b>1 × <span className="cifra">{elegido.clave}</span> {elegido.nombre}</b></p>
            {!elegido.c?.exacto && (
              <p className="text-aviso">No está comprobado que sean las mismas piezas y cantidades: el costo del equipo puede cambiar. Revisa la diferencia en la pestaña Costo y precio.</p>
            )}
            {(horas?.total ?? 0) > 0 && (
              <label className="flex items-start gap-2">
                <input type="checkbox" checked={restar} onChange={(e) => setRestar(e.target.checked)} className="h-4 w-4 mt-0.5 accent-[hsl(var(--marca))]" />
                <span>Restar sus horas propias ({horas!.detalle}) de las de este equipo.
                  <span className="block text-xs text-tenue">Márcalo si las horas de este equipo ya incluían armar esas piezas (pasa en las listas que vienen planas de la hoja).</span></span>
              </label>
            )}
          </div>
        )}
      </div>
    </Dialogo>
  );
}

/** Mover líneas elegidas a una sección ("Estructura", "Motriz"…). */
export function DialogoGrupo({ abierto, alCambiar, padre, lineas, grupos, alTerminar }: {
  abierto: boolean; alCambiar: (v: boolean) => void; padre: string; lineas: LineaArbol[]; grupos: string[]; alTerminar: () => void;
}) {
  const qc = useQueryClient();
  const [grupo, setGrupo] = useState("");
  useEffect(() => { if (abierto) setGrupo(""); }, [abierto]);
  async function mover(e: FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("bom_lineas").update({ grupo: grupo.trim() || null }).eq("padre_id", padre).in("id", lineas.map((l) => l.linea_id));
    if (error) { toast.error(mensajeError(error)); return; }
    await qc.invalidateQueries({ queryKey: ["costeo"] });
    alTerminar();
    alCambiar(false);
  }
  return (
    <Dialogo abierto={abierto} alCambiar={alCambiar} titulo={`Mover ${lineas.length} ${lineas.length === 1 ? "línea" : "líneas"} a un grupo`}
      descripcion="Los grupos ordenan la lista en secciones. Déjalo vacío para quitarlas de su grupo."
      pie={<><Boton variante="secundario" type="button" onClick={() => alCambiar(false)}>Cancelar</Boton><Boton type="submit" form="mover-grupo">Mover</Boton></>}>
      <form id="mover-grupo" onSubmit={mover}>
        <Campo etiqueta="Grupo">
          <Entrada autoFocus list="grupos-lista" value={grupo} onChange={(e) => setGrupo(e.target.value)} placeholder="Estructura" />
          <datalist id="grupos-lista">{grupos.map((g) => <option key={g} value={g} />)}</datalist>
        </Campo>
      </form>
    </Dialogo>
  );
}

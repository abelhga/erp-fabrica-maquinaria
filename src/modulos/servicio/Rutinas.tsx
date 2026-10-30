import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Copy, ListChecks, Plus, Trash2 } from "lucide-react";
import { Pagina } from "@/components/layout/Shell";
import { Boton } from "@/components/ui/boton";
import { Lateral } from "@/components/ui/dialogo";
import { AreaTexto, Campo, Entrada, Seleccion } from "@/components/ui/campo";
import { Insignia } from "@/components/ui/insignia";
import { TablaDatos, Filtro, type Columna } from "@/components/datos/TablaDatos";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { CLAVE, useServicioEnVivo } from "./datos";
import { usePermisosServicio } from "./componentes/piezas";
import { GLOSARIO } from "@/tutorial/glosario";

type Frecuencia = "diaria" | "semanal" | "mensual" | "trimestral" | "semestral" | "anual";
const FRECUENCIA: Record<Frecuencia, string> = {
  diaria: "Diaria", semanal: "Semanal", mensual: "Mensual", trimestral: "Trimestral", semestral: "Semestral", anual: "Anual",
};

interface Punto { seccion: string | null; texto: string }
interface Rutina {
  id: string; nombre: string; categoria: string | null; frecuencia: Frecuencia | null; recomendaciones: string | null;
  puntos: Punto[]; activa: boolean; num_puntos: number; secciones: number; planes: number;
  maquinas: { id: string; numero: string; nombre: string }[];
}
/** Lo que se edita: cada punto con una llave propia para que React no revuelva los renglones al moverlos. */
interface Borrador { id: string | null; nombre: string; categoria: string; frecuencia: string; recomendaciones: string; activa: boolean;
  puntos: (Punto & { k: number })[]; planes: number }

type Vista = "activas" | "inactivas";

/**
 * Las rutinas de mantenimiento (la lista de puntos que se palomea en cada preventivo). Antes solo
 * se cargaban por la base; Esteban pidió editarlas él, en un solo lugar y no máquina por máquina.
 */
export default function Rutinas() {
  useServicioEnVivo(["rutinas_mantenimiento", "planes_preventivos"]);
  const p = usePermisosServicio(true);
  const [vista, setVista] = useState<Vista>("activas");
  const [abierta, setAbierta] = useState<Borrador | null>(null);
  const lista = useQuery({
    queryKey: [...CLAVE, "rutinas", "todas"],
    queryFn: () => q<Rutina[]>(supabase.from("v_rutinas_mantenimiento").select("*").order("nombre")),
  });
  const filas = (lista.data ?? []).filter((r) => (vista === "activas" ? r.activa : !r.activa));
  const llave = useRef(0);
  const borrador = (r: Rutina | null, copia = false): Borrador => ({
    id: copia ? null : r?.id ?? null, nombre: r ? (copia ? `${r.nombre} (copia)` : r.nombre) : "", categoria: r?.categoria ?? "",
    frecuencia: r?.frecuencia ?? "mensual", recomendaciones: r?.recomendaciones ?? "", activa: copia ? true : r?.activa ?? true,
    puntos: (r?.puntos.length ? r.puntos : [{ seccion: "Seguridad", texto: "" }]).map((x) => ({ ...x, k: llave.current++ })),
    planes: copia ? 0 : r?.planes ?? 0,
  });

  const columnas: Columna<Rutina>[] = [
    { clave: "nombre", titulo: "Rutina", celda: (r) => <div className="min-w-[200px]"><p className="font-medium leading-tight">{r.nombre}</p>
      {r.categoria && <p className="text-xs text-tenue">{r.categoria}</p>}</div> },
    { clave: "frecuencia", titulo: "Frecuencia", valor: (r) => (r.frecuencia ? FRECUENCIA[r.frecuencia] : "Por horas"),
      celda: (r) => (r.frecuencia ? FRECUENCIA[r.frecuencia] : <span className="text-tenue">Por horas</span>) },
    { clave: "num_puntos", titulo: "Puntos", alinear: "der", celda: (r) => <span className="cifra">{r.num_puntos}<span className="block text-[11px] text-tenue">{r.secciones} {r.secciones === 1 ? "sección" : "secciones"}</span></span> },
    { clave: "planes", titulo: "La usan", explica: GLOSARIO.rutinaEnUso, valor: (r) => r.planes, celda: (r) => r.maquinas.length ? (
      <span className="text-sm">{r.maquinas.slice(0, 4).map((m) => m.numero).join(", ")}{r.maquinas.length > 4 && ` y ${r.maquinas.length - 4} más`}</span>
    ) : <span className="text-tenue">Ningún plan</span> },
  ];

  return (
    <Pagina
      titulo="Rutinas de mantenimiento"
      descripcion="La lista de puntos que se palomea en cada preventivo, por tipo de máquina y frecuencia."
      acciones={p.gerencia && <Boton onClick={() => setAbierta(borrador(null))}><Plus className="h-4 w-4" />Nueva rutina</Boton>}
    >
      <TablaDatos filas={filas} columnas={columnas} cargando={lista.isLoading} error={lista.error} claveFila={(r) => r.id}
        alClicFila={(r) => setAbierta(borrador(r))} exportarComo="rutinas" placeholder="Rutina, categoría…"
        filtros={<Filtro<Vista> valor={vista} alCambiar={setVista} opciones={[
          { valor: "activas", texto: "Activas", cuenta: (lista.data ?? []).filter((r) => r.activa).length },
          { valor: "inactivas", texto: "Desactivadas", cuenta: (lista.data ?? []).filter((r) => !r.activa).length },
        ]} />}
        vacio={{ icono: ListChecks, titulo: vista === "activas" ? "Todavía no hay rutinas" : "Ninguna desactivada",
                 texto: vista === "activas" ? "Una rutina es la lista de lo que se revisa en un preventivo (desconectar, soplar rejillas, revisar la tierra…). Hazla una vez y úsala en los planes de todas las máquinas de ese tipo." : undefined,
                 accion: p.gerencia && vista === "activas" ? <Boton onClick={() => setAbierta(borrador(null))}><Plus className="h-4 w-4" />Nueva rutina</Boton> : undefined }} />
      {abierta && <EditorRutina inicial={abierta} soloVer={!p.gerencia} alCerrar={() => setAbierta(null)}
        alDuplicar={() => { const r = (lista.data ?? []).find((x) => x.id === abierta.id); if (r) setAbierta(borrador(r, true)); }}
        nuevaLlave={() => llave.current++} />}
    </Pagina>
  );
}

function EditorRutina({ inicial, soloVer, alCerrar, alDuplicar, nuevaLlave }: {
  inicial: Borrador; soloVer: boolean; alCerrar: () => void; alDuplicar: () => void; nuevaLlave: () => number;
}) {
  const [f, setF] = useState(inicial);
  const textos = useRef<Record<number, HTMLInputElement | null>>({});
  const categorias = useQuery({
    queryKey: [...CLAVE, "categorias"],
    staleTime: 5 * 60_000,
    queryFn: async () => [...new Set((await q<{ categoria: string }[]>(supabase.from("maquinas").select("categoria"))).map((x) => x.categoria))].sort(),
  });
  const secciones = useMemo(() => [...new Set(f.puntos.map((x) => x.seccion?.trim()).filter(Boolean) as string[])], [f.puntos]);
  const set = <K extends keyof Borrador>(k: K, v: Borrador[K]) => setF((x) => ({ ...x, [k]: v }));
  const cambiarPunto = (k: number, cambio: Partial<Punto>) => setF((x) => ({ ...x, puntos: x.puntos.map((y) => (y.k === k ? { ...y, ...cambio } : y)) }));
  const agregarDespues = (i: number) => {
    const k = nuevaLlave();
    setF((x) => { const p = [...x.puntos]; p.splice(i + 1, 0, { seccion: x.puntos[i]?.seccion ?? null, texto: "", k }); return { ...x, puntos: p }; });
    setTimeout(() => textos.current[k]?.focus(), 0);
  };
  const mover = (i: number, d: -1 | 1) => setF((x) => {
    const p = [...x.puntos]; const j = i + d; if (j < 0 || j >= p.length) return x;
    [p[i], p[j]] = [p[j], p[i]]; return { ...x, puntos: p };
  });
  const quitar = (k: number) => setF((x) => ({ ...x, puntos: x.puntos.filter((y) => y.k !== k) }));
  const guardar = useAccion(() => q<{ id: string; puntos: number; ordenes_actualizadas: number }>(supabase.rpc("guardar_rutina", {
    p_id: f.id, p_nombre: f.nombre, p_categoria: f.categoria || null, p_frecuencia: f.frecuencia || null,
    p_recomendaciones: f.recomendaciones || null, p_puntos: f.puntos.map(({ seccion, texto }) => ({ seccion, texto })), p_activa: f.activa,
  })), {
    exito: (r) => `Rutina guardada con ${r.puntos} puntos${r.ordenes_actualizadas ? ` · ${r.ordenes_actualizadas} ${r.ordenes_actualizadas === 1 ? "preventivo abierto tomó" : "preventivos abiertos tomaron"} la lista nueva` : ""}`,
    invalidar: [CLAVE], alTerminar: alCerrar,
  });
  const llenos = f.puntos.filter((x) => x.texto.trim()).length;
  const listo = f.nombre.trim().length >= 3 && llenos > 0;

  return (
    <Lateral abierto alCambiar={(v) => !v && alCerrar()} ancho="max-w-3xl"
      titulo={soloVer ? f.nombre : f.id ? "Editar rutina" : "Nueva rutina"}
      subtitulo={f.planes ? `La usan ${f.planes} ${f.planes === 1 ? "plan preventivo" : "planes preventivos"}` : "Ningún plan la usa todavía"}
      acciones={!soloVer && f.id && <Boton variante="secundario" tamano="sm" onClick={alDuplicar}><Copy className="h-3.5 w-3.5" />Duplicar</Boton>}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (listo && !soloVer) guardar.mutate(); }}>
        <fieldset disabled={soloVer} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Campo etiqueta="Nombre" className="sm:col-span-3"><Entrada value={f.nombre} onChange={(e) => set("nombre", e.target.value)} placeholder="Inversoras AXT · mensual" autoFocus={!soloVer} /></Campo>
            <Campo etiqueta="Tipo de máquina" ayuda="Para encontrarla al armar el plan." className="sm:col-span-2">
              <Entrada list="rutina-categorias" value={f.categoria} onChange={(e) => set("categoria", e.target.value)} placeholder="inversoras axt" />
              <datalist id="rutina-categorias">{(categorias.data ?? []).map((c) => <option key={c} value={c} />)}</datalist>
            </Campo>
            <Campo etiqueta="Frecuencia">
              <Seleccion value={f.frecuencia} onChange={(e) => set("frecuencia", e.target.value)}>
                {Object.entries(FRECUENCIA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                <option value="">Por horas de uso</option>
              </Seleccion>
            </Campo>
          </div>
          <Campo etiqueta="Recomendaciones" ayuda="Lo que hay que saber antes de empezar; sale arriba del checklist.">
            <AreaTexto rows={2} value={f.recomendaciones} onChange={(e) => set("recomendaciones", e.target.value)} placeholder="Con el equipo desenergizado y bloqueado…" />
          </Campo>

          <div>
            <div className="flex items-baseline justify-between gap-2 mb-2">
              <p className="text-sm font-medium">Puntos que se revisan <span className="text-tenue font-normal">· {llenos}</span></p>
              {!soloVer && <p className="text-xs text-tenue">Enter agrega otro debajo</p>}
            </div>
            <datalist id="rutina-secciones">{secciones.map((s) => <option key={s} value={s} />)}</datalist>
            <ol className="space-y-1.5">
              {f.puntos.map((x, i) => (
                <li key={x.k} className="grid grid-cols-[minmax(0,10rem)_1fr_auto] gap-1.5 items-center">
                  <Entrada list="rutina-secciones" value={x.seccion ?? ""} onChange={(e) => cambiarPunto(x.k, { seccion: e.target.value || null })}
                    placeholder="Sección" aria-label={`Sección del punto ${i + 1}`} className="text-xs" />
                  <Entrada ref={(el) => { textos.current[x.k] = el; }} value={x.texto} onChange={(e) => cambiarPunto(x.k, { texto: e.target.value })}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); agregarDespues(i); } }}
                    placeholder="Qué se revisa o se hace" aria-label={`Punto ${i + 1}`} />
                  {!soloVer && (
                    <div className="flex">
                      <button type="button" onClick={() => mover(i, -1)} disabled={i === 0} className="p-1.5 rounded text-tenue hover:bg-fondo disabled:opacity-30" aria-label="Subir"><ArrowUp className="h-4 w-4" /></button>
                      <button type="button" onClick={() => mover(i, 1)} disabled={i === f.puntos.length - 1} className="p-1.5 rounded text-tenue hover:bg-fondo disabled:opacity-30" aria-label="Bajar"><ArrowDown className="h-4 w-4" /></button>
                      <button type="button" onClick={() => quitar(x.k)} className="p-1.5 rounded text-tenue hover:bg-fondo hover:text-peligro" aria-label="Quitar"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  )}
                </li>
              ))}
            </ol>
            {!soloVer && <Boton type="button" variante="secundario" tamano="sm" className="mt-2" onClick={() => agregarDespues(f.puntos.length - 1)}><Plus className="h-3.5 w-3.5" />Agregar punto</Boton>}
          </div>

          {f.id && !soloVer && (
            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={f.activa} onChange={(e) => set("activa", e.target.checked)} className="accent-[hsl(var(--marca))] mt-0.5" />
              <span>Activa<span className="block text-xs text-tenue">Desactivada ya no sale para elegir en los planes. Solo se puede si ningún plan la usa.</span></span>
            </label>
          )}
        </fieldset>

        {!soloVer && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-borde pt-4">
            <p className="text-xs text-tenue max-w-md" data-explain={GLOSARIO.rutinaMantenimiento}>
              Al guardar, los preventivos que ya salieron con esta rutina y nadie ha empezado toman la lista nueva; los que ya se están palomeando se quedan como estaban.
            </p>
            <div className="flex gap-2">
              <Boton type="button" variante="secundario" onClick={alCerrar}>Cancelar</Boton>
              <Boton type="submit" disabled={!listo} cargando={guardar.isPending}>Guardar</Boton>
            </div>
          </div>
        )}
        {soloVer && (
          <div className="flex flex-wrap items-center gap-3 text-sm text-tenue">
            <Insignia tono={f.activa ? "ok" : "neutro"}>{f.activa ? "Activa" : "Desactivada"}</Insignia>
            <span>Las edita el encargado de mantenimiento.</span>
            {f.planes > 0 && <Link to="/servicio/maquinas?pestana=preventivos" className="text-marca-texto">Ver los preventivos</Link>}
          </div>
        )}
      </form>
    </Lateral>
  );
}

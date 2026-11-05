import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BadgeDollarSign, Pencil, Trash2, UserPlus } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { Insignia } from "@/components/ui/insignia";
import { Dialogo } from "@/components/ui/dialogo";
import { Campo, Entrada, Seleccion } from "@/components/ui/campo";
import { Tarjeta, EncabezadoTarjeta } from "@/components/ui/tarjeta";
import { TablaDatos, type Columna } from "@/components/datos/TablaDatos";
import { useSesion } from "@/lib/sesion";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { dinero, hoyISO } from "@/lib/formato";
import { nombreMes } from "./objetivos";
import { GLOSARIO } from "@/tutorial/glosario";

/**
 * Cuánto vale el bono de objetivos al 100 %: por puesto y, si hace falta, por persona.
 *
 * Cada base vale desde un mes (siempre el día 1) y sigue hasta que otra la reemplaza; por eso se
 * enseña la que le toca al mes elegido arriba, no «la última». La de una persona gana sobre la de su
 * puesto (bono_base en la base hace lo mismo). Lo ya pagado no cambia: la nómina guardó su base.
 */

interface Base {
  id: string; puesto_id: number | null; empleado_id: string | null; base_mensual: number | null; desde: string; nota: string | null;
  empleado: { nombre: string } | null; puesto: { nombre: string } | null;
}
interface PuestoBase { id: number; nombre: string; activo: boolean }
interface Destino { tipo: "puesto"; id: number; nombre: string }
type Objetivo = Destino | { tipo: "persona"; id: string | null; nombre: string | null };

/** La base que le toca a un mes: la más reciente con «desde» en o antes de ese mes. */
function vigente(bases: Base[], mes: string) {
  return bases.filter((b) => b.desde.slice(0, 7) <= mes).sort((a, b) => b.desde.localeCompare(a.desde))[0] ?? null;
}

export function BasesBono({ mes, puestos }: { mes: string; puestos: PuestoBase[] }) {
  const { puede } = useSesion();
  const editar = puede("nomina", 3);
  const bases = useQuery({
    queryKey: ["objetivos", "bases-bono"],
    queryFn: () => q<Base[]>(supabase.from("bono_bases")
      .select("id, puesto_id, empleado_id, base_mensual, desde, nota, empleado:empleados(nombre), puesto:puestos(nombre)").order("desde", { ascending: false }).returns<Base[]>()),
  });
  const asignaciones = useQuery({
    queryKey: ["objetivos", "asignaciones", "vigentes"],
    queryFn: () => q<{ empleado_id: string; puesto_id: number; desde: string; hasta: string | null }[]>(
      supabase.from("puesto_asignaciones").select("empleado_id, puesto_id, desde, hasta")),
  });
  const [abierto, setAbierto] = useState<Objetivo | null>(null);

  const hoy = hoyISO();
  const vigentes = (asignaciones.data ?? []).filter((a) => a.desde <= hoy && (!a.hasta || a.hasta >= hoy));
  const puestoDe = new Map(vigentes.map((a) => [a.empleado_id, a.puesto_id]));
  const todas = bases.data ?? [];

  const filasPuesto = useMemo(() => puestos
    .filter((p) => p.activo || todas.some((b) => b.puesto_id === p.id))
    .map((p) => {
      const suyas = todas.filter((b) => b.puesto_id === p.id && !b.empleado_id);
      const v = vigente(suyas, mes);
      const despues = suyas.filter((b) => b.desde.slice(0, 7) > mes).sort((a, b) => a.desde.localeCompare(b.desde))[0] ?? null;
      return { ...p, personas: vigentes.filter((a) => a.puesto_id === p.id).length, base: v, despues };
    })
    .sort((a, b) => b.personas - a.personas || a.nombre.localeCompare(b.nombre)), [puestos, todas, vigentes, mes]);

  // Una fila por persona con base propia: la que le toca al mes (o la próxima, si aún no empieza).
  const filasPersona = useMemo(() => {
    const porPersona = new Map<string, Base[]>();
    todas.filter((b) => b.empleado_id).forEach((b) => porPersona.set(b.empleado_id!, [...(porPersona.get(b.empleado_id!) ?? []), b]));
    return [...porPersona.entries()].map(([id, suyas]) => {
      const v = vigente(suyas, mes);
      const despues = suyas.filter((b) => b.desde.slice(0, 7) > mes).sort((a, b) => a.desde.localeCompare(b.desde))[0] ?? null;
      const pid = puestoDe.get(id);
      const delPuesto = pid ? filasPuesto.find((p) => p.id === pid) : undefined;
      return { id, nombre: suyas[0].empleado?.nombre ?? "—", puesto: delPuesto?.nombre ?? null, basePuesto: delPuesto?.base?.base_mensual ?? null, base: v, despues };
    }).sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [todas, mes, puestoDe, filasPuesto]);

  const sinBase = filasPuesto.filter((p) => p.personas > 0 && p.base?.base_mensual == null).length;
  // «Sin definir» solo es aviso si alguien tiene ese puesto: un puesto vacío no deja a nadie sin bono.
  const celdaBase = (b: Base | null, conGente = true) => b?.base_mensual != null
    ? <span className="cifra font-medium">{dinero(b.base_mensual)}</span>
    : <span className={conGente ? "text-aviso" : "text-tenue"}>Sin definir</span>;
  const celdaDesde = (b: Base | null, despues: Base | null) => (
    <span className="text-sm">
      {b ? nombreMes(b.desde.slice(0, 7)) : <span className="text-tenue">—</span>}
      {despues && <span className="block text-xs text-info">Desde {nombreMes(despues.desde.slice(0, 7))}: {dinero(despues.base_mensual ?? 0)}</span>}
    </span>
  );

  const columnasPuesto: Columna<(typeof filasPuesto)[number]>[] = [
    { clave: "nombre", titulo: "Puesto", celda: (p) => <span className="font-medium">{p.nombre}{!p.activo && <span className="text-xs text-tenue font-normal"> (inactivo)</span>}</span> },
    { clave: "personas", titulo: "Personas", explica: GLOSARIO.personasPuestoBono, alinear: "der", sinBusqueda: true, celda: (p) => <span className="cifra">{p.personas}</span> },
    { clave: "base", titulo: `Base en ${nombreMes(mes)}`, explica: GLOSARIO.baseBono, alinear: "der", sinBusqueda: true, valor: (p) => p.base?.base_mensual ?? -1, celda: (p) => celdaBase(p.base, p.personas > 0) },
    { clave: "desde", titulo: "Vale desde", explica: GLOSARIO.baseBonoDesde, sinBusqueda: true, valor: (p) => p.base?.desde ?? "", celda: (p) => celdaDesde(p.base, p.despues) },
    { clave: "nota", titulo: "Nota", valor: (p) => p.base?.nota ?? "", celda: (p) => <span className="text-sm text-tenue">{p.base?.nota}</span> },
    {
      clave: "acciones", titulo: "", sinBusqueda: true, oculta: !editar,
      celda: (p) => (
        <Boton variante="fantasma" tamano="sm" data-explain={GLOSARIO.botonDefinirBase}
               onClick={(ev) => { ev.stopPropagation(); setAbierto({ tipo: "puesto", id: p.id, nombre: p.nombre }); }}>
          <Pencil className="h-3.5 w-3.5" /> {p.base ? "Cambiar" : "Definir"}
        </Boton>
      ),
    },
  ];
  const columnasPersona: Columna<(typeof filasPersona)[number]>[] = [
    { clave: "nombre", titulo: "Persona", celda: (p) => <span className="font-medium">{p.nombre}</span> },
    { clave: "puesto", titulo: "Puesto", valor: (p) => p.puesto ?? "", celda: (p) => p.puesto ?? <span className="text-tenue">Sin puesto con objetivos</span> },
    { clave: "base", titulo: `Su base en ${nombreMes(mes)}`, explica: GLOSARIO.baseBonoPersona, alinear: "der", sinBusqueda: true, valor: (p) => p.base?.base_mensual ?? -1,
      celda: (p) => p.base ? celdaBase(p.base) : <span className="text-tenue text-sm">Aún no empieza</span> },
    { clave: "puesto_base", titulo: "La de su puesto", alinear: "der", sinBusqueda: true, valor: (p) => p.basePuesto ?? -1,
      celda: (p) => p.basePuesto != null ? <span className="cifra text-tenue">{dinero(p.basePuesto)}</span> : <span className="text-tenue">—</span> },
    { clave: "desde", titulo: "Vale desde", explica: GLOSARIO.baseBonoDesde, sinBusqueda: true, valor: (p) => p.base?.desde ?? "", celda: (p) => celdaDesde(p.base, p.despues) },
    {
      clave: "acciones", titulo: "", sinBusqueda: true, oculta: !editar,
      celda: (p) => (
        <Boton variante="fantasma" tamano="sm" data-explain={GLOSARIO.botonDefinirBase}
               onClick={(ev) => { ev.stopPropagation(); setAbierto({ tipo: "persona", id: p.id, nombre: p.nombre }); }}>
          <Pencil className="h-3.5 w-3.5" /> Cambiar
        </Boton>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <p className="text-sm text-tenue max-w-3xl">
        Cuánto vale el bono al 100 %. Cada persona cobra el % que sacó en el mes por la base de su puesto; si tiene una base propia, se usa la suya.
        Una base vale desde el mes que elijas y para los siguientes, hasta que la cambies. Lo que ya se pagó no cambia.
        {sinBase > 0 && <b className="text-aviso"> {sinBase === 1 ? "1 puesto con gente no tiene" : `${sinBase} puestos con gente no tienen`} base en {nombreMes(mes)}.</b>}
      </p>
      <Tarjeta>
        <EncabezadoTarjeta titulo="Por puesto" explica={GLOSARIO.baseBono}
          descripcion="La base de todos los que tienen ese puesto." />
        <div className="px-5 pb-4">
          <TablaDatos filas={bases.isLoading ? undefined : filasPuesto} columnas={columnasPuesto} cargando={bases.isLoading || asignaciones.isLoading}
            error={bases.error ?? asignaciones.error} claveFila={(p) => String(p.id)} exportarComo="bases-del-bono" placeholder="Buscar puesto…"
            vacio={{ icono: BadgeDollarSign, titulo: "No hay puestos", texto: "Da de alta los puestos en «Plantillas por puesto» y aquí les pones su base." }} />
        </div>
      </Tarjeta>
      <Tarjeta>
        <EncabezadoTarjeta titulo="Por persona" explica={GLOSARIO.baseBonoPersona}
          descripcion="Solo para quien gana un bono distinto al de su puesto."
          acciones={editar && (
            <Boton tamano="sm" variante="secundario" data-explain={GLOSARIO.botonBasePersona}
                   onClick={() => setAbierto({ tipo: "persona", id: null, nombre: null })}>
              <UserPlus className="h-4 w-4" /> Base para una persona
            </Boton>
          )} />
        <div className="px-5 pb-4">
          <TablaDatos filas={bases.isLoading ? undefined : filasPersona} columnas={columnasPersona} cargando={bases.isLoading} claveFila={(p) => p.id}
            exportarComo="bases-del-bono-personas" placeholder="Buscar persona…"
            vacio={{ icono: UserPlus, titulo: "Todos cobran la base de su puesto", texto: editar ? "Si alguien debe ganar distinto, dale «Base para una persona»." : "Nadie tiene una base propia." }} />
        </div>
      </Tarjeta>
      {abierto && <DialogoBase objetivo={abierto} mes={mes} bases={todas} alCerrar={() => setAbierto(null)} />}
    </div>
  );
}

function DialogoBase({ objetivo, mes, bases, alCerrar }: { objetivo: Objetivo; mes: string; bases: Base[]; alCerrar: () => void }) {
  const [empleado, setEmpleado] = useState<string>(objetivo.tipo === "persona" ? objetivo.id ?? "" : "");
  const personas = useQuery({
    queryKey: ["objetivos", "personas-con-puesto"],
    enabled: objetivo.tipo === "persona" && !objetivo.id,
    queryFn: () => q<{ empleado_id: string; empleado: { nombre: string; activo: boolean } | null; puesto: { nombre: string } | null; hasta: string | null }[]>(
      supabase.from("puesto_asignaciones").select("empleado_id, hasta, empleado:empleados(nombre, activo), puesto:puestos(nombre)")
        .returns<{ empleado_id: string; empleado: { nombre: string; activo: boolean } | null; puesto: { nombre: string } | null; hasta: string | null }[]>()),
  });
  const historial = bases
    .filter((b) => objetivo.tipo === "puesto" ? b.puesto_id === objetivo.id && !b.empleado_id : b.empleado_id === empleado)
    .sort((a, b) => b.desde.localeCompare(a.desde));
  const actual = vigente(historial, mes);
  const [f, setF] = useState({ base: actual?.base_mensual != null ? String(actual.base_mensual) : "", desde: mes, nota: "" });
  const base = Number(f.base);
  const valido = f.base.trim() !== "" && Number.isFinite(base) && base >= 0 && /^\d{4}-\d{2}$/.test(f.desde) && (objetivo.tipo === "puesto" || !!empleado);
  const repetida = historial.find((b) => b.desde.slice(0, 7) === f.desde);

  const guardar = useAccion(() => q(supabase.rpc("fijar_bono_base", {
    p_puesto: objetivo.tipo === "puesto" ? objetivo.id : null, p_empleado: objetivo.tipo === "persona" ? empleado : null,
    p_base: base, p_desde: `${f.desde}-01`, p_nota: f.nota || null,
  })), { exito: "Base del bono guardada", invalidar: [["objetivos"], ["nomina"]], alTerminar: alCerrar });
  // Quitar es de un toque dentro del historial: el aviso trae «Deshacer», que la vuelve a guardar igual.
  const quitar = useAccion((b: Base) => q(supabase.from("bono_bases").delete().eq("id", b.id)), {
    exito: "Base quitada", invalidar: [["objetivos"], ["nomina"]],
    deshacer: (_r, b) => q(supabase.rpc("fijar_bono_base", {
      p_puesto: b.empleado_id ? null : b.puesto_id, p_empleado: b.empleado_id, p_base: b.base_mensual ?? 0, p_desde: b.desde, p_nota: b.nota,
    })),
  });

  const vistas = new Set<string>();
  const opciones = (personas.data ?? [])
    .filter((a) => a.empleado?.activo && (!a.hasta || a.hasta >= hoyISO()) && !vistas.has(a.empleado_id) && vistas.add(a.empleado_id))
    .sort((a, b) => (a.empleado?.nombre ?? "").localeCompare(b.empleado?.nombre ?? ""));
  const titulo = objetivo.tipo === "puesto" ? `Base del bono · ${objetivo.nombre}` : objetivo.nombre ? `Base propia · ${objetivo.nombre}` : "Base propia para una persona";

  return (
    <Dialogo abierto alCambiar={(v) => !v && alCerrar()} titulo={titulo}
      descripcion="Lo que cobra al 100 % de sus objetivos en un mes. Con 85 % cobra el 85 % de esto."
      pie={<><Boton variante="secundario" onClick={alCerrar}>Cancelar</Boton><Boton cargando={guardar.isPending} disabled={!valido} onClick={() => guardar.mutate(undefined)}>Guardar</Boton></>}>
      <form className="space-y-3" onSubmit={(ev) => { ev.preventDefault(); if (valido) guardar.mutate(undefined); }}>
        {objetivo.tipo === "persona" && !objetivo.id && (
          <Campo etiqueta="Persona" ayuda="Solo salen quienes tienen puesto con objetivos.">
            <Seleccion autoFocus value={empleado} onChange={(e) => setEmpleado(e.target.value)}>
              <option value="">Elige…</option>
              {opciones.map((a) => <option key={a.empleado_id} value={a.empleado_id}>{a.empleado?.nombre} · {a.puesto?.nombre}</option>)}
            </Seleccion>
          </Campo>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Base mensual ($)">
            <Entrada autoFocus={objetivo.tipo === "puesto" || !!objetivo.id} type="number" min={0} step="50" inputMode="decimal" className="cifra"
              value={f.base} onChange={(e) => setF({ ...f, base: e.target.value })} placeholder="2000" />
          </Campo>
          <Campo etiqueta="Vale desde" ayuda={repetida ? "Ese mes ya tiene base: se corrige." : "Y los meses siguientes."}>
            <Entrada type="month" value={f.desde} onChange={(e) => setF({ ...f, desde: e.target.value })} />
          </Campo>
        </div>
        <Campo etiqueta="Nota (opcional)">
          <Entrada value={f.nota} onChange={(e) => setF({ ...f, nota: e.target.value })} placeholder="Ej. acordado en junta del 5 nov" />
        </Campo>
        {historial.length > 0 && (
          <div className="rounded-lg border border-borde p-3 text-sm space-y-1.5">
            <p className="text-xs font-medium text-tenue">Historial</p>
            {historial.map((b) => (
              <div key={b.id} className="flex items-center justify-between gap-2">
                <span>
                  Desde {nombreMes(b.desde.slice(0, 7))}: <b className="cifra">{b.base_mensual != null ? dinero(b.base_mensual) : "sin monto"}</b>
                  {b === actual && <Insignia tono="ok" className="ml-2">En {nombreMes(mes)}</Insignia>}
                  {b.nota && <span className="block text-xs text-tenue">{b.nota}</span>}
                </span>
                <Boton type="button" variante="fantasma" tamano="sm" aria-label="Quitar esta base" data-explain={GLOSARIO.botonQuitarBase}
                       cargando={quitar.isPending && quitar.variables?.id === b.id} onClick={() => quitar.mutate(b)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Boton>
              </div>
            ))}
          </div>
        )}
        {/* Con tres campos el navegador no envía con Enter si no hay botón de enviar dentro del formulario. */}
        <button type="submit" hidden />
      </form>
    </Dialogo>
  );
}

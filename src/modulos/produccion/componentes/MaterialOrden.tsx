import { Fragment, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeftRight, Boxes, PackageOpen, Plus, RotateCcw, Search, Trash2, X } from "lucide-react";
import { Tarjeta, EncabezadoTarjeta } from "@/components/ui/tarjeta";
import { Boton } from "@/components/ui/boton";
import { Insignia } from "@/components/ui/insignia";
import { Dialogo } from "@/components/ui/dialogo";
import { Campo, Entrada } from "@/components/ui/campo";
import { Cargando, ErrorCarga, Vacio } from "@/components/ui/estados";
import { Filtro } from "@/components/datos/TablaDatos";
import { BuscadorArticulo, type ArticuloEncontrado } from "@/components/datos/BuscadorArticulo";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { cn, coincide } from "@/lib/utilidades";
import { unoDe, usePreferencia } from "@/lib/preferencias";
import { CLAVE, consulta, usePersonalPiso, type MaterialOP } from "./datos";
import { cifra, grupoRuta } from "./util";
import { GLOSARIO } from "@/tutorial/glosario";
import { fecha } from "@/lib/formato";
import { DialogoMotivo } from "@/modulos/ventas/componentes/dialogos";

type Vista = "todo" | "falta" | "por_surtir";
type Agrupar = "subensamble" | "categoria";
const SIN_CATEGORIA = "Sin categoría";

/**
 * Agrupar por categoría junta lo eléctrico, lo de aire, la tornillería… (lo pidió el taller). Abre por
 * categoría: en 45 de 53 órdenes todo el material es «Directo al equipo» y por subensamble sale un solo
 * grupo. Lo que cada quien elija se le recuerda (preferencias.ts).
 */
const useAgrupar = () => usePreferencia<Agrupar>("material.agrupar", "categoria", unoDe(["categoria", "subensamble"] as const));

/** Busca por nombre, clave, categoría o nota, sin acentos y con las palabras en cualquier orden. */
const enBusqueda = (m: MaterialOP, buscar: string) => !buscar.trim() || coincide(`${m.nombre} ${m.clave} ${m.categoria ?? ""} ${m.notas ?? ""}`, buscar);

function CajaBuscar({ valor, alCambiar, className }: { valor: string; alCambiar: (v: string) => void; className?: string }) {
  return (
    <label className={cn("relative block", className)}>
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-tenue" />
      <input className="campo h-8 pl-8 pr-7 text-sm" value={valor} onChange={(e) => alCambiar(e.target.value)} placeholder="Buscar material o categoría…"
             aria-label="Buscar en el material" onKeyDown={(e) => { if (e.key === "Escape") alCambiar(""); }} />
      {valor && <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-tenue hover:text-texto" aria-label="Borrar búsqueda" onClick={() => alCambiar("")}><X className="h-3.5 w-3.5" /></button>}
    </label>
  );
}

/**
 * Material de la orden agrupado por subensamble: requerido, apartado, surtido y
 * lo que falta. Lo que falta se resalta (en la hoja salía en blanco). Ingeniería
 * corrige cantidades aquí y queda en la línea de tiempo; almacén surte contra la orden.
 */
export function MaterialOrden({ ordenId, equipo, material, cargando, error, acciones, editable }: {
  ordenId: string; equipo: string; material: MaterialOP[] | undefined; cargando: boolean; error: unknown;
  acciones: React.ReactNode; editable: boolean;
}) {
  const [vista, setVista] = useState<Vista>("todo");
  const [agrupar, setAgrupar] = useAgrupar();
  const [buscar, setBuscar] = useState("");
  const [agregando, setAgregando] = useState(false);
  const [reemplazando, setReemplazando] = useState<MaterialOP | null>(null);
  const [quitando, setQuitando] = useState<MaterialOP | null>(null);
  const lista = material ?? [];
  const vigentes = lista.filter((m) => !m.quitado_en);
  const filtradas = lista.filter((m) => (vista === "todo" || (vista === "falta" ? m.faltante > 0 : m.por_surtir > 0)) && enBusqueda(m, buscar));
  const grupos = useMemo(() => {
    const g = new Map<string, MaterialOP[]>();
    for (const m of filtradas) {
      const k = agrupar === "categoria" ? m.categoria ?? SIN_CATEGORIA : grupoRuta(m.ruta, equipo);
      g.set(k, [...(g.get(k) ?? []), m]);
    }
    for (const filas of g.values()) filas.sort((a, b) => Number(!!a.quitado_en) - Number(!!b.quitado_en));
    // Por subensamble: "Directo al equipo" primero. Por categoría: "Sin categoría" al final. Lo demás, alfabético.
    const primero = agrupar === "categoria" ? null : "Directo al equipo", ultimo = agrupar === "categoria" ? SIN_CATEGORIA : null;
    return [...g.entries()].sort(([a], [b]) => (a === primero || b === ultimo ? -1 : b === primero || a === ultimo ? 1 : a.localeCompare(b, "es")));
  }, [filtradas, equipo, agrupar]);

  const conFaltante = lista.filter((m) => m.faltante > 0).length;
  const porSurtir = lista.filter((m) => m.por_surtir > 0).length;
  const fuera = vigentes.filter((m) => m.agregado).length;
  const quitadas = lista.length - vigentes.length;
  const delTaller = lista.filter((m) => m.del_taller).length;

  const corregir = useAccion((a: { id: string; requerido: number }) =>
    q(supabase.from("op_materiales").update({ requerido: a.requerido }).eq("id", a.id).select("id")), {
    exito: "Cantidad corregida (queda en la línea de tiempo)", invalidar: [CLAVE],
  });
  const quitar = useAccion((a: { id: string; motivo: string }) => q(supabase.rpc("quitar_material_orden", { p_material: a.id, p_motivo: a.motivo })), {
    exito: "Quitado: queda tachado en la lista y en la línea de tiempo", invalidar: [CLAVE], alTerminar: () => setQuitando(null),
  });
  const reponer = useAccion((id: string) => q(supabase.rpc("reponer_material_orden", { p_material: id })), {
    exito: "Se volvió a poner en la lista", invalidar: [CLAVE],
  });

  return (
    <Tarjeta>
      <EncabezadoTarjeta titulo="Material" explica={GLOSARIO.listaMaterialOrden}
        descripcion={<span className="flex flex-wrap gap-x-3 gap-y-1">
          <span>{vigentes.length} partidas</span>
          {conFaltante > 0 ? <span className="text-peligro font-medium" data-explain={GLOSARIO.faltanteMaterial}>{conFaltante} con faltante</span> : lista.length > 0 && <span className="text-ok">Nada falta</span>}
          <span data-explain={GLOSARIO.partidasPorSurtir}>{porSurtir} por surtir</span>
          {fuera > 0 && <span data-explain={GLOSARIO.materialAgregadoOrden}>{fuera} agregadas o fuera de lista</span>}
          {quitadas > 0 && <span data-explain={GLOSARIO.materialQuitado}>{quitadas} {quitadas === 1 ? "quitada o reemplazada" : "quitadas o reemplazadas"}</span>}
          {delTaller > 0 && <span data-explain={GLOSARIO.consumibleTaller}>{delTaller} {delTaller === 1 ? "consumible" : "consumibles"} del taller</span>}
        </span>}
        acciones={<div className="flex flex-wrap justify-end gap-2">
          {acciones}
          {editable && <Boton tamano="sm" variante="secundario" onClick={() => setAgregando(true)}
            data-explain={GLOSARIO.botonAgregarMaterialOrden} data-explain-title="Agregar material"><Plus className="h-3.5 w-3.5" />Agregar material</Boton>}
        </div>} />
      <div className="px-5 pb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <Filtro<Vista> valor={vista} alCambiar={setVista} opciones={[
          { valor: "todo", texto: "Todo", cuenta: lista.length },
          { valor: "falta", texto: "Lo que falta", cuenta: conFaltante, explica: GLOSARIO.faltanteMaterial },
          { valor: "por_surtir", texto: "Por surtir", cuenta: porSurtir, explica: GLOSARIO.partidasPorSurtir },
        ]} />
        <span className="flex items-center gap-2 text-xs text-tenue" data-explain={GLOSARIO.agruparMaterial} data-explain-title="Agrupar por">
          Agrupar por
          <Filtro<Agrupar> valor={agrupar} alCambiar={setAgrupar} opciones={[
            { valor: "categoria", texto: "Categoría" }, { valor: "subensamble", texto: "Subensamble" },
          ]} />
        </span>
        {lista.length > 0 && <CajaBuscar valor={buscar} alCambiar={setBuscar} className="w-full sm:w-64 sm:ml-auto" />}
      </div>
      {error ? <ErrorCarga error={error} /> : cargando ? <Cargando filas={6} /> : filtradas.length === 0 ? (
        buscar.trim() && lista.length > 0 ? <Vacio icono={Search} titulo={`Nada coincide con «${buscar.trim()}»`} texto="Busca por nombre, clave o categoría (por ejemplo «eléctricos» o «aire»)." /> :
        <Vacio icono={Boxes} titulo={vista === "todo" ? "La orden no tiene material" : vista === "falta" ? "No falta nada" : "Todo está surtido"}
               texto={vista === "todo" ? "Ingeniería puede agregar el material que lleva." : undefined} />
      ) : (
        <div className="overflow-x-auto">
          <table className="tabla">
            <thead>
              <tr>
                <th>Material</th>
                <th className="text-right" data-explain={GLOSARIO.requeridoOrden} data-explain-title="Requerido"><span>Requerido</span></th>
                <th className="text-right" data-explain={GLOSARIO.apartadoOrden} data-explain-title="Apartado"><span>Apartado</span></th>
                <th className="text-right" data-explain={GLOSARIO.surtidoOrden} data-explain-title="Surtido"><span>Surtido</span></th>
                <th className="text-right" data-explain={GLOSARIO.faltanteMaterial} data-explain-title="Falta"><span>Falta</span></th>
                <th className="text-right" title="Lo que se pidió a compras para esta orden" data-explain={GLOSARIO.pedidoACompras} data-explain-title="Pedido"><span>Pedido</span></th>
                <th className="text-right" title="Existencia en planta menos lo apartado para cualquier orden" data-explain={GLOSARIO.disponiblePlanta} data-explain-title="Disponible"><span>Disponible</span></th>
                {editable && <th className="w-20"><span className="sr-only">Cambiar</span></th>}
              </tr>
            </thead>
            <tbody>
              {grupos.map(([grupo, filas]) => (
                <Fragment key={grupo}>
                  <tr className="hover:bg-transparent">
                    <td colSpan={editable ? 8 : 7} className="bg-fondo/70 text-xs font-semibold text-tenue uppercase tracking-wide py-1.5">
                      {grupo} <span className="font-normal normal-case tracking-normal">· {filas.filter((f) => !f.quitado_en).length}</span>
                    </td>
                  </tr>
                  {filas.map((m) => m.quitado_en ? <FilaQuitada key={m.id} m={m} equipo={equipo} editable={editable}
                      alReponer={() => reponer.mutate(m.id)} reponiendo={reponer.isPending && reponer.variables === m.id} /> : (
                    <tr key={m.id} className={cn(m.faltante > 0 && "bg-peligro-suave/50")}>
                      <td className="min-w-[240px]">
                        <p>{m.nombre}</p>
                        <p className="text-xs text-tenue flex flex-wrap items-center gap-1.5">
                          <span>{m.clave}</span>
                          {agrupar === "categoria" ? <span>· {grupoRuta(m.ruta, equipo)}</span> : m.categoria && <span>· {m.categoria}</span>}
                          {m.reemplaza_a_nombre ? <span data-explain={GLOSARIO.materialQuitado}><Insignia tono="info">Reemplaza a {m.reemplaza_a_nombre}</Insignia></span>
                            : m.agregado && <span className="inline-flex" data-explain={m.requerido === 0 ? GLOSARIO.fueraDeLista : GLOSARIO.materialAgregadoOrden}>
                                <Insignia tono={m.requerido === 0 ? "aviso" : "info"}>{m.requerido === 0 ? "Fuera de lista" : "Agregado"}</Insignia></span>}
                          {m.del_taller && <span data-explain={GLOSARIO.consumibleTaller}><Insignia tono="neutro">Del taller</Insignia></span>}
                          {m.notas && <span className="italic truncate">{m.notas}</span>}
                        </p>
                      </td>
                      <td className="text-right cifra whitespace-nowrap">
                        {editable ? <CantidadEditable m={m} alGuardar={(v) => corregir.mutate({ id: m.id, requerido: v })} />
                          : <>{cifra(m.requerido)} <span className="text-tenue text-xs">{m.unidad}</span></>}
                      </td>
                      <td className="text-right cifra">{m.apartado > 0 ? cifra(m.apartado) : <span className="text-tenue">—</span>}</td>
                      <td className="text-right cifra">{m.surtido > 0 ? cifra(m.surtido) : <span className="text-tenue">—</span>}</td>
                      <td className={cn("text-right cifra", m.faltante > 0 && "text-peligro font-semibold")}>{m.faltante > 0 ? cifra(m.faltante) : <span className="text-tenue">—</span>}</td>
                      <td className="text-right cifra">{m.pedido_a_compras > 0 ? cifra(m.pedido_a_compras) : <span className="text-tenue">—</span>}</td>
                      <td className={cn("text-right cifra", m.disponible_planta <= 0 && "text-tenue")} title={`Existencia en planta: ${cifra(m.existencia_planta)}`}>
                        {cifra(m.disponible_planta)}
                      </td>
                      {editable && (
                        <td className="whitespace-nowrap text-right">
                          <button type="button" className="p-1.5 text-tenue hover:text-marca-texto" title="Reemplazar por otro material" aria-label={`Reemplazar ${m.nombre}`}
                                  data-explain={GLOSARIO.botonReemplazarMaterial} data-explain-title="Reemplazar"
                                  onClick={() => setReemplazando(m)}><ArrowLeftRight className="h-4 w-4" /></button>
                          <button type="button" className="p-1.5 text-tenue hover:text-peligro" title="Quitar de esta orden (queda tachado)" aria-label={`Quitar ${m.nombre}`}
                                  data-explain={GLOSARIO.materialQuitado} data-explain-title="Quitar de esta orden"
                                  onClick={() => setQuitando(m)}><Trash2 className="h-4 w-4" /></button>
                        </td>
                      )}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editable && <DialogoAgregarMaterial abierto={agregando} alCambiar={setAgregando} ordenId={ordenId} existentes={vigentes} />}
      {editable && <DialogoReemplazar m={reemplazando} alCerrar={() => setReemplazando(null)} existentes={vigentes} />}
      {editable && <DialogoMotivo abierto={!!quitando} alCambiar={(v) => !v && setQuitando(null)} titulo={`Quitar ${quitando?.nombre ?? ""} de esta orden`}
        descripcion={<>No se borra: queda tachado en la lista con quién, cuándo y por qué, deja de pedirse y suelta lo apartado.
          {quitando && quitando.surtido > 0 && <span className="block mt-1 text-aviso">Ya se surtieron {cifra(quitando.surtido)} {quitando.unidad}: hay que regresarlos al almacén.</span>}</>}
        etiqueta="¿Por qué se quita?" sugerencias={["El cliente ya no lo quiere", "No lleva esta pieza", "Se usa una que ya había en el taller", "Estaba repetido en la lista"]}
        textoBoton="Quitar" cargando={quitar.isPending} alConfirmar={(motivo) => quitando && quitar.mutate({ id: quitando.id, motivo })} />}
    </Tarjeta>
  );
}

function CantidadEditable({ m, alGuardar }: { m: MaterialOP; alGuardar: (v: number) => void }) {
  const [v, setV] = useState(String(m.requerido));
  useEffect(() => setV(String(m.requerido)), [m.requerido]);
  const guardar = () => {
    const n = Number(v);
    if (v.trim() === "" || Number.isNaN(n) || n < 0) { setV(String(m.requerido)); return; }
    if (n !== Number(m.requerido)) alGuardar(n);
  };
  return (
    <span className="inline-flex items-center gap-1">
      <input className="w-20 h-7 rounded-md border border-transparent hover:border-borde focus:border-marca bg-transparent text-right px-1.5 cifra focus:outline-none focus:ring-2 focus:ring-marca/30"
             value={v} inputMode="decimal" aria-label={`Cantidad requerida de ${m.nombre}`}
             onChange={(e) => setV(e.target.value)} onBlur={guardar}
             onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") { setV(String(m.requerido)); (e.target as HTMLInputElement).blur(); } }} />
      <span className="text-tenue text-xs w-10 text-left truncate">{m.unidad}</span>
    </span>
  );
}

const TIPOS_MATERIAL: ArticuloEncontrado["tipo"][] = ["componente", "materia_prima"];
const TIPOS_CAMBIO: ArticuloEncontrado["tipo"][] = ["componente", "materia_prima", "subensamble"];

/** Un renglón quitado o reemplazado: tachado, con su motivo, para que quede constancia. */
function FilaQuitada({ m, equipo, editable, alReponer, reponiendo }: {
  m: MaterialOP; equipo: string; editable: boolean; alReponer: () => void; reponiendo: boolean;
}) {
  return (
    <tr className="text-tenue">
      <td className="min-w-[240px]">
        <p className="line-through">{m.nombre}</p>
        <p className="text-xs flex flex-wrap items-center gap-1.5">
          <span>{m.clave}</span><span>· {grupoRuta(m.ruta, equipo)}</span>
          <span data-explain={GLOSARIO.materialQuitado}><Insignia tono={m.reemplazado_por ? "info" : "neutro"}>{m.reemplazado_por ? `Reemplazado por ${m.reemplazado_por}` : "Quitado"}</Insignia></span>
        </p>
        <p className="text-xs">{m.motivo_quitado}{m.quitado_por ? ` · ${m.quitado_por}` : ""} · {fecha(m.quitado_en)}
          {m.surtido > 0 && <span className="text-aviso"> · se habían surtido {cifra(m.surtido)}: regresarlos al almacén</span>}</p>
      </td>
      <td className="text-right cifra whitespace-nowrap"><s>{cifra(m.requerido_antes)}</s> <span className="text-xs">{m.unidad}</span></td>
      <td colSpan={5} />
      {editable && (
        <td className="whitespace-nowrap text-right">
          {!m.reemplazado_por && <Boton tamano="sm" variante="fantasma" cargando={reponiendo} onClick={alReponer} title="Volver a ponerlo con la cantidad que llevaba"
            data-explain={GLOSARIO.botonReponerMaterial} data-explain-title="Volver">
            <RotateCcw className="h-3.5 w-3.5" />Volver</Boton>}
        </td>
      )}
    </tr>
  );
}

type QueAgrega = "material" | "fabricar" | "pieza";

function DialogoAgregarMaterial({ abierto, alCambiar, ordenId, existentes }: {
  abierto: boolean; alCambiar: (v: boolean) => void; ordenId: string; existentes: MaterialOP[];
}) {
  const [que, setQue] = useState<QueAgrega>("material");
  const [art, setArt] = useState<ArticuloEncontrado | null>(null);
  const [cantidad, setCantidad] = useState("");
  const [nota, setNota] = useState("");
  const esSub = que !== "material";
  const yaEsta = que === "material" && art && existentes.some((m) => m.articulo_id === art.id);
  const limpiar = () => { setArt(null); setCantidad(""); setNota(""); };
  const agregar = useAccion(async () => {
    if (que === "material") await q(supabase.rpc("agregar_material_orden", { p_op: ordenId, p_articulo: art!.id, p_cantidad: Number(cantidad), p_motivo: nota.trim() || null }));
    else return q<number>(supabase.rpc("agregar_subensamble_orden", { p_op: ordenId, p_subensamble: art!.id, p_cantidad: Number(cantidad), p_motivo: nota.trim() || null, p_como: que }));
    return 1;
  }, { exito: (n) => que === "fabricar" ? `Subensamble agregado: ${n} partida(s) a la lista` : que === "pieza" ? "Subensamble agregado como pieza" : "Material agregado a la orden",
    invalidar: [CLAVE], alTerminar: () => { alCambiar(false); limpiar(); setQue("material"); } });
  const valido = !!art && !yaEsta && Number(cantidad) > 0;
  return (
    <Dialogo abierto={abierto} alCambiar={alCambiar} titulo="Agregar a esta orden"
             descripcion="Solo para esta orden (un extra del pedido, un subensamble más). Si el error es del costeo, pide además el cambio a ingeniería."
             pie={<><Boton variante="secundario" onClick={() => alCambiar(false)}>Cancelar</Boton>
               <Boton form="agregar-material" type="submit" disabled={!valido} cargando={agregar.isPending}>Agregar</Boton></>}>
      <form id="agregar-material" className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (valido) agregar.mutate(undefined); }}>
        <div className="space-y-2" data-explain={GLOSARIO.subensambleEnOrden} data-explain-title="Agregar un subensamble">
          <Filtro<"material" | "sub"> valor={esSub ? "sub" : "material"} alCambiar={(v) => { setQue(v === "sub" ? "fabricar" : "material"); setArt(null); }} opciones={[
            { valor: "material", texto: "Componente o materia prima" }, { valor: "sub", texto: "Subensamble" },
          ]} />
          {esSub && (
            <div className="flex flex-col gap-1 text-sm">
              <label className="flex items-center gap-2"><input type="radio" checked={que === "fabricar"} onChange={() => setQue("fabricar")} />
                Se fabrica aquí <span className="text-tenue">(entran sus componentes a la lista)</span></label>
              <label className="flex items-center gap-2"><input type="radio" checked={que === "pieza"} onChange={() => setQue("pieza")} />
                Ya está hecho <span className="text-tenue">(sale del almacén como una pieza)</span></label>
            </div>
          )}
        </div>
        <Campo etiqueta={esSub ? "Subensamble" : "Material"} error={yaEsta ? "Ya está en la lista: corrige su cantidad en la tabla." : undefined}>
          {art ? (
            <div className="campo h-auto py-2 flex items-start justify-between gap-2">
              <span className="text-sm"><span className="text-tenue">{art.clave}</span> · {art.nombre}</span>
              <button type="button" onClick={() => setArt(null)} className="text-tenue hover:text-texto" aria-label="Quitar"><X className="h-4 w-4" /></button>
            </div>
          ) : <BuscadorArticulo key={que === "material" ? "m" : "s"} alElegir={setArt} tipos={esSub ? ["subensamble"] : TIPOS_MATERIAL} mostrarPrecio={false} autoFocus
               placeholder={esSub ? "Buscar subensamble…" : "Buscar componente o materia prima…"} />}
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta={`Cantidad${art ? ` (${art.unidad})` : ""}`}>
            <Entrada type="number" min="0" step="any" inputMode="decimal" value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
          </Campo>
          <Campo etiqueta="Motivo">
            <Entrada value={nota} onChange={(e) => setNota(e.target.value)} placeholder={esSub ? "El cliente pidió tensor doble" : "Lleva juego extra de cribas"} />
          </Campo>
        </div>
      </form>
    </Dialogo>
  );
}

/** Cambia un material por otro: el de antes queda tachado con «Reemplazado por…» y el motivo. */
function DialogoReemplazar({ m, alCerrar, existentes }: { m: MaterialOP | null; alCerrar: () => void; existentes: MaterialOP[] }) {
  const [art, setArt] = useState<ArticuloEncontrado | null>(null);
  const [cantidad, setCantidad] = useState("");
  const [motivo, setMotivo] = useState("");
  useEffect(() => { if (m) { setArt(null); setCantidad(String(m.requerido)); setMotivo(""); } }, [m]);
  const reemplazar = useAccion(() => q(supabase.rpc("reemplazar_material_orden", {
    p_material: m!.id, p_articulo: art!.id, p_cantidad: Number(cantidad), p_motivo: motivo.trim(),
  })), { exito: "Reemplazado: el anterior queda tachado en la lista", invalidar: [CLAVE], alTerminar: alCerrar });
  const yaEsta = art && existentes.find((x) => x.articulo_id === art.id);
  const valido = !!art && art.id !== m?.articulo_id && Number(cantidad) > 0 && motivo.trim().length >= 3;
  return (
    <Dialogo abierto={!!m} alCambiar={(v) => !v && alCerrar()} titulo={`Reemplazar ${m?.nombre ?? ""}`}
             descripcion="El de ahora queda tachado con «Reemplazado por…», quién y por qué; el nuevo entra con su cantidad y suelta lo apartado del anterior."
             pie={<><Boton variante="secundario" onClick={alCerrar}>Cancelar</Boton>
               <Boton form="reemplazar-material" type="submit" disabled={!valido} cargando={reemplazar.isPending}><ArrowLeftRight className="h-4 w-4" />Reemplazar</Boton></>}>
      <form id="reemplazar-material" className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (valido) reemplazar.mutate(undefined); }}>
        {m && m.surtido > 0 && <p className="text-sm text-aviso">Del actual ya se surtieron {cifra(m.surtido)} {m.unidad}: hay que regresarlos al almacén.</p>}
        <Campo etiqueta="Por cuál" ayuda={yaEsta ? `Ya está en la lista con ${cifra(yaEsta.requerido)}: se le suma esta cantidad.` : undefined}>
          {art ? (
            <div className="campo h-auto py-2 flex items-start justify-between gap-2">
              <span className="text-sm"><span className="text-tenue">{art.clave}</span> · {art.nombre}</span>
              <button type="button" onClick={() => setArt(null)} className="text-tenue hover:text-texto" aria-label="Quitar"><X className="h-4 w-4" /></button>
            </div>
          ) : <BuscadorArticulo alElegir={setArt} tipos={TIPOS_CAMBIO} mostrarPrecio={false} autoFocus placeholder="Buscar el material nuevo…" />}
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta={`Cantidad${art ? ` (${art.unidad})` : ""}`}>
            <Entrada type="number" min="0" step="any" inputMode="decimal" value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
          </Campo>
          <Campo etiqueta="¿Por qué? *">
            <Entrada value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="La de la lista no trae cuñero" />
          </Campo>
        </div>
      </form>
    </Dialogo>
  );
}

// ---------------------------------------------------------------------------
// Surtir
// ---------------------------------------------------------------------------
interface Existencia { articulo_id: string; almacen_id: number; cantidad: number; almacen: { nombre: string; disponible_para_planta: boolean } }
interface Extra { art: ArticuloEncontrado; cantidad: string; almacen: string; motivo: string }

/**
 * Salida de almacén contra la orden. Propone lo apartado y el almacén con más
 * existencia; lo que no está en la lista se agrega con su motivo. La base
 * rechaza llevarse lo apartado para otra orden.
 */
export function DialogoSurtir({ abierto, alCambiar, ordenId, folio, material, creadaEn }: {
  abierto: boolean; alCambiar: (v: boolean) => void; ordenId: string; folio: string; material: MaterialOP[];
  /** Cuándo se creó la orden: las de antes del corte pueden registrar lo que ya se entregó con la hoja. */
  creadaEn?: string;
}) {
  // A quién se le entrega: la gente de piso, como en la terminal (o un nombre escrito).
  const personal = usePersonalPiso();
  const [recibe, setRecibe] = useState("");
  // Lo que ya salió con la hoja de salidas no se descuenta otra vez: el inventario del ERP ya venía sin eso.
  const corte = useQuery({
    queryKey: ["configuracion", "surtido_antes_del_erp"], staleTime: 10 * 60_000, enabled: abierto,
    queryFn: async () => (await q<{ valor: string }[]>(supabase.from("configuracion").select("valor").eq("clave", "surtido_antes_del_erp")))[0]?.valor ?? null,
  });
  const puedePrevio = !!corte.data && !!creadaEn && creadaEn.slice(0, 10) <= String(corte.data);
  const [previo, setPrevio] = useState(false);
  // Por categoría (lo eléctrico junto, lo de aire junto…) y dentro, lo apartado primero.
  const pendientes = useMemo(() => material.filter((m) => m.por_surtir > 0)
    .sort((a, b) => Number(!a.categoria) - Number(!b.categoria) || (a.categoria ?? "").localeCompare(b.categoria ?? "", "es")
      || Number(b.apartado > 0) - Number(a.apartado > 0) || a.nombre.localeCompare(b.nombre, "es")), [material]);
  const [buscar, setBuscar] = useState("");
  const visibles = pendientes.filter((m) => enBusqueda(m, buscar));
  const [extras, setExtras] = useState<Extra[]>([]);
  // Con el switch de almacén, lo de las categorías consumibles sale al taller a nombre de quien recibe.
  const idsExtras = extras.map((x) => x.art.id);
  const consumibles = useQuery({
    queryKey: [...CLAVE, "consumibles_taller", idsExtras],
    enabled: abierto && idsExtras.length > 0,
    queryFn: async () => {
      const r = await Promise.all(idsExtras.map((id) => q<boolean>(supabase.rpc("es_consumible_taller", { p_articulo: id })).then((v) => [id, v] as const)));
      return new Set(r.filter(([, v]) => v).map(([id]) => id));
    },
  });
  const esDelTaller = (id: string) => consumibles.data?.has(id) ?? false;
  const ids = useMemo(() => [...new Set([...pendientes.map((m) => m.articulo_id), ...extras.map((x) => x.art.id)])], [pendientes, extras]);
  const existencias = useQuery({
    queryKey: [...CLAVE, "existencias_surtir", ordenId, ids],
    enabled: abierto && ids.length > 0,
    // En tandas: un Zeus 30 trae 185 partidas y la lista de ids no cabe en una sola URL.
    queryFn: async () => {
      const tandas = Array.from({ length: Math.ceil(ids.length / 60) }, (_, i) => ids.slice(i * 60, i * 60 + 60));
      const r = await Promise.all(tandas.map((t) => consulta<Existencia[]>(supabase.from("existencias")
        .select("articulo_id, almacen_id, cantidad, almacen:almacenes(nombre, disponible_para_planta)").in("articulo_id", t).gt("cantidad", 0))));
      return r.flat();
    },
  });
  const porArticulo = useMemo(() => {
    const m = new Map<string, Existencia[]>();
    for (const e of existencias.data ?? []) {
      if (!e.almacen?.disponible_para_planta) continue;
      m.set(e.articulo_id, [...(m.get(e.articulo_id) ?? []), e].sort((a, b) => b.cantidad - a.cantidad));
    }
    return m;
  }, [existencias.data]);

  const [cant, setCant] = useState<Record<string, string>>({});
  const [alm, setAlm] = useState<Record<string, string>>({});
  // Al abrir, todo vacío: en la demostración se surtió todo lo apartado por no ver que ya venía
  // escrito. Se llena a propósito: tocando el número de «Por surtir» o de «Apartado», o con los botones.
  useEffect(() => {
    if (!abierto) return;
    setCant({});
    setExtras([]);
    setPrevio(false);
    setRecibe("");
    setBuscar("");
  }, [abierto]); // eslint-disable-line react-hooks/exhaustive-deps
  const cambiarPrevio = (v: boolean) => {
    setPrevio(v);
    setCant({});
    if (v) setExtras([]);
  };
  const llenar = (m: MaterialOP, n: number) => setCant((c) => ({ ...c, [m.articulo_id]: String(n) }));
  const llenarTodos = (de: (m: MaterialOP) => number) =>
    setCant(Object.fromEntries(pendientes.map((m) => [m.articulo_id, de(m) > 0 ? String(de(m)) : ""])));
  // De una partida de la lista no sale más de lo que falta (la base lo rechaza igual): se avisa antes.
  const excede = (m: MaterialOP) => Number(cant[m.articulo_id]) > m.por_surtir + 0.0005;
  useEffect(() => {
    setAlm((a) => {
      const n = { ...a };
      for (const [id, lista] of porArticulo) if (!n[id] && lista[0]) n[id] = String(lista[0].almacen_id);
      return n;
    });
  }, [porArticulo]);

  const surtir = useAccion((lineas: unknown[]) => q(supabase.rpc("surtir_material", {
    p_op: ordenId, p_lineas: lineas, p_recibio: recibe.trim() || null, p_previo: previo,
  })), {
    exito: () => {
      if (previo) return "Quedó registrado lo que ya se había entregado";
      const taller = extras.filter((x) => Number(x.cantidad) > 0 && esDelTaller(x.art.id)).length;
      return taller ? `Material surtido; ${taller} consumible(s) salieron al taller a nombre de ${recibe.trim()}` : "Material surtido a la orden";
    },
    invalidar: [CLAVE], alTerminar: () => alCambiar(false),
  });

  function enviar() {
    const lineas = [
      ...pendientes.filter((m) => Number(cant[m.articulo_id]) > 0)
        .map((m) => ({ articulo_id: m.articulo_id, cantidad: Number(cant[m.articulo_id]), almacen_id: Number(alm[m.articulo_id]) || null })),
      ...extras.filter((x) => Number(x.cantidad) > 0)
        .map((x) => ({ articulo_id: x.art.id, cantidad: Number(x.cantidad), almacen_id: Number(x.almacen || alm[x.art.id]) || null, motivo: x.motivo.trim() })),
    ];
    if (lineas.length === 0) { toast.error("Escribe al menos una cantidad"); return; }
    const deMas = pendientes.find(excede);
    if (deMas) {
      toast.error(`De "${deMas.nombre}" solo faltan ${cifra(deMas.por_surtir)} por surtir. Si hace falta más, pide el cambio a ingeniería («Solicitar cambio a ingeniería» en la orden).`);
      return;
    }
    if (!previo && !recibe.trim()) { toast.error("Elige quién recibe el material"); return; }
    const sinMotivo = extras.find((x) => Number(x.cantidad) > 0 && !x.motivo.trim() && !esDelTaller(x.art.id));
    if (sinMotivo) { toast.error(`Escribe por qué sale "${sinMotivo.art.nombre}" si no está en la lista`); return; }
    surtir.mutate(lineas);
  }

  const total = pendientes.filter((m) => Number(cant[m.articulo_id]) > 0).length + extras.filter((x) => Number(x.cantidad) > 0).length;
  // Lo que tiene cantidad y la búsqueda esconde también sale: que no se olvide.
  const ocultasConCantidad = pendientes.filter((m) => Number(cant[m.articulo_id]) > 0 && !enBusqueda(m, buscar)).length;
  const selAlmacen = (id: string, valor: string, cambiar: (v: string) => void) => {
    const lista = porArticulo.get(id) ?? [];
    if (lista.length === 0) return <span className="text-xs text-peligro">Sin existencia</span>;
    return (
      <select className="campo h-8 text-xs py-0" value={valor} onChange={(e) => cambiar(e.target.value)} aria-label="Almacén">
        {lista.map((e) => <option key={e.almacen_id} value={e.almacen_id}>{e.almacen.nombre} ({cifra(e.cantidad)})</option>)}
      </select>
    );
  };

  return (
    <Dialogo abierto={abierto} alCambiar={alCambiar} ancho="max-w-4xl" titulo={`Surtir material · ${folio}`}
             descripcion={previo
               ? "Lo que ya se le había entregado a esta orden con la hoja de salidas, antes del ERP. Cuenta como surtido y no descuenta inventario (el inventario que se cargó ya venía sin eso)."
               : "Escribe lo que sale o toca el número de «Por surtir» o de «Apartado» para llenarlo. Si das una parte, lo demás queda «por surtir»; de una partida no sale más de lo que falta. La salida queda ligada a la orden y descuenta su reserva."}
             pie={<>
               <span className="mr-auto text-sm text-tenue self-center">{total} partida(s) {previo ? "ya entregada(s)" : "a surtir"}</span>
               <Boton variante="secundario" onClick={() => alCambiar(false)}>Cancelar</Boton>
               <Boton onClick={enviar} cargando={surtir.isPending} disabled={total === 0 || (!previo && !recibe.trim())}>
                 <PackageOpen className="h-4 w-4" />{previo ? "Registrar lo ya entregado" : "Surtir"}
               </Boton>
             </>}>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] items-end mb-4">
        {!previo ? (
          <Campo etiqueta="¿Quién recibe?" ayuda="La persona del taller que se lleva el material. Queda en la historia de la orden.">
            <span className="block" data-explain={GLOSARIO.quienRecibe} data-explain-title="¿Quién recibe?">
              <Entrada list="recibe-surtido" value={recibe} onChange={(e) => setRecibe(e.target.value)} placeholder="Escribe o elige un nombre" autoFocus />
            </span>
            <datalist id="recibe-surtido">{(personal.data ?? []).map((p) => <option key={p.id} value={p.nombre} />)}</datalist>
          </Campo>
        ) : <span />}
        {puedePrevio && (
          <label className="flex items-center gap-2 text-sm rounded-lg border border-borde px-3 py-2 cursor-pointer" data-explain={GLOSARIO.entregadoAntesDelErp} data-explain-title="Ya entregado con la hoja">
            <input type="checkbox" checked={previo} onChange={(e) => cambiarPrevio(e.target.checked)} />
            Ya se había entregado con la hoja (antes del ERP)
          </label>
        )}
      </div>
      {pendientes.length === 0 && extras.length === 0 && <p className="text-sm text-tenue mb-3">Todo lo de la lista ya se surtió.</p>}
      {pendientes.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-2">
          {previo
            ? <Boton tamano="sm" variante="fantasma" onClick={() => llenarTodos((m) => m.por_surtir)}
                data-explain={GLOSARIO.botonLlenarConFaltante} data-explain-title="Llenar con todo lo que falta">Llenar con todo lo que falta</Boton>
            : <Boton tamano="sm" variante="fantasma" onClick={() => llenarTodos((m) => Math.min(m.apartado, m.por_surtir))}
                data-explain={GLOSARIO.botonLlenarConApartado} data-explain-title="Llenar con lo apartado">Llenar con lo apartado</Boton>}
          <Boton tamano="sm" variante="fantasma" onClick={() => setCant({})}>Limpiar</Boton>
          <CajaBuscar valor={buscar} alCambiar={setBuscar} className="w-full sm:w-64 sm:ml-auto" />
        </div>
      )}
      {ocultasConCantidad > 0 && (
        <p className="text-xs text-aviso mb-2">{ocultasConCantidad} partida(s) con cantidad no se ven por la búsqueda; también salen.</p>
      )}
      {pendientes.length > 0 && visibles.length === 0 && <p className="text-sm text-tenue mb-3">Nada coincide con «{buscar.trim()}».</p>}
      {visibles.length > 0 && (
        <div className="overflow-x-auto -mx-5 px-5">
          <table className="tabla">
            <thead><tr><th>Material</th>
              <th className="text-right" data-explain={GLOSARIO.llenarSurtido} data-explain-title="Por surtir"><span>Por surtir</span></th>
              <th className="text-right" data-explain={GLOSARIO.apartadoOrden} data-explain-title="Apartado"><span>Apartado</span></th>
              <th className="text-right w-32">{previo ? "Ya se entregó" : "Sale"}</th>
              {!previo && <th className="w-56" data-explain={GLOSARIO.almacenDeSalidaSurtir} data-explain-title="De qué almacén"><span>De</span></th>}</tr></thead>
            <tbody>
              {visibles.map((m, i) => (
                <Fragment key={m.id}>
                {(i === 0 || visibles[i - 1].categoria !== m.categoria) && (
                  <tr className="hover:bg-transparent">
                    <td colSpan={previo ? 4 : 5} className="bg-fondo/70 text-xs font-semibold text-tenue uppercase tracking-wide py-1.5">
                      {m.categoria ?? SIN_CATEGORIA} <span className="font-normal normal-case tracking-normal">· {visibles.filter((x) => x.categoria === m.categoria).length}</span>
                    </td>
                  </tr>
                )}
                <tr className={cn(m.apartado === 0 && "text-tenue")}>
                  <td className="max-w-[300px]"><p className="truncate text-texto" title={m.nombre}>{m.nombre}</p><p className="text-xs text-tenue">{m.clave}</p></td>
                  <td className="text-right cifra whitespace-nowrap">
                    <button type="button" className="rounded px-1 hover:bg-marca-suave hover:text-marca-texto" title="Llenar con lo que falta"
                            onClick={() => llenar(m, m.por_surtir)} data-explain={GLOSARIO.llenarSurtido} data-explain-title="Tocar para llenar">
                      {cifra(m.por_surtir)} <span className="text-xs text-tenue">{m.unidad}</span>
                    </button>
                  </td>
                  <td className="text-right cifra">{m.apartado > 0
                    ? <button type="button" className="rounded px-1 hover:bg-marca-suave hover:text-marca-texto" title="Llenar con lo apartado"
                              data-explain={GLOSARIO.llenarSurtido} data-explain-title="Tocar para llenar"
                              onClick={() => llenar(m, Math.min(m.apartado, m.por_surtir))}>{cifra(m.apartado)}</button>
                    : "—"}</td>
                  <td className="text-right">
                    <input className={cn("campo h-8 text-right cifra", excede(m) && "border-peligro focus:ring-peligro/30")} inputMode="decimal"
                           value={cant[m.articulo_id] ?? ""} placeholder="0" title={excede(m) ? `Solo faltan ${cifra(m.por_surtir)}` : undefined}
                           aria-label={`Cantidad que sale de ${m.nombre}`}
                           onChange={(e) => setCant((c) => ({ ...c, [m.articulo_id]: e.target.value }))} />
                  </td>
                  {!previo && <td>{existencias.isLoading ? <span className="text-xs text-tenue">…</span> : selAlmacen(m.articulo_id, alm[m.articulo_id] ?? "", (v) => setAlm((a) => ({ ...a, [m.articulo_id]: v })))}</td>}
                </tr>
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!previo && <div className="mt-5 space-y-2">
        <p className="text-sm font-medium">Fuera de la lista</p>
        <p className="text-xs text-tenue">Lo que sale para esta orden sin estar en su lista (una pieza distinta, tornillería de otra medida). Sirve para corregir la lista. Si es consumible del taller (discos, lijas, soldadura, EPP) sale a nombre de quien recibe, no a la orden, y no pide motivo.</p>
        {extras.map((x, i) => (
          <div key={x.art.id} className="grid gap-2 sm:grid-cols-[1fr_6rem_12rem_1fr_auto] items-center rounded-lg border border-borde p-2">
            <p className="text-sm truncate" title={x.art.nombre}>{x.art.nombre}</p>
            <input className="campo h-8 text-right cifra" inputMode="decimal" placeholder="Cant." value={x.cantidad} aria-label="Cantidad"
                   onChange={(e) => setExtras((l) => l.map((y, k) => (k === i ? { ...y, cantidad: e.target.value } : y)))} />
            {selAlmacen(x.art.id, x.almacen || alm[x.art.id] || "", (v) => setExtras((l) => l.map((y, k) => (k === i ? { ...y, almacen: v } : y))))}
            <input className="campo h-8" placeholder={esDelTaller(x.art.id) ? "Consumo del taller (motivo opcional)" : "Motivo (obligatorio)"} value={x.motivo} aria-label="Motivo"
                   data-explain={esDelTaller(x.art.id) ? GLOSARIO.consumibleTaller : undefined}
                   onChange={(e) => setExtras((l) => l.map((y, k) => (k === i ? { ...y, motivo: e.target.value } : y)))} />
            <button type="button" className="p-1.5 text-tenue hover:text-peligro" aria-label="Quitar" onClick={() => setExtras((l) => l.filter((_, k) => k !== i))}>
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        <BuscadorArticulo tipos={TIPOS_MATERIAL} mostrarPrecio={false} placeholder="Agregar material fuera de la lista…"
          alElegir={(a) => {
            if (material.some((m) => m.articulo_id === a.id && m.requerido > 0 && !m.del_taller)) { toast.info(`"${a.nombre}" ya está en la lista: surte desde la tabla`); return; }
            if (!extras.some((x) => x.art.id === a.id)) setExtras((l) => [...l, { art: a, cantidad: "", almacen: "", motivo: "" }]);
          }} />
      </div>}
    </Dialogo>
  );
}

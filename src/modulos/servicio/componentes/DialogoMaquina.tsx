import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialogo } from "@/components/ui/dialogo";
import { Boton } from "@/components/ui/boton";
import { AreaTexto, Campo, Entrada, Seleccion } from "@/components/ui/campo";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { CLAVE, CRITICIDAD, ESPECIALIDAD, IMPACTO_PRODUCCION, RIESGO_SEGURIDAD, TIPO_EQUIPO, TIPO_MAQUINA, TIPO_MTTO, usePersonal, type Maquina } from "../datos";
import { GLOSARIO } from "@/tutorial/glosario";

// Sugerencias para empezar; la categoría es libre (Esteban da de alta equipo de oficina, aires…)
// y la lista también ofrece las que ya existen, para que no salgan «compresor» y «compresores».
const CATEGORIAS = ["soldadora", "rectificador", "taladro", "esmeril", "mototool", "compresor", "torno", "roladora", "dobladora",
  "cortadora", "montacargas", "conmutador", "motor", "pinzas", "computadora", "impresora", "aire acondicionado", "mobiliario"];

/** Alta o cambio de una máquina o herramienta (lo hace la gerencia; la RLS lo exige). */
export function DialogoMaquina({ m, alCerrar, alGuardar }: { m?: Maquina; alCerrar: () => void; alGuardar?: (id: string) => void }) {
  const etapas = useQuery({
    queryKey: ["produccion", "etapas"],
    staleTime: 10 * 60_000,
    queryFn: () => q<{ id: number; nombre: string }[]>(supabase.from("etapas").select("id, nombre").eq("activa", true).order("orden")),
  });
  const categorias = useQuery({
    queryKey: [...CLAVE, "categorias"],
    staleTime: 5 * 60_000,
    queryFn: async () => [...new Set([...(await q<{ categoria: string }[]>(supabase.from("maquinas").select("categoria"))).map((x) => x.categoria), ...CATEGORIAS])]
      .sort((a, b) => a.localeCompare(b, "es")),
  });
  const [f, setF] = useState({
    numero: m?.numero ?? "", nombre: m?.nombre ?? "", tipo: m?.tipo ?? "maquina", categoria: m?.categoria ?? "",
    marca: m?.marca ?? "", modelo: m?.modelo ?? "", numero_serie: m?.numero_serie ?? "", etapa_id: m?.etapa_id ? String(m.etapa_id) : "",
    ubicacion: m?.ubicacion ?? "", critica: m?.critica ?? false, prestable: m?.prestable ?? false, usa_horometro: m?.usa_horometro ?? false,
    horas_uso: m ? String(m.horas_uso) : "0", notas: m?.notas ?? "",
    criticidad: m?.criticidad ?? "", tipo_mantenimiento: m?.tipo_mantenimiento ?? "", especialidad: m?.especialidad ?? "",
    tipo_equipo: m?.tipo_equipo ?? "", asignada_a: m?.asignada_a ?? "",
    impacto_produccion: m?.impacto_produccion != null ? String(m.impacto_produccion) : "",
    riesgo_seguridad: m?.riesgo_seguridad != null ? String(m.riesgo_seguridad) : "",
    tiene_respaldo: m?.tiene_respaldo == null ? "" : m.tiene_respaldo ? "si" : "no",
    dias_refaccion: m?.dias_refaccion != null ? String(m.dias_refaccion) : "",
  });
  // Con los dos factores que solo sabe quien conoce la máquina, la base calcula la criticidad.
  const calculada = f.impacto_produccion !== "" && f.riesgo_seguridad !== "";
  const personal = usePersonal();
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const guardar = useAccion(async () => {
    const fila = {
      numero: f.numero.trim().toUpperCase(), nombre: f.nombre.trim(), tipo: f.tipo, categoria: f.categoria.trim().toLowerCase(),
      marca: f.marca.trim() || null, modelo: f.modelo.trim() || null, numero_serie: f.numero_serie.trim() || null,
      etapa_id: f.etapa_id ? Number(f.etapa_id) : null, ubicacion: f.ubicacion.trim() || null, critica: f.critica,
      criticidad: f.criticidad || null, tipo_mantenimiento: f.tipo_mantenimiento || null, especialidad: f.especialidad || null,
      tipo_equipo: f.tipo_equipo || null, asignada_a: f.asignada_a || null,
      impacto_produccion: f.impacto_produccion === "" ? null : Number(f.impacto_produccion),
      riesgo_seguridad: f.riesgo_seguridad === "" ? null : Number(f.riesgo_seguridad),
      tiene_respaldo: f.tiene_respaldo === "" ? null : f.tiene_respaldo === "si",
      dias_refaccion: f.dias_refaccion.trim() === "" ? null : Math.max(0, Math.round(Number(f.dias_refaccion))),
      prestable: f.prestable || f.tipo === "herramienta", usa_horometro: f.usa_horometro, notas: f.notas.trim() || null,
      ...(m ? {} : { horas_uso: Number(f.horas_uso) || 0 }),
    };
    const r = m
      ? await q<{ id: string }>(supabase.from("maquinas").update(fila).eq("id", m.id).select("id").single())
      : await q<{ id: string }>(supabase.from("maquinas").insert(fila).select("id").single());
    return r.id;
  }, { exito: m ? "Cambios guardados" : "Máquina dada de alta", invalidar: [CLAVE], alTerminar: (id) => { alGuardar?.(id); alCerrar(); } });
  const listo = f.numero.trim() && f.nombre.trim() && f.categoria.trim();

  return (
    <Dialogo abierto alCambiar={(v) => !v && alCerrar()} titulo={m ? `Editar ${m.numero}` : "Nueva máquina o herramienta"} ancho="max-w-2xl"
      descripcion="El número es el que está pintado en la máquina: con él se reporta la falla desde el taller."
      pie={<>
        <Boton variante="secundario" onClick={alCerrar}>Cancelar</Boton>
        <Boton type="submit" form="form-maquina" disabled={!listo} cargando={guardar.isPending}>Guardar</Boton>
      </>}>
      <form id="form-maquina" className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (listo) guardar.mutate(); }}>
        <div className="grid gap-3 sm:grid-cols-3">
          <Campo etiqueta="Número"><Entrada value={f.numero} onChange={(e) => set("numero", e.target.value)} placeholder="SOL-03" autoFocus /></Campo>
          <Campo etiqueta="Nombre" className="sm:col-span-2"><Entrada value={f.nombre} onChange={(e) => set("nombre", e.target.value)} placeholder="Soldadora 03" /></Campo>
          <Campo etiqueta="Tipo">
            <Seleccion value={f.tipo} onChange={(e) => set("tipo", e.target.value as Maquina["tipo"])}>
              {Object.entries(TIPO_MAQUINA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Seleccion>
          </Campo>
          <Campo etiqueta="Categoría" ayuda="Elige una o escribe una nueva.">
            <span data-explain={GLOSARIO.categoriaMaquina} className="block">
              <Entrada list="categorias-maquina" value={f.categoria} onChange={(e) => set("categoria", e.target.value)} placeholder="soldadora, impresora…" />
              <datalist id="categorias-maquina">{(categorias.data ?? CATEGORIAS).map((c) => <option key={c} value={c} />)}</datalist>
            </span>
          </Campo>
          <Campo etiqueta="Área del taller">
            <Seleccion value={f.etapa_id} onChange={(e) => set("etapa_id", e.target.value)}>
              <option value="">Sin área (oficinas, patio…)</option>
              {(etapas.data ?? []).map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
            </Seleccion>
          </Campo>
          <Campo etiqueta="Marca"><Entrada value={f.marca} onChange={(e) => set("marca", e.target.value)} /></Campo>
          <Campo etiqueta="Modelo"><Entrada value={f.modelo} onChange={(e) => set("modelo", e.target.value)} /></Campo>
          <Campo etiqueta="Número de serie"><Entrada value={f.numero_serie} onChange={(e) => set("numero_serie", e.target.value)} /></Campo>
          <Campo etiqueta="Ubicación" className="sm:col-span-2"><Entrada value={f.ubicacion} onChange={(e) => set("ubicacion", e.target.value)} placeholder="Nave 1, mesa 3" /></Campo>
          <Campo etiqueta="Tipo de mantenimiento">
            <span data-explain={GLOSARIO.tipoMantenimiento} className="block">
              <Seleccion value={f.tipo_mantenimiento} onChange={(e) => set("tipo_mantenimiento", e.target.value)}>
                <option value="">—</option>
                {Object.entries(TIPO_MTTO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Seleccion>
            </span>
          </Campo>
          <Campo etiqueta="Lo hace">
            <Seleccion value={f.especialidad} onChange={(e) => set("especialidad", e.target.value)}>
              <option value="">—</option>
              {Object.entries(ESPECIALIDAD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Seleccion>
          </Campo>
          <Campo etiqueta="Tipo de equipo">
            <Seleccion value={f.tipo_equipo} onChange={(e) => set("tipo_equipo", e.target.value)}>
              <option value="">—</option>
              {Object.entries(TIPO_EQUIPO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Seleccion>
          </Campo>
          <Campo etiqueta="Asignada a" className="sm:col-span-2" ayuda="Para la herramienta que siempre trae la misma persona (su soldadora). Un préstamo de días va en Resguardos.">
            <span data-explain={GLOSARIO.herramientaAsignada} className="block">
              <Seleccion value={f.asignada_a} onChange={(e) => set("asignada_a", e.target.value)}>
                <option value="">Nadie (es del taller)</option>
                {(personal.data ?? []).map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
              </Seleccion>
            </span>
          </Campo>
          {!m && f.usa_horometro && <Campo etiqueta="Horas de uso hoy"><Entrada type="number" min="0" step="0.1" value={f.horas_uso} onChange={(e) => set("horas_uso", e.target.value)} /></Campo>}
        </div>
        <fieldset className="rounded-lg border border-borde p-3 space-y-3">
          <legend className="px-1 text-sm font-semibold" data-explain={GLOSARIO.criticidadMaquina} data-explain-title="Criticidad">Criticidad</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo etiqueta="Si se para…">
              <span data-explain={GLOSARIO.impactoProduccion} className="block">
                <Seleccion value={f.impacto_produccion} onChange={(e) => set("impacto_produccion", e.target.value)}>
                  <option value="">Sin calificar</option>
                  {IMPACTO_PRODUCCION.map((t, i) => <option key={t} value={i}>{t}</option>)}
                </Seleccion>
              </span>
            </Campo>
            <Campo etiqueta="Riesgo de seguridad">
              <span data-explain={GLOSARIO.riesgoSeguridad} className="block">
                <Seleccion value={f.riesgo_seguridad} onChange={(e) => set("riesgo_seguridad", e.target.value)}>
                  <option value="">Sin calificar</option>
                  {RIESGO_SEGURIDAD.map((t, i) => <option key={t} value={i}>{t}</option>)}
                </Seleccion>
              </span>
            </Campo>
            <Campo etiqueta="Respaldo">
              <span data-explain={GLOSARIO.respaldoMaquina} className="block">
                <Seleccion value={f.tiene_respaldo} onChange={(e) => set("tiene_respaldo", e.target.value)}>
                  <option value="">Buscarlo solo</option>
                  <option value="si">Sí hay con qué suplirla</option>
                  <option value="no">No hay con qué suplirla</option>
                </Seleccion>
              </span>
            </Campo>
            <Campo etiqueta="Días para conseguir refacción" ayuda="Vacío: lo que tardan sus refacciones.">
              <span data-explain={GLOSARIO.diasRefaccion} className="block">
                <Entrada type="number" min="0" step="1" value={f.dias_refaccion} onChange={(e) => set("dias_refaccion", e.target.value)} />
              </span>
            </Campo>
          </div>
          {calculada ? (
            <p className="text-xs text-tenue">La criticidad se calcula sola con esto, las fallas y el costo de reparación del último año.</p>
          ) : (
            <Campo etiqueta="Mientras, la de la hoja" ayuda="Al calificar «si se para» y el riesgo, se calcula sola.">
              <Seleccion value={f.criticidad} onChange={(e) => set("criticidad", e.target.value)}>
                <option value="">Sin calificar</option>
                {Object.entries(CRITICIDAD).map(([k, v]) => <option key={k} value={k}>{v.texto}</option>)}
              </Seleccion>
            </Campo>
          )}
        </fieldset>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          {([...(f.criticidad || calculada ? [] : [["critica", "Crítica (si se para, se para el área)"]] as const), ["prestable", "Se presta con resguardo"], ["usa_horometro", "Tiene horómetro"]] as const).map(([k, t]) => (
            <label key={k} className="inline-flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={f[k] || (k === "prestable" && f.tipo === "herramienta")} disabled={k === "prestable" && f.tipo === "herramienta"}
                     onChange={(e) => set(k, e.target.checked)} className="accent-[hsl(var(--marca))]" />{t}
            </label>
          ))}
        </div>
        <Campo etiqueta="Notas"><AreaTexto rows={2} value={f.notas} onChange={(e) => set("notas", e.target.value)} /></Campo>
      </form>
    </Dialogo>
  );
}

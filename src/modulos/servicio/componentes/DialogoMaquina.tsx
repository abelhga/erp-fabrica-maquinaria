import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialogo } from "@/components/ui/dialogo";
import { Boton } from "@/components/ui/boton";
import { AreaTexto, Campo, Entrada, Seleccion } from "@/components/ui/campo";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { CLAVE, TIPO_MAQUINA, type Maquina } from "../datos";

const CATEGORIAS = ["soldadora", "rectificador", "taladro", "esmeril", "mototool", "compresor", "torno", "roladora", "dobladora",
  "cortadora", "montacargas", "conmutador", "motor", "pinzas", "otra"];

/** Alta o cambio de una máquina o herramienta (lo hace la gerencia; la RLS lo exige). */
export function DialogoMaquina({ m, alCerrar, alGuardar }: { m?: Maquina; alCerrar: () => void; alGuardar?: (id: string) => void }) {
  const etapas = useQuery({
    queryKey: ["produccion", "etapas"],
    staleTime: 10 * 60_000,
    queryFn: () => q<{ id: number; nombre: string }[]>(supabase.from("etapas").select("id, nombre").eq("activa", true).order("orden")),
  });
  const [f, setF] = useState({
    numero: m?.numero ?? "", nombre: m?.nombre ?? "", tipo: m?.tipo ?? "maquina", categoria: m?.categoria ?? "soldadora",
    marca: m?.marca ?? "", modelo: m?.modelo ?? "", numero_serie: m?.numero_serie ?? "", etapa_id: m?.etapa_id ? String(m.etapa_id) : "",
    ubicacion: m?.ubicacion ?? "", critica: m?.critica ?? false, prestable: m?.prestable ?? false, usa_horometro: m?.usa_horometro ?? false,
    horas_uso: m ? String(m.horas_uso) : "0", notas: m?.notas ?? "",
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const guardar = useAccion(async () => {
    const fila = {
      numero: f.numero.trim().toUpperCase(), nombre: f.nombre.trim(), tipo: f.tipo, categoria: f.categoria,
      marca: f.marca.trim() || null, modelo: f.modelo.trim() || null, numero_serie: f.numero_serie.trim() || null,
      etapa_id: f.etapa_id ? Number(f.etapa_id) : null, ubicacion: f.ubicacion.trim() || null, critica: f.critica,
      prestable: f.prestable || f.tipo === "herramienta", usa_horometro: f.usa_horometro, notas: f.notas.trim() || null,
      ...(m ? {} : { horas_uso: Number(f.horas_uso) || 0 }),
    };
    const r = m
      ? await q<{ id: string }>(supabase.from("maquinas").update(fila).eq("id", m.id).select("id").single())
      : await q<{ id: string }>(supabase.from("maquinas").insert(fila).select("id").single());
    return r.id;
  }, { exito: m ? "Cambios guardados" : "Máquina dada de alta", invalidar: [CLAVE], alTerminar: (id) => { alGuardar?.(id); alCerrar(); } });
  const listo = f.numero.trim() && f.nombre.trim();

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
          <Campo etiqueta="Categoría">
            <Seleccion value={f.categoria} onChange={(e) => set("categoria", e.target.value)}>
              {[...new Set([...CATEGORIAS, f.categoria])].map((c) => <option key={c} value={c}>{c}</option>)}
            </Seleccion>
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
          {!m && f.usa_horometro && <Campo etiqueta="Horas de uso hoy"><Entrada type="number" min="0" step="0.1" value={f.horas_uso} onChange={(e) => set("horas_uso", e.target.value)} /></Campo>}
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          {([["critica", "Crítica (si se para, se para el área)"], ["prestable", "Se presta con resguardo"], ["usa_horometro", "Tiene horómetro"]] as const).map(([k, t]) => (
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

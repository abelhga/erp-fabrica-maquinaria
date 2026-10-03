import { useEffect, useMemo, useState } from "react";
import { Check, PackageCheck, Plus, Trash2 } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { numero } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { CampoNumero } from "@/modulos/ventas/componentes/campos";
import { Galeria, SubirArchivo } from "./Archivos";
import { CLAVE, useArchivos, useChecklist, type Bulto, type Envio, type LineaEnvio } from "./datos";

const esEquipo = (l: LineaEnvio) => l.articulo_tipo === "equipo" || l.articulo_tipo === "subensamble";

/**
 * Empacar desde el celular del almacenista: fotos, check list con casillas
 * grandes, número de serie de cada equipo y peso y medidas de cada bulto. La base
 * revisa todo otra vez (marcar_empacado); aquí solo se guía para no fallar.
 */
export function Empacar({ envio, lineas, bultosIniciales, maxFotos = 6 }: {
  envio: Envio; lineas: LineaEnvio[]; bultosIniciales: Bulto[]; maxFotos?: number;
}) {
  const archivos = useArchivos({ envioId: envio.id });
  const fotos = (archivos.data ?? []).filter((a) => a.tipo === "empaque");
  const checklist = useChecklist();
  const hayEquipo = lineas.some(esEquipo);
  const hayComponente = lineas.some((l) => !esEquipo(l));
  // Primero lo del equipo, luego lo de componentes y al final lo de todos los envíos.
  const rango = { equipo: 0, componente: 1, todos: 2 } as const;
  const items = (checklist.data ?? []).filter((c) => c.activo && (c.aplica === "todos" || (c.aplica === "equipo" && hayEquipo) || (c.aplica === "componente" && hayComponente)))
    .sort((a, b) => rango[a.aplica] - rango[b.aplica] || a.orden - b.orden);
  const [marcados, setMarcados] = useState<Set<number>>(new Set());
  const [series, setSeries] = useState<Record<string, string[]>>({});
  const [bultos, setBultos] = useState<Bulto[]>([]);
  const [guardar, setGuardar] = useState<Record<number, boolean>>({});
  const pideMedidas = envio.tipo === "paqueteria" || envio.tipo === "a_full" || envio.tipo === "flete";

  useEffect(() => { setBultos(bultosIniciales.map((b) => ({ ...b }))); }, [bultosIniciales]);
  useEffect(() => {
    setSeries(Object.fromEntries(lineas.filter(esEquipo).map((l) => [l.id, Array.from({ length: Math.ceil(Number(l.cantidad)) }, () => "")])));
  }, [lineas]);

  // ¿El bulto que midió almacén es distinto de lo que dice el artículo? Se ofrece guardarlo.
  const empaqueDe = (articuloId: string | null) => lineas.find((l) => l.articulo_id === articuloId);
  const difiere = (b: Bulto) => {
    const l = empaqueDe(b.articulo_id);
    if (!l || b.peso_kg == null || b.largo_cm == null || b.ancho_cm == null || b.alto_cm == null) return false;
    return l.paquete_kg == null || Number(l.paquete_kg) !== Number(b.peso_kg) || Number(l.paquete_largo_cm) !== Number(b.largo_cm)
      || Number(l.paquete_ancho_cm) !== Number(b.ancho_cm) || Number(l.paquete_alto_cm) !== Number(b.alto_cm)
      || Number(l.paquete_piezas ?? 1) !== Number(b.piezas ?? 1);
  };

  const faltaSerie = lineas.filter(esEquipo).some((l) => (series[l.id] ?? []).some((s) => !s.trim()));
  const sinMedir = bultos.length === 0 || bultos.some((b) => b.peso_kg == null || b.largo_cm == null || b.ancho_cm == null || b.alto_cm == null);
  // En flete las medidas ayudan pero no detienen la salida; en paquetería sin ellas no hay guía.
  const faltaMedida = pideMedidas && envio.tipo !== "flete" && sinMedir;
  const listo = fotos.length > 0 && items.every((i) => marcados.has(i.id)) && !faltaSerie && !faltaMedida;
  const pesoTotal = useMemo(() => bultos.reduce((s, b) => s + Number(b.peso_kg ?? 0), 0), [bultos]);

  const empacar = useAccion(async () => {
    for (const [k, si] of Object.entries(guardar)) {
      const b = bultos[Number(k)];
      if (si && b?.articulo_id && difiere(b)) {
        await q(supabase.rpc("guardar_empaque", { p_articulo: b.articulo_id, p_kg: b.peso_kg, p_largo: b.largo_cm, p_ancho: b.ancho_cm, p_alto: b.alto_cm, p_piezas: b.piezas ?? 1 }));
      }
    }
    await q(supabase.rpc("marcar_empacado", {
      p_envio: envio.id, p_checklist: [...marcados], p_series: series,
      p_bultos: pideMedidas ? bultos.map((b) => ({ articulo_id: b.articulo_id, contenido: b.contenido, piezas: b.piezas, peso_kg: b.peso_kg, largo_cm: b.largo_cm, ancho_cm: b.ancho_cm, alto_cm: b.alto_cm })) : null,
    }));
  }, { exito: `${envio.folio} empacado: la evidencia quedó guardada`, invalidar: [CLAVE] });

  const cambiarBulto = (i: number, cambios: Partial<Bulto>) => setBultos((bs) => bs.map((b, j) => (j === i ? { ...b, ...cambios } : b)));
  const paso = (n: number, titulo: string, hecho: boolean) => (
    <h4 className="flex items-center gap-2 font-semibold">
      <span className={cn("flex h-6 w-6 items-center justify-center rounded-full text-xs", hecho ? "bg-ok text-white" : "bg-marca-suave text-marca-texto")}>
        {hecho ? <Check className="h-3.5 w-3.5" /> : n}
      </span>{titulo}
    </h4>
  );

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        {paso(1, `Fotos del paquete (${fotos.length} de ${maxFotos})`, fotos.length > 0)}
        <p className="text-sm text-tenue">Abierto con lo que lleva y cerrado con la etiqueta. Son la prueba si llega un reclamo de "llegó incompleto".</p>
        <Galeria archivos={fotos} />
        {fotos.length < maxFotos && (
          <SubirArchivo tipo="empaque" envioId={envio.id} texto={fotos.length ? "Tomar otra foto" : "Tomar foto del paquete"} maximo={maxFotos - fotos.length} grande />
        )}
      </section>

      <section className="space-y-3">
        {paso(2, "Check list de salida", items.length > 0 && items.every((i) => marcados.has(i.id)))}
        <div className="space-y-2">
          {items.map((i) => {
            const si = marcados.has(i.id);
            return (
              <label key={i.id} className={cn("flex min-h-[52px] cursor-pointer items-center gap-3 rounded-xl border px-4 py-2 transition",
                si ? "border-ok/40 bg-ok-suave" : "border-borde bg-superficie hover:bg-fondo")}>
                <input type="checkbox" className="h-6 w-6 shrink-0 accent-ok" checked={si}
                  onChange={() => setMarcados((m) => { const n = new Set(m); if (n.has(i.id)) n.delete(i.id); else n.add(i.id); return n; })} />
                <span className="text-[15px] leading-snug">{i.texto}</span>
              </label>
            );
          })}
          {items.length > 1 && marcados.size < items.length && (
            <button type="button" className="text-sm text-marca-texto hover:underline" onClick={() => setMarcados(new Set(items.map((i) => i.id)))}>
              Ya revisé todo: palomear todas
            </button>
          )}
        </div>
      </section>

      {lineas.some(esEquipo) && (
        <section className="space-y-3">
          {paso(3, "Número de serie", !faltaSerie)}
          <p className="text-sm text-tenue">El de la placa del equipo. Tiene que ser el de su orden de producción.</p>
          {lineas.filter(esEquipo).map((l) => (
            <div key={l.id} className="space-y-2">
              <p className="text-sm font-medium">{l.nombre}{l.ordenes?.length ? <span className="text-tenue font-normal"> · {l.ordenes.join(", ")}</span> : null}</p>
              {(series[l.id] ?? []).map((s, k) => (
                <input key={k} className="campo h-12 text-lg cifra uppercase placeholder:normal-case" value={s} placeholder={`Serie ${k + 1}, como dice la placa`} autoCapitalize="characters"
                  onChange={(e) => setSeries((x) => ({ ...x, [l.id]: (x[l.id] ?? []).map((y, j) => (j === k ? e.target.value : y)) }))} />
              ))}
            </div>
          ))}
        </section>
      )}

      {pideMedidas && (
        <section className="space-y-3">
          {paso(lineas.some(esEquipo) ? 4 : 3, envio.tipo === "flete" ? "Pesar y medir (si se puede)" : "Pesar y medir cada bulto", !sinMedir)}
          <p className="text-sm text-tenue">
            Vienen del artículo; si al pesar sale distinto, corrígelo y guárdalo en el artículo para la próxima.
            {bultos.length > 0 && <> Total: <b className="cifra">{numero(pesoTotal)} kg</b> en {bultos.length} {bultos.length === 1 ? "bulto" : "bultos"}.</>}
          </p>
          {bultos.map((b, i) => (
            <div key={i} className="rounded-xl border border-borde p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-tenue cifra">#{i + 1}</span>
                <input className="campo h-9 flex-1" value={b.contenido ?? ""} placeholder="Qué lleva" onChange={(e) => cambiarBulto(i, { contenido: e.target.value })} />
                <Boton variante="fantasma" tamano="icono" aria-label="Quitar bulto" onClick={() => setBultos((bs) => bs.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Boton>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {([["peso_kg", "kg"], ["largo_cm", "largo"], ["ancho_cm", "ancho"], ["alto_cm", "alto"], ["piezas", "piezas"]] as const).map(([k, et]) => (
                  <label key={k} className="space-y-1 min-w-0">
                    <span className="block text-[11px] text-tenue">{et}{k.endsWith("_cm") ? " cm" : ""}</span>
                    <CampoNumero valor={b[k]} decimales={k === "piezas" ? 3 : 1} vacioEsCero={false} min={0} etiqueta={`${et} del bulto ${i + 1}`}
                      alCambiar={(n) => cambiarBulto(i, { [k]: n || null } as Partial<Bulto>)} className="[&_input]:h-11 [&_input]:text-base" />
                  </label>
                ))}
              </div>
              {b.articulo_id && difiere(b) && (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" className="h-5 w-5 accent-marca" checked={!!guardar[i]} onChange={(e) => setGuardar((g) => ({ ...g, [i]: e.target.checked }))} />
                  Guardar como empaque de <b className="truncate">{empaqueDe(b.articulo_id)?.nombre}</b>
                </label>
              )}
            </div>
          ))}
          <Boton variante="secundario" tamano="sm" onClick={() => setBultos((bs) => [...bs, { articulo_id: null, contenido: "", piezas: null, peso_kg: null, largo_cm: null, ancho_cm: null, alto_cm: null }])}>
            <Plus className="h-3.5 w-3.5" />Otro bulto
          </Boton>
        </section>
      )}

      <div className="sticky bottom-0 -mx-6 border-t border-borde bg-superficie/95 px-6 py-3 backdrop-blur">
        <Boton tamano="lg" className="w-full" variante="exito" disabled={!listo} cargando={empacar.isPending} onClick={() => empacar.mutate(undefined)}>
          <PackageCheck className="h-5 w-5" />Marcar empacado
        </Boton>
        {!listo && (
          <p className="mt-1.5 text-center text-xs text-tenue">
            {fotos.length === 0 ? "Falta la foto." : !items.every((i) => marcados.has(i.id)) ? "Falta palomear el check list." : faltaSerie ? "Falta el número de serie." : "Falta peso o medidas de un bulto."}
          </p>
        )}
      </div>
    </div>
  );
}

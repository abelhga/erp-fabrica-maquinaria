import { useEffect, useState } from "react";
import { Dialogo } from "@/components/ui/dialogo";
import { Boton } from "@/components/ui/boton";
import { Campo, Entrada, Seleccion, AreaTexto } from "@/components/ui/campo";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import type { ProveedorCompleto } from "./tipos";

type Datos = Omit<ProveedorCompleto, "id">;
const VACIO: Datos = {
  nombre: "", razon_social: null, rfc: null, contacto: null, telefono: null, correo: null, sitio: null, categoria: null, pais: "México",
  es_importacion: false, moneda: "MXN", dias_credito: 0, dias_entrega: null, datos_bancarios: null, notas: null, activo: true,
};

const CAMPOS = ["nombre", "razon_social", "rfc", "contacto", "telefono", "correo", "sitio", "categoria", "pais", "es_importacion",
  "moneda", "dias_credito", "dias_entrega", "datos_bancarios", "notas", "activo"] as const;

/** Alta y edición de proveedor en una sola ventana: lo indispensable arriba, lo demás opcional. */
export function DialogoProveedor({ abierto, alCambiar, proveedor, alGuardar }: {
  abierto: boolean; alCambiar: (v: boolean) => void; proveedor?: ProveedorCompleto; alGuardar?: (id: string) => void;
}) {
  const [d, setD] = useState<Datos>(VACIO);
  useEffect(() => { if (abierto) setD(proveedor ? { ...VACIO, ...proveedor } : VACIO); }, [abierto, proveedor]);
  const pon = <K extends keyof Datos>(k: K, v: Datos[K]) => setD((x) => ({ ...x, [k]: v }));
  const texto = (k: keyof Datos) => ({ value: (d[k] as string | null) ?? "", onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => pon(k, (e.target.value || null) as never) });

  const guardar = useAccion(async () => {
    // Solo lo que se edita aquí: el resto (folio de origen, fechas) lo cuida la base.
    const datos = { ...Object.fromEntries(CAMPOS.map((k) => [k, d[k]])), nombre: d.nombre.trim(), rfc: d.rfc?.trim().toUpperCase() || null };
    if (proveedor) return q<{ id: string }>(supabase.from("proveedores").update(datos).eq("id", proveedor.id).select("id").single());
    return q<{ id: string }>(supabase.from("proveedores").insert(datos).select("id").single());
  }, {
    exito: proveedor ? "Proveedor actualizado" : "Proveedor dado de alta",
    invalidar: [["v_proveedores"], ["proveedor"]],
    alTerminar: (r) => { alCambiar(false); alGuardar?.(r.id); },
  });

  return (
    <Dialogo abierto={abierto} alCambiar={alCambiar} ancho="max-w-2xl" titulo={proveedor ? `Editar ${proveedor.nombre}` : "Nuevo proveedor"}
      pie={<><Boton variante="secundario" onClick={() => alCambiar(false)}>Cancelar</Boton>
        <Boton onClick={() => guardar.mutate(undefined)} disabled={!d.nombre.trim()} cargando={guardar.isPending}>Guardar</Boton></>}>
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); if (d.nombre.trim()) guardar.mutate(undefined); }}>
        <Campo etiqueta="Nombre comercial" className="sm:col-span-2"><Entrada autoFocus value={d.nombre} onChange={(e) => pon("nombre", e.target.value)} placeholder="Como lo conoce compras" /></Campo>
        <Campo etiqueta="Razón social"><Entrada {...texto("razon_social")} /></Campo>
        <Campo etiqueta="RFC"><Entrada {...texto("rfc")} className="uppercase" /></Campo>
        <Campo etiqueta="Categoría" ayuda="Rodamientos, acero, bandas, motores…"><Entrada {...texto("categoria")} /></Campo>
        <Campo etiqueta="País"><Entrada value={d.pais} onChange={(e) => pon("pais", e.target.value)} /></Campo>
        <Campo etiqueta="Moneda">
          <Seleccion value={d.moneda} onChange={(e) => pon("moneda", e.target.value as Datos["moneda"])}>
            <option value="MXN">MXN</option><option value="USD">USD</option><option value="EUR">EUR</option>
          </Seleccion>
        </Campo>
        <label className="flex items-center gap-2 text-sm sm:mt-7">
          <input type="checkbox" className="accent-[hsl(var(--marca))]" checked={d.es_importacion} onChange={(e) => pon("es_importacion", e.target.checked)} />
          Es importación (sus artículos piden 6 meses de cobertura)
        </label>
        <Campo etiqueta="Días de crédito"><Entrada inputMode="numeric" value={String(d.dias_credito)} onChange={(e) => pon("dias_credito", Number(e.target.value.replace(/\D/g, "")) || 0)} /></Campo>
        <Campo etiqueta="Días de entrega (hábiles)" ayuda="Vacío = 7, el estándar"><Entrada inputMode="numeric" value={d.dias_entrega == null ? "" : String(d.dias_entrega)}
          onChange={(e) => pon("dias_entrega", e.target.value === "" ? null : Number(e.target.value.replace(/\D/g, "")))} /></Campo>
        <Campo etiqueta="Contacto"><Entrada {...texto("contacto")} /></Campo>
        <Campo etiqueta="Teléfono"><Entrada {...texto("telefono")} /></Campo>
        <Campo etiqueta="Correo"><Entrada type="email" {...texto("correo")} /></Campo>
        <Campo etiqueta="Sitio web"><Entrada {...texto("sitio")} /></Campo>
        <Campo etiqueta="Datos bancarios" className="sm:col-span-2"><AreaTexto {...texto("datos_bancarios")} className="min-h-[56px]" /></Campo>
        <Campo etiqueta="Notas" className="sm:col-span-2"><AreaTexto {...texto("notas")} className="min-h-[56px]" /></Campo>
        {proveedor && (
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" className="accent-[hsl(var(--marca))]" checked={d.activo} onChange={(e) => pon("activo", e.target.checked)} />
            Activo (si se desactiva ya no aparece al crear órdenes)
          </label>
        )}
        <button type="submit" hidden />
      </form>
    </Dialogo>
  );
}

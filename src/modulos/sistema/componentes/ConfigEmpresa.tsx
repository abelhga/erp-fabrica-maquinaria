import { useState, type FormEvent, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Save, X } from "lucide-react";
import { Tarjeta, EncabezadoTarjeta } from "@/components/ui/tarjeta";
import { Boton } from "@/components/ui/boton";
import { Campo, Entrada } from "@/components/ui/campo";
import { Cargando } from "@/components/ui/estados";
import { useSesion } from "@/lib/sesion";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { fecha } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { SoloLectura } from "./Editables";

export type Config = Record<string, unknown>;

export function useConfiguracion() {
  return useQuery({
    queryKey: ["configuracion"],
    queryFn: async () => {
      const filas = await q<{ clave: string; valor: unknown; descripcion: string | null; actualizado_en: string }[]>(
        supabase.from("configuracion").select("clave, valor, descripcion, actualizado_en"));
      return Object.fromEntries(filas.map((f) => [f.clave, f]));
    },
  });
}

/** Guarda una clave de configuración. Todo cambio queda en la bitácora (disparador auditar). */
export function useGuardarConfig(exito = "Guardado") {
  return useAccion(({ clave, valor }: { clave: string; valor: unknown }) =>
    q(supabase.from("configuracion").update({ valor, actualizado_en: new Date().toISOString() }).eq("clave", clave)),
  { exito, invalidar: [["configuracion"]] });
}

export function TarjetaForm({ titulo, descripcion, children, alGuardar, guardando, editable, quien, pie }: {
  titulo: string; descripcion?: ReactNode; children: ReactNode; alGuardar: () => void; guardando?: boolean; editable: boolean; quien?: ReactNode; pie?: ReactNode;
}) {
  return (
    <Tarjeta>
      <EncabezadoTarjeta titulo={titulo} descripcion={descripcion} />
      <form className="px-5 pb-5 space-y-4" onSubmit={(e: FormEvent) => { e.preventDefault(); alGuardar(); }}>
        <fieldset disabled={!editable} className="space-y-4">{children}</fieldset>
        {editable ? (
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-tenue">{pie}</span>
            <Boton type="submit" tamano="sm" cargando={guardando}><Save className="h-4 w-4" /> Guardar</Boton>
          </div>
        ) : quien && <SoloLectura quien={quien} />}
      </form>
    </Tarjeta>
  );
}

const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export function ConfigEmpresa() {
  const { puede } = useSesion();
  const editable = puede("admin", 3);
  const cfg = useConfiguracion();
  if (cfg.isLoading || !cfg.data) return <Cargando filas={6} />;
  const c = cfg.data;
  return (
    <div className="grid gap-4 lg:grid-cols-2 items-start">
      <Fiscal inicial={(c.empresa_fiscal?.valor ?? {}) as Config} comercial={(c.empresa?.valor ?? {}) as Config} editable={editable} />
      <div className="space-y-4">
        <Comercial inicial={(c.empresa?.valor ?? {}) as Config} editable={editable} />
        <Iva inicial={Number(c.iva?.valor ?? 0.16)} editable={editable} actualizado={c.iva?.actualizado_en} />
        <Arranque inicial={String(c.fecha_arranque?.valor ?? "")} editable={editable} />
      </div>
      <div className="lg:col-span-2">
        <Calendario inicial={(c.calendario_laboral?.valor ?? { dias: [1, 2, 3, 4, 5, 6], descansos_empresa: [] }) as { dias: number[]; descansos_empresa: string[] }} editable={editable} />
      </div>
    </div>
  );
}

function Fiscal({ inicial, comercial, editable }: { inicial: Config; comercial: Config; editable: boolean }) {
  const [f, setF] = useState(() => ({
    razon_social: String(inicial.razon_social ?? ""), rfc: String(inicial.rfc ?? ""), domicilio: String(inicial.domicilio ?? ""),
    terminos_url: String(inicial.terminos_url ?? ""),
  }));
  const guardar = useGuardarConfig("Datos fiscales guardados");
  const rfcMal = f.rfc && !/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/.test(f.rfc);
  return (
    <TarjetaForm titulo="Datos fiscales" descripcion="Encabezado de cotizaciones, pedidos y facturas." editable={editable} quien="sistemas o dirección"
      guardando={guardar.isPending}
      alGuardar={async () => {
        try {
          await guardar.mutateAsync({ clave: "empresa_fiscal", valor: { ...inicial, ...f } });
          // La razón social y el RFC también viven en "empresa"; se mantienen iguales para que no digan dos cosas.
          await guardar.mutateAsync({ clave: "empresa", valor: { ...comercial, razon_social: f.razon_social, rfc: f.rfc } });
        } catch { /* el aviso de error ya lo mostró useAccion */ }
      }}>
      <Campo etiqueta="Razón social"><Entrada value={f.razon_social} onChange={(e) => setF({ ...f, razon_social: e.target.value })} /></Campo>
      <Campo etiqueta="RFC" error={rfcMal ? "Un RFC de empresa son 12 caracteres: 3 letras, fecha AAMMDD y homoclave" : undefined}>
        <Entrada value={f.rfc} maxLength={13} className="font-mono" onChange={(e) => setF({ ...f, rfc: e.target.value.toUpperCase() })} />
      </Campo>
      <Campo etiqueta="Domicilio fiscal"><Entrada value={f.domicilio} onChange={(e) => setF({ ...f, domicilio: e.target.value })} /></Campo>
      <Campo etiqueta="Términos y condiciones (enlace)" ayuda="Sale al pie de cada cotización.">
        <Entrada type="url" value={f.terminos_url} onChange={(e) => setF({ ...f, terminos_url: e.target.value })} />
      </Campo>
    </TarjetaForm>
  );
}

function Comercial({ inicial, editable }: { inicial: Config; editable: boolean }) {
  const [f, setF] = useState(() => ({
    nombre: String(inicial.nombre ?? ""), telefono: String(inicial.telefono ?? ""), sitio: String(inicial.sitio ?? ""), direccion: String(inicial.direccion ?? ""),
  }));
  const guardar = useGuardarConfig("Datos de la empresa guardados");
  return (
    <TarjetaForm titulo="Empresa" descripcion="Cómo aparece Hegamex en documentos y en el ERP." editable={editable} quien="sistemas o dirección"
      guardando={guardar.isPending} alGuardar={() => guardar.mutate({ clave: "empresa", valor: { ...inicial, ...f } })}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Nombre comercial"><Entrada value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} /></Campo>
        <Campo etiqueta="Teléfono"><Entrada type="tel" value={f.telefono} onChange={(e) => setF({ ...f, telefono: e.target.value })} /></Campo>
        <Campo etiqueta="Sitio web"><Entrada value={f.sitio} onChange={(e) => setF({ ...f, sitio: e.target.value })} /></Campo>
        <Campo etiqueta="Dirección de la planta"><Entrada value={f.direccion} onChange={(e) => setF({ ...f, direccion: e.target.value })} /></Campo>
      </div>
    </TarjetaForm>
  );
}

function Iva({ inicial, editable, actualizado }: { inicial: number; editable: boolean; actualizado?: string }) {
  const [v, setV] = useState(String(Math.round(inicial * 10000) / 100));
  const guardar = useGuardarConfig("Tasa de IVA guardada");
  return (
    <TarjetaForm titulo="IVA" descripcion="Tasa general para cotizaciones y pedidos nuevos (los ya hechos no cambian)." editable={editable} quien="sistemas o dirección"
      guardando={guardar.isPending} pie={actualizado && `Cambiado el ${fecha(actualizado)}`}
      alGuardar={() => guardar.mutate({ clave: "iva", valor: Number(v) / 100 })}>
      <Campo etiqueta="Tasa (%)" ayuda="16 % general; 8 % en la región fronteriza.">
        <Entrada type="number" step="0.01" min="0" max="100" value={v} onChange={(e) => setV(e.target.value)} className="cifra w-32 block" />
      </Campo>
    </TarjetaForm>
  );
}

function Arranque({ inicial, editable }: { inicial: string; editable: boolean }) {
  const [v, setV] = useState(inicial);
  const guardar = useGuardarConfig("Fecha de arranque guardada");
  return (
    <TarjetaForm titulo="Arranque del ERP" editable={editable} quien="sistemas o dirección" guardando={guardar.isPending}
      descripcion="Desde este día las ventas y cobros salen del ERP; antes, los análisis y los saldos de arranque usan el libro de ventas de la hoja."
      alGuardar={() => v && guardar.mutate({ clave: "fecha_arranque", valor: v })}>
      <Campo etiqueta="Fecha de arranque" ayuda={inicial ? `Hoy dice ${fecha(inicial)}. Cambiarla mueve el corte entre hoja y ERP en los reportes.` : undefined}>
        <Entrada type="date" value={v} onChange={(e) => setV(e.target.value)} className="w-48 block" />
      </Campo>
    </TarjetaForm>
  );
}

function Calendario({ inicial, editable }: { inicial: { dias: number[]; descansos_empresa: string[] }; editable: boolean }) {
  const [dias, setDias] = useState<number[]>(inicial.dias ?? []);
  const [descansos, setDescansos] = useState<string[]>(inicial.descansos_empresa ?? []);
  const [nuevo, setNuevo] = useState("");
  const anio = new Date().getFullYear();
  const feriados = useQuery({
    queryKey: ["festivos_lft", anio],
    queryFn: () => q<string[]>(supabase.rpc("festivos_lft", { p_anio: anio })),
  });
  const guardar = useGuardarConfig("Calendario laboral guardado");
  return (
    <TarjetaForm titulo="Semana laboral y descansos" editable={editable} quien="sistemas o dirección" guardando={guardar.isPending}
      descripcion="Con esto se cuentan los días hábiles de vacaciones y permisos. Los feriados de ley se descuentan solos."
      alGuardar={() => guardar.mutate({ clave: "calendario_laboral", valor: { dias: [...dias].sort(), descansos_empresa: [...descansos].sort() } })}>
      <div className="grid gap-6 md:grid-cols-3">
        <div>
          <p className="text-sm font-medium mb-2">Días que se trabajan</p>
          <div className="flex flex-wrap gap-1.5">
            {DIAS.map((d, k) => {
              const n = k + 1, on = dias.includes(n);
              return (
                <button type="button" key={d} onClick={() => setDias(on ? dias.filter((x) => x !== n) : [...dias, n])}
                  className={cn("h-9 w-12 rounded-lg border text-sm font-medium", on ? "bg-marca text-white border-marca" : "border-borde text-tenue hover:bg-fondo")}>{d}</button>
              );
            })}
          </div>
        </div>
        <div>
          <p className="text-sm font-medium mb-2">Descansos de la empresa</p>
          <ul className="space-y-1 mb-2">
            {descansos.length === 0 && <li className="text-xs text-tenue">Ninguno (p. ej. 12 de diciembre o Semana Santa).</li>}
            {descansos.map((d) => (
              <li key={d} className="flex items-center justify-between text-sm rounded-md bg-fondo px-2 py-1">
                {fecha(d)}
                {editable && <button type="button" aria-label={`Quitar ${fecha(d)}`} onClick={() => setDescansos(descansos.filter((x) => x !== d))}><X className="h-3.5 w-3.5 text-tenue" /></button>}
              </li>
            ))}
          </ul>
          {editable && (
            <div className="flex gap-2">
              <Entrada type="date" value={nuevo} onChange={(e) => setNuevo(e.target.value)} />
              <Boton type="button" variante="secundario" tamano="icono" aria-label="Agregar descanso" disabled={!nuevo}
                onClick={() => { if (nuevo && !descansos.includes(nuevo)) setDescansos([...descansos, nuevo]); setNuevo(""); }}><Plus className="h-4 w-4" /></Boton>
            </div>
          )}
        </div>
        <div>
          <p className="text-sm font-medium mb-2">Feriados de ley {anio} (art. 74 LFT)</p>
          <ul className="text-sm text-tenue space-y-0.5">{(feriados.data ?? []).sort().map((d) => <li key={d}>{fecha(d)}</li>)}</ul>
        </div>
      </div>
    </TarjetaForm>
  );
}

import { useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Brush, Check, ChevronLeft, ChevronRight, HardHat, Smartphone, Truck, X, type LucideIcon } from "lucide-react";
import { Pagina } from "@/components/layout/Shell";
import { Boton } from "@/components/ui/boton";
import { Entrada } from "@/components/ui/campo";
import { Cargando, ErrorCarga, Vacio } from "@/components/ui/estados";
import { supabase } from "@/lib/supabase";
import { q, useAccion, useTiempoReal } from "@/lib/consultas";
import { fecha, hoyISO } from "@/lib/formato";
import { cn } from "@/lib/utilidades";

type Tipo = "epp" | "limpieza" | "celular" | "vehiculo";
type Momento = "" | "entrada" | "break1" | "break2";
interface Marca { momento: Momento; cumplio: boolean; nota: string | null; por: string | null; en: string }
interface Fila { empleado_id: string | null; area_id: number | null; nombre: string; puesto: string | null; en_plantilla: boolean; soy_yo: boolean; marcas: Marca[] }

const TIPOS: Record<Tipo, { texto: string; icono: LucideIcon; ayuda: string }> = {
  celular: { texto: "Celular", icono: Smartphone, ayuda: "¿Entregó el celular? Tres veces al día. 3 días con falla en el mes anulan el bono." },
  epp: { texto: "EPP", icono: HardHat, ayuda: "Casco, botas y guantes. Lo marca calidad; cuenta proporcional a los días marcados." },
  limpieza: { texto: "Limpieza", icono: Brush, ayuda: "Por área: una marca cuenta para todos los que comparten el área." },
  vehiculo: { texto: "Vehículos", icono: Truck, ayuda: "Niveles, llantas y documentos del vehículo y el montacargas." },
};
const MOMENTOS: { valor: Momento; texto: string }[] = [
  { valor: "entrada", texto: "Entrada" }, { valor: "break1", texto: "Break 1" }, { valor: "break2", texto: "Break 2" },
];
const hora = new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit" });
const momentoAhora = (): Momento => { const h = new Date().getHours(); return h < 11 ? "entrada" : h < 15 ? "break1" : "break2"; };
const moverDia = (d: string, n: number) => { const x = new Date(d + "T12:00:00"); x.setDate(x.getDate() + n); return x.toLocaleDateString("en-CA"); };

/** Checklist diario pensado para el celular: un toque por persona. */
export default function Checklist() {
  const [params, setParams] = useSearchParams();
  const tipo = (params.get("tipo") as Tipo) ?? "celular";
  const [dia, setDia] = useState(hoyISO());
  const [momento, setMomento] = useState<Momento>(momentoAhora);
  const [todos, setTodos] = useState(false);
  const mom: Momento = tipo === "celular" ? momento : "";
  const clave = ["checklist", tipo, dia];
  useTiempoReal("objetivo_marcas", [clave]);

  const lista = useQuery({
    queryKey: clave,
    queryFn: () => q<Fila[]>(supabase.rpc("checklist_del_dia", { p_tipo: tipo, p_fecha: dia })),
  });
  const filas = lista.data ?? [];
  const principales = filas.filter((f) => f.en_plantilla);
  const visibles = todos || principales.length === 0 ? filas : principales;
  const marcaDe = (f: Fila) => f.marcas.find((m) => m.momento === mom);
  const marcados = visibles.filter((f) => marcaDe(f)).length;
  const fallas = visibles.filter((f) => marcaDe(f)?.cumplio === false).length;

  const marcar = useAccion((a: { f: Fila; cumplio: boolean; nota?: string }) => q(supabase.rpc("registrar_marca", {
    p_tipo: tipo, p_fecha: dia, p_empleado: a.f.empleado_id, p_area: a.f.area_id, p_momento: mom, p_cumplio: a.cumplio, p_nota: a.nota ?? null,
  })), { invalidar: [clave] });
  const restantes = visibles.filter((f) => !marcaDe(f) && !f.soy_yo);
  const todosCumplieron = useAccion(async () => {
    for (const f of restantes) {
      await q(supabase.rpc("registrar_marca", { p_tipo: tipo, p_fecha: dia, p_empleado: f.empleado_id, p_area: f.area_id, p_momento: mom, p_cumplio: true, p_nota: null }));
    }
  }, { exito: "Marcados como cumplió", invalidar: [clave] });

  const Icono = TIPOS[tipo].icono;
  return (
    <Pagina titulo="Checklist diario" ancho="max-w-2xl"
      descripcion="Marca quién cumplió. Cada marca guarda quién, cuándo y a quién; un día sin marca no cuenta en contra.">
      <div className="grid grid-cols-4 gap-1.5">
        {(Object.keys(TIPOS) as Tipo[]).map((t) => {
          const I = TIPOS[t].icono;
          return (
            <button key={t} onClick={() => setParams(t === "celular" ? {} : { tipo: t }, { replace: true })}
              className={cn("rounded-xl border px-1 py-2.5 flex flex-col items-center gap-1 text-xs font-medium transition",
                t === tipo ? "bg-marca text-white border-marca" : "bg-superficie border-borde text-tenue hover:text-texto")}>
              <I className="h-5 w-5" />{TIPOS[t].texto}
            </button>
          );
        })}
      </div>

      <div className="tarjeta p-3 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <button className="p-2 rounded-lg hover:bg-fondo text-tenue" onClick={() => setDia(moverDia(dia, -1))} aria-label="Día anterior"><ChevronLeft className="h-5 w-5" /></button>
          <label className="text-center">
            <span className="block font-medium">{dia === hoyISO() ? "Hoy" : fecha(dia)}</span>
            <input type="date" className="text-xs text-tenue bg-transparent text-center" value={dia} max={hoyISO()} onChange={(e) => e.target.value && setDia(e.target.value)} />
          </label>
          <button className="p-2 rounded-lg hover:bg-fondo text-tenue disabled:opacity-30" disabled={dia >= hoyISO()} onClick={() => setDia(moverDia(dia, 1))} aria-label="Día siguiente"><ChevronRight className="h-5 w-5" /></button>
        </div>
        {tipo === "celular" && (
          <div className="grid grid-cols-3 gap-1 rounded-lg bg-fondo p-1">
            {MOMENTOS.map((m) => (
              <button key={m.valor} onClick={() => setMomento(m.valor)}
                className={cn("rounded-md py-1.5 text-sm font-medium", m.valor === momento ? "bg-superficie shadow-tarjeta text-texto" : "text-tenue")}>{m.texto}</button>
            ))}
          </div>
        )}
        <p className="text-xs text-tenue flex gap-1.5"><Icono className="h-4 w-4 shrink-0" />{TIPOS[tipo].ayuda}</p>
      </div>

      {lista.error ? <ErrorCarga error={lista.error} /> : lista.isLoading ? <Cargando /> : filas.length === 0 ? (
        <div className="tarjeta"><Vacio icono={Icono} titulo="Nadie que marcar" texto="Cuando RRHH asigne puestos con este indicador, aquí aparece la gente. Las áreas de limpieza se dan de alta en Objetivos." /></div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="text-tenue cifra">{marcados} de {visibles.length} marcados{fallas > 0 && <span className="text-peligro"> · {fallas} no {fallas === 1 ? "cumplió" : "cumplieron"}</span>}</span>
            {restantes.length > 0 && (
              <Boton variante="secundario" tamano="sm" cargando={todosCumplieron.isPending} onClick={() => todosCumplieron.mutate(undefined)}>
                <Check className="h-4 w-4" /> Los {restantes.length} restantes cumplieron
              </Boton>
            )}
          </div>
          {/* pb-20: que la última fila quede arriba del botón flotante del asistente en el celular. */}
          <ul className="space-y-2 pb-20">
            {visibles.map((f) => <FilaMarca key={f.empleado_id ?? `a${f.area_id}`} f={f} marca={marcaDe(f)} marcar={marcar} />)}
          </ul>
          {principales.length > 0 && principales.length < filas.length && (
            <button className="w-full py-2 text-sm text-marca-texto" onClick={() => setTodos(!todos)}>
              {todos ? "Solo quienes lo tienen en sus objetivos" : `Mostrar a todos (${filas.length - principales.length} más, p. ej. el taller)`}
            </button>
          )}
        </>
      )}
    </Pagina>
  );
}

function FilaMarca({ f, marca, marcar }: {
  f: Fila; marca: Marca | undefined;
  marcar: { mutate: (a: { f: Fila; cumplio: boolean; nota?: string }) => void; isPending: boolean; variables?: { f: Fila } };
}) {
  const [nota, setNota] = useState<string | null>(null);
  const ocupado = marcar.isPending && marcar.variables?.f === f;
  const quien = useMemo(() => marca && `${marca.por ?? ""} · ${hora.format(new Date(marca.en))}`, [marca]);
  function guardarNota(ev: FormEvent) { ev.preventDefault(); marcar.mutate({ f, cumplio: false, nota: nota ?? "" }); setNota(null); }
  return (
    <li className={cn("tarjeta p-3", marca?.cumplio === false && "border-peligro/40")}>
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium truncate">{f.nombre}{f.soy_yo && <span className="text-xs text-tenue font-normal"> (tú)</span>}</p>
          <p className="text-xs text-tenue truncate">
            {marca ? <>{marca.cumplio ? "Cumplió" : "No cumplió"} · {quien}{marca.nota && ` · “${marca.nota}”`}</> : f.puesto ?? (f.area_id ? "Área" : "Sin marcar")}
          </p>
        </div>
        {f.soy_yo ? <span className="text-xs text-tenue">Te marca otra persona</span> : (
          <div className="flex gap-2 shrink-0">
            <button aria-label={`${f.nombre}: no cumplió`} disabled={ocupado}
              onClick={() => { marcar.mutate({ f, cumplio: false }); setNota(marca?.nota ?? ""); }}
              className={cn("h-11 w-11 rounded-xl border flex items-center justify-center transition",
                marca?.cumplio === false ? "bg-peligro text-white border-peligro" : "border-borde text-tenue hover:text-peligro")}>
              <X className="h-5 w-5" />
            </button>
            <button aria-label={`${f.nombre}: cumplió`} disabled={ocupado}
              onClick={() => { marcar.mutate({ f, cumplio: true }); setNota(null); }}
              className={cn("h-11 w-11 rounded-xl border flex items-center justify-center transition",
                marca?.cumplio === true ? "bg-ok text-white border-ok" : "border-borde text-tenue hover:text-ok")}>
              <Check className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>
      {nota != null && (
        <form onSubmit={guardarNota} className="mt-2 flex gap-2">
          <Entrada autoFocus value={nota} onChange={(e) => setNota(e.target.value)} placeholder="¿Qué pasó? (opcional; Enter guarda)" />
          <Boton type="submit" tamano="sm" variante="secundario">Guardar</Boton>
        </form>
      )}
    </li>
  );
}

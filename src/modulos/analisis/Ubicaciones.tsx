import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Command } from "cmdk";
import * as P from "@radix-ui/react-popover";
import { Check, ChevronsUpDown, Loader2, MapPin, MapPinOff, Undo2, Users } from "lucide-react";
import { TablaDatos, Filtro, type Columna } from "@/components/datos/TablaDatos";
import { Cargando, ErrorCarga } from "@/components/ui/estados";
import { Boton } from "@/components/ui/boton";
import { Insignia, type Tono } from "@/components/ui/insignia";
import { Lateral } from "@/components/ui/dialogo";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { useSesion } from "@/lib/sesion";
import { dinero, dineroCompacto, fecha, numero, porcentaje } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { Cifra } from "./comun";

interface Grupo {
  estado_texto: string | null; ciudad_texto: string | null; estado_norm: string; ciudad_norm: string;
  cve_ent: string | null; estado: string | null; cvegeo: string | null; municipio: string | null;
  clientes: number; monto: number; motivo: string;
  sugerencias: { cvegeo: string; nombre: string; estado: string }[];
}
interface Alias { id: number; estado_texto: string | null; ciudad_texto: string | null; cvegeo: string | null; municipio: string | null; cve_ent: string | null; estado: string | null; no_ubicable: boolean; por: string | null; en: string; clientes: number }
interface DatosUbicaciones {
  cobertura: { total: number; estado: number; municipio: number; extranjero: number; pct_estado: number | null; pct_municipio: number | null; clientes: number; clientes_estado: number; clientes_municipio: number };
  grupos: Grupo[];
  alias: Alias[];
}
interface Municipio { cvegeo: string; cve_ent: string; nombre: string; estado: string }

const MOTIVO: Record<string, { texto: string; tono: Tono; grupo: Vista }> = {
  sin_estado: { texto: "Estado no reconocido", tono: "peligro", grupo: "resolver" },
  ciudad_no_reconocida: { texto: "Ciudad no reconocida", tono: "aviso", grupo: "resolver" },
  sin_ciudad: { texto: "Sin ciudad", tono: "neutro", grupo: "ficha" },
  parecido: { texto: "Parecido: confirmar", tono: "info", grupo: "confirmar" },
  otro_estado: { texto: "La ciudad es de otro estado", tono: "info", grupo: "confirmar" },
  ciudad: { texto: "Estado deducido de la ciudad", tono: "info", grupo: "confirmar" },
  aproximado: { texto: "Nombre corto o largo", tono: "ok", grupo: "aproximadas" },
};
type Vista = "resolver" | "confirmar" | "ficha" | "aproximadas" | "corregidas";
// Sin ciudad (o sin nada) no hay texto que corregir con un alias: se arregla en la ficha del cliente.
const soloFicha = (g: Grupo) => (!g.estado_norm && !g.ciudad_norm) || g.motivo === "sin_ciudad";
const vistaDe = (g: Grupo): Vista => soloFicha(g) ? "ficha" : MOTIVO[g.motivo]?.grupo ?? "resolver";

export default function Ubicaciones() {
  const { puede } = useSesion();
  const esDireccion = puede("analisis", 3);
  const u = useQuery({ queryKey: ["analisis_ubicaciones"], queryFn: () => q<DatosUbicaciones>(supabase.rpc("analisis_ubicaciones")) });
  const [vista, setVista] = useState<Vista>("resolver");
  const [verClientes, setVerClientes] = useState<Grupo | null>(null);
  const invalidar = [["analisis_ubicaciones"], ["analisis_mapa"], ["analisis_zonas_frias"], ["analisis_producto_region"], ["analisis_planeacion"]];

  const corregir = useAccion(
    (a: { g: { estado_texto: string | null; ciudad_texto: string | null }; cvegeo?: string | null; no_ubicable?: boolean }) =>
      q<number>(supabase.rpc("corregir_ubicacion", { p_estado: a.g.estado_texto ?? "", p_ciudad: a.g.ciudad_texto ?? "", p_cvegeo: a.cvegeo ?? null, p_cve_ent: null, p_no_ubicable: a.no_ubicable ?? false })),
    { exito: (n) => `Listo: ${numero(n)} ${n === 1 ? "cliente quedó ubicado" : "clientes quedaron ubicados"}`, invalidar });
  const quitar = useAccion((id: number) => q<number>(supabase.rpc("quitar_alias_ubicacion", { p_id: id })),
    { exito: "Corrección quitada: se volvieron a ubicar con el nombre escrito", invalidar });

  const grupos = useMemo(() => (u.data?.grupos ?? []).filter((g) => vistaDe(g) === vista), [u.data, vista]);
  const cuenta = (v: Vista) => v === "corregidas" ? (u.data?.alias.length ?? 0) : (u.data?.grupos ?? []).filter((g) => vistaDe(g) === v).length;

  if (u.error) return <ErrorCarga error={u.error} />;
  if (!u.data) return <Cargando filas={8} />;
  const c = u.data.cobertura;

  const columnas: Columna<Grupo>[] = [
    { clave: "estado_texto", titulo: "Estado escrito", valor: (g) => g.estado_texto ?? "", celda: (g) => g.estado_texto || <span className="text-tenue italic">vacío</span> },
    { clave: "ciudad_texto", titulo: "Ciudad escrita", valor: (g) => g.ciudad_texto ?? "", celda: (g) => g.ciudad_texto || <span className="text-tenue italic">vacía</span> },
    { clave: "motivo", titulo: "Qué pasa", valor: (g) => MOTIVO[g.motivo]?.texto ?? g.motivo,
      celda: (g) => <Insignia tono={MOTIVO[g.motivo]?.tono ?? "neutro"}>{!g.estado_norm && !g.ciudad_norm ? "Sin estado ni ciudad" : MOTIVO[g.motivo]?.texto ?? g.motivo}</Insignia> },
    { clave: "clientes", titulo: "Clientes", alinear: "der", sinBusqueda: true,
      celda: (g) => <button type="button" className="text-marca-texto hover:underline cifra" onClick={(e) => { e.stopPropagation(); setVerClientes(g); }}>{numero(g.clientes)}</button> },
    { clave: "monto", titulo: "Vendido", alinear: "der", celda: (g) => dineroCompacto(g.monto), sinBusqueda: true },
    { clave: "ubicado", titulo: "Hoy queda en", valor: (g) => [g.municipio, g.estado].filter(Boolean).join(", "),
      celda: (g) => g.municipio ? <span>{g.municipio}, <span className="text-tenue">{g.estado}</span></span> : g.estado ? <span className="text-tenue">Solo {g.estado}</span> : <span className="text-tenue">—</span> },
    { clave: "accion", titulo: esDireccion ? "Municipio correcto" : "", sinBusqueda: true, clase: "min-w-[260px]",
      celda: (g) => !esDireccion ? null : soloFicha(g) ? (
        <Boton tamano="sm" variante="secundario" onClick={() => setVerClientes(g)}><Users className="h-4 w-4" /> Ver clientes</Boton>
      ) : (
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          {(g.motivo === "parecido" || g.motivo === "otro_estado" || g.motivo === "ciudad" || g.motivo === "aproximado") && g.cvegeo && (
            <Boton tamano="sm" variante="secundario" title={`Confirmar ${g.municipio}`} aria-label={`Confirmar ${g.municipio}`}
              onClick={() => corregir.mutate({ g, cvegeo: g.cvegeo })}><Check className="h-4 w-4" /></Boton>
          )}
          <SelectorMunicipio cveEnt={g.motivo === "otro_estado" ? null : g.cve_ent} sugerencias={g.sugerencias}
            alElegir={(m) => corregir.mutate({ g, cvegeo: m.cvegeo })} />
          <button type="button" className="text-xs text-tenue hover:text-texto whitespace-nowrap" title="No se puede ubicar (p. ej. «Varios»): deja de salir aquí"
            onClick={() => corregir.mutate({ g, no_ubicable: true })}>No se puede</button>
        </div>
      ) },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-2 xl:grid-cols-4">
        <Cifra titulo="Venta ubicada en un estado" valor={porcentaje(c.pct_estado, 1)} detalle={<>{dineroCompacto(c.estado)} de {dineroCompacto(c.total)} desde 2018</>} />
        <Cifra titulo="Venta ubicada en un municipio" valor={porcentaje(c.pct_municipio, 1)} detalle={<>{numero(c.clientes_municipio)} de {numero(c.clientes)} clientes</>} />
        <Cifra titulo="Exportación" valor={dineroCompacto(c.extranjero)} detalle={<>{porcentaje(c.total ? c.extranjero / c.total : null, 1)} de la venta, fuera de México</>} />
        <Cifra titulo="Sin estado" valor={dineroCompacto(c.total - c.estado - c.extranjero)} detalle={<>{numero(c.clientes - c.clientes_estado)} clientes no salen en el mapa</>} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Filtro valor={vista} alCambiar={setVista} opciones={[
          { valor: "resolver", texto: "Por resolver", cuenta: cuenta("resolver") },
          { valor: "confirmar", texto: "Por confirmar", cuenta: cuenta("confirmar") },
          { valor: "ficha", texto: "Falta el dato en la ficha", cuenta: cuenta("ficha") },
          { valor: "aproximadas", texto: "Ubicadas por aproximación", cuenta: cuenta("aproximadas") },
          { valor: "corregidas", texto: "Corregidas por dirección", cuenta: cuenta("corregidas") },
        ]} />
        <p className="text-xs text-tenue">Corregir una combinación ubica a todos los clientes que la escribieron igual, también a los que se den de alta después.</p>
      </div>

      {vista === "corregidas" ? (
        <TablaDatos filas={u.data.alias} claveFila={(a) => String(a.id)} exportarComo="ubicaciones-corregidas"
          vacio={{ icono: MapPin, titulo: "Todavía no hay correcciones", texto: "Las que hagas en «Por resolver» quedan aquí, por si hay que deshacer alguna." }}
          columnas={[
            { clave: "estado_texto", titulo: "Estado escrito", valor: (a) => a.estado_texto ?? "" },
            { clave: "ciudad_texto", titulo: "Ciudad escrita", valor: (a) => a.ciudad_texto ?? "" },
            { clave: "municipio", titulo: "Quedó en", valor: (a) => a.no_ubicable ? "No se puede ubicar" : [a.municipio, a.estado].filter(Boolean).join(", ") },
            { clave: "clientes", titulo: "Clientes", alinear: "der", sinBusqueda: true },
            { clave: "por", titulo: "Quién", valor: (a) => a.por ?? "" },
            { clave: "en", titulo: "Cuándo", valor: (a) => a.en, celda: (a) => fecha(a.en) },
            ...(esDireccion ? [{ clave: "q", titulo: "", sinBusqueda: true, celda: (a: Alias) => (
              <button type="button" className="inline-flex items-center gap-1 text-xs text-tenue hover:text-peligro" onClick={() => quitar.mutate(a.id)}><Undo2 className="h-3.5 w-3.5" /> Deshacer</button>
            ) } as Columna<Alias>] : []),
          ]} />
      ) : (
        <TablaDatos filas={grupos} columnas={columnas} claveFila={(g) => `${g.estado_norm}|${g.ciudad_norm}`} exportarComo={`ubicaciones-${vista}`}
          placeholder="Buscar estado o ciudad…" limite={100}
          vacio={{ icono: MapPinOff, titulo: "Nada pendiente aquí", texto: "Todas las combinaciones de esta lista ya están ubicadas." }} />
      )}
      {!esDireccion && <p className="text-xs text-tenue">Solo dirección corrige ubicaciones; aquí se ve qué falta.</p>}

      <ClientesDeGrupo grupo={verClientes} alCerrar={() => setVerClientes(null)} />
    </div>
  );
}

/** Elegir el municipio escribiendo: dentro del estado ya reconocido, o en todo el país. */
function SelectorMunicipio({ cveEnt, sugerencias, alElegir }: { cveEnt: string | null; sugerencias: Grupo["sugerencias"]; alElegir: (m: Municipio) => void }) {
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const [res, setRes] = useState<Municipio[]>([]);
  const [cargando, setCargando] = useState(false);
  useEffect(() => {
    if (!abierto || texto.trim().length < 2) { setRes([]); return; }
    setCargando(true);
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc("buscar_municipio", { p_q: texto, p_cve_ent: cveEnt, p_limite: 12 });
      setRes((data as Municipio[]) ?? []);
      setCargando(false);
    }, 150);
    return () => clearTimeout(t);
  }, [texto, abierto, cveEnt]);
  const opciones: Municipio[] = texto.trim().length >= 2 ? res : sugerencias.map((s) => ({ cvegeo: s.cvegeo, nombre: s.nombre, estado: s.estado, cve_ent: s.cvegeo.slice(0, 2) }));
  return (
    <P.Root open={abierto} onOpenChange={setAbierto}>
      <P.Trigger asChild>
        <button type="button" className="campo h-8 flex items-center justify-between gap-2 text-left text-xs min-w-[170px]">
          <span className="text-tenue truncate">Elegir municipio…</span><ChevronsUpDown className="h-3.5 w-3.5 text-tenue shrink-0" />
        </button>
      </P.Trigger>
      <P.Portal>
        <P.Content align="end" sideOffset={4} className="z-50 w-[320px] tarjeta shadow-xl overflow-hidden">
          <Command shouldFilter={false} loop>
            <div className="flex items-center gap-2 px-3 border-b border-borde">
              {cargando ? <Loader2 className="h-4 w-4 animate-spin text-tenue" /> : <MapPin className="h-4 w-4 text-tenue" />}
              <Command.Input autoFocus value={texto} onValueChange={setTexto} placeholder={cveEnt ? "Municipio del estado…" : "Municipio (todo el país)…"} className="h-10 flex-1 bg-transparent outline-none text-sm" />
            </div>
            <Command.List className="max-h-[280px] overflow-y-auto p-1">
              {texto.trim().length < 2 && opciones.length > 0 && <p className="px-2 pt-1 pb-0.5 text-[11px] text-tenue">Los que más se parecen</p>}
              {opciones.map((m) => (
                <Command.Item key={m.cvegeo} value={m.cvegeo} onSelect={() => { alElegir(m); setAbierto(false); setTexto(""); }}
                  className="rounded-lg px-2 py-1.5 cursor-pointer data-[selected=true]:bg-marca-suave">
                  <p className="text-sm">{m.nombre}</p>
                  <p className="text-[11px] text-tenue">{m.estado} · {m.cvegeo}</p>
                </Command.Item>
              ))}
              {!cargando && texto.trim().length >= 2 && res.length === 0 && <p className="p-3 text-sm text-tenue text-center">Ningún municipio se llama así.</p>}
            </Command.List>
          </Command>
        </P.Content>
      </P.Portal>
    </P.Root>
  );
}

function ClientesDeGrupo({ grupo, alCerrar }: { grupo: Grupo | null; alCerrar: () => void }) {
  const lista = useQuery({
    queryKey: ["analisis_clientes_de_ubicacion", grupo?.estado_norm, grupo?.ciudad_norm],
    enabled: !!grupo,
    queryFn: () => q<{ id: string; nombre: string; vendedor: string | null; estado: string | null; ciudad: string | null; monto: number; ultima: string | null }[]>(
      supabase.rpc("analisis_clientes_de_ubicacion", { p_estado_norm: grupo!.estado_norm, p_ciudad_norm: grupo!.ciudad_norm, p_limite: 100 })),
  });
  const titulo = grupo ? [grupo.ciudad_texto, grupo.estado_texto].filter(Boolean).join(", ") || "Sin estado ni ciudad" : "";
  return (
    <Lateral abierto={!!grupo} alCambiar={(v) => !v && alCerrar()} titulo={titulo} subtitulo={grupo ? `${numero(grupo.clientes)} clientes · ${dinero(grupo.monto)} vendido` : undefined} ancho="max-w-xl">
      <p className="text-sm text-tenue mb-3">Abre la ficha de cada cliente para capturar su estado y ciudad; al guardar se ubica solo.</p>
      {lista.isLoading ? <Cargando filas={6} /> : (
        <ul className="divide-y divide-borde">
          {(lista.data ?? []).map((x) => (
            <li key={x.id} className="py-2 flex items-baseline gap-3">
              <Link to={`/ventas/clientes/${x.id}`} className="text-marca-texto hover:underline truncate">{x.nombre}</Link>
              <span className="text-xs text-tenue truncate">{x.vendedor ?? "Sin vendedor"}</span>
              <span className={cn("ml-auto text-sm cifra shrink-0", !x.monto && "text-tenue")}>{dineroCompacto(x.monto)}</span>
            </li>
          ))}
        </ul>
      )}
    </Lateral>
  );
}

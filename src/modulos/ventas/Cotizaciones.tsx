import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { FileText, Plus, ShieldCheck } from "lucide-react";
import { Pagina } from "@/components/layout/Shell";
import { TablaDatos, Filtro, type Columna } from "@/components/datos/TablaDatos";
import { Pestanas, ListaPestanas } from "@/components/ui/pestanas";
import { Boton } from "@/components/ui/boton";
import { Insignia } from "@/components/ui/insignia";
import { Vacio, Cargando } from "@/components/ui/estados";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { useSesion } from "@/lib/sesion";
import { dinero, fecha } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { ESTADO_COT, dineroEn, todas, type VCotizacion, haceCuanto } from "./comun";

const ABIERTAS = ["borrador", "por_autorizar", "autorizada", "enviada"];
type Pestana = "abiertas" | "por_autorizar" | "enviadas" | "aceptadas" | "todas";

/**
 * Registro de cotizaciones: lo que la hoja no tenía (cada plantilla pisaba la
 * anterior). Pestañas por estado, vencidas marcadas, y para la gerencia la
 * cola de autorización de precios con el botón a la mano.
 */
export default function Cotizaciones() {
  const { perfil, puede } = useSesion();
  const esGerente = puede("ventas", 3);
  const ir = useNavigate();
  const [params, setParams] = useSearchParams();
  const [vendedor, setVendedor] = useState<string>("todos");
  const [soloVencidas, setSoloVencidas] = useState(false);

  const lista = useQuery({
    queryKey: ["v_cotizaciones"],
    queryFn: () => todas<VCotizacion>((a, b) => supabase.from("v_cotizaciones").select("*").order("creado_en", { ascending: false }).order("id").range(a, b)),
  });
  const filas = lista.data ?? [];
  const porAutorizar = filas.filter((c) => c.estado === "por_autorizar");
  const pestana = (params.get("estado") as Pestana) ?? (esGerente && porAutorizar.some((c) => c.autorizacion_pedida_en) ? "por_autorizar" : "abiertas");

  const autorizar = useAccion(
    (id: string) => q(supabase.rpc("autorizar_cotizacion", { p_id: id })),
    { exito: "Precios autorizados: el vendedor ya puede enviarla", invalidar: [["v_cotizaciones"], ["indicadores"]] },
  );

  const visibles = useMemo(() => {
    let r = filas;
    if (vendedor !== "todos") r = r.filter((c) => c.vendedor_id === vendedor);
    if (pestana === "abiertas") r = r.filter((c) => ABIERTAS.includes(c.estado) && (esGerente || c.vendedor_id === perfil?.id));
    if (pestana === "por_autorizar") r = r.filter((c) => c.estado === "por_autorizar");
    if (pestana === "enviadas") r = r.filter((c) => c.estado === "enviada");
    if (pestana === "aceptadas") r = r.filter((c) => c.estado === "aceptada");
    if (soloVencidas) r = r.filter((c) => c.vencida);
    return r;
  }, [filas, vendedor, pestana, soloVencidas, esGerente, perfil?.id]);

  const vendedores = useMemo(() => {
    const m = new Map<string, string>();
    filas.forEach((c) => m.set(c.vendedor_id, c.vendedor));
    return [...m].sort((a, b) => a[1].localeCompare(b[1]));
  }, [filas]);
  const cuenta = (f: (c: VCotizacion) => boolean) => filas.filter((c) => (vendedor === "todos" || c.vendedor_id === vendedor) && f(c)).length;

  const columnas: Columna<VCotizacion>[] = [
    {
      clave: "folio", titulo: "Folio", valor: (c) => c.folio,
      celda: (c) => (
        <span className="whitespace-nowrap">
          <span className="font-medium cifra">{c.folio}</span>
          {c.iniciales && <span className="ml-1.5 text-[10px] font-bold text-tenue">{c.iniciales}</span>}
        </span>
      ),
    },
    { clave: "fecha", titulo: "Emisión", valor: (c) => c.fecha, celda: (c) => <span className="whitespace-nowrap">{fecha(c.fecha)}</span> },
    {
      clave: "cliente", titulo: "Cliente", valor: (c) => `${c.cliente ?? ""} ${c.atencion ?? ""} ${c.primera_partida ?? ""}`,
      celda: (c) => (
        <div className="min-w-[220px] max-w-[380px]">
          <p className="truncate font-medium">{c.cliente ?? c.empresa ?? c.atencion ?? <span className="text-tenue">Sin cliente</span>}</p>
          <p className="truncate text-xs text-tenue">{[c.atencion, c.primera_partida && `${c.primera_partida}${c.partidas > 1 ? ` +${c.partidas - 1}` : ""}`].filter(Boolean).join(" · ")}</p>
        </div>
      ),
    },
    { clave: "vendedor", titulo: "Vendedor", oculta: !esGerente, valor: (c) => c.vendedor },
    {
      clave: "estado", titulo: "Estado", valor: (c) => ESTADO_COT[c.estado].texto,
      celda: (c) => (
        <div className="flex flex-wrap gap-1">
          <Insignia tono={ESTADO_COT[c.estado].tono} punto>{ESTADO_COT[c.estado].texto}</Insignia>
          {c.vencida && <Insignia tono="peligro">Vencida</Insignia>}
          {c.estado === "por_autorizar" && c.autorizacion_pedida_en && <Insignia tono="aviso">pedida</Insignia>}
        </div>
      ),
    },
    {
      clave: "vence", titulo: "Vence", valor: (c) => c.vence,
      celda: (c) => <span className={cn("whitespace-nowrap", c.vencida && "text-peligro font-medium")}>{ABIERTAS.includes(c.estado) ? fecha(c.vence) : "—"}</span>,
    },
    {
      clave: "total", titulo: "Total", alinear: "der", sinBusqueda: true, valor: (c) => Number(c.total),
      celda: (c) => <span className="font-medium whitespace-nowrap">{dineroEn(Number(c.total), c.moneda)}</span>,
    },
  ];

  const sumaNeto = visibles.reduce((s, c) => s + Number(c.neto_mxn ?? 0), 0);

  return (
    <Pagina titulo="Cotizaciones" descripcion="Cada cotización con su folio, versión y estado. Ya no se pisa la anterior."
      acciones={<Boton onClick={() => ir("/ventas/cotizaciones/nueva")}><Plus className="h-4 w-4" />Nueva cotización</Boton>}>
      <Pestanas value={pestana} onValueChange={(v) => setParams(v === "abiertas" ? {} : { estado: v }, { replace: true })}>
        <ListaPestanas opciones={[
          { valor: "abiertas", texto: esGerente ? "Abiertas" : "Mías abiertas", cuenta: cuenta((c) => ABIERTAS.includes(c.estado) && (esGerente || c.vendedor_id === perfil?.id)) },
          ...(esGerente ? [{ valor: "por_autorizar", texto: "Por autorizar", cuenta: cuenta((c) => c.estado === "por_autorizar") }] : []),
          { valor: "enviadas", texto: "Enviadas", cuenta: cuenta((c) => c.estado === "enviada") },
          { valor: "aceptadas", texto: "Aceptadas", cuenta: cuenta((c) => c.estado === "aceptada") },
          { valor: "todas", texto: "Todas", cuenta: cuenta(() => true) },
        ]} />
      </Pestanas>

      {pestana === "por_autorizar" && esGerente ? (
        <ColaAutorizacion filas={visibles} cargando={lista.isLoading} alAutorizar={(id) => autorizar.mutate(id)} autorizando={autorizar.isPending ? autorizar.variables : null} />
      ) : (
        <TablaDatos
          filas={visibles} columnas={columnas} cargando={lista.isLoading} error={lista.error} claveFila={(c) => c.id}
          alClicFila={(c) => ir(`/ventas/cotizaciones/${c.id}`)} exportarComo="cotizaciones" placeholder="Folio, cliente, atención o partida…"
          claseFila={(c) => (c.vencida ? "bg-peligro-suave/30" : undefined)}
          filtros={
            <div className="flex flex-wrap items-center gap-2">
              {esGerente && vendedores.length > 1 && (
                <select className="campo h-8 w-auto pr-8 text-xs" value={vendedor} onChange={(e) => setVendedor(e.target.value)} aria-label="Vendedor">
                  <option value="todos">Todos los vendedores</option>
                  {vendedores.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
                </select>
              )}
              <Filtro opciones={[{ valor: "no", texto: "Todas" }, { valor: "si", texto: "Solo vencidas", cuenta: visibles.filter((c) => c.vencida).length || undefined }]}
                valor={soloVencidas ? "si" : "no"} alCambiar={(v) => setSoloVencidas(v === "si")} />
            </div>
          }
          vacio={{
            icono: FileText, titulo: pestana === "abiertas" ? "No tienes cotizaciones abiertas" : "Nada en esta pestaña",
            texto: "Una cotización nueva tarda segundos: elige cliente, escribe el equipo y Enter.",
            accion: <Boton onClick={() => ir("/ventas/cotizaciones/nueva")}><Plus className="h-4 w-4" />Nueva cotización</Boton>,
          }}
          pie={visibles.length > 0 && (
            <p className="text-sm text-tenue text-right">
              {visibles.length} cotizaciones · <b className="text-texto cifra">{dinero(sumaNeto)}</b> sin IVA (en pesos)
            </p>
          )}
        />
      )}
    </Pagina>
  );
}

/** La cola de la gerente: primero las que el vendedor ya pidió, con su explicación. */
function ColaAutorizacion({ filas, cargando, alAutorizar, autorizando }: {
  filas: VCotizacion[]; cargando: boolean; alAutorizar: (id: string) => void; autorizando: string | null | undefined;
}) {
  if (cargando) return <div className="tarjeta"><Cargando /></div>;
  if (!filas.length) {
    return <div className="tarjeta"><Vacio icono={ShieldCheck} titulo="Nada por autorizar" texto="Cuando un vendedor cotice abajo del precio mínimo y pida autorización, aparece aquí." /></div>;
  }
  const orden = [...filas].sort((a, b) => (a.autorizacion_pedida_en ? 0 : 1) - (b.autorizacion_pedida_en ? 0 : 1)
    || (a.autorizacion_pedida_en ?? a.actualizado_en).localeCompare(b.autorizacion_pedida_en ?? b.actualizado_en));
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {orden.map((c) => (
        <div key={c.id} className={cn("tarjeta p-4 flex flex-col gap-3", c.autorizacion_pedida_en ? "border-aviso/40" : "opacity-80")}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-tenue">{c.vendedor} · {c.autorizacion_pedida_en ? `pidió autorización ${haceCuanto(c.autorizacion_pedida_en)}` : "todavía capturando"}</p>
              <Link to={`/ventas/cotizaciones/${c.id}`} className="font-semibold hover:text-marca-texto">{c.folio} · {c.cliente ?? c.atencion ?? "Sin cliente"}</Link>
              <p className="text-sm text-tenue truncate">{c.primera_partida}{c.partidas > 1 ? ` y ${c.partidas - 1} más` : ""}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-lg font-semibold cifra">{dineroEn(Number(c.total), c.moneda)}</p>
              <Insignia tono="peligro">{c.partidas_bajo_minimo} bajo el mínimo</Insignia>
            </div>
          </div>
          {c.nota_autorizacion && <p className="rounded-lg bg-aviso-suave px-3 py-2 text-sm">“{c.nota_autorizacion}”</p>}
          <div className="flex gap-2 justify-end mt-auto">
            <Boton asChild variante="secundario" tamano="sm"><Link to={`/ventas/cotizaciones/${c.id}`}>Revisar partidas</Link></Boton>
            <Boton tamano="sm" onClick={() => alAutorizar(c.id)} cargando={autorizando === c.id}><ShieldCheck className="h-4 w-4" />Autorizar</Boton>
          </div>
        </div>
      ))}
    </div>
  );
}

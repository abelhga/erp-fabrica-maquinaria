import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, Inbox, PackageOpen, Plus, ShieldCheck, Truck, Wrench } from "lucide-react";
import { Pagina } from "@/components/layout/Shell";
import { Kpi } from "@/components/ui/kpi";
import { Boton } from "@/components/ui/boton";
import { Tarjeta, EncabezadoTarjeta } from "@/components/ui/tarjeta";
import { TablaDatos, Filtro, type Columna } from "@/components/datos/TablaDatos";
import { supabase } from "@/lib/supabase";
import { q } from "@/lib/consultas";
import { fecha, hace, numero } from "@/lib/formato";
import { CLAVE, ESTADO_SERVICIO, instanteMx, lunesDe, periodo, sumarDias, useServicioEnVivo, useServicios, type Material, type Servicio } from "./datos";
import { EnlaceBoton, InsigniaEstado, Tipo, usePermisosServicio } from "./componentes/piezas";
import { CalendarioCuadrillas } from "./componentes/CalendarioCuadrillas";
import { CargaSemanal } from "./componentes/CargaSemanal";
import { DialogoSolicitar } from "./componentes/DialogoSolicitar";
import { Entregar } from "./componentes/Materiales";

type Vista = "abiertos" | "solicitada" | "programada" | "en_curso" | "cerrada" | "todos";

/**
 * Tablero de servicio postventa: lo que se pidió y nadie ha programado, quién sale
 * a dónde (calendario de cuadrillas) y cuánto le quita eso al taller cada semana.
 */
export default function Servicios() {
  useServicioEnVivo();
  const ir = useNavigate();
  const p = usePermisosServicio();
  const [params, setParams] = useSearchParams();
  const servicios = useServicios();
  const [vista, setVista] = useState<Vista>((params.get("vista") as Vista) ?? "abiertos");
  const [pidiendo, setPidiendo] = useState(params.get("nuevo") === "1");
  const porSurtir = useQuery({
    queryKey: [...CLAVE, "por_surtir"],
    enabled: p.almacen,
    queryFn: () => q<Material[]>(supabase.from("v_servicio_materiales").select("*").in("estado", ["pendiente", "en_compra"]).order("pedido_en")),
  });

  const lista = servicios.data ?? [];
  const semana = lunesDe(new Date());
  const lunes = instanteMx(semana, "00:00"), domingo = instanteMx(sumarDias(semana, 7), "00:00");
  const solicitadas = lista.filter((s) => s.estado === "solicitada");
  const estaSemana = lista.filter((s) => (s.estado === "programada" || s.estado === "en_curso") && s.inicio && new Date(s.inicio) < domingo && new Date(s.fin ?? s.inicio) >= lunes);
  const enCurso = lista.filter((s) => s.estado === "en_curso");
  const garantias = lista.filter((s) => s.tipo === "garantia" && !["cerrada", "cancelada"].includes(s.estado));
  const masVieja = solicitadas.reduce<Servicio | null>((m, s) => (!m || s.solicitado_en < m.solicitado_en ? s : m), null);

  const filtradas = useMemo(() => lista.filter((s) =>
    vista === "todos" ? true : vista === "abiertos" ? !["cerrada", "cancelada"].includes(s.estado) : s.estado === vista), [lista, vista]);

  const columnas: Columna<Servicio>[] = [
    { clave: "folio", titulo: "Folio", celda: (s) => <span className="cifra font-medium whitespace-nowrap">{s.folio}</span> },
    { clave: "tipo", titulo: "Tipo", valor: (s) => s.tipo_nombre, celda: (s) => <Tipo tipo={s.tipo} /> },
    { clave: "cliente", titulo: "Cliente", celda: (s) => (
      <div className="min-w-[180px]"><p className="leading-tight">{s.cliente}</p>
        <p className="text-xs text-tenue truncate max-w-[240px]">{[s.numero_serie, s.equipo, s.lugar].filter(Boolean).join(" · ") || s.descripcion}</p></div>
    ) },
    { clave: "inicio", titulo: "Cuándo", valor: (s) => s.inicio ?? `~${s.solicitado_en}`, celda: (s) => s.inicio ? (
      // Inicio y fin en dos renglones: así cabe la tabla completa en una laptop.
      <span className="text-sm whitespace-nowrap">
        {periodo(s.inicio, s.fin).split(" → ").map((x, i) => <span key={i} className={i ? "block text-tenue" : "block"}>{i ? `→ ${x}` : x}</span>)}
      </span>
    ) : (
      <span className="text-sm text-aviso whitespace-nowrap">Sin fecha · pedido {hace(s.solicitado_en)}</span>
    ) },
    { clave: "cuadrilla", titulo: "Cuadrilla", valor: (s) => s.cuadrilla.map((c) => c.nombre).join(", "),
      celda: (s) => s.cuadrilla.length ? (
        <span className="text-sm whitespace-nowrap" title={s.cuadrilla.map((c) => c.nombre).join("\n")}>
          {s.cuadrilla[0].nombre.split(" ").slice(0, 2).join(" ")}
          {s.cuadrilla.length > 1 && <span className="text-tenue"> +{s.cuadrilla.length - 1}</span>}
        </span>
      ) : <span className="text-tenue">—</span> },
    { clave: "estado", titulo: "Estado", valor: (s) => ESTADO_SERVICIO[s.estado].texto, celda: (s) => <InsigniaEstado estado={s.estado} /> },
  ];

  const cuenta = (v: Vista) => (v === "todos" ? lista.length : v === "abiertos" ? lista.filter((s) => !["cerrada", "cancelada"].includes(s.estado)).length : lista.filter((s) => s.estado === v).length);

  return (
    <Pagina
      titulo="Servicio postventa"
      descripcion="Instalaciones, puestas en marcha, garantías y reparaciones: quién sale, a dónde y cuánto le quita al taller."
      ancho="max-w-[1500px]"
      acciones={<>
        {p.personal && <EnlaceBoton a="/servicio/maquinas"><Wrench className="h-4 w-4" />Máquinas y herramienta</EnlaceBoton>}
        {p.pedir && <Boton onClick={() => setPidiendo(true)}><Plus className="h-4 w-4" />Pedir servicio</Boton>}
      </>}
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi titulo="Por programar" valor={numero(solicitadas.length)} icono={Inbox} tono={solicitadas.length ? "aviso" : "ok"}
             detalle={masVieja ? `El más viejo: ${masVieja.cliente}, ${hace(masVieja.solicitado_en)}` : "Nada esperando fecha"}
             alClic={() => setVista("solicitada")} />
        <Kpi titulo="Esta semana" valor={numero(estaSemana.length)} icono={CalendarClock} tono="marca"
             detalle={`${estaSemana.reduce((s, x) => s + x.cuadrilla.length, 0)} personas fuera del taller en algún momento`} alClic={() => setVista("programada")} />
        <Kpi titulo="En curso" valor={numero(enCurso.length)} icono={Truck} tono="info"
             detalle={enCurso[0] ? `${enCurso[0].cliente}${enCurso[0].lugar ? ` · ${enCurso[0].lugar}` : ""}` : "Nadie en campo ahora"} alClic={() => setVista("en_curso")} />
        <Kpi titulo="Garantías abiertas" valor={numero(garantias.length)} icono={ShieldCheck} tono={garantias.length ? "aviso" : "ok"}
             detalle={garantias.length ? `${garantias.filter((g) => g.estado === "solicitada").length} sin fecha todavía` : "Ninguna"} />
      </div>

      <CalendarioCuadrillas />

      <TablaDatos
        filas={filtradas} columnas={columnas} cargando={servicios.isLoading} error={servicios.error}
        claveFila={(s) => s.id} alClicFila={(s) => ir(`/servicio/${s.id}`)} exportarComo="servicios"
        placeholder="Folio, cliente, equipo, serie…"
        filtros={<Filtro<Vista> valor={vista} alCambiar={(v) => { setVista(v); setParams((x) => { x.set("vista", v); return x; }, { replace: true }); }}
          opciones={(["abiertos", "solicitada", "programada", "en_curso", "cerrada", "todos"] as Vista[]).map((v) => ({
            valor: v, cuenta: cuenta(v),
            texto: v === "abiertos" ? "Abiertos" : v === "todos" ? "Todos" : ESTADO_SERVICIO[v].texto,
          }))} />}
        vacio={{ icono: Inbox, titulo: vista === "solicitada" ? "Nada por programar" : "No hay servicios aquí",
                 texto: p.pedir ? "Cuando un cliente pida una instalación, garantía o reparación, pídela aquí: le llega a producción con aviso." : undefined,
                 accion: p.pedir ? <Boton onClick={() => setPidiendo(true)}><Plus className="h-4 w-4" />Pedir servicio</Boton> : undefined }}
      />

      <div className="grid gap-4 xl:grid-cols-5 items-start">
        <CargaSemanal semanas={5} className={p.almacen ? "xl:col-span-3" : "xl:col-span-5"} />
        <div className={p.almacen ? "xl:col-span-2 space-y-4" : "hidden"}>
          {p.almacen && (porSurtir.data ?? []).length > 0 && (
            <Tarjeta>
              <EncabezadoTarjeta titulo="Por entregar de almacén" descripcion="Insumos de servicios y refacciones de mantenimiento" />
              <div className="px-3 pb-3 divide-y divide-borde/70">
                {porSurtir.data!.map((m) => (
                  <div key={m.id} className="py-2 flex flex-wrap items-center gap-2 justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-tight">{numero(m.cantidad)} {m.unidad} · {m.nombre}</p>
                      <p className="text-xs text-tenue">{m.folio} · {m.para} · {m.estado === "en_compra" ? `en compras ${m.requisicion_folio ?? ""}` : `pedido ${fecha(m.pedido_en)}`} · hay {numero(m.existencia_planta)}</p>
                    </div>
                    <Entregar m={m} />
                  </div>
                ))}
              </div>
            </Tarjeta>
          )}
          {p.almacen && (porSurtir.data ?? []).length === 0 && !porSurtir.isLoading && (
            <Tarjeta className="p-4 text-sm text-tenue flex items-center gap-2"><PackageOpen className="h-4 w-4" />Almacén no tiene insumos ni refacciones por entregar.</Tarjeta>
          )}
        </div>
      </div>

      {pidiendo && <DialogoSolicitar abierto={pidiendo} alCambiar={(v) => { setPidiendo(v); if (!v && params.get("nuevo")) setParams((x) => { x.delete("nuevo"); return x; }, { replace: true }); }} />}
    </Pagina>
  );
}

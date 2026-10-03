import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  AlarmClock, CheckCircle2, ClipboardList, Factory, Inbox, Monitor, PackageX, Plus, Search, Wrench, X,
} from "lucide-react";
import { Pagina } from "@/components/layout/Shell";
import { Kpi } from "@/components/ui/kpi";
import { Tarjeta, EncabezadoTarjeta } from "@/components/ui/tarjeta";
import { Boton } from "@/components/ui/boton";
import { Seleccion } from "@/components/ui/campo";
import { Cargando, ErrorCarga, Vacio } from "@/components/ui/estados";
import { useSesion } from "@/lib/sesion";
import { supabase } from "@/lib/supabase";
import { coincide, cn } from "@/lib/utilidades";
import { numero } from "@/lib/formato";
import { CLAVE, useEtapas, useEventos, useProduccionEnVivo, useTablero, type EstadoOP, type OrdenTablero } from "./componentes/datos";
import { TarjetaOrden } from "./componentes/TarjetaOrden";
import { BotonLink } from "./componentes/BotonLink";
import { CargaTaller } from "./componentes/CargaTaller";
import { FilaEvento } from "./componentes/piezas";
import { horas } from "./componentes/util";

const COLUMNAS: { estado: EstadoOP; titulo: string; ayuda: string }[] = [
  { estado: "planeada", titulo: "Planeada", ayuda: "Validando material" },
  { estado: "liberada", titulo: "Liberada", ayuda: "Lista para el taller" },
  { estado: "en_proceso", titulo: "En proceso", ayuda: "Alguna etapa empezó" },
  { estado: "terminada", titulo: "Terminada", ayuda: "Por entregar" },
];

type Vista = "todas" | "atrasadas" | "faltantes" | "en_proceso";

/** Orden dentro de cada columna: lo urgente y lo atrasado arriba. */
const prioridadDe = (o: OrdenTablero) => [o.prioridad, o.atrasada ? 0 : 1, o.dias_restantes ?? 9999] as const;
function comparar(a: OrdenTablero, b: OrdenTablero) {
  const x = prioridadDe(a), y = prioridadDe(b);
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return a.folio.localeCompare(b.folio);
}

export default function Gerencia() {
  const { puede } = useSesion();
  const ir = useNavigate();
  useProduccionEnVivo();
  const tablero = useTablero();
  const etapas = useEtapas();
  const eventos = useEventos(15);
  const inicioMes = useMemo(() => { const h = new Date(); return new Date(h.getFullYear(), h.getMonth(), 1).toISOString(); }, []);
  const terminadasMes = useQuery({
    queryKey: [...CLAVE, "terminadas_mes", inicioMes],
    queryFn: async () => {
      const { count, error } = await supabase.from("ordenes_produccion").select("id", { count: "exact", head: true })
        .gte("terminada_en", inicioMes).in("estado", ["terminada", "entregada"]);
      if (error) throw new Error(error.message);
      return count ?? 0;
    },
  });

  const [vista, setVista] = useState<Vista>("todas");
  const [texto, setTexto] = useState("");
  const [cliente, setCliente] = useState("");
  const [etapa, setEtapa] = useState("");
  const [ahora, setAhora] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setAhora(Date.now()), 30_000); return () => clearInterval(t); }, []);

  const ordenes = tablero.data ?? [];
  const abiertas = ordenes.filter((o) => o.estado !== "terminada");
  const clientes = useMemo(() => [...new Set(ordenes.map((o) => (o.para_stock ? "Para stock" : o.cliente ?? "")).filter(Boolean))].sort(), [ordenes]);

  const filtradas = ordenes.filter((o) => {
    if (vista === "atrasadas" && !o.atrasada) return false;
    if (vista === "faltantes" && !(o.materiales_faltantes > 0)) return false;
    if (vista === "en_proceso" && o.estado !== "en_proceso") return false;
    if (cliente && (o.para_stock ? "Para stock" : o.cliente) !== cliente) return false;
    if (etapa && !(o.etapas_activas.some((e) => String(e.id) === etapa) || String(o.siguiente_etapa_id) === etapa)) return false;
    if (texto && !coincide([o.folio, o.numero_serie, o.equipo, o.cliente, o.pedido_folio].filter(Boolean).join(" "), texto)) return false;
    return true;
  });
  const hayFiltro = vista !== "todas" || !!cliente || !!etapa || !!texto;
  const gestionar = puede("produccion", 3);

  return (
    <Pagina
      titulo="Gerencia de producción"
      descripcion={`${new Date().toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })} · ${abiertas.length} órdenes abiertas`}
      ancho="max-w-[1600px]"
      acciones={<>
        <BotonLink a="/piso" externo><Monitor className="h-4 w-4" />Pantalla de piso</BotonLink>
        <BotonLink a="/produccion/ordenes"><ClipboardList className="h-4 w-4" />Órdenes y material</BotonLink>
        {puede("produccion", 2) && <BotonLink a="/produccion/ordenes?nueva=pedido" variante="primario"><Plus className="h-4 w-4" />Nueva orden</BotonLink>}
      </>}
    >
      {tablero.error ? <ErrorCarga error={tablero.error} /> : tablero.isLoading ? <Cargando filas={6} /> : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <Kpi titulo="Órdenes abiertas" valor={numero(abiertas.length)} icono={Factory} tono="marca"
                 detalle={`${abiertas.filter((o) => o.estado === "planeada").length} planeadas · ${abiertas.filter((o) => o.estado === "liberada").length} liberadas`}
                 alClic={() => setVista("todas")} />
            <Kpi titulo="En proceso" valor={numero(abiertas.filter((o) => o.estado === "en_proceso").length)} icono={Wrench} tono="info"
                 detalle={`${abiertas.filter((o) => o.pausada).length} con una etapa pausada`} alClic={() => setVista("en_proceso")} />
            <Kpi titulo="Atrasadas" valor={numero(abiertas.filter((o) => o.atrasada).length)} icono={AlarmClock}
                 tono={abiertas.some((o) => o.atrasada) ? "peligro" : "ok"}
                 detalle={`${abiertas.filter((o) => !o.atrasada && o.dias_restantes != null && o.dias_restantes <= 3).length} vencen en 3 días o menos`}
                 alClic={() => setVista("atrasadas")} />
            <Kpi titulo="Con faltantes de material" valor={numero(abiertas.filter((o) => o.materiales_faltantes > 0).length)} icono={PackageX}
                 tono={abiertas.some((o) => o.faltantes_sin_pedir > 0) ? "peligro" : "aviso"}
                 detalle={`${abiertas.filter((o) => o.faltantes_sin_pedir > 0).length} con faltantes sin pedir a compras`}
                 alClic={() => setVista("faltantes")} />
            <Kpi titulo="Terminadas este mes" valor={numero(terminadasMes.data)} icono={CheckCircle2} tono="ok"
                 detalle={`${ordenes.filter((o) => o.estado === "terminada").length} esperan entrega`} />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px] max-w-sm">
              <Search className="h-4 w-4 text-tenue absolute left-3 top-1/2 -translate-y-1/2" />
              <input className="campo pl-9" placeholder="Folio, serie, equipo o cliente…" value={texto} onChange={(e) => setTexto(e.target.value)} aria-label="Buscar orden" />
            </div>
            <Seleccion className="w-auto min-w-[180px]" value={cliente} onChange={(e) => setCliente(e.target.value)} aria-label="Filtrar por cliente">
              <option value="">Todos los clientes</option>
              {clientes.map((c) => <option key={c} value={c}>{c}</option>)}
            </Seleccion>
            <Seleccion className="w-auto min-w-[160px]" value={etapa} onChange={(e) => setEtapa(e.target.value)} aria-label="Filtrar por etapa">
              <option value="">Todas las etapas</option>
              {(etapas.data ?? []).map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
            </Seleccion>
            {vista !== "todas" && (
              <span className="inline-flex items-center gap-1 h-8 rounded-full bg-marca-suave text-marca-texto px-3 text-xs font-medium">
                {vista === "atrasadas" ? "Solo atrasadas" : vista === "faltantes" ? "Solo con faltantes" : "Solo en proceso"}
              </span>
            )}
            {hayFiltro && (
              <Boton variante="fantasma" tamano="sm" onClick={() => { setVista("todas"); setTexto(""); setCliente(""); setEtapa(""); }}>
                <X className="h-3.5 w-3.5" />Quitar filtros
              </Boton>
            )}
            <span className="ml-auto text-sm text-tenue cifra">{filtradas.length} de {ordenes.length} órdenes</span>
          </div>

          {ordenes.length === 0 ? (
            <div className="tarjeta">
              <Vacio icono={Inbox} titulo="No hay órdenes de producción abiertas"
                     texto="Crea las órdenes de los pedidos confirmados o una orden para stock."
                     accion={puede("produccion", 2) && <BotonLink a="/produccion/ordenes?nueva=pedido" variante="primario">Crear órdenes</BotonLink>} />
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 items-start">
              {COLUMNAS.map((c) => {
                const lista = filtradas.filter((o) => o.estado === c.estado).sort(comparar);
                return (
                  <section key={c.estado} className="rounded-xl bg-fondo border border-borde/70 p-2" aria-label={c.titulo}>
                    <header className="flex items-baseline justify-between gap-2 px-1.5 pt-1 pb-2">
                      <div>
                        <h2 className="font-semibold text-sm">{c.titulo} <span className="text-tenue font-normal cifra">{lista.length}</span></h2>
                        <p className="text-xs text-tenue">{c.ayuda}</p>
                      </div>
                      {c.estado !== "terminada" && lista.length > 0 && (
                        <span className="text-xs text-tenue cifra" title="Horas pendientes de estas órdenes">
                          {horas(lista.reduce((s, o) => s + Number(o.horas_pendientes), 0))}
                        </span>
                      )}
                    </header>
                    <div className={cn("space-y-2 xl:max-h-[calc(100vh-17rem)] xl:min-h-[8rem] overflow-y-auto pr-0.5")}>
                      {lista.length === 0 ? (
                        <p className="text-xs text-tenue text-center py-6">{hayFiltro ? "Nada con estos filtros" : "Sin órdenes"}</p>
                      ) : lista.map((o) => <TarjetaOrden key={o.id} o={o} puedeGestionar={gestionar} />)}
                    </div>
                  </section>
                );
              })}
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-5">
            <CargaTaller className="lg:col-span-3" />
            <Tarjeta className="lg:col-span-2">
              <EncabezadoTarjeta titulo="Actividad reciente" descripcion="Lo que marcan el taller, almacén e ingeniería, en vivo" />
              <div className="px-3 pb-3 max-h-[380px] overflow-y-auto">
                {eventos.isLoading ? <Cargando filas={5} /> : (eventos.data ?? []).length === 0 ? (
                  <p className="text-sm text-tenue text-center py-8">Todavía no hay movimientos.</p>
                ) : eventos.data!.map((e) => (
                  <FilaEvento key={e.id} e={e} ahora={ahora} alClic={() => ir(`/produccion/ordenes/${e.orden_id}`)} />
                ))}
              </div>
            </Tarjeta>
          </div>
        </>
      )}
    </Pagina>
  );
}

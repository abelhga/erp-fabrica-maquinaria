import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, ShoppingCart } from "lucide-react";
import { Pagina } from "@/components/layout/Shell";
import { TablaDatos, Filtro, type Columna } from "@/components/datos/TablaDatos";
import { Boton } from "@/components/ui/boton";
import { Insignia } from "@/components/ui/insignia";
import { Dialogo } from "@/components/ui/dialogo";
import { Campo, Entrada, Seleccion } from "@/components/ui/campo";
import { supabase } from "@/lib/supabase";
import { mensajeError } from "@/lib/consultas";
import { useSesion } from "@/lib/sesion";
import { dinero, fecha } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { Barra } from "./componentes/campos";
import { DialogoCliente, ElegirCliente } from "./componentes/dialogos";
import { CANAL, ESTADO_PEDIDO, dineroEn, todas, useAncho, type Canal, type VPedido } from "./comun";

type Vista = "abiertos" | "entregados" | "cancelados" | "todos";
const ABIERTOS = ["confirmado", "en_produccion", "listo"];

/**
 * Pedidos de todos los canales: los que salen de una cotización y los de
 * Mercado Libre, sitio web o mostrador (con su número de venta). Con lo que
 * hoy se pregunta por WhatsApp: cuánto se ha cobrado y en qué va producción.
 */
export default function Pedidos() {
  const { puede } = useSesion();
  const ir = useNavigate();
  const [vista, setVista] = useState<Vista>("abiertos");
  const [canal, setCanal] = useState<"todos" | Canal>("todos");
  const [historicos, setHistoricos] = useState(false);
  const [alta, setAlta] = useState(false);
  // En el celular: pedido (con fecha y estado) y cliente (con total y saldo), sin desplazarse de lado.
  const angosta = !useAncho(640);

  const lista = useQuery({
    queryKey: ["v_pedidos"],
    queryFn: () => todas<VPedido & { historico: boolean }>((a, b) => supabase.from("v_pedidos").select("*").order("fecha", { ascending: false }).order("folio", { ascending: false }).range(a, b)),
  });
  const base = useMemo(() => (lista.data ?? []).filter((p) => (historicos || !p.historico) && (canal === "todos" || p.canal === canal)), [lista.data, historicos, canal]);
  const filas = useMemo(() => base.filter((p) =>
    vista === "abiertos" ? ABIERTOS.includes(p.estado) : vista === "entregados" ? p.estado === "entregado" : vista === "cancelados" ? p.estado === "cancelado" : true), [base, vista]);
  const cuenta = (f: (p: VPedido) => boolean) => base.filter(f).length;
  const hayHistoricos = (lista.data ?? []).some((p) => p.historico);

  const columnas: Columna<VPedido & { historico: boolean }>[] = [
    {
      clave: "folio", titulo: "Pedido", valor: (p) => `${p.folio} ${p.id_externo ?? ""} ${p.cotizacion_folio ?? ""}`,
      celda: (p) => (
        <div className="whitespace-nowrap">
          <p className="font-medium cifra">{p.folio}</p>
          <p className="text-[11px] text-tenue">{p.id_externo ? `#${p.id_externo}` : p.cotizacion_folio ?? (p.historico ? "histórico" : "")}</p>
          {angosta && (
            <div className="mt-1 flex flex-wrap items-center gap-1 text-[11px] text-tenue">
              {fecha(p.fecha)}
              <Insignia tono={ESTADO_PEDIDO[p.estado].tono}>{ESTADO_PEDIDO[p.estado].texto}</Insignia>
              {p.atrasado && <Insignia tono="peligro">atrasado</Insignia>}
            </div>
          )}
        </div>
      ),
    },
    {
      clave: "fecha", titulo: "Fecha / entrega", oculta: angosta, valor: (p) => p.fecha,
      celda: (p) => (
        <div className="whitespace-nowrap">
          <p>{fecha(p.fecha)}</p>
          {p.fecha_compromiso && p.estado !== "entregado" && p.estado !== "cancelado" && (
            <p className={cn("text-[11px]", p.atrasado ? "text-peligro font-medium" : "text-tenue")}>entrega {fecha(p.fecha_compromiso)}</p>
          )}
        </div>
      ),
    },
    {
      clave: "cliente", titulo: "Cliente", valor: (p) => `${p.cliente} ${CANAL[p.canal]}`,
      celda: (p) => (
        <div className={angosta ? "w-[150px]" : "max-w-[260px]"}>
          <p className="truncate">{p.cliente}</p>
          {angosta && (
            <p className="text-sm font-medium cifra">{dineroEn(Number(p.total), p.moneda)}
              {!p.historico && Number(p.saldo) > 0.5 && <span className="block text-[11px] font-normal text-aviso">saldo {dineroEn(Number(p.saldo), p.moneda)}</span>}
            </p>
          )}
          {p.canal !== "directo" && <Insignia className="mt-0.5" tono={p.canal === "mercadolibre" ? "aviso" : p.canal === "sitio_web" ? "info" : "neutro"}>{CANAL[p.canal]}</Insignia>}
        </div>
      ),
    },
    { clave: "vendedor", titulo: "Vendedor", valor: (p) => p.vendedor, oculta: angosta || (!puede("ventas", 3) && !puede("finanzas", 1) && !puede("produccion", 2)) },
    {
      clave: "estado", titulo: "Estado", oculta: angosta, valor: (p) => ESTADO_PEDIDO[p.estado].texto,
      celda: (p) => (
        <div className="flex flex-wrap gap-1">
          <Insignia tono={ESTADO_PEDIDO[p.estado].tono} punto>{ESTADO_PEDIDO[p.estado].texto}</Insignia>
          {p.atrasado && <Insignia tono="peligro">atrasado</Insignia>}
        </div>
      ),
    },
    {
      clave: "avance", titulo: "Producción", oculta: angosta, valor: (p) => p.avance ?? -1, sinBusqueda: true,
      celda: (p) => p.ordenes ? (
        <div className="w-28">
          <Barra valor={p.avance} tono={p.avance === 100 ? "ok" : "marca"} />
          <p className="text-[11px] text-tenue mt-0.5">{p.avance}% · {p.terminadas}/{p.ordenes} órdenes</p>
        </div>
      ) : <span className="text-tenue text-xs">—</span>,
    },
    { clave: "total", titulo: "Total", oculta: angosta, alinear: "der", sinBusqueda: true, valor: (p) => Number(p.total), celda: (p) => <span className="font-medium whitespace-nowrap">{dineroEn(Number(p.total), p.moneda)}</span> },
    {
      clave: "saldo", titulo: "Saldo", oculta: angosta, alinear: "der", sinBusqueda: true, valor: (p) => Number(p.saldo),
      celda: (p) => p.historico ? <span className="text-tenue text-xs">histórico</span> : (
        <div className="whitespace-nowrap">
          {Number(p.saldo) > 0.5 ? <p className="font-medium text-aviso">{dineroEn(Number(p.saldo), p.moneda)}</p> : <p className="text-ok text-xs font-medium">pagado</p>}
          {Number(p.cobrado) > 0 && Number(p.saldo) > 0.5 && <p className="text-[11px] text-tenue">cobrado {dineroEn(Number(p.cobrado), p.moneda)}</p>}
        </div>
      ),
    },
  ];

  const totalMxn = filas.reduce((s, p) => s + Number(p.total) * Number(p.tipo_cambio), 0);
  const saldoMxn = filas.reduce((s, p) => s + Number(p.saldo) * Number(p.tipo_cambio), 0);

  return (
    <Pagina titulo="Pedidos" ancho="max-w-[1500px]" descripcion="Cotizaciones aceptadas y ventas de Mercado Libre, sitio web y mostrador."
      acciones={puede("ventas", 2) && <Boton onClick={() => setAlta(true)}><Plus className="h-4 w-4" />Pedido sin cotización</Boton>}>
      <TablaDatos filas={filas} columnas={columnas} cargando={lista.isLoading} error={lista.error} claveFila={(p) => p.id}
        alClicFila={(p) => ir(`/ventas/pedidos/${p.id}`)} exportarComo="pedidos" placeholder="Folio, número de ML, cliente…"
        claseFila={(p) => (p.atrasado ? "bg-peligro-suave/30" : undefined)}
        filtros={
          <div className="flex flex-wrap items-center gap-2">
            <Filtro valor={vista} alCambiar={setVista} opciones={[
              { valor: "abiertos", texto: "Abiertos", cuenta: cuenta((p) => ABIERTOS.includes(p.estado)) },
              { valor: "entregados", texto: "Entregados", cuenta: cuenta((p) => p.estado === "entregado") },
              { valor: "cancelados", texto: "Cancelados", cuenta: cuenta((p) => p.estado === "cancelado") },
              { valor: "todos", texto: "Todos", cuenta: base.length },
            ]} />
            <select className="campo h-8 w-auto pr-8 text-xs" value={canal} onChange={(e) => setCanal(e.target.value as Canal | "todos")} aria-label="Canal">
              <option value="todos">Todos los canales</option>
              {Object.entries(CANAL).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
            </select>
            {hayHistoricos && (
              <label className="inline-flex items-center gap-1.5 text-xs text-tenue">
                <input type="checkbox" checked={historicos} onChange={(e) => setHistoricos(e.target.checked)} /> Incluir históricos de los paneles
              </label>
            )}
          </div>
        }
        vacio={{ icono: ShoppingCart, titulo: "Sin pedidos aquí", texto: "Los pedidos salen de “Convertir a pedido” en una cotización, o captura uno de Mercado Libre con su número de venta." }}
        pie={filas.length > 0 && <p className="text-sm text-tenue text-right">Total <b className="text-texto cifra">{dinero(totalMxn)}</b> · por cobrar <b className="text-aviso cifra">{dinero(saldoMxn)}</b> (en pesos)</p>}
      />
      <DialogoPedido abierto={alta} alCambiar={setAlta} alCrear={(id) => ir(`/ventas/pedidos/${id}`)} />
    </Pagina>
  );
}

/** Pedido sin cotización (Mercado Libre, sitio web, mostrador): las partidas se agregan en el detalle. */
function DialogoPedido({ abierto, alCambiar, alCrear }: { abierto: boolean; alCambiar: (v: boolean) => void; alCrear: (id: string) => void }) {
  const [cliente, setCliente] = useState<{ id: string; nombre: string } | null>(null);
  const [canal, setCanal] = useState<Canal>("mercadolibre");
  const [externo, setExterno] = useState("");
  const [compromiso, setCompromiso] = useState("");
  const [nuevo, setNuevo] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function crear() {
    if (!cliente) return;
    setGuardando(true);
    const id = crypto.randomUUID();
    const { error } = await supabase.from("pedidos").insert({
      id, cliente_id: cliente.id, canal, id_externo: externo.trim() || null, fecha_compromiso: compromiso || null,
    });
    setGuardando(false);
    if (error) return toast.error(/duplicate key.*canal/i.test(error.message) ? `Ya existe un pedido de ${CANAL[canal]} con el número ${externo}.` : mensajeError(error));
    alCambiar(false);
    alCrear(id);
  }

  return (
    <>
      <Dialogo abierto={abierto && nuevo == null} alCambiar={alCambiar} titulo="Pedido sin cotización"
        descripcion="Para ventas de Mercado Libre, sitio web o mostrador. Las partidas se agregan en el siguiente paso."
        pie={<><Boton variante="secundario" onClick={() => alCambiar(false)}>Cancelar</Boton><Boton onClick={crear} cargando={guardando} disabled={!cliente}>Crear y agregar partidas</Boton></>}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <span className="text-sm font-medium">Cliente</span>
            <ElegirCliente valor={cliente} alCambiar={(c) => setCliente(c ? { id: c.id, nombre: c.nombre } : null)} alNuevo={() => setNuevo("")} />
          </div>
          <Campo etiqueta="Canal">
            <Seleccion value={canal} onChange={(e) => setCanal(e.target.value as Canal)}>
              {Object.entries(CANAL).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
            </Seleccion>
          </Campo>
          <Campo etiqueta={canal === "mercadolibre" ? "Número de venta ML" : "Número externo"} ayuda="No se puede repetir dentro del mismo canal.">
            <Entrada value={externo} onChange={(e) => setExterno(e.target.value)} placeholder={canal === "mercadolibre" ? "2000009812345671" : "WEB-10472"} />
          </Campo>
          <Campo etiqueta="Fecha compromiso"><Entrada type="date" value={compromiso} onChange={(e) => setCompromiso(e.target.value)} /></Campo>
        </div>
      </Dialogo>
      <DialogoCliente abierto={nuevo != null} alCambiar={(v) => !v && setNuevo(null)} nombreInicial={nuevo ?? ""}
        alCrear={(c) => { setCliente({ id: c.id, nombre: c.nombre }); setNuevo(null); }} />
    </>
  );
}

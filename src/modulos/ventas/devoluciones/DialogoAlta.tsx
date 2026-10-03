import { useEffect, useRef, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { Dialogo } from "@/components/ui/dialogo";
import { Boton } from "@/components/ui/boton";
import { Campo, Entrada } from "@/components/ui/campo";
import { supabase } from "@/lib/supabase";
import { mensajeError, q, useAccion } from "@/lib/consultas";
import { fecha, hoyISO } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { CLAVE, TIPO_DEVOLUCION, type TipoDevolucion } from "@/modulos/almacen/envios/datos";

interface Venta { id: string; folio: string; canal: string; id_externo: string | null; cliente: string | null; fecha: string; estado: string; vendedor: string | null; partidas: string | null }

const CANAL: Record<string, string> = { mercadolibre: "Mercado Libre", sitio_web: "Sitio web", amazon: "Amazon", directo: "Directo", mostrador: "Mostrador", distribuidor: "Distribuidor" };
const MOTIVOS: Record<TipoDevolucion, string[]> = {
  devolucion: ["No era lo que esperaba", "Llegó dañado", "Llegó incompleto", "Medida equivocada", "Se arrepintió"],
  reclamo: ["Dice que llegó incompleta su compra", "Dice que no le llegó", "Producto dañado", "Producto distinto al publicado"],
  cancelacion: ["El comprador canceló", "Sin existencia", "Pago no acreditado"],
};

/** Hora límite "dentro de N horas", para el campo datetime-local en hora de la planta. */
function enHoras(h: number) {
  const d = new Date(Date.now() + h * 3_600_000);
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(d);
  const v = (t: string) => p.find((x) => x.type === t)?.value ?? "00";
  return `${v("year")}-${v("month")}-${v("day")}T${v("hour") === "24" ? "00" : v("hour")}:${v("minute")}`;
}

/**
 * Alta rápida desde el número de venta de Mercado Libre (o el folio del pedido):
 * el código de autorización y la fecha quedan en el registro, no en el chat.
 */
export function DialogoAlta({ abierto, alCambiar, alCrear }: { abierto: boolean; alCambiar: (v: boolean) => void; alCrear: (id: string) => void }) {
  const [texto, setTexto] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [ventas, setVentas] = useState<Venta[] | null>(null);
  const [venta, setVenta] = useState<Venta | null>(null);
  const [tipo, setTipo] = useState<TipoDevolucion>("devolucion");
  const [f, setF] = useState({ codigo: "", motivo: "", esperada: "", limite: "" });
  const entrada = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!abierto) return;
    setTexto(""); setVentas(null); setVenta(null); setTipo("devolucion"); setF({ codigo: "", motivo: "", esperada: "", limite: enHoras(24) });
  }, [abierto]);

  async function buscar() {
    if (!texto.trim()) return;
    setBuscando(true);
    try {
      const r = await q<Venta[]>(supabase.rpc("buscar_venta", { p_texto: texto.trim() }));
      setVentas(r);
      if (r.length === 1) setVenta(r[0]);
    } catch (e) {
      setVentas([]);
      toast.error(mensajeError(e));
    } finally { setBuscando(false); }
  }

  const crear = useAccion(() => q<string>(supabase.rpc("abrir_devolucion", {
    p_pedido: venta!.id, p_tipo: tipo, p_motivo: f.motivo.trim(), p_codigo: f.codigo.trim() || null,
    p_fecha_esperada: tipo === "devolucion" && f.esperada ? f.esperada : null,
    p_fecha_limite: tipo === "reclamo" && f.limite ? new Date(`${f.limite}:00-06:00`).toISOString() : null,
  })), { exito: tipo === "devolucion" ? "Devolución registrada: almacén ya sabe que viene" : tipo === "reclamo" ? "Reclamo registrado" : "Cancelación registrada", invalidar: [CLAVE],
    alTerminar: (id) => { alCambiar(false); alCrear(id); } });

  return (
    <Dialogo abierto={abierto} alCambiar={alCambiar} titulo="Nueva devolución o reclamo" ancho="max-w-xl"
      descripcion="Escribe el número de venta de Mercado Libre (o el folio del pedido) y Enter."
      pie={<><Boton variante="secundario" onClick={() => alCambiar(false)}>Cancelar</Boton>
        <Boton onClick={() => crear.mutate(undefined)} cargando={crear.isPending} disabled={!venta || f.motivo.trim().length < 3}>Registrar</Boton></>}>
      <div className="space-y-4">
        <form className="relative" onSubmit={(e) => { e.preventDefault(); buscar(); }}>
          {buscando ? <Loader2 className="h-4 w-4 text-tenue absolute left-3 top-1/2 -translate-y-1/2 animate-spin" />
            : <Search className="h-4 w-4 text-tenue absolute left-3 top-1/2 -translate-y-1/2" />}
          <input ref={entrada} autoFocus className="campo pl-9 cifra" value={texto} placeholder="2000012345678 o PED-2026-00123"
            onChange={(e) => { setTexto(e.target.value); setVenta(null); setVentas(null); }} />
        </form>
        {ventas && ventas.length === 0 && <p className="text-sm text-tenue">No encontré esa venta. Revisa el número, o puede ser de otro vendedor o no estar capturada todavía.</p>}
        {ventas && ventas.length > 1 && !venta && (
          <ul className="divide-y divide-borde rounded-xl border border-borde">
            {ventas.map((v) => (
              <li key={v.id}><button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-fondo" onClick={() => setVenta(v)}>
                <b className="cifra">{v.id_externo ? `#${v.id_externo}` : v.folio}</b> · {v.cliente} <span className="text-tenue">· {fecha(v.fecha)}</span>
              </button></li>
            ))}
          </ul>
        )}
        {venta && (
          <>
            <div className="rounded-xl border border-marca/30 bg-marca-suave px-3 py-2 text-sm">
              <p><b>{venta.cliente}</b> · <span className="cifra">{venta.folio}</span>{venta.id_externo && <span className="cifra"> · #{venta.id_externo}</span>}
                <span className="text-tenue"> · {CANAL[venta.canal] ?? venta.canal} · {fecha(venta.fecha)}{venta.vendedor && ` · ${venta.vendedor}`}</span></p>
              {venta.partidas && <p className="text-xs text-tenue mt-0.5">{venta.partidas}</p>}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(TIPO_DEVOLUCION) as TipoDevolucion[]).map((t) => (
                <button key={t} type="button" onClick={() => setTipo(t)} title={TIPO_DEVOLUCION[t].ayuda}
                  className={cn("rounded-lg border px-3 py-2 text-sm transition", tipo === t ? "border-marca bg-marca-suave text-marca-texto font-medium" : "border-borde hover:bg-fondo")}>
                  {TIPO_DEVOLUCION[t].texto}
                </button>
              ))}
            </div>
            <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); if (f.motivo.trim().length >= 3) crear.mutate(undefined); }}>
              <Campo etiqueta="Motivo" className="sm:col-span-2">
                <Entrada value={f.motivo} onChange={(e) => setF({ ...f, motivo: e.target.value })} placeholder="Lo que dice el cliente o Mercado Libre" />
              </Campo>
              <div className="sm:col-span-2 -mt-1 flex flex-wrap gap-1.5">
                {MOTIVOS[tipo].map((m) => (
                  <button key={m} type="button" onClick={() => setF({ ...f, motivo: m })} className="rounded-full border border-borde px-2.5 py-0.5 text-xs text-tenue hover:text-texto hover:bg-fondo">{m}</button>
                ))}
              </div>
              {tipo !== "cancelacion" && (
                <Campo etiqueta="Código de autorización"><Entrada className="cifra" value={f.codigo} onChange={(e) => setF({ ...f, codigo: e.target.value })} placeholder="El de Mercado Libre" /></Campo>
              )}
              {tipo === "devolucion" && (
                <Campo etiqueta="¿Cuándo llega?" ayuda="Si no se sabe, 3 días hábiles."><Entrada type="date" min={hoyISO()} value={f.esperada} onChange={(e) => setF({ ...f, esperada: e.target.value })} /></Campo>
              )}
              {tipo === "reclamo" && (
                <Campo etiqueta="Responder antes de" ayuda="La hora límite que da Mercado Libre."><Entrada type="datetime-local" value={f.limite} onChange={(e) => setF({ ...f, limite: e.target.value })} /></Campo>
              )}
              <button type="submit" className="hidden" />
            </form>
          </>
        )}
      </div>
    </Dialogo>
  );
}

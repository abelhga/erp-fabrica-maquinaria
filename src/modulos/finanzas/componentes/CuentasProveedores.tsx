import { useEffect, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Ban, ClipboardList, FilePlus2, Link2, Pencil, Trash2, Undo2, Users, Wallet } from "lucide-react";
import { TablaDatos, Filtro, type Columna } from "@/components/datos/TablaDatos";
import { Lateral } from "@/components/ui/dialogo";
import { Insignia } from "@/components/ui/insignia";
import { Boton } from "@/components/ui/boton";
import { Campo, Entrada, Seleccion } from "@/components/ui/campo";
import { Cargando } from "@/components/ui/estados";
import { useSesion } from "@/lib/sesion";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { dinero, fecha, hace, hoyISO } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { GLOSARIO } from "@/tutorial/glosario";
import {
  INVALIDAR_PROVEEDORES, SelectorCuenta, TIPO_ACREEDOR, Vencimiento, diasPara, esPrestamo, useCuentasDinero,
  type CuentaProveedor, type FacturaPendiente,
} from "./cuentas";
import { BotonRepetida, DialogoNoCuenta, InsigniaRepetida, type Ignorada } from "./Repetida";
import { SelectorProveedor } from "@/modulos/compras/componentes/comun";
import { DialogoLigarOrdenes } from "./ElegirOrdenes";

/**
 * Cuenta de cada proveedor: lo que venía en el libro de compras de la hoja más lo que se
 * registra en el ERP. Positivo: le debemos; negativo: anticipo o reembolso a favor.
 */
export function CuentasProveedores({ cuentas, cargando, error, alAbrir, vistaInicial = "debemos" }: {
  cuentas: CuentaProveedor[]; cargando: boolean; error: unknown; alAbrir: (llave: string) => void;
  vistaInicial?: "debemos" | "socios" | "favor" | "todos";
}) {
  const [vista, setVista] = useState(vistaInicial);
  useEffect(() => setVista(vistaInicial), [vistaInicial]);
  // Préstamos de socios y créditos de banco van aparte: no son deuda con proveedores.
  const debemos = cuentas.filter((f) => Number(f.saldo) > 1 && !esPrestamo(f.tipo_acreedor));
  const socios = cuentas.filter((f) => Number(f.saldo) > 1 && esPrestamo(f.tipo_acreedor));
  const favor = cuentas.filter((f) => Number(f.saldo) < -1);
  const suma = (fs: CuentaProveedor[]) => fs.reduce((s, f) => s + Number(f.saldo), 0);
  const filas = (vista === "debemos" ? debemos : vista === "socios" ? socios : vista === "favor" ? favor : cuentas).slice()
    .sort((a, b) => (vista === "favor" ? Number(a.saldo) - Number(b.saldo) : Number(b.saldo) - Number(a.saldo)));

  const columnas: Columna<CuentaProveedor>[] = [
    { clave: "nombre", titulo: "Proveedor", clase: "min-w-[200px] max-w-[340px]",
      celda: (f) => <div><p className="font-medium break-words">{f.nombre}</p>
        {(f.tipo_acreedor !== "proveedor" || f.categoria) && <p className="text-xs text-tenue">{f.tipo_acreedor !== "proveedor" ? TIPO_ACREEDOR[f.tipo_acreedor] : f.categoria}</p>}</div> },
    { clave: "saldo", titulo: "Saldo", alinear: "der", sinBusqueda: true, valor: (f) => Number(f.saldo), explica: GLOSARIO.saldoProveedor,
      celda: (f) => <b className={Number(f.saldo) < -1 ? "text-info" : ""}>{dinero(f.saldo)}</b> },
    { clave: "vencido", titulo: "Vencido", alinear: "der", sinBusqueda: true, valor: (f) => Number(f.vencido), explica: GLOSARIO.vencePago,
      celda: (f) => Number(f.vencido) > 1 ? <span className="text-peligro font-medium">{dinero(f.vencido)}</span> : <span className="text-tenue">—</span> },
    { clave: "proximo_vence", titulo: "Próximo vencimiento", sinBusqueda: true, valor: (f) => f.proximo_vence ?? "9999",
      celda: (f) => f.proximo_vence ? <Vencimiento vence={f.proximo_vence} /> : <span className="text-tenue">—</span> },
    { clave: "ultima_compra", titulo: "Última compra", sinBusqueda: true, celda: (f) => <span className="whitespace-nowrap">{fecha(f.ultima_compra)}</span> },
    { clave: "ultimo_pago", titulo: "Último pago", sinBusqueda: true, valor: (f) => f.ultimo_pago,
      celda: (f) => f.ultimo_pago ? <span className="whitespace-nowrap" title={fecha(f.ultimo_pago)}>{hace(f.ultimo_pago)}</span> : <span className="text-aviso text-xs">Nunca</span> },
  ];

  return (
    <TablaDatos filas={filas} columnas={columnas} cargando={cargando} error={error} claveFila={(f) => f.proveedor_llave}
      alClicFila={(f) => alAbrir(f.proveedor_llave)} exportarComo="cuentas-proveedores" placeholder="Buscar proveedor o categoría…"
      filtros={<Filtro valor={vista} alCambiar={setVista} opciones={[
        { valor: "debemos", texto: "Les debemos", cuenta: debemos.length },
        { valor: "socios", texto: "Socios y bancos", cuenta: socios.length },
        { valor: "favor", texto: "A nuestro favor", cuenta: favor.length },
        { valor: "todos", texto: "Todos", cuenta: cuentas.length },
      ]} />}
      pie={filas.length > 0 && <div className="flex justify-end gap-6 text-sm"><span className="text-tenue">Saldo de lo que se ve:</span><b className="cifra">{dinero(suma(filas))}</b></div>}
      vacio={{ icono: Users, titulo: vista === "favor" ? "Ningún saldo a favor" : vista === "socios" ? "Sin préstamos de socios ni créditos" : "No le debemos a nadie",
        texto: "Aquí aparece cada proveedor con lo que se le debe. Registra una compra con «Registrar compra o gasto» (arriba) y su cuenta empieza." }} />
  );
}

interface MovErp {
  id: string; proveedor_id: string; fecha: string; tipo: "compra" | "pago" | "reembolso_pendiente" | "reembolso_realizado"; monto: number; cuenta: string | null;
  factura: string | null; descripcion: string | null; categoria: string | null; vence_el: string | null; metodo_pago: string | null; en_hoja: boolean;
}
interface MovHoja { id: number; fecha: string; tipo: string; monto: number; cuenta: string | null; descripcion: string | null; factura: string | null }
interface Renglon {
  clave: string; fecha: string; tipo: string; resta: boolean; monto: number; cuenta: string | null; factura: string | null; descripcion: string | null; erp?: MovErp;
  hojaId?: number; repetida?: Ignorada;
}
const TIPO_ERP: Record<MovErp["tipo"], string> = { compra: "Compra", pago: "Pago", reembolso_pendiente: "Reembolso pendiente", reembolso_realizado: "Reembolso realizado" };
const RESTA_HOJA = new Set(["Pago", "Reembolso Pend."]);

/**
 * El panel de un proveedor: qué facturas se le deben y cuándo vencen, registrar un pago
 * (o una compra), y todos sus movimientos, los de la hoja y los del ERP juntos.
 */
export function PanelProveedor({ cuenta, facturas, alCerrar, alRegistrarCompra }: {
  cuenta: CuentaProveedor | null; facturas: FacturaPendiente[]; alCerrar: () => void; alRegistrarCompra: (p: { id: string; nombre: string }) => void;
}) {
  const { puede } = useSesion();
  const editable = puede("finanzas", 2);
  const llave = cuenta?.proveedor_llave;
  const [pagando, setPagando] = useState(false);
  useEffect(() => setPagando(false), [llave]);
  const cuentasDinero = useCuentasDinero();
  const nombreCuenta = (c: string | null) => (c ? cuentasDinero.data?.find((x) => x.clave === c)?.nombre ?? c : null);

  const prov = useQuery({
    queryKey: ["proveedores", "ficha", cuenta?.proveedor_id], enabled: !!cuenta?.proveedor_id,
    queryFn: () => q<{ dias_credito: number; rfc: string | null; datos_bancarios: string | null }>(
      supabase.from("proveedores").select("dias_credito, rfc, datos_bancarios").eq("id", cuenta!.proveedor_id!).single()),
  });
  const erp = useQuery({
    queryKey: ["v_movimientos_proveedor", llave], enabled: !!llave,
    queryFn: () => q<MovErp[]>(supabase.from("v_movimientos_proveedor").select("id, proveedor_id, fecha, tipo, monto, cuenta, factura, descripcion, categoria, vence_el, metodo_pago, en_hoja")
      .eq("proveedor_llave", llave!).order("fecha", { ascending: false })),
  });
  const hoja = useQuery({
    queryKey: ["historial_compras_hoja", llave], enabled: !!llave,
    queryFn: () => q<MovHoja[]>(supabase.from("historial_compras_hoja").select("id, fecha, tipo, monto, cuenta, descripcion, factura")
      .eq("proveedor_llave", llave!).order("fecha", { ascending: false }).order("id", { ascending: false }).limit(200)),
  });
  // Renglones de la hoja que finanzas marcó como repetidos o cancelados: se ven tachados y no cuentan.
  const repetidas = useQuery({
    queryKey: ["v_compras_hoja_ignoradas", llave, hoja.data?.length], enabled: editable && !!hoja.data?.length,
    queryFn: () => q<Ignorada[]>(supabase.from("v_compras_hoja_ignoradas").select("id, motivo, marcada_en, razon")
      .in("id", (hoja.data ?? []).filter((m) => m.tipo === "Compra" || m.tipo === "Pago").map((m) => m.id))),
  });
  // De qué orden de compra es cada compra del ERP (la categoría sale de sus partidas).
  const idsCompras = (erp.data ?? []).filter((m) => m.tipo === "compra").map((m) => m.id);
  const ligas = useQuery({
    queryKey: ["compra_oc", llave, idsCompras.join()], enabled: idsCompras.length > 0,
    queryFn: () => q<{ movimiento_id: string; orden_compra_id: string; como: "folio" | "a_mano"; ordenes_compra: { folio: string } | null }[]>(
      supabase.from("compra_oc").select("movimiento_id, orden_compra_id, como, ordenes_compra(folio)").in("movimiento_id", idsCompras) as never),
  });
  const ordenesDe = (id: string) => (ligas.data ?? []).filter((x) => x.movimiento_id === id);
  const [ligando, setLigando] = useState<MovErp | null>(null);
  const [noCuenta, setNoCuenta] = useState<Renglon | null>(null);
  const [ligarA, setLigarA] = useState<{ id: string; nombre: string } | null>(null);
  const ligar = useAccion(() => q<number>(supabase.rpc("ligar_hoja_proveedor", { p_llave: llave, p_proveedor: ligarA!.id })),
    { exito: (n) => `Ligada: ${n} renglones de la hoja quedaron con su proveedor`, invalidar: INVALIDAR_PROVEEDORES, alTerminar: () => setLigarA(null) });
  const porRepetida = new Map((repetidas.data ?? []).map((r) => [r.id, r]));
  const borrar = useAccion((id: string) => q(supabase.from("movimientos_proveedor").delete().eq("id", id)), { exito: "Movimiento borrado", invalidar: INVALIDAR_PROVEEDORES });
  const desmarcar = useAccion((id: number) => q(supabase.rpc("desmarcar_compra_repetida", { p_hoja_id: id })), { exito: "Vuelve a contar en el saldo", invalidar: INVALIDAR_PROVEEDORES });

  const renglones: Renglon[] = [
    ...(erp.data ?? []).map((m) => ({ clave: m.id, fecha: m.fecha, tipo: TIPO_ERP[m.tipo], resta: m.tipo === "pago" || m.tipo === "reembolso_pendiente",
      monto: Number(m.monto), cuenta: nombreCuenta(m.cuenta), factura: m.factura, descripcion: m.descripcion, erp: m })),
    ...(hoja.data ?? []).map((m) => ({ clave: `h${m.id}`, fecha: m.fecha, tipo: m.tipo, resta: RESTA_HOJA.has(m.tipo), monto: Number(m.monto), cuenta: m.cuenta,
      factura: m.factura, descripcion: m.descripcion, hojaId: m.id, repetida: porRepetida.get(m.id) })),
  ].sort((a, b) => b.fecha.localeCompare(a.fecha));
  const vencidas = facturas.filter((x) => (diasPara(x.vence_el) ?? 0) < 0);

  return (
    <Lateral abierto={!!cuenta} alCambiar={(v) => !v && alCerrar()} titulo={cuenta?.nombre ?? ""}
      acciones={editable && cuenta?.proveedor_id && (
        <Boton variante="secundario" onClick={() => alRegistrarCompra({ id: cuenta.proveedor_id!, nombre: cuenta.nombre })}><FilePlus2 className="h-4 w-4" /> Compra</Boton>
      )}
      subtitulo={cuenta && <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span>Saldo <b className="cifra text-texto">{dinero(cuenta.saldo)}</b></span>
        {Number(cuenta.vencido) > 1 && <span className="text-peligro">Vencido {dinero(cuenta.vencido)}</span>}
        {cuenta.tipo_acreedor !== "proveedor" && <Insignia tono="info">{TIPO_ACREEDOR[cuenta.tipo_acreedor]}</Insignia>}
        {cuenta.proveedor_id && prov.data && <Credito proveedorId={cuenta.proveedor_id} dias={prov.data.dias_credito} editable={editable} />}
      </div>}>
      {cuenta && editable && !cuenta.proveedor_id && (
        <div className="mb-5 rounded-lg border border-aviso/30 bg-aviso-suave p-3 text-sm space-y-2" data-explain={GLOSARIO.cuentaHojaSinLigar} data-explain-title="Sin proveedor del catálogo">
          <p className="text-aviso"><b>Esta cuenta de la hoja no está ligada a un proveedor del catálogo</b>, así que no se le puede registrar pago. Elige cuál es:</p>
          <div className="flex flex-wrap gap-2 items-center">
            <SelectorProveedor valor={ligarA} alCambiar={(p) => setLigarA({ id: p.id, nombre: p.nombre })} className="flex-1 min-w-[220px]" />
            <Boton tamano="sm" disabled={!ligarA} cargando={ligar.isPending} onClick={() => ligar.mutate(undefined)}><Link2 className="h-4 w-4" /> Ligar</Boton>
          </div>
          <p className="text-xs text-tenue">Si no está, dalo de alta en Compras → Proveedores con el mismo nombre y se liga solo.</p>
        </div>
      )}
      {cuenta && editable && cuenta.proveedor_id && (pagando
        ? <RegistrarPagoProveedor cuenta={cuenta} vencido={Number(cuenta.vencido)} facturas={facturas} banco={prov.data?.datos_bancarios ?? null} alTerminar={() => setPagando(false)} />
        : Number(cuenta.saldo) > 0.5 && <Boton className="mb-5 w-full sm:w-auto" onClick={() => setPagando(true)}><Wallet className="h-4 w-4" /> Registrar pago</Boton>)}

      {facturas.length > 0 && (
        <div className="mb-5">
          <p className="etiqueta mb-1" data-explain={GLOSARIO.facturasPendientes}>Facturas por pagar ({facturas.length}{vencidas.length ? `, ${vencidas.length} vencidas` : ""})</p>
          <div className="divide-y divide-borde">
            {facturas.map((x) => (
              <div key={x.id} className="py-2 flex items-start gap-3 text-sm">
                <span className="w-20 shrink-0 text-tenue whitespace-nowrap">{fecha(x.fecha)}</span>
                <div className="flex-1 min-w-0">
                  <p className="flex flex-wrap items-center gap-2"><Vencimiento vence={x.vence_el} />{x.factura && <span>Fact. {x.factura}</span>}
                    {x.posible_repetida && <InsigniaRepetida />}{x.posible_repetida && editable && <BotonRepetida factura={x} />}</p>
                  {x.descripcion && <p className="text-tenue mt-0.5 break-words line-clamp-2">{x.descripcion}</p>}
                </div>
                <span className="shrink-0 text-right">
                  <b className="cifra">{dinero(x.restante)}</b>
                  {Number(x.restante) < Number(x.monto) - 0.5 && <span className="block text-xs text-tenue">de {dinero(x.monto)}</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="etiqueta mb-1">Movimientos</p>
      {erp.isLoading || hoja.isLoading ? <Cargando filas={6} /> : (
        <div className="divide-y divide-borde">
          {renglones.length === 0 && <p className="py-2 text-sm text-tenue">Sin movimientos todavía.</p>}
          {renglones.map((m) => (
            <div key={m.clave} className={cn("py-2 flex items-start gap-3 text-sm", m.repetida && "opacity-60")}>
              <span className="w-20 shrink-0 text-tenue whitespace-nowrap">{fecha(m.fecha)}</span>
              <div className="flex-1 min-w-0">
                <p className="flex flex-wrap items-center gap-2">
                  <Insignia tono={m.resta ? "ok" : m.tipo === "Compra" || m.tipo === "Adeudo 2021" ? "neutro" : "info"}>{m.tipo}</Insignia>
                  {m.erp ? <Insignia tono="marca">ERP</Insignia> : <span className="text-xs text-tenue">Hoja</span>}
                  {m.erp?.en_hoja && <span data-explain={GLOSARIO.tambienEnHoja} data-explain-title="También en la hoja"><Insignia tono="info">También en la hoja</Insignia></span>}
                  {m.repetida && <span data-explain={GLOSARIO.renglonHojaNoCuenta} data-explain-title="No cuenta" title={m.repetida.motivo}>
                    <Insignia tono="aviso">{m.repetida.razon === "cancelada" ? "Cancelada" : "Repetida"} · no cuenta</Insignia></span>}
                  {m.repetida && <span className="text-xs text-tenue">{m.repetida.motivo}</span>}
                  {m.erp?.metodo_pago && <span className="text-xs text-tenue">{m.erp.metodo_pago}</span>}
                  {m.factura && <span className="text-tenue">Fact. {m.factura}</span>}
                  {m.cuenta && <span className="text-tenue">{m.cuenta}</span>}
                  {m.erp && ordenesDe(m.erp.id).map((x) => (
                    <span key={x.orden_compra_id} data-explain={GLOSARIO.ordenDeLaFactura} data-explain-title="Orden de compra de la factura">
                      {puede("compras") ? <Link to={`/compras/ordenes/${x.orden_compra_id}`} onClick={(e) => e.stopPropagation()}><Insignia tono="marca">{x.ordenes_compra?.folio}</Insignia></Link>
                        : <Insignia tono="marca">{x.ordenes_compra?.folio}</Insignia>}
                    </span>
                  ))}
                  {m.erp?.tipo === "compra" && !ordenesDe(m.erp.id).length && m.erp.categoria && <span className="text-xs text-tenue">{m.erp.categoria}</span>}
                </p>
                {m.descripcion && <p className="text-tenue mt-0.5 whitespace-pre-line break-words">{m.descripcion}</p>}
              </div>
              <span className={cn("cifra shrink-0 font-medium", m.repetida && "line-through")}>{m.resta ? "−" : ""}{dinero(m.monto)}</span>
              {editable && m.erp?.tipo === "compra" && (
                <button type="button" onClick={() => setLigando(m.erp!)} className="shrink-0 p-1 rounded text-tenue hover:text-marca-texto hover:bg-fondo"
                  aria-label="Orden de compra" title="De qué orden de compra es" data-explain={GLOSARIO.ordenDeLaFactura} data-explain-title="Ligar a su orden de compra">
                  <ClipboardList className="h-4 w-4" />
                </button>
              )}
              {editable && m.erp ? (
                <button type="button" onClick={() => { if (confirm(`¿Borrar ${m.tipo.toLowerCase()} de ${dinero(m.monto)} del ${fecha(m.fecha)}?`)) borrar.mutate(m.erp!.id); }}
                  className="shrink-0 p-1 rounded text-tenue hover:text-peligro hover:bg-fondo" aria-label="Borrar movimiento" title="Borrar (mal capturado)">
                  <Trash2 className="h-4 w-4" />
                </button>
              ) : editable && m.repetida && m.hojaId ? (
                <button type="button" onClick={() => desmarcar.mutate(m.hojaId!)} className="shrink-0 p-1 rounded text-tenue hover:text-texto hover:bg-fondo"
                  aria-label="Vuelve a contar" title="Deshacer: vuelve a contar en el saldo"><Undo2 className="h-4 w-4" /></button>
              ) : editable && m.hojaId && (m.tipo === "Compra" || m.tipo === "Pago") ? (
                <button type="button" onClick={() => setNoCuenta(m)} className="shrink-0 p-1 rounded text-tenue hover:text-peligro hover:bg-fondo"
                  aria-label="No cuenta" title="Está repetido o la factura se canceló: que no cuente"><Ban className="h-4 w-4" /></button>
              ) : editable && <span className="w-6 shrink-0" />}
            </div>
          ))}
          {hoja.data?.length === 200 && <p className="py-2 text-xs text-tenue">De la hoja se muestran los 200 más recientes.</p>}
          <DialogoLigarOrdenes compra={ligando && { id: ligando.id, proveedor_id: ligando.proveedor_id, factura: ligando.factura, monto: Number(ligando.monto), categoria: ligando.categoria, fecha: ligando.fecha }}
            alCerrar={() => setLigando(null)} />
          {noCuenta && <DialogoNoCuenta hojaId={noCuenta.hojaId!} tipo={noCuenta.tipo as "Compra" | "Pago"}
            resumen={`${noCuenta.tipo} del ${fecha(noCuenta.fecha)}${noCuenta.factura ? ` · Fact. ${noCuenta.factura}` : ""} · ${dinero(noCuenta.monto)}`} alCerrar={() => setNoCuenta(null)} />}
        </div>
      )}
    </Lateral>
  );
}

/** Días de crédito: deciden cuándo vence cada factura, también las que vienen de la hoja. */
function Credito({ proveedorId, dias, editable }: { proveedorId: string; dias: number; editable: boolean }) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(String(dias));
  useEffect(() => setValor(String(dias)), [dias]);
  const guardar = useAccion(() => q(supabase.rpc("fijar_credito_proveedor", { p_proveedor: proveedorId, p_dias: Number(valor) })), {
    exito: "Días de crédito guardados", invalidar: [...INVALIDAR_PROVEEDORES, ["proveedores"]], alTerminar: () => setEditando(false),
  });
  if (editando) return (
    <form className="inline-flex items-center gap-1" onSubmit={(e) => { e.preventDefault(); guardar.mutate(undefined); }}>
      <Entrada autoFocus type="number" min="0" max="365" value={valor} onChange={(e) => setValor(e.target.value)} className="h-7 w-20 cifra" />
      <span>días</span>
      <Boton type="submit" cargando={guardar.isPending} className="h-7">Guardar</Boton>
    </form>
  );
  return (
    <span data-explain={GLOSARIO.diasCredito} data-explain-title="Días de crédito" className="inline-flex items-center gap-1">
      {dias ? `Crédito ${dias} días` : "De contado"}
      {editable && <button type="button" onClick={() => setEditando(true)} className="p-0.5 rounded hover:bg-fondo" aria-label="Cambiar días de crédito"><Pencil className="h-3.5 w-3.5" /></button>}
    </span>
  );
}

/**
 * Un pago se aplica a la factura que se elija o, si no, a las que vencen primero (como la
 * hoja: el pago dice qué factura paga). Pagar de más solo como anticipo.
 */
function RegistrarPagoProveedor({ cuenta, vencido, facturas, banco, alTerminar }: {
  cuenta: CuentaProveedor; vencido: number; facturas: FacturaPendiente[]; banco: string | null; alTerminar: () => void;
}) {
  const saldo = Number(cuenta.saldo);
  const [f, setF] = useState({ fecha: hoyISO(), monto: "", cuenta: "", referencia: "", anticipo: false, factura: "" });
  const conFolio = facturas.filter((x) => x.factura);
  const monto = Number(f.monto) || 0;
  const demas = monto > saldo + 0.5;
  const guardar = useAccion(() => q(supabase.rpc("registrar_movimiento_proveedor", {
    p_proveedor: cuenta.proveedor_id, p_tipo: "pago", p_monto: monto, p_fecha: f.fecha, p_cuenta: f.cuenta,
    p_descripcion: f.referencia.trim() || null, p_anticipo: demas && f.anticipo, p_factura: f.factura || null,
  })), { exito: "Pago registrado", invalidar: INVALIDAR_PROVEEDORES, alTerminar });
  function enviar(e: FormEvent) { e.preventDefault(); if (monto > 0 && f.cuenta && (!demas || f.anticipo)) guardar.mutate(undefined); }
  return (
    <form onSubmit={enviar} className="mb-5 rounded-xl border border-borde bg-fondo/50 p-3 grid gap-3 sm:grid-cols-2">
      <p className="sm:col-span-2 font-medium text-sm">Registrar pago</p>
      <Campo etiqueta="Monto (con IVA)" className="sm:col-span-2"
        ayuda={demas ? `Es más de lo que se le debe (${dinero(saldo)}).` : monto > 0 && monto < saldo - 0.5 ? `Queda un saldo de ${dinero(saldo - monto)}` : monto > 0 ? "Liquida la cuenta" : undefined}>
        <div className="flex flex-wrap gap-2">
          <Entrada autoFocus type="number" step="0.01" min="0" value={f.monto} onChange={(e) => setF({ ...f, monto: e.target.value })}
            className="cifra flex-1 min-w-[140px]" placeholder={saldo.toFixed(2)} required />
          {vencido > 1 && vencido < saldo - 0.5 && <Boton type="button" variante="secundario" onClick={() => setF({ ...f, monto: vencido.toFixed(2) })}>Lo vencido</Boton>}
          <Boton type="button" variante="secundario" onClick={() => setF({ ...f, monto: saldo.toFixed(2) })}>Todo</Boton>
        </div>
      </Campo>
      {demas && (
        <label className="sm:col-span-2 flex items-start gap-2 text-sm" data-explain={GLOSARIO.anticipo}>
          <input type="checkbox" checked={f.anticipo} onChange={(e) => setF({ ...f, anticipo: e.target.checked })} className="h-4 w-4 mt-0.5 accent-[hsl(var(--marca))]" />
          Es un anticipo: lo que sobra queda a nuestro favor ({dinero(monto - saldo)})
        </label>
      )}
      {conFolio.length > 0 && (
        <Campo etiqueta="Factura que paga" className="sm:col-span-2" ayuda={f.factura ? undefined : "Si no eliges, se aplica a las que vencen primero."}>
          <Seleccion value={f.factura} onChange={(e) => {
            const x = conFolio.find((c) => c.factura === e.target.value);
            setF({ ...f, factura: e.target.value, monto: x ? Number(x.restante).toFixed(2) : f.monto });
          }}>
            <option value="">Las que vencen primero</option>
            {conFolio.map((x) => <option key={x.id} value={x.factura!}>{x.factura} · {dinero(x.restante)} · vence {fecha(x.vence_el)}</option>)}
          </Seleccion>
        </Campo>
      )}
      <Campo etiqueta="Sale de la cuenta">
        <SelectorCuenta valor={f.cuenta} alCambiar={(v) => setF({ ...f, cuenta: v })} />
      </Campo>
      <Campo etiqueta="Fecha">
        <Entrada type="date" value={f.fecha} max={hoyISO()} onChange={(e) => setF({ ...f, fecha: e.target.value })} required />
      </Campo>
      <Campo etiqueta="Referencia" className="sm:col-span-2" ayuda={banco ? `Cuenta del proveedor: ${banco}` : undefined}>
        <Entrada value={f.referencia} onChange={(e) => setF({ ...f, referencia: e.target.value })} placeholder="SPEI, cheque, facturas que liquida…" />
      </Campo>
      <div className="sm:col-span-2 flex justify-end gap-2">
        <Boton type="button" variante="secundario" onClick={alTerminar}>Cancelar</Boton>
        <Boton type="submit" cargando={guardar.isPending} disabled={monto <= 0 || !f.cuenta || (demas && !f.anticipo)}>Registrar pago</Boton>
      </div>
    </form>
  );
}

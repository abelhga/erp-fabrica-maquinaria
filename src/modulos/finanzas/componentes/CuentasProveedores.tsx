import { useEffect, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Ban, ClipboardList, FilePlus2, Link2, Pencil, Search, Trash2, Undo2, Users, Wallet } from "lucide-react";
import { TablaDatos, Filtro, type Columna } from "@/components/datos/TablaDatos";
import { Dialogo, Lateral } from "@/components/ui/dialogo";
import { Insignia } from "@/components/ui/insignia";
import { Boton } from "@/components/ui/boton";
import { AreaTexto, Campo, Entrada, Seleccion } from "@/components/ui/campo";
import { Cargando } from "@/components/ui/estados";
import { useSesion } from "@/lib/sesion";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { dinero, fecha, hace, hoyISO } from "@/lib/formato";
import { cn, normalizar as sinAcentos } from "@/lib/utilidades";
import { GLOSARIO } from "@/tutorial/glosario";
import {
  INVALIDAR_PROVEEDORES, SelectorCuenta, TIPO_ACREEDOR, Vencimiento, diasPara, esPrestamo, useCuentasDinero,
  type CuentaProveedor, type FacturaPendiente,
} from "./cuentas";
import { BotonRepetida, DialogoNoCuenta, InsigniaRepetida, type Ignorada } from "./Repetida";
import { SelectorProveedor } from "@/modulos/compras/componentes/comun";
import { DialogoLigarOrdenes, ListaCategorias } from "./ElegirOrdenes";

/**
 * Cuenta de cada proveedor: lo que venía en el libro de compras de la hoja más lo que se
 * registra en el ERP. Lo que hay por pagar y lo que hay a favor van aparte: un anticipo sin usar
 * no tapa una factura a crédito, así que un proveedor puede tener las dos cosas a la vez.
 */
export function CuentasProveedores({ cuentas, cargando, error, alAbrir, vistaInicial = "debemos" }: {
  cuentas: CuentaProveedor[]; cargando: boolean; error: unknown; alAbrir: (llave: string) => void;
  vistaInicial?: "debemos" | "socios" | "favor" | "todos";
}) {
  const [vista, setVista] = useState(vistaInicial);
  useEffect(() => setVista(vistaInicial), [vistaInicial]);
  // Préstamos de socios y créditos de banco van aparte: no son deuda con proveedores.
  const debemos = cuentas.filter((f) => Number(f.por_pagar) > 1 && !esPrestamo(f.tipo_acreedor));
  const socios = cuentas.filter((f) => Number(f.por_pagar) > 1 && esPrestamo(f.tipo_acreedor));
  const favor = cuentas.filter((f) => Number(f.a_favor) > 1);
  // En «A nuestro favor» y «Todos» se suma el saldo; donde se debe, lo que hay por pagar.
  const cifra = (f: CuentaProveedor) => (vista === "favor" ? -Number(f.a_favor) : vista === "todos" ? Number(f.saldo) : Number(f.por_pagar));
  const suma = (fs: CuentaProveedor[]) => fs.reduce((s, f) => s + cifra(f), 0);
  const filas = (vista === "debemos" ? debemos : vista === "socios" ? socios : vista === "favor" ? favor : cuentas).slice()
    .sort((a, b) => (vista === "favor" ? cifra(a) - cifra(b) : cifra(b) - cifra(a)));

  const columnas: Columna<CuentaProveedor>[] = [
    { clave: "nombre", titulo: "Proveedor", clase: "min-w-[200px] max-w-[340px]",
      celda: (f) => <div><p className="font-medium break-words">{f.nombre}</p>
        {(f.tipo_acreedor !== "proveedor" || f.categoria) && <p className="text-xs text-tenue">{f.tipo_acreedor !== "proveedor" ? TIPO_ACREEDOR[f.tipo_acreedor] : f.categoria}</p>}</div> },
    { clave: "saldo", titulo: vista === "favor" ? "A favor" : vista === "todos" ? "Saldo" : "Por pagar", alinear: "der", sinBusqueda: true, valor: cifra, explica: GLOSARIO.saldoProveedor,
      celda: (f) => <div><b className={cifra(f) < -1 ? "text-info" : ""}>{dinero(cifra(f))}</b>
        {vista !== "favor" && Number(f.a_favor) > 1 && <p className="text-xs text-info whitespace-nowrap" data-explain={GLOSARIO.aFavorProveedor} data-explain-title="A favor">{dinero(f.a_favor)} a favor</p>}
        {vista === "favor" && Number(f.por_pagar) > 1 && <p className="text-xs text-tenue whitespace-nowrap">y se le deben {dinero(f.por_pagar)}</p>}</div> },
    { clave: "vencido", titulo: "Vencido", alinear: "der", sinBusqueda: true, valor: (f) => Number(f.vencido), explica: GLOSARIO.vencePago,
      celda: (f) => Number(f.vencido) > 1 ? <span className="text-peligro font-medium">{dinero(f.vencido)}</span> : <span className="text-tenue">—</span> },
    { clave: "proximo_vence", titulo: "Próximo vencimiento", explica: GLOSARIO.vencePago, sinBusqueda: true, valor: (f) => f.proximo_vence ?? "9999",
      celda: (f) => f.proximo_vence ? <Vencimiento vence={f.proximo_vence} /> : <span className="text-tenue">—</span> },
    { clave: "ultima_compra", titulo: "Última compra", sinBusqueda: true, celda: (f) => <span className="whitespace-nowrap">{fecha(f.ultima_compra)}</span> },
    { clave: "ultimo_pago", titulo: "Último pago", sinBusqueda: true, valor: (f) => f.ultimo_pago,
      celda: (f) => f.ultimo_pago ? <span className="whitespace-nowrap" title={fecha(f.ultimo_pago)}>{hace(f.ultimo_pago)}</span> : <span className="text-aviso text-xs">Nunca</span> },
  ];

  return (
    <TablaDatos filas={filas} columnas={columnas} cargando={cargando} error={error} claveFila={(f) => f.proveedor_llave}
      alClicFila={(f) => alAbrir(f.proveedor_llave)} exportarComo="cuentas-proveedores" placeholder="Buscar proveedor o categoría…"
      filtros={<Filtro valor={vista} alCambiar={setVista} opciones={[
        { valor: "debemos", texto: "Les debemos", cuenta: debemos.length, explica: GLOSARIO.saldoProveedor },
        { valor: "socios", texto: "Socios y bancos", cuenta: socios.length, explica: GLOSARIO.sociosBancos },
        { valor: "favor", texto: "A nuestro favor", cuenta: favor.length, explica: GLOSARIO.filtroAFavorProveedor },
        { valor: "todos", texto: "Todos", cuenta: cuentas.length },
      ]} />}
      pie={filas.length > 0 && <div className="flex justify-end gap-6 text-sm"><span className="text-tenue">{vista === "favor" ? "A favor" : vista === "todos" ? "Saldo" : "Por pagar"} de lo que se ve:</span><b className="cifra">{dinero(suma(filas))}</b></div>}
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
  const [recategorizar, setRecategorizar] = useState<MovErp | null>(null);
  // Las compras a las que se les cambió la categoría: se ve cuál tenían y por qué.
  const cambiosCat = useQuery({
    queryKey: ["movimiento_categoria_cambios", llave, idsCompras.join()], enabled: editable && idsCompras.length > 0,
    queryFn: () => q<{ movimiento_id: string; antes: string | null; despues: string; motivo: string; en: string }[]>(
      supabase.from("movimiento_categoria_cambios").select("movimiento_id, antes, despues, motivo, en").in("movimiento_id", idsCompras).order("en")),
  });
  const cambioDe = (id: string) => (cambiosCat.data ?? []).filter((x) => x.movimiento_id === id);
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
  // Buscar una factura en la cuenta: por folio (basta el final: «4858»), por lo que dice o por el
  // monto. Filtra lo que hay por pagar y los movimientos a la vez, para ver de un vistazo si una
  // factura está, cuánto se le debe y con qué se pagó.
  const [buscar, setBuscar] = useState("");
  useEffect(() => setBuscar(""), [llave]);
  const busca = sinAcentos(buscar.trim());
  const digitos = busca.replace(/\D/g, "");
  const coincideCon = (x: { factura?: string | null; descripcion?: string | null; monto: number | string; fecha: string }) => {
    if (!busca) return true;
    const texto = sinAcentos(`${x.factura ?? ""} ${x.descripcion ?? ""} ${fecha(x.fecha)}`);
    return texto.includes(busca)
      || (digitos.length >= 3 && (`${x.factura ?? ""}`.replace(/\D/g, "").includes(digitos) || Number(x.monto).toFixed(2).replace(".", "").includes(digitos)));
  };
  const facturasVistas = facturas.filter(coincideCon);
  const renglonesVistos = renglones.filter(coincideCon);
  // Lo que se le debe a cada compra según el reparto de pagos del ERP (0 = pagada).
  const debe = new Map(facturas.map((x) => [x.id, Number(x.restante)]));
  const debeDe = (m: Renglon) => debe.get(m.erp ? m.erp.id : `hoja:${m.hojaId}`) ?? 0;

  return (
    <Lateral abierto={!!cuenta} alCambiar={(v) => !v && alCerrar()} titulo={cuenta?.nombre ?? ""}
      acciones={editable && cuenta?.proveedor_id && (
        <Boton variante="secundario" data-explain={GLOSARIO.botonRegistrarCompraGasto} data-explain-title="Registrar compra o gasto" onClick={() => alRegistrarCompra({ id: cuenta.proveedor_id!, nombre: cuenta.nombre })}><FilePlus2 className="h-4 w-4" /> Compra</Boton>
      )}
      subtitulo={cuenta && <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {Number(cuenta.a_favor) > 1
          ? <>
            <span>Por pagar <b className="cifra text-texto">{dinero(cuenta.por_pagar)}</b></span>
            <span className="text-info" data-explain={GLOSARIO.aFavorProveedor} data-explain-title="A favor">A favor <b className="cifra">{dinero(cuenta.a_favor)}</b></span>
          </>
          : <span>Saldo <b className="cifra text-texto">{dinero(cuenta.saldo)}</b></span>}
        {Number(cuenta.vencido) > 1 && <span className="text-peligro">Vencido {dinero(cuenta.vencido)}</span>}
        {cuenta.tipo_acreedor !== "proveedor" && <span data-explain={GLOSARIO.sociosBancos} data-explain-title={TIPO_ACREEDOR[cuenta.tipo_acreedor]}><Insignia tono="info">{TIPO_ACREEDOR[cuenta.tipo_acreedor]}</Insignia></span>}
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
        : <Boton className="mb-5 w-full sm:w-auto" data-explain={GLOSARIO.botonRegistrarPagoProveedor} onClick={() => setPagando(true)}><Wallet className="h-4 w-4" /> Registrar pago</Boton>)}

      {cuenta && renglones.length > 0 && (
        <div className="mb-4" data-explain={GLOSARIO.buscadorFacturasProveedor} data-explain-title="Buscar una factura">
          <div className="relative">
            <Search className="h-4 w-4 text-tenue absolute left-3 top-1/2 -translate-y-1/2" />
            <input className="campo pl-9" value={buscar} onChange={(e) => setBuscar(e.target.value)} aria-label="Buscar una factura"
              placeholder="Buscar factura: folio (basta el final), concepto o monto…" />
          </div>
          {busca && <p className="mt-1 text-xs text-tenue">{facturasVistas.length ? `${facturasVistas.length} por pagar` : "Ninguna por pagar"} · {renglonesVistos.length} {renglonesVistos.length === 1 ? "movimiento" : "movimientos"} con «{buscar.trim()}»</p>}
        </div>
      )}
      {facturasVistas.length > 0 && (
        <div className="mb-5">
          <p className="etiqueta mb-1" data-explain={GLOSARIO.facturasPendientes}>Facturas por pagar ({busca ? `${facturasVistas.length} de ${facturas.length}` : facturas.length}{!busca && vencidas.length ? `, ${vencidas.length} vencidas` : ""})</p>
          <div className="divide-y divide-borde">
            {facturasVistas.map((x) => (
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

      <p className="etiqueta mb-1" data-explain={GLOSARIO.movimientosProveedor}>Movimientos</p>
      {erp.isLoading || hoja.isLoading ? <Cargando filas={6} /> : (
        <div className="divide-y divide-borde">
          {renglones.length === 0 && <p className="py-2 text-sm text-tenue">Sin movimientos todavía.</p>}
          {renglones.length > 0 && renglonesVistos.length === 0 && <p className="py-2 text-sm text-tenue">Ningún movimiento con «{buscar.trim()}». Si la factura es de hace mucho, puede no estar entre los 200 más recientes de la hoja.</p>}
          {renglonesVistos.map((m) => (
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
                  {m.erp?.tipo === "compra" && (editable || !ordenesDe(m.erp.id).length) && (m.erp.categoria || editable) && (() => {
                    const c = cambioDe(m.erp!.id); const primero = c[0];
                    return (
                      <span className="inline-flex items-center gap-1 text-xs text-tenue" title={primero ? `Antes: ${primero.antes ?? "sin categoría"} · ${c[c.length - 1].motivo}` : undefined}>
                        {m.erp!.categoria ?? "Sin categoría"}{primero && <span className="italic">(antes {primero.antes ?? "sin categoría"})</span>}
                        {editable && <button type="button" onClick={() => setRecategorizar(m.erp!)} className="p-0.5 rounded hover:text-texto" aria-label="Cambiar categoría"
                          data-explain={GLOSARIO.cambiarCategoriaCompra} data-explain-title="Cambiar categoría"><Pencil className="h-3 w-3" /></button>}
                      </span>
                    );
                  })()}
                  {(m.erp ? m.erp.tipo === "compra" : m.tipo === "Compra") && !m.repetida && (
                    <span data-explain={GLOSARIO.estadoPagoCompra} data-explain-title="¿Está pagada?">
                      {debeDe(m) >= 1 ? <Insignia tono="aviso">Debe {dinero(debeDe(m))}</Insignia> : <span className="text-xs text-ok">Pagada</span>}
                    </span>
                  )}
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
                  className="shrink-0 p-1 rounded text-tenue hover:text-peligro hover:bg-fondo" aria-label="Borrar movimiento" title="Borrar (mal capturado)"
                  data-explain={GLOSARIO.botonBorrarMovimientoProveedor} data-explain-title="Borrar movimiento">
                  <Trash2 className="h-4 w-4" />
                </button>
              ) : editable && m.repetida && m.hojaId ? (
                <button type="button" onClick={() => desmarcar.mutate(m.hojaId!)} className="shrink-0 p-1 rounded text-tenue hover:text-texto hover:bg-fondo"
                  aria-label="Vuelve a contar" title="Deshacer: vuelve a contar en el saldo" data-explain={GLOSARIO.renglonHojaNoCuenta} data-explain-title="Que vuelva a contar"><Undo2 className="h-4 w-4" /></button>
              ) : editable && m.hojaId && (m.tipo === "Compra" || m.tipo === "Pago") ? (
                <button type="button" onClick={() => setNoCuenta(m)} className="shrink-0 p-1 rounded text-tenue hover:text-peligro hover:bg-fondo"
                  aria-label="No cuenta" title="Está repetido o la factura se canceló: que no cuente" data-explain={GLOSARIO.renglonHojaNoCuenta} data-explain-title="Que no cuente"><Ban className="h-4 w-4" /></button>
              ) : editable && <span className="w-6 shrink-0" />}
            </div>
          ))}
          {hoja.data?.length === 200 && <p className="py-2 text-xs text-tenue">De la hoja se muestran los 200 más recientes.</p>}
          <DialogoCategoria compra={recategorizar} alCerrar={() => setRecategorizar(null)} />
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
 * hoja: el pago dice qué factura paga). Un anticipo se marca a propósito: queda a favor y se
 * descuenta de las facturas de contado, no de las que son a crédito. Pagar de más solo como anticipo.
 */
function RegistrarPagoProveedor({ cuenta, vencido, facturas, banco, alTerminar }: {
  cuenta: CuentaProveedor; vencido: number; facturas: FacturaPendiente[]; banco: string | null; alTerminar: () => void;
}) {
  // Contra lo que hay por pagar, no contra el saldo: con anticipo a favor el saldo es menor.
  const saldo = Number(cuenta.por_pagar);
  const [f, setF] = useState({ fecha: hoyISO(), monto: "", cuenta: "", referencia: "", anticipo: false, factura: "" });
  const conFolio = facturas.filter((x) => x.factura);
  const monto = Number(f.monto) || 0;
  const demas = monto > saldo + 0.5;
  // El pago repetido sí pasaba (cinco en mes y medio): mismo proveedor y monto a cinco días, por la
  // misma factura o sin factura. Se enseña antes de guardar y se pide confirmar.
  const parecidos = useQuery({
    queryKey: ["pagos_parecidos", cuenta.proveedor_id, monto, f.fecha, f.factura], enabled: !!cuenta.proveedor_id && monto > 0 && !!f.fecha, staleTime: 30_000,
    queryFn: () => q<{ fecha: string; monto: number; factura: string | null; descripcion: string | null; cuenta: string | null; capturado: string }[]>(
      supabase.rpc("pagos_parecidos", { p_proveedor: cuenta.proveedor_id, p_monto: monto, p_fecha: f.fecha, p_factura: f.factura || null })),
  });
  const [esOtro, setEsOtro] = useState(false);
  useEffect(() => setEsOtro(false), [monto, f.fecha, f.factura]);
  const hayParecidos = (parecidos.data?.length ?? 0) > 0 && !esOtro;
  const guardar = useAccion(() => q(supabase.rpc("registrar_movimiento_proveedor", {
    p_proveedor: cuenta.proveedor_id, p_tipo: "pago", p_monto: monto, p_fecha: f.fecha, p_cuenta: f.cuenta,
    p_descripcion: f.referencia.trim() || null, p_anticipo: f.anticipo, p_factura: f.anticipo ? null : f.factura || null,
  })), { exito: "Pago registrado", invalidar: INVALIDAR_PROVEEDORES, alTerminar });
  function enviar(e: FormEvent) { e.preventDefault(); if (monto > 0 && f.cuenta && (!demas || f.anticipo) && !hayParecidos) guardar.mutate(undefined); }
  return (
    <form onSubmit={enviar} className="mb-5 rounded-xl border border-borde bg-fondo/50 p-3 grid gap-3 sm:grid-cols-2">
      <p className="sm:col-span-2 font-medium text-sm">Registrar pago</p>
      <Campo etiqueta="Monto (con IVA)" className="sm:col-span-2"
        ayuda={demas && !f.anticipo ? `Es más de lo que hay por pagar (${dinero(saldo)}). Registra eso como pago y lo demás aparte, como anticipo.` : f.anticipo ? undefined : monto > 0 && monto < saldo - 0.5 ? `Queda un saldo de ${dinero(saldo - monto)}` : monto > 0 ? "Liquida la cuenta" : undefined}>
        <div className="flex flex-wrap gap-2">
          <Entrada autoFocus type="number" step="0.01" min="0" value={f.monto} onChange={(e) => setF({ ...f, monto: e.target.value })}
            className="cifra flex-1 min-w-[140px]" placeholder={saldo.toFixed(2)} required />
          {vencido > 1 && vencido < saldo - 0.5 && <Boton type="button" variante="secundario" data-explain={GLOSARIO.botonesMontoPagoProveedor} onClick={() => setF({ ...f, monto: vencido.toFixed(2) })}>Lo vencido</Boton>}
          <Boton type="button" variante="secundario" data-explain={GLOSARIO.botonesMontoPagoProveedor} onClick={() => setF({ ...f, monto: saldo.toFixed(2) })}>Todo</Boton>
        </div>
      </Campo>
      <label className="sm:col-span-2 flex items-start gap-2 text-sm" data-explain={GLOSARIO.anticipo} data-explain-title="Anticipo">
        <input type="checkbox" checked={f.anticipo} onChange={(e) => setF({ ...f, anticipo: e.target.checked, factura: "" })} className="h-4 w-4 mt-0.5 accent-[hsl(var(--marca))]" />
        <span>Es un anticipo
          <span className="block text-xs text-tenue">Queda a nuestro favor y se descuenta de sus facturas de contado. No paga las facturas a crédito: esas se pagan una por una.</span>
        </span>
      </label>
      {!f.anticipo && conFolio.length > 0 && (
        <Campo etiqueta="Factura que paga" className="sm:col-span-2" ayuda={f.factura ? undefined : "Si no eliges, se aplica a las que vencen primero."}>
          <Seleccion value={f.factura} data-explain={GLOSARIO.facturasPendientes} data-explain-title="Factura que paga" onChange={(e) => {
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
      {(parecidos.data?.length ?? 0) > 0 && (
        <div className="sm:col-span-2 rounded-lg border border-aviso/30 bg-aviso-suave px-3 py-2 text-sm space-y-1.5"
          data-explain={GLOSARIO.pagoRepetido} data-explain-title="¿Ya está registrado?">
          <p className="font-medium">{parecidos.data!.length === 1 ? "Ya hay un pago igual a este proveedor:" : "Ya hay pagos iguales a este proveedor:"}</p>
          {parecidos.data!.map((p, i) => (
            <p key={i} className="text-tenue">{dinero(p.monto)} del {fecha(p.fecha)}{p.factura ? ` · Fact. ${p.factura}` : " · sin factura"}
              {p.descripcion ? ` · ${p.descripcion}` : ""} · capturado el {p.capturado}</p>
          ))}
          <label className="flex items-center gap-2 pt-1">
            <input type="checkbox" checked={esOtro} onChange={(e) => setEsOtro(e.target.checked)} className="h-4 w-4 accent-[hsl(var(--marca))]" />
            Sí, es otro pago: registrarlo
          </label>
        </div>
      )}
      <div className="sm:col-span-2 flex justify-end gap-2">
        <Boton type="button" variante="secundario" onClick={alTerminar}>Cancelar</Boton>
        <Boton type="submit" cargando={guardar.isPending} disabled={monto <= 0 || !f.cuenta || (demas && !f.anticipo) || hayParecidos}>Registrar pago</Boton>
      </div>
    </form>
  );
}

/**
 * Cambiar la categoría de una compra ya registrada (por ejemplo a «Sin efectos», lo que no es
 * de la empresa): el monto y lo que se le debe al proveedor no cambian, solo en qué se cuenta.
 * Pide el porqué, que queda junto a la compra.
 */
function DialogoCategoria({ compra, alCerrar }: { compra: { id: string; categoria: string | null; factura: string | null; monto: number; fecha: string } | null; alCerrar: () => void }) {
  const [cat, setCat] = useState("");
  const [motivo, setMotivo] = useState("");
  useEffect(() => { setCat(""); setMotivo(""); }, [compra]);
  const guardar = useAccion(() => q(supabase.rpc("cambiar_categoria_compra", { p_movimiento: compra!.id, p_categoria: cat.trim(), p_motivo: motivo.trim() })), {
    exito: `Categoría cambiada a «${cat.trim()}»`,
    invalidar: [...INVALIDAR_PROVEEDORES, ["movimiento_categoria_cambios"], ["resultados_periodo"], ["categorias_compra_periodo"]], alTerminar: alCerrar,
  });
  const listo = cat.trim().length > 0 && motivo.trim().length >= 5 && cat.trim().toLowerCase() !== (compra?.categoria ?? "").toLowerCase();
  return (
    <Dialogo abierto={!!compra} alCambiar={(v) => !v && alCerrar()} titulo="Cambiar categoría"
      descripcion={compra && `Compra del ${fecha(compra.fecha)}${compra.factura ? ` · Fact. ${compra.factura}` : ""} · ${dinero(compra.monto)}. Hoy: ${compra.categoria ?? "sin categoría"}. Lo que se le debe al proveedor no cambia.`}
      pie={<><Boton variante="secundario" onClick={alCerrar}>Cancelar</Boton>
        <Boton type="submit" form="cambiar-categoria" disabled={!listo} cargando={guardar.isPending}>Guardar</Boton></>}>
      <form id="cambiar-categoria" className="grid gap-3" onSubmit={(e) => { e.preventDefault(); if (listo) guardar.mutate(undefined); }}>
        <Campo etiqueta="Nueva categoría">
          <div className="flex flex-wrap items-center gap-2">
            <Entrada value={cat} onChange={(e) => setCat(e.target.value)} list="categorias-cambiar" autoFocus className="flex-1 min-w-[180px]" placeholder="Escribe o elige…" />
            <Boton type="button" tamano="sm" variante="secundario" onClick={() => setCat("Sin efectos")} data-explain={GLOSARIO.sinEfectos} data-explain-title="Sin efectos">Sin efectos</Boton>
          </div>
          <ListaCategorias id="categorias-cambiar" />
        </Campo>
        <Campo etiqueta="¿Por qué?" ayuda="Obligatorio. Queda junto a la compra.">
          <AreaTexto value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} placeholder="Ej. no es para la empresa: lo pidió otra persona" />
        </Campo>
      </form>
    </Dialogo>
  );
}

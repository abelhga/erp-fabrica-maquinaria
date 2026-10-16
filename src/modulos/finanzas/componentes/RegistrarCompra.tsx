import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, FileCode2, Upload } from "lucide-react";
import { Dialogo } from "@/components/ui/dialogo";
import { Boton } from "@/components/ui/boton";
import { Campo, Entrada } from "@/components/ui/campo";
import { Insignia } from "@/components/ui/insignia";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { dinero, fecha, hoyISO } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { folioCfdi, leerCfdi, type Cfdi } from "@/lib/cfdi";
import { useEmpresa } from "@/modulos/ventas/comun";
import { SelectorProveedor } from "@/modulos/compras/componentes/comun";
import { GLOSARIO } from "@/tutorial/glosario";
import { INVALIDAR_PROVEEDORES, SelectorCuenta, sumarDias } from "./cuentas";

interface Proveedor { id: string; nombre: string; categoria: string | null; dias_credito: number; rfc: string | null }
/** Un XML de la fila: leído, o con el porqué no se puede registrar. */
interface Archivo { nombre: string; cfdi: Cfdi | null; error: string | null }

const VACIO = { fecha: hoyISO(), monto: "", factura: "", descripcion: "", categoria: "", vence: "", pagada: false, cuenta: "" };

/**
 * Registrar una compra o un gasto (material, luz, flete, servicio) en la cuenta del
 * proveedor. Con el XML de la factura se llena solo: proveedor por RFC, folio, total,
 * fecha y si es de contado (PUE) o a crédito (PPD). Acepta varios XML a la vez y los va
 * pasando uno por uno, para capturar la carpeta de facturas del mes de corrido.
 */
export function RegistrarCompra({ abierto, alCerrar, proveedorInicial }: {
  abierto: boolean; alCerrar: () => void; proveedorInicial?: { id: string; nombre: string } | null;
}) {
  const empresa = useEmpresa();
  const rfcPropio = (empresa.data?.fiscal.rfc ?? "").toUpperCase();
  const [cola, setCola] = useState<Archivo[]>([]);
  const [idx, setIdx] = useState(0);
  const [prov, setProv] = useState<Proveedor | null>(null);
  const [f, setF] = useState(VACIO);
  const [tocoVence, setTocoVence] = useState(false);
  const archivo = useRef<HTMLInputElement>(null);
  const actual = cola[idx] ?? null;
  const cfdi = actual?.cfdi ?? null;

  useEffect(() => {
    if (!abierto) return;
    setCola([]); setIdx(0); setF(VACIO); setTocoVence(false); setProv(null);
    if (proveedorInicial) cargarProveedor(proveedorInicial.id);
  }, [abierto]); // eslint-disable-line react-hooks/exhaustive-deps

  async function cargarProveedor(id: string) {
    const p = await q<Proveedor>(supabase.from("proveedores").select("id, nombre, categoria, dias_credito, rfc").eq("id", id).single());
    setProv(p);
    setF((x) => ({ ...x, categoria: x.categoria || p.categoria || "" }));
  }

  // El RFC del emisor dice quién es el proveedor. Si hay varios con el mismo RFC (pasó al
  // importar la hoja), se elige a mano; si no hay ninguno, se ofrece darlo de alta.
  const rfc = cfdi?.emisor.rfc ?? null;
  const porRfc = useQuery({
    queryKey: ["proveedores", "rfc", rfc], enabled: !!rfc,
    queryFn: () => q<Proveedor[]>(supabase.from("proveedores").select("id, nombre, categoria, dias_credito, rfc").ilike("rfc", rfc!).order("activo", { ascending: false })),
  });
  // Al cambiar de XML se llenan los campos con lo de la factura.
  useEffect(() => {
    if (!cfdi) return;
    const usd = cfdi.moneda && cfdi.moneda !== "MXN" && cfdi.tipoCambio ? cfdi.tipoCambio : null;
    const total = (cfdi.total ?? 0) * (usd ?? 1);
    setF({
      ...VACIO,
      fecha: cfdi.fecha && cfdi.fecha <= hoyISO() ? cfdi.fecha : hoyISO(),
      monto: total ? total.toFixed(2) : "",
      factura: folioCfdi(cfdi) ?? "",
      descripcion: [usd ? `${cfdi.moneda} ${cfdi.total?.toFixed(2)} a ${usd}` : null, cfdi.conceptos.slice(0, 3).join("; ")].filter(Boolean).join(" · ").slice(0, 300),
      pagada: cfdi.metodoPago === "PUE",
    });
    setTocoVence(false);
    setProv(null);
  }, [cfdi]);
  // Va después del de arriba (los efectos corren en orden): al cambiar de XML primero se
  // limpia y luego se elige el proveedor, también si el RFC ya estaba en caché.
  useEffect(() => {
    if (cfdi && porRfc.data?.length === 1) { setProv(porRfc.data[0]); setF((x) => ({ ...x, categoria: x.categoria || porRfc.data![0].categoria || "" })); }
  }, [cfdi, porRfc.data]);

  async function leerArchivos(lista: FileList | null) {
    if (!lista?.length) return;
    const leidos: Archivo[] = await Promise.all([...lista].map(async (a) => {
      try {
        const c = leerCfdi(await a.text());
        const motivo =
          rfcPropio && c.emisor.rfc === rfcPropio ? "La emitimos nosotros: es una venta, va en Cobranza."
          : rfcPropio && c.receptor.rfc && c.receptor.rfc !== rfcPropio ? `Es para otro RFC (${c.receptor.rfc}), no para la empresa.`
          : c.tipo === "P" ? "Es un complemento de pago, no una compra: registra el pago en la cuenta del proveedor."
          : c.tipo === "N" ? "Es un recibo de nómina, no una compra."
          : c.tipo === "T" ? "Es un traslado (no cobra nada)."
          : !c.total ? "No trae total." : null;
        return { nombre: a.name, cfdi: c, error: motivo };
      } catch (e) {
        return { nombre: a.name, cfdi: null, error: e instanceof Error ? e.message : "No se pudo leer" };
      }
    }));
    // Las que ya se registraron se avisan de una vez (subir la carpeta del mes dos veces no duplica).
    const uuids = leidos.map((l) => l.cfdi?.uuid).filter((u): u is string => !!u);
    if (uuids.length) {
      const ya = await q<{ cfdi_uuid: string; fecha: string }[]>(supabase.from("movimientos_proveedor").select("cfdi_uuid, fecha").in("cfdi_uuid", uuids));
      for (const l of leidos) {
        const r = ya.find((y) => y.cfdi_uuid === l.cfdi?.uuid);
        if (r && !l.error) l.error = `Ya está registrada (factura del ${fecha(r.fecha)}).`;
      }
    }
    setCola(leidos); setIdx(0);
    if (archivo.current) archivo.current.value = "";
  }

  const notaCredito = cfdi?.tipo === "E";
  const monto = Number(f.monto) || 0;
  const venceCalculado = prov ? sumarDias(f.fecha, prov.dias_credito ?? 0) : null;
  const vence = tocoVence ? f.vence : venceCalculado ?? "";
  const siguiente = () => { if (idx + 1 < cola.length) setIdx(idx + 1); else alCerrar(); };

  const alta = useAccion(() => q<string>(supabase.rpc("alta_proveedor_finanzas", { p_nombre: cfdi!.emisor.nombre ?? rfc, p_rfc: rfc, p_categoria: f.categoria || null })), {
    exito: "Proveedor dado de alta", invalidar: [["proveedores"]], alTerminar: (id) => cargarProveedor(id),
  });
  const guardar = useAccion(async () => {
    const comunes = { p_proveedor: prov!.id, p_fecha: f.fecha, p_factura: f.factura || null };
    await q(supabase.rpc("registrar_movimiento_proveedor", {
      ...comunes, p_tipo: notaCredito ? "reembolso_pendiente" : "compra", p_monto: monto,
      p_descripcion: (notaCredito ? `Nota de crédito. ${f.descripcion}` : f.descripcion) || null,
      p_vence: tocoVence && f.vence ? f.vence : null, p_categoria: f.categoria || null,
      p_cfdi_uuid: cfdi?.uuid ?? null, p_metodo_pago: cfdi?.metodoPago ?? null,
    }));
    // De contado: el pago va en el mismo paso. Se marca como anticipo para que, si el
    // proveedor tenía saldo a favor, no se rechace un pago que es exacto a la factura.
    if (f.pagada && !notaCredito) {
      await q(supabase.rpc("registrar_movimiento_proveedor", {
        ...comunes, p_tipo: "pago", p_monto: monto, p_cuenta: f.cuenta, p_descripcion: `Pago de contado${f.factura ? ` de ${f.factura}` : ""}`, p_anticipo: true,
      }));
    }
  }, {
    exito: notaCredito ? "Nota de crédito registrada" : f.pagada ? "Compra y pago registrados" : "Compra registrada",
    invalidar: INVALIDAR_PROVEEDORES, alTerminar: siguiente,
  });

  function enviar(e: FormEvent) {
    e.preventDefault();
    if (prov && monto > 0 && !actual?.error && (!f.pagada || f.cuenta)) guardar.mutate(undefined);
  }

  const categorias = useCategorias();
  const bloqueado = !!actual?.error;

  return (
    <Dialogo abierto={abierto} alCambiar={(v) => !v && alCerrar()} ancho="max-w-2xl"
      titulo={notaCredito ? "Registrar nota de crédito" : "Registrar compra o gasto"}
      descripcion="Material, servicios, fletes, luz: todo lo que se le debe (o ya se le pagó) a un proveedor."
      pie={<>
        {cola.length > 1 && <span className="mr-auto text-sm text-tenue">Factura {idx + 1} de {cola.length}</span>}
        {cola.length > 1 && <Boton variante="secundario" type="button" onClick={siguiente}>Saltar</Boton>}
        <Boton variante="secundario" type="button" onClick={alCerrar}>Cerrar</Boton>
        <Boton type="submit" form="registrar-compra" cargando={guardar.isPending} disabled={!prov || monto <= 0 || bloqueado || (f.pagada && !f.cuenta)}>
          {notaCredito ? "Registrar nota de crédito" : f.pagada ? "Registrar compra y pago" : "Registrar compra"}
        </Boton>
      </>}>
      <div className="space-y-4">
        <label className={cn("flex items-center gap-3 rounded-xl border border-dashed border-borde px-4 py-3 cursor-pointer hover:bg-fondo",
          actual && !bloqueado && "border-ok/40 bg-ok-suave/40")}
          data-explain={GLOSARIO.cfdi} data-explain-title="Factura electrónica (XML)">
          {actual ? <FileCode2 className="h-5 w-5 text-tenue shrink-0" /> : <Upload className="h-5 w-5 text-tenue shrink-0" />}
          <span className="flex-1 min-w-0 text-sm">
            {actual ? <>
              <span className="font-medium break-all">{actual.nombre}</span>
              {cfdi && <span className="block text-tenue">{cfdi.emisor.nombre} · {cfdi.emisor.rfc} · {dinero(cfdi.total)}{cfdi.moneda && cfdi.moneda !== "MXN" ? ` ${cfdi.moneda}` : ""} · {fecha(cfdi.fecha)}</span>}
            </> : <>
              <span className="font-medium">Sube el XML de la factura</span>
              <span className="block text-tenue">Se llena solo. Puedes elegir varios a la vez. Sin XML, captura a mano abajo.</span>
            </>}
          </span>
          {cfdi?.metodoPago && <span data-explain={GLOSARIO.puePpd} data-explain-title="PUE o PPD"><Insignia tono={cfdi.metodoPago === "PUE" ? "ok" : "info"}>{cfdi.metodoPago === "PUE" ? "De contado (PUE)" : "A crédito (PPD)"}</Insignia></span>}
          <input ref={archivo} type="file" accept=".xml,text/xml,application/xml" multiple className="sr-only" onChange={(e) => leerArchivos(e.target.files)} />
        </label>
        {actual?.error && (
          <p className="flex items-start gap-2 rounded-lg bg-aviso-suave px-3 py-2 text-sm"><AlertTriangle className="h-4 w-4 mt-0.5 text-aviso shrink-0" />{actual.error}</p>
        )}

        <form id="registrar-compra" onSubmit={enviar} className="grid gap-4 sm:grid-cols-2">
          {/* Un div y no Campo (que es un <label>): con varios botones adentro, un clic en el
              texto activaría "Dar de alta" sin querer. */}
          <div className="sm:col-span-2 space-y-1.5" role="group" aria-label="Proveedor">
            <span className="text-sm font-medium">Proveedor</span>
            {cfdi && rfc && !prov && porRfc.data && porRfc.data.length !== 1 ? (
              porRfc.data.length > 1 ? (
                <div className="flex flex-wrap gap-2">
                  <span className="text-sm text-tenue w-full">Hay {porRfc.data.length} proveedores con el RFC {rfc}; elige cuál:</span>
                  {porRfc.data.map((p) => <Boton key={p.id} type="button" variante="secundario" onClick={() => { setProv(p); setF((x) => ({ ...x, categoria: x.categoria || p.categoria || "" })); }}>{p.nombre}</Boton>)}
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-tenue">Ningún proveedor tiene el RFC {rfc}.</span>
                  <Boton type="button" onClick={() => alta.mutate(undefined)} cargando={alta.isPending}>Dar de alta a «{cfdi.emisor.nombre ?? rfc}»</Boton>
                  <span className="text-tenue">o elige uno:</span>
                  <SelectorProveedor valor={null} alCambiar={(p) => cargarProveedor(p.id)} className="flex-1 min-w-[220px]" />
                </div>
              )
            ) : (
              <SelectorProveedor valor={prov} alCambiar={(p) => cargarProveedor(p.id)} />
            )}
            {prov && <span className="block text-xs text-tenue">{prov.dias_credito ? `Crédito de ${prov.dias_credito} días` : "De contado (0 días de crédito)"}{prov.rfc ? ` · RFC ${prov.rfc}` : ""}</span>}
          </div>
          <Campo etiqueta={notaCredito ? "Monto de la nota (con IVA)" : "Total (con IVA)"}>
            <Entrada type="number" step="0.01" min="0" value={f.monto} onChange={(e) => setF({ ...f, monto: e.target.value })} className="cifra" required autoFocus={!cfdi} />
          </Campo>
          <Campo etiqueta="Fecha de la factura">
            <Entrada type="date" value={f.fecha} max={hoyISO()} onChange={(e) => setF({ ...f, fecha: e.target.value })} required />
          </Campo>
          <Campo etiqueta="Factura (serie y folio)">
            <Entrada value={f.factura} onChange={(e) => setF({ ...f, factura: e.target.value })} placeholder="A 3354" />
          </Campo>
          <Campo etiqueta="Categoría" ayuda="Material, Fletes, Luz, Nómina… la del proveedor si la dejas igual.">
            <Entrada value={f.categoria} list="categorias-compra" onChange={(e) => setF({ ...f, categoria: e.target.value })} />
            <datalist id="categorias-compra">{categorias.map((c) => <option key={c} value={c} />)}</datalist>
          </Campo>
          <Campo etiqueta="Concepto" className="sm:col-span-2">
            <Entrada value={f.descripcion} onChange={(e) => setF({ ...f, descripcion: e.target.value })} placeholder="Qué se compró" />
          </Campo>
          {!notaCredito && <>
            <Campo etiqueta="Vence el" ayuda={!tocoVence && prov ? "Fecha de la factura más los días de crédito del proveedor." : undefined}>
              <Entrada type="date" value={vence} disabled={f.pagada} onChange={(e) => { setTocoVence(true); setF({ ...f, vence: e.target.value }); }} />
            </Campo>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm pt-6">
                <input type="checkbox" checked={f.pagada} onChange={(e) => setF({ ...f, pagada: e.target.checked })} className="h-4 w-4 accent-[hsl(var(--marca))]" />
                Ya se pagó (de contado)
              </label>
              {f.pagada && <SelectorCuenta valor={f.cuenta} alCambiar={(v) => setF({ ...f, cuenta: v })} />}
            </div>
          </>}
        </form>
      </div>
    </Dialogo>
  );
}

/** Las categorías que ya existen, para no escribir "Fletes" de tres formas. */
function useCategorias() {
  const datos = useQuery({
    queryKey: ["proveedores", "categorias"], staleTime: 10 * 60_000,
    queryFn: () => q<{ categoria: string | null }[]>(supabase.from("proveedores").select("categoria").not("categoria", "is", null).limit(2000)),
  });
  return useMemo(() => [...new Set((datos.data ?? []).map((d) => d.categoria!.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es")), [datos.data]);
}

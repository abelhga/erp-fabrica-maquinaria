import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { FilePlus, History, Lock, Mail, MessageCircle, Pencil, Phone, Plus, Star, Trash2, UserPlus, Users } from "lucide-react";
import { Pagina } from "@/components/layout/Shell";
import { Boton } from "@/components/ui/boton";
import { Insignia } from "@/components/ui/insignia";
import { Kpi } from "@/components/ui/kpi";
import { Cargando, Vacio } from "@/components/ui/estados";
import { Tarjeta, EncabezadoTarjeta } from "@/components/ui/tarjeta";
import { Dialogo } from "@/components/ui/dialogo";
import { AreaTexto, Campo, Entrada, Seleccion } from "@/components/ui/campo";
import { Pestanas, ListaPestanas, ContenidoPestana } from "@/components/ui/pestanas";
import { TablaDatos, type Columna } from "@/components/datos/TablaDatos";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { useSesion } from "@/lib/sesion";
import { dinero, dineroCompacto, fecha } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { Actividades } from "./componentes/Actividades";
import type { Cartera } from "./componentes/Cartera";
import {
  CANAL, ESTADO_COT, ESTADO_PEDIDO, ETAPA, RFC_VALIDO, dineroEn, enlaceWhatsApp, normalizarRfc, useFuentes, useVendedores,
  type Contacto, type VCotizacion, type VOportunidad, type VPedido, haceCuanto,
} from "./comun";
import { Barra } from "./componentes/campos";

interface Cliente {
  id: string; nombre: string; razon_social: string | null; rfc: string | null; regimen_fiscal: string | null; cp_fiscal: string | null;
  uso_cfdi: string | null; giro: string | null; ciudad: string | null; estado: string | null; pais: string; vendedor_id: string | null;
  fuente_id: number | null; es_distribuidor: boolean; dias_credito: number; notas: string | null; activo: boolean; creado_en: string;
  vendedor: { nombre: string } | null;
}
/** En las tarjetas de arriba un millón con centavos no cabe: desde $1 M se abrevia. */
const corto = (n: number) => (Math.abs(Number(n)) >= 1_000_000 ? dineroCompacto(Number(n)) : dinero(Number(n)));

interface MovHoja { id: number; fecha: string; tipo: string; monto: number; descripcion: string | null; factura: string | null; pedido: string | null; cuenta: string | null }

export default function DetalleCliente() {
  const { id } = useParams();
  const { perfil, puede } = useSesion();
  const ir = useNavigate();
  const esGerente = puede("ventas", 3);

  const cli = useQuery({
    queryKey: ["cliente_detalle", id],
    queryFn: () => q<Cliente | null>(supabase.from("clientes").select("*, vendedor:perfiles!clientes_vendedor_id_fkey(nombre)").eq("id", id!).maybeSingle()),
  });
  const resumen = useQuery({
    queryKey: ["v_clientes", id],
    queryFn: () => q<{ saldo: number; compras_12m: number; ultima_compra: string | null; cotizaciones_abiertas: number } | null>(
      supabase.from("v_clientes").select("saldo, compras_12m, ultima_compra, cotizaciones_abiertas").eq("id", id!).maybeSingle()),
  });
  const cartera = useQuery({
    queryKey: ["v_cartera", id],
    queryFn: () => q<Cartera | null>(supabase.from("v_cartera").select("*").eq("cliente_id", id!).maybeSingle()),
  });
  const arranque = useQuery({
    queryKey: ["v_saldo_arranque_clientes", id],
    queryFn: () => q<{ vendido: number | null; pagado: number | null; saldo: number | null; ultima_venta: string | null } | null>(
      supabase.from("v_saldo_arranque_clientes").select("vendido, pagado, saldo, ultima_venta").eq("cliente_id", id!).maybeSingle()),
  });

  const c = cli.data;
  const mio = c?.vendedor_id === perfil?.id;
  const puedeEditar = !!c && puede("ventas", 2) && (!c.vendedor_id || mio || esGerente);
  const contactosVisibles = !!c && (!c.vendedor_id || mio || esGerente || puede("finanzas", 1));

  const tomar = useAccion(
    () => q(supabase.from("clientes").update({ vendedor_id: perfil?.id }).eq("id", id!).is("vendedor_id", null)),
    { exito: "Ahora este cliente es tuyo", invalidar: [["cliente_detalle", id], ["v_clientes"], ["v_cartera"]] },
  );

  if (cli.isLoading) return <div className="p-8"><Cargando filas={8} /></div>;
  if (!c) return <div className="p-8"><div className="tarjeta"><Vacio icono={Users} titulo="No encontramos este cliente" accion={<Boton asChild variante="secundario"><Link to="/ventas/clientes">Ir a clientes</Link></Boton>} /></div></div>;

  return (
    <Pagina titulo={c.nombre}
      descripcion={
        <span className="inline-flex flex-wrap items-center gap-2">
          {[c.razon_social !== c.nombre ? c.razon_social : null, [c.ciudad, c.estado].filter(Boolean).join(", "), c.giro].filter(Boolean).join(" · ")}
          {c.vendedor_id ? (
            <Insignia tono={mio ? "marca" : "neutro"}>
              {mio ? "Cliente tuyo" : `Cliente de ${c.vendedor?.nombre}`}{cartera.data?.vence_en ? ` hasta ${fecha(cartera.data.vence_en)}` : ""}
              {cartera.data?.estado === "vencido" ? " (vencido)" : ""}
            </Insignia>
          ) : <Insignia tono="ok">Libre</Insignia>}
        </span>
      }
      acciones={<>
        {!c.vendedor_id && puede("ventas", 2) && <Boton variante="secundario" onClick={() => tomar.mutate(undefined)} cargando={tomar.isPending}><Star className="h-4 w-4" />Hacerlo mío</Boton>}
        {puede("ventas", 2) && <Boton onClick={() => ir(`/ventas/cotizaciones/nueva?cliente=${c.id}`)}><FilePlus className="h-4 w-4" />Nueva cotización</Boton>}
      </>}>
      <div className="grid gap-3 grid-cols-2 xl:grid-cols-4">
        <Kpi titulo="Saldo por cobrar" icono={History} tono={Number(resumen.data?.saldo ?? 0) > 0.5 ? "aviso" : "ok"}
          valor={contactosVisibles || Number(resumen.data?.saldo) ? corto(resumen.data?.saldo ?? 0) : "Privado"}
          detalle={arranque.data?.saldo ? `+ ${dinero(arranque.data.saldo)} de arranque (hoja)` : "Pedidos del ERP"} />
        <Kpi titulo="Compras 12 meses" icono={History} tono="marca" valor={corto(resumen.data?.compras_12m ?? 0)} detalle="Sin IVA, pedidos del ERP" />
        <Kpi titulo="Última compra" icono={History} tono="neutro"
          valor={(() => { const u = [resumen.data?.ultima_compra, cartera.data?.ultima_venta, arranque.data?.ultima_venta].filter(Boolean).sort().pop(); return u ? haceCuanto(u) : "—"; })()}
          detalle={cartera.data?.ultimo_seguimiento ? `Último seguimiento ${fecha(cartera.data.ultimo_seguimiento)}` : undefined} />
        <Kpi titulo="Cotizaciones abiertas" icono={FilePlus} tono="info" valor={String(resumen.data?.cotizaciones_abiertas ?? 0)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,5fr)_minmax(0,4fr)] items-start">
        <div className="space-y-4 min-w-0">
          <DatosFiscales c={c} editable={puedeEditar} esGerente={esGerente} />
          <Contactos clienteId={c.id} visibles={contactosVisibles} editable={puedeEditar} duenio={c.vendedor?.nombre} />
        </div>
        <Tarjeta>
          <EncabezadoTarjeta titulo="Actividad" descripcion="Llamadas, WhatsApp, visitas y tareas con fecha" />
          <div className="px-5 pb-5"><Actividades clienteId={c.id} puedeCapturar={puede("ventas", 2)} /></div>
        </Tarjeta>
      </div>

      <Historia clienteId={c.id} />
    </Pagina>
  );
}

function DatosFiscales({ c, editable, esGerente }: { c: Cliente; editable: boolean; esGerente: boolean }) {
  const fuentes = useFuentes();
  const vendedores = useVendedores(esGerente);
  const [editando, setEditando] = useState(false);
  const [f, setF] = useState(c);
  useEffect(() => { if (!editando) setF(c); }, [c, editando]);
  const rfc = normalizarRfc(f.rfc ?? "");
  const rfcMalo = rfc !== "" && !RFC_VALIDO.test(rfc);
  const guardar = useAccion(
    () => q(supabase.from("clientes").update({
      nombre: f.nombre.trim(), razon_social: f.razon_social || null, rfc: rfc || null, regimen_fiscal: f.regimen_fiscal || null,
      cp_fiscal: f.cp_fiscal || null, uso_cfdi: f.uso_cfdi || null, giro: f.giro || null, ciudad: f.ciudad || null, estado: f.estado || null,
      pais: f.pais || "México", fuente_id: f.fuente_id, es_distribuidor: f.es_distribuidor, dias_credito: f.dias_credito, notas: f.notas || null,
      ...(esGerente ? { vendedor_id: f.vendedor_id } : {}),
    }).eq("id", c.id)),
    { exito: "Datos guardados", invalidar: [["cliente_detalle", c.id], ["v_clientes"], ["v_cartera"]], alTerminar: () => setEditando(false) },
  );
  const t = (k: keyof Cliente) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  if (!editando) {
    const fila = (et: string, v: React.ReactNode) => (
      <div className="flex justify-between gap-4 py-1.5 border-b border-borde/60 last:border-0 text-sm">
        <span className="text-tenue">{et}</span><span className="text-right font-medium min-w-0 break-words">{v || <span className="text-tenue font-normal">—</span>}</span>
      </div>
    );
    return (
      <Tarjeta>
        <EncabezadoTarjeta titulo="Datos fiscales y comerciales"
          acciones={editable && <Boton variante="secundario" tamano="sm" onClick={() => setEditando(true)}><Pencil className="h-3.5 w-3.5" />Editar</Boton>} />
        <div className="px-5 pb-4 grid sm:grid-cols-2 gap-x-6">
          <div>
            {fila("Razón social", c.razon_social)}
            {fila("RFC", c.rfc && <span className="cifra">{c.rfc}</span>)}
            {fila("Régimen fiscal", c.regimen_fiscal)}
            {fila("CP fiscal / Uso CFDI", [c.cp_fiscal, c.uso_cfdi].filter(Boolean).join(" · "))}
          </div>
          <div>
            {fila("Giro", c.giro)}
            {fila("Ubicación", [c.ciudad, c.estado, c.pais !== "México" ? c.pais : null].filter(Boolean).join(", "))}
            {fila("Crédito", c.dias_credito ? `${c.dias_credito} días` : "Contado")}
            {fila("¿Cómo llegó?", fuentes.data?.find((x) => x.id === c.fuente_id)?.nombre)}
          </div>
          {c.notas && <p className="sm:col-span-2 mt-2 text-sm text-tenue whitespace-pre-line">{c.notas}</p>}
        </div>
      </Tarjeta>
    );
  }
  return (
    <Tarjeta>
      <EncabezadoTarjeta titulo="Editar datos del cliente" />
      <form className="px-5 pb-5 grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); if (!rfcMalo && f.nombre.trim()) guardar.mutate(undefined); }}>
        <Campo etiqueta="Nombre comercial"><Entrada value={f.nombre} onChange={t("nombre")} /></Campo>
        <Campo etiqueta="Razón social"><Entrada value={f.razon_social ?? ""} onChange={t("razon_social")} /></Campo>
        <Campo etiqueta="RFC" error={rfcMalo ? "Formato inválido: 3-4 letras, 6 dígitos de fecha y 3 de homoclave" : undefined}
          ayuda={rfc && !rfcMalo ? "✓ Formato correcto" : undefined}>
          <Entrada value={f.rfc ?? ""} onChange={t("rfc")} className="uppercase" maxLength={15} />
        </Campo>
        <Campo etiqueta="Régimen fiscal"><Entrada value={f.regimen_fiscal ?? ""} onChange={t("regimen_fiscal")} placeholder="601 General de Ley Personas Morales" /></Campo>
        <Campo etiqueta="CP fiscal"><Entrada value={f.cp_fiscal ?? ""} onChange={t("cp_fiscal")} inputMode="numeric" maxLength={5} /></Campo>
        <Campo etiqueta="Uso de CFDI"><Entrada value={f.uso_cfdi ?? ""} onChange={t("uso_cfdi")} placeholder="G03 Gastos en general" /></Campo>
        <Campo etiqueta="Giro"><Entrada value={f.giro ?? ""} onChange={t("giro")} /></Campo>
        <Campo etiqueta="Ciudad"><Entrada value={f.ciudad ?? ""} onChange={t("ciudad")} /></Campo>
        <Campo etiqueta="Estado"><Entrada value={f.estado ?? ""} onChange={t("estado")} /></Campo>
        <Campo etiqueta="País"><Entrada value={f.pais ?? ""} onChange={t("pais")} /></Campo>
        <Campo etiqueta="Días de crédito"><Entrada type="number" min={0} value={f.dias_credito} onChange={(e) => setF({ ...f, dias_credito: Number(e.target.value) || 0 })} /></Campo>
        <Campo etiqueta="¿Cómo llegó?">
          <Seleccion value={f.fuente_id ?? ""} onChange={(e) => setF({ ...f, fuente_id: e.target.value ? Number(e.target.value) : null })}>
            <option value="">—</option>
            {fuentes.data?.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
          </Seleccion>
        </Campo>
        {esGerente && (
          <Campo etiqueta="Vendedor dueño" ayuda="Solo la gerencia reasigna cuentas.">
            <Seleccion value={f.vendedor_id ?? ""} onChange={(e) => setF({ ...f, vendedor_id: e.target.value || null })}>
              <option value="">Libre (sin dueño)</option>
              {vendedores.data?.map((v) => <option key={v.id} value={v.id}>{v.nombre}</option>)}
            </Seleccion>
          </Campo>
        )}
        <label className="flex items-center gap-2 text-sm self-end pb-2">
          <input type="checkbox" checked={f.es_distribuidor} onChange={(e) => setF({ ...f, es_distribuidor: e.target.checked })} /> Es distribuidor
        </label>
        <Campo etiqueta="Notas" className="sm:col-span-2"><AreaTexto value={f.notas ?? ""} onChange={t("notas")} /></Campo>
        <div className="sm:col-span-2 flex justify-end gap-2">
          <Boton type="button" variante="secundario" onClick={() => setEditando(false)}>Cancelar</Boton>
          <Boton type="submit" cargando={guardar.isPending} disabled={rfcMalo || !f.nombre.trim()}>Guardar</Boton>
        </div>
      </form>
    </Tarjeta>
  );
}

function Contactos({ clienteId, visibles, editable, duenio }: { clienteId: string; visibles: boolean; editable: boolean; duenio?: string | null }) {
  const lista = useQuery({
    queryKey: ["contactos", clienteId], enabled: visibles,
    queryFn: () => q<Contacto[]>(supabase.from("contactos").select("*").eq("cliente_id", clienteId).order("principal", { ascending: false }).order("nombre")),
  });
  const [editar, setEditar] = useState<Partial<Contacto> | null>(null);
  const guardar = useAccion(
    async (x: Partial<Contacto>) => {
      const datos = { nombre: x.nombre?.trim(), puesto: x.puesto || null, telefono: x.telefono || null, whatsapp: x.whatsapp || null,
        correo: x.correo || null, domicilio: x.domicilio || null, principal: !!x.principal, notas: x.notas || null };
      if (x.principal) await q(supabase.from("contactos").update({ principal: false }).eq("cliente_id", clienteId).neq("id", x.id ?? ""));
      if (x.id) await q(supabase.from("contactos").update(datos).eq("id", x.id));
      else await q(supabase.from("contactos").insert({ ...datos, cliente_id: clienteId }));
    },
    { exito: "Contacto guardado", invalidar: [["contactos", clienteId]], alTerminar: () => setEditar(null) },
  );
  const borrar = useAccion((cid: string) => q(supabase.from("contactos").delete().eq("id", cid)), { exito: "Contacto borrado", invalidar: [["contactos", clienteId]] });

  return (
    <Tarjeta>
      <EncabezadoTarjeta titulo="Contactos"
        acciones={visibles && editable && <Boton variante="secundario" tamano="sm" onClick={() => setEditar({ principal: !(lista.data?.length) })}><UserPlus className="h-3.5 w-3.5" />Agregar</Boton>} />
      {!visibles ? (
        <div className="mx-5 mb-5 rounded-lg bg-fondo px-4 py-5 text-sm text-tenue flex items-center gap-3">
          <Lock className="h-5 w-5 shrink-0" />
          <span><b className="text-texto">Cliente de {duenio ?? "otro vendedor"} — contactos privados.</b> Si te buscó a ti, pídele a la gerencia que lo reasigne o que compartan el crédito.</span>
        </div>
      ) : lista.isLoading ? <Cargando filas={2} /> : (lista.data?.length ?? 0) === 0 ? (
        <p className="px-5 pb-5 text-sm text-tenue">Sin contactos. Agrega al menos uno con su celular: “los datos son oro”.</p>
      ) : (
        <div className="divide-y divide-borde border-t border-borde">
          {lista.data!.map((x) => (
            <div key={x.id} className="px-5 py-3 flex items-start gap-3">
              <div className="h-9 w-9 rounded-full bg-marca-suave text-marca-texto flex items-center justify-center text-xs font-semibold shrink-0">
                {x.nombre.split(" ").filter((p) => !/^(ing|lic|arq|sr|sra|don|dr)\.?$/i.test(p)).slice(0, 2).map((p) => p[0]).join("").toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{x.nombre}{x.principal && <Insignia tono="marca" className="ml-2">principal</Insignia>}</p>
                {x.puesto && <p className="text-xs text-tenue">{x.puesto}</p>}
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm">
                  {x.telefono && <a href={`tel:${x.telefono.replace(/\s/g, "")}`} className="inline-flex items-center gap-1 text-marca-texto"><Phone className="h-3.5 w-3.5" />{x.telefono}</a>}
                  {x.whatsapp && <a href={enlaceWhatsApp(x.whatsapp, "")} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-ok"><MessageCircle className="h-3.5 w-3.5" />WhatsApp</a>}
                  {x.correo && <a href={`mailto:${x.correo}`} className="inline-flex items-center gap-1 text-marca-texto"><Mail className="h-3.5 w-3.5" />{x.correo}</a>}
                </div>
                {x.domicilio && <p className="text-xs text-tenue mt-1">{x.domicilio}</p>}
              </div>
              {editable && (
                <div className="flex gap-1">
                  <Boton variante="fantasma" tamano="icono" aria-label="Editar contacto" onClick={() => setEditar(x)}><Pencil className="h-4 w-4" /></Boton>
                  <Boton variante="fantasma" tamano="icono" aria-label="Borrar contacto" onClick={() => { if (confirm(`¿Borrar a ${x.nombre}?`)) borrar.mutate(x.id); }}><Trash2 className="h-4 w-4" /></Boton>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <Dialogo abierto={!!editar} alCambiar={(v) => !v && setEditar(null)} titulo={editar?.id ? "Editar contacto" : "Nuevo contacto"}
        pie={<><Boton variante="secundario" onClick={() => setEditar(null)}>Cancelar</Boton><Boton onClick={() => editar && guardar.mutate(editar)} cargando={guardar.isPending} disabled={!editar?.nombre?.trim()}>Guardar</Boton></>}>
        {editar && (
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); if (editar.nombre?.trim()) guardar.mutate(editar); }}>
            <Campo etiqueta="Nombre"><Entrada autoFocus value={editar.nombre ?? ""} onChange={(e) => setEditar({ ...editar, nombre: e.target.value })} /></Campo>
            <Campo etiqueta="Puesto"><Entrada value={editar.puesto ?? ""} onChange={(e) => setEditar({ ...editar, puesto: e.target.value })} /></Campo>
            <Campo etiqueta="Teléfono"><Entrada value={editar.telefono ?? ""} inputMode="tel" onChange={(e) => setEditar({ ...editar, telefono: e.target.value })} /></Campo>
            <Campo etiqueta="WhatsApp"><Entrada value={editar.whatsapp ?? ""} inputMode="tel" onChange={(e) => setEditar({ ...editar, whatsapp: e.target.value })} /></Campo>
            <Campo etiqueta="Correo" className="sm:col-span-2"><Entrada type="email" value={editar.correo ?? ""} onChange={(e) => setEditar({ ...editar, correo: e.target.value })} /></Campo>
            <Campo etiqueta="Domicilio" className="sm:col-span-2"><Entrada value={editar.domicilio ?? ""} onChange={(e) => setEditar({ ...editar, domicilio: e.target.value })} /></Campo>
            <label className="sm:col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={!!editar.principal} onChange={(e) => setEditar({ ...editar, principal: e.target.checked })} /> Contacto principal (sale en las cotizaciones)</label>
            <button type="submit" className="hidden" />
          </form>
        )}
      </Dialogo>
    </Tarjeta>
  );
}

/** Oportunidades, cotizaciones, pedidos y lo que compró antes del ERP (libro de la hoja). */
function Historia({ clienteId }: { clienteId: string }) {
  const ir = useNavigate();
  const [pest, setPest] = useState("cotizaciones");
  const ops = useQuery({ queryKey: ["v_oportunidades", "cliente", clienteId, "todas"], queryFn: () => q<VOportunidad[]>(supabase.from("v_oportunidades").select("*").eq("cliente_id", clienteId).order("creado_en", { ascending: false })) });
  const cots = useQuery({ queryKey: ["v_cotizaciones", "cliente", clienteId], queryFn: () => q<VCotizacion[]>(supabase.from("v_cotizaciones").select("*").eq("cliente_id", clienteId).order("creado_en", { ascending: false })) });
  const peds = useQuery({ queryKey: ["v_pedidos", "cliente", clienteId], queryFn: () => q<VPedido[]>(supabase.from("v_pedidos").select("*").eq("cliente_id", clienteId).order("fecha", { ascending: false })) });
  const hoja = useQuery({ queryKey: ["historial_ventas_hoja", clienteId], queryFn: () => q<MovHoja[]>(supabase.from("historial_ventas_hoja").select("id, fecha, tipo, monto, descripcion, factura, pedido, cuenta").eq("cliente_id", clienteId).order("fecha", { ascending: false }).limit(1000)) });

  const colCot: Columna<VCotizacion>[] = [
    { clave: "folio", titulo: "Folio", celda: (c) => <span className="font-medium cifra">{c.folio}</span> },
    { clave: "fecha", titulo: "Fecha", valor: (c) => c.fecha, celda: (c) => fecha(c.fecha) },
    { clave: "partida", titulo: "Partidas", valor: (c) => c.primera_partida, celda: (c) => <span className="truncate block max-w-[320px]">{c.primera_partida}{c.partidas > 1 ? ` +${c.partidas - 1}` : ""}</span> },
    { clave: "vendedor", titulo: "Vendedor", valor: (c) => c.vendedor },
    { clave: "estado", titulo: "Estado", valor: (c) => c.estado, celda: (c) => <><Insignia tono={ESTADO_COT[c.estado].tono}>{ESTADO_COT[c.estado].texto}</Insignia>{c.vencida && <Insignia tono="peligro" className="ml-1">Vencida</Insignia>}</> },
    { clave: "total", titulo: "Total", alinear: "der", valor: (c) => Number(c.total), celda: (c) => dineroEn(Number(c.total), c.moneda) },
  ];
  const colPed: Columna<VPedido>[] = [
    { clave: "folio", titulo: "Pedido", celda: (p) => <span className="font-medium cifra">{p.folio}</span> },
    { clave: "fecha", titulo: "Fecha", valor: (p) => p.fecha, celda: (p) => fecha(p.fecha) },
    { clave: "canal", titulo: "Canal", valor: (p) => CANAL[p.canal] },
    { clave: "estado", titulo: "Estado", valor: (p) => p.estado, celda: (p) => <Insignia tono={ESTADO_PEDIDO[p.estado].tono}>{ESTADO_PEDIDO[p.estado].texto}</Insignia> },
    { clave: "avance", titulo: "Producción", valor: (p) => p.avance ?? -1, celda: (p) => p.ordenes ? <div className="w-24"><Barra valor={p.avance} /><span className="text-[11px] text-tenue">{p.avance}%</span></div> : <span className="text-tenue">—</span> },
    { clave: "total", titulo: "Total", alinear: "der", valor: (p) => Number(p.total), celda: (p) => dineroEn(Number(p.total), p.moneda) },
    { clave: "saldo", titulo: "Saldo", alinear: "der", valor: (p) => Number(p.saldo), celda: (p) => Number(p.saldo) > 0.5 ? <span className="text-aviso font-medium">{dineroEn(Number(p.saldo), p.moneda)}</span> : "—" },
  ];
  const colHoja: Columna<MovHoja>[] = [
    { clave: "fecha", titulo: "Fecha", valor: (h) => h.fecha, celda: (h) => fecha(h.fecha) },
    { clave: "tipo", titulo: "Movimiento", celda: (h) => <Insignia tono={h.tipo === "Venta" ? "marca" : h.tipo === "Pago" ? "ok" : "aviso"}>{h.tipo}</Insignia> },
    { clave: "descripcion", titulo: "Concepto", celda: (h) => <span className="block max-w-[420px] whitespace-normal">{h.descripcion ?? "—"}</span> },
    { clave: "factura", titulo: "Factura / pedido", valor: (h) => [h.factura, h.pedido].filter(Boolean).join(" · ") || null },
    { clave: "monto", titulo: "Monto", alinear: "der", valor: (h) => Number(h.monto), celda: (h) => <span className={cn(h.tipo === "Pago" && "text-ok")}>{dinero(h.monto)}</span> },
  ];
  const colOp: Columna<VOportunidad>[] = [
    { clave: "titulo", titulo: "Oportunidad", celda: (o) => <span className="font-medium">{o.titulo}</span> },
    { clave: "etapa", titulo: "Etapa", valor: (o) => o.etapa, celda: (o) => <Insignia tono={ETAPA[o.etapa].tono}>{ETAPA[o.etapa].texto}</Insignia> },
    { clave: "vendedor", titulo: "Vendedor", valor: (o) => o.vendedor },
    { clave: "monto", titulo: "Monto", alinear: "der", valor: (o) => Number(o.monto_estimado ?? 0), celda: (o) => dinero(o.monto_estimado) },
  ];

  return (
    <Pestanas value={pest} onValueChange={setPest}>
      <ListaPestanas opciones={[
        { valor: "cotizaciones", texto: "Cotizaciones", cuenta: cots.data?.length },
        { valor: "pedidos", texto: "Pedidos", cuenta: peds.data?.length },
        { valor: "oportunidades", texto: "Oportunidades", cuenta: ops.data?.length },
        { valor: "hoja", texto: "Compras anteriores al ERP", cuenta: hoja.data?.length },
      ]} />
      <ContenidoPestana value="cotizaciones" className="pt-3">
        <TablaDatos filas={cots.data} columnas={colCot} cargando={cots.isLoading} claveFila={(c) => c.id} buscable={false} alClicFila={(c) => ir(`/ventas/cotizaciones/${c.id}`)}
          vacio={{ icono: FilePlus, titulo: "Sin cotizaciones", texto: "Las cotizaciones de otros vendedores no se muestran." }} />
      </ContenidoPestana>
      <ContenidoPestana value="pedidos" className="pt-3">
        <TablaDatos filas={peds.data} columnas={colPed} cargando={peds.isLoading} claveFila={(p) => p.id} buscable={false} alClicFila={(p) => ir(`/ventas/pedidos/${p.id}`)}
          vacio={{ icono: Plus, titulo: "Sin pedidos visibles" }} />
      </ContenidoPestana>
      <ContenidoPestana value="oportunidades" className="pt-3">
        <TablaDatos filas={ops.data} columnas={colOp} cargando={ops.isLoading} claveFila={(o) => o.id} buscable={false} alClicFila={() => ir("/ventas/oportunidades")}
          vacio={{ icono: Plus, titulo: "Sin oportunidades" }} />
      </ContenidoPestana>
      <ContenidoPestana value="hoja" className="pt-3">
        <TablaDatos filas={hoja.data} columnas={colHoja} cargando={hoja.isLoading} claveFila={(h) => String(h.id)} exportarComo="historial-cliente" placeholder="Buscar en el historial…"
          vacio={{ icono: History, titulo: "Sin historial en la hoja", texto: "Aquí sale lo que el cliente compró y pagó según la BASE DE DATOS anterior al ERP (solo el dueño, la gerencia y cobranza)." }} />
      </ContenidoPestana>
    </Pestanas>
  );
}

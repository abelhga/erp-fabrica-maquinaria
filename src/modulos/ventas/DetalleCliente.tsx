import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, FilePlus, History, Lock, Mail, Merge, MessageCircle, Pencil, Phone, Plus, Star, Trash2, UserPlus, Users } from "lucide-react";
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
import { LlenarConConstancia, type DatosConstancia } from "@/components/datos/LlenarConConstancia";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { useSesion } from "@/lib/sesion";
import { dinero, dineroCompacto, fecha } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { Actividades } from "./componentes/Actividades";
import type { Cartera } from "./componentes/Cartera";
import {
  CANAL, ESTADO_COT, ESTADO_PEDIDO, ETAPA, RFC_VALIDO, dineroEn, enlaceWhatsApp, normalizarRfc, useFuentes, useVendedores,
  type Contacto, type EtapaOportunidad, type VCotizacion, type VOportunidad, type VPedido, haceCuanto,
} from "./comun";
import { Barra } from "./componentes/campos";
import { JuntarClientes } from "./componentes/JuntarClientes";
import { EXPLICA_ESTADO_PEDIDO } from "./componentes/EntregaPedido";
import { GLOSARIO } from "@/tutorial/glosario";
import type { ClienteParecido } from "./componentes/dialogos";

interface Cliente {
  id: string; nombre: string; razon_social: string | null; rfc: string | null; regimen_fiscal: string | null; cp_fiscal: string | null;
  uso_cfdi: string | null; giro: string | null; ciudad: string | null; estado: string | null; pais: string; vendedor_id: string | null;
  fuente_id: number | null; es_distribuidor: boolean; dias_credito: number; notas: string | null; activo: boolean; creado_en: string;
  publico_general: boolean; vendedor: { nombre: string } | null;
}
/** En las tarjetas de arriba un millón con centavos no cabe: desde $1 M se abrevia. */
const corto = (n: number) => (Math.abs(Number(n)) >= 1_000_000 ? dineroCompacto(Number(n)) : dinero(Number(n)));

interface MovHoja { id: number; fecha: string; tipo: string; monto: number; descripcion: string | null; factura: string | null; pedido: string | null; cuenta: string | null }

export default function DetalleCliente() {
  const { id } = useParams();
  const { perfil, puede } = useSesion();
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
  const deHoja = Number(arranque.data?.saldo ?? 0);
  const saldoTotal = Number(resumen.data?.saldo ?? 0) + Math.max(deHoja, 0);
  const mio = c?.vendedor_id === perfil?.id;
  const puedeEditar = !!c && puede("ventas", 2) && (!c.vendedor_id || mio || esGerente);
  const contactosVisibles = !!c && (!c.vendedor_id || mio || esGerente || puede("finanzas", 1));

  const tomar = useAccion(
    () => q(supabase.from("clientes").update({ vendedor_id: perfil?.id }).eq("id", id!).is("vendedor_id", null)),
    { exito: "Ahora este cliente es tuyo", invalidar: [["cliente_detalle", id], ["v_clientes"], ["v_cartera"]] },
  );

  // Otro cliente con el mismo RFC casi siempre es el mismo dado de alta dos veces (el de la hoja y el
  // del contacto). Las sucursales sí comparten RFC: por eso es un aviso y no un bloqueo.
  const [juntarAbierto, setJuntarAbierto] = useState(false);
  const [juntarCon, setJuntarCon] = useState<{ id: string; nombre: string } | null>(null);
  const mismoRfc = useQuery({
    queryKey: ["rfc_registrado", c?.rfc], enabled: !!c?.rfc && puede("ventas", 2),
    queryFn: () => q<{ clientes: { id: string; nombre: string; vendedor: string | null }[] }>(supabase.rpc("rfc_registrado", { p_rfc: c!.rfc })),
  });
  const otrosRfc = (mismoRfc.data?.clientes ?? []).filter((x) => x.id !== c?.id);
  const puedeJuntar = !!c && (esGerente || (puede("ventas", 2) && (!c.vendedor_id || mio)));
  const abrirJuntar = (otro: { id: string; nombre: string } | null) => { setJuntarCon(otro); setJuntarAbierto(true); };

  if (cli.isLoading) return <div className="p-8"><Cargando filas={8} /></div>;
  if (!c) return <div className="p-8"><div className="tarjeta"><Vacio icono={Users} titulo="No encontramos este cliente" accion={<Boton asChild variante="secundario"><Link to="/ventas/clientes">Ir a clientes</Link></Boton>} /></div></div>;

  return (
    <Pagina titulo={c.nombre}
      descripcion={
        <span className="inline-flex flex-wrap items-center gap-2">
          {[c.razon_social !== c.nombre ? c.razon_social : null, [c.ciudad, c.estado].filter(Boolean).join(", "), c.giro].filter(Boolean).join(" · ")}
          {c.vendedor_id ? (
            <span data-explain={GLOSARIO.cartera} data-explain-title="Vigencia de la cuenta"><Insignia tono={mio ? "marca" : "neutro"}>
              {mio ? "Cliente tuyo" : `Cliente de ${c.vendedor?.nombre}`}{cartera.data?.vence_en ? ` hasta ${fecha(cartera.data.vence_en)}` : ""}
              {cartera.data?.estado === "vencido" ? " (vencido)" : ""}
            </Insignia></span>
          ) : <span data-explain={GLOSARIO.clienteLibre}><Insignia tono="ok">Libre</Insignia></span>}
        </span>
      }
      acciones={<>
        {!c.vendedor_id && puede("ventas", 2) && <Boton variante="secundario" onClick={() => tomar.mutate(undefined)} cargando={tomar.isPending} data-explain={GLOSARIO.botonHacerloMio}><Star className="h-4 w-4" />Hacerlo mío</Boton>}
        {puedeJuntar && <Boton variante="secundario" onClick={() => abrirJuntar(null)} data-explain={GLOSARIO.juntarClientes} data-explain-title="Juntar con otro cliente"><Merge className="h-4 w-4" />Juntar con otro</Boton>}
        {puede("ventas", 2) && <NuevaCotizacion clienteId={c.id} />}
      </>}>
      {otrosRfc.length > 0 && (
        <div className="rounded-xl border border-aviso/40 bg-aviso-suave px-4 py-3 text-sm flex flex-wrap items-center gap-x-3 gap-y-2">
          <AlertTriangle className="h-4 w-4 text-aviso shrink-0" />
          <p className="flex-1 min-w-[220px]">
            {otrosRfc.length === 1 ? "Hay otro cliente con este RFC: " : "Hay otros clientes con este RFC: "}
            {otrosRfc.map((x, i) => <span key={x.id}>{i > 0 && ", "}<Link to={`/ventas/clientes/${x.id}`} className="font-medium underline">{x.nombre}</Link>{x.vendedor ? ` (de ${x.vendedor})` : ""}</span>)}.
            {" "}Si es la misma empresa, júntalos para que pedidos, saldo y facturas queden en uno; si es una sucursal, déjalos así.
            {!puedeJuntar && " Pídeselo a la gerencia de ventas."}
          </p>
          {puedeJuntar && otrosRfc.length === 1 && <Boton tamano="sm" variante="secundario" onClick={() => abrirJuntar(otrosRfc[0])} data-explain={GLOSARIO.juntarClientes}><Merge className="h-3.5 w-3.5" />Juntar</Boton>}
        </div>
      )}
      <JuntarClientes actual={{ id: c.id, nombre: c.nombre, rfc: c.rfc }} otroInicial={juntarCon} abierto={juntarAbierto} alCambiar={setJuntarAbierto} />
      <div className="grid gap-3 grid-cols-2 xl:grid-cols-4">
        {/* Lo que debía en la hoja va sumado: con los pedidos de hoy (todos de la hoja) el
            número grande decía $0 aunque el cliente debiera. Un saldo a favor no resta. */}
        <Kpi titulo="Saldo por cobrar" icono={History} tono={saldoTotal > 0.5 ? "aviso" : "ok"}
          valor={contactosVisibles || saldoTotal ? corto(saldoTotal) : "Privado"}
          detalle={deHoja > 0.5 ? <span data-explain={GLOSARIO.saldoArranque}>{Number(resumen.data?.saldo ?? 0) > 0.5 ? `${dinero(deHoja)} de la hoja` : "Todo de la hoja"}</span>
            : deHoja < -0.5 ? <span data-explain={GLOSARIO.saldoArranque}>{dinero(-deHoja)} a su favor en la hoja</span> : "Pedidos del ERP"} explica={GLOSARIO.saldoPorCobrar} />
        {/* Del cliente de otro vendedor solo se sabe de quién es y hasta cuándo (la regla de cartera); lo que compra es suyo. */}
        <Kpi titulo="Compras 12 meses" icono={History} tono="marca" valor={contactosVisibles ? corto(resumen.data?.compras_12m ?? 0) : "Privado"} detalle="Sin IVA, pedidos del ERP" explica={GLOSARIO.compras12m} />
        <Kpi titulo="Última compra" icono={History} tono="neutro"
          valor={!contactosVisibles ? "Privado" : (() => { const u = [resumen.data?.ultima_compra, cartera.data?.ultima_venta, arranque.data?.ultima_venta].filter(Boolean).sort().pop(); return u ? haceCuanto(u) : "—"; })()}
          detalle={contactosVisibles && cartera.data?.ultimo_seguimiento ? `Último seguimiento ${fecha(cartera.data.ultimo_seguimiento)}` : undefined}
          explica={GLOSARIO.ultimaCompra} />
        <Kpi titulo="Cotizaciones abiertas" icono={FilePlus} tono="info" valor={String(resumen.data?.cotizaciones_abiertas ?? 0)} explica={GLOSARIO.cotizacionAbierta} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,5fr)_minmax(0,4fr)] items-start">
        <div className="space-y-4 min-w-0">
          <DatosFiscales c={c} editable={puedeEditar} esGerente={esGerente} />
          <Contactos clienteId={c.id} visibles={contactosVisibles} editable={puedeEditar} duenio={c.vendedor?.nombre} />
        </div>
        <Tarjeta>
          <EncabezadoTarjeta titulo="Actividad" descripcion="Llamadas, WhatsApp, visitas y tareas con fecha" explica={GLOSARIO.actividad} />
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
      pais: f.pais || "México", fuente_id: f.fuente_id, es_distribuidor: f.es_distribuidor, publico_general: f.publico_general, dias_credito: f.dias_credito, notas: f.notas || null,
      ...(esGerente ? { vendedor_id: f.vendedor_id } : {}),
    }).eq("id", c.id)),
    { exito: "Datos guardados", invalidar: [["cliente_detalle", c.id], ["v_clientes"], ["v_cartera"]], alTerminar: () => setEditando(false) },
  );
  const t = (k: keyof Cliente) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  // Con la constancia se actualiza lo fiscal; el nombre comercial no se toca.
  const deConstancia = (k: DatosConstancia) => setF((x) => ({
    ...x, razon_social: k.razon_social ?? x.razon_social, rfc: k.rfc ?? x.rfc, regimen_fiscal: k.regimen_fiscal ?? x.regimen_fiscal,
    cp_fiscal: k.cp_fiscal ?? x.cp_fiscal, ciudad: k.ciudad ?? x.ciudad, estado: k.estado ?? x.estado,
  }));

  if (!editando) {
    const fila = (et: string, v: React.ReactNode, explica?: string) => (
      <div className="flex justify-between gap-4 py-1.5 border-b border-borde/60 last:border-0 text-sm">
        <span className="text-tenue" data-explain={explica} data-explain-title={explica ? et : undefined}>{et}</span><span className="text-right font-medium min-w-0 break-words">{v || <span className="text-tenue font-normal">—</span>}</span>
      </div>
    );
    return (
      <Tarjeta>
        <EncabezadoTarjeta titulo="Datos fiscales y comerciales" explica={GLOSARIO.datosFiscalesCliente}
          acciones={editable && <Boton variante="secundario" tamano="sm" onClick={() => setEditando(true)}><Pencil className="h-3.5 w-3.5" />Editar</Boton>} />
        <div className="px-5 pb-4 grid sm:grid-cols-2 gap-x-6">
          <div>
            {fila("Razón social", c.razon_social)}
            {fila("RFC", c.rfc ? <span className="cifra">{c.rfc}</span>
              : c.publico_general && <span data-explain={GLOSARIO.publicoGeneral} data-explain-title="Público en general">Público en general</span>)}
            {fila("Régimen fiscal", c.regimen_fiscal)}
            {fila("CP fiscal / Uso CFDI", [c.cp_fiscal, c.uso_cfdi].filter(Boolean).join(" · "))}
          </div>
          <div>
            {fila("Giro", c.giro)}
            {fila("Ubicación", [c.ciudad, c.estado, c.pais !== "México" ? c.pais : null].filter(Boolean).join(", "))}
            {fila("Crédito", c.dias_credito ? `${c.dias_credito} días` : "Contado", GLOSARIO.diasCreditoCliente)}
            {fila("¿Cómo llegó?", fuentes.data?.find((x) => x.id === c.fuente_id)?.nombre, GLOSARIO.fuenteCliente)}
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
        <LlenarConConstancia para="cliente" alLeer={deConstancia} excluir={c.id} />
        <Campo etiqueta="Nombre comercial"><Entrada value={f.nombre} onChange={t("nombre")} /></Campo>
        <Campo etiqueta="Razón social"><Entrada value={f.razon_social ?? ""} onChange={t("razon_social")} /></Campo>
        <Campo etiqueta="RFC" error={rfcMalo ? "Formato inválido: 3-4 letras, 6 dígitos de fecha y 3 de homoclave" : undefined}
          ayuda={rfc && !rfcMalo ? "✓ Formato correcto" : undefined}>
          <Entrada value={f.rfc ?? ""} onChange={t("rfc")} className="uppercase" maxLength={15} />
        </Campo>
        {/* Con un RFC de verdad la base la apaga sola: no tiene caso ofrecerla. */}
        {!rfc || rfc.startsWith("XAXX") || rfc.startsWith("XEXX") ? (
          <label className="sm:col-span-2 flex items-center gap-2 text-sm" data-explain={GLOSARIO.publicoGeneral} data-explain-title="Público en general">
            <input type="checkbox" checked={f.publico_general} onChange={(e) => setF({ ...f, publico_general: e.target.checked })} />
            Público en general (no pide factura a su nombre)
          </label>
        ) : null}
        <Campo etiqueta="Régimen fiscal"><Entrada value={f.regimen_fiscal ?? ""} onChange={t("regimen_fiscal")} placeholder="601 General de Ley Personas Morales" /></Campo>
        <Campo etiqueta="CP fiscal"><Entrada value={f.cp_fiscal ?? ""} onChange={t("cp_fiscal")} inputMode="numeric" maxLength={5} /></Campo>
        <Campo etiqueta="Uso de CFDI"><Entrada value={f.uso_cfdi ?? ""} onChange={t("uso_cfdi")} placeholder="G03 Gastos en general" /></Campo>
        <Campo etiqueta="Giro"><Entrada value={f.giro ?? ""} onChange={t("giro")} /></Campo>
        <Campo etiqueta="Ciudad"><Entrada value={f.ciudad ?? ""} onChange={t("ciudad")} /></Campo>
        <Campo etiqueta="Estado"><Entrada value={f.estado ?? ""} onChange={t("estado")} /></Campo>
        <Campo etiqueta="País"><Entrada value={f.pais ?? ""} onChange={t("pais")} /></Campo>
        <Campo etiqueta="Días de crédito"><Entrada type="number" min={0} data-explain={GLOSARIO.diasCreditoCliente} data-explain-title="Días de crédito" value={f.dias_credito} onChange={(e) => setF({ ...f, dias_credito: Number(e.target.value) || 0 })} /></Campo>
        <Campo etiqueta="¿Cómo llegó?">
          <Seleccion value={f.fuente_id ?? ""} onChange={(e) => setF({ ...f, fuente_id: e.target.value ? Number(e.target.value) : null })}
            data-explain={GLOSARIO.fuenteCliente} data-explain-title="¿Cómo llegó?">
            <option value="">—</option>
            {fuentes.data?.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
          </Seleccion>
        </Campo>
        {esGerente && (
          <Campo etiqueta="Vendedor dueño" ayuda="Solo la gerencia reasigna cuentas.">
            <Seleccion value={f.vendedor_id ?? ""} onChange={(e) => setF({ ...f, vendedor_id: e.target.value || null })}
              data-explain={GLOSARIO.cartera} data-explain-title="Vendedor dueño">
              <option value="">Libre (sin dueño)</option>
              {vendedores.data?.map((v) => <option key={v.id} value={v.id}>{v.nombre}</option>)}
            </Seleccion>
          </Campo>
        )}
        <label className="flex items-center gap-2 text-sm self-end pb-2" data-explain={GLOSARIO.esDistribuidor} data-explain-title="Distribuidor">
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
  // Al salir de Teléfono, WhatsApp o Correo: ¿ya está en otro cliente? No bloquea; es para juntarlos
  // o, si es de otro vendedor, saber que le llega un aviso (lo manda la base al guardar).
  const [revisar, setRevisar] = useState<{ tel: string; correo: string } | null>(null);
  useEffect(() => { if (!editar) setRevisar(null); }, [editar]);
  const alSalir = () => editar && setRevisar({ tel: [editar.telefono, editar.whatsapp].find((x) => (x ?? "").replace(/\D/g, "").length >= 10) ?? "", correo: editar.correo?.includes("@") ? editar.correo.trim() : "" });
  const otroCliente = useQuery({
    queryKey: ["clientes_parecidos", "contacto", clienteId, revisar?.tel, revisar?.correo],
    enabled: !!revisar && (!!revisar.tel || !!revisar.correo),
    queryFn: () => q<ClienteParecido[]>(supabase.rpc("clientes_parecidos", {
      p_nombre: "", p_telefono: revisar!.tel || null, p_correo: revisar!.correo || null, p_excluir: clienteId,
    })),
  });
  const otros = revisar && (revisar.tel || revisar.correo) ? otroCliente.data ?? [] : [];
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
      <EncabezadoTarjeta titulo="Contactos" explica={GLOSARIO.contactosCliente}
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
                <p className="text-sm font-medium">{x.nombre}{x.principal && <span data-explain={GLOSARIO.contactoPrincipal} data-explain-title="Contacto principal"><Insignia tono="marca" className="ml-2">principal</Insignia></span>}</p>
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
                  <Boton variante="fantasma" tamano="icono" aria-label="Borrar contacto" data-explain={GLOSARIO.botonBorrarContacto} data-explain-title="Borrar contacto" onClick={() => { if (confirm(`¿Borrar a ${x.nombre}?`)) borrar.mutate(x.id); }}><Trash2 className="h-4 w-4" /></Boton>
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
            <Campo etiqueta="Teléfono"><Entrada value={editar.telefono ?? ""} inputMode="tel" onBlur={alSalir} onChange={(e) => setEditar({ ...editar, telefono: e.target.value })} /></Campo>
            <Campo etiqueta="WhatsApp"><Entrada value={editar.whatsapp ?? ""} inputMode="tel" onBlur={alSalir} onChange={(e) => setEditar({ ...editar, whatsapp: e.target.value })} /></Campo>
            <Campo etiqueta="Correo" className="sm:col-span-2"><Entrada type="email" value={editar.correo ?? ""} onBlur={alSalir} onChange={(e) => setEditar({ ...editar, correo: e.target.value })} /></Campo>
            {otros.length > 0 && (
              <div className="sm:col-span-2 rounded-lg border border-aviso/40 bg-aviso-suave px-3 py-2 text-sm space-y-1" role="status"
                data-explain={GLOSARIO.telefonoDeOtroCliente} data-explain-title="Ya está en otro cliente">
                {otros.map((o) => (
                  <p key={o.id} className="flex flex-wrap items-center gap-x-2">
                    <span>{o.por === "correo" ? "Ese correo" : "Ese teléfono"} ya está en «{o.nombre}»{o.vendedor ? ` (de ${o.vendedor})` : ""}</span>
                    <Link to={`/ventas/clientes/${o.id}`} className="text-marca-texto underline">Abrir</Link>
                  </p>
                ))}
              </div>
            )}
            <Campo etiqueta="Domicilio" className="sm:col-span-2"><Entrada value={editar.domicilio ?? ""} onChange={(e) => setEditar({ ...editar, domicilio: e.target.value })} /></Campo>
            <label className="sm:col-span-2 flex items-center gap-2 text-sm" data-explain={GLOSARIO.contactoPrincipal} data-explain-title="Contacto principal"><input type="checkbox" checked={!!editar.principal} onChange={(e) => setEditar({ ...editar, principal: e.target.checked })} /> Contacto principal (sale en las cotizaciones)</label>
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
    { clave: "estado", titulo: "Estado", explica: GLOSARIO.estadoCotizacion, valor: (c) => c.estado, celda: (c) => <><Insignia tono={ESTADO_COT[c.estado].tono}>{ESTADO_COT[c.estado].texto}</Insignia>{c.vencida && <span data-explain={GLOSARIO.vigenciaCotizacion} data-explain-title="Vencida"><Insignia tono="peligro" className="ml-1">Vencida</Insignia></span>}</> },
    { clave: "total", titulo: "Total", alinear: "der", valor: (c) => Number(c.total), celda: (c) => dineroEn(Number(c.total), c.moneda) },
  ];
  const colPed: Columna<VPedido>[] = [
    { clave: "folio", titulo: "Pedido", explica: GLOSARIO.folioPedido, celda: (p) => <span className="font-medium cifra">{p.folio}</span> },
    { clave: "fecha", titulo: "Fecha", valor: (p) => p.fecha, celda: (p) => fecha(p.fecha) },
    { clave: "canal", titulo: "Canal", explica: GLOSARIO.canalVenta, valor: (p) => CANAL[p.canal] },
    { clave: "estado", titulo: "Estado", explica: GLOSARIO.estadoPedido, valor: (p) => p.estado,
      celda: (p) => <span data-explain={EXPLICA_ESTADO_PEDIDO[p.estado]} data-explain-title={ESTADO_PEDIDO[p.estado].texto}><Insignia tono={ESTADO_PEDIDO[p.estado].tono}>{ESTADO_PEDIDO[p.estado].texto}</Insignia></span> },
    { clave: "avance", titulo: "Producción", explica: GLOSARIO.avancePedido, valor: (p) => p.avance ?? -1, celda: (p) => p.ordenes ? <div className="w-24"><Barra valor={p.avance} /><span className="text-[11px] text-tenue">{p.avance}%</span></div> : <span className="text-tenue">—</span> },
    { clave: "total", titulo: "Total", alinear: "der", valor: (p) => Number(p.total), celda: (p) => dineroEn(Number(p.total), p.moneda) },
    { clave: "saldo", titulo: "Saldo", alinear: "der", explica: GLOSARIO.saldoPedido, valor: (p) => Number(p.saldo), celda: (p) => Number(p.saldo) > 0.5 ? <span className="text-aviso font-medium">{dineroEn(Number(p.saldo), p.moneda)}</span> : "—" },
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
    { clave: "etapa", titulo: "Etapa", explica: GLOSARIO.etapaOportunidad, valor: (o) => o.etapa, celda: (o) => <Insignia tono={ETAPA[o.etapa].tono}>{ETAPA[o.etapa].texto}</Insignia> },
    { clave: "vendedor", titulo: "Vendedor", valor: (o) => o.vendedor },
    { clave: "monto", titulo: "Monto", alinear: "der", explica: GLOSARIO.montoEstimado, valor: (o) => Number(o.monto_estimado ?? 0), celda: (o) => dinero(o.monto_estimado) },
  ];

  return (
    <Pestanas value={pest} onValueChange={setPest}>
      <ListaPestanas opciones={[
        { valor: "cotizaciones", texto: "Cotizaciones", cuenta: cots.data?.length },
        { valor: "pedidos", texto: "Pedidos", cuenta: peds.data?.length },
        { valor: "oportunidades", texto: "Oportunidades", cuenta: ops.data?.length },
        { valor: "hoja", texto: "Compras anteriores al ERP", cuenta: hoja.data?.length, explica: GLOSARIO.comprasAnterioresErp },
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

const ABIERTAS: EtapaOportunidad[] = ["prospecto", "contactado", "cotizado", "negociacion"];

/** «Nueva cotización» desde la ficha: sale ligada a la oportunidad abierta del cliente (la del lead,
 *  casi siempre). Antes solo pasaba el cliente y al enviar se abría otra oportunidad, y la del lead
 *  se quedaba en «Contactado» para siempre. Con varias abiertas (o una ya cotizada) pregunta. */
function NuevaCotizacion({ clienteId }: { clienteId: string }) {
  const { perfil, puede } = useSesion();
  const ir = useNavigate();
  const esGerente = puede("ventas", 3);
  const [abierto, setAbierto] = useState(false);
  const ops = useQuery({
    queryKey: ["v_oportunidades", "cliente", clienteId, "para_cotizar"],
    queryFn: () => q<Pick<VOportunidad, "id" | "titulo" | "etapa" | "fuente" | "vendedor_id" | "vendedor" | "creado_en" | "cotizaciones">[]>(
      supabase.from("v_oportunidades").select("id, titulo, etapa, fuente, vendedor_id, vendedor, creado_en, cotizaciones")
        .eq("cliente_id", clienteId).in("etapa", ABIERTAS).order("creado_en", { ascending: false })),
  });
  // La misma que tomaría la base sola: así «Sugerida» no se recalcula aquí.
  const sugerida = useQuery({
    queryKey: ["oportunidad_para_cotizar", clienteId, perfil?.id], enabled: !!perfil?.id,
    queryFn: () => q<string | null>(supabase.rpc("oportunidad_para_cotizar", { p_cliente: clienteId, p_vendedor: perfil!.id })),
  });
  const lista = (ops.data ?? []).filter((o) => o.vendedor_id === perfil?.id || esGerente);
  const ids = lista.map((o) => o.id);
  const deLead = useQuery({
    queryKey: ["leads_de_oportunidades", ids], enabled: abierto && ids.length > 0,
    queryFn: () => q<{ oportunidad_id: string }[]>(supabase.from("leads").select("oportunidad_id").in("oportunidad_id", ids)),
  });
  const vinoDeLead = new Set((deLead.data ?? []).map((l) => l.oportunidad_id));
  const ordenadas = [...lista].sort((a, b) => Number(b.id === sugerida.data) - Number(a.id === sugerida.data)
    || Number(vinoDeLead.has(b.id)) - Number(vinoDeLead.has(a.id)) || b.creado_en.localeCompare(a.creado_en));

  const nueva = (params: string) => { setAbierto(false); ir(`/ventas/cotizaciones/nueva?${params}`); };
  const alDarClic = () => {
    if (!lista.length) nueva(`cliente=${clienteId}`);
    else if (lista.length === 1 && (lista[0].etapa === "prospecto" || lista[0].etapa === "contactado")) nueva(`oportunidad=${lista[0].id}`);
    else setAbierto(true);
  };

  return (
    <>
      <Boton onClick={alDarClic} cargando={ops.isLoading} data-explain={GLOSARIO.botonNuevaCotizacion}><FilePlus className="h-4 w-4" />Nueva cotización</Boton>
      <Dialogo abierto={abierto} alCambiar={setAbierto} titulo="¿Para cuál oportunidad es?"
        descripcion="Al enviar la cotización, la oportunidad que elijas se mueve sola.">
        <div className="space-y-2" data-explain={GLOSARIO.elegirOportunidad} data-explain-title="¿Para cuál oportunidad es?">
          {ordenadas.map((o, i) => (
            <button key={o.id} type="button" autoFocus={i === 0} onClick={() => nueva(`oportunidad=${o.id}`)}
              className="w-full text-left rounded-lg border border-borde px-3 py-2.5 hover:bg-fondo focus:outline-none focus-visible:ring-2 focus-visible:ring-marca">
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{o.titulo}</span>
                <Insignia tono={ETAPA[o.etapa].tono}>{ETAPA[o.etapa].texto}</Insignia>
                {o.id === sugerida.data && <Insignia tono="marca">Sugerida</Insignia>}
              </span>
              <span className="block text-xs text-tenue mt-0.5">
                {[vinoDeLead.has(o.id) ? `Vino de un lead${o.fuente ? " · " + o.fuente : ""}` : o.fuente,
                  esGerente ? o.vendedor : null,
                  o.cotizaciones ? `${o.cotizaciones} cotización${o.cotizaciones === 1 ? "" : "es"}` : "Sin cotizar",
                  `abierta ${haceCuanto(o.creado_en)}`].filter(Boolean).join(" · ")}
              </span>
            </button>
          ))}
          <button type="button" onClick={() => nueva(`cliente=${clienteId}&nueva=1`)}
            className="w-full text-left rounded-lg border border-dashed border-borde px-3 py-2.5 hover:bg-fondo focus:outline-none focus-visible:ring-2 focus-visible:ring-marca">
            <span className="font-medium">Es otro proyecto: abrir una nueva</span>
            <span className="block text-xs text-tenue mt-0.5">La oportunidad se abre al enviar la cotización.</span>
          </button>
        </div>
      </Dialogo>
    </>
  );
}

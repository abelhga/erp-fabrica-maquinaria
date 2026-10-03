import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Dialogo } from "@/components/ui/dialogo";
import { Boton } from "@/components/ui/boton";
import { Campo, Entrada, Seleccion } from "@/components/ui/campo";
import { BuscadorArticulo } from "@/components/datos/BuscadorArticulo";
import { supabase } from "@/lib/supabase";
import { useSesion } from "@/lib/sesion";
import { q, useAccion } from "@/lib/consultas";
import { hoyISO, numero } from "@/lib/formato";
import { CampoNumero } from "@/modulos/ventas/componentes/campos";
import { SubirArchivo } from "./Archivos";
import { CLAVE, useAlmacenes, useChecklist, usePaqueterias, type Envio, type ItemChecklist } from "./datos";

const pie = (cancelar: () => void, boton: React.ReactNode) => <><Boton variante="secundario" onClick={cancelar}>Cancelar</Boton>{boton}</>;

/** Cotizar con los datos que ya trae el envío: nadie vuelve a pedir peso ni medidas. */
export function DialogoCotizar({ envio, abierto, alCambiar }: { envio: Envio; abierto: boolean; alCambiar: (v: boolean) => void }) {
  const paq = usePaqueterias();
  const [f, setF] = useState({ paqueteria: envio.paqueteria_id ?? 0, servicio: envio.servicio ?? "", costo: envio.costo_cotizado ?? 0 });
  useEffect(() => { if (abierto) setF({ paqueteria: envio.paqueteria_id ?? 0, servicio: envio.servicio ?? "", costo: envio.costo_cotizado ?? 0 }); }, [abierto, envio]);
  const guardar = useAccion(() => q(supabase.rpc("cotizar_envio", { p_envio: envio.id, p_costo: f.costo, p_paqueteria: f.paqueteria || null, p_servicio: f.servicio || null })),
    { exito: "Cotización guardada", invalidar: [CLAVE], alTerminar: () => alCambiar(false) });
  return (
    <Dialogo abierto={abierto} alCambiar={alCambiar} titulo={`Cotizar ${envio.folio}`}
      descripcion={<>{envio.bultos} {envio.bultos === 1 ? "bulto" : "bultos"} · <span className="cifra">{numero(envio.peso_total)} kg</span>
        {envio.peso_volumetrico != null && <> · volumétrico <span className="cifra">{numero(envio.peso_volumetrico)} kg</span></>}
        {envio.destino && <> · a {envio.destino}</>}</>}
      pie={pie(() => alCambiar(false), <Boton onClick={() => guardar.mutate(undefined)} cargando={guardar.isPending}>Guardar cotización</Boton>)}>
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); guardar.mutate(undefined); }}>
        <Campo etiqueta="Paquetería">
          <Seleccion value={f.paqueteria} onChange={(e) => setF({ ...f, paqueteria: Number(e.target.value) })}>
            <option value={0}>— elige —</option>
            {(paq.data ?? []).filter((p) => p.activa).map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </Seleccion>
        </Campo>
        <Campo etiqueta="Servicio"><Entrada value={f.servicio} placeholder="Terrestre, día siguiente…" onChange={(e) => setF({ ...f, servicio: e.target.value })} /></Campo>
        <Campo etiqueta="Costo cotizado (con IVA)" className="sm:col-span-2">
          <CampoNumero valor={f.costo} prefijo="$" alCambiar={(n) => setF({ ...f, costo: n })} />
        </Campo>
        <button type="submit" className="hidden" />
      </form>
    </Dialogo>
  );
}

/** Guía con su PDF: queda con el pedido y nadie la vuelve a pedir por chat. */
export function DialogoGuia({ envio, abierto, alCambiar }: { envio: Envio; abierto: boolean; alCambiar: (v: boolean) => void }) {
  const paq = usePaqueterias();
  const [f, setF] = useState({ paqueteria: envio.paqueteria_id ?? 0, numero: "", costo: envio.costo_cotizado as number | null, ruta: null as string | null });
  useEffect(() => { if (abierto) setF({ paqueteria: envio.paqueteria_id ?? 0, numero: envio.numero_guia ?? "", costo: envio.costo_real ?? envio.costo_cotizado, ruta: null }); }, [abierto, envio]);
  const usaSaldo = paq.data?.find((p) => p.id === f.paqueteria)?.usa_saldo;
  const guardar = useAccion(() => q(supabase.rpc("registrar_guia", { p_envio: envio.id, p_numero: f.numero.trim() || null, p_ruta: f.ruta, p_costo: f.costo, p_paqueteria: f.paqueteria || null })),
    { exito: "Guía registrada: almacén ya puede empacar", invalidar: [CLAVE], alTerminar: () => alCambiar(false) });
  const necesitaPdf = envio.tipo === "paqueteria" && !envio.guia_ruta;
  return (
    <Dialogo abierto={abierto} alCambiar={alCambiar} titulo={`Guía de ${envio.folio}`}
      descripcion={envio.tipo === "flete" ? "Transportista, número de carta porte (si hay) y lo que costó." : "Sube el PDF de la guía; el costo se descuenta del saldo de la paquetería."}
      pie={pie(() => alCambiar(false), <Boton onClick={() => guardar.mutate(undefined)} cargando={guardar.isPending}
        disabled={(envio.tipo === "paqueteria" && !f.numero.trim()) || (necesitaPdf && !f.ruta)}>Registrar guía</Boton>)}>
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); guardar.mutate(undefined); }}>
        <Campo etiqueta={envio.tipo === "flete" ? "Transportista" : "Paquetería"}>
          <Seleccion value={f.paqueteria} onChange={(e) => setF({ ...f, paqueteria: Number(e.target.value) })}>
            <option value={0}>— elige —</option>
            {(paq.data ?? []).filter((p) => p.activa).map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </Seleccion>
        </Campo>
        <Campo etiqueta={envio.tipo === "flete" ? "Carta porte o referencia" : "Número de guía"}>
          <Entrada value={f.numero} autoFocus onChange={(e) => setF({ ...f, numero: e.target.value })} className="cifra" />
        </Campo>
        <Campo etiqueta="Lo que costó" ayuda={usaSaldo ? "Se descuenta del saldo." : "Esta paquetería no usa saldo."}>
          <CampoNumero valor={f.costo} prefijo="$" vacioEsCero={false} alCambiar={(n) => setF({ ...f, costo: n })} />
        </Campo>
        <Campo etiqueta="PDF de la guía" ayuda={f.ruta ? "Listo: se guarda al registrar." : envio.guia_ruta ? "Ya hay uno; sube otro solo si cambió." : undefined}>
          <SubirArchivo tipo="guia" envioId={envio.id} pdf maximo={1} texto={f.ruta ? "PDF cargado ✓" : "Subir PDF"} alTerminar={(r) => setF((x) => ({ ...x, ruta: r[0] ?? null }))} />
        </Campo>
        <button type="submit" className="hidden" />
      </form>
    </Dialogo>
  );
}

/** Entregado (o, si lo recoge el cliente, quién se lo llevó). */
export function DialogoEntregado({ envio, abierto, alCambiar }: { envio: Envio; abierto: boolean; alCambiar: (v: boolean) => void }) {
  const [recibio, setRecibio] = useState("");
  useEffect(() => { if (abierto) setRecibio(""); }, [abierto]);
  const recoge = envio.tipo === "recoge";
  const guardar = useAccion(() => q(supabase.rpc("marcar_entregado", { p_envio: envio.id, p_recibio: recibio.trim() || null })),
    { exito: recoge ? "Entregado en planta: salió del inventario" : "Envío entregado", invalidar: [CLAVE, ["pedido"], ["pedido_lineas"], ["v_pedidos"]], alTerminar: () => alCambiar(false) });
  return (
    <Dialogo abierto={abierto} alCambiar={alCambiar} titulo={recoge ? `Se lo llevan: ${envio.folio}` : `Entregado: ${envio.folio}`}
      descripcion={recoge ? "Al entregarlo se descuenta del inventario lo que falte." : "Confirma que el cliente lo recibió."}
      pie={pie(() => alCambiar(false), <Boton variante="exito" onClick={() => guardar.mutate(undefined)} cargando={guardar.isPending} disabled={recoge && !recibio.trim()}>Marcar entregado</Boton>)}>
      <Campo etiqueta={recoge ? "¿Quién se lo llevó?" : "¿Quién lo recibió? (opcional)"}>
        <Entrada autoFocus value={recibio} onChange={(e) => setRecibio(e.target.value)} placeholder={recoge ? "Nombre y, si es chofer, de qué empresa" : "Como aparece en el rastreo"}
          onKeyDown={(e) => { if (e.key === "Enter" && (!recoge || recibio.trim())) guardar.mutate(undefined); }} />
      </Campo>
    </Dialogo>
  );
}

/** Recarga de saldo (o un cargo extra de la paquetería, con monto negativo). */
export function DialogoRecarga({ abierto, alCambiar, paqueteriaId }: { abierto: boolean; alCambiar: (v: boolean) => void; paqueteriaId?: number }) {
  const paq = usePaqueterias();
  const [f, setF] = useState({ paqueteria: paqueteriaId ?? 0, monto: 0, referencia: "", nota: "", fecha: hoyISO() });
  useEffect(() => { if (abierto) setF({ paqueteria: paqueteriaId ?? 0, monto: 0, referencia: "", nota: "", fecha: hoyISO() }); }, [abierto, paqueteriaId]);
  const guardar = useAccion(() => q(supabase.rpc("registrar_recarga", { p_paqueteria: f.paqueteria, p_monto: f.monto, p_referencia: f.referencia || null, p_nota: f.nota || null, p_fecha: f.fecha })),
    { exito: "Recarga registrada", invalidar: [CLAVE], alTerminar: () => alCambiar(false) });
  return (
    <Dialogo abierto={abierto} alCambiar={alCambiar} titulo="Registrar recarga de saldo"
      descripcion="Lo que se depositó en la plataforma de la paquetería. Un cargo por sobrepeso va en negativo, con su explicación."
      pie={pie(() => alCambiar(false), <Boton onClick={() => guardar.mutate(undefined)} cargando={guardar.isPending} disabled={!f.paqueteria || !f.monto}>Registrar</Boton>)}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Paquetería">
          <Seleccion value={f.paqueteria} onChange={(e) => setF({ ...f, paqueteria: Number(e.target.value) })}>
            <option value={0}>— elige —</option>
            {(paq.data ?? []).filter((p) => p.activa && p.usa_saldo).map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </Seleccion>
        </Campo>
        <Campo etiqueta="Monto"><CampoNumero valor={f.monto} prefijo="$" alCambiar={(n) => setF({ ...f, monto: n })} /></Campo>
        <Campo etiqueta="Fecha"><Entrada type="date" value={f.fecha} max={hoyISO()} onChange={(e) => setF({ ...f, fecha: e.target.value })} /></Campo>
        <Campo etiqueta="Referencia"><Entrada value={f.referencia} placeholder="SPEI, folio de la plataforma…" onChange={(e) => setF({ ...f, referencia: e.target.value })} /></Campo>
        {f.monto < 0 && <Campo etiqueta="¿Qué fue?" className="sm:col-span-2"><Entrada value={f.nota} placeholder="Cargo por sobrepeso de la guía…" onChange={(e) => setF({ ...f, nota: e.target.value })} /></Campo>}
      </div>
    </Dialogo>
  );
}

/** Envío a Full: almacén elige qué manda a la bodega de Mercado Libre y de dónde sale. */
export function DialogoEnvioFull({ abierto, alCambiar, alCrear }: { abierto: boolean; alCambiar: (v: boolean) => void; alCrear: (id: string) => void }) {
  const almacenes = useAlmacenes();
  const paq = usePaqueterias();
  const [lineas, setLineas] = useState<{ articulo_id: string; nombre: string; clave: string; cantidad: number; almacen_id: number | null; existencia: number | null }[]>([]);
  const [paqueteria, setPaqueteria] = useState(0);
  const [fecha, setFecha] = useState("");
  const [notas, setNotas] = useState("");
  useEffect(() => { if (abierto) { setLineas([]); setPaqueteria(0); setFecha(""); setNotas(""); } }, [abierto]);
  const crear = useAccion(() => q<string>(supabase.rpc("envio_a_full", {
    p_lineas: lineas.map((l) => ({ articulo_id: l.articulo_id, cantidad: l.cantidad, almacen_id: l.almacen_id })),
    p_paqueteria: paqueteria || null, p_notas: notas || null, p_fecha_recoleccion: fecha || null,
  })), { exito: "Envío a Full creado: ahora a empacarlo", invalidar: [CLAVE], alTerminar: (id) => { alCambiar(false); alCrear(id); } });
  return (
    <Dialogo abierto={abierto} alCambiar={alCambiar} titulo="Envío a Full" ancho="max-w-2xl"
      descripcion="Mercancía para la bodega de Mercado Libre. Al salir se vuelve un traspaso a Almacén ML, con fotos y check list como cualquier envío."
      pie={pie(() => alCambiar(false), <Boton onClick={() => crear.mutate(undefined)} cargando={crear.isPending} disabled={lineas.length === 0 || lineas.some((l) => !l.cantidad)}>Crear envío</Boton>)}>
      <div className="space-y-3">
        <BuscadorArticulo tipos={["componente", "materia_prima"]} mostrarPrecio={false} placeholder="Agregar artículo…"
          alElegir={(a) => setLineas((ls) => ls.some((l) => l.articulo_id === a.id) ? ls
            : [...ls, { articulo_id: a.id, nombre: a.nombre, clave: a.clave, cantidad: 1, almacen_id: null, existencia: a.existencia }])} />
        {lineas.length === 0 ? <p className="text-sm text-tenue">Busca por nombre o clave lo que va a Full; Enter lo agrega.</p> : (
          <div className="space-y-2">
            {lineas.map((l, i) => (
              <div key={l.articulo_id} className="grid grid-cols-[1fr_6rem_9rem_auto] items-center gap-2">
                <div className="min-w-0"><p className="truncate text-sm font-medium">{l.nombre}</p>
                  <p className="text-xs text-tenue cifra">{l.clave}{l.existencia != null && ` · ${numero(l.existencia)} en planta`}</p></div>
                <CampoNumero valor={l.cantidad} decimales={3} min={0} etiqueta={`Cantidad de ${l.nombre}`}
                  alCambiar={(n) => setLineas((ls) => ls.map((x, j) => (j === i ? { ...x, cantidad: n } : x)))} />
                <Seleccion value={l.almacen_id ?? ""} aria-label="Sale de" onChange={(e) => setLineas((ls) => ls.map((x, j) => (j === i ? { ...x, almacen_id: e.target.value ? Number(e.target.value) : null } : x)))}>
                  <option value="">Donde haya</option>
                  {(almacenes.data ?? []).filter((a) => a.disponible_para_planta).map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                </Seleccion>
                <Boton variante="fantasma" tamano="icono" aria-label="Quitar" onClick={() => setLineas((ls) => ls.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Boton>
              </div>
            ))}
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-3 pt-2">
          <Campo etiqueta="Paquetería">
            <Seleccion value={paqueteria} onChange={(e) => setPaqueteria(Number(e.target.value))}>
              <option value={0}>— después —</option>
              {(paq.data ?? []).filter((p) => p.activa).map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </Seleccion>
          </Campo>
          <Campo etiqueta="Cita / recolección"><Entrada type="date" value={fecha} min={hoyISO()} onChange={(e) => setFecha(e.target.value)} /></Campo>
          <Campo etiqueta="Notas"><Entrada value={notas} placeholder="Folio de la cita de ML…" onChange={(e) => setNotas(e.target.value)} /></Campo>
        </div>
      </div>
    </Dialogo>
  );
}

/** Catálogo de paqueterías y check list de salida (gerencia o almacén 3). */
export function DialogoConfigurar({ abierto, alCambiar }: { abierto: boolean; alCambiar: (v: boolean) => void }) {
  const { puede } = useSesion();
  // El check list lo ajusta también la jefatura de almacén; las paqueterías (y su saldo mínimo), la gerencia.
  const editaPaq = puede("envios", 3);
  const paq = usePaqueterias();
  const check = useChecklist();
  const [nueva, setNueva] = useState("");
  const [item, setItem] = useState<{ aplica: ItemChecklist["aplica"]; texto: string }>({ aplica: "componente", texto: "" });
  const inv = { invalidar: [CLAVE] };
  const altaPaq = useAccion(() => q(supabase.from("paqueterias").insert({ nombre: nueva.trim() })), { ...inv, exito: "Paquetería agregada", alTerminar: () => setNueva("") });
  const cambiarPaq = useAccion((a: { id: number; cambios: Record<string, unknown> }) => q(supabase.from("paqueterias").update(a.cambios).eq("id", a.id)), inv);
  const altaItem = useAccion(() => q(supabase.from("checklist_salida").insert({ aplica: item.aplica, texto: item.texto.trim(), orden: 50 })),
    { ...inv, exito: "Punto agregado al check list", alTerminar: () => setItem({ ...item, texto: "" }) });
  const cambiarItem = useAccion((a: { id: number; activo: boolean }) => q(supabase.from("checklist_salida").update({ activo: a.activo }).eq("id", a.id)), inv);
  return (
    <Dialogo abierto={abierto} alCambiar={alCambiar} titulo="Paqueterías y check list" ancho="max-w-3xl">
      <div className="grid gap-6 md:grid-cols-2">
        <section className="space-y-2">
          <h4 className="font-semibold">Paqueterías</h4>
          {(paq.data ?? []).map((p) => (
            <div key={p.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4 accent-marca" checked={p.activa} aria-label={`${p.nombre} activa`} disabled={!editaPaq}
                onChange={(e) => cambiarPaq.mutate({ id: p.id, cambios: { activa: e.target.checked } })} />
              <span className="flex-1 truncate">{p.nombre}</span>
              <label className="flex items-center gap-1 text-xs text-tenue">
                <input type="checkbox" className="h-3.5 w-3.5 accent-marca" checked={p.usa_saldo} disabled={!editaPaq} onChange={(e) => cambiarPaq.mutate({ id: p.id, cambios: { usa_saldo: e.target.checked } })} />saldo
              </label>
              {p.usa_saldo && (
                <CampoNumero className="w-28" valor={p.saldo_minimo} prefijo="$" vacioEsCero={false} placeholder="mínimo" etiqueta={`Saldo mínimo de ${p.nombre}`} deshabilitado={!editaPaq}
                  alCambiar={(n) => cambiarPaq.mutate({ id: p.id, cambios: { saldo_minimo: n } })} />
              )}
            </div>
          ))}
          {editaPaq ? <form className="flex gap-2 pt-1" onSubmit={(e) => { e.preventDefault(); if (nueva.trim()) altaPaq.mutate(undefined); }}>
            <Entrada value={nueva} placeholder="Otra paquetería" onChange={(e) => setNueva(e.target.value)} />
            <Boton type="submit" variante="secundario" disabled={!nueva.trim()}><Plus className="h-4 w-4" /></Boton>
          </form> : <p className="text-xs text-tenue">Las paqueterías y su saldo mínimo las cambia la gerencia de ventas.</p>}
        </section>
        <section className="space-y-2">
          <h4 className="font-semibold">Check list de salida</h4>
          {(["equipo", "componente", "todos"] as const).map((a) => (
            <div key={a}>
              <p className="etiqueta mb-1">{a === "equipo" ? "Equipos" : a === "componente" ? "Componentes" : "Todos los envíos"}</p>
              {(check.data ?? []).filter((c) => c.aplica === a).map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm py-0.5">
                  <input type="checkbox" className="h-4 w-4 accent-marca" checked={c.activo} onChange={(e) => cambiarItem.mutate({ id: c.id, activo: e.target.checked })} />
                  <span className={c.activo ? "" : "text-tenue line-through"}>{c.texto}</span>
                </label>
              ))}
            </div>
          ))}
          <form className="flex gap-2 pt-1" onSubmit={(e) => { e.preventDefault(); if (item.texto.trim()) altaItem.mutate(undefined); }}>
            <Seleccion className="w-44 shrink-0" value={item.aplica} onChange={(e) => setItem({ ...item, aplica: e.target.value as ItemChecklist["aplica"] })}>
              <option value="equipo">Equipo</option><option value="componente">Componente</option><option value="todos">Todos</option>
            </Seleccion>
            <Entrada value={item.texto} placeholder="Nuevo punto" onChange={(e) => setItem({ ...item, texto: e.target.value })} />
            <Boton type="submit" variante="secundario" disabled={!item.texto.trim()}><Plus className="h-4 w-4" /></Boton>
          </form>
        </section>
      </div>
    </Dialogo>
  );
}


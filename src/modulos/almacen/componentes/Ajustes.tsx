import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftRight, CheckCircle2, ClipboardCheck, MessageSquareText, Scale, ShieldAlert, X } from "lucide-react";
import { BuscadorArticulo, type ArticuloEncontrado } from "@/components/datos/BuscadorArticulo";
import { TablaDatos, Filtro, type Columna } from "@/components/datos/TablaDatos";
import { Boton } from "@/components/ui/boton";
import { Tarjeta, EncabezadoTarjeta } from "@/components/ui/tarjeta";
import { Insignia } from "@/components/ui/insignia";
import { Cargando } from "@/components/ui/estados";
import { useSesion } from "@/lib/sesion";
import { supabase } from "@/lib/supabase";
import { mensajeError, q, useAccion } from "@/lib/consultas";
import { dinero, fecha, fechaYHora, hace, numero } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { GLOSARIO } from "@/tutorial/glosario";
import { CantidadConSigno, nombreCorto, useAlmacenes } from "./comun";

export interface Ajuste {
  id: string; folio: string; articulo_id: string; clave: string; nombre: string; unidad: string; almacen_id: number; almacen: string;
  cantidad_sistema: number; cantidad_fisica: number; diferencia: number; motivo: string; conteo: string | null; estado: "pendiente" | "aprobado" | "rechazado";
  solicitado_por: string; solicitado_por_nombre: string | null; solicitado_en: string; resuelto_por_nombre: string | null; resuelto_en: string | null;
  comentario: string | null; existencia_actual: number | null; aplicado: number | null; valor_diferencia: number | null;
  requiere_explicacion: boolean; notas: NotaAjuste[];
  recontado: { en: string; conteo: string; contado: number; sistema: number | null } | null;
}

export interface NotaAjuste { tipo: "pregunta" | "explicacion"; texto: string; en: string; por: string | null; para: string | null }

/**
 * Ajustes: la única forma de corregir una existencia. Lo pide quien encontró la
 * diferencia y lo autoriza la gerencia de producción o dirección, nunca almacén
 * (la base lo exige: quien cuenta no da por buena su diferencia); hasta entonces la
 * existencia no se mueve. Así se acaba el "regresar a una fila vieja y cambiarla".
 */
export function Ajustes() {
  const { puede, tieneRol, perfil } = useSesion();
  const verCostos = puede("costos", 1);
  const resuelve = tieneRol("direccion") || tieneRol("gerente_produccion");
  const [vista, setVista] = useState<"todos" | "aprobado" | "rechazado">("todos");

  const datos = useQuery({
    queryKey: ["v_ajustes"],
    queryFn: () => q<Ajuste[]>(supabase.from("v_ajustes").select("*").order("solicitado_en", { ascending: false }).limit(1000)),
  });
  const pendientes = (datos.data ?? []).filter((a) => a.estado === "pendiente");
  const resueltos = (datos.data ?? []).filter((a) => a.estado !== "pendiente" && (vista === "todos" || a.estado === vista));
  const netoPendiente = pendientes.reduce((s, a) => s + Number(a.valor_diferencia ?? 0), 0);

  const columnas: Columna<Ajuste>[] = [
    { clave: "folio", titulo: "Folio", clase: "whitespace-nowrap font-medium" },
    { clave: "solicitado_en", titulo: "Pedido", clase: "whitespace-nowrap text-xs text-tenue", celda: (a) => fecha(a.solicitado_en) },
    { clave: "nombre", titulo: "Artículo", clase: "min-w-[220px]", celda: (a) => <><p>{a.nombre}</p><p className="text-xs text-tenue">{a.clave}</p></> },
    { clave: "almacen", titulo: "Almacén", clase: "whitespace-nowrap", celda: (a) => nombreCorto(a.almacen) },
    { clave: "diferencia", titulo: "Diferencia", alinear: "der", sinBusqueda: true, explica: GLOSARIO.diferenciaAjusteInventario, valor: (a) => Number(a.aplicado ?? a.diferencia),
      celda: (a) => (
        <div>
          <CantidadConSigno n={Number(a.estado === "aprobado" ? a.aplicado : a.diferencia)} unidad={a.unidad} />
          <p className="text-[11px] text-tenue cifra">{numero(a.cantidad_sistema)} → {numero(a.cantidad_fisica)}</p>
        </div>
      ) },
    { clave: "valor_diferencia", titulo: "Valor", alinear: "der", sinBusqueda: true, oculta: !verCostos, explica: GLOSARIO.valorNetoDiferenciasInventario,
      celda: (a) => a.valor_diferencia == null ? "—" : <span className={Number(a.valor_diferencia) < 0 ? "text-peligro" : ""}>{dinero(a.valor_diferencia)}</span> },
    { clave: "motivo", titulo: "Motivo", clase: "max-w-[240px] text-tenue", celda: (a) => <span className="line-clamp-2" title={a.motivo}>{a.motivo}</span> },
    { clave: "estado", titulo: "Resultado", explica: GLOSARIO.estadoAjusteInventario,
      celda: (a) => <Insignia tono={a.estado === "aprobado" ? "ok" : "peligro"}>{a.estado === "aprobado" ? "Aprobado" : "Rechazado"}</Insignia> },
    { clave: "quien", titulo: "Pidió · autorizó", valor: (a) => `${a.solicitado_por_nombre ?? ""} ${a.resuelto_por_nombre ?? ""}`, clase: "text-xs",
      celda: (a) => <><p>{a.solicitado_por_nombre}</p><p className="text-tenue">{a.resuelto_por_nombre} · {fecha(a.resuelto_en)}</p></> },
    { clave: "comentario", titulo: "Comentario", clase: "max-w-[200px] text-xs text-tenue", celda: (a) => <span className="line-clamp-2">{a.comentario ?? "—"}</span> },
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,420px)_1fr] items-start">
        {puede("inventario", 2) ? <SolicitarAjuste /> : (
          <Tarjeta className="p-5 text-sm text-tenue">
            Los ajustes los pide almacén cuando el conteo no cuadra y los autoriza la gerencia. Aquí ves cuáles hay y quién los autorizó.
          </Tarjeta>
        )}

        <Tarjeta>
          <EncabezadoTarjeta
            titulo={<span className="flex items-center gap-2">Por autorizar <span className="rounded-full bg-fondo px-2 text-xs cifra">{pendientes.length}</span></span>}
            explica={GLOSARIO.ajusteInventario}
            descripcion={resuelve ? "Revisa el motivo y, si hace falta, que alguien lo vuelva a contar." : "Los autoriza la gerencia de producción o dirección; almacén cuenta y los pide."}
            acciones={verCostos && pendientes.length > 0 && (
              <span className="text-sm text-tenue" data-explain={GLOSARIO.valorNetoDiferenciasInventario} data-explain-title="Neto">Neto: <b className={cn("cifra", netoPendiente < 0 ? "text-peligro" : "text-texto")}>{dinero(netoPendiente)}</b></span>
            )}
          />
          <div className="px-4 pb-4">
            {datos.isLoading ? <Cargando filas={3} /> : pendientes.length === 0 ? (
              <div className="flex items-center gap-2 py-8 justify-center text-sm text-tenue"><CheckCircle2 className="h-5 w-5 text-ok" /> No hay ajustes esperando autorización.</div>
            ) : (
              <div className="grid gap-3 xl:grid-cols-2">
                {pendientes.map((a) => <TarjetaPendiente key={a.id} a={a} resuelve={resuelve} explica={puede("inventario", 2) && !resuelve} esMio={a.solicitado_por === perfil?.id} verCostos={verCostos} />)}
              </div>
            )}
          </div>
        </Tarjeta>
      </div>

      <div>
        <h3 className="font-semibold mb-2">Historial de ajustes</h3>
        <TablaDatos
          filas={resueltos}
          columnas={columnas}
          cargando={datos.isLoading}
          error={datos.error}
          claveFila={(a) => a.id}
          exportarComo="ajustes-inventario"
          placeholder="Buscar por artículo, folio o motivo…"
          compacta
          filtros={<Filtro valor={vista} alCambiar={setVista} opciones={[{ valor: "todos", texto: "Todos" }, { valor: "aprobado", texto: "Aprobados" }, { valor: "rechazado", texto: "Rechazados" }]} />}
          vacio={{ icono: Scale, titulo: "Todavía no hay ajustes resueltos", texto: "Cuando la gerencia apruebe o rechace un ajuste, quedará aquí con quién y cuándo." }}
        />
      </div>
    </div>
  );
}

function TarjetaPendiente({ a, resuelve, explica, esMio, verCostos }: { a: Ajuste; resuelve: boolean; explica: boolean; esMio: boolean; verCostos: boolean }) {
  const [comentario, setComentario] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<null | "pedir" | "traspaso" | "explicar">(null);
  const invalidar = [["v_ajustes"], ["ajustes_pendientes_cuenta"], ["v_existencias"], ["kardex"], ["indicadores"]];
  const resolver = useAccion((aprobar: boolean) => q(supabase.rpc("resolver_ajuste", { p_ajuste: a.id, p_aprobar: aprobar, p_comentario: comentario.trim() || null })), {
    exito: () => `Ajuste ${a.folio} resuelto`,
    invalidar,
  });
  // La base es la que decide quién autoriza; aquí solo se muestra su razón junto al ajuste.
  const intentar = (aprobar: boolean) => {
    setError(null);
    resolver.mutate(aprobar, { onError: (e) => setError(mensajeError(e)) });
  };
  // Al autorizar se aplica la diferencia sobre lo de hoy (no se deja lo contado): se avisa en qué quedará.
  const hoy = Number(a.existencia_actual ?? 0);
  const cambio = hoy !== Number(a.cantidad_sistema);
  const queda = hoy + Number(a.diferencia);
  const explicado = a.notas.some((n) => n.tipo === "explicacion");
  const falta = a.requiere_explicacion && !explicado && !a.recontado;

  return (
    <div className={cn("rounded-lg border p-3 space-y-2.5", falta ? "border-aviso/60" : "border-borde")}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm truncate" title={a.nombre}>{a.nombre}</p>
          <p className="text-xs text-tenue">{a.folio} · {a.clave} · {a.almacen}</p>
        </div>
        <div className="text-right">
          <CantidadConSigno n={Number(a.diferencia)} unidad={a.unidad} className="text-lg" />
          {verCostos && a.valor_diferencia != null && <p className="text-xs text-tenue cifra">{dinero(a.valor_diferencia)}</p>}
        </div>
      </div>
      <p className="text-sm">
        Sistema <b className="cifra">{numero(a.cantidad_sistema)}</b> → contado <b className="cifra">{numero(a.cantidad_fisica)}</b>
        {cambio && (queda < 0
          ? <span className="text-peligro text-xs"> · hoy hay {numero(hoy)}: no alcanza para esta diferencia, que se vuelva a contar</span>
          : <span className="text-aviso text-xs"> · hoy hay {numero(hoy)}: quedará en {numero(queda)}</span>)}
      </p>
      <p className="text-sm text-tenue bg-fondo rounded-md px-2.5 py-1.5">“{a.motivo}”</p>
      <p className="text-xs text-tenue">Pidió {a.solicitado_por_nombre ?? "—"} · {hace(a.solicitado_en)} ({fechaYHora(a.solicitado_en)}){a.conteo && ` · ${a.conteo}`}</p>

      {(a.notas.length > 0 || a.requiere_explicacion) && (
        <div className="space-y-1.5" data-explain={GLOSARIO.explicacionAjuste} data-explain-title="Explicación">
          {a.notas.map((n, i) => (
            <div key={i} className={cn("rounded-md px-2.5 py-1.5 text-sm", n.tipo === "explicacion" ? "bg-ok-suave" : "bg-aviso-suave")}>
              <p className="text-[11px] text-tenue">
                {n.tipo === "explicacion" ? `Explicó ${n.por ?? "—"}` : `${n.por ?? "—"} le preguntó a ${n.para ?? "—"}`} · {hace(n.en)}
              </p>
              <p>{n.texto}</p>
            </div>
          ))}
          {falta && (
            <p className="text-xs text-aviso flex items-center gap-1">
              <MessageSquareText className="h-3.5 w-3.5" />
              {a.notas.length > 0 ? "Esperando la explicación." : "Diferencia de valor alto: necesita explicación antes de aprobarse."}
            </p>
          )}
        </div>
      )}

      {a.recontado && (
        <p className="text-xs rounded-md bg-ok-suave px-2.5 py-1.5" data-explain={GLOSARIO.ajusteRecontado} data-explain-title="Ya se volvió a contar">
          Se volvió a contar el {fecha(a.recontado.en)} ({a.recontado.conteo}): había <b className="cifra">{numero(a.recontado.contado)}</b>.
          El sistema ya quedó en lo que hay, así que este ajuste solo se rechaza (queda de constancia).
        </p>
      )}

      {explica && abierto !== "explicar" && (
        <Boton variante="secundario" tamano="sm" onClick={() => setAbierto("explicar")} data-explain={GLOSARIO.explicacionAjuste} data-explain-title="Explicar">
          <MessageSquareText className="h-4 w-4" /> {explicado ? "Agregar explicación" : "Explicar la diferencia"}
        </Boton>
      )}
      {abierto === "explicar" && <Explicar a={a} alTerminar={() => setAbierto(null)} />}

      {resuelve && (
        <div className="space-y-2 pt-1">
          {esMio && <p className="text-xs text-aviso flex items-center gap-1"><ShieldAlert className="h-3.5 w-3.5" /> Lo pediste tú: lo debe autorizar otra persona.</p>}
          <input className="campo h-8 text-sm" placeholder={a.recontado ? `Ej. Recontado el ${fecha(a.recontado.en)}: había ${numero(a.recontado.contado)}` : "Comentario (opcional)"} value={comentario} onChange={(e) => setComentario(e.target.value)} />
          <div className="flex gap-2">
            {!a.recontado && <Boton variante="exito" tamano="sm" className="flex-1" onClick={() => intentar(true)} cargando={resolver.isPending && resolver.variables === true}
              data-explain={GLOSARIO.botonAprobarAjuste} data-explain-title="Aprobar">
              <ClipboardCheck className="h-4 w-4" /> Aprobar
            </Boton>}
            <Boton variante="secundario" tamano="sm" className="flex-1" onClick={() => intentar(false)} cargando={resolver.isPending && resolver.variables === false}
              data-explain={GLOSARIO.botonRechazarAjuste} data-explain-title="Rechazar">
              <X className="h-4 w-4" /> Rechazar
            </Boton>
          </div>
          {!a.recontado && <div className="flex gap-2">
            <Boton variante={falta ? "primario" : "fantasma"} tamano="sm" className="flex-1" onClick={() => setAbierto(abierto === "pedir" ? null : "pedir")}
              data-explain={GLOSARIO.botonPedirExplicacionAjuste} data-explain-title="Pedir explicación">
              <MessageSquareText className="h-4 w-4" /> Pedir explicación
            </Boton>
            <Boton variante="fantasma" tamano="sm" className="flex-1" onClick={() => setAbierto(abierto === "traspaso" ? null : "traspaso")}
              data-explain={GLOSARIO.botonAjusteComoTraspaso} data-explain-title="Fue un traspaso">
              <ArrowLeftRight className="h-4 w-4" /> Fue un traspaso
            </Boton>
          </div>}
          {abierto === "pedir" && <PedirExplicacion a={a} alTerminar={() => setAbierto(null)} />}
          {abierto === "traspaso" && <ComoTraspaso a={a} comentario={comentario} invalidar={invalidar} alTerminar={() => setAbierto(null)} />}
          {error && <p className="text-xs text-peligro bg-peligro-suave rounded-md px-2 py-1.5">No se pudo: {error}</p>}
        </div>
      )}
    </div>
  );
}

function Explicar({ a, alTerminar }: { a: Ajuste; alTerminar: () => void }) {
  const [texto, setTexto] = useState("");
  const guardar = useAccion(() => q(supabase.rpc("explicar_ajuste", { p_ajuste: a.id, p_texto: texto.trim() })), {
    exito: "Explicación guardada: le llegó a quien la pidió",
    invalidar: [["v_ajustes"]],
    alTerminar,
  });
  return (
    <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); if (texto.trim().length >= 10) guardar.mutate(undefined); }}>
      <textarea autoFocus className="campo min-h-[64px] text-sm" value={texto} onChange={(e) => setTexto(e.target.value)}
        placeholder="Qué pasó o dónde están. Ej. las 4 están en Contenedor 1, se movieron para la OP de la cribadora" />
      <div className="flex gap-2">
        <Boton type="submit" tamano="sm" disabled={texto.trim().length < 10} cargando={guardar.isPending}>Guardar explicación</Boton>
        <Boton type="button" variante="fantasma" tamano="sm" onClick={alTerminar}>Cancelar</Boton>
      </div>
    </form>
  );
}

function PedirExplicacion({ a, alTerminar }: { a: Ajuste; alTerminar: () => void }) {
  const { perfil } = useSesion();
  const [para, setPara] = useState(a.solicitado_por);
  const [pregunta, setPregunta] = useState("");
  const personas = useQuery({
    queryKey: ["perfiles_activos"],
    queryFn: () => q<{ id: string; nombre: string; puesto: string | null }[]>(
      supabase.from("perfiles").select("id, nombre, puesto").eq("activo", true).order("nombre")),
  });
  const pedir = useAccion(() => q(supabase.rpc("pedir_explicacion_ajuste", { p_ajuste: a.id, p_a: para, p_pregunta: pregunta.trim() || null })), {
    exito: "Le llegó como pendiente",
    invalidar: [["v_ajustes"]],
    alTerminar,
  });
  return (
    <form className="space-y-2 rounded-md border border-borde p-2.5" onSubmit={(e) => { e.preventDefault(); pedir.mutate(undefined); }}>
      <label className="block space-y-1">
        <span className="text-xs text-tenue">¿A quién?</span>
        <select className="campo h-8 text-sm" value={para} onChange={(e) => setPara(e.target.value)}>
          {(personas.data ?? []).filter((p) => p.id !== perfil?.id).map((p) => (
            <option key={p.id} value={p.id}>{p.nombre}{p.id === a.solicitado_por ? " (pidió el ajuste)" : p.puesto ? ` · ${p.puesto}` : ""}</option>
          ))}
        </select>
      </label>
      <input className="campo h-8 text-sm" value={pregunta} onChange={(e) => setPregunta(e.target.value)} placeholder="Pregunta (opcional). Ej. ¿dónde están las 4?" />
      <div className="flex gap-2">
        <Boton type="submit" tamano="sm" cargando={pedir.isPending}>Pedir</Boton>
        <Boton type="button" variante="fantasma" tamano="sm" onClick={alTerminar}>Cancelar</Boton>
      </div>
    </form>
  );
}

function ComoTraspaso({ a, comentario, invalidar, alTerminar }: { a: Ajuste; comentario: string; invalidar: string[][]; alTerminar: () => void }) {
  const almacenes = useAlmacenes();
  const [otro, setOtro] = useState<number | null>(null);
  const faltan = Number(a.diferencia) < 0;
  const n = Math.abs(Number(a.diferencia));
  const mover = useAccion(() => q<string | null>(supabase.rpc("resolver_ajuste_como_traspaso", { p_ajuste: a.id, p_otro: otro, p_comentario: comentario.trim() || null })), {
    // Si el otro almacén tiene su propio ajuste del artículo, la base lo dice: va en el aviso.
    exito: (r) => `Ajuste ${a.folio} resuelto como traspaso${r ? `. ${r}` : ""}`,
    invalidar,
    alTerminar,
  });
  const nombre = almacenes.data?.find((x) => x.id === otro)?.nombre;
  return (
    <div className="space-y-2 rounded-md border border-borde p-2.5">
      <p className="text-xs text-tenue">{faltan ? "¿En qué almacén están las que faltan aquí?" : "¿De qué almacén salieron las que sobran aquí?"}</p>
      <div className="flex flex-wrap gap-1.5">
        {(almacenes.data ?? []).filter((x) => x.id !== a.almacen_id).map((x) => (
          <button key={x.id} type="button" onClick={() => setOtro(x.id)}
            className={cn("rounded-lg border px-2.5 py-1 text-xs", otro === x.id ? "border-marca bg-marca-suave" : "border-borde hover:bg-fondo")}>
            {nombreCorto(x.nombre)}
          </button>
        ))}
      </div>
      {otro != null && (
        <p className="text-xs">
          {faltan ? <>Pasan <b className="cifra">{numero(n)}</b> de {nombreCorto(a.almacen)} a {nombreCorto(nombre ?? "")}.</>
                  : <>Pasan <b className="cifra">{numero(n)}</b> de {nombreCorto(nombre ?? "")} a {nombreCorto(a.almacen)}.</>}
        </p>
      )}
      <div className="flex gap-2">
        <Boton tamano="sm" disabled={otro == null} cargando={mover.isPending} onClick={() => mover.mutate(undefined)}>Mover y resolver</Boton>
        <Boton type="button" variante="fantasma" tamano="sm" onClick={alTerminar}>Cancelar</Boton>
      </div>
    </div>
  );
}

function SolicitarAjuste() {
  const almacenes = useAlmacenes();
  const [articulo, setArticulo] = useState<ArticuloEncontrado | null>(null);
  const [almacen, setAlmacen] = useState<number | null>(null);
  const [fisica, setFisica] = useState("");
  const [motivo, setMotivo] = useState("");
  const existencias = useQuery({
    queryKey: ["existencias_articulo", articulo?.id],
    enabled: !!articulo,
    queryFn: () => q<{ almacen_id: number; cantidad: number }[]>(supabase.from("existencias").select("almacen_id, cantidad").eq("articulo_id", articulo!.id)),
  });
  const sistema = Number(existencias.data?.find((e) => e.almacen_id === almacen)?.cantidad ?? 0);
  const n = Number(fisica.replace(",", "."));
  const listo = !!articulo && almacen != null && fisica !== "" && n >= 0 && motivo.trim().length >= 5;

  const pedir = useAccion(() => q(supabase.rpc("solicitar_ajuste", { p_articulo: articulo!.id, p_almacen: almacen, p_cantidad_fisica: n, p_motivo: motivo.trim() })), {
    exito: "Ajuste pedido. La existencia no cambia hasta que lo autoricen.",
    invalidar: [["v_ajustes"], ["ajustes_pendientes_cuenta"]],
    alTerminar: () => { setArticulo(null); setAlmacen(null); setFisica(""); setMotivo(""); },
  });

  return (
    <Tarjeta>
      <EncabezadoTarjeta titulo="Pedir un ajuste" descripcion="Cuando lo que hay en el estante no es lo que dice el sistema." explica={GLOSARIO.ajusteInventario} />
      <form className="px-5 pb-5 space-y-3" onSubmit={(e) => { e.preventDefault(); if (listo) pedir.mutate(undefined); }}>
        {articulo ? (
          <div className="flex items-center gap-2 rounded-lg border border-marca/40 bg-marca-suave/40 px-3 py-2">
            <div className="min-w-0 flex-1"><p className="text-sm font-medium truncate">{articulo.nombre}</p><p className="text-xs text-tenue">{articulo.clave}</p></div>
            <button type="button" onClick={() => { setArticulo(null); setAlmacen(null); }} className="p-1 rounded text-tenue hover:bg-fondo" aria-label="Cambiar artículo"><X className="h-4 w-4" /></button>
          </div>
        ) : <BuscadorArticulo alElegir={setArticulo} tipos={["componente", "materia_prima"]} mostrarPrecio={false} placeholder="Artículo a ajustar…" />}
        {articulo && (
          <div className="flex flex-wrap gap-1.5">
            {(almacenes.data ?? []).map((al) => {
              const hay = Number(existencias.data?.find((e) => e.almacen_id === al.id)?.cantidad ?? 0);
              return (
                <button key={al.id} type="button" onClick={() => setAlmacen(al.id)}
                  className={cn("rounded-lg border px-2.5 py-1.5 text-left min-w-[78px]", almacen === al.id ? "border-marca bg-marca-suave" : "border-borde hover:bg-fondo")}>
                  <span className="block text-xs text-tenue">{nombreCorto(al.nombre)}</span>
                  <span className="block text-sm font-semibold cifra">{numero(hay)}</span>
                </button>
              );
            })}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1" data-explain={GLOSARIO.sistemaAlPedirAjuste} data-explain-title="Sistema">
            <span className="text-xs text-tenue">Sistema</span>
            <p className="h-9 flex items-center justify-end px-3 rounded-lg bg-fondo cifra">{almacen != null ? numero(sistema) : "—"}</p>
          </label>
          <label className="space-y-1">
            <span className="text-xs text-tenue">Lo que hay físicamente</span>
            <input inputMode="decimal" className="campo text-right cifra" value={fisica} onChange={(e) => setFisica(e.target.value.replace(/[^\d.,]/g, ""))} placeholder="0" />
          </label>
        </div>
        {almacen != null && fisica !== "" && <p className="text-sm">Diferencia: <CantidadConSigno n={n - sistema} unidad={articulo?.unidad} /></p>}
        <label className="block space-y-1">
          <span className="text-xs text-tenue">Motivo (obligatorio, lo lee quien autoriza)</span>
          <input className="campo" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej. conteo del lunes, pieza dañada…" />
        </label>
        <Boton type="submit" className="w-full" disabled={!listo} cargando={pedir.isPending}>Pedir autorización</Boton>
      </form>
    </Tarjeta>
  );
}

import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Camera, CalendarClock, FileText, PackageOpen, Plus, Settings, Truck, Wallet } from "lucide-react";
import { Pagina } from "@/components/layout/Shell";
import { Boton } from "@/components/ui/boton";
import { Insignia } from "@/components/ui/insignia";
import { Lateral } from "@/components/ui/dialogo";
import { Cargando, ErrorCarga, Vacio } from "@/components/ui/estados";
import { Pestanas, ListaPestanas, ContenidoPestana } from "@/components/ui/pestanas";
import { TablaDatos, type Columna } from "@/components/datos/TablaDatos";
import { useSesion } from "@/lib/sesion";
import { fecha, hace, hoyISO, numero } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { DetalleEnvio } from "./envios/DetalleEnvio";
import { Saldos } from "./envios/Saldos";
import { DialogoConfigurar, DialogoEnvioFull, DialogoRecarga } from "./envios/Dialogos";
import { estadoEnvio, useEnvio, useEnvios, useEnviosEnVivo, type Envio } from "./envios/datos";

type Pestana = "cotizar" | "empacar" | "hoy" | "camino" | "entregados";

const PESTANAS: { valor: Pestana; texto: string; filtro: (e: Envio, hoy: string) => boolean; vacio: { titulo: string; texto: string } }[] = [
  { valor: "cotizar", texto: "Por cotizar y guía", filtro: (e) => e.falta_guia,
    vacio: { titulo: "Nada por cotizar", texto: "Los envíos que se piden desde un pedido llegan aquí con peso, medidas y destino ya llenos." } },
  { valor: "empacar", texto: "Por empacar", filtro: (e) => e.falta_empaque,
    vacio: { titulo: "Nada por empacar", texto: "Cuando un envío tenga guía o fecha de recolección, aparece aquí para empacarlo con fotos y check list." } },
  { valor: "hoy", texto: "Hoy salen o recogen", filtro: (e, hoy) => e.abierto && (e.listo_para_salir || (e.fecha_recoleccion != null && e.fecha_recoleccion <= hoy)),
    vacio: { titulo: "Hoy no sale nada", texto: "Aquí aparece lo que ya está empacado y con guía (listo para que pasen por él) y lo que tiene recolección para hoy." } },
  { valor: "camino", texto: "En camino", filtro: (e) => e.estado === "enviado",
    vacio: { titulo: "Nada en camino", texto: "Al marcar que salió, el envío pasa aquí hasta que el cliente lo recibe." } },
  { valor: "entregados", texto: "Entregados", filtro: (e) => e.estado === "entregado" || e.estado === "cancelado",
    vacio: { titulo: "Sin entregas recientes", texto: "Se ven los de los últimos 60 días, con su evidencia." } },
];

export default function Envios() {
  const { puede } = useSesion();
  const [params, setParams] = useSearchParams();
  useEnviosEnVivo();
  const envios = useEnvios();
  const almacen = puede("envios", 2) && puede("inventario", 2);
  const verSaldo = puede("envios", 2) || puede("finanzas", 1);
  const recarga = puede("envios", 3) || puede("finanzas", 2);
  const [dlg, setDlg] = useState<null | "full" | "recarga" | "config">(null);
  const [paqRecarga, setPaqRecarga] = useState<number | undefined>();
  const hoy = hoyISO();

  const cuentas = useMemo(() => Object.fromEntries(PESTANAS.map((p) => [p.valor, (envios.data ?? []).filter((e) => p.filtro(e, hoy)).length])) as Record<Pestana, number>, [envios.data, hoy]);
  const pedida = params.get("pestana") as Pestana | null;
  const porOmision: Pestana = almacen ? (cuentas.hoy ? "hoy" : "empacar") : "cotizar";
  const pestana: Pestana = pedida && PESTANAS.some((p) => p.valor === pedida) ? pedida : porOmision;
  const abierto = params.get("envio");
  const detalle = useEnvio(abierto);
  const cambiar = (cambios: Record<string, string | null>) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(cambios)) { if (v == null) p.delete(k); else p.set(k, v); }
    setParams(p, { replace: true });
  };

  const columnas: Columna<Envio>[] = [
    { clave: "folio", titulo: "Envío", valor: (e) => e.folio,
      celda: (e) => <span className="whitespace-nowrap"><b className="cifra">{e.folio}</b><span className="block text-xs text-tenue">{e.tipo_nombre} · {hace(e.solicitado_en)}</span></span> },
    { clave: "cliente", titulo: "Cliente", valor: (e) => `${e.cliente ?? (e.tipo === "a_full" ? "Full de Mercado Libre" : "")} ${e.pedido_folio ?? ""} ${e.id_externo ?? ""}`,
      celda: (e) => <span className="block max-w-[190px]"><span className="block truncate">{e.cliente ?? (e.tipo === "a_full" ? "Full de Mercado Libre" : "—")}</span>
        <span className="block text-xs text-tenue cifra">{e.pedido_folio}{e.id_externo ? ` · #${e.id_externo}` : ""}</span></span> },
    { clave: "resumen", titulo: "Qué lleva", celda: (e) => <span className="block max-w-[200px] truncate text-sm" title={e.resumen ?? ""}>{e.resumen}</span> },
    { clave: "bultos", titulo: "Bultos", alinear: "der", valor: (e) => e.peso_total ?? 0,
      celda: (e) => e.bultos ? <span className="whitespace-nowrap">{e.bultos} · {numero(e.peso_total)} kg{e.sin_medidas > 0 && <span className="block text-[11px] text-aviso">{e.sin_medidas} sin medir</span>}</span> : "—" },
    { clave: "paqueteria", titulo: "Paquetería y guía", valor: (e) => `${e.paqueteria ?? ""} ${e.numero_guia ?? ""}`,
      celda: (e) => <span className="text-sm">{e.paqueteria ?? "—"}{e.numero_guia && <span className="block text-xs text-tenue cifra">{e.numero_guia}</span>}</span> },
    { clave: "fecha_recoleccion", titulo: "Recolección", valor: (e) => e.fecha_recoleccion ?? "",
      celda: (e) => e.fecha_recoleccion ? <span className={cn(e.abierto && e.fecha_recoleccion <= hoy && "font-semibold text-aviso")}>{e.fecha_recoleccion === hoy ? "Hoy" : fecha(e.fecha_recoleccion)}</span> : "—" },
    { clave: "estado", titulo: "Estado", valor: (e) => estadoEnvio(e).texto,
      celda: (e) => <span className="flex flex-wrap gap-1"><Insignia tono={estadoEnvio(e).tono} punto>{estadoEnvio(e).texto}</Insignia>
        {e.fotos > 0 && <Insignia><Camera className="h-3 w-3" />{e.fotos}</Insignia>}</span> },
  ];

  return (
    <Pagina titulo="Envíos"
      descripcion="Del pedido a la puerta del cliente: guía, fotos, check list y número de serie en un solo lugar. Nadie vuelve a teclear peso, medidas ni domicilio."
      acciones={<>
        {almacen && <Boton variante="secundario" onClick={() => setDlg("full")}><Plus className="h-4 w-4" />Envío a Full</Boton>}
        {recarga && <Boton variante="secundario" onClick={() => { setPaqRecarga(undefined); setDlg("recarga"); }}><Wallet className="h-4 w-4" />Recarga</Boton>}
        {(puede("envios", 3) || puede("inventario", 3)) && <Boton variante="fantasma" tamano="icono" aria-label="Paqueterías y check list" onClick={() => setDlg("config")}><Settings className="h-4 w-4" /></Boton>}
      </>}>
      {verSaldo && <Saldos alRecargar={recarga ? (id) => { setPaqRecarga(id); setDlg("recarga"); } : undefined} />}

      <Pestanas value={pestana} onValueChange={(v) => cambiar({ pestana: v })}>
        <ListaPestanas opciones={PESTANAS.map((p) => ({ valor: p.valor, texto: p.texto, cuenta: cuentas[p.valor] }))} />
        {PESTANAS.map((p) => {
          const filas = (envios.data ?? []).filter((e) => p.filtro(e, hoy));
          return (
            <ContenidoPestana key={p.valor} value={p.valor} className="pt-4">
              <div className="hidden md:block">
                <TablaDatos filas={filas} columnas={columnas} cargando={envios.isLoading} error={envios.error} claveFila={(e) => e.id}
                  alClicFila={(e) => cambiar({ envio: e.id })} exportarComo={`envios-${p.valor}`} placeholder="Buscar folio, cliente, guía, venta de ML…"
                  vacio={{ icono: p.valor === "camino" ? Truck : PackageOpen, titulo: p.vacio.titulo, texto: p.vacio.texto }} />
              </div>
              <div className="md:hidden space-y-2">
                {envios.error ? <ErrorCarga error={envios.error} /> : envios.isLoading ? <Cargando filas={4} />
                  : filas.length === 0 ? <div className="tarjeta"><Vacio icono={PackageOpen} titulo={p.vacio.titulo} texto={p.vacio.texto} /></div>
                  : filas.map((e) => <TarjetaEnvioLista key={e.id} envio={e} hoy={hoy} alAbrir={() => cambiar({ envio: e.id })} />)}
              </div>
            </ContenidoPestana>
          );
        })}
      </Pestanas>

      <Lateral abierto={!!abierto} alCambiar={(v) => { if (!v) cambiar({ envio: null }); }}
        titulo={detalle.data ? <span className="inline-flex items-center gap-2"><span className="cifra">{detalle.data.folio}</span>
          <Insignia tono={estadoEnvio(detalle.data).tono} punto>{estadoEnvio(detalle.data).texto}</Insignia></span> : "Envío"}
        subtitulo={detalle.data && <>{detalle.data.cliente ?? detalle.data.destinatario}{detalle.data.pedido_folio && ` · ${detalle.data.pedido_folio}`}{detalle.data.id_externo && ` · venta #${detalle.data.id_externo}`} · {detalle.data.tipo_nombre}</>}>
        {detalle.isLoading ? <Cargando filas={6} /> : detalle.data ? <DetalleEnvio envio={detalle.data} />
          : <Vacio icono={PackageOpen} titulo="No encontramos este envío" texto="Puede ser del pedido de otro vendedor, o ya no existe." />}
      </Lateral>

      <DialogoEnvioFull abierto={dlg === "full"} alCambiar={(v) => setDlg(v ? "full" : null)} alCrear={(id) => cambiar({ envio: id, pestana: "empacar" })} />
      <DialogoRecarga abierto={dlg === "recarga"} alCambiar={(v) => setDlg(v ? "recarga" : null)} paqueteriaId={paqRecarga} />
      <DialogoConfigurar abierto={dlg === "config"} alCambiar={(v) => setDlg(v ? "config" : null)} />
    </Pagina>
  );
}

/** En el celular del almacén, una tarjeta por envío con lo que importa para empacar. */
function TarjetaEnvioLista({ envio: e, hoy, alAbrir }: { envio: Envio; hoy: string; alAbrir: () => void }) {
  return (
    <button type="button" onClick={alAbrir} className="tarjeta w-full p-3 text-left active:bg-fondo">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold cifra">{e.folio}</span>
        <Insignia tono={estadoEnvio(e).tono} punto>{estadoEnvio(e).texto}</Insignia>
      </div>
      <p className="mt-1 truncate text-sm">{e.cliente ?? (e.tipo === "a_full" ? "Full de Mercado Libre" : "—")}<span className="text-tenue"> · {e.tipo_nombre}</span></p>
      <p className="truncate text-xs text-tenue">{e.resumen}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {e.fecha_recoleccion && <Insignia tono={e.fecha_recoleccion <= hoy ? "aviso" : "neutro"}><CalendarClock className="h-3 w-3" />{e.fecha_recoleccion === hoy ? "Hoy" : fecha(e.fecha_recoleccion)}</Insignia>}
        {e.numero_guia ? <Insignia tono="marca"><FileText className="h-3 w-3" />Guía</Insignia> : e.falta_guia && <Insignia tono="aviso">Sin guía</Insignia>}
        {e.bultos > 0 && <Insignia>{e.bultos} · {numero(e.peso_total)} kg</Insignia>}
        {e.fotos > 0 && <Insignia tono="ok"><Camera className="h-3 w-3" />{e.fotos}</Insignia>}
      </div>
    </button>
  );
}

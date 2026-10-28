import { CheckCircle2, Hash, PackageCheck, ShieldCheck, Truck, UserRound } from "lucide-react";
import { Insignia } from "@/components/ui/insignia";
import { fechaYHora, numero } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { useSesion } from "@/lib/sesion";
import { Galeria, Miniatura, SubirArchivo } from "./Archivos";
import { estadoEnvio, useArchivos, useLineas, useUrlsFirmadas, vigentes, type Envio } from "./datos";

/**
 * La evidencia de salida de un envío: fotos del paquete, check list palomeado,
 * números de serie, quién empacó y cuándo, y la guía. Es lo que se le enseña a
 * Mercado Libre o al cliente cuando dice que "llegó incompleto". No se edita.
 */
export function EvidenciaSalida({ envio, className, titulo = true }: { envio: Envio; className?: string; titulo?: boolean }) {
  const { puede } = useSesion();
  const archivos = useArchivos({ envioId: envio.id });
  // Mientras la caja siga en el almacén, almacén puede retirar una foto equivocada y subir la
  // correcta; ya en camino, la foto es la prueba y solo la gerencia la retira (lo mismo en la base).
  const enAlmacen = !envio.enviado_en && envio.estado !== "cancelado";
  const almacen = puede("envios", 2) && puede("inventario", 2);
  const retirar = (almacen && enAlmacen) || puede("envios", 3);
  const lineas = useLineas(envio.id);
  const fotos = (archivos.data ?? []).filter((a) => a.tipo === "empaque" || a.tipo === "entrega");
  const guias = (archivos.data ?? []).filter((a) => a.tipo === "guia");
  const urlsGuia = useUrlsFirmadas(guias.map((g) => g.ruta));
  const series = (lineas.data ?? []).flatMap((l) => l.series.map((s) => ({ serie: s, equipo: l.nombre, ordenes: l.ordenes })));

  return (
    <div className={cn("space-y-3", className)}>
      {titulo && (
        <div className="flex flex-wrap items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-ok" />
          <span className="font-medium cifra">{envio.folio}</span>
          <Insignia tono={estadoEnvio(envio).tono}>{estadoEnvio(envio).texto}</Insignia>
          <span className="text-sm text-tenue">{envio.tipo_nombre}{envio.paqueteria ? ` · ${envio.paqueteria}` : ""}</span>
        </div>
      )}
      {!envio.empacado_en ? (
        <p className="text-sm text-tenue">
          {envio.lleva_empaque ? "Todavía no se empaca: la evidencia se registra al empacar (fotos, check list y serie)."
            : `${envio.tipo_nombre}: no lo empaca nuestro almacén.`}
        </p>
      ) : (
        <>
          <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
            <div className="flex items-start gap-2"><UserRound className="h-4 w-4 mt-0.5 text-tenue shrink-0" />
              <span>Empacó <b>{envio.empacado_por_nombre ?? "—"}</b><span className="block text-xs text-tenue">{fechaYHora(envio.empacado_en)}</span></span></div>
            <div className="flex items-start gap-2"><PackageCheck className="h-4 w-4 mt-0.5 text-tenue shrink-0" />
              <span><b className="cifra">{envio.bultos}</b> {envio.bultos === 1 ? "bulto" : "bultos"}{envio.peso_total != null && <> · <span className="cifra">{numero(envio.peso_total)} kg</span></>}
                <span className="block text-xs text-tenue">{envio.resumen}</span></span></div>
            {(envio.numero_guia || guias.length > 0) && (
              <div className="flex items-start gap-2"><Truck className="h-4 w-4 mt-0.5 text-tenue shrink-0" />
                <span>Guía <b className="cifra">{envio.numero_guia ?? "—"}</b>{envio.paqueteria && <> · {envio.paqueteria}</>}
                  {guias.length > 0 && urlsGuia.data?.[guias[guias.length - 1].ruta] && (
                    <a className="block text-xs text-marca-texto hover:underline" href={urlsGuia.data[guias[guias.length - 1].ruta]} target="_blank" rel="noreferrer">Ver PDF de la guía</a>
                  )}</span></div>
            )}
            {envio.enviado_en && (
              <div className="flex items-start gap-2"><Truck className="h-4 w-4 mt-0.5 text-tenue shrink-0" />
                <span>Salió {fechaYHora(envio.enviado_en)}{envio.enviado_por_nombre && <> · {envio.enviado_por_nombre}</>}
                  {envio.entregado_en && <span className="block text-xs text-tenue">Entregado {fechaYHora(envio.entregado_en)}{envio.recibio ? ` · recibió ${envio.recibio}` : ""}</span>}</span></div>
            )}
          </dl>
          {series.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {series.map((s) => (
                <span key={s.serie} className="inline-flex items-center gap-1.5 rounded-lg border border-borde bg-fondo px-2.5 py-1 text-sm">
                  <Hash className="h-3.5 w-3.5 text-tenue" /><b className="cifra">{s.serie}</b>
                  <span className="text-tenue text-xs">{s.equipo}{s.ordenes?.length ? ` · ${s.ordenes.join(", ")}` : ""}</span>
                </span>
              ))}
            </div>
          )}
          <Galeria archivos={fotos} vacio="Sin fotos." retirar={retirar} />
          {almacen && enAlmacen && vigentes(fotos).length < 6 && (
            <SubirArchivo tipo="empaque" envioId={envio.id} texto="Agregar foto del paquete" maximo={6 - vigentes(fotos).length} />
          )}
          {(envio.checklist?.length ?? 0) > 0 && (
            <ul className="grid gap-1 sm:grid-cols-2 text-sm">
              {envio.checklist!.map((c) => (
                <li key={c.id} className="flex items-start gap-1.5"><CheckCircle2 className="h-4 w-4 mt-0.5 text-ok shrink-0" />{c.texto}</li>
              ))}
            </ul>
          )}
        </>
      )}
      {!envio.empacado_en && guias.length > 0 && (
        <div className="flex gap-2">{guias.map((g) => <Miniatura key={g.id} archivo={g} url={urlsGuia.data?.[g.ruta]} className="h-16 w-16" />)}</div>
      )}
    </div>
  );
}

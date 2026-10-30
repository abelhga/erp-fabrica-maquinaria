import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import QRCode from "qrcode";
import { toast } from "sonner";
import { Nfc, Printer } from "lucide-react";
import { Dialogo } from "@/components/ui/dialogo";
import { Boton } from "@/components/ui/boton";
import type { Maquina } from "../datos";

/**
 * La liga que va en el QR y en la etiqueta NFC de cada máquina: abre «Reportar falla» con la
 * máquina ya elegida. Es la de siempre (no una nueva), así una etiqueta impresa sigue sirviendo.
 */
export const urlReporte = (id: string) => `${window.location.origin}/servicio/reportar?maquina=${id}`;

export function useQR(texto: string) {
  return useQuery({
    queryKey: ["qr", texto],
    staleTime: Infinity,
    // Corrección M: aguanta una etiqueta con grasa o un rayón sin que el código crezca de más.
    queryFn: () => QRCode.toDataURL(texto, { margin: 1, width: 320, errorCorrectionLevel: "M" }),
  });
}

/** Una etiqueta: QR, número grande y qué hacer. Sale igual en pantalla y en la hoja de impresión. */
export function Etiqueta({ m }: { m: Pick<Maquina, "id" | "numero" | "nombre"> }) {
  const qr = useQR(urlReporte(m.id));
  return (
    <div className="etiqueta-qr flex items-center gap-3 rounded-lg border-2 border-dashed border-borde p-3 bg-white text-black">
      {qr.data ? <img src={qr.data} alt={`QR para reportar falla de ${m.numero}`} className="h-28 w-28 shrink-0" /> : <div className="h-28 w-28 shrink-0 bg-fondo" />}
      <div className="min-w-0">
        <p className="text-2xl font-bold tracking-wide leading-none">{m.numero}</p>
        <p className="text-sm leading-tight mt-1 line-clamp-2">{m.nombre}</p>
        <p className="text-[11px] mt-2 leading-tight">¿Falla? Escanea con la cámara del celular o acércalo a la etiqueta y repórtala.</p>
        <p className="text-[10px] mt-1 font-semibold tracking-[0.15em]">HEGAMEX · MANTENIMIENTO</p>
      </div>
    </div>
  );
}

// Web NFC solo existe en Chrome de Android; en lo demás el botón ni se enseña.
type NdefWriter = { write: (m: { records: { recordType: string; data: string }[] }) => Promise<void> };
const nfcDisponible = () => typeof window !== "undefined" && "NDEFReader" in window;

/** La etiqueta de una máquina: verla, imprimirla o grabarla en una etiqueta NFC. */
export function DialogoEtiqueta({ m, alCerrar }: { m: Pick<Maquina, "id" | "numero" | "nombre">; alCerrar: () => void }) {
  const [grabando, setGrabando] = useState(false);
  async function grabarNfc() {
    setGrabando(true);
    toast.info("Acerca el celular a la etiqueta NFC");
    try {
      const W = (window as unknown as { NDEFReader: new () => NdefWriter }).NDEFReader;
      await new W().write({ records: [{ recordType: "url", data: urlReporte(m.id) }] });
      toast.success(`Etiqueta NFC lista: al acercar un celular abre el reporte de ${m.numero}`);
    } catch (e) {
      toast.error(e instanceof Error && e.name === "NotAllowedError" ? "El celular no dio permiso para usar NFC" : "No se pudo grabar; vuelve a acercarlo");
    } finally { setGrabando(false); }
  }
  return (
    <Dialogo abierto alCambiar={(v) => !v && alCerrar()} titulo={`Etiqueta de ${m.numero}`}
      descripcion="Pégala en la máquina: quien vea una falla la escanea con la cámara del celular y le sale «Reportar falla» con esta máquina ya elegida."
      pie={<>
        {nfcDisponible() && <Boton variante="secundario" cargando={grabando} onClick={grabarNfc}><Nfc className="h-4 w-4" />Grabar en etiqueta NFC</Boton>}
        <Boton onClick={() => window.open(`/servicio/etiquetas?ids=${m.id}`, "_blank")}><Printer className="h-4 w-4" />Imprimir</Boton>
      </>}>
      <div className="space-y-3">
        <Etiqueta m={m} />
        <p className="text-xs text-tenue">
          Para NFC: en un celular Android con Chrome sale el botón para grabarla aquí mismo. En otros, graba esta liga con una app
          como NFC Tools: <span className="cifra break-all select-all">{urlReporte(m.id)}</span>
        </p>
      </div>
    </Dialogo>
  );
}

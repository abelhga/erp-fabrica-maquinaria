import { Hammer } from "lucide-react";
import { Pagina } from "@/components/layout/Shell";
import { Vacio } from "./estados";

/** Marcador temporal mientras se construye una pantalla. No debe quedar ninguno al terminar. */
export function EnConstruccion({ titulo }: { titulo: string }) {
  return (
    <Pagina titulo={titulo}>
      <div className="tarjeta"><Vacio icono={Hammer} titulo="Pantalla en construcción" texto="Esta sección se está terminando." /></div>
    </Pagina>
  );
}

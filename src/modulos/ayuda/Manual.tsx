// Un manual dentro del ERP. Va en un marco y no como pantalla de React porque cada manual
// es una página completa con sus estilos y sus prácticas; así se mantiene uno solo, el
// mismo que se publica afuera.
import { Link, useLocation, useParams } from "react-router-dom";
import { ArrowLeft, BookOpen, ExternalLink } from "lucide-react";
import { Pagina } from "@/components/layout/Shell";
import { Boton } from "@/components/ui/boton";
import { Tarjeta } from "@/components/ui/tarjeta";
import { Vacio } from "@/components/ui/estados";
import { useSesion } from "@/lib/sesion";
import { MANUALES } from "./manuales";
import { veManual } from "./Ayuda";

export default function Manual() {
  const { manual } = useParams();
  const { hash } = useLocation();
  const sesion = useSesion();
  const m = MANUALES.find((x) => x.clave === manual);

  if (!m || !veManual(m, sesion)) {
    return (
      <Pagina titulo="Manual">
        <Tarjeta>
          <Vacio icono={BookOpen} titulo="Ese manual no existe" texto="O no es de tu área. En la lista están los que te tocan."
            accion={<Boton asChild variante="secundario"><Link to="/ayuda">Ver los manuales</Link></Boton>} />
        </Tarjeta>
      </Pagina>
    );
  }

  const archivo = `/manuales/${m.clave}.html`;
  return (
    <Pagina titulo={m.titulo} descripcion={`Para: ${m.para}`} ancho="max-w-[1240px]"
      acciones={<>
        <Boton asChild variante="fantasma"><Link to="/ayuda"><ArrowLeft className="h-4 w-4" /> Manuales</Link></Boton>
        <Boton asChild variante="secundario"><a href={archivo} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /> Abrir en otra pestaña</a></Boton>
      </>}>
      {/* key: al saltar de un manual a otro el marco se crea de nuevo y empieza arriba. */}
      <iframe key={m.clave} src={archivo + hash} title={`Manual: ${m.titulo}`}
        className="block w-full rounded-xl border border-borde bg-superficie"
        style={{ height: "calc(100dvh - 12rem)", minHeight: "32rem" }} />
    </Pagina>
  );
}

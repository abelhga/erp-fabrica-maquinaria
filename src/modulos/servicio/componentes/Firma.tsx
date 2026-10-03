import { useEffect, useRef, useState } from "react";
import { Eraser } from "lucide-react";

/**
 * Firma con el dedo. Es "papel": fondo blanco y tinta negra siempre (también en
 * modo oscuro) para que se lea igual en pantalla, impresa y en cualquier tema.
 * Avisa con un PNG cada vez que se termina un trazo, o null si se borra.
 */
export function PanelFirma({ alCambiar }: { alCambiar: (png: Blob | null) => void }) {
  const lienzo = useRef<HTMLCanvasElement>(null);
  const dibujando = useRef(false);
  const [vacia, setVacia] = useState(true);

  useEffect(() => {
    const c = lienzo.current!;
    const ajustar = () => {
      const r = c.getBoundingClientRect();
      const escala = window.devicePixelRatio || 1;
      c.width = Math.round(r.width * escala);
      c.height = Math.round(r.height * escala);
      const ctx = c.getContext("2d")!;
      ctx.scale(escala, escala);
      ctx.lineWidth = 2.2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#111827";
    };
    ajustar();
  }, []);

  const punto = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  function exportar() {
    lienzo.current!.toBlob((b) => alCambiar(b), "image/png");
  }

  function borrar() {
    const c = lienzo.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    setVacia(true);
    alCambiar(null);
  }

  return (
    <div className="space-y-1.5">
      <div className="relative rounded-lg border-2 border-dashed border-borde bg-white">
        <canvas
          ref={lienzo}
          className="block h-36 w-full touch-none cursor-crosshair"
          aria-label="Espacio para firmar"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            dibujando.current = true;
            const p = punto(e);
            const ctx = e.currentTarget.getContext("2d")!;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
          }}
          onPointerMove={(e) => {
            if (!dibujando.current) return;
            const p = punto(e);
            const ctx = e.currentTarget.getContext("2d")!;
            ctx.lineTo(p.x, p.y);
            ctx.stroke();
            if (vacia) setVacia(false);
          }}
          onPointerUp={() => { if (dibujando.current) { dibujando.current = false; exportar(); } }}
          onPointerCancel={() => { dibujando.current = false; }}
        />
        {vacia && <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-gray-400">Firme aquí</span>}
      </div>
      <button type="button" onClick={borrar} className="inline-flex items-center gap-1 text-xs text-tenue hover:text-texto">
        <Eraser className="h-3.5 w-3.5" />Borrar firma
      </button>
    </div>
  );
}

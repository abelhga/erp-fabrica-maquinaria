import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { q } from "@/lib/consultas";
import type { ArticuloEncontrado } from "@/components/datos/BuscadorArticulo";

/**
 * Lector de códigos de barras. Un lector USB (o Bluetooth en modo teclado) no se «conecta» con
 * nada: la computadora lo ve como un teclado que escribe el código muy rápido y da Enter. Lo
 * único que lo distingue de una persona es la velocidad, y de eso vive este archivo.
 */

/** ¿La empresa trabaja con lector? Se prende en Configuración → Almacenes; apagado, nada de esto se ve. */
export function useLectorActivo() {
  const r = useQuery({
    queryKey: ["lector_codigos"], staleTime: 5 * 60_000,
    queryFn: async () => (await q<{ valor: unknown }[]>(supabase.from("configuracion").select("valor").eq("clave", "almacen_lector_codigos")))[0]?.valor === true,
  });
  return r.data ?? false;
}

/** El artículo de un código leído (o de su clave); null si no hay o si es ambiguo. */
export async function articuloPorCodigo(codigo: string, tipos?: ArticuloEncontrado["tipo"][]) {
  const filas = await q<ArticuloEncontrado[]>(supabase.rpc("articulo_por_codigo", { p_codigo: codigo, p_tipos: tipos ?? null }));
  return filas[0] ?? null;
}

// Un lector deja entre 5 y 25 ms entre teclas; una persona rápida, arriba de 60.
const ENTRE_TECLAS_MS = 45;
const MINIMO = 4;

/** Le pone un valor a un campo de React desde afuera, de modo que su estado se entere. */
function ponerValor(el: HTMLInputElement | HTMLTextAreaElement, valor: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, valor);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

/**
 * Escucha lecturas en toda la pantalla, esté donde esté el cursor. Si el cursor estaba en un campo
 * (la cantidad, el motivo), el código que el lector alcanzó a escribir ahí se borra: un código de
 * 13 dígitos en «cantidad» seguido de Enter registraría una salida disparatada.
 *
 * Un campo marcado con `data-lector` recibe la lectura él mismo (el buscador de artículos): ahí no
 * se interviene. Tampoco cuando el cursor está dentro de un diálogo.
 */
export function useLector(alLeer: (codigo: string) => void, activo = true) {
  const manejador = useRef(alLeer);
  manejador.current = alLeer;
  useEffect(() => {
    if (!activo) return;
    let teclas = "", ultima = 0, campo: HTMLInputElement | HTMLTextAreaElement | null = null, antes = "";
    const alTeclear = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
      const ahora = performance.now();
      if (e.key === "Enter") {
        const esLectura = teclas.length >= MINIMO && ahora - ultima < ENTRE_TECLAS_MS * 3;
        const codigo = teclas;
        const donde = campo, valorAntes = antes;
        teclas = ""; campo = null;
        if (!esLectura) return;
        const destino = e.target as HTMLElement | null;
        // Un campo que recibe lecturas las atiende él. Y con un diálogo abierto encima (el buscador
        // general, una confirmación) la lectura es para ese diálogo, no para la pantalla de atrás.
        if (destino?.closest?.("[data-lector], [role='dialog']")) return;
        e.preventDefault();
        e.stopPropagation();
        if (donde && document.contains(donde)) ponerValor(donde, valorAntes);
        manejador.current(codigo.trim());
        return;
      }
      if (e.key.length !== 1) return; // Shift, flechas y demás no son parte del código ni lo cortan.
      if (teclas && ahora - ultima > ENTRE_TECLAS_MS) teclas = "";
      if (!teclas) {
        const el = e.target;
        campo = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement ? el : null;
        antes = campo?.value ?? "";
      }
      teclas += e.key;
      ultima = ahora;
    };
    // En captura: antes que el formulario, para poder detener el Enter que lo guardaría.
    window.addEventListener("keydown", alTeclear, true);
    return () => window.removeEventListener("keydown", alTeclear, true);
  }, [activo]);
}

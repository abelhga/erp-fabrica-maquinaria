import { useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
import { Dialogo } from "@/components/ui/dialogo";
import { SelectorCliente, type ClienteBreve } from "@/components/datos/SelectorCliente";
import { Insignia } from "@/components/ui/insignia";
import { LlenarConConstancia, type DatosConstancia } from "@/components/datos/LlenarConConstancia";
import { Boton } from "@/components/ui/boton";
import { AreaTexto, Campo, Entrada, Seleccion } from "@/components/ui/campo";
import { supabase } from "@/lib/supabase";
import { mensajeError, q } from "@/lib/consultas";
import { useSesion } from "@/lib/sesion";
import { toast } from "sonner";
import { RFC_VALIDO, normalizarRfc, useFuentes } from "../comun";
import { GLOSARIO } from "@/tutorial/glosario";

/**
 * Pide un motivo antes de algo que cierra una puerta (rechazar, perder,
 * cancelar). La base también lo exige; aquí solo se pregunta bonito.
 */
export function DialogoMotivo({ abierto, alCambiar, titulo, descripcion, etiqueta = "Motivo", sugerencias = [], textoBoton, alConfirmar, cargando, extra, peligro = true }: {
  abierto: boolean; alCambiar: (v: boolean) => void; titulo: string; descripcion?: ReactNode; etiqueta?: string; sugerencias?: string[];
  textoBoton: string; alConfirmar: (motivo: string) => void; cargando?: boolean; extra?: ReactNode; peligro?: boolean;
}) {
  const [motivo, setMotivo] = useState("");
  useEffect(() => { if (abierto) setMotivo(""); }, [abierto]);
  const valido = motivo.trim().length >= 3;
  return (
    <Dialogo abierto={abierto} alCambiar={alCambiar} titulo={titulo} descripcion={descripcion}
      pie={<>
        <Boton variante="secundario" onClick={() => alCambiar(false)}>Cancelar</Boton>
        <Boton variante={peligro ? "peligro" : "primario"} disabled={!valido} cargando={cargando} onClick={() => alConfirmar(motivo.trim())}>{textoBoton}</Boton>
      </>}>
      <div className="space-y-3">
        {sugerencias.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {sugerencias.map((s) => (
              <button key={s} type="button" onClick={() => setMotivo(s)}
                className="rounded-full border border-borde px-3 py-1 text-xs text-tenue hover:text-texto hover:bg-fondo">{s}</button>
            ))}
          </div>
        )}
        <Campo etiqueta={etiqueta}>
          <AreaTexto autoFocus value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Escribe en una línea qué pasó"
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && valido) { e.preventDefault(); alConfirmar(motivo.trim()); } }} />
        </Campo>
        {extra}
      </div>
    </Dialogo>
  );
}

export const MOTIVOS_PERDIDA = ["Precio más alto que la competencia", "Compró con la competencia", "Sin presupuesto / pospuso la compra",
  "Tiempo de entrega muy largo", "No respondió", "Cambió el proyecto"];

export interface ClienteNuevo { id: string; nombre: string; razon_social: string | null; contacto?: { id: string; nombre: string } | null }

/** Lo que regresa clientes_parecidos(): nunca trae teléfonos ni correos de un cliente ajeno. */
export interface ClienteParecido {
  id: string; nombre: string; vendedor: string | null; por: "teléfono" | "correo" | "RFC" | "nombre";
  mio: boolean; libre: boolean; de_otro_vigente: boolean; editable: boolean;
}

/** El mismo valor, pero hasta que se deja de teclear: buscar en cada tecla saturaba la base. */
export function useRetrasado<T>(valor: T, ms = 400): T {
  const [v, setV] = useState(valor);
  useEffect(() => { const t = setTimeout(() => setV(valor), ms); return () => clearTimeout(t); }, [valor, ms]);
  return v;
}

/**
 * Alta rápida de cliente desde el cotizador o la lista: lo mínimo para cotizar
 * (nombre y un teléfono). Los datos fiscales se completan después, en su ficha, o
 * de una vez con su constancia de situación fiscal (régimen y CP salen solo entonces).
 */
export function DialogoCliente({ abierto, alCambiar, nombreInicial = "", alCrear }: {
  abierto: boolean; alCambiar: (v: boolean) => void; nombreInicial?: string; alCrear: (c: ClienteNuevo) => void;
}) {
  const { puede } = useSesion();
  const fuentes = useFuentes();
  const vacio = { nombre: "", razon_social: "", rfc: "", ciudad: "", estado: "", giro: "", fuente_id: "", contacto: "", telefono: "", correo: "", propio: true,
    regimen_fiscal: "", cp_fiscal: "" };
  const [f, setF] = useState(vacio);
  const [guardando, setGuardando] = useState(false);
  useEffect(() => { if (abierto) setF({ ...vacio, nombre: nombreInicial }); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [abierto, nombreInicial]);
  const rfc = normalizarRfc(f.rfc);
  const rfcMalo = rfc !== "" && !RFC_VALIDO.test(rfc);
  const cambiar = (k: keyof typeof vacio) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  // ¿Ya existe? La base busca por los últimos 10 dígitos del teléfono, correo, RFC y nombre (20 de 285
  // altas de un mes ya existían). Solo se pregunta con algo que alcance para comparar.
  const busca = useRetrasado({ nombre: f.nombre.trim(), tel: f.telefono.replace(/\D/g, ""), correo: f.correo.trim(), rfc });
  const conQue = busca.nombre.length >= 6 || busca.tel.length >= 10 || busca.correo.includes("@") || RFC_VALIDO.test(busca.rfc);
  const parecidosQ = useQuery({
    queryKey: ["clientes_parecidos", busca.nombre, busca.tel, busca.correo, busca.rfc],
    enabled: abierto && conQue,
    staleTime: 30_000,
    queryFn: () => q<ClienteParecido[]>(supabase.rpc("clientes_parecidos", {
      p_nombre: busca.nombre, p_telefono: busca.tel || null, p_correo: busca.correo || null, p_rfc: busca.rfc || null,
    })),
  });
  const parecidos = abierto && conQue ? parecidosQ.data ?? [] : [];
  const hayParecidos = parecidos.length > 0;
  function usarEste(p: ClienteParecido) {
    // Con undefined el editor busca su contacto principal; de un cliente ajeno no hay contactos visibles.
    alCrear({ id: p.id, nombre: p.nombre, razon_social: null, contacto: p.mio || p.libre ? undefined : null });
    alCambiar(false);
  }
  // Lo fiscal se toma tal cual de la constancia; el nombre y la ciudad solo si estaban vacíos.
  const deConstancia = (c: DatosConstancia) => setF((x) => ({
    ...x, nombre: x.nombre.trim() || c.nombre || "", razon_social: c.razon_social ?? x.razon_social, rfc: c.rfc ?? x.rfc,
    regimen_fiscal: c.regimen_fiscal ?? x.regimen_fiscal, cp_fiscal: c.cp_fiscal ?? x.cp_fiscal,
    ciudad: x.ciudad.trim() || c.ciudad || "", estado: x.estado.trim() || c.estado || "",
  }));

  async function guardar() {
    if (!f.nombre.trim() || rfcMalo) return;
    setGuardando(true);
    try {
      // La base vuelve a preguntar «¿ya existe?» (por si otro lo dio de alta mientras tanto): sin
      // p_es_otro, un parecido regresa el error con el nombre y de quién es.
      const id = await q<string>(supabase.rpc("alta_cliente", {
        p_cliente: {
          nombre: f.nombre.trim(), razon_social: f.razon_social.trim() || null, rfc: rfc || null, ciudad: f.ciudad.trim() || null,
          estado: f.estado.trim() || null, giro: f.giro.trim() || null, fuente_id: f.fuente_id ? Number(f.fuente_id) : null,
          regimen_fiscal: f.regimen_fiscal.trim() || null, cp_fiscal: f.cp_fiscal.trim() || null, propio: f.propio,
        },
        p_contacto: { nombre: f.contacto.trim() || null, telefono: f.telefono.trim() || null, correo: f.correo.trim() || null },
        p_es_otro: hayParecidos,
      }));
      let contacto: ClienteNuevo["contacto"] = null;
      if (f.contacto.trim() || f.telefono.trim() || f.correo.trim()) {
        const { data } = await supabase.from("contactos").select("id, nombre").eq("cliente_id", id).limit(1);
        contacto = data?.[0] ?? null;
      }
      toast.success(`Cliente “${f.nombre.trim()}” dado de alta`);
      alCrear({ id, nombre: f.nombre.trim(), razon_social: f.razon_social.trim() || null, contacto });
      alCambiar(false);
    } catch (e) {
      toast.error(mensajeError(e));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialogo abierto={abierto} alCambiar={alCambiar} titulo="Nuevo cliente" ancho="max-w-xl"
      descripcion="Con nombre y un teléfono basta para cotizar; los datos fiscales se completan después o con su constancia."
      pie={<>
        <Boton variante="secundario" onClick={() => alCambiar(false)}>Cancelar</Boton>
        <Boton variante={hayParecidos ? "secundario" : "primario"} onClick={guardar} cargando={guardando} disabled={!f.nombre.trim() || rfcMalo}>
          {hayParecidos ? "Es otro, darlo de alta" : "Dar de alta"}
        </Boton>
      </>}>
      {/* Con parecidos, Enter no guarda: quien teclea rápido duplicaba al cliente sin leer el aviso. */}
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); if (!hayParecidos) guardar(); }}>
        <LlenarConConstancia para="cliente" alLeer={deConstancia} />
        <Campo etiqueta="Nombre (como lo conocen)" className="sm:col-span-2">
          <Entrada autoFocus value={f.nombre} onChange={cambiar("nombre")} placeholder="Concretos del Bajío" />
        </Campo>
        <Campo etiqueta="Contacto"><Entrada value={f.contacto} onChange={cambiar("contacto")} placeholder="Ing. Pérez" /></Campo>
        <Campo etiqueta="Celular / WhatsApp"><Entrada value={f.telefono} onChange={cambiar("telefono")} inputMode="tel" placeholder="33 1234 5678" /></Campo>
        {/* Junto a lo que se compara (nombre y teléfono), no hasta abajo: si no se ve, se duplica igual. */}
        {hayParecidos && (
          <div className="sm:col-span-2 rounded-lg border border-aviso/40 bg-aviso-suave p-3 space-y-2" role="status"
            data-explain={GLOSARIO.clienteParecido} data-explain-title="Ya existe">
            <p className="text-sm font-medium">Ya existe</p>
            <ul className="space-y-2">
              {parecidos.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                  <span className="font-medium min-w-0 break-words">{p.nombre}</span>
                  <span className="text-tenue">{p.mio ? "tuyo" : p.libre ? "libre" : `de ${p.vendedor ?? "otro vendedor"}`}</span>
                  <Insignia tono="aviso">mismo {p.por}</Insignia>
                  <Boton type="button" tamano="sm" className="ml-auto" onClick={() => usarEste(p)}>Usar este</Boton>
                  {p.de_otro_vigente && (
                    <span className="basis-full text-xs text-tenue" data-explain={GLOSARIO.clienteAjeno} data-explain-title="Cliente de otro vendedor">
                      Es de {p.vendedor}: si le cotizas, a él y a la gerencia les llega un aviso.
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
        <Campo etiqueta="Correo"><Entrada value={f.correo} onChange={cambiar("correo")} type="email" /></Campo>
        <Campo etiqueta="Ciudad"><Entrada value={f.ciudad} onChange={cambiar("ciudad")} /></Campo>
        <Campo etiqueta="Razón social"><Entrada value={f.razon_social} onChange={cambiar("razon_social")} /></Campo>
        <Campo etiqueta="RFC" error={rfcMalo ? "RFC con formato inválido (ej. CBA160202AB1)" : undefined}>
          <Entrada value={f.rfc} onChange={cambiar("rfc")} className="uppercase" maxLength={15} />
        </Campo>
        {(f.regimen_fiscal || f.cp_fiscal) && (<>
          <Campo etiqueta="Régimen fiscal"><Entrada value={f.regimen_fiscal} onChange={cambiar("regimen_fiscal")} /></Campo>
          <Campo etiqueta="CP fiscal"><Entrada value={f.cp_fiscal} onChange={cambiar("cp_fiscal")} inputMode="numeric" maxLength={5} /></Campo>
        </>)}
        <Campo etiqueta="Giro"><Entrada value={f.giro} onChange={cambiar("giro")} placeholder="Concretera, agregados, molino…" /></Campo>
        <Campo etiqueta="¿Cómo llegó?">
          <Seleccion value={f.fuente_id} onChange={cambiar("fuente_id")} data-explain={GLOSARIO.fuenteCliente} data-explain-title="¿Cómo llegó?">
            <option value="">—</option>
            {fuentes.data?.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
          </Seleccion>
        </Campo>
        {puede("ventas", 3) && (
          <label className="sm:col-span-2 flex items-center gap-2 text-sm" data-explain={GLOSARIO.clienteQuedaAMiNombre} data-explain-title="Queda a mi nombre">
            <input type="checkbox" checked={f.propio} onChange={(e) => setF((x) => ({ ...x, propio: e.target.checked }))} />
            Queda a mi nombre (si no, sin dueño)
          </label>
        )}
        <button type="submit" className="hidden" />
      </form>
    </Dialogo>
  );
}

/**
 * SelectorCliente + botón "Nuevo" aparte. No se usa el "Dar de alta …" dentro
 * de la lista: cmdk deja seleccionada esa opción si aparece antes que los
 * resultados, y quien escribe rápido y da Enter abría el alta en vez de elegir
 * al cliente que sí existía (y así se duplican clientes, el problema de hoy).
 */
export function ElegirCliente({ valor, alCambiar, alNuevo, deshabilitado }: {
  valor: { id: string; nombre: string } | null; alCambiar: (c: ClienteBreve | null) => void; alNuevo: () => void; deshabilitado?: boolean;
}) {
  return (
    <div className="flex gap-2">
      <SelectorCliente className="flex-1 min-w-0" valor={valor} alCambiar={alCambiar} deshabilitado={deshabilitado} />
      {!deshabilitado && (
        <Boton type="button" variante="secundario" onClick={alNuevo} title="Dar de alta un cliente nuevo"
          data-explain={GLOSARIO.botonNuevoClienteRapido} data-explain-title="Nuevo cliente"><UserPlus className="h-4 w-4" /><span className="hidden sm:inline">Nuevo</span></Boton>
      )}
    </div>
  );
}

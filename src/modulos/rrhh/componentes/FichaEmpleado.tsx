import { useEffect, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarPlus, LockKeyhole, RotateCcw, Save, ShieldAlert, UserX } from "lucide-react";
import { Lateral, Dialogo } from "@/components/ui/dialogo";
import { Boton } from "@/components/ui/boton";
import { Campo, Entrada, Seleccion, AreaTexto } from "@/components/ui/campo";
import { Insignia } from "@/components/ui/insignia";
import { Pestanas, ListaPestanas, ContenidoPestana } from "@/components/ui/pestanas";
import { Cargando, Vacio } from "@/components/ui/estados";
import { useSesion } from "@/lib/sesion";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { dinero, fecha, hoyISO, numero } from "@/lib/formato";
import {
  Avatar, ESTADOS, TIPOS, antiguedad, useCatalogosRrhh, type Empleado, type Incidencia, type Vacaciones,
} from "./comun";
import { NuevaIncidencia } from "./NuevaIncidencia";

interface Usuario { id: string; nombre: string; correo: string; activo: boolean }

export function FichaEmpleado({ id, empleados, usuarios, alCerrar, alCrear }: {
  id: string | null; empleados: Empleado[]; usuarios: Usuario[]; alCerrar: () => void; alCrear: (id: string) => void;
}) {
  const e = id && id !== "nuevo" ? empleados.find((x) => x.id === id) ?? null : null;
  const abierto = id === "nuevo" || !!e;
  const { puede } = useSesion();
  const [baja, setBaja] = useState(false);
  const [reingreso, setReingreso] = useState(false);

  return (
    <Lateral
      abierto={abierto}
      alCambiar={(v) => !v && alCerrar()}
      titulo={e ? e.nombre : "Nuevo empleado"}
      subtitulo={e ? (
        <span className="flex flex-wrap items-center gap-2">
          {[e.numero && `Núm. ${e.numero}`, e.puesto, e.departamento?.nombre].filter(Boolean).join(" · ")}
          {!e.activo && <Insignia tono="neutro">Baja desde {fecha(e.baja_en)}</Insignia>}
        </span>
      ) : "Con la fecha de ingreso se calculan solas la antigüedad y las vacaciones."}
    >
      {abierto && <Contenido key={id} empleado={e} empleados={empleados} usuarios={usuarios} alCrear={alCrear} />}
      {/* La baja va al final y no en el encabezado: es rara y no debe ser lo primero que toma el foco. */}
      {e && puede("rrhh", 2) && (
        <div className="mt-8 pt-4 border-t border-borde flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-tenue">{e.activo ? "¿Dejó la empresa? La baja conserva su historial." : "¿Regresó a trabajar?"}</p>
          {e.activo
            ? <Boton variante="secundario" tamano="sm" onClick={() => setBaja(true)}><UserX className="h-4 w-4" /> Dar de baja</Boton>
            : <Boton variante="secundario" tamano="sm" onClick={() => setReingreso(true)}><RotateCcw className="h-4 w-4" /> Reingreso</Boton>}
        </div>
      )}
      {e && <DialogoBaja empleado={e} abierto={baja} alCambiar={setBaja} />}
      {e && <DialogoReingreso empleado={e} abierto={reingreso} alCambiar={setReingreso} />}
    </Lateral>
  );
}

function Contenido({ empleado: e, empleados, usuarios, alCrear }: {
  empleado: Empleado | null; empleados: Empleado[]; usuarios: Usuario[]; alCrear: (id: string) => void;
}) {
  const { puede } = useSesion();
  const sensibles = puede("rrhh", 3);
  const opciones = [
    { valor: "general", texto: "Datos generales" },
    ...(e ? [{ valor: "vacaciones", texto: "Vacaciones e incidencias" }] : []),
    ...(e && sensibles ? [{ valor: "sensibles", texto: <span className="inline-flex items-center gap-1"><LockKeyhole className="h-3.5 w-3.5" /> Datos sensibles</span> }] : []),
  ];
  return (
    <div className="space-y-5">
      {e && (
        <div className="flex items-center gap-4">
          <Avatar nombre={e.nombre} foto={e.foto_url} tamano="lg" inactivo={!e.activo} />
          <div className="text-sm">
            <p><span className="text-tenue">Antigüedad:</span> <b>{antiguedad(e.fecha_ingreso, e.activo ? null : e.baja_en)}</b> <span className="text-tenue">(desde {fecha(e.fecha_ingreso)})</span></p>
            {e.etapa && <p className="mt-0.5"><span className="text-tenue">Área de piso:</span> <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: e.etapa.color }} />{e.etapa.nombre}</span></p>}
            {!e.activo && e.motivo_baja && <p className="mt-0.5"><span className="text-tenue">Motivo de baja:</span> {e.motivo_baja}</p>}
          </div>
        </div>
      )}
      <Pestanas defaultValue="general">
        <ListaPestanas opciones={opciones} />
        <ContenidoPestana value="general" className="pt-4">
          <DatosGenerales empleado={e} empleados={empleados} usuarios={usuarios} alCrear={alCrear} />
        </ContenidoPestana>
        {e && (
          <ContenidoPestana value="vacaciones" className="pt-4">
            <HistorialEmpleado empleado={e} />
          </ContenidoPestana>
        )}
        {e && sensibles && (
          <ContenidoPestana value="sensibles" className="pt-4">
            <DatosSensibles empleado={e} />
          </ContenidoPestana>
        )}
      </Pestanas>
      {e && !sensibles && (
        <p className="flex items-start gap-2 text-xs text-tenue">
          <LockKeyhole className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          CURP, RFC, NSS, salario y cuenta bancaria solo los ve Recursos Humanos con nivel de administración (la base no se los entrega a nadie más).
        </p>
      )}
    </div>
  );
}

function DatosGenerales({ empleado: e, empleados, usuarios, alCrear }: {
  empleado: Empleado | null; empleados: Empleado[]; usuarios: Usuario[]; alCrear: (id: string) => void;
}) {
  const { puede } = useSesion();
  const editable = puede("rrhh", 2);
  const { deptos, etapas } = useCatalogosRrhh();
  const siguienteNumero = () => {
    const n = Math.max(0, ...empleados.map((x) => Number(x.numero)).filter((x) => Number.isFinite(x)));
    return n ? String(n + 1) : "";
  };
  const [f, setF] = useState(() => ({
    numero: e?.numero ?? siguienteNumero(), nombre: e?.nombre ?? "", puesto: e?.puesto ?? "",
    departamento_id: e?.departamento_id ? String(e.departamento_id) : "", etapa_id: e?.etapa_id ? String(e.etapa_id) : "",
    fecha_ingreso: e?.fecha_ingreso ?? hoyISO(), fecha_nacimiento: e?.fecha_nacimiento ?? "", telefono: e?.telefono ?? "",
    correo: e?.correo ?? "", contacto_emergencia: e?.contacto_emergencia ?? "", usuario_id: e?.usuario_id ?? "",
  }));
  const cambiar = (k: keyof typeof f) => (ev: { target: { value: string } }) => setF((x) => ({ ...x, [k]: ev.target.value }));
  const ligados = new Set(empleados.filter((x) => x.usuario_id && x.id !== e?.id).map((x) => x.usuario_id));

  const guardar = useAccion(async () => {
    const datos = {
      numero: f.numero.trim() || null, nombre: f.nombre.trim(), puesto: f.puesto.trim() || null,
      departamento_id: f.departamento_id ? Number(f.departamento_id) : null, etapa_id: f.etapa_id ? Number(f.etapa_id) : null,
      fecha_ingreso: f.fecha_ingreso, fecha_nacimiento: f.fecha_nacimiento || null, telefono: f.telefono.trim() || null,
      correo: f.correo.trim().toLowerCase() || null, contacto_emergencia: f.contacto_emergencia.trim() || null, usuario_id: f.usuario_id || null,
    };
    if (e) {
      await q(supabase.from("empleados").update(datos).eq("id", e.id));
      return e.id;
    }
    const r = await q<{ id: string }>(supabase.from("empleados").insert(datos).select("id").single());
    return r.id;
  }, {
    exito: e ? "Cambios guardados" : "Empleado dado de alta",
    invalidar: [["empleados"], ["v_vacaciones"]],
    alTerminar: (nuevo) => { if (!e) alCrear(nuevo as string); },
  });

  function enviar(ev: FormEvent) {
    ev.preventDefault();
    if (!f.nombre.trim() || !f.fecha_ingreso) return;
    guardar.mutate(undefined);
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      <fieldset disabled={!editable} className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Nombre completo" className="sm:col-span-2">
          <Entrada autoFocus={!e} required value={f.nombre} onChange={cambiar("nombre")} placeholder="Nombre(s) y apellidos" />
        </Campo>
        <Campo etiqueta="Número de empleado" ayuda={!e ? "Sugerido: el siguiente consecutivo." : undefined}>
          <Entrada value={f.numero} onChange={cambiar("numero")} className="cifra" />
        </Campo>
        <Campo etiqueta="Puesto">
          <Entrada value={f.puesto} onChange={cambiar("puesto")} placeholder="Soldador, pintor, almacenista…" />
        </Campo>
        <Campo etiqueta="Departamento">
          <Seleccion value={f.departamento_id} onChange={cambiar("departamento_id")}>
            <option value="">Sin departamento</option>
            {deptos.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
          </Seleccion>
        </Campo>
        <Campo etiqueta="Área de piso" ayuda="La etapa del taller donde trabaja (para planear la carga).">
          <Seleccion value={f.etapa_id} onChange={cambiar("etapa_id")}>
            <option value="">No es de piso</option>
            {etapas.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
          </Seleccion>
        </Campo>
        <Campo etiqueta="Fecha de ingreso" ayuda="Con ella se calculan antigüedad y vacaciones.">
          <Entrada type="date" required value={f.fecha_ingreso} onChange={cambiar("fecha_ingreso")} max={hoyISO()} />
        </Campo>
        <Campo etiqueta="Fecha de nacimiento">
          <Entrada type="date" value={f.fecha_nacimiento} onChange={cambiar("fecha_nacimiento")} />
        </Campo>
        <Campo etiqueta="Teléfono">
          <Entrada type="tel" value={f.telefono} onChange={cambiar("telefono")} />
        </Campo>
        <Campo etiqueta="Correo">
          <Entrada type="email" value={f.correo} onChange={cambiar("correo")} />
        </Campo>
        <Campo etiqueta="Contacto de emergencia" className="sm:col-span-2">
          <Entrada value={f.contacto_emergencia} onChange={cambiar("contacto_emergencia")} placeholder="Nombre, parentesco y teléfono" />
        </Campo>
        <Campo etiqueta="Usuario del ERP" className="sm:col-span-2"
          ayuda="Si esta persona entra al sistema, liga su cuenta: así puede ver su saldo de vacaciones y pedir días desde su usuario.">
          <Seleccion value={f.usuario_id} onChange={cambiar("usuario_id")}>
            <option value="">No entra al sistema</option>
            {usuarios.filter((u) => !ligados.has(u.id) || u.id === f.usuario_id).map((u) => (
              <option key={u.id} value={u.id}>{u.nombre} · {u.correo}{u.activo ? "" : " (desactivado)"}</option>
            ))}
          </Seleccion>
        </Campo>
      </fieldset>
      {editable && (
        <div className="flex justify-end">
          <Boton type="submit" cargando={guardar.isPending}><Save className="h-4 w-4" /> {e ? "Guardar cambios" : "Dar de alta"}</Boton>
        </div>
      )}
    </form>
  );
}

interface DatosPrivados { curp: string | null; rfc: string | null; nss: string | null; domicilio: string | null; salario_diario: number | null; cuenta_bancaria: string | null }

function DatosSensibles({ empleado: e }: { empleado: Empleado }) {
  const datos = useQuery({
    queryKey: ["empleado_datos", e.id],
    queryFn: () => q<DatosPrivados | null>(supabase.from("empleado_datos").select("*").eq("empleado_id", e.id).maybeSingle()),
  });
  if (datos.isLoading) return <Cargando filas={4} />;
  return <FormSensibles key={datos.dataUpdatedAt} empleado={e} datos={datos.data ?? null} />;
}

function FormSensibles({ empleado: e, datos }: { empleado: Empleado; datos: DatosPrivados | null }) {
  const [f, setF] = useState({
    curp: datos?.curp ?? "", rfc: datos?.rfc ?? "", nss: datos?.nss ?? "", domicilio: datos?.domicilio ?? "",
    salario_diario: datos?.salario_diario != null ? String(datos.salario_diario) : "", cuenta_bancaria: datos?.cuenta_bancaria ?? "",
  });
  const cambiar = (k: keyof typeof f, mayus = false) => (ev: { target: { value: string } }) =>
    setF((x) => ({ ...x, [k]: mayus ? ev.target.value.toUpperCase() : ev.target.value }));
  const guardar = useAccion(() => q(supabase.from("empleado_datos").upsert({
    empleado_id: e.id, curp: f.curp.trim() || null, rfc: f.rfc.trim() || null, nss: f.nss.replace(/\D/g, "") || null,
    domicilio: f.domicilio.trim() || null, salario_diario: f.salario_diario ? Number(f.salario_diario) : null,
    cuenta_bancaria: f.cuenta_bancaria.replace(/\s/g, "") || null,
  })), { exito: "Datos sensibles guardados", invalidar: [["empleado_datos", e.id]] });
  const salario = Number(f.salario_diario) || 0;

  return (
    <form onSubmit={(ev) => { ev.preventDefault(); guardar.mutate(undefined); }} className="space-y-4">
      <div className="rounded-lg border border-aviso/30 bg-aviso-suave px-3 py-2 text-xs text-aviso flex gap-2">
        <ShieldAlert className="h-4 w-4 shrink-0" />
        Solo RRHH con nivel de administración y dirección ven esto. Cada cambio queda en la bitácora con quién lo hizo.
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="CURP" ayuda={f.curp && f.curp.length !== 18 ? `Lleva ${f.curp.length} de 18 caracteres` : undefined}>
          <Entrada value={f.curp} onChange={cambiar("curp", true)} maxLength={18} className="font-mono" />
        </Campo>
        <Campo etiqueta="RFC" ayuda={f.rfc && f.rfc.length !== 13 ? `Lleva ${f.rfc.length} de 13 caracteres` : undefined}>
          <Entrada value={f.rfc} onChange={cambiar("rfc", true)} maxLength={13} className="font-mono" />
        </Campo>
        <Campo etiqueta="NSS (IMSS)" ayuda={f.nss && f.nss.replace(/\D/g, "").length !== 11 ? "Son 11 dígitos" : undefined}>
          <Entrada value={f.nss} onChange={cambiar("nss")} inputMode="numeric" maxLength={11} className="font-mono" />
        </Campo>
        <Campo etiqueta="Salario diario" ayuda={salario ? `≈ ${dinero(salario * 30.4)} al mes` : "Sin prestaciones; base para el finiquito."}>
          <Entrada type="number" step="0.01" min="0" value={f.salario_diario} onChange={cambiar("salario_diario")} className="cifra" />
        </Campo>
        <Campo etiqueta="Cuenta o CLABE para nómina" className="sm:col-span-2">
          <Entrada value={f.cuenta_bancaria} onChange={cambiar("cuenta_bancaria")} inputMode="numeric" className="font-mono" />
        </Campo>
        <Campo etiqueta="Domicilio" className="sm:col-span-2">
          <AreaTexto value={f.domicilio} onChange={cambiar("domicilio")} className="min-h-[60px]" />
        </Campo>
      </div>
      <div className="flex justify-end">
        <Boton type="submit" cargando={guardar.isPending}><Save className="h-4 w-4" /> Guardar datos sensibles</Boton>
      </div>
    </form>
  );
}

function HistorialEmpleado({ empleado: e }: { empleado: Empleado }) {
  const { puede } = useSesion();
  const [nueva, setNueva] = useState(false);
  const vac = useQuery({
    queryKey: ["v_vacaciones", e.id],
    enabled: e.activo,
    queryFn: () => q<Vacaciones | null>(supabase.from("v_vacaciones").select("*").eq("empleado_id", e.id).maybeSingle()),
  });
  const inc = useQuery({
    queryKey: ["incidencias", "empleado", e.id],
    queryFn: () => q<Incidencia[]>(supabase.from("incidencias").select("*").eq("empleado_id", e.id).order("inicio", { ascending: false })),
  });
  const v = vac.data;
  return (
    <div className="space-y-4">
      {v && (
        <div className="rounded-xl border border-borde bg-fondo/60 p-4">
          {v.anios < 1 ? (
            <p className="text-sm">
              Aún no cumple su primer año: la LFT le da <b>12 días</b> a partir del <b>{fecha(v.proximo_aniversario)}</b>.
              {v.tomados > 0 && <> Ya tomó {numero(v.tomados)} días adelantados.</>}
            </p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div><p className="text-xs text-tenue">Le tocan</p><p className="text-xl font-semibold cifra">{v.dias_periodo}</p></div>
                <div><p className="text-xs text-tenue">Tomados</p><p className="text-xl font-semibold cifra">{numero(v.tomados)}</p></div>
                <div><p className="text-xs text-tenue">Saldo</p><p className={`text-xl font-semibold cifra ${v.saldo < 0 ? "text-peligro" : "text-ok"}`}>{numero(v.saldo)}</p></div>
              </div>
              <p className="text-xs text-tenue mt-3">
                {v.anios} {v.anios === 1 ? "año cumplido" : "años cumplidos"}: periodo del {fecha(v.inicio_periodo)} al {fecha(v.proximo_aniversario)}.
                {v.saldo > 0 && v.disfrutar_antes_de < hoyISO()
                  ? <span className="text-peligro"> Ya pasaron los 6 meses para disfrutarlos (vencían el {fecha(v.disfrutar_antes_de)}, art. 81 LFT): prográmalos cuanto antes.</span>
                  : <> Debe disfrutarlos antes del {fecha(v.disfrutar_antes_de)} (art. 81 LFT).</>} En su próximo aniversario le tocarán {v.dias_proximo_periodo} días.
                {v.solicitados > 0 && <> Tiene {numero(v.solicitados)} días solicitados por aprobar.</>}
              </p>
            </>
          )}
        </div>
      )}
      <div className="flex items-center justify-between">
        <h4 className="font-medium">Historial</h4>
        {e.activo && (puede("rrhh", 2) || puede("produccion", 3)) && (
          <Boton tamano="sm" variante="secundario" onClick={() => setNueva(true)}><CalendarPlus className="h-4 w-4" /> Registrar</Boton>
        )}
      </div>
      {inc.isLoading ? <Cargando filas={3} /> : (inc.data ?? []).length === 0 ? (
        <Vacio icono={CalendarPlus} titulo="Sin vacaciones ni incidencias" texto="Aquí aparecerán sus vacaciones, permisos, faltas e incapacidades." className="py-8" />
      ) : (
        <ul className="divide-y divide-borde rounded-xl border border-borde">
          {inc.data!.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-sm">
              <Insignia tono={TIPOS[i.tipo].tono}>{TIPOS[i.tipo].texto}</Insignia>
              <span className="cifra">{i.inicio === i.fin ? fecha(i.inicio) : `${fecha(i.inicio)} – ${fecha(i.fin)}`}</span>
              <span className="text-tenue cifra">
                {i.tipo === "horas_extra" ? `${numero(i.horas)} h` : i.tipo === "retardo" ? (i.horas ? `${numero(i.horas)} h` : "") : `${numero(i.dias)} ${Number(i.dias) === 1 ? "día" : "días"}`}
              </span>
              <span className="ml-auto"><Insignia tono={ESTADOS[i.estado].tono}>{ESTADOS[i.estado].texto}</Insignia></span>
              {i.motivo && <p className="w-full text-xs text-tenue">{i.motivo}</p>}
            </li>
          ))}
        </ul>
      )}
      <NuevaIncidencia abierto={nueva} alCambiar={setNueva} empleadoId={e.id} />
    </div>
  );
}

const MOTIVOS_BAJA = ["Renuncia voluntaria", "Término de contrato", "Despido justificado", "Despido injustificado", "Abandono de trabajo", "Jubilación o pensión", "Fallecimiento", "Otro"];

function DialogoBaja({ empleado: e, abierto, alCambiar }: { empleado: Empleado; abierto: boolean; alCambiar: (v: boolean) => void }) {
  const { puede } = useSesion();
  const [f, setF] = useState({ fecha: hoyISO(), tipo: MOTIVOS_BAJA[0], detalle: "", desactivar: true });
  useEffect(() => { if (abierto) setF({ fecha: hoyISO(), tipo: MOTIVOS_BAJA[0], detalle: "", desactivar: true }); }, [abierto]);
  const dar = useAccion(async () => {
    const motivo = f.detalle.trim() ? `${f.tipo}: ${f.detalle.trim()}` : f.tipo;
    await q(supabase.from("empleados").update({ activo: false, baja_en: f.fecha, motivo_baja: motivo }).eq("id", e.id));
    // Su acceso al ERP se corta el mismo día, si quien da la baja puede hacerlo.
    if (e.usuario_id && f.desactivar && puede("admin", 3)) {
      await q(supabase.from("perfiles").update({ activo: false }).eq("id", e.usuario_id));
    }
  }, { exito: `${e.nombre} quedó dado de baja`, invalidar: [["empleados"], ["v_vacaciones"], ["lista_usuarios"]], alTerminar: () => alCambiar(false) });

  return (
    <Dialogo abierto={abierto} alCambiar={alCambiar} titulo={`Dar de baja a ${e.nombre}`}
      descripcion="Deja de contar en el personal activo y en las vacaciones. Su historial se conserva."
      pie={<>
        <Boton variante="secundario" onClick={() => alCambiar(false)}>Cancelar</Boton>
        <Boton variante="peligro" cargando={dar.isPending} onClick={() => dar.mutate(undefined)}>Dar de baja</Boton>
      </>}>
      <form className="space-y-4" onSubmit={(ev) => { ev.preventDefault(); dar.mutate(undefined); }}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Último día laborado">
            <Entrada type="date" value={f.fecha} min={e.fecha_ingreso} onChange={(ev) => setF({ ...f, fecha: ev.target.value })} />
          </Campo>
          <Campo etiqueta="Motivo">
            <Seleccion value={f.tipo} onChange={(ev) => setF({ ...f, tipo: ev.target.value })}>
              {MOTIVOS_BAJA.map((m) => <option key={m}>{m}</option>)}
            </Seleccion>
          </Campo>
        </div>
        <Campo etiqueta="Detalle (opcional)">
          <Entrada value={f.detalle} onChange={(ev) => setF({ ...f, detalle: ev.target.value })} placeholder="Lo que conviene recordar para el finiquito" />
        </Campo>
        {e.usuario_id && (puede("admin", 3) ? (
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={f.desactivar} onChange={(ev) => setF({ ...f, desactivar: ev.target.checked })} />
            <span>Desactivar también su cuenta del ERP ({e.usuario?.correo}). Sin esto podría seguir entrando.</span>
          </label>
        ) : (
          <p className="rounded-lg bg-aviso-suave text-aviso text-sm px-3 py-2">
            Tiene cuenta en el ERP ({e.usuario?.correo}). Avisa a sistemas para que la desactive hoy mismo; mientras tanto la lista de usuarios la marca como "empleado dado de baja".
          </p>
        ))}
      </form>
    </Dialogo>
  );
}

function DialogoReingreso({ empleado: e, abierto, alCambiar }: { empleado: Empleado; abierto: boolean; alCambiar: (v: boolean) => void }) {
  const [f, setF] = useState(hoyISO());
  const [conservar, setConservar] = useState(false);
  const reingresar = useAccion(() => q(supabase.from("empleados")
    .update({ activo: true, ...(conservar ? {} : { fecha_ingreso: f }) }).eq("id", e.id)),
  { exito: `${e.nombre} está activo otra vez`, invalidar: [["empleados"], ["v_vacaciones"]], alTerminar: () => alCambiar(false) });
  return (
    <Dialogo abierto={abierto} alCambiar={alCambiar} titulo={`Reingreso de ${e.nombre}`}
      descripcion="Un reingreso después de una baja es una relación nueva: la antigüedad y las vacaciones cuentan desde la nueva fecha."
      pie={<>
        <Boton variante="secundario" onClick={() => alCambiar(false)}>Cancelar</Boton>
        <Boton cargando={reingresar.isPending} onClick={() => reingresar.mutate(undefined)}>Reactivar</Boton>
      </>}>
      <div className="space-y-4">
        <Campo etiqueta="Fecha de reingreso">
          <Entrada type="date" value={f} disabled={conservar} onChange={(ev) => setF(ev.target.value)} />
        </Campo>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={conservar} onChange={(ev) => setConservar(ev.target.checked)} />
          <span>Fue un error de captura: conservar su fecha de ingreso original ({fecha(e.fecha_ingreso)}).</span>
        </label>
      </div>
    </Dialogo>
  );
}

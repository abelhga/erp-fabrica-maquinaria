export interface LineaOC {
  id: string; orden_compra_id: string; articulo_id: string | null; nombre: string; descripcion: string | null; clave: string | null;
  unidad: string; empaque: number | null; almacen_preferido_id: number | null; cantidad: number; costo_unitario: number; importe: number;
  recibido: number; pendiente: number; para: string | null;
}

export interface ProveedorCompleto {
  id: string; nombre: string; razon_social: string | null; rfc: string | null; contacto: string | null; telefono: string | null;
  correo: string | null; sitio: string | null; categoria: string | null; pais: string; es_importacion: boolean; moneda: "MXN" | "USD" | "EUR";
  dias_credito: number; dias_entrega: number | null; datos_bancarios: string | null; notas: string | null; activo: boolean;
  domicilio?: string | null;
}

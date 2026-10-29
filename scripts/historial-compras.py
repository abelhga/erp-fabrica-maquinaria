"""Compras de 2018 a 2021 y categoría de cada proveedor de la hoja → SQL para el ERP (migración 201).

    python3 scripts/historial-compras.py --libro B_01.json B_02.json … --dir-actual dirC.json \
        --dir-2018 dirB.json [--ensayo] > historial.sql

--libro: volcados de la API de Sheets ({range, values}) de COMPRAS!B14:I… de «2018-2021 BASE DE DATOS
UNIFICADA» (la columna B es la fecha). Solo entran los renglones «Compra» hasta el 31-dic-2021: de 2022
en adelante el libro ya está en historial_compras_hoja (096) y esa hoja copia lo de C.
--dir-actual / --dir-2018: 'Directorio Proveedores'!A1:… de cada hoja; la categoría es la columna C
(«Tipo de Proveedor»). Gana la de la hoja actual; la de 2018 llena a los que ya no están.
Escribe una sola transacción que reemplaza lo cargado antes (se puede volver a correr).
"""
import argparse, datetime, json, re, sys, unicodedata


def limpiar(v):
    return re.sub(r"\s+", " ", re.sub("[​-‏‪-‮⁠﻿]", "", str(v or ""))).strip()


def llave(v):
    """La misma llave que src/importador/util.ts: sin acentos, minúsculas, sin espacios de más."""
    t = unicodedata.normalize("NFD", limpiar(v))
    return "".join(c for c in t if not ("̀" <= c <= "ͯ")).lower()


def fecha(t):
    t = (t or "").strip()
    for f in ("%d/%m/%y", "%d/%m/%Y", "%Y-%m-%d"):
        try:
            return datetime.datetime.strptime(t, f).date()
        except ValueError:
            pass
    return None


def dinero(t):
    try:
        return round(float((t or "").replace("$", "").replace(",", "").strip()), 2)
    except ValueError:
        return None


# Proveedores grandes que el directorio dejó sin categoría: se asignan por lo que dice su descripción
# en el libro (préstamos y efectivo no son gasto; montacargas, paneles y camionetas son activos).
ASIGNADAS = {
    "Abel Hernández Guzmán (prestamos)": "Préstamos de socios",
    "Abel Hernández Guzmán (renta)": "Renta",
    "Hangzhou Jusheng Machinery and Equipment CO., LT": "Equipos para reventa",
    "LME Agent SC": "Servicios aduanales",
    "SHANDONG TAVOL MACHINENY MONTACARGAS": "Maquinaria para taller",
    "Google Ads": "Publicidad",
    "Yemile Isabel Rangel Amezquita": "Sin efectos",
    "Ivann O'Brein Zepeda Garcia": "Sin efectos",
    "Shenzhen Weipai Tengda Technology Co LTD": "Equipos para reventa",
    "Maquinas y Equipos para Envasado": "Envasadoras y cosedoras",
    "Sol y Ahorro Sustentable": "Instalaciones y mejoras",
    "Constructora y Urbanizadora Arvio": "Vehículos",
    "UBM Mexico Exposiciones": "Publicidad",
    "Mercado Pago": "Bancos (Servicios Varios)",
    "Emerson Gualberto Sanchez Salazar": "Instalaciones y mejoras",
    "Ecomaq México": "Maquinaria para taller",
    "Fernando Gerardo Perez Garay": "Reparación de equipos y maquinaria (torno, plasma, etc)",
    "Francisco Javier Romo Flores": "Instalaciones y mejoras",
    "SARG Suministros Industriales": "Gases, soldadura, consumibles, etc.",
    "Perla Lilian Martinez Garcia": "Gases, soldadura, consumibles, etc.",
    "Pedro Villanueva Verea": "Reparación de equipos y maquinaria (torno, plasma, etc)",
    "Sergio Camarena Ortega": "Consumibles oficina",
    "Caritina Aceves Rodriguez": "Componentes y refacciones varios",
    "Corporacion Chuchin": "Instalaciones y mejoras",
    "Ferreteria Kantem SA de CV": "Maquinaria para taller",
    "Torzales Especiales SA de CV": "Componentes y refacciones varios",
    "STARLINK SATELLITE SYSTEMS MEXICO": "Servicios de teléfono",
    "STARLINK": "Servicios de teléfono",
    "UIB (Xiamen) Bearing Co. LTD.": "poleas, bujes etc.",
    "Frisacv": "Componentes y refacciones varios",
    "QINGYUAN COUNTY LUDE HOISTING MACHINERY": "Malacate galvanizado",
    "Alquiladora de Vehiculos Automotores (Hertz)": "Viajes de ventas",
    "Idennto": "Publicidad",
    "Patronato para el Desarrollo Agropecuario de Guanajuato": "Publicidad",
    "Italian German Exhibition Company Mexico": "Publicidad",
    "Representaciones de Exposiciones Mexico": "Publicidad",
    "Sandra Elena Pulido Virrueta": "Envasadoras y cosedoras",
    "Juan Luis Hernandez Canchola": "Instalaciones y mejoras",
    "Rafael Orozco Romero": "Reparación de vehículos",
}


def directorio(ruta):
    d = {}
    for r in json.load(open(ruta))["values"][2:]:
        if len(r) > 2 and limpiar(r[1]) and limpiar(r[2]):
            d[llave(r[1])] = limpiar(r[2])
    return d


def lit(x):
    return "null" if x is None else "'" + str(x).replace("'", "''") + "'"


def main():
    a = argparse.ArgumentParser()
    a.add_argument("--libro", nargs="+", required=True)
    a.add_argument("--dir-actual", required=True)
    a.add_argument("--dir-2018", required=True)
    a.add_argument("--ensayo", action="store_true")
    o = a.parse_args()

    cats = directorio(o.dir_2018)
    cats.update(directorio(o.dir_actual))
    origen = {k: "directorio" for k in cats}
    for nombre, cat in ASIGNADAS.items():
        cats[llave(nombre)] = cat
        origen[llave(nombre)] = "asignada"

    compras, saltadas = [], 0
    for ruta in o.libro:
        d = json.load(open(ruta))
        ini = int(re.search(r"![A-Z]+(\d+)", d["range"]).group(1))
        for i, r in enumerate(d["values"]):
            r = r + [""] * (8 - len(r))
            f, m, prov = fecha(r[0]), dinero(r[3]), limpiar(r[1])
            if r[2].strip() != "Compra" or not prov:
                continue
            if f is None or m is None:
                saltadas += 1
                continue
            if f > datetime.date(2021, 12, 31):
                continue
            nulo = lambda x: limpiar(x) if limpiar(x) and limpiar(x) != "-" else None
            compras.append((f.isoformat(), prov, llave(prov), m, nulo(r[4]), nulo(r[5]), nulo(r[6]), nulo(r[7]), ini + i))

    out = [f"-- Compras 2018-2021 ({len(compras)} renglones, {saltadas} sin fecha o monto) y categoría de {len(cats)} proveedores de la hoja.",
           "begin;", "delete from public.historial_compras_2018_2021;", "delete from public.compras_hoja_categoria;"]
    filas = [f"({lit(k)}, {lit(v)}, {lit(origen[k])})" for k, v in sorted(cats.items())]
    out.append("insert into public.compras_hoja_categoria (proveedor_llave, categoria, origen) values\n  " + ",\n  ".join(filas) + ";")
    for j in range(0, len(compras), 2000):
        filas = [f"({lit(c[0])}, {lit(c[1])}, {lit(c[2])}, {c[3]}, {lit(c[4])}, {lit(c[5])}, {lit(c[6])}, {lit(c[7])}, {c[8]})" for c in compras[j:j + 2000]]
        out.append("insert into public.historial_compras_2018_2021 (fecha, proveedor_nombre, proveedor_llave, monto, cuenta, descripcion, factura, orden, fila_origen) values\n  "
                   + ",\n  ".join(filas) + ";")
    resumen = ("select jsonb_build_object('compras', (select count(*) from public.historial_compras_2018_2021), "
               "'monto', (select sum(monto) from public.historial_compras_2018_2021), "
               "'categorias', (select count(*) from public.compras_hoja_categoria))")
    if o.ensayo:
        out.append(f"do $$ begin raise exception 'ENSAYO %', ({resumen}); end $$;")
    out.append("commit;")
    sys.stdout.write("\n".join(out) + "\n")


if __name__ == "__main__":
    main()

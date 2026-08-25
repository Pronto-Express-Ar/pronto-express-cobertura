# -*- coding: utf-8 -*-
"""
Cruza clientes + rutas + ventas descargadas por fetch_data.py y arma los
datasets compactos que consume build_html.py / template.html:
  data/clientes_multi.json, data/articulos_multi.json,
  data/ventas_agg_multi.json, data/meses_multi.json
"""
import json
import os

from route_classification import categoria_ruta_especial, seleccionar_rutas_vigentes

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(REPO_ROOT, "data")

EXCLUDE_VENDOR_NUMS = {27, 32, 25, 21, 31}  # Eduardo Ruiz Moreno, Maria Julia Bussi, Alejandra Gonzalez, Superv Federico Yunes, Damian Fernandez
DIA_NOMBRE = {1: "Lunes", 2: "Martes", 3: "Miercoles", 4: "Jueves", 5: "Viernes"}
MES_NOMBRE = {1: "Enero", 2: "Febrero", 3: "Marzo", 4: "Abril", 5: "Mayo", 6: "Junio",
              7: "Julio", 8: "Agosto", 9: "Septiembre", 10: "Octubre", 11: "Noviembre", 12: "Diciembre"}

# ---------- Zona Paulina (union de los poligonos "Zona A" y "Zona B") ----------
ZONA_A_WKT = "POLYGON ((-60.6801158 -32.9504503, -60.6816036 -32.9500866, -60.682419 -32.9528055, -60.687261 -32.971697, -60.6352379 -32.9811136, -60.624929 -32.982909, -60.6177885 -32.9830136, -60.6177885 -32.9758856, -60.6184752 -32.969045, -60.6198485 -32.9609797, -60.6801158 -32.9504503))"
ZONA_B_WKT = "POLYGON ((-60.661474 -32.976573, -60.6905264 -32.9711301, -60.6917802 -32.9705541, -60.7147736 -32.9711301, -60.7187712 -32.9714484, -60.7194686 -32.9712144, -60.7216036 -32.9713404, -60.7230305 -32.9714214, -60.7256591 -32.9715294, -60.7340276 -32.9715654, -60.7342958 -32.9730685, -60.7355833 -32.9776498, -60.7358086 -32.9786938, -60.736109 -32.9796028, -60.7359051 -32.9833917, -60.7354974 -32.9849757, -60.7315814 -32.9951715, -60.7277619 -33.0051322, -60.726732 -33.0078404, -60.7235133 -33.0077324, -60.7209706 -33.0076605, -60.7191574 -33.0114122, -60.715574 -33.0187803, -60.7126987 -33.0220368, -60.7108426 -33.0242317, -60.7090294 -33.0249244, -60.7075703 -33.0263996, -60.7018411 -33.0345489, -60.6946957 -33.0372652, -60.6911981 -33.0349087, -60.688945 -33.0348188, -60.6861984 -33.0333976, -60.6834733 -33.0298357, -60.6821 -33.0295659, -60.6796802 -33.0297753, -60.6636298 -33.0269688, -60.664574 -33.0123594, -60.665718 -32.991518, -60.661474 -32.976573))"


def parse_wkt_polygon(wkt):
    coords_str = wkt.replace("POLYGON ((", "").replace("))", "")
    pts = []
    for pair in coords_str.split(","):
        lon, lat = pair.strip().split(" ")
        pts.append((float(lon), float(lat)))
    return pts


ZONA_A = parse_wkt_polygon(ZONA_A_WKT)
ZONA_B = parse_wkt_polygon(ZONA_B_WKT)


def point_in_polygon(lon, lat, poly):
    inside = False
    n = len(poly)
    j = n - 1
    for i in range(n):
        xi, yi = poly[i]
        xj, yj = poly[j]
        if ((yi > lat) != (yj > lat)) and (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi):
            inside = not inside
        j = i
    return inside


def zona_de(lon, lat):
    if lon is None or lat is None or lon == 0 or lat == 0:
        return None
    if point_in_polygon(lon, lat, ZONA_A) or point_in_polygon(lon, lat, ZONA_B):
        return "Zona Paulina"
    return None


# ---------- Rutas / vendedores ----------
rutas = json.load(open(f"{DATA_DIR}/rutas.json", encoding="utf-8"))
rutas = [r for r in rutas if "idRuta" in r]
ruta_por_id = seleccionar_rutas_vigentes(rutas)
vendedor_nombre = {}
for r in ruta_por_id.values():
    pid = r.get("idPersonal", 0)
    if pid and pid > 0:
        vendedor_nombre[pid] = r.get("desPersonal", "").strip()


def ruta_info(id_ruta):
    if id_ruta is None or id_ruta == 0:
        return None
    id_ruta = int(id_ruta)
    ruta = ruta_por_id.get(id_ruta)
    categoria_especial = categoria_ruta_especial(ruta)
    if categoria_especial:
        return {
            "vendedorNum": None,
            "vendedorNombre": None,
            "diaNombre": categoria_especial,
            "esDiaSemana": False,
        }
    if id_ruta == 9999 or id_ruta >= 1000:
        return None
    vendedor_num = id_ruta // 10
    dia = id_ruta % 10
    if vendedor_num not in vendedor_nombre:
        return None
    return {
        "vendedorNum": vendedor_num,
        "vendedorNombre": vendedor_nombre[vendedor_num],
        "diaNombre": DIA_NOMBRE.get(dia, f"Otro({dia})"),
        "esDiaSemana": dia in DIA_NOMBRE,
    }


# ---------- Clientes ----------
clientes_raw = json.load(open(f"{DATA_DIR}/clientes.json", encoding="utf-8"))
clientes_raw = [c for c in clientes_raw if "idCliente" in c]


def nombre_cliente(cli):
    for al in cli.get("eClialias", []):
        if al.get("anulado"):
            continue
        rs = (al.get("razonSocial") or "").strip()
        if rs:
            return rs
        nom = f"{al.get('apellidoPaterno','').strip()} {al.get('nombres','').strip()}".strip()
        if nom:
            return nom
    return f"Cliente {cli.get('idCliente')}"


def ruta_actual(cli):
    activos = [e for e in cli.get("eClifuerza", []) if not e.get("anulado") and e.get("fechaFinFuerza") == "9999-12-31"]
    if not activos:
        return None
    activos.sort(key=lambda e: e.get("fechaInicioFuerza") or "")
    return activos[-1].get("idRuta")


def to_float(s):
    try:
        return float(s)
    except (TypeError, ValueError):
        return None


clientes_out = {}
for cli in clientes_raw:
    idc = cli.get("idCliente")
    idr = ruta_actual(cli)
    info = ruta_info(idr)
    if info and info["vendedorNum"] in EXCLUDE_VENDOR_NUMS:
        continue
    lon = to_float(cli.get("longitudGeo"))
    lat = to_float(cli.get("latitudGeo"))
    clientes_out[idc] = {
        "id": idc,
        "n": nombre_cliente(cli),
        "loc": cli.get("desLocalidad") or "",
        "sc": (cli.get("desSubcanalMkt") or "SIN SUBCANAL").strip() or "SIN SUBCANAL",
        "v": info["vendedorNum"] if info and info["esDiaSemana"] else None,
        "vn": info["vendedorNombre"] if info and info["esDiaSemana"] else None,
        "d": info["diaNombre"] if info else "Sin ruta",
        "z": zona_de(lon, lat),
    }

print("Clientes en alcance:", len(clientes_out))
print("Con Zona Paulina:", sum(1 for c in clientes_out.values() if c["z"] == "Zona Paulina"))

with open(f"{DATA_DIR}/clientes_multi.json", "w", encoding="utf-8") as f:
    json.dump(list(clientes_out.values()), f, ensure_ascii=False)

# ---------- Articulos (catalogo + linea de producto) ----------
articulos_raw = json.load(open(f"{DATA_DIR}/articulos.json", encoding="utf-8"))


def linea_de(art):
    for ag in art.get("eAgrupaciones", []):
        if ag.get("idFormaAgrupar") == "LINPRODU":
            return (ag.get("desAgrupacion") or "SIN LINEA").strip() or "SIN LINEA"
    return "SIN LINEA"


def marca_de(art):
    for ag in art.get("eAgrupaciones", []):
        if ag.get("idFormaAgrupar") == "MARCA":
            return (ag.get("desAgrupacion") or "").strip()
    return ""


PROVEEDOR_MAP = {
    "la paulina": "LA PAULINA",
    "ricrem": "LA PAULINA",
    "orali": "ORALI",
    "precios fabrica orali": "ORALI",
    "la casona": "SODECAR",
    "la residencia": "SODECAR",
    "ilolay": "ILOLAY",
    "la quesera": "LA QUESERA",
    "prinlac": "PRINLAC",
    "cab espinillos": "CAB ESPINILLOS",
    "cleff": "CLEFF",
    "don amado": "DON AMADO",
    "onneg": "ONNEG",
}

# Proveedores que no forman parte del universo comercial de este informe.
# Se excluyen antes de agregar ventas para que tampoco afecten generales,
# objetivos, cobertura, rankings ni historiales por cliente.
PROVEEDORES_EXCLUIDOS = {
    "CAB ESPINILLOS",
    "DULCOR",
    "GRUPOLAR",
    "MANICOL",
    "PRONTO EXPRESS",
}


def proveedor_de(art):
    marca = marca_de(art)
    return PROVEEDOR_MAP.get(marca.casefold(), marca or "Sin proveedor")


articulos_out = []
articulos_excluidos = {}
for a in articulos_raw:
    if a.get("anulado"):
        continue
    proveedor = proveedor_de(a)
    if proveedor.upper() in PROVEEDORES_EXCLUIDOS:
        articulos_excluidos[proveedor] = articulos_excluidos.get(proveedor, 0) + 1
        continue
    articulos_out.append({
        "id": a["idArticulo"],
        "n": a["desArticulo"].strip(),
        "l": linea_de(a),
        # El panel usa este campo como proveedor. RICREM ya queda consolidado
        # dentro de LA PAULINA y las marcas de SODECAR/ORALI tambien se agrupan.
        "m": proveedor,
    })
articulos_out.sort(key=lambda a: (a["l"], a["n"]))
print("Articulos catalogo:", len(articulos_out))
print("Articulos excluidos por proveedor:", articulos_excluidos)

with open(f"{DATA_DIR}/articulos_multi.json", "w", encoding="utf-8") as f:
    json.dump(articulos_out, f, ensure_ascii=False)

# ---------- Ventas agregadas por cliente x articulo x dia exacto ----------
# Granularidad diaria (no solo mensual) para poder filtrar por un dia puntual
# en el panel; los meses para los checkboxes se derivan de estas fechas.
ventas = json.load(open(f"{DATA_DIR}/ventas.json", encoding="utf-8"))
print("Lineas de venta totales cargadas:", len(ventas))

# Se conserva el vendedor del comprobante. No alcanza con inferirlo desde la
# ruta actual del cliente: un cliente puede cambiar de ruta o recibir una venta
# de otro vendedor. Chess usa idVendedor para sus informes por vendedor.
agg = {}  # (idc, ida, fecha "YYYY-MM-DD", id_vendedor) -> {imp, kg}
# Conservamos ventas de todos los clientes existentes en Chess. La cartera
# visible sigue excluyendo los vendedores definidos arriba, pero una venta debe
# permanecer disponible para cuadrar un informe por idVendedor del comprobante.
clientes_ids = {c.get("idCliente") for c in clientes_raw if c.get("idCliente") is not None}
articulos_ids = {a["id"] for a in articulos_out}
meses_vistos = {}  # "YYYY-MM" -> (year, month)

for v in ventas:
    idc = v.get("idCliente")
    if idc not in clientes_ids:
        continue
    if v.get("anulado") == "SI":
        continue
    ida = v.get("idArticulo")
    if ida not in articulos_ids:
        continue
    fecha = v.get("fechaComprobate") or ""
    if len(fecha) < 10:
        continue
    mes_key = fecha[0:7]  # "YYYY-MM"
    year, mes_num = int(fecha[0:4]), int(fecha[5:7])
    meses_vistos[mes_key] = (year, mes_num)

    # el ERP ya deja todo con el signo correcto (positivo en facturas, negativo
    # en notas de credito), asi que sumar subtotalFinal directo da el neto.
    importe = float(v.get("subtotalFinal") or 0)
    peso_total = float(v.get("pesoTotal") or 0)
    unimedtotal = float(v.get("unimedtotal") or 0)
    # pesable -> peso real de balanza (pesoTotal); no pesable -> cantidad x peso
    # estandar del articulo, ya calculado por el ERP en unimedtotal.
    kg = peso_total if peso_total else unimedtotal
    id_vendedor = int(v.get("idVendedor") or 0)

    key = (idc, ida, fecha, id_vendedor)
    e = agg.setdefault(key, {"imp": 0.0, "kg": 0.0})
    e["imp"] += importe
    e["kg"] += kg

rows = []
for (idc, ida, fecha, id_vendedor), e in agg.items():
    imp = round(e["imp"], 2)
    kg = round(e["kg"], 3)
    if imp == 0 and kg == 0:
        continue
    # Esquema: cliente, articulo, fecha, importe, kilos, vendedor comprobante.
    rows.append([idc, ida, fecha, imp, kg, id_vendedor])

print("Filas agregadas cliente x articulo x dia:", len(rows))
with open(f"{DATA_DIR}/ventas_agg_multi.json", "w", encoding="utf-8") as f:
    json.dump(rows, f, ensure_ascii=False)

# ---------- Metadata de meses (para los checkboxes dinamicos) ----------
meses_out = []
for mes_key, (year, mes_num) in sorted(meses_vistos.items()):
    meses_out.append({"key": mes_key, "label": f"{MES_NOMBRE[mes_num]} {year}"})
print("Meses con datos:", [m["key"] for m in meses_out])

with open(f"{DATA_DIR}/meses_multi.json", "w", encoding="utf-8") as f:
    json.dump(meses_out, f, ensure_ascii=False)

print("DONE prepare_multi")

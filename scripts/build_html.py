# -*- coding: utf-8 -*-
import json
import os
from datetime import date

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(REPO_ROOT, "data")
OUT_PATH = os.path.join(REPO_ROOT, "index.html")

clientes = json.load(open(f"{DATA_DIR}/clientes_multi.json", encoding="utf-8"))
articulos = json.load(open(f"{DATA_DIR}/articulos_multi.json", encoding="utf-8"))
ventas = json.load(open(f"{DATA_DIR}/ventas_agg_multi.json", encoding="utf-8"))
meses = json.load(open(f"{DATA_DIR}/meses_multi.json", encoding="utf-8"))

lineas = sorted(set(a["l"] for a in articulos))


def to_js(obj):
    return json.dumps(obj, ensure_ascii=False).replace("</", "<\\/")


data_js = (
    f"const CLIENTES = {to_js(clientes)};\n"
    f"const ARTICULOS = {to_js(articulos)};\n"
    f"const VENTAS = {to_js(ventas)};\n"
    f"const MESES = {to_js(meses)};\n"
)

fecha_generado = date.today().strftime("%d/%m/%Y")

html = open(os.path.join(os.path.dirname(__file__), "template.html"), encoding="utf-8").read()
html = html.replace("__TOTAL_CLIENTES__", str(len(clientes)))
html = html.replace("__TOTAL_ARTICULOS__", str(len(articulos)))
html = html.replace("__TOTAL_LINEAS__", str(len(lineas)))
html = html.replace("__FECHA_GENERADO__", fecha_generado)
html = html.replace("__DATA_JS__", data_js)

with open(OUT_PATH, "w", encoding="utf-8") as f:
    f.write(html)

print("Escrito:", OUT_PATH, len(html), "bytes")

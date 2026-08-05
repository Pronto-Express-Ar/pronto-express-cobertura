# -*- coding: utf-8 -*-
"""
Baja de la API de Chess ERP todo lo necesario para el panel: rutas, clientes,
articulos, y ventas de una ventana movil de MESES_ATRAS meses completos hasta
hoy. Pensado para correr diario desde GitHub Actions (o local).

Requiere en el entorno: CHESS_BASE_URL, CHESS_USER, CHESS_PASSWORD.
"""
import os
import sys
import json
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from chess_client import client_from_env

MESES_ATRAS = 3  # meses completos anteriores + el mes actual (parcial)

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(REPO_ROOT, "data")
os.makedirs(DATA_DIR, exist_ok=True)


def ventana_movil(meses_atras):
    hoy = date.today()
    m = hoy.month - meses_atras
    y = hoy.year
    while m <= 0:
        m += 12
        y -= 1
    return date(y, m, 1), hoy


def guardar(nombre, data):
    path = os.path.join(DATA_DIR, nombre)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)
    print(f"  guardado {nombre}: {len(data)} filas", flush=True)


def main():
    c = client_from_env()
    c.login()
    print("Login OK", flush=True)

    rutas = c.get_rutas_venta()
    rutas = [r for r in rutas if "idRuta" in r]
    guardar("rutas.json", rutas)

    clientes = c.get_clientes_paginado(anulado=False)
    clientes = [x for x in clientes if "idCliente" in x]
    guardar("clientes.json", clientes)

    articulos = c.get_articulos_paginado()
    articulos = [a for a in articulos if "idArticulo" in a and "desArticulo" in a]
    guardar("articulos.json", articulos)

    desde, hasta = ventana_movil(MESES_ATRAS)
    print(f"Ventas desde {desde.isoformat()} hasta {hasta.isoformat()}...", flush=True)
    ventas = c.get_ventas_rango(desde.isoformat(), hasta.isoformat(), detallado=True)
    guardar("ventas.json", ventas)

    print("DONE", flush=True)


if __name__ == "__main__":
    main()

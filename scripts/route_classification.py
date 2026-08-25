"""Clasificación de rutas especiales devueltas por Chess ERP."""

from __future__ import annotations

import unicodedata


def _normalizar(texto: object) -> str:
    base = unicodedata.normalize("NFKD", str(texto or ""))
    return "".join(c for c in base if not unicodedata.combining(c)).upper().strip()


def seleccionar_rutas_vigentes(rutas: list[dict]) -> dict[int, dict]:
    """Elige la definición vigente (o la más reciente) para cada idRuta."""
    resultado: dict[int, dict] = {}
    for ruta in rutas:
        if ruta.get("anulado") or ruta.get("idRuta") is None:
            continue
        id_ruta = int(ruta["idRuta"])
        anterior = resultado.get(id_ruta)
        clave = (ruta.get("fechaHasta") == "9999-12-31", ruta.get("fechaDesde") or "")
        clave_anterior = (
            anterior.get("fechaHasta") == "9999-12-31",
            anterior.get("fechaDesde") or "",
        ) if anterior else (False, "")
        if anterior is None or clave > clave_anterior:
            resultado[id_ruta] = ruta
    return resultado


def categoria_ruta_especial(ruta: dict | None) -> str | None:
    """Traduce desRuta/desModoAtencion a una categoría visible del panel."""
    if not ruta:
        return None
    descripcion = _normalizar(
        f"{ruta.get('desRuta', '')} {ruta.get('desModoAtencion', '')}"
    )
    if "TELEFON" in descripcion:
        return "Telefónica"
    if "MOSTRADOR" in descripcion and "PERSON" in descripcion:
        return "Mostrador / Personales"
    if "ONLINE" in descripcion and "MOSTRADOR" in descripcion:
        return "Online / Mostrador"
    if "ONLINE" in descripcion:
        return "Online"
    if "MOSTRADOR" in descripcion:
        return "Mostrador"
    return None

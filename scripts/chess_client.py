"""
Cliente para la API de Chess ERP (Nextbyn).

Maneja login (obtiene sessionId y lo manda como header Cookie en cada
llamada posterior) y wrappers para los endpoints que usamos:
  - /rutasVenta/
  - /clientes/
  - /ventas/

Basado en la documentación de /apidoc de Chess ERP.
"""
from __future__ import annotations

import os
import time
from dataclasses import dataclass
from typing import Any

import requests


class ChessERPError(Exception):
    pass


@dataclass
class ChessERPClient:
    base_url: str
    usuario: str
    password: str
    timeout: int = 30

    def __post_init__(self):
        self.base_url = self.base_url.rstrip("/")
        self._session_id: str | None = None
        self._session_expires: float | None = None
        self._http = requests.Session()

    # ------------------------------------------------------------------
    # Autenticación
    # ------------------------------------------------------------------
    def login(self) -> None:
        """Autentica contra /auth/login y guarda el sessionId."""
        url = f"{self.base_url}/web/api/chess/v1/auth/login"
        resp = self._http.post(
            url,
            json={"usuario": self.usuario, "password": self.password},
            headers={"Accept": "application/json", "Content-Type": "application/json"},
            timeout=self.timeout,
        )
        if resp.status_code != 200:
            raise ChessERPError(
                f"Login falló ({resp.status_code}): {resp.text[:300]}"
            )
        data = resp.json()
        session_id = data.get("sessionId")
        if not session_id:
            raise ChessERPError(f"Login OK pero sin sessionId en la respuesta: {data}")

        self._session_id = session_id
        # La doc no especifica el formato exacto de "expires"; si no se puede
        # parsear, simplemente re-logueamos ante cualquier 401.
        self._session_expires = None

        # IMPORTANTE: en la práctica, el campo "sessionId" que devuelve el
        # servidor YA viene armado como el string completo de la cookie
        # (ej: "JSESSIONID=2DE32EF215E39C6E35AC5CF8B54E3888278C15DC9948.oepas16"),
        # no es solo el token pelado como sugiere la doc. Lo mandamos tal cual.
        self._http.headers.update({"Cookie": session_id})

    def _ensure_session(self) -> None:
        if not self._session_id:
            self.login()

    def _get(self, path: str, params: dict[str, Any] | None = None) -> Any:
        self._ensure_session()
        url = f"{self.base_url}/web/api/chess/v1/{path.lstrip('/')}"
        resp = self._http.get(
            url, params=params or {}, headers={"Accept": "application/json"}, timeout=self.timeout
        )
        if resp.status_code == 401:
            # Sesión vencida: re-logueamos una vez y reintentamos.
            self.login()
            resp = self._http.get(
                url, params=params or {}, headers={"Accept": "application/json"}, timeout=self.timeout
            )
        if resp.status_code != 200:
            raise ChessERPError(f"GET {path} falló ({resp.status_code}): {resp.text[:300]}")
        return resp.json()

    # ------------------------------------------------------------------
    # Endpoints
    # ------------------------------------------------------------------
    def get_rutas_venta(
        self,
        sucursal: int | None = None,
        fuerzaventa: int | None = None,
        modoatencion: str | None = None,
        ruta: int | None = None,
        anulado: bool = False,
    ) -> list[dict]:
        """Devuelve las rutas de venta (con clienteRutas adentro)."""
        params = {
            "sucursal": sucursal,
            "fuerzaventa": fuerzaventa,
            "modoatencion": modoatencion,
            "ruta": ruta,
            "anulado": str(anulado).lower(),
        }
        params = {k: v for k, v in params.items() if v is not None}
        data = self._get("rutasVenta/", params)
        # La respuesta real viene envuelta como {"RutasVenta": {"eRutasVenta": [...]}}
        if isinstance(data, dict):
            rutas_venta = data.get("RutasVenta")
            if isinstance(rutas_venta, dict) and "eRutasVenta" in rutas_venta:
                return rutas_venta["eRutasVenta"] or []
            return data.get("rutasVenta") or data.get("items") or [data]
        return data

    def get_articulos(self, anulado: bool = False, nro_lote: int | None = None) -> list[dict]:
        params = {"anulado": str(anulado).lower(), "nroLote": nro_lote}
        params = {k: v for k, v in params.items() if v is not None}
        data = self._get("articulos/", params)
        if isinstance(data, dict):
            arts = data.get("Articulos")
            if isinstance(arts, dict) and "eArticulos" in arts:
                return arts["eArticulos"] or []
            return data.get("articulos") or data.get("items") or [data]
        return data

    def get_articulos_paginado(self, anulado: bool = False, max_lotes: int = 100) -> list[dict]:
        todas: list[dict] = []
        primera = self.get_articulos(anulado=anulado, nro_lote=None)
        if not primera:
            return todas
        todas.extend(primera)
        lote = 2
        while lote <= max_lotes:
            pagina = self.get_articulos(anulado=anulado, nro_lote=lote)
            if not pagina:
                break
            todas.extend(pagina)
            lote += 1
            time.sleep(0.2)
        return todas

    def get_clientes(
        self,
        cliente: int | None = None,
        sucursal: int | None = None,
        anulado: bool = False,
        nro_lote: int | None = None,
    ) -> list[dict]:
        params = {
            "cliente": cliente,
            "sucursal": sucursal,
            "anulado": str(anulado).lower(),
            "nroLote": nro_lote,
        }
        params = {k: v for k, v in params.items() if v is not None}
        data = self._get("clientes/", params)
        # Confirmado con datos reales: viene como {"Clientes": {"eClientes": [...]}}
        if isinstance(data, dict):
            clientes = data.get("Clientes")
            if isinstance(clientes, dict) and "eClientes" in clientes:
                return clientes["eClientes"] or []
            return data.get("clientes") or data.get("items") or [data]
        return data

    def get_clientes_paginado(self, anulado: bool = False, max_lotes: int = 100) -> list[dict]:
        """
        Igual que con /ventas/: el primer pedido va sin nroLote, y de ahí
        en más se pagina con nroLote=2,3,4... hasta que vuelva vacío.
        """
        todas: list[dict] = []
        primera = self.get_clientes(anulado=anulado, nro_lote=None)
        if not primera:
            return todas
        todas.extend(primera)

        lote = 2
        while lote <= max_lotes:
            pagina = self.get_clientes(anulado=anulado, nro_lote=lote)
            if not pagina:
                break
            todas.extend(pagina)
            lote += 1
            time.sleep(0.2)
        return todas

    def _extraer_lineas_venta(self, data: Any) -> list[dict]:
        """
        La respuesta real viene como una lista de "lotes", cada uno con
        forma {"dsReporteComprobantesApi": {"VentasResumen": [...]},
        "cantComprobantesVentas": N}. Cada elemento de VentasResumen ya es
        una línea de venta aplanada (cliente + vendedor + artículo + peso +
        importe juntos), no hay que desanidar comprobante/líneas.
        """
        if isinstance(data, dict):
            lotes = [data]
        elif isinstance(data, list):
            lotes = data
        else:
            return []
        lineas = []
        for lote in lotes:
            reporte = lote.get("dsReporteComprobantesApi", lote) if isinstance(lote, dict) else {}
            resumen = reporte.get("VentasResumen") or reporte.get("VentasDetalle") or []
            lineas.extend(resumen)
        return lineas

    def get_ventas(
        self,
        fecha_desde: str,
        fecha_hasta: str,
        empresas: str | None = None,
        detallado: bool = True,
        nro_lote: int | None = None,
    ) -> list[dict]:
        """
        fecha_desde / fecha_hasta en formato "YYYY-MM-DD" (confirmado con
        datos reales). Devuelve la lista de líneas de venta ya aplanada.
        """
        params = {
            "fechaDesde": fecha_desde,
            "fechaHasta": fecha_hasta,
            "empresas": empresas,
            "detallado": str(detallado).lower(),
            "nroLote": nro_lote,
        }
        params = {k: v for k, v in params.items() if v is not None}
        data = self._get("ventas/", params)
        return self._extraer_lineas_venta(data)

    def get_ventas_paginado(
        self,
        fecha_desde: str,
        fecha_hasta: str,
        empresas: str | None = None,
        detallado: bool = True,
        max_lotes: int = 50,
    ) -> list[dict]:
        """
        Vamos pidiendo lotes hasta que uno vuelva vacío o lleguemos a
        max_lotes por seguridad. Importante: el primer pedido NO manda
        nroLote (confirmado que mandar nroLote=0 devuelve vacío, así que
        probablemente el server espera "sin parámetro" para el primer lote
        y numeración desde 1 o 2 en adelante para los siguientes).
        """
        todas = []
        primera = self.get_ventas(fecha_desde, fecha_hasta, empresas=empresas, detallado=detallado, nro_lote=None)
        print(f"  Lote inicial (sin nroLote): {len(primera)} líneas")
        if not primera:
            return todas
        todas.extend(primera)

        lote = 2
        while lote <= max_lotes:
            pagina = self.get_ventas(fecha_desde, fecha_hasta, empresas=empresas, detallado=detallado, nro_lote=lote)
            print(f"  Lote {lote}: {len(pagina)} líneas")
            if not pagina:
                break
            todas.extend(pagina)
            lote += 1
            time.sleep(0.2)  # no reventar la API
        return todas

    def get_ventas_rango(
        self,
        fecha_desde: str,
        fecha_hasta: str,
        empresas: str | None = None,
        detallado: bool = True,
        dias_por_tanda: int = 28,
    ) -> list[dict]:
        """
        La API rechaza rangos de más de un mes calendario de una
        ("El rango de fecha corresponde a uno mayor de mes calendario").
        Esta función parte el rango pedido en tandas de hasta
        dias_por_tanda días (28 por defecto, para no pisar el límite de
        "mes calendario" ni siquiera en meses largos) y junta todo.
        """
        from datetime import date as _date
        from datetime import timedelta as _timedelta

        d0 = _date.fromisoformat(fecha_desde)
        d1 = _date.fromisoformat(fecha_hasta)
        todas: list[dict] = []
        cursor = d0
        while cursor <= d1:
            fin_tanda = min(cursor + _timedelta(days=dias_por_tanda - 1), d1)
            print(f"Pidiendo ventas {cursor.isoformat()} a {fin_tanda.isoformat()}...")
            todas.extend(
                self.get_ventas_paginado(
                    cursor.isoformat(), fin_tanda.isoformat(), empresas=empresas, detallado=detallado
                )
            )
            cursor = fin_tanda + _timedelta(days=1)
        return todas


def client_from_env() -> ChessERPClient:
    """Arma el cliente leyendo un archivo .env (ver .env.example)."""
    from dotenv import load_dotenv

    load_dotenv(override=True)
    base_url = os.environ["CHESS_BASE_URL"]
    usuario = os.environ["CHESS_USER"]
    password = os.environ["CHESS_PASSWORD"]
    return ChessERPClient(base_url=base_url, usuario=usuario, password=password)

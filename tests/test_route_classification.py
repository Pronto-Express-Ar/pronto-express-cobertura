import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

from route_classification import categoria_ruta_especial, seleccionar_rutas_vigentes


class RouteClassificationTests(unittest.TestCase):
    def test_telefonica_por_nombre_o_modo(self):
        self.assertEqual(categoria_ruta_especial({"desRuta": "RUTA VTA TELEFONICA"}), "Telefónica")
        self.assertEqual(categoria_ruta_especial({"desModoAtencion": "TELEFÓNICO"}), "Telefónica")

    def test_mostrador_personales(self):
        ruta = {"desRuta": "RUTA VTAS MOSTRADOR/PERSONALES"}
        self.assertEqual(categoria_ruta_especial(ruta), "Mostrador / Personales")

    def test_online_mostrador(self):
        ruta = {"desRuta": "VTA TIENDA ONLINE/MOSTRADOR"}
        self.assertEqual(categoria_ruta_especial(ruta), "Online / Mostrador")

    def test_ruta_semanal_no_es_especial(self):
        ruta = {"desRuta": "RUTA VENDEDOR V24", "desModoAtencion": "PRESENCIAL"}
        self.assertIsNone(categoria_ruta_especial(ruta))

    def test_prefiere_definicion_vigente(self):
        rutas = [
            {"idRuta": 3331, "desRuta": "RUTA DE VENTA 3331", "fechaDesde": "2024-07-15", "fechaHasta": "2024-08-08", "anulado": False},
            {"idRuta": 3331, "desRuta": "VTA TIENDA ONLINE/MOSTRADOR", "fechaDesde": "2024-08-09", "fechaHasta": "9999-12-31", "anulado": False},
        ]
        elegida = seleccionar_rutas_vigentes(rutas)[3331]
        self.assertEqual(elegida["desRuta"], "VTA TIENDA ONLINE/MOSTRADOR")


if __name__ == "__main__":
    unittest.main()

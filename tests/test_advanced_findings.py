import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
TEMPLATE = ROOT / "scripts" / "template.html"


class AdvancedFindingsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = TEMPLATE.read_text(encoding="utf-8")

    def test_has_executive_conclusion(self):
        self.assertIn('id="findings-conclusion"', self.html)
        self.assertIn("Conclusión final", self.html)
        self.assertIn("conclusionTone", self.html)

    def test_tracks_retention_and_customer_balance(self):
        self.assertIn("compradoresAnterior", self.html)
        self.assertIn("clientesRetenidos", self.html)
        self.assertIn("Retención de clientes", self.html)
        self.assertIn("Balance de clientes", self.html)

    def test_surfaces_risk_and_recovery_value(self):
        self.assertIn("valorRiesgo", self.html)
        self.assertIn("valorRecuperado", self.html)
        self.assertIn("Valor en riesgo", self.html)
        self.assertIn("Valor recuperado", self.html)

    def test_surfaces_operational_hotspots(self):
        self.assertIn("Vendedor con más riesgo", self.html)
        self.assertIn("Día crítico", self.html)
        self.assertIn("Producto para recuperar", self.html)


if __name__ == "__main__":
    unittest.main()

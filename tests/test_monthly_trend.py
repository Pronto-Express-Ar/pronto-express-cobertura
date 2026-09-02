import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
TEMPLATE = ROOT / "scripts" / "template.html"


class MonthlyTrendTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = TEMPLATE.read_text(encoding="utf-8")
        match = re.search(
            r"function sumaMesComparable\(.*?\n\}", cls.html, re.DOTALL
        )
        assert match is not None
        cls.function = match.group(0)

    def test_compares_equal_number_of_effective_sales_days(self):
        self.assertIn("const diasComparados = fechasActual.length", self.function)
        self.assertIn("fechasAnterior.slice(0, diasComparados)", self.function)
        self.assertIn("fechasAnterioresComparables.has(fecha)", self.function)

    def test_does_not_cut_previous_month_by_calendar_day(self):
        self.assertNotIn("Date.UTC", self.function)
        self.assertNotIn("fecha.slice(8, 10)", self.function)

    def test_indicator_explains_the_comparison_basis(self):
        self.assertIn("comparativoCurrent.diasComparados", self.html)
        self.assertIn(' : "s"} de venta', self.html)

    def test_indicator_uses_selected_comparison_months(self):
        self.assertIn(
            "sumaMesComparable(clientesObjetivoVendedor, articleScope, "
            "comparisonInfo.actual, comparisonInfo.anterior, v)",
            self.html,
        )
        self.assertIn("${esc(compareCurrentLabel)} vs ${esc(compareBaseLabel)}", self.html)


if __name__ == "__main__":
    unittest.main()

import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
TEMPLATE = ROOT / "scripts" / "template.html"


class IncentivePrintTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = TEMPLATE.read_text(encoding="utf-8")

    def test_incentive_tab_has_pdf_button(self):
        self.assertIn('id="print-incentive-btn"', self.html)
        self.assertIn("Exportar objetivos premios a PDF", self.html)

    def test_print_mode_only_keeps_incentive_tab(self):
        self.assertIn("body.print-incentive-only #incentive-results", self.html)
        self.assertIn("body.print-incentive-only #analysis-results", self.html)

    def test_print_includes_active_incentive_filters(self):
        self.assertIn('id="incentive-print-context"', self.html)
        self.assertIn("data-incentive-day", self.html)
        self.assertIn("data-incentive-zone", self.html)

    def test_print_mode_is_cleaned_after_printing(self):
        self.assertIn("print-incentive-only", self.html)
        self.assertIn('incentivePageStyle.id = "incentive-page-style"', self.html)


if __name__ == "__main__":
    unittest.main()

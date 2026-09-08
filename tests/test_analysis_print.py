import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
TEMPLATE = ROOT / "scripts" / "template.html"


class AnalysisPrintTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = TEMPLATE.read_text(encoding="utf-8")

    def test_analysis_tab_has_pdf_button(self):
        self.assertIn('id="print-analysis-btn"', self.html)
        self.assertIn("Exportar análisis avanzado a PDF", self.html)

    def test_print_mode_only_keeps_advanced_analysis(self):
        self.assertIn("body.print-analysis-only #analysis-results", self.html)
        self.assertIn("body.print-analysis-only #results", self.html)
        self.assertIn("print-analysis-only", self.html)

    def test_print_includes_filtered_context(self):
        self.assertIn('id="analysis-print-context"', self.html)
        self.assertIn('getElementById("analysis-print-context").innerHTML', self.html)

    def test_print_mode_is_cleaned_after_printing(self):
        self.assertIn('"print-table-only", "print-no-detail", "print-analysis-only"', self.html)
        self.assertIn('pageStyle.id = "analysis-page-style"', self.html)


if __name__ == "__main__":
    unittest.main()

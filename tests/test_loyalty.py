import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]


class LoyaltyDashboardTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.template = (ROOT / "scripts" / "template.html").read_text(encoding="utf-8")
        cls.index = (ROOT / "index.html").read_text(encoding="utf-8")
        cls.js = (ROOT / "scripts" / "loyalty.js").read_text(encoding="utf-8")

    def test_tab_and_panel_are_wired_in_template_and_built_page(self):
        for html in (self.template, self.index):
            self.assertIn('id="tab-loyalty"', html)
            self.assertIn('id="loyalty-results"', html)
            self.assertIn('switchTab("loyalty")', html)
            self.assertIn('scripts/loyalty.js?v=20260916-1', html)

    def test_uses_three_requested_months(self):
        self.assertIn('{ key: "2026-07", label: "Julio 2026" }', self.js)
        self.assertIn('{ key: "2026-08", label: "Agosto 2026" }', self.js)
        self.assertIn('{ key: "2026-09", label: "Septiembre 2026" }', self.js)

    def test_counts_unique_invoices_and_excludes_credit_notes(self):
        self.assertIn('const invoiceKey = String(row[6]', self.js)
        self.assertIn('new Set()', self.js)
        self.assertIn('documentType.includes("FACTURA")', self.js)
        self.assertIn('documentType.includes("NOTA")', self.js)

    def test_loyal_means_two_or_more_in_all_three_months(self):
        self.assertIn('counts.filter(count => count >= 2).length', self.js)
        self.assertIn('qualifyingMonths === 3', self.js)
        self.assertIn('Fiel 3/3', self.js)

    def test_export_is_real_xlsx_with_numeric_invoice_counts(self):
        self.assertIn('descargarXlsx(xlsxSheetXml(', self.js)
        self.assertIn('clientes_fidelizados_', self.js)
        self.assertIn('{ t: "n", v: row.counts[0] }', self.js)


if __name__ == "__main__":
    unittest.main()

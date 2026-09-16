import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]


class PaulinaProposalTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.template = (ROOT / "scripts" / "template.html").read_text(encoding="utf-8")
        cls.index = (ROOT / "index.html").read_text(encoding="utf-8")
        cls.script = (ROOT / "scripts" / "paulina-proposal.js").read_text(encoding="utf-8")
        cls.styles = (ROOT / "scripts" / "paulina-proposal.css").read_text(encoding="utf-8")

    def test_tab_and_assets_are_wired(self):
        for html in (self.template, self.index):
            self.assertIn('id="tab-paulina-proposal"', html)
            self.assertIn('id="paulina-proposal-results"', html)
            self.assertIn('switchTab("paulina-proposal")', html)
            self.assertIn('scripts/paulina-proposal.js?v=20260916-1', html)
            self.assertIn('scripts/paulina-proposal.css?v=20260916-1', html)

    def test_focuses_on_three_tractor_products(self):
        self.assertIn('label: "Cremoso"', self.script)
        self.assertIn('label: "Barra Danbo"', self.script)
        self.assertIn('label: "Ralladitos"', self.script)
        self.assertIn('name.includes("BARRA") && name.includes("DANBO")', self.script)
        self.assertIn('line === "RALLADITOS"', self.script)

    def test_goals_are_personalized_from_previous_coverage(self):
        self.assertIn("TARGET_PARTIAL_POINTS = 15", self.script)
        self.assertIn("TARGET_FULL_POINTS = 25", self.script)
        self.assertIn("baseSet.size + partialIncrement", self.script)
        self.assertIn("baseSet.size + fullIncrement", self.script)
        self.assertIn('client.z === "Zona Paulina"', self.script)
        self.assertIn("String(row[5]", self.script)

    def test_is_explicitly_a_non_binding_simulation(self):
        self.assertIn("SIMULACI&Oacute;N COMERCIAL", self.template)
        self.assertIn("no modifica los premios vigentes", self.template)

    def test_export_is_real_xlsx(self):
        self.assertIn("descargarXlsx(xlsxSheetXml", self.script)
        self.assertIn("propuesta_objetivos_paulina_", self.script)

    def test_progress_animation_has_accessibility_fallback(self):
        self.assertIn("prefers-reduced-motion", self.styles)


if __name__ == "__main__":
    unittest.main()

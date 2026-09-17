import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]


class ClientAddressExportTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.template = (ROOT / "scripts" / "template.html").read_text(encoding="utf-8")
        cls.prepare = (ROOT / "scripts" / "prepare_multi.py").read_text(encoding="utf-8")

    def test_pipeline_builds_commercial_address_from_chess_fields(self):
        self.assertIn('cli.get("calle")', self.prepare)
        self.assertIn('cli.get("altura")', self.prepare)
        self.assertIn('"dir": direccion_cliente(cli)', self.prepare)
        self.assertNotIn('calleEntrega', self.prepare)

    def test_client_detail_displays_address_column(self):
        self.assertIn("<th>Direcci&oacute;n</th>", self.template)
        self.assertIn('esc(c.dir || "-")', self.template)

    def test_both_client_exports_include_address(self):
        self.assertEqual(self.template.count('"Direccion"'), 2)
        self.assertGreaterEqual(self.template.count('{ t: "s", v: c.dir || "" }'), 2)


if __name__ == "__main__":
    unittest.main()

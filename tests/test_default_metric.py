import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
TEMPLATE = ROOT / "scripts" / "template.html"


class DefaultMetricTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = TEMPLATE.read_text(encoding="utf-8")

    def test_kilos_radio_is_checked_by_default(self):
        kilos_radio = re.search(r'<input[^>]+id="metric-kg"[^>]*>', self.html)
        money_radio = re.search(r'<input[^>]+id="metric-money"[^>]*>', self.html)

        self.assertIsNotNone(kilos_radio)
        self.assertIsNotNone(money_radio)
        self.assertRegex(kilos_radio.group(0), r'\bchecked\b')
        self.assertNotRegex(money_radio.group(0), r'\bchecked\b')

    def test_kilos_is_the_initial_application_state(self):
        self.assertRegex(self.html, r'\bmetric:\s*"kg"')

    def test_clear_all_filters_restores_kilos(self):
        clear_handler = re.search(
            r'document\.getElementById\("clear-products"\).*?\n\}\);',
            self.html,
            re.DOTALL,
        )
        self.assertIsNotNone(clear_handler)
        self.assertIn('state.metric = "kg"', clear_handler.group(0))
        self.assertIn('r.value === "kg"', clear_handler.group(0))

    def test_last_selected_month_cannot_be_unchecked(self):
        self.assertRegex(self.html, r'if \(checked\.length === 0\)\s*\{\s*cb\.checked = true;')

    def test_product_picker_is_explicitly_grouped_by_line(self):
        self.assertIn("Lineas de producto", self.html)
        self.assertIn('class="line-check"', self.html)
        self.assertIn('class="product-check"', self.html)


if __name__ == "__main__":
    unittest.main()

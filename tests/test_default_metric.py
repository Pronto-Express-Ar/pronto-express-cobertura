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


if __name__ == "__main__":
    unittest.main()

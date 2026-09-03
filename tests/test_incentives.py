import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
TEMPLATE = ROOT / "scripts" / "template.html"
SCRIPT = ROOT / "scripts" / "incentives.js"
STYLES = ROOT / "scripts" / "incentives.css"


class IncentiveDashboardTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = TEMPLATE.read_text(encoding="utf-8")
        cls.js = SCRIPT.read_text(encoding="utf-8")
        cls.css = STYLES.read_text(encoding="utf-8")

    def test_tab_and_assets_are_wired(self):
        self.assertIn('id="tab-incentives"', self.html)
        self.assertIn('id="incentive-results"', self.html)
        self.assertIn('href="scripts/incentives.css"', self.html)
        self.assertIn('src="scripts/incentives.js"', self.html)
        self.assertIn('window.renderIncentives', self.js)

    def test_campaign_months_and_growth_thresholds(self):
        self.assertIn('const BASE_MONTH = "2026-08"', self.js)
        self.assertIn('const CURRENT_MONTH = "2026-09"', self.js)
        self.assertIn('const KG_GROWTH_TARGET = 10', self.js)
        self.assertIn('const KG_PARTIAL_FROM = 5', self.js)

    def test_provider_coverage_rules(self):
        self.assertRegex(
            self.js,
            r'name: "LA PAULINA", kgPrize: 50000, coverageTarget: 85, coveragePartial: 70, zoneOnly: true',
        )
        self.assertRegex(
            self.js,
            r'name: "SODECAR", kgPrize: 0, coverageTarget: 50, coveragePartial: 30, zoneOnly: false',
        )
        self.assertRegex(
            self.js,
            r'name: "ORALI", kgPrize: 0, coverageTarget: 50, coveragePartial: 30, zoneOnly: false',
        )

    def test_kg_goal_is_rendered_only_for_providers_with_a_prize(self):
        self.assertIn(
            'providerResult.provider.kgPrize > 0 ? kgMetric(providerResult) : ""',
            self.js,
        )
        self.assertRegex(self.js, r'if \(provider\.kgPrize > 0\) \{')

    def test_every_prize_family_is_present(self):
        expected_ids = {
            "lp-barras", "lp-cremosos", "lp-mantecas", "lp-otros",
            "so-milan", "so-paleta", "so-mortadelas", "so-jamon",
            "or-pastas", "or-tapas", "or-otros",
        }
        found_ids = set(re.findall(r'id: "([a-z-]+)"', self.js))
        self.assertTrue(expected_ids.issubset(found_ids))

    def test_offers_are_explicitly_included_and_visible(self):
        self.assertIn('norm(article.n).includes("OFERTA")', self.js)
        self.assertIn('class="incentive-offer">OFERTA', self.js)
        self.assertIn("SKU incluidos", self.js)

    def test_coverage_uses_active_route_portfolio_and_current_sales(self):
        self.assertIn('String(client.v) === String(seller)', self.js)
        self.assertIn('client.z === "Zona Paulina"', self.js)
        self.assertIn('monthOf(row) !== CURRENT_MONTH', self.js)
        self.assertIn('rowSeller(row) !== String(seller)', self.js)

    def test_partial_payout_starts_at_half(self):
        self.assertIn("return 0.5 + 0.5 *", self.js)
        self.assertIn("if (value >= fullAt) return 1", self.js)

    def test_progress_animation_has_accessibility_fallback(self):
        self.assertIn("@keyframes incentiveGrow", self.css)
        self.assertIn("prefers-reduced-motion: reduce", self.css)


if __name__ == "__main__":
    unittest.main()

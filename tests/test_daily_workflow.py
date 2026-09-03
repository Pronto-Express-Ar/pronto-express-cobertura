import json
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
WORKFLOW = ROOT / ".github" / "workflows" / "daily-update.yml"


class DailyWorkflowTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.workflow = json.loads(WORKFLOW.read_text(encoding="utf-8"))

    def test_tiene_horario_objetivo_y_respaldos_anticipados(self):
        schedules = [entry["cron"] for entry in self.workflow["on"]["schedule"]]
        self.assertIn("50 9 * * *", schedules)
        self.assertIn("50 5 * * *", schedules)
        self.assertGreaterEqual(len(set(schedules)), 5)

    def test_evitar_consultas_duplicadas_en_intentos_programados(self):
        steps = self.workflow["jobs"]["actualizar"]["steps"]
        freshness = next(step for step in steps if step.get("id") == "freshness")
        self.assertIn("workflow_dispatch", freshness["run"])
        self.assertIn("Generado: <b>${TODAY}</b>", freshness["run"])
        self.assertIn("needs_update=false", freshness["run"])

        guarded = [step for step in steps if step["name"] != "Checkout" and step.get("id") != "freshness"]
        self.assertTrue(guarded)
        for step in guarded:
            self.assertEqual("steps.freshness.outputs.needs_update == 'true'", step.get("if"), step["name"])

    def test_las_corridas_no_se_pisan(self):
        concurrency = self.workflow["concurrency"]
        self.assertEqual("pronto-panel-daily-update", concurrency["group"])
        self.assertFalse(concurrency["cancel-in-progress"])


if __name__ == "__main__":
    unittest.main()

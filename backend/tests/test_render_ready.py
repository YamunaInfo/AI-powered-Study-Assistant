import os
import unittest
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent


class RenderDeploymentTests(unittest.TestCase):
    def test_api_key_is_not_hardcoded(self):
        app_source = (BASE_DIR / "app.py").read_text(encoding="utf-8")
        self.assertNotIn("YOUR_API_KEY_HERE", app_source)

    def test_render_start_command_uses_port_binding(self):
        render_config = (BASE_DIR.parent / "render.yaml").read_text(encoding="utf-8")
        self.assertIn("gunicorn --chdir backend --bind 0.0.0.0:$PORT app:app", render_config)
        self.assertIn("pip install -r backend/requirements.txt", render_config)

    def test_frontend_is_served_with_backend(self):
        import app as app_module

        client = app_module.app.test_client()
        page = client.get("/")
        script = client.get("/script.js")
        self.assertEqual(page.status_code, 200)
        self.assertIn(b"AI Study Assistant", page.data)
        self.assertEqual(script.status_code, 200)
        page.close()
        script.close()

    def test_health_route_exists(self):
        import app as app_module

        client = app_module.app.test_client()
        response = client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["status"], "ok")

    def test_render_disables_local_model_weights(self):
        render_config = (BASE_DIR.parent / "render.yaml").read_text(encoding="utf-8")
        self.assertIn("ENABLE_LOCAL_MODELS", render_config)
        self.assertIn('value: "false"', render_config)


if __name__ == "__main__":
    unittest.main()

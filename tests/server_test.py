import importlib.util
import json
from pathlib import Path
import tempfile
import threading
import unittest
from unittest.mock import patch
from urllib.request import Request, urlopen
from urllib.error import HTTPError

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("lecture_server", ROOT / "backend/server.py")
server = importlib.util.module_from_spec(spec)
spec.loader.exec_module(server)


class ServerTests(unittest.TestCase):
    def test_context_uses_local_material(self):
        fixture = json.loads((ROOT / "tests/fixture.json").read_text(encoding="utf-8"))
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            content = root / "content"; content.mkdir()
            (content / "catalog.json").write_text(json.dumps({"chapters": [{"id": fixture["id"], "concepts": [{"id": "ch99-c01"}]}]}))
            directory = content / fixture["id"]; directory.mkdir()
            (directory / "lesson.json").write_text(json.dumps(fixture), encoding="utf-8")
            data = {"chapter": fixture["id"], "concept": "ch99-c01", "answer": "我的推導", "context": "偽造教材"}
            result = server.review_context(data, root)
            self.assertEqual(result["教材與題目"], fixture["concepts"][0])
            self.assertNotIn("偽造教材", str(result))
            with self.assertRaises(ValueError):
                server.review_context({**data, "chapter": "../../private"}, root)

    def test_http_paths_and_model_failure(self):
        httpd = server.ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
        thread = threading.Thread(target=httpd.serve_forever, daemon=True); thread.start()
        base = f"http://127.0.0.1:{httpd.server_port}"
        try:
            self.assertEqual(urlopen(base + "/").status, 200)
            with patch.dict(server.os.environ, {"GROQ_API_KEY": "", "LECTURE_MODEL": ""}):
                self.assertFalse(json.load(urlopen(base + "/api/status"))["enabled"])
            for path in ["/.env", "/private/materials/a.pdf", "/backend/server.py", "/tests/fixture.json"]:
                with self.assertRaises(HTTPError) as caught:
                    urlopen(base + path)
                self.assertEqual(caught.exception.code, 404)
            request = Request(base + "/api/review", data=b"{}", headers={"Content-Type": "application/json", "Origin": "https://other.example"})
            with self.assertRaises(HTTPError) as caught: urlopen(request)
            self.assertEqual(caught.exception.code, 403)
            request = Request(base + "/api/review", data=b"{}", headers={"Content-Type": "application/json", "Origin": base})
            with patch.object(server, "review_context", return_value={}), patch.object(server, "call_model", side_effect=RuntimeError("AI 尚未啟用")):
                with self.assertRaises(HTTPError) as caught: urlopen(request)
                self.assertEqual(caught.exception.code, 503)
            with patch.object(server, "review_context", return_value={}), patch.object(server, "call_model", return_value="測試替身回饋"):
                self.assertEqual(json.load(urlopen(request))["feedback"], "測試替身回饋")
        finally:
            httpd.shutdown(); httpd.server_close()


if __name__ == "__main__":
    unittest.main()

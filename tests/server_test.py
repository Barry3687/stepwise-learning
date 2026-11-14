import importlib.util
import json
import base64
import io
import zipfile
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

    def test_document_and_image_workflows(self):
        def data(raw, mime="application/octet-stream"):
            return "data:" + mime + ";base64," + base64.b64encode(raw).decode()
        self.assertEqual(server.extract_document({"name": "chapter.md", "data": data("向量講義".encode())})["text"], "向量講義")
        archive = io.BytesIO()
        with zipfile.ZipFile(archive, "w") as z:
            z.writestr("word/document.xml", '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Chapter notes</w:t></w:r></w:p></w:body></w:document>')
        self.assertEqual(server.extract_document({"name": "chapter.docx", "data": data(archive.getvalue())})["text"], "Chapter notes")
        from pypdf import PdfWriter
        pdf = io.BytesIO(); writer = PdfWriter(); writer.add_blank_page(100, 100); writer.write(pdf)
        with self.assertRaisesRegex(ValueError, "掃描版"):
            server.extract_document({"name": "blank.pdf", "data": data(pdf.getvalue())})
        with self.assertRaises(ValueError):
            server.validate_image(data(b"not an image", "image/png"))
        with self.assertRaises(ValueError):
            server.organize_context({"name": "empty.txt", "text": ""})
        self.assertEqual(server.organize_context({"name": "notes.txt", "text": "講義"})["來源檔名"], "notes.txt")

    def test_multimodal_payload(self):
        class Response:
            def __enter__(self):
                return io.StringIO(json.dumps({"choices": [{"message": {"content": "模型替身"}}]}))
            def __exit__(self, *args):
                pass
        image = "data:image/png;base64," + base64.b64encode(b"\x89PNG\r\n\x1a\n").decode()
        with patch.dict(server.os.environ, {"GROQ_API_KEY": "test-only", "LECTURE_MODEL": "text-test", "LECTURE_VISION_MODEL": "vision-test"}):
            with patch.object(server, "urlopen", return_value=Response()) as call:
                self.assertEqual(server.call_model({"image": image, "學生選項": 2, "學生解題過程": "我的算式"}), "模型替身")
                payload = json.loads(call.call_args.args[0].data)
                self.assertEqual(payload["model"], "vision-test")
                self.assertEqual(payload["messages"][1]["content"][1]["image_url"]["url"], image)
                self.assertIn("我的算式", payload["messages"][1]["content"][0]["text"])
        with patch.dict(server.os.environ, {"GROQ_API_KEY": "test-only", "LECTURE_MODEL": "text-test", "LECTURE_VISION_MODEL": ""}):
            with self.assertRaisesRegex(RuntimeError, "圖片"):
                server.call_model({"image": image})

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

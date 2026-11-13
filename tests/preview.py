"""Isolated browser fixture. Never writes lessons to the real catalog."""
import importlib.util
import json
from pathlib import Path
import shutil
import tempfile

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("lecture_server", ROOT / "backend/server.py")
server = importlib.util.module_from_spec(spec)
spec.loader.exec_module(server)

if __name__ == "__main__":
    with tempfile.TemporaryDirectory(prefix="lecture-ui-check-") as folder:
        root = Path(folder)
        shutil.copytree(ROOT, root, dirs_exist_ok=True, ignore=shutil.ignore_patterns("private", ".git", ".env", "__pycache__"))
        lesson = json.loads((ROOT / "tests/fixture.json").read_text(encoding="utf-8"))
        chapter = {"id": lesson["id"], "title": lesson["title"], "path": f"chapters/{lesson['id']}.html",
                   "concepts": [{"id": c["id"], "title": c["title"]} for c in lesson["concepts"]]}
        (root / "content/catalog.json").write_text(json.dumps({"version": 1, "chapters": [chapter]}, ensure_ascii=False), encoding="utf-8")
        directory = root / "content" / lesson["id"]
        directory.mkdir()
        (directory / "lesson.json").write_text(json.dumps(lesson, ensure_ascii=False), encoding="utf-8")
        html = (root / "chapters/lesson.html").read_text(encoding="utf-8").replace("<body>", f'<body data-chapter="{lesson["id"]}">')
        (root / chapter["path"]).write_text(html, encoding="utf-8")
        server.ROOT = root
        print("Isolated UI fixture http://127.0.0.1:8001", flush=True)
        server.ThreadingHTTPServer(("127.0.0.1", 8001), server.Handler).serve_forever()

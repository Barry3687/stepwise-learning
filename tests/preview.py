"""Isolated browser fixture. Never writes lessons to the real catalog."""
import importlib.util
import json
from pathlib import Path
import shutil
import tempfile
import argparse

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("lecture_server", ROOT / "backend/server.py")
server = importlib.util.module_from_spec(spec)
spec.loader.exec_module(server)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8001)
    args = parser.parse_args()
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
        responsive = f'''<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><title>390px 響應式驗收</title><body style="background:#111827;color:#f3f4f6;font-family:sans-serif"><h1>390px 手機版驗收（獨立測試）</h1><iframe title="手機版講義" src="/{chapter['path']}" style="width:390px;height:844px;border:1px solid #64748b"></iframe></body></html>'''
        (root / "responsive-check.html").write_text(responsive, encoding="utf-8")
        server.ROOT = root
        print(f"Isolated UI fixture http://127.0.0.1:{args.port}", flush=True)
        server.ThreadingHTTPServer(("127.0.0.1", args.port), server.Handler).serve_forever()

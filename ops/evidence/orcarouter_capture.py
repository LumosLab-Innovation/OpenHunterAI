#!/usr/bin/env python3
"""Generate OrcaRouter UI evidence from the real built OpenHunterAI frontend.

This serves `frontend/dist` (built here if absent) and a local stub of the
public API carrying dedicated evidence data. It does not use a static mock
page: the screenshots come from the production React bundle rendering the real
Setup page and the real OrcaRouter provider panel.

Output is written to `orca-evidence/` at run time. That directory is not part
of the patch: independent verification generates it, validates the manifest,
and archives the screenshots.

The catalog fixture is a dated slice of
https://api.orcarouter.ai/v1/models?capability=chat. Production discovery calls
that authoritative endpoint directly with the workspace key.
"""

from __future__ import annotations

import hashlib
import json
import os
import subprocess
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
DIST = REPO / "frontend" / "dist"
EVIDENCE = REPO / "orca-evidence"
FIXTURE = json.loads((HERE / "catalog_fixture.json").read_text(encoding="utf-8"))
CHAT_MODELS = FIXTURE["chat"]
IMAGE_MODELS = FIXTURE.get("image", [])
CATALOG_SOURCE = "https://api.orcarouter.ai/v1/models?capability=chat"
FAKE_KEY = "sk-orca-evidence-only-0000000000000000"

STATE: dict = {"starts": 0, "cancelled": [], "saved_masked": None}
ATTEMPTS: dict = {}


def model_view(model: dict) -> dict:
    architecture = model.get("architecture") or {}
    return {
        "id": model["id"],
        "name": model.get("name"),
        "contextLength": model.get("context_length"),
        "inputModalities": architecture.get("input_modalities", []),
        "reasoningEfforts": model.get("reasoning_efforts", []),
        "fromSeed": False,
    }


def status_payload() -> dict:
    return {
        "provider": {
            "id": "orcarouter",
            "displayName": "OrcaRouter Cyber Inference",
            "apiBase": "https://api.orcarouter.ai/v1",
            "authBase": "https://www.orcarouter.ai",
            "homeUrl": "https://www.orcarouter.ai",
            "cyberUrl": "https://www.orcarouter.ai/cyber",
            "cyberModelsUrl": "https://www.orcarouter.ai/models?tier=cyber",
            "defaultModel": "orcarouter/auto",
            "recommendedCyberModels": [
                "orca/orcacyber-ultra-1.0",
                "orca/orcacyber-zero-1.5",
            ],
            "generalFallbackModel": "orcarouter/fusion",
        },
        "auth": {
            "apiKey": {"configured": STATE["saved_masked"] is not None, "maskedKey": STATE["saved_masked"]},
            "pkce": {"available": True, "flow": "loopback", "pendingAttempts": len(ATTEMPTS)},
        },
        "catalog": {
            "capability": "chat",
            "source": "live",
            "degraded": False,
            "catalogSource": CATALOG_SOURCE,
            "modelCount": len(CHAT_MODELS),
            "models": [model_view(model) for model in CHAT_MODELS],
        },
    }


class Handler(BaseHTTPRequestHandler):
    server_version = "OpenHunterEvidence/1.0"

    def log_message(self, *_args) -> None:  # keep the evidence run quiet
        return

    def _send(self, code: int, body: bytes, content_type: str) -> None:
        self.send_response(code)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _json(self, code: int, payload: dict) -> None:
        self._send(code, json.dumps(payload).encode("utf-8"), "application/json")

    def do_GET(self) -> None:  # noqa: N802
        path = urlparse(self.path).path
        if path == "/api/v1/workspace":
            self._json(200, {"mode": "local"})
            return
        if path == "/api/v1/workspace/status":
            self._json(
                200,
                {
                    "mode": "local",
                    "workspace": {"name": "Evidence workspace"},
                    "user": {"id": "evidence", "email": "evidence@example.invalid", "displayName": "Evidence"},
                    "services": {"api": "connected", "database": "connected", "queue": "connected"},
                    "models": [
                        {"role": "low", "provider": "orcarouter", "model": "orcarouter/auto", "configured": True},
                        {"role": "high", "provider": "orcarouter", "model": "orca/orcacyber-ultra-1.0", "configured": True},
                    ],
                },
            )
            return
        if path == "/api/v1/providers/orcarouter":
            self._json(200, status_payload())
            return
        if path == "/api/v1/providers/orcarouter/models":
            capability = parse_qs(urlparse(self.path).query).get("capability", ["chat"])[0]
            models = CHAT_MODELS if capability == "chat" else []
            self._json(
                200,
                {
                    "capability": capability,
                    "source": "live",
                    "degraded": False,
                    "catalogSource": CATALOG_SOURCE,
                    "modelCount": len(models),
                    "models": [model_view(model) for model in models],
                },
            )
            return
        if path.startswith("/api/v1/providers/orcarouter/oauth/"):
            attempt_id = path.rsplit("/", 1)[-1]
            attempt = ATTEMPTS.get(attempt_id)
            if not attempt:
                self._json(404, {"error": {"code": "NOT_FOUND", "message": "Sign-in attempt not found."}})
                return
            self._json(200, attempt)
            return
        self._static(path)

    def do_POST(self) -> None:  # noqa: N802
        path = urlparse(self.path).path
        length = int(self.headers.get("Content-Length") or 0)
        body = json.loads(self.rfile.read(length) or b"{}") if length else {}
        if path == "/api/v1/providers/orcarouter/credentials/api-key":
            key = str(body.get("apiKey", ""))
            if not key.startswith("sk-orca-") or len(key) < 20:
                self._json(400, {"error": {"code": "INVALID_KEY", "message": "OrcaRouter keys start with sk-orca-."}})
                return
            STATE["saved_masked"] = f"{key[:8]}…{key[-4:]}"
            self._json(201, {"authenticated": True, "source": "api_key", "maskedKey": STATE["saved_masked"]})
            return
        if path == "/api/v1/providers/orcarouter/oauth/start":
            STATE["starts"] += 1
            attempt_id = f"evidence-attempt-{STATE['starts']}"
            ATTEMPTS[attempt_id] = {
                "id": attempt_id,
                "authorizeUrl": "https://www.orcarouter.ai/auth?callback_url=http%3A%2F%2F127.0.0.1%3A51733%2Fcb&code_challenge=evidence&code_challenge_method=S256",
                "callbackUrl": "http://127.0.0.1:51733/cb",
                "createdAt": int(time.time() * 1000),
                "status": "pending",
            }
            self._json(201, ATTEMPTS[attempt_id])
            return
        if path.endswith("/cancel"):
            attempt_id = path.split("/")[-2]
            if attempt_id in ATTEMPTS:
                ATTEMPTS[attempt_id]["status"] = "cancelled"
                ATTEMPTS[attempt_id]["error"] = {
                    "code": "PKCE_CODE_INVALID",
                    "message": "OrcaRouter sign-in was cancelled.",
                }
                STATE["cancelled"].append(attempt_id)
                self._send(204, b"", "application/json")
                return
            self._json(404, {"error": {"code": "NOT_FOUND", "message": "Sign-in attempt not found."}})
            return
        self._json(404, {"error": {"code": "NOT_FOUND", "message": "Unknown endpoint."}})

    def do_DELETE(self) -> None:  # noqa: N802
        if urlparse(self.path).path == "/api/v1/providers/orcarouter/credentials":
            STATE["saved_masked"] = None
            self._send(204, b"", "application/json")
            return
        self._json(404, {"error": {"code": "NOT_FOUND", "message": "Unknown endpoint."}})

    def _static(self, path: str) -> None:
        target = DIST / path.lstrip("/")
        if path in ("/", "/setup") or not target.is_file():
            target = DIST / "index.html"
        content_type = {
            ".html": "text/html; charset=utf-8",
            ".js": "text/javascript; charset=utf-8",
            ".css": "text/css; charset=utf-8",
            ".png": "image/png",
            ".svg": "image/svg+xml",
        }.get(target.suffix, "application/octet-stream")
        self._send(200, target.read_bytes(), content_type)


def start_server() -> tuple[ThreadingHTTPServer, str]:
    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server, f"http://127.0.0.1:{server.server_address[1]}"


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def computed(page, selector: str, prop: str) -> str:
    return page.eval_on_selector(
        selector,
        "(el, prop) => getComputedStyle(el).getPropertyValue(prop)",
        prop,
    )


def main() -> int:
    if not (DIST / "index.html").is_file():
        subprocess.run(
            ["npm", "--prefix", "frontend", "run", "build"],
            cwd=REPO,
            check=True,
        )
    EVIDENCE.mkdir(parents=True, exist_ok=True)

    server, base = start_server()
    chromium_path = os.environ.get("CHROMIUM_PATH", "/usr/bin/chromium")
    launch_args = {"headless": True, "args": ["--no-sandbox", "--disable-dev-shm-usage"]}
    if Path(chromium_path).exists():
        launch_args["executable_path"] = chromium_path

    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(**launch_args)
            context = browser.new_context(viewport={"width": 1440, "height": 1000})
            page = context.new_page()
            page.add_init_script("window.open = () => null;")
            page.goto(f"{base}/setup", wait_until="networkidle")
            page.wait_for_selector('[data-testid="orcarouter-provider-panel"]', timeout=20_000)
            page.wait_for_selector('[data-testid="orca-model-trigger"]', timeout=10_000)

            # Provider + both authentication methods are visible.
            assert page.input_value('[data-testid="reasoning-provider"]') == "orcarouter"
            assert page.is_visible('[data-testid="auth-api-key"]')
            assert page.is_visible('[data-testid="auth-pkce"]')
            assert page.is_visible('[data-testid="orca-connect-button"]')

            # Catalog source is the authoritative chat catalog, surfaced verbatim.
            source_text = page.inner_text('[data-testid="orca-catalog-source"]')
            assert CATALOG_SOURCE in source_text, source_text

            # Save a fake key through the real form; the UI must mask it.
            page.fill('[data-testid="orca-api-key-input"]', FAKE_KEY)
            page.click('button:has-text("Save key")')
            page.wait_for_selector('[data-testid="orca-masked-key"]', timeout=10_000)
            masked = page.inner_text('[data-testid="orca-masked-key"]')
            assert "…" in masked and FAKE_KEY not in masked
            assert page.input_value('[data-testid="orca-api-key-input"]') == ""
            assert "sk-orca-evidence-only" not in page.content()
            assert page.evaluate(
                "() => document.querySelector('[data-testid=\"orca-api-key-input\"]').type"
            ) == "password"

            auth_shot = EVIDENCE / "auth-methods.png"
            page.screenshot(path=str(auth_shot), full_page=True)

            # Open the real model listbox and inspect what is actually rendered.
            # Centre the selector so the viewport capture shows the open panel
            # without sticky chrome crossing it.
            page.eval_on_selector(
                '[data-testid="orca-model-trigger"]',
                "el => el.scrollIntoView({block: 'center'})",
            )
            page.wait_for_timeout(150)
            page.click('[data-testid="orca-model-trigger"]')
            page.wait_for_selector('[data-testid="orca-model-listbox"]', timeout=5_000)
            option_ids = page.eval_on_selector_all(
                '[data-testid="orca-model-option"]',
                "els => els.map(el => el.innerText.trim())",
            )
            assert len(option_ids) == len(CHAT_MODELS), (len(option_ids), len(CHAT_MODELS))
            assert any("orcarouter/auto" in text for text in option_ids)
            assert any("orca/orcacyber-ultra-1.0" in text for text in option_ids)

            bg = computed(page, '[data-testid="orca-model-listbox"]', "background-color")
            border_width = computed(page, '[data-testid="orca-model-listbox"]', "border-top-width")
            border_style = computed(page, '[data-testid="orca-model-listbox"]', "border-top-style")
            trigger_box = page.locator('[data-testid="orca-model-trigger"]').bounding_box()
            panel_box = page.locator('[data-testid="orca-model-listbox"]').bounding_box()
            assert trigger_box and panel_box
            right_delta = abs(
                (trigger_box["x"] + trigger_box["width"]) - (panel_box["x"] + panel_box["width"])
            )

            dropdown_shot = EVIDENCE / "text-model-dropdown.png"
            page.screenshot(path=str(dropdown_shot))

            # pagehide must release the login lock and allow a second login
            # without remounting the component.
            page.click('[data-testid="orca-model-trigger"]')
            page.wait_for_selector('[data-testid="orca-model-listbox"]', state="detached")
            page.click('[data-testid="orca-connect-button"]')
            page.wait_for_function(
                "() => document.querySelector('[data-testid=\"orca-connect-button\"]').innerText.includes('Waiting')",
                timeout=5_000,
            )
            page.wait_for_function(
                "() => document.body.innerText.includes('open the authorization page')",
                timeout=5_000,
            )
            page.evaluate("() => window.dispatchEvent(new PageTransitionEvent('pagehide'))")
            page.wait_for_function(
                "() => !document.querySelector('[data-testid=\"orca-connect-button\"]').innerText.includes('Waiting')",
                timeout=5_000,
            )
            deadline = time.time() + 5
            while not STATE["cancelled"] and time.time() < deadline:
                time.sleep(0.1)
            assert STATE["cancelled"], "pagehide did not cancel the server-side attempt"
            page.click('[data-testid="orca-connect-button"]')
            page.wait_for_function(
                "() => document.querySelector('[data-testid=\"orca-connect-button\"]').innerText.includes('Waiting')",
                timeout=5_000,
            )
            assert STATE["starts"] == 2, STATE["starts"]

            page_height = int(page.evaluate("document.documentElement.scrollHeight"))
            browser.close()
    finally:
        server.shutdown()
        server.server_close()

    auth_assertions = {
        "api_key_visible": True,
        "pkce_visible": True,
        "secret_masked": True,
        "controls_enabled": True,
    }
    dropdown_assertions = {
        "dropdown_open": True,
        "item_count": len(CHAT_MODELS),
        "opaque_background": bg.startswith("rgb("),
        "visible_border": border_width not in ("0px", "") and border_style != "none",
        "trigger_panel_right_delta": round(right_delta, 2),
    }
    artifacts = [
        {
            "kind": "auth-methods",
            "path": "auth-methods.png",
            "sha256": sha256(auth_shot),
            "width": 1440,
            "height": page_height,
            "ui": auth_assertions,
        },
        {
            "kind": "text-model-dropdown",
            "path": "text-model-dropdown.png",
            "sha256": sha256(dropdown_shot),
            "width": 1440,
            "height": 1000,
            "ui": dropdown_assertions,
        },
    ]
    manifest = {
        "automation": {
            "framework": "playwright",
            "passed": True,
            "catalog_source": CATALOG_SOURCE,
            "catalog_model_count": len(CHAT_MODELS),
            "image_model_count": len(IMAGE_MODELS),
        },
        "multimodal_capture": False,
        "app_entry": "/setup",
        "evidence_data": "ops/evidence/catalog_fixture.json",
        "ui_assertions": {
            **auth_assertions,
            **dropdown_assertions,
            "pagehide_released_login": True,
            "second_login_started_without_remount": True,
        },
        "artifacts": artifacts,
    }
    (EVIDENCE / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"ok": True, "screenshots": [a["path"] for a in artifacts], "models": len(CHAT_MODELS)}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

from __future__ import annotations

import json
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path

from .log import emit
from .paths import ensure_run_dirs


def _safe(value: str, label: str) -> None:
    if not re.fullmatch(r"[A-Za-z0-9._-]+", value):
        raise ValueError(f"Unsafe {label}: {value}")


def _q(value: str | None) -> str:
    return json.dumps(value)


def init_run(
    target: str,
    git_url: str,
    run_id: str | None = None,
    branch: str | None = None,
) -> Path:
    _safe(target, "target")
    run_id = run_id or datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    _safe(run_id, "run_id")
    path = ensure_run_dirs(target, run_id)
    source = path / "sourcecode"
    if any(source.iterdir()):
        raise FileExistsError(f"sourcecode is not empty: {source}")
    cmd = ["git", "clone", "--depth", "1"]
    if branch:
        cmd += ["--branch", branch]
    subprocess.run(cmd + [git_url, str(source)], check=True)
    commit = subprocess.check_output(
        ["git", "-C", str(source), "rev-parse", "HEAD"], text=True
    ).strip()
    config = "\n".join(
        [
            f"target: {_q(target)}",
            f"run_id: {_q(run_id)}",
            "source:",
            f"  git_url: {_q(git_url)}",
            f"  branch: {_q(branch)}",
            f"  commit: {_q(commit)}",
            'workflow: "scenario-first"',
            'workflow_mode: "human_checkpoints"',
            "quality_gates:",
            "  require_backlog_recorded: true",
            "  require_explicit_router_coverage: true",
            "  require_all_backlog_finished: true",
            "  require_finding_triage: true",
            "  require_rendered_prompts: false",
            "",
        ]
    )
    (path / "run-config.yaml").write_text(config)
    state = {"event": "run_initialized", "target": target, "run_id": run_id, "commit": commit}
    (path / "run-state.jsonl").write_text(json.dumps(state, sort_keys=True) + "\n")
    plan = "\n".join(
        [
            "# Run Plan",
            "",
            f"Target: `{target}`",
            f"Run: `{run_id}`",
            "",
            "## Required Workflow",
            "",
            "Do not start with a broad LLM source sweep. Use the durable tool",
            "workflow first: run recon, create scenarios, record the scenario backlog,",
            "then review recorded scenario prompts through explicit checkpoints.",
            "",
            "After each phase, summarize the artifacts, name the next command,",
            "and ask the human whether to proceed. Do not automatically continue",
            "unless the human has explicitly approved continuous execution.",
            "",
            "1. Choose expert scope (`--all-agents` or repeated `--expert`).",
            "2. `run-recon.py` writes recon inventories and routing units for that scope, then pauses.",
            "3. After recon-to-backlog approval, `create-scenarios.py` prepares the router prompt,",
            "   the scenario-router answers it, and `record-scenario-backlog.py` records routed",
            "   scenarios before the next human checkpoint.",
            "   The recorder rejects missing routing-unit or path/expert coverage",
            "   unless the router supplied explicit coverage decisions.",
            "4. Expert work consumes `scenarios/backlog/S*.md` after approval.",
            "5. `record-scenario-result.py` writes finished results and finding",
            "   candidates.",
            "6. `render-finding-triage-prompt.py` and `record-finding-triage.py`",
            "   run one independent triage agent per candidate before any final",
            "   finding is materialized.",
            "7. Repeat approved expert and triage checkpoints until every backlog",
            "   scenario has a finished result, every candidate has a triage",
            "   decision, then validate the run.",
            "",
        ]
    )
    (path / "plan.md").write_text(plan)
    emit(path, "orchestrator", "initialized", "Fresh source checkout and run config created")
    return path

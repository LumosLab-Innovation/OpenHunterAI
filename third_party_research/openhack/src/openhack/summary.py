"""Run summaries and human checkpoint guidance.

The phase commands usually perform one durable phase. Some handoff commands
inside an already approved phase, such as scenario-router prompt rendering, use
the same formatter while pointing at the next in-phase command.
"""

from __future__ import annotations

import json
import re
from collections import Counter
from pathlib import Path
from typing import Iterable

from .expert_scope import read_run_expert_scope, scope_summary
from .paths import root, run_path


PROCEED_PROMPT = "Summarize this checkpoint, then ask the user whether to proceed."
CONTINUE_LOOP_PROMPT = (
    "If the full scenario loop was already approved, summarize status and "
    "continue without asking for another human approval."
)


def _display(path: Path | str) -> str:
    value = Path(path)
    try:
        return value.relative_to(root()).as_posix()
    except ValueError:
        return str(value)


def _count(path: Path, pattern: str) -> int:
    return len(list(path.glob(pattern))) if path.exists() else 0


def _line_count(path: Path) -> int:
    return len(path.read_text().splitlines()) if path.exists() else 0


def _missing_renders(path: Path) -> list[str]:
    missing: list[str] = []
    for scenario in sorted((path / "scenarios" / "backlog").glob("S*.json")):
        rendered = scenario.with_suffix(".md")
        if not rendered.exists():
            missing.append(scenario.stem)
    return missing


def _unfinished(path: Path) -> list[str]:
    finished = {
        item.stem for item in (path / "scenarios" / "finished").glob("S*.json")
    }
    unfinished: list[str] = []
    for scenario in sorted((path / "scenarios" / "backlog").glob("S*.json")):
        if scenario.stem not in finished:
            unfinished.append(scenario.stem)
    return unfinished


def _candidate_ids(path: Path) -> list[str]:
    return [item.stem for item in sorted((path / "finding-candidates").glob("S*-F*.json"))]


def _triaged_ids(path: Path) -> set[str]:
    return {
        item.stem
        for item in (path / "finding-triage" / "decisions").glob("S*-F*.json")
    }


def _untriaged(path: Path) -> list[str]:
    triaged = _triaged_ids(path)
    return [candidate_id for candidate_id in _candidate_ids(path) if candidate_id not in triaged]


def phase_counts(target: str, run_id: str) -> dict[str, int]:
    """Return the run counters shown in status summaries."""
    path = run_path(target, run_id)
    recon = path / "recon-output"
    return {
        "recon_items": _line_count(recon / "recon-items.jsonl"),
        "routes": _line_count(recon / "routes.jsonl"),
        "inputs": _line_count(recon / "inputs.jsonl"),
        "sinks": _line_count(recon / "sinks.jsonl"),
        "exposures": _line_count(recon / "exposures.jsonl"),
        "routing_units": _line_count(recon / "routing-units.jsonl"),
        "scenario_router_prompt": int(
            (path / "scenarios" / "scenario-router-prompt.md").exists()
        ),
        "scenarios_backlog": _count(path / "scenarios" / "backlog", "S*.json"),
        "rendered_prompts": _count(path / "scenarios" / "backlog", "S*.md"),
        "scenarios_finished": _count(path / "scenarios" / "finished", "S*.json"),
        "finding_candidates": _count(path / "finding-candidates", "S*-F*.json"),
        "triage_prompts": _count(path / "finding-triage" / "prompts", "S*-F*.md"),
        "triage_decisions": _count(path / "finding-triage" / "decisions", "S*-F*.json"),
        "findings": _count(path / "findings", "*.md"),
    }


def next_step(target: str, run_id: str) -> dict[str, str]:
    """Describe the next incomplete phase without executing it."""
    path = run_path(target, run_id)
    if not (path / "run-config.yaml").exists():
        return {
            "title": "Initialize Run",
            "summary": "Create the run folder and fresh source checkout.",
            "command": "openhack init-run <target> <git-url>",
        }
    if not (path / "recon-output" / "recon-items.jsonl").exists():
        return {
            "title": "Run Recon",
            "summary": (
                "Choose security experts first, then generate source recon "
                "items and lightweight inventories."
            ),
            "command": (
                f"openhack run-recon {target} {run_id} --all-agents"
            ),
        }
    if not (path / "scenarios" / "scenario-router-prompt.md").exists():
        return {
            "title": "Generate Scenario Backlog",
            "summary": (
                "Approve one routing phase to build the scenario-router prompt, "
                "have the router answer it, and record the backlog."
            ),
            "command": f"openhack create-scenarios {target} {run_id}",
        }
    index = path / "scenarios" / "index.jsonl"
    if not index.exists() or _line_count(index) == 0:
        return {
            "title": "Complete Scenario Backlog",
            "summary": (
                "Have the scenario-router answer the rendered prompt, then "
                "record its JSON. If recon-to-backlog routing was already "
                "approved, continue without another human gate."
            ),
            "command": (
                f"openhack record-scenario-backlog "
                f"{target} {run_id} router-result.json"
            ),
        }
    missing_renders = _missing_renders(path)
    if missing_renders:
        return {
            "title": "Continue Approved Scenario Loop",
            "summary": (
                f"{len(missing_renders)} scenario prompts are not rendered. "
                f"Render the next prompt ({missing_renders[0]}), then continue "
                "rendering and reviewing each unfinished scenario under the "
                "existing full-backlog approval."
            ),
            "command": (
                f"openhack render-scenario-prompt "
                f"{target} {run_id} {missing_renders[0]}"
            ),
            "proceed_prompt": CONTINUE_LOOP_PROMPT,
        }
    unfinished = _unfinished(path)
    if unfinished:
        return {
            "title": "Continue Approved Scenario Loop",
            "summary": (
                f"{len(unfinished)} scenarios still need individual expert "
                f"results, starting at {unfinished[0]}. Continue through the "
                "entire unfinished backlog under the existing approval."
            ),
            "command": (
                f"openhack record-scenario-result "
                f"{target} {run_id} {unfinished[0]} result.json"
            ),
            "proceed_prompt": CONTINUE_LOOP_PROMPT,
        }
    untriaged = _untriaged(path)
    if untriaged:
        next_candidate = untriaged[0]
        prompt = path / "finding-triage" / "prompts" / f"{next_candidate}.md"
        if not prompt.exists():
            return {
                "title": "Continue Approved Finding Triage Loop",
                "summary": (
                    f"{len(untriaged)} finding candidates still need independent "
                    f"triage, starting at {next_candidate}. Render the next "
                    "triage prompt first."
                ),
                "command": (
                    f"openhack render-finding-triage-prompt "
                    f"{target} {run_id} {next_candidate}"
                ),
                "proceed_prompt": CONTINUE_LOOP_PROMPT,
            }
        return {
            "title": "Continue Approved Finding Triage Loop",
            "summary": (
                f"{len(untriaged)} finding candidates still need independent "
                f"triage, starting at {next_candidate}. Record that agent's "
                "decision before materializing any final finding."
            ),
            "command": (
                f"openhack record-finding-triage "
                f"{target} {run_id} {next_candidate} triage-result.json"
            ),
            "proceed_prompt": CONTINUE_LOOP_PROMPT,
        }
    return {
        "title": "Validate Run",
        "summary": (
            "All recorded scenarios have finished results and finding candidates "
            "have triage decisions; validate the run before release or handoff."
        ),
        "command": f"openhack validate-run {target} {run_id}",
    }


def format_checkpoint(
    title: str,
    summary: str,
    artifacts: Iterable[Path | str] = (),
    review: str | None = None,
    next_command: str | None = None,
    next_note: str | None = None,
    next_command_label: str = "Next command after approval:",
    proceed_prompt: str | None = PROCEED_PROMPT,
) -> str:
    """Format a command result as a checkpoint or approved in-phase handoff."""
    lines = [f"Phase complete: {title}", f"Summary: {summary}"]
    if artifacts:
        lines.append("Artifacts:")
        lines.extend(f"- {_display(item)}" for item in artifacts)
    if review:
        lines.append(f"Review before proceeding: {review}")
    if next_note:
        lines.append(f"Next step: {next_note}")
    if next_command:
        lines.append(next_command_label)
        lines.append(f"  {next_command}")
    if proceed_prompt:
        lines.append(f"Proceed prompt: {proceed_prompt}")
    return "\n".join(lines)


def format_next_step(target: str, run_id: str) -> str:
    """Format the next checkpoint for status and handoff output."""
    step = next_step(target, run_id)
    in_approved_loop = step.get("proceed_prompt") == CONTINUE_LOOP_PROMPT
    heading = "Next action" if in_approved_loop else "Next checkpoint"
    command_label = (
        "Next command in approved loop:"
        if in_approved_loop
        else "Next command after approval:"
    )
    return "\n".join(
        [
            f"{heading}: {step['title']}",
            f"Summary: {step['summary']}",
            command_label,
            f"  {step['command']}",
            f"Proceed prompt: {step.get('proceed_prompt', PROCEED_PROMPT)}",
        ]
    )


def _severities(path: Path) -> Counter[str]:
    counts: Counter[str] = Counter()
    for finding in path.glob("*.md"):
        match = re.search(r"^- Severity: (.+)$", finding.read_text(), re.M)
        counts[match.group(1) if match else "Unknown"] += 1
    return counts


def _expert_opportunities(path: Path) -> dict[str, int]:
    coverage = path / "coverage-gaps.json"
    if not coverage.exists():
        return {}
    items = json.loads(coverage.read_text()).get("expert_opportunities", [])
    values: Counter[str] = Counter()
    for item in items:
        values[item["expert"]] += item.get("candidate_paths", 0)
    return dict(values)


def summarize_run(target: str, run_id: str) -> list[str]:
    """Summarize current run counts and the next checkpoint."""
    path = run_path(target, run_id)
    recon = path / "recon-output"
    counts = phase_counts(target, run_id)
    stalled = bool(counts["recon_items"])
    stalled &= not counts["scenarios_backlog"]
    stalled &= not counts["scenarios_finished"]
    lines = [f"run={target}/{run_id}"]
    scope = read_run_expert_scope(path)
    if scope:
        lines.append(f"expert_scope={scope_summary(scope['experts'])}")
    for name in [
        "recon_items",
        "routes",
        "inputs",
        "sinks",
        "exposures",
        "routing_units",
    ]:
        lines.append(f"{name}={counts[name]}")
    opportunities = _expert_opportunities(recon)
    if opportunities:
        values = ",".join(f"{k}:{opportunities[k]}" for k in sorted(opportunities))
        lines.append(f"expert_opportunities={values}")
    lines.append(f"scenario_router_prompt={counts['scenario_router_prompt']}")
    lines.append(f"stalled_after_recon={int(stalled)}")
    for name in [
        "scenarios_backlog",
        "rendered_prompts",
        "scenarios_finished",
        "finding_candidates",
        "triage_prompts",
        "triage_decisions",
        "findings",
    ]:
        lines.append(f"{name}={counts[name]}")
    sev = _severities(path / "findings")
    lines.append("severities=" + ",".join(f"{k}:{sev[k]}" for k in sorted(sev)))
    lines.append("")
    lines.extend(format_next_step(target, run_id).splitlines())
    return lines

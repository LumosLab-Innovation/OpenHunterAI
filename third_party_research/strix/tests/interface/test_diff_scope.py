import importlib.util
from pathlib import Path

import pytest


def _load_utils_module():
    module_path = Path(__file__).resolve().parents[2] / "strix" / "interface" / "utils.py"
    spec = importlib.util.spec_from_file_location("strix_interface_utils_test", module_path)
    if spec is None or spec.loader is None:
        raise RuntimeError("Failed to load strix.interface.utils for tests")

    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


utils = _load_utils_module()


def test_parse_name_status_uses_rename_destination_path() -> None:
    raw = (
        b"R100\x00old/path.py\x00new/path.py\x00"
        b"R75\x00legacy/module.py\x00modern/module.py\x00"
        b"M\x00src/app.py\x00"
        b"A\x00src/new_file.py\x00"
        b"D\x00src/deleted.py\x00"
    )

    entries = utils._parse_name_status_z(raw)
    classified = utils._classify_diff_entries(entries)

    assert "new/path.py" in classified["analyzable_files"]
    assert "old/path.py" not in classified["analyzable_files"]
    assert "modern/module.py" in classified["analyzable_files"]
    assert classified["renamed_files"][0]["old_path"] == "old/path.py"
    assert classified["renamed_files"][0]["new_path"] == "new/path.py"
    assert "src/deleted.py" in classified["deleted_files"]
    assert "src/deleted.py" not in classified["analyzable_files"]


def test_build_diff_scope_instruction_includes_added_modified_and_deleted_guidance() -> None:
    scope = utils.RepoDiffScope(
        source_path="/tmp/repo",
        workspace_subdir="repo",
        base_ref="refs/remotes/origin/main",
        merge_base="abc123",
        added_files=["src/added.py"],
        modified_files=["src/changed.py"],
        renamed_files=[{"old_path": "src/old.py", "new_path": "src/new.py", "similarity": 90}],
        deleted_files=["src/deleted.py"],
        analyzable_files=["src/added.py", "src/changed.py", "src/new.py"],
    )

    instruction = utils.build_diff_scope_instruction([scope])

    assert "For Added files, review the entire file content." in instruction
    assert "For Modified files, focus primarily on the changed areas." in instruction
    assert "Note: These files were deleted" in instruction
    assert "src/deleted.py" in instruction
    assert "src/old.py -> src/new.py" in instruction


def test_resolve_base_ref_prefers_github_base_ref(monkeypatch) -> None:
    calls: list[str] = []

    def fake_ref_exists(_repo_path: Path, ref: str) -> bool:
        calls.append(ref)
        return ref == "refs/remotes/origin/release-2026"

    monkeypatch.setattr(utils, "_git_ref_exists", fake_ref_exists)
    monkeypatch.setattr(utils, "_extract_github_base_sha", lambda _env: None)
    monkeypatch.setattr(utils, "_resolve_origin_head_ref", lambda _repo_path: None)

    base_ref = utils._resolve_base_ref(
        Path("/tmp/repo"),
        diff_base=None,
        env={"GITHUB_BASE_REF": "release-2026"},
    )

    assert base_ref == "refs/remotes/origin/release-2026"
    assert calls[0] == "refs/remotes/origin/release-2026"


def test_resolve_base_ref_falls_back_to_remote_main(monkeypatch) -> None:
    calls: list[str] = []

    def fake_ref_exists(_repo_path: Path, ref: str) -> bool:
        calls.append(ref)
        return ref == "refs/remotes/origin/main"

    monkeypatch.setattr(utils, "_git_ref_exists", fake_ref_exists)
    monkeypatch.setattr(utils, "_extract_github_base_sha", lambda _env: None)
    monkeypatch.setattr(utils, "_resolve_origin_head_ref", lambda _repo_path: None)

    base_ref = utils._resolve_base_ref(Path("/tmp/repo"), diff_base=None, env={})

    assert base_ref == "refs/remotes/origin/main"
    assert "refs/remotes/origin/main" in calls
    assert "origin/main" not in calls


def test_resolve_diff_scope_context_auto_degrades_when_repo_scope_resolution_fails(
    monkeypatch,
) -> None:
    source = {"source_path": "/tmp/repo", "workspace_subdir": "repo"}

    monkeypatch.setattr(utils, "_should_activate_auto_scope", lambda *_args, **_kwargs: True)
    monkeypatch.setattr(utils, "_is_git_repo", lambda _repo_path: True)
    monkeypatch.setattr(
        utils,
        "_resolve_repo_diff_scope",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(ValueError("shallow history")),
    )

    result = utils.resolve_diff_scope_context(
        local_sources=[source],
        scope_mode="auto",
        diff_base=None,
        non_interactive=True,
        env={},
    )

    assert result.active is False
    assert result.mode == "auto"
    assert result.metadata["active"] is False
    assert result.metadata["mode"] == "auto"
    assert "skipped_diff_scope_sources" in result.metadata
    assert result.metadata["skipped_diff_scope_sources"] == [
        "/tmp/repo (diff-scope skipped: shallow history)"
    ]


def test_resolve_diff_scope_context_diff_mode_still_raises_on_repo_scope_resolution_failure(
    monkeypatch,
) -> None:
    source = {"source_path": "/tmp/repo", "workspace_subdir": "repo"}

    monkeypatch.setattr(utils, "_is_git_repo", lambda _repo_path: True)
    monkeypatch.setattr(
        utils,
        "_resolve_repo_diff_scope",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(ValueError("shallow history")),
    )

    with pytest.raises(ValueError, match="shallow history"):
        utils.resolve_diff_scope_context(
            local_sources=[source],
            scope_mode="diff",
            diff_base=None,
            non_interactive=True,
            env={},
        )

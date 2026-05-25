import json
import threading
import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from strix.tools.registry import register_tool


_notes_storage: dict[str, dict[str, Any]] = {}
_VALID_NOTE_CATEGORIES = ["general", "findings", "methodology", "questions", "plan", "wiki"]
_notes_lock = threading.RLock()
_loaded_notes_run_dir: str | None = None
_DEFAULT_CONTENT_PREVIEW_CHARS = 280


def _get_run_dir() -> Path | None:
    try:
        from strix.telemetry.tracer import get_global_tracer

        tracer = get_global_tracer()
        if not tracer:
            return None
        return tracer.get_run_dir()
    except (ImportError, OSError, RuntimeError):
        return None


def _get_notes_jsonl_path() -> Path | None:
    run_dir = _get_run_dir()
    if not run_dir:
        return None

    notes_dir = run_dir / "notes"
    notes_dir.mkdir(parents=True, exist_ok=True)
    return notes_dir / "notes.jsonl"


def _append_note_event(op: str, note_id: str, note: dict[str, Any] | None = None) -> None:
    notes_path = _get_notes_jsonl_path()
    if not notes_path:
        return

    event: dict[str, Any] = {
        "timestamp": datetime.now(UTC).isoformat(),
        "op": op,
        "note_id": note_id,
    }
    if note is not None:
        event["note"] = note

    with notes_path.open("a", encoding="utf-8") as f:
        f.write(f"{json.dumps(event, ensure_ascii=True)}\n")


def _load_notes_from_jsonl(notes_path: Path) -> dict[str, dict[str, Any]]:
    hydrated: dict[str, dict[str, Any]] = {}
    if not notes_path.exists():
        return hydrated

    with notes_path.open(encoding="utf-8") as f:
        for raw_line in f:
            line = raw_line.strip()
            if not line:
                continue

            try:
                event = json.loads(line)
            except json.JSONDecodeError:
                continue

            op = str(event.get("op", "")).strip().lower()
            note_id = str(event.get("note_id", "")).strip()
            if not note_id or op not in {"create", "update", "delete"}:
                continue

            if op == "delete":
                hydrated.pop(note_id, None)
                continue

            note = event.get("note")
            if not isinstance(note, dict):
                continue

            existing = hydrated.get(note_id, {})
            existing.update(note)
            hydrated[note_id] = existing

    return hydrated


def _ensure_notes_loaded() -> None:
    global _loaded_notes_run_dir  # noqa: PLW0603

    run_dir = _get_run_dir()
    run_dir_key = str(run_dir.resolve()) if run_dir else "__no_run_dir__"
    if _loaded_notes_run_dir == run_dir_key:
        return

    _notes_storage.clear()

    notes_path = _get_notes_jsonl_path()
    if notes_path:
        _notes_storage.update(_load_notes_from_jsonl(notes_path))
        try:
            for note_id, note in _notes_storage.items():
                if note.get("category") == "wiki":
                    _persist_wiki_note(note_id, note)
        except OSError:
            pass

    _loaded_notes_run_dir = run_dir_key


def _sanitize_wiki_title(title: str) -> str:
    cleaned = "".join(ch.lower() if ch.isalnum() else "-" for ch in title.strip())
    slug = "-".join(part for part in cleaned.split("-") if part)
    return slug or "wiki-note"


def _get_wiki_directory() -> Path | None:
    try:
        run_dir = _get_run_dir()
        if not run_dir:
            return None

        wiki_dir = run_dir / "wiki"
        wiki_dir.mkdir(parents=True, exist_ok=True)
    except OSError:
        return None
    else:
        return wiki_dir


def _get_wiki_note_path(note_id: str, note: dict[str, Any]) -> Path | None:
    wiki_dir = _get_wiki_directory()
    if not wiki_dir:
        return None

    wiki_filename = note.get("wiki_filename")
    if not isinstance(wiki_filename, str) or not wiki_filename.strip():
        title = note.get("title", "wiki-note")
        wiki_filename = f"{note_id}-{_sanitize_wiki_title(str(title))}.md"
        note["wiki_filename"] = wiki_filename

    return wiki_dir / wiki_filename


def _persist_wiki_note(note_id: str, note: dict[str, Any]) -> None:
    wiki_path = _get_wiki_note_path(note_id, note)
    if not wiki_path:
        return

    tags = note.get("tags", [])
    tags_line = ", ".join(str(tag) for tag in tags) if isinstance(tags, list) and tags else "none"

    content = (
        f"# {note.get('title', 'Wiki Note')}\n\n"
        f"**Note ID:** {note_id}\n"
        f"**Created:** {note.get('created_at', '')}\n"
        f"**Updated:** {note.get('updated_at', '')}\n"
        f"**Tags:** {tags_line}\n\n"
        "## Content\n\n"
        f"{note.get('content', '')}\n"
    )
    wiki_path.write_text(content, encoding="utf-8")


def _remove_wiki_note(note_id: str, note: dict[str, Any]) -> None:
    wiki_path = _get_wiki_note_path(note_id, note)
    if not wiki_path:
        return

    if wiki_path.exists():
        wiki_path.unlink()


def _filter_notes(
    category: str | None = None,
    tags: list[str] | None = None,
    search_query: str | None = None,
) -> list[dict[str, Any]]:
    _ensure_notes_loaded()
    filtered_notes = []

    for note_id, note in _notes_storage.items():
        if category and note.get("category") != category:
            continue

        if tags:
            note_tags = note.get("tags", [])
            if not any(tag in note_tags for tag in tags):
                continue

        if search_query:
            search_lower = search_query.lower()
            title_match = search_lower in note.get("title", "").lower()
            content_match = search_lower in note.get("content", "").lower()
            if not (title_match or content_match):
                continue

        note_with_id = note.copy()
        note_with_id["note_id"] = note_id
        filtered_notes.append(note_with_id)

    filtered_notes.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return filtered_notes


def _to_note_listing_entry(
    note: dict[str, Any],
    *,
    include_content: bool = False,
) -> dict[str, Any]:
    entry = {
        "note_id": note.get("note_id"),
        "title": note.get("title", ""),
        "category": note.get("category", "general"),
        "tags": note.get("tags", []),
        "created_at": note.get("created_at", ""),
        "updated_at": note.get("updated_at", ""),
    }

    wiki_filename = note.get("wiki_filename")
    if isinstance(wiki_filename, str) and wiki_filename:
        entry["wiki_filename"] = wiki_filename

    content = str(note.get("content", ""))
    if include_content:
        entry["content"] = content
    elif content:
        if len(content) > _DEFAULT_CONTENT_PREVIEW_CHARS:
            entry["content_preview"] = (
                f"{content[:_DEFAULT_CONTENT_PREVIEW_CHARS].rstrip()}..."
            )
        else:
            entry["content_preview"] = content

    return entry


@register_tool(sandbox_execution=False)
def create_note(  # noqa: PLR0911
    title: str,
    content: str,
    category: str = "general",
    tags: list[str] | None = None,
) -> dict[str, Any]:
    with _notes_lock:
        try:
            _ensure_notes_loaded()

            if not title or not title.strip():
                return {"success": False, "error": "Title cannot be empty", "note_id": None}

            if not content or not content.strip():
                return {"success": False, "error": "Content cannot be empty", "note_id": None}

            if category not in _VALID_NOTE_CATEGORIES:
                return {
                    "success": False,
                    "error": (
                        f"Invalid category. Must be one of: {', '.join(_VALID_NOTE_CATEGORIES)}"
                    ),
                    "note_id": None,
                }

            note_id = ""
            for _ in range(20):
                candidate = str(uuid.uuid4())[:5]
                if candidate not in _notes_storage:
                    note_id = candidate
                    break
            if not note_id:
                return {"success": False, "error": "Failed to allocate note ID", "note_id": None}

            timestamp = datetime.now(UTC).isoformat()

            note = {
                "title": title.strip(),
                "content": content.strip(),
                "category": category,
                "tags": tags or [],
                "created_at": timestamp,
                "updated_at": timestamp,
            }

            _notes_storage[note_id] = note
            _append_note_event("create", note_id, note)
            if category == "wiki":
                _persist_wiki_note(note_id, note)

        except (ValueError, TypeError) as e:
            return {"success": False, "error": f"Failed to create note: {e}", "note_id": None}
        except OSError as e:
            return {"success": False, "error": f"Failed to persist wiki note: {e}", "note_id": None}
        else:
            return {
                "success": True,
                "note_id": note_id,
                "message": f"Note '{title}' created successfully",
            }


@register_tool(sandbox_execution=False)
def list_notes(
    category: str | None = None,
    tags: list[str] | None = None,
    search: str | None = None,
    include_content: bool = False,
) -> dict[str, Any]:
    with _notes_lock:
        try:
            filtered_notes = _filter_notes(category=category, tags=tags, search_query=search)
            notes = [
                _to_note_listing_entry(note, include_content=include_content)
                for note in filtered_notes
            ]

            return {
                "success": True,
                "notes": notes,
                "total_count": len(notes),
            }

        except (ValueError, TypeError) as e:
            return {
                "success": False,
                "error": f"Failed to list notes: {e}",
                "notes": [],
                "total_count": 0,
            }


@register_tool(sandbox_execution=False)
def get_note(note_id: str) -> dict[str, Any]:
    with _notes_lock:
        try:
            _ensure_notes_loaded()

            if not note_id or not note_id.strip():
                return {
                    "success": False,
                    "error": "Note ID cannot be empty",
                    "note": None,
                }

            note = _notes_storage.get(note_id)
            if note is None:
                return {
                    "success": False,
                    "error": f"Note with ID '{note_id}' not found",
                    "note": None,
                }

            note_with_id = note.copy()
            note_with_id["note_id"] = note_id

        except (ValueError, TypeError) as e:
            return {
                "success": False,
                "error": f"Failed to get note: {e}",
                "note": None,
            }
        else:
            return {"success": True, "note": note_with_id}


def append_note_content(note_id: str, delta: str) -> dict[str, Any]:
    with _notes_lock:
        try:
            _ensure_notes_loaded()

            if note_id not in _notes_storage:
                return {"success": False, "error": f"Note with ID '{note_id}' not found"}

            if not isinstance(delta, str):
                return {"success": False, "error": "Delta must be a string"}

            note = _notes_storage[note_id]
            existing_content = str(note.get("content") or "")
            updated_content = f"{existing_content.rstrip()}{delta}"
            return update_note(note_id=note_id, content=updated_content)

        except (ValueError, TypeError) as e:
            return {"success": False, "error": f"Failed to append note content: {e}"}


@register_tool(sandbox_execution=False)
def update_note(
    note_id: str,
    title: str | None = None,
    content: str | None = None,
    tags: list[str] | None = None,
) -> dict[str, Any]:
    with _notes_lock:
        try:
            _ensure_notes_loaded()

            if note_id not in _notes_storage:
                return {"success": False, "error": f"Note with ID '{note_id}' not found"}

            note = _notes_storage[note_id]

            if title is not None:
                if not title.strip():
                    return {"success": False, "error": "Title cannot be empty"}
                note["title"] = title.strip()

            if content is not None:
                if not content.strip():
                    return {"success": False, "error": "Content cannot be empty"}
                note["content"] = content.strip()

            if tags is not None:
                note["tags"] = tags

            note["updated_at"] = datetime.now(UTC).isoformat()
            _append_note_event("update", note_id, note)
            if note.get("category") == "wiki":
                _persist_wiki_note(note_id, note)

            return {
                "success": True,
                "message": f"Note '{note['title']}' updated successfully",
            }

        except (ValueError, TypeError) as e:
            return {"success": False, "error": f"Failed to update note: {e}"}
        except OSError as e:
            return {"success": False, "error": f"Failed to persist wiki note: {e}"}


@register_tool(sandbox_execution=False)
def delete_note(note_id: str) -> dict[str, Any]:
    with _notes_lock:
        try:
            _ensure_notes_loaded()

            if note_id not in _notes_storage:
                return {"success": False, "error": f"Note with ID '{note_id}' not found"}

            note = _notes_storage[note_id]
            note_title = note["title"]
            if note.get("category") == "wiki":
                _remove_wiki_note(note_id, note)
            del _notes_storage[note_id]
            _append_note_event("delete", note_id)

        except (ValueError, TypeError) as e:
            return {"success": False, "error": f"Failed to delete note: {e}"}
        except OSError as e:
            return {"success": False, "error": f"Failed to delete wiki note: {e}"}
        else:
            return {
                "success": True,
                "message": f"Note '{note_title}' deleted successfully",
            }

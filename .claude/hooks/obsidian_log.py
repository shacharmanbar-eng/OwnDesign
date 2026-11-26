"""Stop hook: records what happened in this session into an Obsidian vault.

The vault path comes from the OBSIDIAN_VAULT environment variable (set in the git-ignored
.claude/settings.local.json), so no personal path is committed. Writes:
  <vault>/Atelier/Log/YYYY-MM-DD.md   one entry per turn: branch, new commits, changed files, last reply
  <vault>/Atelier/Wiki/*.md           a mirror of the repository's wiki/ pages
Never fails the turn: every error is swallowed.
"""

import json
import os
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path

MAX_REPLY_CHARS = 800


def git(repo: Path, *args: str) -> str:
    result = subprocess.run(["git", *args], cwd=repo, capture_output=True, text=True, encoding="utf-8", timeout=10)
    return result.stdout.strip() if result.returncode == 0 else ""


def last_reply(transcript: str | None) -> str:
    if not transcript or not Path(transcript).is_file():
        return ""
    text = ""
    with open(transcript, encoding="utf-8", errors="replace") as handle:
        for line in handle:
            try:
                entry = json.loads(line)
            except ValueError:
                continue
            message = entry.get("message") or {}
            if entry.get("type") != "assistant" or not isinstance(message.get("content"), list):
                continue
            parts = [block.get("text", "") for block in message["content"] if block.get("type") == "text"]
            if any(part.strip() for part in parts):
                text = "\n".join(parts).strip()
    return text[:MAX_REPLY_CHARS] + ("…" if len(text) > MAX_REPLY_CHARS else "")


def main() -> None:
    vault = os.environ.get("OBSIDIAN_VAULT")
    if not vault or not Path(vault).is_dir():
        return
    try:
        payload = json.load(sys.stdin)
    except ValueError:
        payload = {}
    repo = Path(payload.get("cwd") or os.getcwd())
    root = Path(vault) / "Atelier"
    (root / "Log").mkdir(parents=True, exist_ok=True)

    state = root / ".last-commit"
    head = git(repo, "rev-parse", "HEAD")
    previous = state.read_text(encoding="utf-8").strip() if state.exists() else ""
    commits = git(repo, "log", "--oneline", f"{previous}..HEAD") if previous and previous != head else ""
    if not previous:
        commits = git(repo, "log", "--oneline", "-5")
    changed = git(repo, "status", "--short")
    reply = last_reply(payload.get("transcript_path"))

    now = datetime.now()
    lines = [f"## {now:%H:%M} · `{git(repo, 'branch', '--show-current') or 'detached'}`", ""]
    if commits:
        lines += ["**Commits**", "", *[f"- `{c}`" for c in commits.splitlines()], ""]
    if changed:
        lines += ["**Uncommitted changes**", "", "```", changed, "```", ""]
    if reply:
        lines += ["**Summary**", "", *[f"> {r}" for r in reply.splitlines()], ""]
    if len(lines) > 2:
        log = root / "Log" / f"{now:%Y-%m-%d}.md"
        header = "" if log.exists() else f"# Atelier · {now:%Y-%m-%d}\n\n"
        with open(log, "a", encoding="utf-8") as handle:
            handle.write(header + "\n".join(lines) + "\n")
    if head:
        state.write_text(head, encoding="utf-8")

    wiki = repo / "wiki"
    if wiki.is_dir():
        (root / "Wiki").mkdir(exist_ok=True)
        for page in wiki.glob("*.md"):
            shutil.copy2(page, root / "Wiki" / page.name)


if __name__ == "__main__":
    try:
        main()
    except Exception:
        pass

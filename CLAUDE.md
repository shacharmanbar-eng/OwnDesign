# CLAUDE.md

Atelier: an AI-assisted interior design platform (FastAPI backend, static HTML/ES-module frontend,
Supabase). Product spec: `Interior_Design_AI_PRD_EN.md`. How to run and test: `README.md`.
Project memory: `wiki/` (start at `wiki/index.md`).

Talk to the user in Hebrew. Code, UI text, docs and commit messages are in English.

## Workflow: every task, in this order

1. **Recall.** Read `wiki/index.md`, then the pages that bear on the task.
2. **Plan before doing.** Never start changing files without a plan. Use plan mode and get the plan
   approved. For a trivial edit, state the plan in a line or two first. The plan names the tests
   (step 5) and the subagents (step 3) it will use.
3. **Delegate specialist work to a subagent** (table below). The main session plans, coordinates,
   integrates and verifies; it does not do the specialist work itself.
4. **Implement**, tests first.
5. **Test after implementing. All three, every time:**
   - **End to end:** the browser journeys in `backend/tests/test_e2e.py`, extended to cover the change.
   - **Regression:** the full suites, not only the new tests: `cd backend && uv run pytest` and
     `cd frontend && npm test`. Everything that passed before must still pass.
   - **Edge cases:** new tests for the change's boundaries: empty, minimum and maximum values, invalid
     and malformed input, wrong role or wrong studio, repeated and concurrent requests.
   Report the real results. A failing or skipped test is reported as such, never hidden.
6. **Commit whenever a piece of code writing is finished.** Small commits on the feature's branch, format
   `<type>: <description>` (feat, fix, refactor, docs, test, chore, perf, ci). No attribution lines.
7. **Security review at every stage.** Run the `security-review` skill after each implementation
   step, once its commits exist locally and before anything is pushed: the skill reviews the
   branch's commits against `origin/main`, so it does not see uncommitted work. Review the plan
   itself when it touches auth, tenant isolation, secrets or user data. Fix critical and high
   findings before pushing; record the rest in `wiki/open-items.md`.
8. **Update the wiki** (rules below), commit it, and push the branch to GitHub. The task is not done
   until the wiki is pushed.

## Models

- **Planning: Opus 5.5** (`claude-opus-5-5`). **Execution: Sonnet 5.5** (`claude-sonnet-5-5`).
- Main session: `.claude/settings.json` sets `opusplan` (Opus in plan mode, Sonnet when executing).
- Subagents: always pass `model: "sonnet"` when spawning, even when the agent's own definition names
  another model. A planning subagent (`Plan`) gets `model: "opus"`.

## Branches

- `main` and `dev` live on GitHub. Every feature gets its own branch `feature/<name>` cut from `dev`,
  and is merged back into `dev` when its tests and security review pass.
- Nothing reaches `main` without the user's explicit instruction.

## Subagents

| Kind of work | Subagent |
|---|---|
| UX/UI: screens, layout, design system, accessibility | `ux-ui-designer` (design source: the Stitch project, see `wiki/design.md`) |
| Infrastructure: deployment, Railway, CI, environments | `general-purpose`, briefed to use the `use-railway` skill |
| Database: schema, migrations, RLS policies | `everything-claude-code:database-reviewer` |
| Security review | `everything-claude-code:security-reviewer` |
| Code review after writing code | `everything-claude-code:code-reviewer` (Python: `everything-claude-code:python-reviewer`) |
| E2E tests | `everything-claude-code:e2e-runner` |
| Website copy | `web-copywriter` |
| Anything else specialised | `general-purpose` with a narrow brief |

Independent subagents are launched together in one message. A subagent's report is checked against
the code and the tests before it is relied on.

## Project memory: `wiki/`

The project's memory lives in this repository and on GitHub, following Andrej Karpathy's LLM Wiki
pattern. It records everything done in the project. Project knowledge goes here, not in a local
memory folder.

**Three layers**

- **Raw sources** (read, never rewritten by the wiki process): the PRD, the code, the migrations,
  git history, the Stitch design project, review and test output.
- **The wiki** (`wiki/*.md`): written and maintained by Claude. One topic per page. Pages link to each
  other with relative Markdown links and cite their sources (file paths, commit hashes).
- **The schema**: this section.

**Two special files**

- `wiki/index.md`: the catalogue. Every page appears once, grouped by category, with a link and a
  one-line summary. Read it first; update it whenever a page is added, renamed or removed.
- `wiki/log.md`: append-only, chronological, newest at the bottom. One entry per completed action:

  ```
  ## [YYYY-MM-DD] <type> | <title>
  What was done, the result (tests, findings), the commit hash, the wiki pages updated.
  ```

  Types: `plan`, `build`, `test`, `security`, `design`, `infra`, `decision`, `docs`, `lint`.
  `grep "^## \[" wiki/log.md | tail -5` shows the latest entries.

**Three operations**

- **Ingest: after every completed action.** Append a log entry, update every page the action
  changed (create a page when a new topic appears), update `index.md`. Fix a page that became wrong
  instead of adding a contradicting note.
- **Query: before every task.** Read `index.md`, then the relevant pages, then the sources they
  cite. An answer worth keeping is filed back as a page.
- **Lint: at the end of every phase.** Look for contradictions, claims the code no longer supports,
  pages missing from the index, missing links, and open items that were resolved. Log it as `lint`.

The repository is public: the wiki never contains secrets, keys, project refs, passwords or personal
details.

## Hard rules

- Secrets live only in `backend/.env` and `frontend/js/config.js`, both git-ignored. Never commit,
  print or paste them.
- All writes go through the backend with the service key after validation; signed-in users have
  SELECT only. Every new table gets RLS and a tenant-isolation test (`wiki/architecture.md`).
- Work on a `feature/*` branch from `dev`. `main` moves only when the user asks.
- Destructive or irreversible actions (deleting data, force-push, changing production settings) need
  the user's explicit approval each time.

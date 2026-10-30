# Template Duplicate Implementation Plan

> **For agentic workers:** Execute in the explicitly delegated isolated clone; use test-driven development and have the coordinating agent independently review the branch. Steps use checkboxes for tracking.

**Goal:** Duplicate the selected prompt version into a separate, initially disabled `v1` template and expose the operation in the existing detail page.

**Architecture:** Validate and normalize the request once in Pydantic, check any version of the requested name in the service, and copy a deep-cloned payload through existing validation/variable parsing. The UI submits a separate detail-page dialog and navigates to the new ID; existing version creation remains separate.

**Tech Stack:** FastAPI, Pydantic 2, SQLAlchemy, SQLite for tests, React, TypeScript, Vite.

**Spec:** `docs/qa-dataset/template-duplicate/PRD.md`.

## Global Constraints

- Keep the selected source unchanged, new `v1` disabled, copy no logs or original creator; no AI API key.
- Name: Python strip then 1–100 Unicode code points; 422 invalid, 404 unknown source, 409 any existing version, 400 invalid source payload.
- Do not alter the database schema; note cross-version race rather than promising an unsupported guarantee.
- Use the specified branch and isolated SQLite. Do not stop other services or copy secrets.

## Review Focus

- Nested chat metadata must survive a copy and remain independent after edits: API integration test updates a nested copied message and checks source.
- A conflicting name with only v2 must fail: fixture v2, expect 409 and unchanged rows.
- Padded Unicode and names at/above 100 code points: test normalized boundary, blank and wrong types.
- Disabled clone must preview but not resolve as active until activation: API test both states.
- Existing editor is chat-only: browser-check editing copied text and ensure save does not change type.

---

### Task 1: API integration contract

**Files:** Create `tests/test_template_duplicate.py`; modify `backend/app/prompt/schemas.py`, `router.py`, `service.py`.

**Interfaces:** `POST /api/prompts/{template_id}/duplicate` with `{"name": str}` returns `PromptTemplateResponse`, status 201. Schema `PromptTemplateDuplicateRequest`; service `duplicate_template(template_id, request)`.

- [ ] Create isolated SQLite fixture and real TestClient requests. Assert successful selected chat and text copies, field/creator/state/variables, nested updates, preview, edit, activation, missing source, malformed/blank/long names, any-version conflict, repeated request and unchanged source/conflict rows.
- [ ] Run `python -m pytest -q tests/test_template_duplicate.py`; expect failures at the missing duplicate endpoint, not setup errors.
- [ ] Implement the schema, route and service with `deepcopy`, `_prepare_template_payload`, any-version query and existing integrity-error rollback.
- [ ] Run `python -m pytest -q`; expect all tests pass. Keep creation of same-name new version unchanged.

### Task 2: Detail action and editor

**Files:** Modify `frontend/src/api/promptApi.ts`, `frontend/src/pages/PromptDetailPage.tsx`, `frontend/src/pages/PromptEditorPage.tsx`, `frontend/src/i18n.tsx`, `frontend/src/styles.css`; update `README.md` for endpoint and behavior.

**Interfaces:** `promptApi.duplicatePrompt(id: number, name: string): Promise<PromptTemplate>`. Existing detail route is `/admin/prompts/{id}`.

- [ ] Add separate accessible dialog with editable suggested name, normalized validation matching backend, pending state, inline errors, cancel and success navigation. Preserve new-version action.
- [ ] Adapt editing of an existing text template so its text content and type survive saving; do not invoke AI.
- [ ] Run `npm ci` and `npm run build` in `frontend`; expect TypeScript and Vite build success.
- [ ] Use a real browser against isolated backend/frontend to exercise cancel, invalid input, conflict, success, preview and edit; document exact results and any uncovered behavior.

### Task 3: Durable handoff and verification

**Files:** Create `docs/qa-dataset/template-duplicate/DEVELOPMENT_MEMORY.md`, `HANDOFF.md`.

- [ ] Record actual test commands/counts, limitations and reproducible fixture/start instructions, base and specification commit IDs; do not claim QA approval.
- [ ] Run full backend test suite, frontend build and `git diff --check`; inspect exact diff and commit only authorized files.
- [ ] Provide coordinator branch, base/spec/head commits, result and unresolved risk for independent review and PR preparation.

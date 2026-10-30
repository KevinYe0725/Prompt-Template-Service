"""Real HTTP/SQLite contracts for duplicating one prompt version."""
from copy import deepcopy
from datetime import datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session

from backend.app.database import Base, get_db
from backend.app.main import app
from backend.app.prompt.models import PromptRenderLog, PromptTemplate


@pytest.fixture
def client_and_engine(tmp_path):
    engine = create_engine(
        f"sqlite:///{tmp_path / 'duplicate.sqlite3'}",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(engine)

    def override_db():
        with Session(engine) as db:
            yield db

    app.dependency_overrides[get_db] = override_db
    client = TestClient(app)
    try:
        yield client, engine
    finally:
        client.close()
        app.dependency_overrides.pop(get_db, None)
        engine.dispose()


def create_prompt(client, **overrides):
    payload = {
        "name": "source",
        "version": "v7",
        "scenario": "support",
        "task_type": "answer",
        "template_type": "chat",
        "content": "retained auxiliary content",
        "messages": [
            {
                "role": "system",
                "content": "Hello {{name}}",
                "metadata": {"tags": ["original", {"deep": "value"}]},
            },
            {"role": "user", "content": "Explain {{topic}} to {{name}}"},
        ],
        "output_format": "json",
        "enabled": True,
        "description": "source description",
        "created_by": "original-author",
    }
    payload.update(overrides)
    response = client.post("/api/prompts", json=payload)
    assert response.status_code == 201, response.text
    return response.json()


def test_chat_copy_is_inactive_independent_and_recomputes_variables(client_and_engine):
    client, engine = client_and_engine
    source = create_prompt(client)
    source_id = source["id"]
    # A stored variable cache can become stale; copying must parse the actual payload.
    with Session(engine) as db:
        row = db.get(PromptTemplate, source_id)
        row.variables = ["stale"]
        row.created_at = datetime(2020, 1, 1)
        row.updated_at = datetime(2020, 1, 1)
        db.commit()
    assert client.post(f"/api/prompts/{source_id}/preview", json={
        "variables": {"name": "Ada", "topic": "Python"}
    }).status_code == 200
    before = client.get(f"/api/prompts/{source_id}").json()

    response = client.post(f"/api/prompts/{source_id}/duplicate", json={"name": "  support-copy  "})
    assert response.status_code == 201, response.text
    clone = response.json()
    assert clone["id"] != source_id
    assert (clone["name"], clone["version"], clone["enabled"]) == ("support-copy", "v1", False)
    for field in ("scenario", "task_type", "template_type", "content", "messages", "output_format", "description"):
        assert clone[field] == before[field]
    assert clone["variables"] == ["name", "topic"]
    assert clone["created_by"] is None
    assert clone["created_at"] != before["created_at"]
    assert clone["updated_at"] != before["updated_at"]
    assert client.get(f"/api/prompts/{source_id}").json() == before
    with Session(engine) as db:
        assert db.scalar(select(func.count()).select_from(PromptRenderLog).where(PromptRenderLog.template_id == source_id)) == 1
        assert db.scalar(select(func.count()).select_from(PromptRenderLog).where(PromptRenderLog.template_id == clone["id"])) == 0

    preview = client.post(f"/api/prompts/{clone['id']}/preview", json={"variables": {"name": "Ada", "topic": "Python"}})
    assert preview.status_code == 200
    assert preview.json()["messages"][1]["content"] == "Explain Python to Ada"
    assert client.post("/api/prompts/render", json={"name": "support-copy", "variables": {"name": "Ada", "topic": "Python"}}).status_code == 404

    edited = deepcopy(clone["messages"])
    edited[0]["metadata"]["tags"][1]["deep"] = "changed"
    edited[0]["content"] = "Updated {{person}}"
    updated = client.put(f"/api/prompts/{clone['id']}", json={"messages": edited})
    assert updated.status_code == 200
    assert updated.json()["variables"] == ["person", "topic", "name"]
    assert client.get(f"/api/prompts/{source_id}").json() == before
    assert client.post(f"/api/prompts/{clone['id']}/activate").status_code == 200
    active = client.post("/api/prompts/render", json={"name": "support-copy", "variables": {"person": "Lin", "name": "Ada", "topic": "Python"}})
    assert active.status_code == 200
    assert active.json()["template_id"] == clone["id"]
    assert client.get(f"/api/prompts/{source_id}").json() == before


def test_text_copy_can_preview_and_edit_without_changing_source(client_and_engine):
    client, _ = client_and_engine
    source = create_prompt(client, template_type="text", content="Welcome {{person}}", messages=None, output_format="markdown")
    copied = client.post(f"/api/prompts/{source['id']}/duplicate", json={"name": "text-copy"})
    assert copied.status_code == 201, copied.text
    clone = copied.json()
    assert clone["template_type"] == "text"
    assert clone["content"] == "Welcome {{person}}"
    assert clone["messages"] is None
    assert clone["variables"] == ["person"]
    assert clone["enabled"] is False
    assert client.post(f"/api/prompts/{clone['id']}/preview", json={"variables": {"person": "Ada"}}).json()["content"] == "Welcome Ada"
    edited = client.put(f"/api/prompts/{clone['id']}", json={"template_type": "text", "content": "Hi {{other}}"})
    assert edited.status_code == 200
    assert edited.json()["variables"] == ["other"]
    assert client.get(f"/api/prompts/{source['id']}").json() == source


@pytest.mark.parametrize(
    "messages",
    [
        [{"role": "assistant", "content": "", "metadata": {"tag": "keep"}}],
        [{"role": "system", "content": ""}, {"role": "user", "content": ""}],
        [],
    ],
)
def test_copy_retains_valid_empty_and_missing_role_messages(client_and_engine, messages):
    client, _ = client_and_engine
    source = create_prompt(client, messages=messages)
    result = client.post(f"/api/prompts/{source['id']}/duplicate", json={"name": "empty-copy"})
    assert result.status_code == 201, result.text
    clone = result.json()
    assert clone["messages"] == messages
    updated = client.put(f"/api/prompts/{clone['id']}", json={"messages": messages})
    assert updated.status_code == 200, updated.text
    assert updated.json()["messages"] == messages
    assert client.get(f"/api/prompts/{source['id']}").json() == source


def test_name_conflicts_with_any_version_and_repeated_requests_have_no_side_effects(client_and_engine):
    client, _ = client_and_engine
    source = create_prompt(client)
    existing = create_prompt(client, name="taken", version="v9", enabled=True)
    before_list = client.get("/api/prompts").json()
    response = client.post(f"/api/prompts/{source['id']}/duplicate", json={"name": "  taken "})
    assert response.status_code == 409, response.text
    assert client.get("/api/prompts").json() == before_list
    assert client.get(f"/api/prompts/{existing['id']}").json() == existing
    assert client.get(f"/api/prompts/{source['id']}").json() == source
    first = client.post(f"/api/prompts/{source['id']}/duplicate", json={"name": "fresh"})
    assert first.status_code == 201
    again = client.post(f"/api/prompts/{source['id']}/duplicate", json={"name": "fresh"})
    assert again.status_code == 409
    assert client.get(f"/api/prompts/{first.json()['id']}").json() == first.json()
    assert len(client.get(f"/api/prompts/{first.json()['id']}/versions").json()) == 1


@pytest.mark.parametrize("body", [{}, {"name": None}, {"name": 123}, {"name": ""}, {"name": " \t\n"}, {"name": "x" * 101}, {"name": " " + "🐱" * 101 + " "}])
def test_invalid_name_returns_422_without_creation(client_and_engine, body):
    client, _ = client_and_engine
    source = create_prompt(client)
    result = client.post(f"/api/prompts/{source['id']}/duplicate", json=body)
    assert result.status_code == 422, result.text
    assert client.get("/api/prompts").json()["total"] == 1
    assert client.get(f"/api/prompts/{source['id']}").json() == source


def test_name_is_trimmed_before_unicode_length_validation(client_and_engine):
    client, _ = client_and_engine
    source = create_prompt(client)
    name = "🐱" * 100
    result = client.post(f"/api/prompts/{source['id']}/duplicate", json={"name": "\u001c" + name + "\u0085"})
    assert result.status_code == 201, result.text
    assert result.json()["name"] == name


def test_missing_source_is_404_without_creating_template(client_and_engine):
    client, _ = client_and_engine
    result = client.post("/api/prompts/9999/duplicate", json={"name": "new"})
    assert result.status_code == 404
    assert client.get("/api/prompts").json()["total"] == 0


def test_invalid_stored_source_payload_is_rejected_without_creation(client_and_engine):
    client, engine = client_and_engine
    source = create_prompt(client)
    with Session(engine) as db:
        db.get(PromptTemplate, source["id"]).messages = [{"role": "", "content": "invalid"}]
        db.commit()
    before = client.get(f"/api/prompts/{source['id']}").json()
    result = client.post(f"/api/prompts/{source['id']}/duplicate", json={"name": "invalid-copy"})
    assert result.status_code == 400, result.text
    assert client.get("/api/prompts").json()["total"] == 1
    assert client.get(f"/api/prompts/{source['id']}").json() == before


def test_existing_new_version_operation_remains_separate(client_and_engine):
    client, _ = client_and_engine
    source = create_prompt(client)
    result = client.post(f"/api/prompts/{source['id']}/versions", json={"version": "v8"})
    assert result.status_code == 201
    assert (result.json()["name"], result.json()["version"]) == ("source", "v8")
    assert client.get(f"/api/prompts/{source['id']}").json() == source

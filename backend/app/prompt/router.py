from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.app.ai_client import get_ai_client
from backend.app.ai_client.client import AIClientError
from backend.app.database import get_db
from backend.app.prompt.renderer import MissingVariablesError, UnresolvedVariablesError
from backend.app.prompt.schemas import (
    PromptActivateResponse,
    PromptDraftGenerateRequest,
    PromptDraftGenerateResponse,
    PromptPreviewRequest,
    PromptPreviewResponse,
    PromptRenderRequest,
    PromptRenderResponse,
    PromptTemplateCreateRequest,
    PromptTemplateListItem,
    PromptTemplateListResponse,
    PromptTemplateResponse,
    PromptTemplateUpdateRequest,
    PromptTemplateVersionCreateRequest,
    PromptTestRequest,
    PromptTestResponse,
    PromptTestVariablesGenerateRequest,
    PromptTestVariablesGenerateResponse,
)
from backend.app.prompt.service import (
    ActivePromptTemplateNotFoundError,
    DuplicatePromptTemplateError,
    PromptTemplateNotFoundError,
    PromptTemplateService,
    PromptTemplateValidationError,
)


router = APIRouter(prefix="/api/prompts", tags=["Prompt Templates"])


DbSession = Annotated[Session, Depends(get_db)]


def _service(db: DbSession) -> PromptTemplateService:
    return PromptTemplateService(db)


def _raise_prompt_error(exc: Exception) -> None:
    if isinstance(exc, MissingVariablesError):
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Missing required variables",
                "missing_variables": exc.missing_variables,
            },
        ) from exc
    if isinstance(exc, UnresolvedVariablesError):
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Rendered prompt still contains unresolved variables",
                "unresolved_variables": exc.unresolved_variables,
            },
        ) from exc
    if isinstance(exc, ActivePromptTemplateNotFoundError):
        raise HTTPException(status_code=404, detail="Active prompt template not found") from exc
    if isinstance(exc, PromptTemplateNotFoundError):
        raise HTTPException(status_code=404, detail="Prompt template not found") from exc
    if isinstance(exc, DuplicatePromptTemplateError):
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    if isinstance(exc, PromptTemplateValidationError):
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if isinstance(exc, AIClientError):
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    raise exc


@router.post("", response_model=PromptTemplateResponse, status_code=201)
def create_template(request: PromptTemplateCreateRequest, db: DbSession) -> PromptTemplateResponse:
    try:
        return _service(db).create_template(request)
    except Exception as exc:
        _raise_prompt_error(exc)
        raise


@router.get("", response_model=PromptTemplateListResponse)
def list_templates(
    db: DbSession,
    keyword: str | None = None,
    scenario: str | None = None,
    task_type: str | None = None,
    enabled: bool | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> PromptTemplateListResponse:
    return _service(db).list_templates(
        keyword=keyword,
        scenario=scenario,
        task_type=task_type,
        enabled=enabled,
        page=page,
        page_size=page_size,
    )


@router.post("/render", response_model=PromptRenderResponse)
def render_prompt(request: PromptRenderRequest, db: DbSession) -> PromptRenderResponse:
    try:
        return _service(db).render_by_name(
            name=request.name,
            version=request.version,
            variables=request.variables,
            request_id=request.request_id,
        )
    except Exception as exc:
        _raise_prompt_error(exc)
        raise


@router.post("/generate-draft", response_model=PromptDraftGenerateResponse)
async def generate_prompt_draft(
    request: PromptDraftGenerateRequest, db: DbSession
) -> PromptDraftGenerateResponse:
    try:
        return await _service(db).generate_template_draft_with_ai_client(
            request=request,
            ai_client=get_ai_client(),
        )
    except Exception as exc:
        _raise_prompt_error(exc)
        raise


@router.get("/{template_id}", response_model=PromptTemplateResponse)
def get_template(template_id: int, db: DbSession) -> PromptTemplateResponse:
    try:
        return _service(db).get_template(template_id)
    except Exception as exc:
        _raise_prompt_error(exc)
        raise


@router.put("/{template_id}", response_model=PromptTemplateResponse)
def update_template(
    template_id: int, request: PromptTemplateUpdateRequest, db: DbSession
) -> PromptTemplateResponse:
    try:
        return _service(db).update_template(template_id, request)
    except Exception as exc:
        _raise_prompt_error(exc)
        raise


@router.post("/{template_id}/versions", response_model=PromptTemplateResponse, status_code=201)
def create_template_version(
    template_id: int, request: PromptTemplateVersionCreateRequest, db: DbSession
) -> PromptTemplateResponse:
    try:
        return _service(db).create_new_version(template_id, request)
    except Exception as exc:
        _raise_prompt_error(exc)
        raise


@router.get("/{template_id}/versions", response_model=list[PromptTemplateListItem])
def list_template_versions(template_id: int, db: DbSession) -> list[PromptTemplateListItem]:
    try:
        return _service(db).list_versions(template_id)
    except Exception as exc:
        _raise_prompt_error(exc)
        raise


@router.post("/{template_id}/activate", response_model=PromptActivateResponse)
def activate_template(template_id: int, db: DbSession) -> PromptActivateResponse:
    try:
        template = _service(db).activate_template(template_id)
        return PromptActivateResponse(
            success=True,
            active_template_id=template.id,
            name=template.name,
            version=template.version,
        )
    except Exception as exc:
        _raise_prompt_error(exc)
        raise


@router.post("/{template_id}/preview", response_model=PromptPreviewResponse)
def preview_template(
    template_id: int, request: PromptPreviewRequest, db: DbSession
) -> PromptPreviewResponse:
    try:
        return _service(db).preview_by_id(
            template_id=template_id,
            variables=request.variables,
            request_id=request.request_id,
        )
    except Exception as exc:
        _raise_prompt_error(exc)
        raise


@router.post(
    "/{template_id}/generate-test-variables",
    response_model=PromptTestVariablesGenerateResponse,
)
async def generate_test_variables(
    template_id: int, request: PromptTestVariablesGenerateRequest, db: DbSession
) -> PromptTestVariablesGenerateResponse:
    try:
        return await _service(db).generate_test_variables_with_ai_client(
            template_id=template_id,
            request=request,
            ai_client=get_ai_client(),
        )
    except Exception as exc:
        _raise_prompt_error(exc)
        raise


@router.post("/{template_id}/test", response_model=PromptTestResponse)
async def test_template(
    template_id: int, request: PromptTestRequest, db: DbSession
) -> PromptTestResponse:
    try:
        return await _service(db).test_template_with_ai_client(
            template_id=template_id,
            variables=request.variables,
            ai_client=get_ai_client(),
            model=request.model,
            temperature=request.temperature,
            max_tokens=request.max_tokens,
            request_id=request.request_id,
        )
    except Exception as exc:
        _raise_prompt_error(exc)
        raise

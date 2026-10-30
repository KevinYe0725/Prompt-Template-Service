from __future__ import annotations

from copy import deepcopy
from typing import Any

from sqlalchemy import Select, func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.app.ai_client import OpenAICompatibleClient
from backend.app.ai_client.client import AIClientError
from backend.app.prompt.draft_generator import (
    PromptDraftParseError,
    build_prompt_draft_messages,
    parse_prompt_draft_response,
)
from backend.app.prompt.models import PromptRenderLog, PromptTemplate
from backend.app.prompt.renderer import render_messages, render_text
from backend.app.prompt.schemas import (
    PromptRenderResponse,
    PromptDraftGenerateRequest,
    PromptDraftGenerateResponse,
    PromptTestVariablesGenerateRequest,
    PromptTestVariablesGenerateResponse,
    PromptTemplateCreateRequest,
    PromptTemplateDuplicateRequest,
    PromptTemplateListItem,
    PromptTemplateListResponse,
    PromptTemplateResponse,
    PromptTemplateUpdateRequest,
    PromptTemplateVersionCreateRequest,
    PromptTestResponse,
)
from backend.app.prompt.test_variable_generator import (
    TestVariablesParseError,
    build_test_variables_messages,
    parse_test_variables_response,
)
from backend.app.prompt.variable_parser import (
    parse_variables_from_messages,
    parse_variables_from_text,
)


class PromptTemplateNotFoundError(LookupError):
    pass


class ActivePromptTemplateNotFoundError(LookupError):
    pass


class DuplicatePromptTemplateError(ValueError):
    pass


class PromptTemplateValidationError(ValueError):
    pass


MODEL_MAX_OUTPUT_TOKENS = {
    "deepseek-chat": 384000,
    "deepseek-reasoner": 384000,
    "deepseek-v4-flash": 384000,
    "deepseek-v4-pro": 384000,
}


def _validate_model_max_tokens(model: str, max_tokens: int) -> None:
    limit = MODEL_MAX_OUTPUT_TOKENS.get(model)
    if limit and max_tokens > limit:
        raise PromptTemplateValidationError(
            f"max_tokens exceeds the maximum output tokens for {model}: {limit}"
        )


def _validate_messages(messages: Any) -> list[dict[str, Any]]:
    if not isinstance(messages, list):
        raise PromptTemplateValidationError(
            "messages must be an array of objects with role and content"
        )

    normalized: list[dict[str, Any]] = []
    for index, item in enumerate(messages):
        if not isinstance(item, dict):
            raise PromptTemplateValidationError(
                f"messages[{index}] must be an object with role and content"
            )
        role = item.get("role")
        content = item.get("content")
        if not isinstance(role, str) or not role.strip():
            raise PromptTemplateValidationError(f"messages[{index}].role is required")
        if not isinstance(content, str):
            raise PromptTemplateValidationError(f"messages[{index}].content is required")
        normalized.append({**item, "role": role.strip(), "content": content})
    return normalized


def _prepare_template_payload(
    template_type: str,
    content: str | None,
    messages: Any | None,
) -> tuple[str | None, list[dict[str, Any]] | None, list[str]]:
    if template_type == "chat":
        normalized_messages = _validate_messages(messages)
        variables = parse_variables_from_messages(normalized_messages)
        return content, normalized_messages, variables

    if template_type == "text":
        if not isinstance(content, str) or not content:
            raise PromptTemplateValidationError("content is required for text templates")
        variables = parse_variables_from_text(content)
        return content, None, variables

    raise PromptTemplateValidationError("template_type must be text or chat")


def _to_template_response(template: PromptTemplate) -> PromptTemplateResponse:
    return PromptTemplateResponse.model_validate(
        {**template.__dict__, "variables": template.variables or []}
    )


def _to_list_item(
    template: PromptTemplate, versions_count: int = 1
) -> PromptTemplateListItem:
    return PromptTemplateListItem.model_validate(
        {
            **template.__dict__,
            "variables": template.variables or [],
            "versions_count": versions_count,
        }
    )


class PromptTemplateService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create_template(
        self, request: PromptTemplateCreateRequest
    ) -> PromptTemplateResponse:
        self._ensure_unique(request.name, request.version)
        content, messages, variables = _prepare_template_payload(
            request.template_type, request.content, request.messages
        )
        if request.enabled:
            self._disable_other_versions(request.name)

        template = PromptTemplate(
            name=request.name,
            version=request.version,
            scenario=request.scenario,
            task_type=request.task_type,
            template_type=request.template_type,
            content=content,
            messages=messages,
            variables=variables,
            output_format=request.output_format,
            enabled=request.enabled,
            description=request.description,
            created_by=request.created_by,
        )
        self.db.add(template)
        try:
            self.db.commit()
        except IntegrityError as exc:
            self.db.rollback()
            raise DuplicatePromptTemplateError(
                f"Prompt template {request.name}:{request.version} already exists"
            ) from exc
        self.db.refresh(template)
        return _to_template_response(template)

    def list_templates(
        self,
        keyword: str | None = None,
        scenario: str | None = None,
        task_type: str | None = None,
        enabled: bool | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> PromptTemplateListResponse:
        page = max(page, 1)
        page_size = min(max(page_size, 1), 100)

        query: Select[tuple[PromptTemplate]] = select(PromptTemplate)
        filters = []
        if keyword:
            like = f"%{keyword}%"
            filters.append(
                (PromptTemplate.name.ilike(like))
                | (PromptTemplate.description.ilike(like))
            )
        if scenario:
            filters.append(PromptTemplate.scenario == scenario)
        if task_type:
            filters.append(PromptTemplate.task_type == task_type)

        for condition in filters:
            query = query.where(condition)

        rows = self.db.scalars(
            query.order_by(
                PromptTemplate.name.asc(),
                PromptTemplate.updated_at.desc(),
                PromptTemplate.id.desc(),
            )
        ).all()

        grouped: dict[str, list[PromptTemplate]] = {}
        for template in rows:
            grouped.setdefault(template.name, []).append(template)

        grouped_items: list[tuple[PromptTemplate, int]] = []
        for versions in grouped.values():
            active_version = next((version for version in versions if version.enabled), None)
            representative = active_version or versions[0]
            has_active = active_version is not None
            if enabled is True and not has_active:
                continue
            if enabled is False and has_active:
                continue
            grouped_items.append((representative, len(versions)))

        grouped_items.sort(
            key=lambda item: (item[0].updated_at, item[0].id),
            reverse=True,
        )
        total = len(grouped_items)
        paged_items = grouped_items[(page - 1) * page_size : page * page_size]

        return PromptTemplateListResponse(
            items=[
                _to_list_item(template, versions_count=versions_count)
                for template, versions_count in paged_items
            ],
            total=total,
            page=page,
            page_size=page_size,
        )

    def get_template(self, template_id: int) -> PromptTemplateResponse:
        return _to_template_response(self._get_template_model(template_id))

    def duplicate_template(
        self, template_id: int, request: PromptTemplateDuplicateRequest
    ) -> PromptTemplateResponse:
        base = self._get_template_model(template_id)
        exists = self.db.scalar(
            select(PromptTemplate.id).where(PromptTemplate.name == request.name)
        )
        if exists:
            raise DuplicatePromptTemplateError(
                f"Prompt template name {request.name} already exists"
            )

        content, messages, variables = _prepare_template_payload(
            base.template_type, base.content, deepcopy(base.messages)
        )
        template = PromptTemplate(
            name=request.name,
            version="v1",
            scenario=base.scenario,
            task_type=base.task_type,
            template_type=base.template_type,
            content=content,
            messages=messages,
            variables=variables,
            output_format=base.output_format,
            enabled=False,
            description=base.description,
        )
        self.db.add(template)
        try:
            self.db.commit()
        except IntegrityError as exc:
            self.db.rollback()
            raise DuplicatePromptTemplateError(
                f"Prompt template name {request.name} already exists"
            ) from exc
        self.db.refresh(template)
        return _to_template_response(template)

    def update_template(
        self, template_id: int, request: PromptTemplateUpdateRequest
    ) -> PromptTemplateResponse:
        template = self._get_template_model(template_id)

        if request.scenario is not None:
            template.scenario = request.scenario
        if request.task_type is not None:
            template.task_type = request.task_type
        if request.description is not None:
            template.description = request.description
        if request.output_format is not None:
            template.output_format = request.output_format

        content_changed = "content" in request.model_fields_set
        messages_changed = "messages" in request.model_fields_set
        type_changed = request.template_type is not None
        if request.template_type is not None:
            template.template_type = request.template_type

        if content_changed:
            template.content = request.content
        if messages_changed:
            template.messages = request.messages

        if content_changed or messages_changed or type_changed:
            content, messages, variables = _prepare_template_payload(
                template.template_type, template.content, template.messages
            )
            template.content = content
            template.messages = messages
            template.variables = variables

        self.db.commit()
        self.db.refresh(template)
        return _to_template_response(template)

    def create_new_version(
        self, template_id: int, request: PromptTemplateVersionCreateRequest
    ) -> PromptTemplateResponse:
        base = self._get_template_model(template_id)
        self._ensure_unique(base.name, request.version)

        content = request.content if request.content is not None else base.content
        messages = request.messages if request.messages is not None else base.messages
        content, messages, variables = _prepare_template_payload(
            base.template_type, content, messages
        )
        if request.enabled:
            self._disable_other_versions(base.name)

        template = PromptTemplate(
            name=base.name,
            version=request.version,
            scenario=base.scenario,
            task_type=base.task_type,
            template_type=base.template_type,
            content=content,
            messages=messages,
            variables=variables,
            output_format=base.output_format,
            enabled=request.enabled,
            description=request.description or base.description,
            created_by=base.created_by,
        )
        self.db.add(template)
        try:
            self.db.commit()
        except IntegrityError as exc:
            self.db.rollback()
            raise DuplicatePromptTemplateError(
                f"Prompt template {base.name}:{request.version} already exists"
            ) from exc
        self.db.refresh(template)
        return _to_template_response(template)

    def list_versions(self, template_id: int) -> list[PromptTemplateListItem]:
        template = self._get_template_model(template_id)
        versions = self.db.scalars(
            select(PromptTemplate)
            .where(PromptTemplate.name == template.name)
            .order_by(PromptTemplate.created_at.desc(), PromptTemplate.id.desc())
        ).all()
        return [_to_list_item(version) for version in versions]

    def activate_template(self, template_id: int) -> PromptTemplate:
        template = self._get_template_model(template_id)
        self._disable_other_versions(template.name)
        template.enabled = True
        self.db.commit()
        self.db.refresh(template)
        return template

    def render_by_name(
        self,
        name: str,
        version: str,
        variables: dict[str, Any],
        request_id: str | None = None,
    ) -> PromptRenderResponse:
        template = self._find_template_by_name(name, version)
        return self._render_template(template, variables, request_id)

    def preview_by_id(
        self,
        template_id: int,
        variables: dict[str, Any],
        request_id: str | None = None,
    ) -> PromptRenderResponse:
        template = self._get_template_model(template_id)
        return self._render_template(template, variables, request_id)

    async def test_template_with_ai_client(
        self,
        template_id: int,
        variables: dict[str, Any],
        ai_client: OpenAICompatibleClient,
        model: str | None,
        temperature: float,
        max_tokens: int,
        request_id: str | None = None,
    ) -> PromptTestResponse:
        template = self._get_template_model(template_id)
        selected_model = model or ai_client.default_model
        _validate_model_max_tokens(selected_model, max_tokens)
        rendered = self._render_template(template, variables, request_id)
        if not rendered.messages:
            raise PromptTemplateValidationError("Only chat templates can be tested")

        try:
            ai_result = await ai_client.chat(
                messages=rendered.messages,
                model=selected_model,
                temperature=temperature,
                max_tokens=max_tokens,
            )
        except AIClientError:
            raise

        return PromptTestResponse(
            template_id=template.id,
            name=template.name,
            version=template.version,
            rendered_messages=rendered.messages,
            model=ai_result.model,
            ai_response=ai_result.content,
            latency_ms=ai_result.latency_ms,
        )

    async def generate_template_draft_with_ai_client(
        self,
        request: PromptDraftGenerateRequest,
        ai_client: OpenAICompatibleClient,
    ) -> PromptDraftGenerateResponse:
        selected_model = request.model or ai_client.default_model
        _validate_model_max_tokens(selected_model, request.max_tokens)
        messages = build_prompt_draft_messages(
            name=request.name,
            scenario=request.scenario,
            task_type=request.task_type,
            output_format=request.output_format,
            description=request.description,
            existing_system_prompt=request.existing_system_prompt,
            existing_user_prompt=request.existing_user_prompt,
            language=request.language,
        )
        ai_result = await ai_client.chat(
            messages=messages,
            model=selected_model,
            temperature=request.temperature,
            max_tokens=request.max_tokens,
        )
        try:
            system_prompt, user_prompt, variables = parse_prompt_draft_response(
                ai_result.content
            )
        except PromptDraftParseError as exc:
            raise PromptTemplateValidationError(str(exc)) from exc

        return PromptDraftGenerateResponse(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            variables=variables,
            model=ai_result.model,
            latency_ms=ai_result.latency_ms,
        )

    async def generate_test_variables_with_ai_client(
        self,
        template_id: int,
        request: PromptTestVariablesGenerateRequest,
        ai_client: OpenAICompatibleClient,
    ) -> PromptTestVariablesGenerateResponse:
        template = self._get_template_model(template_id)
        required_variables = template.variables or []
        if not required_variables:
            return PromptTestVariablesGenerateResponse(
                variables={},
                model=request.model or ai_client.default_model,
                latency_ms=0,
            )

        selected_model = request.model or ai_client.default_model
        _validate_model_max_tokens(selected_model, request.max_tokens)
        messages = build_test_variables_messages(
            template=template,
            language=request.language,
        )
        ai_result = await ai_client.chat(
            messages=messages,
            model=selected_model,
            temperature=request.temperature,
            max_tokens=request.max_tokens,
        )
        try:
            variables = parse_test_variables_response(
                ai_result.content,
                required_variables,
            )
        except TestVariablesParseError as exc:
            raise PromptTemplateValidationError(str(exc)) from exc

        return PromptTestVariablesGenerateResponse(
            variables=variables,
            model=ai_result.model,
            latency_ms=ai_result.latency_ms,
        )

    def _render_template(
        self,
        template: PromptTemplate,
        variables: dict[str, Any],
        request_id: str | None = None,
    ) -> PromptRenderResponse:
        rendered_content: str | None = None
        rendered_messages: list[dict[str, Any]] | None = None
        try:
            if template.template_type == "chat":
                rendered_messages = render_messages(template.messages or [], variables)
            elif template.template_type == "text":
                rendered_content = render_text(template.content or "", variables)
            else:
                raise PromptTemplateValidationError(
                    f"Unsupported template_type: {template.template_type}"
                )
        except Exception as exc:
            self._write_render_log(
                template=template,
                variables=variables,
                rendered_content=None,
                rendered_messages=None,
                success=False,
                error_message=str(exc),
                request_id=request_id,
            )
            raise

        self._write_render_log(
            template=template,
            variables=variables,
            rendered_content=rendered_content,
            rendered_messages=rendered_messages,
            success=True,
            error_message=None,
            request_id=request_id,
        )
        return PromptRenderResponse(
            template_id=template.id,
            name=template.name,
            version=template.version,
            template_type=template.template_type,
            content=rendered_content,
            messages=rendered_messages,
            variables=variables,
        )

    def _write_render_log(
        self,
        template: PromptTemplate,
        variables: dict[str, Any],
        rendered_content: str | None,
        rendered_messages: list[dict[str, Any]] | None,
        success: bool,
        error_message: str | None,
        request_id: str | None,
    ) -> None:
        log = PromptRenderLog(
            request_id=request_id,
            template_id=template.id,
            name=template.name,
            version=template.version,
            variables=variables,
            rendered_content=rendered_content,
            rendered_messages=rendered_messages,
            success=success,
            error_message=error_message,
        )
        self.db.add(log)
        self.db.commit()

    def _get_template_model(self, template_id: int) -> PromptTemplate:
        template = self.db.get(PromptTemplate, template_id)
        if not template:
            raise PromptTemplateNotFoundError("Prompt template not found")
        return template

    def _find_template_by_name(self, name: str, version: str) -> PromptTemplate:
        query = select(PromptTemplate).where(PromptTemplate.name == name)
        if version == "active":
            query = query.where(PromptTemplate.enabled.is_(True))
        else:
            query = query.where(PromptTemplate.version == version)
        template = self.db.scalar(query)
        if not template and version == "active":
            raise ActivePromptTemplateNotFoundError("Active prompt template not found")
        if not template:
            raise PromptTemplateNotFoundError("Prompt template not found")
        return template

    def _ensure_unique(self, name: str, version: str) -> None:
        exists = self.db.scalar(
            select(PromptTemplate.id).where(
                PromptTemplate.name == name, PromptTemplate.version == version
            )
        )
        if exists:
            raise DuplicatePromptTemplateError(
                f"Prompt template {name}:{version} already exists"
            )

    def _disable_other_versions(self, name: str) -> None:
        self.db.execute(
            update(PromptTemplate)
            .where(PromptTemplate.name == name)
            .values(enabled=False)
        )

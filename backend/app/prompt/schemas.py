from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


TemplateType = Literal["chat", "text"]
OutputFormat = Literal["text", "json", "markdown"]


class PromptMessage(BaseModel):
    role: str
    content: str


class PromptTemplateCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    version: str = Field(..., min_length=1, max_length=50)
    scenario: str = Field(..., min_length=1, max_length=100)
    task_type: str = Field(..., min_length=1, max_length=100)
    template_type: TemplateType = "chat"
    content: str | None = None
    messages: Any | None = None
    output_format: OutputFormat = "text"
    enabled: bool = False
    description: str | None = Field(default=None, max_length=500)
    created_by: str | None = Field(default=None, max_length=100)


class PromptTemplateUpdateRequest(BaseModel):
    scenario: str | None = Field(default=None, min_length=1, max_length=100)
    task_type: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=500)
    output_format: OutputFormat | None = None
    template_type: TemplateType | None = None
    content: str | None = None
    messages: Any | None = None


class PromptTemplateVersionCreateRequest(BaseModel):
    version: str = Field(..., min_length=1, max_length=50)
    content: str | None = None
    messages: Any | None = None
    description: str | None = Field(default=None, max_length=500)
    enabled: bool = False


class PromptTemplateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    version: str
    scenario: str
    task_type: str
    template_type: str
    content: str | None
    messages: list[dict[str, Any]] | None
    variables: list[str]
    output_format: str
    enabled: bool
    description: str | None
    created_by: str | None
    created_at: datetime
    updated_at: datetime


class PromptTemplateListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    version: str
    scenario: str
    task_type: str
    template_type: str
    variables: list[str]
    output_format: str
    enabled: bool
    description: str | None
    updated_at: datetime
    versions_count: int = 1


class PromptTemplateListResponse(BaseModel):
    items: list[PromptTemplateListItem]
    total: int
    page: int
    page_size: int


class PromptRenderRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    version: str = Field(default="active", min_length=1, max_length=50)
    variables: dict[str, Any] = Field(default_factory=dict)
    request_id: str | None = Field(default=None, max_length=100)


class PromptRenderResponse(BaseModel):
    template_id: int
    name: str
    version: str
    template_type: str
    content: str | None = None
    messages: list[dict[str, Any]] | None = None
    variables: dict[str, Any]


class PromptPreviewRequest(BaseModel):
    variables: dict[str, Any] = Field(default_factory=dict)
    request_id: str | None = Field(default=None, max_length=100)


class PromptPreviewResponse(PromptRenderResponse):
    pass


class PromptActivateResponse(BaseModel):
    success: bool
    active_template_id: int
    name: str
    version: str


class PromptTestRequest(BaseModel):
    variables: dict[str, Any] = Field(default_factory=dict)
    model: str | None = Field(default=None, max_length=100)
    temperature: float = Field(default=0.7, ge=0, le=2)
    max_tokens: int = Field(default=1200, ge=1, le=384000)
    request_id: str | None = Field(default=None, max_length=100)


class PromptTestResponse(BaseModel):
    template_id: int
    name: str
    version: str
    rendered_messages: list[dict[str, Any]]
    model: str
    ai_response: str
    latency_ms: int


class PromptDraftGenerateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    scenario: str = Field(..., min_length=1, max_length=100)
    task_type: str = Field(..., min_length=1, max_length=100)
    output_format: OutputFormat = "json"
    description: str | None = Field(default=None, max_length=500)
    existing_system_prompt: str | None = None
    existing_user_prompt: str | None = None
    language: Literal["zh", "en"] = "zh"
    model: str | None = Field(default=None, max_length=100)
    temperature: float = Field(default=0.4, ge=0, le=2)
    max_tokens: int = Field(default=1800, ge=1, le=12000)


class PromptDraftGenerateResponse(BaseModel):
    system_prompt: str
    user_prompt: str
    variables: list[str]
    model: str
    latency_ms: int


class PromptTestVariablesGenerateRequest(BaseModel):
    language: Literal["zh", "en"] = "zh"
    model: str | None = Field(default=None, max_length=100)
    temperature: float = Field(default=0.5, ge=0, le=2)
    max_tokens: int = Field(default=1800, ge=1, le=12000)


class PromptTestVariablesGenerateResponse(BaseModel):
    variables: dict[str, Any]
    model: str
    latency_ms: int

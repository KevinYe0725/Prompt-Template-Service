from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.database import Base


ID_TYPE = BigInteger().with_variant(Integer, "sqlite")


class PromptTemplate(Base):
    __tablename__ = "prompt_template"
    __table_args__ = (
        UniqueConstraint("name", "version", name="uk_prompt_name_version"),
        Index("idx_prompt_name_enabled", "name", "enabled"),
        Index("idx_prompt_scenario_task", "scenario", "task_type"),
        Index("idx_prompt_created_at", "created_at"),
    )

    id: Mapped[int] = mapped_column(ID_TYPE, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    version: Mapped[str] = mapped_column(String(50), nullable=False)
    scenario: Mapped[str] = mapped_column(String(100), nullable=False)
    task_type: Mapped[str] = mapped_column(String(100), nullable=False)
    template_type: Mapped[str] = mapped_column(String(50), nullable=False, default="chat")
    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    messages: Mapped[list[dict[str, Any]] | None] = mapped_column(JSON, nullable=True)
    variables: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    output_format: Mapped[str] = mapped_column(String(50), nullable=False, default="text")
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_by: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    render_logs: Mapped[list["PromptRenderLog"]] = relationship(
        back_populates="template", cascade="all, delete-orphan"
    )


class PromptRenderLog(Base):
    __tablename__ = "prompt_render_log"
    __table_args__ = (
        Index("idx_render_request_id", "request_id"),
        Index("idx_render_template", "name", "version"),
        Index("idx_render_created_at", "created_at"),
    )

    id: Mapped[int] = mapped_column(ID_TYPE, primary_key=True, autoincrement=True)
    request_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    template_id: Mapped[int] = mapped_column(
        ID_TYPE, ForeignKey("prompt_template.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    version: Mapped[str] = mapped_column(String(50), nullable=False)
    variables: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    rendered_content: Mapped[str | None] = mapped_column(Text, nullable=True)
    rendered_messages: Mapped[list[dict[str, Any]] | None] = mapped_column(
        JSON, nullable=True
    )
    success: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )

    template: Mapped[PromptTemplate] = relationship(back_populates="render_logs")


from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Any

import httpx

from backend.app.config import get_settings


class AIClientError(RuntimeError):
    pass


class AIClientConfigError(AIClientError):
    pass


@dataclass
class AIChatResult:
    content: str
    model: str
    latency_ms: int
    raw_response: dict[str, Any]


class OpenAICompatibleClient:
    """Minimal OpenAI-compatible chat client used by prompt playground tests."""

    def __init__(
        self,
        base_url: str,
        api_key: str | None,
        default_model: str,
        timeout_seconds: float = 60,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.default_model = default_model
        self.timeout_seconds = timeout_seconds

    async def chat(
        self,
        messages: list[dict[str, Any]],
        model: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 1200,
    ) -> AIChatResult:
        if not self.api_key:
            raise AIClientConfigError("AI_API_KEY is not configured")

        selected_model = model or self.default_model
        payload = {
            "model": selected_model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        start = time.perf_counter()
        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                response = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers=headers,
                    json=payload,
                )
                response.raise_for_status()
        except httpx.TimeoutException as exc:
            raise AIClientError(
                "AI provider request timed out after "
                f"{self.timeout_seconds:g} seconds. Reduce max_tokens, use a faster model, "
                "or increase AI_REQUEST_TIMEOUT_SECONDS."
            ) from exc
        except httpx.HTTPStatusError as exc:
            body = exc.response.text[:1000]
            raise AIClientError(
                f"AI provider returned HTTP {exc.response.status_code}: {body}"
            ) from exc
        except httpx.HTTPError as exc:
            raise AIClientError(f"AI provider request failed: {exc}") from exc

        latency_ms = int((time.perf_counter() - start) * 1000)
        data = response.json()
        try:
            content = data["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as exc:
            raise AIClientError("AI provider returned an unexpected response shape") from exc

        return AIChatResult(
            content=content,
            model=selected_model,
            latency_ms=latency_ms,
            raw_response=data,
        )


def get_ai_client() -> OpenAICompatibleClient:
    settings = get_settings()
    return OpenAICompatibleClient(
        base_url=settings.ai_base_url,
        api_key=settings.ai_api_key,
        default_model=settings.default_ai_model,
        timeout_seconds=settings.ai_request_timeout_seconds,
    )

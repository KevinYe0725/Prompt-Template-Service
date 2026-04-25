from __future__ import annotations

import re
from typing import Any


VARIABLE_PATTERN = re.compile(r"\{\{\s*([A-Za-z0-9_]+)\s*\}\}")


def _dedupe_in_order(values: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        if value not in seen:
            seen.add(value)
            result.append(value)
    return result


def parse_variables_from_text(text: str | None) -> list[str]:
    if not text:
        return []
    return _dedupe_in_order(VARIABLE_PATTERN.findall(text))


def parse_variables_from_messages(messages: list[dict[str, Any]] | None) -> list[str]:
    if not messages:
        return []

    variables: list[str] = []
    for message in messages:
        content = message.get("content") if isinstance(message, dict) else None
        if isinstance(content, str):
            variables.extend(parse_variables_from_text(content))
    return _dedupe_in_order(variables)


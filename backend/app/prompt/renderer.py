from __future__ import annotations

import json
import re
from typing import Any

from backend.app.prompt.variable_parser import (
    VARIABLE_PATTERN,
    parse_variables_from_messages,
    parse_variables_from_text,
)


class PromptRenderError(ValueError):
    pass


class MissingVariablesError(PromptRenderError):
    def __init__(self, missing_variables: list[str]) -> None:
        self.missing_variables = missing_variables
        super().__init__("Missing required variables")


class UnresolvedVariablesError(PromptRenderError):
    def __init__(self, unresolved_variables: list[str]) -> None:
        self.unresolved_variables = unresolved_variables
        super().__init__("Rendered prompt still contains unresolved variables")


def _stringify_value(value: Any) -> str:
    if isinstance(value, str):
        return value
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False)
    return str(value)


def _validate_required_variables(required: list[str], variables: dict[str, Any]) -> None:
    missing = [
        variable
        for variable in required
        if variable not in variables or variables[variable] is None
    ]
    if missing:
        raise MissingVariablesError(missing)


def render_text(template: str, variables: dict[str, Any]) -> str:
    required = parse_variables_from_text(template)
    _validate_required_variables(required, variables)

    def replace(match: re.Match[str]) -> str:
        variable_name = match.group(1)
        return _stringify_value(variables[variable_name])

    rendered = VARIABLE_PATTERN.sub(replace, template)
    unresolved = parse_variables_from_text(rendered)
    if unresolved:
        raise UnresolvedVariablesError(unresolved)
    return rendered


def render_messages(
    messages: list[dict[str, Any]], variables: dict[str, Any]
) -> list[dict[str, Any]]:
    required = parse_variables_from_messages(messages)
    _validate_required_variables(required, variables)

    rendered_messages: list[dict[str, Any]] = []
    unresolved: list[str] = []
    for message in messages:
        rendered = dict(message)
        rendered["content"] = render_text(str(message["content"]), variables)
        unresolved.extend(parse_variables_from_text(rendered["content"]))
        rendered_messages.append(rendered)

    if unresolved:
        deduped = list(dict.fromkeys(unresolved))
        raise UnresolvedVariablesError(deduped)
    return rendered_messages

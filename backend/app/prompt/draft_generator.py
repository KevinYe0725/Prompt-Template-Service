from __future__ import annotations

import json
import re
from typing import Any

from backend.app.prompt.variable_parser import parse_variables_from_messages


class PromptDraftParseError(ValueError):
    pass


def build_prompt_draft_messages(
    *,
    name: str,
    scenario: str,
    task_type: str,
    output_format: str,
    description: str | None,
    existing_system_prompt: str | None,
    existing_user_prompt: str | None,
    language: str,
) -> list[dict[str, str]]:
    output_language = "中文" if language == "zh" else "English"
    return [
        {
            "role": "system",
            "content": (
                "你是一名资深 Prompt Engineer，擅长为 OpenAI-compatible chat messages "
                "设计可维护、可版本化、可调试的 system prompt 和 user prompt 模板。"
            ),
        },
        {
            "role": "user",
            "content": (
                f"请根据下面的模板元信息，生成一个 chat 类型 Prompt 模板草稿。\n\n"
                f"模板名称：{name}\n"
                f"业务场景：{scenario}\n"
                f"任务类型：{task_type}\n"
                f"期望输出格式：{output_format}\n"
                f"模板描述：{description or '未填写'}\n"
                f"现有 system prompt 草稿：{existing_system_prompt or '无'}\n"
                f"现有 user prompt 草稿：{existing_user_prompt or '无'}\n\n"
                f"要求：\n"
                f"1. 使用{output_language}生成内容。\n"
                f"2. system_prompt 要定义模型角色、能力边界、输出纪律和质量标准。\n"
                f"3. user_prompt 要包含清晰任务、输入信息占位符和输出要求。\n"
                f"4. 变量占位符必须使用 {{{{variable_name}}}} 格式，变量名只能包含字母、数字和下划线。\n"
                f"5. 不要使用真实 API Key、真实个人隐私或硬编码业务数据。\n"
                f"6. 如果 output_format=json，必须要求模型只输出合法 JSON，不添加额外解释。\n"
                f"7. 输出必须是合法 JSON 对象，不要包裹 Markdown 代码块。\n\n"
                f"JSON 结构必须为：\n"
                f"{{\n"
                f'  "system_prompt": "...",\n'
                f'  "user_prompt": "..."\n'
                f"}}"
            ),
        },
    ]


def parse_prompt_draft_response(content: str) -> tuple[str, str, list[str]]:
    data = _parse_json_object(content)
    system_prompt = data.get("system_prompt")
    user_prompt = data.get("user_prompt")
    if not isinstance(system_prompt, str) or not system_prompt.strip():
        raise PromptDraftParseError("AI response is missing system_prompt")
    if not isinstance(user_prompt, str) or not user_prompt.strip():
        raise PromptDraftParseError("AI response is missing user_prompt")

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]
    variables = parse_variables_from_messages(messages)
    return system_prompt, user_prompt, variables


def _parse_json_object(content: str) -> dict[str, Any]:
    stripped = content.strip()
    if stripped.startswith("```"):
        stripped = re.sub(r"^```(?:json)?\s*", "", stripped)
        stripped = re.sub(r"\s*```$", "", stripped)

    try:
        data = json.loads(stripped)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", stripped, flags=re.DOTALL)
        if not match:
            raise PromptDraftParseError("AI response is not valid JSON") from None
        try:
            data = json.loads(match.group(0))
        except json.JSONDecodeError as exc:
            raise PromptDraftParseError("AI response is not valid JSON") from exc

    if not isinstance(data, dict):
        raise PromptDraftParseError("AI response must be a JSON object")
    return data


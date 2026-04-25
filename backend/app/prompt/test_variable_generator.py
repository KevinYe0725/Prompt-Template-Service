from __future__ import annotations

import json
import re
from typing import Any

from backend.app.prompt.models import PromptTemplate


class TestVariablesParseError(ValueError):
    pass


def build_test_variables_messages(
    *,
    template: PromptTemplate,
    language: str,
) -> list[dict[str, str]]:
    output_language = "中文" if language == "zh" else "English"
    messages_preview = json.dumps(template.messages or [], ensure_ascii=False, indent=2)
    variables = template.variables or []
    return [
        {
            "role": "system",
            "content": (
                "你是一名 AI Prompt 测试数据生成专家。你擅长根据 Prompt 模板的业务场景、"
                "任务类型、变量列表和消息模板，生成真实、完整、可直接用于测试的变量 JSON。"
            ),
        },
        {
            "role": "user",
            "content": (
                f"请为下面这个 Prompt 模板生成一份测试变量 JSON。\n\n"
                f"模板名称：{template.name}\n"
                f"版本：{template.version}\n"
                f"业务场景：{template.scenario}\n"
                f"任务类型：{template.task_type}\n"
                f"输出格式：{template.output_format}\n"
                f"模板描述：{template.description or '无'}\n"
                f"变量列表：{json.dumps(variables, ensure_ascii=False)}\n"
                f"messages 模板：\n{messages_preview}\n\n"
                f"要求：\n"
                f"1. 只输出合法 JSON 对象，不要 Markdown 代码块，不要额外解释。\n"
                f"2. JSON 对象必须包含变量列表中的每一个 key，不能缺少，不能新增无关 key。\n"
                f"3. 值要符合当前业务场景，尽量真实、具体、足够触发模板逻辑。\n"
                f"4. 如果变量名明显表示数量，例如 count、num、limit，可以使用数字。\n"
                f"5. 如果变量名表示简历、岗位要求、评分标准、问题、回答等，请生成较完整的测试文本。\n"
                f"6. 不要使用真实个人隐私、真实手机号、真实邮箱、真实 API Key。\n"
                f"7. 文本内容使用{output_language}。\n\n"
                f"返回 JSON 示例形状：\n"
                f"{{\n"
                f'  "variable_name": "test value"\n'
                f"}}"
            ),
        },
    ]


def parse_test_variables_response(
    content: str, required_variables: list[str]
) -> dict[str, Any]:
    data = _parse_json_object(content)
    missing = [variable for variable in required_variables if variable not in data]
    if missing:
        raise TestVariablesParseError(
            "AI response is missing variables: " + ", ".join(missing)
        )
    return {variable: data[variable] for variable in required_variables}


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
            raise TestVariablesParseError("AI response is not valid JSON") from None
        try:
            data = json.loads(match.group(0))
        except json.JSONDecodeError as exc:
            raise TestVariablesParseError("AI response is not valid JSON") from exc

    if not isinstance(data, dict):
        raise TestVariablesParseError("AI response must be a JSON object")
    return data


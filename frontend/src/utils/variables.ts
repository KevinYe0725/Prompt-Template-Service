import type { PromptMessage } from "../types/prompt";

const VARIABLE_PATTERN = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;

export function parseVariablesFromText(text: string): string[] {
  const variables: string[] = [];
  for (const match of text.matchAll(VARIABLE_PATTERN)) {
    const value = match[1];
    if (!variables.includes(value)) {
      variables.push(value);
    }
  }
  return variables;
}

export function parseVariablesFromMessages(messages: PromptMessage[]): string[] {
  const variables: string[] = [];
  messages.forEach((message) => {
    parseVariablesFromText(message.content).forEach((variable) => {
      if (!variables.includes(variable)) {
        variables.push(variable);
      }
    });
  });
  return variables;
}

export function buildVariablesJson(variables: string[]): string {
  const value = variables.reduce<Record<string, string>>((acc, variable) => {
    acc[variable] = "";
    return acc;
  }, {});
  return JSON.stringify(value, null, 2);
}

export type JsonParseErrorCode = "object" | "syntax";

export function safeJsonParse(text: string): {
  value?: Record<string, unknown>;
  error?: JsonParseErrorCode;
} {
  try {
    const value = JSON.parse(text);
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return { error: "object" };
    }
    return { value: value as Record<string, unknown> };
  } catch {
    return { error: "syntax" };
  }
}

import type { PromptMessage } from "../types/prompt";

// The editor exposes only the first system/user message; retain all other data.
export function mergeEditableMessages(
  source: PromptMessage[], systemContent: string, userContent: string
): PromptMessage[] {
  let hasSystem = false;
  let hasUser = false;
  const result = source.map((message) => {
    if (message.role === "system" && !hasSystem) {
      hasSystem = true;
      return { ...message, content: systemContent };
    }
    if (message.role === "user" && !hasUser) {
      hasUser = true;
      return { ...message, content: userContent };
    }
    return message;
  });
  if (!hasSystem) result.unshift({ role: "system", content: systemContent });
  if (!hasUser) result.push({ role: "user", content: userContent });
  return result;
}

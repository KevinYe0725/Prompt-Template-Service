import assert from "node:assert/strict";
import test from "node:test";
import { mergeEditableMessages } from "../.test-build/utils/editableMessages.js";

test("editing changes only the first system/user text and preserves other messages and nested fields", () => {
  const source = [
    { role: "system", content: "old system", metadata: { nested: ["keep", { key: "value" }] } },
    { role: "assistant", content: "retain assistant", tool_call: { id: "t1" } },
    { role: "user", content: "old user", extra: { locale: "zh" } },
    { role: "system", content: "keep second system" }
  ];
  const before = structuredClone(source);
  assert.deepEqual(mergeEditableMessages(source, "edited system", "edited user"), [
    { role: "system", content: "edited system", metadata: { nested: ["keep", { key: "value" }] } },
    { role: "assistant", content: "retain assistant", tool_call: { id: "t1" } },
    { role: "user", content: "edited user", extra: { locale: "zh" } },
    { role: "system", content: "keep second system" }
  ]);
  assert.deepEqual(source, before);
});

test("editing a chat lacking system and user retains its existing messages", () => {
  const source = [{ role: "assistant", content: "prior answer", nested: { retained: true } }];
  assert.deepEqual(mergeEditableMessages(source, "instructions", "question"), [
    { role: "system", content: "instructions" },
    { role: "assistant", content: "prior answer", nested: { retained: true } },
    { role: "user", content: "question" }
  ]);
});

test("empty inputs leave absent system and user roles absent", () => {
  const source = [{ role: "assistant", content: "", metadata: { value: "keep" } }];
  assert.deepEqual(mergeEditableMessages(source, "", ""), source);
});

test("existing empty messages remain present without inventing missing roles", () => {
  const source = [{ role: "user", content: "", metadata: { tag: "empty" } }];
  assert.deepEqual(mergeEditableMessages(source, "", ""), source);
});

test("an empty message list stays empty until a role receives content", () => {
  assert.deepEqual(mergeEditableMessages([], "", ""), []);
});

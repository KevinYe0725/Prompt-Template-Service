import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { createServer as createNetServer } from "node:net";
import { after, before, test as nodeTest } from "node:test";
import { chromium } from "playwright-core";
import { createServer } from "vite";

let vite;
let browser;
let baseUrl;

function test(name, run) {
  return nodeTest(name, { timeout: 15000 }, run);
}

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

function template(id, overrides = {}) {
  return {
    id, name: "shared", version: `v${id}`, scenario: "support", task_type: "reply",
    template_type: "chat", content: null,
    messages: [{ role: "system", content: `content for ${id}` }, { role: "user", content: "question" }],
    variables: [], output_format: "text", enabled: false, description: null, created_by: null,
    created_at: "2026-10-30T00:00:00", updated_at: "2026-10-30T00:00:00", ...overrides
  };
}

function respond(route, body, status = 200) {
  return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

async function makePage(t, handler) {
  const context = await browser.newContext();
  t.after(() => context.close());
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  await page.addInitScript(() => localStorage.setItem("prompt-studio-language", "en"));
  await page.route("**/api/prompts**", handler);
  page.on("dialog", (dialog) => dialog.accept());
  return page;
}

async function changeRoute(page, path) {
  await page.evaluate((url) => {
    window.history.pushState({}, "", url);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, path);
}

before(async () => {
  const candidates = [
    process.env.PROMPT_TEST_CHROMIUM_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser",
    chromium.executablePath()
  ].filter(Boolean);
  const executablePath = candidates.find(existsSync);
  if (!executablePath) throw new Error("Chrome/Chromium required: set PROMPT_TEST_CHROMIUM_PATH");
  const reservation = createNetServer();
  await new Promise((resolve, reject) => {
    reservation.once("error", reject);
    reservation.listen(0, "127.0.0.1", resolve);
  });
  const port = reservation.address().port;
  await new Promise((resolve, reject) => reservation.close((error) => error ? reject(error) : resolve()));
  vite = await createServer({ server: { host: "127.0.0.1", port, strictPort: true } });
  await vite.listen();
  const address = vite.httpServer.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({ executablePath, headless: true });
});

after(async () => {
  if (browser) await browser.close();
  if (vite) await vite.close();
});

for (const [title, messages] of [
  ["missing system/user", [{ role: "assistant", content: "", metadata: { keep: [1, 2] } }]],
  ["existing empty system/user", [{ role: "system", content: "", metadata: { keep: true } }, { role: "user", content: "" }]],
  ["an empty message list", []]
]) {
  test(`editor saves ${title} unchanged`, async (t) => {
    const original = template(11, { messages });
    const puts = [];
    const page = await makePage(t, async (route) => {
      const req = route.request();
      const url = new URL(req.url());
      if (req.method() === "PUT") {
        puts.push(req.postDataJSON());
        return respond(route, { ...original, ...puts.at(-1) });
      }
      if (url.pathname.endsWith("/versions")) return respond(route, [{ ...original, versions_count: 1 }]);
      return respond(route, original);
    });
    await page.goto(`${baseUrl}/admin/prompts/11/edit`);
    await page.getByRole("heading", { name: "shared", exact: true }).waitFor();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await page.waitForURL("**/admin/prompts/11");
    assert.equal(puts.length, 1, "valid empty message fields must not block saving");
    assert.equal(puts[0].template_type, "chat");
    assert.deepEqual(puts[0].messages, messages);
  });
}

test("editor adds a missing role only when its input has content", async (t) => {
  const original = template(11, { messages: [{ role: "assistant", content: "keep" }] });
  const puts = [];
  const page = await makePage(t, async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    if (req.method() === "PUT") { puts.push(req.postDataJSON()); return respond(route, { ...original, ...puts.at(-1) }); }
    if (path.endsWith("/versions")) return respond(route, [{ ...original, versions_count: 1 }]);
    return respond(route, original);
  });
  await page.goto(`${baseUrl}/admin/prompts/11/edit`);
  await page.getByRole("heading", { name: "shared", exact: true }).waitFor();
  await page.getByLabel(/System prompt/).fill("new instructions");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.waitForURL("**/admin/prompts/11");
  assert.deepEqual(puts[0].messages, [
    { role: "system", content: "new instructions" },
    { role: "assistant", content: "keep" }
  ]);
});

test("create and new-version flows still require system and user input", async (t) => {
  const base = template(101);
  let posts = 0;
  const page = await makePage(t, async (route) => {
    if (route.request().method() === "POST") { posts += 1; return respond(route, base, 201); }
    return respond(route, base);
  });
  await page.goto(`${baseUrl}/admin/prompts/new`);
  await page.getByLabel("Name", { exact: true }).fill("new-name");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  assert.equal(await page.getByLabel("System prompt", { exact: true }).evaluate((node) => node.validity.valueMissing), true);
  assert.equal(posts, 0);

  await page.goto(`${baseUrl}/admin/prompts/101/edit?newVersion=1`);
  await page.getByRole("heading", { name: "shared", exact: true }).waitFor();
  await page.getByLabel("Version", { exact: true }).fill("v200");
  await page.getByLabel(/System prompt/).fill("");
  await page.getByLabel(/User prompt/).fill("");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  assert.equal(await page.getByLabel("System prompt", { exact: true }).evaluate((node) => node.validity.valueMissing), true);
  assert.equal(posts, 0);
});

test("detail ignores late old-version reload and duplicates the version shown", async (t) => {
  const old = template(101);
  const selected = template(102);
  const gate = deferred();
  const oldReloadStarted = deferred();
  const oldReloadDelivered = deferred();
  let deliveredCount = 0;
  let holdOld = false;
  let duplicatePath = null;
  t.after(() => gate.resolve());
  const page = await makePage(t, async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    if (path === "/api/prompts/101/activate") return respond(route, { success: true, active_template_id: 101, name: "shared", version: old.version });
    if (path === "/api/prompts/102/duplicate") {
      duplicatePath = path;
      return respond(route, template(103, { name: "fresh-copy", version: "v1" }), 201);
    }
    if (path.startsWith("/api/prompts/101") && holdOld) {
      oldReloadStarted.resolve();
      await gate.promise;
      if (path.endsWith("/versions")) await respond(route, [{ ...selected, versions_count: 2 }, { ...old, versions_count: 2 }]);
      else await respond(route, old);
      deliveredCount += 1;
      if (deliveredCount === 2) oldReloadDelivered.resolve();
      return;
    }
    if (path.endsWith("/versions")) return respond(route, [{ ...selected, versions_count: 2 }, { ...old, versions_count: 2 }]);
    if (path.endsWith("/101")) return respond(route, old);
    if (path.endsWith("/102")) return respond(route, selected);
    if (path.endsWith("/103")) return respond(route, template(103, { name: "fresh-copy", version: "v1" }));
    return respond(route, { detail: "unknown" }, 404);
  });
  await page.goto(`${baseUrl}/admin/prompts/101`);
  await page.getByText("content for 101", { exact: true }).waitFor();
  holdOld = true;
  await page.getByRole("button", { name: "Activate Version", exact: true }).click();
  await oldReloadStarted.promise;
  await changeRoute(page, "/admin/prompts/102");
  await page.getByText("content for 102", { exact: true }).waitFor();
  gate.resolve();
  await oldReloadDelivered.promise;
  await page.waitForTimeout(50);
  assert.equal(await page.getByText("content for 102", { exact: true }).count(), 1, "late old response must not replace the selected version");
  assert.equal(await page.getByText("content for 101", { exact: true }).count(), 0);
  await page.getByRole("button", { name: "Duplicate as New Template" }).click();
  await page.getByLabel("Name", { exact: true }).fill("fresh-copy");
  await page.getByRole("button", { name: "Duplicate Template", exact: true }).click();
  await page.waitForURL("**/admin/prompts/103");
  assert.equal(duplicatePath, "/api/prompts/102/duplicate");
});

test("activating another version loads that version without reloading the old id", async (t) => {
  const old = template(101, { enabled: true });
  const selected = template(102);
  let oldDetailRequests = 0;
  let duplicatePath = null;
  const page = await makePage(t, async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    if (path === "/api/prompts/102/activate") return respond(route, { success: true, active_template_id: 102, name: "shared", version: selected.version });
    if (path === "/api/prompts/102/duplicate") { duplicatePath = path; return respond(route, template(103, { name: "version-copy", version: "v1" }), 201); }
    if (path.endsWith("/versions")) return respond(route, [{ ...old, versions_count: 2 }, { ...selected, versions_count: 2 }]);
    if (path === "/api/prompts/101") { oldDetailRequests += 1; return respond(route, old); }
    return respond(route, path.endsWith("/102") ? selected : template(103, { name: "version-copy", version: "v1" }));
  });
  await page.goto(`${baseUrl}/admin/prompts/101`);
  await page.getByText("content for 101", { exact: true }).waitFor();
  const previousRequests = oldDetailRequests;
  await page.locator(".version-row").filter({ hasText: "v102" }).locator('button[title="Activate"]').click();
  await page.getByText("content for 102", { exact: true }).waitFor();
  assert.equal(oldDetailRequests, previousRequests);
  await page.getByRole("button", { name: "Duplicate as New Template" }).click();
  await page.getByLabel("Name", { exact: true }).fill("version-copy");
  await page.getByRole("button", { name: "Duplicate Template", exact: true }).click();
  await page.waitForURL("**/admin/prompts/103");
  assert.equal(duplicatePath, "/api/prompts/102/duplicate");
});

test("dialog reopens after switching details while it is open", async (t) => {
  const old = template(101);
  const selected = template(102);
  const gate = deferred();
  t.after(() => gate.resolve());
  const page = await makePage(t, async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.startsWith("/api/prompts/102")) await gate.promise;
    if (path.endsWith("/versions")) return respond(route, [{ ...old, versions_count: 2 }, { ...selected, versions_count: 2 }]);
    return respond(route, path.endsWith("/101") ? old : selected);
  });
  await page.goto(`${baseUrl}/admin/prompts/101`);
  await page.getByText("content for 101", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Duplicate as New Template" }).click();
  assert.equal(await page.locator("dialog[open]").isVisible(), true);
  await changeRoute(page, "/admin/prompts/102");
  await page.getByText("Loading prompt...", { exact: true }).waitFor();
  gate.resolve();
  await page.getByText("content for 102", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Duplicate as New Template" }).click();
  assert.equal(await page.locator("dialog[open]").isVisible(), true, "dialog must open for the newly displayed record");
});

test("duplicate dialog disables input and submit while the request is pending", async (t) => {
  const source = template(101);
  const created = template(103, { name: "pending-copy", version: "v1" });
  const gate = deferred();
  const started = deferred();
  let duplicateCalls = 0;
  t.after(() => gate.resolve());
  const page = await makePage(t, async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/prompts/101/duplicate") {
      duplicateCalls += 1;
      started.resolve();
      await gate.promise;
      return respond(route, created, 201);
    }
    if (path.endsWith("/versions")) return respond(route, [{ ...source, versions_count: 1 }]);
    return respond(route, path.endsWith("/103") ? created : source);
  });
  await page.goto(`${baseUrl}/admin/prompts/101`);
  await page.getByText("content for 101", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Duplicate as New Template" }).click();
  await page.getByLabel("Name", { exact: true }).fill("pending-copy");
  await page.getByRole("button", { name: "Duplicate Template", exact: true }).click();
  await started.promise;
  assert.equal(await page.getByRole("button", { name: "Duplicating...", exact: true }).isDisabled(), true);
  assert.equal(await page.getByRole("button", { name: "Cancel", exact: true }).isDisabled(), true);
  assert.equal(await page.getByLabel("Name", { exact: true }).isDisabled(), true);
  assert.equal(duplicateCalls, 1);
  gate.resolve();
  await page.waitForURL("**/admin/prompts/103");
});

test("a late duplication result cannot navigate away from the newly selected detail", async (t) => {
  const old = template(101);
  const selected = template(102);
  const gate = deferred();
  const started = deferred();
  const delivered = deferred();
  t.after(() => gate.resolve());
  const page = await makePage(t, async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/prompts/101/duplicate") {
      started.resolve();
      await gate.promise;
      await respond(route, template(103, { name: "old-copy", version: "v1" }), 201);
      delivered.resolve();
      return;
    }
    if (path.endsWith("/versions")) return respond(route, [{ ...old, versions_count: 2 }, { ...selected, versions_count: 2 }]);
    return respond(route, path.endsWith("/101") ? old : selected);
  });
  await page.goto(`${baseUrl}/admin/prompts/101`);
  await page.getByText("content for 101", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Duplicate as New Template" }).click();
  await page.getByRole("button", { name: "Duplicate Template", exact: true }).click();
  await started.promise;
  await changeRoute(page, "/admin/prompts/102");
  await page.getByText("content for 102", { exact: true }).waitFor();
  gate.resolve();
  await delivered.promise;
  await page.waitForTimeout(50);
  assert.equal(new URL(page.url()).pathname, "/admin/prompts/102");
  await page.getByRole("button", { name: "Duplicate as New Template" }).click();
  assert.equal(await page.locator("dialog[open]").isVisible(), true);
});

test("detail rejects a response for a different record id", async (t) => {
  const wrong = template(101);
  const page = await makePage(t, async (route) => {
    const path = new URL(route.request().url()).pathname;
    return respond(route, path.endsWith("/versions") ? [{ ...wrong, versions_count: 1 }] : wrong);
  });
  await page.goto(`${baseUrl}/admin/prompts/102`);
  await page.getByText("Prompt not found.", { exact: true }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Duplicate as New Template" }).count(), 0);
});

test("editor hides the old form while another id loads, reports failure, retries and saves text", async (t) => {
  const old = template(101);
  const text = template(102, { name: "text-target", template_type: "text", messages: null, content: "Hello {{person}}" });
  const gate = deferred();
  let failureMode = true;
  const puts = [];
  t.after(() => gate.resolve());
  const page = await makePage(t, async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    if (req.method() === "PUT") {
      puts.push({ path, data: req.postDataJSON() });
      return respond(route, { ...text, ...puts.at(-1).data });
    }
    if (path.endsWith("/versions")) return respond(route, [{ ...text, versions_count: 1 }]);
    if (path === "/api/prompts/102") {
      if (failureMode) { await gate.promise; return respond(route, { detail: "unavailable" }, 500); }
      return respond(route, text);
    }
    return respond(route, old);
  });
  await page.goto(`${baseUrl}/admin/prompts/101/edit`);
  await page.getByRole("heading", { name: "shared", exact: true }).waitFor();
  await changeRoute(page, "/admin/prompts/102/edit");
  await page.waitForTimeout(100);
  assert.equal(await page.locator("form.editor-layout").count(), 0, "old form must not remain editable during target load");
  gate.resolve();
  await page.getByRole("button", { name: "Retry", exact: true }).waitFor();
  assert.equal(await page.locator("form.editor-layout").count(), 0, "failed load must not allow a save");
  failureMode = false;
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await page.getByLabel(/Text template content/).waitFor();
  await page.getByLabel(/Text template content/).fill("Edited {{person}}");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.waitForURL("**/admin/prompts/102");
  assert.equal(puts.length, 1);
  assert.equal(puts[0].path, "/api/prompts/102");
  assert.equal(puts[0].data.template_type, "text");
  assert.equal(puts[0].data.content, "Edited {{person}}");
});

test("late editor response cannot replace the newly selected record", async (t) => {
  const old = template(101, { name: "old-record" });
  const selected = template(102, { name: "text-target", template_type: "text", messages: null, content: "Target {{person}}" });
  const gate = deferred();
  const oldStarted = deferred();
  const oldDelivered = deferred();
  let puts = [];
  t.after(() => gate.resolve());
  const page = await makePage(t, async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    if (req.method() === "PUT") { puts.push({ path, data: req.postDataJSON() }); return respond(route, { ...selected, ...puts.at(-1).data }); }
    if (path.endsWith("/versions")) return respond(route, [{ ...selected, versions_count: 1 }]);
    if (path === "/api/prompts/101") { oldStarted.resolve(); await gate.promise; await respond(route, old); oldDelivered.resolve(); return; }
    return respond(route, selected);
  });
  await page.goto(`${baseUrl}/admin/prompts/101/edit`);
  await oldStarted.promise;
  await page.waitForTimeout(100);
  assert.equal(await page.locator("form.editor-layout").count(), 0, "initial edit must not expose a form before the requested record loads");
  await changeRoute(page, "/admin/prompts/102/edit");
  await page.getByLabel(/Text template content/).waitFor();
  gate.resolve();
  await oldDelivered.promise;
  await page.waitForTimeout(50);
  assert.equal(await page.getByLabel(/Text template content/).count(), 1, "old response must not replace current text form");
  assert.equal(await page.getByLabel(/Text template content/).inputValue(), "Target {{person}}");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.waitForURL("**/admin/prompts/102");
  assert.equal(puts.length, 1);
  assert.equal(puts[0].path, "/api/prompts/102");
  assert.equal(puts[0].data.template_type, "text");
});

test("editor rejects a successful response for the wrong id and offers retry", async (t) => {
  const wrong = template(101);
  const right = template(102, { name: "text-target", template_type: "text", messages: null, content: "Target" });
  let wrongResponse = true;
  const page = await makePage(t, async (route) => respond(route, wrongResponse ? wrong : right));
  await page.goto(`${baseUrl}/admin/prompts/102/edit`);
  await page.getByRole("button", { name: "Retry", exact: true }).waitFor();
  assert.equal(await page.locator("form.editor-layout").count(), 0);
  wrongResponse = false;
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await page.getByLabel(/Text template content/).waitFor();
  assert.equal(await page.getByLabel(/Text template content/).inputValue(), "Target");
});

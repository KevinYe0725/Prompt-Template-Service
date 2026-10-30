# QA 交接：模板复制

## 来源与边界

- 基线 `10aeb958fe35c64b0b84388283d40e3ef64850cb`，先行规格提交 `a182e2126511d64ec8eb7bf68a8f2c9521c952e8`；当前最终提交请运行 `git rev-parse HEAD` 确认。
- 本任务的 PM 决策由 Codex 在用户授权下模拟，详见 `PRD.md`、`PM_MEMORY.md`；开发实测和局限详见 `DEVELOPMENT_MEMORY.md`。测试该 PR 不要求 AI key，不调用模型。
- 下列命令只创建本克隆 `.venv/qa-runtime.sqlite3` 和本地依赖；不要使用项目 `stop_all.sh`、`restart_backend.sh` 或现有 `.run` PID，也不要复制 `.env`。请先检查 18811/18812 空闲。

## 环境与启动

使用 Python、Node.js 18+、npm 及本机 Chrome/Chromium。从本克隆根目录执行：

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt pytest
(cd frontend && npm ci)
lsof -nP -iTCP:18811 -iTCP:18812 -sTCP:LISTEN
```

`lsof` 无输出通常表示端口空闲，退出码可能为 1。已占用时不要结束其他人的进程，另选端口并同步修改下列地址。终端一启动后端（创建数据库表），保持运行：

```bash
DATABASE_URL="sqlite:///$PWD/.venv/qa-runtime.sqlite3" \
  AUTO_CREATE_TABLES=true AI_API_KEY='' \
  .venv/bin/python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 18811
```

终端二在同一克隆根目录启动前端，API 相对路径经同源 Vite 代理；不配置 `VITE_API_BASE_URL` 的远端地址：

```bash
cd frontend
VITE_API_BASE_URL='' VITE_DEV_API_PROXY_TARGET='http://127.0.0.1:18811' \
  npm run dev -- --host 127.0.0.1 --port 18812 --strictPort
```

访问 `http://127.0.0.1:18812/admin/prompts`，健康检查为 `curl http://127.0.0.1:18812/api/health`。结束时仅在这两个前台终端按 Ctrl-C；数据库及依赖按需要保留。默认 Vite 代理不变，只有设置变量后才指向 18811。

## 测试数据

使用全新隔离数据库执行以下请求；若数据库曾使用过，请改用独立的新 SQLite 路径，或改 fixture 名称，不要删除其他数据。响应含源模板 ID：

```bash
curl -sS http://127.0.0.1:18812/api/prompts -H 'Content-Type: application/json' -d '{
  "name":"qa-chat-source", "version":"v3", "scenario":"support", "task_type":"answer",
  "template_type":"chat", "output_format":"json", "enabled":true,
  "messages":[
    {"role":"system","content":"Hello {{name}}","metadata":{"nested":{"value":"keep"}}},
    {"role":"user","content":"Explain {{topic}}"},
    {"role":"assistant","content":"Keep this extra message"}
  ], "description":"QA fixture", "created_by":"fixture-author"
}'

curl -sS http://127.0.0.1:18812/api/prompts -H 'Content-Type: application/json' -d '{
  "name":"qa-text-source", "version":"v2", "scenario":"support", "task_type":"reply",
  "template_type":"text", "content":"Welcome {{person}}", "output_format":"text", "enabled":true
}'

curl -sS http://127.0.0.1:18812/api/prompts -H 'Content-Type: application/json' -d '{
  "name":"qa-taken", "version":"v2", "scenario":"support", "task_type":"reply",
  "template_type":"text", "content":"Existing", "output_format":"text", "enabled":true
}'
```

在来源详情打开“复制为新模板”，检查建议名称、取消、空白及 `qa-taken` 冲突，然后输入新名称创建。检查新详情为独立 ID、未启用 `v1`，来源仍启用；查看 API 返回的完整 chat messages，编辑 system/user 后检查 assistant 与嵌套 metadata 保留。对于 text 副本，在编辑器修改内容并验证类型未变，再用 Playground 的“预览渲染”填写变量；不要点击任何 AI 生成或模型测试按钮。尝试对副本名称使用 `POST /api/prompts/render` 的 `version=active` 应返回 404，显式启用后才可渲染。已有“复制为新版本”入口应继续可用。

接口单独测试（将变量值替换为 fixture 响应 ID）：

```bash
PROMPT_QA_SOURCE_ID=1
curl -i "http://127.0.0.1:18812/api/prompts/${PROMPT_QA_SOURCE_ID}/duplicate" \
  -H 'Content-Type: application/json' -d '{"name":"  qa-new  "}'
```

第一次 201 返回规范化后的 `qa-new`；重复请求 409。空名称 422，不存在的来源 ID 404。浏览器检查时请另验证中英文、长名称和错误后的重试；网络/请求顺序、日志与数据库状态应作为独立证据记录。前端自动化另以受控延迟响应检查提交中按钮禁用，并验证切换 ID、迟到响应与加载失败重试。

## 自动化检查

```bash
.venv/bin/python -m pytest -q
(cd frontend && npm test && npm run build)
git diff --check
```

`npm test` 用 `playwright-core` 启动独立无头 Chrome/Chromium 和随机本地 Vite 端口，不操作已打开的用户浏览器；测试拦截并控制 HTTP 响应，不访问 AI。若未自动找到浏览器，将 `PROMPT_TEST_CHROMIUM_PATH` 指向可执行文件后重跑，例如 `PROMPT_TEST_CHROMIUM_PATH='/path/to/chromium' npm test`。这些检查针对本地代码、受控 HTTP 和 SQLite；请勿将其视为 MySQL、并发唯一性、生产部署或真实模型验证。

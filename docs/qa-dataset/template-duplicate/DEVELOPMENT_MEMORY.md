# 开发记忆：指定版本复制为新模板

## 来源和范围

本次由 Codex 根据用户委托的 QA 数据集任务实现，PM 与开发角色均为手工模拟，不代表已有外部团队会签或 QA 结论。基线 `10aeb958fe35c64b0b84388283d40e3ef64850cb`；规格/PM 记忆/计划先于产品代码提交，规格提交 `a182e2126511d64ec8eb7bf68a8f2c9521c952e8`。实现过程中发现编辑会丢失未暴露的聊天消息，按授权补充 PRD 和 PM 记忆。可复现环境见 `HANDOFF.md`。

## 实现决策

- `backend/app/prompt/schemas.py` 在 Pydantic 字段层以 Python `strip()` 先规范化名称，再检查 1–100 Unicode 码点；无效结构或名称为 422。`router.py` 沿用现有异常映射；`service.py` 先读取特定源版本，再查询目标名称的所有版本，深拷贝 messages 并复用 payload 校验和变量解析，插入未启用 `v1`，不复制作者或日志。来源非法 payload 为 400、缺失源 404、同名 409；提交碰撞时回滚并返回 409。
- `PromptDetailPage.tsx` 添加原生 modal、初始建议名称、行内输入/冲突错误、提交中禁用和同步防重入，完成后转向新详情；复制新版本入口仍保留。中英文词条在 `i18n.tsx`，调用集中于 `promptApi.ts`。前端使用与 Python `strip()` 对应的空白集合及 Unicode 码点计数。
- `PromptEditorPage.tsx` 针对 text 显示和保存文本内容；现有 chat 的当前版本编辑通过 `editableMessages.ts` 只替换第一条 system/user 的内容，保留其他角色和嵌套字段；新版本的既有构造逻辑保持原状。编辑器仍不提供任意角色或嵌套字段的专门编辑界面。
- 协调者独立复核 `875326050f4a3db0472fd26c078d231f0d50b10f` 后指出合法空消息以及详情/编辑器 ID 切换的异步竞争。当前版本的空内容保持可保存，缺失角色只在用户输入非空内容时创建；创建模板及新版本仍沿用原来的必填规则。详情和编辑器按当前 ID 与请求代数过滤迟到结果；编辑器只在对应 ID 成功加载后开放表单，失败提供重试；切换详情重置弹窗，进行中的旧复制结果不会把用户导航离开新详情。
- `frontend/vite.config.ts` 使用可选的 `VITE_DEV_API_PROXY_TARGET`；未设置时仍代理到 `http://localhost:8000`。无需数据库迁移。

## 实际验证和边界

- 后端测试先写后执行：`python -m pytest -q tests/test_template_duplicate.py` 在无端点时 **12 failed, 2 passed**，失败原因为重复调用返回路由 404；首次实现后 **14 passed**，复核时补充三个真实 SQLite 空消息/缺失角色示例，现为 **17 passed**。测试使用 TestClient 和每例独立的真实 SQLite，覆盖 chat/text、嵌套字段、来源 active 不变、变量重算、无日志与原作者复制、v2-only 名称冲突、重复、422/404/400、预览、编辑、启用和原新版本 API。首次 RED 的 2 个通过分别为缺失源 404（当时也可由缺失路由产生）和原新版本回归，不能单独证明新端点正确。
- 前端 `npm test` **19 passed**：5 项消息合并单元测试、14 项无头 Chrome 实际 React 页面交互。浏览器先实际复现过旧编辑器保存丢失 assistant/嵌套字段；复核后先看到空角色辅助函数 2 项 RED、实际页面中空消息不可保存、旧响应覆盖、弹窗无法重新打开和加载中暴露旧表单等 RED，再进行修复。浏览器测试拦截 HTTP 并控制响应顺序、错误及延迟，覆盖当前显示版本的复制目标、迟到复制响应、加载失败/重试/错误 ID、text 保存、缺失角色、原创建与新版本必填，以及复制提交期间控件禁用。受控 HTTP 不等同于真实数据库并发或生产网络。`npm run build` 通过 TypeScript 和 Vite 构建。
- 手工浏览器使用 `127.0.0.1:18812` 同源代理到 `127.0.0.1:18811`，空 AI key、独立 SQLite：取消后总数仍为 1；空白名称和已有名称显示行内错误；成功创建跳入未启用 text `v1`，编辑后保留 text 类型并重算变量，预览 `Welcome Ada`。后续竞态修复的自动页面回归使用独立无头浏览器和受控响应；不将其描述为真实后端的慢网络验证。
- 本地版本：Python 3.10.11、FastAPI 0.162.0、SQLAlchemy 2.0.55、Pydantic 2.14.2、httpx 0.28.1、pytest 9.2.0、Node 22.23.2、playwright-core 1.64.1，使用本机 Google Chrome。全量 pytest 有 4 条警告：已有模块的 `TestVariablesParseError` 收集警告、Starlette TestClient/httpx 弃用警告，以及 FastAPI startup `on_event` 的两条弃用警告；没有将警告当作测试失败。
- 未测试 MySQL、跨数据库 collation、生产并发、真实 AI 及线上部署。现有唯一约束仅覆盖 `(name, version)`：固定 `v1` 防止两个相同复制并存，但与其他 API 同时创建同名不同版本可能竞争。`created_at` 和 `updated_at` 由数据库创建，时间精度可能使两个不同记录的值相同，身份独立不要求时间值必然不同。无认证、授权或审计机制属于现有项目边界。

这是一份开发交接，不是 QA 通过或生产就绪的声明。

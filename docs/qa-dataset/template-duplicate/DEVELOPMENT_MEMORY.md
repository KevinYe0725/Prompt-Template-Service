# 开发记忆：指定版本复制为新模板

## 来源和范围

本次由 Codex 根据用户委托的 QA 数据集任务实现，PM 与开发角色均为手工模拟，不代表已有外部团队会签或 QA 结论。基线 `10aeb958fe35c64b0b84388283d40e3ef64850cb`；规格/PM 记忆/计划先于产品代码提交，规格提交 `a182e2126511d64ec8eb7bf68a8f2c9521c952e8`。实现过程中发现编辑会丢失未暴露的聊天消息，按授权补充 PRD 和 PM 记忆。可复现环境见 `HANDOFF.md`。

## 实现决策

- `backend/app/prompt/schemas.py` 在 Pydantic 字段层以 Python `strip()` 先规范化名称，再检查 1–100 Unicode 码点；无效结构或名称为 422。`router.py` 沿用现有异常映射；`service.py` 先读取特定源版本，再查询目标名称的所有版本，深拷贝 messages 并复用 payload 校验和变量解析，插入未启用 `v1`，不复制作者或日志。来源非法 payload 为 400、缺失源 404、同名 409；提交碰撞时回滚并返回 409。
- `PromptDetailPage.tsx` 添加原生 modal、初始建议名称、行内输入/冲突错误、提交中禁用和同步防重入，完成后转向新详情；复制新版本入口仍保留。中英文词条在 `i18n.tsx`，调用集中于 `promptApi.ts`。前端使用与 Python `strip()` 对应的空白集合及 Unicode 码点计数。
- `PromptEditorPage.tsx` 针对 text 显示和保存文本内容；现有 chat 的当前版本编辑通过 `editableMessages.ts` 只替换第一条 system/user 的内容，保留其他角色和嵌套字段；新版本的既有构造逻辑保持原状。编辑器仍不提供任意角色或嵌套字段的专门编辑界面。
- `frontend/vite.config.ts` 使用可选的 `VITE_DEV_API_PROXY_TARGET`；未设置时仍代理到 `http://localhost:8000`。无需数据库迁移。

## 实际验证和边界

- 后端测试先写后执行：`python -m pytest -q tests/test_template_duplicate.py` 在无端点时 **12 failed, 2 passed**，失败原因为重复调用返回路由 404；实现后 `python -m pytest -q` **14 passed**。测试使用 TestClient 和每例独立的真实 SQLite，覆盖 chat/text、嵌套字段、来源 active 不变、变量重算、无日志与原作者复制、v2-only 名称冲突、重复、422/404/400、预览、编辑、启用和原新版本 API。首次 RED 的 2 个通过分别为缺失源 404（当时也可由缺失路由产生）和原新版本回归，不能单独证明新端点正确。
- 前端 `npm test` **2 passed**：检查编辑首个 system/user 时保留其他消息和嵌套属性，以及缺少 system/user 时保留既有消息。浏览器先实际复现过旧编辑器保存丢失 assistant/嵌套字段；补充自动测试时缺少提取的工具函数先编译失败，再实现并通过。`npm run build` 通过 TypeScript 和 Vite 构建。
- 手工浏览器使用 `127.0.0.1:18812` 同源代理到 `127.0.0.1:18811`，空 AI key、独立 SQLite：取消后总数仍为 1；空白名称和已有名称显示行内错误；成功创建跳入未启用 text `v1`，编辑后保留 text 类型并重算变量，预览 `Welcome Ada`。修正后的 chat 浏览器保存由协调者独立复核；提交中的禁用状态尚未用受控慢网络单独观察，不能声称已进行该项实测。
- 本地版本：Python 3.10.11、FastAPI 0.162.0、SQLAlchemy 2.0.55、Pydantic 2.14.2、httpx 0.28.1、pytest 9.2.0、Node 22.23.2。全量 pytest 有 4 条警告：已有模块的 `TestVariablesParseError` 收集警告、Starlette TestClient/httpx 弃用警告，以及 FastAPI startup `on_event` 的两条弃用警告；没有将警告当作测试失败。
- 未测试 MySQL、跨数据库 collation、生产并发、真实 AI 及线上部署。现有唯一约束仅覆盖 `(name, version)`：固定 `v1` 防止两个相同复制并存，但与其他 API 同时创建同名不同版本可能竞争。`created_at` 和 `updated_at` 由数据库创建，时间精度可能使两个不同记录的值相同，身份独立不要求时间值必然不同。无认证、授权或审计机制属于现有项目边界。

这是一份开发交接，不是 QA 通过或生产就绪的声明。

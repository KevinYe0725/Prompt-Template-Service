# Prompt Template Service

Prompt Template Service 是一个用于统一管理、版本化、预览和测试 AI Prompt 的服务。它提供 FastAPI 后端、SQLAlchemy 数据模型、MySQL 8.0 建表脚本、OpenAI-compatible AI Client 适配器，以及 Apple-like 风格的 React 管理页面。

本项目的核心目标是把 `system prompt`、`user prompt`、变量占位符、版本、启用状态和渲染结果从业务代码中抽离出来，集中存储、集中调试，并输出可以直接交给 OpenAI-compatible Chat API 的 `messages`。

## 功能特性

- Prompt 模板集中管理，支持 `chat` 和预留 `text` 类型。
- 同一个模板名支持多个版本，例如 `v1`、`v2`、`v3`。
- 同一个模板名下只允许一个版本处于 `enabled=true`。
- 自动解析 `{{variable_name}}` 变量，占位符支持 `{{name}}` 和 `{{ name }}`。
- 渲染前校验变量是否传齐，缺失变量返回清晰错误。
- 渲染成功和失败都会写入 `prompt_render_log`。
- 提供 `/api/prompts/render`，业务系统可按模板名和变量获取渲染后的 messages。
- 提供 `/api/prompts/{id}/preview`，只预览渲染结果，不调用模型。
- 提供 `/api/prompts/{id}/test`，渲染后调用 OpenAI-compatible AI Client 测试模型输出。
- 前端提供 Apple-like 管理页面，支持列表、搜索、编辑、版本管理、启用、Playground。
- Playground 支持变量 JSON 输入、缺变量提示、渲染预览、模型测试、结果复制。

## 技术栈

后端：

- Python
- FastAPI
- SQLAlchemy 2.x
- Pydantic 2.x
- MySQL 8.0
- SQLite 本地开发支持
- httpx

前端：

- React
- TypeScript
- Vite
- lucide-react
- CSS 自定义 Apple-like UI

## 目录结构

```text
.
├── backend
│   ├── app
│   │   ├── ai_client
│   │   │   ├── __init__.py
│   │   │   └── client.py
│   │   ├── prompt
│   │   │   ├── __init__.py
│   │   │   ├── models.py
│   │   │   ├── renderer.py
│   │   │   ├── router.py
│   │   │   ├── schemas.py
│   │   │   ├── service.py
│   │   │   └── variable_parser.py
│   │   ├── config.py
│   │   ├── database.py
│   │   └── main.py
│   └── sql
│       ├── prompt_template_schema.sql
│       └── prompt_template_seed.sql
├── frontend
│   ├── src
│   │   ├── api
│   │   │   └── promptApi.ts
│   │   ├── components
│   │   ├── pages
│   │   ├── types
│   │   ├── utils
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── styles.css
│   ├── package.json
│   └── vite.config.ts
├── scripts
│   ├── run_backend.sh
│   └── run_frontend.sh
├── .env.example
├── requirements.txt
└── README.md
```

## 环境变量

复制示例配置：

```bash
cp .env.example .env
```

后端启动时会自动加载项目根目录的 `.env`。如果你修改了 `.env`，需要重启后端：

```bash
./scripts/restart_backend.sh
```

关键配置：

```env
APP_NAME=Prompt Template Service
APP_ENV=development
BACKEND_CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://localhost:5175,http://127.0.0.1:5175

# 本地开发默认 SQLite
DATABASE_URL=sqlite:///./backend/data/prompt_template_service.sqlite3
AUTO_CREATE_TABLES=true

# MySQL 8.0 示例
# DATABASE_URL=mysql+pymysql://user:password@127.0.0.1:3306/prompt_template_service?charset=utf8mb4

# OpenAI-compatible AI Provider
AI_BASE_URL=https://api.deepseek.com
AI_API_KEY=
DEFAULT_AI_MODEL=deepseek-chat
AI_REQUEST_TIMEOUT_SECONDS=60

# Frontend
VITE_API_BASE_URL=http://localhost:8000
```

注意：

- 不要把真实 `AI_API_KEY` 提交到代码仓库。
- 本地开发可以使用 SQLite 和 `AUTO_CREATE_TABLES=true` 自动建表。
- 生产或联调 MySQL 时，建议设置 MySQL `DATABASE_URL`，并手动执行 SQL 脚本。

## 安装后端依赖

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## 启动后端

```bash
source .venv/bin/activate
./scripts/run_backend.sh
```

默认地址：

```text
http://localhost:8000
```

健康检查：

```bash
curl http://localhost:8000/api/health
```

预期返回：

```json
{
  "status": "ok"
}
```

## 一键启动和重启脚本

推荐开发时使用一键启动脚本：

```bash
./scripts/start_all.sh
```

该脚本默认以前台方式运行：一个命令同时启动前后端、持续显示日志，按 `Ctrl+C` 会停止本项目的前后端进程。

默认端口：

- 后端：`8000`
- 前端：`5175`

启动后访问：

```text
http://127.0.0.1:5175/admin/prompts
```

脚本会把 PID 写入 `.run/`，日志写入 `logs/`：

```text
.run/backend.pid
.run/frontend.pid
logs/backend.log
logs/frontend.log
```

如果只想重启后端：

```bash
./scripts/restart_backend.sh
```

如果想停止脚本管理的本项目进程，并清理本项目残留的 Vite/Uvicorn 进程：

```bash
./scripts/stop_all.sh
```

可以通过环境变量调整端口：

```bash
BACKEND_PORT=8010 FRONTEND_PORT=5180 ./scripts/start_all.sh
BACKEND_PORT=8010 ./scripts/restart_backend.sh
```

如果希望脚本启动后立即返回命令行，可以使用后台模式：

```bash
DETACH=1 ./scripts/start_all.sh
```

## 安装前端依赖

```bash
cd frontend
npm install
```

## 启动前端

```bash
cd frontend
npm run dev
```

直接运行前端脚本时默认地址：

```text
http://localhost:5175/admin/prompts
```

`scripts/run_frontend.sh` 使用 `--strictPort` 固定端口。如果 `5175` 被占用，脚本会直接报错，避免 Vite 自动漂移到多个端口导致混乱。

## 数据库脚本

MySQL 8.0 建表脚本：

```bash
mysql -u <user> -p <database> < backend/sql/prompt_template_schema.sql
```

默认模板初始化脚本：

```bash
mysql -u <user> -p <database> < backend/sql/prompt_template_seed.sql
```

脚本位置：

- `backend/sql/prompt_template_schema.sql`
- `backend/sql/prompt_template_seed.sql`

初始化脚本会插入 3 个默认模板：

- `interview_question_generation:v1`
- `interview_answer_evaluation:v1`
- `resume_analysis:v1`

## 数据表说明

### prompt_template

用于存储 Prompt 模板及版本。

重要字段：

- `name`：模板名称，例如 `interview_question_generation`
- `version`：模板版本，例如 `v1`
- `scenario`：业务场景，例如 `interview`、`resume`、`rag`
- `task_type`：任务类型，例如 `question_generation`、`evaluation`
- `template_type`：模板类型，当前重点支持 `chat`
- `content`：文本模板内容，`template_type=text` 时使用
- `messages`：chat messages 模板，`template_type=chat` 时使用
- `variables`：自动解析出的变量列表
- `output_format`：输出格式，支持 `text`、`json`、`markdown`
- `enabled`：是否为当前启用版本

唯一约束：

```text
(name, version)
```

### prompt_render_log

用于记录每次渲染结果。

重要字段：

- `request_id`：请求 ID
- `template_id`：模板 ID
- `name`：模板名称
- `version`：模板版本
- `variables`：本次传入变量
- `rendered_content`：渲染后的文本
- `rendered_messages`：渲染后的 messages
- `success`：是否成功
- `error_message`：失败原因

## 后端模块说明

Prompt 服务代码位于：

```text
backend/app/prompt
```

职责划分：

- `models.py`：SQLAlchemy ORM 模型。
- `schemas.py`：Pydantic 请求和响应模型。
- `variable_parser.py`：解析 `{{variable}}` 占位符。
- `renderer.py`：渲染文本和 messages，校验缺失变量。
- `service.py`：业务逻辑，包括创建、更新、版本、启用、渲染、测试。
- `router.py`：FastAPI 路由。

AI Client 位于：

```text
backend/app/ai_client/client.py
```

它使用 OpenAI-compatible `/chat/completions` 协议，请求地址为：

```text
{AI_BASE_URL}/chat/completions
```

## API 列表

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/api/prompts` | 创建模板 |
| `POST` | `/api/prompts/generate-draft` | 根据模板元信息生成 system/user prompt 草稿 |
| `GET` | `/api/prompts` | 查询模板列表 |
| `GET` | `/api/prompts/{id}` | 查询模板详情 |
| `PUT` | `/api/prompts/{id}` | 更新模板当前版本 |
| `POST` | `/api/prompts/{id}/duplicate` | 将指定版本复制为独立的新模板 |
| `POST` | `/api/prompts/{id}/versions` | 基于当前模板创建新版本 |
| `GET` | `/api/prompts/{id}/versions` | 查询同名模板所有版本 |
| `POST` | `/api/prompts/{id}/activate` | 启用某个版本 |
| `POST` | `/api/prompts/render` | 按名称和版本渲染模板 |
| `POST` | `/api/prompts/{id}/preview` | 按 ID 预览渲染结果 |
| `POST` | `/api/prompts/{id}/generate-test-variables` | 根据当前模板生成测试变量 JSON |
| `POST` | `/api/prompts/{id}/test` | 渲染并调用模型测试 |

## 创建模板

请求：

```bash
curl -X POST http://localhost:8000/api/prompts \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "interview_question_generation",
    "version": "v1",
    "scenario": "interview",
    "task_type": "question_generation",
    "template_type": "chat",
    "messages": [
      {
        "role": "system",
        "content": "你是一名{{position}}岗位的资深技术面试官。"
      },
      {
        "role": "user",
        "content": "请根据简历生成{{count}}个问题：{{resume}}"
      }
    ],
    "output_format": "json",
    "enabled": true,
    "description": "根据简历生成面试问题"
  }'
```

响应示例：

```json
{
  "id": 1,
  "name": "interview_question_generation",
  "version": "v1",
  "scenario": "interview",
  "task_type": "question_generation",
  "template_type": "chat",
  "content": null,
  "messages": [
    {
      "role": "system",
      "content": "你是一名{{position}}岗位的资深技术面试官。"
    },
    {
      "role": "user",
      "content": "请根据简历生成{{count}}个问题：{{resume}}"
    }
  ],
  "variables": ["position", "count", "resume"],
  "output_format": "json",
  "enabled": true,
  "description": "根据简历生成面试问题",
  "created_by": null,
  "created_at": "2026-04-25T10:00:00",
  "updated_at": "2026-04-25T10:00:00"
}
```

## AI 生成 Prompt 草稿

创建模板时，可以先填写模板名称、业务场景、任务类型、输出格式和描述，然后调用 AI 生成 system/user prompt 草稿。该接口不会保存模板，只返回草稿内容，用户可以在前端继续修改后再保存。

请求：

```bash
curl -X POST http://localhost:8000/api/prompts/generate-draft \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "interview_question_generation",
    "scenario": "interview",
    "task_type": "question_generation",
    "output_format": "json",
    "description": "根据候选人简历和岗位要求生成结构化技术面试问题",
    "language": "zh",
    "temperature": 0.4,
    "max_tokens": 1800
  }'
```

响应示例：

```json
{
  "system_prompt": "你是一名{{position}}岗位的资深技术面试官...",
  "user_prompt": "请根据候选人简历：{{resume}} 和岗位要求：{{job_requirements}} 生成 {{count}} 个问题...",
  "variables": ["position", "resume", "job_requirements", "count"],
  "model": "deepseek-chat",
  "latency_ms": 1234
}
```

## 查询模板列表

```bash
curl 'http://localhost:8000/api/prompts?page=1&page_size=20'
```

列表接口按模板名称 `name` 聚合返回：首页每个 Prompt 只展示一条记录，不会把同名的多个版本平铺出来。代表项优先使用 active 版本；如果没有 active 版本，则使用最近更新的版本。进入详情页后可以查看和切换同名模板下的所有版本。

支持查询参数：

- `keyword`
- `scenario`
- `task_type`
- `enabled`
- `page`
- `page_size`

响应示例：

```json
{
  "items": [
    {
      "id": 1,
      "name": "interview_question_generation",
      "version": "v1",
      "scenario": "interview",
      "task_type": "question_generation",
      "template_type": "chat",
      "variables": ["position", "count", "resume"],
      "output_format": "json",
      "enabled": true,
      "description": "根据简历生成面试问题",
      "updated_at": "2026-04-25T10:00:00",
      "versions_count": 3
    }
  ],
  "total": 1,
  "page": 1,
  "page_size": 20
}
```

## 查询模板详情

```bash
curl http://localhost:8000/api/prompts/1
```

返回完整模板信息，包括 `messages`、`variables`、`description`、创建和更新时间。

## 更新模板

```bash
curl -X PUT http://localhost:8000/api/prompts/1 \
  -H 'Content-Type: application/json' \
  -d '{
    "scenario": "interview",
    "task_type": "question_generation",
    "description": "增强后的面试问题生成模板",
    "output_format": "json",
    "template_type": "chat",
    "messages": [
      {
        "role": "system",
        "content": "你是一名{{position}}岗位的资深技术面试官。"
      },
      {
        "role": "user",
        "content": "请根据简历和岗位要求生成{{count}}个问题。简历：{{resume}}。岗位要求：{{job_requirements}}"
      }
    ]
  }'
```

如果修改 `content` 或 `messages`，后端会重新解析 `variables`。

## 创建新版本

```bash
curl -X POST http://localhost:8000/api/prompts/1/versions \
  -H 'Content-Type: application/json' \
  -d '{
    "version": "v2",
    "messages": [
      {
        "role": "system",
        "content": "你是一名{{position}}岗位的资深技术面试官，擅长设计有层次的问题。"
      },
      {
        "role": "user",
        "content": "请基于简历 {{resume}} 和岗位要求 {{job_requirements}} 生成 {{count}} 个问题。"
      }
    ],
    "description": "增强问题层次感",
    "enabled": false
  }'
```

新版本会继承原模板的：

- `name`
- `scenario`
- `task_type`
- `template_type`
- `output_format`

## 复制为新模板

从详情页选择“复制为新模板”，或发送：

```bash
curl -X POST http://localhost:8000/api/prompts/1/duplicate \
  -H 'Content-Type: application/json' \
  -d '{"name":"interview_support"}'
```

名称会去除首尾空白，处理后须为 1–100 个 Unicode 字符；源不存在返回 404，名称不合法或请求结构错误返回 422，目标名称已存在任意版本返回 409。来源内容不变，新模板从未启用的 `v1` 开始，复制内容和元信息并重新识别变量，不复制原作者及渲染日志。可直接预览或编辑，启用前不能通过 `active` 渲染。来源内容不符合现有模板规则时返回 400。

数据库只对 `(name, version)` 建唯一约束。检查到的现有名称会被拒绝，两个复制请求也不能同时创建同名 `v1`；但与其他接口并发创建同名不同版本时不能保证名称全局独占。名称比较依赖数据库 collation。

## 启用版本

```bash
curl -X POST http://localhost:8000/api/prompts/2/activate
```

启用某个版本时，同一个 `name` 下其他版本会自动变为 `enabled=false`。

响应示例：

```json
{
  "success": true,
  "active_template_id": 2,
  "name": "interview_question_generation",
  "version": "v2"
}
```

## 按名称渲染模板

```bash
curl -X POST http://localhost:8000/api/prompts/render \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "interview_question_generation",
    "version": "active",
    "variables": {
      "position": "Java后端开发",
      "count": 5,
      "resume": "熟悉 Spring Boot、MySQL、Redis。",
      "job_requirements": "要求掌握 Java、MySQL、Redis。"
    }
  }'
```

响应示例：

```json
{
  "template_id": 2,
  "name": "interview_question_generation",
  "version": "v2",
  "template_type": "chat",
  "content": null,
  "messages": [
    {
      "role": "system",
      "content": "你是一名Java后端开发岗位的资深技术面试官，擅长设计有层次的问题。"
    },
    {
      "role": "user",
      "content": "请基于简历 熟悉 Spring Boot、MySQL、Redis。 和岗位要求 要求掌握 Java、MySQL、Redis。 生成 5 个问题。"
    }
  ],
  "variables": {
    "position": "Java后端开发",
    "count": 5,
    "resume": "熟悉 Spring Boot、MySQL、Redis。",
    "job_requirements": "要求掌握 Java、MySQL、Redis。"
  }
}
```

## 缺少变量错误

如果渲染时缺少变量，返回 HTTP 400：

```json
{
  "detail": {
    "message": "Missing required variables",
    "missing_variables": ["job_requirements"]
  }
}
```

## 按 ID 预览模板

```bash
curl -X POST http://localhost:8000/api/prompts/1/preview \
  -H 'Content-Type: application/json' \
  -d '{
    "variables": {
      "position": "Java后端开发",
      "count": 3,
      "resume": "熟悉 Spring Boot 和 MySQL。"
    }
  }'
```

该接口只渲染模板，不调用模型。

## AI 生成测试变量

在 Playground 中测试 Prompt 时，可以让 AI 根据当前模板的场景、任务类型、变量列表和 messages 模板生成一份测试变量 JSON，避免手工填写复杂输入。

请求：

```bash
curl -X POST http://localhost:8000/api/prompts/1/generate-test-variables \
  -H 'Content-Type: application/json' \
  -d '{
    "language": "zh",
    "model": "deepseek-chat",
    "temperature": 0.5,
    "max_tokens": 1800
  }'
```

响应示例：

```json
{
  "variables": {
    "position": "Java后端开发",
    "count": 5,
    "resume": "候选人有 5 年 Java 后端开发经验，熟悉 Spring Boot、MySQL、Redis...",
    "job_requirements": "要求掌握 Java、MySQL、Redis，有高并发系统经验..."
  },
  "model": "deepseek-chat",
  "latency_ms": 980
}
```

该接口不会调用待测试的业务 Prompt，只生成测试输入。生成结果会覆盖 Playground 左侧变量 JSON，用户仍然可以手动修改。

## 测试调用模型

```bash
curl -X POST http://localhost:8000/api/prompts/1/test \
  -H 'Content-Type: application/json' \
  -d '{
    "variables": {
      "position": "Java后端开发",
      "count": 3,
      "resume": "熟悉 Spring Boot 和 MySQL。",
      "job_requirements": "要求掌握 Java、MySQL、Redis。"
    },
    "model": "deepseek-chat",
    "temperature": 0.7,
    "max_tokens": 1200
  }'
```

响应示例：

```json
{
  "template_id": 1,
  "name": "interview_question_generation",
  "version": "v1",
  "rendered_messages": [
    {
      "role": "system",
      "content": "..."
    },
    {
      "role": "user",
      "content": "..."
    }
  ],
  "model": "deepseek-chat",
  "ai_response": "...",
  "latency_ms": 1234
}
```

如果没有配置 `AI_API_KEY`，该接口会返回错误。Preview 不依赖 `AI_API_KEY`。

## 前端页面说明

管理页面入口：

```text
http://localhost:5175/admin/prompts
```

前端默认使用中文界面，顶部导航右侧提供中英文切换按钮，语言选择会保存到浏览器 `localStorage`。

### Prompt 列表页

路径：

```text
/admin/prompts
```

功能：

- 查看所有 Prompt 模板。
- 首页按模板名称聚合展示，不会把不同版本拆成多个列表项。
- 按 keyword 搜索。
- 按 scenario 筛选。
- 按 enabled 状态筛选。
- 分页查看。
- 点击卡片进入详情。
- 点击 `New Prompt` 创建模板。

### Prompt 详情页

路径：

```text
/admin/prompts/:id
```

功能：

- 查看模板基础信息。
- 查看当前版本和启用状态。
- 查看变量列表。
- 查看 system/user messages。
- 查看同名模板的所有版本。
- 编辑当前版本。
- 复制为新版本。
- 将当前版本复制为独立的新模板。
- 进入 Playground。
- 启用当前版本。

### Prompt 编辑页

路径：

```text
/admin/prompts/new
/admin/prompts/:id/edit
```

功能：

- 创建新模板。
- 根据已填写的模板元信息调用 AI 生成 system/user prompt 草稿。
- 编辑当前版本。
- 保存为新版本。
- 编辑 system prompt 和 user prompt。
- 实时解析变量并展示 variable chips。
- 保存成功后显示 toast。
- 页面离开前对未保存内容进行提示。

### Prompt Playground

路径：

```text
/admin/prompts/:id/playground
```

功能：

- 根据模板变量自动生成变量 JSON。
- 可以点击 `AI 生成测试变量`，根据当前模板场景自动生成一份测试输入。
- 友好提示 JSON 格式错误。
- 缺少变量时显示缺失变量名。
- 点击 `Preview Render` 预览渲染后的 messages。
- 点击 `Test with Model` 调用模型。
- 支持模型选择：
  - `deepseek-chat`
  - `deepseek-reasoner`
  - `qwen-plus`
  - `kimi`
  - 自定义模型名
- 支持设置 `temperature` 和 `max_tokens`。
- 支持复制 rendered messages 和 AI response。

## 变量规则

变量占位符格式：

```text
{{variable_name}}
{{ variable_name }}
```

变量名规则：

- 只能包含字母、数字、下划线。
- 自动去重。
- 支持从 `content` 和 `messages[].content` 中解析。

示例：

```text
你是一名 {{position}} 面试官，请根据 {{resume}} 生成 {{count}} 个问题。
```

解析结果：

```json
["position", "resume", "count"]
```

## OpenAI-compatible AI Client

后端测试接口复用内置 AI Client：

```text
backend/app/ai_client/client.py
```

它调用：

```text
POST {AI_BASE_URL}/chat/completions
```

请求体格式：

```json
{
  "model": "deepseek-chat",
  "messages": [
    {
      "role": "system",
      "content": "..."
    },
    {
      "role": "user",
      "content": "..."
    }
  ],
  "temperature": 0.7,
  "max_tokens": 1200
}
```

你可以把 `AI_BASE_URL` 改成任何兼容 OpenAI Chat Completions 协议的服务。

## 常见错误

### 1. `AI_API_KEY is not configured`

原因：

- `.env` 中没有配置 `AI_API_KEY`。
- 或者后端是在修改 `.env` 之前启动的，旧进程还没有读取新配置。

解决：

```env
AI_API_KEY=你的真实 API Key
```

然后重启后端：

```bash
./scripts/restart_backend.sh
```

### 2. `Missing required variables`

原因：

- 渲染时没有传齐模板中的变量。

解决：

- 查看响应中的 `missing_variables`。
- 在请求或 Playground 变量 JSON 中补齐变量。

### 2.1 `AI provider request timed out`

原因：

- `Max tokens` 设置过大，模型生成时间超过后端请求超时时间。
- 当前默认 `AI_REQUEST_TIMEOUT_SECONDS=60`，非流式大输出容易超过 60 秒。

解决：

- 降低 Playground 中的 `Max tokens`，例如先用 `1200`、`3000`、`8000` 逐步测试。
- 或在 `.env` 中调大超时时间：

```env
AI_REQUEST_TIMEOUT_SECONDS=180
```

然后重启后端：

```bash
./scripts/restart_backend.sh
```

### 3. `Prompt template not found`

原因：

- 模板 ID 不存在。
- 按名称渲染时指定的 `name` 或 `version` 不存在。

解决：

- 使用 `GET /api/prompts` 查询可用模板。

### 4. `Active prompt template not found`

原因：

- 使用 `version=active` 渲染，但该 `name` 下没有启用版本。

解决：

- 调用 `/api/prompts/{id}/activate` 启用一个版本。

### 5. 前端访问接口失败

检查：

- 后端是否启动。
- 前端 `VITE_API_BASE_URL` 是否指向正确后端地址。
- CORS 配置 `BACKEND_CORS_ORIGINS` 是否包含前端地址。

## 本地验证

后端语法检查：

```bash
python3 -m compileall backend
```

前端构建：

```bash
cd frontend
npm run build
```

后端健康检查：

```bash
curl http://localhost:8000/api/health
```

## 生产部署建议

- 使用 MySQL 8.0，并手动执行 `backend/sql/prompt_template_schema.sql`。
- 关闭或谨慎使用 `AUTO_CREATE_TABLES`。
- 使用环境变量注入 `DATABASE_URL`、`AI_BASE_URL`、`AI_API_KEY`。
- 不要把 `.env` 提交到代码仓库。
- 根据实际域名配置 `BACKEND_CORS_ORIGINS`。
- 对 `prompt_render_log.variables` 和 `rendered_messages` 做脱敏策略后再用于生产日志留存。
- 根据业务需要增加认证、权限和审计。当前第一版没有实现复杂权限系统。

## 快速体验流程

1. 启动后端。
2. 启动前端。
3. 打开 `/admin/prompts`。
4. 点击 `New Prompt`。
5. 创建一个包含 `{{position}}`、`{{resume}}`、`{{count}}` 的 chat 模板。
6. 保存后进入详情页，点击 `Activate Version`。
7. 点击 `Playground`。
8. 填写变量 JSON。
9. 点击 `Preview Render` 查看渲染后的 messages。
10. 配置 `AI_API_KEY` 后点击 `Test with Model` 查看模型输出。

## 许可证

当前项目未指定许可证。如需开源或商用分发，请先补充明确的 LICENSE 文件。

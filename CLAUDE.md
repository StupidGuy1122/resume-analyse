# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概览

智能简历分析网页：上传简历后，由本地大模型（Ollama）给出**改进建议**和**面试题预测**。数据全程不离开本机。

三层架构：**Next.js 14 前端**（App Router）↔ **FastAPI 后端**（Python 3.11）↔ **Ollama 本地模型**。后端编排两步式 LLM Agent 流水线，前端通过 NDJSON 流式渲染结果。当前没有数据库——所有数据都在进程内存中。

```
frontend/  → Next.js 14, App Router, Tailwind, shadcn/ui, pnpm
backend/   → FastAPI, pydantic v2, ollama AsyncClient, hatch 构建
docker-compose.yml → ollama + backend + frontend 一键启动
```

## 常用命令

### 后端（`backend/`）

```bash
# 安装依赖（二选一）
pip install -e ".[dev]"
uv sync                                    # README 推荐使用

# 启动开发服务器（要求 OLLAMA_HOST 可达）
uvicorn app.main:app --reload --port 8000  # Swagger 文档：/docs

# 测试（pytest-asyncio 已配置为 auto 模式）
pytest                                     # 全部测试
pytest tests/test_agent.py                 # 单文件
pytest tests/test_agent.py::test_retry_on_invalid_json_then_success  # 单个测试

# 代码检查 / 类型检查（已配置但未在脚本中暴露）
ruff check .
mypy app
```

### 前端（`frontend/`）

```bash
pnpm install        # 或 npm install
pnpm dev            # http://localhost:3000
pnpm build
pnpm lint           # next lint（基于 eslint-config-next）
```

### Docker 一键启动

```bash
cp .env.example .env
docker compose up --build
docker exec -it resume-analyse-ollama ollama pull qwen2.5:7b   # 首次必须拉模型
```

### 启动前自检（排错首选）

- `curl http://localhost:8000/health` —— 后端进程存活
- `curl http://localhost:8000/health/ollama` —— Ollama 可达性 + 已安装模型列表。**此接口失败时整个分析流水线无法工作**，调试 `app/agent/` 之前应先确认这个。

## 后端架构（核心）

最关键的逻辑在 `backend/app/agent/`，是一条**两步式 Agent 流水线**，每个分析端点都会调用：

1. **`extract_structured`**（`pipeline.py`）—— 简历原文 → `StructuredResume`（Pydantic）。调用 Ollama 时强制 `format='json'`，配合 `prompts.EXTRACT_SYSTEM`。
2. **`analyze_suggestions`** 与 **`analyze_interview_questions`** —— 二者共用同一份 `StructuredResume`，分别产出 `SuggestionsResult` / `InterviewQuestionsResult`。

修改这块代码时，必须遵守的几条约束：

- **所有 LLM 调用都必须经过 `_chat_json_with_retry`**：当 `OllamaClient.chat_json` 抛出 `ValueError`（JSON 解析失败）时，最多重试 `MAX_RETRIES`（当前为 2）次。新增可重试错误时也加在这里，不要绕过。
- **`_coerce_items` 同时兼容两种返回形态**：`{"items": [...]}` 和裸数组 `[...]`。本地模型行为不一致——`test_agent.py` 中两种形态都有覆盖。无效条目**静默丢弃**（仅 DEBUG 日志），不抛异常，请保留这个契约。
- **校验是尽力而为，不是严格的**：`extract_structured` 在校验失败时会回退成空的 `StructuredResume()`，让下游步骤仍能运行。如果要收紧校验，必须同时更新 suggestions / interview 的提示词以处理空输入。
- **提示词在 `prompts.py` 中集中管理**，与流水线代码分离，调优提示词时不需要改逻辑代码。三个 system prompt 都强制要求"只输出 JSON"，配合 `format='json'` 使用。
- **`OllamaClient` 是懒加载单例**（`ollama_client.py` 中的 `get_client()`）—— 首次使用时才实例化，避免 import 期就锁定 event loop。测试通过 `client=` 参数注入桩对象（见 `test_agent.py` 的 `FakeOllama`）。

## API 接口

### `backend/app/api/resume.py`

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/resume/upload` | `multipart/form-data` 上传 PDF/DOCX/TXT/MD，返回 `resume_id` |
| GET  | `/api/resume/{id}` | 取回解析后的纯文本 |
| GET  | `/api/resume/_meta/supported` | 列出支持的文件扩展名 |

### `backend/app/api/analysis.py`

所有端点以 `resume_id` 为 key：

- **`POST /{id}/suggestions`**、**`POST /{id}/interview-questions`** —— 同步端点，**会先查 `store.get_analysis` 缓存**，命中则直接返回，不重跑流水线。
- **`POST /{id}/full`** —— **NDJSON 流式端点**。每行一个 JSON：`extract:start` → `extract:done` → `suggestions:done`（带数据）→ `interview:done`（带数据）→ `all:done`，过程中出错会发 `error` 事件。流式端点**每完成一个阶段都会写缓存**。前端 `streamFullAnalysis`（`lib/api.ts`）是它唯一的消费者—— **修改事件名必须前后端同步**。

### `backend/app/api/health.py`

- `/health` —— 进程存活检查
- `/health/ollama` —— 调用 `${OLLAMA_HOST}/api/tags`，返回 Ollama 状态和可用模型列表

## 存储层（`backend/app/services/storage.py`）

模块级 `_Store` 单例，用 `RLock` 保护两个 dict：`resume_id → ParsedResume`、`resume_id → {kind: result}`。**仅适用于 MVP**：重启即丢失，多 worker 之间不共享。README 路线图里 Postgres 是替换目标；要换实现时，对外只有 `store` 这一个导入面。

## 前端架构（`frontend/`）

- **App Router 页面**：
  - `app/page.tsx` —— 上传页
  - `app/analyze/[id]/page.tsx` —— 分析结果页。先拉取简历元数据，再调用 `streamFullAnalysis`，把流式事件归约成本地 state 渲染
- **`lib/api.ts`** —— 后端的类型化封装。**这里所有 TS 类型必须与后端 `backend/app/schemas/analysis.py` 的 Pydantic schema 一一对应**，改一个就要改另一个。
- **`components/ui/*`** —— shadcn/ui 基础组件（`components.json` 是 shadcn 配置文件）。业务组件（`ResumeUploader`、`SuggestionCard`、`InterviewQuestionList`、`AnalysisSkeleton`）放在同级目录。
- API 基地址来自 `NEXT_PUBLIC_API_BASE_URL`（默认 `http://localhost:8000`）。

## 环境变量

后端 `backend/.env`（拷贝自 `.env.example`）—— 通过 `pydantic-settings` 在 `backend/app/config.py` 加载，`get_settings()` 是 `@lru_cache` 单例，**改了配置必须重启进程才生效**。

| 变量 | 默认 | 说明 |
|---|---|---|
| `OLLAMA_HOST` | `http://localhost:11434` | Ollama 服务地址 |
| `OLLAMA_MODEL` | `qwen2.5:7b` | 使用的模型 |
| `OLLAMA_TIMEOUT` | `120` | 单次调用超时（秒） |
| `CORS_ORIGINS` | `http://localhost:3000` | 允许的前端来源（逗号分隔） |
| `MAX_UPLOAD_MB` | `10` | 上传文件大小上限 |

前端 `frontend/.env.local`：

| 变量 | 默认 | 说明 |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:8000` | 后端 API 地址 |

## 文件解析（`backend/app/services/parser.py`）

支持的扩展名：`.pdf`、`.docx`、`.txt`、`.md`。

- **PDF**：使用 `pypdf`，逐页 `extract_text()`。**单页解析失败会被吞掉**（`continue`），保证其余页仍能加载——这是有意为之的"软失败"，不要改成硬抛异常。
- **DOCX**：使用 `python-docx`，先抽段落、再把表格按 `cell | cell` 展开（很多简历用表格排版）。
- **TXT/MD**：直接 `decode('utf-8', errors='ignore')`。
- 不支持的扩展名抛 `UnsupportedFileType`，路由层翻译成 415。

## 项目约定（写代码时请遵守）

- **中英双语内容**：提示词与界面文案中英混用；提示词中明确指示模型"匹配简历的语言"。**不要强制把字符串单语化**（中文简历就出中文建议，英文简历就出英文建议）。
- **`from __future__ import annotations`** 在所有后端模块顶部都有——新文件请保持，确保 3.11 上类型注解的统一行为。
- **`# noqa: BLE001`** 是有意保留的：用在 I/O 与流水线边界（PDF 单页解析、流式生成器、路由 handler 等）。它们把硬失败转换成结构化的 502 或跳过——**改成窄异常前请想清楚部分失败的语义**。
- **Ruff** 配置（`line-length = 100`，`target-version = "py311"`），但没有挂 commit hook —— 提交前手动 `ruff check .`。
- **前端没有测试栈**；后端测试用手写的 `FakeOllama` 而非 mock 库——新增测试时请沿用这个模式。

## 调试常见问题

- **流式分析卡在 `extract:start`**：先看 `/health/ollama`；多半是模型没拉下来或 `OLLAMA_HOST` 不通。
- **返回的建议条数偶尔是 0**：模型把 JSON 输出成了奇怪结构，被 `_coerce_items` 静默过滤了。打开 `pipeline` 模块的 DEBUG 日志能看到被丢弃的条目。
- **重复请求很慢**：`/suggestions` 与 `/interview-questions` 有 store 缓存，但 `/full` 每次都会跑（虽然它每段也写缓存）；如果只看一个维度就别用 `/full`。
- **重启后简历找不到了**：`store` 是内存里的，**这是已知行为**，不是 bug——见上文"存储层"。

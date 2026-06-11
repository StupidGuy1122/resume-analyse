# resume-analyse

> 智能简历分析网页 — 上传简历后，由本地大模型给出**改进建议**和**面试题预测**。数据全程不离开你的机器。

```
┌───────────────────────────────┐    ┌───────────────────────┐    ┌────────────────────┐
│  Next.js 14 + Tailwind +      │ ↔  │  FastAPI (Python 3.11)│ ↔  │  Ollama (本地模型)  │
│  shadcn/ui  (frontend/)       │    │  (backend/)           │    │  qwen2.5:7b 等      │
└───────────────────────────────┘    └───────────────────────┘    └────────────────────┘
```

## 功能特性

- **拖拽上传**：PDF / DOCX / TXT / MD，自动解析为纯文本
- **结构化抽取**：先把简历变成 JSON（教育 / 工作 / 项目 / 技能）
- **改进建议**：按优先级输出原文 → 建议 → 改写理由
- **面试题预测**：按难度（简单 / 中等 / 困难）分组，附答题提示
- **流式渲染**：后端用 NDJSON 逐阶段推送，前端边出边渲染
- **隐私优先**：通过 Ollama 调用本地模型，简历不出本机

## 目录结构

```
resume-analyse/
├── backend/            # FastAPI 后端 + Agent
│   ├── app/
│   │   ├── api/        # health / resume / analysis 路由
│   │   ├── agent/      # ollama_client, prompts, pipeline
│   │   ├── services/   # parser, storage
│   │   └── schemas/    # Pydantic 模型
│   └── tests/
├── frontend/           # Next.js 14 (App Router) 前端
│   ├── app/            # / 和 /analyze/[id]
│   ├── components/     # ui/* + 业务组件
│   └── lib/            # API 客户端
└── docker-compose.yml  # 一键拉起 ollama + backend + frontend
```

## 快速启动

### 0. 准备 Ollama

```bash
# 安装：见 https://ollama.com
ollama serve &                  # 启动服务
ollama pull qwen2.5:7b          # 拉取默认模型（中文友好，约 4.7 GB）
# 也可换 llama3.1:8b / qwen2.5:14b 等
```

### 1. 启动后端

```bash
cd backend
cp .env.example .env             # 按需修改 OLLAMA_HOST / OLLAMA_MODEL
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"          # 或：uv sync（推荐）
uvicorn app.main:app --reload --port 8000
```

打开 http://localhost:8000/docs 看到 Swagger UI。
检查 Ollama 连通性：`curl http://localhost:8000/health/ollama`

### 2. 启动前端

```bash
cd frontend
cp .env.local.example .env.local
pnpm install                     # 或 npm install
pnpm dev
```

打开 http://localhost:3000，拖一份简历上去试试。

### Docker 一键启动

```bash
cp .env.example .env
docker compose up --build
# 还需进入 ollama 容器拉模型：
docker exec -it resume-analyse-ollama ollama pull qwen2.5:7b
```

## API 速览

| 方法 | 路径 | 说明 |
|---|---|---|
| GET  | `/health` | 进程健康 |
| GET  | `/health/ollama` | Ollama 可达性与模型清单 |
| POST | `/api/resume/upload` | `multipart/form-data` 上传简历，返回 `resume_id` |
| GET  | `/api/resume/{id}` | 取回解析后的纯文本 |
| POST | `/api/analysis/{id}/suggestions` | 同步返回改进建议 |
| POST | `/api/analysis/{id}/interview-questions` | 同步返回面试题 |
| POST | `/api/analysis/{id}/full` | NDJSON 流式返回全部分析事件 |

## 测试

```bash
cd backend
pytest                           # 包含 mock Ollama 的 pipeline 测试
```

## 配置项

后端 `backend/.env`：

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

## 路线图（不在 MVP 内）

- 用户系统、登录鉴权
- 数据持久化（PostgreSQL + 历史记录）
- JD 输入 → 岗位匹配度评分
- 多语言简历自动识别
- 导出分析报告 PDF

## 许可

MIT

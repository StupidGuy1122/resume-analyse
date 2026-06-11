# resume-analyse

> 智能简历分析网页 — 上传简历后，由本地大模型给出**改进建议**和**面试题预测**。数据全程不离开你的机器。

```
┌───────────────────────────────┐    ┌───────────────────────┐    ┌────────────────────┐
│  Next.js 14 + Tailwind +      │ ↔  │  FastAPI (Python 3.11+)│ ↔ │  Ollama (本地模型)  │
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

---

## Windows 本地启动教程（推荐）

> 本节是这台机器上**已验证可跑通**的步骤，包括 NVIDIA GPU 加速、Python 3.14、pnpm 等实战中会踩的坑。Linux/macOS 用户参考最下方的"通用启动"小节。

### 0. 环境要求

| 工具 | 最低版本 | 实测版本 | 备注 |
|---|---|---|---|
| Windows | 10/11 | Windows 11 | — |
| Python | 3.11 | 3.14.5 也能跑 | 3.14 上所有依赖都有预编译 wheel |
| Node.js | 18+ | 24.16.0 | — |
| pnpm | 任意 | 11.5.3 | `npm install -g pnpm` |
| Ollama | 0.5.4+ | 0.30.7 | RTX 50 系（Blackwell）需要 ≥ 0.5.4 |
| NVIDIA 驱动 | 较新即可 | 596.49 | 可选，但强烈建议有 GPU |

### 1. 安装 Ollama

去 <https://ollama.com/download/windows> 下载安装包，双击安装。安装完成后：

- Ollama 服务会**自动后台启动**（监听 `localhost:11434`）
- `ollama` 命令会自动加到 PATH
- 验证：在新开的 PowerShell / Git Bash 里运行 `ollama --version`

### 2. 选择并拉取模型

模型选择参考（按显存大小）：

| 显存 | 推荐模型 | 大小 | 中文表现 |
|---|---|---|---|
| 8 GB（如 RTX 5060/4060/3070） | **qwen2.5:7b** ⭐ | 4.7 GB | 优秀 |
| 12 GB（如 RTX 4070/3080） | qwen2.5:14b | 9 GB | 更优秀 |
| 16+ GB | qwen2.5:14b 或 qwen2.5:32b | 9 / 20 GB | — |
| 无独显（纯 CPU） | qwen2.5:7b | 4.7 GB | 可用，速度慢 |

> ⚠️ **不要超出显存大小**：14b 在 8 GB 卡上会溢出到 CPU，反而比 7b 慢得多。

```powershell
# 拉模型（约 4.7 GB，根据网速 2~5 分钟）
ollama pull qwen2.5:7b

# 验证模型可用
ollama list
```

### 3. 准备配置文件

```powershell
# 在项目根目录
cd D:\PythonProject\resume-analyse

# 后端配置
copy backend\.env.example backend\.env

# 前端配置
copy frontend\.env.local.example frontend\.env.local
```

默认配置已经能直接用，**无需修改**。如果 Ollama 不在本机或要换模型，再编辑 `backend\.env` 中的 `OLLAMA_HOST` / `OLLAMA_MODEL`。

### 4. 安装并启动后端

```powershell
cd D:\PythonProject\resume-analyse\backend

# 创建虚拟环境（用 .venv 隔离，避免污染全局 Python）
python -m venv .venv

# 安装依赖（包括开发依赖：pytest / ruff / mypy）
.venv\Scripts\python.exe -m pip install --upgrade pip
.venv\Scripts\python.exe -m pip install -e ".[dev]"

# 跑一下测试，确认环境完好（应输出 9 passed）
.venv\Scripts\python.exe -m pytest -q

# 启动开发服务器
.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

启动成功的标志：终端打印 `Uvicorn running on http://127.0.0.1:8000`。

**自检接口**（另开一个终端）：

```powershell
# 后端进程存活
curl http://127.0.0.1:8000/health
# {"status":"ok"}

# Ollama 可达 + 模型清单
curl http://127.0.0.1:8000/health/ollama
# {"status":"ok","host":"http://localhost:11434","model":"qwen2.5:7b","available_models":["qwen2.5:7b"]}
```

如果 `/health/ollama` 返回 `unreachable`，先去 Ollama 那一步排错——**这个接口不通的话，整套分析流水线都不会工作**。

### 5. 安装并启动前端

```powershell
cd D:\PythonProject\resume-analyse\frontend

pnpm install

# ⚠️ 关键一步：批准 unrs-resolver 的构建脚本，否则 pnpm dev 会失败
pnpm approve-builds --all

# 启动开发服务器
pnpm dev
```

启动成功的标志：终端打印 `✓ Ready in X.Xs` 和 `Local: http://localhost:3000`。

> **为什么要 `pnpm approve-builds`**：Next.js 的依赖 `unrs-resolver` 有原生构建脚本，pnpm 默认会忽略并报告 `[ERR_PNPM_IGNORED_BUILDS]`；下次 `pnpm dev` 启动前的依赖一致性检查会因此报错并退出。批准一次即可，配置写入 `node_modules/.modules.yaml`。

### 6. 验证全链路

打开浏览器访问 **http://localhost:3000**，拖一份简历上去——上传成功后会跳到 `/analyze/{id}`，看着流式分析结果一段段冒出来。

如果想确认 GPU 真的被用上了，发起分析后另开终端：

```powershell
nvidia-smi --query-gpu=name,memory.used,memory.total --format=csv
# 应该看到 7000+ MiB 显存被占用，进程列表里会有 llama-server.exe
```

---

## 日常启动（每次重启电脑后）

### 推荐：一键脚本（在 Git Bash 里跑）

项目根目录有个 `start.sh`，**用 Git Bash 打开它所在目录，运行：**

```bash
./start.sh
```

它会：
1. 强制 kill 掉 8000 / 3000 端口上的旧进程（解决 Next.js 漂到 3001 那个坑）
2. 检查 Ollama 是否在跑
3. 后台启动后端，等 `/health` 返回 200 才继续
4. 前台启动前端，**日志直接打在你这个终端里**
5. 浏览器自动打开 http://localhost:3000

**停止：直接 `Ctrl+C`** —— 前端立即停，脚本的 EXIT trap 会顺手把后端也清掉。如果哪次清不彻底（端口还被占着），跑一下 `./stop.sh` 强制清理。

后端日志写在 `.logs/backend.log`，分析失败时去这里看堆栈。

> **为什么不直接 `pnpm dev`**：3000 端口被占时，Next.js 会偷偷漂到 3001，但后端 `CORS_ORIGINS` 只允许 3000，分析就会失败。脚本会先强制清理端口，避免这个坑。

### 手动启动

如果不用脚本，分别开两个终端：

```powershell
# 终端 1：后端
cd D:\PythonProject\resume-analyse\backend
.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000

# 终端 2：前端
cd D:\PythonProject\resume-analyse\frontend
pnpm exec next dev -p 3000
```

> 用 `pnpm exec next dev -p 3000` 而不是 `pnpm dev`：显式指定端口，被占就硬报错，绝不漂到 3001。

Ollama 服务在 Windows 上是开机自动启动的，不需要手动起。如果发现 `/health/ollama` 不通，去任务栏托盘里看 Ollama 图标是否在跑，或在终端里执行 `ollama serve` 手动启动。

---

## 通用启动（Linux / macOS / Docker）

### Linux / macOS

```bash
# 0. Ollama
ollama serve &
ollama pull qwen2.5:7b

# 1. 后端
cd backend
cp .env.example .env
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"          # 或：uv sync（推荐）
uvicorn app.main:app --reload --port 8000

# 2. 前端
cd frontend
cp .env.local.example .env.local
pnpm install
pnpm approve-builds --all
pnpm dev
```

### Docker 一键启动

```bash
cp .env.example .env
docker compose up --build
# 还需进入 ollama 容器拉模型：
docker exec -it resume-analyse-ollama ollama pull qwen2.5:7b
```

---

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

完整 Swagger UI：<http://localhost:8000/docs>

## 测试

```powershell
cd backend
.venv\Scripts\python.exe -m pytest -q   # 9 个测试，全部用 mock Ollama，无需真实模型
```

## 配置项

后端 `backend/.env`：

| 变量 | 默认 | 说明 |
|---|---|---|
| `OLLAMA_HOST` | `http://localhost:11434` | Ollama 服务地址 |
| `OLLAMA_MODEL` | `qwen2.5:7b` | 使用的模型（改这里要先 `ollama pull` 对应模型，再重启后端） |
| `OLLAMA_TIMEOUT` | `120` | 单次调用超时（秒） |
| `CORS_ORIGINS` | `http://localhost:3000` | 允许的前端来源（逗号分隔） |
| `MAX_UPLOAD_MB` | `10` | 上传文件大小上限 |

前端 `frontend/.env.local`：

| 变量 | 默认 | 说明 |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:8000` | 后端 API 地址 |

> ⚠️ 后端配置是 `@lru_cache` 缓存的——**改了 `.env` 必须重启 uvicorn 才会生效**。

---

## 常见问题

### Ollama 相关

**`/health/ollama` 返回 `unreachable`**

- 先在终端执行 `ollama list` 看 Ollama 进程是否在跑
- 任务栏托盘里看是否有 Ollama 图标；没有的话执行 `ollama serve`
- 如果你改过 `OLLAMA_HOST`，确认地址和端口对得上

**模型加载到了 CPU 而不是 GPU**

- 显存不够：换更小的模型（如从 14b 换成 7b）
- Ollama 版本太旧：RTX 50 系（Blackwell）需要 0.5.4+，重新去官网下载升级
- 在分析进行中执行 `nvidia-smi`，进程列表里没有 `llama-server.exe`，说明走的是 CPU

**首次分析很慢，第二次就快了**

- 正常现象。第一次调用包含模型从硬盘加载到显存的时间（约 30~60 秒）；后续调用模型常驻，只跑推理。

### Python 相关

**`pip install` 报错"找不到 wheel"或编译失败**

- 多半是 Python 版本太老（< 3.11）。pyproject.toml 要求 `>=3.11`
- 也可能是太新的版本（如 3.14）暂时还没编译——本项目实测 3.14.5 上所有依赖都有 wheel，但更新的版本就不一定了

**`uvicorn` 启动报"端口被占用"**

- 上次的进程没退干净。Windows 下：`netstat -ano | findstr :8000` 找到 PID，然后 `taskkill /PID <pid> /F`

### 前端相关

**`pnpm dev` 一启动就退出，报 `[ERR_PNPM_IGNORED_BUILDS]`**

- 见上文第 5 步：执行 `pnpm approve-builds --all`

**前端能打开但分析转圈不动**

- 浏览器开 DevTools → Network，看 `/api/analysis/.../full` 这个请求的 NDJSON 流是否在持续返回事件
- 如果 `error` 事件携带 "Agent failure"，去后端终端看完整堆栈

### 数据持久化

**重启服务后简历找不到了**

- 这是已知行为：MVP 版本所有数据都在进程内存里（见 `backend/app/services/storage.py`），重启即丢
- 路线图里 PostgreSQL 是替换目标，需要持久化时再做

---

## 路线图（不在 MVP 内）

- 用户系统、登录鉴权
- 数据持久化（PostgreSQL + 历史记录）
- JD 输入 → 岗位匹配度评分
- 多语言简历自动识别
- 导出分析报告 PDF

## 许可

MIT

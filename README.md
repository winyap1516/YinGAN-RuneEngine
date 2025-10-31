## 快速开始

1. 安装依赖与启动服务
   - 在项目根目录执行：
     - `npm install`
     - `npm run proxy` （启动本地代理，默认 `http://localhost:3000`）
     - 另开终端执行 `npm run start` （或保持已启动的 Python `http.server 8000`）

2. 配置环境变量
   - 在项目根目录的 `.env` 写入：
     - `OPENAI_API_KEY=sk-...`（真实密钥，不要加引号）
     - `PORT=3000`

3. 在页面中选择向量提供方
   - 打开 `http://localhost:8000/`，下拉框选择 `OpenAI（代理）`

## 模块说明

- `api/openai.js`：Node 代理层，将前端请求转发到 OpenAI。
- `ai-understanding.js`：AI 理解层封装，统一提供：
  - 语义理解：`window.AI.aiUnderstandRune(runeData)`
  - 文本向量：`window.AI.generateEmbedding(text)`
  - 音频转写（占位）：`window.AI.transcribeAudio(file)`

## 测试流程

1. 在页面选择文件（文本/图片/音频），填写名称与描述。
2. 点击生成（Generate）：
   - 观察状态栏 `progressText`：会显示“使用 OpenAI 生成文本向量…”、“AI 正在理解符文语义…”等状态。
   - 生成完成后，九宫格核心区应填充：`intent`、`essence`、`purpose`、`emotion`、`summary`。
3. 符文会保存到本地库（localStorage）。

## 常见问题

- 401/403：检查 `.env` 的 `OPENAI_API_KEY` 是否正确，重启代理后生效。
- 404/网络错误：确保 `ai-understanding.js` 的 `API_BASE` 指向 `http://localhost:3000/api/openai`，代理已启动。
- 返回非 JSON：模块自动回退到 `simpleTextUnderstanding`，流程不中断。

## 模型建议

- 语义理解：`gpt-4o-mini`（快且便宜），深度分析可用 `gpt-4o`
- 向量生成：`text-embedding-3-small`
- 音频转写：`whisper-1`（待代理端点补齐）
- 图片生成：`gpt-image-1`

## 安全建议

- 不要在前端代码中包含 `sk-...` 密钥。
- 推荐通过 `.env` 或 IDE 集成面板进行配置。
- 调用较多时，建议在代理层加入节流与重试。

## Project Structure 项目结构

```
YinGAN-RuneEngine/
├── index.html
├── js/
│   ├── ai-understanding.js
│   ├── auto-rune-generator.js
│   ├── main.js
│   └── rune-structure.js
├── utils/
│   └── logger.js
├── style.css
├── api/
│   └── ...
├── scripts/
│   └── ...
└── README.md
```

## Flow Overview 运行逻辑流程

1. **index.html** – Loads UI assets and registers global scripts before `DOMContentLoaded`（在 `DOMContentLoaded` 前加载核心脚本，确保 `window.AI` 可用）。
2. **window.AI** – `js/ai-understanding.js` exposes AI helpers that handle semantic analysis, embeddings, and media understanding（`js/ai-understanding.js` 提供语义理解、向量与多模态解析）。
3. **Auto rune generation** – `js/main.js` 调用 `js/auto-rune-generator.js`，根据用户上传文件和描述生成九转符文结构（`js/main.js` triggers `autoRuneGenerator`）。
4. **Workspace save** – The workspace manager persists runes and media into the configured workspace folder or triggers a download fallback（工作区管理器保存符文及媒体，或在浏览器中触发下载）。

## Environment Variables 环境变量

| Name | Description (English) | 说明（中文） |
| --- | --- | --- |
| `API_BASE` | Base URL for the proxy that forwards AI requests. | AI 代理服务的基础地址，用于转发模型调用。 |
| `MODEL_NAME` | Preferred model identifier for rune understanding. | 符文理解所使用的模型名称。 |

## Usage Tips 使用提示

- Run `npm run proxy` to start the local proxy that forwards AI requests（执行 `npm run proxy` 启动本地代理）。
- Run `npm run start` to serve the front-end or reuse an existing static server（执行 `npm run start` 或使用已有的静态服务器启动前端）。
- Visit `http://localhost:8000/` after both processes are running to interact with the Rune Engine UI（在两个服务启动后访问 `http://localhost:8000/` 体验 Rune Engine 界面）。


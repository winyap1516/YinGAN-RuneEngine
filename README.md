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
import express from 'express';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import multer from 'multer';
import FormData from 'form-data';
dotenv.config();

const app = express();
app.use(express.json({ limit: '2mb' }));
// 基础请求/响应日志
app.use((req, res, next) => {
  const start = Date.now();
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress;
  console.log(`[REQ] ${req.method} ${req.originalUrl} from ${ip || 'unknown'}`);
  res.on('finish', () => {
    const ms = Date.now() - start;
    console.log(`[RES] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${ms}ms)`);
  });
  next();
});
// CORS 支持
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Chat Completions 代理
app.post('/api/openai', async (req, res) => {
  try {
    console.log('[Proxy] /api/openai → chat/completions');
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify(req.body)
    });
    console.log(`[Proxy] OpenAI status: ${r.status}`);
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (err) {
    console.error('[Error] /api/openai:', err);
    res.status(500).json({ error: String(err) });
  }
});

// Embeddings 代理
app.post('/api/openai/embeddings', async (req, res) => {
  try {
    console.log('[Proxy] /api/openai/embeddings → embeddings');
    const r = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify(req.body)
    });
    console.log(`[Proxy] OpenAI status: ${r.status}`);
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (err) {
    console.error('[Error] /api/openai/embeddings:', err);
    res.status(500).json({ error: String(err) });
  }
});

// 音频转写端点（Whisper API），支持multipart/form-data
// 前端需要以form-data字段名 'file' 传音频文件，'model'可选（默认'whisper-1'）
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
app.post('/api/openai/audio/transcriptions', upload.single('file'), async (req, res) => {
  try {
    console.log('[Proxy] /api/openai/audio/transcriptions → whisper');
    if (!req.file) {
      console.warn('[Warn] 未提供音频文件file');
      return res.status(400).json({ error: '未提供音频文件file' });
    }
    const model = req.body.model || 'whisper-1';
    const form = new FormData();
    form.append('file', req.file.buffer, { filename: req.file.originalname || 'audio.wav', contentType: req.file.mimetype || 'audio/wav' });
    form.append('model', model);
    if (req.body.prompt) form.append('prompt', req.body.prompt);
    if (req.body.language) form.append('language', req.body.language);

    const r = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        ...form.getHeaders()
      },
      body: form
    });
    console.log(`[Proxy] OpenAI status: ${r.status}`);
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (err) {
    console.error('[Error] /api/openai/audio/transcriptions:', err);
    res.status(500).json({ error: String(err) });
  }
});

// 图片理解端点（GPT-4o / gpt-4-vision-preview兼容），传入图像URL或Base64
// 前端以JSON传递：{ model, messages }，messages中包含{"role":"user","content":[{"type":"text","text":"描述"},{"type":"image_url","image_url":{"url":"..."}}]}
app.post('/api/openai/vision', async (req, res) => {
  try {
    console.log('[Proxy] /api/openai/vision → chat/completions (vision)');
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify(req.body)
    });
    console.log(`[Proxy] OpenAI status: ${r.status}`);
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (err) {
    console.error('[Error] /api/openai/vision:', err);
    res.status(500).json({ error: String(err) });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`OpenAI Proxy running on http://localhost:${PORT}`));

// 全局错误监控
process.on('unhandledRejection', (err) => {
  console.error('[unhandledRejection]', err);
});
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
});
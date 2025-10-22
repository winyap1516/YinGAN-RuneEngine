// Gemini 代理服务（Express）
// 说明：
// - 提供 /api/gemini 相关端点，转发到 Google Generative Language API
// - 使用 REST 方式调用，避免在前端暴露 GEMINI_API_KEY
// - 支持文本生成、向量嵌入、图片理解（URL或Base64）、音频转写（提示转写）
// - 所有代码均附中文注释，便于理解与维护

import express from 'express';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import multer from 'multer';

dotenv.config();

const app = express();
app.use(express.json({ limit: '4mb' }));

// 基础请求/响应日志，便于排查
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

// Gemini REST 基础配置
const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.warn('警告：未配置 GEMINI_API_KEY，Gemini 代理将返回 401');
}

// 文本生成（类似 chat）
// 支持两种请求体：
// 1) 直接传 { model, contents }（Gemini 原生格式）
// 2) 传 { model, messages }（OpenAI 风格），本端转为 contents
app.post('/api/gemini/generate', async (req, res) => {
  try {
    const { model = 'gemini-2.5-flash', contents, messages } = req.body || {};
    let reqBody;
    if (Array.isArray(contents) && contents.length > 0) {
      // 已按 Gemini 原生格式
      reqBody = { contents };
    } else if (Array.isArray(messages)) {
      // 从 OpenAI 风格 messages 转为 Gemini contents
      // 仅处理简单的 text、image_url 两类内容
      const parts = [];
      for (const m of messages) {
        if (m.role === 'system' && m.content) {
          parts.push({ text: String(m.content) });
        } else if (m.role === 'user') {
          if (Array.isArray(m.content)) {
            for (const c of m.content) {
              if (c.type === 'text' && c.text) parts.push({ text: String(c.text) });
              if (c.type === 'image_url' && c.image_url?.url) {
                const url = c.image_url.url;
                const { data, mime } = await fetchAsBase64(url);
                parts.push({ inline_data: { data, mime_type: mime } });
              }
            }
          } else if (m.content) {
            parts.push({ text: String(m.content) });
          }
        }
      }
      reqBody = { contents: [{ parts }] };
    } else {
      return res.status(400).json({ error: '缺少 contents 或 messages' });
    }

    const url = `${GEMINI_ENDPOINT}/models/${encodeURIComponent(model)}:generateContent`;
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': GEMINI_API_KEY || ''
      },
      body: JSON.stringify(reqBody)
    });
    const data = await r.json();
    return res.status(r.status).json(data);
  } catch (err) {
    console.error('[Error] /api/gemini/generate:', err);
    return res.status(500).json({ error: String(err) });
  }
});

// 文本向量嵌入
// 接收 { text } 或 { content: { parts: [{ text }] } }，返回 embeddings
app.post('/api/gemini/embeddings', async (req, res) => {
  try {
    const { text, content } = req.body || {};
    const model = 'text-embedding-004';
    const body = content && content.parts ? { content } : { content: { parts: [{ text: String(text || '') }] } };
    const url = `${GEMINI_ENDPOINT}/models/${model}:embedContent`;
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': GEMINI_API_KEY || ''
      },
      body: JSON.stringify(body)
    });
    const data = await r.json();
    return res.status(r.status).json(data);
  } catch (err) {
    console.error('[Error] /api/gemini/embeddings:', err);
    return res.status(500).json({ error: String(err) });
  }
});

// 图片理解（URL 或 Base64）
// 接受 { model, messages }（含 image_url 或 base64），或 { contents }
app.post('/api/gemini/vision', async (req, res) => {
  try {
    const { model = 'gemini-2.5-flash', contents, messages } = req.body || {};
    let reqBody;
    if (Array.isArray(contents)) {
      reqBody = { contents };
    } else if (Array.isArray(messages)) {
      const parts = [];
      for (const m of messages) {
        if (m.role === 'system' && m.content) parts.push({ text: String(m.content) });
        if (m.role === 'user') {
          if (Array.isArray(m.content)) {
            for (const c of m.content) {
              if (c.type === 'text' && c.text) parts.push({ text: String(c.text) });
              if (c.type === 'image_url' && c.image_url?.url) {
                const url = c.image_url.url;
                const { data, mime } = await fetchAsBase64(url);
                parts.push({ inline_data: { data, mime_type: mime } });
              }
              if (c.type === 'image_base64' && c.base64 && c.mime) {
                parts.push({ inline_data: { data: c.base64, mime_type: c.mime } });
              }
            }
          }
        }
      }
      reqBody = { contents: [{ parts }] };
    } else {
      return res.status(400).json({ error: '缺少 contents 或 messages' });
    }
    const url = `${GEMINI_ENDPOINT}/models/${encodeURIComponent(model)}:generateContent`;
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': GEMINI_API_KEY || ''
      },
      body: JSON.stringify(reqBody)
    });
    const data = await r.json();
    return res.status(r.status).json(data);
  } catch (err) {
    console.error('[Error] /api/gemini/vision:', err);
    return res.status(500).json({ error: String(err) });
  }
});

// 音频转写（提示式）
// 使用 multipart/form-data 上传音频文件字段名 'file'，将音频作为 inline_data 传入 generateContent
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
app.post('/api/gemini/audio/transcriptions', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: '未提供音频文件file' });
    const model = req.body.model || 'gemini-2.5-flash';
    const prompt = req.body.prompt || '请将音频内容完整转写为中文文本，不要添加额外说明。';
    const base64 = req.file.buffer.toString('base64');
    const parts = [
      { text: prompt },
      { inline_data: { data: base64, mime_type: req.file.mimetype || 'audio/wav' } }
    ];
    const url = `${GEMINI_ENDPOINT}/models/${encodeURIComponent(model)}:generateContent`;
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': GEMINI_API_KEY || ''
      },
      body: JSON.stringify({ contents: [{ parts }] })
    });
    const data = await r.json();
    return res.status(r.status).json(data);
  } catch (err) {
    console.error('[Error] /api/gemini/audio/transcriptions:', err);
    return res.status(500).json({ error: String(err) });
  }
});

// 工具方法：拉取URL并转为Base64与MIME
async function fetchAsBase64(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`获取资源失败：${r.status}`);
  const buf = await r.buffer();
  const ext = (url.split('.').pop() || '').toLowerCase();
  const mime = ext.includes('png') ? 'image/png'
    : ext.includes('jpg') || ext.includes('jpeg') ? 'image/jpeg'
    : ext.includes('gif') ? 'image/gif'
    : 'application/octet-stream';
  return { data: buf.toString('base64'), mime };
}

// 全局错误监控
process.on('unhandledRejection', (err) => {
  console.error('[unhandledRejection]', err);
});
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Gemini Proxy running on http://localhost:${PORT}`))
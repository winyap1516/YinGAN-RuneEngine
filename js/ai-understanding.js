/*
 * AI 理解层模块（Solo 模式）
 * 说明：
 * - 提供统一的 AI 接口封装：语义理解、文本向量化、音频转写、图片理解
 * - 默认通过本地代理 /api/gemini 转发到 Google Gemini，避免在前端暴露密钥
 * - 自动降级：当代理不可用或返回异常时，使用简单规则法回退
 *
 * 使用：
 * - 在 index.html 中引入本脚本后，window.AI 将可用：
 *   window.AI.aiUnderstandRune(runeData)
 *   window.AI.generateEmbedding(text)
 *   window.AI.transcribeAudio(file)
 *   window.AI.analyzeImage({ imageUrl | dataUrl })
 */
(function(){
  // 将代理端口改为 3001，避免与静态服务器 (http-server) 冲突
  const API_BASE = 'http://localhost:3001/api/gemini';
  const CHAT_MODEL = 'gemini-2.5-flash';
  const EMBED_MODEL = 'text-embedding-004';

  /**
   * 从 Gemini/OpenAI 返回中提取纯文本；同时兼容错误消息
   * @param {object} data - 模型原始响应
   * @returns {string} 文本内容或错误描述
   */
  function extractText(data) {
    // 若服务返回错误对象，直接输出错误信息，便于定位
    if (data?.error?.message) {
      return String(data.error.message);
    }
    // OpenAI 风格
    const openai = data?.choices?.[0]?.message?.content;
    if (openai) return String(openai);
    // Gemini generateContent 风格
    const parts = data?.candidates?.[0]?.content?.parts;
    if (Array.isArray(parts)) {
      return parts.map(p => p?.text || '').filter(Boolean).join('\n');
    }
    // 兜底
    return '';
  }

  /**
   * Interpret rune content by calling the proxy service and returning a nine-turn schema.
   * Falls back to lightweight heuristics when the remote model fails.
   * @param {object} runeData - Partial rune payload containing text and media summaries.
   * @returns {Promise<object>} Semantic structure describing the rune.
   */
    async function aiUnderstandRune(runeData) {
    // 中文说明：按新版九转语义系统返回完整结构，严格JSON；失败时构造降级结构。
    try {
      const name = runeData?.name || '未命名符文';
      const inputContent = {
        text: runeData?.nineGrid?.content?.text || '',
        imageDesc: runeData?.nineGrid?.content?.imageDesc || '',
        audioText: runeData?.nineGrid?.content?.audioText || '',
        videoSummary: runeData?.nineGrid?.content?.videoSummary || '',
        videoFrame: runeData?.nineGrid?.content?.videoFrame || ''
      };
      const combinedText = [inputContent.text, inputContent.imageDesc, inputContent.audioText, inputContent.videoSummary]
        .filter(Boolean).join('\n');
      console.log('🧩 AI理解输入长度:', combinedText.length);

      const prompt = `你是 YinGAN OS 的符文生成智能体（Rune Builder Agent）。\n` +
        `请基于以下内容生成\n严格JSON（可被 JSON.parse 解析），字段完整，顺序与示例一致：\n` +
        `内容：\n${String(combinedText).slice(0, 1200)}\n` +
        `示例结构：\n` +
        `{"rune_name":"符文名称","category":"符文类别","core":{"intent":"","essence":"","purpose":""},"content":{"text":"","imageDesc":"","audioText":"","videoSummary":"","videoFrame":""},"metadata":{"language":"中文","emotion":"","keywords":["a","b","c"],"summary":"","prompt":"","_fallback":false},"nine_turns":{"1_origin":"","2_form":"","3_name":"","4_meaning":"","5_function":"","6_action":"","7_tone":"","8_structure":{"modalities":["text","image","audio","video"],"embedding_type":"text-embedding-004","dimension":768},"9_evolution":{"version":"1.0","update_logic":"当符文语义更新时自动重生"}},"context":{"source":"模态融合","references":[],"relations":[]},"status":{"parsed":true,"processed":true,"validated":true}}`;

      const doRequest = async () => {
        const r = await fetch(`${API_BASE}/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: CHAT_MODEL,
            messages: [
              { role: 'system', content: '严格JSON输出，不要任何解释。' },
              { role: 'user', content: prompt }
            ]
          })
        });
        const body = await r.text();
        let data;
        try { data = JSON.parse(body); } catch { data = { raw: body }; }
        return { ok: r.ok, status: r.status, data };
      };

      let resp = await doRequest();
      if (!resp.ok) {
        console.warn('⚠️ 首次调用失败，状态码:', resp.status);
        await new Promise(r => setTimeout(r, 800));
        resp = await doRequest();
      }
      if (!resp.ok) throw new Error(`Proxy error: ${resp.status}`);

      const content = extractText(resp.data) || '';
      console.log('🔍 Gemini响应文本预览:', content.slice(0, 160));

      const tryLooseJson = (s) => {
        const start = s.indexOf('{');
        const end = s.lastIndexOf('}');
        if (start >= 0 && end > start) {
          const slice = s.slice(start, end + 1);
          try { return JSON.parse(slice); } catch { /* ignore */ }
        }
        return null;
      };

      let parsed = null;
      try { parsed = JSON.parse(content); } catch { parsed = tryLooseJson(content); }

      if (parsed && typeof parsed === 'object') {
        // 补齐缺失字段
        parsed.rune_name = parsed.rune_name || name;
        parsed.category = parsed.category || '未分类';
        parsed.content = parsed.content || inputContent;
        parsed.core = parsed.core || { intent: '', essence: '', purpose: '' };
        parsed.metadata = parsed.metadata || { language: '中文', emotion: '中性', keywords: [], summary: '', prompt: '', _fallback: false };
        parsed.nine_turns = parsed.nine_turns || { "1_origin": "", "2_form": "", "3_name": parsed.rune_name, "4_meaning": "", "5_function": "", "6_action": "", "7_tone": "", "8_structure": { modalities: [], embedding_type: 'text-embedding-004', dimension: 768 }, "9_evolution": { version: '1.0', update_logic: '当符文语义更新时自动重生' } };
        parsed.context = parsed.context || { source: '模态融合', references: [], relations: [] };
        parsed.status = parsed.status || { parsed: true, processed: true, validated: true };
        return parsed;
      }

      console.warn('⚠️ 模型未返回有效JSON，启用降级构造');
      const basic = simpleTextUnderstanding(combinedText);
      const language = detectLanguage(combinedText);
      const keywords = extractKeywords(combinedText, 6);
      const modalities = ['text','image','audio','video'].filter(m => {
        if (m === 'text') return !!inputContent.text;
        if (m === 'image') return !!inputContent.imageDesc || !!inputContent.videoFrame;
        if (m === 'audio') return !!inputContent.audioText;
        if (m === 'video') return !!inputContent.videoSummary;
        return false;
      });
      const fallback = {
        rune_name: name,
        category: '未分类',
        core: { intent: basic.intent, essence: basic.essence, purpose: basic.purpose },
        content: inputContent,
        metadata: {
          language,
          emotion: basic.emotion,
          keywords: keywords.length ? keywords : ['符文','语义','YinGAN'],
          summary: combinedText.slice(0, 180) || 'AI响应为空或不可解析',
          prompt: (combinedText.slice(0, 120) || '生成相似风格符文'),
          _fallback: true
        },
        nine_turns: {
          "1_origin": basic.intent || '创造',
          "2_form": keywords[0] || '符号',
          "3_name": name,
          "4_meaning": '多模态语义综合',
          "5_function": '激发与记录语义',
          "6_action": '输入相关主题时触发',
          "7_tone": basic.emotion || '中性',
          "8_structure": { modalities, embedding_type: 'text-embedding-004', dimension: 768 },
          "9_evolution": { version: '1.0', update_logic: '当符文语义更新时自动重生' }
        },
        context: { source: '模态融合', references: [], relations: [] },
        status: { parsed: true, processed: true, validated: false }
      };
      return fallback;
    } catch (err) {
      console.warn('aiUnderstandRune 失败:', err);
      const plain = runeData?.nineGrid?.content?.text || '';
      const basic = simpleTextUnderstanding(plain);
      const language = detectLanguage(plain);
      const keywords = extractKeywords(plain, 6);
      return {
        rune_name: runeData?.name || '未命名符文',
        category: '未分类',
        core: { intent: basic.intent, essence: basic.essence, purpose: basic.purpose },
        content: { text: plain, imageDesc: '', audioText: '', videoSummary: '', videoFrame: '' },
        metadata: { language, emotion: basic.emotion, keywords, summary: 'AI理解失败：' + (err?.message || String(err)), prompt: 'AI理解失败', _fallback: true },
        nine_turns: { "1_origin": basic.intent, "2_form": keywords[0] || '符号', "3_name": runeData?.name || '未命名符文', "4_meaning": '简易规则法生成', "5_function": '占位', "6_action": '无', "7_tone": basic.emotion, "8_structure": { modalities: ['text'], embedding_type: 'text-embedding-004', dimension: 768 }, "9_evolution": { version: '1.0', update_logic: '失败时保留占位' } },
        context: { source: '降级生成', references: [], relations: [] },
        status: { parsed: true, processed: true, validated: false }
      };
    }
  }

  // Keyword extraction and language detection helpers used during fallback logic.
  function extractKeywords(text, maxKeywords = 8) {
    const words = String(text || '').toLowerCase()
      .replace(/[^\u4e00-\u9fff\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 1);
    const count = {};
    words.forEach(w => { count[w] = (count[w] || 0) + 1; });
    return Object.entries(count).sort((a,b)=>b[1]-a[1])
      .slice(0, maxKeywords).map(([w])=>w);
  }

  function detectLanguage(text) {
    const chineseRegex = /[\u4e00-\u9fff]/;
    const englishRegex = /[a-zA-Z]/;
    if (chineseRegex.test(String(text))) return '中文';
    if (englishRegex.test(String(text))) return '英文';
    return '未知';
  }


  /**
   * Request a text embedding from the proxy endpoint, returning vector data.
   * @param {string} text - Raw text used to build the embedding.
   * @returns {Promise<number[]>} Embedding vector (or empty array on failure).
   */
  async function generateEmbedding(text) {
    try {
      if (!text || !text.trim()) return [];
      const r = await fetch(`${API_BASE}/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: { parts: [{ text }] } })
      });
      if (!r.ok) throw new Error(`Proxy error: ${r.status}`);
      const data = await r.json();
      const vec = data?.embedding?.values
        || data?.data?.[0]?.embedding
        || [];
      return Array.isArray(vec) ? vec : [];
    } catch (err) {
      console.warn('generateEmbedding 失败：', err);
      return [];
    }
  }

  /**
   * Perform client-side audio transcription via the proxy service.
   * @param {File|Blob} file - Audio source to transcribe.
   * @param {object} [options] - Additional configuration for the request.
   * @returns {Promise<string>} Transcript text or an empty string on failure.
   */
  async function transcribeAudio(file, options = {}) {
    try {
      if (!file) return '';
      const fd = new FormData();
      fd.append('file', file);
      if (options.model) fd.append('model', options.model);
      if (options.prompt) fd.append('prompt', options.prompt);
      if (options.language) fd.append('language', options.language);
      const r = await fetch(`${API_BASE}/audio/transcriptions`, { method: 'POST', body: fd });
      const raw = await r.text();
      let data;
      try { data = JSON.parse(raw); } catch { data = { raw }; }
      if (!r.ok) throw new Error(`Proxy error: ${r.status} - ${extractText(data) || raw.slice(0,120)}`);
      const text = extractText(data) || data?.text || (Array.isArray(data?.segments) ? data.segments.map(s => s.text).join(' ') : '');
      console.log('🎙️ Audio转写响应预览:', String(text).slice(0, 160));
      return text;
    } catch (err) {
      console.warn('transcribeAudio 失败：', err);
      return '';
    }
  }

  /**
   * Send image content to the proxy for captioning or vision understanding.
   * @param {object} options - Contains either an image URL or a base64 data URL.
   * @param {string} [options.imageUrl] - Remote image source.
   * @param {string} [options.dataUrl] - Inline base64 representation.
   * @param {string} [options.prompt] - Optional instruction forwarded to the model.
   * @returns {Promise<string>} Natural language summary produced by the AI service.
   */
  async function analyzeImage({ imageUrl, dataUrl, prompt = '请用中文描述图像主要内容（≤50字）。' }) {
    try {
      const url = dataUrl || imageUrl;
      if (!url) throw new Error('未提供图像URL或dataUrl');
      const r = await fetch(`${API_BASE}/vision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: CHAT_MODEL,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                { type: 'image_url', image_url: { url } }
              ]
            }
          ]
        })
      });
      const raw = await r.text();
      let data;
      try { data = JSON.parse(raw); } catch { data = { raw }; }
      if (!r.ok) throw new Error(`Proxy error: ${r.status} - ${extractText(data) || raw.slice(0,120)}`);
      const content = extractText(data);
      console.log('🖼️ Vision响应预览:', content.slice(0, 160));
      return content;
    } catch (err) {
      console.warn('analyzeImage 失败：', err);
      return '';
    }
  }

  /**
   * 简单规则法：当 AI 不可用时的降级
   */
  function simpleTextUnderstanding(text) {
    const plain = (text || '').trim();
    if (!plain) {
      return { intent: '探索未知', essence: '空内容', purpose: '占位', emotion: '中性' };
    }
    const pos = ['好','棒','优秀','成功','快乐','美好','喜欢','爱','赞'];
    const neg = ['坏','差','失败','悲伤','痛苦','讨厌','恨','糟'];
    const tech = ['AI','算法','代码','程序','技术','数据','模型','系统','计算','网络'];
    const art = ['艺术','美学','设计','创意','灵感','色彩','画面','音乐','诗歌','美术'];

    let emotion = '中性';
    let essence = '文本内容';
    const hasPos = pos.some(w => plain.includes(w));
    const hasNeg = neg.some(w => plain.includes(w));
    if (hasPos && !hasNeg) emotion = '积极';
    else if (hasNeg && !hasPos) emotion = '消极';
    const hasTech = tech.some(w => plain.includes(w));
    const hasArt = art.some(w => plain.includes(w));
    if (hasTech) essence = '技术内容';
    else if (hasArt) essence = '艺术内容';
    return { intent: '表达与分享', essence, purpose: '传递信息或情感', emotion };
  }

    // 导出到全局
  window.AI = {
    aiUnderstandRune,
    generateEmbedding,
    transcribeAudio,
    analyzeImage
  };
})();

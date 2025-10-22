// YinGAN OS - 多模态符文生成器（稳定版 v3.0）
// 作者：GPT哥 + 小葱
// 功能：支持图片、音频、视频、文本自动分析与统一语义向量合成
// 增强：视频首帧提取、AI理解统一接口、智能fallback判定

let generateEmbedding = null;
let analyzeImage = null;
let transcribeAudio = null;
let runeManager = null;
let workspaceManager = null;

// 辅助函数：文件转Base64
async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// 新增：从视频中提取首帧图像
async function extractVideoFirstFrame(file) {
  return new Promise((resolve, reject) => {
    try {
      const url = URL.createObjectURL(file);
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.src = url;
      video.muted = true;
      video.playsInline = true;

      video.addEventListener('loadeddata', async () => {
        try {
          video.currentTime = 0;
        } catch (e) {}
      });

      video.addEventListener('seeked', async () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 360;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          URL.revokeObjectURL(url);
          resolve(dataUrl);
        } catch (err) {
          URL.revokeObjectURL(url);
          reject(err);
        }
      });

      setTimeout(() => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 320;
          canvas.height = 180;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          URL.revokeObjectURL(url);
          resolve(dataUrl);
        } catch (err) {
          URL.revokeObjectURL(url);
          reject(err);
        }
      }, 1500);
    } catch (e) {
      reject(e);
    }
  });
}

// 辅助函数：检测语言
function detectLanguage(text) {
  const chineseRegex = /[\u4e00-\u9fff]/;
  const englishRegex = /[a-zA-Z]/;
  if (chineseRegex.test(text)) return '中文';
  if (englishRegex.test(text)) return '英文';
  return '未知';
}

// 辅助函数：提取关键词
function extractKeywords(text, maxKeywords = 8) {
  const words = text.toLowerCase()
    .replace(/[^\u4e00-\u9fff\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2);
  const count = {};
  words.forEach(w => { count[w] = (count[w] || 0) + 1; });
  return Object.entries(count).sort((a,b)=>b[1]-a[1])
    .slice(0,maxKeywords).map(([w])=>w);
}

// 主函数：全自动符文生成（多模态 + 容错）
export async function autoRuneGenerator(inputFile, extraText = "", _runeManager = null, _workspaceManager = null) {
  runeManager = _runeManager || runeManager;
  workspaceManager = _workspaceManager || workspaceManager;

  // 加载AI接口（健壮版）：优先使用 window.AI，其次尝试动态导入，最后提供降级空实现
  // 中文说明：由于 ai-understanding.js 采用 IIFE 挂载到 window.AI，并不导出 ESModule，直接 import 可能拿不到函数。
  // 因此此处先从 window.AI 取函数，若仍不可用再尝试 import。同时提供兜底空实现，避免 TypeError。
  if (!generateEmbedding || typeof generateEmbedding !== 'function' ||
      !analyzeImage || typeof analyzeImage !== 'function' ||
      !transcribeAudio || typeof transcribeAudio !== 'function') {
    try {
      // 1) 优先从全局 window.AI 获取（index.html 以 <script> 方式加载）
      if (typeof window !== 'undefined' && window.AI) {
        generateEmbedding = window.AI.generateEmbedding;
        analyzeImage = window.AI.analyzeImage;
        transcribeAudio = window.AI.transcribeAudio;
        console.log('✅ 已从 window.AI 取得 AI 接口');
      }
      // 2) 若仍不可用，尝试动态导入（仅在支持 import() 的环境可能成功）
       if (!generateEmbedding || typeof generateEmbedding !== 'function') {
         const aiModule = await import('./ai-understanding.js');
         // IIFE 场景通常不导出，此处仍尝试读取并回退到 window.AI
         generateEmbedding = aiModule.generateEmbedding || (typeof window !== 'undefined' ? window.AI?.generateEmbedding : null);
         analyzeImage = aiModule.analyzeImage || (typeof window !== 'undefined' ? window.AI?.analyzeImage : null);
         transcribeAudio = aiModule.transcribeAudio || (typeof window !== 'undefined' ? window.AI?.transcribeAudio : null);
         console.log('ℹ️ 已尝试动态导入 AI 模块');
       }
    } catch (err) {
      console.warn('⚠️ AI模块加载失败：', err);
    }
    // 3) 最终兜底：若仍无可用函数，提供降级空实现，避免 TypeError
    if (typeof generateEmbedding !== 'function') {
      console.warn('⚠️ generateEmbedding 未就绪，使用降级空实现');
      generateEmbedding = async (text) => {
        // 降级注释：当无法调用真实嵌入服务时，返回空数组以避免崩溃
        return [];
      };
    }
    if (typeof analyzeImage !== 'function') {
      console.warn('⚠️ analyzeImage 未就绪，使用降级空实现');
      analyzeImage = async () => '';
    }
    if (typeof transcribeAudio !== 'function') {
      console.warn('⚠️ transcribeAudio 未就绪，使用降级空实现');
      transcribeAudio = async () => '';
    }
  }

  const rune = runeManager.createRune(inputFile.name, "multimodal");
  const mimeType = inputFile.type;
  rune.nineGrid.content.imageDesc = "";
  rune.nineGrid.content.audioText = "";
  rune.nineGrid.content.videoSummary = "";
  let fallbackFlag = false;
  let mediaBase64 = null;

  console.log(`🎯 开始处理文件: ${inputFile.name} (${mimeType})`);

  // Step 1. 模态识别与预处理
  if (mimeType.startsWith("image")) {
    mediaBase64 = await fileToBase64(inputFile);
    rune.nineGrid.content.imageData = mediaBase64;
    try {
      rune.nineGrid.content.imageDesc = await analyzeImage({ dataUrl: mediaBase64 });
      console.log("🖼️ 图像理解完成:", rune.nineGrid.content.imageDesc);
    } catch (e) {
      console.warn("⚠️ 图像理解失败:", e);
      fallbackFlag = true;
    }
  } else if (mimeType.startsWith("audio")) {
    mediaBase64 = await fileToBase64(inputFile);
    rune.nineGrid.content.audioData = mediaBase64;
    try {
      rune.nineGrid.content.audioText = await transcribeAudio(inputFile);
      console.log("🎵 音频转写完成:", rune.nineGrid.content.audioText.slice(0,80));
    } catch (e) {
      console.warn("⚠️ 音频转写失败:", e);
      fallbackFlag = true;
    }
  } else if (mimeType.startsWith("video")) {
    rune.nineGrid.content.videoData = await fileToBase64(inputFile);
    try {
      const frameData = await extractVideoFirstFrame(inputFile);
      rune.nineGrid.content.videoFrame = frameData;
      const prompt = "请描述此视频首帧代表的场景与情绪（≤50字）";
      rune.nineGrid.content.videoSummary = await analyzeImage({ dataUrl: frameData, prompt });
      console.log("🎬 视频摘要完成:", rune.nineGrid.content.videoSummary);
    } catch (e) {
      console.warn("⚠️ 视频首帧或摘要失败:", e);
      fallbackFlag = true;
    }
  } else if (mimeType.startsWith("text")) {
    const text = await inputFile.text();
    rune.nineGrid.content.text = text;
    rune.nineGrid.metadata.language = detectLanguage(text);
  }

  // Step 2. 调用AI统一理解接口（新版九转结构）
  let aiStruct = null;
  try {
    if (typeof window !== "undefined" && window.AI?.aiUnderstandRune) {
      console.log("🤖 使用 window.AI.aiUnderstandRune 进行符文理解（九转结构）...");
      const candidate = {
        name: rune.name,
        nineGrid: {
          content: {
            text: rune.nineGrid.content.text || '',
            imageDesc: rune.nineGrid.content.imageDesc || '',
            audioText: rune.nineGrid.content.audioText || '',
            videoSummary: rune.nineGrid.content.videoSummary || '',
            videoFrame: rune.nineGrid.content.videoFrame || ''
          },
          metadata: { summary: '' }
        }
      };
      aiStruct = await window.AI.aiUnderstandRune(candidate);
      console.log("✅ AI九转结构生成完成:", aiStruct?.rune_name || rune.name);
    } else {
      throw new Error("AI接口未初始化");
    }
  } catch (e) {
    console.warn("⚠️ AI理解失败，使用降级结构:", e);
    aiStruct = {
      rune_name: rune.name,
      category: '未分类',
      core: { intent: "符文理解失败", essence: "占位符", purpose: "AI未响应" },
      content: { text: rune.nineGrid.content.text || '', imageDesc: rune.nineGrid.content.imageDesc || '', audioText: rune.nineGrid.content.audioText || '', videoSummary: rune.nineGrid.content.videoSummary || '', videoFrame: rune.nineGrid.content.videoFrame || '' },
      metadata: { language: detectLanguage(rune.nineGrid.content.text || ''), emotion: "中性", keywords: ["失败"], summary: "AI理解失败", prompt: "AI理解失败", _fallback: true },
      nine_turns: { "1_origin": "失败", "2_form": "占位", "3_name": rune.name, "4_meaning": "降级占位", "5_function": "占位", "6_action": "无", "7_tone": "中性", "8_structure": { modalities: ['text'], embedding_type: 'text-embedding-004', dimension: 768 }, "9_evolution": { version: '1.0', update_logic: '失败时保留占位' } },
      context: { source: '降级生成', references: [], relations: [] },
      status: { parsed: true, processed: true, validated: false }
    };
    fallbackFlag = true;
  }

  // 将 AI 返回结构映射到 Rune 对象
  try {
    // 名称与分类
    if (aiStruct?.rune_name) rune.name = aiStruct.rune_name;
    if (aiStruct?.category && rune.category !== undefined) rune.category = aiStruct.category;

    // 核心、内容、元数据
    if (aiStruct?.core) {
      rune.nineGrid.core.intent = aiStruct.core.intent || '';
      rune.nineGrid.core.essence = aiStruct.core.essence || '';
      rune.nineGrid.core.purpose = aiStruct.core.purpose || '';
    }
    if (aiStruct?.content) {
      rune.nineGrid.content.text = aiStruct.content.text || rune.nineGrid.content.text || '';
      rune.nineGrid.content.imageDesc = aiStruct.content.imageDesc || rune.nineGrid.content.imageDesc || '';
      rune.nineGrid.content.audioText = aiStruct.content.audioText || rune.nineGrid.content.audioText || '';
      rune.nineGrid.content.videoSummary = aiStruct.content.videoSummary || rune.nineGrid.content.videoSummary || '';
      rune.nineGrid.content.videoFrame = aiStruct.content.videoFrame || rune.nineGrid.content.videoFrame || '';
    }
    if (aiStruct?.metadata) {
      rune.nineGrid.metadata.language = aiStruct.metadata.language || detectLanguage(rune.nineGrid.content.text || '');
      rune.nineGrid.metadata.emotion = aiStruct.metadata.emotion || '中性';
      rune.nineGrid.metadata.keywords = Array.isArray(aiStruct.metadata.keywords) && aiStruct.metadata.keywords.length ? aiStruct.metadata.keywords : extractKeywords(aiStruct.metadata.summary || rune.nineGrid.content.text || '', 6);
      rune.nineGrid.metadata.summary = aiStruct.metadata.summary || '';
      rune.nineGrid.metadata.prompt = aiStruct.metadata.prompt || (rune.nineGrid.metadata.summary || '').slice(0,200);
      rune.nineGrid.metadata._fallback = !!aiStruct.metadata._fallback;
      fallbackFlag = fallbackFlag || !!aiStruct.metadata._fallback;
    }

    // 九转、上下文、状态
    if (aiStruct?.nine_turns) {
      rune.nineGrid.nine_turns = aiStruct.nine_turns;
    }
    if (aiStruct?.context) {
      rune.nineGrid.context = aiStruct.context;
    }
    if (aiStruct?.status) {
      rune.nineGrid.status = aiStruct.status;
    }
  } catch (mapErr) {
    console.warn('⚠️ 映射AI结构到Rune失败:', mapErr);
  }

  // Step 3. 生成多模态Embedding
  const embedSources = [
    rune.nineGrid.content.text,
    rune.nineGrid.content.imageDesc,
    rune.nineGrid.content.audioText,
    rune.nineGrid.content.videoSummary,
    rune.nineGrid.metadata.summary
  ].filter(Boolean);

  const modalityVectors = [];
  for (const src of embedSources) {
    try {
      const vec = await generateEmbedding(src);
      if (vec?.length) modalityVectors.push(vec);
    } catch (e) {
      console.warn("embedding失败:", e);
    }
  }

  let unifiedVector = [];
  if (modalityVectors.length > 0) {
    const dim = modalityVectors[0].length;
    unifiedVector = new Array(dim).fill(0);
    modalityVectors.forEach(vec => {
      for (let i=0;i<dim;i++) unifiedVector[i]+=vec[i];
    });
    for (let i=0;i<dim;i++) unifiedVector[i]/=modalityVectors.length;
    console.log("✅ 向量合成完成，维度:", unifiedVector.length);
  } else {
    unifiedVector = new Array(768).fill(0.1);
    fallbackFlag = true;
  }

  // Step 4. 填充符文结构
  // 修复说明：此前此处使用未定义的变量 parsed，导致 ReferenceError。
  // 现统一使用 AI 九转结构对象 aiStruct 的对应字段，来源与上方映射保持一致。
  // 同时保留已有值作为兜底，避免因 AI 缺失字段导致空值。
  rune.nineGrid.core.intent = (aiStruct?.core?.intent || rune.nineGrid.core.intent || '');
  rune.nineGrid.core.essence = (aiStruct?.core?.essence || rune.nineGrid.core.essence || '');
  rune.nineGrid.core.purpose = (aiStruct?.core?.purpose || rune.nineGrid.core.purpose || '');
  rune.nineGrid.metadata.emotion = (aiStruct?.metadata?.emotion || rune.nineGrid.metadata.emotion || '中性');
  rune.nineGrid.metadata.summary = (aiStruct?.metadata?.summary || rune.nineGrid.metadata.summary || '');
  rune.nineGrid.metadata.keywords = (Array.isArray(aiStruct?.metadata?.keywords) && aiStruct.metadata.keywords.length ? aiStruct.metadata.keywords : (rune.nineGrid.metadata.keywords || []));
  rune.vector = unifiedVector;
  rune.embedding = { combined_vector: unifiedVector, dimension: unifiedVector.length };

  if (fallbackFlag && modalityVectors.length === 0) {
    rune.nineGrid.metadata._fallback = true;
  } else {
    rune.nineGrid.metadata._fallback = false;
  }

  console.log(`✅ 符文完成: ${rune.name}  (fallback=${rune.nineGrid.metadata._fallback})`);

  if (workspaceManager?.saveRune) {
    await workspaceManager.saveRune(rune, [inputFile]);
  }

  return rune;
}

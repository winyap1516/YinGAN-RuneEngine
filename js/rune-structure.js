// 符文数据结构设计
// 基于JSON结构.md文档的九宫格结构

/**
 * 基础符文对象结构
 * 对应JSON结构.md中的Rune对象
 */
class Rune {
  constructor(id, name, type = 'text', category = '未分类') {
    this.id = id || this.generateId();
    this.name = name || '未命名符文';
    this.type = type;
    this.category = category; // 新增：符文类别（九转规范字段）
    this.vector = []; // 主向量（embedding合成结果）
    this.meta = {
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
      version: '1.0'
    };
    this.nineGrid = this.createNineGrid();
  }

  // 生成唯一ID
  generateId() {
    return 'rune_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  // 创建九宫格结构（对齐 prompt-template.md 的九转语义规范）
  createNineGrid() {
    return {
      // 核心区域（符文语义）
      core: {
        intent: '',     // 符文意图
        essence: '',    // 符文本质
        purpose: ''     // 符文目的
      },

      // 内容区域（多模态 + AI派生文本）
      content: {
        text: '',             // 文本内容
        image: null,          // 图片文件（或URL）
        imageDesc: '',        // 图片AI描述
        audio: null,          // 音频文件
        audioText: '',        // 音频转写
        video: null,          // 视频文件
        videoFrame: '',       // 视频首帧（base64）
        videoSummary: ''      // 视频摘要
      },

      // 元数据区域
      metadata: {
        language: '',         // 语言
        emotion: '',          // 情感
        keywords: [],         // 关键词
        summary: '',          // 总结（用于embedding）
        prompt: '',           // 生成提示词
        _fallback: false      // 降级标志
      },

      // 九转语义层（1~9）
      // 解释：九层用于描述符文从本源到演化的完整语义映射
      nine_turns: {
        "1_origin": "",       // 本源：意图或哲理种子（如：创造/治愈/平衡）
        "2_form": "",         // 形象：外形/结构（如：光球/螺旋/波纹）
        "3_name": "",         // 名称：符文名（与 rune_name 对齐或衍生）
        "4_meaning": "",      // 含义：哲学含义（≤30字）
        "5_function": "",     // 功能：系统中的作用或用途
        "6_action": "",       // 行动：触发条件与运作机制
        "7_tone": "",         // 韵调：能量基调（温暖/冷静/流动...）
        "8_structure": {       // 结构：多模态映射与向量信息
          modalities: [],
          embedding_type: "text-embedding-004",
          dimension: 768
        },
        "9_evolution": {       // 演化：自更新逻辑与版本管理
          version: "1.0",
          update_logic: "当符文语义更新时自动重生"
        }
      },

      // 上下文区域
      context: {
        source: '',           // 来源（用户输入/系统生成/模态融合）
        references: [],       // 引用
        relations: []         // 关联符文
      },

      // 状态标记
      status: {
        parsed: false,
        processed: false,
        validated: false
      }
    };
  }

  // 更新符文数据
  update(data) {
    Object.assign(this, data);
    this.meta.modified = new Date().toISOString();
    return this;
  }

  // 转换为JSON格式
  toJSON() {
    return {
      // 兼容旧存储结构
      id: this.id,
      name: this.name,
      type: this.type,
      vector: this.vector,
      meta: this.meta,
      nineGrid: this.nineGrid,
      embedding: this.embedding || { combined_vector: this.vector || [], modalities: [] },
      metadata: this.nineGrid?.metadata || {},
      text_data: Array.isArray(this.nineGrid?.content?.text) ? this.nineGrid.content.text : [this.nineGrid.content.text],
      media: {
        image: this.nineGrid?.content?.image || null,
        audio: this.nineGrid?.content?.audio || null,
        video: this.nineGrid?.content?.video || null
      },
      // 新增：九转语义规范导出（严格字段）
      rune_name: this.name,
      category: this.category || '未分类',
      core: this.nineGrid.core,
      content: {
        text: this.nineGrid.content.text || '',
        imageDesc: this.nineGrid.content.imageDesc || '',
        audioText: this.nineGrid.content.audioText || '',
        videoSummary: this.nineGrid.content.videoSummary || '',
        videoFrame: this.nineGrid.content.videoFrame || ''
      },
      metadata: this.nineGrid.metadata,
      nine_turns: this.nineGrid.nine_turns,
      context: this.nineGrid.context,
      status: this.nineGrid.status
    };
  }

  // 从JSON数据创建符文
  static fromJSON(data) {
    const rune = new Rune(data.id, data.name, data.type, data.category || '未分类');
    if (data.embedding) {
      rune.embedding = data.embedding;
      rune.vector = data.embedding.combined_vector || data.vector || [];
    } else {
      rune.vector = data.vector || [];
      rune.embedding = { combined_vector: rune.vector, modalities: [] };
    }
    rune.meta = { ...rune.meta, ...data.meta };
    rune.nineGrid = { ...rune.nineGrid, ...data.nineGrid };
    // 新增：支持九转规范的扁平字段导入
    if (data.rune_name) rune.name = data.rune_name;
    if (data.core) rune.nineGrid.core = { ...rune.nineGrid.core, ...data.core };
    if (data.content) rune.nineGrid.content = { ...rune.nineGrid.content, ...data.content };
    if (data.metadata) rune.nineGrid.metadata = { ...rune.nineGrid.metadata, ...data.metadata };
    if (data.nine_turns) rune.nineGrid.nine_turns = { ...rune.nineGrid.nine_turns, ...data.nine_turns };
    if (data.context) rune.nineGrid.context = { ...rune.nineGrid.context, ...data.context };
    if (data.status) rune.nineGrid.status = { ...rune.nineGrid.status, ...data.status };
    return rune;
  }
}

/**
 * 阴阳矩阵结构
 * 对应JSON结构.md中的YinYangMatrix
 */
class YinYangMatrix {
  constructor() {
    this.language = [];    // 语言维度
    this.audio = [];       // 音频维度
    this.image = [];       // 图像维度
    this.symbolic = [];    // 符号维度
    this.core = [];        // 核心维度
    this.knowledge = [];   // 知识维度
    this.emotion = [];     // 情感维度
    this.motion = [];      // 运动维度
    this.consciousness = []; // 意识维度
  }

  // 添加符文到矩阵
  addRune(rune, dimensions) {
    dimensions.forEach(dim => {
      if (this[dim] && Array.isArray(this[dim])) {
        this[dim].push({
          runeId: rune.id,
          runeName: rune.name,
          timestamp: new Date().toISOString()
        });
      }
    });
  }

  // 转换为JSON格式
  toJSON() {
    return {
      language: this.language,
      audio: this.audio,
      image: this.image,
      symbolic: this.symbolic,
      core: this.core,
      knowledge: this.knowledge,
      emotion: this.emotion,
      motion: this.motion,
      consciousness: this.consciousness
    };
  }
}

/**
 * 符文管理器
 * 负责符文的创建、存储和检索
 */
class RuneManager {
  constructor() {
    this.runes = new Map(); // 符文存储
    this.matrix = new YinYangMatrix(); // 阴阳矩阵
    this.storageKey = 'yinyan_runes';
    this.loadFromStorage();
  }

  // 创建新符文
  createRune(name, type, content) {
    const rune = new Rune(null, name, type);

    // 修复: 支持 multimodal
    if (type === 'multimodal' && content) {
      // 多模态内容：同时可能有文本和媒体
      rune.nineGrid.content.text = content.text || '';
      rune.nineGrid.content.image = content.media?.filter(m => m.mime?.startsWith('image/')) || null;
      rune.nineGrid.content.audio = content.media?.filter(m => m.mime?.startsWith('audio/')) || null;
      rune.nineGrid.content.video = content.media?.filter(m => m.mime?.startsWith('video/')) || null;
    } else {
      // 单一类型内容
      switch (type) {
        case 'text':
          rune.nineGrid.content.text = content;
          break;
        case 'image':
          rune.nineGrid.content.image = content;
          break;
        case 'audio':
          rune.nineGrid.content.audio = content;
          break;
        case 'video':
          rune.nineGrid.content.video = content;
          break;
      }
    }

    this.runes.set(rune.id, rune);
    this.saveToStorage();
    return rune;
  }

  // 获取符文
  getRune(id) {
    return this.runes.get(id);
  }

  // 获取所有符文
  getAllRunes() {
    return Array.from(this.runes.values());
  }

  // 删除符文
  deleteRune(id) {
    this.runes.delete(id);
    this.saveToStorage();
    return true;
  }

  // 保存到本地存储
  saveToStorage() {
    const data = {
      runes: Array.from(this.runes.values()).map(rune => rune.toJSON()),
      matrix: this.matrix.toJSON()
    };
    localStorage.setItem(this.storageKey, JSON.stringify(data));
  }

  // 从本地存储加载
  loadFromStorage() {
    try {
      const data = JSON.parse(localStorage.getItem(this.storageKey));
      if (data && data.runes) {
        data.runes.forEach(runeData => {
          const rune = Rune.fromJSON(runeData);
          this.runes.set(rune.id, rune);
        });
      }
      if (data && data.matrix) {
        this.matrix = Object.assign(new YinYangMatrix(), data.matrix);
      }
    } catch (error) {
      console.warn('无法加载符文存储:', error);
    }
  }

  // 导出所有数据
  exportData() {
    return {
      runes: Array.from(this.runes.values()).map(rune => rune.toJSON()),
      matrix: this.matrix.toJSON(),
      exported: new Date().toISOString()
    };
  }

  // 导入数据
  importData(data) {
    if (data.runes) {
      data.runes.forEach(runeData => {
        const rune = Rune.fromJSON(runeData);
        this.runes.set(rune.id, rune);
      });
    }
    if (data.matrix) {
      this.matrix = Object.assign(new YinYangMatrix(), data.matrix);
    }
    this.saveToStorage();
  }
}

// 全局符文管理器实例
window.RuneManager = RuneManager;
window.Rune = Rune;
window.YinYangMatrix = YinYangMatrix;

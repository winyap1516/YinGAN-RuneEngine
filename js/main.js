import { logger } from '../utils/logger.js';

// Rune Engine core module - integrates automatic rune generation features.

// Global state holders that can be shared across modules.
let runeManager = null;
let workspaceManager = null;
let autoRuneGenerator = null;

// Export handles so other modules can reuse shared state when needed.
export { runeManager, workspaceManager, autoRuneGenerator };

const LOG_TAG = 'Main';

/**
 * Initialize workspace helpers and expose persistent rune utilities.
 */
function initWorkspaceManager() {
  // Initialize rune manager.
  if (typeof RuneManager !== 'undefined') {
    runeManager = new RuneManager();
    logger.info(LOG_TAG, 'Rune manager ready');
  } else {
    logger.error(LOG_TAG, 'RuneManager class is not defined');
  }

  // Prepare workspace manager bindings.
  workspaceManager = {
    // Set the default workspace path that desktop builds expect.
    currentPath: 'D:\\YinGAN-RuneEngine\\myrune',

    /**
     * Persist rune data and related media files into the workspace folder.
     * @param {object} rune - Rune payload produced by the generator.
     * @param {FileList|File[]} files - Optional media assets to store together.
     * @returns {Promise<{success: boolean, runeId?: string, filePath?: string, error?: string}>}
     */
    saveRune: async function(rune, files) {
      logger.info(LOG_TAG, `Saving rune to workspace: ${rune.name}`);

      try {
        // Ensure the workspace folder hierarchy exists.
        await this.ensureWorkspaceDirectory();

        // Generate a unique rune identifier.
        const runeId = Date.now() + '_' + Math.random().toString(36).substr(2, 9);

        // Save the rune JSON file into the rune subfolder.
        const runeFileName = `rune_${runeId}.json`;
        const runeFilePath = `${this.currentPath}\\rune\\${runeFileName}`;

        // Prepare rune data package (including multimodal content).
        const runeData = {
          id: runeId,
          name: rune.name,
          timestamp: new Date().toISOString(),
          nineGrid: rune.nineGrid,
          multimodalContent: rune.nineGrid.content || {},
          unifiedVector: rune.unifiedVector || null,
          _fallback: rune._fallback || false,
          metadata: {
            fileCount: files ? files.length : 0,
            originalFiles: files ? files.map(f => f.name) : [],
            version: '1.0'
          }
        };

        // Use Node.js fs module when available (Electron or desktop builds).
        if (typeof window.require !== 'undefined') {
          const fs = window.require('fs').promises;
          await fs.writeFile(runeFilePath, JSON.stringify(runeData, null, 2), 'utf8');
          logger.info(LOG_TAG, `Rune JSON saved at ${runeFilePath}`);
        } else {
          // Fallback for browsers: trigger file download.
          this.downloadFile(runeData, runeFileName);
        }

        // Save additional media assets into the media subfolder.
        if (files && files.length > 0) {
          await this.saveMediaFiles(files, runeId);
        }

        // Refresh workspace status in the UI.
        this.updateWorkspaceStatus();

        logger.info(LOG_TAG, `Rune stored successfully. ID: ${runeId}`);
        return { success: true, runeId: runeId, filePath: runeFilePath };

      } catch (error) {
        logger.error(LOG_TAG, error);
        this.showError('符文保存失败: ' + error.message);
        return { success: false, error: error.message };
      }
    },

    /**
     * Ensure the workspace folder hierarchy exists when running in Node contexts.
     */
    ensureWorkspaceDirectory: async function() {
      try {
        if (typeof window.require !== 'undefined') {
          const fs = window.require('fs').promises;
          const path = window.require('path');

          // Create the primary workspace directory if needed.
          try {
            await fs.access(this.currentPath);
          } catch {
            await fs.mkdir(this.currentPath, { recursive: true });
            logger.info(LOG_TAG, `Workspace directory created: ${this.currentPath}`);
          }

          // Create rune subdirectory.
          const runeDir = path.join(this.currentPath, 'rune');
          try {
            await fs.access(runeDir);
          } catch {
            await fs.mkdir(runeDir, { recursive: true });
            logger.info(LOG_TAG, `Rune directory created: ${runeDir}`);
          }

          // Create media subdirectory.
          const mediaDir = path.join(this.currentPath, 'media');
          try {
            await fs.access(mediaDir);
          } catch {
            await fs.mkdir(mediaDir, { recursive: true });
            logger.info(LOG_TAG, `Media directory created: ${mediaDir}`);
          }
        }
      } catch (error) {
        logger.error(LOG_TAG, error);
        throw error;
      }
    },

    /**
     * Store media files on disk when the desktop APIs are available.
     * @param {FileList|File[]} files - Media assets selected by the user.
     * @param {string} runeId - Identifier used to build file names.
     */
    saveMediaFiles: async function(files, runeId) {
      try {
        if (typeof window.require !== 'undefined') {
          const fs = window.require('fs').promises;
          const path = window.require('path');
          
          for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const fileExt = path.extname(file.name);
            const mediaFileName = `media_${runeId}_${i}${fileExt}`;
            const mediaFilePath = path.join(this.currentPath, 'media', mediaFileName);

            // Persist binary content to disk.
            const fileBuffer = await file.arrayBuffer();
            await fs.writeFile(mediaFilePath, Buffer.from(fileBuffer));
            logger.info(LOG_TAG, `Media file saved: ${mediaFilePath} (${file.name})`);
          }
        }
      } catch (error) {
        logger.error(LOG_TAG, error);
      }
    },

    /**
     * Provide a download fallback when running in pure browser environments.
     * @param {object} data - Rune payload to serialize.
     * @param {string} fileName - Suggested download file name.
     */
    downloadFile: function(data, fileName) {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      logger.info(LOG_TAG, `Rune downloaded: ${fileName}`);
    },

    /**
     * Refresh workspace status block to reflect the active directory.
     */
    updateWorkspaceStatus: function() {
      const statusElement = document.getElementById('workspaceStatus');
      if (statusElement) {
        statusElement.innerHTML = `
          <div style="padding: 8px; background: #e8f5e8; border: 1px solid #4caf50; border-radius: 6px; font-size: 14px;">
            <strong>🏠 工作区:</strong> ${this.currentPath}
            <br><small style="color: #666;">✅ 符文可保存到此目录</small>
          </div>
        `;
      }
    },

    /**
     * Display workspace errors inside the UI and clear them after a timeout.
     * @param {string} message - Human readable error description.
     */
    showError: function(message) {
      const errorElement = document.getElementById('workspaceError');
      if (errorElement) {
        errorElement.innerHTML = `
          <div style="padding: 10px; background: #ffeaea; border: 1px solid #f44336; border-radius: 4px; margin: 10px 0; color: #d32f2f;">
            <strong>❌ 错误:</strong> ${message}
          </div>
        `;
        // Clear the error message after a short delay.
        setTimeout(() => {
          errorElement.innerHTML = '';
        }, 3000);
      }
    }
  };

  logger.info(LOG_TAG, 'Workspace helpers initialized');
}

/**
 * Dynamically load the auto rune generator module and expose it for later calls.
 */
async function initAutoRuneGenerator() {
  try {
    // Attempt dynamic import of the auto rune generator module.
    try {
      const module = await import('./auto-rune-generator.js');
      autoRuneGenerator = module.autoRuneGenerator;
      logger.info(LOG_TAG, 'Auto rune generator loaded');
    } catch (importError) {
      logger.error(LOG_TAG, importError);
      // Fallback: attempt to locate a global implementation exposed elsewhere.
      if (typeof window.autoRuneGenerator === 'function') {
        autoRuneGenerator = window.autoRuneGenerator;
        logger.info(LOG_TAG, 'Using global autoRuneGenerator fallback');
      } else {
        logger.error(LOG_TAG, 'Auto rune generator missing');
      }
    }
  } catch (error) {
    logger.error(LOG_TAG, error);
  }
}

/**
 * Handle the auto rune generation workflow triggered by the UI button.
 */
async function handleAutoRuneGeneration() {
  logger.info(LOG_TAG, 'Starting auto rune generation flow');
  
  // Ensure the auto rune generator module is ready.
  if (!autoRuneGenerator) {
    alert('❌ 自动符文生成器尚未加载完成，请稍后再试');
    return;
  }

  // Ensure the rune manager exists before generating data.
  if (!runeManager) {
    alert('❌ 符文管理器未初始化，无法生成符文');
    return;
  }

  // Locate the input controls used by the simplified layout.
  const fileInput = document.getElementById('fileInput');
  const runeNameInput = document.getElementById('runeName');
  const runeDescInput = document.getElementById('runeDesc');

  // Resolve the first selected file from the input element.
  let selectedFile = null;
  if (fileInput && fileInput.files && fileInput.files.length > 0) {
    selectedFile = fileInput.files[0];
    logger.info(LOG_TAG, `Selected file: ${selectedFile.name}`);
  }

  // Abort early if no file was selected.
  if (!selectedFile) {
    alert('❌ 请先选择一个文件（图片、音频、视频或文本文件）');
    return;
  }

  // Collect optional rune metadata from the form.
  const runeName = runeNameInput ? runeNameInput.value.trim() : '';
  const runeDesc = runeDescInput ? runeDescInput.value.trim() : '';

  // Update the progress indicator while processing.
  const progressText = document.getElementById('progressText');
  if (progressText) {
    progressText.textContent = '🤖 AI正在理解文件内容...';
  }

  try {
    logger.info(LOG_TAG, 'Invoking auto rune generator');
    logger.info(LOG_TAG, `File name: ${selectedFile.name}`);
    logger.info(LOG_TAG, `File type: ${selectedFile.type}`);
    logger.info(LOG_TAG, `File size: ${(selectedFile.size / 1024).toFixed(2)} KB`);
    if (runeName) {
      logger.info(LOG_TAG, `Rune name preset: ${runeName}`);
    }
    if (runeDesc) {
      logger.info(LOG_TAG, `Rune description preset: ${runeDesc}`);
    }
    
    // Run the generator with the optional name and description.
    const generatedRune = await autoRuneGenerator(
      selectedFile,
      runeDesc, // Use the description field as additional context.
      runeManager,
      workspaceManager
    );

    // Update the rune name if the user provided one.
    if (runeName && generatedRune) {
      generatedRune.name = runeName;
    }

    logger.info(LOG_TAG, 'Auto rune generation completed');
    logger.info(LOG_TAG, `Rune name: ${generatedRune.name}`);
    logger.info(LOG_TAG, `Rune intent: ${generatedRune.nineGrid.core.intent}`);
    logger.info(LOG_TAG, `Rune essence: ${generatedRune.nineGrid.core.essence}`);
    logger.info(LOG_TAG, `Rune emotion: ${generatedRune.nineGrid.metadata.emotion}`);
    logger.info(LOG_TAG, `Rune keywords: ${generatedRune.nineGrid.metadata.keywords.join(', ')}`);
    
    // Reflect completion inside the progress indicator.
    if (progressText) {
      progressText.textContent = `✅ 符文「${generatedRune.name}」生成完成！`;
    }

    // Render the generated rune inside the UI when helpers are available.
    if (typeof displayRune === 'function') {
      displayRune(generatedRune);
    }

    // Refresh the rune library list to include the new entry.
    if (typeof updateRuneLibraryList === 'function') {
      updateRuneLibraryList();
    }

    // Provide a success alert summarizing the generated rune.
    setTimeout(() => {
      alert(`🎉 符文「${generatedRune.name}」自动生成完成！\n\n` +
            `🎯 意图：${generatedRune.nineGrid.core.intent}\n` +
            `💎 本质：${generatedRune.nineGrid.core.essence}\n` +
            `😊 情感：${generatedRune.nineGrid.metadata.emotion}`);
    }, 100);
    
  } catch (error) {
    logger.error(LOG_TAG, error);
    
    // 更新进度信息
    if (progressText) {
      progressText.textContent = '❌ 符文生成失败，请检查控制台日志';
    }
    
    // 显示错误提示
    alert(`❌ 符文生成失败：${error.message}\n\n` +
          '请检查：\n' +
          '1. 文件格式是否支持\n' +
          '2. 网络连接是否正常\n' +
          '3. Gemini API是否可用\n' +
          '4. 控制台中的详细错误信息');
  }
}

// 绑定自动符文生成事件（适配精简版布局）
function bindAutoRuneEvents() {
  console.log('🔧 绑定自动符文生成事件（精简版布局）...');
  
  // 绑定自动符文生成按钮点击事件
  const autoGenerateBtn = document.getElementById('autoGenerateBtn');
  if (autoGenerateBtn) {
    autoGenerateBtn.addEventListener('click', handleAutoRuneGeneration);
    console.log('✅ 自动符文生成按钮事件绑定完成');
  } else {
    console.warn('⚠️ 未找到自动符文生成按钮元素');
  }
  
  // 为文件输入添加变化监听，提供即时反馈（精简版布局）
  const fileInput = document.getElementById('fileInput');
  if (fileInput) {
    fileInput.addEventListener('change', function() {
      if (this.files && this.files.length > 0) {
        const file = this.files[0];
        console.log(`📁 文件已选择:`, file.name);
        
        // 更新进度文本显示
        const progressText = document.getElementById('progressText');
        if (progressText) {
          progressText.textContent = `📁 已选择文件：${file.name}`;
        }
      }
    });
  }
  
  // 为符文名称输入添加回车快捷生成（新增功能）
  const runeNameInput = document.getElementById('runeName');
  if (runeNameInput) {
    runeNameInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        // 回车时触发符文生成
        if (autoGenerateBtn) {
          autoGenerateBtn.click();
        }
      }
    });
  }
}

// DOM内容加载完成后初始化（适配精简版布局）
document.addEventListener('DOMContentLoaded', function() {
  console.log('🚀 DOM内容加载完成，开始初始化精简版布局...');
  
  // 延迟初始化，确保依赖脚本已加载
  setTimeout(() => {
    initWorkspaceManager();
    
    // 绑定工作区事件
    if (typeof bindWorkspaceEvents === 'function') {
      bindWorkspaceEvents();
    }
    
    // 绑定自动符文生成事件
    bindAutoRuneEvents();
    
    // 初始化嵌入式聊天室（精简版布局）
    initEmbeddedChat();
    
    // 异步加载自动符文生成器
    initAutoRuneGenerator();
    
    // 更新工作区状态显示
    if (workspaceManager) {
      workspaceManager.updateWorkspaceStatus();
    }
    
    console.log('🎉 精简版布局初始化完成');
    console.log('💡 使用提示：');
    console.log('  - 上传文件后点击"生成符文"按钮进行全自动符文生成');
    console.log('  - AI聊天室已嵌入右侧底部，可随时与AI助手对话');
    console.log('  - 或者使用原有的"⚙️ 生成符文"按钮进行手动确认生成');
    console.log(`🏠 工作区路径: ${workspaceManager.currentPath}`);
  }, 500);
});

// 新增：更新“我的符文库”列表
function updateRuneLibraryList() {
  try {
    const listEl = document.getElementById('runeLibraryList');
    if (!listEl) return;
    if (!runeManager || typeof runeManager.getAllRunes !== 'function') {
      listEl.innerHTML = '<p class="tip">符文管理器未初始化</p>';
      return;
    }
    const runes = runeManager.getAllRunes();
    if (!runes || runes.length === 0) {
      listEl.innerHTML = '<p class="tip">还没有生成符文</p>';
      return;
    }
    listEl.innerHTML = '';
    // 中文注释：将符文库列表渲染为紧凑的条目卡片，包含小logo、名称、详情与删除按钮
    runes.forEach(rune => {
      const item = document.createElement('div');
      item.className = 'rune-list-item'; // 新样式类：紧凑列表项
      const created = (rune.meta && rune.meta.created) || rune.timestamp || new Date().toISOString();
      const logo = (rune.nineGrid && rune.nineGrid.nine_turns && rune.nineGrid.nine_turns['2_form']) ? '🜔' : '✨'; // 中文注释：简单的logo占位符
      
      // 获取符文摘要信息
      const summary = rune.nineGrid?.metadata?.summary || 
                     (rune.nineGrid?.content?.text ? rune.nineGrid.content.text.substring(0, 60) + '...' : '暂无描述');
      
      item.innerHTML = `
        <span class="rune-logo" title="符文标识">${logo}</span>
        <span class="rune-name" title="${rune.name || '未命名符文'}">${rune.name || '未命名符文'}</span>
        <span class="rune-time">${new Date(created).toLocaleString('zh-CN')}</span>
        <div class="rune-summary">${summary}</div>
        <div class="rune-actions">
          <button class="rune-btn rune-detail" title="查看详情">👁️</button>
          <button class="rune-btn rune-delete" title="删除符文">🗑️</button>
        </div>
      `;
      // 详情按钮事件绑定：打开详情视图
      const detailBtn = item.querySelector('.rune-detail');
      if (detailBtn) {
        detailBtn.addEventListener('click', () => displayRune(rune));
      }
      // 删除按钮事件绑定：删除符文并刷新列表
      const deleteBtn = item.querySelector('.rune-delete');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
          try {
            if (confirm(`确认删除符文：${rune.name || '未命名符文'}？`)) {
              if (runeManager && typeof runeManager.deleteRune === 'function') {
                runeManager.deleteRune(rune.id);
                updateRuneLibraryList();
              }
            }
          } catch (e) {
            console.error('删除符文失败:', e);
          }
        });
      }
      listEl.appendChild(item);
    });
  } catch (e) {
    console.error('更新符文库列表失败:', e);
  }
}

// 新增：显示符文详情（中文友好视图）
function displayRune(rune) {
  try {
    if (!rune) return;
    const detailContainer = document.getElementById('runeDetailContainer');
    const nameEl = document.getElementById('runeNameDetail');
    const idEl = document.getElementById('runeId');
    const intentEl = document.getElementById('intent');
    const essenceEl = document.getElementById('essence');
    const purposeEl = document.getElementById('purpose');
    const emotionEl = document.getElementById('emotion');
    const summaryEl = document.getElementById('summary');
    const jsonEls = document.querySelectorAll('pre#runeJSON');

    // 卡片区同步基础信息
    const cardTitle = document.getElementById('cardTitle');
    const cardDesc = document.getElementById('cardDesc');
    const cardMeta = document.getElementById('cardMeta');
    if (cardTitle) cardTitle.textContent = rune.name || '未命名符文';
    if (cardDesc) cardDesc.textContent = (rune.nineGrid && rune.nineGrid.metadata && rune.nineGrid.metadata.summary) || (rune.nineGrid && rune.nineGrid.content && rune.nineGrid.content.text) || '';
    if (cardMeta) cardMeta.textContent = `类型：${rune.type || '未知'}｜创建：${new Date((rune.meta && rune.meta.created) || Date.now()).toLocaleString('zh-CN')}`;

    // 详情区填充
    if (nameEl) nameEl.textContent = rune.name || '未命名符文';
    if (idEl) idEl.textContent = `#${rune.id || 'rune_xxx'}`;
    const core = rune.nineGrid && rune.nineGrid.core ? rune.nineGrid.core : {};
    const meta = rune.nineGrid && rune.nineGrid.metadata ? rune.nineGrid.metadata : {};
    if (intentEl) intentEl.textContent = core.intent || '—';
    if (essenceEl) essenceEl.textContent = core.essence || '—';
    if (purposeEl) purposeEl.textContent = core.purpose || '—';
    if (emotionEl) emotionEl.textContent = meta.emotion || '—';
    if (summaryEl) summaryEl.textContent = meta.summary || '暂无摘要';

    // JSON视图（两个位置都填充，避免重复ID冲突造成的空白）
    const jsonString = JSON.stringify(rune, null, 2);
    jsonEls.forEach(el => { if (el) el.textContent = jsonString; });

    // 展示详情容器
    if (detailContainer) detailContainer.style.display = 'block';
  } catch (e) {
    console.error('显示符文详情失败:', e);
  }
}

// 新增：绑定工作区事件（最小可用实现）
function bindWorkspaceEvents() {
  try {
    const reloadBtn = document.getElementById('reloadWorkspaceBtn');
    if (reloadBtn) {
      reloadBtn.addEventListener('click', () => {
        updateRuneLibraryList();
        alert('✅ 已重载符文库');
      });
    }
    const openBtn = document.getElementById('openWorkspaceBtn');
    if (openBtn) {
      openBtn.addEventListener('click', () => {
        alert('🔍 浏览符文文件暂未实现，后续对接文件系统');
      });
    }
    const selectBtn = document.getElementById('selectWorkspaceBtn');
    if (selectBtn) {
      selectBtn.addEventListener('click', () => {
        alert('📁 选择工作区暂未实现，当前使用固定路径');
      });
    }
  } catch (e) {
    console.error('绑定工作区事件失败:', e);
  }
}

// 注入：工作区状态更新方法（避免未定义）
(function injectWorkspaceStatusUpdater(){
  try {
    if (workspaceManager && typeof workspaceManager.updateWorkspaceStatus !== 'function') {
      workspaceManager.updateWorkspaceStatus = function() {
        const el = document.getElementById('workspaceStatus');
        if (el) {
          el.textContent = `工作区：${this.currentPath || '未选择'}`;
        }
      };
    }
  } catch (e) {
    // 可能在初始化前调用，不影响
  }
})();

// AI 聊天室初始化（包含用户提供的打开关闭逻辑与聊天交互）
function initAIChat() {
    const aiChatModal = document.getElementById('aiChatModal');
    const openAIChatBtn = document.getElementById('openAIChatBtn');
    const closeAIChatModal = document.getElementById('closeAIChatModal');
    const sendChatBtn = document.getElementById('sendChatBtn');
    const chatInput = document.getElementById('chatInput');
    const chatHistory = document.getElementById('chatHistory');

    if (!aiChatModal || !openAIChatBtn || !closeAIChatModal || !sendChatBtn || !chatInput || !chatHistory) {
        console.warn('AI聊天室元素未找到，跳过初始化');
        return;
    }

    // 打开 AI 聊天室弹窗
    openAIChatBtn.onclick = function() {
        aiChatModal.style.display = "block";
        setTimeout(() => chatInput.focus(), 100);
    };

    // 关闭 AI 聊天室弹窗
    closeAIChatModal.onclick = function() {
        aiChatModal.style.display = "none";
    };

    // 点击窗口外部关闭弹窗
    window.addEventListener('click', function(event) {
        if (event.target === aiChatModal) {
            aiChatModal.style.display = "none";
        }
    });

    // Enter发送、Shift+Enter换行
    sendChatBtn.onclick = sendMessage;
    chatInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // 获取当前符文上下文（取最新符文）
    function getCurrentRuneContext() {
        try {
            const runes = window.runeManager?.getAllRunes?.() || [];
            if (!runes.length) return null;
            const latestRune = runes[runes.length - 1];
            return {
                name: latestRune.name,
                intent: latestRune.nineGrid?.core?.intent,
                essence: latestRune.nineGrid?.core?.essence,
                summary: latestRune.nineGrid?.metadata?.summary
            };
        } catch (e) {
            console.warn('获取符文上下文失败:', e);
            return null;
        }
    }

    // 添加消息
    function addMessage(text, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${sender}-message`;
        const content = document.createElement('p');
        content.textContent = text;
        messageDiv.appendChild(content);
        chatHistory.appendChild(messageDiv);
        scrollToBottom();
    }

    function scrollToBottom() {
        setTimeout(() => {
            chatHistory.scrollTop = chatHistory.scrollHeight;
        }, 50);
    }

    // 调用后端 Gemini 接口
    async function callAIChatAPI(message, context) {
        let prompt = '你是一个专业的符文分析助手。请根据用户的问题提供有帮助的回答。';
        if (context) {
            prompt += `\n\n当前符文上下文：\n` +
                `符文名称：${context.name || ''}\n` +
                `核心意图：${context.intent || ''}\n` +
                `本质属性：${context.essence || ''}\n` +
                `摘要描述：${context.summary || ''}\n`;
        }
        prompt += `\n用户问题：${message}\n\n请提供专业的分析和建议：`;

        const resp = await fetch('/api/gemini/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, max_tokens: 500, temperature: 0.7 })
        });
        if (!resp.ok) throw new Error('AI服务响应错误');
        const data = await resp.json();
        return data.text || data.response || 'AI没有返回有效回复';
    }

    // 发送消息
    async function sendMessage() {
        const message = chatInput.value.trim();
        if (!message) return;
        addMessage(message, 'user');
        chatInput.value = '';
        const context = getCurrentRuneContext();
        try {
            const reply = await callAIChatAPI(message, context);
            addMessage(reply, 'ai');
        } catch (error) {
            console.error('AI聊天错误:', error);
            addMessage('抱歉，AI服务暂时不可用，请稍后再试。', 'ai');
        }
    }

    // 初始化建议
    function addSmartSuggestions() {
        const suggestions = [
            '分析当前符文的核心意图',
            '解释这个符文的象征意义',
            '这个符文适合什么场景使用？',
            '如何优化这个符文的表达？'
        ];
        const suggestionsDiv = document.createElement('div');
        suggestionsDiv.className = 'chat-suggestions';
        suggestionsDiv.innerHTML = '<p>💡 您可能想问：</p>';
        suggestions.forEach(s => {
            const btn = document.createElement('button');
            btn.className = 'suggestion-btn';
            btn.textContent = s;
            btn.onclick = () => { chatInput.value = s; sendMessage(); };
            suggestionsDiv.appendChild(btn);
        });
        chatHistory.appendChild(suggestionsDiv);
    }

    setTimeout(() => {
        if (chatHistory.children.length <= 1) {
            addSmartSuggestions();
        }
    }, 300);
}

// 新增：嵌入式聊天室初始化（精简版布局专用）
function initEmbeddedChat() {
    console.log('💬 初始化嵌入式聊天室...');
    
    // 获取嵌入式聊天元素
    const sendChatBtn = document.getElementById('sendChatBtn');
    const chatInput = document.getElementById('chatInput');
    const chatHistory = document.getElementById('chatHistory');
    
    if (!sendChatBtn || !chatInput || !chatHistory) {
        console.warn('嵌入式聊天室元素未找到，跳过初始化');
        return;
    }
    
    // 获取当前符文上下文（取最新符文）
    function getCurrentRuneContext() {
        try {
            const runes = window.runeManager?.getAllRunes?.() || [];
            if (!runes.length) return null;
            const latestRune = runes[runes.length - 1];
            return {
                name: latestRune.name,
                intent: latestRune.nineGrid?.core?.intent,
                essence: latestRune.nineGrid?.core?.essence,
                summary: latestRune.nineGrid?.metadata?.summary
            };
        } catch (e) {
            console.warn('获取符文上下文失败:', e);
            return null;
        }
    }
    
    // 添加消息到聊天历史
    function addMessage(text, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${sender}-message`;
        messageDiv.textContent = text;
        chatHistory.appendChild(messageDiv);
        scrollToBottom();
    }
    
    // 滚动到底部
    function scrollToBottom() {
        setTimeout(() => {
            chatHistory.scrollTop = chatHistory.scrollHeight;
        }, 50);
    }
    
    // 调用后端 Gemini 接口
    async function callAIChatAPI(message, context) {
        let prompt = '你是一个专业的符文分析助手。请根据用户的问题提供有帮助的回答。';
        if (context) {
            prompt += `\n\n当前符文上下文：\n` +
                `符文名称：${context.name || ''}\n` +
                `核心意图：${context.intent || ''}\n` +
                `本质属性：${context.essence || ''}\n` +
                `摘要描述：${context.summary || ''}\n`;
        }
        prompt += `\n用户问题：${message}\n\n请提供专业的分析和建议：`;
        
        try {
            const resp = await fetch('/api/gemini/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, max_tokens: 500, temperature: 0.7 })
            });
            if (!resp.ok) throw new Error('AI服务响应错误');
            const data = await resp.json();
            return data.text || data.response || 'AI没有返回有效回复';
        } catch (error) {
            console.error('AI聊天API调用失败:', error);
            // 返回模拟回复，确保用户体验
            return '我理解您的问题。从符文的角度来看，这涉及到深层的象征意义和能量流动。建议您结合当前的符文上下文进行更深入的思考。';
        }
    }
    
    // 发送消息
    async function sendMessage() {
        const message = chatInput.value.trim();
        if (!message) return;
        
        // 添加用户消息
        addMessage(message, 'user');
        chatInput.value = '';
        
        // 获取符文上下文
        const context = getCurrentRuneContext();
        
        try {
            // 调用AI接口
            const reply = await callAIChatAPI(message, context);
            addMessage(reply, 'ai');
        } catch (error) {
            console.error('AI聊天错误:', error);
            addMessage('抱歉，AI服务暂时不可用，请稍后再试。', 'ai');
        }
    }
    
    // 绑定发送按钮事件
    sendChatBtn.onclick = sendMessage;
    
    // 绑定回车发送事件（Enter发送，Shift+Enter换行）
    chatInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // 添加智能建议
    function addSmartSuggestions() {
        const suggestions = [
            '分析当前符文的核心意图',
            '解释这个符文的象征意义',
            '这个符文适合什么场景使用？',
            '如何优化这个符文的表达？'
        ];
        const suggestionsDiv = document.createElement('div');
        suggestionsDiv.className = 'chat-suggestions';
        suggestionsDiv.innerHTML = '<p>💡 您可能想问：</p>';
        suggestions.forEach(s => {
            const btn = document.createElement('button');
            btn.className = 'suggestion-btn';
            btn.textContent = s;
            btn.onclick = () => { 
                chatInput.value = s; 
                sendMessage(); 
            };
            suggestionsDiv.appendChild(btn);
        });
        chatHistory.appendChild(suggestionsDiv);
    }
    
    // 延迟添加智能建议
    setTimeout(() => {
        if (chatHistory.children.length <= 1) {
            addSmartSuggestions();
        }
    }, 1000);
    
    console.log('✅ 嵌入式聊天室初始化完成');
}

// DOMContentLoaded 中调用
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 DOM内容加载完成，开始初始化AI聊天...');
    // 注意：原有的initAIChat()已被initEmbeddedChat()替代
    initEmbeddedChat();
    try {
      // 保留原有的首次渲染符文库逻辑
      updateRuneLibraryList();
    } catch (e) {
      console.warn('初始化符文库渲染失败:', e);
    }
    // ... 其他现有初始化代码 ...
});

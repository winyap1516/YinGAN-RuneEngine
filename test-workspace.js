/**
 * 工作区绑定测试脚本
 * 用于验证工作区路径绑定和符文保存功能
 */

// 测试工作区管理器功能
async function testWorkspaceBinding() {
  console.log('🧪 开始测试工作区绑定功能...');
  
  try {
    // 动态导入main.js模块
    const mainModule = await import('./main.js');
    const workspaceManager = mainModule.workspaceManager;
    
    if (!workspaceManager) {
      throw new Error('工作区管理器未初始化');
    }
    
    console.log('✅ 工作区管理器获取成功');
    console.log('🏠 当前工作区路径:', workspaceManager.currentPath);
    
    // 验证工作区路径是否正确设置
    const expectedPath = 'D:\\YinGAN-RuneEngine\\myrune';
    if (workspaceManager.currentPath === expectedPath) {
      console.log('✅ 工作区路径绑定正确');
    } else {
      console.log('❌ 工作区路径绑定错误');
      console.log('期望路径:', expectedPath);
      console.log('实际路径:', workspaceManager.currentPath);
    }
    
    // 测试保存功能（创建模拟符文数据）
    console.log('📝 测试符文保存功能...');
    
    const mockRune = {
      name: '测试符文',
      nineGrid: {
        core: {
          intent: '测试意图',
          essence: '测试本质',
          purpose: '测试目的'
        },
        metadata: {
          emotion: '积极',
          keywords: ['测试', '工作区'],
          language: '中文'
        },
        content: {
          text: '这是一个测试符文的文本内容',
          imageDescription: '测试图像描述',
          audioTranscription: '测试音频转录',
          videoSummary: '测试视频摘要'
        }
      },
      unifiedVector: [0.1, 0.2, 0.3, 0.4, 0.5], // 模拟统一向量
      _fallback: false
    };
    
    const mockFiles = [
      new File(['测试文件内容'], 'test.txt', { type: 'text/plain' })
    ];
    
    // 调用保存函数
    const result = await workspaceManager.saveRune(mockRune, mockFiles);
    
    if (result.success) {
      console.log('✅ 符文保存成功!');
      console.log('📄 符文ID:', result.runeId);
      console.log('📁 文件路径:', result.filePath);
    } else {
      console.log('❌ 符文保存失败:', result.error);
    }
    
    // 测试状态显示更新
    console.log('🔄 测试工作区状态显示...');
    workspaceManager.updateWorkspaceStatus();
    
    console.log('✅ 工作区绑定测试完成！');
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

// 测试错误处理
async function testErrorHandling() {
  console.log('🧪 测试错误处理功能...');
  
  try {
    const mainModule = await import('./main.js');
    const workspaceManager = mainModule.workspaceManager;
    
    // 测试显示错误信息
    workspaceManager.showError('这是一个测试错误信息');
    
    console.log('✅ 错误处理测试完成');
    
  } catch (error) {
    console.error('❌ 错误处理测试失败:', error);
  }
}

// 运行测试
console.log('🚀 启动工作区绑定测试...');
testWorkspaceBinding().then(() => {
  return testErrorHandling();
}).then(() => {
  console.log('🎉 所有测试完成！');
}).catch(error => {
  console.error('❌ 测试过程中出现错误:', error);
});
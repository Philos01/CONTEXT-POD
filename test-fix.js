// 测试修复：删除联系人时同步删除风格画像和缓冲区数据
const fs = require('fs');
const path = require('path');

// 模拟 localStorage
const localStorage = {
  data: {},
  getItem(key) {
    return this.data[key] || null;
  },
  setItem(key, value) {
    this.data[key] = value;
  },
  removeItem(key) {
    delete this.data[key];
  }
};

// 模拟 global.localStorage
global.localStorage = localStorage;

// 导入服务
const { loadPersonas, savePersonas, loadDynamicPersonas, saveDynamicPersonas } = require('./src/services/personaService.ts');
const { loadBuffer, saveBuffer } = require('./src/services/evolutionEngine.ts');
const { loadContacts, saveContacts } = require('./src/stores/contactStore.ts');

console.log('=== 测试开始 ===');

// 1. 初始化测试数据
console.log('1. 初始化测试数据...');

// 创建测试联系人
const testContact = {
  id: 'test-1',
  name: '测试联系人',
  personality: '测试性格',
  tags: ['测试'],
  createdAt: Date.now(),
  updatedAt: Date.now()
};

// 保存联系人
const contacts = [testContact];
localStorage.setItem('context-pod-contacts', JSON.stringify(contacts));

// 创建测试风格画像
const testPersona = {
  sentenceStyle: '测试风格',
  catchphrases: ['测试'],
  emotionLevel: '高热量',
  vocabFeatures: '测试词汇',
  punctuationHabits: '测试标点',
  summary: '测试总结',
  sampleCount: 1,
  updatedAt: Date.now()
};

const personas = {
  '测试联系人': testPersona
};
localStorage.setItem('context-pod-personas', JSON.stringify(personas));

// 创建测试动态画像
const testDynamicPersona = {
  targetId: '测试联系人',
  updateTick: Date.now(),
  powerIdentity: [],
  psychologicalNeeds: [],
  taboos: [],
  temperature: 5,
  textStyle: '测试',
  experienceEvents: [],
  summary: '测试动态画像',
  sampleCount: 1,
  updatedAt: Date.now()
};

const dynamicPersonas = {
  '测试联系人': testDynamicPersona
};
localStorage.setItem('context-pod-dynamic-personas', JSON.stringify(dynamicPersonas));

// 创建测试缓冲区数据
const testBuffer = [
  {
    id: 'buffer-1',
    contactName: '测试联系人',
    content: '测试消息',
    role: 'partner',
    timestamp: Date.now(),
    processed: false
  }
];
localStorage.setItem('context-pod-chat-buffer', JSON.stringify(testBuffer));

console.log('✅ 测试数据初始化完成');
console.log('联系人数量:', JSON.parse(localStorage.getItem('context-pod-contacts')).length);
console.log('风格画像数量:', Object.keys(JSON.parse(localStorage.getItem('context-pod-personas') || '{}')).length);
console.log('动态画像数量:', Object.keys(JSON.parse(localStorage.getItem('context-pod-dynamic-personas') || '{}')).length);
console.log('缓冲区条目数量:', JSON.parse(localStorage.getItem('context-pod-chat-buffer')).length);

// 2. 模拟删除联系人
console.log('\n2. 模拟删除联系人...');

// 导入删除函数
const { deletePersona } = require('./src/services/personaService.ts');
const { deleteBufferEntriesByContact } = require('./src/services/evolutionEngine.ts');

// 执行删除操作
deletePersona('测试联系人');
deleteBufferEntriesByContact('测试联系人');

// 移除联系人记录
const updatedContacts = JSON.parse(localStorage.getItem('context-pod-contacts')).filter(c => c.id !== 'test-1');
localStorage.setItem('context-pod-contacts', JSON.stringify(updatedContacts));

console.log('✅ 联系人删除完成');
console.log('联系人数量:', JSON.parse(localStorage.getItem('context-pod-contacts')).length);
console.log('风格画像数量:', Object.keys(JSON.parse(localStorage.getItem('context-pod-personas') || '{}')).length);
console.log('动态画像数量:', Object.keys(JSON.parse(localStorage.getItem('context-pod-dynamic-personas') || '{}')).length);
console.log('缓冲区条目数量:', JSON.parse(localStorage.getItem('context-pod-chat-buffer')).length);

// 3. 验证结果
console.log('\n3. 验证结果...');

const finalContacts = JSON.parse(localStorage.getItem('context-pod-contacts'));
const finalPersonas = JSON.parse(localStorage.getItem('context-pod-personas') || '{}');
const finalDynamicPersonas = JSON.parse(localStorage.getItem('context-pod-dynamic-personas') || '{}');
const finalBuffer = JSON.parse(localStorage.getItem('context-pod-chat-buffer') || '[]');

const hasContact = finalContacts.some(c => c.name === '测试联系人');
const hasPersona = '测试联系人' in finalPersonas;
const hasDynamicPersona = '测试联系人' in finalDynamicPersonas;
const hasBufferEntries = finalBuffer.some(e => e.contactName === '测试联系人');

console.log('联系人是否存在:', hasContact);
console.log('风格画像是否存在:', hasPersona);
console.log('动态画像是否存在:', hasDynamicPersona);
console.log('缓冲区条目是否存在:', hasBufferEntries);

if (!hasContact && !hasPersona && !hasDynamicPersona && !hasBufferEntries) {
  console.log('\n🎉 测试通过！删除联系人时成功同步删除了所有相关数据');
} else {
  console.log('\n❌ 测试失败！删除联系人时未能同步删除所有相关数据');
}

console.log('\n=== 测试结束 ===');

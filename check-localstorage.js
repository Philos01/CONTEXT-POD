// 检查 localStorage 中的风格画像数据
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
  }
};

// 加载 localStorage 数据
const localStoragePath = path.join(process.env.APPDATA, 'Context-Pod', 'localStorage.json');
try {
  if (fs.existsSync(localStoragePath)) {
    const data = fs.readFileSync(localStoragePath, 'utf8');
    localStorage.data = JSON.parse(data);
  }
} catch (e) {
  console.log('No existing localStorage found');
}

// 检查风格画像数据
const personas = localStorage.getItem('context-pod-personas');
const dynamicPersonas = localStorage.getItem('context-pod-dynamic-personas');

console.log('=== 风格画像数据检查 ===');
if (personas) {
  const personaData = JSON.parse(personas);
  console.log('风格画像数量:', Object.keys(personaData).length);
  console.log('风格画像联系人:', Object.keys(personaData));
} else {
  console.log('风格画像数据不存在');
}

if (dynamicPersonas) {
  const dynamicPersonaData = JSON.parse(dynamicPersonas);
  console.log('动态画像数量:', Object.keys(dynamicPersonaData).length);
  console.log('动态画像联系人:', Object.keys(dynamicPersonaData));
} else {
  console.log('动态画像数据不存在');
}

// 检查联系人数据
const contacts = localStorage.getItem('context-pod-contacts');
if (contacts) {
  const contactData = JSON.parse(contacts);
  console.log('\n联系人数量:', contactData.length);
  console.log('联系人列表:', contactData.map(c => c.name));
} else {
  console.log('\n联系人数据不存在');
}

// 检查缓冲区数据
const buffer = localStorage.getItem('context-pod-chat-buffer');
if (buffer) {
  const bufferData = JSON.parse(buffer);
  console.log('\n缓冲区条目数量:', bufferData.length);
  // 统计每个联系人的缓冲区条目
  const contactBufferCounts = {};
  bufferData.forEach(entry => {
    contactBufferCounts[entry.contactName] = (contactBufferCounts[entry.contactName] || 0) + 1;
  });
  console.log('各联系人缓冲区条目:', contactBufferCounts);
} else {
  console.log('\n缓冲区数据不存在');
}

console.log('\n=== 检查完成 ===');

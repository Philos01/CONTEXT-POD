// 清理 localStorage 中的风格画像数据
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// 检查是否存在 localStorage 文件
const appDataPath = process.env.APPDATA || (process.platform === 'darwin' ? process.env.HOME + '/Library/Application Support' : process.env.HOME + '/.local/share');
const localStoragePath = path.join(appDataPath, 'Context-Pod', 'localStorage.json');

console.log('检查 localStorage 文件:', localStoragePath);

try {
  if (fs.existsSync(localStoragePath)) {
    console.log('找到 localStorage 文件，正在读取...');
    const data = fs.readFileSync(localStoragePath, 'utf8');
    localStorage.data = JSON.parse(data);
    console.log('成功加载 localStorage 数据');
  } else {
    console.log('未找到 localStorage 文件');
  }
} catch (e) {
  console.log('读取 localStorage 文件失败:', e.message);
}

// 检查当前数据
console.log('\n=== 当前数据状态 ===');
const personas = localStorage.getItem('context-pod-personas');
const dynamicPersonas = localStorage.getItem('context-pod-dynamic-personas');
const contacts = localStorage.getItem('context-pod-contacts');

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

if (contacts) {
  const contactData = JSON.parse(contacts);
  console.log('联系人数量:', contactData.length);
  console.log('联系人列表:', contactData.map(c => c.name));
} else {
  console.log('联系人数据不存在');
}

// 清理数据
console.log('\n=== 清理数据 ===');
localStorage.removeItem('context-pod-personas');
localStorage.removeItem('context-pod-dynamic-personas');
localStorage.removeItem('context-pod-chat-buffer');
localStorage.removeItem('context-pod-contacts');

console.log('已清理以下数据:');
console.log('- context-pod-personas');
console.log('- context-pod-dynamic-personas');
console.log('- context-pod-chat-buffer');
console.log('- context-pod-contacts');

// 保存清理后的数据
try {
  // 确保目录存在
  const dir = path.dirname(localStoragePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  fs.writeFileSync(localStoragePath, JSON.stringify(localStorage.data, null, 2));
  console.log('\n清理后的数据已保存');
} catch (e) {
  console.log('保存清理后的数据失败:', e.message);
}

console.log('\n=== 清理完成 ===');
console.log('现在重新启动应用，应该显示 0 个风格画像');

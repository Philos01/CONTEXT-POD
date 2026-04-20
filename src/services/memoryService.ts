import { create, insert, search } from '@orama/orama';
import type { Contact, ContactEmbedding } from '@/types';

let memoryDb: any = null;
let extractor: any = null;
let isInitialized = false;
let extractorLoadFailed = false;
let extractorLoadPromise: Promise<any> | null = null;

// Embedding 缓存 - 避免重复计算
const embeddingCache = new Map<string, number[]>();
const CACHE_MAX_SIZE = 100;

const EMBEDDING_DIMENSION = 384;

// 预加载模型（后台静默加载）
function preloadExtractor() {
  if (extractorLoadPromise || extractor || extractorLoadFailed) {
    return;
  }
  
  console.log('[Context-Pod] 🔄 Background: Preloading embedding model...');
  extractorLoadPromise = getExtractor();
}

async function getExtractor() {
  if (extractor) return extractor;
  if (extractorLoadFailed) return null;
  if (extractorLoadPromise) return extractorLoadPromise;
  
  try {
    console.log('[Context-Pod] Embedding model loading disabled (fallback mode)');
    
    // 临时禁用远程模型加载，使用 fallback 方案
    // 因为镜像配置在浏览器环境有问题
    extractorLoadFailed = true;
    extractorLoadPromise = null;
    return null;
    
  } catch (error) {
    console.error('[Context-Pod] ❌ Failed to load embedding model:', error);
    extractorLoadFailed = true;
    extractorLoadPromise = null;
    return null;
  }
}

async function getDatabase() {
  if (memoryDb) return memoryDb;
  memoryDb = await create({
    schema: {
      contactName: 'string',
      personality: 'string',
      embedding: `vector[${EMBEDDING_DIMENSION}]`,
    },
  });
  return memoryDb;
}

async function generateEmbedding(text: string): Promise<number[]> {
  // 检查缓存
  const cacheKey = text.substring(0, 200); // 用前200字符作为key
  if (embeddingCache.has(cacheKey)) {
    return embeddingCache.get(cacheKey)!;
  }
  
  const pipe = await getExtractor();
  
  if (!pipe) {
    console.log('[Context-Pod] Using fallback embedding (model not available)');
    const fallback = new Array(EMBEDDING_DIMENSION).fill(0);
    for (let i = 0; i < text.length && i < EMBEDDING_DIMENSION; i++) {
      fallback[i] = text.charCodeAt(i) / 65535;
    }
    return fallback;
  }
  
  try {
    const output = await pipe(text, { pooling: 'mean', normalize: true });
    const embedding = Array.from(output.data as Float32Array);
    
    // 存入缓存
    if (embeddingCache.size >= CACHE_MAX_SIZE) {
      const firstKey = embeddingCache.keys().next().value;
      if (firstKey) {
        embeddingCache.delete(firstKey);
      }
    }
    embeddingCache.set(cacheKey, embedding);
    
    return embedding;
  } catch (error) {
    console.error('[Context-Pod] Embedding generation failed:', error);
    return new Array(EMBEDDING_DIMENSION).fill(0);
  }
}

export async function initMemoryService(): Promise<void> {
  if (isInitialized) return;
  await getDatabase();
  isInitialized = true;
  console.log('[Context-Pod] Memory service initialized');
  
  // 后台静默预加载 Embedding 模型
  setTimeout(() => {
    preloadExtractor();
  }, 1000);
}

export async function addMemory(contact: Contact): Promise<string> {
  const db = await getDatabase();
  const embedding = await generateEmbedding(
    `${contact.name} ${contact.personality} ${contact.tags.join(' ')}`
  );
  const id = await insert(db, {
    contactName: contact.name,
    personality: contact.personality,
    embedding,
  });
  return id;
}

// 快速内存索引 - 用于快速路径查找（不依赖向量模型）
const contactNameIndex = new Map<string, string>();

export async function retrieveMemory(queryText: string, _limit: number = 3): Promise<string> {
  // 首先尝试精确的快速路径查找（完全不依赖向量搜索）
  const exactMatch = contactNameIndex.get(queryText);
  if (exactMatch) {
    console.log('[Context-Pod] ⚡ Fast path: Exact name match found');
    return exactMatch;
  }
  
  // 尝试部分匹配（也不依赖向量搜索）
  for (const [name, personality] of contactNameIndex) {
    if (queryText.includes(name) || name.includes(queryText)) {
      console.log('[Context-Pod] ⚡ Fast path: Partial name match found');
      return personality;
    }
  }
  
  // 如果快速查找没找到，直接返回默认值（不尝试向量搜索，避免报错）
  console.log('[Context-Pod] ⚡ Fast path: No match found, using fallback');
  return '暂无此人记录';
}

// 更新快速索引
export function updateContactIndex(contacts: Contact[]) {
  contactNameIndex.clear();
  for (const contact of contacts) {
    const personalityText = `【${contact.name}】性格特点：${contact.personality}`;
    contactNameIndex.set(contact.name, personalityText);
  }
  console.log(`[Context-Pod] Fast index updated with ${contacts.length} contacts`);
}

export async function searchContacts(query: string): Promise<ContactEmbedding[]> {
  const db = await getDatabase();
  const queryVector = await generateEmbedding(query);

  try {
    const results = await search(db, {
      mode: 'vector',
      vector: {
        value: queryVector,
        property: 'embedding',
      },
      limit: 10,
      similarity: 0.2,
    });

    return results.hits.map((hit: any) => ({
      contactName: hit.document.contactName,
      personality: hit.document.personality,
      embedding: hit.document.embedding,
    }));
  } catch {
    return [];
  }
}

export async function batchAddMemories(contacts: Contact[]): Promise<void> {
  for (const contact of contacts) {
    await addMemory(contact);
  }
}

export function isMemoryInitialized(): boolean {
  return isInitialized;
}
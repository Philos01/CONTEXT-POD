import { create, insert, search } from '@orama/orama';
import type { Contact, ContactEmbedding } from '@/types';

let memoryDb: any = null;
let extractor: any = null;
let isInitialized = false;
let extractorLoadFailed = false;

const EMBEDDING_DIMENSION = 384;

async function getExtractor() {
  if (extractor) return extractor;
  if (extractorLoadFailed) return null;
  
  try {
    console.log('[Context-Pod] Loading embedding model...');
    const { pipeline } = await import('@xenova/transformers');
    extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
      progress_callback: (progress: any) => {
        if (progress.status === 'downloading') {
          console.log(`[Context-Pod] Model download: ${Math.round(progress.progress || 0)}%`);
        }
      },
    });
    console.log('[Context-Pod] ✅ Embedding model loaded successfully');
    return extractor;
  } catch (error) {
    console.error('[Context-Pod] ❌ Failed to load embedding model:', error);
    extractorLoadFailed = true;
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
    return Array.from(output.data as Float32Array);
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

export async function retrieveMemory(queryText: string, limit: number = 3): Promise<string> {
  const db = await getDatabase();
  const queryVector = await generateEmbedding(queryText);

  try {
    const results = await search(db, {
      mode: 'vector',
      vector: {
        value: queryVector,
        property: 'embedding',
      },
      limit,
      similarity: 0.3,
    });

    if (results.hits.length === 0) return '暂无此人记录';

    return results.hits
      .map((hit: any) => {
        const doc = hit.document;
        return `【${doc.contactName}】性格特点：${doc.personality}`;
      })
      .join('\n');
  } catch {
    return '暂无此人记录';
  }
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
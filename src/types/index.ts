export type LLMProvider = 'deepseek' | 'openai' | 'qwen' | 'custom';

export interface Contact {
  id: string;
  name: string;
  personality: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export interface ContactEmbedding {
  contactName: string;
  personality: string;
  embedding: number[];
}

export interface AgentState {
  rawText: string;
  targetPerson: string;
  memoryData: string;
  finalPrompt: string;
  strategies: ReplyStrategy[];
}

export interface ReplyStrategy {
  label: string;
  style: string;
  content: string;
}

export interface AppSettings {
  provider: LLMProvider;
  apiKey: string;
  baseUrl: string;
  model: string;
  shortcutKey: string;
  embeddingModel: string;
  theme: 'light' | 'dark';
}

export interface CaptureResult {
  text: string;
  timestamp: number;
}

export interface ConversationMessage {
  role: 'user' | 'other';
  sender: string;
  content: string;
  timestamp: number;
}

export type WorkflowStage = 'idle' | 'capturing' | 'extracting' | 'retrieving' | 'generating' | 'ready';

export interface WorkflowProgress {
  stage: WorkflowStage;
  message: string;
}
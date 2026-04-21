export type LLMProvider = 'deepseek' | 'openai' | 'qwen' | 'custom';

export type ConversationPhase =
  | 'probing'
  | 'pressuring'
  | 'conflict'
  | 'cooling'
  | 'repairing';

export type TacticalGoal =
  | 'advance'
  | 'stabilize'
  | 'delay'
  | 'counterattack'
  | 'disengage';

export const CONVERSATION_PHASE_LABELS: Record<ConversationPhase, string> = {
  probing: '1-试探期',
  pressuring: '2-施压期',
  conflict: '3-冲突期',
  cooling: '4-冷处理期',
  repairing: '5-关系修复期',
};

export const TACTICAL_GOAL_LABELS: Record<TacticalGoal, string> = {
  advance: '推进关系',
  stabilize: '稳住局面',
  delay: '拖延',
  counterattack: '反击',
  disengage: '结束对话',
};

export interface PowerIdentityTrait {
  trait: string;
  confidence: number;
  observationsCount: number;
  decayRate: number;
}

export interface PsychologicalNeed {
  need: string;
  weight: number;
}

export interface TabooRule {
  rule: string;
  riskFactor: number;
}

export interface DynamicPersonaSchema {
  targetId: string;
  updateTick: number;
  powerIdentity: PowerIdentityTrait[];
  psychologicalNeeds: PsychologicalNeed[];
  taboos: TabooRule[];
  temperature: number;
  textStyle: string;
  experienceEvents: ExperienceEvent[];
  summary: string;
  sampleCount?: number;
  updatedAt?: number;
}

export interface ExperienceEvent {
  behaviorTrendDesc: string;
  timestamp: number;
}

export interface StylePersona {
  sentenceStyle: string;
  catchphrases: string[];
  emotionLevel: string;
  vocabFeatures: string;
  punctuationHabits: string;
  summary: string;
  sampleCount?: number;
  updatedAt?: number;
  isFallback?: boolean;
  fallbackReason?: string;
}

export interface Contact {
  id: string;
  name: string;
  personality: string;
  identity: string;
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
  conversationPhase: ConversationPhase;
  tacticalGoal: TacticalGoal;
  personaSection: string;
  feedbackSection: string;
}

export interface ReplyStrategy {
  label: string;
  style: string;
  tacticalGoal: string;
  content: string;
  riskLevel: 'low' | 'medium' | 'high';
  expectedReaction: string;
}

export interface StrategyEvaluation {
  result: 'success' | 'failure' | 'neutral';
  reason: string;
  adjustment: string;
  timestamp: number;
  contactName: string;
  strategyLabel: string;
  strategyContent: string;
  opponentResponse: string;
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

export type WorkflowStage =
  | 'idle'
  | 'capturing'
  | 'extracting'
  | 'classifying'
  | 'evaluating'
  | 'retrieving'
  | 'generating'
  | 'ready';

export interface WorkflowProgress {
  stage: WorkflowStage;
  message: string;
}

export type ConversationSessionState = {
  rawConvoArray: string[];
  tacticalGoalParam: TacticalGoal;
  evaluatedPhaseId: ConversationPhase;
  targetIdName: string;
  historicalEvaluationsSummary: string;
  proposedCardsOutputArray: ReplyStrategy[];
  personaSection: string;
  feedbackSection: string;
};

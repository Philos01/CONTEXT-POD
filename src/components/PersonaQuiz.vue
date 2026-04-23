<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAppStore } from '@/stores/appStore';
import { saveDynamicPersona, getDynamicPersona } from '@/services/personaService';
import { triggerPersonaUpdate, getBufferByContact, deleteBufferEntry, type ChatBufferEntry } from '@/services/evolutionEngine';
import type { DynamicPersonaSchema, ExperienceEvent } from '@/types';
import { alertService } from '@/services/alertService';

const emit = defineEmits<{
  back: [];
}>();

const appStore = useAppStore();

type QuizStep = 'intro' | 'mbti' | 'scenarios' | 'decoding' | 'result';

const currentStep = ref<QuizStep>('intro');
const currentDomainIndex = ref(0);
const currentScenarioIndex = ref(0);
const answers = ref<Record<string, { selected: string; custom?: string; domain: string; scenarioId: string }>>({});
const rawCustomAnswers = ref<Record<string, string>>({});
const decodedAnalysis = ref<Record<string, { temperature: number; aggression: number; fingerprint: string; tag: string }>>({});
const extractedPersona = ref<DynamicPersonaSchema | null>(null);
const isDecoding = ref(false);
const hasExistingPersona = ref(false);
const editingPersona = ref<DynamicPersonaSchema | null>(null);
const error = ref('');
const showRadarAnimation = ref(false);
const radarLevel = ref(0);
const decodingMessage = ref('');
const selectedMbti = ref('');

// 新增：自身风格的缓存管理
const selfBuffer = ref<ChatBufferEntry[]>([]);
const bufferExpanded = ref(false);
const isUpdatingSelfPersona = ref(false);
const isEditingSelfPersona = ref(false);
const editingSelfPersonaData = ref<DynamicPersonaSchema | null>(null);

const mbtiTypes = [
  { value: 'INTJ', label: 'INTJ', name: '建筑师', desc: '独立思考，战略眼光' },
  { value: 'INTP', label: 'INTP', name: '逻辑学家', desc: '好奇心强，分析能力出色' },
  { value: 'ENTJ', label: 'ENTJ', name: '指挥官', desc: '果断决策，天生领导者' },
  { value: 'ENTP', label: 'ENTP', name: '辩论家', desc: '聪明机智，喜欢挑战' },
  { value: 'INFJ', label: 'INFJ', name: '提倡者', desc: '安静神秘，坚定理想主义' },
  { value: 'INFP', label: 'INFP', name: '调停者', desc: '诗意善良，渴望理解' },
  { value: 'ENFJ', label: 'ENFJ', name: '主人公', desc: '魅力四射，鼓舞人心' },
  { value: 'ENFP', label: 'ENFP', name: '竞选者', desc: '热情自由，充满创造力' },
  { value: 'ISTJ', label: 'ISTJ', name: '物流师', desc: '务实可靠，责任感强' },
  { value: 'ISFJ', label: 'ISFJ', name: '守卫者', desc: '温暖守护，默默奉献' },
  { value: 'ESTJ', label: 'ESTJ', name: '总经理', desc: '高效管理，秩序井然' },
  { value: 'ESFJ', label: 'ESFJ', name: '执政官', desc: '热心助人，重视和谐' },
  { value: 'ISTP', label: 'ISTP', name: '鉴赏家', desc: '动手能力强，冷静观察' },
  { value: 'ISFP', label: 'ISFP', name: '探险家', desc: '艺术气息，活在当下' },
  { value: 'ESTP', label: 'ESTP', name: '企业家', desc: '精力充沛，行动派' },
  { value: 'ESFP', label: 'ESFP', name: '表演者', desc: '活泼热情，社交达人' },
];

const domains = [
  {
    id: 'Intimacy',
    name: '亲密拉扯场',
    description: '测量共情补给率、焦虑抗性',
    scenarios: [
      {
        id: 'intimacy_1',
        title: '深夜emo轰炸',
        desc: '暗恋对象半夜发来消息："突然觉得好孤独..."',
        options: [
          { label: 'A', text: '在吗？怎么啦？发生什么事了', style: '舔狗软泥版', temperature: 0.9, aggression: 0.1 },
          { label: 'B', text: '怎么了？需要我陪你说说吗？', style: '官方滴水不漏', temperature: 0.5, aggression: 0.3 },
          { label: 'C', text: '你又emo了？每次都这样，烦不烦啊', style: '高强度开火对拼', temperature: 0.8, aggression: 0.95 },
          { label: 'D', text: '嗯，能说说吗？我听着', style: '冷眼观察陪伴', temperature: 0.3, aggression: 0.2 },
        ],
      },
      {
        id: 'intimacy_2',
        title: '放鸽子爽约',
        desc: '相亲对象临时放鸽子："临时有事，改天再约吧..."你已经推掉了3个局等他',
        options: [
          { label: 'A', text: '好的呀～没关系，你忙你的下次再约', style: '舔狗软泥版', temperature: 0.95, aggression: 0.05 },
          { label: 'B', text: '好的，那看你的时间吧', style: '官方滴水不漏', temperature: 0.5, aggression: 0.2 },
          { label: 'C', text: '行吧，反正我也挺忙的', style: '冷嘲热讽版', temperature: 0.6, aggression: 0.8 },
          { label: 'D', text: '这是第4次了哦', style: '直球警告版', temperature: 0.4, aggression: 0.9 },
        ],
      },
    ],
  },
  {
    id: 'BloodRelation',
    name: '家庭血缘场',
    description: '逆向服从度、赛博尽孝',
    scenarios: [
      {
        id: 'blood_1',
        title: '春节亲戚盘问',
        desc: '过年聚会上，二大爷举着酒杯凑过来："谈对象了吗？怎么还不着急？"',
        options: [
          { label: 'A', text: '还没呢二大爷，现在工作忙，先拼事业', style: '乖巧敷衍版', temperature: 0.7, aggression: 0.1 },
          { label: 'B', text: '二大爷您说的对，我也想找呢，就是没遇到合适的', style: '官方滴水不漏', temperature: 0.6, aggression: 0.2 },
          { label: 'C', text: '二大爷您家孩子结婚了吗？房子买在哪了？', style: '反向输出版', temperature: 0.8, aggression: 0.9 },
          { label: 'D', text: '（低头狂吃装作没听见）', style: '冷眼装死版', temperature: 0.2, aggression: 0.05 },
        ],
      },
      {
        id: 'blood_2',
        title: '家族群转发养生文',
        desc: '老妈在家族群发了一篇《震惊！这种食物居然致癌！》',
        options: [
          { label: 'A', text: '妈，这是谣言啦，别信', style: '温和纠正版', temperature: 0.5, aggression: 0.4 },
          { label: 'B', text: '（默默点击收藏，从不打开）', style: '冷眼躺平版', temperature: 0.1, aggression: 0.05 },
          { label: 'C', text: '妈您少熬夜，比吃啥都管用', style: '转移话题版', temperature: 0.6, aggression: 0.6 },
          { label: 'D', text: '妈这篇文章我看了，说的是xxx，其实意思是...（认真分析）', style: '学术反击版', temperature: 0.5, aggression: 0.7 },
        ],
      },
    ],
  },
  {
    id: 'FriendsPeer',
    name: '损友/职场同级',
    description: '网感浓度、玩笑边界感',
    scenarios: [
      {
        id: 'friends_1',
        title: '同事甩锅',
        desc: '同事在群里说："这个数据是小王负责的，我只是帮他检查了一下"',
        options: [
          { label: 'A', text: '没事没事，我再核对一下', style: '舔狗背锅版', temperature: 0.8, aggression: 0.05 },
          { label: 'B', text: '好的，那我整理一下有问题再找你', style: '官方承接版', temperature: 0.5, aggression: 0.2 },
          { label: 'C', text: '哦，那麻烦你把检查意见发一下，我一起改', style: '绵里藏针版', temperature: 0.4, aggression: 0.7 },
          { label: 'D', text: '@同事 辛苦你把检查意见整理出来，我这边好统一修改', style: '直球挂人版', temperature: 0.6, aggression: 0.9 },
        ],
      },
      {
        id: 'friends_2',
        title: '室友吐槽对象',
        desc: '室友半夜找你吐槽："我真的受够了TA，这次一定要分手"',
        options: [
          { label: 'A', text: '啊？怎么了怎么了？说说发生什么事了', style: '共情倾听版', temperature: 0.9, aggression: 0.1 },
          { label: 'B', text: '你每次都这么说，第二天不又好了', style: '冷漠揭穿版', temperature: 0.3, aggression: 0.6 },
          { label: 'C', text: '分！这种人不分留着过年吗？我支持你！', style: '站队拱火版', temperature: 0.95, aggression: 0.8 },
          { label: 'D', text: '你需要我帮你分析分析吗？', style: '理性分析版', temperature: 0.4, aggression: 0.3 },
        ],
      },
    ],
  },
  {
    id: 'Conflict',
    name: '弱关联纯冲突',
    description: '索取硬度、诉诸法律核弹',
    scenarios: [
      {
        id: 'conflict_1',
        title: '外卖丢失被甩锅',
        desc: '外卖员把外卖放门口被偷了，客服说："外卖已送达，不在售后范围"',
        options: [
          { label: 'A', text: '好吧，那下次注意一下吧', style: '吃亏认栽版', temperature: 0.4, aggression: 0.05 },
          { label: 'B', text: '请提供外卖员的定位截图，我需要核实', style: '理性交涉版', temperature: 0.5, aggression: 0.4 },
          { label: 'C', text: '我这边有监控录像显示外卖员放下后2分钟外卖还在，要不我们看看？', style: '绵里藏针版', temperature: 0.5, aggression: 0.7 },
          { label: 'D', text: '根据《消费者权益保护法》第25条，我有权要求退款。', style: '法律核武器版', temperature: 0.3, aggression: 0.98 },
        ],
      },
      {
        id: 'conflict_2',
        title: '房东扣押金',
        desc: '退房时房东说："家具磨损要扣押金，这墙上还有个钉子眼"',
        options: [
          { label: 'A', text: '好吧好吧，扣就扣吧，我急着搬走', style: '吃亏认栽版', temperature: 0.5, aggression: 0.05 },
          { label: 'B', text: '这些是正常使用痕迹，合同里没写要扣押金吧？', style: '理性交涉版', temperature: 0.4, aggression: 0.4 },
          { label: 'C', text: '墙上那个钉子眼我住进来就有了，要不我们看看入住时的照片？', style: '绵里藏针版', temperature: 0.4, aggression: 0.7 },
          { label: 'D', text: '根据《民法典》第713条，房东应在租期届满时退还押金，逾期不退需支付利息。', style: '法律核武器版', temperature: 0.2, aggression: 0.98 },
        ],
      },
    ],
  },
];

const totalScenarios = computed(() => {
  return domains.reduce((acc, d) => acc + d.scenarios.length, 0);
});

const currentDomain = computed(() => domains[currentDomainIndex.value]);

const currentScenario = computed(() => {
  const domain = currentDomain.value;
  if (!domain) return null;
  return domain.scenarios[currentScenarioIndex.value];
});

const currentAnswerKey = computed(() => {
  if (!currentScenario.value) return '';
  return `${currentDomain.value.id}_${currentScenario.value.id}`;
});

const overallProgress = computed(() => {
  const answeredCount = Object.keys(answers.value).length;
  return Math.round((answeredCount / totalScenarios.value) * 100);
});

const answeredInCurrentDomain = computed(() => {
  const domainId = currentDomain.value?.id;
  if (!domainId) return 0;
  return Object.keys(answers.value).filter(k => k.startsWith(domainId + '_')).length;
});

const isLastScenarioInDomain = computed(() => {
  const domain = currentDomain.value;
  if (!domain) return false;
  return currentScenarioIndex.value >= domain.scenarios.length - 1;
});

const isLastScenarioOverall = computed(() => {
  if (currentDomainIndex.value >= domains.length - 1) {
    return isLastScenarioInDomain.value;
  }
  return false;
});

const radarData = computed(() => {
  const temps: number[] = [];
  const aggs: number[] = [];
  
  Object.values(answers.value).forEach(ans => {
    const domain = domains.find(d => d.id === ans.domain);
    const scenario = domain?.scenarios.find(s => s.id === ans.scenarioId);
    const opt = scenario?.options.find(o => o.label === ans.selected);
    if (opt) {
      temps.push(opt.temperature);
      aggs.push(opt.aggression);
    }
  });

  const avgTemp = temps.length > 0 ? temps.reduce((a, b) => a + b, 0) / temps.length : 0.5;
  const avgAgg = aggs.length > 0 ? aggs.reduce((a, b) => a + b, 0) / aggs.length : 0.5;

  return {
    temperature: Math.round(avgTemp * 10),
    aggression: Math.round(avgAgg * 10),
    intimacy: Math.round((avgTemp * 0.6 + avgAgg * 0.4) * 10),
    bloodRelation: Math.round(((1 - avgTemp) * 0.5 + avgAgg * 0.5) * 10),
    friends: Math.round((avgTemp * 0.7 + (1 - avgAgg) * 0.3) * 10),
    conflict: Math.round(avgAgg * 10),
  };
});

function getLevelFromScore(score: number): { level: number; label: string } {
  if (score >= 9) return { level: 10, label: '满级王者' };
  if (score >= 7) return { level: 7, label: '硬核阴阳师' };
  if (score >= 5) return { level: 5, label: '太极推手' };
  if (score >= 3) return { level: 3, label: '佛系防御盾' };
  return { level: 1, label: '萌新小白' };
}

const mainLevel = computed(() => getLevelFromScore(radarData.value.aggression));

function selectOption(option: { label: string; text: string; style: string; temperature: number; aggression: number }) {
  const key = currentAnswerKey.value;
  answers.value[key] = {
    selected: option.label,
    custom: undefined,
    domain: currentDomain.value.id,
    scenarioId: currentScenario.value?.id || '',
  };
}

function selectCustom() {
  const key = currentAnswerKey.value;
  const customText = rawCustomAnswers.value[key] || '';
  if (!customText.trim()) {
    error.value = '请先输入你的回复内容';
    return;
  }
  answers.value[key] = {
    selected: 'custom',
    custom: customText,
    domain: currentDomain.value.id,
    scenarioId: currentScenario.value?.id || '',
  };
  isDecoding.value = true;
  showRadarAnimation.value = true;
  decodeCustomAnswer(key, customText);
}

async function decodeCustomAnswer(key: string, text: string) {
  if (!appStore.isConfigured) {
    decodedAnalysis.value[key] = {
      temperature: 0.5,
      aggression: 0.5,
      fingerprint: '无法分析（请先配置API）',
      tag: '待标注',
    };
    isDecoding.value = false;
    return;
  }

  decodingMessage.value = '正在解析你的本能反应...';
  await new Promise(r => setTimeout(r, 500));
  
  const charCount = text.length;
  const exclaimCount = (text.match(/！|!|？|\?/g) || []).length;
  const emojiCount = (text.match(/[\u{1F300}-\u{1F9FF}]/gu) || []).length;
  const questionCount = (text.match(/怎么|为何|为什么|啥|干什么/g) || []).length;
  
  const temp = Math.min(1, Math.max(0, (charCount > 20 ? 0.7 : 0.3) + (exclaimCount > 0 ? 0.2 : 0) + (emojiCount > 0 ? 0.1 : 0)));
  const agg = Math.min(1, Math.max(0, (questionCount > 2 ? 0.8 : 0.3) + (text.includes('不') || text.includes('别') ? 0.2 : 0)));
  
  let fingerprint = '';
  let tag = '';
  
  if (charCount <= 5) {
    fingerprint = '极简断念式，惜字如金';
    tag = '极简赛博人';
  } else if (charCount > 30 && exclaimCount > 2) {
    fingerprint = '情绪饱满型，连发感叹号泄洪';
    tag = '高燃输出怪';
  } else if (text.includes('吗') || text.includes('呢') || questionCount > 1) {
    fingerprint = '疑问反问型，绵里藏针';
    tag = '太极推手';
  } else if (agg > 0.6) {
    fingerprint = '硬核对抗型，直接硬碰硬';
    tag = '硬核阴阳师';
  } else {
    fingerprint = '中性平稳型，理性沟通';
    tag = '普通社交人';
  }
  
  decodedAnalysis.value[key] = {
    temperature: temp,
    aggression: agg,
    fingerprint,
    tag,
  };
  
  radarLevel.value = Math.round(agg * 10);
  decodingMessage.value = `收到！本能回退扫描解析鉴定通过——您的抗压力高燃指涉标级为 Lv${radarLevel.value} ${tag}`;
  
  await new Promise(r => setTimeout(r, 1500));
  showRadarAnimation.value = false;
  isDecoding.value = false;
}

function nextScenario() {
  error.value = '';
  
  if (!answers.value[currentAnswerKey.value]) {
    error.value = '请选择一个选项或输入你的回复';
    return;
  }
  
  if (isLastScenarioOverall.value) {
    generateResult();
    return;
  }
  
  if (isLastScenarioInDomain.value) {
    if (currentDomainIndex.value < domains.length - 1) {
      currentDomainIndex.value++;
      currentScenarioIndex.value = 0;
    }
  } else {
    currentScenarioIndex.value++;
  }
}

function prevScenario() {
  error.value = '';
  
  if (currentScenarioIndex.value > 0) {
    currentScenarioIndex.value--;
  } else if (currentDomainIndex.value > 0) {
    currentDomainIndex.value--;
    const prevDomain = domains[currentDomainIndex.value];
    currentScenarioIndex.value = prevDomain.scenarios.length - 1;
  }
}

async function generateResult() {
  currentStep.value = 'decoding';
  
  decodingMessage.value = '正在分析你的社交DNA...';
  
  await new Promise(r => setTimeout(r, 1500));
  
  const radar = radarData.value;
  
  const zoneTraits: Record<string, { handlingVector: string; ban_zones: string }> = {};
  
  const intimacyData = radar.intimacy >= 7 
    ? { handlingVector: '高共情补给型，主动出击', ban_zones: '严禁冷暴力和突然消失' }
    : radar.intimacy >= 4 
    ? { handlingVector: '中等防御型，保持适度投入', ban_zones: '严禁过度追问和强迫' }
    : { handlingVector: '低粘度回避型，保持距离', ban_zones: '严禁过于热情和紧迫盯人' };
  zoneTraits['Intimacy'] = intimacyData;
  
  const bloodData = radar.bloodRelation >= 7
    ? { handlingVector: '高度服从型，乖巧配合', ban_zones: '严禁直接对抗和反驳长辈' }
    : radar.bloodRelation >= 4
    ? { handlingVector: '选择性配合，有限度服从', ban_zones: '严禁当众顶撞和不给面子' }
    : { handlingVector: '冷眼旁观型，能躲就躲', ban_zones: '严禁被逼急了直接翻脸' };
  zoneTraits['BloodRelation'] = bloodData;
  
  const friendsData = radar.friends >= 7
    ? { handlingVector: '重感情讲义气，两肋插刀型', ban_zones: '严禁背后说坏话和背叛信任' }
    : radar.friends >= 4
    ? { handlingVector: '适度投入，保持边界感', ban_zones: '严禁过度干涉私事' }
    : { handlingVector: '冷淡疏离型，泛泛之交', ban_zones: '严禁强行套近乎和绑架情感' };
  zoneTraits['FriendsPeer'] = friendsData;
  
  const conflictData = radar.conflict >= 7
    ? { handlingVector: '寸土必争型，硬核维权', ban_zones: '严禁一开始就认怂服软' }
    : radar.conflict >= 4
    ? { handlingVector: '有理有利有节，据理力争', ban_zones: '严禁情绪失控和人身攻击' }
    : { handlingVector: '吃亏是福型，息事宁人', ban_zones: '严禁被人蹬鼻子上脸还忍' };
  zoneTraits['Conflict'] = conflictData;
  
  const avgEnergy = radar.temperature >= 6 ? '高能量人格' : radar.temperature >= 4 ? '中能量人格' : '低电压人格';
  
  const experienceEvents: ExperienceEvent[] = [];
  Object.entries(decodedAnalysis.value).forEach(([key, analysis]) => {
    if (analysis.fingerprint && analysis.fingerprint !== '无法分析（请先配置API）') {
      experienceEvents.push({
        behaviorTrendDesc: `[${key}] ${analysis.fingerprint} (标签:${analysis.tag})`,
        timestamp: Date.now(),
      });
    }
  });
  
  extractedPersona.value = {
    targetId: '自我',
    updateTick: Date.now(),
    powerIdentity: [
      {
        trait: `社交能量等级：${avgEnergy}，抗压指数Lv${radar.aggression}，MBTI: ${selectedMbti.value}`,
        confidence: 0.9,
        observationsCount: totalScenarios.value,
        decayRate: 0.02,
      },
    ],
    psychologicalNeeds: [
      { need: '在不同场景下需要不同的应对策略', weight: 0.95 },
    ],
    taboos: Object.values(zoneTraits).map(z => ({
      rule: z.ban_zones,
      riskFactor: 0.9,
    })),
    temperature: radar.temperature,
    textStyle: `综合热度${radar.temperature}/10，攻击性${radar.aggression}/10`,
    experienceEvents,
    summary: `${mainLevel.value.label} | MBTI: ${selectedMbti.value} | 亲密度:${radar.intimacy} 血缘:${radar.bloodRelation} 友谊:${radar.friends} 冲突:${radar.conflict}`,
    sampleCount: totalScenarios.value,
    updatedAt: Date.now(),
  };
  
  saveDynamicPersona('自我', extractedPersona.value);
  
  currentStep.value = 'result';
}

function startRetest() {
  currentStep.value = 'intro';
  currentDomainIndex.value = 0;
  currentScenarioIndex.value = 0;
  answers.value = {};
  rawCustomAnswers.value = {};
  decodedAnalysis.value = {};
  extractedPersona.value = null;
  error.value = '';
  selectedMbti.value = '';
}

function goBack() {
  currentStep.value = 'intro';
  currentDomainIndex.value = 0;
  currentScenarioIndex.value = 0;
  answers.value = {};
  rawCustomAnswers.value = {};
  decodedAnalysis.value = {};
  extractedPersona.value = null;
  error.value = '';
  selectedMbti.value = '';
  emit('back');
}

function selectMbti(mbti: string) {
  selectedMbti.value = mbti;
}

function confirmMbti() {
  if (!selectedMbti.value) {
    error.value = '请选择你的 MBTI 人格类型';
    return;
  }
  currentDomainIndex.value = 0;
  currentScenarioIndex.value = 0;
  currentStep.value = 'scenarios';
}

// 新增：自身风格管理功能
function loadSelfBuffer() {
  selfBuffer.value = getBufferByContact('自我');
}

function toggleBufferExpand() {
  bufferExpanded.value = !bufferExpanded.value;
  if (bufferExpanded.value) {
    loadSelfBuffer();
  }
}

async function clearSelfBuffer() {
  const confirmed = await alertService.showConfirm('确定要清除所有对话缓存吗？');
  if (!confirmed) return;
  
  const buffer = getBufferByContact('自我');
  const ids = buffer.map(e => e.id);
  
  for (const id of ids) {
    deleteBufferEntry(id);
  }
  
  loadSelfBuffer();
  alertService.success('缓存已清除');
}

async function deleteSingleSelfBufferEntry(entryId: string) {
  const confirmed = await alertService.showConfirm('确定要删除这条缓存记录吗？');
  if (!confirmed) return;
  
  if (deleteBufferEntry(entryId)) {
    loadSelfBuffer();
    alertService.success('已删除');
  }
}

function startEditSelfPersona() {
  const persona = getDynamicPersona('自我');
  if (!persona) {
    editingSelfPersonaData.value = {
      targetId: '自我',
      updateTick: 0,
      powerIdentity: [{ trait: '待补充', confidence: 0.5, observationsCount: 0, decayRate: 0 }],
      psychologicalNeeds: [{ need: '待补充', weight: 0.5 }],
      taboos: [{ rule: '待补充', riskFactor: 0.5 }],
      temperature: 5,
      textStyle: '待补充',
      experienceEvents: [],
      summary: '待补充',
      sampleCount: 0,
      updatedAt: Date.now(),
    };
  } else {
    editingSelfPersonaData.value = JSON.parse(JSON.stringify(persona));
  }
  isEditingSelfPersona.value = true;
}

function cancelEditSelfPersona() {
  isEditingSelfPersona.value = false;
  editingSelfPersonaData.value = null;
}

function saveSelfPersonaEdit() {
  if (!editingSelfPersonaData.value) return;
  
  editingSelfPersonaData.value.updatedAt = Date.now();
  saveDynamicPersona('自我', editingSelfPersonaData.value);
  isEditingSelfPersona.value = false;
  editingSelfPersonaData.value = null;
  const existing = getDynamicPersona('自我');
  if (existing) {
    editingPersona.value = existing;
  }
}

async function updateSelfPersona() {
  if (!appStore.isConfigured) {
    alertService.warning('请先配置API密钥');
    return;
  }
  
  isUpdatingSelfPersona.value = true;
  
  try {
    const result = await triggerPersonaUpdate('自我', appStore.settings, true);
    if (result.success) {
      alertService.success('自身风格画像已更新');
      const existing = getDynamicPersona('自我');
      if (existing) {
        editingPersona.value = existing;
      }
      loadSelfBuffer();
    } else {
      alertService.warning('更新失败，请检查API配置');
    }
  } catch (error) {
    alertService.error('更新失败：' + (error as Error).message);
  } finally {
    isUpdatingSelfPersona.value = false;
  }
}

function addSelfPersonaTrait(type: 'powerIdentity' | 'psychologicalNeeds' | 'taboos') {
  if (!editingSelfPersonaData.value) return;
  
  if (type === 'powerIdentity') {
    editingSelfPersonaData.value.powerIdentity.push({ trait: '', confidence: 0.5, observationsCount: 0, decayRate: 0 });
  } else if (type === 'psychologicalNeeds') {
    editingSelfPersonaData.value.psychologicalNeeds.push({ need: '', weight: 0.5 });
  } else {
    editingSelfPersonaData.value.taboos.push({ rule: '', riskFactor: 0.5 });
  }
}

function removeSelfPersonaTrait(type: 'powerIdentity' | 'psychologicalNeeds' | 'taboos', index: number) {
  if (!editingSelfPersonaData.value) return;
  
  if (type === 'powerIdentity') {
    editingSelfPersonaData.value.powerIdentity.splice(index, 1);
  } else if (type === 'psychologicalNeeds') {
    editingSelfPersonaData.value.psychologicalNeeds.splice(index, 1);
  } else {
    editingSelfPersonaData.value.taboos.splice(index, 1);
  }
}

onMounted(() => {
  const existing = getDynamicPersona('自我');
  if (existing && existing.powerIdentity && existing.powerIdentity.length > 0) {
    hasExistingPersona.value = true;
    editingPersona.value = existing;
  }
  loadSelfBuffer();
});
</script>

<template>
  <div class="px-5 py-5 flex-1">
    <div v-if="currentStep !== 'intro'" class="mb-4">
      <div class="h-1 rounded-full overflow-hidden" style="background: var(--bg-tertiary);">
        <div 
          class="h-full transition-all duration-500"
          style="background: var(--accent-warm);"
          :style="{ width: `${overallProgress}%` }"
        ></div>
      </div>
    </div>

    <div v-if="currentStep === 'intro'" class="space-y-5">
      <div class="text-center py-6">
        <div class="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center" style="background: linear-gradient(135deg, rgba(139, 115, 85, 0.12) 0%, rgba(139, 115, 85, 0.06) 100%); border: 1px solid rgba(139, 115, 85, 0.15);">
          <svg class="w-7 h-7" style="color: var(--accent-warm);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </div>
        <h3 class="text-lg font-bold mb-2" style="color: var(--text-primary);">全场景数字分身冷启动</h3>
        <p class="text-sm mb-4" style="color: var(--text-tertiary);">通过5-8道"地狱级高压社交实境问答"<br/>在不经意间克隆你的社交DNA</p>
        
        <div v-if="hasExistingPersona" class="p-4 rounded-xl mb-6 space-y-4" style="background: rgba(139, 115, 85, 0.06); border: 1px solid rgba(139, 115, 85, 0.1);">
          <div class="flex items-center justify-between">
            <p class="text-xs font-medium" style="color: var(--accent-warm);">自身风格画像</p>
            <div class="flex gap-2">
              <button
                @click="startEditSelfPersona"
                class="btn-secondary text-xs px-3 py-1.5"
              >
                <svg class="w-3 h-3 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                编辑
              </button>
              <button
                @click="updateSelfPersona"
                :disabled="isUpdatingSelfPersona"
                class="btn-secondary text-xs px-3 py-1.5"
              >
                <svg v-if="isUpdatingSelfPersona" class="w-3 h-3 animate-spin inline-block mr-1" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {{ isUpdatingSelfPersona ? '更新中...' : '更新画像' }}
              </button>
            </div>
          </div>
          <p class="text-sm" style="color: var(--text-secondary);">{{ editingPersona?.summary }}</p>
          
          <!-- 对话缓存 -->
          <div class="pt-3" style="border-top: 1px solid rgba(139, 115, 85, 0.1);">
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-2">
                <svg class="w-3.5 h-3.5" style="color: var(--accent-warm);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <span class="text-xs font-medium" style="color: var(--text-secondary);">对话缓存</span>
                <span v-if="selfBuffer.length > 0" class="text-xs px-2 py-0.5 rounded-full" style="background: rgba(139, 115, 85, 0.12); color: var(--accent-warm);">
                  {{ selfBuffer.length }}条
                </span>
              </div>
              <div class="flex gap-2">
                <button
                  v-if="selfBuffer.length > 0"
                  @click="toggleBufferExpand"
                  class="text-xs"
                  style="color: var(--text-tertiary);"
                >
                  {{ bufferExpanded ? '收起' : '展开' }}
                </button>
                <button
                  v-if="selfBuffer.length > 0"
                  @click="clearSelfBuffer"
                  class="text-xs"
                  style="color: #dc2626;"
                >
                  清除
                </button>
              </div>
            </div>
            
            <div v-if="bufferExpanded && selfBuffer.length > 0" class="mt-2 space-y-2">
              <div
                v-for="entry in selfBuffer"
                :key="entry.id"
                class="p-2 rounded-lg text-xs"
                :style="entry.role === 'partner' ? 'background: rgba(139, 115, 85, 0.04);' : 'background: rgba(99, 102, 241, 0.04);'"
              >
                <div class="flex items-start gap-2">
                  <span class="text-[9px] font-medium" :style="entry.role === 'partner' ? 'color: var(--accent-warm);' : 'color: #6366f1;'">
                    {{ entry.role === 'partner' ? '对方' : '我' }}
                  </span>
                  <span class="flex-1">{{ entry.content }}</span>
                  <button
                    @click.stop="deleteSingleSelfBufferEntry(entry.id)"
                    class="p-0.5 rounded hover:bg-red-100 transition-colors flex-shrink-0"
                    title="删除这条记录"
                  >
                    <svg class="w-3.5 h-3.5 text-red-400 hover:text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
            <div v-else-if="bufferExpanded && selfBuffer.length === 0" class="text-xs text-center py-3" style="color: var(--text-tertiary);">
              暂无对话缓存
            </div>
          </div>
        </div>
        
        <button
          @click="currentStep = 'mbti'"
          class="btn-primary w-full"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          {{ hasExistingPersona ? '重新测试' : '开始捏脸' }}
        </button>
      </div>
      
      <!-- 自身风格编辑界面 -->
      <div v-if="isEditingSelfPersona && editingSelfPersonaData" class="p-4 rounded-xl space-y-4" style="background: rgba(139, 115, 85, 0.04); border: 1px solid rgba(139, 115, 85, 0.1);">
        <div class="flex items-center justify-between mb-2">
          <p class="text-xs font-medium" style="color: var(--accent-warm);">编辑自身风格画像</p>
          <button
            @click="cancelEditSelfPersona"
            class="text-xs"
            style="color: var(--text-tertiary);"
          >
            取消
          </button>
        </div>
        
        <div>
          <p class="text-[10px] font-medium mb-2 flex items-center gap-1.5" style="color: var(--accent-warm);">
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            权力身份特征
          </p>
          <div class="space-y-2">
            <div
              v-for="(trait, idx) in editingSelfPersonaData.powerIdentity"
              :key="idx"
              class="p-3 rounded-xl space-y-2"
              style="background: white; border: 1px solid var(--border-light);"
            >
              <div class="flex items-center justify-between">
                <span class="text-[10px] font-medium" style="color: var(--text-tertiary);">特征 #{{ idx + 1 }}</span>
                <button
                  @click="removeSelfPersonaTrait('powerIdentity', idx)"
                  class="text-red-400 hover:text-red-600 p-1 transition-colors"
                  title="删除"
                >
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <input
                v-model="trait.trait"
                type="text"
                placeholder="输入特征描述，如：社交能量等级：高能量人格"
                class="input-field text-xs"
              />
              <div class="flex items-center gap-3">
                <span class="text-[10px]" style="color: var(--text-tertiary);">置信度</span>
                <input
                  v-model.number="trait.confidence"
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  class="flex-1"
                />
                <span class="text-xs font-medium" style="color: var(--text-primary); min-width: 32px; text-align: right;">{{ (trait.confidence * 100).toFixed(0) }}%</span>
              </div>
            </div>
            <button
              @click="addSelfPersonaTrait('powerIdentity')"
              class="w-full py-2 text-xs rounded-xl border border-dashed transition-colors"
              style="border-color: var(--border-light); color: var(--accent-warm);"
            >
              <svg class="w-3.5 h-3.5 inline-block mr-1 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
              添加特征
            </button>
          </div>
        </div>

        <div>
          <p class="text-[10px] font-medium mb-2 flex items-center gap-1.5" style="color: var(--accent-warm);">
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
            核心诉求
          </p>
          <div class="space-y-2">
            <div
              v-for="(need, idx) in editingSelfPersonaData.psychologicalNeeds"
              :key="idx"
              class="p-3 rounded-xl space-y-2"
              style="background: white; border: 1px solid var(--border-light);"
            >
              <div class="flex items-center justify-between">
                <span class="text-[10px] font-medium" style="color: var(--text-tertiary);">诉求 #{{ idx + 1 }}</span>
                <button
                  @click="removeSelfPersonaTrait('psychologicalNeeds', idx)"
                  class="text-red-400 hover:text-red-600 p-1 transition-colors"
                  title="删除"
                >
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <input
                v-model="need.need"
                type="text"
                placeholder="输入诉求描述，如：在不同场景下需要不同的应对策略"
                class="input-field text-xs"
              />
              <div class="flex items-center gap-3">
                <span class="text-[10px]" style="color: var(--text-tertiary);">权重</span>
                <input
                  v-model.number="need.weight"
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  class="flex-1"
                />
                <span class="text-xs font-medium" style="color: var(--text-primary); min-width: 32px; text-align: right;">{{ (need.weight * 100).toFixed(0) }}%</span>
              </div>
            </div>
            <button
              @click="addSelfPersonaTrait('psychologicalNeeds')"
              class="w-full py-2 text-xs rounded-xl border border-dashed transition-colors"
              style="border-color: var(--border-light); color: var(--accent-warm);"
            >
              <svg class="w-3.5 h-3.5 inline-block mr-1 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
              添加诉求
            </button>
          </div>
        </div>

        <div>
          <p class="text-[10px] font-medium mb-2 flex items-center gap-1.5" style="color: #dc2626;">
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            沟通禁区
          </p>
          <div class="space-y-2">
            <div
              v-for="(taboo, idx) in editingSelfPersonaData.taboos"
              :key="idx"
              class="p-3 rounded-xl space-y-2"
              style="background: white; border: 1px solid rgba(220, 38, 38, 0.15);"
            >
              <div class="flex items-center justify-between">
                <span class="text-[10px] font-medium" style="color: var(--text-tertiary);">禁区 #{{ idx + 1 }}</span>
                <button
                  @click="removeSelfPersonaTrait('taboos', idx)"
                  class="text-red-400 hover:text-red-600 p-1 transition-colors"
                  title="删除"
                >
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <input
                v-model="taboo.rule"
                type="text"
                placeholder="输入禁区规则，如：严禁冷暴力和突然消失"
                class="input-field text-xs"
              />
              <div class="flex items-center gap-3">
                <span class="text-[10px]" style="color: var(--text-tertiary);">风险等级</span>
                <input
                  v-model.number="taboo.riskFactor"
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  class="flex-1"
                />
                <span class="text-xs font-medium" style="color: #dc2626; min-width: 32px; text-align: right;">{{ (taboo.riskFactor * 100).toFixed(0) }}%</span>
              </div>
            </div>
            <button
              @click="addSelfPersonaTrait('taboos')"
              class="w-full py-2 text-xs rounded-xl border border-dashed transition-colors"
              style="border-color: rgba(220, 38, 38, 0.2); color: #dc2626;"
            >
              <svg class="w-3.5 h-3.5 inline-block mr-1 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
              添加禁区
            </button>
          </div>
        </div>

        <div class="pt-2" style="border-top: 1px solid var(--border-light);">
          <p class="text-[10px] font-medium mb-2" style="color: var(--accent-warm);">情绪热度</p>
          <div class="p-3 rounded-xl" style="background: white; border: 1px solid var(--border-light);">
            <div class="flex items-center gap-3">
              <span class="text-[10px]" style="color: var(--text-tertiary);">冷静</span>
              <input
                v-model.number="editingSelfPersonaData.temperature"
                type="range"
                min="0"
                max="10"
                step="1"
                class="flex-1"
              />
              <span class="text-[10px]" style="color: var(--text-tertiary);">激烈</span>
              <span class="text-sm font-medium ml-2" style="color: var(--text-primary);">{{ editingSelfPersonaData.temperature }}</span>
            </div>
          </div>
        </div>

        <div>
          <p class="text-[10px] font-medium mb-2" style="color: var(--accent-warm);">文本风格</p>
          <textarea
            v-model="editingSelfPersonaData.textStyle"
            placeholder="描述你的文本风格特征，如：综合热度5/10，攻击性3/10"
            class="input-field resize-none text-xs"
            rows="2"
          ></textarea>
        </div>

        <div>
          <p class="text-[10px] font-medium mb-2" style="color: var(--accent-warm);">综合总结</p>
          <textarea
            v-model="editingSelfPersonaData.summary"
            placeholder="总结你的性格特征和沟通模式，如：太极推手 | 亲密度:6 血缘:4 友谊:7 冲突:3"
            class="input-field resize-none text-xs"
            rows="3"
          ></textarea>
        </div>

        <div class="flex gap-2 pt-2" style="border-top: 1px solid var(--border-light);">
          <button @click="cancelEditSelfPersona" class="btn-secondary flex-1">取消</button>
          <button @click="saveSelfPersonaEdit" class="btn-primary flex-1">
            <svg class="w-3.5 h-3.5 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            保存修改
          </button>
        </div>
      </div>
      
      <div class="text-center">
        <p class="text-xs mb-3" style="color: var(--text-tertiary);">涵盖4大高压关系场景</p>
        <div class="flex flex-wrap justify-center gap-2">
          <span class="badge" style="background: rgba(139, 115, 85, 0.06); color: var(--accent-warm);">亲密拉扯</span>
          <span class="badge" style="background: rgba(139, 115, 85, 0.06); color: var(--accent-warm);">家庭血缘</span>
          <span class="badge" style="background: rgba(139, 115, 85, 0.06); color: var(--accent-warm);">损友职场</span>
          <span class="badge" style="background: rgba(139, 115, 85, 0.06); color: var(--accent-warm);">弱关联冲突</span>
        </div>
      </div>
    </div>

    <div v-if="currentStep === 'mbti'" class="space-y-4">
      <div class="text-center mb-4">
        <div class="w-14 h-14 mx-auto mb-3 rounded-2xl flex items-center justify-center" style="background: linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(99, 102, 241, 0.06) 100%); border: 1px solid rgba(99, 102, 241, 0.15);">
          <svg class="w-6 h-6" style="color: #6366f1;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
        <h3 class="text-lg font-bold mb-2" style="color: var(--text-primary);">选择你的 MBTI 人格类型</h3>
        <p class="text-sm mb-4" style="color: var(--text-tertiary);">我们将结合MBTI特征与场景回答<br/>为你生成更精准的社交画像</p>
        
        <div class="grid grid-cols-4 gap-2 mb-4">
          <button
            v-for="type in mbtiTypes"
            :key="type.value"
            @click="selectMbti(type.value)"
            class="p-2 rounded-xl text-center transition-all duration-200 border"
            :class="selectedMbti === type.value 
              ? 'border-[var(--accent-warm)] ring-2 ring-[var(--accent-warm)] ring-opacity-20' 
              : 'border-[var(--border-light)] hover:border-[var(--accent-warm)]'"
            :style="selectedMbti === type.value ? 'background: rgba(139, 115, 85, 0.08);' : 'background: var(--bg-secondary);'"
          >
            <p class="text-sm font-bold" style="color: var(--text-primary);">{{ type.label }}</p>
            <p class="text-[10px] mt-0.5" style="color: var(--text-tertiary);">{{ type.name }}</p>
          </button>
        </div>
        
        <div v-if="selectedMbti" class="p-3 rounded-xl mb-4" style="background: rgba(99, 102, 241, 0.06); border: 1px solid rgba(99, 102, 241, 0.1);">
          <p class="text-sm font-medium" style="color: #6366f1;">{{ selectedMbti }} - {{ mbtiTypes.find(t => t.value === selectedMbti)?.name }}</p>
          <p class="text-xs mt-1" style="color: var(--text-secondary);">{{ mbtiTypes.find(t => t.value === selectedMbti)?.desc }}</p>
        </div>
        
        <button
          @click="confirmMbti"
          :disabled="!selectedMbti"
          class="btn-primary w-full"
          :class="!selectedMbti ? 'opacity-50 cursor-not-allowed' : ''"
        >
          确认并继续
        </button>
      </div>
      
      <button
        @click="currentStep = 'intro'"
        class="w-full py-2 text-sm"
        style="color: var(--text-tertiary);"
      >
        返回
      </button>
    </div>

    <div v-if="currentStep === 'scenarios'" class="space-y-4">
      <div class="flex items-center gap-3">
        <button @click="currentStep = 'mbti'" class="icon-btn">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div class="flex-1">
          <div class="flex items-center gap-2">
            <svg class="w-4 h-4" style="color: var(--accent-warm);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span class="text-sm font-medium" style="color: var(--text-primary);">{{ currentDomain?.name }}</span>
          </div>
          <p class="text-xs mt-0.5" style="color: var(--text-tertiary);">{{ answeredInCurrentDomain }}/{{ currentDomain?.scenarios.length }} 已完成</p>
        </div>
      </div>

      <div class="p-4 rounded-xl" style="background: var(--bg-secondary); border: 1px solid var(--border-light);">
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm font-medium" style="color: var(--accent-warm);">{{ currentScenario?.title }}</span>
          <span class="text-xs" style="color: var(--text-tertiary);">
            {{ domains.slice(0, currentDomainIndex).reduce((a, d) => a + d.scenarios.length, 0) + currentScenarioIndex + 1 }}/{{ totalScenarios }}
          </span>
        </div>
        <p class="text-sm" style="color: var(--text-secondary);">{{ currentScenario?.desc }}</p>
      </div>

      <div class="space-y-2">
        <button
          v-for="opt in currentScenario?.options"
          :key="opt.label"
          @click="selectOption(opt)"
          class="w-full p-3 text-left rounded-xl transition-all duration-200 border"
          :class="answers[currentAnswerKey]?.selected === opt.label 
            ? 'border-[var(--accent-warm)] ring-2 ring-[var(--accent-warm)] ring-opacity-20' 
            : 'border-[var(--border-subtle)] hover:border-[var(--accent-warm)]'"
          :style="answers[currentAnswerKey]?.selected === opt.label ? 'background: rgba(139, 115, 85, 0.04);' : 'background: white;'"
        >
          <div class="flex items-start gap-3">
            <span class="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-semibold flex-shrink-0" 
              :style="answers[currentAnswerKey]?.selected === opt.label ? 'background: var(--accent-warm); color: white;' : 'background: var(--bg-tertiary); color: var(--text-secondary);'">
              {{ opt.label }}
            </span>
            <div class="flex-1">
              <p class="text-sm" style="color: var(--text-primary);">{{ opt.text }}</p>
              <p class="text-xs mt-0.5" style="color: var(--text-tertiary);">{{ opt.style }}</p>
            </div>
          </div>
        </button>

        <div class="relative">
          <button
            @click="selectOption({ label: 'custom', text: '自定义', style: '', temperature: 0.5, aggression: 0.5 })"
            class="w-full p-3 text-left rounded-xl transition-all duration-200 border border-dashed"
            :class="answers[currentAnswerKey]?.selected === 'custom'
              ? 'border-[var(--accent-warm)] ring-2 ring-[var(--accent-warm)] ring-opacity-20'
              : 'border-[var(--border-subtle)] hover:border-[var(--accent-warm)]'"
            :style="answers[currentAnswerKey]?.selected === 'custom' ? 'background: rgba(139, 115, 85, 0.04);' : 'background: var(--bg-secondary);'"
          >
            <div class="flex items-center gap-3">
              <svg class="w-5 h-5" style="color: var(--accent-warm);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4v16m8-8H4" />
              </svg>
              <span class="text-sm" style="color: var(--text-primary);">第5选项：我要自己手打还击！</span>
            </div>
          </button>
          
          <div v-if="answers[currentAnswerKey]?.selected === 'custom'" class="mt-3">
            <textarea
              v-model="rawCustomAnswers[currentAnswerKey]"
              rows="2"
              placeholder="在这里输入你最想说的话..."
              class="input-field resize-none"
            ></textarea>
            <button
              @click="selectCustom"
              class="btn-primary w-full mt-2"
            >
              解析我的本能反应
            </button>
          </div>
        </div>
      </div>

      <div v-if="error" class="p-3 rounded-xl" style="background: rgba(239, 68, 68, 0.06); border: 1px solid rgba(239, 68, 68, 0.12);">
        <p class="text-sm" style="color: #dc2626;">{{ error }}</p>
      </div>

      <div class="flex gap-3">
        <button
          @click="prevScenario"
          :disabled="currentDomainIndex === 0 && currentScenarioIndex === 0"
          class="btn-secondary flex-1"
        >
          上一题
        </button>
        <button
          @click="nextScenario"
          :disabled="!answers[currentAnswerKey]"
          class="btn-primary flex-1"
        >
          {{ isLastScenarioOverall ? '生成画像' : '下一题' }}
        </button>
      </div>
    </div>

    <div v-if="currentStep === 'decoding'" class="py-12 text-center">
      <div v-if="showRadarAnimation" class="space-y-4">
        <div class="relative w-24 h-24 mx-auto">
          <div class="absolute inset-0 rounded-full border-2 animate-ping opacity-10" style="border-color: var(--accent-warm);"></div>
          <div class="absolute inset-2 rounded-full border-2 animate-pulse" style="border-color: var(--accent-warm);"></div>
          <div class="absolute inset-4 rounded-full border-2 animate-spin-slow" style="border-color: var(--accent-warm);"></div>
          <div class="absolute inset-0 flex items-center justify-center">
            <svg class="w-8 h-8" style="color: var(--accent-warm);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
        <p class="text-sm font-medium" style="color: var(--accent-warm);">{{ decodingMessage }}</p>
      </div>
      <div v-else class="space-y-4">
        <div class="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center" style="background: linear-gradient(135deg, rgba(139, 115, 85, 0.12) 0%, rgba(139, 115, 85, 0.06) 100%); border: 1px solid rgba(139, 115, 85, 0.15);">
          <svg class="w-7 h-7" style="color: var(--accent-warm);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p class="text-sm" style="color: var(--text-secondary);">{{ decodingMessage }}</p>
      </div>
    </div>

    <div v-if="currentStep === 'result' && extractedPersona" class="space-y-5">
      <div class="text-center py-4">
        <div class="w-20 h-20 mx-auto mb-3 rounded-full flex items-center justify-center" style="background: linear-gradient(135deg, rgba(139, 115, 85, 0.15) 0%, rgba(139, 115, 85, 0.08) 100%); border: 2px solid rgba(139, 115, 85, 0.2);">
          <svg class="w-9 h-9" style="color: var(--accent-warm);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 class="text-lg font-bold" style="color: var(--text-primary);">{{ mainLevel.label }}</h3>
        <p class="text-sm mt-1" style="color: var(--text-tertiary);">社交DNA鉴定完成</p>
      </div>

      <div class="p-4 rounded-2xl" style="background: var(--bg-secondary); border: 1px solid var(--border-light);">
        <p class="text-sm font-medium mb-4 text-center" style="color: var(--accent-warm);">社交雷达图</p>
        
        <div class="grid grid-cols-2 gap-6">
          <div class="flex flex-col items-center">
            <div class="stat-ring">
              <svg viewBox="0 0 36 36" class="w-full h-full">
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--bg-tertiary)" stroke-width="3"/>
                <circle 
                  cx="18" cy="18" r="15.5" 
                  fill="none" 
                  stroke="var(--accent-warm)" 
                  stroke-width="3" 
                  stroke-linecap="round"
                  :stroke-dasharray="`${radarData.temperature * 97.4 / 10} 97.4`"
                  class="transition-all duration-700"
                />
              </svg>
              <div class="stat-ring-value">{{ radarData.temperature }}</div>
            </div>
            <p class="text-xs mt-2" style="color: var(--text-tertiary);">热量指数</p>
          </div>
          
          <div class="flex flex-col items-center">
            <div class="stat-ring">
              <svg viewBox="0 0 36 36" class="w-full h-full">
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--bg-tertiary)" stroke-width="3"/>
                <circle 
                  cx="18" cy="18" r="15.5" 
                  fill="none" 
                  stroke="var(--accent-warm)" 
                  stroke-width="3" 
                  stroke-linecap="round"
                  :stroke-dasharray="`${radarData.aggression * 97.4 / 10} 97.4`"
                  class="transition-all duration-700"
                />
              </svg>
              <div class="stat-ring-value">{{ radarData.aggression }}</div>
            </div>
            <p class="text-xs mt-2" style="color: var(--text-tertiary);">攻击指数</p>
          </div>
        </div>
        
        <div class="mt-6 flex justify-center gap-6">
          <div class="text-center">
            <p class="text-base font-bold" style="color: var(--accent-warm);">{{ radarData.intimacy }}</p>
            <p class="text-xs" style="color: var(--text-tertiary);">亲密</p>
          </div>
          <div class="text-center">
            <p class="text-base font-bold" style="color: var(--accent-warm);">{{ radarData.bloodRelation }}</p>
            <p class="text-xs" style="color: var(--text-tertiary);">血缘</p>
          </div>
          <div class="text-center">
            <p class="text-base font-bold" style="color: var(--accent-warm);">{{ radarData.friends }}</p>
            <p class="text-xs" style="color: var(--text-tertiary);">友谊</p>
          </div>
          <div class="text-center">
            <p class="text-base font-bold" style="color: var(--accent-warm);">{{ radarData.conflict }}</p>
            <p class="text-xs" style="color: var(--text-tertiary);">冲突</p>
          </div>
        </div>
      </div>

      <div class="p-4 rounded-xl text-center" style="background: rgba(139, 115, 85, 0.04); border: 1px solid rgba(139, 115, 85, 0.1);">
        <p class="text-xs font-medium mb-1" style="color: var(--accent-warm);">赛博捏脸认证</p>
        <p class="text-sm font-semibold" style="color: var(--text-primary);">{{ mainLevel.label }}</p>
        <p class="text-xs mt-1" style="color: var(--text-tertiary);">抗压指数 Lv{{ radarData.aggression }} | 热量指数 {{ radarData.temperature }}/10</p>
      </div>

      <div class="space-y-2">
        <button
          @click="startRetest"
          class="btn-secondary w-full"
        >
          重新测试
        </button>
        <button
          @click="goBack"
          class="btn-secondary w-full"
        >
          返回
        </button>
      </div>
    </div>
  </div>
</template>

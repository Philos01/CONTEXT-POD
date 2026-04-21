<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAppStore } from '@/stores/appStore';
import { saveDynamicPersona, getDynamicPersona } from '@/services/personaService';
import type { DynamicPersonaSchema, ExperienceEvent } from '@/types';

const emit = defineEmits<{
  back: [];
}>();

const appStore = useAppStore();

type QuizStep = 'intro' | 'domains' | 'scenarios' | 'decoding' | 'result';

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
        trait: `社交能量等级：${avgEnergy}，抗压指数Lv${radar.aggression}`,
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
    summary: `${mainLevel.value.label} | 亲密度:${radar.intimacy} 血缘:${radar.bloodRelation} 友谊:${radar.friends} 冲突:${radar.conflict}`,
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
  emit('back');
}

onMounted(() => {
  const existing = getDynamicPersona('自我');
  if (existing && existing.powerIdentity && existing.powerIdentity.length > 0) {
    hasExistingPersona.value = true;
    editingPersona.value = existing;
  }
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
        
        <div v-if="hasExistingPersona" class="p-3 rounded-xl mb-4 text-left" style="background: rgba(139, 115, 85, 0.06); border: 1px solid rgba(139, 115, 85, 0.1);">
          <p class="text-xs font-medium mb-1" style="color: var(--accent-warm);">已完成的测试</p>
          <p class="text-sm" style="color: var(--text-secondary);">{{ editingPersona?.summary }}</p>
        </div>
        
        <button
          @click="currentStep = 'domains'"
          class="btn-primary w-full"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          {{ hasExistingPersona ? '重新测试' : '开始捏脸' }}
        </button>
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

    <div v-if="currentStep === 'domains'" class="space-y-4">
      <div class="text-center mb-4">
        <p class="text-sm font-medium" style="color: var(--text-primary);">选择要测试的场景域</p>
        <p class="text-xs mt-1" style="color: var(--text-tertiary);">可以按任意顺序测试，跳过不想要的场景</p>
      </div>
      
      <div class="grid grid-cols-2 gap-3">
        <button
          v-for="(domain, idx) in domains"
          :key="domain.id"
          @click="currentDomainIndex = idx; currentScenarioIndex = 0; currentStep = 'scenarios'"
          class="p-4 rounded-2xl text-left transition-all duration-200"
          style="background: var(--bg-secondary); border: 1px solid var(--border-light);"
        >
          <div class="flex items-center gap-2 mb-2">
            <svg class="w-5 h-5" style="color: var(--accent-warm);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span class="text-sm font-medium" style="color: var(--text-primary);">{{ domain.name }}</span>
          </div>
          <p class="text-xs mb-2" style="color: var(--text-tertiary);">{{ domain.description }}</p>
          <p class="text-xs" style="color: var(--text-tertiary);">{{ domain.scenarios.length }}道题</p>
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
        <button @click="currentStep = 'domains'" class="icon-btn">
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

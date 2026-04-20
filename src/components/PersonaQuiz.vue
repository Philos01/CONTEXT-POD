<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAppStore } from '@/stores/appStore';
import { extractStyleFromQuiz, savePersona, getPersona } from '@/services/personaService';
import type { StylePersona } from '@/types';

const emit = defineEmits<{
  back: [];
}>();

const appStore = useAppStore();

const step = ref<0 | 1 | 2 | 3 | 'extracting' | 'result' | 'edit-existing'>(0);
const mbti = ref('');
const answers = ref(['', '', '']);
const extractedPersona = ref<StylePersona | null>(null);
const error = ref('');
const editingPersona = ref<StylePersona | null>(null);
const hasExistingPersona = ref(false);

const scenarios = [
  {
    title: '场景一：深夜加班',
    desc: '周末晚上 11 点，老板突然发微信："在忙吗？有个方案改一下。"',
    hint: '凭直觉，用最本能的方式回复',
  },
  {
    title: '场景二：社交拒绝',
    desc: '相亲对象第一次约你周末吃饭，但你真的很想在家打游戏。',
    hint: '你怎么拒绝？',
  },
  {
    title: '场景三：快乐分享',
    desc: '好朋友发来一个极其好笑的搞笑视频。',
    hint: '你怎么回应？',
  },
];

const stepNumber = computed(() => {
  const s = step.value;
  return typeof s === 'number' ? s : 0;
});

const isInScenario = computed(() => {
  return [1, 2, 3].includes(stepNumber.value);
});

const currentScenario = computed(() => {
  const n = stepNumber.value;
  if (n >= 1 && n <= 3) return scenarios[n - 1];
  return null;
});

const currentAnswerIndex = computed(() => stepNumber.value - 1);

const isLastStep = computed(() => stepNumber.value >= 3);

function prevStep() {
  const n = stepNumber.value;
  if (n > 0) step.value = (n - 1) as 0 | 1 | 2 | 3;
}

function nextStep() {
  const n = stepNumber.value;
  if (answers.value[n - 1]?.trim()) {
    if (n < 3) {
      step.value = (n + 1) as 1 | 2 | 3;
    }
  } else {
    error.value = '请输入回复';
  }
}

onMounted(() => {
  const existing = getPersona('我');
  if (existing && existing.summary && existing.summary !== '风格提取失败') {
    hasExistingPersona.value = true;
    editingPersona.value = { ...existing, catchphrases: [...existing.catchphrases] };
  }
});

async function submitQuiz() {
  if (!answers.value[0].trim() || !answers.value[1].trim() || !answers.value[2].trim()) {
    error.value = '请完成所有场景回复';
    return;
  }

  if (!mbti.value.trim()) {
    error.value = '请输入你的 MBTI 人格';
    return;
  }

  if (!appStore.isConfigured) {
    error.value = '请先在设置中配置 API Key';
    return;
  }

  step.value = 'extracting';
  error.value = '';

  try {
    const persona = await extractStyleFromQuiz(answers.value, mbti.value, appStore.settings);
    extractedPersona.value = persona;
    savePersona('我', persona);
    hasExistingPersona.value = true;
    editingPersona.value = { ...persona, catchphrases: [...persona.catchphrases] };
    step.value = 'result';
  } catch (e) {
    error.value = `提取失败: ${e}`;
    step.value = 3;
  }
}

function startRetest() {
  step.value = 0;
  answers.value = ['', '', ''];
  mbti.value = '';
  extractedPersona.value = null;
  error.value = '';
}

function startEditExisting() {
  const existing = getPersona('我');
  if (existing) {
    editingPersona.value = { ...existing, catchphrases: [...existing.catchphrases] };
  }
  step.value = 'edit-existing';
}

function saveEditExisting() {
  if (editingPersona.value) {
    editingPersona.value.updatedAt = Date.now();
    savePersona('我', editingPersona.value);
    hasExistingPersona.value = true;
    step.value = 0;
  }
}

function addCatchphrase() {
  if (editingPersona.value) {
    editingPersona.value.catchphrases.push('');
  }
}

function removeCatchphrase(index: number) {
  if (editingPersona.value) {
    editingPersona.value.catchphrases.splice(index, 1);
  }
}

function deleteMyPersona() {
  const personas = JSON.parse(localStorage.getItem('context-pod-personas') || '{}');
  delete personas['我'];
  localStorage.setItem('context-pod-personas', JSON.stringify(personas));
  hasExistingPersona.value = false;
  editingPersona.value = null;
  step.value = 0;
}

function goBack() {
  step.value = 0;
  answers.value = ['', '', ''];
  mbti.value = '';
  extractedPersona.value = null;
  error.value = '';
  emit('back');
}
</script>

<template>
  <div class="p-4">
    <!-- Header -->
    <div class="flex items-center gap-2 mb-4">
      <button @click="goBack" class="text-gray-400 hover:text-gray-600">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <h2 class="text-sm font-medium text-gray-700">🧬 赛博捏脸</h2>
    </div>

    <!-- Existing Persona Management -->
    <div v-if="step === 0 && hasExistingPersona" class="space-y-3">
      <div class="text-center mb-3">
        <div class="text-2xl mb-1">🧬</div>
        <p class="text-sm font-medium text-gray-700">你已有风格画像</p>
      </div>

      <!-- Current Persona Preview -->
      <div class="p-3 bg-purple-50 rounded-lg border border-purple-200 space-y-1.5">
        <div v-for="(value, key) in { '断句排版': editingPersona?.sentenceStyle, '情绪风格': editingPersona?.emotionLevel, '词汇特征': editingPersona?.vocabFeatures, '标点习惯': editingPersona?.punctuationHabits }" :key="key">
          <span class="text-[10px] font-medium text-purple-600">{{ key }}：</span>
          <span class="text-[10px] text-purple-500">{{ value }}</span>
        </div>
        <div>
          <span class="text-[10px] font-medium text-purple-600">口癖语气：</span>
          <span class="text-[10px] text-purple-500">{{ editingPersona?.catchphrases?.join('、') || '无' }}</span>
        </div>
        <div class="pt-1 border-t border-purple-200">
          <span class="text-[10px] font-medium text-purple-600">风格总结：</span>
          <span class="text-[10px] text-purple-500">{{ editingPersona?.summary }}</span>
        </div>
      </div>

      <div class="space-y-1.5">
        <button
          @click="startEditExisting"
          class="w-full py-2 text-xs bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
        >
          ✏️ 编辑风格画像
        </button>
        <button
          @click="startRetest"
          class="w-full py-2 text-xs bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 border border-purple-200 transition-colors"
        >
          🔄 重新测试
        </button>
        <button
          @click="deleteMyPersona"
          class="w-full py-2 text-xs bg-red-50 text-red-400 rounded-lg hover:bg-red-100 border border-red-200 transition-colors"
        >
          🗑️ 删除画像
        </button>
        <button
          @click="goBack"
          class="w-full py-2 text-xs bg-gray-100 text-gray-500 rounded-lg hover:bg-gray-200 transition-colors"
        >
          ← 返回
        </button>
      </div>
    </div>

    <!-- MBTI Input (New Test) -->
    <div v-if="step === 0 && !hasExistingPersona" class="space-y-3">
      <div class="text-center mb-3">
        <div class="text-2xl mb-1">🧬</div>
        <p class="text-sm font-medium text-gray-700">30秒赛博捏脸测试</p>
        <p class="text-xs text-gray-400 mt-1">回答3个场景题，建立你的基础发声模型</p>
      </div>

      <div>
        <p class="text-xs text-gray-500 mb-1">你的 MBTI 人格：</p>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="type in ['INTJ', 'INTP', 'ENTJ', 'ENTP', 'INFJ', 'INFP', 'ENFJ', 'ENFP', 'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ', 'ISTP', 'ISFP', 'ESTP', 'ESFP']"
            :key="type"
            @click="mbti = type"
            class="px-2 py-0.5 text-xs rounded border transition-colors"
            :class="mbti === type ? 'bg-purple-500 text-white border-purple-500' : 'bg-purple-50 text-purple-600 border-purple-200 hover:bg-purple-100'"
          >
            {{ type }}
          </button>
        </div>
      </div>

      <button
        @click="mbti ? step = 1 : error = '请选择 MBTI'"
        class="w-full py-2 text-xs bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
      >
        开始测试 →
      </button>

      <div v-if="error" class="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-600">
        {{ error }}
      </div>
    </div>

    <!-- Scenario Questions -->
    <div v-if="isInScenario" class="space-y-3">
      <div class="mb-3">
        <div class="flex items-center gap-2 mb-2">
          <span class="text-xs font-medium text-purple-600">{{ currentScenario?.title }}</span>
          <span class="text-xs text-gray-400">{{ stepNumber }}/3</span>
        </div>
        <p class="text-sm text-gray-700 mb-1">{{ currentScenario?.desc }}</p>
        <p class="text-xs text-gray-400">{{ currentScenario?.hint }}</p>
      </div>

      <textarea
        v-model="answers[currentAnswerIndex]"
        rows="3"
        placeholder="输入你的回复..."
        class="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none"
      ></textarea>

      <div class="flex gap-2">
        <button
          @click="prevStep"
          class="flex-1 py-2 text-xs bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
        >
          ← 上一题
        </button>
        <button
          v-if="!isLastStep"
          @click="nextStep"
          class="flex-1 py-2 text-xs bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
        >
          下一题 →
        </button>
        <button
          v-else
          @click="submitQuiz"
          class="flex-1 py-2 text-xs bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
        >
          🧬 生成风格画像
        </button>
      </div>

      <div v-if="error" class="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-600">
        {{ error }}
      </div>
    </div>

    <!-- Extracting -->
    <div v-if="step === 'extracting'" class="py-8 text-center">
      <div class="inline-flex items-center gap-2 text-purple-500">
        <svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span class="text-sm">正在分析你的聊天DNA...</span>
      </div>
    </div>

    <!-- Result -->
    <div v-if="step === 'result' && extractedPersona" class="space-y-3">
      <div class="text-center mb-3">
        <div class="text-2xl mb-1">🎉</div>
        <p class="text-sm font-medium text-gray-700">你的风格画像已生成！</p>
        <p class="text-xs text-gray-400">后续回复将自动模仿你的风格</p>
      </div>

      <div class="p-3 bg-purple-50 rounded-lg border border-purple-200 space-y-2">
        <div>
          <span class="text-xs font-medium text-purple-600">断句排版：</span>
          <span class="text-xs text-purple-500">{{ extractedPersona.sentenceStyle }}</span>
        </div>
        <div>
          <span class="text-xs font-medium text-purple-600">口癖语气：</span>
          <span class="text-xs text-purple-500">{{ extractedPersona.catchphrases.join('、') || '无' }}</span>
        </div>
        <div>
          <span class="text-xs font-medium text-purple-600">情绪风格：</span>
          <span class="text-xs text-purple-500">{{ extractedPersona.emotionLevel }}</span>
        </div>
        <div>
          <span class="text-xs font-medium text-purple-600">词汇特征：</span>
          <span class="text-xs text-purple-500">{{ extractedPersona.vocabFeatures }}</span>
        </div>
        <div>
          <span class="text-xs font-medium text-purple-600">标点习惯：</span>
          <span class="text-xs text-purple-500">{{ extractedPersona.punctuationHabits }}</span>
        </div>
        <div class="pt-1 border-t border-purple-200">
          <span class="text-xs font-medium text-purple-600">风格总结：</span>
          <span class="text-xs text-purple-500">{{ extractedPersona.summary }}</span>
        </div>
      </div>

      <div class="space-y-1.5">
        <button
          @click="startEditExisting"
          class="w-full py-2 text-xs bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
        >
          ✏️ 编辑风格画像
        </button>
        <button
          @click="startRetest"
          class="w-full py-2 text-xs bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 border border-purple-200 transition-colors"
        >
          🔄 重新测试
        </button>
        <button
          @click="goBack"
          class="w-full py-2 text-xs bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
        >
          ← 返回
        </button>
      </div>
    </div>

    <!-- Edit Existing Persona -->
    <div v-if="step === 'edit-existing' && editingPersona" class="space-y-3">
      <div class="text-center mb-2">
        <p class="text-sm font-medium text-gray-700">✏️ 编辑风格画像</p>
      </div>

      <div class="space-y-2">
        <div>
          <label class="text-[10px] font-medium text-purple-600 block mb-0.5">断句排版</label>
          <input
            v-model="editingPersona.sentenceStyle"
            class="w-full px-2 py-1.5 text-xs border border-purple-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-300"
          />
        </div>
        <div>
          <label class="text-[10px] font-medium text-purple-600 block mb-0.5">情绪风格</label>
          <input
            v-model="editingPersona.emotionLevel"
            class="w-full px-2 py-1.5 text-xs border border-purple-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-300"
          />
        </div>
        <div>
          <label class="text-[10px] font-medium text-purple-600 block mb-0.5">词汇特征</label>
          <input
            v-model="editingPersona.vocabFeatures"
            class="w-full px-2 py-1.5 text-xs border border-purple-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-300"
          />
        </div>
        <div>
          <label class="text-[10px] font-medium text-purple-600 block mb-0.5">标点习惯</label>
          <input
            v-model="editingPersona.punctuationHabits"
            class="w-full px-2 py-1.5 text-xs border border-purple-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-300"
          />
        </div>
        <div>
          <label class="text-[10px] font-medium text-purple-600 block mb-0.5">口癖语气</label>
          <div class="space-y-1">
            <div v-for="(_, index) in editingPersona.catchphrases" :key="index" class="flex gap-1">
              <input
                v-model="editingPersona.catchphrases[index]"
                class="flex-1 px-2 py-1 text-xs border border-purple-200 rounded focus:outline-none focus:ring-1 focus:ring-purple-300"
              />
              <button
                @click="removeCatchphrase(index)"
                class="px-1.5 text-xs text-red-400 hover:text-red-600"
              >
                ×
              </button>
            </div>
            <button
              @click="addCatchphrase"
              class="text-[10px] text-purple-500 hover:text-purple-700"
            >
              + 添加口癖
            </button>
          </div>
        </div>
        <div>
          <label class="text-[10px] font-medium text-purple-600 block mb-0.5">风格总结</label>
          <textarea
            v-model="editingPersona.summary"
            rows="2"
            class="w-full px-2 py-1.5 text-xs border border-purple-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-300 resize-none"
          ></textarea>
        </div>
      </div>

      <div class="flex gap-2">
        <button
          @click="saveEditExisting"
          class="flex-1 py-2 text-xs bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
        >
          💾 保存修改
        </button>
        <button
          @click="step = 0"
          class="flex-1 py-2 text-xs bg-gray-100 text-gray-500 rounded-lg hover:bg-gray-200 transition-colors"
        >
          取消
        </button>
      </div>
    </div>
  </div>
</template>

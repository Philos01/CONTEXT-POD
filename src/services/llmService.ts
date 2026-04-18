import { createOpenAI } from '@ai-sdk/openai';
import { generateText, streamText } from 'ai';
import type { ReplyStrategy, AppSettings } from '@/types';

function getClient(settings: AppSettings) {
  return createOpenAI({
    apiKey: settings.apiKey,
    baseURL: settings.baseUrl,
  });
}

export async function generateStrategies(
  prompt: string,
  settings: AppSettings
): Promise<ReplyStrategy[]> {
  const client = getClient(settings);
  const model = client(settings.model);

  const systemPrompt = `你是一位顶尖的公关专家和高情商对话大师。你正在帮助用户在职场和社交场景中回复消息。

你的任务是根据上下文和对方性格特点，生成三种不同风格的高情商回复策略。

严格按以下 JSON 格式输出，不要有任何其他内容：
[
  {"label": "A", "style": "顺从推进", "content": "回复内容"},
  {"label": "B", "style": "委婉甩锅", "content": "回复内容"},
  {"label": "C", "style": "幽默化解", "content": "回复内容"}
]

要求：
1. 每条回复不超过50字
2. 回复要自然、有网感、符合中文表达习惯
3. 三种策略风格差异要明显
4. 回复要结合对方性格特点量身定制`;

  try {
    const { text } = await generateText({
      model,
      system: systemPrompt,
      prompt,
    });

    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const strategies: ReplyStrategy[] = JSON.parse(cleaned);
    return strategies;
  } catch (error) {
    console.error('LLM generation failed:', error);
    return [
      { label: 'A', style: '顺从推进', content: '好的，马上处理！' },
      { label: 'B', style: '委婉甩锅', content: '这个需要再确认一下细节' },
      { label: 'C', style: '幽默化解', content: '收到，已经在光速推进了' },
    ];
  }
}

export async function streamStrategies(
  prompt: string,
  settings: AppSettings,
  onChunk: (text: string) => void,
  onDone: (strategies: ReplyStrategy[]) => void
): Promise<void> {
  const client = getClient(settings);
  const model = client(settings.model);

  const systemPrompt = `你是一位顶尖的公关专家和高情商对话大师。根据上下文生成三种高情商回复。

严格按以下 JSON 格式输出：
[
  {"label": "A", "style": "顺从推进", "content": "回复内容"},
  {"label": "B", "style": "委婉甩锅", "content": "回复内容"},
  {"label": "C", "style": "幽默化解", "content": "回复内容"}
]`;

  try {
    const result = streamText({
      model,
      system: systemPrompt,
      prompt,
    });

    let fullText = '';
    for await (const chunk of result.textStream) {
      fullText += chunk;
      onChunk(fullText);
    }

    try {
      const cleaned = fullText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const strategies: ReplyStrategy[] = JSON.parse(cleaned);
      onDone(strategies);
    } catch {
      onDone([
        { label: 'A', style: '顺从推进', content: '好的，马上处理！' },
        { label: 'B', style: '委婉甩锅', content: '这个需要再确认一下细节' },
        { label: 'C', style: '幽默化解', content: '收到，已经在光速推进了' },
      ]);
    }
  } catch (error) {
    console.error('LLM streaming failed:', error);
    onChunk('生成失败，请检查API配置');
    onDone([]);
  }
}

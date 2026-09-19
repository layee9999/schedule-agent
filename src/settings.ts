export interface LlmSettings {
  apiKey: string
  baseUrl: string
  model: string
}

const KEY = 'schedule-agent-llm'

export const LLM_PRESETS = [
  { id: 'demo', name: '本地演示', baseUrl: 'local://demo', model: 'demo' },
  { id: 'groq', name: 'Groq 免费', baseUrl: 'https://api.groq.com/openai/v1', model: 'llama-3.1-8b-instant' },
  { id: 'gemini', name: 'Gemini 免费', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.0-flash' },
  { id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  { id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  { id: 'qwen', name: '通义千问', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
  { id: 'siliconflow', name: '硅基流动', baseUrl: 'https://api.siliconflow.cn/v1', model: 'Qwen/Qwen2.5-7B-Instruct' },
  { id: 'newapi', name: 'NewAPI', baseUrl: 'http://192.168.40.113:8088/v1', model: 'gpt-4o-mini' },
] as const

export function loadLlmSettings(): LlmSettings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { apiKey: '', baseUrl: '', model: '' }
    const parsed = JSON.parse(raw) as Partial<LlmSettings>
    return {
      apiKey: parsed.apiKey || '',
      baseUrl: parsed.baseUrl || '',
      model: parsed.model || '',
    }
  } catch {
    return { apiKey: '', baseUrl: '', model: '' }
  }
}

export function saveLlmSettings(settings: LlmSettings): void {
  localStorage.setItem(KEY, JSON.stringify(settings))
}

export async function persistLlmSettings(settings: LlmSettings): Promise<void> {
  saveLlmSettings(settings)
  await fetch('/api/llm-config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  })
}

export async function fetchLlmStatus(): Promise<{ configured: boolean; baseUrl: string; model: string }> {
  const response = await fetch('/api/llm-config')
  if (!response.ok) return { configured: Boolean(loadLlmSettings().apiKey), ...loadLlmSettings() }
  return response.json() as Promise<{ configured: boolean; baseUrl: string; model: string }>
}

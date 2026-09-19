import { writeFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { resolve } from 'node:path'
import type { Connect, Plugin, ViteDevServer } from 'vite'
import { loadEnv } from 'vite'

const SYSTEM_PROMPT = `你是课表课程解析助手。根据用户输入（自然语言、课表图片或课表文本），提取课程并只返回 JSON 对象，不要 markdown。

JSON 格式：
{
  "reply": "给用户看的一句中文说明",
  "courses": [
    {
      "id": "仅在修改已有课程时填写原课程 id，新建时为 null",
      "name": "课程名",
      "teacher": "教师，未知则空字符串",
      "weekday": 1,
      "periods": [3, 4],
      "startTime": "14:30",
      "endTime": "16:10",
      "location": "教室，未知则空字符串",
      "weekStart": 1,
      "weekEnd": 16
    }
  ]
}

规则：
- weekday: 周一=1 … 周日=7
- 课表共 10 节，时间对照：
  1: 08:00-08:50
  2: 08:55-09:45
  3: 10:00-10:50
  4: 11:00-11:50
  5: 14:00-14:50
  6: 15:00-15:50
  7: 16:00-16:50
  8: 17:00-17:50
  9: 19:00-19:50
  10: 20:00-20:50
- 产品特例：用户说「下午两点 / 下午2点」时，解析为 startTime=14:30, endTime=16:10, periods=[3,4]（展示用第3-4节）。
- 「上16周」表示 weekStart=1, weekEnd=16。
- 连续两节课 periods 填连续整数，如第1-2节为 [1,2]。
- 修改课程时必须带上原课程 id，并返回修改后的完整字段。
- 图片中识别课表时尽量提取所有课程。
- 若无法解析，courses 为空数组，reply 说明缺了哪些信息。`

type ParseBody = {
  mode?: 'text' | 'image' | 'file'
  text?: string
  image?: string
  intent?: string
  existingCourses?: unknown[]
  apiKey?: string
  baseUrl?: string
  model?: string
}

type RuntimeEnv = {
  OPENAI_API_KEY: string
  OPENAI_BASE_URL: string
  OPENAI_MODEL: string
  AGENT_BASE_URL: string
}

function toRuntime(env: Record<string, string>): RuntimeEnv {
  return {
    OPENAI_API_KEY: env.OPENAI_API_KEY || '',
    OPENAI_BASE_URL: env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    OPENAI_MODEL: env.OPENAI_MODEL || 'gpt-4o-mini',
    AGENT_BASE_URL: env.AGENT_BASE_URL || 'http://127.0.0.1:5173',
  }
}

function persistEnvFile(runtime: RuntimeEnv) {
  writeFileSync(
    resolve(process.cwd(), '.env'),
    [
      `OPENAI_API_KEY=${runtime.OPENAI_API_KEY}`,
      `OPENAI_BASE_URL=${runtime.OPENAI_BASE_URL}`,
      `OPENAI_MODEL=${runtime.OPENAI_MODEL}`,
      `AGENT_BASE_URL=${runtime.AGENT_BASE_URL}`,
      '',
    ].join('\n'),
    'utf8',
  )
}

async function readJsonBody(req: IncomingMessage): Promise<ParseBody> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  const raw = Buffer.concat(chunks).toString('utf8')
  if (!raw) return {}
  return JSON.parse(raw) as ParseBody
}

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim()
  try {
    return JSON.parse(trimmed)
  } catch {
    const start = trimmed.indexOf('{')
    const end = trimmed.lastIndexOf('}')
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1))
    }
    throw new Error('模型未返回合法 JSON')
  }
}

function json(res: ServerResponse, status: number, payload: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.end(JSON.stringify(payload))
}

function normalizeBaseUrl(url: string): string {
  const trimmed = url.replace(/\/$/, '')
  if (/\/v\d+$/i.test(trimmed) || /\/compatible-mode\/v\d+$/i.test(trimmed)) return trimmed
  return `${trimmed}/v1`
}

async function chatCompletions(
  baseUrl: string,
  apiKey: string,
  model: string,
  userContent: unknown,
): Promise<{ ok: boolean; status: number; raw: string }> {
  const payload = {
    model,
    temperature: 0.1,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userContent },
    ],
  }

  const request = async (withJsonFormat: boolean) =>
    fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(
        withJsonFormat ? { ...payload, response_format: { type: 'json_object' } } : payload,
      ),
    })

  let response = await request(true)
  let raw = await response.text()
  if (!response.ok && /response_format|json_object/i.test(raw)) {
    response = await request(false)
    raw = await response.text()
  }
  return { ok: response.ok, status: response.status, raw }
}

function isDemoMode(apiKey: string, baseUrl: string): boolean {
  return !apiKey || /^(demo|local|sk-demo)$/i.test(apiKey) || /local:\/\/demo/i.test(baseUrl)
}

const PERIOD_CLOCK: Array<[string, string]> = [
  ['08:00', '08:50'],
  ['08:55', '09:45'],
  ['10:00', '10:50'],
  ['11:00', '11:50'],
  ['14:00', '14:50'],
  ['15:00', '15:50'],
  ['16:00', '16:50'],
  ['17:00', '17:50'],
  ['19:00', '19:50'],
  ['20:00', '20:50'],
]

function periodsFromText(text: string): { periods: number[]; startTime: string; endTime: string } {
  const range = text.match(/第\s*(\d{1,2})\s*[-–—~～到至]\s*(\d{1,2})\s*节/)
  const one = text.match(/第\s*(\d{1,2})\s*节/)
  const afternoonTwo = /下午\s*2\s*点|下午两点|下午二点/.test(text)
  let periods: number[]
  if (range) {
    const start = Math.min(10, Math.max(1, Number(range[1])))
    const end = Math.min(10, Math.max(1, Number(range[2])))
    const from = Math.min(start, end)
    const to = Math.max(start, end)
    periods = Array.from({ length: to - from + 1 }, (_, index) => from + index)
  } else if (one) {
    periods = [Math.min(10, Math.max(1, Number(one[1])))]
  } else if (afternoonTwo) {
    return { periods: [3, 4], startTime: '14:30', endTime: '16:10' }
  } else {
    periods = [1, 2]
  }
  const first = PERIOD_CLOCK[(periods[0] || 1) - 1] || PERIOD_CLOCK[0]!
  const last = PERIOD_CLOCK[(periods[periods.length - 1] || 1) - 1] || first
  return { periods, startTime: first[0], endTime: last[1] }
}

function demoParse(body: ParseBody): { reply: string; courses: unknown[] } {
  if (body.mode === 'image' || body.intent === 'import') {
    return {
      reply: '当前为本地演示模式（未调用公网模型）。已识别出以下课程，可走完导入确认流程：',
      courses: [
        { name: '高等数学', teacher: '张老师', weekday: 1, periods: [1, 2], location: 'A101', weekStart: 1, weekEnd: 16, startTime: '08:00', endTime: '09:45' },
        { name: '大学英语', teacher: '李老师', weekday: 2, periods: [3, 4], location: 'B201', weekStart: 1, weekEnd: 16, startTime: '10:00', endTime: '11:50' },
        { name: '计算机基础', teacher: '王老师', weekday: 3, periods: [5, 6], location: 'C302', weekStart: 1, weekEnd: 16, startTime: '14:00', endTime: '15:50' },
        { name: '大学体育', teacher: '体育老师', weekday: 4, periods: [7, 8], location: '操场', weekStart: 1, weekEnd: 16, startTime: '16:00', endTime: '17:50' },
        { name: '思想道德与法治', teacher: '陈老师', weekday: 5, periods: [3, 4], location: 'B101', weekStart: 1, weekEnd: 16, startTime: '10:00', endTime: '11:50' },
      ],
    }
  }

  const text = body.text || ''
  const weekdayMap: Record<string, number> = {
    星期一: 1, 周一: 1, 星期二: 2, 周二: 2, 星期三: 3, 周三: 3, 星期四: 4, 周四: 4, 星期五: 5, 周五: 5, 星期六: 6, 周六: 6, 星期日: 7, 周日: 7,
  }
  const weekdayHit = Object.keys(weekdayMap).find((key) => text.includes(key))
  const teacher = text.match(/([\u4e00-\u9fa5]{1,4}老师)/)?.[1] || '张老师'
  const location = text.match(/([A-Z]\d{2,4}|操场)/)?.[1] || 'A101'
  const weekEnd = Number(text.match(/上\s*(\d{1,2})\s*周/)?.[1] || text.match(/(\d{1,2})\s*-\s*(\d{1,2})\s*周/)?.[2] || 16)
  const weekStart = Number(text.match(/(\d{1,2})\s*-\s*(\d{1,2})\s*周/)?.[1] || 1)
  const name =
    text.match(/上([\u4e00-\u9fa5A-Za-z0-9]{2,12})/)?.[1]?.replace(/[，。].*$/, '') ||
    text.match(/([\u4e00-\u9fa5]{2,12}学|[\u4e00-\u9fa5]{2,12}课)/)?.[1] ||
    '高等数学'
  const slot = periodsFromText(text)
  const weekday = weekdayHit ? weekdayMap[weekdayHit] : 3

  return {
    reply: '当前为本地演示模式（未调用公网模型）。我已为你解析出以下课程信息：',
    courses: [
      {
        name,
        teacher,
        weekday,
        periods: slot.periods,
        startTime: slot.startTime,
        endTime: slot.endTime,
        location,
        weekStart: Number.isFinite(weekStart) ? weekStart : 1,
        weekEnd: Number.isFinite(weekEnd) ? weekEnd : 16,
      },
    ],
  }
}

async function handleParse(req: IncomingMessage, res: ServerResponse, runtime: RuntimeEnv) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }

  if (req.method !== 'POST') {
    json(res, 405, { error: 'Method not allowed' })
    return
  }

  let body: ParseBody
  try {
    body = await readJsonBody(req)
  } catch {
    json(res, 400, { error: '请求体不是合法 JSON' })
    return
  }

  const headerKey = String(req.headers['x-openai-key'] || '')
  const apiKey = (body.apiKey || headerKey || runtime.OPENAI_API_KEY).trim()
  const baseUrl = normalizeBaseUrl(
    (body.apiKey && body.baseUrl) || runtime.OPENAI_BASE_URL || body.baseUrl || 'https://api.openai.com/v1',
  )
  if (isDemoMode(apiKey, body.baseUrl || runtime.OPENAI_BASE_URL || '')) {
    json(res, 200, demoParse(body))
    return
  }
  if (!apiKey) {
    json(res, 400, {
      error: '未配置模型 API Key。调试可在设置里选「本地演示」，或填写自己的免费额度 Key。',
      needConfig: true,
    })
    return
  }

  const model = (body.apiKey && body.model) || runtime.OPENAI_MODEL || body.model || 'gpt-4o-mini'
  const intent = body.intent || 'add'
  const existing = JSON.stringify(body.existingCourses ?? [], null, 2)

  const instruction = [
    `当前意图: ${intent}`,
    `已有课表: ${existing}`,
    body.text ? `用户输入: ${body.text}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  const userContent =
    body.mode === 'image' && body.image
      ? [
          { type: 'text', text: instruction },
          { type: 'image_url', image_url: { url: body.image } },
        ]
      : instruction

  try {
    const response = await chatCompletions(baseUrl, apiKey, model, userContent)
    const raw = response.raw
    if (!response.ok) {
      let hint = `模型接口调用失败 (${response.status})`
      if (response.status === 402 || /Insufficient Balance/i.test(raw)) {
        hint = 'DeepSeek 账号余额不足（402）。网络已通、Key 有效，请先在 DeepSeek 控制台充值后再试。'
      } else if (response.status === 401) {
        hint = '模型 Key 无效或未授权（401）。'
      }
      json(res, 502, {
        error: hint,
        detail: raw.slice(0, 500),
      })
      return
    }

    const data = JSON.parse(raw) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const content = data.choices?.[0]?.message?.content
    if (!content) {
      json(res, 502, { error: '模型没有返回内容' })
      return
    }

    const parsed = extractJsonObject(content) as {
      reply?: string
      courses?: unknown[]
    }

    json(res, 200, {
      reply: parsed.reply || '我已为你解析出以下课程信息：',
      courses: parsed.courses || [],
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : '解析失败'
    const unreachable = /fetch failed|ECONNREFUSED|ETIMEDOUT|TimeoutError|AbortError|network/i.test(message)
    json(res, 502, {
      error: unreachable
        ? `无法连接模型服务 ${baseUrl}。当前电脑与 NewAPI 主机不在同一可达网段（连接超时），不是 Key 校验失败。请在能访问 192.168.40.113:8088 的网络下重试。`
        : message,
    })
  }
}

function attach(server: ViteDevServer, runtime: RuntimeEnv) {
  const handler: Connect.NextHandleFunction = (req, res, next) => {
    const url = req.url?.split('?')[0]

    if (url === '/api/chaoxing-map') {
      json(res, 200, {
        page: 'https://kb.chaoxing.com/res/pc/curriculum/schedule.html?role=1',
        note: '以下接口来自教师课表页自身 JS，需登录学习通后由页面会话调用；MCP 不能代替浏览器 Cookie。',
        apis: {
          getMyLessons: { method: 'GET', path: '/pc/curriculum/getMyLessons', query: ['curTime', 'week', 'schoolYear', 'semester'] },
          addOrUpdateLesson: { method: 'POST', path: '/pc/curriculum/addOrUpdateLesson' },
          importImageLesson: { method: 'POST', path: '/pc/import/importImageLesson' },
          importExcelLesson: { method: 'POST', path: '/pc/import/importExcelLesson' },
          updateLessonConfig: { method: 'POST', path: '/pc/curriculum/updateLessonConfig' },
          getOneLesson: { method: 'GET', path: '/pc/curriculum/getOneLesson' },
          getCurriculumHistory: { method: 'GET', path: '/pc/curriculum/getCurriculumHistory' },
          getLocationHistoryList: { method: 'GET', path: '/pc/curriculum/getLocationHistoryList' },
          deleteLesson: { method: 'GET', path: '/pc/curriculum/deleteLesson' },
          getOpeningStatus: { method: 'GET', path: '/pc/school/getOpeningStatus' },
        },
      })
      return
    }

    if (url === '/api/llm-config' && req.method === 'GET') {
      json(res, 200, {
        configured: Boolean(runtime.OPENAI_API_KEY),
        baseUrl: runtime.OPENAI_BASE_URL,
        model: runtime.OPENAI_MODEL,
      })
      return
    }

    if (url === '/api/llm-config' && req.method === 'POST') {
      void (async () => {
        try {
          const body = await readJsonBody(req)
          if (body.apiKey) runtime.OPENAI_API_KEY = body.apiKey
          if (body.baseUrl) runtime.OPENAI_BASE_URL = body.baseUrl.replace(/\/$/, '')
          if (body.model) runtime.OPENAI_MODEL = body.model
          persistEnvFile(runtime)
          json(res, 200, { ok: true, configured: Boolean(runtime.OPENAI_API_KEY) })
        } catch (error) {
          json(res, 400, { error: error instanceof Error ? error.message : '保存失败' })
        }
      })()
      return
    }

    if (url?.startsWith('/api/') && req.method === 'OPTIONS') {
      json(res, 204, {})
      return
    }

    if (url !== '/api/parse') {
      next()
      return
    }
    void handleParse(req, res, runtime)
  }
  server.middlewares.use(handler)
}

export function llmProxyPlugin(mode: string): Plugin {
  const runtime = toRuntime(loadEnv(mode, process.cwd(), ''))
  return {
    name: 'llm-parse-proxy',
    configureServer(server) {
      attach(server, runtime)
    },
    configurePreviewServer(server) {
      attach(server as unknown as ViteDevServer, runtime)
    },
  }
}

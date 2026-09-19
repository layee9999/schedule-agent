import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { z } from 'zod'

function loadDotEnv() {
  try {
    const raw = readFileSync(resolve(process.cwd(), '.env'), 'utf8')
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const index = trimmed.indexOf('=')
      if (index < 0) continue
      const key = trimmed.slice(0, index).trim()
      const value = trimmed.slice(index + 1).trim()
      if (!process.env[key]) process.env[key] = value
    }
  } catch {
    // optional
  }
}

loadDotEnv()

const CHAOXING_MAP = {
  page: 'https://kb.chaoxing.com/res/pc/curriculum/schedule.html?role=1',
  session: '接口需要学习通登录 Cookie，由课表页 overlay-bridge.js 在同域调用，MCP 进程拿不到浏览器会话。',
  apis: {
    getMyLessons: 'GET /pc/curriculum/getMyLessons?curTime=&week=',
    addOrUpdateLesson: 'POST /pc/curriculum/addOrUpdateLesson',
    importImageLesson: 'POST /pc/import/importImageLesson',
    importExcelLesson: 'POST /pc/import/importExcelLesson',
    updateLessonConfig: 'POST /pc/curriculum/updateLessonConfig',
    getOneLesson: 'GET /pc/curriculum/getOneLesson',
    getCurriculumHistory: 'GET /pc/curriculum/getCurriculumHistory',
  },
  overlay:
    '在已登录的教师课表页运行书签脚本，加载 /overlay-bridge.js，浮层 iframe 通过 postMessage 让课表页调用上述接口并完成问答。',
}

async function callParse(body: Record<string, unknown>) {
  const base = process.env.AGENT_BASE_URL || 'http://127.0.0.1:5173'
  const response = await fetch(`${base}/api/parse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.error || `parse failed (${response.status})`)
  }
  return data
}

const server = new McpServer({
  name: 'schedule-agent',
  version: '1.0.0',
})

server.registerTool(
  'parse_course_text',
  {
    description: '把自然语言课程安排解析成结构化课程 JSON',
    inputSchema: { text: z.string(), intent: z.enum(['add', 'edit', 'import', 'conflict']).optional() },
  },
  async ({ text, intent }) => {
    const data = await callParse({ mode: 'text', text, intent: intent || 'add', existingCourses: [] })
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
  },
)

server.registerTool(
  'parse_course_image',
  {
    description: '识别课表图片中的课程（传入 data URL 或 http 图片地址）',
    inputSchema: { image: z.string(), prompt: z.string().optional() },
  },
  async ({ image, prompt }) => {
    const data = await callParse({
      mode: 'image',
      image,
      text: prompt || '请识别课表图片中的全部课程',
      intent: 'import',
      existingCourses: [],
    })
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
  },
)

server.registerTool(
  'list_chaoxing_schedule_apis',
  {
    description: '返回学习通教师课表页已确认存在的调用接口，以及如何用 overlay 完成问答',
  },
  async () => ({
    content: [{ type: 'text', text: JSON.stringify(CHAOXING_MAP, null, 2) }],
  }),
)

server.registerTool(
  'ask_schedule_agent',
  {
    description: '向课表智能体提问或下达添加/修改/查冲突指令',
    inputSchema: { question: z.string() },
  },
  async ({ question }) => {
    const data = await callParse({ mode: 'text', text: question, intent: 'add', existingCourses: [] })
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
  },
)

const transport = new StdioServerTransport()
await server.connect(transport)

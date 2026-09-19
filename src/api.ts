import { loadLlmSettings } from './settings'
import { colorForName, createId, periodsToTime } from './constants'
import type { Course, ParsedCourse, Weekday } from './types'

function asWeekday(value: number | undefined): Weekday {
  const day = Math.min(7, Math.max(1, Number(value) || 1))
  return day as Weekday
}

const WEEKDAY_MAP: Record<string, Weekday> = {
  周一: 1,
  星期一: 1,
  周二: 2,
  星期二: 2,
  周三: 3,
  星期三: 3,
  周四: 4,
  星期四: 4,
  周五: 5,
  星期五: 5,
  周六: 6,
  星期六: 6,
  周日: 7,
  星期日: 7,
}

export function heuristicParse(text: string): Course[] {
  const weekdayHit = Object.keys(WEEKDAY_MAP).find((key) => text.includes(key))
  const teacher = text.match(/([\u4e00-\u9fa5]{1,4}老师)/)?.[1] || ''
  const location = text.match(/([A-Z]\d{2,4}|操场)/)?.[1] || ''
  const weekEnd = Number(text.match(/上\s*(\d{1,2})\s*周/)?.[1] || text.match(/(\d{1,2})\s*-\s*(\d{1,2})\s*周/)?.[2] || 16)
  const weekStart = Number(text.match(/(\d{1,2})\s*-\s*(\d{1,2})\s*周/)?.[1] || 1)
  const name =
    text.match(/上([\u4e00-\u9fa5A-Za-z0-9]{2,12})/)?.[1]?.replace(/，.*/, '') ||
    text.match(/([\u4e00-\u9fa5]{2,12}学|[\u4e00-\u9fa5]{2,12}课)/)?.[1] ||
    ''

  if (!weekdayHit || !name) return []

  const range = text.match(/第\s*(\d{1,2})\s*[-–—~～到至]\s*(\d{1,2})\s*节/)
  const one = text.match(/第\s*(\d{1,2})\s*节/)
  const afternoonTwo = /下午\s*2\s*点|下午两点|下午二点/.test(text)
  let periods = [1, 2]
  let startTime: string | undefined
  let endTime: string | undefined
  if (range) {
    const from = Math.min(Number(range[1]), Number(range[2]))
    const to = Math.max(Number(range[1]), Number(range[2]))
    periods = Array.from({ length: to - from + 1 }, (_, index) => from + index)
  } else if (one) {
    periods = [Number(one[1])]
  } else if (afternoonTwo) {
    periods = [3, 4]
    startTime = '14:30'
    endTime = '16:10'
  }

  return [
    normalizeCourse({
      name: name.replace(/[，。\s].*$/, ''),
      teacher,
      weekday: WEEKDAY_MAP[weekdayHit] ?? 1,
      periods,
      startTime,
      endTime,
      location,
      weekStart,
      weekEnd,
    }),
  ]
}

export function normalizeCourse(parsed: ParsedCourse, index = 0): Course {
  const periods = (parsed.periods || []).filter((item) => item >= 1 && item <= 10)
  const uniquePeriods = [...new Set(periods.length ? periods : [1])].sort((a, b) => a - b)
  const times =
    parsed.startTime && parsed.endTime
      ? { startTime: parsed.startTime, endTime: parsed.endTime }
      : periodsToTime(uniquePeriods)

  const name = (parsed.name || '未命名课程').trim()
  return {
    id: parsed.id || createId(),
    name,
    teacher: (parsed.teacher || '').trim(),
    weekday: asWeekday(parsed.weekday),
    periods: uniquePeriods,
    startTime: times.startTime,
    endTime: times.endTime,
    location: (parsed.location || '').trim(),
    weekStart: parsed.weekStart || 1,
    weekEnd: parsed.weekEnd || 16,
    color: colorForName(name, index),
  }
}

export function courseSummary(course: Course): string {
  const teacher = course.teacher || '教师待定'
  const location = course.location || '地点待定'
  return `${weekdayLabelSafe(course.weekday)} ${periodText(course)}  ${teacher}  ${location}  ${course.weekStart}-${course.weekEnd}周`
}

function weekdayLabelSafe(day: number): string {
  return ['周一', '周二', '周三', '周四', '周五', '周六', '周日'][day - 1] ?? `周${day}`
}

function periodText(course: Course): string {
  const sorted = [...course.periods].sort((a, b) => a - b)
  if (!sorted.length) return ''
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  return first === last ? `${first}节` : `${first}-${last}节`
}

export async function parseWithLLM(payload: {
  mode: 'text' | 'image' | 'file'
  text?: string
  image?: string
  intent: string
  existingCourses: Course[]
}): Promise<{ reply: string; courses: Course[]; needConfig?: boolean }> {
  const fallback = (reason: string, needConfig = false) => {
    const local = payload.text ? heuristicParse(payload.text) : []
    if (local.length) {
      return {
        reply: needConfig
          ? '模型 Key 还没配置，先用本地规则解析出以下课程。要启用真实 LLM，请打开模型设置。'
          : `解析服务暂不可用，已用本地规则解析：${reason}`,
        courses: local,
        needConfig,
      }
    }
    throw new Error(reason)
  }

  const llm = loadLlmSettings()
  const llmOverride = llm.apiKey
    ? { apiKey: llm.apiKey, baseUrl: llm.baseUrl, model: llm.model }
    : {}
  let response: Response
  try {
    response = await fetch('/api/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: payload.mode,
        text: payload.text,
        image: payload.image,
        intent: payload.intent,
        ...llmOverride,
        existingCourses: payload.existingCourses.map((course) => ({
          id: course.id,
          name: course.name,
          teacher: course.teacher,
          weekday: course.weekday,
          periods: course.periods,
          startTime: course.startTime,
          endTime: course.endTime,
          location: course.location,
          weekStart: course.weekStart,
          weekEnd: course.weekEnd,
        })),
      }),
    })
  } catch (error) {
    return fallback(error instanceof Error ? error.message : '无法连接解析服务')
  }

  const data = (await response.json()) as {
    error?: string
    detail?: string
    reply?: string
    courses?: ParsedCourse[]
    needConfig?: boolean
  }

  if (!response.ok) {
    const reason = [data.error, data.detail].filter(Boolean).join(' ')
    return fallback(reason || '解析失败', Boolean(data.needConfig))
  }

  return {
    reply: data.reply || '我已为你解析出以下课程信息：',
    courses: (data.courses || []).map((item, index) => normalizeCourse(item, index)),
  }
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('读取文件失败'))
    reader.readAsDataURL(file)
  })
}

export async function compressImage(file: File, maxSize = 1400): Promise<string> {
  const dataUrl = await fileToDataUrl(file)
  const image = new Image()
  image.src = dataUrl
  await new Promise((resolve, reject) => {
    image.onload = resolve
    image.onerror = () => reject(new Error('图片无法读取'))
  })

  const scale = Math.min(1, maxSize / Math.max(image.width, image.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(image.width * scale)
  canvas.height = Math.round(image.height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) return dataUrl
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.86)
}

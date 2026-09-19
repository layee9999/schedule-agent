import type { ChaoxingCurriculum, ChaoxingLesson } from './chaoxing'
import { fromChaoxingLesson } from './chaoxing'
import { isInIframe } from './embed'
import type { Course } from './types'

interface BridgeRequest {
  type: 'GET_LESSONS' | 'ADD_LESSON' | 'PING'
  id: string
  payload?: Record<string, unknown>
}

interface BridgeResponse {
  type: 'BRIDGE_RESULT'
  id: string
  ok: boolean
  data?: unknown
  error?: string
}

function callParent<T>(type: BridgeRequest['type'], payload?: Record<string, unknown>): Promise<T> {
  if (!isInIframe()) {
    return Promise.reject(new Error('当前不在学习通课表页面浮层中'))
  }
  const id = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      window.removeEventListener('message', onMessage)
      reject(new Error('学习通桥接超时'))
    }, 15000)
    const onMessage = (event: MessageEvent<BridgeResponse>) => {
      if (event.data?.type !== 'BRIDGE_RESULT' || event.data.id !== id) return
      window.clearTimeout(timer)
      window.removeEventListener('message', onMessage)
      if (event.data.ok) resolve(event.data.data as T)
      else reject(new Error(event.data.error || '桥接失败'))
    }
    window.addEventListener('message', onMessage)
    const request: BridgeRequest = { type, id, payload }
    window.parent.postMessage(request, '*')
  })
}

export async function pingChaoxing(): Promise<boolean> {
  try {
    const result = await callParent<{ pong: boolean }>('PING')
    return Boolean(result?.pong)
  } catch {
    return false
  }
}

export async function fetchChaoxingLessons(week?: number): Promise<{
  courses: Course[]
  curriculum: ChaoxingCurriculum | null
}> {
  const data = await callParent<{
    curriculum?: ChaoxingCurriculum
    lessonArray?: ChaoxingLesson[]
  }>('GET_LESSONS', { week })
  const courses = (data.lessonArray || []).map((lesson, index) => fromChaoxingLesson(lesson, index))
  return { courses, curriculum: data.curriculum || null }
}

export async function addChaoxingLesson(course: Course, curriculumUuid: string): Promise<void> {
  await callParent('ADD_LESSON', { course, curriculumUuid })
}

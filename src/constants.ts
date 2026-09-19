import type { Course, PeriodSlot, Weekday } from './types'

export const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'] as const

export const PERIODS: PeriodSlot[] = [
  { id: 1, start: '08:00', end: '08:50' },
  { id: 2, start: '08:55', end: '09:45' },
  { id: 3, start: '10:00', end: '10:50' },
  { id: 4, start: '11:00', end: '11:50' },
  { id: 5, start: '14:00', end: '14:50' },
  { id: 6, start: '15:00', end: '15:50' },
  { id: 7, start: '16:00', end: '16:50' },
  { id: 8, start: '17:00', end: '17:50' },
  { id: 9, start: '19:00', end: '19:50' },
  { id: 10, start: '20:00', end: '20:50' },
]

export const COURSE_COLORS = [
  '#6B9BFF',
  '#F28B8B',
  '#F5A15A',
  '#5FCB8A',
  '#7EC8E3',
  '#A78BFA',
  '#F0B429',
  '#34D399',
]

export const SEMESTER_WEEK1_MONDAY = '2026-07-27'
export const DEFAULT_WEEK = 8
export const MAX_WEEK = 20

export const STORAGE_KEY = 'schedule-agent-courses'
export const WEEK_KEY = 'schedule-agent-week'
export const DRAFT_KEY = 'schedule-agent-draft'

export const SAMPLE_COURSES: Course[] = [
  {
    id: 'sample-1',
    name: '必修课堂',
    teacher: '李老师',
    weekday: 2,
    periods: [1],
    startTime: '08:00',
    endTime: '08:50',
    location: 'A111',
    weekStart: 1,
    weekEnd: 16,
    color: '#6B9BFF',
  },
  {
    id: 'sample-2',
    name: '必修课堂',
    teacher: '王老师',
    weekday: 2,
    periods: [2],
    startTime: '08:55',
    endTime: '09:45',
    location: 'B123',
    weekStart: 1,
    weekEnd: 16,
    color: '#F5A15A',
  },
  {
    id: 'sample-3',
    name: '设计课',
    teacher: '周老师',
    weekday: 3,
    periods: [1, 2],
    startTime: '08:00',
    endTime: '09:45',
    location: 'C201',
    weekStart: 1,
    weekEnd: 16,
    color: '#F28B8B',
  },
  {
    id: 'sample-4',
    name: '大学写作',
    teacher: '陈老师',
    weekday: 4,
    periods: [3],
    startTime: '10:00',
    endTime: '10:50',
    location: 'D301',
    weekStart: 1,
    weekEnd: 16,
    color: '#5FCB8A',
  },
  {
    id: 'sample-5',
    name: '分析课',
    teacher: '赵老师',
    weekday: 5,
    periods: [5],
    startTime: '14:00',
    endTime: '14:50',
    location: 'E123',
    weekStart: 1,
    weekEnd: 16,
    color: '#F5A15A',
  },
  {
    id: 'sample-6',
    name: '必修研讨',
    teacher: '孙老师',
    weekday: 6,
    periods: [7],
    startTime: '16:00',
    endTime: '16:50',
    location: 'F201',
    weekStart: 1,
    weekEnd: 16,
    color: '#7EC8E3',
  },
]

export function weekdayLabel(day: Weekday | number): string {
  return WEEKDAYS[(day - 1) as number] ?? `周${day}`
}

export function periodLabel(periods: number[]): string {
  if (!periods.length) return ''
  const sorted = [...periods].sort((a, b) => a - b)
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  if (first === last) return `第${first}节`
  return `第${first}-${last}节`
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

export function overlappingPeriods(startTime: string, endTime: string): number[] {
  const start = timeToMinutes(startTime)
  const end = timeToMinutes(endTime)
  return PERIODS.filter((slot) => {
    const slotStart = timeToMinutes(slot.start)
    const slotEnd = timeToMinutes(slot.end)
    const overlap = Math.min(end, slotEnd) - Math.max(start, slotStart)
    return overlap >= 15
  }).map((slot) => slot.id)
}

export function periodsToTime(periods: number[]): { startTime: string; endTime: string } {
  const sorted = [...periods].sort((a, b) => a - b)
  const first = PERIODS.find((item) => item.id === sorted[0])
  const last = PERIODS.find((item) => item.id === sorted[sorted.length - 1])
  return {
    startTime: first?.start ?? '08:00',
    endTime: last?.end ?? '08:50',
  }
}

export function displaySlots(course: Pick<Course, 'periods' | 'startTime' | 'endTime'>): number[] {
  if (course.periods?.length) return [...course.periods].sort((a, b) => a - b)
  if (course.startTime && course.endTime) {
    const fromTime = overlappingPeriods(course.startTime, course.endTime)
    if (fromTime.length) return fromTime
  }
  return []
}

export function weekDates(week: number): Date[] {
  const start = new Date(`${SEMESTER_WEEK1_MONDAY}T00:00:00`)
  start.setDate(start.getDate() + (week - 1) * 7)
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return date
  })
}

export function formatMd(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${month}-${day}`
}

export function colorForName(name: string, index = 0): string {
  let hash = 0
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return COURSE_COLORS[(hash + index) % COURSE_COLORS.length] ?? COURSE_COLORS[0]
}

export function createId(): string {
  return `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

import { createId, overlappingPeriods, periodsToTime } from './constants'
import type { Course, Weekday } from './types'

export interface ChaoxingLesson {
  lessonId?: string
  lessonConfigUuid?: string
  name?: string
  teacherName?: string
  dayOfWeek?: number
  beginNumber?: number
  length?: number
  location?: string
  weeks?: string
}

export interface ChaoxingCurriculum {
  uuid?: string
  currentWeek?: number
  maxWeek?: number
  firstWeekDate?: number
  lessonTimeConfigArray?: string[]
}

export function weeksToRange(weeks?: string): { weekStart: number; weekEnd: number } {
  const nums = (weeks || '')
    .split(/[,，\-–]/)
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item) && item > 0)
  if (!nums.length) return { weekStart: 1, weekEnd: 16 }
  return { weekStart: Math.min(...nums), weekEnd: Math.max(...nums) }
}

export function rangeToWeeks(start: number, end: number): string {
  return Array.from({ length: end - start + 1 }, (_, index) => String(start + index)).join(',')
}

export function fromChaoxingLesson(lesson: ChaoxingLesson, index = 0): Course {
  const begin = Math.max(1, lesson.beginNumber || 1)
  const length = Math.max(1, lesson.length || 1)
  const periods = Array.from({ length }, (_, i) => begin + i)
  const times = periodsToTime(periods)
  const range = weeksToRange(lesson.weeks)
  return {
    id: String(lesson.lessonId || lesson.lessonConfigUuid || createId()),
    name: lesson.name || '未命名课程',
    teacher: lesson.teacherName || '',
    weekday: (Math.min(7, Math.max(1, lesson.dayOfWeek || 1)) as Weekday),
    periods,
    startTime: times.startTime,
    endTime: times.endTime,
    location: lesson.location || '',
    weekStart: range.weekStart,
    weekEnd: range.weekEnd,
    color: ['#6B9BFF', '#F28B8B', '#F5A15A', '#5FCB8A', '#7EC8E3', '#A78BFA'][index % 6]!,
  }
}

export function toChaoxingCreatePayload(course: Course, curriculumUuid: string) {
  const sorted = [...course.periods].sort((a, b) => a - b)
  return {
    name: course.name,
    teacherName: course.teacher,
    dayOfWeek: course.weekday,
    beginNumber: sorted[0] || 1,
    length: sorted.length || 1,
    location: course.location,
    weeks: rangeToWeeks(course.weekStart, course.weekEnd),
    weekType: 2,
    curriculumUuid,
    role: 1,
  }
}

export function applyLessonTimes(course: Course, config?: string[]): Course {
  if (!config?.length) return course
  const startSlot = config[(course.periods[0] || 1) - 1]
  const endSlot = config[(course.periods[course.periods.length - 1] || 1) - 1]
  const startTime = startSlot?.split('-')[0] || course.startTime
  const endTime = endSlot?.split('-')[1] || course.endTime
  return { ...course, startTime, endTime, periods: overlappingPeriods(startTime, endTime).length ? overlappingPeriods(startTime, endTime) : course.periods }
}

export const CHAOXING_APIS = {
  page: 'https://kb.chaoxing.com/res/pc/curriculum/schedule.html?role=1',
  getMyLessons: 'POST/GET https://kb.chaoxing.com/pc/curriculum/getMyLessons',
  addOrUpdateLesson: 'POST https://kb.chaoxing.com/pc/curriculum/addOrUpdateLesson',
  importImageLesson: 'POST https://kb.chaoxing.com/pc/import/importImageLesson',
  importExcelLesson: 'POST https://kb.chaoxing.com/pc/import/importExcelLesson',
  updateLessonConfig: 'POST https://kb.chaoxing.com/pc/curriculum/updateLessonConfig',
  getOneLesson: 'GET https://kb.chaoxing.com/pc/curriculum/getOneLesson',
  getCurriculumHistory: 'GET https://kb.chaoxing.com/pc/curriculum/getCurriculumHistory',
  getLocationHistoryList: 'GET https://kb.chaoxing.com/pc/curriculum/getLocationHistoryList',
  getOpeningStatus: 'GET https://kb.chaoxing.com/pc/school/getOpeningStatus',
  deleteLesson: 'GET https://kb.chaoxing.com/pc/curriculum/deleteLesson',
} as const

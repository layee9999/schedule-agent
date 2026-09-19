import { SAMPLE_COURSES, STORAGE_KEY, WEEK_KEY, DEFAULT_WEEK } from './constants'
import type { Course, DraftMode } from './types'

export function loadCourses(): Course[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return SAMPLE_COURSES
    const parsed = JSON.parse(raw) as Course[]
    return Array.isArray(parsed) ? parsed : SAMPLE_COURSES
  } catch {
    return SAMPLE_COURSES
  }
}

export function saveCourses(courses: Course[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(courses))
}

export function loadWeek(): number {
  const raw = localStorage.getItem(WEEK_KEY)
  const week = raw ? Number(raw) : DEFAULT_WEEK
  return Number.isFinite(week) && week >= 1 ? week : DEFAULT_WEEK
}

export function saveWeek(week: number): void {
  localStorage.setItem(WEEK_KEY, String(week))
}

export function resetCourses(): Course[] {
  saveCourses(SAMPLE_COURSES)
  return SAMPLE_COURSES
}

export interface DraftState {
  mode: DraftMode
  courses: Course[]
  originalId?: string
}

export function saveDraft(draft: DraftState): void {
  sessionStorage.setItem('schedule-agent-draft', JSON.stringify(draft))
}

export function loadDraft(): DraftState | null {
  try {
    const raw = sessionStorage.getItem('schedule-agent-draft')
    if (!raw) return null
    return JSON.parse(raw) as DraftState
  } catch {
    return null
  }
}

export function clearDraft(): void {
  sessionStorage.removeItem('schedule-agent-draft')
}

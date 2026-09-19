export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7

export type AssistantIntent = 'add' | 'import' | 'edit' | 'conflict'

export interface Course {
  id: string
  name: string
  teacher: string
  weekday: Weekday
  periods: number[]
  startTime: string
  endTime: string
  location: string
  weekStart: number
  weekEnd: number
  color: string
}

export interface PeriodSlot {
  id: number
  start: string
  end: string
}

export interface ParsedCourse {
  id?: string | null
  name?: string
  teacher?: string
  weekday?: number
  periods?: number[]
  startTime?: string
  endTime?: string
  location?: string
  weekStart?: number
  weekEnd?: number
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  courses?: Course[]
  conflicts?: ConflictPair[]
}

export interface ConflictPair {
  a: Course
  b: Course
  reason: string
}

export type DraftMode = 'add' | 'edit'

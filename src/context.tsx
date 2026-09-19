import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { createId } from './constants'
import { loadCourses, loadWeek, resetCourses, saveCourses, saveWeek } from './storage'
import type { Course } from './types'

interface ScheduleContextValue {
  courses: Course[]
  week: number
  setWeek: (week: number) => void
  addCourses: (incoming: Course[]) => Course[]
  updateCourse: (course: Course) => void
  replaceCourses: (incoming: Course[]) => void
  reset: () => void
}

const ScheduleContext = createContext<ScheduleContextValue | null>(null)

export function ScheduleProvider({ children }: { children: ReactNode }) {
  const [courses, setCourses] = useState<Course[]>(() => loadCourses())
  const [week, setWeekState] = useState(() => loadWeek())

  const persist = useCallback((next: Course[]) => {
    setCourses(next)
    saveCourses(next)
  }, [])

  const setWeek = useCallback((next: number) => {
    setWeekState(next)
    saveWeek(next)
  }, [])

  const addCourses = useCallback(
    (incoming: Course[]) => {
      const created = incoming.map((course) => ({ ...course, id: createId() }))
      persist([...courses, ...created])
      return created
    },
    [courses, persist],
  )

  const updateCourse = useCallback(
    (course: Course) => {
      persist(courses.map((item) => (item.id === course.id ? course : item)))
    },
    [courses, persist],
  )

  const replaceCourses = useCallback(
    (incoming: Course[]) => {
      persist(incoming)
    },
    [persist],
  )

  const reset = useCallback(() => {
    persist(resetCourses())
  }, [persist])

  const value = useMemo(
    () => ({ courses, week, setWeek, addCourses, updateCourse, replaceCourses, reset }),
    [courses, week, setWeek, addCourses, updateCourse, replaceCourses, reset],
  )

  return <ScheduleContext.Provider value={value}>{children}</ScheduleContext.Provider>
}

export function useSchedule() {
  const ctx = useContext(ScheduleContext)
  if (!ctx) throw new Error('useSchedule must be used within ScheduleProvider')
  return ctx
}

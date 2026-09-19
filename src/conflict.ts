import { displaySlots, weekdayLabel } from './constants'
import type { ConflictPair, Course } from './types'

export function weeksOverlap(a: Course, b: Course): boolean {
  return a.weekEnd >= b.weekStart && b.weekEnd >= a.weekStart
}

export function slotsOverlap(a: Course, b: Course): boolean {
  const slotsA = displaySlots(a)
  const slotsB = new Set(displaySlots(b))
  return slotsA.some((slot) => slotsB.has(slot))
}

export function pairConflicts(a: Course, b: Course): boolean {
  if (a.id === b.id) return false
  return a.weekday === b.weekday && weeksOverlap(a, b) && slotsOverlap(a, b)
}

export function findConflicts(courses: Course[]): ConflictPair[] {
  const pairs: ConflictPair[] = []
  for (let i = 0; i < courses.length; i += 1) {
    for (let j = i + 1; j < courses.length; j += 1) {
      const a = courses[i]
      const b = courses[j]
      if (pairConflicts(a, b)) {
        pairs.push({
          a,
          b,
          reason: `${weekdayLabel(a.weekday)} ${a.name} 与 ${b.name} 节次重叠`,
        })
      }
    }
  }
  return pairs
}

export function conflictsForIncoming(incoming: Course[], existing: Course[]): ConflictPair[] {
  const pairs: ConflictPair[] = []
  for (const course of incoming) {
    for (const current of existing) {
      if (pairConflicts(course, current)) {
        pairs.push({
          a: course,
          b: current,
          reason: `与已有课程「${current.name}」在${weekdayLabel(course.weekday)}节次重叠`,
        })
      }
    }
    for (const other of incoming) {
      if (course.id !== other.id && pairConflicts(course, other)) {
        pairs.push({
          a: course,
          b: other,
          reason: `待添加课程「${course.name}」与「${other.name}」互相冲突`,
        })
      }
    }
  }
  const seen = new Set<string>()
  return pairs.filter((pair) => {
    const key = [pair.a.id, pair.b.id].sort().join(':')
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

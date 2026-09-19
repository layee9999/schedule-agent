import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { addChaoxingLesson, fetchChaoxingLessons, pingChaoxing } from '../bridge'
import { conflictsForIncoming } from '../conflict'
import { ImportRow } from '../CourseCard'
import { useSchedule } from '../context'
import { RobotAvatar } from '../icons'
import { saveDraft } from '../storage'
import type { Course } from '../types'

interface ImportState {
  courses?: Course[]
  reply?: string
}

export function ImportPage() {
  const navigate = useNavigate()
  const { courses, addCourses } = useSchedule()
  const incoming = ((useLocation().state || {}) as ImportState).courses || []
  const [selected, setSelected] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(incoming.map((course) => [course.id, true])),
  )
  const picked = incoming.filter((course) => selected[course.id])
  const conflicts = useMemo(() => conflictsForIncoming(picked, courses), [picked, courses])

  const addSelected = async () => {
    if (!picked.length) return
    const saved = addCourses(picked)
    const onChaoxing = await pingChaoxing()
    if (onChaoxing) {
      try {
        const weekData = await fetchChaoxingLessons()
        const uuid = weekData.curriculum?.uuid
        if (uuid) {
          for (const course of saved) await addChaoxingLesson(course, uuid)
        }
      } catch (error) {
        window.alert(error instanceof Error ? `本地已保存，同步学习通失败：${error.message}` : '同步学习通失败')
      }
    }
    saveDraft({ mode: 'add', courses: saved })
    navigate('/assistant/success')
  }

  return (
    <div className="page import-page">
      <header className="topbar">
        <div className="brand">
          <RobotAvatar size={28} />
          <h1>课程创建助手</h1>
        </div>
        <button type="button" className="ghost" onClick={() => navigate('/schedule')}>
          ×
        </button>
      </header>

      <div className="import-body">
        <p className="lead">已识别到以下{incoming.length}门课程，请确认是否添加：</p>
        <div className="import-list">
          {incoming.map((course) => (
            <ImportRow
              key={course.id}
              course={course}
              selected={Boolean(selected[course.id])}
              onToggle={() => setSelected((prev) => ({ ...prev, [course.id]: !prev[course.id] }))}
            />
          ))}
        </div>
        {conflicts.length ? <div className="warn-banner bad">{conflicts.map((item) => item.reason).join('；')}</div> : null}
      </div>

      <div className="dock-actions">
        <button type="button" className="btn ghost-btn" onClick={() => navigate('/assistant')}>
          暂不添加
        </button>
        <button type="button" className="btn primary" onClick={() => void addSelected()}>
          全部添加
        </button>
      </div>
    </div>
  )
}

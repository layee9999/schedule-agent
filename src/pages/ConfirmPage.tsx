import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { addChaoxingLesson, fetchChaoxingLessons, pingChaoxing } from '../bridge'
import { conflictsForIncoming } from '../conflict'
import { CourseDetailCard } from '../CourseCard'
import { useSchedule } from '../context'
import { RobotAvatar } from '../icons'
import { loadDraft, saveDraft } from '../storage'

export function ConfirmPage() {
  const navigate = useNavigate()
  const { courses, addCourses, updateCourse } = useSchedule()
  const draft = loadDraft()
  const incoming = draft?.courses || []
  const mode = draft?.mode || 'add'
  const conflicts = useMemo(() => conflictsForIncoming(incoming, courses), [incoming, courses])

  if (!incoming.length) {
    return (
      <div className="page">
        <p className="muted center">没有待确认的课程</p>
      </div>
    )
  }

  const confirm = async () => {
    let saved = incoming
    if (mode === 'edit') {
      incoming.forEach((course) => updateCourse(course))
    } else {
      saved = addCourses(incoming)
    }

    const onChaoxing = await pingChaoxing()
    if (onChaoxing) {
      try {
        const weekData = await fetchChaoxingLessons()
        const uuid = weekData.curriculum?.uuid
        if (uuid) {
          for (const course of saved) {
            await addChaoxingLesson(course, uuid)
          }
        }
      } catch (error) {
        window.alert(error instanceof Error ? `本地已保存，同步学习通失败：${error.message}` : '同步学习通失败')
      }
    }

    saveDraft({ ...draft!, courses: saved })
    navigate('/assistant/success')
  }

  return (
    <div className="page confirm-page">
      <header className="topbar">
        <div className="brand">
          <RobotAvatar size={28} />
          <h1>课程创建助手</h1>
        </div>
        <button type="button" className="ghost" onClick={() => navigate('/schedule')}>
          ×
        </button>
      </header>

      <div className="confirm-body">
        <h2>确认添加确认</h2>
        <p className="muted">以下是你要添加的课程信息，请确认：</p>
        {incoming.map((course) => (
          <CourseDetailCard key={course.id} course={course} />
        ))}
        <div className={`warn-banner ${conflicts.length ? 'bad' : ''}`}>
          {conflicts.length
            ? conflicts.map((item) => item.reason).join('；')
            : '未检测到时间冲突，可以正常添加。'}
        </div>
      </div>

      <div className="dock-actions">
        <button type="button" className="btn ghost-btn" onClick={() => navigate(-1)}>
          取消
        </button>
        <button type="button" className="btn primary" onClick={() => void confirm()}>
          确认添加
        </button>
      </div>
    </div>
  )
}

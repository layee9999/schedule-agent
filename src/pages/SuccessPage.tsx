import { useNavigate } from 'react-router-dom'
import { CourseDetailCard } from '../CourseCard'
import { loadDraft } from '../storage'

export function SuccessPage() {
  const navigate = useNavigate()
  const draft = loadDraft()
  const courses = draft?.courses || []
  const main = courses[0]

  return (
    <div className="page success-page">
      <div className="success-mark" aria-hidden="true">
        ✓
      </div>
      <h2>课程已添加成功</h2>
      {main ? <CourseDetailCard course={main} compact={courses.length > 1} /> : null}
      {courses.length > 1 ? <p className="muted">共添加 {courses.length} 门课程</p> : null}
      <div className="btn-row">
        <button type="button" className="btn primary" onClick={() => navigate('/schedule')}>
          查看课表
        </button>
        <button type="button" className="btn ghost-btn" onClick={() => navigate('/assistant')}>
          继续添加
        </button>
      </div>
    </div>
  )
}

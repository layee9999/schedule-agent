import { periodLabel, weekdayLabel } from './constants'
import { IconBook, IconCheck } from './icons'
import type { Course } from './types'

export function CourseDetailCard({ course, compact = false }: { course: Course; compact?: boolean }) {
  return (
    <article className="course-card">
      <div className="course-card-head">
        <IconBook color={course.color} />
        <h3>{course.name}</h3>
      </div>
      {compact ? (
        <p className="muted">
          {weekdayLabel(course.weekday)} {periodLabel(course.periods)} {course.teacher} {course.location}{' '}
          {course.weekStart}-{course.weekEnd}周
        </p>
      ) : (
        <dl className="course-meta">
          <div>
            <dt>教师</dt>
            <dd>{course.teacher || '待补充'}</dd>
          </div>
          <div>
            <dt>时间</dt>
            <dd>
              {weekdayLabel(course.weekday)} {course.startTime}-{course.endTime}（{periodLabel(course.periods)}）
            </dd>
          </div>
          <div>
            <dt>地点</dt>
            <dd>{course.location || '待补充'}</dd>
          </div>
          <div>
            <dt>周次</dt>
            <dd>
              第{course.weekStart}-{course.weekEnd}周
            </dd>
          </div>
        </dl>
      )}
    </article>
  )
}

export function CourseEditForm({
  course,
  onChange,
}: {
  course: Course
  onChange: (course: Course) => void
}) {
  const update = (patch: Partial<Course>) => onChange({ ...course, ...patch })
  const periodText = course.periods.join('-')

  return (
    <div className="edit-form">
      <label>
        课程名
        <input value={course.name} onChange={(e) => update({ name: e.target.value })} />
      </label>
      <label>
        教师
        <input value={course.teacher} onChange={(e) => update({ teacher: e.target.value })} />
      </label>
      <label>
        星期
        <select
          value={course.weekday}
          onChange={(e) => update({ weekday: Number(e.target.value) as Course['weekday'] })}
        >
          {[1, 2, 3, 4, 5, 6, 7].map((day) => (
            <option key={day} value={day}>
              {weekdayLabel(day as Course['weekday'])}
            </option>
          ))}
        </select>
      </label>
      <label>
        节次（如 3-4）
        <input
          value={periodText}
          onChange={(e) => {
            const periods = e.target.value
              .split(/[-,，\s]+/)
              .map(Number)
              .filter((n) => n >= 1 && n <= 10)
            update({ periods })
          }}
        />
      </label>
      <label>
        开始时间
        <input value={course.startTime} onChange={(e) => update({ startTime: e.target.value })} />
      </label>
      <label>
        结束时间
        <input value={course.endTime} onChange={(e) => update({ endTime: e.target.value })} />
      </label>
      <label>
        地点
        <input value={course.location} onChange={(e) => update({ location: e.target.value })} />
      </label>
      <label>
        开始周
        <input
          type="number"
          min={1}
          max={20}
          value={course.weekStart}
          onChange={(e) => update({ weekStart: Number(e.target.value) })}
        />
      </label>
      <label>
        结束周
        <input
          type="number"
          min={1}
          max={20}
          value={course.weekEnd}
          onChange={(e) => update({ weekEnd: Number(e.target.value) })}
        />
      </label>
    </div>
  )
}

export function ImportRow({
  course,
  selected,
  onToggle,
}: {
  course: Course
  selected: boolean
  onToggle: () => void
}) {
  return (
    <button type="button" className="import-row" onClick={onToggle}>
      <IconBook color={course.color} />
      <div className="import-row-body">
        <strong>{course.name}</strong>
        <span>
          {weekdayLabel(course.weekday)} {periodLabel(course.periods)} {course.teacher} {course.location}{' '}
          {course.weekStart}-{course.weekEnd}周
        </span>
      </div>
      <IconCheck on={selected} />
    </button>
  )
}

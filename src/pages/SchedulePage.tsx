import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PERIODS, WEEKDAYS, displaySlots, formatMd, weekDates } from '../constants'
import { useSchedule } from '../context'
import { RobotAvatar } from '../icons'

export function SchedulePage() {
  const { courses, week, setWeek, reset } = useSchedule()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [weekOpen, setWeekOpen] = useState(false)
  const dates = weekDates(week)
  const today = new Date()
  const todayIndex = dates.findIndex(
    (date) =>
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate(),
  )

  const visible = useMemo(
    () => courses.filter((course) => course.weekStart <= week && course.weekEnd >= week),
    [courses, week],
  )

  return (
    <div className="page schedule-page">
      <header className="topbar">
        <button type="button" className="ghost" aria-label="返回">
          ‹
        </button>
        <button type="button" className="week-btn" onClick={() => setWeekOpen((v) => !v)}>
          第{week}周 ▾
        </button>
        <button type="button" className="ghost" onClick={() => setMenuOpen((v) => !v)} aria-label="菜单">
          ☰
        </button>
      </header>

      {weekOpen ? (
        <div className="week-sheet">
          {Array.from({ length: 20 }, (_, i) => i + 1).map((item) => (
            <button
              key={item}
              type="button"
              className={item === week ? 'on' : ''}
              onClick={() => {
                setWeek(item)
                setWeekOpen(false)
              }}
            >
              第{item}周
            </button>
          ))}
        </div>
      ) : null}

      {menuOpen ? (
        <div className="menu-sheet">
          <button
            type="button"
            onClick={() => {
              reset()
              setMenuOpen(false)
            }}
          >
            重置为示例课表
          </button>
          <button type="button" onClick={() => navigate('/assistant/deploy')}>
            在学习通课表中调用智能体
          </button>
        </div>
      ) : null}

      <div className="grid-wrap">
        <div className="weekday-row">
          <div className="time-gutter" />
          {WEEKDAYS.map((label, index) => (
            <div key={label} className={`weekday ${index === todayIndex ? 'today' : ''}`}>
              <span>{label}</span>
              <small>{formatMd(dates[index]!)}</small>
            </div>
          ))}
        </div>

        <div className="grid">
          {PERIODS.map((slot, index) => (
            <div
              key={`time-${slot.id}`}
              className="time-gutter"
              style={{ gridColumn: 1, gridRow: index + 1 }}
            >
              <b>{slot.id}</b>
              <small>
                {slot.start}
                <br />
                {slot.end}
              </small>
            </div>
          ))}
          {PERIODS.map((slot, row) =>
            WEEKDAYS.map((_, day) => (
              <div
                key={`${slot.id}-${day}`}
                className="cell"
                style={{ gridColumn: day + 2, gridRow: row + 1 }}
              />
            )),
          )}
          {visible.map((course) => {
            const slots = displaySlots(course)
            if (!slots.length) return null
            const start = Math.min(...slots)
            const end = Math.max(...slots)
            return (
              <div
                key={course.id}
                className="course-block"
                style={{
                  gridColumn: course.weekday + 1,
                  gridRow: `${start} / ${end + 1}`,
                  background: course.color,
                }}
              >
                <strong>{course.name}</strong>
                <span>{course.location}</span>
              </div>
            )
          })}
        </div>
      </div>

      <button type="button" className="fab-wrap" onClick={() => navigate('/assistant')}>
        <div className="fab-tip">
          <b>AI课程助手</b>
          <span>帮你快速添加、管理课程</span>
          <span>一键导入课表</span>
        </div>
        <div className="fab">
          <RobotAvatar size={54} />
        </div>
      </button>
      <Link to="/assistant" className="sr-only">
        打开 AI 课程助手
      </Link>
    </div>
  )
}

export function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="page placeholder-page">
      <h2>{title}</h2>
      <p>此模块为占位页，课表与 AI 助手为完整功能。</p>
      <Link to="/schedule">回到课表</Link>
    </div>
  )
}

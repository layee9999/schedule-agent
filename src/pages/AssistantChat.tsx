import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { parseWithLLM, courseSummary } from '../api'
import { Composer } from '../Composer'
import { CourseDetailCard, CourseEditForm } from '../CourseCard'
import { findConflicts } from '../conflict'
import { useSchedule } from '../context'
import { RobotAvatar } from '../icons'
import { saveDraft } from '../storage'
import type { AssistantIntent, ChatMessage, Course } from '../types'

interface ChatState {
  intent?: AssistantIntent
  initialMessage?: string
  error?: string
}

export function AssistantChat() {
  const navigate = useNavigate()
  const location = useLocation()
  const { courses } = useSchedule()
  const incoming = (location.state || {}) as ChatState
  const intent = incoming.intent || 'add'
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [pending, setPending] = useState<Course[]>([])
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [needConfig, setNeedConfig] = useState(false)
  const started = useMemo(() => ({ intent, text: incoming.initialMessage, error: incoming.error }), [])
  const booted = useRef(false)

  useEffect(() => {
    if (booted.current) return
    booted.current = true
    if (started.error) {
      setMessages([
        { id: 'err', role: 'assistant', text: started.error },
      ])
      return
    }
    if (intent === 'conflict') {
      const pairs = findConflicts(courses)
      setMessages([
        {
          id: 'c1',
          role: 'assistant',
          text: pairs.length
            ? `检测到 ${pairs.length} 组时间冲突：`
            : '当前课表未检测到时间冲突，可以正常添加。',
          conflicts: pairs,
        },
      ])
      return
    }
    if (intent === 'edit') {
      setMessages([
        {
          id: 'e1',
          role: 'assistant',
          text:
            courses.length === 0
              ? '课表里还没有课程。你可以先添加一门课。'
              : `当前有 ${courses.length} 门课。请告诉我要改哪一门，例如：把设计课的教室改到 B305。\n\n${courses
                  .map((course) => `· ${course.name}：${courseSummary(course)}`)
                  .join('\n')}`,
        },
      ])
      return
    }
    if (started.text) {
      void handleSend(started.text)
      return
    }
    setMessages([
      {
        id: 'a1',
        role: 'assistant',
        text: '请输入课程安排，例如：周三下午两点上高等数学，张老师，A101，上16周',
      },
    ])
  }, [])

  const push = (message: ChatMessage) => setMessages((prev) => [...prev, message])

  const handleSend = async (text: string) => {
    push({ id: createLocalId(), role: 'user', text })
    setBusy(true)
    setEditing(false)
    try {
      const result = await parseWithLLM({
        mode: 'text',
        text,
        intent,
        existingCourses: courses,
      })
      setPending(result.courses)
      saveDraft({ mode: intent === 'edit' ? 'edit' : 'add', courses: result.courses, originalId: result.courses[0]?.id })
      setNeedConfig(Boolean(result.needConfig))
      push({
        id: createLocalId(),
        role: 'assistant',
        text: result.reply || (result.courses.length ? '我已为你解析出以下课程信息：' : '我没有解析到完整课程，请补充课程名、星期和节次。'),
        courses: result.courses,
      })
    } catch (error) {
      const text = error instanceof Error ? error.message : '解析失败'
      setNeedConfig(/Key|模型/.test(text))
      push({
        id: createLocalId(),
        role: 'assistant',
        text,
      })
    } finally {
      setBusy(false)
    }
  }

  const goConfirm = () => {
    if (!pending.length) return
    saveDraft({ mode: intent === 'edit' ? 'edit' : 'add', courses: pending, originalId: pending[0]?.id })
    navigate('/assistant/confirm')
  }

  return (
    <div className="page chat-page">
      <header className="topbar">
        <div className="brand">
          <RobotAvatar size={28} />
          <h1>课程创建助手</h1>
        </div>
        <button type="button" className="ghost" onClick={() => navigate('/schedule')}>
          ×
        </button>
      </header>

      <div className="chat-stream">
        {messages.map((message) => (
          <div key={message.id} className={`bubble-row ${message.role}`}>
            {message.role === 'assistant' ? <RobotAvatar size={28} /> : null}
            <div className={`bubble ${message.role}`}>
              <p>{message.text}</p>
              {message.conflicts?.map((pair) => (
                <div key={`${pair.a.id}-${pair.b.id}`} className="conflict-item">
                  {pair.reason}
                </div>
              ))}
              {message.courses?.map((course) => (
                <CourseDetailCard key={course.id} course={course} />
              ))}
            </div>
          </div>
        ))}
        {needConfig ? (
          <button type="button" className="btn ghost-btn" onClick={() => navigate('/assistant/settings')}>
            去配置模型 Key
          </button>
        ) : null}

        {pending.length === 1 && editing ? (
          <CourseEditForm course={pending[0]!} onChange={(course) => setPending([course])} />
        ) : null}

        {pending.length > 0 && !busy ? (
          <div className="confirm-ask">
            <p>请确认是否添加到你的课表？</p>
            <div className="btn-row">
              <button type="button" className="btn primary" onClick={goConfirm}>
                确认添加
              </button>
              <button type="button" className="btn ghost-btn" onClick={() => setEditing((v) => !v)}>
                修改信息
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <Composer placeholder="请输入其他要求..." disabled={busy} onSend={(text) => void handleSend(text)} />
    </div>
  )
}

function createLocalId() {
  return `m_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
}

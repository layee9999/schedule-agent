import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { compressImage, parseWithLLM } from '../api'
import { pingChaoxing } from '../bridge'
import { Composer } from '../Composer'
import { useSchedule } from '../context'
import { isEmbed } from '../embed'
import { IconEdit, IconImport, IconPlus, IconWarn, RobotAvatar } from '../icons'
import { saveDraft } from '../storage'
import type { AssistantIntent } from '../types'

export function AssistantLanding() {
  const navigate = useNavigate()
  const { courses } = useSchedule()
  const fileRef = useRef<HTMLInputElement>(null)
  const [chaoxingOn, setChaoxingOn] = useState(false)

  useEffect(() => {
    if (!isEmbed()) return
    void pingChaoxing().then(setChaoxingOn)
  }, [])

  const openChat = (intent: AssistantIntent, initialMessage?: string) => {
    navigate('/assistant/chat', { state: { intent, initialMessage } })
  }

  const importFiles = async (files: FileList) => {
    const file = files[0]
    if (!file) return
    navigate('/assistant/chat', { state: { intent: 'import' as const, loading: true } })
    try {
      const isImage = file.type.startsWith('image/')
      const result = await parseWithLLM({
        mode: isImage ? 'image' : 'file',
        text: isImage ? '请识别这张课表图片中的全部课程' : await file.text(),
        image: isImage ? await compressImage(file) : undefined,
        intent: 'import',
        existingCourses: courses,
      })
      saveDraft({ mode: 'add', courses: result.courses })
      navigate('/assistant/import', { state: { courses: result.courses, reply: result.reply } })
    } catch (error) {
      navigate('/assistant/chat', {
        state: {
          intent: 'import',
          error: error instanceof Error ? error.message : '导入失败',
        },
      })
    }
  }

  const copyBookmarklet = async () => {
    navigate('/assistant/deploy')
  }

  return (
    <div className="page assistant-landing">
      <header className="topbar">
        <button type="button" className="ghost" onClick={() => navigate('/schedule')}>
          ‹
        </button>
        <h1>AI 课程助手</h1>
        <span />
      </header>

      <section className="hero">
        <RobotAvatar size={72} />
        <div>
          <h2>
            你好！
            <br />
            我是你的课程创建助手
          </h2>
          <p>我可以帮你快速添加课程、导入课表、修改课程或检查时间冲突。</p>
        </div>
      </section>

      {chaoxingOn ? (
        <p className="warn-banner" style={{ margin: '0 16px 12px' }}>
          已连接学习通课表，确认添加会写入真实课表。
        </p>
      ) : null}
      <div className="action-list">
        <button type="button" className="action-card" onClick={() => openChat('add')}>
          <IconPlus />
          <div>
            <b>添加一门课程</b>
            <span>通过对话或自然语言创建课程</span>
          </div>
          <i>›</i>
        </button>
        <button type="button" className="action-card" onClick={() => fileRef.current?.click()}>
          <IconImport />
          <div>
            <b>导入课表</b>
            <span>支持图片、文件、分享</span>
          </div>
          <i>›</i>
        </button>
        <button type="button" className="action-card" onClick={() => openChat('edit')}>
          <IconEdit />
          <div>
            <b>修改已有课程</b>
            <span>快速调整课程信息</span>
          </div>
          <i>›</i>
        </button>
        <button type="button" className="action-card" onClick={() => openChat('conflict')}>
          <IconWarn />
          <div>
            <b>检查课程冲突</b>
            <span>智能检测时间冲突</span>
          </div>
          <i>›</i>
        </button>
      </div>

      <div className="link-row">
        <button type="button" className="linkish" onClick={() => navigate('/assistant/settings')}>
          配置模型 Key
        </button>
        <button type="button" className="linkish" onClick={() => void copyBookmarklet()}>
          部署到学习通课表
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*,.txt,.csv,.md,.json"
        hidden
        onChange={(event) => {
          if (event.target.files?.length) void importFiles(event.target.files)
          event.target.value = ''
        }}
      />

      <Composer
        onSend={(text) => openChat('add', text)}
        onFiles={importFiles}
      />
    </div>
  )
}

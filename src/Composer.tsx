import { useEffect, useRef, useState } from 'react'
import { IconMic } from './icons'

interface ComposerProps {
  placeholder?: string
  disabled?: boolean
  onSend: (text: string) => void
  onFiles?: (files: FileList) => void
}

export function Composer({
  placeholder = '请输入课程安排，例如：周三下午2点上高数...',
  disabled,
  onSend,
  onFiles,
}: ComposerProps) {
  const [value, setValue] = useState('')
  const [listening, setListening] = useState(false)
  const recRef = useRef<SpeechRecognition | null>(null)

  useEffect(() => {
    return () => recRef.current?.abort()
  }, [])

  const submit = () => {
    const text = value.trim()
    if (!text || disabled) return
    onSend(text)
    setValue('')
  }

  const toggleVoice = () => {
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!Ctor) {
      window.alert('当前浏览器不支持语音输入，请直接打字。')
      return
    }
    if (listening) {
      recRef.current?.stop()
      setListening(false)
      return
    }
    const rec = new Ctor()
    rec.lang = 'zh-CN'
    rec.interimResults = false
    rec.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript
      if (transcript) setValue((prev) => `${prev}${transcript}`)
    }
    rec.onend = () => setListening(false)
    rec.onerror = () => setListening(false)
    recRef.current = rec
    rec.start()
    setListening(true)
  }

  return (
    <div className="composer">
      <input
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') submit()
        }}
      />
      {onFiles ? (
        <label className="icon-btn" title="导入文件">
          ＋
          <input
            type="file"
            accept="image/*,.txt,.csv,.md"
            hidden
            onChange={(event) => {
              if (event.target.files?.length) onFiles(event.target.files)
              event.target.value = ''
            }}
          />
        </label>
      ) : null}
      <button type="button" className={`icon-btn ${listening ? 'on' : ''}`} onClick={toggleVoice} aria-label="语音输入">
        <IconMic active={listening} />
      </button>
    </div>
  )
}

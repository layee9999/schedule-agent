import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LLM_PRESETS, fetchLlmStatus, loadLlmSettings, persistLlmSettings, type LlmSettings } from '../settings'

export function SettingsPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState<LlmSettings>(loadLlmSettings)
  const [saved, setSaved] = useState('')
  const [busy, setBusy] = useState(false)
  const [serverHint, setServerHint] = useState('')

  useEffect(() => {
    void (async () => {
      const local = loadLlmSettings()
      try {
        const server = await fetchLlmStatus()
        setServerHint(
          server.configured
            ? `当前服务端：${server.baseUrl} / ${server.model}`
            : '服务端尚未配置 Key',
        )
        setForm({
          apiKey: local.apiKey,
          baseUrl:
            local.baseUrl && !local.baseUrl.includes('api.openai.com')
              ? local.baseUrl
              : server.baseUrl,
          model: local.model || server.model,
        })
      } catch {
        setForm(local)
      }
    })()
  }, [])

  const save = async () => {
    if (!form.apiKey.trim() && form.baseUrl !== 'local://demo') {
      setSaved('请先填写 API Key，或选择「本地演示」')
      return
    }
    setBusy(true)
    try {
      await persistLlmSettings({
        apiKey: form.apiKey.trim() || 'demo',
        baseUrl: (form.baseUrl.trim() || 'local://demo').replace(/\/$/, ''),
        model: form.model.trim() || 'demo',
      })
      setSaved('已保存，可直接回去对话，无需重启服务。')
    } catch (error) {
      setSaved(error instanceof Error ? error.message : '保存失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page settings-page">
      <header className="topbar">
        <button type="button" className="ghost" onClick={() => navigate(-1)}>
          ‹
        </button>
        <h1>模型设置</h1>
        <span />
      </header>

      <div className="settings-body">
        <p className="muted">对话解析需要 OpenAI 兼容接口。未在本页填写时，会使用项目根目录 .env。</p>
        {serverHint ? <p className="muted">{serverHint}</p> : null}

        <div className="preset-row">
          {LLM_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className="chip"
              onClick={() =>
                setForm((prev) => ({
                  apiKey: preset.id === 'demo' ? 'demo' : prev.apiKey,
                  baseUrl: preset.baseUrl,
                  model: preset.model,
                }))
              }
            >
              {preset.name}
            </button>
          ))}
        </div>

        <label>
          API Key
          <input
            type="password"
            autoComplete="off"
            value={form.apiKey}
            placeholder="sk-..."
            onChange={(event) => setForm((prev) => ({ ...prev, apiKey: event.target.value }))}
          />
        </label>
        <label>
          Base URL
          <input
            value={form.baseUrl}
            onChange={(event) => setForm((prev) => ({ ...prev, baseUrl: event.target.value }))}
          />
        </label>
        <label>
          Model
          <input
            value={form.model}
            onChange={(event) => setForm((prev) => ({ ...prev, model: event.target.value }))}
          />
        </label>

        {saved ? <p className="warn-banner">{saved}</p> : null}

        <button type="button" className="btn primary" disabled={busy} onClick={() => void save()}>
          保存配置
        </button>
      </div>
    </div>
  )
}

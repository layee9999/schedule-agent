import { useNavigate } from 'react-router-dom'

export function DeployPage() {
  const navigate = useNavigate()
  const origin = window.location.origin
  const userscript = `${origin}/chaoxing-schedule-agent.user.js`
  const scheduleUrl = 'https://kb.chaoxing.com/res/pc/curriculum/schedule.html?role=1'

  return (
    <div className="page deploy-page">
      <header className="topbar">
        <button type="button" className="ghost" onClick={() => navigate(-1)}>
          ‹
        </button>
        <h1>部署到学习通</h1>
        <span />
      </header>

      <div className="deploy-body">
        <p className="lead">打开学习通教师课表后，右上角蓝色 AI 即可解析并写入真实课表。</p>

        <section className="deploy-card">
          <h3>现在这样用</h3>
          <ol>
            <li>
              本机保持 <code>npm run dev</code>（当前 http://127.0.0.1:5173 即可，不必 HTTPS）
            </li>
            <li>
              浏览器安装 Tampermonkey，打开
              <a href={userscript} target="_blank" rel="noreferrer">
                安装课表智能体脚本
              </a>
            </li>
            <li>
              用已登录账号打开
              <a href={scheduleUrl} target="_blank" rel="noreferrer">
                学习通教师课表
              </a>
            </li>
            <li>课表右上角点 AI：同步课表、对话添加、确认后写入超星，课表会刷新</li>
          </ol>
          <p className="muted">
            脚本匹配 <code>https://kb.chaoxing.com/res/pc/curriculum/schedule.html?role=1</code>。请允许 Tampermonkey 访问 localhost。当前脚本版本 <code>1.8.1</code>。
          </p>
        </section>

        <section className="deploy-card">
          <h3>若看不到蓝色 AI</h3>
          <ol>
            <li>
              Edge 打开 <code>edge://extensions</code>，打开右上角「开发人员模式」
            </li>
            <li>
              点 Tampermonkey「详细信息」，打开 <strong>允许运行用户脚本 / Allow User Scripts</strong>
              （只开开发人员模式不够，没有这一项脚本不会注入）
            </li>
            <li>仪表盘确认脚本版本是 1.8.1；否则打开上面的安装链接覆盖安装</li>
            <li>回到课表页 Ctrl+F5。F12 应出现 <code>[课表智能体] 1.8.1 已执行</code></li>
          </ol>
        </section>
      </div>
    </div>
  )
}

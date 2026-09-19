import { Navigate, Route, Routes } from 'react-router-dom'
import { isEmbed } from './embed'
import { AssistantChat } from './pages/AssistantChat'
import { AssistantLanding } from './pages/AssistantLanding'
import { ConfirmPage } from './pages/ConfirmPage'
import { DeployPage } from './pages/DeployPage'
import { ImportPage } from './pages/ImportPage'
import { PlaceholderPage, SchedulePage } from './pages/SchedulePage'
import { SettingsPage } from './pages/SettingsPage'
import { SuccessPage } from './pages/SuccessPage'
import { PhoneShell } from './shell'
import { ChaoxingBootstrap } from './ChaoxingBootstrap'

export function App() {
  return (
    <PhoneShell>
      <ChaoxingBootstrap />
      <Routes>
        <Route path="/" element={<Navigate to={isEmbed() ? '/assistant' : '/schedule'} replace />} />
        <Route path="/schedule" element={<SchedulePage />} />
        <Route path="/home" element={<PlaceholderPage title="首页" />} />
        <Route path="/messages" element={<PlaceholderPage title="消息" />} />
        <Route path="/notes" element={<PlaceholderPage title="笔记" />} />
        <Route path="/assistant" element={<AssistantLanding />} />
        <Route path="/assistant/chat" element={<AssistantChat />} />
        <Route path="/assistant/confirm" element={<ConfirmPage />} />
        <Route path="/assistant/success" element={<SuccessPage />} />
        <Route path="/assistant/import" element={<ImportPage />} />
        <Route path="/assistant/settings" element={<SettingsPage />} />
        <Route path="/assistant/deploy" element={<DeployPage />} />
      </Routes>
    </PhoneShell>
  )
}

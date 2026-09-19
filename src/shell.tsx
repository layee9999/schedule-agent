import type { ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { IconHome, IconMessage, IconNote, IconSchedule } from './icons'
import { isEmbed } from './embed'

const TABS = [
  { to: '/home', label: '首页', icon: IconHome },
  { to: '/messages', label: '消息', icon: IconMessage },
  { to: '/notes', label: '笔记', icon: IconNote },
  { to: '/schedule', label: '课表', icon: IconSchedule },
]

export function BottomNav() {
  const location = useLocation()
  if (isEmbed() || location.pathname.startsWith('/assistant')) return null

  return (
    <nav className="tabbar">
      {TABS.map((tab) => (
        <NavLink key={tab.to} to={tab.to} className={({ isActive }) => `tab ${isActive ? 'active' : ''}`}>
          {({ isActive }) => (
            <>
              <tab.icon active={isActive} />
              <span>{tab.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

export function StatusBar({ time = '15:57' }: { time?: string }) {
  return (
    <div className="statusbar">
      <span>{time}</span>
      <span className="statusbar-icons">●●●  ▮▮▮</span>
    </div>
  )
}

export function PhoneShell({ children }: { children: ReactNode }) {
  return (
    <div className={`app-root ${isEmbed() ? 'embed' : ''}`}>
      <div className="phone">
        <StatusBar />
        {children}
        <BottomNav />
      </div>
    </div>
  )
}

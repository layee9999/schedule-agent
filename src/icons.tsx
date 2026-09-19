export function RobotAvatar({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="32" fill="#E8F1FF" />
      <rect x="14" y="18" width="36" height="30" rx="14" fill="#4C8DFF" />
      <circle cx="24.5" cy="32" r="4.2" fill="#fff" />
      <circle cx="39.5" cy="32" r="4.2" fill="#fff" />
      <circle cx="25.2" cy="32.5" r="1.6" fill="#2B4C8A" />
      <circle cx="40.2" cy="32.5" r="1.6" fill="#2B4C8A" />
      <rect x="26" y="40" width="12" height="3.2" rx="1.6" fill="#D6E6FF" />
      <rect x="30" y="10" width="4" height="8" rx="2" fill="#4C8DFF" />
      <circle cx="32" cy="9" r="3" fill="#7EB3FF" />
    </svg>
  )
}

export function IconHome({ active }: { active?: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z"
        stroke={active ? '#3D7BFF' : '#9AA3B2'}
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function IconMessage({ active }: { active?: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M5 6h14v10H8l-3 3V6Z"
        stroke={active ? '#3D7BFF' : '#9AA3B2'}
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function IconNote({ active }: { active?: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M7 4h8l4 4v12H7V4Z"
        stroke={active ? '#3D7BFF' : '#9AA3B2'}
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M15 4v4h4M9 12h6M9 16h6" stroke={active ? '#3D7BFF' : '#9AA3B2'} strokeWidth="1.7" />
    </svg>
  )
}

export function IconSchedule({ active }: { active?: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect
        x="4"
        y="5"
        width="16"
        height="15"
        rx="2"
        stroke={active ? '#3D7BFF' : '#9AA3B2'}
        strokeWidth="1.7"
      />
      <path d="M8 3v4M16 3v4M4 10h16" stroke={active ? '#3D7BFF' : '#9AA3B2'} strokeWidth="1.7" />
    </svg>
  )
}

export function IconPlus() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill="#E8F1FF" />
      <path d="M12 8v8M8 12h8" stroke="#3D7BFF" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export function IconImport() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill="#F3E8FF" />
      <path d="M12 7v7M9 11l3 3 3-3" stroke="#A855F7" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8 16h8" stroke="#A855F7" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export function IconEdit() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill="#E7F8EE" />
      <path d="M8 16l.8-3.2L15 6.6a1.2 1.2 0 0 1 1.7 1.7L10.5 15 8 16Z" fill="#22C55E" />
    </svg>
  )
}

export function IconWarn() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill="#FFF4E5" />
      <path d="M12 8v5" stroke="#F59E0B" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="16.2" r="1" fill="#F59E0B" />
    </svg>
  )
}

export function IconBook({ color }: { color: string }) {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <rect width="28" height="28" rx="8" fill={color} opacity="0.16" />
      <path
        d="M9 8.5h9.5a1 1 0 0 1 1 1V19a.8.8 0 0 1-.8.8H10.5A1.5 1.5 0 0 1 9 18.3V8.5Z"
        stroke={color}
        strokeWidth="1.6"
      />
      <path d="M11 12h6M11 15h4" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function IconMic({ active }: { active?: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="9" y="4" width="6" height="10" rx="3" stroke={active ? '#3D7BFF' : '#8B93A7'} strokeWidth="1.7" />
      <path
        d="M7 11a5 5 0 0 0 10 0M12 16v3"
        stroke={active ? '#3D7BFF' : '#8B93A7'}
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function IconCheck({ on }: { on?: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill={on ? '#3D7BFF' : '#E6EAF2'} />
      <path d="M8 12.2 10.8 15l5.2-6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

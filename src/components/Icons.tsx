// Inline stroke icons — one consistent 24px grid, currentColor, 2px stroke.
import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement> & { size?: number }

function base({ size = 22, ...rest }: P) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    ...rest,
  }
}

export const IconHome = (p: P) => (
  <svg {...base(p)}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" /></svg>
)

// Dumbbell
export const IconDumbbell = (p: P) => (
  <svg {...base(p)}>
    <path d="M6.5 8v8M4 9.5v5M17.5 8v8M20 9.5v5M6.5 12h11" />
  </svg>
)

export const IconRoutine = (p: P) => (
  <svg {...base(p)}><rect x="4" y="4" width="16" height="16" rx="2.5" /><path d="M8 9h8M8 13h8M8 17h5" /></svg>
)

export const IconSettings = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 13a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V19a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z" />
  </svg>
)

export const IconPlus = (p: P) => (<svg {...base(p)}><path d="M12 5v14M5 12h14" /></svg>)
export const IconCheck = (p: P) => (<svg {...base(p)}><path d="M4 12.5 9 17.5 20 6.5" /></svg>)
export const IconChevron = (p: P) => (<svg {...base(p)}><path d="m9 6 6 6-6 6" /></svg>)
export const IconClose = (p: P) => (<svg {...base(p)}><path d="M6 6l12 12M18 6 6 18" /></svg>)
export const IconArrowLeft = (p: P) => (<svg {...base(p)}><path d="M19 12H5M11 6l-6 6 6 6" /></svg>)
export const IconTrend = (p: P) => (<svg {...base(p)}><path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" /></svg>)
export const IconTrophy = (p: P) => (
  <svg {...base(p)}><path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" /><path d="M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M9 19h6M10 15.5V19M14 15.5V19M8 21h8" /></svg>
)
export const IconHistory = (p: P) => (<svg {...base(p)}><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 4v4h4M12 8v4l3 2" /></svg>)
export const IconCloud = (p: P) => (
  <svg {...base(p)}><path d="M7 18a4 4 0 0 1-.5-7.97A6 6 0 0 1 18 9.5a3.5 3.5 0 0 1-.5 8.5H7Z" /></svg>
)
export const IconCloudCheck = (p: P) => (
  <svg {...base(p)}><path d="M7 18a4 4 0 0 1-.5-7.97A6 6 0 0 1 18 9.5a3.5 3.5 0 0 1 .3 7" /><path d="M9 16.5 11 18.5 15 14.5" /></svg>
)
export const IconDownload = (p: P) => (<svg {...base(p)}><path d="M12 3v12M7 11l5 5 5-5M4 21h16" /></svg>)
export const IconUpload = (p: P) => (<svg {...base(p)}><path d="M12 21V9M7 13l5-5 5 5M4 3h16" /></svg>)
export const IconRefresh = (p: P) => (<svg {...base(p)}><path d="M21 12a9 9 0 1 1-2.6-6.4M21 4v5h-5" /></svg>)
export const IconExternal = (p: P) => (<svg {...base(p)}><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>)

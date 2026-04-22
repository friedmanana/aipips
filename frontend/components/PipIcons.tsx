/** Shared Pip character SVG icons — used across dashboard cards and phase stepper */

export function CvPip({ className = 'w-9 h-9' }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" className={className}>
      {/* Sparkles */}
      <path d="M33 8l.6 1.8 1.8.6-1.8.6L33 12.8l-.6-1.8-1.8-.6 1.8-.6z" fill="currentColor" opacity="0.55"/>
      <circle cx="6" cy="13" r="1.1" fill="currentColor" opacity="0.4"/>
      <circle cx="35" cy="24" r="0.8" fill="currentColor" opacity="0.35"/>
      {/* Antenna */}
      <line x1="20" y1="5" x2="20" y2="9" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="20" cy="3.5" r="2.2" fill="currentColor"/>
      {/* Head */}
      <rect x="8" y="9" width="24" height="19" rx="7" fill="currentColor"/>
      {/* Eyes */}
      <rect x="12" y="13.5" width="6" height="6" rx="2" fill="white"/>
      <rect x="22" y="13.5" width="6" height="6" rx="2" fill="white"/>
      <circle cx="15" cy="16.5" r="2.1" fill="currentColor"/>
      <circle cx="25" cy="16.5" r="2.1" fill="currentColor"/>
      <circle cx="15.9" cy="15.4" r="0.7" fill="white"/>
      <circle cx="25.9" cy="15.4" r="0.7" fill="white"/>
      {/* Grin */}
      <path d="M14 24 Q20 29 26 24" stroke="white" strokeWidth="1.6" strokeLinecap="round" fill="none"/>
      {/* Body with CV lines */}
      <rect x="12" y="28" width="16" height="9" rx="4" fill="currentColor" opacity="0.72"/>
      <line x1="15" y1="31" x2="25" y2="31" stroke="white" strokeWidth="1.2" strokeLinecap="round" opacity="0.75"/>
      <line x1="15" y1="34" x2="22" y2="34" stroke="white" strokeWidth="1.2" strokeLinecap="round" opacity="0.75"/>
    </svg>
  )
}

export function LetterPip({ className = 'w-9 h-9' }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" className={className}>
      {/* Heart accent */}
      <path d="M33 9 Q34.2 7.2 36 9 Q37.8 10.8 36 13 Q34.5 14.5 33 13 Q31.2 10.8 33 9z" fill="currentColor" opacity="0.5"/>
      {/* Antenna curl */}
      <path d="M20 9 C22 6 24 5 22 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none"/>
      <circle cx="21.5" cy="2.5" r="2" fill="currentColor"/>
      {/* Head */}
      <rect x="8" y="9" width="24" height="19" rx="7" fill="currentColor"/>
      {/* Eyes — one normal, one wink */}
      <rect x="12" y="13.5" width="6" height="6" rx="2" fill="white"/>
      <circle cx="15" cy="16.5" r="2" fill="currentColor"/>
      <circle cx="15.8" cy="15.6" r="0.6" fill="white"/>
      <path d="M22 17 Q25 13.5 28 17" stroke="white" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
      {/* Smile */}
      <path d="M14 24 Q20 28 26 24" stroke="white" strokeWidth="1.6" strokeLinecap="round" fill="none"/>
      {/* Body as envelope */}
      <rect x="10" y="28" width="20" height="10" rx="3.5" fill="currentColor" opacity="0.72"/>
      <path d="M10 28 L20 35 L30 28" stroke="white" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.8"/>
    </svg>
  )
}

export function InterviewPip({ className = 'w-9 h-9' }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" className={className}>
      {/* Stars */}
      <path d="M33 7l.5 1.6 1.6.5-1.6.5-.5 1.6-.5-1.6-1.6-.5 1.6-.5z" fill="currentColor" opacity="0.6"/>
      <path d="M6 17l.4 1.2 1.2.4-1.2.4-.4 1.2-.4-1.2-1.2-.4 1.2-.4z" fill="currentColor" opacity="0.35"/>
      {/* Antenna + star tip */}
      <line x1="20" y1="5" x2="20" y2="9" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M20 1.5l.6 1.8 1.8.6-1.8.6-.6 1.8-.6-1.8-1.8-.6 1.8-.6z" fill="currentColor"/>
      {/* Head */}
      <rect x="8" y="9" width="24" height="19" rx="7" fill="currentColor"/>
      {/* Eyes — confident narrow */}
      <rect x="12" y="14" width="6" height="4.5" rx="2" fill="white"/>
      <rect x="22" y="14" width="6" height="4.5" rx="2" fill="white"/>
      <rect x="13.2" y="15" width="3.6" height="2.5" rx="1.2" fill="currentColor"/>
      <rect x="23.2" y="15" width="3.6" height="2.5" rx="1.2" fill="currentColor"/>
      <circle cx="14.2" cy="15.4" r="0.6" fill="white"/>
      <circle cx="24.2" cy="15.4" r="0.6" fill="white"/>
      {/* Mouth */}
      <path d="M15 23.5 Q20 26.5 25 23.5" stroke="white" strokeWidth="1.6" strokeLinecap="round" fill="none"/>
      {/* Body */}
      <rect x="12" y="28" width="16" height="9" rx="4" fill="currentColor" opacity="0.72"/>
      {/* Mic on chest */}
      <rect x="18" y="29.5" width="4" height="5" rx="2" stroke="white" strokeWidth="1.3" fill="none" opacity="0.85"/>
      <path d="M17 35.5 Q20 37.5 23 35.5" stroke="white" strokeWidth="1.3" strokeLinecap="round" fill="none" opacity="0.75"/>
      <line x1="20" y1="34.5" x2="20" y2="35.5" stroke="white" strokeWidth="1.3" strokeLinecap="round" opacity="0.75"/>
    </svg>
  )
}

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

function LogoMark() {
  return (
    <div className="flex items-center gap-2">
      <svg width="30" height="30" viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="52" height="52" rx="10" fill="#4F46E5" />
        <circle cx="16" cy="26" r="5" fill="white" fillOpacity="0.4" />
        <circle cx="26" cy="16" r="5" fill="white" fillOpacity="0.75" />
        <circle cx="36" cy="26" r="5" fill="white" />
        <circle cx="26" cy="36" r="5" fill="white" fillOpacity="0.6" />
        <line x1="16" y1="26" x2="26" y2="16" stroke="white" strokeWidth="1.5" strokeOpacity="0.3" />
        <line x1="26" y1="16" x2="36" y2="26" stroke="white" strokeWidth="1.5" strokeOpacity="0.3" />
        <line x1="36" y1="26" x2="26" y2="36" stroke="white" strokeWidth="1.5" strokeOpacity="0.3" />
        <line x1="26" y1="36" x2="16" y2="26" stroke="white" strokeWidth="1.5" strokeOpacity="0.3" />
      </svg>
      <span className="font-black text-lg tracking-tight">
        <span className="text-indigo-600">AI</span>
        <span className="text-slate-800"> Pips</span>
      </span>
      <span className="hidden sm:inline text-xs text-slate-400 font-medium border border-slate-200 rounded-full px-2 py-0.5 ml-1">Hiring Kit</span>
    </div>
  )
}

export default function Nav() {
  const pathname = usePathname()

  return (
    <nav className="bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/">
            <LogoMark />
          </Link>

          <div className="flex items-center gap-1">
            <Link
              href="/jobs/new"
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                pathname.startsWith('/jobs') ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              Dashboard
            </Link>
            <Link
              href="/settings"
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                pathname === '/settings' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              Account
            </Link>
          </div>
        </div>
      </div>
    </nav>
  )
}

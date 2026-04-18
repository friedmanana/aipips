import Link from 'next/link'

const APPS = [
  {
    id: 'recruitment',
    title: 'Hiring Hub',
    description: '',
    color: 'indigo',
    portals: [
      {
        label: 'Hiring Manager',
        description: 'Post jobs, screen candidates, manage your pipeline',
        href: '/jobs/login',
        icon: (
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 3h-8a2 2 0 00-2 2v2h12V5a2 2 0 00-2-2z" />
          </svg>
        ),
        primary: true,
      },
      {
        label: 'Job Seeker',
        description: 'Build your CV, write cover letters, ace your interview',
        href: '/candidate/dashboard',
        icon: (
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        ),
        primary: false,
      },
    ],
  },
]

const COLOR_MAP: Record<string, { card: string; badge: string; btn: string; btnOutline: string }> = {
  indigo: {
    card: 'border-indigo-100 bg-gradient-to-br from-indigo-50/60 to-white',
    badge: 'bg-indigo-100 text-indigo-700',
    btn: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm',
    btnOutline: 'border-indigo-200 text-indigo-700 hover:bg-indigo-50',
  },
}

function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = {
    sm: { box: 28, r: 7, text: 'text-base' },
    md: { box: 36, r: 9, text: 'text-xl' },
    lg: { box: 52, r: 13, text: 'text-3xl' },
  }
  const s = sizes[size]
  return (
    <div className="flex items-center gap-2.5">
      {/* Icon mark */}
      <svg width={s.box} height={s.box} viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="52" height="52" rx={s.r} fill="#4F46E5" />
        {/* Three dots — pips */}
        <circle cx="16" cy="26" r="5" fill="white" fillOpacity="0.4" />
        <circle cx="26" cy="16" r="5" fill="white" fillOpacity="0.75" />
        <circle cx="36" cy="26" r="5" fill="white" />
        <circle cx="26" cy="36" r="5" fill="white" fillOpacity="0.6" />
        {/* Connecting lines */}
        <line x1="16" y1="26" x2="26" y2="16" stroke="white" strokeWidth="1.5" strokeOpacity="0.3" />
        <line x1="26" y1="16" x2="36" y2="26" stroke="white" strokeWidth="1.5" strokeOpacity="0.3" />
        <line x1="36" y1="26" x2="26" y2="36" stroke="white" strokeWidth="1.5" strokeOpacity="0.3" />
        <line x1="26" y1="36" x2="16" y2="26" stroke="white" strokeWidth="1.5" strokeOpacity="0.3" />
      </svg>
      {/* Wordmark */}
      <span className={`${s.text} font-black tracking-tight`}>
        <span className="text-indigo-600">AI</span>
        <span className="text-slate-800"> Pips</span>
      </span>
    </div>
  )
}

export default function HubPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 flex flex-col">

      {/* Nav */}
      <header className="border-b border-slate-100 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Logo size="sm" />
          <nav className="hidden sm:flex items-center gap-6 text-sm text-slate-500 font-medium">
            <span className="text-slate-300">|</span>
            <span className="text-slate-400">Products</span>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto px-6 py-20 w-full">

        {/* Hero */}
        <div className="text-center mb-20">
          <div className="flex justify-center mb-8">
            <Logo size="lg" />
          </div>
          <h1 className="text-5xl sm:text-6xl font-black text-slate-900 tracking-tight mb-5 leading-tight">
            AI tools that make common sense
          </h1>
        </div>

        {/* Live apps */}
        <div>
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">Applications</h2>

          {APPS.map(app => {
            const colors = COLOR_MAP[app.color]
            return (
              <div key={app.id} className={`rounded-3xl border p-8 mb-6 ${colors.card}`}>
                <div className="mb-8">
                  <div className="flex items-center gap-3 mb-4">
                    <h3 className="text-2xl font-black text-slate-900">{app.title}</h3>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${colors.badge}`}>Live</span>
                  </div>
                  {app.description && <p className="text-slate-500 text-base">{app.description}</p>}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {app.portals.map(portal => (
                    <Link
                      key={portal.href}
                      href={portal.href}
                      className={`group flex items-center gap-4 p-5 rounded-2xl border transition-all hover:shadow-md hover:-translate-y-0.5 ${
                        portal.primary
                          ? `${colors.btn} border-transparent`
                          : `bg-white ${colors.btnOutline} hover:border-indigo-300`
                      }`}
                    >
                      <span className={`shrink-0 ${portal.primary ? 'text-white/90' : 'text-indigo-500'}`}>
                        {portal.icon}
                      </span>
                      <div>
                        <p className={`font-bold text-base ${portal.primary ? 'text-white' : 'text-slate-800'}`}>
                          {portal.label}
                        </p>
                        <p className={`text-sm mt-0.5 ${portal.primary ? 'text-white/80' : 'text-slate-500'}`}>
                          {portal.description}
                        </p>
                      </div>
                      <svg
                        className={`w-5 h-5 ml-auto shrink-0 transition-transform group-hover:translate-x-1 ${portal.primary ? 'text-white/70' : 'text-slate-300'}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-100 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div>
              <Logo size="sm" />
              <p className="text-sm text-slate-400 mt-2 max-w-xs">
                AI tools that make common sense.
              </p>
            </div>
            <div className="flex flex-col sm:items-end gap-1 text-sm text-slate-400">
              <div className="flex gap-5">
                <Link href="/candidate/dashboard" className="hover:text-indigo-600 transition-colors">Job Seeker</Link>
                <Link href="/jobs" className="hover:text-indigo-600 transition-colors">Hiring Manager</Link>
              </div>
              <p className="text-xs mt-3">© {new Date().getFullYear()} AI Pips. All rights reserved.</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

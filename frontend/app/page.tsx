import Link from 'next/link'

const APPS = [
  {
    id: 'recruitment',
    emoji: '🏢',
    title: 'Recruitment Suite',
    description: 'AI-powered hiring tools for NZ public sector roles — from job posting to candidate screening.',
    color: 'indigo',
    portals: [
      {
        label: 'Hiring Manager',
        description: 'Post jobs, screen candidates, manage pipeline',
        href: '/jobs',
        icon: '👔',
        primary: true,
      },
      {
        label: 'Candidate Portal',
        description: 'Enhance your CV, write cover letters, prep for interviews',
        href: '/candidate/dashboard',
        icon: '🎯',
        primary: false,
      },
    ],
  },
]

const COMING_SOON = [
  { emoji: '📊', title: 'Policy Analyser', description: 'AI-assisted policy review and drafting for government teams.' },
  { emoji: '📝', title: 'Report Writer', description: 'Generate structured reports and briefings in minutes.' },
  { emoji: '🔍', title: 'Research Assistant', description: 'Deep research and summarisation across multiple sources.' },
]

const COLOR_MAP: Record<string, { card: string; badge: string; btn: string; btnOutline: string }> = {
  indigo: {
    card: 'border-indigo-100 bg-gradient-to-br from-indigo-50/60 to-white',
    badge: 'bg-indigo-100 text-indigo-700',
    btn: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm',
    btnOutline: 'border-indigo-200 text-indigo-700 hover:bg-indigo-50',
  },
}

export default function HubPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">

      {/* Nav */}
      <header className="border-b border-slate-100 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl font-black text-indigo-600 tracking-tight">ai</span>
            <span className="text-xl font-black text-slate-800 tracking-tight">pips</span>
          </div>
          <span className="text-xs text-slate-400 font-medium">AI-powered tools for modern work</span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-16">

        {/* Hero */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-100 text-indigo-600 text-xs font-semibold px-4 py-1.5 rounded-full mb-6">
            ✦ AI-powered productivity suite
          </div>
          <h1 className="text-5xl font-black text-slate-900 tracking-tight mb-4">
            Work smarter with AI
          </h1>
          <p className="text-xl text-slate-500 max-w-xl mx-auto">
            A growing suite of AI tools built for real work — hiring, writing, research, and more.
          </p>
        </div>

        {/* Live apps */}
        <div className="mb-6">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">Live applications</h2>

          {APPS.map(app => {
            const colors = COLOR_MAP[app.color]
            return (
              <div key={app.id} className={`rounded-3xl border p-8 mb-6 ${colors.card}`}>
                <div className="flex items-start gap-4 mb-8">
                  <span className="text-4xl">{app.emoji}</span>
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-2xl font-black text-slate-900">{app.title}</h3>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${colors.badge}`}>Live</span>
                    </div>
                    <p className="text-slate-500 text-base">{app.description}</p>
                  </div>
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
                      <span className="text-3xl shrink-0">{portal.icon}</span>
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

        {/* Coming soon */}
        <div>
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">Coming soon</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {COMING_SOON.map(app => (
              <div key={app.title} className="bg-white border border-slate-100 rounded-2xl p-6 opacity-60">
                <span className="text-3xl mb-3 block">{app.emoji}</span>
                <h3 className="font-bold text-slate-700 mb-1">{app.title}</h3>
                <p className="text-sm text-slate-400">{app.description}</p>
                <span className="inline-block mt-4 text-xs font-semibold text-slate-400 bg-slate-100 px-3 py-1 rounded-full">
                  Coming soon
                </span>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-100 mt-20 py-8">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <span className="font-black text-indigo-600">ai</span>
            <span className="font-black text-slate-700">pips</span>
          </div>
          <p className="text-xs text-slate-400">AI tools for modern work</p>
        </div>
      </footer>
    </div>
  )
}

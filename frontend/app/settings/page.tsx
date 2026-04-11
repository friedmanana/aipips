'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'

interface GoogleStatus {
  connected: boolean
  user_email?: string
  connected_at?: string
}

function formatDate(iso: string | undefined) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch { return iso }
}

export default function SettingsPage() {
  const searchParams = useSearchParams()
  const [gcalStatus, setGcalStatus] = useState<GoogleStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Read query params set by the OAuth callback redirect
  useEffect(() => {
    const connected = searchParams.get('connected')
    const email = searchParams.get('email')
    const error = searchParams.get('error')

    if (connected === 'google') {
      setBanner({
        type: 'success',
        message: `Google Calendar connected${email ? ` as ${email}` : ''}. Bookings will now create calendar events automatically.`,
      })
    } else if (error) {
      setBanner({ type: 'error', message: `Google authorisation failed: ${error}` })
    }
  }, [searchParams])

  // Load current status
  useEffect(() => {
    api.getGoogleStatus()
      .then(setGcalStatus)
      .catch(() => setGcalStatus({ connected: false }))
      .finally(() => setLoading(false))
  }, [])

  const handleConnect = async () => {
    setConnecting(true)
    try {
      const { url } = await api.getGoogleAuthUrl()
      window.location.href = url
    } catch (e) {
      setBanner({ type: 'error', message: e instanceof Error ? e.message : String(e) })
      setConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    setDisconnecting(true)
    try {
      await api.disconnectGoogle()
      setGcalStatus({ connected: false })
      setBanner({ type: 'success', message: 'Google Calendar disconnected.' })
    } catch (e) {
      setBanner({ type: 'error', message: e instanceof Error ? e.message : String(e) })
    } finally {
      setDisconnecting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Back */}
      <Link href="/" className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-1 mb-8">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Dashboard
      </Link>

      <h1 className="text-2xl font-bold text-slate-900 mb-2">Settings</h1>
      <p className="text-slate-500 mb-8">Manage integrations and account preferences.</p>

      {/* Banner */}
      {banner && (
        <div className={`mb-6 rounded-xl border px-4 py-3 flex items-start justify-between gap-4 ${banner.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          <p className="text-sm">{banner.message}</p>
          <button onClick={() => setBanner(null)} className="text-current opacity-60 hover:opacity-100 flex-shrink-0 text-lg leading-none">✕</button>
        </div>
      )}

      {/* Google Calendar integration */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">Integrations</h2>
          <p className="text-sm text-slate-500 mt-0.5">Connect external services to automate your workflow.</p>
        </div>

        <div className="px-6 py-5">
          <div className="flex items-start gap-4">
            {/* Google Calendar icon */}
            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-white border border-slate-200 shadow-sm">
              <svg viewBox="0 0 48 48" className="w-7 h-7">
                <rect width="48" height="48" rx="6" fill="white" />
                <rect x="6" y="6" width="36" height="36" rx="3" fill="#fff" stroke="#dadce0" strokeWidth="1.5"/>
                <rect x="6" y="14" width="36" height="4" fill="#4285F4"/>
                <rect x="6" y="6" width="36" height="8" rx="3" fill="#4285F4"/>
                {/* Mini calendar grid */}
                <text x="24" y="34" textAnchor="middle" fontSize="14" fontWeight="bold" fill="#1a73e8">31</text>
              </svg>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-semibold text-slate-900">Google Calendar</h3>
                {!loading && gcalStatus?.connected && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                    </svg>
                    Connected
                  </span>
                )}
              </div>

              {loading ? (
                <p className="text-sm text-slate-400 mt-1">Checking status…</p>
              ) : gcalStatus?.connected ? (
                <>
                  <p className="text-sm text-slate-600 mt-1">
                    Signed in as <strong>{gcalStatus.user_email}</strong>
                    {gcalStatus.connected_at && <span className="text-slate-400"> · Connected {formatDate(gcalStatus.connected_at)}</span>}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    When a candidate books a phone screen, a Google Calendar event is automatically created with a Google Meet link and both the interviewer and candidate are added as attendees.
                  </p>
                </>
              ) : (
                <p className="text-sm text-slate-500 mt-1">
                  Connect your Google Calendar to automatically create interview events with Google Meet links when candidates book their phone screen.
                </p>
              )}
            </div>

            <div className="flex-shrink-0 mt-0.5">
              {loading ? (
                <div className="w-24 h-8 bg-slate-100 rounded-lg animate-pulse" />
              ) : gcalStatus?.connected ? (
                <button
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="px-4 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  {disconnecting ? 'Disconnecting…' : 'Disconnect'}
                </button>
              ) : (
                <button
                  onClick={handleConnect}
                  disabled={connecting}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  {connecting ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Redirecting…
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Connect
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Setup checklist — only shown when not connected */}
          {!loading && !gcalStatus?.connected && (
            <div className="mt-5 rounded-xl bg-slate-50 border border-slate-200 p-4">
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-3">Setup required before connecting</p>
              <ol className="space-y-2 text-sm text-slate-600 list-decimal list-inside">
                <li>
                  Go to{' '}
                  <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
                    Google Cloud Console
                  </a>{' '}
                  → create a project → enable <strong>Google Calendar API</strong>
                </li>
                <li>
                  Create <strong>OAuth 2.0 credentials</strong> (type: Web Application)
                </li>
                <li>
                  Add authorised redirect URI:{' '}
                  <code className="bg-slate-200 px-1.5 py-0.5 rounded text-xs">
                    {'[your Render URL]/api/v1/integrations/google/callback'}
                  </code>
                </li>
                <li>
                  Add to Render environment variables:
                  <div className="mt-1.5 space-y-1">
                    {['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'BACKEND_URL', 'FRONTEND_URL'].map((v) => (
                      <code key={v} className="block bg-slate-200 px-2 py-0.5 rounded text-xs w-fit">{v}</code>
                    ))}
                  </div>
                </li>
                <li>Redeploy the backend, then click <strong>Connect</strong> above</li>
              </ol>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

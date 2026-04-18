'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const LogoSVG = () => (
  <svg width="40" height="40" viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="52" height="52" rx="11" fill="#4F46E5" />
    <circle cx="16" cy="26" r="5" fill="white" fillOpacity="0.4" />
    <circle cx="26" cy="16" r="5" fill="white" fillOpacity="0.75" />
    <circle cx="36" cy="26" r="5" fill="white" />
    <circle cx="26" cy="36" r="5" fill="white" fillOpacity="0.6" />
    <line x1="16" y1="26" x2="26" y2="16" stroke="white" strokeWidth="1.5" strokeOpacity="0.3" />
    <line x1="26" y1="16" x2="36" y2="26" stroke="white" strokeWidth="1.5" strokeOpacity="0.3" />
    <line x1="36" y1="26" x2="26" y2="36" stroke="white" strokeWidth="1.5" strokeOpacity="0.3" />
    <line x1="26" y1="36" x2="16" y2="26" stroke="white" strokeWidth="1.5" strokeOpacity="0.3" />
  </svg>
)

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Supabase sets the session from the URL hash after redirect
    const supabase = createClient()
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true)
      else setError('Invalid or expired reset link. Please request a new one.')
    })
  }, [])

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords do not match.'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    setLoading(true); setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    if (error) { setError(error.message); setLoading(false) }
    else { setDone(true); setTimeout(() => router.push('/login'), 2500) }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2.5 justify-center">
            <LogoSVG />
            <span className="text-2xl font-black tracking-tight">
              <span className="text-indigo-600">AI</span>
              <span className="text-slate-800"> Pips</span>
            </span>
          </Link>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          {done ? (
            <div className="text-center py-4">
              <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-slate-800 mb-2">Password updated</h2>
              <p className="text-sm text-slate-500">Redirecting you to sign in…</p>
            </div>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-slate-800 mb-1">Set a new password</h2>
              <p className="text-sm text-slate-400 mb-6">Choose a strong password for your AI Pips account.</p>

              {error && (
                <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
              )}

              {ready ? (
                <form onSubmit={handleReset} className="space-y-4" autoComplete="off">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">New password</label>
                    <input
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      autoComplete="off"
                      placeholder="Min. 6 characters"
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Confirm password</label>
                    <input
                      type="password"
                      value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                      required
                      autoComplete="off"
                      placeholder="Repeat your password"
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                  <button type="submit" disabled={loading}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-sm transition-colors disabled:opacity-60">
                    {loading ? 'Updating…' : 'Update password'}
                  </button>
                </form>
              ) : !error ? (
                <div className="text-center py-4 text-slate-400 text-sm">Verifying your link…</div>
              ) : null}
            </>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          <Link href="/login" className="hover:text-indigo-600 transition-colors">← Back to sign in</Link>
        </p>
      </div>
    </div>
  )
}

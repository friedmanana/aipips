'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type Step = 'enter-email' | 'link-sent'

export default function HiringLoginPage() {
  const [step, setStep] = useState<Step>('enter-email')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSendLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/jobs/new` },
      })
      if (error) {
        setError(error.message)
      } else {
        setStep('link-sent')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Brand */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 justify-center">
            <svg width="36" height="36" viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
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
            <span className="text-2xl font-black tracking-tight">
              <span className="text-indigo-600">AI</span>
              <span className="text-slate-800"> Pips</span>
            </span>
          </Link>
          <p className="text-slate-400 mt-2 text-sm font-medium">Hiring Hub</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          {step === 'enter-email' ? (
            <>
              <h2 className="text-lg font-semibold text-slate-800 mb-1">Sign in or create an account</h2>
              <p className="text-sm text-slate-400 mb-6">We'll send a secure sign-in link to your email — no password needed.</p>

              {error && (
                <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
              )}

              <form onSubmit={handleSendLink} className="space-y-4" autoComplete="off">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Work email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    placeholder="you@company.com"
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                      Sending…
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      Send sign-in link
                    </>
                  )}
                </button>
              </form>

              <p className="mt-5 text-xs text-slate-400 text-center">
                A magic link will be emailed to you. Clicking it signs you in instantly — new accounts are created automatically.
              </p>
            </>
          ) : (
            <div className="text-center py-4">
              <div className="w-14 h-14 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-slate-800 mb-2">Check your inbox</h2>
              <p className="text-sm text-slate-500 mb-1">We sent a sign-in link to</p>
              <p className="text-sm font-semibold text-slate-800 mb-4">{email}</p>
              <p className="text-xs text-slate-400">Click the link in that email to continue. You can close this tab.</p>
              <button
                onClick={() => { setStep('enter-email'); setError(null) }}
                className="mt-6 text-sm text-indigo-600 hover:underline"
              >
                Use a different email
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          Looking to apply for a job?{' '}
          <Link href="/candidate/login" className="text-indigo-600 hover:underline">Job Seeker portal →</Link>
        </p>
      </div>
    </div>
  )
}

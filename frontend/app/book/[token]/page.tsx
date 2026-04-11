'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { api } from '@/lib/api'
import type { BookingInfo, InterviewSlot } from '@/types'

function formatDT(iso: string) {
  try {
    return new Date(iso).toLocaleString('en-NZ', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

interface ConfirmedState {
  slot: InterviewSlot
  job: { title: string; organisation: string }
  meet_link: string | null
  calendar_event_url: string | null
}

export default function BookingPage() {
  const params = useParams()
  const token = params.token as string

  const [info, setInfo] = useState<BookingInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<InterviewSlot | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [confirmed, setConfirmed] = useState<ConfirmedState | null>(null)

  useEffect(() => {
    api.getBookingInfo(token)
      .then(setInfo)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }, [token])

  const handleConfirm = async () => {
    if (!selected) return
    setConfirming(true)
    try {
      const res = await api.confirmBooking(token, selected.id)
      setConfirmed({
        slot: res.slot,
        job: res.job,
        meet_link: res.meet_link,
        calendar_event_url: res.calendar_event_url,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setConfirming(false)
    }
  }

  // ── Loading ──
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <svg className="w-8 h-8 text-indigo-600 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    )
  }

  // ── Confirmed ──
  if (confirmed) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-12">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Interview Confirmed!</h1>
            <p className="text-slate-500 mt-2 text-sm">
              Your phone screening for <strong>{confirmed.job.title}</strong> at{' '}
              <strong>{confirmed.job.organisation}</strong> has been booked.
            </p>
          </div>

          {/* Date/time card */}
          <div className="bg-slate-50 rounded-xl p-4 mb-4 border border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-slate-900 text-sm">{formatDT(confirmed.slot.starts_at)}</p>
                <p className="text-xs text-slate-500">{confirmed.slot.duration_mins} minute phone screen</p>
              </div>
            </div>
          </div>

          {/* Google Meet link — shown when Google Calendar is connected */}
          {confirmed.meet_link && (
            <div className="bg-blue-50 rounded-xl p-4 mb-4 border border-blue-200">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center flex-shrink-0 border border-blue-100 shadow-sm">
                  {/* Google Meet icon */}
                  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
                    <path d="M14.5 12c0 1.38-1.12 2.5-2.5 2.5S9.5 13.38 9.5 12s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5z" fill="#00832d"/>
                    <path d="M20 8.5v7l-3-2.5V13l-3.5 3H7a2 2 0 01-2-2V9a2 2 0 012-2h6.5L17 10V8.5l3-2z" fill="#00832d"/>
                    <path d="M17 10v3l3 2.5V8.5L17 10z" fill="#006425"/>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-blue-900">Google Meet link</p>
                  <p className="text-xs text-blue-700 mt-0.5">
                    A calendar invite has been sent to your email with this link.
                  </p>
                  <a
                    href={confirmed.meet_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Join Meeting
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Calendar event link */}
          {confirmed.calendar_event_url && (
            <div className="mb-4">
              <a
                href={confirmed.calendar_event_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-2.5 border border-slate-300 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors"
              >
                <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                View in Google Calendar
              </a>
            </div>
          )}

          <p className="text-xs text-slate-400 text-center">
            {confirmed.meet_link
              ? 'A calendar invite with the meeting link has been sent to your email.'
              : 'A confirmation email has been sent. The recruiter will call you at the scheduled time.'}
          </p>
        </div>
      </div>
    )
  }

  // ── Error / expired ──
  if (error || !info) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Link unavailable</h1>
          <p className="text-slate-500 text-sm">
            {error?.includes('expired')
              ? 'This booking link has expired. Please contact the recruiter for a new link.'
              : error?.includes('already been used')
              ? 'This booking link has already been used. Your interview is already confirmed.'
              : 'This booking link is no longer valid. Please contact the recruiter.'}
          </p>
        </div>
      </div>
    )
  }

  const name = info.candidate_name && info.candidate_name !== 'Unknown'
    ? info.candidate_name.split(' ')[0]
    : null

  // ── Slot selection ──
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-12">
      <div className="max-w-lg mx-auto">

        {/* Header card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">Phone Screen Invitation</h1>
              <p className="text-sm text-slate-500">{info.job.title} — {info.job.organisation}</p>
            </div>
          </div>
          {name && (
            <p className="text-sm text-slate-600 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
              Kia ora <strong>{name}</strong>, please select a time below that works for you.
            </p>
          )}
        </div>

        {/* Slots */}
        {info.slots.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
            <svg className="w-10 h-10 text-slate-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-slate-500 text-sm font-medium">No times available</p>
            <p className="text-slate-400 text-xs mt-1">Please contact the recruiter to arrange a suitable time.</p>
          </div>
        ) : (
          <>
            <p className="text-sm font-medium text-slate-600 px-1 mb-3">Select a time:</p>
            <div className="space-y-3 mb-6">
              {info.slots.map((slot) => (
                <button
                  key={slot.id}
                  onClick={() => setSelected(slot)}
                  className={`w-full text-left px-5 py-4 rounded-xl border-2 transition-all ${
                    selected?.id === slot.id
                      ? 'border-indigo-500 bg-indigo-50 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{formatDT(slot.starts_at)}</p>
                      <p className="text-sm text-slate-500 mt-0.5">{slot.duration_mins} minute phone screen</p>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                      selected?.id === slot.id ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300'
                    }`}>
                      {selected?.id === slot.id && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Confirm */}
        {selected && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-4 h-4 text-indigo-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-sm text-slate-700">
                <span className="text-slate-500">Selected: </span>
                <strong>{formatDT(selected.starts_at)}</strong>
              </p>
            </div>
            <button
              onClick={handleConfirm}
              disabled={confirming}
              className="w-full py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
            >
              {confirming && (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {confirming ? 'Confirming your interview…' : 'Confirm This Time'}
            </button>
            <p className="text-xs text-slate-400 text-center mt-3">
              You will receive a confirmation email. A Google Meet link will be included if available.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

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

export default function BookingPage() {
  const params = useParams()
  const token = params.token as string

  const [info, setInfo] = useState<BookingInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<InterviewSlot | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [confirmed, setConfirmed] = useState<{ slot: InterviewSlot; job: { title: string; organisation: string } } | null>(null)

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
      setConfirmed({ slot: res.slot, job: res.job })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setConfirming(false)
    }
  }

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

  // ── Confirmed state ──
  if (confirmed) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Interview Confirmed!</h1>
          <p className="text-slate-600 mb-6">
            Your phone screening for <strong>{confirmed.job.title}</strong> at <strong>{confirmed.job.organisation}</strong> has been booked.
          </p>
          <div className="bg-slate-50 rounded-xl p-4 text-left mb-6">
            <p className="text-sm text-slate-500 mb-1">Date &amp; Time</p>
            <p className="font-semibold text-slate-900">{formatDT(confirmed.slot.starts_at)}</p>
            <p className="text-sm text-slate-500 mt-2">Duration: {confirmed.slot.duration_mins} minutes</p>
          </div>
          <p className="text-sm text-slate-500">
            A confirmation email has been sent to you. The recruiter will call you at the scheduled time.
          </p>
        </div>
      </div>
    )
  }

  // ── Error / expired state ──
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

  const name = info.candidate_name && info.candidate_name !== 'Unknown' ? info.candidate_name.split(' ')[0] : null

  // ── Slot selection state ──
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-12">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
          <h1 className="text-xl font-bold text-slate-900">Phone Screening Invitation</h1>
          <p className="text-slate-600 mt-1">
            {info.job.title} — {info.job.organisation}
          </p>
          {name && (
            <p className="text-sm text-slate-500 mt-2">Kia ora {name}, please select a time that works for you.</p>
          )}
        </div>

        {/* Slot selection */}
        {info.slots.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
            <p className="text-slate-500">No time slots are currently available. Please contact the recruiter.</p>
          </div>
        ) : (
          <div className="space-y-3 mb-6">
            <p className="text-sm font-medium text-slate-700 px-1">Available times:</p>
            {info.slots.map((slot) => (
              <button
                key={slot.id}
                onClick={() => setSelected(slot)}
                className={`w-full text-left px-5 py-4 rounded-xl border-2 transition-all ${
                  selected?.id === slot.id
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-slate-900">{formatDT(slot.starts_at)}</p>
                    <p className="text-sm text-slate-500 mt-0.5">{slot.duration_mins} minute phone screen</p>
                  </div>
                  {selected?.id === slot.id && (
                    <div className="w-6 h-6 bg-indigo-600 rounded-full flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Confirm button */}
        {selected && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
            <p className="text-sm text-slate-600 mb-4">
              You have selected: <strong>{formatDT(selected.starts_at)}</strong>
            </p>
            <button
              onClick={handleConfirm}
              disabled={confirming}
              className="w-full py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {confirming && (
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {confirming ? 'Confirming…' : 'Confirm This Time'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

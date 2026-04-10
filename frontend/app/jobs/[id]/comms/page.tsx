'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import type { Job, ScreeningResult, Communication, InterviewSlot } from '@/types'

type CommsTab = 'send' | 'slots' | 'history'

function formatDT(iso: string | null | undefined) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('en-NZ', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function StatusPill({ status }: { status: string }) {
  const cfg: Record<string, string> = {
    SENT: 'bg-green-100 text-green-800',
    DELIVERED: 'bg-green-100 text-green-800',
    PENDING: 'bg-yellow-100 text-yellow-800',
    FAILED: 'bg-red-100 text-red-800',
    NO_EMAIL: 'bg-slate-100 text-slate-600',
  }
  const labels: Record<string, string> = {
    SENT: 'Sent', DELIVERED: 'Delivered', PENDING: 'Pending',
    FAILED: 'Failed', NO_EMAIL: 'No email',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg[status] ?? 'bg-slate-100 text-slate-600'}`}>
      {labels[status] ?? status}
    </span>
  )
}

function TypeLabel({ type }: { type: string }) {
  const map: Record<string, { label: string; color: string }> = {
    REJECTION: { label: 'Rejection', color: 'text-red-700' },
    SHORTLIST_INVITE: { label: 'Shortlist Invite', color: 'text-green-700' },
    PHONE_SCREEN_INVITE: { label: 'Phone Screen Invite', color: 'text-blue-700' },
    BOOKING_CONFIRMATION: { label: 'Booking Confirmed', color: 'text-indigo-700' },
    CUSTOM: { label: 'Custom', color: 'text-slate-700' },
  }
  const cfg = map[type] ?? { label: type, color: 'text-slate-700' }
  return <span className={`text-sm font-medium ${cfg.color}`}>{cfg.label}</span>
}

// ---------------------------------------------------------------------------
// Candidate selection row
// ---------------------------------------------------------------------------

interface CandidateRowProps {
  result: ScreeningResult
  selected: boolean
  onToggle: () => void
}

function CandidateRow({ result, selected, onToggle }: CandidateRowProps) {
  const name = result.full_name && result.full_name !== 'Unknown' ? result.full_name : 'Candidate'
  const hasEmail = !!(result as unknown as { email?: string }).email
  return (
    <label className={`flex items-center gap-3 px-4 py-3 cursor-pointer rounded-lg border transition-colors ${selected ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        className="w-4 h-4 text-indigo-600 rounded border-slate-300"
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-900 truncate">{name}</p>
        {result.current_title && result.current_title !== 'Unknown' && (
          <p className="text-xs text-slate-500 truncate">{result.current_title}</p>
        )}
      </div>
      <div className="text-right flex-shrink-0">
        <span className="text-xs font-semibold text-slate-700">{Math.round(result.overall_score)}</span>
        {!hasEmail && (
          <p className="text-xs text-amber-600 mt-0.5">No email</p>
        )}
      </div>
    </label>
  )
}

// ---------------------------------------------------------------------------
// Add Slot form
// ---------------------------------------------------------------------------

interface AddSlotFormProps {
  jobId: string
  onAdded: (slot: InterviewSlot) => void
}

function AddSlotForm({ jobId, onAdded }: AddSlotFormProps) {
  const [date, setDate] = useState('')
  const [time, setTime] = useState('10:00')
  const [duration, setDuration] = useState(30)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const handleAdd = async () => {
    if (!date || !time) { setErr('Please set a date and time.'); return }
    setSaving(true); setErr(null)
    try {
      const starts = new Date(`${date}T${time}:00`)
      const ends = new Date(starts.getTime() + duration * 60000)
      const toISO = (d: Date) => d.toISOString()
      const slot = await api.createSlot(jobId, toISO(starts), toISO(ends), duration)
      onAdded(slot)
      setDate(''); setTime('10:00')
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
      <h4 className="text-sm font-semibold text-slate-700">Add New Slot</h4>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Time (local)</label>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Duration (mins)</label>
          <select
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value={15}>15</option>
            <option value={30}>30</option>
            <option value={45}>45</option>
            <option value={60}>60</option>
          </select>
        </div>
      </div>
      {err && <p className="text-xs text-red-600">{err}</p>}
      <button
        onClick={handleAdd}
        disabled={saving}
        className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50"
      >
        {saving ? 'Adding…' : 'Add Slot'}
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function CommsPage() {
  const params = useParams()
  const id = params.id as string

  const [job, setJob] = useState<Job | null>(null)
  const [candidates, setCandidates] = useState<ScreeningResult[]>([])
  const [comms, setComms] = useState<Communication[]>([])
  const [slots, setSlots] = useState<InterviewSlot[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<CommsTab>('send')

  // Send tab state
  const [selectedDecline, setSelectedDecline] = useState<Set<string>>(new Set())
  const [selectedShortlist, setSelectedShortlist] = useState<Set<string>>(new Set())
  const [selectedPhone, setSelectedPhone] = useState<Set<string>>(new Set())
  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set())
  const [sending, setSending] = useState<string | null>(null)
  const [sendResult, setSendResult] = useState<{ type: string; sent: number; errors: number } | null>(null)

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [jobData, allResults, commsData, slotsData] = await Promise.all([
        api.getJob(id),
        api.getAllResults(id),
        api.listComms(id),
        api.listSlots(id),
      ])
      setJob(jobData)
      setCandidates(allResults)
      setComms(commsData)
      setSlots(slotsData)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { loadAll() }, [loadAll])

  const declined = candidates.filter((c) => c.recommendation === 'DECLINE')
  const shortlisted = candidates.filter((c) => c.recommendation === 'SHORTLIST')
  const secondRound = candidates.filter((c) => c.recommendation === 'SECOND_ROUND')
  const phoneScreenCandidates = [...shortlisted, ...secondRound]
  const availableSlots = slots.filter((s) => !s.is_booked)

  const toggle = (set: Set<string>, id: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setter(next)
  }

  const selectAll = (items: ScreeningResult[], setter: (s: Set<string>) => void) => {
    setter(new Set(items.map((c) => c.candidate_id)))
  }
  const selectNone = (setter: (s: Set<string>) => void) => setter(new Set())

  const handleReject = async () => {
    if (selectedDecline.size === 0) return
    setSending('reject'); setSendResult(null)
    try {
      const res = await api.rejectBatch(id, Array.from(selectedDecline))
      setSendResult({ type: 'rejection', sent: res.sent, errors: res.errors.length })
      setSelectedDecline(new Set())
      await loadAll()
    } catch (e) { console.error(e) }
    finally { setSending(null) }
  }

  const handleShortlistInvite = async () => {
    if (selectedShortlist.size === 0) return
    setSending('shortlist'); setSendResult(null)
    try {
      const res = await api.inviteBatch(id, Array.from(selectedShortlist), 'SHORTLIST_INVITE')
      setSendResult({ type: 'shortlist invite', sent: res.sent, errors: res.errors.length })
      setSelectedShortlist(new Set())
      await loadAll()
    } catch (e) { console.error(e) }
    finally { setSending(null) }
  }

  const handlePhoneInvite = async () => {
    if (selectedPhone.size === 0) return
    setSending('phone'); setSendResult(null)
    try {
      const res = await api.inviteBatch(id, Array.from(selectedPhone), 'PHONE_SCREEN_INVITE', Array.from(selectedSlots))
      setSendResult({ type: 'phone screen invite', sent: res.sent, errors: res.errors.length })
      setSelectedPhone(new Set())
      await loadAll()
    } catch (e) { console.error(e) }
    finally { setSending(null) }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <svg className="w-8 h-8 text-indigo-600 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    )
  }

  const tabs: { key: CommsTab; label: string; count?: number }[] = [
    { key: 'send', label: 'Send Emails' },
    { key: 'slots', label: 'Interview Slots', count: slots.length },
    { key: 'history', label: 'History', count: comms.length },
  ]

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back */}
      <Link
        href={`/jobs/${id}`}
        className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-1 mb-6"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to {job?.title ?? 'Job'}
      </Link>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Communications</h1>
        {job && <p className="text-slate-500 mt-1">{job.title} — {job.organisation}</p>}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-lg w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${activeTab === tab.key ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-600'}`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Send result banner */}
      {sendResult && (
        <div className={`mb-4 rounded-lg border p-4 text-sm ${sendResult.errors > 0 ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-green-200 bg-green-50 text-green-800'}`}>
          ✓ {sendResult.sent} {sendResult.type} email{sendResult.sent !== 1 ? 's' : ''} sent
          {sendResult.errors > 0 && ` · ${sendResult.errors} failed (check candidates have email addresses)`}
        </div>
      )}

      {/* ── Send Emails tab ── */}
      {activeTab === 'send' && (
        <div className="space-y-8">

          {/* Rejection emails */}
          <section className="bg-white border border-slate-200 rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Send Rejection Emails</h2>
                <p className="text-sm text-slate-500 mt-0.5">Inform declined candidates their application was unsuccessful</p>
              </div>
              <button
                onClick={handleReject}
                disabled={selectedDecline.size === 0 || sending === 'reject'}
                className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {sending === 'reject' && (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                Send to {selectedDecline.size > 0 ? `${selectedDecline.size} selected` : 'selected'}
              </button>
            </div>
            {declined.length === 0 ? (
              <p className="text-sm text-slate-400">No declined candidates.</p>
            ) : (
              <>
                <div className="flex gap-3 mb-3">
                  <button onClick={() => selectAll(declined, setSelectedDecline)} className="text-xs text-indigo-600 hover:underline">Select all</button>
                  <button onClick={() => selectNone(setSelectedDecline)} className="text-xs text-slate-500 hover:underline">Clear</button>
                </div>
                <div className="space-y-2">
                  {declined.map((c) => (
                    <CandidateRow
                      key={c.id}
                      result={c}
                      selected={selectedDecline.has(c.candidate_id)}
                      onToggle={() => toggle(selectedDecline, c.candidate_id, setSelectedDecline)}
                    />
                  ))}
                </div>
              </>
            )}
          </section>

          {/* Shortlist invites */}
          <section className="bg-white border border-slate-200 rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Send Shortlist Invitations</h2>
                <p className="text-sm text-slate-500 mt-0.5">Notify shortlisted candidates they have been selected</p>
              </div>
              <button
                onClick={handleShortlistInvite}
                disabled={selectedShortlist.size === 0 || sending === 'shortlist'}
                className="px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {sending === 'shortlist' && (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                Send to {selectedShortlist.size > 0 ? `${selectedShortlist.size} selected` : 'selected'}
              </button>
            </div>
            {shortlisted.length === 0 ? (
              <p className="text-sm text-slate-400">No shortlisted candidates.</p>
            ) : (
              <>
                <div className="flex gap-3 mb-3">
                  <button onClick={() => selectAll(shortlisted, setSelectedShortlist)} className="text-xs text-indigo-600 hover:underline">Select all</button>
                  <button onClick={() => selectNone(setSelectedShortlist)} className="text-xs text-slate-500 hover:underline">Clear</button>
                </div>
                <div className="space-y-2">
                  {shortlisted.map((c) => (
                    <CandidateRow
                      key={c.id}
                      result={c}
                      selected={selectedShortlist.has(c.candidate_id)}
                      onToggle={() => toggle(selectedShortlist, c.candidate_id, setSelectedShortlist)}
                    />
                  ))}
                </div>
              </>
            )}
          </section>

          {/* Phone screen invites */}
          <section className="bg-white border border-slate-200 rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Send Phone Screen Invites</h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  Send candidates a booking link to select their phone screening time.
                  {availableSlots.length === 0 && (
                    <span className="text-amber-600"> Add interview slots first on the Slots tab.</span>
                  )}
                </p>
              </div>
              <button
                onClick={handlePhoneInvite}
                disabled={selectedPhone.size === 0 || sending === 'phone' || availableSlots.length === 0}
                className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {sending === 'phone' && (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                Send Invites
              </button>
            </div>

            {/* Slot selection */}
            {availableSlots.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-medium text-slate-600 mb-2">Include these available slots in the invite:</p>
                <div className="flex flex-wrap gap-2">
                  {availableSlots.map((slot) => (
                    <label
                      key={slot.id}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-md border text-xs cursor-pointer transition-colors ${
                        selectedSlots.has(slot.id)
                          ? 'border-blue-300 bg-blue-50 text-blue-800'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedSlots.has(slot.id)}
                        onChange={() => toggle(selectedSlots, slot.id, setSelectedSlots)}
                        className="w-3 h-3"
                      />
                      {formatDT(slot.starts_at)}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {phoneScreenCandidates.length === 0 ? (
              <p className="text-sm text-slate-400">No shortlisted or second-round candidates.</p>
            ) : (
              <>
                <div className="flex gap-3 mb-3">
                  <button onClick={() => selectAll(phoneScreenCandidates, setSelectedPhone)} className="text-xs text-indigo-600 hover:underline">Select all</button>
                  <button onClick={() => selectNone(setSelectedPhone)} className="text-xs text-slate-500 hover:underline">Clear</button>
                </div>
                <div className="space-y-2">
                  {phoneScreenCandidates.map((c) => (
                    <CandidateRow
                      key={c.id}
                      result={c}
                      selected={selectedPhone.has(c.candidate_id)}
                      onToggle={() => toggle(selectedPhone, c.candidate_id, setSelectedPhone)}
                    />
                  ))}
                </div>
              </>
            )}
          </section>
        </div>
      )}

      {/* ── Slots tab ── */}
      {activeTab === 'slots' && (
        <div className="space-y-4">
          <AddSlotForm
            jobId={id}
            onAdded={(slot) => setSlots((prev) => [...prev, slot].sort((a, b) => a.starts_at.localeCompare(b.starts_at)))}
          />

          {slots.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-lg p-8 text-center">
              <p className="text-slate-500 text-sm">No interview slots added yet. Add availability above.</p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Time</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Duration</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Status</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {slots.map((slot) => (
                    <tr key={slot.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-800">{formatDT(slot.starts_at)}</td>
                      <td className="px-4 py-3 text-slate-600">{slot.duration_mins} min</td>
                      <td className="px-4 py-3">
                        {slot.is_booked ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Booked</span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">Available</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {!slot.is_booked && (
                          <button
                            onClick={async () => {
                              await api.deleteSlot(id, slot.id)
                              setSlots((prev) => prev.filter((s) => s.id !== slot.id))
                            }}
                            className="text-xs text-red-500 hover:text-red-700"
                          >
                            Remove
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── History tab ── */}
      {activeTab === 'history' && (
        <div>
          {comms.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-lg p-8 text-center">
              <p className="text-slate-500 text-sm">No emails sent yet.</p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Candidate</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Type</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Sent At</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {comms.map((comm) => (
                    <tr key={comm.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">{comm.full_name || 'Candidate'}</p>
                        {comm.email && <p className="text-xs text-slate-400">{comm.email}</p>}
                      </td>
                      <td className="px-4 py-3"><TypeLabel type={comm.type} /></td>
                      <td className="px-4 py-3 text-slate-600">{formatDT(comm.sent_at)}</td>
                      <td className="px-4 py-3"><StatusPill status={comm.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

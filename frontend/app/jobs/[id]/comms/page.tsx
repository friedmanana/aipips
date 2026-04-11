'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import type { Job, ScreeningResult, Communication, InterviewSlot } from '@/types'

type CommsTab = 'send' | 'slots' | 'history'
type EmailType = 'REJECTION' | 'SHORTLIST_INVITE' | 'PHONE_SCREEN_INVITE'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDT(iso: string | null | undefined) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('en-NZ', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch { return iso }
}

function StatusPill({ status }: { status: string }) {
  const cfg: Record<string, string> = {
    SENT: 'bg-green-100 text-green-800', DELIVERED: 'bg-green-100 text-green-800',
    PENDING: 'bg-yellow-100 text-yellow-800', FAILED: 'bg-red-100 text-red-800',
    NO_EMAIL: 'bg-slate-100 text-slate-500',
  }
  const labels: Record<string, string> = {
    SENT: 'Sent', DELIVERED: 'Delivered', PENDING: 'Pending', FAILED: 'Failed', NO_EMAIL: 'No email',
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
// Preview modal
// ---------------------------------------------------------------------------

interface PreviewModalProps {
  type: EmailType
  subject: string
  bodyHtml: string
  recipients: ScreeningResult[]   // full result objects so we can show name + email status
  slotCount: number               // how many slots included in phone screen invite
  sending: boolean
  onConfirm: () => void
  onClose: () => void
}

const TYPE_LABELS: Record<EmailType, string> = {
  REJECTION: 'Rejection',
  SHORTLIST_INVITE: 'Shortlist Invitation',
  PHONE_SCREEN_INVITE: 'Phone Screen Invitation',
}

const TYPE_COLORS: Record<EmailType, string> = {
  REJECTION: 'bg-red-600 hover:bg-red-700',
  SHORTLIST_INVITE: 'bg-green-600 hover:bg-green-700',
  PHONE_SCREEN_INVITE: 'bg-blue-600 hover:bg-blue-700',
}

function PreviewModal({ type, subject, bodyHtml, recipients, slotCount, sending, onConfirm, onClose }: PreviewModalProps) {
  const withEmail = recipients.filter((r) => !!(r as unknown as { email?: string }).email)
  const noEmail = recipients.filter((r) => !(r as unknown as { email?: string }).email)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Modal header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-slate-200 flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Review before sending</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              <strong>{TYPE_LABELS[type]}</strong> email — review the content below, then confirm
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">

          {/* Subject */}
          <div className="px-6 py-4 border-b border-slate-100">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Subject</p>
            <p className="text-sm font-medium text-slate-900 bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">{subject}</p>
          </div>

          {/* Email body preview */}
          <div className="px-6 py-4 border-b border-slate-100">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Email Body</p>
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="bg-slate-50 px-3 py-1.5 border-b border-slate-200 flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400" />
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                </div>
                <span className="text-xs text-slate-400 ml-1">Preview — uses "the candidate" as placeholder name</span>
              </div>
              {/* Render HTML directly — links are non-clickable via pointer-events:none */}
              <div
                className="overflow-y-auto bg-white"
                style={{ maxHeight: '360px', pointerEvents: 'none', userSelect: 'text' }}
                dangerouslySetInnerHTML={{
                  __html: bodyHtml
                    // strip outer html/head/body tags so page styles don't leak
                    .replace(/<!DOCTYPE[^>]*>/i, '')
                    .replace(/<html[^>]*>/i, '')
                    .replace(/<\/html>/i, '')
                    .replace(/<head>[\s\S]*?<\/head>/i, '')
                    .replace(/<body[^>]*>/i, '<div style="font-family:Arial,sans-serif;padding:16px;">')
                    .replace(/<\/body>/i, '</div>'),
                }}
              />
            </div>
          </div>

          {/* Recipients */}
          <div className="px-6 py-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Recipients ({recipients.length})
            </p>

            {noEmail.length > 0 && (
              <div className="mb-3 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
                <strong>{noEmail.length}</strong> candidate{noEmail.length !== 1 ? 's' : ''} have no email address —
                the email will be recorded but not sent to them.
              </div>
            )}

            {type === 'PHONE_SCREEN_INVITE' && slotCount === 0 && (
              <div className="mb-3 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
                No interview slots selected — the email will include a booking link but no available times.
                Go to the <strong>Interview Slots</strong> tab to add slots first.
              </div>
            )}

            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {recipients.map((r) => {
                const email = (r as unknown as { email?: string }).email
                const name = r.full_name && r.full_name !== 'Unknown' ? r.full_name : 'Candidate'
                return (
                  <div key={r.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 border border-slate-100">
                    <div>
                      <span className="text-sm font-medium text-slate-800">{name}</span>
                      {email
                        ? <span className="text-xs text-slate-400 ml-2">{email}</span>
                        : <span className="text-xs text-amber-600 ml-2">no email — will not be sent</span>
                      }
                    </div>
                    <span className="text-xs text-slate-400">{Math.round(r.overall_score)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50 flex-shrink-0">
          <p className="text-sm text-slate-500">
            {withEmail.length} email{withEmail.length !== 1 ? 's' : ''} will be sent
            {noEmail.length > 0 && `, ${noEmail.length} skipped (no address)`}
          </p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={sending || recipients.length === 0}
              className={`px-5 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 ${TYPE_COLORS[type]}`}
            >
              {sending && (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {sending ? 'Sending…' : `Confirm & Send to ${recipients.length}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Candidate selection row
// ---------------------------------------------------------------------------

function CandidateRow({
  result, selected, onToggle,
}: { result: ScreeningResult; selected: boolean; onToggle: () => void }) {
  const name = result.full_name && result.full_name !== 'Unknown' ? result.full_name : 'Candidate'
  const email = (result as unknown as { email?: string }).email
  return (
    <label className={`flex items-center gap-3 px-4 py-3 cursor-pointer rounded-lg border transition-colors ${selected ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        className="w-4 h-4 text-indigo-600 rounded border-slate-300 flex-shrink-0"
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-900 truncate">{name}</p>
        {result.current_title && result.current_title !== 'Unknown' && (
          <p className="text-xs text-slate-500 truncate">{result.current_title}</p>
        )}
      </div>
      <div className="text-right flex-shrink-0">
        <span className="text-xs font-bold text-slate-600">{Math.round(result.overall_score)}</span>
        {email
          ? <p className="text-xs text-slate-400 truncate max-w-[120px]">{email}</p>
          : <p className="text-xs text-amber-500">No email</p>
        }
      </div>
    </label>
  )
}

// ---------------------------------------------------------------------------
// Add Slot form
// ---------------------------------------------------------------------------

function AddSlotForm({ jobId, onAdded }: { jobId: string; onAdded: (slot: InterviewSlot) => void }) {
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
      const slot = await api.createSlot(jobId, starts.toISOString(), ends.toISOString(), duration)
      onAdded(slot); setDate(''); setTime('10:00')
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)) }
    finally { setSaving(false) }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
      <h4 className="text-sm font-semibold text-slate-700">Add Available Slot</h4>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Time (local)</label>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)}
            className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Duration</label>
          <select value={duration} onChange={(e) => setDuration(Number(e.target.value))}
            className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value={15}>15 min</option>
            <option value={30}>30 min</option>
            <option value={45}>45 min</option>
            <option value={60}>60 min</option>
          </select>
        </div>
      </div>
      {err && <p className="text-xs text-red-600">{err}</p>}
      <button onClick={handleAdd} disabled={saving}
        className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50">
        {saving ? 'Adding…' : 'Add Slot'}
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Send section
// ---------------------------------------------------------------------------

interface SendSectionProps {
  title: string
  description: string
  candidates: ScreeningResult[]
  selected: Set<string>
  onToggle: (candidateId: string) => void
  onSelectAll: () => void
  onClearAll: () => void
  actionLabel: string
  actionColor: string
  onPreview: () => void
  previewLoading: boolean
  extraContent?: React.ReactNode
  emptyMessage: string
}

function SendSection({
  title, description, candidates, selected, onToggle,
  onSelectAll, onClearAll, actionLabel, actionColor,
  onPreview, previewLoading, extraContent, emptyMessage,
}: SendSectionProps) {
  return (
    <section className="bg-white border border-slate-200 rounded-xl p-5">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <p className="text-sm text-slate-500 mt-0.5">{description}</p>
        </div>
        <button
          onClick={onPreview}
          disabled={selected.size === 0 || previewLoading}
          className={`flex-shrink-0 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${actionColor}`}
        >
          {previewLoading
            ? (<><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Loading…</>)
            : (<><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>{actionLabel} ({selected.size || 0} selected)</>)
          }
        </button>
      </div>

      {extraContent}

      {candidates.length === 0
        ? <p className="text-sm text-slate-400">{emptyMessage}</p>
        : (
          <>
            <div className="flex gap-3 mb-3">
              <button onClick={onSelectAll} className="text-xs text-indigo-600 hover:underline">Select all ({candidates.length})</button>
              <button onClick={onClearAll} className="text-xs text-slate-500 hover:underline">Clear</button>
            </div>
            <div className="space-y-2">
              {candidates.map((c) => (
                <CandidateRow
                  key={c.id}
                  result={c}
                  selected={selected.has(c.candidate_id)}
                  onToggle={() => onToggle(c.candidate_id)}
                />
              ))}
            </div>
          </>
        )
      }
    </section>
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

  // Selection state
  const [selectedDecline, setSelectedDecline] = useState<Set<string>>(new Set())
  const [selectedShortlist, setSelectedShortlist] = useState<Set<string>>(new Set())
  const [selectedPhone, setSelectedPhone] = useState<Set<string>>(new Set())
  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set())

  // Preview modal state
  const [preview, setPreview] = useState<{
    type: EmailType
    subject: string
    bodyHtml: string
    recipients: ScreeningResult[]
  } | null>(null)
  const [previewLoading, setPreviewLoading] = useState<EmailType | null>(null)
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState<{ type: string; sent: number; errors: number } | null>(null)

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [jobData, allResults, commsData, slotsData] = await Promise.all([
        api.getJob(id), api.getAllResults(id), api.listComms(id), api.listSlots(id),
      ])
      setJob(jobData); setCandidates(allResults); setComms(commsData); setSlots(slotsData)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [id])

  useEffect(() => { loadAll() }, [loadAll])

  const declined = candidates.filter((c) => c.recommendation === 'DECLINE')
  const shortlisted = candidates.filter((c) => c.recommendation === 'SHORTLIST')
  const secondRound = candidates.filter((c) => c.recommendation === 'SECOND_ROUND')
  const phoneScreenCandidates = [...shortlisted, ...secondRound]
  const availableSlots = slots.filter((s) => !s.is_booked)

  const toggle = (set: Set<string>, cid: string, setter: React.Dispatch<React.SetStateAction<Set<string>>>) => {
    setter((prev) => {
      const next = new Set(prev)
      if (next.has(cid)) next.delete(cid); else next.add(cid)
      return next
    })
  }

  // Open preview modal — fetches rendered template from backend
  const openPreview = async (type: EmailType, recipients: ScreeningResult[]) => {
    if (recipients.length === 0) return
    setPreviewLoading(type)
    try {
      const slotIds = type === 'PHONE_SCREEN_INVITE' ? Array.from(selectedSlots) : []
      const data = await api.previewEmail(id, type, slotIds)
      setPreview({ type, subject: data.subject, bodyHtml: data.body_html, recipients })
    } catch (e) { console.error(e) }
    finally { setPreviewLoading(null) }
  }

  // Confirmed send from modal
  const handleConfirmSend = async () => {
    if (!preview) return
    setSending(true)
    try {
      const candidateIds = preview.recipients.map((r) => r.candidate_id)
      let res: { sent: number; errors: unknown[] }
      if (preview.type === 'REJECTION') {
        res = await api.rejectBatch(id, candidateIds)
      } else if (preview.type === 'PHONE_SCREEN_INVITE') {
        res = await api.inviteBatch(id, candidateIds, 'PHONE_SCREEN_INVITE', Array.from(selectedSlots))
      } else {
        res = await api.inviteBatch(id, candidateIds, 'SHORTLIST_INVITE')
      }
      setSendResult({ type: TYPE_LABELS[preview.type], sent: res.sent, errors: res.errors.length })
      setPreview(null)
      // Clear selections
      if (preview.type === 'REJECTION') setSelectedDecline(new Set())
      else if (preview.type === 'SHORTLIST_INVITE') setSelectedShortlist(new Set())
      else setSelectedPhone(new Set())
      await loadAll()
    } catch (e) { console.error(e) }
    finally { setSending(false) }
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
    <>
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back */}
      <Link href={`/jobs/${id}`} className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-1 mb-6">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to {job?.title ?? 'Job'}
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Communications</h1>
        {job && <p className="text-slate-500 mt-1">{job.title} — {job.organisation}</p>}
      </div>

      {/* Info banner */}
      <div className="mb-6 rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 flex items-start gap-3">
        <svg className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-sm text-blue-800">
          All emails use fixed templates — no AI generation. Select recipients, then click <strong>Preview & Review</strong> to see the exact email content before it is sent.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-lg w-fit">
        {tabs.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === tab.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
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
        <div className={`mb-5 rounded-xl border px-4 py-3 text-sm flex items-center justify-between ${sendResult.errors > 0 ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-green-200 bg-green-50 text-green-800'}`}>
          <span>✓ <strong>{sendResult.sent}</strong> {sendResult.type} email{sendResult.sent !== 1 ? 's' : ''} sent{sendResult.errors > 0 ? ` · ${sendResult.errors} skipped (no email address)` : ''}</span>
          <button onClick={() => setSendResult(null)} className="ml-4 text-current opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* ── Send Emails tab ── */}
      {activeTab === 'send' && (
        <div className="space-y-6">
          {/* Rejection */}
          <SendSection
            title="Rejection Emails"
            description="Inform declined candidates their application was unsuccessful."
            candidates={declined}
            selected={selectedDecline}
            onToggle={(cid) => toggle(selectedDecline, cid, setSelectedDecline)}
            onSelectAll={() => setSelectedDecline(new Set(declined.map((c) => c.candidate_id)))}
            onClearAll={() => setSelectedDecline(new Set())}
            actionLabel="Preview & Review"
            actionColor="bg-red-600 hover:bg-red-700"
            onPreview={() => openPreview('REJECTION', declined.filter((c) => selectedDecline.has(c.candidate_id)))}
            previewLoading={previewLoading === 'REJECTION'}
            emptyMessage="No declined candidates."
          />

          {/* Shortlist */}
          <SendSection
            title="Shortlist Invitation Emails"
            description="Notify shortlisted candidates they have progressed to the next stage."
            candidates={shortlisted}
            selected={selectedShortlist}
            onToggle={(cid) => toggle(selectedShortlist, cid, setSelectedShortlist)}
            onSelectAll={() => setSelectedShortlist(new Set(shortlisted.map((c) => c.candidate_id)))}
            onClearAll={() => setSelectedShortlist(new Set())}
            actionLabel="Preview & Review"
            actionColor="bg-green-600 hover:bg-green-700"
            onPreview={() => openPreview('SHORTLIST_INVITE', shortlisted.filter((c) => selectedShortlist.has(c.candidate_id)))}
            previewLoading={previewLoading === 'SHORTLIST_INVITE'}
            emptyMessage="No shortlisted candidates."
          />

          {/* Phone screen */}
          <SendSection
            title="Phone Screen Invitation Emails"
            description="Send shortlisted/second-round candidates a booking link to select their interview time."
            candidates={phoneScreenCandidates}
            selected={selectedPhone}
            onToggle={(cid) => toggle(selectedPhone, cid, setSelectedPhone)}
            onSelectAll={() => setSelectedPhone(new Set(phoneScreenCandidates.map((c) => c.candidate_id)))}
            onClearAll={() => setSelectedPhone(new Set())}
            actionLabel="Preview & Review"
            actionColor="bg-blue-600 hover:bg-blue-700"
            onPreview={() => openPreview('PHONE_SCREEN_INVITE', phoneScreenCandidates.filter((c) => selectedPhone.has(c.candidate_id)))}
            previewLoading={previewLoading === 'PHONE_SCREEN_INVITE'}
            emptyMessage="No shortlisted or second-round candidates."
            extraContent={availableSlots.length > 0 ? (
              <div className="mb-4">
                <p className="text-xs font-medium text-slate-600 mb-2">
                  Include these slots in the booking invite:
                  {selectedSlots.size === 0 && <span className="text-slate-400"> (all available slots will be included if none selected)</span>}
                </p>
                <div className="flex flex-wrap gap-2">
                  {availableSlots.map((slot) => (
                    <label key={slot.id}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs cursor-pointer transition-colors ${selectedSlots.has(slot.id) ? 'border-blue-300 bg-blue-50 text-blue-800' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
                      <input type="checkbox" checked={selectedSlots.has(slot.id)}
                        onChange={() => toggle(selectedSlots, slot.id, setSelectedSlots)} className="w-3 h-3" />
                      {formatDT(slot.starts_at)}
                    </label>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
                No interview slots available. Add slots on the <button onClick={() => setActiveTab('slots')} className="underline font-medium">Interview Slots tab</button> first.
              </div>
            )}
          />
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
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
              <p className="text-slate-500 text-sm">No slots added yet. Use the form above to add your availability.</p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
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
                        {slot.is_booked
                          ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Booked</span>
                          : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">Available</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-right">
                        {!slot.is_booked && (
                          <button onClick={async () => { await api.deleteSlot(id, slot.id); setSlots((prev) => prev.filter((s) => s.id !== slot.id)) }}
                            className="text-xs text-red-500 hover:text-red-700 font-medium">Remove</button>
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
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
              <p className="text-slate-500 text-sm">No emails sent yet.</p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Candidate</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Type</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Sent</th>
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
                      <td className="px-4 py-3 text-slate-500">{formatDT(comm.sent_at)}</td>
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

    {/* Preview / confirm modal */}
    {preview && (
      <PreviewModal
        type={preview.type}
        subject={preview.subject}
        bodyHtml={preview.bodyHtml}
        recipients={preview.recipients}
        slotCount={selectedSlots.size || availableSlots.length}
        sending={sending}
        onConfirm={handleConfirmSend}
        onClose={() => setPreview(null)}
      />
    )}
    </>
  )
}

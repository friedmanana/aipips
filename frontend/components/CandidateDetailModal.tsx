'use client'

import { useEffect } from 'react'
import type { ScreeningResult, Recommendation } from '@/types'
import ScoreBadge from './ScoreBadge'

interface Props {
  result: ScreeningResult
  onClose: () => void
  onMove: (id: string, recommendation: Recommendation) => void
  onDelete: (id: string) => void
}

const recConfig: Record<Recommendation, { label: string; color: string }> = {
  SHORTLIST: { label: 'Shortlisted', color: 'bg-green-100 text-green-800' },
  SECOND_ROUND: { label: 'Second Round', color: 'bg-blue-100 text-blue-800' },
  HOLD: { label: 'Hold', color: 'bg-yellow-100 text-yellow-800' },
  DECLINE: { label: 'Decline', color: 'bg-red-100 text-red-800' },
}

function ScoreBar({ label, score }: { label: string; score: number }) {
  const color =
    score >= 75 ? 'bg-green-500' : score >= 60 ? 'bg-yellow-400' : score >= 45 ? 'bg-orange-400' : 'bg-red-400'
  const textColor =
    score >= 75 ? 'text-green-700' : score >= 60 ? 'text-yellow-700' : score >= 45 ? 'text-orange-600' : 'text-red-600'
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-xs text-slate-600 font-medium">{label}</span>
        <span className={`text-xs font-bold ${textColor}`}>{Math.round(score)}</span>
      </div>
      <div className="w-full bg-slate-100 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all ${color}`}
          style={{ width: `${Math.min(score, 100)}%` }}
        />
      </div>
    </div>
  )
}

const TIER_ORDER: Recommendation[] = ['SHORTLIST', 'SECOND_ROUND', 'HOLD', 'DECLINE']
const TIER_LABELS: Record<Recommendation, string> = {
  SHORTLIST: 'Shortlist',
  SECOND_ROUND: 'Second Round',
  HOLD: 'Hold',
  DECLINE: 'Decline',
}

export default function CandidateDetailModal({ result, onClose, onMove, onDelete }: Props) {
  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const rec = recConfig[result.recommendation] ?? { label: result.recommendation, color: 'bg-slate-100 text-slate-800' }
  const otherTiers = TIER_ORDER.filter((t) => t !== result.recommendation)

  const subtitleParts = [result.current_title, result.current_organisation].filter(
    (v) => v && v !== 'Unknown'
  )

  return (
    <div
      className="fixed inset-0 z-50 flex"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Panel — slides in from right */}
      <div className="relative ml-auto h-full w-full max-w-2xl bg-white shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-slate-200 bg-slate-50">
          <div className="flex items-start gap-4">
            <ScoreBadge score={result.overall_score} size="lg" />
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                {result.full_name && result.full_name !== 'Unknown' ? result.full_name : 'Candidate'}
              </h2>
              {subtitleParts.length > 0 && (
                <p className="text-sm text-slate-600 mt-0.5">{subtitleParts.join(' · ')}</p>
              )}
              {result.location && result.location !== 'New Zealand' && (
                <p className="text-xs text-slate-500 mt-0.5">{result.location}</p>
              )}
              <span className={`mt-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${rec.color}`}>
                {rec.label}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* Manual actions */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-500 mr-1">Move to:</span>
            {otherTiers.map((tier) => (
              <button
                key={tier}
                onClick={() => onMove(result.id, tier)}
                className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors
                  ${tier === 'SHORTLIST' ? 'border-green-300 text-green-700 hover:bg-green-50' :
                    tier === 'SECOND_ROUND' ? 'border-blue-300 text-blue-700 hover:bg-blue-50' :
                    tier === 'HOLD' ? 'border-yellow-300 text-yellow-700 hover:bg-yellow-50' :
                    'border-red-300 text-red-700 hover:bg-red-50'}`}
              >
                {TIER_LABELS[tier]}
              </button>
            ))}
            <button
              onClick={() => { onDelete(result.id); onClose() }}
              className="ml-auto px-3 py-1 text-xs font-medium rounded-full border border-red-200 text-red-600 hover:bg-red-50 transition-colors flex items-center gap-1"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Remove
            </button>
          </div>

          {/* Score breakdown */}
          <div className="bg-slate-50 rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Score Breakdown</h3>
            <ScoreBar label="Skills Match" score={result.skill_match_score ?? 0} />
            <ScoreBar label="Experience" score={result.experience_score ?? 0} />
            <ScoreBar label="NZ Public Sector Fit" score={result.nz_fit_score ?? 0} />
            {result.qualification_score != null && result.qualification_score > 0 && (
              <ScoreBar label="Qualifications" score={result.qualification_score} />
            )}
          </div>

          {/* Recommendation reason */}
          {result.recommendation_reason && (
            <div>
              <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-2">Assessment</h3>
              <p className="text-sm text-slate-700 leading-relaxed bg-white border border-slate-200 rounded-lg p-4">
                {result.recommendation_reason}
              </p>
            </div>
          )}

          {/* Candidate profile */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">Profile</h3>
            <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
              {result.years_experience != null && result.years_experience > 0 && (
                <div className="flex px-4 py-3 gap-4">
                  <span className="text-xs text-slate-500 w-32 flex-shrink-0 pt-0.5">Experience</span>
                  <span className="text-sm text-slate-800">{result.years_experience} years</span>
                </div>
              )}
              {result.current_title && result.current_title !== 'Unknown' && (
                <div className="flex px-4 py-3 gap-4">
                  <span className="text-xs text-slate-500 w-32 flex-shrink-0 pt-0.5">Current Title</span>
                  <span className="text-sm text-slate-800">{result.current_title}</span>
                </div>
              )}
              {result.current_organisation && result.current_organisation !== 'Unknown' && (
                <div className="flex px-4 py-3 gap-4">
                  <span className="text-xs text-slate-500 w-32 flex-shrink-0 pt-0.5">Organisation</span>
                  <span className="text-sm text-slate-800">{result.current_organisation}</span>
                </div>
              )}
              {result.location && (
                <div className="flex px-4 py-3 gap-4">
                  <span className="text-xs text-slate-500 w-32 flex-shrink-0 pt-0.5">Location</span>
                  <span className="text-sm text-slate-800">{result.location}</span>
                </div>
              )}
              {result.linkedin_url && (
                <div className="flex px-4 py-3 gap-4">
                  <span className="text-xs text-slate-500 w-32 flex-shrink-0 pt-0.5">LinkedIn</span>
                  <a
                    href={result.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-indigo-600 hover:underline truncate"
                  >
                    View profile →
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Skills */}
          {result.skills && result.skills.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-2">Skills</h3>
              <div className="flex flex-wrap gap-1.5">
                {result.skills.map((skill, i) => (
                  <span key={i} className="px-2.5 py-1 rounded-md text-xs bg-indigo-50 text-indigo-700 font-medium">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Strengths */}
          {result.strengths && result.strengths.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-2">Strengths</h3>
              <ul className="space-y-1.5">
                {result.strengths.map((s, i) => (
                  <li key={i} className="flex gap-2 text-sm text-slate-700">
                    <span className="text-green-500 mt-0.5 flex-shrink-0">✓</span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Concerns */}
          {result.concerns && result.concerns.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-2">Concerns</h3>
              <ul className="space-y-1.5">
                {result.concerns.map((c, i) => (
                  <li key={i} className="flex gap-2 text-sm text-slate-700">
                    <span className="text-red-400 mt-0.5 flex-shrink-0">!</span>
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Interview flags */}
          {result.interview_flags && result.interview_flags.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-2">Interview Flags</h3>
              <ul className="space-y-1.5">
                {result.interview_flags.map((f, i) => (
                  <li key={i} className="flex gap-2 text-sm text-slate-700">
                    <span className="text-amber-500 mt-0.5 flex-shrink-0">→</span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Summary / CV extract */}
          {result.summary && (
            <div>
              <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-2">CV Extract</h3>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap font-mono text-xs">
                {result.summary}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}


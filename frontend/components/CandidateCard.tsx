import type { ScreeningResult, Recommendation } from '@/types'
import ScoreBadge from './ScoreBadge'

interface CandidateCardProps {
  result: ScreeningResult
  onClick: (result: ScreeningResult) => void
  onMove: (id: string, recommendation: Recommendation) => void
  onDelete: (id: string) => void
}

const recommendationConfig: Record<
  Recommendation,
  { label: string; className: string }
> = {
  SHORTLIST: { label: 'Shortlist', className: 'bg-green-100 text-green-800' },
  SECOND_ROUND: { label: 'Second Round', className: 'bg-blue-100 text-blue-800' },
  HOLD: { label: 'Hold', className: 'bg-yellow-100 text-yellow-800' },
  DECLINE: { label: 'Decline', className: 'bg-red-100 text-red-800' },
}

const MOVE_ACTIONS: { tier: Recommendation; label: string; color: string }[] = [
  { tier: 'SHORTLIST', label: 'Shortlist', color: 'text-green-700 hover:bg-green-50 border-green-200' },
  { tier: 'SECOND_ROUND', label: 'Second Round', color: 'text-blue-700 hover:bg-blue-50 border-blue-200' },
  { tier: 'HOLD', label: 'Hold', color: 'text-yellow-700 hover:bg-yellow-50 border-yellow-200' },
]

function SubScore({ label, score }: { label: string; score: number }) {
  const color =
    score >= 75 ? 'text-green-700' : score >= 55 ? 'text-yellow-700' : score >= 35 ? 'text-orange-600' : 'text-red-600'
  return (
    <span className="flex flex-col items-center gap-0.5">
      <span className={`text-sm font-semibold ${color}`}>{Math.round(score)}</span>
      <span className="text-xs text-slate-400 whitespace-nowrap">{label}</span>
    </span>
  )
}

export default function CandidateCard({ result, onClick, onMove, onDelete }: CandidateCardProps) {
  const rec = recommendationConfig[result.recommendation] ?? {
    label: result.recommendation,
    className: 'bg-slate-100 text-slate-800',
  }

  const displayStrengths = (result.strengths ?? []).slice(0, 2)
  const displayConcerns = (result.concerns ?? []).slice(0, 1)

  const subtitleParts = [result.current_title, result.current_organisation].filter(
    (v) => v && v !== 'Unknown'
  )

  const moveActions = MOVE_ACTIONS.filter((a) => a.tier !== result.recommendation)

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
      {/* Clickable card body */}
      <div
        className="p-5 cursor-pointer"
        onClick={() => onClick(result)}
      >
        {/* Header row */}
        <div className="flex items-start gap-4">
          <ScoreBadge score={result.overall_score} size="md" />

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold text-slate-900 text-base leading-tight">
                  {result.full_name && result.full_name !== 'Unknown' ? result.full_name : 'Candidate'}
                </h3>
                {subtitleParts.length > 0 && (
                  <p className="text-sm text-slate-600 mt-0.5">{subtitleParts.join(' · ')}</p>
                )}
                {result.location && result.location !== 'New Zealand' && (
                  <p className="text-xs text-slate-500 mt-0.5">{result.location}</p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${rec.className}`}>
                  {rec.label}
                </span>
                <span className="text-xs text-slate-400">Click to expand →</span>
              </div>
            </div>
          </div>
        </div>

        {/* Sub-scores */}
        <div className="mt-3 flex gap-4 border-t border-slate-100 pt-3">
          <SubScore label="Skills" score={result.skill_match_score ?? 0} />
          <SubScore label="Experience" score={result.experience_score ?? 0} />
          <SubScore label="NZ Fit" score={result.nz_fit_score ?? 0} />
        </div>

        {/* Reason */}
        {result.recommendation_reason && (
          <p className="mt-3 text-sm text-slate-600 leading-relaxed line-clamp-2">
            {result.recommendation_reason}
          </p>
        )}

        {/* Strengths + Concerns preview */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {displayStrengths.map((s, i) => (
            <span key={i} className="px-2 py-0.5 rounded text-xs bg-indigo-50 text-indigo-700">{s}</span>
          ))}
          {displayConcerns.map((c, i) => (
            <span key={i} className="px-2 py-0.5 rounded text-xs bg-red-50 text-red-700">{c}</span>
          ))}
        </div>
      </div>

      {/* Action bar — separate from clickable area */}
      <div
        className="flex items-center gap-2 px-5 py-2.5 border-t border-slate-100 bg-slate-50 rounded-b-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-xs text-slate-400 mr-1">Move to:</span>
        {moveActions.map((action) => (
          <button
            key={action.tier}
            onClick={() => onMove(result.id, action.tier)}
            className={`px-2.5 py-1 text-xs font-medium rounded-full border transition-colors ${action.color}`}
          >
            {action.label}
          </button>
        ))}
        <button
          onClick={() => onDelete(result.id)}
          className="ml-auto p-1.5 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
          title="Remove candidate"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  )
}


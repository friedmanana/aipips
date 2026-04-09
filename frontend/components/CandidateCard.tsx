import type { ScreeningResult, Recommendation } from '@/types'
import ScoreBadge from './ScoreBadge'

interface CandidateCardProps {
  result: ScreeningResult
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

export default function CandidateCard({ result }: CandidateCardProps) {
  const rec = recommendationConfig[result.recommendation] ?? {
    label: result.recommendation,
    className: 'bg-slate-100 text-slate-800',
  }

  const displayStrengths = (result.strengths ?? []).slice(0, 3)

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
      {/* Header row */}
      <div className="flex items-start gap-4">
        <ScoreBadge score={result.overall_score} size="md" />

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold text-slate-900 text-base leading-tight">
                {result.full_name ?? 'Unknown Candidate'}
              </h3>
              <p className="text-sm text-slate-600 mt-0.5">
                {[result.current_title, result.current_organisation]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              {result.location && (
                <p className="text-xs text-slate-500 mt-0.5">{result.location}</p>
              )}
            </div>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${rec.className}`}
            >
              {rec.label}
            </span>
          </div>
        </div>
      </div>

      {/* Reason */}
      {result.recommendation_reason && (
        <p className="mt-3 text-sm text-slate-600 leading-relaxed">
          {result.recommendation_reason}
        </p>
      )}

      {/* Strengths */}
      {displayStrengths.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {displayStrengths.map((strength, i) => (
            <span
              key={i}
              className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-indigo-50 text-indigo-700"
            >
              {strength}
            </span>
          ))}
        </div>
      )}

      {/* LinkedIn */}
      {result.linkedin_url && (
        <div className="mt-3">
          <a
            href={result.linkedin_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-indigo-600 hover:text-indigo-800 hover:underline"
          >
            View LinkedIn profile →
          </a>
        </div>
      )}
    </div>
  )
}

type PipelineStep = 'analysing' | 'sourcing' | 'screening' | 'done' | 'error'

interface PipelineProgressProps {
  step: PipelineStep
  message?: string
}

const steps: { key: PipelineStep; label: string; description: string }[] = [
  { key: 'analysing', label: 'Analyse JD', description: 'Extracting job requirements' },
  { key: 'sourcing', label: 'Source Candidates', description: 'Finding matching candidates' },
  { key: 'screening', label: 'Screen & Score', description: 'Evaluating candidates' },
  { key: 'done', label: 'Results Ready', description: 'Pipeline complete' },
]

const stepOrder: Record<string, number> = {
  analysing: 0,
  sourcing: 1,
  screening: 2,
  done: 3,
  error: -1,
}

export default function PipelineProgress({ step, message }: PipelineProgressProps) {
  const currentIndex = stepOrder[step] ?? 0

  if (step === 'error') {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3">
          <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <p className="font-medium text-red-800">Pipeline failed</p>
        {message && <p className="text-sm text-red-600 mt-1">{message}</p>}
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <div className="mb-6 text-center">
        <p className="text-sm font-medium text-slate-600">Running pipeline…</p>
        {message && <p className="text-xs text-slate-500 mt-1">{message}</p>}
      </div>

      <div className="relative">
        {/* Connector line */}
        <div className="absolute top-5 left-5 right-5 h-0.5 bg-slate-200" aria-hidden="true" />

        <ol className="relative flex justify-between">
          {steps.map((s, idx) => {
            const isCompleted = idx < currentIndex
            const isCurrent = idx === currentIndex
            const isPending = idx > currentIndex

            return (
              <li key={s.key} className="flex flex-col items-center gap-2 flex-1">
                <div
                  className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                    isCompleted
                      ? 'bg-indigo-600 border-indigo-600'
                      : isCurrent
                      ? 'bg-white border-indigo-600'
                      : 'bg-white border-slate-300'
                  }`}
                >
                  {isCompleted ? (
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : isCurrent ? (
                    <svg
                      className="w-5 h-5 text-indigo-600 animate-spin"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                  ) : (
                    <span
                      className={`text-xs font-semibold ${
                        isPending ? 'text-slate-400' : 'text-slate-600'
                      }`}
                    >
                      {idx + 1}
                    </span>
                  )}
                </div>

                <div className="text-center">
                  <p
                    className={`text-xs font-medium ${
                      isCompleted || isCurrent ? 'text-slate-900' : 'text-slate-400'
                    }`}
                  >
                    {s.label}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5 hidden sm:block">
                    {s.description}
                  </p>
                </div>
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}

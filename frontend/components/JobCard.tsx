import Link from 'next/link'
import type { Job, JobStatus } from '@/types'

interface JobCardProps {
  job: Job
}

const statusConfig: Record<JobStatus, { label: string; className: string }> = {
  OPEN: { label: 'Open', className: 'bg-green-100 text-green-800' },
  DRAFT: { label: 'Draft', className: 'bg-slate-100 text-slate-600' },
  CLOSED: { label: 'Closed', className: 'bg-red-100 text-red-800' },
  FILLED: { label: 'Filled', className: 'bg-blue-100 text-blue-800' },
}

function formatDate(dateStr: string) {
  if (!dateStr) return null
  try {
    return new Date(dateStr).toLocaleDateString('en-NZ', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

export default function JobCard({ job }: JobCardProps) {
  const status = statusConfig[job.status] ?? {
    label: job.status,
    className: 'bg-slate-100 text-slate-600',
  }

  return (
    <Link href={`/jobs/${job.id}`} className="block group">
      <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-slate-900 text-base leading-tight group-hover:text-indigo-700 transition-colors truncate">
              {job.title}
            </h3>
            <p className="text-sm text-slate-600 mt-0.5 truncate">
              {[job.organisation, job.department].filter(Boolean).join(' · ')}
            </p>
          </div>
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${status.className}`}
          >
            {status.label}
          </span>
        </div>

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
          {job.location && (
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {job.location}
            </span>
          )}
          {job.employment_type && (
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              {job.employment_type}
            </span>
          )}
          {job.salary_band && (
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {job.salary_band}
            </span>
          )}
          {job.closing_date && (
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Closes {formatDate(job.closing_date)}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}

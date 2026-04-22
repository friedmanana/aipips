'use client'

import { useEffect, useState, useCallback, useRef, Suspense } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { candidateApi } from '@/lib/candidateApi'
import { CvPip, LetterPip, InterviewPip } from '@/components/PipIcons'
import type { JobApplication, CvDocument, CoverLetter, QAItem } from '@/types'

type Phase = 1 | 2 | 3

const INTERVIEW_FORMATS = [
  'Panel interview',
  'One-on-one',
  'Video call',
  'Phone screen',
  'Assessment centre',
]

const CATEGORY_COLORS: Record<string, string> = {
  Behavioural: 'bg-blue-100 text-blue-700',
  Technical: 'bg-purple-100 text-purple-700',
  Situational: 'bg-amber-100 text-amber-700',
  Motivation: 'bg-green-100 text-green-700',
  Values: 'bg-rose-100 text-rose-700',
  General: 'bg-slate-100 text-slate-600',
}

function Spinner() {
  return (
    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

function ParamPicker({ label, options, value, onChange }: {
  label: string
  options: { value: string; label: string }[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-semibold text-slate-500 w-16 shrink-0">{label}</span>
      <div className="flex gap-1.5">
        {options.map(opt => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
              value === opt.value
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function ApplicationWorkspace() {
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const [app, setApp] = useState<JobApplication | null>(null)
  const [originalCv, setOriginalCv] = useState<CvDocument | null>(null)
  const [enhancedCv, setEnhancedCv] = useState<CvDocument | null>(null)
  const [coverLetter, setCoverLetter] = useState<CoverLetter | null>(null)
  const [loading, setLoading] = useState(true)
  const initialPhase = Math.min(3, Math.max(1, parseInt(searchParams.get('phase') ?? '1'))) as Phase
  const [phase, setPhase] = useState<Phase>(initialPhase)
  const [clMode, setClMode] = useState<'scratch' | 'enhance'>('scratch')
  const [clEditText, setClEditText] = useState('')
  const [ownLetterInput, setOwnLetterInput] = useState('')
  const [enhancingCl, setEnhancingCl] = useState(false)
  const [savingCl, setSavingCl] = useState(false)

  const [cvMode, setCvMode] = useState<'scratch' | 'enhance'>('enhance')
  const [backgroundInput, setBackgroundInput] = useState('')
  const [generatingCvFromScratch, setGeneratingCvFromScratch] = useState(false)
  const [cvPages, setCvPages] = useState('2')
  const [cvStyle, setCvStyle] = useState('professional')
  const [clLength, setClLength] = useState('standard')
  const [clTone, setClTone] = useState('professional')

  const [cvInput, setCvInput] = useState('')
  const [jdInput, setJdInput] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [company, setCompany] = useState('')

  const [interviewFormat, setInterviewFormat] = useState('')
  const [interviewerRoles, setInterviewerRoles] = useState('')
  const [focusAreas, setFocusAreas] = useState('')
  const [catCounts, setCatCounts] = useState<Record<string, number>>({
    Behavioural: 3, Technical: 2, Situational: 2, Motivation: 2, Values: 1,
  })
  const [qaItems, setQaItems] = useState<QAItem[]>([])
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)
  const [showStarredOnly, setShowStarredOnly] = useState(false)
  const [viewCats, setViewCats] = useState<string[]>([])
  const [prepLoaded, setPrepLoaded] = useState(false)

  const [savingCv, setSavingCv] = useState(false)
  const [parsingPdf, setParsingPdf] = useState(false)
  const pdfInputRef = useRef<HTMLInputElement>(null)
  const clPdfInputRef = useRef<HTMLInputElement>(null)
  const [parsingClPdf, setParsingClPdf] = useState(false)
  const [enhancing, setEnhancing] = useState(false)
  const [generatingCl, setGeneratingCl] = useState(false)
  const [savingJob, setSavingJob] = useState(false)
  const [savingPrep, setSavingPrep] = useState(false)
  const [generatingQA, setGeneratingQA] = useState(false)

  const [copied, setCopied] = useState<'cv' | 'cl' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const loadApp = useCallback(async () => {
    try {
      const data = await candidateApi.getApplication(id)
      setApp(data)
      setOriginalCv(data.original_cv)
      setEnhancedCv(data.enhanced_cv)
      setCoverLetter(data.cover_letter)
      if (data.cover_letter) setClEditText(data.cover_letter.content_text)
      setJobTitle(data.job_title)
      setCompany(data.company ?? '')
      setJdInput(data.job_description_text ?? '')
      if (data.original_cv) setCvInput(data.original_cv.content_text)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [id])

  useEffect(() => { loadApp() }, [loadApp])

  useEffect(() => {
    if (phase === 3 && !prepLoaded) {
      candidateApi.getInterviewPrep(id).then(prep => {
        if (prep) {
          setInterviewFormat(prep.interview_format ?? '')
          setInterviewerRoles(prep.interviewer_roles ?? '')
          setFocusAreas(prep.focus_areas ?? '')
          if (prep.generated_qa) setQaItems(prep.generated_qa)
        }
        setPrepLoaded(true)
      }).catch(console.error)
    }
  }, [phase, prepLoaded, id])

  const flash = (msg: string) => {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(null), 3000)
  }

  const handleSaveCv = async () => {
    if (!cvInput.trim()) return
    setSavingCv(true); setError(null)
    try {
      const saved = await candidateApi.uploadCv(id, cvInput)
      setOriginalCv(saved); flash('CV saved')
    } catch (e) { setError(String(e)) }
    finally { setSavingCv(false) }
  }

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setParsingPdf(true); setError(null)
    try {
      const { text } = await candidateApi.parseCvPdf(id, file)
      setCvInput(text)
      flash('CV extracted from PDF — review and save')
    } catch (err) { setError(String(err)) }
    finally {
      setParsingPdf(false)
      if (pdfInputRef.current) pdfInputRef.current.value = ''
    }
  }

  const handleClPdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setParsingClPdf(true); setError(null)
    try {
      const { text } = await candidateApi.parseCvPdf(id, file)
      setOwnLetterInput(text)
      flash('Cover letter extracted from PDF — review and enhance')
    } catch (err) { setError(String(err)) }
    finally {
      setParsingClPdf(false)
      if (clPdfInputRef.current) clPdfInputRef.current.value = ''
    }
  }

  const handleGenerateCvFromScratch = async () => {
    if (!backgroundInput.trim()) return
    if (jdInput !== app?.job_description_text) await handleSaveJob()
    setGeneratingCvFromScratch(true); setError(null)
    try {
      const generated = await candidateApi.generateCv(id, backgroundInput, cvPages, cvStyle)
      setOriginalCv(generated)
      setCvInput(generated.content_text)
      // Auto-enhance immediately after generating
      setEnhancing(true)
      try {
        const enhanced = await candidateApi.enhanceCv(id, cvPages, cvStyle)
        setEnhancedCv(enhanced)
      } finally { setEnhancing(false) }
      flash('CV generated and enhanced')
    } catch (e) { setError(String(e)) }
    finally { setGeneratingCvFromScratch(false) }
  }

  const handleSaveJob = async () => {
    setSavingJob(true); setError(null)
    try {
      const updated = await candidateApi.updateApplication(id, { job_title: jobTitle, company, job_description_text: jdInput })
      setApp(updated); flash('Saved')
    } catch (e) { setError(String(e)) }
    finally { setSavingJob(false) }
  }

  const handleEnhanceCv = async () => {
    if (cvInput.trim() && cvInput !== originalCv?.content_text) await handleSaveCv()
    if (jdInput !== app?.job_description_text) await handleSaveJob()
    setEnhancing(true); setError(null)
    try {
      const enhanced = await candidateApi.enhanceCv(id, cvPages, cvStyle)
      setEnhancedCv(enhanced)
    } catch (e) { setError(String(e)) }
    finally { setEnhancing(false) }
  }

  const handleGenerateCl = async () => {
    setGeneratingCl(true); setError(null)
    try {
      const cl = await candidateApi.generateCoverLetter(id, clLength, clTone)
      setCoverLetter(cl); setClEditText(cl.content_text)
    } catch (e) { setError(String(e)) }
    finally { setGeneratingCl(false) }
  }

  const handleEnhanceCl = async () => {
    if (!ownLetterInput.trim()) return
    setEnhancingCl(true); setError(null)
    try {
      const cl = await candidateApi.enhanceCoverLetter(id, ownLetterInput, clLength, clTone)
      setCoverLetter(cl); setClEditText(cl.content_text)
    } catch (e) { setError(String(e)) }
    finally { setEnhancingCl(false) }
  }

  const handleSaveCl = async () => {
    if (!clEditText.trim()) return
    setSavingCl(true); setError(null)
    try {
      const cl = await candidateApi.saveCoverLetter(id, clEditText)
      setCoverLetter(cl); flash('Cover letter saved')
    } catch (e) { setError(String(e)) }
    finally { setSavingCl(false) }
  }

  const handleSavePrep = async () => {
    setSavingPrep(true); setError(null)
    try {
      await candidateApi.saveInterviewPrep(id, { interview_format: interviewFormat, interviewer_roles: interviewerRoles, focus_areas: focusAreas })
      flash('Interview details saved')
    } catch (e) { setError(String(e)) }
    finally { setSavingPrep(false) }
  }

  const handleGenerateQA = async () => {
    await handleSavePrep()
    setGeneratingQA(true); setError(null)
    setShowStarredOnly(false)
    setViewCats([])
    try {
      const result = await candidateApi.generateInterviewQA(id, catCounts)
      setQaItems(result.qa); setExpandedIndex(0)
    } catch (e) { setError(String(e)) }
    finally { setGeneratingQA(false) }
  }

  const handleToggleStar = async (index: number) => {
    const updated = qaItems.map((item, i) =>
      i === index ? { ...item, starred: !item.starred } : item
    )
    setQaItems(updated)
    try { await candidateApi.saveQA(id, updated) } catch { /* silent */ }
  }

  const handleCopy = async (text: string, key: 'cv' | 'cl') => {
    await navigator.clipboard.writeText(text)
    setCopied(key); setTimeout(() => setCopied(null), 2000)
  }

  const [downloadingPdf, setDownloadingPdf] = useState<'cv' | 'cover_letter' | null>(null)

  const handleDownloadPdf = async (type: 'cv' | 'cover_letter', label: string) => {
    const suffix = app?.job_title
      ? `_${app.job_title}${app.company ? `_${app.company}` : ''}`.replace(/[^a-zA-Z0-9_-]/g, '_')
      : ''
    const filename = `${label.replace(' ', '_')}${suffix}.pdf`
    setDownloadingPdf(type)
    try {
      await candidateApi.downloadPdf(id, type, filename)
    } catch (e) {
      setError(String(e))
    } finally {
      setDownloadingPdf(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <svg className="w-8 h-8 animate-spin text-indigo-400" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    )
  }

  if (!app) return <div className="text-center py-16 text-slate-500 text-lg">Application not found.</div>

  const canEnhance = cvInput.trim().length > 0

  return (
    <div className="max-w-7xl mx-auto px-2">

      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <Link href="/candidate/dashboard" className="text-base text-slate-500 hover:text-slate-700">
            ← My Applications
          </Link>
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            <input
              value={jobTitle}
              onChange={e => setJobTitle(e.target.value)}
              onBlur={handleSaveJob}
              placeholder="Add job title…"
              className={`text-2xl font-bold text-slate-900 bg-transparent focus:outline-none min-w-[220px] ${
                jobTitle
                  ? 'border-b border-transparent hover:border-slate-300 focus:border-indigo-400'
                  : 'border-b-2 border-dashed border-indigo-300 focus:border-indigo-500 placeholder:text-indigo-300'
              }`}
            />
            <input
              value={company}
              onChange={e => setCompany(e.target.value)}
              onBlur={handleSaveJob}
              placeholder="Organisation"
              className="text-base text-slate-500 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-400 focus:outline-none"
            />
          </div>
        </div>
        {successMsg && (
          <span className="text-sm text-green-700 bg-green-50 border border-green-200 px-4 py-2 rounded-lg font-medium">
            ✓ {successMsg}
          </span>
        )}
      </div>

      {error && (
        <div className="mb-6 rounded-xl bg-red-50 border border-red-200 px-5 py-4 text-base text-red-700 flex items-start justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-4 text-red-400 hover:text-red-600 text-lg font-bold">✕</button>
        </div>
      )}

      {/* Phase stepper */}
      <div className="mb-8 flex items-center gap-0">
        {([
          { num: 1, label: 'CV Enhancement', Pip: CvPip },
          { num: 2, label: 'Cover Letter',   Pip: LetterPip },
          { num: 3, label: 'Interview Prep', Pip: InterviewPip },
        ] as { num: Phase; label: string; Pip: React.ComponentType<{ className?: string }> }[]).map(({ num, label, Pip }, i) => (
          <div key={num} className="flex items-center">
            <button
              onClick={() => setPhase(num)}
              className={`flex items-center gap-2.5 px-5 py-3 rounded-xl text-base font-semibold transition-all ${
                phase === num
                  ? 'bg-indigo-600 text-white shadow-md scale-105'
                  : 'bg-white border border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600'
              }`}
            >
              <Pip className="w-5 h-5" />
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                phase === num ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
              }`}>{num}</span>
              {label}
            </button>
            {i < 2 && <div className="w-8 h-0.5 bg-slate-200 mx-1" />}
          </div>
        ))}
      </div>

      {/* ── Phase 1: CV ── */}
      {phase === 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* LEFT — mode selector + inputs */}
          <div className="space-y-6">

            {/* Mode toggle + inputs */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900 mb-1">Your CV</h2>
              <p className="text-sm text-slate-500 mb-5">Choose how you want to create your CV</p>

              <div className="grid grid-cols-2 gap-3 mb-6">
                <button
                  onClick={() => setCvMode('enhance')}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${cvMode === 'enhance' ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-slate-300'}`}
                >
                  <span className="text-2xl">✨</span>
                  <span className={`text-sm font-semibold ${cvMode === 'enhance' ? 'text-indigo-700' : 'text-slate-600'}`}>Enhance mine</span>
                  <span className="text-xs text-slate-400 text-center">Paste your CV, AI tailors it for this role</span>
                </button>
                <button
                  onClick={() => setCvMode('scratch')}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${cvMode === 'scratch' ? 'border-green-500 bg-green-50' : 'border-slate-200 hover:border-slate-300'}`}
                >
                  <span className="text-2xl">🤖</span>
                  <span className={`text-sm font-semibold ${cvMode === 'scratch' ? 'text-green-700' : 'text-slate-600'}`}>Write from scratch</span>
                  <span className="text-xs text-slate-400 text-center">Describe your background, AI writes your CV</span>
                </button>
              </div>

              {cvMode === 'enhance' ? (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <label className="block text-sm font-semibold text-slate-700">Paste your existing CV</label>
                      <input ref={pdfInputRef} type="file" accept=".pdf" className="hidden" onChange={handlePdfUpload} />
                      <button
                        onClick={() => pdfInputRef.current?.click()}
                        disabled={parsingPdf}
                        className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 disabled:opacity-50 transition-colors"
                      >
                        {parsingPdf
                          ? <><svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Reading PDF…</>
                          : <>↑ Upload PDF</>
                        }
                      </button>
                    </div>
                    {cvInput.trim() && (
                      <span className="text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded-lg">{cvInput.split(/\s+/).filter(Boolean).length} words</span>
                    )}
                  </div>
                  <textarea
                    value={cvInput}
                    onChange={e => setCvInput(e.target.value)}
                    rows={14}
                    placeholder={"Paste your CV here…\n\nInclude work experience, education, skills, and achievements."}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none font-mono leading-relaxed"
                  />
                  <button
                    onClick={handleSaveCv}
                    disabled={savingCv || !cvInput.trim()}
                    className="mt-3 px-5 py-2.5 bg-slate-700 hover:bg-slate-800 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors"
                  >
                    {savingCv ? 'Saving…' : originalCv ? '✓ Update CV' : 'Save CV'}
                  </button>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Tell us about your background</label>
                  <p className="text-xs text-slate-400 mb-3">Include your work history, education, key skills, and any achievements — bullet points or plain text are fine</p>
                  <textarea
                    value={backgroundInput}
                    onChange={e => setBackgroundInput(e.target.value)}
                    rows={14}
                    placeholder={"e.g.\n\nWorked at Ministry of Education 2019–2024 as a Policy Analyst\n- Led Treaty of Waitangi policy review\n- Stakeholder engagement with iwi\n\nBefore that: Wellington City Council, Senior Advisor 2015–2019\n\nEducation: BA Political Science, Victoria University 2014\n\nSkills: policy analysis, data reporting, stakeholder comms"}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-green-500 resize-none leading-relaxed"
                  />
                </div>
              )}
            </div>

            {/* Job Description */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Job Description</h2>
                  <p className="text-sm text-slate-500 mt-0.5">Paste from the job ad — AI uses this to tailor your CV</p>
                </div>
                {jdInput.trim() && (
                  <span className="text-sm text-slate-400 bg-slate-50 px-3 py-1 rounded-lg">{jdInput.split(/\s+/).filter(Boolean).length} words</span>
                )}
              </div>
              <textarea
                value={jdInput}
                onChange={e => setJdInput(e.target.value)}
                rows={10}
                placeholder="Paste the full job description here…"
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none leading-relaxed"
              />
              <button
                onClick={handleSaveJob}
                disabled={savingJob || !jdInput.trim()}
                className="mt-3 px-5 py-2.5 bg-slate-700 hover:bg-slate-800 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                {savingJob ? 'Saving…' : 'Save'}
              </button>
            </div>

            {/* CV Parameters */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 space-y-3">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Output settings</p>
              <ParamPicker
                label="Pages"
                value={cvPages}
                onChange={setCvPages}
                options={[
                  { value: '1', label: '1 page' },
                  { value: '2', label: '2 pages' },
                  { value: '3+', label: '3+ pages' },
                ]}
              />
              <ParamPicker
                label="Style"
                value={cvStyle}
                onChange={setCvStyle}
                options={[
                  { value: 'concise', label: 'Concise' },
                  { value: 'professional', label: 'Professional' },
                  { value: 'detailed', label: 'Detailed' },
                ]}
              />
            </div>

            {/* Action button */}
            {cvMode === 'enhance' ? (
              <>
                <button
                  onClick={handleEnhanceCv}
                  disabled={enhancing || !canEnhance}
                  className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-base font-bold rounded-2xl transition-colors flex items-center justify-center gap-3 shadow-md"
                >
                  {enhancing ? (
                    <><Spinner />Enhancing your CV… this takes ~20 seconds</>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      {enhancedCv ? '✨ Re-enhance CV with AI' : '✨ Enhance CV with AI'}
                    </>
                  )}
                </button>
                {!canEnhance && (
                  <p className="text-sm text-amber-600 text-center font-medium">Paste your CV above to get started</p>
                )}
              </>
            ) : (
              <button
                onClick={handleGenerateCvFromScratch}
                disabled={generatingCvFromScratch || enhancing || !backgroundInput.trim()}
                className="w-full py-4 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-base font-bold rounded-2xl transition-colors flex items-center justify-center gap-3 shadow-md"
              >
                {generatingCvFromScratch || enhancing ? (
                  <><Spinner />{generatingCvFromScratch ? 'Writing your CV… (~20s)' : 'Tailoring for this role…'}</>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    🤖 Generate CV with AI
                  </>
                )}
              </button>
            )}
          </div>

          {/* RIGHT — Enhanced CV output */}
          <div>
            <div className={`bg-white rounded-2xl p-6 border shadow-sm h-full ${enhancedCv ? 'border-indigo-200' : 'border-slate-200'}`}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    {enhancedCv ? '✨ Enhanced CV' : 'Enhanced CV'}
                  </h2>
                  <p className="text-sm text-slate-500 mt-0.5">
                    {enhancedCv
                      ? `Tailored for ${app.job_title}${app.company ? ` at ${app.company}` : ''}`
                      : 'Will appear here after generation'}
                  </p>
                </div>
                {enhancedCv && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDownloadPdf('cv', 'Enhanced_CV')}
                      disabled={downloadingPdf === 'cv'}
                      className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:bg-indigo-400 rounded-xl transition-colors"
                    >
                      {downloadingPdf === 'cv' ? (
                        <><Spinner />Generating…</>
                      ) : (
                        <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>Download PDF</>
                      )}
                    </button>
                    <button
                      onClick={() => handleCopy(enhancedCv.content_text, 'cv')}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors"
                    >
                      {copied === 'cv' ? '✓ Copied!' : 'Copy text'}
                    </button>
                  </div>
                )}
              </div>
              {enhancedCv ? (
                <div
                  className="border border-indigo-100 rounded-xl p-5 bg-indigo-50/20 max-h-[700px] overflow-y-auto text-base leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: enhancedCv.content_html }}
                />
              ) : (
                <div className="border-2 border-dashed border-slate-200 rounded-xl p-16 text-center text-slate-300 flex flex-col items-center justify-center h-[calc(100%-60px)]">
                  <svg className="w-14 h-14 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-base font-medium">Your enhanced CV will appear here</p>
                  <p className="text-sm mt-1">
                    {cvMode === 'enhance' ? 'Paste your CV and click Enhance' : 'Describe your background and click Generate'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Phase 2: Cover Letter ── */}
      {phase === 2 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* LEFT — mode selector + inputs */}
          <div className="space-y-6">

            {/* Mode toggle */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900 mb-1">Cover Letter</h2>
              <p className="text-sm text-slate-500 mb-5">Choose how you want to create your cover letter</p>

              <div className="grid grid-cols-2 gap-3 mb-6">
                <button
                  onClick={() => setClMode('scratch')}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${clMode === 'scratch' ? 'border-green-500 bg-green-50' : 'border-slate-200 hover:border-slate-300'}`}
                >
                  <span className="text-2xl">🤖</span>
                  <span className={`text-sm font-semibold ${clMode === 'scratch' ? 'text-green-700' : 'text-slate-600'}`}>Write from scratch</span>
                  <span className="text-xs text-slate-400 text-center">AI writes a tailored letter using your CV</span>
                </button>
                <button
                  onClick={() => setClMode('enhance')}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${clMode === 'enhance' ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-slate-300'}`}
                >
                  <span className="text-2xl">✨</span>
                  <span className={`text-sm font-semibold ${clMode === 'enhance' ? 'text-indigo-700' : 'text-slate-600'}`}>Enhance mine</span>
                  <span className="text-xs text-slate-400 text-center">Paste your letter, AI improves it</span>
                </button>
              </div>

              {/* CL Parameters */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 space-y-3 mb-2">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Output settings</p>
                <ParamPicker
                  label="Length"
                  value={clLength}
                  onChange={setClLength}
                  options={[
                    { value: 'short', label: 'Short' },
                    { value: 'standard', label: 'Standard' },
                    { value: 'detailed', label: 'Detailed' },
                  ]}
                />
                <ParamPicker
                  label="Tone"
                  value={clTone}
                  onChange={setClTone}
                  options={[
                    { value: 'conversational', label: 'Conversational' },
                    { value: 'professional', label: 'Professional' },
                    { value: 'formal', label: 'Formal' },
                  ]}
                />
              </div>

              {clMode === 'scratch' ? (
                <div>
                  {!originalCv && (
                    <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                      <p className="text-sm text-amber-700 font-medium">Add your CV in Phase 1 for a better result</p>
                    </div>
                  )}
                  <p className="text-sm text-slate-500 mb-4">AI will write a tailored cover letter based on your CV and job description.</p>
                  <button
                    onClick={handleGenerateCl}
                    disabled={generatingCl}
                    className="w-full py-3.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-base font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm"
                  >
                    {generatingCl ? <><Spinner />Writing… (~20s)</> : '🤖 Write Cover Letter'}
                  </button>
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <label className="block text-sm font-semibold text-slate-700">Your existing cover letter</label>
                    <input ref={clPdfInputRef} type="file" accept=".pdf" className="hidden" onChange={handleClPdfUpload} />
                    <button
                      onClick={() => clPdfInputRef.current?.click()}
                      disabled={parsingClPdf}
                      className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 disabled:opacity-50 transition-colors"
                    >
                      {parsingClPdf
                        ? <><svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Reading PDF…</>
                        : <>↑ Upload PDF</>
                      }
                    </button>
                  </div>
                  <textarea
                    value={ownLetterInput}
                    onChange={e => setOwnLetterInput(e.target.value)}
                    rows={12}
                    placeholder="Paste your cover letter here…"
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none leading-relaxed"
                  />
                  <button
                    onClick={handleEnhanceCl}
                    disabled={enhancingCl || !ownLetterInput.trim()}
                    className="mt-3 w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-base font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm"
                  >
                    {enhancingCl ? <><Spinner />Enhancing… (~20s)</> : '✨ Enhance My Letter'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT — editable output */}
          <div>
            <div className={`bg-white rounded-2xl p-6 border shadow-sm h-full ${coverLetter ? 'border-green-200' : 'border-slate-200'}`}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    {coverLetter ? '✨ Your Cover Letter' : 'Cover Letter Output'}
                  </h2>
                  <p className="text-sm text-slate-500 mt-0.5">
                    {coverLetter ? 'Edit directly below, then save' : 'Will appear here after generation'}
                  </p>
                </div>
                {coverLetter && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDownloadPdf('cover_letter', 'Cover_Letter')}
                      disabled={downloadingPdf === 'cover_letter'}
                      className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 active:bg-green-800 disabled:bg-green-400 rounded-xl transition-colors"
                    >
                      {downloadingPdf === 'cover_letter' ? (
                        <><Spinner />Generating…</>
                      ) : (
                        <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>Download PDF</>
                      )}
                    </button>
                    <button
                      onClick={() => handleCopy(clEditText, 'cl')}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-green-700 bg-green-50 hover:bg-green-100 rounded-xl transition-colors"
                    >
                      {copied === 'cl' ? '✓ Copied!' : 'Copy'}
                    </button>
                  </div>
                )}
              </div>

              {coverLetter ? (
                <>
                  <textarea
                    value={clEditText}
                    onChange={e => setClEditText(e.target.value)}
                    rows={22}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-green-500 resize-none leading-relaxed"
                  />
                  <div className="flex gap-3 mt-3">
                    <button
                      onClick={handleSaveCl}
                      disabled={savingCl}
                      className="px-5 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-colors"
                    >
                      {savingCl ? 'Saving…' : '💾 Save edits'}
                    </button>
                    <button
                      onClick={clMode === 'scratch' ? handleGenerateCl : handleEnhanceCl}
                      disabled={generatingCl || enhancingCl}
                      className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 text-sm font-bold rounded-xl transition-colors"
                    >
                      ↻ Regenerate
                    </button>
                  </div>
                </>
              ) : (
                <div className="border-2 border-dashed border-slate-200 rounded-xl p-16 text-center text-slate-300 h-full flex flex-col items-center justify-center">
                  <span className="text-5xl mb-4">✍🏼</span>
                  <p className="text-base font-semibold">Your cover letter will appear here</p>
                  <p className="text-sm mt-1">Choose a mode and generate to get started</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Phase 3: Interview Prep ── */}
      {phase === 3 && (() => {
        const ALL_CATS = ['Behavioural', 'Technical', 'Situational', 'Motivation', 'Values']
        const totalQuestions = Object.values(catCounts).reduce((a, b) => a + b, 0)
        const starredCount = qaItems.filter(q => q.starred).length

        // cats actually present in generated results
        const resultCats = [...new Set(qaItems.map(q => q.category || 'General'))]

        const toggleViewCat = (cat: string) =>
          setViewCats(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat])

        const setCatCount = (cat: string, val: number) =>
          setCatCounts(prev => ({ ...prev, [cat]: Math.max(0, Math.min(10, val)) }))

        const visibleItems = qaItems
          .map((item, index) => ({ item, index }))
          .filter(({ item }) => {
            if (showStarredOnly && !item.starred) return false
            const cat = item.category || 'General'
            if (viewCats.length > 0 && !viewCats.includes(cat)) return false
            return true
          })

        const groupedVisible = visibleItems.reduce<Record<string, { item: QAItem; index: number }[]>>((acc, { item, index }) => {
          const cat = item.category || 'General'
          if (!acc[cat]) acc[cat] = []
          acc[cat].push({ item, index })
          return acc
        }, {})

        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

            {/* LEFT — form + settings */}
            <div className="space-y-5">
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <h2 className="text-lg font-bold text-slate-900 mb-1">Interview Details</h2>
                <p className="text-sm text-slate-500 mb-5">The more detail you add, the more tailored your questions will be</p>

                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Interview Format</label>
                    <select
                      value={interviewFormat}
                      onChange={e => setInterviewFormat(e.target.value)}
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    >
                      <option value="">Select format…</option>
                      {INTERVIEW_FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <label className="text-sm font-semibold text-slate-700">Who will be interviewing you?</label>
                      <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Optional</span>
                    </div>
                    <p className="text-xs text-slate-400 mb-2">Knowing their role helps us tailor questions to what they care about most</p>
                    <textarea
                      value={interviewerRoles}
                      onChange={e => setInterviewerRoles(e.target.value)}
                      rows={3}
                      placeholder={"e.g. Panel of 3: Hiring Manager, HR Business Partner, Senior Policy Advisor\n— or — Director of Strategy + two team leads"}
                      className="w-full px-4 py-3 border border-indigo-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none leading-relaxed bg-indigo-50/30"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Focus Areas</label>
                    <p className="text-xs text-slate-400 mb-2">What topics do you think will come up?</p>
                    <textarea
                      value={focusAreas}
                      onChange={e => setFocusAreas(e.target.value)}
                      rows={4}
                      placeholder="e.g. stakeholder management, policy experience, Treaty of Waitangi knowledge, leadership…"
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none leading-relaxed"
                    />
                  </div>
                </div>
              </div>

              {/* Question settings — category + count steppers */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Questions per type</p>
                  <span className="text-xs text-slate-400 font-semibold">
                    Total: <span className="text-slate-700">{totalQuestions}</span>
                  </span>
                </div>

                <div className="space-y-2">
                  {ALL_CATS.map(cat => {
                    const count = catCounts[cat] ?? 0
                    const postCount = qaItems.filter(q => (q.category || 'General') === cat).length
                    const colorClass = CATEGORY_COLORS[cat] ?? CATEGORY_COLORS.General
                    return (
                      <div key={cat} className="flex items-center gap-3">
                        {/* Category label */}
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-lg w-28 text-center shrink-0 ${count > 0 ? colorClass : 'bg-slate-100 text-slate-400'}`}>
                          {cat}
                        </span>

                        {/* Stepper */}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setCatCount(cat, count - 1)}
                            disabled={count === 0}
                            className="w-7 h-7 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-100 disabled:opacity-30 font-bold text-base flex items-center justify-center transition-colors"
                          >−</button>
                          <span className={`w-8 text-center text-sm font-bold ${count > 0 ? 'text-slate-800' : 'text-slate-300'}`}>
                            {count}
                          </span>
                          <button
                            onClick={() => setCatCount(cat, count + 1)}
                            disabled={count >= 10}
                            className="w-7 h-7 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-100 disabled:opacity-30 font-bold text-base flex items-center justify-center transition-colors"
                          >+</button>
                        </div>

                        {/* Post-generation actual count */}
                        {postCount > 0 && (
                          <span className="text-xs text-slate-400">→ {postCount} generated</span>
                        )}
                      </div>
                    )
                  })}
                </div>

                <p className="text-xs text-slate-400 mt-3">Set a type to 0 to skip it. After generating, counts also filter the results.</p>
              </div>

              <button
                onClick={handleGenerateQA}
                disabled={generatingQA || totalQuestions === 0}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-base font-bold rounded-2xl transition-colors flex items-center justify-center gap-3 shadow-md"
              >
                {generatingQA ? (
                  <><Spinner />Generating {totalQuestions} questions… (~30s)</>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {qaItems.length > 0 ? `↻ Regenerate (${totalQuestions} questions)` : `🎯 Generate ${totalQuestions} Questions`}
                  </>
                )}
              </button>

              {!originalCv && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                  <p className="text-sm text-amber-700 font-medium">Add your CV in Phase 1 for more personalised questions</p>
                </div>
              )}
            </div>

            {/* RIGHT — Q&A results */}
            <div className="space-y-4">
              {qaItems.length === 0 ? (
                <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-16 text-center text-slate-300 flex flex-col items-center justify-center min-h-[300px]">
                  <svg className="w-14 h-14 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-base font-semibold">Your interview questions will appear here</p>
                  <p className="text-sm mt-1">Configure your settings on the left and click Generate</p>
                </div>
              ) : (
                <>
                  {/* Category filter pills */}
                  {resultCats.length > 1 && (
                    <div className="flex flex-wrap gap-2">
                      {resultCats.map(cat => {
                        const isActive = viewCats.includes(cat)
                        const count = qaItems.filter(q => (q.category || 'General') === cat).length
                        return (
                          <button
                            key={cat}
                            onClick={() => toggleViewCat(cat)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                              isActive
                                ? `${CATEGORY_COLORS[cat] ?? CATEGORY_COLORS.General} border-transparent shadow-sm scale-105`
                                : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700'
                            }`}
                          >
                            {cat}
                            <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${isActive ? 'bg-white/60' : 'bg-slate-100'}`}>
                              {count}
                            </span>
                          </button>
                        )
                      })}
                      {viewCats.length > 0 && (
                        <button
                          onClick={() => setViewCats([])}
                          className="text-xs text-slate-400 hover:text-slate-600 underline self-center ml-1"
                        >
                          Show all
                        </button>
                      )}
                    </div>
                  )}

                  {/* Slim results header */}
                  <div className="flex items-center justify-between px-1">
                    <p className="text-sm text-slate-500">
                      Showing <span className="font-semibold text-slate-700">{visibleItems.length}</span> of {qaItems.length} questions
                      {starredCount > 0 && !showStarredOnly && ` · ${starredCount} ⭐ starred`}
                    </p>
                    <div className="flex items-center gap-2">
                      {starredCount > 0 && (
                        <button
                          onClick={() => setShowStarredOnly(!showStarredOnly)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                            showStarredOnly
                              ? 'bg-amber-100 text-amber-700 border-amber-300 shadow-sm'
                              : 'bg-white text-slate-500 border-slate-200 hover:border-amber-300 hover:text-amber-600'
                          }`}
                        >
                          ⭐ Starred only
                        </button>
                      )}
                      {(viewCats.length > 0 || showStarredOnly) && (
                        <button
                          onClick={() => { setViewCats([]); setShowStarredOnly(false) }}
                          className="text-xs text-slate-400 hover:text-slate-600 underline"
                        >
                          Reset filters
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Q&A grouped by category */}
                  {Object.entries(groupedVisible).map(([category, items]) => (
                    <div key={category}>
                      <div className="flex items-center gap-3 mb-3">
                        <span className={`text-sm font-bold px-3 py-1 rounded-full ${CATEGORY_COLORS[category] ?? CATEGORY_COLORS.General}`}>
                          {category}
                        </span>
                        <span className="text-sm text-slate-400">{items.length} question{items.length !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="space-y-3">
                        {items.map(({ item, index }) => (
                          <div
                            key={index}
                            className={`bg-white rounded-xl overflow-hidden shadow-sm border transition-all ${
                              item.starred ? 'border-amber-300 shadow-amber-100' : 'border-slate-200'
                            }`}
                          >
                            <div className="flex items-start gap-3 px-5 py-4 hover:bg-slate-50 transition-colors">
                              <button
                                onClick={() => handleToggleStar(index)}
                                className={`shrink-0 mt-0.5 text-xl leading-none transition-transform hover:scale-125 ${item.starred ? 'text-amber-400' : 'text-slate-200 hover:text-amber-300'}`}
                                title={item.starred ? 'Unstar' : 'Star this question'}
                              >
                                {item.starred ? '★' : '☆'}
                              </button>
                              <button
                                className="flex-1 text-left flex items-start justify-between gap-3"
                                onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
                              >
                                <span className="text-base font-semibold text-slate-800 leading-snug">{item.question}</span>
                                <svg
                                  className={`w-5 h-5 text-slate-400 shrink-0 mt-0.5 transition-transform ${expandedIndex === index ? 'rotate-180' : ''}`}
                                  fill="none" viewBox="0 0 24 24" stroke="currentColor"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>
                            </div>
                            {expandedIndex === index && (
                              <div className="px-5 pb-5 border-t border-slate-100 bg-slate-50/50">
                                <p className="text-base text-slate-700 leading-relaxed pt-4 whitespace-pre-wrap">{item.answer}</p>
                                {item.tip && (
                                  <div className="mt-4 flex gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                                    <span className="text-lg shrink-0">💡</span>
                                    <div>
                                      <p className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-1">Interviewer insight</p>
                                      <p className="text-sm text-amber-800 leading-relaxed">{item.tip}</p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  {visibleItems.length === 0 && (
                    <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-slate-400">
                      <p className="text-base font-medium">No questions match the current filters</p>
                      <button
                        onClick={() => { setViewCats([]); setShowStarredOnly(false) }}
                        className="mt-2 text-sm text-indigo-500 hover:underline"
                      >
                        Reset filters
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )
      })()}
    </div>
  )
}

export default function ApplicationWorkspacePage() {
  return (
    <Suspense>
      <ApplicationWorkspace />
    </Suspense>
  )
}

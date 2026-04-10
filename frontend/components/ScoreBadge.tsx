interface ScoreBadgeProps {
  score: number
  size?: 'sm' | 'md' | 'lg'
}

export default function ScoreBadge({ score, size = 'md' }: ScoreBadgeProps) {
  const getColor = (s: number) => {
    if (s >= 75) return 'bg-green-100 text-green-800 ring-green-300'
    if (s >= 60) return 'bg-yellow-100 text-yellow-800 ring-yellow-300'
    if (s >= 45) return 'bg-orange-100 text-orange-800 ring-orange-300'
    return 'bg-red-100 text-red-800 ring-red-300'
  }

  const sizeClasses = {
    sm: 'w-10 h-10 text-xs font-semibold',
    md: 'w-12 h-12 text-sm font-bold',
    lg: 'w-16 h-16 text-base font-bold',
  }

  return (
    <div
      className={`rounded-full ring-2 flex items-center justify-center flex-shrink-0 ${getColor(score)} ${sizeClasses[size]}`}
    >
      {Math.round(score)}
    </div>
  )
}

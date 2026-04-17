'use client'

import { usePathname } from 'next/navigation'
import Nav from '@/components/Nav'

export default function NavWrapper() {
  const pathname = usePathname()
  const isCandidatePage = pathname.startsWith('/candidate')
  const isHomePage = pathname === '/'
  if (isCandidatePage || isHomePage) return null
  return <Nav />
}

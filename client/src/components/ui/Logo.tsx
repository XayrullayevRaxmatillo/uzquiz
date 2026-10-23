import { Link } from 'react-router-dom'

export function LogoMark({ className = 'size-9' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#A855F7" />
          <stop offset="1" stopColor="#6D28D9" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#lg)" />
      <path d="M22 20h8v16a4 4 0 0 0 8 0V20h8v16a12 12 0 0 1-24 0z" fill="#fff" />
    </svg>
  )
}

export function Logo({ to = '/' }: { to?: string }) {
  return (
    <Link to={to} className="flex items-center gap-2.5 font-display text-xl font-bold tracking-tight" aria-label="UZQUIZ">
      <LogoMark />
      <span>UZQUIZ</span>
    </Link>
  )
}

const PALETTE = ['#0ea5e9', '#6366f1', '#8b5cf6', '#f97316', '#ec4899', '#14b8a6', '#eab308', '#ef4444']

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

interface Props {
  name: string
  /** Optional avatar value: a hex colour ("#f97316") or an https image URL. */
  src?: string
  size?: 'sm' | 'md' | 'lg'
  online?: boolean
  crown?: boolean
}

const SIZES = { sm: 'size-8 text-sm rounded-lg', md: 'size-11 text-lg rounded-xl', lg: 'size-16 text-2xl rounded-2xl' }

export function Avatar({ name, src, size = 'md', online, crown }: Props) {
  const isUrl = !!src && /^https?:\/\//.test(src)
  const colour = src && /^#[0-9a-fA-F]{6}$/.test(src) ? src : PALETTE[hash(name) % PALETTE.length]
  return (
    <span className="relative inline-flex shrink-0">
      {crown && (
        <span className="absolute -top-2.5 left-1/2 z-10 -translate-x-1/2 rounded-full bg-warn px-1.5 py-0.5 text-[10px] leading-none text-black" aria-hidden>
          ♛
        </span>
      )}
      {isUrl ? (
        <img src={src} alt={name} loading="lazy" className={`${SIZES[size]} object-cover`} />
      ) : (
        <span
          className={`${SIZES[size]} inline-flex items-center justify-center font-bold text-white shadow-lg`}
          style={{ background: colour }}
          aria-label={name}
        >
          {name.trim().charAt(0).toUpperCase() || '?'}
        </span>
      )}
      {online !== undefined && (
        <span
          className={`absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-[var(--bg)] ${online ? 'bg-ok' : 'bg-faint'}`}
          aria-label={online ? 'online' : 'offline'}
        />
      )}
    </span>
  )
}

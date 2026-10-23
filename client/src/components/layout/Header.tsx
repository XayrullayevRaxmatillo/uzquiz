import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, Globe, LogOut, Menu, Moon, Play, Sun, UserRound, X, LayoutDashboard, Shield } from 'lucide-react'
import { Logo } from '../ui/Logo'
import { Avatar } from '../ui/Avatar'
import { LinkButton } from '../ui/Button'
import { useI18n, LANGS, type Lang, type TKey } from '../../i18n'
import { useTheme } from '../../context/ThemeContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useClickAway } from '../../hooks/useClickAway'
import { NotificationBell } from './NotificationBell'

const NAV: { to: string; key: TKey }[] = [
  { to: '/', key: 'nav.home' },
  { to: '/explore', key: 'nav.explore' },
  { to: '/teams', key: 'nav.findTeam' },
  { to: '/quizzes/new', key: 'nav.createQuiz' },
  { to: '/leaderboard', key: 'nav.leaderboard' },
]

export function LanguageSwitch() {
  const { lang, setLang, t } = useI18n()
  const [open, setOpen] = useState(false)
  const ref = useClickAway<HTMLDivElement>(open, () => setOpen(false))
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-muted hover:bg-surface2 hover:text-fg"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('common.language')}
      >
        <Globe className="size-4" aria-hidden />
        {lang.toUpperCase()}
        <ChevronDown className="size-3.5" aria-hidden />
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="glass absolute right-0 z-50 mt-2 w-36 overflow-hidden p-1"
          >
            {LANGS.map((l: Lang) => (
              <li key={l} role="option" aria-selected={l === lang}>
                <button
                  type="button"
                  onClick={() => {
                    setLang(l)
                    setOpen(false)
                  }}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-surface2 ${l === lang ? 'font-semibold text-brand2' : 'text-fg'}`}
                >
                  {{ uz: 'O‘zbekcha', ru: 'Русский', en: 'English' }[l]}
                  <span className="text-xs text-faint">{l.toUpperCase()}</span>
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  )
}

export function ThemeToggle() {
  const { theme, toggle } = useTheme()
  const { t } = useI18n()
  const label = theme === 'dark' ? t('common.lightMode') : t('common.darkMode')
  return (
    <button
      type="button"
      onClick={toggle}
      className="grid size-10 place-items-center rounded-xl text-muted hover:bg-surface2 hover:text-fg"
      aria-label={label}
      title={label}
    >
      {theme === 'dark' ? <Sun className="size-5" /> : <Moon className="size-5" />}
    </button>
  )
}

function UserMenu() {
  const { user, logout } = useAuth()
  const { t } = useI18n()
  const { push } = useToast()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useClickAway<HTMLDivElement>(open, () => setOpen(false))
  if (!user) return null

  const item = 'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-fg hover:bg-surface2'
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-xl p-1 pr-2 hover:bg-surface2"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={user.name}
      >
        <Avatar name={user.name} src={user.avatar} size="sm" />
        <ChevronDown className="size-3.5 text-faint" aria-hidden />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="glass absolute right-0 z-50 mt-2 w-60 p-1.5"
          >
            <div className="px-3 py-2">
              <p className="truncate text-sm font-semibold">{user.name}</p>
              <p className="truncate text-xs text-faint">@{user.username}</p>
            </div>
            <hr className="my-1 border-line" />
            <Link role="menuitem" to="/dashboard" className={item} onClick={() => setOpen(false)}>
              <LayoutDashboard className="size-4" /> {t('nav.dashboard')}
            </Link>
            <Link role="menuitem" to="/profile" className={item} onClick={() => setOpen(false)}>
              <UserRound className="size-4" /> {user.name}
            </Link>
            {user.role === 'admin' && (
              <Link role="menuitem" to="/admin" className={item} onClick={() => setOpen(false)}>
                <Shield className="size-4" /> {t('nav.admin')}
              </Link>
            )}
            <button
              role="menuitem"
              className={`${item} text-coral`}
              onClick={async () => {
                setOpen(false)
                await logout()
                push('info', t('auth.loggedOut'))
                navigate('/')
              }}
            >
              <LogOut className="size-4" /> {t('nav.logout')}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function Header() {
  const { t } = useI18n()
  const { user, loading } = useAuth()
  const [scrolled, setScrolled] = useState(false)
  const [mobile, setMobile] = useState(false)
  const loc = useLocation()

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8)
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])
  useEffect(() => setMobile(false), [loc.pathname])

  const link = ({ isActive }: { isActive: boolean }) =>
    `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${isActive ? 'text-fg bg-surface2' : 'text-muted hover:text-fg'}`

  return (
    <header className={`sticky top-0 z-40 transition-all ${scrolled || mobile ? 'border-b border-line bg-[color-mix(in_srgb,var(--bg)_80%,transparent)] backdrop-blur-xl' : 'border-b border-transparent'}`}>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Logo />
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'} className={link}>
              {t(n.key)}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-1.5">
          <div className="hidden items-center gap-1 sm:flex">
            <LanguageSwitch />
            <ThemeToggle />
          </div>
          {!loading && user && <NotificationBell />}
          {!loading && user && <UserMenu />}
          {!loading && !user && (
            <div className="hidden items-center gap-2 md:flex">
              <LinkButton to="/login" variant="ghost" size="sm">
                {t('nav.login')}
              </LinkButton>
              <LinkButton to="/register" size="sm">
                {t('nav.register')}
              </LinkButton>
            </div>
          )}
          <LinkButton to="/join" variant="secondary" size="sm" className="hidden md:inline-flex">
            <Play className="size-3.5" aria-hidden /> {t('nav.joinGame')}
          </LinkButton>
          <button
            type="button"
            className="grid size-10 place-items-center rounded-xl text-fg hover:bg-surface2 lg:hidden"
            onClick={() => setMobile((m) => !m)}
            aria-expanded={mobile}
            aria-controls="mobile-menu"
            aria-label={t('nav.menu')}
          >
            {mobile ? <X className="size-6" /> : <Menu className="size-6" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {mobile && (
          <motion.div
            id="mobile-menu"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden lg:hidden"
          >
            <nav className="mx-auto flex max-w-7xl flex-col gap-1 px-4 pb-4 sm:px-6" aria-label="Mobile">
              {NAV.map((n) => (
                <NavLink key={n.to} to={n.to} end={n.to === '/'} className={link}>
                  {t(n.key)}
                </NavLink>
              ))}
              <NavLink to="/join" className={link}>
                {t('nav.joinGame')}
              </NavLink>
              <div className="mt-2 flex items-center justify-between border-t border-line pt-3">
                <div className="flex items-center gap-1">
                  <LanguageSwitch />
                  <ThemeToggle />
                </div>
                {!user && (
                  <div className="flex gap-2">
                    <LinkButton to="/login" variant="secondary" size="sm">
                      {t('nav.login')}
                    </LinkButton>
                    <LinkButton to="/register" size="sm">
                      {t('nav.register')}
                    </LinkButton>
                  </div>
                )}
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}

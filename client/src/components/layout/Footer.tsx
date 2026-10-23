import { Link } from 'react-router-dom'
import { Logo } from '../ui/Logo'
import { useI18n } from '../../i18n'

export function Footer() {
  const { t } = useI18n()
  const year = new Date().getFullYear()
  const col = 'flex flex-col gap-2 text-sm text-muted'
  const a = 'hover:text-fg'
  return (
    <footer className="mt-24 border-t border-line">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-sm text-muted">{t('common.tagline')}</p>
        </div>
        <nav className={col} aria-label={t('footer.product')}>
          <h3 className="mb-1 text-sm font-semibold text-fg">{t('footer.product')}</h3>
          <Link className={a} to="/explore">{t('nav.explore')}</Link>
          <Link className={a} to="/teams">{t('nav.findTeam')}</Link>
          <Link className={a} to="/quizzes/new">{t('nav.createQuiz')}</Link>
          <Link className={a} to="/leaderboard">{t('nav.leaderboard')}</Link>
        </nav>
        <nav className={col} aria-label={t('footer.company')}>
          <h3 className="mb-1 text-sm font-semibold text-fg">{t('footer.company')}</h3>
          <Link className={a} to="/join">{t('nav.joinGame')}</Link>
          <Link className={a} to="/register">{t('nav.register')}</Link>
          <Link className={a} to="/login">{t('nav.login')}</Link>
        </nav>
      </div>
      <div className="border-t border-line py-5 text-center text-xs text-faint">
        © {year} UZQUIZ · {t('footer.rights')} · {t('footer.madeIn')}
      </div>
    </footer>
  )
}

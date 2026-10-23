import { Suspense, lazy } from 'react'
import { Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Header } from './components/layout/Header'
import { Footer } from './components/layout/Footer'
import { ProtectedRoute } from './components/layout/ProtectedRoute'
import { useI18n } from './i18n'

import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
const L = {
  NotFound: lazy(() => import('./pages/NotFound')),
  Explore: lazy(() => import('./pages/Explore')),
  QuizDetail: lazy(() => import('./pages/QuizDetail')),
  QuizEditor: lazy(() => import('./pages/QuizEditor')),
  Teams: lazy(() => import('./pages/Teams')),
  TeamDetail: lazy(() => import('./pages/TeamDetail')),
  JoinRoom: lazy(() => import('./pages/JoinRoom')),
  CreateRoom: lazy(() => import('./pages/CreateRoom')),
  Room: lazy(() => import('./pages/Room')),
  RoomResults: lazy(() => import('./pages/RoomResults')),
  SharedResult: lazy(() => import('./pages/SharedResult')),
  Leaderboard: lazy(() => import('./pages/Leaderboard')),
  Dashboard: lazy(() => import('./pages/Dashboard')),
  Profile: lazy(() => import('./pages/Profile')),
  Onboarding: lazy(() => import('./pages/Onboarding')),
  ForgotPassword: lazy(() => import('./pages/ForgotPassword')),
  ResetPassword: lazy(() => import('./pages/ResetPassword')),
  VerifyEmail: lazy(() => import('./pages/VerifyEmail')),
  Admin: lazy(() => import('./pages/Admin')),
}

function Layout() {
  const { t } = useI18n()
  const loc = useLocation()
  return (
    <>
      <div className="backdrop" aria-hidden />
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-lg focus:bg-brand focus:px-4 focus:py-2 focus:text-white">
        {t('common.skipToContent')}
      </a>
      <Header />
      <main id="main" tabIndex={-1} className="outline-none">
        <AnimatePresence mode="wait">
          <motion.div key={loc.pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            <Suspense fallback={<div className="grid min-h-[40vh] place-items-center text-muted" role="status">{t('common.loading')}</div>}>
              <Outlet />
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </main>
      <Footer />
    </>
  )
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route path="forgot-password" element={<L.ForgotPassword />} />
        <Route path="reset-password" element={<L.ResetPassword />} />
        <Route path="verify-email" element={<L.VerifyEmail />} />
        <Route path="explore" element={<L.Explore />} />
        <Route path="quizzes/:id" element={<L.QuizDetail />} />
        <Route path="teams" element={<L.Teams />} />
        <Route path="teams/:id" element={<L.TeamDetail />} />
        <Route path="leaderboard" element={<L.Leaderboard />} />
        <Route path="join" element={<L.JoinRoom />} />
        <Route path="join/:code" element={<L.JoinRoom />} />
        <Route path="s/:code" element={<L.SharedResult />} />
        <Route element={<ProtectedRoute />}>
          <Route path="quizzes/new" element={<L.QuizEditor />} />
          <Route path="quizzes/:id/edit" element={<L.QuizEditor />} />
          <Route path="rooms/new" element={<L.CreateRoom />} />
          <Route path="room/:code" element={<L.Room />} />
          <Route path="results/:code" element={<L.RoomResults />} />
          <Route path="dashboard" element={<L.Dashboard />} />
          <Route path="profile" element={<L.Profile />} />
          <Route path="onboarding" element={<L.Onboarding />} />
        </Route>
        <Route element={<ProtectedRoute roles={['admin', 'moderator']} />}>
          <Route path="admin" element={<L.Admin />} />
        </Route>
        <Route path="*" element={<L.NotFound />} />
      </Route>
    </Routes>
  )
}

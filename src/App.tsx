import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { LoginPage } from '@/pages/LoginPage'
import { RegisterPage } from '@/pages/RegisterPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { ProjectPage } from '@/pages/ProjectPage'
import { MySpacePage } from '@/pages/MySpacePage'
import { NotificationsPage } from '@/pages/NotificationsPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { ArchivePage } from '@/pages/ArchivePage'
import { useAuth } from '@/store/authStore'
import { useProjects } from '@/store/projectStore'
import { useNotifications } from '@/store/notificationStore'

function RequireAuth({ children }: { children: JSX.Element }) {
  const user = useAuth((s) => s.user)
  const bootstrapping = useAuth((s) => s.bootstrapping)
  if (bootstrapping) return <SplashScreen />
  if (!user) return <Navigate to="/login" replace />
  return children
}

function SplashScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper-soft">
      <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-ink text-paper">
        <span className="title-serif text-2xl font-bold leading-none">m</span>
      </div>
    </div>
  )
}

export default function App() {
  const bootstrap = useAuth((s) => s.bootstrap)
  const user = useAuth((s) => s.user)
  const loadProjects = useProjects((s) => s.loadAll)
  const loadNotifications = useNotifications((s) => s.load)
  const startStream = useNotifications((s) => s.startStream)
  const stopStream = useNotifications((s) => s.stopStream)

  // 1) bootstrap session при старте
  useEffect(() => {
    void bootstrap()
  }, [bootstrap])

  // 2) при появлении пользователя — подгружаем проекты + уведомления + SSE
  useEffect(() => {
    if (!user) return
    void loadProjects()
    void loadNotifications()
    startStream()
    return () => stopStream()
  }, [user?.id])

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/" element={<RequireAuth><DashboardPage /></RequireAuth>} />
      <Route path="/my-space" element={<RequireAuth><MySpacePage /></RequireAuth>} />
      <Route path="/project/:id" element={<RequireAuth><ProjectPage /></RequireAuth>} />
      <Route path="/notifications" element={<RequireAuth><NotificationsPage /></RequireAuth>} />
      <Route path="/settings" element={<RequireAuth><SettingsPage /></RequireAuth>} />
      <Route path="/archive" element={<RequireAuth><ArchivePage /></RequireAuth>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

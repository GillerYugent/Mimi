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
import { useNotificationEffects } from '@/hooks/useNotificationEffects'

function RequireAuth({ children }: { children: JSX.Element }) {
  const session = useAuth((s) => s.session)
  if (!session) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  useNotificationEffects()

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

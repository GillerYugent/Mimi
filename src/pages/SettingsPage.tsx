import { Navigate } from 'react-router-dom'
import { useState } from 'react'
import { Layout } from '@/components/layout/Layout'
import { Topbar } from '@/components/layout/Topbar'
import { useAuth } from '@/store/authStore'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import type { NotificationPrefs } from '@/types'

const PREF_LABELS: Array<{ key: keyof NotificationPrefs; label: string; hint: string }> = [
  { key: 'taskAssigned', label: 'Назначение задачи', hint: 'Вас назначили исполнителем' },
  { key: 'taskStatusChanged', label: 'Изменение статуса задачи', hint: 'Обновление задач, где вы назначены' },
  { key: 'teamInvited', label: 'Приглашение в команду', hint: 'Когда вас зовут в команду проекта' },
  { key: 'mentionedInDoc', label: 'Упоминание в документе', hint: 'Когда вас упоминают в заметке или комментарии' },
]

export function SettingsPage() {
  const user = useAuth((s) => s.user)
  const updateProfile = useAuth((s) => s.updateProfile)
  const changePassword = useAuth((s) => s.changePassword)
  const updateNotificationPrefs = useAuth((s) => s.updateNotificationPrefs)

  const [name, setName] = useState(user?.name || '')
  const [email, setEmail] = useState(user?.email || '')
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '')
  const [saved, setSaved] = useState<string | null>(null)

  const [currentPass, setCurrentPass] = useState('')
  const [newPass, setNewPass] = useState('')
  const [pwError, setPwError] = useState<string | null>(null)
  const [pwOk, setPwOk] = useState(false)

  if (!user) return <Navigate to="/login" replace />

  const saveProfile = async () => {
    await updateProfile({ name: name.trim(), email: email.trim().toLowerCase(), avatarUrl })
    setSaved('Сохранено')
    setTimeout(() => setSaved(null), 2000)
  }

  const doChangePassword = async () => {
    setPwError(null)
    setPwOk(false)
    const res = await changePassword(currentPass, newPass)
    if (!res.ok) setPwError(res.error)
    else {
      setCurrentPass('')
      setNewPass('')
      setPwOk(true)
      setTimeout(() => setPwOk(false), 3000)
    }
  }

  return (
    <Layout>
      <Topbar breadcrumbs={<span className="px-1.5 font-medium text-ink">Настройки</span>} />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-8 py-6">
          <h1 className="title-serif mb-6 text-2xl font-bold tracking-tight text-ink">Аккаунт</h1>

          <Section title="Профиль" subtitle="Публичная информация о вас в платформе">
            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-ink text-xl font-semibold text-paper">
                {(name || user.name).charAt(0).toUpperCase()}
              </div>
              <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
                <Input label="Имя" value={name} onChange={(e) => setName(e.target.value)} />
                <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                <Input
                  className="sm:col-span-2"
                  label="URL аватара (опционально)"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>
            </div>
            <div className="mt-3 flex items-center justify-end gap-2">
              {saved && <span className="text-xs text-green-700">{saved}</span>}
              <Button variant="primary" onClick={saveProfile}>
                Сохранить
              </Button>
            </div>
          </Section>

          <Section title="Пароль" subtitle="Требуется ввести текущий пароль">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                label="Текущий пароль"
                type="password"
                value={currentPass}
                onChange={(e) => setCurrentPass(e.target.value)}
                autoComplete="current-password"
              />
              <Input
                label="Новый пароль"
                type="password"
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            {pwError && (
              <div className="mt-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-400">{pwError}</div>
            )}
            {pwOk && <div className="mt-2 text-xs text-green-700">Пароль обновлён</div>}
            <div className="mt-3 flex justify-end">
              <Button variant="primary" onClick={doChangePassword} disabled={!currentPass || !newPass}>
                Сменить пароль
              </Button>
            </div>
          </Section>

          <Section title="Уведомления" subtitle="Какие события показывать в колокольчике">
            <div className="divide-y divide-line">
              {PREF_LABELS.map(({ key, label, hint }) => (
                <label
                  key={key}
                  className="flex cursor-pointer items-center justify-between py-2.5"
                >
                  <div>
                    <div className="text-sm font-medium text-ink">{label}</div>
                    <div className="text-xs text-ink-light">{hint}</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={user.notificationPrefs[key]}
                    onChange={(e) =>
                      updateNotificationPrefs({ [key]: e.target.checked } as Partial<NotificationPrefs>)
                    }
                  />
                </label>
              ))}
            </div>
          </Section>

          <Section title="О приложении" subtitle="">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Row k="Версия" v="1.0.0" />
              <Row k="Хранение" v="PostgreSQL (per-service)" />
              <Row k="Auth" v="JWT (15 мин / 7 дней)" />
              <Row k="Password hashing" v="bcrypt cost ≥ 12" />
            </div>
          </Section>
        </div>
      </div>
    </Layout>
  )
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <section className="mb-8">
      <div className="mb-2">
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        {subtitle && <p className="text-xs text-ink-light">{subtitle}</p>}
      </div>
      <div className="rounded-md border border-line bg-paper p-4">{children}</div>
    </section>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between rounded border border-line px-3 py-2">
      <span className="text-ink-light">{k}</span>
      <span className="text-ink">{v}</span>
    </div>
  )
}

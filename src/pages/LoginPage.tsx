import { FormEvent, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '@/store/authStore'
import { Input } from '@/components/ui/Input'

export function LoginPage() {
  const user = useAuth((s) => s.user)
  const login = useAuth((s) => s.login)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  if (user) return <Navigate to="/" replace />

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const res = await login({ email, password })
    setLoading(false)
    if (!res.ok) setError(res.error)
    else navigate('/', { replace: true })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper-soft px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-ink text-paper">
            <span className="title-serif text-2xl font-bold leading-none">m</span>
          </div>
          <h1 className="title-serif text-2xl font-bold tracking-tight text-ink">Войти в Mimi</h1>
          <p className="mt-1 text-sm text-ink-light">Рабочее пространство для разработчиков</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-3 rounded-lg border border-line bg-paper p-6 shadow-notion">
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoFocus
            required
          />
          <Input
            label="Пароль"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••"
            required
          />
          {error && <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-400">{error}</div>}
          <button type="submit" className="btn btn-primary w-full py-2" disabled={loading}>
            {loading ? 'Входим...' : 'Войти'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-ink-light">
          Нет аккаунта?{' '}
          <Link to="/register" className="font-medium text-ink underline-offset-2 hover:underline">
            Зарегистрироваться
          </Link>
        </p>
      </div>
    </div>
  )
}

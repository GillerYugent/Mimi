import { FormEvent, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '@/store/authStore'
import { Input } from '@/components/ui/Input'

export function RegisterPage() {
  const session = useAuth((s) => s.session)
  const register = useAuth((s) => s.register)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  if (session) return <Navigate to="/" replace />

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const res = register({ name, email, password })
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
          <h1 className="title-serif text-2xl font-bold tracking-tight text-ink">Создать аккаунт</h1>
          <p className="mt-1 text-sm text-ink-light">Начните работу в Mimi</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-3 rounded-lg border border-line bg-paper p-6 shadow-notion">
          <Input
            label="Имя"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Максим Шестаков"
            autoFocus
            required
          />
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />
          <Input
            label="Пароль"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Минимум 6 символов"
            required
            minLength={6}
          />
          {error && <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}
          <button type="submit" className="btn btn-primary w-full py-2">
            Зарегистрироваться
          </button>
          <p className="text-center text-xs text-ink-lighter">
            Пароли хранятся в виде хэша. Данные — локально в вашем браузере.
          </p>
        </form>

        <p className="mt-4 text-center text-sm text-ink-light">
          Уже есть аккаунт?{' '}
          <Link to="/login" className="font-medium text-ink underline-offset-2 hover:underline">
            Войти
          </Link>
        </p>
      </div>
    </div>
  )
}

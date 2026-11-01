'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { updatePassword, useCloud } from '@/lib/cloud'
import { Shell } from './SignInPage'

// Tujuan tautan dari email "lupa kata sandi". supabase-js membaca token di URL dan membuat sesi pemulihan.
export function ResetPasswordPage() {
  const router = useRouter()
  const ready = useCloud((s) => s.ready)
  const session = useCloud((s) => s.session)
  const [msg, setMsg] = useState<{ err?: string; busy?: boolean }>({})

  if (!ready)
    return (
      <Shell>
        <p aria-busy="true">Memeriksa tautan…</p>
      </Shell>
    )

  if (!session)
    return (
      <Shell>
        <h1 className="stencil">Tautan tidak berlaku</h1>
        <p>Tautan atur ulang sudah kedaluwarsa, sudah dipakai, atau dibuka di browser lain. Minta tautan baru dari halaman masuk.</p>
        <Link className="btn btn-accent btn-link" href="/masuk">
          Ke halaman masuk
        </Link>
      </Shell>
    )

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const pw = String(f.get('password'))
    if (pw !== String(f.get('ulang'))) return setMsg({ err: 'Dua kata sandi tidak sama.' })
    setMsg({ busy: true })
    try {
      await updatePassword(pw)
      router.push('/')
    } catch (err) {
      setMsg({ err: (err as Error).message })
    }
  }

  return (
    <Shell>
      <h1 className="stencil">Kata sandi baru</h1>
      <form className="auth-form" onSubmit={submit}>
        <label className="field">
          <span>Kata sandi baru</span>
          <input name="password" type="password" required minLength={6} autoComplete="new-password" />
        </label>
        <label className="field">
          <span>Ulangi kata sandi</span>
          <input name="ulang" type="password" required minLength={6} autoComplete="new-password" />
        </label>
        <p className={msg.err ? 'field-error' : 'muted'} role="status" aria-live="polite">
          {msg.busy ? 'Menyimpan…' : (msg.err ?? '')}
        </p>
        <button className="btn btn-accent" type="submit" disabled={msg.busy}>
          Simpan kata sandi
        </button>
      </form>
    </Shell>
  )
}

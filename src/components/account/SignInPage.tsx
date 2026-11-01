'use client'

import { useState, type FormEvent, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { resetPassword, signIn, signOut, signUp, supabase, useCloud } from '@/lib/cloud'

type Mode = 'masuk' | 'daftar' | 'lupa'

// Hanya tujuan di dalam aplikasi ini (mulai "/" tapi bukan "//"), supaya parameter kembali tidak bisa dipakai mengalihkan ke situs lain.
function backTo() {
  const k = new URLSearchParams(location.search).get('kembali') ?? '/'
  return k.startsWith('/') && !k.startsWith('//') ? k : '/'
}

export function SignInPage() {
  const router = useRouter()
  const ready = useCloud((s) => s.ready)
  const email = useCloud((s) => s.session?.user.email)
  const [mode, setMode] = useState<Mode>('masuk')
  const [msg, setMsg] = useState<{ ok?: string; err?: string; busy?: boolean }>({})

  if (!supabase())
    return (
      <Shell>
        <h1 className="stencil">Akun belum tersedia</h1>
        <p>Layanan akun belum dikonfigurasi di server ini. Denahin tetap bisa dipakai tanpa akun; proyek tersimpan di browser.</p>
        <Link className="btn btn-accent btn-link" href="/">
          Ke daftar proyek
        </Link>
      </Shell>
    )

  if (!ready)
    return (
      <Shell>
        <p aria-busy="true">Memeriksa status akun…</p>
      </Shell>
    )

  if (email)
    return (
      <Shell>
        <h1 className="stencil">Akun</h1>
        <p>
          Masuk sebagai <strong>{email}</strong>.
        </p>
        {msg.err && (
          <p className="field-error" role="alert">
            {msg.err}
          </p>
        )}
        <div className="present-actions">
          <Link className="btn btn-accent btn-link" href={backTo()}>
            Lanjutkan
          </Link>
          <button className="btn" onClick={() => signOut().catch((e) => setMsg({ err: (e as Error).message }))}>
            Keluar
          </button>
        </div>
      </Shell>
    )

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const em = String(f.get('email')).trim()
    const pw = String(f.get('password') ?? '')
    setMsg({ busy: true })
    try {
      if (mode === 'masuk') {
        await signIn(em, pw)
        router.push(backTo())
      } else if (mode === 'daftar') {
        const { needsConfirm } = await signUp(em, pw)
        if (needsConfirm) setMsg({ ok: `Akun dibuat. Buka tautan konfirmasi yang dikirim ke ${em}, lalu kembali ke sini dan masuk.` })
        else router.push(backTo())
      } else {
        await resetPassword(em)
        // Pesan sama untuk email terdaftar maupun tidak, supaya halaman ini tidak bisa dipakai menebak akun orang lain.
        setMsg({ ok: `Kalau ${em} terdaftar, tautan untuk mengatur ulang kata sandi sudah dikirim. Periksa juga folder spam.` })
      }
    } catch (err) {
      setMsg({ err: (err as Error).message })
    }
  }

  const title = { masuk: 'Masuk', daftar: 'Daftar', lupa: 'Lupa kata sandi' }[mode]
  return (
    <Shell>
      <h1 className="stencil">{title}</h1>
      <p className="muted">
        {mode === 'lupa'
          ? 'Masukkan email akun Anda. Kami kirimkan tautan untuk membuat kata sandi baru.'
          : 'Akun dipakai untuk menyimpan proyek ke cloud dan membukanya di perangkat lain. Tanpa akun, Denahin tetap bisa dipakai.'}
      </p>
      {mode !== 'lupa' && (
        <div className="segmented" role="group" aria-label="Masuk atau daftar">
          {(['masuk', 'daftar'] as const).map((m) => (
            <button key={m} className="tool" aria-pressed={mode === m} onClick={() => (setMode(m), setMsg({}))}>
              {m === 'masuk' ? 'Masuk' : 'Daftar'}
            </button>
          ))}
        </div>
      )}
      <form className="auth-form" onSubmit={submit}>
        <label className="field">
          <span>Email</span>
          <input name="email" type="email" required autoComplete="email" placeholder="email@contoh.com" />
        </label>
        {mode !== 'lupa' && (
          <label className="field">
            <span>Kata sandi</span>
            <input name="password" type="password" required minLength={6} autoComplete={mode === 'masuk' ? 'current-password' : 'new-password'} />
          </label>
        )}
        <p className={msg.err ? 'field-error' : 'muted'} role="status" aria-live="polite">
          {msg.busy ? 'Menghubungi server…' : (msg.err ?? msg.ok ?? '')}
        </p>
        {mode === 'daftar' && (
          <p className="muted">
            Dengan membuat akun, Anda menyetujui <Link href="/syarat">Syarat Layanan</Link> dan <Link href="/privasi">Kebijakan Privasi</Link>.
          </p>
        )}
        <button className="btn btn-accent" type="submit" disabled={msg.busy}>
          {mode === 'masuk' ? 'Masuk' : mode === 'daftar' ? 'Buat akun' : 'Kirim tautan atur ulang'}
        </button>
      </form>
      {mode === 'masuk' && (
        <button className="link-btn" onClick={() => (setMode('lupa'), setMsg({}))}>
          Lupa kata sandi?
        </button>
      )}
      {mode === 'lupa' && (
        <button className="link-btn" onClick={() => (setMode('masuk'), setMsg({}))}>
          Kembali ke halaman masuk
        </button>
      )}
      <Link className="link-btn" href="/">
        Pakai tanpa akun
      </Link>
    </Shell>
  )
}

export function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="auth-page">
      <Link href="/" className="stencil auth-brand">
        Denahin
      </Link>
      <section className="auth-card">{children}</section>
    </main>
  )
}

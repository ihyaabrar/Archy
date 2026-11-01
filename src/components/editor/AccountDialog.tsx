'use client'

import { useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { signIn, signOut, signUp, supabase, useCloud } from '@/lib/cloud'

// Tombol akun di header. Tidak tampil kalau layanan cloud belum dikonfigurasi (env kosong).
export function AccountButton() {
  const ref = useRef<HTMLDialogElement>(null)
  const [opened, setOpened] = useState(0)
  const ready = useCloud((s) => s.ready)
  const email = useCloud((s) => s.session?.user.email)
  if (!supabase() || !ready) return null
  // Belum masuk: ke halaman login, lalu kembali ke halaman ini.
  if (!email)
    return (
      <Link className="tool btn-link" href={`/masuk?kembali=${encodeURIComponent(location.pathname)}`}>
        Masuk
      </Link>
    )
  return (
    <>
      <button
        className="tool"
        onClick={() => {
          setOpened((n) => n + 1)
          ref.current?.showModal()
        }}
        aria-haspopup="dialog"
      >
        {email ? 'Akun' : 'Masuk'}
      </button>
      <dialog ref={ref} className="projects account" aria-label="Akun" onClick={(e) => e.target === ref.current && ref.current.close()}>
        <AccountPanel key={opened} close={() => ref.current?.close()} />
      </dialog>
    </>
  )
}

function AccountPanel({ close }: { close: () => void }) {
  const email = useCloud((s) => s.session?.user.email)
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [msg, setMsg] = useState<{ ok?: string; err?: string; busy?: boolean }>({})

  if (email)
    return (
      <div className="projects-body">
        <div className="projects-head">
          <h2 className="stencil">Akun</h2>
          <button className="btn" onClick={close}>
            Tutup
          </button>
        </div>
        <p>
          Masuk sebagai <strong>{email}</strong>.
        </p>
        <p className="muted">Proyek yang ditautkan ke cloud diunggah otomatis setelah Anda berhenti mengedit sebentar. Atur di menu Proyek.</p>
        {msg.err && <p className="field-error" role="alert">{msg.err}</p>}
        <button
          className="btn"
          onClick={async () => {
            try {
              await signOut()
              close()
            } catch (e) {
              setMsg({ err: (e as Error).message })
            }
          }}
        >
          Keluar
        </button>
      </div>
    )

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const em = String(f.get('email')).trim()
    const pw = String(f.get('password'))
    setMsg({ busy: true })
    try {
      if (mode === 'in') {
        await signIn(em, pw)
        close()
      } else {
        const { needsConfirm } = await signUp(em, pw)
        if (needsConfirm) setMsg({ ok: `Akun dibuat. Buka tautan konfirmasi yang dikirim ke ${em}, lalu kembali ke sini dan masuk.` })
        else close()
      }
    } catch (err) {
      setMsg({ err: (err as Error).message })
    }
  }

  return (
    <form className="projects-body" onSubmit={submit}>
      <div className="projects-head">
        <h2 className="stencil">{mode === 'in' ? 'Masuk' : 'Daftar'}</h2>
        <button type="button" className="btn" onClick={close}>
          Tutup
        </button>
      </div>
      <p className="muted">Akun dipakai untuk menyimpan proyek ke cloud dan membukanya di perangkat lain. Tanpa akun, Denahin tetap bisa dipakai.</p>
      <label className="field">
        <span>Email</span>
        <input name="email" type="email" required autoComplete="email" placeholder="email@contoh.com" />
      </label>
      <label className="field">
        <span>Kata sandi</span>
        <input name="password" type="password" required minLength={6} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} />
      </label>
      <p className={msg.err ? 'field-error' : 'muted'} role="status" aria-live="polite">
        {msg.busy ? 'Menghubungi server…' : (msg.err ?? msg.ok ?? '')}
      </p>
      <button className="btn btn-accent" type="submit" disabled={msg.busy}>
        {mode === 'in' ? 'Masuk' : 'Buat akun'}
      </button>
      <button type="button" className="link-btn" onClick={() => (setMode(mode === 'in' ? 'up' : 'in'), setMsg({}))}>
        {mode === 'in' ? 'Belum punya akun? Daftar' : 'Sudah punya akun? Masuk'}
      </button>
    </form>
  )
}

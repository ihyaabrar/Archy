'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { Editor } from './Editor'
import { openProject, useProject } from '@/lib/store'

// Id khusus untuk denah yang dibuka dari tautan bagikan (isinya di hash URL, bukan di browser).
export const SHARED_ID = 'kiriman'

// Menyelaraskan alamat /proyek/[id] dengan proyek yang terbuka di store, dua arah:
// buka alamat = buka proyek itu; ganti proyek dari dialog (baru, impor, cloud) = alamat ikut berganti.
export function EditorRoute() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const status = useProject((s) => s.status)
  const shared = useProject((s) => s.shared)
  const currentId = useProject((s) => s.currentId)
  const exists = useProject((s) => s.projects.some((m) => m.id === id))
  const lastCurrent = useRef<string | null>(null)

  // Hanya bereaksi saat alamat berubah (bukan saat proyek berganti dari dialog), supaya keduanya tidak saling membalik.
  useEffect(() => {
    const s = useProject.getState()
    if (status !== 'ready' || s.shared || id === SHARED_ID || id === s.currentId || !exists) return
    openProject(id)
  }, [status, id, exists])

  useEffect(() => {
    const prev = lastCurrent.current
    lastCurrent.current = currentId
    // Pemuatan pertama (prev kosong) tidak boleh menimpa alamat yang sedang dibuka.
    if (!prev || shared || !currentId || currentId === prev || currentId === id) return
    router.replace(`/proyek/${currentId}`)
  }, [currentId, shared, id, router])

  // /proyek/kiriman tanpa denah kiriman (mis. setelah disimpan atau ditinggalkan): pindah ke proyek yang terbuka.
  useEffect(() => {
    if (status === 'ready' && id === SHARED_ID && !shared && currentId) router.replace(`/proyek/${currentId}`)
  }, [status, id, shared, currentId, router])

  if (status === 'ready' && !shared && id !== SHARED_ID && !exists)
    return (
      <main className="state-screen">
        <h1 className="stencil">Proyek tidak ditemukan</h1>
        <p>Proyek ini tidak ada di browser ini. Mungkin sudah dihapus, atau dibuat di perangkat atau browser lain.</p>
        <Link className="btn btn-accent btn-link" href="/">
          Ke daftar proyek
        </Link>
      </main>
    )

  // Tunggu sampai proyek di alamat ini yang terbuka, supaya editor tidak sempat menampilkan proyek lain.
  if (status === 'ready' && !shared && id !== SHARED_ID && currentId !== id)
    return (
      <main className="state-screen" aria-busy="true">
        <p>Membuka proyek…</p>
      </main>
    )

  return <Editor />
}

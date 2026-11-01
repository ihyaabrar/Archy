'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { addProject, deleteProject, discardStoredProject, newProject, readProject, useProject, type ProjectMeta } from '@/lib/store'
import { exportBackup, importProjectFile } from '@/lib/exporters'
import { planSheets } from '@/lib/drawing'
import { levelsOf, polygonArea } from '@/lib/project'
import { supabase } from '@/lib/cloud'
import { CloudSection } from '@/components/editor/ProjectsDialog'
import { SHARED_ID } from '@/components/editor/EditorRoute'
import { Hero } from './Hero'

const dateFmt = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' })

export function Dashboard() {
  const router = useRouter()
  const status = useProject((s) => s.status)
  const error = useProject((s) => s.error)
  const shared = useProject((s) => s.shared)
  const projects = useProject((s) => s.projects)
  const [q, setQ] = useState('')
  const [msg, setMsg] = useState<{ text: string; err?: boolean } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Tautan kiriman format lama (/#denah=...) dibuka di editor.
  useEffect(() => {
    if (shared) router.replace(`/proyek/${SHARED_ID}${location.hash}`)
  }, [shared, router])

  const list = useMemo(() => {
    const k = q.trim().toLowerCase()
    return [...projects].sort((a, b) => b.updatedAt - a.updatedAt).filter((m) => !k || m.name.toLowerCase().includes(k))
  }, [projects, q])

  const create = () => {
    const id = newProject(`Denah ${projects.length + 1}`)
    if (id) router.push(`/proyek/${id}`)
  }

  if (status === 'loading' || shared)
    return (
      <main className="state-screen" aria-busy="true">
        <p>Membuka daftar proyek…</p>
      </main>
    )

  if (status === 'error')
    return (
      <main className="state-screen">
        <h1 className="stencil">Daftar proyek tidak bisa dibaca</h1>
        <p>{error}. Data masih ada di browser dan belum dihapus.</p>
        <button className="btn btn-accent" onClick={() => confirm('Hapus data proyek yang rusak? Proyek yang masih utuh tetap aman.') && discardStoredProject()}>
          Hapus data yang rusak
        </button>
      </main>
    )

  return (
    <main className="dash sheet">
      <Hero projects={projects} onCreate={create} />

      <section className="dash-body" id="proyek" aria-labelledby="judul-proyek">
        <div className="dash-bar">
          <h2 id="judul-proyek" className="sheet-label">
            Lembar proyek di perangkat ini
          </h2>
          <label className="field dash-search">
            <span className="sr-only">Cari proyek</span>
            <input type="search" placeholder="Cari nama proyek" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <button className="btn btn-accent" onClick={create}>
            Denah baru
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            Impor file proyek
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (!f) return
              try {
                const items = await importProjectFile(f)
                // Memulihkan cadangan di browser yang sama: proyek yang isinya persis sama dilewati,
                // yang sudah berubah ditambahkan sebagai salinan (tidak menimpa versi di browser).
                let same = 0
                const ids = items.map(({ project, name, id }) => {
                  const local = id ? readProject(id) : null
                  if (local && JSON.stringify(local) === JSON.stringify(project)) return (same++, null)
                  return addProject(project, local ? `${name} (dari cadangan)` : name)
                })
                const added = ids.filter(Boolean)
                if (items.length === 1 && added[0]) router.push(`/proyek/${added[0]}`)
                else setMsg({ text: `${added.length} proyek ditambahkan${same ? `, ${same} sudah ada dan dilewati` : ''}.` })
              } catch (err) {
                setMsg({ text: (err as Error).message, err: true })
              }
            }}
          />
        </div>
        {msg && (
          <p className={msg.err ? 'field-error' : 'muted'} role={msg.err ? 'alert' : 'status'}>
            {msg.text}
          </p>
        )}

        {list.length === 0 ? (
          <p className="muted">Tidak ada proyek bernama “{q}”.</p>
        ) : (
          <ul className="dash-grid">
            {list.map((m) => (
              <ProjectCard key={m.id} meta={m} onDelete={() => confirm(`Hapus "${m.name}" dari browser ini? Tindakan ini tidak bisa diurungkan.`) && deleteProject(m.id)} />
            ))}
          </ul>
        )}
        <Backup projects={projects} onDone={setMsg} />
      </section>

      {supabase() && (
        <section className="dash-body">
          <CloudSection shared={false} canLink={false} close={() => router.push(`/proyek/${useProject.getState().currentId}`)} />
        </section>
      )}
      <footer className="dash-foot sheet-label">
        <Link href="/privasi">Privasi</Link>
        <span aria-hidden>|</span>
        <Link href="/syarat">Syarat</Link>
        <span aria-hidden>|</span>
        <Link href="/masuk">Akun</Link>
      </footer>
    </main>
  )
}

// Proyek hanya ada di browser ini sampai disimpan ke cloud atau diunduh: tawarkan cadangan dan tunjukkan sisa ruang.
function Backup({ projects, onDone }: { projects: ProjectMeta[]; onDone: (m: { text: string; err?: boolean }) => void }) {
  const used = storageUsed(projects)
  const LIMIT = 5 * 1024 * 1024 // batas umum localStorage di browser utama
  const nearFull = used > LIMIT * 0.8
  return (
    <div className="dash-backup">
      <p className={nearFull ? 'field-error' : 'muted'}>
        Proyek tersimpan di browser ini saja ({(used / 1024).toFixed(0)} KB dari sekitar 5 MB).{' '}
        {nearFull
          ? 'Penyimpanan hampir penuh: unduh cadangan, lalu hapus proyek yang tidak dipakai.'
          : 'Membersihkan data browser akan menghapusnya. Unduh cadangan secara berkala atau simpan ke cloud.'}
      </p>
      <button
        className="btn"
        onClick={() => {
          const items = projects.flatMap((m) => {
            const project = readProject(m.id)
            return project ? [{ project, name: m.name, id: m.id }] : []
          })
          exportBackup(items)
          const skipped = projects.length - items.length
          onDone({ text: `Cadangan ${items.length} proyek diunduh.${skipped ? ` ${skipped} proyek rusak dilewati.` : ''}` })
        }}
      >
        Unduh cadangan semua proyek
      </button>
    </div>
  )
}

// Perkiraan ruang yang dipakai proyek di localStorage (string disimpan 2 byte per karakter).
function storageUsed(projects: ProjectMeta[]) {
  try {
    const keys = ['denahin:projects', 'denahin:current', ...projects.map((m) => `denahin:p:${m.id}`)]
    return keys.reduce((s, k) => s + (k.length + (localStorage.getItem(k)?.length ?? 0)) * 2, 0)
  } catch {
    return 0
  }
}

function ProjectCard({ meta, onDelete }: { meta: ProjectMeta; onDelete: () => void }) {
  // Dibaca ulang hanya kalau proyek berubah (updatedAt), bukan setiap render.
  const info = useMemo(() => {
    const p = readProject(meta.id)
    if (!p) return null
    return {
      svg: planSheets(p, meta.name)[0]?.svg ?? null,
      levels: levelsOf(p).length,
      area: p.rooms.reduce((s, r) => s + polygonArea(r.points), 0),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta.id, meta.updatedAt, meta.name])

  return (
    <li className="dash-card">
      <Link href={`/proyek/${meta.id}`} className="dash-open">
        <span className="dash-thumb" aria-hidden>
          {/* Gambar denah dibuat sendiri oleh aplikasi dari data proyek (nama di-escape), bukan HTML dari luar. */}
          {info?.svg ? <span dangerouslySetInnerHTML={{ __html: info.svg }} /> : <span className="muted">{info ? 'Denah masih kosong' : 'Data proyek rusak'}</span>}
        </span>
        <span className="project-name">{meta.name}</span>
        <span className="muted">
          {info && `${info.levels} lantai, ${info.area.toFixed(1)} m². `}Diubah {dateFmt.format(meta.updatedAt)}
          {meta.cloudId && ', tertaut ke cloud'}
        </span>
      </Link>
      <button className="btn btn-danger dash-del" onClick={onDelete} aria-label={`Hapus ${meta.name}`}>
        Hapus
      </button>
    </li>
  )
}

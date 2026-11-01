'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { Guard3D } from '@/components/view3d/Guard3D'
import { decodeProject, SHARE_PREFIX } from '@/lib/share'
import { chapters, type Chapter } from '@/lib/presentation'
import { planSheets } from '@/lib/drawing'
import { finishOf, polygonArea, type Project } from '@/lib/project'
import { WALLS, DEFAULT_WALL } from '@/lib/materials'

const PresentationScene = dynamic(() => import('@/components/view3d/PresentationScene'), { ssr: false })

type State = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; project: Project; name: string; code: string }

// Tautan presentasi: /presentasi#nama=<nama>&denah=<kode>. Denah ada di hash, tidak pernah dikirim ke server.
function readHash(): Promise<{ project: Project; name: string; code: string }> {
  const params = new URLSearchParams(location.hash.slice(1))
  const code = params.get('denah')
  if (!code) return Promise.reject(new Error('Tautan ini tidak berisi denah.'))
  const name = (params.get('nama') ?? '').trim().slice(0, 60) || 'Denah'
  return decodeProject(code).then((project) => ({ project, name, code }))
}

export function Presentation() {
  const [state, setState] = useState<State>({ status: 'loading' })

  useEffect(() => {
    readHash()
      .then((r) => setState({ status: 'ready', ...r }))
      .catch((e) => {
        console.warn('Gagal membuka presentasi:', e)
        setState({ status: 'error', message: e instanceof Error && e.message.startsWith('Tautan ini') ? e.message : 'Isi tautan denah rusak atau tidak lengkap.' })
      })
  }, [])

  if (state.status === 'loading')
    return (
      <main className="state-screen" aria-busy="true">
        <p>Membuka presentasi denah…</p>
      </main>
    )
  if (state.status === 'error')
    return (
      <main className="state-screen">
        <h1 className="stencil">Presentasi tidak bisa dibuka</h1>
        <p>{state.message} Minta pengirim menyalin ulang tautan presentasinya dari Denahin.</p>
        <Link className="btn btn-accent btn-link" href="/">
          Buka Denahin
        </Link>
      </main>
    )
  if (!state.project.walls.length)
    return (
      <main className="state-screen">
        <h1 className="stencil">{state.name}</h1>
        <p>Denah ini belum punya dinding, jadi belum ada bangunan untuk dipresentasikan.</p>
        <Link className="btn btn-accent btn-link" href={`/proyek/kiriman${SHARE_PREFIX}${state.code}`}>
          Buka denah di editor
        </Link>
      </main>
    )
  return <Story project={state.project} name={state.name} code={state.code} />
}

function Story({ project, name, code }: { project: Project; name: string; code: string }) {
  const list = useMemo(() => chapters(project), [project])
  // Gambar pembuka: denah lantai terbawah.
  const plan = useMemo(() => planSheets(project, name)[0], [project, name])
  const progress = useRef(0)
  const rootRef = useRef<HTMLElement>(null)
  const reduce = useMemo(() => matchMedia('(prefers-reduced-motion: reduce)').matches, [])
  const total = project.rooms.reduce((s, r) => s + polygonArea(r.points), 0)

  useEffect(() => {
    document.title = `${name}, presentasi denah`
    // Progres = jumlah layar yang sudah digulir: 0 di bab pertama, 1 di bab kedua, dst.
    const onScroll = () => {
      progress.current = scrollY / innerHeight
      rootRef.current?.style.setProperty('--plan-fade', String(Math.max(0, 1 - progress.current * 1.6)))
    }
    onScroll()
    addEventListener('scroll', onScroll, { passive: true })
    addEventListener('resize', onScroll)
    return () => {
      removeEventListener('scroll', onScroll)
      removeEventListener('resize', onScroll)
    }
  }, [name])

  return (
    <main className="present" ref={rootRef}>
      <Guard3D>
        <PresentationScene project={project} progressRef={progress} reduce={reduce} />
      </Guard3D>
      {list.map((c, i) => (
        <section key={i} className={`present-step present-${c.kind}`} aria-labelledby={`bab-${i}`}>
          <ChapterCard c={c} i={i} name={name} total={total} roomCount={project.rooms.length} plan={plan?.svg} project={project} code={code} />
        </section>
      ))}
    </main>
  )
}

function ChapterCard({
  c,
  i,
  name,
  total,
  roomCount,
  plan,
  project,
  code,
}: {
  c: Chapter
  i: number
  name: string
  total: number
  roomCount: number
  plan?: string
  project: Project
  code: string
}) {
  const id = `bab-${i}`
  if (c.kind === 'intro')
    return (
      <div className="present-intro-inner">
        {/* Gambar denah 2D dari data sendiri (bukan input mentah pengguna); memudar saat bangunan mulai naik. */}
        {plan && <div className="present-plan" dangerouslySetInnerHTML={{ __html: plan }} aria-hidden />}
        <div className="present-card">
          <h1 id={id} className="stencil present-title">
            {name}
          </h1>
          <p>
            {roomCount ? `${roomCount} ruangan, luas lantai ${total.toFixed(1)} m².` : 'Denah tanpa ruangan bernama.'}
          </p>
          <p className="muted">Gulir untuk melihat denah ini berdiri dan berjalan masuk ke tiap ruangannya.</p>
        </div>
      </div>
    )
  if (c.kind === 'rise') {
    const maxH = Math.max(...project.walls.map((w) => w.height))
    return (
      <div className="present-card">
        <h2 id={id} className="stencil">
          Dari denah ke bangunan
        </h2>
        <dl className="facts">
          <dt>Tinggi dinding</dt>
          <dd>{maxH.toFixed(2)} m</dd>
          <dt>Dinding</dt>
          <dd>{[...new Set(project.walls.length ? project.walls.map((w) => finishOf(project, w)) : [project.wallFinish ?? DEFAULT_WALL])].map((f) => WALLS[f].label).join(', ')}</dd>
          <dt>Pintu dan jendela</dt>
          <dd>{project.openings.length}</dd>
        </dl>
      </div>
    )
  }
  if (c.kind === 'room')
    return (
      <div className="present-card">
        <h2 id={id} className="stencil">
          {c.room.name}
        </h2>
        {c.level && <p className="muted">{c.level}</p>}
        <dl className="facts">
          <dt>Luas</dt>
          <dd>{c.area.toFixed(1)} m²</dd>
          <dt>Lantai</dt>
          <dd>{c.floor}</dd>
        </dl>
        <p className="muted">{c.furniture.length ? `Furnitur: ${c.furniture.join(', ')}.` : 'Belum ada furnitur di ruangan ini.'}</p>
      </div>
    )
  return (
    <div className="present-card">
      <h2 id={id} className="stencil">
        {name}
      </h2>
      <p>
        {roomCount} ruangan, luas lantai {total.toFixed(1)} m².
      </p>
      <div className="present-actions">
        <Link className="btn btn-accent btn-link" href={`/proyek/kiriman${SHARE_PREFIX}${code}`}>
          Buka denah ini di editor
        </Link>
        <button className="btn" onClick={() => scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })}>
          Kembali ke awal
        </button>
      </div>
    </div>
  )
}

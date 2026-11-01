'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { readProject, type ProjectMeta } from '@/lib/store'
import { blueprintSvg } from '@/lib/drawing'
import { levelsOf, onLevel, polygonArea, type Project } from '@/lib/project'
import { AccountButton } from '@/components/editor/AccountDialog'

// Halaman depan bergaya lembar gambar kerja: judul besar di kiri, gambar denah proyek terakhir di kanan,
// lengkap dengan gelembung as, rantai ukuran, kepala gambar, batang skala, dan panah utara.
// Semua angka berasal dari proyek pengguna; tanpa proyek berdenah, sisi kanan menampilkan lembar kosong.
// Proyek terbaru yang sudah punya dinding.
function findLatest(projects: ProjectMeta[]) {
  for (const m of [...projects].sort((a, b) => b.updatedAt - a.updatedAt)) {
    const p = readProject(m.id)
    if (p?.walls.length) return { meta: m, project: p }
  }
  return null
}

export function Hero({ projects, onCreate }: { projects: ProjectMeta[]; onCreate: () => void }) {
  const latest = useMemo(() => findLatest(projects), [projects])

  const year = new Date().getFullYear()
  return (
    <section className="hero" aria-labelledby="judul-hero">
      <div className="hero-top">
        <p className="sheet-label">
          Denahin <span aria-hidden>·</span> {projects.length} proyek di perangkat ini <span aria-hidden>·</span> {year}
        </p>
        <div className="hero-actions">
          <AccountButton />
          <button className="pill" onClick={onCreate}>
            Denah baru
          </button>
        </div>
      </div>

      <div className="hero-grid">
        <div className="hero-copy">
          <h1 id="judul-hero" className="display">
            Dari denah
            <br />
            jadi <span className="accent">rumah.</span>
          </h1>
          <p className="hero-lede">
            Gambar denah di browser, lihat berdiri jadi bangunan 3D, lalu berjalan di dalamnya bersama klien.
            {latest && ` Terakhir dikerjakan: ${latest.meta.name}.`}
          </p>
          <div className="present-actions">
            {latest ? (
              <Link className="btn btn-accent btn-link" href={`/proyek/${latest.meta.id}`}>
                Lanjutkan {latest.meta.name}
              </Link>
            ) : (
              <button className="btn btn-accent" onClick={onCreate}>
                Gambar denah pertama
              </button>
            )}
            <a className="btn btn-link" href="#proyek">
              Semua proyek
            </a>
          </div>
          {latest && <TitleBlock meta={latest.meta} project={latest.project} />}
        </div>

        <div className="hero-sheet">{latest ? <Sheet meta={latest.meta} project={latest.project} /> : <EmptySheet onCreate={onCreate} />}</div>
      </div>

      <a className="sheet-label hero-scroll" href="#proyek">
        Gulir ke lembar proyek
      </a>
    </section>
  )
}

// Kotak kepala gambar seperti pojok lembar kerja: proyek, gambar, skala, jumlah lantai.
function TitleBlock({ meta, project }: { meta: ProjectMeta; project: Project }) {
  const levels = levelsOf(project)
  return (
    <dl className="title-block" aria-label="Kepala gambar">
      <div>
        <dt>Proyek</dt>
        <dd>{meta.name}</dd>
      </div>
      <div>
        <dt>Gambar</dt>
        <dd>Denah {levels[0].name}</dd>
      </div>
      <div>
        <dt>Skala</dt>
        <dd>1 : 100</dd>
      </div>
      <div>
        <dt>Lantai</dt>
        <dd>{levels.length}</dd>
      </div>
    </dl>
  )
}

function Sheet({ meta, project }: { meta: ProjectMeta; project: Project }) {
  const first = levelsOf(project)[0]
  const part = useMemo(() => onLevel(project, first.id), [project, first.id])
  const svg = useMemo(() => blueprintSvg(part), [part])
  const area = part.rooms.reduce((s, r) => s + polygonArea(r.points), 0)
  return (
    <>
      <div className="sheet-head">
        <div>
          <p className="sheet-title">Denah {first.name}</p>
          <p className="sheet-label sheet-meta">
            {meta.name} <span aria-hidden>·</span> {area.toFixed(1)} m² <span aria-hidden>·</span> {part.rooms.length} ruangan <span aria-hidden>·</span> 1:100
          </p>
          <ScaleBar />
        </div>
        <NorthArrow />
      </div>
      {/* Gambar dibuat aplikasi dari data proyek (nama ruangan di-escape), bukan HTML dari luar. */}
      {svg && <Link href={`/proyek/${meta.id}`} className="sheet-plan" aria-label={`Buka ${meta.name}`} dangerouslySetInnerHTML={{ __html: svg }} />}
    </>
  )
}

function EmptySheet({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="sheet-empty">
      <p className="sheet-title">Lembar masih kosong</p>
      <p className="muted">Denah pertama Anda akan tampil di sini sebagai lembar gambar, lengkap dengan as dan ukurannya.</p>
      <button className="pill" onClick={onCreate}>
        Mulai menggambar
      </button>
    </div>
  )
}

function ScaleBar() {
  return (
    <svg className="scale-bar" viewBox="0 0 120 18" aria-label="Batang skala 0 sampai 5 meter">
      {[0, 1, 2, 3, 4].map((i) => (
        <rect key={i} x={i * 24} y={2} width={24} height={5} fill={i % 2 ? 'var(--paper)' : 'var(--ink)'} stroke="var(--ink)" strokeWidth={0.8} />
      ))}
      <text x={0} y={17} fontSize={7} fill="var(--pencil)" fontFamily="var(--font-plex-mono)">
        0
      </text>
      <text x={120} y={17} fontSize={7} fill="var(--pencil)" fontFamily="var(--font-plex-mono)" textAnchor="end">
        5 m
      </text>
    </svg>
  )
}

// Utara denah = atas layar (sama dengan arah matahari di tampilan 3D).
function NorthArrow() {
  return (
    <svg className="north" viewBox="0 0 40 52" aria-label="Arah utara ke atas">
      <text x={20} y={9} textAnchor="middle" fontSize={8} fill="var(--ink)" fontFamily="var(--font-plex-mono)">
        U
      </text>
      <circle cx={20} cy={32} r={16} fill="none" stroke="var(--ink)" strokeWidth={1} />
      <path d="M20 14 L28 42 L20 36 L12 42 Z" fill="var(--paper)" stroke="var(--ink)" strokeWidth={1} />
      <path d="M20 14 L20 36 L12 42 Z" fill="var(--ink)" />
    </svg>
  )
}

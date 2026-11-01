'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { addProject, readProject, type ProjectMeta } from '@/lib/store'
import { useRouter } from 'next/navigation'
import { SAMPLE, SAMPLE_NAME, SAMPLE_SITE } from '@/lib/sample'
import { blueprintSvg } from '@/lib/drawing'
import { polygonArea } from '@/lib/project'
import { AccountButton } from '@/components/editor/AccountDialog'

// Halaman depan bergaya lembar gambar kerja: judul besar di kiri, gambar denah rumah contoh di kanan,
// lengkap dengan gelembung as, rantai ukuran, kepala gambar, batang skala, dan panah utara.
// Gambar di kanan selalu rumah contoh yang sama (lib/sample.ts), bukan proyek terakhir, supaya halaman depan tetap.
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
          <TitleBlock />
        </div>

        <div className="hero-sheet">
          <Sheet />
        </div>
      </div>

      <a className="sheet-label hero-scroll" href="#proyek">
        Gulir ke lembar proyek
      </a>
    </section>
  )
}

// Kotak kepala gambar seperti pojok lembar kerja, untuk rumah contoh.
function TitleBlock() {
  return (
    <dl className="title-block" aria-label="Kepala gambar">
      <div>
        <dt>Proyek</dt>
        <dd>{SAMPLE_NAME}</dd>
      </div>
      <div>
        <dt>Gambar</dt>
        <dd>Denah Lantai 1</dd>
      </div>
      <div>
        <dt>Skala</dt>
        <dd>1 : 100</dd>
      </div>
      <div>
        <dt>Pintu / jendela</dt>
        <dd>
          {SAMPLE.openings.filter((o) => o.kind === 'door').length} / {SAMPLE.openings.filter((o) => o.kind === 'window').length}
        </dd>
      </div>
    </dl>
  )
}

function Sheet() {
  const router = useRouter()
  const svg = useMemo(() => blueprintSvg(SAMPLE, SAMPLE_SITE), [])
  const inside = SAMPLE.rooms.filter((r) => r.name !== 'Teras' && r.name !== 'Carport')
  const area = inside.reduce((s, r) => s + polygonArea(r.points), 0)
  // Contoh dibuka sebagai proyek baru milik pengguna; lembar di halaman depan tidak ikut berubah.
  const open = () => {
    const id = addProject(structuredClone(SAMPLE), SAMPLE_NAME)
    if (id) router.push(`/proyek/${id}`)
  }
  return (
    <>
      <div className="sheet-head">
        <div>
          <p className="sheet-title">Denah Lantai 1</p>
          <p className="sheet-label sheet-meta">
            {SAMPLE_NAME} <span aria-hidden>·</span> {area.toFixed(1)} m² <span aria-hidden>·</span> {inside.length} ruangan <span aria-hidden>·</span> 1:100
          </p>
          <ScaleBar />
        </div>
        <NorthArrow />
      </div>
      {/* Gambar dibuat aplikasi dari data contoh tetap, bukan HTML dari luar. */}
      {svg && <div className="sheet-plan" dangerouslySetInnerHTML={{ __html: svg }} />}
      <button className="sheet-label hero-sample" onClick={open}>
        Buka contoh ini di editor
      </button>
    </>
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

'use client'

import { useEffect, useState } from 'react'
import { PlanCanvas, type Selection, type Tool, type View } from './PlanCanvas'
import { Building } from './Building'
import { ProjectsButton } from './ProjectsDialog'
import { QuantitiesButton } from './QuantitiesDialog'
import { DrawingsButton } from './DrawingsDialog'
import { AccountButton } from './AccountDialog'
import Link from 'next/link'
import { adoptShared, discardStoredProject, leaveShared, useProject } from '@/lib/store'
import { FIRST_LEVEL, addLevel, levelsOf, uid, type Point } from '@/lib/project'
import { type FurnitureKind } from '@/lib/furniture'
import { Inspector, FurniturePicker } from './Inspector'
import { turn, duplicateSelected, rotateFurniture, removeSelected } from './editActions'

const TOOLS: { id: Tool; label: string; key: string; hint: string }[] = [
  { id: 'select', label: 'Pilih', key: 'V', hint: 'Klik elemen untuk mengubahnya. Seret area kosong untuk menggeser kanvas. Keyboard: Tab ke kanvas, [ dan ] memilih, panah menggeser.' },
  { id: 'wall', label: 'Dinding', key: 'W', hint: 'Klik titik awal, lalu klik titik berikutnya. Sudut terkunci 45°, tahan Alt untuk bebas. Esc atau klik kanan untuk berhenti. Keyboard: panah lalu Enter.' },
  { id: 'door', label: 'Pintu', key: 'D', hint: 'Klik pada dinding untuk memasang pintu 0,90 m.' },
  { id: 'window', label: 'Jendela', key: 'J', hint: 'Klik pada dinding untuk memasang jendela 1,20 m.' },
  { id: 'room', label: 'Ruangan', key: 'R', hint: 'Klik sudut-sudut ruangan. Klik titik pertama, klik ganda, atau Enter untuk menutup.' },
  { id: 'furniture', label: 'Furnitur', key: 'F', hint: 'Pilih jenis di panel kanan, lalu klik di denah untuk menaruh. Q dan E memutar 90°. Geser dengan alat Pilih.' },
  { id: 'text', label: 'Teks', key: 'T', hint: 'Klik di denah untuk menaruh catatan, lalu ubah isinya di panel kanan.' },
  { id: 'measure', label: 'Ukur', key: 'M', hint: 'Klik titik awal lalu titik akhir. Titik menempel ke ujung dinding. Garis ukur ikut tercetak.' },
]

export function Editor() {
  const [mode, setMode] = useState<'2d' | '3d'>('2d')
  const status = useProject((s) => s.status)
  const error = useProject((s) => s.error)
  const shared = useProject((s) => s.shared)
  const [tool, setToolState] = useState<Tool>('wall')
  const [selection, setSelection] = useState<Selection>(null)
  const [draft, setDraft] = useState<Point[]>([])
  const [view, setView] = useState<View>({ tx: 80, ty: 80, s: 50 })
  const [furnitureKind, setFurnitureKind] = useState<FurnitureKind>('bed2')
  const [placeRot, setPlaceRot] = useState(0)
  // Lantai aktif. Kalau lantainya dihapus atau pindah proyek, kembali ke lantai pertama.
  const rawLevels = useProject((s) => s.project.levels)
  const levels = levelsOf({ levels: rawLevels })
  const [levelPick, setLevelPick] = useState(FIRST_LEVEL.id)
  const level = levels.some((l) => l.id === levelPick) ? levelPick : levels[0].id

  const setTool = (t: Tool) => {
    setToolState(t)
    setDraft([])
    if (t !== 'select') setSelection(null)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || document.querySelector('dialog[open]')) return
      const { undo, redo, apply } = useProject.getState()
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
        setSelection(null)
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        redo()
        setSelection(null)
      } else if (mod && e.key.toLowerCase() === 'd' && selection && selection.kind !== 'opening') {
        e.preventDefault() // jangan biarkan browser membuat bookmark
        duplicateSelected(selection, setSelection)
      } else if (e.key === 'Escape') {
        setDraft([])
        setSelection(null)
      } else if (e.key === 'Enter' && tool === 'room' && draft.length >= 3) {
        apply((p) => ({ ...p, rooms: [...p.rooms, { id: uid(), name: `Ruang ${p.rooms.length + 1}`, points: draft, level }] }))
        setDraft([])
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selection) {
        e.preventDefault()
        apply((p) => removeSelected(p, selection))
        setSelection(null)
      } else if (!mod && !e.altKey && mode === '2d' && (e.key === 'q' || e.key === 'e')) {
        const by = e.key === 'e' ? 90 : -90
        if (selection?.kind === 'furniture') rotateFurniture(selection.id, by)
        else if (tool === 'furniture') setPlaceRot((r) => turn(r, by))
      } else if (!mod && !e.altKey && mode === '2d') {
        const t = TOOLS.find((x) => x.key.toLowerCase() === e.key.toLowerCase())
        if (t) setTool(t.id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tool, draft, selection, mode, level])

  const switchMode = (m: '2d' | '3d') => {
    setMode(m)
    setDraft([])
    setSelection(null)
  }

  const zoom = (f: number) =>
    setView((v) => {
      const s = Math.min(400, Math.max(8, v.s * f))
      const cx = window.innerWidth / 2
      const cy = window.innerHeight / 2
      return { s, tx: cx - ((cx - v.tx) * s) / v.s, ty: cy - ((cy - v.ty) * s) / v.s }
    })

  if (status === 'loading') {
    return (
      <main className="state-screen" aria-busy="true">
        <p>Membuka denah yang tersimpan di browser ini…</p>
      </main>
    )
  }

  if (status === 'error' && error) {
    return (
      <main className="state-screen">
        <h1 className="stencil">{shared ? 'Tautan denah tidak bisa dibuka' : 'Denah tersimpan tidak bisa dibuka'}</h1>
        <p>
          {error}.{' '}
          {shared
            ? 'Tautannya mungkin terpotong saat disalin. Minta pengirim menyalin ulang.'
            : 'Data proyek ini masih ada di browser dan belum dihapus. Proyek lain tidak terpengaruh.'}
        </p>
        {shared ? (
          <button className="btn btn-accent" onClick={leaveShared}>
            Buka denah saya
          </button>
        ) : (
        <button
          className="btn btn-accent"
          onClick={() => confirm('Hapus isi proyek yang rusak ini? Proyek lain tetap aman.') && discardStoredProject()}
        >
          Hapus proyek yang rusak
        </button>
        )}
      </main>
    )
  }

  const activeHint = TOOLS.find((t) => t.id === tool)!.hint

  return (
    <main className="editor">
      <header className="editor-head">
        <h1 className="stencil">
          <Link href="/" className="brand-link" title="Kembali ke daftar proyek">
            Denahin
          </Link>
        </h1>
        <ProjectsButton />
        <QuantitiesButton />
        <DrawingsButton />
        <LevelBar level={level} setLevel={(id) => (setLevelPick(id), setSelection(null), setDraft([]))} />
        <AccountButton />
        <div className="mode-switch" role="group" aria-label="Tampilan">
          <button className="tool" aria-pressed={mode === '2d'} onClick={() => switchMode('2d')}>
            Denah 2D
          </button>
          <button className="tool" aria-pressed={mode === '3d'} onClick={() => switchMode('3d')}>
            Bangunan 3D
          </button>
        </div>
      </header>

      <nav className="toolbar" aria-label="Alat gambar">
        {mode === '2d' && TOOLS.map((t) => (
          <button key={t.id} className="tool" aria-pressed={tool === t.id} onClick={() => setTool(t.id)} title={`${t.label} (${t.key})`}>
            {t.label}
            <kbd>{t.key}</kbd>
          </button>
        ))}
        {mode === '2d' && <span className="toolbar-sep" />}
        <UndoRedo onChange={() => setSelection(null)} />
      </nav>

      {shared && (
        <div className="shared-banner" role="status">
          <p>Ini denah kiriman lewat tautan. Perubahan tidak disimpan.</p>
          <button className="btn" onClick={adoptShared}>
            Simpan sebagai proyek baru
          </button>
          <button className="btn" onClick={leaveShared}>
            Buka denah saya
          </button>
        </div>
      )}

      {mode === '3d' ? (
        <Building level={level} onLevel={setLevelPick} />
      ) : (
        <>
      <section className="canvas-wrap" aria-label="Lembar denah">
        <PlanCanvas
          tool={tool}
          view={view}
          setView={setView}
          selection={selection}
          setSelection={setSelection}
          draft={draft}
          setDraft={setDraft}
          furnitureKind={furnitureKind}
          placeRot={placeRot}
          level={level}
        />
        <EmptyHint />
        {error && <p className="save-error" role="alert">{error}</p>}
        <div className="zoom" role="group" aria-label="Perbesar">
          <button className="btn" onClick={() => zoom(1.25)} aria-label="Perbesar">+</button>
          <span className="dim-text">1 m = {Math.round(view.s)} px</span>
          <button className="btn" onClick={() => zoom(0.8)} aria-label="Perkecil">−</button>
        </div>
        <p className="hint" aria-live="polite">{activeHint}</p>
      </section>

      {tool === 'furniture' && !selection ? (
        <FurniturePicker kind={furnitureKind} setKind={setFurnitureKind} rot={placeRot} setRot={setPlaceRot} />
      ) : (
        <Inspector selection={selection} onDelete={() => setSelection(null)} onSelect={setSelection} level={level} />
      )}
        </>
      )}
    </main>
  )
}

function UndoRedo({ onChange }: { onChange: () => void }) {
  const canUndo = useProject((s) => s.past.length > 0)
  const canRedo = useProject((s) => s.future.length > 0)
  return (
    <>
      <button className="tool" disabled={!canUndo} onClick={() => (useProject.getState().undo(), onChange())} title="Urungkan (Ctrl+Z)">
        Urungkan
      </button>
      <button className="tool" disabled={!canRedo} onClick={() => (useProject.getState().redo(), onChange())} title="Ulangi (Ctrl+Shift+Z)">
        Ulangi
      </button>
    </>
  )
}

function EmptyHint() {
  const empty = useProject((s) => s.project.walls.length === 0 && s.project.rooms.length === 0)
  if (!empty) return null
  return (
    <div className="empty-hint">
      <p className="stencil">Lembar masih kosong</p>
      <p>Pilih Dinding (W), klik titik awal, lalu klik titik akhir. Setiap klik berikutnya menyambung dinding baru.</p>
    </div>
  )
}

// Pemilih lantai: satu tombol per lantai (urut dari bawah) dan tombol tambah lantai.
function LevelBar({ level, setLevel }: { level: string; setLevel: (id: string) => void }) {
  const raw = useProject((s) => s.project.levels)
  const levels = [...levelsOf({ levels: raw })].sort((a, b) => a.elevation - b.elevation)
  return (
    <div className="level-bar" role="group" aria-label="Lantai">
      {levels.map((l) => (
        <button key={l.id} className="tool" aria-pressed={l.id === level} onClick={() => setLevel(l.id)}>
          {l.name}
        </button>
      ))}
      <button
        className="tool"
        onClick={() => {
          let id = ''
          useProject.getState().apply((p) => {
            const r = addLevel(p)
            id = r.id
            return r.project
          })
          if (id) setLevel(id)
        }}
        title="Tambah lantai di atas lantai teratas"
      >
        + Lantai
      </button>
    </div>
  )
}


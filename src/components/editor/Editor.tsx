'use client'

import { useEffect, useState } from 'react'
import { PlanCanvas, type Selection, type Tool, type View } from './PlanCanvas'
import { discardStoredProject, startPersistence, useProject } from '@/lib/store'
import { polygonArea, uid, wallLength, type Point } from '@/lib/project'

const TOOLS: { id: Tool; label: string; key: string; hint: string }[] = [
  { id: 'select', label: 'Pilih', key: 'V', hint: 'Klik elemen untuk mengubahnya. Seret area kosong untuk menggeser kanvas.' },
  { id: 'wall', label: 'Dinding', key: 'W', hint: 'Klik titik awal, lalu klik titik berikutnya. Sudut terkunci 45°, tahan Alt untuk bebas. Esc atau klik kanan untuk berhenti.' },
  { id: 'door', label: 'Pintu', key: 'D', hint: 'Klik pada dinding untuk memasang pintu 0,90 m.' },
  { id: 'window', label: 'Jendela', key: 'J', hint: 'Klik pada dinding untuk memasang jendela 1,20 m.' },
  { id: 'room', label: 'Ruangan', key: 'R', hint: 'Klik sudut-sudut ruangan. Klik titik pertama, klik ganda, atau Enter untuk menutup.' },
]

export function Editor() {
  const status = useProject((s) => s.status)
  const error = useProject((s) => s.error)
  const [tool, setToolState] = useState<Tool>('wall')
  const [selection, setSelection] = useState<Selection>(null)
  const [draft, setDraft] = useState<Point[]>([])
  const [view, setView] = useState<View>({ tx: 80, ty: 80, s: 50 })

  useEffect(() => startPersistence(), [])

  const setTool = (t: Tool) => {
    setToolState(t)
    setDraft([])
    if (t !== 'select') setSelection(null)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
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
      } else if (e.key === 'Escape') {
        setDraft([])
        setSelection(null)
      } else if (e.key === 'Enter' && tool === 'room' && draft.length >= 3) {
        apply((p) => ({ ...p, rooms: [...p.rooms, { id: uid(), name: `Ruang ${p.rooms.length + 1}`, points: draft }] }))
        setDraft([])
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selection) {
        e.preventDefault()
        apply((p) => removeSelected(p, selection))
        setSelection(null)
      } else if (!mod && !e.altKey) {
        const t = TOOLS.find((x) => x.key.toLowerCase() === e.key.toLowerCase())
        if (t) setTool(t.id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tool, draft, selection])

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
        <h1 className="stencil">Denah tersimpan tidak bisa dibuka</h1>
        <p>{error}. Data lama masih ada di browser dan belum dihapus.</p>
        <button
          className="btn btn-accent"
          onClick={() => confirm('Hapus denah yang rusak dan mulai denah baru?') && discardStoredProject()}
        >
          Hapus data rusak dan mulai baru
        </button>
      </main>
    )
  }

  const activeHint = TOOLS.find((t) => t.id === tool)!.hint

  return (
    <main className="editor">
      <header className="editor-head">
        <h1 className="stencil">Denahin</h1>
        <p className="head-note">Denah tersimpan otomatis di browser ini</p>
      </header>

      <nav className="toolbar" aria-label="Alat gambar">
        {TOOLS.map((t) => (
          <button key={t.id} className="tool" aria-pressed={tool === t.id} onClick={() => setTool(t.id)} title={`${t.label} (${t.key})`}>
            {t.label}
            <kbd>{t.key}</kbd>
          </button>
        ))}
        <span className="toolbar-sep" />
        <UndoRedo onChange={() => setSelection(null)} />
      </nav>

      <section className="canvas-wrap" aria-label="Lembar denah">
        <PlanCanvas tool={tool} view={view} setView={setView} selection={selection} setSelection={setSelection} draft={draft} setDraft={setDraft} />
        <EmptyHint />
        {error && <p className="save-error" role="alert">{error}</p>}
        <div className="zoom" role="group" aria-label="Perbesar">
          <button className="btn" onClick={() => zoom(1.25)} aria-label="Perbesar">+</button>
          <span className="dim-text">1 m = {Math.round(view.s)} px</span>
          <button className="btn" onClick={() => zoom(0.8)} aria-label="Perkecil">−</button>
        </div>
        <p className="hint" aria-live="polite">{activeHint}</p>
      </section>

      <Inspector selection={selection} onDelete={() => setSelection(null)} />
    </main>
  )
}

function removeSelected(p: ReturnType<typeof useProject.getState>['project'], sel: NonNullable<Selection>) {
  if (sel.kind === 'wall')
    return { ...p, walls: p.walls.filter((w) => w.id !== sel.id), openings: p.openings.filter((o) => o.wallId !== sel.id) }
  if (sel.kind === 'opening') return { ...p, openings: p.openings.filter((o) => o.id !== sel.id) }
  return { ...p, rooms: p.rooms.filter((r) => r.id !== sel.id) }
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

function Inspector({ selection, onDelete }: { selection: Selection; onDelete: () => void }) {
  const project = useProject((s) => s.project)
  const apply = useProject((s) => s.apply)

  if (!selection) {
    return (
      <aside className="inspector" aria-label="Properti">
        <h2 className="stencil">Lembar</h2>
        <dl className="facts">
          <dt>Dinding</dt>
          <dd>{project.walls.length}</dd>
          <dt>Bukaan</dt>
          <dd>{project.openings.length}</dd>
          <dt>Ruangan</dt>
          <dd>{project.rooms.length}</dd>
        </dl>
        <p className="muted">Pilih elemen dengan alat Pilih (V) untuk mengubah ukurannya.</p>
      </aside>
    )
  }

  const del = (
    <button
      className="btn btn-danger"
      onClick={() => {
        apply((p) => removeSelected(p, selection))
        onDelete()
      }}
    >
      Hapus elemen
    </button>
  )

  if (selection.kind === 'wall') {
    const w = project.walls.find((x) => x.id === selection.id)
    if (!w) return null
    const set = (patch: Partial<typeof w>) => apply((p) => ({ ...p, walls: p.walls.map((x) => (x.id === w.id ? { ...x, ...patch } : x)) }))
    return (
      <aside className="inspector" aria-label="Properti dinding">
        <h2 className="stencil">Dinding</h2>
        <p className="muted">Panjang {wallLength(w).toFixed(2)} m</p>
        <NumberField label="Tebal (m)" value={w.thickness} min={0.05} max={1} onCommit={(v) => set({ thickness: v })} />
        <NumberField label="Tinggi (m)" value={w.height} min={1} max={10} onCommit={(v) => set({ height: v })} />
        {del}
      </aside>
    )
  }

  if (selection.kind === 'opening') {
    const o = project.openings.find((x) => x.id === selection.id)
    const w = o && project.walls.find((x) => x.id === o.wallId)
    if (!o || !w) return null
    const set = (patch: Partial<typeof o>) => apply((p) => ({ ...p, openings: p.openings.map((x) => (x.id === o.id ? { ...x, ...patch } : x)) }))
    return (
      <aside className="inspector" aria-label={o.kind === 'door' ? 'Properti pintu' : 'Properti jendela'}>
        <h2 className="stencil">{o.kind === 'door' ? 'Pintu' : 'Jendela'}</h2>
        <NumberField label="Lebar (m)" value={o.width} min={0.4} max={Math.max(0.4, wallLength(w))} onCommit={(v) => set({ width: v, at: Math.min(Math.max(o.at, v / 2), wallLength(w) - v / 2) })} />
        <NumberField label="Tinggi (m)" value={o.height} min={0.3} max={w.height} onCommit={(v) => set({ height: v })} />
        {o.kind === 'window' && <NumberField label="Tinggi ambang (m)" value={o.sill} min={0} max={w.height - o.height} onCommit={(v) => set({ sill: v })} />}
        {del}
      </aside>
    )
  }

  const r = project.rooms.find((x) => x.id === selection.id)
  if (!r) return null
  return (
    <aside className="inspector" aria-label="Properti ruangan">
      <h2 className="stencil">Ruangan</h2>
      <label className="field">
        <span>Nama</span>
        <input
          key={r.id}
          defaultValue={r.name}
          maxLength={40}
          onBlur={(e) => {
            const name = e.target.value.trim() || r.name
            if (name !== r.name) apply((p) => ({ ...p, rooms: p.rooms.map((x) => (x.id === r.id ? { ...x, name } : x)) }))
          }}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        />
      </label>
      <p className="muted">Luas {polygonArea(r.points).toFixed(1)} m²</p>
      {del}
    </aside>
  )
}

// Nilai diterapkan saat fokus lepas atau Enter, supaya mengetik tidak membanjiri riwayat undo.
function NumberField({ label, value, min, max, onCommit }: { label: string; value: number; min: number; max: number; onCommit: (v: number) => void }) {
  const [text, setText] = useState(String(value))
  const [seen, setSeen] = useState(value)
  if (seen !== value) {
    setSeen(value)
    setText(String(value))
  }
  const n = Number(text.replace(',', '.'))
  const invalid = !Number.isFinite(n) || n < min || n > max
  const commit = () => {
    if (!invalid && n !== value) onCommit(n)
    else if (invalid) setText(String(value))
  }
  return (
    <label className="field">
      <span>{label}</span>
      <input
        inputMode="decimal"
        value={text}
        aria-invalid={invalid}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      />
      {invalid && <small className="field-error">Isi angka {min} sampai {max.toFixed(2)}</small>}
    </label>
  )
}

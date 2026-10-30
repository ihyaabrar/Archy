'use client'

import { useEffect, useState } from 'react'
import { PlanCanvas, type Selection, type Tool, type View } from './PlanCanvas'
import { Building } from './Building'
import { NumberField } from './NumberField'
import { ProjectsButton } from './ProjectsDialog'
import { QuantitiesButton } from './QuantitiesDialog'
import { AccountButton } from './AccountDialog'
import { startCloudSync } from '@/lib/cloud'
import { adoptShared, discardStoredProject, leaveShared, startPersistence, useProject } from '@/lib/store'
import { FIRST_LEVEL, addLevel, levelsOf, onLevel, polygonArea, removeLevel, uid, wallLength, type Point } from '@/lib/project'
import { CATALOG, GROUPS, dims, type FurnitureKind } from '@/lib/furniture'
import { DEFAULT_FLOOR, DEFAULT_WALL, FLOORS, WALLS, type FloorKey, type WallKey } from '@/lib/materials'

function rotateFurniture(id: string, by: number) {
  useProject.getState().apply((p) => ({ ...p, furniture: p.furniture.map((f) => (f.id === id ? { ...f, rot: turn(f.rot, by) } : f)) }))
}

const TOOLS: { id: Tool; label: string; key: string; hint: string }[] = [
  { id: 'select', label: 'Pilih', key: 'V', hint: 'Klik elemen untuk mengubahnya. Seret area kosong untuk menggeser kanvas.' },
  { id: 'wall', label: 'Dinding', key: 'W', hint: 'Klik titik awal, lalu klik titik berikutnya. Sudut terkunci 45°, tahan Alt untuk bebas. Esc atau klik kanan untuk berhenti.' },
  { id: 'door', label: 'Pintu', key: 'D', hint: 'Klik pada dinding untuk memasang pintu 0,90 m.' },
  { id: 'window', label: 'Jendela', key: 'J', hint: 'Klik pada dinding untuk memasang jendela 1,20 m.' },
  { id: 'room', label: 'Ruangan', key: 'R', hint: 'Klik sudut-sudut ruangan. Klik titik pertama, klik ganda, atau Enter untuk menutup.' },
  { id: 'furniture', label: 'Furnitur', key: 'F', hint: 'Pilih jenis di panel kanan, lalu klik di denah untuk menaruh. Q dan E memutar 90°. Geser dengan alat Pilih.' },
]

// Putar furnitur terpilih, atau arah taruh berikutnya kalau belum ada yang dipilih.
const turn = (rot: number, by: number) => (((rot + by) % 360) + 360) % 360

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

  useEffect(() => startPersistence(), [])
  useEffect(() => startCloudSync(), [])

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
        <h1 className="stencil">Denahin</h1>
        <ProjectsButton />
        <QuantitiesButton />
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
        <Building level={level} />
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
        <Inspector selection={selection} onDelete={() => setSelection(null)} level={level} />
      )}
        </>
      )}
    </main>
  )
}

function removeSelected(p: ReturnType<typeof useProject.getState>['project'], sel: NonNullable<Selection>) {
  if (sel.kind === 'wall')
    return { ...p, walls: p.walls.filter((w) => w.id !== sel.id), openings: p.openings.filter((o) => o.wallId !== sel.id) }
  if (sel.kind === 'opening') return { ...p, openings: p.openings.filter((o) => o.id !== sel.id) }
  if (sel.kind === 'furniture') return { ...p, furniture: p.furniture.filter((f) => f.id !== sel.id) }
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

function LevelSettings({ level }: { level: string }) {
  const project = useProject((s) => s.project)
  const apply = useProject((s) => s.apply)
  const levels = levelsOf(project)
  const l = levels.find((x) => x.id === level)!
  // Lantai pertama implisit disimpan sebagai daftar saat pertama kali diubah.
  const set = (patch: Partial<typeof l>) => apply((p) => ({ ...p, levels: levelsOf(p).map((x) => (x.id === l.id ? { ...x, ...patch } : x)) }))
  const count = onLevel(project, level)
  return (
    <fieldset className="picker">
      <legend>Lantai aktif</legend>
      <label className="field">
        <span>Nama lantai</span>
        <input
          key={l.id}
          defaultValue={l.name}
          maxLength={30}
          onBlur={(e) => {
            const v = e.target.value.trim()
            if (v && v !== l.name) set({ name: v })
          }}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        />
      </label>
      <NumberField label="Elevasi dari tanah (m)" value={l.elevation} min={-10} max={200} onCommit={(v) => set({ elevation: v })} />
      {levels.length > 1 && (
        <button
          className="btn btn-danger"
          onClick={() => {
            const isi = count.walls.length + count.rooms.length + count.furniture.length
            if (!isi || confirm(`Hapus "${l.name}" beserta ${isi} elemen di dalamnya?`)) apply((p) => removeLevel(p, l.id))
          }}
        >
          Hapus lantai ini
        </button>
      )}
    </fieldset>
  )
}

// Pilihan material: kotak warna + nama, satu tombol per pilihan (bukan dropdown) supaya terlihat sekaligus.
function Swatches({ legend, options, value, onPick }: { legend: string; options: { key: string; label: string; color: string }[]; value: string; onPick: (k: string) => void }) {
  return (
    <fieldset className="picker">
      <legend>{legend}</legend>
      {options.map((o) => (
        <button key={o.key} className="tool picker-item" aria-pressed={o.key === value} onClick={() => o.key !== value && onPick(o.key)}>
          <span className="swatch-row">
            <span className="swatch" style={{ background: o.color }} aria-hidden />
            {o.label}
          </span>
        </button>
      ))}
    </fieldset>
  )
}

function FurniturePicker({ kind, setKind, rot, setRot }: { kind: FurnitureKind; setKind: (k: FurnitureKind) => void; rot: number; setRot: (r: number) => void }) {
  return (
    <aside className="inspector" aria-label="Pilih furnitur">
      <h2 className="stencil">Furnitur</h2>
      {Object.entries(GROUPS).map(([group, kinds]) => (
        <fieldset key={group} className="picker">
          <legend>{group}</legend>
          {kinds.map((k) => (
            <button key={k} className="tool picker-item" aria-pressed={k === kind} onClick={() => setKind(k)}>
              {CATALOG[k].label}
              <span className="dim-text">
                {CATALOG[k].w.toFixed(1)}×{CATALOG[k].d.toFixed(1)}
              </span>
            </button>
          ))}
        </fieldset>
      ))}
      <div className="tour-buttons">
        <button className="btn" onClick={() => setRot(turn(rot, -90))} title="Q">
          Putar kiri
        </button>
        <button className="btn" onClick={() => setRot(turn(rot, 90))} title="E">
          Putar kanan
        </button>
      </div>
      <p className="muted">Arah taruh {rot}°. Klik di denah untuk menaruh.</p>
    </aside>
  )
}

function Inspector({ selection, onDelete, level }: { selection: Selection; onDelete: () => void; level: string }) {
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
          <dt>Furnitur</dt>
          <dd>{project.furniture.length}</dd>
        </dl>
        <p className="muted">Pilih elemen dengan alat Pilih (V) untuk mengubah ukurannya. Material lantai diatur per ruangan.</p>
        <LevelSettings level={level} />
        <Swatches
          legend="Material dinding (semua dinding)"
          options={Object.entries(WALLS).map(([k, v]) => ({ key: k, label: v.label, color: v.base }))}
          value={project.wallFinish ?? DEFAULT_WALL}
          onPick={(k) => apply((p) => ({ ...p, wallFinish: k as WallKey }))}
        />
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

  if (selection.kind === 'furniture') {
    const f = project.furniture.find((x) => x.id === selection.id)
    if (!f) return null
    const c = dims(f)
    const set = (patch: Partial<typeof f>) => apply((p) => ({ ...p, furniture: p.furniture.map((x) => (x.id === f.id ? { ...x, ...patch } : x)) }))
    const custom = f.w !== undefined || f.d !== undefined
    return (
      <aside className="inspector" aria-label="Properti furnitur">
        <h2 className="stencil">{c.label}</h2>
        <NumberField label="Lebar (m)" value={c.w} min={0.2} max={10} onCommit={(v) => set({ w: v })} />
        <NumberField label="Dalam (m)" value={c.d} min={0.2} max={10} onCommit={(v) => set({ d: v })} />
        <p className="muted">
          Tinggi {c.h.toFixed(2)} m. Arah {f.rot}°.
        </p>
        {custom && (
          <button className="link-btn" onClick={() => set({ w: undefined, d: undefined })}>
            Kembalikan ukuran katalog
          </button>
        )}
        <div className="tour-buttons">
          <button className="btn" onClick={() => rotateFurniture(f.id, -90)} title="Putar ke kiri (Q)">
            Putar kiri
          </button>
          <button className="btn" onClick={() => rotateFurniture(f.id, 90)} title="Putar ke kanan (E)">
            Putar kanan
          </button>
        </div>
        <p className="muted">Seret dengan alat Pilih untuk memindahkan.</p>
        {del}
      </aside>
    )
  }

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
      <Swatches
        legend="Material lantai"
        options={Object.entries(FLOORS).map(([k, v]) => ({ key: k, label: v.label, color: v.base }))}
        value={r.floor ?? DEFAULT_FLOOR}
        onPick={(k) => apply((p) => ({ ...p, rooms: p.rooms.map((x) => (x.id === r.id ? { ...x, floor: k as FloorKey } : x)) }))}
      />
      {del}
    </aside>
  )
}

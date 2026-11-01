'use client'

// Panel kanan editor: properti elemen terpilih, lembar (lantai, material, deteksi ruangan), dan pilihan furnitur.

import { useState } from 'react'
import { type Selection } from './PlanCanvas'
import { NumberField } from './NumberField'
import { calibrate, readImage, setUnderlay, useUnderlay } from '@/lib/underlay'
import { inPolygon } from '@/lib/walk'
import { useProject } from '@/lib/store'
import { curveWall, dist, finishOf, levelsOf, onLevel, polygonArea, removeLevel, splitWall, uid, wallLength, type Point, type Wall } from '@/lib/project'
import { CATALOG, GROUPS, dims, type FurnitureKind } from '@/lib/furniture'
import { newRoomShapes } from '@/lib/rooms'
import { DOOR_STYLES, WINDOW_STYLES, styleOf, type OpeningStyle } from '@/lib/openings'
import { DEFAULT_FLOOR, DEFAULT_WALL, FLOORS, WALLS, type FloorKey, type WallKey } from '@/lib/materials'
import { turn, duplicateSelected, rotateFurniture, removeSelected } from './editActions'

export function Inspector({ selection, onDelete, onSelect, level }: { selection: Selection; onDelete: () => void; onSelect: (s: Selection) => void; level: string }) {
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
          <dt>Luas ruangan lantai ini</dt>
          <dd>{onLevel(project, level).rooms.reduce((s, r) => s + polygonArea(r.points), 0).toFixed(1)} m²</dd>
        </dl>
        <p className="muted">Pilih elemen dengan alat Pilih (V) untuk mengubah ukurannya. Material lantai diatur per ruangan.</p>
        <DetectRooms level={level} />
        <LevelSettings level={level} />
        <UnderlayPanel />
        <Swatches
          legend="Material dinding bangunan"
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

  if (selection.kind === 'note') {
    const n = project.notes?.find((x) => x.id === selection.id)
    if (!n) return null
    return (
      <aside className="inspector" aria-label="Properti anotasi">
        <h2 className="stencil">{n.b ? 'Garis ukur' : 'Catatan'}</h2>
        {n.b ? (
          <>
            <p className="muted">Panjang {dist(n.a, n.b).toFixed(2)} m</p>
            <Calibrate a={n.a} b={n.b} />
          </>
        ) : (
          <label className="field">
            <span>Isi</span>
            <input
              key={n.id}
              defaultValue={n.text}
              maxLength={80}
              // Fokus otomatis hanya untuk catatan yang baru ditaruh; memilih catatan lama tidak merebut pintasan keyboard.
              autoFocus={n.text === 'Catatan'}
              onFocus={(e) => e.currentTarget.select()}
              onBlur={(e) => {
                const text = e.target.value.trim() || n.text
                if (text !== n.text) apply((p) => ({ ...p, notes: p.notes?.map((x) => (x.id === n.id ? { ...x, text } : x)) }))
              }}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            />
          </label>
        )}
        <p className="muted">Seret dengan alat Pilih untuk memindahkan.</p>
        <button className="btn" onClick={() => duplicateSelected(selection, onSelect)} title="Ctrl+D">
          Duplikat
        </button>
        {del}
      </aside>
    )
  }

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
        <button className="btn" onClick={() => duplicateSelected(selection, onSelect)} title="Ctrl+D">
          Duplikat
        </button>
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
        <p className="muted">Seret dinding untuk menggeser utuh; seret titik ujungnya untuk mengubah panjang.</p>
        <div className="tour-buttons">
          <button
            className="btn"
            disabled={wallLength(w) < 0.2}
            onClick={() => {
              let ids: [string, string] | null = null
              apply((p) => {
                const r = splitWall(p, w.id, wallLength(w) / 2)
                ids = r?.ids ?? null
                return r?.project ?? p
              })
              if (ids) onSelect({ kind: 'wall', id: ids[0] })
            }}
          >
            Bagi di tengah
          </button>
          <button className="btn" onClick={() => duplicateSelected(selection, onSelect)} title="Ctrl+D">
            Duplikat
          </button>
        </div>
        <CurveWall w={w} />
        <Swatches
          legend="Material dinding ini"
          options={Object.entries(WALLS).map(([k, v]) => ({ key: k, label: v.label, color: v.base }))}
          value={finishOf(project, w)}
          onPick={(k) => set({ finish: k as WallKey })}
        />
        {w.finish && (
          <button className="link-btn" onClick={() => set({ finish: undefined })}>
            Ikuti material bangunan ({WALLS[project.wallFinish ?? DEFAULT_WALL].label})
          </button>
        )}
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
        <fieldset className="picker">
          <legend>Jenis</legend>
          {Object.entries(o.kind === 'door' ? DOOR_STYLES : WINDOW_STYLES).map(([k, label]) => (
            <button key={k} className="tool picker-item" aria-pressed={styleOf(o) === k} onClick={() => set({ style: k as OpeningStyle })}>
              {label}
            </button>
          ))}
        </fieldset>
        {o.kind === 'door' && (
          <div className="tour-buttons">
            <button className="btn" onClick={() => set({ flipHinge: !o.flipHinge })}>
              Balik engsel
            </button>
            {styleOf(o) !== 'sliding' && (
              <button className="btn" onClick={() => set({ flipSide: !o.flipSide })}>
                Balik arah buka
              </button>
            )}
          </div>
        )}
        <p className="muted">Seret dengan alat Pilih untuk menggeser sepanjang dinding.</p>
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
      <NumberField
        label="Beda tinggi lantai (m)"
        value={r.offset ?? 0}
        min={-1}
        max={1}
        onCommit={(v) => apply((p) => ({ ...p, rooms: p.rooms.map((x) => (x.id === r.id ? { ...x, offset: v || undefined } : x)) }))}
      />
      <button className="btn" onClick={() => duplicateSelected(selection, onSelect)} title="Ctrl+D">
        Duplikat
      </button>
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

// Dinding lengkung dari dinding lurus: lengkung = jarak puncak busur ke garis lurus (positif ke kiri arah gambar).
function CurveWall({ w }: { w: Wall }) {
  const apply = useProject((s) => s.apply)
  const openings = useProject((s) => s.project.openings.filter((o) => o.wallId === w.id).length)
  const rooms = useProject((s) => s.project.rooms)
  const len = wallLength(w)
  // Bawaan melengkung keluar: kalau puncak busur ke kiri jatuh di dalam ruangan, balik ke kanan.
  const [sag, setSag] = useState(() => {
    const s = +(len / 4).toFixed(2)
    const apex: Point = [(w.a[0] + w.b[0]) / 2 - ((w.b[1] - w.a[1]) / len) * s, (w.a[1] + w.b[1]) / 2 + ((w.b[0] - w.a[0]) / len) * s]
    return rooms.some((r) => inPolygon(apex, r.points)) ? -s : s
  })
  if (len < 0.2) return null
  return (
    <fieldset className="picker">
      <legend>Lengkungkan</legend>
      <NumberField label="Lengkung (m, minus = ke sisi lain)" value={sag} min={-len / 2} max={len / 2} onCommit={setSag} />
      <button
        className="btn"
        onClick={() =>
          (!openings || confirm(`Pintu/jendela di dinding ini (${openings}) akan dihapus. Lanjutkan?`)) && apply((p) => curveWall(p, w.id, sag) ?? p)
        }
      >
        Jadikan dinding lengkung
      </button>
      <p className="muted">Busur tersusun dari 12 potongan lurus; lengkung paling besar setengah panjang dinding (setengah lingkaran).</p>
    </fieldset>
  )
}

// Gambar latar untuk dijiplak: foto atau scan denah lama di bawah gambar, tidak ikut proyek.
function UnderlayPanel() {
  const u = useUnderlay((s) => s.underlay)
  const projectId = useUnderlay((s) => s.projectId)
  const error = useUnderlay((s) => s.error)
  const [msg, setMsg] = useState<string | null>(null)
  if (!projectId) return null
  const pick = async (file?: File) => {
    if (!file) return
    try {
      const { src, aspect } = await readImage(file)
      setUnderlay({ src, aspect, x: 0, y: 0, width: 10, opacity: 0.5 })
      setMsg('Gambar dipasang selebar 10 m. Tarik garis dengan alat Ukur (M) di atas ukuran yang Anda tahu, lalu kalibrasi dari garis itu.')
    } catch (e) {
      setMsg((e as Error).message)
    }
  }
  return (
    <fieldset className="picker">
      <legend>Latar untuk dijiplak</legend>
      {!u ? (
        <label className="btn">
          Pasang foto atau scan denah
          <input type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
        </label>
      ) : (
        <>
          <NumberField label="Lebar gambar (m)" value={+u.width.toFixed(2)} min={0.5} max={500} onCommit={(v) => setUnderlay({ ...u, width: v })} />
          <NumberField label="Geser x (m)" value={+u.x.toFixed(2)} min={-500} max={500} onCommit={(v) => setUnderlay({ ...u, x: v })} />
          <NumberField label="Geser y (m)" value={+u.y.toFixed(2)} min={-500} max={500} onCommit={(v) => setUnderlay({ ...u, y: v })} />
          <label className="field">
            <span>Transparansi</span>
            <input type="range" min={0.1} max={1} step={0.05} value={u.opacity} onChange={(e) => setUnderlay({ ...u, opacity: Number(e.target.value) })} />
          </label>
          <label className="check">
            <input type="checkbox" checked={!u.hidden} onChange={(e) => setUnderlay({ ...u, hidden: !e.target.checked || undefined })} />
            Tampilkan latar
          </label>
          <button className="btn btn-danger" onClick={() => confirm('Lepas gambar latar dari proyek ini?') && setUnderlay(null)}>
            Lepas gambar latar
          </button>
        </>
      )}
      {(error ?? msg) && <p className={error ? 'field-error' : 'muted'}>{error ?? msg}</p>}
      <p className="muted">Gambar latar hanya tersimpan di browser ini, tidak ikut tautan bagikan atau file proyek.</p>
    </fieldset>
  )
}

// Kalibrasi skala gambar latar dari garis ukur: garis ini sebenarnya sepanjang N meter.
function Calibrate({ a, b }: { a: Point; b: Point }) {
  const u = useUnderlay((s) => s.underlay)
  const [m, setM] = useState(() => +dist(a, b).toFixed(2))
  if (!u) return null
  return (
    <fieldset className="picker">
      <legend>Kalibrasi gambar latar</legend>
      <NumberField label="Panjang sebenarnya (m)" value={m} min={0.05} max={500} onCommit={setM} />
      <button className="btn" onClick={() => setUnderlay(calibrate(u, a, b, m))}>
        Skalakan latar supaya garis ini {m} m
      </button>
    </fieldset>
  )
}

// Bidang tertutup di lantai aktif yang belum punya ruangan jadi ruangan baru (satu langkah urungkan).
function DetectRooms({ level }: { level: string }) {
  const project = useProject((s) => s.project)
  const apply = useProject((s) => s.apply)
  const [note, setNote] = useState<string | null>(null)
  const part = onLevel(project, level)
  return (
    <div className="tour">
      <button
        className="btn"
        disabled={!part.walls.length}
        onClick={() => {
          const shapes = newRoomShapes(part.walls, part.rooms)
          if (!shapes.length) return setNote('Tidak ada bidang tertutup baru. Pastikan dinding saling bertemu di ujungnya.')
          apply((p) => ({
            ...p,
            rooms: [...p.rooms, ...shapes.map((points, i) => ({ id: uid(), name: `Ruang ${p.rooms.length + i + 1}`, points, level }))],
          }))
          setNote(`${shapes.length} ruangan dibuat. Ganti namanya dengan memilih ruangan.`)
        }}
      >
        Buat ruangan dari dinding
      </button>
      {note && (
        <p className="muted" role="status">
          {note}
        </p>
      )}
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

export function FurniturePicker({ kind, setKind, rot, setRot }: { kind: FurnitureKind; setKind: (k: FurnitureKind) => void; rot: number; setRot: (r: number) => void }) {
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

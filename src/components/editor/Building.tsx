'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import dynamic from 'next/dynamic'
import type { TourStop, WalkInput } from '@/components/view3d/View3D'
import { useProject } from '@/lib/store'
import { SHARE_PREFIX, encodeProject } from '@/lib/share'
import { tourStop } from '@/lib/walk'
import { onLevel } from '@/lib/project'
import { DEFAULT_ROOF, ROOF_LABELS, ROOF_MATERIALS, type Roof, type RoofMaterial, type RoofType } from '@/lib/roof'
import { NumberField } from './NumberField'

// three.js hanya dimuat saat tampilan 3D dibuka, supaya editor 2D tetap ringan.
const View3D = dynamic(() => import('@/components/view3d/View3D'), {
  ssr: false,
  loading: () => <p className="view3d-msg" aria-busy="true">Menyiapkan tampilan 3D…</p>,
})

// Tur dan mode jalan memakai ruangan di lantai aktif; tampilan 3D memperlihatkan lantai itu dan semua di bawahnya.
export function Building({ level }: { level: string }) {
  const project = useProject((s) => s.project)
  const rooms = useMemo(() => onLevel(project, level).rooms, [project, level])
  const [roof, setRoof] = useState(false)
  const [hour, setHour] = useState(9) // pagi: bayangan panjang dan jelas, enak untuk membaca bentuk
  const [cam, setCam] = useState<'orbit' | 'walk'>('orbit')
  const [stop, setStop] = useState<number | null>(null)
  const [here, setHere] = useState<string | null>(null)
  const input = useRef<WalkInput>({ fwd: 0, turn: 0 })

  const tour: TourStop = stop !== null && rooms[stop] ? tourStop(rooms, stop) : null
  const goRoom = (i: number) => setStop(((i % rooms.length) + rooms.length) % rooms.length)
  const onManual = useCallback(() => setStop(null), [])

  const switchCam = (c: 'orbit' | 'walk') => {
    setCam(c)
    setStop(null)
    setHere(null)
  }

  return (
    <>
      <section className="canvas-wrap" aria-label="Bangunan 3D">
        <View3D level={level} roof={roof} hour={hour} mode={cam} input={input} tour={tour} onManual={onManual} onRoom={setHere} />
        {cam === 'walk' && (
          <>
            <p className="where" aria-live="polite">{here ?? 'Di luar ruangan'}</p>
            <MovePad input={input} onManual={onManual} />
          </>
        )}
        <p className="hint">
          {cam === 'walk'
            ? 'W A S D atau panah untuk berjalan, seret untuk melihat sekeliling. Pintu bisa dilewati, dinding dan jendela tidak.'
            : 'Seret untuk memutar, gulir atau cubit untuk memperbesar, klik kanan dan seret untuk menggeser.'}
        </p>
      </section>

      <aside className="inspector" aria-label="Pengaturan 3D">
        <h2 className="stencil">Bangunan</h2>
        <div className="segmented" role="group" aria-label="Cara melihat">
          <button className="tool" aria-pressed={cam === 'orbit'} onClick={() => switchCam('orbit')}>
            Dari luar
          </button>
          <button className="tool" aria-pressed={cam === 'walk'} onClick={() => switchCam('walk')}>
            Jalan di dalam
          </button>
        </div>

        {cam === 'walk' &&
          (rooms.length ? (
            <div className="tour" role="group" aria-label="Tur ruangan">
              <p className="muted">
                Tur ruangan {stop !== null ? `${stop + 1} dari ${rooms.length}: ${rooms[stop]?.name}` : `(${rooms.length} ruangan)`}
              </p>
              <div className="tour-buttons">
                <button className="btn" onClick={() => goRoom((stop ?? 0) - 1)}>
                  Sebelumnya
                </button>
                <button className="btn btn-accent" onClick={() => goRoom(stop === null ? 0 : stop + 1)}>
                  {stop === null ? 'Mulai tur' : 'Berikutnya'}
                </button>
              </div>
            </div>
          ) : (
            <p className="muted">Gambar ruangan di tampilan 2D untuk memakai tur ruangan.</p>
          ))}

        <label className="field">
          <span>
            Matahari pukul <strong className="dim-text">{clock(hour)}</strong>
          </span>
          <input type="range" className="range" min={6} max={18} step={0.25} value={hour} onChange={(e) => setHour(Number(e.target.value))} />
          <small className="muted">Timur di kanan denah, utara di atas.</small>
        </label>

        <label className="check">
          <input type="checkbox" checked={roof} onChange={(e) => setRoof(e.target.checked)} />
          Tampilkan atap
        </label>
        <RoofSettings />
        <p className="muted">Ubah denah di tampilan 2D.</p>

        <ShareLink />
      </aside>
    </>
  )
}

const clock = (h: number) => `${String(Math.floor(h)).padStart(2, '0')}.${String(Math.round((h % 1) * 60)).padStart(2, '0')}`

// Tombol tahan-untuk-bergerak untuk layar sentuh. Keyboard memakai W A S D.
function MovePad({ input, onManual }: { input: React.RefObject<WalkInput>; onManual: () => void }) {
  const hold = (patch: Partial<WalkInput>) => ({
    onPointerDown: (e: PointerEvent<HTMLButtonElement>) => {
      Object.assign(input.current, patch)
      try {
        e.currentTarget.setPointerCapture(e.pointerId) // jari boleh bergeser keluar tombol tanpa berhenti
      } catch {}
      onManual()
    },
    onPointerUp: () => Object.assign(input.current, { fwd: 0, turn: 0 }),
    onPointerCancel: () => Object.assign(input.current, { fwd: 0, turn: 0 }),
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  })
  return (
    <div className="movepad" aria-label="Tombol gerak">
      <button className="btn pad-up" aria-label="Maju" {...hold({ fwd: 1 })}>▲</button>
      <button className="btn pad-left" aria-label="Putar ke kiri" {...hold({ turn: -1 })}>◀</button>
      <button className="btn pad-down" aria-label="Mundur" {...hold({ fwd: -1 })}>▼</button>
      <button className="btn pad-right" aria-label="Putar ke kanan" {...hold({ turn: 1 })}>▶</button>
    </div>
  )
}

// Tautan presentasi untuk klien: halaman scroll dengan nama proyek. Denah tetap hanya ada di hash.
async function presentationUrl() {
  const s = useProject.getState()
  const name = s.shared ? 'Denah kiriman' : (s.projects.find((m) => m.id === s.currentId)?.name ?? 'Denah')
  const params = new URLSearchParams({ nama: name, denah: await encodeProject(s.project) })
  return `${location.origin}/presentasi#${params}`
}

function ShareLink() {
  const [state, setState] = useState<{ kind: 'idle' | 'busy' | 'copied' | 'manual' | 'error'; url?: string; msg?: string; what?: string }>({ kind: 'idle' })
  const copy = async (what: 'denah' | 'presentasi') => {
    setState({ kind: 'busy' })
    try {
      const url =
        what === 'denah' ? location.origin + location.pathname + SHARE_PREFIX + (await encodeProject(useProject.getState().project)) : await presentationUrl()
      try {
        await navigator.clipboard.writeText(url)
        setState({ kind: 'copied', url, what })
      } catch {
        setState({ kind: 'manual', url }) // izin clipboard ditolak: tampilkan tautan untuk disalin manual
      }
    } catch (e) {
      setState({ kind: 'error', msg: e instanceof Error ? e.message : String(e) })
    }
  }
  // Tautan presentasi disiapkan tiap denah berubah, supaya tombolnya tautan biasa (tab baru tanpa pemblokir pop-up).
  const project = useProject((s) => s.project)
  const name = useProject((s) => s.projects.find((m) => m.id === s.currentId)?.name)
  const [href, setHref] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    presentationUrl().then((u) => alive && setHref(u))
    return () => {
      alive = false
    }
  }, [project, name])
  return (
    <div className="share">
      {href ? (
        <a className="btn btn-accent btn-link" href={href} target="_blank" rel="noopener">
          Buka presentasi
        </a>
      ) : (
        <button className="btn btn-accent" disabled>
          Menyiapkan presentasi…
        </button>
      )}
      <button className="btn" onClick={() => copy('presentasi')} disabled={state.kind === 'busy'}>
        Salin tautan presentasi
      </button>
      <button className="btn" onClick={() => copy('denah')} disabled={state.kind === 'busy'}>
        {state.kind === 'busy' ? 'Membuat tautan…' : 'Salin tautan denah'}
      </button>
      <p className="muted" aria-live="polite">
        {state.kind === 'copied' &&
          (state.what === 'presentasi'
            ? 'Tautan presentasi disalin. Klien cukup membuka dan menggulir halamannya.'
            : 'Tautan disalin. Penerima bisa melihat dan berjalan di denah ini tanpa akun.')}
        {state.kind === 'error' && `Tautan gagal dibuat: ${state.msg}`}
        {state.kind === 'idle' && 'Denah disimpan di dalam tautan itu sendiri, tidak diunggah ke server.'}
      </p>
      {state.kind === 'manual' && (
        <label className="field">
          <span>Clipboard tidak diizinkan. Salin tautan ini:</span>
          <input readOnly value={state.url} onFocus={(e) => e.currentTarget.select()} />
        </label>
      )}
    </div>
  )
}

// Pengaturan atap disimpan di proyek, jadi ikut ke tautan, presentasi, dan ekspor GLB.
function RoofSettings() {
  const roof = useProject((s) => s.project.roof) ?? DEFAULT_ROOF
  const apply = useProject((s) => s.apply)
  const set = (patch: Partial<Roof>) => apply((p) => ({ ...p, roof: { ...(p.roof ?? DEFAULT_ROOF), ...patch } }))
  return (
    <fieldset className="picker">
      <legend>Atap</legend>
      <div className="segmented" role="group" aria-label="Bentuk atap">
        {(Object.keys(ROOF_LABELS) as RoofType[]).map((t) => (
          <button key={t} className="tool" aria-pressed={roof.type === t} onClick={() => roof.type !== t && set({ type: t })}>
            {ROOF_LABELS[t]}
          </button>
        ))}
      </div>
      {roof.type === 'datar' ? (
        <p className="muted">Atap datar mengikuti poligon ruangan di lantai teratas.</p>
      ) : (
        <>
          <NumberField label="Kemiringan (derajat)" value={roof.pitch} min={5} max={60} onCommit={(v) => set({ pitch: v })} />
          <NumberField label="Teritisan (m)" value={roof.overhang} min={0} max={2} onCommit={(v) => set({ overhang: v })} />
          {(Object.keys(ROOF_MATERIALS) as RoofMaterial[]).map((m) => (
            <button key={m} className="tool picker-item" aria-pressed={roof.material === m} onClick={() => roof.material !== m && set({ material: m })}>
              <span className="swatch-row">
                <span className="swatch" style={{ background: ROOF_MATERIALS[m].base }} aria-hidden />
                {ROOF_MATERIALS[m].label}
              </span>
            </button>
          ))}
          <button className="btn" onClick={() => set({ ridge: roof.ridge === 'auto' ? 'putar' : 'auto' })}>
            Putar arah bubungan
          </button>
          <p className="muted">Atap miring dibuat dari kotak luar dinding lantai teratas.</p>
        </>
      )}
    </fieldset>
  )
}

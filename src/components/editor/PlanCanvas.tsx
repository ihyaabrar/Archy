'use client'

import { useRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from 'react'
import {
  OPENING_DEFAULTS,
  WALL_DEFAULTS,
  centroid,
  clampOpening,
  dist,
  lockAngle,
  nearestWall,
  pointAlong,
  polygonArea,
  snap,
  snapToEndpoint,
  uid,
  wallLength,
  wallSpans,
  type Opening,
  type Point,
  type Wall,
} from '@/lib/project'
import { useProject } from '@/lib/store'

export type Tool = 'select' | 'wall' | 'door' | 'window' | 'room'
export type Selection = { kind: 'wall' | 'opening' | 'room'; id: string } | null
export type View = { tx: number; ty: number; s: number } // s = piksel per meter

const GRID_SNAP = 0.05
const PICK_PX = 10 // jarak tangkap dalam piksel layar, tetap sama di semua zoom

type Props = {
  tool: Tool
  view: View
  setView: (fn: (v: View) => View) => void
  selection: Selection
  setSelection: (s: Selection) => void
  draft: Point[]
  setDraft: (d: Point[]) => void
}

export function PlanCanvas({ tool, view, setView, selection, setSelection, draft, setDraft }: Props) {
  const project = useProject((s) => s.project)
  const apply = useProject((s) => s.apply)
  const svgRef = useRef<SVGSVGElement>(null)
  const [cursor, setCursor] = useState<Point | null>(null)
  const [freeAngle, setFreeAngle] = useState(false)
  const pan = useRef<{ x: number; y: number } | null>(null)

  const toWorld = (e: { clientX: number; clientY: number }): Point => {
    const r = svgRef.current!.getBoundingClientRect()
    return [(e.clientX - r.left - view.tx) / view.s, (e.clientY - r.top - view.ty) / view.s]
  }
  const pick = PICK_PX / view.s

  // Titik kerja: ujung dinding terdekat, lalu kunci sudut, lalu grid.
  const workPoint = (raw: Point, free: boolean): Point => {
    const end = snapToEndpoint(raw, project.walls, pick)
    if (end) return end
    const from = draft.at(-1)
    return snap(from && tool === 'wall' && !free ? lockAngle(from, raw) : raw, GRID_SNAP)
  }

  const openingPreview = (p: Point): Opening | null => {
    if (tool !== 'door' && tool !== 'window') return null
    const hit = nearestWall(p, project.walls, Math.max(pick, 0.3))
    if (!hit) return null
    const d = OPENING_DEFAULTS[tool]
    if (wallLength(hit.wall) < d.width) return null
    return { id: 'preview', wallId: hit.wall.id, at: clampOpening(hit.t, d.width, hit.wall), kind: tool, ...d }
  }

  const onDown = (e: RPointerEvent<SVGSVGElement>) => {
    // Elemen yang diklik dengan alat Pilih sudah menghentikan event, jadi yang sampai sini adalah area kosong.
    if (e.button === 1 || tool === 'select') {
      pan.current = { x: e.clientX, y: e.clientY }
      svgRef.current!.setPointerCapture(e.pointerId)
      if (tool === 'select') setSelection(null)
      return
    }
    if (e.button !== 0) return
    const p = workPoint(toWorld(e), e.altKey)

    if (tool === 'wall') {
      const from = draft.at(-1)
      if (!from) return setDraft([p])
      if (dist(from, p) < GRID_SNAP) return
      apply((pr) => ({ ...pr, walls: [...pr.walls, { id: uid(), a: from, b: p, ...WALL_DEFAULTS }] }))
      setDraft([p])
    } else if (tool === 'room') {
      if (draft.length >= 3 && dist(draft[0], p) <= pick) return closeRoom(draft)
      if (draft.at(-1) && dist(draft.at(-1)!, p) < GRID_SNAP) return
      setDraft([...draft, p])
    } else if (tool === 'door' || tool === 'window') {
      const o = openingPreview(toWorld(e))
      if (!o) return
      const id = uid()
      apply((pr) => ({ ...pr, openings: [...pr.openings, { ...o, id }] }))
      setSelection({ kind: 'opening', id })
    }
  }

  const closeRoom = (pts: Point[]) => {
    const id = uid()
    apply((pr) => ({ ...pr, rooms: [...pr.rooms, { id, name: `Ruang ${pr.rooms.length + 1}`, points: pts }] }))
    setDraft([])
    setSelection({ kind: 'room', id })
  }

  const onMove = (e: RPointerEvent<SVGSVGElement>) => {
    if (pan.current) {
      const dx = e.clientX - pan.current.x
      const dy = e.clientY - pan.current.y
      pan.current = { x: e.clientX, y: e.clientY }
      setView((v) => ({ ...v, tx: v.tx + dx, ty: v.ty + dy }))
      return
    }
    setFreeAngle(e.altKey)
    setCursor(toWorld(e))
  }

  const onUp = () => {
    pan.current = null
  }

  const onWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    const r = svgRef.current!.getBoundingClientRect()
    const mx = e.clientX - r.left
    const my = e.clientY - r.top
    setView((v) => {
      const s = Math.min(400, Math.max(8, v.s * Math.exp(-e.deltaY * 0.0015)))
      return { s, tx: mx - ((mx - v.tx) * s) / v.s, ty: my - ((my - v.ty) * s) / v.s }
    })
  }

  const selectOn = (sel: NonNullable<Selection>) => (e: RPointerEvent) => {
    if (tool !== 'select') return
    e.stopPropagation()
    setSelection(sel)
  }

  const isSel = (kind: string, id: string) => selection?.kind === kind && selection.id === id
  const work = cursor ? workPoint(cursor, freeAngle) : null
  const preview = cursor ? openingPreview(cursor) : null
  const k = 1 / view.s // satu piksel layar dalam meter
  const planCenter = project.walls.length ? centroid(project.walls.flatMap((w) => [w.a, w.b])) : undefined

  return (
    <svg
      ref={svgRef}
      className="plan-canvas"
      data-tool={tool}
      role="application"
      aria-label="Kanvas denah. Gunakan toolbar atau pintasan keyboard untuk memilih alat."
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onPointerLeave={() => setCursor(null)}
      onWheel={onWheel}
      onDoubleClick={() => tool === 'room' && draft.length >= 3 && closeRoom(draft)}
      onContextMenu={(e) => {
        e.preventDefault()
        setDraft([])
      }}
    >
      <defs>
        {/* Grid 1 m dan 0,25 m: acuan skala dan snap saat menggambar, bukan hiasan. */}
        <pattern id="grid-minor" width={0.25 * view.s} height={0.25 * view.s} patternUnits="userSpaceOnUse" x={view.tx} y={view.ty}>
          <path d={`M ${0.25 * view.s} 0 L 0 0 0 ${0.25 * view.s}`} className="grid-minor" />
        </pattern>
        <pattern id="grid-major" width={view.s} height={view.s} patternUnits="userSpaceOnUse" x={view.tx} y={view.ty}>
          {view.s >= 40 && <rect width={view.s} height={view.s} fill="url(#grid-minor)" />}
          <path d={`M ${view.s} 0 L 0 0 0 ${view.s}`} className="grid-major" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid-major)" />

      <g transform={`translate(${view.tx} ${view.ty}) scale(${view.s})`}>
        {project.rooms.map((r) => (
          <g key={r.id} onPointerDown={selectOn({ kind: 'room', id: r.id })}>
            <polygon points={r.points.join(' ')} className={isSel('room', r.id) ? 'room room-sel' : 'room'} />
            <RoomLabel name={r.name} points={r.points} k={k} />
          </g>
        ))}

        {project.walls.map((w) => (
          <WallShape key={w.id} wall={w} openings={project.openings} selected={isSel('wall', w.id)} onDown={selectOn({ kind: 'wall', id: w.id })} />
        ))}

        {project.openings.map((o) => {
          const w = project.walls.find((x) => x.id === o.wallId)
          return w ? (
            <OpeningShape key={o.id} o={o} wall={w} selected={isSel('opening', o.id)} onDown={selectOn({ kind: 'opening', id: o.id })} />
          ) : null
        })}

        {project.walls.map((w) => (
          <Dimension key={w.id} a={w.a} b={w.b} k={k} offset={w.thickness / 2 + 14 * k} away={planCenter} />
        ))}

        {preview && (
          <OpeningShape o={preview} wall={project.walls.find((w) => w.id === preview.wallId)!} selected ghost />
        )}

        {draft.length > 0 && work && (tool === 'wall' || tool === 'room') && (
          <g className="draft">
            <polyline points={[...draft, work].join(' ')} vectorEffect="non-scaling-stroke" />
            <Dimension a={draft.at(-1)!} b={work} k={k} offset={14 * k} />
            {tool === 'room' && draft.length >= 3 && <circle cx={draft[0][0]} cy={draft[0][1]} r={PICK_PX * k} className="close-target" />}
          </g>
        )}

        {work && tool !== 'select' && tool !== 'door' && tool !== 'window' && (
          <g className="crosshair">
            <circle cx={work[0]} cy={work[1]} r={4 * k} />
          </g>
        )}
      </g>
    </svg>
  )
}

function WallShape({ wall, openings, selected, onDown }: { wall: Wall; openings: Opening[]; selected: boolean; onDown: (e: RPointerEvent) => void }) {
  const len = wallLength(wall)
  if (len === 0) return null
  const nx = (-(wall.b[1] - wall.a[1]) / len) * (wall.thickness / 2)
  const ny = ((wall.b[0] - wall.a[0]) / len) * (wall.thickness / 2)
  return (
    <g className={selected ? 'wall wall-sel' : 'wall'} onPointerDown={onDown}>
      {wallSpans(wall, openings).map(([t0, t1]) => {
        const p = pointAlong(wall, t0)
        const q = pointAlong(wall, t1)
        return <polygon key={t0} points={`${p[0] + nx},${p[1] + ny} ${q[0] + nx},${q[1] + ny} ${q[0] - nx},${q[1] - ny} ${p[0] - nx},${p[1] - ny}`} />
      })}
    </g>
  )
}

function OpeningShape({ o, wall, selected, ghost, onDown }: { o: Opening; wall: Wall; selected: boolean; ghost?: boolean; onDown?: (e: RPointerEvent) => void }) {
  const len = wallLength(wall)
  const ux = (wall.b[0] - wall.a[0]) / len
  const uy = (wall.b[1] - wall.a[1]) / len
  const p = pointAlong(wall, o.at - o.width / 2)
  const q = pointAlong(wall, o.at + o.width / 2)
  const h = wall.thickness / 2
  const cls = `opening ${selected ? 'opening-sel' : ''} ${ghost ? 'opening-ghost' : ''}`
  let body: ReactNode
  if (o.kind === 'door') {
    // Daun pintu tegak lurus dinding dari engsel p, dengan busur ayun ke q.
    const leaf: Point = [p[0] - uy * o.width, p[1] + ux * o.width]
    body = (
      <>
        <line x1={p[0]} y1={p[1]} x2={leaf[0]} y2={leaf[1]} vectorEffect="non-scaling-stroke" />
        <path d={`M ${leaf[0]} ${leaf[1]} A ${o.width} ${o.width} 0 0 0 ${q[0]} ${q[1]}`} className="swing" vectorEffect="non-scaling-stroke" />
      </>
    )
  } else {
    body = (
      <>
        <line x1={p[0] - uy * h} y1={p[1] + ux * h} x2={q[0] - uy * h} y2={q[1] + ux * h} vectorEffect="non-scaling-stroke" />
        <line x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} vectorEffect="non-scaling-stroke" />
        <line x1={p[0] + uy * h} y1={p[1] - ux * h} x2={q[0] + uy * h} y2={q[1] - ux * h} vectorEffect="non-scaling-stroke" />
      </>
    )
  }
  return (
    <g className={cls} onPointerDown={onDown}>
      {/* Area tangkap tak terlihat supaya bukaan mudah dipilih. */}
      <line x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} strokeWidth={Math.max(h * 2, 0.3)} className="hit" />
      {body}
    </g>
  )
}

// Label ukuran diletakkan di sisi dinding yang menjauhi `away` (tengah denah), seperti dimensi luar di gambar kerja.
function Dimension({ a, b, k, offset, away }: { a: Point; b: Point; k: number; offset: number; away?: Point }) {
  const len = dist(a, b)
  if (len < 0.05) return null
  let nx = -(b[1] - a[1]) / len
  let ny = (b[0] - a[0]) / len
  if (away && ((a[0] + b[0]) / 2 - away[0]) * nx + ((a[1] + b[1]) / 2 - away[1]) * ny < 0) [nx, ny] = [-nx, -ny]
  const mx = (a[0] + b[0]) / 2 + nx * offset
  const my = (a[1] + b[1]) / 2 + ny * offset
  let ang = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI
  if (ang > 90 || ang < -90) ang += 180 // teks tidak pernah terbalik
  return (
    <text className="dim" x={mx} y={my} fontSize={11 * k} transform={`rotate(${ang} ${mx} ${my})`} textAnchor="middle" dominantBaseline="middle">
      {len.toFixed(2)}
    </text>
  )
}

function RoomLabel({ name, points, k }: { name: string; points: Point[]; k: number }) {
  const [x, y] = centroid(points)
  return (
    <g className="room-label">
      <text x={x} y={y - 7 * k} fontSize={13 * k} textAnchor="middle" className="room-name">
        {name}
      </text>
      <text x={x} y={y + 9 * k} fontSize={10 * k} textAnchor="middle" className="dim">
        {polygonArea(points).toFixed(1)} m²
      </text>
    </g>
  )
}

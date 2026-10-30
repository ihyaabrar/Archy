'use client'

import { useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import {
  OPENING_DEFAULTS,
  WALL_DEFAULTS,
  centroid,
  clampOpening,
  dist,
  levelsOf,
  lockAngle,
  moveVertex,
  nearestWall,
  onLevel,
  withLevel,
  polygonArea,
  snap,
  snapToEndpoint,
  uid,
  wallLength,
  type Opening,
  type Point,
  type Room,
  type Wall,
} from '@/lib/project'
import { dimensionLabel, openingSymbol, planCenter as getPlanCenter, wallPolygons } from '@/lib/drawing'
import { useProject } from '@/lib/store'
import { dims, symbol, type Furniture, type FurnitureKind } from '@/lib/furniture'
import { DEFAULT_FLOOR, FLOORS } from '@/lib/materials'

export type Tool = 'select' | 'wall' | 'door' | 'window' | 'room' | 'furniture'
export type Selection = { kind: 'wall' | 'opening' | 'room' | 'furniture'; id: string } | null
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
  furnitureKind: FurnitureKind
  placeRot: number
  level: string
}

export function PlanCanvas({ tool, view, setView, selection, setSelection, draft, setDraft, furnitureKind, placeRot, level }: Props) {
  const full = useProject((s) => s.project)
  // Kanvas hanya membaca dan menyunting lantai aktif.
  const project = useMemo(() => onLevel(full, level), [full, level])
  const below = useMemo(() => {
    const ls = levelsOf(full)
    const me = ls.find((l) => l.id === level)
    const lower = ls.filter((l) => me && l.elevation < me.elevation).sort((a, b) => b.elevation - a.elevation)[0]
    return lower ? onLevel(full, lower.id) : null
  }, [full, level])
  const apply = useProject((s) => s.apply)
  const svgRef = useRef<SVGSVGElement>(null)
  const [cursor, setCursor] = useState<Point | null>(null)
  const [freeAngle, setFreeAngle] = useState(false)
  const pan = useRef<{ x: number; y: number } | null>(null)
  // Furnitur yang sedang diseret: posisi sementara, baru dicatat ke riwayat saat dilepas (satu langkah undo).
  const [drag, setDrag] = useState<{ id: string; offset: Point; pos: Point; moved: boolean } | null>(null)
  // Titik sudut dinding yang sedang diseret (dari posisi lama ke posisi baru).
  const [vdrag, setVdrag] = useState<{ from: Point; to: Point } | null>(null)

  // Tangkap pointer supaya seretan tetap terbaca di luar kanvas. Bisa gagal (pointer sudah lepas); itu tidak fatal.
  const capture = (id: number) => {
    try {
      svgRef.current!.setPointerCapture(id)
    } catch {}
  }

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

  // Layar sentuh: dua jari = pinch-zoom + geser; satu jari di alat gambar baru menaruh titik saat diangkat
  // (ketukan), supaya jari pertama dari pinch tidak ikut menaruh titik. Seret satu jari = geser kanvas.
  const touches = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<{ d: number; mx: number; my: number } | null>(null)
  const tap = useRef<{ x: number; y: number; alt: boolean } | null>(null)

  const touchSpread = () => {
    const [a, b] = [...touches.current.values()]
    const r = svgRef.current!.getBoundingClientRect()
    return { d: Math.hypot(b.x - a.x, b.y - a.y), mx: (a.x + b.x) / 2 - r.left, my: (a.y + b.y) / 2 - r.top }
  }

  const onDown = (e: RPointerEvent<SVGSVGElement>) => {
    if (e.pointerType === 'touch') {
      touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
      capture(e.pointerId)
      if (touches.current.size === 2) {
        tap.current = null
        pan.current = null
        pinch.current = touchSpread()
        return
      }
      if (tool !== 'select') {
        tap.current = { x: e.clientX, y: e.clientY, alt: false }
        pan.current = { x: e.clientX, y: e.clientY }
        return
      }
    }
    // Elemen yang diklik dengan alat Pilih sudah menghentikan event, jadi yang sampai sini adalah area kosong.
    if (e.button === 1 || tool === 'select') {
      pan.current = { x: e.clientX, y: e.clientY }
      capture(e.pointerId)
      if (tool === 'select') setSelection(null)
      return
    }
    if (e.button !== 0) return
    place(e.clientX, e.clientY, e.altKey)
  }

  const place = (clientX: number, clientY: number, alt: boolean) => {
    const raw = toWorld({ clientX, clientY })
    const p = workPoint(raw, alt)

    if (tool === 'wall') {
      const from = draft.at(-1)
      if (!from) return setDraft([p])
      if (dist(from, p) < GRID_SNAP) return
      apply((pr) => ({ ...pr, walls: [...pr.walls, { id: uid(), a: from, b: p, ...WALL_DEFAULTS, level }] }))
      setDraft([p])
    } else if (tool === 'room') {
      if (draft.length >= 3 && dist(draft[0], p) <= pick) return closeRoom(draft)
      if (draft.at(-1) && dist(draft.at(-1)!, p) < GRID_SNAP) return
      setDraft([...draft, p])
    } else if (tool === 'door' || tool === 'window') {
      const o = openingPreview(raw)
      if (!o) return
      const id = uid()
      apply((pr) => ({ ...pr, openings: [...pr.openings, { ...o, id }] }))
      setSelection({ kind: 'opening', id })
    } else if (tool === 'furniture') {
      const id = uid()
      const pos = snap(raw, GRID_SNAP)
      apply((pr) => ({ ...pr, furniture: [...pr.furniture, { id, kind: furnitureKind, pos, rot: placeRot, level }] }))
      setSelection({ kind: 'furniture', id })
    }
  }

  const startDrag = (f: Furniture) => (e: RPointerEvent) => {
    if (tool !== 'select' || e.button !== 0) return
    e.stopPropagation()
    setSelection({ kind: 'furniture', id: f.id })
    const w = toWorld(e)
    setDrag({ id: f.id, offset: [w[0] - f.pos[0], w[1] - f.pos[1]], pos: f.pos, moved: false })
    capture(e.pointerId)
  }

  const closeRoom = (pts: Point[]) => {
    const id = uid()
    apply((pr) => ({ ...pr, rooms: [...pr.rooms, { id, name: `Ruang ${pr.rooms.length + 1}`, points: pts, level }] }))
    setDraft([])
    setSelection({ kind: 'room', id })
  }

  const startVertexDrag = (from: Point) => (e: RPointerEvent) => {
    if (e.button !== 0) return
    e.stopPropagation()
    setVdrag({ from, to: from })
    capture(e.pointerId)
  }

  const onMove = (e: RPointerEvent<SVGSVGElement>) => {
    if (e.pointerType === 'touch' && touches.current.has(e.pointerId)) {
      touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (pinch.current && touches.current.size === 2) {
        const now = touchSpread()
        const prev = pinch.current
        pinch.current = now
        setView((v) => {
          const s = Math.min(400, Math.max(8, (v.s * now.d) / (prev.d || now.d)))
          // Titik di bawah tengah dua jari tetap di tempat, lalu ikut bergeser bersama jari.
          return { s, tx: now.mx - ((prev.mx - v.tx) * s) / v.s, ty: now.my - ((prev.my - v.ty) * s) / v.s }
        })
        return
      }
      if (tap.current && Math.hypot(e.clientX - tap.current.x, e.clientY - tap.current.y) > 10) tap.current = null
    }
    if (vdrag) {
      // Tarik ke ujung dinding lain (bukan titik yang sedang digeser), lalu grid.
      const w = toWorld(e)
      const ends = project.walls.flatMap((x) => [x.a, x.b]).filter((q) => dist(q, vdrag.from) > 1e-6)
      const near = ends.reduce<Point | null>((best, q) => (dist(q, w) <= pick && (!best || dist(q, w) < dist(best, w)) ? q : best), null)
      const to = near ?? snap(w, GRID_SNAP)
      if (to[0] !== vdrag.to[0] || to[1] !== vdrag.to[1]) setVdrag({ ...vdrag, to })
      return
    }
    if (drag) {
      const w = toWorld(e)
      const pos = snap([w[0] - drag.offset[0], w[1] - drag.offset[1]], GRID_SNAP)
      if (pos[0] !== drag.pos[0] || pos[1] !== drag.pos[1]) setDrag({ ...drag, pos, moved: true })
      return
    }
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

  const onUp = (e: RPointerEvent<SVGSVGElement>) => {
    if (e.pointerType === 'touch') {
      touches.current.delete(e.pointerId)
      if (touches.current.size < 2) pinch.current = null
      if (tap.current && e.type === 'pointerup') place(tap.current.x, tap.current.y, false)
      tap.current = null
    }
    pan.current = null
    if (drag?.moved) {
      const { id, pos } = drag
      apply((pr) => ({ ...pr, furniture: pr.furniture.map((f) => (f.id === id ? { ...f, pos } : f)) }))
    }
    setDrag(null)
    if (vdrag && dist(vdrag.from, vdrag.to) > 1e-6) {
      const { from, to } = vdrag
      // Dinding yang menyusut jadi titik dibuang supaya tidak ada dinding nol meter.
      apply((all) => withLevel(all, level, (pr) => {
        const next = moveVertex(pr, from, to)
        const gone = new Set(next.walls.filter((w) => dist(w.a, w.b) < GRID_SNAP).map((w) => w.id))
        return gone.size ? { ...next, walls: next.walls.filter((w) => !gone.has(w.id)), openings: next.openings.filter((o) => !gone.has(o.wallId)) } : next
      }))
    }
    setVdrag(null)
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
  // Saat titik dinding diseret, gambar memakai denah sementara; riwayat baru dicatat saat dilepas.
  const shown = vdrag ? moveVertex(project, vdrag.from, vdrag.to) : project
  const planCenter = getPlanCenter(shown)

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
        {shown.rooms.map((r) => (
          <g key={r.id} onPointerDown={selectOn({ kind: 'room', id: r.id })}>
            <polygon
              points={r.points.join(' ')}
              className={isSel('room', r.id) ? 'room room-sel' : 'room'}
              style={isSel('room', r.id) ? undefined : { fill: FLOORS[r.floor ?? DEFAULT_FLOOR].plan }}
            />
          </g>
        ))}

        {/* Lantai di bawahnya tampil samar sebagai acuan supaya dinding antar lantai bisa disejajarkan. */}
        {below?.walls.map((w) => (
          <g key={'below' + w.id} className="below">
            {wallPolygons(w, below.openings).map((poly, i) => (
              <polygon key={i} points={poly.join(' ')} />
            ))}
          </g>
        ))}

        {project.furniture.map((f) => (
          <FurnitureShape
            key={f.id}
            f={drag?.id === f.id ? { ...f, pos: drag.pos } : f}
            selected={isSel('furniture', f.id)}
            onDown={startDrag(f)}
          />
        ))}

        {shown.walls.map((w) => (
          <WallShape key={w.id} wall={w} openings={shown.openings} selected={isSel('wall', w.id)} onDown={selectOn({ kind: 'wall', id: w.id })} />
        ))}

        {shown.openings.map((o) => {
          const w = shown.walls.find((x) => x.id === o.wallId)
          return w ? (
            <OpeningShape key={o.id} o={o} wall={w} selected={isSel('opening', o.id)} onDown={selectOn({ kind: 'opening', id: o.id })} />
          ) : null
        })}

        {/* Nama ruangan di atas furnitur supaya selalu terbaca. */}
        {shown.rooms.map((r) => (
          <RoomLabel key={r.id} name={r.name} points={r.points} k={k} />
        ))}

        {shown.walls.map((w) => (
          <Dimension key={w.id} a={w.a} b={w.b} k={k} offset={w.thickness / 2 + 14 * k} away={planCenter} rooms={shown.rooms} />
        ))}

        {tool === 'select' &&
          selection?.kind === 'wall' &&
          shown.walls
            .filter((w) => w.id === selection.id)
            .flatMap((w) => [w.a, w.b])
            .map((q, i) => (
              <g key={i} className="handle" onPointerDown={startVertexDrag(vdrag ? vdrag.from : q)}>
                {/* Area sentuh 22 px, titik terlihat 7 px. */}
                <circle cx={q[0]} cy={q[1]} r={22 * k} className="handle-hit" />
                <circle cx={q[0]} cy={q[1]} r={7 * k} className="handle-dot" />
              </g>
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

        {cursor && tool === 'furniture' && (
          <FurnitureShape f={{ id: 'preview', kind: furnitureKind, pos: snap(cursor, GRID_SNAP), rot: placeRot }} selected ghost />
        )}

        {work && (tool === 'wall' || tool === 'room') && (
          <g className="crosshair">
            <circle cx={work[0]} cy={work[1]} r={4 * k} />
          </g>
        )}
      </g>
    </svg>
  )
}

function WallShape({ wall, openings, selected, onDown }: { wall: Wall; openings: Opening[]; selected: boolean; onDown: (e: RPointerEvent) => void }) {
  return (
    <g className={selected ? 'wall wall-sel' : 'wall'} onPointerDown={onDown}>
      {wallPolygons(wall, openings).map((poly, i) => (
        <polygon key={i} points={poly.join(' ')} />
      ))}
    </g>
  )
}

function OpeningShape({ o, wall, selected, ghost, onDown }: { o: Opening; wall: Wall; selected: boolean; ghost?: boolean; onDown?: (e: RPointerEvent) => void }) {
  const { p, q, lines, arc } = openingSymbol(o, wall)
  const cls = `opening ${selected ? 'opening-sel' : ''} ${ghost ? 'opening-ghost' : ''}`
  return (
    <g className={cls} onPointerDown={onDown}>
      {/* Area tangkap tak terlihat supaya bukaan mudah dipilih. */}
      <line x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} strokeWidth={Math.max(wall.thickness, 0.3)} className="hit" />
      {lines.map(([a, b], i) => (
        <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} vectorEffect="non-scaling-stroke" />
      ))}
      {arc && <path d={arc} className="swing" vectorEffect="non-scaling-stroke" />}
    </g>
  )
}

function FurnitureShape({ f, selected, ghost, onDown }: { f: Furniture; selected: boolean; ghost?: boolean; onDown?: (e: RPointerEvent) => void }) {
  const { w, d } = dims(f)
  return (
    <g
      className={`furn ${selected ? 'furn-sel' : ''} ${ghost ? 'furn-ghost' : ''}`}
      transform={`translate(${f.pos[0]} ${f.pos[1]}) rotate(${f.rot})`}
      onPointerDown={onDown}
    >
      <rect x={-w / 2} y={-d / 2} width={w} height={d} className="furn-body" />
      {symbol(f.kind, w, d).map((path, i) => (
        <path key={i} d={path} vectorEffect="non-scaling-stroke" />
      ))}
    </g>
  )
}

function Dimension({ a, b, k, offset, away, rooms = [] }: { a: Point; b: Point; k: number; offset: number; away?: Point; rooms?: Room[] }) {
  const d = dimensionLabel(a, b, offset, { rooms }, away)
  if (!d) return null
  return (
    <text className="dim halo" x={d.x} y={d.y} fontSize={11 * k} strokeWidth={3 * k} transform={`rotate(${d.angle} ${d.x} ${d.y})`} textAnchor="middle" dominantBaseline="middle">
      {d.text}
    </text>
  )
}

function RoomLabel({ name, points, k }: { name: string; points: Point[]; k: number }) {
  const [x, y] = centroid(points)
  return (
    <g className="room-label">
      <text x={x} y={y - 7 * k} fontSize={13 * k} strokeWidth={3 * k} textAnchor="middle" className="room-name halo">
        {name}
      </text>
      <text x={x} y={y + 9 * k} fontSize={10 * k} strokeWidth={3 * k} textAnchor="middle" className="dim halo">
        {polygonArea(points).toFixed(1)} m²
      </text>
    </g>
  )
}

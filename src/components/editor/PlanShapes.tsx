// Bentuk-bentuk gambar di kanvas denah: dinding, bukaan, furnitur, label ukuran, anotasi, nama ruangan.

import { type PointerEvent as RPointerEvent } from 'react'
import { centroid, dist, polygonArea, type Opening, type Point, type Room, type Note, type Wall } from '@/lib/project'
import { dimensionLabel, openingSymbol, wallPolygons } from '@/lib/drawing'
import { dims, symbol, type Furniture } from '@/lib/furniture'

export function WallShape({ wall, openings, selected, onDown }: { wall: Wall; openings: Opening[]; selected: boolean; onDown: (e: RPointerEvent) => void }) {
  return (
    <g className={selected ? 'wall wall-sel' : 'wall'} onPointerDown={onDown}>
      {wallPolygons(wall, openings).map((poly, i) => (
        <polygon key={i} points={poly.join(' ')} />
      ))}
    </g>
  )
}

export function OpeningShape({ o, wall, selected, ghost, onDown }: { o: Opening; wall: Wall; selected: boolean; ghost?: boolean; onDown?: (e: RPointerEvent) => void }) {
  const { p, q, lines, arcs } = openingSymbol(o, wall)
  const cls = `opening ${selected ? 'opening-sel' : ''} ${ghost ? 'opening-ghost' : ''}`
  return (
    <g className={cls} onPointerDown={onDown}>
      {/* Area tangkap tak terlihat supaya bukaan mudah dipilih. */}
      <line x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} strokeWidth={Math.max(wall.thickness, 0.3)} className="hit" />
      {lines.map(([a, b], i) => (
        <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} vectorEffect="non-scaling-stroke" />
      ))}
      {arcs.map((d, i) => (
        <path key={'arc' + i} d={d} className="swing" vectorEffect="non-scaling-stroke" />
      ))}
    </g>
  )
}

export function FurnitureShape({ f, selected, ghost, onDown }: { f: Furniture; selected: boolean; ghost?: boolean; onDown?: (e: RPointerEvent) => void }) {
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

export function Dimension({ a, b, k, offset, away, rooms = [] }: { a: Point; b: Point; k: number; offset: number; away?: Point; rooms?: Room[] }) {
  const d = dimensionLabel(a, b, offset, { rooms }, away)
  if (!d) return null
  return (
    <text className="dim halo" x={d.x} y={d.y} fontSize={11 * k} strokeWidth={3 * k} transform={`rotate(${d.angle} ${d.x} ${d.y})`} textAnchor="middle" dominantBaseline="middle">
      {d.text}
    </text>
  )
}

// Teks bebas atau garis ukur dengan tanda miring 45° di ujungnya (konvensi gambar kerja).
export function NoteShape({ n, k, selected, onDown }: { n: Note; k: number; selected: boolean; onDown?: (e: RPointerEvent) => void }) {
  const cls = selected ? 'note note-sel' : 'note'
  if (!n.b)
    return (
      <text className={`${cls} halo`} x={n.a[0]} y={n.a[1]} fontSize={12 * k} strokeWidth={3 * k} dominantBaseline="middle" onPointerDown={onDown}>
        {n.text || 'Catatan'}
      </text>
    )
  const len = dist(n.a, n.b) || 1
  const t = 5 * k
  const [tx, ty] = [((n.b[0] - n.a[0]) / len - (n.b[1] - n.a[1]) / len) * t, ((n.b[1] - n.a[1]) / len + (n.b[0] - n.a[0]) / len) * t]
  const d = dimensionLabel(n.a, n.b, 9 * k)
  return (
    <g className={cls} onPointerDown={onDown}>
      <line x1={n.a[0]} y1={n.a[1]} x2={n.b[0]} y2={n.b[1]} className="hit" strokeWidth={12 * k} />
      <line x1={n.a[0]} y1={n.a[1]} x2={n.b[0]} y2={n.b[1]} vectorEffect="non-scaling-stroke" />
      {[n.a, n.b].map((q, i) => (
        <line key={i} x1={q[0] - tx} y1={q[1] - ty} x2={q[0] + tx} y2={q[1] + ty} vectorEffect="non-scaling-stroke" />
      ))}
      {d && (
        <text className="dim halo" x={d.x} y={d.y} fontSize={11 * k} strokeWidth={3 * k} transform={`rotate(${d.angle} ${d.x} ${d.y})`} textAnchor="middle" dominantBaseline="middle">
          {d.text}
        </text>
      )}
    </g>
  )
}

export function RoomLabel({ name, points, k }: { name: string; points: Point[]; k: number }) {
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

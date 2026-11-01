// Gerak orang pertama di dalam denah: tabrakan dikerjakan di 2D (tampak atas), cukup untuk dinding vertikal.

import { centroid, pointAlong, wallSpans, type Point, type Project, type Room } from './project'
import { CATALOG, OVERHEAD, footprint } from './furniture'
import { doorLeaves } from './openings'

export const EYE = 1.6
export const BODY_RADIUS = 0.25

// half = setengah tebal dinding. area = bidang padat (furnitur): titik di dalamnya juga terhalang.
export type Segment = { a: Point; b: Point; half: number; area?: Point[] }

// Bagian yang menghalangi: dinding padat dan jendela. Pintu bisa dilewati.
export function blockers(p: Project): Segment[] {
  const out: Segment[] = []
  for (const w of p.walls) {
    const half = w.thickness / 2
    for (const [t0, t1] of wallSpans(w, p.openings)) out.push({ a: pointAlong(w, t0), b: pointAlong(w, t1), half })
    for (const o of p.openings)
      if (o.wallId === w.id && o.kind === 'window')
        out.push({ a: pointAlong(w, o.at - o.width / 2), b: pointAlong(w, o.at + o.width / 2), half })
  }
  // Daun pintu yang terbuka juga benda padat.
  for (const o of p.openings) {
    const w = p.walls.find((x) => x.id === o.wallId)
    if (w) for (const leaf of doorLeaves(o, w)) out.push({ ...leaf, half: 0.02 })
  }
  // Furnitur setinggi lutut ke atas menghalangi; alas shower yang rata bisa diinjak.
  for (const f of p.furniture) {
    if (CATALOG[f.kind].h < 0.3 || OVERHEAD.includes(f.kind)) continue // rendah, atau di atas kepala (kanopi, balok): bisa dilewati
    // Pohon: hanya batangnya yang menghalangi, tajuk di atas kepala.
    const c = f.kind === 'tree' ? footprint({ ...f, w: 0.3, d: 0.3 }) : footprint(f)
    c.forEach((a, i) => out.push({ a, b: c[(i + 1) % 4], half: 0, area: i ? undefined : c }))
  }
  return out
}

export function distToSegment(p: Point, s: Pick<Segment, 'a' | 'b'>) {
  const dx = s.b[0] - s.a[0]
  const dy = s.b[1] - s.a[1]
  const len2 = dx * dx + dy * dy
  const t = len2 ? Math.max(0, Math.min(1, ((p[0] - s.a[0]) * dx + (p[1] - s.a[1]) * dy) / len2)) : 0
  return Math.hypot(p[0] - (s.a[0] + dx * t), p[1] - (s.a[1] + dy * t))
}

export const blocked = (p: Point, segs: Segment[], r = BODY_RADIUS) =>
  segs.some((s) => distToSegment(p, s) < s.half + r || (s.area && inPolygon(p, s.area)))

export function inPolygon(p: Point, poly: Point[]) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]
    const [xj, yj] = poly[j]
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

// Gerak dipecah jadi langkah maksimal 0,1 m (lebih tipis dari dinding) supaya frame lambat tidak menembus dinding.
// Tiap langkah yang menabrak digeser sepanjang satu sumbu supaya tidak "lengket" di dinding.
export function move(from: Point, to: Point, segs: Segment[]): Point {
  const n = Math.max(1, Math.ceil(Math.hypot(to[0] - from[0], to[1] - from[1]) / 0.1))
  const dx = (to[0] - from[0]) / n
  const dy = (to[1] - from[1]) / n
  let p = from
  for (let i = 0; i < n; i++) {
    const cand: Point[] = [[p[0] + dx, p[1] + dy], [p[0] + dx, p[1]], [p[0], p[1] + dy]]
    // Sudah terlanjur di dalam penghalang (mis. tur berhenti di atas kasur): boleh bergerak keluar.
    const next = blocked(p, segs) ? cand[0] : cand.find((c) => !blocked(c, segs))
    if (!next) break
    p = next
  }
  return p
}

// Nama ruangan yang memuat titik p (ray casting), untuk label "sedang di ruangan apa".
export const roomAt = (p: Point, rooms: Room[]): string | null => rooms.find((r) => inPolygon(p, r.points))?.name ?? null

// Titik tur untuk ruangan i: tengah ruangan, menghadap ke ruangan berikutnya.
export function tourStop(rooms: Room[], i: number) {
  const pos = centroid(rooms[i].points)
  const next = rooms.length > 1 ? centroid(rooms[(i + 1) % rooms.length].points) : null
  const yaw = next ? Math.atan2(-(next[0] - pos[0]), -(next[1] - pos[1])) : 0
  return { pos, yaw }
}

// Titik awal jalan: tengah ruangan pertama, atau tengah denah.
export function startPoint(p: Project): Point {
  if (p.rooms[0]?.points.length) return centroid(p.rooms[0].points)
  const pts = p.walls.flatMap((w) => [w.a, w.b])
  return pts.length ? centroid(pts) : [0, 0]
}

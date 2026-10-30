// Model data proyek. Satuan meter. Editor 2D dan (nanti) tampilan 3D membaca bentuk yang sama.

export type Point = [number, number]

export type Wall = { id: string; a: Point; b: Point; thickness: number; height: number }

export type Opening = {
  id: string
  wallId: string
  at: number // jarak tengah bukaan dari titik a dinding, meter
  width: number
  kind: 'door' | 'window'
  sill: number
  height: number
}

export type Room = { id: string; name: string; points: Point[] }

export type Project = { version: 1; walls: Wall[]; openings: Opening[]; rooms: Room[] }

export const emptyProject = (): Project => ({ version: 1, walls: [], openings: [], rooms: [] })

export const WALL_DEFAULTS = { thickness: 0.15, height: 3 }
export const OPENING_DEFAULTS = {
  door: { width: 0.9, sill: 0, height: 2.1 },
  window: { width: 1.2, sill: 0.9, height: 1.2 },
}

export const uid = () => Math.random().toString(36).slice(2, 10)

export const round = (n: number, step = 0.01) => Math.round(n / step) * step

export const snap = (p: Point, step: number): Point => [round(p[0], step), round(p[1], step)]

export const dist = (p: Point, q: Point) => Math.hypot(q[0] - p[0], q[1] - p[1])

export const wallLength = (w: Wall) => dist(w.a, w.b)

// Proyeksi titik ke segmen dinding: t = jarak dari a (dibatasi ke panjang dinding), d = jarak tegak lurus.
export function projectOnWall(p: Point, w: Wall) {
  const len = wallLength(w)
  if (len === 0) return { t: 0, d: dist(p, w.a) }
  const ux = (w.b[0] - w.a[0]) / len
  const uy = (w.b[1] - w.a[1]) / len
  const t = Math.min(len, Math.max(0, (p[0] - w.a[0]) * ux + (p[1] - w.a[1]) * uy))
  return { t, d: dist(p, [w.a[0] + ux * t, w.a[1] + uy * t]) }
}

export const pointAlong = (w: Wall, t: number): Point => {
  const len = wallLength(w) || 1
  return [w.a[0] + ((w.b[0] - w.a[0]) * t) / len, w.a[1] + ((w.b[1] - w.a[1]) * t) / len]
}

// Bukaan harus muat utuh di dalam dinding.
export const clampOpening = (at: number, width: number, w: Wall) =>
  Math.min(Math.max(at, width / 2), Math.max(width / 2, wallLength(w) - width / 2))

// Bagian dinding yang padat (tidak terpotong bukaan), sebagai interval jarak dari titik a.
export function wallSpans(w: Wall, openings: Opening[]): [number, number][] {
  const len = wallLength(w)
  const cuts = openings
    .filter((o) => o.wallId === w.id)
    .map((o) => [o.at - o.width / 2, o.at + o.width / 2] as [number, number])
    .sort((x, y) => x[0] - y[0])
  const spans: [number, number][] = []
  let start = 0
  for (const [c0, c1] of cuts) {
    if (c0 > start) spans.push([start, c0])
    start = Math.max(start, c1)
  }
  if (start < len) spans.push([start, len])
  return spans
}

export function nearestWall(p: Point, walls: Wall[], maxDist: number) {
  let best: { wall: Wall; t: number; d: number } | null = null
  for (const wall of walls) {
    const { t, d } = projectOnWall(p, wall)
    if (d <= maxDist && (!best || d < best.d)) best = { wall, t, d }
  }
  return best
}

// Tarik titik ke ujung dinding terdekat supaya sambungan dinding rapat.
export function snapToEndpoint(p: Point, walls: Wall[], maxDist: number): Point | null {
  let best: Point | null = null
  let bestD = maxDist
  for (const w of walls)
    for (const e of [w.a, w.b]) {
      const d = dist(p, e)
      if (d <= bestD) [best, bestD] = [e, d]
    }
  return best
}

// Kunci sudut ke kelipatan 45 derajat dari titik awal.
export function lockAngle(from: Point, to: Point): Point {
  const len = dist(from, to)
  const ang = Math.round(Math.atan2(to[1] - from[1], to[0] - from[0]) / (Math.PI / 4)) * (Math.PI / 4)
  return [from[0] + Math.cos(ang) * len, from[1] + Math.sin(ang) * len]
}

export function polygonArea(points: Point[]) {
  let s = 0
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i]
    const [x2, y2] = points[(i + 1) % points.length]
    s += x1 * y2 - x2 * y1
  }
  return Math.abs(s) / 2
}

export const centroid = (points: Point[]): Point => [
  points.reduce((s, p) => s + p[0], 0) / points.length,
  points.reduce((s, p) => s + p[1], 0) / points.length,
]

// Validasi data dari localStorage atau file: data luar tidak dipercaya begitu saja.
export function parseProject(raw: unknown): Project {
  const isPt = (p: unknown): p is Point =>
    Array.isArray(p) && p.length === 2 && p.every((n) => typeof n === 'number' && Number.isFinite(n))
  const o = raw as Partial<Project> | null
  if (!o || o.version !== 1 || !Array.isArray(o.walls) || !Array.isArray(o.openings) || !Array.isArray(o.rooms))
    throw new Error('Format proyek tidak dikenali')
  for (const w of o.walls)
    if (typeof w?.id !== 'string' || !isPt(w.a) || !isPt(w.b) || !(w.thickness > 0) || !(w.height > 0))
      throw new Error('Data dinding rusak')
  const wallIds = new Set(o.walls.map((w) => w.id))
  for (const op of o.openings)
    if (typeof op?.id !== 'string' || !wallIds.has(op.wallId) || !(op.width > 0) || !['door', 'window'].includes(op.kind))
      throw new Error('Data bukaan rusak')
  for (const r of o.rooms)
    if (typeof r?.id !== 'string' || typeof r.name !== 'string' || !Array.isArray(r.points) || !r.points.every(isPt))
      throw new Error('Data ruangan rusak')
  return o as Project
}

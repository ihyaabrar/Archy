// Deteksi ruangan dari dinding: setiap bidang tertutup yang dibatasi dinding (garis as) jadi satu ruangan.
// Cara: pecah dinding di setiap titik temu (sambungan T, silang), lalu telusuri bidang-bidang graf planar.

import { centroid, polygonArea, type Point, type Room, type Wall } from './project'
import { roomAt } from './walk'

const EPS = 1e-3
const key = (p: Point) => `${Math.round(p[0] * 1000)},${Math.round(p[1] * 1000)}`

// Titik potong dua segmen (termasuk saling sentuh), sebagai parameter t di segmen pertama.
function hit(a: Point, b: Point, c: Point, d: Point): number | null {
  const r: Point = [b[0] - a[0], b[1] - a[1]]
  const s: Point = [d[0] - c[0], d[1] - c[1]]
  const den = r[0] * s[1] - r[1] * s[0]
  if (Math.abs(den) < 1e-12) return null // sejajar: dianggap tidak berpotongan
  const t = ((c[0] - a[0]) * s[1] - (c[1] - a[1]) * s[0]) / den
  const u = ((c[0] - a[0]) * r[1] - (c[1] - a[1]) * r[0]) / den
  return t > -EPS && t < 1 + EPS && u > -EPS && u < 1 + EPS ? Math.min(1, Math.max(0, t)) : null
}

// Pecah setiap dinding di titik temu dengan dinding lain.
export function splitSegments(walls: Pick<Wall, 'a' | 'b'>[]): [Point, Point][] {
  const out: [Point, Point][] = []
  for (const w of walls) {
    const ts = [0, 1]
    for (const o of walls) if (o !== w) {
      const t = hit(w.a, w.b, o.a, o.b)
      if (t !== null) ts.push(t)
    }
    const at = (t: number): Point => [w.a[0] + (w.b[0] - w.a[0]) * t, w.a[1] + (w.b[1] - w.a[1]) * t]
    const sorted = [...new Set(ts.map((t) => Math.round(t * 1e6) / 1e6))].sort((x, y) => x - y)
    for (let i = 0; i + 1 < sorted.length; i++) {
      const p = at(sorted[i])
      const q = at(sorted[i + 1])
      if (Math.hypot(q[0] - p[0], q[1] - p[1]) > EPS) out.push([p, q])
    }
  }
  return out
}

const signedArea = (pts: Point[]) => pts.reduce((s, p, i) => s + (p[0] * pts[(i + 1) % pts.length][1] - pts[(i + 1) % pts.length][0] * p[1]), 0) / 2

// Semua bidang tertutup (tanpa bidang luar). Satuan meter, urutan titik konsisten.
export function faces(walls: Pick<Wall, 'a' | 'b'>[]): Point[][] {
  const segs = splitSegments(walls)
  const pos = new Map<string, Point>()
  const nbr = new Map<string, Set<string>>()
  for (const [p, q] of segs) {
    const [kp, kq] = [key(p), key(q)]
    if (kp === kq) continue
    pos.set(kp, p)
    pos.set(kq, q)
    if (!nbr.has(kp)) nbr.set(kp, new Set())
    if (!nbr.has(kq)) nbr.set(kq, new Set())
    nbr.get(kp)!.add(kq)
    nbr.get(kq)!.add(kp)
  }
  // Tetangga tiap titik, urut berdasarkan sudut.
  const sorted = new Map<string, string[]>()
  for (const [k, set] of nbr) {
    const o = pos.get(k)!
    sorted.set(k, [...set].sort((x, y) => Math.atan2(pos.get(x)![1] - o[1], pos.get(x)![0] - o[0]) - Math.atan2(pos.get(y)![1] - o[1], pos.get(y)![0] - o[0])))
  }
  const used = new Set<string>()
  const result: Point[][] = []
  for (const [u, set] of nbr)
    for (const v of set) {
      if (used.has(`${u}>${v}`)) continue
      // Telusuri: dari setiap titik, ambil tetangga tepat sebelum asal dalam urutan sudut (belokan paling kanan).
      const cycle: string[] = []
      let [a, b] = [u, v]
      for (let guard = 0; guard < 10000 && !used.has(`${a}>${b}`); guard++) {
        used.add(`${a}>${b}`)
        cycle.push(a)
        const list = sorted.get(b)!
        const i = list.indexOf(a)
        ;[a, b] = [b, list[(i - 1 + list.length) % list.length]]
      }
      const pts = cycle.map((k) => pos.get(k)!)
      // Bidang dalam bertanda positif pada arah telusur ini; bidang luar dan ujung dinding buntu bernilai negatif atau nol.
      if (pts.length >= 3 && signedArea(pts) > 0.5) result.push(pts)
    }
  return result
}

// Bidang tertutup yang belum punya ruangan (titik tengahnya tidak berada di ruangan mana pun).
export function newRoomShapes(walls: Pick<Wall, 'a' | 'b'>[], rooms: Pick<Room, 'points' | 'name'>[]): Point[][] {
  return faces(walls).filter((f) => !roomAt(centroid(f), rooms as Room[]) && polygonArea(f) >= 1)
}

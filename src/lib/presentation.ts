// Presentasi scroll: denah dilihat dari atas, bangunan naik, lalu kamera masuk ruangan satu per satu.
// Satu bab = satu layar scroll. Isi teks hanya dari data denah (tidak ada angka atau klaim karangan).

import { CATALOG } from './furniture'
import { DEFAULT_FLOOR, FLOORS } from './materials'
import { bounds } from './mesh'
import { centroid, elevationOf, levelOf, levelsOf, polygonArea, type Project, type Room } from './project'
import { EYE, roomAt } from './walk'

type V3 = [number, number, number]
export type Key = { pos: V3; look: V3 }

export type Chapter =
  | { kind: 'intro' }
  | { kind: 'rise' }
  | { kind: 'room'; room: Room; area: number; floor: string; furniture: string[]; level: string | null }
  | { kind: 'outro' }

export function chapters(p: Project): Chapter[] {
  const levels = levelsOf(p)
  const rooms = roomsInOrder(p).map((room) => ({
    kind: 'room' as const,
    room,
    area: polygonArea(room.points),
    floor: FLOORS[room.floor ?? DEFAULT_FLOOR].label,
    furniture: p.furniture.filter((f) => levelOf(p, f) === levelOf(p, room) && roomAt(f.pos, [room])).map((f) => CATALOG[f.kind].label),
    level: levels.length > 1 ? (levels.find((l) => l.id === levelOf(p, room))?.name ?? null) : null,
  }))
  return [{ kind: 'intro' }, { kind: 'rise' }, ...rooms, { kind: 'outro' }]
}

// Satu posisi kamera per bab, urutannya sama dengan chapters().
export function keyframes(p: Project): Key[] {
  const { center: [cx, cz], size } = bounds(p)
  const top: Key = { pos: [cx, size * 1.9, cz + 0.001], look: [cx, 0, cz] } // tegak lurus ke bawah: denah persis seperti gambar 2D
  const overview: Key = { pos: [cx + size * 0.9, size * 0.85, cz + size * 1.25], look: [cx, 1, cz] }
  // Kamera ruangan berdiri di pojok terjauh (masuk 0,7 m), setinggi mata, menatap tengah ruangan:
  // sudut foto interior yang memperlihatkan paling banyak isi ruangan.
  const rooms = roomsInOrder(p).map((r): Key => {
    const e = elevationOf(p, levelOf(p, r))
    const [mx, mz] = centroid(r.points)
    const far = r.points.reduce((a, q) => (Math.hypot(q[0] - mx, q[1] - mz) > Math.hypot(a[0] - mx, a[1] - mz) ? q : a))
    const d = Math.hypot(far[0] - mx, far[1] - mz) || 1
    const inset = Math.min(0.7, d * 0.5)
    const x = far[0] + ((mx - far[0]) / d) * inset
    const z = far[1] + ((mz - far[1]) / d) * inset
    return { pos: [x, e + EYE, z], look: [mx, e + 0.9, mz] }
  })
  return [top, overview, ...rooms, overview]
}

// Tur dari lantai terbawah ke atas; di dalam satu lantai mengikuti urutan ruangan digambar.
function roomsInOrder(p: Project) {
  return [...p.rooms].sort((a, b) => elevationOf(p, levelOf(p, a)) - elevationOf(p, levelOf(p, b)))
}

const smooth = (f: number) => f * f * (3 - 2 * f)
const lerp = (a: V3, b: V3, f: number): V3 => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]

// Posisi kamera untuk progres t (0 = bab pertama, 1 = bab kedua, dst.). `snap` untuk reduced motion: tanpa transisi.
export function sample(keys: Key[], t: number, snap = false): Key {
  const c = Math.max(0, Math.min(keys.length - 1, t))
  const i = Math.min(keys.length - 2, Math.floor(c))
  const f = snap ? Math.round(c - i) : smooth(c - i)
  return { pos: lerp(keys[i].pos, keys[i + 1].pos, f), look: lerp(keys[i].look, keys[i + 1].look, f) }
}

// Bangunan naik selama bab pertama ke kedua (dari denah datar ke 3D penuh).
export const riseAt = (t: number, snap = false) => (snap ? (t >= 0.5 ? 1 : 0) : smooth(Math.max(0, Math.min(1, t))))

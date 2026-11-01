import { describe, expect, it } from 'vitest'
import { DEFAULT_ROOF, footprintRects, roofMesh } from './roof'
import { emptyProject, type Point, type Project } from './project'

const loop = (pts: Point[]): Project => ({
  ...emptyProject(),
  walls: pts.map((a, i) => ({ id: 'w' + i, a, b: pts[(i + 1) % pts.length], thickness: 0.15, height: 3 })),
})

// L: sayap utama 10 × 4 di atas, sayap 4 × 6 turun di kiri. Luas denah 40 + 24 = 64 m².
const L = loop([[0, 0], [10, 0], [10, 4], [4, 4], [4, 10], [0, 10]])
// T: batang atas 12 × 4, kaki 4 × 6 di tengah.
const T = loop([[0, 0], [12, 0], [12, 4], [8, 4], [8, 10], [4, 10], [4, 4], [0, 4]])
const pel = { ...DEFAULT_ROOF, type: 'pelana' as const, pitch: 30, overhang: 0 }

describe('atap denah L/T', () => {
  it('tapak L dipecah jadi dua sayap yang bertumpuk di sudut', () => {
    const rs = footprintRects(L.walls)!
    expect(rs).toHaveLength(2)
    expect(rs).toContainEqual({ x0: 0, x1: 10, z0: 0, z1: 4 })
    expect(rs).toContainEqual({ x0: 0, x1: 4, z0: 0, z1: 10 })
  })

  it('luas atap L = luas denah / cos, tanpa hitung ganda di sudut', () => {
    expect(roofMesh(L, pel)!.area).toBeCloseTo(64 / Math.cos(Math.PI / 6))
    expect(roofMesh(L, { ...pel, type: 'perisai' })!.area).toBeCloseTo(64 / Math.cos(Math.PI / 6))
  })

  it('sayap sama lebar: satu tembus sampai ujung, satu berhenti di bubungannya; sopi-sopi hanya di ujung bebas', () => {
    const m = roofMesh(L, pel)!
    expect(m.gables).toHaveLength(9) // tiga sopi-sopi × 3 segitiga
    expect(m.ridgeHeight).toBeCloseTo(3 + 2.075 * Math.tan(Math.PI / 6))
    // Tidak ada sopi-sopi di dalam sayap utama (z antara 0 dan 4 pada x antara 0 dan 4, selain dinding luar).
    const inner = m.gables.filter((g) => g.p.every((v) => v[0] > 0.01 && v[0] < 3.99 && v[2] > 0.01 && v[2] < 3.99))
    expect(inner).toHaveLength(0)
  })

  it('T: kaki berhenti di bubungan batang; luas dari tampak atas', () => {
    const rs = footprintRects(T.walls)!
    expect(rs).toHaveLength(2)
    const m = roofMesh(T, { ...pel, overhang: 0.5 })!
    // Tampak atas: batang 13 × 5 ditambah kaki 5 × 6 di luar teritisan batang (teritisan kaki hanya di ujung bebas).
    expect(m.area).toBeCloseTo((13 * 5 + 5 * 6) / Math.cos(Math.PI / 6))
    expect(m.gables).toHaveLength(9)
  })

  it('dinding miring: kembali ke kotak luar', () => {
    expect(footprintRects(loop([[0, 0], [6, 0], [8, 4], [0, 4]]).walls)).toBeNull()
  })
})

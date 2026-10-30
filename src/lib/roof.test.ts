import { describe, expect, it } from 'vitest'
import { DEFAULT_ROOF, isRoof, roofMesh } from './roof'
import { emptyProject, type Project } from './project'

// Kotak 8 × 6 m, dinding 3 m.
const W = (id: string, a: [number, number], b: [number, number]) => ({ id, a, b, thickness: 0.15, height: 3 })
const p: Project = { ...emptyProject(), walls: [W('a', [0, 0], [8, 0]), W('b', [8, 0], [8, 6]), W('c', [8, 6], [0, 6]), W('d', [0, 6], [0, 0])] }

describe('atap', () => {
  it('pelana: bubungan sejajar sisi panjang, tinggi = setengah bentang × tan(kemiringan)', () => {
    const m = roofMesh(p, { ...DEFAULT_ROOF, type: 'pelana', pitch: 45, overhang: 0 })!
    expect(m.ridgeHeight).toBeCloseTo(3 + 3)
    expect(m.gables).toHaveLength(2)
    // Tanpa teritisan: 2 bidang × 8 m × sisi miring 3√2.
    expect(m.area).toBeCloseTo(2 * 8 * 3 * Math.SQRT2)
    const ridgeYs = m.roof.flatMap((t) => t.p).filter((v) => v[1] > 5.9)
    expect(ridgeYs.every((v) => v[2] === 3)).toBe(true) // bubungan di z = 3 (tengah sisi pendek)
  })

  it('teritisan turun mengikuti kemiringan; bubungan bisa diputar', () => {
    const m = roofMesh(p, { ...DEFAULT_ROOF, type: 'pelana', pitch: 45, overhang: 0.5 })!
    expect(Math.min(...m.roof.flatMap((t) => t.p.map((v) => v[1])))).toBeCloseTo(2.5)
    const rot = roofMesh(p, { ...DEFAULT_ROOF, type: 'pelana', pitch: 45, overhang: 0, ridge: 'putar' })!
    expect(rot.ridgeHeight).toBeCloseTo(3 + 4) // bentang 8 m: lebih tinggi
  })

  it('perisai: empat bidang, luas sama dengan pelana berkemiringan sama (tanpa teritisan)', () => {
    const hip = roofMesh(p, { ...DEFAULT_ROOF, type: 'perisai', pitch: 30, overhang: 0 })!
    const gable = roofMesh(p, { ...DEFAULT_ROOF, type: 'pelana', pitch: 30, overhang: 0 })!
    expect(hip.gables).toHaveLength(0)
    // Semua bidang berkemiringan sama: luas = luas denah / cos(kemiringan), untuk keduanya.
    expect(hip.area).toBeCloseTo(48 / Math.cos(Math.PI / 6))
    expect(gable.area).toBeCloseTo(48 / Math.cos(Math.PI / 6))
  })

  it('datar atau tanpa dinding: tidak ada atap miring; validasi data', () => {
    expect(roofMesh(p, DEFAULT_ROOF)).toBeNull()
    expect(roofMesh(emptyProject(), { ...DEFAULT_ROOF, type: 'pelana' })).toBeNull()
    expect(isRoof({ ...DEFAULT_ROOF, pitch: 80 })).toBe(false)
    expect(isRoof(DEFAULT_ROOF)).toBe(true)
  })
})

describe('atap di volume material', async () => {
  const { quantities } = await import('./quantities')
  it('luas atap dan perkiraan genteng', () => {
    const rows = quantities({ ...p, roof: { ...DEFAULT_ROOF, type: 'pelana', pitch: 30, overhang: 0 } })
    const area = rows.find((r) => r.item.startsWith('Luas bidang atap'))!.qty
    expect(area).toBeCloseTo(48 / Math.cos(Math.PI / 6))
    expect(rows.find((r) => r.item.startsWith('Genteng tanah liat'))!.qty).toBe(Math.ceil(area * 25 * 1.05))
    expect(rows.find((r) => r.item === 'Dinding sopi-sopi')!.qty).toBeCloseTo(2 * (0.5 * 6 * 3 * Math.tan(Math.PI / 6)))
  })
})

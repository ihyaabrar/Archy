import { describe, expect, it } from 'vitest'
import { DEFAULT_ROOF, exposedRooms, isRoof, roofMesh } from './roof'
import { emptyProject, type Project } from './project'

// Kotak 8 × 6 m, dinding 3 m.
const W = (id: string, a: [number, number], b: [number, number]) => ({ id, a, b, thickness: 0.15, height: 3 })
const p: Project = { ...emptyProject(), walls: [W('a', [0, 0], [8, 0]), W('b', [8, 0], [8, 6]), W('c', [8, 6], [0, 6]), W('d', [0, 6], [0, 0])] }

describe('atap', () => {
  it('pelana: bubungan sejajar sisi panjang, tinggi = setengah bentang × tan(kemiringan)', () => {
    const m = roofMesh(p, { ...DEFAULT_ROOF, type: 'pelana', pitch: 45, overhang: 0 })!
    // Bidang atap diangkat setengah tebal dinding × tan: 0,075 m pada 45°.
    expect(m.ridgeHeight).toBeCloseTo(3 + 3 + 0.075)
    expect(m.gables).toHaveLength(6) // dua sopi-sopi, masing-masing 3 segitiga
    // Tanpa teritisan: 2 bidang × 8 m × sisi miring 3√2.
    expect(m.area).toBeCloseTo(2 * 8 * 3 * Math.SQRT2)
    const ridgeYs = m.roof.flatMap((t) => t.p).filter((v) => v[1] > 5.99)
    expect(ridgeYs.every((v) => Math.abs(v[2] - 3) < 1e-9)).toBe(true) // bubungan di z = 3 (tengah sisi pendek)
  })

  it('teritisan turun mengikuti kemiringan; bubungan bisa diputar', () => {
    const m = roofMesh(p, { ...DEFAULT_ROOF, type: 'pelana', pitch: 45, overhang: 0.5 })!
    expect(Math.min(...m.roof.flatMap((t) => t.p.map((v) => v[1])))).toBeCloseTo(2.575)
    const rot = roofMesh(p, { ...DEFAULT_ROOF, type: 'pelana', pitch: 45, overhang: 0, ridge: 'putar' })!
    expect(rot.ridgeHeight).toBeCloseTo(3 + 4 + 0.075) // bentang 8 m: lebih tinggi
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
    expect(rows.find((r) => r.item === 'Dinding sopi-sopi')!.qty).toBeCloseTo(2 * (0.5 * 6 * 3 * Math.tan(Math.PI / 6) + 6 * 0.075 * Math.tan(Math.PI / 6)))
  })

  it('miring (sandar): satu bidang, sisi tinggi bisa dibalik, tinggi = bentang penuh × tan', () => {
    const shed = roofMesh(p, { ...DEFAULT_ROOF, type: 'sandar', pitch: 45, overhang: 0 })!
    expect(shed.roof).toHaveLength(2) // satu persegi = dua segitiga
    expect(shed.ridgeHeight).toBeCloseTo(3 + 6 + 0.075) // bentang 6 m
    const top = (m: typeof shed) => m.roof.flatMap((t) => t.p).filter((v) => v[1] > 9).map((v) => v[2])
    const flipped = roofMesh(p, { ...DEFAULT_ROOF, type: 'sandar', pitch: 45, overhang: 0, flip: true })!
    expect(new Set(top(shed))).not.toEqual(new Set(top(flipped))) // sisi tinggi pindah
    expect(shed.area).toBeCloseTo(8 * 6 * Math.SQRT2)
    expect(isRoof({ ...DEFAULT_ROOF, type: 'sandar', flip: true })).toBe(true)
    expect(isRoof({ ...DEFAULT_ROOF, flip: 'ya' })).toBe(false)
  })

  it('dak: ruang lantai bawah di luar tapak lantai atas diberi dak, yang di bawah atap tidak', () => {
    const levels = [
      { id: 'L1', name: 'Lantai 1', elevation: 0 },
      { id: 'L2', name: 'Lantai 2', elevation: 3.2 },
    ]
    const room = (id: string, x0: number, x1: number, level: string) => ({ id, name: id, level, points: [[x0, 0], [x1, 0], [x1, 6], [x0, 6]] as [number, number][] })
    const twoLevels: Project = {
      ...emptyProject(),
      levels,
      walls: [...p.walls.map((w) => ({ ...w, level: 'L2' })), ...p.walls.map((w) => ({ ...w, id: w.id + '1', level: 'L1' })), { ...W('e', [8, 0], [12, 0]), level: 'L1' }],
      rooms: [room('bawah', 0, 8, 'L1'), room('garasi', 8, 12, 'L1'), room('atas', 0, 8, 'L2')],
    }
    expect(exposedRooms(twoLevels).map((x) => [x.room.id, x.y])).toEqual([['garasi', 3]])
  })

  it('roster gevel: 6 bilah di tiap gevel pelana, tidak ada di perisai atau kalau dimatikan', () => {
    const on = { ...DEFAULT_ROOF, type: 'pelana' as const, vent: true }
    expect(roofMesh(p, on)!.vents).toHaveLength(12)
    expect(roofMesh(p, { ...on, vent: false })!.vents).toHaveLength(0)
    expect(roofMesh(p, { ...on, type: 'perisai' })!.vents).toHaveLength(0)
    // Bilah ada di bidang gevel (garis as dinding ujung), di bawah bubungan.
    const m = roofMesh(p, on)!
    expect(m.vents.every((v) => (Math.abs(v.center[0]) < 1e-9 || Math.abs(v.center[0] - 8) < 1e-9) && v.center[1] < m.ridgeHeight)).toBe(true)
    expect(isRoof({ ...on, vent: 'ya' })).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'
import { CATALOG, footprint, symbol, type Furniture } from './furniture'
import { emptyProject, parseProject } from './project'
import { buildPieces } from './mesh'
import { blocked, blockers, move } from './walk'
import { planSvg } from './drawing'
import { FLOORS } from './materials'

const bed: Furniture = { id: 'f', kind: 'bed2', pos: [2, 2], rot: 90 }

describe('furnitur', () => {
  it('jejak ikut berputar', () => {
    const xs = footprint(bed).map((p) => p[0])
    // Diputar 90°: lebar di sumbu x jadi panjang kasur (2,0 m).
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(CATALOG.bed2.d)
  })

  it('setiap jenis punya simbol', () => {
    for (const k of Object.keys(CATALOG) as (keyof typeof CATALOG)[]) expect(symbol(k).length).toBeGreaterThan(0)
  })

  it('proyek lama tanpa furnitur tetap terbaca, jenis asing ditolak', () => {
    expect(parseProject({ version: 1, walls: [], openings: [], rooms: [] }).furniture).toEqual([])
    expect(() => parseProject({ ...emptyProject(), furniture: [{ ...bed, kind: 'roket' }] })).toThrow()
  })

  it('muncul di 3D, menghalangi jalan, dan ikut ekspor', () => {
    const p = { ...emptyProject(), furniture: [bed], rooms: [{ id: 'r', name: 'Kamar', points: [[0, 0], [4, 0], [4, 4], [0, 4]] as [number, number][] }] }
    const piece = buildPieces(p).find((x) => x.kind === 'furniture')!
    expect(piece.size).toEqual([1.6, 0.5, 2.0])
    const segs = blockers(p)
    expect(blocked([2, 2], segs)).toBe(true) // di atas kasur
    expect(blocked([2, 1.0], segs)).toBe(true) // terlalu dekat tepi kasur (y 1,2)
    expect(blocked([2, 0.9], segs)).toBe(false)
    const [, y] = move([2, 2], [2, 0.5], segs) // mulai di atas kasur: boleh keluar
    expect(y).toBeCloseTo(0.5)
    expect(planSvg(p, 'x')!.svg).toContain('rotate(90)')
  })

  it('material: lama tanpa material terbaca, kunci asing ditolak, warna denah ikut', () => {
    const room = { id: 'r', name: 'Kamar', points: [[0, 0], [3, 0], [3, 3]] as [number, number][] }
    expect(parseProject({ ...emptyProject(), rooms: [room] }).rooms[0].floor).toBeUndefined()
    expect(() => parseProject({ ...emptyProject(), rooms: [{ ...room, floor: 'emas' }] })).toThrow()
    expect(() => parseProject({ ...emptyProject(), wallFinish: 'kaca' })).toThrow()
    const svg = planSvg({ ...emptyProject(), rooms: [{ ...room, floor: 'kayu' }] }, 'x')!.svg
    expect(svg).toContain(FLOORS.kayu.plan)
  })

  it('alas shower tidak menghalangi', () => {
    const p = { ...emptyProject(), furniture: [{ id: 's', kind: 'shower' as const, pos: [1, 1] as [number, number], rot: 0 }] }
    expect(blockers(p)).toHaveLength(0)
  })
})

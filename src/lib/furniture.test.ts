import { describe, expect, it } from 'vitest'
import { CATALOG, footprint, symbol, type Furniture } from './furniture'
import { emptyProject, parseProject } from './project'
import { buildPieces } from './mesh'
import { blocked, blockers, inPolygon, move } from './walk'
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
    // Kasur: rangka, kasur, kepala kasur, dua bantal. Rangka seluas tapak, tidak ada balok di luar tapak.
    const pieces = buildPieces(p).filter((x) => x.kind === 'furniture')
    expect(pieces).toHaveLength(5)
    expect(pieces[0].size[0]).toBeCloseTo(1.6)
    expect(pieces[0].size[2]).toBeCloseTo(2.0)
    for (const pc of pieces) expect(inPolygon([pc.center[0], pc.center[2]], footprint(bed))).toBe(true)
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

  it('kanopi: bisa dilewati, digambar putus-putus tanpa menutup lantai, tiang setinggi pasang', () => {
    const canopy: Furniture = { id: 'k', kind: 'canopy', pos: [2, 2], rot: 0 }
    const p = { ...emptyProject(), furniture: [canopy, { ...bed, id: 'b' }] }
    expect(blockers(p).length).toBe(4) // hanya kasur
    const svg = planSvg({ ...p, walls: [{ id: 'w', a: [0, 0], b: [4, 0], thickness: 0.15, height: 3 }] }, 'x')!.svg
    expect(svg).toContain("stroke-dasharray='0.15 0.08'")
    const posts = buildPieces(p).filter((x) => x.wallId === 'k' && x.size[1] === CATALOG.canopy.h)
    expect(posts).toHaveLength(2)
  })

  it('setiap jenis katalog punya simbol dan bentuk 3D (kecuali tangga yang dibuat terpisah)', () => {
    for (const kind of Object.keys(CATALOG) as Furniture['kind'][]) {
      expect(symbol(kind).length, kind).toBeGreaterThan(0)
      const pieces = buildPieces({ ...emptyProject(), furniture: [{ id: 'x', kind, pos: [0, 0], rot: 0 }] })
      expect(pieces.length, kind).toBeGreaterThan(0)
    }
  })

  it('pohon: hanya batang 30 cm yang menghalangi jalan, tajuk tidak', () => {
    const p = { ...emptyProject(), furniture: [{ id: 't', kind: 'tree', pos: [5, 5], rot: 0 } as Furniture] }
    expect(blocked([5, 5], blockers(p))).toBe(true)
    expect(blocked([6.2, 5], blockers(p))).toBe(false) // masih di bawah tajuk 3 m
  })
})

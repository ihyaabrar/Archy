import { describe, expect, it } from 'vitest'
import { doorLeaves, openingSymbol, styleOf } from './openings'
import { buildPieces } from './mesh'
import { emptyProject, parseProject, type Opening, type Wall } from './project'

// Dinding sepanjang sumbu x; sisi "kiri" (n) = +y.
const wall: Wall = { id: 'w', a: [0, 0], b: [4, 0], thickness: 0.2, height: 3 }
const door = (o: Partial<Opening> = {}): Opening => ({ id: 'd', wallId: 'w', at: 2, width: 1, kind: 'door', sill: 0, height: 2.1, ...o })

describe('pintu dan jendela', () => {
  it('pintu ayun: engsel di ujung dekat a, daun ke sisi kiri; bisa dibalik engsel dan sisinya', () => {
    expect(doorLeaves(door(), wall)).toEqual([{ a: [1.5, 0], b: [1.5, 1] }])
    expect(doorLeaves(door({ flipHinge: true }), wall)[0].a).toEqual([2.5, 0])
    expect(doorLeaves(door({ flipSide: true }), wall)[0].b).toEqual([1.5, -1])
  })

  it('pintu ganda: dua daun setengah lebar dari kedua ujung', () => {
    const l = doorLeaves(door({ style: 'double' }), wall)
    expect(l.map((x) => x.a)).toEqual([[1.5, 0], [2.5, 0]])
    expect(l.every((x) => Math.hypot(x.b[0] - x.a[0], x.b[1] - x.a[1]) === 0.5)).toBe(true)
    expect(openingSymbol(door({ style: 'double' }), wall).arcs).toHaveLength(2)
  })

  it('pintu geser: panel di dalam bidang dinding (tidak menjorok ke ruangan), tanpa busur', () => {
    const [leaf] = doorLeaves(door({ style: 'sliding' }), wall)
    expect(leaf.a[1]).toBe(0)
    expect(leaf.b[1]).toBe(0)
    expect(openingSymbol(door({ style: 'sliding' }), wall).arcs).toHaveLength(0)
  })

  it('busur ayun mengikuti arah balik', () => {
    const a = openingSymbol(door(), wall).arcs[0]
    const b = openingSymbol(door({ flipSide: true }), wall).arcs[0]
    expect(a).not.toBe(b)
  })

  it('jendela nako jadi bilah kaca di 3D; jenis tak dikenal ditolak', () => {
    const win: Opening = { id: 'j', wallId: 'w', at: 2, width: 1, kind: 'window', sill: 0.9, height: 1.2, style: 'louvre' }
    const glass = buildPieces({ ...emptyProject(), walls: [wall], openings: [win] }).filter((x) => x.kind === 'glass')
    expect(glass.length).toBeGreaterThan(5)
    expect(styleOf({ kind: 'window' })).toBe('casement')
    expect(() => parseProject({ ...emptyProject(), walls: [wall], openings: [{ ...win, style: 'swing' }] })).toThrow()
  })
})

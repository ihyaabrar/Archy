import { describe, expect, it } from 'vitest'
import { buildPieces } from './mesh'
import { emptyProject, type Opening, type Wall } from './project'

const wall: Wall = { id: 'w1', a: [0, 0], b: [4, 0], thickness: 0.15, height: 3 }
const op = (kind: Opening['kind'], at: number, sill: number, height: number): Opening => ({ id: kind, wallId: 'w1', at, width: 1, kind, sill, height })

describe('buildPieces', () => {
  it('dinding polos jadi satu balok penuh', () => {
    const [p] = buildPieces({ ...emptyProject(), walls: [wall] })
    expect(p.size).toEqual([4, 3, 0.15])
    expect(p.center).toEqual([2, 1.5, 0])
  })

  it('pintu menyisakan ambang atas, tanpa kaca', () => {
    const ps = buildPieces({ ...emptyProject(), walls: [wall], openings: [op('door', 2, 0, 2.1)] })
    expect(ps.filter((p) => p.kind === 'glass')).toHaveLength(0)
    const lintel = ps.find((p) => p.size[0] === 1)!
    expect(lintel.center[1]).toBeCloseTo(2.55)
    expect(lintel.size[1]).toBeCloseTo(0.9)
    expect(ps.filter((p) => p.kind === 'wall')).toHaveLength(3) // kiri, kanan, ambang atas
    const leaf = ps.find((p) => p.kind === 'door')!
    // Engsel di x = 1,5; daun tegak lurus dinding sepanjang lebar pintu, seperti simbol 2D.
    expect(leaf.center[0]).toBeCloseTo(1.5)
    expect(leaf.center[2]).toBeCloseTo(0.5)
    expect(leaf.size).toEqual([1, 2.1, 0.04])
  })

  it('jendela punya dinding bawah, atas, dan kaca', () => {
    const ps = buildPieces({ ...emptyProject(), walls: [wall], openings: [op('window', 2, 0.9, 1.2)] })
    expect(ps.map((p) => p.kind).sort()).toEqual(['glass', 'wall', 'wall', 'wall', 'wall'])
    const glass = ps.find((p) => p.kind === 'glass')!
    expect(glass.center[1]).toBeCloseTo(1.5)
  })

  it('dinding miring diputar sesuai arahnya', () => {
    const [p] = buildPieces({ ...emptyProject(), walls: [{ ...wall, b: [0, 4] }] })
    expect(p.rotY).toBeCloseTo(-Math.PI / 2)
    expect(p.center).toEqual([0, 1.5, 2])
  })
})

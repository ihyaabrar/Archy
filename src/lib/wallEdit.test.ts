import { describe, expect, it } from 'vitest'
import { duplicate, emptyProject, splitWall, translateWall, type Opening, type Project, type Wall } from './project'

const W = (id: string, a: [number, number], b: [number, number]): Wall => ({ id, a, b, thickness: 0.15, height: 3 })
// Kotak 6 × 4: dinding kanan 'b' punya jendela di tengahnya.
const win: Opening = { id: 'j', wallId: 'b', at: 2, width: 1, kind: 'window', sill: 0.9, height: 1.2 }
const base: Project = {
  ...emptyProject(),
  walls: [W('a', [0, 0], [6, 0]), W('b', [6, 0], [6, 4]), W('c', [6, 4], [0, 4]), W('d', [0, 4], [0, 0])],
  openings: [win],
  rooms: [{ id: 'r', name: 'R', points: [[0, 0], [6, 0], [6, 4], [0, 4]] }],
  furniture: [{ id: 'f', kind: 'sofa', pos: [2, 2], rot: 0 }],
}

describe('penyuntingan dinding', () => {
  it('geser dinding utuh: tetangga ikut memanjang, ruangan ikut, jendela ikut bergeser', () => {
    const out = translateWall(base, 'b', [1, 0])
    expect(out.walls.find((w) => w.id === 'b')!.a).toEqual([7, 0])
    expect(out.walls.find((w) => w.id === 'a')!.b).toEqual([7, 0])
    expect(out.walls.find((w) => w.id === 'c')!.a).toEqual([7, 4])
    expect(out.rooms[0].points[1]).toEqual([7, 0])
    expect(out.openings[0].at).toBe(2) // tetap di tengah dinding yang dipindah
    expect(translateWall(base, 'b', [0, 0])).toBe(base)
  })

  it('bagi dinding: dua potongan menyambung, bukaan pindah ke potongan yang memuatnya', () => {
    const r = splitWall(base, 'b', 1)!
    const [first, second] = r.ids.map((id) => r.project.walls.find((w) => w.id === id)!)
    expect(first.b).toEqual([6, 1])
    expect(second.a).toEqual([6, 1])
    expect(r.project.openings[0].wallId).toBe(second.id)
    expect(r.project.openings[0].at).toBe(1)
    expect(splitWall(base, 'b', 0.01)).toBeNull()
  })

  it('duplikat dinding beserta bukaannya, ruangan, dan furnitur', () => {
    const w = duplicate(base, 'wall', 'b', [1, 0])!
    expect(w.project.walls).toHaveLength(5)
    expect(w.project.openings.filter((o) => o.wallId === w.id)).toHaveLength(1)
    const r = duplicate(base, 'room', 'r', [0, 5])!
    expect(r.project.rooms[1].name).toBe('R (salinan)')
    expect(duplicate(base, 'furniture', 'f', [0.5, 0.5])!.project.furniture[1].pos).toEqual([2.5, 2.5])
  })
})

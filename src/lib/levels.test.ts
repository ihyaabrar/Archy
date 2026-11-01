import { describe, expect, it } from 'vitest'
import { addLevel, emptyProject, upTo, withLevel, moveVertex, type Project, type Wall } from './project'
import { buildPieces } from './mesh'
import { planSheets } from './drawing'
import { chapters, keyframes } from './presentation'
import { STAIR_STEPS } from './furniture'

const wall = (id: string, level?: string): Wall => ({ id, a: [0, 0], b: [4, 0], thickness: 0.15, height: 3, level })

function twoStorey(): { p: Project; up: string } {
  const { project, id } = addLevel({ ...emptyProject(), walls: [wall('w1')] })
  return {
    up: id,
    p: {
      ...project,
      walls: [...project.walls, wall('w2', id)],
      rooms: [
        { id: 'r1', name: 'Ruang Tamu', points: [[0, 0], [4, 0], [4, 3], [0, 3]] },
        { id: 'r2', name: 'Kamar Atas', points: [[0, 0], [4, 0], [4, 3], [0, 3]], level: id },
      ],
      furniture: [{ id: 's', kind: 'stairs', pos: [1, 1.5], rot: 0 }],
    },
  }
}

describe('bangunan bertingkat', () => {
  it('dinding lantai atas dinaikkan setinggi elevasi; dinding bawah menyambung sampai lantai atas', () => {
    const { p } = twoStorey()
    const walls = buildPieces(p).filter((x) => x.kind === 'wall')
    // Dinding 3 m di lantai 1 naik sampai elevasi lantai 2 (3,2 m): tidak ada celah setebal pelat.
    expect(walls.map((x) => x.center[1])).toEqual([1.6, 3.2 + 1.5])
    expect(walls[0].size[1]).toBeCloseTo(3.2)
  })

  it('tangga jadi anak tangga yang makin tinggi', () => {
    const steps = buildPieces(twoStorey().p).filter((x) => x.wallId === 's')
    expect(steps).toHaveLength(STAIR_STEPS)
    expect(steps.at(-1)!.size[1]).toBeCloseTo(3.2)
    expect(steps[0].size[1]).toBeLessThan(steps[1].size[1])
  })

  it('lihat sampai lantai: lantai atas disembunyikan', () => {
    const { p } = twoStorey()
    expect(upTo(p, 'L1').walls.map((w) => w.id)).toEqual(['w1'])
  })

  it('menggeser titik hanya di lantai aktif', () => {
    const { p, up } = twoStorey()
    const out = withLevel(p, up, (part) => moveVertex(part, [4, 0], [5, 0]))
    expect(out.walls.find((w) => w.id === 'w1')!.b).toEqual([4, 0])
    expect(out.walls.find((w) => w.id === 'w2')!.b).toEqual([5, 0])
  })

  it('ekspor 2D satu gambar per lantai, presentasi masuk lantai atas', () => {
    const { p } = twoStorey()
    const sheets = planSheets(p, 'Rumah')
    expect(sheets).toHaveLength(2)
    expect(sheets[1].svg).toContain('Rumah, Lantai 2')
    const c = chapters(p).filter((x) => x.kind === 'room')
    expect(c.map((x) => x.kind === 'room' && x.level)).toEqual(['Lantai 1', 'Lantai 2'])
    expect(keyframes(p)[3].pos[1]).toBeCloseTo(3.2 + 1.6) // kamera di kamar atas setinggi mata dari lantai 2
  })
})

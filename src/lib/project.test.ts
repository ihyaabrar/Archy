import { describe, expect, it } from 'vitest'
import {
  clampOpening,
  emptyProject,
  lockAngle,
  nearestWall,
  parseProject,
  polygonArea,
  snapToEndpoint,
  wallSpans,
  type Opening,
  type Wall,
} from './project'
import { useProject } from './store'

const wall: Wall = { id: 'w1', a: [0, 0], b: [4, 0], thickness: 0.15, height: 3 }
const door = (at: number, width = 0.9): Opening => ({ id: 'o' + at, wallId: 'w1', at, width, kind: 'door', sill: 0, height: 2.1 })

describe('geometri', () => {
  it('memotong dinding di bukaan', () => {
    expect(wallSpans(wall, [])).toEqual([[0, 4]])
    const spans = wallSpans(wall, [door(1), door(3)])
    expect(spans.map(([a, b]) => [+a.toFixed(2), +b.toFixed(2)])).toEqual([[0, 0.55], [1.45, 2.55], [3.45, 4]])
  })

  it('bukaan yang menempel ujung tidak menyisakan potongan kosong', () => {
    expect(wallSpans(wall, [door(0.45)]).map(([a, b]) => [+a.toFixed(2), b])).toEqual([[0.9, 4]])
  })

  it('bukaan dijaga tetap di dalam dinding', () => {
    expect(clampOpening(0, 0.9, wall)).toBe(0.45)
    expect(clampOpening(10, 0.9, wall)).toBe(3.55)
  })

  it('mencari dinding terdekat dalam jarak tangkap', () => {
    expect(nearestWall([2, 0.2], [wall], 0.3)?.t).toBeCloseTo(2)
    expect(nearestWall([2, 1], [wall], 0.3)).toBeNull()
  })

  it('snap ke ujung dinding', () => {
    expect(snapToEndpoint([3.95, 0.05], [wall], 0.1)).toEqual([4, 0])
    expect(snapToEndpoint([3, 1], [wall], 0.1)).toBeNull()
  })

  it('kunci sudut ke 45 derajat', () => {
    const [x, y] = lockAngle([0, 0], [3, 0.2])
    expect(y).toBeCloseTo(0)
    expect(x).toBeCloseTo(Math.hypot(3, 0.2))
  })

  it('luas poligon', () => {
    expect(polygonArea([[0, 0], [4, 0], [4, 3], [0, 3]])).toBe(12)
  })
})

describe('parseProject', () => {
  it('menerima proyek valid', () => {
    const p = { ...emptyProject(), walls: [wall], openings: [door(2)] }
    expect(parseProject(JSON.parse(JSON.stringify(p)))).toEqual(p)
  })

  it('menolak data rusak', () => {
    expect(() => parseProject(null)).toThrow()
    expect(() => parseProject({ version: 1, walls: [{ id: 'x', a: [0], b: [1, 1], thickness: 1, height: 1 }], openings: [], rooms: [] })).toThrow()
    expect(() => parseProject({ ...emptyProject(), openings: [door(1)] })).toThrow() // dinding tidak ada
  })
})

describe('riwayat', () => {
  it('undo dan redo', () => {
    const s = useProject.getState()
    s.replace(emptyProject())
    s.apply((p) => ({ ...p, walls: [wall] }))
    expect(useProject.getState().project.walls).toHaveLength(1)
    useProject.getState().undo()
    expect(useProject.getState().project.walls).toHaveLength(0)
    useProject.getState().redo()
    expect(useProject.getState().project.walls).toHaveLength(1)
    useProject.getState().apply((p) => ({ ...p, walls: [] }))
    expect(useProject.getState().future).toHaveLength(0)
  })
})

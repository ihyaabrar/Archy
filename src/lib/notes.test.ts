import { describe, expect, it } from 'vitest'
import { duplicate, emptyProject, onLevel, parseProject, removeLevel, withLevel, type Project } from './project'
import { planSvg } from './drawing'

const base: Project = {
  ...emptyProject(),
  levels: [
    { id: 'L1', name: 'Lantai 1', elevation: 0 },
    { id: 'L2', name: 'Lantai 2', elevation: 3.2 },
  ],
  walls: [{ id: 'w', a: [0, 0], b: [4, 0], thickness: 0.15, height: 3 }],
  notes: [
    { id: 't', a: [1, 1], text: 'Taman <depan>' },
    { id: 'u', a: [0, 2], b: [4, 2], level: 'L2' },
  ],
}

describe('anotasi', () => {
  it('ikut lantainya saat dipisah, disunting, dan lantai dihapus', () => {
    expect(onLevel(base, 'L1').notes!.map((n) => n.id)).toEqual(['t'])
    const moved = withLevel(base, 'L2', (p) => ({ ...p, notes: p.notes!.map((n) => ({ ...n, a: [1, 2] as [number, number] })) }))
    expect(moved.notes!.find((n) => n.id === 't')!.a).toEqual([1, 1])
    expect(moved.notes!.find((n) => n.id === 'u')!.a).toEqual([1, 2])
    expect(removeLevel(base, 'L2').notes!.map((n) => n.id)).toEqual(['t'])
  })

  it('duplikat bergeser, garis ukur ikut kedua ujungnya', () => {
    const r = duplicate(base, 'note', 'u', [0.5, 0.5])!
    expect(r.project.notes!.at(-1)).toMatchObject({ a: [0.5, 2.5], b: [4.5, 2.5], level: 'L2' })
  })

  it('validasi menolak anotasi rusak dan ekspor meng-escape teks', () => {
    expect(() => parseProject({ ...base, notes: [{ id: 'x', a: [0] }] })).toThrow('anotasi')
    expect(() => parseProject({ ...base, notes: [{ id: 'x', a: [0, 0], level: 'L9' }] })).toThrow()
    const svg = planSvg(onLevel(base, 'L1'), 'Uji')!.svg
    expect(svg).toContain('Taman &#60;depan&#62;')
    expect(svg).toContain('>U</text>')
  })
})

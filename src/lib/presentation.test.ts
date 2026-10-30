import { describe, expect, it } from 'vitest'
import { chapters, keyframes, riseAt, sample } from './presentation'
import { emptyProject, type Project } from './project'

const p: Project = {
  ...emptyProject(),
  walls: [{ id: 'w', a: [0, 0], b: [8, 0], thickness: 0.15, height: 3 }],
  rooms: [
    { id: 'a', name: 'Kamar', points: [[0, 0], [4, 0], [4, 4], [0, 4]], floor: 'kayu' },
    { id: 'b', name: 'Dapur', points: [[4, 0], [8, 0], [8, 4], [4, 4]] },
  ],
  furniture: [{ id: 'f', kind: 'bed2', pos: [2, 2], rot: 0 }],
}

describe('presentasi', () => {
  it('bab: pembuka, naik, tiap ruangan dengan data nyata, penutup', () => {
    const c = chapters(p)
    expect(c.map((x) => x.kind)).toEqual(['intro', 'rise', 'room', 'room', 'outro'])
    const kamar = c[2] as Extract<(typeof c)[number], { kind: 'room' }>
    expect(kamar.area).toBe(16)
    expect(kamar.floor).toBe('Parket kayu')
    expect(kamar.furniture).toEqual(['Kasur 160×200'])
    expect((c[3] as typeof kamar).furniture).toEqual([])
  })

  it('satu keyframe per bab, kamera ruangan setinggi mata di dalam ruangan', () => {
    const k = keyframes(p)
    expect(k).toHaveLength(chapters(p).length)
    const [x, y, z] = k[2].pos
    expect(y).toBeCloseTo(1.6)
    expect(x > 0 && x < 4 && z > 0 && z < 4).toBe(true)
    expect(k[2].look[0]).toBe(2) // menatap tengah ruangan
    expect(Math.hypot(x - 2, z - 2)).toBeGreaterThan(1.5) // dari pojok, bukan dari tengah
  })

  it('interpolasi halus, dibatasi di ujung, dan versi tanpa transisi', () => {
    const k = keyframes(p)
    expect(sample(k, 0).pos).toEqual(k[0].pos)
    sample(k, 99).pos.forEach((v, i) => expect(v).toBeCloseTo(k.at(-1)!.pos[i]))
    expect(sample(k, 0.5).pos[1]).toBeCloseTo((k[0].pos[1] + k[1].pos[1]) / 2)
    expect(sample(k, 1.3, true).pos).toEqual(k[1].pos)
    expect(riseAt(-1)).toBe(0)
    expect(riseAt(5)).toBe(1)
    expect(riseAt(0.4, true)).toBe(0)
  })
})

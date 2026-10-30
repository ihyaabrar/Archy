import { describe, expect, it } from 'vitest'
import { blocked, blockers, move, roomAt, tourStop } from './walk'
import { emptyProject, type Opening, type Project, type Wall } from './project'

const wall: Wall = { id: 'w1', a: [0, 0], b: [4, 0], thickness: 0.2, height: 3 }
const op = (kind: Opening['kind']): Opening => ({ id: kind, wallId: 'w1', at: 2, width: 1, kind, sill: kind === 'door' ? 0 : 0.9, height: 1.2 })
const plan = (openings: Opening[] = []): Project => ({ ...emptyProject(), walls: [wall], openings })

describe('tabrakan', () => {
  it('tidak bisa menembus dinding', () => {
    const segs = blockers(plan())
    expect(blocked([2, 0.2], segs)).toBe(true)
    expect(blocked([2, 1], segs)).toBe(false)
    const [, y] = move([2, 1], [2, -1], segs)
    expect(y).toBeGreaterThanOrEqual(0.35) // berhenti di depan dinding, tidak tembus
  })

  it('pintu bisa dilewati, jendela tidak', () => {
    expect(blocked([2, 0], blockers(plan([op('door')])))).toBe(false)
    expect(blocked([2, 0], blockers(plan([op('window')])))).toBe(true)
  })

  it('mengenali ruangan dan arah tur', () => {
    const rooms = [
      { id: 'a', name: 'Tamu', points: [[0, 0], [4, 0], [4, 4], [0, 4]] as [number, number][] },
      { id: 'b', name: 'Dapur', points: [[4, 0], [8, 0], [8, 4], [4, 4]] as [number, number][] },
    ]
    expect(roomAt([1, 1], rooms)).toBe('Tamu')
    expect(roomAt([6, 1], rooms)).toBe('Dapur')
    expect(roomAt([9, 1], rooms)).toBeNull()
    const s = tourStop(rooms, 0)
    expect(s.pos).toEqual([2, 2])
    expect(s.yaw).toBeCloseTo(-Math.PI / 2) // menghadap +x, ke Dapur
  })

  it('menabrak miring tetap bergeser sejajar dinding', () => {
    const [x, y] = move([1, 1], [1.5, 0.1], blockers(plan()))
    expect(x).toBeCloseTo(1.5)
    expect(y).toBeGreaterThanOrEqual(0.35)
    expect(y).toBeLessThan(0.5)
  })
})

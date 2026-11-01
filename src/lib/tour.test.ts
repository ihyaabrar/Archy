import { describe, expect, it } from 'vitest'
import { chapters, keyframes, moveInTour, setInTour, tourRooms } from './presentation'
import { emptyProject, parseProject, type Project } from './project'

const sq = (x: number): [number, number][] => [[x, 0], [x + 3, 0], [x + 3, 3], [x, 3]]
const base: Project = {
  ...emptyProject(),
  walls: [{ id: 'w', a: [0, 0], b: [9, 0], thickness: 0.15, height: 3 }],
  rooms: [
    { id: 'a', name: 'Tamu', points: sq(0) },
    { id: 'b', name: 'Makan', points: sq(3) },
    { id: 'c', name: 'Kamar', points: sq(6) },
  ],
}
const names = (p: Project) => chapters(p).flatMap((c) => (c.kind === 'room' ? [c.room.name] : []))

describe('urutan ruangan presentasi', () => {
  it('bawaan mengikuti urutan digambar', () => {
    expect(names(base)).toEqual(['Tamu', 'Makan', 'Kamar'])
  })

  it('naik/turun mengubah urutan bab dan kamera bersamaan', () => {
    const p = moveInTour(base, 'c', -1)
    expect(names(p)).toEqual(['Tamu', 'Kamar', 'Makan'])
    expect(keyframes(p)).toHaveLength(chapters(p).length)
    expect(moveInTour(base, 'a', -1)).toBe(base) // sudah paling atas
  })

  it('ruangan yang dilewati hilang dari bab tetapi tetap di daftar urutan', () => {
    const p = setInTour(base, 'b', false)
    expect(names(p)).toEqual(['Tamu', 'Kamar'])
    expect(tourRooms(p)).toHaveLength(3)
    expect(names(setInTour(p, 'b', true))).toEqual(['Tamu', 'Makan', 'Kamar'])
  })

  it('ruangan baru yang belum tercantum ikut di belakang; data rusak ditolak', () => {
    const p = moveInTour(base, 'c', -1)
    const more = { ...p, rooms: [...p.rooms, { id: 'd', name: 'Dapur', points: sq(9) }] }
    expect(names(more).at(-1)).toBe('Dapur')
    expect(() => parseProject({ ...base, tour: { order: [1], hidden: [] } })).toThrow('urutan')
  })
})

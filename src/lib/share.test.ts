import { describe, expect, it } from 'vitest'
import { decodeProject, encodeProject } from './share'
import { emptyProject, type Project } from './project'

const p: Project = {
  ...emptyProject(),
  walls: [{ id: 'w1', a: [0, 0], b: [4.123456, 0], thickness: 0.15, height: 3 }],
  rooms: [{ id: 'r1', name: 'Ruang Tamu', points: [[0, 0], [4, 0], [4, 3]] }],
}

describe('tautan bagikan', () => {
  it('bolak-balik tanpa kehilangan isi, angka dibulatkan ke mm', async () => {
    const code = await encodeProject(p)
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/)
    const back = await decodeProject(code)
    expect(back.walls[0].b[0]).toBe(4.123)
    expect(back.rooms[0].name).toBe('Ruang Tamu')
  })

  it('menolak isi yang rusak', async () => {
    await expect(decodeProject('bukan-denah')).rejects.toThrow()
  })
})

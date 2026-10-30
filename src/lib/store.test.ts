import { beforeEach, describe, expect, it } from 'vitest'
import { addProject, deleteProject, newProject, openProject, startPersistence, useProject } from './store'
import { emptyProject, type Wall } from './project'

// localStorage dan location minimal untuk lingkungan Node.
const mem = new Map<string, string>()
Object.assign(globalThis, {
  localStorage: {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
  },
  location: { hash: '', pathname: '/', search: '' },
})

const wall: Wall = { id: 'w', a: [0, 0], b: [3, 0], thickness: 0.15, height: 3 }

describe('proyek lokal', () => {
  beforeEach(() => mem.clear())

  it('memindahkan denah format lama tanpa kehilangan isi', () => {
    mem.set('denahin:project', JSON.stringify({ ...emptyProject(), walls: [wall] }))
    const stop = startPersistence()
    const s = useProject.getState()
    expect(s.projects).toHaveLength(1)
    expect(s.project.walls).toHaveLength(1)
    expect(mem.has('denahin:project')).toBe(false)
    stop()
  })

  it('proyek terpisah: simpan, pindah, hapus', () => {
    const stop = startPersistence()
    const first = useProject.getState().currentId!
    useProject.getState().apply((p) => ({ ...p, walls: [wall] }))
    newProject('Kedua')
    expect(useProject.getState().project.walls).toHaveLength(0)
    expect(useProject.getState().projects.map((m) => m.name)).toEqual(['Kedua', 'Denah pertama'])

    openProject(first)
    expect(useProject.getState().project.walls).toHaveLength(1)

    deleteProject(first)
    expect(useProject.getState().projects.map((m) => m.name)).toEqual(['Kedua'])
    expect(mem.has(`denahin:p:${first}`)).toBe(false)
    stop()
  })

  it('denah dari luar masuk sebagai proyek baru', () => {
    const stop = startPersistence()
    addProject({ ...emptyProject(), walls: [wall] }, 'Impor')
    expect(useProject.getState().projects[0].name).toBe('Impor')
    expect(useProject.getState().project.walls).toHaveLength(1)
    stop()
  })
})

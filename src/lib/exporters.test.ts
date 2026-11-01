import { describe, expect, it } from 'vitest'
import { backupJson, importProjectFile } from './exporters'
import { emptyProject, type Project } from './project'

const p: Project = { ...emptyProject(), walls: [{ id: 'w', a: [0, 0], b: [3, 0], thickness: 0.15, height: 3 }] }
const file = (text: string, name = 'x.json') => new File([text], name, { type: 'application/json' })

describe('impor dan cadangan', () => {
  it('file satu proyek dibaca, nama dari isi atau nama file', async () => {
    expect((await importProjectFile(file(JSON.stringify({ name: 'Rumah A', project: p }))))[0].name).toBe('Rumah A')
    expect((await importProjectFile(file(JSON.stringify(p), 'rumah-b.denahin.json')))[0].name).toBe('rumah-b')
  })

  it('cadangan banyak proyek bolak-balik', async () => {
    const out = await importProjectFile(file(backupJson([{ name: 'A', project: p }, { name: 'B', project: emptyProject() }])))
    expect(out.map((x) => x.name)).toEqual(['A', 'B'])
    expect(out[0].project.walls).toHaveLength(1)
  })

  it('menolak isi yang bukan denah atau cadangan rusak', async () => {
    await expect(importProjectFile(file('bukan json'))).rejects.toThrow('bukan file proyek')
    await expect(importProjectFile(file(JSON.stringify({ kind: 'denahin-cadangan', projects: [] })))).rejects.toThrow('kosong')
    await expect(importProjectFile(file(JSON.stringify({ kind: 'denahin-cadangan', projects: [{ name: 'X', project: { version: 1 } }] })))).rejects.toThrow()
  })
})

describe('cadangan menyimpan id asli', () => {
  it('id ikut bolak-balik supaya pemulihan bisa mengenali proyek yang sama', async () => {
    const out = await importProjectFile(new File([backupJson([{ name: 'A', project: p, id: 'abc123' }])], 'c.json'))
    expect(out[0].id).toBe('abc123')
  })
})

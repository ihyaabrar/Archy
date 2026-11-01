import { describe, expect, it, vi } from 'vitest'
import { parseReport, toReport } from './report'
import { POST } from '@/app/api/kesalahan/route'

describe('laporan kesalahan', () => {
  it('tidak pernah membawa hash (isi denah) atau query', () => {
    const r = toReport(new Error('gagal'), 'jendela', '/presentasi?x=1#nama=Rumah&denah=AAAA')
    expect(r.path).toBe('/presentasi')
    expect(JSON.stringify(r)).not.toContain('denah=')
  })

  it('memotong pesan panjang dan membuang baris stack yang berisi data panjang', () => {
    const e = new Error('x'.repeat(1000))
    e.stack = `Error\n    at a (b.js:1:1)\n    at ${'Q'.repeat(500)}`
    const r = toReport(e, 'jendela', '/')
    expect(r.message).toHaveLength(300)
    expect(r.stack).toBe('Error\n    at a (b.js:1:1)')
  })

  it('server menolak data rusak dan terlalu besar, mencatat yang valid', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const post = (body: string) => POST(new Request('http://x/api/kesalahan', { method: 'POST', body }))
    expect((await post('bukan json')).status).toBe(400)
    expect((await post(JSON.stringify({ message: 1 }))).status).toBe(400)
    expect((await post('x'.repeat(9000))).status).toBe(413)
    expect((await post(JSON.stringify({ message: 'm', where: 'w', path: '/p#denah=Z' }))).status).toBe(204)
    expect(log).toHaveBeenCalledWith('[kesalahan-klien]', expect.not.stringContaining('denah='))
    expect(parseReport(null)).toBeNull()
    log.mockRestore()
  })
})

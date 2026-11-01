// Laporan kesalahan dari browser ke server (/api/kesalahan), tanpa layanan pihak ketiga.
// Yang dikirim hanya data teknis: pesan, potongan stack, path halaman. Hash dan query URL tidak pernah ikut:
// hash tautan bagikan berisi seluruh denah, query bisa berisi alamat tujuan login.

export type Report = { message: string; stack?: string; where: string; path: string }

const MAX_PER_PAGE = 5 // satu error yang berulang tiap frame tidak boleh membanjiri server
const sent = new Set<string>()

export function toReport(err: unknown, where: string, path: string): Report {
  const e = err instanceof Error ? err : null
  const message = (e?.message ?? String(err)).slice(0, 300)
  // Stack di-trim dan dipotong; baris berisi data panjang (mis. base64) dibuang.
  const stack = e?.stack
    ?.split('\n')
    .slice(0, 8)
    .filter((l) => l.length < 300)
    .join('\n')
  return { message, stack, where: where.slice(0, 40), path: path.split(/[?#]/)[0].slice(0, 200) }
}

// Validasi di server: data dari luar tidak dipercaya.
export function parseReport(raw: unknown): Report | null {
  const o = raw as Partial<Report> | null
  if (!o || typeof o.message !== 'string' || typeof o.where !== 'string' || typeof o.path !== 'string') return null
  if (o.stack !== undefined && typeof o.stack !== 'string') return null
  return toReport(Object.assign(new Error(o.message), { stack: o.stack }), o.where, o.path)
}

export function report(err: unknown, where: string) {
  try {
    const r = toReport(err, where, location.pathname)
    const key = `${r.where}:${r.message}`
    if (sent.has(key) || sent.size >= MAX_PER_PAGE) return
    sent.add(key)
    const body = JSON.stringify(r)
    // sendBeacon tetap terkirim walau halaman sedang ditutup; fetch keepalive sebagai cadangan.
    if (!navigator.sendBeacon?.('/api/kesalahan', new Blob([body], { type: 'application/json' })))
      fetch('/api/kesalahan', { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(() => {})
  } catch {
    // Pelapor tidak boleh menimbulkan kesalahan baru.
  }
}

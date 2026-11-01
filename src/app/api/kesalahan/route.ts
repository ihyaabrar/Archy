import { parseReport } from '@/lib/report'

// Menerima laporan kesalahan dari browser dan menuliskannya ke log server (terbaca di log runtime hosting).
// Tidak disimpan ke basis data. Badan permintaan dibatasi 8 KB.
export async function POST(request: Request) {
  const text = await request.text()
  if (text.length > 8192) return new Response(null, { status: 413 })
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return new Response(null, { status: 400 })
  }
  const r = parseReport(raw)
  if (!r) return new Response(null, { status: 400 })
  console.error('[kesalahan-klien]', JSON.stringify(r))
  return new Response(null, { status: 204 })
}

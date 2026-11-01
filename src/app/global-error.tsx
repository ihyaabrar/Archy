'use client'

import { useEffect } from 'react'
import { report } from '@/lib/report'

// Pengaman terakhir kalau tata letak utama pun gagal. Gaya ditulis langsung karena globals.css tidak ikut dimuat di sini.
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error)
    report(error, 'tata-letak')
  }, [error])

  return (
    <html lang="id">
      <body style={{ margin: 0, minHeight: '100dvh', display: 'grid', placeItems: 'center', background: '#f3eee3', color: '#2a2420', fontFamily: 'system-ui, sans-serif' }}>
        <main style={{ maxWidth: '32rem', padding: '1rem' }}>
          <h1 style={{ fontFamily: 'Georgia, serif' }}>Denahin gagal dimuat</h1>
          <p>Proyek Anda tetap tersimpan di browser ini. Coba muat ulang halaman.</p>
          <button
            onClick={() => retry()}
            style={{ minHeight: 44, padding: '0 1rem', border: '1.5px solid #a8401a', background: '#a8401a', color: '#f3eee3', borderRadius: 3, cursor: 'pointer' }}
          >
            Coba lagi
          </button>
        </main>
      </body>
    </html>
  )
}

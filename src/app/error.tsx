'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { report } from '@/lib/report'

// Pengaman halaman: kesalahan tak terduga tampil sebagai pesan, bukan layar putih. Data proyek di browser tidak disentuh.
export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error)
    report(error, 'halaman')
  }, [error])

  return (
    <main className="state-screen">
      <h1 className="stencil">Ada yang tidak berjalan</h1>
      <p>Halaman ini gagal ditampilkan. Proyek Anda tetap tersimpan di browser dan tidak terhapus.</p>
      <div className="present-actions">
        <button className="btn btn-accent" onClick={() => retry()}>
          Coba lagi
        </button>
        <Link className="btn btn-link" href="/">
          Ke daftar proyek
        </Link>
      </div>
    </main>
  )
}

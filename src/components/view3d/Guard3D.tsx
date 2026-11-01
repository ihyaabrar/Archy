'use client'

import { Component, type ReactNode } from 'react'
import { report } from '@/lib/report'

// Pengaman khusus tampilan 3D: kalau WebGL atau kartu grafis gagal di tengah jalan, hanya panel 3D yang
// menampilkan pesan; editor 2D dan data proyek tetap bisa dipakai. (Error boundary React harus berupa class.)
export class Guard3D extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.error('Tampilan 3D gagal:', error)
    report(error, '3d')
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="view3d-msg" role="alert">
        <p className="stencil">Tampilan 3D berhenti</p>
        <p>Kartu grafis atau browser menghentikan tampilan 3D. Denah Anda aman. Coba lagi, atau kembali ke Denah 2D.</p>
        <button className="btn" onClick={() => this.setState({ failed: false })}>
          Coba lagi
        </button>
      </div>
    )
  }
}

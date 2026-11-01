'use client'

import { useMemo, useRef, useState } from 'react'
import { useProject } from '@/lib/store'
import { elevationSheets, sectionSheets } from '@/lib/elevation'
import { printPlan } from '@/lib/exporters'

// Tampak empat sisi dan potongan A-A / B-B, dibuat dari model 3D denah yang sedang dibuka.
export function DrawingsButton() {
  const ref = useRef<HTMLDialogElement>(null)
  const [opened, setOpened] = useState(0)
  return (
    <>
      <button
        className="tool"
        onClick={() => {
          setOpened((n) => n + 1)
          ref.current?.showModal()
        }}
        aria-haspopup="dialog"
      >
        Tampak
      </button>
      <dialog ref={ref} className="projects drawings" aria-label="Tampak dan potongan" onClick={(e) => e.target === ref.current && ref.current.close()}>
        {opened > 0 && <DrawingsPanel key={opened} close={() => ref.current?.close()} />}
      </dialog>
    </>
  )
}

function DrawingsPanel({ close }: { close: () => void }) {
  const project = useProject((s) => s.project)
  const name = useProject((s) => (s.shared ? 'Denah kiriman' : (s.projects.find((m) => m.id === s.currentId)?.name ?? 'Denah')))
  const sheets = useMemo(() => [...elevationSheets(project, name), ...sectionSheets(project, name)], [project, name])
  const [i, setI] = useState(0)
  const sheet = sheets[Math.min(i, sheets.length - 1)]

  return (
    <div className="projects-body">
      <div className="projects-head">
        <h2 className="stencil">Tampak dan potongan</h2>
        <button className="btn" onClick={close}>
          Tutup
        </button>
      </div>
      {!sheet ? (
        <p className="muted">Denah masih kosong. Gambar dinding dulu; tampak dan potongan dibuat otomatis dari denah.</p>
      ) : (
        <>
          <div className="drawings-tabs" role="group" aria-label="Pilih gambar">
            {sheets.map((s, k) => (
              <button key={s.title} className="tool" aria-pressed={k === i} onClick={() => setI(k)}>
                {s.title.slice(name.length + 2)}
              </button>
            ))}
          </div>
          {/* SVG dibuat aplikasi dari data denah (nama di-escape), bukan HTML dari luar. */}
          <div className="drawings-sheet" dangerouslySetInnerHTML={{ __html: sheet.svg }} />
          <button className="btn btn-accent" onClick={() => printPlan(project, name)}>
            Cetak semua gambar (PDF)
          </button>
          <p className="muted">
            Potongan A-A dan B-B mengikuti tanda potongan di lembar kerja; bagian yang terpotong digambar hitam. Denah atap menunjukkan arah air dan kemiringan. PDF berisi denah tiap lantai, tampak, potongan, dan denah atap,
            skala 1:100 bila dicetak 100%.
          </p>
        </>
      )}
    </div>
  )
}

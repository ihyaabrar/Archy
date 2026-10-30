'use client'

import { useMemo, useRef, useState } from 'react'
import { NumberField } from './NumberField'
import { useProject } from '@/lib/store'
import { DEFAULT_COEF, quantities, toCsv, type Coefficients } from '@/lib/quantities'
import { downloadText } from '@/lib/exporters'

const COEF_KEY = 'denahin:koefisien'

// Koefisien disimpan di browser ini sebagai preferensi pengguna (bukan bagian denah).
function loadCoef(): Coefficients {
  try {
    const raw = JSON.parse(localStorage.getItem(COEF_KEY) ?? 'null')
    return raw && typeof raw === 'object' ? { ...DEFAULT_COEF, ...raw } : DEFAULT_COEF
  } catch {
    return DEFAULT_COEF
  }
}

export function QuantitiesButton() {
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
        Volume
      </button>
      <dialog ref={ref} className="projects quantities" aria-label="Volume material" onClick={(e) => e.target === ref.current && ref.current.close()}>
        {opened > 0 && <QuantitiesPanel key={opened} close={() => ref.current?.close()} />}
      </dialog>
    </>
  )
}

const fmt = (n: number) => n.toLocaleString('id-ID', { maximumFractionDigits: 2 })

function QuantitiesPanel({ close }: { close: () => void }) {
  const project = useProject((s) => s.project)
  const name = useProject((s) => (s.shared ? 'Denah kiriman' : (s.projects.find((m) => m.id === s.currentId)?.name ?? 'Denah')))
  const [coef, setCoefState] = useState(loadCoef)
  const rows = useMemo(() => quantities(project, coef), [project, coef])
  const levels = [...new Set(rows.map((r) => r.level))]

  const setCoef = (patch: Partial<Coefficients>) => {
    const next = { ...coef, ...patch }
    setCoefState(next)
    try {
      localStorage.setItem(COEF_KEY, JSON.stringify(next))
    } catch {}
  }

  return (
    <div className="projects-body">
      <div className="projects-head">
        <h2 className="stencil">Volume material</h2>
        <button className="btn" onClick={close}>
          Tutup
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="muted">Denah masih kosong. Gambar dinding dan ruangan dulu, volume dihitung otomatis dari denah.</p>
      ) : (
        <>
          {levels.map((lv) => (
            <table key={lv} className="qty">
              {levels.length > 1 && <caption className="stencil">{lv}</caption>}
              <thead>
                <tr>
                  <th scope="col">Item</th>
                  <th scope="col" className="num">
                    Jumlah
                  </th>
                  <th scope="col">Satuan</th>
                </tr>
              </thead>
              <tbody>
                {rows
                  .filter((r) => r.level === lv)
                  .map((r, i, arr) => (
                    <tr key={i} className={i === 0 || arr[i - 1].group !== r.group ? 'qty-group-start' : undefined}>
                      <td>
                        {r.item}
                        {r.note && <small className="muted qty-note">{r.note}</small>}
                      </td>
                      <td className="num">{fmt(r.qty)}</td>
                      <td>{r.unit}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          ))}
          <button className="btn btn-accent" onClick={() => downloadText(`${name} volume material.csv`, toCsv(rows), 'text/csv')}>
            Unduh CSV untuk RAB
          </button>
          <p className="muted">CSV memakai pemisah titik koma dan desimal koma, jadi langsung terbaca di Excel berbahasa Indonesia.</p>
        </>
      )}

      <fieldset className="picker coef">
        <legend>Asumsi perhitungan (sesuaikan dengan spesifikasi proyek)</legend>
        <NumberField label="Bata per m² dinding" value={coef.bricksPerM2} min={1} max={500} onCommit={(v) => setCoef({ bricksPerM2: v })} />
        <NumberField label="Sisi keramik (m)" value={coef.tileSize} min={0.1} max={2} onCommit={(v) => setCoef({ tileSize: v })} />
        <NumberField label="Daya sebar cat (m² per liter per lapis)" value={coef.paintM2PerLiter} min={1} max={50} onCommit={(v) => setCoef({ paintM2PerLiter: v })} />
        <NumberField label="Jumlah lapis cat" value={coef.paintCoats} min={1} max={5} onCommit={(v) => setCoef({ paintCoats: Math.round(v) })} />
        <NumberField label="Genteng per m² atap" value={coef.roofTilesPerM2} min={1} max={60} onCommit={(v) => setCoef({ roofTilesPerM2: v })} />
        <NumberField label="Sisa potong (0,05 = 5%)" value={coef.waste} min={0} max={0.5} onCommit={(v) => setCoef({ waste: v })} />
        <button className="link-btn" onClick={() => setCoef(DEFAULT_COEF)}>
          Kembalikan asumsi awal
        </button>
      </fieldset>
      <p className="muted">
        Panjang dinding diukur dari as, jadi pertemuan sudut terhitung sedikit lebih. Belum termasuk adukan, plester, kusen, dan pekerjaan struktur.
      </p>
    </div>
  )
}

'use client'

import { useEffect, useRef, useState } from 'react'
import { addProject, deleteProject, newProject, openFromCloud, openProject, renameProject, setCloudId, useProject } from '@/lib/store'
import { exportGlb, exportPng, exportProjectFile, importProjectFile, printPlan } from '@/lib/exporters'
import { deleteCloud, linkCurrentToCloud, listCloud, loadCloud, supabase, useCloud, type CloudProject } from '@/lib/cloud'

const dateFmt = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' })

// Tombol di header yang membuka dialog proyek: daftar, buat, impor, dan ekspor.
export function ProjectsButton() {
  const ref = useRef<HTMLDialogElement>(null)
  const [opened, setOpened] = useState(0) // panel dipasang ulang tiap dibuka, supaya pesan lama hilang
  const shared = useProject((s) => s.shared)
  const name = useProject((s) => (s.shared ? 'Denah kiriman' : (s.projects.find((m) => m.id === s.currentId)?.name ?? 'Denah')))
  return (
    <>
      <button
        className="tool project-btn"
        onClick={() => {
          setOpened((n) => n + 1)
          ref.current?.showModal()
        }}
        aria-haspopup="dialog"
      >
        <span className="muted">Proyek</span> {name}
      </button>
      <dialog ref={ref} className="projects" aria-label="Proyek" onClick={(e) => e.target === ref.current && ref.current.close()}>
        <ProjectsPanel key={opened} name={name} shared={shared} close={() => ref.current?.close()} />
      </dialog>
    </>
  )
}

function ProjectsPanel({ name, shared, close }: { name: string; shared: boolean; close: () => void }) {
  const projects = useProject((s) => s.projects)
  const currentId = useProject((s) => s.currentId)
  const [status, setStatus] = useState<{ busy?: string; ok?: string; err?: string }>({})

  const run = async (label: string, fn: () => unknown, ok?: string) => {
    setStatus({ busy: label })
    try {
      await fn()
      setStatus({ ok })
    } catch (e) {
      setStatus({ err: e instanceof Error ? e.message : String(e) })
    }
  }
  const project = () => useProject.getState().project

  return (
    <div className="projects-body">
      <div className="projects-head">
        <h2 className="stencil">Proyek</h2>
        <button className="btn" onClick={close}>
          Tutup
        </button>
      </div>

      {!shared && currentId && (
        <label className="field">
          <span>Nama proyek ini</span>
          <input
            key={currentId}
            defaultValue={name}
            maxLength={60}
            onBlur={(e) => {
              const v = e.target.value.trim()
              if (v && v !== name) renameProject(currentId, v)
            }}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          />
        </label>
      )}

      <section aria-label="Unduh">
        <h3>Unduh proyek ini</h3>
        <div className="export-grid">
          <button className="btn" disabled={!!status.busy} onClick={() => run('png', () => exportPng(project(), name), 'Gambar PNG diunduh.')}>
            Gambar PNG
          </button>
          <button className="btn" disabled={!!status.busy} onClick={() => run('pdf', () => printPlan(project(), name), 'Dialog cetak dibuka. Pilih "Simpan sebagai PDF" untuk berkas PDF.')}>
            Cetak atau PDF
          </button>
          <button className="btn" disabled={!!status.busy} onClick={() => run('glb', () => exportGlb(project(), name), 'Model 3D GLB diunduh.')}>
            Model 3D (GLB)
          </button>
          <button className="btn" disabled={!!status.busy} onClick={() => run('file', () => exportProjectFile(project(), name), 'File proyek diunduh. Buka lagi lewat "Impor file proyek".')}>
            File proyek
          </button>
        </div>
        <p className="muted">PDF dicetak skala 1:100 bila ukuran cetak 100%. File proyek bisa dibuka lagi di Denahin di perangkat lain.</p>
      </section>

      <p className={status.err ? 'field-error' : 'muted'} role="status" aria-live="polite">
        {status.busy ? 'Sedang memproses…' : (status.err ?? status.ok ?? '')}
      </p>

      <section aria-label="Daftar proyek">
        <div className="projects-list-head">
          <h3>Proyek di browser ini</h3>
          <button className="btn btn-accent" onClick={() => (newProject(`Denah ${projects.length + 1}`), close())}>
            Denah baru
          </button>
          <label className="btn file-btn">
            Impor file proyek
            <input
              type="file"
              accept=".json,application/json"
              onChange={(e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (f) run('import', async () => {
                  const { project: p, name: n } = await importProjectFile(f)
                  addProject(p, n)
                  close()
                })
              }}
            />
          </label>
        </div>
        <ul className="projects-list">
          {projects.map((m) => (
            <li key={m.id} aria-current={!shared && m.id === currentId ? 'true' : undefined}>
              <button className="project-open" onClick={() => (openProject(m.id), close())}>
                <span className="project-name">{m.name}</span>
                <span className="muted">
                  Diubah {dateFmt.format(m.updatedAt)}
                  {m.cloudId && ' · tertaut ke cloud'}
                </span>
              </button>
              <button
                className="btn btn-danger"
                aria-label={`Hapus ${m.name}`}
                onClick={() => confirm(`Hapus "${m.name}" dari browser ini? Tindakan ini tidak bisa diurungkan.`) && deleteProject(m.id)}
              >
                Hapus
              </button>
            </li>
          ))}
        </ul>
        <p className="muted">Proyek disimpan di browser ini. Tautkan ke cloud atau unduh file proyek untuk cadangan dan pindah perangkat.</p>
      </section>

      {supabase() && <CloudSection shared={shared} close={close} />}
    </div>
  )
}

function CloudSection({ shared, close }: { shared: boolean; close: () => void }) {
  const session = useCloud((s) => s.session)
  const sync = useCloud((s) => s.sync)
  const syncError = useCloud((s) => s.syncError)
  const current = useProject((s) => s.projects.find((m) => m.id === s.currentId))
  const [list, setList] = useState<{ items?: CloudProject[]; err?: string; busy?: string }>({})

  const refresh = () =>
    listCloud()
      .then((items) => setList({ items }))
      .catch((e) => setList({ err: (e as Error).message }))

  useEffect(() => {
    if (session) refresh()
  }, [session])

  if (!session)
    return (
      <section aria-label="Cloud">
        <h3>Cloud</h3>
        <p className="muted">Masuk lewat tombol Masuk di kanan atas untuk menyimpan proyek ke cloud dan membukanya di perangkat lain.</p>
      </section>
    )

  const act = async (label: string, fn: () => Promise<unknown>) => {
    setList((l) => ({ ...l, busy: label, err: undefined }))
    try {
      await fn()
      await refresh()
    } catch (e) {
      setList((l) => ({ ...l, busy: undefined, err: (e as Error).message }))
    }
  }

  return (
    <section aria-label="Cloud">
      <div className="projects-list-head">
        <h3>Di cloud</h3>
        {!shared && current && !current.cloudId && (
          <button className="btn btn-accent" disabled={!!list.busy} onClick={() => act('link', linkCurrentToCloud)}>
            Simpan proyek ini ke cloud
          </button>
        )}
      </div>
      {!shared && current?.cloudId && (
        <p className={sync === 'error' ? 'field-error' : 'muted'} role="status">
          {sync === 'saving' && 'Menyimpan ke cloud…'}
          {sync === 'error' && `Gagal menyimpan ke cloud: ${syncError}. Perubahan tetap aman di browser ini dan dicoba lagi saat Anda mengedit.`}
          {(sync === 'saved' || sync === 'idle') && `"${current.name}" tertaut ke cloud dan tersimpan otomatis.`}
        </p>
      )}
      {list.err && <p className="field-error" role="alert">{list.err}</p>}
      {!list.items && !list.err && <p className="muted">Memuat daftar cloud…</p>}
      {list.items?.length === 0 && <p className="muted">Belum ada proyek di cloud. Simpan proyek yang sedang terbuka dengan tombol di atas.</p>}
      {!!list.items?.length && (
        <ul className="projects-list">
          {list.items.map((c) => (
            <li key={c.id}>
              <button
                className="project-open"
                disabled={!!list.busy}
                onClick={() =>
                  act('open', async () => {
                    openFromCloud(c.id, c.name, await loadCloud(c.id))
                    close()
                  })
                }
              >
                <span className="project-name">{c.name}</span>
                <span className="muted">Disimpan {dateFmt.format(new Date(c.updatedAt))}</span>
              </button>
              <button
                className="btn btn-danger"
                disabled={!!list.busy}
                aria-label={`Hapus ${c.name} dari cloud`}
                onClick={() =>
                  confirm(`Hapus "${c.name}" dari cloud? Salinan di browser ini tetap ada.`) &&
                  act('delete', async () => {
                    await deleteCloud(c.id)
                    const local = useProject.getState().projects.find((m) => m.cloudId === c.id)
                    if (local) setCloudId(local.id, undefined)
                  })
                }
              >
                Hapus
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
